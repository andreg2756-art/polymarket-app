// TransmissionClarity (spec Part 11, 15% weight) — "can we explain the
// path from event outcome to economic factor to company?" Per-family
// baseline matching the spec's own worked examples (Fed hike -> rates ->
// mortgages -> homebuilders = 0.95; steel tariff -> domestic pricing ->
// producer earnings = 0.90; election -> policy mix -> tech regulation ->
// tech stocks = 0.60; approval rating -> vague sentiment -> arbitrary
// stock = 0.10).

import type { MarketFamily } from "./types";

export const TRANSMISSION_CLARITY: Record<MarketFamily, number> = {
  US_MONETARY_POLICY: 0.95,
  US_TREASURY_RATES: 0.90,
  US_TRADE_POLICY: 0.90, // specific tariff/commodity — direct pricing mechanism, matches spec's steel-tariff example
  US_INFLATION: 0.85,
  US_LABOR_MARKET: 0.85,
  ENERGY_OIL: 0.85,
  US_TAX_POLICY: 0.85,
  US_RECESSION: 0.80,
  COMMODITIES: 0.75,
  US_GDP_GROWTH: 0.75,
  GLOBAL_SHIPPING: 0.75,
  ENERGY_NATURAL_GAS: 0.80,
  US_REGULATION: 0.70,
  HEALTHCARE_POLICY: 0.70,
  CRYPTO_REGULATION: 0.65,
  DEFENSE_POLICY: 0.65,
  TECH_POLICY: 0.65,
  FOREIGN_MONETARY_POLICY: 0.60,
  INFRASTRUCTURE_POLICY: 0.60,
  US_ELECTION_POLICY: 0.55, // probable-policy-mix chain, matches spec's own 0.60 election example closely
  GEOPOLITICAL_RISK: 0.55,
  OTHER_ECONOMIC: 0.35,
  DIRECT_MARKET_SENTIMENT: 0.05, // circular by construction — spec Part 21
  IRRELEVANT: 0.05,
};

export function calculateTransmissionClarity(family: MarketFamily): number {
  return TRANSMISSION_CLARITY[family];
}
