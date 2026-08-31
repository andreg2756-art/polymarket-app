import { prisma } from "@/lib/prisma";
import { fetchScreenerQuotes, QUALITY_SCREENS } from "@/lib/stocks/yahooScreener";
import { getRevenueGrowthScore } from "@/lib/stocks/revenueGrowth";
import { qualityFirstPass, qualityFinalScore } from "@/lib/stocks/qualityScore";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { sendEmail } from "@/lib/notify";

// Polygon's plan caps at 5 requests/min, shared across every Polygon call
// that opts into waiting for quota (see massive.ts — only fetchPolygonFinancials
// does; news/candles/short-interest stay fail-fast so they can't queue behind
// this). This and Turnaround's shortlist combined (10) clear in ~2 batches
// of the 5/min window, ~65s worst case — safe inside the refresh route's
// 180s maxDuration alongside the ~26s measured screener+EDGAR overhead above.
const FUNDAMENTALS_SHORTLIST_SIZE = 5;

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
  // by score — the top-N by firstPass score barely changes day to day, so
  // always slicing the sorted list re-fetched the SAME 5 tickers every run
  // (each already-covered from a prior run, thanks to the 24h Polygon
  // cache) while the other 45+ in the Top 50 never got picked at all. This
  // rotates the daily budget toward genuinely new coverage; once the whole
  // pool is covered it falls back to refreshing the highest-ranked already-
  // covered ones so data doesn't go stale forever.
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
  console.log(`[quality-pipeline] Polygon fundamentals pass: ${Date.now() - tFund0}ms for ${shortlist.length} tickers`);
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
      html: `<p>Only ${fundamentalsOkCount} of ${shortlist.length} Quality-lens candidates got real balance-sheet/income data from Polygon this run — likely a rate limit or API issue.</p>`,
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
