import { NextRequest, NextResponse } from "next/server";
import { runBacktest, type BacktestLens } from "@/lib/backtest";

const VALID_LENSES: BacktestLens[] = ["speculative", "quality", "turnaround"];

export async function GET(req: NextRequest) {
  const lensParam = req.nextUrl.searchParams.get("lens");
  const lens: BacktestLens = VALID_LENSES.includes(lensParam as BacktestLens)
    ? (lensParam as BacktestLens)
    : "speculative";
  const result = await runBacktest(lens);
  return NextResponse.json(result);
}
