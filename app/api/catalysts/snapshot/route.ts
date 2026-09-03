import { NextResponse } from "next/server";
import { CATALYST_THEMES } from "@/lib/catalysts/themes";
import { fetchMarketPrices } from "@/lib/catalysts/polymarket";
import { computeEventOutcomes, computeTheme } from "@/lib/catalysts/compute";
import { recordSnapshotIfDue } from "@/lib/catalysts/probability-history";
import { recordObservationIfDue } from "@/lib/catalysts/observations";
import { fetchYahooDailyCandles } from "@/lib/stocks/technicals";
import { captureServerException } from "@/lib/posthog-server";

// Vercel cron target — see vercel.json for the daily schedule (Hobby plan
// caps crons at once/day). This is the load-bearing job for the whole
// "what changed?" side of the catalyst engine (delta1d/7d/30d, momentum,
// Catalyst Change score): none of that can exist without snapshots
// accumulating independently of page views.
export async function POST() {
  const allConditionIds = Array.from(
    new Set(CATALYST_THEMES.flatMap((t) => t.event.outcomes.map((o) => o.conditionId)))
  );

  let prices;
  try {
    prices = await fetchMarketPrices(allConditionIds);
  } catch (err) {
    await captureServerException(err, { route: "/api/catalysts/snapshot", stage: "fetchMarketPrices" });
    return NextResponse.json({ success: false, error: "Failed to fetch live market prices" }, { status: 500 });
  }

  const results: { eventSlug: string; outcomeId: string; recorded: boolean; reason?: string; error?: string }[] = [];

  for (const theme of CATALYST_THEMES) {
    const outcomes = computeEventOutcomes(theme.event, prices);
    for (let i = 0; i < theme.event.outcomes.length; i++) {
      const outcomeDef = theme.event.outcomes[i];
      const computed = outcomes[i];
      const live = prices.get(outcomeDef.conditionId);

      // A market with zero probability AND no live data at all means the
      // fetch failed for this specific conditionId — skip rather than
      // record a fabricated 0% snapshot that would poison future deltas.
      if (!live) {
        results.push({ eventSlug: theme.event.slug, outcomeId: outcomeDef.id, recorded: false, error: "no live price available" });
        continue;
      }

      try {
        const result = await recordSnapshotIfDue({
          eventSlug: theme.event.slug,
          outcomeId: outcomeDef.id,
          conditionId: outcomeDef.conditionId,
          probability: computed.probabilityNormalized,
          volume: live.volume24hr,
          liquidity: live.liquidity,
        });
        results.push({ eventSlug: theme.event.slug, outcomeId: outcomeDef.id, ...result });
      } catch (err) {
        await captureServerException(err, { route: "/api/catalysts/snapshot", eventSlug: theme.event.slug, outcomeId: outcomeDef.id });
        results.push({ eventSlug: theme.event.slug, outcomeId: outcomeDef.id, recorded: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  const recordedCount = results.filter((r) => r.recorded).length;

  // Phase 12: historical-validation persistence (spec Part 23) — separate
  // from the probability-snapshot loop above since it needs the full
  // computed signal (currentOutlookScore, confidence, etc.), not just a
  // raw outcome probability. Failures here are logged but never fail the
  // whole cron run — probability snapshots (the load-bearing piece for
  // Catalyst Change scores) must not be blocked by an observation-recording
  // or stock-quote problem.
  const observationResults: { ticker: string; eventSlug: string; recorded: boolean; reason?: string; error?: string }[] = [];
  try {
    const now = new Date();
    const themeComputations = await Promise.all(CATALYST_THEMES.map((theme) => computeTheme(theme, prices, now)));
    const allSignals = themeComputations.flatMap((t) => t.signals);

    const uniqueTickers = Array.from(new Set(allSignals.map((s) => s.ticker)));
    const pricesByTicker = new Map<string, number | null>(
      await Promise.all(
        uniqueTickers.map(async (ticker) => {
          try {
            const candles = await fetchYahooDailyCandles(ticker);
            const last = candles.at(-1);
            return [ticker, last ? last.close : null] as const;
          } catch {
            return [ticker, null] as const;
          }
        })
      )
    );

    for (const signal of allSignals) {
      try {
        const result = await recordObservationIfDue(signal, pricesByTicker.get(signal.ticker) ?? null, now);
        observationResults.push({ ticker: signal.ticker, eventSlug: signal.eventSlug, ...result });
      } catch (err) {
        await captureServerException(err, { route: "/api/catalysts/snapshot", stage: "recordObservation", ticker: signal.ticker, eventSlug: signal.eventSlug });
        observationResults.push({ ticker: signal.ticker, eventSlug: signal.eventSlug, recorded: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    await captureServerException(err, { route: "/api/catalysts/snapshot", stage: "recordObservations" });
  }
  const observationsRecorded = observationResults.filter((r) => r.recorded).length;

  return NextResponse.json({
    success: true,
    recordedCount,
    totalOutcomes: results.length,
    results,
    observationsRecorded,
    totalSignals: observationResults.length,
    observationResults,
  });
}

export const GET = POST;
