import { applyReviewedFacts } from "./reviewed-facts";
import { emptyValues, FINANCIAL_FIELDS, type FinancialBundle, type FinancialField, type FactEvidence } from './model';
export interface BQResponse {
 metadata?: {ticker?:string;currency?:string;cik?:number;frequency?:string;template?:string};
 data?: Record<string,BQNode>;
}
interface BQNode {sections?:Record<string,BQNode>;values?:{date:string;periodType:string;reportedValue?:{raw:number|null}}[];}
const fields: Partial<Record<FinancialField,[string,string]>>={
 netIncome:['IS','Consolidated Net Income (Quarter)'],revenue:['IS','Revenue (Quarter)'],operatingIncome:['IS','Operating Income (Quarter)'],grossProfit:['IS','Gross Profit (Quarter)'],
 cashAndEquivalents:['BS','Cash & Equivalents (Quarter)'],totalDebt:['BS','Total Debt (Quarter)'],freeCashFlow:['CF','Free Cash Flow (Quarter)'],
};
function find(tree:Record<string,BQNode>|undefined,name:string):BQNode|null {
 for(const [key,node] of Object.entries(tree??{})){if(key.toLowerCase()===name.toLowerCase())return node;const found=find(node.sections,name);if(found)return found;}return null;
}
export function parseBQStatements(ticker:string,responses:Partial<Record<string,BQResponse>>,now=new Date()):FinancialBundle|null {
 const entries=Object.entries(responses).filter((entry): entry is [string,BQResponse] => !!entry[1]).filter(([,r])=>r.metadata?.ticker===ticker && r.metadata.frequency==='Quarter' && /^[A-Z]{3}$/.test(r.metadata.currency??'') && !!r.metadata.cik);
 if(!entries.length)return null;
 const meta=entries[0][1].metadata!;
 const templates=new Set(entries.map(([,r])=>r.metadata?.template).filter(Boolean));
 const statementProfile=templates.size===1 && templates.has('banks_capitalmarkets')?'FINANCIAL_INSTITUTION':templates.size===1 && templates.has('general')?'OPERATING_COMPANY':'UNKNOWN';
 const compatible=Object.fromEntries(entries.filter(([,r])=>r.metadata?.currency===meta.currency&&r.metadata?.cik===meta.cik));
 const series=(statement:string,tag:string)=>[...(find(compatible[statement]?.data,tag)?.values??[])].filter(v=>v.periodType==='Quarter' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && Date.parse(v.date)<=now.getTime() && typeof v.reportedValue?.raw==='number' && Number.isFinite(v.reportedValue.raw)).sort((a,b)=>b.date.localeCompare(a.date));
 const dates=Object.values(fields).flatMap(([s,t])=>series(s,t).map(v=>v.date)).sort().reverse();
 if(!dates.length)return null;
 const end=dates[0], values=emptyValues(), evidence:FinancialBundle['evidence']={},missingReasons:FinancialBundle['missingReasons']={};
 const make=(tag:string,date:string,value:number):FactEvidence=>({tag,unit:meta.currency!,start:null,end:date,filed:null,accession:null,value});
 for(const [field,[statement,tag]] of Object.entries(fields) as [FinancialField,[string,string]][]) {
  const seq=series(statement,tag), current=seq.find(v=>v.date===end);
  const prev=seq.find(v=>{const days=(Date.parse(end)-Date.parse(v.date))/86400000;return days>=70&&days<=110;});
  if(!current)continue;
  const value=current.reportedValue!.raw!;
  // Flag suspicious balances rather than silently accepting previous outlier values.
  const prior=prev?.reportedValue?.raw;
  if(['cashAndEquivalents','totalDebt'].includes(field) && (value<0 || (prior && (Math.abs(value/prior)>15)))) {missingReasons[field]='Balance rejected: negative or >15x previous quarter; requires filing verification.';continue;}
  values[field]=value;evidence[field]=[make(tag,end,value)];
  const previousField={revenue:'prevRevenue',operatingIncome:'prevOperatingIncome',freeCashFlow:'prevFreeCashFlow'}[field as 'revenue'] as FinancialField|undefined;
  if(previousField && prev){values[previousField]=prev.reportedValue!.raw!;evidence[previousField]=[make(tag,prev.date,prev.reportedValue!.raw!)];}
 }
 if(values.netIncome===null) {
  const cashFlowIncome=series('CF','Net Income (Quarter)').find(v=>v.date===end);
  if(cashFlowIncome){values.netIncome=cashFlowIncome.reportedValue!.raw!;evidence.netIncome=[make('Cash flow statement: Net Income (Quarter)',end,values.netIncome)];}
 }
 const sectorMetrics=statementProfile==='FINANCIAL_INSTITUTION'?{
  interestIncome:series('IS','Interest Income - Total (Quarter)').find(v=>v.date===end)?.reportedValue?.raw??null,
  netInterestIncome:series('IS','Interest Income - Net (Quarter)').find(v=>v.date===end)?.reportedValue?.raw??null,
 }:undefined;
 for(const field of FINANCIAL_FIELDS)if(values[field]===null && !missingReasons[field])missingReasons[field]='Missing compatible quarterly statement/line item; not assumed zero.';
 const yearAgo=series('IS','Revenue (Quarter)').find(v=>{const days=(Date.parse(end)-Date.parse(v.date))/86400000;return days>=350&&days<=380;});
 const revenueGrowthYoY=values.revenue!==null && yearAgo?.reportedValue?.raw && yearAgo.reportedValue.raw>0 ? (values.revenue-yearAgo.reportedValue.raw)/yearAgo.reportedValue.raw*100 : null;
 return applyReviewedFacts(ticker,{mappingVersion:'FINANCIAL_MAPPING_V2',statementProfile,...(sectorMetrics?{sectorMetrics}:{}),revenueGrowthYoY,version:'FINANCIAL_DATA_V1',source:'BUSINESS_QUANT',cik:String(meta.cik).padStart(10,'0'),periodType:'QUARTER',periodEnd:end,currency:meta.currency!,values,evidence,missingReasons});
}
