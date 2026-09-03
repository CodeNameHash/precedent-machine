# ext/m7-w7-verifier

id: status-w7
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier
status: IN PROGRESS

## State

Branch `ext/m7-w7-verifier` created from pinned base `b11388ab7c9605b1df872b1c6cd2e927d1a2dbab`. No verifier code landed yet. Kickoff assumptions and pin checks are in `inbox/Q-0001-kickoff.md`. Implementation starts now; this workstream does not wait on the kickoff answers except where a listed Q gates a specific check.

## What this branch will deliver

- `scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs`
- `tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js`
- Draft PR `[ext-m7] Work 7 independent verifier` against `codex/recover-m7-20260812`

The script reads the Work 4 registration, re-derives every binding from the working tree and Git objects, recomputes or explicitly declines the six semantic input sets / 24 subtype trees / profile set / structure-disposition set, and checks the Work 0 → Work 4 receipt chain. It prints one JSON object (`PASS` or `FAIL` plus a complete findings array) and exits 0 only on `PASS`.

It does not rewrite the candidate, does not import the bound compiler or the Work 2–4 validators, and does not write to any of the 53 bound paths.

## Plan

1. Freeze the result schema and finding codes in the script header.
2. Implement a single bounded Git reader (`cat-file`, `ls-tree`, `rev-parse`, `diff-tree`, `merge-base`, `log` only).
3. Re-derive every registration binding: path, byte length, SHA-256, Git blob OID, declared counts.
4. For each semantic input, subtype tree, profile set and disposition set: recompute from an independent source when one exists; otherwise emit `NO_INDEPENDENT_SOURCE` rather than treating the bound bytes as truth.
5. Recompute predecessor receipt identities with the same `contentId` rule the Work 4 validator uses, without importing that validator.
6. Tests in temporary trees: byte-identical pass; one bound byte changed; path added; path removed; receipt identity altered; count edited. Never mutate this repository.
7. Fresh-session adversarial review before the delivery `Q`.

## Sub-agent split

- Lead writes the verifier and the test file. This is the load-bearing workstream; the spec is writable but a wrong independence cut corrupts the gate.
- A worker that did not write the script will run an adversarial review in a fresh session before the draft PR.
- No other worker on this branch unless the first implementation fails review twice.

## Candidate-bound paths

The 53 paths extracted from registration `0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e` are listed in `Q-0001`. This branch treats all of them as read-only. Delivery will include `git diff --stat b11388ab -- <those 53 paths>` returning empty.

## Proof commands (once code exists)

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
node scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs
echo $?
```
