// EconomicRelevance (spec Part 4) — a coarse HIGH/MEDIUM/LOW/NONE label
// derived from the already-computed materiality/transmission-clarity
// components, not a separately-fabricated score. Spec's four questions
// (could this affect earnings/margins/etc.; is the mechanism
// identifiable; is the outcome measurable; is it relevant to public
// markets) are exactly what economicMateriality and transmissionClarity
// already encode — this is a display-friendly tier on top, not a new
// independent judgment that could disagree with them.

import type { EconomicRelevance, MarketFamily } from "./types";

export function classifyEconomicRelevance(
  family: MarketFamily,
  economicMateriality: number,
  transmissionClarity: number
): EconomicRelevance {
  if (family === "IRRELEVANT" || family === "DIRECT_MARKET_SENTIMENT") return "NONE";

  // Both axes matter — high materiality with no identifiable transmission
  // path (e.g. a vague "approval rating" market that slipped past hard
  // reject) shouldn't read as HIGH relevance just because its topic sounds
  // important.
  const combined = (economicMateriality + transmissionClarity) / 2;
  if (combined >= 0.70) return "HIGH";
  if (combined >= 0.45) return "MEDIUM";
  if (combined > 0) return "LOW";
  return "NONE";
}
