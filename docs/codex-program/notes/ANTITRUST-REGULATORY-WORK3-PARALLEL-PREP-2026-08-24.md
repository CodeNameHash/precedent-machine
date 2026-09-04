# Antitrust / Regulatory Work3 parallel prep (2026-08-24)

Research-only handoff for **`ANTITRUST_REGULATORY`**. Programme position: **N1 family #11** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants, Termination Fee). Repair-plan cluster: wave 3 *regulatory efforts and approvals* — same stress class as Closing Conditions (nested operative limbs, filing/deadline/burden splits), **not** Rep/CC/NOR cluster.

**CC wave-1 gate cleared:** Closing Conditions (#7) is sealed; regulatory-approval closing conditions stay Q02 link-only against this family.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Antitrust / Regulatory evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 3)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/ANTITRUST_REGULATORY.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 3` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/ANTITRUST_REGULATORY.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/ANTITRUST_REGULATORY.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/ANTITRUST_REGULATORY.json` | `BEN_APPROVED_AND_SEALED`, `wave: 3` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/ANTITRUST_REGULATORY.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/ANTITRUST_REGULATORY/current.json` | **70** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / Financing Covenants / Termination Fee prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (12):**

- `ANTITRUST_REGULATORY::EFFORTS`
- `ANTITRUST_REGULATORY::FILING_OBLIGATION`
- `ANTITRUST_REGULATORY::FILING_DEADLINE`
- `ANTITRUST_REGULATORY::BURDEN`
- `ANTITRUST_REGULATORY::LITIGATION`
- `ANTITRUST_REGULATORY::TIMING_AGREEMENT`
- `ANTITRUST_REGULATORY::STRATEGY_CONTROL`
- `ANTITRUST_REGULATORY::CONSULTATION`
- `ANTITRUST_REGULATORY::COOPERATION`
- `ANTITRUST_REGULATORY::INFORMATION_SHARING`
- `ANTITRUST_REGULATORY::NON_IMPEDIMENT`
- `ANTITRUST_REGULATORY::REGULATORY_REQUEST_RESPONSE`

**Claim definitions in scope (14):**

- `HSR_FILING_DEADLINE_DAYS`
- `REGULATORY_BURDEN_COMMITMENT`
- `REGULATORY_CONSULTATION_RIGHT`
- `REGULATORY_COOPERATION_OBLIGATION`
- `REGULATORY_EFFORTS_STANDARD`
- `REGULATORY_FILING_OBLIGATION`
- `REGULATORY_FILING_TIMING_STANDARD`
- `REGULATORY_INFORMATION_SHARING_OBLIGATION`
- `REGULATORY_LITIGATION_OBLIGATION`
- `REGULATORY_NON_IMPEDIMENT_COVENANT`
- `REGULATORY_NOTIFICATION_OBLIGATION`
- `REGULATORY_STRATEGY_CONTROL`
- `REGULATORY_TIMING_AGREEMENT_RESTRICTION`
- `REGULATORY_WITHDRAWAL_REFILING_RESTRICTION`

**Provision examples in calibration pack:** 7 complete source units (one per comparator deal) — all tagged `EFFORTS` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---|---:|
| EX-01 | concho | 6.8 | 11 |
| EX-02 | metsera | 6.03 | 10 |
| EX-03 | modiv | 5.5 | 12 |
| EX-04 | redhat | 5.03 | 10 |
| EX-05 | skechers | 6.2 | 8 |
| EX-06 | skywater | 7.1 | 9 |
| EX-07 | topbuild | 6.2 | 10 |

All seven examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **concho** | Comparator | `evidence/canonical-v2/concho-antitrust-regulatory-20260809-2xk-final/` | **11** | Dense §6.8 regulatory covenant |
| **metsera** | Comparator | `evidence/canonical-v2/metsera-antitrust-regulatory-20260809-2xk-final/` | **10** | §6.03 efforts + filing mix |
| **modiv** | Comparator | `evidence/canonical-v2/modiv-antitrust-regulatory-20260809-2xk-final/` | **12** | Largest set; §5.5 multi-limb |
| **redhat** | Comparator | `evidence/canonical-v2/redhat-antitrust-regulatory-20260809-2xk-final/` | **10** | §5.03 regulatory efforts |
| **skechers** | Comparator | `evidence/canonical-v2/skechers-antitrust-regulatory-20260809-2xk-final/` | **8** | Sparsest comparator set |
| **skywater** | Comparator | `evidence/canonical-v2/skywater-antitrust-regulatory-20260809-2xk-final/` | **9** | §7.1 regulatory covenant |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-antitrust-regulatory-20260809-2xk-r4-final/` | **10** | §6.2; r4-final binding |

**Sum of comparator `resolution_claims`:** **70** across **7 deals** (M5 shadow confirms).

**Earlier / diagnostic runs:** `modiv-antitrust-20260806/`, `modiv-antitrust-20260807-replay/`, `modiv-antitrust-consents-5-5/` (M3 source-repair history), `concho-antitrust-regulatory-20260808-r1/`, etc.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt.js` — `native-producer-antitrust-regulatory/v1`, version **6**; `buildAntitrustRegulatoryProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `ANTITRUST_REGULATORY` |
| Product projection | `lib/canonical-v2/antitrust-product-projection.js`, `lib/canonical-v2/antitrust-v1-surface-disposition.js` |
| M3 certification control | `lib/canonical-v2/native-producer/m3-certification-control.js` |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — antitrust/regulatory heading terms |

Recorded native responses on disk under each comparator run directory (e.g. `modiv-antitrust-regulatory-20260809-2xk-final/native-producer-recorded-response-5.5.json`).

### M7 V2 contract references (read-only for Antitrust / Regulatory agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `ANTITRUST_REGULATORY` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-antitrust-regulatory.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareAntitrustRegulatory*` exports

**Work3 first-candidate subtype:** `ANTITRUST_REGULATORY::EFFORTS` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Antitrust / Regulatory in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-antitrust-regulatory-*-authoring-*` control files exist.

### Tests touching Antitrust / Regulatory today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Product projection / parity | `tests/programme-gates/m3-family-parity-register.spec.js` (antitrust surfaces) |
| Evidence bridge | `tests/canonical-v2-evidence-to-write-set-bridge.test.js` |
| M3 source repair | `tests/canonical-v2-m3-attempt-3-source-repair.test.js` |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Registration orphan paths | `tests/stage-2y-structure-m7-v2-repair-registration.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-antitrust-regulatory-work3.test.js`, no `lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O / Closing Conditions minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**Closing Conditions (direct template — wave-3 regulatory sibling, medium dense set):**

- Phase 2: `m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json`
- Phase 3: **skipped**
- Phase 4: `m7-v2-repair-contract-closing-conditions-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-closing-conditions.json`
- Dedicated module: `lib/canonical-v2/m7-v2-closing-conditions-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-closing-conditions-work3.test.js`

**Shared Work3 spine (reuse):**

- `m7-v2-repair-contract-work3-entry-correction-authority.json`
- `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Scripts: `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `…-verify-candidate.mjs`, `…-register-candidate.mjs`, `…-work2-validate.mjs`

---

## 3. Antitrust / Regulatory-specific scope — regulatory efforts and CC boundary

Plan wave-3 cluster (with Closing Conditions regulatory-approval slice): **one independently operative authored unit** with ordered roles or linked children.

### Legal stress (vs Termination / MAE / Rep cluster)

| Archetype stress | Antitrust / Regulatory instance |
|---|---|
| Termination / MAE | Rights / definition hierarchy — no dependency |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| Closing Conditions | Regulatory **approval conditions** — CC (#7) sealed; covenant-side efforts/filings/burden owned here; CC rows link-only (Q02) |
| **Antitrust / Regulatory** | **Efforts standard, filing obligation/deadline, burden, litigation, timing agreements, strategy control, cooperation/information/notification, non-impediment** |

**Antitrust / Regulatory-specific wrinkles:**

1. **Dual native-producer surfaces:** `regulatory_efforts_assertions` (governed claims) vs `open_world_candidates` (residual unmapped text — prompt v6 explicitly shapes element schema to avoid empty-array bias).
2. **HSR vs other regimes:** producer and claim defs require HSR as a separate fact; never aggregate with other filing regimes.
3. **Burden vs efforts split:** `REGULATORY_BURDEN_COMMITMENT` (express any-and-all / uncapped remedy language) is distinct from `REGULATORY_EFFORTS_STANDARD` — programme decision console documents the disambiguation rule.
4. **Subtype split pending legal review:** all seven calibration examples tagged `EFFORTS`; comparator claims span efforts, filing, burden, litigation, timing, strategy, cooperation, information, notification, and non-impediment buckets — legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED`).
5. **Modiv §5.5 density:** twelve comparator claims on one section — stress test for subtype partition and multi-limb enumeration.
6. **CC Q02 boundary:** sealed Closing Conditions profiles own regulatory-approval **conditions**; this family owns regulatory **covenants** (efforts, filings, burden). Cross-reference only, do not duplicate condition semantics.

### Phase 3 reference chain — needed?

**Recommendation: minimal path like Closing Conditions — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All seven calibration examples have empty `m3_dependency_ids`.
- Primary stress is **subtype classification, filing-regime separation, burden vs efforts, role completeness** on complete M2 nodes — not Company Letter discovery or CC nested graphs.
- Add linked-rule authorities only if a deal-specific clause proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **7** | concho, metsera, modiv, redhat, skechers, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **70** | M5 shadow confirms |
| Provision examples (complete source units) | **7** | All comparator-backed |
| M5 subtype buckets | **12** | See §1 |
| Per-deal claim spread | 8–12 | skechers sparse; modiv dense |

**Planning estimate for Milestone A blueprint inventory:** **~55–75 profiles** — likely **~65–70** if Phase 2 materialises one profile per governed comparator claim (partition by `(subtype, deal, section, claim)`), comparable to Representations (70) at similar claim density. Lower bound **~7** if legal intake collapses to one profile per calibration example only — **not** expected given 70 sealed comparator claims and twelve subtype buckets. Upper bound if every claim × subtype were independent: 840 — not expected given shared role schema and fourteen claim-definition focus.

**Working census until Phase 2 partition:** treat **70 comparator governed claims** as the terminal claim set across seven deals; use **7 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/ANTITRUST_REGULATORY.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-antitrust-regulatory-authoring-phase2-authority-v2.json`: terminal registry over seven comparator deals; subtype partition aligned to 12 M5 buckets; honour sealed CC Q02 link-only on regulatory-approval condition cross-refs.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-antitrust-regulatory.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js`: `prepareAntitrustRegulatoryPhase2FamilyProposal`, `prepareAntitrustRegulatoryFamilyProfilePackageReview` (mirror Closing Conditions naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-antitrust-regulatory-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition (all examples currently `EFFORTS`; filing/burden/litigation/timing rows may split).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-antitrust-regulatory-family-profile-package.mjs
```

(Script does not exist yet — add when family-local module lands.)

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Antitrust / Regulatory |
|---|---|---|---|
| 1–5 | Termination, MAE, D&O, GC, Guaranty | Milestone A complete | Shared Work3 contracts |
| 7 | **Closing Conditions** | Milestone A sealed | Q02 boundary: approval conditions vs regulatory covenants — link-only |
| 6–8 | Representations, NOR | In flight / queued | **No dependency** — independent cluster |
| 9–10 | Financing Covenants, Termination Fee | Milestone A complete | No blocking dependency |
| 11 | **Antitrust / Regulatory** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **70** comparator claims but all seven pack examples tagged one subtype (`EFFORTS`) — legal intake needed on twelve-bucket subtype partition.
- Sealed CC profiles must stay link-only for regulatory-approval condition cross-refs; do not duplicate condition semantics in Antitrust / Regulatory profiles.
- Modiv §5.5 twelve-claim density may need explicit HOLD rows during inventory disposition.
- `work3.test.js` is Termination-heavy; Antitrust / Regulatory must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-antitrust-regulatory.json` on disk.

**Recommended merge sequence:** Antitrust / Regulatory Phase 2 + Phase 4 evidence + family-local module (parallel with NOR #8) → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR10+ (coordinate with ongoing merge playbook).

---

## 7. Why #11 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #11 |
|---|---:|---|---|---|---|---|
| **ANTITRUST_REGULATORY** ✅ | **70** / 7 deals | ✅ 12 subtypes | ✅ v6 | ✅ empty M3 deps on pack examples | ✅ wave-3 regulatory cluster | **Selected** — medium inventory (~70 claims); CC Q02 boundary sealed; mature native producer; full independence from Rep/NOR |
| NO_SHOP | 365 / 7 deals | ✅ | ✅ v3 | partial | ✅ | Too large while Rep cluster and NOR (#8) in flight |
| PROXY_MEETING | 31 / 6 deals | ✅ | ✅ | partial | ✅ | Viable medium alternative; weaker wave-3 regulatory stress signal than Antitrust |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 / 6 deals | ✅ | ✅ | partial | partial | Sole-remedy overlap with Termination Fee (#10) — ten rows held pending Ben on owner family |
| EMPLOYEE_MATTERS | 0 comparator / 27 shadow | ✅ | ✅ | partial | ✅ | Zero comparator-resolved claims — weaker density signal |
| TAX_MATTERS | 17 / 4 deals | ✅ | ✅ | partial | partial | Smaller set; tax/dividends overlap with deal-economics cluster |

**Confirmation:** `ANTITRUST_REGULATORY` is the best #11 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 12 subtypes, 14 claim defs), comparator density (70/7, between D&O 31 and Representations 70), native producer v6 with full regulatory-efforts stream, D&O-minimal path favoured (empty M3 deps on all pack examples), and **full independence from the Rep/CC/NOR cluster** with CC wave-1 now sealed and regulatory-approval Q02 boundary already on disk.

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on nine sealed families; no bring-down, disclaimer, or nested-condition boundary dependency on Representations or NOR. Coordinate CC link-only cross-refs against sealed Closing Conditions package (already Milestone A).
