# UNRESOLVED required fact types read back to their sections and causes

Generated 2026-10-18 19:35 UTC by `scripts/product/unresolved-fact-types.js` for d921605dex21.htm generation 8 (72d94dd2), compared with d921605dex21.htm generation 7 (8c53fb92).

## Summary

| Measure | Count |
| --- | --- |
| Draft-level REQUIRED_FACT_TYPE_UNRESOLVED issues | 51 |
| Fact types with an UNRESOLVED section assertion | 51 |
| Of which carried VALID in another section of the run | 47 |
| Of which VALID nowhere in the run | 4 |
| Section assertions with cause SECTION_NOT_EXTRACTED | 51 |
| Fact types with verdict SECTION_GAP | 51 |

## Sections never extracted

A SOURCE_CLOSURE_INCOMPLETE issue on the section: the runner wrote UNRESOLVED for every required fact type of every routed family and never asked the model for the section's facts (lib/product/agreement-draft.js, the closureIncomplete branch). Whatever other sections carry, this section's own content is absent from the draft.

### Exhibit-B

- Routed families (13): CAPITALISATION, CONSIDERATION, DIVIDENDS, DNO_INDEMNIFICATION, EMPLOYEE_MATTERS, GENERAL_COVENANTS, KEY_DEFINED_TERMS, MERGER_STRUCTURE_CLOSING, MISC_BOILERPLATE, REPRESENTATIONS, SPECIFIC_PERFORMANCE_REMEDIES, TAX_MATTERS, TERMINATION
- Router's rationale: Form CVR Agreement: CVR consideration component with per-CVR milestone payment amounts and exchange/payment mechanics (CONSIDERATION); numerous defined terms including Acting Holders, Change of Control, Commercially Reasonable, Permitted Transfer (KEY_DEFINED_TERMS); CVR covenants on development spend, non-avoidance and assumption on Change of Control (GENERAL_COVENANTS - CVR); withholding mechanics, Section 409A and intended tax treatment (TAX_MATTERS); entire agreement, notices, assignment, governing law, forum, jury waiver, severability, counterparts, construction, third-party beneficiary (MISC_BOILERPLATE); Section 6.12 termination triggers, effect and survival (TERMINATION); Rights Agent indemnification and hold-harmless/expense reimbursement (DNO_INDEMNIFICATION); Parent authority/no-conflict representations (REPRESENTATIONS); Equity Award Holder payment timing conditioned on continued service and vesting (EMPLOYEE_MATTERS).
- Unresolved section references: 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3
- Cross-scope references the closure resolved into the main agreement: 2.01(b) (Exhibit-B -> MAIN_AGREEMENT); 2.03 (Exhibit-B -> MAIN_AGREEMENT); 2.2 (Exhibit-B -> MAIN_AGREEMENT); 3.2 (Exhibit-B -> MAIN_AGREEMENT); 3.3 (Exhibit-B -> MAIN_AGREEMENT); 3.4 (Exhibit-B -> MAIN_AGREEMENT); 4.2 (Exhibit-B -> MAIN_AGREEMENT); 4.3 (Exhibit-B -> MAIN_AGREEMENT); 5.1 (Exhibit-B -> MAIN_AGREEMENT); 5.1(a) (Exhibit-B -> MAIN_AGREEMENT); 5.2 (Exhibit-B -> MAIN_AGREEMENT); 6.12 (Exhibit-B -> MAIN_AGREEMENT); 6.2 (Exhibit-B -> MAIN_AGREEMENT); 6.5 (Exhibit-B -> MAIN_AGREEMENT); 6.6 (Exhibit-B -> MAIN_AGREEMENT); 6.8 (Exhibit-B -> MAIN_AGREEMENT); 6.9 (Exhibit-B -> MAIN_AGREEMENT)
- Residual pass's unusual provisions in the section (9): "Deposit account arrangements, AA-rated demand deposit, retention of interest/earnings by Rights Agent and non-escrow/non-bank status disclaimers fall outside the catalogue"; "Anti-avoidance covenant barring acts with primary purpose of defeating milestones is not captured by listed families"; "Continuation of spend-reduction triggers and Commercially Reasonable expenditure cap; same uncovered subject matter"; "Escheat/abandoned property forfeiture clause vesting unclaimed payments in Parent free of holder claims is not covered by the catalogue families"; "PROVIDER_OMITTED_REQUIRED_PARAGRAPH_DISPOSITION"; "Change of Control assumption requirement and officer certificate of compliance is a distinct obligation not in the catalogue"; "Binding $1.5bn minimum development spend commitment with enumerated relief triggers and reduction to $600m is a bespoke diligence/spend obligation not within the catalogue families"; "Holder right to abandon CVRs and Parent repurchase with acquired CVRs deemed extinguished for Acting Holder quorum purposes is not addressed by any listed family"; "Sole-discretion control of development/commercialization and express disclaimer of any efforts standard is a CVR-specific provision outside the catalogue"

## Per family and fact type

| Family | Fact type | Draft issue | Unresolved sections and cause | VALID elsewhere | Verdict |
| --- | --- | --- | --- | --- | --- |
| CAPITALISATION | CAPITALISATION_AUTHORISED_CAPITAL | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 3.02, 4.02 | SECTION_GAP |
| CAPITALISATION | CAPITALISATION_CAPITALISATION_ABSENCE | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 17 in 3.02, 3.03 | SECTION_GAP |
| CAPITALISATION | CAPITALISATION_EQUITY_AWARD_INVENTORY | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 4 in 3.02 | SECTION_GAP |
| CAPITALISATION | CAPITALISATION_ISSUED_AND_OUTSTANDING | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 3.02 | SECTION_GAP |
| CAPITALISATION | CAPITALISATION_PARTNERSHIP_OR_SUBSIDIARY_EQUITY | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 3.02, 3.03, 4.02 | SECTION_GAP |
| CAPITALISATION | CAPITALISATION_RESERVED_OR_ISSUABLE_SECURITIES | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 3.02 | SECTION_GAP |
| CAPITALISATION | CAPITALISATION_VALID_ISSUANCE_STATUS | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 3.02, 3.03, 4.02 | SECTION_GAP |
| CONSIDERATION | APPRAISAL_RIGHTS_STATUS | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 2.01 | SECTION_GAP |
| CONSIDERATION | PER_SHARE_CASH_CONSIDERATION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 54 in 2.01, 2.02, 2.03 | SECTION_GAP |
| DIVIDENDS | DIVIDEND_COORDINATION_COVENANT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 5.01 | SECTION_GAP |
| DNO_INDEMNIFICATION | ADVANCEMENT_OF_EXPENSES | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | CHARTER_PROTECTION_CONTINUATION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | COVERED_PERSON_TPB_RIGHTS | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 6.05, 9.07 | SECTION_GAP |
| DNO_INDEMNIFICATION | INDEMNIFICATION_CONTINUATION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 9 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | INDEMNIFICATION_SURVIVAL_YEARS | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | TAIL_POLICY_OBLIGATION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 7 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | TAIL_POLICY_PERIOD_YEARS | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | TAIL_PREMIUM_CAP_OFF_AGREEMENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 6.05 | SECTION_GAP |
| DNO_INDEMNIFICATION | TAIL_PREMIUM_CAP_PERCENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 6.05 | SECTION_GAP |
| EMPLOYEE_MATTERS | EMPLOYEE_COMP_ITEM_STANDARD | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 10 in 6.04 | SECTION_GAP |
| EMPLOYEE_MATTERS | EMPLOYEE_SERVICE_CREDIT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 6.04 | SECTION_GAP |
| EMPLOYEE_MATTERS | WELFARE_PLAN_TRANSITION_RELIEF | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 6.04 | SECTION_GAP |
| GENERAL_COVENANTS | GENERAL_COVENANT_PRESENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 47 in 6.02, 6.03, 6.06, 6.07, 6.08, 6.09, 6.12, 6.13, 6.14 | SECTION_GAP |
| KEY_DEFINED_TERMS | ACQUISITION_PROPOSAL_THRESHOLD_PERCENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 5.02, 8.02 | SECTION_GAP |
| KEY_DEFINED_TERMS | INTERVENING_EVENT_DEFINITION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 5.02 | SECTION_GAP |
| KEY_DEFINED_TERMS | INTERVENING_EVENT_EXCLUSION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 5.02 | SECTION_GAP |
| KEY_DEFINED_TERMS | KNOWLEDGE_PERSON_SOURCE | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 9.03 | SECTION_GAP |
| KEY_DEFINED_TERMS | KNOWLEDGE_STANDARD | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 9.03 | SECTION_GAP |
| KEY_DEFINED_TERMS | ORDINARY_COURSE_DEFINITION_RECORDED | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | none | SECTION_GAP |
| KEY_DEFINED_TERMS | OTHER_DEFINED_TERM_RECORDED | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 84 in 2.01, 2.03, 3.02, 3.03, 3.04, 3.11, 3.12, 3.13, 3.16, 3.18, 3.19, 4.08, 5.02, 6.02, 6.03, 7.01, 8.01, 9.03 | SECTION_GAP |
| KEY_DEFINED_TERMS | SUPERIOR_PROPOSAL_QUALIFIER | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 3 in 5.02 | SECTION_GAP |
| KEY_DEFINED_TERMS | SUPERIOR_PROPOSAL_THRESHOLD_PERCENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 5.02 | SECTION_GAP |
| KEY_DEFINED_TERMS | TAX_DEFINITION_RECORDED | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 3.09 | SECTION_GAP |
| KEY_DEFINED_TERMS | TAX_RETURN_DEFINITION_RECORDED | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 3.09 | SECTION_GAP |
| KEY_DEFINED_TERMS | WILLFUL_BREACH_DEFINITION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 8.02 | SECTION_GAP |
| KEY_DEFINED_TERMS | WILLFUL_BREACH_KNOWLEDGE_STANDARD | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 8.02 | SECTION_GAP |
| MERGER_STRUCTURE_CLOSING | MERGER_STRUCTURE_MECHANIC_PRESENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 14 in 1.01, 1.02, 1.03, 1.05, 1.06, 2.01 | SECTION_GAP |
| MERGER_STRUCTURE_CLOSING | MERGER_TRANSACTION_STEP | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 10 in 1.01, 1.02, 1.03, 1.04, 1.05 | SECTION_GAP |
| MISC_BOILERPLATE | MISC_BOILERPLATE_MECHANIC_PRESENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 66 in 8.03, 8.04, 9.01, 9.02, 9.04, 9.05, 9.06, 9.07, 9.08, 9.09, 9.10, 9.11 | SECTION_GAP |
| REPRESENTATIONS | KNOWLEDGE_QUALIFIER | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 48 in 3.06, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.17, 3.18, 3.19, 3.20, 3.24, 3.26, 4.07 | SECTION_GAP |
| REPRESENTATIONS | REPRESENTATION_ACCURACY_STANDARD | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 240 in 3.01, 3.02, 3.03, 3.04, 3.05, 3.06, 3.07, 3.08, 3.09, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 3.19, 3.20, 3.21, 3.22, 3.23, 3.24, 3.25, 3.26, 4.01, 4.02, 4.03, 4.04, 4.05, 4.06, 4.07, 4.08, 4.09, III-INTRO, IV-INTRO | SECTION_GAP |
| SPECIFIC_PERFORMANCE_REMEDIES | REMEDY_LIMITATION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 1 in 8.02 | SECTION_GAP |
| SPECIFIC_PERFORMANCE_REMEDIES | SPECIFIC_PERFORMANCE_REMEDY_PRESENT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 9 in 9.10 | SECTION_GAP |
| TAX_MATTERS | INTENDED_TAX_TREATMENT_KIND | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | none | SECTION_GAP |
| TAX_MATTERS | TAX_OPINION_COOPERATION_COVENANT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | none | SECTION_GAP |
| TAX_MATTERS | TAX_TREATMENT_PROTECTION_COVENANT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | none | SECTION_GAP |
| TAX_MATTERS | TRANSFER_TAX_ALLOCATION | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 2.02 | SECTION_GAP |
| TERMINATION | CURE_OR_NOTICE_PERIOD | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 4 in 8.01, 8.05 | SECTION_GAP |
| TERMINATION | OUTSIDE_DATE | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 2 in 8.01 | SECTION_GAP |
| TERMINATION | TERMINATION_EFFECT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 6 in 8.02 | SECTION_GAP |
| TERMINATION | TERMINATION_RIGHT | yes | Exhibit-B: not extracted (closure incomplete: unresolved 2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3) | 16 in 5.02, 8.01, 8.05 | SECTION_GAP |

## Compared with the other run's draft issues

Both: 51; only this run: 0; only the other: 1 (NO_SHOP/SUBSEQUENT_MATCH_PERIOD).

## Verdicts

- BOOKKEEPING_HELD: every unresolved section holds a proposal of the fact type; the lawyer's decision on the held fact resolves the state. The draft issue restates per fact type what the held fact's own issue already says.
- BOOKKEEPING_MODEL_ANSWER: the model's coverage answer disagrees with its own facts (NOT_FOUND beside a fact it returned); the facts stand and the answer is the bookkeeping.
- SECTION_GAP: a routed section was never extracted. Not bookkeeping: its content is missing from the draft, whether or not other sections carry the same fact types.
- EXTRACTION_GAP: the model said FOUND and returned nothing, or answered UNRESOLVED, and no valid fact of the type exists anywhere in the run.
- MIXED: several causes across sections; read the sections column.

