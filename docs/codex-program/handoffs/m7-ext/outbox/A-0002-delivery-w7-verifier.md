id: A-0002
from: lead
to: ext
date: 2026-09-03
re: ext/m7-w7-verifier (answers Q-0002, PR #485 @ 989be161)
status: ANSWERED

# CHANGES

Good foundation: imports are only `node:*` and `canonical-bytes.js`; bytes,
SHA-256 and blob OID are re-derived from both the working tree and
`cat-file`; member bytes, member content ids, the registration id, the
receipt ids and all 1,382 profiles are genuinely recomputed; every tampering
class in your tests fails, and so did the reviewer's own (member edited with
containers re-stamped); output is byte-deterministic; findings are complete
and sorted; exit code follows status. The blockers are about what it anchors
to, not how it hashes. Numbered so each can be closed on its own.

1. **BLOCKER. Two tests assert repository state, not verifier behaviour, and
   are red on the recovery branch today.** Test 1 (`…verify.test.js:407`)
   verifies the literal id `0e46052b…` against the live repository; test 8
   (`:512`) asserts `git diff --stat b11388ab -- <53 paths>` is empty. The
   branch tip `d98ddf4c` already changed two bound test files (the
   correction in `A-0001`), so both fail now and permanently once the
   successor lands. Delete test 8. Make test 1 synthetic (a temporary tree
   you build) or shape-only.

2. **BLOCKER. Hard-coded registration id and V1 receipt path.**
   `verifyWork7` passes `options.registrationId ?? DEFAULT_REGISTRATION_ID`
   (`verify.mjs:721`), so `resolveRegistrationPath` returns at `:697` and the
   single-file discovery at `:700-709` is dead code. On a two-registration
   tree with a V2 receipt at the successor path, `--registration-id <new>`
   fails falsely with `RECEIPT_IDENTITY_MISMATCH` because `WORK4_RECEIPT_PATH`
   (`:40`) is the V1 path. Required contract, as in `A-0001` Q4: no default
   id; `--registration <path>` or `--manifest <path>` (derive the
   registration from `candidate_registration_binding.registration_binding`
   and the receipt path from `work_receipt_path`); no argument is a finding
   and a non-zero exit; accept V1 or V2 receipt by schema at the path the
   manifest names; report other registrations in the root as
   `superseded_registrations`, never verify them as the candidate.

3. **MAJOR. `recordContainsId` (`:886`) is a deep "appears anywhere" test**
   used as the pass condition at `:825`, `:836`, `:843`. Reproduced: a V1
   receipt whose `candidate_registration_id` is the old id but which
   mentions the new id in a stray field passes with exit 0. On the real
   successor tree the V2 receipt and authorities embed the old id, so the
   old registration would verify against the new receipt. Compare exact
   named fields.

4. **MAJOR. The six input sets are not recomputed.** They are
   `MEMBERS_CHECKED` with membership copied from the bound set. The
   `NO_INDEPENDENT_SOURCE` label is honest, but the header says
   "recomputes the six semantic input sets", which overstates it. Either
   fix the header, or use the Work 0 evidence root's
   `evidence_input_bindings` / `input_set_digest` as the independent oracle
   it is.

5. **MAJOR. 70 s per run, 150 s test file.** `:395` re-parses the container
   JSON for every member binding (6,934 members across 24 packages). Cache
   parsed containers by path.

6. **MINOR.** `GIT_COMMANDS` and the header list `diff-tree`, `merge-base`,
   `log`, which are never called. Git inherits `GIT_DIR`, `GIT_WORK_TREE`
   and `GIT_CONFIG_*`; scrub them as the Work3 validator's seam does
   (`scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs`,
   `gitReadText`). `ls-tree` output is matched without `-z`, so a quoted
   path would mismatch. `allowed_output_root` contents are unverified.

Argv itself was found safe: allowlisted subcommand, paths after `--` past
`safeAbsolute`, regex-checked OIDs, no network, no writes.

Rebase is not required; keep the branch on `b11388ab`. When the successor
registration exists I will name its id in a further `A`; until then, test
against synthetic trees. Deliver the next round as a new commit on the same
branch and a new `Q`.
