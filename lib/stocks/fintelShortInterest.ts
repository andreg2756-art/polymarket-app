// /lib/stocks/fintelShortInterest.ts
// Fintel Web Data API short interest integration.
// NOTE: The Fintel Web Data API is being discontinued — treat as best-effort.
// Server-side only. Never expose to browser.

export type FintelShortInterestMetrics = {
  sharesShort:          number | null;
  shortInterestPctFloat: number | null;
  daysToCover:          number | null;
  borrowFeeRate:        number | null;
  shortSharesAvailable: number | null;
  settlementDate:       string | null;
  sourceUrl:            string | null;
  source:               "fintel_web" | "unavailable";
};

const FINTEL_BASE = "https://api.fintel.io/web/v/0.0/ss/us";
const CACHE_TTL   = 12 * 60 * 60 * 1000; // 12 hours in ms

// In-process cache to avoid hammering the endpoint during ISR/streaming
const cache = new Map<string, { data: FintelShortInterestMetrics; ts: number }>();

// ── Field name aliases ────────────────────────────────────────────────────

const ALIAS: Record<keyof Omit<FintelShortInterestMetrics, "source">, string[]> = {
  sharesShort:           ["sharesShort", "shares_short", "shortInterestShares", "short_interest_shares"],
  shortInterestPctFloat: ["shortInterestPercentFloat", "short_interest_percent_float", "shortFloatPercent", "short_float_percent", "shortInterestPctFloat"],
  daysToCover:           ["daysToCover", "days_to_cover", "shortRatio", "short_ratio"],
  borrowFeeRate:         ["borrowFeeRate", "borrow_fee_rate", "costToBorrow", "cost_to_borrow"],
  shortSharesAvailable:  ["shortSharesAvailable", "short_shares_available", "sharesAvailable", "shares_available"],
  settlementDate:        ["settlementDate", "settlement_date", "reportDate", "report_date"],
  sourceUrl:             ["url", "sourceUrl", "source_url"],
};

// ── Recursive key search ──────────────────────────────────────────────────

function findKey(obj: unknown, keys: string[], depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    if (k in rec && rec[k] !== undefined && rec[k] !== null) return rec[k];
  }
  // search nested objects / first array element
  for (const v of Object.values(rec)) {
    if (v !== null && typeof v === "object") {
      const found = findKey(v, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : null;
}

function toPct(v: unknown): number | null {
  const n = toNum(v);
  if (n === null) return null;
  // convert 0–1 decimal to percent
  return Math.abs(n) <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

// ── Null result ───────────────────────────────────────────────────────────

const UNAVAILABLE: FintelShortInterestMetrics = {
  sharesShort: null, shortInterestPctFloat: null, daysToCover: null,
  borrowFeeRate: null, shortSharesAvailable: null,
  settlementDate: null, sourceUrl: null, source: "unavailable",
};

// ── Main helper ───────────────────────────────────────────────────────────

export async function getFintelShortInterest(symbol: string): Promise<FintelShortInterestMetrics> {
  if (process.env.FINTEL_WEB_API_ENABLED !== "true") return UNAVAILABLE;

  const key = symbol.toUpperCase();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const url = `${FINTEL_BASE}/${key}`;
    const res = await fetch(url, {
      headers: {
        Accept:       "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      // Next.js fetch cache — revalidate every 12 hours
      next: { revalidate: 43200 },
    });

    if (!res.ok) {
      console.warn(`[fintel] HTTP ${res.status} for ${key}`);
      return UNAVAILABLE;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      console.warn(`[fintel] non-JSON response for ${key}`);
      return UNAVAILABLE;
    }

    const raw: unknown = await res.json();
    if (!raw || typeof raw !== "object") return UNAVAILABLE;

    const sharesShort          = toNum(findKey(raw, ALIAS.sharesShort));
    const shortInterestPctFloat = toPct(findKey(raw, ALIAS.shortInterestPctFloat));
    const daysToCover          = toNum(findKey(raw, ALIAS.daysToCover));
    const borrowFeeRate        = toPct(findKey(raw, ALIAS.borrowFeeRate));
    const shortSharesAvailable = toNum(findKey(raw, ALIAS.shortSharesAvailable));
    const settlementDate       = formatDate(toStr(findKey(raw, ALIAS.settlementDate)));
    const sourceUrl            = toStr(findKey(raw, ALIAS.sourceUrl));

    // Return unavailable if nothing useful came back
    if (
      sharesShort === null && shortInterestPctFloat === null &&
      daysToCover === null && borrowFeeRate === null
    ) {
      return UNAVAILABLE;
    }

    const result: FintelShortInterestMetrics = {
      sharesShort, shortInterestPctFloat, daysToCover,
      borrowFeeRate, shortSharesAvailable, settlementDate, sourceUrl,
      source: "fintel_web",
    };

    cache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[fintel] fetch failed for ${key}:`, err);
    return UNAVAILABLE;
  }
}
