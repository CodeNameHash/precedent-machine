# V1 coverage ledger

Date: 2026-09-01

This ledger records concepts that V1 displays or expects but the current sealed V2 slice does not measure. `OPEN` means that V2 has not yet measured the concept. It does not mean that the agreement is silent.

## Open extraction gaps

### Termination Fee

| V1 field or concept | Evidence | Owner family | Status |
|---|---|---|---|
| Nine legacy termination-fee fields with no governed counterpart | `docs/core/OPERATING-RULES.md`, “Extraction authorised for Canonical V2 production (2026-08-05)”, records that `FEE_DEFINITIONS` governs only amount, trigger and tail period, while nine legacy fields have no governed counterpart. The ruling does not individually name the nine fields. | `TERMINATION_FEE` | OPEN |
| Fee-trigger detail, sealed label `FEE_TRIGGER` | `docs/codex-program/notes/TERMINATION-FEE-BEN-RULINGS-Q01-Q03-2026-08-24.md` records that this sealed label drew zero comparator instances and was not materialised as a profile. | `TERMINATION_FEE` | OPEN |
| Expense reimbursement, sealed label `EXPENSE_REIMBURSEMENT` | The same Termination Fee ruling note records zero comparator instances. V1 has an advisers-fees-expenses surface in `components/review/table-configs/advisers-fees-expenses.config.js`. | `TERMINATION_FEE` | OPEN |
| Late interest, sealed label `LATE_INTEREST` | The same Termination Fee ruling note records zero comparator instances. V1 renders interest on late payment in `components/review/table-configs/termination-fees.config.js`. | `TERMINATION_FEE` | OPEN |
| Conditional fee schedules, sealed label `CONDITIONAL_FEE_SCHEDULE` | The same Termination Fee ruling note records zero comparator instances. `docs/codex-program/notes/TERMINATION-FEE-WORK3-PARALLEL-PREP-2026-08-24.md` identifies the Modiv conditional-fee schedule and payment-timing evidence runs. | `TERMINATION_FEE` | OPEN |

### Consideration

| V1 field or concept | Evidence | Owner family | Status |
|---|---|---|---|
| Stock consideration / exchange ratio | Concho defines “Exchange Ratio” in section 3.1(b)(i), bound in `evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-index.json`. V1 renders exchange-ratio fields in `components/review/table-configs/consideration-hero.config.js`. `docs/codex-program/notes/BRIEF-SMALL-FAMILIES-2026-09-01.md` confirms that the sealed V2 comparison slice is cash-only. | `CONSIDERATION` | OPEN |
| Election / proration mechanics | Skechers section 2.9(a), bound in `evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154.agreement-index.json`, supplies the election and proration example. Five of the six source deals mention pro rata treatment. V1 renders proration and election mechanics in `components/review/table-configs/consideration-hero.config.js`. | `CONSIDERATION` | OPEN |
| Fractional shares and adjustments | `docs/schema-shape/normalized-v1.json` contains `CONSID-ADJUST` records and explicit cash-in-lieu-of-fractional-shares evidence. V1's Consideration surface includes `CONSID-ADJUST` in `components/review/table-configs/consideration-hero.config.js`. The sealed slice recorded in `docs/codex-program/notes/BRIEF-SMALL-FAMILIES-2026-09-01.md` measures only cash components and Appraisal links. | `CONSIDERATION` | OPEN |

### Employee Matters

| V1 field or concept | Evidence | Owner family | Status |
|---|---|---|---|
| Equity-award treatment: option and RSU rollover, cash-out and conversion | V1 has a dedicated equity-awards table in `components/review/table-configs/equity-awards.config.js`. The sealed slice in `docs/codex-program/notes/EMPLOYEE-MATTERS-WORK3-PARALLEL-PREP-2026-08-24.md` covers compensation, service credit and welfare relief, but not equity-award treatment. | `EMPLOYEE_MATTERS` | OPEN |

### Proxy / Meeting

| V1 field or concept | Evidence | Owner family | Status |
|---|---|---|---|
| Vote standard | V1 defines the primary fields `approvalDefinition` and `voteThreshold` in `components/review/table-configs/approvals-votes.config.js`, renders their vote-standard surface through `components/review/table-configs/votes-approvals-meeting.config.js`, and uses `components/review/table-configs/vote-standard.js` as the shared normaliser. The sealed claim scope in `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/PROXY_MEETING.json` has no vote-standard topic. Ben ruled on 2026-09-01 that Proxy / Meeting owns the stored fact. | `PROXY_MEETING` | OWNER SET; EXTRACTION OPEN |

### No-shop

| V1 field or concept | Evidence | Owner family | Status |
|---|---|---|---|
| Go-shop availability and mechanics | V1 renders `goShopPresent`, `goShopPeriodDays`, `goShopWindow`, `goShopExcludedParties` and `extendedNegotiatingPeriodDays`. The sealed 365-row Work3 package has no Go-shop profile. | `NO_SHOP` | OPEN |
| Notice initiation, content and copy-delivery detail | V1 records the primary fields `discussionInitiationNoticePresent`, `discussionInitiationNoticeHours`, `discussionInitiationNoticeText`, `noticePeriod` and `noticeContent`. The current comparison surface renders the initiation clock, notice period and notice content as distinct facts. Notice content decomposes bidder identity, material terms, copies, unwritten descriptions and updates. The sealed 365-row Work3 package has one initial-proposal-notice prerequisite but no profile for the five named V1 notice fields. | `NO_SHOP` | OPEN |
| Final determination standard as a fact separate from the engagement standard | V1 renders `fiduciaryFinalStandard` separately from `fiduciaryEngageStandard`. `docs/codex-program/notes/BRIEF-NO-SHOP-2026-09-01.md` confirms that the sealed package has no dedicated final-determination profile key and that recommendation-change rows are partial proxies only. | `NO_SHOP` | OPEN |
| Force-the-vote | V1 renders `forceTheVote`, `forceTheVoteDetails` and `forceTheVoteType`. This is the survival of the meeting duty after a recommendation change, not the vote standard. Ben ruled on 2026-09-01 that Proxy / Meeting owns the stored fact. Neither sealed package measures it. | `PROXY_MEETING` | OWNER SET; EXTRACTION OPEN |
| Acquisition Proposal transaction types and exclusions | V1 displays these definition components with the percentage threshold. The sealed Key Defined Terms package measures Acquisition Proposal thresholds but not all displayed definition components. | `KEY_DEFINED_TERMS` | OPEN |
| Qualifying Company Takeover Proposal definition | V1 separately displays whether a proposal could lead to a Superior Proposal and the Board's good-faith qualifying determination. The sealed Key Defined Terms package has no dedicated profile for the definition. No-shop retains the operative engagement gateway. | `KEY_DEFINED_TERMS` | OPEN |
| Acceptable Confidentiality Agreement definition | V1 displays `acceptableConfidentialityAgreementDefinition`. No-shop measures the agreement requirement, but the sealed Key Defined Terms package has no definition profile. | `KEY_DEFINED_TERMS` | OPEN |
| Intervening Event termination | V1 separately asks whether termination is available for an Intervening Event rather than only a recommendation change. Termination is the semantic owner, but its sealed package has no dedicated Intervening Event termination subtype. | `TERMINATION` | OPEN, VERIFY |
| Metsera engagement standard | The No-shop brief binds the exact M2 source span and records no overlapping M4 evidence edge or dedicated Metsera engagement-standard row. | `NO_SHOP` | OPEN |
| Metsera final determination standard and Superior Proposal board-change trigger | The No-shop brief binds the exact M2 source span. No overlapping M4 evidence edge measures that determination, and Metsera's only stored recommendation-change trigger is `INTERVENING_EVENT`. | `NO_SHOP` | OPEN |
| Modiv board-change fiduciary standard | The No-shop brief binds the exact M2 source span and records no overlapping M4 evidence edge or dedicated Modiv recommendation-change fiduciary-standard row. | `NO_SHOP` | OPEN |

### Interim Operating

| V1 field or concept | Evidence | Owner family | Status |
|---|---|---|---|
| Affirmative band with V1 refined specifics | `docs/codex-program/notes/BRIEF-INTERIM-OPERATING-2026-09-01.md` lists the 11 V1 affirmative-covenant subparts and records zero affirmative rows in the sealed 113-row slice. | `INTERIM_OPERATING` | OPEN |
| Asset sales / divestitures / licenses | Clause language occurs in all six source deals bound by `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json`. The brief records that the sealed rows do not contain a separate asset-sale or disposition topic. | `INTERIM_OPERATING` | OPEN |
| Real estate / leases as its own category | The V1 specific-restriction vocabulary in `docs/codex-program/notes/BRIEF-INTERIM-OPERATING-2026-09-01.md` includes Real estate / leases. The sealed 16-line mapping has no separate line for it. | `INTERIM_OPERATING` | OPEN |
| Broader third-party-obligation guarantees beyond debt (watch item) | The V1 vocabulary in the Interim Operating brief includes Guarantees / third-party obligations. The current mapped guarantee rows concern indebtedness and are folded into Indebtedness and loans. Broader guarantees remain a watch item. | `INTERIM_OPERATING` | OPEN, WATCH ITEM |

## Verified covered

These V1 areas have governed V2 coverage. General Covenants remains link-only by design.

| Covered area | Owner family | Status |
|---|---|---|
| Material Adverse Effect | `MAE_DEFINITION` | VERIFIED COVERED |
| Representations | `REPRESENTATIONS` | VERIFIED COVERED |
| No Other Reps / Fraud | `NO_OTHER_REPS_FRAUD` | VERIFIED COVERED |
| Material Contracts | `MATERIAL_CONTRACTS` | VERIFIED COVERED |
| Miscellaneous Boilerplate | `MISC_BOILERPLATE` | VERIFIED COVERED |
| Merger Structure / Closing | `MERGER_STRUCTURE_CLOSING` | VERIFIED COVERED |
| Termination rights | `TERMINATION` | VERIFIED FAMILY COVERAGE; INTERVENING EVENT SUBFIELD OPEN |
| Guaranty | `GUARANTY_FINANCING_PARTY` | VERIFIED COVERED |
| General Covenants | `GENERAL_COVENANTS` | VERIFIED COVERED, LINK-ONLY BY DESIGN |

Evidence: the per-family package records and counts are listed in `docs/codex-program/notes/PROGRAMME-N1-STATUS-2026-08-24.md` and bound by `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64`.

## Stage 8 product work

These are product-layer features. They are not extraction gaps.

| Product feature | Evidence | Owner | Status |
|---|---|---|---|
| Comparison columns | `docs/core/PLAN.md`, Stage 8 | Product layer | SCHEDULED, STAGE 8 |
| Market statistics | `docs/core/PLAN.md`, Stage 8 | Product layer | SCHEDULED, STAGE 8 |
| Search | `docs/core/PLAN.md`, Stage 8 | Product layer | SCHEDULED, STAGE 8 |
