import { SECTOR_UNIVERSE } from "./small-cap-universe";

// Build a ticker -> sector lookup
export const TICKER_SECTOR: Record<string, string> = {};
for (const [sector, tickers] of Object.entries(SECTOR_UNIVERSE)) {
  for (const ticker of tickers) {
    if (!TICKER_SECTOR[ticker]) TICKER_SECTOR[ticker] = sector;
  }
}

export interface YahooChart {
  price: number;
  change1M: number;
  change3M: number;
  relativeVolume: number;
  marketCap: number;       // from meta.marketCap (live), falls back to 0
  name: string;
  week52High: number | null; // from meta.fiftyTwoWeekHigh
  week52Low:  number | null; // from meta.fiftyTwoWeekLow
}

export interface YahooHistoryPoint {
  date: string; // YYYY-MM-DD
  close: number;
  volume: number;
}

export async function getYahooHistory(ticker: string): Promise<YahooHistoryPoint[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const volumes: (number | null)[] = result.indicators?.quote?.[0]?.volume ?? [];
    const points: YahooHistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close === null || close === undefined) continue;
      points.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close, volume: volumes[i] ?? 0 });
    }
    return points;
  } catch {
    return null;
  }
}

export async function getYahooChart(ticker: string): Promise<YahooChart | null> {
  try {
    // Use 1yr range so avg30Vol and 3M change both have enough data
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta ?? {};
    const quote = result.indicators?.quote?.[0] ?? {};
    const closes: number[] = (quote.close ?? []).filter((c: unknown) => c !== null && c !== undefined);
    const volumes: number[] = (quote.volume ?? []).filter((v: unknown) => v !== null && v !== undefined);

    const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const close21 = closes.length >= 21 ? closes[closes.length - 21] : closes[0];
    const close63 = closes.length >= 63 ? closes[closes.length - 63] : closes[0];
    const change1M = close21 ? Math.round(((price - close21) / close21) * 1000) / 10 : 0;
    const change3M = close63 ? Math.round(((price - close63) / close63) * 1000) / 10 : 0;

    // Use 30-day average to match calculateTechnicalMetrics in technicals.ts
    const recentVol = volumes[volumes.length - 1] ?? 0;
    const avg30Vol = volumes.length >= 30
      ? volumes.slice(-30).reduce((a, b) => a + b, 0) / 30
      : volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
    const relativeVolume = avg30Vol > 0 ? Math.round((recentVol / avg30Vol) * 100) / 100 : 1;

    const name      = meta.longName ?? meta.shortName ?? ticker;
    const marketCap = typeof meta.marketCap === "number" && meta.marketCap > 0 ? meta.marketCap : 0;
    const week52High = typeof meta.fiftyTwoWeekHigh === "number" && meta.fiftyTwoWeekHigh > 0 ? meta.fiftyTwoWeekHigh : null;
    const week52Low  = typeof meta.fiftyTwoWeekLow  === "number" && meta.fiftyTwoWeekLow  > 0 ? meta.fiftyTwoWeekLow  : null;

    return { price, change1M, change3M, relativeVolume, marketCap, name, week52High, week52Low };
  } catch {
    return null;
  }
}
