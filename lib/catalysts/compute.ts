// Orchestrates the full CATALYST_V1 pipeline for one theme: live prices ->
// normalized outcome probabilities -> per-stock expected impact -> raw
// signal -> normalized score -> confidence -> classification (with
// no-signal suppression) -> deterministic reasons/risks. This is the only
// place these pieces get wired together — every individual formula lives
// in its own module (market-quality.ts, expected-impact.ts, scoring.ts,
// etc.) per the spec's "don't scatter formulas" instruction.

import type { CatalystTheme } from "./themes";
import type { LiveMarketPrice } from "./polymarket";
import type { StockCatalystSignal, PredictionEvent } from "./event-types";
import { FORMULA_VERSION } from "./event-types";
import { FACTOR_TO_GROUP } from "./factor-taxonomy";
import { normalizeOutcomeProbabilities } from "./probability";
import { calculateCompanyOutcomeImpact, calculateExpectedImpact, type OutcomeProbabilityImpact } from "./expected-impact";
import { calculateMarketQuality, MIN_MARKET_QUALITY_FOR_SIGNAL } from "./market-quality";
import { calculateTimeWeight, daysBetween } from "./time-weight";
import { calculateCatalystConfidence, classifyConfidence } from "./confidence";
import { calculateRawSignal, normalizeScore, classifyScore, checkNoSignalSuppression } from "./scoring";
import { buildReasons, buildRisks } from "./explanations";
import type { GroupableSignal } from "./aggregation";

export interface ComputedOutcome {
  id: string;
  label: string;
  conditionId: string;
  probabilityRaw: number; // before cross-outcome normalization
  probabilityNormalized: number;
}

export interface ComputedEvent {
  slug: string;
  title: string;
  resolutionDate: string;
  materiality: number;
  marketQuality: number;
  outcomes: ComputedOutcome[];
  contextMarkets: { conditionId: string; label: string; live: LiveMarketPrice | null }[];
}

export interface ThemeComputation {
  theme: CatalystTheme;
  event: ComputedEvent;
  signals: StockCatalystSignal[];
}

/** Resolves each outcome's live probability and normalizes across the event's outcome set (spec Part 1). */
function computeEventOutcomes(event: PredictionEvent, prices: Map<string, LiveMarketPrice>): ComputedOutcome[] {
  const raw = event.outcomes.map((o) => {
    const live = prices.get(o.conditionId);
    const p = live?.prices?.[o.outcomeIndex];
    return { id: o.id, label: o.label, conditionId: o.conditionId, probabilityRaw: typeof p === "number" ? p : 0 };
  });
  const normalized = normalizeOutcomeProbabilities(raw.map((r) => r.probabilityRaw));
  return raw.map((r, i) => ({ ...r, probabilityNormalized: normalized[i] }));
}

/** Aggregate market quality across the event's outcomes' underlying markets — an event spanning several markets (like the jobs report) is only as trustworthy as its component markets, averaged. */
function computeEventMarketQuality(event: PredictionEvent, prices: Map<string, LiveMarketPrice>): number {
  const uniqueConditionIds = Array.from(new Set(event.outcomes.map((o) => o.conditionId)));
  const qualities = uniqueConditionIds.map((cid) => {
    const live = prices.get(cid);
    return calculateMarketQuality({ liquidity: live?.liquidity ?? null, volume24hr: live?.volume24hr ?? null });
  });
  if (qualities.length === 0) return 0;
  return qualities.reduce((a, b) => a + b, 0) / qualities.length;
}

export function computeTheme(theme: CatalystTheme, prices: Map<string, LiveMarketPrice>, now: Date = new Date()): ThemeComputation {
  const outcomes = computeEventOutcomes(theme.event, prices);
  const marketQuality = computeEventMarketQuality(theme.event, prices);
  const timeWeight = calculateTimeWeight(daysBetween(now.toISOString(), theme.event.resolutionDate));

  const signals: StockCatalystSignal[] = [];

  if (theme.factorExposures) {
    const byTicker = new Map<string, typeof theme.factorExposures>();
    for (const exp of theme.factorExposures) {
      if (!byTicker.has(exp.ticker)) byTicker.set(exp.ticker, []);
      byTicker.get(exp.ticker)!.push(exp);
    }

    for (const [ticker, exposures] of byTicker) {
      const outcomeImpacts: OutcomeProbabilityImpact[] = [];
      let totalMatchedFactors = 0;
      let mappingConfidenceSum = 0;
      let mappingConfidenceCount = 0;

      for (let i = 0; i < theme.event.outcomes.length; i++) {
        const outcome = theme.event.outcomes[i];
        const { impact, matchedFactors } = calculateCompanyOutcomeImpact(outcome, exposures);
        totalMatchedFactors += matchedFactors;
        for (const fi of outcome.factorImpacts) {
          if (exposures.some((e) => e.factor === fi.factor)) {
            mappingConfidenceSum += fi.confidence;
            mappingConfidenceCount++;
          }
        }
        outcomeImpacts.push({ outcomeId: outcome.id, probability: outcomes[i].probabilityNormalized, companyImpact: impact });
      }

      const relationshipConfidence = exposures.reduce((s, e) => s + e.confidence, 0) / exposures.length;
      const outcomeMappingConfidence = mappingConfidenceCount > 0 ? mappingConfidenceSum / mappingConfidenceCount : 0;
      const rationale = exposures.map((e) => e.rationale).join(" ");
      const primaryFactor = exposures[0]?.factor ?? null;
      const primaryExposure = exposures[0]?.exposure ?? 0;

      signals.push(
        buildSignal({
          ticker,
          eventSlug: theme.event.slug,
          outcomeImpacts,
          eventMateriality: theme.event.materiality,
          marketQuality,
          relationshipConfidence,
          outcomeMappingConfidence,
          timeWeight,
          dataCompleteness: computeDataCompleteness({ marketQuality, outcomes, matchedFactors: totalMatchedFactors }),
          reasonInputs: { ticker, factor: primaryFactor, exposure: primaryExposure, relationshipConfidence, rationale },
          riskInputs: { relationshipConfidence, marketQuality, hasHistory: false, matchedFactorCount: totalMatchedFactors },
        })
      );
    }
  }

  if (theme.directExposures) {
    for (const exp of theme.directExposures) {
      const outcomeImpacts: OutcomeProbabilityImpact[] = theme.event.outcomes.map((outcome, i) => ({
        outcomeId: outcome.id,
        probability: outcomes[i].probabilityNormalized,
        companyImpact: exp.outcomeImpacts[outcome.id] ?? 0,
      }));

      signals.push(
        buildSignal({
          ticker: exp.ticker,
          eventSlug: theme.event.slug,
          outcomeImpacts,
          eventMateriality: theme.event.materiality,
          marketQuality,
          relationshipConfidence: exp.confidence,
          outcomeMappingConfidence: 1.0, // direct impact — no factor-mapping ambiguity layer to score separately
          timeWeight,
          dataCompleteness: computeDataCompleteness({ marketQuality, outcomes, matchedFactors: 1 }),
          reasonInputs: { ticker: exp.ticker, factor: null, exposure: 0, relationshipConfidence: exp.confidence, rationale: exp.rationale },
          riskInputs: { relationshipConfidence: exp.confidence, marketQuality, hasHistory: false, matchedFactorCount: 1 },
        })
      );
    }
  }

  return {
    theme,
    event: {
      slug: theme.event.slug,
      title: theme.event.title,
      resolutionDate: theme.event.resolutionDate,
      materiality: theme.event.materiality,
      marketQuality,
      outcomes,
      contextMarkets: (theme.event.contextMarkets ?? []).map((m) => ({ ...m, live: prices.get(m.conditionId) ?? null })),
    },
    signals,
  };

  function computeDataCompleteness(args: { marketQuality: number; outcomes: ComputedOutcome[]; matchedFactors: number }): number {
    const checks = [
      args.marketQuality > 0,
      args.outcomes.every((o) => o.probabilityRaw > 0 || o.probabilityNormalized === 0),
      args.matchedFactors > 0,
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  function buildSignal(args: {
    ticker: string;
    eventSlug: string;
    outcomeImpacts: OutcomeProbabilityImpact[];
    eventMateriality: number;
    marketQuality: number;
    relationshipConfidence: number;
    outcomeMappingConfidence: number;
    timeWeight: number;
    dataCompleteness: number;
    reasonInputs: { ticker: string; factor: import("./factor-taxonomy").EconomicFactor | null; exposure: number; relationshipConfidence: number; rationale: string };
    riskInputs: { relationshipConfidence: number; marketQuality: number; hasHistory: boolean; matchedFactorCount: number };
  }): StockCatalystSignal {
    const currentExpectedImpact = calculateExpectedImpact(args.outcomeImpacts);
    // No probability-snapshot history exists yet (see this feature's
    // implementation notes) — previous/delta are null, never fabricated
    // zeros, per spec Parts 2/13's explicit invariant.
    const previousExpectedImpact = null;
    const deltaExpectedImpact = null;

    const currentOutlookRaw = calculateRawSignal({
      expectedImpactOrMomentum: currentExpectedImpact,
      eventMateriality: args.eventMateriality,
      marketQuality: args.marketQuality,
      relationshipConfidence: args.relationshipConfidence,
      timeWeight: args.timeWeight,
    });
    const currentOutlookScore = normalizeScore(currentOutlookRaw);
    const catalystChangeRaw = null;
    const catalystChangeScore = null;

    const confidence = calculateCatalystConfidence({
      dataCompleteness: args.dataCompleteness,
      marketQuality: args.marketQuality,
      relationshipConfidence: args.relationshipConfidence,
      outcomeMappingConfidence: args.outcomeMappingConfidence,
    });

    const suppression = checkNoSignalSuppression({
      relationshipConfidence: args.relationshipConfidence,
      marketQuality: args.marketQuality,
      eventMateriality: args.eventMateriality,
      normalizedScoreAbs: Math.abs(currentOutlookScore),
      confidence0to100: confidence,
    });
    const classification = suppression ?? classifyScore(currentOutlookScore);

    return {
      ticker: args.ticker,
      eventSlug: args.eventSlug,
      formulaVersion: FORMULA_VERSION,
      currentExpectedImpact,
      previousExpectedImpact,
      deltaExpectedImpact,
      eventMateriality: args.eventMateriality,
      marketQuality: args.marketQuality,
      relationshipConfidence: args.relationshipConfidence,
      timeWeight: args.timeWeight,
      currentOutlookRaw,
      catalystChangeRaw,
      currentOutlookScore,
      catalystChangeScore,
      confidence,
      classification,
      reasons: buildReasons({
        ticker: args.reasonInputs.ticker,
        factor: args.reasonInputs.factor,
        exposure: args.reasonInputs.exposure,
        relationshipConfidence: args.reasonInputs.relationshipConfidence,
        currentExpectedImpact,
        deltaExpectedImpact,
        rationale: args.reasonInputs.rationale,
      }),
      risks: buildRisks(args.riskInputs),
    };
  }
}

export function toGroupableSignal(signal: StockCatalystSignal, factor: import("./factor-taxonomy").EconomicFactor | "COMPANY_SPECIFIC"): GroupableSignal {
  return {
    eventSlug: signal.eventSlug,
    factorGroup: factor === "COMPANY_SPECIFIC" ? "COMPANY_SPECIFIC" : FACTOR_TO_GROUP[factor],
    score: signal.currentOutlookScore,
    confidence: signal.confidence,
  };
}

export { classifyConfidence, MIN_MARKET_QUALITY_FOR_SIGNAL };
