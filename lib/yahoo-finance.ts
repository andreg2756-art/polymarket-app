export interface YahooChart {
  price: number;
  change1M: number;
  change3M: number;
  relativeVolume: number;
  marketCap: number;
  name: string;
}

export async function getYahooChart(ticker: string): Promise<YahooChart | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
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

    const recentVol = volumes[volumes.length - 1] ?? 0;
    const avg20Vol = volumes.length >= 20
      ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
      : volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
    const relativeVolume = avg20Vol > 0 ? Math.round((recentVol / avg20Vol) * 10) / 10 : 1;

    const marketCap = meta.marketCap ?? 0;
    const name = meta.longName ?? meta.shortName ?? ticker;

    return { price, change1M, change3M, relativeVolume, marketCap, name };
  } catch {
    return null;
  }
}
