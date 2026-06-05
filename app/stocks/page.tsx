"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TableSkeleton } from "@/components/Skeleton";
import { exportCSV } from "@/lib/analytics";

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
  sector: string | null;
  relativeVolume: number;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

function fmt(n: number) {
  if (!isFinite(n)) return "N/A";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function scoreSummary(score: number, s: Stock): string {
  const label = score >= 70 ? "Strong bullish signal" : score >= 45 ? "Moderate bullish signal" : score >= 20 ? "Weak bullish signal" : "No bullish signal";
  const parts: string[] = [];
  if (s.change1M > 20) parts.push(`strong 1-month momentum (+${s.change1M.toFixed(1)}%)`);
  else if (s.change1M > 5) parts.push(`positive 1-month momentum (+${s.change1M.toFixed(1)}%)`);
  else if (s.change1M < 0) parts.push(`negative 1-month momentum (${s.change1M.toFixed(1)}%)`);
  if (s.change3M > 30) parts.push(`strong 3-month trend (+${s.change3M.toFixed(1)}%)`);
  else if (s.change3M > 10) parts.push(`positive 3-month trend (+${s.change3M.toFixed(1)}%)`);
  else if (s.change3M < 0) parts.push(`declining 3-month trend (${s.change3M.toFixed(1)}%)`);
  if (s.relativeVolume > 2) parts.push(`elevated volume (${s.relativeVolume.toFixed(1)}x avg)`);
  else if (s.relativeVolume > 1.2) parts.push(`above-average volume (${s.relativeVolume.toFixed(1)}x)`);
  const detail = parts.length ? parts.join(", ") : "no strong price signals detected";
  return `${label} (${score}/100). Score is based on: ${detail}. Scoring weights: 1M momentum 30pts, 3M trend 35pts, relative volume 20pts, trend alignment bonus 15pts.`;
}

function ScoreBadge({ score, stock }: { score: number; stock: Stock }) {
  const color = score >= 70 ? "bg-emerald-900 text-emerald-300" : score >= 45 ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400";
  const tooltip = scoreSummary(score, stock);
  return (
    <div className="relative group inline-block">
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold cursor-help ${color}`}>{score}</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {tooltip}
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

function MediaOutlook({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadNews() {
    if (news !== null) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/news/${ticker}`);
      setNews(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={loadNews} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">
        {open ? "Hide" : "Media Outlook"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 max-w-sm">
          {loading && <p className="text-xs text-gray-500">Loading...</p>}
          {news && news.length === 0 && <p className="text-xs text-gray-600">No recent coverage found.</p>}
          {news && news.map((n, i) => (
            <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
              className="block border-l-2 border-blue-800 pl-2 hover:border-blue-500 transition-colors">
              <p className="text-xs text-gray-200 leading-snug hover:text-white">"{n.title}"</p>
              <p className="text-xs text-gray-600 mt-0.5">{n.publisher} · {n.publishedAt}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "rank", label: "Rank" },
  { value: "bullishScore", label: "Bullish Score" },
  { value: "marketCap", label: "Market Cap" },
];

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy, search, sector, minScore: String(minScore) });
      const res = await fetch(`/api/stocks/screener?${params}`);
      const data = await res.json();
      setStocks(data);
      if (data[0]?.updatedAt) setUpdatedAt(data[0].updatedAt);
    } finally {
      setLoading(false);
    }
  }, [sortBy, search, sector, minScore]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    setMsg("Scanning market...");
    try {
      const res = await fetch("/api/stocks/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMsg(`Done — ${data.count} stocks ranked`);
        load();
      } else {
        setMsg(`Error: ${data.error}`);
      }
    } finally {
      setRefreshing(false);
    }
  }

  const sectors = Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Small-Cap Bullish Intelligence</h1>
          <p className="text-gray-500 text-sm mt-1">Most bullish stocks · $50M–$8B market cap</p>
          {updatedAt && <p className="text-gray-600 text-xs">Last updated: {new Date(updatedAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => exportCSV(stocks as unknown as Record<string, unknown>[], "stocks.csv")}
            className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded hover:bg-emerald-900/30">
            Export CSV
          </button>
          <button onClick={handleRefresh} disabled={refreshing}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
            {refreshing ? "Scanning..." : "Scan Market"}
          </button>
          {msg && <span className="text-sm text-gray-400">{msg}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px] focus:outline-none focus:border-emerald-500"
          placeholder="Search ticker or name..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All Sectors</option>
          {sectors.map((s) => <option key={s} value={s!}>{s}</option>)}
        </select>
        <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-emerald-500"
          placeholder="Min score" value={minScore || ""} onChange={(e) => setMinScore(Number(e.target.value))} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <p className="text-gray-500 text-sm">{stocks.length} stocks</p>

      {loading ? <TableSkeleton rows={10} cols={7} /> : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["#", "Ticker", "Company", "Mkt Cap", "Price", "1M", "3M", "Rel. Vol", "Score", "Media Outlook"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900/40 transition-colors align-top">
                  <td className="px-3 py-3 text-gray-500 text-xs">#{s.rank}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
                      <a href={`https://finance.yahoo.com/quote/${s.ticker}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-400">Yahoo ↗</a>
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-[180px]">
                    <p className="truncate text-gray-200">{s.name}</p>
                    <p className="text-xs text-gray-600">{s.sector || "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtCap(s.marketCap)}</td>
                  <td className="px-3 py-3 text-white font-medium">${fmt(s.price)}</td>
                  <td className="px-3 py-3"><Change v={s.change1M} /></td>
                  <td className="px-3 py-3"><Change v={s.change3M} /></td>
                  <td className="px-3 py-3 text-gray-300">{s.relativeVolume?.toFixed(1) ?? "—"}x</td>
                  <td className="px-3 py-3"><ScoreBadge score={s.bullishScore} stock={s} /></td>
                  <td className="px-3 py-3 min-w-[200px]">
                    <MediaOutlook ticker={s.ticker} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stocks.length === 0 && (
            <div className="py-24 text-center space-y-3">
              <p className="text-gray-400">No stocks yet.</p>
              <p className="text-gray-600 text-sm">Click <strong>Scan Market</strong> to analyze the universe.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
