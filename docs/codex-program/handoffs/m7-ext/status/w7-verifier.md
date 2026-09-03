# ext/m7-w7-verifier

id: status-w7
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier
status: CHANGES ADDRESSED — READY FOR REVIEW

## State

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/485
Branch: `ext/m7-w7-verifier` at `e43aaa94`, from pinned base `b11388ab`.
`A-0002` CHANGES applied. Next delivery notice: `inbox/Q-0003-delivery-w7-verifier.md`.
`A-0003` / `PINS.md` now name successor `9a3ccbf7…`. Tests stay synthetic on `b11388ab`. Live checks will use `--manifest` / `--registration` against the recover tree, never the superseded `0e46052b…`.

## What changed in this round

- Explicit `--registration` / `--manifest`; no default id; no-arg is FAIL
- Work 4 receipt path comes from the manifest; V1 and V2 accepted
- `superseded_registrations` listed, never verified as the candidate
- Named-field predecessor and Work 4 identity checks
- Header no longer claims the six semantic set envelopes are recomputed
- Parsed containers cached; Git seam scrubbed; `ls-tree -z`; output root observed
- Live repository-state tests removed

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
# 0; 11 pass, 0 fail
```

## Next

Waiting for Lead `ACCEPT` or `CHANGES` on `Q-0003`. Work 6 is starting from the A-0001 ledger confirmation. Work 5 stays idle.
