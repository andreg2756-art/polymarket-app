import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPrevGroupMap, withGroupDelta } from "@/lib/analytics";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const minHolders = Number(searchParams.get("minHolders") ?? 0);
  const minValue = Number(searchParams.get("minValue") ?? 0);
  const gainingOnly = searchParams.get("gainingOnly") === "true";
  const sortBy = searchParams.get("sortBy") ?? "holderCount";

  const latestRun = await prisma.refreshRun.findFirst({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
  });

  if (!latestRun) return NextResponse.json([]);

  const prevRun = await prisma.refreshRun.findFirst({
    where: { status: "completed", id: { not: latestRun.id } },
    orderBy: { startedAt: "desc" },
  });

  const groups = await prisma.marketPositionGroup.findMany({
    where: {
      refreshRunId: latestRun.id,
      ...(search ? { marketTitle: { contains: search, mode: "insensitive" } } : {}),
      ...(category ? { category: { contains: category, mode: "insensitive" } } : {}),
      holderCount: { gte: minHolders },
      totalCurrentValue: { gte: minValue },
    },
  });

  let prevMap = new Map<string, { conditionId: string; outcome: string; holderCount: number; totalCurrentValue: number }>();
  if (prevRun) {
    const prev = await prisma.marketPositionGroup.findMany({ where: { refreshRunId: prevRun.id } });
    prevMap = buildPrevGroupMap(prev);
  }

  let enriched = groups.map((g) => ({
    ...withGroupDelta(g, prevMap),
    pctOfTop100: ((g.holderCount / 100) * 100).toFixed(1),
  }));

  if (gainingOnly) enriched = enriched.filter((g) => g.holderCountDelta > 0);

  const sortMap: Record<string, (a: typeof enriched[0], b: typeof enriched[0]) => number> = {
    holderCount: (a, b) => b.holderCount - a.holderCount,
    totalCurrentValue: (a, b) => b.totalCurrentValue - a.totalCurrentValue,
    totalSize: (a, b) => b.totalSize - a.totalSize,
    avgCashPnl: (a, b) => b.avgCashPnl - a.avgCashPnl,
    consensusScore: (a, b) => b.consensusScore - a.consensusScore,
    totalVolume: (a, b) => b.totalVolume - a.totalVolume,
  };

  enriched.sort(sortMap[sortBy] ?? sortMap.holderCount);

  return NextResponse.json(enriched);
}
