# Undiagnosed (family, reason_code) pairs — the coverage gap

Every row below is a `(family, reason_code)` pair from the corpus that carries
**no substantive diagnosis in any of the six (seven, counting the
diag-closing-conditions.md stub) diagnostic notes.** Ranked by occurrence count,
descending, since that is the order the work should be done in.

**90 distinct (family, reason_code) pairs, 732 occurrences —
732/4,241 = 17.3% of all reason-code occurrences in the corpus.**

Four rows (`CONDITION_KIND_UNCORROBORATED`, `PARTY_UNRESOLVED` [3 of its 4 family rows],
`OBLIGOR_REF_UNCORROBORATED` [1 of its 2 family rows]) are *named* in
`diag-closing-conditions.md`'s scope header, but that note has no investigation
body (`(sections below filled in as investigation proceeds)` — never filled in).
A named-but-empty scope is treated as undiagnosed, not as diagnosed, per the
brief's rule against assigning to the nearest plausible diagnosis.

`Best-first-guess code location` comes from grepping the resolver at
`origin/cursor/step-2x-free-phase-b641` for the literal reason string (or, where
the string is template-built at runtime, e.g. `` `${kind}_UNCORROBORATED` ``, from
locating the template site and the enum value that produces it). It is a
starting point for the next investigator, not a verified root-cause diagnosis.

---

| # | Count | State | Family | Reason code |
|---|---|---|---|---|
| 1 | 91 | OPEN_WORLD | REPRESENTATIONS | `REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED` |
| 2 | 76 | RESOLVED-blocked | KEY_DEFINED_TERMS | `MULTI_SPAN_COMPOSED` |
| 3 | 76 | RESOLVED-blocked | KEY_DEFINED_TERMS | `NESTED_OR_CROSS_REFERENCED_EVIDENCE` |
| 4 | 66 | OPEN_WORLD | MATERIAL_CONTRACTS | `MATERIAL_CONTRACT_BUCKET_UNCORROBORATED` |
| 5 | 34 | HELD | CLOSING_CONDITIONS | `CONDITION_KIND_UNCORROBORATED` |
| 6 | 24 | OPEN_WORLD | GENERAL_COVENANTS | `GENERAL_COVENANT_CODE_UNCORROBORATED` |
| 7 | 19 | HELD | MAE_DEFINITION | `MAE_CARVEOUT_UNCORROBORATED` |
| 8 | 19 | HELD | NO_SHOP | `NO_SHOP_PERIOD_ROLE_UNCORROBORATED` |
| 9 | 19 | HELD | NO_SHOP | `NO_SHOP_PREREQUISITE_UNCORROBORATED` |
| 10 | 18 | HELD | DNO_INDEMNIFICATION | `DNO_KIND_UNCORROBORATED` |
| 11 | 15 | OPEN_WORLD | MATERIAL_CONTRACTS | `MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED` |
| 12 | 14 | HELD | MAE_DEFINITION | `PARTY_UNRESOLVED` |
| 13 | 13 | HELD | NO_SHOP | `RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED` |
| 14 | 12 | HELD | EMPLOYEE_MATTERS | `ITEM_OR_STANDARD_UNCORROBORATED` |
| 15 | 11 | HELD | NO_SHOP | `NO_SHOP_ACTION_UNCORROBORATED` |
| 16 | 10 | HELD | TERMINATION | `TRIGGER_KIND_UNCORROBORATED` |
| 17 | 8 | HELD | FINANCING_COVENANTS | `ASSERTION_KIND_UNCORROBORATED` |
| 18 | 8 | HELD | CLOSING_CONDITIONS | `PARTY_UNRESOLVED` |
| 19 | 8 | HELD | ANTITRUST_REGULATORY | `OBLIGOR_SCOPE_UNCORROBORATED` |
| 20 | 8 | HELD | NO_SHOP | `COVENANT_OBLIGOR_NOT_IN_QUOTE` |
| 21 | 7 | HELD | CLOSING_CONDITIONS | `REP_SIDE_UNCORROBORATED` |
| 22 | 7 | HELD | EMPLOYEE_MATTERS | `EMPLOYEE_KIND_UNCORROBORATED` |
| 23 | 7 | HELD | TERMINATION | `TERMINATING_PARTY_REF_NOT_IN_QUOTE` |
| 24 | 7 | HELD | KEY_DEFINED_TERMS | `DEFINED_TERM_REF_NOT_IN_HEAD` |
| 25 | 7 | OPEN_WORLD | TAX_MATTERS | `TAX_TREATMENT_KIND_UNCORROBORATED` |
| 26 | 5 | OPEN_WORLD | TERMINATION_FEE | `SOLE_REMEDY_FEE_CONTEXT_LINKED` |
| 27 | 5 | HELD | CLOSING_CONDITIONS | `OBLIGOR_REF_UNCORROBORATED` |
| 28 | 5 | OPEN_WORLD | EMPLOYEE_MATTERS | `EMPLOYEE_ITEM_OR_STANDARD_OUT_OF_VOCABULARY` |
| 29 | 5 | HELD | EMPLOYEE_MATTERS | `MONTH_COUNT_UNRESOLVED` |
| 30 | 5 | HELD | ANTITRUST_REGULATORY | `NOTIFICATION_OBLIGATION_UNCORROBORATED` |
| 31 | 5 | HELD | TERMINATION | `PERIOD_KIND_UNCORROBORATED` |
| 32 | 5 | OPEN_WORLD | APPRAISAL_DISSENTERS_RIGHTS | `APPRAISAL_ASSERTION_OPEN_WORLD` |
| 33 | 5 | OPEN_WORLD | TAX_MATTERS | `TAX_ASSERTION_OPEN_WORLD` |
| 34 | 4 | HELD | FINANCING_COVENANTS | `FINANCING_SCOPE_UNCORROBORATED` |
| 35 | 4 | HELD | INTERIM_OPERATING | `IOC_ATTACHMENT_TARGET_ZERO_MATCHES` |
| 36 | 4 | OPEN_WORLD | INTERIM_OPERATING | `IOC_LONG_TAIL_RESTRICTION_OPEN_WORLD` |
| 37 | 4 | HELD | ANTITRUST_REGULATORY | `FILING_REGIME_NOT_SINGLE_NAMED_REGIME` |
| 38 | 4 | HELD | NO_SHOP | `FIDUCIARY_ENGAGEMENT_STANDARD_UNCORROBORATED` |
| 39 | 4 | HELD | NO_SHOP | `STANDSTILL_ACTION_UNCORROBORATED` |
| 40 | 3 | HELD | PROXY_MEETING | `NO_DAY_COUNT` |
| 41 | 3 | HELD | ANTITRUST_REGULATORY | `CONSULTATION_RIGHT_UNCORROBORATED` |
| 42 | 3 | HELD | ANTITRUST_REGULATORY | `INFORMATION_SHARING_OBLIGATION_UNCORROBORATED` |
| 43 | 3 | HELD | ANTITRUST_REGULATORY | `BURDEN_COMMITMENT_UNCORROBORATED` |
| 44 | 3 | OPEN_WORLD | NO_SHOP | `NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD` |
| 45 | 3 | HELD | NO_SHOP | `NON_LITERAL_NUMERAL` |
| 46 | 3 | HELD | GENERAL_COVENANTS | `PARTY_UNRESOLVED` |
| 47 | 2 | HELD | FINANCING_COVENANTS | `NON_LITERAL_NUMERAL` |
| 48 | 2 | HELD | PROXY_MEETING | `ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED` |
| 49 | 2 | HELD | PROXY_MEETING | `MEETING_REF_ABSENT` |
| 50 | 2 | OPEN_WORLD | TERMINATION_FEE | `SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED` |
| 51 | 2 | HELD | TERMINATION_FEE | `ANNIVERSARY_PHRASE` |
| 52 | 2 | HELD | CLOSING_CONDITIONS | `MAE_PARTY_UNCORROBORATED` |
| 53 | 2 | HELD | CLOSING_CONDITIONS | `APPROVAL_KIND_UNCORROBORATED` |
| 54 | 2 | HELD | DNO_INDEMNIFICATION | `PERCENT_UNRESOLVED` |
| 55 | 2 | HELD | DNO_INDEMNIFICATION | `YEAR_COUNT_UNRESOLVED` |
| 56 | 2 | HELD | ANTITRUST_REGULATORY | `LITIGATION_OBLIGATION_UNCORROBORATED` |
| 57 | 2 | HELD | ANTITRUST_REGULATORY | `OBLIGOR_REF_UNCORROBORATED` |
| 58 | 2 | HELD | TERMINATION | `NO_CALENDAR_DATE` |
| 59 | 2 | HELD | NO_SHOP | `RECOMMENDATION_CHANGE_TRIGGER_UNCORROBORATED` |
| 60 | 2 | HELD | NO_SHOP | `RECOMMENDATION_SAFE_DISCLOSURE_UNCORROBORATED` |
| 61 | 2 | HELD | NO_SHOP | `RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD_UNCORROBORATED` |
| 62 | 2 | HELD | KEY_DEFINED_TERMS | `STANDARD_CODE_OUT_OF_ENUM` |
| 63 | 2 | HELD | KEY_DEFINED_TERMS | `NO_PERCENT_LITERAL` |
| 64 | 2 | HELD | KEY_DEFINED_TERMS | `RECORDED_DEFINITION_ENVELOPE_UNCORROBORATED` |
| 65 | 2 | HELD | KEY_DEFINED_TERMS | `MULTIPLE_PERCENT_LITERALS` |
| 66 | 1 | HELD | FINANCING_COVENANTS | `MULTIPLE_DAY_COUNTS` |
| 67 | 1 | HELD | CONSIDERATION | `NO_MONEY_LITERAL` |
| 68 | 1 | HELD | CONSIDERATION | `RATIO_CONTEXT_UNCORROBORATED` |
| 69 | 1 | HELD | PROXY_MEETING | `CONTROL_PARTY_REF_UNCORROBORATED` |
| 70 | 1 | HELD | PROXY_MEETING | `CONTROL_PARTY_REF_NOT_IN_QUOTE` |
| 71 | 1 | HELD | PROXY_MEETING | `DOCUMENT_REF_NOT_IN_QUOTE` |
| 72 | 1 | HELD | TERMINATION_FEE | `NON_LITERAL_NUMERAL` |
| 73 | 1 | HELD | CLOSING_CONDITIONS | `CERTIFIED_CONDITION_REF_NOT_IN_QUOTE` |
| 74 | 1 | HELD | CLOSING_CONDITIONS | `SCRAPE_QUOTE_NOT_IN_QUOTE` |
| 75 | 1 | HELD | GUARANTY_FINANCING_PARTY | `GTY_KIND_UNCORROBORATED` |
| 76 | 1 | OPEN_WORLD | REPRESENTATIONS | `REPRESENTATION_SIDE_UNRESOLVED` |
| 77 | 1 | HELD | REPRESENTATIONS | `QUALIFIER_KIND_DISAGREEMENT` |
| 78 | 1 | HELD | ANTITRUST_REGULATORY | `WITHDRAWAL_EXCEPTION_PERIOD_UNCORROBORATED` |
| 79 | 1 | HELD | ANTITRUST_REGULATORY | `COOPERATION_OBLIGATION_UNCORROBORATED` |
| 80 | 1 | HELD | ANTITRUST_REGULATORY | `STRATEGY_CONTROL_UNCORROBORATED` |
| 81 | 1 | HELD | ANTITRUST_REGULATORY | `OBLIGOR_REF_NOT_IN_QUOTE` |
| 82 | 1 | HELD | ANTITRUST_REGULATORY | `PARTY_UNRESOLVED` |
| 83 | 1 | HELD | ANTITRUST_REGULATORY | `INFORMATION_PROTECTION_UNCORROBORATED` |
| 84 | 1 | HELD | ANTITRUST_REGULATORY | `NON_IMPEDIMENT_COVENANT_UNCORROBORATED` |
| 85 | 1 | HELD | ANTITRUST_REGULATORY | `FILING_OBLIGATION_UNCORROBORATED` |
| 86 | 1 | HELD | MAE_DEFINITION | `CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE` |
| 87 | 1 | HELD | NO_SHOP | `REPRESENTATIVE_CONTROL_STANDARD_UNCORROBORATED` |
| 88 | 1 | HELD | KEY_DEFINED_TERMS | `SUBSTITUTION_UNCORROBORATED` |
| 89 | 1 | OPEN_WORLD | GENERAL_COVENANTS | `GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED` |
| 90 | 1 | OPEN_WORLD | MERGER_STRUCTURE_CLOSING | `MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE` |

---

## Detail, ranked by count

### 1. `REPRESENTATIONS · REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED` — 91 occurrences, OPEN_WORLD

- **Representative quote** (card #953, concho-representations-r1a-20260809-2xk-final, §§ 4.11, kind `NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE`):
  > to the knowledge of the Company
- **Best-first-guess code location**: candidate-resolution.js:9833 (representation qualifier handler, KNOWLEDGE-standard-value branch, distinct from the exact-quote-form gate diagnosed as REPRESENTATION_QUALIFIER_KIND_NOT_EXACT at ~9592)

### 2. `KEY_DEFINED_TERMS · MULTI_SPAN_COMPOSED` — 76 occurrences, RESOLVED-blocked

- **Representative quote** (card #3406, concho-key-defined-terms-20260809-2xk-final, §§ Annex-A, kind `INTERVENING_EVENT_EXCLUSION`):
  > any Effect relating to the Company or any of its Subsidiaries that does not amount to a Material Adverse Effect, individually or in the aggregate
- **Best-first-guess code location**: candidate-resolution.js:5910 (KEY_DEFINED_TERMS evidence-quality gate, sets a RESOLVED-blocking reason alongside NESTED_OR_CROSS_REFERENCED_EVIDENCE)

### 3. `KEY_DEFINED_TERMS · NESTED_OR_CROSS_REFERENCED_EVIDENCE` — 76 occurrences, RESOLVED-blocked

- **Representative quote** (card #3406, concho-key-defined-terms-20260809-2xk-final, §§ Annex-A, kind `INTERVENING_EVENT_EXCLUSION`):
  > any Effect relating to the Company or any of its Subsidiaries that does not amount to a Material Adverse Effect, individually or in the aggregate
- **Best-first-guess code location**: candidate-resolution.js:5911 (same gate as MULTI_SPAN_COMPOSED, adjacent line)

### 4. `MATERIAL_CONTRACTS · MATERIAL_CONTRACT_BUCKET_UNCORROBORATED` — 66 occurrences, OPEN_WORLD

- **Representative quote** (card #3675, concho-material-contracts-20260809-2xk-final, §§ 4.19, kind `NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE`):
  > each agreement under which the Company or any of its Subsidiaries has advanced or loaned any amount of money to any of its officers, directors, employees or consultants, in each case with a principal amount in excess of $120,000
- **Best-first-guess code location**: candidate-resolution.js:4764 (material-contracts bucket classification helper)

### 5. `CLOSING_CONDITIONS · CONDITION_KIND_UNCORROBORATED` — 34 occurrences, HELD

- **Representative quote** (card #781, concho-closing-conditions-20260809-2xk-final, §§ 7.4, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > such failure was caused by such Party’s breach in any material respect of any provision of this Agreement.
- **Best-first-guess code location**: candidate-resolution.js:5058, 5103 (handleClosingConditionCandidate, two separate corroboration checks)

### 6. `GENERAL_COVENANTS · GENERAL_COVENANT_CODE_UNCORROBORATED` — 24 occurrences, OPEN_WORLD

- **Representative quote** (card #3544, concho-general-covenants-20260809-2xk-final, §§ 6.14, kind `NATIVE_GENERAL_COVENANT_FURTHER_PRESENT_CANDIDATE`):
  > each of the Parties shall use reasonable best efforts to take, or cause to be taken, all actions, and to do, or cause to be done, and to assist and cooperate with the other Party in doing, all things necessary, proper or advisable to consummate and make effective, in the most expeditious manner reas…
- **Best-first-guess code location**: candidate-resolution.js:4873-4874 (general-covenant code classification helper, same value returned on two branches)

### 7. `MAE_DEFINITION · MAE_CARVEOUT_UNCORROBORATED` — 19 occurrences, HELD

- **Representative quote** (card #2754, metsera-mae-definition-20260809-2xk-final, §§ 9.03, kind `NATIVE_MAE_CARVEOUT_CANDIDATE`):
  > (C) changes after the date hereof in applicable Law or GAAP (or the authoritative interpretation thereof)
- **Best-first-guess code location**: candidate-resolution.js:9048 (pushMaeReview call in MAE carveout handling)

### 8. `NO_SHOP · NO_SHOP_PERIOD_ROLE_UNCORROBORATED` — 19 occurrences, HELD

- **Representative quote** (card #2974, concho-no-shop-20260809-2xk-final, §§ 6.4, kind `NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE`):
  > 48 hours
- **Best-first-guess code location**: candidate-resolution.js:8564 (handleNoShopPeriodCandidate)

### 9. `NO_SHOP · NO_SHOP_PREREQUISITE_UNCORROBORATED` — 19 occurrences, HELD

- **Representative quote** (card #2979, concho-no-shop-20260809-2xk-final, §§ 6.3, kind `NATIVE_NO_SHOP_EXCEPTION_PREREQUISITE_CANDIDATE`):
  > such Company Competing Proposal did not arise from a breach of the obligations set forth in this Section 6.3
- **Best-first-guess code location**: candidate-resolution.js:8530 (handleNoShopExceptionPrerequisiteCandidate)

### 10. `DNO_INDEMNIFICATION · DNO_KIND_UNCORROBORATED` — 18 occurrences, HELD

- **Representative quote** (card #2564, concho-dno-indemnification-20260809-2xk-final, §§ 6.10, kind `NATIVE_DNO_CANDIDATE`):
  > if the cost of such insurance coverage exceeds such amount, the Surviving Corporation shall obtain a policy with the greatest coverage available for a cost not exceeding such amount.
- **Best-first-guess code location**: candidate-resolution.js:9882 (employee D&O indemnification kind-pattern table, reviewEmployeeDno)

### 11. `MATERIAL_CONTRACTS · MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED` — 15 occurrences, OPEN_WORLD

- **Representative quote** (card #3677, concho-material-contracts-20260809-2xk-final, §§ 4.19, kind `NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE`):
  > each “material contract” (as such term is defined in Item 601(b)(10) of Regulation S-K under the Exchange Act)
- **Best-first-guess code location**: candidate-resolution.js:4768 (same helper as MATERIAL_CONTRACT_BUCKET_UNCORROBORATED)

### 12. `MAE_DEFINITION · PARTY_UNRESOLVED` — 14 occurrences, HELD

- **Representative quote** (card #2742, concho-mae-definition-20260809-2xk-final, §§ Annex-A, kind `NATIVE_MAE_CARVEOUT_CANDIDATE`):
  > general economic conditions (or changes in such conditions) or conditions in the global economy generally;
- **Best-first-guess code location**: candidate-resolution.js:5014 and 5076 (handleClosingConditionCandidate, two branches); also raised at 8665 for NO_SHOP wave-B (zero occurrences in this corpus) and generically wherever resolveParty() returns null for MAE_DEFINITION/GENERAL_COVENANTS/ANTITRUST_REGULATORY handlers

### 13. `NO_SHOP · RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED` — 13 occurrences, HELD

- **Representative quote** (card #2995, concho-no-shop-20260809-2xk-final, §§ 6.4, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > fail to recommend, in a Solicitation/Recommendation Statement on Schedule -53- 14D-9, against acceptance of such tender offer or exchange offer
- **Best-first-guess code location**: candidate-resolution.js:8643 -- template-built `${assertionKind}_UNCORROBORATED` inside handleNoShopWaveBCandidate (~8605), fires when noShopWaveBValueCorroborated() fails for assertion_kind=RECOMMENDATION_CHANGE_ACTION

### 14. `EMPLOYEE_MATTERS · ITEM_OR_STANDARD_UNCORROBORATED` — 12 occurrences, HELD

- **Representative quote** (card #2486, concho-employee-matters-20260809-2xk-final, §§ 6.9, kind `NATIVE_EMPLOYEE_MATTERS_CANDIDATE`):
  > a Company Employee’s base compensation (salary or wages, as applicable) shall not be reduced below the level in effect for such Company Employee as of immediately prior to the Closing Date
- **Best-first-guess code location**: candidate-resolution.js:9874 (employee-matters ITEM_STANDARD pattern table, reviewEmployeeDno)

### 15. `NO_SHOP · NO_SHOP_ACTION_UNCORROBORATED` — 11 occurrences, HELD

- **Representative quote** (card #3001, concho-no-shop-20260809-2xk-final, §§ 6.3, kind `NATIVE_NO_SHOP_ACTION_CANDIDATE`):
  > engage in
- **Best-first-guess code location**: candidate-resolution.js:8478 (handleNoShopActionCandidate)

### 16. `TERMINATION · TRIGGER_KIND_UNCORROBORATED` — 10 occurrences, HELD

- **Representative quote** (card #2852, concho-termination-20260809-2xk-final, §§ 8.1, kind `NATIVE_TERMINATION_RIGHT_CANDIDATE`):
  > if the Company, its Subsidiaries or any of the Company’s directors or executive officers shall have Willfully and Materially Breached the obligations set forth in Section 6.3(b) (No Solicitation by the Company)
- **Best-first-guess code location**: candidate-resolution.js:10174 (pushTerminationReview, TERMINATION 'who may terminate' family -- sibling of the already-diagnosed TERMINATION_FEE FEE_SIDE_UNCORROBORATED mechanism)

### 17. `FINANCING_COVENANTS · ASSERTION_KIND_UNCORROBORATED` — 8 occurrences, HELD

- **Representative quote** (card #3, concho-financing-covenants-20260809-2xk-final, §§ 6.17, kind `FINANCING_OBTAIN_EFFORTS_STANDARD`):
  > the Company and its Subsidiaries shall use commercially reasonable efforts to deliver to Parent at least three (3) Business Days prior to the Closing Date a draft payoff letter
- **Best-first-guess code location**: candidate-resolution.js:9483 (reviewFinancingGuaranty, FINANCING_COVENANTS pattern table)

### 18. `CLOSING_CONDITIONS · PARTY_UNRESOLVED` — 8 occurrences, HELD

- **Representative quote** (card #853, redhat-closing-conditions-20260809-2xk-final, §§ 6.01, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > in the case of each of (i) and (ii) without the imposition, individually or in the aggregate, of a Burdensome Condition.
- **Best-first-guess code location**: candidate-resolution.js:5014 and 5076 (handleClosingConditionCandidate, two branches); also raised at 8665 for NO_SHOP wave-B (zero occurrences in this corpus) and generically wherever resolveParty() returns null for MAE_DEFINITION/GENERAL_COVENANTS/ANTITRUST_REGULATORY handlers

### 19. `ANTITRUST_REGULATORY · OBLIGOR_SCOPE_UNCORROBORATED` — 8 occurrences, HELD

- **Representative quote** (card #2661, concho-antitrust-regulatory-20260809-2xk-final, §§ 6.8, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Parent and Merger Sub shall not take any action that could reasonably be expected to hinder or delay in any material respect the obtaining of clearance or the expiration of the required waiting period under the HSR Act or any other applicable Antitrust Law.
- **Best-first-guess code location**: candidate-resolution.js:9266, 9269 (handleRegulatoryEffortsCandidate, REGULATORY_MUTUAL_OBLIGOR_PATTERN check)

### 20. `NO_SHOP · COVENANT_OBLIGOR_NOT_IN_QUOTE` — 8 occurrences, HELD

- **Representative quote** (card #3004, concho-no-shop-20260809-2xk-final, §§ 6.4, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > immediately cease, and cause to be terminated, any discussion or negotiations
- **Best-first-guess code location**: candidate-resolution.js:8652 (handleNoShopWaveBCandidate, covenant_obligor substring check)

### 21. `CLOSING_CONDITIONS · REP_SIDE_UNCORROBORATED` — 7 occurrences, HELD

- **Representative quote** (card #835, modiv-closing-conditions-20260809-2xk-final, §§ 6.2, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > Each of the representations and warranties made by the Company in Section 3.1(a), Section 3.1(b), Section 3.2(c), the first sentence of Section 3.2(d), the sixth sentence and the last sentence of Section 3.2(f), Section 3.2(g)(i)-(iv), Section 3.3 and Section 3.23 (collectively, the “Company Fundame…
- **Best-first-guess code location**: candidate-resolution.js:5121, 5123 (handleClosingConditionCandidate, rep-side bring-down check -- NOT in diag-closing-conditions.md's stated scope at all)

### 22. `EMPLOYEE_MATTERS · EMPLOYEE_KIND_UNCORROBORATED` — 7 occurrences, HELD

- **Representative quote** (card #2489, concho-employee-matters-20260809-2xk-final, §§ 6.9, kind `NATIVE_EMPLOYEE_MATTERS_CANDIDATE`):
  > The provisions of this Section 6.9 are for the sole benefit of the Parties and nothing herein, expressed or implied, is intended or will be construed to confer upon or give to any Person (including, for the avoidance of doubt, any Company Employee or other current or former employee of the Company o…
- **Best-first-guess code location**: candidate-resolution.js:9876 (employee-matters kind-pattern table, reviewEmployeeDno)

### 23. `TERMINATION · TERMINATING_PARTY_REF_NOT_IN_QUOTE` — 7 occurrences, HELD

- **Representative quote** (card #2881, metsera-termination-20260809-2xk-final, §§ 8.01, kind `NATIVE_TERMINATION_RIGHT_CANDIDATE`):
  > if the Company Stockholder Approval shall not have been obtained at the Company Stockholders Meeting duly convened therefor or at any adjournment or postponement thereof
- **Best-first-guess code location**: candidate-resolution.js:10165 (pushTerminationReview, TERMINATION family)

### 24. `KEY_DEFINED_TERMS · DEFINED_TERM_REF_NOT_IN_HEAD` — 7 occurrences, HELD

- **Representative quote** (card #3441, metsera-key-defined-terms-20260809-2xk-final, §§ 8.02, kind `NATIVE_DEFINED_TERM_CANDIDATE`):
  > all references to twenty percent (20%) in such definition shall be deemed references to fifty percent (50%).
- **Best-first-guess code location**: candidate-resolution.js:8773 (KEY_DEFINED_TERMS head/definition-term match check)

### 25. `TAX_MATTERS · TAX_TREATMENT_KIND_UNCORROBORATED` — 7 occurrences, OPEN_WORLD

- **Representative quote** (card #4098, concho-tax-matters-20260809-2xk-final, §§ 4.12, kind `NATIVE_TAX_MATTERS_CANDIDATE`):
  > Neither the Company nor any of its Subsidiaries has constituted a “distributing corporation” or a “controlled corporation” in a distribution of stock intended to qualify for tax-free treatment under Section 355 of the Code
- **Best-first-guess code location**: candidate-resolution.js:10654 (TAX_MATTERS open-world push)

### 26. `TERMINATION_FEE · SOLE_REMEDY_FEE_CONTEXT_LINKED` — 5 occurrences, OPEN_WORLD

- **Representative quote** (card #365, concho-termination-fee-20260809-2xk-final, §§ 8.3, kind `OPEN_WORLD_PROPOSITION`):
  > The Parties agree that the monetary remedies set forth in this Section 8.3 and the specific performance remedies set forth in Section 9.11 shall be the sole and exclusive remedies of (i) the Company and its Subsidiaries against Parent and Merger Sub and any of their respective former, current or fut…
- **Best-first-guess code location**: sole-remedy-resolution.js:197 (TERMINATION_FEE sole-remedy linkage, separate module from candidate-resolution.js)

### 27. `CLOSING_CONDITIONS · OBLIGOR_REF_UNCORROBORATED` — 5 occurrences, HELD

- **Representative quote** (card #782, concho-closing-conditions-20260809-2xk-final, §§ 7.3, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > Parent and Merger Sub each shall have performed, or complied with, in all material respects all agreements and covenants required to be performed or complied with by them under this Agreement at or prior to the Effective Time.
- **Best-first-guess code location**: candidate-resolution.js:5135, 5137 (handleClosingConditionCandidate obligor check -- CLOSING_CONDITIONS portion is stub-scoped in diag-closing-conditions.md but undiagnosed; ANTITRUST_REGULATORY's 2 occurrences aren't even scoped there)

### 28. `EMPLOYEE_MATTERS · EMPLOYEE_ITEM_OR_STANDARD_OUT_OF_VOCABULARY` — 5 occurrences, OPEN_WORLD

- **Representative quote** (card #2487, concho-employee-matters-20260809-2xk-final, §§ 6.9, kind `NATIVE_EMPLOYEE_MATTERS_CANDIDATE`):
  > assume and honor their respective obligations under the Company’s Executive Severance Plan
- **Best-first-guess code location**: candidate-resolution.js:9874 (same block as ITEM_OR_STANDARD_UNCORROBORATED, enum-membership branch)

### 29. `EMPLOYEE_MATTERS · MONTH_COUNT_UNRESOLVED` — 5 occurrences, HELD

- **Representative quote** (card #2500, concho-employee-matters-20260809-2xk-final, §§ 6.9, kind `NATIVE_EMPLOYEE_MATTERS_CANDIDATE`):
  > Until December 31 of the calendar year in which the Effective Time occurs
- **Best-first-guess code location**: candidate-resolution.js:9875 (employee-matters CONTINUATION_PERIOD numeric parse)

### 30. `ANTITRUST_REGULATORY · NOTIFICATION_OBLIGATION_UNCORROBORATED` — 5 occurrences, HELD

- **Representative quote** (card #2660, concho-antitrust-regulatory-20260809-2xk-final, §§ 6.8, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Parent and the Company shall keep each other apprised of the status of any communications with, and any inquiries or requests for additional information from any Antitrust Authority.
- **Best-first-guess code location**: candidate-resolution.js:9318 -- template-built `${kind}_UNCORROBORATED` inside handleRegulatoryEffortsCandidate, fires when regulatoryValueCorroborated() fails for assertion_kind=NOTIFICATION_OBLIGATION

### 31. `TERMINATION · PERIOD_KIND_UNCORROBORATED` — 5 occurrences, HELD

- **Representative quote** (card #2847, concho-termination-20260809-2xk-final, §§ 8.1, kind `NATIVE_TERMINATION_RIGHT_CANDIDATE`):
  > thirty (30) days after the giving of written notice to the breaching Party of such breach
- **Best-first-guess code location**: candidate-resolution.js:10333 (pushTerminationReview, TERMINATION family)

### 32. `APPRAISAL_DISSENTERS_RIGHTS · APPRAISAL_ASSERTION_OPEN_WORLD` — 5 occurrences, OPEN_WORLD

- **Representative quote** (card #3648, metsera-appraisal-dissenters-rights-20260809-2xk-final, §§ 2.01, kind `NATIVE_APPRAISAL_CANDIDATE`):
  > Prior to the Effective Time, the Company shall not, without the prior written consent of Parent, make any payment with respect to, or settle or offer to settle or otherwise negotiate, any such demands, or agree to do any of the foregoing.
- **Best-first-guess code location**: candidate-resolution.js:10702 (APPRAISAL_DISSENTERS_RIGHTS open-world push)

### 33. `TAX_MATTERS · TAX_ASSERTION_OPEN_WORLD` — 5 occurrences, OPEN_WORLD

- **Representative quote** (card #4102, concho-tax-matters-20260809-2xk-final, §§ 6.18, kind `NATIVE_TAX_MATTERS_CANDIDATE`):
  > each of Parent, Merger Sub and the Company will use its reasonable best efforts and will cooperate with one another to obtain any opinion(s) of counsel to be issued in connection with (x) the consummation of the transactions contemplated by this Agreement and/or (y) the declaration of effectiveness …
- **Best-first-guess code location**: candidate-resolution.js:10675 (TAX_MATTERS open-world push, sibling of TAX_TREATMENT_KIND_UNCORROBORATED)

### 34. `FINANCING_COVENANTS · FINANCING_SCOPE_UNCORROBORATED` — 4 occurrences, HELD

- **Representative quote** (card #8, concho-financing-covenants-20260809-2xk-final, §§ 6.17, kind `FINANCING_COOPERATION_PRESENT`):
  > The Company shall, and shall cause each of its Subsidiaries to, and shall use its commercially reasonable efforts to cause its and their Representatives to, use its commercially reasonable efforts to provide all reasonable and customary cooperation as may be requested by Parent in writing to assist …
- **Best-first-guess code location**: candidate-resolution.js:9487 (reviewFinancingGuaranty, financing_kind corroboration)

### 35. `INTERIM_OPERATING · IOC_ATTACHMENT_TARGET_ZERO_MATCHES` — 4 occurrences, HELD

- **Representative quote** (card #511, metsera-interim-operating-20260809-2xk-final, §§ 5.01, kind `OPEN_WORLD_PROPOSITION`):
  > hire, engage, promote or terminate (other than for cause) the employment or engagement of any employee or other service provider with annual base compensation in excess of $250,000
- **Best-first-guess code location**: ioc-mechanic-resolution.js:115 (limbAttachment(), sibling of the diagnosed IOC_ATTACHMENT_TARGET_QUOTE_MISSING -- this is the 'quote present but matches nothing in the section' branch, not the 'quote missing' branch; not analysed by diag-ioc.md despite living in the same function)

### 36. `INTERIM_OPERATING · IOC_LONG_TAIL_RESTRICTION_OPEN_WORLD` — 4 occurrences, OPEN_WORLD

- **Representative quote** (card #524, metsera-interim-operating-20260809-2xk-final, §§ 5.01, kind `NATIVE_IOC_RESTRICTION_CANDIDATE`):
  > acquire or agree to acquire, in a single transaction or a series of related transactions, whether by merging or consolidating with, or by purchasing a substantial equity interest in or a substantial portion of the assets of, or by any other manner, any business or any corporation, partnership, limit…
- **Best-first-guess code location**: candidate-resolution.js:5204 (INTERIM_OPERATING open-world push -- outside diag-ioc.md's scope, which covered only HELD review-queue reasons)

### 37. `ANTITRUST_REGULATORY · FILING_REGIME_NOT_SINGLE_NAMED_REGIME` — 4 occurrences, HELD

- **Representative quote** (card #2696, redhat-antitrust-regulatory-20260809-2xk-final, §§ 5.03, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > each of Parent and the Company shall (A) prepare and file any notification and report forms and related material required under the HSR Act and other applicable Antitrust Laws with respect to the transactions contemplated by this Agreement as set forth on Section 5.03(a)(ii) of the Company Letter, a…
- **Best-first-guess code location**: candidate-resolution.js:9280, 9295 (handleRegulatoryEffortsCandidate, regulatoryFilingRegimeCorroborated())

### 38. `NO_SHOP · FIDUCIARY_ENGAGEMENT_STANDARD_UNCORROBORATED` — 4 occurrences, HELD

- **Representative quote** (card #3015, concho-no-shop-20260809-2xk-final, §§ 6.3, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > such Company Competing Proposal is, or would reasonably be expected to lead to, a Company Superior Proposal
- **Best-first-guess code location**: candidate-resolution.js:8643 -- same template site as RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED, assertion_kind=FIDUCIARY_ENGAGEMENT_STANDARD

### 39. `NO_SHOP · STANDSTILL_ACTION_UNCORROBORATED` — 4 occurrences, HELD

- **Representative quote** (card #3095, metsera-no-shop-20260809-2xk-final, §§ 5.02, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > will, and will cause each Company Subsidiary to, use reasonable best efforts to enforce any such agreement
- **Best-first-guess code location**: candidate-resolution.js:8643 -- same template site, assertion_kind=STANDSTILL_ACTION

### 40. `PROXY_MEETING · NO_DAY_COUNT` — 3 occurrences, HELD

- **Representative quote** (card #304, redhat-proxy-meeting-20260809-2xk-final, §§ 5.01, kind `NATIVE_PROXY_MEETING_COVENANT_CANDIDATE`):
  > As promptly as reasonably practicable following the date of this Agreement, the Company shall prepare and file with the SEC the preliminary Proxy Statement.
- **Best-first-guess code location**: antitrust-regulatory-parse.js:55 (day-count literal parser, ABSTAIN outcome)

### 41. `ANTITRUST_REGULATORY · CONSULTATION_RIGHT_UNCORROBORATED` — 3 occurrences, HELD

- **Representative quote** (card #2659, concho-antitrust-regulatory-20260809-2xk-final, §§ 6.8, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Parent shall consult with the Company and give consideration to the views of the Company on all matters relating to any possible Divestiture Action.
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site as NOTIFICATION_OBLIGATION_UNCORROBORATED, assertion_kind=CONSULTATION_RIGHT

### 42. `ANTITRUST_REGULATORY · INFORMATION_SHARING_OBLIGATION_UNCORROBORATED` — 3 occurrences, HELD

- **Representative quote** (card #2686, modiv-antitrust-regulatory-20260809-2xk-final, §§ 5.5, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Each party hereto shall: (i) give the other parties prompt notice of the making or commencement of any request, inquiry, investigation, action or legal proceeding by or before any Governmental Entity with respect to the Mergers; (ii) keep the other parties informed as to the status of any such reque…
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site, assertion_kind=INFORMATION_SHARING_OBLIGATION

### 43. `ANTITRUST_REGULATORY · BURDEN_COMMITMENT_UNCORROBORATED` — 3 occurrences, HELD

- **Representative quote** (card #2715, skechers-antitrust-regulatory-20260809-2xk-final, §§ 6.2, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Buyer Parties shall and, shall cause their respective Affiliates to, propose, negotiate, offer to commit and effect (and if such offer is accepted, commit to and effect), by consent decree, hold separate order, or otherwise, the sale, divestiture or disposition of such assets or businesses of, effec…
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site, assertion_kind=BURDEN_COMMITMENT

### 44. `NO_SHOP · NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD` — 3 occurrences, OPEN_WORLD

- **Representative quote** (card #3152, modiv-no-shop-20260809-2xk-final, §§ 5.6, kind `NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE`):
  > promptly (but in no event later than forty-eight (48) hours) after receipt
- **Best-first-guess code location**: candidate-resolution.js:8572 (handleNoShopPeriodCandidate open-world push)

### 45. `NO_SHOP · NON_LITERAL_NUMERAL` — 3 occurrences, HELD

- **Representative quote** (card #3205, skechers-no-shop-20260809-2xk-final, §§ 5.3, kind `NATIVE_NO_SHOP_MATCH_PERIOD_CANDIDATE`):
  > at least four Business Days in advance
- **Best-first-guess code location**: antitrust-regulatory-parse.js:61 (day-count parser, spelled-out-number ABSTAIN) -- also referenced generically in the header comment at candidate-resolution.js:110

### 46. `GENERAL_COVENANTS · PARTY_UNRESOLVED` — 3 occurrences, HELD

- **Representative quote** (card #3539, concho-general-covenants-20260809-2xk-final, §§ 6.12, kind `GENERAL_COVENANT_PRESENT`):
  > No Party shall, and each will cause its Representatives not to, issue any public announcements or make other public disclosures regarding this Agreement or the Transactions, without the prior written approval of the other Party.
- **Best-first-guess code location**: candidate-resolution.js:5014 and 5076 (handleClosingConditionCandidate, two branches); also raised at 8665 for NO_SHOP wave-B (zero occurrences in this corpus) and generically wherever resolveParty() returns null for MAE_DEFINITION/GENERAL_COVENANTS/ANTITRUST_REGULATORY handlers

### 47. `FINANCING_COVENANTS · NON_LITERAL_NUMERAL` — 2 occurrences, HELD

- **Representative quote** (card #10, skechers-financing-covenants-20260809-2xk-final, §§ 6.6, kind `PAYOFF_DELIVERY_LEAD_TIME_DAYS`):
  > (A) furnishing Parent with the Payoff Deliverables (including providing Parent with drafts thereof at least three Business Days prior to the Closing);
- **Best-first-guess code location**: antitrust-regulatory-parse.js:61 (day-count parser, spelled-out-number ABSTAIN) -- also referenced generically in the header comment at candidate-resolution.js:110

### 48. `PROXY_MEETING · ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED` — 2 occurrences, HELD

- **Representative quote** (card #258, concho-proxy-meeting-20260809-2xk-final, §§ 6.6, kind `NATIVE_PROXY_MEETING_COVENANT_CANDIDATE`):
  > if, as of the time for which the Parent Stockholders Meeting is scheduled, there are insufficient shares of Parent Common Stock represented (either in person or by proxy) to constitute a quorum necessary to conduct business at such Parent Stockholders Meeting
- **Best-first-guess code location**: candidate-resolution.js:5636 (PROXY_MEETING adjournment-reason grounding check, near but distinct from the #251 corroboration-gate bug diag-qualifier-proxy.md diagnosed under PROXY_MEETING_KIND_UNCORROBORATED)

### 49. `PROXY_MEETING · MEETING_REF_ABSENT` — 2 occurrences, HELD

- **Representative quote** (card #275, metsera-proxy-meeting-20260809-2xk-final, §§ 6.10, kind `NATIVE_PROXY_MEETING_COVENANT_CANDIDATE`):
  > and completing a broker search pursuant to Section 14a-13 of the Exchange Act
- **Best-first-guess code location**: candidate-resolution.js:5499 -- template-built `${refField.toUpperCase()}_ABSENT` inside handleProxyMeetingCandidate, refField='meeting_ref'

### 50. `TERMINATION_FEE · SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED` — 2 occurrences, OPEN_WORLD

- **Representative quote** (card #365, concho-termination-fee-20260809-2xk-final, §§ 8.3, kind `OPEN_WORLD_PROPOSITION`):
  > The Parties agree that the monetary remedies set forth in this Section 8.3 and the specific performance remedies set forth in Section 9.11 shall be the sole and exclusive remedies of (i) the Company and its Subsidiaries against Parent and Merger Sub and any of their respective former, current or fut…
- **Best-first-guess code location**: sole-remedy-resolution.js:300 (TERMINATION_FEE sole-remedy carve-out matching, same module as SOLE_REMEDY_FEE_CONTEXT_LINKED)

### 51. `TERMINATION_FEE · ANNIVERSARY_PHRASE` — 2 occurrences, HELD

- **Representative quote** (card #419, topbuild-termination-fee-20260809-2xk-r1-final, §§ 6.5, kind `NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE`):
  > at any time on or prior to the twelve (12) month anniversary of such termination
- **Best-first-guess code location**: termination-fee-parse.js:418 (fee-value date-anchor parser, ABSTAIN outcome)

### 52. `CLOSING_CONDITIONS · MAE_PARTY_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #818, modiv-closing-conditions-20260809-2xk-final, §§ 6.3, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > From the date of this Agreement through the Closing Date, there shall not have occurred a change, event, state of facts or development that has had or would reasonably be expected to have, individually or in the aggregate, a Parent Material Adverse Effect.
- **Best-first-guess code location**: candidate-resolution.js:5131-5132 (handleClosingConditionCandidate, MAE-qualified bring-down party check)

### 53. `CLOSING_CONDITIONS · APPROVAL_KIND_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #841, redhat-closing-conditions-20260809-2xk-final, §§ 6.01, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > any other approval or waiting period under any other applicable Antitrust Law of any Governmental Entity in a jurisdiction set forth in Section 6.01(b) of the Company Letter shall have been obtained or terminated or shall have expired
- **Best-first-guess code location**: candidate-resolution.js:5151, 5153 (handleClosingConditionCandidate, HSR/SCHEDULED_APPROVALS enum check)

### 54. `DNO_INDEMNIFICATION · PERCENT_UNRESOLVED` — 2 occurrences, HELD

- **Representative quote** (card #2594, modiv-dno-indemnification-20260809-2xk-final, §§ 5.8, kind `NATIVE_DNO_CANDIDATE`):
  > in no event shall Parent, the Surviving Company or the Surviving OpCo be required to pay annual premiums in the aggregate of more than an amount equal to the percentage set forth in Section 5.8(b) of the Company Disclosure Letter of the current annual premiums paid by the Company for such insurance
- **Best-first-guess code location**: candidate-resolution.js:9882 (same DNO_KIND block, TAIL_CAP_PERCENT numeric-parse branch)

### 55. `DNO_INDEMNIFICATION · YEAR_COUNT_UNRESOLVED` — 2 occurrences, HELD

- **Representative quote** (card #2604, modiv-dno-indemnification-20260809-2xk-final, §§ 5.8, kind `NATIVE_DNO_CANDIDATE`):
  > cause a Tail Policy to be maintained in effect for a period of six years following the Company Merger Effective Time.
- **Best-first-guess code location**: candidate-resolution.js:9882 (same DNO_KIND block, INDEM_SURVIVAL_PERIOD/TAIL_PERIOD numeric-parse branch)

### 56. `ANTITRUST_REGULATORY · LITIGATION_OBLIGATION_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #2666, concho-antitrust-regulatory-20260809-2xk-final, §§ 6.8, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > In addition, subject to the terms of this Section 6.8, in the event that any permanent or preliminary injunction or other order is entered or becomes reasonably foreseeable to be entered in any Proceeding that would make consummation of the Transactions in accordance with the terms of this Agreement…
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site as NOTIFICATION_OBLIGATION_UNCORROBORATED, assertion_kind=LITIGATION_OBLIGATION

### 57. `ANTITRUST_REGULATORY · OBLIGOR_REF_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #2690, redhat-antitrust-regulatory-20260809-2xk-final, §§ 5.03, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > The Company, upon having knowledge, shall give prompt notice to Parent of any Effect that has had or would reasonably be expected to have, individually or taken together with all other Effects, a Material Adverse Effect
- **Best-first-guess code location**: candidate-resolution.js:5135, 5137 (handleClosingConditionCandidate obligor check -- CLOSING_CONDITIONS portion is stub-scoped in diag-closing-conditions.md but undiagnosed; ANTITRUST_REGULATORY's 2 occurrences aren't even scoped there)

### 58. `TERMINATION · NO_CALENDAR_DATE` — 2 occurrences, HELD

- **Representative quote** (card #2902, redhat-termination-20260809-2xk-final, §§ 7.01, kind `NATIVE_TERMINATION_RIGHT_CANDIDATE`):
  > the Merger shall not have been consummated by 11:59 p.m., Eastern time, on the date that is twelve (12) months after the date of this Agreement (the “Initial Termination Date,” and, such time and date as it may be extended pursuant to this Section 7.01(b)(i), the “Termination Date”) for any reason;
- **Best-first-guess code location**: termination-deadline-parse.js:~42 (TERMINATION deadline date parser, ABSTAIN outcome)

### 59. `NO_SHOP · RECOMMENDATION_CHANGE_TRIGGER_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #3076, metsera-no-shop-20260809-2xk-final, §§ 5.02, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > such Company Takeover Proposal constitutes a Superior Company Proposal
- **Best-first-guess code location**: candidate-resolution.js:8643 -- same template site as RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED, assertion_kind=RECOMMENDATION_CHANGE_TRIGGER

### 60. `NO_SHOP · RECOMMENDATION_SAFE_DISCLOSURE_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #3109, metsera-no-shop-20260809-2xk-final, §§ 5.02, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > contains a statement reaffirming the Company Board Recommendation
- **Best-first-guess code location**: candidate-resolution.js:8643 -- same template site, assertion_kind=RECOMMENDATION_SAFE_DISCLOSURE

### 61. `NO_SHOP · RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #3129, modiv-no-shop-20260809-2xk-final, §§ 5.6, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > the failure to take such action would reasonably be expected to be inconsistent with the duties of the Company’s directors under applicable Law
- **Best-first-guess code location**: candidate-resolution.js:8643 -- same template site, assertion_kind=RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD

### 62. `KEY_DEFINED_TERMS · STANDARD_CODE_OUT_OF_ENUM` — 2 occurrences, HELD

- **Representative quote** (card #3408, concho-key-defined-terms-20260809-2xk-final, §§ Annex-A, kind `NATIVE_DEFINED_TERM_CANDIDATE`):
  > the actual knowledge of
- **Best-first-guess code location**: candidate-resolution.js:8785 (KEY_DEFINED_TERMS standard-code / knowledge-party enum check)

### 63. `KEY_DEFINED_TERMS · NO_PERCENT_LITERAL` — 2 occurrences, HELD

- **Representative quote** (card #3475, skywater-key-defined-terms-20260809-2xk-final, §§ Annex-A, kind `NATIVE_DEFINED_TERM_CANDIDATE`):
  > the Company’s and its Subsidiaries’ consolidated assets
- **Best-first-guess code location**: defined-term-threshold-parse.js:49 (KEY_DEFINED_TERMS threshold parser, ABSTAIN outcome)

### 64. `KEY_DEFINED_TERMS · RECORDED_DEFINITION_ENVELOPE_UNCORROBORATED` — 2 occurrences, HELD

- **Representative quote** (card #3477, skywater-key-defined-terms-20260809-2xk-final, §§ Annex-A, kind `NATIVE_DEFINED_TERM_CANDIDATE`):
  > all Intellectual Property Rights that are registered or filed with or by, or issued under the authority of, any Governmental Authority or Internet domain name registrar
- **Best-first-guess code location**: candidate-resolution.js:8736 (KEY_DEFINED_TERMS recordedReview call)

### 65. `KEY_DEFINED_TERMS · MULTIPLE_PERCENT_LITERALS` — 2 occurrences, HELD

- **Representative quote** (card #3504, topbuild-key-defined-terms-20260809-2xk-r2-final, §§ 4.3, kind `NATIVE_DEFINED_TERM_CANDIDATE`):
  > (i) that if consummated would result in a third party (or in the case of a direct merger between such third party and the Company, the stockholders of such third party) acquiring, directly or indirectly, more than 80% of the outstanding Company Shares or more than 80% of the assets of the Company an…
- **Best-first-guess code location**: defined-term-threshold-parse.js:52 (same parser as NO_PERCENT_LITERAL, multi-token ABSTAIN)

### 66. `FINANCING_COVENANTS · MULTIPLE_DAY_COUNTS` — 1 occurrences, HELD

- **Representative quote** (card #31, topbuild-financing-covenants-20260809-2xk-r4-final, §§ 4.17, kind `PAYOFF_DELIVERY_LEAD_TIME_DAYS`):
  > deliver to Parent not later than two (2) business days (or such shorter period as reasonably agreed by Parent) prior to the Titanium Merger Effective Time (with drafts being delivered at least five (5) business days (or such shorter period as reasonably agreed by Parent) prior to the Titanium Merger…
- **Best-first-guess code location**: antitrust-regulatory-parse.js:70 (day-count parser, multi-candidate ABSTAIN)

### 67. `CONSIDERATION · NO_MONEY_LITERAL` — 1 occurrences, HELD

- **Representative quote** (card #116, redhat-consideration-20260809-2xk-final, §§ 5.04, kind `PER_SHARE_CASH_CONSIDERATION`):
  > each Cash-Out Restricted Share outstanding at the Effective Time shall be converted at the Effective Time into the right to receive an amount in cash equal to the Merger Consideration in accordance with Section 2.01(c)
- **Best-first-guess code location**: antitrust-regulatory-parse.js:27 (day-count/money parser shared module, ABSTAIN outcome) -- CONSIDERATION family occurrence likely uses an analogous parser in consideration-specific code, not directly located

### 68. `CONSIDERATION · RATIO_CONTEXT_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #243, topbuild-consideration-20260809-2xk-r2-final, §§ 2.1, kind `EXCHANGE_RATIO_VALUE`):
  > 20.200 validly issued, fully paid and non-assessable Parent Shares, subject to Section ‎2.5 with respect to any Merger Fractional Share Payout (the “Stock Consideration”)
- **Best-first-guess code location**: candidate-resolution.js:10564 (CONSIDERATION ratio-context check, distinct from the diagnosed NO_RATIO_LITERAL/PER_SHARE_CONTEXT_UNCORROBORATED mechanisms)

### 69. `PROXY_MEETING · CONTROL_PARTY_REF_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #289, modiv-proxy-meeting-20260809-2xk-final, §§ 5.4, kind `NATIVE_PROXY_MEETING_COVENANT_CANDIDATE`):
  > in no event shall the Company Common Stockholders’ Meeting be (I) postponed more than a total of three (3) times
- **Best-first-guess code location**: candidate-resolution.js:5562 (handleProxyMeetingCandidate, control-party post-resolution check, sibling of the diagnosed CONTROL_PARTY_REF_ABSENT)

### 70. `PROXY_MEETING · CONTROL_PARTY_REF_NOT_IN_QUOTE` — 1 occurrences, HELD

- **Representative quote** (card #319, skywater-proxy-meeting-20260809-2xk-final, §§ 5.3, kind `NATIVE_PROXY_MEETING_COVENANT_CANDIDATE`):
  > the Company may not, without the prior written consent of Parent (such consent not to be unreasonably withheld, conditioned or delayed), adjourn or postpone the Company Stockholder Meeting more than a total of three times pursuant to clause (i)(A) or (ii) of the immediately preceding sentence
- **Best-first-guess code location**: candidate-resolution.js:5547 (handleProxyMeetingCandidate, control_party substring check)

### 71. `PROXY_MEETING · DOCUMENT_REF_NOT_IN_QUOTE` — 1 occurrences, HELD

- **Representative quote** (card #331, skywater-proxy-meeting-20260809-2xk-final, §§ 5.3, kind `NATIVE_PROXY_MEETING_COVENANT_CANDIDATE`):
  > Parent shall file with the SEC, a Registration Statement on Form S-4 (the “Form S-4”), in which the Company Proxy Statement shall be included as a prospectus.
- **Best-first-guess code location**: candidate-resolution.js:5522 -- template-built `${refField.toUpperCase()}_NOT_IN_QUOTE`, refField='document_ref'

### 72. `TERMINATION_FEE · NON_LITERAL_NUMERAL` — 1 occurrences, HELD

- **Representative quote** (card #401, skechers-termination-fee-20260809-2xk-final, §§ 8.3, kind `NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE`):
  > within one year following the termination of this Agreement pursuant to Section 8.1(d) or Section 8.1(f), as applicable, either an Acquisition Transaction is consummated or the Company enters into a definitive agreement providing for the consummation of an Acquisition Transaction which is ultimately…
- **Best-first-guess code location**: antitrust-regulatory-parse.js:61 (day-count parser, spelled-out-number ABSTAIN) -- also referenced generically in the header comment at candidate-resolution.js:110

### 73. `CLOSING_CONDITIONS · CERTIFIED_CONDITION_REF_NOT_IN_QUOTE` — 1 occurrences, HELD

- **Representative quote** (card #788, concho-closing-conditions-20260809-2xk-final, §§ 7.3, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > The Company shall have received a certificate of Parent signed by an executive officer of Parent, dated the Closing Date, confirming that the conditions in Sections 7.3(a) and (b) have been satisfied.
- **Best-first-guess code location**: candidate-resolution.js:5005 (handleClosingConditionCandidate, certification-reference check)

### 74. `CLOSING_CONDITIONS · SCRAPE_QUOTE_NOT_IN_QUOTE` — 1 occurrences, HELD

- **Representative quote** (card #794, concho-closing-conditions-20260809-2xk-final, §§ 7.3, kind `NATIVE_CLOSING_CONDITION_CANDIDATE`):
  > (ii) all other representations and warranties of Parent set forth in Section 5.2(b) (Capital Structure) (except for the third sentence of Section 5.2(b)) shall have been true and correct in all material respects as of -76- the date of this Agreement and shall be true and correct in all material resp…
- **Best-first-guess code location**: candidate-resolution.js:5125 (handleClosingConditionCandidate, scrape_quote substring check)

### 75. `GUARANTY_FINANCING_PARTY · GTY_KIND_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #923, skechers-guaranty-financing-party-20260809-2xk-final, §§ 4.13, kind `LIMITED_GUARANTY_IN_EFFECT`):
  > The Guaranty is in full force and effect
- **Best-first-guess code location**: guaranty-corroboration.js:97 (GUARANTY_FINANCING_PARTY kind corroboration, separate module)

### 76. `REPRESENTATIONS · REPRESENTATION_SIDE_UNRESOLVED` — 1 occurrences, OPEN_WORLD

- **Representative quote** (card #1637, metsera-representations-r1c-20260809-2xk-final, §§ 4.02, kind `NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE`):
  > since the date of its incorporation
- **Best-first-guess code location**: candidate-resolution.js:9691 (representation-side open-world push, near handleRepresentationQualifierCarrier)

### 77. `REPRESENTATIONS · QUALIFIER_KIND_DISAGREEMENT` — 1 occurrences, HELD

- **Representative quote** (card #1903, skechers-representations-r1b-20260809-2xk-final, §§ 3.18, kind `NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE`):
  > except as would not be material to the business of the Company Group, taken as a whole
- **Best-first-guess code location**: qualifier-kind-lexicon.js:64 (documented in the module's own header comment as the outcome when both sides of a check disagree; exact push site not located by direct grep -- likely inside classifyQualifierQuote() itself)

### 78. `ANTITRUST_REGULATORY · WITHDRAWAL_EXCEPTION_PERIOD_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #2677, metsera-antitrust-regulatory-20260809-2xk-final, §§ 6.03, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > the parties agree not to (A) extend, directly or indirectly, any waiting period under the HSR Act or any Foreign Merger Control Law or enter into any agreement with a Governmental Entity to delay or not to consummate the Merger or any of the other Transactions or (B) pull and refile any filing made …
- **Best-first-guess code location**: candidate-resolution.js:9396 (handleRegulatoryEffortsCandidate, WITHDRAWAL_REFILING_RESTRICTION day-count check)

### 79. `ANTITRUST_REGULATORY · COOPERATION_OBLIGATION_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #2697, redhat-antitrust-regulatory-20260809-2xk-final, §§ 5.03, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > the Company shall, and shall cause its Subsidiaries to, provide to Parent such cooperation as may be reasonably requested by Parent
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site as NOTIFICATION_OBLIGATION_UNCORROBORATED, assertion_kind=COOPERATION_OBLIGATION

### 80. `ANTITRUST_REGULATORY · STRATEGY_CONTROL_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #2706, redhat-antitrust-regulatory-20260809-2xk-final, §§ 5.03, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Parent shall, on behalf of the parties and in reasonable consultation with the Company, have the right, in its sole discretion, to determine the nature and timing of any divestitures or other remedial undertakings made for the purpose of securing any required approvals under the Antitrust Laws to th…
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site, assertion_kind=STRATEGY_CONTROL

### 81. `ANTITRUST_REGULATORY · OBLIGOR_REF_NOT_IN_QUOTE` — 1 occurrences, HELD

- **Representative quote** (card #2717, skechers-antitrust-regulatory-20260809-2xk-final, §§ 6.2, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > The Buyer Parties (and their respective Affiliates, if applicable), on the one hand, and the Company (and its Subsidiaries, if applicable), on the other hand, will, to the extent required in the reasonable judgment of counsel to Parent and the Company, (i) file with the FTC and the Antitrust Divisio…
- **Best-first-guess code location**: candidate-resolution.js:9263 (handleRegulatoryEffortsCandidate) and :9528 (reviewFinancingGuaranty, PERFORMANCE_GUARANTY branch) -- two independent sites for the same reason string

### 82. `ANTITRUST_REGULATORY · PARTY_UNRESOLVED` — 1 occurrences, HELD

- **Representative quote** (card #2718, skywater-antitrust-regulatory-20260809-2xk-final, §§ 7.1, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > such party shall use its reasonable best efforts to make, or cause to be made, promptly and after consultation with the other party, an appropriate response in substantial compliance with such request.
- **Best-first-guess code location**: candidate-resolution.js:5014 and 5076 (handleClosingConditionCandidate, two branches); also raised at 8665 for NO_SHOP wave-B (zero occurrences in this corpus) and generically wherever resolveParty() returns null for MAE_DEFINITION/GENERAL_COVENANTS/ANTITRUST_REGULATORY handlers

### 83. `ANTITRUST_REGULATORY · INFORMATION_PROTECTION_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #2719, skywater-antitrust-regulatory-20260809-2xk-final, §§ 7.1, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > the Company and Parent shall each furnish to each other copies of all material substantive correspondence, filings (other than the notifications required under the HSR Act) and written communications between it and any such Governmental Authority with respect to this Agreement and the Mergers, and f…
- **Best-first-guess code location**: candidate-resolution.js:9365 (handleRegulatoryEffortsCandidate, INFORMATION_SHARING_OBLIGATION protection-kind pattern table)

### 84. `ANTITRUST_REGULATORY · NON_IMPEDIMENT_COVENANT_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #2721, skywater-antitrust-regulatory-20260809-2xk-final, §§ 7.1, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > Parent and the Company shall, as applicable: (i) each use its reasonable best efforts to avoid the entry of, or to have vacated or terminated, any judgment, injunction, order or decree that would prohibit, enjoin, restrain, prevent or delay the Closing, on or before the End Date or the Extended End …
- **Best-first-guess code location**: candidate-resolution.js:9318 -- same template site as NOTIFICATION_OBLIGATION_UNCORROBORATED, assertion_kind=NON_IMPEDIMENT_COVENANT

### 85. `ANTITRUST_REGULATORY · FILING_OBLIGATION_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #2726, skywater-antitrust-regulatory-20260809-2xk-final, §§ 7.1, kind `NATIVE_REGULATORY_EFFORTS_CANDIDATE`):
  > The Company and Parent shall submit, or cause to be submitted, the notifications required under the HSR Act relating to the Mergers within 20 Business Days of the date of this Agreement.
- **Best-first-guess code location**: candidate-resolution.js:9297 (handleRegulatoryEffortsCandidate, canonicalValueAllowed + regulatoryValueCorroborated combined check)

### 86. `MAE_DEFINITION · CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE` — 1 occurrences, HELD

- **Representative quote** (card #2744, concho-mae-definition-20260809-2xk-final, §§ Annex-A, kind `NATIVE_MAE_DISPROPORTIONALITY_CANDIDATE`):
  > except to the extent such Effects directly or indirectly resulting from, arising out of, attributable to or related to the matters described in the foregoing clauses (i) – (v) (excluding any Effect arising from, resulting from or related to COVID-19, COVID-19 Measures or the November 3, 2020 United …
- **Best-first-guess code location**: candidate-resolution.js:9176 (pushMaeReview, MAE_DEFINITION carveback clause-label check)

### 87. `NO_SHOP · REPRESENTATIVE_CONTROL_STANDARD_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #3219, skechers-no-shop-20260809-2xk-final, §§ 5.3, kind `NATIVE_NO_SHOP_WAVE_B_CANDIDATE`):
  > shall use its reasonable best efforts to stop such breach or threatened breach
- **Best-first-guess code location**: candidate-resolution.js:8643 -- same template site as RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED, assertion_kind=REPRESENTATIVE_CONTROL_STANDARD

### 88. `KEY_DEFINED_TERMS · SUBSTITUTION_UNCORROBORATED` — 1 occurrences, HELD

- **Representative quote** (card #3473, skechers-key-defined-terms-20260809-2xk-final, §§ 1.1, kind `NATIVE_DEFINED_TERM_CANDIDATE`):
  > For purposes of the reference to an “Acquisition Proposal” in this definition, all references to “15%” in the definition of “Acquisition Transaction” will be deemed to be references to “50%.”
- **Best-first-guess code location**: candidate-resolution.js:8779 (KEY_DEFINED_TERMS threshold-substitution parser fallback)

### 89. `GENERAL_COVENANTS · GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED` — 1 occurrences, OPEN_WORLD

- **Representative quote** (card #3561, metsera-general-covenants-20260809-2xk-final, §§ 6.12, kind `NATIVE_GENERAL_COVENANT_SECREPORT_PRESENT_CANDIDATE`):
  > the Company will deliver to Parent at least five (5) business days prior to the Closing a substantially final draft of any such reports reasonably likely to be required to be filed during the Delisting Period (“Post-Closing SEC Reports”).
- **Best-first-guess code location**: candidate-resolution.js:4861 (same helper as GENERAL_COVENANT_CODE_UNCORROBORATED)

### 90. `MERGER_STRUCTURE_CLOSING · MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE` — 1 occurrences, OPEN_WORLD

- **Representative quote** (card #3817, modiv-merger-structure-closing-20260809-2xk-final, §§ 1.4, kind `NATIVE_MERGER_TRANSACTION_STEP_CANDIDATE`):
  > (ii) the Company, the Surviving Company, Parent, Parent OpCo, OpCo Merger Sub and the Partnership shall make any other filings, recordings or publications required to be made by any of them under the DRULPA in connection with the OpCo Merger.
- **Best-first-guess code location**: candidate-resolution.js:9568 (MERGER_STRUCTURE_CLOSING open-world push)
