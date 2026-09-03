# Deal Terms producer channel: git coordination protocol

Two parties. **PM** is the Claude session that owns the Precedent Machine
repository and branch `codex/recover-m7-20260812`. **DS** is the Deal
Storylines agent (any vendor, may spawn sub-agents) building the larger
public M&A product that consumes Precedent Machine's released packages.
Ben reads both. No other channel exists; everything is a file in git.

## Branches

| branch | owner | purpose |
|---|---|---|
| `codex/recover-m7-20260812` | PM only | the governed M7 V2 repair branch. DS never pushes here. |
| `coord/deal-terms` | both | messages, status, pins. Only the files below. No code. |
| `ds/*` | DS | optional scratch branches for proposals (schemas, examples). Never code that runs in Precedent Machine. |

DS never modifies any other branch of this repository and never reads
Precedent Machine's database or internal evidence as a product input.
The only product-facing artefacts are released packages, which do not
exist yet (see `PINS.md`).

## Files on `coord/deal-terms`

All under `docs/codex-program/handoffs/deal-terms/`.

- `PROTOCOL.md` (this file) and `PINS.md`: PM-owned. Read-only for DS.
- `inbox/Q-NNNN-<slug>.md`: DS writes. A question, a requirement, or a
  proposal notice. NNNN is zero-padded and increases; never reuse a number.
- `outbox/A-NNNN-<slug>.md`: PM writes. The answer to `Q-NNNN`, or an
  unsolicited notice (`A-NNNN` with no matching Q).
- `status/deal-storylines.md`: DS writes, overwritten in place. What DS is
  waiting on, what it has assumed, what it has built against.

Each message file starts with this header, then free text:

```
id: Q-0001
from: ds
to: pm
date: 2026-09-04
re: <topic>
status: OPEN | ANSWERED | CLOSED
```

Rules for the branch: fetch and rebase your own commits onto
`origin/coord/deal-terms` before every push; never force-push; only touch
the files you own. Two parties writing different files never conflict.

## How to poll

```
git fetch origin coord/deal-terms
git log --oneline -3 origin/coord/deal-terms -- docs/codex-program/handoffs/deal-terms/outbox
git show origin/coord/deal-terms:docs/codex-program/handoffs/deal-terms/outbox/<file>
```

A new commit touching `outbox/` is a new message from PM.

## Cadence

PM answers every `OPEN` question at least once an hour while the channel
is open, or says why not. DS does not wait on an answer to keep working on
anything the answer does not gate; it records the assumption in `status/`
and moves. Answers may be partial and say so; later answers supersede
earlier ones by number.

## What DS may rely on

Only what `PINS.md` lists. Anything else in this repository is internal,
may change, and is not a contract.
