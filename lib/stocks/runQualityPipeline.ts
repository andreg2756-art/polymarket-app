import { prisma } from "@/lib/prisma";
import { fetchScreenerQuotes, QUALITY_SCREENS } from "@/lib/stocks/yahooScreener";
import { qualityFirstPass, qualityFinalScore } from "@/lib/stocks/qualityScore";
import { loadStoredFundamentals, dataStatus } from "./financial-data/store";
import { nonMissing } from "./financial-data/model";

export interface QualityPipelineResult {
  tickers: string[]; // every ticker touched this run, for the shared cleanup step
  candidateCount: number;
}

export async function runQualityPipeline(): Promise<QualityPipelineResult> {
  const t0 = Date.now();
  const quotes = await fetchScreenerQuotes(QUALITY_SCREENS);
  if (quotes.length === 0) return { tickers: [], candidateCount: 0 };
  console.log(`[quality-pipeline] screener fetch: ${Date.now() - t0}ms, ${quotes.length} candidates`);

  const fundamentalsMap = await loadStoredFundamentals(quotes.map(q => q.symbol));
  const revenueGrowthMap = new Map<string,number>();
  for (const [ticker,f] of fundamentalsMap) if(f.revenueGrowthYoY != null) revenueGrowthMap.set(ticker,f.revenueGrowthYoY);

  const scored = quotes.map((q) => ({
    quote: q,
    revenueGrowth: revenueGrowthMap.get(q.symbol) ?? null,
    firstPass: qualityFirstPass(q, revenueGrowthMap.get(q.symbol) ?? null),
  }));
  scored.sort((a, b) => b.firstPass - a.firstPass);


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
          marketCap: s.quote.marketCap > 0 ? s.quote.marketCap : undefined,
          price: s.quote.price > 0 ? s.quote.price : undefined,
          revenueGrowth: s.revenueGrowth ?? 0,
          ...nonMissing({ trailingPE: s.quote.trailingPE, priceToBook: s.quote.priceToBook }),
          qualityDataStatus: dataStatus(s.fundamentals ?? undefined, "quality"),
          qualityScore: s.score,
          qualityRank: i + 1,
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
          revenueGrowth: s.revenueGrowth ?? undefined,
          ...nonMissing({ trailingPE: s.quote.trailingPE, priceToBook: s.quote.priceToBook }),
          qualityDataStatus: dataStatus(s.fundamentals ?? undefined, "quality"),
          qualityScore: s.score,
          qualityRank: i + 1,
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
