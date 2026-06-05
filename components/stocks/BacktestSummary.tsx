"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";

interface BacktestResponse {
  available: boolean;
  message: string;
  data?: {
    period: string;
    strategyReturn: number;
    spyReturn: number;
    winRate: number;
    avgReturn: number;
  }[];
}

const PERIODS = ["1M Fwd", "3M Fwd", "6M Fwd", "12M Fwd"];

export default function BacktestSummary() {
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backtest")
      .then((r) => r.json())
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Strategy Backtest</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Simulated: top 10 ranked stocks · monthly rebalance · vs SPY
          </p>
        </div>
        <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-800">
          Simulated — not live
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {PERIODS.map((p) => <Skeleton key={p} className="h-10" />)}
        </div>
      ) : !result?.available ? (
        <div className="rounded-lg border border-dashed border-gray-700 py-8 text-center space-y-2">
          <p className="text-gray-400 text-sm font-medium">Backtest data unavailable</p>
          <p className="text-gray-600 text-xs">{result?.message ?? "No backtest engine connected."}</p>
          <p className="text-gray-700 text-xs mt-2">
            {/* TODO: Connect historical screener data to enable this section */}
            To enable: connect a backtest engine with historical price data and
            replay screener rankings monthly to compute forward returns.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase">
              <tr>
                {["Period", "Strategy", "SPY", "Alpha", "Win Rate", "Avg Return"].map((h) => (
                  <th key={h} className="pb-2 text-left pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {result.data?.map((row) => {
                const alpha = row.strategyReturn - row.spyReturn;
                return (
                  <tr key={row.period}>
                    <td className="py-2 pr-6 text-gray-300">{row.period}</td>
                    <td className={`py-2 pr-6 font-medium ${row.strategyReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.strategyReturn >= 0 ? "+" : ""}{row.strategyReturn.toFixed(1)}%
                    </td>
                    <td className={`py-2 pr-6 ${row.spyReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.spyReturn >= 0 ? "+" : ""}{row.spyReturn.toFixed(1)}%
                    </td>
                    <td className={`py-2 pr-6 font-medium ${alpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {alpha >= 0 ? "+" : ""}{alpha.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-6 text-gray-300">{row.winRate.toFixed(0)}%</td>
                    <td className={`py-2 ${row.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.avgReturn >= 0 ? "+" : ""}{row.avgReturn.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
