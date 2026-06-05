// /lib/stocks/types.ts
// Shared types for the enhanced scoring layer.
// Additive only — does not replace existing stock types.

export type DataSource = "yahoo" | "polygon" | "calculated" | "unavailable";

export interface ScoredMetric {
  value: number | string | null;
  score: number | null;      // 0–100 contribution score, null if data unavailable
  source: DataSource;
  reason?: string;
  modifier?: number;         // optional score modifier (revenue growth, etc.)
  daysUntilEarnings?: number | null;
}

export interface EnhancedStockScore {
  ticker: string;

  // Component scores (each 0–100, null = unavailable)
  momentumScore:     ScoredMetric;
  volatilityScore:   ScoredMetric;
  riskQualityScore:  ScoredMetric;   // analyst if real, else beta/range derived
  upsideScore:       ScoredMetric;   // analyst target if real, else 52w distance
  newsSentiment:     ScoredMetric;
  volumeScore:       ScoredMetric;
  revenueGrowthScore: ScoredMetric;
  earningsRiskScore:  ScoredMetric;
  rsRank:            ScoredMetric;   // relative strength rank 0–100 vs screened universe

  // Label flags — drive UI display
  hasRealAnalystConsensus: boolean;
  hasRealAnalystTarget:    boolean;

  // Composite
  riskAdjustedScore: number | null;
  finalRating: "Strong Watch" | "Watch" | "Neutral" | "Avoid" | "Insufficient Data";

  fetchedAt: string;
}

export interface PolygonTickerNews {
  id: string;
  title: string;
  description?: string;
  sentiment?: "positive" | "negative" | "neutral";
  sentiment_reasoning?: string;
  insights?: { sentiment: string; sentiment_reasoning: string }[];
  published_utc: string;
  publisher: { name: string };
}

export interface YahooQuoteSummaryResult {
  financialData?: {
    currentPrice?: { raw: number };
    targetMeanPrice?: { raw: number };
    targetHighPrice?: { raw: number };
    targetLowPrice?: { raw: number };
    numberOfAnalystOpinions?: { raw: number };
    recommendationKey?: string;
    recommendationMean?: { raw: number };
  };
  defaultKeyStatistics?: {
    beta?: { raw: number };
    shortPercentOfFloat?: { raw: number };
    forwardPE?: { raw: number };
  };
  recommendationTrend?: {
    trend?: {
      period: string;
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
    }[];
  };
  price?: {
    regularMarketPrice?: { raw: number };
    regularMarketVolume?: { raw: number };
    averageVolume?: { raw: number };
    regularMarketDayHigh?: { raw: number };
    regularMarketDayLow?: { raw: number };
    regularMarketOpen?: { raw: number };
    regularMarketPreviousClose?: { raw: number };
    fiftyTwoWeekHigh?: { raw: number };
    fiftyTwoWeekLow?: { raw: number };
  };
}
