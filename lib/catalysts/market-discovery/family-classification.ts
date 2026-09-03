// Market-family taxonomy and classifier (spec Parts 5-6, 18-19). Rules are
// deterministic tag/keyword pattern matching, not an LLM — per spec Part
// 29, an LLM may someday SUGGEST a family for review, but the classifier
// that actually runs here must be reproducible from its inputs.
//
// Tag slugs below are drawn from a live sample of Polymarket's Gamma API
// (/events, top 100 active-by-volume, 2026-09-03) plus spec Part 19's
// enumerated market types used as classification patterns, not a
// hand-picked whitelist of specific markets — the whole point of this
// pipeline is that a NEW market matching one of these patterns gets
// classified automatically, without anyone adding its specific ID anywhere.

import type { MarketFamily, RawMarketCandidate } from "./types";

interface FamilyRule {
  family: MarketFamily;
  tags: string[]; // any one match is sufficient
  titlePatterns?: RegExp[]; // used when no tag matched, or to assign a subfamily
  subfamilyRules?: { subfamily: string; tags?: string[]; titlePattern?: RegExp }[];
}

// Order matters: more specific families are checked before broader
// catch-alls (e.g. US_TRADE_POLICY's commodity subfamilies before generic
// COMMODITIES) so a copper-tariff market lands under trade policy, not the
// looser commodities bucket, per spec Part 10's own worked distinction.
const FAMILY_RULES: FamilyRule[] = [
  {
    family: "US_MONETARY_POLICY",
    tags: ["fomc", "fed-rates", "fed", "federal-reserve", "interest-rates", "rate-cut", "rate-hike", "jerome-powell"],
    titlePatterns: [/\bfed(eral reserve)?\b.*(rate|cut|hike|hold)/i, /\brate (cut|hike)s?\b/i, /fomc/i],
  },
  {
    family: "US_INFLATION",
    tags: ["cpi-release", "cpi", "inflation", "pce", "core-inflation"],
    titlePatterns: [/\bcpi\b/i, /\bpce\b/i, /\binflation\b/i],
  },
  {
    family: "US_RECESSION",
    tags: ["recession"],
    titlePatterns: [/\brecession\b/i],
  },
  {
    family: "US_GDP_GROWTH",
    tags: ["gdp"],
    titlePatterns: [/\bgdp\b/i, /economic growth/i],
  },
  {
    family: "US_LABOR_MARKET",
    tags: ["jobs-report", "nonfarm-payrolls", "unemployment", "jobs", "labor-market", "payrolls"],
    titlePatterns: [/nonfarm payrolls/i, /jobs report/i, /unemployment rate/i, /\bjobs added\b/i],
  },
  {
    family: "US_TREASURY_RATES",
    tags: ["treasury-yields", "treasury", "bond-yields", "10-year-yield"],
    titlePatterns: [/treasury yield/i, /10.year (yield|note)/i, /bond yield/i],
  },
  {
    family: "US_TRADE_POLICY",
    // Deliberately NOT including bare country tags ("china", "canada",
    // "mexico") here — confirmed live that Polymarket tags plenty of
    // non-trade markets (a Taiwan-invasion geopolitical market, a typhoon
    // landfall market) with "china" just because the country is mentioned.
    // A market only belongs to this family when it carries an actual
    // trade/tariff signal; country tags below are used ONLY to pick a
    // subfamily once that's already true.
    tags: ["tariffs", "tariff", "trade-war", "china-trade", "trade-policy", "trade-deal", "steel-tariffs", "aluminum-tariffs", "copper-tariffs", "semiconductor-trade"],
    titlePatterns: [/tariff/i, /trade (war|deal|agreement|policy)/i],
    subfamilyRules: [
      { subfamily: "CHINA", tags: ["china", "china-trade"], titlePattern: /china/i },
      { subfamily: "CANADA", tags: ["canada"], titlePattern: /canada/i },
      { subfamily: "MEXICO", tags: ["mexico"], titlePattern: /mexico/i },
      { subfamily: "STEEL", tags: ["steel-tariffs"], titlePattern: /steel/i },
      { subfamily: "ALUMINUM", tags: ["aluminum-tariffs"], titlePattern: /aluminum/i },
      { subfamily: "COPPER", tags: ["copper-tariffs"], titlePattern: /copper/i },
      { subfamily: "SEMICONDUCTORS", tags: ["semiconductor-trade"], titlePattern: /semiconductor/i },
    ],
  },
  {
    family: "US_TAX_POLICY",
    tags: ["tax-policy", "corporate-tax", "capital-gains", "tax-cuts", "taxes"],
    titlePatterns: [/corporate tax/i, /capital gains/i, /tax (rate|cut|policy|bill)/i],
  },
  {
    // Checked before ENERGY_OIL: a Strait of Hormuz / Bab el-Mandeb market
    // is fundamentally about shipping-traffic disruption and is usually
    // ALSO tagged "oil" (it's an oil chokepoint) — the more specific
    // shipping-chokepoint family should win over the generic oil-price tag.
    family: "GLOBAL_SHIPPING",
    tags: ["shipping", "suez", "strait-of-hormuz", "hormuz", "bab-el-mandeb", "red-sea", "panama-canal"],
    titlePatterns: [/strait of hormuz/i, /bab el-mandeb/i, /suez canal/i, /shipping (disruption|blockade)/i, /panama canal/i],
  },
  {
    family: "ENERGY_OIL",
    tags: ["oil", "oil-prices", "opec", "crude-oil"],
    titlePatterns: [/\boil\b/i, /\bopec\b/i, /crude/i],
  },
  {
    family: "ENERGY_NATURAL_GAS",
    tags: ["natural-gas", "lng"],
    titlePatterns: [/natural gas/i, /\blng\b/i],
  },
  {
    family: "DEFENSE_POLICY",
    tags: ["defense", "defense-spending", "military-spending"],
    titlePatterns: [/defense (spending|budget)/i, /military (spending|budget)/i],
  },
  {
    family: "INFRASTRUCTURE_POLICY",
    tags: ["infrastructure", "infrastructure-spending"],
    titlePatterns: [/infrastructure (spending|bill|package)/i],
  },
  {
    family: "HEALTHCARE_POLICY",
    tags: ["healthcare", "fda", "drug-approval", "biotech", "pharma"],
    titlePatterns: [/fda approv/i, /drug approv/i, /healthcare (policy|reform)/i],
  },
  {
    family: "TECH_POLICY",
    tags: ["ai-regulation", "tech-regulation", "antitrust-tech"],
    titlePatterns: [/ai regulation/i, /tech(nology)? regulation/i],
  },
  {
    family: "CRYPTO_REGULATION",
    tags: ["crypto-regulation", "sec-crypto", "stablecoin-regulation"],
    titlePatterns: [/crypto regulation/i, /sec .* (crypto|bitcoin|ethereum)/i, /stablecoin (bill|regulation)/i],
  },
  {
    family: "US_REGULATION",
    tags: ["regulation", "antitrust", "banking-regulation"],
    titlePatterns: [/antitrust/i, /bank(ing)? regulation/i],
  },
  {
    family: "US_ELECTION_POLICY",
    // "politics" and generic "elections" are intentionally excluded — too
    // broad. Confirmed live that Polymarket tags Brazil/Russia/Sweden
    // elections "elections" too, and a bare /presidential election/i title
    // pattern matches them just as readily as a US one. Only genuinely
    // US-specific tags qualify; a foreign election with no US-specific tag
    // falls through to OTHER_ECONOMIC/IRRELEVANT rather than risk
    // mislabeling it as US policy.
    tags: ["us-presidential-election", "us-senate", "us-house", "midterms"],
    titlePatterns: [/\bmidterms?\b/i, /\bus senate\b/i],
  },
  {
    family: "GEOPOLITICAL_RISK",
    tags: ["iran", "sanctions", "war", "geopolitics", "blockade", "peace-deal"],
    titlePatterns: [/sanctions/i, /\bwar\b/i, /blockade/i, /ceasefire/i],
  },
  {
    family: "FOREIGN_MONETARY_POLICY",
    tags: ["ecb", "boj", "boe", "pboc"],
    titlePatterns: [/european central bank/i, /bank of japan/i, /bank of england/i, /people's bank of china/i],
  },
  {
    family: "COMMODITIES",
    tags: ["commodities", "gold", "silver", "copper", "wheat", "corn"],
    titlePatterns: [/\bgold price\b/i, /\bcopper price\b/i],
  },
];

const OTHER_ECONOMIC_TAGS = new Set(["economy", "economic-policy", "macro", "economics"]);

export interface FamilyClassification {
  family: MarketFamily;
  subfamily?: string;
  matchedRule?: string; // for the debug view (spec Part 33's "matched rules")
}

export function classifyMarketFamily(candidate: RawMarketCandidate): FamilyClassification {
  const tagSet = new Set(candidate.tags);

  for (const rule of FAMILY_RULES) {
    const tagMatch = rule.tags.find((t) => tagSet.has(t));
    const titleMatch = rule.titlePatterns?.find((p) => p.test(candidate.title));
    if (!tagMatch && !titleMatch) continue;

    let subfamily: string | undefined;
    for (const sub of rule.subfamilyRules ?? []) {
      const subTagMatch = sub.tags?.some((t) => tagSet.has(t));
      const subTitleMatch = sub.titlePattern?.test(candidate.title);
      if (subTagMatch || subTitleMatch) {
        subfamily = sub.subfamily;
        break;
      }
    }

    return { family: rule.family, subfamily, matchedRule: tagMatch ? `tag:${tagMatch}` : `title:${titleMatch!.source}` };
  }

  if (candidate.tags.some((t) => OTHER_ECONOMIC_TAGS.has(t))) {
    return { family: "OTHER_ECONOMIC", matchedRule: "tag:economy/economic-policy fallback" };
  }

  return { family: "IRRELEVANT", matchedRule: "no family rule matched" };
}
