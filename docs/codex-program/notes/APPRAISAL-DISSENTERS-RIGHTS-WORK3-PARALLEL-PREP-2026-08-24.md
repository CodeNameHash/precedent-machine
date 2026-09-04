# Appraisal / dissenters' rights Work3 parallel prep (2026-08-24)

Research-only handoff for **`APPRAISAL_DISSENTERS_RIGHTS`**. Programme position: **N1 family #17** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants, Termination Fee, Antitrust / Regulatory, Proxy / Meeting, Tax Matters, Employee Matters, Consideration). Repair-plan cluster: wave 4 *standalone appraisal settlement-consent and withdrawal-reconversion covenants* — same stress class as Consideration / Guaranty (sparse comparator set, one operative unit per claim), **not** Rep/CC/NOR or fee-economics cluster.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Appraisal evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/APPRAISAL_DISSENTERS_RIGHTS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 4` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/APPRAISAL_DISSENTERS_RIGHTS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/APPRAISAL_DISSENTERS_RIGHTS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/APPRAISAL_DISSENTERS_RIGHTS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/APPRAISAL_DISSENTERS_RIGHTS.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/APPRAISAL_DISSENTERS_RIGHTS/current.json` | **5** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Consideration / Tax Matters prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (6 registered; comparator maps to 2 claim keys):**

- `APPRAISAL_DISSENTERS_RIGHTS::APPRAISAL_STATUS`
- `APPRAISAL_DISSENTERS_RIGHTS::APPRAISAL_ENTITLEMENT`
- `APPRAISAL_DISSENTERS_RIGHTS::WITHDRAWAL_RECONVERSION`
- `APPRAISAL_DISSENTERS_RIGHTS::APPRAISAL_NOTICE`
- `APPRAISAL_DISSENTERS_RIGHTS::NEGOTIATION_CONTROL`
- `APPRAISAL_DISSENTERS_RIGHTS::SETTLEMENT_CONSENT`

**Claim definitions in scope (2):**

- `APPRAISAL_WITHDRAWAL_RECONVERSION`
- `APPRAISAL_SETTLEMENT_CONSENT`

**Provision examples in calibration pack:** 3 complete source units (one per comparator deal) — all tagged `APPRAISAL_STATUS` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---:|---|
| EX-01 | skechers | 2.7 | 2 |
| EX-02 | skywater | 1.6 | 1 |
| EX-03 | topbuild | 2.1 | 2 |

All three examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---:|---|
| **skechers** | Comparator | `evidence/canonical-v2/skechers-appraisal-dissenters-rights-20260809-2xk-final/` | **2** | §2.7 withdrawal-reconversion + settlement-consent |
| **skywater** | Comparator | `evidence/canonical-v2/skywater-appraisal-dissenters-rights-20260809-2xk-final/` | **1** | §1.6 withdrawal-reconversion only |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-appraisal-dissenters-rights-20260809-2xk-r2-final/` | **2** | §2.1 withdrawal-reconversion + settlement-consent |

**Sum of comparator `resolved` claims:** **5** across **3 deals** (M5 shadow `claim_count: 5` confirms). Metsera, redhat, concho and modiv have evidence runs but are **not** in the sealed M5 comparator binding set.

**Claim-definition split (5 total):**

| Claim definition | Count |
|---|---:|
| `APPRAISAL_WITHDRAWAL_RECONVERSION` | 3 |
| `APPRAISAL_SETTLEMENT_CONSENT` | 2 |

**Earlier / diagnostic runs:** `metsera-appraisal-dissenters-rights-20260809-2xk-final/`, `redhat-appraisal-dissenters-rights-20260809-2xk-final/`, `concho-appraisal-dissenters-rights-20260809-2xk-final/`, `modiv-appraisal-dissenters-rights-20260809-2xk-r2/`, etc.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/appraisal-producer-prompt.js` — `native-producer-appraisal/v1`, version **2**; `buildAppraisalProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `APPRAISAL_DISSENTERS_RIGHTS` |
| Candidate resolution | `lib/canonical-v2/native-producer/candidate-resolution.js` — appraisal settlement / withdrawal vocabulary |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — standalone appraisal title patterns; **suppresses `CONSIDERATION` when Appraisal wins** |
| Product coverage | `lib/canonical-v2/tax-dividends-appraisal-product-projection.js` — structural provision kind routing |
| Open-world promotion | `lib/canonical-v2/open-world-promotion-candidates.js` — settlement-consent typed candidates |

Recorded native responses on disk under each comparator run directory (e.g. `skechers-appraisal-dissenters-rights-20260809-2xk-final/native-producer-recorded-response-*.json`).

### M7 V2 contract references (read-only for Appraisal agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `APPRAISAL_DISSENTERS_RIGHTS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareAppraisal*` exports

**Work3 first-candidate subtype:** `APPRAISAL_DISSENTERS_RIGHTS::APPRAISAL_STATUS` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Appraisal in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-appraisal-dissenters-rights-*-authoring-*` control files exist.

### Tests touching Appraisal today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Producer registry / family seam | `tests/canonical-v2-follow-on-family-prompt-contract.test.js`, `tests/canonical-v2-native-family-adapter-contract.test.js` |
| Product coverage / resolution | `tests/canonical-v2-tax-dividends-appraisal-resolution.test.js` |
| Consideration Q02 boundary (sealed #15) | `tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js` — asserts `APPRAISAL_DISSENTERS_RIGHTS` as link-only owner |
| Section classifier vs Consideration | `tests/canonical-v2-consideration-family-seam.test.js` |
| Registration orphan paths | `tests/stage-2y-structure-m7-v2-repair-registration.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js`, no `lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Consideration (direct template — claim-scale partition, wave-4 cluster, sparse set):**

- Phase 2: `m7-v2-repair-contract-consideration-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-consideration-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-consideration.json`
- Dedicated module: `lib/canonical-v2/m7-v2-consideration-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. Appraisal-specific scope — deal economics and cross-family boundaries

Plan wave-4 cluster: **one independently operative authored unit** per governed M4 claim across withdrawal-reconversion and settlement-consent limbs.

### Legal stress (vs Termination / Rep cluster)

| Archetype stress | Appraisal instance |
|---|---|
| Termination / MAE | Rights / definition hierarchy — no dependency |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| **CONSIDERATION (#15 ✅)** | **Same printed section** on some deals (e.g. TopBuild §2.1, Skechers §2.7) — Consideration owns appraisal-rights **availability / status embedded in the consideration article** (`APPRAISAL_RIGHTS_STATUS`); Appraisal owns **standalone mechanics** (withdrawal-reconversion, settlement-consent) under Q02 link-only |
| Termination Fee | Fee economics — no dependency |
| **Appraisal** | **Parent-consent gates on appraisal settlement; loss-of-appraisal-right re-conversion to merger consideration** |

**Appraisal-specific wrinkles:**

1. **Claim-scale partition (Q01):** Skechers §2.7 and TopBuild §2.1 each carry two governed limbs (withdrawal-reconversion + settlement-consent) — separate profiles, not one section profile.
2. **Sparse skywater set:** only withdrawal-reconversion resolved; do not invent settlement-consent profiles for deals without comparator backing.
3. **Classifier vs consideration-article overlap:** `section-family-classifier.js` suppresses `CONSIDERATION` when Appraisal wins on standalone appraisal titles; Milestone A must verify zero M2 terminal collision with sealed Consideration (#15) package — Phase 2 policy overlay records Q02 link-only boundary (mirror Consideration test assertion).
4. **Producer boundary:** prompt v2 explicitly routes availability / conversion / exchange mechanics to Consideration — only settlement-consent and withdrawal-reconversion enter this family.
5. **Subtype split pending legal review:** all three calibration examples tagged `APPRAISAL_STATUS`; comparator claims map to `APPRAISAL_WITHDRAWAL_RECONVERSION` and `APPRAISAL_SETTLEMENT_CONSENT` — five other registered buckets empty. Legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED` on all rows).
6. **M5 shadow role completeness:** all 5 shadow validations report `MISSING_REQUIRED_ROLE` on actor/temporal roles — expected pre-Milestone-A gap; Phase 2 authoring must materialise roles from source.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All three calibration examples have empty `m3_dependency_ids`.
- Primary stress is **claim-definition partition on complete M2 nodes** — not Company Letter discovery or nested CC graphs.
- DGCL §262 statute references resolve on the same M2 source node; add linked-rule authorities only if Phase 2 proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **3** | skechers, skywater, topbuild |
| Sum of `resolved` claims across comparator runs | **5** | M5 shadow `claim_count: 5` confirms |
| Provision examples (complete source units) | **3** | All comparator-backed |
| M5 subtype buckets (sealed) | **6** | Two populated by comparator claim keys |
| Claim definition keys populated | **2** | See §1 split table |
| Per-deal claim spread | 1–2 | skechers/topbuild densest; skywater sparsest |

**Planning estimate for Milestone A blueprint inventory:** **~5 profiles** — one profile per governed comparator claim (partition by `(claim_definition_key, deal, section, claim)`), matching Guaranty (5) / Consideration (7) sparse-family density pattern. Lower bound **~3** if legal intake collapses to one profile per calibration example only — **not** expected given 5 sealed comparator claims and Q01 one-operative-limb ruling.

**Working census until Phase 2 partition:** treat **5 comparator governed claims** as the terminal claim set across three deals; use **3 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/APPRAISAL_DISSENTERS_RIGHTS.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase2-authority-v2.json`: terminal registry over three comparator deals; claim-definition partition aligned to 2 populated keys; honour Q02 link-only against sealed Consideration (#15).
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js`: `prepareAppraisalDissentersRightsPhase2FamilyProposal`, `prepareAppraisalDissentersRightsFamilyProfilePackageReview` (mirror Consideration naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition; verify zero M2 terminal collision with sealed Consideration package.
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family APPRAISAL_DISSENTERS_RIGHTS \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json
```

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Appraisal |
|---|---|---|---|
| 1–15 | Termination … Consideration | Milestone A complete | Shared Work3 contracts; Consideration Q02 boundary sealed |
| 16 | KEY_DEFINED_TERMS | Prep / in flight | **No dependency** — knowledge-person definitions unrelated |
| 17 | **Appraisal / dissenters' rights** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **5** comparator claims but all three pack examples tagged one subtype (`APPRAISAL_STATUS`) — legal intake needed on six-bucket subtype partition.
- M5 shadow reports `MISSING_REQUIRED_ROLE` on all 5 claims for actor/temporal roles — Phase 2 authoring must close before package seal.
- Shared printed sections with sealed Consideration (#15) — coordinate Q02 link-only; do not duplicate appraisal-rights **status** owned by Consideration.
- Four sealed subtype buckets drew no comparator instances — do not invent profiles for empty buckets.
- `work3.test.js` is Termination-heavy; Appraisal must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json` on disk.

**Recommended merge sequence:** Appraisal Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR17+ (coordinate with ongoing merge playbook).

---

## 7. Why #17 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #17 |
|---|---:|---|---|---|---|---|
| **APPRAISAL_DISSENTERS_RIGHTS** ✅ | **5** / 3 deals | ✅ 6 subtypes | ✅ v2 | ✅ empty M3 deps on pack examples | partial (Consideration Q02) | **Selected** — only remaining medium-sparse family; sealed schema; Consideration (#15) prerequisite now met; no Ben hold |
| KEY_DEFINED_TERMS | 76 / 7 deals | ✅ 5 subtypes | ✅ | partial | partial | **#16 in flight** — do not pick |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | ✅ | Too large for immediate Milestone A — **prep-only queue (#18)** |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 / 6 deals | ✅ | ✅ | partial | partial | Sole-remedy overlap with Termination Fee (#10) Ben hold — avoid |
| DIVIDENDS | 1 / sparse | ✅ | ✅ | partial | ✅ | Too sparse (1 claim) |
| MATERIAL_CONTRACTS | 116 / 7 deals | ✅ | ✅ | partial | partial | Too large — wave-2+ cluster |
| INTERIM_OPERATING | 113 / 7 deals | ✅ | ✅ | partial | partial | Too large |
| MERGER_STRUCTURE_CLOSING | 103 / 7 deals | ✅ | ✅ | partial | partial | Too large |
| MISC_BOILERPLATE | 114 / 7 deals | ✅ | ✅ | partial | partial | Too large |

**Confirmation:** `APPRAISAL_DISSENTERS_RIGHTS` is the best #17 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 6 subtypes, 2 claim defs), comparator density (5/3, sparse band matching Guaranty 5 and Consideration 7), native producer v2 with explicit Consideration boundary in prompt, D&O-minimal path favoured (empty M3 deps on all pack examples), and **no open Ben hold blocking inventory**. Consideration (#15) sealed Q02 link-only boundary is the only cross-family coordination and is already on disk.

**Parallel start:** **Yes — immediately; does not wait on #16.** Family-local module + dedicated test file pattern proven on fifteen sealed families; Consideration boundary is link-only against sealed package; no knowledge-definition or sole-remedy cluster dependency; sealed M5 programme rulings apply verbatim (0 new family rulings).

**Queued after #17:** `NO_SHOP` (~365) prep-only unless a smaller family surfaces.
