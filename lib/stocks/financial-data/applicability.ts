import { FINANCIAL_FIELDS, type FinancialField, type Values } from './model';
export type StatementProfile = 'OPERATING_COMPANY' | 'FINANCIAL_INSTITUTION' | 'UNKNOWN';
export interface SectorMetrics {
 interestIncome?:number|null;
 netInterestIncome?:number|null;
}
// These are unsuitable inputs to the operating-company model, not values that
// should be filled with zero. Keep any reported values available for research.
const FINANCIAL_NOT_COMPARABLE:FinancialField[]=['grossProfit','operatingIncome','prevOperatingIncome','freeCashFlow','prevFreeCashFlow'];
export function coverageAssessment(data:{values:Values;statementProfile?:StatementProfile;sectorMetrics?:SectorMetrics}) {
 const financial=data.statementProfile==='FINANCIAL_INSTITUTION';
 const notApplicableToGenericScore=financial?FINANCIAL_NOT_COMPARABLE:[];
 const missing=FINANCIAL_FIELDS.filter(k=>data.values[k]===null && !notApplicableToGenericScore.includes(k));
 return {profile:data.statementProfile??'UNKNOWN',missing,notApplicableToGenericScore,requiresSectorModel:financial,
  sectorMetrics:data.sectorMetrics??{},
  note:financial?'Financial-sector statements require a separate assessment of leverage, funding, net interest income and asset risk. Generic operating margins and cash-runway scores are not comparable. No replacement score or bonus is assigned.':null};
}
export function needsStatementFallback(data:{values:Values;statementProfile?:StatementProfile}) {
 return coverageAssessment(data).missing.length>0;
}
