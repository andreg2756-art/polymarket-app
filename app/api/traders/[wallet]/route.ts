import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  const trader = await prisma.trader.findUnique({ where: { proxyWallet: wallet } });
  if (!trader) return NextResponse.json({ error: "Trader not found" }, { status: 404 });

  const latestRun = await prisma.refreshRun.findFirst({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
  });

  if (!latestRun) return NextResponse.json({ trader, positions: [], categoryBreakdown: [] });

  const positions = await prisma.positionSnapshot.findMany({
    where: { refreshRunId: latestRun.id, proxyWallet: wallet },
    orderBy: { currentValue: "desc" },
  });

  const catMap = new Map<string, number>();
  for (const p of positions) {
    const cat = p.category || "Other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + p.currentValue);
  }
  const categoryBreakdown = Array.from(catMap.entries()).map(([category, value]) => ({ category, value }));

  return NextResponse.json({ trader, positions, categoryBreakdown });
}
