// Free, keyless Yahoo Finance predefined screeners — used to source the
// candidate universe for each scoring lens instead of a hand-maintained
// static ticker list (which silently accumulates delisted ghost tickers,
// as found and fixed elsewhere in this app). FMP's screener/stock-list
// endpoints are plan-restricted (confirmed via direct 402 test), so this
// is the only dynamic universe-discovery source available.

export interface ScreenerQuote {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  epsTrailingTwelveMonths: number | null;
  epsForward: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  averageDailyVolume3Month: number | null;
  regularMarketVolume: number | null;
}

interface YahooScreenerQuoteRaw {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  epsTrailingTwelveMonths?: number;
  epsForward?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAverage?: number;
  averageDailyVolume3Month?: number;
  regularMarketVolume?: number;
}

async function fetchOneScreen(scrId: string): Promise<YahooScreenerQuoteRaw[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=100&scrIds=${encodeURIComponent(scrId)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data?.finance?.result?.[0]?.quotes ?? [];
  } catch {
    return [];
  }
}

/** Fetches and merges (deduped by symbol) quotes across the given predefined screen categories. */
export async function fetchScreenerQuotes(scrIds: string[]): Promise<ScreenerQuote[]> {
  const results = await Promise.allSettled(scrIds.map(fetchOneScreen));
  const byTicker = new Map<string, ScreenerQuote>();

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const q of r.value) {
      if (!q.symbol || byTicker.has(q.symbol)) continue;
      const price = q.regularMarketPrice ?? 0;
      if (price <= 0) continue;
      byTicker.set(q.symbol, {
        symbol: q.symbol,
        name: q.longName ?? q.shortName ?? q.symbol,
        price,
        marketCap: q.marketCap ?? 0,
        trailingPE: typeof q.trailingPE === "number" ? q.trailingPE : null,
        forwardPE: typeof q.forwardPE === "number" ? q.forwardPE : null,
        priceToBook: typeof q.priceToBook === "number" ? q.priceToBook : null,
        epsTrailingTwelveMonths: typeof q.epsTrailingTwelveMonths === "number" ? q.epsTrailingTwelveMonths : null,
        epsForward: typeof q.epsForward === "number" ? q.epsForward : null,
        fiftyTwoWeekHigh: typeof q.fiftyTwoWeekHigh === "number" ? q.fiftyTwoWeekHigh : null,
        fiftyTwoWeekLow: typeof q.fiftyTwoWeekLow === "number" ? q.fiftyTwoWeekLow : null,
        fiftyDayAverage: typeof q.fiftyDayAverage === "number" ? q.fiftyDayAverage : null,
        averageDailyVolume3Month: typeof q.averageDailyVolume3Month === "number" ? q.averageDailyVolume3Month : null,
        regularMarketVolume: typeof q.regularMarketVolume === "number" ? q.regularMarketVolume : null,
      });
    }
  }

  return Array.from(byTicker.values());
}

export const QUALITY_SCREENS = ["undervalued_large_caps", "growth_technology_stocks", "undervalued_growth_stocks"];
export const TURNAROUND_SCREENS = ["undervalued_large_caps", "undervalued_growth_stocks"];
export const SPECULATIVE_SCREENS = ["aggressive_small_caps", "small_cap_gainers"];
