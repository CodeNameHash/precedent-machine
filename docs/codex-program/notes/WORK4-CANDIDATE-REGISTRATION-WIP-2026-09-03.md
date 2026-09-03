# Work4 candidate registration checkpoint

Date: 2026-09-03

State: preservation note recorded before the create-once Work4 candidate transition.

Ben directed the current run to stop when the Work4 candidate is frozen and registered. The existing Work4 contract requires the candidate registration, transition authority, execution manifest, finaliser, validator, and final receipt to land in one atomic Work4 commit. The three governed outputs created at this checkpoint must therefore remain uncommitted until that final commit:

- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-candidate-transition-authority.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e.json`

The deterministic read-only preview binds candidate registration ID `0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e`, byte length `27802`, and SHA-256 `880e26ee5f6826b8db49b947ef45b3797d0e01324803efa5f508087a0ed414d6`.

The commit containing this note and its recovery-allowlist entry is the required pushed base tip for bootstrap. After the candidate transition, no later commit is permitted before the atomic final Work4 commit. This checkpoint is not a Work4 final receipt and must not be treated as one.

## Amendment, 2026-09-03, later the same day: the base tip moves

The pull-request CI run on `99d9e952` was red. Two contract tests in `tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` failed, both caused by the `aa190662` changes to `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`: the validator had gained a direct `node:child_process` import, which its dependency contract forbids, and it compared the Work4 transition authority against the candidate before closing the candidate's predecessor receipt identities, so a Work3 receipt identity defect surfaced as authority drift. The Work4 manifest's `git add` cannot carry the validator, so the fix is a separate, validator-only commit before the transition: the Git observations now go through one exported read-only seam in `scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs`, and the candidate record is validated before the transition authority is compared against it.

Consequences, stated exactly:

- The required pushed base tip for bootstrap is no longer `99d9e952`. It is the last commit pushed to `origin/codex/recover-m7-20260812` immediately before the bootstrap manifest is written, and the bind script observes it.
- The three governed outputs created locally at the first checkpoint are superseded. The bootstrap manifest and the transition authority bind the base tip commit, so they must be regenerated in a clean clone against the new tip; the regenerated files, not the local ones, are the run of record.
- The candidate registration binds tree blobs only, and the validator is not among its bound code paths, so the regenerated registration is expected byte-identical: ID `0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e`, byte length `27802`, SHA-256 `880e26ee5f6826b8db49b947ef45b3797d0e01324803efa5f508087a0ed414d6`. The transition refuses to proceed if it is not.
- The same pre-transition commit carries the CI critical-path reduction (the two twenty-minute evidence checks become named, digest-checkpointed CI gates; the two slowest test files are partitioned by title across shards). It touches no candidate-bound path. Both parts share the phase-1 authority-boundary test and inventory, which is why they land together.
- The Work4 finaliser and validator are **not** pre-committed. The manifest validator's Work5 rule (`expectedDeltaPaths = [manifest, ...permitted_write_paths]`, applied to the Work4 commit's observed `diff-tree`) requires the atomic Work4 commit's delta to be exactly the manifest plus all five permitted write paths. The atomic Work4 commit therefore adds exactly six files: the execution manifest, the candidate registration, the transition authority, the finaliser, the validator and the receipt. The Work3 precedent (`a0df3f86`, outputs only) does not transfer, because Work4←Work3 used the observed delta and Work5←Work4 uses the write-set rule.
- Two mechanical gates cannot be satisfied inside that commit: the recovery-phase allowlist cannot name paths before they exist (the checker rejects listed paths absent from the diff), and the phase-1 authority-boundary inventory cannot classify scripts before they exist (its test reads every classified file). The atomic commit's `git add` carries neither. One follow-up commit immediately after the atomic commit adds the six allowlist entries, classifies the two scripts, and adds the rehearsal test for the finaliser and validator. That follow-up is the first commit permitted after Work4 and is part of closing Work4, not a later work; the pull-request CI is red between the two commits and green after.
- Open item for Ben, recorded by the independent review of this commit: the authority's `static_dependency_policy` reserves fixed read-only Git inspection to the activation validator and the independent verifier, yet the execution-manifest validator has observed the pushed tip through Git since `aa190662` and still does, now through the Work3 validator's exported read-only seam. The repository's mechanical checks (import roster, phase-1 boundary) are satisfied; the policy's letter is not. The clean fix is for a Git-permitted caller to pass a pre-computed base-tip observation into the validator; that is a Work5–7 contract change, not a pre-transition one.
