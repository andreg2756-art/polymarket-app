// /lib/stocks/shortInterest.ts
// Short interest data from Polygon.io /stocks/v1/short-interest endpoint.
// Server-side only. POLYGON_API_KEY never exposed to browser.
// NOTE: Short interest ≠ short volume. This is reported ~twice monthly.

import { fetchShortInterest } from "./massive";
import { fmtLargeNum } from "./technicals";

export type ShortInterestMetrics = {
  sharesShort:            number | null;
  shortInterestPctFloat:  number | null;  // derived if not in API response
  daysToCover:            number | null;  // derived if not in API response
  averageDailyVolume:     number | null;
  settlementDate:         string | null;
  source:                 "polygon" | "unavailable";
};

// Legacy shape kept for backwards compat with EnhancedScorePanel / dataConfidence
export interface ShortInterestResult extends ShortInterestMetrics {
  available:          boolean;
  planLimited:        boolean;
  isStale:            boolean;   // true if settlementDate > 45 days old
  displayShortPct:    string;
  displayDaysToCover: string;
  displaySharesShort: string;
  displaySettlement:  string;
  riskLevel:          "high" | "moderate" | "low" | "unknown";
  reason:             string;
}

const STALE_DAYS = 45;

function isStaleDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return (Date.now() - d.getTime()) / 86400000 > STALE_DAYS;
}

function assessRisk(pct: number | null, dtc: number | null): ShortInterestResult["riskLevel"] {
  if (pct === null) return "unknown";
  if (pct > 20 || (dtc !== null && dtc > 10)) return "high";
  if (pct > 10 || (dtc !== null && dtc > 5))  return "moderate";
  return "low";
}

export async function getShortInterestData(symbol: string, floatShares?: number | null): Promise<ShortInterestResult> {
  if (!process.env.POLYGON_API_KEY) {
    return nullResult("POLYGON_API_KEY not configured", false, false);
  }

  try {
    const raw = await fetchShortInterest(symbol);

    if (raw.planLimited) {
      return nullResult("Short interest endpoint requires a higher Polygon plan", false, true);
    }

    if (raw.sharesShort === null && raw.shortInterestPct === null) {
      return nullResult("No short interest data returned for this ticker", false, false);
    }

    // Derive shortInterestPctFloat if API doesn't return it but we have floatShares from FMP
    let shortInterestPctFloat = raw.shortInterestPct;
    if (shortInterestPctFloat === null && raw.sharesShort !== null && floatShares && floatShares > 0) {
      shortInterestPctFloat = Math.round((raw.sharesShort / floatShares) * 10000) / 100;
    }

    // Derive daysToCover if API doesn't return it
    let daysToCover = raw.daysToCover;
    if (daysToCover === null && raw.sharesShort !== null && raw.averageDailyVolume && raw.averageDailyVolume > 0) {
      daysToCover = Math.round((raw.sharesShort / raw.averageDailyVolume) * 10) / 10;
    }

    const stale     = isStaleDate(raw.settlementDate);
    const riskLevel = stale ? "unknown" : assessRisk(shortInterestPctFloat, daysToCover);

    if (stale) {
      return nullResult(
        `Stale data — settlement ${raw.settlementDate ?? "unknown"} is older than ${STALE_DAYS} days`,
        false, false, true
      );
    }

    const riskParts = [
      raw.sharesShort          !== null ? `Shares short: ${fmtLargeNum(raw.sharesShort)}`       : null,
      shortInterestPctFloat    !== null ? `Short % of float: ${shortInterestPctFloat.toFixed(1)}%` : null,
      daysToCover              !== null ? `Days to cover: ${daysToCover.toFixed(1)}`              : null,
      raw.settlementDate       ? `Settlement: ${raw.settlementDate}` : null,
      riskLevel === "high"     ? "⚠ Elevated short interest" : null,
      riskLevel === "moderate" ? "Moderate short interest"   : null,
    ].filter(Boolean);

    return {
      sharesShort:           raw.sharesShort,
      shortInterestPctFloat,
      daysToCover,
      averageDailyVolume:    raw.averageDailyVolume,
      settlementDate:        raw.settlementDate,
      source:                "polygon",
      available:             true,
      planLimited:           false,
      isStale:               false,
      displayShortPct:       shortInterestPctFloat !== null ? `${shortInterestPctFloat.toFixed(1)}%` : "N/A",
      displayDaysToCover:    daysToCover           !== null ? `${daysToCover.toFixed(1)} days`       : "N/A",
      displaySharesShort:    raw.sharesShort        !== null ? fmtLargeNum(raw.sharesShort)          : "N/A",
      displaySettlement:     raw.settlementDate     ?? "N/A",
      riskLevel,
      reason:                riskParts.join(" · "),
    };
  } catch (err) {
    console.warn(`[shortInterest] failed for ${symbol}:`, err);
    return nullResult("Short interest fetch failed", false, false);
  }
}

// Keep old export name for backwards compat
export const getShortInterest = getShortInterestData;

function nullResult(reason: string, available: boolean, planLimited: boolean, isStale = false): ShortInterestResult {
  return {
    sharesShort: null, shortInterestPctFloat: null, daysToCover: null,
    averageDailyVolume: null, settlementDate: null,
    source: "unavailable", available, planLimited, isStale,
    displayShortPct: isStale ? "N/A — stale data" : planLimited ? "Unavailable on current plan" : "N/A",
    displayDaysToCover: planLimited ? "Unavailable on current plan" : "N/A",
    displaySharesShort: "N/A",
    displaySettlement: "N/A",
    riskLevel: "unknown",
    reason,
  };
}
