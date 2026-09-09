export const FINANCIAL_FIELDS = ['netIncome', 'revenue', 'grossProfit', 'operatingIncome', 'totalDebt', 'cashAndEquivalents', 'freeCashFlow', 'prevRevenue', 'prevOperatingIncome', 'prevFreeCashFlow'] as const;
export type FinancialField = typeof FINANCIAL_FIELDS[number];
export type Values = Record<FinancialField, number | null>;
export const emptyValues = (): Values => Object.fromEntries(FINANCIAL_FIELDS.map(k => [k, null])) as Values;
export interface FactEvidence {
  tag: string; unit: string; start: string | null; end: string; filed: string | null; accession: string | null; value: number;
}
export interface FinancialBundle {
  retrievedAt?: string;
  revenueGrowthYoY?: number | null;
  version: 'FINANCIAL_DATA_V1'; source: 'SEC' | 'BUSINESS_QUANT'; cik: string; periodEnd: string;
  periodType: 'ANNUAL' | 'QUARTER'; currency: string; values: Values;
  evidence: Partial<Record<FinancialField, FactEvidence[]>>;
  missingReasons: Partial<Record<FinancialField, string>>;
}
export function nonMissing<T extends object>(values: T): { [K in keyof T]?: NonNullable<T[K]> } {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined && (typeof v !== 'number' || Number.isFinite(v)) && (typeof v !== 'string' || (v.trim() !== '' && v !== 'N/A')))) as { [K in keyof T]?: NonNullable<T[K]> };
}
export function runwayYears(cash: number | null, fcf: number | null, period: string | null | undefined): number | null {
  if (cash === null || cash < 0 || fcf === null || fcf >= 0 || !Number.isFinite(cash) || !Number.isFinite(fcf)) return null;
  const periodsPerYear = period === 'ANNUAL' || period === 'TTM' ? 1 : period === 'QUARTER' ? 4 : null;
  return periodsPerYear === null ? null : cash / (Math.abs(fcf) * periodsPerYear);
}
export function missingInputs(values: Values, lens: 'quality' | 'value'): FinancialField[] {
  const required: FinancialField[] = lens === 'quality' ? ['revenue', 'operatingIncome', 'totalDebt', 'cashAndEquivalents', 'freeCashFlow'] : ['revenue', 'operatingIncome', 'freeCashFlow', 'cashAndEquivalents', 'prevRevenue', 'prevOperatingIncome', 'prevFreeCashFlow'];
  return required.filter(k => values[k] === null);
}

export function momentumUpdate(row: {ticker:string;name:string;price:number;marketCap:number;change1M:number;change3M:number;relativeVolume:number;bullishScore:number;rank:number}, revenueGrowth:number|undefined) {
 return {...nonMissing({name:row.name,price:row.price>0?row.price:null,marketCap:row.marketCap>0?row.marketCap:null,revenueGrowth}),change1M:row.change1M,change3M:row.change3M,relativeVolume:row.relativeVolume,bullishScore:row.bullishScore,rank:row.rank};
}
