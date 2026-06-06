"use client";
import { useState } from "react";
import type { EnhancedStockScore } from "@/lib/stocks/types";
import type { ShortInterestResult } from "@/lib/stocks/shortInterest";
import type { DataConfidenceResult } from "@/lib/stocks/dataConfidence";
import type { NewsSentimentDetail } from "@/lib/stocks/newsSentiment";

interface FullScore extends EnhancedStockScore {
  shortInterest: ShortInterestResult | null;
  dataConfidence: DataConfidenceResult | null;
  newsSentiment: EnhancedStockScore["newsSentiment"] & { detail?: NewsSentimentDetail | null };
}

interface Props { ticker: string }

const RATING_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Watch":      { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-700" },
  "Watch":             { bg: "bg-blue-900/40",    text: "text-blue-300",    border: "border-blue-700"    },
  "Neutral":           { bg: "bg-gray-800/60",    text: "text-gray-300",    border: "border-gray-700"    },
  "Avoid":             { bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-800"     },
  "Insufficient Data": { bg: "bg-gray-900",       text: "text-gray-500",    border: "border-gray-800"    },
};

const SHORT_RISK_COLORS: Record<string, string> = {
  high:     "text-red-400",
  moderate: "text-yellow-400",
  low:      "text-emerald-400",
  unknown:  "text-gray-500",
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
  label: string; sublabel?: string; value: string | number | null;
  score: number | null; color: string; reason?: string;
  tag?: React.ReactNode; weight?: string;
}) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="w-40 shrink-0">
          <span className="text-xs text-gray-400">{label}</span>
          {sublabel && <span className="text-xs text-gray-600 ml-1">({sublabel})</span>}
          {weight  && <span className="text-xs text-gray-700 ml-1">{weight}</span>}
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

function ModifierRow({ label, value, amount, reason }: { label: string; value: string | null; amount: number | null; reason?: string }) {
  const isPos = amount !== null && amount > 0;
  const isNeg = amount !== null && amount < 0;
  const display = amount === null ? "N/A" : amount === 0 ? "No change" : `${isPos ? "+" : ""}${amount} pts`;
  const color = isPos ? "text-emerald-400" : isNeg ? "text-red-400" : "text-gray-500";
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1 pt-2 border-t border-gray-800">{children}</p>;
}

export default function EnhancedScorePanel({ ticker }: Props) {
  const [data, setData] = useState<FullScore | null>(null);
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

  const ratingStyle = data ? (RATING_STYLES[data.finalRating] ?? RATING_STYLES.Neutral) : null;
  const upsideLabel = data?.hasRealAnalystTarget ? "Analyst Target Upside" : "Distance to 52W High";
  const upsideSub   = data?.hasRealAnalystTarget ? undefined : "52w range";

  const revMod     = data?.revenueGrowthScore?.modifier ?? null;
  const earnPenalty = data?.earningsRiskScore?.score != null && data.earningsRiskScore.daysUntilEarnings != null
    ? -(data.earningsRiskScore.score) : null;

  const newsDetail  = data?.newsSentiment?.detail ?? null;
  const si          = data?.shortInterest ?? null;
  const confidence  = data?.dataConfidence ?? null;

  return (
    <div>
      <button
        onClick={load}
        className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
      >
        {open ? "Hide Analysis ▴" : "Enhanced Score ▾"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-1 w-80 max-h-[80vh] overflow-y-auto">
          {loading && (
            <div className="space-y-2 animate-pulse py-2">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-5 bg-gray-800 rounded" />)}
            </div>
          )}

          {error && <p className="text-xs text-red-400 py-2">Error: {error}</p>}

          {data && !loading && (
            <>
              {/* Final Rating */}
              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 mb-2 ${ratingStyle?.bg} ${ratingStyle?.border}`}>
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

              {/* ── Weighted Score Components ── */}
              <SectionHeader>Score Components</SectionHeader>
              <MetricRow label="Momentum"       weight="20%" value={data.momentumScore.value}      score={data.momentumScore.score}    color="bg-emerald-500" reason={data.momentumScore.reason} />
              <MetricRow label="RS Rank"         weight="20%" value={data.rsRank.value}             score={data.rsRank.score}           color="bg-teal-500"    reason={data.rsRank.reason}   tag={<CalcTag />} />
              <MetricRow label="Risk Quality"    weight="20%" sublabel="β·vol·52w" value={data.riskQualityScore.value} score={data.riskQualityScore.score} color="bg-purple-500" reason={data.riskQualityScore.reason} tag={<CalcTag />} />
              <MetricRow label={upsideLabel}     weight="15%" sublabel={upsideSub} value={data.upsideScore.value}      score={data.upsideScore.score}      color="bg-orange-500" reason={data.upsideScore.reason} tag={!data.hasRealAnalystTarget ? <CalcTag /> : undefined} />
              <MetricRow label="Volume"          weight="15%" value={data.volumeScore.value}        score={data.volumeScore.score}      color="bg-cyan-500"    reason={data.volumeScore.reason} />
              <MetricRow label="News Sentiment"  weight="5%"  value={data.newsSentiment.score !== null ? `${data.newsSentiment.source === "polygon" ? "Polygon" : "Yahoo"} (${data.newsSentiment.score})` : null} score={data.newsSentiment.score} color="bg-yellow-500" reason={data.newsSentiment.reason} />

              {/* ── News Detail ── */}
              <SectionHeader>News</SectionHeader>
              {newsDetail ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Articles</span>
                    <span className="text-gray-300">{newsDetail.articleCount} scanned</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400">+{newsDetail.positiveCount} pos</span>
                    <span className="text-red-400">−{newsDetail.negativeCount} neg</span>
                    <span className="text-gray-500">{newsDetail.neutralCount} neutral</span>
                    <span className={`text-xs ml-auto px-1 rounded ${newsDetail.confidence === "High" ? "text-emerald-600" : newsDetail.confidence === "Medium" ? "text-yellow-700" : "text-gray-600"}`}>
                      {newsDetail.confidence} conf.
                    </span>
                  </div>
                  {newsDetail.topPositive && (
                    <a href={newsDetail.topPositive.url} target="_blank" rel="noopener noreferrer"
                      className="block border-l-2 border-emerald-800 pl-2 hover:border-emerald-500 transition-colors">
                      <p className="text-xs text-gray-300 leading-snug line-clamp-2">✓ "{newsDetail.topPositive.title}"</p>
                      <p className="text-xs text-gray-600">{newsDetail.topPositive.publisher}</p>
                    </a>
                  )}
                  {newsDetail.topNegative && (
                    <a href={newsDetail.topNegative.url} target="_blank" rel="noopener noreferrer"
                      className="block border-l-2 border-red-900 pl-2 hover:border-red-600 transition-colors">
                      <p className="text-xs text-gray-300 leading-snug line-clamp-2">✗ "{newsDetail.topNegative.title}"</p>
                      <p className="text-xs text-gray-600">{newsDetail.topNegative.publisher}</p>
                    </a>
                  )}
                  {!newsDetail.topPositive && !newsDetail.topNegative && (
                    <p className="text-xs text-gray-600">No strongly-signaled headlines found</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600">No news data available</p>
              )}

              {/* ── Short Interest ── */}
              <SectionHeader>Short Interest</SectionHeader>
              <div className="space-y-1">
                {si?.isStale ? (
                  <>
                    <p className="text-xs text-yellow-700">⚠ Stale data excluded from scoring</p>
                    <p className="text-xs text-gray-600">{si.reason}</p>
                    <p className="text-xs text-gray-700">Short interest data must be recent; stale data excluded.</p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Short %</span>
                      <span className={si?.available ? SHORT_RISK_COLORS[si.riskLevel] : "text-gray-600"}>
                        {si?.displayShortPct ?? "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Days to Cover</span>
                      <span className="text-gray-400">{si?.displayDaysToCover ?? "N/A"}</span>
                    </div>
                    {si?.planLimited && (
                      <p className="text-xs text-gray-600 italic">Unavailable on current Polygon plan</p>
                    )}
                    {si?.reason && !si.planLimited && si.available && (
                      <p className="text-xs text-gray-600">{si.reason}</p>
                    )}
                  </>
                )}
              </div>

              {/* ── Score Modifiers ── */}
              <SectionHeader>Score Modifiers</SectionHeader>
              <ModifierRow label="Revenue Growth" value={data.revenueGrowthScore?.value?.toString() ?? null} amount={revMod} reason={data.revenueGrowthScore?.reason} />
              <ModifierRow label="Earnings Risk"  value={data.earningsRiskScore?.value?.toString() ?? null}  amount={earnPenalty} reason={data.earningsRiskScore?.reason} />

              {/* ── Data Confidence ── */}
              <SectionHeader>Data Quality</SectionHeader>
              {confidence ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Confidence Score</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${confidence.color}`}>{confidence.score}%</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${confidence.label === "High" ? "bg-emerald-900/50 text-emerald-400" : confidence.label === "Medium" ? "bg-yellow-900/50 text-yellow-400" : "bg-red-900/50 text-red-400"}`}>
                        {confidence.label}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${confidence.label === "High" ? "bg-emerald-500" : confidence.label === "Medium" ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${confidence.score}%` }} />
                  </div>
                  <p className="text-xs text-gray-600">{confidence.availableCount}/{confidence.totalFactors} factors available</p>
                  {confidence.missingFactors.length > 0 && (
                    <p className="text-xs text-gray-700">Missing: {confidence.missingFactors.join(", ")}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600">Confidence data unavailable</p>
              )}

              {/* ── Footer ── */}
              <div className="border-t border-gray-800 pt-2 mt-2">
                <p className="text-xs text-gray-700 leading-relaxed">
                  Weights: momentum 20% · RS rank 20% · risk quality 20% · {upsideLabel.toLowerCase()} 15% · volume 15% · sentiment 5%
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  Risk Quality = beta · historical volatility · 52-week range position.
                  <br />
                  <span className="text-gray-600">calc</span> = derived from price history · not financial advice
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
