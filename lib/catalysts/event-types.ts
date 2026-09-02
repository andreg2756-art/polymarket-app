// Core data structures for the catalyst engine (CATALYST_V1). Kept
// separate from computation (see scoring.ts, expected-impact.ts, etc.) so
// the domain model doesn't get tangled with formula code — per the spec's
// Part 30 instruction to centralize scoring logic rather than scatter it.

import type { EconomicFactor } from "./factor-taxonomy";

export const FORMULA_VERSION = "CATALYST_V1";

/** One outcome of a mutually-exclusive outcome set for a prediction event. */
export interface EventOutcome {
  id: string;
  label: string;
  conditionId: string; // Polymarket conditionId this outcome's probability comes from
  outcomeIndex: number; // which price in that market's outcomes[]/prices[] array is "this outcome is true"
  /** Impact on the mapped factor(s) if this specific outcome occurs, -5..+5. */
  factorImpacts: FactorImpact[];
}

export interface FactorImpact {
  factor: EconomicFactor;
  impact: number; // -5 to +5
  confidence: number; // 0-1, confidence in the outcome->factor mapping itself (spec's OutcomeMappingConfidence)
}

/**
 * A prediction-market event: a set of MUTUALLY EXCLUSIVE outcomes whose
 * probabilities should sum to ~1.0. Do not construct one of these from
 * markets that aren't actually mutually exclusive (e.g. "cut by Sept
 * meeting" and "hike sometime in 2026" describe overlapping, not
 * exclusive, scenarios) — see themes.ts's per-event comments for how each
 * one was actually verified.
 */
export interface PredictionEvent {
  slug: string;
  title: string;
  category: string;
  resolutionDate: string; // ISO date
  /** 0-1, how much this event matters if it resolves as expected — see market-quality.ts for the market-liquidity notion, this is about event significance instead. */
  materiality: number;
  outcomes: EventOutcome[];
  /** Supplementary markets shown for context but NOT fed into the mutually-exclusive outcome set (e.g. a same-topic but non-exclusive market). */
  contextMarkets?: { conditionId: string; label: string }[];
}

/** A stock's exposure to one economic factor — defined once, reused across every event that touches that factor. */
export interface StockFactorExposure {
  ticker: string;
  name: string;
  factor: EconomicFactor;
  exposure: number; // -1.0 to +1.0
  confidence: number; // 0-1, RelationshipConfidence — "how sure are we this factor actually matters to this company"
  rationale: string;
}

/** A single company's exposure to one event's outcome, resolved via factor exposures at compute time (see aggregation.ts). Used for events that don't map cleanly to a shared macro factor (e.g. a single-company IPO) — direct company-level impact instead of factor-mediated. */
export interface DirectCompanyExposure {
  ticker: string;
  name: string;
  outcomeImpacts: Record<string /* EventOutcome.id */, number>; // -5..+5 per outcome, applied directly (no factor layer)
  confidence: number; // 0-1
  rationale: string;
}

export type Classification =
  | "VERY_BEARISH"
  | "BEARISH"
  | "SLIGHTLY_BEARISH"
  | "NEUTRAL"
  | "SLIGHTLY_BULLISH"
  | "BULLISH"
  | "VERY_BULLISH"
  | "LOW_CONFIDENCE"
  | "NO_SIGNAL";

/** Fully computed, stored-raw-values signal for one ticker x one event — see Part 31 ("store raw values", not just the final score). */
export interface StockCatalystSignal {
  ticker: string;
  eventSlug: string;
  formulaVersion: string;

  currentExpectedImpact: number;
  previousExpectedImpact: number | null; // null, never 0, when no history exists yet

  deltaExpectedImpact: number | null;

  eventMateriality: number;
  marketQuality: number;
  relationshipConfidence: number;
  timeWeight: number;

  currentOutlookRaw: number;
  catalystChangeRaw: number | null;

  currentOutlookScore: number; // normalized -100..100
  catalystChangeScore: number | null; // normalized -100..100, null if no history yet

  confidence: number; // 0-100
  classification: Classification;

  reasons: string[];
  risks: string[];
}
