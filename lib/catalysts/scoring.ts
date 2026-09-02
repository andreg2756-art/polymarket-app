// Master catalyst formula: combines expected impact (or its change) with
// materiality/market-quality/confidence/time weighting into one
// normalized -100..100 score, plus display classification. Spec Parts
// 14-18, 38.

import type { Classification } from "./event-types";
import { MIN_MARKET_QUALITY_FOR_SIGNAL } from "./market-quality";
import { MIN_CONFIDENCE_FOR_ACTIONABLE_SIGNAL } from "./confidence";

export interface RawSignalInputs {
  expectedImpactOrMomentum: number; // ExpectedImpactNow for Outlook, ExpectedImpactMomentum for Change
  eventMateriality: number;
  marketQuality: number;
  relationshipConfidence: number;
  timeWeight: number;
}

/** Spec Part 14/15 master formula — same shape for both Outlook (fed current impact) and Change (fed momentum). */
export function calculateRawSignal(inputs: RawSignalInputs): number {
  return (
    inputs.expectedImpactOrMomentum *
    inputs.eventMateriality *
    inputs.marketQuality *
    inputs.relationshipConfidence *
    inputs.timeWeight
  );
}

// K calibration constant, spec Part 16 — starting value, meant to be
// recalibrated once historical validation (Part 33) exists. Documented
// here rather than inlined so recalibration is a one-line change.
export const NORMALIZATION_K = 1.5;

export function normalizeScore(raw: number, k: number = NORMALIZATION_K): number {
  return 100 * Math.tanh(raw / k);
}

export function classifyScore(score: number): Classification {
  if (score >= 60) return "VERY_BULLISH";
  if (score >= 30) return "BULLISH";
  if (score >= 10) return "SLIGHTLY_BULLISH";
  if (score > -10) return "NEUTRAL";
  if (score > -30) return "SLIGHTLY_BEARISH";
  if (score > -60) return "BEARISH";
  return "VERY_BEARISH";
}

export interface NoSignalCheckInputs {
  relationshipConfidence: number;
  marketQuality: number;
  eventMateriality: number;
  normalizedScoreAbs: number; // Math.abs(currentOutlookScore) — the score being evaluated for suppression
  confidence0to100: number;
}

/**
 * Spec Part 38 — the system must be ALLOWED to say "no meaningful signal."
 * Returns the reason for suppression, or null if the signal clears every
 * bar and should be shown normally. Order matters for the returned reason
 * (checked in the sequence the spec lists them).
 */
export function checkNoSignalSuppression(inputs: NoSignalCheckInputs): Classification | null {
  if (inputs.relationshipConfidence < 0.40) return "NO_SIGNAL";
  if (inputs.marketQuality < MIN_MARKET_QUALITY_FOR_SIGNAL) return "NO_SIGNAL";
  if (inputs.eventMateriality < 0.30) return "NO_SIGNAL";
  if (inputs.normalizedScoreAbs < 10) return "NO_SIGNAL";
  if (inputs.confidence0to100 < MIN_CONFIDENCE_FOR_ACTIONABLE_SIGNAL) return "LOW_CONFIDENCE";
  return null;
}
