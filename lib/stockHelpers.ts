// /lib/stockHelpers.ts
// Safe helper functions for stock metric formatting, confidence, and risk flags.
// All functions handle null, undefined, NaN, and zero-division safely.

// ── Formatters ────────────────────────────────────────────────────────────

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !isFinite(value)) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3)  return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// ── 52-week distance ──────────────────────────────────────────────────────

export function calculateDistanceFromHigh(
  price: number | null | undefined,
  high52w: number | null | undefined
): number | null {
  if (!price || !high52w || !isFinite(price) || !isFinite(high52w) || high52w === 0) return null;
  return ((price - high52w) / high52w) * 100;
}

// ── Metric confidence ─────────────────────────────────────────────────────

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Unavailable";

/** Rules:
 *  Calculated from price/history         → High
 *  Yahoo Finance quote data               → Medium
 *  Yahoo Finance fundamentals/earnings    → Low
 *  Missing / null                         → Unavailable
 */
export function getMetricConfidence(
  source: "price" | "calculated" | "yahoo_quote" | "yahoo_fundamentals" | "unavailable",
  value?: unknown
): ConfidenceLevel {
  if (value === null || value === undefined || value === "N/A" || value === "") return "Unavailable";
  switch (source) {
    case "price":
    case "calculated":       return "High";
    case "yahoo_quote":      return "Medium";
    case "yahoo_fundamentals": return "Low";
    default:                 return "Unavailable";
  }
}

// ── Risk flags ────────────────────────────────────────────────────────────

export type RiskSeverity = "Low" | "Medium" | "High";

export interface RiskFlag {
  label:       string;
  severity:    RiskSeverity;
  explanation: string;
}

export interface RiskFlagResult {
  confirmed:    RiskFlag[];   // real, data-backed risk signals
  dataWarnings: RiskFlag[];   // missing or unverifiable data
}

interface RiskInputs {
  symbol?:         string;
  price:           number;
  marketCap:       number;
  change1M:        number;
  change3M:        number;
  relativeVolume:  number;
  averageVolume:   number | null | undefined;
  revenueGrowth:   number | null | undefined;  // 0 = unavailable
  lastEarningsDate: string | null | undefined;
  nextEarningsDate: string | null | undefined;
  sma200:          number | null | undefined;
  cash:            unknown;
  totalDebt:       unknown;
}

/** Safely coerce any volume-like value to a number or null. */
function safeVolume(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

/** Safely coerce any growth-like value to a number or null (0 = unavailable). */
function safeGrowth(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) && n !== 0 ? n : null;
}

function fmtCap(n: number): string {
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export function generateRiskFlags(inputs: RiskInputs): RiskFlagResult {
  const confirmed:    RiskFlag[] = [];
  const dataWarnings: RiskFlag[] = [];

  const {
    symbol, price, marketCap, change1M,
    lastEarningsDate, nextEarningsDate, sma200,
    cash, totalDebt,
  } = inputs;

  const avgVol      = safeVolume(inputs.averageVolume);
  const revGrowth   = safeGrowth(inputs.revenueGrowth);

  // ── Confirmed risk flags ─────────────────────────────────────────────────

  // Low Liquidity — only when we *have* the data and it's below threshold
  if (avgVol !== null && avgVol < 250_000) {
    confirmed.push({
      label:       "Low Liquidity",
      severity:    "High",
      explanation: `Average daily volume is ${(avgVol / 1000).toFixed(0)}K, below 250K. Thin markets can cause large bid/ask spreads and sharp moves.`,
    });
  }

  // Microcap Risk — graded severity
  if (marketCap > 0 && marketCap < 300_000_000) {
    confirmed.push({
      label:       "Microcap Risk",
      severity:    marketCap < 100_000_000 ? "High" : "Medium",
      explanation: `Market cap is ${fmtCap(marketCap)}, below $300M. Smaller companies can have higher volatility and dilution risk.`,
    });
  }

  // Negative Revenue Growth
  if (revGrowth !== null && revGrowth < 0) {
    confirmed.push({
      label:       "Negative Revenue Growth",
      severity:    "Medium",
      explanation: `Revenue growth is ${revGrowth.toFixed(1)}% YoY. Declining revenue is a fundamental risk for long-term holders.`,
    });
  }

  // Earnings Within 7 Days
  if (nextEarningsDate) {
    const days = Math.floor((new Date(nextEarningsDate).getTime() - Date.now()) / 86_400_000);
    if (isFinite(days) && days >= 0 && days <= 7) {
      confirmed.push({
        label:       "Earnings Within 7 Days",
        severity:    "High",
        explanation: `Earnings are expected ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}. Binary event risk — stocks can move sharply in either direction.`,
      });
    }
  }

  // Extended 1-Month Move
  if (isFinite(change1M) && change1M > 50) {
    confirmed.push({
      label:       "Extended 1-Month Move",
      severity:    "Medium",
      explanation: `1-month return is +${change1M.toFixed(1)}%. Extended short-term moves increase mean-reversion risk.`,
    });
  }

  // Below 200-Day MA
  if (sma200 !== null && sma200 !== undefined && isFinite(sma200) && sma200 > 0 && isFinite(price) && price < sma200) {
    confirmed.push({
      label:       "Below 200-Day MA",
      severity:    "Medium",
      explanation: `Price ($${price.toFixed(2)}) is below the 200-day moving average ($${sma200.toFixed(2)}), indicating a weak long-term trend.`,
    });
  }

  // ── Data Quality Warnings ────────────────────────────────────────────────

  // Liquidity Unknown — when volume data is missing
  if (avgVol === null) {
    dataWarnings.push({
      label:       "Liquidity Unknown",
      severity:    "Medium",
      explanation: "Average volume data is unavailable, so liquidity cannot be verified.",
    });
  }

  // Missing fields — collect then emit one grouped warning
  const missingFields: string[] = [];
  if (revGrowth === null)                                  missingFields.push("revenue growth");
  if (!cash && cash !== 0)                                 missingFields.push("cash");
  if (!totalDebt && totalDebt !== 0)                       missingFields.push("debt");
  if (!lastEarningsDate && !nextEarningsDate)              missingFields.push("earnings dates");

  if (missingFields.length > 0) {
    const severity: RiskSeverity = missingFields.length >= 4 ? "Medium" : missingFields.length >= 2 ? "Medium" : "Low";
    dataWarnings.push({
      label:       "Missing Fundamentals",
      severity,
      explanation: `${missingFields.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ")} data ${missingFields.length === 1 ? "is" : "are"} unavailable. Confidence in the analysis is reduced.`,
    });
  }

  // Dev-only logging
  if (process.env.NODE_ENV === "development") {
    console.debug("[RiskFlags]", {
      symbol,
      marketCap,
      averageVolume: inputs.averageVolume,
      revenueGrowth: inputs.revenueGrowth,
      cash,
      totalDebt,
      nextEarningsDate,
      confirmed: confirmed.map((f) => `${f.label} (${f.severity})`),
      dataWarnings: dataWarnings.map((f) => `${f.label} (${f.severity})`),
    });
  }

  return { confirmed, dataWarnings };
}
