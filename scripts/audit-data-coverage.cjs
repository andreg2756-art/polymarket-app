const {Client}=require('pg');
const fs=require('node:fs');
(async()=>{
 const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000});
 let rows;try{await c.connect();await c.query('BEGIN READ ONLY');rows=(await c.query('SELECT * FROM "Stock" ORDER BY ticker')).rows;await c.query('ROLLBACK');}finally{await c.end();}
 const fields=['netIncome','totalDebt','cashAndEquivalents','freeCashFlow','sector','industry','analystRating','lastEarningsDate','float','marketCap','price','trailingPE','priceToBook'];
 const present=(r,k)=> typeof r[k]==='number'?Number.isFinite(r[k])&&(!['marketCap','price','float'].includes(k)||r[k]>0):typeof r[k]==='string'&&r[k].trim()!==''&&!['N/A','—'].includes(r[k]);
 const core=fields.slice(0,4);
 const summarize=rs=>({count:rs.length,fields:Object.fromEntries(fields.map(k=>[k,rs.filter(r=>present(r,k)).length])),allFour:rs.filter(r=>core.every(k=>present(r,k))).length,noneFour:rs.filter(r=>core.every(k=>!present(r,k))).length});
 const groups={all:rows,speculative:rows.filter(r=>r.rank>0),quality:rows.filter(r=>r.qualityRank>0),value:rows.filter(r=>r.turnaroundRank>0)};
 const sample=[];const add=r=>{if(r&&!sample.some(x=>x.ticker===r.ticker)&&sample.length<40)sample.push(r)};
 // Reproducible diagnostic cohort across coverage states and cap bands.
 for(const rs of Object.values(groups).slice(1))for(const r of [...rs].sort((a,b)=>(a.qualityRank||a.turnaroundRank||a.rank)-(b.qualityRank||b.turnaroundRank||b.rank)).slice(0,5))add(r);
 for(const predicate of [r=>r.marketCap<=0,r=>r.marketCap>0&&r.marketCap<2e9,r=>r.marketCap>=2e9&&r.marketCap<1e10,r=>r.marketCap>=1e10]) for(const n of [0,1,2,3,4])for(const r of rows.filter(r=>predicate(r)&&core.filter(k=>present(r,k)).length===n).slice(0,3))add(r);
 for(const r of rows)add(r);
 const result={capturedAt:new Date().toISOString(),definition:'Presence only, not accuracy or freshness. Zero is valid for financial statement values. Null, empty and N/A metadata are missing. Lens membership overlaps.',coverage:Object.fromEntries(Object.entries(groups).map(([k,rs])=>[k,summarize(rs)])),sample:sample.map(r=>({ticker:r.ticker,marketCap:r.marketCap,sector:r.sector||null,missing:fields.filter(k=>!present(r,k)),corePresent:core.filter(k=>present(r,k)),freshness:'Unknown: no statement period/source stored'})),tickerCoverage:rows.map(r=>({ticker:r.ticker,missing:fields.filter(k=>!present(r,k)),corePresent:core.filter(k=>present(r,k))}))};
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/data-coverage.json',JSON.stringify(result,null,2));
 let md='# Stock data coverage audit\n\nCaptured '+result.capturedAt+' from the connected database using a read-only transaction. No provider refresh or database writes.\n\n'+result.definition+'\n\n| Field | All | Speculative | Quality | Value |\n|---|---:|---:|---:|---:|\n';
 for(const k of fields)md+='| '+k+' | '+Object.values(result.coverage).map(s=>s.fields[k]+'/'+s.count).join(' | ')+' |\n';
 md+='\nAll four stored financial fields present: '+result.coverage.all.allFour+'/'+rows.length+'. None present: '+result.coverage.all.noneFour+'/'+rows.length+'. Presence does not establish full-score eligibility.\n\n## 40-ticker diagnostic cohort\n\nSelected deterministically across lenses, coverage states and recorded market-cap bands; not sector representative because sector metadata is mostly absent. Zero market cap means unknown, not micro-cap.\n\n| Ticker | Market cap recorded | Financial fields present | Missing fields |\n|---|---:|---|---|\n';
 for(const r of result.sample)md+='| '+r.ticker+' | '+r.marketCap+' | '+(r.corePresent.join(', ')||'None')+' | '+r.missing.join(', ')+' |\n';
 fs.writeFileSync('reports/data-coverage.md',md);console.log(JSON.stringify({capturedAt:result.capturedAt,coverage:result.coverage,sample:result.sample.map(r=>r.ticker)},null,2));
})().catch(()=>{console.error('Coverage audit failed; credentials omitted');process.exitCode=1;});
