# Financing Covenants Work3 parallel prep (2026-08-24)

Research-only handoff for **`FINANCING_COVENANTS`**. Programme position: **N1 family #9** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud). Repair-plan cluster: wave 4 *parties, scope, materiality and linked duties* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 995–998) — same stress class as Guaranty and D&O (one operative unit, roles or linked children), **not** Rep/CC/NOR cluster.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Financing Covenants evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/FINANCING_COVENANTS.json` | `PROPOSED_AWAITING_BEN_APPROVAL` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/FINANCING_COVENANTS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/FINANCING_COVENANTS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/FINANCING_COVENANTS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/FINANCING_COVENANTS.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/FINANCING_COVENANTS/current.json` | 5 comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (7):**

- `FINANCING_COVENANTS::OBTAIN_FINANCING`
- `FINANCING_COVENANTS::ALTERNATIVE_FINANCING`
- `FINANCING_COVENANTS::TARGET_COOPERATION`
- `FINANCING_COVENANTS::PAYOFF`
- `FINANCING_COVENANTS::NO_FINANCING_CONDITION`
- `FINANCING_COVENANTS::NOTE_OFFER_OR_CONSENT`
- `FINANCING_COVENANTS::COST_AND_RISK_ALLOCATION`

**Claim definitions in scope (3):**

- `FINANCING_OBTAIN_EFFORTS_STANDARD`
- `NO_FINANCING_CONDITION_ACKNOWLEDGMENT`
- `PAYOFF_DELIVERY_LEAD_TIME_DAYS`

**Provision examples in calibration pack:** 3 complete source units — Concho §6.17, Skechers §6.5, TopBuild §4.17 (all comparator-backed).

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **concho** | Comparator | `evidence/canonical-v2/concho-financing-covenants-20260809-2xk-final/` | **2** (`PAYOFF_DELIVERY_LEAD_TIME_DAYS` ×2 on §6.17) | Draft + final payoff letter lead times |
| **skechers** | Comparator | `evidence/canonical-v2/skechers-financing-covenants-20260809-2xk-final/` | **2** (`FINANCING_OBTAIN_EFFORTS_STANDARD` §6.5, `NO_FINANCING_CONDITION_ACKNOWLEDGMENT` §6.6) | Financed deal; no-financing-condition ack in adjacent section |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-financing-covenants-20260809-2xk-r4-final/` | **1** (`FINANCING_OBTAIN_EFFORTS_STANDARD` §4.17) | Large §4.17 node; financing-source waiver §7.16 routed to Guaranty per title rule |
| modiv, redhat, skywater, metsera, … | M5 shadow / onboarding | `shadow/m7-generalisation/*/m5/families/` | 0 | Genuine absence or unfinanced — correct zero |

**Sum of comparator `resolution_claims`:** **5** across **3 deals**.

**Earlier / diagnostic runs:** `concho-financing-covenants-20260808-r1/`, `skechers-financing-covenants-20260808-r1/`, `modiv-financing-covenants-20260806/`, `modiv-financing-covenants-20260807-replay/`, `skywater-financing-covenants-20260808-r1/`.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/financing-producer-prompt.js` — `native-producer-financing/v1`, version **3**; `buildFinancingProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `FINANCING_COVENANTS` |
| Combined financing/guaranty prompt (legacy) | `lib/canonical-v2/native-producer/financing-guaranty-producer-prompt.js` |
| Product projection | `lib/canonical-v2/financing-guaranty-product-projection.js` — `projectFinancingGuarantyClaims`, `FINANCING_CLAIMS` |
| Partyless structural kind | `tests/canonical-v2-step-2d1-defects-3-4.test.js` — partyless where applicable; projects on structural kind |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — heading terms `financing`, `payoff`; lexical terms `debt financing`, `financing commitment`, `marketing period` |
| P0 surface routing | `lib/canonical-v2/p0-product-surface-routing.js` — `COV-FINANCING`, `COV-MARKETING`, `COV-PAYOFF` → `FINANCING_COVENANTS` |

Recorded native responses on disk under each comparator run directory (e.g. `skechers-financing-covenants-20260809-2xk-final/native-producer-recorded-response-*.json`).

### M7 V2 contract references (read-only for Financing Covenants agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `FINANCING_COVENANTS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-financing-covenants.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareFinancingCovenants*` exports (Guaranty merged PR4; Financing Covenants not yet)

**Work3 first-candidate subtype:** `FINANCING_COVENANTS::OBTAIN_FINANCING` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Financing Covenants in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-financing-covenants-*-authoring-*` control files exist.

### Tests touching Financing Covenants today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Native / resolution | `tests/canonical-v2-financing-guaranty-resolution.test.js`, `tests/canonical-v2-financing-guaranty-follow-on.test.js` |
| Product projection | `tests/canonical-v2-financing-guaranty-product-projection.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Step 2D1 partyless / structural | `tests/canonical-v2-step-2d1-defects-3-4.test.js` |
| Fixture cards | `tests/fixtures/canonical-v2/financing-covenants-fixtures/corpus-cards.json` (8 cards) |
| Stage 2Y-L cohort | `tests/stage-2y-l-live-batch.test.js`, `tests/stage-2y-phase-b-v2-model-experiment.test.js` (8-call cohort) |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js`, no `lib/canonical-v2/m7-v2-financing-covenants-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O / Guaranty minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Guaranty (direct template — sparse wave-4 sibling):**

- Phase 2: `m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-guaranty-financing-party-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json`
- Dedicated module: `lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js` (merged to spine PR4)
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. Financing Covenants-specific scope — sparse corpus and Guaranty boundary

Plan wave-4 cluster (with Guaranty): **one independently operative authored unit** with ordered roles or linked children.

### Legal stress (vs Termination / MAE / Rep cluster)

| Archetype stress | Financing Covenants instance |
|---|---|
| Termination / CC | Nested conditions, external references, governed disclosure notes |
| MAE | Hierarchy, carve-out enum breadth |
| Rep / NOR | Accuracy standards, disclaimer separation, bring-down |
| **Financing Covenants / Guaranty** | **One source unit → roles or linked children; ownership boundary with GUARANTY_FINANCING_PARTY** |

**Financing Covenants-specific wrinkles:**

1. **Dual surface in native producer:** `financing_assertions` (positive covenant facts) vs `financing_mechanics` (alternative financing, marketing period, reimbursement — evidence-only routing, not governed claims). Prompt v3 splits obtain/cooperation/payoff/no-condition from mechanism surfaces.
2. **Sparse comparator set:** only **5** governed claims across **3** deals; most corpus deals correctly return zero. Milestone A inventory will be small — not a defect (Guaranty-class).
3. **Subtype split:** 7 M5 buckets but all three calibration examples tagged `OBTAIN_FINANCING` with `LEGAL_GROUPING_REVIEW_REQUIRED` — payoff lead-time rows may partition to `PAYOFF`; no-financing-condition ack may partition to `NO_FINANCING_CONDITION`.
4. **Cross-family routing (sealed):** TopBuild §4.17 → `FINANCING_COVENANTS`; §7.16 financing-source waiver → `GUARANTY_FINANCING_PARTY` by title/manifest rule (`step-2e-topbuild-mapping.md` lines 83, 115–125). Guaranty Milestone A Q02: one owner, others link-only.
5. **Empty M3 deps on provision examples:** all three pack examples have `m3_dependency_ids: []` — D&O-minimal Phase 2→4 path confirmed.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like Guaranty — skip Termination Phase 3 unless Phase 2 proves a specific unresolved reference edge.**

Rationale:

- No Work1 sealed additive item.
- All calibration examples have empty `m3_dependency_ids`.
- Stress is **subtype classification and role completeness** on complete M2 nodes, not temporal graphs or Company Letter discovery.
- Add linked-rule authorities only if a deal-specific clause proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **3** | Concho, Skechers, TopBuild |
| Sum of `resolution_claims` across comparator runs | **5** | See §1 table |
| Provision examples (complete source units) | **3** | All comparator-backed |
| M5 subtype buckets | **7** | See §1 |
| Fixture corpus cards | **8** | Design-spec acceptance set; not 1:1 Work3 profiles |

**Planning estimate for Milestone A blueprint inventory:** **~5–10 profiles** — likely **~5–8** if Phase 2 materialises one profile per governed claim or provision example (partition by `(subtype, deal, section)`), **not** Termination's 45 or D&O's 31. Upper bound if every example × subtype were independent: 21 — not expected given sparse governed claims and shared subtype tagging on all three examples.

**Working census until Phase 2 partition:** treat **3 provision examples + 5 comparator claims** as the terminal source set, plus honest **zero/absence** rows for unfinanced comparators if the inventory packet requires explicit disposition.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/FINANCING_COVENANTS.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json`: terminal registry over 3 comparator deals; subtype partition aligned to 7 M5 buckets; honour Guaranty Q02 link-only boundary on TopBuild §7.16.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-financing-covenants.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-financing-covenants-authoring.js`: `prepareFinancingCovenantsPhase2FamilyProposal`, `prepareFinancingCovenantsFamilyProfilePackageReview` (mirror Guaranty naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition (all examples currently `OBTAIN_FINANCING`; payoff and no-condition rows may split).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-financing-covenants-family-profile-package.mjs
```

(Script does not exist yet — add when family-local module lands.)

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Financing Covenants |
|---|---|---|---|
| 1–5 | Termination, MAE, D&O, GC, Guaranty | Milestone A complete | Shared Work3 contracts; Guaranty Q02 boundary sealed |
| 6–8 | Representations, Closing Conditions, NOR | In flight / queued | **No dependency** — independent cluster |
| 9 | **Financing Covenants** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- Only **5** comparator governed claims — legal intake may need Ben confirmation on subtype grouping (payoff vs obtain vs no-condition).
- Cross-family routing with sealed Guaranty must stay link-only (`step-2e-topbuild-mapping.md`).
- `work3.test.js` is Termination-heavy; Financing Covenants must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-financing-covenants.json` on disk.

**Recommended merge sequence:** Financing Covenants Phase 2 + Phase 4 evidence + family-local module (parallel with Rep/CC/NOR) → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR5 (coordinate with ongoing merge playbook).

---

## 7. Why #9 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Rep/CC independence | Why not / why #9 |
|---|---:|---|---|---|---|---|
| **FINANCING_COVENANTS** ✅ | **5** / 3 deals | ✅ 7 subtypes | ✅ v3 | ✅ empty M3 deps | ✅ financing/guaranty cluster | **Selected** — Guaranty-class sparse set; sealed Q02 boundary with Guaranty; Milestone A can start immediately without Rep/CC/NOR seals |
| TERMINATION_FEE | 20 / 6 deals | ✅ 8 subtypes | ✅ v3 | uncertain | partial | Termination-adjacent timing/amount mapping; Metsera §8.02 `AMBIGUOUS_NEEDS_REVIEW`; CC prep deferred until wave-1 slice proven; shares Termination fee payment references in sealed Termination profiles |
| NO_SHOP | 365 / 7 deals | ✅ | ✅ | partial | ✅ | Too large for parallel prep while Rep cluster in flight |
| EMPLOYEE_MATTERS | ~40+ / 7 deals | ✅ | ✅ | partial | ✅ | Larger inventory; no stronger independence signal than FC |

**Confirmation:** `FINANCING_COVENANTS` is the best #9 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 7 subtypes, 3 claim defs), Guaranty-sibling wave-4 stress with cross-family boundary already sealed, native producer v3 with full assertion/mechanics streams, D&O-minimal path (empty M3 deps), and **full independence from the Rep/CC/NOR cluster** so Milestone A can start in parallel without waiting on families #6–#8.

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on five sealed families; no bring-down, disclaimer, or nested-condition boundary dependency on Representations or Closing Conditions.
