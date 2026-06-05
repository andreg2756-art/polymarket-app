"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TableSkeleton } from "@/components/Skeleton";
import { exportCSV } from "@/lib/analytics";

interface Stock {
  id: string; ticker: string; name: string; sector: string | null;
  marketCap: number; price: number; bullishScore: number;
  revenueGrowth: number; epsGrowth: number; analystRating: string | null;
  insiderBuying: number; relativeVolume: number; change1M: number; rank: number;
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [minRevGrowth, setMinRevGrowth] = useState(-999);
  const [sortBy, setSortBy] = useState("bullishScore");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, sector, minScore: String(minScore), minRevGrowth: String(minRevGrowth), sortBy });
      const res = await fetch(`/api/stocks/screener?${params}`);
      setStocks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [search, sector, minScore, minRevGrowth, sortBy]);

  useEffect(() => { load(); }, [load]);

  const sectors = Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-400">Market Screener</h1>
        <button onClick={() => exportCSV(stocks as unknown as Record<string, unknown>[], "screener.csv")} className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded">Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm col-span-2 focus:outline-none focus:border-emerald-500"
          placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All Sectors</option>
          {sectors.map((s) => <option key={s} value={s!}>{s}</option>)}
        </select>
        <input type="number" placeholder="Min Score" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={minScore || ""} onChange={(e) => setMinScore(Number(e.target.value))} />
        <input type="number" placeholder="Min Rev Growth %" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={minRevGrowth === -999 ? "" : minRevGrowth} onChange={(e) => setMinRevGrowth(e.target.value ? Number(e.target.value) : -999)} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="bullishScore">Sort: Score</option>
          <option value="revenueGrowth">Sort: Rev Growth</option>
          <option value="epsGrowth">Sort: EPS Growth</option>
          <option value="marketCap">Sort: Market Cap</option>
          <option value="insiderBuying">Sort: Insider Buying</option>
          <option value="rank">Sort: Rank</option>
        </select>
      </div>

      <p className="text-gray-500 text-sm">{stocks.length} results</p>

      {loading ? <TableSkeleton rows={8} cols={9} /> : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>{["Ticker","Company","Sector","Mkt Cap","Price","Rev Growth","EPS Growth","Rating","Score"].map((h) => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900/60">
                  <td className="px-4 py-3"><Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link></td>
                  <td className="px-4 py-3 max-w-[180px] truncate text-gray-200">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.sector || "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{fmtCap(s.marketCap)}</td>
                  <td className="px-4 py-3 text-white">${s.price.toFixed(2)}</td>
                  <td className={`px-4 py-3 ${s.revenueGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{s.revenueGrowth >= 0 ? "+" : ""}{s.revenueGrowth.toFixed(1)}%</td>
                  <td className={`px-4 py-3 ${s.epsGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{s.epsGrowth >= 0 ? "+" : ""}{s.epsGrowth.toFixed(1)}%</td>
                  <td className={`px-4 py-3 text-xs ${s.analystRating?.includes("Buy") ? "text-emerald-400" : "text-gray-400"}`}>{s.analystRating || "N/A"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.bullishScore >= 70 ? "bg-emerald-900 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>{s.bullishScore}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stocks.length === 0 && <div className="py-16 text-center text-gray-500">No results. Try adjusting filters or scan the market first.</div>}
        </div>
      )}
    </div>
  );
}
