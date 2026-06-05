"use client";
import { useEffect, useState } from "react";
import type { EnhancedStockScore } from "@/lib/stocks/types";

interface Props {
  ticker: string;
}

const RATING_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Watch": { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-700" },
  "Watch":        { bg: "bg-blue-900/40",    text: "text-blue-300",    border: "border-blue-700"    },
  "Neutral":      { bg: "bg-gray-800/60",    text: "text-gray-300",    border: "border-gray-700"    },
  "Avoid":        { bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-800"     },
  "Insufficient Data": { bg: "bg-gray-900", text: "text-gray-500",    border: "border-gray-800"    },
};

function ScoreBar({ score, color }: { score: number | null; color: string }) {
  if (score === null) return <span className="text-xs text-gray-600">N/A</span>;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-6 text-right shrink-0">{score}</span>
    </div>
  );
}

function MetricRow({
  label,
  value,
  score,
  color,
  reason,
}: {
  label: string;
  value: string | number | null;
  score: number | null;
  color: string;
  reason?: string;
}) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
        <span className="text-xs text-gray-300 flex-1 truncate">{value ?? "N/A"}</span>
        <ScoreBar score={score} color={color} />
      </div>
      {reason && (
        <div className="absolute left-0 bottom-full mb-1 w-72 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-400 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {reason}
        </div>
      )}
    </div>
  );
}

export default function EnhancedScorePanel({ ticker }: Props) {
  const [data, setData] = useState<EnhancedStockScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (data) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/enhanced-score/${ticker}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const ratingStyle = data ? (RATING_STYLES[data.finalRating] ?? RATING_STYLES["Neutral"]) : null;

  return (
    <div>
      <button
        onClick={load}
        className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
      >
        {open ? "Hide Analysis ▴" : "Enhanced Score ▾"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-2 w-80">
          {loading && (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-5 bg-gray-800 rounded" />
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">Error: {error}</p>}

          {data && !loading && (
            <>
              {/* Final Rating */}
              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ratingStyle?.bg} ${ratingStyle?.border}`}>
                <span className="text-xs font-semibold text-gray-400">Final Rating</span>
                <span className={`text-sm font-bold ${ratingStyle?.text}`}>{data.finalRating}</span>
              </div>

              {/* Risk-adjusted score */}
              <div className="flex items-center justify-between py-1 border-b border-gray-800">
                <span className="text-xs text-gray-400 font-semibold">Risk-Adjusted Score</span>
                <span className={`text-sm font-bold ${(data.riskAdjustedScore ?? 0) >= 65 ? "text-emerald-400" : (data.riskAdjustedScore ?? 0) >= 45 ? "text-blue-400" : "text-red-400"}`}>
                  {data.riskAdjustedScore ?? "N/A"}
                  {data.riskAdjustedScore !== null && <span className="text-gray-600 text-xs">/100</span>}
                </span>
              </div>

              {/* Component scores */}
              <div className="space-y-0.5">
                <MetricRow label="Momentum" value={data.momentumScore.value} score={data.momentumScore.score} color="bg-emerald-500" reason={data.momentumScore.reason} />
                <MetricRow label="Volatility" value={data.volatilityScore.value ? `β ${data.volatilityScore.value}` : null} score={data.volatilityScore.score} color="bg-blue-500" reason={data.volatilityScore.reason} />
                <MetricRow label="Analyst Rating" value={data.analystScore.value} score={data.analystScore.score} color="bg-purple-500" reason={data.analystScore.reason} />
                <MetricRow label="Target Upside" value={data.targetUpside.value} score={data.targetUpside.score} color="bg-orange-500" reason={data.targetUpside.reason} />
                <MetricRow label="News Sentiment" value={data.newsSentiment.value ? `${data.newsSentiment.source === "polygon" ? "Polygon" : "Yahoo"} sentiment` : null} score={data.newsSentiment.score} color="bg-yellow-500" reason={data.newsSentiment.reason} />
                <MetricRow label="Volume" value={data.volumeScore.value} score={data.volumeScore.score} color="bg-cyan-500" reason={data.volumeScore.reason} />
              </div>

              {/* Weight disclosure */}
              <p className="text-xs text-gray-700 pt-1 border-t border-gray-800">
                Weights: momentum 30% · analyst 20% · upside 15% · volatility 15% · volume 10% · sentiment 10%
              </p>
              <p className="text-xs text-gray-700">
                Hover each row for detail. Ranking signal only — not financial advice.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
