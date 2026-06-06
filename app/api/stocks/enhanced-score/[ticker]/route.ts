import { NextResponse } from "next/server";
import { computeEnhancedScore } from "@/lib/stocks/scoring";
import { getShortInterest } from "@/lib/stocks/shortInterest";
import { computeDataConfidence } from "@/lib/stocks/dataConfidence";
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
      select: { change1M: true, change3M: true, relativeVolume: true, revenueGrowth: true, marketCap: true, price: true },
    });

    const change1M       = stock?.change1M ?? 0;
    const change3M       = stock?.change3M ?? 0;
    const relativeVolume = stock?.relativeVolume ?? 1;
    const revenueGrowth  = stock?.revenueGrowth && stock.revenueGrowth !== 0 ? stock.revenueGrowth : null;
    const marketCap      = stock?.marketCap ?? null;
    const price          = stock?.price ?? 0;

    // Fetch float turnover for scoring modifier
    const candles = await fetchYahooDailyCandles(ticker).catch(() => []);
    const currentVolume = candles.length > 0 ? candles[candles.length - 1].volume : 0;
    const techMetrics = await getExtraStockMetrics(ticker, price, currentVolume).catch(() => null);
    const floatTurnover = techMetrics?.floatTurnover ?? null;

    // All fetches in parallel — each has its own null fallback
    const [enhancedScore, shortInterest] = await Promise.all([
      computeEnhancedScore(ticker, change1M, change3M, relativeVolume, revenueGrowth, floatTurnover),
      getShortInterest(ticker).catch(() => null),
    ]);

    const confidence = computeDataConfidence(enhancedScore, shortInterest, marketCap);

    return NextResponse.json({
      ...enhancedScore,
      shortInterest,
      dataConfidence: confidence,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
