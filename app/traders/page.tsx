"use client";
import { useState } from "react";
import { formatUSD, exportCSV } from "@/lib/analytics";
import { useFetch } from "@/lib/useFetch";
import { TableSkeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import Link from "next/link";

interface TraderRow {
  id: string;
  proxyWallet: string;
  username: string | null;
  rank: number;
  monthlyPnl: number;
  monthlyVolume: number;
  positionCount: number;
  totalCurrentValue: number;
  totalSize: number;
  bestPosition: { marketTitle: string; cashPnl: number } | null;
  worstPosition: { marketTitle: string; cashPnl: number } | null;
  roiPct: number;
  winRate: number;
}

type SortKey = "rank" | "roiPct" | "winRate";

export default function TradersPage() {
  const { data, loading, error, reload } = useFetch<TraderRow[]>("/api/traders");
  const traders = data ?? [];
  const [sortBy, setSortBy] = useState<SortKey>("rank");

  const sorted = [...traders].sort((a, b) =>
    sortBy === "rank" ? a.rank - b.rank : b[sortBy] - a[sortBy]
  );

  function handleExport() {
    exportCSV(
      traders.map((t) => ({
        rank: t.rank,
        username: t.username ?? "",
        wallet: t.proxyWallet,
        monthlyPnl: t.monthlyPnl,
        monthlyVolume: t.monthlyVolume,
        positions: t.positionCount,
        totalValue: t.totalCurrentValue,
        totalSize: t.totalSize,
        roiPct: t.roiPct,
        winRate: t.winRate,
      })),
      "whale-traders.csv"
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Top 100 Traders</h1>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="rank">Sort: Rank</option>
            <option value="roiPct">Sort: ROI %</option>
            <option value="winRate">Sort: Win Rate</option>
          </select>
          <button onClick={handleExport} className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 px-3 py-1 rounded">
            Export CSV
          </button>
        </div>
      </div>

      {loading ? <TableSkeleton rows={10} cols={11} /> : error ? <ErrorState onRetry={reload} /> : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["Rank","Username","Wallet","Monthly PnL","Volume","Positions","Total Value","ROI %","Win Rate","Best","Worst"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.map((t) => (
                <tr key={t.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-gray-500">#{t.rank}</td>
                  <td className="px-4 py-3">
                    <Link href={`/traders/${t.proxyWallet}`} className="text-blue-300 hover:underline">{t.username || "Unknown"}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.proxyWallet.slice(0, 10)}...</td>
                  <td className={`px-4 py-3 font-semibold ${t.monthlyPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatUSD(t.monthlyPnl)}</td>
                  <td className="px-4 py-3 text-gray-300">{t.monthlyVolume > 0 ? formatUSD(t.monthlyVolume) : "N/A"}</td>
                  <td className="px-4 py-3 text-gray-300">{t.positionCount}</td>
                  <td className="px-4 py-3 text-green-400">{formatUSD(t.totalCurrentValue)}</td>
                  <td className={`px-4 py-3 font-medium ${t.roiPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.roiPct >= 0 ? "+" : ""}{t.roiPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-gray-300">{t.winRate}%</td>
                  <td className="px-4 py-3 text-xs max-w-[140px]">
                    {t.bestPosition ? (
                      <span className="text-green-400 truncate block" title={t.bestPosition.marketTitle}>
                        {formatUSD(t.bestPosition.cashPnl)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[140px]">
                    {t.worstPosition ? (
                      <span className="text-red-400 truncate block" title={t.worstPosition.marketTitle}>
                        {formatUSD(t.worstPosition.cashPnl)}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {traders.length === 0 && <div className="py-16 text-center text-gray-500">No traders yet. Click Refresh Data on the dashboard.</div>}
        </div>
      )}
    </div>
  );
}
