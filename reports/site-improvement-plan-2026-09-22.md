# Site improvement plan — September 22, 2026

Prepared after the Speculative data investigation. No further deployment is authorized by this document. The proposed work is staged below so data correctness can be reviewed before changing rankings or adding features. Effort ranges are planning estimates, not delivery promises.

## 1. Stabilize Speculative data first

**Prepared locally now:** newest earnings-period selection, UTC period dates, an accurate earnings-period warning, bounded supplemental requests, the Polygon average-volume mapping, and confidence checks that distinguish zero from missing and require actual float data. Review these changes as a small release, with before/after samples for EAF and TASK. Keep score formulas unchanged.

**Next: one saved data record per ticker and field.** Attach value, units, source, reporting/settlement date, acquisition date, and a status: current, stale, awaiting collection, unsupported, not applicable, provider failure. Both list pages and expanded panels should read these records. Do not count a recent stock-price update as fresh earnings or financial statements. Keep announcement dates, period ends, and filing dates separate.

**Separate collection work by dataset.** Company profiles, earnings/recommendations, short interest and financial statements need separate queues, budgets and refresh schedules. Currently a stock can wait for a Business Quant statement slot before getting basic metadata. Acquire profiles without consuming statement capacity; cache them until changed. Refresh short interest around newly published settlement dates. Cache earnings results by period, with separate announced-event updates. Refresh prices on their own schedule.

**Handle entitlement limits explicitly.** Test candidate providers against the actual displayed Speculative universe, including foreign issuers and microcaps, before committing to another paid plan. Record coverage, freshness, response time, account allowance and redistribution rights. Choose the minimum paid dataset needed to close measured gaps. Never replace float with shares outstanding or short interest with short-sale volume. FINRA explicitly distinguishes short positions from trading volume: https://www.finra.org/finra-data/browse-catalog/short-sale-volume

**Completion criteria:** every displayed missing value has a specific reason; list/detail views agree for the same source/date; unsuccessful refreshes preserve prior records as stale; a page visit does not launch an uncontrolled provider scan. Core price/volume and identity inputs should be current for every eligible ranked stock, or that stock should be visibly excluded pending review. Optional fields can legitimately remain unavailable.

**Estimated effort:** prepared fixes are ready for review; shared records and independent collection jobs roughly 3–5 focused development days, depending on migration and provider verification.

## 2. Make the interface useful for a decision

| Priority | Change | Benefit | Acceptance check |
|---|---|---|---|
| First | Replace one broad red warning with separate status counts: pending, stale, unsupported and failed | Explains the actual problem without implying all data is bad | Counts match the displayed universe and open a ticker-specific explanation |
| First | Separate Momentum/Quality/Value score from data completeness | A high score cannot visually imply complete research | Score tooltip names real factors; coverage lists missing factors |
| First | A compact default table: ticker, price/as-of, score, coverage, liquidity and next confirmed event | Makes the screener readable | Table works on a narrow screen without burying the main action |
| First | Expand details on demand; show the main table immediately | Faster perceived loading and fewer requests | Test cold and warm loads, slow providers and partial failures |
| Next | Saved filters, sortable columns and watchlist | Makes repeated research quicker | Filters survive reload; watchlist is shared across lenses |
| Next | One research drawer with source/date beside each metric | Resolves contradictory data across panels | Same ticker/field uses the same stored observation throughout |
| Next | Explain why rank changed: price move, new filing, coverage change, or formula version | Separates investment information from data maintenance | Every material rank change has a traceable cause |
| Later | Data-health page with last successful jobs, backlog, failures and request budget | Makes recurring breakage visible | A stuck queue and a provider 403/429 are identifiable without reading server logs |

Do not add more indicators merely to fill empty space. Hide irrelevant metrics for banks, trusts or other special structures, with a short explanation. Avoid showing a bank as a poor operating company because generic free-cash-flow or debt ratios do not apply.

**Estimated effort:** 2–4 focused development days for the first group after data semantics are agreed. Validate using actual workflows: find a candidate, understand the risk, compare it, save it, and revisit it.

## 3. Profitability: test whether the screener earns its complexity

Assuming profitability primarily means trading performance, the next investment-related feature should be an honest paper-portfolio comparison, not another scoring factor. There is currently no verified basis for saying the present screeners outperform an index fund.

The current backtest computes average forward pick returns. It is not a fully specified compounded monthly-rebalanced portfolio. It also skips picks with no forward price, constructs SPY observations in a separate loop, and returns zero when the benchmark series is missing. Those behaviors need correction before treating the displayed difference as a dependable advantage. Review snapshot retention when stocks leave the live universe; research history must survive removals and delistings.

1. Freeze each lens's formula version and eligible universe at each decision time. Store the complete top-10 selection, including data coverage at selection.
2. Define executable entry timing, equal weights, rebalance dates, exits, cash handling and exposure limits before observing results. Use prices available after the signal, not the same close that produced it.
3. Build matched portfolio and SPY paths using identical observation dates and explicit dividend/split treatment. A missing benchmark means unavailable comparison, never 0% return.
4. Keep failed/delisted names and unavailable exit prices in the audit trail; do not silently remove losing or unpriced positions from the average.
5. Include commissions where applicable, spread/slippage assumptions and turnover. Test several cost scenarios rather than one optimistic value. Fees and expenses reduce returns: https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/updated
6. Report cumulative return, drawdown, volatility, turnover, exposure, completed sample size and net excess return over SPY. Use a small-cap benchmark as a secondary comparison for Speculative to help separate stock selection from market-cap exposure.
7. Compare the existing method with simple predeclared alternatives: liquidity filter, concentration cap, lower-turnover rebalancing. Change one feature at a time and reserve unseen periods for evaluation. Do not optimize weights on the same observations used to claim success.
8. Continue forward paper tracking. A few weeks or a handful of overlapping trades is insufficient evidence of a durable edge. If the net performance does not justify the additional risk and work, keep the product as a research tool rather than presenting it as an outperforming strategy.

**Estimated effort:** 3–5 focused development days for the measurement engine and regression fixtures. Establishing evidence requires market time and cannot be shortened by development effort.

If profitability instead means **site revenue**, validate retention and willingness to pay for saved research, change alerts and exports before building subscriptions. Estimate contribution margin as subscription revenue minus data licensing, hosting, email and payment costs. Verify provider display/redistribution rights before offering paid access. Do not sell performance claims unsupported by the above tests.

## 4. Troubleshooting and release gates

- Centralize provider clients, use timeouts and bounded retries, honor quota responses, and coordinate request budgets across server instances. Four concurrent browser calls is only a local improvement, not an account-wide quota solution.
- Monitor last successful acquisition by dataset, completion lag, 403/429 rate, missing-field changes and request allowance. Alert on meaningful failures, not every intentionally unsupported field.
- Test the actual Speculative sample: FEAM, EAF, TASK, a foreign issuer, a trust, a loss-making company, and a ticker without analyst coverage. Include zero revenue/debt, old filing dates, reordered earnings history and missing float.
- Add a small production read-only smoke check for the listing, one expanded panel and the data-health report. Keep full-provider refreshes out of deployment smoke tests.
- Address pre-existing lint violations separately so a clean build is not mistaken for a clean lint baseline.
- Verify snapshot retention, current-universe membership and score-version labels before interpreting performance changes.
- Roll out to preview first. Approve a concrete before/after report, then deploy; verify provider consumption and data consistency afterward. Roll back code on regression while retaining acquired records and research history.

## Recommended order

1. Review the prepared Speculative correctness fixes and this plan; no further deployment until review.
2. Unify data provenance and decouple metadata/earnings collection from the financial backlog.
3. Simplify the default table and make missing-data reasons actionable.
4. Repair portfolio/benchmark measurement and start a frozen paper-trading comparison.
5. Add alerts, saved research and only those signals that improve an independently evaluated outcome.

The aim is fewer contradictory numbers, a usable daily research workflow, and measurable evidence of value—not a promise that additional features will produce trading profits.
