// /lib/stocks/technicals.ts
// Calculates technical metrics from Yahoo Finance daily price history.
// Does NOT touch existing yahoo-finance.ts — additive only.

export type ExtraStockMetrics = {
  sma50:               number | null;
  sma200:              number | null;
  priceVsSma50Pct:     number | null;
  priceVsSma200Pct:    number | null;
  oneMonthReturnPct:   number | null;
  threeMonthReturnPct: number | null;
  averageVolume:       number | null;
  relativeVolume:      number | null;
  floatShares:         number | null;
  freeFloatPct:        number | null;
  outstandingShares:   number | null;
  floatTurnover:       number | null;
  // 52-week range
  week52High:          number | null;
  week52Low:           number | null;
  distanceToHighPct:   number | null;  // negative = below 52w high
  rangePositionPct:    number | null;  // 0 = at 52w low, 100 = at 52w high
  // float market cap
  floatMarketCap:      number | null;
};

export interface PriceCandle {
  close:  number;
  volume: number;
}

// ── Calculations ───────────────────────────────────────────────────────────

function sma(closes: number[], periods: number): number | null {
  if (closes.length < periods) return null;
  const slice = closes.slice(-periods);
  return slice.reduce((a, b) => a + b, 0) / periods;
}

function pctDiff(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export function calculateTechnicalMetrics(
  candles: PriceCandle[],
  currentPrice: number,
  currentVolume: number
): Omit<ExtraStockMetrics, "floatShares" | "freeFloatPct" | "outstandingShares" | "floatTurnover" | "floatMarketCap"> {
  const closes  = candles.map((c) => c.close).filter((v) => isFinite(v) && v > 0);
  const volumes = candles.map((c) => c.volume).filter((v) => isFinite(v) && v >= 0);

  const sma50  = sma(closes, 50);
  const sma200 = sma(closes, 200);

  const price = currentPrice > 0 ? currentPrice : (closes[closes.length - 1] ?? 0);

  const close21 = closes.length >= 21 ? closes[closes.length - 21] : null;
  const close63 = closes.length >= 63 ? closes[closes.length - 63] : null;

  const oneMonthReturnPct   = pctDiff(price, close21);
  const threeMonthReturnPct = pctDiff(price, close63);

  const priceVsSma50Pct  = pctDiff(price, sma50);
  const priceVsSma200Pct = pctDiff(price, sma200);

  const avgVol30 = volumes.length >= 30
    ? volumes.slice(-30).reduce((a, b) => a + b, 0) / 30
    : volumes.length > 0
    ? volumes.reduce((a, b) => a + b, 0) / volumes.length
    : null;

  const relativeVolume = avgVol30 && avgVol30 > 0
    ? Math.round((currentVolume / avgVol30) * 100) / 100
    : null;

  // 52-week range from last ~252 trading days of candles
  const last252 = closes.slice(-252);
  const week52High = last252.length > 0 ? Math.max(...last252) : null;
  const week52Low  = last252.length > 0 ? Math.min(...last252) : null;
  const distanceToHighPct = week52High && price > 0
    ? Math.round(((price - week52High) / week52High) * 1000) / 10
    : null;
  const rangePositionPct =
    week52High !== null && week52Low !== null && week52High > week52Low
      ? Math.round(((price - week52Low) / (week52High - week52Low)) * 1000) / 10
      : null;

  return {
    sma50:               sma50   !== null ? Math.round(sma50   * 100) / 100 : null,
    sma200:              sma200  !== null ? Math.round(sma200  * 100) / 100 : null,
    priceVsSma50Pct,
    priceVsSma200Pct,
    oneMonthReturnPct,
    threeMonthReturnPct,
    averageVolume:       avgVol30 !== null ? Math.round(avgVol30) : null,
    relativeVolume,
    week52High:          week52High  !== null ? Math.round(week52High  * 100) / 100 : null,
    week52Low:           week52Low   !== null ? Math.round(week52Low   * 100) / 100 : null,
    distanceToHighPct,
    rangePositionPct,
  };
}

// ── Yahoo 1-year daily fetch ───────────────────────────────────────────────

export async function fetchYahooDailyCandles(ticker: string): Promise<PriceCandle[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const quote   = result.indicators?.quote?.[0] ?? {};
    const closes: (number | null)[]  = quote.close  ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    const candles: PriceCandle[] = [];
    for (let i = 0; i < closes.length; i++) {
      const c = closes[i];
      const v = volumes[i];
      if (c !== null && c !== undefined && isFinite(c) && c > 0) {
        candles.push({ close: c, volume: v ?? 0 });
      }
    }
    return candles;
  } catch {
    return [];
  }
}

/**
 * Fetch 1-year daily candles. Tries Yahoo first; falls back to Polygon
 * when Yahoo returns fewer than 50 candles (rate-limited or blocked).
 * Requires POLYGON_API_KEY for the fallback to activate.
 */
export async function fetchDailyCandlesWithFallback(ticker: string): Promise<PriceCandle[]> {
  const yahoo = await fetchYahooDailyCandles(ticker);
  if (yahoo.length >= 50) return yahoo;

  // Polygon fallback — only used when Yahoo is insufficient
  try {
    const { fetchPolygonDailyCandles } = await import("./massive");
    const now  = new Date();
    const from = new Date(now.getTime() - 370 * 86_400_000);
    const fmt  = (d: Date) => d.toISOString().split("T")[0];
    const pg   = await fetchPolygonDailyCandles(ticker, fmt(from), fmt(now));
    if (pg.length > yahoo.length) {
      return pg.map((c) => ({ close: c.close, volume: c.volume }));
    }
  } catch { /* Polygon not configured — ignore */ }

  return yahoo;
}

// ── FMP float data ─────────────────────────────────────────────────────────

interface FmpFloatResponse {
  symbol:           string;
  floatShares?:     number;
  freeFloat?:       number;
  outstandingShares?: number;
  date?:            string;
}

export async function getFmpFloatData(symbol: string): Promise<Pick<ExtraStockMetrics, "floatShares" | "freeFloatPct" | "outstandingShares">> {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    return { floatShares: null, freeFloatPct: null, outstandingShares: null };
  }

  try {
    const url = `https://financialmodelingprep.com/stable/shares-float?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`[fmp-float] HTTP ${res.status} for ${symbol}`);
      return { floatShares: null, freeFloatPct: null, outstandingShares: null };
    }
    const data: FmpFloatResponse[] = await res.json();
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { floatShares: null, freeFloatPct: null, outstandingShares: null };

    return {
      floatShares:      typeof row.floatShares === "number"      ? row.floatShares      : null,
      freeFloatPct:     typeof row.freeFloat   === "number"      ? row.freeFloat        : null,
      outstandingShares: typeof row.outstandingShares === "number" ? row.outstandingShares : null,
    };
  } catch (err) {
    console.warn(`[fmp-float] failed for ${symbol}:`, err);
    return { floatShares: null, freeFloatPct: null, outstandingShares: null };
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export async function getExtraStockMetrics(
  ticker: string,
  currentPrice: number,
  currentVolume: number
): Promise<ExtraStockMetrics> {
  const [candles, floatData] = await Promise.all([
    fetchYahooDailyCandles(ticker),
    getFmpFloatData(ticker),
  ]);

  const technicals = calculateTechnicalMetrics(candles, currentPrice, currentVolume);

  const floatTurnover =
    currentVolume > 0 && floatData.floatShares && floatData.floatShares > 0
      ? Math.round((currentVolume / floatData.floatShares) * 10000) / 10000
      : null;

  const floatMarketCap =
    currentPrice > 0 && floatData.floatShares && floatData.floatShares > 0
      ? Math.round(currentPrice * floatData.floatShares)
      : null;

  return {
    ...technicals,
    ...floatData,
    floatTurnover,
    floatMarketCap,
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function fmtLargeNum(n: number | null): string {
  if (n === null || !isFinite(n)) return "N/A";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function fmtPct(n: number | null, decimals = 1): string {
  if (n === null || !isFinite(n)) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}
