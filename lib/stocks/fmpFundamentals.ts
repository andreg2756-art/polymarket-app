// /lib/stocks/fmpFundamentals.ts
// FMP enrichment for Missing Fundamentals only.
// Fills cash, debt, and next earnings date when Yahoo quoteSummary data is absent.
// Server-side only. FMP_API_KEY never exposed to browser.

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// In-process cache keyed by symbol
const cache = new Map<string, { data: FmpFundamentals; ts: number }>();

export interface FmpFundamentals {
  cash:              number | null;
  debt:              number | null;
  nextEarningsDate:  string | null;
  cashSource:        "FMP" | "Unavailable";
  debtSource:        "FMP" | "Unavailable";
  earningsDateSource: "FMP" | "Unavailable";
}

const EMPTY: FmpFundamentals = {
  cash: null, debt: null, nextEarningsDate: null,
  cashSource: "Unavailable", debtSource: "Unavailable", earningsDateSource: "Unavailable",
};

function getKey(): string | null {
  return process.env.FMP_API_KEY ?? null;
}

async function fmpGet<T>(path: string): Promise<T | null> {
  const key = getKey();
  if (!key) return null;
  try {
    const res = await fetch(`${FMP_BASE}${path}&apikey=${key}`, {
      next: { revalidate: 21600 }, // 6 hours
    });
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[fmpFundamentals] HTTP ${res.status} for ${path}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[fmpFundamentals] fetch failed:`, err);
    }
    return null;
  }
}

// ── Balance sheet → cash + debt ───────────────────────────────────────────

interface FmpBalanceSheet {
  cashAndCashEquivalents?:     number | null;
  cashAndShortTermInvestments?: number | null;
  totalDebt?:                  number | null;
  shortTermDebt?:              number | null;
  longTermDebt?:               number | null;
}

async function fetchCashDebt(symbol: string): Promise<{ cash: number | null; debt: number | null }> {
  const data = await fmpGet<FmpBalanceSheet[]>(
    `/balance-sheet-statement/${encodeURIComponent(symbol)}?period=quarter&limit=1`
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { cash: null, debt: null };

  const cash =
    (typeof row.cashAndCashEquivalents === "number" && row.cashAndCashEquivalents > 0
      ? row.cashAndCashEquivalents
      : null) ??
    (typeof row.cashAndShortTermInvestments === "number" && row.cashAndShortTermInvestments > 0
      ? row.cashAndShortTermInvestments
      : null);

  const shortTerm = typeof row.shortTermDebt === "number" ? row.shortTermDebt : 0;
  const longTerm  = typeof row.longTermDebt  === "number" ? row.longTermDebt  : 0;
  const debt =
    (typeof row.totalDebt === "number" && row.totalDebt > 0
      ? row.totalDebt
      : null) ??
    (shortTerm + longTerm > 0 ? shortTerm + longTerm : null);

  return { cash, debt };
}

// ── Earnings calendar → next earnings date ────────────────────────────────

interface FmpEarningsCalendar { date: string; symbol: string }

async function fetchNextEarningsDate(symbol: string): Promise<string | null> {
  const data = await fmpGet<FmpEarningsCalendar[]>(
    `/historical/earning_calendar/${encodeURIComponent(symbol)}?`
  );
  if (!Array.isArray(data) || data.length === 0) return null;

  const today = new Date().toISOString().split("T")[0];
  const future = data
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  return future[0]?.date ?? null;
}

// ── Public export ─────────────────────────────────────────────────────────

export async function getFmpFundamentals(symbol: string): Promise<FmpFundamentals> {
  if (!getKey()) return EMPTY;

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const [{ cash, debt }, nextEarningsDate] = await Promise.all([
      fetchCashDebt(symbol),
      fetchNextEarningsDate(symbol),
    ]);

    const result: FmpFundamentals = {
      cash,
      debt,
      nextEarningsDate,
      cashSource:          cash             !== null ? "FMP" : "Unavailable",
      debtSource:          debt             !== null ? "FMP" : "Unavailable",
      earningsDateSource:  nextEarningsDate !== null ? "FMP" : "Unavailable",
    };

    cache.set(symbol, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[fmpFundamentals] failed for ${symbol}:`, err);
    }
    return EMPTY;
  }
}

/** Convenience — just the next earnings date. */
export async function getFmpEarningsDate(symbol: string): Promise<string | null> {
  const f = await getFmpFundamentals(symbol);
  return f.nextEarningsDate;
}
