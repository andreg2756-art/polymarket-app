import { prisma } from "@/lib/prisma";
import { getYahooHistory, type YahooHistoryPoint } from "@/lib/yahoo-finance";

const PERIODS = [
  { period: "1M Fwd", days: 30 },
  { period: "3M Fwd", days: 90 },
  { period: "6M Fwd", days: 180 },
  { period: "12M Fwd", days: 365 },
] as const;

const REBALANCE_DAYS = 30; // "monthly rebalance", per the UI's stated strategy description
const MATCH_TOLERANCE_DAYS = 5; // how close a snapshot must be to the target forward date to count
const MIN_PICK_DAYS = 2; // require at least this many distinct rebalance dates before showing a result

interface BacktestPeriodResult {
  period: string;
  strategyReturn: number;
  spyReturn: number;
  winRate: number;
  avgReturn: number;
}

interface BacktestResult {
  available: boolean;
  message: string;
  data?: BacktestPeriodResult[];
  unavailablePeriods?: { period: string; message: string }[];
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

/** Closest price at or after `targetDate`, within `toleranceDays`. Points must be sorted ascending by date. */
function priceNear(points: { date: string; price: number }[], targetDate: string, toleranceDays: number): number | null {
  let best: { date: string; price: number } | null = null;
  for (const p of points) {
    if (p.date < targetDate) continue;
    if (!best || p.date < best.date) best = p;
  }
  if (!best) return null;
  return daysBetween(best.date, targetDate) <= toleranceDays ? best.price : null;
}

export async function runBacktest(): Promise<BacktestResult> {
  const snapshots = await prisma.stockSnapshot.findMany({
    orderBy: [{ ticker: "asc" }, { createdAt: "asc" }],
  });

  if (snapshots.length === 0) {
    return { available: false, message: "No snapshot history yet — data accumulates once daily refresh has run for a while." };
  }

  // One price per ticker per day (last snapshot of the day wins), plus one bullishScore-ranking per day across all tickers.
  const byTickerDay = new Map<string, Map<string, { price: number; bullishScore: number }>>();
  const allDays = new Set<string>();
  for (const s of snapshots) {
    const day = dateKey(s.createdAt);
    allDays.add(day);
    if (!byTickerDay.has(s.ticker)) byTickerDay.set(s.ticker, new Map());
    byTickerDay.get(s.ticker)!.set(day, { price: s.price, bullishScore: s.bullishScore });
  }
  const sortedDays = Array.from(allDays).sort();

  // Pick roughly-monthly rebalance dates from the days we actually have data for.
  const pickDays: string[] = [];
  for (const day of sortedDays) {
    if (pickDays.length === 0 || daysBetween(pickDays[pickDays.length - 1], day) >= REBALANCE_DAYS) {
      pickDays.push(day);
    }
  }

  const spyHistory = await getYahooHistory("SPY");
  const spyPoints = (spyHistory ?? []).map((p: YahooHistoryPoint) => ({ date: p.date, price: p.close }));

  const results: BacktestPeriodResult[] = [];
  const unavailable: { period: string; message: string }[] = [];

  for (const { period, days } of PERIODS) {
    const pickReturns: number[] = [];
    const dayReturns: number[] = [];

    for (const day of pickDays) {
      const targetDate = addDays(day, days);
      if (targetDate > dateKey(new Date())) continue; // period hasn't elapsed yet

      // Rank tickers by bullishScore as of this pick day, take top 10.
      const dayRanking: { ticker: string; price: number; bullishScore: number }[] = [];
      for (const [ticker, byDay] of byTickerDay) {
        const entry = byDay.get(day);
        if (entry) dayRanking.push({ ticker, ...entry });
      }
      dayRanking.sort((a, b) => b.bullishScore - a.bullishScore);
      const picks = dayRanking.slice(0, 10);
      if (picks.length === 0) continue;

      const thisDayReturns: number[] = [];
      for (const pick of picks) {
        const points = Array.from(byTickerDay.get(pick.ticker)!.entries()).map(([date, v]) => ({ date, price: v.price }));
        const fwdPrice = priceNear(points, targetDate, MATCH_TOLERANCE_DAYS);
        if (fwdPrice === null || pick.price <= 0) continue;
        const ret = ((fwdPrice - pick.price) / pick.price) * 100;
        pickReturns.push(ret);
        thisDayReturns.push(ret);
      }
      if (thisDayReturns.length > 0) {
        dayReturns.push(thisDayReturns.reduce((a, b) => a + b, 0) / thisDayReturns.length);
      }
    }

    if (dayReturns.length < MIN_PICK_DAYS) {
      unavailable.push({
        period,
        message: `Need more history for this period — only ${dayReturns.length} rebalance date(s) with a full ${days}-day forward window so far.`,
      });
      continue;
    }

    const avgReturn = Math.round((pickReturns.reduce((a, b) => a + b, 0) / pickReturns.length) * 10) / 10;
    const winRate = Math.round((pickReturns.filter((r) => r > 0).length / pickReturns.length) * 100);

    // SPY return over the same rebalance dates, for a like-for-like comparison.
    const spyDayReturns: number[] = [];
    for (const day of pickDays) {
      const targetDate = addDays(day, days);
      if (targetDate > dateKey(new Date())) continue;
      const startPrice = priceNear(spyPoints, day, MATCH_TOLERANCE_DAYS);
      const endPrice = priceNear(spyPoints, targetDate, MATCH_TOLERANCE_DAYS);
      if (startPrice === null || endPrice === null || startPrice <= 0) continue;
      spyDayReturns.push(((endPrice - startPrice) / startPrice) * 100);
    }
    const spyReturn = spyDayReturns.length > 0
      ? Math.round((spyDayReturns.reduce((a, b) => a + b, 0) / spyDayReturns.length) * 10) / 10
      : 0;

    results.push({ period, strategyReturn: avgReturn, spyReturn, winRate, avgReturn });
  }

  if (results.length === 0) {
    return {
      available: false,
      message: "Not enough snapshot history yet for any period — check back after a few weeks of daily refreshes.",
    };
  }

  return { available: true, message: "", data: results, unavailablePeriods: unavailable.length > 0 ? unavailable : undefined };
}
