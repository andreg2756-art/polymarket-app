import { NextResponse } from "next/server";
import { getShortInterestData } from "@/lib/stocks/shortInterest";
import { getFmpFloatData } from "@/lib/stocks/technicals";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    // Fetch float first so we can derive shortInterestPctFloat if API doesn't return it
    const floatData = await getFmpFloatData(ticker).catch(() => ({
      floatShares: null, freeFloatPct: null, outstandingShares: null,
    }));

    const si = await getShortInterestData(ticker, floatData.floatShares);
    return NextResponse.json(si);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
