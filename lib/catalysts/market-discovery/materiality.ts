// EconomicMateriality (spec Part 8, 30% weight) — "if this event happens,
// how materially could it alter the economic environment relevant to
// equities?" Structured per-family table matching the spec's own scoring
// guidance (Fed policy/major recession/major tax policy = 1.00 down to
// weak/no economic connection = 0.00-0.20), with a couple of
// keyword-driven adjustments (a China-specific trade market rates higher
// than a narrow single-commodity one) layered on top of the family
// baseline rather than replacing it.

import type { MarketFamily, RawMarketCandidate } from "./types";

const BASE_MATERIALITY: Record<MarketFamily, number> = {
  US_MONETARY_POLICY: 1.00,
  US_RECESSION: 1.00,
  US_TAX_POLICY: 0.90,
  US_INFLATION: 0.90,
  ENERGY_OIL: 0.85,
  US_GDP_GROWTH: 0.80,
  US_LABOR_MARKET: 0.80,
  US_TREASURY_RATES: 0.75,
  US_TRADE_POLICY: 0.70, // adjusted up for China/major-country subfamilies below
  US_REGULATION: 0.65,
  GLOBAL_SHIPPING: 0.65,
  DEFENSE_POLICY: 0.60,
  INFRASTRUCTURE_POLICY: 0.60,
  GEOPOLITICAL_RISK: 0.55,
  HEALTHCARE_POLICY: 0.50,
  TECH_POLICY: 0.50,
  CRYPTO_REGULATION: 0.45,
  FOREIGN_MONETARY_POLICY: 0.55,
  US_ELECTION_POLICY: 0.40, // diffuse until a specific policy chain is known — see transmission-clarity.ts
  COMMODITIES: 0.40,
  ENERGY_NATURAL_GAS: 0.55,
  OTHER_ECONOMIC: 0.30,
  DIRECT_MARKET_SENTIMENT: 0.00,
  IRRELEVANT: 0.00,
};

// Subfamilies/keywords that push a market's materiality above its family
// baseline — "major tariffs" (spec's 0.90 tier) vs. a narrow single-country
// or single-commodity one (kept at the family baseline).
function majorTradePolicyBoost(candidate: RawMarketCandidate): number {
  const majorSignal = /\bchina\b/i.test(candidate.title) || candidate.tags.includes("china") || candidate.tags.includes("china-trade");
  return majorSignal ? 0.20 : 0;
}

export function calculateEconomicMateriality(family: MarketFamily, candidate: RawMarketCandidate): number {
  const base = BASE_MATERIALITY[family];
  if (family === "US_TRADE_POLICY") {
    return Math.min(1.0, base + majorTradePolicyBoost(candidate));
  }
  return base;
}
