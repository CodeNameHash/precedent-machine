# Step 2X-L — REPRESENTATIONS limb-assertion minting

Branch: `cursor/step-2x-free-phase-945e`
Started: 2026-08-08

## Goal

The REPRESENTATIONS model prompt already returns `limbs` on each
`representation_instances[]` entry, but `shapeRepresentationQualifierProposals`
discards them. Mint limb-assertion claim proposals from those limbs
(additive only; qualifier/open-world identities byte-identical), prove via
replay, and sweep other families for the same gap.

## Progress log

### 2026-08-08 — kickoff

- Verified on branch `cursor/step-2x-free-phase-945e`.
- Creating this note before code changes.
- Next: read `shapeRepresentationQualifierProposals`, `shapeRepresentationInstance`
  limb block, replay script header, existing tests for style.

### 2026-08-08 — code read

- Confirmed: `shapeRepresentationQualifierProposals` (~3300) only walks
  `instance.qualifiers` + `parsed.open_world_candidates`.
- Limb minting template is `shapeRepresentationInstance` (~743–776):
  `LIMB_ASSERTION_CLAIM_KEY` (= `NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE`),
  `proposal_kind: 'GOVERNED'`, subject `kind: 'REPRESENTATION_INSTANCE'`,
  residual `LIMB_ASSERTION_QUOTE_UNVERIFIED`.
- Resolver groups `LIMB_ASSERTION_CLAIM_KEY` + capitalisation `QUALIFIER_CLAIM_KEY`
  by `subject_occurrence_id` and calls `mintLimbComponentTree` — REPRESENTATIONS
  qualifiers use a different key, so trees will build from limb claims alone.
- Red Hat recorded limbs: §3.01 = 60 MARKER; §3.02 = 6 MARKER + 3 DESCRIPTIVE
  (total 69). No MIXED in this evidence.
- Replay naming convention: `*-20260807-replay` / plan suggests
  `redhat-representations-20260808-2xl-replay`.
- Only `representations-producer-prompt.js` and `capitalisation-producer-prompt.js`
  put a top-level `limbs` array in RESPONSE_SHAPE. MAE has `limb_path` on
  carveout assertions (different structure). Full sweep table TBD after
  reading each shaper.

### 2026-08-08 — implementation

Changed `lib/canonical-v2/native-producer/anthropic-provider.js`:

- Added `isOutlineMarkerLabel` / `classifyLimbPathKind` (MARKER / DESCRIPTIVE
  / MIXED / null). Never coerces descriptive headings into markers.
- Added `shapeRepresentationLimbAssertionProposals` — same mechanics as
  `shapeRepresentationInstance`'s limb block, plus `limb_path_kind` on
  attributes and `allowed_attributes`.
- Extended `shapeRepresentationQualifierProposals` to mint limbs first,
  then existing qualifier loop (unchanged), then open-world. Qualifier key
  remains `NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE`.
- Did **not** touch `shapeRepresentationInstance` / CAPITALISATION path.
- Did **not** touch `subclauses.js`, `limb-components.js`, or
  `candidate-resolution.js`.
- Unit tests: `tests/canonical-v2-representations-limb-shaper.test.js` (6 pass).

### Path-hygiene design

Model `limb_path` values mix outline markers (`["(a)","(i)"]`) and
descriptive headings (`["Corporate power and authority"]`). For every limb
claim minted on the REPRESENTATIONS path only:

| `limb_path_kind` | rule |
|---|---|
| `MARKER` | every element matches `^\((letter\|roman\|digit)\)$` |
| `DESCRIPTIVE` | no element is a marker |
| `MIXED` | some are, some aren't |
| `null` | empty / missing path |

Carried as an attribute + listed in `allowed_attributes`. CAPITALISATION
path untouched so its committed trees stay byte-identical.

### Other-families sweep

Checked every `FAMILY_RESPONSE_SHAPERS` entry: producer prompt RESPONSE_SHAPE
for a `limbs` array (or equivalent), shaper **code** for `.limbs` / calls that
read limbs, and one recorded `raw_response_text` where an evidence dir exists.
Receipts are not evidence of model output.

| family | prompt asks for limbs? | shaper reads them? | recorded responses contain them? | verdict |
|---|---|---|---|---|
| `CAPITALISATION` | yes (`limbs[]`) | yes (`shapeProposals` → `shapeRepresentationInstance`) | yes (`modiv-capitalisation-20260806`) | OK |
| `REPRESENTATIONS` | yes (`limbs[]`) | yes (this change) | yes (`redhat-representations-20260808-r1`, also concho) | OK (was GAP; fixed here) |
| `TERMINATION_FEE` | no (has `limb_amount_quote` on fee amounts — different shape) | no | no (`concho-termination-fee-20260808-r1`) | n/a — not the limbs[] gap |
| `MAE_DEFINITION` | no (has `limb_path` on carveout/disproportionality arrays, not `limbs[]`) | no | no (`concho-mae-definition-20260808-r1`) | n/a for this gap; PLAN 2X-I correctly notes MAE needs a prompt change to emit limbs |
| `NO_SHOP` | no | no | no | n/a |
| `TERMINATION` | no | no | no | n/a |
| `MATERIAL_CONTRACTS` | no | no | no | n/a |
| `NO_OTHER_REPS_FRAUD` | no | no | no | n/a |
| `GENERAL_COVENANTS` | no | no | no | n/a |
| `INTERIM_OPERATING` | no | no | no | n/a |
| `CLOSING_CONDITIONS` | no | no | no | n/a |
| `PROXY_MEETING` | no | no | no | n/a |
| `ANTITRUST_REGULATORY` | no | no | n/a (raw unparseable in checked concho dir) | n/a |
| `MERGER_STRUCTURE_CLOSING` | no | no | no | n/a |
| `CONSIDERATION` | no | no | no | n/a |
| `FINANCING_COVENANTS` | no | no | no | n/a |
| `GUARANTY_FINANCING_PARTY` | no | no | no | n/a |
| `EMPLOYEE_MATTERS` | no | no | no | n/a |
| `DNO_INDEMNIFICATION` | no | no | no | n/a |
| `TAX_MATTERS` | no | no | no | n/a |
| `DIVIDENDS` | no | no | no | n/a |
| `APPRAISAL_DISSENTERS_RIGHTS` | no | no | no | n/a |
| `SPECIFIC_PERFORMANCE_REMEDIES` | no | no | no | n/a |
| `MISC_BOILERPLATE` | no | no | no | n/a |
| `KEY_DEFINED_TERMS` | no | no | no | n/a |

**Sweep conclusion:** the only family with the same gap (prompt asks for
`limbs[]`, shaper discarded them) was REPRESENTATIONS. CAPITALISATION already
minted. No other family prompts for a `limbs` array today.

### 2026-08-08 — replay proof

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

Exit code: **0**

- `model_call_count: 0` (manifest); replay `2/2` recorded calls, complete.
- `limb_component_trees`: **2** (was 0 on the original r1 run). Tree 0:
  path_nodes/assertion_nodes populated; tree 1 likewise. Resolver needed
  no change — limb claims under `LIMB_ASSERTION_CLAIM_KEY` flowed through
  the existing `mintLimbComponentTree` pre-pass.
- Original r1 compiled limb-assertion claims: **0**. Replay: **68**.

#### Reconciliation arithmetic

Model limbs in `raw_response_text`: 60 (§3.01) + 9 (§3.02) = **69**.

| | count |
|---|---|
| Minted limb-assertion proposals | 68 |
| Byte-verification drops (`LIMB_ASSERTION_QUOTE_UNVERIFIED`) | 1 |
| Total | **69** |

Path kinds on minted claims: MARKER 65, DESCRIPTIVE 3 (matches the three
§3.02 descriptive headings; the one drop was a MARKER path).

#### Drop itemised

1. **Section 3.01**, path `["(e)","(iii)"]`, subject "absence of undisclosed
   material liabilities".
   - Quote: `the Company and its Subsidiaries have no material liabilities or obligations of any nature (whether accrued, absolute, contingent or otherwise) that would be required by GAAP to be reflected or reserved against on a consolidated balance sheet (or notes thereto) of the Company and its Subsidiaries`
   - Reason: `LIMB_ASSERTION_QUOTE_UNVERIFIED` — source text inserts a
     page-break artefact between "its" and "Subsidiaries"
     (`the Company and its\n10\nSubsidiaries`), so the model's continuous
     quote is not a byte-exact span. Correct drop; not papered over.

### Resolver verification (no code change)

`candidate-resolution.js` already groups `LIMB_ASSERTION_CLAIM_KEY` (+
capitalisation `QUALIFIER_CLAIM_KEY`) by `subject_occurrence_id` and calls
`mintLimbComponentTree`. REPRESENTATIONS qualifier proposals use a different
key, so trees build from limb claims alone. Confirmed on replay:
`limb_component_trees.length === 2` (non-empty). All 68 limb claims also land
in `open_world` as `UNMAPPED_GENERIC_CLAIM_KEY` (pre-existing design for this
key — not a regression).

Note: only groups whose `party_making` resolves via `resolveParty` mint a
provision/tree, and the first group to claim a provision's tree wins
(`limbTreesByProvisionId.has` guard). So tree assertion-node count (6 across
2 trees) is smaller than 68 minted limbs. That is pre-existing resolver
behaviour; not modified here (blocked files). Acceptance is non-empty trees
+ mint reconciliation, both met.

Open-world count vs original r1: 32 → 100 (= +68 limbs). Review queue stayed
48. Resolved 13 → 32 on this replay (trees / current branch resolver, not
shaper identity reminting — qualifier claim keys unchanged).

### Interference note

During this session the shell cwd briefly drifted into `/tmp/2xd` (another
agent's worktree). `anthropic-provider.js` was observed reverted once;
restored from `/tmp/2xl-anthropic-provider.js` backup. All gates below were
re-run from `/workspace` after restoring. Do not trust results produced while
cwd was `/tmp/2xd`.

### Gates

#### 1. Unit / full suite

```bash
CI=true npm test > /tmp/2xl-test-workspace.log 2>&1; echo $?
```

Exit: **0**. Log: `# tests 8306` / `# pass 8261` / `# fail 0` / `# skipped 45`.
(Includes `tests/canonical-v2-representations-limb-shaper.test.js`, 6/6.)

#### 2. Build

```bash
npm run build > /tmp/2xl-build-workspace.log 2>&1; echo $?
```

Exit: **0**.

#### 3. Forbidden patterns

```bash
bash scripts/lint/forbidden-patterns.sh; echo $?
```

Exit: **0** (`INVARIANT-4: PASS`).

#### 4. Baseline gate + regenerate

```bash
npm run gate:baseline > /tmp/2xl-baseline.log 2>&1; echo $?
```

Exit: **1** (expected — manifest stale vs evidence on disk, including this
step's new replay dir and many other NEW runs already present on the branch).

```bash
npm run generate:baseline > /tmp/2xl-baseline-gen.log 2>&1; echo $?
```

Exit: **0**. Wrote `188/213 importable, 25 families, 1654 claims`.

##### Baseline manifest diff summary

`git diff evidence/canonical-v2/baseline-manifest.json` (before → after
generate):

| field | before | after |
|---|---|---|
| `run_count` | 91 | 213 |
| `importable_run_count` | 67 | 188 |
| `totals.claims` | 552 | 1654 |
| `totals.provisions` | 217 | 662 |
| `totals.excerpts` | 1125 | 4496 |
| `totals.components` | 39 | 115 |

- **Added runs:** 122 (none removed).
- **Changed existing runs (count fields):** **0**. No previously listed run
  had resolved / open_world / review_queue / residuals fall or rise.
- **Falls:** none.
- This step's artefact: `redhat-representations-20260808-2xl-replay` added —
  `resolved=32`, `review_queue=48`, `open_world=100`, `model_call_count=0`,
  `importable=false` (`PUBLISHABLE_SHORTFALL` — adapter publishable shortfall;
  trees present, but write-set publishable path still short).
- Sibling `redhat-representations-20260808-r1` also newly listed (was on disk, not in the
  old 91-run manifest): `resolved=13`, `open_world=32`, `review_queue=48`,
  importable with 13 published claims.
- Pre-existing Modiv REPRESENTATIONS entries (`modiv-representations-20260806`,
  `modiv-representations-20260807-replay`) **unchanged** — baseline digests committed
  artefacts, it does not re-shape them through new code.

Most of the +122 adds are four-deal evidence dirs already on this branch
(concho/metsera/redhat/skechers/skywater/topbuild), not produced by 2X-L.
2X-L's own addition is the `*-2xl-replay` directory.

#### 5. Golden eval

```bash
node scripts/eval.js
```

Exit: **1**. Exact error: `Supabase creds required (env or .env.local).`
No live DB / credentials in this environment — recorded, not faked.

### Files touched (working tree, uncommitted)

- `lib/canonical-v2/native-producer/anthropic-provider.js` — limb minting +
  path hygiene on REPRESENTATIONS shaper; header updated.
- `tests/canonical-v2-representations-limb-shaper.test.js` — new.
- `evidence/canonical-v2/redhat-representations-20260808-2xl-replay/` — new replay proof.
- `evidence/canonical-v2/baseline-manifest.json` — regenerated.
- `docs/codex-program/notes/step-2x-l-representations-limbs.md` — this note.

Not modified (as required): `subclauses.js`, `limb-components.js`,
`candidate-resolution.js`, CAPITALISATION `shapeRepresentationInstance`.

