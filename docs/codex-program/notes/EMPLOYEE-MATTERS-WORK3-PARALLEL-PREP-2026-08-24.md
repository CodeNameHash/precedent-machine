# Employee Matters Work3 parallel prep (2026-08-24)

Research-only handoff for **`EMPLOYEE_MATTERS`**. Programme position: **N1 family #14** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants, Termination Fee, Antitrust / Regulatory, Proxy / Meeting, Tax Matters). Repair-plan cluster: wave 1 *continuing-employee compensation standards, service-credit covenants, welfare-plan transition relief* — same stress class as D&O and Proxy / Meeting (one operative unit, roles or linked children), **not** Rep/CC/NOR or fee-economics cluster.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Employee Matters evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 1)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/EMPLOYEE_MATTERS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 1` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/EMPLOYEE_MATTERS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/EMPLOYEE_MATTERS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/EMPLOYEE_MATTERS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 1` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/EMPLOYEE_MATTERS.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/EMPLOYEE_MATTERS/current.json` | **27** comparator-resolved claims (`claim_count: 27`) |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Tax Matters / Proxy prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (4):**

- `EMPLOYEE_MATTERS::EMPLOYEE_COMPENSATION`
- `EMPLOYEE_MATTERS::SERVICE_CREDIT`
- `EMPLOYEE_MATTERS::WELFARE_RELIEF`
- `EMPLOYEE_MATTERS::RETIREMENT_PLAN_ACTION`

**Claim definitions in scope (3):**

- `EMPLOYEE_COMP_ITEM_STANDARD`
- `EMPLOYEE_SERVICE_CREDIT`
- `WELFARE_PLAN_TRANSITION_RELIEF`

**Provision examples in calibration pack:** 6 complete source units (one per comparator deal) — all tagged `EMPLOYEE_COMPENSATION` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---|---:|
| EX-01 | concho | 6.9 | 6 |
| EX-02 | metsera | 6.04 | 5 |
| EX-03 | redhat | 5.11 | 3 |
| EX-04 | skechers | 6.11 | 5 |
| EX-05 | skywater | 7.4 | 4 |
| EX-06 | topbuild | 4.11 | 4 |

All six examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **concho** | Comparator | `evidence/canonical-v2/concho-employee-matters-20260809-2xk-final/` | **6** | Densest — comp items + dual service-credit limbs + dual welfare relief |
| **metsera** | Comparator | `evidence/canonical-v2/metsera-employee-matters-20260809-2xk-final/` | **5** | §6.04 comp + welfare relief cluster |
| **redhat** | Comparator | `evidence/canonical-v2/redhat-employee-matters-20260809-2xk-final/` | **3** | Sparsest sealed set |
| **skechers** | Comparator | `evidence/canonical-v2/skechers-employee-matters-20260809-2xk-final/` | **5** | §6.11 comp + service credit + welfare relief |
| **skywater** | Comparator | `evidence/canonical-v2/skywater-employee-matters-20260809-2xk-final/` | **4** | §7.4 comp + service credit + welfare relief |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-employee-matters-20260809-2xk-r4-final/` | **4** | §4.11 comp + welfare relief (title rule missed §3.1(h) benefit-plan rep — see §3) |

**Sum of comparator `resolved` claims:** **27** across **6 deals** (M5 shadow `claim_count: 27` confirms). Modiv has evidence runs but is **not** in the sealed M5 comparator binding set.

**Claim-definition split (27 total):**

| Claim definition | Count |
|---|---:|
| `EMPLOYEE_COMP_ITEM_STANDARD` | 11 |
| `WELFARE_PLAN_TRANSITION_RELIEF` | 11 |
| `EMPLOYEE_SERVICE_CREDIT` | 5 |

**Earlier / diagnostic runs:** `modiv-employee-matters-20260807-replay/`, `concho-employee-matters-20260808-r1/`, `metsera-employee-matters-20260808-r1/`, `topbuild-employee-matters-20260808-rung4/`, etc.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/employee-matters-producer-prompt.js` — `native-producer-employee-matters/v1`, version **2**; `buildEmployeeMattersProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `EMPLOYEE_MATTERS` |
| Anthropic shaping | `lib/canonical-v2/native-producer/anthropic-provider.js` — `shapeEmployeeMattersFamilyProposals`, `EMPLOYEE_MATTERS_CLAIM_KEY` |
| Candidate resolution | `lib/canonical-v2/native-producer/candidate-resolution.js` — comp-item / standard-kind vocabulary, welfare relief kinds, TPB disclaimer routing |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — `EMPLOYEE_MATTERS_TITLE_PATTERN` (excludes D&O title collisions) |
| P0 surface routing | `lib/canonical-v2/p0-product-surface-routing.js` — `COV-EMPLOYEE` → `EMPLOYEE_MATTERS` |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Product coverage | `lib/canonical-v2/employee-dno-product-projection.js` — `COV-EMPLOYEE` provision subtype |

Recorded native responses on disk under each comparator run directory (e.g. `topbuild-employee-matters-20260809-2xk-r4-final/native-producer-recorded-response-4.11.json`).

### M7 V2 contract references (read-only for Employee Matters agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `EMPLOYEE_MATTERS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-employee-matters.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareEmployeeMatters*` exports

**Work3 first-candidate subtype:** `EMPLOYEE_MATTERS::EMPLOYEE_COMPENSATION` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Employee Matters in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-employee-matters-*-authoring-*` control files exist.

### Tests touching Employee Matters today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Product coverage / parity | `tests/programme-gates/m3-family-parity-register.spec.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Follow-on prompt contract | `tests/canonical-v2-follow-on-family-prompt-contract.test.js` |
| Registration orphan paths | `tests/stage-2y-structure-m7-v2-repair-registration.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js`, no `lib/canonical-v2/m7-v2-employee-matters-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Tax Matters (direct template — medium set, wave-4 cluster, same N1 band):**

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

## 3. Employee Matters-specific scope — continuation covenants and cross-family boundaries

Plan wave-1 cluster: **one independently operative authored unit** with ordered roles or linked children across compensation-item standards, service-credit covenants and welfare-plan transition relief limbs.

### Legal stress (vs Termination / Rep cluster)

| Archetype stress | Employee Matters instance |
|---|---|
| Termination / MAE | Rights / definition hierarchy — no dependency |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| Representations | **Benefit-plan accuracy reps** in rep article — Representations (#6) owns accuracy standards; Q02 link-only on shared printed sections (TopBuild §3.1(h)) |
| General Covenants | `COV-EMPLOYEE` is a dedicated-family code — GC producer must **not** emit it; title classifier routes §4.11-style covenants here |
| D&O | Shared product surface (`employee-dno-product-projection.js`) but separate family key and classifier boundary (D&O title excluded from EM title pattern) |
| **Employee Matters** | **Comp-item standards (base / bonus / benefits / severance), service-credit covenants, welfare transition relief (pre-existing / waiting / expense credit), TPB disclaimer** |

**Employee Matters-specific wrinkles:**

1. **Comp-item partition (Q01):** producer splits each benefit item into its own governed quote — Concho §6.9 carries six comp-item limbs (base salary, employee benefits aggregate, two service-credit rows, two welfare-relief rows). Q01 requires one profile per independently operative limb, not one per section.
2. **Aggregation vs item-by-item:** same section may carry both `AGGREGATE` (employee benefits in the aggregate) and `ITEM_BY_ITEM` (base salary, target bonus) standards — do not collapse by deal.
3. **Benchmark splits:** `TARGET_PRE_CLOSING`, `BUYER_SIMILARLY_SITUATED`, `BUYER_CHOICE_OF_EITHER` (Metsera severance vs disclosure-letter schedule) are separate governed values under `EMPLOYEE_COMP_ITEM_STANDARD`.
4. **Welfare relief dual-limb pattern:** Skechers §6.11 and Concho §6.9 each carry two independently operative welfare relief rows (pre-existing/waiting waiver + expense credit) — separate profiles under Q01.
5. **Service-credit carve-outs:** Concho §6.9 excludes defined-benefit pension, retiree medical and benefit-accrual purposes — scope stamps on `EMPLOYEE_SERVICE_CREDIT` rows, not separate profiles unless comparator emits separate claims.
6. **Classifier vs rep-article overlap:** TopBuild §3.1(h) "Employee Benefits" rep lives in Representations (#6); §4.11 covenant is Employee Matters. Title rule missed §3.1 on original mapping (`step-2e-topbuild-mapping.md`) — Milestone A must verify zero M2 node collision with sealed Representations terminals (same test pattern as No Other Reps / Fraud #8).
7. **Subtype split pending legal review:** all six calibration examples tagged `EMPLOYEE_COMPENSATION`; comparator claims populate three of four sealed subtype buckets — `RETIREMENT_PLAN_ACTION` drew no comparator instances. Legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED`).
8. **M5 shadow role completeness:** all 27 shadow validations report `MISSING_REQUIRED_ROLE` on `LEGAL_ACTOR_OR_SUBJECT` and `TEMPORAL_OR_TRIGGER_SCOPE` — expected pre-Milestone-A gap; Phase 2 authoring must materialise actor and temporal scope roles from source.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All six calibration examples have empty `m3_dependency_ids`.
- Primary stress is **claim-definition partition, comp-item enumeration, aggregation/benchmark splits, welfare dual-limb separation** on complete M2 nodes — not Company Letter discovery or nested CC graphs.
- `Continuing Employee` / `Company Employee` defined terms resolve on the same M2 source node; add linked-rule authorities only if Phase 2 proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **6** | concho, metsera, redhat, skechers, skywater, topbuild |
| Sum of `resolved` claims across comparator runs | **27** | M5 shadow `claim_count: 27` confirms |
| Provision examples (complete source units) | **6** | All comparator-backed |
| M5 subtype buckets (sealed) | **4** | Three populated by comparator; `RETIREMENT_PLAN_ACTION` empty |
| Claim definition keys populated | **3** | See §1 split table |
| Per-deal claim spread | 3–6 | concho densest; redhat sparsest |

**Planning estimate for Milestone A blueprint inventory:** **~25–27 profiles** — likely **~27** if Phase 2 materialises one profile per governed comparator claim (partition by `(claim_definition_key, deal, section, claim)`), matching D&O (31) / Proxy (31) density pattern. Lower bound **~6** if legal intake collapses to one profile per calibration example only — **not** expected given 27 sealed comparator claims and Q01 one-operative-limb ruling. Upper bound if every claim × subtype were independent: 108 — not expected given shared role schema and three claim-definition focus.

**Working census until Phase 2 partition:** treat **27 comparator governed claims** as the terminal claim set across six deals; use **6 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/EMPLOYEE_MATTERS.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-employee-matters-authoring-phase2-authority-v2.json`: terminal registry over six comparator deals; claim-definition partition aligned to 3 populated keys; honour sealed Representations (#6) Q02 link-only on benefit-plan rep rows.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-employee-matters.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-employee-matters-authoring.js`: `prepareEmployeeMattersPhase2FamilyProposal`, `prepareEmployeeMattersFamilyProfilePackageReview` (mirror Tax Matters naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition (all examples currently `EMPLOYEE_COMPENSATION`; service-credit and welfare rows may split); verify zero shared M2 nodes with sealed Representations package.
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-employee-matters-family-profile-package.mjs
```

(Script does not exist yet — add when family-local module lands.)

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Employee Matters |
|---|---|---|---|
| 1–13 | Termination … Tax Matters | Milestone A complete | Shared Work3 contracts |
| 14 | **Employee Matters** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **27** comparator claims but all six pack examples tagged one subtype (`EMPLOYEE_COMPENSATION`) — legal intake needed on four-bucket subtype partition.
- M5 shadow reports `MISSING_REQUIRED_ROLE` on all 27 claims for actor/temporal roles — Phase 2 authoring must close before package seal.
- TopBuild §3.1(h) benefit-plan rep vs §4.11 covenant — coordinate Q02 link-only against sealed Representations (#6).
- `RETIREMENT_PLAN_ACTION` subtype bucket has zero comparator instances — do not invent profiles for empty bucket.
- `work3.test.js` is Termination-heavy; Employee Matters must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-employee-matters.json` on disk.

**Recommended merge sequence:** Employee Matters Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR14+ (coordinate with ongoing merge playbook).

---

## 7. Why #14 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #14 |
|---|---:|---|---|---|---|---|
| **EMPLOYEE_MATTERS** ✅ | **27** / 6 deals | ✅ 4 subtypes | ✅ v2 | ✅ empty M3 deps on pack examples | ✅ partial (Rep benefit-plan Q02) | **Selected** — medium inventory (~27 claims, D&O/Proxy band); mature native producer; wave-1 continuation cluster; no Termination Fee Ben hold |
| KEY_DEFINED_TERMS | 76 / 7 deals | ✅ 5 subtypes | ✅ | partial | partial | Too large; knowledge/willful-breach definitions overlap Representations (#6) and NOR (#8) link-only rows |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | ✅ | Too large for immediate Milestone A — queue for later |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 / 6 deals | ✅ | ✅ | partial | partial | Sole-remedy overlap with Termination Fee (#10) — ten rows held pending Ben on owner family |
| CONSIDERATION | 7 / sparse | ✅ | ✅ | partial | ✅ | Too sparse for medium-band target |
| APPRAISAL_DISSENTERS_RIGHTS | 5 / sparse | ✅ | ✅ | partial | partial | Too sparse; deal-economics cluster overlap |

**Confirmation:** `EMPLOYEE_MATTERS` is the best #14 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 4 subtypes, 3 claim defs), comparator density (27/6, medium band between Tax Matters 17 and Proxy 31), native producer v2 with explicit comp-item / welfare-relief vocabulary, D&O-minimal path favoured (empty M3 deps on all pack examples), and **no open Ben hold blocking inventory**. Representations benefit-plan cross-refs are Q02 link-only against sealed package already on disk.

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on thirteen sealed families; Representations rep-article boundary is link-only against sealed package already on disk; no sole-remedy or disclaimer cluster dependency.
