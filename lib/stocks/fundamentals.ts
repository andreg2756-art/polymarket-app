// Fundamentals fetch backing both the Quality and Turnaround lenses.
// Sourced from Business Quant primarily — confirmed by direct testing to
// cover small/mid-caps FMP's plan rejects outright (402), with no observed
// rate limit (unlike Polygon's 5/min, which is why this used to be capped
// to a tiny daily-rotating shortlist — see runQualityPipeline.ts/
// runTurnaroundPipeline.ts for that history). Polygon is kept as a fallback
// for the rare case Business Quant's BS/IS/CF calls all fail outright
// (network error, ticker not found) rather than removed outright, since it
// was already integrated and does add small-cap coverage FMP never had.

import { getBusinessQuantFundamentals } from "@/lib/businessQuant";
import { fetchPolygonFinancials } from "@/lib/stocks/massive";

export interface Fundamentals {
  netIncome: number | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  totalDebt: number | null;
  cashAndEquivalents: number | null;
  freeCashFlow: number | null;
  // Prior-period values, for trend direction (turnaround "evidence" signal)
  prevRevenue: number | null;
  prevOperatingIncome: number | null;
  prevFreeCashFlow: number | null;
}

const EMPTY: Fundamentals = {
  netIncome: null, revenue: null, grossProfit: null, operatingIncome: null,
  totalDebt: null, cashAndEquivalents: null, freeCashFlow: null,
  prevRevenue: null, prevOperatingIncome: null, prevFreeCashFlow: null,
};

export async function getFundamentals(ticker: string): Promise<Fundamentals> {
  try {
    const bq = await getBusinessQuantFundamentals(ticker);
    if (bq.ok) {
      return {
        netIncome: bq.netIncome,
        revenue: bq.revenue,
        grossProfit: bq.grossProfit,
        operatingIncome: bq.operatingIncome,
        totalDebt: bq.totalDebt,
        cashAndEquivalents: bq.cashAndEquivalents,
        freeCashFlow: bq.freeCashFlow,
        prevRevenue: bq.prevRevenue,
        prevOperatingIncome: bq.prevOperatingIncome,
        prevFreeCashFlow: bq.prevFreeCashFlow,
      };
    }

    const { current, previous } = await fetchPolygonFinancials(ticker);
    if (!current) return EMPTY;

    return {
      netIncome: current.netIncome,
      revenue: current.revenue,
      grossProfit: current.grossProfit,
      operatingIncome: current.operatingIncome,
      totalDebt: current.totalDebt,
      cashAndEquivalents: current.cashAndEquivalents,
      freeCashFlow: current.freeCashFlow,
      prevRevenue: previous?.revenue ?? null,
      prevOperatingIncome: previous?.operatingIncome ?? null,
      prevFreeCashFlow: previous?.freeCashFlow ?? null,
    };
  } catch {
    return EMPTY;
  }
}
