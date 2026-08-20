import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify";

export async function GET() {
  const stocks = await prisma.stock.findMany({
    orderBy: { bullishScore: "desc" },
    take: 10,
    include: { news: { orderBy: { publishedAt: "desc" }, take: 1 } },
  });

  if (stocks.length === 0) {
    return NextResponse.json({ sent: false, count: 0, message: "No stocks in the screener yet." });
  }

  const rows = stocks
    .map((s) => {
      const headline = s.news[0]?.headline;
      return `
        <tr>
          <td style="padding:6px 12px;">${s.ticker}</td>
          <td style="padding:6px 12px;">${s.name}</td>
          <td style="padding:6px 12px;">${s.bullishScore.toFixed(0)}</td>
          <td style="padding:6px 12px;">$${s.price.toFixed(2)}</td>
          <td style="padding:6px 12px;">${s.change1M >= 0 ? "+" : ""}${s.change1M.toFixed(1)}%</td>
          <td style="padding:6px 12px;">${headline ?? "—"}</td>
        </tr>`;
    })
    .join("");

  const html = `
    <h2>Today's Top 10 Stock Ideas</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <thead>
        <tr style="text-align:left;border-bottom:1px solid #ccc;">
          <th style="padding:6px 12px;">Ticker</th>
          <th style="padding:6px 12px;">Name</th>
          <th style="padding:6px 12px;">Score</th>
          <th style="padding:6px 12px;">Price</th>
          <th style="padding:6px 12px;">1M</th>
          <th style="padding:6px 12px;">Latest News</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  await sendEmail({ subject: "Daily Stock Ideas Digest", html });

  return NextResponse.json({ sent: true, count: stocks.length });
}
