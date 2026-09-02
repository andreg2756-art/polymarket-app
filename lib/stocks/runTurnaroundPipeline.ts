import { prisma } from "@/lib/prisma";
import { fetchScreenerQuotes, TURNAROUND_SCREENS } from "@/lib/stocks/yahooScreener";
import { turnaroundFirstPass, turnaroundFinalScore } from "@/lib/stocks/turnaroundScore";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { sendEmail } from "@/lib/notify";

// Kept in sync with Quality's shortlist size — see that file's comment
// (Business Quant's real limit is 40 req/day total, shared across both
// lenses, confirmed via its 429 error body — not the "no limit observed"
// assumption an earlier version of this constant was sized on).
const FUNDAMENTALS_SHORTLIST_SIZE = 6;

export interface TurnaroundPipelineResult {
  tickers: string[];
  candidateCount: number;
}

export async function runTurnaroundPipeline(): Promise<TurnaroundPipelineResult> {
  const t0 = Date.now();
  const quotes = await fetchScreenerQuotes(TURNAROUND_SCREENS);
  if (quotes.length === 0) return { tickers: [], candidateCount: 0 };
  console.log(`[turnaround-pipeline] screener fetch: ${Date.now() - t0}ms, ${quotes.length} candidates`);

  const scored = quotes.map((q) => ({ quote: q, firstPass: turnaroundFirstPass(q) }));
  scored.sort((a, b) => b.firstPass - a.firstPass);

  // Rotate toward uncovered tickers instead of always re-fetching the same
  // top-N — see runQualityPipeline.ts's comment for why.
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
  console.log(`[turnaround-pipeline] fundamentals pass: ${Date.now() - tFund0}ms for ${shortlist.length} tickers`);
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
      subject: "Stocks refresh: Turnaround lens fundamentals mostly unavailable",
      html: `<p>Only ${fundamentalsOkCount} of ${shortlist.length} Turnaround-lens candidates got real balance-sheet/cash-flow data this run — likely a rate limit or API issue.</p>`,
    });
  }
  console.log(`[turnaround-pipeline] total: ${Date.now() - t0}ms`);

  const finalScored = scored.map((s) => {
    const f = fundamentalsMap.get(s.quote.symbol);
    const score = f ? turnaroundFinalScore(s.firstPass, f) : s.firstPass;
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
          trailingPE: s.quote.trailingPE,
          priceToBook: s.quote.priceToBook,
          turnaroundScore: s.score,
          turnaroundRank: i + 1,
          netIncome: s.fundamentals?.netIncome ?? null,
          totalDebt: s.fundamentals?.totalDebt ?? null,
          cashAndEquivalents: s.fundamentals?.cashAndEquivalents ?? null,
          freeCashFlow: s.fundamentals?.freeCashFlow ?? null,
        },
        update: {
          name: s.quote.name,
          marketCap: s.quote.marketCap,
          price: s.quote.price,
          trailingPE: s.quote.trailingPE,
          priceToBook: s.quote.priceToBook,
          turnaroundScore: s.score,
          turnaroundRank: i + 1,
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
