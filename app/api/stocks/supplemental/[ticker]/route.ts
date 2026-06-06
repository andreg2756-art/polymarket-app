import { NextResponse } from "next/server";
import { getSupplementalStockData } from "@/lib/stockSupplementalData";
import { getFmpFundamentals } from "@/lib/stocks/fmpFundamentals";

function fmtM(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${(n / 1e6).toFixed(1)}M`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    const [supp, fmp] = await Promise.all([
      getSupplementalStockData(ticker),
      getFmpFundamentals(ticker).catch(() => null),
    ]);

    // FMP enrichment — only fills fields Yahoo left null
    const enriched = { ...supp } as Record<string, unknown>;

    if (fmp) {
      if (supp.cash?.value == null && fmp.cash !== null) {
        enriched.cash = { value: fmtM(fmp.cash), source: "FMP" };
      }
      if (supp.totalDebt?.value == null && fmp.debt !== null) {
        enriched.totalDebt = { value: fmtM(fmp.debt), source: "FMP" };
      }
      if (supp.nextEarnings?.value == null && fmp.nextEarningsDate) {
        enriched.nextEarnings = { value: fmp.nextEarningsDate, source: "FMP" };
      }
    }

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
