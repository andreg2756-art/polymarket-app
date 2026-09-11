require('../scripts/register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {emptyValues}=require('../lib/stocks/financial-data/model.ts');
const prismaPath=require.resolve('../lib/prisma.ts');
let records=[],cache=[];let fetchCalls=0;
require.cache[prismaPath]={id:prismaPath,filename:prismaPath,loaded:true,exports:{prisma:{financialRecord:{findMany:async()=>records},financialSourceResponse:{findMany:async()=>cache},$queryRaw:async()=>[{used:1}],financialRequestBudget:{update:async()=>({})}}}};
const {loadStoredFundamentals,hydrateFinancialData}=require('../lib/stocks/financial-data/store.ts');
const {fetchBQFinancials}=require('../lib/stocks/financial-data/bq-client.ts');
test('saved financial inputs are loaded for every ticker, independent of shortlist',async()=>{
 const now=new Date(),end=new Date(now.getTime()-100*86400000).toISOString().slice(0,10);
 records=['A','B'].map(ticker=>({ticker,periodEnd:end,fetchedAt:now,payload:{version:'FINANCIAL_DATA_V1',periodEnd:end,periodType:'QUARTER',currency:'USD',source:'BUSINESS_QUANT',values:{...emptyValues(),freeCashFlow:25}}}));
 const loaded=await loadStoredFundamentals(['A','B']);assert.equal(loaded.get('A').freeCashFlow,25);assert.equal(loaded.get('B').freeCashFlow,25);
 const views=await hydrateFinancialData([{ticker:'A',qualityDataStatus:'COMPLETE'}]);assert.equal(views[0].qualityDataStatus,'UNVERIFIED');
});
test('expired records are not used in new scores',async()=>{
 records=[{ticker:'OLD',fetchedAt:new Date(),payload:{version:'FINANCIAL_DATA_V1',periodEnd:'2020-12-31',periodType:'ANNUAL',values:emptyValues()}}];
 assert.equal((await loadStoredFundamentals(['OLD'])).size,0);
});
test('HTTP 429 retains successful expired statement cache and stops further requests',async()=>{
 process.env.BUSINESSQUANT_API_KEY='test-only';
 const date=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const row=(statement,tag,value)=>({statement,fetchedAt:new Date(Date.now()-10*86400000),payload:{metadata:{ticker:'A',cik:1,currency:'USD',frequency:'Quarter'},data:{[tag]:{values:[{date,periodType:'Quarter',reportedValue:{raw:value}}]}}}});
 cache=[row('IS','Revenue (Quarter)',10),row('BS','Cash & Equivalents (Quarter)',20),row('CF','Free Cash Flow (Quarter)',3)];
 const saved=global.fetch;global.fetch=async()=>{fetchCalls++;return {ok:false,status:429}};
 try{const result=await fetchBQFinancials('A');assert.equal(result.bundle.values.cashAndEquivalents,20);assert.equal(result.bundle.values.freeCashFlow,3);assert.equal(fetchCalls,1);assert.ok(Date.parse(result.bundle.retrievedAt)<Date.now()-9*86400000);assert.ok(result.failures.includes('BUSINESS_QUANT_IS_HTTP_429'));}finally{global.fetch=saved;}
});
