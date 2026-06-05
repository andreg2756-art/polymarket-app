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

function Change({ v }: { v: number }) {
  if (!isFinite(v)) return <span className="text-gray-500">N/A</span>;
  const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-500";
  return <span className={color}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

const SECTORS = [
  "Technology","Healthcare","Energy","Financials","Consumer Discretionary",
  "Industrials","Materials","Communication Services","Real Estate","Utilities",
];

const SORT_OPTIONS = [
  { value: "rank", label: "Rank" },
  { value: "bullishScore", label: "Bullish Score" },
  { value: "marketCap", label: "Market Cap" },
];

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState("rank");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy, search, sector, minScore: String(minScore) });
      const res = await fetch(`/api/stocks/screener?${params}`);
      setStocks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [sortBy, search, sector, minScore]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Stock Screener</h1>
          <p className="text-gray-500 text-sm mt-1">All {stocks.length} stocks across all sectors</p>
        </div>
        <button onClick={() => exportCSV(stocks as unknown as Record<string, unknown>[], "screener.csv")}
          className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded hover:bg-emerald-900/30">
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px] focus:outline-none focus:border-emerald-500"
          placeholder="Search ticker or name..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All Sectors</option>
          {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-emerald-500"
          placeholder="Min score" value={minScore || ""} onChange={(e) => setMinScore(Number(e.target.value))} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? <TableSkeleton rows={12} cols={9} /> : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["#","Ticker","Company","Sector","Price","1M","3M","Rel. Vol","Score"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-3 py-3 text-gray-500 text-xs">#{s.rank}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
                      <a href={`https://finance.yahoo.com/quote/${s.ticker}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-400">Yahoo ↗</a>
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-[180px]"><p className="truncate text-gray-200">{s.name}</p></td>
                  <td className="px-3 py-3">
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400 whitespace-nowrap">{s.sector || "—"}</span>
                  </td>
                  <td className="px-3 py-3 text-white font-medium">${s.price.toFixed(2)}</td>
                  <td className="px-3 py-3"><Change v={s.change1M} /></td>
                  <td className="px-3 py-3"><Change v={s.change3M} /></td>
                  <td className="px-3 py-3 text-gray-300">{s.relativeVolume?.toFixed(1) ?? "—"}x</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.bullishScore >= 70 ? "bg-emerald-900 text-emerald-300" : s.bullishScore >= 45 ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400"}`}>
                      {s.bullishScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stocks.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              No stocks found. Run a scan from the Top 50 page first.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
