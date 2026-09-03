// Historical-validation persistence — spec Part 23. Recording only: this
// makes future backtesting POSSIBLE (join an old observation against a
// later price to compute returns), it doesn't compute anything itself.
// "Do not attempt to optimize the model yet" — spec's own words.

import { prisma } from "@/lib/prisma";
import type { StockCatalystSignal } from "./event-types";

const MIN_INTERVAL_MINUTES = 50; // same daily-cron dedup pattern as probability-history.ts's recordSnapshotIfDue

export async function recordObservationIfDue(
  signal: StockCatalystSignal,
  stockPrice: number | null,
  now: Date = new Date()
): Promise<{ recorded: boolean; reason?: string }> {
  const latest = await prisma.catalystObservation.findFirst({
    where: { ticker: signal.ticker, eventSlug: signal.eventSlug },
    orderBy: { observedAt: "desc" },
  });

  if (latest) {
    const ageMinutes = (now.getTime() - latest.observedAt.getTime()) / 60_000;
    if (ageMinutes < MIN_INTERVAL_MINUTES) {
      return { recorded: false, reason: `last observation ${ageMinutes.toFixed(0)}min ago, under the ${MIN_INTERVAL_MINUTES}min minimum interval` };
    }
  }

  await prisma.catalystObservation.create({
    data: {
      ticker: signal.ticker,
      eventSlug: signal.eventSlug,
      formulaVersion: signal.formulaVersion,
      currentOutlookScore: signal.currentOutlookScore,
      catalystChangeScore: signal.catalystChangeScore,
      confidence: signal.confidence,
      stockPrice,
      sectorBenchmark: null, // no reliable ETF mapping for every ticker here yet — never guess one
      marketBenchmark: "SPY",
      observedAt: now,
    },
  });
  return { recorded: true };
}
