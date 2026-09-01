# Tax Matters Work3 parallel prep (2026-08-24)

Research-only handoff for **`TAX_MATTERS`**. Programme position: **N1 family #13** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants, Termination Fee, Antitrust / Regulatory, Proxy / Meeting). Repair-plan cluster: wave 4 *intended tax treatment, treatment-protection covenants, tax-opinion cooperation and transfer-tax allocation* — same stress class as Proxy / Meeting (one operative unit, roles or linked children), **not** Rep/CC/NOR or fee-economics cluster.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Tax Matters evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/TAX_MATTERS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 4` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/TAX_MATTERS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/TAX_MATTERS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/TAX_MATTERS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/TAX_MATTERS.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/TAX_MATTERS/current.json` | **17** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / Proxy prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (8):**

- `TAX_MATTERS::INTENDED_TAX_TREATMENT`
- `TAX_MATTERS::TAX_TREATMENT_PROTECTION`
- `TAX_MATTERS::TAX_REPORTING_CONSISTENCY`
- `TAX_MATTERS::TAX_OPINION_COOPERATION`
- `TAX_MATTERS::TRANSFER_TAX_ALLOCATION`
- `TAX_MATTERS::WITHHOLDING_MECHANIC`
- `TAX_MATTERS::FIRPTA_CERTIFICATE`
- `TAX_MATTERS::TAX_INTEGRATION_OR_SPECIAL_MECHANIC`

**Claim definitions in scope (4):**

- `INTENDED_TAX_TREATMENT_KIND`
- `TAX_OPINION_COOPERATION_COVENANT`
- `TAX_TREATMENT_PROTECTION_COVENANT`
- `TRANSFER_TAX_ALLOCATION`

**Provision examples in calibration pack:** 4 complete source units (one per comparator deal) — all tagged `INTENDED_TAX_TREATMENT` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---|---:|
| EX-01 | concho | 4.12 | 1 (protection rep; treatment in §6.18) |
| EX-02 | skechers | 2.14 | 1 (intended treatment) |
| EX-03 | skywater | 7.4 | 2 |
| EX-04 | topbuild | 4.23 | 4 |

All four examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **concho** | Comparator | `evidence/canonical-v2/concho-tax-matters-20260809-2xk-final/` | **3** | §4.12 protection rep + §5.11 protection + §6.18 intended treatment |
| **skechers** | Comparator | `evidence/canonical-v2/skechers-tax-matters-20260809-2xk-final/` | **7** | Densest set — §2.14 treatment, §3.17/§4.14/§6.18 protection + opinion cooperation |
| **skywater** | Comparator | `evidence/canonical-v2/skywater-tax-matters-20260809-2xk-final/` | **2** | §7.4 protection + opinion cooperation |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-tax-matters-20260809-2xk-r3-final/` | **5** | §4.23 opinion cooperation cluster + §7.11 transfer-tax allocation |

**Sum of comparator `resolution_claims`:** **17** across **4 deals** (M5 shadow confirms). Modiv, metsera and redhat have evidence runs but are **not** in the sealed M5 comparator binding set.

**Claim-definition split (17 total):**

| Claim definition | Count |
|---|---:|
| `TAX_TREATMENT_PROTECTION_COVENANT` | 7 |
| `TAX_OPINION_COOPERATION_COVENANT` | 7 |
| `INTENDED_TAX_TREATMENT_KIND` | 2 |
| `TRANSFER_TAX_ALLOCATION` | 1 |

**Earlier / diagnostic runs:** `modiv-tax-matters-20260807-replay/`, `concho-tax-matters-20260808-r1/`, `metsera-tax-matters-20260808-r1/`, `topbuild-tax-matters-20260808-rung3/`, etc.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/tax-matters-producer-prompt.js` — `native-producer-tax-matters/v1`, version **2**; `buildTaxMattersProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `TAX_MATTERS` |
| Cooperation corroboration | `lib/canonical-v2/native-producer/tax-cooperation-corroboration.js` — vocabulary for the two cooperation covenant shapes |
| Anthropic shaping | `lib/canonical-v2/native-producer/anthropic-provider.js` — `shapeTaxMattersFamilyProposals`, `TAX_MATTERS_CLAIM_KEY` |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — `TAX_MATTERS_TITLE_PATTERN` |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Product coverage | `lib/canonical-v2/tax-dividends-appraisal-product-projection.js` — structural provision kind routing |

Recorded native responses on disk under each comparator run directory (e.g. `skechers-tax-matters-20260809-2xk-final/native-producer-recorded-response-2.14.json`).

### M7 V2 contract references (read-only for Tax Matters agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `TAX_MATTERS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-tax-matters.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareTaxMatters*` exports

**Work3 first-candidate subtype:** `TAX_MATTERS::INTENDED_TAX_TREATMENT` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Tax Matters in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-tax-matters-*-authoring-*` control files exist.

### Tests touching Tax Matters today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Product coverage / parity | `tests/programme-gates/m3-family-parity-register.spec.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Follow-on prompt contract | `tests/canonical-v2-follow-on-family-prompt-contract.test.js` |
| Step 2d1 defect regression | `tests/canonical-v2-step-2d1-defects-3-4.test.js` — structural provision kind on committed replay |
| Registration orphan paths | `tests/stage-2y-structure-m7-v2-repair-registration.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js`, no `lib/canonical-v2/m7-v2-tax-matters-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Financing Covenants (direct template — sparse-to-medium set, same wave-4 cluster):**

- Phase 2: `m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-financing-covenants-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-financing-covenants.json`
- Dedicated module: `lib/canonical-v2/m7-v2-financing-covenants-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. Tax Matters-specific scope — tax covenants and cross-family boundaries

Plan wave-4 cluster: **one independently operative authored unit** with ordered roles or linked children across intended treatment, treatment protection, opinion cooperation and transfer-tax allocation limbs.

### Legal stress (vs Termination / Rep cluster)

| Archetype stress | Tax Matters instance |
|---|---|
| Termination / MAE | Rights / definition hierarchy — no dependency |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| Closing Conditions | **Tax opinion as closing condition** — CC (#7) sealed; Q02 link-only (producer: receipt-only conditions are open world) |
| Representations | Tax reps in rep article — Representations (#6) owns accuracy standards; Q02 link-only on shared printed sections |
| Dividends / Appraisal | Deal-economics adjacent families — separate product surfaces; no content duplication |
| **Tax Matters** | **Intended tax treatment (351/368/reorg), treatment-protection covenants, tax-opinion cooperation, transfer-tax bearer allocation** |

**Tax Matters-specific wrinkles:**

1. **Producer boundary — closing condition vs cooperation covenant:** prompt v2 explicitly routes receipt-only tax opinion closing conditions to open world; only operative cooperation/delivery covenants become `TAX_OPINION_COOPERATION_COVENANT`. Coordinate Q02 link-only against sealed Closing Conditions `TAX_OPINION` bucket (#7).
2. **Intended treatment vs protection split:** producer treats `INTENDED_TREATMENT` and `TREATMENT_PROTECTION` as distinct assertion kinds — must not merge in inventory partition even when they share a treatment-term cross-reference.
3. **Multi-limb opinion cooperation:** Skechers §6.18 and TopBuild §4.23 each carry three independently operative cooperation limbs (obtain opinion, deliver representation letters, provide information) — Q01 requires one profile per limb, not one per section.
4. **Party-capacity splits on protection covenants:** Company-side vs Parent-side treatment-protection reps are separate governed claims (Skechers §3.17 vs §4.14; Concho §4.12 vs §5.11) — do not collapse by deal.
5. **Transfer-tax allocation singleton:** TopBuild §7.11 `TRANSFER_TAX_ALLOCATION` is the only comparator instance — bearer_ref drives the governed value (`PARENT`).
6. **Subtype split pending legal review:** all four calibration examples tagged `INTENDED_TAX_TREATMENT`; comparator claims span four claim-definition keys and populate at most four of eight sealed subtype buckets — legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED`).
7. **Empty comparator buckets:** `TAX_REPORTING_CONSISTENCY`, `WITHHOLDING_MECHANIC`, `FIRPTA_CERTIFICATE`, `TAX_INTEGRATION_OR_SPECIAL_MECHANIC` drew no comparator instances — do not materialise profiles without governed claims.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All four calibration examples have empty `m3_dependency_ids`.
- Primary stress is **claim-definition partition, party-capacity splits, multi-limb opinion cooperation enumeration, treatment-term cross-reference scoping** on complete M2 nodes — not Company Letter discovery or nested CC graphs.
- `INTENDED_TAX_TREATMENT_KIND` rows reference defined terms (`Intended Tax Treatment`, reorganization quotes) but those edges resolve on the same M2 source node; add linked-rule authorities only if Phase 2 proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **4** | concho, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **17** | M5 shadow confirms |
| Provision examples (complete source units) | **4** | All comparator-backed |
| M5 subtype buckets (sealed) | **8** | Four populated by comparator; four empty |
| Claim definition keys populated | **4** | See §1 split table |
| Per-deal claim spread | 2–7 | skechers dense; skywater sparse |

**Planning estimate for Milestone A blueprint inventory:** **~15–17 profiles** — likely **~17** if Phase 2 materialises one profile per governed comparator claim (partition by `(claim_definition_key, deal, section, claim)`), matching Financing Covenants / Proxy density pattern. Lower bound **~4** if legal intake collapses to one profile per calibration example only — **not** expected given 17 sealed comparator claims and Q01 one-operative-limb ruling. Upper bound if every claim × subtype were independent: 136 — not expected given shared role schema and four claim-definition focus.

**Working census until Phase 2 partition:** treat **17 comparator governed claims** as the terminal claim set across four deals; use **4 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/TAX_MATTERS.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-tax-matters-authoring-phase2-authority-v2.json`: terminal registry over four comparator deals; claim-definition partition aligned to 4 populated keys; honour sealed CC (#7) Q02 link-only on tax-opinion closing conditions.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-tax-matters.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-tax-matters-authoring.js`: `prepareTaxMattersPhase2FamilyProposal`, `prepareTaxMattersFamilyProfilePackageReview` (mirror Financing Covenants naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition (all examples currently `INTENDED_TAX_TREATMENT`; protection/opinion/allocation rows may split).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-tax-matters-family-profile-package.mjs
```

(Script does not exist yet — add when family-local module lands.)

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Tax Matters |
|---|---|---|---|
| 1–12 | Termination … Proxy / Meeting | Milestone A complete | Shared Work3 contracts |
| 13 | **Tax Matters** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **17** comparator claims but all four pack examples tagged one subtype (`INTENDED_TAX_TREATMENT`) — legal intake needed on eight-bucket subtype partition.
- Producer routes receipt-only tax opinion conditions to open world — coordinate Q02 link-only against sealed CC (#7) `TAX_OPINION` bucket.
- Four sealed subtype buckets have zero comparator instances — do not invent profiles for empty buckets.
- Skechers §6.18 seven-claim spread across four sections may need explicit party-capacity stamps during inventory disposition.
- `work3.test.js` is Termination-heavy; Tax Matters must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-tax-matters.json` on disk.

**Recommended merge sequence:** Tax Matters Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR13+ (coordinate with ongoing merge playbook).

---

## 7. Why #13 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #13 |
|---|---:|---|---|---|---|---|
| **TAX_MATTERS** ✅ | **17** / 4 deals | ✅ 8 subtypes | ✅ v2 | ✅ empty M3 deps on pack examples | partial (CC tax-opinion Q02) | **Selected** — medium inventory (~17 claims, Financing Covenants–Proxy band); mature native producer; wave-4 tax cluster; no Termination Fee Ben hold |
| KEY_DEFINED_TERMS | 76 / 7 deals | ✅ 5 subtypes | ✅ | partial | partial | Too large; knowledge/willful-breach definitions overlap Representations (#6) and NOR (#8) link-only rows |
| EMPLOYEE_MATTERS | 27 shadow / 0 comparator-resolved | ✅ 4 subtypes | ✅ | partial | ✅ | Shadow claims without sealed comparator binding — weaker density signal |
| APPRAISAL_DISSENTERS_RIGHTS | 5 / sparse | ✅ | ✅ | partial | partial | Too sparse; deal-economics cluster overlap |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | ✅ | Too large for immediate Milestone A — queue for later |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 / 6 deals | ✅ | ✅ | partial | partial | Sole-remedy overlap with Termination Fee (#10) — ten rows held pending Ben on owner family |

**Confirmation:** `TAX_MATTERS` is the best #13 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 8 subtypes, 4 claim defs), comparator density (17/4, medium band between Financing Covenants 5 and Proxy 31), native producer v2 with explicit CC boundary routing, D&O-minimal path favoured (empty M3 deps on all pack examples), and **no open Ben hold blocking inventory**. CC tax-opinion cross-refs are Q02 link-only against sealed Closing Conditions (#7).

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on twelve sealed families; CC tax-opinion boundary is link-only against sealed package already on disk; no sole-remedy or disclaimer cluster dependency.
