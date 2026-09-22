import { coverageAssessment } from '@/lib/stocks/financial-data/applicability';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FINANCIAL_COHORT } from '@/lib/stocks/financial-data/cohort';
import { getBQBudget } from '@/lib/stocks/financial-data/bq-client';
import { loadStoredFundamentals, dataStatus } from '@/lib/stocks/financial-data/store';
import { FINANCIAL_FIELDS } from '@/lib/stocks/financial-data/model';
export async function GET(request:Request) {
 const cohort=new URL(request.url).searchParams.get('scope')==='cohort';
 const stocks=await prisma.stock.findMany({where:cohort?{ticker:{in:[...FINANCIAL_COHORT]}}:{},select:{ticker:true},orderBy:{ticker:'asc'}});
 const tickers=stocks.map(s=>s.ticker);
 const [jobs,stored,budget]=await Promise.all([
  prisma.financialJob.findMany({where:{ticker:{in:tickers}},select:{ticker:true,status:true,reason:true,lastAttemptAt:true,lastSuccessAt:true,nextAttemptAt:true}}),
  loadStoredFundamentals(tickers,{includeStale:true}),getBQBudget(),
 ]);
 const byTicker=new Map(jobs.map(j=>[j.ticker,j]));
 const rows=tickers.map(ticker=>{
  const job=byTicker.get(ticker)??{ticker,status:'NOT_QUEUED',reason:null,lastAttemptAt:null,lastSuccessAt:null,nextAttemptAt:null};
  const f=stored.get(ticker);
  const assessment=f?coverageAssessment({values:f,statementProfile:f.statementProfile,sectorMetrics:f.sectorMetrics}):null;
  return {...job,assessment,source:f?.source??null,period:f?.periodType??null,periodEnd:f?.periodEnd??null,currency:f?.currency??null,fetchedAt:f?.fetchedAt??null,qualityInputs:dataStatus(f,'quality'),valueInputs:dataStatus(f,'value'),missing:assessment?.missing??FINANCIAL_FIELDS.filter(k=>f?.[k]==null)};
 });
 const statuses:Record<string,number>={};for(const row of rows)statuses[row.status]=(statuses[row.status]??0)+1;
 return NextResponse.json({scope:cohort?'40-ticker diagnostic cohort':'Full saved stock universe',updatedAt:new Date().toISOString(),summary:{total:tickers.length,queued:jobs.length,statuses},budget,note:'Data availability is separate from the last calculated stock score. SECTOR_REVIEW distinguishes financial-sector model suitability from missing data. COMPLETE job status means all ten statement inputs were parsed; it does not certify a full Quality score or audited accuracy. Request allowance is shared; an exhausted allowance pauses acquisition without implying ticker data is unavailable.',tickers:rows});
}
