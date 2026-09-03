id: Q-0003
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier (answers A-0002)
status: ANSWERED

# Delivery: Work 7 verifier, A-0002 CHANGES

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/485
Branch: `ext/m7-w7-verifier` @ `e43aaa94`, still based on `b11388ab`.

Please review and answer `ACCEPT` or `CHANGES`.

## Finding-by-finding

1. **BLOCKER, repository-state tests.** Deleted the `git diff --stat b11388ab` test. Replaced the live-id / 53-path test with a synthetic `--manifest` pass that asserts schema, status, predecessor chain and recomputation labels. No test now reads the live registration id or the recovery-branch tree.

2. **BLOCKER, hard-coded registration and V1 receipt.** No default id. `--registration <path>` or `--manifest <path>` is required. No argument is `SELECTION_REQUIRED` and exit 1. `--manifest` reads `candidate_registration_binding.registration_binding` (bytes checked) and `work_receipt_path`. Sibling files in the registration root are `superseded_registrations` and are never verified as the candidate. Work 4 V1 and V2 schemas are both accepted at the path the manifest names. `--registration` alone still verifies the selected registration; the Work 4 receipt check is skipped with an INFO until a manifest names it.

3. **MAJOR, `recordContainsId`.** Removed. Predecessor hops compare exact named fields (`work0_evidence_root_binding.record_id`, `activation_receipt_binding.record_id`, `predecessor_receipt_binding.record_id`, plus the synthetic top-level aliases). Registration binds Work 3 only via `predecessor_receipt_bindings` where `work === 'WORK3'`. Work 4 binds the selected registration only via top-level `candidate_registration_id`. A receipt whose `candidate_registration_id` is the old id and which mentions the selected id in a stray field now fails.

4. **MAJOR, six input sets.** Header corrected. Envelopes stay `NO_INDEPENDENT_SOURCE` / `MEMBERS_CHECKED`; nested sources are still re-hashed. No Work 0 oracle added.

5. **MAJOR, 70 s parse.** Parsed containers are cached by path. The test file is now 11 synthetic cases, ~2 s, exit 0.

6. **MINOR, Git seam.** `gitReadOnly` now allows only `cat-file`, `ls-tree`, `rev-parse`; scrubs `GIT_DIR`, `GIT_WORK_TREE` and `GIT_CONFIG_*` as Work 3 does; `ls-tree` uses `-z`. `allowed_output_root` is listed and reported as INFO (file count), not left unobserved.

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
```

Exit `0`. 11 pass, 0 fail.

```
node scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs
echo $?
```

Exit `1`. `SELECTION_REQUIRED`. Discovery and default IDs are gone.

Phase-allowlist and phase-1 CI on the PR remain expected red until you integrate.
