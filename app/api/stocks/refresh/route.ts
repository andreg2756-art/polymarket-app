import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile, getPriceHistory } from "@/lib/fmp";
import { SMALL_CAP_UNIVERSE } from "@/lib/small-cap-universe";

export const maxDuration = 60;

function pctChange(prices: { close: number }[], days: number): number {
  if (prices.length < days) return 0;
  const recent = prices[0]?.close ?? 0;
  const old = prices[Math.min(days - 1, prices.length - 1)]?.close ?? recent;
  if (!old) return 0;
  return ((recent - old) / old) * 100;
}

function avgVolume(prices: { volume: number }[], days: number): number {
  const slice = prices.slice(0, days);
  if (!slice.length) return 0;
  return slice.reduce((s, p) => s + p.volume, 0) / slice.length;
}

function computeScore(params: {
  revenueGrowth: number;
  change1M: number;
  change3M: number;
  relativeVolume: number;
  marketCap: number;
}): number {
  const { change1M, change3M, relativeVolume } = params;
  const mom1M = change1M > 25 ? 30 : change1M > 15 ? 22 : change1M > 8 ? 15 : change1M > 0 ? 8 : change1M > -5 ? 3 : 0;
  const mom3M = change3M > 40 ? 35 : change3M > 20 ? 25 : change3M > 10 ? 18 : change3M > 0 ? 10 : change3M > -10 ? 3 : 0;
  const volScore = relativeVolume > 3 ? 20 : relativeVolume > 2 ? 14 : relativeVolume > 1.5 ? 10 : relativeVolume > 1 ? 5 : 0;
  const trendBonus = change1M > 0 && change3M > 0 ? 10 : 0;
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
    const to = new Date().toISOString().split("T")[0];
    const from90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

    const results = await Promise.allSettled(
      SMALL_CAP_UNIVERSE.map(async (ticker): Promise<StockRow | null> => {
        const [profileRes, pricesRes] = await Promise.allSettled([
          getProfile(ticker),
          getPriceHistory(ticker, from90, to),
        ]);

        const p = profileRes.status === "fulfilled" ? profileRes.value : null;
        const prices = pricesRes.status === "fulfilled" ? pricesRes.value : [];

        if (!p) return null;

        const cap = p.marketCap ?? 0;
        const change1M = Math.round(pctChange(prices, 21) * 10) / 10;
        const change3M = Math.round(pctChange(prices, 63) * 10) / 10;

        const recentVol = prices[0]?.volume ?? 0;
        const avg20Vol = avgVolume(prices, 20);
        const relativeVolume = avg20Vol > 0 ? Math.round((recentVol / avg20Vol) * 10) / 10 : 1;

        const bullishScore = computeScore({ revenueGrowth: 0, change1M, change3M, relativeVolume, marketCap: cap });

        return {
          ticker,
          name: p.companyName ?? ticker,
          exchange: p.exchange ?? "",
          sector: p.sector ?? "",
          industry: p.industry ?? "",
          description: p.description?.slice(0, 1000) ?? "",
          marketCap: cap,
          price: p.price ?? 0,
          change1M,
          change3M,
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
          relativeVolume,
          earningsBeat: false,
          revenueBeat: false,
          guidanceUp: false,
          rank: 0,
        };
      })
    );

    const stocks = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<StockRow>).value)
      .sort((a, b) => b.bullishScore - a.bullishScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    for (const s of stocks) {
      await prisma.stock.upsert({
        where: { ticker: s.ticker },
        create: s,
        update: s,
      });
      await prisma.stockSnapshot.create({
        data: { ticker: s.ticker, bullishScore: s.bullishScore, price: s.price, marketCap: s.marketCap },
      });
    }

    return NextResponse.json({ success: true, count: stocks.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
