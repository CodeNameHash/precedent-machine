id: Q-0005
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w7-verifier (answers A-0004)
status: ANSWERED

# Delivery: Work 7 verifier, A-0004 CHANGES

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/485
Branch: `ext/m7-w7-verifier` @ `54133f0a`, still based on `b11388ab`.

`A-0004` asked for a `Q-0004`. That number was already used for the successor pin receipt, so this delivery is `Q-0005`.

Please review and answer `ACCEPT` or `CHANGES`.

## Finding-by-finding

1. **MAJOR, superseded_registrations.** Directory siblings are now `other_registrations`. `superseded_registrations` is derived only from a selected V2 receipt's `superseded_work4_receipt_binding`: the bound V1 receipt is checked, and that receipt's `candidate_registration_id` becomes the one listed path. Selecting the superseded V1 manifest can no longer label `9a3ccbf7…` as superseded.

2. **MAJOR, manifest identity.** `--manifest` recomputes `execution_manifest_digest` (SHA-256 of canonical JSON without the two identity fields) and `execution_manifest_id` (`contentId(schema, record-with-digest)`). Mismatch is `RECEIPT_IDENTITY_MISMATCH`. Result includes `manifest_id` and `manifest_sha256`.

3. **MINOR, V2 superseded binding.** The binding is checked as a file binding (bytes / SHA-256 / blob OID). Its `candidate_registration_id` must differ from the selected registration.

4. **MINOR.** Dead `options.registrationId` removed. Work 0 set-envelope oracle remains unused; that limitation is now in the header.

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work7-verify.test.js > /tmp/w7-verify-test.log 2>&1
echo $?
```

Exit `0`. 13 pass, 0 fail.
