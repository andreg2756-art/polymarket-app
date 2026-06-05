// /lib/stocks/scoring.ts
// Composes all scoring factors. Never overwrites existing Yahoo Finance data.

import type { EnhancedStockScore, ScoredMetric } from "./types";
import { getNewsSentimentScore } from "./newsSentiment";
import { getAnalystFactors } from "./analystFactors";
import { getEarningsRiskScore } from "./earningsRisk";
import { getRevenueGrowthScore } from "./revenueGrowth";
import { getRelativeStrengthRank } from "./relativeStrength";

// Updated weights — news reduced, volume increased
const FINAL_WEIGHTS = {
  momentum:              0.25,
  riskQuality:           0.20,
  analystOrRiskQuality:  0.20,
  upside:                0.15,
  volume:                0.15,
  news:                  0.05,
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function applyRevenueGrowthModifier(score: number, modifier: number): number {
  return clampScore(score + modifier);
}

function applyEarningsRiskPenalty(score: number, daysUntilEarnings: number | null): number {
  if (daysUntilEarnings === null) return score;
  if (daysUntilEarnings <= 7)  return clampScore(score - 10);
  if (daysUntilEarnings <= 14) return clampScore(score - 6);
  if (daysUntilEarnings <= 30) return clampScore(score - 3);
  return score;
}

function buildMomentumScore(change1M: number, change3M: number): ScoredMetric {
  const mom1 = change1M > 30 ? 100 : change1M > 20 ? 85 : change1M > 10 ? 70 : change1M > 5 ? 55 : change1M > 0 ? 42 : change1M > -5 ? 25 : 10;
  const mom3 = change3M > 50 ? 100 : change3M > 30 ? 85 : change3M > 15 ? 70 : change3M > 5 ? 55 : change3M > 0 ? 42 : change3M > -10 ? 25 : 10;
  const score = Math.round(mom1 * 0.4 + mom3 * 0.6);
  return {
    value: `1M: ${change1M >= 0 ? "+" : ""}${change1M.toFixed(1)}% / 3M: ${change3M >= 0 ? "+" : ""}${change3M.toFixed(1)}%`,
    score: clamp(score),
    source: "yahoo",
    reason: score >= 70 ? "Strong sustained momentum across both timeframes" : score >= 50 ? "Moderate positive momentum" : "Weak or negative momentum",
  };
}

function buildVolumeScore(relativeVolume: number): ScoredMetric {
  const score = relativeVolume > 3 ? 95 : relativeVolume > 2 ? 82 : relativeVolume > 1.5 ? 68 : relativeVolume > 1.2 ? 55 : relativeVolume > 1 ? 42 : relativeVolume > 0.7 ? 28 : 15;
  return {
    value: `${relativeVolume.toFixed(1)}x`,
    score: clamp(score),
    source: "yahoo",
    reason: score >= 68 ? "Volume significantly above average — buying pressure confirmed" : score >= 50 ? "Volume slightly above average" : "Volume below average — weak conviction",
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
  relativeVolume: number,
  existingRevenueGrowth: number | null = null
): Promise<EnhancedStockScore> {

  // All fetches in parallel — each has its own null fallback
  const [analystFactors, newsSentiment, earningsRisk, revenueGrowth, rsRank] = await Promise.all([
    getAnalystFactors(ticker).catch(() => null),
    getNewsSentimentScore(ticker).catch((): ScoredMetric => ({
      value: null, score: null, source: "unavailable", reason: "Sentiment fetch failed",
    })),
    getEarningsRiskScore(ticker).catch(() => ({
      value: null, score: null, source: "unavailable" as const, reason: "Earnings risk fetch failed", daysUntilEarnings: null,
    })),
    getRevenueGrowthScore(ticker, existingRevenueGrowth).catch(() => ({
      value: null, score: null, source: "unavailable" as const, reason: "Revenue growth fetch failed", modifier: 0,
    })),
    getRelativeStrengthRank(ticker, change1M, change3M, relativeVolume).catch((): ScoredMetric => ({
      value: null, score: null, source: "unavailable", reason: "RS Rank calculation failed",
    })),
  ]);

  const momentumScore  = buildMomentumScore(change1M, change3M);
  const volumeScore    = buildVolumeScore(relativeVolume);

  // Volatility = beta metric from analystFactors
  const volatilityScore: ScoredMetric = analystFactors?.beta ?? {
    value: null, score: null, source: "unavailable", reason: "Beta unavailable",
  };

  // Risk quality = analystScore from analystFactors (derived from beta + range)
  const riskQualityScore: ScoredMetric = analystFactors?.analystScore ?? {
    value: null, score: null, source: "unavailable", reason: "Risk quality unavailable",
  };

  // Upside = range-based distance to 52w high (clearly labeled in UI as such)
  const upsideScore: ScoredMetric = analystFactors?.targetUpside ?? {
    value: null, score: null, source: "unavailable", reason: "52W distance unavailable",
  };

  // These are always false until a real analyst API is connected
  const hasRealAnalystConsensus = false;
  const hasRealAnalystTarget    = false;

  // Weighted composite — skips null components proportionally
  const components: { score: number | null; weight: number }[] = [
    { score: momentumScore.score,    weight: FINAL_WEIGHTS.momentum },
    { score: volatilityScore.score,  weight: FINAL_WEIGHTS.riskQuality },
    { score: riskQualityScore.score, weight: FINAL_WEIGHTS.analystOrRiskQuality },
    { score: upsideScore.score,      weight: FINAL_WEIGHTS.upside },
    { score: volumeScore.score,      weight: FINAL_WEIGHTS.volume },
    { score: newsSentiment.score,    weight: FINAL_WEIGHTS.news },
  ];

  const available = components.filter((c) => c.score !== null);
  let riskAdjustedScore: number | null = null;

  if (available.length >= 2) {
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    const weightedSum = available.reduce((s, c) => s + (c.score! * c.weight), 0);
    let base = clamp(weightedSum / totalWeight);

    // Apply revenue growth modifier
    base = applyRevenueGrowthModifier(base, revenueGrowth?.modifier ?? 0);

    // Apply earnings risk penalty
    base = applyEarningsRiskPenalty(base, earningsRisk?.daysUntilEarnings ?? null);

    riskAdjustedScore = clampScore(base);
  }

  return {
    ticker,
    momentumScore,
    volatilityScore,
    riskQualityScore,
    upsideScore,
    newsSentiment,
    volumeScore,
    revenueGrowthScore: revenueGrowth,
    earningsRiskScore: earningsRisk,
    rsRank,
    hasRealAnalystConsensus,
    hasRealAnalystTarget,
    riskAdjustedScore,
    finalRating: finalRating(riskAdjustedScore),
    fetchedAt: new Date().toISOString(),
  };
}
