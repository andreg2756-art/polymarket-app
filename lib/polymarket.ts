import type { LeaderboardEntry, PolyPosition, NormalizedTrader, NormalizedPosition } from "./types";

const LEADERBOARD_URL =
  "https://data-api.polymarket.com/v1/leaderboard?timePeriod=MONTH&orderBy=PNL&limit=100";
const POSITIONS_URL = "https://data-api.polymarket.com/positions";

function normalize<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    for (const key of ["data", "results", "users", "leaderboard", "positions"]) {
      const v = (raw as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

async function fetchWithRetry(url: string, retries = 3): Promise<unknown> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 0 },
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

export async function fetchLeaderboard(): Promise<NormalizedTrader[]> {
  const raw = await fetchWithRetry(LEADERBOARD_URL);
  const entries = normalize<LeaderboardEntry>(raw);
  return entries.map((e, i) => ({
    proxyWallet: e.proxyWallet ?? "",
    username: e.userName ?? e.name ?? e.username ?? e.displayName ?? e.proxyWallet?.slice(0, 8) ?? "Unknown",
    monthlyPnl: typeof e.pnl === "number" ? e.pnl : 0,
    monthlyVolume: typeof e.vol === "number" ? e.vol : typeof e.volume === "number" ? e.volume : 0,
    rank: typeof e.rank === "number" ? e.rank : i + 1,
  })).filter((t) => t.proxyWallet);
}

export async function fetchPositions(
  proxyWallet: string,
  username: string
): Promise<NormalizedPosition[]> {
  const url = `${POSITIONS_URL}?user=${proxyWallet}&limit=500&sortBy=CURRENT&sortDirection=DESC`;
  const raw = await fetchWithRetry(url);
  const entries = normalize<PolyPosition>(raw);
  return entries.map((p) => ({
    proxyWallet,
    username,
    conditionId: p.conditionId ?? p.asset ?? "",
    marketTitle: p.marketTitle ?? p.market ?? p.title ?? "Unknown Market",
    slug: p.slug ?? "",
    outcome: p.outcome ?? p.outcomeName ?? p.side ?? "Unknown",
    category: p.category ?? "",
    currentValue: toNum(p.currentValue ?? p.value),
    size: toNum(p.size ?? p.shares),
    cashPnl: toNum(p.cashPnl ?? p.pnl),
    volume: toNum(p.volume ?? p.totalBought),
  })).filter((p) => p.conditionId && p.currentValue > 0);
}

function toNum(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
