import { prisma } from "@/lib/prisma";

export type RankChangeLens = "speculative" | "quality" | "turnaround";

// Mirrors lib/backtest.ts's LENS_SCORE_FIELD / day-grouping — a ticker can be
// snapshotted once per lens per day, tagged by `lens` rather than inferred
// from which score field is set (a stock can be both a Quality and a
// Turnaround pick on the same day).
const LENS_SCORE_FIELD: Record<RankChangeLens, "bullishScore" | "qualityScore" | "turnaroundScore"> = {
  speculative: "bullishScore",
  quality: "qualityScore",
  turnaround: "turnaroundScore",
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Rank every ticker as of the most recent snapshot day strictly before
 * today's, by that lens's score — a "yesterday's leaderboard" a current
 * rank can be diffed against to show day-over-day movement. Returns an
 * empty map when there isn't at least one full prior day of history yet.
 */
export async function getPreviousRanks(lens: RankChangeLens): Promise<Map<string, number>> {
  const scoreField = LENS_SCORE_FIELD[lens];
  const snapshots = await prisma.stockSnapshot.findMany({
    where: { lens },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    const day = dateKey(s.createdAt);
    if (!byDay.has(day)) byDay.set(day, new Map());
    // Last snapshot of the day wins, same as lib/backtest.ts.
    byDay.get(day)!.set(s.ticker, s[scoreField] ?? 0);
  }

  const sortedDays = Array.from(byDay.keys()).sort();
  if (sortedDays.length < 2) return new Map();

  const previousDay = byDay.get(sortedDays[sortedDays.length - 2])!;
  const ranked = Array.from(previousDay.entries()).sort((a, b) => b[1] - a[1]);

  const rankMap = new Map<string, number>();
  ranked.forEach(([ticker], i) => rankMap.set(ticker, i + 1));
  return rankMap;
}

/** previousRank - currentRank: positive means the ticker moved up (a better, lower-numbered rank). Null when there's no prior data (new entrant, or not enough history yet). */
export function rankDelta(previousRanks: Map<string, number>, ticker: string, currentRank: number): number | null {
  const prev = previousRanks.get(ticker);
  return prev === undefined ? null : prev - currentRank;
}
