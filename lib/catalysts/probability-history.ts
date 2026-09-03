// Persisted probability history — the prerequisite for every "what
// changed?" feature (delta1d/7d/30d, momentum, Catalyst Change score).
// Snapshots are recorded by a server-side cron job (see
// app/api/catalysts/snapshot/route.ts), independent of page views, per
// the spec's explicit requirement not to rely on browser sessions.

import { prisma } from "@/lib/prisma";

export interface HistoricalProbability {
  probability: number | null;
  capturedAt: Date | null;
  ageMinutes: number | null;
}

// How far from the exact target time (1d/7d/30d ago) a snapshot can be and
// still count as "close enough" — an hourly cron won't land on the exact
// minute, and gaps (a failed run, a deploy window) are expected. Wider
// tolerance for longer lookbacks since drift matters proportionally less.
const TOLERANCE_HOURS = { oneDay: 12, sevenDay: 36, thirtyDay: 72 };

async function getClosestSnapshot(
  eventSlug: string,
  outcomeId: string,
  targetTime: Date,
  toleranceHours: number
): Promise<HistoricalProbability> {
  const windowStart = new Date(targetTime.getTime() - toleranceHours * 3_600_000);
  const windowEnd = new Date(targetTime.getTime() + toleranceHours * 3_600_000);

  const candidates = await prisma.predictionMarketSnapshot.findMany({
    where: { eventSlug, outcomeId, capturedAt: { gte: windowStart, lte: windowEnd } },
  });
  if (candidates.length === 0) return { probability: null, capturedAt: null, ageMinutes: null };

  let closest = candidates[0];
  let closestDiffMs = Math.abs(closest.capturedAt.getTime() - targetTime.getTime());
  for (const c of candidates) {
    const diffMs = Math.abs(c.capturedAt.getTime() - targetTime.getTime());
    if (diffMs < closestDiffMs) {
      closest = c;
      closestDiffMs = diffMs;
    }
  }

  return {
    probability: closest.probability,
    capturedAt: closest.capturedAt,
    ageMinutes: Math.round(closestDiffMs / 60_000),
  };
}

/** Never returns a fabricated 0 — probability is null when no snapshot falls within tolerance. */
export async function getHistoricalProbability(args: {
  eventSlug: string;
  outcomeId: string;
  targetTime: Date;
  toleranceHours?: number;
}): Promise<HistoricalProbability> {
  return getClosestSnapshot(args.eventSlug, args.outcomeId, args.targetTime, args.toleranceHours ?? 24);
}

export interface ProbabilityHistoryLookup {
  oneDayAgo: HistoricalProbability;
  sevenDayAgo: HistoricalProbability;
  thirtyDayAgo: HistoricalProbability;
}

export async function getProbabilityHistory(
  eventSlug: string,
  outcomeId: string,
  now: Date = new Date()
): Promise<ProbabilityHistoryLookup> {
  const [oneDayAgo, sevenDayAgo, thirtyDayAgo] = await Promise.all([
    getHistoricalProbability({ eventSlug, outcomeId, targetTime: new Date(now.getTime() - 24 * 3_600_000), toleranceHours: TOLERANCE_HOURS.oneDay }),
    getHistoricalProbability({ eventSlug, outcomeId, targetTime: new Date(now.getTime() - 7 * 24 * 3_600_000), toleranceHours: TOLERANCE_HOURS.sevenDay }),
    getHistoricalProbability({ eventSlug, outcomeId, targetTime: new Date(now.getTime() - 30 * 24 * 3_600_000), toleranceHours: TOLERANCE_HOURS.thirtyDay }),
  ]);
  return { oneDayAgo, sevenDayAgo, thirtyDayAgo };
}

export interface SnapshotInput {
  eventSlug: string;
  outcomeId: string;
  conditionId: string;
  probability: number;
  volume?: number | null;
  liquidity?: number | null;
}

// Cron runs hourly; refuse to write a second row for the same outcome
// within this window so a manual re-trigger (or a retried cron
// invocation) doesn't create near-duplicate rows that would distort the
// "closest snapshot" lookup above.
const MIN_INTERVAL_MINUTES = 50;

export async function recordSnapshotIfDue(
  input: SnapshotInput,
  now: Date = new Date()
): Promise<{ recorded: boolean; reason?: string }> {
  const latest = await prisma.predictionMarketSnapshot.findFirst({
    where: { eventSlug: input.eventSlug, outcomeId: input.outcomeId },
    orderBy: { capturedAt: "desc" },
  });

  if (latest) {
    const ageMinutes = (now.getTime() - latest.capturedAt.getTime()) / 60_000;
    if (ageMinutes < MIN_INTERVAL_MINUTES) {
      return { recorded: false, reason: `last snapshot ${ageMinutes.toFixed(0)}min ago, under the ${MIN_INTERVAL_MINUTES}min minimum interval` };
    }
  }

  await prisma.predictionMarketSnapshot.create({
    data: {
      eventSlug: input.eventSlug,
      outcomeId: input.outcomeId,
      conditionId: input.conditionId,
      probability: input.probability,
      volume: input.volume ?? null,
      liquidity: input.liquidity ?? null,
      capturedAt: now,
    },
  });
  return { recorded: true };
}
