/**
 * taxonomy.js — Canonical codes for exceptions and qualifiers.
 *
 * When the parser extracts free-text "permitted exceptions", "materiality
 * qualifiers", "consent standards", or "efforts standards" from a provision,
 * it ALSO maps each one to a canonical code from this taxonomy so that
 * equivalent concepts can be compared across deals (regardless of how the
 * drafters phrased them).
 *
 * Each canonical "tagged" item has the shape:
 *   { code: "WHOLLY_OWNED_SUB", label: "Transactions among wholly-owned
 *     subsidiaries", text: "<verbatim excerpt from the agreement>" }
 *
 * CommonJS so it can be required from both the parser (Node/API routes) and
 * the Next.js client bundle.
 */

// ---------------------------------------------------------------------------
// Permitted exceptions / carve-outs found inside provisions
// ---------------------------------------------------------------------------

const EXCEPTION_CODES = {
  // IOC permitted exceptions
  WHOLLY_OWNED_SUB: 'Transactions among wholly-owned subsidiaries',
  EQUITY_AWARD_MECHANICS: 'Existing equity award exercises, vesting, or settlement',
  EXISTING_FACILITIES: 'Existing credit facilities or indebtedness',
  ORDINARY_COURSE: 'Ordinary course of business',
  DISCLOSURE_SCHEDULE: 'As set forth in disclosure schedule',
  COMPANY_DISCLOSURE_LETTER: 'As set forth in the Company Disclosure Letter (specific section cite)',
  REQUIRED_BY_LAW: 'As required by law or governmental authority',
  REQUIRED_BY_AGREEMENT: 'As expressly required or contemplated by this Agreement',
  WRITTEN_CONSENT: 'With prior written consent of counterparty',
  PRIOR_WRITTEN_CONSENT: 'With prior written consent of Parent / counterparty (not to be unreasonably withheld)',
  COVID_MEASURES: 'COVID-19 / pandemic response measures',
  EXISTING_CONTRACTS: 'Pursuant to existing contracts as of signing',
  TAX_WITHHOLDING: 'Tax withholding or similar mandated actions',
  INTERCOMPANY: 'Intercompany transactions',
  TRADE_PAYABLES: 'Trade payables in ordinary course',
  EMERGENCY_LIFE_SAFETY: 'Emergency, life, or safety reasons',

  // NOSOL exceptions
  FIDUCIARY_OUT: 'Fiduciary out for Superior Proposal',
  UNSOLICITED_PROPOSAL: 'Response to unsolicited acquisition proposal',
  ACCEPTABLE_CONFI_AGREEMENT: 'Information sharing under acceptable confidentiality agreement',

  // ANTI exceptions
  BURDENSOME_CONDITION_CAP: 'Subject to burdensome condition cap',

  // Generic
  OTHER: 'Other specific exception (see text)',
};

// ---------------------------------------------------------------------------
// Materiality / scope qualifiers (used by bring-down standards, reps, etc.)
// ---------------------------------------------------------------------------

const MATERIALITY_CODES = {
  MAT_ALL_RESPECTS: 'True and correct in all respects',
  MAT_ALL_RESPECTS_DE_MINIMIS: 'True except for de minimis inaccuracies',
  MAT_ALL_MATERIAL: 'In all material respects',
  // NEW — split MAT_ALL_MATERIAL into two scope-specific variants:
  //   - Whole-rep: "Except as would not be material to the Company" / "the
  //     accuracy of the entire rep is qualified by materiality to the Co"
  //   - Inline: materiality is a substantive element of the rep's content
  //     (e.g. "the Company has materially complied", "all material contracts
  //     have been delivered", "no material breach of") — the rep's text
  //     itself uses "material" as a modifier, not as an accuracy threshold
  //     applied to the whole rep.
  MAT_MATERIAL_TO_COMPANY: 'Materiality to the Company (whole rep)',
  MAT_MATERIAL_INLINE: 'Materiality inline within the rep',
  MAT_MAE_QUALIFIED: 'True except where failure would not have an MAE',
  MAT_MAE_AGGREGATE: 'Would not, individually or in aggregate, have MAE',
  MAT_DE_MINIMIS: 'Except for de minimis inaccuracies',
  MAT_MATERIALITY_SCRAPE: 'Materiality qualifiers disregarded for bring-down',
  MAT_KNOWLEDGE: 'Knowledge qualifier (best knowledge / actual knowledge)',
  MAT_WILLFUL_BREACH: 'Willful breach standard',
  MAT_INTENTIONAL_BREACH: 'Intentional breach standard',
  MAT_NO_QUALIFIER: 'No materiality qualifier',
};

// ---------------------------------------------------------------------------
// Consent standards (who decides, and with how much friction)
// ---------------------------------------------------------------------------

const CONSENT_STANDARDS = {
  PRIOR_WRITTEN: 'Prior written consent',
  NOT_UNREASONABLY_WITHHELD: 'Consent not to be unreasonably withheld, conditioned, or delayed',
  SOLE_DISCRETION: 'In sole discretion',
  REASONABLE_CONSENT: 'Reasonable consent',
  AUTOMATIC_DEEMED: 'Deemed given after X days',
  NO_CONSENT_REQUIRED: 'No consent required',
};

// ---------------------------------------------------------------------------
// Efforts standards (the level of effort a party must apply)
// ---------------------------------------------------------------------------

const EFFORTS_STANDARDS = {
  BEST_EFFORTS: 'Best efforts',
  REASONABLE_BEST_EFFORTS: 'Reasonable best efforts',
  COMMERCIALLY_REASONABLE_EFFORTS: 'Commercially reasonable efforts',
  REASONABLE_EFFORTS: 'Reasonable efforts',
  GOOD_FAITH_EFFORTS: 'Good faith efforts',
  HELL_OR_HIGH_WATER: 'Hell or high water',
};

// ---------------------------------------------------------------------------
// Party scope (which side of the deal a provision / obligation applies to)
// ---------------------------------------------------------------------------

const APPLIES_TO_PARTY = {
  PARTY_PARENT: 'Applies to Parent / Buyer only',
  PARTY_COMPANY: 'Applies to Company / Target only',
  PARTY_MUTUAL: 'Applies to both parties (mutual)',
};

// ---------------------------------------------------------------------------
// Antitrust strategy control (ANTI-COOPERATE) — which party controls the
// regulatory / antitrust strategy. "Silent" is itself a meaningful data point
// for cross-deal comparison, so it gets its own canonical code.
// ---------------------------------------------------------------------------

const ANTITRUST_CONTROL = {
  CONTROL_PARENT: 'Parent / Buyer controls strategy',
  CONTROL_COMPANY: 'Company / Target controls strategy',
  CONTROL_SHARED: 'Mutual / shared control',
  CONTROL_SILENT: 'Agreement is silent on control',
};

// ---------------------------------------------------------------------------
// Termination party (TERMR provisions) — who can terminate
// ---------------------------------------------------------------------------
//
// Per fix #4: normalize "either" and "mutual" to the same canonical value
// (PARTY_MUTUAL). The AI prompt is instructed to never emit "either" — use
// "mutual" when both parties can terminate.
//
const TERMINATION_PARTY = {
  PARTY_MUTUAL: 'Mutual (both parties)',
  PARTY_BUYER: 'Buyer / Parent only',
  PARTY_TARGET: 'Target / Company only',
};

// ---------------------------------------------------------------------------
// Equity awards (CONSID-EQUITY) — outstanding instruments
// ---------------------------------------------------------------------------

const EQUITY_INSTRUMENTS = {
  STOCK_OPTIONS: 'Stock Options',
  RSUs: 'Restricted Stock Units (RSUs)',
  PSUs: 'Performance Stock Units (PSUs)',
  RESTRICTED_STOCK: 'Restricted Stock Awards',
  WARRANTS: 'Warrants',
  ESPP: 'Employee Stock Purchase Plan rights',
  CONVERTIBLE_NOTES: 'Convertible Notes',
  SARS: 'Stock Appreciation Rights',
  PHANTOM_STOCK: 'Phantom Stock',
  DEFERRED_COMPENSATION: 'Deferred Compensation Awards',
};

// ---------------------------------------------------------------------------
// Equity awards — treatment at closing (per instrument)
// ---------------------------------------------------------------------------

const EQUITY_TREATMENT = {
  CASHED_OUT_AT_CONSIDERATION: 'Cashed out at Merger Consideration',
  CASHED_OUT_SPREAD: 'Cashed Out at Spread',
  ACCELERATED_VESTING: 'Vesting accelerated and cashed out',
  PARTIAL_ACCELERATION: 'Partial vesting acceleration',
  ASSUMED_BY_BUYER: 'Assumed and converted to buyer equity',
  CANCELLED_NO_CONSIDERATION: 'Cancelled without consideration',
  CONTINUED_VESTING: 'Continues vesting on original schedule (no change)',
  REPLACEMENT_AWARDS: 'Cancelled and replaced with retention awards',
  DOUBLE_TRIGGER: 'Double-trigger acceleration (closing + qualifying termination)',
  PARACHUTE_LIMITED: 'Subject to 280G parachute payment limits',
};

// ---------------------------------------------------------------------------
// Equity awards — vesting status at/after closing
// ---------------------------------------------------------------------------

const VESTING_STATUS = {
  FULLY_ACCELERATED: 'Fully accelerated at closing',
  PARTIALLY_ACCELERATED: 'Partially accelerated at closing',
  DOUBLE_TRIGGER_ACCEL: 'Acceleration on double trigger (closing + termination)',
  // Compound case common to options: vests at closing IF it vests by its terms
  // on the deal, OTHERWISE the consideration rolls over subject to the original
  // (often double-trigger) vesting schedule.
  ACCEL_ELSE_DOUBLE_TRIGGER: 'Accelerates if it vests by its terms; otherwise rolls over subject to double-trigger vesting',
  NO_ACCELERATION: 'No acceleration; continues vesting',
  TIME_BASED_VESTING: 'Time-based vesting per original schedule',
  PERFORMANCE_DEEMED_ACHIEVED: 'Performance conditions deemed achieved',
  PERFORMANCE_PRORATED: 'Performance conditions prorated',
};

// ---------------------------------------------------------------------------
// Employee matters (COV-EMPLOYEE) — comp/benefit items and their standards
// ---------------------------------------------------------------------------
//
// The Employee Matters covenant is heavily negotiated and lawyers compare
// deals on a per-item basis: e.g. Deal A says "no less favorable" for base
// salary but "in the aggregate" for benefits; Deal B says "no less favorable"
// for ALL items. That distinction matters, so each comp/benefit item carries
// its OWN standard rather than rolling up under a single section-wide one.

const COMP_STANDARDS = {
  NO_LESS_FAVORABLE: 'No less favorable than current',
  SUBSTANTIALLY_SIMILAR: 'Substantially similar to current',
  SUBSTANTIALLY_COMPARABLE: 'Substantially comparable to current',
  IN_THE_AGGREGATE: 'In the aggregate (rebalancing permitted)',
  COMPARABLE_TO_BUYER_EMPLOYEES: 'Comparable to similarly situated buyer employees',
  BUYER_DISCRETION: 'At buyer\'s discretion',
  TARGET_BASELINE: 'At target\'s pre-closing levels',
};

const COMP_ITEMS = {
  BASE_SALARY: 'Base salary',
  TARGET_BONUS: 'Target annual bonus / cash incentive',
  ANNUAL_BONUS_PAID: 'Earned annual bonus (pro-rata)',
  LONG_TERM_INCENTIVE: 'Long-term incentive (LTI) / equity grants',
  HEALTH_WELFARE: 'Health and welfare benefits',
  RETIREMENT: 'Retirement / 401(k) benefits',
  SEVERANCE: 'Severance / change-in-control protection',
  PTO: 'Paid time off / vacation',
  EQUITY_AWARDS: 'Equity / stock awards (new grants)',
  OTHER_BENEFITS: 'Other benefits',
};

// ---------------------------------------------------------------------------
// Merger Forms (STRUCT-MERGER) — the canonical deal structure
// ---------------------------------------------------------------------------
//
// Each entry below has shape:
//   { code, label, synonyms: [regex] }
// The synonyms allow legacy free-text values (e.g. "reverse triangular
// merger") to be normalized by the parser without re-ingesting.
//
// IMPORTANT: do NOT export the raw shape — extract a plain { CODE: label }
// dictionary at the end of the file so the rest of the codebase can treat
// the dictionary uniformly. The synonym/label table is exported separately
// as MERGER_FORMS_META for normalization helpers.

const MERGER_FORMS_META = {
  ONE_STEP_MERGER: {
    label: 'One-step merger',
    synonyms: [/one[\s-]*step\s+merger/i, /single[\s-]*step\s+merger/i],
  },
  TWO_STEP_TENDER_OFFER: {
    label: 'Two-step tender offer',
    synonyms: [/two[\s-]*step/i, /tender\s+offer/i, /exchange\s+offer\s+followed\s+by/i],
  },
  REVERSE_TRIANGULAR_MERGER: {
    label: 'Reverse triangular merger',
    synonyms: [/reverse\s+triangular/i],
  },
  FORWARD_TRIANGULAR_MERGER: {
    label: 'Forward triangular merger',
    synonyms: [/forward\s+triangular/i],
  },
  DOUBLE_DUMMY: {
    label: 'Double dummy',
    synonyms: [/double[\s-]*dummy/i, /two\s+merger\s+sub/i],
  },
  ASSET_PURCHASE: {
    label: 'Asset purchase',
    synonyms: [/asset\s+(?:purchase|sale|acquisition)/i],
  },
  STOCK_PURCHASE: {
    label: 'Stock purchase',
    synonyms: [/stock\s+(?:purchase|sale|acquisition)/i, /share\s+purchase\s+agreement/i],
  },
  SCHEME_OF_ARRANGEMENT: {
    label: 'Scheme of arrangement',
    synonyms: [/scheme\s+of\s+arrangement/i],
  },
  AMALGAMATION: {
    label: 'Amalgamation',
    synonyms: [/amalgamation/i],
  },
  STATUTORY_MERGER: {
    label: 'Statutory merger',
    synonyms: [/statutory\s+merger/i, /direct\s+merger/i],
  },
  REDOMICILIATION: {
    label: 'Redomiciliation / Reincorporation',
    synonyms: [/redomicil/i, /reincorporat/i, /redomiciliation/i],
  },
  OTHER: {
    label: 'Other / not applicable',
    synonyms: [],
  },
};

// ---------------------------------------------------------------------------
// MAE Carve-Outs (DEF/MAE) — canonical categorization of every typical
// material-adverse-effect carve-out a Paul Weiss diligence checklist tracks
// across deals. Each carve-out can be subject to a disproportionate-impact
// carveback at the deal level.
// ---------------------------------------------------------------------------

const MAE_CARVEOUT_META = {
  ECONOMY_GENERAL: {
    label: 'General economic conditions',
    synonyms: [/(?:general\s+)?econom(?:y|ic)\s+conditions?/i, /economic\s+(?:downturn|slow)/i],
  },
  INDUSTRY_GENERAL: {
    label: 'Industry-wide conditions',
    synonyms: [/industry[\s-]*wide/i, /general\s+conditions\s+in\s+(?:the\s+)?industry/i],
  },
  FINANCIAL_MARKETS: {
    label: 'Financial / capital / credit market conditions',
    synonyms: [/(?:financial|capital|credit|securities)\s+markets?/i, /market\s+conditions/i],
  },
  ACTS_OF_WAR_TERRORISM: {
    label: 'Acts of war, armed hostilities, or terrorism',
    synonyms: [/acts?\s+of\s+(?:war|terror)/i, /armed\s+hostilities/i, /military\s+action/i],
  },
  NATURAL_DISASTERS: {
    label: 'Natural disasters or acts of God',
    synonyms: [/natural\s+disasters?/i, /acts?\s+of\s+god/i, /hurricane|earthquake|flood|wildfire/i],
  },
  PANDEMIC: {
    label: 'Pandemic / epidemic / public health crisis',
    synonyms: [/pandemic/i, /epidemic/i, /covid/i, /public\s+health/i],
  },
  ANNOUNCEMENT_OR_PENDENCY: {
    label: 'Announcement or pendency of the transaction',
    synonyms: [/announcement\s+(?:or|and|of)\s+pendency/i, /pendency\s+of\s+(?:the\s+)?(?:transaction|merger)/i],
  },
  COMPLIANCE_WITH_AGREEMENT: {
    label: 'Compliance with the terms of this Agreement',
    synonyms: [/compliance\s+with\s+(?:the\s+)?(?:terms\s+of\s+)?(?:this\s+)?agreement/i],
  },
  ACTIONS_REQUESTED_BY_PARENT: {
    label: 'Actions taken at the request or with consent of Parent',
    synonyms: [/(?:at\s+the\s+)?request\s+of\s+parent/i, /with\s+(?:the\s+)?consent\s+of\s+parent/i],
  },
  CHANGE_IN_LAW: {
    label: 'Changes in applicable law or regulation',
    synonyms: [/changes?\s+in\s+(?:applicable\s+)?law/i, /changes?\s+in\s+regulation/i],
  },
  CHANGE_IN_GAAP: {
    label: 'Changes in GAAP or accounting principles',
    synonyms: [/changes?\s+in\s+gaap/i, /changes?\s+in\s+accounting/i],
  },
  STOCK_PRICE_CHANGES: {
    label: 'Changes in the trading price or volume of stock',
    synonyms: [/changes?\s+in\s+(?:the\s+)?(?:trading\s+)?price/i, /stock\s+price/i, /trading\s+volume/i],
  },
  FAILURE_TO_MEET_PROJECTIONS: {
    label: 'Failure to meet internal projections or forecasts',
    synonyms: [/failure\s+to\s+meet\s+(?:internal\s+)?(?:projections|forecasts|estimates|guidance)/i],
  },
  PRICING_MFN: {
    label: 'Most-favored-nation pricing actions',
    synonyms: [/most[\s-]*favored[\s-]*nation/i, /\bmfn\b/i],
  },
  EXECUTIVE_ACTION: {
    label: 'Executive orders / sanctions / tariffs',
    synonyms: [/executive\s+orders?/i, /\bsanctions?\b/i],
  },
  TARIFFS: {
    label: 'Tariffs / trade barriers',
    synonyms: [/tariffs?/i, /trade\s+barriers?/i, /import\s+duties/i],
  },
  GOVERNMENT_SHUTDOWNS: {
    label: 'Government shutdowns / civil unrest',
    synonyms: [/government\s+shutdown/i, /civil\s+unrest/i, /political\s+instability/i],
  },
  CLINICAL_RESULTS: {
    label: 'Clinical trial results (life sciences)',
    synonyms: [/clinical\s+(?:trial\s+)?results?/i, /trial\s+outcomes?/i],
  },
  FDA_DISCUSSIONS: {
    label: 'FDA discussions or correspondence (life sciences)',
    synonyms: [/fda\s+(?:discussion|correspondence|interaction|meeting)/i],
  },
  FDA_APPROVALS_COMPETITOR_ENTRY: {
    label: 'FDA approvals of competitor products / competitor entry',
    synonyms: [/competitor\s+(?:entry|product)/i, /fda\s+approval\s+of\s+(?:a\s+)?competit/i],
  },
  SUPPLY_CHAIN: {
    label: 'Supply chain disruptions',
    synonyms: [/supply\s+chain/i, /raw\s+material\s+shortage/i],
  },
  PRICING_REIMBURSEMENT: {
    label: 'Pricing / reimbursement changes (healthcare)',
    synonyms: [/reimbursement/i, /price\s+controls?/i, /payor\s+coverage/i],
  },
  MEDICAL_ORGS_STATEMENTS: {
    label: 'Statements by medical / scientific organizations',
    synonyms: [/medical\s+(?:society|organization)/i, /scientific\s+statement/i],
  },
  PATENTS_EXCLUSIVITY: {
    label: 'Patent expirations / loss of exclusivity',
    synonyms: [/patent\s+(?:expiration|expiry)/i, /loss\s+of\s+exclusivity/i, /\bloe\b/i],
  },
  PARENT_ACTIONS_OR_INACTION: {
    label: 'Acts or omissions of Parent / Buyer',
    synonyms: [/acts?\s+(?:or\s+omissions?\s+)?of\s+parent/i, /buyer['’]?s?\s+(?:acts|inaction)/i],
  },
  EMPLOYEE_DEPARTURES: {
    label: 'Loss of employees or executive departures',
    synonyms: [/employee\s+(?:departures?|attrition)/i, /loss\s+of\s+(?:key\s+)?employees/i],
  },
  OTHER: {
    label: 'Other carve-out',
    synonyms: [],
  },
};

// ---------------------------------------------------------------------------
// IOC dollar-threshold categories — used by interim-operating-covenants
// dollar caps (acquisitions, asset sales, indebtedness, capex, etc.).
// ---------------------------------------------------------------------------

const IOC_CATEGORY_META = {
  ACQUISITIONS: {
    label: 'Acquisitions / business combinations',
    synonyms: [
      /acquisitions?/i,
      /business\s+combinations?/i,
      /\bm&a\b/i,
      // Verb-form anchors so a clause like
      // "(d) acquire or agree to acquire ... any business or any corporation..."
      // routes to ACQUISITIONS rather than the generic "OTHER" bucket.
      /\bacquire\b.{0,80}?(?:business|corporation|partnership|equity\s+interest)/i,
      /(?:purchase|purchasing)\s+a\s+substantial\s+(?:equity|portion)/i,
    ],
  },
  ASSET_SALES_LICENSES: {
    label: 'Asset sales / divestitures / licenses',
    synonyms: [
      /asset\s+sales?/i,
      /dispositions?/i,
      /divestitures?/i,
      /licenses?\s+(?:of|out)/i,
      // Verb-form anchors covering the typical "(g) sell, transfer, lease,
      // license, abandon or otherwise dispose of" clause language.
      /\bsell\b.{0,40}?\btransfer\b.{0,40}?(?:lease|license|dispose)/i,
      /\botherwise\s+dispose\s+of\b/i,
      /\bspin[\s-]*off\b/i,
    ],
  },
  MERGE_DISSOLVE_RECAP: {
    label: 'Merger / consolidation / liquidation / recapitalization',
    synonyms: [
      // Anchors for clauses like "(p) merge or consolidate the Company ...
      // or adopt a plan of complete or partial liquidation, dissolution,
      // restructuring, recapitalization or other reorganization".
      /\bmerge\s+or\s+consolidate\b/i,
      /plan\s+of\s+(?:complete\s+or\s+partial\s+)?(?:liquidation|dissolution|restructuring|recapitalization|reorganization)/i,
      /\bdissolution\b/i,
      /\brecapitalization\b/i,
      /\breorganization\b/i,
    ],
  },
  INDEBTEDNESS: {
    label: 'Indebtedness / financing',
    synonyms: [/indebtedness/i, /\bdebt\b/i, /credit\s+facility/i, /borrowings?/i],
  },
  THIRD_PARTY_OBLIGATIONS: {
    label: 'Guarantees / third-party obligations',
    synonyms: [/guarantees?/i, /surety/i, /third[\s-]*party\s+obligations?/i],
  },
  LOANS_ADVANCES_CONTRIBUTIONS: {
    label: 'Loans / advances / capital contributions',
    synonyms: [/loans?|advances?/i, /capital\s+contributions?/i],
  },
  CAPEX: {
    label: 'Capital expenditures',
    synonyms: [/capital\s+expenditures?/i, /\bcapex\b/i],
  },
  LITIGATION_SETTLEMENTS: {
    label: 'Litigation settlements',
    synonyms: [/settlements?/i, /litigation\s+settle/i],
  },
  NEW_CONTRACTS: {
    label: 'New material contracts',
    synonyms: [/new\s+(?:material\s+)?contracts?/i, /enter(?:ing)?\s+into\s+contracts/i],
  },
  CONTRACT_AMENDMENTS: {
    label: 'Contract amendments / terminations',
    synonyms: [/amend(?:ment)?\s+of\s+(?:material\s+)?contracts?/i, /terminate\s+(?:material\s+)?contracts/i],
  },
  EMPLOYEE_COMP: {
    label: 'Employee compensation / benefit increases',
    synonyms: [/compensation\s+increases?/i, /bonus\s+payments?/i, /benefit\s+increases?/i],
  },
  REAL_ESTATE: {
    label: 'Real estate / leases',
    synonyms: [/real\s+estate/i, /\bleases?\b/i],
  },
  IP_LICENSES: {
    label: 'Intellectual property licenses / assignments',
    synonyms: [/(?:intellectual\s+property|ip)\s+licens/i, /patent\s+licens/i],
  },
  OTHER: {
    label: 'Other / unspecified',
    synonyms: [],
  },
};

// ---------------------------------------------------------------------------
// Material-Contracts rep buckets (REP-T-MATERIAL-CONTRACTS) — the canonical
// categories used by Paul Weiss-style "material contracts" representations.
// ---------------------------------------------------------------------------

const MATERIAL_CONTRACT_BUCKET_META = {
  AGGREGATE_PAYMENTS: {
    label: 'Contracts above an aggregate-payments threshold',
    synonyms: [/aggregate\s+payments?/i, /annual\s+payments?/i],
  },
  INDEBTEDNESS: {
    label: 'Indebtedness contracts',
    synonyms: [/indebtedness/i, /credit\s+agreement/i, /loan\s+agreement/i],
  },
  JV_PARTNERSHIPS: {
    label: 'Joint ventures / partnerships',
    synonyms: [/joint\s+venture/i, /partnership/i, /\bjv\b/i],
  },
  MA_AGREEMENTS: {
    label: 'M&A / acquisition agreements',
    synonyms: [/acquisition\s+agreement/i, /merger\s+agreement/i],
  },
  IP_LICENSES_IN: {
    label: 'Inbound IP licenses',
    synonyms: [/inbound\s+licens/i, /licens(?:es?|ed)\s+(?:from|in)/i],
  },
  IP_LICENSES_OUT: {
    label: 'Outbound IP licenses',
    synonyms: [/outbound\s+licens/i, /licens(?:es?|ed)\s+(?:to|out)/i],
  },
  SUPPLY: {
    label: 'Supplier agreements',
    synonyms: [/supply\s+agreement/i, /supplier\s+contracts?/i, /purchase,?\s+sale\s+or\s+lease\s+of\s+goods/i],
  },
  MANUFACTURE: {
    label: 'Manufacturing agreements',
    synonyms: [/manufacturing\s+agreement/i, /\bcmo\b/i, /contract\s+manufactur/i],
  },
  DISTRIBUTION: {
    label: 'Distribution / reseller agreements',
    synonyms: [/distribution\s+agreement/i, /reseller/i],
  },
  COLLABORATION: {
    label: 'Collaboration / R&D agreements',
    synonyms: [/collaboration/i, /research\s+(?:and\s+)?development\s+agreement/i],
  },
  SETTLEMENT: {
    label: 'Settlement / consent agreements',
    synonyms: [/settlement\s+agreement/i, /consent\s+decree/i],
  },
  NONCOMPETE: {
    label: 'Non-competition / non-solicitation agreements',
    synonyms: [/non[\s-]*compet/i, /non[\s-]*solicit/i, /restrictive\s+covenant/i],
  },
  REAL_ESTATE: {
    label: 'Real estate leases',
    synonyms: [/real\s+estate/i, /lease\s+agreement/i],
  },
  EMPLOYMENT_KEY: {
    label: 'Key employment / executive agreements',
    synonyms: [/employment\s+agreement/i, /executive\s+agreement/i],
  },
  GOVERNMENT_CONTRACTS: {
    label: 'Government contracts',
    synonyms: [/government\s+contracts?/i, /\bgwac\b/i, /federal\s+contracts?/i],
  },
  // ── Additional canonical buckets to close the 16→21 gap. PW-style material-
  //    contracts reps routinely enumerate these as discrete sub-clauses; they
  //    previously collapsed into OTHER. ──
  AFFILIATE_TRANSACTIONS: {
    label: 'Affiliate / related-party transactions',
    synonyms: [/affiliate\s+(?:transaction|agreement|contract)/i, /related[\s-]*party/i, /interested\s+party\s+transaction/i],
  },
  EXCLUSIVITY_MFN: {
    label: 'Exclusivity / most-favored-nation / standstill',
    synonyms: [/exclusivity/i, /most[\s-]*favored[\s-]*nation/i, /\bmfn\b/i, /standstill/i, /exclusive\s+dealing/i],
  },
  CAPEX_COMMITMENTS: {
    label: 'Capital expenditure commitments',
    synonyms: [/capital\s+expenditure/i, /\bcapex\b/i, /capital\s+commitment/i],
  },
  DATA_PRIVACY: {
    label: 'Data privacy / security agreements',
    synonyms: [/data\s+(?:privacy|security|protection)/i, /data\s+processing\s+agreement/i, /\bdpa\b/i],
  },
  VOTING_REGISTRATION_RIGHTS: {
    label: 'Voting / registration-rights / stockholder agreements',
    synonyms: [/voting\s+agreement/i, /registration\s+rights/i, /stockholders?\s+agreement/i, /shareholders?\s+agreement/i],
  },
  // ── Item-601 catch-all + pharma/biotech-specific buckets. Material-contracts
  //    reps in life-sciences deals enumerate these as discrete sub-clauses. ──
  SEC_ITEM_601: {
    label: 'SEC Item 601(b) contracts',
    synonyms: [/601\s*\(\s*b\s*\)/i, /item\s+601/i, /regulation\s+s-?k/i, /required\s+to\s+be\s+filed.{0,40}material\s+contract/i],
  },
  IP_DEVELOPMENT: {
    label: 'IP development contracts',
    synonyms: [/development\s+contract/i, /\bdeveloped\b[^.]{0,60}(?:solely\s+or\s+jointly|for\s+or\s+at\s+the\s+direction)/i, /intellectual\s+property[^.]{0,60}develop/i],
  },
  SINGLE_SOURCE: {
    label: 'Single source procurement contracts',
    synonyms: [/single[\s-]*source/i, /sole[\s-]*source/i, /procurement\s+of\s+materials/i],
  },
  CRO: {
    label: 'Clinical research organization contracts',
    synonyms: [/contract\s+research\s+organization/i, /\bcro\b/i, /clinical\s+stud(?:y|ies)/i, /clinical\s+trial/i],
  },
  MA_ONGOING_OBLIGATIONS: {
    label: 'M&A agreements with ongoing obligations',
    synonyms: [/milestone\s+(?:or\s+similar\s+)?payment/i, /\broyalt/i, /continuing\s+obligations\s+or\s+interests/i, /future\s+payment\s+obligations/i],
  },
  ROFR_ROFN: {
    label: 'Agreements with ROFO/ROFN',
    synonyms: [/right\s+of\s+first\s+(?:refusal|offer|negotiation)/i, /\brofr\b/i, /\brofn\b/i, /\brofo\b/i],
  },
  HEDGING: {
    label: 'Hedging and derivative contracts',
    synonyms: [/hedg/i, /\bswap\b/i, /\bcollar\b/i, /\bderivative/i],
  },
  EMPLOYEE_LOANS: {
    label: 'Employee loans and advances',
    synonyms: [/loan\s+or\s+advance/i, /advance[^.]{0,40}employee/i, /employee\s+loan/i],
  },
  OTHER: {
    label: 'Other material contracts',
    synonyms: [],
  },
};

// ---------------------------------------------------------------------------
// Absence-of-Changes rep type — how the rep is structured. Three canonical
// shapes; HYBRID gets a verbose label so the cross-deal compare reads as
// English rather than as an opaque code.
// ---------------------------------------------------------------------------

const ABSENCE_OF_CHANGES_TYPE_META = {
  GENERAL_ORDINARY_COURSE: {
    label: 'General operating covenant',
    synonyms: [/ordinary\s+course/i, /general\s+(?:operating|ordinary)/i],
  },
  SPECIFIED_IOCS: {
    label: 'Specific IOCs',
    synonyms: [/specific(?:ally)?\s+(?:listed|enumerated|identified)/i, /specified\s+(?:ioc|interim\s+operating)/i],
  },
  HYBRID: {
    label: 'Hybrid (General operating covenant and specific IOCs cited)',
    synonyms: [/hybrid/i, /both\s+general\s+and\s+specific/i],
  },
};

// ---------------------------------------------------------------------------
// Antitrust remedy types — what the buyer must do to clear regulatory review.
// ---------------------------------------------------------------------------

const REMEDY_TYPE_META = {
  DIVEST: { label: 'Divestitures', synonyms: [/divest/i, /sell\s+off/i, /hold\s+separate/i] },
  CONDUCT_REMEDY: { label: 'Conduct remedy', synonyms: [/conduct\s+remed/i, /behavioral\s+conduct/i] },
  LITIGATE: { label: 'Obligation to litigate', synonyms: [/litigat/i, /defend\s+against/i] },
  FINANCIAL_REMEDY: { label: 'Financial remedy / payment', synonyms: [/financial\s+remed/i, /monetary\s+payment/i] },
  BEHAVIORAL_REMEDY: { label: 'Behavioral remedy', synonyms: [/behavioral\s+remed/i] },
  MULTIPLE: { label: 'Multiple required remedies', synonyms: [/multiple\s+remedies/i] },
  NONE: { label: 'No required remedies', synonyms: [/no\s+remed/i, /silent/i] },
  OTHER: { label: 'Other remedy', synonyms: [] },
};

// ---------------------------------------------------------------------------
// Knowledge standards — used by reps, definitions, and other qualifiers.
// ---------------------------------------------------------------------------

const KNOWLEDGE_STANDARD_META = {
  ACTUAL: { label: 'Actual knowledge', synonyms: [/actual\s+knowledge/i] },
  CONSTRUCTIVE: { label: 'Constructive knowledge', synonyms: [/constructive\s+knowledge/i] },
  AFTER_INQUIRY: { label: 'Knowledge after reasonable inquiry', synonyms: [/after\s+(?:reasonable|due)\s+inquiry/i, /reasonable\s+inquiry/i] },
  NA: { label: 'Not applicable / silent', synonyms: [/not\s+applicable/i, /\bn\/?a\b/i] },
};

// ---------------------------------------------------------------------------
// Knowledge-group persons — canonical pills for "WHO is the knowledge group?".
// Most agreements either (a) list named officers/titles, or (b) point to a
// schedule. The codes here cover the common officer titles plus the schedule
// fallback; the extractor can also propose other UPPER_SNAKE codes verbatim
// and they'll humanize cleanly when rendered.
// ---------------------------------------------------------------------------

const KNOWLEDGE_PERSON_META = {
  CEO: { label: 'Chief Executive Officer', synonyms: [/chief\s+executive\s+officer/i, /\bceo\b/i] },
  CFO: { label: 'Chief Financial Officer', synonyms: [/chief\s+financial\s+officer/i, /\bcfo\b/i] },
  COO: { label: 'Chief Operating Officer', synonyms: [/chief\s+operating\s+officer/i, /\bcoo\b/i] },
  CLO: { label: 'Chief Legal Officer', synonyms: [/chief\s+legal\s+officer/i, /\bclo\b/i] },
  GENERAL_COUNSEL: { label: 'General Counsel', synonyms: [/general\s+counsel/i] },
  CHIEF_MEDICAL_OFFICER: { label: 'Chief Medical Officer', synonyms: [/chief\s+medical\s+officer/i, /\bcmo\b/i] },
  CHIEF_SCIENTIFIC_OFFICER: { label: 'Chief Scientific Officer', synonyms: [/chief\s+scientific\s+officer/i, /\bcso\b/i] },
  CHIEF_TECHNOLOGY_OFFICER: { label: 'Chief Technology Officer', synonyms: [/chief\s+technology\s+officer/i, /\bcto\b/i] },
  CHIEF_COMMERCIAL_OFFICER: { label: 'Chief Commercial Officer', synonyms: [/chief\s+commercial\s+officer/i, /\bcco\b/i] },
  EXECUTIVE_OFFICERS: { label: 'Executive officers', synonyms: [/executive\s+officers?/i] },
  NAMED_SCHEDULE_LIST: { label: 'Persons listed on Disclosure Letter', synonyms: [/disclosure\s+letter/i, /schedule/i, /set\s+forth\s+in\s+section/i] },
  OTHER: { label: 'Other named person', synonyms: [] },
};

// ---------------------------------------------------------------------------
// SEC-filings-exception EXCLUDED PORTIONS — the standard parts of the filed
// SEC documents that are CARVED OUT of the "except as disclosed in SEC
// filings" rep qualifier (so disclosures there don't qualify the reps).
// ---------------------------------------------------------------------------

const SEC_FILING_EXCLUSION_META = {
  RISK_FACTORS: {
    label: 'Risk Factors',
    synonyms: [/risk\s+factors/i],
  },
  FORWARD_LOOKING: {
    label: 'Forward-Looking Statements',
    synonyms: [/forward[\s-]*looking/i, /cautionary\s+(?:note|statement)/i, /precautionary/i],
  },
  MARKET_RISK_DISCLOSURES: {
    label: 'Quantitative & Qualitative Market-Risk Disclosures',
    synonyms: [/quantitative\s+and\s+qualitative/i, /market\s+risk/i],
  },
  EXHIBITS: {
    label: 'Exhibits to Filed SEC Documents',
    synonyms: [/exhibits?\b/i],
  },
  OTHER: { label: 'Other excluded portion', synonyms: [] },
};

// ---------------------------------------------------------------------------
// DEFINED-TERM FAMILIES — cross-deal groupings for defined terms. The ACTUAL
// defined term (e.g. "Mono FDA Approval Milestone Payment Amount") is the
// identity; the family (e.g. "Milestone Amount") is what lets us match
// comparable definitions ACROSS deals. Free-text family allowed via OTHER.
// ---------------------------------------------------------------------------

const DEF_FAMILY_META = {
  AFFILIATE: { label: 'Affiliate', synonyms: [/^affiliates?$/i] },
  SUBSIDIARY: { label: 'Subsidiary', synonyms: [/subsidiar/i] },
  PERSON: { label: 'Person', synonyms: [/^person$/i] },
  GOVERNMENTAL_ENTITY: { label: 'Governmental Entity', synonyms: [/government(al)?\s+(entity|authority)/i] },
  MAE: { label: 'Material Adverse Effect', synonyms: [/material\s+adverse\s+effect/i] },
  KNOWLEDGE: { label: 'Knowledge', synonyms: [/knowledge/i] },
  LAW: { label: 'Law', synonyms: [/^laws?$/i, /applicable\s+law/i] },
  ORDER: { label: 'Order', synonyms: [/^orders?$/i] },
  CONTRACT: { label: 'Contract', synonyms: [/^contracts?$/i] },
  INTELLECTUAL_PROPERTY: { label: 'Intellectual Property', synonyms: [/intellectual\s+property/i, /\bIP\b/] },
  PERMITTED_LIEN: { label: 'Permitted Lien', synonyms: [/permitted\s+lien/i, /^liens?$/i] },
  MILESTONE_AMOUNT: { label: 'Milestone Amount', synonyms: [/milestone/i] },
  NET_SALES: { label: 'Net Sales', synonyms: [/net\s+sales/i] },
  CVR: { label: 'CVR', synonyms: [/contingent\s+value\s+right/i, /\bCVR\b/] },
  PRODUCT: { label: 'Product', synonyms: [/\bproducts?$/i, /product\s+candidate/i] },
  BUSINESS_DAY: { label: 'Business Day', synonyms: [/business\s+day/i] },
  TAX: { label: 'Tax', synonyms: [/^tax(es)?$/i] },
  BENEFIT_PLAN: { label: 'Benefit Plan', synonyms: [/benefit\s+plan/i, /\bERISA\b/] },
  REGULATORY_APPROVAL: { label: 'Regulatory Approval', synonyms: [/regulatory\s+approval/i, /\bFDA\b/, /marketing\s+authoriz/i] },
  OTHER: { label: 'Other / deal-specific', synonyms: [] },
};

// Helper: convert a {CODE: {label, synonyms}} meta object into a flat
// {CODE: label} dictionary (the shape every other taxonomy dict uses).
function metaToDict(meta) {
  const out = {};
  for (const [code, entry] of Object.entries(meta)) {
    out[code] = entry.label;
  }
  return out;
}

const MERGER_FORMS = metaToDict(MERGER_FORMS_META);
const MAE_CARVEOUT_CODES = metaToDict(MAE_CARVEOUT_META);
const IOC_CATEGORY_CODES = metaToDict(IOC_CATEGORY_META);
const MATERIAL_CONTRACT_BUCKET_CODES = metaToDict(MATERIAL_CONTRACT_BUCKET_META);
const REMEDY_TYPES = metaToDict(REMEDY_TYPE_META);
const KNOWLEDGE_STANDARDS = metaToDict(KNOWLEDGE_STANDARD_META);
const KNOWLEDGE_PERSONS = metaToDict(KNOWLEDGE_PERSON_META);
const SEC_FILING_EXCLUSION_CODES = metaToDict(SEC_FILING_EXCLUSION_META);
const ABSENCE_OF_CHANGES_TYPES = metaToDict(ABSENCE_OF_CHANGES_TYPE_META);

// ---------------------------------------------------------------------------
// Normalization helper — given a free-text value and a meta object, attempt
// to map it to a canonical code via the synonym regexes.
// Returns the matched CODE or null if no synonym fires.
// ---------------------------------------------------------------------------

function normalizeToCode(rawText, meta) {
  if (!rawText || typeof rawText !== 'string') return null;
  for (const [code, entry] of Object.entries(meta)) {
    const synonyms = entry.synonyms || [];
    for (const re of synonyms) {
      if (re.test(rawText)) return code;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers — used by extract.js to embed compact dictionaries into prompts
// ---------------------------------------------------------------------------

/**
 * Format a code dictionary as a compact "CODE: description" list suitable
 * for inclusion in an AI prompt.
 *
 * @param {Object<string,string>} dict
 * @returns {string}
 */
function formatDict(dict) {
  return Object.entries(dict)
    .map(([code, label]) => `  ${code}: ${label}`)
    .join('\n');
}

/**
 * Returns true if the supplied code exists in the given dictionary.
 *
 * @param {string} code
 * @param {Object<string,string>} dict
 */
function isValidTaxonomyCode(code, dict) {
  if (!code || typeof code !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(dict, code);
}

/**
 * Look up the canonical label for a taxonomy code, or null if unknown.
 *
 * @param {string} code
 * @param {Object<string,string>} dict
 */
function labelForCode(code, dict) {
  if (!isValidTaxonomyCode(code, dict)) return null;
  return dict[code];
}

/**
 * Which taxonomy dictionary applies to a given feature key. Used by both the
 * parser (to embed the right codebook in prompts) and the UI (to look up the
 * canonical label for a given code).
 *
 * Returns the dictionary, or null if the feature key has no taxonomy.
 */
function taxonomyForFeatureKey(featureKey) {
  switch (featureKey) {
    case 'permittedExceptions':
    case 'carveOuts':
    case 'carveOutsList':
      return EXCEPTION_CODES;
    case 'materialityQualifier':
    case 'materialityQualifiers':
    case 'bringDownStandard':
    case 'materialityScrape':
    case 'linkedBringDownStandard':
      return MATERIALITY_CODES;
    case 'consentStandard':
      return CONSENT_STANDARDS;
    case 'effortsStandard':
      return EFFORTS_STANDARDS;
    case 'appliesToParty':
      return APPLIES_TO_PARTY;
    case 'controllingParty':
      return ANTITRUST_CONTROL;
    case 'partyWhoCanTerminate':
      return TERMINATION_PARTY;
    case 'outstandingInstruments':
      return EQUITY_INSTRUMENTS;
    case 'instrumentType':
      return EQUITY_INSTRUMENTS;
    case 'instrumentTreatments':
      return EQUITY_TREATMENT;
    case 'vestingAcceleration':
    case 'vestingStatus':
      return VESTING_STATUS;
    case 'compensationItems':
      // compensationItems is a list of tagged items where each item carries
      // BOTH an item code (from COMP_ITEMS) and a standard_code (from
      // COMP_STANDARDS). The default dictionary returned here is COMP_STANDARDS
      // (the "standard" is the primary classification); COMP_ITEMS is included
      // by extract.js as a secondary codebook in the prompt for the same key.
      return COMP_STANDARDS;
    // ── New (Stage 3) ──
    case 'mergerForm':
      return MERGER_FORMS;
    case 'carveouts':
    case 'disproportionateImpactCarveouts':
    case 'nonDisproportionateImpactCarveouts':
      return MAE_CARVEOUT_CODES;
    case 'dollarThresholdsByCategory':
      return IOC_CATEGORY_CODES;
    case 'materialContractsBuckets':
      return MATERIAL_CONTRACT_BUCKET_CODES;
    case 'secFilingsExceptionExclusions':
    case 'secFilingsExcludedSections':
      return SEC_FILING_EXCLUSION_CODES;
    case 'parentRemedyObligation':
      return REMEDY_TYPES;
    case 'knowledgeStandard':
      return KNOWLEDGE_STANDARDS;
    case 'knowledgePersons':
      return KNOWLEDGE_PERSONS;
    case 'absenceOfChangesType':
      return ABSENCE_OF_CHANGES_TYPES;
    default:
      return null;
  }
}

/**
 * Feature keys whose values are LISTS of tagged items (each item is a
 * {code,label,text} object). Other taxonomy-tagged keys hold a single tagged
 * item (or just an enum-like string for backward compatibility).
 */
const LIST_TAXONOMY_KEYS = new Set([
  'permittedExceptions',
  'carveOuts',
  'carveOutsList',
  'materialityQualifiers',
  'outstandingInstruments',
  'instrumentTreatments',
  'compensationItems',
  // Stage 3 additions:
  'carveouts',
  'disproportionateImpactCarveouts',
  'nonDisproportionateImpactCarveouts',
  'dollarThresholdsByCategory',
  'materialContractsBuckets',
  'secFilingsExceptionExclusions',
  'secFilingsExcludedSections',
]);

function isListTaxonomyKey(featureKey) {
  return LIST_TAXONOMY_KEYS.has(featureKey);
}

module.exports = {
  EXCEPTION_CODES,
  MATERIALITY_CODES,
  CONSENT_STANDARDS,
  EFFORTS_STANDARDS,
  APPLIES_TO_PARTY,
  ANTITRUST_CONTROL,
  TERMINATION_PARTY,
  EQUITY_INSTRUMENTS,
  EQUITY_TREATMENT,
  VESTING_STATUS,
  COMP_STANDARDS,
  COMP_ITEMS,
  // Stage 3 additions
  MERGER_FORMS,
  MERGER_FORMS_META,
  MAE_CARVEOUT_CODES,
  MAE_CARVEOUT_META,
  IOC_CATEGORY_CODES,
  IOC_CATEGORY_META,
  MATERIAL_CONTRACT_BUCKET_CODES,
  MATERIAL_CONTRACT_BUCKET_META,
  REMEDY_TYPES,
  REMEDY_TYPE_META,
  KNOWLEDGE_STANDARDS,
  KNOWLEDGE_STANDARD_META,
  KNOWLEDGE_PERSONS,
  KNOWLEDGE_PERSON_META,
  SEC_FILING_EXCLUSION_CODES,
  SEC_FILING_EXCLUSION_META,
  ABSENCE_OF_CHANGES_TYPES,
  ABSENCE_OF_CHANGES_TYPE_META,
  normalizeToCode,
  formatDict,
  isValidTaxonomyCode,
  labelForCode,
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  LIST_TAXONOMY_KEYS,
};
