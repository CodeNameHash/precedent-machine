# WP-SCHEMA P1 Inventory Summary

Generated: 2026-07-16T09:37:27.371Z

## Counts

- Distinct feature-like keys: 517
- Keys in 2 or more source families: 473
- Keys in only 1 source family: 44
- Cross-source type mismatches: 6
- Schema shape mismatches: 33
- Provision types in rubric: 22
- Canonical codes in rubric: 276
- Taxonomy families exported: 55
- Curated expected-set codes: 38

## Naming Distribution

| Convention |Count |
| --- |--- |
| camelCase |486 |
| lowercase |24 |
| snake_case |7 |

## Source Coverage

| Source |Keys |
| --- |--- |
| category_summary_features_js |217 |
| expected_sets_js |195 |
| feature_validation_js |483 |
| rubric_js |471 |
| taxonomy_js |56 |
| ui |182 |

## Top 20 Highest-Appearance Keys

| Key |Appearances |Sources |
| --- |--- |--- |
| mainConcept |110 |expected_sets_js, feature_validation_js, rubric_js, ui |
| scheduleReference |28 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js |
| materialityQualifier |25 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, taxonomy_js, ui |
| crossReferences |23 |expected_sets_js, feature_validation_js, rubric_js |
| fiduciaryOutStandard |21 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, ui |
| matchingPeriod |21 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, ui |
| noOtherRepsParty |21 |expected_sets_js, feature_validation_js, rubric_js, ui |
| partyWhoCanTerminate |21 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| extraContractualClaimsWaived |20 |expected_sets_js, feature_validation_js, rubric_js |
| fraudCarveout |20 |expected_sets_js, feature_validation_js, rubric_js |
| nonRelianceClause |20 |expected_sets_js, feature_validation_js, rubric_js |
| noOtherRepsPresent |20 |expected_sets_js, feature_validation_js, rubric_js |
| bringDownStandard |19 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| initialMatchPeriodDays |19 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, ui |
| boardChangeStandard |18 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, ui |
| knowledgeScope |18 |expected_sets_js, feature_validation_js, rubric_js, ui |
| linkedBringDownStandard |18 |expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| knowledgeQualifier |17 |expected_sets_js, feature_validation_js, rubric_js, ui |
| materialContractsBuckets |17 |expected_sets_js, feature_validation_js, rubric_js, taxonomy_js, ui |
| materialityScrape |17 |expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |

## Cross-Source Type Mismatches

| Key |Declared Types |Normalised Types |
| --- |--- |--- |
| appliesToParty |tagged, text |tagged, string |
| burdensomeConditionScope |enum, text |enum, string |
| effortsStandard |enum, text |enum, string |
| knowledgeStandard |enum, tagged |enum, tagged |
| partyWhoCanTerminate |enum, tagged |enum, tagged |
| willfulBreachDefinition |boolean, text |boolean, string |

## Schema Shape Mismatches

Same feature key with multiple rubric labels, declared types, or enum option shapes. These are Phase 3 canonicalisation work items.

| Key |Rubric defs |Declared types |Labels |
| --- |--- |--- |--- |
| appliesToParty |2 |tagged, text |No-Inconsistent-Action — Party Bound; Which party the No-Inconsistent-Action prohibition applies to |
| burdensomeConditionInTerminationTriggers |2 |text |Burdensome-condition concept as a termination trigger (free text describing what it is); Burdensome condition in termination triggers |
| burdensomeConditionPresent |4 |boolean |Burdensome Condition present; Burdensome Condition Present |
| burdensomeConditionScope |4 |enum, text |Burdensome Condition scope; Burdensome Condition Scope |
| closingTimingProvisions |4 |text |Closing timing provisions (month-end kick-out, blackout, etc.); Closing timing provisions visible at the termination page (month-end kick-out, blackout, etc.) |
| crossReferences |5 |list |Cross References (other sections/articles referenced); Cross References (other defined terms or sections referenced); Cross References (other sections / defined terms / disclosure schedule citations) |
| dealStructure |3 |enum |Deal structure (one-step / two-step tender / SoA / asset / stock / etc.); Deal structure |
| disclosureLetterReference |2 |text |Company Disclosure Letter / Schedule reference; Parent Disclosure Letter / Schedule reference |
| effortsStandard |4 |enum, text |Efforts Standard; Standard of Efforts; Standard of Efforts (canonical short label only) |
| extensionConditions |2 |text |Outside Date Extension Conditions / Triggers; Extension Conditions / Triggers |
| faultBasedExclusion |6 |boolean |Fault-Based Exclusion (party at fault cannot invoke); Fault-Based Exclusion (party causing the restraint cannot invoke); Fault-Based Exclusion |
| filingDeadline |2 |text |Regulatory Filing Deadline (e.g., "Within 15 business days of signing"); Regulatory Filing Deadline (short text, e.g. "Within 15 business days of signing" or "Within 30 days") |
| knowledgeStandard |2 |enum, tagged |Knowledge Standard; Knowledge standard (ACTUAL / CONSTRUCTIVE / AFTER_INQUIRY / NA) |
| language |6 |text |Verbatim collar language; Verbatim solvency language; Verbatim anti-reliance language |
| mainConcept |61 |text |Provision; Provision (short deadline statement, e.g. "HSR filing within 15 business days of signing") |
| materialContractsBuckets |2 |list-tagged |Material Contracts rep buckets (from MATERIAL_CONTRACT_BUCKET_CODES); Material-contracts buckets — list of tagged items drawn from MATERIAL_CONTRACT_BUCKET_CODES |
| materialContractsDollarThresholds |2 |list |Material Contracts per-bucket dollar thresholds — array of { bucket, threshold }; Per-bucket dollar thresholds — array of { bucket, threshold } |
| materialContractsRedactionsPermitted |2 |boolean |Redactions to material contracts permitted; Redactions permitted |
| materialityQualifier |3 |object |Materiality Qualifier (section-wide); Materiality Qualifier (article-wide) |
| otherRegulatoryFilingDeadlines |2 |text |Other regulatory filing deadlines (free text — non-HSR jurisdictions, CFIUS, etc.); Other regulatory filing deadlines |
| pandemicCarveout |2 |boolean |Pandemic / COVID Carve-out (section-wide); Pandemic / COVID MAE Carve-Out |
| partyWhoCanTerminate |10 |enum, tagged |Party Who Can Terminate; Party Who Can Terminate (always "mutual" for this code); Party Who Can Invoke Extension |
| permittedExceptions |2 |list |Permitted Exceptions specific to THIS sub-clause — ONLY include text that genuinely begins with "except", "other than", "provided that", or "notwithstanding". Do NOT include every sub-clause. Do NOT include section-wide carve-outs (those live on the preamble).; Section-Wide Permitted Exceptions (the standard "Except as ... or with ..." carve-outs that apply across the entire IOC section) |
| permittedRedactionsDefinition |2 |text |Permitted-redactions definition (text); Permitted redactions definition (text) |
| regulatoryStrategyControl |2 |enum |Regulatory strategy control; Regulatory strategy control (legacy enum) |
| scheduleReference |5 |text |Schedule Reference (e.g. "Section 4.1 of the Company Disclosure Letter") — applies to the whole IOC section; Schedule Reference; Disclosure Schedule Cross-Reference for THIS rep |
| secFilingsExceptionLookback |2 |text |SEC-filings exception lookback (text, e.g. "since January 1, 2023"); SEC-filings exception lookback (text) |
| soleRemedy |2 |boolean |Fee is Sole and Exclusive Remedy (legacy alias for soleAndExclusiveRemedy); Fee is sole remedy for failure to clear regulatory review |
| triggerEvents |2 |list |Trigger Events (events that cause the fee to be payable); What Constitutes a Triggering Recommendation Change (e.g. withdrawal, modification, failure to reaffirm) |
| triggers |4 |list |Per-trigger array — list of { code, name, terminationClauses, feeAmount, feeAmountPct } (code from TERMF_TRIGGER_CODES; name is the plain-English trigger); Triggers (events that cause CVR payment); Triggers (e.g. failure to obtain antitrust clearance by outside date) |
| undisclosedLiabilitiesExceptions |2 |list-tagged |Undisclosed-liabilities exceptions; Undisclosed-liabilities exceptions (list of tagged items) |
| willfulBreachDefinition |2 |boolean, text |Willful Breach Defined; Willful Breach defined (text) |
| willfulBreachException |3 |boolean |Willful Breach Carve-out to Sole Remedy; Willful Breach Carve-out |

## Orphan Candidates

Keys in only one source family. These are candidates for dead-code review, not automatic deletion.

| Key |Source |Appearances |
| --- |--- |--- |
| alsoSurfacedAs |ui |2 |
| amendmentsRequirement |category_summary_features_js |1 |
| appliesTo |taxonomy_js |1 |
| baseSalaryStandard |category_summary_features_js |1 |
| benefitsStandard |category_summary_features_js |1 |
| bonusStandard |category_summary_features_js |1 |
| cashAmount |ui |1 |
| chapeauProviso |ui |1 |
| closingConditionsPrecedent |category_summary_features_js |1 |
| closingDeadline |ui |1 |
| curePeriod |category_summary_features_js |4 |
| extensionAvailable |category_summary_features_js |2 |
| extensionConsentParty |category_summary_features_js |2 |
| extensionTrigger |category_summary_features_js |2 |
| healthWelfareStandard |category_summary_features_js |1 |
| inlineDefinition |feature_validation_js |1 |
| iocAffirmativeScope |taxonomy_js |1 |
| iocAffirmativeStandard |taxonomy_js |1 |
| isNewCode |feature_validation_js |1 |
| jurisdiction |category_summary_features_js |1 |
| longTermIncentiveStandard |category_summary_features_js |1 |
| ltiStandard |category_summary_features_js |1 |
| maeStandaloneCondition |category_summary_features_js |2 |
| materialityQualifiers |taxonomy_js |1 |
| partOfRep |ui |1 |
| proposedCode |feature_validation_js |1 |
| proposedLabel |feature_validation_js |1 |
| proviso |ui |1 |
| reapplied_corrections |feature_validation_js |1 |
| region_id |ui |1 |
| regionId |ui |1 |
| relatedDefinitions |feature_validation_js |1 |
| section_number |ui |1 |
| severanceStandard |category_summary_features_js |1 |
| sort_order |feature_validation_js |1 |
| source_section |ui |1 |
| sourceSectionTitle |feature_validation_js |1 |
| sourceSectionType |feature_validation_js |1 |
| startChar |feature_validation_js |1 |
| survivingEntity |category_summary_features_js |1 |
| targetBonusStandard |category_summary_features_js |1 |
| triggerTerminationClauses |ui |1 |
| vestingStatus |taxonomy_js |1 |
| waiverStandard |category_summary_features_js |1 |

## UI-Only Keys

- alsoSurfacedAs
- cashAmount
- chapeauProviso
- closingDeadline
- partOfRep
- proviso
- region_id
- regionId
- section_number
- source_section
- triggerTerminationClauses
