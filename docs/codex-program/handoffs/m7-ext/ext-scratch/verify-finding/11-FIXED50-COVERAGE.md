# Fixed-50 typed-value coverage (Q-0011)

Each row is one of the 50 frozen review items. Claims are M4 analysis claims whose `source_node_occurrence_ids` intersect the item’s nodes. Typed-value kinds come from inspecting `legacy_claim_revision` fields, not headers. `NO_PRODUCER` means the key is not minted as a string in `*-parse.js` or `candidate-resolution.js` (comment mentions do not count).

- **COVERABLE_FROM_M4:** 41
- **PARTLY:** 3
- **NOT_AT_ALL:** 6
- Distinct claim keys with **NO_PRODUCER:** 14
- Intersecting claim rows: 60

| # | Family | Decision | Claim keys | Typed kinds | Producer | Coverage | One-line judgment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | EMPLOYEE_MATTERS | CORRECT | `EMPLOYEE_SERVICE_CREDIT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type the same-extent-as-pre-closing service-credit qualifier from the EMPLOYEE_SERVICE_CREDIT raw sentence M4 already holds. |
| 2 | TERMINATION | CORRECT | `TERMINATION_RIGHT_GRANT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **NOT_AT_ALL** | Needs a fact no producer emits on this node: termination-right cure/condition prerequisites and the reciprocal-breach proviso. Intersecting claim raw is only the 86-character trigger opening. |
| 3 | GENERAL_COVENANTS | CORRECT | `GENERAL_COVENANT_PRESENT` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; Ben accepted the existing GENERAL_COVENANT_PRESENT enum. |
| 4 | CLOSING_CONDITIONS | INCORRECT | `LEGAL_RESTRAINT_CONDITION` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Note is a chapeau-visibility remark, not a missing legal fact. LEGAL_RESTRAINT_CONDITION already holds presence plus the restraint sentence. |
| 5 | MAE_DEFINITION | CORRECT | `MAE_DEFINITION_PRONG` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; MAE_DEFINITION_PRONG already holds BUSINESS_EFFECTS. |
| 6 | KEY_DEFINED_TERMS | INCORRECT | `WILLFUL_BREACH_DEFINITION`<br>`WILLFUL_BREACH_KNOWLEDGE_STANDARD` | presence_boolean, untyped_whole_sentence_raw<br>enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type dual-knowledge and intent-as-to-material-breach from WILLFUL_BREACH_KNOWLEDGE_STANDARD (ACTUAL_OR_CONSTRUCTIVE plus the limb quote M4 already holds). |
| 7 | REPRESENTATIONS | INCORRECT | `M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **NOT_AT_ALL** | Needs a fact no producer emits on this source-provision blob: representing party. Raw is a share-count list with no party field. |
| 8 | INTERIM_OPERATING | INCORRECT | `IOC_RESTRICTION_PRESENT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type the materiality-to-amend and material-benefit-plan qualifiers from the IOC_RESTRICTION_PRESENT raw sentence M4 already holds. |
| 9 | NO_SHOP | INCORRECT | `NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS` | numeric, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **PARTLY** | Subsequent-match 3 Business Days is already typed on NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS. Still needs the inherited initial Superior Proposal Notice Period days. |
| 10 | DNO_INDEMNIFICATION | INCORRECT | `INDEMNIFICATION_CONTINUATION` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type the charter/bylaws/agreement source of indemnification from the INDEMNIFICATION_CONTINUATION raw sentence M4 already holds. |
| 11 | NO_OTHER_REPS_FRAUD | CORRECT | `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | No demanded legal content; disclaimer presence is already held. |
| 12 | ANTITRUST_REGULATORY | CORRECT | `REGULATORY_CONSULTATION_RIGHT` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; REGULATORY_CONSULTATION_RIGHT already holds GOOD_FAITH_VIEWS. |
| 13 | APPRAISAL_DISSENTERS_RIGHTS | INCORRECT | `APPRAISAL_SETTLEMENT_CONSENT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type constrained party (Company) and consent-of party (Parent) from the APPRAISAL_SETTLEMENT_CONSENT raw sentence M4 already holds. |
| 14 | CAPITALISATION | INCORRECT | `M7_DETERMINISTIC_CAPITALISATION_SOURCE_PROVISION`<br>`M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type/classify the held source-provision blob as a company capitalisation representation (M4 already emits CAPITALISATION_SOURCE_PROVISION on this node). |
| 15 | CONSIDERATION | CORRECT | `APPRAISAL_RIGHTS_STATUS` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No additional legal fact demanded; note is a page-number source artefact on an already-typed APPRAISAL_RIGHTS_STATUS enum. |
| 16 | DIVIDENDS | CORRECT | `DIVIDEND_COORDINATION_COVENANT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; dividend-coordination presence is already held. |
| 17 | FINANCING_COVENANTS | CORRECT | `NO_FINANCING_CONDITION_ACKNOWLEDGMENT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; no-financing-condition acknowledgment is already held. |
| 18 | GUARANTY_FINANCING_PARTY | INCORRECT | `LIMITED_GUARANTY_DELIVERED` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type guarantor and beneficiary from guarantor_ref plus the raw “to the Company” sentence M4 already holds. |
| 19 | MATERIAL_CONTRACTS | INCORRECT | `MATERIAL_CONTRACT_BUCKET_PRESENT` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **PARTLY** | Business/geographic-region scope and materiality-to-company-as-a-whole are in the NONCOMPETE raw. MFN is not held on this claim. |
| 20 | MERGER_STRUCTURE_CLOSING | INCORRECT | `MERGER_STRUCTURE_MECHANIC_PRESENT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type the mechanic as post-closing company bylaws from the MERGER_STRUCTURE_MECHANIC_PRESENT raw sentence M4 already holds. |
| 21 | MISC_BOILERPLATE | CORRECT | `MISC_BOILERPLATE_MECHANIC_PRESENT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; boilerplate mechanic presence is already held. |
| 22 | PROXY_MEETING | CORRECT | `MEETING_ADJOURNMENT_REASON`<br>`MEETING_ADJOURNMENT_REASON` | enum, untyped_whole_sentence_raw<br>enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type the counsel-consultation and stockholder-dissemination test from the MEETING_ADJOURNMENT_REASON raw sentence M4 already holds. |
| 23 | SPECIFIC_PERFORMANCE_REMEDIES | CORRECT | `SPECIFIC_PERFORMANCE_REMEDY_PRESENT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **NOT_AT_ALL** | Needs facts no producer emits on this node: outside-date tolling on a specific-performance action, and a financing-source no-liability bar. Intersecting raw is only the standard irreparable-harm grant. |
| 24 | TAX_MATTERS | CORRECT | `TAX_TREATMENT_PROTECTION_COVENANT` | presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **NOT_AT_ALL** | Needs facts no producer emits on this node: the change-in-law tax-treatment carveout and the alternative-structure cooperation proviso. Intersecting raw is only the main protection covenant. |
| 25 | TERMINATION_FEE | INCORRECT | `TERMINATION_FEE_AMOUNT` | numeric, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **NOT_AT_ALL** | Needs a fact no intersecting claim holds: termination-fee trigger limb Section 7.01(f). M4 on this node holds only TERMINATION_FEE_AMOUNT. |
| 26 | REPRESENTATIONS | CORRECT | `M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | No demanded legal content; source-provision presence is already held. |
| 27 | REPRESENTATIONS | INCORRECT | `M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type as an IP-assignment representation with the material-IP and company-materiality qualifiers from the source-provision raw and INTELLECTUAL_PROPERTY topic M4 already holds. |
| 28 | DNO_INDEMNIFICATION | INCORRECT | `ADVANCEMENT_OF_EXPENSES`<br>`CHARTER_PROTECTION_CONTINUATION` | presence_boolean, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type exculpation/indemnification, charter/bylaw source, and the six-year keep-in-place duration from the ADVANCEMENT_OF_EXPENSES and CHARTER_PROTECTION_CONTINUATION raw sentences M4 already holds. |
| 29 | MAE_DEFINITION | CORRECT | `MAE_DEFINITION_PRONG` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; MAE_DEFINITION_PRONG already holds CONSUMMATION_PREVENTION. |
| 30 | NO_OTHER_REPS_FRAUD | CORRECT | `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | No demanded legal content; disclaimer presence is already held. |
| 31 | NO_SHOP | INCORRECT | `NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE` | enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **PARTLY** | Rule 14d-9 / 14e-2 safe-disclosure is already typed. Still needs the change-of-recommendation-effect proviso and outside-counsel consultation, which this claim’s raw does not hold. |
| 32 | KEY_DEFINED_TERMS | CORRECT | `KNOWLEDGE_PERSON_SOURCE`<br>`KNOWLEDGE_STANDARD` | enum, untyped_whole_sentence_raw<br>enum | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; knowledge person-source and knowledge standard enums are already held. |
| 33 | MAE_DEFINITION | INCORRECT | `MAE_CARVEOUT`<br>`MAE_DISPROPORTIONALITY_CARVEBACK` | enum, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type party, GAAP-and-Law carveout, industry-relative baseline, and disproportionality from MAE_CARVEOUT / MAE_DISPROPORTIONALITY_CARVEBACK values M4 already holds. |
| 34 | MAE_DEFINITION | INCORRECT | `MAE_CARVEOUT`<br>`MAE_DISPROPORTIONALITY_CARVEBACK` | enum, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type terrorism, war, national-disaster, and cyber-attack subtypes from the ACTS_OF_WAR_TERRORISM raw sentence M4 already holds. |
| 35 | MAE_DEFINITION | CORRECT | `MAE_CARVEOUT`<br>`MAE_DISPROPORTIONALITY_CARVEBACK` | enum, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Same as the prior MAE carveout: re-type listed subtypes and the industry-relative disproportionality already held on this node. |
| 36 | MAE_DEFINITION | INCORRECT | `MAE_CARVEOUT`<br>`MAE_DISPROPORTIONALITY_CARVEBACK` | enum, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | Re-type currency-exchange and interest-rate subtypes from the FINANCIAL_MARKETS raw sentence M4 already holds. |
| 37 | MATERIAL_CONTRACTS | CORRECT | `MATERIAL_CONTRACT_BUCKET_PRESENT`<br>`MATERIAL_CONTRACT_THRESHOLD_STRUCTURE` | enum, untyped_whole_sentence_raw<br>enum, untyped_whole_sentence_raw | `lib/canonical-v2/native-producer/candidate-resolution.js` | **COVERABLE_FROM_M4** | No demanded legal content; indebtedness bucket and USD threshold structure are already held. |
| 38 | ANTITRUST_REGULATORY | INCORRECT | `M7_DETERMINISTIC_ANTITRUST_REGULATORY_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type as a bilateral reasonable-best-efforts antitrust covenant from the source-provision raw M4 already holds. |
| 39 | — | INCORRECT | — | — | — | **NOT_AT_ALL** | Needs a fact no producer emits today: nested clause-number identity. The item has no source_node_occurrence_ids and no intersecting M4 claim. |
| 40 | CLOSING_CONDITIONS | INCORRECT | `M7_DETERMINISTIC_CLOSING_CONDITIONS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type the held source-provision sentence as a stockholder-approval closing condition. |
| 41 | CONSIDERATION | INCORRECT | `M7_DETERMINISTIC_CONSIDERATION_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | No comparison-entry legal fact demanded; note approves a mechanics provision without comparison. |
| 42 | DNO_INDEMNIFICATION | INCORRECT | `M7_DETERMINISTIC_DNO_INDEMNIFICATION_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type the held source-provision blob as D&O indemnification (same source-of-obligation content as the earlier indemnification note). |
| 43 | EMPLOYEE_MATTERS | INCORRECT | `M7_DETERMINISTIC_EMPLOYEE_MATTERS_SOURCE_PROVISION`<br>`M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw<br>presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type ERISA-representation topic, representing party (Company), and the six-year lookback from the source-provision raw M4 already holds. |
| 44 | GENERAL_COVENANTS | INCORRECT | `M7_DETERMINISTIC_GENERAL_COVENANTS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type access scope, purpose, and notice/hours/non-interference restrictions from the source-provision raw M4 already holds. |
| 45 | INTERIM_OPERATING | INCORRECT | `M7_DETERMINISTIC_INTERIM_OPERATING_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | No demanded legal content in the note; only an untyped source-provision blob is present. |
| 46 | KEY_DEFINED_TERMS | INCORRECT | `M7_DETERMINISTIC_KEY_DEFINED_TERMS_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type the held source-provision blob as an Acquired Companies definition and drop the intro text. |
| 47 | MAE_DEFINITION | INCORRECT | `M7_DETERMINISTIC_MAE_DEFINITION_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type the held source-provision blob as an MAE definition. |
| 48 | MAE_DEFINITION | INCORRECT | `M7_DETERMINISTIC_MAE_DEFINITION_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type parent-MAE impairment factors (prevent / materially delay / materially impair) and the consummation limb from the raw sentence M4 already holds. |
| 49 | MERGER_STRUCTURE_CLOSING | INCORRECT | `M7_DETERMINISTIC_MERGER_STRUCTURE_CLOSING_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type the held source-provision blob as merger topology / form-of-merger. |
| 50 | MISC_BOILERPLATE | INCORRECT | `M7_DETERMINISTIC_MISC_BOILERPLATE_SOURCE_PROVISION` | presence_boolean, untyped_whole_sentence_raw | `NO_PRODUCER` | **COVERABLE_FROM_M4** | Re-type the held source-provision blob as an entire-agreement boilerplate provision. |

## Summary

| Category | Count |
| --- | ---: |
| COVERABLE_FROM_M4 | 41 |
| PARTLY | 3 |
| NOT_AT_ALL | 6 |
| Total | 50 |

## NO_PRODUCER keys

Each key was grepped in `lib/canonical-v2/native-producer/*-parse.js` and `candidate-resolution.js`. A comment mention is not a mint.

### `M7_DETERMINISTIC_ANTITRUST_REGULATORY_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_ANTITRUST_REGULATORY_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_CAPITALISATION_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_CAPITALISATION_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_CLOSING_CONDITIONS_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_CLOSING_CONDITIONS_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_CONSIDERATION_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_CONSIDERATION_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_DNO_INDEMNIFICATION_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_DNO_INDEMNIFICATION_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_EMPLOYEE_MATTERS_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_EMPLOYEE_MATTERS_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_GENERAL_COVENANTS_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_GENERAL_COVENANTS_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_INTERIM_OPERATING_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_INTERIM_OPERATING_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_KEY_DEFINED_TERMS_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_KEY_DEFINED_TERMS_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_MAE_DEFINITION_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_MAE_DEFINITION_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_MERGER_STRUCTURE_CLOSING_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_MERGER_STRUCTURE_CLOSING_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_MISC_BOILERPLATE_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_MISC_BOILERPLATE_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

### `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT`

```
$ rg -n -F --glob *-parse.js --glob candidate-resolution.js NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT lib/canonical-v2/native-producer
exit 1
(empty)
```

Files searched: lib/canonical-v2/native-producer/antitrust-regulatory-parse.js, lib/canonical-v2/native-producer/cure-period-parse.js, lib/canonical-v2/native-producer/defined-term-threshold-parse.js, lib/canonical-v2/native-producer/exchange-ratio-parse.js, lib/canonical-v2/native-producer/financing-day-count-parse.js, lib/canonical-v2/native-producer/ioc-threshold-parse.js, lib/canonical-v2/native-producer/mae-clause-label-parse.js, lib/canonical-v2/native-producer/measurement-date-parse.js, lib/canonical-v2/native-producer/no-shop-period-parse.js, lib/canonical-v2/native-producer/per-share-cash-parse.js, lib/canonical-v2/native-producer/proxy-meeting-count-parse.js, lib/canonical-v2/native-producer/schedule-reference-parse.js, lib/canonical-v2/native-producer/share-count-parse.js, lib/canonical-v2/native-producer/termination-deadline-parse.js, lib/canonical-v2/native-producer/termination-fee-parse.js, lib/canonical-v2/native-producer/candidate-resolution.js

