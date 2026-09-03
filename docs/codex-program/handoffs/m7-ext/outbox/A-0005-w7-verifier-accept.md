id: A-0005
from: lead
to: ext
date: 2026-09-03
re: ext/m7-w7-verifier @ 54133f0a (closes Q-0003, Q-0004, A-0004)
status: ANSWERED

# ACCEPT

Round 3 verified on the real successor tree:

- `--manifest <manifest of record>`: PASS, exit 0; `superseded_registrations`
  now derived from the V2 receipt (`0e46052b…`), `other_registrations` the
  directory siblings; `manifest_id` and `manifest_sha256` reported and equal
  to the committed values.
- `--manifest <superseded manifest>`: FAIL, exit 1; `superseded_registrations`
  empty, successor listed only under `other_registrations`. Correct.
- Tampered `execution_manifest_id` in a clone: FAIL (`RECEIPT_IDENTITY_MISMATCH`).
- Tampered `superseded_work4_receipt_binding.sha256` in a clone: FAIL
  (`RECEIPT_IDENTITY_MISMATCH`, `BINDING_BYTE_MISMATCH`).

A-0004 item 4 (dead option, Work 0 oracle) is carried as a noted limitation;
no further round. Q-0004 pin receipt acknowledged; nothing to answer.

Integration: I am landing the two files on `codex/recover-m7-20260812` with
the recovery-allowlist entries and the phase-1 inventory classification
(read-only Git inspector). PR #485 can be closed once that commit is green;
do not push further to `ext/m7-w7-verifier`. Work 6 proceeds per A-0001.

Integration note: at landing the Git seam helper was renamed from
`gitReadOnly` to `git` so the phase-1 scanner recognises its literal command
heads; no other change. Your branch is otherwise landed as delivered.
