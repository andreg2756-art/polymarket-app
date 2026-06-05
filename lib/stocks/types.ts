// /lib/stocks/types.ts
// Shared types for the enhanced scoring layer.
// Does not replace or extend existing stock types — additive only.

export type DataSource = "yahoo" | "polygon" | "calculated" | "unavailable";

export interface ScoredMetric {
  value: number | string | null;
  score: number | null;      // 0–100 contribution score, null if data unavailable
  source: DataSource;
  reason?: string;           // why the score is what it is
}

export interface EnhancedStockScore {
  ticker: string;

  // Component scores (each 0–100, null = data unavailable)
  momentumScore:     ScoredMetric;
  volatilityScore:   ScoredMetric;   // higher = less volatile (better)
  analystScore:      ScoredMetric;
  targetUpside:      ScoredMetric;   // % upside to analyst mean target
  newsSentiment:     ScoredMetric;   // -1 to 1 raw, 0–100 scored
  volumeScore:       ScoredMetric;

  // Composite
  riskAdjustedScore: number | null;  // weighted composite, 0–100
  finalRating:       "Strong Watch" | "Watch" | "Neutral" | "Avoid" | "Insufficient Data";

  fetchedAt: string; // ISO timestamp
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
