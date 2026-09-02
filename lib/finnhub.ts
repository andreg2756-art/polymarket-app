// Finnhub API client. ALL requests are server-side only, key never exposed
// to the browser. Reads FINNHUB_API_KEY from process.env — never hardcoded.
//
// Added specifically to fill gaps FMP's plan can't: FMP's /earnings and
// /income-statement are confirmed 402-restricted to mega-caps (see
// lib/stocks/earningsPerformance.ts's header comment), and analystRating/
// analystCount on the Stock model have never been populated by any
// pipeline — refresh/route.ts hardcodes "N/A"/0 for every row. Verified by
// direct testing against VIOT (the same small-cap FMP rejects) that
// Finnhub's free tier covers both earnings surprises and analyst
// recommendation trends for small/mid-caps, not just mega-caps.

const BASE = "https://finnhub.io/api/v1";

function getKey(): string | null {
  return process.env.FINNHUB_API_KEY ?? null;
}

// Confirmed by direct testing: free tier allows 60 requests/min (returned
// in x-ratelimit-limit).
//
// This WAITS for quota rather than failing fast — unlike Polygon
// (massive.ts), which fails fast specifically because its 5/min budget is
// shared across an unbounded set of callers with varying, sometimes-large
// batch sizes (up to 80 tickers), where blocking one caller could starve
// or time out everything behind it. Every current Finnhub caller is one
// bounded batch — earnings + analyst ratings for the same <=50-ticker
// shortlist, ~100 calls total per refresh run — so waiting is safe and
// actually necessary: a first version that failed fast here let the
// earnings calls (issued first in the same Promise.all) consume most of
// the 60/min budget before the analyst-rating calls ever ran, silently
// dropping ~40 of 50 analyst lookups. At ~60/min steady state, 100 calls
// take under two minutes, comfortably inside the refresh route's 180s
// maxDuration. If a second, differently-sized caller is ever added, revisit
// this — it inherits Polygon's same risk at that point.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
let recentRequestTimestamps: number[] = [];

async function waitForQuota(): Promise<void> {
  for (;;) {
    const now = Date.now();
    recentRequestTimestamps = recentRequestTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (recentRequestTimestamps.length < RATE_LIMIT) {
      recentRequestTimestamps.push(now);
      return;
    }
    const waitMs = RATE_WINDOW_MS - (now - recentRequestTimestamps[0]) + 100;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

async function finnhubGet<T>(path: string): Promise<T | null> {
  const key = getKey();
  if (!key) return null;
  await waitForQuota();
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE}${path}${sep}token=${key}`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface EarningsSurprise {
  symbol: string;
  period: string; // fiscal period end date, e.g. "2026-06-30"
  estimate: number | null;
  actual: number | null;
  surprisePercent: number | null;
}

// Most recent quarters first, per Finnhub's own ordering.
export async function getEarningsSurprises(ticker: string): Promise<EarningsSurprise[] | null> {
  const data = await finnhubGet<EarningsSurprise[]>(`/stock/earnings?symbol=${ticker}`);
  return Array.isArray(data) ? data : null;
}

export interface RecommendationTrend {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export async function getRecommendationTrends(ticker: string): Promise<RecommendationTrend[] | null> {
  const data = await finnhubGet<RecommendationTrend[]>(`/stock/recommendation?symbol=${ticker}`);
  return Array.isArray(data) ? data : null;
}

// Collapses a recommendation-trend row into the single rating string this
// app already displays elsewhere (Speculative list, bull case "Analyst
// consensus: X" line) — majority vote across the 5 buckets, ties broken
// toward the more bullish side same as a typical consensus label.
export function summarizeRecommendation(trend: RecommendationTrend): { rating: string; count: number } {
  const buyish = trend.strongBuy + trend.buy;
  const sellish = trend.sell + trend.strongSell;
  const count = buyish + trend.hold + sellish;
  if (count === 0) return { rating: "N/A", count: 0 };

  let rating: string;
  if (buyish > trend.hold && buyish > sellish) rating = trend.strongBuy > trend.buy ? "Strong Buy" : "Buy";
  else if (sellish > trend.hold && sellish > buyish) rating = trend.strongSell > trend.sell ? "Strong Sell" : "Sell";
  else rating = "Hold";

  return { rating, count };
}
