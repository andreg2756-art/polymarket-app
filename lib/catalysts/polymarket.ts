// Live market price lookup from Polymarket's public Gamma API — separate
// from lib/polymarket.ts, which only pulls trader/position data (no
// probability/price field exists anywhere in that pipeline). No API key:
// this is the same public-data trust level already used elsewhere in the
// app.
//
// v1 scope: current price only, no history. A "7-day change" needs a
// stored time series (see the catalysts feature plan) — deliberately not
// built yet so the theme/exposure content can be reviewed first.

const MARKETS_URL = "https://gamma-api.polymarket.com/markets";

export interface LiveMarketPrice {
  conditionId: string;
  question: string;
  outcomes: string[];
  prices: number[]; // parallel to outcomes, each 0-1
  volume24hr: number;
  updatedAt: string | null;
  closed: boolean;
}

// The Gamma API only returns matches for repeated `condition_ids=` query
// params, NOT a single comma-joined value — confirmed by direct testing
// (comma-joined returns zero results).
//
// `closed` is a hard boolean filter, not an "include these too" flag:
// omitting it returns only still-open markets, and passing `closed=true`
// returns ONLY resolved ones (confirmed by testing both against a known-open
// and a known-closed conditionId — each excludes the other entirely). A
// theme can reference a mix of open and already-resolved markets (e.g. a
// past month's jobs report), so both are queried and merged.
export async function fetchMarketPrices(conditionIds: string[]): Promise<Map<string, LiveMarketPrice>> {
  const result = new Map<string, LiveMarketPrice>();
  if (conditionIds.length === 0) return result;

  const [openMarkets, closedMarkets] = await Promise.all([
    fetchByConditionIds(conditionIds, false),
    fetchByConditionIds(conditionIds, true),
  ]);
  for (const m of [...openMarkets, ...closedMarkets]) {
    if (!m.conditionId) continue;
    const outcomes = safeParseArray(m.outcomes);
    const prices = safeParseArray(m.outcomePrices).map((p: string) => Number(p));
    result.set(m.conditionId, {
      conditionId: m.conditionId,
      question: m.question ?? "",
      outcomes,
      prices,
      volume24hr: typeof m.volume24hr === "number" ? m.volume24hr : 0,
      updatedAt: m.updatedAt ?? null,
      closed: m.closed === true,
    });
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchByConditionIds(conditionIds: string[], closed: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  for (const id of conditionIds) params.append("condition_ids", id);
  params.set("closed", String(closed));

  try {
    const res = await fetch(`${MARKETS_URL}?${params}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Swallow — the catalysts route falls back to showing markets without
    // a live price rather than failing the whole page.
    return [];
  }
}

// Gamma API returns `outcomes`/`outcomePrices` as JSON-encoded strings
// (e.g. '["Yes", "No"]'), not actual arrays.
function safeParseArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
