import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ conditionId: string }> }) {
  const { conditionId } = await params;

  const runs = await prisma.refreshRun.findMany({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  if (!runs.length) return NextResponse.json({ error: "No data" }, { status: 404 });

  const latestRun = runs[0];

  const [groups, positions, timeline] = await Promise.all([
    prisma.marketPositionGroup.findMany({
      where: { refreshRunId: latestRun.id, conditionId },
    }),
    prisma.positionSnapshot.findMany({
      where: { refreshRunId: latestRun.id, conditionId },
      orderBy: { currentValue: "desc" },
    }),
    prisma.marketPositionGroup.findMany({
      where: { conditionId, refreshRunId: { in: runs.map((r) => r.id) } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ groups, positions, timeline, runs });
}
