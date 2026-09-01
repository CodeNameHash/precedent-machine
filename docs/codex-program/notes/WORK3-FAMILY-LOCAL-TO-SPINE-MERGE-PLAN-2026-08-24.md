# Work3 family-local → spine merge plan

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Audience: implementation agent (plan only — **no code merge in this note**)  
Authority: `docs/core/PLAN.md`, `docs/core/OPERATING-RULES.md`

**Goal:** Move `m7-v2-mae-definition-authoring.js`, `m7-v2-dno-indemnification-authoring.js`, and (future) `m7-v2-general-covenants-authoring.js` into `m7-v2-profile-authoring.js` without regressing Termination Milestone A (45 profiles, Work3 seal + registration green).

**Predecessor state (verified 2026-08-24):** All three archetypes Milestone A complete in family-local modules. Termination lives only in the spine. See `PROGRAMME-N1-STATUS-2026-08-24.md`.

---

## 1. Module sizes (HEAD)

| Module | Lines | Bytes | Role |
|---|---:|---:|---|
| `lib/canonical-v2/m7-v2-profile-authoring.js` | 21,913 | 903,951 | Termination spine (Phase 2–5 + Work3) |
| `lib/canonical-v2/m7-v2-mae-definition-authoring.js` | 1,841 | 72,443 | MAE family-local |
| `lib/canonical-v2/m7-v2-dno-indemnification-authoring.js` | 1,442 | 60,647 | D&O family-local |
| *(future)* `m7-v2-general-covenants-authoring.js` | — | — | GC family-local (not authored yet) |

| Test file | Lines | Bytes | Tests |
|---|---:|---:|---:|
| `tests/stage-2y-structure-m7-v2-repair-work3.test.js` | ~20,700 | 809,229 | 29 (Termination + shared Work3 contract) |
| `tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js` | ~966 | 42,302 | 17 |
| `tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` | ~722 | 31,902 | 9 |

**Post-merge spine estimate:** ~25,200 lines / ~1.04 MB if all three families are physically inlined (before any later submodule split).

---

## 2. Export surface

### 2.1 Termination (already in spine — do not rename)

`m7-v2-profile-authoring.js` `module.exports` (frozen):

| Export | Kind |
|---|---|
| `M7V2ProfileAuthoringError` | shared error class |
| `prepareFamilyProfileGapReview` | cross-family Work3 helper |
| `prepareTerminationFamilyProposal` | Phase 2 |
| `prepareTerminationReferenceReviewCandidate` | Phase 3 |
| `prepareTerminationReferenceTargetEvidenceCandidate` | Phase 3 |
| `prepareTerminationReferenceSourceNormaliserCandidate` | Phase 3 |
| `prepareTerminationReferenceEdgeValueCandidate` | Phase 3 |
| `prepareTerminationLinkedRuleReferenceValueCandidate` | Phase 3 |
| `prepareTerminationRawM2ReferenceOwnerValueCandidate` | Phase 3 |
| `prepareTerminationSourceOccurrenceSelfReferenceValueCandidate` | Phase 3 |
| `prepareTerminationAgreementDateSourcePairReferenceValueCandidate` | Phase 3 |
| `prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate` | Phase 3 |
| `prepareTerminationReferenceValueMaterialisationCandidate` | Phase 3 |
| `prepareTerminationFamilyProfilePackageReview` | Phase 4 |
| `prepareTerminationFamilyProfilePackageResolution` | Phase 5 |
| `prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview` | Work3 Stage A |
| `prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview` | Work3 core integration |
| `prepareTerminationWork3StageBBlueprintProposal` | Work3 Stage B |
| `prepareTerminationWork3UnapprovedInventoryReview` | Work3 inventory |
| `prepareTerminationWork3BenInventorySessionDisposition` | Work3 Ben session |
| `prepareTerminationWork3FamilyPackageSeal` | Work3 seal |
| `prepareTerminationWork3FamilyPackageRegistration` | Work3 registration |

Termination authority constants (Phase 2–3) are **module-private** — tests duplicate bindings in `work3.test.js` (lines 26–133). Do not hoist Termination constants to exports during merge unless a dedicated refactor PR is scoped and Termination proof re-run.

### 2.2 MAE (family-local → spine)

`m7-v2-mae-definition-authoring.js` exports:

**Authority pins (also exported for tests):**

- `MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING`
- `MAE_DEFINITION_PHASE2_PROPOSAL_CODES`, `MAE_DEFINITION_PHASE2_PROPOSAL_KEYS`
- `MAE_DEFINITION_PHASE4_AUTHORITY_*` (bytes, id, path, schema, sha256)
- `MAE_DEFINITION_PHASE4_CANDIDATE_SCHEMA`, `MAE_DEFINITION_PHASE4_REVIEW_CODES`
- `MAE_DEFINITION_PHASE4_REVIEW_INPUT_KEYS`, `MAE_DEFINITION_PHASE4_REVIEW_OUTPUT_KEYS`
- `MAE_DEFINITION_PHASE4_SCHEDULE_SHA256`

**Facades:**

- `maeDefinitionProposalPartition`, `maeDefinitionProposalPartitionCanonicalTuple`, `maeDefinitionTerminalCarveoutCode`
- `prepareMaeDefinitionFamilyProposal`
- `prepareMaeDefinitionFamilyProfilePackageReview`
- `prepareMaeDefinitionWork3StageBBlueprintProposal` (stub — unimplemented)
- `prepareMaeDefinitionWork3UnapprovedInventoryReview`
- `prepareMaeDefinitionWork3BenInventorySessionDisposition`
- `prepareMaeDefinitionWork3FamilyPackageSeal`
- `prepareMaeDefinitionWork3FamilyPackageRegistration`

### 2.3 D&O (family-local → spine)

`m7-v2-dno-indemnification-authoring.js` exports (plain object — **not** `Object.freeze`):

**Authority pins:**

- `DNO_INDEMNIFICATION_PHASE2_AUTHORITY_*`
- `DNO_INDEMNIFICATION_PHASE2_PROPOSAL_CODES`, `DNO_INDEMNIFICATION_PHASE2_PROPOSAL_KEYS`
- `DNO_INDEMNIFICATION_PHASE4_AUTHORITY_*`
- `DNO_INDEMNIFICATION_PHASE4_CANDIDATE_SCHEMA`, `DNO_INDEMNIFICATION_PHASE4_REVIEW_CODES`
- `DNO_INDEMNIFICATION_PHASE4_REVIEW_INPUT_KEYS`, `DNO_INDEMNIFICATION_PHASE4_REVIEW_OUTPUT_KEYS`
- `DNO_INDEMNIFICATION_PHASE4_SCHEDULE_SHA256`

**Facades:**

- `dnoIndemnificationProposalPartition`
- `prepareDnoIndemnificationPhase2FamilyProposal`
- `prepareDnoIndemnificationFamilyProfilePackageReview`
- `prepareDnoIndemnificationWork3UnapprovedInventoryReview`
- `prepareDnoIndemnificationWork3BenInventorySessionDisposition`
- `prepareDnoIndemnificationWork3FamilyPackageSeal`
- `prepareDnoIndemnificationWork3FamilyPackageRegistration`
- `validateDnoIndemnificationUnapprovedInventoryReviewEvidence`

**Intentionally absent (vs Termination):** Phase 3 reference stack, Phase 5 resolution, governed-disclosure Work3, Stage B blueprint.

### 2.4 General Covenants (future)

Per `GENERAL-COVENANTS-WORK3-PARALLEL-PREP-2026-08-24.md`, expect:

- `lib/canonical-v2/m7-v2-general-covenants-authoring.js` (family-local first)
- `prepareGeneralCovenants*` facade set mirroring Termination **phase shape**, not legal content
- Phase 3 only if Q03 reference edges require it (likely smaller than Termination)
- No automatic copy of B9e / outside-date / Company Letter authorities

---

## 3. Merge mechanics (Termination-safe)

### 3.1 Recommended pattern: append-only inline + re-export shim

1. **Do not extract or refactor Termination code** in the same PR as family merges. Termination functions, constants, and `TRANSITIVE_SOURCE_PATHS` (line ~958) are load-bearing.
2. **Insert new family sections immediately before** the existing `module.exports` block in `m7-v2-profile-authoring.js`, wrapped in comment sentinels:

   ```text
   // === MAE_DEFINITION family authoring (merged from m7-v2-mae-definition-authoring.js) ===
   // === DNO_INDEMNIFICATION family authoring (merged from m7-v2-dno-indemnification-authoring.js) ===
   ```

3. **Extend** the existing `module.exports = Object.freeze({ ... })` with new keys. Keep export object frozen (match Termination).
4. **Convert family-local files to thin re-exports** after spine land:

   ```javascript
   'use strict';
   module.exports = require('./m7-v2-profile-authoring');
   // or selective re-export if circular-deps appear
   ```

   This preserves script import paths (`scripts/stage-2y-structure-m7-v2-mae-definition-*.mjs`, etc.) during transition.

5. **Error handling:** MAE/DNO currently use plain `Error`. On merge, route through `M7V2ProfileAuthoringError` + family error codes (mirror Termination `failAuthoring` pattern) — but only in the family section being merged; do not retrofit Termination throws.

6. **Imports:** MAE needs `canonical-bytes` and `MAE_CARVEOUT_CODES_V2` from `contract-bundle`. Add requires at top of spine file in a family-scoped block or with existing require cluster — avoid reordering Termination requires.

### 3.2 Forbidden in merge PRs

- Renaming `prepareTermination*` exports
- Moving Termination Phase 3 helpers to shared names
- Editing `TRANSITIVE_SOURCE_PATHS` except in a dedicated GC PR after Ben M5 seal
- Touching `m7-v2-deterministic-generator.js` unless a family proves generator profiles (none of MAE/DNO Milestone A do)
- Changing authority JSON bytes on disk (bindings are pinned)

### 3.3 Alternative (defer): spine aggregator only

If physical inline risks a Termination regression, land an aggregator first:

```javascript
module.exports = Object.freeze({
  ...require('./m7-v2-profile-authoring-termination'), // extract later
  ...require('./m7-v2-mae-definition-authoring'),
});
```

**Not recommended now** — Termination extraction is higher risk than append-only. Use only if append-only produces unmergeable conflicts.

---

## 4. Test file strategy

### 4.1 Keep family tests separate

| File | After merge | Rationale |
|---|---|---|
| `work3.test.js` | **No MAE/DNO test moves** | 809 KB; Termination owner; Milestone A slice ~4–10 min |
| `work3-mae.test.js` | Keep; optionally switch import to spine | 17 tests, ~seconds |
| `dno-work3.test.js` | Keep; optionally switch import to spine | 9 tests, ~seconds |

**Do not** append MAE/DNO cases to `work3.test.js`. The Termination file is already at the memory ceiling (`NODE_OPTIONS='--max-old-space-size=8192'`).

### 4.2 Import migration (per family PR)

**Phase A (merge PR):** Family tests may keep importing family-local shim (re-export from spine). Proves backward compatibility.

**Phase B (follow-up, optional):** Change test import to `require('../lib/canonical-v2/m7-v2-profile-authoring')` and destructure `prepareMaeDefinition*`. No assertion changes.

### 4.3 Test patterns to preserve

All three family test files share:

- `physicalBytes` / `physicalRecord` / `sourceEnvelope` helpers for authority pins
- `assert.deepEqual(result.authority_binding, *_BINDING)` on every facade output
- `validateSingleFamilyPackageInventory` on on-disk package bytes
- `LOWERCASE_HEX_64` proposal_id checks
- Milestone A inventory → disposition → seal → registration ladder tests
- `assertRecursivelyUnfrozen` / `isDeepFrozen` on inputs vs frozen outputs

MAE additionally tests partition convergence (items 33–36, item 47). DNO tests lazy `require` of authoring module (line ~187) — keep lazy load if circular deps appear post-merge.

### 4.4 Shared contract tests

`tests/stage-2y-structure-m7-v2-repair-work3.test.js` also holds `EXPECTED_FIRST_CANDIDATES` for all families and generic Work3 adapter tests (lines 2606–3774). **Do not edit** `EXPECTED_FIRST_CANDIDATES` during MAE/DNO merge unless adding GC later with explicit scope.

`tests/helpers/m7-v2-work3-family-package-fixture.js` — update only when swapping synthetic placeholders for on-disk MAE/DNO/GC packages (programme item 2 in N1 status); not part of spine merge itself.

---

## 5. Authority binding pins (must not drift)

Bindings are `{ path, schema_version, record_id_field, record_id, byte_length, sha256 }`. Facade outputs must `deepEqual` the pin. **Never** edit pinned JSON without a new authority record and test pin update.

### 5.1 Termination (in `work3.test.js` only — spine-private constants)

| Binding constant | Evidence path (short) |
|---|---|
| `TERMINATION_PHASE2_AUTHORITY_BINDING` | `…-termination-authoring-phase2-authority-v2.json` |
| `TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING` | `…-phase3-reference-review-authority.json` |
| `TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING` | `…-phase3-reference-target-evidence-authority.json` |
| `TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING` | `…-phase3-reference-source-normaliser-authority.json` |
| `TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING` | `…-phase3-reference-edge-value-authority.json` |
| `TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING` | `…-phase3-linked-rule-reference-value-authority.json` |
| `TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING` | `…-phase3-raw-m2-reference-owner-value-authority.json` |
| `TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING` | `…-phase3-source-occurrence-self-reference-value-authority.json` |
| `TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING` | `…-phase3-agreement-date-source-pair-reference-value-authority.json` |
| `TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING` | `…-phase3-company-stockholders-meeting-event-reference-value-authority.json` |
| `TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING` | `…-red-hat-company-letter-section-6-01-c-source-discovery-frontier-authority.json` |
| `TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING` | `…-phase3-reference-value-materialisation-authority.json` |
| Phase 4 (inline in tests) | `…-termination-authoring-phase4-family-profile-package-review-authority.json` |
| `TERMINATION_BEN_INVENTORY_PACKET_DRAFT_BINDING` | `…-termination-45-profile-inventory-review-packet-draft.json` |
| `TERMINATION_BEN_INVENTORY_SUCCESSOR_AUTHORITY_BINDING` | `…-work3-termination-ben-inventory-session-successor-authority.json` |
| `TERMINATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY_BINDING` | `…-work3-termination-family-package-seal-successor-authority.json` |
| `TERMINATION_REGISTRATION_SUCCESSOR_AUTHORITY_BINDING` | `…-work3-termination-registration-successor-authority.json` |

### 5.2 MAE (module exports + `work3-mae.test.js`)

| Pin | `record_id` (prefix) |
|---|---|
| Phase 2 | `55e4bb2c…` → `…-mae-definition-authoring-phase2-authority-v1.json` |
| Phase 4 | `f65ce317…` → `…-mae-definition-authoring-phase4-family-profile-package-review-authority.json` |
| Phase 4 schedule sha256 | `d84e563a…` (pinned separately) |

Work3 inventory/seal/registration bindings live in test fixtures and on-disk evidence under `m7-v2-repair-contract-work3-mae-definition-*` — copy pins from green `work3-mae.test.js` when wiring spine facades.

### 5.3 D&O (module exports + `dno-work3.test.js` `DNO_WORK3_BINDINGS`)

| Pin | Path fragment |
|---|---|
| Phase 2 | `…-dno-indemnification-authoring-phase2-authority-v2.json` |
| Phase 4 | `…-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json` |
| Inventory authority | `…-work3-dno-indemnification-unapproved-inventory-review-authority.json` |
| Packet | `…-dno-31-profile-inventory-review-packet-draft.json` |
| Disposition | `…-dno-31-profile-inventory-disposition.json` |
| Session receipt | `…-dno-ben-inventory-session-receipt.json` |
| Ben successor authority | `…-work3-dno-indemnification-ben-inventory-session-successor-authority.json` |
| Seal / registration | `…-work3-dno-indemnification-family-package-seal-successor-authority.json`, `…-registration-successor-authority.json` |

### 5.4 GC (future)

Draft Phase 2 authority under `evidence/…/control/m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v1.json` (name TBD). Pin in new `work3-general-covenants.test.js` before spine merge.

---

## 6. Forbidden simultaneous edits

| Rule | Why |
|---|---|
| **One family per spine PR** | MAE and D&O merges in one commit hide regressions and conflict on `module.exports` |
| **No spine PR while Termination `work3.test.js` is being edited** | Same file owner; merge conflicts on 809 KB test |
| **Do not edit `m7-v2-contract.js` in family merge PR** | Shared validators; Termination integration depends on stable contracts |
| **Do not edit `m7-v2-deterministic-generator.js`** | Termination Phase 4/5 materialisation path |
| **Do not edit Termination evidence** (`m7-v2-repair-contract-termination-*`, `m7-v2-repair-termination-*`) | Pins in `work3.test.js` |
| **Do not edit `scripts/stage-2y-structure-m7-v2-repair-*.mjs`** in same PR as spine body merge | Scripts reference `module_path` in authority JSON; update in follow-up after re-export shim proves stable |
| **No `npm test` full suite as gate** | Use targeted family + Termination slice (below) |
| **Never pipe test output to `tail`/`head`** | False green exit codes |

Scripts that import family-local modules today (update `module_path` in authority JSON only after re-export shim lands):

- `scripts/stage-2y-structure-m7-v2-mae-definition-*.mjs` (3)
- `scripts/stage-2y-structure-m7-v2-dno-indemnification-*.mjs` (5)
- `scripts/stage-2y-structure-m7-v2-general-covenants-*.mjs` (5)
- `scripts/stage-2y-structure-m7-v2-guaranty-financing-party-*.mjs` (5)
- `scripts/stage-2y-structure-m7-v2-termination-*.mjs` (5) — **Termination only; do not repoint**

**Post-shim audit (2026-08-24):** All `module_path` pins in scripts and Phase 2/4 authority JSON for MAE, D&O, GC, and Guaranty already reference the family-local shim paths (`m7-v2-*-authoring.js`), which re-export spine. No repoint to `m7-v2-profile-authoring.js` required. Smoke: all four shims `require()` OK; all four `*-family-profile-package.mjs` scripts exit 0 with byte-stable package ids.

---

## 7. Suggested merge order

| Step | Work | Gate before next step | Status |
|---|---|---|---|
| **0** | Confirm Termination Milestone A green on branch | Termination slice (§8.1) pass | done |
| **1** | **MAE spine merge** — append MAE section + exports; shim `m7-v2-mae-definition-authoring.js` | §8.1 + §8.2 pass | **done 2026-08-24** |
| **2** | MAE script `module_path` updates (optional separate commit) | §8.2 pass | **no change needed 2026-08-24** — all pins already at shim path |
| **3** | **D&O spine merge** — append D&O section + exports; shim `m7-v2-dno-indemnification-authoring.js` | §8.1 + §8.3 pass | **done 2026-08-24** |
| **4** | D&O script `module_path` updates (optional) | §8.3 pass | **no change needed 2026-08-24** — all pins already at shim path |
| **5** | **GC family-local Milestone A** (parallel prep — no spine) | New `work3-general-covenants.test.js` green | done (family-local) |
| **6** | **GC spine merge** — after Ben M5 Q01–Q03 + sealed role schema | §8.1 + §8.4 pass | **done 2026-08-24** |
| **6a** | GC script `module_path` updates (optional) | §8.4 pass | **no change needed 2026-08-24** — all pins already at shim path |
| **6b** | **Guaranty spine merge (PR4)** — append Guaranty section + exports; shim `m7-v2-guaranty-financing-party-authoring.js` | §8.1 + guaranty-work3.test.js pass | **done 2026-08-24** |
| **6c** | Guaranty script `module_path` updates (optional) | guaranty-work3.test.js pass | **no change needed 2026-08-24** — all pins already at shim path |
| **7** | Lawful 25-family fixture swap (`m7-v2-work3-family-package-fixture.js`) | Manifest / contract tests | pending |
| **8** | *(Optional later)* Split spine into `m7-v2-profile-authoring-{family}.js` requires | Full §8.5 | pending |

**Rationale:** MAE before D&O matches programme archetype order (#2 → #3). GC (#4) waits for M5 legal gate. Termination is never moved — only regression-tested after each step.

---

## 8. Proof commands

Run from repo root. Check **exit code** and `# fail 0`. Use `CI=true` and 8 GB heap.

### 8.1 Termination regression (required after every spine PR)

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  --test-name-pattern 'Milestone A|family package|Work3 Termination' \
  tests/stage-2y-structure-m7-v2-repair-work3.test.js
```

Expect: Milestone A + Work3 Termination tests pass (~4–10 min). Full 29-test file ~15+ min — run before programme handoff, not after every line edit.

Full Termination Work3 facade slice (pre-merge baseline):

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  --test-name-pattern 'Work3 Termination Stage B|core integration|inventory review|family package seal|family package registration' \
  tests/stage-2y-structure-m7-v2-repair-work3.test.js
```

### 8.2 MAE family proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js
```

Expect: 17 pass.

Regenerate on-disk package (byte-stable check after facade move):

```bash
node scripts/stage-2y-structure-m7-v2-mae-definition-family-profile-package.mjs
```

### 8.3 D&O family proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js
```

Expect: 9 pass.

```bash
node scripts/stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs
```

### 8.4 Combined non-Termination families (after steps 1–4)

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js \
  tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js
```

### 8.5 Programme gate (before Ben handoff / CI push)

```bash
CI=true npm run build
CI=true NODE_OPTIONS='--max-old-space-size=8192' npm test
bash scripts/lint/forbidden-patterns.sh
```

### 8.6 GC (future)

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-work3-general-covenants.test.js
```

---

## 9. Agent checklist (per family merge PR)

### PR1 MAE (2026-08-24) — complete

- [x] Termination slice §8.1 green **before** opening PR
- [x] Only one family section added to `m7-v2-profile-authoring.js`
- [x] `module.exports` extended; object remains `Object.freeze`
- [x] Family-local file reduced to re-export shim
- [x] No changes to `work3.test.js`
- [x] Family test file green (§8.2) — 17 pass
- [x] Termination slice §8.1 green **after** merge — 19 pass
- [x] On-disk profile package bytes unchanged
- [x] No authority pin `sha256` / `record_id` drift
- [x] Header comment on spine file updated to list families served

### PR2 D&O (2026-08-24) — complete

- [x] DNO baseline §8.3 green **before** merge — 9 pass
- [x] Only DNO_INDEMNIFICATION section added (append-only; Termination + MAE untouched)
- [x] `module.exports` extended with 25 D&O exports; object remains `Object.freeze`
- [x] `m7-v2-dno-indemnification-authoring.js` reduced to re-export shim (57 lines)
- [x] No changes to `work3.test.js`
- [x] Family test file green (§8.3) — 9 pass
- [x] MAE regression (§8.2) — 17 pass
- [x] Termination slice §8.1 green **after** merge — 19 pass
- [x] On-disk profile package bytes unchanged
- [x] No authority pin `sha256` / `record_id` drift
- [x] Header comment on spine file updated (Termination, MAE_DEFINITION, DNO_INDEMNIFICATION)

### PR3 GENERAL_COVENANTS (2026-08-24) — complete

- [x] GC baseline green **before** merge — 9 pass
- [x] Only GENERAL_COVENANTS section added (append-only; Termination + MAE + D&O untouched)
- [x] `module.exports` extended with 25 GC exports; object remains `Object.freeze`
- [x] `m7-v2-general-covenants-authoring.js` reduced to re-export shim (57 lines)
- [x] Export-key snapshot in `work3.test.js` updated (**95** keys)
- [x] Family test file green — 9 pass
- [x] MAE + D&O regression — 26 pass
- [x] Termination slice §8.1 green **after** merge — 19 pass
- [x] Header comment on spine file updated (Termination, MAE_DEFINITION, DNO_INDEMNIFICATION, GENERAL_COVENANTS)

### PR4 GUARANTY_FINANCING_PARTY (2026-08-24) — complete

- [x] Guaranty baseline green **before** merge — 9 pass
- [x] Only GUARANTY_FINANCING_PARTY section added (append-only; Termination + MAE + D&O + GC untouched)
- [x] `module.exports` extended with 25 Guaranty exports; object remains `Object.freeze`
- [x] `m7-v2-guaranty-financing-party-authoring.js` reduced to re-export shim (57 lines)
- [x] Export-key snapshot in `work3.test.js` updated (**120** keys)
- [x] Family test file green — 9 pass
- [x] GC + MAE + D&O regression — 35 pass
- [x] Termination slice §8.1 green **after** merge
- [x] Header comment on spine file updated (Termination, MAE_DEFINITION, DNO_INDEMNIFICATION, GENERAL_COVENANTS, GUARANTY_FINANCING_PARTY)


## 11. Remaining family-local modules (2026-08-25 audit)

**Merged to spine (thin shims, PR1–PR4):** MAE_DEFINITION, DNO_INDEMNIFICATION, GENERAL_COVENANTS, GUARANTY_FINANCING_PARTY.

**Still self-contained family-local** (~1,516–1,609 lines each; **19 modules**, ~30k lines total excluding spine):

| PR queue | Family | Module lines (approx) |
|---:|---|---:|
| PR6 | CLOSING_CONDITIONS | 1,599 |
| PR7 | REPRESENTATIONS | 1,516 |
| PR8 | FINANCING_COVENANTS | 1,583 |
| PR9 | TERMINATION_FEE | 1,534 |
| PR10 | NO_OTHER_REPS_FRAUD | 1,609 |
| PR11 | ANTITRUST_REGULATORY | 1,550 |
| PR12 | PROXY_MEETING | 1,582 |
| PR13 | TAX_MATTERS | 1,584 |
| PR14 | EMPLOYEE_MATTERS | 1,582 |
| PR15 | CONSIDERATION | 1,583 |
| PR16 | KEY_DEFINED_TERMS | 1,582 |
| PR17 | APPRAISAL_DISSENTERS_RIGHTS | 1,583 |
| PR18 | DIVIDENDS | 1,583 |
| PR19 | NO_SHOP | 1,593 |
| PR20 | SPECIFIC_PERFORMANCE_REMEDIES | 1,602 |
| PR21 | INTERIM_OPERATING | 1,583 |
| PR22 | MATERIAL_CONTRACTS | 1,581 |
| PR23 | MERGER_STRUCTURE_CLOSING | 1,583 |
| PR24 | MISC_BOILERPLATE | 1,583 |

**Not started:** Capitalisation — no `m7-v2-capitalisation-authoring.js` (family blocked on comparator registry).

**Spine today:** `m7-v2-profile-authoring.js` ~27,848 lines (Termination + PR1–PR4 families).

Merge order unchanged: **one family per PR**, Termination slice §8.1 before and after each merge. Largest modules (NO_SHOP, CLOSING_CONDITIONS, REPRESENTATIONS) are higher conflict risk — schedule when not parallel-editing those families.

---

## 10. Related notes

| Note | Use |
|---|---|
| `PROGRAMME-N1-STATUS-2026-08-24.md` | Live pickup sheet |
| `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md` | Termination Milestone A baseline |
| `MAE-FAMILY-RUN-PLAN-2026-08-24.md` | MAE export + merge defer list |
| `DNO-FAMILY-RUN-PLAN-2026-08-24.md` | D&O minimal slice rationale |
| `GENERAL-COVENANTS-WORK3-PARALLEL-PREP-2026-08-24.md` | GC future module + blockers |
| `N1-NEXT-FAMILY-2026-08-24.md` | GC is next family-local work |

---

*Plan only. Implementation agent owns RED→GREEN per §7–§8.*
