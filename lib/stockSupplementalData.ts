// /lib/stockSupplementalData.ts
// Supplemental data layer — fills missing fields only.
// Does NOT touch existing Yahoo Finance price/momentum values.

type SupplementalMetric = {
  value: string | number | null;
  source: "yahoo" | "sec" | "calculated" | "unavailable";
  reason?: string;
};

export type SupplementalStockData = {
  ma50: SupplementalMetric;
  ma200: SupplementalMetric;
  revenueGrowth: SupplementalMetric;
  cashRunway: SupplementalMetric;
  debtRisk: SupplementalMetric;
  lastEarnings: SupplementalMetric;
  nextEarnings: SupplementalMetric;
  avgDailyVolume: SupplementalMetric;
  shortInterest: SupplementalMetric;
  insiderSelling: SupplementalMetric;
  analystRating: SupplementalMetric;
  recentRevisions: SupplementalMetric;
};

function missing(reason: string): SupplementalMetric {
  return { value: null, source: "unavailable", reason };
}

function formatPercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `${(value * 100).toFixed(1)}%`;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getYahooChartUrl(symbol: string) {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 60 * 60 * 24 * 370;
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${oneYearAgo}&period2=${now}&interval=1d`;
}

function getYahooQuoteSummaryUrl(symbol: string) {
  const modules = [
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "calendarEvents",
    "earningsTrend",
    "upgradeDowngradeHistory",
    "insiderTransactions",
    "recommendationTrend",
  ].join(",");
  return `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
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

async function getChartDerivedMetrics(symbol: string) {
  const data = await fetchJson<Record<string, unknown>>(getYahooChartUrl(symbol));
  const result = (data as Record<string, unknown> | null)?.chart as Record<string, unknown> | undefined;
  const resultArr = result?.result as Record<string, unknown>[] | undefined;
  const first = resultArr?.[0];
  const quoteArr = (first?.indicators as Record<string, unknown> | undefined)?.quote as Record<string, unknown>[] | undefined;
  const quote = quoteArr?.[0] ?? {};

  const closes: number[] = ((quote.close as (number | null)[] | undefined) ?? []).filter((v): v is number => typeof v === "number");
  const volumes: number[] = ((quote.volume as (number | null)[] | undefined) ?? []).filter((v): v is number => typeof v === "number");

  return {
    ma50: closes.length >= 50 ? avg(closes.slice(-50)) : null,
    ma200: closes.length >= 200 ? avg(closes.slice(-200)) : null,
    avgDailyVolume: volumes.length >= 30 ? avg(volumes.slice(-30)) : null,
  };
}

function extractRaw(value: unknown): number | null {
  if (value && typeof value === "object" && "raw" in value) {
    const raw = (value as { raw: unknown }).raw;
    if (typeof raw === "number") return raw;
  }
  if (typeof value === "number") return value;
  return null;
}

function summarizeAnalystRating(recommendationTrend: unknown): string | null {
  const trend = (recommendationTrend as Record<string, unknown> | null)?.trend;
  const first = Array.isArray(trend) ? trend[0] : null;
  if (!first) return null;
  const strongBuy = (first.strongBuy as number) ?? 0;
  const buy = (first.buy as number) ?? 0;
  const hold = (first.hold as number) ?? 0;
  const sell = (first.sell as number) ?? 0;
  const strongSell = (first.strongSell as number) ?? 0;
  const bullish = strongBuy + buy;
  const bearish = sell + strongSell;
  if (bullish > hold && bullish > bearish) return `Bullish: ${strongBuy} Strong Buy, ${buy} Buy, ${hold} Hold`;
  if (bearish > bullish) return `Bearish: ${sell} Sell, ${strongSell} Strong Sell, ${hold} Hold`;
  return `Neutral: ${hold} Hold, ${buy} Buy, ${sell} Sell`;
}

function summarizeRecentRevisions(upgradeDowngradeHistory: unknown): string | null {
  const history = (upgradeDowngradeHistory as Record<string, unknown> | null)?.history;
  if (!Array.isArray(history) || !history.length) return null;
  return history.slice(0, 3).map((item: Record<string, unknown>) => {
    const firm = (item.firm as string) ?? "Analyst";
    const action = (item.action as string) ?? "Update";
    const toGrade = item.toGrade ? ` to ${item.toGrade}` : "";
    return `${firm}: ${action}${toGrade}`;
  }).join("; ");
}

function summarizeInsiderSelling(insiderTransactions: unknown): string | null {
  const transactions = (insiderTransactions as Record<string, unknown> | null)?.transactions;
  if (!Array.isArray(transactions)) return null;
  const sells = transactions.filter((tx: Record<string, unknown>) => {
    const text = `${tx.transactionText ?? ""} ${tx.transactionDescription ?? ""}`.toLowerCase();
    return text.includes("sale") || text.includes("sell");
  });
  if (!sells.length) return "None detected";
  return `${sells.length} recent sale transaction${sells.length === 1 ? "" : "s"}`;
}

function calculateDebtRisk(totalDebt: number | null, totalCash: number | null): string | null {
  if (totalDebt === null && totalCash === null) return null;
  if ((totalDebt ?? 0) === 0) return "Low — no major debt detected";
  const netDebt = (totalDebt ?? 0) - (totalCash ?? 0);
  if (netDebt <= 0) return "Low — cash exceeds debt";
  if (totalCash && totalDebt && totalDebt / totalCash <= 1.5) return "Moderate";
  return "Elevated — debt exceeds cash";
}

function calculateCashRunway(totalCash: number | null, freeCashflow: number | null): string | null {
  if (totalCash === null || freeCashflow === null) return null;
  if (freeCashflow >= 0) return "Positive FCF — runway not a concern";
  const years = totalCash / Math.abs(freeCashflow);
  if (!Number.isFinite(years)) return null;
  return `${years.toFixed(1)} years`;
}

export async function getSupplementalStockData(symbol: string): Promise<SupplementalStockData> {
  const [chart, quoteSummaryRaw] = await Promise.all([
    getChartDerivedMetrics(symbol),
    fetchJson<Record<string, unknown>>(getYahooQuoteSummaryUrl(symbol)),
  ]);

  const summary = (quoteSummaryRaw?.quoteSummary as Record<string, unknown> | undefined)?.result;
  const first = Array.isArray(summary) ? (summary[0] as Record<string, unknown>) : null;

  const financialData = first?.financialData as Record<string, unknown> | undefined;
  const keyStats = first?.defaultKeyStatistics as Record<string, unknown> | undefined;
  const calendarEvents = first?.calendarEvents as Record<string, unknown> | undefined;

  const revenueGrowthRaw = extractRaw(financialData?.revenueGrowth);
  const totalCash = extractRaw(financialData?.totalCash);
  const totalDebt = extractRaw(financialData?.totalDebt);
  const freeCashflow = extractRaw(financialData?.freeCashflow);
  const shortPercentOfFloat = extractRaw(keyStats?.shortPercentOfFloat);

  const earningsDateArr = (calendarEvents?.earnings as Record<string, unknown> | undefined)?.earningsDate;
  const earningsDate = Array.isArray(earningsDateArr)
    ? ((earningsDateArr[0] as Record<string, unknown>)?.fmt as string | undefined) ?? null
    : null;

  const debtRiskVal = calculateDebtRisk(totalDebt, totalCash);
  const cashRunwayVal = calculateCashRunway(totalCash, freeCashflow);
  const analystRatingVal = summarizeAnalystRating(first?.recommendationTrend);
  const revisionsVal = summarizeRecentRevisions(first?.upgradeDowngradeHistory);
  const insiderSellingVal = summarizeInsiderSelling(first?.insiderTransactions);

  return {
    ma50: chart.ma50
      ? { value: Number(chart.ma50.toFixed(2)), source: "calculated" }
      : missing("Requires at least 50 trading days of price history"),

    ma200: chart.ma200
      ? { value: Number(chart.ma200.toFixed(2)), source: "calculated" }
      : missing("Requires at least 200 trading days of price history"),

    revenueGrowth: revenueGrowthRaw !== null
      ? { value: formatPercent(revenueGrowthRaw), source: "yahoo" }
      : missing("Revenue growth unavailable from Yahoo Finance for this symbol"),

    cashRunway: cashRunwayVal
      ? { value: cashRunwayVal, source: "calculated" }
      : missing("Requires total cash and free cash flow"),

    debtRisk: debtRiskVal
      ? { value: debtRiskVal, source: "calculated" }
      : missing("Requires total debt and cash data"),

    lastEarnings: earningsDate
      ? { value: earningsDate, source: "yahoo" }
      : missing("Last earnings unavailable from Yahoo Finance quoteSummary"),

    nextEarnings: earningsDate
      ? { value: earningsDate, source: "yahoo" }
      : missing("Next earnings unavailable from Yahoo Finance quoteSummary"),

    avgDailyVolume: chart.avgDailyVolume
      ? { value: Math.round(chart.avgDailyVolume).toLocaleString(), source: "calculated" }
      : missing("Requires at least 30 trading days of volume history"),

    shortInterest: shortPercentOfFloat !== null
      ? { value: formatPercent(shortPercentOfFloat), source: "yahoo" }
      : missing("Short interest unavailable from Yahoo Finance"),

    insiderSelling: insiderSellingVal
      ? { value: insiderSellingVal, source: "yahoo" }
      : missing("Insider selling unavailable from Yahoo Finance"),

    analystRating: analystRatingVal
      ? { value: analystRatingVal, source: "yahoo" }
      : missing("Analyst rating unavailable from Yahoo Finance"),

    recentRevisions: revisionsVal
      ? { value: revisionsVal, source: "yahoo" }
      : missing("Recent analyst revisions unavailable from Yahoo Finance"),
  };
}

// Merge helper — only fills fields that are currently missing/null/N/A
function isMissing(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "N/A" ||
    (typeof value === "number" && value === 0)
  );
}

export async function mergeSupplementalStockData(
  symbol: string,
  existingData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const supplemental = await getSupplementalStockData(symbol);

  return {
    ...existingData,
    ma50: isMissing(existingData.ma50) ? supplemental.ma50.value : existingData.ma50,
    ma200: isMissing(existingData.ma200) ? supplemental.ma200.value : existingData.ma200,
    revenueGrowth: isMissing(existingData.revenueGrowth) ? supplemental.revenueGrowth.value : existingData.revenueGrowth,
    cashRunway: isMissing(existingData.cashRunway) ? supplemental.cashRunway.value : existingData.cashRunway,
    debtRisk: isMissing(existingData.debtRisk) ? supplemental.debtRisk.value : existingData.debtRisk,
    lastEarnings: isMissing(existingData.lastEarnings) ? supplemental.lastEarnings.value : existingData.lastEarnings,
    nextEarnings: isMissing(existingData.nextEarnings) ? supplemental.nextEarnings.value : existingData.nextEarnings,
    avgDailyVolume: isMissing(existingData.avgDailyVolume) ? supplemental.avgDailyVolume.value : existingData.avgDailyVolume,
    shortInterest: isMissing(existingData.shortInterest) ? supplemental.shortInterest.value : existingData.shortInterest,
    insiderSelling: isMissing(existingData.insiderSelling) ? supplemental.insiderSelling.value : existingData.insiderSelling,
    analystRating: isMissing(existingData.analystRating) ? supplemental.analystRating.value : existingData.analystRating,
    recentRevisions: isMissing(existingData.recentRevisions) ? supplemental.recentRevisions.value : existingData.recentRevisions,
    supplementalSources: supplemental,
  };
}
