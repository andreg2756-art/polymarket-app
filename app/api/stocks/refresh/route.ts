import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  screenSmallCaps, getQuote, getIncomeStatements,
  getInsiderTrades, getAnalystRatings, getNews, getEarnings,
} from "@/lib/fmp";
import { computeBullishScore } from "@/lib/bullish-score";
import type { FMPNews } from "@/lib/fmp";

export const maxDuration = 60;

type StockResult = {
  ticker: string; name: string; exchange: string; sector: string; industry: string;
  marketCap: number; price: number; bullishScore: number; earningsBeat: boolean;
  revenueBeat: boolean; guidanceUp: boolean; revenueGrowth: number; epsGrowth: number;
  relativeVolume: number; insiderBuying: number; analystRating: string; analystCount: number;
  change1M: number; change3M: number; lastEarningsDate: string | null;
  newsItems: FMPNews[];
};

export async function POST() {
  try {
    const screened = await screenSmallCaps();
    if (!screened?.length) return NextResponse.json({ error: "No screener results" }, { status: 500 });

    const candidates = screened
      .filter((s) => s.marketCap >= 50_000_000 && s.marketCap <= 2_000_000_000 && s.isActivelyTrading && !s.isEtf && !s.isFund)
      .slice(0, 80);

    const results = await Promise.allSettled(
      candidates.map(async (s): Promise<StockResult> => {
        const [quote, income, insiders, analyst, news, earnings] = await Promise.allSettled([
          getQuote(s.symbol),
          getIncomeStatements(s.symbol),
          getInsiderTrades(s.symbol),
          getAnalystRatings(s.symbol),
          getNews(s.symbol),
          getEarnings(s.symbol),
        ]);

        const score = computeBullishScore({
          quote: quote.status === "fulfilled" ? quote.value : null,
          income: income.status === "fulfilled" ? income.value : [],
          insiders: insiders.status === "fulfilled" ? insiders.value : [],
          analyst: analyst.status === "fulfilled" ? analyst.value : null,
          news: news.status === "fulfilled" ? news.value : [],
          earnings: earnings.status === "fulfilled" ? earnings.value : [],
        });

        const q = quote.status === "fulfilled" ? quote.value : null;
        const lastEarnings = earnings.status === "fulfilled" ? earnings.value[0] : null;

        return {
          ticker: s.symbol,
          name: s.companyName,
          exchange: s.exchangeShortName,
          sector: s.sector,
          industry: s.industry,
          marketCap: s.marketCap,
          price: q?.price ?? s.price,
          ...score,
          lastEarningsDate: lastEarnings?.date ?? null,
          newsItems: news.status === "fulfilled" ? news.value : [],
        };
      })
    );

    const stocks = results
      .filter((r): r is PromiseFulfilledResult<StockResult> => r.status === "fulfilled")
      .map((r) => r.value)
      .sort((a, b) => b.bullishScore - a.bullishScore)
      .slice(0, 50)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    for (const s of stocks) {
      const { newsItems, ...stockData } = s;
      await prisma.stock.upsert({
        where: { ticker: s.ticker },
        create: stockData,
        update: stockData,
      });

      await prisma.stockSnapshot.create({
        data: {
          ticker: s.ticker,
          bullishScore: s.bullishScore,
          price: s.price,
          marketCap: s.marketCap,
        },
      });

      if (newsItems.length) {
        await prisma.stockNews.deleteMany({ where: { ticker: s.ticker } });
        await prisma.stockNews.createMany({
          data: newsItems.map((n) => ({
            ticker: s.ticker,
            headline: n.title,
            publisher: n.site ?? "",
            publishedAt: n.publishedDate ? new Date(n.publishedDate) : null,
            url: n.url,
            summary: n.text?.slice(0, 500) ?? "",
            sentiment: n.sentimentScore ?? 0,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ success: true, count: stocks.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
