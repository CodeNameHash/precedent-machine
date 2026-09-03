# Pins for the M7 external workstreams

Verify each of these against the repository before relying on it. If one
does not hold, stop and write a `Q`.

## Base

- Base commit for every `ext/*` branch: `b11388ab7c9605b1df872b1c6cd2e927d1a2dbab`
  (`Implement M7 V2 repair Work 4`) on `codex/recover-m7-20260812`.
- PR: https://github.com/CodeNameHash/precedent-machine/pull/484, base branch
  `codex/stage-2y-structure-m2`.

## The registered candidate (immutable from here to the sealed receipt)

- Registration ID: `0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e`
- File: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e.json`
- Bytes: 27802. SHA-256: `880e26ee5f6826b8db49b947ef45b3797d0e01324803efa5f508087a0ed414d6`
- Lifecycle state after Work 4: `CANDIDATE_PENDING_REVIEW` (read `lifecycle_state`).
- Counts: 16 code files, 3 runners, 8 tests, 6 semantic inputs, 24 subtype
  trees, 3 predecessor receipts, 53 unique bound paths.
- The bound paths are listed inside the file under `code_bindings`,
  `semantic_input_bindings`, `subtype_tree_bindings`,
  `family_profile_set_binding`, `structure_disposition_set_binding`,
  `view_policy_binding`, `predecessor_receipt_bindings`,
  `work0_evidence_root_binding`, `activation_receipt_binding` and
  `parent_authority_binding`. **Any change to any of those bytes after Work 5
  begins creates a new candidate and reopens the fixed-50 review.** Ext never
  writes to any of them.

## Work 4 outputs

- Execution manifest: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest.json`, manifest ID `fbe1f1b97cc38f1f5992ae02e7d8fc77f8c3f64145bd5e89aa643fce65d0df44`.
- Transition authority: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-candidate-transition-authority.json`.
- Work 4 receipt: `evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture.json`, receipt ID `1a642cd12b2fc0c2dac767c7c1ac5615d6c2d9ad19ec5c3a33e5bde1b9ced02d`, 4311 bytes, SHA-256 `d43912a45c999cd22ee99feedf6adac94f948dc562a957e9d24fadc727f49eb8`.
- Finaliser and validator: `scripts/stage-2y-structure-m7-v2-repair-work4-finalise.mjs`, `scripts/stage-2y-structure-m7-v2-repair-work4-validate.mjs`.

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
