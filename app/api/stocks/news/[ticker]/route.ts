import { NextResponse } from "next/server";

interface YahooNewsItem {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  summary?: string;
}

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5&quotesCount=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    const news: YahooNewsItem[] = data?.news ?? [];

    return NextResponse.json(
      news.slice(0, 4).map((n) => ({
        title: n.title ?? "",
        publisher: n.publisher ?? "",
        link: n.link ?? "",
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toLocaleDateString()
          : "",
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
