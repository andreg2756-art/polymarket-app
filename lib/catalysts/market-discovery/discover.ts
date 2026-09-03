// Phase 7 — automated scanning of active Polymarket events, and the
// orchestrator that runs one candidate through the full pipeline (spec's
// candidate flow: normalize -> hard-reject -> economic relevance ->
// family -> importance -> disposition). Uses the Gamma API's /events
// endpoint rather than /markets: confirmed live (2026-09-03) that /events
// carries a `tags` array (fomc, fed-rates, sports, etc.) that /markets
// does not, and tags are the primary signal hard-reject and family
// classification run on.

import { MARKET_IMPORTANCE_FORMULA_VERSION } from "./types";
import type { EvaluatedPredictionMarket, RawMarketCandidate } from "./types";
import { evaluateHardReject, isDirectMarketSentiment } from "./hard-reject";
import { classifyMarketFamily } from "./family-classification";
import { classifyEconomicRelevance } from "./economic-relevance";
import { calculateEconomicMateriality } from "./materiality";
import { calculateExposureBreadth } from "./exposure-breadth";
import { calculateTransmissionClarity } from "./transmission-clarity";
import { calculateResolutionQuality } from "./resolution-quality";
import { marketQualityFromCandidate } from "./market-quality";
import { calculateTimeRelevance } from "./time-relevance";
import { calculateEventImportanceScore, classifyDisposition } from "./importance-score";
import { findOverride } from "./overrides";

const EVENTS_URL = "https://gamma-api.polymarket.com/events";
const PAGE_SIZE = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchEventsPage(offset: number): Promise<any[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    order: "volume24hr",
    ascending: "false",
  });
  const res = await fetch(`${EVENTS_URL}?${params}`, {
    next: { revalidate: 300 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function safeParseArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEvent(event: any): RawMarketCandidate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markets: any[] = Array.isArray(event.markets) ? event.markets : [];
  const spreads = markets.map((m) => (typeof m.spread === "number" ? m.spread : null)).filter((s): s is number => s !== null);
  const primaryMarket = markets.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (best: any, m: any) => ((m.volume24hr ?? 0) > (best?.volume24hr ?? -1) ? m : best),
    null
  );
  let primaryProbability: number | null = null;
  if (primaryMarket) {
    const prices = safeParseArray(primaryMarket.outcomePrices).map(Number);
    if (prices.length > 0 && Number.isFinite(prices[0])) primaryProbability = prices[0];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags: string[] = Array.isArray(event.tags) ? event.tags.map((t: any) => String(t.slug ?? "").toLowerCase()).filter(Boolean) : [];

  return {
    eventId: String(event.id ?? ""),
    eventSlug: String(event.slug ?? ""),
    title: String(event.title ?? ""),
    description: String(event.description ?? ""),
    tags,
    endDate: event.endDate ?? null,
    createdAt: event.createdAt ?? null,
    volume24hr: typeof event.volume24hr === "number" ? event.volume24hr : 0,
    liquidity: typeof event.liquidity === "number" ? event.liquidity : null,
    spread: spreads.length > 0 ? Math.min(...spreads) : null,
    marketCount: markets.length,
    primaryConditionId: primaryMarket?.conditionId ?? null,
    primaryProbability,
  };
}

/** Fetches up to maxEvents active events, ordered by 24h volume descending, paginating the Gamma API. Bounded rather than truly "every market that has ever existed" — the spec's own goal is "the subset that's economically meaningful," and volume-descending pagination means anything worth finding is reached long before the tail of near-zero-volume markets that would otherwise make this unbounded. */
export async function fetchActiveMarketCandidates(maxEvents = 500): Promise<RawMarketCandidate[]> {
  const candidates: RawMarketCandidate[] = [];
  let offset = 0;
  while (candidates.length < maxEvents) {
    const page = await fetchEventsPage(offset);
    if (page.length === 0) break;
    candidates.push(...page.map(normalizeEvent));
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return candidates.slice(0, maxEvents);
}

export function evaluateMarketCandidate(candidate: RawMarketCandidate, now: Date = new Date()): EvaluatedPredictionMarket {
  const evaluatedAt = now.toISOString();
  const override = findOverride(candidate);

  if (override.reject) {
    return buildResult(candidate, "IRRELEVANT", undefined, "IGNORE", [], [override.reason ?? "Manually overridden: rejected"], evaluatedAt, 0);
  }

  const hardReject = evaluateHardReject(candidate);
  if (hardReject.rejected) {
    return buildResult(candidate, "IRRELEVANT", undefined, "IGNORE", [], hardReject.reasons, evaluatedAt, 0);
  }

  if (isDirectMarketSentiment(candidate)) {
    return buildResult(
      candidate,
      "DIRECT_MARKET_SENTIMENT",
      undefined,
      "IGNORE",
      ["Direct stock/crypto price-target market — stored for reference, excluded from the Catalyst pipeline to avoid circular prediction -> catalyst -> same-asset logic (spec Part 21)."],
      [],
      evaluatedAt,
      0
    );
  }

  const classification = override.forcedFamily
    ? { family: override.forcedFamily, subfamily: undefined, matchedRule: "override" }
    : classifyMarketFamily(candidate);
  const family = classification.family;

  const economicMateriality = override.forcedEconomicMateriality ?? calculateEconomicMateriality(family, candidate);
  const marketQuality = marketQualityFromCandidate(candidate);
  const exposureBreadth = calculateExposureBreadth(family, candidate);
  const transmissionClarity = calculateTransmissionClarity(family);
  const resolutionQuality = calculateResolutionQuality(family, candidate);
  const timeRelevance = calculateTimeRelevance(now, candidate.endDate);

  const eventImportanceScore = calculateEventImportanceScore({
    economicMateriality,
    marketQuality,
    exposureBreadth,
    transmissionClarity,
    resolutionQuality,
    timeRelevance,
  });

  const economicRelevance = classifyEconomicRelevance(family, economicMateriality, transmissionClarity);
  const disposition = override.forcedDisposition ?? classifyDisposition(eventImportanceScore, family);

  const reasons = [
    `Family: ${family}${classification.subfamily ? ` / ${classification.subfamily}` : ""} (matched ${classification.matchedRule})`,
    `Economic Materiality ${economicMateriality.toFixed(2)}, Market Quality ${marketQuality.toFixed(2)}, Exposure Breadth ${exposureBreadth.toFixed(2)}`,
    `Transmission Clarity ${transmissionClarity.toFixed(2)}, Resolution Quality ${resolutionQuality.toFixed(2)}, Time Relevance ${timeRelevance.toFixed(2)}`,
  ];
  if (override.reason) reasons.push(`Override applied: ${override.reason}`);

  return {
    eventId: candidate.eventId,
    eventSlug: candidate.eventSlug,
    title: candidate.title,
    marketFamily: family,
    subfamily: classification.subfamily,
    economicRelevance,
    economicMateriality,
    marketQuality,
    exposureBreadth,
    transmissionClarity,
    resolutionQuality,
    timeRelevance,
    eventImportanceScore,
    probabilityCurrent: candidate.primaryProbability,
    probability1D: null,
    probability7D: null,
    delta1D: null,
    delta7D: null,
    movementScore: null,
    marketUrgency: null,
    disposition,
    reasons,
    formulaVersion: MARKET_IMPORTANCE_FORMULA_VERSION,
    evaluatedAt,
  };
}

function buildResult(
  candidate: RawMarketCandidate,
  family: EvaluatedPredictionMarket["marketFamily"],
  subfamily: string | undefined,
  disposition: EvaluatedPredictionMarket["disposition"],
  reasons: string[],
  rejectionReasons: string[],
  evaluatedAt: string,
  score: number
): EvaluatedPredictionMarket {
  return {
    eventId: candidate.eventId,
    eventSlug: candidate.eventSlug,
    title: candidate.title,
    marketFamily: family,
    subfamily,
    economicRelevance: "NONE",
    economicMateriality: 0,
    marketQuality: marketQualityFromCandidate(candidate),
    exposureBreadth: 0,
    transmissionClarity: 0,
    resolutionQuality: 0,
    timeRelevance: 0,
    eventImportanceScore: score,
    probabilityCurrent: candidate.primaryProbability,
    probability1D: null,
    probability7D: null,
    delta1D: null,
    delta7D: null,
    movementScore: null,
    marketUrgency: null,
    disposition,
    reasons,
    rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons : undefined,
    formulaVersion: MARKET_IMPORTANCE_FORMULA_VERSION,
    evaluatedAt,
  };
}

export async function runMarketDiscovery(maxEvents = 500, now: Date = new Date()): Promise<EvaluatedPredictionMarket[]> {
  const candidates = await fetchActiveMarketCandidates(maxEvents);
  return candidates.map((c) => evaluateMarketCandidate(c, now));
}
