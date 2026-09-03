# ext/m7-w6-audit

id: status-w6
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w6-audit
status: PLANNED

## State

Branch `ext/m7-w6-audit` created from pinned base `b11388ab7c9605b1df872b1c6cd2e927d1a2dbab`. No audit scripts yet. Work 7 is first. This branch stays idle until the sealed-set Q in `Q-0001` is answered or the assumption below is accepted by silence long enough that waiting would stall the workstream.

## What this branch will deliver

One script per named Work 6 report under `scripts/stage-2y-structure-m7-v2-repair-work6-*.mjs`, plus tests that assert output bytes or report behaviour. Each script takes the registration ID as its only identity input, refuses to run if the working tree does not match the registration, writes only under

`evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work6/`

and supports `--check` (recompute and compare, no write).

Planned scripts, one report each:

- `work6-touched-rows.mjs`
- `work6-known-loss-244.mjs`
- `work6-historical-limbs-69.mjs`
- `work6-parser-ambiguities-23.mjs`
- `work6-ten-agreement-calibration.mjs` (TopBuild separate)
- `work6-additive-three-calibration.mjs`
- `work6-unfamiliar-drafting.mjs`
- `work6-family-agreement-counts.mjs`
- `work6-old-to-new-matrix.mjs`

## Sealed-set assumption (also in Q-0001)

The adversarial review names three ledgers. All three exist on the pinned base under `shadow/m7-comparison-entry-correction/`:

| count | file | bytes | SHA-256 |
|---|---|---|---|
| 244 | `known-loss-244-ledger.json` | 231047 | `521dfec7073a5d0b3d86d239a4b92906ec4836f0fd1b29f4e0606d1dd9e390be` |
| 69 | `red-hat-69-ledger.json` | 72309 | `66f171464f154d6d7ac9126e85914c819a70d71fb7cd673db8c94ee958fd8a2d` |
| 23 | `m2-inline-23-ledger.json` | 19265 | `cd4cca768ffe4f371d8b68824cb3f179b38ca727f7a75694e6c2690b81348793` |

Member counts match (244 / 69 / 23). The 69-ledger still has one `RESIDUAL_QUOTE_UNVERIFIED` member, as the review noted. I will bind those digests and will not invent a substitute set. If Lead names a different sealed source, I will switch before writing the scripts.

## Sub-agent split

- Lead writes the registration-match gate and the shared `--check` / output-root contract first, as a short spec in the first script header.
- One worker per report script after that spec exists, each with acceptance criteria: registration ID in every output, refuse on tree drift, deterministic sort, `--check` exit 0 on match, write only under the work6 root.
- Fresh-session adversarial review of the whole branch before the delivery `Q`.

## Candidate-bound paths

Read-only. Delivery will include the empty `git diff --stat b11388ab -- <53 paths>` proof.
