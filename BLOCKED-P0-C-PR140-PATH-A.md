# BLOCKED-P0-C-PR140-PATH-A

Blocked at Task 1, step 6: GitHub CI still fails `phase-allowlist` after PR #140 was pared down to the Phase 0-C file set.

What passed locally:

- `ACTIVE_PHASE=0-C node scripts/ci/check-allowlist.js` with the PR file list passes.
- `npm test` passes: 959 tests.
- `node scripts/ingest-qa.js --all` has 0 unverified quotes and 0 duplicate clauses across all deals. It exits non-zero only for the known per-deal quarantine thresholds.
- `docs/schema-shape/reconciliation-log.jsonl` is byte-equal to pre-pare-down head `6e0b6a511a4a89c7af9c2577757575ef0051d581`.
- `docs/schema-shape/normalized-v1.json` remains 87,453,464 bytes.

What fails in CI:

- Job: `phase-allowlist`
- Run: `28873930178`
- Job: `85644062329`
- Failing step: `Collect changed files`
- Failure:

```text
gh: Server Error: Sorry, this diff is taking too long to generate. (HTTP 422)
Unable to process file command 'env' successfully.
Invalid value. EOF marker missing new line.
```

Cause:

The workflow still computes changed files with:

```sh
gh api "repos/${REPOSITORY}/pulls/${PR_NUMBER}/files" --paginate --jq '.[].filename'
```

GitHub cannot generate the PR files API response because `docs/schema-shape/normalized-v1.json` has a very large text diff. The local allowlist check passes when changed files are supplied from `git diff --name-only`.

Preservation / hand-off completed before the block:

- PR #141 preserves the strings reviewer UI as docs and archived runnable code.
- PR #142 hands off the reviewer-owned `docs/schema-shape/canonical-registry-v1.md` edits.
- PR #140 was force-pushed as a clean single-commit Phase 0-C diff with the live strings UI and canonical-registry edits removed.
- The normalized diff diagnosis was posted to PR #140 as a comment.

Next required decision:

Fix the CI changed-files collection path, or decide the structural split for `normalized-v1.json`. The current PR cannot get a green `phase-allowlist` check while the workflow depends on GitHub's PR files API for this diff.
