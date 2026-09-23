// A reporting-period end is not an earnings announcement date.
export function hasRecentEarningsPeriod(period: string | null | undefined, now = Date.now()): boolean {
  if (!period) return false;
  const age = (now - Date.parse(period)) / 86_400_000;
  return Number.isFinite(age) && age >= 0 && age <= 200;
}
