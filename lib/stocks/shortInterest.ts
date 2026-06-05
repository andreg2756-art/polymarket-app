// /lib/stocks/shortInterest.ts
// Short interest data from Polygon.io.
// Server-side only. Returns structured result with plan-limit detection.

import { fetchShortInterest, type PolygonShortInterest } from "./massive";

export interface ShortInterestResult {
  shortInterestPct: number | null;
  daysToCover:      number | null;
  sharesShort:      number | null;
  reportDate:       string | null;
  available:        boolean;
  planLimited:      boolean;
  displayShortPct:  string;
  displayDaysToCover: string;
  riskLevel:        "high" | "moderate" | "low" | "unknown";
  reason:           string;
}

function assessRisk(shortPct: number | null, daysToCover: number | null): ShortInterestResult["riskLevel"] {
  if (shortPct === null) return "unknown";
  if (shortPct > 20 || (daysToCover !== null && daysToCover > 10)) return "high";
  if (shortPct > 10 || (daysToCover !== null && daysToCover > 5))  return "moderate";
  return "low";
}

export async function getShortInterest(ticker: string): Promise<ShortInterestResult> {
  if (!process.env.POLYGON_API_KEY) {
    return {
      shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null,
      available: false, planLimited: false,
      displayShortPct: "N/A — POLYGON_API_KEY not configured",
      displayDaysToCover: "N/A",
      riskLevel: "unknown",
      reason: "Polygon API key not configured",
    };
  }

  try {
    const data: PolygonShortInterest = await fetchShortInterest(ticker);

    if (data.planLimited) {
      return {
        shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null,
        available: false, planLimited: true,
        displayShortPct: "Unavailable on current plan",
        displayDaysToCover: "Unavailable on current plan",
        riskLevel: "unknown",
        reason: "Short interest endpoint requires a higher Polygon.io subscription",
      };
    }

    if (data.shortInterestPct === null && data.sharesShort === null) {
      return {
        shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null,
        available: false, planLimited: false,
        displayShortPct: "N/A",
        displayDaysToCover: "N/A",
        riskLevel: "unknown",
        reason: "No short interest data returned for this ticker",
      };
    }

    const riskLevel = assessRisk(data.shortInterestPct, data.daysToCover);

    return {
      shortInterestPct: data.shortInterestPct,
      daysToCover: data.daysToCover,
      sharesShort: data.sharesShort,
      reportDate: data.reportDate,
      available: true,
      planLimited: false,
      displayShortPct: data.shortInterestPct !== null ? `${data.shortInterestPct.toFixed(1)}%` : "N/A",
      displayDaysToCover: data.daysToCover !== null ? `${data.daysToCover.toFixed(1)} days` : "N/A",
      riskLevel,
      reason: [
        data.shortInterestPct !== null ? `Short interest: ${data.shortInterestPct.toFixed(1)}%` : null,
        data.daysToCover !== null ? `Days to cover: ${data.daysToCover.toFixed(1)}` : null,
        data.reportDate ? `Report date: ${data.reportDate}` : null,
        riskLevel === "high" ? "Elevated short interest — squeeze potential or bearish positioning" : null,
        riskLevel === "moderate" ? "Moderate short interest" : null,
        riskLevel === "low" ? "Low short interest" : null,
      ].filter(Boolean).join(" · "),
    };
  } catch {
    return {
      shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null,
      available: false, planLimited: false,
      displayShortPct: "N/A",
      displayDaysToCover: "N/A",
      riskLevel: "unknown",
      reason: "Short interest fetch failed",
    };
  }
}
