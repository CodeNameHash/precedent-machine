# Closing Conditions Work3 parallel prep (2026-08-24)

Research-only handoff for **`CLOSING_CONDITIONS`**. Programme position: **N1 family #7** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations). Repair-plan cluster: wave 1 *nested conditions and provisos* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 990–992) — introduces **Termination-adjacent condition nesting** after the wave-3 parties/scope cluster, **not** one of the four named archetype pilots (Termination / MAE / D&O / General Covenants).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Closing Conditions evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 2)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/CLOSING_CONDITIONS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 2` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/CLOSING_CONDITIONS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/CLOSING_CONDITIONS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/CLOSING_CONDITIONS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 2` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/CLOSING_CONDITIONS.json` | Active for shadow comparison |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / Representations prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (8):**

- `CLOSING_CONDITIONS::STOCKHOLDER_APPROVAL`
- `CLOSING_CONDITIONS::REGULATORY_APPROVAL`
- `CLOSING_CONDITIONS::LEGAL_RESTRAINT`
- `CLOSING_CONDITIONS::S4_EFFECTIVENESS`
- `CLOSING_CONDITIONS::BRINGDOWN`
- `CLOSING_CONDITIONS::OFFICER_CERTIFICATE`
- `CLOSING_CONDITIONS::FRUSTRATION`
- `CLOSING_CONDITIONS::TAX_OPINION`

**Claim definitions in scope (12):** `COVENANT_COMPLIANCE_STANDARD`, `FRUSTRATION_BREACH_STANDARD`, `GOVERNMENT_PROCEEDING_CONDITION`, `LEGAL_RESTRAINT_CONDITION`, `LISTING_CONDITION`, `METSERA_7_04_FRUSTRATION_BRANCH`, `NO_MAE_CONDITION`, `NO_MAE_CONDITION_CONTINUING`, `OFFICER_CERTIFICATE_REQUIRED`, `REGULATORY_APPROVAL_CONDITION`, `S4_CONDITION_COMPONENT`, `STOCKHOLDER_APPROVAL_CONDITION`.

**Provision examples in calibration pack:** 7 complete source units (one per comparator deal) — all tagged `STOCKHOLDER_APPROVAL` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section |
|---|---|---|
| EX-01 | concho | 7.1 |
| EX-02 | metsera | 7.01 |
| EX-03 | modiv | 6.1 |
| EX-04 | redhat | 6.01 |
| EX-05 | skechers | 7.1 |
| EX-06 | skywater | 8.1 |
| EX-07 | topbuild | 7.1 |

All seven examples have empty `m3_dependency_ids` in the calibration pack.

### Comparator runs and supplemental deals

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---:|---:|---|
| **concho** | **Comparator** | `concho-closing-conditions-20260809-2xk-final/` | **8** | Anchor §7.1 |
| **metsera** | **Comparator** | `metsera-closing-conditions-20260809-2xk-final/` | **5** | Anchor §7.01; frustration branch claim in sealed scope |
| **modiv** | **Comparator** | `modiv-closing-conditions-20260809-2xk-final/` | **11** | Largest per-deal set |
| **redhat** | **Comparator** | `redhat-closing-conditions-20260809-2xk-final/` | **7** | Anchor §6.01 |
| **skechers** | **Comparator** | `skechers-closing-conditions-20260809-2xk-final/` | **7** | Anchor §7.1 |
| **skywater** | **Comparator** | `skywater-closing-conditions-20260809-2xk-final/` | **8** | Anchor §8.1 |
| **topbuild** | **Comparator** | `topbuild-closing-conditions-20260809-2xk-r3-final/` | **11** | Anchor §7.1 |

**Sum of comparator `resolution_claims`:** **57**.

**Corpus open-world backlog (not Work3 profiles):** `analysis-policy.json` reports **36** open-world rows tagged `CLOSING_CONDITIONS` across the full M4 resolution set.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/closing-conditions-producer-prompt.js` — `native-producer-closing-conditions/v3`, version **6**; `buildClosingConditionsProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `CLOSING_CONDITIONS` |
| Proposal shaper | `lib/canonical-v2/native-producer/anthropic-provider.js` — `shapeClosingConditionProposals`; `CLOSING_CONDITION_ASSERTION_KINDS` registry |
| Product projection | `lib/canonical-v2/closing-conditions-product-projection.js` |
| Follow-on source pack | `lib/canonical-v2/closing-conditions-follow-on-source-pack.js` |
| Relationship registry | `lib/canonical-v2/closing-conditions-relationships.js` — officer-certificate cross-refs |
| Family detection / classifier | `lib/canonical-v2/native-producer/family-detection-profiles.js`, `section-family-classifier.js` — `conditions to/of/precedent` title pattern |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |

Recorded native responses on disk: e.g. `concho-closing-conditions-20260809-2xk-final/native-producer-recorded-response-7.4.json`, `metsera-closing-conditions-20260809-2xk-final/native-producer-recorded-response-7.04.json`, `modiv-closing-conditions-20260809-2xk-final/native-producer-recorded-response-6.1.json`.

### M7 V2 contract references (read-only for Closing Conditions agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `CLOSING_CONDITIONS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-closing-conditions.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareClosingConditions*` exports (Termination-only spine today)

**Work3 first-candidate subtype:** `CLOSING_CONDITIONS::STOCKHOLDER_APPROVAL` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Closing Conditions in `work1-acceptance-cases.json` (contrast D&O item 42, GC item 44).

**No** `m7-v2-repair-contract-closing-conditions-*-authoring-*` control files exist.

### Tests touching Closing Conditions today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Core resolution / product | `tests/canonical-v2-closing-conditions.test.js`, `canonical-v2-closing-conditions-party-slice.test.js`, `canonical-v2-closing-conditions-wave-b-resolution.test.js`, `canonical-v2-closing-conditions-follow-on-source-pack.test.js` |
| Metsera operative detail | `tests/canonical-v2-metsera-closing-conditions-operative-detail.test.js` |
| Modiv replay | `tests/canonical-v2-modiv-closing-conditions-partial-receipt-replay.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js`, no `lib/canonical-v2/m7-v2-closing-conditions-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier) over Termination’s full 11-authority Phase 3 chain — **unless** Phase 2 audit finds a blocking officer-certificate or bring-down reference edge.

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

## 3. Closing Conditions-specific scope — nested conditions and cross-family links

Plan wave-1 cluster (with Termination, No-Shop, Termination Fee): **nested conditions, provisos, and compound operative units** — contrast with wave-3 one-unit role completeness already sealed on D&O / GC / Guaranty / Representations.

### Legal stress (vs Termination / Representations)

| Archetype stress | Closing Conditions instance |
|---|---|
| Termination | Nested conditions, external references, governed disclosure notes |
| Representations | Limb/qualifier attachment, accuracy standards |
| **Closing Conditions** | **Condition-type taxonomy, bring-down tiers vs standalone conditions, officer-certificate bundles, frustration causation/breach pairs** |

**Closing Conditions-specific wrinkles:**

1. **Bring-down vs standalone condition:** native producer splits `BRING_DOWN_TIER` (accuracy standard + rep side + covered scope) from freestanding `NO_MAE_CONDITION`, `REGULATORY_APPROVAL`, etc. Cross-family link to `REPRESENTATIONS` is link-only (Q02); do not duplicate rep accuracy fields in CC profiles.
2. **Officer-certificate aggregation:** `OFFICER_CERTIFICATE` assertions cite multiple condition section refs (`certified_condition_refs`) — relationship registry in `closing-conditions-relationships.js`; stress is bundle completeness, not Termination-style temporal graphs.
3. **Eight subtype buckets vs one tagged example subtype:** all seven calibration examples tagged `STOCKHOLDER_APPROVAL` pending legal grouping review — Phase 2 must partition by authored content across bring-down, MAE, regulatory, S-4, frustration, etc.
4. **Metsera frustration branch:** sealed claim `METSERA_7_04_FRUSTRATION_BRANCH` is deal-specific calibration residue — disposition in inventory, not a generic profile template.
5. **Cross-family boundaries:** `MAE_DEFINITION` (MAE term in no-MAE conditions), `REPRESENTATIONS` (bring-down accuracy), `ANTITRUST_REGULATORY` (HSR/regulatory overlap), `PROXY_MEETING` (stockholder approval mechanics). Q02 ruling: one semantic owner, link-only.
6. **Producer v6 nuance:** Red Hat “prevent or materially delay” form stays open-world per prompt — do not force to controlled accuracy codes.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Termination Phase 3 unless Phase 2 proves a specific unresolved reference edge.**

Rationale:

- No Work1 sealed additive item.
- All seven calibration provision examples have empty `m3_dependency_ids`.
- Stress is **condition-type classification, bring-down tier fields, and officer-certificate bundle roles** on complete M2 nodes — not Company Letter discovery or agreement-date temporal graphs.
- Add **linked-rule / shared-source** authorities only if a deal-specific clause proves an unresolved M3 definition or reference edge that blocks a required role (Q03: fail dependent proposition only). Likely audit candidates: bring-down cross-refs to rep articles, officer-certificate `certified_condition_refs` pointing at external sections — treat as Phase 2 audit findings, not assumed Phase 3 upfront.

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **7** | concho, metsera, modiv, redhat, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **57** | See §1 per-deal table |
| Provision examples (complete source units) | **7** | Article-level legal anchors; not 1:1 with profiles |
| M5 subtype buckets | **8** | See §1 |
| Open-world rows (full corpus, not profiles) | **36** | `analysis-policy.json` |

**Planning estimate for Milestone A blueprint inventory:** **~45–57 profiles** — likely **~50–57** if Phase 2 materialises one profile per governed comparator claim (partition by `(subtype, deal, section, claim)`), comparable to General Covenants (54). Lower bound **~7** if legal intake collapses to one profile per calibration example only — **not** expected given 57 sealed comparator claims and eight subtype buckets. Upper bound if every claim × subtype were independent: 456 — not expected given shared role schema and single-claim focus per row.

**Working census until Phase 2 partition:** treat **57 comparator governed claims** as the terminal claim set across seven deals; use **7 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

Corpus cross-check: open-world rows (36) stay review lane, not Work3 profile keys.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/CLOSING_CONDITIONS.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json`: terminal registry over seven comparator runs; subtype partition aligned to 8 M5 buckets; bring-down / officer-certificate role completeness per sealed schema.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges (bring-down rep-article cross-ref, officer-certificate section bundle); if needed, add minimal linked-rule authorities only (D&O pattern), not Termination temporal/letter frontier.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-closing-conditions.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-closing-conditions-authoring.js`: `prepareClosingConditionsPhase2FamilyProposal`, `prepareClosingConditionsFamilyProfilePackageReview` (mirror D&O naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — capture Q01–Q03 rulings in family run plan note; flag `LEGAL_GROUPING_REVIEW_REQUIRED` on seven-example `STOCKHOLDER_APPROVAL` tagging vs eight subtype buckets; escalate cross-family ownership with `REPRESENTATIONS` (bring-down) and `MAE_DEFINITION` (no-MAE conditions) only where lawyer judgment required.
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Closing Conditions |
|---|---|---|---|
| 1 | **Termination** | Milestone A complete | Defines shared Work3 contracts; wave-1 nested-condition precedent |
| 2 | **MAE** | Milestone A complete | No-MAE condition cross-family boundary |
| 3 | **D&O** | Milestone A complete | **Direct template** for minimal Phase 2→4 path |
| 4 | **General Covenants** | Milestone A complete | Comparable profile count (~54) |
| 5 | **Guaranty** | Milestone A complete | Wave-3 cluster precedent |
| 6 | **Representations** | In progress (#6) | Bring-down link-only boundary must be sealed before CC inventory disposition |
| 7 | **Closing Conditions** | This prep only | Parallel evidence drafting OK after Rep Phase 2 boundary clear; **no spine merge** until Representations slice strategy clear |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **57** comparator claims but all seven pack examples tagged one subtype (`STOCKHOLDER_APPROVAL`) — legal intake needed on eight-bucket subtype partition before inventory disposition.
- `METSERA_7_04_FRUSTRATION_BRANCH` deal-specific claim key in sealed scope — inventory row needs explicit disposition, not silent generalisation.
- `work3.test.js` is Termination-heavy; Closing Conditions must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-closing-conditions.json` on disk.

**Recommended merge sequence:** Representations Milestone A seal (bring-down boundary) → Closing Conditions Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority.

---

## 7. Why #7 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Why not #7 |
|---|---:|---|---|---|---|
| **CLOSING_CONDITIONS** ✅ | **57** / 7 deals | ✅ 8 subtypes | ✅ v6 | ✅ empty M3 deps on examples | **Selected** — wave-1 nested-condition stress; natural post-Rep bring-down neighbour; GC-scale profile count |
| NO_OTHER_REPS_FRAUD | 36 / 7 deals | ✅ 4 subtypes | ✅ v1 | ✅ | Rep-cluster sibling; better as #8 after Rep + CC boundaries both sealed |
| NO_SHOP | 365 / 7 deals | ✅ | ✅ | partial | Too large for parallel prep while Representations (~50–75) is in flight |
| TERMINATION_FEE | 20 / 6 deals | ✅ | ✅ | uncertain | Termination-adjacent timing/amount mapping; defer until CC wave-1 slice proven |
| FINANCING_COVENANTS | 5 / 3 deals | ✅ | ✅ | ✅ | Sparse comparator set (Guaranty-class) |
