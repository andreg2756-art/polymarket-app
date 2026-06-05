// /lib/stocks/dataConfidence.ts
// Calculates a data confidence score based on how many factors are available.

import type { EnhancedStockScore } from "./types";
import type { ShortInterestResult } from "./shortInterest";

export interface DataConfidenceResult {
  score: number;           // 0–100
  availableCount: number;
  totalFactors: number;
  label: "High" | "Medium" | "Low";
  color: string;
  availableFactors: string[];
  missingFactors: string[];
}

interface FactorCheck {
  name: string;
  available: boolean;
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
  marketCap: number | null
): DataConfidenceResult {
  const checks: FactorCheck[] = [
    { name: "Revenue Growth",   available: isAvailable(score.revenueGrowthScore?.value) },
    { name: "Analyst/Risk Rating", available: isAvailable(score.riskQualityScore?.score) },
    { name: "Earnings Date",    available: isAvailable(score.earningsRiskScore?.value) },
    { name: "Short Interest",   available: shortInterest?.available === true },
    { name: "News Sentiment",   available: isAvailable(score.newsSentiment?.score) },
    { name: "Beta/Volatility",  available: isAvailable(score.volatilityScore?.score) },
    { name: "Relative Volume",  available: isAvailable(score.volumeScore?.score) },
    { name: "Moving Averages",  available: false }, // MA50/200 not in enhanced score — mark N/A unless wired
    { name: "Market Cap",       available: isAvailable(marketCap) },
    { name: "RS Rank",          available: isAvailable(score.rsRank?.score) },
  ];

  const available = checks.filter((c) => c.available);
  const missing   = checks.filter((c) => !c.available);
  const pct = Math.round((available.length / checks.length) * 100);

  let label: DataConfidenceResult["label"] = "Low";
  let color = "text-red-400";
  if (pct >= 80) { label = "High";   color = "text-emerald-400"; }
  else if (pct >= 50) { label = "Medium"; color = "text-yellow-400"; }

  return {
    score: pct,
    availableCount: available.length,
    totalFactors: checks.length,
    label,
    color,
    availableFactors: available.map((c) => c.name),
    missingFactors: missing.map((c) => c.name),
  };
}
