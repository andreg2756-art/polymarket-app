import type { FinancialBundle } from './model';
// Narrow corrections reviewed against issuer filings. Never carry a zero forward
// to another reporting date, company, currency, or period type.
export const REVIEWED_FACTS = [
 {ticker:'DSP',cik:'0001828791',periodEnd:'2026-06-30',currency:'USD',value:0,
  url:'https://www.sec.gov/Archives/edgar/data/1828791/000182879126000072/dsp-20260630.htm',
  accession:'0001828791-26-000072',filed:null,
  rationale:'June 2026 balance sheet reports no long-term debt; Note 9 confirms the revolving facility has no outstanding balance. Operating leases are separate liabilities.'},
 {ticker:'UTHR',cik:'0001082554',periodEnd:'2026-06-30',currency:'USD',value:0,
  url:'https://ir.unither.com/~/media/Files/U/United-Therapeutics-IR/documents/events-and-presentations/uthr-10q-q2-2026.pdf',
  accession:null,filed:'2026-08-05',
  rationale:'June 2026 Form 10-Q, Note 7 and liquidity discussion, explicitly report aggregate outstanding debt of zero. Operating leases are not included in borrowings.'},
] as const;
export function applyReviewedFacts(ticker:string,bundle:FinancialBundle):FinancialBundle {
 const reviewed=REVIEWED_FACTS.find(r=>r.ticker===ticker && r.cik===bundle.cik && r.periodEnd===bundle.periodEnd && r.currency===bundle.currency && bundle.periodType==='QUARTER');
 if(!reviewed || bundle.values.totalDebt!==null)return bundle;
 const missingReasons={...bundle.missingReasons};delete missingReasons.totalDebt;
 return {...bundle,values:{...bundle.values,totalDebt:reviewed.value},missingReasons,evidence:{...bundle.evidence,totalDebt:[{tag:'Reviewed interest-bearing borrowings, excluding operating leases',unit:reviewed.currency,start:null,end:reviewed.periodEnd,filed:reviewed.filed,accession:reviewed.accession,value:reviewed.value,sourceUrl:reviewed.url,reviewedAt:'2026-09-11',rationale:reviewed.rationale}]}};
}
