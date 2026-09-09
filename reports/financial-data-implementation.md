# Financial data repair — 2026-09-09

Implemented preservation of saved metadata and financials on failed refreshes; reuse of period-aware stored financials across the full scoring universe; separate background acquisition; period-aware cash runway; fiscal-period/filing-date separation for new earnings fetches; and explicit score-input status.

## Storage and acquisition

Additive Prisma migration: FinancialRecord (period/source/currency/evidence), FinancialSourceResponse (successful statement cache), FinancialJob (40-ticker queue and failure reasons), FinancialWorkerLease (cross-instance worker lock), FinancialRequestBudget (atomic daily provider cap). Stock legacy values are retained; unknown-period financials do not establish verified score eligibility.

Daily backfill runs at 10:30 UTC, before the existing daily stock refresh. Up to eight queued tickers per run, a 24-request/day Business Quant ceiling (below the observed 40/day account limit), per-request timeouts, retry backoff, and a 10-minute expiring worker lease. Successful statements are cached for seven days and retained on error. Other account usage can still exhaust the upstream quota; a 429 exhausts the local day's budget to prevent repeated attempts.

Business Quant quarterly records retain source-reported currency, quarter end, raw line-item evidence and values; no SEC filing accession or filing date is invented when the provider omits it. Two-year requests allow same-quarter-last-year revenue comparisons. SEC annual extraction requires consistent dates, units, duration and compatible inputs for derived FCF. Annual and quarterly records are never blended. The source parsers are rules-based; their checks are not an independent financial audit.

Missing fallback statements are attempted without treating partial success as full coverage. If the SEC annual alternative is available, it is stored separately. Current views select a coherent latest eligible record. Records older than 200 days (quarterly) or 550 days (annual) are excluded from new scores; fetch age over 35 days is flagged stale.

## Actual first-batch results

- PLNT: all ten tracked statement fields saved, Business Quant, USD, quarter ending 2026-06-30. Initial verified fixture was fetched with one-year history, so same-quarter-last-year growth remains unavailable until the next two-year fetch. A complete statement job is not the same as a complete Quality score.
- Seven additional tickers: financial retry status, with recorded HTTP 429/daily budget and SEC HTTP 403 reasons.
- Thirty-two tickers: pending their first attempt.
- Eight company profiles/industries fetched; only recognized industry categories mapped to sectors. Unknown categories are not guessed. Recommendation coverage expanded for that batch.
- SEC endpoints returned 403 during live testing. Business Quant accepted the validation calls, then returned 429 on the next ticker. Neither restriction is disguised as a missing company report.

Float remains unavailable; shares outstanding, sector classification and analyst availability are not substitutes for float. The profile response retains source-reported shares for future use, without presenting them as float. Legacy earnings dates cannot be authenticated from the existing schema; new ingestion separates fiscal period end and filing date and does not write either as an announcement date.

## Verification and operation

21 regression tests: node --test tests/financial-*.test.cjs
Type checking and production build passed. The additive migration was applied to the connected database. No full refresh endpoint was triggered manually (it also sends notification emails).

Manual bounded backfill: node --env-file=.env.local scripts/financial-backfill.cjs --run
Read-only status endpoint: /api/stocks/financial-coverage
Scheduled endpoint: /api/stocks/financial-backfill; requires the production CRON_SECRET configured in Vercel. No secrets are returned by either endpoint.

Quality formula weights remain unchanged and prediction-market signals remain separate. Provisional ranks may move when validated inputs arrive. Neither the 40-ticker cohort nor the whole universe is claimed complete.
