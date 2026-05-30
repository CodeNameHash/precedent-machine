/**
 * rubric.js — Single source of truth for the M&A provision rubric.
 *
 * Consumed by both the parser (AI classification) and the UI (labels,
 * feature extraction, comparison grids).  CommonJS for Next.js API-route
 * compatibility.
 *
 * Canonical reference: /RUBRIC.md
 */

// ---------------------------------------------------------------------------
// 1. PROVISION_TYPES — ordered array of every top-level provision category
// ---------------------------------------------------------------------------

const PROVISION_TYPES = [
  {
    key: 'STRUCT',
    label: 'Merger Structure & Mechanics',
    description: 'Merger mechanics, closing, effective time, charter/bylaw treatment, directors & officers',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'CONSID',
    label: 'Consideration & Securities Treatment',
    description: 'Share conversion, exchange mechanics, equity award treatment, appraisal rights',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'REP-T',
    label: 'Representations & Warranties (Target)',
    description: 'Representations and warranties made by the target / company',
    classificationMode: 'single',
    party: 'target',
  },
  {
    key: 'REP-B',
    label: 'Representations & Warranties (Buyer)',
    description: 'Representations and warranties made by the buyer / parent',
    classificationMode: 'single',
    party: 'buyer',
  },
  {
    key: 'IOC',
    label: 'Interim Operating Covenants',
    description: 'Sub-clause restrictions on target conduct between signing and closing',
    classificationMode: 'single',
    party: 'target',
  },
  {
    key: 'NOSOL',
    label: 'No-Solicitation / No-Shop',
    description: 'Solicitation prohibition, fiduciary out, matching rights, go-shop windows',
    classificationMode: 'multi',
    party: 'target',
  },
  {
    key: 'ANTI',
    label: 'Antitrust / Regulatory Efforts',
    description: 'HSR filings, efforts standard, divestiture caps, regulatory cooperation',
    classificationMode: 'multi',
    party: 'mutual',
  },
  {
    key: 'COND-M',
    label: 'Conditions to Closing (Mutual)',
    description: 'Conditions that must be satisfied for both parties to close',
    classificationMode: 'single',
    party: 'mutual',
  },
  {
    key: 'COND-B',
    label: 'Conditions to Closing (Buyer)',
    description: 'Conditions to the buyer\'s obligation to close',
    classificationMode: 'single',
    party: 'buyer',
  },
  {
    key: 'COND-S',
    label: 'Conditions to Closing (Seller/Target)',
    description: 'Conditions to the seller\'s / target\'s obligation to close',
    classificationMode: 'single',
    party: 'target',
  },
  {
    key: 'COND',
    label: 'Condition Modifiers',
    description: 'Frustration of conditions, tax opinion conditions',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'TERMR',
    label: 'Termination Rights',
    description: 'Mutual termination, outside date, breach termination, superior proposal termination',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'TERMF',
    label: 'Termination Fees & Expenses',
    description: 'Company termination fee, reverse termination fee, expense reimbursement, tail provisions',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'DEF',
    label: 'Definitions',
    description: 'Key negotiated defined terms (MAE, Superior Proposal, Knowledge, etc.)',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'COV',
    label: 'Other Covenants (Additional Agreements)',
    description: 'Access, proxy, stockholder meeting, publicity, indemnification, employee matters',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'MISC',
    label: 'Miscellaneous / Boilerplate',
    description: 'Governing law, notices, jury waiver, specific performance, amendment, boilerplate',
    classificationMode: 'single',
    party: null,
  },
  {
    key: 'OTHER',
    label: 'Other Provisions',
    description: 'Sections that do not fit any canonical rubric type — captured here so the entire agreement is coded (no orphans).',
    classificationMode: 'single',
    party: null,
  },
];

// ---------------------------------------------------------------------------
// 2. CODES — flat object keyed by canonical code
// ---------------------------------------------------------------------------

const CODES = {
  // ── STRUCT ───────────────────────────────────────────────────────────────
  'STRUCT-MERGER': {
    type: 'STRUCT',
    label: 'The Merger',
    description: 'Core merger transaction provision',
    aliases: ['Merger', 'The Merger Transaction'],
    frequency: 'universal',
    industries: [],
  },
  'STRUCT-CLOSING': {
    type: 'STRUCT',
    label: 'Closing',
    description: 'Closing date, location, and mechanics',
    aliases: ['Closing Date', 'Closing of the Merger'],
    frequency: 'universal',
    industries: [],
  },
  'STRUCT-EFFTIME': {
    type: 'STRUCT',
    label: 'Effective Time',
    description: 'Certificate of merger filing and effective time',
    aliases: ['Effective Time of the Merger', 'Filing of Certificate of Merger'],
    frequency: 'universal',
    industries: [],
  },
  'STRUCT-EFFECTS': {
    type: 'STRUCT',
    label: 'Effects of the Merger',
    description: 'Legal consequences of the merger becoming effective',
    aliases: ['Effects of Merger', 'Effect of the Merger'],
    frequency: 'near-universal',
    industries: [],
  },
  'STRUCT-CHARTER': {
    type: 'STRUCT',
    label: 'Certificate of Incorporation / Bylaws',
    description: 'Post-merger charter and bylaw treatment of surviving entity',
    aliases: ['Charter Documents', 'Organizational Documents of the Surviving Corporation'],
    frequency: 'universal',
    industries: [],
  },
  'STRUCT-DIRECTORS': {
    type: 'STRUCT',
    label: 'Directors and Officers',
    description: 'Directors and officers of the surviving entity post-merger',
    aliases: ['Directors and Officers of the Surviving Corporation'],
    frequency: 'near-universal',
    industries: [],
  },
  'STRUCT-ACTIONS': {
    type: 'STRUCT',
    label: 'Subsequent Actions',
    description: 'Further corporate actions to effectuate the merger',
    aliases: ['Additional Actions', 'Further Actions'],
    frequency: 'common',
    industries: [],
  },

  // ── CONSID ──────────────────────────────────────────────────────────────
  'CONSID-CONVERT': {
    type: 'CONSID',
    label: 'Conversion of Shares / Effect on Capital Stock',
    description: 'Treatment of each share of target stock upon merger effectiveness',
    aliases: ['Effect on Capital Stock', 'Conversion of Securities', 'Merger Consideration'],
    frequency: 'universal',
    industries: [],
  },
  'CONSID-EXCHANGE': {
    type: 'CONSID',
    label: 'Exchange of Certificates / Payment Mechanics',
    description: 'Exchange fund, letter of transmittal, payment procedures',
    aliases: ['Exchange Fund', 'Payment for Shares', 'Exchange Procedures', 'Surrender of Certificates'],
    frequency: 'near-universal',
    industries: [],
  },
  'CONSID-EQUITY': {
    type: 'CONSID',
    label: 'Treatment of Equity Awards / Stock Plans',
    description: 'Treatment of outstanding options, RSUs, PSUs, warrants',
    aliases: ['Treatment of Stock Options', 'Treatment of RSUs', 'Company Equity Awards'],
    frequency: 'near-universal',
    industries: [],
  },
  'CONSID-DISSENT': {
    type: 'CONSID',
    label: 'Dissenting / Appraisal Rights',
    description: 'Treatment of shares held by dissenting stockholders',
    aliases: ['Appraisal Rights', 'Dissenters Rights'],
    frequency: 'common',
    industries: [],
  },
  'CONSID-WITHHOLD': {
    type: 'CONSID',
    label: 'Withholding Rights',
    description: 'Right to deduct and withhold taxes from merger consideration',
    aliases: ['Tax Withholding', 'Withholding'],
    frequency: 'common',
    industries: [],
  },
  'CONSID-ADJUST': {
    type: 'CONSID',
    label: 'Anti-Dilution Adjustments',
    description: 'Adjustments to consideration for stock splits, dividends, reclassifications',
    aliases: ['Adjustments', 'Anti-Dilution'],
    frequency: 'common',
    industries: [],
  },
  // ── Stage 2: new CONSID sub-codes ───────────────────────────────────────
  'CONSID-CVR': {
    type: 'CONSID',
    label: 'Contingent Value Rights (CVR)',
    description: 'Contingent value right entitling target holders to additional consideration on milestones',
    aliases: ['CVR', 'Contingent Value Right'],
    frequency: 'occasional',
    industries: [],
  },
  'CONSID-COLLAR': {
    type: 'CONSID',
    label: 'Collar',
    description: 'Collar on stock consideration limiting exchange-ratio movement above/below stated bounds',
    aliases: ['Fixed Collar', 'Floating Collar', 'Symmetric Collar', 'Asymmetric Collar'],
    frequency: 'occasional',
    industries: [],
  },
  'CONSID-TICKING': {
    type: 'CONSID',
    label: 'Ticking Fee',
    description: 'Per-day or per-month escalation of consideration after a stated date',
    aliases: ['Ticking Fee', 'Per-Diem Fee'],
    frequency: 'occasional',
    industries: [],
  },
  'CONSID-EXCHANGE-RATIO': {
    type: 'CONSID',
    label: 'Exchange Ratio',
    description: 'The headline exchange ratio (fixed or floating) in stock or mixed-consideration deals',
    aliases: ['Exchange Ratio', 'Fixed Exchange Ratio', 'Floating Exchange Ratio'],
    frequency: 'common',
    industries: [],
  },
  'CONSID-WALKAWAY': {
    type: 'CONSID',
    label: 'Walkaway / Market-Out',
    description: 'Walkaway / market-out right tied to a price-collar trigger',
    aliases: ['Walkaway', 'Market Out'],
    frequency: 'occasional',
    industries: [],
  },

  // ── REP-T ───────────────────────────────────────────────────────────────
  'REP-T-ORG': {
    type: 'REP-T',
    label: 'Organization; Qualification; Standing',
    description: 'Target is duly organized, validly existing, in good standing',
    aliases: ['Organization and Standing', 'Due Organization'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-CAP': {
    type: 'REP-T',
    label: 'Capitalization; Subsidiaries',
    description: 'Capital structure, outstanding shares, subsidiaries',
    aliases: ['Capitalization', 'Capital Stock'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-AUTH': {
    type: 'REP-T',
    label: 'Authority; Enforceability',
    description: 'Corporate authority to enter into and perform the agreement',
    aliases: ['Authority', 'Corporate Authority', 'Authority Relative to This Agreement'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-NOCONFLICT': {
    type: 'REP-T',
    label: 'No Conflict; Required Filings and Consents',
    description: 'No violation of charter, contracts, or laws; required governmental filings',
    aliases: ['Non-Contravention', 'No Violations', 'Consents and Approvals'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-SEC': {
    type: 'REP-T',
    label: 'SEC Documents; Financial Statements',
    description: 'SEC filings are complete and accurate; financial statements comply with GAAP',
    aliases: ['SEC Filings', 'SEC Reports', 'Reports and Financial Statements'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-T-FINSTMT': {
    type: 'REP-T',
    label: 'Financial Statements; No Liabilities (non-SEC filers)',
    description: 'Financial statements for companies that do not file with the SEC',
    aliases: ['Financial Statements'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-T-NOCHANGE': {
    type: 'REP-T',
    label: 'Absence of Certain Changes or Events',
    description: 'No material adverse change since the balance sheet date',
    aliases: ['Absence of Changes', 'No Material Adverse Change'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-NOLIAB': {
    type: 'REP-T',
    label: 'No Undisclosed Liabilities',
    description: 'No liabilities except as reflected in financial statements or disclosed',
    aliases: ['Undisclosed Liabilities'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-LIT': {
    type: 'REP-T',
    label: 'Litigation; Legal Proceedings',
    description: 'No pending or threatened litigation that would be material',
    aliases: ['Litigation', 'Legal Proceedings', 'Actions and Proceedings'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-COMPLY': {
    type: 'REP-T',
    label: 'Compliance with Laws; Permits; Licenses',
    description: 'Target is in compliance with applicable laws and holds required permits',
    aliases: ['Compliance with Laws', 'Permits and Licenses', 'Regulatory Compliance'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-BENEFITS': {
    type: 'REP-T',
    label: 'Employee Benefit Plans; ERISA',
    description: 'Employee benefit plans are listed, compliant with ERISA, properly funded',
    aliases: ['Employee Benefits', 'ERISA', 'Benefit Plans'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-T-LABOR': {
    type: 'REP-T',
    label: 'Labor Matters; Relations',
    description: 'Labor relations, collective bargaining, workforce matters',
    aliases: ['Labor Relations', 'Employment Matters', 'Labor and Employment'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-T-TAX': {
    type: 'REP-T',
    label: 'Taxes; Tax Returns',
    description: 'Tax returns filed, taxes paid, no material tax disputes',
    aliases: ['Taxes', 'Tax Matters'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-CONTRACTS': {
    type: 'REP-T',
    label: 'Material Contracts',
    description: 'Disclosure and status of material contracts',
    aliases: ['Contracts', 'Material Agreements'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-IP': {
    type: 'REP-T',
    label: 'Intellectual Property',
    description: 'Ownership and non-infringement of intellectual property',
    aliases: ['IP', 'Intellectual Property Rights'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-PROPERTY': {
    type: 'REP-T',
    label: 'Real Property; Personal Property; Title',
    description: 'Real and personal property ownership, leases, title',
    aliases: ['Real Property', 'Properties', 'Title to Assets'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-T-ENV': {
    type: 'REP-T',
    label: 'Environmental Matters',
    description: 'Compliance with environmental laws, no environmental liabilities',
    aliases: ['Environmental', 'Environmental Compliance'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-INSURANCE': {
    type: 'REP-T',
    label: 'Insurance',
    description: 'Insurance policies are in full force and effect',
    aliases: ['Insurance Policies', 'Insurance Coverage'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-BROKERS': {
    type: 'REP-T',
    label: 'Brokers; Finders',
    description: 'No brokers or finders fees except disclosed advisors',
    aliases: ['Brokers', 'Finders Fees'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-ANTICORR': {
    type: 'REP-T',
    label: 'Anti-Corruption; Sanctions',
    description: 'Compliance with FCPA, UK Bribery Act, anti-corruption laws',
    aliases: ['Anti-Corruption', 'FCPA', 'Bribery'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-PRIVACY': {
    type: 'REP-T',
    label: 'Data Privacy; Information Security; Cybersecurity',
    description: 'Compliance with privacy laws, data security measures',
    aliases: ['Data Privacy', 'Privacy', 'Cybersecurity', 'Information Security'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-TAKEOVER': {
    type: 'REP-T',
    label: 'Takeover Statutes; Anti-Takeover',
    description: 'Inapplicability of state anti-takeover statutes',
    aliases: ['Takeover Statutes', 'Anti-Takeover Provisions', 'State Takeover Laws'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-FAIRNESS': {
    type: 'REP-T',
    label: 'Opinion of Financial Advisor',
    description: 'Receipt of fairness opinion from financial advisor',
    aliases: ['Fairness Opinion', 'Financial Advisor Opinion'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-RPT': {
    type: 'REP-T',
    label: 'Related Party / Affiliate / Interested-Party Transactions',
    description: 'Disclosure of related party and affiliate transactions',
    aliases: ['Related Party Transactions', 'Affiliate Transactions', 'Interested Party Transactions'],
    frequency: 'universal',
    industries: [],
  },
  'REP-T-PROXY': {
    type: 'REP-T',
    label: 'Information Supplied / Proxy Statement',
    description: 'Information supplied for proxy statement is accurate',
    aliases: ['Information Supplied', 'Proxy Statement Information'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-NOREP': {
    type: 'REP-T',
    label: 'No Other Representations or Warranties',
    description: 'Disclaimer of representations beyond those expressly made',
    aliases: ['No Other Representations', 'Disclaimer of Representations'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-T-PRODUCT': {
    type: 'REP-T',
    label: 'Product Liability; Product Recall; Quality & Safety',
    description: 'Product liability claims, recalls, product quality and safety',
    aliases: ['Product Liability', 'Product Recall', 'Product Quality'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-SUPPLY': {
    type: 'REP-T',
    label: 'Suppliers',
    description: 'Key supplier relationships and status',
    aliases: ['Suppliers', 'Supply Chain'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'REP-T-FDA': {
    type: 'REP-T',
    label: 'FDA / Healthcare Regulatory',
    description: 'FDA compliance, healthcare regulatory status, product approvals',
    aliases: [
      'FDA Compliance',
      'Healthcare Regulatory',
      'FDA Matters',
      'Regulatory Matters',
      'Regulatory Compliance Matters',
      'Health Care Regulatory Matters',
      'Drug Regulatory Matters',
      'Health Care Submissions',
    ],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'REP-T-CONTROLS': {
    type: 'REP-T',
    label: 'Internal Controls; Disclosure Controls',
    description: 'Effectiveness of internal controls over financial reporting',
    aliases: ['Internal Controls', 'Disclosure Controls', 'Sarbanes-Oxley'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-SANCTIONS': {
    type: 'REP-T',
    label: 'Global Trade Control Laws; Sanctions',
    description: 'Compliance with sanctions, export controls, trade restrictions',
    aliases: ['Sanctions', 'Export Controls', 'Trade Controls'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'REP-T-OIL': {
    type: 'REP-T',
    label: 'Oil & Gas Leases; Rights-of-Way',
    description: 'Oil and gas lease interests, rights-of-way, surface rights',
    aliases: ['Oil and Gas Leases', 'Mineral Rights'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-T-WELLS': {
    type: 'REP-T',
    label: 'Wells and Equipment',
    description: 'Status of wells and related equipment',
    aliases: ['Wells', 'Drilling Equipment'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-T-RESERVE': {
    type: 'REP-T',
    label: 'Reserve Reports',
    description: 'Oil and gas reserve reports and estimates',
    aliases: ['Reserve Reports', 'Reserve Estimates'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-T-REGSTATUS': {
    type: 'REP-T',
    label: 'Regulatory Status',
    description: 'Regulatory status of the target company',
    aliases: ['Regulatory Status', 'Regulated Entity Status'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-T-CONSENT': {
    type: 'REP-T',
    label: 'Consents and Approvals (separate from No Conflict)',
    description: 'Standalone consents and approvals representation',
    aliases: ['Consents and Approvals'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  // Pharma-specific target reps (cross-check additions)
  'REP-T-CLINICAL': {
    type: 'REP-T',
    label: 'Clinical Trials; Clinical Data',
    description: 'Status of clinical trials, clinical data integrity, IND/NDA filings',
    aliases: ['Clinical Trials', 'Clinical Data', 'Clinical Studies'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'REP-T-HEALTHCARE': {
    type: 'REP-T',
    label: 'Healthcare Compliance',
    description: 'Compliance with healthcare laws including Anti-Kickback Statute, Stark Law, FCA',
    aliases: ['Healthcare Compliance', 'Anti-Kickback', 'Stark Law', 'False Claims Act'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'REP-T-HEALTHLAWS': {
    type: 'REP-T',
    label: 'Health Care Laws',
    description: 'Compliance with broader healthcare regulatory framework (HIPAA, state laws, PhRMA Code)',
    aliases: ['Health Care Laws', 'HIPAA Compliance', 'Healthcare Laws'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },

  // ── REP-B ───────────────────────────────────────────────────────────────
  'REP-B-ORG': {
    type: 'REP-B',
    label: 'Organization; Qualification; Standing',
    description: 'Buyer is duly organized, validly existing, in good standing',
    aliases: ['Organization and Standing'],
    frequency: 'universal',
    industries: [],
  },
  'REP-B-AUTH': {
    type: 'REP-B',
    label: 'Authority; Enforceability',
    description: 'Buyer has corporate authority to enter into and perform the agreement',
    aliases: ['Authority', 'Corporate Authority'],
    frequency: 'universal',
    industries: [],
  },
  'REP-B-NOCONFLICT': {
    type: 'REP-B',
    label: 'No Conflict; Required Filings and Consents',
    description: 'No violation of buyer charter, contracts, or laws',
    aliases: ['Non-Contravention', 'No Violations'],
    frequency: 'universal',
    industries: [],
  },
  'REP-B-LIT': {
    type: 'REP-B',
    label: 'Litigation; Legal Proceedings',
    description: 'No pending or threatened litigation against buyer that would impede the merger',
    aliases: ['Litigation', 'Legal Proceedings'],
    frequency: 'universal',
    industries: [],
  },
  'REP-B-BROKERS': {
    type: 'REP-B',
    label: 'Brokers; Finders',
    description: 'No brokers or finders fees payable by buyer except disclosed advisors',
    aliases: ['Brokers', 'Finders Fees'],
    frequency: 'universal',
    industries: [],
  },
  'REP-B-FUNDS': {
    type: 'REP-B',
    label: 'Sufficient / Available Funds; Financing',
    description: 'Buyer has sufficient funds or committed financing to pay merger consideration',
    aliases: ['Available Funds', 'Financing', 'Sufficient Funds'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-B-MERGESUB': {
    type: 'REP-B',
    label: 'Merger Sub; No Prior Activities',
    description: 'Merger sub is newly formed with no prior operations',
    aliases: ['Merger Sub', 'No Prior Activities'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-PROXY': {
    type: 'REP-B',
    label: 'Information Supplied / Proxy Statement',
    description: 'Information supplied by buyer for proxy statement is accurate',
    aliases: ['Information Supplied', 'Proxy Statement Information'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-VOTE': {
    type: 'REP-B',
    label: 'Vote / Approval Required',
    description: 'No buyer stockholder vote required for the merger',
    aliases: ['No Vote Required', 'Buyer Stockholder Approval'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-NOINTEREST': {
    type: 'REP-B',
    label: 'No Interested Stockholder; Ownership of Stock',
    description: 'Buyer does not own target stock triggering anti-takeover statutes',
    aliases: ['No Interested Stockholder', 'Ownership of Company Stock'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-NOREP': {
    type: 'REP-B',
    label: 'No Other Representations or Warranties',
    description: 'Disclaimer of buyer representations beyond those expressly made',
    aliases: ['No Other Representations', 'Disclaimer of Representations'],
    frequency: 'near-universal',
    industries: [],
  },
  'REP-B-CAP': {
    type: 'REP-B',
    label: 'Capitalization (public buyer)',
    description: 'Buyer capital structure for stock-deal transactions',
    aliases: ['Buyer Capitalization'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-SEC': {
    type: 'REP-B',
    label: 'SEC Documents; Financial Statements (public buyer)',
    description: 'Buyer SEC filings and financial statements',
    aliases: ['Buyer SEC Filings', 'Buyer Financial Statements'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-NOCHANGE': {
    type: 'REP-B',
    label: 'Absence of Certain Changes (public buyer)',
    description: 'No material adverse change in buyer since balance sheet date',
    aliases: ['Buyer Absence of Changes'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-NOLIAB': {
    type: 'REP-B',
    label: 'No Undisclosed Liabilities (public buyer)',
    description: 'No undisclosed liabilities of buyer',
    aliases: ['Buyer Undisclosed Liabilities'],
    frequency: 'industry-specific',
    industries: [],
  },
  'REP-B-TAX': {
    type: 'REP-B',
    label: 'Taxes (public buyer)',
    description: 'Buyer tax representations for stock-deal transactions',
    aliases: ['Buyer Taxes'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-COMPLY': {
    type: 'REP-B',
    label: 'Compliance with Laws (public buyer)',
    description: 'Buyer compliance with applicable laws',
    aliases: ['Buyer Compliance'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-BENEFITS': {
    type: 'REP-B',
    label: 'Employee Benefit Plans (public buyer)',
    description: 'Buyer employee benefit plan representations',
    aliases: ['Buyer Employee Benefits'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-ENV': {
    type: 'REP-B',
    label: 'Environmental (public buyer)',
    description: 'Buyer environmental compliance representations',
    aliases: ['Buyer Environmental'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-B-IP': {
    type: 'REP-B',
    label: 'Intellectual Property (public buyer)',
    description: 'Buyer intellectual property representations',
    aliases: ['Buyer IP', 'Buyer Intellectual Property'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-B-CONTRACTS': {
    type: 'REP-B',
    label: 'Material Contracts (public buyer)',
    description: 'Buyer material contract representations',
    aliases: ['Buyer Material Contracts'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },
  'REP-B-SOLVENCY': {
    type: 'REP-B',
    label: 'Solvency',
    description: 'Buyer is and will remain solvent after the merger',
    aliases: ['Solvency', 'Solvency Opinion'],
    frequency: 'industry-specific',
    industries: [],
  },
  'REP-B-LABOR': {
    type: 'REP-B',
    label: 'Labor Matters (public buyer)',
    description: 'Buyer labor and employment representations',
    aliases: ['Buyer Labor', 'Buyer Employment'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-EQUITY': {
    type: 'REP-B',
    label: 'Equity Investment',
    description: 'Representations regarding equity investment in the transaction',
    aliases: ['Equity Investment'],
    frequency: 'industry-specific',
    industries: [],
  },
  'REP-B-FAIRNESS': {
    type: 'REP-B',
    label: 'Opinion of Financial Advisor (buyer)',
    description: 'Buyer receipt of fairness opinion',
    aliases: ['Buyer Fairness Opinion'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-NORIGHTS': {
    type: 'REP-B',
    label: 'No Rights Plan',
    description: 'Buyer has no poison pill or rights plan in effect',
    aliases: ['No Rights Plan', 'No Poison Pill'],
    frequency: 'industry-specific',
    industries: ['energy'],
  },

  // ── IOC ─────────────────────────────────────────────────────────────────
  'IOC-ORDINARY': {
    type: 'IOC',
    label: 'Ordinary Course Obligation',
    description: 'General obligation to conduct business in the ordinary course',
    aliases: ['Ordinary Course', 'Conduct of Business'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-PRESERVE': {
    type: 'IOC',
    label: 'Preservation of Business Relationships',
    description: 'Use commercially reasonable efforts to preserve present relationships with suppliers, licensors, licensees, Governmental Entities and others having material business dealings',
    aliases: ['Preservation of Relationships', 'Preserve Business Relationships', 'Preservation of Business'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-MAINTAIN': {
    type: 'IOC',
    label: 'Maintain Business Organization & Material Assets',
    description: 'Maintain material assets and business organization intact in all material respects',
    aliases: ['Maintain Business Organization', 'Maintain Material Assets', 'Maintenance of Business'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-NEWLINE': {
    type: 'IOC',
    label: 'No New Lines of Business',
    description: 'Target cannot enter into any new line of business',
    aliases: ['No New Line of Business', 'New Lines of Business'],
    frequency: 'common',
    industries: [],
  },
  'IOC-NOACTION': {
    type: 'IOC',
    label: 'General No-Action Restriction',
    description: 'General prohibition on actions outside the ordinary course of business',
    aliases: ['No Action Outside Ordinary Course'],
    frequency: 'common',
    industries: [],
  },
  'IOC-OTHER-AFFIRMATIVE': {
    type: 'IOC',
    label: 'Other Affirmative Obligations',
    description: 'Other affirmative obligations stated in the IOC preamble (catch-all)',
    aliases: [],
    frequency: 'common',
    industries: [],
  },
  'IOC-AFFIRMATIVE': {
    type: 'IOC',
    label: 'Affirmative Covenants',
    description: 'Affirmative duties stated in the IOC preamble (ordinary course, preserve relationships, maintain assets)',
    aliases: [],
    frequency: 'common',
    industries: [],
  },
  'IOC-GENERAL-EXCEPTIONS': {
    type: 'IOC',
    label: 'General Exceptions',
    description: 'Section-wide carve-outs that apply to all IOC restrictions',
    aliases: [],
    frequency: 'common',
    industries: [],
  },
  'IOC-CHARTER': {
    type: 'IOC',
    label: 'Charter / Bylaws Amendments',
    description: 'No amendments to certificate of incorporation or bylaws',
    aliases: ['Charter Amendments', 'Bylaws Amendments', 'Organizational Document Changes'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-MERGE': {
    type: 'IOC',
    label: 'Mergers, Acquisitions, Dispositions',
    description: 'No mergers, acquisitions, sales of material assets',
    aliases: ['No Acquisitions', 'No Dispositions', 'Asset Sales'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-ISSUE': {
    type: 'IOC',
    label: 'Issuance of Securities',
    description: 'No issuance, sale, or pledge of equity securities',
    aliases: ['No Issuance of Securities', 'Securities Issuance'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-REPURCHASE': {
    type: 'IOC',
    label: 'Share Repurchases',
    description: 'No repurchase or redemption of equity securities',
    aliases: ['No Share Repurchases', 'No Redemptions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-DIVIDEND': {
    type: 'IOC',
    label: 'Dividends and Distributions',
    description: 'No declaration or payment of dividends',
    aliases: ['No Dividends', 'No Distributions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-SPLIT': {
    type: 'IOC',
    label: 'Stock Splits / Reclassifications',
    description: 'No splits, combinations, subdivisions, reclassifications',
    aliases: ['No Stock Splits', 'No Reclassifications'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-DEBT': {
    type: 'IOC',
    label: 'Indebtedness',
    description: 'No incurrence of indebtedness or guarantees',
    aliases: ['No Indebtedness', 'No Borrowing', 'No Guarantees'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-LIEN': {
    type: 'IOC',
    label: 'Liens and Encumbrances',
    description: 'No creation of liens on material assets',
    aliases: ['No Liens', 'No Encumbrances'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-CAPEX': {
    type: 'IOC',
    label: 'Capital Expenditures',
    description: 'Restrictions on capital expenditures',
    aliases: ['CapEx Restrictions', 'Capital Spending'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-COMP': {
    type: 'IOC',
    label: 'Compensation and Benefits',
    description: 'No increases in compensation, bonuses, new plans',
    aliases: ['No Compensation Increases', 'No Bonus Payments', 'Compensation Changes'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-HIRE': {
    type: 'IOC',
    label: 'Hiring and Termination',
    description: 'Restrictions on hiring/firing above certain levels',
    aliases: ['Hiring Restrictions', 'Termination Restrictions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-SETTLE': {
    type: 'IOC',
    label: 'Settlement of Claims',
    description: 'No settlement of material litigation',
    aliases: ['No Settlements', 'Litigation Settlement'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-TAX': {
    type: 'IOC',
    label: 'Tax Elections and Filings',
    description: 'No material changes in tax elections, methods, or filings',
    aliases: ['Tax Elections', 'No Tax Changes'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-ACCOUNTING': {
    type: 'IOC',
    label: 'Accounting Changes',
    description: 'No changes in accounting methods or principles',
    aliases: ['No Accounting Changes', 'Accounting Methods'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-CONTRACT': {
    type: 'IOC',
    label: 'Material Contracts',
    description: 'No entry into, modification, or termination of material contracts',
    aliases: ['No Contract Changes', 'Material Contract Restrictions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-IP': {
    type: 'IOC',
    label: 'Intellectual Property',
    description: 'No licensing, transfer, or abandonment of material IP',
    aliases: ['No IP Transfers', 'IP Restrictions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-INSURANCE': {
    type: 'IOC',
    label: 'Insurance Policies',
    description: 'No cancellation or material change to insurance',
    aliases: ['No Insurance Changes'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-REALPROP': {
    type: 'IOC',
    label: 'Real Property',
    description: 'No acquisition, sale, or lease of real property',
    aliases: ['No Real Property Changes', 'Real Estate Restrictions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-WAIVE': {
    type: 'IOC',
    label: 'Waiver of Rights',
    description: 'No waiver or release of material claims or rights',
    aliases: ['No Waivers', 'No Release of Rights'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-AFFILIATE': {
    type: 'IOC',
    label: 'Affiliate Transactions',
    description: 'No entry into transactions with affiliates',
    aliases: ['No Affiliate Transactions', 'Related Party Restrictions'],
    frequency: 'universal',
    industries: [],
  },
  'IOC-ENVIRO': {
    type: 'IOC',
    label: 'Environmental',
    description: 'No actions that would create material environmental liability',
    aliases: ['Environmental Restrictions'],
    frequency: 'common',
    industries: [],
  },
  'IOC-COMMIT': {
    type: 'IOC',
    label: 'Commitments',
    description: 'No agreement or commitment to do any of the foregoing',
    aliases: ['No Commitments', 'Anti-Evasion'],
    frequency: 'universal',
    industries: [],
  },
  // Pharma-specific IOC (cross-check additions)
  'IOC-CLINICAL': {
    type: 'IOC',
    label: 'Clinical Trials',
    description: 'Restrictions on initiating, modifying, or terminating clinical trials',
    aliases: ['Clinical Trial Restrictions', 'No Clinical Trial Changes'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'IOC-PRODUCT': {
    type: 'IOC',
    label: 'Product Development',
    description: 'Restrictions on product development, formulation changes, manufacturing process changes',
    aliases: ['Product Development Restrictions', 'No Product Changes'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'IOC-REGAUTH': {
    type: 'IOC',
    label: 'Regulatory Authorizations',
    description: 'Restrictions on withdrawing, modifying, or failing to maintain regulatory authorizations',
    aliases: ['Regulatory Authorization Restrictions', 'No Regulatory Changes'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },

  // ── NOSOL ───────────────────────────────────────────────────────────────
  'NOSOL-PROHIBIT': {
    type: 'NOSOL',
    label: 'Solicitation Prohibition',
    description: 'Core no-shop / no-solicitation restriction',
    aliases: ['No-Shop', 'No-Solicitation', 'Non-Solicitation'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-CEASE': {
    type: 'NOSOL',
    label: 'Cease Existing Discussions',
    description: 'Obligation to cease and terminate pre-signing discussions',
    aliases: ['Cease Discussions', 'Terminate Existing Negotiations'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-EXCEPT': {
    type: 'NOSOL',
    label: 'Exceptions / Fiduciary Out',
    description: 'Conditions under which board may engage with unsolicited proposals',
    aliases: ['Fiduciary Out', 'Fiduciary Exception', 'Board Exception'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-SUPERIOR': {
    type: 'NOSOL',
    label: 'Superior Proposal Definition',
    description: 'Definition and criteria for what constitutes a "superior proposal"',
    aliases: ['Superior Proposal', 'Superior Offer'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-ACQPROPOSAL': {
    type: 'NOSOL',
    label: 'Acquisition Proposal Definition',
    description: 'Definition of "acquisition proposal" / "competing proposal"',
    aliases: ['Acquisition Proposal', 'Competing Proposal', 'Takeover Proposal'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-NOTICE': {
    type: 'NOSOL',
    label: 'Notice to Counterparty',
    description: 'Obligation to promptly notify buyer of receipt of competing proposals',
    aliases: ['Notice of Competing Proposal', 'Notification Obligation'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-DISCLOSE': {
    type: 'NOSOL',
    label: 'Disclosure of Terms',
    description: 'Obligation to share identity of bidder and material terms of proposals',
    aliases: ['Disclosure of Bidder Identity', 'Sharing of Proposal Terms'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-MATCH': {
    type: 'NOSOL',
    label: 'Matching Rights',
    description: 'Buyer\'s right to match or improve offer before board acts',
    aliases: ['Right to Match', 'Matching Right', 'Last Look'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-NEGOTIATE': {
    type: 'NOSOL',
    label: 'Negotiation Period',
    description: 'Specific time period for buyer to negotiate/match (e.g. 4 business days)',
    aliases: ['Negotiation Period', 'Matching Period'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-REMATCH': {
    type: 'NOSOL',
    label: 'Subsequent Matching / Amendment Rights',
    description: 'Re-matching rights on material amendments to competing proposal',
    aliases: ['Subsequent Matching', 'Re-Match Rights', 'Amendment Matching'],
    frequency: 'common',
    industries: [],
  },
  'NOSOL-RECOMMEND': {
    type: 'NOSOL',
    label: 'Change of Recommendation',
    description: 'Board\'s right and process to withdraw or change its recommendation',
    aliases: ['Change of Recommendation', 'Recommendation Withdrawal', 'Adverse Recommendation Change'],
    frequency: 'universal',
    industries: [],
  },
  'NOSOL-INTERVENING': {
    type: 'NOSOL',
    label: 'Intervening Event',
    description: 'Rights related to intervening events distinct from competing proposals',
    aliases: ['Intervening Event', 'Intervening Event Exception'],
    frequency: 'common',
    industries: [],
  },
  'NOSOL-WINDOW': {
    type: 'NOSOL',
    label: 'Go-Shop / Window Shop',
    description: 'Active solicitation window period (if any); post-window transition',
    aliases: ['Go-Shop', 'Window Shop', 'Go-Shop Period', 'Active Solicitation Period'],
    frequency: 'common',
    industries: [],
  },
  'NOSOL-ENFORCE': {
    type: 'NOSOL',
    label: 'Enforcement of Standstills',
    description: 'Obligation to enforce or not waive existing standstill/NDA obligations',
    aliases: ['Standstill Enforcement', 'NDA Enforcement'],
    frequency: 'common',
    industries: [],
  },
  'NOSOL-WAIVER': {
    type: 'NOSOL',
    label: 'Standstill Waiver / Don\'t-Ask-Don\'t-Waive',
    description: 'Whether target can waive standstills; DADW provisions',
    aliases: ['DADW', 'Don\'t Ask Don\'t Waive', 'Standstill Waiver'],
    frequency: 'common',
    industries: [],
  },
  'NOSOL-INFORMATION': {
    type: 'NOSOL',
    label: 'Provision of Information to Bidder',
    description: 'Conditions for providing non-public information to a third-party bidder',
    aliases: ['Information Rights', 'Data Room Access for Bidders'],
    frequency: 'common',
    industries: [],
  },
  'NOSOL-CONFID': {
    type: 'NOSOL',
    label: 'Confidentiality Agreement Requirement',
    description: 'Requirement for acceptable confidentiality agreement with bidder',
    aliases: ['NDA Requirement', 'Confidentiality Requirement'],
    frequency: 'common',
    industries: [],
  },

  // ── ANTI ────────────────────────────────────────────────────────────────
  //    Canonical display order: ANTI-EFFORTS first (the headline efforts
  //    standard), then ANTI-BURDEN (the negotiated cap / divestiture limit),
  //    then ANTI-NOACTION, then the rest (filings, cooperation, etc.).
  'ANTI-EFFORTS': {
    type: 'ANTI',
    label: 'Standard of Efforts',
    description: 'Efforts standard — reasonable best efforts, commercially reasonable, etc.',
    aliases: ['Best Efforts', 'Reasonable Best Efforts', 'Commercially Reasonable Efforts'],
    frequency: 'near-universal',
    industries: [],
    sort_order: 1,
  },
  'ANTI-BURDEN': {
    type: 'ANTI',
    label: 'Burden Cap / Divestiture Limits',
    description: 'Limits on required divestitures, hold-separates, behavioral remedies; hell-or-high-water is the absence of any such cap',
    aliases: ['Divestiture Cap', 'Hold-Separate', 'Hell or High Water', 'Burdensome Condition'],
    frequency: 'near-universal',
    industries: [],
    sort_order: 2,
  },
  'ANTI-NOACTION': {
    type: 'ANTI',
    label: 'No Inconsistent Action',
    description: 'Prohibition on actions that would impede or delay regulatory clearance',
    aliases: ['No Inconsistent Action', 'No Impediment'],
    frequency: 'common',
    industries: [],
    sort_order: 3,
  },
  'ANTI-FILING': {
    type: 'ANTI',
    label: 'Regulatory Filing Deadline',
    description: 'Deadline for making HSR and other regulatory filings (e.g., within X business days of signing)',
    aliases: ['HSR Filing', 'Antitrust Filing', 'Regulatory Filing', 'HSR / Regulatory Filings', 'Regulatory Filing Deadline', 'Filing Deadline'],
    frequency: 'universal',
    industries: [],
    sort_order: 4,
  },
  'ANTI-COOPERATE': {
    type: 'ANTI',
    label: 'Cooperation / Control',
    description: 'Mutual cooperation obligations in dealing with regulators, and which party controls antitrust strategy',
    aliases: ['Regulatory Cooperation', 'Mutual Cooperation', 'Cooperation', 'Control of Antitrust Strategy'],
    frequency: 'universal',
    industries: [],
    sort_order: 5,
  },
  'ANTI-INFO': {
    type: 'ANTI',
    label: 'Information to Regulators',
    description: 'Obligation to provide information and documents to regulators',
    aliases: ['Information Provision', 'Document Production'],
    frequency: 'universal',
    industries: [],
    sort_order: 6,
  },
  'ANTI-FOREIGN': {
    type: 'ANTI',
    label: 'Foreign Regulatory Approvals',
    description: 'Non-US antitrust/regulatory filings and approvals (EU, China, etc.)',
    aliases: ['Foreign Antitrust', 'EU Merger Filing', 'CFIUS', 'International Regulatory'],
    frequency: 'common',
    industries: [],
    sort_order: 7,
  },
  'ANTI-INTERIM': {
    type: 'ANTI',
    label: 'Interim Compliance',
    description: 'Operating restrictions during regulatory review period',
    aliases: ['Interim Operating Restrictions', 'Regulatory Review Period'],
    frequency: 'common',
    industries: [],
    sort_order: 8,
  },
  'ANTI-NOTIFY': {
    type: 'ANTI',
    label: 'Notification of Developments',
    description: 'Obligation to notify counterparty of material regulatory developments',
    aliases: ['Regulatory Notification', 'Notice of Developments'],
    frequency: 'common',
    industries: [],
    sort_order: 9,
  },
  'ANTI-LITIGATION': {
    type: 'ANTI',
    label: 'Litigation Against Regulators',
    description: 'Obligation (or right) to litigate/challenge adverse regulatory action',
    aliases: ['Regulatory Litigation', 'Challenge Regulatory Action'],
    frequency: 'common',
    industries: [],
    sort_order: 10,
  },
  'ANTI-CONSULT': {
    type: 'ANTI',
    label: 'Consultation Rights',
    description: 'Right to review and comment on filings and communications with regulators',
    aliases: ['Filing Review', 'Consultation on Filings'],
    frequency: 'common',
    industries: [],
    sort_order: 11,
  },
  'ANTI-TIMING': {
    type: 'ANTI',
    label: 'Timing Agreements',
    description: 'Agreements on timing of filings, pull-and-refile, extensions',
    aliases: ['Filing Timing', 'Pull and Refile'],
    frequency: 'common',
    industries: [],
    sort_order: 12,
  },

  // ── COND-M ──────────────────────────────────────────────────────────────
  'COND-M-LEGAL': {
    type: 'COND-M',
    label: 'No Legal Impediment',
    description: 'No injunction, order, or law preventing closing',
    aliases: ['No Injunction', 'No Legal Bar', 'No Legal Impediment'],
    frequency: 'near-universal',
    industries: [],
  },
  'COND-M-REG': {
    type: 'COND-M',
    label: 'Regulatory Approvals',
    description: 'HSR expiration/termination and other required regulatory approvals',
    aliases: ['HSR Clearance', 'Antitrust Approval', 'Regulatory Clearance'],
    frequency: 'universal',
    industries: [],
  },
  'COND-M-STOCKHOLDER': {
    type: 'COND-M',
    label: 'Stockholder Approval',
    description: 'Company stockholder vote obtained',
    aliases: ['Stockholder Vote', 'Shareholder Approval'],
    frequency: 'near-universal',
    industries: [],
  },
  'COND-M-S4': {
    type: 'COND-M',
    label: 'Form S-4 Effectiveness',
    description: 'Registration statement effective (stock deals)',
    aliases: ['S-4 Effective', 'Registration Statement'],
    frequency: 'common',
    industries: [],
  },
  'COND-M-LISTING': {
    type: 'COND-M',
    label: 'Stock Exchange Listing',
    description: 'Buyer shares approved for listing (stock deals)',
    aliases: ['Listing Approval', 'NYSE Listing', 'NASDAQ Listing'],
    frequency: 'common',
    industries: [],
  },

  // ── COND-B ──────────────────────────────────────────────────────────────
  'COND-B-REP': {
    type: 'COND-B',
    label: 'Accuracy of Target Reps',
    description: 'Target\'s representations are true and correct (at specified standard)',
    aliases: ['Target Reps Accurate', 'Company Reps Bring-Down'],
    frequency: 'universal',
    industries: [],
  },
  'COND-B-COV': {
    type: 'COND-B',
    label: 'Target Covenant Compliance',
    description: 'Target has performed its covenants in all material respects',
    aliases: ['Target Covenant Compliance', 'Company Covenant Bring-Down'],
    frequency: 'universal',
    industries: [],
  },
  'COND-B-MAE': {
    type: 'COND-B',
    label: 'No Target MAE',
    description: 'No material adverse effect on the target since signing',
    aliases: ['No MAE', 'No Material Adverse Effect', 'MAE Condition'],
    frequency: 'universal',
    industries: [],
  },
  'COND-B-CERT': {
    type: 'COND-B',
    label: 'Officer\'s Certificate (Target)',
    description: 'Delivery of target officer\'s certificate confirming reps/covenants',
    aliases: ['Target Officer Certificate', 'Company Closing Certificate'],
    frequency: 'universal',
    industries: [],
  },
  'COND-B-DISSENT': {
    type: 'COND-B',
    label: 'Dissenting Shares Threshold',
    description: 'Dissenting shares below specified threshold (if applicable)',
    aliases: ['Dissenting Shares Condition', 'Appraisal Threshold'],
    frequency: 'industry-specific',
    industries: [],
  },

  // ── COND-S ──────────────────────────────────────────────────────────────
  'COND-S-REP': {
    type: 'COND-S',
    label: 'Accuracy of Buyer Reps',
    description: 'Buyer\'s representations are true and correct (at specified standard)',
    aliases: ['Buyer Reps Accurate', 'Parent Reps Bring-Down'],
    frequency: 'universal',
    industries: [],
  },
  'COND-S-COV': {
    type: 'COND-S',
    label: 'Buyer Covenant Compliance',
    description: 'Buyer has performed its covenants in all material respects',
    aliases: ['Buyer Covenant Compliance', 'Parent Covenant Bring-Down'],
    frequency: 'universal',
    industries: [],
  },
  'COND-S-CERT': {
    type: 'COND-S',
    label: 'Officer\'s Certificate (Buyer)',
    description: 'Delivery of buyer officer\'s certificate confirming reps/covenants',
    aliases: ['Buyer Officer Certificate', 'Parent Closing Certificate'],
    frequency: 'universal',
    industries: [],
  },
  'COND-S-FUNDS': {
    type: 'COND-S',
    label: 'Availability of Funds',
    description: 'Buyer has funds available to pay merger consideration',
    aliases: ['Funds Condition', 'Financing Condition'],
    frequency: 'common',
    industries: [],
  },

  // ── COND (modifiers) ───────────────────────────────────────────────────
  'COND-FRUSTRATE': {
    type: 'COND',
    label: 'Frustration of Conditions',
    description: 'Party cannot invoke failure of condition it caused',
    aliases: ['Anti-Frustration', 'No Frustration'],
    frequency: 'common',
    industries: [],
  },
  'COND-TAXOPINION': {
    type: 'COND',
    label: 'Tax Opinion',
    description: 'Receipt of required tax opinions as condition',
    aliases: ['Tax Opinion Condition', 'Tax-Free Reorganization Opinion'],
    frequency: 'common',
    industries: [],
  },

  // ── TERMR ───────────────────────────────────────────────────────────────
  'TERMR-MUTUAL': {
    type: 'TERMR',
    label: 'Mutual Termination',
    description: 'Termination by mutual written consent',
    aliases: ['Mutual Consent Termination'],
    frequency: 'near-universal',
    industries: [],
  },
  'TERMR-OUTSIDE': {
    type: 'TERMR',
    label: 'Outside Date',
    description: 'Termination if closing hasn\'t occurred by outside date',
    aliases: ['Outside Date', 'End Date', 'Drop Dead Date', 'Long Stop Date'],
    frequency: 'near-universal',
    industries: [],
  },
  'TERMR-EXTENSION': {
    type: 'TERMR',
    label: 'Outside Date Extension',
    description: 'Automatic or optional extension of the outside date',
    aliases: ['Extension of Outside Date', 'Ticking Fee'],
    frequency: 'common',
    industries: [],
  },
  'TERMR-LEGAL': {
    type: 'TERMR',
    label: 'Legal Impediment',
    description: 'Termination due to final, non-appealable injunction or legal bar',
    aliases: ['Legal Bar Termination', 'Injunction Termination'],
    frequency: 'common',
    industries: [],
  },
  'TERMR-VOTE': {
    type: 'TERMR',
    label: 'Stockholder Vote Failure',
    description: 'Termination if stockholder approval not obtained at meeting',
    aliases: ['Vote Failure Termination', 'Failed Stockholder Vote'],
    frequency: 'common',
    industries: [],
  },
  'TERMR-BREACH-T': {
    type: 'TERMR',
    label: 'Target Breach',
    description: 'Buyer\'s right to terminate for target\'s uncured material breach',
    aliases: ['Target Breach Termination', 'Company Breach'],
    frequency: 'universal',
    industries: [],
  },
  'TERMR-BREACH-B': {
    type: 'TERMR',
    label: 'Buyer Breach',
    description: 'Target\'s right to terminate for buyer\'s uncured material breach',
    aliases: ['Buyer Breach Termination', 'Parent Breach'],
    frequency: 'universal',
    industries: [],
  },
  'TERMR-SUPERIOR': {
    type: 'TERMR',
    label: 'Superior Proposal',
    description: 'Target\'s right to terminate to accept a superior proposal',
    aliases: ['Superior Proposal Termination', 'Fiduciary Termination'],
    frequency: 'common',
    industries: [],
  },
  'TERMR-RECOMMEND': {
    type: 'TERMR',
    label: 'Change of Recommendation',
    description: 'Buyer\'s right to terminate upon target board\'s change of recommendation',
    aliases: ['Change of Recommendation Termination', 'Adverse Recommendation Termination'],
    frequency: 'common',
    industries: [],
  },

  // ── TERMF ───────────────────────────────────────────────────────────────
  'TERMF-TARGET': {
    type: 'TERMF',
    label: 'Company Termination Fee',
    description: 'Fee payable by the target company (amount and trigger)',
    aliases: ['Target Termination Fee', 'Company Break-Up Fee', 'Break Fee'],
    frequency: 'universal',
    industries: [],
  },
  'TERMF-REVERSE': {
    type: 'TERMF',
    label: 'Reverse Termination Fee',
    description: 'Fee payable by the buyer (amount and trigger)',
    aliases: ['Reverse Break-Up Fee', 'Buyer Termination Fee', 'Reverse Break Fee'],
    frequency: 'common',
    industries: [],
  },
  'TERMF-EXPENSE': {
    type: 'TERMF',
    label: 'Expense Reimbursement',
    description: 'Expense reimbursement obligations on termination',
    aliases: ['Termination Expense Reimbursement'],
    frequency: 'common',
    industries: [],
  },
  'TERMF-TAIL': {
    type: 'TERMF',
    label: 'Tail Provision',
    description: 'Fee triggered by subsequent alternative transaction within specified period',
    aliases: ['Tail Period', 'Naked No-Vote Fee', 'Subsequent Transaction Fee'],
    frequency: 'common',
    industries: [],
  },
  'TERMF-EFFECT': {
    type: 'TERMF',
    label: 'Effect of Termination',
    description: 'Consequences and limitations on liability post-termination',
    aliases: ['Effect of Termination', 'Post-Termination Liability'],
    frequency: 'universal',
    industries: [],
  },
  'TERMF-SOLE': {
    type: 'TERMF',
    label: 'Sole and Exclusive Remedy',
    description: 'Fee as sole remedy / liability cap provision',
    aliases: ['Sole Remedy', 'Exclusive Remedy', 'Liability Cap'],
    frequency: 'common',
    industries: [],
  },

  // ── DEF ─────────────────────────────────────────────────────────────────
  // Core Negotiated Definitions
  'DEF-MAE': {
    type: 'DEF',
    label: 'Material Adverse Effect',
    description: 'Core MAE definition — what constitutes an MAE on the company',
    aliases: ['MAE', 'Material Adverse Change', 'MAC'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-MAE-CARVEOUT': {
    type: 'DEF',
    label: 'MAE Carve-Outs',
    description: 'Enumerated exceptions (market conditions, industry changes, law changes, etc.)',
    aliases: ['MAE Exceptions', 'MAE Exclusions', 'Carve-Outs'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-MAE-DISPROP': {
    type: 'DEF',
    label: 'MAE Disproportionate Impact',
    description: '"Except to the extent disproportionately affected" qualifier on carve-outs',
    aliases: ['Disproportionate Impact', 'Disproportionate Effect'],
    frequency: 'common',
    industries: [],
  },
  // Pharma-specific MAE definition (cross-check addition)
  'DEF-MAE-CLINICAL': {
    type: 'DEF',
    label: 'MAE Clinical Exclusion',
    description: 'MAE carve-out or inclusion for clinical trial results, FDA actions, or pipeline developments',
    aliases: ['Clinical Trial MAE Carve-Out', 'FDA Action MAE', 'Pipeline MAE'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  'DEF-SUPERIOR': {
    type: 'DEF',
    label: 'Superior Proposal',
    description: 'Definition of what constitutes a "superior proposal"',
    aliases: ['Superior Proposal Definition', 'Superior Offer Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-ACQPROPOSAL': {
    type: 'DEF',
    label: 'Acquisition Proposal',
    description: 'Definition of "acquisition proposal" / "takeover proposal" / "competing transaction"',
    aliases: ['Acquisition Proposal Definition', 'Competing Transaction', 'Takeover Proposal Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-INTERVENING': {
    type: 'DEF',
    label: 'Intervening Event',
    description: 'Definition of "intervening event" (if the concept exists in the deal)',
    aliases: ['Intervening Event Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-KNOWLEDGE': {
    type: 'DEF',
    label: 'Knowledge',
    description: 'Knowledge standard — actual knowledge, constructive knowledge, inquiry obligation',
    aliases: ['Knowledge Qualifier', 'Knowledge Standard', 'To the Knowledge of'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-ORDINARY': {
    type: 'DEF',
    label: 'Ordinary Course of Business',
    description: 'Meaning of "ordinary course" and any "consistent with past practice" qualifier',
    aliases: ['Ordinary Course', 'Consistent with Past Practice'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-BURDENSOME': {
    type: 'DEF',
    label: 'Burdensome Condition',
    description: 'Definition of what constitutes a "burdensome condition" for regulatory remedies',
    aliases: ['Burdensome Condition Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-WILLFUL': {
    type: 'DEF',
    label: 'Willful Breach',
    description: 'Definition of "willful breach" or "intentional breach" (impacts liability caps)',
    aliases: ['Willful Breach Definition', 'Intentional Breach', 'Knowing and Intentional Breach'],
    frequency: 'common',
    industries: [],
  },
  // Structural / Entity Definitions
  'DEF-SUBSIDIARY': {
    type: 'DEF',
    label: 'Subsidiary',
    description: 'Definition of subsidiary and what entities are included',
    aliases: ['Subsidiary Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-AFFILIATE': {
    type: 'DEF',
    label: 'Affiliate',
    description: 'Definition of affiliate',
    aliases: ['Affiliate Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-PERSON': {
    type: 'DEF',
    label: 'Person',
    description: 'Definition of person (natural persons, entities, governmental authorities)',
    aliases: ['Person Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-REPRESENTATIVE': {
    type: 'DEF',
    label: 'Representatives',
    description: 'Definition of who constitutes "representatives" (advisors, agents, etc.)',
    aliases: ['Representatives Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-COMPANY': {
    type: 'DEF',
    label: 'Company / Target',
    description: 'Definition of the target entity and its coverage',
    aliases: ['Company Definition', 'Target Definition'],
    frequency: 'universal',
    industries: [],
  },
  // Financial / Contractual Definitions
  'DEF-LIEN': {
    type: 'DEF',
    label: 'Lien',
    description: 'Definition of lien, mortgage, pledge, encumbrance',
    aliases: ['Lien Definition', 'Encumbrance Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-PERMITLIEN': {
    type: 'DEF',
    label: 'Permitted Liens',
    description: 'Exceptions to lien restrictions (statutory liens, tax liens, etc.)',
    aliases: ['Permitted Liens Definition', 'Permitted Encumbrances'],
    frequency: 'common',
    industries: [],
  },
  'DEF-CONTRACT': {
    type: 'DEF',
    label: 'Contract',
    description: 'What constitutes a "contract" under the agreement',
    aliases: ['Contract Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-MATCONTRACT': {
    type: 'DEF',
    label: 'Material Contract',
    description: 'Criteria for what makes a contract "material"',
    aliases: ['Material Contract Definition', 'Material Agreement'],
    frequency: 'common',
    industries: [],
  },
  'DEF-INDEBTEDNESS': {
    type: 'DEF',
    label: 'Indebtedness',
    description: 'Definition of indebtedness for covenant and condition purposes',
    aliases: ['Indebtedness Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-BUSINESSDAY': {
    type: 'DEF',
    label: 'Business Day',
    description: 'Business day definition (jurisdiction, exclusions)',
    aliases: ['Business Day Definition'],
    frequency: 'universal',
    industries: [],
  },
  // Securities & Equity Definitions
  'DEF-MERGERCONSID': {
    type: 'DEF',
    label: 'Merger Consideration',
    description: 'Definition of the consideration payable per share',
    aliases: ['Per Share Merger Consideration', 'Aggregate Merger Consideration', 'Closing Consideration'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-EQUITYAWARD': {
    type: 'DEF',
    label: 'Company Equity Awards',
    description: 'What equity instruments are covered (options, RSUs, PSUs, warrants)',
    aliases: ['Equity Award Definition', 'Stock Option Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-DISSENTING': {
    type: 'DEF',
    label: 'Dissenting Shares',
    description: 'Definition and treatment of dissenting/appraisal shares',
    aliases: ['Dissenting Shares Definition', 'Appraisal Shares'],
    frequency: 'common',
    industries: [],
  },
  // Regulatory Definitions
  'DEF-GOVAUTH': {
    type: 'DEF',
    label: 'Governmental Authority',
    description: 'What bodies constitute a governmental authority',
    aliases: ['Governmental Authority Definition', 'Government Body'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-LAW': {
    type: 'DEF',
    label: 'Law',
    description: 'Definition of "law" (statutes, regulations, orders, etc.)',
    aliases: ['Law Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-PERMIT': {
    type: 'DEF',
    label: 'Permit',
    description: 'Definition of permits, licenses, authorizations',
    aliases: ['Permit Definition', 'License Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-REQUIREDAPPROVAL': {
    type: 'DEF',
    label: 'Required Approvals',
    description: 'Specific regulatory approvals needed for closing',
    aliases: ['Required Approvals Definition', 'Required Consents'],
    frequency: 'common',
    industries: [],
  },
  // Employee / Benefits Definitions
  'DEF-BENEFITPLAN': {
    type: 'DEF',
    label: 'Company Benefit Plan',
    description: 'What employee plans are covered',
    aliases: ['Benefit Plan Definition', 'Employee Plan Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-COMPANYEMPLOYEE': {
    type: 'DEF',
    label: 'Company Employees',
    description: 'Which employees are covered by post-closing obligations',
    aliases: ['Company Employee Definition', 'Covered Employees'],
    frequency: 'common',
    industries: [],
  },
  // Tax Definitions
  'DEF-TAX': {
    type: 'DEF',
    label: 'Tax / Taxes',
    description: 'Definition of taxes',
    aliases: ['Tax Definition'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-TAXRETURN': {
    type: 'DEF',
    label: 'Tax Return',
    description: 'Definition of tax returns',
    aliases: ['Tax Return Definition'],
    frequency: 'common',
    industries: [],
  },
  // General / Interpretive
  'DEF-GENERAL': {
    type: 'DEF',
    label: 'General Definitions Section',
    description: 'Main definitions section or cross-reference table',
    aliases: ['Definitions Section'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-INTERP': {
    type: 'DEF',
    label: 'Interpretation / Construction',
    description: 'Rules of interpretation (including, without limitation, etc.)',
    aliases: ['Interpretation', 'Rules of Construction'],
    frequency: 'universal',
    industries: [],
  },
  'DEF-MADE-AVAILABLE': {
    type: 'DEF',
    label: 'Made Available',
    description: 'What "made available" or "furnished" means (data room, SEC filings)',
    aliases: ['Made Available Definition', 'Furnished Definition'],
    frequency: 'common',
    industries: [],
  },
  'DEF-DISCLOSURELETTER': {
    type: 'DEF',
    label: 'Company Disclosure Letter',
    description: 'Scope and effect of the disclosure letter/schedules',
    aliases: ['Disclosure Letter', 'Disclosure Schedules', 'Company Disclosure Schedule'],
    frequency: 'common',
    industries: [],
  },

  // ── COV ─────────────────────────────────────────────────────────────────
  'COV-ACCESS': {
    type: 'COV',
    label: 'Access to Information; Confidentiality',
    description: 'Buyer\'s access to target\'s books, records, personnel',
    aliases: ['Access to Information', 'Books and Records Access'],
    frequency: 'universal',
    industries: [],
  },
  'COV-PROXY': {
    type: 'COV',
    label: 'Proxy Statement Preparation',
    description: 'Preparation and filing of proxy statement',
    aliases: ['Proxy Statement', 'Proxy Filing'],
    frequency: 'universal',
    industries: [],
  },
  'COV-MEETING': {
    type: 'COV',
    label: 'Stockholders Meeting',
    description: 'Obligation to hold and recommend at stockholder meeting',
    aliases: ['Stockholder Meeting', 'Shareholder Meeting', 'Company Meeting'],
    frequency: 'universal',
    industries: [],
  },
  'COV-PUBLICITY': {
    type: 'COV',
    label: 'Public Announcements; Disclosure',
    description: 'Coordination of public communications',
    aliases: ['Public Announcements', 'Press Releases', 'Publicity'],
    frequency: 'near-universal',
    industries: [],
  },
  'COV-INDEMN': {
    type: 'COV',
    label: 'Indemnification; D&O Insurance',
    description: 'Post-closing D&O indemnification and insurance tail',
    aliases: ['D&O Indemnification', 'D&O Insurance Tail', 'Director Indemnification'],
    frequency: 'near-universal',
    industries: [],
  },
  'COV-EMPLOYEE': {
    type: 'COV',
    label: 'Employee Matters; Benefits',
    description: 'Post-closing employee benefit obligations',
    aliases: ['Employee Matters', 'Post-Closing Employee Benefits', 'Employee Covenants'],
    frequency: 'near-universal',
    industries: [],
  },
  'COV-TAKEOVER': {
    type: 'COV',
    label: 'Takeover Laws',
    description: 'Obligation to prevent anti-takeover statutes from applying',
    aliases: ['Anti-Takeover Covenant', 'Section 203 Waiver'],
    frequency: 'common',
    industries: [],
  },
  'COV-NOTIFY': {
    type: 'COV',
    label: 'Notification of Certain Matters',
    description: 'Obligation to notify of material developments',
    aliases: ['Notification Covenant', 'Material Developments Notice'],
    frequency: 'common',
    industries: [],
  },
  'COV-LITNOTIFY': {
    type: 'COV',
    label: 'Stockholder / Transaction Litigation',
    description: 'Coordination on stockholder litigation',
    aliases: ['Transaction Litigation', 'Stockholder Litigation'],
    frequency: 'common',
    industries: [],
  },
  'COV-16B': {
    type: 'COV',
    label: 'Rule 16b-3 / Section 16 Matters',
    description: 'Section 16 exemption for insider transactions',
    aliases: ['Section 16', 'Rule 16b-3', 'Short-Swing Profit Exemption'],
    frequency: 'common',
    industries: [],
  },
  'COV-RESIGN': {
    type: 'COV',
    label: 'Director Resignations',
    description: 'Company director resignations at closing',
    aliases: ['Board Resignations', 'Director Resignations at Closing'],
    frequency: 'common',
    industries: [],
  },
  'COV-FINANCING': {
    type: 'COV',
    label: 'Financing; Financing Cooperation',
    description: 'Buyer financing and target\'s cooperation obligations',
    aliases: ['Financing Covenant', 'Financing Cooperation', 'Debt Financing'],
    frequency: 'common',
    industries: [],
  },
  'COV-DELIST': {
    type: 'COV',
    label: 'Stock Exchange Delisting; Deregistration',
    description: 'Post-closing delisting and deregistration',
    aliases: ['Delisting', 'Deregistration', 'SEC Deregistration'],
    frequency: 'common',
    industries: [],
  },
  'COV-LIST': {
    type: 'COV',
    label: 'Stock Exchange Listing',
    description: 'Listing of new shares (stock-for-stock)',
    aliases: ['Listing Covenant', 'Share Listing'],
    frequency: 'common',
    industries: [],
  },
  'COV-FURTHER': {
    type: 'COV',
    label: 'Further Assurances',
    description: 'General obligation to take further actions',
    aliases: ['Further Assurances', 'Further Actions'],
    frequency: 'common',
    industries: [],
  },
  'COV-SECREPORT': {
    type: 'COV',
    label: 'Post-Closing SEC Reports',
    description: 'Post-closing SEC reporting obligations',
    aliases: ['SEC Reporting', 'Post-Closing Reports'],
    frequency: 'common',
    industries: [],
  },
  'COV-TAXMATTERS': {
    type: 'COV',
    label: 'Tax Matters',
    description: 'Tax-related covenants and cooperation',
    aliases: ['Tax Covenants', 'Tax Cooperation'],
    frequency: 'common',
    industries: [],
  },
  'COV-DEBT': {
    type: 'COV',
    label: 'Treatment of Existing Indebtedness / Notes',
    description: 'Handling of target\'s existing debt',
    aliases: ['Debt Treatment', 'Notes Payoff', 'Existing Indebtedness'],
    frequency: 'common',
    industries: [],
  },
  'COV-MERGESUB': {
    type: 'COV',
    label: 'Merger Sub Compliance',
    description: 'Obligations regarding merger sub',
    aliases: ['Merger Sub Covenant', 'Merger Sub Obligations'],
    frequency: 'common',
    industries: [],
  },
  'COV-DIVIDEND': {
    type: 'COV',
    label: 'Coordination of Dividends',
    description: 'Coordination of dividend payments pre-closing',
    aliases: ['Dividend Coordination', 'Pre-Closing Dividends'],
    frequency: 'common',
    industries: [],
  },
  'COV-CONSENT': {
    type: 'COV',
    label: 'Delivery of Written Consents',
    description: 'Delivery of required consents',
    aliases: ['Written Consents', 'Consent Delivery'],
    frequency: 'common',
    industries: [],
  },
  'COV-PAYOFF': {
    type: 'COV',
    label: 'Payoff Letters',
    description: 'Delivery of payoff letters',
    aliases: ['Payoff Letters', 'Debt Payoff'],
    frequency: 'common',
    industries: [],
  },
  'COV-CVR': {
    type: 'COV',
    label: 'CVR Agreement',
    description: 'Contingent value rights agreement',
    aliases: ['Contingent Value Rights', 'CVR', 'Contingent Consideration'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },
  // Pharma-specific covenants (cross-check additions)
  'COV-FDACOMMS': {
    type: 'COV',
    label: 'FDA Communications',
    description: 'Coordination and notification regarding FDA communications, meetings, and submissions',
    aliases: ['FDA Communications Covenant', 'Regulatory Communications', 'FDA Meetings'],
    frequency: 'industry-specific',
    industries: ['pharma'],
  },

  // ── MISC ────────────────────────────────────────────────────────────────
  'MISC-SURVIVAL': {
    type: 'MISC',
    label: 'No Survival / Nonsurvival',
    description: 'Survival (or not) of representations post-closing',
    aliases: ['Nonsurvival', 'No Survival of Reps'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-NOTICES': {
    type: 'MISC',
    label: 'Notices',
    description: 'Notice addresses and mechanics',
    aliases: ['Notice Provisions', 'Notice Addresses'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-ENTIRE': {
    type: 'MISC',
    label: 'Entire Agreement',
    description: 'Integration / entire agreement clause',
    aliases: ['Integration Clause', 'Entire Agreement Clause'],
    frequency: 'near-universal',
    industries: [],
  },
  'MISC-GOVLAW': {
    type: 'MISC',
    label: 'Governing Law',
    description: 'Choice of governing law',
    aliases: ['Choice of Law', 'Applicable Law'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-JURISD': {
    type: 'MISC',
    label: 'Jurisdiction; Venue',
    description: 'Submission to jurisdiction and venue',
    aliases: ['Jurisdiction', 'Venue', 'Forum Selection'],
    frequency: 'common',
    industries: [],
  },
  'MISC-JURY': {
    type: 'MISC',
    label: 'Waiver of Jury Trial',
    description: 'Jury trial waiver',
    aliases: ['Jury Waiver', 'Waiver of Trial by Jury'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-ASSIGN': {
    type: 'MISC',
    label: 'Assignment; Successors',
    description: 'Assignment restrictions and successors',
    aliases: ['Assignment', 'Successors and Assigns'],
    frequency: 'near-universal',
    industries: [],
  },
  'MISC-SEVER': {
    type: 'MISC',
    label: 'Severability',
    description: 'Severability of invalid provisions',
    aliases: ['Severability Clause'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-COUNTER': {
    type: 'MISC',
    label: 'Counterparts',
    description: 'Execution in counterparts',
    aliases: ['Counterparts', 'Electronic Signatures'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-SPECIFIC': {
    type: 'MISC',
    label: 'Specific Performance; Enforcement',
    description: 'Right to specific performance',
    aliases: ['Specific Performance', 'Equitable Relief', 'Injunctive Relief'],
    frequency: 'universal',
    industries: [],
  },
  'MISC-THIRDPARTY': {
    type: 'MISC',
    label: 'Third-Party Beneficiaries',
    description: 'No third-party beneficiary rights (with exceptions)',
    aliases: ['No Third-Party Beneficiaries'],
    frequency: 'common',
    industries: [],
  },
  'MISC-AMEND': {
    type: 'MISC',
    label: 'Amendment; Modification',
    description: 'Process for amending the agreement',
    aliases: ['Amendment', 'Modification'],
    frequency: 'common',
    industries: [],
  },
  'MISC-WAIVER': {
    type: 'MISC',
    label: 'Waiver; Extension',
    description: 'Waiver mechanics',
    aliases: ['Waiver', 'Extension of Time'],
    frequency: 'common',
    industries: [],
  },
  'MISC-EXPENSES': {
    type: 'MISC',
    label: 'Expenses',
    description: 'General expense allocation (if separate from TERMF)',
    aliases: ['Fees and Expenses', 'Transaction Expenses'],
    frequency: 'common',
    industries: [],
  },
  'MISC-CONSTRUCT': {
    type: 'MISC',
    label: 'Rules of Construction; Interpretation',
    description: 'Interpretive provisions',
    aliases: ['Rules of Construction', 'Interpretation Clause'],
    frequency: 'common',
    industries: [],
  },

  // ── Stage 2: new sub-codes (COV/TERMF/REP-B/REP-T) ─────────────────────
  'COV-APPRAISAL': {
    type: 'COV',
    label: 'Appraisal / Dissenters Rights',
    description: 'Treatment of appraisal / dissenters rights, parent information rights, and settlement controls',
    aliases: ['Appraisal Rights', 'Dissenters Rights', 'Appraisal Proceedings'],
    frequency: 'near-universal',
    industries: [],
  },
  'COV-PAYAGENT': {
    type: 'COV',
    label: 'Paying Agent',
    description: 'Paying-agent / exchange-agent designation and company consent',
    aliases: ['Paying Agent', 'Exchange Agent', 'Disbursing Agent'],
    frequency: 'universal',
    industries: [],
  },
  'COV-MARKETING': {
    type: 'COV',
    label: 'Marketing Period',
    description: 'Marketing period for debt financing — length and commencement triggers',
    aliases: ['Marketing Period', 'Financing Marketing Period'],
    frequency: 'occasional',
    industries: [],
  },
  'COV-DO': {
    type: 'COV',
    label: 'D&O Indemnification and Insurance',
    description: 'Indemnification of directors and officers + run-off / tail insurance',
    aliases: ['D&O Indemnification', 'D&O Insurance', 'Indemnification of Directors and Officers'],
    frequency: 'universal',
    industries: [],
  },
  'TERMF-RTF-ANTI': {
    type: 'TERMF',
    label: 'Antitrust Reverse Termination Fee',
    description: 'Reverse termination fee payable on regulatory failure / no antitrust clearance',
    aliases: ['Antitrust RTF', 'Regulatory RTF', 'Antitrust Reverse Termination Fee'],
    frequency: 'occasional',
    industries: [],
  },
  'TERMF-REIMBURSE': {
    type: 'TERMF',
    label: 'Acquirer Expense Reimbursement',
    description: 'Expense reimbursement payable to buyer (or company) on enumerated termination triggers',
    aliases: ['Expense Reimbursement', 'Acquirer Expense Reimbursement'],
    frequency: 'common',
    industries: [],
  },
  'REP-B-ANTIRELIANCE': {
    type: 'REP-B',
    label: 'Anti-Reliance / Exclusivity of Representations',
    description: 'Buyer disclaims reliance on extra-contractual representations',
    aliases: ['Anti-Reliance', 'No Other Representations', 'Exclusivity of Representations'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-SUFFICIENCY': {
    type: 'REP-T',
    label: 'Sufficiency of Assets',
    description: 'Target represents that the transferred assets are sufficient to operate the business as currently conducted',
    aliases: ['Sufficiency of Assets', 'Sufficiency Rep'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-TOP-CUSTOMERS': {
    type: 'REP-T',
    label: 'Top Customers and Suppliers',
    description: 'Rep listing top customers / suppliers by aggregate spend, plus changes since look-back date',
    aliases: ['Top Customers', 'Top Suppliers', 'Major Customers'],
    frequency: 'common',
    industries: [],
  },
  'REP-T-MATERIAL-CONTRACTS': {
    type: 'REP-T',
    label: 'Material Contracts',
    description: 'Comprehensive material-contracts rep — buckets, dollar thresholds, and redactions',
    aliases: ['Material Contracts', 'Significant Contracts'],
    frequency: 'universal',
    industries: [],
  },
  // P5 item 5: REP preamble pseudo-provisions. The parser stamps these codes
  // on the General / Preamble paragraph that precedes the first numbered Rep
  // (where the SEC-filings carve-out, materiality scrape, knowledge-standard
  // definition, and disclosure-letter reference live).
  'REP-T-PREAMBLE': {
    type: 'REP-T',
    label: 'Reps Preamble (SEC-filings exception + scrape)',
    description: 'Section preamble that scopes the company reps with SEC-filings exception, materiality scrape, knowledge standard, and disclosure-letter reference',
    aliases: ['Reps Preamble', 'Article IV Preamble', 'Company Reps Preamble'],
    frequency: 'universal',
    industries: [],
  },
  'REP-B-PREAMBLE': {
    type: 'REP-B',
    label: 'Buyer Reps Preamble',
    description: 'Section preamble that scopes the buyer reps with SEC-filings exception, materiality scrape, knowledge standard, and disclosure-letter reference',
    aliases: ['Buyer Reps Preamble', 'Article V Preamble', 'Parent Reps Preamble'],
    frequency: 'universal',
    industries: [],
  },
};

// ---------------------------------------------------------------------------
// 3. FEATURES — extractable features keyed by provision type
// ---------------------------------------------------------------------------

const FEATURES = {
  IOC: [
    // ── Per-sub-clause features (apply to individual IOC restrictions) ─────
    {
      key: 'mainObligation',
      label: 'Main Obligation (one-sentence summary of what the sub-clause restricts or requires)',
      type: 'text',
      scope: 'clause',
    },
    {
      key: 'consentStandard',
      label: 'Consent Standard',
      type: 'enum',
      options: ['prior-written', 'not-unreasonably-withheld', 'sole-discretion'],
      scope: 'clause',
    },
    {
      key: 'dollarThreshold',
      label: 'Dollar Threshold',
      type: 'currency',
      scope: 'clause',
    },
    {
      key: 'permittedExceptions',
      label: 'Permitted Exceptions specific to THIS sub-clause — ONLY include text that genuinely begins with "except", "other than", "provided that", or "notwithstanding". Do NOT include every sub-clause. Do NOT include section-wide carve-outs (those live on the preamble).',
      type: 'list',
      scope: 'clause',
    },
    // ── Section-wide permitted exceptions (e.g. "Except as set forth in
    //    Section 5.01 of the Company Disclosure Letter, as required by Law,
    //    or with Parent's prior written consent..."). Lives ONLY on the
    //    preamble — sub-clauses have their own permittedExceptions above.
    {
      key: 'permittedExceptions',
      label: 'Section-Wide Permitted Exceptions (the standard "Except as ... or with ..." carve-outs that apply across the entire IOC section)',
      type: 'list',
      scope: 'preamble',
    },
    {
      key: 'crossReferences',
      label: 'Cross References (other sections/articles referenced)',
      type: 'list',
      scope: 'clause',
    },
    {
      key: 'effortsStandard',
      label: 'Efforts Standard',
      type: 'enum',
      options: ['commercially-reasonable', 'reasonable-best-efforts', 'best-efforts'],
      scope: 'clause',
    },
    // ── Section-wide (preamble-only) features ───────────────────────────────
    {
      key: 'scheduleReference',
      label: 'Schedule Reference (e.g. "Section 4.1 of the Company Disclosure Letter") — applies to the whole IOC section',
      type: 'text',
      scope: 'preamble',
    },
    {
      key: 'ordinaryCourseCarveout',
      label: 'Ordinary Course Carve-out (section-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'requiredByLawCarveout',
      label: 'Required by Law Carve-out (section-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'pandemicCarveout',
      label: 'Pandemic / COVID Carve-out (section-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'materialityQualifier',
      label: 'Materiality Qualifier (section-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    // ── Positive obligations expressed in the IOC preamble. Each "limb" is a
    //    discrete affirmative obligation (e.g. "Maintain business in material
    //    respects", "Use commercially reasonable efforts to preserve business
    //    organization", "Use commercially reasonable efforts to keep available
    //    services of officers", "Use commercially reasonable efforts to
    //    maintain relationships with customers, suppliers", "Not engage in
    //    actions that would prevent ordinary course").
    //
    //    Each limb is an object:
    //      { obligation, efforts_standard, scope }
    //      - obligation: verbatim or near-verbatim short phrase describing the
    //        affirmative duty
    //      - efforts_standard: one of EFFORTS_STANDARDS codes (or null when
    //        the duty is unqualified, e.g. "shall maintain ...")
    //      - scope: short free-text describing the scope, e.g. "ordinary
    //        course", "general", "key employees", "customer relationships"
    {
      key: 'positiveObligations',
      label: 'Positive Obligations (limbs) — discrete affirmative duties stated in the IOC preamble. Each limb is an object { obligation, efforts_standard, scope }.',
      type: 'list',
      scope: 'preamble',
    },
    {
      key: 'affirmativeLimbs',
      label: 'Affirmative Limbs — for the consolidated "Affirmative Covenants" provision: each limb of the preamble (ordinary course / preserve relationships / maintain assets) as a structured entry { obligation_code, obligation_label, text }.',
      type: 'list',
      scope: 'preamble',
    },
    // ── Stage 1: IOC additions ──
    // Per-category dollar thresholds: list of tagged items where each item carries
    // { code, label, text, threshold }. code is drawn from IOC_CATEGORY_CODES.
    {
      key: 'dollarThresholdsByCategory',
      label: 'Per-category dollar thresholds — list of tagged items { code, label, text, threshold } drawn from IOC_CATEGORY_CODES',
      type: 'list-tagged',
      scope: 'preamble',
    },
    { key: 'interimSettlementCap', label: 'Interim settlement cap (dollar)', type: 'currency', scope: 'preamble' },
    { key: 'interimSettlementNonPaymentExcluded', label: 'Settlement cap excludes non-payment relief', type: 'boolean', scope: 'preamble' },
    { key: 'interimNewContractsScope', label: 'Interim new-contracts restriction scope (text)', type: 'text', scope: 'preamble' },
    { key: 'salaryIncreaseExceptions', label: 'Salary-increase exceptions (text)', type: 'text', scope: 'preamble' },
    { key: 'bonusIncreaseExceptions', label: 'Bonus-increase exceptions (text)', type: 'text', scope: 'preamble' },
    { key: 'newHireExceptions', label: 'New-hire exceptions (text)', type: 'text', scope: 'preamble' },
    { key: 'retentionBonusRestrictions', label: 'Retention-bonus restrictions (text)', type: 'text', scope: 'preamble' },
    { key: 'benefitPlanRestrictions', label: 'Benefit-plan restrictions (text)', type: 'text', scope: 'preamble' },
    { key: 'equityAwardRestrictions', label: 'Equity-award restrictions (text)', type: 'text', scope: 'preamble' },
    { key: 'leadInAllowsActionAfterNoResponse', label: 'Lead-in allows action after Parent non-response', type: 'boolean', scope: 'preamble' },
    { key: 'leadInPeriodDays', label: 'Lead-in period (days)', type: 'duration', scope: 'preamble' },
    // ── Stage 6 — PW gap closure ──
    { key: 'parentBuyerIocBuckets', label: 'Parent / Buyer IOC buckets — categories list', type: 'list', scope: 'preamble' },
  ],

  'COND-M': [
    {
      key: 'mainCondition',
      label: 'Main Condition (one-sentence summary)',
      type: 'text',
    },
    {
      key: 'bringDownTiers',
      label: 'Bring-Down Tiers — array of { reps_covered, standard, standard_label, exceptions? } objects, one per tier. Use a single-element array if the bring-down is uniform.',
      type: 'tiers',
    },
    {
      key: 'certificationRequired',
      label: 'Officer Certification Required',
      type: 'boolean',
    },
    {
      key: 'dollarThreshold',
      label: 'Dollar Threshold',
      type: 'currency',
    },
    {
      key: 'scheduleReference',
      label: 'Schedule Reference',
      type: 'text',
    },
    // ── Stage 1: COND family additions ──
    { key: 'burdensomeConditionPresent', label: 'Burdensome Condition present', type: 'boolean' },
    { key: 'burdensomeConditionScope', label: 'Burdensome Condition scope', type: 'enum', options: ['PARENT_ONLY', 'MUTUAL', 'NA'] },
    { key: 'mutualClosingDeadlineAfterConditionsDays', label: 'Mutual closing deadline after conditions satisfied (days)', type: 'duration' },
    { key: 'closingTimingProvisions', label: 'Closing timing provisions (month-end kick-out, blackout, etc.)', type: 'text' },
    { key: 'governmentProceedingConditionPresent', label: 'Government proceeding closing condition present', type: 'boolean' },
    { key: 'absenceOfEnjoiningOrderPresent', label: 'Absence-of-enjoining-order condition present', type: 'boolean' },
    { key: 'absenceOfEnjoiningOrderDetails', label: 'Absence-of-enjoining-order — verbatim language', type: 'text' },
    { key: 'tenderOfferMinimumCondition', label: 'Tender-offer minimum condition (fully-diluted vs outstanding; guaranteed-delivery)', type: 'text' },
    // ── Stage 6 — PW gap closures ──
    { key: 'stockholderApprovalRequired', label: 'Stockholder approval is a closing condition', type: 'boolean' },
    { key: 'regulatoryApprovals', label: 'Required regulatory approvals (jurisdictions / agencies, free text)', type: 'text' },
    { key: 'hsrClearance', label: 'HSR clearance is a closing condition', type: 'boolean' },
  ],

  'COND-B': [
    {
      key: 'mainCondition',
      label: 'Main Condition (one-sentence summary)',
      type: 'text',
    },
    {
      key: 'bringDownTiers',
      label: 'Bring-Down Tiers — array of { reps_covered, standard, standard_label, exceptions? } objects, one per tier. Use a single-element array if the bring-down is uniform.',
      type: 'tiers',
    },
    {
      key: 'certificationRequired',
      label: 'Officer Certification Required',
      type: 'boolean',
    },
    {
      key: 'maeConditionStandalone',
      label: 'MAE as Standalone Condition (vs. embedded in rep bring-down)',
      type: 'boolean',
    },
    {
      key: 'dollarThreshold',
      label: 'Dollar Threshold',
      type: 'currency',
    },
    {
      key: 'dissentingSharesThreshold',
      label: 'Dissenting Shares Threshold',
      type: 'percentage',
    },
    {
      key: 'scheduleReference',
      label: 'Schedule Reference',
      type: 'text',
    },
    // ── Stage 1: COND family additions ──
    { key: 'burdensomeConditionPresent', label: 'Burdensome Condition present', type: 'boolean' },
    { key: 'burdensomeConditionScope', label: 'Burdensome Condition scope', type: 'enum', options: ['PARENT_ONLY', 'MUTUAL', 'NA'] },
    { key: 'mutualClosingDeadlineAfterConditionsDays', label: 'Mutual closing deadline after conditions satisfied (days)', type: 'duration' },
    { key: 'closingTimingProvisions', label: 'Closing timing provisions (month-end kick-out, blackout, etc.)', type: 'text' },
    { key: 'governmentProceedingConditionPresent', label: 'Government proceeding closing condition present', type: 'boolean' },
    { key: 'absenceOfEnjoiningOrderPresent', label: 'Absence-of-enjoining-order condition present', type: 'boolean' },
    { key: 'absenceOfEnjoiningOrderDetails', label: 'Absence-of-enjoining-order — verbatim language', type: 'text' },
    { key: 'tenderOfferMinimumCondition', label: 'Tender-offer minimum condition (fully-diluted vs outstanding; guaranteed-delivery)', type: 'text' },
    // ── Stage 6 — PW gap closures ──
    { key: 'stockholderApprovalRequired', label: 'Stockholder approval is a closing condition', type: 'boolean' },
    { key: 'regulatoryApprovals', label: 'Required regulatory approvals (jurisdictions / agencies, free text)', type: 'text' },
    { key: 'hsrClearance', label: 'HSR clearance is a closing condition', type: 'boolean' },
  ],

  'COND-S': [
    {
      key: 'mainCondition',
      label: 'Main Condition (one-sentence summary)',
      type: 'text',
    },
    {
      key: 'bringDownTiers',
      label: 'Bring-Down Tiers — array of { reps_covered, standard, standard_label, exceptions? } objects, one per tier. Use a single-element array if the bring-down is uniform.',
      type: 'tiers',
    },
    {
      key: 'certificationRequired',
      label: 'Officer Certification Required',
      type: 'boolean',
    },
    {
      key: 'fundsCondition',
      label: 'Funds Availability as Condition',
      type: 'boolean',
    },
    {
      key: 'dollarThreshold',
      label: 'Dollar Threshold',
      type: 'currency',
    },
    {
      key: 'scheduleReference',
      label: 'Schedule Reference',
      type: 'text',
    },
    // ── Stage 1: COND family additions ──
    { key: 'burdensomeConditionPresent', label: 'Burdensome Condition present', type: 'boolean' },
    { key: 'burdensomeConditionScope', label: 'Burdensome Condition scope', type: 'enum', options: ['PARENT_ONLY', 'MUTUAL', 'NA'] },
    { key: 'mutualClosingDeadlineAfterConditionsDays', label: 'Mutual closing deadline after conditions satisfied (days)', type: 'duration' },
    { key: 'closingTimingProvisions', label: 'Closing timing provisions (month-end kick-out, blackout, etc.)', type: 'text' },
    { key: 'governmentProceedingConditionPresent', label: 'Government proceeding closing condition present', type: 'boolean' },
    { key: 'absenceOfEnjoiningOrderPresent', label: 'Absence-of-enjoining-order condition present', type: 'boolean' },
    { key: 'absenceOfEnjoiningOrderDetails', label: 'Absence-of-enjoining-order — verbatim language', type: 'text' },
    { key: 'tenderOfferMinimumCondition', label: 'Tender-offer minimum condition (fully-diluted vs outstanding; guaranteed-delivery)', type: 'text' },
    // ── Stage 6 — PW gap closures ──
    { key: 'stockholderApprovalRequired', label: 'Stockholder approval is a closing condition', type: 'boolean' },
    { key: 'regulatoryApprovals', label: 'Required regulatory approvals (jurisdictions / agencies, free text)', type: 'text' },
    { key: 'hsrClearance', label: 'HSR clearance is a closing condition', type: 'boolean' },
  ],

  COND: [
    {
      key: 'mainCondition',
      label: 'Main Condition (one-sentence summary)',
      type: 'text',
    },
  ],

  NOSOL: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'noticePeriod',
      label: 'Notice Period (hours)',
      type: 'duration',
    },
    {
      key: 'matchingPeriod',
      label: 'Matching Period (business days)',
      type: 'duration',
    },
    {
      key: 'goShopWindow',
      label: 'Go-Shop Window (calendar days)',
      type: 'duration',
    },
    {
      key: 'informationRights',
      label: 'Information Rights (bidder access to data room)',
      type: 'boolean',
    },
    {
      key: 'subsequentMatching',
      label: 'Subsequent Matching on Amendments',
      type: 'boolean',
    },
    {
      key: 'subsequentMatchingPeriod',
      label: 'Subsequent Matching Period (business days)',
      type: 'duration',
    },
    {
      key: 'fiduciaryOutStandard',
      label: 'Fiduciary Out Standard',
      type: 'enum',
      options: ['reasonably-likely-to-lead-to-superior', 'could-reasonably-be-expected-to-lead-to-superior', 'constitutes-or-could-lead-to-superior'],
    },
    // Two-step fiduciary out — different standards typically apply at the
    // "engagement" stage (when the company can start talking to a bidder) vs.
    // the "final determination" stage (when the board changes recommendation
    // or terminates to accept the proposal).
    {
      key: 'fiduciaryEngageStandard',
      label: 'Fiduciary Out — Engagement Standard (verbatim phrasing, e.g. "could reasonably be expected to lead to a Superior Proposal")',
      type: 'text',
    },
    {
      key: 'fiduciaryFinalStandard',
      label: 'Fiduciary Out — Final Determination Standard (verbatim phrasing, e.g. "constitutes a Superior Proposal")',
      type: 'text',
    },
    // Notice obligation — what triggers it and what must be conveyed
    {
      key: 'noticeContent',
      label: 'Notice Content to Existing Buyer (identity, material terms, copies, etc.)',
      type: 'text',
    },
    // Force-the-vote: company must hold the stockholder meeting even after
    // an adverse recommendation change. Important deal-protection mechanism.
    {
      key: 'forceTheVote',
      label: 'Force the Vote (target must hold stockholder meeting even after recommendation change)',
      type: 'boolean',
    },
    {
      key: 'forceTheVoteDetails',
      label: 'Force the Vote — verbatim language and any exceptions',
      type: 'text',
    },
    {
      key: 'interveningEventTermination',
      label: 'Intervening Event — does termination right exist for Intervening Event (vs. just recommendation change)? Capture standard + carve-outs.',
      type: 'text',
    },
    {
      key: 'interveningEventProvision',
      label: 'Intervening Event Provision Exists',
      type: 'boolean',
    },
    {
      key: 'standstillWaiver',
      label: 'Standstill Waiver Permitted',
      type: 'boolean',
    },
    {
      key: 'dontAskDontWaive',
      label: 'Don\'t-Ask-Don\'t-Waive Provision',
      type: 'boolean',
    },
    {
      key: 'confidentialityRequired',
      label: 'Confidentiality Agreement Required for Information Access',
      type: 'boolean',
    },
    {
      key: 'superiorProposalPercentage',
      label: 'Superior Proposal Percentage Threshold',
      type: 'percentage',
    },
    {
      key: 'fiduciaryCarveoutThreshold',
      label: 'Fiduciary Carve-Out Threshold (the standard the board must meet to engage)',
      type: 'text',
    },
    // ── Stage 1: NOSOL additions ──
    { key: 'goShopPresent', label: 'Go-shop present', type: 'boolean' },
    { key: 'goShopPeriodDays', label: 'Go-shop period (days)', type: 'duration' },
    { key: 'goShopExcludedParties', label: 'Go-shop excluded parties (list of bidder names)', type: 'list' },
    { key: 'extendedNegotiatingPeriodDays', label: 'Extended go-shop negotiating window (days)', type: 'duration' },
    { key: 'standstillWaiverPermitted', label: 'Standstill waiver permitted', type: 'boolean' },
    { key: 'standstillWaiverConditions', label: 'Standstill waiver — conditions text', type: 'text' },
    { key: 'antiClubbingWaiverPermitted', label: 'Anti-clubbing waiver permitted', type: 'boolean' },
    { key: 'antiClubbingWaiverConditions', label: 'Anti-clubbing waiver — conditions text', type: 'text' },
    { key: 'infoRequiredBidderIdentity', label: 'Notice must disclose bidder identity', type: 'boolean' },
    { key: 'infoRequiredCommunicationsDrafts', label: 'Notice must share communications / drafts', type: 'boolean' },
    { key: 'infoRequiredFinancingPapers', label: 'Notice must share financing papers', type: 'boolean' },
    { key: 'boardChangeForInterveningEvent', label: 'Board may change recommendation for intervening event', type: 'boolean' },
    { key: 'interveningEventDefinition', label: 'Intervening Event definition (text)', type: 'text' },
    { key: 'boardChangeForSuperiorProposal', label: 'Board may change recommendation for superior proposal', type: 'boolean' },
    { key: 'boardChangeStandard', label: 'Board change standard', type: 'enum', options: ['INCONSISTENT_FIDUCIARY', 'BREACH_FIDUCIARY', 'REASONABLY_LIKELY_BREACH'] },
    { key: 'companyTerminationForSuperior', label: 'Company may terminate for superior proposal', type: 'boolean' },
    { key: 'companyTerminationForSuperiorConditions', label: 'Company-terminate-for-superior — conditions text', type: 'text' },
    { key: 'representativeBreachIsCompanyBreach', label: 'Representative breach is treated as company breach', type: 'boolean' },
    { key: 'representativeBreachConditions', label: 'Representative-breach — conditions text', type: 'text' },
    { key: 'representativesStandard', label: 'Representatives standard', type: 'enum', options: ['CAUSE_NOT_TO', 'RBE_NOT_TO', 'INSTRUCT_NOT_TO', 'NA'] },
    { key: 'initialMatchPeriodDays', label: 'Initial match period (business days)', type: 'duration' },
    { key: 'subsequentMatchPeriodDays', label: 'Subsequent match period (business days)', type: 'duration' },
    { key: 'parentTerminationRightForNonsolicitBreach', label: 'Parent termination right for nonsolicit breach', type: 'enum', options: ['ALL_BREACHES', 'MATERIAL_WILLFUL_ONLY', 'WILLFUL_ONLY', 'NONE'] },
    { key: 'acquisitionTransactionPctThreshold', label: 'Acquisition Proposal % threshold', type: 'percentage' },
    { key: 'acquisitionTransactionDefinition', label: 'Acquisition Proposal definition (text)', type: 'text' },
    // ── Stage 6 — PW gap closure ──
    { key: 'acceptableConfidentialityAgreementDefinition', label: 'Acceptable Confidentiality Agreement — definition (text)', type: 'text' },
    // ── P3 NOSOL additions: 4 mini-table fields ──
    // Cease-discussions section
    { key: 'ceaseDiscussionsProhibitedList', label: 'Prohibited acts during cease-discussions period (list)', type: 'list' },
    { key: 'ceaseDiscussionsAffiliateStandard', label: 'Standard for affiliates / representatives (text — e.g. "shall cause", "shall instruct")', type: 'text' },
    { key: 'ceaseDiscussionsLiability', label: 'Liability for representative breach (text)', type: 'text' },
    { key: 'ceaseDiscussionsExceptions', label: 'Cease-discussions exceptions (list)', type: 'list' },
    // Change-of-recommendation framework
    { key: 'changeOfRecommendationItems', label: 'What constitutes a Change of Recommendation (list)', type: 'list' },
    { key: 'notChangeOfRecommendationItems', label: 'What does NOT constitute a Change of Recommendation (list)', type: 'list' },
    { key: 'engagementStandard', label: 'Engagement standard verbatim text (e.g. "could reasonably be expected to lead to a Superior Proposal")', type: 'text' },
    { key: 'changeRecStandard', label: 'Change-of-recommendation standard verbatim text (e.g. "inconsistent with directors\' fiduciary duties")', type: 'text' },
    { key: 'materialImprovementStandard', label: 'Material-improvement standard for re-triggering match (text)', type: 'text' },
    // Key definitions
    { key: 'interveningEventScope', label: 'Intervening Event scope', type: 'enum', options: ['POSITIVE_ONLY', 'BOTH', 'NA'] },
    { key: 'superiorProposalThresholdPct', label: 'Superior Proposal % threshold', type: 'percentage' },
    { key: 'superiorProposalTest', label: 'Superior Proposal test (verbatim factors)', type: 'text' },
    { key: 'superiorProposalDeterminer', label: 'Superior Proposal determiner (Board only / Board with advisors)', type: 'text' },
  ],

  // ── ANTI — generic fallback schema (used when a sub-clause hasn't been mapped
  //    to a more specific ANTI-* code). Canonical order: Provision first, then
  //    the efforts standard (the single most important field), then the burden
  //    cap / divestiture limit fields, then the No-Inconsistent-Action party
  //    binding, then everything else (filing, cooperation/control, etc.).
  //    Code-specific overrides for ANTI-NOACTION, ANTI-FILING, ANTI-EFFORTS,
  //    ANTI-BURDEN, and ANTI-COOPERATE live below.
  ANTI: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'effortsStandard',
      label: 'Standard of Efforts',
      type: 'enum',
      options: ['best-efforts', 'reasonable-best-efforts', 'commercially-reasonable-efforts', 'reasonable-efforts'],
    },
    {
      key: 'hellOrHighWater',
      label: 'Hell-or-High-Water (no divestiture cap)',
      type: 'boolean',
    },
    {
      key: 'divestitureCap',
      label: 'Divestiture Cap (dollar or revenue threshold)',
      type: 'currency',
    },
    {
      key: 'divestitureCapDescription',
      label: 'Divestiture Cap Description',
      type: 'text',
    },
    {
      key: 'burdenCap',
      label: 'Burdensome Condition / Burden Cap (qualitative limit on required remedies)',
      type: 'text',
    },
    {
      key: 'appliesToParty',
      label: 'No-Inconsistent-Action — Party Bound',
      type: 'tagged',
      description: 'PARTY_PARENT / PARTY_COMPANY / PARTY_MUTUAL',
    },
    {
      key: 'controllingParty',
      label: 'Who Controls Antitrust Strategy',
      type: 'tagged',
      description: 'CONTROL_PARENT / CONTROL_COMPANY / CONTROL_SHARED / CONTROL_SILENT',
    },
    {
      key: 'litigationObligation',
      label: 'Obligation to Litigate Against Regulators',
      type: 'enum',
      options: ['required', 'permitted-not-required', 'prohibited', 'silent'],
    },
    {
      key: 'filingDeadline',
      label: 'Regulatory Filing Deadline (e.g., "Within 15 business days of signing")',
      type: 'text',
    },
    {
      key: 'foreignFilingsRequired',
      label: 'Foreign Regulatory Filings Required',
      type: 'list',
    },
    {
      key: 'interimOperatingRestrictions',
      label: 'Interim Operating Restrictions During Review',
      type: 'boolean',
    },
    {
      key: 'pullAndRefileRight',
      label: 'Pull-and-Refile Right',
      type: 'boolean',
    },
    {
      key: 'burdensomConditionDefined',
      label: 'Burdensome Condition Defined',
      type: 'boolean',
    },
    {
      key: 'partyControlsStrategy',
      label: 'Party That Controls Regulatory Strategy (legacy alias for controllingParty)',
      type: 'enum',
      options: ['buyer', 'target', 'mutual', 'silent'],
    },
    // ── Stage 1: regulatory strategy control + filing deadlines ──
    { key: 'regulatoryStrategyControl', label: 'Regulatory strategy control', type: 'enum', options: ['PARENT_CONTROL', 'COMPANY_CONTROL', 'JOINT', 'NA'] },
    { key: 'hsrFilingDeadlineBusinessDays', label: 'HSR filing deadline (business days from signing)', type: 'duration' },
    { key: 'otherRegulatoryFilingDeadlines', label: 'Other regulatory filing deadlines (free text — non-HSR jurisdictions, CFIUS, etc.)', type: 'text' },
    { key: 'substantialComplianceDeadlineDays', label: 'Substantial compliance deadline (days)', type: 'duration' },
    { key: 'pullAndRefileCompanyConsent', label: 'Pull-and-refile requires Company consent', type: 'boolean' },
    { key: 'refileCapWithoutConsent', label: 'Refile cap without Company consent (max number)', type: 'duration' },
    { key: 'timingAgreementsProhibited', label: 'Timing agreements with regulators prohibited', type: 'boolean' },
    { key: 'clearSkiesCompany', label: 'Clear-skies covenant on the Company side', type: 'boolean' },
    { key: 'clearSkiesCompanyScope', label: 'Clear-skies (Company) — scope/limits text', type: 'text' },
    { key: 'clearSkiesParent', label: 'Clear-skies covenant on the Parent side', type: 'boolean' },
    { key: 'clearSkiesParentScope', label: 'Clear-skies (Parent) — scope/limits text', type: 'text' },
    { key: 'parentRemedyObligation', label: 'Parent remedy obligation (DIVEST / CONDUCT / LITIGATE / MULTIPLE / NONE)', type: 'tagged' },
    { key: 'effortsStandardDiffersByRemedy', label: 'Efforts standard differs depending on remedy type', type: 'boolean' },
    { key: 'parentLitigationObligation', label: 'Parent has obligation to litigate against regulators', type: 'boolean' },
    // ── Stage 6 — PW gap closures ──
    { key: 'burdensomeConditionInTerminationTriggers', label: 'Burdensome-condition concept as a termination trigger (free text describing what it is)', type: 'text' },
    { key: 'regulatoryClosingConditions', label: 'Regulatory closing conditions / required filings (HSR, UK CMA, EC, FDI, etc.)', type: 'text' },
    { key: 'springingRegulatoryConditions', label: 'Springing regulatory conditions (e.g. UK/EC only if a filing is made)', type: 'text' },
    { key: 'regulatoryCooperationScope', label: 'Regulatory information / cooperation covenant — scope', type: 'text' },
    { key: 'regulatoryCooperationCarveout', label: 'Regulatory cooperation covenant carveout from closing conditionality', type: 'text' },
  ],

  // ── ANTI-EFFORTS — Standard of efforts (efforts clause)
  //    Just the canonical short label + verbatim phrase. Lawyers compare
  //    these across deals as one of "Best efforts" / "Reasonable best
  //    efforts" / "Commercially reasonable efforts" / etc.
  'ANTI-EFFORTS': [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'effortsStandard',
      label: 'Standard of Efforts (canonical short label only)',
      type: 'text',
    },
  ],

  // ── ANTI-FILING — Regulatory filing deadline
  //    Focus on the DEADLINE for making HSR/regulatory filings — that is
  //    the negotiated, comparable point. Other generic ANTI features are
  //    intentionally dropped from this code's schema.
  'ANTI-FILING': [
    {
      key: 'mainConcept',
      label: 'Provision (short deadline statement, e.g. "HSR filing within 15 business days of signing")',
      type: 'text',
    },
    {
      key: 'filingDeadline',
      label: 'Regulatory Filing Deadline (short text, e.g. "Within 15 business days of signing" or "Within 30 days")',
      type: 'text',
    },
  ],

  // ── ANTI-BURDEN — Burden cap / divestiture limits / hell-or-high-water
  'ANTI-BURDEN': [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'effortsStandard',
      label: 'Standard of Efforts',
      type: 'text',
    },
    {
      key: 'hellOrHighWater',
      label: 'Hell-or-High-Water (no divestiture cap)',
      type: 'boolean',
    },
    {
      key: 'divestitureCap',
      label: 'Divestiture Cap (dollar or revenue threshold)',
      type: 'currency',
    },
    {
      key: 'divestitureCapDescription',
      label: 'Divestiture Cap Description',
      type: 'text',
    },
    {
      key: 'burdenCap',
      label: 'Burdensome Condition / Burden Cap (qualitative limit on required remedies)',
      type: 'text',
    },
    {
      key: 'burdensomConditionDefined',
      label: 'Burdensome Condition Defined',
      type: 'boolean',
    },
  ],

  // ── ANTI-NOACTION — No Inconsistent Action
  //    The critical negotiated point is WHICH PARTY is bound: buyer-only,
  //    target-only, or both (mutual). Captured as a tagged value drawn
  //    from APPLIES_TO_PARTY.
  'ANTI-NOACTION': [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'appliesToParty',
      label: 'Which party the No-Inconsistent-Action prohibition applies to',
      type: 'text',
    },
  ],

  // ── ANTI-COOPERATE — Cooperation / Control
  //    The cooperation paragraph in modern merger agreements is also where
  //    the parties allocate CONTROL of antitrust strategy. "controllingParty"
  //    captures whether Parent/Buyer controls, Company/Target controls, the
  //    parties share control, or the agreement is silent — and "silent" is
  //    itself a meaningful data point for cross-deal comparison.
  'ANTI-COOPERATE': [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'controllingParty',
      label: 'Who Controls Antitrust Strategy',
      type: 'tagged',
      description: 'CONTROL_PARENT / CONTROL_COMPANY / CONTROL_SHARED / CONTROL_SILENT',
    },
  ],

  // ── TERMF — generic fallback schema (used when a sub-clause hasn't been
  //    mapped to a more specific TERMF-* code). The full structured breakdown
  //    of company / reverse / expense / tail / sole-remedy lives on this
  //    fallback as object features so even an un-classified TERMF section
  //    carries the breakdown.
  TERMF: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'companyTerminationFee',
      label: 'Company Termination Fee — object { amount, percentage_of_equity, triggers[], payment_deadline }',
      type: 'object',
    },
    {
      key: 'reverseTerminationFee',
      label: 'Reverse Termination Fee — object { amount, percentage_of_equity, triggers[], payment_deadline }',
      type: 'object',
    },
    {
      key: 'expenseReimbursement',
      label: 'Expense Reimbursement — object { amount_cap, triggers[] }',
      type: 'object',
    },
    {
      key: 'tailProvision',
      label: 'Tail Provision — object { period_months, threshold_percentage, triggers[] }',
      type: 'object',
    },
    {
      key: 'effectOfTermination',
      label: 'Effect of Termination (short description of post-termination consequences)',
      type: 'text',
    },
    {
      key: 'soleAndExclusiveRemedy',
      label: 'Fee is Sole and Exclusive Remedy',
      type: 'boolean',
    },
    {
      key: 'interestOnLatePayment',
      label: 'Interest on Late Payment — object { rate, base }',
      type: 'object',
    },
    // ── Legacy flat fields (kept so older UI / data continues to render).
    {
      key: 'triggerEvents',
      label: 'Trigger Events (events that cause the fee to be payable)',
      type: 'list',
    },
    {
      key: 'feeAmount',
      label: 'Fee Amount (dollars)',
      type: 'currency',
    },
    {
      key: 'feePercentage',
      label: 'Fee as Percentage of Deal Value',
      type: 'percentage',
    },
    {
      key: 'reverseFeeAmount',
      label: 'Reverse Fee Amount (dollars)',
      type: 'currency',
    },
    {
      key: 'reverseFeePercentage',
      label: 'Reverse Fee as Percentage of Deal Value',
      type: 'percentage',
    },
    {
      key: 'tailPeriod',
      label: 'Tail Period (months)',
      type: 'duration',
    },
    {
      key: 'soleRemedy',
      label: 'Fee is Sole and Exclusive Remedy (legacy alias for soleAndExclusiveRemedy)',
      type: 'boolean',
    },
    {
      key: 'willfulBreachException',
      label: 'Willful Breach Carve-out to Sole Remedy',
      type: 'boolean',
    },
    {
      key: 'expenseReimbursementCap',
      label: 'Expense Reimbursement Cap (legacy flat field)',
      type: 'currency',
    },
    {
      key: 'nakedNoVoteFee',
      label: 'Naked No-Vote Fee (reduced fee if no competing proposal)',
      type: 'boolean',
    },
    // ── Stage 1: TERMF additions ──
    { key: 'terminationFeePercentEquityValue', label: 'Termination fee as % of equity value', type: 'percentage' },
    { key: 'tailFeeTriggerEndDate', label: 'Tail fee trigger: termination at end date', type: 'boolean' },
    { key: 'tailFeeTriggerNakedNoVote', label: 'Tail fee trigger: naked no-vote', type: 'boolean' },
    { key: 'tailFeeTriggerAltAnnouncedDuringPendency', label: 'Tail fee trigger: alternative announced during pendency', type: 'boolean' },
    { key: 'tailFeeTriggerConsummatedDuringTail', label: 'Tail fee trigger: alt consummated during tail', type: 'boolean' },
    { key: 'nakedNoVoteFeePresent', label: 'Naked no-vote fee present (standalone)', type: 'boolean' },
    { key: 'nakedNoVoteFeeAmount', label: 'Naked no-vote fee amount', type: 'currency' },
    { key: 'feeSoleAndExclusiveRemedy', label: 'Fee is sole and exclusive remedy', type: 'boolean' },
    { key: 'feeSoleRemedyExceptions', label: 'Sole-remedy exceptions (list)', type: 'list' },
    { key: 'remedyBarAfterFee', label: 'Remedy bar after fee paid (text)', type: 'text' },
    // ── P3 TERMF additions: tail-fee mechanics + trigger matrix ──
    { key: 'tailFeeWindowMonths', label: 'Tail fee window (months)', type: 'duration' },
    { key: 'tailFeeThresholdPct', label: 'Tail-fee Company Takeover Proposal % threshold (may differ from base Acquisition Proposal threshold)', type: 'percentage' },
    { key: 'tailFeeSameProposalRequired', label: 'Tail fee — must consummated deal be with same third party that triggered the tail?', type: 'boolean' },
    { key: 'tailFeeRecognitionEvent', label: 'Tail-fee recognition event (text — "consummation" vs "definitive agreement later consummated")', type: 'text' },
    { key: 'tailFeeActivatingClauses', label: 'Tail-fee activating termination clauses (list of section references)', type: 'list' },
    { key: 'triggers', label: 'Per-trigger array — list of { name, terminationClauses, feeAmount, feeAmountPct }', type: 'list' },
  ],

  // ── TERMF-TARGET — Company Termination Fee (per-code schema)
  'TERMF-TARGET': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'companyTerminationFee',
      label: 'Company Termination Fee — object { amount, percentage_of_equity, triggers[], payment_deadline }',
      type: 'object',
    },
    { key: 'interestOnLatePayment', label: 'Interest on Late Payment — object { rate, base }', type: 'object' },
    { key: 'nakedNoVoteFee', label: 'Naked No-Vote Fee (reduced fee if no competing proposal)', type: 'boolean' },
  ],

  // ── TERMF-REVERSE — Reverse Termination Fee
  'TERMF-REVERSE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'reverseTerminationFee',
      label: 'Reverse Termination Fee — object { amount, percentage_of_equity, triggers[], payment_deadline }',
      type: 'object',
    },
    { key: 'interestOnLatePayment', label: 'Interest on Late Payment — object { rate, base }', type: 'object' },
  ],

  // ── TERMF-EXPENSE — Expense reimbursement
  'TERMF-EXPENSE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'expenseReimbursement',
      label: 'Expense Reimbursement — object { amount_cap, triggers[] }',
      type: 'object',
    },
  ],

  // ── TERMF-TAIL — Tail provision
  'TERMF-TAIL': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'tailProvision',
      label: 'Tail Provision — object { period_months, threshold_percentage, triggers[] }',
      type: 'object',
    },
  ],

  // ── TERMF-EFFECT — Effect of termination
  'TERMF-EFFECT': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'effectOfTermination', label: 'Effect of Termination (short description of post-termination consequences)', type: 'text' },
    { key: 'willfulBreachException', label: 'Willful Breach Carve-out', type: 'boolean' },
  ],

  // ── TERMF-SOLE — Sole and exclusive remedy
  'TERMF-SOLE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'soleAndExclusiveRemedy', label: 'Fee is Sole and Exclusive Remedy', type: 'boolean' },
    { key: 'willfulBreachException', label: 'Willful Breach Carve-out to Sole Remedy', type: 'boolean' },
  ],

  // ── TERMR — generic fallback schema (kept for back-compat where a sub-clause
  //    can't be confidently mapped to a specific TERMR-* code). For code-specific
  //    extraction, see TERMR-MUTUAL / TERMR-OUTSIDE / ... below.
  TERMR: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate',
      type: 'enum',
      options: ['buyer', 'target', 'either', 'mutual'],
    },
    {
      key: 'terminationTriggers',
      label: 'Termination Triggers — the LIST of conditions that allow termination. Do NOT include exceptions / carve-outs to termination.',
      type: 'list',
    },
    {
      key: 'faultBasedExclusion',
      label: 'Fault-Based Exclusion (party at fault cannot invoke)',
      type: 'boolean',
    },
    // ── Stage 1: TERMR generic-level additions ──
    { key: 'extensionParty', label: 'Extension party (PARENT / COMPANY / MUTUAL / NA)', type: 'enum', options: ['PARENT', 'COMPANY', 'MUTUAL', 'NA'] },
    { key: 'extensionMutualOrUnilateral', label: 'Extension mode', type: 'enum', options: ['MUTUAL', 'UNILATERAL_PARENT', 'UNILATERAL_COMPANY', 'NA'] },
    { key: 'extensionMaxExercises', label: 'Maximum extensions permitted', type: 'duration' },
    { key: 'lawOrderTerminationPresent', label: 'Law/Order termination right present', type: 'boolean' },
    { key: 'lawOrderTerminationScope', label: 'Law/Order termination — scope text', type: 'text' },
    { key: 'finalAndNonappealableRequired', label: 'Law/Order termination requires final & non-appealable', type: 'boolean' },
    { key: 'terminationCarveoutForOwnBreach', label: 'Termination carveout for own breach (text)', type: 'text' },
    { key: 'lostPremiumDamagesPursuit', label: 'Right to pursue lost-premium damages', type: 'boolean' },
    { key: 'lostPremiumDamagesConditions', label: 'Lost-premium damages — conditions text', type: 'text' },
    { key: 'marketOutHolder', label: 'Market-out / walkaway holder (TARGET / ACQUIRER / BOTH / NA)', type: 'enum', options: ['TARGET', 'ACQUIRER', 'BOTH', 'NA'] },
    // ── Stage 6 — PW gap closure ──
    { key: 'closingTimingProvisions', label: 'Closing timing provisions visible at the termination page (month-end kick-out, blackout, etc.)', type: 'text' },
  ],

  // ── TERMR-MUTUAL — Mutual consent termination ───────────────────────────
  //   Only the truly relevant fields. partyWhoCanTerminate is always "mutual"
  //   for this code; the AI is instructed to populate it as such.
  'TERMR-MUTUAL': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate (always "mutual" for this code)',
      type: 'tagged',
    },
    { key: 'executionMethod', label: 'Execution Method (e.g. "written consent")', type: 'text' },
    { key: 'writtenConsentRequired', label: 'Written Consent Required (vs. oral)', type: 'boolean' },
  ],

  // ── TERMR-OUTSIDE — Outside / drop-dead-date termination ────────────────
  //   This is the ONLY TERMR code that carries outsideDate / outsideDateExtension
  //   fields. Per fix #3, those keys MUST NOT appear on any other TERMR-* code.
  'TERMR-OUTSIDE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate',
      type: 'tagged',
    },
    { key: 'outsideDate', label: 'Outside Date (calendar date)', type: 'text' },
    { key: 'outsideDateMonths', label: 'Outside Date (months after signing)', type: 'duration' },
    { key: 'outsideDateExtension', label: 'Outside Date Extension Available', type: 'boolean' },
    { key: 'extensionConditions', label: 'Outside Date Extension Conditions / Triggers', type: 'text' },
    // Legacy alias kept so older data still renders.
    { key: 'outsideDateExtensionConditions', label: 'Outside Date Extension Conditions (legacy alias)', type: 'text' },
    { key: 'faultBasedExclusion', label: 'Fault-Based Exclusion (party at fault cannot invoke)', type: 'boolean' },
  ],

  // ── TERMR-EXTENSION — Standalone outside-date extension provision ───────
  //   Most agreements DON'T have this as a separate clause; when they do it
  //   carries the same extension data but lives in its own provision.
  'TERMR-EXTENSION': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Invoke Extension',
      type: 'tagged',
    },
    { key: 'outsideDateExtension', label: 'Outside Date Extension Available', type: 'boolean' },
    { key: 'extensionConditions', label: 'Extension Conditions / Triggers', type: 'text' },
    { key: 'extensionPeriod', label: 'Extension Period (months)', type: 'duration' },
    { key: 'tickingFee', label: 'Ticking Fee Applies During Extension', type: 'boolean' },
  ],

  // ── TERMR-LEGAL — Legal-restraint / injunction termination ──────────────
  'TERMR-LEGAL': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate',
      type: 'tagged',
    },
    { key: 'restraintFinality', label: 'Finality Standard (final / non-appealable)', type: 'enum', options: ['final-and-nonappealable', 'final', 'permanent', 'any'] },
    { key: 'faultBasedExclusion', label: 'Fault-Based Exclusion (party causing the restraint cannot invoke)', type: 'boolean' },
  ],

  // ── TERMR-VOTE — Stockholder vote failure ───────────────────────────────
  'TERMR-VOTE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate',
      type: 'tagged',
    },
    { key: 'voteThreshold', label: 'Required Stockholder Vote Threshold (e.g. majority of outstanding)', type: 'text' },
    { key: 'faultBasedExclusion', label: 'Fault-Based Exclusion', type: 'boolean' },
  ],

  // ── TERMR-BREACH-T — Buyer's right to terminate for target breach ───────
  //   Party is always "buyer" for this code.
  'TERMR-BREACH-T': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate (always "buyer" for this code)',
      type: 'tagged',
    },
    { key: 'cureDays', label: 'Breach Cure Period (business days)', type: 'duration' },
    { key: 'materialityStandard', label: 'Breach Materiality Standard (e.g. would cause closing condition to fail)', type: 'text' },
    { key: 'faultBasedExclusion', label: 'Fault-Based Exclusion (terminating buyer must not itself be in breach)', type: 'boolean' },
  ],

  // ── TERMR-BREACH-B — Target's right to terminate for buyer breach ───────
  //   Party is always "target" for this code.
  'TERMR-BREACH-B': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate (always "target" for this code)',
      type: 'tagged',
    },
    { key: 'cureDays', label: 'Breach Cure Period (business days)', type: 'duration' },
    { key: 'materialityStandard', label: 'Breach Materiality Standard (e.g. would cause closing condition to fail)', type: 'text' },
    { key: 'faultBasedExclusion', label: 'Fault-Based Exclusion (terminating target must not itself be in breach)', type: 'boolean' },
  ],

  // ── TERMR-SUPERIOR — Target terminates to accept superior proposal ──────
  //   Party is always "target" for this code.
  'TERMR-SUPERIOR': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate (always "target" for this code)',
      type: 'tagged',
    },
    { key: 'feeRequired', label: 'Termination Fee Required Simultaneously with Termination', type: 'boolean' },
    { key: 'executionConditions', label: 'Execution Conditions (e.g. compliance with no-solicit, board determination, definitive agreement signed)', type: 'text' },
  ],

  // ── TERMR-RECOMMEND — Buyer terminates upon adverse recommendation change ─
  //   Party is always "buyer" for this code.
  'TERMR-RECOMMEND': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'partyWhoCanTerminate',
      label: 'Party Who Can Terminate (always "buyer" for this code)',
      type: 'tagged',
    },
    { key: 'triggerEvents', label: 'What Constitutes a Triggering Recommendation Change (e.g. withdrawal, modification, failure to reaffirm)', type: 'list' },
    { key: 'preVoteOnlyWindow', label: 'Right Available Only Prior to Stockholder Vote', type: 'boolean' },
  ],

  DEF: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'canonicalTerm',
      label: 'Canonical Term (the quoted defined term as it appears in the agreement)',
      type: 'text',
    },
    {
      key: 'definitionText',
      label: 'Definition Text (the core definition body, excluding carve-outs)',
      type: 'text',
    },
    {
      key: 'crossReferences',
      label: 'Cross References (other defined terms or sections referenced)',
      type: 'list',
    },
    {
      key: 'carveOuts',
      label: 'Carve-Outs (for MAE — enumerated exceptions)',
      type: 'list',
    },
    {
      key: 'carveOutsList',
      label: 'MAE Carve-Outs List (deprecated alias for carveOuts)',
      type: 'list',
    },
    {
      key: 'disproportionateImpactClause',
      label: 'Disproportionate Impact Clause (text of the disproportionate-impact qualifier)',
      type: 'text',
    },
    {
      key: 'disproportionateImpact',
      label: 'Disproportionate Impact Qualifier',
      type: 'boolean',
    },
    {
      key: 'disproportionateImpactScope',
      label: 'Disproportionate Impact Scope (which carve-outs)',
      type: 'list',
    },
    {
      key: 'knowledgeStandard',
      label: 'Knowledge Standard',
      type: 'enum',
      options: ['actual-knowledge', 'constructive-knowledge', 'after-reasonable-inquiry', 'actual-knowledge-after-due-inquiry'],
    },
    {
      key: 'knowledgePersons',
      label: 'Knowledge Persons (named individuals or by title)',
      type: 'list',
    },
    {
      key: 'ordinaryCourseQualifier',
      label: 'Ordinary Course Qualifier',
      type: 'enum',
      options: ['ordinary-course-only', 'ordinary-course-consistent-with-past-practice', 'ordinary-course-consistent-in-all-material-respects'],
    },
    {
      key: 'willfulBreachDefinition',
      label: 'Willful Breach Defined',
      type: 'boolean',
    },
    {
      key: 'superiorProposalPercentage',
      label: 'Superior Proposal Percentage Threshold',
      type: 'percentage',
    },
    {
      key: 'acquisitionProposalPercentage',
      label: 'Acquisition Proposal Percentage Threshold',
      type: 'percentage',
    },
    {
      key: 'pandemicCarveout',
      label: 'Pandemic / COVID MAE Carve-Out',
      type: 'boolean',
    },
    {
      key: 'cyberSecurityCarveout',
      label: 'Cybersecurity Incident MAE Carve-Out',
      type: 'boolean',
    },
    // ── Stage 1: MAE carveouts as a structured taxonomy-backed list ─────
    // Each tagged item carries { code, label, text, hasDisproportionateImpactCarveback? }
    // where code is drawn from MAE_CARVEOUT_CODES.
    {
      key: 'carveouts',
      label: 'MAE Carve-Outs (canonical list — each item drawn from MAE_CARVEOUT_CODES; tag with hasDisproportionateImpactCarveback when the disproportionate-impact carveback applies to that specific carveout)',
      type: 'list-tagged',
    },
    {
      key: 'disproportionateImpactCarveouts',
      label: 'Carve-Outs subject to disproportionate-impact carveback',
      type: 'list-tagged',
    },
    {
      key: 'nonDisproportionateImpactCarveouts',
      label: 'Carve-Outs NOT subject to disproportionate-impact carveback',
      type: 'list-tagged',
    },
    // ── MAE prevent-or-delay prong ─────────────────────────────────────
    {
      key: 'preventDelayProng',
      label: 'MAE includes a prevent-or-delay-closing prong',
      type: 'boolean',
    },
    {
      key: 'preventDelayRepsCovered',
      label: 'Reps covered by the prevent-or-delay prong (e.g. Litigation, No Conflict)',
      type: 'list',
    },
  ],

  // ── STRUCT — generic fallback. Per fix #6, the schema is intentionally
  //    minimal. Code-specific schemas (STRUCT-MERGER, STRUCT-CLOSING) below
  //    keep ONLY the features lawyers actually compare across deals.
  STRUCT: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'dealStructure',
      label: 'Deal structure (one-step / two-step tender / SoA / asset / stock / etc.)',
      type: 'enum',
      options: ['ONE_STEP_MERGER', 'TWO_STEP_TENDER_OFFER', 'SCHEME', 'ASSET', 'STOCK', 'OTHER'],
    },
    {
      key: 'mergerForm',
      label: 'Merger Form',
      type: 'tagged',
    },
    { key: 'shareholderApprovalMethodCompany', label: 'Company Shareholder Approval Method', type: 'enum', options: ['SPECIAL_MEETING', 'WRITTEN_CONSENT', 'SIGN_AND_CONSENT', 'BOARD_ONLY', 'NA'] },
    { key: 'shareholderApprovalMethodParent', label: 'Parent Shareholder Approval Method', type: 'enum', options: ['SPECIAL_MEETING', 'WRITTEN_CONSENT', 'SIGN_AND_CONSENT', 'BOARD_ONLY', 'NA'] },
    { key: 'adsPresent', label: 'American Depositary Shares present', type: 'boolean' },
    { key: 'adsVotingMechanics', label: 'ADS voting / surrender mechanics', type: 'text' },
  ],

  // ── STRUCT-MERGER — just the merger form ────────────────────────────────
  //    A single short phrase (e.g. "Reverse triangular merger"). No
  //    surviving-entity, no closing-conditions-precedent fields.
  'STRUCT-MERGER': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'dealStructure', label: 'Deal structure (one-step / two-step tender / SoA / asset / stock / etc.)', type: 'enum', options: ['ONE_STEP_MERGER', 'TWO_STEP_TENDER_OFFER', 'SCHEME', 'ASSET', 'STOCK', 'OTHER'] },
    // mergerForm is taxonomy-backed (MERGER_FORMS). After Stage 3 it resolves
    // through taxonomyForFeatureKey and the editor will enforce the picker.
    { key: 'mergerForm', label: 'Merger Form', type: 'tagged' },
    { key: 'shareholderApprovalMethodCompany', label: 'Company Shareholder Approval Method', type: 'enum', options: ['SPECIAL_MEETING', 'WRITTEN_CONSENT', 'SIGN_AND_CONSENT', 'BOARD_ONLY', 'NA'] },
    { key: 'shareholderApprovalMethodParent', label: 'Parent Shareholder Approval Method', type: 'enum', options: ['SPECIAL_MEETING', 'WRITTEN_CONSENT', 'SIGN_AND_CONSENT', 'BOARD_ONLY', 'NA'] },
    { key: 'adsPresent', label: 'American Depositary Shares present', type: 'boolean' },
    { key: 'adsVotingMechanics', label: 'ADS voting / surrender mechanics', type: 'text' },
  ],

  // ── STRUCT-CLOSING — closing location + closing timing ──────────────────
  'STRUCT-CLOSING': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'closingLocation', label: 'Closing Location (e.g. "WLRK offices")', type: 'text' },
    { key: 'closingTiming', label: 'Closing Timing (e.g. "X days after conditions satisfiable")', type: 'text' },
  ],

  CONSID: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'considerationType',
      label: 'Consideration Type',
      type: 'enum',
      options: ['all-cash', 'all-stock', 'mixed-cash-and-stock', 'cash-with-cvr'],
    },
    {
      key: 'perShareAmount',
      label: 'Per Share Cash Amount',
      type: 'currency',
    },
    {
      key: 'exchangeRatio',
      label: 'Exchange Ratio (stock deals)',
      type: 'text',
    },
    {
      key: 'equityAwardTreatment',
      label: 'Equity Award Treatment Summary (free-text overview)',
      type: 'text',
    },
    // ── Per-instrument row identifier (CONSID-EQUITY only) ────────────────
    //    When a CONSID-EQUITY provision represents ONE instrument type
    //    (Stock Options, RSUs, ESPP, etc.) this field distinguishes its row
    //    in the table. Drawn from EQUITY_INSTRUMENTS.
    {
      key: 'instrumentType',
      label: 'Instrument Type (the equity-award type this row represents — drawn from EQUITY_INSTRUMENTS)',
      type: 'tagged',
    },
    {
      key: 'outstandingCount',
      label: 'Outstanding Count (number of instruments of this type outstanding)',
      type: 'text',
    },
    // ── Equity-awards-specific (CONSID-EQUITY) — per-instrument detail ─────
    {
      key: 'outstandingInstruments',
      label: 'Outstanding Instruments (each instrument type addressed by this provision)',
      type: 'list-tagged',
    },
    {
      key: 'instrumentTreatments',
      label: 'Treatment per Instrument (how each instrument type is handled at closing)',
      type: 'list-tagged',
    },
    {
      key: 'vestingAcceleration',
      label: 'Vesting Acceleration (overall vesting treatment)',
      type: 'tagged',
    },
    {
      key: 'cutoffDate',
      label: 'Cutoff Date (date that distinguishes pre- vs. post-cutoff award treatment, if any)',
      type: 'text',
    },
    {
      key: 'cutoffTreatment',
      label: 'Pre/Post-Cutoff Treatment (how cutoff date changes the treatment)',
      type: 'text',
    },
    {
      key: 'cashOutAmount',
      label: 'Cash-Out Calculation (formula for RSU/PSU/restricted-stock cash-out)',
      type: 'text',
    },
    {
      key: 'optionSpread',
      label: 'Option Spread Calculation (formula for option cash-out, e.g. Merger Consideration minus exercise price)',
      type: 'text',
    },
    {
      key: 'performanceTreatment',
      label: 'PSU Performance Treatment (target / actual / prorated / deemed achieved)',
      type: 'text',
    },
    {
      key: 'espp_treatment',
      label: 'ESPP Treatment (final offering, termination, refund of contributions)',
      type: 'text',
    },
    {
      key: 'parachuteCap',
      label: '280G Parachute Cap Applies',
      type: 'boolean',
    },
    {
      key: 'doubleTrigger',
      label: 'Double Trigger Required (closing + qualifying termination)',
      type: 'boolean',
    },
    {
      key: 'appraisalRightsAvailable',
      label: 'Appraisal Rights Available',
      type: 'boolean',
    },
    {
      key: 'withholdingProvision',
      label: 'Withholding Provision Included',
      type: 'boolean',
    },
    {
      key: 'proration',
      label: 'Proration Mechanism (mixed deals)',
      type: 'boolean',
    },
    // ── Options earn-in via CVR ────────────────────────────────────────────
    // When the agreement contemplates BOTH options AND a CVR component,
    // capture whether option holders receive the CVR irrespective of
    // moneyness (EARN_IN_ELIGIBLE) or only when the option is in-the-money
    // relative to upfront cash + max CVR value (MUST_BE_ITM). Populated on
    // any CONSID provision that addresses option treatment in a CVR deal.
    {
      key: 'optionsCvrEarnIn',
      label: 'Options earn-in via CVR (only relevant when deal pays cash + CVR)',
      type: 'enum',
      options: ['EARN_IN_ELIGIBLE', 'MUST_BE_ITM', 'NOT_SPECIFIED'],
    },
  ],

  'REP-T': [
    // ── Per-rep features ───────────────────────────────────────────────────
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
      scope: 'clause',
    },
    {
      key: 'crossReferences',
      label: 'Cross References (other sections / defined terms / disclosure schedule citations)',
      type: 'list',
      scope: 'clause',
    },
    {
      key: 'scheduleReference',
      label: 'Disclosure Schedule Cross-Reference for THIS rep',
      type: 'text',
      scope: 'clause',
    },
    // ── Shared (article/preamble) features — apply to all company reps ─────
    {
      key: 'materialityQualifier',
      label: 'Materiality Qualifier (article-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'materialityScrape',
      label: 'Materiality Scrape (materiality qualifiers disregarded for bring-down / indemnity)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'knowledgeQualifier',
      label: 'Knowledge Qualifier Used (article-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'bringDownStandard',
      label: 'Applicable Bring-Down Standard (article-wide)',
      type: 'enum',
      options: ['all-respects', 'material-respects', 'MAE-standard', 'de-minimis'],
      scope: 'preamble',
    },
    {
      key: 'survivalPeriod',
      label: 'Survival Period (article-wide)',
      type: 'duration',
      scope: 'preamble',
    },
    {
      key: 'linkedBringDownStandard',
      label: 'Bring Down Standard',
      type: 'tagged',
      scope: 'clause',
      source: 'linked-from-COND',
    },
    // ── Stage 1: per-rep SEC-filings exception detail ──
    // (P3: fundamentalRep removed — no longer surfaced)
    { key: 'secFilingsExceptionScope', label: 'SEC-filings exception scope (text)', type: 'text', scope: 'preamble' },
    { key: 'secFilingsLookbackMonths', label: 'SEC-filings exception look-back (months)', type: 'duration', scope: 'preamble' },
    { key: 'secFilingsExcludedSections', label: 'SEC-filings exception excluded sections (e.g. risk factors, forward-looking)', type: 'list', scope: 'preamble' },
    { key: 'secFilingsCarvedOutReps', label: 'Reps NOT subject to the SEC-filings exception', type: 'list', scope: 'preamble' },
    { key: 'knowledgeStandard', label: 'Knowledge standard (ACTUAL / CONSTRUCTIVE / AFTER_INQUIRY / NA)', type: 'tagged', scope: 'preamble' },
    // Absence of Changes (REP-T)
    { key: 'absenceOfChangesStartDate', label: 'Absence-of-changes look-back start date', type: 'text', scope: 'clause' },
    { key: 'absenceOfChangesType', label: 'Absence-of-changes type', type: 'enum', options: ['SPECIFIED_IOCS', 'GENERAL_ORDINARY_COURSE', 'HYBRID'], scope: 'clause' },
    { key: 'absenceOfChangesExceptions', label: 'Absence-of-changes exceptions', type: 'list-tagged', scope: 'clause' },
    { key: 'undisclosedLiabilitiesExceptions', label: 'Undisclosed-liabilities exceptions', type: 'list-tagged', scope: 'clause' },
    // Disclosure-schedule split
    { key: 'disclosureSchedulesRequired', label: 'Reps with REQUIRED disclosure schedules', type: 'list', scope: 'preamble' },
    { key: 'disclosureSchedulesException', label: 'Reps with EXCEPTION disclosure schedules', type: 'list', scope: 'preamble' },
    { key: 'maeQualifiedReps', label: 'Reps qualified by MAE', type: 'list', scope: 'preamble' },
    // Top customers / suppliers rep
    { key: 'topCustomersSuppliersRepPresent', label: 'Top Customers & Suppliers rep present', type: 'boolean', scope: 'clause' },
    { key: 'topCustomersSuppliersDefinition', label: 'Top Customers & Suppliers definition (e.g. top 10 by FY revenue)', type: 'text', scope: 'clause' },
    // Material contracts rep
    { key: 'materialContractsBuckets', label: 'Material Contracts rep buckets (from MATERIAL_CONTRACT_BUCKET_CODES)', type: 'list-tagged', scope: 'clause' },
    { key: 'materialContractsDollarThresholds', label: 'Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }', type: 'list', scope: 'clause' },
    { key: 'materialContractsRedactionsPermitted', label: 'Redactions to material contracts permitted', type: 'boolean', scope: 'clause' },
    { key: 'permittedRedactionsDefinition', label: 'Permitted-redactions definition (text)', type: 'text', scope: 'clause' },
    // Closing-condition materiality scrape (separate from per-rep)
    { key: 'materialityScrapePresent', label: 'Materiality scrape present at closing-condition level', type: 'boolean', scope: 'preamble' },
    { key: 'materialityScrapeLanguage', label: 'Materiality scrape verbatim language', type: 'text', scope: 'preamble' },
    // ── Lookback synthesized from secFilingsLookbackMonths + deal announcement date
    { key: 'lookbackPeriod', label: 'Lookback period (months and date since which reps are made)', type: 'text', scope: 'clause' },
    // ── MAE limbs (one-prong vs two-prong) — populated on MAE / REP-T MAE definitions
    { key: 'maeLimbs', label: 'MAE limbs (ONE_LIMB / TWO_LIMB)', type: 'enum', options: ['ONE_LIMB', 'TWO_LIMB'], scope: 'preamble' },
    // ── P7 item 22: deleted Environment / IP / Tax / IT-Cyber / Litigation
    //    Stage-1 keys (they bloated the REP table without adding value the
    //    user wants in the article-wide view). The 5 ERISA keys + the
    //    Absence-of-Changes + Undisclosed-Liabilities exception keys remain
    //    above; those still feed REP_SPECIFIC_FEATURE_SPECS for the
    //    per-rep-row "Specific Features" cell.
  ],

  'REP-B': [
    // ── Per-rep features ───────────────────────────────────────────────────
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
      scope: 'clause',
    },
    {
      key: 'crossReferences',
      label: 'Cross References (other sections / defined terms)',
      type: 'list',
      scope: 'clause',
    },
    {
      key: 'solvencyRepIncluded',
      label: 'Solvency Representation Included',
      type: 'boolean',
      scope: 'clause',
    },
    {
      key: 'financingRepIncluded',
      label: 'Financing / Sufficient Funds Rep Included',
      type: 'boolean',
      scope: 'clause',
    },
    // ── Shared (article/preamble) features — apply to all buyer reps ───────
    {
      key: 'materialityQualifier',
      label: 'Materiality Qualifier (article-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'materialityScrape',
      label: 'Materiality Scrape (materiality qualifiers disregarded for bring-down / indemnity)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'knowledgeQualifier',
      label: 'Knowledge Qualifier Used (article-wide)',
      type: 'boolean',
      scope: 'preamble',
    },
    {
      key: 'bringDownStandard',
      label: 'Applicable Bring-Down Standard (article-wide)',
      type: 'enum',
      options: ['all-respects', 'material-respects', 'MAE-standard', 'de-minimis'],
      scope: 'preamble',
    },
    {
      key: 'linkedBringDownStandard',
      label: 'Bring Down Standard',
      type: 'tagged',
      scope: 'clause',
      source: 'linked-from-COND',
    },
    // ── Stage 1: per-rep flags + standalone sub-code presence flags ──
    // (P3: fundamentalRep removed — no longer surfaced)
    { key: 'sufficientFundsRepPresent', label: 'Sufficient Funds rep present', type: 'boolean', scope: 'clause' },
    { key: 'sufficientFundsRepDetails', label: 'Sufficient Funds rep — verbatim language', type: 'text', scope: 'clause' },
    { key: 'solvencyRepPresent', label: 'Solvency rep present', type: 'boolean', scope: 'clause' },
    { key: 'solvencyRepDetails', label: 'Solvency rep — verbatim language', type: 'text', scope: 'clause' },
    { key: 'antiRelianceRepPresent', label: 'Anti-Reliance rep present', type: 'boolean', scope: 'clause' },
    { key: 'antiRelianceRepText', label: 'Anti-Reliance rep — verbatim language', type: 'text', scope: 'clause' },
    { key: 'parentLitigationRepPresent', label: 'Parent litigation rep present', type: 'boolean', scope: 'clause' },
    { key: 'parentOwnershipRepPresent', label: 'Parent ownership rep present', type: 'boolean', scope: 'clause' },
    { key: 'parentBrokersRepPresent', label: 'Parent brokers / finders rep present', type: 'boolean', scope: 'clause' },
  ],

  COV: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'accessScope',
      label: 'Access Scope',
      type: 'enum',
      options: ['broad-access', 'reasonable-access', 'limited-access'],
    },
    {
      key: 'indemnificationPeriod',
      label: 'D&O Indemnification Tail Period (years)',
      type: 'duration',
    },
    {
      key: 'employeeBenefitPeriod',
      label: 'Employee Benefit Continuation Period (months)',
      type: 'duration',
    },
    {
      key: 'financingCooperation',
      label: 'Financing Cooperation Required',
      type: 'boolean',
    },
    {
      key: 'cvrIncluded',
      label: 'CVR Agreement Included',
      type: 'boolean',
    },
    // ── Stage 1: COV additions ──
    { key: 'tsaContemplated', label: 'Transition Services Agreement contemplated', type: 'boolean' },
    { key: 'financingCooperationPresent', label: 'Financing cooperation present', type: 'boolean' },
    { key: 'financingCooperationScope', label: 'Financing cooperation — scope text', type: 'text' },
    { key: 'financingCooperationBreachIsCondition', label: 'Financing-cooperation breach is closing condition', type: 'boolean' },
    { key: 'publicStatementsCarveoutParent', label: 'Public statements carveout — Parent', type: 'boolean' },
    { key: 'publicStatementsCarveoutCompany', label: 'Public statements carveout — Company', type: 'boolean' },
    { key: 'publicStatementsJointApproval', label: 'Public statements require joint approval', type: 'boolean' },
    { key: 'covenantComplianceStandard', label: 'Covenant compliance standard (closing-condition level)', type: 'enum', options: ['ALL_IN_MATERIAL_RESPECTS', 'EACH_IN_MATERIAL_RESPECTS', 'HYBRID'] },
    // ── P3 COV addition: Access scope purpose limitation ──
    { key: 'accessPurposeLimitation', label: 'Access scope — purpose limitation (verbatim, e.g. "solely for purposes of integration planning")', type: 'text' },
  ],

  // ── COV-EMPLOYEE — Employee Matters / Benefits ──────────────────────────
  //   Heavily negotiated post-closing covenant. The user wants per-item
  //   visibility: each compensation/benefit category gets its own standard
  //   (no-less-favorable vs. substantially-comparable vs. in-the-aggregate
  //   vs. buyer-discretion) so deals can be compared item-by-item.
  'COV-EMPLOYEE': [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'protectionPeriod',
      label: 'Protection Period',
      type: 'text',
      description: 'How long the protections last after closing, e.g., "12 months from Closing"',
    },
    {
      key: 'employeeBenefitPeriod',
      label: 'Employee Benefit Continuation Period (months)',
      type: 'duration',
    },
    {
      key: 'protectionPeriodMonths',
      label: 'Protection Period (months)',
      type: 'duration',
      description: 'Number of months of FULL protection following Closing (typically 12).',
    },
    {
      key: 'postProtectionPeriodMonths',
      label: 'Post-Protection Period (months)',
      type: 'duration',
      description: 'Number of additional months after the initial protection period during which a lesser standard applies.',
    },
    {
      key: 'postProtectionStandard',
      label: 'Post-Protection Standard',
      type: 'text',
      description: 'Standard that applies during the post-protection period (e.g. "no less favorable than employees of similar seniority").',
    },
    {
      key: 'compensationItems',
      label: 'Compensation & Benefits Standards — array of { item, item_label, standard_code, standard_label, text, timePeriod? } objects, one per comp/benefit item the provision addresses. Each item gets its OWN standard — do NOT collapse to a single section-wide standard. Include `timePeriod` per item only when the agreement specifies a per-item period that differs from the headline protectionPeriod (e.g. severance keyed to a 24-month qualifying-termination window while salary tracks 12 months).',
      type: 'list-tagged',
      description: 'Array of { item, standard_code, standard_label, text, timePeriod? } — each comp/benefit item with its specific standard and (optional) per-item time period.',
    },
    {
      key: 'severanceProtection',
      label: 'Severance Protection',
      type: 'text',
      description: 'Severance protection terms, including any double-trigger requirements',
    },
    {
      key: 'continuedService',
      label: 'Continued Service Credit',
      type: 'boolean',
      description: 'Whether prior service is credited under buyer plans',
    },
    {
      key: 'continued401k',
      label: '401(k) Continuation',
      type: 'text',
      description: 'How 401(k) is handled — terminate, continue, or fold in',
    },
    {
      key: 'unionContracts',
      label: 'Union / CBA Treatment',
      type: 'text',
      description: 'How collective bargaining agreements are handled',
    },
    {
      key: 'eligibilityWaiver',
      label: 'Waiver of Waiting Periods',
      type: 'boolean',
      description: 'Whether buyer waives eligibility/waiting periods/pre-existing conditions',
    },
  ],

  MISC: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'governingLaw',
      label: 'Governing Law Jurisdiction',
      type: 'text',
    },
    {
      key: 'jurisdictionExclusive',
      label: 'Exclusive Jurisdiction',
      type: 'boolean',
    },
    {
      key: 'juryWaiver',
      label: 'Jury Trial Waiver',
      type: 'boolean',
    },
    {
      key: 'specificPerformance',
      label: 'Specific Performance Available',
      type: 'boolean',
    },
    {
      key: 'thirdPartyBeneficiaryExceptions',
      label: 'Third-Party Beneficiary Exceptions',
      type: 'list',
    },
    {
      key: 'thirdPartyBeneficiaries',
      label: 'Third-Party Beneficiaries (named beneficiaries verbatim)',
      type: 'list',
    },
    {
      key: 'noticesAddress',
      label: 'Notices Block (party + address + email + counsel cc) — verbatim',
      type: 'text',
    },
    // ── Stage 1: MISC / boilerplate additions ──
    { key: 'willfulBreachDefinition', label: 'Willful Breach defined (text)', type: 'text' },
    { key: 'willfulBreachRequiresActualKnowledge', label: 'Willful Breach requires actual knowledge', type: 'boolean' },
    { key: 'willfulBreachCoversOmissions', label: 'Willful Breach covers omissions', type: 'boolean' },
    { key: 'willfulBreachLimitedToMaterial', label: 'Willful Breach limited to material breaches', type: 'boolean' },
    { key: 'repsSurvivalPresent', label: 'Reps survival clause present', type: 'boolean' },
    { key: 'repsSurvivalDuration', label: 'Reps survival duration', type: 'text' },
    { key: 'repsSurvivalExceptions', label: 'Reps survival — exceptions text', type: 'text' },
    { key: 'parentAssignmentRight', label: 'Parent has assignment right', type: 'boolean' },
    { key: 'parentAssignmentConditions', label: 'Parent assignment — conditions text', type: 'text' },
    { key: 'companyConsentForAssignment', label: 'Company consent required for assignment', type: 'boolean' },
    { key: 'assignmentExceptions', label: 'Assignment exceptions (list)', type: 'list' },
    { key: 'assignmentRestrictions', label: 'Assignment restrictions (text)', type: 'text' },
    { key: 'noExcusePostClosingPresent', label: 'No-excuse / no-recourse post-closing covenant present', type: 'boolean' },
    { key: 'noSetoffPresent', label: 'No-setoff clause present', type: 'boolean' },
    { key: 'specificPerformanceMutual', label: 'Specific performance mutually available', type: 'boolean' },
    { key: 'companyRightToForceClose', label: 'Company right to force closing', type: 'boolean' },
    { key: 'companyForceCloseConditions', label: 'Company-force-close — conditions text', type: 'text' },
    { key: 'specificPerformanceLimitations', label: 'Specific performance limitations (text)', type: 'text' },
    { key: 'bondSecurityRequiredForSP', label: 'Bond / security required for specific performance', type: 'boolean' },
    // ── Stage 6 — PW gap closures ──
    { key: 'terminationExceptionForBadBehavior', label: 'Termination exception for bad behavior (e.g. terminating party cannot be principal cause)', type: 'text' },
    { key: 'feeExpenseAllocation', label: 'Fee / expense allocation (who pays antitrust / FDI filing fees, etc.)', type: 'text' },
  ],

  // ── OTHER — generic catch-all so 100% of agreement sections are coded ───
  //   Per fix #8, every section of the agreement must be coded somewhere.
  //   OTHER is the fallback type for sections that don't fit any canonical
  //   rubric category — these still appear in the output with a summary so
  //   coverage is 100%.
  OTHER: [
    {
      key: 'mainConcept',
      label: 'Provision',
      type: 'text',
    },
    {
      key: 'sectionNumber',
      label: 'Section Number (as it appears in the agreement, e.g. "9.04")',
      type: 'text',
    },
    {
      key: 'sectionTitle',
      label: 'Section Title (as it appears in the agreement)',
      type: 'text',
    },
    {
      key: 'summary',
      label: 'Summary (short description of the provision\'s purpose / effect)',
      type: 'text',
    },
    {
      key: 'crossReferences',
      label: 'Cross References (other sections / defined terms referenced)',
      type: 'list',
    },
  ],

  // ── Stage 2: per-sub-code feature schemas ──────────────────────────────
  // Each schema is intentionally focused so the editor surface for the
  // sub-code is comparable across deals.

  'CONSID-CVR': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'triggers', label: 'Triggers (events that cause CVR payment)', type: 'list' },
    { key: 'milestones', label: 'Milestones (named events / approvals / sales targets)', type: 'list' },
    { key: 'maxPayment', label: 'Maximum per-CVR payment', type: 'currency' },
    { key: 'term', label: 'CVR term (years or expiration mechanic)', type: 'text' },
    { key: 'transferable', label: 'CVRs transferable', type: 'boolean' },
  ],

  'CONSID-COLLAR': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'collarType', label: 'Collar type', type: 'enum', options: ['FIXED', 'FLOATING', 'COLLARED', 'SYMMETRIC', 'ASYMMETRIC'] },
    { key: 'upperBound', label: 'Upper bound (price or %)', type: 'text' },
    { key: 'lowerBound', label: 'Lower bound (price or %)', type: 'text' },
    { key: 'language', label: 'Verbatim collar language', type: 'text' },
  ],

  'CONSID-TICKING': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'rate', label: 'Ticking rate (per day / per month)', type: 'text' },
    { key: 'startDate', label: 'Start date (when accrual begins)', type: 'text' },
    { key: 'escalationFormula', label: 'Escalation formula (text)', type: 'text' },
  ],

  'CONSID-EXCHANGE-RATIO': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'ratioType', label: 'Ratio type', type: 'enum', options: ['FIXED', 'FLOATING', 'NA'] },
    { key: 'value', label: 'Value (e.g. 0.5275 shares of Parent per share)', type: 'text' },
  ],

  'CONSID-WALKAWAY': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'holder', label: 'Holder of walkaway right', type: 'enum', options: ['TARGET', 'ACQUIRER', 'BOTH', 'NA'] },
    { key: 'threshold', label: 'Walkaway threshold (text — price level, % drop, etc.)', type: 'text' },
  ],

  'COV-APPRAISAL': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'parentInfoRights', label: 'Parent information rights re appraisal proceedings', type: 'text' },
    { key: 'parentParticipationOrControl', label: 'Parent participation or control of appraisal proceedings', type: 'text' },
    { key: 'settlementConsent', label: 'Consent required to settle appraisal claim', type: 'text' },
    { key: 'paymentConsent', label: 'Consent required to pay above statutory amount', type: 'text' },
  ],

  'COV-PAYAGENT': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'companyConsent', label: 'Company consent required for paying-agent selection', type: 'boolean' },
    { key: 'transferAgentException', label: 'Transfer-agent exception applies', type: 'boolean' },
    { key: 'otherAgentFormulation', label: 'Other agent formulation / fallback', type: 'text' },
  ],

  'COV-MARKETING': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'periodBusinessDays', label: 'Marketing period (business days)', type: 'duration' },
    { key: 'commencement', label: 'Commencement trigger (text)', type: 'text' },
  ],

  'COV-PROXY': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'proxyFilingDeadline', label: 'Proxy / Schedule 14A filing deadline', type: 'text' },
    { key: 'specialMeetingDeadline', label: 'Special meeting deadline', type: 'text' },
    { key: 'meetingDelayPermitted', label: 'Meeting delay permitted', type: 'boolean' },
    { key: 'meetingDelayConditions', label: 'Meeting delay — conditions text', type: 'text' },
  ],

  'COV-DO': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'insuranceCap', label: 'Tail insurance cap (currency or % of last annual premium)', type: 'text' },
    { key: 'advancementOfExpenses', label: 'Advancement of expenses included', type: 'boolean' },
    { key: 'notificationConsequences', label: 'Notification / claim-handling consequences (text)', type: 'text' },
    { key: 'additionalTerms', label: 'Additional terms (text)', type: 'text' },
  ],

  'TERMF-RTF-ANTI': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'triggers', label: 'Triggers (e.g. failure to obtain antitrust clearance by outside date)', type: 'list' },
    { key: 'amount', label: 'Fee amount (currency)', type: 'currency' },
    { key: 'soleRemedy', label: 'Fee is sole remedy for failure to clear regulatory review', type: 'boolean' },
    { key: 'exceptions', label: 'Exceptions to sole remedy (list)', type: 'list' },
    { key: 'specificPerformanceBar', label: 'Specific performance barred once fee paid', type: 'boolean' },
  ],

  'TERMF-REIMBURSE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'triggers', label: 'Triggers (events giving rise to reimbursement)', type: 'list' },
    { key: 'cap', label: 'Reimbursement cap (currency)', type: 'currency' },
  ],

  'REP-B-FUNDS': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'scope', label: 'Scope of funds (cash on hand / committed financing / both)', type: 'text' },
    { key: 'coversMergerConsideration', label: 'Covers merger consideration', type: 'boolean' },
    { key: 'coversReverseTermFee', label: 'Covers reverse termination fee', type: 'boolean' },
    { key: 'coversExpenses', label: 'Covers transaction expenses', type: 'boolean' },
  ],

  'REP-B-SOLVENCY': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'language', label: 'Verbatim solvency language', type: 'text' },
  ],

  'REP-B-ANTIRELIANCE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'language', label: 'Verbatim anti-reliance language', type: 'text' },
  ],

  'REP-T-SUFFICIENCY': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'language', label: 'Verbatim sufficiency-of-assets language', type: 'text' },
  ],

  'REP-T-TOP-CUSTOMERS': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'definition', label: 'Definition (e.g. top 10 customers by FY revenue)', type: 'text' },
    { key: 'coverage', label: 'Coverage (changes since look-back, no material loss, etc.)', type: 'text' },
  ],

  'REP-T-MATERIAL-CONTRACTS': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    {
      key: 'materialContractsBuckets',
      label: 'Material-contracts buckets — list of tagged items drawn from MATERIAL_CONTRACT_BUCKET_CODES',
      type: 'list-tagged',
    },
    {
      key: 'materialContractsDollarThresholds',
      label: 'Per-bucket dollar thresholds — array of { bucket, threshold }',
      type: 'list',
    },
    { key: 'materialContractsRedactionsPermitted', label: 'Redactions permitted', type: 'boolean' },
    { key: 'permittedRedactionsDefinition', label: 'Permitted redactions definition (text)', type: 'text' },
  ],

  // P5 item 5(b): REP-T-PREAMBLE / REP-B-PREAMBLE — schema captured ONLY on
  // the preamble pseudo-provision. The fallback in RepGeneralExceptionsTable
  // reads these when the per-rep features are silent.
  'REP-T-PREAMBLE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'secFilingsExceptionLookback', label: 'SEC-filings exception lookback (text, e.g. "since January 1, 2023")', type: 'text' },
    { key: 'secFilingsExceptionLookbackDate', label: 'SEC-filings exception lookback date (ISO)', type: 'text' },
    { key: 'secFilingsExceptionExclusions', label: 'SEC-filings exception excluded sections (list)', type: 'list' },
    { key: 'secFilingsExceptionCarvedOutReps', label: 'Reps NOT subject to the SEC-filings exception (list)', type: 'list' },
    { key: 'secFilingsExceptionLanguage', label: 'SEC-filings exception verbatim language', type: 'text' },
    { key: 'disclosureLetterReference', label: 'Company Disclosure Letter / Schedule reference', type: 'text' },
    { key: 'materialityScrapePresent', label: 'Materiality scrape present', type: 'boolean' },
    { key: 'materialityScrapeLanguage', label: 'Materiality scrape verbatim language', type: 'text' },
  ],
  'REP-B-PREAMBLE': [
    { key: 'mainConcept', label: 'Provision', type: 'text' },
    { key: 'secFilingsExceptionLookback', label: 'SEC-filings exception lookback (text)', type: 'text' },
    { key: 'secFilingsExceptionLookbackDate', label: 'SEC-filings exception lookback date (ISO)', type: 'text' },
    { key: 'secFilingsExceptionExclusions', label: 'SEC-filings exception excluded sections (list)', type: 'list' },
    { key: 'secFilingsExceptionCarvedOutReps', label: 'Reps NOT subject to the SEC-filings exception (list)', type: 'list' },
    { key: 'secFilingsExceptionLanguage', label: 'SEC-filings exception verbatim language', type: 'text' },
    { key: 'disclosureLetterReference', label: 'Parent Disclosure Letter / Schedule reference', type: 'text' },
    { key: 'materialityScrapePresent', label: 'Materiality scrape present', type: 'boolean' },
    { key: 'materialityScrapeLanguage', label: 'Materiality scrape verbatim language', type: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// Stage 5: CITABLE feature keys
//
// A "citable" feature is a boolean / enum / number whose value the user wants
// backed by a verbatim quote from the agreement. The extractor emits these as
// { value: <bareType>, text: "<verbatim quote>" } objects so the UI can show
// the quote inline and click through to the highlight in the full document.
//
// Free-text fields (mainConcept, definitionText, *Scope text, etc.) are NOT
// citable because they ARE the evidence. Tagged-item fields ({code,label,text})
// already carry their own text and don't need this wrapper either.
//
// This set is the single source of truth. The schemas below are auto-decorated
// at require-time so every feature with a matching key gets `citable: true`
// stamped on it. To make a NEW field citable just add its key here.
// ---------------------------------------------------------------------------

const CITABLE_FEATURE_KEYS = new Set([
  // Existing fields the user cares about across deals
  'outsideDate', 'outsideDateMonths', 'outsideDateExtension',
  'noticePeriod', 'matchingPeriod', 'subsequentMatchingPeriod', 'tailPeriod',
  'goShopWindow',
  'feeAmount', 'feePercentage', 'reverseFeeAmount', 'reverseFeePercentage',
  'expenseReimbursementCap', 'dollarThreshold', 'interimSettlementCap',
  'materialityScrape', 'governingLaw', 'jurisdictionExclusive', 'juryWaiver',
  'specificPerformance',
  // (P3: 'fundamentalRep' removed)
  'soleAndExclusiveRemedy', 'soleRemedy', 'willfulBreachException',
  'nakedNoVoteFee',
  'parachuteCap', 'doubleTrigger', 'appraisalRightsAvailable', 'withholdingProvision',
  'proration', 'financingCooperation', 'cvrIncluded',
  'hellOrHighWater', 'interimOperatingRestrictions', 'pullAndRefileRight',
  'burdensomConditionDefined', 'partyControlsStrategy',
  'fundsCondition', 'certificationRequired', 'maeConditionStandalone',
  'pandemicCarveout', 'cyberSecurityCarveout', 'disproportionateImpact',
  'preventDelayProng', 'willfulBreachDefinition',
  'ordinaryCourseCarveout', 'requiredByLawCarveout', 'materialityQualifier',
  'informationRights', 'subsequentMatching', 'forceTheVote',
  'interveningEventProvision', 'standstillWaiver', 'dontAskDontWaive',
  'confidentialityRequired', 'restraintFinality', 'faultBasedExclusion',
  'feeRequired', 'preVoteOnlyWindow', 'writtenConsentRequired', 'tickingFee',
  'continuedService', 'eligibilityWaiver',

  // Stage 1: COND family
  'burdensomeConditionPresent', 'burdensomeConditionScope',
  'mutualClosingDeadlineAfterConditionsDays',
  'governmentProceedingConditionPresent', 'absenceOfEnjoiningOrderPresent',

  // Stage 1: NOSOL
  'goShopPresent', 'goShopPeriodDays', 'extendedNegotiatingPeriodDays',
  'standstillWaiverPermitted', 'antiClubbingWaiverPermitted',
  'infoRequiredBidderIdentity', 'infoRequiredCommunicationsDrafts',
  'infoRequiredFinancingPapers', 'boardChangeForInterveningEvent',
  'boardChangeForSuperiorProposal', 'boardChangeStandard',
  'companyTerminationForSuperior', 'representativeBreachIsCompanyBreach',
  'representativesStandard', 'initialMatchPeriodDays', 'subsequentMatchPeriodDays',
  'parentTerminationRightForNonsolicitBreach', 'acquisitionTransactionPctThreshold',

  // Stage 1: ANTI
  'regulatoryStrategyControl', 'hsrFilingDeadlineBusinessDays',
  'substantialComplianceDeadlineDays', 'pullAndRefileCompanyConsent',
  'refileCapWithoutConsent', 'timingAgreementsProhibited',
  'clearSkiesCompany', 'clearSkiesParent',
  'effortsStandardDiffersByRemedy', 'parentLitigationObligation',

  // Stage 1: TERMR
  'extensionParty', 'extensionMutualOrUnilateral', 'extensionMaxExercises',
  'lawOrderTerminationPresent', 'finalAndNonappealableRequired',
  'lostPremiumDamagesPursuit', 'marketOutHolder',

  // Stage 1: TERMF
  'terminationFeePercentEquityValue',
  'tailFeeTriggerEndDate', 'tailFeeTriggerNakedNoVote',
  'tailFeeTriggerAltAnnouncedDuringPendency', 'tailFeeTriggerConsummatedDuringTail',
  'nakedNoVoteFeePresent', 'nakedNoVoteFeeAmount',
  'feeSoleAndExclusiveRemedy',

  // Stage 1: REP-T
  'topCustomersSuppliersRepPresent', 'materialContractsRedactionsPermitted',
  'materialityScrapePresent',
  'absenceOfChangesType', 'secFilingsLookbackMonths',

  // P5 item 2 → P7 item 22: dropped Environment / IP / Tax / IT-Cyber /
  // Litigation Stage-1 keys. Kept the 5 ERISA keys (they're still rendered
  // via REP_SPECIFIC_FEATURE_SPECS for the Employee Benefits rep row).
  'erisaPlansListed', 'erisaCompliance', 'erisaTitleIVPlans', 'erisaMultiemployer',
  'erisaParachutePayments',

  // P5 item 5: REP preamble — SEC-filings exception + materiality scrape details.
  'secFilingsExceptionLookback', 'secFilingsExceptionLookbackDate',
  'secFilingsExceptionExclusions', 'secFilingsExceptionCarvedOutReps',
  'secFilingsExceptionLanguage', 'disclosureLetterReference',

  // Stage 1: REP-B
  'sufficientFundsRepPresent', 'solvencyRepPresent', 'antiRelianceRepPresent',
  'parentLitigationRepPresent', 'parentOwnershipRepPresent', 'parentBrokersRepPresent',

  // Stage 1: IOC preamble
  'interimSettlementNonPaymentExcluded',
  'leadInAllowsActionAfterNoResponse', 'leadInPeriodDays',

  // Stage 1: COV
  'tsaContemplated', 'financingCooperationPresent',
  'financingCooperationBreachIsCondition',
  'publicStatementsCarveoutParent', 'publicStatementsCarveoutCompany',
  'publicStatementsJointApproval', 'covenantComplianceStandard',

  // Stage 1: MISC
  'willfulBreachRequiresActualKnowledge', 'willfulBreachCoversOmissions',
  'willfulBreachLimitedToMaterial', 'repsSurvivalPresent',
  'parentAssignmentRight', 'companyConsentForAssignment',
  'noExcusePostClosingPresent', 'noSetoffPresent',
  'specificPerformanceMutual', 'companyRightToForceClose',
  'bondSecurityRequiredForSP',

  // Stage 1: STRUCT
  'shareholderApprovalMethodCompany', 'shareholderApprovalMethodParent',
  'adsPresent',

  // P3: NOSOL additions
  'interveningEventScope', 'superiorProposalThresholdPct',

  // P3: TERMF tail-fee mechanics
  'tailFeeWindowMonths', 'tailFeeThresholdPct',
  'tailFeeSameProposalRequired',
]);

function isCitableFeatureKey(key) {
  return CITABLE_FEATURE_KEYS.has(key);
}

// Auto-decorate FEATURES schemas: stamp `citable: true` on every entry whose
// key appears in CITABLE_FEATURE_KEYS. Mutation happens once at require time.
for (const list of Object.values(FEATURES)) {
  if (!Array.isArray(list)) continue;
  for (const f of list) {
    if (f && f.key && CITABLE_FEATURE_KEYS.has(f.key)) {
      f.citable = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Alias lookup index — built once at require time
// ---------------------------------------------------------------------------

const _aliasIndex = {};
for (const [code, entry] of Object.entries(CODES)) {
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      _aliasIndex[alias.toLowerCase()] = code;
    }
  }
}

// ---------------------------------------------------------------------------
// Type lookup index
// ---------------------------------------------------------------------------

const _typeIndex = {};
for (const t of PROVISION_TYPES) {
  _typeIndex[t.key] = t;
}

// ---------------------------------------------------------------------------
// 4. Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns an array of code entries for a given provision type key.
 * Each entry is { code, ...codeData }.
 */
function getCodesForType(typeKey) {
  const results = [];
  for (const [code, entry] of Object.entries(CODES)) {
    if (entry.type === typeKey) {
      results.push({ code, ...entry });
    }
  }
  return results;
}

/**
 * Returns true if the given code string exists in the rubric.
 */
function isValidCode(code) {
  return Object.prototype.hasOwnProperty.call(CODES, code);
}

/**
 * Finds the canonical code for a given alias string (case-insensitive).
 * Returns the code string or null.
 */
function findCodeByAlias(alias) {
  if (!alias) return null;
  // Exact code match first
  if (isValidCode(alias)) return alias;
  // Alias lookup (case-insensitive)
  return _aliasIndex[alias.toLowerCase()] || null;
}

/**
 * Returns the human-readable label for a provision type key.
 */
function getTypeLabel(typeKey) {
  const t = _typeIndex[typeKey];
  return t ? t.label : null;
}

/**
 * Returns the feature definitions array for a provision type key.
 * If a canonical code is also passed (e.g. "TERMR-OUTSIDE") AND that code
 * has its own dedicated feature schema in FEATURES, returns that more-specific
 * schema instead. This is how we keep TERMR sub-types from showing irrelevant
 * fields (e.g. TERMR-MUTUAL never displays an outsideDate cell).
 *
 * Returns an empty array if neither the code nor the type has a schema.
 *
 * @param {string} typeKey  e.g. "TERMR", "REP-T", "OTHER"
 * @param {string} [code]   optional canonical code (e.g. "TERMR-OUTSIDE")
 */
function getFeaturesForType(typeKey, code) {
  // P5 item 9: sub-code-aware field filtering.
  //   - If FEATURES[code] exists and is a strict subset of FEATURES[typeKey]
  //     by key, return ONLY the code-specific schema (tight whitelist —
  //     this is the common case for canonical sub-codes like REP-B-FUNDS).
  //   - If FEATURES[code] introduces keys not present on the parent type,
  //     return the union (parent + code-unique fields, deduped by key)
  //     so the editor surfaces every editable field for the sub-code.
  //   - Otherwise fall back to the parent type's schema.
  if (code && FEATURES[code]) {
    const codeFeats = FEATURES[code];
    const parentFeats = FEATURES[typeKey] || [];
    if (parentFeats.length === 0) return codeFeats;
    const parentKeys = new Set(parentFeats.map((f) => f.key));
    const codeKeys = new Set(codeFeats.map((f) => f.key));
    const codeOnly = codeFeats.filter((f) => !parentKeys.has(f.key));
    if (codeOnly.length === 0) {
      // strict subset (every code key exists on the parent) — return the
      // narrow schema unchanged.
      return codeFeats;
    }
    // Code introduces unique fields — union: parent first, then code-only.
    const seen = new Set();
    const merged = [];
    for (const f of parentFeats) {
      if (f && f.key && !seen.has(f.key)) { seen.add(f.key); merged.push(f); }
    }
    for (const f of codeOnly) {
      if (f && f.key && !seen.has(f.key)) { seen.add(f.key); merged.push(f); }
    }
    return merged;
  }
  return FEATURES[typeKey] || [];
}

/**
 * Shortcut for callers that have a canonical code in hand and want the
 * code-specific schema with a sensible fallback to the parent type.
 *
 * @param {string} code  e.g. "TERMR-OUTSIDE"
 */
function getFeaturesForCode(code) {
  if (!code) return [];
  if (FEATURES[code]) return FEATURES[code];
  const entry = CODES[code];
  if (entry && entry.type && FEATURES[entry.type]) return FEATURES[entry.type];
  return [];
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  PROVISION_TYPES,
  CODES,
  FEATURES,
  CITABLE_FEATURE_KEYS,
  isCitableFeatureKey,
  getCodesForType,
  isValidCode,
  findCodeByAlias,
  getTypeLabel,
  getFeaturesForType,
  getFeaturesForCode,
};
