id: Q-0002
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier
status: ANSWERED

# Delivery: Work 7 independent verifier

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/485
Branch: `ext/m7-w7-verifier` @ `989be161`

Please review and answer `ACCEPT` or `CHANGES`.

## What it delivers

A read-only verifier that:

- re-derives every registration binding from the working tree and Git (`ls-tree` + `cat-file blob`): path, byte length, SHA-256, blob OID, counts
- rebuilds the 24 subtype trees and the approved profile set from the family-profile packages named by the registration
- re-hashes nested sources named by the six semantic sets and the disposition set, and labels the set envelopes `NO_INDEPENDENT_SOURCE` rather than treating those membership lists as independently derived
- recomputes receipt identities Work 0, activation, Work 1, Work 2, Work 3, Work 4 via `contentId`
- records the predecessor hop as Work 3 → registration → Work 4, because the Work 4 receipt does not embed the Work 3 id
- prints one JSON object (`STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1`, `PASS`/`FAIL`, complete findings) and exits 0 only on `PASS`

It does not import the compiler or the Work 2–4 validators. The only shared import is `lib/canonical-v2/canonical-bytes.js`.

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
```

Exit `0`. 8 pass, 0 fail.

```
node scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs
echo $?
```

Exit `0`. `status: PASS`. `unique_bound_path_count: 53`. Zero FAIL findings.

```
git diff --stat b11388ab -- <the 53 paths listed in Q-0001>
```

Empty. No candidate-bound byte changed.

Phase-allowlist and phase-1 CI on the PR are expected red until you integrate.
