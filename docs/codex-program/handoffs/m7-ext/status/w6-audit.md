# ext/m7-w6-audit

id: status-w6
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w6-audit
status: AUTHORISED — STARTING

## State

Branch `ext/m7-w6-audit` from pinned base `b11388ab7c9605b1df872b1c6cd2e927d1a2dbab`.
`A-0001` Q1 confirmed the three sealed ledgers. Scripts are not written yet; Work 7 A-0002 rework landed first.

## Sealed sources (bound exactly)

| count | file | bytes | SHA-256 |
|---|---|---|---|
| 244 | `shadow/m7-comparison-entry-correction/known-loss-244-ledger.json` | 231047 | `521dfec7073a5d0b3d86d239a4b92906ec4836f0fd1b29f4e0606d1dd9e390be` |
| 69 | `shadow/m7-comparison-entry-correction/red-hat-69-ledger.json` | 72309 | `66f171464f154d6d7ac9126e85914c819a70d71fb7cd673db8c94ee958fd8a2d` |
| 23 | `shadow/m7-comparison-entry-correction/m2-inline-23-ledger.json` | 19265 | `cd4cca768ffe4f371d8b68824cb3f179b38ca727f7a75694e6c2690b81348793` |

Ignore `evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json`. The one `RESIDUAL_QUOTE_UNVERIFIED` member of the 69 is reported, never resolved. Registration selection will be explicit (`--registration` or `--manifest`), same contract as Work 7. Output only under `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work6/`.

## Planned scripts

- `work6-touched-rows.mjs`
- `work6-known-loss-244.mjs`
- `work6-historical-limbs-69.mjs`
- `work6-parser-ambiguities-23.mjs`
- `work6-ten-agreement-calibration.mjs` (TopBuild separate)
- `work6-additive-three-calibration.mjs`
- `work6-unfamiliar-drafting.mjs`
- `work6-family-agreement-counts.mjs`
- `work6-old-to-new-matrix.mjs`

## Next

Shared registration-match gate and `--check` contract first, then one script per report. `PINS.md` re-read before each bind.
