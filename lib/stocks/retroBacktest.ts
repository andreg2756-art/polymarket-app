// Retroactive backtest of the raw momentum formula using up to 1 year of
// real Yahoo Finance daily price/volume history — reconstructs what the
// screener's momentum score would have picked at many points over the past
// year, then measures what actually happened afterward. Built to validate
// whether the momentum formula has real predictive power, independent of
// the data-integrity bugs found and fixed elsewhere in the app.
//
// KNOWN LIMITATION — survivorship bias: this tests against the CURRENT
// small-cap universe list, which has already had failed/delisted names
// removed. Any ticker that would have scored well a year ago but has since
// been delisted or dropped from the universe is invisible to this test,
// which biases the results to look somewhat better than a live, point-in-
// time strategy actually would have performed.

import { getYahooHistory, type YahooHistoryPoint } from "@/lib/yahoo-finance";
import { SMALL_CAP_UNIVERSE } from "@/lib/small-cap-universe";

const REBALANCE_DAYS = 14; // more frequent than the live backtest — we have a full year of real history to sample, not just accumulated daily snapshots
const MOM_WINDOW_1M = 21; // trading days
const MOM_WINDOW_3M = 63;
const VOL_WINDOW = 20;
const TOP_N = 10;
const MATCH_TOLERANCE_DAYS = 5;

const PERIODS = [
  { period: "1M Fwd", days: 30 },
  { period: "3M Fwd", days: 90 },
  { period: "6M Fwd", days: 180 },
  { period: "12M Fwd", days: 365 },
] as const;

export interface RetroPeriodResult {
  period: string;
  pickCount: number;
  rebalanceDates: number;
  avgReturn: number;
  winRate: number;
  spyReturn: number;
  alpha: number;
}

export interface RetroBacktestResult {
  available: boolean;
  message: string;
  universeSize: number;
  tickersWithHistory: number;
  data?: RetroPeriodResult[];
}

// Same formula as app/api/stocks/refresh/route.ts's computeScore — kept as
// a separate copy here deliberately (this module reconstructs history, the
// live route scores the present; duplicating avoids coupling a historical
// research tool to production route internals).
function computeMomentumScore(change1M: number, change3M: number, relativeVolume: number): number {
  const mom1M = change1M > 30 ? 30 : change1M > 20 ? 24 : change1M > 10 ? 18 : change1M > 5 ? 12 : change1M > 0 ? 6 : change1M > -5 ? 2 : 0;
  const mom3M = change3M > 50 ? 35 : change3M > 30 ? 28 : change3M > 15 ? 20 : change3M > 5 ? 13 : change3M > 0 ? 7 : change3M > -10 ? 2 : 0;
  const volScore = relativeVolume > 3 ? 20 : relativeVolume > 2 ? 15 : relativeVolume > 1.5 ? 10 : relativeVolume > 1.2 ? 6 : relativeVolume > 1 ? 3 : 0;
  const trendBonus = change1M > 0 && change3M > 0 ? 15 : change1M > 0 ? 5 : 0;
  return Math.min(100, Math.round(mom1M + mom3M + volScore + trendBonus));
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/** Index of the closest point at or before targetDate (for computing "as of" metrics). */
function indexAtOrBefore(points: YahooHistoryPoint[], targetDate: string): number {
  let idx = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].date <= targetDate) idx = i;
    else break;
  }
  return idx;
}

/** Closest price at or after targetDate, within toleranceDays (for measuring forward returns). */
function priceNear(points: YahooHistoryPoint[], targetDate: string, toleranceDays: number): number | null {
  for (const p of points) {
    if (p.date >= targetDate) {
      return daysBetween(p.date, targetDate) <= toleranceDays ? p.close : null;
    }
  }
  return null;
}

function metricsAt(points: YahooHistoryPoint[], i: number): { change1M: number; change3M: number; relativeVolume: number; price: number } | null {
  if (i < MOM_WINDOW_3M) return null; // need full 3M lookback for a fair comparison to the live formula
  const price = points[i].close;
  if (!(price > 0)) return null;

  const close1M = points[i - MOM_WINDOW_1M]?.close;
  const close3M = points[i - MOM_WINDOW_3M]?.close;
  const change1M = close1M > 0 ? ((price - close1M) / close1M) * 100 : 0;
  const change3M = close3M > 0 ? ((price - close3M) / close3M) * 100 : 0;

  const windowStart = Math.max(0, i - VOL_WINDOW);
  const windowSlice = points.slice(windowStart, i);
  const avgVol = windowSlice.length > 0 ? windowSlice.reduce((s, p) => s + p.volume, 0) / windowSlice.length : 0;
  const relativeVolume = avgVol > 0 ? points[i].volume / avgVol : 1;

  return { change1M, change3M, relativeVolume, price };
}

export async function runRetroBacktest(): Promise<RetroBacktestResult> {
  const [historyResults, spyHistory] = await Promise.all([
    Promise.allSettled(SMALL_CAP_UNIVERSE.map((t) => getYahooHistory(t).then((h) => ({ ticker: t, h })))),
    getYahooHistory("SPY"),
  ]);

  const histories = new Map<string, YahooHistoryPoint[]>();
  for (const r of historyResults) {
    if (r.status === "fulfilled" && r.value.h && r.value.h.length > MOM_WINDOW_3M) {
      histories.set(r.value.ticker, r.value.h);
    }
  }

  if (histories.size === 0 || !spyHistory) {
    return {
      available: false,
      message: "Could not fetch enough historical price data from Yahoo Finance to run this.",
      universeSize: SMALL_CAP_UNIVERSE.length,
      tickersWithHistory: histories.size,
    };
  }

  // SPY's trading calendar as the reference set of rebalance dates.
  const rebalanceDates: string[] = [];
  for (let i = MOM_WINDOW_3M; i < spyHistory.length; i += REBALANCE_DAYS) {
    rebalanceDates.push(spyHistory[i].date);
  }

  const results: RetroPeriodResult[] = [];

  for (const { period, days } of PERIODS) {
    const pickReturns: number[] = [];
    const dayReturns: number[] = [];
    const spyDayReturns: number[] = [];
    let usedDates = 0;

    for (const day of rebalanceDates) {
      const targetDate = addDays(day, days);
      if (targetDate > spyHistory[spyHistory.length - 1].date) continue; // beyond available history

      // Rank the universe by the momentum formula, using only data available as of `day`.
      const ranking: { ticker: string; score: number; price: number }[] = [];
      for (const [ticker, points] of histories) {
        const idx = indexAtOrBefore(points, day);
        if (idx < 0) continue;
        const m = metricsAt(points, idx);
        if (!m) continue;
        ranking.push({ ticker, score: computeMomentumScore(m.change1M, m.change3M, m.relativeVolume), price: m.price });
      }
      ranking.sort((a, b) => b.score - a.score);
      const picks = ranking.slice(0, TOP_N);
      if (picks.length === 0) continue;

      const thisDayReturns: number[] = [];
      for (const pick of picks) {
        const points = histories.get(pick.ticker)!;
        const fwdPrice = priceNear(points, targetDate, MATCH_TOLERANCE_DAYS);
        if (fwdPrice === null || pick.price <= 0) continue;
        const ret = ((fwdPrice - pick.price) / pick.price) * 100;
        pickReturns.push(ret);
        thisDayReturns.push(ret);
      }
      if (thisDayReturns.length === 0) continue;
      dayReturns.push(thisDayReturns.reduce((a, b) => a + b, 0) / thisDayReturns.length);
      usedDates++;

      const spyStart = priceNear(spyHistory, day, MATCH_TOLERANCE_DAYS);
      const spyEnd = priceNear(spyHistory, targetDate, MATCH_TOLERANCE_DAYS);
      if (spyStart !== null && spyEnd !== null && spyStart > 0) {
        spyDayReturns.push(((spyEnd - spyStart) / spyStart) * 100);
      }
    }

    if (dayReturns.length === 0) continue;

    const avgReturn = Math.round((pickReturns.reduce((a, b) => a + b, 0) / pickReturns.length) * 10) / 10;
    const winRate = Math.round((pickReturns.filter((r) => r > 0).length / pickReturns.length) * 100);
    const spyReturn = spyDayReturns.length > 0
      ? Math.round((spyDayReturns.reduce((a, b) => a + b, 0) / spyDayReturns.length) * 10) / 10
      : 0;

    results.push({
      period,
      pickCount: pickReturns.length,
      rebalanceDates: usedDates,
      avgReturn,
      winRate,
      spyReturn,
      alpha: Math.round((avgReturn - spyReturn) * 10) / 10,
    });
  }

  return {
    available: results.length > 0,
    message: results.length === 0 ? "Not enough historical data to compute any period." : "",
    universeSize: SMALL_CAP_UNIVERSE.length,
    tickersWithHistory: histories.size,
    data: results,
  };
}
