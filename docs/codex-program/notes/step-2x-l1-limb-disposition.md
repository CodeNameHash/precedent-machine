# Step 2X-L1 — Red Hat §3.01+§3.02 limb disposition

Branch: `cursor/step-2x-free-phase-b641`
Closed: 2026-08-08

## Goal

Account for every model-emitted limb on Red Hat REPRESENTATIONS §3.01 and §3.02
(69 inputs), publish the disposition table with unaccounted=0, and regenerate the
stale `*-2xl-replay` evidence so it no longer carries retired `MAT_MAE_AGGREGATE`.

## Commands

### Regenerate 2X-L replay (zero model calls)

```bash
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal redhat \
  --family REPRESENTATIONS \
  --section-refs 3.01,3.02 \
  --agreement-date 2018-10-28 \
  --no-follow-citations \
  --replay-from-run evidence/canonical-v2/redhat-representations-20260808-r1 \
  --out-dir evidence/canonical-v2/redhat-representations-20260808-2xl-replay
```

Exit code: **0**. `model_call_count: 0`; replay `2/2` recorded calls, complete.
Convention: overwrite the existing `*-2xl-replay` directory in place (same as
`*-2xd-replay` for the MAE revert — no new tag directory).

### Post-replay verification

```bash
node -e "
const fs=require('fs');
const p='evidence/canonical-v2/redhat-representations-20260808-2xl-replay/resolution.json';
const n=(fs.readFileSync(p,'utf8').match(/MAT_MAE_AGGREGATE/g)||[]).length;
console.log('MAT_MAE_AGGREGATE count:', n);
"
```

Result: **0** (was 26 before regeneration).

### Recompute disposition table

```bash
node scripts/canonical-v2-redhat-reps-limb-disposition.mjs
```

Reproducible script: `scripts/canonical-v2-redhat-reps-limb-disposition.mjs`
(JSON via `--json`; custom dirs via `--source-run` / `--replay-run`).

## Evidence paths

| artefact | path |
|---|---|
| Source run (recorded responses) | `evidence/canonical-v2/redhat-representations-20260808-r1/` |
| 2X-L replay (disposition + trees) | `evidence/canonical-v2/redhat-representations-20260808-2xl-replay/` |
| MAE-revert sibling replay (no limbs) | `evidence/canonical-v2/redhat-representations-20260808-2xd-replay/` |

Recorded responses: `native-producer-recorded-response-3.01.json`,
`native-producer-recorded-response-3.02.json` in the r1 directory.

## Disposition summary (sums to 69, unaccounted=0)

| disposition | count | reason_code |
|---|---:|---|
| `RESIDUAL_QUOTE_UNVERIFIED` | 1 | `LIMB_ASSERTION_QUOTE_UNVERIFIED` |
| `OPEN_WORLD_ONLY` | 62 | `UNMAPPED_GENERIC_CLAIM_KEY` |
| `OPEN_WORLD_AND_ASSERTION_NODE` | 6 | `UNMAPPED_GENERIC_CLAIM_KEY` |
| **Total** | **69** | |
| unaccounted | **0** | |

Arithmetic: 1 residual + 68 open-world limb candidates = 69. No silent drop.

- **1 residual** — `PROVIDER_EVIDENCE_RESIDUAL` in `adapter-result.json.residuals`:
  §3.01 path `["(e)","(iii)"]`, subject "absence of undisclosed material liabilities".
  Page-break artefact in source (`the Company and its\n10\nSubsidiaries`) prevents
  byte-exact quote verification.
- **68 open-world** — each minted limb claim appears in `resolution.json.open_world`
  with `claim_definition_key: NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE` and
  `reason: UNMAPPED_GENERIC_CLAIM_KEY` (pre-existing design for this key).
- **6 of the 68** also feed `limb_component_trees[].assertion_nodes` (structural
  pre-pass in `candidate-resolution.js`; see below).

Post-replay run receipt (unchanged shape from pre-regeneration):

| measure | value |
|---|---|
| `limb_component_trees` | 2 |
| path nodes | 7 |
| assertion nodes | 6 |
| `resolved` | 32 |
| `open_world` | 100 (= 68 limbs + 20 qualifier OW + 12 proposition OW) |
| `review_queue` | 48 |
| adapter residuals | 1 |
| `MAT_MAE_AGGREGATE` in resolution | 0 |

## Path-hygiene breakdown (all 69 input limbs)

From model `limb_path` via `classifyLimbPathKind` (`anthropic-provider.js`):

| `limb_path_kind` | count |
|---|---:|
| MARKER | 66 |
| DESCRIPTIVE | 3 |
| MIXED | 0 |
| null | 0 |

§3.01: 60 MARKER limbs. §3.02: 6 MARKER + 3 DESCRIPTIVE (descriptive headings
`Corporate power and authority`, `Due authorization`, `Due execution and
enforceability` on the first representation instance).

## Six limbs that also feed assertion nodes

These six are a subset of the 68 open-world limb candidates. Matcher: limb path
+ byte-verified assertion quote (see script).

| section | limb_path | subject (model) |
|---|---|---|
| 3.01 | `["(a)","(i)"]` | corporate organization, valid existence and good standing |
| 3.01 | `["(a)","(ii)"]` | corporate power and authority to conduct business |
| 3.01 | `["(a)","(iii)"]` | foreign qualification and good standing |
| 3.02 | `["Corporate power and authority"]` | Corporate power and authority to execute, consummate and comply |
| 3.02 | `["Due authorization"]` | Due authorization by all necessary corporate action |
| 3.02 | `["Due execution and enforceability"]` | Due execution and enforceability of the Agreement |

Tree 0 (§3.01 first instance): 3 assertion nodes on marker path `(a)/(i–iii)`.
Tree 1 (§3.02 first instance): 3 assertion nodes on the three descriptive headings.
The remaining 62 minted limbs are open-world only — not a silent drop; the
taxonomy has no governed slot for `NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE`
on REPRESENTATIONS.

## Full per-limb disposition table

Generated by `scripts/canonical-v2-redhat-reps-limb-disposition.mjs`:

| # | section | limb_path | path_kind | disposition | reason_code | assertion_node |
|---:|---|---|---|---|---|---|
| 1 | 3.01 | ["(a)","(i)"] | MARKER | OPEN_WORLD_AND_ASSERTION_NODE | UNMAPPED_GENERIC_CLAIM_KEY | yes |
| 2 | 3.01 | ["(a)","(ii)"] | MARKER | OPEN_WORLD_AND_ASSERTION_NODE | UNMAPPED_GENERIC_CLAIM_KEY | yes |
| 3 | 3.01 | ["(a)","(iii)"] | MARKER | OPEN_WORLD_AND_ASSERTION_NODE | UNMAPPED_GENERIC_CLAIM_KEY | yes |
| 4 | 3.01 | ["(b)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 5 | 3.01 | ["(b)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 6 | 3.01 | ["(b)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 7 | 3.01 | ["(c)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 8 | 3.01 | ["(d)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 9 | 3.01 | ["(d)","(iii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 10 | 3.01 | ["(d)","(iv)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 11 | 3.01 | ["(e)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 12 | 3.01 | ["(e)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 13 | 3.01 | ["(e)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 14 | 3.01 | ["(e)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 15 | 3.01 | ["(e)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 16 | 3.01 | ["(e)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 17 | 3.01 | ["(e)","(iii)"] | MARKER | RESIDUAL_QUOTE_UNVERIFIED | LIMB_ASSERTION_QUOTE_UNVERIFIED | no |
| 18 | 3.01 | ["(e)","(iv)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 19 | 3.01 | ["(f)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 20 | 3.01 | ["(f)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 21 | 3.01 | ["(g)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 22 | 3.01 | ["(g)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 23 | 3.01 | ["(h)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 24 | 3.01 | ["(h)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 25 | 3.01 | ["(h)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 26 | 3.01 | ["(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 27 | 3.01 | ["(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 28 | 3.01 | ["(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 29 | 3.01 | ["(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 30 | 3.01 | ["(j)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 31 | 3.01 | ["(j)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 32 | 3.01 | ["(j)","(iii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 33 | 3.01 | ["(k)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 34 | 3.01 | ["(k)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 35 | 3.01 | ["(l)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 36 | 3.01 | ["(l)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 37 | 3.01 | ["(l)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 38 | 3.01 | ["(l)","(iii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 39 | 3.01 | ["(l)","(iv)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 40 | 3.01 | ["(l)","(vi)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 41 | 3.01 | ["(m)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 42 | 3.01 | ["(m)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 43 | 3.01 | ["(m)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 44 | 3.01 | ["(m)","(iii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 45 | 3.01 | ["(n)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 46 | 3.01 | ["(n)","(iii)","(A)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 47 | 3.01 | ["(n)","(iii)","(B)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 48 | 3.01 | ["(o)","(i)","(A)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 49 | 3.01 | ["(o)","(i)","(B)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 50 | 3.01 | ["(o)","(i)","(D)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 51 | 3.01 | ["(o)","(i)","(J)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 52 | 3.01 | ["(o)","(i)","(I)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 53 | 3.01 | ["(p)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 54 | 3.01 | ["(p)","(ii)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 55 | 3.01 | ["(q)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 56 | 3.01 | ["(q)","(i)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 57 | 3.01 | ["(q)","(ii)","(A)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 58 | 3.01 | ["(q)","(ii)","(B)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 59 | 3.01 | ["(q)","(iii)","(A)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 60 | 3.01 | ["(q)","(iii)","(B)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 61 | 3.02 | ["Corporate power and authority"] | DESCRIPTIVE | OPEN_WORLD_AND_ASSERTION_NODE | UNMAPPED_GENERIC_CLAIM_KEY | yes |
| 62 | 3.02 | ["Due authorization"] | DESCRIPTIVE | OPEN_WORLD_AND_ASSERTION_NODE | UNMAPPED_GENERIC_CLAIM_KEY | yes |
| 63 | 3.02 | ["Due execution and enforceability"] | DESCRIPTIVE | OPEN_WORLD_AND_ASSERTION_NODE | UNMAPPED_GENERIC_CLAIM_KEY | yes |
| 64 | 3.02 | ["(A)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 65 | 3.02 | ["(B)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 66 | 3.02 | ["(C)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 67 | 3.02 | ["(A)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 68 | 3.02 | ["(B)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
| 69 | 3.02 | ["(C)"] | MARKER | OPEN_WORLD_ONLY | UNMAPPED_GENERIC_CLAIM_KEY | no |
