"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import type { Classification } from "@/lib/catalysts/event-types";

interface ComputedOutcome {
  id: string;
  label: string;
  probabilityNormalized: number;
}

interface ComputedEvent {
  slug: string;
  title: string;
  resolutionDate: string;
  materiality: number;
  marketQuality: number;
  outcomes: ComputedOutcome[];
  contextMarkets: { conditionId: string; label: string; live: { prices: number[]; outcomes: string[] } | null }[];
}

interface StockCatalystSignal {
  ticker: string;
  currentExpectedImpact: number;
  currentOutlookScore: number;
  catalystChangeScore: number | null;
  confidence: number;
  classification: Classification;
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

function EventHeader({ event }: { event: ComputedEvent }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Event Outcomes (normalized probability)</p>
      <div className="flex flex-wrap gap-3 mb-2">
        {event.outcomes.map((o) => (
          <span key={o.id} className="text-xs bg-gray-800 px-2.5 py-1.5 rounded">
            <span className="text-gray-500">{o.label}: </span>
            <span className="text-white font-semibold">{(o.probabilityNormalized * 100).toFixed(1)}%</span>
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

function ThemeCard({ theme }: { theme: ThemeData }) {
  const visibleSignals = theme.signals.filter((s) => s.classification !== "NO_SIGNAL");
  const suppressedCount = theme.signals.length - visibleSignals.length;

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
          {suppressedCount > 0 && <span className="normal-case text-gray-600"> ({suppressedCount} suppressed as no meaningful signal)</span>}
        </p>
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
              {visibleSignals.map((s) => (
                <tr key={s.ticker} className="hover:bg-gray-900/40 transition-colors align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link href={`/stocks/${s.ticker}`} className="text-emerald-400 font-bold hover:underline">{s.ticker}</Link>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <ScoreCell score={s.currentOutlookScore} />
                      <ClassificationBadge classification={s.classification} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><ScoreCell score={s.catalystChangeScore} /></td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

      <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
        <p className="font-medium">Phase 1 of the engine</p>
        <p className="text-xs opacity-80 mt-0.5">
          Outlook scores are fully computed and live. Change scores show &quot;No history yet&quot; — probability
          snapshots aren&apos;t persisted yet (that&apos;s the next phase), so day-over-day deltas would otherwise
          have to be fabricated as zero, which the model explicitly refuses to do.
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
