# Work4 candidate correction

Date: 2026-09-03. Authorised by Ben the same day ("do what you recommend",
in reply to the recommendation below). Authority record:
`evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work4-candidate-correction-authority.json`.

## The defect

Commit `b11388ab` (`Implement M7 V2 repair Work 4`) registered candidate
`0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e` and
committed the Work4 execution manifest, candidate transition authority,
registration and receipt. The pull-request CI run on that commit failed one
test in `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js`:
"Work4 bootstrap CLI creates its manifest once from the exact pushed prep
tree". It expected `WORK4_PREP_GIT_DRIFT` and observed `WORK4_OUTPUT_EXISTS`.

Cause, reproduced locally: the test's fixture builder
(`copyFrozenClosureGraph`) walks JSON binding paths transitively from the
sealed Work1–7 authority and copies every named file that exists in the
repository. The authority names the Work4 output paths. Before the
transition they did not exist and were skipped; after it they exist, are
copied into the fixture, and the bootstrap correctly refuses to overwrite
them. The test then asserts they are absent. No tree containing Work4's
outputs can satisfy it. The fixture builder's `excludedPaths` parameter
exists for this case and every caller passed an empty set.

That test file is one of the eight candidate-bound tests. A byte change to
it changes the candidate, so the fix cannot be a plain test edit.

## Why a correction, and why now

- Parent authority `candidate_registration_policy.pre_work5_change` is
  `CREATE_NEW_REGISTRATION_ID`; `rollback.after_commit` is
  `NEW_EXPLICIT_AUTHORITY_REQUIRED_FOR_REPLACEMENT_OR_REMOVAL`;
  `prior_candidate_registrations_and_review_evidence_never_deleted` is
  true. A corrected candidate before Work 5 is the path the authority
  already provides, given an explicit authority.
- The Work2–4 ordering-correction authority sets
  `effective_candidate_ordering.candidate_change_after_work4: FORBIDDEN`
  and `partial_failure_state: PRESERVE_CANDIDATE_AND_REQUIRE_NEW_AUTHORITY`.
  The correction authority supersedes exactly that one field for exactly one
  correction and preserves the candidate it supersedes.
- Work 5 has not begun, so no fixed-50 decision is invalidated.
- Deferring to Work 5 would change the candidate then anyway, since the
  bound test still has to change.

## What the correction does (successor set, nothing replaced)

`permitted_writes.creation_only_paths_become_immutable_after_commit` is
true, so the four committed Work4 files stay exactly as committed. The
correction follows the Work3 closure-successor precedent:

| role | committed (retained, immutable) | successor |
|---|---|---|
| execution manifest | `control/m7-v2-repair-work4-execution-manifest.json` | `control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json` |
| transition authority | `control/m7-v2-repair-work4-candidate-transition-authority.json` | `control/m7-v2-repair-work4-candidate-transition-authority-candidate-correction-successor.json` |
| registration | `…/m7-v2-repair-candidate-registrations/0e46052b….json` | `…/m7-v2-repair-candidate-registrations/<new id>.json` |
| receipt | `receipts/stage-2y-structure-m7-v2-repair-work4-fixture.json` | `receipts/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json` |

Paths are under `evidence/canonical-v2/stage-2y-structure-migration/`.

- The successor manifest carries one extra member,
  `work4_candidate_correction_authority_binding`, the way the Work3 manifest
  carries `work3_entry_correction_authority_binding`.
- The successor bootstrap requires the candidate root to contain exactly the
  superseded registration; the transition adds exactly one more.
- The successor receipt is `STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V2`: the V1
  members plus `work4_candidate_correction_authority_binding` and
  `superseded_work4_receipt_binding`.
- Work 5 resolves its Work4 predecessor manifest by the receipt schema: V1
  selects the committed path, V2 selects the successor, mirroring how Work 4
  resolves Work 3.
- The bind script selects correction mode by the `--authority` argument: the
  correction authority selects the successor set; the ordering authority
  keeps the original behaviour so the bound fixture tests still exercise it.
- The finaliser and validator are code, committed and CI-proved before the
  transition (commit A below). The successor manifest's write set is the
  transition authority, the registration and the receipt, so the atomic
  commit's delta is exactly the manifest plus those three.

## Bound bytes that change

`tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` (fixture
exclusions and a correction rehearsal) and
`tests/stage-2y-structure-m7-v2-repair-work4.test.js` (targets the successor
manifest when the correction authority exists). The successor registration
binds the new bytes. No candidate-bound `lib/` module, semantic input,
profile, subtype tree or predecessor receipt changes.

Commit A also touches files outside the authority's
`allowed_effects.named_repository_writes` list, none of them governed or
candidate-bound: the recovery allowlist, `docs/core/DECISIONS.md`, this note
and the Work4 WIP note, `lib/canonical-v2/phase1-authority-boundary-inventory.js`
and `tests/canonical-v2-phase1-authority-boundary.test.js`. The authority is
content-addressed and is not amended for that; the independent review of
commit A recorded the discrepancy here instead.

## Open item carried to the Work 5 contract

The independent review noted that `priorManifestPath` still resolves a Work 5
manifest whose Work4 predecessor receipt is V1 to the superseded committed
manifest. What rejects that path today is the candidate-root rule (the
successor registration is present, so the superseded manifest's root
selection fails) and the Work4–7 continuity rule. The Work 5 contract should
add the direct rule: a Work 5 manifest must bind the V2 receipt. It is not
added in commit A because the bound Work 5 and Work 6 fixture tests build
their Work4 predecessors on the V1 shape and would all move with it.

## Commit sequence

- **A, pre-correction:** the authority, the validator, the bind script, the
  finaliser and validator, the bound-test changes, the recovery allowlist
  entries for the six `b11388ab` files and the new files, the phase-1
  inventory entries for the two Work4 scripts, this note and the DECISIONS
  entry. Pull-request CI is expected green on A; A's tip is the base tip
  the successor bootstrap binds.
- **B, atomic:** successor bootstrap, transition, `node --test` of the Work4
  test, one finaliser run, validator, manifest validator, then the
  manifest's exact `git add` (successor manifest, transition authority
  successor, new registration, successor receipt), `git commit -m
  'Implement M7 V2 repair Work 4 candidate correction'`, `git push`.
- **C, follow-up:** allowlist entries for the four B files and the
  rehearsal test. CI is red between B and C, green after.

## Standing item carried forward

The `static_dependency_policy` gap (the manifest validator observes Git
through the Work3 validator's read-only seam) is unchanged by this
correction. Ben adopted option (b), passing the base-tip observation into
the validator as data, for the Work 5 contract.
