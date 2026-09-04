# Consideration Work3 parallel prep (2026-08-24)

Research-only handoff for **`CONSIDERATION`**. Programme position: **N1 family #15** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants, Termination Fee, Antitrust / Regulatory, Proxy / Meeting, Tax Matters, Employee Matters). Repair-plan cluster: wave 4 *per-share cash consideration, appraisal-rights linkage in the consideration article* — same stress class as Guaranty / Tax Matters (sparse comparator set, one operative unit per claim), **not** Rep/CC/NOR or fee-economics cluster.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Consideration evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/CONSIDERATION.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 4` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/CONSIDERATION.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/CONSIDERATION.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/CONSIDERATION.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/CONSIDERATION.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/CONSIDERATION/current.json` | **7** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Tax Matters / Employee Matters prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (10 registered; 2 populated by comparator):**

- `CONSIDERATION::CONSIDERATION_PACKAGE`
- `CONSIDERATION::CASH_COMPONENT`
- `CONSIDERATION::STOCK_COMPONENT`
- `CONSIDERATION::CVR_COMPONENT`
- `CONSIDERATION::ELECTION`
- `CONSIDERATION::APPRAISAL_LINK`
- `CONSIDERATION::EXCLUSION`
- `CONSIDERATION::EQUITY_AWARD`
- `CONSIDERATION::WITHHOLDING`
- `CONSIDERATION::EXCHANGE_MECHANICS`

**Claim definitions in scope (2):**

- `PER_SHARE_CASH_CONSIDERATION`
- `APPRAISAL_RIGHTS_STATUS`

**Provision examples in calibration pack:** 4 complete source units (one per comparator deal) — all tagged `CONSIDERATION_PACKAGE` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---|---:|
| EX-01 | metsera | 2.01 | 1 |
| EX-02 | redhat | 2.01 | 2 |
| EX-03 | skechers | 2.7 | 3 |
| EX-04 | topbuild | 2.1 | 1 |

All four examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **metsera** | Comparator | `evidence/canonical-v2/metsera-consideration-20260809-2xk-final/` | **1** | Appraisal-rights limb only |
| **redhat** | Comparator | `evidence/canonical-v2/redhat-consideration-20260809-2xk-final/` | **2** | §2.01 per-share cash ($190) + appraisal |
| **skechers** | Comparator | `evidence/canonical-v2/skechers-consideration-20260809-2xk-final/` | **3** | §2.7 election mechanics — two cash limbs + appraisal |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-consideration-20260809-2xk-r2-final/` | **1** | Appraisal-rights limb only |

**Sum of comparator `resolved` claims:** **7** across **4 deals** (M5 shadow `claim_count: 7` confirms). Concho, modiv and skywater have evidence runs but are **not** in the sealed M5 comparator binding set.

**Claim-definition split (7 total):**

| Claim definition | Count |
|---|---:|
| `APPRAISAL_RIGHTS_STATUS` | 4 |
| `PER_SHARE_CASH_CONSIDERATION` | 3 |

**Earlier / diagnostic runs:** `modiv-consideration-20260807-replay/`, `concho-consideration-20260808-r1/`, `concho-consideration-20260809-2xk-final/`, `skywater-consideration-20260809-2xk-final/`, etc.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/consideration-producer-prompt.js` — `native-producer-consideration/v1`, version **2**; `buildConsiderationProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `CONSIDERATION` |
| Candidate resolution | `lib/canonical-v2/native-producer/candidate-resolution.js` — `handleConsiderationCandidate`, per-share / exchange-ratio / appraisal vocabulary |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — consideration title patterns |
| Product coverage | `lib/canonical-v2/tax-dividends-appraisal-product-projection.js` — structural provision kind routing |
| Shared package contract | `contracts/canonical-v2/successor/shared/transactions/consideration-package.v1.json` |

Recorded native responses on disk under each comparator run directory (e.g. `redhat-consideration-20260809-2xk-final/native-producer-recorded-response-2.01.json`).

### M7 V2 contract references (read-only for Consideration agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `CONSIDERATION` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-consideration.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareConsideration*` exports

**Work3 first-candidate subtype:** `CONSIDERATION::CONSIDERATION_PACKAGE` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Consideration in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-consideration-*-authoring-*` control files exist.

### Tests touching Consideration today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Producer registry / family seam | `tests/canonical-v2-consideration-family-seam.test.js` |
| Product coverage / parity | `tests/programme-gates/m3-family-parity-register.spec.js` |
| Step 2d1 defect regression | `tests/canonical-v2-step-2d1-defects-3-4.test.js` |
| Registration orphan paths | `tests/stage-2y-structure-m7-v2-repair-registration.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js`, no `lib/canonical-v2/m7-v2-consideration-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Tax Matters (direct template — claim-scale partition, wave-4 cluster, sparse set):**

- Phase 2: `m7-v2-repair-contract-tax-matters-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-tax-matters-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-tax-matters.json`
- Dedicated module: `lib/canonical-v2/m7-v2-tax-matters-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. Consideration-specific scope — deal economics and cross-family boundaries

Plan wave-4 cluster: **one independently operative authored unit** per governed M4 claim across per-share cash amounts and appraisal-rights linkage limbs.

### Legal stress (vs Termination / Rep cluster)

| Archetype stress | Consideration instance |
|---|---|
| Termination / MAE | Rights / definition hierarchy — no dependency |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| **APPRAISAL_DISSENTERS_RIGHTS** | **Same printed section** on some deals (e.g. Metsera §2.01 / §2.02 split) — Appraisal family owns standalone appraisal mechanics; Consideration owns appraisal-rights **status embedded in the consideration article** under Q02 link-only |
| Termination Fee | Fee economics — no dependency |
| **Consideration** | **Per-share cash amounts (plain and election-branch), appraisal-rights availability in consideration section** |

**Consideration-specific wrinkles:**

1. **Claim-scale partition (Q01):** Skechers §2.7 carries three governed limbs (Cash Election $63, Mixed Election $57, appraisal) — separate profiles, not one section profile.
2. **Election-branch discrimination:** two `PER_SHARE_CASH_CONSIDERATION` rows on Skechers differ only by election branch (`Cash Election Consideration` vs `Mixed Election Cash Consideration`) — signature must append consideration-term discriminator.
3. **Sparse cash vs appraisal mix:** Metsera and TopBuild comparator sets are appraisal-only; Red Hat and Skechers add per-share cash — do not invent cash profiles for appraisal-only deals.
4. **Classifier vs appraisal-article overlap:** `APPRAISAL_DISSENTERS_RIGHTS` may share a printed section with Consideration on some deals — Milestone A must verify zero M2 terminal collision with any future sealed Appraisal package; for now record Q02 link-only boundary in Phase 2 policy overlay.
5. **Subtype split pending legal review:** all four calibration examples tagged `CONSIDERATION_PACKAGE`; comparator claims populate `CASH_COMPONENT` and `APPRAISAL_LINK` only — eight registered buckets empty. Legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED` on all rows; `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` on cash/appraisal rows).
6. **M5 shadow role completeness:** all 7 shadow validations report `MISSING_REQUIRED_ROLE` on actor/temporal roles — expected pre-Milestone-A gap; Phase 2 authoring must materialise roles from source.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All four calibration examples have empty `m3_dependency_ids`.
- Primary stress is **claim-definition partition, election-branch separation, per-share amount extraction** on complete M2 nodes — not Company Letter discovery or nested CC graphs.
- `Merger Consideration` / election defined terms resolve on the same M2 source node; add linked-rule authorities only if Phase 2 proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **4** | metsera, redhat, skechers, topbuild |
| Sum of `resolved` claims across comparator runs | **7** | M5 shadow `claim_count: 7` confirms |
| Provision examples (complete source units) | **4** | All comparator-backed |
| M5 subtype buckets (sealed) | **10** | Two populated by comparator (`CASH_COMPONENT`, `APPRAISAL_LINK`) |
| Claim definition keys populated | **2** | See §1 split table |
| Per-deal claim spread | 1–3 | skechers densest; metsera/topbuild sparsest |

**Planning estimate for Milestone A blueprint inventory:** **~7 profiles** — one profile per governed comparator claim (partition by `(claim_definition_key, deal, section, claim)`), matching Guaranty (5) / sparse-family density pattern. Lower bound **~4** if legal intake collapses to one profile per calibration example only — **not** expected given 7 sealed comparator claims and Q01 one-operative-limb ruling.

**Working census until Phase 2 partition:** treat **7 comparator governed claims** as the terminal claim set across four deals; use **4 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/CONSIDERATION.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-consideration-authoring-phase2-authority-v2.json`: terminal registry over four comparator deals; claim-definition partition aligned to 2 populated keys; honour Q02 link-only on shared appraisal-article sections.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-consideration.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-consideration-authoring.js`: `prepareConsiderationPhase2FamilyProposal`, `prepareConsiderationFamilyProfilePackageReview` (mirror Tax Matters naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition; all rows likely carry `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` (calibration tags `CONSIDERATION_PACKAGE`; claim keys map to `CASH_COMPONENT` / `APPRAISAL_LINK`).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-consideration-family-profile-package.mjs
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family CONSIDERATION \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-consideration.json
```

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Consideration |
|---|---|---|---|
| 1–14 | Termination … Employee Matters | Milestone A complete | Shared Work3 contracts |
| 15 | **Consideration** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **7** comparator claims but all four pack examples tagged one subtype (`CONSIDERATION_PACKAGE`) — legal intake needed on ten-bucket subtype partition.
- M5 shadow reports `MISSING_REQUIRED_ROLE` on all 7 claims for actor/temporal roles — Phase 2 authoring must close before package seal.
- Shared printed sections with `APPRAISAL_DISSENTERS_RIGHTS` — coordinate Q02 link-only; do not duplicate appraisal mechanics owned by the Appraisal family.
- Eight sealed subtype buckets drew no comparator instances — do not invent profiles for empty buckets.
- `work3.test.js` is Termination-heavy; Consideration must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-consideration.json` on disk.

**Recommended merge sequence:** Consideration Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR15+ (coordinate with ongoing merge playbook).

---

## 7. Why #15 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #15 |
|---|---:|---|---|---|---|---|
| **CONSIDERATION** ✅ | **7** / 4 deals | ✅ 10 subtypes | ✅ v2 | ✅ empty M3 deps on pack examples | ✅ partial (Appraisal Q02) | **Selected** — sealed schema; can start Milestone A now without KEY_DEFINED_TERMS Representations overlap or Termination Fee Ben hold |
| KEY_DEFINED_TERMS | 76 / 7 deals | ✅ 5 subtypes | ✅ | partial | partial | **Deferred** — too large for immediate band; 15 Representations knowledge rows link-only to this family; willful-breach / knowledge-person definitions need Ben coordination |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | ✅ | Too large for immediate Milestone A — prep only if queued |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 / 6 deals | ✅ | ✅ | partial | partial | Sole-remedy overlap with Termination Fee (#10) Ben hold — ten rows held pending Ben |
| APPRAISAL_DISSENTERS_RIGHTS | 5 / sparse | ✅ | ✅ | partial | partial | Too sparse; shared-section boundary with Consideration better handled as Q02 link-only from Consideration side first |

**Confirmation:** `CONSIDERATION` is the best #15 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 10 subtypes, 2 claim defs), comparator density (7/4, sparse band between Guaranty 5 and Tax Matters 17), native producer v2 with explicit per-share / appraisal vocabulary, D&O-minimal path favoured (empty M3 deps on all pack examples), and **no open Ben hold blocking inventory**. KEY_DEFINED_TERMS deferred because Representations (#6) already carries 15 `CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY` rows pending that family.

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on fourteen sealed families; Appraisal-article boundary is Q02 link-only; no sole-remedy or knowledge-definition cluster dependency; sealed M5 programme rulings apply verbatim (0 new family rulings).

**Queued after #15:** `KEY_DEFINED_TERMS` (~76), `NO_SHOP` (~365).
