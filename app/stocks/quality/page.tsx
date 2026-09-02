"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TableSkeleton } from "@/components/Skeleton";
import { exportCSV, formatUSD } from "@/lib/analytics";
import BacktestSummary from "@/components/stocks/BacktestSummary";
import DataWarningBanner from "@/components/stocks/DataWarningBanner";
import RankChangeBadge from "@/components/stocks/RankChangeBadge";

interface Stock {
  id: string;
  ticker: string;
  name: string;
  marketCap: number;
  price: number;
  revenueGrowth: number;
  trailingPE: number | null;
  netIncome: number | null;
  totalDebt: number | null;
  cashAndEquivalents: number | null;
  freeCashFlow: number | null;
  qualityScore: number | null;
  qualityRank: number | null;
  rankChange: number | null;
}

function Change({ v }: { v: number }) {
  if (!isFinite(v)) return <span className="text-gray-500">N/A</span>;
  const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-500";
  return <span className={color}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

// Mirrors fundamentals.ts's EMPTY fallback — all four null means the FMP
// fetch for this ticker failed (or was plan-restricted), so the score below
// is first-pass only, missing margin/debt/FCF.
function missingFundamentals(s: Stock): boolean {
  return s.netIncome === null && s.totalDebt === null && s.cashAndEquivalents === null && s.freeCashFlow === null;
}

export default function QualityScreenPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBacktest, setShowBacktest] = useState(false);

  useEffect(() => {
    fetch("/api/stocks/quality").then((r) => r.json()).then(setStocks).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Quality / Growth</h1>
          <p className="text-gray-500 text-sm mt-1">
            Profitable, growing businesses ranked by earnings quality, valuation, and balance-sheet health —
            not by price momentum
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowBacktest(!showBacktest)}
            className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded hover:border-gray-500 transition-colors">
            {showBacktest ? "Hide Backtest" : "Show Backtest"}
          </button>
          <button onClick={() => exportCSV(stocks as unknown as Record<string, unknown>[], "quality.csv")}
            className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded hover:bg-emerald-900/30">
            Export CSV
          </button>
        </div>
      </div>

      {showBacktest && <BacktestSummary lens="quality" title="Quality Lens Backtest" />}

      {!loading && (
        <DataWarningBanner
          incompleteCount={stocks.filter(missingFundamentals).length}
          totalCount={stocks.length}
          label="Fundamentals (net income, debt, cash, FCF)"
        />
      )}

      {loading ? <TableSkeleton rows={12} cols={9} /> : (
        <div className="rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["#", "Ticker", "Company", "Price", "P/E", "Rev Growth", "Debt/Cash", "FCF", "Score"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">#{s.qualityRank}<RankChangeBadge delta={s.rankChange} /></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
                      <a href={`https://finance.yahoo.com/quote/${s.ticker}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-400">Yahoo ↗</a>
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-[180px]"><p className="truncate text-gray-200">{s.name}</p></td>
                  <td className="px-3 py-3 text-white font-medium">${s.price.toFixed(2)}</td>
                  <td className="px-3 py-3 text-gray-300">{s.trailingPE !== null ? s.trailingPE.toFixed(1) : "—"}</td>
                  <td className="px-3 py-3"><Change v={s.revenueGrowth} /></td>
                  <td className="px-3 py-3 text-gray-300">
                    {s.totalDebt !== null && s.cashAndEquivalents !== null
                      ? `${(s.totalDebt / Math.max(s.cashAndEquivalents, 1)).toFixed(1)}x`
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {s.freeCashFlow !== null
                      ? <span className={s.freeCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}>{formatUSD(s.freeCashFlow)}</span>
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      (s.qualityScore ?? 0) >= 70 ? "bg-emerald-900 text-emerald-300" : (s.qualityScore ?? 0) >= 45 ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400"
                    }`}>
                      {s.qualityScore ?? "—"}
                    </span>
                    {missingFundamentals(s) && (
                      <span title="Fundamentals unavailable (likely FMP plan restriction) — score reflects valuation/growth only, not margin/debt/FCF"
                        className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-800 cursor-help">
                        Partial
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stocks.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              No data yet — run a scan from the Top 50 page first.
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Score reflects only computable criteria (profitability, revenue growth, valuation, margins, debt/cash,
        free cash flow) — it is not a substitute for research into moat, management quality, or competitive
        position, which this score cannot measure.
      </p>
    </div>
  );
}
