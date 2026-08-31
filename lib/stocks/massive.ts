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

// Confirmed by direct testing: the current plan allows exactly 5 requests/min
// across ALL Polygon endpoints combined (not per-endpoint, not per-caller) —
// a burst of 8 calls got 5x 200 then 3x 429. Shared module-level gate so
// every caller in this process (news, candles, short-interest, financials —
// including two pipelines running concurrently) queues through one limiter
// instead of each independently bursting past it.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
let recentRequestTimestamps: number[] = [];

async function waitForPolygonRateLimit(): Promise<void> {
  for (;;) {
    const now = Date.now();
    recentRequestTimestamps = recentRequestTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (recentRequestTimestamps.length < RATE_LIMIT) {
      recentRequestTimestamps.push(now);
      return;
    }
    const waitMs = RATE_WINDOW_MS - (now - recentRequestTimestamps[0]) + 200;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

// waitForQuota defaults to false — fail fast on 429, same as before the rate
// limiter existed. This matters: news/candles/short-interest are called for
// large concurrent shortlists (up to 80 tickers for the enhanced-score
// pass) and were already designed to tolerate a failed lookup and move on.
// Making the shared polygonGet block+wait for ALL callers by default turned
// that fail-fast pass into 80 calls queuing behind one 5/min gate and caused
// a confirmed FUNCTION_INVOCATION_TIMEOUT — waiting for quota is only safe
// to opt into for a caller with a small, known request count, which is why
// fetchPolygonFinancials passes waitForQuota: true and nothing else does.
async function polygonGet<T>(
  path: string,
  params: Record<string, string> = {},
  options: { revalidateSeconds?: number; waitForQuota?: boolean } = {}
): Promise<PolygonGetResult<T>> {
  const { revalidateSeconds = 3600, waitForQuota = false } = options;
  const key = getKey();
  if (!key) {
    console.warn("[massive] POLYGON_API_KEY not set — skipping request");
    return { data: null, planLimited: false };
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const attempts = waitForQuota ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (waitForQuota) await waitForPolygonRateLimit();
    try {
      const res = await fetch(url.toString(), { next: { revalidate: revalidateSeconds } });
      if (res.status === 403) {
        console.warn(`[massive] 403 Forbidden — endpoint may require higher plan: ${path}`);
        return { data: null, planLimited: true };
      }
      if (res.status === 429) {
        if (waitForQuota && attempt === 0) continue; // shared limiter should prevent this; stay defensive
        return { data: null, planLimited: false }; // fail-fast path: expected under load, not worth logging every time
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
  return { data: null, planLimited: false };
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

// ── Financials (balance sheet / income statement / cash flow) ────────────────
// Replaces FMP's balance-sheet-statement/income-statement/cash-flow-statement
// endpoints, which reject (402) almost every symbol outside a small mega-cap
// allowlist on the current plan — confirmed by direct testing. Polygon's
// financials are aggregated from the same SEC XBRL filings every public
// company must submit, so coverage isn't gated by market cap: tested against
// 8 names spanning insurance, tech, mining, and financial services and all 8
// returned real net income/revenue/margin data.
//
// KNOWN GAP: across that same sample, no company had a standardized "cash"
// line item (folded into current_assets without being broken out) and no
// cash-flow statement had a capital-expenditure line, so cashAndEquivalents
// and freeCashFlow are left null rather than guessed at — this is a real
// limitation of Polygon's standardized taxonomy, not a bug. "long_term_debt"
// is present roughly a third of the time, so totalDebt is partial too.

interface PolygonFinancialValue { value: number; unit: string; label: string; order: number }

interface PolygonFinancialsPeriodRaw {
  fiscal_period: string;
  fiscal_year: string;
  timeframe: string;
  financials: {
    income_statement?: Record<string, PolygonFinancialValue>;
    balance_sheet?: Record<string, PolygonFinancialValue>;
    cash_flow_statement?: Record<string, PolygonFinancialValue>;
  };
}

interface PolygonFinancialsResponse {
  results: PolygonFinancialsPeriodRaw[];
  status: string;
}

export interface PolygonFinancialsPeriod {
  netIncome: number | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  totalDebt: number | null;
  cashAndEquivalents: number | null; // not available from Polygon's standardized financials — see note above
  freeCashFlow: number | null;       // not available from Polygon's standardized financials — see note above
}

function mapPolygonPeriod(p: PolygonFinancialsPeriodRaw | undefined): PolygonFinancialsPeriod | null {
  if (!p) return null;
  const inc = p.financials.income_statement ?? {};
  const bs = p.financials.balance_sheet ?? {};
  return {
    netIncome: inc.net_income_loss?.value ?? null,
    revenue: inc.revenues?.value ?? null,
    grossProfit: inc.gross_profit?.value ?? null,
    operatingIncome: inc.operating_income_loss?.value ?? null,
    totalDebt: bs.long_term_debt?.value ?? null,
    cashAndEquivalents: null,
    freeCashFlow: null,
  };
}

export async function fetchPolygonFinancials(
  ticker: string
): Promise<{ current: PolygonFinancialsPeriod | null; previous: PolygonFinancialsPeriod | null }> {
  // 24h cache, not the usual 3600s default — annual financials don't change
  // between refreshes, and stretching the cache window is what lets the
  // 5-req/min budget cover more of the shortlist across successive days
  // instead of re-spending it on the same tickers every run.
  const { data } = await polygonGet<PolygonFinancialsResponse>(
    "/vX/reference/financials",
    { ticker, timeframe: "annual", limit: "2" },
    { revalidateSeconds: 86_400, waitForQuota: true }
  );
  const results = data?.results ?? [];
  return { current: mapPolygonPeriod(results[0]), previous: mapPolygonPeriod(results[1]) };
}

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
