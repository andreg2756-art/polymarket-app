// Real earnings-beat/revenue-beat/EPS-growth data from FMP, replacing the
// hardcoded-false values the refresh route used to write for every stock.
// Scoped to just the two FMP endpoints confirmed to work on the current
// plan (/earnings, /income-statement with limit<=5) — insider trading,
// analyst ratings, and news are separately plan-restricted and unrelated
// to this specific fix.

import { getEarnings, getIncomeStatements } from "@/lib/fmp";

export interface EarningsPerformance {
  earningsBeat: boolean;
  revenueBeat: boolean;
  epsGrowth: number;
  lastEarningsDate: string | null;
  ok: boolean; // false if both FMP calls failed/were empty — distinguishes a real "no data" from a rate-limit/API failure
}

const EMPTY: EarningsPerformance = {
  earningsBeat: false,
  revenueBeat: false,
  epsGrowth: 0,
  lastEarningsDate: null,
  ok: false,
};

export async function getEarningsPerformance(ticker: string): Promise<EarningsPerformance> {
  try {
    const [earningsSettled, incomeSettled] = await Promise.allSettled([
      getEarnings(ticker),
      getIncomeStatements(ticker),
    ]);
    const earnings = earningsSettled.status === "fulfilled" ? earningsSettled.value : [];
    const income = incomeSettled.status === "fulfilled" ? incomeSettled.value : [];
    const ok = earningsSettled.status === "fulfilled" || incomeSettled.status === "fulfilled";

    // Most recent *reported* result — skip future/scheduled entries where
    // actuals aren't in yet.
    const lastReported = earnings.find((e) => e.epsActual !== null && e.epsActual !== undefined);

    const earningsBeat = lastReported?.epsActual !== null && lastReported?.epsActual !== undefined
      && lastReported.epsEstimated !== null && lastReported.epsEstimated !== undefined
      ? lastReported.epsActual > lastReported.epsEstimated
      : false;

    const revenueBeat = lastReported?.revenueActual !== null && lastReported?.revenueActual !== undefined
      && lastReported.revenueEstimated !== null && lastReported.revenueEstimated !== undefined
      ? lastReported.revenueActual > lastReported.revenueEstimated
      : false;

    const epsGrowth = income.length >= 2 && income[1].eps !== 0
      ? Math.round((((income[0].eps - income[1].eps) / Math.abs(income[1].eps)) * 100) * 10) / 10
      : 0;

    return {
      earningsBeat,
      revenueBeat,
      epsGrowth,
      lastEarningsDate: lastReported?.date ?? null,
      ok,
    };
  } catch {
    return EMPTY;
  }
}
