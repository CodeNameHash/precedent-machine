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
    // Preserve existing Standard of Efforts + Burden Cap headline rows.
    { label: 'Standard of Efforts',                   keys: ['effortsStandard'] },
    { label: 'Burden Cap',                            keys: ['burdenCap', 'divestitureCap', 'divestitureCapDescription'] },
    // Strategy / filings
    { label: 'Regulatory Strategy Control',           keys: ['regulatoryStrategyControl', 'controllingParty'] },
    { label: 'HSR Filing Deadline (business days)',   keys: ['hsrFilingDeadlineBusinessDays'] },
    { label: 'Other Regulatory Filing Deadlines',     keys: ['otherRegulatoryFilingDeadlines', 'filingDeadline'] },
    { label: 'Substantial Compliance Deadline (days)', keys: ['substantialComplianceDeadlineDays'] },
    // Pull-and-refile + timing agreements
    { label: 'Pull-and-Refile — Company Consent Required', keys: ['pullAndRefileCompanyConsent'] },
    { label: 'Refile Cap Without Company Consent',    keys: ['refileCapWithoutConsent'] },
    { label: 'Timing Agreements Prohibited',          keys: ['timingAgreementsProhibited'] },
    // Clear-skies — P4 task 3 IOC fallback: when no standalone clear-skies
    // covenant is found, scan IOC provisions for acquisition / merger /
    // joint-venture / business-combination / asset-sale / new-line-of-business
    // / investment restrictions and render a summary chip list.
    {
      label: 'Clear-Skies — Company',
      keys: ['clearSkiesCompany'],
      customRenderKey: 'clearSkiesIocCompany',
    },
    { label: 'Clear-Skies — Company Scope',           keys: ['clearSkiesCompanyScope'] },
    {
      label: 'Clear-Skies — Parent',
      keys: ['clearSkiesParent'],
      customRenderKey: 'clearSkiesIocParent',
    },
    { label: 'Clear-Skies — Parent Scope',            keys: ['clearSkiesParentScope'] },
    // Remedy + litigation obligations
    // (P3 item 12: 'Parent Remedy Obligation' row removed — duplicated burdenCap)
    { label: 'Efforts Standard Differs by Remedy',    keys: ['effortsStandardDiffersByRemedy'] },
    { label: 'Parent Litigation Obligation',          keys: ['parentLitigationObligation', 'litigationObligation'] },
    // Burdensome condition rows (q82–q83)
    { label: 'Burdensome Condition Present (Closing Condition)', keys: ['burdensomeConditionPresent', 'burdensomConditionDefined'] },
    { label: 'Burdensome Condition Scope',            keys: ['burdensomeConditionScope'] },
    { label: 'Burdensome Condition in Termination Triggers', keys: ['burdensomeConditionInTerminationTriggers'] },
    // Law/orders termination right (mirrored from TERMR)
    { label: 'Law/Orders Termination Right Present',  keys: ['lawOrderTerminationPresent'] },
    { label: 'Law/Orders Termination Scope',          keys: ['lawOrderTerminationScope'] },
    { label: 'Final and Nonappealable Required',      keys: ['finalAndNonappealableRequired'] },
    { label: 'Terminating Party Breach Carveout',     keys: ['terminationCarveoutForOwnBreach'] },
    // Cooperation / filings
    { label: 'Regulatory Closing Conditions / Required Filings', keys: ['foreignFilingsRequired', 'regulatoryClosingConditions'] },
    { label: 'Springing Regulatory Conditions',       keys: ['springingRegulatoryConditions'] },
    { label: 'Regulatory Info / Cooperation Covenant Scope', keys: ['regulatoryCooperationScope', 'controllingParty'] },
    { label: 'Regulatory Cooperation Covenant Carveout', keys: ['regulatoryCooperationCarveout'] },
  ],

  // ─── TERMR — Paul Weiss diligence checklist q83–q99 ─────────────────────
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
    { label: 'Government Proceeding Closing Condition Present', keys: ['governmentProceedingConditionPresent'] },
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
    { label: 'Tender Offer Minimum Condition',        keys: ['tenderOfferMinimumCondition'] },
    { label: 'Vote Threshold',                        keys: ['voteThreshold'] },
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
    { label: 'Tail Period (months)',                  keys: ['tailPeriod'] },
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
    { label: 'Public Statements — Parent Recommendation Carveout', keys: ['publicStatementsCarveoutParent'] },
    { label: 'Public Statements — Company Carveout',  keys: ['publicStatementsCarveoutCompany'] },
    { label: 'Public Statements — Joint Approval',    keys: ['publicStatementsJointApproval'] },
    { label: 'Covenant Compliance Closing Standard',  keys: ['covenantComplianceStandard'] },
    { label: 'D&O Insurance Cap',                     keys: ['insuranceCap'] },
    { label: 'D&O Indemnification Tail Period',       keys: ['indemnificationPeriod'] },
    { label: 'D&O Advancement of Expenses',           keys: ['advancementOfExpenses'] },
    { label: 'D&O Notification Consequences',         keys: ['notificationConsequences'] },
    { label: 'Employee Benefit Continuation Period',  keys: ['employeeBenefitPeriod'] },
    { label: 'CVR Agreement Included',                keys: ['cvrIncluded'] },
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
    { label: 'Severability',               keys: ['severability'] },
    { label: 'Counterparts / Electronic',  keys: ['counterparts'] },
    // PW q163–q184 additions
    { label: 'Termination Exception for Bad Behavior', keys: ['terminationExceptionForBadBehavior'] },
    { label: 'Lost Premium Damages Pursuit', keys: ['lostPremiumDamagesPursuit'] },
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
    { label: 'Reps Survival Present',      keys: ['repsSurvivalPresent'] },
    { label: 'Reps Survival Duration',     keys: ['repsSurvivalDuration'] },
    { label: 'Reps Survival Exceptions',   keys: ['repsSurvivalExceptions'] },
    { label: 'Parent Assignment Right',    keys: ['parentAssignmentRight'] },
    { label: 'Parent Assignment Conditions', keys: ['parentAssignmentConditions'] },
    { label: 'Company Consent for Assignment', keys: ['companyConsentForAssignment'] },
    { label: 'Assignment Exceptions',      keys: ['assignmentExceptions'] },
    { label: 'Assignment Restrictions',    keys: ['assignmentRestrictions'] },
    { label: 'No Excuse Post-Closing Present', keys: ['noExcusePostClosingPresent'] },
    { label: 'No Setoff Present',          keys: ['noSetoffPresent'] },
  ],
};

// Aliases so the dispatcher can pass the parent-type spec for sub-codes.
CATEGORY_SUMMARY_FEATURES['COND'] = CATEGORY_SUMMARY_FEATURES['COND-M'];
CATEGORY_SUMMARY_FEATURES['IOC-T'] = CATEGORY_SUMMARY_FEATURES['IOC'];
CATEGORY_SUMMARY_FEATURES['IOC-B'] = CATEGORY_SUMMARY_FEATURES['IOC'];
CATEGORY_SUMMARY_FEATURES['TERMR-M'] = CATEGORY_SUMMARY_FEATURES['TERMR'];
CATEGORY_SUMMARY_FEATURES['TERMR-B'] = CATEGORY_SUMMARY_FEATURES['TERMR'];
CATEGORY_SUMMARY_FEATURES['TERMR-T'] = CATEGORY_SUMMARY_FEATURES['TERMR'];

export { CATEGORY_SUMMARY_FEATURES };
