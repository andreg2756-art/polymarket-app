// Provider allowance is shared across processes. Keep headroom below the observed
// 40-request account limit; do not increase this to speed up a backfill.
export const FINANCIAL_CONFIG = {
 businessQuantDailyLimit: 24,
 batchSize: 8,
 maintenanceSlots: 2,
 statementCacheDays: 7,
 unsupportedRetryDays: 14,
 maxRunMs: 180_000,
};
export const businessQuantBudgetId = (now=new Date()) => `BUSINESS_QUANT:${now.toISOString().slice(0,10)}`;
export function nextBudgetWindow(now=new Date()):Date {
 return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1,0,0));
}
