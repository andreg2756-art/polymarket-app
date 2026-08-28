import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stocks = await prisma.stock.findMany({
    where: { turnaroundRank: { not: null } },
    orderBy: { turnaroundRank: "asc" },
    take: 50,
  });
  return NextResponse.json(stocks);
}
