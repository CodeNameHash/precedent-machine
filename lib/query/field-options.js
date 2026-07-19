// GENERATED presentation map — per-provision-type field options for the
// query builder's dependent field dropdown, with each field's registry
// value type and (for enums) its option slugs so the value control can be
// a real dropdown instead of free text (Ben r6/r7). Client-safe on
// purpose: the real registry (lib/rubric.js via lib/query/types.js) is
// Node-oriented and too heavy for client bundles.
// tests/query-field-options.test.js regenerates this map from the registry
// and fails if this file drifts.
const FIELD_OPTIONS_BY_PROVISION_TYPE = {
  "CONSIDERATION": [
    {
      "key": "parachuteCap",
      "label": "280G Parachute Cap Applies",
      "type": "boolean"
    },
    {
      "key": "appraisalRightsAvailable",
      "label": "Appraisal Rights Available",
      "type": "boolean"
    },
    {
      "key": "cashOutAmount",
      "label": "Cash-Out Calculation",
      "type": "text"
    },
    {
      "key": "collar",
      "label": "Collar",
      "type": "object"
    },
    {
      "key": "considerationType",
      "label": "Consideration Type",
      "type": "enum",
      "options": [
        "all-cash",
        "all-stock",
        "mixed-cash-and-stock",
        "cash-with-cvr"
      ]
    },
    {
      "key": "cutoffDate",
      "label": "Cutoff Date",
      "type": "text"
    },
    {
      "key": "dividendEquivalence",
      "label": "Dividend Equivalence",
      "type": "text"
    },
    {
      "key": "doubleTrigger",
      "label": "Double Trigger Required",
      "type": "boolean"
    },
    {
      "key": "equityAwardTreatment",
      "label": "Equity Award Treatment Summary",
      "type": "object"
    },
    {
      "key": "espp_treatment",
      "label": "ESPP Treatment",
      "type": "text"
    },
    {
      "key": "exchangeRatio",
      "label": "Exchange Ratio",
      "type": "text"
    },
    {
      "key": "exchangeRatioText",
      "label": "Exchange Ratio Formula",
      "type": "text"
    },
    {
      "key": "exchangeRatioType",
      "label": "Exchange Ratio Type",
      "type": "enum",
      "options": [
        "FIXED",
        "FLOATING"
      ]
    },
    {
      "key": "instrumentType",
      "label": "Instrument Type",
      "type": "tagged"
    },
    {
      "key": "optionSpread",
      "label": "Option Spread Calculation",
      "type": "text"
    },
    {
      "key": "optionsCvrEarnIn",
      "label": "Options earn-in via CVR",
      "type": "enum",
      "options": [
        "EARN_IN_ELIGIBLE",
        "MUST_BE_ITM",
        "NOT_SPECIFIED"
      ]
    },
    {
      "key": "outstandingCount",
      "label": "Outstanding Count",
      "type": "text"
    },
    {
      "key": "outstandingInstruments",
      "label": "Outstanding Instruments",
      "type": "list-tagged"
    },
    {
      "key": "perShareAmount",
      "label": "Per Share Cash Amount",
      "type": "currency"
    },
    {
      "key": "cutoffTreatment",
      "label": "Pre/Post-Cutoff Treatment",
      "type": "text"
    },
    {
      "key": "prorationMechanics",
      "label": "Proration Mechanics",
      "type": "object"
    },
    {
      "key": "proration",
      "label": "Proration Mechanism",
      "type": "boolean"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "performanceTreatment",
      "label": "PSU Performance Treatment",
      "type": "text"
    },
    {
      "key": "taxReorgIntended",
      "label": "Section 368(a) Reorganization Intended",
      "type": "boolean"
    },
    {
      "key": "taxReorgText",
      "label": "Section 368(a) Reorganization Text",
      "type": "text"
    },
    {
      "key": "instrumentTreatments",
      "label": "Treatment per Instrument",
      "type": "list-tagged"
    },
    {
      "key": "vestingAcceleration",
      "label": "Vesting Acceleration",
      "type": "tagged"
    },
    {
      "key": "instrumentVesting",
      "label": "Vesting per Instrument",
      "type": "list-tagged"
    },
    {
      "key": "walkAwayRight",
      "label": "Walk-Away Right",
      "type": "object"
    },
    {
      "key": "withholdingProvision",
      "label": "Withholding Provision Included",
      "type": "boolean"
    }
  ],
  "REPRESENTATION": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions",
      "type": "list-tagged"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date",
      "type": "text"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type",
      "type": "enum",
      "options": [
        "SPECIFIED_IOCS",
        "GENERAL_ORDINARY_COURSE",
        "HYBRID"
      ]
    },
    {
      "key": "antiRelianceRepText",
      "label": "Anti-Reliance rep — verbatim language",
      "type": "text"
    },
    {
      "key": "antiRelianceRepPresent",
      "label": "Anti-Reliance rep present",
      "type": "boolean"
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present",
      "type": "boolean"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date",
      "type": "text"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names",
      "type": "list"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb",
      "type": "list"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb",
      "type": "text"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard",
      "type": "enum",
      "options": [
        "all-respects",
        "material-respects",
        "MAE-standard",
        "de-minimis"
      ]
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard",
      "type": "tagged"
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep",
      "type": "text"
    },
    {
      "key": "financingRepIncluded",
      "label": "Financing / Sufficient Funds Rep Included",
      "type": "boolean"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved",
      "type": "text"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition",
      "type": "text"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used",
      "type": "object"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard",
      "type": "tagged"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period",
      "type": "text"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs",
      "type": "enum",
      "options": [
        "ONE_LIMB",
        "TWO_LIMB"
      ]
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }",
      "type": "list"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets",
      "type": "list-tagged"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier",
      "type": "object"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape",
      "type": "boolean"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level",
      "type": "boolean"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language",
      "type": "text"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present",
      "type": "boolean"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer",
      "type": "text"
    },
    {
      "key": "parentBrokersRepPresent",
      "label": "Parent brokers / finders rep present",
      "type": "boolean"
    },
    {
      "key": "parentLitigationRepPresent",
      "label": "Parent litigation rep present",
      "type": "boolean"
    },
    {
      "key": "parentOwnershipRepPresent",
      "label": "Parent ownership rep present",
      "type": "boolean"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition",
      "type": "text"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted",
      "type": "boolean"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed",
      "type": "boolean"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception",
      "type": "list"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules",
      "type": "list"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections",
      "type": "list"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back",
      "type": "duration"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope",
      "type": "text"
    },
    {
      "key": "solvencyRepDetails",
      "label": "Solvency rep — verbatim language",
      "type": "text"
    },
    {
      "key": "solvencyRepPresent",
      "label": "Solvency rep present",
      "type": "boolean"
    },
    {
      "key": "solvencyRepIncluded",
      "label": "Solvency Representation Included",
      "type": "boolean"
    },
    {
      "key": "sufficientFundsRepDetails",
      "label": "Sufficient Funds rep — verbatim language",
      "type": "text"
    },
    {
      "key": "sufficientFundsRepPresent",
      "label": "Sufficient Funds rep present",
      "type": "boolean"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period",
      "type": "duration"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition",
      "type": "text"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present",
      "type": "boolean"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions",
      "type": "list-tagged"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement",
      "type": "enum",
      "options": [
        "COMPANY",
        "PARENT",
        "BOTH"
      ]
    }
  ],
  "MATERIAL_CONTRACT": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions",
      "type": "list-tagged"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date",
      "type": "text"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type",
      "type": "enum",
      "options": [
        "SPECIFIED_IOCS",
        "GENERAL_ORDINARY_COURSE",
        "HYBRID"
      ]
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present",
      "type": "boolean"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date",
      "type": "text"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names",
      "type": "list"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb",
      "type": "list"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb",
      "type": "text"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard",
      "type": "enum",
      "options": [
        "all-respects",
        "material-respects",
        "MAE-standard",
        "de-minimis"
      ]
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard",
      "type": "tagged"
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep",
      "type": "text"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved",
      "type": "text"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition",
      "type": "text"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used",
      "type": "object"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard",
      "type": "tagged"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period",
      "type": "text"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs",
      "type": "enum",
      "options": [
        "ONE_LIMB",
        "TWO_LIMB"
      ]
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }",
      "type": "list"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets",
      "type": "list-tagged"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier",
      "type": "object"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape",
      "type": "boolean"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level",
      "type": "boolean"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language",
      "type": "text"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present",
      "type": "boolean"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer",
      "type": "text"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition",
      "type": "text"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted",
      "type": "boolean"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed",
      "type": "boolean"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception",
      "type": "list"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules",
      "type": "list"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections",
      "type": "list"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back",
      "type": "duration"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope",
      "type": "text"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period",
      "type": "duration"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition",
      "type": "text"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present",
      "type": "boolean"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions",
      "type": "list-tagged"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement",
      "type": "enum",
      "options": [
        "COMPANY",
        "PARENT",
        "BOTH"
      ]
    }
  ],
  "CLOSING_CONDITION": [
    {
      "key": "absenceOfEnjoiningOrderDetails",
      "label": "Absence-of-enjoining-order — verbatim language",
      "type": "text"
    },
    {
      "key": "absenceOfEnjoiningOrderPresent",
      "label": "Absence-of-enjoining-order condition present",
      "type": "boolean"
    },
    {
      "key": "antitrustApprovals",
      "label": "Antitrust approvals — tagged items from ANTITRUST_APPROVAL_CODES (HSR / SCHEDULED_APPROVALS), one per approval type actually present",
      "type": "list-tagged"
    },
    {
      "key": "bringDownTiers",
      "label": "Bring-Down Tiers — array of { reps_covered, standard, standard_label, exceptions? } objects, one per tier. Use a single-element array if the bring-down is uniform.",
      "type": "tiers"
    },
    {
      "key": "burdensomeConditionPresent",
      "label": "Burdensome Condition present",
      "type": "boolean"
    },
    {
      "key": "burdensomeConditionScope",
      "label": "Burdensome Condition scope",
      "type": "enum",
      "options": [
        "PARENT_ONLY",
        "MUTUAL",
        "NA"
      ]
    },
    {
      "key": "citedProvisionNames",
      "label": "Cited provisions resolved to names — [{ section, name }]",
      "type": "list"
    },
    {
      "key": "closingTimingProvisions",
      "label": "Closing timing provisions",
      "type": "text"
    },
    {
      "key": "dissentingSharesThreshold",
      "label": "Dissenting Shares Threshold",
      "type": "percentage"
    },
    {
      "key": "dollarThreshold",
      "label": "Dollar Threshold",
      "type": "currency"
    },
    {
      "key": "fundsCondition",
      "label": "Funds Availability as Condition",
      "type": "boolean"
    },
    {
      "key": "governmentProceedingConditionPresent",
      "label": "Government proceeding closing condition present",
      "type": "boolean"
    },
    {
      "key": "hsrClearance",
      "label": "HSR clearance is a closing condition",
      "type": "boolean"
    },
    {
      "key": "maeConditionStandalone",
      "label": "MAE as Standalone Condition",
      "type": "boolean"
    },
    {
      "key": "mainCondition",
      "label": "Main Condition",
      "type": "text"
    },
    {
      "key": "mutualClosingDeadlineAfterConditionsDays",
      "label": "Mutual closing deadline after conditions satisfied",
      "type": "duration"
    },
    {
      "key": "continuingRequirement",
      "label": "No-MAE condition requires the MAE to be continuing",
      "type": "boolean"
    },
    {
      "key": "certificationRequired",
      "label": "Officer Certification Required",
      "type": "boolean"
    },
    {
      "key": "regulatoryApprovals",
      "label": "Required regulatory approvals",
      "type": "text"
    },
    {
      "key": "scheduleReference",
      "label": "Schedule Reference",
      "type": "text"
    },
    {
      "key": "stockholderApprovalRequired",
      "label": "Stockholder approval is a closing condition",
      "type": "boolean"
    },
    {
      "key": "approvalDefinition",
      "label": "Stockholder-approval definition",
      "type": "text"
    },
    {
      "key": "tenderOfferMinimumCondition",
      "label": "Tender-offer minimum condition",
      "type": "text"
    }
  ],
  "COVENANT_INTERIM_OPERATING": [
    {
      "key": "affirmativeLimbs",
      "label": "Affirmative Limbs — for the consolidated \"Affirmative Covenants\" provision: each limb of the preamble (ordinary course / preserve relationships / maintain assets) as a structured entry { obligation_code, obligation_label, text, efforts_standard }.",
      "type": "list"
    },
    {
      "key": "benefitPlanRestrictions",
      "label": "Benefit-plan restrictions",
      "type": "text"
    },
    {
      "key": "bonusIncreaseExceptions",
      "label": "Bonus-increase exceptions",
      "type": "text"
    },
    {
      "key": "consentStandard",
      "label": "Consent Standard",
      "type": "enum",
      "options": [
        "prior-written",
        "not-unreasonably-withheld",
        "sole-discretion"
      ]
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "dollarThreshold",
      "label": "Dollar Threshold",
      "type": "currency"
    },
    {
      "key": "effortsStandard",
      "label": "Efforts Standard",
      "type": "enum",
      "options": [
        "commercially-reasonable",
        "reasonable-best-efforts",
        "best-efforts"
      ]
    },
    {
      "key": "equityAwardRestrictions",
      "label": "Equity-award restrictions",
      "type": "text"
    },
    {
      "key": "interimNewContractsScope",
      "label": "Interim new-contracts restriction scope",
      "type": "text"
    },
    {
      "key": "interimSettlementCap",
      "label": "Interim settlement cap",
      "type": "currency"
    },
    {
      "key": "party_role",
      "label": "IOC covenant party role — grammatical covenanting party such as COMPANY, PARENT, COLUMBUS, CABOT, SPINCO, REMAINCO, JV",
      "type": "text"
    },
    {
      "key": "leadInAllowsActionAfterNoResponse",
      "label": "Lead-in allows action after Parent non-response",
      "type": "boolean"
    },
    {
      "key": "leadInPeriodDays",
      "label": "Lead-in period",
      "type": "duration"
    },
    {
      "key": "mainObligation",
      "label": "Main Obligation",
      "type": "text"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier",
      "type": "object"
    },
    {
      "key": "newHireExceptions",
      "label": "New-hire exceptions",
      "type": "text"
    },
    {
      "key": "ordinaryCourseCarveout",
      "label": "Ordinary Course Carve-out",
      "type": "boolean"
    },
    {
      "key": "pandemicCarveout",
      "label": "Pandemic / COVID Carve-out",
      "type": "boolean"
    },
    {
      "key": "parentBuyerIocBuckets",
      "label": "Parent / Buyer IOC buckets — categories list",
      "type": "list"
    },
    {
      "key": "dollarThresholdsByCategory",
      "label": "Per-category dollar thresholds — list of tagged items { code, label, text, threshold } drawn from IOC_CATEGORY_CODES",
      "type": "list-tagged"
    },
    {
      "key": "permittedExceptions",
      "label": "Permitted Exceptions specific to THIS sub-clause — ONLY include text that genuinely begins with \"except\", \"other than\", \"provided that\", or \"notwithstanding\". Do NOT include every sub-clause. Do NOT include section-wide carve-outs (those live on the preamble).",
      "type": "list"
    },
    {
      "key": "positiveObligations",
      "label": "Positive Obligations (limbs) — discrete affirmative duties stated in the IOC preamble. Each limb is an object { obligation, efforts_standard, appliesTo, includedObligations? } with efforts_standard as the SOLE standard (FLAT when unqualified).",
      "type": "list"
    },
    {
      "key": "requiredByLawCarveout",
      "label": "Required by Law Carve-out",
      "type": "boolean"
    },
    {
      "key": "restrictionComponents",
      "label": "Restriction Components — canonical IOC_CATEGORY_CODES tags this sub-clause restricts",
      "type": "list"
    },
    {
      "key": "retentionBonusRestrictions",
      "label": "Retention-bonus restrictions",
      "type": "text"
    },
    {
      "key": "salaryIncreaseExceptions",
      "label": "Salary-increase exceptions",
      "type": "text"
    },
    {
      "key": "scheduleReference",
      "label": "Schedule Reference (e.g. \"Section 4.1 of the Company Disclosure Letter\") — applies to the whole IOC section",
      "type": "text"
    },
    {
      "key": "interimSettlementNonPaymentExcluded",
      "label": "Settlement cap excludes non-payment relief",
      "type": "boolean"
    }
  ],
  "COVENANT_NO_SOLICITATION": [
    {
      "key": "acceptableConfidentialityAgreementDefinition",
      "label": "Acceptable Confidentiality Agreement — definition",
      "type": "text"
    },
    {
      "key": "acquisitionTransactionPctThreshold",
      "label": "Acquisition Proposal % threshold",
      "type": "percentage"
    },
    {
      "key": "acquisitionTransactionDefinition",
      "label": "Acquisition Proposal definition",
      "type": "text"
    },
    {
      "key": "antiClubbingWaiverConditions",
      "label": "Anti-clubbing waiver — conditions text",
      "type": "text"
    },
    {
      "key": "antiClubbingWaiverPermitted",
      "label": "Anti-clubbing waiver permitted",
      "type": "boolean"
    },
    {
      "key": "arcReaffirmDeadlineDays",
      "label": "ARC re-affirmation deadline (business days) — for \"fail to publicly recommend against ... within X days\" sub-item",
      "type": "duration"
    },
    {
      "key": "boardChangeStandard",
      "label": "Board change standard",
      "type": "enum",
      "options": [
        "INCONSISTENT_FIDUCIARY",
        "BREACH_FIDUCIARY",
        "REASONABLY_LIKELY_BREACH"
      ]
    },
    {
      "key": "boardChangeForInterveningEvent",
      "label": "Board may change recommendation for intervening event",
      "type": "boolean"
    },
    {
      "key": "boardChangeForSuperiorProposal",
      "label": "Board may change recommendation for superior proposal",
      "type": "boolean"
    },
    {
      "key": "ceaseDiscussionsExceptions",
      "label": "Cease-discussions exceptions",
      "type": "list"
    },
    {
      "key": "changeRecStandard",
      "label": "Change-of-recommendation standard verbatim text",
      "type": "text"
    },
    {
      "key": "companyTerminationForSuperior",
      "label": "Company may terminate for superior proposal",
      "type": "boolean"
    },
    {
      "key": "companyTerminationForSuperiorConditions",
      "label": "Company-terminate-for-superior — conditions text",
      "type": "text"
    },
    {
      "key": "confidentialityRequired",
      "label": "Confidentiality Agreement Required for Information Access",
      "type": "boolean"
    },
    {
      "key": "discussionInitiationNoticeText",
      "label": "Discussion-initiation notice — verbatim language",
      "type": "text"
    },
    {
      "key": "discussionInitiationNoticeHours",
      "label": "Discussion-initiation notice deadline",
      "type": "duration"
    },
    {
      "key": "discussionInitiationNoticePresent",
      "label": "Discussion-initiation notice present",
      "type": "boolean"
    },
    {
      "key": "dontAskDontWaive",
      "label": "Don't-Ask-Don't-Waive Provision",
      "type": "boolean"
    },
    {
      "key": "engagementStandard",
      "label": "Engagement standard verbatim text",
      "type": "text"
    },
    {
      "key": "extendedNegotiatingPeriodDays",
      "label": "Extended go-shop negotiating window",
      "type": "duration"
    },
    {
      "key": "fiduciaryCarveoutThreshold",
      "label": "Fiduciary Carve-Out Threshold",
      "type": "text"
    },
    {
      "key": "fiduciaryEngageStandard",
      "label": "Fiduciary Out — Engagement Standard",
      "type": "text"
    },
    {
      "key": "fiduciaryFinalStandard",
      "label": "Fiduciary Out — Final Determination Standard",
      "type": "text"
    },
    {
      "key": "fiduciaryOutStandard",
      "label": "Fiduciary Out Standard",
      "type": "enum",
      "options": [
        "reasonably-likely-to-lead-to-superior",
        "could-reasonably-be-expected-to-lead-to-superior",
        "constitutes-or-could-lead-to-superior"
      ]
    },
    {
      "key": "forceTheVote",
      "label": "Force the Vote",
      "type": "boolean"
    },
    {
      "key": "forceTheVoteType",
      "label": "Force the Vote — strength code",
      "type": "tagged"
    },
    {
      "key": "forceTheVoteDetails",
      "label": "Force the Vote — verbatim language and any exceptions",
      "type": "text"
    },
    {
      "key": "goShopExcludedParties",
      "label": "Go-shop excluded parties",
      "type": "list"
    },
    {
      "key": "goShopPeriodDays",
      "label": "Go-shop period",
      "type": "duration"
    },
    {
      "key": "goShopPresent",
      "label": "Go-shop present",
      "type": "boolean"
    },
    {
      "key": "goShopWindow",
      "label": "Go-Shop Window",
      "type": "duration"
    },
    {
      "key": "informationRights",
      "label": "Information Rights",
      "type": "boolean"
    },
    {
      "key": "informationSharingObligationPresent",
      "label": "Information-sharing / equal-info duty present",
      "type": "boolean"
    },
    {
      "key": "informationSharingObligationScope",
      "label": "Information-sharing scope",
      "type": "text"
    },
    {
      "key": "informationSharingObligationTiming",
      "label": "Information-sharing timing",
      "type": "text"
    },
    {
      "key": "initialMatchPeriodDays",
      "label": "Initial match period",
      "type": "duration"
    },
    {
      "key": "interveningEventTermination",
      "label": "Intervening Event — does termination right exist for Intervening Event (vs. just recommendation change)? Capture standard + carve-outs.",
      "type": "text"
    },
    {
      "key": "interveningEventDefinition",
      "label": "Intervening Event definition",
      "type": "text"
    },
    {
      "key": "interveningEventProvision",
      "label": "Intervening Event Provision Exists",
      "type": "boolean"
    },
    {
      "key": "interveningEventScope",
      "label": "Intervening Event scope",
      "type": "enum",
      "options": [
        "POSITIVE_ONLY",
        "BOTH",
        "NA"
      ]
    },
    {
      "key": "legallyRequiredDisclosurePermitted",
      "label": "Legally-required-disclosure carve-out permitted",
      "type": "boolean"
    },
    {
      "key": "ceaseDiscussionsLiability",
      "label": "Liability for representative breach",
      "type": "text"
    },
    {
      "key": "matchingPeriod",
      "label": "Matching Period",
      "type": "duration"
    },
    {
      "key": "materialImprovementStandard",
      "label": "Material-improvement standard for re-triggering match",
      "type": "text"
    },
    {
      "key": "noConflictingAgreementsPresent",
      "label": "No-conflicting-agreements duty present",
      "type": "boolean"
    },
    {
      "key": "noConflictingAgreementsScope",
      "label": "No-conflicting-agreements scope",
      "type": "text"
    },
    {
      "key": "noticeContent",
      "label": "Notice Content to Existing Buyer",
      "type": "text"
    },
    {
      "key": "infoRequiredBidderIdentity",
      "label": "Notice must disclose bidder identity",
      "type": "boolean"
    },
    {
      "key": "infoRequiredCommunicationsDrafts",
      "label": "Notice must share communications / drafts",
      "type": "boolean"
    },
    {
      "key": "infoRequiredFinancingPapers",
      "label": "Notice must share financing papers",
      "type": "boolean"
    },
    {
      "key": "noticePeriod",
      "label": "Notice Period",
      "type": "duration"
    },
    {
      "key": "parentTerminationRightForNonsolicitBreach",
      "label": "Parent termination right for nonsolicit breach",
      "type": "enum",
      "options": [
        "ALL_BREACHES",
        "MATERIAL_WILLFUL_ONLY",
        "WILLFUL_ONLY",
        "NONE"
      ]
    },
    {
      "key": "ceaseDiscussionsProhibitedList",
      "label": "Prohibited acts during cease-discussions period",
      "type": "list-tagged"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "representativeBreachIsCompanyBreach",
      "label": "Representative breach is treated as company breach",
      "type": "boolean"
    },
    {
      "key": "representativeBreachConditions",
      "label": "Representative-breach — conditions text",
      "type": "text"
    },
    {
      "key": "representativesStandard",
      "label": "Representatives standard",
      "type": "enum",
      "options": [
        "CAUSE_NOT_TO",
        "RBE_NOT_TO",
        "INSTRUCT_NOT_TO",
        "NA"
      ]
    },
    {
      "key": "safeDisclosureCarveoutLanguage",
      "label": "Safe-disclosure carve-out — verbatim language",
      "type": "text"
    },
    {
      "key": "ceaseDiscussionsAffiliateStandard",
      "label": "Standard for affiliates / representatives",
      "type": "text"
    },
    {
      "key": "standstillWaiverConditions",
      "label": "Standstill waiver — conditions text",
      "type": "text"
    },
    {
      "key": "standstillWaiverPermitted",
      "label": "Standstill waiver permitted",
      "type": "boolean"
    },
    {
      "key": "standstillWaiver",
      "label": "Standstill Waiver Permitted",
      "type": "boolean"
    },
    {
      "key": "subsequentMatchPeriodDays",
      "label": "Subsequent match period",
      "type": "duration"
    },
    {
      "key": "subsequentMatching",
      "label": "Subsequent Matching on Amendments",
      "type": "boolean"
    },
    {
      "key": "subsequentMatchingPeriod",
      "label": "Subsequent Matching Period",
      "type": "duration"
    },
    {
      "key": "superiorProposalThresholdPct",
      "label": "Superior Proposal % threshold",
      "type": "percentage"
    },
    {
      "key": "superiorProposalDeterminer",
      "label": "Superior Proposal determiner",
      "type": "tagged"
    },
    {
      "key": "superiorProposalPercentage",
      "label": "Superior Proposal Percentage Threshold",
      "type": "percentage"
    },
    {
      "key": "superiorProposalTest",
      "label": "Superior Proposal test",
      "type": "text"
    },
    {
      "key": "tenderOfferDisclosurePermitted",
      "label": "Tender-offer disclosure (Rule 14d-9 \"stop, look and listen\") permitted without triggering ARC",
      "type": "boolean"
    },
    {
      "key": "tenderOfferDisclosureScope",
      "label": "Tender-offer disclosure scope",
      "type": "text"
    },
    {
      "key": "changeOfRecommendationItems",
      "label": "What constitutes a Change of Recommendation",
      "type": "list-tagged"
    },
    {
      "key": "notChangeOfRecommendationItems",
      "label": "What does NOT constitute a Change of Recommendation",
      "type": "list"
    }
  ],
  "COVENANT_OTHER": [
    {
      "key": "accessScope",
      "label": "Access Scope",
      "type": "enum",
      "options": [
        "broad-access",
        "reasonable-access",
        "limited-access"
      ]
    },
    {
      "key": "accessPurposeLimitation",
      "label": "Access scope — purpose limitation",
      "type": "text"
    },
    {
      "key": "covenantComplianceStandard",
      "label": "Covenant compliance standard",
      "type": "enum",
      "options": [
        "ALL_IN_MATERIAL_RESPECTS",
        "EACH_IN_MATERIAL_RESPECTS",
        "HYBRID"
      ]
    },
    {
      "key": "cvrIncluded",
      "label": "CVR Agreement Included",
      "type": "boolean"
    },
    {
      "key": "indemnificationPeriod",
      "label": "D&O Indemnification Tail Period",
      "type": "duration"
    },
    {
      "key": "employeeBenefitPeriod",
      "label": "Employee Benefit Continuation Period",
      "type": "duration"
    },
    {
      "key": "financingCooperationScope",
      "label": "Financing cooperation — scope text",
      "type": "text"
    },
    {
      "key": "financingCooperationPresent",
      "label": "Financing cooperation present",
      "type": "boolean"
    },
    {
      "key": "financingCooperation",
      "label": "Financing Cooperation Required",
      "type": "boolean"
    },
    {
      "key": "financingCooperationBreachIsCondition",
      "label": "Financing-cooperation breach is closing condition",
      "type": "boolean"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "publicStatementsCarveoutCompany",
      "label": "Public statements carveout — Company",
      "type": "boolean"
    },
    {
      "key": "publicStatementsCarveoutParent",
      "label": "Public statements carveout — Parent",
      "type": "boolean"
    },
    {
      "key": "publicStatementsJointApproval",
      "label": "Public statements require joint approval",
      "type": "boolean"
    },
    {
      "key": "tsaContemplated",
      "label": "Transition Services Agreement contemplated",
      "type": "boolean"
    }
  ],
  "TERMINATION_RIGHT": [
    {
      "key": "closingTimingProvisions",
      "label": "Closing timing provisions visible at the termination page",
      "type": "text"
    },
    {
      "key": "extensionMutualOrUnilateral",
      "label": "Extension mode",
      "type": "enum",
      "options": [
        "MUTUAL",
        "UNILATERAL_PARENT",
        "UNILATERAL_COMPANY",
        "NA"
      ]
    },
    {
      "key": "extensionParty",
      "label": "Extension party",
      "type": "enum",
      "options": [
        "PARENT",
        "COMPANY",
        "MUTUAL",
        "NA"
      ]
    },
    {
      "key": "faultBasedExclusion",
      "label": "Fault-Based Exclusion",
      "type": "boolean"
    },
    {
      "key": "lawOrderTerminationScope",
      "label": "Law/Order termination — scope text",
      "type": "text"
    },
    {
      "key": "finalAndNonappealableRequired",
      "label": "Law/Order termination requires final & non-appealable",
      "type": "boolean"
    },
    {
      "key": "lawOrderTerminationPresent",
      "label": "Law/Order termination right present",
      "type": "boolean"
    },
    {
      "key": "lostPremiumDamagesConditions",
      "label": "Lost-premium damages — conditions text",
      "type": "text"
    },
    {
      "key": "marketOutHolder",
      "label": "Market-out / walkaway holder",
      "type": "enum",
      "options": [
        "TARGET",
        "ACQUIRER",
        "BOTH",
        "NA"
      ]
    },
    {
      "key": "extensionMaxExercises",
      "label": "Maximum extensions permitted",
      "type": "duration"
    },
    {
      "key": "partyWhoCanTerminate",
      "label": "Party Who Can Terminate",
      "type": "enum",
      "options": [
        "buyer",
        "target",
        "either",
        "mutual"
      ]
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "lostPremiumDamagesPursuit",
      "label": "Right to pursue lost-premium damages",
      "type": "boolean"
    },
    {
      "key": "terminationCarveoutForOwnBreach",
      "label": "Termination carveout for own breach",
      "type": "text"
    },
    {
      "key": "terminationTriggers",
      "label": "Termination Triggers — the LIST of conditions that allow termination. Do NOT include exceptions / carve-outs to termination.",
      "type": "list"
    }
  ],
  "TERMINATION_FEE": [
    {
      "key": "companyTerminationFee",
      "label": "Company Termination Fee",
      "type": "object"
    },
    {
      "key": "effectOfTermination",
      "label": "Effect of Termination",
      "type": "text"
    },
    {
      "key": "expenseReimbursement",
      "label": "Expense Reimbursement",
      "type": "object"
    },
    {
      "key": "expenseReimbursementCap",
      "label": "Expense Reimbursement Cap",
      "type": "currency"
    },
    {
      "key": "feeAmount",
      "label": "Fee Amount",
      "type": "currency"
    },
    {
      "key": "feePercentage",
      "label": "Fee as Percentage of Deal Value",
      "type": "percentage"
    },
    {
      "key": "feeSoleAndExclusiveRemedy",
      "label": "Fee is sole and exclusive remedy",
      "type": "boolean"
    },
    {
      "key": "soleAndExclusiveRemedy",
      "label": "Fee is Sole and Exclusive Remedy",
      "type": "boolean"
    },
    {
      "key": "soleRemedy",
      "label": "Fee is Sole and Exclusive Remedy",
      "type": "boolean"
    },
    {
      "key": "interestOnLatePayment",
      "label": "Interest on Late Payment",
      "type": "object"
    },
    {
      "key": "interestRateBasis",
      "label": "Interest-rate basis on late payment",
      "type": "tagged"
    },
    {
      "key": "nakedNoVoteFee",
      "label": "Naked No-Vote Fee",
      "type": "boolean"
    },
    {
      "key": "nakedNoVoteFeeAmount",
      "label": "Naked no-vote fee amount",
      "type": "currency"
    },
    {
      "key": "nakedNoVoteFeePresent",
      "label": "Naked no-vote fee present",
      "type": "boolean"
    },
    {
      "key": "triggers",
      "label": "Per-trigger array — list of { code, name, terminationClauses, feeAmount, feeAmountPct }",
      "type": "list"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "remedyBarAfterFee",
      "label": "Remedy bar after fee paid",
      "type": "text"
    },
    {
      "key": "remedyScope",
      "label": "Remedy scope",
      "type": "enum",
      "options": [
        "FEE_SPECIFIC",
        "GENERAL"
      ]
    },
    {
      "key": "reverseFeeAmount",
      "label": "Reverse Fee Amount",
      "type": "currency"
    },
    {
      "key": "reverseFeePercentage",
      "label": "Reverse Fee as Percentage of Deal Value",
      "type": "percentage"
    },
    {
      "key": "reverseTerminationFee",
      "label": "Reverse Termination Fee",
      "type": "object"
    },
    {
      "key": "feeSoleRemedyExceptions",
      "label": "Sole-remedy exceptions",
      "type": "list"
    },
    {
      "key": "tailFeeSameProposalRequired",
      "label": "Tail fee — must consummated deal be with same third party that triggered the tail?",
      "type": "boolean"
    },
    {
      "key": "tailFeeTriggerConsummatedDuringTail",
      "label": "Tail fee trigger: alt consummated during tail",
      "type": "boolean"
    },
    {
      "key": "tailFeeTriggerAltAnnouncedDuringPendency",
      "label": "Tail fee trigger: alternative announced during pendency",
      "type": "boolean"
    },
    {
      "key": "tailFeeTriggerNakedNoVote",
      "label": "Tail fee trigger: naked no-vote",
      "type": "boolean"
    },
    {
      "key": "tailFeeTriggerEndDate",
      "label": "Tail fee trigger: termination at end date",
      "type": "boolean"
    },
    {
      "key": "tailFeeWindowMonths",
      "label": "Tail fee window",
      "type": "duration"
    },
    {
      "key": "tailPeriod",
      "label": "Tail Period",
      "type": "duration"
    },
    {
      "key": "tailProvision",
      "label": "Tail Provision",
      "type": "object"
    },
    {
      "key": "tailFeeActivatingClauses",
      "label": "Tail-fee activating termination clauses",
      "type": "list"
    },
    {
      "key": "tailFeeThresholdPct",
      "label": "Tail-fee Company Takeover Proposal % threshold",
      "type": "percentage"
    },
    {
      "key": "tailFeeRecognitionEvent",
      "label": "Tail-fee recognition event",
      "type": "text"
    },
    {
      "key": "feePctOfDealValue",
      "label": "Termination fee",
      "type": "percentage"
    },
    {
      "key": "terminationFeePercentEquityValue",
      "label": "Termination fee as % of equity value",
      "type": "percentage"
    },
    {
      "key": "terminationFees",
      "label": "Termination fees — list of { feeType, payableBy, payableTo, amount, percentEquityValue, triggers[], paymentDeadline, tail, soleRemedy, exceptions }",
      "type": "list"
    },
    {
      "key": "triggerEvents",
      "label": "Trigger Events",
      "type": "list"
    },
    {
      "key": "willfulBreachException",
      "label": "Willful Breach Carve-out to Sole Remedy",
      "type": "boolean"
    }
  ],
  "DEFINITION": [
    {
      "key": "acquisitionProposalPercentage",
      "label": "Acquisition Proposal Percentage Threshold",
      "type": "percentage"
    },
    {
      "key": "canonicalTerm",
      "label": "Canonical Term",
      "type": "text"
    },
    {
      "key": "carveOuts",
      "label": "Carve-Outs",
      "type": "list"
    },
    {
      "key": "nonDisproportionateImpactCarveouts",
      "label": "Carve-Outs NOT subject to disproportionate-impact carveback",
      "type": "list-tagged"
    },
    {
      "key": "disproportionateImpactCarveouts",
      "label": "Carve-Outs subject to disproportionate-impact carveback",
      "type": "list-tagged"
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "cyberSecurityCarveout",
      "label": "Cybersecurity Incident MAE Carve-Out",
      "type": "boolean"
    },
    {
      "key": "definitionText",
      "label": "Definition Text",
      "type": "text"
    },
    {
      "key": "disproportionateImpactClause",
      "label": "Disproportionate Impact Clause",
      "type": "text"
    },
    {
      "key": "disproportionateImpact",
      "label": "Disproportionate Impact Qualifier",
      "type": "boolean"
    },
    {
      "key": "disproportionateImpactScope",
      "label": "Disproportionate Impact Scope",
      "type": "list"
    },
    {
      "key": "knowledgePersons",
      "label": "Knowledge Persons",
      "type": "list"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge Standard",
      "type": "enum",
      "options": [
        "actual-knowledge",
        "constructive-knowledge",
        "after-reasonable-inquiry",
        "actual-knowledge-after-due-inquiry"
      ]
    },
    {
      "key": "carveouts",
      "label": "MAE Carve-Outs",
      "type": "list-tagged"
    },
    {
      "key": "carveOutsList",
      "label": "MAE Carve-Outs List",
      "type": "list"
    },
    {
      "key": "preventDelayProng",
      "label": "MAE includes a prevent-or-delay-closing prong",
      "type": "boolean"
    },
    {
      "key": "ordinaryCourseQualifier",
      "label": "Ordinary Course Qualifier",
      "type": "enum",
      "options": [
        "ordinary-course-only",
        "ordinary-course-consistent-with-past-practice",
        "ordinary-course-consistent-in-all-material-respects"
      ]
    },
    {
      "key": "pandemicCarveout",
      "label": "Pandemic / COVID MAE Carve-Out",
      "type": "boolean"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "preventDelayRepsCovered",
      "label": "Reps covered by the prevent-or-delay prong",
      "type": "list"
    },
    {
      "key": "superiorProposalPercentage",
      "label": "Superior Proposal Percentage Threshold",
      "type": "percentage"
    },
    {
      "key": "willfulBreachDefinition",
      "label": "Willful Breach Defined",
      "type": "boolean"
    }
  ],
  "ANTITRUST_REGULATORY": [
    {
      "key": "burdenCommitment",
      "label": "Burden commitment",
      "type": "tagged"
    },
    {
      "key": "burdenBaseline",
      "label": "Burden measurement baseline",
      "type": "tagged"
    },
    {
      "key": "burdenCap",
      "label": "Burdensome Condition / Burden Cap",
      "type": "text"
    },
    {
      "key": "burdensomConditionDefined",
      "label": "Burdensome Condition Defined",
      "type": "boolean"
    },
    {
      "key": "burdensomeConditionInTerminationTriggers",
      "label": "Burdensome-condition concept as a termination trigger",
      "type": "text"
    },
    {
      "key": "capDetail",
      "label": "Cap detail",
      "type": "text"
    },
    {
      "key": "clearSkiesCompanyScope",
      "label": "Clear-skies (Company) — scope/limits text",
      "type": "text"
    },
    {
      "key": "clearSkiesParentScope",
      "label": "Clear-skies (Parent) — scope/limits text",
      "type": "text"
    },
    {
      "key": "clearSkies",
      "label": "Clear-skies by party",
      "type": "object"
    },
    {
      "key": "clearSkiesCompany",
      "label": "Clear-skies covenant on the Company side",
      "type": "boolean"
    },
    {
      "key": "clearSkiesParent",
      "label": "Clear-skies covenant on the Parent side",
      "type": "boolean"
    },
    {
      "key": "consultationTier",
      "label": "Consultation tier",
      "type": "tagged"
    },
    {
      "key": "divestitureCap",
      "label": "Divestiture Cap",
      "type": "currency"
    },
    {
      "key": "divestitureCapDescription",
      "label": "Divestiture Cap Description",
      "type": "text"
    },
    {
      "key": "effortsStandardDiffersByRemedy",
      "label": "Efforts standard differs depending on remedy type",
      "type": "boolean"
    },
    {
      "key": "exHsrFilingDeadline",
      "label": "Ex-HSR filing deadline",
      "type": "object"
    },
    {
      "key": "foreignFilingsRequired",
      "label": "Foreign Regulatory Filings Required",
      "type": "list"
    },
    {
      "key": "hellOrHighWater",
      "label": "Hell-or-High-Water",
      "type": "boolean"
    },
    {
      "key": "hsrFilingDeadline",
      "label": "HSR filing deadline",
      "type": "object"
    },
    {
      "key": "hsrFilingDeadlineBusinessDays",
      "label": "HSR filing deadline",
      "type": "duration"
    },
    {
      "key": "interimOperatingRestrictions",
      "label": "Interim Operating Restrictions During Review",
      "type": "boolean"
    },
    {
      "key": "litigationObligationQualification",
      "label": "Litigation obligation qualification",
      "type": "text"
    },
    {
      "key": "appliesToParty",
      "label": "No-Inconsistent-Action — Party Bound",
      "type": "tagged"
    },
    {
      "key": "litigationObligation",
      "label": "Obligation to Litigate Against Regulators",
      "type": "tagged"
    },
    {
      "key": "otherRegulatoryFilingDeadlines",
      "label": "Other regulatory filing deadlines",
      "type": "text"
    },
    {
      "key": "parentLitigationObligation",
      "label": "Parent has obligation to litigate against regulators",
      "type": "boolean"
    },
    {
      "key": "parentRemedyObligation",
      "label": "Parent remedy obligation",
      "type": "tagged"
    },
    {
      "key": "partyControlsStrategy",
      "label": "Party That Controls Regulatory Strategy",
      "type": "enum",
      "options": [
        "buyer",
        "target",
        "mutual",
        "silent"
      ]
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "pullRefile",
      "label": "Pull-and-refile gating",
      "type": "tagged"
    },
    {
      "key": "pullAndRefileCompanyConsent",
      "label": "Pull-and-refile requires Company consent",
      "type": "boolean"
    },
    {
      "key": "pullAndRefileRight",
      "label": "Pull-and-Refile Right",
      "type": "boolean"
    },
    {
      "key": "pullRefileText",
      "label": "Pull-and-refile text",
      "type": "text"
    },
    {
      "key": "regulatoryClosingConditions",
      "label": "Regulatory closing conditions / required filings",
      "type": "text"
    },
    {
      "key": "regulatoryCooperationCarveout",
      "label": "Regulatory cooperation covenant carveout from closing conditionality",
      "type": "text"
    },
    {
      "key": "filingDeadline",
      "label": "Regulatory Filing Deadline",
      "type": "text"
    },
    {
      "key": "regulatoryCooperationScope",
      "label": "Regulatory information / cooperation covenant — scope",
      "type": "text"
    },
    {
      "key": "regulatoryStrategyControlTagged",
      "label": "Regulatory strategy control",
      "type": "tagged"
    },
    {
      "key": "regulatoryStrategyControl",
      "label": "Regulatory strategy control",
      "type": "enum",
      "options": [
        "PARENT_CONTROL",
        "COMPANY_CONTROL",
        "JOINT",
        "NA"
      ]
    },
    {
      "key": "springingRegulatoryConditions",
      "label": "Springing regulatory conditions",
      "type": "text"
    },
    {
      "key": "effortsStandard",
      "label": "Standard of Efforts",
      "type": "enum",
      "options": [
        "best-efforts",
        "reasonable-best-efforts",
        "commercially-reasonable-efforts",
        "reasonable-efforts"
      ]
    },
    {
      "key": "substantialComplianceDeadlineDays",
      "label": "Substantial compliance deadline",
      "type": "duration"
    },
    {
      "key": "timingAgreement",
      "label": "Timing agreement restriction",
      "type": "tagged"
    },
    {
      "key": "timingAgreementText",
      "label": "Timing agreement text",
      "type": "text"
    },
    {
      "key": "timingAgreementsProhibited",
      "label": "Timing agreements with regulators prohibited",
      "type": "boolean"
    },
    {
      "key": "controllingParty",
      "label": "Who Controls Antitrust Strategy",
      "type": "tagged"
    }
  ],
  "SEC_FILING_MEETING": [],
  "EMPLOYEE_BENEFITS": [
    {
      "key": "parachuteCap",
      "label": "280G Parachute Cap Applies",
      "type": "boolean"
    },
    {
      "key": "appraisalRightsAvailable",
      "label": "Appraisal Rights Available",
      "type": "boolean"
    },
    {
      "key": "cashOutAmount",
      "label": "Cash-Out Calculation",
      "type": "text"
    },
    {
      "key": "collar",
      "label": "Collar",
      "type": "object"
    },
    {
      "key": "considerationType",
      "label": "Consideration Type",
      "type": "enum",
      "options": [
        "all-cash",
        "all-stock",
        "mixed-cash-and-stock",
        "cash-with-cvr"
      ]
    },
    {
      "key": "cutoffDate",
      "label": "Cutoff Date",
      "type": "text"
    },
    {
      "key": "dividendEquivalence",
      "label": "Dividend Equivalence",
      "type": "text"
    },
    {
      "key": "doubleTrigger",
      "label": "Double Trigger Required",
      "type": "boolean"
    },
    {
      "key": "equityAwardTreatment",
      "label": "Equity Award Treatment Summary",
      "type": "object"
    },
    {
      "key": "espp_treatment",
      "label": "ESPP Treatment",
      "type": "text"
    },
    {
      "key": "exchangeRatio",
      "label": "Exchange Ratio",
      "type": "text"
    },
    {
      "key": "exchangeRatioText",
      "label": "Exchange Ratio Formula",
      "type": "text"
    },
    {
      "key": "exchangeRatioType",
      "label": "Exchange Ratio Type",
      "type": "enum",
      "options": [
        "FIXED",
        "FLOATING"
      ]
    },
    {
      "key": "instrumentType",
      "label": "Instrument Type",
      "type": "tagged"
    },
    {
      "key": "optionSpread",
      "label": "Option Spread Calculation",
      "type": "text"
    },
    {
      "key": "optionsCvrEarnIn",
      "label": "Options earn-in via CVR",
      "type": "enum",
      "options": [
        "EARN_IN_ELIGIBLE",
        "MUST_BE_ITM",
        "NOT_SPECIFIED"
      ]
    },
    {
      "key": "outstandingCount",
      "label": "Outstanding Count",
      "type": "text"
    },
    {
      "key": "outstandingInstruments",
      "label": "Outstanding Instruments",
      "type": "list-tagged"
    },
    {
      "key": "perShareAmount",
      "label": "Per Share Cash Amount",
      "type": "currency"
    },
    {
      "key": "cutoffTreatment",
      "label": "Pre/Post-Cutoff Treatment",
      "type": "text"
    },
    {
      "key": "prorationMechanics",
      "label": "Proration Mechanics",
      "type": "object"
    },
    {
      "key": "proration",
      "label": "Proration Mechanism",
      "type": "boolean"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "performanceTreatment",
      "label": "PSU Performance Treatment",
      "type": "text"
    },
    {
      "key": "taxReorgIntended",
      "label": "Section 368(a) Reorganization Intended",
      "type": "boolean"
    },
    {
      "key": "taxReorgText",
      "label": "Section 368(a) Reorganization Text",
      "type": "text"
    },
    {
      "key": "instrumentTreatments",
      "label": "Treatment per Instrument",
      "type": "list-tagged"
    },
    {
      "key": "vestingAcceleration",
      "label": "Vesting Acceleration",
      "type": "tagged"
    },
    {
      "key": "instrumentVesting",
      "label": "Vesting per Instrument",
      "type": "list-tagged"
    },
    {
      "key": "walkAwayRight",
      "label": "Walk-Away Right",
      "type": "object"
    },
    {
      "key": "withholdingProvision",
      "label": "Withholding Provision Included",
      "type": "boolean"
    }
  ],
  "STRUCTURE_MECHANICS": [
    {
      "key": "adsVotingMechanics",
      "label": "ADS voting / surrender mechanics",
      "type": "text"
    },
    {
      "key": "adsPresent",
      "label": "American Depositary Shares present",
      "type": "boolean"
    },
    {
      "key": "shareholderApprovalMethodCompany",
      "label": "Company Shareholder Approval Method",
      "type": "enum",
      "options": [
        "SPECIAL_MEETING",
        "WRITTEN_CONSENT",
        "SIGN_AND_CONSENT",
        "BOARD_ONLY",
        "NA"
      ]
    },
    {
      "key": "dealStructure",
      "label": "Deal structure",
      "type": "enum",
      "options": [
        "ONE_STEP_MERGER",
        "TWO_STEP_TENDER_OFFER",
        "SCHEME",
        "ASSET",
        "STOCK",
        "OTHER"
      ]
    },
    {
      "key": "effectiveTimeShort",
      "label": "Effective Time — one-sentence summary",
      "type": "text"
    },
    {
      "key": "effectsOfMergerReference",
      "label": "Effects of Merger — statute cited",
      "type": "text"
    },
    {
      "key": "mergerForm",
      "label": "Merger Form",
      "type": "tagged"
    },
    {
      "key": "shareholderApprovalMethodParent",
      "label": "Parent Shareholder Approval Method",
      "type": "enum",
      "options": [
        "SPECIAL_MEETING",
        "WRITTEN_CONSENT",
        "SIGN_AND_CONSENT",
        "BOARD_ONLY",
        "NA"
      ]
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    }
  ],
  "MAE": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions",
      "type": "list-tagged"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date",
      "type": "text"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type",
      "type": "enum",
      "options": [
        "SPECIFIED_IOCS",
        "GENERAL_ORDINARY_COURSE",
        "HYBRID"
      ]
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present",
      "type": "boolean"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date",
      "type": "text"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names",
      "type": "list"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb",
      "type": "list"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb",
      "type": "text"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard",
      "type": "enum",
      "options": [
        "all-respects",
        "material-respects",
        "MAE-standard",
        "de-minimis"
      ]
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard",
      "type": "tagged"
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep",
      "type": "text"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved",
      "type": "text"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition",
      "type": "text"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used",
      "type": "object"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard",
      "type": "tagged"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period",
      "type": "text"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs",
      "type": "enum",
      "options": [
        "ONE_LIMB",
        "TWO_LIMB"
      ]
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }",
      "type": "list"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets",
      "type": "list-tagged"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier",
      "type": "object"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape",
      "type": "boolean"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level",
      "type": "boolean"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language",
      "type": "text"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present",
      "type": "boolean"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer",
      "type": "text"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition",
      "type": "text"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted",
      "type": "boolean"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed",
      "type": "boolean"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception",
      "type": "list"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules",
      "type": "list"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections",
      "type": "list"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back",
      "type": "duration"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope",
      "type": "text"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period",
      "type": "duration"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition",
      "type": "text"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present",
      "type": "boolean"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions",
      "type": "list-tagged"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement",
      "type": "enum",
      "options": [
        "COMPANY",
        "PARENT",
        "BOTH"
      ]
    }
  ],
  "NO_OTHER_REPS": [
    {
      "key": "absenceOfChangesExceptions",
      "label": "Absence-of-changes exceptions",
      "type": "list-tagged"
    },
    {
      "key": "absenceOfChangesStartDate",
      "label": "Absence-of-changes look-back start date",
      "type": "text"
    },
    {
      "key": "absenceOfChangesType",
      "label": "Absence-of-changes type",
      "type": "enum",
      "options": [
        "SPECIFIED_IOCS",
        "GENERAL_ORDINARY_COURSE",
        "HYBRID"
      ]
    },
    {
      "key": "antiRelianceRepText",
      "label": "Anti-Reliance rep — verbatim language",
      "type": "text"
    },
    {
      "key": "antiRelianceRepPresent",
      "label": "Anti-Reliance rep present",
      "type": "boolean"
    },
    {
      "key": "aocNoMaePresent",
      "label": "AoC rep — \"no MAE since [date]\" limb present",
      "type": "boolean"
    },
    {
      "key": "aocNoMaeSinceDate",
      "label": "AoC rep — \"no MAE since\" date",
      "type": "text"
    },
    {
      "key": "aocCitedCovenantNames",
      "label": "AoC rep — cited covenant sections resolved to names",
      "type": "list"
    },
    {
      "key": "aocCitedCovenantSections",
      "label": "AoC rep — covenant sections cited by the ordinary-course limb",
      "type": "list"
    },
    {
      "key": "aocOrdinaryCourseLimb",
      "label": "AoC rep — ordinary-course limb",
      "type": "text"
    },
    {
      "key": "bringDownStandard",
      "label": "Applicable Bring-Down Standard",
      "type": "enum",
      "options": [
        "all-respects",
        "material-respects",
        "MAE-standard",
        "de-minimis"
      ]
    },
    {
      "key": "assignmentExceptions",
      "label": "Assignment exceptions",
      "type": "list"
    },
    {
      "key": "assignmentProvisos",
      "label": "Assignment provisos",
      "type": "list-tagged"
    },
    {
      "key": "assignmentRestrictions",
      "label": "Assignment restrictions",
      "type": "text"
    },
    {
      "key": "bondSecurityRequiredForSP",
      "label": "Bond / security required for specific performance",
      "type": "boolean"
    },
    {
      "key": "linkedBringDownStandard",
      "label": "Bring Down Standard",
      "type": "tagged"
    },
    {
      "key": "companyConsentForAssignment",
      "label": "Company consent required for assignment",
      "type": "boolean"
    },
    {
      "key": "companyRightToForceClose",
      "label": "Company right to force closing",
      "type": "boolean"
    },
    {
      "key": "companyForceCloseConditions",
      "label": "Company-force-close — conditions text",
      "type": "text"
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "scheduleReference",
      "label": "Disclosure Schedule Cross-Reference for THIS rep",
      "type": "text"
    },
    {
      "key": "jurisdictionExclusive",
      "label": "Exclusive Jurisdiction",
      "type": "boolean"
    },
    {
      "key": "feeExpenseAllocation",
      "label": "Fee / expense allocation",
      "type": "text"
    },
    {
      "key": "financingRepIncluded",
      "label": "Financing / Sufficient Funds Rep Included",
      "type": "boolean"
    },
    {
      "key": "forumCourts",
      "label": "Forum court(s) named",
      "type": "list"
    },
    {
      "key": "forumFallback",
      "label": "Forum fallback if the primary court lacks jurisdiction",
      "type": "text"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved",
      "type": "text"
    },
    {
      "key": "governingLaw",
      "label": "Governing Law Jurisdiction",
      "type": "tagged"
    },
    {
      "key": "juryWaiver",
      "label": "Jury Trial Waiver",
      "type": "boolean"
    },
    {
      "key": "knowledgeScope",
      "label": "Knowledge definition",
      "type": "text"
    },
    {
      "key": "knowledgeScopeType",
      "label": "Knowledge qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "knowledgeQualifier",
      "label": "Knowledge Qualifier Used",
      "type": "object"
    },
    {
      "key": "knowledgeStandard",
      "label": "Knowledge standard",
      "type": "tagged"
    },
    {
      "key": "lookbackPeriod",
      "label": "Lookback period",
      "type": "text"
    },
    {
      "key": "maeLimbs",
      "label": "MAE limbs",
      "type": "enum",
      "options": [
        "ONE_LIMB",
        "TWO_LIMB"
      ]
    },
    {
      "key": "materialContractsDollarThresholds",
      "label": "Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }",
      "type": "list"
    },
    {
      "key": "materialContractsBuckets",
      "label": "Material Contracts rep buckets",
      "type": "list-tagged"
    },
    {
      "key": "materialityQualifier",
      "label": "Materiality Qualifier",
      "type": "object"
    },
    {
      "key": "materialityScopeType",
      "label": "Materiality qualifier scope",
      "type": "enum",
      "options": [
        "ENTIRE_REP",
        "PARTIAL"
      ]
    },
    {
      "key": "materialityScrape",
      "label": "Materiality Scrape",
      "type": "boolean"
    },
    {
      "key": "materialityScrapePresent",
      "label": "Materiality scrape present at closing-condition level",
      "type": "boolean"
    },
    {
      "key": "materialityScrapeLanguage",
      "label": "Materiality scrape verbatim language",
      "type": "text"
    },
    {
      "key": "noExcusePostClosingPresent",
      "label": "No-excuse / no-recourse post-closing covenant present",
      "type": "boolean"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present",
      "type": "boolean"
    },
    {
      "key": "noSetoffPresent",
      "label": "No-setoff clause present",
      "type": "boolean"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer",
      "type": "text"
    },
    {
      "key": "noticesAddress",
      "label": "Notices Block (party + address + email + counsel cc) — verbatim",
      "type": "text"
    },
    {
      "key": "parentAssignmentConditions",
      "label": "Parent assignment — conditions text",
      "type": "list-tagged"
    },
    {
      "key": "parentBrokersRepPresent",
      "label": "Parent brokers / finders rep present",
      "type": "boolean"
    },
    {
      "key": "parentAssignmentRight",
      "label": "Parent has assignment right",
      "type": "boolean"
    },
    {
      "key": "parentLitigationRepPresent",
      "label": "Parent litigation rep present",
      "type": "boolean"
    },
    {
      "key": "parentOwnershipRepPresent",
      "label": "Parent ownership rep present",
      "type": "boolean"
    },
    {
      "key": "permittedRedactionsDefinition",
      "label": "Permitted-redactions definition",
      "type": "text"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "materialContractsRedactionsPermitted",
      "label": "Redactions to material contracts permitted",
      "type": "boolean"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed",
      "type": "boolean"
    },
    {
      "key": "secFilingsCarvedOutReps",
      "label": "Reps NOT subject to the SEC-filings exception",
      "type": "list"
    },
    {
      "key": "maeQualifiedReps",
      "label": "Reps qualified by MAE",
      "type": "list"
    },
    {
      "key": "repsSurvivalExceptions",
      "label": "Reps survival — exceptions text",
      "type": "text"
    },
    {
      "key": "repsSurvivalPresent",
      "label": "Reps survival clause present",
      "type": "boolean"
    },
    {
      "key": "repsSurvivalDuration",
      "label": "Reps survival duration",
      "type": "text"
    },
    {
      "key": "disclosureSchedulesException",
      "label": "Reps with EXCEPTION disclosure schedules",
      "type": "list"
    },
    {
      "key": "disclosureSchedulesRequired",
      "label": "Reps with REQUIRED disclosure schedules",
      "type": "list"
    },
    {
      "key": "secFilingsExcludedSections",
      "label": "SEC-filings exception excluded sections",
      "type": "list"
    },
    {
      "key": "secFilingsLookbackMonths",
      "label": "SEC-filings exception look-back",
      "type": "duration"
    },
    {
      "key": "secFilingsExceptionScope",
      "label": "SEC-filings exception scope",
      "type": "text"
    },
    {
      "key": "solvencyRepDetails",
      "label": "Solvency rep — verbatim language",
      "type": "text"
    },
    {
      "key": "solvencyRepPresent",
      "label": "Solvency rep present",
      "type": "boolean"
    },
    {
      "key": "solvencyRepIncluded",
      "label": "Solvency Representation Included",
      "type": "boolean"
    },
    {
      "key": "specificPerformance",
      "label": "Specific Performance Available",
      "type": "boolean"
    },
    {
      "key": "specificPerformanceLimitations",
      "label": "Specific performance limitations",
      "type": "text"
    },
    {
      "key": "specificPerformanceMutual",
      "label": "Specific performance mutually available",
      "type": "boolean"
    },
    {
      "key": "sufficientFundsRepDetails",
      "label": "Sufficient Funds rep — verbatim language",
      "type": "text"
    },
    {
      "key": "sufficientFundsRepPresent",
      "label": "Sufficient Funds rep present",
      "type": "boolean"
    },
    {
      "key": "survivalPeriod",
      "label": "Survival Period",
      "type": "duration"
    },
    {
      "key": "terminationExceptionForBadBehavior",
      "label": "Termination exception for bad behavior",
      "type": "text"
    },
    {
      "key": "thirdPartyBeneficiaries",
      "label": "Third-Party Beneficiaries",
      "type": "list"
    },
    {
      "key": "thirdPartyBeneficiaryExceptions",
      "label": "Third-Party Beneficiary Exceptions",
      "type": "list"
    },
    {
      "key": "topCustomersSuppliersDefinition",
      "label": "Top Customers & Suppliers definition",
      "type": "text"
    },
    {
      "key": "topCustomersSuppliersRepPresent",
      "label": "Top Customers & Suppliers rep present",
      "type": "boolean"
    },
    {
      "key": "undisclosedLiabilitiesExceptions",
      "label": "Undisclosed-liabilities exceptions",
      "type": "list-tagged"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement",
      "type": "enum",
      "options": [
        "COMPANY",
        "PARENT",
        "BOTH"
      ]
    },
    {
      "key": "willfulBreachCoversOmissions",
      "label": "Willful Breach covers omissions",
      "type": "boolean"
    },
    {
      "key": "willfulBreachDefinition",
      "label": "Willful Breach defined",
      "type": "text"
    },
    {
      "key": "willfulBreachLimitedToMaterial",
      "label": "Willful Breach limited to material breaches",
      "type": "boolean"
    },
    {
      "key": "willfulBreachRequiresActualKnowledge",
      "label": "Willful Breach requires actual knowledge",
      "type": "boolean"
    }
  ],
  "MISC_BOILERPLATE": [
    {
      "key": "assignmentExceptions",
      "label": "Assignment exceptions",
      "type": "list"
    },
    {
      "key": "assignmentProvisos",
      "label": "Assignment provisos",
      "type": "list-tagged"
    },
    {
      "key": "assignmentRestrictions",
      "label": "Assignment restrictions",
      "type": "text"
    },
    {
      "key": "bondSecurityRequiredForSP",
      "label": "Bond / security required for specific performance",
      "type": "boolean"
    },
    {
      "key": "companyConsentForAssignment",
      "label": "Company consent required for assignment",
      "type": "boolean"
    },
    {
      "key": "companyRightToForceClose",
      "label": "Company right to force closing",
      "type": "boolean"
    },
    {
      "key": "companyForceCloseConditions",
      "label": "Company-force-close — conditions text",
      "type": "text"
    },
    {
      "key": "crossReferences",
      "label": "Cross References",
      "type": "list"
    },
    {
      "key": "jurisdictionExclusive",
      "label": "Exclusive Jurisdiction",
      "type": "boolean"
    },
    {
      "key": "feeExpenseAllocation",
      "label": "Fee / expense allocation",
      "type": "text"
    },
    {
      "key": "forumCourts",
      "label": "Forum court(s) named",
      "type": "list"
    },
    {
      "key": "forumFallback",
      "label": "Forum fallback if the primary court lacks jurisdiction",
      "type": "text"
    },
    {
      "key": "fraudCarveout",
      "label": "Fraud claims expressly preserved",
      "type": "text"
    },
    {
      "key": "governingLaw",
      "label": "Governing Law Jurisdiction",
      "type": "tagged"
    },
    {
      "key": "juryWaiver",
      "label": "Jury Trial Waiver",
      "type": "boolean"
    },
    {
      "key": "noExcusePostClosingPresent",
      "label": "No-excuse / no-recourse post-closing covenant present",
      "type": "boolean"
    },
    {
      "key": "noOtherRepsPresent",
      "label": "No-Other-Reps / Non-Reliance provision present",
      "type": "boolean"
    },
    {
      "key": "noSetoffPresent",
      "label": "No-setoff clause present",
      "type": "boolean"
    },
    {
      "key": "nonRelianceClause",
      "label": "Non-reliance disclaimer",
      "type": "text"
    },
    {
      "key": "noticesAddress",
      "label": "Notices Block (party + address + email + counsel cc) — verbatim",
      "type": "text"
    },
    {
      "key": "parentAssignmentConditions",
      "label": "Parent assignment — conditions text",
      "type": "list-tagged"
    },
    {
      "key": "parentAssignmentRight",
      "label": "Parent has assignment right",
      "type": "boolean"
    },
    {
      "key": "mainConcept",
      "label": "Provision",
      "type": "text"
    },
    {
      "key": "extraContractualClaimsWaived",
      "label": "Reliance on extra-contractual statements expressly disclaimed",
      "type": "boolean"
    },
    {
      "key": "repsSurvivalExceptions",
      "label": "Reps survival — exceptions text",
      "type": "text"
    },
    {
      "key": "repsSurvivalPresent",
      "label": "Reps survival clause present",
      "type": "boolean"
    },
    {
      "key": "repsSurvivalDuration",
      "label": "Reps survival duration",
      "type": "text"
    },
    {
      "key": "sectionNumber",
      "label": "Section Number",
      "type": "text"
    },
    {
      "key": "sectionTitle",
      "label": "Section Title",
      "type": "text"
    },
    {
      "key": "specificPerformance",
      "label": "Specific Performance Available",
      "type": "boolean"
    },
    {
      "key": "specificPerformanceLimitations",
      "label": "Specific performance limitations",
      "type": "text"
    },
    {
      "key": "specificPerformanceMutual",
      "label": "Specific performance mutually available",
      "type": "boolean"
    },
    {
      "key": "summary",
      "label": "Summary",
      "type": "text"
    },
    {
      "key": "terminationExceptionForBadBehavior",
      "label": "Termination exception for bad behavior",
      "type": "text"
    },
    {
      "key": "thirdPartyBeneficiaries",
      "label": "Third-Party Beneficiaries",
      "type": "list"
    },
    {
      "key": "thirdPartyBeneficiaryExceptions",
      "label": "Third-Party Beneficiary Exceptions",
      "type": "list"
    },
    {
      "key": "noOtherRepsParty",
      "label": "Whose reps are disclaimed beyond the agreement",
      "type": "enum",
      "options": [
        "COMPANY",
        "PARENT",
        "BOTH"
      ]
    },
    {
      "key": "willfulBreachCoversOmissions",
      "label": "Willful Breach covers omissions",
      "type": "boolean"
    },
    {
      "key": "willfulBreachDefinition",
      "label": "Willful Breach defined",
      "type": "text"
    },
    {
      "key": "willfulBreachLimitedToMaterial",
      "label": "Willful Breach limited to material breaches",
      "type": "boolean"
    },
    {
      "key": "willfulBreachRequiresActualKnowledge",
      "label": "Willful Breach requires actual knowledge",
      "type": "boolean"
    }
  ]
};

function fieldOption(provisionType, key) {
  return (FIELD_OPTIONS_BY_PROVISION_TYPE[provisionType] || []).find((o) => o.key === key) || null;
}

module.exports = { FIELD_OPTIONS_BY_PROVISION_TYPE, fieldOption };
