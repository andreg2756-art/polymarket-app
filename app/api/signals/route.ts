import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectWhaleMoves, detectNewlyCrowded } from "@/lib/signals";

export async function GET() {
  const runs = await prisma.refreshRun.findMany({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
    take: 2,
  });

  const [latestRun, prevRun] = runs;
  if (!latestRun || !prevRun) {
    return NextResponse.json({
      noData: true,
      message: "Need at least two completed refresh runs to detect signals.",
    });
  }

  const [prevPositions, nextPositions, prevGroups, nextGroups] = await Promise.all([
    prisma.positionSnapshot.findMany({ where: { refreshRunId: prevRun.id } }),
    prisma.positionSnapshot.findMany({ where: { refreshRunId: latestRun.id } }),
    prisma.marketPositionGroup.findMany({ where: { refreshRunId: prevRun.id } }),
    prisma.marketPositionGroup.findMany({ where: { refreshRunId: latestRun.id } }),
  ]);

  const whaleMoves = detectWhaleMoves(prevPositions, nextPositions).slice(0, 50);
  const newlyCrowded = detectNewlyCrowded(prevGroups, nextGroups).slice(0, 50);

  return NextResponse.json({
    noData: false,
    latestRunAt: latestRun.startedAt,
    prevRunAt: prevRun.startedAt,
    whaleMoves,
    newlyCrowded,
  });
}
