require('../scripts/register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {calcLastEarnings}=require('../lib/stockSupplementalData.ts');
const {hasRecentEarningsPeriod}=require('../lib/stocks/earningsCoverage.ts');
const {computeDataConfidence}=require('../lib/stocks/dataConfidence.ts');
const {mapSettled}=require('../lib/mapSettled.ts');
const {fetchShortInterest}=require('../lib/stocks/massive.ts');
const quarter=(days)=>({raw:Math.floor((Date.now()-days*86400000)/1000)});
test('latest reported earnings are selected regardless of provider order; future/unreported excluded',()=>{
 const older={quarter:quarter(300),epsActual:{raw:1}};
 const latest={quarter:quarter(90),epsActual:{raw:2}};
 const future={quarter:quarter(-30),epsActual:{raw:99}};
 const unreported={quarter:quarter(10),epsActual:{raw:null}};
 for(const history of [[older,latest,future,unreported],[future,latest,older]]){
  const result=calcLastEarnings({earningsHistory:{history}});
  assert.match(result.value,/Period ended/);assert.match(result.value,/EPS \$2\.00/);assert.doesNotMatch(result.value,/stale/);
 }
 assert.match(calcLastEarnings({earningsHistory:{history:[older]}}).value,/stale/);
});
test('reporting-period coverage rejects stale, future, missing and invalid dates',()=>{
 const now=Date.parse('2026-09-22');
 assert.equal(hasRecentEarningsPeriod('2026-06-30',now),true);
 for(const p of ['2024-12-31','2027-01-01','invalid',null])assert.equal(hasRecentEarningsPeriod(p,now),false);
});
test('zero is available data, but risk-quality score cannot stand in for float',()=>{
 const s={volumeScore:{score:0},revenueGrowthScore:{value:0},earningsRiskScore:{value:0},riskQualityScore:{score:80},newsSentiment:{score:0}};
 const r=computeDataConfidence(s,null,100);
 for(const name of ['Price / Volume','Revenue','Earnings','News Sentiment'])assert.ok(r.availableFactors.includes(name));
 assert.ok(r.missingFactors.includes('Float (10%)'));
 assert.ok(computeDataConfidence(s,null,100,{float:true}).availableFactors.includes('Float'));
 s.newsSentiment.score=NaN;assert.ok(computeDataConfidence(s,null,0).missingFactors.includes('News Sentiment (10%)'));
 assert.ok(computeDataConfidence(s,null,0).missingFactors.includes('Price / Volume (20%)'));
});
test('supplemental work stays bounded, retains input order, and isolates failures',async()=>{
 let active=0,max=0;
 const r=await mapSettled([0,1,2,3,4,5],2,async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;if(n===2)throw new Error('one ticker');return n;});
 assert.equal(max,2);assert.equal(r[2].status,'rejected');assert.equal(r[5].value,5);assert.equal(r[0].value,0);
});
test('Polygon avg_daily_volume is retained for days-to-cover derivation',async()=>{
 const original=global.fetch,key=process.env.POLYGON_API_KEY;process.env.POLYGON_API_KEY='test';
 global.fetch=async()=>({ok:true,json:async()=>({results:[{short_interest:1000,avg_daily_volume:200,settlement_date:'2026-09-15'}]})});
 try{const r=await fetchShortInterest('TEST');assert.equal(r.averageDailyVolume,200);assert.equal(r.sharesShort,1000);}finally{global.fetch=original;if(key===undefined)delete process.env.POLYGON_API_KEY;else process.env.POLYGON_API_KEY=key;}
});

test('earnings period dates do not shift into the previous day in US time zones',()=>{
 const result=calcLastEarnings({earningsHistory:{history:[{quarter:{raw:Date.parse('2026-06-30T00:00:00Z')/1000},epsActual:{raw:2}}]}});
 assert.match(result.value,/Jun 30, 2026/);
});
