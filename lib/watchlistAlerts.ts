import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify";

/**
 * Checks each watchlist item with a target set against the stock's latest price/score,
 * comparing against the prior snapshot so an alert fires once on crossing rather than
 * every day the value happens to sit past the target.
 */
export async function checkWatchlistAlerts() {
  const items = await prisma.watchlistItem.findMany({
    where: { OR: [{ targetPrice: { not: null } }, { targetScore: { not: null } }] },
    include: { stock: true },
  });

  for (const item of items) {
    const prevSnapshot = await prisma.stockSnapshot.findFirst({
      where: { ticker: item.ticker },
      orderBy: { createdAt: "desc" },
      skip: 1, // the most recent snapshot is the one just inserted by this refresh run
    });

    const prevPrice = prevSnapshot?.price ?? item.stock.price;
    const prevScore = prevSnapshot?.bullishScore ?? item.stock.bullishScore;

    const priceCrossed =
      item.targetPrice !== null &&
      ((prevPrice < item.targetPrice && item.stock.price >= item.targetPrice) ||
        (prevPrice > item.targetPrice && item.stock.price <= item.targetPrice));

    const scoreCrossed =
      item.targetScore !== null &&
      prevScore < item.targetScore &&
      item.stock.bullishScore >= item.targetScore;

    if (!priceCrossed && !scoreCrossed) continue;

    const reasons: string[] = [];
    if (priceCrossed) reasons.push(`price crossed target of $${item.targetPrice!.toFixed(2)} (now $${item.stock.price.toFixed(2)})`);
    if (scoreCrossed) reasons.push(`score crossed target of ${item.targetScore} (now ${item.stock.bullishScore.toFixed(0)})`);

    await sendEmail({
      subject: `Watchlist alert: ${item.ticker}`,
      html: `<p><strong>${item.ticker}</strong> (${item.stock.name}) ${reasons.join(" and ")}.</p>`,
    });

    await prisma.watchlistItem.update({
      where: { id: item.id },
      data: { lastAlertedAt: new Date() },
    });
  }
}
