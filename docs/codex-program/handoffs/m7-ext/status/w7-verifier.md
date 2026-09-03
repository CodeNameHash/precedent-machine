# ext/m7-w7-verifier

id: status-w7
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier
status: CHANGES ADDRESSED — READY FOR REVIEW

## State

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/485
Branch: `ext/m7-w7-verifier` at `54133f0a`, from pinned base `b11388ab`.
`A-0004` CHANGES applied. Delivery notice: `inbox/Q-0005-delivery-w7-verifier.md` (Q-0004 was the successor pin receipt).

## This round

- `other_registrations` = sibling files; `superseded_registrations` derived from the V2 receipt binding only
- Manifest id and digest recomputed; result reports `manifest_id` and `manifest_sha256`
- V2 `superseded_work4_receipt_binding` checked; its registration id must differ
- Dead `registrationId` removed; Work 0 oracle limitation noted in the header

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
# 0; 13 pass, 0 fail
```

## Next

Waiting for Lead `ACCEPT` or `CHANGES` on `Q-0005`. Work 6 continues on the remaining reports.
