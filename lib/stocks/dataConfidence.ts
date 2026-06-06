// /lib/stocks/dataConfidence.ts
// Confidence V3 — category-based percentage weights.
// Missing categories reduce confidence proportionally to their weight.

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

// Category weights (sum = 100)
// Price/Volume = 20, Revenue = 15, Earnings = 15, Balance Sheet = 15,
// Ownership = 10, Float = 10, News = 10, Short Interest = 5
interface Category {
  name: string;
  available: boolean;
  weight: number; // percentage points (0–100 scale)
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
  suppAvailable?: {
    cash?: boolean;
    totalDebt?: boolean;
    insiderOwnership?: boolean;
    institutionalOwnership?: boolean;
  }
): DataConfidenceResult {
  const cats: Category[] = [
    // Price / Volume (20%) — available whenever we have a score
    {
      name:      "Price / Volume",
      available: isAvailable(score.volumeScore?.score) && isAvailable(marketCap),
      weight:    20,
    },
    // Revenue (15%)
    {
      name:      "Revenue",
      available: isAvailable(score.revenueGrowthScore?.value),
      weight:    15,
    },
    // Earnings (15%)
    {
      name:      "Earnings",
      available: isAvailable(score.earningsRiskScore?.value),
      weight:    15,
    },
    // Balance Sheet (15%)
    {
      name:      "Balance Sheet",
      available: suppAvailable?.cash === true || suppAvailable?.totalDebt === true,
      weight:    15,
    },
    // Ownership (10%)
    {
      name:      "Ownership",
      available: suppAvailable?.insiderOwnership === true || suppAvailable?.institutionalOwnership === true,
      weight:    10,
    },
    // Float (10%)
    {
      name:      "Float",
      available: isAvailable(score.riskQualityScore?.score),
      weight:    10,
    },
    // News (10%)
    {
      name:      "News Sentiment",
      available: isAvailable(score.newsSentiment?.score),
      weight:    10,
    },
    // Short Interest (5%)
    {
      name:      "Short Interest",
      available: shortInterest?.available === true && shortInterest?.isStale !== true,
      weight:    5,
    },
  ];

  const availableWeight = cats.filter((c) => c.available).reduce((s, c) => s + c.weight, 0);
  const pct = Math.round(availableWeight); // weights already sum to 100

  const available = cats.filter((c) => c.available);
  const missing   = cats.filter((c) => !c.available);

  let label: DataConfidenceResult["label"] = "Low";
  let color = "text-red-400";
  if (pct >= 75) { label = "High";   color = "text-emerald-400"; }
  else if (pct >= 50) { label = "Medium"; color = "text-yellow-400"; }

  return {
    confidencePct: pct,
    score: pct,
    availableCount: available.length,
    totalFactors: cats.length,
    level: label,
    label,
    color,
    availableFactors: available.map((c) => c.name),
    missingFactors:   missing.map((c) => `${c.name} (${c.weight}%)`),
  };
}
