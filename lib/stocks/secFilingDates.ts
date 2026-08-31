// /lib/stocks/secFilingDates.ts
// Shared SEC EDGAR CIK lookup + most-recent-10-Q/10-K-filing-date helper.
// Free, no key, no plan restriction — unlike FMP's /earnings, which is
// mega-cap-allowlisted on the current plan (confirmed: 402 for VIOT).
// Extracted out of earningsRisk.ts so earningsPerformance.ts can reuse it as
// a lastEarningsDate fallback without duplicating the CIK/submissions logic.

interface TickerEntry { cik_str: number; ticker: string }

export async function getCIK(ticker: string): Promise<string | null> {
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

// Most recent 10-Q/10-K filing date — a same-day-or-next-day proxy for the
// last reported earnings date, since a quarterly/annual report filing is
// what earnings results are formally attached to.
export async function getRecentFilingDate(cik: string): Promise<{ lastFiled: Date | null; nextEstimate: Date | null }> {
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

    const nextEstimate = new Date(lastFiledDate.getTime() + 90 * 86400000);
    return { lastFiled: lastFiledDate, nextEstimate };
  } catch {
    return { lastFiled: null, nextEstimate: null };
  }
}

/** Last reported earnings date via SEC filing cadence — free fallback when FMP's /earnings 402s. */
export async function getLastEarningsDateFromSEC(ticker: string): Promise<string | null> {
  const cik = await getCIK(ticker);
  if (!cik) return null;
  const { lastFiled } = await getRecentFilingDate(cik);
  return lastFiled ? lastFiled.toISOString().split("T")[0] : null;
}
