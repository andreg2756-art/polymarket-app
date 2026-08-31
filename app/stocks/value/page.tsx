"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TableSkeleton } from "@/components/Skeleton";
import { exportCSV } from "@/lib/analytics";
import BacktestSummary from "@/components/stocks/BacktestSummary";
import DataWarningBanner from "@/components/stocks/DataWarningBanner";

interface Stock {
  id: string;
  ticker: string;
  name: string;
  marketCap: number;
  price: number;
  trailingPE: number | null;
  priceToBook: number | null;
  cashAndEquivalents: number | null;
  totalDebt: number | null;
  freeCashFlow: number | null;
  turnaroundScore: number | null;
  turnaroundRank: number | null;
}

export default function ValueTurnaroundPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBacktest, setShowBacktest] = useState(false);

  useEffect(() => {
    fetch("/api/stocks/turnaround").then((r) => r.json()).then(setStocks).finally(() => setLoading(false));
  }, []);

  // Mirrors fundamentals.ts's EMPTY fallback — all three null means the FMP
  // fetch for this ticker failed (or was plan-restricted), so the score
  // below is first-pass only, missing survival/trend evidence.
  function missingFundamentals(s: Stock): boolean {
    return s.totalDebt === null && s.cashAndEquivalents === null && s.freeCashFlow === null;
  }

  function runway(s: Stock): string {
    if (s.freeCashFlow === null) return "—";
    if (s.freeCashFlow >= 0) return "Self-sustaining";
    if (s.cashAndEquivalents === null) return "—";
    const years = s.cashAndEquivalents / Math.abs(s.freeCashFlow);
    return `${years.toFixed(1)}y`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Value / Turnaround</h1>
          <p className="text-gray-500 text-sm mt-1">
            Beaten-down valuations ranked by cheapness, balance-sheet survival, and improving-trend evidence —
            not by price action
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowBacktest(!showBacktest)}
            className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded hover:border-gray-500 transition-colors">
            {showBacktest ? "Hide Backtest" : "Show Backtest"}
          </button>
          <button onClick={() => exportCSV(stocks as unknown as Record<string, unknown>[], "turnaround.csv")}
            className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded hover:bg-emerald-900/30">
            Export CSV
          </button>
        </div>
      </div>

      {showBacktest && <BacktestSummary lens="turnaround" title="Value/Turnaround Lens Backtest" />}

      {!loading && (
        <DataWarningBanner
          incompleteCount={stocks.filter(missingFundamentals).length}
          totalCount={stocks.length}
          label="Fundamentals (debt, cash, FCF)"
        />
      )}

      {loading ? <TableSkeleton rows={12} cols={8} /> : (
        <div className="rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["#", "Ticker", "Company", "Price", "P/E", "P/B", "Cash Runway", "Score"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-3 py-3 text-gray-500 text-xs">#{s.turnaroundRank}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
                      <a href={`https://finance.yahoo.com/quote/${s.ticker}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-400">Yahoo ↗</a>
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-[180px]"><p className="truncate text-gray-200">{s.name}</p></td>
                  <td className="px-3 py-3 text-white font-medium">${s.price.toFixed(2)}</td>
                  <td className="px-3 py-3 text-gray-300">{s.trailingPE !== null ? s.trailingPE.toFixed(1) : "—"}</td>
                  <td className="px-3 py-3 text-gray-300">{s.priceToBook !== null ? s.priceToBook.toFixed(1) : "—"}</td>
                  <td className={`px-3 py-3 ${s.freeCashFlow !== null && s.freeCashFlow >= 0 ? "text-emerald-400" : "text-gray-300"}`}>
                    {runway(s)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      (s.turnaroundScore ?? 0) >= 70 ? "bg-emerald-900 text-emerald-300" : (s.turnaroundScore ?? 0) >= 45 ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400"
                    }`}>
                      {s.turnaroundScore ?? "—"}
                    </span>
                    {missingFundamentals(s) && (
                      <span title="Fundamentals unavailable (likely FMP plan restriction) — score reflects valuation/off-high only, not survival/trend evidence"
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
        Score reflects only computable criteria (valuation cheapness, distance off 52-week high, cash runway,
        revenue/margin/FCF trend direction) — it cannot assess why a stock is cheap, whether the reason is
        temporary or structural, or the quality of management driving the turnaround.
      </p>
    </div>
  );
}
