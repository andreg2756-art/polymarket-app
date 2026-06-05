import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile, getIncomeStatements, getInsiderTrades, getAnalystRatings, getEarnings, getPriceHistory } from "@/lib/fmp";

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  const [stock, news, snapshots] = await Promise.all([
    prisma.stock.findUnique({ where: { ticker } }),
    prisma.stockNews.findMany({ where: { ticker }, orderBy: { publishedAt: "desc" }, take: 20 }),
    prisma.stockSnapshot.findMany({ where: { ticker }, orderBy: { createdAt: "asc" }, take: 30 }),
  ]);

  if (!stock) return NextResponse.json({ error: "Stock not found" }, { status: 404 });

  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [profile, income, insiders, analyst, earnings, priceHistory] = await Promise.allSettled([
    getProfile(ticker),
    getIncomeStatements(ticker),
    getInsiderTrades(ticker),
    getAnalystRatings(ticker),
    getEarnings(ticker),
    getPriceHistory(ticker, from, to),
  ]);

  return NextResponse.json({
    stock,
    news,
    snapshots,
    profile: profile.status === "fulfilled" ? profile.value : null,
    income: income.status === "fulfilled" ? income.value : [],
    insiders: insiders.status === "fulfilled" ? insiders.value : [],
    analyst: analyst.status === "fulfilled" ? analyst.value : null,
    earnings: earnings.status === "fulfilled" ? earnings.value : [],
    priceHistory: priceHistory.status === "fulfilled" ? priceHistory.value : [],
  });
}
