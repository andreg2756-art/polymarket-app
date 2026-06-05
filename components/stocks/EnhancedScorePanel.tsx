"use client";
import { useEffect, useState } from "react";
import type { EnhancedStockScore } from "@/lib/stocks/types";

interface Props { ticker: string }

const RATING_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Watch":      { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-700" },
  "Watch":             { bg: "bg-blue-900/40",    text: "text-blue-300",    border: "border-blue-700"    },
  "Neutral":           { bg: "bg-gray-800/60",    text: "text-gray-300",    border: "border-gray-700"    },
  "Avoid":             { bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-800"     },
  "Insufficient Data": { bg: "bg-gray-900",       text: "text-gray-500",    border: "border-gray-800"    },
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
  label, sublabel, value, score, color, reason, tag, weight,
}: {
  label: string;
  sublabel?: string;
  value: string | number | null;
  score: number | null;
  color: string;
  reason?: string;
  tag?: React.ReactNode;
  weight?: string;
}) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="w-40 shrink-0">
          <span className="text-xs text-gray-400">{label}</span>
          {sublabel && <span className="text-xs text-gray-600 ml-1">({sublabel})</span>}
          {weight && <span className="text-xs text-gray-700 ml-1">{weight}</span>}
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-xs text-gray-300 truncate">{value ?? "N/A"}</span>
          {tag}
        </div>
        <ScoreBar score={score} color={color} />
      </div>
      {/* Supporting detail sub-row — shown inline when present */}
      {reason && (
        <div className="absolute left-0 bottom-full mb-1 w-80 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-400 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
          {reason}
        </div>
      )}
    </div>
  );
}

function ModifierRow({
  label, value, amount, reason,
}: {
  label: string;
  value: string | null;
  amount: number | null;
  reason?: string;
}) {
  const isPositive = amount !== null && amount > 0;
  const isNegative = amount !== null && amount < 0;
  const display = amount === null ? "N/A" : amount === 0 ? "No change" : `${isPositive ? "+" : ""}${amount} pts`;
  const color = isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-gray-500";
  return (
    <div className="relative group flex items-center justify-between gap-2 py-1.5">
      <span className="text-xs text-gray-400 w-40 shrink-0">{label}</span>
      <span className="text-xs text-gray-500 flex-1 truncate">{value ?? "N/A"}</span>
      <span className={`text-xs font-medium w-14 text-right shrink-0 ${color}`}>{display}</span>
      {reason && (
        <div className="absolute left-0 bottom-full mb-1 w-80 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-400 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
          {reason}
        </div>
      )}
    </div>
  );
}

function CalcTag() {
  return <span className="text-xs bg-gray-800 text-gray-600 px-1 py-0.5 rounded shrink-0">calc</span>;
}

export default function EnhancedScorePanel({ ticker }: Props) {
  const [data, setData] = useState<EnhancedStockScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (data) { setOpen((o) => !o); return; }
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

  const ratingStyle  = data ? (RATING_STYLES[data.finalRating] ?? RATING_STYLES.Neutral) : null;
  const upsideLabel  = data?.hasRealAnalystTarget ? "Analyst Target Upside" : "Distance to 52W High";
  const upsideSub    = data?.hasRealAnalystTarget ? undefined : "52w range";

  // Revenue modifier display (+/- amount)
  const revMod = data?.revenueGrowthScore?.modifier ?? null;
  // Earnings penalty display (stored as positive magnitude, applied as subtraction)
  const earnPenalty = data?.earningsRiskScore?.score != null && data.earningsRiskScore.daysUntilEarnings != null
    ? -(data.earningsRiskScore.score)
    : null;

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
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 bg-gray-800 rounded" />)}
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
                <span className={`text-sm font-bold ${(data.riskAdjustedScore ?? 0) >= 68 ? "text-emerald-400" : (data.riskAdjustedScore ?? 0) >= 55 ? "text-blue-400" : "text-red-400"}`}>
                  {data.riskAdjustedScore ?? "N/A"}
                  {data.riskAdjustedScore !== null && <span className="text-gray-600 text-xs font-normal">/100</span>}
                </span>
              </div>

              {/* Weighted components */}
              <div className="space-y-0">
                <MetricRow
                  label="Momentum"       weight="20%"
                  value={data.momentumScore.value}
                  score={data.momentumScore.score}
                  color="bg-emerald-500"
                  reason={data.momentumScore.reason}
                />
                <MetricRow
                  label="RS Rank"        weight="20%"
                  value={data.rsRank.value}
                  score={data.rsRank.score}
                  color="bg-teal-500"
                  reason={data.rsRank.reason}
                  tag={<CalcTag />}
                />
                <MetricRow
                  label="Risk Quality"   weight="20%"
                  sublabel="β · vol · 52w"
                  value={data.riskQualityScore.value}
                  score={data.riskQualityScore.score}
                  color="bg-purple-500"
                  reason={data.riskQualityScore.reason}
                  tag={<CalcTag />}
                />
                <MetricRow
                  label={upsideLabel}    weight="15%"
                  sublabel={upsideSub}
                  value={data.upsideScore.value}
                  score={data.upsideScore.score}
                  color="bg-orange-500"
                  reason={data.upsideScore.reason}
                  tag={!data.hasRealAnalystTarget ? <CalcTag /> : undefined}
                />
                <MetricRow
                  label="Volume"         weight="15%"
                  value={data.volumeScore.value}
                  score={data.volumeScore.score}
                  color="bg-cyan-500"
                  reason={data.volumeScore.reason}
                />
                <MetricRow
                  label="News Sentiment" weight="5%"
                  value={data.newsSentiment.score !== null ? `${data.newsSentiment.source === "polygon" ? "Polygon" : "Yahoo"} (${data.newsSentiment.score})` : null}
                  score={data.newsSentiment.score}
                  color="bg-yellow-500"
                  reason={data.newsSentiment.reason}
                />
              </div>

              {/* Modifiers */}
              <div className="border-t border-gray-800 pt-2 space-y-0">
                <p className="text-xs text-gray-600 mb-1 font-medium">Score Modifiers</p>
                <ModifierRow
                  label="Revenue Growth"
                  value={data.revenueGrowthScore?.value?.toString() ?? null}
                  amount={revMod ?? null}
                  reason={data.revenueGrowthScore?.reason}
                />
                <ModifierRow
                  label="Earnings Risk"
                  value={data.earningsRiskScore?.value?.toString() ?? null}
                  amount={earnPenalty}
                  reason={data.earningsRiskScore?.reason}
                />
              </div>

              {/* Footer */}
              <p className="text-xs text-gray-700 pt-1 border-t border-gray-800 leading-relaxed">
                Weights: momentum 20% · RS rank 20% · risk quality 20% · upside/range 15% · volume 15% · sentiment 5%
              </p>
              <p className="text-xs text-gray-700">
                Risk Quality includes beta, historical volatility, and 52-week range position.
                <br />
                <span className="text-gray-600">calc</span> = calculated from price history · not financial advice
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
