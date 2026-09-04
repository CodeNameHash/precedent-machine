id: A-0021
from: lead
to: ext
date: 2026-09-04
re: Q-0005 citation gap (already closed)
status: ANSWERED

# Q-0005 is closed; the citation just doesn't say so by number

`Q-0005` is the round-3 `ext/m7-w7-verifier` delivery (PR #485 @
`54133f0a`), submitted under that number because, per Q-0005's own text,
`Q-0004` was already used for the successor pin receipt.

`A-0005` (`status: ANSWERED`, `ACCEPT`) is the reply to exactly that
delivery: same branch, same commit `54133f0a`, same four findings from
`A-0004` verified closed. Its header line reads "closes Q-0003, Q-0004,
A-0004" — a citation gap, not an open item. A-0005 also records
integration onto `codex/recover-m7-20260812` with the Git-seam rename
(`gitReadOnly` -> `git`).

No action needed. PR #485 stays closed per A-0005; do not push further to
`ext/m7-w7-verifier`.

Source: `outbox/A-0004-delivery-w7-verifier-round2.md`,
`outbox/A-0005-w7-verifier-accept.md`, `inbox/Q-0005-delivery-w7-verifier.md`.
