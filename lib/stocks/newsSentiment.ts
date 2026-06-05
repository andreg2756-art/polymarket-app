// /lib/stocks/newsSentiment.ts
// News sentiment scoring.
// Uses Polygon.io if POLYGON_API_KEY is set, otherwise falls back
// to keyword analysis on Yahoo Finance headlines already fetched
// by the existing /api/stocks/news/[ticker] route.

import type { ScoredMetric, PolygonTickerNews } from "./types";

const POSITIVE_WORDS = [
  "beat", "surpass", "record", "growth", "upgrade", "strong", "raise",
  "accelerat", "partnership", "win", "contract", "expand", "rally", "surge",
  "outperform", "buy", "profit", "revenue", "opportunity", "momentum",
  "bullish", "upside", "breakout", "approval", "launch",
];

const NEGATIVE_WORDS = [
  "miss", "disappoint", "downgrade", "weak", "cut", "decline", "loss",
  "dilut", "lawsuit", "recall", "warning", "risk", "fall", "drop", "plunge",
  "sell", "bearish", "debt", "bankruptcy", "investigation", "probe", "fine",
  "resign", "depart", "layoff", "restructur", "withdraw",
];

function keywordSentiment(titles: string[]): number {
  if (!titles.length) return 0;
  let total = 0;
  for (const title of titles) {
    const t = title.toLowerCase();
    const pos = POSITIVE_WORDS.filter((w) => t.includes(w)).length;
    const neg = NEGATIVE_WORDS.filter((w) => t.includes(w)).length;
    total += (pos - neg) / Math.max(pos + neg, 1);
  }
  return Math.max(-1, Math.min(1, total / titles.length));
}

// Convert raw sentiment (-1 to 1) to 0–100 score
function sentimentToScore(raw: number): number {
  return Math.round(((raw + 1) / 2) * 100);
}

async function fetchPolygonSentiment(ticker: string): Promise<number | null> {
  const key = process.env.POLYGON_API_KEY;
  if (!key) return null;

  try {
    const url = `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(ticker)}&limit=10&apiKey=${key}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const articles: PolygonTickerNews[] = data?.results ?? [];
    if (!articles.length) return null;

    let sentimentSum = 0;
    let count = 0;

    for (const article of articles) {
      // Polygon sometimes provides per-article sentiment in insights
      const insights = article.insights ?? [];
      for (const insight of insights) {
        if (insight.sentiment === "positive") { sentimentSum += 1; count++; }
        else if (insight.sentiment === "negative") { sentimentSum -= 1; count++; }
        else if (insight.sentiment === "neutral") { count++; }
      }
      // Fallback: top-level sentiment field
      if (!insights.length && article.sentiment) {
        if (article.sentiment === "positive") { sentimentSum += 1; count++; }
        else if (article.sentiment === "negative") { sentimentSum -= 1; count++; }
        else { count++; }
      }
    }

    if (!count) return null;
    return sentimentSum / count; // -1 to 1
  } catch {
    return null;
  }
}

async function fetchYahooHeadlines(ticker: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=8&quotesCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.news ?? []).map((n: { title?: string }) => n.title ?? "");
  } catch {
    return [];
  }
}

export async function getNewsSentimentScore(ticker: string): Promise<ScoredMetric> {
  try {
    // Try Polygon first if key is available
    const polygonRaw = await fetchPolygonSentiment(ticker);
    if (polygonRaw !== null) {
      const score = sentimentToScore(polygonRaw);
      return {
        value: polygonRaw.toFixed(3),
        score,
        source: "polygon",
        reason: score >= 60 ? "Positive media coverage" : score <= 40 ? "Negative media coverage" : "Mixed/neutral coverage",
      };
    }

    // Fallback: Yahoo Finance headlines + keyword scoring
    const headlines = await fetchYahooHeadlines(ticker);
    if (!headlines.length) {
      return { value: null, score: null, source: "unavailable", reason: "No recent headlines found" };
    }

    const rawSentiment = keywordSentiment(headlines);
    const score = sentimentToScore(rawSentiment);
    return {
      value: rawSentiment.toFixed(3),
      score,
      source: "yahoo",
      reason: score >= 60
        ? `Positive signals in ${headlines.length} headlines`
        : score <= 40
        ? `Negative signals in ${headlines.length} headlines`
        : `Neutral/mixed across ${headlines.length} headlines`,
    };
  } catch {
    return { value: null, score: null, source: "unavailable", reason: "News sentiment fetch failed" };
  }
}
