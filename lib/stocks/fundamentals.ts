// Bounded FMP fundamentals fetch (balance sheet + cash flow + income) —
// used only on a capped shortlist per lens, never the full expanded
// universe, to keep FMP call volume predictable (confirmed today: FMP's
// daily quota can be exhausted by a single heavy pass).

import { getIncomeStatements, getBalanceSheets, getCashFlows } from "@/lib/fmp";

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
    const [income, balance, cashFlow] = await Promise.all([
      getIncomeStatements(ticker).catch(() => []),
      getBalanceSheets(ticker).catch(() => []),
      getCashFlows(ticker).catch(() => []),
    ]);

    const inc0 = income[0];
    const inc1 = income[1];
    const bal0 = balance[0];
    const cf0 = cashFlow[0];
    const cf1 = cashFlow[1];

    if (!inc0 && !bal0 && !cf0) return EMPTY;

    return {
      netIncome: inc0?.netIncome ?? null,
      revenue: inc0?.revenue ?? null,
      grossProfit: inc0?.grossProfit ?? null,
      operatingIncome: inc0?.operatingIncome ?? null,
      totalDebt: bal0?.totalDebt ?? null,
      cashAndEquivalents: bal0?.cashAndCashEquivalents ?? null,
      freeCashFlow: cf0?.freeCashFlow ?? null,
      prevRevenue: inc1?.revenue ?? null,
      prevOperatingIncome: inc1?.operatingIncome ?? null,
      prevFreeCashFlow: cf1?.freeCashFlow ?? null,
    };
  } catch {
    return EMPTY;
  }
}
