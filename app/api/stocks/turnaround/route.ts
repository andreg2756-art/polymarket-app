import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Order by score, not the stored turnaroundRank column — see the identical
  // comment in app/api/stocks/quality/route.ts for why the stored rank can
  // have duplicates/stale values and score order doesn't.
  const stocks = await prisma.stock.findMany({
    where: { turnaroundScore: { not: null } },
    orderBy: { turnaroundScore: "desc" },
    take: 50,
  });
  const ranked = stocks.map((s, i) => ({ ...s, turnaroundRank: i + 1 }));
  return NextResponse.json(ranked);
}
