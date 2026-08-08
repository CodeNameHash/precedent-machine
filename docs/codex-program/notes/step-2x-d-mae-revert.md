# Step 2X-D — Revert MAE materiality split

Working note. Appended as work proceeds. Branch: `cursor/step-2x-d-mae-revert-945e`. Worktree: `/tmp/2xd`.

## Decision (Ben, 2026-08-08 — DECISIONS.md entry 14)

MAE is inherently an aggregate concept. The phrase "individually or in the
aggregate" is a drafting variant, not a different legal standard. Revert the
V2 resolver split: that form classifies as `MAT_MAE_QUALIFIED`, same as the
bare form. Supersedes the earlier never-alias ruling for this pair.

Also fix the duplicate-key semantics of `MAT_MAE_AGGREGATE` in `lib/taxonomy.js`
(`UNDISCLOSED_LIABILITIES_EXCEPTION_CODES` vs `MATERIALITY_CODES`).

## Investigation log

Started 2026-08-08.

### Where the V2 split lives

Confirmed: only resolver-side in
`lib/canonical-v2/native-producer/qualifier-kind-lexicon.js`:
- `ACCURACY_CODES` includes `MAT_MAE_AGGREGATE` (~221) with Stage 3 never-alias comment.
- Front door (~931–940): `MAE_QUALIFIER_AGGREGATE_PATTERN` selects AGGREGATE vs QUALIFIED.
- `QUALIFIER_KIND_LEXICON_VERSION = 3` — bump to 4 for this identity-semantics change.
- Producer prompt already removed `MAT_MAE_AGGREGATE` (capitalisation-producer-prompt.js:91).

### Duplicate key in taxonomy.js

- `UNDISCLOSED_LIABILITIES_EXCEPTION_CODES.MAT_MAE_AGGREGATE` (line 105): gloss
  'Would not reasonably be expected to have an MAE' — sibling of MAE / MAE_THRESHOLD /
  MAE_EXCEPTION. Comment at ~87–89 says near-duplicate keys kept so stored claims resolve.
- `MATERIALITY_CODES.MAT_MAE_AGGREGATE` (line 143): 'Would not, individually or in aggregate, have MAE'.

Consumer counts (`lib/ scripts/ pages/ components/ tests/`, `*.{js,mjs,jsx}`):
- Exception-family key `UNDISCLOSED_LIABILITIES_EXCEPTION_CODES:MAT_MAE_AGGREGATE`:
  **2 hits only** — `lib/schema/tags.js` and `lib/schema/tags.generated.js` registry
  entries. No runtime producer/resolver/UI path references it as an exception code
  outside the tag registry. Disposition: **keep the key** as a stored-claim lookup
  alias; document the name collision; leave gloss as the MAE-exception meaning.
- Materiality uses of the bare string `MAT_MAE_AGGREGATE`: edit-schema, parser-v2
  prompt, review UI configs, V1 tests (corpus-stats etc.), lexicon, contract-bundle.
  Those are V1 legacy / the V2 sites this step changes. Do not touch V1 UI/edit path.

### Legacy admissibility (contract-bundle / live-extraction-run)

- V41 widened `REPRESENTATION_ACCURACY_STANDARD` with `MAT_MATERIAL_INLINE` and
  `MAT_MAE_AGGREGATE`. Red Hat r1 ran against **V38** (`run-manifest.json`), so
  AGGREGATE was never an admitted V2 value for that run.
- **Decision: remove `MAT_MAE_AGGREGATE` from V2 allowed values** (edit V41 list in
  place). Reasoning: (a) acceptance is no newly resolved claim carries it;
  (b) lexicon will no longer emit it; (c) producer already does not emit it;
  (d) zero committed `evidence/canonical-v2/**/resolution.json` files contain the
  string; (e) keeping it admissible would preserve a retired drafting-variant code
  as a silent home for any stray value. V1 `MATERIALITY_CODES` entry stays for
  legacy resolution/UI.

### Committed Red Hat r1 vs plan's "11 of 32"

Verified against `evidence/canonical-v2/redhat-representations-20260808-r1/resolution.json`:
- resolved: 13 (all `REP-T-QUALIFIER` knowledge-style — **0** carry `MAT_MAE_AGGREGATE`)
- review_queue: 48; open_world: 32
- File-wide `MAT_MAE_AGGREGATE` count: **0**. `MAT_MAE_QUALIFIED` appears on review
  items as producer `canonical_value` (prompt already collapsed the codes).
- 22 review items contain "individually or in the aggregate". Under **current
  (pre-revert) lexicon**, 13 of those front-door classify as `MAT_MAE_AGGREGATE`;
  9 do not match the whole-quote idiom (longer quotes / affirmative form /
  "material to the Company" variant).
- Finding: the plan's "11 of 32 resolved" is **not** what the committed artefact
  shows. Likely projected post-Stage-3-replay numbers. Re-derive via replay after
  the revert; report before = committed (0 AGGREGATE resolved), after = replay.

### Other evidence runs

`rg -l MAT_MAE_AGGREGATE evidence/canonical-v2 --glob '*.json'`: **0 files**.
No other committed run needs a replay for this code.

## Implementation

### Code changes

1. `qualifier-kind-lexicon.js`: lexicon version 3 → 4; removed `MAT_MAE_AGGREGATE`
   from `ACCURACY_CODES`; front door always returns `MAT_MAE_QUALIFIED`; deleted
   dead `MAE_QUALIFIER_AGGREGATE_PATTERN`; comments cite 2026-08-08 reversal.
2. `lib/taxonomy.js`: documented surviving meanings at both sites; exception key
   kept as lookup alias; materiality entry marked retired for V2.
3. `contract-bundle.js` V41 allowed values: removed `MAT_MAE_AGGREGATE` (keep
   `MAT_MATERIAL_INLINE`); comment records reversal.
4. `canonical-v2-live-extraction-run.mjs`: V41 comment aligned.

### Test edits (justified)

- `canonical-v2-qualifier-kind-lexicon.test.js`: version pin 3→4; Stage 3 MAE
  test now expects `MAT_MAE_QUALIFIED` for aggregate forms (implements the
  ruling, not a blind green); added explicit Step 2X-D pin test that also
  asserts `MAT_MAE_AGGREGATE` is absent from `ACCURACY_CODES`.
- `canonical-v2-p2-qualifier-kinds.test.js`: version pin 3→4 to match module.
- `canonical-v2-capitalisation-producer-prompt.test.js`: **no edit** —
  `MAT_MAE_AGGREGATE` already listed under removed codes; still correct.
- V1 corpus-stats / feature-validation tests: **no edit** (legacy fixtures).

## Red Hat re-derivation

Command:

```
CI=true node scripts/canonical-v2-live-extraction-run.mjs \
  --deal redhat --family REPRESENTATIONS --section-refs 3.01,3.02 \
  --agreement-date 2018-10-28 --no-follow-citations \
  --replay-from-run evidence/canonical-v2/redhat-representations-20260808-r1 \
  --out-dir evidence/canonical-v2/redhat-representations-20260808-2xd-replay
```

Exit 0. Receipt: `model_call_count: 0`, `REPLAY: 2/2 recorded call(s) used`,
`replay.complete: true`, `contract_bundle_version: compileFixtureContractV41`.

| | committed r1 | 2xd-replay |
|---|---|---|
| resolved | 13 | 32 |
| review_queue | 48 | 48 |
| open_world | 32 | 32 |
| `MAT_MAE_AGGREGATE` in resolution.json | **0** | **0** |
| resolved `REPRESENTATION_ACCURACY_STANDARD` = `MAT_MAE_QUALIFIED` | 0 | **13** (all with aggregate phrase in raw_value) |
| resolved `MAT_ALL_MATERIAL` / `MAT_MATERIAL_INLINE` | 0 | 5 / 1 |

**Before (committed):** plan's "11 of 32 resolved carried AGGREGATE" is **false** for
the artefact — r1 ran on V38 before the Stage 3 accuracy front door admitted
these; all aggregate MAE phrases sat in review as `QUALIFIER_KIND_UNCLASSIFIED`
with producer `canonical_value` already `MAT_MAE_QUALIFIED`. Pre-revert lexicon
smoke-test on those review quotes: **13** would have classified as
`MAT_MAE_AGGREGATE`.

**After (replay):** those **13** resolve as `MAT_MAE_QUALIFIED`. Zero newly
resolved claims carry `MAT_MAE_AGGREGATE`. No aggregate-phrase claim that the
idiom door accepts moved to review or open world because of the revert.
Remaining review items with the phrase are non-whole-quote / affirmative /
"material to the Company" shapes still `QUALIFIER_KIND_UNCLASSIFIED` or
disagreement — pre-existing front-door limits, not a regression from 2X-D.
Resolved total 13→32 also includes Stage 3 materiality whitelist hits
(`MAT_ALL_MATERIAL`×5, `MAT_MATERIAL_INLINE`×1) plus the 13 MAE — i.e. the
jump is Stage 3 classification landing under V41, with MAE codes collapsed
per the reversal.

### Other-runs sweep

`rg -l MAT_MAE_AGGREGATE evidence/canonical-v2 --glob '*.json'` → 0 files.
No further replays required.

### Fixture re-pins required by lexicon 3→4

`QUALIFIER_KIND_LEXICON_VERSION` folds into `answer_provenance`, so claim
revision ids and `resolution_receipt_id` move. Regenerated
`tests/fixtures/canonical-v2/f28-third-live-run/resolution.json` by
`resolveCandidates` on the same run-receipt (counts unchanged 3/6/31/1;
lexicon pins 3→4 only). Re-pinned receipt id
`606d2c44b1d6e3ec241041404c4c87c625d9a122bb52275850b4348cc421b209` in
`canonical-v2-lexical-net-wiring.test.js` and
`canonical-v2-v1v2-comparator-wiring.test.js`. Regenerated review-parity
cases via `node scripts/review-parity-build-cases.js` (landos projection
claim_revision_ids moved for the same reason).

### Parallel worktree noise (not this step)

Same worktree also contains uncommitted Step 2X-L artefacts from another
agent (`anthropic-provider.js` limb-path hygiene, `step-2x-l-*.md`,
`redhat-representations-20260808-2xl-replay/`, `canonical-v2-representations-limb-shaper.test.js`).
Left untouched. Baseline regen inevitably inventories `2xl-replay` too.

## Gates

### `CI=true npm test > /tmp/2xd-test.log 2>&1; echo $?`

**Exit 1** (first full run, before fixture re-pins). Summary from log:
`# tests 8301 / # pass 8234 / # fail 22 / # skipped 45`.

Fail classification:
- **2 fixture-pin** (f28 `resolution_receipt_id`) — caused by lexicon 3→4;
  fixed by regenerating fixture + re-pinning (focused re-run: pass).
- **1 parity stale** (`landos-abbvie.projection.json`) — same cause; fixed
  by `review-parity-build-cases.js` (focused re-run: pass).
- **2 login/page** (`/login` 500) — missing `.next` chunks / eslint at first
  build; after `npm run build` succeeded, those tests pass in isolation.
- **17 tmp-root** — `DurableArtifactRootError` / "temporary repository root"
  because this worktree lives under `/tmp/2xd`. Environment limitation of
  the assigned worktree path, not a 2X-D logic defect. Not patched.

Focused after fixes (lexicon + p2 + f28 wiring + parity + capitalisation
prompt): `# tests 130 / # pass 130 / # fail 0`, exit 0.
V1 `corpus-stats-core.test.js`: pass, no edits needed.

### `npm run build > /tmp/2xd-build.log 2>&1; echo $?`

First attempt **exit 1** (eslint not installed in node_modules; page data
collection failed). Cleared `.next`, installed eslint into node_modules only
(**reverted** any `package.json` / lockfile edits — those files are clean).
Second build **exit 0**.

### `bash scripts/lint/forbidden-patterns.sh; echo $?`

**Exit 0** (`INVARIANT-4: PASS`).

### `npm run gate:baseline > /tmp/2xd-baseline.log 2>&1; echo $?`

**Exit 1** before regen (expected). Then
`npm run generate:baseline` → **exit 0**:
`188/214 importable, 25 families, 1654 claims`
(was `67/91 importable, 552 claims`).

`git diff` of `baseline-manifest.json` summary:
- **CHANGED among overlapping runs: 0** (no published-count falls).
- **DISAPPEARED: 0**.
- **NEW: 123** — almost entirely 2026-08-08 fan-out evidence dirs that were
  already on disk but absent from the stale committed manifest on this
  branch, plus `redhat-representations-20260808-2xd-replay` and the foreign
  `…-2xl-replay`.
- Our replay row: `resolved=32`, `review_queue=48`, `open_world=32`,
  `model_call_count=0`, **`importable=false` /
  `import_refusal=PUBLISHABLE_SHORTFALL`**. Diagnosis: baseline script
  imports with hardcoded `compileFixtureContractV38()`; this run was
  resolved under V41. Re-import with V38 publishes 31/32 claims (the
  missing one needs `MAT_MATERIAL_INLINE`); with V41 publishes 32/32.
  Finding about baseline/V38 lag, not about the MAE revert. Committed r1
  (V38-native) remains importable with 13 published claims.

Post-regen `npm run gate:baseline` → **exit 0** (`[baseline] OK`).

### `node scripts/eval.js`

**Exit 1**: `Supabase creds required (env or .env.local).` No credentials
in this environment; not faked.

## Acceptance checklist

- [x] No newly resolved claim carries `MAT_MAE_AGGREGATE` (Red Hat 2xd-replay: 0).
- [x] Aggregate phrase → `MAT_MAE_QUALIFIED` (13 resolved; pin test added).
- [x] Duplicate-key collision documented; exception alias kept (2 registry consumers).
- [x] V2 admission removes retired code; V1 paths untouched.
- [x] Comments cite 2026-08-08 reversal / DECISIONS.md entry 14.
- [x] Gates recorded with exact exits.
