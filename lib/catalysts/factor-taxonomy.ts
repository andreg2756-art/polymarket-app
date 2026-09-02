// Standardized economic factor taxonomy. An event's outcomes map to one or
// more of these (never directly to a company) — the factor layer is what
// lets the SAME event produce opposite signals for different companies
// (e.g. lower rates: positive for homebuilders, margin-negative for banks).
//
// This is the base list from the CATALYST_V1 spec, plus one addition:
// LABOR_MARKET_STRENGTH isn't in the original list, and UNEMPLOYMENT alone
// is ambiguous about sign convention (does a positive impact mean rising
// or falling unemployment?). Added so a jobs-report event has an
// unambiguous factor to map to; UNEMPLOYMENT is kept for the base taxonomy
// where the spec's own examples (Fed policy transmission, GDP write-ups,
// etc.) expect it.
export type EconomicFactor =
  | "MONETARY_POLICY"
  | "INTEREST_RATES"
  | "INFLATION"
  | "GDP_GROWTH"
  | "UNEMPLOYMENT"
  | "LABOR_MARKET_STRENGTH" // positive = employment conditions strengthening (more hiring, not just lower unemployment rate specifically)
  | "CONSUMER_SPENDING"
  | "CORPORATE_TAXES"
  | "PERSONAL_TAXES"
  | "TARIFFS"
  | "TRADE_POLICY"
  | "REGULATION"
  | "DEREGULATION"
  | "GOVERNMENT_SPENDING"
  | "DEFENSE_SPENDING"
  | "INFRASTRUCTURE_SPENDING"
  | "HEALTHCARE_POLICY"
  | "ENERGY_POLICY"
  | "OIL_PRICES"
  | "NATURAL_GAS"
  | "COMMODITIES"
  | "USD_STRENGTH"
  | "CREDIT_CONDITIONS"
  | "HOUSING"
  | "IMMIGRATION"
  | "LABOR_COSTS"
  | "ANTITRUST"
  | "TECH_REGULATION"
  | "AI_REGULATION"
  | "CRYPTO_REGULATION"
  | "FOREIGN_POLICY"
  | "GEOPOLITICAL_RISK"
  | "WAR_CONFLICT"
  | "SANCTIONS"
  | "ELECTION_POLICY"
  | "OTHER";

// Grouping used by aggregation.ts to avoid double-counting correlated
// events (spec Part 19) — e.g. "cut by September meeting" and "how many
// cuts this year" both belong to MONETARY_POLICY and must be aggregated
// within the group, not summed as independent signals.
export type FactorGroup =
  | "MONETARY_POLICY"
  | "LABOR_MARKET"
  | "TRADE"
  | "FISCAL_POLICY"
  | "ENERGY"
  | "REGULATION"
  | "GEOPOLITICS"
  | "ELECTION"
  | "COMPANY_SPECIFIC" // for direct/idiosyncratic events that don't route through a macro factor (e.g. a single company's IPO)
  | "OTHER";

export const FACTOR_TO_GROUP: Record<EconomicFactor, FactorGroup> = {
  MONETARY_POLICY: "MONETARY_POLICY",
  INTEREST_RATES: "MONETARY_POLICY",
  CREDIT_CONDITIONS: "MONETARY_POLICY",
  HOUSING: "MONETARY_POLICY",
  INFLATION: "MONETARY_POLICY",
  GDP_GROWTH: "OTHER",
  UNEMPLOYMENT: "LABOR_MARKET",
  LABOR_MARKET_STRENGTH: "LABOR_MARKET",
  LABOR_COSTS: "LABOR_MARKET",
  CONSUMER_SPENDING: "OTHER",
  CORPORATE_TAXES: "FISCAL_POLICY",
  PERSONAL_TAXES: "FISCAL_POLICY",
  GOVERNMENT_SPENDING: "FISCAL_POLICY",
  DEFENSE_SPENDING: "FISCAL_POLICY",
  INFRASTRUCTURE_SPENDING: "FISCAL_POLICY",
  HEALTHCARE_POLICY: "REGULATION",
  TARIFFS: "TRADE",
  TRADE_POLICY: "TRADE",
  REGULATION: "REGULATION",
  DEREGULATION: "REGULATION",
  ANTITRUST: "REGULATION",
  TECH_REGULATION: "REGULATION",
  AI_REGULATION: "REGULATION",
  CRYPTO_REGULATION: "REGULATION",
  ENERGY_POLICY: "ENERGY",
  OIL_PRICES: "ENERGY",
  NATURAL_GAS: "ENERGY",
  COMMODITIES: "ENERGY",
  USD_STRENGTH: "OTHER",
  IMMIGRATION: "LABOR_MARKET",
  FOREIGN_POLICY: "GEOPOLITICS",
  GEOPOLITICAL_RISK: "GEOPOLITICS",
  WAR_CONFLICT: "GEOPOLITICS",
  SANCTIONS: "GEOPOLITICS",
  ELECTION_POLICY: "ELECTION",
  OTHER: "OTHER",
};
