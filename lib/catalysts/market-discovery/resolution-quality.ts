// ResolutionQuality (spec Part 12, 10% weight) — "is the outcome
// objectively resolvable?" Per-family baseline (official numerical
// releases and government actions score highest) with a text-based
// penalty when the market's own title uses interpretive/subjective
// language, since resolution quality is a property of a SPECIFIC market's
// wording, not just its topic.

import type { MarketFamily, RawMarketCandidate } from "./types";

const BASE_RESOLUTION_QUALITY: Record<MarketFamily, number> = {
  US_MONETARY_POLICY: 1.00,
  US_INFLATION: 1.00,
  US_LABOR_MARKET: 1.00,
  US_GDP_GROWTH: 1.00,
  US_TREASURY_RATES: 0.95,
  US_ELECTION_POLICY: 0.95,
  DIRECT_MARKET_SENTIMENT: 0.95, // objectively resolvable — just economically irrelevant, a separate axis
  FOREIGN_MONETARY_POLICY: 0.90,
  US_TAX_POLICY: 0.90,
  COMMODITIES: 0.85,
  US_TRADE_POLICY: 0.85,
  ENERGY_OIL: 0.85,
  DEFENSE_POLICY: 0.85,
  US_REGULATION: 0.80,
  HEALTHCARE_POLICY: 0.80,
  US_RECESSION: 0.80, // NBER determination lags and involves some judgment
  INFRASTRUCTURE_POLICY: 0.80,
  TECH_POLICY: 0.75,
  CRYPTO_REGULATION: 0.75,
  GLOBAL_SHIPPING: 0.70,
  ENERGY_NATURAL_GAS: 0.80,
  GEOPOLITICAL_RISK: 0.55, // "blockade ends," "ceasefire holds" often involve interpretation
  OTHER_ECONOMIC: 0.50,
  IRRELEVANT: 0.20,
};

const VAGUE_LANGUAGE_PATTERNS = [/\bwidely (considered|regarded)\b/i, /\blikely\b/i, /\bin (spirit|essence)\b/i, /\bcould be argued\b/i];

export function calculateResolutionQuality(family: MarketFamily, candidate: RawMarketCandidate): number {
  const base = BASE_RESOLUTION_QUALITY[family];
  const hasVagueLanguage = VAGUE_LANGUAGE_PATTERNS.some((p) => p.test(candidate.title) || p.test(candidate.description));
  return hasVagueLanguage ? Math.max(0.20, base - 0.30) : base;
}
