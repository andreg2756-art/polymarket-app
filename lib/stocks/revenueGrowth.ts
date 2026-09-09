// /lib/stocks/revenueGrowth.ts
// Fetches YoY revenue growth from SEC EDGAR companyfacts API.
// Free, no API key, works for all US-listed companies.

import type { ScoredMetric } from "./types";

import { loadStoredFundamentals } from './financial-data/store';

function growthModifier(growth: number): number {
  if (growth > 40)  return 8;
  if (growth >= 25) return 5;
  if (growth >= 10) return 2;
  if (growth >= 0)  return 0;
  return -8;
}

/**
 * Blended growth modifier: 0.7 × TTM + 0.3 × quarterly YoY.
 * Falls back to whichever is available; returns 0 if neither is.
 */
export type RevenueTrendStatus =
  | "Strong Positive"
  | "Positive"
  | "Mixed"
  | "Negative"
  | "Unknown";

export interface RevenueTrend {
  status:   RevenueTrendStatus;
  modifier: number;
  ttm:      number | null;
  qtr:      number | null;
}

/**
 * 5-state revenue trend — status and modifier are always consistent.
 *
 * Both available:
 *   TTM>20 & Qtr>20  => Strong Positive (+8)
 *   TTM>0  & Qtr>0   => Positive (+4)
 *   Signs differ     => Mixed (0)
 *   TTM≤0  & Qtr≤0   => Negative (-4)
 *
 * Quarterly unavailable:
 *   TTM>0  => Unknown (0)  — never assume Positive without confirmation
 *   TTM≤0  => Negative (-4)
 *   TTM null => Unknown (0)
 *
 * Validation: modifier sign must match status sign.
 */
export function computeRevenueTrend(ttm: number | null, qtr: number | null): RevenueTrend {
  let status: RevenueTrendStatus;
  let modifier: number;

  if (ttm !== null && qtr !== null) {
    if (ttm > 20 && qtr > 20)            { status = "Strong Positive"; modifier = 8;  }
    else if (ttm > 0 && qtr > 0)         { status = "Positive";        modifier = 4;  }
    else if (ttm <= 0 && qtr <= 0)       { status = "Negative";        modifier = -4; }
    else                                  { status = "Mixed";           modifier = 0;  }
  } else if (ttm !== null) {
    // Quarterly unavailable — do not assume positive
    if (ttm <= 0)  { status = "Negative"; modifier = -4; }
    else           { status = "Unknown";  modifier = 0;  }
  } else {
    status = "Unknown"; modifier = 0;
  }

  // Invariant assertion (dev-time)
  if (process.env.NODE_ENV === "development") {
    const statusNeg = status === "Negative";
    const statusPos = status === "Strong Positive" || status === "Positive";
    if (statusNeg && modifier > 0) console.warn(`[revenueGrowth] INCONSISTENT: status=${status} but modifier=+${modifier}`);
    if (statusPos && modifier < 0) console.warn(`[revenueGrowth] INCONSISTENT: status=${status} but modifier=${modifier}`);
  }

  return { status, modifier, ttm, qtr };
}

/** Legacy export kept for callers that only need the numeric modifier. */
export function computeBlendedGrowthModifier(ttm: number | null, qtr: number | null): number {
  return computeRevenueTrend(ttm, qtr).modifier;
}

function growthLabel(growth: number): string {
  if (growth > 40)  return `+${growth.toFixed(1)}% YoY — strong growth`;
  if (growth >= 25) return `+${growth.toFixed(1)}% YoY — healthy growth`;
  if (growth >= 10) return `+${growth.toFixed(1)}% YoY — moderate growth`;
  if (growth >= 0)  return `+${growth.toFixed(1)}% YoY — flat growth`;
  return `${growth.toFixed(1)}% YoY — declining revenue`;
}

export async function getRevenueGrowthScore(
  ticker: string,
  existingRevenueGrowth: number | null
): Promise<ScoredMetric & { modifier: number }> {
  try {
    const f = (await loadStoredFundamentals([ticker])).get(ticker);
    if (f?.revenueGrowthYoY != null) {
      const growth = f.revenueGrowthYoY;
      const modifier = growthModifier(growth);
      return { value: `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`, score: Math.max(0, Math.min(100, Math.round(50 + growth))), source: 'calculated', reason: `${f.source} year-over-year revenue change; period ending ${f.periodEnd}`, modifier };
    }

    // 2. Fall back to existing DB value
    if (existingRevenueGrowth !== null && existingRevenueGrowth !== 0) {
      const modifier = growthModifier(existingRevenueGrowth);
      return {
        value: `${existingRevenueGrowth > 0 ? "+" : ""}${existingRevenueGrowth.toFixed(1)}%`,
        score: Math.max(0, Math.min(100, Math.round(50 + existingRevenueGrowth))),
        source: "calculated",
        reason: growthLabel(existingRevenueGrowth) + ` | Score modifier: ${modifier > 0 ? "+" : ""}${modifier} pts`,
        modifier,
      };
    }

    return {
      value: null,
      score: null,
      source: "unavailable",
      reason: "Revenue data not found in SEC EDGAR or database",
      modifier: 0,
    };
  } catch {
    return {
      value: null,
      score: null,
      source: "unavailable",
      reason: "Revenue growth fetch failed",
      modifier: 0,
    };
  }
}
