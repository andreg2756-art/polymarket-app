import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getYahooChart, TICKER_SECTOR } from "@/lib/yahoo-finance";
import { SMALL_CAP_UNIVERSE, SHARES_OUTSTANDING, SECTOR_UNIVERSE } from "@/lib/small-cap-universe";
import { getRevenueGrowthScore } from "@/lib/stocks/revenueGrowth";
import { sendEmail } from "@/lib/notify";
import { checkWatchlistAlerts } from "@/lib/watchlistAlerts";
import { computeEnhancedScore } from "@/lib/stocks/scoring";
import { getEarningsPerformance } from "@/lib/stocks/earningsPerformance";

export const maxDuration = 180;

// How many of the top cheap-momentum picks get re-ranked with the fuller
// pipeline (relative strength vs. peers, earnings-proximity penalty, risk
// quality). Wider than 50 so a stock outside the raw top 50 can still be
// promoted in if it scores better on those factors, and so a raw top-5 name
// that's dangerously overextended can actually fall out of the top 50.
const ENHANCED_SHORTLIST_SIZE = 80;

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
        // Prefer live Yahoo market cap; fall back to price × SHARES_OUTSTANDING estimate
        const shares = SHARES_OUTSTANDING[ticker] ?? 0;
        const marketCap = y.marketCap > 0
          ? y.marketCap
          : shares > 0 ? Math.round(y.price * shares * 1_000_000) : 0;
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

    // Fetch revenue growth from SEC EDGAR in parallel (free, no API key)
    // Results are cached via next.revalidate so this is fast on repeat runs
    const revenueGrowthResults = await Promise.allSettled(
      ranked.map((s) => getRevenueGrowthScore(s.ticker, null).then((r) => ({ ticker: s.ticker, value: r.value })))
    );
    const revenueGrowthMap = new Map<string, number>();
    for (const r of revenueGrowthResults) {
      if (r.status === "fulfilled" && r.value.value !== null) {
        const numVal = typeof r.value.value === "string"
          ? parseFloat(r.value.value.replace("%", "").replace("+", ""))
          : Number(r.value.value);
        if (isFinite(numVal)) revenueGrowthMap.set(r.value.ticker, numVal);
      }
    }

    // Upsert cheap-momentum results into DB first — the enhanced pass below
    // (relative-strength rank) reads the universe back out of the DB, so it
    // needs this run's numbers committed before it runs.
    for (const s of ranked) {
      const revenueGrowth = revenueGrowthMap.get(s.ticker) ?? s.revenueGrowth;
      const row = { ...s, revenueGrowth };
      await prisma.stock.upsert({
        where: { ticker: s.ticker },
        create: row,
        update: row,
      });
    }

    // Remove stale tickers not in current universe
    await prisma.stock.deleteMany({
      where: { ticker: { notIn: SMALL_CAP_UNIVERSE } },
    });

    // Re-rank the top slice with the fuller scoring pipeline: relative
    // strength vs. the rest of the universe, an earnings-proximity penalty,
    // and a risk/quality factor — instead of raw momentum alone, which tends
    // to rate a stock highest right as it's topping out.
    const shortlist = ranked.slice(0, ENHANCED_SHORTLIST_SIZE);
    const enhancedResults = await Promise.allSettled(
      shortlist.map((s) =>
        computeEnhancedScore(
          s.ticker,
          s.change1M,
          s.change3M,
          s.relativeVolume,
          revenueGrowthMap.get(s.ticker) ?? null
        ).then((e) => ({ ticker: s.ticker, riskAdjustedScore: e.riskAdjustedScore }))
      )
    );

    const finalScoreMap = new Map<string, number>(ranked.map((s) => [s.ticker, s.bullishScore]));
    for (const r of enhancedResults) {
      if (r.status === "fulfilled" && r.value.riskAdjustedScore !== null) {
        finalScoreMap.set(r.value.ticker, r.value.riskAdjustedScore);
      }
    }

    // Real earnings/revenue-beat + EPS growth from FMP, replacing what used
    // to be hardcoded false/0 for every stock. Scoped to the same shortlist
    // as the enhanced score to keep FMP call volume bounded and predictable.
    const earningsResults = await Promise.allSettled(
      shortlist.map((s) => getEarningsPerformance(s.ticker).then((e) => ({ ticker: s.ticker, ...e })))
    );
    const earningsMap = new Map<string, Awaited<ReturnType<typeof getEarningsPerformance>>>();
    let earningsOkCount = 0;
    for (const r of earningsResults) {
      if (r.status === "fulfilled") {
        earningsMap.set(r.value.ticker, r.value);
        if (r.value.ok) earningsOkCount++;
      }
    }
    // If most of the shortlist failed to get real earnings data (e.g. FMP
    // rate limit), that's silent otherwise — the screener just falls back
    // to stale/empty values with no visible error.
    if (shortlist.length > 0 && earningsOkCount / shortlist.length < 0.5) {
      await sendEmail({
        subject: "Stocks refresh: earnings data mostly unavailable",
        html: `<p>Only ${earningsOkCount} of ${shortlist.length} shortlisted stocks got real earnings/revenue-beat data from FMP this run — likely a rate limit or API issue. Check your FMP plan usage.</p>`,
      });
    }

    const reranked = [...shortlist].sort(
      (a, b) => (finalScoreMap.get(b.ticker) ?? 0) - (finalScoreMap.get(a.ticker) ?? 0)
    );
    await Promise.all(
      reranked.map((s, i) => {
        const earnings = earningsMap.get(s.ticker);
        return prisma.stock.update({
          where: { ticker: s.ticker },
          data: {
            bullishScore: finalScoreMap.get(s.ticker) ?? s.bullishScore,
            rank: i + 1,
            ...(earnings ? {
              earningsBeat: earnings.earningsBeat,
              revenueBeat: earnings.revenueBeat,
              epsGrowth: earnings.epsGrowth,
              lastEarningsDate: earnings.lastEarningsDate,
            } : {}),
          },
        });
      })
    );

    // Snapshot history reflects the final (enhanced, where available) score
    // so the backtest engine picks the same stocks the screener actually shows.
    await prisma.stockSnapshot.createMany({
      data: ranked.map((s) => ({
        ticker: s.ticker,
        bullishScore: finalScoreMap.get(s.ticker) ?? s.bullishScore,
        price: s.price,
        marketCap: s.marketCap,
      })),
    });

    try {
      await checkWatchlistAlerts();
    } catch (err) {
      console.error("checkWatchlistAlerts failed:", err);
    }

    return NextResponse.json({ success: true, count: ranked.length, sectors: Object.keys(SECTOR_UNIVERSE).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendEmail({
      subject: "Stocks refresh failed",
      html: `<p>The stocks screener refresh failed with error:</p><pre>${msg}</pre>`,
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export const GET = POST;

type YahooChart = NonNullable<Awaited<ReturnType<typeof getYahooChart>>>;
