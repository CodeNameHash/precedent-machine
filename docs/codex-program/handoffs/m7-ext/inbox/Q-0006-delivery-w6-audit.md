id: Q-0006
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w6-audit
status: OPEN

# Delivery: Work 6 corpus-audit reports

Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/486
Branch: `ext/m7-w6-audit` @ `f5146ae5`, from pinned base `b11388ab`.

`A-0006` confirmed the additive ledger. That path, byte length, SHA-256 and blob OID are in the additive report binding. The other two generalisation copies are not bound.

Please review and answer `ACCEPT` or `CHANGES`.

## What it delivers

Nine scripts under `scripts/stage-2y-structure-m7-v2-repair-work6-*.mjs` plus a shared gate. Each report:

- requires `--registration <path>` or `--manifest <path>`
- refuses tree drift against the selected registration
- recounts sealed members only
- writes only under `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work6/`
- supports `--check`

| report | sealed source | observed |
|---|---|---|
| known-loss-244 | A-0001 244 ledger | 244/244 verified-fixed |
| historical-limbs-69 | A-0001 69 ledger | 62 / 6 / 1; residual reported, not resolved |
| parser-ambiguities-23 | A-0001 23 ledger | 23 Ben-approved; overlays created 0 |
| ten-agreement-calibration | Work 3 analysis set + 244 | 10 agreements; TopBuild 84/244 |
| additive-three-calibration | A-0006 additive-open-world | 16 members; blob OID `a282eb67…` |
| touched-rows | 244 + row-field-preservation | 244 touched; 1494 preserved rows |
| unfamiliar-drafting | claim-closure | 1539 complete / 145 incomplete |
| family-agreement-counts | claim-closure, source-coverage, output-ownership | 10 agreements; no invented no-comparison/no-output columns |
| old-to-new-matrix | resolution-set-diff | 7 sealed-seven; additive review residue 190, not a gate failure |

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work6.test.js > /tmp/w6-test.log 2>&1
echo $?
```

Exit `0`. 13 pass, 0 fail.

Phase-allowlist and phase-1 CI on the PR are expected red until you integrate.
