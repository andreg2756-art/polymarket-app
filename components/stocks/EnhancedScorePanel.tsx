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
  label,
  sublabel,
  value,
  score,
  color,
  reason,
  tag,
}: {
  label: string;
  sublabel?: string;
  value: string | number | null;
  score: number | null;
  color: string;
  reason?: string;
  tag?: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="w-36 shrink-0">
          <span className="text-xs text-gray-400">{label}</span>
          {sublabel && <span className="text-xs text-gray-600 ml-1">({sublabel})</span>}
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-xs text-gray-300 truncate">{value ?? "N/A"}</span>
          {tag}
        </div>
        <ScoreBar score={score} color={color} />
      </div>
      {reason && (
        <div className="absolute left-0 bottom-full mb-1 w-80 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-400 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
          {reason}
        </div>
      )}
    </div>
  );
}

function PenaltyRow({ label, value, penalty, reason }: { label: string; value: string | null; penalty: number | null; reason?: string }) {
  const penaltyDisplay = penalty && penalty > 0 ? `-${penalty} pts` : penalty === 0 ? "No penalty" : "N/A";
  const color = penalty && penalty > 0 ? "text-red-400" : "text-gray-500";
  return (
    <div className="relative group flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-xs text-gray-300 flex-1">{value ?? "N/A"}</span>
      <span className={`text-xs font-medium w-16 text-right shrink-0 ${color}`}>{penaltyDisplay}</span>
      {reason && (
        <div className="absolute left-0 bottom-full mb-1 w-80 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-400 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
          {reason}
        </div>
      )}
    </div>
  );
}

function CalculatedTag() {
  return (
    <span className="text-xs bg-gray-800 text-gray-600 px-1 py-0.5 rounded shrink-0 ml-1">calc</span>
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

  // Correct labels based on data availability flags
  const analystLabel  = data?.hasRealAnalystConsensus ? "Analyst Rating"        : "Risk Quality";
  const upsideLabel   = data?.hasRealAnalystTarget    ? "Analyst Target Upside" : "Distance to 52W High";
  const analystSub    = data?.hasRealAnalystConsensus ? undefined                : "derived";
  const upsideSub     = data?.hasRealAnalystTarget    ? undefined                : "52w range";

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
                <span className={`text-sm font-bold ${(data.riskAdjustedScore ?? 0) >= 65 ? "text-emerald-400" : (data.riskAdjustedScore ?? 0) >= 45 ? "text-blue-400" : "text-red-400"}`}>
                  {data.riskAdjustedScore ?? "N/A"}
                  {data.riskAdjustedScore !== null && <span className="text-gray-600 text-xs font-normal">/100</span>}
                </span>
              </div>

              {/* Component scores */}
              <div className="space-y-0">
                <MetricRow label="Momentum"       value={data.momentumScore.value}           score={data.momentumScore.score}    color="bg-emerald-500" reason={data.momentumScore.reason} />
                <MetricRow label="Volatility"     value={data.volatilityScore.value ? `β ${data.volatilityScore.value}` : null}  score={data.volatilityScore.score}  color="bg-blue-500"    reason={data.volatilityScore.reason}   tag={<CalculatedTag />} />
                <MetricRow label={analystLabel}   sublabel={analystSub}  value={data.riskQualityScore.value}  score={data.riskQualityScore.score}  color="bg-purple-500"  reason={data.riskQualityScore.reason}  tag={!data.hasRealAnalystConsensus ? <CalculatedTag /> : undefined} />
                <MetricRow label={upsideLabel}    sublabel={upsideSub}   value={data.upsideScore.value}       score={data.upsideScore.score}       color="bg-orange-500"  reason={data.upsideScore.reason}       tag={!data.hasRealAnalystTarget ? <CalculatedTag /> : undefined} />
                <MetricRow label="Volume"         value={data.volumeScore.value}             score={data.volumeScore.score}      color="bg-cyan-500"    reason={data.volumeScore.reason} />
                <MetricRow label="News Sentiment" value={data.newsSentiment.value ? `${data.newsSentiment.source === "polygon" ? "Polygon" : "Yahoo"}` : null} score={data.newsSentiment.score} color="bg-yellow-500" reason={data.newsSentiment.reason} />
              </div>

              {/* RS Rank */}
              <div className="border-t border-gray-800 pt-2">
                <MetricRow
                  label="RS Rank"
                  value={data.rsRank.value}
                  score={data.rsRank.score}
                  color="bg-teal-500"
                  reason={data.rsRank.reason}
                  tag={<CalculatedTag />}
                />
              </div>

              {/* Modifiers / Penalties */}
              <div className="border-t border-gray-800 pt-2 space-y-0">
                <p className="text-xs text-gray-600 mb-1">Score Modifiers</p>
                <PenaltyRow
                  label="Revenue Growth"
                  value={data.revenueGrowthScore?.value?.toString() ?? null}
                  penalty={data.revenueGrowthScore?.modifier !== undefined
                    ? (data.revenueGrowthScore.modifier > 0 ? -(data.revenueGrowthScore.modifier) * -1 : data.revenueGrowthScore.modifier * -1)
                    : null}
                  reason={data.revenueGrowthScore?.reason}
                />
                <PenaltyRow
                  label="Earnings Risk"
                  value={data.earningsRiskScore?.value?.toString() ?? null}
                  penalty={data.earningsRiskScore?.score ?? null}
                  reason={data.earningsRiskScore?.reason}
                />
              </div>

              {/* Footer */}
              <p className="text-xs text-gray-700 pt-1 border-t border-gray-800">
                Weights: momentum 25% · risk quality 20% · {analystLabel.toLowerCase()} 20% · {upsideLabel.toLowerCase()} 15% · volume 15% · sentiment 5%
              </p>
              <p className="text-xs text-gray-700">
                <span className="text-gray-600">calc</span> = calculated from price history · not financial advice
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
