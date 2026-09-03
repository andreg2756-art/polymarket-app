// EventImportanceScore + disposition (spec Parts 7, 14). The formula
// itself is a plain weighted sum — all the actual judgment lives in the
// component calculators (materiality.ts, market-quality.ts, etc.); this
// file only combines them and applies the disposition thresholds.

import type { MarketDisposition, MarketFamily } from "./types";
import { MARKET_IMPORTANCE_WEIGHTS, MARKET_IMPORTANCE_THRESHOLDS } from "./config";

export interface ImportanceComponents {
  economicMateriality: number;
  marketQuality: number;
  exposureBreadth: number;
  transmissionClarity: number;
  resolutionQuality: number;
  timeRelevance: number;
}

export function calculateEventImportanceScore(c: ImportanceComponents): number {
  const w = MARKET_IMPORTANCE_WEIGHTS;
  return (
    100 *
    (w.economicMateriality * c.economicMateriality +
      w.marketQuality * c.marketQuality +
      w.exposureBreadth * c.exposureBreadth +
      w.transmissionClarity * c.transmissionClarity +
      w.resolutionQuality * c.resolutionQuality +
      w.timeRelevance * c.timeRelevance)
  );
}

/**
 * IRRELEVANT and DIRECT_MARKET_SENTIMENT are forced to IGNORE regardless
 * of score — not just "usually score low." DIRECT_MARKET_SENTIMENT
 * markets in particular have a genuinely high ResolutionQuality (price
 * thresholds are perfectly objective) and can have high MarketQuality
 * (a heavily-traded Bitcoin price market), which without this override
 * could otherwise climb into WATCH purely on those two terms — exactly
 * the "volume overriding economic relevance" failure spec Part 28 warns
 * against, and exactly why these two families need an explicit floor
 * rather than relying on their zeroed materiality/breadth/transmission
 * terms to always pull the blended score down far enough on their own.
 */
export function classifyDisposition(score: number, family: MarketFamily): MarketDisposition {
  if (family === "IRRELEVANT" || family === "DIRECT_MARKET_SENTIMENT") return "IGNORE";
  const t = MARKET_IMPORTANCE_THRESHOLDS;
  if (score >= t.core) return "CORE";
  if (score >= t.important) return "IMPORTANT";
  if (score >= t.conditional) return "CONDITIONAL";
  if (score >= t.watch) return "WATCH";
  return "IGNORE";
}

/** Spec Part 15 — a CONDITIONAL market can still be let into ONE company's Catalyst system when that company's own exposure is unusually strong, without promoting the event globally. */
export function allowConditionalStockCatalyst(
  disposition: MarketDisposition,
  companyExposureStrength: number,
  relationshipConfidence: number,
  rule: { minimumExposureStrength: number; minimumRelationshipConfidence: number }
): boolean {
  if (disposition !== "CONDITIONAL") return disposition === "CORE" || disposition === "IMPORTANT";
  return companyExposureStrength >= rule.minimumExposureStrength && relationshipConfidence >= rule.minimumRelationshipConfidence;
}
