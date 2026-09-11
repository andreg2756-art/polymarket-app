require('../scripts/register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
let stocks=[],jobs=[],writes=[],released=0,fetches=0,remaining=0,failures=[];
const stub=(path,exports)=>{const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports};};
const p={
 $queryRaw:async()=>[{id:'financial-backfill'}],
 stock:{findMany:async()=>stocks},
 financialJob:{createMany:async({data})=>{for(const j of data)if(!jobs.some(x=>x.ticker===j.ticker))jobs.push({...j,lastAttemptAt:null,attempts:0,reason:null,status:'PENDING'});},findMany:async()=>jobs.map(j=>({...j})),update:async({where,data})=>{writes.push({ticker:where.ticker,data});Object.assign(jobs.find(j=>j.ticker===where.ticker),data);}},
 financialWorkerLease:{deleteMany:async()=>{released++;}},
};
stub('../lib/prisma.ts',{prisma:p});
stub('../lib/stocks/financial-data/metadata.ts',{enrichMetadata:async()=>[]});
class SourceError extends Error{constructor(code){super(code);this.code=code;}}
stub('../lib/stocks/financial-data/sec-client.ts',{SourceError,fetchSECFinancials:async()=>{throw new SourceError('SEC_HTTP_403');}});
stub('../lib/stocks/financial-data/bq-client.ts',{getBQBudget:async()=>({remaining,limit:24,used:24-remaining}),fetchBQFinancials:async()=>{fetches++;remaining=0;return {bundle:null,failures};}});
const {runFinancialBackfill}=require('../lib/stocks/financial-data/backfill.ts');
function reset(n=2){stocks=Array.from({length:n},(_,i)=>({ticker:`NEW${i}`,rank:i+1,qualityRank:null,turnaroundRank:null,watchlistItems:[]}));jobs=[];writes=[];released=fetches=remaining=0;failures=[];}
test('full quota seeds all stocks but makes no provider requests or failed job attempts',async()=>{
 reset(60);const r=await runFinancialBackfill();assert.equal(r.status,'WAITING_FOR_BUDGET');assert.equal(jobs.length,60);assert.equal(writes.length,0);assert.equal(fetches,0);assert.equal(released,1);assert.ok(jobs.every(j=>j.status==='PENDING'&&j.attempts===0));
});
test('mid-company quota pause restores failure count and leaves following stocks untouched',async()=>{
 reset();remaining=1;failures=['BUSINESS_QUANT_IS_HTTP_429'];const r=await runFinancialBackfill();assert.equal(r.status,'WAITING_FOR_BUDGET');assert.equal(fetches,1);assert.equal(jobs[0].status,'WAITING_FOR_BUDGET');assert.equal(jobs[0].attempts,0);assert.equal(jobs[1].status,'PENDING');assert.equal(jobs[1].lastAttemptAt,null);assert.equal(released,1);
});
test('genuinely unsupported statements receive a longer retry without writing empty financials',async()=>{
 reset(1);remaining=3;failures=['IS','BS','CF'].map(s=>`BUSINESS_QUANT_${s}_HTTP_404`);const before=Date.now();await runFinancialBackfill();assert.equal(jobs[0].status,'RETRY');assert.ok(jobs[0].nextAttemptAt.getTime()>=before+14*86400000);assert.equal(released,1);
});
