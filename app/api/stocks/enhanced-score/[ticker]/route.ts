import { NextResponse } from "next/server";
import { computeEnhancedScore } from "@/lib/stocks/scoring";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    // Pull existing momentum values from DB — do not re-fetch from Yahoo
    const stock = await prisma.stock.findUnique({
      where: { ticker },
      select: { change1M: true, change3M: true, relativeVolume: true },
    });

    const change1M = stock?.change1M ?? 0;
    const change3M = stock?.change3M ?? 0;
    const relativeVolume = stock?.relativeVolume ?? 1;

    const score = await computeEnhancedScore(ticker, change1M, change3M, relativeVolume);
    return NextResponse.json(score);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
