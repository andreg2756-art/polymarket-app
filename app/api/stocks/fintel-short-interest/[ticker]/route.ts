import { NextResponse } from "next/server";
import { getFintelShortInterest } from "@/lib/stocks/fintelShortInterest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    const data = await getFintelShortInterest(ticker);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
