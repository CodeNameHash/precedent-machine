# Representations Work3 parallel prep (2026-08-24)

Research-only handoff for **`REPRESENTATIONS`** (representations and warranties — one native family; not `REPRESENTATIONS_WARRANTIES`). Programme position: **N1 family #6** (after Termination, MAE, D&O, General Covenants, Guaranty). Repair-plan cluster: wave 3 *parties, scope, materiality and linked duties* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 995–998) — same stress class as D&O and Guaranty (one operative unit, roles or linked children), **not** one of the four named archetype pilots (Termination / MAE / D&O / General Covenants).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Representations evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 2)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/REPRESENTATIONS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 2` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/REPRESENTATIONS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/REPRESENTATIONS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/REPRESENTATIONS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 2` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/REPRESENTATIONS.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/REPRESENTATIONS/current.json` | **70** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / MAE prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (6):**

- `REPRESENTATIONS::STATUS_REPRESENTATION`
- `REPRESENTATIONS::COMPLIANCE_REPRESENTATION`
- `REPRESENTATIONS::DOCUMENT_REPRESENTATION`
- `REPRESENTATIONS::CONTRACT_REPRESENTATION`
- `REPRESENTATIONS::FINANCIAL_REPRESENTATION`
- `REPRESENTATIONS::NEGATIVE_REPRESENTATION`

**Claim definitions in scope:** `KNOWLEDGE_QUALIFIER`, `REPRESENTATION_ACCURACY_STANDARD` only (native producer first slice; subject taxonomy and broader rep attributes remain open-world).

**Provision examples in calibration pack:** 6 complete source units (one per comparator deal) — all tagged `STATUS_REPRESENTATION` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section |
|---|---|---|
| EX-01 | concho | 4.13 |
| EX-02 | metsera | 3.06 |
| EX-03 | redhat | 3.01 (whole article) |
| EX-04 | skechers | 3.16 |
| EX-05 | skywater | 3.15 |
| EX-06 | topbuild | 3.1 |

All six examples have empty `m3_dependency_ids` in the calibration pack.

### Comparator runs and supplemental deals

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---:|---:|---|
| **concho** | **Comparator** | `concho-representations-r1b-20260809-2xk-final/` | **12** | Calibration anchor §4.13 |
| **metsera** | **Comparator** | `metsera-representations-r1a-20260809-2xk-final/` | **10** | Anchor §3.06 |
| **redhat** | **Comparator** | `redhat-representations-20260809-2xk-final/` | **9** | Anchor §3.01 (article-scale) |
| **skechers** | **Comparator** | `skechers-representations-r1b-20260809-2xk-final/` | **23** | Largest comparator set; anchor §3.16 |
| **skywater** | **Comparator** | `skywater-representations-r1b-20260809-2xk-final/` | **6** | Anchor §3.15 |
| **topbuild** | **Comparator** | `topbuild-representations-20260809-2xk-r3-final/` | **10** | Anchor §3.1 |
| modiv | Evidence run (not M5 comparator) | `modiv-representations-20260807-replay/`, `modiv-representations-20260806/` | varies | Replay / diagnostic history |
| concho, metsera, skechers, skywater | Earlier rungs | `*-representations-20260808-r1*`, `*-representations-r1*-20260809-2xk-final/` | — | Rung history before final comparator pins |

**Sum of comparator `resolution_claims`:** **70** (matches M5 shadow `comparator_resolved_claim_count`).

**Corpus open-world backlog (not Work3 profiles):** `analysis-policy.json` reports **739** open-world rows tagged `REPRESENTATIONS` across the full M4 resolution set.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/representations-producer-prompt.js` — `native-producer-representations/v1`, version **1**; `buildRepresentationsProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `REPRESENTATIONS` |
| Limb / qualifier shaper | `lib/canonical-v2/native-producer/anthropic-provider.js` — `shapeRepresentationQualifierProposals`, `shapeRepresentationInstance` (Step 2X-L limb minting) |
| Family detection | `lib/canonical-v2/native-producer/family-detection-profiles.js`, `section-family-classifier.js` |
| Resolution routing | `lib/canonical-v2/native-producer/candidate-resolution.js` — REPRESENTATIONS tier; `NO_OTHER_REPS_FRAUD` suppresses duplicate REPRESENTATIONS classification |
| Product projection | `lib/canonical-v2/representations-product-projection.js` — `REPRESENTATION_ACCURACY_STANDARD`, `KNOWLEDGE_QUALIFIER`, topic registry binding |
| Topic registry / review | `lib/canonical-v2/representation-topic-registry.js`, `representation-topic-review-ledger.js` |
| Dark bridge (preview only) | `lib/canonical-v2/representations-dark-bridge.js` — `VALIDATED_NOT_SERVED` |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Adjacent family (do not absorb) | `NO_OTHER_REPS_FRAUD` — separate M5 pack; `no-other-reps-fraud-producer.js` |

**First-slice scope (producer):** positive clause-level accuracy and knowledge qualifiers only. SEC-filings carve-outs, disclosure-letter treatment, subject taxonomy, lookbacks, and bring-down stay open-world or cross-family (`KEY_DEFINED_TERMS`, `CLOSING_CONDITIONS`). Design basis: `docs/superpowers/specs/2026-08-03-family-representations-design.md`.

Recorded native responses on disk: e.g. `concho-representations-r1b-20260809-2xk-final/native-producer-recorded-response-*.json`, `skechers-representations-r1b-20260809-2xk-final/native-producer-recorded-response-3.18.json`, `skywater-representations-r1b-20260809-2xk-final/native-producer-recorded-response-3.28.json`.

### M7 V2 contract references (read-only for Representations agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `REPRESENTATIONS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-representations.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareRepresentations*` exports (Termination-only spine today)

**Work3 first-candidate subtype:** `REPRESENTATIONS::STATUS_REPRESENTATION` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Representations in `work1-acceptance-cases.json` (contrast D&O item 42, GC item 44).

**No** `m7-v2-repair-contract-representations-*-authoring-*` control files exist.

### Tests touching Representations today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Limb shaper | `tests/canonical-v2-representations-limb-shaper.test.js` |
| Product projection | `tests/canonical-v2-representations-product-projection.test.js` |
| Dark bridge | `tests/canonical-v2-representations-dark-bridge.test.js` |
| Qualifier dispatch / card path | `tests/canonical-v2-representation-qualifier-dispatch-measurement.test.js`, `canonical-v2-representation-qualifier-card-path.test.js` |
| Topic registry / review ladder | `tests/canonical-v2-representation-topic-registry.test.js`, `canonical-v2-representation-topic-review.test.js`, `canonical-v2-stage-2y-representation-topic-ladder.test.js`, `canonical-v2-stage-2y-h-representation-topic-comparison.test.js` |
| M3 resolution | `tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Review UI config | `components/review/table-configs/representations-qualifiers.config.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-representations-work3.test.js`, no `lib/canonical-v2/m7-v2-representations-authoring.js`.

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

## 3. Representations-specific scope — limbs, qualifiers and cross-family links

Plan wave-3 cluster (with D&O, Guaranty, General Covenants): **one independently operative authored unit** with ordered roles or linked children (`proposition_unit_rule` in sealed schema).

### Legal stress (vs Termination / MAE)

| Archetype stress | Representations instance |
|---|---|
| Termination | Nested conditions, external references, governed disclosure notes |
| MAE | Hierarchy, carve-out enum breadth, partial-exception operators |
| General Covenants | Topic classification, access-covenant scope |
| **Representations / D&O / Guaranty** | **One source unit → roles or linked children; qualifier attachment and limb identity** |

**Representations-specific wrinkles:**

1. **Dual proposal stream in native shaper:** `representation_instances` (limb assertions) plus per-qualifier accuracy/knowledge objects. Step 2X-L limb minting is additive; qualifier dispatch must stay byte-stable with pre-limb behaviour.
2. **Rich comparator set vs sparse calibration anchors:** **70** governed claims across six deals, but only **six** article-level provision examples in the M5 pack (all `STATUS_REPRESENTATION` pending subtype legal review). Milestone A inventory will be **claim-scale**, not example-scale.
3. **Six subtype buckets vs one tagged example subtype:** Phase 2 must partition by authored content, not copy pack `proposed_subtype` blindly.
4. **Cross-family boundaries:** `NO_OTHER_REPS_FRAUD` (disclaimer / non-reliance), `KEY_DEFINED_TERMS` (knowledge persons and standard text), `CLOSING_CONDITIONS` (bring-down), `MATERIAL_CONTRACTS` (substantive overlap). Q02 ruling: link-only, one semantic owner.
5. **Open-world volume:** 739 corpus open-world rows — review lane only; do not inflate Work3 profile keys.
6. **First-slice producer limits:** subject taxonomy, SEC-filing exceptions, disclosure-letter scope, and lookbacks are explicitly deferred to open-world or follow-on families.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Termination Phase 3 unless Phase 2 proves a specific unresolved reference edge.**

Rationale:

- No Work1 sealed additive item.
- All six calibration provision examples have empty `m3_dependency_ids`.
- Stress is **limb/instance structure, qualifier attachment, and subtype classification** on complete M2 nodes — not temporal graphs or Company Letter discovery.
- Add **linked-rule / shared-source** authorities only if a deal-specific rep clause proves an unresolved M3 definition or reference edge that blocks a required role (Q03: fail dependent proposition only). Likely candidates: knowledge-person definition pulls from `KEY_DEFINED_TERMS`, disclosure-schedule cross-refs — treat as Phase 2 audit findings, not assumed Phase 3 upfront.

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **6** | concho, metsera, redhat, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **70** | M5 shadow confirms |
| Provision examples (complete source units) | **6** | Article-level legal anchors; not 1:1 with profiles |
| M5 subtype buckets | **6** | See §1 |
| Open-world rows (full corpus, not profiles) | **739** | `analysis-policy.json` |
| M5 shadow comparator claims | **70** | `shadow/m5/REPRESENTATIONS/current.json` |

**Planning estimate for Milestone A blueprint inventory:** **~50–75 profiles** — likely **~60–70** if Phase 2 materialises one profile per governed comparator claim (partition by `(subtype, deal, section, claim)`), comparable to General Covenants (54) given similar multi-deal density. Lower bound **~6** if legal intake collapses to one profile per calibration example only — **not** expected given 70 sealed comparator claims and six subtype buckets. Upper bound if every claim × subtype were independent: 420 — not expected given shared role schema and single-claim focus per row.

**Working census until Phase 2 partition:** treat **70 comparator governed claims** as the terminal claim set across six deals; use **6 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

Corpus cross-check: open-world rows (739) stay review lane, not Work3 profile keys.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/REPRESENTATIONS.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-representations-authoring-phase2-authority-v2.json`: terminal registry over six comparator runs; subtype partition aligned to 6 M5 buckets; limb/qualifier role completeness per sealed schema.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges (knowledge definition, disclosure schedule); if needed, add minimal linked-rule authorities only (D&O pattern), not Termination temporal/letter frontier.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-representations.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-representations-authoring.js`: `prepareRepresentationsPhase2FamilyProposal`, `prepareRepresentationsFamilyProfilePackageReview` (mirror D&O naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-representations-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — capture Q01–Q03 rulings in family run plan note; flag `LEGAL_GROUPING_REVIEW_REQUIRED` on six-example `STATUS_REPRESENTATION` tagging vs six subtype buckets; escalate cross-family ownership with `NO_OTHER_REPS_FRAUD` and `KEY_DEFINED_TERMS` only where lawyer judgment required.
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Representations |
|---|---|---|---|
| 1 | **Termination** | Milestone A complete | Defines shared Work3 contracts |
| 2 | **MAE** | Milestone A complete | Family-local module pattern proven |
| 3 | **D&O** | Milestone A complete | **Direct template** for minimal Phase 2→4 path |
| 4 | **General Covenants** | Milestone A complete | Spine merge coordination |
| 5 | **Guaranty** | Milestone A complete | Wave-3 cluster precedent |
| 6 | **Representations** | This prep only | Parallel evidence drafting OK; **no spine merge** until prior family slice strategy clear |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **70** comparator claims but all six pack examples tagged one subtype (`STATUS_REPRESENTATION`) — legal intake needed on six-bucket subtype partition before inventory disposition.
- `NO_OTHER_REPS_FRAUD` vs `REPRESENTATIONS` classifier interaction (`section-family-classifier.js` deletes REPRESENTATIONS when NO_OTHER_REPS_FRAUD wins) — do not duplicate disclaimer content in Rep profiles.
- `work3.test.js` is Termination-heavy; Representations must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-representations.json` on disk.

**Recommended merge sequence:** spine merge coordination (five sealed families) → Representations Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority.
