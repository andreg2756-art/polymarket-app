require('./register-typescript.cjs');
const {prisma}=require('../lib/prisma.ts');
const {parseBQStatements}=require('../lib/stocks/financial-data/bq-parser.ts');
const {coverageAssessment}=require('../lib/stocks/financial-data/applicability.ts');
const {FINANCIAL_FIELDS,nonMissing}=require('../lib/stocks/financial-data/model.ts');
const {FINANCIAL_COHORT}=require('../lib/stocks/financial-data/cohort.ts');
(async()=>{
 const rows=await prisma.financialSourceResponse.findMany({where:{source:'BUSINESS_QUANT',ticker:{in:[...FINANCIAL_COHORT]}}});
 const groups=new Map();for(const r of rows){if(!groups.has(r.ticker))groups.set(r.ticker,[]);groups.get(r.ticker).push(r);}
 const result=[];
 for(const [ticker,records]of groups){
  const bundle=parseBQStatements(ticker,Object.fromEntries(records.map(r=>[r.statement,r.payload])));if(!bundle)continue;
  const fetchedAt=new Date(Math.min(...records.map(r=>r.fetchedAt.getTime())));bundle.retrievedAt=fetchedAt.toISOString();
  const source=`${bundle.source}:${bundle.mappingVersion}`;
  const assessment=coverageAssessment(bundle),age=(Date.now()-Date.parse(bundle.periodEnd))/86400000;
  const status=age>200?'STALE':assessment.requiresSectorModel?'SECTOR_REVIEW':assessment.missing.length?'PARTIAL':'COMPLETE';
  if(process.argv.includes('--apply'))await prisma.$transaction([
   // Revision has its own record identity; prior extracted records and score snapshots stay intact.
   prisma.financialRecord.upsert({where:{ticker_source_periodEnd:{ticker,source,periodEnd:bundle.periodEnd}},create:{ticker,source,periodEnd:bundle.periodEnd,periodType:bundle.periodType,currency:bundle.currency,payload:bundle,fetchedAt},update:{payload:bundle,fetchedAt}}),
   prisma.stock.updateMany({where:{ticker},data:{...nonMissing({totalDebt:bundle.values.totalDebt,netIncome:bundle.values.netIncome}),qualityDataStatus:'UNVERIFIED',valueDataStatus:'UNVERIFIED'}}),
   prisma.financialJob.updateMany({where:{ticker},data:{status,reason:[assessment.note,...assessment.missing.map(k=>`${k}: ${bundle.missingReasons[k]}`)].filter(Boolean).join('; ')||null}}),
  ]);
  result.push({ticker,status,profile:assessment.profile,missing:assessment.missing,notApplicableToGenericScore:assessment.notApplicableToGenericScore,totalDebt:bundle.values.totalDebt,reviewedDebtSource:bundle.evidence.totalDebt?.[0]?.sourceUrl??null,fields:FINANCIAL_FIELDS.filter(k=>bundle.values[k]!==null).length});
 }
 console.log(JSON.stringify({applied:process.argv.includes('--apply'),result},null,2));
})().catch(()=>{console.error('Cached statement reprocessing failed; credentials omitted.');process.exitCode=1}).finally(()=>prisma.$disconnect());
