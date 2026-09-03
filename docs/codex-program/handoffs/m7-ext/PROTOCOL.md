# M7 external workstreams: git coordination protocol

Two parties. **Lead** is the Claude session that owns branch
`codex/recover-m7-20260812` and PR #484. **Ext** is the external lead agent
(any vendor, may spawn sub-agents) working the Work 5–7 support workstreams.
Ben reads both. No other channel exists; everything is a file in git.

## Branches

| branch | owner | purpose |
|---|---|---|
| `codex/recover-m7-20260812` | Lead only | the governed M7 V2 repair branch. Ext never pushes here. |
| `coord/m7-ext` | both | messages, status, decisions. Only the files below. No code. |
| `ext/m7-w7-verifier` | Ext | Work 7 independent verifier |
| `ext/m7-w6-audit` | Ext | Work 6 corpus-audit machinery |
| `ext/m7-w5-renderer` | Ext | Work 5 review-packet renderer |

Every `ext/*` branch starts from the pinned base in `PINS.md` and is never
rebased onto anything else. Lead integrates by cherry-pick or merge into the
recovery branch; Ext does not merge anything.

## Files on `coord/m7-ext`

All under `docs/codex-program/handoffs/m7-ext/`.

- `PROTOCOL.md` (this file) and `PINS.md`: Lead-owned. Read-only for Ext.
- `inbox/Q-NNNN-<slug>.md`: Ext writes. A question, a blocker, or a delivery
  notice. NNNN is zero-padded and increases; never reuse a number.
- `outbox/A-NNNN-<slug>.md`: Lead writes. The answer to `Q-NNNN`, or an
  unsolicited instruction (`A-NNNN` with no matching Q).
- `status/<workstream>.md`: Ext writes, one per `ext/*` branch. Overwritten
  in place; Lead reads it before every reply.
- `DECISIONS.md`: Lead-owned. Rulings that apply to every workstream.

Each message file starts with this header, then free text:

```
id: Q-0003
from: ext
to: lead
date: 2026-09-04
re: ext/m7-w6-audit
status: OPEN | ANSWERED | CLOSED
```

Rules for the branch: fetch and rebase your own commits onto
`origin/coord/m7-ext` before every push; never force-push; only touch the
files you own. Two parties writing different files never conflict.

## Delivery

1. Ext pushes the `ext/*` branch and opens a **draft** pull request targeting
   `codex/recover-m7-20260812`, title prefixed `[ext-m7]`. The PR body says
   what it delivers, what it deliberately does not, and the exact commands
   that prove it (`CI=true node --test <files>`, run counts, exit codes).
2. Ext writes `inbox/Q-NNNN-delivery-<workstream>.md` naming the PR.
3. Lead reviews, runs an independent adversarial audit, and answers in
   `outbox/`. Outcome is one of: `ACCEPT` (Lead integrates into the recovery
   branch, adding the allowlist and phase-1 inventory entries), or `CHANGES`
   with a numbered finding list. Ext addresses every finding on the same
   branch and writes the next `Q`. No round limit.
4. The PR's own CI will be red on the phase-allowlist and phase-1 checks until
   Lead integrates. That is expected; Ext does not edit those files to fix it.

## Cadence

Lead polls `coord/m7-ext` and the `[ext-m7]` PRs at least hourly while a
workstream is open and answers every `OPEN` question within that cycle or
says why not. Ext does not wait on an answer to keep working on anything
the answer does not gate; it records the assumption in `status/` and moves.
