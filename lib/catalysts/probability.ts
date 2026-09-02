// Probability normalization and momentum. Spec Parts 1-3.
//
// Critical invariant throughout this file: a missing historical value is
// `null`, never `0` — treating "we don't have 7-day-ago data" the same as
// "probability was 0% seven days ago" would fabricate a huge, fake delta.
// Every function here renormalizes over whatever periods actually exist
// instead.

/** Rescales a set of raw probabilities to sum to 1.0 — use when outcomes are known to be mutually exclusive but their raw prices don't sum to exactly 100% (vig/rounding). */
export function normalizeOutcomeProbabilities(rawProbabilities: number[]): number[] {
  const sum = rawProbabilities.reduce((a, b) => a + b, 0);
  if (sum <= 0) return rawProbabilities.map(() => 0);
  return rawProbabilities.map((p) => p / sum);
}

export interface ProbabilityHistory {
  current: number;
  oneDayAgo: number | null;
  sevenDayAgo: number | null;
  thirtyDayAgo: number | null;
}

export interface ProbabilityDeltas {
  delta1d: number | null;
  delta7d: number | null;
  delta30d: number | null;
}

export function calculateProbabilityDeltas(h: ProbabilityHistory): ProbabilityDeltas {
  return {
    delta1d: h.oneDayAgo === null ? null : h.current - h.oneDayAgo,
    delta7d: h.sevenDayAgo === null ? null : h.current - h.sevenDayAgo,
    delta30d: h.thirtyDayAgo === null ? null : h.current - h.thirtyDayAgo,
  };
}

const MOMENTUM_WEIGHTS = { delta1d: 0.50, delta7d: 0.35, delta30d: 0.15 };

/**
 * Weighted blend of the three deltas, renormalizing over whichever periods
 * have real data. Returns null (not 0) if NO period has history yet —
 * that's a "no signal" state, not a neutral one.
 */
export function calculateProbabilityMomentum(deltas: ProbabilityDeltas): number | null {
  const available: { value: number; weight: number }[] = [];
  if (deltas.delta1d !== null) available.push({ value: deltas.delta1d, weight: MOMENTUM_WEIGHTS.delta1d });
  if (deltas.delta7d !== null) available.push({ value: deltas.delta7d, weight: MOMENTUM_WEIGHTS.delta7d });
  if (deltas.delta30d !== null) available.push({ value: deltas.delta30d, weight: MOMENTUM_WEIGHTS.delta30d });

  if (available.length === 0) return null;
  const totalWeight = available.reduce((s, a) => s + a.weight, 0);
  return available.reduce((s, a) => s + a.value * a.weight, 0) / totalWeight;
}
