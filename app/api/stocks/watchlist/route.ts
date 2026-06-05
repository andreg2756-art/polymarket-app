import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.watchlistItem.findMany({
    include: { stock: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { ticker, listName = "default" } = await req.json();
  try {
    const item = await prisma.watchlistItem.create({ data: { ticker, listName } });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Already in watchlist" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { ticker, listName = "default" } = await req.json();
  await prisma.watchlistItem.deleteMany({ where: { ticker, listName } });
  return NextResponse.json({ success: true });
}
