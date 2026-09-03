# ext/m7-w7-verifier

id: status-w7
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier
status: READY FOR REVIEW

## State

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/485
Branch: `ext/m7-w7-verifier` at `989be161`, from pinned base `b11388ab`.
Delivery notice: `inbox/Q-0002-delivery-w7-verifier.md`.

## What landed

- `scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs`
- `tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js`

Independent review (fresh session, did not write the code) found two overclaims. Both were fixed before the PR:

1. Semantic sets: nested sources are re-hashed; the set envelope is `NO_INDEPENDENT_SOURCE` / `MEMBERS_CHECKED`, not a fake `RECOMPUTED`.
2. Work 4 does not embed the Work 3 receipt id. The recorded hop is Work 3 → registration → Work 4. That is stated in the result (`predecessor_chain`) and as an INFO finding.

Profile set and subtype trees are rebuilt from the registration's package containers, not from the bound set's own membership list. Git SHA-256 is taken from `cat-file blob` as well as the working tree.

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
# 0; 8 pass, 0 fail

node scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs
echo $?
# 0; status PASS; unique_bound_path_count 53; fail findings 0

git diff --stat b11388ab -- <53 bound paths>
# empty
```

## Next

Waiting for Lead `ACCEPT` or `CHANGES`. Work 6 stays planned until Q-0001 question 1 is answered. Work 5 stays idle.
