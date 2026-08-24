// /lib/stocks/massive.ts
// Polygon.io ("Massive") API client.
// ALL requests are server-side only. API key never exposed to browser.
// Reads POLYGON_API_KEY from process.env — never hardcoded.

const BASE = "https://api.polygon.io";

function getKey(): string | null {
  return process.env.POLYGON_API_KEY ?? null;
}

interface PolygonGetResult<T> {
  data: T | null;
  planLimited: boolean; // true only for an actual 403 (plan restriction)
}

async function polygonGet<T>(path: string, params: Record<string, string> = {}): Promise<PolygonGetResult<T>> {
  const key = getKey();
  if (!key) {
    console.warn("[massive] POLYGON_API_KEY not set — skipping request");
    return { data: null, planLimited: false };
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (res.status === 403) {
      console.warn(`[massive] 403 Forbidden — endpoint may require higher plan: ${path}`);
      return { data: null, planLimited: true };
    }
    if (!res.ok) {
      console.warn(`[massive] HTTP ${res.status} for ${path}`);
      return { data: null, planLimited: false };
    }
    return { data: (await res.json()) as T, planLimited: false };
  } catch (err) {
    console.warn(`[massive] fetch failed for ${path}:`, err);
    return { data: null, planLimited: false };
  }
}

// ── News ───────────────────────────────────────────────────────────────────

export interface PolygonArticle {
  id: string;
  title: string;
  published_utc: string;
  article_url: string;
  publisher: { name: string; favicon_url?: string };
  tickers: string[];
  insights?: {
    ticker: string;
    sentiment: "positive" | "negative" | "neutral";
    sentiment_reasoning?: string;
  }[];
}

interface PolygonNewsResponse {
  results: PolygonArticle[];
  status: string;
  next_url?: string;
}

export async function fetchPolygonNews(ticker: string, limit = 20): Promise<PolygonArticle[]> {
  const { data } = await polygonGet<PolygonNewsResponse>("/v2/reference/news", {
    ticker,
    limit: String(limit),
    order: "desc",
    sort: "published_utc",
  });
  return data?.results ?? [];
}

// ── Short Interest ─────────────────────────────────────────────────────────
// Endpoint: GET https://api.polygon.io/stocks/v1/short-interest
// Fields vary by subscription. We map defensively.

export interface PolygonShortInterestRaw {
  ticker:               string;
  sharesShort:          number | null;
  shortInterestPct:     number | null;  // short_interest_percent or derived
  daysToCover:          number | null;
  averageDailyVolume:   number | null;
  settlementDate:       string | null;
  planLimited:          boolean;
}

interface PolygonSIRecord {
  ticker?:                    string;
  shares_short?:              number;
  short_interest?:            number;      // some plans return raw count here
  short_interest_percent?:    number;
  days_to_cover?:             number;
  average_daily_volume?:      number;
  settlement_date?:           string;
  report_date?:               string;
  [key: string]: unknown;
}

export async function fetchShortInterest(ticker: string): Promise<PolygonShortInterestRaw> {
  const key = getKey();
  const empty: PolygonShortInterestRaw = {
    ticker, sharesShort: null, shortInterestPct: null,
    daysToCover: null, averageDailyVolume: null, settlementDate: null, planLimited: false,
  };

  if (!key) return empty;

  const { data, planLimited } = await polygonGet<{ results?: PolygonSIRecord[] }>(
    "/stocks/v1/short-interest",
    { ticker, limit: "1", sort: "settlement_date.desc" }
  );

  if (planLimited) return { ...empty, planLimited: true };
  if (!data) return empty;

  const r = data?.results?.[0];
  if (!r) return empty;

  const sharesShort        = typeof r.shares_short        === "number" ? r.shares_short        : typeof r.short_interest === "number" ? r.short_interest : null;
  const shortInterestPct   = typeof r.short_interest_percent === "number" ? r.short_interest_percent : null;
  const daysToCover        = typeof r.days_to_cover       === "number" ? r.days_to_cover        : null;
  const averageDailyVolume = typeof r.average_daily_volume === "number" ? r.average_daily_volume : null;
  const settlementDate     = r.settlement_date ?? r.report_date ?? null;

  return { ticker, sharesShort, shortInterestPct, daysToCover, averageDailyVolume, settlementDate, planLimited: false };
}

// ── Candle fallback ────────────────────────────────────────────────────────
// Used when Yahoo Finance candles are unreliable or unavailable.
// Requires POLYGON_API_KEY with a plan that includes aggregates.

export interface PolygonCandle { close: number; volume: number; timestamp: number }

export async function fetchPolygonDailyCandles(
  ticker: string,
  fromDate: string, // YYYY-MM-DD
  toDate:   string
): Promise<PolygonCandle[]> {
  const { data } = await polygonGet<{ results?: { c: number; v: number; t: number }[] }>(
    `/v2/aggs/ticker/${encodeURIComponent(ticker.toUpperCase())}/range/1/day/${fromDate}/${toDate}`,
    { adjusted: "true", sort: "asc", limit: "300" }
  );
  if (!data?.results?.length) return [];
  return data.results
    .filter((r) => typeof r.c === "number" && r.c > 0)
    .map((r) => ({ close: r.c, volume: r.v ?? 0, timestamp: r.t }));
}
