"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import type { MacroTheme, TrackedMarket } from "@/lib/catalysts/themes";

interface LiveMarket extends TrackedMarket {
  live: {
    conditionId: string;
    question: string;
    outcomes: string[];
    prices: number[];
    volume24hr: number;
    updatedAt: string | null;
    closed: boolean;
  } | null;
}

interface ThemeWithLive extends Omit<MacroTheme, "markets"> {
  markets: LiveMarket[];
  conditionProbability: number | null;
}

const DIRECTION_STYLES = {
  positive: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
  negative: "bg-red-900/50 text-red-300 border-red-800",
  mixed: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
};

const STRENGTH_LABEL = { high: "High", medium: "Medium", low: "Low" };

function DirectionBadge({ direction, condition }: { direction: "positive" | "negative" | "mixed"; condition: string }) {
  const label = direction === "positive" ? "Potential Positive" : direction === "negative" ? "Potential Negative" : "Mixed";
  return (
    <div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${DIRECTION_STYLES[direction]}`}>
        {label}
      </span>
      {/* direction is conditional, not a current-state prediction — always
          shown attached to what it's conditioned on, never bare, so it
          can't be read as "the market currently favors this." */}
      <p className="text-[11px] text-gray-500 mt-1 italic">{condition}</p>
    </div>
  );
}

function ConditionProbabilityBanner({ label, probability }: { label: string; probability: number | null }) {
  if (probability === null) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2.5 text-sm text-gray-500">
        Condition: <span className="text-gray-300">{label}</span> — current probability unavailable
      </div>
    );
  }
  const pct = probability * 100;
  // Purely descriptive thresholds for a quick visual read — not a judgment
  // about whether the outcome is "good," just how far from a coin flip it
  // currently sits.
  const tone = pct >= 60 ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
    : pct <= 15 ? "border-red-900/60 bg-red-950/20 text-red-200"
    : "border-gray-700 bg-gray-900/50 text-gray-300";
  return (
    <div className={`rounded-lg border px-4 py-2.5 text-sm ${tone}`}>
      Condition every exposure below is keyed to: <span className="font-semibold">{label}</span>
      {" — currently priced at "}
      <span className="font-bold">{pct.toFixed(1)}%</span>
      {pct <= 15 && " (the market currently thinks this is unlikely — treat the exposures below as an if-then map, not an active signal)"}
    </div>
  );
}

function MarketRow({ market }: { market: LiveMarket }) {
  if (!market.live || market.live.prices.length === 0) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
        <span className="text-sm text-gray-300">{market.label}</span>
        <span className="text-xs text-gray-600">Price unavailable</span>
      </div>
    );
  }
  const { outcomes, prices, closed } = market.live;
  return (
    <div className="py-2 border-b border-gray-800 last:border-0">
      <p className="text-sm text-gray-300 mb-1.5">
        {market.label}
        {closed && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700 align-middle">
            Resolved
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        {outcomes.map((outcome, i) => (
          <span key={outcome} className="text-xs bg-gray-800 px-2 py-1 rounded">
            <span className="text-gray-500">{outcome}: </span>
            <span className="text-white font-semibold">{(prices[i] * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ThemeCard({ theme }: { theme: ThemeWithLive }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-emerald-400">{theme.title}</h2>
        <p className="text-gray-500 text-sm mt-1">{theme.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tracked Markets</p>
        {theme.markets.map((m) => <MarketRow key={m.conditionId} market={m} />)}
      </div>

      <ConditionProbabilityBanner label={theme.conditionLabel} probability={theme.conditionProbability} />

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Potentially Affected Stocks — {theme.exposures.length}
        </p>
        <div className="rounded-lg border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-500 text-xs uppercase">
              <tr>
                {["Ticker", "Direction", "Exposure", "Confidence", "Why"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {theme.exposures.map((e) => (
                <tr key={e.ticker} className="hover:bg-gray-900/40 transition-colors align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link href={`/stocks/${e.ticker}`} className="text-emerald-400 font-bold hover:underline">{e.ticker}</Link>
                    <p className="text-xs text-gray-600">{e.name}</p>
                  </td>
                  <td className="px-3 py-2.5 min-w-[160px]"><DirectionBadge direction={e.direction} condition={e.condition} /></td>
                  <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{STRENGTH_LABEL[e.exposureStrength]}</td>
                  <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{STRENGTH_LABEL[e.confidence]}</td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs leading-relaxed min-w-[240px]">{e.explanation}</td>
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
  const [themes, setThemes] = useState<ThemeWithLive[]>([]);
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
          Prediction-market events mapped to stocks that could plausibly be affected by their outcome —
          a research starting point, not a prediction. Every relationship below is hand-curated with an
          explicit direction, exposure strength, and confidence level; none of this is inferred automatically.
        </p>
      </div>

      <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
        <p className="font-medium">Early / v1</p>
        <p className="text-xs opacity-80 mt-0.5">
          Shows live current probability only — no history or day-over-day change yet. Stock exposure lists are a
          curated starting point (up to 10 per theme) meant to be reviewed and refined, not a finished ranking.
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
