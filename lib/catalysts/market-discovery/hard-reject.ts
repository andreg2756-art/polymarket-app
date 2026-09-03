// Deterministic first-pass rejection (spec Part 3). This runs BEFORE
// family classification — its job is only to catch the obviously
// irrelevant majority of Polymarket's active markets (sports, esports,
// celebrity, memes, tweet counts, entertainment) cheaply, via tags, before
// spending any classification effort on them. Anything not caught here
// still goes through economic-relevance classification, which can (and
// often will) also conclude NONE/LOW for genuinely uninteresting markets —
// this layer exists for the high-confidence, high-volume-of-cases part of
// that job, not as the only line of defense.

import type { RawMarketCandidate } from "./types";

// Tag slugs observed on Polymarket that are reliably non-economic. Real
// tag slugs confirmed against the live Gamma API's /events endpoint
// (2026-09-03 sample of the top 100 active-by-volume events) rather than
// guessed — sports/esports/entertainment tags dominate that list by count
// even though they rarely dominate by economic relevance, which is
// exactly spec Part 28's point.
const REJECT_TAGS = new Set([
  "sports", "nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball",
  "baseball", "hockey", "tennis", "golf", "boxing", "mma", "ufc", "cricket",
  "rugby", "olympics", "esports", "counter-strike-2", "dota-2", "league-of-legends",
  "valorant", "games", "gaming",
  "pop-culture", "entertainment", "movies", "tv", "television", "music",
  "celebrity", "celebrities", "awards", "grammys", "oscars", "reality-tv",
  "tweets-markets", "twitter", "social-media", "youtube", "tiktok", "streamers",
  "gossip", "dating",
]);

// Title/description patterns for non-economic culture/politics-adjacent
// questions that don't reliably carry a distinguishing tag (spec Part 3's
// "politician phrases," "debate performance," "endorsements," "approval
// polls," "who attends").
const REJECT_TITLE_PATTERNS: RegExp[] = [
  /approval rating/i,
  /\bapproves? of\b/i,
  /win(s)? the debate/i,
  /debate performance/i,
  /endorse(s|d|ment)?/i,
  /says? the (word|phrase)/i,
  /will .* attend/i,
  /number of (times|tweets)/i,
  /# ?of tweets/i,
];

// Spec Part 3's explicit exception: a hard-reject signal can be overridden
// when the market ALSO carries a genuine regulatory/company-specific
// economic signal (e.g. a drug-approval market that happens to also be
// tagged under a broad "healthcare" or "biotech" umbrella that a naive
// keyword pass might otherwise associate with entertainment/lifestyle
// content). Kept deliberately narrow and keyword-based — this is NOT a
// company gazetteer, just a check that a regulatory-action phrase and an
// economic-sounding tag both appear before letting a market survive.
const REGULATORY_OVERRIDE_KEYWORDS = [
  /fda approv/i,
  /drug approv/i,
  /sec approv/i,
  /merger approv/i,
  /antitrust ruling/i,
  /regulatory approval/i,
];
const OVERRIDE_ECONOMIC_TAGS = new Set(["healthcare", "biotech", "pharma", "fda", "regulation", "finance", "crypto-regulation"]);

/**
 * Direct stock/crypto price-target markets (spec Part 21) — "Will SPY hit
 * X / Will AAPL reach Y" creates circular "prediction -> catalyst -> same
 * asset outlook" logic and must never enter the Catalyst pipeline.
 *
 * Deliberately does NOT catch commodity price-threshold markets (WTI
 * crude, gold, copper "closes above $X") even though Polymarket tags some
 * of them "hit-price" too — a commodity's price level is a genuine
 * economic INPUT that other companies are exposed to (this is exactly how
 * the hand-curated CATALYST_V1 engine already treats oil/copper), not a
 * company predicting its own price. Confirmed live that Polymarket applies
 * "hit-price" inconsistently across near-identical WTI markets, so tag
 * presence alone isn't a reliable signal here — the commodity-tag check
 * below has to run first and is authoritative.
 */
const DIRECT_SENTIMENT_TAGS = new Set(["crypto-prices", "stock-price"]);
const COMMODITY_TAGS = new Set(["commodities", "oil", "oil-prices", "crude-oil", "natural-gas", "gold", "silver", "copper", "wheat", "corn"]);
const DIRECT_SENTIMENT_TITLE_PATTERN = /\b(will\s+)?([A-Z]{2,6}|bitcoin|ethereum|btc|eth)\b.*(hit|reach|closes? above|closes? below|be above|be below|top|exceed)/i;

export function isDirectMarketSentiment(candidate: RawMarketCandidate): boolean {
  const tagSet = new Set(candidate.tags);
  const isCommodity = [...COMMODITY_TAGS].some((t) => tagSet.has(t));
  if (isCommodity) return false;

  if (candidate.tags.some((t) => DIRECT_SENTIMENT_TAGS.has(t)) || tagSet.has("hit-price")) return true;
  return DIRECT_SENTIMENT_TITLE_PATTERN.test(candidate.title);
}

export interface HardRejectResult {
  rejected: boolean;
  reasons: string[];
}

export function evaluateHardReject(candidate: RawMarketCandidate): HardRejectResult {
  const matchedRejectTags = candidate.tags.filter((t) => REJECT_TAGS.has(t));
  const matchedTitlePattern = REJECT_TITLE_PATTERNS.find((p) => p.test(candidate.title));

  if (matchedRejectTags.length === 0 && !matchedTitlePattern) {
    return { rejected: false, reasons: [] };
  }

  // Check the narrow regulatory/company override before finalizing rejection.
  const hasRegulatoryPhrase = REGULATORY_OVERRIDE_KEYWORDS.some((p) => p.test(candidate.title) || p.test(candidate.description));
  const hasEconomicTag = candidate.tags.some((t) => OVERRIDE_ECONOMIC_TAGS.has(t));
  if (hasRegulatoryPhrase && hasEconomicTag) {
    return { rejected: false, reasons: [] };
  }

  const reasons: string[] = [];
  if (matchedRejectTags.length > 0) reasons.push(`Tagged as non-economic: ${matchedRejectTags.join(", ")}`);
  if (matchedTitlePattern) reasons.push(`Title matches a non-economic pattern: ${matchedTitlePattern.source}`);
  return { rejected: true, reasons };
}
