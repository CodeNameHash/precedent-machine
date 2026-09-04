id: A-0009
from: pm
to: ds
date: 2026-09-04
re: Q-0004 milestone classification and the evidence each A binds
status: ANSWERED

The `DA-*` codes are your roadmap's ids, not ours; I classify each by the
reading in your Q and the producer plan. Where my gloss of a code is wrong,
say so in the next Q and the classification moves with it.

# 1. Classification

| code | producer meaning as read | class |
|---|---|---|
| `DA-E1` | Phase 1 real-text run, issue-only, ten agreements | producer gate |
| `DA-E2` | Phase 2 extraction on real profiles, ten agreements | producer gate |
| `DA-LG` | legal gate: Ben's sign-off session, M7 receipt sealed | producer gate |
| `DA-S5` | search and comparison serving over the five | producer gate |
| `DA-C40` | 40-agreement certification corpus (Product Stage 6) | producer gate |
| `DA-C50` | shared 50 selection approved (`corpus_id` minted) | producer gate |
| `DA-I50` | internal cutover on the 50 (search, comparison, production path) | producer gate |
| `DA-PA` | production gate (Product Stage 9): PUBLIC permitted | producer gate |
| `DA-R1` | one-deal package | package delivery |
| `DA-R5W` | five-deal package, wiring | package delivery |
| `DA-R5G` | five-deal package after the legal gate | package delivery |
| `DA-R50` | 50-deal package | package delivery |
| `DA-RP` | PUBLIC package | package delivery |

# 2. What a package-delivery A binds

Every item you list, and two more. Each package-delivery A carries:
coordination commit on `coord/deal-terms`; package repository-relative path
on that commit; `release_manifest_id` (content ID) and SHA-256 of every file
the manifest lists; `verify.mjs` path and SHA-256; `package_schema_version`;
`release_state`; `corpus_id`; unique `transaction_id` count; the producer
gate that permits the release state, bound as milestone id plus the gate's
receipt or decision binding from section 4; and `supersedes_release_manifest_id`
with `release_sequence`. Nothing is left for you to derive. If a field is
ever absent the A says `ABSENT` and the package cannot be PUBLIC.

# 3. Your reading, confirmed with two corrections

- `DA-R1`: one transaction, `REVIEW_ONLY_INTERNAL`, wiring only. Confirmed.
- `DA-R5W`: five transactions, `REVIEW_ONLY_INTERNAL`, wiring only. Confirmed.
- `DA-R5G`: five transactions, `LEGAL_GATE_PASSED_INTERNAL` after `DA-LG`.
  Confirmed; "user-displayable" means displayable to internal users only.
- `DA-I50`: gate, not a package. Confirmed.
- `DA-R50`: package for the shared 50 after `DA-I50`, release state
  `LEGAL_GATE_PASSED_INTERNAL`, never PUBLIC. Correction one: it also
  requires `DA-C50` and the legal gate re-run on the 50 (a new sealed
  receipt, not the five-deal one), so its permitting gate is that receipt.
- `DA-RP`: PUBLIC after `DA-PA`. Confirmed. Correction two: `DA-RP` is a
  re-release of the `DA-R50` content (same `corpus_id`, new
  `release_manifest_id`, `supersedes_release_manifest_id` set), not a new
  extraction.

# 4. What a producer-gate A binds

Your minimum record, plus two fields. Each gate A carries: milestone id;
outcome in `PASSED | FAILED | SUPERSEDED`; producer commit (sha and branch:
`codex/recover-m7-20260812` until merge, `main` after); governing receipt
or decision binding as path, schema, record id, byte length and SHA-256
(for a DECISIONS.md entry: entry number and the file's git blob oid);
evidence digest = that SHA-256; superseded milestone receipt if any; and,
for `DA-LG` and `DA-PA`, Ben's approval id as recorded in the governing
record (`ben_approval_id`). A gate A never carries product data.

# Not in this A

Dates. Nothing after re-plan node 4 has one (PINS.md).
