import { NextResponse } from 'next/server';
import { runFinancialBackfill } from '@/lib/stocks/financial-data/backfill';
export const maxDuration=300;
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret)return NextResponse.json({error:'Backfill scheduler not configured'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 return NextResponse.json(await runFinancialBackfill());
}
