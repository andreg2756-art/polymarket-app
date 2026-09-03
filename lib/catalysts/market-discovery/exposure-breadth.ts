// ExposureBreadth (spec Part 10, 15% weight) — "how broad is the plausible
// public-equity impact?", deliberately NOT the same axis as
// EconomicMateriality. A copper tariff can matter enormously to copper
// producers (high materiality-to-those-companies) while still being
// narrow across the broader equity market (low breadth) — spec's own
// worked example.

import type { MarketFamily, RawMarketCandidate } from "./types";

const BASE_EXPOSURE_BREADTH: Record<MarketFamily, number> = {
  US_MONETARY_POLICY: 1.00,
  US_RECESSION: 1.00,
  US_INFLATION: 0.95,
  US_GDP_GROWTH: 0.90,
  US_TREASURY_RATES: 0.85,
  US_LABOR_MARKET: 0.85,
  ENERGY_OIL: 0.85,
  US_TAX_POLICY: 0.80,
  US_TRADE_POLICY: 0.60, // narrower unless the market names a broad/major counterpart — see below
  GLOBAL_SHIPPING: 0.65,
  GEOPOLITICAL_RISK: 0.60,
  US_REGULATION: 0.55,
  DEFENSE_POLICY: 0.55,
  US_ELECTION_POLICY: 0.50,
  TECH_POLICY: 0.50,
  ENERGY_NATURAL_GAS: 0.50,
  INFRASTRUCTURE_POLICY: 0.45,
  HEALTHCARE_POLICY: 0.45,
  FOREIGN_MONETARY_POLICY: 0.40,
  CRYPTO_REGULATION: 0.35,
  COMMODITIES: 0.35,
  OTHER_ECONOMIC: 0.25,
  DIRECT_MARKET_SENTIMENT: 0.00,
  IRRELEVANT: 0.00,
};

function majorTradeBreadthBoost(candidate: RawMarketCandidate): number {
  const majorSignal = /\bchina\b/i.test(candidate.title) || candidate.tags.includes("china") || candidate.tags.includes("china-trade");
  return majorSignal ? 0.20 : 0;
}

export function calculateExposureBreadth(family: MarketFamily, candidate: RawMarketCandidate): number {
  const base = BASE_EXPOSURE_BREADTH[family];
  if (family === "US_TRADE_POLICY") {
    return Math.min(1.0, base + majorTradeBreadthBoost(candidate));
  }
  return base;
}
