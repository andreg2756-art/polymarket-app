import type { StatementProfile, SectorMetrics } from "./financial-data/applicability";
// Financial acquisition runs in a bounded background queue. Scans only read
// period-aware records; legacy numbers without provenance are not score inputs.
import type { Values } from './financial-data/model';
import { emptyValues } from './financial-data/model';
import { loadStoredFundamentals } from './financial-data/store';
export interface Fundamentals extends Values {
 statementProfile?: StatementProfile;
 sectorMetrics?: SectorMetrics;
 mappingVersion?: string;
 revenueGrowthYoY?: number | null;
 periodType?: 'ANNUAL'|'QUARTER'|'TTM';
 periodEnd?: string;
 currency?: string;
 source?: string;
 fetchedAt?: string;
 stale?: boolean;
}
export async function getFundamentals(ticker:string):Promise<Fundamentals> {
 return (await loadStoredFundamentals([ticker])).get(ticker)??emptyValues();
}
