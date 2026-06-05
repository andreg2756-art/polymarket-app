// /lib/stocks/earningsRisk.ts
// Earnings date proximity risk penalty.
// Source: SEC EDGAR filing dates as a proxy (10-Q/10-K filing → recent earnings).
// Falls back to Nasdaq earnings calendar if available.

import type { ScoredMetric } from "./types";

interface TickerEntry { cik_str: number; ticker: string }
interface SECFiling { filed: string; form: string; accn: string }

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
    return match ? String(match.cik_str).padStart(10, "0") : null;
  } catch {
    return null;
  }
}

// Get most recent 10-Q/10-K filing date from SEC submissions
async function getRecentFilingDate(cik: string): Promise<{ lastFiled: Date | null; nextEstimate: Date | null }> {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { "User-Agent": "polymarket-app/1.0 admin@example.com" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { lastFiled: null, nextEstimate: null };
    const data = await res.json();

    const filings: { form: string[]; filingDate: string[] } = data?.filings?.recent ?? {};
    const forms: string[] = filings.form ?? [];
    const dates: string[] = filings.filingDate ?? [];

    // Find the most recent quarterly/annual report
    const quarterlyForms = ["10-Q", "10-K"];
    let lastFiledDate: Date | null = null;

    for (let i = 0; i < forms.length; i++) {
      if (quarterlyForms.includes(forms[i])) {
        const d = new Date(dates[i]);
        if (!isNaN(d.getTime())) {
          lastFiledDate = d;
          break; // filings are newest-first
        }
      }
    }

    if (!lastFiledDate) return { lastFiled: null, nextEstimate: null };

    // Estimate next report ~90 days after last filing (quarterly cadence)
    const nextEstimate = new Date(lastFiledDate.getTime() + 90 * 86400000);

    return { lastFiled: lastFiledDate, nextEstimate };
  } catch {
    return { lastFiled: null, nextEstimate: null };
  }
}

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
