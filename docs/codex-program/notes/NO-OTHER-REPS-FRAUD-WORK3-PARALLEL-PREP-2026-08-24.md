# No Other Reps / Fraud Work3 parallel prep (2026-08-24)

Research-only handoff for **`NO_OTHER_REPS_FRAUD`**. Programme position: **N1 family #8** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions). Repair-plan cluster: wave 3 *parties, scope, materiality and linked duties* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 995–998) — **Rep-cluster sibling** to `REPRESENTATIONS` (disclaimer / non-reliance / fraud carve-out vs substantive reps), same stress class as D&O and Guaranty (one operative unit, roles or linked children), **not** one of the four named archetype pilots (Termination / MAE / D&O / General Covenants).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing No Other Reps / Fraud evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 3)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/NO_OTHER_REPS_FRAUD.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 3` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/NO_OTHER_REPS_FRAUD.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/NO_OTHER_REPS_FRAUD.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/NO_OTHER_REPS_FRAUD.json` | `BEN_APPROVED_AND_SEALED`, `wave: 3` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/NO_OTHER_REPS_FRAUD.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/NO_OTHER_REPS_FRAUD/current.json` | **36** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / Representations prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (4):**

- `NO_OTHER_REPS_FRAUD::NO_OTHER_REPRESENTATIONS_DISCLAIMER`
- `NO_OTHER_REPS_FRAUD::NON_RELIANCE_ACKNOWLEDGMENT`
- `NO_OTHER_REPS_FRAUD::FRAUD_CARVEOUT`
- `NO_OTHER_REPS_FRAUD::INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT`

**Claim definitions in scope (3):** `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT`, `NON_RELIANCE_ACKNOWLEDGMENT_PRESENT`, `EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT` only. Willful-breach definitions and broader fraud-effect taxonomy stay open-world per native producer discipline.

**Provision examples in calibration pack:** 7 complete source units (one per comparator deal) — all tagged `NO_OTHER_REPRESENTATIONS_DISCLAIMER` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section |
|---|---|---|
| EX-01 | concho | 4.27 |
| EX-02 | metsera | 9.07 |
| EX-03 | modiv | 3.25 |
| EX-04 | redhat | 3.01 |
| EX-05 | skechers | 3.28 |
| EX-06 | skywater | 3.30 |
| EX-07 | topbuild | 3.1 |

All seven examples have empty `m3_dependency_ids` in the calibration pack.

### Comparator runs and supplemental deals

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---:|---:|---|
| **concho** | **Comparator** | `concho-no-other-reps-fraud-20260809-2xk-final/` | **7** | Anchor §4.27 |
| **metsera** | **Comparator** | `metsera-no-other-reps-fraud-20260809-2xk-final/` | **3** | Anchor §9.07 |
| **modiv** | **Comparator** | `modiv-no-other-reps-fraud-20260809-2xk-final/` | **3** | Anchor §3.25; historical answer-provenance crash fixed (`step-2d1-runner-and-writer.md`) |
| **redhat** | **Comparator** | `redhat-no-other-reps-fraud-20260809-2xk-final/` | **5** | Anchor §3.01; willful-breach definition in §8.03(p) is open-world per producer |
| **skechers** | **Comparator** | `skechers-no-other-reps-fraud-20260809-2xk-final/` | **8** | Largest per-deal set; anchors §3.28, §4.17 |
| **skywater** | **Comparator** | `skywater-no-other-reps-fraud-20260809-2xk-final/` | **7** | Anchor §3.30 |
| **topbuild** | **Comparator** | `topbuild-no-other-reps-fraud-20260809-2xk-r4-final/` | **3** | Anchor §3.1; sub-paragraph (w) / (r) pins |

**Sum of comparator `resolution_claims`:** **36** (matches M5 shadow `claim_count`).

**Corpus open-world backlog (not Work3 profiles):** `analysis-policy.json` reports **6** open-world rows tagged `NO_OTHER_REPS_FRAUD` across the full M4 resolution set.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/no-other-reps-fraud-producer.js` — `native-producer-no-other-reps-fraud/v1`, version **1**; `buildNoOtherRepsFraudProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `NO_OTHER_REPS_FRAUD` |
| Resolution (legacy + native) | `lib/canonical-v2/native-producer/no-other-reps-fraud-resolution.js`; unified via `candidate-resolution.js` |
| Element registry | `lib/canonical-v2/native-producer/no-other-reps-fraud-contract.js` — owner-family and evidence-only routing |
| Product projection | `lib/canonical-v2/no-other-reps-fraud-product-projection.js` — BREAK 6 dual-resolver shape fixed (`step-2f-breaks-5-6.md`) |
| Dark bridge (preview only) | `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js` — `VALIDATED_NOT_SERVED` |
| Classifier interaction | `lib/canonical-v2/native-producer/section-family-classifier.js` — **deletes `REPRESENTATIONS` when `NO_OTHER_REPS_FRAUD` wins** on same source node |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Adjacent family (do not absorb) | `REPRESENTATIONS` — separate M5 pack; `representations-producer-prompt.js` |

**Producer assertion streams (positive only):** `no_other_reps_assertions`, `non_reliance_assertions`, `independent_investigation_assertions`, `fraud_carveout_assertions`, `willful_breach_definitions` (definition-only; no fraud-type classification). Design basis: `docs/superpowers/specs/2026-08-03-family-representations-design.md` § "No-other-reps, non-reliance and fraud".

Recorded native responses on disk: e.g. `concho-no-other-reps-fraud-20260809-2xk-final/native-producer-recorded-response-*.json`, `modiv-no-other-reps-fraud-20260809-2xk-final/native-producer-recorded-response-3.25.json`, `skechers-no-other-reps-fraud-20260809-2xk-final/native-producer-recorded-response-3.28.json`.

### M7 V2 contract references (read-only for No Other Reps agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `NO_OTHER_REPS_FRAUD` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareNoOtherRepsFraud*` exports (Termination-only spine today)

**Work3 first-candidate subtype:** `NO_OTHER_REPS_FRAUD::NO_OTHER_REPRESENTATIONS_DISCLAIMER` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for No Other Reps in `work1-acceptance-cases.json` (contrast D&O item 42, GC item 44).

**No** `m7-v2-repair-contract-no-other-reps-fraud-*-authoring-*` control files exist.

### Tests touching No Other Reps today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Product projection / BREAK 6 | `tests/canonical-v2-no-other-reps-fraud-review-projection.test.js`, `canonical-v2-no-other-reps-fraud-rendered-row-preview.test.js`, `canonical-v2-step-2f-breaks-5-6.test.js` |
| Follow-on | `tests/canonical-v2-no-other-reps-fraud-follow-on.test.js` |
| Modiv answer-provenance replay | `tests/canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js` |
| Review preview end-to-end | `tests/canonical-v2-review-preview-end-to-end.test.js`, `canonical-v2-review-preview-route.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-no-other-reps-fraud-work3.test.js`, no `lib/canonical-v2/m7-v2-no-other-reps-fraud-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier) over Termination’s full 11-authority Phase 3 chain.

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Termination (full — do not copy wholesale):**

- Phase 2: `m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json`
- Phase 3: 11 reference authorities + materialisation audit
- Phase 4–5 + Work3 Stage A/B receipts

**D&O (minimal template — mirror this):**

- Phase 2: `m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-dno-indemnification.json`
- Dedicated module: `lib/canonical-v2/m7-v2-dno-indemnification-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. No Other Reps–specific scope — disclaimer elements and cross-family links

Plan wave-3 cluster (with Representations, D&O, Guaranty, General Covenants): **one independently operative authored unit** with ordered roles or linked children (`proposition_unit_rule` in sealed schema).

### Legal stress (vs Termination / Representations)

| Archetype stress | No Other Reps instance |
|---|---|
| Termination | Nested conditions, external references, governed disclosure notes |
| Representations | Limb/qualifier attachment, accuracy standards |
| Closing Conditions | Bring-down tiers, officer-certificate bundles |
| **No Other Reps / D&O / Guaranty** | **One source unit → roles or linked children; four legally distinct disclaimer elements kept separate** |

**No Other Reps–specific wrinkles:**

1. **Four-element separation in native producer:** no-other-reps disclaimer, non-reliance acknowledgment, independent-investigation acknowledgment, and fraud carve-out are distinct assertion streams — do not collapse into one profile role set.
2. **Classifier ownership vs Representations:** `section-family-classifier.js` removes `REPRESENTATIONS` when `NO_OTHER_REPS_FRAUD` wins on the same M2 node. Milestone A inventory must **not** duplicate disclaimer content in Rep profiles sealed at #6; link-only per Q02.
3. **Four subtype buckets vs one tagged example subtype:** all seven calibration examples tagged `NO_OTHER_REPRESENTATIONS_DISCLAIMER` pending legal grouping review — Phase 2 must partition by authored content across non-reliance, fraud carve-out, and independent-investigation buckets.
4. **Extra-contractual reliance scope:** `EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT` often co-occurs with non-reliance on same source unit — ownership boundary is link-only within family (one semantic owner per authored unit, Q01).
5. **Willful-breach definitions:** producer emits `willful_breach_definitions` as definition-only candidates; Red Hat §8.03(p) stays open-world unless Ben approves subtype placement — do not force into `FRAUD_CARVEOUT` profiles without legal intake.
6. **Cross-family boundaries:** `REPRESENTATIONS` (substantive reps — classifier suppresses duplicate), `KEY_DEFINED_TERMS` (defined-term pulls), `MISC_BOILERPLATE` (Metsera §9.07 dual-pin). Q02 ruling: one semantic owner, link-only.
7. **Dual resolver history:** legacy `no-other-reps-fraud-resolution.js` and native `candidate-resolution.js` shapes unified in product projection — Work3 profiles must bind native path fields.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Termination Phase 3 unless Phase 2 proves a specific unresolved reference edge.**

Rationale:

- No Work1 sealed additive item.
- All seven calibration provision examples have empty `m3_dependency_ids`.
- Stress is **four-element classification and role completeness** on complete M2 nodes — not temporal graphs or Company Letter discovery.
- Add **linked-rule / shared-source** authorities only if a deal-specific clause proves an unresolved M3 definition or reference edge that blocks a required role (Q03: fail dependent proposition only). Likely audit candidates: willful-breach cross-ref from rep article to definitions article — treat as Phase 2 audit findings, not assumed Phase 3 upfront.

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **7** | concho, metsera, modiv, redhat, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **36** | M5 shadow confirms |
| Provision examples (complete source units) | **7** | Section-level legal anchors; not 1:1 with profiles |
| M5 subtype buckets | **4** | See §1 |
| Open-world rows (full corpus, not profiles) | **6** | `analysis-policy.json` |
| M5 shadow comparator claims | **36** | `shadow/m5/NO_OTHER_REPS_FRAUD/current.json` |

**Planning estimate for Milestone A blueprint inventory:** **~30–36 profiles** — likely **~32–36** if Phase 2 materialises one profile per governed comparator claim (partition by `(subtype, deal, section, claim)`), comparable to D&O (31). Lower bound **~7** if legal intake collapses to one profile per calibration example only — **not** expected given 36 sealed comparator claims and four subtype buckets. Upper bound if every claim × subtype were independent: 144 — not expected given shared role schema and single-claim focus per row.

**Working census until Phase 2 partition:** treat **36 comparator governed claims** as the terminal claim set across seven deals; use **7 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

Corpus cross-check: open-world rows (6) stay review lane, not Work3 profile keys.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/NO_OTHER_REPS_FRAUD.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-no-other-reps-fraud-authoring-phase2-authority-v2.json`: terminal registry over seven comparator runs; subtype partition aligned to 4 M5 buckets; four-element role completeness per sealed schema.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges (willful-breach definition cross-ref); if needed, add minimal linked-rule authorities only (D&O pattern), not Termination temporal/letter frontier.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-no-other-reps-fraud-authoring.js`: `prepareNoOtherRepsFraudPhase2FamilyProposal`, `prepareNoOtherRepsFraudFamilyProfilePackageReview` (mirror D&O naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-no-other-reps-fraud-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — capture Q01–Q03 rulings in family run plan note; flag `LEGAL_GROUPING_REVIEW_REQUIRED` on seven-example `NO_OTHER_REPRESENTATIONS_DISCLAIMER` tagging vs four subtype buckets; escalate cross-family ownership with `REPRESENTATIONS` only where lawyer judgment required (classifier already enforces technical separation).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

---

## 6. Blockers and merge order

| Order | Family | State | Impact on No Other Reps |
|---|---|---|---|
| 1 | **Termination** | Milestone A complete | Defines shared Work3 contracts |
| 2 | **MAE** | Milestone A complete | Family-local module pattern proven |
| 3 | **D&O** | Milestone A complete | **Direct template** for minimal Phase 2→4 path; comparable profile count (~31) |
| 4 | **General Covenants** | Milestone A complete | Spine merge coordination |
| 5 | **Guaranty** | Milestone A complete | Wave-3 cluster precedent |
| 6 | **Representations** | In progress (#6) | Classifier boundary + Q02 link-only must be sealed before No Other Reps inventory disposition |
| 7 | **Closing Conditions** | In progress (#7) | Bring-down neighbour sealed; no direct content overlap but programme bandwidth |
| 8 | **No Other Reps / Fraud** | This prep only | Parallel evidence drafting OK after Rep + CC boundaries sealed; **no spine merge** until Closing Conditions slice strategy clear |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **36** comparator claims but all seven pack examples tagged one subtype (`NO_OTHER_REPRESENTATIONS_DISCLAIMER`) — legal intake needed on four-bucket subtype partition before inventory disposition.
- `REPRESENTATIONS` vs `NO_OTHER_REPS_FRAUD` classifier interaction — do not duplicate disclaimer content in Rep profiles; verify Rep Milestone A seal before claiming No Other Reps profiles.
- Historical BREAK 6 product-projection dual-resolver mismatch — **fixed** (`step-2f-breaks-5-6.md`); not a Work3 blocker but regression tests must stay green.
- `work3.test.js` is Termination-heavy; No Other Reps must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json` on disk.

**Recommended merge sequence:** Representations Milestone A seal (classifier boundary) → Closing Conditions Milestone A seal → No Other Reps Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority.

---

## 7. Why #8 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Why not #8 |
|---|---:|---|---|---|---|
| **NO_OTHER_REPS_FRAUD** ✅ | **36** / 7 deals | ✅ 4 subtypes | ✅ v1 | ✅ empty M3 deps on examples | **Selected** — Rep-cluster sibling; D&O-scale profile count; wave-3 role completeness; natural follow-on once Rep + CC boundaries sealed |
| TERMINATION_FEE | 20 / 6 deals | ✅ 8 subtypes | ✅ v3 | uncertain | Wave-4 timing/amount mapping; Termination-adjacent — defer until CC wave-1 slice proven |
| FINANCING_COVENANTS | 5 / 3 deals | ✅ 7 subtypes | ✅ v3 | ✅ | Sparse comparator set (Guaranty-class); better after financing/guaranty cluster review |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | Too large for parallel prep while Representations (~50–75) and Closing Conditions (~45–57) are in flight |

**Confirmation:** prior default `NO_OTHER_REPS_FRAUD` as #8 holds on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 4 subtypes, 3 claim defs), comparator density (36/7, between D&O 31 and CC 57), native producer (`no-other-reps-fraud-producer.js` v1, full assertion streams), and wave-3 stress (one operative unit, four-element separation, Rep ownership boundary). No alternative family scores better without violating the “not while Rep/CC in flight” constraint (NO_SHOP) or dropping below useful comparator density (FINANCING_COVENANTS).
