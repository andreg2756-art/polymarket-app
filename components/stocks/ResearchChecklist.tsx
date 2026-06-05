"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  ticker: string;
  name: string;
  price: number;
  change1M: number;
  change3M: number;
  relativeVolume: number;
  marketCap: number;
  bullishScore: number;
  lastEarningsDate: string | null;
  insiderBuying: number;
  shortInterest: number | null;
  revenueGrowth: number;
}

interface NewsItem { title: string; publisher: string; link: string; publishedAt: string }

function Row({ label, value, status }: { label: string; value: string; status: "ok" | "warn" | "neutral" }) {
  const color = status === "ok" ? "text-emerald-400" : status === "warn" ? "text-red-400" : "text-gray-400";
  const icon = status === "ok" ? "✓" : status === "warn" ? "⚠" : "—";
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 w-36 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${color}`}>{icon} {value}</span>
    </div>
  );
}

export default function ResearchChecklist(props: Props) {
  const { ticker, name, price, change1M, change3M, relativeVolume, marketCap,
    bullishScore, lastEarningsDate, insiderBuying, shortInterest, revenueGrowth } = props;

  const [open, setOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setNewsLoading(true);
    fetch(`/api/stocks/news/${ticker}`)
      .then((r) => r.json())
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [open, ticker]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const fmtCap = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`;
  const trendStatus = change1M > 0 && change3M > 0 ? "ok" : change1M < 0 && change3M < 0 ? "warn" : "neutral";
  const volStatus = relativeVolume > 1.5 ? "ok" : relativeVolume < 0.8 ? "warn" : "neutral";
  const capStatus = marketCap >= 500e6 ? "ok" : marketCap >= 200e6 ? "neutral" : "warn";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:border-orange-600 hover:text-orange-400 transition-colors whitespace-nowrap"
      >
        Research Checklist
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div ref={modalRef} className="bg-gray-950 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-base font-bold text-white">{ticker} — Research Checklist</h2>
                <p className="text-xs text-gray-500">{name} · ${price.toFixed(2)}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="px-5 py-4 space-y-5">

              {/* Price & Trend */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Chart Trend</h3>
                <Row label="1-Month Return" value={`${change1M >= 0 ? "+" : ""}${change1M.toFixed(1)}%`} status={change1M > 5 ? "ok" : change1M < -5 ? "warn" : "neutral"} />
                <Row label="3-Month Return" value={`${change3M >= 0 ? "+" : ""}${change3M.toFixed(1)}%`} status={change3M > 10 ? "ok" : change3M < -15 ? "warn" : "neutral"} />
                <Row label="Overall Trend" value={trendStatus === "ok" ? "Both timeframes positive" : trendStatus === "warn" ? "Both timeframes negative" : "Mixed signals"} status={trendStatus} />
                {/* TODO: Add 50-day and 200-day MA from price history data */}
                <Row label="50-Day MA" value="N/A — requires price history" status="neutral" />
                <Row label="200-Day MA" value="N/A — requires price history" status="neutral" />
              </section>

              {/* Fundamentals */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Fundamentals</h3>
                <Row label="Market Cap" value={fmtCap(marketCap)} status={capStatus} />
                <Row label="Revenue Growth" value={revenueGrowth > 0 ? `+${revenueGrowth.toFixed(1)}%` : revenueGrowth === 0 ? "N/A" : `${revenueGrowth.toFixed(1)}%`} status={revenueGrowth > 15 ? "ok" : revenueGrowth < 0 ? "warn" : "neutral"} />
                <Row label="Bullish Score" value={`${bullishScore}/100`} status={bullishScore >= 60 ? "ok" : bullishScore < 30 ? "warn" : "neutral"} />
                {/* TODO: Pull cash runway from balance sheet API */}
                <Row label="Cash Runway" value="N/A — connect balance sheet API" status="neutral" />
                {/* TODO: Pull debt-to-equity from financials API */}
                <Row label="Debt Risk" value="N/A — connect financials API" status="neutral" />
              </section>

              {/* Earnings */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Earnings</h3>
                <Row label="Last Earnings" value={lastEarningsDate ?? "N/A"} status="neutral" />
                {/* TODO: Pull next earnings date from earnings calendar API */}
                <Row label="Next Earnings" value="N/A — connect earnings calendar" status="neutral" />
              </section>

              {/* Liquidity */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Liquidity</h3>
                <Row label="Relative Volume" value={`${relativeVolume.toFixed(1)}x avg`} status={volStatus} />
                {/* TODO: Pull average daily volume from quote API */}
                <Row label="Avg Daily Volume" value="N/A — connect quote API" status="neutral" />
                <Row label="Short Interest" value={shortInterest != null ? `${shortInterest.toFixed(1)}%` : "N/A"} status={shortInterest != null && shortInterest > 15 ? "warn" : "neutral"} />
              </section>

              {/* Insider Activity */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Insider Activity</h3>
                <Row label="Insider Buying" value={insiderBuying > 0 ? `$${(insiderBuying / 1000).toFixed(0)}K` : "None detected"} status={insiderBuying > 0 ? "ok" : "neutral"} />
                {/* TODO: Pull insider selling from SEC filings */}
                <Row label="Insider Selling" value="N/A — connect SEC filings" status="neutral" />
              </section>

              {/* Analyst Coverage */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Analyst Coverage</h3>
                {/* TODO: Connect analyst ratings API (requires paid FMP plan or similar) */}
                <Row label="Analyst Rating" value="N/A — connect analyst API" status="neutral" />
                <Row label="Recent Revisions" value="N/A — connect analyst API" status="neutral" />
              </section>

              {/* Recent News */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Recent Media</h3>
                {newsLoading && <p className="text-xs text-gray-600">Loading headlines...</p>}
                {!newsLoading && news.length === 0 && <p className="text-xs text-gray-600">No recent coverage found.</p>}
                {news.map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                    className="block py-1.5 border-b border-gray-800 last:border-0 hover:text-white transition-colors">
                    <p className="text-xs text-gray-300 leading-snug">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{n.publisher} · {n.publishedAt}</p>
                  </a>
                ))}
              </section>

              {/* Final Warning */}
              <div className="bg-orange-950/40 border border-orange-800 rounded-lg px-4 py-3">
                <p className="text-xs text-orange-300 font-semibold">⚠ Do not buy from the screener alone.</p>
                <p className="text-xs text-orange-400 mt-1 leading-relaxed">
                  Verify earnings dates, read recent filings, check liquidity, and assess valuation
                  independently before committing capital. Momentum can reverse sharply in small caps.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
