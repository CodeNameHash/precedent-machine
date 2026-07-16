// ───────────────────────────────────────────────────────────────────────────
// CATEGORY_SUMMARY_FEATURES — the single source of truth for the per-category
// "feature summary" tables. Each type maps to an ordered list of rows:
//   { label, keys[] }            — resolve the first non-empty feature in keys
//   { label, keys[], maeCode }   — MAE carveout rows resolved via carveouts[]
//   { label, keys[], customRenderKey } — a renderer the CONSUMER supplies via a
//        string marker (so this data module stays free of React / page-local
//        helpers). The review page maps the marker to its IOC fallback render;
//        the compare view ignores it and falls back to keys.
//
// Consumed by BOTH the review page (CategoryFeatureSummaryTable, one value
// column) and the compare view (one value column per deal). Keep this the ONLY
// definition — the two surfaces previously drifted apart with parallel specs.
// ───────────────────────────────────────────────────────────────────────────

const CATEGORY_SUMMARY_FEATURES = {
  // ─── STRUCT — Structure & Mechanics. The review page renders STRUCT with a
  // bespoke StructTable (Deal Structure + Merger Form as the lead rows); this
  // spec mirrors that lead order for the compare view (review still uses
  // StructTable and is unaffected — it never reads this spec for STRUCT).
  STRUCT: [
    { label: 'Deal Structure',                keys: ['dealStructure'] },
    { label: 'Merger Form',                   keys: ['mergerForm'] },
    { label: 'Offer Commencement',            keys: ['offerCommencementDeadline'] },
    { label: 'Offer Price',                   keys: ['offerPrice'] },
    { label: 'Offer Conditions',              keys: ['offerConditionsReference'] },
    { label: 'Offer Extension',               keys: ['offerExpirationAndExtension'] },
    { label: 'Acceptance / Payment',          keys: ['acceptanceAndPaymentMechanics'] },
    { label: 'Schedule 14D-9',                keys: ['schedule14D9Filing'] },
    { label: 'Back-End Merger',               keys: ['backendMergerMechanic'] },
    { label: 'Surviving Entity',              keys: ['survivingEntity'] },
    { label: 'Closing Conditions Precedent',  keys: ['closingConditionsPrecedent'] },
  ],

  // ─── CONSID — Consideration. Mirrors ConsidTable's lead (consideration type
  // + per-share amount) for the compare view.
  CONSID: [
    { label: 'Consideration Type',            keys: ['considerationType'] },
    { label: 'Per-Share Amount',              keys: ['perShareAmount'] },
    { label: 'Exchange Ratio',                keys: ['exchangeRatio'] },
    { label: 'Equity Award Treatment',        keys: ['equityAwardTreatment'] },
    { label: 'Vesting Acceleration',          keys: ['vestingAcceleration'] },
    { label: 'Option Cash-Out Amount',        keys: ['cashOutAmount'] },
    { label: 'Option Spread',                 keys: ['optionSpread'] },
    { label: 'Performance Award Treatment',   keys: ['performanceTreatment'] },
    { label: 'ESPP Treatment',                keys: ['espp_treatment'] },
    { label: 'Parachute Cap',                 keys: ['parachuteCap'] },
    { label: 'Double-Trigger',                keys: ['doubleTrigger'] },
    { label: 'Appraisal Rights Available',    keys: ['appraisalRightsAvailable'] },
    { label: 'Withholding Provision',         keys: ['withholdingProvision'] },
    { label: 'Proration',                     keys: ['proration'] },
    { label: 'Cutoff Date',                   keys: ['cutoffDate'] },
    { label: 'Cutoff Treatment',              keys: ['cutoffTreatment'] },
  ],

  // ─── NOSOL — Paul Weiss diligence checklist q120–q140 ───────────────────
  NOSOL: [
    // Preserve the existing 7 fiduciary-out / notice / matching rows at the top.
    { label: 'Fiduciary Out — Engagement Standard', keys: ['fiduciaryEngageStandard', 'fiduciaryOutStandard'] },
    { label: 'Fiduciary Out — Final Determination',  keys: ['fiduciaryFinalStandard', 'fiduciaryOutStandard'] },
    { label: 'Notice Period',                         keys: ['noticePeriod'] },
    { label: 'Notice Content',                        keys: ['noticeContent'] },
    { label: 'Matching Period',                       keys: ['matchingPeriod', 'initialMatchPeriodDays'] },
    { label: 'Intervening Event Termination',         keys: ['interveningEventTermination', 'interveningEventProvision'] },
    { label: 'Force the Vote',                        keys: ['forceTheVote', 'forceTheVoteDetails'] },
    // Go-shop
    { label: 'Go-Shop Present',                       keys: ['goShopPresent'] },
    { label: 'Go-Shop Period (days)',                 keys: ['goShopPeriodDays', 'goShopWindow'] },
    { label: 'Go-Shop Excluded Parties',              keys: ['goShopExcludedParties'] },
    { label: 'Extended Negotiating Period (days)',    keys: ['extendedNegotiatingPeriodDays'] },
    // Waivers
    { label: 'Standstill Waiver Permitted',           keys: ['standstillWaiverPermitted', 'standstillWaiver'] },
    { label: 'Anti-Clubbing Waiver Permitted',        keys: ['antiClubbingWaiverPermitted'] },
    // Info required for alternative proposals
    { label: 'Info Required — Bidder Identity',       keys: ['infoRequiredBidderIdentity'] },
    { label: 'Info Required — Communications & Drafts', keys: ['infoRequiredCommunicationsDrafts'] },
    { label: 'Info Required — Financing Papers',      keys: ['infoRequiredFinancingPapers'] },
    // Definitions
    { label: 'Acceptable Confidentiality Agreement Definition', keys: ['acceptableConfidentialityAgreementDefinition'] },
    { label: 'Acquisition Transaction Definition',    keys: ['acquisitionTransactionDefinition'] },
    { label: 'Acquisition Transaction % Threshold',   keys: ['acquisitionTransactionPctThreshold'] },
    // Board change / superior-proposal / company termination
    { label: 'Board Change for Intervening Event',    keys: ['boardChangeForInterveningEvent'] },
    { label: 'Intervening Event Definition',          keys: ['interveningEventDefinition'] },
    { label: 'Board Change for Superior Proposal',    keys: ['boardChangeForSuperiorProposal'] },
    { label: 'Board Change Standard',                 keys: ['boardChangeStandard'] },
    { label: 'Company Termination for Superior Proposal', keys: ['companyTerminationForSuperior'] },
    { label: 'Company Termination Conditions',        keys: ['companyTerminationForSuperiorConditions'] },
    // Representative breach + match periods + parent termination
    { label: 'Representative Breach Deemed Company Breach', keys: ['representativeBreachIsCompanyBreach'] },
    { label: 'Representatives Standard',              keys: ['representativesStandard'] },
    { label: 'Initial Match Period (business days)',  keys: ['initialMatchPeriodDays', 'matchingPeriod'] },
    { label: 'Subsequent Match Period (business days)', keys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'] },
    { label: 'Parent Termination Right for Nonsolicit Breach', keys: ['parentTerminationRightForNonsolicitBreach'] },
  ],

  // ─── ANTI — Paul Weiss diligence checklist q68–q91 + q82–q83 ────────────
  ANTI: [
    { section: 'Efforts', label: 'Efforts', keys: ['effortsStandard'] },
    { section: 'Caps & Limits', label: 'Caps & Limits', keys: ['burdenCommitment', 'burdenCap', 'divestitureCap', 'divestitureCapDescription'] },
    { section: 'Litigation', label: 'Litigation', keys: ['litigationObligation', 'parentLitigationObligation'] },
    { section: 'Clear Skies', label: 'Clear Skies', keys: ['clearSkies', 'clearSkiesCompany', 'clearSkiesParent'] },
    { section: 'Strategy & Filings', label: 'Control', keys: ['regulatoryStrategyControlTagged', 'controllingParty', 'regulatoryStrategyControl'] },
    { section: 'Strategy & Filings', label: 'Consultation', keys: ['consultationTier', 'regulatoryCooperationScope'] },
    { section: 'Strategy & Filings', label: 'Pull and Refile', keys: ['pullRefile', 'pullAndRefileCompanyConsent'] },
    { section: 'Strategy & Filings', label: 'HSR Filing Deadline', keys: ['hsrFilingDeadline', 'hsrFilingDeadlineBusinessDays'] },
    { section: 'Strategy & Filings', label: 'Ex-HSR Filing Deadline', keys: ['exHsrFilingDeadline', 'otherRegulatoryFilingDeadlines', 'filingDeadline'] },
    { section: 'Strategy & Filings', label: 'Timing Agreement', keys: ['timingAgreement', 'timingAgreementsProhibited'] },
    { section: 'Closing Condition (antitrust)', label: 'Antitrust', keys: ['regulatoryClosingConditions'] },
  ],

  // ─── TERMR — Paul Weiss diligence checklist q83–q99 ─────────────────────
  // Full mutual-side spec. Buyer / Target party pages use a trimmed spec
  // (see TERMR-B / TERMR-T below) so the page isn't dominated by "Not present"
  // rows that only apply to the mutual outside-date / extension family.
  TERMR: [
    { label: 'Outside Date',                          keys: ['outsideDate'] },
    { label: 'Outside Date (months)',                 keys: ['outsideDateMonths'] },
    { label: 'Extension Structure Present',           keys: ['outsideDateExtension', 'extensionAvailable'] },
    { label: 'Extension Party',                       keys: ['extensionParty', 'extensionConsentParty'] },
    { label: 'Extension Mutual or Unilateral',        keys: ['extensionMutualOrUnilateral'] },
    { label: 'Extension Period',                      keys: ['extensionPeriod'] },
    { label: 'Extension Max Exercises',               keys: ['extensionMaxExercises'] },
    { label: 'Extension Trigger',                     keys: ['extensionTrigger', 'extensionConditions', 'outsideDateExtensionConditions'] },
    { label: 'Closing Deadline After Conditions Satisfied (days)', keys: ['mutualClosingDeadlineAfterConditionsDays'] },
    { label: 'Closing Timing Provisions',             keys: ['closingTimingProvisions', 'closingTiming'] },
    { label: 'Absence of Enjoining Law/Order Condition Present', keys: ['absenceOfEnjoiningOrderPresent'] },
    { label: 'Absence-of-Enjoining-Order Details',    keys: ['absenceOfEnjoiningOrderDetails'] },
    { label: 'Law/Orders Termination Right Present',  keys: ['lawOrderTerminationPresent'] },
    { label: 'Law/Orders Termination Scope',          keys: ['lawOrderTerminationScope'] },
    { label: 'Final and Nonappealable Required',      keys: ['finalAndNonappealableRequired', 'restraintFinality'] },
    { label: 'Termination Carveout for Own Breach',   keys: ['terminationCarveoutForOwnBreach', 'faultBasedExclusion'] },
    { label: 'Lost Premium Damages Pursuit',          keys: ['lostPremiumDamagesPursuit'] },
    { label: 'Lost Premium Damages Conditions',       keys: ['lostPremiumDamagesConditions'] },
    { label: 'Market-Out / Walkaway Holder',          keys: ['marketOutHolder', 'holder'] },
    { label: 'Party Who Can Terminate',               keys: ['partyWhoCanTerminate'] },
    { label: 'Termination Triggers',                  keys: ['terminationTriggers', 'triggerEvents'] },
    { label: 'Cure Period',                           keys: ['curePeriod', 'cureDays'] },
    { label: 'Vote Threshold',                        keys: ['voteThreshold'] },
  ],

  // ─── TERMR-B — Buyer / Parent termination rights only. Drops outside-date
  //     and extension rows (those are mutual). Keeps breach + recommendation
  //     change triggers + cure period.
  'TERMR-B': [
    { label: 'Party Who Can Terminate',               keys: ['partyWhoCanTerminate'] },
    { label: 'Termination Triggers',                  keys: ['terminationTriggers', 'triggerEvents'] },
    { label: 'Cure Period',                           keys: ['curePeriod', 'cureDays'] },
    { label: 'Materiality Standard',                  keys: ['materialityStandard'] },
    { label: 'Termination Carveout for Own Breach',   keys: ['terminationCarveoutForOwnBreach', 'faultBasedExclusion'] },
    { label: 'Pre-Vote Only Window',                  keys: ['preVoteOnlyWindow'] },
  ],

  // ─── TERMR-T — Target / Company termination rights only. Same shape as
  //     Buyer side plus the superior-proposal-fee + execution-conditions
  //     fields that only apply when the target terminates.
  'TERMR-T': [
    { label: 'Party Who Can Terminate',               keys: ['partyWhoCanTerminate'] },
    { label: 'Termination Triggers',                  keys: ['terminationTriggers', 'triggerEvents'] },
    { label: 'Cure Period',                           keys: ['curePeriod', 'cureDays'] },
    { label: 'Materiality Standard',                  keys: ['materialityStandard'] },
    { label: 'Termination Carveout for Own Breach',   keys: ['terminationCarveoutForOwnBreach', 'faultBasedExclusion'] },
    { label: 'Superior Proposal Termination Fee Required', keys: ['feeRequired'] },
    { label: 'Superior Proposal Execution Conditions', keys: ['executionConditions'] },
  ],

  // ─── TERMF — Paul Weiss diligence checklist q141–q152 + q198–q200 ──────
  TERMF: [
    { label: 'Company Termination Fee Amount',        keys: ['feeAmount', 'companyTerminationFee'] },
    { label: 'Fee % of Equity Value',                 keys: ['terminationFeePercentEquityValue', 'feePercentage'] },
    { label: 'Fee Trigger Events',                    keys: ['triggerEvents'] },
    { label: 'Fee / Reimbursement on Naked No-Vote',  keys: ['nakedNoVoteFeePresent', 'nakedNoVoteFee'] },
    { label: 'Naked No-Vote Fee Amount',              keys: ['nakedNoVoteFeeAmount'] },
    { label: 'Tail Fee — End-Date Trigger',           keys: ['tailFeeTriggerEndDate'] },
    { label: 'Tail Fee — Naked No-Vote Trigger',      keys: ['tailFeeTriggerNakedNoVote'] },
    { label: 'Tail Fee — Alt Announced During Pendency', keys: ['tailFeeTriggerAltAnnouncedDuringPendency'] },
    { label: 'Tail Fee — Consummated During Tail',    keys: ['tailFeeTriggerConsummatedDuringTail'] },
    { label: 'Tail Period (months)',                  keys: ['tailPeriod', 'tailFeeWindowMonths'] },
    { label: 'Termination Fee Sole Remedy',           keys: ['feeSoleAndExclusiveRemedy', 'soleRemedy', 'soleAndExclusiveRemedy'] },
    { label: 'Exceptions to Sole Remedy',             keys: ['feeSoleRemedyExceptions', 'willfulBreachException'] },
    { label: 'Remedy Bar After Termination Fee',      keys: ['remedyBarAfterFee'] },
    { label: 'Antitrust RTF Present',                 keys: ['reverseFeeAmount', 'reverseTerminationFee'] },
    { label: 'Antitrust RTF Triggers',                keys: ['triggers'] },
    { label: 'Antitrust RTF Amount',                  keys: ['reverseFeeAmount', 'amount'] },
    { label: 'Antitrust RTF Sole Remedy',             keys: ['soleRemedy'] },
    { label: 'Antitrust RTF Exceptions',              keys: ['exceptions'] },
    { label: 'Acquirer Expense Reimbursement Obligation', keys: ['expenseReimbursement'] },
    { label: 'Acquirer Expense Reimbursement Triggers', keys: ['triggers'] },
    { label: 'Acquirer Expense Reimbursement Cap',    keys: ['expenseReimbursementCap', 'cap'] },
  ],

  // ─── MAE — Paul Weiss diligence checklist q20–q37 ───────────────────────
  // Rows are scanned across the supplied provisions (typically the REP-T or
  // DEF "Material Adverse Effect" definition). Carveout rows resolve via
  // findCarveoutByCode against features.carveouts (taxonomy MAE_CARVEOUT_CODES).
  MAE: [
    { label: 'Disproportionate Impact Carveouts',     keys: ['disproportionateImpactCarveouts'] },
    { label: 'Non-Disproportionate Impact Carveouts', keys: ['nonDisproportionateImpactCarveouts'] },
    { label: 'Prevent / Delay Prong Present',         keys: ['preventDelayProng'] },
    { label: 'Reps Including Prevent / Delay Prong',  keys: ['preventDelayRepsCovered'] },
    { label: 'All Carveouts (canonical list)',        keys: ['carveouts', 'carveOuts', 'carveOutsList'] },
    { label: 'Pricing MFNs Carveout',                 keys: [], maeCode: 'PRICING_MFN' },
    { label: 'Executive Action Carveout',             keys: [], maeCode: 'EXECUTIVE_ACTION' },
    { label: 'Tariffs Carveout',                      keys: [], maeCode: 'TARIFFS' },
    { label: 'Government Shutdowns Carveout',         keys: [], maeCode: 'GOVERNMENT_SHUTDOWNS' },
    { label: 'Clinical Results Carveout',             keys: [], maeCode: 'CLINICAL_RESULTS' },
    { label: 'FDA Discussions Carveout',              keys: [], maeCode: 'FDA_DISCUSSIONS' },
    { label: 'FDA Approvals / Competitor Entry Carveout', keys: [], maeCode: 'FDA_APPROVALS_COMPETITOR_ENTRY' },
    { label: 'Supply Chain / Manufacturing Carveout', keys: [], maeCode: 'SUPPLY_CHAIN' },
    { label: 'Pricing / Reimbursement Developments Carveout', keys: [], maeCode: 'PRICING_REIMBURSEMENT' },
    { label: 'Medical Organizations / Regulators Carveout', keys: [], maeCode: 'MEDICAL_ORGS_STATEMENTS' },
    { label: 'Patents / Exclusivity Carveout',        keys: [], maeCode: 'PATENTS_EXCLUSIVITY' },
    { label: 'Parent Actions / Inaction Carveout',    keys: [], maeCode: 'PARENT_ACTIONS_OR_INACTION' },
    { label: 'Employee Departures Carveout',          keys: [], maeCode: 'EMPLOYEE_DEPARTURES' },
    { label: 'Pandemic Carveout',                     keys: ['pandemicCarveout'], maeCode: 'PANDEMIC' },
    { label: 'Other Carveouts',                       keys: [], maeCode: 'OTHER' },
  ],

  // ─── COND-M / COND-B / COND-S — Paul Weiss q41–q43, q82, q88–q99 ───────
  // Most rows were folded INTO the Details cell of each canonical-condition
  // row below (CanonicalConditionsTable). The remaining summary rows are the
  // few items that don't naturally fit any canonical row.
  'COND-M': [
    { label: 'MAE as Closing Condition',              keys: ['maeConditionStandalone', 'maeStandaloneCondition'] },
    { label: 'Tender Offer Minimum Condition',        keys: ['tenderOfferMinimumCondition'] },
  ],
  'COND-B': [
    { label: 'Reps Bring-Down',                       keys: ['bringDownTiers', 'bringDownStandard'] },
    { label: 'MAE as Closing Condition',              keys: ['maeConditionStandalone'] },
    { label: 'Dissenting Shares Threshold',           keys: ['dissentingSharesThreshold'] },
  ],
  'COND-S': [
    { label: 'Reps Bring-Down',                       keys: ['bringDownTiers', 'bringDownStandard'] },
    { label: 'Funds Availability as Condition',       keys: ['fundsCondition'] },
  ],

  // ─── IOC — leaner summary. Redundant rows (affirmative scope / efforts
  // standard / company exceptions / ordinary-course defined / per-bucket
  // thresholds list) live in IocAffirmativeCovenantsTable / IocGeneralExceptionsTable
  // / IocNegativeCovenantsTable above, so they're not repeated here.
  IOC: [
    { label: 'Materiality Qualifier (section-wide)',  keys: ['materialityQualifier'] },
    { label: 'Schedule Reference',                    keys: ['scheduleReference'] },
    { label: 'Parent / Buyer IOC Buckets',            keys: ['parentBuyerIocBuckets'] },
  ],

  // ─── COV — Paul Weiss q115–q119 ────────────────────────────────────────
  COV: [
    { label: 'TSA Contemplated',                      keys: ['tsaContemplated'] },
    // P3 item 4: surface per-item employee compensation standards (base salary,
    // bonus, benefits, severance, LTI). Inserted between TSA and Financing.
    { label: 'Employee comp: Base salary',            keys: ['baseSalaryStandard'] },
    { label: 'Employee comp: Bonus',                  keys: ['bonusStandard', 'targetBonusStandard'] },
    { label: 'Employee comp: Benefits',               keys: ['benefitsStandard', 'healthWelfareStandard'] },
    { label: 'Employee comp: Severance',              keys: ['severanceStandard'] },
    { label: 'Employee comp: Long-Term Incentive',    keys: ['ltiStandard', 'longTermIncentiveStandard'] },
    { label: 'Financing Cooperation Present',         keys: ['financingCooperationPresent', 'financingCooperation'] },
    { label: 'Financing Cooperation Scope',           keys: ['financingCooperationScope'] },
    { label: 'Financing Cooperation Breach is Condition', keys: ['financingCooperationBreachIsCondition'] },
    { label: 'Public Statements — Joint Approval',    keys: ['publicStatementsJointApproval'] },
    // FB3 item 4(e): the Parent/Company carveout booleans used to be two
    // separate near-duplicate rows (almost always identical Yes/Yes on a
    // single deal) cluttering the Joint Approval row's neighborhood — one
    // "Exceptions" row lists the actual carve-out text instead (review-page
    // customRenderKey; compare falls back to the raw keys below).
    { label: 'Public Statements — Exceptions', keys: ['publicStatementsCarveoutParent', 'publicStatementsCarveoutCompany'], customRenderKey: 'publicStatementsExceptions' },
    // FB3 item 4(c): 'Covenant Compliance Closing Standard' (duplicates
    // Conditions), 'D&O Notification Consequences', and 'CVR Agreement
    // Included' deleted — pure noise rows, no replacement.
    { label: 'D&O Insurance Cap',                     keys: ['insuranceCap'] },
    { label: 'D&O Indemnification Tail Period',       keys: ['indemnificationPeriod'] },
    { label: 'D&O Advancement of Expenses',           keys: ['advancementOfExpenses'] },
    { label: 'Employee Benefit Continuation Period',  keys: ['employeeBenefitPeriod'] },
    { label: 'Access Scope',                          keys: ['accessScope'] },
    // P3 item 6: access purpose limitation
    { label: 'Access — Purpose Limitation',           keys: ['accessPurposeLimitation'] },
  ],

  // ─── MISC — preserve existing 10 rows, then PW q163–q184 ────────────────
  MISC: [
    // Existing 10 boilerplate rows preserved at the top.
    { label: 'Governing Law',              keys: ['governingLaw'] },
    { label: 'Jurisdiction',               keys: ['jurisdictionExclusive', 'jurisdiction'] },
    { label: 'Jury Trial Waiver',          keys: ['juryWaiver'] },
    { label: 'Specific Performance',       keys: ['specificPerformance'] },
    { label: 'Third-Party Beneficiaries',  keys: ['thirdPartyBeneficiaryExceptions', 'thirdPartyBeneficiaries'] },
    { label: 'Amendments Requirement',     keys: ['amendmentsRequirement'] },
    { label: 'Waiver Standard',            keys: ['waiverStandard'] },
    // FB3 item 5(b): Severability and Counterparts rows deleted from this
    // table — both are still reachable via the section's own "Provisions in
    // this section" list below the table (each is its own MISC provision),
    // so nothing is lost, just decluttered off the curated feature table.
    // PW q163–q184 additions. ("Termination Exception for Bad Behavior" moved
    // out of Misc — it belongs in Termination, where the TermrRebuiltSummary
    // "breach standard that blocks termination" row already surfaces it.
    // "Lost Premium Damages Pursuit" likewise lives in Termination.)
    { label: 'Fee / Expense Allocation',   keys: ['feeExpenseAllocation'] },
    { label: 'Mutual Specific Performance Right', keys: ['specificPerformanceMutual'] },
    { label: 'Company Right to Force Parent to Close', keys: ['companyRightToForceClose'] },
    { label: 'Company Force-Close Conditions', keys: ['companyForceCloseConditions'] },
    { label: 'Limitations on Specific Performance', keys: ['specificPerformanceLimitations'] },
    { label: 'Bond / Security Required for SP', keys: ['bondSecurityRequiredForSP'] },
    { label: 'Willful Breach Definition',  keys: ['willfulBreachDefinition'] },
    { label: 'Willful Breach Requires Actual Knowledge', keys: ['willfulBreachRequiresActualKnowledge'] },
    { label: 'Willful Breach Covers Omissions', keys: ['willfulBreachCoversOmissions'] },
    { label: 'Willful Breach Limited to Material', keys: ['willfulBreachLimitedToMaterial'] },
    // FB3 item 5(a): reps-survival rows (present/duration/exceptions) and the
    // "no excuse post-closing" row deleted — irrelevant boilerplate for
    // public-target deals (reps never survive Closing on these deals).
    { label: 'Parent Assignment Right',    keys: ['parentAssignmentRight'] },
    { label: 'Parent Assignment Conditions', keys: ['parentAssignmentConditions'] },
    { label: 'Company Consent for Assignment', keys: ['companyConsentForAssignment'] },
    { label: 'Assignment Exceptions',      keys: ['assignmentExceptions'] },
    { label: 'Assignment Restrictions',    keys: ['assignmentRestrictions'] },
  ],
};

// Aliases so the dispatcher can pass the parent-type spec for sub-codes.
CATEGORY_SUMMARY_FEATURES['COND'] = CATEGORY_SUMMARY_FEATURES['COND-M'];
CATEGORY_SUMMARY_FEATURES['IOC-T'] = CATEGORY_SUMMARY_FEATURES['IOC'];
CATEGORY_SUMMARY_FEATURES['IOC-B'] = CATEGORY_SUMMARY_FEATURES['IOC'];
// NOSOL-T/NOSOL-B/NOSOL-M (party-scoped no-solicitation) inherit the same
// summary-feature spec as base NOSOL — mirrors the IOC-T/IOC-B aliasing above.
CATEGORY_SUMMARY_FEATURES['NOSOL-T'] = CATEGORY_SUMMARY_FEATURES['NOSOL'];
CATEGORY_SUMMARY_FEATURES['NOSOL-B'] = CATEGORY_SUMMARY_FEATURES['NOSOL'];
CATEGORY_SUMMARY_FEATURES['NOSOL-M'] = CATEGORY_SUMMARY_FEATURES['NOSOL'];
// TERMR-M (Mutual) inherits the full TERMR spec (outside date / extension /
// legal / vote belong here). TERMR-B and TERMR-T have their own trimmed
// specs defined above.
CATEGORY_SUMMARY_FEATURES['TERMR-M'] = CATEGORY_SUMMARY_FEATURES['TERMR'];
// MAE is split into Company/Parent sidebar pages (MAE-DEF / MAE-DEF-P); both
// share the MAE carveout spec. (Review renders MAE via its own
// MaeDefinitionSummary and does not read these keys — compare does.)
CATEGORY_SUMMARY_FEATURES['MAE-DEF'] = CATEGORY_SUMMARY_FEATURES['MAE'];
CATEGORY_SUMMARY_FEATURES['MAE-DEF-P'] = CATEGORY_SUMMARY_FEATURES['MAE'];

export { CATEGORY_SUMMARY_FEATURES };
