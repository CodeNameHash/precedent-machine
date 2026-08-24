# General Covenants — Work3 parallel prep (2026-08-24)

Research-only. **Work3 archetype #4** per `docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` (lines 995–1011): *topic classification and access-covenant scope*. Do **not** edit shared spine files in this prep pass.

---

## 1. Existing GENERAL_COVENANTS evidence, calibration, authorities, tests

### Production extraction evidence (7 deals, committed runs)

M5 calibration pack binds comparator runs (all `20260809-2xk-final` except TopBuild `…-r3-final`):

| Deal | Run root |
|---|---|
| concho | `evidence/canonical-v2/concho-general-covenants-20260809-2xk-final/` |
| metsera | `evidence/canonical-v2/metsera-general-covenants-20260809-2xk-final/` |
| modiv | `evidence/canonical-v2/modiv-general-covenants-20260809-2xk-final/` |
| redhat | `evidence/canonical-v2/redhat-general-covenants-20260809-2xk-final/` |
| skechers | `evidence/canonical-v2/skechers-general-covenants-20260809-2xk-final/` |
| skywater | `evidence/canonical-v2/skywater-general-covenants-20260809-2xk-final/` |
| topbuild | `evidence/canonical-v2/topbuild-general-covenants-20260809-2xk-r3-final/` |

Each run carries `resolution.json`, `adapter-result.json`, `validation.json`, `run-manifest.json`. Earlier `-r1`/`-replay` trees exist for Modiv/Concho history.

Stage 2Y-F lexical adjudication (`evidence/canonical-v2/stage-2y-f-lexical-classification.html`) lists many `GENERAL_COVENANTS` roots still `AMBIGUOUS_NEEDS_REVIEW` (e.g. concho §6.7 `COV-ACCESS`, metsera §6.02 `COV-ACCESS`, modiv §5.7 `COV-PUBLICITY`).

### M5 calibration and role schema (Ben approval pending)

- **Calibration pack:** `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/GENERAL_COVENANTS.json` — `status: PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 1`, seven `calibration_examples` (all `proposed_subtype: ACCESS` in pack examples; pack also lists 11 candidate subtype profile ids).
- **Proposed role schema:** `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/GENERAL_COVENANTS.json` — `runner_eligible: false`, `complete_transition_authorised: false`.
- **Open legal questions (all `OPEN_REQUIRES_BEN_RULING`):** `GENERAL_COVENANTS-Q01` (one compound proposition vs linked children), `Q02` (duplicate vs one owner + links), `Q03` (M3 edge may not fill required role).
- **Preparation stop:** `BEN_FAMILY_ROLE_APPROVAL_REQUIRED` in pack diagnostics.

### Work1 / Work3 contract hooks

- **First candidate subtype (Work3 contract):** `GENERAL_COVENANTS::ACCESS` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).
- **Work1 acceptance:** `tests/fixtures/canonical-v2/m7-v2-repair/work1-acceptance-cases.json` — `item-44-separate-access-dimensions` (additive-three §5.1, six access scope fields, `WIDER_MATERIAL_SCOPE_UNMODELLED`, review-only); two-effect provenance with `TERMINATION`.
- **Work3 package path (scoped, not yet on disk):** `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-general-covenants.json` — listed in `m7-v2-repair-contract-work3-entry-correction-authority.json` `exact_work3_paths`; synthetic lawful record lives in `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`.
- **Transitive authoring source:** `lib/canonical-v2/m7-v2-profile-authoring.js` includes calibration pack path in `TRANSITIVE_SOURCE_PATHS`.
- **Package path helper:** `lib/canonical-v2/m7-v2-contract.js` → `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY.get('GENERAL_COVENANTS')`.

### Native pipeline / corroboration (pre–M7 V2 profile)

| Area | Path |
|---|---|
| Codebook + producer | `lib/canonical-v2/native-producer/general-covenants-producer-prompt.js` |
| Registry + patterns | `lib/vocab/resolution/general-covenant-registry.js`, `lib/canonical-v2/native-producer/general-covenant-corroboration.js` |
| Resolver routing | `lib/canonical-v2/native-producer/candidate-resolution.js` (`generalCovenantGroundingFailure`, `generalCovenantDoubleFireCode`) |
| Owner map | `lib/canonical-v2/p0-product-surface-routing.js` (`GENERAL_COVENANT_DEDICATED_OWNERS`, `GENERAL_COVENANT_FOLLOW_ON_OWNERS`; `COV-ACCESS` → `ACCESS_INFORMATION_COVENANTS`) |
| Source dispositions | `lib/canonical-v2/general-covenants-source-disposition.js` (18 codes grounded) |
| Product projection | `lib/canonical-v2/general-covenants-product-projection.js` |
| Dark bridge | `lib/canonical-v2/general-covenants-dark-bridge.js` |
| Phase1 inventory | `lib/canonical-v2/phase1-authority-boundary-inventory.js` (dark bridge listed) |
| Review UI | `components/review/table-configs/general-covenants.config.js` |

### Tests (family-specific, not Work3 authoring yet)

- `tests/canonical-v2-general-covenants-family-parity.test.js`
- `tests/canonical-v2-general-covenant-corroboration.test.js`
- `tests/canonical-v2-general-covenants-source-pack.test.js`
- `tests/canonical-v2-general-covenants-party-slice.test.js`
- `tests/canonical-v2-general-covenants-dark-bridge.test.js`
- Work3 contract gates touching GC: `tests/stage-2y-structure-m7-v2-repair-contract.test.js` (dimension-contract / Ben approval scenarios), `tests/stage-2y-structure-m7-v2-repair-work3.test.js`, `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js`

**Gap:** no `prepareGeneralCovenants*` exports in `m7-v2-profile-authoring.js` (Termination-only today).

---

## 2. Termination template to mirror

Termination is the only archetype with a full Work3 authoring pipeline. Mirror **phase shape and authority binding discipline**, not legal content.

### Authority chain (evidence/control)

- Phase2 proposal: `…/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json`
- Phase3 reference stack (11 authorities): `…-phase3-reference-review-authority.json`, `…-reference-target-evidence-authority.json`, `…-reference-source-normaliser-authority.json`, `…-reference-edge-value-authority.json`, `…-linked-rule-reference-value-authority.json`, `…-raw-m2-reference-owner-value-authority.json`, `…-source-occurrence-self-reference-value-authority.json`, `…-agreement-date-source-pair-reference-value-authority.json`, `…-company-stockholders-meeting-event-reference-value-authority.json`, `…-red-hat-company-letter-section-6-01-c-source-discovery-frontier-authority.json`, `…-reference-value-materialisation-authority.json`
- Phase4 package review: `…-phase4-family-profile-package-review-authority.json`
- Phase5 governed disclosure: `…-phase5-governed-disclosure-note-authority.json`, ruling + completion receipts under same prefix
- Work3 Stage A/B: `…-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`; handoff in repo root `STAGE_B_HANDOFF.md`

### Spine facades (`lib/canonical-v2/m7-v2-profile-authoring.js`)

Ordered call chain: `prepareTerminationFamilyProposal` → Phase3 `prepareTerminationReference*` candidates (nested predecessors) → `prepareTerminationReferenceValueMaterialisationCandidate` → `prepareTerminationFamilyProfilePackageReview` → `prepareTerminationFamilyProfilePackageResolution` → `prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview` → `prepareTerminationWork3StageBBlueprintProposal` → (later) `prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview`.

### Test template

- Fixture builders and negative vectors: `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (Termination Phase2–Phase5 + Work3 Stage A sections from ~line 1344 and ~18519).
- Contract-level dimension/approval patterns: `tests/stage-2y-structure-m7-v2-repair-contract.test.js` (`BEN_APPROVAL:GENERAL_COVENANTS:PROFILE_SET_V1` test mirrors Termination approval binding).

---

## 3. Scope (topic classification, access-covenant scope)

### Topic classification

- **Producer routing:** exact `GENERAL_COVENANT` codes only; dedicated-family codes (`COV-DO`, `COV-EMPLOYEE`, …) must not appear as GC output (`general-covenants-producer-prompt.js`).
- **Corroboration vs choice:** pattern match (`general-covenant-corroboration.js`) ≠ code selection; overlapping codes (`COV-NOTIFY`/`COV-LITNOTIFY`, `COV-PUBLICITY`/`COV-SECREPORT`) resolved by `generalCovenantDoubleFireCode` in `candidate-resolution.js` and precedence in `general-covenant-registry.js`.
- **M5 subtype inventory (11):** `ACCESS`, `LITIGATION_NOTIFICATION`, `GENERAL_NOTIFICATION`, `SECTION_16`, `DELISTING`, `TAKEOVER_LAW`, `MERGER_SUB_OBLIGATION`, `PUBLICITY`, `RESIGNATION`, `CVR`, `LISTING` — calibration pack `proposed_output_policy.candidate_subtype_profile_ids`.
- **Undiagnosed open-world:** `docs/codex-program/notes/stage-2y/undiagnosed.md` — `GENERAL_COVENANT_CODE_UNCORROBORATED` (24), `PARTY_UNRESOLVED`, definition-reference failures.

### Access-covenant scope (archetype focus)

- **Lead subtype:** `GENERAL_COVENANTS::ACCESS` / native `COV-ACCESS`.
- **Work1 item 44 (additive-three):** six separate material dimensions — `ACCESS_OBJECTS`, `ACCESS_PURPOSE`, `NOTICE_REQUIREMENT`, `BUSINESS_HOURS_TIMING`, `REASONABLENESS`, `NON_INTERFERENCE`; `WIDER_MATERIAL_SCOPE_UNMODELLED`; review-only until profile contract seals narrower scope.
- **M5 ACCESS role schema (proposed):** five generic roles per subtype (`LEGAL_ACTOR_OR_SUBJECT`, `LEGAL_OPERATION`, `OPERATIVE_OBJECT`, `TEMPORAL_OR_TRIGGER_SCOPE`, `QUALIFICATIONS`) — maps to V2 field design, not yet Ben-approved.
- **Calibration examples:** seven access sections (concho §6.7, metsera §6.02, modiv/redhat/skechers/skywater/topbuild access clauses) in calibration pack.

---

## 4. Future agent step list

1. **Close M5 legal gate:** Ben rulings for Q01–Q03; seal approved role schema; move calibration pack off `PROPOSED_AWAITING_BEN_APPROVAL`.
2. **Draft GC Phase2 authority** (family-local JSON under `evidence/…/control/`, naming parallel to Termination): governed source set = seven calibration runs + Work1 item 44 source closure; proposal contract for subtype inventory and ACCESS-first profile tuples.
3. **Author family-specific module(s)** outside shared spine (e.g. `lib/canonical-v2/m7-v2-general-covenants-authoring.js`) implementing Phase2 proposal + classification-bucket coverage — mirror Termination validator patterns without patching spine yet.
4. **Phase3 (if references needed):** only where GC profiles require resolved definition/reference edges (Q03); likely smaller than Termination — scope from item 44 and `DEPENDENT_STANDARD_NOT_PROVED` work1 case.
5. **Phase4 family profile package:** materialise `m7-v2-repair-family-work3-profile-package-general-covenants.json` on disk; subtype tree with `ACCESS` terminal path; match fixtures (positive / near-negative / wrong-subtype); dimension evidence for access scope fields.
6. **Phase5 / Work3 integration:** governed disclosure only if GC needs display-only legal metadata (Termination B9E pattern is not automatic).
7. **Tests first in family branch:** new `tests/stage-2y-structure-m7-v2-repair-work3-general-covenants.test.js` (or tagged subset) cloning Termination negative-vector structure; keep `tests/helpers/m7-v2-work3-family-package-fixture.js` binding updated when package bytes exist.
8. **Spine merge (single serial step):** register `prepareGeneralCovenants*` facades in `m7-v2-profile-authoring.js`, exports in `m7-v2-contract.js` if needed, Work3 test imports — **after** Termination Stage B spine quiesces (see below).
9. **Proof:** `CI=true npm test` targeting new GC tests + existing Work3 manifest/contract tests; update lawful fixture digest if package set changes.

---

## 5. Blockers / merge order

| Blocker | Detail |
|---|---|
| Ben M5 approval | Pack + role schema frozen at `PROPOSED`; `runner_eligible: false`. |
| No GC authoring facades | Only Termination `prepare*` functions exist in profile authoring. |
| Package file absent | GC Work3 package path scoped in authority but **not** in working tree; only fixture snapshot. |
| Termination Stage B in flight | `STAGE_B_HANDOFF.md` — producer v12 / delta renderer / row3 oracle pending; targets same spine files. |
| Shared spine dirty | Parent worktree already modifies `m7-v2-profile-authoring.js`, `m7-v2-contract.js`, `m7-v2-deterministic-generator.js`, Work3 scripts/tests — coordinate merges. |
| `WORK3_BEN_PROFILE_APPROVAL_PENDING` | `lib/canonical-v2/m7-v2-contract.js` issue constant — GC profiles cannot emit normal rows without sealed V2 approval. |

### Merge order

1. **Termination Work3 Stage B** completes spine changes (`m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`) per `STAGE_B_HANDOFF.md`.
2. **Parallel prep (this track):** family-local authorities + branch module + branch tests + on-disk profile package — no spine edits.
3. **GC spine integration** as a dedicated merge after (1) and after Ben seals M5 GC contract.
4. **Work4+** remains blocked on ordered Work1–Work3 receipts (`scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`).

### Do not edit (shared spine — parallel agents)

- `lib/canonical-v2/m7-v2-profile-authoring.js`
- `lib/canonical-v2/m7-v2-contract.js`
- `lib/canonical-v2/m7-v2-deterministic-generator.js`
- `scripts/stage-2y-structure-m7-v2-repair-*.mjs`
- `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (Termination Stage B owner until handoff closes)

---

*Prepared from repository read-only scan, 2026-08-24.*
