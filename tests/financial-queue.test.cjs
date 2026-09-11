require('../scripts/register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const prismaPath=require.resolve('../lib/prisma.ts');
require.cache[prismaPath]={id:prismaPath,filename:prismaPath,loaded:true,exports:{prisma:{}}};
const {selectFinancialJobs}=require('../lib/stocks/financial-data/queue.ts');
const {nextBudgetWindow}=require('../lib/stocks/financial-data/config.ts');
const job=(ticker,tried=false)=>({ticker,lastAttemptAt:tried?new Date('2026-09-01'):null,nextAttemptAt:new Date('2026-09-01'),reason:null,status:tried?'RETRY':'PENDING'});
const stock=(ticker,rank=0,watched=false)=>({ticker,rank,qualityRank:null,turnaroundRank:null,watchlistItems:watched?[{id:'1'}]:[]});
test('initial coverage gets six slots while existing records retain two',()=>{
 const jobs=[...Array.from({length:10},(_,i)=>job(`N${i}`)),...Array.from({length:5},(_,i)=>job(`R${i}`,true))];
 const selected=selectFinancialJobs(jobs,jobs.map(j=>stock(j.ticker)));
 assert.equal(selected.length,8);assert.equal(selected.filter(j=>!j.lastAttemptAt).length,6);assert.equal(new Set(selected.map(j=>j.ticker)).size,8);
});
test('unused refresh slots go to new stocks outside the diagnostic cohort',()=>{
 const jobs=Array.from({length:12},(_,i)=>job(`NEW${i}`));
 assert.equal(selectFinancialJobs(jobs,jobs.map(j=>stock(j.ticker))).length,8);
});
test('oldest due work wins; tied work favors watchlist and positive screener ranks',()=>{
 const jobs=['UNRANKED','RANKED','WATCH'].map(t=>job(t));
 const stocks=[stock('UNRANKED'),stock('RANKED',2),stock('WATCH',0,true)];
 assert.deepEqual(selectFinancialJobs(jobs,stocks).map(j=>j.ticker),['WATCH','RANKED','UNRANKED']);
 jobs[0].nextAttemptAt=new Date('2026-08-01');assert.equal(selectFinancialJobs(jobs,stocks)[0].ticker,'UNRANKED');
});
test('small and nonfinite batch limits remain bounded with no duplicates',()=>{
 const jobs=Array.from({length:10},(_,i)=>job(`X${i}`,i>4));const stocks=jobs.map(j=>stock(j.ticker));
 assert.equal(selectFinancialJobs(jobs,stocks,1).length,1);assert.equal(selectFinancialJobs(jobs,stocks,NaN).length,8);assert.equal(selectFinancialJobs(jobs,stocks,99).length,8);
});
test('quota deferral uses next UTC day, including month rollover',()=>{
 assert.equal(nextBudgetWindow(new Date('2026-09-30T23:50:00Z')).toISOString(),'2026-10-01T00:00:00.000Z');
});
