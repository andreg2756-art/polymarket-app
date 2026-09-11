import { coverageAssessment } from "@/lib/stocks/financial-data/applicability";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FINANCIAL_COHORT } from '@/lib/stocks/financial-data/cohort';
import { loadStoredFundamentals, dataStatus } from '@/lib/stocks/financial-data/store';
import { FINANCIAL_FIELDS } from '@/lib/stocks/financial-data/model';
export async function GET() {
 const [jobs,stored]=await Promise.all([
  prisma.financialJob.findMany({where:{ticker:{in:[...FINANCIAL_COHORT]}},select:{ticker:true,status:true,reason:true,lastAttemptAt:true,lastSuccessAt:true,nextAttemptAt:true},orderBy:{ticker:'asc'}}),
  loadStoredFundamentals([...FINANCIAL_COHORT]),
 ]);
 return NextResponse.json({scope:'40-ticker diagnostic cohort',updatedAt:new Date().toISOString(),note:'Data availability is separate from the last calculated stock score. SECTOR_REVIEW distinguishes financial-sector model suitability from missing data. COMPLETE job status means all ten statement inputs were parsed; it does not certify a full Quality score or audited accuracy.',tickers:jobs.map(job=>{
  const f=stored.get(job.ticker);
  const assessment=f?coverageAssessment({values:f,statementProfile:f.statementProfile,sectorMetrics:f.sectorMetrics}):null;
  return {...job,assessment,source:f?.source??null,period:f?.periodType??null,periodEnd:f?.periodEnd??null,currency:f?.currency??null,fetchedAt:f?.fetchedAt??null,qualityInputs:dataStatus(f,'quality'),valueInputs:dataStatus(f,'value'),missing:assessment?.missing??FINANCIAL_FIELDS.filter(k=>f?.[k]==null)};
 })});
}
