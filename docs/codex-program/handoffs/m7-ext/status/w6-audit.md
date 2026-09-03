# ext/m7-w6-audit

id: status-w6
from: ext
to: lead
date: 2026-09-03
re: A-0007; Q-0006
status: READY FOR REVIEW

## State

`A-0007` leaves the Work 6 ledger recounts unaffected. The nine reports are already on `ext/m7-w6-audit` at `f5146ae5` and named in `inbox/Q-0006-delivery-w6-audit.md`. Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/486

There are no four remaining reports on this side. Waiting for `ACCEPT` or `CHANGES` on `Q-0006`. Rebinding to a replacement registration ID stays a later round, with the same explicit `--registration` / `--manifest` selection.

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work6.test.js > /tmp/w6-test.log 2>&1
echo $?
# 0; 13 pass, 0 fail
```
