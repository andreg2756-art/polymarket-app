// /lib/stocks/dataConfidence.ts
// Weighted confidence score — high-importance fields count more than low-importance ones.

import type { EnhancedStockScore } from "./types";
import type { ShortInterestResult } from "./shortInterest";

export interface DataConfidenceResult {
  confidencePct: number;   // 0–100
  score: number;           // alias for confidencePct (backwards compat)
  availableCount: number;
  totalFactors: number;
  level: "High" | "Medium" | "Low";
  label: "High" | "Medium" | "Low"; // alias for level
  color: string;
  availableFactors: string[];
  missingFactors: string[];
}

// Weight tiers:
//   high   = 3  (market cap, revenue growth, cash/debt)
//   medium = 2  (float, ownership, earnings date, RS rank)
//   low    = 1  (short interest, news sentiment, moving averages)
interface WeightedFactor {
  name: string;
  available: boolean;
  weight: 1 | 2 | 3;
}

function isAvailable(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && (value === "N/A" || value === "" || value.startsWith("N/A"))) return false;
  if (typeof value === "number" && value === 0) return false;
  return true;
}

export function computeDataConfidence(
  score: EnhancedStockScore,
  shortInterest: ShortInterestResult | null,
  marketCap: number | null,
  // Optional supplemental fields for cash/debt/ownership confidence
  suppAvailable?: {
    cash?: boolean;
    totalDebt?: boolean;
    insiderOwnership?: boolean;
    institutionalOwnership?: boolean;
  }
): DataConfidenceResult {
  const factors: WeightedFactor[] = [
    // High importance
    { name: "Market Cap",       available: isAvailable(marketCap),                         weight: 3 },
    { name: "Revenue Growth",   available: isAvailable(score.revenueGrowthScore?.value),   weight: 3 },
    { name: "Cash / Debt",      available: suppAvailable?.cash === true || suppAvailable?.totalDebt === true, weight: 3 },
    // Medium importance
    { name: "Float",            available: isAvailable(score.volumeScore?.score),           weight: 2 },
    { name: "Earnings Date",    available: isAvailable(score.earningsRiskScore?.value),     weight: 2 },
    { name: "RS Rank",          available: isAvailable(score.rsRank?.score),                weight: 2 },
    { name: "Ownership",        available: suppAvailable?.insiderOwnership === true || suppAvailable?.institutionalOwnership === true, weight: 2 },
    { name: "Risk Quality",     available: isAvailable(score.riskQualityScore?.score),      weight: 2 },
    // Low-medium importance
    { name: "Short Interest",   available: shortInterest?.available === true && shortInterest?.isStale !== true, weight: 1 },
    { name: "News Sentiment",   available: isAvailable(score.newsSentiment?.score),         weight: 1 },
    { name: "Moving Averages",  available: isAvailable(score.volatilityScore?.score),       weight: 1 },
  ];

  const totalWeight     = factors.reduce((s, f) => s + f.weight, 0);
  const availableWeight = factors.filter((f) => f.available).reduce((s, f) => s + f.weight, 0);
  const pct = Math.round((availableWeight / totalWeight) * 100);

  const available = factors.filter((f) => f.available);
  const missing   = factors.filter((f) => !f.available);

  let label: DataConfidenceResult["label"] = "Low";
  let color = "text-red-400";
  if (pct >= 75) { label = "High";   color = "text-emerald-400"; }
  else if (pct >= 45) { label = "Medium"; color = "text-yellow-400"; }

  return {
    confidencePct: pct,
    score: pct,
    availableCount: available.length,
    totalFactors: factors.length,
    level: label,
    label,
    color,
    availableFactors: available.map((f) => f.name),
    missingFactors: missing.map((f) => f.name),
  };
}
