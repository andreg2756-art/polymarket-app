"use client";

export default function Disclaimer() {
  return (
    <div className="bg-orange-950/30 border border-orange-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-orange-400 text-lg shrink-0 mt-0.5">⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-orange-300 leading-relaxed">
          <span className="font-semibold">For idea generation only — not financial advice.</span>{" "}
          Always check earnings dates, liquidity, SEC filings, valuation, and company fundamentals before trading.
          Small-cap stocks carry elevated volatility, liquidity risk, and can move against momentum rapidly.
        </p>
      </div>
      <div className="relative group shrink-0">
        <button className="text-xs text-orange-500 border border-orange-800 px-2 py-0.5 rounded hover:border-orange-500 cursor-help whitespace-nowrap">
          Why this matters
        </button>
        <div className="absolute right-0 bottom-full mb-2 w-80 bg-gray-950 border border-orange-800 rounded-lg px-3 py-3 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <p className="font-semibold text-orange-300 mb-1">Momentum reverses fast in small caps</p>
          <p className="text-gray-400">
            Small-cap stocks can lose 20–40% in days after a catalyst disappears, an earnings miss,
            a secondary offering, or a sector rotation. A high bullish score reflects recent momentum —
            not future performance. Stocks ranked highly today may gap down tomorrow on earnings, dilution,
            or macro events. Use this screener to generate ideas, then verify each one independently.
          </p>
        </div>
      </div>
    </div>
  );
}
