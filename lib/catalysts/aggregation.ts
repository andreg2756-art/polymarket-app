// Combines multiple catalyst signals for one stock into a single
// PredictionMarketOutlook, without letting correlated events double-count
// the same underlying thesis. Spec Parts 19-20.

import type { FactorGroup } from "./factor-taxonomy";

export interface GroupableSignal {
  eventSlug: string;
  factorGroup: FactorGroup;
  score: number; // normalized -100..100
  confidence: number; // 0-100
}

/** Confidence-weighted mean within one factor group — e.g. two Fed-related events both tagged MONETARY_POLICY get averaged here, not summed, so tracking the "same meeting" from two angles doesn't double the effective signal. */
export function aggregateWithinGroup(signals: GroupableSignal[]): { score: number; confidence: number } {
  if (signals.length === 0) return { score: 0, confidence: 0 };
  const totalConfidence = signals.reduce((s, sig) => s + sig.confidence, 0);
  if (totalConfidence === 0) {
    // No usable confidence weights — fall back to a plain average rather than dividing by zero.
    const avg = signals.reduce((s, sig) => s + sig.score, 0) / signals.length;
    const avgConfidence = signals.reduce((s, sig) => s + sig.confidence, 0) / signals.length;
    return { score: avg, confidence: avgConfidence };
  }
  const score = signals.reduce((s, sig) => s + sig.score * sig.confidence, 0) / totalConfidence;
  const confidence = totalConfidence / signals.length;
  return { score, confidence };
}

// A single factor group can't contribute more than this share of the total
// outlook unless its confidence clears CONCENTRATION_CONFIDENCE_OVERRIDE —
// spec Part 19's "apply a concentration cap so one factor does not
// dominate." With few events per stock today this rarely binds, but it's
// real behavior, not a placeholder, once more events accumulate.
const MAX_GROUP_WEIGHT_SHARE = 0.65;
const CONCENTRATION_CONFIDENCE_OVERRIDE = 85;

export interface PredictionMarketOutlook {
  outlook: number; // -100..100
  confidence: number; // 0-100
  byGroup: { group: FactorGroup; score: number; confidence: number }[];
}

/** Groups signals by factorGroup, aggregates within each, then combines groups with a concentration cap. */
export function calculatePredictionMarketOutlook(signals: GroupableSignal[]): PredictionMarketOutlook {
  const byGroupMap = new Map<FactorGroup, GroupableSignal[]>();
  for (const s of signals) {
    if (!byGroupMap.has(s.factorGroup)) byGroupMap.set(s.factorGroup, []);
    byGroupMap.get(s.factorGroup)!.push(s);
  }

  const groupResults = Array.from(byGroupMap.entries()).map(([group, groupSignals]) => ({
    group,
    ...aggregateWithinGroup(groupSignals),
  }));

  if (groupResults.length === 0) return { outlook: 0, confidence: 0, byGroup: [] };

  let weights = groupResults.map((g) => g.confidence);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight > 0) {
    weights = weights.map((w, i) => {
      const share = w / totalWeight;
      if (share > MAX_GROUP_WEIGHT_SHARE && groupResults[i].confidence < CONCENTRATION_CONFIDENCE_OVERRIDE) {
        return totalWeight * MAX_GROUP_WEIGHT_SHARE;
      }
      return w;
    });
  }
  const finalTotalWeight = weights.reduce((a, b) => a + b, 0) || groupResults.length;

  const outlook = groupResults.reduce((s, g, i) => s + g.score * (weights[i] || 1), 0) / finalTotalWeight;
  const confidence = groupResults.reduce((s, g) => s + g.confidence, 0) / groupResults.length;

  return {
    outlook,
    confidence,
    byGroup: groupResults.map((g) => ({ group: g.group, score: g.score, confidence: g.confidence })),
  };
}
