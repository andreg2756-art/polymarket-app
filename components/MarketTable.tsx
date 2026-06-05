"use client";
import { exportCSV, formatUSD } from "@/lib/analytics";

interface MarketRow {
  id: string;
  conditionId: string;
  marketTitle: string;
  outcome: string;
  category: string | null;
  holderCount: number;
  pctOfTop100: string;
  totalCurrentValue: number;
  totalSize: number;
  avgCashPnl: number;
  totalVolume: number;
  consensusScore: number;
  holderCountDelta: number;
  currentValueDelta: number;
}

interface Props {
  rows: MarketRow[];
}

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="text-gray-500">—</span>;
  const color = v > 0 ? "text-green-400" : "text-red-400";
  return <span className={color}>{v > 0 ? "+" : ""}{v.toFixed(0)}</span>;
}

export default function MarketTable({ rows }: Props) {
  function handleExport() {
    exportCSV(
      rows.map((r) => ({
        market: r.marketTitle,
        outcome: r.outcome,
        category: r.category ?? "",
        holders: r.holderCount,
        pct: r.pctOfTop100,
        totalValue: r.totalCurrentValue,
        totalSize: r.totalSize,
        avgPnl: r.avgCashPnl,
        volume: r.totalVolume,
        consensus: r.consensusScore,
        holderDelta: r.holderCountDelta,
        valueDelta: r.currentValueDelta,
      })),
      "whale-markets.csv"
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={handleExport} className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 px-3 py-1 rounded">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {["Market","Outcome","Category","Holders","% Top 100","Total Value","Size","Avg PnL","Volume","Score","ΔHolders","ΔValue"].map((h) => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-900/50 transition-colors">
                <td className="px-4 py-3 max-w-[220px]">
                  <a href={`/markets/${r.conditionId}`} className="text-blue-300 hover:underline line-clamp-2">{r.marketTitle}</a>
                </td>
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.outcome}</td>
                <td className="px-4 py-3 text-gray-500">{r.category || "—"}</td>
                <td className="px-4 py-3 font-semibold text-white">{r.holderCount}</td>
                <td className="px-4 py-3 text-gray-300">{r.pctOfTop100}%</td>
                <td className="px-4 py-3 text-green-400">{formatUSD(r.totalCurrentValue)}</td>
                <td className="px-4 py-3 text-gray-300">{r.totalSize.toFixed(0)}</td>
                <td className={`px-4 py-3 ${r.avgCashPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatUSD(r.avgCashPnl)}</td>
                <td className="px-4 py-3 text-gray-300">{r.totalVolume > 0 ? formatUSD(r.totalVolume) : "N/A"}</td>
                <td className="px-4 py-3">
                  <span className="bg-blue-900 text-blue-200 text-xs px-2 py-0.5 rounded-full">{r.consensusScore}</span>
                </td>
                <td className="px-4 py-3"><Delta v={r.holderCountDelta} /></td>
                <td className="px-4 py-3"><Delta v={r.currentValueDelta} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-16 text-gray-500">No markets found. Try adjusting filters.</div>
        )}
      </div>
    </div>
  );
}
