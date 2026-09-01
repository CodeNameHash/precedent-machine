# No-Shop Work3 parallel prep (2026-08-24)

Research-only handoff for **`NO_SHOP`**. Programme position: **N1 family #18** (after fifteen sealed families, KEY_DEFINED_TERMS #16 in flight, APPRAISAL_DISSENTERS_RIGHTS #17 prep complete). Repair-plan cluster: wave 1 *nested conditions and provisos* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 990–992) — same stress class as Termination / Closing Conditions / Proxy Meeting (nested operative units, exception ladders, cross-reference timing), **not** one of the four named archetype pilots (Termination / MAE / D&O / General Covenants).

**Milestone A deferred:** prep only. Do **not** implement Milestone A until smaller families (#16 KEY_DEFINED_TERMS, #17 APPRAISAL_DISSENTERS_RIGHTS, and any remaining sparse queue) clear. At **~365 comparator claims** this is the largest sealed-schema family in the N1 ladder (~5× any family sealed to date).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing No-Shop evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 3)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/NO_SHOP.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 3` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/NO_SHOP.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/NO_SHOP.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/NO_SHOP.json` | `BEN_APPROVED_AND_SEALED`, `wave: 3` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/NO_SHOP.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/NO_SHOP/current.json` | **365** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Consideration / Tax Matters prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (8 sealed buckets):**

- `NO_SHOP::RESTRICTION`
- `NO_SHOP::ENGAGEMENT_PERMISSION`
- `NO_SHOP::NOTICE`
- `NO_SHOP::STANDSTILL`
- `NO_SHOP::RECOMMENDATION_CHANGE`
- `NO_SHOP::SAFE_DISCLOSURE`
- `NO_SHOP::REPRESENTATIVE_CONTROL`
- `NO_SHOP::GO_SHOP_WINDOW`

All eight buckets admit the same 13 claim-definition keys under the sealed schema (subtype partition is source-first, not claim-key exclusive).

**Claim definitions in scope (13):**

- `NO_SHOP_CEASE_ACTION`
- `NO_SHOP_EXCEPTION_PREREQUISITE`
- `NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD`
- `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS`
- `NO_SHOP_PROHIBITED_ACTION`
- `NO_SHOP_RECOMMENDATION_CHANGE_ACTION`
- `NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD`
- `NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER`
- `NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE`
- `NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION`
- `NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD`
- `NO_SHOP_STANDSTILL_ACTION`
- `NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS`

**Not in sealed M5 scope (native producer / metric lane):** go-shop windows (explicitly open-world in producer prompt); copy-delivery / notice-period metric keys (`NO_SHOP_COPY_DELIVERY_PERIOD_DAYS`, `NO_SHOP_NOTICE_PERIOD_DAYS`, etc.) — QXO pilot artefacts under `lib/canonical-v2/qxo-no-shop-*` and `contracts/canonical-v2/successor/agreement/no-shop-semantic-schema-inputs/` are serving/metric paths, not Work3 profile keys.

**Provision examples in calibration pack:** 7 complete source units (one per comparator deal) — all tagged `RESTRICTION` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Claims in example |
|---|---|---:|---:|
| EX-01 | concho | 6.3 | 31 |
| EX-02 | metsera | 5.02 | 42 |
| EX-03 | modiv | 5.6 | 33 |
| EX-04 | redhat | 4.02 | 40 |
| EX-05 | skechers | 5.3 | 38 |
| EX-06 | skywater | 5.2 | 33 |
| EX-07 | topbuild | 4.3 | 54 |

All seven examples have empty `m3_dependency_ids` in the calibration pack.

### Comparator runs and supplemental deals

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---:|---:|---|
| **concho** | **Comparator** | `concho-no-shop-20260809-2xk-final/` | **58** | Anchor §6.3 |
| **metsera** | **Comparator** | `metsera-no-shop-20260809-2xk-final/` | **42** | Anchor §5.02 |
| **modiv** | **Comparator** | `modiv-no-shop-20260809-2xk-final/` | **33** | Anchor §5.6 |
| **redhat** | **Comparator** | `redhat-no-shop-20260809-2xk-final/` | **40** | Anchor §4.02 |
| **skechers** | **Comparator** | `skechers-no-shop-20260809-2xk-final/` | **38** | Anchor §5.3 |
| **skywater** | **Comparator** | `skywater-no-shop-20260809-2xk-final/` | **49** | Anchor §5.2 |
| **topbuild** | **Comparator** | `topbuild-no-shop-20260809-2xk-r4-final/` | **105** | Largest per-deal set; anchor §4.3 |

**Sum of comparator `resolution_claims`:** **365** (M5 shadow `claim_count: 365` confirms).

**Claim-definition split (365 total):**

| Claim definition | Count |
|---|---:|
| `NO_SHOP_PROHIBITED_ACTION` | 126 |
| `NO_SHOP_EXCEPTION_PREREQUISITE` | 78 |
| `NO_SHOP_RECOMMENDATION_CHANGE_ACTION` | 32 |
| `NO_SHOP_CEASE_ACTION` | 26 |
| `NO_SHOP_STANDSTILL_ACTION` | 18 |
| `NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE` | 17 |
| `NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER` | 16 |
| `NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD` | 15 |
| `NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD` | 13 |
| `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS` | 9 |
| `NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS` | 8 |
| `NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD` | 5 |
| `NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION` | 2 |

**Corpus open-world backlog (not Work3 profiles):** `analysis-policy.json` reports **16** open-world rows tagged `NO_SHOP` across the full M4 resolution set.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/no-shop-producer-prompt.js` — `native-producer-no-shop/v2`, version **3**; `buildNoShopProducerPrompt` |
| Period parse helper | `lib/canonical-v2/native-producer/no-shop-period-parse.js` |
| Product parity | `lib/canonical-v2/native-producer/no-shop-product-parity.js` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `NO_SHOP` |
| Controlled vocab | `lib/canonical-v2/contract-bundle.js` — `NO_SHOP_ACTION_CODES_V2`, `NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2` (byte-equality tested in `tests/canonical-v2-no-shop-lexicon.test.js`) |
| Family detection / classifier | `lib/canonical-v2/native-producer/family-detection-profiles.js`, `section-family-classifier.js` |
| Product projection | `tests/canonical-v2-no-shop-product-projection.test.js` (projection harness) |
| Review UI (NOSOL accordion) | `components/review/table-configs/nosol-section.config.js`, `nosol-noshop.config.js` — WS-G reading order for no-shop core → fiduciary → notice → matching |
| QXO pilot / metric serving | `lib/canonical-v2/qxo-no-shop-*`, `lib/canonical-v2/no-shop-cross-view-release-f26.js`, `lib/canonical-v2/reviewed-qxo-no-shop-slice.js` — **serving lane**, not Work3 profile authoring |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Design basis | `docs/superpowers/specs/2026-08-02-family-no-shop-design.md` |

**Producer boundary (explicit in prompt header):** go-shop windows stay open-world; Acquisition Proposal and Superior Proposal **definitions** are owned by `KEY_DEFINED_TERMS` — Q02 link-only, do not duplicate definition text in No-Shop profiles.

Recorded native responses on disk: e.g. `skywater-no-shop-20260809-2xk-final/native-producer-recorded-response-5.2.json`, `skywater-no-shop-20260809-2xk-final/native-producer-recorded-response-5.3.json`.

### M7 V2 contract references (read-only for No-Shop agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `NO_SHOP` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareNoShop*` exports

**Work3 first-candidate subtype:** `NO_SHOP::RESTRICTION` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for No-Shop in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-no-shop-*-authoring-*` control files exist.

### Tests touching No-Shop today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Lexicon / controlled vocab | `tests/canonical-v2-no-shop-lexicon.test.js` |
| Product projection | `tests/canonical-v2-no-shop-product-projection.test.js` |
| Candidate resolution / classifier | `tests/canonical-v2-candidate-resolution.test.js`, `tests/stage-2y-f-lexical-classification.test.js` |
| QXO serving / staging | `tests/canonical-v2-staging-qxo-no-shop-*.test.js`, `tests/canonical-v2-no-shop-cross-view-release-f26.test.js` |
| Review UI | `tests/nosol-section.config.test.js`, `tests/nosol-party-subtypes.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-no-shop-work3.test.js`, no `lib/canonical-v2/m7-v2-no-shop-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **Closing Conditions / Termination wave-1 template** for nested-condition stress, with **D&O-minimal Phase 2→4** as the default authority path — **not** Termination’s full 11-authority Phase 3 chain unless Phase 2 audit proves blocking definition edges.

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Closing Conditions (wave-1 neighbour — nested conditions, D&O-minimal path proven at 57 profiles):**

- Phase 2: `m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-closing-conditions-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-closing-conditions.json`
- Dedicated module: `lib/canonical-v2/m7-v2-closing-conditions-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js`

**Termination (reference only for nested-condition archetype — do not copy wholesale at 365-profile scale):**

- Phase 2: `m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json`
- Phase 3: 11 reference authorities + materialisation audit
- Phase 4–5 + Work3 Stage A/B receipts
- 45 profiles sealed at **1,121,931 bytes** with Blocker-A per-profile fixture proofs — scale reference for package byte budgeting

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`
- Fixture closure helper: `scripts/lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs`

---

## 3. No-Shop-specific scope — nested provisos and cross-family links

Plan wave-1 cluster (with Termination, Closing Conditions, Proxy Meeting, Termination Fee): **nested conditions, provisos, exception ladders, and compound operative units** — contrast with wave-3 one-unit role completeness on D&O / GC / Guaranty / Representations.

### Legal stress (vs Termination / Closing Conditions)

| Archetype stress | No-Shop instance |
|---|---|
| Termination | Nested conditions, external references, governed disclosure notes |
| Closing Conditions | Condition-type taxonomy, bring-down tiers |
| **No-Shop** | **Prohibited-action enumeration + exception prerequisite pairing; match-period timing; recommendation-change fiduciary ladder; representative control / standstill enforcement; safe-harbour disclosure carve-outs** |

**No-Shop-specific wrinkles:**

1. **Claim-scale density:** **365** governed claims across seven deals — **TopBuild §4.3 alone carries 105**. Milestone A inventory is claim-scale (Q01 one-operative-limb), not section-scale. The seven provision examples are article containers, not profile templates.
2. **Dominant claim bands:** prohibited actions (126) + exception prerequisites (78) = **204 claims (56%)** — natural first Milestone A slice boundary (see §4).
3. **Eight subtype buckets vs one tagged example subtype:** all seven calibration examples tagged `RESTRICTION` pending legal grouping review — Phase 2 must partition by authored content across engagement, notice, standstill, recommendation-change, safe-disclosure, representative-control, go-shop.
4. **Sealed schema admits all 13 claim keys under all 8 subtypes:** claim-key → subtype mapping is a proposal, not a sealed rule — expect `LEGAL_GROUPING_REVIEW_REQUIRED` on every row (same pattern as Financing Covenants / No Other Reps).
5. **Cross-family boundaries (Q02 link-only):**
   - `KEY_DEFINED_TERMS` — Acquisition Proposal / Superior Proposal / Intervening Event definitions (producer prompt explicitly routes here)
   - `TERMINATION_FEE` — fee triggers on recommendation change / superior proposal acceptance
   - `PROXY_MEETING` — stockholder-meeting adjacency on recommendation changes
   - `TERMINATION` — termination-for-superior-proposal cross-refs (sealed Termination profiles own termination-right mechanics)
   - `REPRESENTATIONS` — knowledge qualifiers on action knowledge (if present) link-only against Representations / KEY_DEFINED_TERMS
6. **Go-shop and metric keys:** go-shop windows and copy-delivery/notice metric dimensions stay open-world or QXO serving lane — do not inflate Work3 profile keys.
7. **Representative-control / standstill pairing:** native producer emits `REPRESENTATIVE_CONTROL_STANDARD`, `STANDSTILL_ACTION`, and `CEASE_ACTION` as distinct assertion kinds — Q01 keeps each limb its own profile even when printed in one subsection.

### Phase path — recommended

**Default: D&O-minimal (Phase 2 → Phase 4, skip Phase 3 reference frontier).**

Rationale:

- No Work1 sealed additive item.
- All seven calibration provision examples have empty `m3_dependency_ids`.
- Primary stress is **claim-definition partition and exception-ladder role completeness** on complete M2 nodes — not Company Letter discovery or agreement-date temporal graphs.
- Add **linked-rule / shared-source** authorities only if Phase 2 audit finds an unresolved M3 definition or reference edge that blocks a required role (Q03: fail dependent proposition only). Likely audit candidates: Superior Proposal threshold cross-refs to definitions article, termination-fee amount cross-refs — treat as Phase 2 audit findings, not assumed Phase 3 upfront.

**Do not default to Termination Phase 3** at this family size unless a specific unresolved reference edge is proven blocking — the 11-authority chain multiplied across 365 terminals is not proportionate.

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate and Milestone A slicing

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **7** | concho, metsera, modiv, redhat, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **365** | M5 shadow confirms |
| Provision examples (complete source units) | **7** | Article-level legal anchors; not 1:1 with profiles |
| M5 subtype buckets | **8** | All admit same 13 claim keys |
| Claim definition keys populated | **13** | See §1 split table |
| Open-world rows (full corpus, not profiles) | **16** | `analysis-policy.json` |
| Largest single deal (topbuild) | **105** | ~29% of family claim mass |
| Termination scale reference (sealed) | **45 profiles → ~1.1 MB** | Blocker-A fixture closure included |

**Planning estimate for Milestone A blueprint inventory:** **~365 profiles** — one profile per governed comparator claim (partition by `(claim_definition_key, deal, section, claim)`), matching Q01 one-operative-limb ruling. Lower bound **~7** if legal intake collapses to one profile per calibration example only — **not** expected given 365 sealed comparator claims. Upper bound if every claim × subtype were independent: 2,920 — not expected given single-claim focus per row and shared role schema.

**Working census until Phase 2 partition:** treat **365 comparator governed claims** as the terminal claim set across seven deals; use **7 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

### Are Milestone A slices needed?

**Yes — mandatory for implementation, not optional.**

No sealed family exceeds **70** profiles today; No-Shop at **~365** is ~**5×** the largest sealed package (Representations / Antitrust). Termination at 45 profiles already produces a **~1.1 MB** on-disk package with Blocker-A per-profile fixture proofs (4 fixture kinds × 45 profiles = 180 proofs). Extrapolating linearly:

- **~365 profiles → ~1,460 fixture proofs → ~8–10 MB package** (order-of-magnitude; TopBuild resolution alone is 2.9 MB)
- Inventory review packet at 365 rows exceeds practical single-pass lawyer review
- Dedicated test + generator memory already uses `NODE_OPTIONS='--max-old-space-size=8192'` on families ≤70 profiles

**Recommended slice strategy (when Milestone A starts):**

| Slice | Claim-definition band | ~Claims | Rationale |
|---|---|---:|---|
| **A** | `NO_SHOP_PROHIBITED_ACTION` + `NO_SHOP_EXCEPTION_PREREQUISITE` | **204** | Dominant mass; exception ladder pairing is the core no-shop mechanic |
| **B** | Recommendation-change cluster (`RECOMMENDATION_CHANGE_*`, `RECOMMENDATION_SAFE_DISCLOSURE`) | **80** | Fiduciary-out / change-of-recommendation stress; cross-refs Termination Fee / Proxy |
| **C** | Standstill / representative / cease (`STANDSTILL_*`, `REPRESENTATIVE_*`, `CEASE_*`, `FIDUCIARY_ENGAGEMENT_*`) | **64** | Enforcement and representative-control mechanics |
| **D** | Match periods (`INITIAL_*`, `SUBSEQUENT_*`) | **17** | Timing-only band; smallest slice, good closure proof |

**Authority path per slice:** one **Phase 2 terminal registry** can materialise all 365 terminals in a single authority JSON (mechanical claim-scale partition). **Package seal, inventory disposition, lawful-fixture override, and dedicated test proof** should run **per slice** (A→D), merging into one family package only when all four slices seal — mirror incremental `lawful-work3-fixture-add-override.mjs` pattern used from Termination Fee onward.

**Alternative (not recommended as first pass):** deal-by-deal slices (7 slices, 33–105 claims each) — easier byte budgeting but splits exception ladders across package boundaries and complicates cross-deal subtype-tree consistency.

---

## 5. Implementation steps (future dedicated agent — do not start now)

1. **Wait for queue clearance** — KEY_DEFINED_TERMS (#16) and APPRAISAL_DISSENTERS_RIGHTS (#17) Milestone A complete; Superior Proposal / knowledge definition Q02 boundaries on disk.
2. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/NO_SHOP.json`; Ben profile-set approval before `PROFILE_SET_V1`.
3. **Phase 2 evidence (single authority)** — `m7-v2-repair-contract-no-shop-authoring-phase2-authority-v2.json`: terminal registry over seven comparator runs; all 365 terminals; subtype partition aligned to 8 M5 buckets.
4. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges (Superior Proposal definition, termination-fee cross-ref); if needed, add minimal linked-rule authorities only.
5. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise slice packages before merged `m7-v2-repair-family-work3-profile-package-no-shop.json`.
6. **Family-local module** — `lib/canonical-v2/m7-v2-no-shop-authoring.js`: `prepareNoShopPhase2FamilyProposal`, `prepareNoShopFamilyProfilePackageReview` (mirror Closing Conditions naming).
7. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-no-shop-work3.test.js`; do **not** extend `work3.test.js`. Pin slice digests incrementally.
8. **Inventory / Ben disposition — per slice** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on seven-example `RESTRICTION` tagging vs eight subtype buckets; mechanical KEEP_ALL for slice claim count; escalate cross-family ownership with KEY_DEFINED_TERMS / TERMINATION_FEE only where lawyer judgment required.
9. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
10. **Proof** — `CI=true npm test` on new file + manifest/contract tests per slice; `npm run build`; update lawful fixture when merged package bytes exist.

**Regenerate package (when module exists — slice-aware):**

```bash
node scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase2-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase4-authority.mjs
node scripts/stage-2y-structure-m7-v2-no-shop-inventory-review-packet.mjs --slice A   # future flag
node scripts/stage-2y-structure-m7-v2-no-shop-ben-inventory-disposition.mjs --slice A
node scripts/stage-2y-structure-m7-v2-no-shop-family-profile-package.mjs --slice A
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
  --family NO_SHOP \
  --package evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json
```

---

## 6. Blockers and merge order

| Order | Family | State | Impact on No-Shop |
|---|---|---|---|
| 1–15 | Termination … Consideration | Milestone A complete | Shared Work3 contracts; wave-1 nested-condition precedent (CC #7, Termination #1) |
| 16 | **KEY_DEFINED_TERMS** | In flight | **Prerequisite** — Superior Proposal / Acquisition Proposal definition Q02 boundary must seal before No-Shop inventory disposition |
| 17 | **APPRAISAL_DISSENTERS_RIGHTS** | Prep complete | No dependency — clear first |
| 18 | **No-Shop** | **This prep only — Milestone A deferred** | Do not start until #16–17 clear and slice plan accepted |

Additional blockers:

- **Scale:** 365 claims — largest N1 family; single-shot Milestone A exceeds proven package/test scale (§4).
- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **365** comparator claims but all seven pack examples tagged one subtype (`RESTRICTION`) — legal intake needed on eight-bucket subtype partition.
- TopBuild §4.3 carries **105** claims — any slice plan must include TopBuild rows or explicitly defer that deal.
- Sealed Termination Fee (#10) holds 12 rows on sole-remedy owner family — coordinate recommendation-change / fee cross-refs before slice B disposition.
- `work3.test.js` is Termination-heavy; No-Shop must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-no-shop.json` on disk.

**Recommended merge sequence:** KEY_DEFINED_TERMS Milestone A seal (definition Q02 boundary) → Appraisal (#17) Milestone A → No-Shop Phase 2 single authority + **slice A** package → inventory disposition → slice B–D → merged family package → Ben profile-set approval → registration authority → spine merge PR18+.

---

## 7. Why #18 and Milestone A deferred (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Why not immediate Milestone A |
|---|---:|---|---|---|---|
| **NO_SHOP** ✅ (#18 prep) | **365** / 7 deals | ✅ 8 subtypes, 13 claim defs | ✅ v3 | ✅ empty M3 deps on pack examples | **Selected for prep** — wave-1 cluster; sealed schema; KEY_DEFINED_TERMS Q02 prerequisite — **too large for immediate Milestone A** |
| KEY_DEFINED_TERMS | 76 / 6 deals | ✅ 5 subtypes | ✅ | partial | **#16 in flight** — blocks definition cross-refs |
| APPRAISAL_DISSENTERS_RIGHTS | 5 / 3 deals | ✅ | ✅ v2 | ✅ | **#17 next** — sparse; clears queue first |
| MATERIAL_CONTRACTS | 116 / 7 deals | ✅ | ✅ | partial | Large; wave-3 cluster; no prep yet |
| INTERIM_OPERATING | 113 / 7 deals | ✅ | ✅ | partial | Large; no prep yet |
| MERGER_STRUCTURE_CLOSING | 103 / 7 deals | ✅ | ✅ | partial | Large; no prep yet |

**Confirmation:** `NO_SHOP` is the correct #18 prep target — sealed role schema, full seven-deal comparator binding, native producer v3 with explicit KEY_DEFINED_TERMS boundary, and wave-1 nested-condition stress aligned with sealed Closing Conditions and Termination. **Milestone A remains deferred** until smaller families clear and the four-slice plan in §4 is accepted for a family ~5× larger than any sealed package.

**Parallel prep:** this document only. Parallel **evidence drafting** for Phase 2 terminal census is OK; **do not** seal packages, extend the lawful fixture, or merge spine until slice A scope is gated on KEY_DEFINED_TERMS (#16) completion.
