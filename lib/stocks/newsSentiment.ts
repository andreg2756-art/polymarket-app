// /lib/stocks/newsSentiment.ts
// News sentiment scoring.
// Priority: Polygon.io (if POLYGON_API_KEY set) → Yahoo Finance headlines + keyword scoring.
// Server-side only. API key never leaves the server.

import type { ScoredMetric } from "./types";
import { fetchPolygonNews, type PolygonArticle } from "./massive";

// ── Publisher weights ──────────────────────────────────────────────────────

const PUBLISHER_WEIGHTS: Record<string, number> = {
  "reuters":        1.0,
  "bloomberg":      1.0,
  "barrons":        0.9,
  "barron's":       0.9,
  "wall street journal": 0.9,
  "wsj":            0.9,
  "financial times": 0.85,
  "ft":             0.85,
  "cnbc":           0.75,
  "marketwatch":    0.7,
  "seeking alpha":  0.65,
  "business wire":  0.6,
  "pr newswire":    0.6,
  "globe newswire": 0.6,
  "benzinga":       0.55,
  "motley fool":    0.5,
};

function publisherWeight(name: string): number {
  const lower = name.toLowerCase();
  for (const [key, w] of Object.entries(PUBLISHER_WEIGHTS)) {
    if (lower.includes(key)) return w;
  }
  return 0.5; // unknown publisher
}

function recencyMultiplier(publishedUtc: string): number {
  const ageMs = Date.now() - new Date(publishedUtc).getTime();
  const ageH  = ageMs / 3600000;
  if (ageH < 24)  return 1.0;
  if (ageH < 72)  return 0.8;
  if (ageH < 168) return 0.6;
  return 0.4;
}

// ── Polygon sentiment scoring ──────────────────────────────────────────────

export interface NewsSentimentDetail {
  sentimentScore:  number;       // 0–100
  positiveCount:   number;
  negativeCount:   number;
  neutralCount:    number;
  articleCount:    number;
  confidence:      "High" | "Medium" | "Low";
  source:          "polygon" | "yahoo" | "unavailable";
  topPositive:     { title: string; publisher: string; url: string } | null;
  topNegative:     { title: string; publisher: string; url: string } | null;
}

function scorePolygonArticles(articles: PolygonArticle[]): NewsSentimentDetail {
  let weightedPos = 0, weightedNeg = 0, weightedNeu = 0, totalWeight = 0;
  let positiveCount = 0, negativeCount = 0, neutralCount = 0;
  let topPositive: NewsSentimentDetail["topPositive"] = null;
  let topNegative: NewsSentimentDetail["topNegative"] = null;
  let topPosWeight = -1, topNegWeight = -1;

  for (const article of articles) {
    const pubWeight  = publisherWeight(article.publisher?.name ?? "");
    const recWeight  = recencyMultiplier(article.published_utc);
    const weight     = pubWeight * recWeight;
    totalWeight     += weight;

    // Use Polygon insights if available, else keyword fallback on title
    const insights = article.insights ?? [];
    if (insights.length > 0) {
      // Average insights sentiment for this article
      let posHits = 0, negHits = 0, neuHits = 0;
      for (const ins of insights) {
        if (ins.sentiment === "positive") posHits++;
        else if (ins.sentiment === "negative") negHits++;
        else neuHits++;
      }
      const total = posHits + negHits + neuHits || 1;
      weightedPos += weight * (posHits / total);
      weightedNeg += weight * (negHits / total);
      weightedNeu += weight * (neuHits / total);

      if (posHits >= negHits && posHits >= neuHits) {
        positiveCount++;
        if (weight > topPosWeight) {
          topPosWeight = weight;
          topPositive = { title: article.title, publisher: article.publisher?.name ?? "", url: article.article_url };
        }
      } else if (negHits > posHits) {
        negativeCount++;
        if (weight > topNegWeight) {
          topNegWeight = weight;
          topNegative = { title: article.title, publisher: article.publisher?.name ?? "", url: article.article_url };
        }
      } else {
        neutralCount++;
      }
    } else {
      // Keyword fallback
      const raw = keywordSentiment(article.title);
      weightedPos += weight * Math.max(0, raw);
      weightedNeg += weight * Math.max(0, -raw);
      weightedNeu += weight * (raw === 0 ? 1 : 0);
      if (raw > 0) {
        positiveCount++;
        if (weight > topPosWeight) {
          topPosWeight = weight;
          topPositive = { title: article.title, publisher: article.publisher?.name ?? "", url: article.article_url };
        }
      } else if (raw < 0) {
        negativeCount++;
        if (weight > topNegWeight) {
          topNegWeight = weight;
          topNegative = { title: article.title, publisher: article.publisher?.name ?? "", url: article.article_url };
        }
      } else {
        neutralCount++;
      }
    }
  }

  if (totalWeight === 0) {
    return { sentimentScore: 50, positiveCount: 0, negativeCount: 0, neutralCount: 0, articleCount: 0, confidence: "Low" as const, source: "polygon", topPositive: null, topNegative: null };
  }

  // Weighted net sentiment → 0–100
  const netSentiment = (weightedPos - weightedNeg) / totalWeight;
  const sentimentScore = Math.round(Math.max(0, Math.min(100, 50 + netSentiment * 50)));

  return { sentimentScore, positiveCount, negativeCount, neutralCount, articleCount: articles.length, confidence: sentimentConfidence(articles.length, positiveCount, negativeCount), source: "polygon", topPositive, topNegative };
}

// ── Yahoo keyword fallback ─────────────────────────────────────────────────

// Phrase-level positive signals (checked before individual words)
const POSITIVE_PHRASES = [
  "beats estimate", "beat estimates", "beats expectations", "beat expectations",
  "revenue beats", "revenue beat", "earnings beat", "earnings beats",
  "eps beat", "eps beats", "raises guidance", "raised guidance",
  "record revenue", "record earnings", "record quarter", "record results",
  "profit growth", "profitable", "strong demand", "high risk-reward",
  "outperforms", "outperformed", "upgraded", "raises price target",
];

const POSITIVE_WORDS = [
  "beat", "beats", "surpass", "upgrade", "outperform",
  "rally", "surge", "approval", "launch", "profitable",
  "breakout", "bullish", "outperforms",
];

// Phrase-level negative signals — only materially bad events
const NEGATIVE_PHRASES = [
  "missed estimates", "misses estimates", "revenue miss", "earnings miss",
  "eps miss", "cuts guidance", "cut guidance", "lowered guidance",
  "weak outlook", "disappointing outlook", "falls after earnings",
  "plunges after", "wider loss", "offering at",
];

const NEGATIVE_WORDS = [
  "misses", "downgrade", "downgraded", "loss", "lawsuit",
  "bankruptcy", "investigation", "dilution", "plunges", "disappointing",
];

// Hard-override: these patterns are ALWAYS positive regardless of other words
const ALWAYS_POSITIVE_PATTERNS = [
  /\brevenue beats?\b/i,
  /\bearnings beats?\b/i,
  /\beps beats?\b/i,
  /beats?\s+estimates?\b/i,
  /beats?\s+expectations?\b/i,
  /\brecord\s+(revenue|earnings|quarter|results)\b/i,
  /\braises?\s+guidance\b/i,
  /\bfda\s+approv/i,
];

// Hard-override: these patterns cancel a positive classification
const ALWAYS_NEGATIVE_PATTERNS = [
  /\bcuts?\s+guidance\b/i,
  /\blowered?\s+guidance\b/i,
  /\bwider\s+loss\b/i,
  /\bfalls?\s+after\s+earnings\b/i,
  /\boffering\s+at\b/i,
  /\bbankruptcy\b/i,
  /\blawsuit\b/i,
];

export function classifySentiment(title: string): number {
  // Check always-positive first
  for (const pat of ALWAYS_POSITIVE_PATTERNS) {
    if (pat.test(title)) return 1;
  }
  // Check always-negative
  for (const pat of ALWAYS_NEGATIVE_PATTERNS) {
    if (pat.test(title)) return -1;
  }

  const t = title.toLowerCase();
  const posPhrase = POSITIVE_PHRASES.filter((p) => t.includes(p)).length;
  const negPhrase = NEGATIVE_PHRASES.filter((p) => t.includes(p)).length;
  const posWord   = POSITIVE_WORDS.filter((w) => t.includes(w)).length;
  const negWord   = NEGATIVE_WORDS.filter((w) => t.includes(w)).length;

  // Phrases outweigh individual words (2:1)
  const pos = posPhrase * 2 + posWord;
  const neg = negPhrase * 2 + negWord;

  if (pos + neg === 0) return 0;
  // Negative wins only when it is materially stronger
  const net = (pos - neg) / (pos + neg);
  // Tiebreak toward neutral rather than negative
  return Math.abs(net) < 0.2 ? 0 : net;
}

// Backwards-compatible alias used internally
function keywordSentiment(title: string): number {
  return classifySentiment(title);
}

// Confidence label based on article count and signal clarity
export function sentimentConfidence(articleCount: number, positiveCount: number, negativeCount: number): "High" | "Medium" | "Low" {
  if (articleCount >= 10 && Math.abs(positiveCount - negativeCount) >= 3) return "High";
  if (articleCount >= 5)  return "Medium";
  return "Low";
}

async function fetchYahooHeadlines(ticker: string): Promise<{ title: string; publisher: string; link: string; published: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=10&quotesCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.news ?? []).map((n: { title?: string; publisher?: string; link?: string; providerPublishTime?: number }) => ({
      title: n.title ?? "",
      publisher: n.publisher ?? "",
      link: n.link ?? "",
      published: n.providerPublishTime ?? 0,
    }));
  } catch {
    return [];
  }
}

function scoreYahooHeadlines(headlines: Awaited<ReturnType<typeof fetchYahooHeadlines>>): NewsSentimentDetail {
  let weightedNet = 0, totalWeight = 0;
  let positiveCount = 0, negativeCount = 0, neutralCount = 0;
  let topPositive: NewsSentimentDetail["topPositive"] = null;
  let topNegative: NewsSentimentDetail["topNegative"] = null;
  let topPosWeight = -1, topNegWeight = -1;

  for (const h of headlines) {
    const raw    = keywordSentiment(h.title);
    const pubW   = publisherWeight(h.publisher);
    const recW   = h.published ? recencyMultiplier(new Date(h.published * 1000).toISOString()) : 0.5;
    const weight = pubW * recW;
    totalWeight += weight;
    weightedNet += raw * weight;

    if (raw > 0) {
      positiveCount++;
      if (weight > topPosWeight) { topPosWeight = weight; topPositive = { title: h.title, publisher: h.publisher, url: h.link }; }
    } else if (raw < 0) {
      negativeCount++;
      if (weight > topNegWeight) { topNegWeight = weight; topNegative = { title: h.title, publisher: h.publisher, url: h.link }; }
    } else {
      neutralCount++;
    }
  }

  if (!totalWeight) return { sentimentScore: 50, positiveCount: 0, negativeCount: 0, neutralCount: 0, articleCount: 0, confidence: "Low" as const, source: "yahoo", topPositive: null, topNegative: null };

  const sentimentScore = Math.round(Math.max(0, Math.min(100, 50 + (weightedNet / totalWeight) * 50)));
  return { sentimentScore, positiveCount, negativeCount, neutralCount, articleCount: headlines.length, confidence: sentimentConfidence(headlines.length, positiveCount, negativeCount), source: "yahoo", topPositive, topNegative };
}

// ── Public export ──────────────────────────────────────────────────────────

export async function getNewsSentimentScore(ticker: string): Promise<ScoredMetric & { detail: NewsSentimentDetail | null }> {
  try {
    // Try Polygon first
    if (process.env.POLYGON_API_KEY) {
      const articles = await fetchPolygonNews(ticker, 20);
      if (articles.length > 0) {
        const detail = scorePolygonArticles(articles);
        return {
          value: detail.sentimentScore.toFixed(0),
          score: detail.sentimentScore,
          source: "polygon",
          reason: `${detail.articleCount} articles — ${detail.positiveCount} positive, ${detail.negativeCount} negative, ${detail.neutralCount} neutral (weighted by publisher + recency)`,
          detail,
        };
      }
    }

    // Yahoo fallback
    const headlines = await fetchYahooHeadlines(ticker);
    if (headlines.length > 0) {
      const detail = scoreYahooHeadlines(headlines);
      return {
        value: detail.sentimentScore.toFixed(0),
        score: detail.sentimentScore,
        source: "yahoo",
        reason: `${detail.articleCount} headlines — ${detail.positiveCount} positive, ${detail.negativeCount} negative (keyword scoring)`,
        detail,
      };
    }

    return { value: null, score: null, source: "unavailable", reason: "No recent headlines found", detail: null };
  } catch {
    return { value: null, score: null, source: "unavailable", reason: "News sentiment fetch failed", detail: null };
  }
}
