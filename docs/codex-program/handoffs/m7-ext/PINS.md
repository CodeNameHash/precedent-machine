# Pins for the M7 external workstreams

Verify each of these against the repository before relying on it. If one
does not hold, stop and write a `Q`.

## Base

- Base commit of record: `git rev-parse origin/codex/recover-m7-20260812`
  (at the time of writing `f729e6ae`, "Cover the Work4 candidate-correction successor set in the
  recovery allowlist"). Existing `ext/*` branches based on `b11388ab` stay
  valid; do not rebase.
- PR: https://github.com/CodeNameHash/precedent-machine/pull/484, base branch
  `codex/stage-2y-structure-m2`.

## The registered candidate of record (immutable from here to the sealed receipt)

Superseded 2026-09-03 by the Work4 candidate correction (Ben; DECISIONS.md #25;
`docs/codex-program/notes/WORK4-CANDIDATE-CORRECTION-2026-09-03.md`).

- Registration ID: `9a3ccbf74f80499d80ee61e62ba3f06e95734e082b65b68243e4e5f695552106`
- File: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/9a3ccbf74f80499d80ee61e62ba3f06e95734e082b65b68243e4e5f695552106.json`
- Bytes: 27802. SHA-256: `c5c2ca0b90e22de4a87a70399191b95b4edf1f13fccc872621a3c62334865eed`
- Lifecycle state: `CANDIDATE_PENDING_REVIEW`.
- Counts unchanged: 16 code files, 3 runners, 8 tests, 6 semantic inputs, 24
  subtype trees, 3 predecessor receipts, 53 unique bound paths. The 53 paths
  are the same set as before; two of the bound tests changed bytes.
- The superseded registration `0e46052b…` stays in the same directory,
  byte-identical, never deleted, never consumed by Work 5–7. Tools must select
  the registration explicitly (see `outbox/A-0001-kickoff.md`, Q4).
- The bound paths are listed inside the file under `code_bindings`,
  `semantic_input_bindings`, `subtype_tree_bindings`,
  `family_profile_set_binding`, `structure_disposition_set_binding`,
  `view_policy_binding`, `predecessor_receipt_bindings`,
  `work0_evidence_root_binding`, `activation_receipt_binding` and
  `parent_authority_binding`. **Any change to any of those bytes after Work 5
  begins creates a new candidate and reopens the fixed-50 review.** Ext never
  writes to any of them.

## Work 4 outputs of record (the correction successor set)

- Correction authority: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work4-candidate-correction-authority.json`, id `0623ebaf6529aa9f5fccc16ced7ac40bbc3302091c07676b8eb32900e3fb25f3`.
- Execution manifest: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json`, manifest ID `8cedfae343fcc45755c24fd36774fbb1910410ecf0196d8a0a6d5fe261c45634`, 26315 bytes, SHA-256 `d0950a8e2b86951224b4a29590d966ff06fd2a98979587012727f4b6d83f53e3`. Carries `work4_candidate_correction_authority_binding` and binds the registration above.
- Transition authority: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-candidate-transition-authority-candidate-correction-successor.json`, id `c8d50e07ae36debf149dec070592587da6f540126aa051da168905aa198d022a`.
- Work 4 receipt (V2): `evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json`, receipt ID `d9bf55451a3403df4b21e33f0530665c56e1bd8c34fd4ee1e63348495ee56148`, 5385 bytes, SHA-256 `5611ec0a2ed753d0524c264dda2e92cfedb0c67d2dfb50092898a35952571ae1`, schema `STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V2`.
- Finaliser and validator: `scripts/stage-2y-structure-m7-v2-repair-work4-finalise.mjs`, `scripts/stage-2y-structure-m7-v2-repair-work4-validate.mjs` (select the successor set when the correction authority is present).
- Retained, superseded, immutable: the four committed originals (`…work4-execution-manifest.json`, `…work4-candidate-transition-authority.json`, registration `0e46052b….json`, `…work4-fixture.json`).

## Predecessor chain

Receipts under `evidence/canonical-v2/stage-2y-structure-migration/receipts/`:
`stage-2y-structure-m7-v2-repair-evidence-root.json` (Work 0),
`…-work1-7-authority-activation.json`, `…-work1-contract.json`,
`…-work2-compiler.json`, `…-work3-profile.json`, `…-work4-fixture.json`.
Authority: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json`.

## Reading list, in order

1. `CLAUDE.md`
2. `docs/core/OPERATING-RULES.md` (authority boundary at the top, in full)
3. `docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md`, sections Work 5, Work 6, Work 7
4. `docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-ADVERSARIAL-REVIEW-2026-08-14.md`
5. `docs/codex-program/notes/M7-LAWYER-REVIEW-QUESTIONS-AND-ANSWERS-2026-08-14.md`
6. `docs/core/PLAN.md` section 3 (current state and controls) and section 12 (M7)
7. `docs/codex-program/notes/WORK4-CANDIDATE-REGISTRATION-WIP-2026-09-03.md`
8. The Work 4 validator and finaliser, as the model for how a governed script reads bound inputs and refuses drift.

## Standing controls (PLAN §3, through M9)

Model calls zero. Phase B calls zero. Product-data writes zero. Selector,
pin, baseline and serving changes zero. External serving disabled.
