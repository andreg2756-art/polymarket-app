// /lib/stocks/revenueGrowth.ts
// Fetches YoY revenue growth from SEC EDGAR companyfacts API.
// Free, no API key, works for all US-listed companies.

import type { ScoredMetric } from "./types";

const REVENUE_KEYS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueGoodsNet",
];

interface TickerEntry { cik_str: number; ticker: string; title: string }

async function getCIK(ticker: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": "polymarket-app/1.0 admin@example.com" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data: Record<string, TickerEntry> = await res.json();
    const match = Object.values(data).find(
      (v) => v.ticker.toUpperCase() === ticker.toUpperCase()
    );
    if (!match) return null;
    return String(match.cik_str).padStart(10, "0");
  } catch {
    return null;
  }
}

interface SECFact {
  start?: string;
  end: string;
  val: number;
  form: string;
  fp?: string;
}

async function getAnnualRevenues(cik: string): Promise<{ year: number; revenue: number }[]> {
  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { "User-Agent": "polymarket-app/1.0 admin@example.com" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const usGaap = data?.facts?.["us-gaap"] ?? {};

    for (const key of REVENUE_KEYS) {
      if (!usGaap[key]) continue;
      const entries: SECFact[] = usGaap[key]?.units?.USD ?? [];
      const annual = entries
        .filter((e) => e.form === "10-K" && e.fp === "FY" && e.end && e.val > 0)
        .map((e) => ({ year: parseInt(e.end.slice(0, 4)), revenue: e.val }))
        .sort((a, b) => a.year - b.year);
      if (annual.length >= 2) return annual;
    }
    return [];
  } catch {
    return [];
  }
}

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
export function computeBlendedGrowthModifier(ttm: number | null, qtrYoY: number | null): number {
  if (ttm !== null && qtrYoY !== null) {
    return growthModifier(0.7 * ttm + 0.3 * qtrYoY);
  }
  if (ttm !== null)    return growthModifier(ttm);
  if (qtrYoY !== null) return growthModifier(qtrYoY);
  return 0;
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
    // 1. Try SEC EDGAR
    const cik = await getCIK(ticker);
    if (cik) {
      const annual = await getAnnualRevenues(cik);
      if (annual.length >= 2) {
        const latest = annual[annual.length - 1];
        const prior  = annual[annual.length - 2];
        if (prior.revenue > 0) {
          const growth = ((latest.revenue - prior.revenue) / prior.revenue) * 100;
          const modifier = growthModifier(growth);
          return {
            value: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`,
            score: Math.max(0, Math.min(100, Math.round(50 + growth))),
            source: "sec",
            reason: growthLabel(growth) + (modifier !== 0 ? ` | Score modifier: ${modifier > 0 ? "+" : ""}${modifier} pts` : " | No score modifier"),
            modifier,
          };
        }
      }
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
