// Business Quant fundamentals API (data.businessquant.com) — free, sourced
// from SEC filings, confirmed by direct testing to cover small/mid-caps
// (e.g. VIOT) that FMP's plan rejects outright.
//
// Rate limit: no x-ratelimit-* headers on any response (unlike Finnhub's
// 60/min or Polygon's 5/min), but it IS limited — confirmed by testing: a
// concurrent burst gets instant 429s, and a single isolated call's 429
// body eventually revealed the real number: "Rate limit exceeded. Limit:
// 40 req/day". That's a hard DAILY cap shared across the whole app, not a
// per-minute window — unlike Polygon, waiting longer within one run does
// NOT help once it's hit. Each ticker costs 3 calls here (BS/IS/CF), so
// callers must size their shortlist against 40/day, not against request
// throughput — see runQualityPipeline.ts/runTurnaroundPipeline.ts's
// FUNDAMENTALS_SHORTLIST_SIZE, which is deliberately small because of this.
// A 429 here is treated as an ordinary failure (falls through to the
// Polygon fallback in lib/stocks/fundamentals.ts) rather than something
// this client tracks or retries — there's no way to recover mid-run once
// the daily budget is spent, and Vercel's serverless functions don't
// persist an in-memory counter across invocations anyway.
//
// Response shape is a nested category > section tree, and that nesting is
// NOT consistent across companies — confirmed by testing IBM/SOFI/PLNT:
// category casing differs ("Revenue & cost" vs "Revenue & Cost"), and
// "Total Debt" sits one level shallower than PLNT's other Liabilities
// fields but is missing entirely for SOFI (a fintech lender whose
// bank-style template has no traditional debt line at all — a real
// absence, not a bug, so this returns null rather than guessing). Line
// items are searched for by name anywhere in the tree instead of by a
// fixed path for this reason.
//
// Also confirmed by testing: Business Quant can have an isolated wrong
// data point even though the API is reliable across a dozen spot-checked
// tickers — VIOT's most recent quarterly cash balance came back ~800x
// every other quarter for the same line item, while every other tested
// ticker's quarter-over-quarter figures stayed within a 0.4x-4.7x range.
// guardOutlier() rejects a value that implausibly diverges from the prior
// quarter for the same line item, falling back to null (treated as
// missing) rather than displaying a number that's likely wrong.

const BASE = "https://data.businessquant.com/statements";
const OUTLIER_RATIO = 15;

function getKey(): string | null {
  return process.env.BUSINESSQUANT_API_KEY ?? null;
}

interface StatementValue {
  date: string;
  reportedValue: { raw: number | null; fmt: string };
}

interface StatementNode {
  sections?: Record<string, StatementNode>;
  values?: StatementValue[];
}

async function fetchStatement(
  ticker: string,
  statement: "IS" | "BS" | "CF"
): Promise<Record<string, StatementNode> | null> {
  const key = getKey();
  if (!key) return null;
  try {
    const url = `${BASE}?ticker=${encodeURIComponent(ticker)}&statement=${statement}&frequency=Quarter&period=1y&api_key=${key}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

// Recursive search by exact section name — see file header for why this
// can't be a fixed path.
function findSection(tree: Record<string, StatementNode> | undefined, name: string): StatementNode | null {
  if (!tree) return null;
  for (const [key, node] of Object.entries(tree)) {
    if (key === name) return node;
    if (node.sections) {
      const found = findSection(node.sections, name);
      if (found) return found;
    }
  }
  return null;
}

function latestTwo(tree: Record<string, StatementNode> | undefined, name: string): [number | null, number | null] {
  const values = findSection(tree, name)?.values;
  if (!values || values.length === 0) return [null, null];
  const latest = values[0]?.reportedValue?.raw;
  const prev = values[1]?.reportedValue?.raw;
  return [typeof latest === "number" ? latest : null, typeof prev === "number" ? prev : null];
}

function guardOutlier(latest: number | null, prev: number | null): number | null {
  if (latest === null) return null;
  if (prev === null || prev === 0) return latest; // nothing to sanity-check against
  const ratio = Math.abs(latest / prev);
  return ratio > OUTLIER_RATIO || ratio < 1 / OUTLIER_RATIO ? null : latest;
}

export interface BusinessQuantFundamentals {
  ok: boolean; // false only if BS/IS/CF all failed outright (network/auth/not-found) — a field being absent for this company's template still counts as ok
  netIncome: number | null;
  revenue: number | null;
  grossProfit: number | null; // not exposed by this API in any template seen so far — always null
  operatingIncome: number | null;
  totalDebt: number | null;
  cashAndEquivalents: number | null;
  freeCashFlow: number | null;
  prevRevenue: number | null;
  prevOperatingIncome: number | null;
  prevFreeCashFlow: number | null;
}

export async function getBusinessQuantFundamentals(ticker: string): Promise<BusinessQuantFundamentals> {
  const [bs, is, cf] = await Promise.all([
    fetchStatement(ticker, "BS"),
    fetchStatement(ticker, "IS"),
    fetchStatement(ticker, "CF"),
  ]);

  if (!bs && !is && !cf) {
    return {
      ok: false, netIncome: null, revenue: null, grossProfit: null, operatingIncome: null,
      totalDebt: null, cashAndEquivalents: null, freeCashFlow: null,
      prevRevenue: null, prevOperatingIncome: null, prevFreeCashFlow: null,
    };
  }

  const [cash, prevCash] = latestTwo(bs ?? undefined, "Cash & Equivalents (Quarter)");
  const [debt, prevDebt] = latestTwo(bs ?? undefined, "Total Debt (Quarter)");
  const [revenue, prevRevenue] = latestTwo(is ?? undefined, "Revenue (Quarter)");
  const [opIncome, prevOpIncome] = latestTwo(is ?? undefined, "Operating Income (Quarter)");
  const [netIncome, prevNetIncome] = latestTwo(is ?? undefined, "Consolidated Net Income (Quarter)");
  const [fcf, prevFcf] = latestTwo(cf ?? undefined, "Free Cash Flow (Quarter)");

  return {
    ok: true,
    cashAndEquivalents: guardOutlier(cash, prevCash),
    totalDebt: guardOutlier(debt, prevDebt),
    revenue: guardOutlier(revenue, prevRevenue),
    operatingIncome: guardOutlier(opIncome, prevOpIncome),
    netIncome: guardOutlier(netIncome, prevNetIncome),
    freeCashFlow: guardOutlier(fcf, prevFcf),
    grossProfit: null,
    prevRevenue,
    prevOperatingIncome: prevOpIncome,
    prevFreeCashFlow: prevFcf,
  };
}
