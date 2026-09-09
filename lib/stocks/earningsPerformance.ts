// Earnings surprise periods and filing dates are stored separately. Neither
// is an earnings announcement date; unavailable announcements remain null.
import { getEarningsSurprises } from "@/lib/finnhub";
import { getLastEarningsDateFromSEC } from "./secFilingDates";

export interface EarningsPerformance {
  earningsBeat: boolean;
  revenueBeat: boolean;
  epsGrowth: number;
  lastEarningsDate: string | null;
  earningsPeriodEnd: string | null;
  lastFilingDate: string | null;
  ok: boolean; // false if Finnhub had nothing and the SEC date fallback also came up empty
}

const EMPTY: EarningsPerformance = {
  earningsBeat: false,
  revenueBeat: false,
  epsGrowth: 0,
  lastEarningsDate: null,
  earningsPeriodEnd: null,
  lastFilingDate: null,
  ok: false,
};

export async function getEarningsPerformance(ticker: string): Promise<EarningsPerformance> {
  try {
    const surprises = await getEarningsSurprises(ticker);

    // Most recent *reported* quarter — skip entries with a null actual
    // (scheduled-but-not-yet-reported).
    const reported = (surprises ?? []).filter((s) => typeof s.actual === "number" && Number.isFinite(s.actual)).sort((a,b)=>b.period.localeCompare(a.period));
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
      lastEarningsDate: null, // Neither period-end nor filing date is an announcement date.
      earningsPeriodEnd: last?.period ?? null,
      lastFilingDate: dateFromSEC ? lastEarningsDate : null,
      ok: reported.length > 0 || dateFromSEC,
    };
  } catch {
    return EMPTY;
  }
}
