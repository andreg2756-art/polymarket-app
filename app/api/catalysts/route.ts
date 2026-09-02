import { NextResponse } from "next/server";
import { MACRO_THEMES } from "@/lib/catalysts/themes";
import { fetchMarketPrices } from "@/lib/catalysts/polymarket";

export async function GET() {
  const allConditionIds = MACRO_THEMES.flatMap((t) => t.markets.map((m) => m.conditionId));
  const prices = await fetchMarketPrices(allConditionIds);

  const themes = MACRO_THEMES.map((theme) => ({
    ...theme,
    markets: theme.markets.map((m) => ({
      ...m,
      live: prices.get(m.conditionId) ?? null,
    })),
  }));

  return NextResponse.json({ themes });
}
