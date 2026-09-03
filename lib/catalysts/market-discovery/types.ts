// Core types for the market-discovery pipeline (spec Part 24). This is a
// SEPARATE system from lib/catalysts/event-types.ts's CATALYST_V1 engine —
// discovery decides WHICH markets are worth feeding into that engine, it
// doesn't replace it. Formula-versioned independently (MARKET_IMPORTANCE_V1
// vs. CATALYST_V1) per spec Part 31.

export const MARKET_IMPORTANCE_FORMULA_VERSION = "MARKET_IMPORTANCE_V1";

export type MarketDisposition = "CORE" | "IMPORTANT" | "CONDITIONAL" | "WATCH" | "IGNORE";

export type EconomicRelevance = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type MarketFamily =
  | "US_MONETARY_POLICY"
  | "US_INFLATION"
  | "US_RECESSION"
  | "US_GDP_GROWTH"
  | "US_LABOR_MARKET"
  | "US_TREASURY_RATES"
  | "US_TRADE_POLICY"
  | "US_TAX_POLICY"
  | "ENERGY_OIL"
  | "ENERGY_NATURAL_GAS"
  | "GLOBAL_SHIPPING"
  | "US_REGULATION"
  | "US_ELECTION_POLICY"
  | "DEFENSE_POLICY"
  | "INFRASTRUCTURE_POLICY"
  | "HEALTHCARE_POLICY"
  | "TECH_POLICY"
  | "CRYPTO_REGULATION"
  | "GEOPOLITICAL_RISK"
  | "COMMODITIES"
  | "FOREIGN_MONETARY_POLICY"
  | "DIRECT_MARKET_SENTIMENT"
  | "OTHER_ECONOMIC"
  | "IRRELEVANT";

/** One Polymarket event, normalized from the Gamma API's /events response into the shape the pipeline needs. An event can bundle several markets (e.g. the jobs-report event's 6 mutually-exclusive buckets) — quality/probability fields below are computed across all of them. */
export interface RawMarketCandidate {
  eventId: string;
  eventSlug: string;
  title: string;
  description: string;
  tags: string[]; // lowercase tag slugs, e.g. "fomc", "fed-rates", "sports"
  endDate: string | null;
  createdAt: string | null;
  volume24hr: number;
  liquidity: number | null;
  spread: number | null; // best (lowest) spread across constituent markets, when available
  marketCount: number;
  // The single highest-volume constituent market's own probability/id —
  // used for display and as the eventual link into probability history.
  // Not authoritative for multi-outcome events; that needs Phase 9's
  // integration with the existing per-outcome snapshot infra.
  primaryConditionId: string | null;
  primaryProbability: number | null;
}

/** One fully-scored candidate market — spec Part 24's exact interface, plus the urgency/movement fields left null until Phase 9/10 wires in probability history for discovered (not just hand-curated) markets. */
export interface EvaluatedPredictionMarket {
  eventId: string;
  eventSlug: string;
  title: string;

  marketFamily: MarketFamily;
  subfamily?: string;

  economicRelevance: EconomicRelevance;

  economicMateriality: number;
  marketQuality: number;
  exposureBreadth: number;
  transmissionClarity: number;
  resolutionQuality: number;
  timeRelevance: number;

  eventImportanceScore: number;

  probabilityCurrent: number | null;

  // Not yet populated — needs Phase 9 (probability-history integration for
  // discovered markets, distinct from the hand-curated themes.ts snapshots
  // that already exist) before these can be anything but null.
  probability1D: number | null;
  probability7D: number | null;
  delta1D: number | null;
  delta7D: number | null;
  movementScore: number | null;
  marketUrgency: number | null;

  disposition: MarketDisposition;

  reasons: string[];
  rejectionReasons?: string[];

  formulaVersion: string;
  evaluatedAt: string;
}
