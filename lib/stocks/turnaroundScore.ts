// Value/Turnaround score — computable subset of the user's Template 2
// ("how bad are the expectations embedded in the price, and what happens
// if the business improves?"). Same two-pass structure as qualityScore.ts.

import type { ScreenerQuote } from "@/lib/stocks/yahooScreener";
import type { Fundamentals } from "@/lib/stocks/fundamentals";

export function turnaroundFirstPass(quote: ScreenerQuote): number {
  const pb = quote.priceToBook;
  const cheapness = pb === null ? 3 : pb < 1 ? 25 : pb < 2 ? 18 : pb < 3 ? 10 : 3;

  let offHigh = 5;
  if (quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekHigh > 0) {
    const pctOff = ((quote.fiftyTwoWeekHigh - quote.price) / quote.fiftyTwoWeekHigh) * 100;
    // Sweet spot: meaningfully beaten down (real pessimism priced in) without
    // being so extreme it signals possible going-concern risk.
    offHigh = pctOff > 70 ? 8 : pctOff > 30 ? 20 : pctOff > 15 ? 14 : 5;
  }

  return cheapness + offHigh;
}

function trendPoints(prev: number | null, current: number | null): number {
  if (prev === null || current === null) return 0;
  return current > prev ? 10 : 0;
}

export function turnaroundFinalScore(firstPass: number, f: Fundamentals): number {
  let survival = 0;
  if (f.freeCashFlow !== null && f.freeCashFlow >= 0) {
    survival = 25; // self-sustaining, no runway concern
  } else if (f.freeCashFlow !== null && f.cashAndEquivalents !== null && f.freeCashFlow < 0) {
    const runwayYears = f.cashAndEquivalents / Math.abs(f.freeCashFlow);
    survival = runwayYears > 3 ? 20 : runwayYears > 1.5 ? 12 : runwayYears > 0.5 ? 5 : 0;
  }

  const evidence =
    trendPoints(f.prevRevenue, f.revenue) +
    trendPoints(f.prevOperatingIncome, f.operatingIncome) +
    trendPoints(f.prevFreeCashFlow, f.freeCashFlow);

  return Math.round(firstPass + survival + evidence);
}
