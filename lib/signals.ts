import type { PositionSnapshot, MarketPositionGroup } from "@prisma/client";

const WHALE_MOVE_MIN_VALUE_DELTA = 5000;
const WHALE_MOVE_MIN_PCT_DELTA = 0.25;
const CROWDED_HOLDER_THRESHOLD = 3;

export interface WhaleMove {
  proxyWallet: string;
  username: string | null;
  conditionId: string;
  marketTitle: string;
  outcome: string;
  prevSize: number;
  nextSize: number;
  sizeDelta: number;
  prevValue: number;
  nextValue: number;
  valueDelta: number;
}

export function detectWhaleMoves(
  prevPositions: PositionSnapshot[],
  nextPositions: PositionSnapshot[]
): WhaleMove[] {
  const prevMap = new Map(
    prevPositions.map((p) => [`${p.proxyWallet}||${p.conditionId}||${p.outcome}`, p])
  );

  const moves: WhaleMove[] = [];
  for (const next of nextPositions) {
    const key = `${next.proxyWallet}||${next.conditionId}||${next.outcome}`;
    const prev = prevMap.get(key);
    const prevSize = prev?.size ?? 0;
    const prevValue = prev?.currentValue ?? 0;
    const sizeDelta = next.size - prevSize;
    const valueDelta = next.currentValue - prevValue;
    const pctDelta = prevValue > 0 ? Math.abs(valueDelta) / prevValue : Infinity;

    if (Math.abs(valueDelta) >= WHALE_MOVE_MIN_VALUE_DELTA || pctDelta >= WHALE_MOVE_MIN_PCT_DELTA) {
      moves.push({
        proxyWallet: next.proxyWallet,
        username: next.username,
        conditionId: next.conditionId,
        marketTitle: next.marketTitle,
        outcome: next.outcome,
        prevSize,
        nextSize: next.size,
        sizeDelta,
        prevValue,
        nextValue: next.currentValue,
        valueDelta,
      });
    }
  }

  return moves.sort((a, b) => Math.abs(b.valueDelta) - Math.abs(a.valueDelta));
}

export interface NewlyCrowdedMarket {
  conditionId: string;
  marketTitle: string;
  outcome: string;
  category: string | null;
  prevHolderCount: number;
  holderCount: number;
}

export function detectNewlyCrowded(
  prevGroups: MarketPositionGroup[],
  nextGroups: MarketPositionGroup[]
): NewlyCrowdedMarket[] {
  const prevMap = new Map(prevGroups.map((g) => [`${g.conditionId}||${g.outcome}`, g]));

  const newlyCrowded: NewlyCrowdedMarket[] = [];
  for (const next of nextGroups) {
    if (next.holderCount < CROWDED_HOLDER_THRESHOLD) continue;
    const prev = prevMap.get(`${next.conditionId}||${next.outcome}`);
    const prevHolderCount = prev?.holderCount ?? 0;
    if (prevHolderCount < CROWDED_HOLDER_THRESHOLD) {
      newlyCrowded.push({
        conditionId: next.conditionId,
        marketTitle: next.marketTitle,
        outcome: next.outcome,
        category: next.category,
        prevHolderCount,
        holderCount: next.holderCount,
      });
    }
  }

  return newlyCrowded.sort((a, b) => b.holderCount - a.holderCount);
}
