// Curated, hand-authored mapping from Polymarket prediction markets to
// stocks that could plausibly be affected by their outcome. Deliberately
// NOT auto-generated: there's no classification pipeline in this codebase,
// and inferring causal relationships between an event and a stock is a
// judgment call, not a query. Every exposure below carries an explicit
// direction/strength/confidence/explanation so degrees of uncertainty are
// visible rather than presented as fact — never treat a "positive"
// direction or "high" confidence as a prediction of what a stock will do.
//
// direction is CONDITIONAL — "if `condition` happens, this stock is
// affected this way" — not a statement about current likelihood. A first
// version of this file showed direction badges with no visible connection
// to how likely the condition currently is (e.g. "Positive" for MSFT next
// to an OpenAI-IPO-by-date market priced at ~1-10% Yes), which reads as
// contradictory if you don't separately notice the tracked-market price.
// Every exposure now carries its own `condition` string so the badge is
// self-explanatory without cross-referencing a Yes/No column, and each
// theme names a `primaryMarketConditionId`/`primaryMarketOutcomeIndex` so
// the UI can show "how likely is the thing these exposures are conditioned
// on" as one explicit number, right next to the stock list.
//
// That primary market's outcome index matters: Polymarket questions aren't
// consistently phrased in the same direction (e.g. the Fed theme's first
// tracked market is "Will NO cuts happen" — Yes there means the opposite
// of what most exposures below are conditioned on). Each theme's primary
// reference below was picked specifically because it's already phrased in
// the same direction as `condition`, so no manual inversion is needed —
// verify this holds before adding a new theme rather than assuming outcome
// index 0 is always "the condition."
//
// v1 scope: live current probability only, no history yet (see
// lib/catalysts/polymarket.ts). Themes and exposures are static config
// for now rather than a database table, so the stock picks can be
// iterated on quickly before committing to a schema.

export type Direction = "positive" | "negative" | "mixed";
export type Strength = "high" | "medium" | "low";

export interface TrackedMarket {
  conditionId: string;
  label: string; // shown as-is; kept close to Polymarket's own question text
}

export interface StockExposure {
  ticker: string;
  name: string;
  direction: Direction;
  exposureStrength: Strength;
  confidence: Strength;
  condition: string; // plain language, e.g. "if the Fed cuts rates in 2026" — what direction is conditioned on
  explanation: string;
}

export interface MacroTheme {
  slug: string;
  title: string;
  description: string;
  conditionLabel: string; // plain language name for the condition exposures are keyed to
  primaryMarketConditionId: string; // must be one of markets[].conditionId
  primaryMarketOutcomeIndex: number; // which outcome price represents conditionLabel being true
  // What the market currently prices as MORE likely than conditionLabel,
  // and what that means for the exposures below — required, not optional,
  // because every theme here has had a condition priced under 15% (a
  // genuinely unlikely scenario), and showing only the "if this happens"
  // side without saying what's actually favored right now reads as if the
  // unlikely scenario were the headline case. The right framing differs
  // per theme: a Fed cut vs. hike genuinely reverses most exposures below,
  // while OpenAI not IPO'ing by a given date is a non-event for its
  // investors/partners, not a negative one — write this per-theme, don't
  // assume "the opposite" is always a mirror-image reversal.
  alternativeScenarioNote: string;
  markets: TrackedMarket[];
  exposures: StockExposure[];
}

export const MACRO_THEMES: MacroTheme[] = [
  {
    slug: "fed-rate-policy",
    title: "Fed Rate Policy",
    description:
      "Whether the Fed cuts, holds, or hikes affects borrowing costs and the discount rate applied to future earnings — with real, sector-dependent effects rather than a single across-the-board direction.",
    conditionLabel: "Fed cuts the federal funds rate at the September 2026 FOMC meeting (any cut, 25bps+)",
    alternativeScenarioNote:
      "As of this writing the market prices a hike (71.5%) as far more likely than a cut (0.65%) at this meeting — a cut is the minority scenario, included here because it has clear, fairly consistent sector winners, not because it's expected. A hike would generally reverse most of the exposures below: negative for the rate-sensitive lenders/homebuilders/REITs, and more supportive of bank net interest margins than a cut would be (the opposite of the \"mixed\" call on JPM/ALLY below).",
    primaryMarketConditionId: "0xb4022c0b2718eca7ad27195f2d48f06527fa000269d188e1d3001ff8bbc16956",
    primaryMarketOutcomeIndex: 0, // "Fed rate cut by September 2026 meeting?" — Yes = cut happens
    markets: [
      { conditionId: "0xb4022c0b2718eca7ad27195f2d48f06527fa000269d188e1d3001ff8bbc16956", label: "Fed rate cut by September 2026 meeting?" },
      { conditionId: "0xd4e77ba6f29fc093509d24f508631abd445ecf506bbdc9c4c80e60256a318527", label: "Will no Fed rate cuts happen in 2026? (inverse framing — Yes here means NO cuts)" },
      { conditionId: "0x80b3af88cb991980e8da1ce86b9794a0957f96ec98c29319dd7ba65e9744d82b", label: "Fed rate hike in 2026?" },
    ],
    exposures: [
      { ticker: "SOFI", name: "SoFi Technologies", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Fintech lender — lower rates typically reduce funding costs and can boost loan demand, though this is a general sector pattern, not a guarantee for this specific company." },
      { ticker: "UPST", name: "Upstart Holdings", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "AI lending marketplace whose loan origination volume has historically been sensitive to rate levels." },
      { ticker: "DHI", name: "D.R. Horton", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Homebuilder — lower rates generally reduce mortgage rates, historically associated with stronger new-home demand." },
      { ticker: "LEN", name: "Lennar", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Homebuilder with the same mortgage-rate sensitivity as D.R. Horton." },
      { ticker: "PHM", name: "PulteGroup", direction: "positive", exposureStrength: "medium", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Homebuilder, same rate-sensitivity logic, somewhat smaller scale exposure than DHI/LEN." },
      { ticker: "RKT", name: "Rocket Companies", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Mortgage originator/servicer — refinancing and origination volume are directly tied to mortgage rate levels." },
      { ticker: "O", name: "Realty Income", direction: "positive", exposureStrength: "medium", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "REIT — lower rates reduce financing costs and can make REIT dividend yields relatively more attractive to income investors." },
      { ticker: "COIN", name: "Coinbase", direction: "positive", exposureStrength: "medium", confidence: "low",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Risk-asset-adjacent business; lower rates have historically coincided with more risk appetite, but this link is looser and less direct than the others here." },
      { ticker: "JPM", name: "JPMorgan Chase", direction: "mixed", exposureStrength: "high", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Large bank — cuts can support loan growth and credit demand, but also compress net interest margin. Effect isn't one-directional." },
      { ticker: "ALLY", name: "Ally Financial", direction: "mixed", exposureStrength: "medium", confidence: "medium",
        condition: "if the Fed cuts rates (any size cut) at the September 2026 FOMC meeting",
        explanation: "Auto lender/digital bank — similar mixed loan-growth-vs-margin dynamic as JPM, at smaller scale." },
    ],
  },
  {
    slug: "august-2026-jobs-report",
    title: "August 2026 Jobs Report",
    description:
      "Employment data most directly affects companies structurally tied to hiring volume (staffing, payroll processing) — a weaker print also feeds into Fed rate-cut odds (see the Fed Rate Policy theme), but that's a second-order, regime-dependent relationship and is deliberately not re-listed here. \"Weak\" and \"strong\" below are defined by the exact brackets Polymarket's own market uses, not a subjective call.",
    conditionLabel: "August nonfarm payrolls print weak — net job losses, or fewer than 50,000 jobs added",
    alternativeScenarioNote:
      "Per current pricing, a weak print (~12%) is the minority scenario — the market leans toward 50k+ jobs added (the \"add between 50k and 100k\" bucket alone is priced at 30%). The exposures below describe the weak case; a moderate-or-stronger report would generally reverse them — neutral-to-positive rather than negative for the staffing/payroll names, since more hiring activity means more placements and larger payrolls to process.",
    primaryMarketConditionId: "0xb72571fb88a793a38be9a5104e3adb19a5ff886e339e1e5cb14e98fc2ae44e59",
    // "Will the US lose more than 50k jobs in August?" — Yes = weak print.
    // Note this is a narrower slice of "weak" than the exposures' own
    // definition (net loss OR under 50k added): Polymarket also prices a
    // separate "lose 0-50k" bucket and an "add 0-50k" bucket that would
    // also count as weak by that definition but aren't tracked as their
    // own line below — this number is a lower-bound proxy for "weak," not
    // its exact probability.
    primaryMarketOutcomeIndex: 0,
    // Polymarket reuses generic titles like "How many jobs added in
    // August?" every year with no year in the question text — the first
    // pass here accidentally picked up the already-resolved AUGUST 2025
    // version. These conditionIds are from the correct 2026-dated event
    // (confirmed via its endDate: 2026-09-05), which is still open as of
    // this writing.
    markets: [
      { conditionId: "0xb72571fb88a793a38be9a5104e3adb19a5ff886e339e1e5cb14e98fc2ae44e59", label: "Will the US lose more than 50k jobs in August?" },
      { conditionId: "0x1a56203a923fa5546a56959432348d073456611692069e0920d9352ea6945dbd", label: "Will the US add between 50k and 100k jobs in August?" },
      { conditionId: "0x75dac2c6bcf2a0aabb25436620730e3bd93b461bb1faef28f84e708b2802b12f", label: "Will the US add at least 150k jobs in August?" },
    ],
    exposures: [
      { ticker: "RHI", name: "Robert Half", direction: "negative", exposureStrength: "high", confidence: "high",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "Staffing firm — placement volume and pricing are structurally tied to how much companies are hiring, one of the most direct employment-data plays available." },
      { ticker: "MAN", name: "ManpowerGroup", direction: "negative", exposureStrength: "high", confidence: "high",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "Staffing firm with the same direct structural exposure to hiring volume as Robert Half." },
      { ticker: "ASGN", name: "ASGN Incorporated", direction: "negative", exposureStrength: "high", confidence: "medium",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "IT/professional staffing — direct exposure to hiring volume, weighted toward tech/professional roles specifically." },
      { ticker: "ADP", name: "Automatic Data Processing", direction: "negative", exposureStrength: "medium", confidence: "high",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "Payroll processor — revenue scales with the number of employees on clients' payrolls, a structural (not sentiment-based) link to employment levels." },
      { ticker: "PAYX", name: "Paychex", direction: "negative", exposureStrength: "medium", confidence: "high",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "Payroll/HR processor, same structural payroll-count exposure as ADP at smaller scale." },
      { ticker: "KFY", name: "Korn Ferry", direction: "negative", exposureStrength: "medium", confidence: "medium",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "Executive search and HR consulting — tied to hiring activity, though skewed toward senior/executive roles rather than broad payrolls." },
      { ticker: "UPWK", name: "Upwork", direction: "mixed", exposureStrength: "medium", confidence: "low",
        condition: "if August payrolls print weak (net job losses, or fewer than 50,000 jobs added)",
        explanation: "Freelance marketplace — a weak jobs report could push some workers toward freelance work (positive) or reflect broader spending pullback that reduces freelance budgets (negative). Genuinely ambiguous, flagged as low confidence rather than guessed." },
    ],
  },
  {
    slug: "openai-ipo",
    title: "OpenAI IPO",
    description:
      "OpenAI itself isn't public, so exposure here runs through disclosed investors/partners, direct compute suppliers, and competitors who could see sentiment or comparison effects if the IPO is confirmed.",
    conditionLabel: "OpenAI completes an IPO by December 31, 2026",
    alternativeScenarioNote:
      "The market prices this IPO timeline as unlikely (~9.5%) — but unlike the other two themes here, the more likely outcome (no IPO by this date) isn't a reversal of the exposures below, just an absence of the catalyst. Microsoft's stake and Nvidia/Oracle/CoreWeave's compute contracts don't become worse if the IPO is delayed — the underlying commercial relationships continue regardless; delay just means no re-rating/liquidity event to react to yet.",
    primaryMarketConditionId: "0x66f5b8203ee1c36b993af623fd7f9ef7271dd87b3aebf6df508048ad4b563432",
    primaryMarketOutcomeIndex: 0, // "Will OpenAI IPO by December 31 2026?" — Yes = IPO happens
    markets: [
      { conditionId: "0x66f5b8203ee1c36b993af623fd7f9ef7271dd87b3aebf6df508048ad4b563432", label: "Will OpenAI IPO by December 31 2026?" },
      { conditionId: "0x23e52206ff8a49e4f097ac3b7f32826d930a0b6c76b7902a7858cf2183383c63", label: "Will OpenAI IPO by September 30 2026?" },
    ],
    exposures: [
      { ticker: "MSFT", name: "Microsoft", direction: "positive", exposureStrength: "high", confidence: "high",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "OpenAI's largest disclosed investor and commercial partner (Azure compute, revenue-sharing) — an IPO would be the clearest, most direct link of anything in this list. The market currently prices this as unlikely by year-end (see probability above) — this is a low-current-odds, if-then relationship, not an active tailwind right now." },
      { ticker: "NVDA", name: "Nvidia", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "Primary compute/GPU supplier for OpenAI's training and inference workloads; an IPO confirming continued scale reinforces expected demand, though Nvidia's business is far broader than one customer." },
      { ticker: "ORCL", name: "Oracle", direction: "positive", exposureStrength: "medium", confidence: "medium",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "Disclosed large cloud-infrastructure capacity agreements tied to OpenAI's compute buildout." },
      { ticker: "CRWV", name: "CoreWeave", direction: "positive", exposureStrength: "high", confidence: "medium",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "GPU cloud infrastructure provider with direct compute contracts tied to OpenAI; smaller and more concentrated than the others, so more exposed either way." },
      { ticker: "AMD", name: "Advanced Micro Devices", direction: "positive", exposureStrength: "medium", confidence: "low",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "Secondary AI compute supplier — benefits from continued AI infrastructure buildout broadly, less directly tied to OpenAI specifically than Nvidia." },
      { ticker: "AVGO", name: "Broadcom", direction: "positive", exposureStrength: "medium", confidence: "low",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "Reported custom AI silicon work with OpenAI — a real but less publicly detailed relationship than the compute/cloud names above." },
      { ticker: "GOOGL", name: "Alphabet", direction: "mixed", exposureStrength: "medium", confidence: "low",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "Direct competitor via Gemini — an OpenAI IPO could validate the sector broadly (positive spillover) or sharpen competitive/valuation comparisons (negative). Genuinely could go either way." },
      { ticker: "META", name: "Meta Platforms", direction: "mixed", exposureStrength: "low", confidence: "low",
        condition: "if OpenAI completes an IPO by December 31, 2026",
        explanation: "Competing AI lab (Llama) — same ambiguous comparison-effect logic as Alphabet, with less direct product overlap." },
    ],
  },
];
