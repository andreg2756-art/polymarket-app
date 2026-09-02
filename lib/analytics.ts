import type { NormalizedPosition, GroupedMarket } from "./types";

export function groupPositions(positions: NormalizedPosition[]): GroupedMarket[] {
  const map = new Map<string, GroupedMarket>();

  for (const p of positions) {
    const key = `${p.conditionId}||${p.outcome}`;
    if (!map.has(key)) {
      map.set(key, {
        conditionId: p.conditionId,
        marketTitle: p.marketTitle,
        outcome: p.outcome,
        category: p.category,
        holderCount: 0,
        totalCurrentValue: 0,
        totalSize: 0,
        totalCashPnl: 0,
        avgCashPnl: 0,
        totalVolume: 0,
        consensusScore: 0,
        holders: [],
      });
    }
    const g = map.get(key)!;
    g.holderCount++;
    g.totalCurrentValue += p.currentValue;
    g.totalSize += p.size;
    g.totalCashPnl += p.cashPnl;
    g.totalVolume += p.volume;
    g.holders.push({
      proxyWallet: p.proxyWallet,
      username: p.username,
      currentValue: p.currentValue,
      size: p.size,
      cashPnl: p.cashPnl,
    });
  }

  const groups = Array.from(map.values());
  groups.forEach((g) => {
    g.avgCashPnl = g.holderCount > 0 ? g.totalCashPnl / g.holderCount : 0;
  });

  const maxValue = Math.max(...groups.map((g) => g.totalCurrentValue), 1);
  const maxSize = Math.max(...groups.map((g) => g.totalSize), 1);
  const maxPnl = Math.max(...groups.map((g) => g.avgCashPnl), 1);

  for (const g of groups) {
    const holderScore = (g.holderCount / 100) * 40;
    const capitalScore = (g.totalCurrentValue / maxValue) * 30;
    const sizeScore = (g.totalSize / maxSize) * 20;
    const pnlScore = (Math.max(g.avgCashPnl, 0) / maxPnl) * 10;
    g.consensusScore = Math.round(holderScore + capitalScore + sizeScore + pnlScore);
  }

  return groups.sort((a, b) => b.holderCount - a.holderCount || b.totalCurrentValue - a.totalCurrentValue);
}

// Shared by app/api/dashboard and app/api/markets, which both need to diff
// this run's MarketPositionGroups against the previous run's — previously
// each route built its own conditionId||outcome map and delta object
// independently.
type GroupKey = { conditionId: string; outcome: string };

export function buildPrevGroupMap<T extends GroupKey>(prevGroups: T[]): Map<string, T> {
  return new Map(prevGroups.map((g) => [`${g.conditionId}||${g.outcome}`, g]));
}

export function withGroupDelta<T extends GroupKey & { holderCount: number; totalCurrentValue: number }>(
  group: T,
  prevMap: Map<string, { holderCount: number; totalCurrentValue: number }>
): T & { holderCountDelta: number; currentValueDelta: number } {
  const p = prevMap.get(`${group.conditionId}||${group.outcome}`);
  return {
    ...group,
    holderCountDelta: group.holderCount - (p?.holderCount ?? 0),
    currentValueDelta: group.totalCurrentValue - (p?.totalCurrentValue ?? 0),
  };
}

export function formatUSD(n: number): string {
  if (!isFinite(n)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatNum(n: number, decimals = 2): string {
  if (!isFinite(n)) return "N/A";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
