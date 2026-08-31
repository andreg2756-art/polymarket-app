// /lib/stocks/earningsRisk.ts
// Earnings date proximity risk penalty.
// Source: SEC EDGAR filing dates as a proxy (10-Q/10-K filing → recent earnings).
// Falls back to Nasdaq earnings calendar if available.

import type { ScoredMetric } from "./types";
import { getCIK, getRecentFilingDate } from "./secFilingDates";

// Also try Nasdaq earnings calendar as a secondary source
async function getNasdaqEarningsDate(ticker: string): Promise<Date | null> {
  try {
    // Check the next 60 days
    const dates: string[] = [];
    const now = new Date();
    for (let i = 0; i <= 60; i += 7) {
      const d = new Date(now.getTime() + i * 86400000);
      dates.push(d.toISOString().split("T")[0]);
    }

    for (const date of dates.slice(0, 3)) {
      const res = await fetch(
        `https://api.nasdaq.com/api/calendar/earnings?date=${date}`,
        {
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const rows: { symbol: string; time: string }[] = json?.data?.rows ?? [];
      const match = rows.find((r) => r.symbol?.toUpperCase() === ticker.toUpperCase());
      if (match) return new Date(date);
    }
    return null;
  } catch {
    return null;
  }
}

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / 86400000);
}

function penaltyFromDays(days: number): number {
  if (days <= 7)  return 10;
  if (days <= 14) return 6;
  if (days <= 30) return 3;
  return 0;
}

export async function getEarningsRiskScore(
  ticker: string
): Promise<ScoredMetric & { daysUntilEarnings: number | null }> {
  try {
    // Try Nasdaq calendar first (most accurate for upcoming dates)
    const nasdaqDate = await getNasdaqEarningsDate(ticker);
    if (nasdaqDate) {
      const days = daysUntil(nasdaqDate);
      if (days >= 0) {
        const penalty = penaltyFromDays(days);
        return {
          value: nasdaqDate.toLocaleDateString(),
          score: penalty,
          source: "yahoo", // Nasdaq is close enough
          reason: penalty > 0
            ? `Earnings in ${days} day${days === 1 ? "" : "s"} — binary event risk. Penalty: -${penalty} pts`
            : `Earnings in ${days} days — outside near-term risk window`,
          daysUntilEarnings: days,
        };
      }
    }

    // Fall back to SEC filing cadence estimate
    const cik = await getCIK(ticker);
    if (cik) {
      const { lastFiled, nextEstimate } = await getRecentFilingDate(cik);
      if (nextEstimate) {
        const days = daysUntil(nextEstimate);
        const lastFiledStr = lastFiled ? lastFiled.toLocaleDateString() : "unknown";
        if (days >= 0 && days <= 120) {
          const penalty = penaltyFromDays(days);
          return {
            value: `~${nextEstimate.toLocaleDateString()} (est.)`,
            score: penalty,
            source: "sec",
            reason: `Estimated from SEC filing cadence. Last filed: ${lastFiledStr}. ${
              penalty > 0
                ? `Estimated earnings ~${days} days away. Penalty: -${penalty} pts`
                : `Estimated ~${days} days away — outside near-term risk window`
            }`,
            daysUntilEarnings: days,
          };
        }
      }
    }

    return {
      value: null,
      score: null,
      source: "unavailable",
      reason: "No upcoming earnings date found via Nasdaq or SEC filing cadence",
      daysUntilEarnings: null,
    };
  } catch {
    return {
      value: null,
      score: null,
      source: "unavailable",
      reason: "Earnings risk fetch failed",
      daysUntilEarnings: null,
    };
  }
}
