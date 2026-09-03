# ext/m7-w6-audit

id: status-w6
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w6-audit
status: IN PROGRESS

## State

Branch `ext/m7-w6-audit` at `39b07fb1`, from pinned base `b11388ab`.
Work 7 is accepted. Five of nine reports exist. Remaining: touched-rows, unfamiliar drafting, family-agreement counts, old-to-new matrix.

## What landed

- known-loss 244, historical limbs 69, parser ambiguities 23
- ten-agreement calibration: 10 sealed Work 3 analysis-set members; TopBuild 84/244 known-loss members reported separately; combined ten-corpus digest `b8825b71…`
- additive-three calibration: 16 sealed members on AbbVie/Landos, Lilly/Verve, Rocket/Redfin

Additive ledger bound at
`shadow/m7-generalisation-comparison-entry-correction/additive-open-world.json`
(7455 bytes, SHA-256 `4ae03b62…`). Same comparison-entry-correction shadow family as the A-0001 ledgers; recorded here so you can name a different source if this is the wrong file.

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work6.test.js > /tmp/w6-test.log 2>&1
echo $?
# 0; 9 pass, 0 fail
```
