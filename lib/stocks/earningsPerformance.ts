// Real earnings-beat/revenue-beat/EPS-growth data from FMP. As of a later
// audit, FMP's /earnings (and /income-statement) endpoints turned out to
// have the same mega-cap-only plan restriction found elsewhere (confirmed:
// 402 for VIOT, a small cap) — earningsBeat/revenueBeat genuinely can't be
// computed without a consensus-estimates provider, which Polygon doesn't
// sell either, so those stay best-effort via FMP. lastEarningsDate doesn't
// need an estimate though — it's backfilled from SEC's free 10-Q/10-K
// filing-cadence lookup (getLastEarningsDateFromSEC) when FMP comes back
// empty, since a filing date is a same-day-or-next-day proxy for the
// earnings date.

import { getEarnings, getIncomeStatements } from "@/lib/fmp";
import { getLastEarningsDateFromSEC } from "./secFilingDates";

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

    let lastEarningsDate = lastReported?.date ?? null;
    let dateFromSEC = false;
    if (!lastEarningsDate) {
      lastEarningsDate = await getLastEarningsDateFromSEC(ticker);
      dateFromSEC = lastEarningsDate !== null;
    }

    return {
      earningsBeat,
      revenueBeat,
      epsGrowth,
      lastEarningsDate,
      ok: ok || dateFromSEC,
    };
  } catch {
    return EMPTY;
  }
}
