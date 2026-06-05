// /lib/stocks/earningsRisk.ts
// Calculates an earnings proximity penalty.
// Uses Yahoo Finance calendarEvents — falls back gracefully if unavailable.

import type { ScoredMetric } from "./types";

async function fetchNextEarningsDate(ticker: string): Promise<Date | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const earningsDates: unknown[] = result?.calendarEvents?.earnings?.earningsDate ?? [];
    if (!earningsDates.length) return null;

    // earningsDate entries have a .raw (unix timestamp) or .fmt (string)
    const first = earningsDates[0] as Record<string, unknown>;
    const raw = first?.raw;
    const fmt = first?.fmt;

    if (typeof raw === "number") return new Date(raw * 1000);
    if (typeof fmt === "string") return new Date(fmt);
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

export async function getEarningsRiskScore(ticker: string): Promise<ScoredMetric & { daysUntilEarnings: number | null }> {
  try {
    const nextDate = await fetchNextEarningsDate(ticker);

    if (!nextDate || isNaN(nextDate.getTime())) {
      return {
        value: null,
        score: null,
        source: "unavailable",
        reason: "No upcoming earnings date available",
        daysUntilEarnings: null,
      };
    }

    const days = daysUntil(nextDate);

    // Only applies as a forward risk if earnings are in the future
    if (days < 0) {
      return {
        value: nextDate.toLocaleDateString(),
        score: null,
        source: "yahoo",
        reason: `Last earnings was ${Math.abs(days)} days ago — next date not yet announced`,
        daysUntilEarnings: null,
      };
    }

    const penalty = penaltyFromDays(days);

    return {
      value: nextDate.toLocaleDateString(),
      score: penalty, // stored as penalty magnitude, applied as subtraction in scoring.ts
      source: "yahoo",
      reason: penalty > 0
        ? `Earnings in ${days} day${days === 1 ? "" : "s"} — binary event risk. Score penalty: -${penalty} pts`
        : `Earnings in ${days} days — outside near-term risk window`,
      daysUntilEarnings: days,
    };
  } catch {
    return {
      value: null,
      score: null,
      source: "unavailable",
      reason: "Earnings date fetch failed",
      daysUntilEarnings: null,
    };
  }
}
