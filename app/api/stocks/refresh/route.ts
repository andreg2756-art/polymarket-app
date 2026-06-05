import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile, getIncomeStatements, getQuote, getPriceHistory } from "@/lib/fmp";
import { SMALL_CAP_UNIVERSE } from "@/lib/small-cap-universe";

export const maxDuration = 60;

function pctChange(prices: { close: number }[], days: number): number {
  if (prices.length < 2) return 0;
  const recent = prices[0]?.close ?? 0;
  const old = prices[Math.min(days - 1, prices.length - 1)]?.close ?? recent;
  if (!old) return 0;
  return ((recent - old) / old) * 100;
}

function computeScore(params: {
  revenueGrowth: number;
  epsGrowth: number;
  change1M: number;
  change3M: number;
  relativeVolume: number;
}): number {
  const { revenueGrowth, epsGrowth, change1M, change3M, relativeVolume } = params;

  const revScore = revenueGrowth > 30 ? 25 : revenueGrowth > 15 ? 18 : revenueGrowth > 5 ? 12 : revenueGrowth > 0 ? 6 : 0;
  const epsScore = epsGrowth > 50 ? 20 : epsGrowth > 20 ? 14 : epsGrowth > 0 ? 8 : 0;
  const mom1M = change1M > 20 ? 20 : change1M > 10 ? 14 : change1M > 5 ? 8 : change1M > 0 ? 4 : 0;
  const mom3M = change3M > 30 ? 20 : change3M > 15 ? 14 : change3M > 5 ? 8 : change3M > 0 ? 4 : 0;
  const volScore = relativeVolume > 2 ? 15 : relativeVolume > 1.5 ? 10 : relativeVolume > 1 ? 5 : 0;

  return Math.min(100, Math.round(revScore + epsScore + mom1M + mom3M + volScore));
}

export async function POST() {
  try {
    const to = new Date().toISOString().split("T")[0];
    const from90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

    const results = await Promise.allSettled(
      SMALL_CAP_UNIVERSE.map(async (ticker) => {
        const [profile, quote, income, prices] = await Promise.allSettled([
          getProfile(ticker),
          getQuote(ticker),
          getIncomeStatements(ticker),
          getPriceHistory(ticker, from90, to),
        ]);

        const p = profile.status === "fulfilled" ? profile.value : null;
        const q = quote.status === "fulfilled" ? quote.value : null;
        const inc = income.status === "fulfilled" ? income.value : [];
        const px = prices.status === "fulfilled" ? prices.value : [];

        if (!p || !p.marketCap || p.marketCap < 50_000_000 || p.marketCap > 2_000_000_000) return null;

        const revenueGrowth = inc.length >= 2 && inc[1].revenue
          ? ((inc[0].revenue - inc[1].revenue) / Math.abs(inc[1].revenue)) * 100 : 0;
        const epsGrowth = inc.length >= 2 && inc[1].eps !== 0
          ? ((inc[0].eps - inc[1].eps) / Math.abs(inc[1].eps)) * 100 : 0;

        const change1M = pctChange(px, 21);
        const change3M = pctChange(px, 63);
        const relativeVolume = q ? (q.volume / Math.max(q.avgVolume ?? 1, 1)) : 1;

        const bullishScore = computeScore({ revenueGrowth, epsGrowth, change1M, change3M, relativeVolume });

        return {
          ticker,
          name: p.companyName ?? ticker,
          exchange: p.exchange ?? "",
          sector: p.sector ?? "",
          industry: p.industry ?? "",
          description: p.description?.slice(0, 1000) ?? "",
          marketCap: p.marketCap ?? 0,
          price: q?.price ?? p.price,
          change1M: Math.round(change1M * 10) / 10,
          change3M: Math.round(change3M * 10) / 10,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10,
          epsGrowth: Math.round(epsGrowth * 10) / 10,
          analystRating: "N/A",
          analystCount: 0,
          bullishScore,
          lastEarningsDate: inc[0]?.date ?? null,
          float: null,
          shortInterest: null,
          institutionalOwn: null,
          insiderBuying: 0,
          relativeVolume: Math.round(relativeVolume * 10) / 10,
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
      .slice(0, 50)
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

type StockRow = {
  ticker: string; name: string; exchange: string; sector: string; industry: string;
  description: string; marketCap: number; price: number; change1M: number; change3M: number;
  revenueGrowth: number; epsGrowth: number; analystRating: string; analystCount: number;
  bullishScore: number; lastEarningsDate: string | null; float: null; shortInterest: null;
  institutionalOwn: null; insiderBuying: number; relativeVolume: number;
  earningsBeat: boolean; revenueBeat: boolean; guidanceUp: boolean; rank: number;
};
