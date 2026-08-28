// Quality/Growth score — computable subset of the user's Template 1
// (profitable, growing business with durable economics). Two passes:
// a cheap first pass over the full candidate pool using only free data
// (Yahoo screener fields + SEC EDGAR revenue growth), then a fundamentals
// pass (FMP balance sheet/income) bounded to the top candidates from
// pass one, to keep FMP call volume predictable.

import type { ScreenerQuote } from "@/lib/stocks/yahooScreener";
import type { Fundamentals } from "@/lib/stocks/fundamentals";

export function qualityFirstPass(quote: ScreenerQuote, revenueGrowthPct: number | null): number {
  const profitability = quote.epsTrailingTwelveMonths !== null && quote.epsTrailingTwelveMonths > 0 ? 15 : 0;

  const g = revenueGrowthPct ?? -Infinity;
  const growth = g > 30 ? 20 : g > 15 ? 15 : g > 5 ? 10 : g > 0 ? 5 : 0;

  const pe = quote.trailingPE;
  const valuation = pe === null || pe <= 0 ? 0 : pe <= 15 ? 20 : pe <= 25 ? 15 : pe <= 40 ? 8 : 0;

  return profitability + growth + valuation;
}

export function qualityFinalScore(firstPass: number, f: Fundamentals): number {
  let margin = 0;
  if (f.operatingIncome !== null && f.revenue !== null && f.revenue > 0) {
    const marginPct = (f.operatingIncome / f.revenue) * 100;
    margin = marginPct > 20 ? 20 : marginPct > 10 ? 14 : marginPct > 0 ? 7 : 0;
  }

  let debtHealth = 0;
  if (f.totalDebt !== null && f.cashAndEquivalents !== null) {
    if (f.totalDebt <= f.cashAndEquivalents) debtHealth = 15;
    else if (f.totalDebt <= f.cashAndEquivalents * 2) debtHealth = 10;
    else if (f.totalDebt <= f.cashAndEquivalents * 4) debtHealth = 5;
  }

  const fcfPositive = f.freeCashFlow !== null && f.freeCashFlow > 0 ? 10 : 0;

  return Math.round(firstPass + margin + debtHealth + fcfPositive);
}
