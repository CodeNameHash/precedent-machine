# Guaranty Work3 parallel prep (2026-08-24)

Research-only handoff for **`GUARANTY_FINANCING_PARTY`**. Programme position: **N1 family #5** (after Termination, MAE, D&O, General Covenants). Repair-plan cluster: wave 3 *parties, scope, materiality and linked duties* (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` lines 995–998) — same stress class as D&O (one operative unit, roles or linked children), **not** one of the four named archetype pilots (Termination / MAE / D&O / General Covenants).

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Guaranty evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/GUARANTY_FINANCING_PARTY.json` | `PROPOSED_AWAITING_BEN_APPROVAL` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/GUARANTY_FINANCING_PARTY.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/GUARANTY_FINANCING_PARTY.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/GUARANTY_FINANCING_PARTY.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/GUARANTY_FINANCING_PARTY.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/GUARANTY_FINANCING_PARTY/current.json` | 1 comparator-resolved claim |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as MAE prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (4):**

- `GUARANTY_FINANCING_PARTY::PERFORMANCE_GUARANTY`
- `GUARANTY_FINANCING_PARTY::LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP`
- `GUARANTY_FINANCING_PARTY::GUARANTY_NO_DEFAULT_REP`
- `GUARANTY_FINANCING_PARTY::FINANCING_SOURCE_PROTECTION`

**Claim definition in scope:** `LIMITED_GUARANTY_DELIVERED` only (native `GUARANTY_CLAIMS` also defines `LIMITED_GUARANTY_IN_EFFECT` in `financing-guaranty-product-projection.js` — not in sealed M5 scope).

**Provision examples in calibration pack:** 5 complete source units — Skechers §4.13, §9.15, §9.16 (comparator-backed) + Red Hat §8.06, §8.07 (supplemental, non-comparator).

### Comparator runs and supplemental deals

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **skechers** | **Comparator** (only sealed binding) | `evidence/canonical-v2/skechers-guaranty-financing-party-20260809-2xk-final/` | **1** (`LIMITED_GUARANTY_DELIVERED`, §4.13) | Pins `4.13`, `9.15`; first corpus deal with real sponsor guaranty (`overnight-2026-08-08.md`) |
| **redhat** | Supplemental (`GUARANTY_FINANCING_PARTY-SUP-REDHAT`) | M2 nodes §8.06, §8.07 via shadow agreement index | 0 in comparator metrics | Genuine zero on IBM self-funded deal for extraction runs; supplemental examples for calibration only |
| **topbuild** | Evidence run (not M5 comparator) | `topbuild-guaranty-financing-party-20260809-2xk-r4-final/` | 0 governed; open-world on §7.16 | Step 2F BREAK 2: financing-source waiver correctly routed, v2 producer excludes from `guaranty_assertions` |
| **modiv** | Evidence run (wrong pin / correct zero) | `modiv-guaranty-financing-party-20260809-2xk-r4/`, `modiv-guaranty-20260808-v2/` | 0 | §5.11 is tax/termination text, not guaranty — standing correct-zero case (`step-2f-breaks-2-3.md`) |
| concho, metsera, skywater, abbvie-landos, rocket-redfin, … | M5 shadow / onboarding | `shadow/m7-generalisation/*/m5/families/18-GUARANTY_FINANCING_PARTY.json` | 0 | Genuine absence or unmapped — see per-deal onboarding notes |

**Earlier / diagnostic runs:** `skechers-guaranty-financing-party-20260808-rung1/`, `topbuild-guaranty-financing-party-20260808-rung4/`, `modiv-guaranty-20260806/`, `modiv-guaranty-20260807-replay/`.

**Corpus open-world backlog (not Work3 profiles):** `analysis-policy.json` reports **11** open-world rows tagged `GUARANTY_FINANCING_PARTY` across the full M4 resolution set.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/guaranty-producer-prompt.js` — `native-producer-guaranty/v1`, version **2**; `buildGuarantyProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `GUARANTY_FINANCING_PARTY` |
| Corroboration | `lib/canonical-v2/native-producer/guaranty-corroboration.js` — `PERFORMANCE_GUARANTY`, `GUARANTY_DELIVERED`, `GUARANTY_IN_EFFECT`; cross-kind ambiguity guard (`AMBIGUOUS_GUARANTY_OBJECT`) |
| Combined financing prompt | `lib/canonical-v2/native-producer/financing-guaranty-producer-prompt.js` (legacy combined path) |
| Product projection | `lib/canonical-v2/financing-guaranty-product-projection.js` — `projectFinancingGuarantyClaims`, `GUARANTY_CLAIMS`, `FINANCING_CLAIMS` |
| Partyless structural kind | `tests/canonical-v2-step-2d1-defects-3-4.test.js` — always partyless; projects on structural kind |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |

Recorded native responses on disk: e.g. `skechers-guaranty-financing-party-20260809-2xk-final/native-producer-recorded-response-4.13.json`, `topbuild-…/native-producer-recorded-response-7.16.json`, `modiv-guaranty-20260808-v2/native-producer-recorded-response-5.11.json`.

### M7 V2 contract references (read-only for Guaranty agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `GUARANTY_FINANCING_PARTY` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json` — scoped in `m7-v2-repair-contract-work3-entry-correction-authority.json` `exact_work3_paths`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareGuaranty*` exports (Termination-only spine today)

**Work3 first-candidate subtype:** `GUARANTY_FINANCING_PARTY::PERFORMANCE_GUARANTY` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Guaranty in `work1-acceptance-cases.json` (contrast D&O item 42, GC item 44).

**No** `m7-v2-repair-contract-guaranty-*-authoring-*` control files exist.

### Tests touching Guaranty today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Native / resolution | `tests/canonical-v2-guaranty.test.js`, `tests/canonical-v2-financing-guaranty-resolution.test.js`, `tests/canonical-v2-financing-guaranty-follow-on.test.js` |
| Product projection | `tests/canonical-v2-financing-guaranty-product-projection.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Step 2D1 partyless / structural | `tests/canonical-v2-step-2d1-defects-3-4.test.js` |
| Fixture cards | `tests/fixtures/canonical-v2/guaranty-fixtures/corpus-cards.json` (31 cards) |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js`, no `lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js`.

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

## 3. Guaranty-specific scope — linked duties and sparse corpus

Plan wave-3 cluster (with D&O): **one independently operative authored unit** with ordered roles or linked children (`proposition_unit_rule` in sealed schema).

### Legal stress (vs Termination / MAE)

| Archetype stress | Guaranty instance |
|---|---|
| Termination | Nested conditions, external references, governed disclosure notes |
| MAE | Hierarchy, carve-out enum breadth, partial-exception operators |
| **Guaranty / D&O** | **One source unit → roles or linked children; ownership boundary with FINANCING_COVENANTS** |

**Guaranty-specific wrinkles:**

1. **Dual surface in native producer:** `guaranty_assertions` (positive guaranty facts only) vs `financing_mechanics` / `FINANCING_PARTY_PROTECTION` (non-recourse and financing-source waivers **without** a guaranty). Step 2F BREAK 2 on TopBuild §7.16 is the canonical false-zero fix (prompt v2).
2. **Sparse comparator set:** only **one** sealed comparator run (Skechers) with **one** governed claim; most deals correctly return zero. Milestone A inventory will be small — not a defect.
3. **Subtype split:** performance guaranty vs delivery/status rep vs no-default rep vs financing-source protection — calibration examples tag all five sources as `PERFORMANCE_GUARANTY` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`).
4. **Partyless family:** product projection uses structural kind; no party slice (`step-2d1-defects-3-4.test.js`).
5. **Cross-family routing:** `FINANCING_COVENANTS` vs `GUARANTY_FINANCING_PARTY` title/manifest rules (`step-2e-topbuild-mapping.md`); overlapping content is link-only per Q02 ruling.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Termination Phase 3 unless Phase 2 proves a specific unresolved reference edge.**

Rationale:

- No Work1 sealed additive item (no Metsera-style shared-span contract).
- Calibration supplemental Red Hat units have empty `m3_dependency_ids` on examples.
- Stress is **subtype classification and role completeness** on complete M2 nodes, not temporal graphs or Company Letter discovery.
- Add **linked-rule / shared-source** authorities only if a deal-specific guaranty clause proves an unresolved M3 definition or reference edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified (no B9E analogue on disk).

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **1** | Skechers only |
| Sum of `resolution_claims` across comparator runs | **1** | `LIMITED_GUARANTY_DELIVERED` |
| Provision examples (complete source units) | **5** | 3 Skechers + 2 Red Hat supplemental |
| M5 subtype buckets | **4** | See §1 |
| Open-world rows (full corpus, not profiles) | **11** | `analysis-policy.json` |
| Fixture corpus cards | **31** | Design-spec acceptance set; not 1:1 Work3 profiles |

**Planning estimate for Milestone A blueprint inventory:** **~5–11 profiles** — likely **~5–8** if Phase 2 materialises one profile per provision example (partition by `(subtype, deal, section)`), **not** Termination’s 45 or D&O’s 31. Upper bound if every example × subtype were independent: 20 — not expected given sparse governed claims and shared subtype tagging.

**Working census until Phase 2 partition:** treat **5 provision examples** as the terminal source set (1 comparator + 2 supplemental deals), plus honest **zero/absence** rows for unfinanced comparators if the inventory packet requires explicit disposition.

Corpus cross-check: Skechers resolution has **1** governed + **10** `OPEN_WORLD_PROPOSITION` rows on §4.13 / §9.15 — open-world stays review lane, not Work3 profile keys.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/GUARANTY_FINANCING_PARTY.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json`: terminal registry over Skechers comparator + Red Hat supplemental + optional TopBuild/Modiv absence attestations; subtype partition aligned to 4 M5 buckets.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges; if needed, add minimal linked-rule authorities only (D&O pattern), not Termination temporal/letter frontier.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js`: `prepareGuarantyFinancingPartyPhase2FamilyProposal`, `prepareGuarantyFinancingPartyFamilyProfilePackageReview` (mirror D&O naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-guaranty-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — capture Q01–Q03 rulings in family run plan note if not already family-specific; flag `LEGAL_GROUPING_REVIEW_REQUIRED` on Red Hat §8.06/8.07 vs Skechers §9.15 financing-source protection.
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Guaranty |
|---|---|---|---|
| 1 | **Termination** | Milestone A complete; core integration / inventory in flight | Defines shared Work3 contracts |
| 2 | **MAE** | Milestone A complete | Family-local module pattern proven |
| 3 | **D&O** | Milestone A complete | **Direct template** for minimal Phase 2→4 path |
| 4 | **General Covenants** | Prep done; implementation next per N1 ladder | Spine merge coordination |
| 5 | **Guaranty** | This prep only | Parallel evidence drafting OK; **no spine merge** until GC slice strategy clear |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- Only **one** comparator governed claim — legal intake may need Ben confirmation on subtype grouping for financing-source protection vs performance guaranty (especially TopBuild §7.16 and Red Hat supplemental).
- Modiv §5.11 pin is a known mapping defect for extraction history; do not treat as positive guaranty evidence.
- `work3.test.js` is Termination-heavy; Guaranty must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json` on disk.

**Recommended merge sequence:** GC Milestone A (or coordinated spine slice) → Guaranty Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority.
