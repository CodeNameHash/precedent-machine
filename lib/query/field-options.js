// GENERATED presentation map — per-provision-type field options for the
// query builder's dependent field dropdown (Ben r6: the second control
// offers the fields that exist for the selected provision type, instead of
// a free-text "field path" input). Client-safe on purpose: the real
// registry (lib/rubric.js via lib/query/types.js) is Node-oriented and too
// heavy for client bundles. tests/query-field-options.test.js regenerates
// this map from the registry and fails if this file drifts — regenerate by
// running that test's printed command.
const FIELD_OPTIONS_BY_PROVISION_TYPE = {
  "CONSIDERATION": [
    {
      "key": "parachuteCap",
      "label": "280G Parachute Cap Applies"
    },
    {
      "key": "appraisalRightsAvailable",
      "label": "Appraisal Rights Available"
    },
    {
      "key": "cashOutAmount",
      "label": "Cash-Out Calculation"
    },
    {
      "key": "collar",
      "label": "Collar"
    },
    {
      "key": "considerationType",
      "label": "Consideration Type"
    },
    {
      "key": "cutoffDate",
      "label": "Cutoff Date"
    },
    {
      "key": "dividendEquivalence",
      "label": "Dividend Equivalence"
    },
    {
      "key": "doubleTrigger",
      "label": "Double Trigger Required"
    },
    {
      "key": "equityAwardTreatment",
      "label": "Equity Award Treatment Summary"
    },
    {
      "key": "espp_treatment",
      "label": "ESPP Treatment"
    },
    {
      "key": "exchangeRatio",
      "label": "Exchange Ratio"
    },
    {
      "key": "exchangeRatioText",
      "label": "Exchange Ratio Formula"
    },
    {
      "key": "exchangeRatioType",
      "label": "Exchange Ratio Type"
    },
    {
      "key": "instrumentType",
      "label": "Instrument Type"
    },
    {
      "key": "optionSpread",
      "label": "Option Spread Calculation"
    },
    {
      "key": "optionsCvrEarnIn",
      "label": "Options earn-in via CVR"
    },
    {
      "key": "outstandingCount",
      "label": "Outstanding Count"
    },
    {
      "key": "outstandingInstruments",
      "label": "Outstanding Instruments"
    },
    {
      "key": "perShareAmount",
      "label": "Per Share Cash Amount"
    },
    {
      "key": "cutoffTreatment",
      "label": "Pre/Post-Cutoff Treatment"
    },
    {
      "key": "prorationMechanics",
      "label": "Proration Mechanics"
    },
    {
      "key": "proration",
      "label": "Proration Mechanism"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "performanceTreatment",
      "label": "PSU Performance Treatment"
    },
    {
      "key": "taxReorgIntended",
      "label": "Section 368(a) Reorganization Intended"
    },
    {
      "key": "taxReorgText",
      "label": "Section 368(a) Reorganization Text"
    },
    {
      "key": "instrumentTreatments",
      "label": "Treatment per Instrument"
    },
    {
      "key": "vestingAcceleration",
      "label": "Vesting Acceleration"
    },
    {
      "key": "instrumentVesting",
      "label": "Vesting per Instrument"
    },
    {
      "key": "walkAwayRight",
      "label": "Walk-Away Right"
    },
    {
      "key": "withholdingProvision",
      "label": "Withholding Provision Included"
    }
  ],
  "REPRESENTATION": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type"
    },
    {
      "key": "antiRelianceRepText",
      "label": "Anti-Reliance rep — verbatim language"
    },
    {
      "key": "antiRelianceRepPresent",
      "label": "Anti-Reliance rep present"
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard"
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep"
    },
    {
      "key": "financingRepIncluded",
      "label": "Financing / Sufficient Funds Rep Included"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope"
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs"
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope"
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer"
    },
    {
      "key": "parentBrokersRepPresent",
      "label": "Parent brokers / finders rep present"
    },
    {
      "key": "parentLitigationRepPresent",
      "label": "Parent litigation rep present"
    },
    {
      "key": "parentOwnershipRepPresent",
      "label": "Parent ownership rep present"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope"
    },
    {
      "key": "solvencyRepDetails",
      "label": "Solvency rep — verbatim language"
    },
    {
      "key": "solvencyRepPresent",
      "label": "Solvency rep present"
    },
    {
      "key": "solvencyRepIncluded",
      "label": "Solvency Representation Included"
    },
    {
      "key": "sufficientFundsRepDetails",
      "label": "Sufficient Funds rep — verbatim language"
    },
    {
      "key": "sufficientFundsRepPresent",
      "label": "Sufficient Funds rep present"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement"
    }
  ],
  "MATERIAL_CONTRACT": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type"
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard"
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope"
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs"
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope"
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement"
    }
  ],
  "CLOSING_CONDITION": [
    {
      "key": "absenceOfEnjoiningOrderDetails",
      "label": "Absence-of-enjoining-order — verbatim language"
    },
    {
      "key": "absenceOfEnjoiningOrderPresent",
      "label": "Absence-of-enjoining-order condition present"
    },
    {
      "key": "antitrustApprovals",
      "label": "Antitrust approvals — tagged items from ANTITRUST_APPROVAL_CODES (HSR / SCHEDULED_APPROVALS), one per approval type actually present"
    },
    {
      "key": "bringDownTiers",
      "label": "Bring-Down Tiers — array of { reps_covered, standard, standard_label, exceptions? } objects, one per tier. Use a single-element array if the bring-down is uniform."
    },
    {
      "key": "burdensomeConditionPresent",
      "label": "Burdensome Condition present"
    },
    {
      "key": "burdensomeConditionScope",
      "label": "Burdensome Condition scope"
    },
    {
      "key": "citedProvisionNames",
      "label": "Cited provisions resolved to names — [{ section, name }]"
    },
    {
      "key": "closingTimingProvisions",
      "label": "Closing timing provisions"
    },
    {
      "key": "dissentingSharesThreshold",
      "label": "Dissenting Shares Threshold"
    },
    {
      "key": "dollarThreshold",
      "label": "Dollar Threshold"
    },
    {
      "key": "fundsCondition",
      "label": "Funds Availability as Condition"
    },
    {
      "key": "governmentProceedingConditionPresent",
      "label": "Government proceeding closing condition present"
    },
    {
      "key": "hsrClearance",
      "label": "HSR clearance is a closing condition"
    },
    {
      "key": "maeConditionStandalone",
      "label": "MAE as Standalone Condition"
    },
    {
      "key": "mainCondition",
      "label": "Main Condition"
    },
    {
      "key": "mutualClosingDeadlineAfterConditionsDays",
      "label": "Mutual closing deadline after conditions satisfied"
    },
    {
      "key": "continuingRequirement",
      "label": "No-MAE condition requires the MAE to be continuing"
    },
    {
      "key": "certificationRequired",
      "label": "Officer Certification Required"
    },
    {
      "key": "regulatoryApprovals",
      "label": "Required regulatory approvals"
    },
    {
      "key": "scheduleReference",
      "label": "Schedule Reference"
    },
    {
      "key": "stockholderApprovalRequired",
      "label": "Stockholder approval is a closing condition"
    },
    {
      "key": "approvalDefinition",
      "label": "Stockholder-approval definition"
    },
    {
      "key": "tenderOfferMinimumCondition",
      "label": "Tender-offer minimum condition"
    }
  ],
  "COVENANT_INTERIM_OPERATING": [
    {
      "key": "affirmativeLimbs",
      "label": "Affirmative Limbs — for the consolidated \"Affirmative Covenants\" provision: each limb of the preamble (ordinary course / preserve relationships / maintain assets) as a structured entry { obligation_code, obligation_label, text, efforts_standard }."
    },
    {
      "key": "benefitPlanRestrictions",
      "label": "Benefit-plan restrictions"
    },
    {
      "key": "bonusIncreaseExceptions",
      "label": "Bonus-increase exceptions"
    },
    {
      "key": "consentStandard",
      "label": "Consent Standard"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "dollarThreshold",
      "label": "Dollar Threshold"
    },
    {
      "key": "effortsStandard",
      "label": "Efforts Standard"
    },
    {
      "key": "equityAwardRestrictions",
      "label": "Equity-award restrictions"
    },
    {
      "key": "interimNewContractsScope",
      "label": "Interim new-contracts restriction scope"
    },
    {
      "key": "interimSettlementCap",
      "label": "Interim settlement cap"
    },
    {
      "key": "party_role",
      "label": "IOC covenant party role — grammatical covenanting party such as COMPANY, PARENT, COLUMBUS, CABOT, SPINCO, REMAINCO, JV"
    },
    {
      "key": "leadInAllowsActionAfterNoResponse",
      "label": "Lead-in allows action after Parent non-response"
    },
    {
      "key": "leadInPeriodDays",
      "label": "Lead-in period"
    },
    {
      "key": "mainObligation",
      "label": "Main Obligation"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier"
    },
    {
      "key": "newHireExceptions",
      "label": "New-hire exceptions"
    },
    {
      "key": "ordinaryCourseCarveout",
      "label": "Ordinary Course Carve-out"
    },
    {
      "key": "pandemicCarveout",
      "label": "Pandemic / COVID Carve-out"
    },
    {
      "key": "parentBuyerIocBuckets",
      "label": "Parent / Buyer IOC buckets — categories list"
    },
    {
      "key": "dollarThresholdsByCategory",
      "label": "Per-category dollar thresholds — list of tagged items { code, label, text, threshold } drawn from IOC_CATEGORY_CODES"
    },
    {
      "key": "permittedExceptions",
      "label": "Permitted Exceptions specific to THIS sub-clause — ONLY include text that genuinely begins with \"except\", \"other than\", \"provided that\", or \"notwithstanding\". Do NOT include every sub-clause. Do NOT include section-wide carve-outs (those live on the preamble)."
    },
    {
      "key": "positiveObligations",
      "label": "Positive Obligations (limbs) — discrete affirmative duties stated in the IOC preamble. Each limb is an object { obligation, efforts_standard, appliesTo, includedObligations? } with efforts_standard as the SOLE standard (FLAT when unqualified)."
    },
    {
      "key": "requiredByLawCarveout",
      "label": "Required by Law Carve-out"
    },
    {
      "key": "restrictionComponents",
      "label": "Restriction Components — canonical IOC_CATEGORY_CODES tags this sub-clause restricts"
    },
    {
      "key": "retentionBonusRestrictions",
      "label": "Retention-bonus restrictions"
    },
    {
      "key": "salaryIncreaseExceptions",
      "label": "Salary-increase exceptions"
    },
    {
      "key": "scheduleReference",
      "label": "Schedule Reference (e.g. \"Section 4.1 of the Company Disclosure Letter\") — applies to the whole IOC section"
    },
    {
      "key": "interimSettlementNonPaymentExcluded",
      "label": "Settlement cap excludes non-payment relief"
    }
  ],
  "COVENANT_NO_SOLICITATION": [
    {
      "key": "acceptableConfidentialityAgreementDefinition",
      "label": "Acceptable Confidentiality Agreement — definition"
    },
    {
      "key": "acquisitionTransactionPctThreshold",
      "label": "Acquisition Proposal % threshold"
    },
    {
      "key": "acquisitionTransactionDefinition",
      "label": "Acquisition Proposal definition"
    },
    {
      "key": "antiClubbingWaiverConditions",
      "label": "Anti-clubbing waiver — conditions text"
    },
    {
      "key": "antiClubbingWaiverPermitted",
      "label": "Anti-clubbing waiver permitted"
    },
    {
      "key": "arcReaffirmDeadlineDays",
      "label": "ARC re-affirmation deadline (business days) — for \"fail to publicly recommend against ... within X days\" sub-item"
    },
    {
      "key": "boardChangeStandard",
      "label": "Board change standard"
    },
    {
      "key": "boardChangeForInterveningEvent",
      "label": "Board may change recommendation for intervening event"
    },
    {
      "key": "boardChangeForSuperiorProposal",
      "label": "Board may change recommendation for superior proposal"
    },
    {
      "key": "ceaseDiscussionsExceptions",
      "label": "Cease-discussions exceptions"
    },
    {
      "key": "changeRecStandard",
      "label": "Change-of-recommendation standard verbatim text"
    },
    {
      "key": "companyTerminationForSuperior",
      "label": "Company may terminate for superior proposal"
    },
    {
      "key": "companyTerminationForSuperiorConditions",
      "label": "Company-terminate-for-superior — conditions text"
    },
    {
      "key": "confidentialityRequired",
      "label": "Confidentiality Agreement Required for Information Access"
    },
    {
      "key": "discussionInitiationNoticeText",
      "label": "Discussion-initiation notice — verbatim language"
    },
    {
      "key": "discussionInitiationNoticeHours",
      "label": "Discussion-initiation notice deadline"
    },
    {
      "key": "discussionInitiationNoticePresent",
      "label": "Discussion-initiation notice present"
    },
    {
      "key": "dontAskDontWaive",
      "label": "Don't-Ask-Don't-Waive Provision"
    },
    {
      "key": "engagementStandard",
      "label": "Engagement standard verbatim text"
    },
    {
      "key": "extendedNegotiatingPeriodDays",
      "label": "Extended go-shop negotiating window"
    },
    {
      "key": "fiduciaryCarveoutThreshold",
      "label": "Fiduciary Carve-Out Threshold"
    },
    {
      "key": "fiduciaryEngageStandard",
      "label": "Fiduciary Out — Engagement Standard"
    },
    {
      "key": "fiduciaryFinalStandard",
      "label": "Fiduciary Out — Final Determination Standard"
    },
    {
      "key": "fiduciaryOutStandard",
      "label": "Fiduciary Out Standard"
    },
    {
      "key": "forceTheVote",
      "label": "Force the Vote"
    },
    {
      "key": "forceTheVoteType",
      "label": "Force the Vote — strength code"
    },
    {
      "key": "forceTheVoteDetails",
      "label": "Force the Vote — verbatim language and any exceptions"
    },
    {
      "key": "goShopExcludedParties",
      "label": "Go-shop excluded parties"
    },
    {
      "key": "goShopPeriodDays",
      "label": "Go-shop period"
    },
    {
      "key": "goShopPresent",
      "label": "Go-shop present"
    },
    {
      "key": "goShopWindow",
      "label": "Go-Shop Window"
    },
    {
      "key": "informationRights",
      "label": "Information Rights"
    },
    {
      "key": "informationSharingObligationPresent",
      "label": "Information-sharing / equal-info duty present"
    },
    {
      "key": "informationSharingObligationScope",
      "label": "Information-sharing scope"
    },
    {
      "key": "informationSharingObligationTiming",
      "label": "Information-sharing timing"
    },
    {
      "key": "initialMatchPeriodDays",
      "label": "Initial match period"
    },
    {
      "key": "interveningEventTermination",
      "label": "Intervening Event — does termination right exist for Intervening Event (vs. just recommendation change)? Capture standard + carve-outs."
    },
    {
      "key": "interveningEventDefinition",
      "label": "Intervening Event definition"
    },
    {
      "key": "interveningEventProvision",
      "label": "Intervening Event Provision Exists"
    },
    {
      "key": "interveningEventScope",
      "label": "Intervening Event scope"
    },
    {
      "key": "legallyRequiredDisclosurePermitted",
      "label": "Legally-required-disclosure carve-out permitted"
    },
    {
      "key": "ceaseDiscussionsLiability",
      "label": "Liability for representative breach"
    },
    {
      "key": "matchingPeriod",
      "label": "Matching Period"
    },
    {
      "key": "materialImprovementStandard",
      "label": "Material-improvement standard for re-triggering match"
    },
    {
      "key": "noConflictingAgreementsPresent",
      "label": "No-conflicting-agreements duty present"
    },
    {
      "key": "noConflictingAgreementsScope",
      "label": "No-conflicting-agreements scope"
    },
    {
      "key": "noticeContent",
      "label": "Notice Content to Existing Buyer"
    },
    {
      "key": "infoRequiredBidderIdentity",
      "label": "Notice must disclose bidder identity"
    },
    {
      "key": "infoRequiredCommunicationsDrafts",
      "label": "Notice must share communications / drafts"
    },
    {
      "key": "infoRequiredFinancingPapers",
      "label": "Notice must share financing papers"
    },
    {
      "key": "noticePeriod",
      "label": "Notice Period"
    },
    {
      "key": "parentTerminationRightForNonsolicitBreach",
      "label": "Parent termination right for nonsolicit breach"
    },
    {
      "key": "ceaseDiscussionsProhibitedList",
      "label": "Prohibited acts during cease-discussions period"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "representativeBreachIsCompanyBreach",
      "label": "Representative breach is treated as company breach"
    },
    {
      "key": "representativeBreachConditions",
      "label": "Representative-breach — conditions text"
    },
    {
      "key": "representativesStandard",
      "label": "Representatives standard"
    },
    {
      "key": "safeDisclosureCarveoutLanguage",
      "label": "Safe-disclosure carve-out — verbatim language"
    },
    {
      "key": "ceaseDiscussionsAffiliateStandard",
      "label": "Standard for affiliates / representatives"
    },
    {
      "key": "standstillWaiverConditions",
      "label": "Standstill waiver — conditions text"
    },
    {
      "key": "standstillWaiverPermitted",
      "label": "Standstill waiver permitted"
    },
    {
      "key": "standstillWaiver",
      "label": "Standstill Waiver Permitted"
    },
    {
      "key": "subsequentMatchPeriodDays",
      "label": "Subsequent match period"
    },
    {
      "key": "subsequentMatching",
      "label": "Subsequent Matching on Amendments"
    },
    {
      "key": "subsequentMatchingPeriod",
      "label": "Subsequent Matching Period"
    },
    {
      "key": "superiorProposalThresholdPct",
      "label": "Superior Proposal % threshold"
    },
    {
      "key": "superiorProposalDeterminer",
      "label": "Superior Proposal determiner"
    },
    {
      "key": "superiorProposalPercentage",
      "label": "Superior Proposal Percentage Threshold"
    },
    {
      "key": "superiorProposalTest",
      "label": "Superior Proposal test"
    },
    {
      "key": "tenderOfferDisclosurePermitted",
      "label": "Tender-offer disclosure (Rule 14d-9 \"stop, look and listen\") permitted without triggering ARC"
    },
    {
      "key": "tenderOfferDisclosureScope",
      "label": "Tender-offer disclosure scope"
    },
    {
      "key": "changeOfRecommendationItems",
      "label": "What constitutes a Change of Recommendation"
    },
    {
      "key": "notChangeOfRecommendationItems",
      "label": "What does NOT constitute a Change of Recommendation"
    }
  ],
  "COVENANT_OTHER": [
    {
      "key": "accessScope",
      "label": "Access Scope"
    },
    {
      "key": "accessPurposeLimitation",
      "label": "Access scope — purpose limitation"
    },
    {
      "key": "covenantComplianceStandard",
      "label": "Covenant compliance standard"
    },
    {
      "key": "cvrIncluded",
      "label": "CVR Agreement Included"
    },
    {
      "key": "indemnificationPeriod",
      "label": "D&O Indemnification Tail Period"
    },
    {
      "key": "employeeBenefitPeriod",
      "label": "Employee Benefit Continuation Period"
    },
    {
      "key": "financingCooperationScope",
      "label": "Financing cooperation — scope text"
    },
    {
      "key": "financingCooperationPresent",
      "label": "Financing cooperation present"
    },
    {
      "key": "financingCooperation",
      "label": "Financing Cooperation Required"
    },
    {
      "key": "financingCooperationBreachIsCondition",
      "label": "Financing-cooperation breach is closing condition"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "publicStatementsCarveoutCompany",
      "label": "Public statements carveout — Company"
    },
    {
      "key": "publicStatementsCarveoutParent",
      "label": "Public statements carveout — Parent"
    },
    {
      "key": "publicStatementsJointApproval",
      "label": "Public statements require joint approval"
    },
    {
      "key": "tsaContemplated",
      "label": "Transition Services Agreement contemplated"
    }
  ],
  "TERMINATION_RIGHT": [
    {
      "key": "closingTimingProvisions",
      "label": "Closing timing provisions visible at the termination page"
    },
    {
      "key": "extensionMutualOrUnilateral",
      "label": "Extension mode"
    },
    {
      "key": "extensionParty",
      "label": "Extension party"
    },
    {
      "key": "faultBasedExclusion",
      "label": "Fault-Based Exclusion"
    },
    {
      "key": "lawOrderTerminationScope",
      "label": "Law/Order termination — scope text"
    },
    {
      "key": "finalAndNonappealableRequired",
      "label": "Law/Order termination requires final & non-appealable"
    },
    {
      "key": "lawOrderTerminationPresent",
      "label": "Law/Order termination right present"
    },
    {
      "key": "lostPremiumDamagesConditions",
      "label": "Lost-premium damages — conditions text"
    },
    {
      "key": "marketOutHolder",
      "label": "Market-out / walkaway holder"
    },
    {
      "key": "extensionMaxExercises",
      "label": "Maximum extensions permitted"
    },
    {
      "key": "partyWhoCanTerminate",
      "label": "Party Who Can Terminate"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "lostPremiumDamagesPursuit",
      "label": "Right to pursue lost-premium damages"
    },
    {
      "key": "terminationCarveoutForOwnBreach",
      "label": "Termination carveout for own breach"
    },
    {
      "key": "terminationTriggers",
      "label": "Termination Triggers — the LIST of conditions that allow termination. Do NOT include exceptions / carve-outs to termination."
    }
  ],
  "TERMINATION_FEE": [
    {
      "key": "companyTerminationFee",
      "label": "Company Termination Fee"
    },
    {
      "key": "effectOfTermination",
      "label": "Effect of Termination"
    },
    {
      "key": "expenseReimbursement",
      "label": "Expense Reimbursement"
    },
    {
      "key": "expenseReimbursementCap",
      "label": "Expense Reimbursement Cap"
    },
    {
      "key": "feeAmount",
      "label": "Fee Amount"
    },
    {
      "key": "feePercentage",
      "label": "Fee as Percentage of Deal Value"
    },
    {
      "key": "feeSoleAndExclusiveRemedy",
      "label": "Fee is sole and exclusive remedy"
    },
    {
      "key": "soleAndExclusiveRemedy",
      "label": "Fee is Sole and Exclusive Remedy"
    },
    {
      "key": "soleRemedy",
      "label": "Fee is Sole and Exclusive Remedy"
    },
    {
      "key": "interestOnLatePayment",
      "label": "Interest on Late Payment"
    },
    {
      "key": "interestRateBasis",
      "label": "Interest-rate basis on late payment"
    },
    {
      "key": "nakedNoVoteFee",
      "label": "Naked No-Vote Fee"
    },
    {
      "key": "nakedNoVoteFeeAmount",
      "label": "Naked no-vote fee amount"
    },
    {
      "key": "nakedNoVoteFeePresent",
      "label": "Naked no-vote fee present"
    },
    {
      "key": "triggers",
      "label": "Per-trigger array — list of { code, name, terminationClauses, feeAmount, feeAmountPct }"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "remedyBarAfterFee",
      "label": "Remedy bar after fee paid"
    },
    {
      "key": "remedyScope",
      "label": "Remedy scope"
    },
    {
      "key": "reverseFeeAmount",
      "label": "Reverse Fee Amount"
    },
    {
      "key": "reverseFeePercentage",
      "label": "Reverse Fee as Percentage of Deal Value"
    },
    {
      "key": "reverseTerminationFee",
      "label": "Reverse Termination Fee"
    },
    {
      "key": "feeSoleRemedyExceptions",
      "label": "Sole-remedy exceptions"
    },
    {
      "key": "tailFeeSameProposalRequired",
      "label": "Tail fee — must consummated deal be with same third party that triggered the tail?"
    },
    {
      "key": "tailFeeTriggerConsummatedDuringTail",
      "label": "Tail fee trigger: alt consummated during tail"
    },
    {
      "key": "tailFeeTriggerAltAnnouncedDuringPendency",
      "label": "Tail fee trigger: alternative announced during pendency"
    },
    {
      "key": "tailFeeTriggerNakedNoVote",
      "label": "Tail fee trigger: naked no-vote"
    },
    {
      "key": "tailFeeTriggerEndDate",
      "label": "Tail fee trigger: termination at end date"
    },
    {
      "key": "tailFeeWindowMonths",
      "label": "Tail fee window"
    },
    {
      "key": "tailPeriod",
      "label": "Tail Period"
    },
    {
      "key": "tailProvision",
      "label": "Tail Provision"
    },
    {
      "key": "tailFeeActivatingClauses",
      "label": "Tail-fee activating termination clauses"
    },
    {
      "key": "tailFeeThresholdPct",
      "label": "Tail-fee Company Takeover Proposal % threshold"
    },
    {
      "key": "tailFeeRecognitionEvent",
      "label": "Tail-fee recognition event"
    },
    {
      "key": "feePctOfDealValue",
      "label": "Termination fee"
    },
    {
      "key": "terminationFeePercentEquityValue",
      "label": "Termination fee as % of equity value"
    },
    {
      "key": "terminationFees",
      "label": "Termination fees — list of { feeType, payableBy, payableTo, amount, percentEquityValue, triggers[], paymentDeadline, tail, soleRemedy, exceptions }"
    },
    {
      "key": "triggerEvents",
      "label": "Trigger Events"
    },
    {
      "key": "willfulBreachException",
      "label": "Willful Breach Carve-out to Sole Remedy"
    }
  ],
  "DEFINITION": [
    {
      "key": "acquisitionProposalPercentage",
      "label": "Acquisition Proposal Percentage Threshold"
    },
    {
      "key": "canonicalTerm",
      "label": "Canonical Term"
    },
    {
      "key": "carveOuts",
      "label": "Carve-Outs"
    },
    {
      "key": "nonDisproportionateImpactCarveouts",
      "label": "Carve-Outs NOT subject to disproportionate-impact carveback"
    },
    {
      "key": "disproportionateImpactCarveouts",
      "label": "Carve-Outs subject to disproportionate-impact carveback"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "cyberSecurityCarveout",
      "label": "Cybersecurity Incident MAE Carve-Out"
    },
    {
      "key": "definitionText",
      "label": "Definition Text"
    },
    {
      "key": "disproportionateImpactClause",
      "label": "Disproportionate Impact Clause"
    },
    {
      "key": "disproportionateImpact",
      "label": "Disproportionate Impact Qualifier"
    },
    {
      "key": "disproportionateImpactScope",
      "label": "Disproportionate Impact Scope"
    },
    {
      "key": "knowledgePersons",
      "label": "Knowledge Persons"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge Standard"
    },
    {
      "key": "carveouts",
      "label": "MAE Carve-Outs"
    },
    {
      "key": "carveOutsList",
      "label": "MAE Carve-Outs List"
    },
    {
      "key": "preventDelayProng",
      "label": "MAE includes a prevent-or-delay-closing prong"
    },
    {
      "key": "ordinaryCourseQualifier",
      "label": "Ordinary Course Qualifier"
    },
    {
      "key": "pandemicCarveout",
      "label": "Pandemic / COVID MAE Carve-Out"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "preventDelayRepsCovered",
      "label": "Reps covered by the prevent-or-delay prong"
    },
    {
      "key": "superiorProposalPercentage",
      "label": "Superior Proposal Percentage Threshold"
    },
    {
      "key": "willfulBreachDefinition",
      "label": "Willful Breach Defined"
    }
  ],
  "ANTITRUST_REGULATORY": [
    {
      "key": "burdenCommitment",
      "label": "Burden commitment"
    },
    {
      "key": "burdenBaseline",
      "label": "Burden measurement baseline"
    },
    {
      "key": "burdenCap",
      "label": "Burdensome Condition / Burden Cap"
    },
    {
      "key": "burdensomConditionDefined",
      "label": "Burdensome Condition Defined"
    },
    {
      "key": "burdensomeConditionInTerminationTriggers",
      "label": "Burdensome-condition concept as a termination trigger"
    },
    {
      "key": "capDetail",
      "label": "Cap detail"
    },
    {
      "key": "clearSkiesCompanyScope",
      "label": "Clear-skies (Company) — scope/limits text"
    },
    {
      "key": "clearSkiesParentScope",
      "label": "Clear-skies (Parent) — scope/limits text"
    },
    {
      "key": "clearSkies",
      "label": "Clear-skies by party"
    },
    {
      "key": "clearSkiesCompany",
      "label": "Clear-skies covenant on the Company side"
    },
    {
      "key": "clearSkiesParent",
      "label": "Clear-skies covenant on the Parent side"
    },
    {
      "key": "consultationTier",
      "label": "Consultation tier"
    },
    {
      "key": "divestitureCap",
      "label": "Divestiture Cap"
    },
    {
      "key": "divestitureCapDescription",
      "label": "Divestiture Cap Description"
    },
    {
      "key": "effortsStandardDiffersByRemedy",
      "label": "Efforts standard differs depending on remedy type"
    },
    {
      "key": "exHsrFilingDeadline",
      "label": "Ex-HSR filing deadline"
    },
    {
      "key": "foreignFilingsRequired",
      "label": "Foreign Regulatory Filings Required"
    },
    {
      "key": "hellOrHighWater",
      "label": "Hell-or-High-Water"
    },
    {
      "key": "hsrFilingDeadline",
      "label": "HSR filing deadline"
    },
    {
      "key": "hsrFilingDeadlineBusinessDays",
      "label": "HSR filing deadline"
    },
    {
      "key": "interimOperatingRestrictions",
      "label": "Interim Operating Restrictions During Review"
    },
    {
      "key": "litigationObligationQualification",
      "label": "Litigation obligation qualification"
    },
    {
      "key": "appliesToParty",
      "label": "No-Inconsistent-Action — Party Bound"
    },
    {
      "key": "litigationObligation",
      "label": "Obligation to Litigate Against Regulators"
    },
    {
      "key": "otherRegulatoryFilingDeadlines",
      "label": "Other regulatory filing deadlines"
    },
    {
      "key": "parentLitigationObligation",
      "label": "Parent has obligation to litigate against regulators"
    },
    {
      "key": "parentRemedyObligation",
      "label": "Parent remedy obligation"
    },
    {
      "key": "partyControlsStrategy",
      "label": "Party That Controls Regulatory Strategy"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "pullRefile",
      "label": "Pull-and-refile gating"
    },
    {
      "key": "pullAndRefileCompanyConsent",
      "label": "Pull-and-refile requires Company consent"
    },
    {
      "key": "pullAndRefileRight",
      "label": "Pull-and-Refile Right"
    },
    {
      "key": "pullRefileText",
      "label": "Pull-and-refile text"
    },
    {
      "key": "regulatoryClosingConditions",
      "label": "Regulatory closing conditions / required filings"
    },
    {
      "key": "regulatoryCooperationCarveout",
      "label": "Regulatory cooperation covenant carveout from closing conditionality"
    },
    {
      "key": "filingDeadline",
      "label": "Regulatory Filing Deadline"
    },
    {
      "key": "regulatoryCooperationScope",
      "label": "Regulatory information / cooperation covenant — scope"
    },
    {
      "key": "regulatoryStrategyControlTagged",
      "label": "Regulatory strategy control"
    },
    {
      "key": "regulatoryStrategyControl",
      "label": "Regulatory strategy control"
    },
    {
      "key": "springingRegulatoryConditions",
      "label": "Springing regulatory conditions"
    },
    {
      "key": "effortsStandard",
      "label": "Standard of Efforts"
    },
    {
      "key": "substantialComplianceDeadlineDays",
      "label": "Substantial compliance deadline"
    },
    {
      "key": "timingAgreement",
      "label": "Timing agreement restriction"
    },
    {
      "key": "timingAgreementText",
      "label": "Timing agreement text"
    },
    {
      "key": "timingAgreementsProhibited",
      "label": "Timing agreements with regulators prohibited"
    },
    {
      "key": "controllingParty",
      "label": "Who Controls Antitrust Strategy"
    }
  ],
  "SEC_FILING_MEETING": [],
  "EMPLOYEE_BENEFITS": [
    {
      "key": "parachuteCap",
      "label": "280G Parachute Cap Applies"
    },
    {
      "key": "appraisalRightsAvailable",
      "label": "Appraisal Rights Available"
    },
    {
      "key": "cashOutAmount",
      "label": "Cash-Out Calculation"
    },
    {
      "key": "collar",
      "label": "Collar"
    },
    {
      "key": "considerationType",
      "label": "Consideration Type"
    },
    {
      "key": "cutoffDate",
      "label": "Cutoff Date"
    },
    {
      "key": "dividendEquivalence",
      "label": "Dividend Equivalence"
    },
    {
      "key": "doubleTrigger",
      "label": "Double Trigger Required"
    },
    {
      "key": "equityAwardTreatment",
      "label": "Equity Award Treatment Summary"
    },
    {
      "key": "espp_treatment",
      "label": "ESPP Treatment"
    },
    {
      "key": "exchangeRatio",
      "label": "Exchange Ratio"
    },
    {
      "key": "exchangeRatioText",
      "label": "Exchange Ratio Formula"
    },
    {
      "key": "exchangeRatioType",
      "label": "Exchange Ratio Type"
    },
    {
      "key": "instrumentType",
      "label": "Instrument Type"
    },
    {
      "key": "optionSpread",
      "label": "Option Spread Calculation"
    },
    {
      "key": "optionsCvrEarnIn",
      "label": "Options earn-in via CVR"
    },
    {
      "key": "outstandingCount",
      "label": "Outstanding Count"
    },
    {
      "key": "outstandingInstruments",
      "label": "Outstanding Instruments"
    },
    {
      "key": "perShareAmount",
      "label": "Per Share Cash Amount"
    },
    {
      "key": "cutoffTreatment",
      "label": "Pre/Post-Cutoff Treatment"
    },
    {
      "key": "prorationMechanics",
      "label": "Proration Mechanics"
    },
    {
      "key": "proration",
      "label": "Proration Mechanism"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "performanceTreatment",
      "label": "PSU Performance Treatment"
    },
    {
      "key": "taxReorgIntended",
      "label": "Section 368(a) Reorganization Intended"
    },
    {
      "key": "taxReorgText",
      "label": "Section 368(a) Reorganization Text"
    },
    {
      "key": "instrumentTreatments",
      "label": "Treatment per Instrument"
    },
    {
      "key": "vestingAcceleration",
      "label": "Vesting Acceleration"
    },
    {
      "key": "instrumentVesting",
      "label": "Vesting per Instrument"
    },
    {
      "key": "walkAwayRight",
      "label": "Walk-Away Right"
    },
    {
      "key": "withholdingProvision",
      "label": "Withholding Provision Included"
    }
  ],
  "STRUCTURE_MECHANICS": [
    {
      "key": "adsVotingMechanics",
      "label": "ADS voting / surrender mechanics"
    },
    {
      "key": "adsPresent",
      "label": "American Depositary Shares present"
    },
    {
      "key": "shareholderApprovalMethodCompany",
      "label": "Company Shareholder Approval Method"
    },
    {
      "key": "dealStructure",
      "label": "Deal structure"
    },
    {
      "key": "effectiveTimeShort",
      "label": "Effective Time — one-sentence summary"
    },
    {
      "key": "effectsOfMergerReference",
      "label": "Effects of Merger — statute cited"
    },
    {
      "key": "mergerForm",
      "label": "Merger Form"
    },
    {
      "key": "shareholderApprovalMethodParent",
      "label": "Parent Shareholder Approval Method"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    }
  ],
  "MAE": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type"
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard"
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope"
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs"
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope"
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement"
    }
  ],
  "NO_OTHER_REPS": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type"
    },
    {
      "key": "antiRelianceRepText",
      "label": "Anti-Reliance rep — verbatim language"
    },
    {
      "key": "antiRelianceRepPresent",
      "label": "Anti-Reliance rep present"
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard"
    },
    {
      "key": "assignmentExceptions",
      "label": "Assignment exceptions"
    },
    {
      "key": "assignmentProvisos",
      "label": "Assignment provisos"
    },
    {
      "key": "assignmentRestrictions",
      "label": "Assignment restrictions"
    },
    {
      "key": "bondSecurityRequiredForSP",
      "label": "Bond / security required for specific performance"
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard"
    },
    {
      "key": "companyConsentForAssignment",
      "label": "Company consent required for assignment"
    },
    {
      "key": "companyRightToForceClose",
      "label": "Company right to force closing"
    },
    {
      "key": "companyForceCloseConditions",
      "label": "Company-force-close — conditions text"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep"
    },
    {
      "key": "jurisdictionExclusive",
      "label": "Exclusive Jurisdiction"
    },
    {
      "key": "feeExpenseAllocation",
      "label": "Fee / expense allocation"
    },
    {
      "key": "financingRepIncluded",
      "label": "Financing / Sufficient Funds Rep Included"
    },
    {
      "key": "forumCourts",
      "label": "Forum court(s) named"
    },
    {
      "key": "forumFallback",
      "label": "Forum fallback if the primary court lacks jurisdiction"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved"
    },
    {
      "key": "governingLaw",
      "label": "Governing Law Jurisdiction"
    },
    {
      "key": "juryWaiver",
      "label": "Jury Trial Waiver"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope"
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs"
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope"
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language"
    },
    {
      "key": "noExcusePostClosingPresent",
      "label": "No-excuse / no-recourse post-closing covenant present"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present"
    },
    {
      "key": "noSetoffPresent",
      "label": "No-setoff clause present"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer"
    },
    {
      "key": "noticesAddress",
      "label": "Notices Block (party + address + email + counsel cc) — verbatim"
    },
    {
      "key": "parentAssignmentConditions",
      "label": "Parent assignment — conditions text"
    },
    {
      "key": "parentBrokersRepPresent",
      "label": "Parent brokers / finders rep present"
    },
    {
      "key": "parentAssignmentRight",
      "label": "Parent has assignment right"
    },
    {
      "key": "parentLitigationRepPresent",
      "label": "Parent litigation rep present"
    },
    {
      "key": "parentOwnershipRepPresent",
      "label": "Parent ownership rep present"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE"
    },
    {
      "key": "repsSurvivalExceptions",
      "label": "Reps survival — exceptions text"
    },
    {
      "key": "repsSurvivalPresent",
      "label": "Reps survival clause present"
    },
    {
      "key": "repsSurvivalDuration",
      "label": "Reps survival duration"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope"
    },
    {
      "key": "solvencyRepDetails",
      "label": "Solvency rep — verbatim language"
    },
    {
      "key": "solvencyRepPresent",
      "label": "Solvency rep present"
    },
    {
      "key": "solvencyRepIncluded",
      "label": "Solvency Representation Included"
    },
    {
      "key": "specificPerformance",
      "label": "Specific Performance Available"
    },
    {
      "key": "specificPerformanceLimitations",
      "label": "Specific performance limitations"
    },
    {
      "key": "specificPerformanceMutual",
      "label": "Specific performance mutually available"
    },
    {
      "key": "sufficientFundsRepDetails",
      "label": "Sufficient Funds rep — verbatim language"
    },
    {
      "key": "sufficientFundsRepPresent",
      "label": "Sufficient Funds rep present"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period"
    },
    {
      "key": "terminationExceptionForBadBehavior",
      "label": "Termination exception for bad behavior"
    },
    {
      "key": "thirdPartyBeneficiaries",
      "label": "Third-Party Beneficiaries"
    },
    {
      "key": "thirdPartyBeneficiaryExceptions",
      "label": "Third-Party Beneficiary Exceptions"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement"
    },
    {
      "key": "willfulBreachCoversOmissions",
      "label": "Willful Breach covers omissions"
    },
    {
      "key": "willfulBreachDefinition",
      "label": "Willful Breach defined"
    },
    {
      "key": "willfulBreachLimitedToMaterial",
      "label": "Willful Breach limited to material breaches"
    },
    {
      "key": "willfulBreachRequiresActualKnowledge",
      "label": "Willful Breach requires actual knowledge"
    }
  ],
  "MISC_BOILERPLATE": [
    {
      "key": "assignmentExceptions",
      "label": "Assignment exceptions"
    },
    {
      "key": "assignmentProvisos",
      "label": "Assignment provisos"
    },
    {
      "key": "assignmentRestrictions",
      "label": "Assignment restrictions"
    },
    {
      "key": "bondSecurityRequiredForSP",
      "label": "Bond / security required for specific performance"
    },
    {
      "key": "companyConsentForAssignment",
      "label": "Company consent required for assignment"
    },
    {
      "key": "companyRightToForceClose",
      "label": "Company right to force closing"
    },
    {
      "key": "companyForceCloseConditions",
      "label": "Company-force-close — conditions text"
    },
    {
      "key": "crossReferences",
      "label": "Cross References"
    },
    {
      "key": "jurisdictionExclusive",
      "label": "Exclusive Jurisdiction"
    },
    {
      "key": "feeExpenseAllocation",
      "label": "Fee / expense allocation"
    },
    {
      "key": "forumCourts",
      "label": "Forum court(s) named"
    },
    {
      "key": "forumFallback",
      "label": "Forum fallback if the primary court lacks jurisdiction"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved"
    },
    {
      "key": "governingLaw",
      "label": "Governing Law Jurisdiction"
    },
    {
      "key": "juryWaiver",
      "label": "Jury Trial Waiver"
    },
    {
      "key": "noExcusePostClosingPresent",
      "label": "No-excuse / no-recourse post-closing covenant present"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present"
    },
    {
      "key": "noSetoffPresent",
      "label": "No-setoff clause present"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer"
    },
    {
      "key": "noticesAddress",
      "label": "Notices Block (party + address + email + counsel cc) — verbatim"
    },
    {
      "key": "parentAssignmentConditions",
      "label": "Parent assignment — conditions text"
    },
    {
      "key": "parentAssignmentRight",
      "label": "Parent has assignment right"
    },
    {
      "key": "mainConcept",
      "label": "Provision"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed"
    },
    {
      "key": "repsSurvivalExceptions",
      "label": "Reps survival — exceptions text"
    },
    {
      "key": "repsSurvivalPresent",
      "label": "Reps survival clause present"
    },
    {
      "key": "repsSurvivalDuration",
      "label": "Reps survival duration"
    },
    {
      "key": "sectionNumber",
      "label": "Section Number"
    },
    {
      "key": "sectionTitle",
      "label": "Section Title"
    },
    {
      "key": "specificPerformance",
      "label": "Specific Performance Available"
    },
    {
      "key": "specificPerformanceLimitations",
      "label": "Specific performance limitations"
    },
    {
      "key": "specificPerformanceMutual",
      "label": "Specific performance mutually available"
    },
    {
      "key": "summary",
      "label": "Summary"
    },
    {
      "key": "terminationExceptionForBadBehavior",
      "label": "Termination exception for bad behavior"
    },
    {
      "key": "thirdPartyBeneficiaries",
      "label": "Third-Party Beneficiaries"
    },
    {
      "key": "thirdPartyBeneficiaryExceptions",
      "label": "Third-Party Beneficiary Exceptions"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement"
    },
    {
      "key": "willfulBreachCoversOmissions",
      "label": "Willful Breach covers omissions"
    },
    {
      "key": "willfulBreachDefinition",
      "label": "Willful Breach defined"
    },
    {
      "key": "willfulBreachLimitedToMaterial",
      "label": "Willful Breach limited to material breaches"
    },
    {
      "key": "willfulBreachRequiresActualKnowledge",
      "label": "Willful Breach requires actual knowledge"
    }
  ]
};

module.exports = { FIELD_OPTIONS_BY_PROVISION_TYPE };
