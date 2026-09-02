// CatalystConfidence — a separate axis from direction/magnitude, spec Part
// 18. Never embed this inside the direction score; a strongly-signed but
// low-confidence catalyst should be labeled LOW_CONFIDENCE, not diluted
// into a smaller directional number.

export interface ConfidenceInputs {
  dataCompleteness: number; // 0-1: fraction of expected inputs actually present (liquidity, volume, history, full factor mappings)
  marketQuality: number; // 0-1, from market-quality.ts
  relationshipConfidence: number; // 0-1, from the stock's factor exposure (or direct-exposure) definition
  outcomeMappingConfidence: number; // 0-1, average confidence of the outcome->factor mappings actually used
  // Defaults to a deliberately low placeholder — spec: "Initially
  // HistoricalValidationConfidence may be low until backtesting exists."
  // No backtesting infrastructure exists yet (spec Part 33, explicitly
  // deferred — see this feature's implementation notes), so every score
  // right now inherits this same conservative 0.30 rather than a fake 1.0.
  historicalValidationConfidence?: number;
}

const WEIGHTS = {
  dataCompleteness: 0.20,
  marketQuality: 0.25,
  relationshipConfidence: 0.30,
  outcomeMappingConfidence: 0.15,
  historicalValidationConfidence: 0.10,
};

const DEFAULT_HISTORICAL_VALIDATION_CONFIDENCE = 0.30;

/** Returns 0-100. */
export function calculateCatalystConfidence(inputs: ConfidenceInputs): number {
  const historicalValidationConfidence = inputs.historicalValidationConfidence ?? DEFAULT_HISTORICAL_VALIDATION_CONFIDENCE;
  const raw =
    WEIGHTS.dataCompleteness * inputs.dataCompleteness +
    WEIGHTS.marketQuality * inputs.marketQuality +
    WEIGHTS.relationshipConfidence * inputs.relationshipConfidence +
    WEIGHTS.outcomeMappingConfidence * inputs.outcomeMappingConfidence +
    WEIGHTS.historicalValidationConfidence * historicalValidationConfidence;
  return Math.max(0, Math.min(100, raw * 100));
}

export type ConfidenceLabel = "HIGH" | "MODERATE" | "LOW" | "VERY_LOW";

export function classifyConfidence(confidence0to100: number): ConfidenceLabel {
  if (confidence0to100 >= 80) return "HIGH";
  if (confidence0to100 >= 60) return "MODERATE";
  if (confidence0to100 >= 40) return "LOW";
  return "VERY_LOW";
}

export const MIN_CONFIDENCE_FOR_ACTIONABLE_SIGNAL = 40;
