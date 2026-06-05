import { NextResponse } from "next/server";

// TODO: Connect a real backtest engine (e.g. Backtrader, Zipline, or a data vendor)
// that can replay historical screener rankings and compute forward returns.
export async function GET() {
  return NextResponse.json({
    available: false,
    message: "Backtest engine not connected yet",
  });
}
