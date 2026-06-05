import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector") ?? "";
  const minScore = Number(searchParams.get("minScore") ?? 0);
  const minRevGrowth = Number(searchParams.get("minRevGrowth") ?? -999);
  const sortBy = searchParams.get("sortBy") ?? "rank";
  const search = searchParams.get("search") ?? "";

  const stocks = await prisma.stock.findMany({
    where: {
      bullishScore: { gte: minScore },
      revenueGrowth: { gte: minRevGrowth },
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
  });

  return NextResponse.json(stocks);
}
