// Earnings-beat/EPS-growth data, sourced from Finnhub rather than FMP.
// FMP's /earnings (and /income-statement) endpoints turned out to have the
// same mega-cap-only plan restriction found elsewhere (confirmed: 402 for
// VIOT, a small cap). Finnhub's free-tier /stock/earnings (surprise
// history) was verified by direct testing to cover the same small/mid-caps
// FMP rejects, including VIOT specifically, so it's now the primary source
// for earningsBeat and lastEarningsDate.
//
// revenueBeat isn't available here: Finnhub's free tier's surprise
// endpoint is EPS-only, not revenue — FMP genuinely doesn't offer a
// working substitute (same restriction), so this stays false rather than
// guessed. lastEarningsDate still falls back to SEC's free 10-Q/10-K
// filing-cadence lookup on the rare case Finnhub has no data for a ticker,
// since a filing date is a same-day-or-next-day proxy for the earnings
// date.

import { getEarningsSurprises } from "@/lib/finnhub";
import { getLastEarningsDateFromSEC } from "./secFilingDates";

export interface EarningsPerformance {
  earningsBeat: boolean;
  revenueBeat: boolean;
  epsGrowth: number;
  lastEarningsDate: string | null;
  ok: boolean; // false if Finnhub had nothing and the SEC date fallback also came up empty
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
    const surprises = await getEarningsSurprises(ticker);

    // Most recent *reported* quarter — skip entries with a null actual
    // (scheduled-but-not-yet-reported).
    const reported = (surprises ?? []).filter((s) => s.actual !== null);
    const last = reported[0] ?? null;
    const prev = reported[1] ?? null;

    const earningsBeat = last?.actual !== null && last?.estimate !== null && last !== null
      ? (last.actual as number) > (last.estimate as number)
      : false;

    const epsGrowth = last?.actual !== null && prev?.actual !== null && prev !== null && prev.actual !== 0
      ? Math.round((((last!.actual as number) - (prev.actual as number)) / Math.abs(prev.actual as number)) * 100 * 10) / 10
      : 0;

    let lastEarningsDate: string | null = last?.period ?? null;
    let dateFromSEC = false;
    if (!lastEarningsDate) {
      lastEarningsDate = await getLastEarningsDateFromSEC(ticker);
      dateFromSEC = lastEarningsDate !== null;
    }

    return {
      earningsBeat,
      revenueBeat: false,
      epsGrowth,
      lastEarningsDate,
      ok: reported.length > 0 || dateFromSEC,
    };
  } catch {
    return EMPTY;
  }
}
