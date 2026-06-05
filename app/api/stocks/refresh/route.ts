import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getYahooChart, TICKER_SECTOR } from "@/lib/yahoo-finance";
import { SMALL_CAP_UNIVERSE, SHARES_OUTSTANDING, SECTOR_UNIVERSE } from "@/lib/small-cap-universe";

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
    // Fetch all Yahoo data in parallel — no API key needed
    const yahooResults = await Promise.allSettled(
      SMALL_CAP_UNIVERSE.map((ticker) =>
        getYahooChart(ticker).then((d) => ({ ticker, data: d }))
      )
    );

    const yahooMap = new Map<string, YahooChart>();
    for (const r of yahooResults) {
      if (r.status === "fulfilled" && r.value.data && r.value.data.price > 0) {
        yahooMap.set(r.value.ticker, r.value.data);
      }
    }

    // Build per-sector top 15 by score, then take top 50 overall
    const allScored: StockRow[] = [];

    for (const [sector, tickers] of Object.entries(SECTOR_UNIVERSE)) {
      const sectorStocks: StockRow[] = [];
      for (const ticker of tickers) {
        const y = yahooMap.get(ticker);
        if (!y) continue;
        const shares = SHARES_OUTSTANDING[ticker] ?? 0;
        const marketCap = shares > 0 ? Math.round(y.price * shares * 1_000_000) : 0;
        const bullishScore = computeScore(y.change1M, y.change3M, y.relativeVolume);
        sectorStocks.push({
          ticker, name: y.name, exchange: "", sector,
          industry: sector, description: "", marketCap,
          price: y.price, change1M: y.change1M, change3M: y.change3M,
          revenueGrowth: 0, epsGrowth: 0, analystRating: "N/A", analystCount: 0,
          bullishScore, lastEarningsDate: null, float: null, shortInterest: null,
          institutionalOwn: null, insiderBuying: 0, relativeVolume: y.relativeVolume,
          earningsBeat: false, revenueBeat: false, guidanceUp: false, rank: 0,
        });
      }
      // Top 15 per sector
      sectorStocks.sort((a, b) => b.bullishScore - a.bullishScore);
      allScored.push(...sectorStocks.slice(0, 15));
    }

    // Deduplicate (some tickers appear in multiple sectors)
    const seen = new Set<string>();
    const deduped = allScored.filter((s) => {
      if (seen.has(s.ticker)) return false;
      seen.add(s.ticker);
      return true;
    });

    // Top 50 overall get rank 1-50, rest get rank 51+
    deduped.sort((a, b) => b.bullishScore - a.bullishScore);
    const ranked = deduped.map((s, i) => ({ ...s, rank: i + 1 }));

    // Upsert all into DB
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

    // Remove stale tickers not in current universe
    await prisma.stock.deleteMany({
      where: { ticker: { notIn: SMALL_CAP_UNIVERSE } },
    });

    return NextResponse.json({ success: true, count: ranked.length, sectors: Object.keys(SECTOR_UNIVERSE).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

type YahooChart = NonNullable<Awaited<ReturnType<typeof getYahooChart>>>;
