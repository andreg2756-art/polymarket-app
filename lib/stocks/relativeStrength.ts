// /lib/stocks/relativeStrength.ts
// Calculates Relative Strength Rank for a stock within the screened universe.
// Uses existing DB values — no additional API calls.

import type { ScoredMetric } from "./types";
import { prisma } from "@/lib/prisma";

interface StockMomentum {
  ticker: string;
  change1M: number;
  change3M: number;
  relativeVolume: number;
}

function blendedScore(s: StockMomentum): number {
  // Normalise each metric to 0–100 then blend
  // Done AFTER fetching the universe so we rank relatively
  return s.change1M * 0.45 + s.change3M * 0.45 + s.relativeVolume * 10 * 0.10;
}

function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length <= 1) return 50;
  const below = allValues.filter((v) => v < value).length;
  return Math.round((below / (allValues.length - 1)) * 100);
}

export async function getRelativeStrengthRank(
  ticker: string,
  change1M: number,
  change3M: number,
  relativeVolume: number
): Promise<ScoredMetric> {
  try {
    // Pull the full screened universe from DB
    const universe = await prisma.stock.findMany({
      select: { ticker: true, change1M: true, change3M: true, relativeVolume: true },
      where: { price: { gt: 0 } },
    });

    if (universe.length < 3) {
      return {
        value: null,
        score: null,
        source: "calculated",
        reason: "Not enough stocks in universe to rank",
      };
    }

    const allScores = universe.map((s) => blendedScore(s));
    const thisScore = blendedScore({ ticker, change1M, change3M, relativeVolume });
    const rank = percentileRank(thisScore, allScores);

    return {
      value: `${rank}/100`,
      score: rank,
      source: "calculated",
      reason: rank >= 80
        ? `RS Rank ${rank}/100 — outperforming ${rank}% of screened stocks`
        : rank >= 50
        ? `RS Rank ${rank}/100 — above median in screened universe`
        : `RS Rank ${rank}/100 — underperforming most screened stocks`,
    };
  } catch {
    return {
      value: null,
      score: null,
      source: "unavailable",
      reason: "RS Rank calculation failed",
    };
  }
}
