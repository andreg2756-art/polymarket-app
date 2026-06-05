import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const runs = await prisma.refreshRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(runs);
}
