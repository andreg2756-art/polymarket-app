// /lib/stocks/analystFactors.ts
// Analyst and volatility factors derived from Yahoo Finance chart data.
// quoteSummary is blocked — all metrics are calculated from price history.

import type { ScoredMetric } from "./types";

export interface AnalystFactors {
  analystScore:  ScoredMetric;
  targetUpside:  ScoredMetric;
  analystCount:  number | null;
  beta:          ScoredMetric; // used for volatility scoring
}

async function fetchWeeklyPrices(ticker: string): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&range=2y`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((c): c is number => c !== null && isFinite(c));
  } catch {
    return [];
  }
}

async function fetchSPYWeeklyPrices(): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1wk&range=2y`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((c): c is number => c !== null && isFinite(c));
  } catch {
    return [];
  }
}

function weeklyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  return a.slice(0, n).reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / n;
}

function calcBeta(stockReturns: number[], marketReturns: number[]): number | null {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 20) return null;
  const cov = covariance(stockReturns.slice(0, n), marketReturns.slice(0, n));
  const varM = variance(marketReturns.slice(0, n));
  if (varM === 0) return null;
  return cov / varM;
}

function annualizedVol(weeklyReturnsArr: number[]): number | null {
  if (weeklyReturnsArr.length < 10) return null;
  return Math.sqrt(variance(weeklyReturnsArr) * 52) * 100;
}

// Volatility score: lower vol = higher score
// < 30% vol → 90, 30-50% → 75, 50-80% → 55, 80-120% → 35, > 120% → 15
function volToScore(vol: number): number {
  if (vol < 30)  return 90;
  if (vol < 50)  return 75;
  if (vol < 80)  return 55;
  if (vol < 120) return 35;
  return 15;
}

// Beta to score: beta < 0.8 → 90, 0.8–1.2 → 70, 1.2–1.8 → 50, 1.8–2.5 → 30, > 2.5 → 15
function betaToScore(beta: number): number {
  if (beta < 0.8)  return 90;
  if (beta < 1.2)  return 70;
  if (beta < 1.8)  return 50;
  if (beta < 2.5)  return 30;
  return 15;
}

// Derive a synthetic "target upside" from 52-week range positioning.
// If price is near the 52w low, there is more room to the high.
// This is NOT analyst consensus — it's a range-based opportunity signal.
function rangeUpsideScore(current: number, high52: number, low52: number): { pct: number; score: number; label: string } | null {
  if (!current || !high52 || !low52 || high52 <= low52) return null;
  // How far is current from the 52w high, expressed as upside potential
  const upsidePct = ((high52 - current) / current) * 100;
  // Where in the range is current (0 = at low, 1 = at high)
  const rangePosition = (current - low52) / (high52 - low52);
  // Score: more upside to 52w high + lower in range = higher score
  const score = Math.round(Math.max(0, Math.min(100, (1 - rangePosition) * 60 + Math.min(upsidePct, 50))));
  const label = upsidePct > 30 ? "Large upside to 52w high" : upsidePct > 10 ? "Moderate upside to 52w high" : "Near 52w high";
  return { pct: upsidePct, score, label };
}

export async function getAnalystFactors(ticker: string): Promise<AnalystFactors> {
  // Fetch stock and SPY weekly prices in parallel
  const [stockPrices, spyPrices] = await Promise.all([
    fetchWeeklyPrices(ticker),
    fetchSPYWeeklyPrices(),
  ]);

  if (stockPrices.length < 10) {
    const unavail = (reason: string): ScoredMetric => ({
      value: null, score: null, source: "unavailable", reason,
    });
    return {
      analystScore: unavail("Insufficient price history"),
      targetUpside: unavail("Insufficient price history"),
      analystCount: null,
      beta: unavail("Insufficient price history"),
    };
  }

  const stockRet = weeklyReturns(stockPrices);
  const spyRet = weeklyReturns(spyPrices);

  // Beta calculation
  const betaVal = calcBeta(stockRet, spyRet);
  const vol = annualizedVol(stockRet);

  // Use beta if available, else fall back to annualized vol
  let betaScore: number | null = null;
  let betaLabel = "N/A";
  let betaReason = "Could not compute";

  if (betaVal !== null) {
    betaScore = betaToScore(betaVal);
    betaLabel = betaVal.toFixed(2);
    betaReason = betaVal < 1
      ? `β ${betaVal.toFixed(2)} — less volatile than market (${vol?.toFixed(0)}% annualized vol)`
      : betaVal < 1.8
      ? `β ${betaVal.toFixed(2)} — moderately volatile vs market (${vol?.toFixed(0)}% annualized vol)`
      : `β ${betaVal.toFixed(2)} — high volatility vs market (${vol?.toFixed(0)}% annualized vol)`;
  } else if (vol !== null) {
    betaScore = volToScore(vol);
    betaLabel = `~${vol.toFixed(0)}% vol`;
    betaReason = `Annualized volatility ${vol.toFixed(0)}% (beta vs SPY unavailable — insufficient overlap)`;
  }

  // 52-week range derived upside
  const currentPrice = stockPrices[stockPrices.length - 1];
  const last52 = stockPrices.slice(-52);
  const high52 = Math.max(...last52);
  const low52 = Math.min(...last52);
  const rangeUpside = rangeUpsideScore(currentPrice, high52, low52);

  // Analyst score: derived from momentum quality as proxy (no analyst API available for free)
  // We use a combination of vol, beta, and range position as a risk-adjusted quality signal
  const qualityScore = betaScore !== null
    ? Math.round(betaScore * 0.6 + (rangeUpside?.score ?? 50) * 0.4)
    : rangeUpside?.score ?? null;

  return {
    analystScore: {
      value: qualityScore !== null ? `Risk Quality: ${qualityScore}/100` : null,
      score: qualityScore,
      source: "calculated",
      reason: qualityScore !== null
        ? `Derived from β, volatility (${vol?.toFixed(0) ?? "N/A"}%), and 52w range position. Analyst consensus API unavailable on free tier.`
        : "Insufficient data to compute risk quality score",
    },

    targetUpside: rangeUpside ? {
      value: `+${rangeUpside.pct.toFixed(1)}% to 52w high ($${high52.toFixed(2)})`,
      score: rangeUpside.score,
      source: "calculated",
      reason: `${rangeUpside.label}. Current $${currentPrice.toFixed(2)}, 52w high $${high52.toFixed(2)}, 52w low $${low52.toFixed(2)}. Note: this is range-based, not analyst consensus.`,
    } : {
      value: null,
      score: null,
      source: "unavailable",
      reason: "Insufficient price history for 52-week range",
    },

    analystCount: null,

    beta: {
      value: betaLabel !== "N/A" ? betaLabel : null,
      score: betaScore,
      source: "calculated",
      reason: betaReason,
    },
  };
}
