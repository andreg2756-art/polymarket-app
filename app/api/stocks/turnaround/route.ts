import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreviousRanks, rankDelta } from "@/lib/stocks/rankChange";

export async function GET() {
  // Order by score, not the stored turnaroundRank column — see the identical
  // comment in app/api/stocks/quality/route.ts for why the stored rank can
  // have duplicates/stale values and score order doesn't.
  const [stocks, previousRanks] = await Promise.all([
    prisma.stock.findMany({
      where: { turnaroundScore: { not: null } },
      orderBy: { turnaroundScore: "desc" },
      take: 50,
    }),
    getPreviousRanks("turnaround"),
  ]);
  const ranked = stocks.map((s, i) => ({
    ...s,
    turnaroundRank: i + 1,
    rankChange: rankDelta(previousRanks, s.ticker, i + 1),
  }));
  return NextResponse.json(ranked);
}
