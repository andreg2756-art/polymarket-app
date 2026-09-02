// Curated event/outcome/factor-exposure definitions — the domain knowledge
// the catalyst engine (scoring.ts, expected-impact.ts, etc.) computes over.
// Deliberately still static TypeScript config, not a database table: this
// is "what do we believe the relationships are," which is reviewable
// domain knowledge like the rest of this file always was, not
// time-varying data. Time-varying data (probability snapshots, computed
// signals) is the next phase — see this feature's implementation notes on
// why that's a separate piece of infrastructure, not bundled in here.
//
// Every number below is hand-authored, not LLM-generated — per the engine
// spec, an LLM may eventually help SUGGEST entries for review, but never
// writes a score directly (see explanations.ts's header comment).

import type { PredictionEvent, StockFactorExposure, DirectCompanyExposure } from "./event-types";

export interface CatalystTheme {
  slug: string;
  title: string;
  description: string;
  alternativeScenarioNote: string;
  event: PredictionEvent;
  // Exactly one of these is populated per theme — factor-mediated events
  // (macro/sector events with a shared economic transmission mechanism)
  // use factorExposures; single-company/idiosyncratic events that don't
  // map to a shared macro factor use directExposures instead. See the
  // OpenAI theme below for why IPO events specifically don't fit the
  // factor model.
  factorExposures?: StockFactorExposure[];
  directExposures?: DirectCompanyExposure[];
}

export const CATALYST_THEMES: CatalystTheme[] = [
  {
    slug: "fed-rate-policy",
    title: "Fed Rate Policy",
    description:
      "Whether the Fed cuts, holds, or hikes affects borrowing costs and the discount rate applied to future earnings — with real, sector-dependent effects rather than a single across-the-board direction.",
    alternativeScenarioNote:
      "As of this writing the market prices a hike (71.5% on a separate, non-exclusive \"hike in 2026\" market) as far more likely than a cut (0.65% on the market this event actually uses) at this meeting — a cut is the minority scenario, included here because it has clear, fairly consistent sector winners, not because it's expected. A hike would generally reverse most exposures below: negative for the rate-sensitive lenders/homebuilders/REITs, and more supportive of bank net interest margins than a cut would be.",
    event: {
      slug: "fed-september-2026-decision",
      title: "Fed rate decision — September 2026 FOMC meeting",
      category: "MONETARY_POLICY",
      // This market's own settlement window, not the meeting date itself.
      resolutionDate: "2026-10-08",
      materiality: 1.00, // "Fed decision: 1.00" — spec's own example value
      // Only ONE real market exists for "does this specific meeting cut,"
      // and it's binary — Yes/No naturally sum to 1.0 with no
      // normalization needed. This is NOT a 4-way (50bp/25bp/hold/hike)
      // split like the spec's own worked example, because no Polymarket
      // market actually offers that breakdown for this meeting
      // specifically (confirmed by search) — "No Cut" here bundles both
      // "hold" and "hike," which have different impacts in reality
      // (hold ~neutral, hike ~clearly negative). That's a real
      // simplification, noted here rather than hidden, and it's why
      // the "No Cut" outcome's factor confidence below is set lower than
      // "Cut"'s.
      outcomes: [
        {
          id: "cut",
          label: "Fed cuts rates (any size) at the September meeting",
          conditionId: "0xb4022c0b2718eca7ad27195f2d48f06527fa000269d188e1d3001ff8bbc16956",
          outcomeIndex: 0, // "Fed rate cut by September 2026 meeting?" — Yes
          factorImpacts: [
            { factor: "MONETARY_POLICY", impact: 3, confidence: 0.90 },
            { factor: "INTEREST_RATES", impact: 3, confidence: 0.90 },
            { factor: "CREDIT_CONDITIONS", impact: 2, confidence: 0.70 },
            { factor: "HOUSING", impact: 3, confidence: 0.70 },
          ],
        },
        {
          id: "no-cut",
          label: "Fed holds or hikes at the September meeting",
          conditionId: "0xb4022c0b2718eca7ad27195f2d48f06527fa000269d188e1d3001ff8bbc16956",
          outcomeIndex: 1, // same market's "No"
          factorImpacts: [
            { factor: "MONETARY_POLICY", impact: -1, confidence: 0.60 },
            { factor: "INTEREST_RATES", impact: -1, confidence: 0.60 },
            { factor: "CREDIT_CONDITIONS", impact: -1, confidence: 0.50 },
            { factor: "HOUSING", impact: -1, confidence: 0.50 },
          ],
        },
      ],
      contextMarkets: [
        { conditionId: "0xd4e77ba6f29fc093509d24f508631abd445ecf506bbdc9c4c80e60256a318527", label: "Will no Fed rate cuts happen in 2026? (full-year, not this meeting — shown for context only)" },
        { conditionId: "0x80b3af88cb991980e8da1ce86b9794a0957f96ec98c29319dd7ba65e9744d82b", label: "Fed rate hike in 2026? (full-year, not this meeting — shown for context only)" },
      ],
    },
    // Sign convention for INTEREST_RATES/HOUSING/CREDIT_CONDITIONS here:
    // positive impact = monetary conditions EASING (a cut). A company with
    // positive exposure benefits from easier/lower-rate conditions;
    // negative exposure benefits from tighter conditions instead. JPM/ALLY
    // get TWO rows each (opposing factors) so their genuinely mixed
    // loan-growth-vs-margin story emerges from the weighted mean instead
    // of needing a special-cased "mixed" category.
    factorExposures: [
      { ticker: "SOFI", name: "SoFi Technologies", factor: "INTEREST_RATES", exposure: 0.80, confidence: 0.55,
        rationale: "Fintech lender — lower rates typically reduce funding costs and can boost loan demand, though this is a general sector pattern, not a guarantee for this specific company." },
      { ticker: "UPST", name: "Upstart Holdings", factor: "INTEREST_RATES", exposure: 0.80, confidence: 0.55,
        rationale: "AI lending marketplace whose loan origination volume has historically been sensitive to rate levels." },
      { ticker: "DHI", name: "D.R. Horton", factor: "HOUSING", exposure: 0.80, confidence: 0.55,
        rationale: "Homebuilder — lower rates generally reduce mortgage rates, historically associated with stronger new-home demand." },
      { ticker: "LEN", name: "Lennar", factor: "HOUSING", exposure: 0.80, confidence: 0.55,
        rationale: "Homebuilder with the same mortgage-rate sensitivity as D.R. Horton." },
      { ticker: "PHM", name: "PulteGroup", factor: "HOUSING", exposure: 0.55, confidence: 0.55,
        rationale: "Homebuilder, same rate-sensitivity logic, somewhat smaller scale exposure than DHI/LEN." },
      { ticker: "RKT", name: "Rocket Companies", factor: "HOUSING", exposure: 0.80, confidence: 0.55,
        rationale: "Mortgage originator/servicer — refinancing and origination volume are directly tied to mortgage rate levels." },
      { ticker: "O", name: "Realty Income", factor: "INTEREST_RATES", exposure: 0.55, confidence: 0.55,
        rationale: "REIT — lower rates reduce financing costs and can make REIT dividend yields relatively more attractive to income investors." },
      { ticker: "COIN", name: "Coinbase", factor: "INTEREST_RATES", exposure: 0.55, confidence: 0.30,
        rationale: "Risk-asset-adjacent business; lower rates have historically coincided with more risk appetite, but this link is looser and less direct than the others here." },
      { ticker: "JPM", name: "JPMorgan Chase", factor: "INTEREST_RATES", exposure: -0.30, confidence: 0.55,
        rationale: "Large bank — cuts compress net interest margin. Offset by a separate CREDIT_CONDITIONS exposure below (loan growth channel); the two nets out to a genuinely mixed view rather than one-directional." },
      { ticker: "JPM", name: "JPMorgan Chase", factor: "CREDIT_CONDITIONS", exposure: 0.35, confidence: 0.50,
        rationale: "Cuts can support loan demand and credit growth, partially offsetting the margin-compression effect above." },
      { ticker: "ALLY", name: "Ally Financial", factor: "INTEREST_RATES", exposure: -0.25, confidence: 0.55,
        rationale: "Auto lender/digital bank — same margin-compression dynamic as JPM, at smaller scale." },
      { ticker: "ALLY", name: "Ally Financial", factor: "CREDIT_CONDITIONS", exposure: 0.30, confidence: 0.50,
        rationale: "Same offsetting loan-growth channel as JPM, at smaller scale." },
    ],
  },
  {
    slug: "august-2026-jobs-report",
    title: "August 2026 Jobs Report",
    description:
      "Employment data most directly affects companies structurally tied to hiring volume (staffing, payroll processing) — a weaker print also feeds into Fed rate-cut odds (see the Fed Rate Policy theme), but that's a second-order, regime-dependent relationship and is deliberately not re-modeled here to avoid double-counting the same underlying thesis (spec Part 19).",
    alternativeScenarioNote:
      "Per current pricing, a weak print is the minority scenario — the market leans toward 50k+ jobs added (the \"add between 50k and 100k\" bucket alone is priced at 30%). The exposures below describe the weak case; a moderate-or-stronger report would generally reverse them — neutral-to-positive rather than negative for the staffing/payroll names, since more hiring activity means more placements and larger payrolls to process.",
    event: {
      slug: "august-2026-jobs-report",
      title: "How many jobs added in August 2026?",
      category: "LABOR_MARKET",
      resolutionDate: "2026-09-05",
      materiality: 0.70, // significant for the staffing/employment-services industry specifically, not a broad Fed-decision-level market mover on its own
      // Polymarket reuses generic titles like "How many jobs added in
      // August?" every year with no year in the question text — an
      // earlier pass here accidentally picked up the already-resolved
      // AUGUST 2025 version. These conditionIds are from the correct
      // 2026-dated event (confirmed via its endDate: 2026-09-05). All 6
      // are genuinely mutually-exclusive buckets of the SAME real
      // Polymarket grouped event, so normalizeOutcomeProbabilities() is
      // used at compute time to correct for the small vig-driven
      // rounding across separately-priced binary markets.
      outcomes: [
        { id: "lose-50k-plus", label: "Lose more than 50k jobs", conditionId: "0xb72571fb88a793a38be9a5104e3adb19a5ff886e339e1e5cb14e98fc2ae44e59", outcomeIndex: 0,
          factorImpacts: [{ factor: "LABOR_MARKET_STRENGTH", impact: -4, confidence: 0.85 }] },
        { id: "lose-0-50k", label: "Lose 0-50k jobs", conditionId: "0x614024b1a6d15770be9175faac4cdf1fface7604a2f12781d57a0b59610255e8", outcomeIndex: 0,
          factorImpacts: [{ factor: "LABOR_MARKET_STRENGTH", impact: -2, confidence: 0.75 }] },
        { id: "add-0-50k", label: "Add 0-50k jobs", conditionId: "0xf28af1088867e20bae54ed5947edfba3fcd893e4a899eac3d117196ccec65670", outcomeIndex: 0,
          factorImpacts: [{ factor: "LABOR_MARKET_STRENGTH", impact: -1, confidence: 0.70 }] },
        { id: "add-50-100k", label: "Add 50k-100k jobs", conditionId: "0x1a56203a923fa5546a56959432348d073456611692069e0920d9352ea6945dbd", outcomeIndex: 0,
          factorImpacts: [{ factor: "LABOR_MARKET_STRENGTH", impact: 1, confidence: 0.70 }] },
        { id: "add-100-150k", label: "Add 100k-150k jobs", conditionId: "0x0bc329ebbce7ecea6a09f96f6aed0cf9d3210d16ef436fbc8d24669985f7e60f", outcomeIndex: 0,
          factorImpacts: [{ factor: "LABOR_MARKET_STRENGTH", impact: 2, confidence: 0.75 }] },
        { id: "add-150k-plus", label: "Add 150k+ jobs", conditionId: "0x75dac2c6bcf2a0aabb25436620730e3bd93b461bb1faef28f84e708b2802b12f", outcomeIndex: 0,
          factorImpacts: [{ factor: "LABOR_MARKET_STRENGTH", impact: 4, confidence: 0.85 }] },
      ],
    },
    factorExposures: [
      { ticker: "RHI", name: "Robert Half", factor: "LABOR_MARKET_STRENGTH", exposure: 0.85, confidence: 0.80,
        rationale: "Staffing firm — placement volume and pricing are structurally tied to how much companies are hiring, one of the most direct employment-data plays available." },
      { ticker: "MAN", name: "ManpowerGroup", factor: "LABOR_MARKET_STRENGTH", exposure: 0.85, confidence: 0.80,
        rationale: "Staffing firm with the same direct structural exposure to hiring volume as Robert Half." },
      { ticker: "ASGN", name: "ASGN Incorporated", factor: "LABOR_MARKET_STRENGTH", exposure: 0.85, confidence: 0.55,
        rationale: "IT/professional staffing — direct exposure to hiring volume, weighted toward tech/professional roles specifically." },
      { ticker: "ADP", name: "Automatic Data Processing", factor: "LABOR_MARKET_STRENGTH", exposure: 0.55, confidence: 0.80,
        rationale: "Payroll processor — revenue scales with the number of employees on clients' payrolls, a structural (not sentiment-based) link to employment levels." },
      { ticker: "PAYX", name: "Paychex", factor: "LABOR_MARKET_STRENGTH", exposure: 0.55, confidence: 0.80,
        rationale: "Payroll/HR processor, same structural payroll-count exposure as ADP at smaller scale." },
      { ticker: "KFY", name: "Korn Ferry", factor: "LABOR_MARKET_STRENGTH", exposure: 0.55, confidence: 0.55,
        rationale: "Executive search and HR consulting — tied to hiring activity, though skewed toward senior/executive roles rather than broad payrolls." },
      { ticker: "UPWK", name: "Upwork", factor: "LABOR_MARKET_STRENGTH", exposure: 0.20, confidence: 0.30,
        rationale: "Freelance marketplace — a weak jobs report could push some workers toward freelance work (positive) or reflect broader spending pullback that reduces freelance budgets (negative). Small, low-confidence exposure reflects genuine ambiguity rather than a guess." },
    ],
  },
  {
    slug: "openai-ipo",
    title: "OpenAI IPO",
    description:
      "OpenAI itself isn't public, so exposure here runs through disclosed investors/partners, direct compute suppliers, and competitors who could see sentiment or comparison effects if the IPO is confirmed. Unlike the other two themes, this doesn't route through a shared macro factor — it's a single-company event, so exposures below are direct outcome impacts, not factor-mediated (see event-types.ts's DirectCompanyExposure).",
    alternativeScenarioNote:
      "The market prices this IPO timeline as unlikely (~9.5%) — but unlike the other two themes here, the more likely outcome (no IPO by this date) isn't a reversal of the exposures below, just an absence of the catalyst. Microsoft's stake and Nvidia/Oracle/CoreWeave's compute contracts don't become worse if the IPO is delayed — the underlying commercial relationships continue regardless; delay just means no re-rating/liquidity event to react to yet.",
    event: {
      slug: "openai-ipo-by-2026",
      title: "Will OpenAI IPO by December 31, 2026?",
      category: "COMPANY_SPECIFIC",
      resolutionDate: "2026-12-31",
      materiality: 0.85, // outsized significance to the AI/tech sector despite being structurally a single-company event
      outcomes: [
        { id: "ipo", label: "OpenAI completes an IPO by Dec 31, 2026", conditionId: "0x66f5b8203ee1c36b993af623fd7f9ef7271dd87b3aebf6df508048ad4b563432", outcomeIndex: 0, factorImpacts: [] },
        { id: "no-ipo", label: "No OpenAI IPO by Dec 31, 2026", conditionId: "0x66f5b8203ee1c36b993af623fd7f9ef7271dd87b3aebf6df508048ad4b563432", outcomeIndex: 1, factorImpacts: [] },
      ],
      contextMarkets: [
        { conditionId: "0x23e52206ff8a49e4f097ac3b7f32826d930a0b6c76b7902a7858cf2183383c63", label: "Will OpenAI IPO by September 30, 2026? (nearer-term, shown for context only)" },
      ],
    },
    directExposures: [
      { ticker: "MSFT", name: "Microsoft", confidence: 0.80,
        outcomeImpacts: { ipo: 4, "no-ipo": 0 },
        rationale: "OpenAI's largest disclosed investor and commercial partner (Azure compute, revenue-sharing) — an IPO would be the clearest, most direct link of anything in this list." },
      { ticker: "NVDA", name: "Nvidia", confidence: 0.55,
        outcomeImpacts: { ipo: 3, "no-ipo": 0 },
        rationale: "Primary compute/GPU supplier for OpenAI's training and inference workloads; an IPO confirming continued scale reinforces expected demand, though Nvidia's business is far broader than one customer." },
      { ticker: "ORCL", name: "Oracle", confidence: 0.55,
        outcomeImpacts: { ipo: 2, "no-ipo": 0 },
        rationale: "Disclosed large cloud-infrastructure capacity agreements tied to OpenAI's compute buildout." },
      { ticker: "CRWV", name: "CoreWeave", confidence: 0.55,
        outcomeImpacts: { ipo: 3, "no-ipo": 0 },
        rationale: "GPU cloud infrastructure provider with direct compute contracts tied to OpenAI; smaller and more concentrated than the others, so more exposed either way." },
      { ticker: "AMD", name: "Advanced Micro Devices", confidence: 0.30,
        outcomeImpacts: { ipo: 2, "no-ipo": 0 },
        rationale: "Secondary AI compute supplier — benefits from continued AI infrastructure buildout broadly, less directly tied to OpenAI specifically than Nvidia." },
      { ticker: "AVGO", name: "Broadcom", confidence: 0.30,
        outcomeImpacts: { ipo: 2, "no-ipo": 0 },
        rationale: "Reported custom AI silicon work with OpenAI — a real but less publicly detailed relationship than the compute/cloud names above." },
      { ticker: "GOOGL", name: "Alphabet", confidence: 0.30,
        outcomeImpacts: { ipo: 0, "no-ipo": 0 },
        rationale: "Direct competitor via Gemini — an OpenAI IPO could validate the sector broadly (positive spillover) or sharpen competitive/valuation comparisons (negative). Net impact set to 0 (genuinely offsetting), not guessed in either direction." },
      { ticker: "META", name: "Meta Platforms", confidence: 0.30,
        outcomeImpacts: { ipo: 0, "no-ipo": 0 },
        rationale: "Competing AI lab (Llama) — same offsetting comparison-effect logic as Alphabet, with less direct product overlap." },
    ],
  },
];
