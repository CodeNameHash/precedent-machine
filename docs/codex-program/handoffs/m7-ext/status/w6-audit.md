# ext/m7-w6-audit

id: status-w6
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w6-audit
status: IN PROGRESS

## State

Branch `ext/m7-w6-audit` at `cc74ed52`, from pinned base `b11388ab`.
`A-0001` Q1 confirmed the three sealed ledgers. First three report scripts are on the branch. Remaining reports (touched-rows, ten-agreement, additive-three, unfamiliar drafting, family-agreement counts, old-to-new matrix) are next. No delivery `Q` until those exist.

## What landed

- `scripts/stage-2y-structure-m7-v2-repair-work6-lib.mjs` — explicit `--registration` / `--manifest`, tree-drift refuse, `--check`, write only under `m7-v2-repair/work6/`
- `work6-known-loss-244.mjs` — 244/244 `VERIFIED_FIXED_…` recounted
- `work6-historical-limbs-69.mjs` — 62 / 6 / 1; residual `47fd7541…` §3.01 (e)(iii) reported, not resolved
- `work6-parser-ambiguities-23.mjs` — 23 `BEN_APPROVED_NO_UNAFFECTED_PROPOSITION_BLOCK`; overlays created: 0

## Proof

```
CI=true node --test tests/stage-2y-structure-m7-v2-repair-work6.test.js > /tmp/w6-test.log 2>&1
echo $?
# 0; 7 pass, 0 fail
```

Reports are not written against the live superseded registration. They will be generated when `PINS.md` names the successor, or earlier if you want a run against `0e46052b…` as a superseded-id check.

## Next

Touched-rows, ten-agreement (TopBuild separate), additive-three, unfamiliar drafting, family-agreement counts, old-to-new matrix.
