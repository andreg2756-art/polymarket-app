import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const latestRun = await prisma.refreshRun.findFirst({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
  });

  const traders = await prisma.trader.findMany({ orderBy: { rank: "asc" } });

  if (!latestRun) return NextResponse.json(traders.map((t) => ({ ...t, positionCount: 0, totalCurrentValue: 0, totalSize: 0, bestPosition: null, worstPosition: null })));

  const positions = await prisma.positionSnapshot.findMany({
    where: { refreshRunId: latestRun.id },
  });

  const byWallet = new Map<string, typeof positions>();
  for (const p of positions) {
    if (!byWallet.has(p.proxyWallet)) byWallet.set(p.proxyWallet, []);
    byWallet.get(p.proxyWallet)!.push(p);
  }

  return NextResponse.json(
    traders.map((t) => {
      const ps = byWallet.get(t.proxyWallet) ?? [];
      const sorted = [...ps].sort((a, b) => b.cashPnl - a.cashPnl);
      const totalCurrentValue = ps.reduce((s, p) => s + p.currentValue, 0);
      const totalCashPnl = ps.reduce((s, p) => s + p.cashPnl, 0);
      const costBasis = totalCurrentValue - totalCashPnl;
      const roiPct = costBasis > 0 ? Math.round((totalCashPnl / costBasis) * 1000) / 10 : 0;
      const winRate = ps.length > 0 ? Math.round((ps.filter((p) => p.cashPnl > 0).length / ps.length) * 100) : 0;
      return {
        ...t,
        positionCount: ps.length,
        totalCurrentValue,
        totalSize: ps.reduce((s, p) => s + p.size, 0),
        bestPosition: sorted[0] ?? null,
        worstPosition: sorted[sorted.length - 1] ?? null,
        roiPct,
        winRate,
      };
    })
  );
}
