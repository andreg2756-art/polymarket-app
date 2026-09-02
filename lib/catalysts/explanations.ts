// Deterministic reason/risk generation — spec Part 28: the score must be
// reproducible, so prose is built FROM the already-computed numbers via
// templates, never asked of an LLM after the fact. This app has no LLM
// wiring at all right now (the one unused `openai` dependency was removed
// earlier), so there's no "optional LLM polish" step here either — plain
// templates only, which is actually the stricter reading of Part 28 that
// avoids the failure mode it warns about (Market title -> LLM -> score).

import type { EconomicFactor } from "./factor-taxonomy";

export interface ReasonInputs {
  ticker: string;
  factor: EconomicFactor | null; // null for a direct (non-factor-mediated) company exposure
  exposure: number; // -1..1, or the direct outcome impact scale if factor is null
  relationshipConfidence: number; // 0-1
  currentExpectedImpact: number;
  deltaExpectedImpact: number | null;
  rationale: string;
}

function factorLabel(factor: EconomicFactor): string {
  return factor.toLowerCase().replace(/_/g, " ");
}

export function buildReasons(inputs: ReasonInputs): string[] {
  const reasons: string[] = [];

  reasons.push(inputs.rationale);

  if (inputs.factor) {
    const direction = inputs.exposure > 0 ? "positive" : inputs.exposure < 0 ? "negative" : "negligible";
    reasons.push(
      `${inputs.ticker} has an estimated ${direction} exposure (${inputs.exposure.toFixed(2)}) to ${factorLabel(inputs.factor)}.`
    );
  }

  reasons.push(
    `Current probability-weighted expected impact: ${inputs.currentExpectedImpact >= 0 ? "+" : ""}${inputs.currentExpectedImpact.toFixed(2)} (on a -5 to +5 scale).`
  );

  if (inputs.deltaExpectedImpact !== null) {
    const changeDirection = inputs.deltaExpectedImpact > 0 ? "increased" : inputs.deltaExpectedImpact < 0 ? "decreased" : "held steady";
    reasons.push(
      `Expected impact has ${changeDirection} by ${Math.abs(inputs.deltaExpectedImpact).toFixed(2)} since the available comparison period.`
    );
  }

  return reasons;
}

export interface RiskInputs {
  relationshipConfidence: number; // 0-1
  marketQuality: number; // 0-1
  hasHistory: boolean;
  matchedFactorCount: number;
}

export function buildRisks(inputs: RiskInputs): string[] {
  const risks: string[] = [];

  if (inputs.relationshipConfidence < 0.60) {
    risks.push("The relationship between this event and this company is plausible but indirect — treat the magnitude with extra skepticism.");
  }
  if (inputs.marketQuality < 0.5) {
    risks.push("This market has relatively thin liquidity/volume — its price may not fully reflect informed positioning.");
  }
  if (!inputs.hasHistory) {
    risks.push("No prior snapshot exists yet, so this reflects current probability only — not a confirmed trend.");
  }
  if (inputs.matchedFactorCount === 0) {
    risks.push("No matching factor exposure was found for this outcome — impact defaulted to zero for this component.");
  }

  return risks;
}
