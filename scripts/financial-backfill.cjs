require('./register-typescript.cjs');
const {runFinancialBackfill}=require('../lib/stocks/financial-data/backfill.ts');
const {prisma}=require('../lib/prisma.ts');
// Only the audited cohort; provider calls and production writes are explicit.
if(!process.argv.includes('--run')) {console.log('Use --run to execute one bounded backfill batch (maximum 8 tickers).');process.exit(0);}
runFinancialBackfill(8).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error('Backfill failed; inspect FinancialJob status. Credentials omitted.');process.exitCode=1;}).finally(()=>prisma.$disconnect());
