import { NextResponse } from "next/server";
import { runMarketDiscovery } from "@/lib/catalysts/market-discovery/discover";
import { MARKET_IMPORTANCE_FORMULA_VERSION } from "@/lib/catalysts/market-discovery/types";
import { captureServerException } from "@/lib/posthog-server";

// Debug/proof-of-concept endpoint for the market-discovery pipeline (spec
// Part 40's "first prove the system can produce a useful table" — this is
// that table, as JSON rather than a UI page, since the spec explicitly
// says not to start with UI work). Not yet wired into the live Catalysts
// page or the CATALYST_V1 engine — that's Phase 12, connecting ACCEPTED
// markets into the existing stock-mapping pipeline, which comes after this
// output has been reviewed.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 300, 1000);
  const dispositionFilter = searchParams.get("disposition")?.toUpperCase();

  try {
    const evaluated = await runMarketDiscovery(limit);
    evaluated.sort((a, b) => b.eventImportanceScore - a.eventImportanceScore);

    const filtered = dispositionFilter ? evaluated.filter((m) => m.disposition === dispositionFilter) : evaluated;

    const byDisposition: Record<string, number> = {};
    for (const m of evaluated) byDisposition[m.disposition] = (byDisposition[m.disposition] ?? 0) + 1;

    return NextResponse.json({
      formulaVersion: MARKET_IMPORTANCE_FORMULA_VERSION,
      evaluatedCount: evaluated.length,
      byDisposition,
      markets: filtered,
    });
  } catch (err) {
    await captureServerException(err, { route: "/api/catalysts/market-discovery" });
    return NextResponse.json({ error: "Failed to run market discovery" }, { status: 500 });
  }
}
