# MAE Definition — Work3 parallel prep (2026-08-24)

Research-only. **Work3 archetype #2** per `docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` (lines 1006–1011): *hierarchy and carve-backs*. Termination is the live template. Do **not** edit shared spine files in this prep pass.

---

## 1. Existing MAE_DEFINITION code and evidence

### M5 role schema and execution authority (sealed control copy)

| Artefact | Path |
|---|---|
| Approved role schema | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/MAE_DEFINITION.json` — `approval_state: BEN_APPROVED_AND_SEALED`, `family_role_schema_id: eba03e57…` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/MAE_DEFINITION.json` — `authority_state: ACTIVE_FOR_ONE_APPROVED_FAMILY_SHADOW_COMPARISON` |
| Proposed role schema (source proposal binding) | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/MAE_DEFINITION.json` — still `status: PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| Claim scope (both) | `MAE_CARVEOUT`, `MAE_DEFINITION_PRONG`, `MAE_DISPROPORTIONALITY_CARVEBACK` |
| Programme rulings bound | `MAE_DEFINITION-Q01` → `M5-RULING-ONE-OPERATIVE-LIMB`; Q02 → `ONE-SEMANTIC-OWNER`; Q03 → `FAIL-DEPENDENT-PROPOSITION` |

Five M5 subtype profiles: `DEFINITION_INSTANCE`, `DEFINITION_PRONG`, `EXCLUSION`, `DISPROPORTIONALITY_CARVEBACK`, `UNDERLYING_CAUSE_RESTORATION`.

### Calibration pack (five comparator runs)

`evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/MAE_DEFINITION.json` — `wave: 2`, pack `status: PROPOSED_AWAITING_BEN_APPROVAL`.

| Run | Resolution claims |
|---|---|
| `metsera-mae-definition-20260809-2xk-final` | 15 |
| `redhat-mae-definition-20260809-2xk-final` | 15 |
| `skechers-mae-definition-20260809-2xk-final` | 12 |
| `skywater-mae-definition-20260809-2xk-final` | 28 |
| `topbuild-mae-definition-20260809-2xk-r4-final` | 38 |

**Total governed M4 claims across calibration runs: 108.** Each run root under `evidence/canonical-v2/<deal>-mae-definition-…/` (`resolution.json`, `adapter-result.json`, `validation.json`).

### Work1 / Work3 contract hooks

- **First Work3 candidate subtype:** `MAE_DEFINITION::DEFINITION_INSTANCE` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).
- **Work1 partial-exception topology:** `tests/fixtures/canonical-v2/m7-v2-repair/work1-acceptance-cases.json` — `item-33`…`item-36`, `item-47` (`family_key: MAE_DEFINITION`, `EXCEPTION_TO` / `TO_EXTENT` / `CONSEQUENCE_MODIFIER` signatures).
- **Work3 package path (scoped, not on disk):** `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-mae-definition.json` — listed in `m7-v2-repair-contract-work3-entry-correction-authority.json` `exact_work3_paths[50]`.
- **Lawful fixture snapshot:** `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`.
- **Transitive authoring source:** `lib/canonical-v2/m7-v2-profile-authoring.js` → `TRANSITIVE_SOURCE_PATHS` includes calibration pack path.
- **Package path helper:** `lib/canonical-v2/m7-v2-contract.js` → `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY.get('MAE_DEFINITION')`.

### Native pipeline / corroboration (pre–Work3 profile authoring)

| Area | Path / exports |
|---|---|
| Claim definitions | `lib/canonical-v2/contract-bundle.js` — `MAE_CARVEOUT_CLAIM_DEFINITION_V1`, `MAE_DEFINITION_PRONG_CLAIM_DEFINITION_V1`, `MAE_DISPROPORTIONALITY_CARVEBACK_CLAIM_DEFINITION_V1`; `MAE_CARVEOUT_CODES_V2` (25 codes) |
| Producer | `lib/canonical-v2/native-producer/mae-definition-producer-prompt.js` — `buildMaeDefinitionProducerPrompt`; prongs `BUSINESS_EFFECTS`, `CONSUMMATION_PREVENTION` |
| Registry | `lib/canonical-v2/native-producer/producer-prompt-registry.js` → `MAE_DEFINITION` |
| Resolution | `lib/canonical-v2/native-producer/candidate-resolution.js` — `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN`, `MAE_DEFINITION_SUBJECT_TERM_MISMATCH`, prong corroboration table |
| Duplicate suppression | `lib/canonical-v2/native-producer/duplicate-suppression.js` — typed keys `MAE_DEFINITION_PRONG`, `MAE_CARVEOUT`, `MAE_DISPROPORTIONALITY_CARVEBACK` |
| Product projection | `lib/canonical-v2/key-terms-mae-product-projection.js` |
| Review UI | `components/review/table-configs/mae-definitions.config.js` |

### Tests (family-specific; no Work3 MAE authoring yet)

`tests/canonical-v2-mae-definition-resolution.test.js`, `tests/canonical-v2-mae-card-adapter.test.js`, `tests/canonical-v2-key-terms-mae-product-projection.test.js`, `tests/canonical-v2-mae-clause-label-parse.test.js`, `tests/canonical-v2-mae-definition-pin-review.test.js`, `tests/mae-definitions-card-selection.test.js`, plus Work3 contract gates in `tests/stage-2y-structure-m7-v2-repair-contract.test.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`, `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js`.

**Gap:** no `prepareMaeDefinition*` exports in `m7-v2-profile-authoring.js`. **No** `m7-v2-repair-contract-mae-definition-authoring-phase*.json` authorities exist.

---

## 2. Termination template — paths and exports to clone

Mirror **phase shape, validator discipline, and binding constants** — not Termination legal content.

### Authority chain (`evidence/…/control/`)

| Phase | Termination authority file |
|---|---|
| 2 | `m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json` (787442 B; 47 terminals → 45 derived profiles) |
| 3 (11 files) | `…-phase3-reference-review-authority.json`, `…-reference-target-evidence-authority.json`, `…-reference-source-normaliser-authority.json`, `…-reference-edge-value-authority.json`, `…-linked-rule-reference-value-authority.json`, `…-raw-m2-reference-owner-value-authority.json`, `…-source-occurrence-self-reference-value-authority.json`, `…-agreement-date-source-pair-reference-value-authority.json`, `…-company-stockholders-meeting-event-reference-value-authority.json`, `…-red-hat-company-letter-section-6-01-c-source-discovery-frontier-authority.json`, `…-reference-value-materialisation-authority.json` |
| 4 | `…-phase4-family-profile-package-review-authority.json` |
| 5 | `…-phase5-governed-disclosure-note-authority.json`, `…-phase5-governed-disclosure-note-ruling-authority.json`, `m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json` |
| Work3 Stage A | `…-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json` |
| Work3 core | `…-work3-governed-disclosure-note-core-integration-authority.json` |
| Shared Work3 | `m7-v2-repair-contract-work3-entry-correction-authority.json` |
| Profile package | `m7-v2-repair-family-work3-profile-package-termination.json` |

### Spine facades (`lib/canonical-v2/m7-v2-profile-authoring.js` `module.exports`)

Ordered chain to mirror with `prepareMaeDefinition*` names:

1. `prepareTerminationFamilyProposal` — partition via `terminationProposalPartition` (`classification_path` + `required_expression_signature` → `proposed_profile_key`)
2. Phase3: `prepareTerminationReferenceReviewCandidate` → … → `prepareTerminationReferenceValueMaterialisationCandidate` (11 nested predecessors)
3. `prepareTerminationFamilyProfilePackageReview` → `prepareTerminationFamilyProfilePackageResolution`
4. `prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview` → `prepareTerminationWork3StageBBlueprintProposal`
5. (later) `prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview` — uses `validateGovernedDisclosureNoteCoreIntegrationEvidence` from `m7-v2-contract.js`

Generic gap-review entry (family-agnostic): `prepareFamilyProfileGapReview`.

### Test template

`tests/stage-2y-structure-m7-v2-repair-work3.test.js` — 22 Termination tests from profile source adapter (~2605) through Stage B (~18893). Clone negative-vector structure into **`tests/stage-2y-structure-m7-v2-repair-work3-mae-definition.test.js`** (new file; do not edit Termination owner file).

---

## 3. MAE-specific legal class scope

Per repair plan: **hierarchy and carve-backs**, not Termination trigger taxonomy.

### Classification buckets (Phase2 `classification_path_registry` — propose 5, aligned to M5 subtypes)

| Bucket | Claim / role focus |
|---|---|
| `DEFINITION_INSTANCE` | Operative “MAE means …” header unit |
| `DEFINITION_PRONG` | `MAE_DEFINITION_PRONG` — `BUSINESS_EFFECTS`, `CONSUMMATION_PREVENTION` |
| `EXCLUSION` | `MAE_CARVEOUT` — 25 `MAE_CARVEOUT_CODES_V2` enum values |
| `DISPROPORTIONALITY_CARVEBACK` | `MAE_DISPROPORTIONALITY_CARVEBACK` — incremental/disproportionate effect return |
| `UNDERLYING_CAUSE_RESTORATION` | carve-back restoration / underlying-cause clauses |

### Carve-back / hierarchy operators (Work1 ground truth)

From `work1-acceptance-cases.json` MAE items: `EXCEPTION_TO`, `TO_EXTENT`, `CONSEQUENCE_MODIFIER` over `BASE_EXCLUSION` / `DISPROPORTIONATE_EFFECT` / `INCREMENTAL_DISPROPORTIONATE_SCOPE`. Required material fields on item 33: `GAAP`, `LAW`, `PEER_COMPARATOR`, `DISPROPORTIONATE_EFFECT_EXCEPTION`, `INCREMENTAL_EFFECT_CONSEQUENCE`.

### Permanent review stamps (not Work3 typed values)

- `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` on resolved MAE claims (`candidate-resolution.js`) — chapeau/subject not repeated in narrow carve-out quotes.
- `MAE_DEFINITION_SUBJECT_TERM_MISMATCH` when subject phrase fails corroboration.

### Phase5 / governed disclosure

Termination B9E (`LEGAL_RESTRAINT` + Company Letter gap + display text `contained in non-public disclosure letter`) is **Termination-specific**. MAE has **no** matching ruling on disk. Defer Work3 Stage A/B and Phase5 unless Ben approves a MAE-specific display-only gap.

---

## 4. Profile count / complexity vs Termination 45

| Metric | Termination (sealed) | MAE (estimate) |
|---|---|---|
| Phase2 source terminals | 47 (`phase2-authority-v2.json`) | ~108 M4 claims across 5 calibration runs (one section per deal) |
| Classification buckets | 10 (`MUTUAL_CONSENT`, `BREACH`, …) | 5 hierarchy buckets (above) |
| Derived Work3 profiles | **45** (`derived_profile_count`; 44 complete + 1 Company Letter gap) | **~60–100** — partition `(classification_path, required_expression_signature)` over ~108 units; 25 carveout codes × nested operator variants (Work1 items 33–47) inflate tuple diversity vs Termination |
| M5 subtype inventory | 4 sealed subtypes in TERMINATION role schema | **5** sealed subtypes |
| Phase3 reference ledger | 221 slots / 220 consumable (`reference-value-materialisation`) | Likely **smaller** (definition/self-containment edges, not temporal graphs or Company Letter frontier) — scope during Phase2 authority design |
| Known incomplete profile pattern | 1 private Company Letter gap (B9e) | TBD — expect `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` and subject-term gaps as **review-only**, not typed Work3 identity |

Termination complexity is **temporal + reference materialisation**; MAE complexity is **hierarchical enum breadth + nested carve-back expressions**.

---

## 5. Ordered implementation steps (dedicated MAE agent)

1. **Reconcile M5 gate:** calibration pack still `PROPOSED_AWAITING_BEN_APPROVAL` while control role schema is sealed — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.
2. **Draft Phase2 authority** — `m7-v2-repair-contract-mae-definition-authoring-phase2-authority-v1.json`: terminal registry over five calibration agreements + Work1 MAE cases; `classification_path_registry` (5 buckets); partition contract matching `terminationProposalPartition` shape.
3. **Family-local module** — e.g. `lib/canonical-v2/m7-v2-mae-definition-authoring.js`: `prepareMaeDefinitionFamilyProposal`, validators, `maeDefinitionProposalPartition`, error codes `M7_V2_MAE_DEFINITION_*` (mirror `TERMINATION_PHASE2_PROPOSAL_CODES` pattern).
4. **Phase3 (minimal):** only authorities required for definition/reference/self-containment materialisation — **do not** copy Termination temporal, agreement-date, stockholders-meeting, or Red Hat Company Letter authorities unless MAE Phase2 proves equivalent slots.
5. **Phase4 authority +** materialise `m7-v2-repair-family-work3-profile-package-mae-definition.json`; update lawful fixture in `tests/helpers/m7-v2-work3-family-package-fixture.js` when bytes exist.
6. **Branch tests** — `tests/stage-2y-structure-m7-v2-repair-work3-mae-definition.test.js`: Phase2 partition census, Phase3 withheld Work3 identities, Phase4 unapproved proposal schedule; negative drift vectors cloned from Termination test structure.
7. **Phase5 / Work3 Stage A–B** — only if a Ben-approved MAE governed-disclosure gap is identified; otherwise stop after Phase4 unapproved package review.
8. **Spine merge (serial, after Termination quiesce):** register `prepareMaeDefinition*` in `m7-v2-profile-authoring.js`, wire `validateGovernedDisclosureNoteCoreIntegrationEvidence` only if MAE needs core integration, extend `m7-v2-deterministic-generator.js` if generator profiles required.
9. **Proof:** `CI=true npm test` on new MAE Work3 tests + manifest/contract tests; `bash scripts/lint/forbidden-patterns.sh`.

Suggested new exports (names mirror Termination): `prepareMaeDefinitionFamilyProposal`, `prepareMaeDefinitionReferenceReviewCandidate`, …, `prepareMaeDefinitionFamilyProfilePackageReview`, `prepareMaeDefinitionFamilyProfilePackageResolution`, optional Stage B `prepareMaeDefinitionWork3StageBBlueprintProposal`.

---

## 6. Dependencies — wait for Termination core integration + inventory

| Dependency | Evidence |
|---|---|
| Termination core integration in flight | Stage B done in repo (`b9bca8c7`); `prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview` in progress; inventory review next |
| Core integration facade untested | `prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview` exported; **no** test in `work3.test.js`; `validateGovernedDisclosureNoteCoreIntegrationEvidence` in `m7-v2-contract.js` |
| Inventory review authority | Stage A expects `WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY` / `WORK3_TERMINATION_45_PROFILE_BLUEPRINT_PROPOSAL_AUTHORITY` (`terminationWork3StageAExpectedStageScope`) |
| Shared Work3 entry correction | MAE package path scoped but file absent; Termination package + Stage A/B receipts define merge protocol |
| Execution manifest ordering | Work4+ blocked until Work1–Work3 receipts pass (`scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`) |

**Do not** start MAE spine integration until Termination **core integration GREEN**, **inventory review** complete, and Termination family package sealed.

---

## 7. Files this MAE agent must NOT touch (shared spine merge order)

User-owned / parallel-agent forbidden (current conversation):

- `lib/canonical-v2/m7-v2-contract.js`
- `lib/canonical-v2/m7-v2-deterministic-generator.js`
- `lib/canonical-v2/m7-v2-profile-authoring.js`
- `tests/stage-2y-structure-m7-v2-repair-work3.test.js`

Also defer until coordinated merge:

- `scripts/stage-2y-structure-m7-v2-repair-*.mjs`
- `tests/stage-2y-structure-m7-v2-repair-contract.test.js` (unless adding isolated MAE contract cases in a branch-owned file)
- Termination-only evidence under `m7-v2-repair-contract-termination-*` (historical `STAGE_B_HANDOFF.md` is revoked)

### Merge order

1. Termination Work3 core integration + inventory (spine owner).
2. Parallel MAE prep: family-local authorities, `m7-v2-mae-definition-authoring.js`, branch tests, on-disk profile package.
3. MAE spine integration as a dedicated merge after (1) and Ben MAE profile-set approval.
4. Work4 formatter work remains blocked on full Work3 receipt chain.

---

*Prepared from repository read-only scan, 2026-08-24.*
