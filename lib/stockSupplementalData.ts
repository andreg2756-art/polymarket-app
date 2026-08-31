// /lib/stockSupplementalData.ts
// Supplemental data layer — fills missing checklist fields.
// Uses Yahoo Finance quoteSummary (with crumb auth) for most fields.
// Each field fails independently — the page never crashes if one source is down.

import { getShortInterestData } from "./stocks/shortInterest";

// ── Types ──────────────────────────────────────────────────────────────────

type SupplementalMetric = {
  value: string | number | null;
  source: "yahoo" | "sec" | "calculated" | "polygon" | "unavailable";
  reason?: string;
};

export type SupplementalStockData = {
  ma50:                      SupplementalMetric;
  ma200:                     SupplementalMetric;
  // Revenue growth — three distinct metrics, never mixed
  revenueGrowth:             SupplementalMetric; // primary = TTM (for screener table)
  revenueGrowthTTM:          SupplementalMetric; // trailing 12-month vs prior 12-month
  revenueGrowthQtrYoY:       SupplementalMetric; // latest quarter vs same quarter last year
  revenueGrowthQoQ:          SupplementalMetric; // sequential quarter-over-quarter (legacy)
  revenueGrowthInconsistent: SupplementalMetric; // warning when TTM and quarterly disagree in sign
  revenueGrowthTrend:        SupplementalMetric; // Positive / Negative / Mixed
  cashRunway:                SupplementalMetric;
  debtRisk:              SupplementalMetric;
  lastEarnings:          SupplementalMetric;
  nextEarnings:          SupplementalMetric;
  avgDailyVolume:        SupplementalMetric;
  shortInterest:         SupplementalMetric;
  insiderBuying:         SupplementalMetric;
  insiderSelling:        SupplementalMetric;
  analystRating:         SupplementalMetric;
  recentRevisions:       SupplementalMetric;
  // Small-cap risk fields
  cash:                      SupplementalMetric;
  totalDebt:                 SupplementalMetric;
  netCash:                   SupplementalMetric;
  freeCashFlow:              SupplementalMetric;
  dilutionRisk:              SupplementalMetric;  // implied vs basic (options/warrants)
  sharesOutstandingGrowthYoY: SupplementalMetric; // YoY shares growth from quarterly history
  dilutionRating:            SupplementalMetric;  // Low / Moderate / High
  insiderOwnership:          SupplementalMetric;
  institutionalOwnership:    SupplementalMetric;
};

function missing(reason: string): SupplementalMetric {
  return { value: null, source: "unavailable", reason };
}

// ── Yahoo crumb session ────────────────────────────────────────────────────

let _crumbCache: { cookie: string; crumb: string; ts: number } | null = null;

async function getYahooCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  if (_crumbCache && Date.now() - _crumbCache.ts < 50 * 60 * 1000) {
    return _crumbCache;
  }
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const setCookie = cookieRes.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0];
    if (!cookie) return null;

    const crumbRes = await fetch(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie } }
    );
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes("Unauthorized") || crumb.includes("{")) return null;

    _crumbCache = { cookie, crumb, ts: Date.now() };
    return _crumbCache;
  } catch {
    return null;
  }
}

// ── Raw fetch helpers ──────────────────────────────────────────────────────

const QUOTE_MODULES = [
  "financialData",
  "defaultKeyStatistics",
  "calendarEvents",
  "earningsHistory",
  "upgradeDowngradeHistory",
  "insiderTransactions",
  "recommendationTrend",
  "incomeStatementHistoryQuarterly",
  "majorHoldersBreakdown",
].join(",");

async function fetchYahooQuoteSummary(symbol: string): Promise<Record<string, unknown> | null> {
  const session = await getYahooCrumb();
  if (!session) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${QUOTE_MODULES}&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Cookie: session.cookie },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = (data as Record<string, unknown>)?.quoteSummary as Record<string, unknown> | undefined;
    const arr = result?.result as Record<string, unknown>[] | undefined;
    return arr?.[0] ?? null;
  } catch {
    return null;
  }
}

function getYahooChartUrl(symbol: string) {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 60 * 60 * 24 * 370;
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${oneYearAgo}&period2=${now}&interval=1d`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Chart-derived metrics (MA, volume) ────────────────────────────────────

async function getChartDerivedMetrics(symbol: string) {
  const data = await fetchJson<Record<string, unknown>>(getYahooChartUrl(symbol));
  const result = (data as Record<string, unknown> | null)?.chart as Record<string, unknown> | undefined;
  const resultArr = result?.result as Record<string, unknown>[] | undefined;
  const first = resultArr?.[0];
  const quoteArr = (first?.indicators as Record<string, unknown> | undefined)?.quote as Record<string, unknown>[] | undefined;
  const quote = quoteArr?.[0] ?? {};

  const closes: number[] = ((quote.close as (number | null)[] | undefined) ?? []).filter((v): v is number => typeof v === "number");
  const volumes: number[] = ((quote.volume as (number | null)[] | undefined) ?? []).filter((v): v is number => typeof v === "number");

  function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

  return {
    ma50:           closes.length >= 50  ? avg(closes.slice(-50))  : null,
    ma200:          closes.length >= 200 ? avg(closes.slice(-200)) : null,
    avgDailyVolume: volumes.length >= 30 ? avg(volumes.slice(-30)) : null,
  };
}

// ── Field extractors ───────────────────────────────────────────────────────

function raw(value: unknown): number | null {
  if (value && typeof value === "object" && "raw" in value) {
    const r = (value as { raw: unknown }).raw;
    if (typeof r === "number") return r;
  }
  if (typeof value === "number") return value;
  return null;
}

function fmt(value: unknown): string | null {
  if (value && typeof value === "object" && "fmt" in value) {
    const f = (value as { fmt: unknown }).fmt;
    if (typeof f === "string") return f;
  }
  return null;
}

function fmtLarge(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(ts: unknown): string | null {
  const n = raw(ts);
  if (n === null) return fmt(ts);
  const d = new Date(n * 1000);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Revenue Growth ─────────────────────────────────────────────────────────
// Three distinct metrics — never mixed:
//   TTM     : Yahoo financialData.revenueGrowth (trailing 12-month vs prior 12-month)
//   QtrYoY  : Yahoo quarterly — latest Q vs same Q one year ago (Q[0] vs Q[4])
//   QoQ     : Yahoo quarterly — latest Q vs prior Q (Q[0] vs Q[1]), legacy secondary

const LOW_BASE_THRESHOLD = 10_000_000; // flag when prior-year Q revenue is tiny

interface RevenueGrowthBundle {
  ttm:          SupplementalMetric;
  qtrYoY:       SupplementalMetric;
  qoq:          SupplementalMetric;
  inconsistent: SupplementalMetric;
  trend:        SupplementalMetric; // Positive / Negative / Mixed
  // raw numbers for the blended score modifier
  ttmRaw:      number | null;
  qtrYoYRaw:   number | null;
}

function calcRevenueGrowthAll(qs: Record<string, unknown> | null): RevenueGrowthBundle {
  const unavail = (msg: string): SupplementalMetric => missing(msg);
  try {
    const fd = qs?.financialData as Record<string, unknown> | undefined;
    const quarterly: unknown[] =
      (qs?.incomeStatementHistoryQuarterly as Record<string, unknown> | undefined)
        ?.incomeStatementHistory as unknown[] ?? [];

    // ── TTM from financialData.revenueGrowth ────────────────────────────────
    let ttm: SupplementalMetric = unavail("TTM revenue growth unavailable from Yahoo");
    let ttmRaw: number | null = null;
    const rgRaw = raw(fd?.revenueGrowth);
    if (rgRaw !== null) {
      ttmRaw = rgRaw * 100;
      const sign = ttmRaw >= 0 ? "+" : "";
      ttm = {
        value:  `${sign}${ttmRaw.toFixed(1)}%`,
        source: "yahoo",
        reason: "Trailing 12-month revenue vs prior trailing 12-month period.",
      };
    }

    // ── Quarterly YoY: Q[0] vs Q[4] ─────────────────────────────────────────
    let qtrYoY: SupplementalMetric = unavail("Latest-quarter YoY data requires ≥5 quarters");
    let qtrYoYRaw: number | null = null;
    if (quarterly.length >= 5) {
      const cur  = raw((quarterly[0] as Record<string, unknown>)?.totalRevenue);
      const prev = raw((quarterly[4] as Record<string, unknown>)?.totalRevenue);
      if (cur !== null && prev !== null && prev > 0) {
        qtrYoYRaw = ((cur - prev) / prev) * 100;
        const sign    = qtrYoYRaw >= 0 ? "+" : "";
        const lowBase = prev < LOW_BASE_THRESHOLD;
        qtrYoY = {
          value:  `${sign}${qtrYoYRaw.toFixed(1)}%${lowBase ? " ⚠" : ""}`,
          source: "yahoo",
          reason: lowBase
            ? "⚠ Growth may be inflated due to low prior-year base. Latest quarter revenue vs same quarter last year."
            : "Latest quarter revenue vs same quarter last year.",
        };
      }
    }

    // ── QoQ: Q[0] vs Q[1] (sequential, legacy) ─────────────────────────────
    let qoq: SupplementalMetric = unavail("Sequential quarterly data unavailable");
    if (quarterly.length >= 2) {
      const cur  = raw((quarterly[0] as Record<string, unknown>)?.totalRevenue);
      const prev = raw((quarterly[1] as Record<string, unknown>)?.totalRevenue);
      if (cur !== null && prev !== null && prev > 0) {
        const g    = ((cur - prev) / prev) * 100;
        const sign = g >= 0 ? "+" : "";
        qoq = { value: `${sign}${g.toFixed(1)}% QoQ`, source: "yahoo" };
      }
    }

    // ── Inconsistency warning ────────────────────────────────────────────────
    let inconsistent: SupplementalMetric = { value: null, source: "calculated" };
    if (ttmRaw !== null && qtrYoYRaw !== null) {
      const ttmNeg = ttmRaw < 0;
      const qtrPos = qtrYoYRaw > 0;
      if (ttmNeg && qtrPos) {
        inconsistent = {
          value: "⚠ Growth trend inconsistent. Recent quarter improved, but trailing 12-month revenue remains negative.",
          source: "calculated",
          reason: `TTM ${ttmRaw.toFixed(1)}% vs latest quarter +${qtrYoYRaw.toFixed(1)}% — monitor for sustained improvement.`,
        };
      } else if (!ttmNeg && qtrYoYRaw < 0) {
        inconsistent = {
          value: "⚠ Growth trend inconsistent. Trailing 12-month positive, but latest quarter declined vs year ago.",
          source: "calculated",
          reason: `TTM +${ttmRaw.toFixed(1)}% vs latest quarter ${qtrYoYRaw.toFixed(1)}% — recent deceleration.`,
        };
      }
    }

    // ── Growth trend label ───────────────────────────────────────────────────
    let trend: SupplementalMetric = { value: null, source: "calculated" };
    if (ttmRaw !== null && qtrYoYRaw !== null) {
      if (ttmRaw > 0 && qtrYoYRaw > 0)     trend = { value: "Positive",  source: "calculated" };
      else if (ttmRaw < 0 && qtrYoYRaw < 0) trend = { value: "Negative",  source: "calculated" };
      else                                   trend = { value: "Mixed",     source: "calculated" };
    } else if (ttmRaw !== null) {
      trend = { value: ttmRaw > 0 ? "Positive" : "Negative", source: "calculated" };
    }

    return { ttm, qtrYoY, qoq, inconsistent, trend, ttmRaw, qtrYoYRaw };
  } catch {
    return {
      ttm:    unavail("Revenue growth fetch failed"),
      qtrYoY: unavail("Revenue growth fetch failed"),
      qoq:    unavail("Revenue growth fetch failed"),
      inconsistent: { value: null, source: "calculated" },
      trend:        { value: null, source: "calculated" },
      ttmRaw: null, qtrYoYRaw: null,
    };
  }
}

// ── Cash Runway ────────────────────────────────────────────────────────────

function calcCashRunway(qs: Record<string, unknown> | null): SupplementalMetric {
  try {
    const fd = qs?.financialData as Record<string, unknown> | undefined;
    const totalCash    = raw(fd?.totalCash);
    const freeCashflow = raw(fd?.freeCashflow);
    if (totalCash === null || freeCashflow === null) {
      return missing("Requires total cash and free cash flow from Yahoo");
    }
    if (freeCashflow >= 0) {
      return { value: `FCF positive — ${fmtLarge(freeCashflow)}/yr`, source: "yahoo" };
    }
    const years = totalCash / Math.abs(freeCashflow);
    if (!isFinite(years)) return missing("Could not compute cash runway");
    return {
      value:  `${years.toFixed(1)} years (cash: ${fmtLarge(totalCash)})`,
      source: "yahoo",
    };
  } catch {
    return missing("Cash runway calculation failed");
  }
}

// ── Debt Risk ──────────────────────────────────────────────────────────────

function calcDebtRisk(qs: Record<string, unknown> | null): SupplementalMetric {
  try {
    const fd        = qs?.financialData as Record<string, unknown> | undefined;
    const totalCash = raw(fd?.totalCash);
    const totalDebt = raw(fd?.totalDebt);
    if (totalCash === null && totalDebt === null) {
      return missing("Requires total debt and cash from Yahoo");
    }
    const cash = totalCash ?? 0;
    const debt = totalDebt ?? 0;
    const net  = cash - debt;
    if (debt === 0) return { value: "No significant debt", source: "yahoo" };
    if (net > 0) {
      return { value: `Net cash ${fmtLarge(net)} (debt ${fmtLarge(debt)})`, source: "yahoo" };
    }
    const ratio = debt / (cash || 1);
    const level = ratio > 2 ? "Elevated" : ratio > 1 ? "Moderate" : "Low";
    return {
      value:  `${level} — net debt ${fmtLarge(Math.abs(net))} (${ratio.toFixed(1)}x)`,
      source: "yahoo",
    };
  } catch {
    return missing("Debt risk calculation failed");
  }
}

// ── Earnings ───────────────────────────────────────────────────────────────

function calcLastEarnings(qs: Record<string, unknown> | null): SupplementalMetric {
  try {
    const history: unknown[] =
      (qs?.earningsHistory as Record<string, unknown> | undefined)?.history as unknown[] ?? [];
    if (!history.length) return missing("Earnings history unavailable");

    const h = history[0] as Record<string, unknown>;
    const date    = fmtDate(h.quarter) ?? fmt(h.quarter);
    const actual  = raw(h.epsActual);
    const est     = raw(h.epsEstimate);
    const surprise = raw(h.surprisePercent);

    if (!date) return missing("Earnings date format unrecognised");

    let display = date;
    if (actual !== null) display += ` — EPS $${actual.toFixed(2)}`;
    if (est !== null)    display += ` vs est. $${est.toFixed(2)}`;
    if (surprise !== null) {
      const pct = (surprise * 100).toFixed(1);
      display += ` (${surprise >= 0 ? "+" : ""}${pct}%)`;
    }
    return { value: display, source: "yahoo" };
  } catch {
    return missing("Last earnings data unavailable");
  }
}

function calcNextEarnings(qs: Record<string, unknown> | null): SupplementalMetric {
  try {
    const ce      = qs?.calendarEvents as Record<string, unknown> | undefined;
    const earns   = ce?.earnings as Record<string, unknown> | undefined;
    const dates   = earns?.earningsDate as unknown[] | undefined;
    if (!dates?.length) return missing("Next earnings date unavailable");

    const d0 = fmtDate(dates[0]);
    if (!d0) return missing("Earnings date format unrecognised");

    const isEstimate = earns?.isEarningsDateEstimate === true;
    if (dates.length >= 2) {
      const d1 = fmtDate(dates[1]);
      if (d1 && d0 !== d1) {
        return {
          value:  `Expected ${d0} – ${d1}${isEstimate ? " (est.)" : ""}`,
          source: "yahoo",
        };
      }
    }
    return { value: `${d0}${isEstimate ? " (est.)" : ""}`, source: "yahoo" };
  } catch {
    return missing("Next earnings data unavailable");
  }
}

// ── Short Interest ─────────────────────────────────────────────────────────
// Prefer Yahoo defaultKeyStatistics (real short interest).
// Sourced from Polygon exclusively — the same authoritative, exchange-
// reported data the dedicated Short Interest page uses (lib/stocks/
// shortInterest.ts). Previously this fell back through Yahoo's
// shortPercentOfFloat, then FINRA short *volume* (a different metric
// entirely, mislabeled here as a proxy) — three sources answering the same
// question three different ways depending which page you were on. Polygon
// confirmed working even for microcaps (tested RFL, $90M market cap) with
// real exchange-reported shares-short and days-to-cover, so there's no
// coverage reason left to keep the fallback chain.
//
// floatShares comes from the same Yahoo quoteSummary object already fetched
// for other fields on this page — no extra network call — so the % of float
// figure Polygon doesn't return directly can still be derived.

async function calcShortInterest(
  symbol: string,
  qs: Record<string, unknown> | null
): Promise<SupplementalMetric> {
  const ks = qs?.defaultKeyStatistics as Record<string, unknown> | undefined;
  const floatShares = raw(ks?.floatShares);

  const result = await getShortInterestData(symbol, floatShares);

  if (!result.available) {
    return missing(result.reason || "Short interest unavailable");
  }

  return { value: result.reason, source: "polygon" };
}

// ── Insider Activity ───────────────────────────────────────────────────────

function calcInsiderActivity(qs: Record<string, unknown> | null): {
  buying: SupplementalMetric;
  selling: SupplementalMetric;
} {
  const unavail = {
    buying:  missing("Insider transactions unavailable"),
    selling: missing("Insider transactions unavailable"),
  };
  try {
    const txs: unknown[] =
      (qs?.insiderTransactions as Record<string, unknown> | undefined)
        ?.transactions as unknown[] ?? [];
    if (!txs.length) return unavail;

    const sixMonthsAgo = Date.now() - 180 * 86400000;
    let buys = 0, sales = 0;

    for (const tx of txs) {
      const t    = tx as Record<string, unknown>;
      const ts   = raw(t.startDate);
      if (ts !== null && ts * 1000 < sixMonthsAgo) continue;
      const text = `${t.transactionText ?? ""} ${t.transactionDescription ?? ""}`.toLowerCase();
      // Purchase: must say "purchase" or "buy" — exclude option grants/exercises
      if (text.includes("purchase") || text === "buy") buys++;
      // Sale: explicit sale text
      else if (text.includes("sale") || text.includes("sell")) sales++;
    }

    return {
      buying:  { value: buys  > 0 ? `${buys} purchase${buys  === 1 ? "" : "s"} in 6mo`  : "None detected", source: "yahoo" },
      selling: { value: sales > 0 ? `${sales} sale${sales === 1 ? "" : "s"} in 6mo`     : "None detected", source: "yahoo" },
    };
  } catch {
    return unavail;
  }
}

// ── Analyst Rating ─────────────────────────────────────────────────────────

const KEY_MAP: Record<string, string> = {
  strong_buy:   "Strong Buy",
  buy:          "Buy",
  hold:         "Hold",
  sell:         "Sell",
  strong_sell:  "Strong Sell",
};

function calcAnalystRating(qs: Record<string, unknown> | null): SupplementalMetric {
  try {
    const fd  = qs?.financialData as Record<string, unknown> | undefined;
    const key = (fd?.recommendationKey as string | undefined)?.toLowerCase() ?? "";
    const n   = raw(fd?.numberOfAnalystOpinions);
    if (!key) return missing("Analyst rating unavailable from Yahoo Finance");
    const label = KEY_MAP[key] ?? key;
    const count = n !== null ? ` — ${n} analyst${n === 1 ? "" : "s"}` : "";
    return { value: `${label}${count}`, source: "yahoo" };
  } catch {
    return missing("Analyst rating unavailable");
  }
}

// ── Recent Revisions ───────────────────────────────────────────────────────

function calcRecentRevisions(qs: Record<string, unknown> | null): SupplementalMetric {
  try {
    const history: unknown[] =
      (qs?.upgradeDowngradeHistory as Record<string, unknown> | undefined)
        ?.history as unknown[] ?? [];
    if (!history.length) return missing("No upgrade/downgrade history available");

    const cutoff = (Date.now() / 1000) - 90 * 86400;
    let upgrades = 0, downgrades = 0;

    for (const item of history) {
      const h      = item as Record<string, unknown>;
      const ts     = typeof h.epochGradeDate === "number" ? h.epochGradeDate : 0;
      if (ts < cutoff) continue;
      const action = (h.action as string | undefined)?.toLowerCase() ?? "";
      if (action === "up")   upgrades++;
      if (action === "down") downgrades++;
    }

    if (upgrades === 0 && downgrades === 0) {
      return { value: "No upgrades or downgrades in last 90d", source: "yahoo" };
    }
    const parts: string[] = [];
    if (upgrades   > 0) parts.push(`${upgrades} upgrade${upgrades   === 1 ? "" : "s"}`);
    if (downgrades > 0) parts.push(`${downgrades} downgrade${downgrades === 1 ? "" : "s"}`);
    return { value: `${parts.join(", ")} in last 90d`, source: "yahoo" };
  } catch {
    return missing("Analyst revisions unavailable");
  }
}

// ── Small-cap risk fields ──────────────────────────────────────────────────

function calcSmallCapRisk(qs: Record<string, unknown> | null): {
  cash: SupplementalMetric;
  totalDebt: SupplementalMetric;
  netCash: SupplementalMetric;
  freeCashFlow: SupplementalMetric;
  dilutionRisk: SupplementalMetric;
  sharesOutstandingGrowthYoY: SupplementalMetric;
  dilutionRating: SupplementalMetric;
  insiderOwnership: SupplementalMetric;
  institutionalOwnership: SupplementalMetric;
} {
  const u = missing("Small-cap risk data unavailable");
  const uAll = { cash: u, totalDebt: u, netCash: u, freeCashFlow: u,
    dilutionRisk: u, sharesOutstandingGrowthYoY: u, dilutionRating: u,
    insiderOwnership: u, institutionalOwnership: u };
  try {
    const fd  = qs?.financialData as Record<string, unknown> | undefined;
    const ks  = qs?.defaultKeyStatistics as Record<string, unknown> | undefined;
    const mh  = qs?.majorHoldersBreakdown as Record<string, unknown> | undefined;

    const cashVal  = raw(fd?.totalCash);
    const debtVal  = raw(fd?.totalDebt);
    const fcfVal   = raw(fd?.freeCashflow);
    const netCashVal = cashVal !== null && debtVal !== null ? cashVal - debtVal : null;

    // Dilution risk: implied vs basic shares (options/warrants)
    const sharesOut  = raw(ks?.sharesOutstanding);
    const impliedOut = raw(ks?.impliedSharesOutstanding);
    let dilution: SupplementalMetric = missing("Share count data unavailable");
    if (sharesOut !== null && impliedOut !== null && sharesOut > 0) {
      const dilutionPct = ((impliedOut - sharesOut) / sharesOut) * 100;
      dilution = dilutionPct > 5
        ? { value: `⚠ ${dilutionPct.toFixed(1)}% potential dilution (options/warrants)`, source: "yahoo" }
        : dilutionPct > 0
        ? { value: `Low — ${dilutionPct.toFixed(1)}% potential dilution`, source: "yahoo" }
        : { value: "Minimal dilution risk", source: "yahoo" };
    }

    // YoY shares outstanding growth from quarterly income statements
    // incomeStatementHistoryQuarterly contains basicShares or shares field per quarter
    let sharesGrowthYoY: SupplementalMetric = missing("Historical shares data unavailable");
    let dilutionRating: SupplementalMetric  = missing("Historical shares data unavailable");
    try {
      const quarterly: unknown[] =
        (qs?.incomeStatementHistoryQuarterly as Record<string, unknown> | undefined)
          ?.incomeStatementHistory as unknown[] ?? [];
      if (quarterly.length >= 5) {
        // Some Yahoo responses include basicShares on income statements
        const cur4  = raw((quarterly[0] as Record<string, unknown>)?.basicShares);
        const prev4 = raw((quarterly[4] as Record<string, unknown>)?.basicShares);
        if (cur4 !== null && prev4 !== null && prev4 > 0) {
          const growth = ((cur4 - prev4) / prev4) * 100;
          const sign   = growth >= 0 ? "+" : "";
          sharesGrowthYoY = { value: `${sign}${growth.toFixed(1)}% YoY`, source: "yahoo" };
          const rating = growth < 2 ? "Low" : growth < 8 ? "Moderate" : "High";
          dilutionRating = {
            value: rating,
            source: "yahoo",
            reason: `${sign}${growth.toFixed(1)}% YoY shares growth. Low <2%, Moderate 2–8%, High >8%.`,
          };
        }
      }
    } catch { /* leave as unavailable */ }

    // Fall back dilution rating to implied-vs-basic if YoY unavailable
    if (dilutionRating.source === "unavailable" && sharesOut !== null && impliedOut !== null && sharesOut > 0) {
      const pct    = ((impliedOut - sharesOut) / sharesOut) * 100;
      const rating = pct < 2 ? "Low" : pct < 8 ? "Moderate" : "High";
      dilutionRating = {
        value: rating,
        source: "yahoo",
        reason: `Based on ${pct.toFixed(1)}% implied dilution from options/warrants.`,
      };
    }

    // Insider / institutional ownership
    const insiderPct = raw(mh?.insidersPercentHeld) ?? raw(ks?.heldPercentInsiders);
    const instPct    = raw(mh?.institutionsPercentHeld) ?? raw(ks?.heldPercentInstitutions);

    return {
      cash:      cashVal   !== null ? { value: fmtLarge(cashVal),   source: "yahoo" } : missing("Cash data unavailable"),
      totalDebt: debtVal   !== null ? { value: fmtLarge(debtVal),   source: "yahoo" } : missing("Debt data unavailable"),
      netCash:   netCashVal !== null
        ? { value: netCashVal >= 0 ? `Net cash ${fmtLarge(netCashVal)}` : `Net debt ${fmtLarge(Math.abs(netCashVal))}`, source: "yahoo" }
        : missing("Net cash/debt requires both cash and debt"),
      freeCashFlow: fcfVal !== null
        ? { value: `${fcfVal >= 0 ? "" : "-"}${fmtLarge(Math.abs(fcfVal))}/yr`, source: "yahoo" }
        : missing("Free cash flow unavailable"),
      dilutionRisk: dilution,
      sharesOutstandingGrowthYoY: sharesGrowthYoY,
      dilutionRating,
      insiderOwnership:      insiderPct !== null ? { value: `${(insiderPct * 100).toFixed(1)}%`, source: "yahoo" } : missing("Insider ownership unavailable"),
      institutionalOwnership: instPct   !== null ? { value: `${(instPct   * 100).toFixed(1)}%`, source: "yahoo" } : missing("Institutional ownership unavailable"),
    };
  } catch {
    return uAll;
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export async function getSupplementalStockData(symbol: string): Promise<SupplementalStockData> {
  const [chart, qs] = await Promise.all([
    getChartDerivedMetrics(symbol),
    fetchYahooQuoteSummary(symbol),
  ]);

  const insiders    = calcInsiderActivity(qs);
  const shortInterest = await calcShortInterest(symbol, qs);
  const riskFields  = calcSmallCapRisk(qs);
  const rev         = calcRevenueGrowthAll(qs);

  return {
    ma50: chart.ma50 !== null
      ? { value: Number(chart.ma50.toFixed(2)), source: "calculated" }
      : missing("Requires at least 50 trading days of price history"),

    ma200: chart.ma200 !== null
      ? { value: Number(chart.ma200.toFixed(2)), source: "calculated" }
      : missing("Requires at least 200 trading days of price history"),

    // Revenue growth — keep `revenueGrowth` = TTM for screener table backwards-compat
    revenueGrowth:             rev.ttm,
    revenueGrowthTTM:          rev.ttm,
    revenueGrowthQtrYoY:       rev.qtrYoY,
    revenueGrowthQoQ:          rev.qoq,
    revenueGrowthInconsistent: rev.inconsistent,
    revenueGrowthTrend:        rev.trend,
    cashRunway:       calcCashRunway(qs),
    debtRisk:        calcDebtRisk(qs),
    lastEarnings:    calcLastEarnings(qs),
    nextEarnings:    calcNextEarnings(qs),
    shortInterest,
    insiderBuying:   insiders.buying,
    insiderSelling:  insiders.selling,
    analystRating:   calcAnalystRating(qs),
    recentRevisions: calcRecentRevisions(qs),
    ...riskFields,

    avgDailyVolume: chart.avgDailyVolume !== null
      ? { value: Math.round(chart.avgDailyVolume).toLocaleString(), source: "calculated" }
      : missing("Requires at least 30 trading days of volume history"),
  };
}

/** Lightweight: fetch only the raw revenue growth numbers for the scoring modifier. */
export async function getRevenueGrowthRaw(symbol: string): Promise<{ ttm: number | null; qtrYoY: number | null }> {
  try {
    const qs = await fetchYahooQuoteSummary(symbol);
    const rev = calcRevenueGrowthAll(qs);
    return { ttm: rev.ttmRaw, qtrYoY: rev.qtrYoYRaw };
  } catch {
    return { ttm: null, qtrYoY: null };
  }
}

// Merge helper — only fills fields that are currently missing/null
function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "" || value === "N/A";
}

export async function mergeSupplementalStockData(
  symbol: string,
  existingData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const s = await getSupplementalStockData(symbol);
  return {
    ...existingData,
    ma50:            isMissing(existingData.ma50)            ? s.ma50.value            : existingData.ma50,
    ma200:           isMissing(existingData.ma200)           ? s.ma200.value           : existingData.ma200,
    revenueGrowth:   isMissing(existingData.revenueGrowth)   ? s.revenueGrowth.value   : existingData.revenueGrowth,
    cashRunway:      isMissing(existingData.cashRunway)       ? s.cashRunway.value      : existingData.cashRunway,
    debtRisk:        isMissing(existingData.debtRisk)         ? s.debtRisk.value        : existingData.debtRisk,
    lastEarnings:    isMissing(existingData.lastEarnings)     ? s.lastEarnings.value    : existingData.lastEarnings,
    nextEarnings:    isMissing(existingData.nextEarnings)     ? s.nextEarnings.value    : existingData.nextEarnings,
    avgDailyVolume:  isMissing(existingData.avgDailyVolume)   ? s.avgDailyVolume.value  : existingData.avgDailyVolume,
    shortInterest:   isMissing(existingData.shortInterest)    ? s.shortInterest.value   : existingData.shortInterest,
    insiderBuying:   isMissing(existingData.insiderBuying)    ? s.insiderBuying.value   : existingData.insiderBuying,
    insiderSelling:  isMissing(existingData.insiderSelling)   ? s.insiderSelling.value  : existingData.insiderSelling,
    analystRating:   isMissing(existingData.analystRating)    ? s.analystRating.value   : existingData.analystRating,
    recentRevisions: isMissing(existingData.recentRevisions)  ? s.recentRevisions.value : existingData.recentRevisions,
    supplementalSources: s,
  };
}
