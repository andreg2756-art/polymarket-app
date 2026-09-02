"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SHARES_OUTSTANDING } from "@/lib/small-cap-universe";
import { generateRiskFlags, type RiskFlag, type RiskFlagResult } from "@/lib/stockHelpers";
import { TableSkeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import { exportCSV } from "@/lib/analytics";
import Disclaimer from "@/components/stocks/Disclaimer";
import BacktestSummary from "@/components/stocks/BacktestSummary";
import DataWarningBanner from "@/components/stocks/DataWarningBanner";
import ScoreBreakdown from "@/components/stocks/ScoreBreakdown";
import ResearchChecklist from "@/components/stocks/ResearchChecklist";
import EnhancedScorePanel from "@/components/stocks/EnhancedScorePanel";
import TechnicalsPanel from "@/components/stocks/TechnicalsPanel";
import RankChangeBadge from "@/components/stocks/RankChangeBadge";

interface Stock {
  id: string;
  ticker: string;
  name: string;
  marketCap: number;
  price: number;
  change1M: number;
  change3M: number;
  bullishScore: number;
  rank: number;
  rankChange: number | null;
  sector: string | null;
  relativeVolume: number;
  revenueGrowth: number;
  lastEarningsDate: string | null;
  insiderBuying: number;
  shortInterest: number | null;
  analystRating: string | null;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

const POSITIVE_KEYWORDS = ["beat","surpass","record","growth","upgrade","bullish","strong","raise","accelerat","partnership","win","contract","expand","rally","surge","soar","breakout","outperform","buy","positive","profit","revenue","opportunity","momentum","gain"];
const NEGATIVE_KEYWORDS = ["miss","disappoint","downgrade","bearish","weak","cut","decline","loss","dilut","lawsuit","recall","warning","risk","concern","fall","drop","plunge","sell","negative","debt","bankruptcy","investigation","probe","fine"];

function classifyNews(items: NewsItem[]) {
  const positives: NewsItem[] = [];
  const negatives: NewsItem[] = [];
  const neutral: NewsItem[] = [];
  for (const n of items) {
    const text = n.title.toLowerCase();
    const posHits = POSITIVE_KEYWORDS.filter((w) => text.includes(w)).length;
    const negHits = NEGATIVE_KEYWORDS.filter((w) => text.includes(w)).length;
    if (posHits > negHits) positives.push(n);
    else if (negHits > posHits) negatives.push(n);
    else neutral.push(n);
  }
  return { positives, negatives, neutral };
}

function fmt(n: number) {
  if (!isFinite(n)) return "N/A";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n === 0) return "N/A";
  return `$${n.toLocaleString()}`;
}

function scoreSummary(score: number, s: Stock): string {
  const label = score >= 70 ? "Strong momentum signal" : score >= 45 ? "Moderate momentum signal" : score >= 20 ? "Weak momentum signal" : "No momentum signal";
  const parts: string[] = [];
  if (s.change1M > 20) parts.push(`strong 1M momentum (+${s.change1M.toFixed(1)}%)`);
  else if (s.change1M > 5) parts.push(`positive 1M momentum (+${s.change1M.toFixed(1)}%)`);
  else if (s.change1M < 0) parts.push(`negative 1M momentum (${s.change1M.toFixed(1)}%)`);
  if (s.change3M > 30) parts.push(`strong 3M trend (+${s.change3M.toFixed(1)}%)`);
  else if (s.change3M > 10) parts.push(`positive 3M trend (+${s.change3M.toFixed(1)}%)`);
  else if (s.change3M < 0) parts.push(`declining 3M trend (${s.change3M.toFixed(1)}%)`);
  if (s.relativeVolume > 2) parts.push(`elevated volume (${s.relativeVolume.toFixed(1)}x avg)`);
  const detail = parts.length ? parts.join(", ") : "no strong price signals";
  return `Momentum Score ${score}/100. Based on: ${detail}. Ranks recent price strength, volume, and trend alignment. Not a buy recommendation.`;
}

function ScoreBadge({ score, stock }: { score: number; stock: Stock }) {
  const color = score >= 70 ? "bg-emerald-900 text-emerald-300" : score >= 45 ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400";
  return (
    <div className="relative group inline-block">
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold cursor-help ${color}`}>{score}</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {scoreSummary(score, stock)}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
      </div>
    </div>
  );
}

function Change({ v }: { v: number }) {
  if (!isFinite(v)) return <span className="text-gray-500">N/A</span>;
  const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-500";
  return <span className={color}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

// Market cap validation helpers
function marketCapCalculated(s: Stock): number {
  const shares = SHARES_OUTSTANDING[s.ticker] ?? 0;
  return shares > 0 ? Math.round(s.price * shares * 1_000_000) : 0;
}
function marketCapDiscrepancy(s: Stock): boolean {
  const calc = marketCapCalculated(s);
  if (!s.marketCap || !calc) return false;
  return Math.abs(calc - s.marketCap) / s.marketCap > 0.1;
}

// Risk badges — multiple can apply
function RiskBadges({ stock }: { stock: Stock }) {
  const badges: { label: string; color: string }[] = [];
  if (stock.marketCap < 200e6) badges.push({ label: "Low Liquidity Risk", color: "bg-red-900/50 text-red-300" });
  else if (stock.marketCap < 500e6) badges.push({ label: "High Volatility", color: "bg-orange-900/50 text-orange-300" });
  else badges.push({ label: "Lower Volatility", color: "bg-blue-900/50 text-blue-300" });
  if (stock.change3M > 60) badges.push({ label: "Speculative", color: "bg-yellow-900/50 text-yellow-300" });
  if (stock.lastEarningsDate) {
    const daysSince = Math.floor((Date.now() - new Date(stock.lastEarningsDate).getTime()) / 86400000);
    if (daysSince < 60) badges.push({ label: "Earnings Risk", color: "bg-purple-900/50 text-purple-300" });
  }
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b.label} className={`text-xs px-1.5 py-0.5 rounded ${b.color}`}>{b.label}</span>
      ))}
    </div>
  );
}

function MediaOutlook({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadNews() {
    if (news !== null) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/stocks/news/${ticker}`);
      setNews(await res.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const classified = news ? classifyNews(news) : null;

  return (
    <div>
      <button onClick={loadNews} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">
        {open ? "Hide ▴" : "Media Outlook ▾"}
      </button>
      {open && (
        <div className="mt-2 space-y-3 max-w-sm">
          {loading && <p className="text-xs text-gray-500">Loading...</p>}
          {failed && (
            <button onClick={loadNews} className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2">
              Could not load coverage — retry
            </button>
          )}
          {classified && (
            <>
              {classified.positives.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-1">✓ Positives</p>
                  <div className="space-y-1.5">
                    {classified.positives.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                        className="block border-l-2 border-emerald-700 pl-2 hover:border-emerald-400 transition-colors">
                        <p className="text-xs text-gray-200 leading-snug">"{n.title}"</p>
                        <p className="text-xs text-gray-600 mt-0.5">{n.publisher} · {n.publishedAt}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {classified.negatives.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-1">✗ Negatives</p>
                  <div className="space-y-1.5">
                    {classified.negatives.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                        className="block border-l-2 border-red-800 pl-2 hover:border-red-500 transition-colors">
                        <p className="text-xs text-gray-200 leading-snug">"{n.title}"</p>
                        <p className="text-xs text-gray-600 mt-0.5">{n.publisher} · {n.publishedAt}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {classified.neutral.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">— Neutral</p>
                  <div className="space-y-1.5">
                    {classified.neutral.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                        className="block border-l-2 border-gray-700 pl-2 hover:border-gray-500 transition-colors">
                        <p className="text-xs text-gray-200 leading-snug">"{n.title}"</p>
                        <p className="text-xs text-gray-600 mt-0.5">{n.publisher} · {n.publishedAt}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!classified.positives.length && !classified.negatives.length && !classified.neutral.length && (
                <p className="text-xs text-gray-600">No recent coverage found.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Revenue growth strings fetched lazily for stocks with 0 in DB
const SEVERITY_STYLES: Record<RiskFlag["severity"], string> = {
  High:   "bg-red-900/40 border-red-800 text-red-300",
  Medium: "bg-yellow-900/30 border-yellow-800 text-yellow-300",
  Low:    "bg-gray-800/60 border-gray-700 text-gray-400",
};

function FlagList({ flags, emptyText }: { flags: RiskFlag[]; emptyText: string }) {
  if (flags.length === 0) {
    return <p className="text-xs text-gray-600 italic">{emptyText}</p>;
  }
  return (
    <div className="space-y-1.5">
      {flags.map((f) => (
        <div key={f.label} className={`rounded border px-2.5 py-1.5 text-xs ${SEVERITY_STYLES[f.severity]}`}>
          <p className="font-semibold">{f.label} — {f.severity}</p>
          <p className="mt-0.5 text-gray-400 leading-snug">{f.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function RiskFlagsPanel({ result }: { result: RiskFlagResult }) {
  const [open, setOpen] = useState(false);
  const total     = result.confirmed.length + result.dataWarnings.length;
  const hasHigh   = result.confirmed.some((f) => f.severity === "High");
  if (total === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`text-xs px-2 py-1 rounded border transition-colors whitespace-nowrap ${
          hasHigh
            ? "border-red-800 text-red-400 hover:bg-red-900/20"
            : "border-yellow-800 text-yellow-500 hover:bg-yellow-900/20"
        }`}
      >
        {open ? "Hide" : "Risk Flags"} ({total})
      </button>
      {open && (
        <div className="mt-2 space-y-3 w-72">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Confirmed Risk Flags</p>
            <FlagList flags={result.confirmed} emptyText="No confirmed risk flags detected from available data." />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Data Quality Warnings</p>
            <FlagList flags={result.dataWarnings} emptyText="No major data quality warnings." />
          </div>
        </div>
      )}
    </div>
  );
}

type RevGrowthMap = Record<string, string>;

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [showBacktest, setShowBacktest] = useState(false);
  const [revGrowthMap, setRevGrowthMap] = useState<RevGrowthMap>({});
  const [avgVolMap, setAvgVolMap] = useState<Record<string, number>>({});
  const [suppMap, setSuppMap] = useState<Record<string, { cash: number | null; debt: number | null; nextEarningsDate: string | null }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Sort by the actual score, not the stored `rank` column: rank is a
      // fresh sequential index assigned over only each day's screener
      // candidate set, so it can go stale/duplicate when the pool size
      // changes day to day (see runTurnaroundPipeline.ts for the same
      // pattern). Filtering on rank>=1 excludes stocks the Speculative
      // pipeline never scored at all (rank stays at its 0 default), then
      // rank is recomputed here so it's always a clean, unique 1..50.
      const res = await fetch(`/api/stocks/screener?sortBy=bullishScore`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const filtered: Stock[] = data
        .filter((s: Stock) => s.rank >= 1)
        .slice(0, 50)
        .map((s: Stock, i: number) => ({ ...s, rank: i + 1 }));
      setStocks(filtered);
      if (data[0]?.updatedAt) setUpdatedAt(data[0].updatedAt);

      // Fetch supplemental data in background for all stocks.
      // Used for: avgVolume30D (all stocks) + revenue growth string (stocks with DB value 0).
      const suppResults = await Promise.allSettled(
        filtered.map((s) =>
          fetch(`/api/stocks/supplemental/${s.ticker}`)
            .then((r) => r.json())
            .then((d) => ({
              ticker:          s.ticker,
              revGrowth:       (d?.revenueGrowthTTM?.value ?? d?.revenueGrowth?.value) as string | null ?? null,
              avgVolRaw:       d?.avgDailyVolume?.value as string | number | null ?? null,
              cashRaw:         d?.cash?.value         as string | number | null ?? null,
              debtRaw:         d?.totalDebt?.value     as string | number | null ?? null,
              nextEarningsRaw: d?.nextEarnings?.value  as string | null ?? null,
            }))
            .catch(() => ({ ticker: s.ticker, revGrowth: null, avgVolRaw: null, cashRaw: null, debtRaw: null, nextEarningsRaw: null }))
        )
      );

      const revMap: RevGrowthMap = {};
      const volMap: Record<string, number> = {};
      const sm: Record<string, { cash: number | null; debt: number | null; nextEarningsDate: string | null }> = {};

      for (const r of suppResults) {
        if (r.status !== "fulfilled") continue;
        const { ticker, revGrowth, avgVolRaw, cashRaw, debtRaw, nextEarningsRaw } = r.value;

        const s = filtered.find((x) => x.ticker === ticker);
        if (revGrowth && (!s?.revenueGrowth || s.revenueGrowth === 0)) revMap[ticker] = revGrowth;

        if (avgVolRaw !== null && avgVolRaw !== undefined) {
          const n = typeof avgVolRaw === "number"
            ? avgVolRaw
            : parseFloat(String(avgVolRaw).replace(/,/g, ""));
          if (isFinite(n) && n > 0) volMap[ticker] = Math.round(n);
        }

        // Parse currency strings like "$95.2M" or "$1.3B" to numbers for risk flag evaluation
        function parseCurrency(v: string | number | null): number | null {
          if (v === null || v === undefined) return null;
          if (typeof v === "number") return isFinite(v) ? v : null;
          const s2 = String(v).replace(/[$,\s]/g, "");
          const mult = s2.endsWith("B") ? 1e9 : s2.endsWith("M") ? 1e6 : s2.endsWith("K") ? 1e3 : 1;
          const n2 = parseFloat(s2);
          return isFinite(n2) ? n2 * mult : null;
        }

        sm[ticker] = {
          cash:             parseCurrency(cashRaw),
          debt:             parseCurrency(debtRaw),
          nextEarningsDate: nextEarningsRaw ?? null,
        };
      }

      if (Object.keys(revMap).length > 0) setRevGrowthMap(revMap);
      if (Object.keys(volMap).length > 0) setAvgVolMap(volMap);
      if (Object.keys(sm).length > 0)     setSuppMap(sm);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">High-Growth / Speculative</h1>
          <p className="text-gray-500 text-sm mt-1">Top 50 by momentum, relative strength, and risk-adjusted score — the "betting on what the business could become" lens</p>
          {updatedAt && (
            <p className="text-gray-600 text-xs">
              Market data last updated:{" "}
              {new Date(updatedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setShowBacktest(!showBacktest)}
            className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded hover:border-gray-500 transition-colors">
            {showBacktest ? "Hide Backtest" : "Show Backtest"}
          </button>
          <button onClick={() => exportCSV(stocks as unknown as Record<string, unknown>[], "top50-stocks.csv")}
            className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded hover:bg-emerald-900/30">
            Export CSV
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <Disclaimer />

      {/* Backtest */}
      {showBacktest && <BacktestSummary />}

      {!loading && (
        <DataWarningBanner
          incompleteCount={stocks.filter((s) => s.lastEarningsDate === null).length}
          totalCount={stocks.length}
          label="Earnings data"
        />
      )}

      {/* Table */}
      {loading ? <TableSkeleton rows={10} cols={9} /> : error ? <ErrorState onRetry={load} /> : (
        <div className="rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["#","Ticker","Company / Sector","Price","1M","3M","Rel.Vol","Rev Growth (TTM)","Risk","Momentum Score","Actions"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900/40 transition-colors align-top">
                  <td className="px-3 py-3 text-gray-500 text-xs pt-4 whitespace-nowrap">#{s.rank}<RankChangeBadge delta={s.rankChange} /></td>

                  {/* Ticker */}
                  <td className="px-3 py-3 pt-4">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
                      <a href={`https://finance.yahoo.com/quote/${s.ticker}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-400">Yahoo ↗</a>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-3 py-3 max-w-[160px] pt-4">
                    <p className="truncate text-gray-200 text-xs">{s.name}</p>
                    <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 mt-0.5 inline-block">{s.sector || "—"}</span>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {fmtCap(s.marketCap)}
                      {marketCapDiscrepancy(s) && (
                        <span className="ml-1 text-yellow-700 cursor-help" title={`Market cap discrepancy: stored ${fmtCap(s.marketCap)} vs price×shares ${fmtCap(marketCapCalculated(s))}. Prefer most recent data source.`}>⚠</span>
                      )}
                    </p>
                  </td>

                  <td className="px-3 py-3 text-white font-medium pt-4">${fmt(s.price)}</td>
                  <td className="px-3 py-3 pt-4"><Change v={s.change1M} /></td>
                  <td className="px-3 py-3 pt-4"><Change v={s.change3M} /></td>
                  <td className="px-3 py-3 text-gray-300 pt-4">{s.relativeVolume?.toFixed(1) ?? "N/A"}x</td>

                  {/* Revenue Growth — DB value first, supplemental string fallback */}
                  <td className="px-3 py-3 pt-4">
                    {s.revenueGrowth !== 0 && s.revenueGrowth !== null
                      ? <Change v={s.revenueGrowth} />
                      : revGrowthMap[s.ticker]
                        ? <span className={`text-xs ${revGrowthMap[s.ticker].startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>{revGrowthMap[s.ticker]}</span>
                        : <span className="text-gray-600 text-xs">N/A</span>}
                  </td>

                  {/* Risk badges */}
                  <td className="px-3 py-3 pt-4"><RiskBadges stock={s} /></td>

                  {/* Score + breakdown */}
                  <td className="px-3 py-3 pt-4">
                    <div className="space-y-1">
                      <ScoreBadge score={s.bullishScore} stock={s} />
                      {s.lastEarningsDate === null && (
                        <span title="Earnings data unavailable (likely FMP plan restriction) — score doesn't include earnings/revenue-beat signal"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-800 cursor-help inline-block">
                          Partial
                        </span>
                      )}
                      <ScoreBreakdown
                        ticker={s.ticker}
                        score={s.bullishScore}
                        change1M={s.change1M}
                        change3M={s.change3M}
                        relativeVolume={s.relativeVolume}
                      />
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3 pt-4 min-w-[200px]">
                    <div className="space-y-2">
                      <RiskFlagsPanel result={generateRiskFlags({
                        symbol: s.ticker,
                        price: s.price,
                        marketCap: s.marketCap,
                        change1M: s.change1M,
                        change3M: s.change3M,
                        relativeVolume: s.relativeVolume,
                        averageVolume: avgVolMap[s.ticker] ?? null,
                        revenueGrowth: s.revenueGrowth || null,
                        lastEarningsDate: s.lastEarningsDate,
                        nextEarningsDate: suppMap[s.ticker]?.nextEarningsDate ?? null,
                        sma200: null,
                        cash: suppMap[s.ticker]?.cash ?? null,
                        totalDebt: suppMap[s.ticker]?.debt ?? null,
                      })} />
                      <ResearchChecklist
                        ticker={s.ticker}
                        name={s.name}
                        price={s.price}
                        change1M={s.change1M}
                        change3M={s.change3M}
                        relativeVolume={s.relativeVolume}
                        marketCap={s.marketCap}
                        bullishScore={s.bullishScore}
                        lastEarningsDate={s.lastEarningsDate}
                        insiderBuying={s.insiderBuying}
                        shortInterest={s.shortInterest}
                        revenueGrowth={s.revenueGrowth}
                      />
                      <TechnicalsPanel ticker={s.ticker} currentPrice={s.price} />
                      <MediaOutlook ticker={s.ticker} />
                      <EnhancedScorePanel ticker={s.ticker} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stocks.length === 0 && (
            <div className="py-24 text-center space-y-3">
              <p className="text-gray-400">No data yet.</p>
              <p className="text-gray-600 text-sm">Click <strong>Scan Market</strong> to scan all sectors.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
