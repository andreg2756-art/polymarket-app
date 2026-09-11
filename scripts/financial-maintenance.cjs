require('./register-typescript.cjs');
const {prisma}=require('../lib/prisma.ts');
const {syncFinancialQueue}=require('../lib/stocks/financial-data/queue.ts');
const {sectorForIndustry}=require('../lib/stocks/financial-data/metadata.ts');
(async()=>{
 const stocks=await prisma.stock.findMany({select:{ticker:true,sector:true,industry:true}});
 const jobs=await prisma.financialJob.findMany({select:{ticker:true}});
 const cached=await prisma.financialSourceResponse.findMany({where:{source:'FINNHUB',statement:'PROFILE'}});
 const byTicker=new Map(stocks.map(s=>[s.ticker,s]));
 const corrections=cached.flatMap(row=>{
  const p=row.payload,stock=byTicker.get(row.ticker),industry=p.finnhubIndustry?.trim();
  if(!stock||p.ticker!==row.ticker||!industry)return [];
  const sector=sectorForIndustry(industry);
  return sector&&(stock.sector!==sector||stock.industry!==industry)?[{ticker:row.ticker,industry,sector}]:[];
 });
 if(process.argv.includes('--apply')){
  await syncFinancialQueue();
  for(const {ticker,...data}of corrections)await prisma.stock.update({where:{ticker},data});
 }
 const jobTickers=new Set(jobs.map(j=>j.ticker));
 console.log(JSON.stringify({applied:process.argv.includes('--apply'),universe:stocks.length,newlyEligible:stocks.filter(s=>!jobTickers.has(s.ticker)).length,profileCorrections:corrections,providerRequests:0},null,2));
})().catch(()=>{console.error('Financial maintenance failed; credentials omitted.');process.exitCode=1}).finally(()=>prisma.$disconnect());
