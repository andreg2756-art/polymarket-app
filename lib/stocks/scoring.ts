// /lib/stocks/scoring.ts
// Composes all scoring factors into a single EnhancedStockScore.
// Never overwrites existing Yahoo Finance momentum/price data.

import type { EnhancedStockScore, ScoredMetric } from "./types";
import { getNewsSentimentScore } from "./newsSentiment";
import { getAnalystFactors } from "./analystFactors";

// Weights must sum to 1.0
const WEIGHTS = {
  momentum:   0.30,
  volatility: 0.15,
  analyst:    0.20,
  upside:     0.15,
  sentiment:  0.10,
  volume:     0.10,
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function nullableAvg(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Momentum score from existing change1M / change3M values (already computed by Yahoo Finance)
function buildMomentumScore(change1M: number, change3M: number): ScoredMetric {
  const mom1 = change1M > 30 ? 100 : change1M > 20 ? 85 : change1M > 10 ? 70 : change1M > 5 ? 55 : change1M > 0 ? 42 : change1M > -5 ? 25 : 10;
  const mom3 = change3M > 50 ? 100 : change3M > 30 ? 85 : change3M > 15 ? 70 : change3M > 5 ? 55 : change3M > 0 ? 42 : change3M > -10 ? 25 : 10;
  const score = Math.round(mom1 * 0.4 + mom3 * 0.6);
  return {
    value: `1M: ${change1M >= 0 ? "+" : ""}${change1M.toFixed(1)}% / 3M: ${change3M >= 0 ? "+" : ""}${change3M.toFixed(1)}%`,
    score: clamp(score),
    source: "yahoo",
    reason: score >= 70
      ? "Strong sustained momentum across both timeframes"
      : score >= 50
      ? "Moderate positive momentum"
      : "Weak or negative momentum",
  };
}

// Volume score from relativeVolume (already computed by Yahoo Finance)
function buildVolumeScore(relativeVolume: number): ScoredMetric {
  const score = relativeVolume > 3 ? 95 : relativeVolume > 2 ? 82 : relativeVolume > 1.5 ? 68 : relativeVolume > 1.2 ? 55 : relativeVolume > 1 ? 42 : relativeVolume > 0.7 ? 28 : 15;
  return {
    value: `${relativeVolume.toFixed(1)}x`,
    score: clamp(score),
    source: "yahoo",
    reason: score >= 68
      ? "Volume significantly above average — buying pressure confirmed"
      : score >= 50
      ? "Volume slightly above average"
      : "Volume below average — weak conviction",
  };
}

function finalRating(score: number | null): EnhancedStockScore["finalRating"] {
  if (score === null) return "Insufficient Data";
  if (score >= 72) return "Strong Watch";
  if (score >= 55) return "Watch";
  if (score >= 38) return "Neutral";
  return "Avoid";
}

export async function computeEnhancedScore(
  ticker: string,
  change1M: number,
  change3M: number,
  relativeVolume: number
): Promise<EnhancedStockScore> {
  // Fetch analyst and news data in parallel — never blocks on missing data
  const [analystFactors, newsSentiment] = await Promise.all([
    getAnalystFactors(ticker).catch(() => null),
    getNewsSentimentScore(ticker).catch(() => ({
      value: null, score: null, source: "unavailable" as const, reason: "Sentiment fetch failed",
    })),
  ]);

  const momentumScore = buildMomentumScore(change1M, change3M);
  const volumeScore = buildVolumeScore(relativeVolume);

  const volatilityScore: ScoredMetric = analystFactors?.beta ?? {
    value: null, score: null, source: "unavailable", reason: "Beta unavailable",
  };

  const analystScore: ScoredMetric = analystFactors?.analystScore ?? {
    value: null, score: null, source: "unavailable", reason: "Analyst data unavailable",
  };

  const targetUpside: ScoredMetric = analystFactors?.targetUpside ?? {
    value: null, score: null, source: "unavailable", reason: "Target price unavailable",
  };

  // Weighted composite — skips null components proportionally
  const components: { score: number | null; weight: number }[] = [
    { score: momentumScore.score, weight: WEIGHTS.momentum },
    { score: volatilityScore.score, weight: WEIGHTS.volatility },
    { score: analystScore.score, weight: WEIGHTS.analyst },
    { score: targetUpside.score, weight: WEIGHTS.upside },
    { score: newsSentiment.score, weight: WEIGHTS.sentiment },
    { score: volumeScore.score, weight: WEIGHTS.volume },
  ];

  const available = components.filter((c) => c.score !== null);
  let riskAdjustedScore: number | null = null;

  if (available.length >= 2) {
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    const weightedSum = available.reduce((s, c) => s + (c.score! * c.weight), 0);
    riskAdjustedScore = Math.round(clamp(weightedSum / totalWeight));
  }

  return {
    ticker,
    momentumScore,
    volatilityScore,
    analystScore,
    targetUpside,
    newsSentiment,
    volumeScore,
    riskAdjustedScore,
    finalRating: finalRating(riskAdjustedScore),
    fetchedAt: new Date().toISOString(),
  };
}
