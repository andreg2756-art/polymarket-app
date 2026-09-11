import { coverageAssessment, needsStatementFallback } from "./applicability";
import { enrichMetadata } from "./metadata";
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { syncFinancialQueue, selectFinancialJobs } from './queue';
import { FINANCIAL_CONFIG, nextBudgetWindow } from './config';
import { fetchSECFinancials, SourceError } from './sec-client';
import { fetchBQFinancials, getBQBudget } from './bq-client';
import { FINANCIAL_FIELDS, nonMissing, type FinancialBundle } from './model';

// Daily job is separate from page views and scans. Durable global lease prevents
// overlap; expired leases recover after crashes. Requests have bounded timeouts.
export async function runFinancialBackfill(limit=FINANCIAL_CONFIG.batchSize) {
 const now=new Date(),owner=randomUUID();
 const acquired=await prisma.$queryRaw<{id:string}[]>`INSERT INTO "FinancialWorkerLease" ("id","owner","expiresAt") VALUES ('financial-backfill',${owner},${new Date(now.getTime()+600000)}) ON CONFLICT ("id") DO UPDATE SET "owner"=EXCLUDED."owner","expiresAt"=EXCLUDED."expiresAt" WHERE "FinancialWorkerLease"."expiresAt" < ${now} RETURNING "id"`;
 if(!acquired.length)return {status:'BUSY',results:[]};
 const results:{ticker:string;status:string;reason:string|null;source?:string;fields?:number}[]=[];
 let secUnavailable:string|null=null;
 try {
  const stocks=await syncFinancialQueue(now);
  const due=await prisma.financialJob.findMany({where:{ticker:{in:stocks.map(s=>s.ticker)},nextAttemptAt:{lte:now}}});
  const jobs=selectFinancialJobs(due,stocks,limit);
  const budget=await getBQBudget(now);
  if(!budget.remaining)return {status:'WAITING_FOR_BUDGET',budget,queued:stocks.length,due:due.length,results};
  for(const job of jobs) {
   if(Date.now()-now.getTime()>FINANCIAL_CONFIG.maxRunMs)break;
   const available=await getBQBudget();
   if(!available.remaining)return {status:'WAITING_FOR_BUDGET',budget:available,queued:stocks.length,results};
   await prisma.financialJob.update({where:{ticker:job.ticker},data:{status:'RUNNING',attempts:{increment:1},lastAttemptAt:new Date()}});
   const failures:string[]=[];let bundle:FinancialBundle|null=null;
   try {
    failures.push(...await enrichMetadata(job.ticker));
    // Primary quarterly source is tried by statement, retaining successful cached
    // responses. A missing statement doesn't count as a complete company fetch.
    try { const bq=await fetchBQFinancials(job.ticker);bundle=bq.bundle;failures.push(...bq.failures); }
    catch(error) {failures.push(error instanceof SourceError ? error.code : "BUSINESS_QUANT_FETCH_FAILED");}
    const quotaDeferred=failures.some(f=>f==='BUSINESS_QUANT_DAILY_BUDGET'||f.endsWith('_HTTP_429'));
    if(quotaDeferred && (!bundle || needsStatementFallback(bundle))) {
     if(bundle)await persistBundle(job.ticker,bundle);
     await prisma.financialJob.update({where:{ticker:job.ticker},data:{status:'WAITING_FOR_BUDGET',attempts:job.attempts,reason:'Provider allowance exhausted; retained cached statements and deferred remaining acquisition.',nextAttemptAt:nextBudgetWindow()}});
     results.push({ticker:job.ticker,status:'WAITING_FOR_BUDGET',reason:'Provider allowance exhausted'});
     return {status:'WAITING_FOR_BUDGET',budget:await getBQBudget(),queued:stocks.length,results};
    }
    if(!bundle || needsStatementFallback(bundle)) {
     if(secUnavailable)failures.push(secUnavailable);
     else try {
      const sec=await fetchSECFinancials(job.ticker);
      // Never blend annual SEC numbers with quarterly Business Quant numbers.
      // Retain the alternative coherent record for inspection/future selection.
      await persistBundle(job.ticker,sec);
      if(!bundle)bundle=sec;
     }catch(error){const reason=error instanceof SourceError?error.code:'SEC_FETCH_FAILED';failures.push(reason);if(reason==='SEC_HTTP_403'||reason==='SEC_HTTP_429')secUnavailable=reason;}
    }
    if(!bundle)throw new SourceError(failures.join('; ')||'NO_SUPPORTED_STATEMENTS');
    await persistBundle(job.ticker,bundle);
    const accepted=bundle;
    const count=FINANCIAL_FIELDS.filter(k=>accepted.values[k]!==null).length;
    const age=(Date.now()-Date.parse(bundle.periodEnd))/86400000;
    const status=age>(bundle.periodType==='QUARTER'?200:550)?'STALE':bundle.statementProfile==='FINANCIAL_INSTITUTION'?'SECTOR_REVIEW':count===FINANCIAL_FIELDS.length?'COMPLETE':'PARTIAL';
    const reason=[...failures,...Object.entries(bundle.missingReasons).filter(([k])=>coverageAssessment(accepted).missing.includes(k as typeof FINANCIAL_FIELDS[number])).map(([k,v])=>`${k}: ${v}`)].join('; ')||null;
    await prisma.$transaction([
     prisma.financialJob.update({where:{ticker:job.ticker},data:{status,attempts:0,lastSuccessAt:new Date(),reason,nextAttemptAt:new Date(Date.now()+(status==='COMPLETE'||status==='SECTOR_REVIEW'?7:2)*86400000)}}),
     prisma.stock.updateMany({where:{ticker:job.ticker},data:nonMissing({netIncome:bundle.values.netIncome,totalDebt:bundle.values.totalDebt,cashAndEquivalents:bundle.values.cashAndEquivalents,freeCashFlow:bundle.values.freeCashFlow})}),
    ]);
    results.push({ticker:job.ticker,status,reason,source:bundle.source,fields:count});
   } catch(error) {
    const reason=error instanceof SourceError?error.code:'BACKFILL_FAILED';
    const unsupported=['IS','BS','CF'].every(s=>reason.includes(`BUSINESS_QUANT_${s}_HTTP_404`));
    const retryDays=unsupported?FINANCIAL_CONFIG.unsupportedRetryDays:Math.min(7,2**Math.min(job.attempts,3));
    await prisma.financialJob.update({where:{ticker:job.ticker},data:{status:'RETRY',reason,nextAttemptAt:new Date(Date.now()+retryDays*86400000)}});
    results.push({ticker:job.ticker,status:'RETRY',reason});
   }
  }
  return {status:'FINISHED',results};
 }finally{await prisma.financialWorkerLease.deleteMany({where:{id:'financial-backfill',owner}});}
}
async function persistBundle(ticker:string,bundle:FinancialBundle) {
 const recordSource=bundle.mappingVersion ? `${bundle.source}:${bundle.mappingVersion}` : bundle.source;
 const payload=bundle as unknown as Prisma.InputJsonValue;
 await prisma.financialRecord.upsert({where:{ticker_source_periodEnd:{ticker,source:recordSource,periodEnd:bundle.periodEnd}},create:{ticker,source:recordSource,periodEnd:bundle.periodEnd,periodType:bundle.periodType,currency:bundle.currency,payload,fetchedAt:new Date(bundle.retrievedAt ?? Date.now())},update:{payload,fetchedAt:new Date(bundle.retrievedAt ?? Date.now())}});
}
