"use client";
import { useEffect, useState, useCallback } from "react";
import MarketTable from "@/components/MarketTable";
import { TableSkeleton } from "@/components/Skeleton";

type MarketRow = {
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
};

const SORT_OPTIONS = [
  { value: "holderCount", label: "Holder Count" },
  { value: "totalCurrentValue", label: "Total Value" },
  { value: "totalSize", label: "Total Size" },
  { value: "avgCashPnl", label: "Avg PnL" },
  { value: "consensusScore", label: "Consensus Score" },
  { value: "totalVolume", label: "Volume" },
];

export default function MarketsPage() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minHolders, setMinHolders] = useState(0);
  const [minValue, setMinValue] = useState(0);
  const [gainingOnly, setGainingOnly] = useState(false);
  const [sortBy, setSortBy] = useState("holderCount");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search, category,
        minHolders: String(minHolders),
        minValue: String(minValue),
        gainingOnly: String(gainingOnly),
        sortBy,
      });
      const res = await fetch(`/api/markets?${params}`);
      setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [search, category, minHolders, minValue, gainingOnly, sortBy]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Markets</h1>

      <div className="flex flex-wrap gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-blue-500"
          placeholder="Search markets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-blue-500"
          placeholder="Category..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          type="number"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-blue-500"
          placeholder="Min holders"
          value={minHolders || ""}
          onChange={(e) => setMinHolders(Number(e.target.value))}
        />
        <input
          type="number"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-blue-500"
          placeholder="Min value ($)"
          value={minValue || ""}
          onChange={(e) => setMinValue(Number(e.target.value))}
        />
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={gainingOnly} onChange={(e) => setGainingOnly(e.target.checked)} className="rounded" />
          Gaining only
        </label>
      </div>

      <p className="text-gray-500 text-sm">{rows.length} markets</p>

      {loading ? <TableSkeleton rows={8} cols={12} /> : <MarketTable rows={rows} />}
    </div>
  );
}
