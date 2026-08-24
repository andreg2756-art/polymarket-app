export interface LeaderboardEntry {
  proxyWallet: string;
  name?: string;
  username?: string;
  displayName?: string;
  userName?: string;
  pnl?: number;
  volume?: number;
  vol?: number;
  rank?: number;
}

export interface PolyPosition {
  conditionId?: string;
  market?: string;
  marketTitle?: string;
  title?: string;
  slug?: string;
  outcome?: string;
  outcomeName?: string;
  side?: string;
  currentValue?: number;
  value?: number;
  size?: number;
  shares?: number;
  cashPnl?: number;
  pnl?: number;
  volume?: number;
  totalBought?: number;
  category?: string;
  asset?: string;
}

export interface NormalizedTrader {
  proxyWallet: string;
  username: string;
  monthlyPnl: number;
  monthlyVolume: number;
  rank: number;
}

export interface NormalizedPosition {
  proxyWallet: string;
  username: string;
  conditionId: string;
  marketTitle: string;
  slug: string;
  outcome: string;
  category: string;
  currentValue: number;
  size: number;
  cashPnl: number;
  volume: number;
}

export interface GroupedMarket {
  conditionId: string;
  marketTitle: string;
  outcome: string;
  category: string;
  holderCount: number;
  totalCurrentValue: number;
  totalSize: number;
  totalCashPnl: number;
  avgCashPnl: number;
  totalVolume: number;
  consensusScore: number;
  holders: { proxyWallet: string; username: string; currentValue: number; size: number; cashPnl: number }[];
}

export interface SnapshotChange {
  conditionId: string;
  marketTitle: string;
  outcome: string;
  category: string;
  holderCountDelta: number;
  currentValueDelta: number;
  prevHolderCount: number;
  newHolderCount: number;
  prevCurrentValue: number;
  newCurrentValue: number;
  consensusScore: number;
}
