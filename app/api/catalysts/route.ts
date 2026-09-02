import { NextResponse } from "next/server";
import { CATALYST_THEMES } from "@/lib/catalysts/themes";
import { fetchMarketPrices } from "@/lib/catalysts/polymarket";
import { computeTheme } from "@/lib/catalysts/compute";

export async function GET() {
  const allConditionIds = Array.from(
    new Set(
      CATALYST_THEMES.flatMap((t) => [
        ...t.event.outcomes.map((o) => o.conditionId),
        ...(t.event.contextMarkets ?? []).map((m) => m.conditionId),
      ])
    )
  );
  const prices = await fetchMarketPrices(allConditionIds);

  const themes = CATALYST_THEMES.map((theme) => {
    const computed = computeTheme(theme, prices);
    return {
      slug: theme.slug,
      title: theme.title,
      description: theme.description,
      alternativeScenarioNote: theme.alternativeScenarioNote,
      event: computed.event,
      signals: computed.signals,
    };
  });

  return NextResponse.json({ themes, formulaVersion: "CATALYST_V1" });
}
