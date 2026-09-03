import { NextResponse } from "next/server";
import { CATALYST_THEMES } from "@/lib/catalysts/themes";
import { fetchMarketPrices } from "@/lib/catalysts/polymarket";
import { computeTheme, toGroupableSignal } from "@/lib/catalysts/compute";
import { calculatePredictionMarketOutlook, type PredictionMarketOutlook } from "@/lib/catalysts/aggregation";
import type { StockCatalystSignal } from "@/lib/catalysts/event-types";

export async function GET() {
  const allConditionIds = Array.from(
    new Set(
      CATALYST_THEMES.flatMap((t) => [
        ...t.event.outcomes.map((o) => o.conditionId),
        ...(t.event.contextMarkets ?? []).map((m) => m.conditionId),
      ])
    )
  );
  const prices = await fetchMarketPrices(allConditionIds);

  const themes = await Promise.all(
    CATALYST_THEMES.map(async (theme) => {
      const computed = await computeTheme(theme, prices);
      return {
        slug: theme.slug,
        title: theme.title,
        description: theme.description,
        alternativeScenarioNote: theme.alternativeScenarioNote,
        event: computed.event,
        signals: computed.signals,
      };
    })
  );

  const stockOutlooks = computeStockOutlooks(themes.flatMap((t) => t.signals));

  return NextResponse.json({ themes, stockOutlooks, formulaVersion: "CATALYST_V1" });
}

/**
 * Cross-theme, cross-event stock-level aggregate (spec Parts 15/17/19).
 * Groups every signal for a ticker by factor group and lets
 * aggregation.ts's confidence-weighted mean + concentration cap prevent
 * two correlated events (e.g. two different Fed-related markets both
 * tagged MONETARY_POLICY) from double-counting the same thesis. With
 * today's three themes no ticker actually appears in more than one, so
 * this currently passes each signal through as its own single-signal
 * "aggregate" — the dedup only activates once a future theme overlaps an
 * existing one for a shared ticker, which is exactly the point: the
 * infrastructure needs to exist before that happens, not be built after
 * the fact once a real double-count is already live.
 */
function computeStockOutlooks(allSignals: StockCatalystSignal[]): Record<string, PredictionMarketOutlook> {
  const byTicker = new Map<string, StockCatalystSignal[]>();
  for (const s of allSignals) {
    if (!byTicker.has(s.ticker)) byTicker.set(s.ticker, []);
    byTicker.get(s.ticker)!.push(s);
  }

  const result: Record<string, PredictionMarketOutlook> = {};
  for (const [ticker, signals] of byTicker) {
    result[ticker] = calculatePredictionMarketOutlook(signals.map(toGroupableSignal));
  }
  return result;
}
