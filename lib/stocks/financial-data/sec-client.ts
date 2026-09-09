import { parseCompanyFacts, type CompanyFacts } from './sec-parser';
const USER_AGENT = process.env.SEC_USER_AGENT || 'polymarket-app financial-research https://github.com/andreg2756-art/polymarket-app';
let lastRequestAt = 0;
export class SourceError extends Error {
 constructor(public code: string) { super(code); }
}
async function secJSON<T>(url: string): Promise<T> {
 const delay = Math.max(0, 550 - (Date.now()-lastRequestAt));
 if(delay) await new Promise(r=>setTimeout(r,delay));
 lastRequestAt=Date.now();
 let response: Response;
 try { response=await fetch(url,{headers:{'User-Agent':USER_AGENT},signal:AbortSignal.timeout(12000),cache:'no-store'}); }
 catch {throw new SourceError('SEC_NETWORK_OR_TIMEOUT');}
 if(!response.ok) throw new SourceError(`SEC_HTTP_${response.status}`);
 try {return await response.json() as T;}catch{throw new SourceError('SEC_INVALID_JSON');}
}
interface TickerEntry {cik_str:number;ticker:string;title:string}
let tickerCache: {at:number;entries:TickerEntry[]}|null=null;
export async function lookupCompany(ticker:string) {
 if(!tickerCache || Date.now()-tickerCache.at>86400000) {
  const data=await secJSON<Record<string,TickerEntry>>('https://www.sec.gov/files/company_tickers.json');
  tickerCache={at:Date.now(),entries:Object.values(data)};
 }
 const normalized=ticker.toUpperCase().replaceAll('.','-');
 return tickerCache.entries.find(e=>e.ticker.toUpperCase().replaceAll('.','-')===normalized)??null;
}
export async function fetchSECFinancials(ticker:string) {
 const company=await lookupCompany(ticker);
 if(!company) throw new SourceError('SEC_TICKER_NOT_FOUND');
 const cik=String(company.cik_str).padStart(10,'0');
 const facts=await secJSON<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
 if(Number(facts.cik)!==Number(cik)) throw new SourceError('SEC_COMPANY_ID_MISMATCH');
 const bundle=parseCompanyFacts(facts);
 if(!bundle) throw new SourceError('SEC_NO_SUPPORTED_ANNUAL_USD_FACTS');
 return bundle;
}
