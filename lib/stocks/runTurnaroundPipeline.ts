import { prisma } from "@/lib/prisma";
import { fetchScreenerQuotes, TURNAROUND_SCREENS } from "@/lib/stocks/yahooScreener";
import { turnaroundFirstPass, turnaroundFinalScore } from "@/lib/stocks/turnaroundScore";
import { loadStoredFundamentals, dataStatus } from "./financial-data/store";
import { nonMissing } from "./financial-data/model";

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

  const fundamentalsMap = await loadStoredFundamentals(scored.map(s => s.quote.symbol));

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
          marketCap: s.quote.marketCap > 0 ? s.quote.marketCap : undefined,
          price: s.quote.price > 0 ? s.quote.price : undefined,
          ...nonMissing({ trailingPE: s.quote.trailingPE, priceToBook: s.quote.priceToBook }),
          valueDataStatus: dataStatus(s.fundamentals ?? undefined, "value"),
          turnaroundScore: s.score,
          turnaroundRank: i + 1,
          financialPeriodType: s.fundamentals?.periodType,
          financialPeriodEnd: s.fundamentals?.periodEnd,
          financialCurrency: s.fundamentals?.currency,
          financialSource: s.fundamentals?.source,
          financialFetchedAt: s.fundamentals?.fetchedAt ? new Date(s.fundamentals.fetchedAt) : undefined,
          netIncome: s.fundamentals?.netIncome ?? null,
          totalDebt: s.fundamentals?.totalDebt ?? null,
          cashAndEquivalents: s.fundamentals?.cashAndEquivalents ?? null,
          freeCashFlow: s.fundamentals?.freeCashFlow ?? null,
        },
        update: {
          name: s.quote.name,
          marketCap: s.quote.marketCap > 0 ? s.quote.marketCap : undefined,
          price: s.quote.price > 0 ? s.quote.price : undefined,
          ...nonMissing({ trailingPE: s.quote.trailingPE, priceToBook: s.quote.priceToBook }),
          valueDataStatus: dataStatus(s.fundamentals ?? undefined, "value"),
          turnaroundScore: s.score,
          turnaroundRank: i + 1,
          ...(s.fundamentals ? nonMissing({
            financialPeriodType: s.fundamentals.periodType,
            financialPeriodEnd: s.fundamentals.periodEnd,
            financialCurrency: s.fundamentals.currency,
            financialSource: s.fundamentals.source,
            financialFetchedAt: s.fundamentals.fetchedAt ? new Date(s.fundamentals.fetchedAt) : undefined,
            netIncome: s.fundamentals.netIncome,
            totalDebt: s.fundamentals.totalDebt,
            cashAndEquivalents: s.fundamentals.cashAndEquivalents,
            freeCashFlow: s.fundamentals.freeCashFlow,
          }) : {}),
        },
      })
    )
  );

  return { tickers: finalScored.map((s) => s.quote.symbol), candidateCount: quotes.length };
}
