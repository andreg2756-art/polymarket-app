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

interface RiskInputs {
  price:           number;
  marketCap:       number;
  change1M:        number;
  change3M:        number;
  relativeVolume:  number;
  averageVolume:   number | null;
  revenueGrowth:   number | null;   // raw number, 0 = unavailable
  lastEarningsDate: string | null;
  nextEarningsDate: string | null;
  sma200:          number | null;
  cash:            unknown;
  totalDebt:       unknown;
}

export function generateRiskFlags(inputs: RiskInputs): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const {
    price, marketCap, change1M, relativeVolume, averageVolume,
    revenueGrowth, lastEarningsDate, nextEarningsDate, sma200,
    cash, totalDebt,
  } = inputs;

  // Low liquidity
  if (averageVolume === null || averageVolume < 250_000) {
    flags.push({
      label:       "Low Liquidity",
      severity:    "High",
      explanation: averageVolume === null
        ? "Average volume data is unavailable — liquidity cannot be verified."
        : `Average daily volume is ${(averageVolume / 1000).toFixed(0)}K, below the 250K threshold. Thin markets can cause large bid/ask spreads and sharp moves.`,
    });
  }

  // Microcap risk
  if (marketCap > 0 && marketCap < 300_000_000) {
    flags.push({
      label:       "Microcap Risk",
      severity:    "High",
      explanation: `Market cap is ${marketCap >= 1e6 ? `$${(marketCap / 1e6).toFixed(0)}M` : "very small"}, below $300M. Microcaps carry higher volatility, dilution risk, and lower analyst coverage.`,
    });
  }

  // Negative revenue growth
  if (revenueGrowth !== null && revenueGrowth !== 0 && revenueGrowth < 0) {
    flags.push({
      label:       "Negative Revenue Growth",
      severity:    "Medium",
      explanation: `Revenue growth is ${revenueGrowth.toFixed(1)}% YoY. Declining revenue is a fundamental risk for long-term holders.`,
    });
  }

  // Earnings soon
  if (nextEarningsDate) {
    const days = Math.floor((new Date(nextEarningsDate).getTime() - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 7) {
      flags.push({
        label:       "Earnings Within 7 Days",
        severity:    "High",
        explanation: `Earnings are expected ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}. Binary event risk — stocks can gap significantly in either direction.`,
      });
    }
  }

  // Extended move
  if (change1M > 50) {
    flags.push({
      label:       "Extended 1-Month Move",
      severity:    "Medium",
      explanation: `1-month return is +${change1M.toFixed(1)}%. Extended short-term moves increase reversion risk. Consider whether the move has fundamental support.`,
    });
  }

  // Below 200D MA
  if (sma200 !== null && sma200 > 0 && price < sma200) {
    flags.push({
      label:       "Below 200-Day MA",
      severity:    "Medium",
      explanation: `Price ($${price.toFixed(2)}) is below the 200-day moving average ($${sma200.toFixed(2)}). Weak long-term trend.`,
    });
  }

  // Missing fundamentals
  const missingFundamentals: string[] = [];
  if (!revenueGrowth) missingFundamentals.push("revenue growth");
  if (!cash && cash !== 0)    missingFundamentals.push("cash");
  if (!totalDebt && totalDebt !== 0) missingFundamentals.push("debt");
  if (!lastEarningsDate && !nextEarningsDate) missingFundamentals.push("earnings dates");
  if (missingFundamentals.length > 0) {
    flags.push({
      label:       "Missing Fundamentals",
      severity:    "Low",
      explanation: `The following data is unavailable: ${missingFundamentals.join(", ")}. Confidence in the analysis is reduced.`,
    });
  }

  return flags;
}
