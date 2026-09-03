"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import type { Classification } from "@/lib/catalysts/event-types";
import { classifyScore } from "@/lib/catalysts/scoring";
import { tierLabel, EXPOSURE_TIERS, CONFIDENCE_TIERS } from "@/lib/catalysts/explanations";

interface ComputedOutcome {
  id: string;
  label: string;
  probabilityNormalized: number;
  probabilityDelta1d: number | null;
  probabilityDelta7d: number | null;
}

interface ComputedEvent {
  slug: string;
  title: string;
  resolutionDate: string;
  materiality: number;
  marketQuality: number;
  outcomes: ComputedOutcome[];
  contextMarkets: { conditionId: string; label: string; live: { prices: number[]; outcomes: string[] } | null }[];
  oldestSnapshotAgeMinutes: number | null;
}

interface StockCatalystSignal {
  ticker: string;
  currentExpectedImpact: number;
  previousExpectedImpact: number | null;
  expectedImpact7d: number | null;
  deltaExpectedImpact: number | null;
  deltaExpectedImpact7d: number | null;
  expectedImpactMomentum: number | null;
  eventMateriality: number;
  marketQuality: number;
  relationshipConfidence: number;
  timeWeight: number;
  currentOutlookRaw: number;
  catalystChangeRaw: number | null;
  currentOutlookScore: number;
  catalystChangeScore: number | null;
  confidence: number;
  classification: Classification;
  primaryExposureStrength: number | null;
  primaryDirection: -1 | 1 | null;
  primaryDirectionalConfidence: number | null;
  reasons: string[];
  risks: string[];
}

interface ThemeData {
  slug: string;
  title: string;
  description: string;
  alternativeScenarioNote: string;
  event: ComputedEvent;
  signals: StockCatalystSignal[];
}

const CLASSIFICATION_STYLES: Record<Classification, string> = {
  VERY_BULLISH: "bg-emerald-900 text-emerald-200 border-emerald-700",
  BULLISH: "bg-emerald-900/60 text-emerald-300 border-emerald-800",
  SLIGHTLY_BULLISH: "bg-emerald-950/50 text-emerald-400 border-emerald-900",
  NEUTRAL: "bg-gray-800 text-gray-400 border-gray-700",
  SLIGHTLY_BEARISH: "bg-red-950/50 text-red-400 border-red-900",
  BEARISH: "bg-red-900/60 text-red-300 border-red-800",
  VERY_BEARISH: "bg-red-900 text-red-200 border-red-700",
  LOW_CONFIDENCE: "bg-yellow-950/50 text-yellow-400 border-yellow-900",
  NO_SIGNAL: "bg-gray-900 text-gray-600 border-gray-800",
};

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  VERY_BULLISH: "Very Bullish", BULLISH: "Bullish", SLIGHTLY_BULLISH: "Slightly Bullish",
  NEUTRAL: "Neutral", SLIGHTLY_BEARISH: "Slightly Bearish", BEARISH: "Bearish", VERY_BEARISH: "Very Bearish",
  LOW_CONFIDENCE: "Low Confidence", NO_SIGNAL: "No Signal",
};

function ClassificationBadge({ classification }: { classification: Classification }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CLASSIFICATION_STYLES[classification]}`}>
      {CLASSIFICATION_LABEL[classification]}
    </span>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-600 text-xs">No history yet</span>;
  const color = score > 9 ? "text-emerald-400" : score < -9 ? "text-red-400" : "text-gray-400";
  return <span className={`font-bold ${color}`}>{score >= 0 ? "+" : ""}{score.toFixed(0)}</span>;
}

/** Change-score classification, phrased as a shift rather than an outlook ("Bullish Change" vs. "Bullish") so it can't be mistaken for the Current Outlook badge next to it. */
function ChangeLabel({ score }: { score: number | null }) {
  if (score === null) return null;
  const c = classifyScore(score);
  const label = c === "NEUTRAL" ? "Neutral" : `${CLASSIFICATION_LABEL[c]} Change`;
  return <span className="text-[10px] text-gray-500">{label}</span>;
}

/** Percentage-point probability delta — "pp" is deliberate, never "%", since this is a change in a probability, not a percentage change of it. */
function DeltaPP({ label, delta }: { label: string; delta: number | null }) {
  if (delta === null) return <span className="text-gray-700">{label} —</span>;
  const pp = delta * 100;
  const color = pp > 0.5 ? "text-emerald-400" : pp < -0.5 ? "text-red-400" : "text-gray-500";
  return (
    <span className={color}>
      {label} {pp >= 0 ? "+" : ""}{pp.toFixed(1)}pp
    </span>
  );
}

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}`;
}

function BreakdownLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono">{value}</span>
    </div>
  );
}

/** Spec Part 12's minimum UI requirement — Exposure/Direction/Directional Confidence as distinct labeled concepts, not buried in a reasons sentence. Absent (null) for direct, non-factor-mediated exposures like the OpenAI theme. */
function ExposureBadges({ s }: { s: StockCatalystSignal }) {
  if (s.primaryExposureStrength === null || s.primaryDirection === null || s.primaryDirectionalConfidence === null) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mb-2">
      <span className="text-gray-500">Exposure <span className="text-gray-200 font-semibold">{tierLabel(s.primaryExposureStrength, EXPOSURE_TIERS)}</span></span>
      <span className="text-gray-500">Expected Direction <span className="text-gray-200 font-semibold">{s.primaryDirection > 0 ? "POSITIVE" : "NEGATIVE"}</span></span>
      <span className="text-gray-500">Directional Confidence <span className="text-gray-200 font-semibold">{tierLabel(s.primaryDirectionalConfidence, CONFIDENCE_TIERS)}</span></span>
    </div>
  );
}

/** Full formula chain for both scores, per spec Part 10 — nothing here is hidden behind an unexplained number. Every value shown is already stored on the signal, never recomputed client-side. */
function ScoreBreakdown({ s }: { s: StockCatalystSignal }) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-800 text-xs">
      <ExposureBadges s={s} />
      <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <p className="text-gray-400 font-semibold mb-1">Current Outlook: {fmt(s.currentOutlookScore, 0)}</p>
        <BreakdownLine label="Expected Impact" value={fmt(s.currentExpectedImpact)} />
        <BreakdownLine label="Event Materiality" value={s.eventMateriality.toFixed(2)} />
        <BreakdownLine label="Market Quality" value={s.marketQuality.toFixed(2)} />
        <BreakdownLine label="Relationship Confidence" value={s.relationshipConfidence.toFixed(2)} />
        <BreakdownLine label="Time Weight" value={s.timeWeight.toFixed(2)} />
        <BreakdownLine label="Raw Score" value={fmt(s.currentOutlookRaw, 3)} />
        <BreakdownLine label="Normalized Score" value={fmt(s.currentOutlookScore, 0)} />
      </div>
      <div>
        <p className="text-gray-400 font-semibold mb-1">Recent Shift: {s.catalystChangeScore === null ? "No history yet" : fmt(s.catalystChangeScore, 0)}</p>
        <BreakdownLine label="Expected Impact Now" value={fmt(s.currentExpectedImpact)} />
        <BreakdownLine label="Expected Impact 1D" value={fmt(s.previousExpectedImpact)} />
        <BreakdownLine label="Expected Impact 7D" value={fmt(s.expectedImpact7d)} />
        <BreakdownLine label="1D Change" value={fmt(s.deltaExpectedImpact)} />
        <BreakdownLine label="7D Change" value={fmt(s.deltaExpectedImpact7d)} />
        <BreakdownLine label="Momentum" value={fmt(s.expectedImpactMomentum)} />
        <BreakdownLine label="Materiality" value={s.eventMateriality.toFixed(2)} />
        <BreakdownLine label="Market Quality" value={s.marketQuality.toFixed(2)} />
        <BreakdownLine label="Relationship Confidence" value={s.relationshipConfidence.toFixed(2)} />
        <BreakdownLine label="Time Weight" value={s.timeWeight.toFixed(2)} />
        <BreakdownLine label="Normalized Change Score" value={s.catalystChangeScore === null ? "—" : fmt(s.catalystChangeScore, 0)} />
      </div>
      </div>
    </div>
  );
}

function EventHeader({ event }: { event: ComputedEvent }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Event Outcomes (normalized probability)</p>
      <div className="flex flex-wrap gap-3 mb-2">
        {event.outcomes.map((o) => (
          <span key={o.id} className="text-xs bg-gray-800 px-2.5 py-1.5 rounded flex flex-col gap-0.5">
            <span>
              <span className="text-gray-500">{o.label}: </span>
              <span className="text-white font-semibold">{(o.probabilityNormalized * 100).toFixed(1)}%</span>
            </span>
            <span className="flex gap-2 text-[10px]">
              <DeltaPP label="1D" delta={o.probabilityDelta1d} />
              <DeltaPP label="7D" delta={o.probabilityDelta7d} />
            </span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>Materiality: <span className="text-gray-300">{(event.materiality * 100).toFixed(0)}%</span></span>
        <span>Market Quality: <span className="text-gray-300">{(event.marketQuality * 100).toFixed(0)}%</span></span>
        <span>Resolves: <span className="text-gray-300">{event.resolutionDate}</span></span>
      </div>
      {event.contextMarkets.length > 0 && (
        <div className="mt-2 space-y-1">
          {event.contextMarkets.map((m) => (
            <p key={m.conditionId} className="text-xs text-gray-600">
              {m.label}
              {m.live && m.live.prices.length > 0 && (
                <span className="ml-2">
                  {m.live.outcomes.map((o, i) => `${o}: ${(m.live!.prices[i] * 100).toFixed(1)}%`).join(" · ")}
                </span>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function BelowThresholdRow({ s }: { s: StockCatalystSignal }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-800/60 last:border-0">
      <div>
        <Link href={`/stocks/${s.ticker}`} className="text-gray-400 font-semibold hover:underline hover:text-emerald-400">{s.ticker}</Link>
        <p className="text-xs text-gray-600 mt-0.5">{s.reasons[0]}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-500">
          Expected impact <span className="text-gray-400">{s.currentExpectedImpact >= 0 ? "+" : ""}{s.currentExpectedImpact.toFixed(2)}</span>
          {" → outlook "}
          <span className="text-gray-400">{s.currentOutlookScore >= 0 ? "+" : ""}{s.currentOutlookScore.toFixed(1)}</span>
        </p>
        <p className="text-[10px] text-gray-600">below the ±10 actionable threshold</p>
      </div>
    </div>
  );
}

function SignalRow({ s }: { s: StockCatalystSignal }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="hover:bg-gray-900/40 transition-colors align-top">
        <td className="px-3 py-2.5 whitespace-nowrap">
          <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="block mt-1 text-[10px] text-gray-600 hover:text-gray-400"
          >
            {expanded ? "▾ Hide breakdown" : "▸ Score breakdown"}
          </button>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <ScoreCell score={s.currentOutlookScore} />
            <ClassificationBadge classification={s.classification} />
          </div>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <ScoreCell score={s.catalystChangeScore} />
            <ChangeLabel score={s.catalystChangeScore} />
          </div>
        </td>
        <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{s.confidence.toFixed(0)}/100</td>
        <td className="px-3 py-2.5 text-gray-400 text-xs leading-relaxed min-w-[280px]">
          <ul className="space-y-1">
            {s.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {s.risks.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-yellow-600/80">
              {s.risks.map((r, i) => <li key={i}>⚠ {r}</li>)}
            </ul>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="px-3 pb-3 bg-gray-900/20">
            <ScoreBreakdown s={s} />
          </td>
        </tr>
      )}
    </>
  );
}

function ThemeCard({ theme }: { theme: ThemeData }) {
  const visibleSignals = theme.signals.filter((s) => s.classification !== "NO_SIGNAL");
  const belowThreshold = theme.signals.filter((s) => s.classification === "NO_SIGNAL");

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-emerald-400">{theme.title}</h2>
        <p className="text-gray-500 text-sm mt-1">{theme.description}</p>
      </div>

      <EventHeader event={theme.event} />

      <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 px-4 py-2.5 text-sm text-blue-200">
        <p className="font-medium text-blue-300">What&apos;s actually more likely right now</p>
        <p className="text-xs opacity-90 mt-1 leading-relaxed">{theme.alternativeScenarioNote}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Stock Catalyst Signals — {visibleSignals.length}
        </p>
        {visibleSignals.length > 0 ? (
          <div className="rounded-lg border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-500 text-xs uppercase">
                <tr>
                  {["Ticker", "Outlook", "Change", "Confidence", "Why"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {visibleSignals.map((s) => <SignalRow key={s.ticker} s={s} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600 italic px-1">
            No stock in this theme currently clears the actionable-signal threshold — see below for what was computed anyway.
          </p>
        )}
      </div>

      {belowThreshold.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Below Threshold — {belowThreshold.length} (computed, not currently actionable)
          </p>
          <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 px-4 py-1">
            {belowThreshold.map((s) => <BelowThresholdRow key={s.ticker} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CatalystsPage() {
  const [themes, setThemes] = useState<ThemeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalysts")
      .then((r) => r.json())
      .then((d) => setThemes(d.themes ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-emerald-400">Catalysts</h1>
        <p className="text-gray-500 text-sm mt-1">
          Prediction-market events converted into stock catalyst signals via a deterministic expected-value
          model (CATALYST_V1) — not an LLM guessing bullish/bearish from a market title. Every score is
          reproducible from the stored inputs: event probability, outcome economic impact, sector/company
          exposure, market quality, and relationship confidence.
        </p>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-gray-300 flex items-start gap-2">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 mt-0.5 shrink-0">LIVE</span>
        <p className="text-xs opacity-90 leading-relaxed">
          {themes.some((t) => t.event.oldestSnapshotAgeMinutes !== null) ? (
            <>Outlook and Change scores are both computing from real, persisted probability history. A daily snapshot job keeps that history growing — Change scores strengthen as more days accumulate.</>
          ) : (
            <>Outlook scores are fully live. Change scores currently show &quot;No history yet&quot; — a daily snapshot job just started recording probability history; once at least one prior day&apos;s snapshot exists, Change scores populate automatically. That&apos;s expected latency, not a bug.</>
          )}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="space-y-6">
          {themes.map((t) => <ThemeCard key={t.slug} theme={t} />)}
        </div>
      )}
    </div>
  );
}
