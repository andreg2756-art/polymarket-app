// MarketUrgency (spec Parts 16-17) — a SEPARATE axis from
// EventImportanceScore: "how much should we care about this RIGHT NOW,"
// not "how much should we generally care." Deliberately not mixed into
// the importance formula itself.
//
// Not yet wired into the live discovery pipeline: it needs delta1D/delta7D
// probability history for DISCOVERED markets, which requires extending
// probability-snapshot persistence beyond the hand-curated themes.ts
// events currently tracked (Phase 9 in the spec's own implementation
// order). The formulas are implemented and tested here now so Phase 9 only
// has to supply real deltas, not also invent this math under time
// pressure later.

const DELTA_1D_NORMALIZATION = 0.10; // a 10pp 1-day move ≈ maximum 1D movement score
const DELTA_7D_NORMALIZATION = 0.20; // a 20pp 7-day move ≈ maximum 7D movement score
const MOVEMENT_WEIGHTS = { delta1d: 0.60, delta7d: 0.40 };
const URGENCY_BASE = 0.70;
const URGENCY_MOVEMENT_SHARE = 0.30;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateMovementScore(delta1D: number | null, delta7D: number | null): number | null {
  const terms: { value: number; weight: number }[] = [];
  if (delta1D !== null) terms.push({ value: clamp(Math.abs(delta1D) / DELTA_1D_NORMALIZATION, 0, 1), weight: MOVEMENT_WEIGHTS.delta1d });
  if (delta7D !== null) terms.push({ value: clamp(Math.abs(delta7D) / DELTA_7D_NORMALIZATION, 0, 1), weight: MOVEMENT_WEIGHTS.delta7d });
  if (terms.length === 0) return null;
  const totalWeight = terms.reduce((s, t) => s + t.weight, 0);
  return terms.reduce((s, t) => s + t.value * t.weight, 0) / totalWeight;
}

/** Returns null (never a fabricated value) when no probability history exists yet to compute a MovementScore from — importance alone doesn't imply urgency. */
export function calculateMarketUrgency(eventImportanceScore: number, movementScore: number | null): number | null {
  if (movementScore === null) return null;
  return eventImportanceScore * (URGENCY_BASE + URGENCY_MOVEMENT_SHARE * movementScore);
}
