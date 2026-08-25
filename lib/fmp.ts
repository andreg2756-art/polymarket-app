const BASE = "https://financialmodelingprep.com/stable";
const KEY = process.env.FMP_API_KEY!;

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apikey", KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`FMP ${res.status} ${path}`);
      return await res.json() as T;
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error(`FMP failed after retries: ${path}`);
}

export interface FMPScreenerResult {
  symbol: string;
  companyName: string;
  marketCap: number;
  price: number;
  beta: number;
  volume: number;
  lastAnnualDividend: number;
  exchange: string;
  exchangeShortName: string;
  sector: string;
  industry: string;
  country: string;
  isEtf: boolean;
  isFund: boolean;
  isActivelyTrading: boolean;
}

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  exchange: string;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
}

export interface FMPIncomeStatement {
  date: string;
  revenue: number;
  netIncome: number;
  eps: number;
  grossProfit: number;
  operatingIncome: number;
  ebitda: number;
}

export interface FMPInsiderTrade {
  symbol: string;
  filingDate: string;
  transactionDate: string;
  reportingName: string;
  transactionType: string;
  securitiesTransacted: number;
  price: number;
  securitiesOwned: number;
  typeOfOwner: string;
}

export interface FMPAnalystRating {
  symbol: string;
  date: string;
  analystRatingsStrongBuy: number;
  analystRatingsBuy: number;
  analystRatingsHold: number;
  analystRatingsSell: number;
  analystRatingsStrongSell: number;
}

export interface FMPNews {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
  sentiment?: string;
  sentimentScore?: number;
}

export interface FMPProfile {
  symbol: string;
  price: number;
  marketCap: number;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  exchange: string;
  float?: number;
  beta?: number;
  ipoDate?: string;
  ceo?: string;
  website?: string;
  image?: string;
  fullTimeEmployees?: number;
  isEtf?: boolean;
  isFund?: boolean;
  isActivelyTrading?: boolean;
}

export interface FMPEarnings {
  date: string;
  symbol: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
}

export async function screenSmallCaps(): Promise<FMPScreenerResult[]> {
  const { SMALL_CAP_UNIVERSE } = await import("./small-cap-universe");
  const batches: FMPProfile[][] = [];
  for (let i = 0; i < SMALL_CAP_UNIVERSE.length; i += 20) {
    const chunk = SMALL_CAP_UNIVERSE.slice(i, i + 20);
    try {
      const profiles = await get<FMPProfile[]>("/profile", { symbol: chunk.join(",") });
      batches.push(profiles);
    } catch {
      // skip failed batch
    }
  }
  const profiles = batches.flat();
  return profiles
    .filter((p) => p.marketCap >= 50_000_000 && p.marketCap <= 2_000_000_000 && !p.isEtf && !p.isFund)
    .map((p) => ({
      symbol: p.symbol,
      companyName: p.companyName,
      marketCap: p.marketCap,
      price: p.price,
      beta: p.beta ?? 0,
      volume: 0,
      lastAnnualDividend: 0,
      exchange: p.exchange ?? "",
      exchangeShortName: p.exchange ?? "",
      sector: p.sector ?? "",
      industry: p.industry ?? "",
      country: "US",
      isEtf: p.isEtf ?? false,
      isFund: p.isFund ?? false,
      isActivelyTrading: p.isActivelyTrading ?? true,
    }));
}

export async function getQuotes(tickers: string[]): Promise<FMPQuote[]> {
  if (!tickers.length) return [];
  return get<FMPQuote[]>(`/batch-request-end-of-day-prices`, { symbol: tickers.join(",") });
}

export async function getQuote(ticker: string): Promise<FMPQuote | null> {
  const data = await get<FMPQuote[]>(`/quote`, { symbol: ticker });
  return data[0] ?? null;
}

export async function getProfile(ticker: string): Promise<FMPProfile | null> {
  const data = await get<FMPProfile[]>(`/profile`, { symbol: ticker });
  return data[0] ?? null;
}

export async function getIncomeStatements(ticker: string): Promise<FMPIncomeStatement[]> {
  // Current plan caps 'limit' at 5 for this endpoint — only [0]/[1] are used anyway.
  return get<FMPIncomeStatement[]>(`/income-statement`, { symbol: ticker, limit: "5" });
}

export async function getInsiderTrades(ticker: string): Promise<FMPInsiderTrade[]> {
  // Note: this endpoint is plan-restricted (HTTP 402 "Restricted Endpoint")
  // on the current FMP plan even with the correct path — insider trading
  // data is genuinely unavailable until that plan is upgraded, separate
  // from this path fix.
  return get<FMPInsiderTrade[]>(`/insider-trading/search`, { symbol: ticker, limit: "20" });
}

export async function getAnalystRatings(ticker: string): Promise<FMPAnalystRating | null> {
  const data = await get<FMPAnalystRating[]>(`/analyst-stock-recommendations`, { symbol: ticker, limit: "1" });
  return data[0] ?? null;
}

export async function getNews(ticker: string): Promise<FMPNews[]> {
  return get<FMPNews[]>(`/stock_news`, { tickers: ticker, limit: "10" });
}

export async function getEarnings(ticker: string): Promise<FMPEarnings[]> {
  return get<FMPEarnings[]>(`/earnings`, { symbol: ticker, limit: "4" });
}

export async function getPriceHistory(ticker: string, from: string, to: string) {
  return get<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]>(
    `/historical-price-eod/full`,
    { symbol: ticker, from, to }
  );
}
