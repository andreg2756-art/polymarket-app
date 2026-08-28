import { prisma } from "@/lib/prisma";
import { fetchScreenerQuotes, TURNAROUND_SCREENS } from "@/lib/stocks/yahooScreener";
import { turnaroundFirstPass, turnaroundFinalScore } from "@/lib/stocks/turnaroundScore";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { sendEmail } from "@/lib/notify";

const FUNDAMENTALS_SHORTLIST_SIZE = 15;

export interface TurnaroundPipelineResult {
  tickers: string[];
  candidateCount: number;
}

export async function runTurnaroundPipeline(): Promise<TurnaroundPipelineResult> {
  const quotes = await fetchScreenerQuotes(TURNAROUND_SCREENS);
  if (quotes.length === 0) return { tickers: [], candidateCount: 0 };

  const scored = quotes.map((q) => ({ quote: q, firstPass: turnaroundFirstPass(q) }));
  scored.sort((a, b) => b.firstPass - a.firstPass);

  const shortlist = scored.slice(0, FUNDAMENTALS_SHORTLIST_SIZE);
  const fundamentalsResults = await Promise.allSettled(
    shortlist.map((s) => getFundamentals(s.quote.symbol).then((f) => ({ ticker: s.quote.symbol, f })))
  );
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
      html: `<p>Only ${fundamentalsOkCount} of ${shortlist.length} Turnaround-lens candidates got real balance-sheet/cash-flow data from FMP this run — likely a rate limit or API issue.</p>`,
    });
  }

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
