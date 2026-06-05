"use client";
import { useState } from "react";

interface Props {
  ticker: string;
  score: number;
  change1M: number;
  change3M: number;
  relativeVolume: number;
}

function bar(value: number, max: number, color: string) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-6 text-right">{value}</span>
    </div>
  );
}

export default function ScoreBreakdown({ ticker, score, change1M, change3M, relativeVolume }: Props) {
  const [open, setOpen] = useState(false);

  // Recompute component scores (mirrors refresh route logic)
  const mom1M = change1M > 30 ? 30 : change1M > 20 ? 24 : change1M > 10 ? 18 : change1M > 5 ? 12 : change1M > 0 ? 6 : change1M > -5 ? 2 : 0;
  const mom3M = change3M > 50 ? 35 : change3M > 30 ? 28 : change3M > 15 ? 20 : change3M > 5 ? 13 : change3M > 0 ? 7 : change3M > -10 ? 2 : 0;
  const volScore = relativeVolume > 3 ? 20 : relativeVolume > 2 ? 15 : relativeVolume > 1.5 ? 10 : relativeVolume > 1.2 ? 6 : relativeVolume > 1 ? 3 : 0;
  const trendBonus = change1M > 0 && change3M > 0 ? 15 : change1M > 0 ? 5 : 0;

  const rows = [
    { label: "1M Momentum", value: mom1M, max: 30, color: "bg-emerald-500", desc: `${change1M >= 0 ? "+" : ""}${change1M.toFixed(1)}% past month` },
    { label: "3M Trend", value: mom3M, max: 35, color: "bg-blue-500", desc: `${change3M >= 0 ? "+" : ""}${change3M.toFixed(1)}% past 3 months` },
    { label: "Relative Volume", value: volScore, max: 20, color: "bg-orange-500", desc: `${relativeVolume.toFixed(1)}x 20-day average` },
    { label: "Trend Alignment", value: trendBonus, max: 15, color: "bg-purple-500", desc: change1M > 0 && change3M > 0 ? "Both 1M & 3M positive" : change1M > 0 ? "1M positive only" : "No trend alignment" },
  ];

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
      >
        {open ? "Hide breakdown" : "Score breakdown ▾"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 bg-gray-950 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-300">{ticker} Score: {score}/100</span>
            <span className="text-xs text-gray-600">Ranking signal · not a prediction</span>
          </div>

          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{r.label}</span>
                <span className="text-xs text-gray-600">{r.desc}</span>
              </div>
              {bar(r.value, r.max, r.color)}
              <p className="text-xs text-gray-700 mt-0.5">max {r.max} pts</p>
            </div>
          ))}

          <p className="text-xs text-yellow-700 border-t border-gray-800 pt-2 mt-2">
            ⚠ Score ranks momentum signals only. It does not account for valuation,
            earnings dates, debt, dilution risk, or sector rotation. Always review
            fundamentals before acting.
          </p>
        </div>
      )}
    </div>
  );
}
