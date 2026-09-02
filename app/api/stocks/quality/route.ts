import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreviousRanks, rankDelta } from "@/lib/stocks/rankChange";

export async function GET() {
  // Order by score, not the stored qualityRank column: rank is assigned as a
  // fresh sequential index over only each day's screener candidate set, so a
  // ticker that drops out of a smaller day's pool keeps a stale rank number
  // that can collide with a freshly assigned one from today — producing
  // duplicate ranks and a display order that no longer matches score. Scores
  // themselves aren't touched by that bug, so deriving rank from score order
  // at read time sidesteps it without needing to rework the ingestion pipeline.
  const [stocks, previousRanks] = await Promise.all([
    prisma.stock.findMany({
      where: { qualityScore: { not: null } },
      orderBy: { qualityScore: "desc" },
      take: 50,
    }),
    getPreviousRanks("quality"),
  ]);
  const ranked = stocks.map((s, i) => ({
    ...s,
    qualityRank: i + 1,
    rankChange: rankDelta(previousRanks, s.ticker, i + 1),
  }));
  return NextResponse.json(ranked);
}
