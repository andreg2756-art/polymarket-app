import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCompanyProfile, getRecommendationTrends, summarizeRecommendation } from '@/lib/finnhub';
// Exact industry classifications only; unknown categories remain unmapped.
const SECTORS:Record<string,string>={
 'Semiconductors':'Technology','Software':'Technology','Technology':'Technology','Electronic Equipment, Instruments & Components':'Technology',
 'Banks':'Financial Services','Banking':'Financial Services','Insurance':'Financial Services','Financial Services':'Financial Services',
 'Biotechnology':'Healthcare','Pharmaceuticals':'Healthcare','Health Care Providers & Services':'Healthcare','Health Care':'Healthcare',
 'Oil, Gas & Consumable Fuels':'Energy','Oil & Gas':'Energy','Energy':'Energy',
 'Hotels, Restaurants & Leisure':'Consumer Cyclical','Retail':'Consumer Cyclical','Leisure Products':'Consumer Cyclical',
 'Food Products':'Consumer Defensive','Beverages':'Consumer Defensive',
 'Metals & Mining':'Basic Materials','Chemicals':'Basic Materials',
 'Aerospace & Defense':'Industrials','Machinery':'Industrials','Electrical Equipment':'Industrials',
 'Media':'Communication Services','Diversified Consumer Services':'Consumer Cyclical',
 'Commercial Services & Supplies':'Industrials','Textiles, Apparel & Luxury Goods':'Consumer Cyclical',
 'Real Estate':'Real Estate','Utilities':'Utilities','Telecommunication Services':'Communication Services',
};
export function sectorForIndustry(industry:string):string|null {return SECTORS[industry.trim()]??null;}
export async function enrichMetadata(ticker:string):Promise<string[]> {
 const failures:string[]=[];
 const [profile,trends]=await Promise.all([getCompanyProfile(ticker),getRecommendationTrends(ticker)]);
 if(profile?.ticker===ticker && profile.finnhubIndustry?.trim()) {
  const industry=profile.finnhubIndustry.trim();
  await prisma.stock.updateMany({where:{ticker},data:{industry,...(SECTORS[industry]?{sector:SECTORS[industry]}:{})}});
  await prisma.financialSourceResponse.upsert({where:{ticker_source_statement:{ticker,source:'FINNHUB',statement:'PROFILE'}},create:{ticker,source:'FINNHUB',statement:'PROFILE',payload:profile as unknown as Prisma.InputJsonValue},update:{payload:profile as unknown as Prisma.InputJsonValue,fetchedAt:new Date()}});
  if(!SECTORS[industry])failures.push('SECTOR_TAXONOMY_UNMAPPED');
 } else failures.push('FINNHUB_PROFILE_UNAVAILABLE');
 if(trends?.length) {
  const latest=[...trends].sort((a,b)=>b.period.localeCompare(a.period))[0];
  const recommendation=summarizeRecommendation(latest);
  if(recommendation.count>0)await prisma.stock.updateMany({where:{ticker},data:{analystRating:recommendation.rating,analystCount:recommendation.count}});
 }else failures.push('FINNHUB_RECOMMENDATIONS_UNAVAILABLE');
 return failures;
}
