import { NextResponse } from "next/server";
import { runRetroBacktest } from "@/lib/stocks/retroBacktest";

export const maxDuration = 120;

export async function GET() {
  const result = await runRetroBacktest();
  return NextResponse.json(result);
}
