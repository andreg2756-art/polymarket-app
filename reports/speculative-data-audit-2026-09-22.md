# Speculative data audit — September 22, 2026

Snapshot of the 50 displayed stocks, ranked by bullishScore. Database presence is not provider coverage: the supplemental API may return data that the Stock row does not store. Universe membership changed during this investigation; counts are point-in-time.

## Saved-field gaps

| Field | Missing of 50 |
|---|---:|
| sector | 42 |
| industry | 41 |
| lastEarningsDate | 44 |
| earningsPeriodEnd | 20 |
| lastFilingDate | 36 |
| analystRating | 23 |
| float | 50 |
| shortInterest | 50 |
| netIncome | 41 |
| cashAndEquivalents | 41 |

## Tick-by-tick saved data

| Ticker | Score | Earnings period | Missing saved fields |
|---|---:|---|---|
| FEAM | 84 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| EAF | 79 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| GOTU | 71 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| ANGX | 71 | 2026-06-30 | lastFilingDate, float, shortInterest |
| TASK | 70 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| SJT | 70 | 2024-12-31 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| GAP | 70 | — | earningsPeriodEnd, lastFilingDate, float, shortInterest |
| GPRO | 69 | 2026-06-30 | sector, lastFilingDate, float, shortInterest |
| PACB | 69 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| PRGO | 68 | 2026-06-30 | lastEarningsDate, float, shortInterest |
| BALY | 67 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| ADCT | 66 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, float, shortInterest, netIncome, cashAndEquivalents |
| DNA | 65 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| OGI | 65 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| CGC | 65 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| HLLY | 64 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| FIRY | 63 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| ASPN | 63 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, float, shortInterest, netIncome, cashAndEquivalents |
| SRFM | 62 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| RERE | 62 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| TWI | 61 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, float, shortInterest, netIncome, cashAndEquivalents |
| OWLT | 61 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| SPRO | 60 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| TEN | 59 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| CNXC | 58 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| CLPR | 58 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| VLN | 58 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| CMCO | 58 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| GRPN | 57 | 2026-06-30 | lastEarningsDate, float, shortInterest |
| TLYS | 56 | 2026-09-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| ARHS | 56 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, float, shortInterest, netIncome, cashAndEquivalents |
| SOS | 56 | 2018-09-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| GOLD | 56 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| AZO | 56 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| FOSL | 55 | 2026-06-30 | sector, industry, lastEarningsDate, float, shortInterest, netIncome, cashAndEquivalents |
| CTKB | 55 | 2026-06-30 | sector, industry, lastEarningsDate, float, shortInterest, netIncome, cashAndEquivalents |
| OPTU | 55 | 2026-06-30 | float, shortInterest |
| NAT | 54 | 2026-06-30 | lastFilingDate, float, shortInterest |
| OPENZ | 54 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| KOS | 54 | 2026-06-30 | float, shortInterest |
| VET | 54 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| ABSI | 53 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| DSX | 53 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| QNST | 53 | — | lastEarningsDate, earningsPeriodEnd, float, shortInterest |
| CPRI | 53 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| GAB | 53 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| SFL | 52 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |
| SVCO | 52 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| GENI | 52 | — | sector, industry, lastEarningsDate, earningsPeriodEnd, lastFilingDate, analystRating, float, shortInterest, netIncome, cashAndEquivalents |
| HSHP | 51 | 2026-06-30 | sector, industry, lastEarningsDate, lastFilingDate, float, shortInterest, netIncome, cashAndEquivalents |

## Direct production checks

FEAM, EAF and TASK supplemental responses all returned cash, debt and Polygon short interest with settlement date 2026-08-31. Thus absent Stock.shortInterest is not evidence that Polygon has no coverage. All three showed September 2025 under Last Earnings because the parser selected history[0]. Local live checks after sorting retrieved June 2026 results for EAF and TASK. Period ends are now explicitly labeled and formatted in UTC; no announcement date is inferred.

## Prepared fixes — not deployed

- Choose the newest reported earnings period; reject future/unreported entries and mark old results stale.
- Count recent reporting periods for the reporting-period warning, independently of announcement dates and consensus availability.
- Show the stock table before supplemental data finishes, with four concurrent requests and bounded timeouts instead of a 50-request burst. This is not an account-wide rate limiter.
- Accept Polygon avg_daily_volume, preserving the older field alias.
- Treat valid zero measurements as present, and require actual float data for the Float confidence category.

## Remaining genuine limitations

- Saved sector/industry coverage is poor; metadata acquisition is coupled to the slower financial backfill.
- Float still relies on the restricted FMP integration in technicals; shares outstanding must not substitute for tradable float.
- Supplemental panels still use Yahoo and a legacy FMP fallback, separately from the stored Business Quant/SEC financial-record system. Source disagreement and unsupported fields require a shared data contract.
- Analyst coverage is not universal; future earnings announcements may be unannounced. Distinguish those cases from provider errors.
- Existing lint violations remain in Speculative/ResearchChecklist; compilation and targeted regression checks are separate from lint cleanliness.

## Deployment boundary

Commit 5da297b (queue registration and financial stale-record handling) was pushed before the request to hold deployments. The Speculative changes are local only and await review alongside the improvement plan.
