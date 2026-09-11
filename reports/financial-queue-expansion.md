# Financial queue expansion — September 11, 2026

The production database contained 317 saved stocks but only 40 financial jobs; four of those jobs belonged to tickers no longer present. Registered the remaining 281 current tickers without altering existing job history. The daily worker now discovers the full saved universe instead of using the diagnostic cohort as an acquisition whitelist.

Each batch remains capped at eight companies and the durable Business Quant allowance remains 24 requests per UTC day. Six slots normally go to previously unattempted stocks and two to due maintenance/retries, with unused slots shared. Oldest due work comes first; tied jobs favor watchlists and screener ranks. This prevents repeated refreshes from consuming all initial-coverage capacity. It does not guarantee every company has provider coverage.

Quota exhaustion pauses the worker before modifying untouched jobs. A mid-company quota response retains partial statements and defers remaining acquisition without increasing the failure counter. True all-statement 404 failures retry after 14 days. Successful acquisitions reset prior failure counts. Local allowance reset does not guarantee the upstream provider has reset its own quota.

Recovered ANGX, ACCO and CRI sector labels from saved Finnhub profiles with exact industry mappings. No speculative mapping was added for the ambiguous Consumer products label.

Coverage API now reports the full current universe, job summary and local request allowance. The old diagnostic scope remains accessible with `?scope=cohort`. No data is fetched from providers on page visits.

Validation: 33 financial tests, including whole-universe queue seeding, priority/fairness, exhausted-quota no-op behavior, mid-company pause and unsupported statement backoff. A production-backed run confirmed WAITING_FOR_BUDGET with 317 queued stocks and no provider acquisition. Filling hundreds of stocks under the free allowance will take weeks; registration is not completed financial coverage.
