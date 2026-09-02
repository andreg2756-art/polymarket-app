// Curated, hand-authored mapping from Polymarket prediction markets to
// stocks that could plausibly be affected by their outcome. Deliberately
// NOT auto-generated: there's no classification pipeline in this codebase,
// and inferring causal relationships between an event and a stock is a
// judgment call, not a query. Every exposure below carries an explicit
// direction/strength/confidence/explanation so degrees of uncertainty are
// visible rather than presented as fact — never treat a "positive"
// direction or "high" confidence as a prediction of what a stock will do.
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
  explanation: string;
}

export interface MacroTheme {
  slug: string;
  title: string;
  description: string;
  markets: TrackedMarket[];
  exposures: StockExposure[];
}

export const MACRO_THEMES: MacroTheme[] = [
  {
    slug: "fed-rate-policy",
    title: "Fed Rate Policy",
    description:
      "Whether the Fed cuts, holds, or hikes affects borrowing costs and the discount rate applied to future earnings — with real, sector-dependent effects rather than a single across-the-board direction.",
    markets: [
      { conditionId: "0xd4e77ba6f29fc093509d24f508631abd445ecf506bbdc9c4c80e60256a318527", label: "Will no Fed rate cuts happen in 2026?" },
      { conditionId: "0xb4022c0b2718eca7ad27195f2d48f06527fa000269d188e1d3001ff8bbc16956", label: "Fed rate cut by September 2026 meeting?" },
      { conditionId: "0x80b3af88cb991980e8da1ce86b9794a0957f96ec98c29319dd7ba65e9744d82b", label: "Fed rate hike in 2026?" },
    ],
    exposures: [
      { ticker: "SOFI", name: "SoFi Technologies", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "Fintech lender — lower rates typically reduce funding costs and can boost loan demand, though this is a general sector pattern, not a guarantee for this specific company." },
      { ticker: "UPST", name: "Upstart Holdings", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "AI lending marketplace whose loan origination volume has historically been sensitive to rate levels." },
      { ticker: "DHI", name: "D.R. Horton", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "Homebuilder — lower rates generally reduce mortgage rates, historically associated with stronger new-home demand." },
      { ticker: "LEN", name: "Lennar", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "Homebuilder with the same mortgage-rate sensitivity as D.R. Horton." },
      { ticker: "PHM", name: "PulteGroup", direction: "positive", exposureStrength: "medium", confidence: "medium",
        explanation: "Homebuilder, same rate-sensitivity logic, somewhat smaller scale exposure than DHI/LEN." },
      { ticker: "RKT", name: "Rocket Companies", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "Mortgage originator/servicer — refinancing and origination volume are directly tied to mortgage rate levels." },
      { ticker: "O", name: "Realty Income", direction: "positive", exposureStrength: "medium", confidence: "medium",
        explanation: "REIT — lower rates reduce financing costs and can make REIT dividend yields relatively more attractive to income investors." },
      { ticker: "COIN", name: "Coinbase", direction: "positive", exposureStrength: "medium", confidence: "low",
        explanation: "Risk-asset-adjacent business; lower rates have historically coincided with more risk appetite, but this link is looser and less direct than the others here." },
      { ticker: "JPM", name: "JPMorgan Chase", direction: "mixed", exposureStrength: "high", confidence: "medium",
        explanation: "Large bank — cuts can support loan growth and credit demand, but also compress net interest margin. Effect isn't one-directional." },
      { ticker: "ALLY", name: "Ally Financial", direction: "mixed", exposureStrength: "medium", confidence: "medium",
        explanation: "Auto lender/digital bank — similar mixed loan-growth-vs-margin dynamic as JPM, at smaller scale." },
    ],
  },
  {
    slug: "august-2026-jobs-report",
    title: "August 2026 Jobs Report",
    description:
      "Employment data most directly affects companies structurally tied to hiring volume (staffing, payroll processing) — a weaker print also feeds into Fed rate-cut odds (see the Fed Rate Policy theme), but that's a second-order, regime-dependent relationship and is deliberately not re-listed here.",
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
        explanation: "Staffing firm — placement volume and pricing are structurally tied to how much companies are hiring, one of the most direct employment-data plays available." },
      { ticker: "MAN", name: "ManpowerGroup", direction: "negative", exposureStrength: "high", confidence: "high",
        explanation: "Staffing firm with the same direct structural exposure to hiring volume as Robert Half." },
      { ticker: "ASGN", name: "ASGN Incorporated", direction: "negative", exposureStrength: "high", confidence: "medium",
        explanation: "IT/professional staffing — direct exposure to hiring volume, weighted toward tech/professional roles specifically." },
      { ticker: "ADP", name: "Automatic Data Processing", direction: "negative", exposureStrength: "medium", confidence: "high",
        explanation: "Payroll processor — revenue scales with the number of employees on clients' payrolls, a structural (not sentiment-based) link to employment levels." },
      { ticker: "PAYX", name: "Paychex", direction: "negative", exposureStrength: "medium", confidence: "high",
        explanation: "Payroll/HR processor, same structural payroll-count exposure as ADP at smaller scale." },
      { ticker: "KFY", name: "Korn Ferry", direction: "negative", exposureStrength: "medium", confidence: "medium",
        explanation: "Executive search and HR consulting — tied to hiring activity, though skewed toward senior/executive roles rather than broad payrolls." },
      { ticker: "UPWK", name: "Upwork", direction: "mixed", exposureStrength: "medium", confidence: "low",
        explanation: "Freelance marketplace — a weak jobs report could push some workers toward freelance work (positive) or reflect broader spending pullback that reduces freelance budgets (negative). Genuinely ambiguous, flagged as low confidence rather than guessed." },
    ],
  },
  {
    slug: "openai-ipo",
    title: "OpenAI IPO",
    description:
      "OpenAI itself isn't public, so exposure here runs through disclosed investors/partners, direct compute suppliers, and competitors who could see sentiment or comparison effects if the IPO is confirmed.",
    markets: [
      { conditionId: "0x23e52206ff8a49e4f097ac3b7f32826d930a0b6c76b7902a7858cf2183383c63", label: "Will OpenAI IPO by September 30 2026?" },
      { conditionId: "0x66f5b8203ee1c36b993af623fd7f9ef7271dd87b3aebf6df508048ad4b563432", label: "Will OpenAI IPO by December 31 2026?" },
    ],
    exposures: [
      { ticker: "MSFT", name: "Microsoft", direction: "positive", exposureStrength: "high", confidence: "high",
        explanation: "OpenAI's largest disclosed investor and commercial partner (Azure compute, revenue-sharing) — an IPO would be the clearest, most direct link of anything in this list." },
      { ticker: "NVDA", name: "Nvidia", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "Primary compute/GPU supplier for OpenAI's training and inference workloads; an IPO confirming continued scale reinforces expected demand, though Nvidia's business is far broader than one customer." },
      { ticker: "ORCL", name: "Oracle", direction: "positive", exposureStrength: "medium", confidence: "medium",
        explanation: "Disclosed large cloud-infrastructure capacity agreements tied to OpenAI's compute buildout." },
      { ticker: "CRWV", name: "CoreWeave", direction: "positive", exposureStrength: "high", confidence: "medium",
        explanation: "GPU cloud infrastructure provider with direct compute contracts tied to OpenAI; smaller and more concentrated than the others, so more exposed either way." },
      { ticker: "AMD", name: "Advanced Micro Devices", direction: "positive", exposureStrength: "medium", confidence: "low",
        explanation: "Secondary AI compute supplier — benefits from continued AI infrastructure buildout broadly, less directly tied to OpenAI specifically than Nvidia." },
      { ticker: "AVGO", name: "Broadcom", direction: "positive", exposureStrength: "medium", confidence: "low",
        explanation: "Reported custom AI silicon work with OpenAI — a real but less publicly detailed relationship than the compute/cloud names above." },
      { ticker: "GOOGL", name: "Alphabet", direction: "mixed", exposureStrength: "medium", confidence: "low",
        explanation: "Direct competitor via Gemini — an OpenAI IPO could validate the sector broadly (positive spillover) or sharpen competitive/valuation comparisons (negative). Genuinely could go either way." },
      { ticker: "META", name: "Meta Platforms", direction: "mixed", exposureStrength: "low", confidence: "low",
        explanation: "Competing AI lab (Llama) — same ambiguous comparison-effect logic as Alphabet, with less direct product overlap." },
    ],
  },
];
