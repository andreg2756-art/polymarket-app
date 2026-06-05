// /lib/stocks/massive.ts
// Polygon.io ("Massive") API client.
// ALL requests are server-side only. API key never exposed to browser.
// Reads POLYGON_API_KEY from process.env — never hardcoded.

const BASE = "https://api.polygon.io";

function getKey(): string | null {
  return process.env.POLYGON_API_KEY ?? null;
}

async function polygonGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const key = getKey();
  if (!key) {
    console.warn("[massive] POLYGON_API_KEY not set — skipping request");
    return null;
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (res.status === 403) {
      console.warn(`[massive] 403 Forbidden — endpoint may require higher plan: ${path}`);
      return null;
    }
    if (!res.ok) {
      console.warn(`[massive] HTTP ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[massive] fetch failed for ${path}:`, err);
    return null;
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
  const data = await polygonGet<PolygonNewsResponse>("/v2/reference/news", {
    ticker,
    limit: String(limit),
    order: "desc",
    sort: "published_utc",
  });
  return data?.results ?? [];
}

// ── Short Interest ─────────────────────────────────────────────────────────

export interface PolygonShortInterest {
  ticker: string;
  shortInterestPct: number | null;
  daysToCover: number | null;
  sharesShort: number | null;
  reportDate: string | null;
  planLimited: boolean;
}

export async function fetchShortInterest(ticker: string): Promise<PolygonShortInterest> {
  const key = getKey();
  if (!key) {
    return { ticker, shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null, planLimited: false };
  }

  // Polygon short interest endpoint (requires appropriate subscription)
  const data = await polygonGet<{ results?: { short_interest?: number; days_to_cover?: number; shares_short?: number; report_date?: string }[] }>(
    `/v3/reference/short-interest`,
    { ticker, limit: "1", order: "desc" }
  );

  if (!data) {
    return { ticker, shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null, planLimited: true };
  }

  const r = data?.results?.[0];
  if (!r) {
    return { ticker, shortInterestPct: null, daysToCover: null, sharesShort: null, reportDate: null, planLimited: false };
  }

  return {
    ticker,
    shortInterestPct: typeof r.short_interest === "number" ? r.short_interest : null,
    daysToCover: typeof r.days_to_cover === "number" ? r.days_to_cover : null,
    sharesShort: typeof r.shares_short === "number" ? r.shares_short : null,
    reportDate: r.report_date ?? null,
    planLimited: false,
  };
}
