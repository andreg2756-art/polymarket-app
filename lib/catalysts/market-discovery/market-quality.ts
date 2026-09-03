// MarketQuality for the discovery pipeline (spec Part 9) — a DIFFERENT
// module from lib/catalysts/market-quality.ts, which scores quality for
// the hand-curated CATALYST_V1 engine's already-known markets and omits
// spread (that engine's audit found the Gamma API didn't expose it on the
// endpoint it was using). Discovery uses /events, which DOES expose
// `spread` on each constituent market (confirmed live, 2026-09-03) — so
// this version implements the full 4-term formula the spec asks for,
// rather than duplicating the other module's 2-term fallback.

import type { RawMarketCandidate } from "./types";
import { MARKET_QUALITY_WEIGHTS, MARKET_QUALITY_LOG_CALIBRATION, MAX_MEANINGFUL_SPREAD } from "./config";

export function normalizeLogValue(value: number, maxLog10: number): number {
  return clamp(Math.log10(Math.max(value, 0) + 1) / maxLog10, 0, 1);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface MarketQualityInputs {
  liquidity: number | null;
  volume24hr: number;
  spread: number | null;
}

/**
 * Weighted blend of liquidity/volume/spread/recent-activity, log-normalized
 * so one enormous market can't fully dominate a smaller-but-meaningful one
 * (spec Part 9's explicit instruction). Missing spread renormalizes over
 * the remaining terms rather than being silently treated as 0 — a market
 * with no spread data isn't necessarily low-quality, it's just missing one
 * input.
 */
export function calculateMarketQuality(inputs: MarketQualityInputs): number {
  const liquidityScore = normalizeLogValue(inputs.liquidity ?? 0, MARKET_QUALITY_LOG_CALIBRATION.liquidityMaxLog10);
  const volumeScore = normalizeLogValue(inputs.volume24hr, MARKET_QUALITY_LOG_CALIBRATION.volumeMaxLog10);
  // "Recent activity" = 24h volume, same signal VolumeScore uses but
  // conceptually distinct (spec lists them as separate terms without a
  // separate formula for the second) — since the Gamma API's per-market
  // fields don't expose a genuinely independent recency signal beyond
  // volume24hr itself, this is the same value under both terms rather than
  // inventing an unsupported metric.
  const recentActivityScore = volumeScore;

  const terms: { weight: number; score: number }[] = [
    { weight: MARKET_QUALITY_WEIGHTS.liquidity, score: liquidityScore },
    { weight: MARKET_QUALITY_WEIGHTS.volume, score: volumeScore },
    { weight: MARKET_QUALITY_WEIGHTS.recentActivity, score: recentActivityScore },
  ];
  if (inputs.spread !== null) {
    const spreadScore = clamp(1 - inputs.spread / MAX_MEANINGFUL_SPREAD, 0, 1);
    terms.push({ weight: MARKET_QUALITY_WEIGHTS.spread, score: spreadScore });
  }

  const totalWeight = terms.reduce((s, t) => s + t.weight, 0);
  if (totalWeight === 0) return 0;
  return terms.reduce((s, t) => s + t.weight * t.score, 0) / totalWeight;
}

export function marketQualityFromCandidate(candidate: RawMarketCandidate): number {
  return calculateMarketQuality({ liquidity: candidate.liquidity, volume24hr: candidate.volume24hr, spread: candidate.spread });
}
