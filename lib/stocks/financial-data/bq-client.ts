import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { parseBQStatements, type BQResponse } from './bq-parser';
import { SourceError } from './sec-client';
import { FINANCIAL_CONFIG, businessQuantBudgetId, nextBudgetWindow } from './config';
const DAILY_LIMIT=FINANCIAL_CONFIG.businessQuantDailyLimit;
export async function getBQBudget(now=new Date()) {
 const row=await prisma.financialRequestBudget.findUnique({where:{id:businessQuantBudgetId(now)}});
 const used=row?.used??0;
 return {limit:DAILY_LIMIT,used,remaining:Math.max(0,DAILY_LIMIT-used),resetsAt:nextBudgetWindow(now).toISOString(),resetBasis:'Local UTC request allowance; upstream provider limits may differ'};
}
export async function fetchBQFinancials(ticker:string) {
 if(!process.env.BUSINESSQUANT_API_KEY)throw new SourceError('BUSINESS_QUANT_NOT_CONFIGURED');
 const retrievedAt:Record<string,number>={};
 const responses:Partial<Record<string,BQResponse>>={}; const failures:string[]=[];
 const cachedRows=await prisma.financialSourceResponse.findMany({where:{ticker,source:'BUSINESS_QUANT'}});
 const cache=new Map(cachedRows.map(r=>[r.statement,r]));
 for(const row of cachedRows){responses[row.statement]=row.payload as unknown as BQResponse;retrievedAt[row.statement]=row.fetchedAt.getTime();}
 for(const statement of ['IS','BS','CF']) {
  const cached=cache.get(statement);
  if(cached && Date.now()-cached.fetchedAt.getTime()<FINANCIAL_CONFIG.statementCacheDays*86400000){responses[statement]=cached.payload as unknown as BQResponse;retrievedAt[statement]=cached.fetchedAt.getTime();continue;}
  const id=businessQuantBudgetId();
  const reserved=await prisma.$queryRaw<{used:number}[]>`INSERT INTO "FinancialRequestBudget" ("id","used") VALUES (${id},1) ON CONFLICT ("id") DO UPDATE SET "used"="FinancialRequestBudget"."used"+1 WHERE "FinancialRequestBudget"."used" < ${DAILY_LIMIT} RETURNING "used"`;
  if(!reserved.length){failures.push('BUSINESS_QUANT_DAILY_BUDGET');break;}
  const url=new URL('https://data.businessquant.com/statements');
  for(const [k,v] of Object.entries({ticker,statement,frequency:'Quarter',period:'2y',api_key:process.env.BUSINESSQUANT_API_KEY}))url.searchParams.set(k,v);
  try {
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok){failures.push(`BUSINESS_QUANT_${statement}_HTTP_${response.status}`);if(response.status===429){await prisma.financialRequestBudget.update({where:{id},data:{used:DAILY_LIMIT}});break;}continue;}
   const payload=await response.json() as BQResponse;
   if(payload.metadata?.ticker!==ticker||!payload.data){failures.push(`BUSINESS_QUANT_${statement}_INVALID_RESPONSE`);continue;}
   responses[statement]=payload;retrievedAt[statement]=Date.now();
   await prisma.financialSourceResponse.upsert({where:{ticker_source_statement:{ticker,source:'BUSINESS_QUANT',statement}},create:{ticker,source:'BUSINESS_QUANT',statement,payload:payload as Prisma.InputJsonValue},update:{payload:payload as Prisma.InputJsonValue,fetchedAt:new Date()}});
  }catch{failures.push(`BUSINESS_QUANT_${statement}_NETWORK_OR_TIMEOUT`);}
 }
 const bundle=parseBQStatements(ticker,responses);
 if(bundle && Object.values(retrievedAt).length)bundle.retrievedAt=new Date(Math.min(...Object.values(retrievedAt))).toISOString();
 return {bundle,failures};
}
