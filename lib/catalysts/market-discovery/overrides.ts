// Manual override system (spec Part 30) — for genuine edge cases the
// deterministic classifier gets wrong, NOT a substitute for the rules
// themselves. Spec's own words: "do not make the application dependent on
// a huge manual mapping table." Starts empty; add an entry only when a
// real discovered market is confirmed misclassified, with a reason
// explaining what the automated rules missed.

import type { MarketDisposition, MarketFamily, RawMarketCandidate } from "./types";

export interface MarketOverride {
  eventSlug?: string;
  titlePattern?: RegExp;
  forcedFamily?: MarketFamily;
  forcedDisposition?: MarketDisposition;
  forcedEconomicMateriality?: number;
  reject?: boolean;
  reason: string;
}

export const MARKET_OVERRIDES: MarketOverride[] = [];

export interface OverrideResult {
  forcedFamily?: MarketFamily;
  forcedDisposition?: MarketDisposition;
  forcedEconomicMateriality?: number;
  reject?: boolean;
  reason?: string;
}

export function findOverride(candidate: RawMarketCandidate): OverrideResult {
  const match = MARKET_OVERRIDES.find(
    (o) =>
      (o.eventSlug && o.eventSlug === candidate.eventSlug) ||
      (o.titlePattern && o.titlePattern.test(candidate.title))
  );
  if (!match) return {};
  return {
    forcedFamily: match.forcedFamily,
    forcedDisposition: match.forcedDisposition,
    forcedEconomicMateriality: match.forcedEconomicMateriality,
    reject: match.reject,
    reason: match.reason,
  };
}
