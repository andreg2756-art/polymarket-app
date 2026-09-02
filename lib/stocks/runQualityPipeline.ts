import { prisma } from "@/lib/prisma";
import { fetchScreenerQuotes, QUALITY_SCREENS } from "@/lib/stocks/yahooScreener";
import { getRevenueGrowthScore } from "@/lib/stocks/revenueGrowth";
import { qualityFirstPass, qualityFinalScore } from "@/lib/stocks/qualityScore";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { sendEmail } from "@/lib/notify";

// Business Quant (the primary source in lib/stocks/fundamentals.ts) shows
// no rate-limit headers, but IS rate-limited — confirmed by testing: a
// concurrent burst gets 429s, and an isolated request eventually revealed
// the real limit in its error body ("Rate limit exceeded. Limit: 40
// req/day"). That's a hard daily cap, not a per-minute window like
// Polygon's — waiting longer within one run doesn't help, unlike Polygon.
// Each ticker needs 3 calls (BS/IS/CF), and this budget is shared with
// Turnaround's identical shortlist below, so keep both small enough that
// 2x this x3 stays comfortably under 40 — 6 here + 6 there x3 = 36,
// leaving headroom for a manual "Scan Market" re-run the same day. Do not
// raise this without re-deriving the math above.
const FUNDAMENTALS_SHORTLIST_SIZE = 6;

export interface QualityPipelineResult {
  tickers: string[]; // every ticker touched this run, for the shared cleanup step
  candidateCount: number;
}

export async function runQualityPipeline(): Promise<QualityPipelineResult> {
  const t0 = Date.now();
  const quotes = await fetchScreenerQuotes(QUALITY_SCREENS);
  if (quotes.length === 0) return { tickers: [], candidateCount: 0 };
  console.log(`[quality-pipeline] screener fetch: ${Date.now() - t0}ms, ${quotes.length} candidates`);

  const tRev0 = Date.now();
  const revenueGrowthResults = await Promise.allSettled(
    quotes.map((q) => getRevenueGrowthScore(q.symbol, null).then((r) => ({ ticker: q.symbol, value: r.value })))
  );
  console.log(`[quality-pipeline] SEC EDGAR revenue-growth pass: ${Date.now() - tRev0}ms`);
  const revenueGrowthMap = new Map<string, number>();
  for (const r of revenueGrowthResults) {
    if (r.status === "fulfilled" && r.value.value !== null) {
      const numVal = typeof r.value.value === "string"
        ? parseFloat(r.value.value.replace("%", "").replace("+", ""))
        : Number(r.value.value);
      if (isFinite(numVal)) revenueGrowthMap.set(r.value.ticker, numVal);
    }
  }

  const scored = quotes.map((q) => ({
    quote: q,
    revenueGrowth: revenueGrowthMap.get(q.symbol) ?? null,
    firstPass: qualityFirstPass(q, revenueGrowthMap.get(q.symbol) ?? null),
  }));
  scored.sort((a, b) => b.firstPass - a.firstPass);

  // Prioritize tickers that don't have fundamentals yet, not just the top-N
  // by score — still worth doing even with a much larger shortlist than the
  // original 5, since the candidate pool itself can exceed this size. Once
  // the whole pool is covered it falls back to refreshing the highest-ranked
  // already-covered ones so data doesn't go stale forever.
  const existingCoverage = await prisma.stock.findMany({
    where: { ticker: { in: scored.map((s) => s.quote.symbol) } },
    select: { ticker: true, netIncome: true, totalDebt: true },
  });
  const coveredSet = new Set(
    existingCoverage.filter((s) => s.netIncome !== null || s.totalDebt !== null).map((s) => s.ticker)
  );
  const notCovered = scored.filter((s) => !coveredSet.has(s.quote.symbol));
  const shortlist = notCovered.length >= FUNDAMENTALS_SHORTLIST_SIZE
    ? notCovered.slice(0, FUNDAMENTALS_SHORTLIST_SIZE)
    : [...notCovered, ...scored.filter((s) => coveredSet.has(s.quote.symbol))].slice(0, FUNDAMENTALS_SHORTLIST_SIZE);
  const tFund0 = Date.now();
  const fundamentalsResults = await Promise.allSettled(
    shortlist.map((s) => getFundamentals(s.quote.symbol).then((f) => ({ ticker: s.quote.symbol, f })))
  );
  console.log(`[quality-pipeline] fundamentals pass: ${Date.now() - tFund0}ms for ${shortlist.length} tickers`);
  const fundamentalsMap = new Map<string, Awaited<ReturnType<typeof getFundamentals>>>();
  let fundamentalsOkCount = 0;
  for (const r of fundamentalsResults) {
    if (r.status === "fulfilled") {
      fundamentalsMap.set(r.value.ticker, r.value.f);
      if (r.value.f.netIncome !== null || r.value.f.totalDebt !== null) fundamentalsOkCount++;
    }
  }
  if (shortlist.length > 0 && fundamentalsOkCount / shortlist.length < 0.5) {
    await sendEmail({
      subject: "Stocks refresh: Quality lens fundamentals mostly unavailable",
      html: `<p>Only ${fundamentalsOkCount} of ${shortlist.length} Quality-lens candidates got real balance-sheet/income data this run — likely a rate limit or API issue.</p>`,
    });
  }
  console.log(`[quality-pipeline] total: ${Date.now() - t0}ms`);

  const finalScored = scored.map((s) => {
    const f = fundamentalsMap.get(s.quote.symbol);
    const score = f ? qualityFinalScore(s.firstPass, f) : s.firstPass;
    return { ...s, score, fundamentals: f ?? null };
  });
  finalScored.sort((a, b) => b.score - a.score);

  await Promise.all(
    finalScored.map((s, i) =>
      prisma.stock.upsert({
        where: { ticker: s.quote.symbol },
        create: {
          ticker: s.quote.symbol,
          name: s.quote.name,
          marketCap: s.quote.marketCap,
          price: s.quote.price,
          revenueGrowth: s.revenueGrowth ?? 0,
          trailingPE: s.quote.trailingPE,
          priceToBook: s.quote.priceToBook,
          qualityScore: s.score,
          qualityRank: i + 1,
          netIncome: s.fundamentals?.netIncome ?? null,
          totalDebt: s.fundamentals?.totalDebt ?? null,
          cashAndEquivalents: s.fundamentals?.cashAndEquivalents ?? null,
          freeCashFlow: s.fundamentals?.freeCashFlow ?? null,
        },
        update: {
          name: s.quote.name,
          marketCap: s.quote.marketCap,
          price: s.quote.price,
          revenueGrowth: s.revenueGrowth ?? undefined,
          trailingPE: s.quote.trailingPE,
          priceToBook: s.quote.priceToBook,
          qualityScore: s.score,
          qualityRank: i + 1,
          ...(s.fundamentals ? {
            netIncome: s.fundamentals.netIncome,
            totalDebt: s.fundamentals.totalDebt,
            cashAndEquivalents: s.fundamentals.cashAndEquivalents,
            freeCashFlow: s.fundamentals.freeCashFlow,
          } : {}),
        },
      })
    )
  );

  return { tickers: finalScored.map((s) => s.quote.symbol), candidateCount: quotes.length };
}
