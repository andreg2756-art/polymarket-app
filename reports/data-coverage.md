# Stock data coverage audit

Captured 2026-09-09T15:07:59.428Z from the connected database using a read-only transaction. No provider refresh or database writes.

Presence only, not accuracy or freshness. Zero is valid for financial statement values. Null, empty and N/A metadata are missing. Lens membership overlaps.

| Field | All | Speculative | Quality | Value |
|---|---:|---:|---:|---:|
| netIncome | 103/327 | 11/136 | 103/212 | 98/161 |
| totalDebt | 82/327 | 6/136 | 82/212 | 79/161 |
| cashAndEquivalents | 56/327 | 5/136 | 56/212 | 54/161 |
| freeCashFlow | 52/327 | 3/136 | 52/212 | 50/161 |
| sector | 2/327 | 2/136 | 2/212 | 1/161 |
| industry | 2/327 | 2/136 | 2/212 | 1/161 |
| analystRating | 24/327 | 24/136 | 3/212 | 3/161 |
| lastEarningsDate | 43/327 | 43/136 | 7/212 | 4/161 |
| float | 0/327 | 0/136 | 0/212 | 0/161 |
| marketCap | 204/327 | 13/136 | 204/212 | 157/161 |
| price | 327/327 | 136/136 | 212/212 | 161/161 |
| trailingPE | 204/327 | 17/136 | 204/212 | 161/161 |
| priceToBook | 210/327 | 21/136 | 210/212 | 159/161 |

All four stored financial fields present: 42/327. None present: 217/327. Presence does not establish full-score eligibility.

## 40-ticker diagnostic cohort

Selected deterministically across lenses, coverage states and recorded market-cap bands; not sector representative because sector metadata is mostly absent. Zero market cap means unknown, not micro-cap.

| Ticker | Market cap recorded | Financial fields present | Missing fields |
|---|---:|---|---|
| SST | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, float, marketCap, trailingPE, priceToBook |
| YQ | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, float, marketCap, trailingPE, priceToBook |
| BTGO | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, float, marketCap, trailingPE, priceToBook |
| ANGX | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, float, marketCap, trailingPE, priceToBook |
| GPRO | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, float, marketCap, trailingPE, priceToBook |
| HAS | 12737725440 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, lastEarningsDate, float |
| THC | 20859252736 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, lastEarningsDate, float |
| UTHR | 21358278656 | netIncome, cashAndEquivalents, freeCashFlow | totalDebt, sector, industry, analystRating, lastEarningsDate, float |
| RCL | 70741073920 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, lastEarningsDate, float |
| WES | 20423219200 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| ACCO | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float, marketCap, trailingPE, priceToBook |
| ACDC | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float, marketCap, trailingPE, priceToBook |
| ADAM | 0 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float, marketCap, trailingPE, priceToBook |
| PMT | 0 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float, marketCap |
| CMC | 0 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, lastEarningsDate, float, marketCap |
| DSP | 898406080 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| GPRK | 775504256 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, float |
| IMOS | 1984027776 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| IVR | 735132224 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| ORC | 1300199808 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| TBLA | 1031993600 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| DOLE | 1312032896 | netIncome, totalDebt | cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| CRI | 1185036928 | netIncome, totalDebt, cashAndEquivalents | freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| OGI | 161451008 | netIncome, totalDebt, cashAndEquivalents | freeCashFlow, sector, industry, lastEarningsDate, float |
| ACAD | 4752186368 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| AGCO | 8915738624 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| ARIS | 4124485120 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| AVT | 7585184256 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| CSTM | 3724301824 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| GTX | 5219950592 | netIncome | totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| AEO | 2885612544 | netIncome, totalDebt | cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| AVAH | 2981850880 | netIncome, totalDebt | cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| PLNT | 3783359488 | netIncome, totalDebt | cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| BVN | 8676191232 | netIncome, totalDebt, cashAndEquivalents | freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| AROC | 5849282048 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, lastEarningsDate, float |
| GAP | 7861425664 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, float |
| IHS | 2872512768 | netIncome, totalDebt, cashAndEquivalents, freeCashFlow | sector, industry, analystRating, lastEarningsDate, float |
| ADI | 175994191872 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| AEM | 102204686336 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
| ALAB | 50111172608 | None | netIncome, totalDebt, cashAndEquivalents, freeCashFlow, sector, industry, analystRating, lastEarningsDate, float |
