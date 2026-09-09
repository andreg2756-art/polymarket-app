
## Confirmed implementation causes

These are code findings, not inferred API entitlement failures. No provider status log exists to identify the historical cause of each missing ticker field.

1. **Saved metadata is erased on speculative refresh.** app/api/stocks/refresh/route.ts constructs empty sector/industry, null float/date, N/A analyst rating and passes the entire row to update. Enrichment only repairs a subset afterward. This also risks replacing market cap with zero.
2. **Saved financials are not reused for scoring.** Both runQualityPipeline.ts and runTurnaroundPipeline.ts load only netIncome/totalDebt to select six candidates. Final scoring reads this run's fundamentalsMap only; all other stocks receive the first-pass score even if financials exist in the database.
3. **A failed financial fetch can erase prior values.** getFundamentals returns an all-null object on failure; both pipelines treat that object as a successful result and persist its null fields.
4. **Partial provider success blocks fallback.** Business Quant ok=true if any one statement returns. getFundamentals then returns immediately rather than filling missing statements from another source.
5. **The fallback cannot fill the main gaps as implemented.** massive.ts explicitly returns null cash and free cash flow. It maps long_term_debt to totalDebt, although those are not equivalent.
6. **Period mismatch can distort runway.** Business Quant fetches quarterly FCF; Polygon requests annual statements. turnaroundScore.ts divides cash by FCF and names the result runwayYears without carrying a period. Quarterly burn would overstate years by roughly four times under a constant-burn assumption.
7. **Essential inputs are discarded.** The schema does not persist revenue, operating income, prior-period statement values, shares outstanding, reporting currency, fiscal periods, source, accession, or a fundamentals-specific fetchedAt. A recent Stock.updatedAt is not evidence of fresh financial statements.
8. **Growth extraction is not period-safe.** revenueGrowth.ts selects 10-K/FY facts without validating duration or deduplicating repeated reporting periods; repeated comparative facts can be mistaken for distinct annual observations.
9. **An earnings period is labeled an announcement date.** earningsPerformance.ts assigns Finnhub period to lastEarningsDate. Its SEC fallback is a filing date, which is also a different concept.
10. **Coverage selection can stall.** Having either netIncome or debt counts as covered. Persistently failing high-ranked candidates can repeatedly occupy the six slots; partial companies are deprioritized despite missing cash/FCF.
11. **Limited provider diagnostics.** Non-2xx responses and exceptions collapse into null without persisted status/retry reason. Exact per-ticker causes cannot be reconstructed from this database.

## Source plan by gap

| Gap | Source path | Conditions before accepting |
|---|---|---|
| Revenue, net income, operating income | SEC Company Facts; existing licensed statement providers as fallback | Match CIK, taxonomy, currency, duration and fiscal period; deduplicate amendments/comparatives |
| Cash and debt | SEC balance-sheet concepts; Business Quant where entitled | Same balance-sheet date and currency; distinguish long-term debt from total debt; banking-specific definitions |
| Free cash flow | SEC operating cash flow minus capital expenditures | Same period/currency; handle cumulative year-to-date facts; retain derivation and raw inputs |
| Shares outstanding | SEC entity/statement share concepts or company profile provider | Point-in-time shares vs weighted-average shares vs ADR ratio; not interchangeable |
| Float | Dedicated float source | SEC public-float dollar value and shares outstanding are NOT tradable float shares; allow unavailable |
| Sector / industry | Verify Finnhub profile coverage and a consistent taxonomy | Do not copy an industry into sector; SEC SIC is a separate classification |
| Earnings announcement date | Actual reported earnings calendar/date source | Store period-end and SEC filing date separately |
| Analyst rating | Existing Finnhub recommendation trends | Broaden beyond speculative shortlist; no analyst coverage is a valid absence |
| Market cap / valuation | Preserve Yahoo screener values already fetched; verify quote freshness | Do not overwrite valid values with chart defaults; P/E may be inapplicable for losses |

SEC provides public Company Facts and submissions endpoints: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
Finnhub documents earnings surprises and financial/profile APIs: https://finnhub.io/docs/api

These are candidate sources, not a claim that every sampled ticker is covered. SEC extraction must support foreign filers/IFRS or explicitly mark them unsupported. No fresh account entitlement tests were run.

## Provider budget findings

- Business Quant's existing client documents a previously observed 40 requests/day restriction. Three statements per ticker means at most 13 full ticker attempts/day without retries or other usage. Two six-ticker lens batches use 36 requests, leaving four requests, not enough for another full scan. This is historical evidence from code comments, not a newly verified plan limit.
- Business Quant currently disables fetch caching and has no durable daily budget ledger.
- Polygon's client uses a process-local 5/min limiter and a 24-hour fetch cache. A local limiter does not coordinate all serverless instances.
- FMP restrictions are recorded in existing integration comments; no new FMP calls were made to confirm present entitlements.
- Finnhub is currently used for earnings/recommendations on the speculative shortlist, not a universal financial-statement backfill.

## Recommended implementation order

1. Stop destructive empty updates; preserve prior verified values on transient failure and retain explicit stale status.
2. Persist period-aware financial records with source, units, fiscal duration, filing date, fetch status and original inputs. Separate acquisition from score refresh.
3. Build one shared deduplicated 40-ticker backfill queue from the diagnostic cohort, with persisted retry schedules and provider budgets. Correct sector metadata before describing it as sector representative.
4. Validate SEC extraction on a small subset (ordinary operating company, loss-making company, bank, foreign filer) against filings. Check quarterly vs annual/YTD, debt definitions, cash-flow signs, currencies and amendments before expanding.
5. Score from validated stored records. Track each score's required inputs; missing data must not be confused with poor fundamentals. Retain existing Quality formula and keep catalysts separate.
6. Expand only after every cohort ticker has either validated required fields or an explicit, attributable unresolved reason.

Completion criteria: no blank overwrite on failed fetch; every financial value traceable to a period/source/unit; all 40 cohort tickers have documented status; scores are repeatable from stored inputs; real earnings dates are separate from reporting periods; no claim of full coverage based solely on four populated fields.

## Audit limitations

This measures database presence, not provider truth or investment quality. Per-field freshness and provenance cannot be certified from the current schema. Lens sets overlap and represent all stored ranked members, not necessarily the first page shown. No production data or application behavior was changed. The report does not claim the data gaps are already fixed.

Re-run from the project directory: node --env-file=.env.local scripts/audit-data-coverage.cjs
The script refreshes the generated inventory files; this diagnostic narrative is maintained separately in data-coverage-findings.md.
