import { prisma } from '@/lib/prisma';
import { FINANCIAL_CONFIG } from './config';
interface RankedStock {
 ticker:string;
 rank:number;
 qualityRank:number|null;
 turnaroundRank:number|null;
 watchlistItems:{id:string}[];
}
interface DueJob {ticker:string;lastAttemptAt:Date|null;nextAttemptAt:Date;reason:string|null;status:string;}
function priority(stock:RankedStock|undefined) {
 if(!stock)return Infinity;
 if(stock.watchlistItems.length)return 0;
 return Math.min(...[stock.rank,stock.qualityRank,stock.turnaroundRank].filter((n):n is number=>n!==null&&n>0),Infinity);
}
export function selectFinancialJobs<T extends DueJob>(jobs:T[],stocks:RankedStock[],limit=FINANCIAL_CONFIG.batchSize):T[] {
 const size=Math.min(FINANCIAL_CONFIG.batchSize,Math.max(1,Math.floor(Number.isFinite(limit)?limit:FINANCIAL_CONFIG.batchSize)));
 const byTicker=new Map(stocks.map(s=>[s.ticker,s]));
 const sort=(a:T,b:T)=>a.nextAttemptAt.getTime()-b.nextAttemptAt.getTime()||priority(byTicker.get(a.ticker))-priority(byTicker.get(b.ticker))||a.ticker.localeCompare(b.ticker);
 const fresh=jobs.filter(j=>j.lastAttemptAt===null).sort(sort);
 const maintenance=jobs.filter(j=>j.lastAttemptAt!==null).sort(sort);
 // Protect initial coverage while reserving capacity for stale data and retries.
 // Unused slots in either partition are immediately reused by the other.
 const refreshCount=Math.min(maintenance.length,FINANCIAL_CONFIG.maintenanceSlots,fresh.length?Math.max(0,size-1):size);
 const selected=fresh.slice(0,size-refreshCount);
 selected.push(...maintenance.slice(0,size-selected.length));
 if(selected.length<size)selected.push(...fresh.slice(selected.filter(j=>j.lastAttemptAt===null).length,size));
 return selected.slice(0,size);
}
export async function syncFinancialQueue(now=new Date()) {
 const stocks=await prisma.stock.findMany({select:{ticker:true,rank:true,qualityRank:true,turnaroundRank:true,watchlistItems:{select:{id:true}}}});
 // New and existing stocks are discovered each run. The diagnostic cohort is
 // only a reporting filter, never an acquisition whitelist.
 await prisma.financialJob.createMany({data:stocks.map(s=>({ticker:s.ticker,nextAttemptAt:now})),skipDuplicates:true});
 return stocks;
}
