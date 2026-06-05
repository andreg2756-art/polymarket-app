import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/fmp";
import { getYahooChart } from "@/lib/yahoo-finance";
import { SMALL_CAP_UNIVERSE } from "@/lib/small-cap-universe";

export const maxDuration = 60;

function computeScore(change1M: number, change3M: number, relativeVolume: number): number {
  const mom1M = change1M > 30 ? 30 : change1M > 20 ? 24 : change1M > 10 ? 18 : change1M > 5 ? 12 : change1M > 0 ? 6 : change1M > -5 ? 2 : 0;
  const mom3M = change3M > 50 ? 35 : change3M > 30 ? 28 : change3M > 15 ? 20 : change3M > 5 ? 13 : change3M > 0 ? 7 : change3M > -10 ? 2 : 0;
  const volScore = relativeVolume > 3 ? 20 : relativeVolume > 2 ? 15 : relativeVolume > 1.5 ? 10 : relativeVolume > 1.2 ? 6 : relativeVolume > 1 ? 3 : 0;
  const trendBonus = change1M > 0 && change3M > 0 ? 15 : change1M > 0 ? 5 : 0;
  return Math.min(100, Math.round(mom1M + mom3M + volScore + trendBonus));
}

type StockRow = {
  ticker: string; name: string; exchange: string; sector: string; industry: string;
  description: string; marketCap: number; price: number; change1M: number; change3M: number;
  revenueGrowth: number; epsGrowth: number; analystRating: string; analystCount: number;
  bullishScore: number; lastEarningsDate: string | null; float: null; shortInterest: null;
  institutionalOwn: null; insiderBuying: number; relativeVolume: number;
  earningsBeat: boolean; revenueBeat: boolean; guidanceUp: boolean; rank: number;
};

export async function POST() {
  try {
    // Step 1: fetch all price data from Yahoo (no API key, no rate limits)
    const yahooResults = await Promise.allSettled(
      SMALL_CAP_UNIVERSE.map((ticker) => getYahooChart(ticker).then((d) => ({ ticker, data: d })))
    );

    const yahooMap = new Map<string, NonNullable<Awaited<ReturnType<typeof getYahooChart>>>>();
    for (const r of yahooResults) {
      if (r.status === "fulfilled" && r.value.data) {
        yahooMap.set(r.value.ticker, r.value.data);
      }
    }

    // Step 2: fetch FMP profiles only for tickers where Yahoo succeeded (saves API calls)
    const validTickers = Array.from(yahooMap.keys());
    const profileResults = await Promise.allSettled(
      validTickers.map((ticker) => getProfile(ticker).then((d) => ({ ticker, data: d })))
    );

    const profileMap = new Map<string, Awaited<ReturnType<typeof getProfile>>>();
    for (const r of profileResults) {
      if (r.status === "fulfilled" && r.value.data) {
        profileMap.set(r.value.ticker, r.value.data);
      }
    }

    // Step 3: combine and score
    const stocks: StockRow[] = [];
    for (const ticker of validTickers) {
      const y = yahooMap.get(ticker);
      if (!y) continue;

      const p = profileMap.get(ticker);
      const marketCap = p?.marketCap ?? y.marketCap ?? 0;

      const bullishScore = computeScore(y.change1M, y.change3M, y.relativeVolume);

      stocks.push({
        ticker,
        name: p?.companyName ?? y.name,
        exchange: p?.exchange ?? "",
        sector: p?.sector ?? "",
        industry: p?.industry ?? "",
        description: p?.description?.slice(0, 1000) ?? "",
        marketCap,
        price: y.price,
        change1M: y.change1M,
        change3M: y.change3M,
        revenueGrowth: 0,
        epsGrowth: 0,
        analystRating: "N/A",
        analystCount: 0,
        bullishScore,
        lastEarningsDate: null,
        float: null,
        shortInterest: null,
        institutionalOwn: null,
        insiderBuying: 0,
        relativeVolume: y.relativeVolume,
        earningsBeat: false,
        revenueBeat: false,
        guidanceUp: false,
        rank: 0,
      });
    }

    const ranked = stocks
      .sort((a, b) => b.bullishScore - a.bullishScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    for (const s of ranked) {
      await prisma.stock.upsert({
        where: { ticker: s.ticker },
        create: s,
        update: s,
      });
      await prisma.stockSnapshot.create({
        data: { ticker: s.ticker, bullishScore: s.bullishScore, price: s.price, marketCap: s.marketCap },
      });
    }

    return NextResponse.json({ success: true, count: ranked.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
