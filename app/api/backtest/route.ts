import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";

export async function GET() {
  const result = await runBacktest();
  return NextResponse.json(result);
}
