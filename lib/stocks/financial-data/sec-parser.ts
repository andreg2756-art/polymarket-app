import { emptyValues, FINANCIAL_FIELDS, type FactEvidence, type FinancialBundle, type FinancialField } from './model';
interface RawFact { val: number; start?: string; end: string; filed: string; accn: string; form: string; }
export interface CompanyFacts { cik: number; facts?: Record<string, Record<string, { units?: Record<string, RawFact[]> }>>; }
const TAGS = {
 revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
 netIncome: ['NetIncomeLoss', 'ProfitLoss'], operatingIncome: ['OperatingIncomeLoss'], grossProfit: ['GrossProfit'],
 cashAndEquivalents: ['CashAndCashEquivalentsAtCarryingValue'], totalDebt: ['LongTermDebtAndShortTermBorrowings'],
} as const;
const days = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 86400000;
// Annual-only v1: do not mix quarters, YTD, currencies or unknown debt definitions.
export function parseCompanyFacts(data: CompanyFacts, now = new Date()): FinancialBundle | null {
 const gaap = data.facts?.['us-gaap'];
 if (!gaap) return null;
 const valid = (f: RawFact, duration: boolean) => Number.isFinite(f.val) && !!f.accn && !!f.filed && Date.parse(f.filed) <= now.getTime() && Date.parse(f.end) <= now.getTime() && ['10-K','10-K/A','20-F','20-F/A','40-F','40-F/A'].includes(f.form) && (duration ? !!f.start && days(f.start, f.end) >= 330 && days(f.start, f.end) <= 380 : !f.start);
 const raw = (tag: string) => gaap[tag]?.units?.USD ?? [];
 // Anchor on revenue/net income: never select a stale concept just because its alias has priority.
 const anchors = [...TAGS.revenue, ...TAGS.netIncome].flatMap(raw).filter(f => valid(f, true)).sort((a,b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed));
 const anchor = anchors[0]; if (!anchor) return null;
 const periodEnd = anchor.end;
 const previousEnd = anchors.find(f => days(f.end, periodEnd) >= 330 && days(f.end, periodEnd) <= 380)?.end;
 const evidence: FinancialBundle['evidence'] = {};
 const values = emptyValues();
 function pick(tags: readonly string[], end: string, duration: boolean): FactEvidence | null {
  const candidates = tags.flatMap(tag => raw(tag).filter(f => f.end === end && valid(f,duration)).map(f => ({tag, unit:'USD', start:f.start ?? null, end:f.end, filed:f.filed, accession:f.accn, value:f.val})));
  candidates.sort((a,b) => b.filed!.localeCompare(a.filed!) || tags.indexOf(a.tag)-tags.indexOf(b.tag));
  return candidates[0] ?? null;
 }
 function put(field: FinancialField, fact: FactEvidence | null) { if (fact) {values[field]=fact.value; evidence[field]=[fact];} }
 for (const field of ['revenue','netIncome','operatingIncome','grossProfit'] as const) put(field,pick(TAGS[field],periodEnd,true));
 for (const field of ['cashAndEquivalents','totalDebt'] as const) put(field,pick(TAGS[field],periodEnd,false));
 // Total debt only from an explicit total, or current/non-current components of the same filing.
 if (values.totalDebt === null) {
  const current=pick(['LongTermDebtCurrent'],periodEnd,false), noncurrent=pick(['LongTermDebtNoncurrent'],periodEnd,false), short=pick(['ShortTermBorrowings'],periodEnd,false);
  if(current && noncurrent && short && current.accession===noncurrent.accession && current.accession===short.accession) {
   values.totalDebt=current.value+noncurrent.value+short.value; evidence.totalDebt=[current,noncurrent,short];
  }
 }
 function fcf(field: 'freeCashFlow'|'prevFreeCashFlow',end:string) {
  const operating=pick(['NetCashProvidedByUsedInOperatingActivities'],end,true), capex=pick(['PaymentsToAcquirePropertyPlantAndEquipment'],end,true);
  if(operating && capex && capex.value>=0 && operating.start===capex.start && operating.accession===capex.accession) {
   values[field]=operating.value-capex.value; evidence[field]=[operating,capex];
  }
 }
 fcf('freeCashFlow',periodEnd);
 if(previousEnd) {put('prevRevenue',pick(TAGS.revenue,previousEnd,true));put('prevOperatingIncome',pick(TAGS.operatingIncome,previousEnd,true));fcf('prevFreeCashFlow',previousEnd);}
 // Comparisons require equal-duration periods, not just year-end labels.
 for(const [current,previous] of [['revenue','prevRevenue'],['operatingIncome','prevOperatingIncome'],['freeCashFlow','prevFreeCashFlow']] as const) {
  const a=evidence[current]?.[0], b=evidence[previous]?.[0];
  if(a?.start && b?.start && Math.abs(days(a.start,a.end)-days(b.start,b.end))>14) {values[previous]=null;delete evidence[previous];}
 }
 for(const field of ['cashAndEquivalents','totalDebt'] as const) if(values[field]!==null && values[field]! < 0) {values[field]=null;delete evidence[field];}
 const revenueFact=evidence.revenue?.[0], marginFact=evidence.operatingIncome?.[0];
 if(revenueFact && marginFact && revenueFact.start!==marginFact.start){values.operatingIncome=null;delete evidence.operatingIncome;}
 const missingReasons: FinancialBundle['missingReasons']={};
 for(const field of FINANCIAL_FIELDS) if(values[field]===null) missingReasons[field]='No compatible USD fact or complete derivation for this annual period; not assumed zero.';
 const revenueGrowthYoY=values.revenue!==null && values.prevRevenue!==null && values.prevRevenue>0 ? (values.revenue-values.prevRevenue)/values.prevRevenue*100 : null;
 return {revenueGrowthYoY,version:'FINANCIAL_DATA_V1',source:'SEC',cik:String(data.cik).padStart(10,'0'),periodEnd,periodType:'ANNUAL',currency:'USD',values,evidence,missingReasons};
}
