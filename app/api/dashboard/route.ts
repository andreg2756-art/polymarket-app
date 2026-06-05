import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const runs = await prisma.refreshRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  const latestRun = runs.find((r: { status: string }) => r.status === "completed");
  const prevRun = runs.filter((r: { status: string }) => r.status === "completed")[1];

  if (!latestRun) {
    return NextResponse.json({ noData: true, runs });
  }

  const [topMarkets, traders, totalMarkets] = await Promise.all([
    prisma.marketPositionGroup.findMany({
      where: { refreshRunId: latestRun.id },
      orderBy: { holderCount: "desc" },
      take: 10,
    }),
    prisma.trader.findMany({ orderBy: { rank: "asc" }, take: 10 }),
    prisma.marketPositionGroup.count({ where: { refreshRunId: latestRun.id } }),
  ]);

  const mostCrowded = topMarkets[0] ?? null;
  const highestConsensus = [...topMarkets].sort((a, b) => b.consensusScore - a.consensusScore)[0] ?? null;
  const totalCapital = topMarkets.reduce((s, m) => s + m.totalCurrentValue, 0);

  let changes: unknown[] = [];
  if (prevRun) {
    const [prevGroups, nextGroups] = await Promise.all([
      prisma.marketPositionGroup.findMany({ where: { refreshRunId: prevRun.id } }),
      prisma.marketPositionGroup.findMany({ where: { refreshRunId: latestRun.id } }),
    ]);
    const prevMap = new Map(prevGroups.map((g) => [`${g.conditionId}||${g.outcome}`, g]));
    changes = nextGroups.map((g) => {
      const p = prevMap.get(`${g.conditionId}||${g.outcome}`);
      return {
        ...g,
        holderCountDelta: g.holderCount - (p?.holderCount ?? 0),
        currentValueDelta: g.totalCurrentValue - (p?.totalCurrentValue ?? 0),
      };
    }).filter((c) => c.holderCountDelta !== 0 || c.currentValueDelta !== 0)
      .sort((a, b) => Math.abs(b.currentValueDelta) - Math.abs(a.currentValueDelta))
      .slice(0, 20);
  }

  return NextResponse.json({
    latestRun,
    runs: runs.slice(0, 5),
    topMarkets,
    traders,
    totalMarkets,
    mostCrowded,
    highestConsensus,
    totalCapital,
    changes,
  });
}
