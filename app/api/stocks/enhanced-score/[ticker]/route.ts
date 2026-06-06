import { NextResponse } from "next/server";
import { computeEnhancedScore } from "@/lib/stocks/scoring";
import { getShortInterest } from "@/lib/stocks/shortInterest";
import { computeDataConfidence } from "@/lib/stocks/dataConfidence";
import { prisma } from "@/lib/prisma";
import { getExtraStockMetrics, fetchYahooDailyCandles } from "@/lib/stocks/technicals";
import { getSupplementalStockData, getRevenueGrowthRaw } from "@/lib/stockSupplementalData";

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

    // Fetch raw revenue growth numbers for blended modifier (cached, fast on repeat calls)
    const revRaw = await getRevenueGrowthRaw(ticker).catch(() => ({ ttm: null, qtrYoY: null }));

    // All fetches in parallel — each has its own null fallback
    const [enhancedScore, shortInterest, suppData] = await Promise.all([
      computeEnhancedScore(ticker, change1M, change3M, relativeVolume, revenueGrowth, floatTurnover, revRaw.ttm, revRaw.qtrYoY),
      getShortInterest(ticker).catch(() => null),
      getSupplementalStockData(ticker).catch(() => null),
    ]);

    const suppAvailable = {
      cash:                   suppData?.cash?.value !== null && suppData?.cash?.value !== undefined,
      totalDebt:              suppData?.totalDebt?.value !== null && suppData?.totalDebt?.value !== undefined,
      insiderOwnership:       suppData?.insiderOwnership?.value !== null && suppData?.insiderOwnership?.value !== undefined,
      institutionalOwnership: suppData?.institutionalOwnership?.value !== null && suppData?.institutionalOwnership?.value !== undefined,
    };

    const confidence = computeDataConfidence(enhancedScore, shortInterest, marketCap, suppAvailable);

    // Compute revenue trend for panel display
    const ttm    = revRaw.ttm;
    const qtr    = revRaw.qtrYoY;
    const revTrend: {
      ttm: number | null; qtr: number | null;
      status: "Positive" | "Negative" | "Mixed" | null;
      modifier: number;
    } = {
      ttm,
      qtr,
      status: ttm !== null && qtr !== null
        ? (ttm > 0 && qtr > 0 ? "Positive" : ttm < 0 && qtr < 0 ? "Negative" : "Mixed")
        : ttm !== null ? (ttm > 0 ? "Positive" : "Negative")
        : null,
      modifier: enhancedScore.revenueGrowthScore?.modifier ?? 0,
    };

    return NextResponse.json({
      ...enhancedScore,
      shortInterest,
      dataConfidence: confidence,
      revTrend,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
