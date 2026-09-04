# Proxy / Meeting Work3 parallel prep (2026-08-24)

Research-only handoff for **`PROXY_MEETING`**. Programme position: **N1 family #12** (after Termination, MAE, D&O, General Covenants, Guaranty, Representations, Closing Conditions, No Other Reps / Fraud, Financing Covenants, Termination Fee, Antitrust / Regulatory). Repair-plan cluster: wave 4 *proxy statement, stockholder meeting and subsidiary approval covenants* — same stress class as D&O (one operative unit, roles or linked children), **not** Rep/CC/NOR or fee-economics cluster.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing Proxy / Meeting evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 4)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/PROXY_MEETING.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 4` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/PROXY_MEETING.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/PROXY_MEETING.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/PROXY_MEETING.json` | `BEN_APPROVED_AND_SEALED`, `wave: 4` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/PROXY_MEETING.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/PROXY_MEETING/current.json` | **31** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings (`M5-RULING-ONE-OPERATIVE-LIMB`, `ONE-SEMANTIC-OWNER`, `FAIL-DEPENDENT-PROPOSITION`). Same pattern as Guaranty / Antitrust prep — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (6):**

- `PROXY_MEETING::DOCUMENT_FILING`
- `PROXY_MEETING::MEETING_CALL_OR_HOLD`
- `PROXY_MEETING::RECORD_DATE_OR_BROKER_SEARCH`
- `PROXY_MEETING::RECOMMENDATION_INCLUSION`
- `PROXY_MEETING::ADJOURNMENT`
- `PROXY_MEETING::SUBSIDIARY_APPROVAL`

**Claim definitions in scope (7):**

- `BOARD_RECOMMENDATION_INCLUSION`
- `BROKER_SEARCH_OBLIGATION_PRESENT`
- `MEETING_ADJOURNMENT_REASON`
- `MEETING_CONVENE_OBLIGATION`
- `MEETING_DEADLINE_DAYS`
- `PROXY_FILING_DEADLINE_DAYS`
- `RECORD_DATE_ESTABLISHMENT_PRESENT`

**Provision examples in calibration pack:** 6 complete source units (one per comparator deal) — all tagged `DOCUMENT_FILING` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Section | Comparator claims |
|---|---|---|---:|
| EX-01 | concho | 6.6 | 6 |
| EX-02 | metsera | 6.10 | 4 |
| EX-03 | modiv | 5.4 | 5 |
| EX-04 | redhat | 5.01 | 4 |
| EX-05 | skywater | 5.3 | 4 |
| EX-06 | topbuild | 4.5 | 8 |

All six examples have empty `m3_dependency_ids`.

### Comparator runs

| Deal | Role | Run / source | Governed claims | Notes |
|---|---|---|---:|---|
| **concho** | Comparator | `evidence/canonical-v2/concho-proxy-meeting-20260809-2xk-final/` | **6** | Dense §6.6 proxy/meeting covenant |
| **metsera** | Comparator | `evidence/canonical-v2/metsera-proxy-meeting-20260809-2xk-final/` | **4** | §6.10 filing + meeting mix |
| **modiv** | Comparator | `evidence/canonical-v2/modiv-proxy-meeting-20260809-2xk-final/` | **5** | §5.4 multi-limb |
| **redhat** | Comparator | `evidence/canonical-v2/redhat-proxy-meeting-20260809-2xk-final/` | **4** | §5.01 proxy/meeting |
| **skywater** | Comparator | `evidence/canonical-v2/skywater-proxy-meeting-20260809-2xk-final/` | **4** | §5.3 meeting covenant |
| **topbuild** | Comparator | `evidence/canonical-v2/topbuild-proxy-meeting-20260809-2xk-r4-final/` | **8** | §4.5; r4-final binding; densest set |

**Sum of comparator `resolution_claims`:** **31** across **6 deals** (M5 shadow confirms). Skechers has evidence runs (`skechers-proxy-meeting-20260809-2xk-final/`) but is **not** in the sealed M5 comparator binding set.

**Earlier / diagnostic runs:** `modiv-proxy-meeting-20260806/`, `modiv-proxy-meeting-20260807-replay/`, `concho-proxy-meeting-20260808-r1/`, `topbuild-proxy-meeting-20260808-rung4/`, etc.

### Native producer and corroboration

| Area | Path |
|---|---|
| Producer prompt | `lib/canonical-v2/native-producer/proxy-meeting-producer-prompt.js` — `native-producer-proxy-meeting/v1`, version **2**; `buildProxyMeetingProducerPrompt` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `PROXY_MEETING` |
| Count parse | `lib/canonical-v2/native-producer/proxy-meeting-count-parse.js` |
| Product coverage | `lib/canonical-v2/proxy-meeting-product-coverage.js` |
| Anthropic shaping | `lib/canonical-v2/native-producer/anthropic-provider.js` — `shapeProxyMeetingProposals`, `PROXY_MEETING_ASSERTION_KINDS` |
| Section classifier | `lib/canonical-v2/native-producer/section-family-classifier.js` — `PROXY_MEETING_TITLE_PATTERN` |
| Family compound adapter | `lib/canonical-v2/family-compound-adapter.js` — listed member |

Recorded native responses on disk under each comparator run directory (e.g. `modiv-proxy-meeting-20260809-2xk-final/native-producer-recorded-response-5.4.json`).

### M7 V2 contract references (read-only for Proxy / Meeting agent)

In `lib/canonical-v2/m7-v2-contract.js`:

- `PROXY_MEETING` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path (not on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-proxy-meeting.json`
- Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`

In `lib/canonical-v2/m7-v2-profile-authoring.js`:

- `TRANSITIVE_SOURCE_PATHS` includes calibration pack path
- **No** `prepareProxyMeeting*` exports

**Work3 first-candidate subtype:** `PROXY_MEETING::DOCUMENT_FILING` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

**No** Work1 acceptance cases for Proxy / Meeting in `work1-acceptance-cases.json`.

**No** `m7-v2-repair-contract-proxy-meeting-*-authoring-*` control files exist.

### Tests touching Proxy / Meeting today

| Area | Path |
|---|---|
| Work3 contract first candidate | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` |
| Product coverage / parity | `tests/programme-gates/m3-family-parity-register.spec.js` (proxy surfaces) |
| Producer registry | `tests/canonical-v2-producer-prompt-registry.test.js` |
| Registration orphan paths | `tests/stage-2y-structure-m7-v2-repair-registration.test.js` |
| Execution manifest | `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` |

**Gap:** no `tests/stage-2y-structure-m7-v2-repair-proxy-meeting-work3.test.js`, no `lib/canonical-v2/m7-v2-proxy-meeting-authoring.js`.

---

## 2. Termination pattern files to mirror

Mirror **structure and naming**, not legal content. Prefer **D&O minimal path** (Phase 2 → Phase 4, skip Phase 3 reference frontier unless Phase 2 proves blocking edges).

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

**D&O (direct template — medium dense set, same claim count band):**

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

## 3. Proxy / Meeting-specific scope — meeting covenants and cross-family boundaries

Plan wave-4 cluster: **one independently operative authored unit** with ordered roles or linked children across filing, meeting-call, record-date, recommendation, adjournment and subsidiary-approval limbs.

### Legal stress (vs Termination / Rep cluster)

| Archetype stress | Proxy / Meeting instance |
|---|---|
| Termination / MAE | Rights / definition hierarchy — no dependency |
| Rep / NOR | Accuracy / disclaimer — no dependency |
| Closing Conditions | Tender-offer **minimum conditions** — CC (#7) sealed; Q02 link-only |
| Termination | Vote-failure termination cross-refs — Termination (#1) sealed; Q02 link-only |
| **Proxy / Meeting** | **Proxy filing/mailing deadlines, record date, broker search, meeting convene/adjourn, board recommendation inclusion, Parent/Merger Sub approval** |

**Proxy / Meeting-specific wrinkles:**

1. **Producer boundary exclusions:** prompt v2 explicitly excludes antitrust, CVR, recommendation-change, vote-failure termination, closing-condition and tender-offer structure material from bundled sections; Schedule TO / 14D-9 / offer mechanics route to `MERGER_STRUCTURE_CLOSING`; tender-offer minimum conditions route to `CLOSING_CONDITIONS`.
2. **Parent vs Merger Sub approval split:** producer treats Parent shareholder approval and Parent acting as Merger Sub stockholder as distinct assertion kinds — must not merge in inventory partition.
3. **Record-date / broker-search presence-only:** timing direction and day counts are not governed on those assertion kinds; qualitative timing phrases stay open-world.
4. **Adjournment reason resolution:** reason_kind resolves only on direct quorum/vote/disclosure/legal-requirement quotes; cross-reference-only reasons stay open-world.
5. **Subtype split pending legal review:** all six calibration examples tagged `DOCUMENT_FILING`; comparator claims span filing, meeting-call, record-date, recommendation, adjournment and subsidiary-approval buckets — legal intake needed before inventory disposition (`LEGAL_GROUPING_REVIEW_REQUIRED`).
6. **TopBuild §4.5 density:** eight comparator claims on one section — stress test for multi-limb enumeration and adjournment-cap pairing (producer: never split a respectively-paired cap).

### Phase 3 reference chain — needed?

**Recommendation: minimal path like D&O — skip Phase 3 unless Phase 2 audit finds a blocking reference edge.**

Rationale:

- All six calibration examples have empty `m3_dependency_ids`.
- Primary stress is **subtype classification, deadline/adjournment splits, Parent vs Merger Sub approval separation, role completeness** on complete M2 nodes — not Company Letter discovery or nested CC graphs.
- Add linked-rule authorities only if a deal-specific clause proves an unresolved M3 definition edge that blocks a required role (Q03: fail dependent proposition only).

Defer Work3 Stage A/B and Phase 5 governed disclosure unless a Ben-approved display-only gap is identified.

---

## 4. Profile count estimate

| Signal | Count | Notes |
|---|---:|---|
| M5 comparator runs (sealed binding) | **6** | concho, metsera, modiv, redhat, skywater, topbuild |
| Sum of `resolution_claims` across comparator runs | **31** | M5 shadow confirms |
| Provision examples (complete source units) | **6** | All comparator-backed |
| M5 subtype buckets | **6** | See §1 |
| Per-deal claim spread | 4–8 | metsera/redhat/skywater sparse; topbuild dense |

**Planning estimate for Milestone A blueprint inventory:** **~28–31 profiles** — likely **~31** if Phase 2 materialises one profile per governed comparator claim (partition by `(subtype, deal, section, claim)`), matching D&O density (31 claims / 31 profiles landed). Lower bound **~6** if legal intake collapses to one profile per calibration example only — **not** expected given 31 sealed comparator claims and six subtype buckets. Upper bound if every claim × subtype were independent: 186 — not expected given shared role schema and seven claim-definition focus.

**Working census until Phase 2 partition:** treat **31 comparator governed claims** as the terminal claim set across six deals; use **6 provision examples** as legal calibration anchors for Q01–Q03 disposition and subtype grouping review.

---

## 5. Implementation steps (future dedicated agent)

1. **Reconcile M5 gate** — align calibration pack Q01–Q03 status with sealed `family-role-schemas/PROXY_MEETING.json`; Ben profile-set approval before `PROFILE_SET_V1`.
2. **Phase 2 evidence** — `m7-v2-repair-contract-proxy-meeting-authoring-phase2-authority-v2.json`: terminal registry over six comparator deals; subtype partition aligned to 6 M5 buckets; honour sealed CC/Termination Q02 link-only on tender-offer and vote-failure cross-refs.
3. **Phase 3** — **omit** unless Phase 2 audit finds blocking reference edges.
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; materialise `m7-v2-repair-family-work3-profile-package-proxy-meeting.json`.
5. **Family-local module** — `lib/canonical-v2/m7-v2-proxy-meeting-authoring.js`: `prepareProxyMeetingPhase2FamilyProposal`, `prepareProxyMeetingFamilyProfilePackageReview` (mirror D&O naming).
6. **Tests** — new `tests/stage-2y-structure-m7-v2-repair-proxy-meeting-work3.test.js`; do **not** extend `work3.test.js`.
7. **Inventory / Ben disposition** — flag `LEGAL_GROUPING_REVIEW_REQUIRED` on subtype partition (all examples currently `DOCUMENT_FILING`; filing/meeting/adjournment/approval rows may split).
8. **Phase 5 / Work3 Stage A–B** — defer unless governed-disclosure gap identified.
9. **Proof** — `CI=true npm test` on new file + manifest/contract tests; `npm run build`; update lawful fixture when package bytes exist.

**Regenerate package (when module exists):**

```bash
node scripts/stage-2y-structure-m7-v2-proxy-meeting-family-profile-package.mjs
```

(Script does not exist yet — add when family-local module lands.)

---

## 6. Blockers and merge order

| Order | Family | State | Impact on Proxy / Meeting |
|---|---|---|---|
| 1–11 | Termination … Antitrust / Regulatory | Milestone A complete | Shared Work3 contracts |
| 12 | **Proxy / Meeting** | This prep only | **Can start Milestone A in parallel now** |

Additional blockers:

- Calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` despite sealed control role schema — reconcile before claiming runner eligibility.
- **31** comparator claims but all six pack examples tagged one subtype (`DOCUMENT_FILING`) — legal intake needed on six-bucket subtype partition.
- Producer routes tender-offer / merger-structure material to other families — coordinate Q02 link-only against sealed CC (#7) and unsealed `MERGER_STRUCTURE_CLOSING` when that family lands.
- TopBuild §4.5 eight-claim density may need explicit HOLD rows during inventory disposition.
- `work3.test.js` is Termination-heavy; Proxy / Meeting must use **new** test module.
- Zero `m7-v2-repair-family-work3-profile-package-proxy-meeting.json` on disk.

**Recommended merge sequence:** Proxy / Meeting Phase 2 + Phase 4 evidence + family-local module → inventory disposition → family package on disk → Ben profile-set approval → registration authority → spine merge PR12+ (coordinate with ongoing merge playbook).

---

## 7. Why #12 (alternatives considered)

| Family | Comparator claims | Sealed schema | Native producer | D&O-minimal path | Independence | Why not / why #12 |
|---|---:|---|---|---|---|---|
| **PROXY_MEETING** ✅ | **31** / 6 deals | ✅ 6 subtypes | ✅ v2 | ✅ empty M3 deps on pack examples | ✅ wave-4 meeting cluster | **Selected** — medium inventory (~31 claims, D&O band); mature native producer; full independence from Rep/NOR/fee-economics; no Termination Fee Ben hold |
| TAX_MATTERS | 17 / 4 deals | ✅ 8 subtypes | ✅ | partial | partial | Smaller set; tax/dividends overlap with deal-economics cluster; CC `TAX_OPINION` cross-ref boundary |
| KEY_DEFINED_TERMS | 76 / 7 deals | ✅ 5 subtypes | ✅ | partial | partial | Large; knowledge/willful-breach definitions overlap Representations (#6) and NOR (#8) link-only rows |
| EMPLOYEE_MATTERS | 0 comparator / 27 shadow | ✅ 4 subtypes | ✅ | partial | ✅ | Zero comparator-resolved claims — weaker density signal than Proxy |
| NO_SHOP | 365 / 7 deals | ✅ 8 subtypes | ✅ v3 | partial | ✅ | Too large for parallel prep — queue for later |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 / 6 deals | ✅ | ✅ | partial | partial | Sole-remedy overlap with Termination Fee (#10) — ten rows held pending Ben on owner family |

**Confirmation:** `PROXY_MEETING` is the best #12 on all five criteria — sealed role schema (`BEN_APPROVED_AND_SEALED`, 6 subtypes, 7 claim defs), comparator density (31/6, same band as D&O 31/7), native producer v2 with explicit cross-family routing, D&O-minimal path favoured (empty M3 deps on all pack examples), and **full independence from the Rep/CC/NOR and fee-economics clusters** with no open Ben hold blocking inventory.

**Parallel start:** **Yes** — family-local module + dedicated test file pattern proven on eleven sealed families; no disclaimer, nested-condition or sole-remedy boundary dependency. Coordinate CC/Termination link-only cross-refs against sealed packages already on disk.
