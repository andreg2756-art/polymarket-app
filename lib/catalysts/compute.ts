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
import { normalizeOutcomeProbabilities, calculateProbabilityDeltas } from "./probability";
import { calculateCompanyOutcomeImpact, calculateExpectedImpact, calculateExpectedImpactDeltas, calculateExpectedImpactMomentum, type OutcomeProbabilityImpact } from "./expected-impact";
import { calculateMarketQuality, MIN_MARKET_QUALITY_FOR_SIGNAL } from "./market-quality";
import { calculateTimeWeight, daysBetween } from "./time-weight";
import { calculateCatalystConfidence, classifyConfidence } from "./confidence";
import { calculateRawSignal, normalizeScore, classifyScore, checkNoSignalSuppression } from "./scoring";
import { buildReasons, buildRisks } from "./explanations";
import { getProbabilityHistory, type ProbabilityHistoryLookup } from "./probability-history";
import type { GroupableSignal } from "./aggregation";

export interface ComputedOutcome {
  id: string;
  label: string;
  conditionId: string;
  probabilityRaw: number; // before cross-outcome normalization
  probabilityNormalized: number;
}

/** ComputedOutcome plus probability-point deltas — only available once history has been fetched, so it's a distinct type rather than optional fields on ComputedOutcome. */
export interface ComputedOutcomeWithDeltas extends ComputedOutcome {
  // Percentage-point deltas vs. the closest snapshot in each tolerance
  // window — null (never a fabricated 0) until that snapshot exists.
  probabilityDelta1d: number | null;
  probabilityDelta7d: number | null;
  probabilityDelta30d: number | null;
}

export interface ComputedEvent {
  slug: string;
  title: string;
  resolutionDate: string;
  materiality: number;
  marketQuality: number;
  outcomes: ComputedOutcomeWithDeltas[];
  contextMarkets: { conditionId: string; label: string; live: LiveMarketPrice | null }[];
  // Age in minutes of the oldest snapshot found within tolerance across
  // this event's outcomes, or null if no history exists at all yet (a
  // fresh deploy, before the snapshot cron has run even once).
  oldestSnapshotAgeMinutes: number | null;
}

export interface ThemeComputation {
  theme: CatalystTheme;
  event: ComputedEvent;
  signals: StockCatalystSignal[];
}

/** Resolves each outcome's live probability and normalizes across the event's outcome set (spec Part 1). Exported so the snapshot cron job (app/api/catalysts/snapshot/route.ts) computes probabilities identically to the live page — one implementation, not two that could drift apart. */
export function computeEventOutcomes(event: PredictionEvent, prices: Map<string, LiveMarketPrice>): ComputedOutcome[] {
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

/**
 * For one historical period (1d or 7d ago), returns each outcome's
 * historical probability — or null for the WHOLE period if even one
 * outcome is missing history, rather than silently mixing some historical
 * and some current probabilities into one "expected impact" number. Since
 * every outcome of an event is snapshotted together by the same cron run,
 * partial availability should be rare in practice, but this stays
 * conservative if it happens (a deploy gap, a partial failure, etc.).
 */
function historicalProbabilitiesFor(
  event: PredictionEvent,
  historyByOutcome: Map<string, ProbabilityHistoryLookup>,
  period: "oneDayAgo" | "sevenDayAgo"
): Map<string, number> | null {
  const result = new Map<string, number>();
  for (const outcome of event.outcomes) {
    const p = historyByOutcome.get(outcome.id)?.[period]?.probability;
    if (p === null || p === undefined) return null;
    result.set(outcome.id, p);
  }
  return result;
}

export async function computeTheme(theme: CatalystTheme, prices: Map<string, LiveMarketPrice>, now: Date = new Date()): Promise<ThemeComputation> {
  const outcomes = computeEventOutcomes(theme.event, prices);
  const marketQuality = computeEventMarketQuality(theme.event, prices);
  const timeWeight = calculateTimeWeight(daysBetween(now.toISOString(), theme.event.resolutionDate));

  const historyByOutcome = new Map<string, ProbabilityHistoryLookup>(
    await Promise.all(
      theme.event.outcomes.map(async (o) => [o.id, await getProbabilityHistory(theme.event.slug, o.id, now)] as const)
    )
  );
  const historicalProbs1d = historicalProbabilitiesFor(theme.event, historyByOutcome, "oneDayAgo");
  const historicalProbs7d = historicalProbabilitiesFor(theme.event, historyByOutcome, "sevenDayAgo");
  const hasAnyHistory = historicalProbs1d !== null || historicalProbs7d !== null;

  // Per-outcome probability-point deltas for the event header display
  // (spec: "Current Probability 72%, 1D +4pp, 7D +14pp") — independent of
  // the expected-impact deltas above, which require EVERY outcome to have
  // history; a single outcome's own probability delta only needs its own
  // history to exist.
  const outcomesWithDeltas: ComputedOutcomeWithDeltas[] = outcomes.map((o) => {
    const h = historyByOutcome.get(o.id);
    const deltas = calculateProbabilityDeltas({
      current: o.probabilityNormalized,
      oneDayAgo: h?.oneDayAgo.probability ?? null,
      sevenDayAgo: h?.sevenDayAgo.probability ?? null,
      thirtyDayAgo: h?.thirtyDayAgo.probability ?? null,
    });
    return { ...o, probabilityDelta1d: deltas.delta1d, probabilityDelta7d: deltas.delta7d, probabilityDelta30d: deltas.delta30d };
  });
  // Reported once per event rather than per-outcome — meaningful for the
  // UI's "history since" display. null (not a sentinel number) when no
  // snapshot exists for any outcome yet.
  const snapshotAges = Array.from(historyByOutcome.values())
    .map((h) => h.sevenDayAgo.ageMinutes ?? h.oneDayAgo.ageMinutes)
    .filter((age): age is number => age !== null);
  const oldestSnapshotAgeMinutes = snapshotAges.length > 0 ? Math.max(...snapshotAges) : null;

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
      const companyImpactByOutcome = new Map<string, number>();

      for (let i = 0; i < theme.event.outcomes.length; i++) {
        const outcome = theme.event.outcomes[i];
        const { impact, matchedFactors } = calculateCompanyOutcomeImpact(outcome, exposures);
        totalMatchedFactors += matchedFactors;
        companyImpactByOutcome.set(outcome.id, impact);
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
      const primaryExposureStrength = exposures[0]?.exposureStrength ?? null;
      const primaryDirection = exposures[0]?.direction ?? null;
      const primaryDirectionalConfidence = exposures[0]?.directionalConfidence ?? null;

      signals.push(
        buildSignal({
          ticker,
          eventSlug: theme.event.slug,
          outcomeImpacts,
          companyImpactByOutcome,
          eventMateriality: theme.event.materiality,
          marketQuality,
          relationshipConfidence,
          outcomeMappingConfidence,
          timeWeight,
          dataCompleteness: computeDataCompleteness({ marketQuality, outcomes, matchedFactors: totalMatchedFactors }),
          exposureInfo: { exposureStrength: primaryExposureStrength, direction: primaryDirection, directionalConfidence: primaryDirectionalConfidence },
          reasonInputs: {
            ticker, factor: primaryFactor, relationshipConfidence, rationale,
            exposureStrength: primaryExposureStrength, direction: primaryDirection, directionalConfidence: primaryDirectionalConfidence,
          },
          riskInputs: { relationshipConfidence, marketQuality, hasHistory: hasAnyHistory, matchedFactorCount: totalMatchedFactors, directionalConfidence: primaryDirectionalConfidence },
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
      const companyImpactByOutcome = new Map<string, number>(
        theme.event.outcomes.map((outcome) => [outcome.id, exp.outcomeImpacts[outcome.id] ?? 0])
      );

      signals.push(
        buildSignal({
          ticker: exp.ticker,
          eventSlug: theme.event.slug,
          outcomeImpacts,
          companyImpactByOutcome,
          eventMateriality: theme.event.materiality,
          marketQuality,
          relationshipConfidence: exp.confidence,
          outcomeMappingConfidence: 1.0, // direct impact — no factor-mapping ambiguity layer to score separately
          timeWeight,
          dataCompleteness: computeDataCompleteness({ marketQuality, outcomes, matchedFactors: 1 }),
          exposureInfo: { exposureStrength: null, direction: null, directionalConfidence: null },
          reasonInputs: {
            ticker: exp.ticker, factor: null, relationshipConfidence: exp.confidence, rationale: exp.rationale,
            exposureStrength: null, direction: null, directionalConfidence: null,
          },
          riskInputs: { relationshipConfidence: exp.confidence, marketQuality, hasHistory: hasAnyHistory, matchedFactorCount: 1, directionalConfidence: null },
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
      outcomes: outcomesWithDeltas,
      contextMarkets: (theme.event.contextMarkets ?? []).map((m) => ({ ...m, live: prices.get(m.conditionId) ?? null })),
      oldestSnapshotAgeMinutes,
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

  function expectedImpactAt(companyImpactByOutcome: Map<string, number>, historicalProbs: Map<string, number> | null): number | null {
    if (historicalProbs === null) return null;
    const impacts: OutcomeProbabilityImpact[] = theme.event.outcomes.map((o) => ({
      outcomeId: o.id,
      probability: historicalProbs.get(o.id) ?? 0,
      companyImpact: companyImpactByOutcome.get(o.id) ?? 0,
    }));
    return calculateExpectedImpact(impacts);
  }

  function buildSignal(args: {
    ticker: string;
    eventSlug: string;
    outcomeImpacts: OutcomeProbabilityImpact[];
    companyImpactByOutcome: Map<string, number>;
    eventMateriality: number;
    marketQuality: number;
    relationshipConfidence: number;
    outcomeMappingConfidence: number;
    timeWeight: number;
    dataCompleteness: number;
    exposureInfo: { exposureStrength: number | null; direction: -1 | 1 | null; directionalConfidence: number | null };
    reasonInputs: {
      ticker: string; factor: import("./factor-taxonomy").EconomicFactor | null; relationshipConfidence: number; rationale: string;
      exposureStrength: number | null; direction: -1 | 1 | null; directionalConfidence: number | null;
    };
    riskInputs: { relationshipConfidence: number; marketQuality: number; hasHistory: boolean; matchedFactorCount: number; directionalConfidence: number | null };
  }): StockCatalystSignal {
    const currentExpectedImpact = calculateExpectedImpact(args.outcomeImpacts);

    // Real history if the snapshot cron has accumulated enough of it;
    // null (never a fabricated 0) otherwise — see
    // historicalProbabilitiesFor()'s all-or-nothing-per-period contract.
    const previousExpectedImpact = expectedImpactAt(args.companyImpactByOutcome, historicalProbs1d);
    const expectedImpact7d = expectedImpactAt(args.companyImpactByOutcome, historicalProbs7d);
    const deltas = calculateExpectedImpactDeltas({ current: currentExpectedImpact, oneDayAgo: previousExpectedImpact, sevenDayAgo: expectedImpact7d });
    const momentum = calculateExpectedImpactMomentum(deltas);
    const deltaExpectedImpact = deltas.delta1d; // stored field is the headline 1D delta; momentum blends 1D+7D for the change score below

    const currentOutlookRaw = calculateRawSignal({
      expectedImpactOrMomentum: currentExpectedImpact,
      eventMateriality: args.eventMateriality,
      marketQuality: args.marketQuality,
      relationshipConfidence: args.relationshipConfidence,
      timeWeight: args.timeWeight,
    });
    const currentOutlookScore = normalizeScore(currentOutlookRaw);

    const catalystChangeRaw = momentum === null ? null : calculateRawSignal({
      expectedImpactOrMomentum: momentum,
      eventMateriality: args.eventMateriality,
      marketQuality: args.marketQuality,
      relationshipConfidence: args.relationshipConfidence,
      timeWeight: args.timeWeight,
    });
    const catalystChangeScore = catalystChangeRaw === null ? null : normalizeScore(catalystChangeRaw);

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
      expectedImpact7d,
      deltaExpectedImpact,
      deltaExpectedImpact7d: deltas.delta7d,
      expectedImpactMomentum: momentum,
      eventMateriality: args.eventMateriality,
      marketQuality: args.marketQuality,
      relationshipConfidence: args.relationshipConfidence,
      timeWeight: args.timeWeight,
      primaryExposureStrength: args.exposureInfo.exposureStrength,
      primaryDirection: args.exposureInfo.direction,
      primaryDirectionalConfidence: args.exposureInfo.directionalConfidence,
      currentOutlookRaw,
      catalystChangeRaw,
      currentOutlookScore,
      catalystChangeScore,
      confidence,
      classification,
      reasons: buildReasons({
        ticker: args.reasonInputs.ticker,
        factor: args.reasonInputs.factor,
        exposureStrength: args.reasonInputs.exposureStrength,
        direction: args.reasonInputs.direction,
        directionalConfidence: args.reasonInputs.directionalConfidence,
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
