import { NextResponse } from "next/server";
import { getSupplementalStockData } from "@/lib/stockSupplementalData";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    const data = await getSupplementalStockData(ticker);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
