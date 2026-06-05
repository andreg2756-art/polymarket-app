import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExtraStockMetrics, fetchYahooDailyCandles } from "@/lib/stocks/technicals";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const stock = await prisma.stock.findUnique({
      where: { ticker },
      select: { price: true },
    });

    const currentPrice = stock?.price ?? 0;

    // Get latest volume from the candles (most recent day)
    const candles = await fetchYahooDailyCandles(ticker);
    const currentVolume = candles.length > 0 ? candles[candles.length - 1].volume : 0;

    const metrics = await getExtraStockMetrics(ticker, currentPrice, currentVolume);
    return NextResponse.json(metrics);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
