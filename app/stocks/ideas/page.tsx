"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

interface Stock {
  id: string; ticker: string; name: string; sector: string | null;
  marketCap: number; price: number; bullishScore: number;
  revenueGrowth: number; epsGrowth: number; analystRating: string | null;
  insiderBuying: number; change1M: number; change3M: number;
  relativeVolume: number; earningsBeat: boolean; revenueBeat: boolean;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

interface NewsSignals {
  convictionBullets: string[];
  riskBullets: string[];
}

// Keyword patterns → extracted signal labels
const CONVICTION_PATTERNS: { pattern: RegExp; signal: string }[] = [
  { pattern: /upgrade|raised.*target|price target.*raise|outperform|buy rating/i, signal: "analyst upgrade or raised price target" },
  { pattern: /beat.*estimate|surpass.*estimate|earnings beat|revenue beat/i, signal: "beat earnings or revenue estimates" },
  { pattern: /contract|partnership|deal|agreement|awarded/i, signal: "new contract or partnership announced" },
  { pattern: /record (revenue|sales|profit|quarter)/i, signal: "record revenue or sales reported" },
  { pattern: /fda.*approv|approv.*fda|clearance|breakthrough/i, signal: "FDA approval or regulatory clearance" },
  { pattern: /buyback|repurchase/i, signal: "share buyback program announced" },
  { pattern: /insider.*buy|director.*buy|executive.*purchas/i, signal: "insider or executive buying shares" },
  { pattern: /guidance.*raised|raise.*guidance|outlook.*improv/i, signal: "forward guidance raised" },
  { pattern: /accelerat|momentum|surge|soar|rally|breakout/i, signal: "strong price momentum highlighted" },
  { pattern: /institutional|hedge fund|13[fF]|position/i, signal: "institutional interest reported" },
];

const RISK_PATTERNS: { pattern: RegExp; signal: string }[] = [
  { pattern: /ceo.*resign|cfo.*resign|cto.*resign|chief.*leav|execut.*depart|step.*down/i, signal: "executive departure (CEO/CFO/C-suite)" },
  { pattern: /lawsuit|litigation|sued|class action|legal action/i, signal: "lawsuit or legal action filed" },
  { pattern: /downgrade|cut.*target|lower.*target|underperform|sell rating/i, signal: "analyst downgrade or price target cut" },
  { pattern: /dilut|offering|shares.*sell|secondary.*offer/i, signal: "dilutive share offering or secondary" },
  { pattern: /miss.*estimate|below.*estimate|disappoint|earnings miss/i, signal: "missed earnings or revenue estimates" },
  { pattern: /guidance.*cut|lower.*guidance|withdraw.*guidance|outlook.*lower/i, signal: "guidance cut or withdrawn" },
  { pattern: /recall|safety concern|warning letter|fda.*warn/i, signal: "product recall or safety warning" },
  { pattern: /bankrupt|going concern|cash runway|liquidity/i, signal: "going concern or liquidity risk mentioned" },
  { pattern: /investi|probe|sec.*|doj.*|fraud/i, signal: "regulatory investigation or probe" },
  { pattern: /layoff|restructur|workforce.*reduc/i, signal: "layoffs or restructuring announced" },
];

function extractSignals(news: NewsItem[]): NewsSignals {
  const convictionBullets: string[] = [];
  const riskBullets: string[] = [];
  const seenConviction = new Set<string>();
  const seenRisk = new Set<string>();

  for (const n of news) {
    const text = n.title + " " + (n.publisher ?? "");

    for (const { pattern, signal } of CONVICTION_PATTERNS) {
      if (pattern.test(text) && !seenConviction.has(signal)) {
        seenConviction.add(signal);
        convictionBullets.push(`"${n.title}" (${n.publisher}) → ${signal}`);
      }
    }

    for (const { pattern, signal } of RISK_PATTERNS) {
      if (pattern.test(text) && !seenRisk.has(signal)) {
        seenRisk.add(signal);
        riskBullets.push(`"${n.title}" (${n.publisher}) → ${signal}`);
      }
    }
  }

  return { convictionBullets, riskBullets };
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function fmtCapShort(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return "N/A";
}

function sectorContext(sector: string | null): string {
  const map: Record<string, string> = {
    Technology: "Tech small-caps are rate-sensitive and driven by growth multiples. Rapid re-ratings occur on earnings beats or product launches.",
    Healthcare: "Healthcare carries binary event risk — FDA decisions and trial readouts can move a stock 50%+ overnight.",
    Energy: "Energy names are commodity-correlated. Policy shifts and oil/gas prices drive sentiment across the sector.",
    Financials: "Financials are sensitive to rate movements and credit conditions. Fintech names can scale fast but face regulatory scrutiny.",
    "Consumer Discretionary": "Consumer names follow spending cycles. Small-caps here are volatile around macro data and earnings.",
    Industrials: "Industrials benefit from capex and infrastructure cycles. Government contracts can provide durable revenue visibility.",
    Materials: "Materials are commodity-driven with high beta to global risk appetite and geopolitical events.",
    "Communication Services": "Engagement metrics and monetization drive re-ratings. Platform names can accelerate quickly on user growth.",
    "Real Estate": "Rate-sensitive sector. Rising rates compress valuations; falling rates are a strong tailwind.",
    Utilities: "Clean energy utilities attract ESG flows and long-term contract premiums. Defensive but rate-sensitive.",
  };
  return map[sector ?? ""] ?? "Sector experiences cyclical trends driven by macro conditions and specific catalysts.";
}

function buildConvictionTooltip(s: Stock, signals: NewsSignals): string {
  const mom = `${s.ticker} is ${s.change1M >= 0 ? "up" : "down"} ${Math.abs(s.change1M).toFixed(1)}% over 1 month and ${s.change3M >= 0 ? "up" : "down"} ${Math.abs(s.change3M).toFixed(1)}% over 3 months.`;
  const vol = s.relativeVolume > 1.5
    ? `Volume is running ${s.relativeVolume.toFixed(1)}x its 20-day average — institutional accumulation likely.`
    : s.relativeVolume < 0.8
    ? `Volume is below average (${s.relativeVolume.toFixed(1)}x) — limited near-term interest.`
    : `Volume is near average (${s.relativeVolume.toFixed(1)}x).`;
  const cap = `${s.ticker} is a ${s.marketCap >= 2e9 ? "mid-cap" : s.marketCap >= 300e6 ? "small-cap" : "micro-cap"} at ${fmtCapShort(s.marketCap)}.`;
  const sec = sectorContext(s.sector);

  let mediaSection = "";
  if (signals.convictionBullets.length > 0) {
    mediaSection = ` Media signals supporting conviction: ${signals.convictionBullets.slice(0, 2).join("; ")}.`;
  } else {
    mediaSection = " No specific bullish media signals detected in recent coverage.";
  }

  const label = s.bullishScore >= 70 ? "Very High" : s.bullishScore >= 55 ? "High" : s.bullishScore >= 40 ? "Medium" : "Low";
  return `${label} Conviction (${s.bullishScore}/100) — ${mom} ${vol} ${cap} ${sec}${mediaSection}`;
}

function buildRiskTooltip(s: Stock, signals: NewsSignals): string {
  const cap = `${s.ticker} has a market cap of ${fmtCapShort(s.marketCap)}`;
  const tier = s.marketCap < 200e6 ? "micro-cap — thin liquidity, wide spreads, high gap risk" : s.marketCap < 500e6 ? "small-cap — moderate liquidity, volatile around sector news" : "larger small/mid-cap — better liquidity, broader institutional coverage";
  const drawdown = s.change3M > 50
    ? ` Up ${s.change3M.toFixed(1)}% in 3 months — mean reversion risk is elevated.`
    : s.change3M < -20
    ? ` Down ${Math.abs(s.change3M).toFixed(1)}% in 3 months — trend is negative, further downside possible.`
    : "";
  const sec = sectorContext(s.sector);

  let mediaSection = "";
  if (signals.riskBullets.length > 0) {
    mediaSection = ` ⚠ Media risk signals: ${signals.riskBullets.slice(0, 2).join("; ")}.`;
  } else {
    mediaSection = " No specific risk signals detected in recent media coverage.";
  }

  const sizing = s.marketCap < 200e6 ? "0.5–1%" : s.marketCap < 500e6 ? "1–2%" : "2–4%";
  return `${cap} (${tier}).${drawdown} ${sec}${mediaSection} Suggested position size: ${sizing} of portfolio.`;
}

function convictionLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Very High", color: "text-emerald-300 bg-emerald-900" };
  if (score >= 55) return { label: "High", color: "text-green-300 bg-green-900" };
  if (score >= 40) return { label: "Medium", color: "text-yellow-300 bg-yellow-900" };
  return { label: "Low", color: "text-gray-300 bg-gray-800" };
}

function riskLabel(marketCap: number): { label: string; color: string } {
  if (marketCap < 200_000_000) return { label: "High Risk", color: "text-red-300 bg-red-900" };
  if (marketCap < 500_000_000) return { label: "Med Risk", color: "text-orange-300 bg-orange-900" };
  return { label: "Lower Risk", color: "text-blue-300 bg-blue-900" };
}

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-0 mb-2 w-96 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {text}
        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-700" />
      </div>
    </div>
  );
}

function positionSizing(s: Stock): string {
  if (s.bullishScore >= 70) return "2–4% portfolio";
  if (s.bullishScore >= 55) return "1–2% portfolio";
  return "0.5–1% portfolio";
}

function StockCard({ s, index }: { s: Stock; index: number }) {
  const [signals, setSignals] = useState<NewsSignals>({ convictionBullets: [], riskBullets: [] });
  const [newsLoaded, setNewsLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/stocks/news/${s.ticker}`)
      .then((r) => r.json())
      .then((news: NewsItem[]) => {
        setSignals(extractSignals(news));
        setNewsLoaded(true);
      })
      .catch(() => setNewsLoaded(true));
  }, [s.ticker]);

  const conviction = convictionLabel(s.bullishScore);
  const risk = riskLabel(s.marketCap);
  const convictionTooltip = newsLoaded ? buildConvictionTooltip(s, signals) : "Loading media signals...";
  const riskTooltip = newsLoaded ? buildRiskTooltip(s, signals) : "Loading media signals...";

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/stocks/${s.ticker}`} className="text-xl font-bold text-emerald-400 hover:underline">{s.ticker}</Link>
              <Tooltip text={convictionTooltip}>
                <span className={`text-xs px-2 py-0.5 rounded-full cursor-help ${conviction.color}`}>{conviction.label}</span>
              </Tooltip>
              <Tooltip text={riskTooltip}>
                <span className={`text-xs px-2 py-0.5 rounded-full cursor-help ${risk.color}`}>{risk.label}</span>
              </Tooltip>
            </div>
            <p className="text-gray-400 text-sm mt-0.5">{s.name} · {s.sector || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <p className="text-xs text-gray-500">Score</p>
            <p className="text-xl font-bold text-emerald-400">{s.bullishScore}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Price</p>
            <p className="text-lg font-semibold">${s.price.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Mkt Cap</p>
            <p className="text-sm">{fmtCap(s.marketCap)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">1M / 3M</p>
            <p className={`text-sm font-medium ${s.change1M >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {s.change1M >= 0 ? "+" : ""}{s.change1M.toFixed(1)}% / {s.change3M >= 0 ? "+" : ""}{s.change3M.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Position</p>
            <p className="text-sm text-blue-400">{positionSizing(s)}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.earningsBeat && <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded">Earnings Beat</span>}
        {s.revenueBeat && <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded">Revenue Beat</span>}
        {s.revenueGrowth > 20 && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">Rev +{s.revenueGrowth.toFixed(0)}%</span>}
        {s.insiderBuying > 0 && <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded">Insider Buying</span>}
        {s.analystRating?.includes("Buy") && <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded">{s.analystRating}</span>}
        {s.change1M > 10 && <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded">+{s.change1M.toFixed(0)}% (1M)</span>}
        {signals.riskBullets.length > 0 && <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">⚠ {signals.riskBullets.length} risk signal{signals.riskBullets.length > 1 ? "s" : ""} in media</span>}
        {signals.convictionBullets.length > 0 && <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded">✓ {signals.convictionBullets.length} bullish signal{signals.convictionBullets.length > 1 ? "s" : ""} in media</span>}
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stocks/screener?sortBy=bullishScore&minScore=40")
      .then((r) => r.json())
      .then((data) => setStocks(data.slice(0, 20)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-emerald-400">Highest Conviction Ideas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Top opportunities ranked by score · hover labels for media-backed conviction &amp; risk analysis
        </p>
      </div>

      {stocks.length === 0 ? (
        <div className="py-24 text-center text-gray-500">No ideas yet. Run a market scan first from the Top 50 page.</div>
      ) : (
        <div className="space-y-4">
          {stocks.map((s, i) => <StockCard key={s.id} s={s} index={i} />)}
        </div>
      )}
    </div>
  );
}
