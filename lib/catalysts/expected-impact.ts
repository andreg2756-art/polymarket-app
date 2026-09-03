// Expected-value model connecting event outcomes -> factors -> a specific
// company's expected impact, and the change in that expected impact over
// time. Spec Parts 4, 7, 12, 13.

import type { EventOutcome, StockFactorExposure } from "./event-types";

const IMPACT_CLAMP = 5;

/**
 * CompanyOutcomeImpact = weighted mean of (FactorImpact x CompanyExposure)
 * across every factor the outcome maps to that the company also has an
 * exposure for. Weighted MEAN, not sum — a sum would let two correlated
 * factors (e.g. INTEREST_RATES and CREDIT_CONDITIONS moving together)
 * double the effective impact just because the event happens to tag both;
 * see spec Part 7's explicit warning against that. Weight is
 * (outcome-mapping confidence x exposure confidence x directional
 * confidence), so a shakier factor-mapping, a shakier company-exposure, OR
 * genuine uncertainty about which way the exposure nets out all pull that
 * factor's contribution down rather than being ignored outright. Exposure
 * itself is exposureStrength (magnitude) x direction (sign) — spec Part
 * 12's split, kept separate from directionalConfidence deliberately: a
 * company can be strongly exposed (large exposureStrength) while we're
 * still unsure the sign we picked is right (low directionalConfidence).
 */
export function calculateCompanyOutcomeImpact(
  outcome: EventOutcome,
  exposures: StockFactorExposure[]
): { impact: number; matchedFactors: number } {
  const contributions: { value: number; weight: number }[] = [];

  for (const factorImpact of outcome.factorImpacts) {
    const exposure = exposures.find((e) => e.factor === factorImpact.factor);
    if (!exposure) continue;
    const weight = factorImpact.confidence * exposure.confidence * exposure.directionalConfidence;
    if (weight <= 0) continue;
    contributions.push({ value: factorImpact.impact * exposure.exposureStrength * exposure.direction, weight });
  }

  if (contributions.length === 0) return { impact: 0, matchedFactors: 0 };

  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0);
  const weightedMean = contributions.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight;
  return {
    impact: Math.max(-IMPACT_CLAMP, Math.min(IMPACT_CLAMP, weightedMean)),
    matchedFactors: contributions.length,
  };
}

export interface OutcomeProbabilityImpact {
  outcomeId: string;
  probability: number;
  companyImpact: number; // -5..5, from calculateCompanyOutcomeImpact (or a direct impact for non-factor-mediated events)
}

/** ExpectedImpact = sum over outcomes of P(outcome) x CompanyOutcomeImpact(outcome). Spec Part 12. */
export function calculateExpectedImpact(outcomeImpacts: OutcomeProbabilityImpact[]): number {
  return outcomeImpacts.reduce((sum, o) => sum + o.probability * o.companyImpact, 0);
}

export interface ExpectedImpactHistory {
  current: number;
  oneDayAgo: number | null;
  sevenDayAgo: number | null;
}

export interface ExpectedImpactDeltas {
  delta1d: number | null;
  delta7d: number | null;
}

export function calculateExpectedImpactDeltas(h: ExpectedImpactHistory): ExpectedImpactDeltas {
  return {
    delta1d: h.oneDayAgo === null ? null : h.current - h.oneDayAgo,
    delta7d: h.sevenDayAgo === null ? null : h.current - h.sevenDayAgo,
  };
}

const MOMENTUM_WEIGHTS = { delta1d: 0.60, delta7d: 0.40 };

/**
 * ExpectedImpactMomentum, spec Part 13 — renormalized over whichever
 * period(s) actually have history. Returns null (not 0) when NEITHER
 * period has data, which is the correct state for a catalyst that was
 * just computed for the first time with no prior snapshot to compare
 * against — see probability.ts's identical invariant and rationale.
 */
export function calculateExpectedImpactMomentum(deltas: ExpectedImpactDeltas): number | null {
  const available: { value: number; weight: number }[] = [];
  if (deltas.delta1d !== null) available.push({ value: deltas.delta1d, weight: MOMENTUM_WEIGHTS.delta1d });
  if (deltas.delta7d !== null) available.push({ value: deltas.delta7d, weight: MOMENTUM_WEIGHTS.delta7d });

  if (available.length === 0) return null;
  const totalWeight = available.reduce((s, a) => s + a.weight, 0);
  return available.reduce((s, a) => s + a.value * a.weight, 0) / totalWeight;
}
