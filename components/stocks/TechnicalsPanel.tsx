"use client";
import { useEffect, useState } from "react";
import type { ExtraStockMetrics } from "@/lib/stocks/technicals";
import { fmtLargeNum, fmtPct } from "@/lib/stocks/technicals";

interface Props {
  ticker: string;
  currentPrice: number;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "red" | "neutral" }) {
  const color = highlight === "green" ? "text-emerald-400" : highlight === "red" ? "text-red-400" : "text-gray-300";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 w-40 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${value === "N/A" ? "text-gray-600" : color}`}>{value}</span>
    </div>
  );
}

function maHighlight(pct: number | null): "green" | "red" | "neutral" {
  if (pct === null) return "neutral";
  return pct >= 0 ? "green" : "red";
}

export default function TechnicalsPanel({ ticker, currentPrice }: Props) {
  const [data, setData] = useState<ExtraStockMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (data) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/technicals/${ticker}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const price = currentPrice;

  return (
    <div>
      <button
        onClick={load}
        className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
      >
        {open ? "Hide Technicals ▴" : "Technicals ▾"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950 p-3 w-72">
          {loading && (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 bg-gray-800 rounded" />)}
            </div>
          )}
          {error && <p className="text-xs text-red-400">Error: {error}</p>}

          {data && !loading && (
            <>
              {/* Moving Averages */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Moving Averages</p>
              <Row
                label="50-Day SMA"
                value={data.sma50 !== null ? `$${data.sma50.toFixed(2)}` : "N/A"}
              />
              <Row
                label="200-Day SMA"
                value={data.sma200 !== null ? `$${data.sma200.toFixed(2)}` : "N/A"}
              />
              <Row
                label="Price vs 50-Day"
                value={data.priceVsSma50Pct !== null ? fmtPct(data.priceVsSma50Pct) : "N/A"}
                highlight={maHighlight(data.priceVsSma50Pct)}
              />
              <Row
                label="Price vs 200-Day"
                value={data.priceVsSma200Pct !== null ? fmtPct(data.priceVsSma200Pct) : "N/A"}
                highlight={maHighlight(data.priceVsSma200Pct)}
              />

              {/* Returns */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1 pt-2 border-t border-gray-800">Returns</p>
              <Row
                label="1-Month Return"
                value={fmtPct(data.oneMonthReturnPct)}
                highlight={data.oneMonthReturnPct !== null ? (data.oneMonthReturnPct >= 0 ? "green" : "red") : "neutral"}
              />
              <Row
                label="3-Month Return"
                value={fmtPct(data.threeMonthReturnPct)}
                highlight={data.threeMonthReturnPct !== null ? (data.threeMonthReturnPct >= 0 ? "green" : "red") : "neutral"}
              />

              {/* Volume */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1 pt-2 border-t border-gray-800">Volume</p>
              <Row label="Avg Daily Volume (30d)" value={fmtLargeNum(data.averageVolume)} />
              <Row
                label="Relative Volume"
                value={data.relativeVolume !== null ? `${data.relativeVolume.toFixed(2)}x` : "N/A"}
                highlight={data.relativeVolume !== null ? (data.relativeVolume >= 1.5 ? "green" : data.relativeVolume < 0.8 ? "red" : "neutral") : "neutral"}
              />

              {/* Float */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1 pt-2 border-t border-gray-800">Float</p>
              <Row label="Float Shares" value={fmtLargeNum(data.floatShares)} />
              <Row label="Free Float %" value={data.freeFloatPct !== null ? `${data.freeFloatPct.toFixed(1)}%` : "N/A"} />
              <Row label="Outstanding Shares" value={fmtLargeNum(data.outstandingShares)} />
              <Row
                label="Float Turnover"
                value={data.floatTurnover !== null ? `${(data.floatTurnover * 100).toFixed(2)}%` : "N/A"}
                highlight={data.floatTurnover !== null ? (data.floatTurnover > 0.05 ? "green" : "neutral") : "neutral"}
              />

              <p className="text-xs text-gray-700 mt-2 pt-2 border-t border-gray-800">
                SMA from Yahoo 1yr daily · Float from FMP · Cached 1hr
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
