import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreviousRanks, rankDelta } from "@/lib/stocks/rankChange";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector") ?? "";
  const minScore = Number(searchParams.get("minScore") ?? 0);
  const minRevGrowth = Number(searchParams.get("minRevGrowth") ?? -999);
  const sortBy = searchParams.get("sortBy") ?? "rank";
  const search = searchParams.get("search") ?? "";

  const [stocks, previousRanks] = await Promise.all([
    prisma.stock.findMany({
      where: {
        bullishScore: { gte: minScore },
        revenueGrowth: { gte: minRevGrowth },
        price: { gt: 0 },
        ...(sector ? { sector: { contains: sector, mode: "insensitive" } } : {}),
        ...(search ? {
          OR: [
            { ticker: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ]
        } : {}),
      },
      orderBy: sortBy === "bullishScore" ? { bullishScore: "desc" }
        : sortBy === "revenueGrowth" ? { revenueGrowth: "desc" }
        : sortBy === "epsGrowth" ? { epsGrowth: "desc" }
        : sortBy === "marketCap" ? { marketCap: "desc" }
        : sortBy === "insiderBuying" ? { insiderBuying: "desc" }
        : { rank: "asc" },
    }),
    getPreviousRanks("speculative"),
  ]);

  // Derive an "effective" rank from bullishScore order among actually-scored
  // tickers, rather than trusting the stored `rank` column directly — it can
  // go stale (see app/api/stocks/quality/route.ts's comment), and the
  // Speculative page already discards it in favor of its own client-side
  // recompute (app/stocks/speculative/page.tsx). rankChange needs to agree
  // with whatever rank actually ends up on screen, so it's derived the same
  // way here. This is only meaningful when `stocks` is the full unfiltered
  // universe (as the Speculative page always requests it) — a filtered
  // Screener view's "effective rank" wouldn't reflect true universe rank,
  // but the Screener tab doesn't display rankChange, only Speculative does.
  const effectiveRank = new Map<string, number>();
  stocks
    .filter((s) => s.rank > 0)
    .sort((a, b) => b.bullishScore - a.bullishScore)
    .forEach((s, i) => effectiveRank.set(s.ticker, i + 1));

  const withRankChange = stocks.map((s) => {
    const eRank = effectiveRank.get(s.ticker);
    return {
      ...s,
      rankChange: eRank !== undefined ? rankDelta(previousRanks, s.ticker, eRank) : null,
    };
  });

  return NextResponse.json(withRankChange);
}
