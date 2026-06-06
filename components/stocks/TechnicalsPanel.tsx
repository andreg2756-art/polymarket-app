"use client";
import { useState } from "react";
import type { ExtraStockMetrics } from "@/lib/stocks/technicals";
import type { ShortInterestResult } from "@/lib/stocks/shortInterest";
import { fmtLargeNum, fmtPct } from "@/lib/stocks/technicals";

interface Props {
  ticker: string;
  currentPrice: number;
}

interface PanelData {
  technicals:    ExtraStockMetrics | null;
  shortInterest: ShortInterestResult | null;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1 pt-2 border-t border-gray-800 first:mt-0 first:pt-0 first:border-0">
      {children}
    </p>
  );
}

function Row({
  label, value, highlight, sub,
}: {
  label: string; value: string; highlight?: "green" | "red" | "neutral"; sub?: string;
}) {
  const isNA = value === "N/A" || value.startsWith("N/A") || value.startsWith("Unavailable");
  const color = isNA
    ? "text-gray-600"
    : highlight === "green" ? "text-emerald-400"
    : highlight === "red"   ? "text-red-400"
    : "text-gray-300";
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-gray-800 last:border-0 gap-2">
      <div className="shrink-0 w-40">
        <span className="text-xs text-gray-500">{label}</span>
        {sub && <p className="text-xs text-gray-700">{sub}</p>}
      </div>
      <span className={`text-xs font-medium text-right ${color}`}>{value}</span>
    </div>
  );
}

function maHighlight(pct: number | null): "green" | "red" | "neutral" {
  if (pct === null) return "neutral";
  return pct >= 0 ? "green" : "red";
}

function siRiskColor(level: ShortInterestResult["riskLevel"]): "green" | "red" | "neutral" {
  if (level === "high") return "red";
  if (level === "low")  return "green";
  return "neutral";
}

export default function TechnicalsPanel({ ticker, currentPrice }: Props) {
  const [panelData, setPanelData] = useState<PanelData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  void currentPrice;

  async function load() {
    if (panelData) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const [techRes, siRes] = await Promise.allSettled([
        fetch(`/api/stocks/technicals/${ticker}`).then((r) => r.json()),
        fetch(`/api/stocks/short-interest/${ticker}`).then((r) => r.json()),
      ]);
      setPanelData({
        technicals:    techRes.status === "fulfilled" ? techRes.value : null,
        shortInterest: siRes.status   === "fulfilled" ? siRes.value   : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const d  = panelData?.technicals ?? null;
  const si = panelData?.shortInterest ?? null;

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
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-5 bg-gray-800 rounded" />)}
            </div>
          )}
          {error && <p className="text-xs text-red-400">Error: {error}</p>}

          {panelData && !loading && (
            <>
              {/* Moving Averages */}
              <SectionHeader>Moving Averages</SectionHeader>
              <Row label="50-Day SMA"       value={d?.sma50  !== null && d?.sma50  !== undefined ? `$${d.sma50.toFixed(2)}`  : "N/A"} />
              <Row label="200-Day SMA"      value={d?.sma200 !== null && d?.sma200 !== undefined ? `$${d.sma200.toFixed(2)}` : "N/A"} />
              <Row label="Price vs 50-Day"  value={d?.priceVsSma50Pct  !== null && d?.priceVsSma50Pct  !== undefined ? fmtPct(d.priceVsSma50Pct)  : "N/A"} highlight={maHighlight(d?.priceVsSma50Pct  ?? null)} />
              <Row label="Price vs 200-Day" value={d?.priceVsSma200Pct !== null && d?.priceVsSma200Pct !== undefined ? fmtPct(d.priceVsSma200Pct) : "N/A"} highlight={maHighlight(d?.priceVsSma200Pct ?? null)} />

              {/* Returns */}
              <SectionHeader>Returns</SectionHeader>
              <Row label="1-Month Return" value={d?.oneMonthReturnPct   !== null && d?.oneMonthReturnPct   !== undefined ? fmtPct(d.oneMonthReturnPct)   : "N/A"} highlight={d?.oneMonthReturnPct   !== null && d?.oneMonthReturnPct   !== undefined ? (d.oneMonthReturnPct   >= 0 ? "green" : "red") : "neutral"} />
              <Row label="3-Month Return" value={d?.threeMonthReturnPct !== null && d?.threeMonthReturnPct !== undefined ? fmtPct(d.threeMonthReturnPct) : "N/A"} highlight={d?.threeMonthReturnPct !== null && d?.threeMonthReturnPct !== undefined ? (d.threeMonthReturnPct >= 0 ? "green" : "red") : "neutral"} />

              {/* Volume */}
              <SectionHeader>Volume</SectionHeader>
              <Row label="Avg Daily Vol (30d)" value={fmtLargeNum(d?.averageVolume ?? null)} />
              <Row label="Relative Volume"     value={d?.relativeVolume !== null && d?.relativeVolume !== undefined ? `${d.relativeVolume.toFixed(2)}x` : "N/A"} highlight={d?.relativeVolume !== null && d?.relativeVolume !== undefined ? (d.relativeVolume >= 1.5 ? "green" : d.relativeVolume < 0.8 ? "red" : "neutral") : "neutral"} />

              {/* Float */}
              <SectionHeader>Float (FMP)</SectionHeader>
              <Row label="Float Shares"       value={fmtLargeNum(d?.floatShares      ?? null)} />
              <Row label="Free Float %"       value={d?.freeFloatPct      !== null && d?.freeFloatPct      !== undefined ? `${d.freeFloatPct.toFixed(1)}%`          : "N/A"} />
              <Row label="Outstanding Shares" value={fmtLargeNum(d?.outstandingShares ?? null)} />
              <Row label="Float Turnover"     value={d?.floatTurnover     !== null && d?.floatTurnover     !== undefined ? `${(d.floatTurnover * 100).toFixed(2)}%` : "N/A"} highlight={d?.floatTurnover !== null && d?.floatTurnover !== undefined ? (d.floatTurnover > 0.05 ? "green" : "neutral") : "neutral"} />

              {/* Short Interest */}
              <SectionHeader>Short Interest (Polygon)</SectionHeader>
              {si?.planLimited ? (
                <p className="text-xs text-gray-600 py-1">Unavailable on current Polygon plan</p>
              ) : (
                <>
                  <Row label="Shares Short"     value={si?.displaySharesShort  ?? "N/A"} />
                  <Row label="Short % of Float" value={si?.displayShortPct     ?? "N/A"} highlight={si?.riskLevel ? siRiskColor(si.riskLevel) : "neutral"} />
                  <Row label="Days to Cover"    value={si?.displayDaysToCover  ?? "N/A"} highlight={si?.riskLevel === "high" ? "red" : si?.riskLevel === "low" ? "green" : "neutral"} />
                  <Row label="Settlement Date"  value={si?.displaySettlement   ?? "N/A"} sub="Reported ~twice monthly" />
                </>
              )}

              {/* Footer */}
              <p className="text-xs text-gray-700 mt-2 pt-2 border-t border-gray-800">
                SMA/volume: Yahoo 1yr daily · Float: FMP · Short interest: Polygon · Cached 1hr
              </p>
              <p className="text-xs text-yellow-900 mt-1">
                ⚠ Short interest ≠ short volume. Data is delayed ~2 weeks.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
