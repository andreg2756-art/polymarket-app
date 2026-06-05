// /lib/stocks/analystFactors.ts
// Fetches analyst rating and price target data from Yahoo Finance quoteSummary.
// Uses free Yahoo Finance endpoint — no API key required.

import type { ScoredMetric, YahooQuoteSummaryResult } from "./types";

const YF_MODULES = [
  "financialData",
  "defaultKeyStatistics",
  "recommendationTrend",
  "price",
].join(",");

async function fetchQuoteSummary(ticker: string): Promise<YahooQuoteSummaryResult | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${YF_MODULES}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] ?? null;
    return result as YahooQuoteSummaryResult | null;
  } catch {
    return null;
  }
}

function raw(obj: { raw?: number } | undefined | null): number | null {
  if (obj?.raw !== undefined && obj.raw !== null) return obj.raw;
  return null;
}

// Recommendation mean: 1.0 = Strong Buy, 5.0 = Strong Sell
// Convert to 0–100 score (inverted so higher = better)
function recommendationToScore(mean: number | null): number | null {
  if (mean === null) return null;
  // clamp to 1–5 range
  const clamped = Math.max(1, Math.min(5, mean));
  return Math.round(((5 - clamped) / 4) * 100);
}

function recommendationLabel(mean: number | null, key: string | null | undefined): string {
  if (key) {
    const map: Record<string, string> = {
      strongBuy: "Strong Buy",
      buy: "Buy",
      hold: "Hold",
      sell: "Sell",
      strongSell: "Strong Sell",
    };
    if (map[key]) return map[key];
  }
  if (mean === null) return "N/A";
  if (mean <= 1.5) return "Strong Buy";
  if (mean <= 2.5) return "Buy";
  if (mean <= 3.5) return "Hold";
  if (mean <= 4.5) return "Sell";
  return "Strong Sell";
}

function targetUpsideScore(upsidePct: number | null): number | null {
  if (upsidePct === null) return null;
  // 0% upside → 50, +50% upside → 100, -50% downside → 0
  return Math.round(Math.max(0, Math.min(100, 50 + upsidePct)));
}

export interface AnalystFactors {
  analystScore: ScoredMetric;
  targetUpside: ScoredMetric;
  analystCount: number | null;
  beta: ScoredMetric; // used for volatility scoring
}

export async function getAnalystFactors(ticker: string): Promise<AnalystFactors> {
  const summary = await fetchQuoteSummary(ticker);

  if (!summary) {
    const unavail = (reason: string): ScoredMetric => ({
      value: null, score: null, source: "unavailable", reason,
    });
    return {
      analystScore: unavail("Yahoo Finance quoteSummary unavailable"),
      targetUpside: unavail("Yahoo Finance quoteSummary unavailable"),
      analystCount: null,
      beta: unavail("Yahoo Finance quoteSummary unavailable"),
    };
  }

  const fd = summary.financialData;
  const ks = summary.defaultKeyStatistics;

  const recMean = raw(fd?.recommendationMean as { raw?: number } | undefined);
  const recKey = fd?.recommendationKey ?? null;
  const currentPrice = raw(fd?.currentPrice as { raw?: number } | undefined) ?? raw(summary.price?.regularMarketPrice);
  const targetMean = raw(fd?.targetMeanPrice as { raw?: number } | undefined);
  const analystCount = raw(fd?.numberOfAnalystOpinions as { raw?: number } | undefined);
  const betaVal = raw(ks?.beta as { raw?: number } | undefined);

  // Analyst score
  const aScore = recommendationToScore(recMean);
  const aLabel = recommendationLabel(recMean, recKey);

  // Target upside
  let upsidePct: number | null = null;
  if (currentPrice && targetMean && currentPrice > 0) {
    upsidePct = ((targetMean - currentPrice) / currentPrice) * 100;
  }
  const upScore = targetUpsideScore(upsidePct);

  // Beta → volatility score (lower beta = higher score)
  // Beta < 1 → score > 60, Beta > 2 → score < 30
  let betaScore: number | null = null;
  if (betaVal !== null) {
    betaScore = Math.round(Math.max(0, Math.min(100, 100 - (betaVal - 0.5) * 33)));
  }

  return {
    analystScore: {
      value: aLabel,
      score: aScore,
      source: "yahoo",
      reason: aScore !== null
        ? `${aLabel} (mean ${recMean?.toFixed(2) ?? "N/A"}, ${analystCount ?? "?"} analysts)`
        : "No analyst consensus available",
    },
    targetUpside: {
      value: upsidePct !== null ? `${upsidePct.toFixed(1)}%` : null,
      score: upScore,
      source: "yahoo",
      reason: upsidePct !== null
        ? `Mean target $${targetMean?.toFixed(2)} vs current $${currentPrice?.toFixed(2)}`
        : "Price target data unavailable",
    },
    analystCount: analystCount ? Math.round(analystCount) : null,
    beta: {
      value: betaVal !== null ? betaVal.toFixed(2) : null,
      score: betaScore,
      source: "yahoo",
      reason: betaVal !== null
        ? betaVal < 1 ? "Low volatility vs market" : betaVal > 2 ? "High volatility vs market" : "Moderate volatility vs market"
        : "Beta unavailable",
    },
  };
}
