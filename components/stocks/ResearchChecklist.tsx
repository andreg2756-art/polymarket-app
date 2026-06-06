"use client";
import { useEffect, useRef, useState } from "react";
import type { SupplementalStockData } from "@/lib/stockSupplementalData";

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

function val(metric: SupplementalStockData[keyof SupplementalStockData] | undefined): string {
  if (!metric || metric.value === null || metric.value === undefined) {
    return metric?.reason ? `N/A — ${metric.reason}` : "N/A";
  }
  return String(metric.value);
}

function sourceTag(metric: SupplementalStockData[keyof SupplementalStockData] | undefined) {
  if (!metric || metric.source === "unavailable") return null;
  const colors: Record<string, string> = {
    yahoo:      "text-blue-600",
    sec:        "text-purple-600",
    calculated: "text-gray-600",
    finra:      "text-yellow-700",
  };
  const label = metric.source === "finra" ? "finra (short vol)" : metric.source;
  return <span className={`text-xs ${colors[metric.source] ?? "text-gray-700"}`}>[{label}]</span>;
}

function Row({
  label,
  value,
  status,
  source,
}: {
  label: string;
  value: string;
  status: "ok" | "warn" | "neutral";
  source?: React.ReactNode;
}) {
  const color = status === "ok" ? "text-emerald-400" : status === "warn" ? "text-red-400" : "text-gray-400";
  const icon = status === "ok" ? "✓" : status === "warn" ? "⚠" : "—";
  const isNA = value.startsWith("N/A");
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 w-36 shrink-0">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-medium ${isNA ? "text-gray-600" : color}`}>
          {!isNA && `${icon} `}{value}
        </span>
        {source && <div className="mt-0.5">{source}</div>}
      </div>
    </div>
  );
}

export default function ResearchChecklist(props: Props) {
  const {
    ticker, name, price, change1M, change3M, relativeVolume,
    marketCap, bullishScore, lastEarningsDate, insiderBuying,
    shortInterest, revenueGrowth,
  } = props;

  const [open, setOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [supp, setSupp] = useState<SupplementalStockData | null>(null);
  const [suppLoading, setSuppLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    setNewsLoading(true);
    fetch(`/api/stocks/news/${ticker}`)
      .then((r) => r.json()).then(setNews).catch(() => setNews([]))
      .finally(() => setNewsLoading(false));

    if (!supp) {
      setSuppLoading(true);
      fetch(`/api/stocks/supplemental/${ticker}`)
        .then((r) => r.json()).then(setSupp).catch(() => setSupp(null))
        .finally(() => setSuppLoading(false));
    }
  }, [open, ticker, supp]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const fmtCap = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`;

  // Determine status helpers
  const trendStatus = change1M > 0 && change3M > 0 ? "ok" : change1M < 0 && change3M < 0 ? "warn" : "neutral";
  const volStatus: "ok" | "warn" | "neutral" = relativeVolume > 2.0 ? "ok" : relativeVolume >= 1.5 ? "ok" : relativeVolume >= 1.0 ? "neutral" : "warn";
  const volLabel = relativeVolume > 2.0 ? "High" : relativeVolume >= 1.5 ? "Elevated" : relativeVolume >= 1.0 ? "Normal" : "Below average";
  const capStatus = marketCap >= 500e6 ? "ok" : marketCap >= 200e6 ? "neutral" : "warn";

  // Moving averages vs price
  const ma50Val = supp?.ma50.value ? Number(supp.ma50.value) : null;
  const ma200Val = supp?.ma200.value ? Number(supp.ma200.value) : null;
  const ma50Status: "ok" | "warn" | "neutral" = ma50Val ? price > ma50Val ? "ok" : "warn" : "neutral";
  const ma200Status: "ok" | "warn" | "neutral" = ma200Val ? price > ma200Val ? "ok" : "warn" : "neutral";

  // Revenue growth
  const revGrowthDisplay = supp?.revenueGrowth.value
    ? String(supp.revenueGrowth.value)
    : revenueGrowth !== 0
    ? `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`
    : null;
  const revGrowthStatus: "ok" | "warn" | "neutral" = revGrowthDisplay
    ? revGrowthDisplay.startsWith("+") || (!revGrowthDisplay.startsWith("-") && !revGrowthDisplay.startsWith("N/A")) ? "ok" : "warn"
    : "neutral";

  // Short interest
  const shortInterestDisplay = supp?.shortInterest.value
    ? String(supp.shortInterest.value)
    : shortInterest != null
    ? `${shortInterest.toFixed(1)}%`
    : null;
  const shortPct = parseFloat(shortInterestDisplay ?? "0");
  const shortStatus: "ok" | "warn" | "neutral" = shortPct > 15 ? "warn" : shortPct > 0 ? "neutral" : "neutral";

  // Debt risk
  const debtVal = val(supp?.debtRisk);
  const debtStatus: "ok" | "warn" | "neutral" = debtVal.toLowerCase().includes("low") ? "ok" : debtVal.toLowerCase().includes("elevated") ? "warn" : "neutral";

  // Cash runway
  const cashVal = val(supp?.cashRunway);
  const cashStatus: "ok" | "warn" | "neutral" = cashVal.toLowerCase().includes("positive") ? "ok" : cashVal.includes("year") ? parseFloat(cashVal) < 1 ? "warn" : "ok" : "neutral";

  const loading = suppLoading;

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

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
              <div>
                <h2 className="text-base font-bold text-white">{ticker} — Research Checklist</h2>
                <p className="text-xs text-gray-500">{name} · ${price.toFixed(2)} · {fmtCap(marketCap)}</p>
              </div>
              <div className="flex items-center gap-2">
                {loading && <span className="text-xs text-gray-600 animate-pulse">Loading data...</span>}
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-5">

              {/* Chart Trend */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-2">
                  Chart Trend
                </h3>
                <Row label="1-Month Return" value={`${change1M >= 0 ? "+" : ""}${change1M.toFixed(1)}%`} status={change1M > 5 ? "ok" : change1M < -5 ? "warn" : "neutral"} />
                <Row label="3-Month Return" value={`${change3M >= 0 ? "+" : ""}${change3M.toFixed(1)}%`} status={change3M > 10 ? "ok" : change3M < -15 ? "warn" : "neutral"} />
                <Row label="Overall Trend" value={trendStatus === "ok" ? "Both timeframes positive" : trendStatus === "warn" ? "Both timeframes negative" : "Mixed signals"} status={trendStatus} />
                <Row
                  label="50-Day MA"
                  value={ma50Val ? `$${ma50Val.toFixed(2)} — price is ${price > ma50Val ? "above" : "below"}` : val(supp?.ma50)}
                  status={ma50Status}
                  source={sourceTag(supp?.ma50)}
                />
                <Row
                  label="200-Day MA"
                  value={ma200Val ? `$${ma200Val.toFixed(2)} — price is ${price > ma200Val ? "above" : "below"}` : val(supp?.ma200)}
                  status={ma200Status}
                  source={sourceTag(supp?.ma200)}
                />
              </section>

              {/* Fundamentals */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Fundamentals</h3>
                <Row label="Market Cap" value={fmtCap(marketCap)} status={capStatus} />
                <Row
                  label="Revenue Growth"
                  value={revGrowthDisplay ?? val(supp?.revenueGrowth)}
                  status={revGrowthStatus}
                  source={sourceTag(supp?.revenueGrowth)}
                />
                {supp?.revenueGrowth?.reason && (
                  <p className="text-xs text-gray-600 pb-1 pl-1">{supp.revenueGrowth.reason}</p>
                )}
                <Row label="Bullish Score" value={`${bullishScore}/100`} status={bullishScore >= 60 ? "ok" : bullishScore < 30 ? "warn" : "neutral"} />
                <Row
                  label="Cash Runway"
                  value={cashVal}
                  status={cashStatus}
                  source={sourceTag(supp?.cashRunway)}
                />
                <Row
                  label="Debt Risk"
                  value={debtVal}
                  status={debtStatus}
                  source={sourceTag(supp?.debtRisk)}
                />
              </section>

              {/* Earnings */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Earnings</h3>
                <Row
                  label="Last Earnings"
                  value={lastEarningsDate ?? val(supp?.lastEarnings)}
                  status="neutral"
                  source={!lastEarningsDate ? sourceTag(supp?.lastEarnings) : undefined}
                />
                <Row
                  label="Next Earnings"
                  value={val(supp?.nextEarnings)}
                  status="neutral"
                  source={sourceTag(supp?.nextEarnings)}
                />
              </section>

              {/* Liquidity */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Liquidity</h3>
                <Row label="Relative Volume" value={`${relativeVolume.toFixed(1)}x avg — ${volLabel}`} status={volStatus} />
                <Row
                  label="Avg Daily Volume"
                  value={val(supp?.avgDailyVolume)}
                  status="neutral"
                  source={sourceTag(supp?.avgDailyVolume)}
                />
                <Row
                  label={supp?.shortInterest?.source === "finra" ? "Short Volume Ratio" : "Short Interest"}
                  value={supp?.shortInterest?.source === "unavailable" && supp.shortInterest.reason?.includes("Stale")
                    ? "N/A — stale short interest data"
                    : shortInterestDisplay ?? val(supp?.shortInterest)}
                  status={supp?.shortInterest?.source === "unavailable" && supp.shortInterest.reason?.includes("Stale") ? "warn" : shortStatus}
                  source={!shortInterestDisplay ? sourceTag(supp?.shortInterest) : undefined}
                />
                {supp?.shortInterest?.source === "unavailable" && supp.shortInterest.reason?.includes("Stale") && (
                  <p className="text-xs text-yellow-800 pb-1">Short interest data must be recent; stale data excluded.</p>
                )}
                {supp?.shortInterest?.source === "finra" && (
                  <p className="text-xs text-yellow-900 pb-1">Not exchange-reported short interest</p>
                )}
              </section>

              {/* Insider Activity */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Insider Activity</h3>
                <Row
                  label="Insider Buying"
                  value={val(supp?.insiderBuying) !== "N/A" ? val(supp?.insiderBuying) : insiderBuying > 0 ? `$${(insiderBuying / 1000).toFixed(0)}K detected` : "None detected"}
                  status={val(supp?.insiderBuying).toLowerCase().includes("purchase") || insiderBuying > 0 ? "ok" : "neutral"}
                  source={sourceTag(supp?.insiderBuying)}
                />
                <Row
                  label="Insider Selling"
                  value={val(supp?.insiderSelling)}
                  status={val(supp?.insiderSelling).toLowerCase().includes("sale") ? "warn" : "neutral"}
                  source={sourceTag(supp?.insiderSelling)}
                />
              </section>

              {/* Analyst */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Analyst Coverage</h3>
                <Row
                  label="Analyst Rating"
                  value={val(supp?.analystRating)}
                  status={val(supp?.analystRating).toLowerCase().includes("bullish") ? "ok" : val(supp?.analystRating).toLowerCase().includes("bearish") ? "warn" : "neutral"}
                  source={sourceTag(supp?.analystRating)}
                />
                <Row
                  label="Recent Revisions"
                  value={val(supp?.recentRevisions)}
                  status={val(supp?.recentRevisions).toLowerCase().includes("upgrade") ? "ok" : val(supp?.recentRevisions).toLowerCase().includes("downgrade") ? "warn" : "neutral"}
                  source={sourceTag(supp?.recentRevisions)}
                />
              </section>

              {/* Balance Sheet */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Balance Sheet</h3>
                <Row
                  label="Cash"
                  value={val(supp?.cash)}
                  status={supp?.cash?.value ? "ok" : "neutral"}
                  source={sourceTag(supp?.cash)}
                />
                <Row
                  label="Total Debt"
                  value={val(supp?.totalDebt)}
                  status="neutral"
                  source={sourceTag(supp?.totalDebt)}
                />
                <Row
                  label="Net Cash / Net Debt"
                  value={val(supp?.netCash)}
                  status={val(supp?.netCash).toLowerCase().includes("net cash") ? "ok" : val(supp?.netCash).toLowerCase().includes("net debt") ? "warn" : "neutral"}
                  source={sourceTag(supp?.netCash)}
                />
                <Row
                  label="Free Cash Flow"
                  value={val(supp?.freeCashFlow)}
                  status={val(supp?.freeCashFlow).startsWith("-") ? "warn" : val(supp?.freeCashFlow) !== "N/A" ? "ok" : "neutral"}
                  source={sourceTag(supp?.freeCashFlow)}
                />
                <Row
                  label="Dilution Risk"
                  value={val(supp?.dilutionRisk)}
                  status={val(supp?.dilutionRisk).includes("⚠") ? "warn" : val(supp?.dilutionRisk).toLowerCase().includes("minimal") ? "ok" : "neutral"}
                  source={sourceTag(supp?.dilutionRisk)}
                />
              </section>

              {/* Ownership */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Ownership</h3>
                <Row
                  label="Institutional Ownership"
                  value={val(supp?.institutionalOwnership)}
                  status={supp?.institutionalOwnership?.value ? "ok" : "neutral"}
                  source={sourceTag(supp?.institutionalOwnership)}
                />
                <Row
                  label="Insider Ownership"
                  value={val(supp?.insiderOwnership)}
                  status="neutral"
                  source={sourceTag(supp?.insiderOwnership)}
                />
              </section>

              {/* News */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Recent Media</h3>
                {newsLoading && <p className="text-xs text-gray-600 animate-pulse">Loading headlines...</p>}
                {!newsLoading && !news.length && <p className="text-xs text-gray-600">No recent coverage found.</p>}
                {news.map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                    className="block py-1.5 border-b border-gray-800 last:border-0 hover:text-white transition-colors">
                    <p className="text-xs text-gray-300 leading-snug">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{n.publisher} · {n.publishedAt}</p>
                  </a>
                ))}
              </section>

              {/* Warning */}
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
