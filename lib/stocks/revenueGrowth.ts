// /lib/stocks/revenueGrowth.ts
// Fetches YoY revenue growth from Yahoo Finance income statement data.
// Falls back to existing DB value if Yahoo unavailable.

import type { ScoredMetric } from "./types";

async function fetchRevenueGrowthFromYahoo(ticker: string): Promise<number | null> {
  try {
    // Use incomeStatementHistory from quoteSummary
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const rawGrowth = result?.financialData?.revenueGrowth?.raw;
    if (typeof rawGrowth === "number" && isFinite(rawGrowth)) {
      return rawGrowth * 100; // convert 0.35 → 35%
    }
    return null;
  } catch {
    return null;
  }
}

function growthModifier(growth: number): number {
  if (growth > 40)  return 8;
  if (growth >= 25) return 5;
  if (growth >= 10) return 2;
  if (growth >= 0)  return 0;
  return -8; // negative growth
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
    // Try Yahoo first, fall back to existing DB value
    let growth = await fetchRevenueGrowthFromYahoo(ticker);

    if (growth === null && existingRevenueGrowth !== null && existingRevenueGrowth !== 0) {
      growth = existingRevenueGrowth;
    }

    if (growth === null) {
      return {
        value: null,
        score: null,
        source: "unavailable",
        reason: "Revenue growth unavailable — no modifier applied",
        modifier: 0,
      };
    }

    const modifier = growthModifier(growth);

    return {
      value: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`,
      score: Math.max(0, Math.min(100, Math.round(50 + growth))), // illustrative 0–100 band
      source: "yahoo",
      reason: growthLabel(growth) + (modifier !== 0 ? ` | Score modifier: ${modifier > 0 ? "+" : ""}${modifier} pts` : " | No score modifier"),
      modifier,
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
