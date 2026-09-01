# Termination Fee Work3 parallel prep (2026-08-24)

Research-only handoff for **`TERMINATION_FEE`**. Programme position: **N1 family #10** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants). Repair-plan cluster: wave 4 *parties, scope, materiality and linked duties* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 992–998) — same stress class as Guaranty and Financing Covenants (one operative unit, roles or linked children), **not** Rep/CC/NOR cluster.

**CC wave-1 gate cleared:** Closing Conditions (#7) is sealed; the prior deferral of Termination Fee until CC wave-1 is lifted.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Termination Fee evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/TERMINATION_FEE.json` | `PROPOSED_AWAITING_BEN_APPROVAL` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/TERMINATION_FEE.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/TERMINATION_FEE.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/TERMINATION_FEE.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/TERMINATION_FEE.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/TERMINATION_FEE/current.json` | **20** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / Financing Covenants prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (8):**

- `TERMINATION_FEE::FEE_AMOUNT`
- `TERMINATION_FEE::FEE_TRIGGER`
- `TERMINATION_FEE::TAIL_FEE`
- `TERMINATION_FEE::SOLE_REMEDY_LINK`
- `TERMINATION_FEE::CARVEOUT`
- `TERMINATION_FEE::EXPENSE_REIMBURSEMENT`
- `TERMINATION_FEE::LATE_INTEREST`
- `TERMINATION_FEE::CONDITIONAL_FEE_SCHEDULE`

**Claim definitions in scope (4):**

- `TERMINATION_FEE_AMOUNT`
- `TERMINATION_FEE_TAIL_PERIOD_MONTHS`
- `SOLE_REMEDY_LEGAL_EFFECT_PRESENT`
- `SOLE_REMEDY_CARVEOUT_KIND`

**Provision examples in calibration pack:** 6 complete source units (one per comparator deal) — all tagged `FEE_AMOUNT` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---|---:|
| EX-01 | concho | 8.3 | 2 |
| EX-02 | metsera | 8.02 | 5 |
| EX-03 | redhat | 5.06 | 4 |
| EX-04 | skechers | 8.3 | 3 |
| EX-05 | skywater | 10.5 | 1 |
| EX-06 | topbuild | 6.5 | 5 |

All six examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **concho** | Comparator | `evidence/canonical-v2/concho-termination-fee-20260809-2xk-final/` | **2** | Tail period + sole-remedy supplemental |
| **metsera** | Comparator | `evidence/canonical-v2/metsera-termination-fee-20260809-2xk-final/` | **5** | Largest set; amount + tail + sole-remedy/carveouts |
| **redhat** | Comparator | `evidence/canonical-v2/redhat-termination-fee-20260809-2xk-final/` | **4** | Amount + tail + sole-remedy/carveout |
| **skechers** | Comparator | `evidence/canonical-v2/skechers-termination-fee-20260809-2xk-final/` | **3** | Dual-sided amounts (company + parent) + sole remedy |
| **skywater** | Comparator | `evidence/canonical-v2/skywater-termination-fee-20260809-2xk-final/` | **1** | Tail period only |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-termination-fee-20260809-2xk-r1-final/` | **5** | Dual-sided amounts + sole-remedy/carveouts |
| modiv | Evidence run (not M5 comparator) | `modiv-termination-fee-20260807-replay/`, `modiv-termination-fee-20260808-r1/` | varies | Conditional fee schedule / payment-timing stress; diagnostic history |

**Sum of comparator `resolution_claims`:** **20** across **6 deals** (M5 shadow confirms).

**Earlier / diagnostic runs:** `concho-termination-fee-20260808-r1/`, `metsera-termination-fee-20260808-r1/`, `skechers-termination-fee-20260808-r1/`, `redhat-termination-fee-20260808-r1/`, `modiv-termination-fee-20260806/`.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/termination-fee-producer-prompt.js` — `native-producer-termination-fee/v1`, version **3**; `buildTerminationFeeProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `TERMINATION_FEE` |
| Parse / shaping | `lib/canonical-v2/native-producer/termination-fee-parse.js`, `anthropic-provider.js` (`shapeTerminationFeeProposals`, wave-B surfaces) |
| Trigger path (legacy serving) | `lib/canonical-v2/termination-fee-trigger-path.js`, `termination-fee-trigger-presentation.js` |
| Conditional fee value | `lib/canonical-v2/native-producer/conditional-termination-fee-value.js` |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — termination-fee heading terms |
| P0 surface routing | `lib/canonical-v2/p0-product-surface-routing.js` — fee amount / trigger / tail surfaces |

Recorded native responses on disk under each comparator run directory (e.g. `skechers-termination-fee-20260809-2xk-final/native-producer-recorded-response-*.json`).

### M7 V2 contract references (read-only for Termination Fee agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `TERMINATION_FEE` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-termination-fee.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareTerminationFee*` exports (Termination rights merged; Termination Fee not yet)

**Work3 first-candidate subtype:** `TERMINATION_FEE::FEE_AMOUNT` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Termination Fee in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-termination-fee-*-authoring-*` control files exist.

### Tests touching Termination Fee today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Modiv database source / serving | `tests/canonical-v2-termination-fee-modiv-database-source.test.js` |
| Payment timing guard | `tests/canonical-v2-payment-timing-guard-wiring.test.js` |
| Open-world serving boundary | `tests/canonical-v2-open-world-serving-boundary.test.js` |
| Publication disposition | `tests/canonical-v2-publication-disposition.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Stage 2Y-L cohort | `tests/stage-2y-l-live-batch.test.js` (TERMINATION_FEE in fan-out cohort) |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js`, no `lib/canonical-v2/m7-v2-termination-fee-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O / Guaranty / Financing Covenants minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Financing Covenants (direct template — wave-4 sibling, medium sparse set):**

- Phase 2: `m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-financing-covenants-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-financing-covenants.json`
- Dedicated module: `lib/canonical-v2/m7-v2-financing-covenants-authoring.js` (when landed)
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. Termination Fee-specific scope — fee economics and Termination boundary

Plan wave-4 cluster (with Guaranty, Financing Covenants): **one independently operative authored unit** with ordered roles or linked children.

### Legal stress (vs Termination / MAE / Rep cluster)

| Archetype stress | Termination Fee instance |
|---|---|
| Termination (rights) | Who may terminate — **sealed Milestone A (#1)** owns termination rights; fee payment is link-only (Q02) |
| Closing Conditions | Nested conditions — CC (#7) sealed; fee triggers may **reference** termination events link-only |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| **Termination Fee** | **Amount, trigger, tail, sole-remedy/carveout on fee clauses; FEE_SIDE; conditional schedules; payment-timing cross-refs** |

**Termination Fee-specific wrinkles:**

1. **Dual native-producer surfaces:** `fee_amount_assertions`, `fee_trigger_candidates`, `fee_tail_period_assertions` vs open-world / evidence-only routing. Prompt v3 handles per-limb amount splitting and defining-term reach-back (Modiv conditional schedule shape).
2. **Sealed Termination cross-family boundary:** Termination Milestone A profiles own termination-right semantics; Termination Fee owns fee amount/trigger/tail/sole-remedy. Q02: one semantic owner, link-only on shared trigger references (`TERMINATION_FEE_REFERENCE` edge type in spine authoring).
3. **Sole-remedy supplemental resolution:** `SOLE_REMEDY_*` claims resolved via `native-sole-remedy-resolution/v1` (supplemental, not producer-proposal-linked) — Phase 2 partition must honour supplemental vs producer-resolved provenance separately.
4. **Subtype split pending legal review:** all six calibration examples tagged `FEE_AMOUNT`; comparator claims span amount, tail, sole-remedy, and carveout buckets — legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED`).
5. **Metsera §8.02 density:** five comparator claims on one section — stress test for subtype partition and dual carveout rows (fraud + willful breach).
6. **Modiv conditional schedule (non-comparator):** `CONDITIONAL_FEE_SCHEDULE` subtype and `TERMINATION_FEE_TRIGGER_PATH` serving schemas exist in codebase (`termination-fee-trigger-path.js`, graveyard notes) — Phase 3 may be needed **only if** Phase 2 proves unresolved M3 edges on cross-section trigger paths block required roles; empty `m3_dependency_ids` on all six pack examples favour D&O-minimal path first.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like Guaranty / Financing Covenants — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All six calibration examples have empty `m3_dependency_ids`.
- Primary stress is **subtype classification, FEE_SIDE, amount/trigger/tail role completeness**, and Termination link-only boundary — not Company Letter discovery or CC nested graphs.
- Add linked-rule authorities only if Modiv-style conditional trigger paths or payment-timing cross-refs prove an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **6** | concho, metsera, redhat, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **20** | M5 shadow confirms |
| Provision examples (complete source units) | **6** | All comparator-backed |
| M5 subtype buckets | **8** | See §1 |
| Per-deal claim spread | 1–5 | skywater sparse; metsera/topbuild dense |

**Planning estimate for Milestone A blueprint inventory:** **~18–25 profiles** — likely **~20–22** if Phase 2 materialises one profile per governed comparator claim (partition by `(subtype, deal, section, claim)`), comparable to D&O (31) at smaller scale. Lower bound **~6** if legal intake collapses to one profile per calibration example only — **not** expected given 20 sealed comparator claims and eight subtype buckets. Upper bound if every claim × subtype were independent: 160 — not expected given shared role schema and four claim-definition focus.

**Working census until Phase 2 partition:** treat **20 comparator governed claims** as the terminal claim set across six deals; use **6 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/TERMINATION_FEE.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-termination-fee-authoring-phase2-authority-v2.json`: terminal registry over six comparator deals; subtype partition aligned to 8 M5 buckets; honour sealed Termination Q02 link-only on fee-trigger cross-refs.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges (conditional schedules, payment timing).
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-termination-fee.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-termination-fee-authoring.js`: `prepareTerminationFeePhase2FamilyProposal`, `prepareTerminationFeeFamilyProfilePackageReview` (mirror Financing Covenants naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition (all examples currently `FEE_AMOUNT`; amount/tail/sole-remedy/carveout rows may split).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-termination-fee-family-profile-package.mjs
```

(Script does not exist yet — add when family-local module lands.)

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Termination Fee |
|---|---|---|---|
| 1 | **Termination** | Milestone A sealed | Q02 boundary: termination rights vs fee payment — link-only |
| 7 | **Closing Conditions** | Milestone A sealed | CC wave-1 gate cleared — prior deferral lifted |
| 6–8 | Representations, NOR | In flight / queued | **No dependency** — independent cluster |
| 9 | Financing Covenants | In flight | Wave-4 sibling; no blocking dependency |
| 10 | **Termination Fee** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **20** comparator claims but all six pack examples tagged one subtype (`FEE_AMOUNT`) — legal intake needed on eight-bucket subtype partition.
- Sealed Termination profiles must stay link-only for fee-trigger cross-refs; do not duplicate termination-right semantics in Termination Fee profiles.
- Metsera §8.02 five-claim density may need explicit HOLD rows during inventory disposition.
- `work3.test.js` is Termination-heavy; Termination Fee must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-termination-fee.json` on disk.

**Recommended merge sequence:** Termination Fee Phase 2 + Phase 4 evidence + family-local module (parallel with Rep/NOR/FC) → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR5+ (coordinate with ongoing merge playbook).

---

## 7. Why #10 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #10 |
|---|---:|---|---|---|---|---|
| **TERMINATION_FEE** ✅ | **20** / 6 deals | ✅ 8 subtypes | ✅ v3 | ✅ empty M3 deps on pack examples | ✅ wave-4 economics cluster | **Selected** — CC wave-1 sealed; sealed Termination Q02 boundary; medium inventory (~20 claims); native producer mature |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | ✅ | Too large while Rep (~50–75) and NOR (~30–36) in flight |
| EMPLOYEE_MATTERS | ~0–40 / 7 deals | ✅ | ✅ | partial | ✅ | Comparator zero on most deals; weaker density signal than Termination Fee |
| ANTITRUST_REGULATORY | ~13 / deals vary | ✅ | ✅ | partial | ✅ | Regulatory-efforts overlap with CC; no stronger independence than Termination Fee |
| SPECIFIC_PERFORMANCE_REMEDIES | sparse | ✅ | partial | uncertain | partial | Sole-remedy overlap with Termination Fee carveout claims — boundary risk |

**Confirmation:** `TERMINATION_FEE` is the best #10 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 8 subtypes, 4 claim defs), comparator density (20/6, between Financing Covenants 5 and D&O 31), native producer v3 with full amount/trigger/tail/sole-remedy streams, D&O-minimal path favoured (empty M3 deps on pack examples), and **full independence from the Rep/CC/NOR cluster** with CC wave-1 now sealed and Termination Q02 boundary already on disk.

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on six sealed/in-flight families; no bring-down or disclaimer dependency on Representations or NOR. Coordinate Termination link-only cross-refs against sealed Termination package (already Milestone A).
