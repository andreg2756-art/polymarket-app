import { coverageAssessment } from "./applicability";
import { prisma } from '@/lib/prisma';
import { emptyValues, missingInputs, type FinancialBundle } from './model';
import type { Fundamentals } from '../fundamentals';
export const MAX_ANNUAL_AGE_DAYS=550;
export async function loadStoredFundamentals(tickers:string[]):Promise<Map<string,Fundamentals>> {
 const records=await prisma.financialRecord.findMany({where:{ticker:{in:tickers}},orderBy:[{periodEnd:'desc'},{fetchedAt:'desc'}]});
 const result=new Map<string,Fundamentals>();
 records.sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||((b.payload as unknown as FinancialBundle).mappingVersion??'').localeCompare((a.payload as unknown as FinancialBundle).mappingVersion??'')||b.fetchedAt.getTime()-a.fetchedAt.getTime());
 for(const record of records) {
  if(result.has(record.ticker)) continue;
  const data=record.payload as unknown as FinancialBundle;
  if(data.version!=='FINANCIAL_DATA_V1')continue;
  const age=(Date.now()-Date.parse(data.periodEnd))/86400000;
  if(!Number.isFinite(age)||age<0||age>(data.periodType === "QUARTER" ? 200 : MAX_ANNUAL_AGE_DAYS))continue;
  result.set(record.ticker,{...emptyValues(),...data.values,statementProfile:data.statementProfile,sectorMetrics:data.sectorMetrics,mappingVersion:data.mappingVersion,revenueGrowthYoY:data.revenueGrowthYoY,periodType:data.periodType,periodEnd:data.periodEnd,currency:data.currency,source:data.mappingVersion ? `${data.source}:${data.mappingVersion}` : data.source,fetchedAt:record.fetchedAt.toISOString(),stale:Date.now()-record.fetchedAt.getTime()>35*86400000});
 }
 return result;
}
export function dataStatus(f:Fundamentals|undefined,lens:'quality'|'value'):string {
 if(!f)return 'UNVERIFIED';
 if(f.stale)return 'STALE';
 if(f.statementProfile==='FINANCIAL_INSTITUTION')return 'SECTOR_MODEL_REQUIRED';
 return missingInputs(f,lens).length || (lens === 'quality' && f.revenueGrowthYoY == null) ? 'PARTIAL':'COMPLETE';
}

export async function hydrateFinancialData<T extends {ticker:string;financialPeriodEnd?:string|null;financialFetchedAt?:Date|null;qualityDataStatus?:string;valueDataStatus?:string;financialSource?:string|null}>(stocks:T[]) {
 const stored=await loadStoredFundamentals(stocks.map(s=>s.ticker));
 return stocks.map(stock=>{
  const f=stored.get(stock.ticker);
  const scoredFromCurrentRecord=f && stock.financialPeriodEnd===f.periodEnd && stock.financialSource===f.source && stock.financialFetchedAt?.toISOString()===f.fetchedAt;
  return {...stock, financialApplicability:f?coverageAssessment({values:f,statementProfile:f.statementProfile,sectorMetrics:f.sectorMetrics}):null,
   ...(f ? {netIncome:f.netIncome,totalDebt:f.totalDebt,cashAndEquivalents:f.cashAndEquivalents,freeCashFlow:f.freeCashFlow,financialPeriodType:f.periodType,financialPeriodEnd:f.periodEnd,financialCurrency:f.currency,financialSource:f.source,financialFetchedAt:f.fetchedAt} : {financialPeriodType:null,financialPeriodEnd:null}),
   qualityDataStatus:scoredFromCurrentRecord?dataStatus(f,'quality'):'UNVERIFIED',
   valueDataStatus:scoredFromCurrentRecord?dataStatus(f,'value'):'UNVERIFIED',
  };
 });
}
