// Spec Part 13's TimeRelevance formula is IDENTICAL in shape to the
// existing CATALYST_V1 engine's TimeWeight (exp(-days/240), clamped
// 0.25-1.00) — reusing it directly rather than maintaining two copies of
// the same decay curve, per the spec's own audit-for-reuse instruction
// (Part 1: "do not create duplicate infrastructure when something usable
// already exists").

import { calculateTimeWeight, daysBetween } from "../time-weight";

export function calculateTimeRelevance(now: Date, endDate: string | null): number {
  if (!endDate) return 0.25; // no resolution date on record — treat as maximally stale rather than guessing
  return calculateTimeWeight(daysBetween(now.toISOString(), endDate));
}

export { daysBetween };
