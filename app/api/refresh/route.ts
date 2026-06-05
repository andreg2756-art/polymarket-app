import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLeaderboard, fetchPositions } from "@/lib/polymarket";
import { groupPositions } from "@/lib/analytics";

export async function POST() {
  const run = await prisma.refreshRun.create({ data: { status: "running" } });

  try {
    const traders = await fetchLeaderboard();

    await prisma.trader.deleteMany();
    await prisma.trader.createMany({
      data: traders.map((t) => ({
        proxyWallet: t.proxyWallet,
        username: t.username,
        monthlyPnl: t.monthlyPnl,
        monthlyVolume: t.monthlyVolume,
        rank: t.rank,
      })),
      skipDuplicates: true,
    });

    const results = await Promise.allSettled(
      traders.map((t) => fetchPositions(t.proxyWallet, t.username))
    );

    let failedUsers = 0;
    const allPositions: Awaited<ReturnType<typeof fetchPositions>> = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        allPositions.push(...r.value);
      } else {
        failedUsers++;
        console.error(`Failed positions for ${traders[i].proxyWallet}:`, r.reason);
      }
    }

    if (allPositions.length > 0) {
      await prisma.positionSnapshot.createMany({
        data: allPositions.map((p) => ({ ...p, refreshRunId: run.id })),
      });
    }

    const groups = groupPositions(allPositions);
    if (groups.length > 0) {
      await prisma.marketPositionGroup.createMany({
        data: groups.map((g) => ({
          refreshRunId: run.id,
          conditionId: g.conditionId,
          marketTitle: g.marketTitle,
          outcome: g.outcome,
          category: g.category,
          holderCount: g.holderCount,
          totalCurrentValue: g.totalCurrentValue,
          totalSize: g.totalSize,
          totalCashPnl: g.totalCashPnl,
          avgCashPnl: g.avgCashPnl,
          totalVolume: g.totalVolume,
          consensusScore: g.consensusScore,
        })),
      });
    }

    const updated = await prisma.refreshRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        topTraderCount: traders.length,
        totalPositions: allPositions.length,
        failedUsers,
      },
    });

    return NextResponse.json({ success: true, run: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.refreshRun.update({
      where: { id: run.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: msg },
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
