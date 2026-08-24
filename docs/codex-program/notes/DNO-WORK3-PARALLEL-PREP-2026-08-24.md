# D&O Work3 parallel prep (2026-08-24)

Research-only handoff for archetype **#3** (`DNO_INDEMNIFICATION`). Archetype order per `docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md`: Termination → MAE → **D&O** → General Covenants.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing D&O evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 3, unapproved)

| Artefact | Path |
|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/DNO_INDEMNIFICATION.json` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/DNO_INDEMNIFICATION.json` |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/DNO_INDEMNIFICATION/current.json` |

Calibration pack: **7 comparator runs** (concho, metsera, modiv, redhat, skechers, skywater, topbuild). Status `PROPOSED_AWAITING_BEN_APPROVAL`. Claim keys in scope include indemnification continuation, tail policy, advancement, charter protection, TPB rights, premium caps.

Role schema: single subtype `DNO_INDEMNIFICATION::INDEMNIFICATION_AND_EXCULPATION`; proposition unit `ONE_INDEPENDENTLY_OPERATIVE_AUTHORED_UNIT`; `proposition_unit_rule` allows ordered roles or **linked children**.

### Native extraction evidence (per-deal runs)

Pattern: `evidence/canonical-v2/{deal}-dno-indemnification-20260809-2xk-final/` (adapter-result, resolution, validation, run-receipt, etc.). Additional runs under `evidence/canonical-v2/modiv-dno-20260807-replay/` (partyless control in `docs/codex-program/notes/step-4a1-partyless-provisions.md`).

### M7 V2 contract authorities (item 42 — sealed, D&O-specific)

In `lib/canonical-v2/m7-v2-contract.js` (read-only for D&O agent):

- `ITEM42_DECISION_ID`, `ITEM42_SOURCE_NODE_ID`, `ITEM42_44_AGREEMENT_ID` (Metsera additive)
- `ITEM42_SHARED_SOURCE_PROFILE_KEYS`: `PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL`, `PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT`
- `WORK3_PENDING_ISSUE` / `profile_set_binding_state: PENDING_WORK3_BEN_APPROVAL`
- Expected family package path (not yet on disk): `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dno-indemnification.json`

Work3 shared scope lists all 25 families including `DNO_INDEMNIFICATION` in `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json`. Lawful all-family fixture: `tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64` via `tests/helpers/m7-v2-work3-family-package-fixture.js`.

### Tests touching D&O today

| Area | Path |
|---|---|
| Work1 item 42 linked duties | `tests/fixtures/canonical-v2/m7-v2-repair/work1-acceptance-cases.json` (`item-42-linked-d-and-o-rights-survival`) |
| Contract item-42 negatives | `tests/stage-2y-structure-m7-v2-repair-contract.test.js` (shared-source, shared-fact coverage, delegation) |
| Native producer prompt | `lib/canonical-v2/native-producer/dno-producer-prompt.js` |
| Employee/D&O follow-on | `tests/canonical-v2-employee-dno-follow-on.test.js`, `tests/canonical-v2-employee-dno-resolution.test.js` |
| Fixture cards | `tests/fixtures/canonical-v2/dno-fixtures/corpus-cards.json` |
| MAE-definition family cards | `tests/fixtures/canonical-v2/mae-definition-family/` (MAE comparator, not D&O) |
| Work3 first-candidate id | `tests/stage-2y-structure-m7-v2-repair-work3.test.js` → `DNO_INDEMNIFICATION::INDEMNIFICATION_AND_EXCULPATION` |

**No** `m7-v2-repair-contract-dno-*-authoring-*` control files exist yet (contrast Termination below).

---

## 2. Termination pattern files to mirror

Termination is the only archetype with a full Phase 2–5 + Work3 Stage A/B pipeline. Mirror **structure and naming**, not legal content.

### Evidence control (`evidence/canonical-v2/stage-2y-structure-migration/control/`)

- Phase 2: `m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json`
- Phase 3 reference chain (11 authorities + materialisation audit receipts): `m7-v2-repair-contract-termination-authoring-phase3-reference-review-authority.json`, `…-target-evidence-authority.json`, `…-source-normaliser-authority.json`, `…-reference-edge-value-authority.json`, `…-linked-rule-reference-value-authority.json`, `…-raw-m2-reference-owner-value-authority.json`, `…-source-occurrence-self-reference-value-authority.json`, `…-agreement-date-source-pair-reference-value-authority.json`, `…-company-stockholders-meeting-event-reference-value-authority.json`, `…-red-hat-company-letter-section-6-01-c-source-discovery-frontier-authority.json`, `…-reference-value-materialisation-authority.json`, plus audit-transport supersession pair
- Phase 4: `m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json`
- Phase 5 governed disclosure note: ruling, authority, execution-completion receipts (`…-phase5-governed-disclosure-note-*.json`)
- Work3 Stage A (shared): `m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json`
- Work3 entry correction (shared): `m7-v2-repair-contract-work3-entry-correction-authority.json`

### Library facades (`lib/canonical-v2/m7-v2-profile-authoring.js` — spine; add D&O parallels elsewhere or extend only after spine merge)

Exported Termination prepare functions: `prepareTerminationFamilyProposal` → Phase 3 reference candidates → `prepareTerminationFamilyProfilePackageReview` → `prepareTerminationFamilyProfilePackageResolution` → `prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview` → `prepareTerminationWork3StageBBlueprintProposal` (+ `prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview`).

### Tests and handoff

- `tests/stage-2y-structure-m7-v2-repair-work3.test.js` — bindings, fixture chain, Phase 4–5, Stage A/B (do not extend for D&O)
- `tests/canonical-v2-termination-rights-review-stage-b-notes.test.js`
- Termination Stage B facade (`prepareTerminationWork3StageBBlueprintProposal`, commit `b9bca8c7`) — **done in repo**; core integration + inventory still open. Historical `STAGE_B_HANDOFF.md` is revoked.

### Scripts (shared Work3 spine)

`scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`, `scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs`, `scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs`, `scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs`

---

## 3. D&O-specific scope — linked duties in one source unit

Plan text (`M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` §Work 3): D&O archetype = **linked duties inside one source unit** (wave-3 families: Representations, Material Contracts, Interim Operating, **DNO**, Guaranty, General Covenants).

### Fixed-sample item 42 (Metsera §5.7, additive)

Three subprofiles from one closure, all `WORK3_BEN_PROFILE_APPROVAL_PENDING` / `REVIEW_ONLY`:

| Subprofile | Expression sketch | Temporal field |
|---|---|---|
| `RIGHTS_SURVIVAL` | `ALL_OF(RIGHTS_SURVIVAL, RIGHTS_SURVIVAL_DURATION)` | duration |
| `NO_ADVERSE_AMENDMENT` | `ALL_OF(NO_ADVERSE_AMENDMENT, NO_ADVERSE_AMENDMENT_DURATION)` | duration |
| `CLAIM_CONTINUATION` | `IF_THEN(CLAIM_MADE…)` | `CLAIM_CONTINUATION_PERIOD_REFERENCE` (delegated) |

**Shared span:** `six (6) years` on one source node (`ITEM42_SOURCE_NODE_ID`) → two facts, `SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE`, lawyer decision `ITEM42_DECISION_ID`, ruling `M5-RULING-ONE-SEMANTIC-OWNER`. Claim continuation **delegates** period to `RIGHTS_SURVIVAL_DURATION` owner (not a second parsed duration).

Contract tests encode byte ranges and negatives in `tests/stage-2y-structure-m7-v2-repair-contract.test.js` (~lines 597–700, item-42 case builders).

### Contrast with Termination archetype

Termination Work3 stress = nested conditions, external references (Company Letter frontier, governed disclosure notes). D&O stress = **one operative unit, multiple legal effects, shared typed value, delegation** — closer to `prepareTerminationLinkedRuleReferenceValueCandidate` / shared-fact coverage than to Red Hat letter discovery.

---

## 4. Implementation steps (future dedicated agent)

1. **Legal intake** — Ben approval on calibration pack + role schema; confirm subtype tree (survival, no-adverse-amendment, claim continuation, tail, advancement, etc.) and item-42 ruling preservation.
2. **Phase 2 evidence** — `m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json` + governed proposal from M2/M3/M4/M5 comparator runs (7 deals + item 42).
3. **Phase 3 (D&O-shaped)** — Prefer **linked-duty / shared-source** authorities over Termination’s full reference frontier; only add reference materialisation where a D&O deal requires unresolved edges (likely minimal vs Termination).
4. **Phase 4** — `…-phase4-family-profile-package-review-authority.json`; proposed profiles with fixture proofs per subtype; family package `m7-v2-repair-family-work3-profile-package-dno-indemnification.json`.
5. **Phase 5** — Governed disclosure notes only if a D&O gap matches note schema (Termination B9e pattern may not apply).
6. **Work3 Stage A** — Reuse shared successor authority; family-specific schema compatibility candidate (new test file, not `work3.test.js`).
7. **Work3 Stage B** — Blueprint proposal with D&O profile census (count ≠ Termination’s 45); stop before core integration per Termination Stage B contract.
8. **Tests** — New `tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` (+ optional `tests/canonical-v2-dno-work3-*.test.js`); extend `work1-acceptance-cases.json` only when item-42 NORMAL path is ready.
9. **Receipt path** — Register via existing Work3 manifest/receipt flow (`evidence/.../receipts/stage-2y-structure-m7-v2-repair-work3-profile.json` policy).
10. **Proof** — `CI=true npm test` filtered to new files; `npm run build`; no changes to forbidden spine until coordinated merge.

---

## 5. Blockers and merge order

| Order | Archetype | State | Impact on D&O |
|---|---|---|---|
| 1 | **Termination** | Phase 2–5 + Stage B green in repo; **core integration in progress**; inventory review next | Defines Work3 Stage A/B contracts and `m7-v2-profile-authoring.js` Termination constants; spine merges conflict if D&O edits same file before Termination seals |
| 2 | **MAE** | Calibration pack wave 2 + `proposed-role-schemas/MAE_DEFINITION.json`; **no** `m7-v2-repair-contract-mae-*` authoring files; Work3 tests reference samples 47/48 only | Second parallel track; no shared-source item-42 pattern; D&O should not wait for MAE Stage B but should **not** merge MAE/D&O spine changes in one undiffed commit |
| 3 | **D&O** | M5 + contract item-42 sealed; **no** authoring pipeline | Can prepare evidence and dedicated tests in parallel; **profile approval** and shared spine extension blocked until Termination Stage B spine merge strategy is clear |

Additional blockers:

- All M5 calibration packs `PROPOSED_AWAITING_BEN_APPROVAL` (D&O wave 3).
- Zero `m7-v2-repair-family-work3-profile-package-*.json` files on disk for any family.
- `work3.test.js` is Termination-heavy; D&O must use **new** test module to avoid merge wars.
- Item-42 contract rules are **exact**; any D&O profile draft must preserve decision id, span text, and two-profile shared-source set or Work1/contract suites fail.

**Recommended merge sequence:** land Termination core integration + inventory (seal spine) → MAE parallel spine slice (if ready) → D&O dedicated evidence + `prepareDno*` facades (new module or spine PR reviewed against Termination diff) → D&O family package JSON → Ben profile-set approval → Work1 NORMAL for item 42.
