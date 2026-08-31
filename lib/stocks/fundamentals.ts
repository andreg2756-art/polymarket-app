// Bounded fundamentals fetch (balance sheet + income, annual + prior year) —
// used only on a capped shortlist per lens, never the full expanded universe.
// Sourced from Polygon rather than FMP: FMP's current plan rejects (402)
// financial-statement requests for anything outside a small mega-cap
// allowlist, which made this silently empty for virtually every small/mid
// cap the screener actually targets. Polygon has no such allowlist (see
// massive.ts for the coverage test and the cash/FCF gap this trades in).

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
