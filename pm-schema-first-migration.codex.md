# WP-SCHEMA — Schema-first feature model migration (Codex desktop app, self-contained)

You are Codex, running inside the Codex desktop app on Ben's Mac against
the `precedent-machine` repo. This brief is fully self-contained. Read it
top to bottom before touching code. Every phase includes discovery,
implementation, tests, and a self-audit. Any phase that fails its
verify gate STOPS the whole migration.

Ben has authorized ambitious scope, deep-tree edits, and recursive/
analytical work across the 19-deal corpus. This brief is written to be
executed WITHOUT further human input beyond one authorization
checkpoint before the destructive delete phase (Phase 8).

## Why we're doing this (context)

The extraction stack has SIX separate places that each hold a partial
vocabulary of the same underlying concept ("what does a merger
agreement have in it"):

- `lib/rubric.js` — 4,904 lines, 465 distinct `key:` entries
- `lib/taxonomy.js` — 1,277 lines, uses `code:` (different vocab)
- `lib/feature-validation.js` — enforces rubric shapes at write
- `lib/expected-sets.js` — declares required feature bundles
- `lib/category-summary-features.js` — declares which keys the
  category summary table pulls (237 keys, some drifted from rubric)
- `components/review/table-logic.js`, `components/review/shared.js`,
  `pages/review/[id].js` — hand-coded per-key rendering

Symptoms of drift (from Codex's audit brief):
- `[object Object]` renders where a scalar was expected
- Raw enum leakage (`QUORUM_ABSENT`, `INSUFFICIENT_VOTES`) reaching UI
- 1,987 dash placeholders across 19 review pages
- 216 duplicated provision-label groups
- `Not specified` used ambiguously (17 occurrences) — no signal
  whether the doc is silent, extraction missed, or field is N/A
- 83 recurrences of `Other Provisions`

**Goal:** one canonical registry that drives extraction, validation,
storage, and UI. Adding a new legal field = adding one registry entry,
not editing five files.

## Ground rules for the whole migration

- **Read before you write.** Every phase begins with a Discovery step
  that runs grep/scripts and writes findings to a phase log file. Do
  not skip Discovery, ever. Do not write assertions against assumed
  shapes.
- **Corpus-safety diff.** Any change that touches extractor logic must
  run against all 19 deals in dry-run and produce a diff of before-vs-
  after provision counts, feature counts, and unverified-quote counts.
  Diff must be ≤ intended change surface. No silent data drift.
- **QA gate.** `node scripts/ingest-qa.js --all` must be 19/19 PASS,
  0 unverified quotes, 0 duplicates, at the end of every code-writing
  phase. If it fails, STOP.
- **Verbatim quote discipline** (existing invariant, unchanged): no
  fabricated legal text; silence = "Silent"/"Not defined"; corrections
  rows for any verbatim repair.
- **Branch → PR → CI → squash merge.** Never push `main`. One PR per
  phase. Base every branch off `origin/main` at the start of the
  phase.
- **Repo:** `/Users/bengoodchild/Documents/Claude/precedent-machine`
- **`.env.local`** must have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  Never print values. Verify with:
  `grep -qE '^SUPABASE_URL=..+' .env.local && grep -qE '^SUPABASE_SERVICE_ROLE_KEY=..+' .env.local`
- **Worktree convention:**
  `git worktree add -b <branch> .claude/worktrees/wp-schema-<slug> origin/main`
  then `cd .claude/worktrees/wp-schema-<slug>`
- **Dirty-state allow-list on root repo** (leave alone): `.DS_Store`,
  `M HANDOFF.md`, `D node_modules`, `?? .claude/worktrees/`, `?? docs/`
- **Do not touch design tokens, globals.css, or tailwind config**
  unless a specific phase says so explicitly.
- **Phase gate on failure:** commit whatever partial diagnostic work
  is worth keeping as `wip/<phase-slug>`, push, and STOP the whole
  migration. Print a plain-English summary of what failed.

## Deliverable-set summary (skim before you dive)

Phase 1 — Discovery + Inventory (no code changes)
Phase 2 — Design registry schema types + write empty registry
Phase 3 — Populate registry from Phase 1 inventory (generated + audited)
Phase 4 — Zod validation replaces feature-validation.js
Phase 5 — Prompt generation from schema
Phase 6 — UI renderers switch to schema lookups
Phase 7 — Empty-state normalization (`Not applicable`, `Silent`, etc.)
Phase 8 — Delete/adapt the old vocabularies (destructive; needs
           authorization checkpoint at start)
Phase 9 — Cross-deal parity self-audit + benchmark readiness report

Estimated diff size: ~4,500 lines added, ~2,000 lines deleted net (the
old vocabularies collapse into one). Test count expected to grow by
~120 tests.

────────────────────────────────────────────────────────────────────────
# PHASE 1 — Discovery + Inventory (no code changes)

**Branch:** `chore/schema-first-p1-inventory`

## Objective

Produce a machine-readable inventory of every feature key currently in
use, where it lives, how it's shaped, and how it renders. This
inventory is the source data for Phase 3's registry population.

## Steps

1. Create the branch, worktree, and phase log:
   ```bash
   git worktree add -b chore/schema-first-p1-inventory \
     .claude/worktrees/wp-schema-p1 origin/main
   cd .claude/worktrees/wp-schema-p1
   mkdir -p docs/schema-migration
   ```

2. Write `scripts/schema-inventory.js` — a Node script that:
   - Loads `lib/rubric.js` and enumerates:
     - Every PROVISION_TYPE entry (key, label, mode, party)
     - Every code in the CODES map (type, label, description, aliases,
       frequency, industries)
     - Every FEATURES entry keyed by `[type]` and `[type][code]`
       (feature key, label, type, options, citable, requiredEvidence,
       any other declared attributes)
   - Loads `lib/taxonomy.js` and enumerates every canonical code map
     (EXCEPTION_CODES, MATERIALITY_QUALIFIERS, EFFORTS_STANDARDS,
     CONSENT_STANDARDS, MAE_CARVEOUTS, etc.).
   - Loads `lib/expected-sets.js` and enumerates every declared
     required-feature bundle.
   - Loads `lib/category-summary-features.js` and enumerates every
     row's `keys[]` list, tagging each key with the type it appears
     under.
   - Grep the UI files (`components/review/*.js`, `pages/review/*.js`)
     for string literals matching feature keys (any key from any of
     the sources above); record every hit with file:line.
   - For each unique feature key, produce a row:
     ```
     {
       key: "terminationFeePercentEquityValue",
       source_appearances: {
         rubric_js: { types: ["TERMR"], codes: ["TERMR-B-FEE"], line: 3814 },
         expected_sets_js: { bundles: ["TERMR-B-FEE"], line: 87 },
         category_summary_features_js: { types: ["TERMR"], line: 44 },
         feature_validation_js: { validated: true },
         ui: [
           { file: "components/review/table-logic.js", line: 812 },
           { file: "pages/review/[id].js", line: 4402 }
         ]
       },
       declared_type: "number",
       declared_options: null,
       declared_unit: null,  // derived from key suffix if 'Percent'/'Months'/'Days'
       benchmarkable_hint: true  // has 'Percent'/'Months'/'Days' suffix OR is enum
     }
     ```
   - Write output as newline-delimited JSON to
     `docs/schema-migration/inventory.jsonl`.
   - Also write a summary Markdown to
     `docs/schema-migration/inventory-summary.md` with counts:
     total distinct keys, keys in ≥2 sources, keys in only 1 source
     (orphans — likely dead code or drift), keys that mismatch on
     declared_type across sources, keys whose name suggests a unit
     but no unit is declared.

3. Run the script; confirm outputs exist and are non-empty:
   ```bash
   node scripts/schema-inventory.js
   test -s docs/schema-migration/inventory.jsonl
   test -s docs/schema-migration/inventory-summary.md
   ```

4. Manually spot-check the summary. Ensure:
   - Total distinct keys is in the 400-600 range (was 465 in rubric
     alone at measurement time; the union will be slightly larger).
   - At least 10-30 keys are flagged as "cross-source mismatch" — this
     is expected. Zero mismatches means the inventory script is broken.
   - Orphan count is meaningful (dead code exists).

5. Write `docs/schema-migration/phase-1-findings.md` summarizing:
   - How many keys exist in the union
   - How many have shape mismatches
   - How many are orphans in one file (candidates for deletion)
   - Naming-convention distribution (camelCase vs snake_case vs
     mixed) — Phase 3 will canonicalize to ONE convention (pick
     camelCase to minimize storage-key churn since existing JSONB
     `features` already uses camelCase).
   - Top 20 highest-appearance keys (the ones benchmarks will use)
   - Any key patterns that suggest a MISSING feature (e.g. references
     to `terminationFeePercentDealValue` in UI but not in rubric)

## Verify gate

- `docs/schema-migration/inventory.jsonl` exists, non-empty
- `docs/schema-migration/inventory-summary.md` exists, non-empty
- `docs/schema-migration/phase-1-findings.md` exists, non-empty
- `npm test` still passes (this phase changed no runtime code)

## Commit + PR

```bash
git add scripts/schema-inventory.js docs/schema-migration/
git commit -m "chore(schema): P1 — feature-key inventory and drift audit"
git push -u origin chore/schema-first-p1-inventory
gh pr create --repo CodeNameHash/precedent-machine \
  --base main \
  --head chore/schema-first-p1-inventory \
  --title "WP-SCHEMA P1: feature inventory and drift audit" \
  --body-file docs/schema-migration/phase-1-findings.md
```

**Phase gate:** if the inventory script fails to run, if any of the
three doc files is empty, or if `npm test` regresses, STOP.

────────────────────────────────────────────────────────────────────────
# PHASE 2 — Design registry types + write empty registry

**Branch:** `feat/schema-first-p2-registry-skeleton`

## Objective

Introduce `lib/schema/` with the type contract for features and tags,
plus an empty registry that Phase 3 will populate. This phase adds
files but does not wire them into runtime code yet — no risk of
regression.

## Files to create

```
lib/schema/
├── README.md                   # narrative overview
├── types.js                    # JSDoc typedefs / Zod schemas
├── features.js                 # feature registry (starts empty)
├── tags.js                     # tag registry (starts empty)
├── formatters.js               # display formatters keyed by unit/type
├── empty-policy.js             # empty-state semantics
└── index.js                    # public entry point
```

Also add `tests/schema/registry-shape.test.js` and
`tests/schema/formatters.test.js`.

## Type design

A **Feature** entry represents a structured field extracted from a
provision. Shape:

```
/**
 * @typedef {Object} FeatureDef
 * @property {string} key                Canonical camelCase identifier
 *                                       (e.g. "terminationFeePercentEquityValue").
 *                                       Unique across the whole registry.
 * @property {string} label              Lawyer-facing label
 *                                       (e.g. "Termination fee (% equity value)").
 * @property {string} description        One-sentence explanation of what
 *                                       this field captures.
 * @property {'number'|'string'|'enum'|'boolean'|'object'|'list'|'quote'} valueType
 * @property {?string} unit              For number types: 'percent',
 *                                       'usd', 'days', 'months',
 *                                       'business_days', 'calendar_days',
 *                                       'multiplier', null.
 * @property {?string[]} enumSet         For enum types: allowed values.
 * @property {?Object} objectShape       For object types: nested field
 *                                       definitions (recursive FeatureDef).
 * @property {?string} listItemType      For list types: 'string' | 'object'
 *                                       | 'tag' (tag = a canonical Tag key).
 * @property {?string} listItemTagFamily For list-of-tag: which Tag family
 *                                       ('EXCEPTION_CODES', 'MAE_CARVEOUTS',
 *                                       etc.).
 * @property {string[]} provisionTypes   Which top-level provision types
 *                                       this feature can appear on
 *                                       (e.g. ['TERMR', 'TERMB']).
 * @property {?string[]} provisionCodes  Optional narrower codes.
 * @property {'always'|'often'|'sometimes'|'rare'|'conditional'} presence
 * @property {?Object} presenceCondition Structured condition when
 *                                       presence is 'conditional' (e.g.
 *                                       { dealStructure: 'TWO_STEP_TENDER_OFFER' }).
 * @property {boolean} requiredEvidence  If true, must have citable quote.
 * @property {boolean} citable           Alias/legacy — true if renderer
 *                                       should offer a "see text" affordance.
 * @property {string} displayGroup       UI grouping (e.g. 'Termination',
 *                                       'Deal certainty', 'Fiduciary out',
 *                                       'Structure', 'Consideration').
 *                                       Drives Codex-brief "core questions"
 *                                       reorganization of review page.
 * @property {number} displayOrder       Ordering within displayGroup.
 * @property {boolean} benchmarkable     True if cross-deal comparable.
 * @property {?string} benchmarkFamily   Groups benchmarkable features
 *                                       (e.g. 'termination_economics',
 *                                       'deal_certainty').
 * @property {?number} benchmarkMinN     Minimum sample size for showing
 *                                       distribution stats (default 10).
 * @property {?'buyer'|'seller'|'neutral'|'contextual'} favorabilityDirection
 *                                       For scoring layer (WP-SCORE): which
 *                                       side a HIGH numeric value or a
 *                                       specific enum value favors. 'contextual'
 *                                       means direction depends on other
 *                                       feature values (e.g. reverse fee
 *                                       favors target only if paired with a
 *                                       financing-out). null = not part of
 *                                       scoring at all. This field is used
 *                                       ONLY by an optional overlay; never
 *                                       blend into primary data render.
 * @property {?number} favorabilityWeight 0-5 integer. 0 = ignored in
 *                                       aggregate score, 5 = high-impact
 *                                       marquee field. Default 0. Weights
 *                                       are versioned separately from schema
 *                                       (lib/schema/favorability-weights.js)
 *                                       so the scoring rules can iterate
 *                                       without a schema migration.
 * @property {?Object} favorabilityRule   Structured rule for how a value
 *                                       maps to a buyer/seller signed score.
 *                                       Shape depends on valueType — see
 *                                       WP-SCORE for the rule grammar.
 *                                       Only present when direction != null.
 * @property {'not_applicable'|'silent'|'extraction_pending'|'needs_review'} whenEmpty
 *                                       Semantic empty state — no more
 *                                       "Not specified" / dashes.
 * @property {boolean} stableAnchor      If true, this feature contributes
 *                                       to provision-identity hashing
 *                                       (for anchor-stable IDs across
 *                                       re-extract). Only set on values
 *                                       that don't wobble between runs.
 * @property {?string[]} aliases         Alternative keys the extractor
 *                                       or old data might have used;
 *                                       used by the compatibility shim.
 * @property {?string} formatter         Display formatter name from
 *                                       formatters.js (e.g.
 *                                       'percent1dp', 'usd_short',
 *                                       'months_int', 'enum_titlecase').
 * @property {?Function} validator       Optional custom Zod refinement.
 * @property {?string} extractionPrompt  Human-readable extractor
 *                                       instruction inserted into LLM
 *                                       prompt (Phase 5).
 * @property {?string} exampleValue      One-line example for prompt.
 */
```

A **Tag** entry (the current taxonomy):

```
/**
 * @typedef {Object} TagDef
 * @property {string} code               Canonical UPPER_SNAKE (e.g.
 *                                       'WHOLLY_OWNED_SUB').
 * @property {string} family             'EXCEPTION_CODES',
 *                                       'MATERIALITY_QUALIFIERS',
 *                                       'EFFORTS_STANDARDS',
 *                                       'CONSENT_STANDARDS',
 *                                       'MAE_CARVEOUTS',
 *                                       'VOTE_FAILURE_MODES', etc.
 * @property {string} label              Market-readable label.
 * @property {string} description
 * @property {string[]} appearsOn        Feature keys whose listItemType='tag'
 *                                       accept this tag.
 * @property {?string[]} aliases         Alt string forms for
 *                                       backward-compat mapping.
 * @property {boolean} benchmarkable     True if the tag itself is a
 *                                       comparable market metric.
 */
```

## `formatters.js` responsibilities

Named formatters that take (value, ctx) and return a display string:

- `percent1dp` — `0.0125` → `"1.3%"`
- `percent2dp` — `0.01234` → `"1.23%"`
- `usd_short` — `1250000000` → `"$1.25B"`
- `usd_long` — `1250000000` → `"$1,250,000,000"`
- `months_int` — `9` → `"9 months"`
- `days_int` — `45` → `"45 days"` (unit-aware for business_days)
- `enum_titlecase` — `"QUORUM_ABSENT"` → `"Quorum failure"` (mapped)
- `enum_verbatim` — passthrough
- `deadline_object` — `{days:60,unit:'business_days',trigger:'signing'}`
                      → `"60 business days from signing"`
- `tender_basis` — `{basis:'FULLY_DILUTED',thresholdPct:80}`
                   → `"80% of fully-diluted shares"`
- `quote` — verbatim block, escaped

Each formatter is pure, tested, and referenced by name from a Feature's
`formatter` field.

## `empty-policy.js` responsibilities

Exports one function `renderEmpty(feature)`:
- `whenEmpty === 'not_applicable'` → return "N/A" span with tooltip
  "This field does not apply to this deal structure."
- `whenEmpty === 'silent'` → return "Silent" span with tooltip
  "The agreement is silent on this point."
- `whenEmpty === 'extraction_pending'` → return "Extraction pending"
  chip with a re-extract action link.
- `whenEmpty === 'needs_review'` → return "Needs review" chip in
  amber with a link to the annotation panel.

No more dashes. No more "Not specified".

## Registry entry-points

`lib/schema/features.js` (starts empty, populated in Phase 3):
```
const FEATURES = {
  // Populated in Phase 3
};
module.exports = { FEATURES };
```

`lib/schema/tags.js` (starts empty, populated in Phase 3):
```
const TAGS = {
  // Populated in Phase 3
};
module.exports = { TAGS };
```

`lib/schema/index.js`:
```
const { FEATURES } = require('./features');
const { TAGS } = require('./tags');
const formatters = require('./formatters');
const { renderEmpty } = require('./empty-policy');

function getFeature(key) { ... }
function getFeaturesForType(type) { ... }   // replaces rubric.getFeaturesForType
function getFeaturesForCode(type, code) { ... }
function getTag(code, family) { ... }
function getTagsForFamily(family) { ... }
function renderFeatureValue(featureKey, value, ctx) { ... }
function renderTag(code, family) { ... }

module.exports = {
  FEATURES, TAGS,
  getFeature, getFeaturesForType, getFeaturesForCode,
  getTag, getTagsForFamily,
  renderFeatureValue, renderTag,
  renderEmpty,
  formatters,
};
```

## Tests

`tests/schema/registry-shape.test.js`:
- Registry loads without throwing
- Every FeatureDef passes a Zod validation of its own shape
- Every TagDef passes a Zod validation of its own shape
- No two features share a key (uniqueness)
- No two tags share (family, code) (uniqueness within family)
- Every feature.provisionTypes entry is a valid PROVISION_TYPES key
  (cross-check against rubric.js — this is the last dependency; will
  be inverted in Phase 8)
- Every feature with valueType='enum' has non-empty enumSet
- Every feature with listItemType='tag' has a valid listItemTagFamily
  present in TAGS

`tests/schema/formatters.test.js`: unit-test every formatter with 3-5
representative inputs each.

## Verify gate

- `npm test` — all pass (existing suite plus new schema tests)
- No file outside `lib/schema/`, `tests/schema/`, and
  `docs/schema-migration/` was modified

## Commit + PR

```bash
git add lib/schema/ tests/schema/ docs/schema-migration/phase-2-notes.md
git commit -m "feat(schema): P2 — registry types, formatters, empty-policy"
git push -u origin feat/schema-first-p2-registry-skeleton
gh pr create --repo CodeNameHash/precedent-machine \
  --base main \
  --head feat/schema-first-p2-registry-skeleton \
  --title "WP-SCHEMA P2: schema registry types + empty-policy" \
  --body-file docs/schema-migration/phase-2-notes.md
```

────────────────────────────────────────────────────────────────────────
# PHASE 3 — Populate registry from Phase 1 inventory

**Branch:** `feat/schema-first-p3-populate-registry`

## Objective

Fill `lib/schema/features.js` and `lib/schema/tags.js` with entries
generated from the Phase 1 inventory, then hand-audit and enrich.

This is the most laborious phase. It's OK for it to take many hours.
The output is a canonical registry of ~400-500 features and ~150 tags.

## Steps

1. Rebase Phase 1 and 2 into this branch (they should have merged
   already; if not, base off `origin/main` after they merge).

2. Write `scripts/generate-registry.js`:
   - Reads `docs/schema-migration/inventory.jsonl` (regenerate first
     if stale)
   - For each unique feature key, emits a `FeatureDef` skeleton with:
     - `key` — original camelCase
     - `label` — derived from best available (rubric > category-summary
       > humanize(key))
     - `description` — "TODO: describe" placeholder (auditor fills in)
     - `valueType` — derived from rubric declared type; if conflict
       across sources, pick rubric's and add a `_conflict` comment
     - `unit` — inferred from key suffix:
       * `*Percent*` → 'percent'
       * `*Months` → 'months'
       * `*Days` → 'days' (default; sub-inferred to business/calendar
         if key contains 'business'/'calendar')
       * `*Multiplier` → 'multiplier'
       * `*Amount` / `*Value` / `*Usd` → 'usd'
       * else null
     - `enumSet` — copied from rubric declared options if present
     - `provisionTypes` — union of types across sources
     - `presence` — 'often' default (auditor may downgrade)
     - `requiredEvidence` — copied from rubric.citable if present, else
       true if feature is text/quote/object, else false
     - `citable` — copied from rubric
     - `displayGroup` — heuristic from provisionTypes[0]:
       * TERMR/TERMB → 'Termination'
       * NOSOL → 'Fiduciary out'
       * ANTI → 'Regulatory'
       * COND-* → 'Deal certainty'
       * STRUCT → 'Structure'
       * CONSID → 'Consideration'
       * REP-T/REP-B → 'Representations'
       * IOC → 'Interim covenants'
       * else → 'Other'
     - `displayOrder` — index in the current
       category-summary-features.js row order; 999 if not present
     - `benchmarkable` — true if valueType is number/enum with clear
       comparability, else false (auditor overrides)
     - `benchmarkFamily` — derived from displayGroup, lowercase snake
     - `whenEmpty` — 'silent' default; auditor overrides to N/A for
       fields that are structurally absent on some deal types (e.g.
       tender-offer fields on one-step deals)
     - `stableAnchor` — false default; auditor sets true for
       identity-contributing fields
     - `aliases` — populated with any variant names found in the
       inventory
     - `formatter` — derived from unit+valueType (percent1dp, months_int,
       usd_short, enum_titlecase, quote, deadline_object)
     - `extractionPrompt` — pulled from rubric's `label`+`description`
       for now; Phase 5 will refine
     - `exampleValue` — TODO
   - Emits the generated map to `lib/schema/features.generated.js`.
   - Same treatment for tags → `lib/schema/tags.generated.js`.

3. Run `node scripts/generate-registry.js`. Sanity-check the outputs.

4. **Manual audit pass.** Copy `.generated.js` into `features.js` and
   `tags.js`, then walk through each entry:
   - Fill in `description` (one sentence lawyer-facing)
   - Confirm `benchmarkable` — err toward false unless clearly
     cross-deal meaningful
   - Confirm `whenEmpty` — critical for the "Not specified" cleanup;
     for each field, decide: is silence semantically meaningful
     (`silent`), does it not apply on some deals (`not_applicable`),
     or is empty a data bug (`extraction_pending`)?
   - Confirm `stableAnchor` — set true only for fields that don't
     move across re-extract (e.g. `sectionNumber`, canonical code,
     provision type). This is what future stable-identity work will
     hash.
   - Merge obvious duplicates (e.g. `outsideDate` and
     `outsideDateMonths` might be the same field expressed two ways
     — keep one, put the other in `aliases`)
   - Kill obvious orphans (keys with only 1 source appearance and no
     data in Supabase — verify via query below)

   Orphan verification query (run once, save output):
   ```bash
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config({ path: '.env.local' });
   const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
   const ORPHANS = [/* paste list of suspected-orphan keys */];
   (async () => {
     for (const k of ORPHANS) {
       const { count } = await s.from('provisions')
         .select('id', { count: 'exact', head: true })
         .not(\`features->\${k}\`, 'is', null);
       console.log(k, count);
     }
   })();
   " > docs/schema-migration/orphan-check.txt
   ```
   A key with 0 provisions using it AND only 1 source appearance is a
   safe delete. Log each deletion decision in
   `docs/schema-migration/deletions.md` with the source lines removed.

5. Cross-reference against the codebase to CATCH MISSING FEATURES:
   - The Codex audit brief called out features that hit UI but might
     not be schema'd (raw enums, `Not specified` fallbacks).
   - For each `Not specified` occurrence found in review-page audits,
     grep back to find which feature produced it. Ensure that feature
     has a real entry with `whenEmpty` set semantically.

6. Add integration tests that catch schema drift:
   - `tests/schema/coverage.test.js`: every feature key present in
     any live provision row's `features` JSONB must appear in
     FEATURES. This test QUERIES SUPABASE (guarded by env var; skip
     if not available). It's the ongoing regression detector.

   ```js
   // Skeleton
   const { FEATURES } = require('../../lib/schema');
   const supabase = require('../../lib/supabase').service();
   test('every live feature key is in the schema registry', async (t) => {
     if (!process.env.SUPABASE_URL) { t.skip('no supabase'); return; }
     const { data } = await supabase.rpc('sql', {
       q: `SELECT jsonb_object_keys(features) AS k, count(*) FROM provisions GROUP BY 1`
     });
     const registryKeys = new Set(Object.keys(FEATURES));
     const missing = data.filter(r => !registryKeys.has(r.k));
     assert.deepEqual(missing, [], `Live keys missing from registry: ${JSON.stringify(missing)}`);
   });
   ```
   If your Supabase JS client doesn't support raw SQL, use a
   materialized query via `pages/api/schema-coverage.js` or a
   dedicated helper.

## Verify gate

- Every existing test still passes
- New coverage test passes (or skips cleanly with no supabase)
- Registry shape test passes with populated registry
- Row count sanity: FEATURES has 350-550 entries, TAGS has 100-200
- `docs/schema-migration/orphan-check.txt` exists
- `docs/schema-migration/deletions.md` exists (may be empty if none
  deleted, but the file must exist as an audit trail)

## Commit + PR

```bash
git add lib/schema/ scripts/generate-registry.js tests/schema/ docs/schema-migration/
git commit -m "feat(schema): P3 — populate registry from inventory, hand-audit"
git push -u origin feat/schema-first-p3-populate-registry
gh pr create --repo CodeNameHash/precedent-machine \
  --base main \
  --head feat/schema-first-p3-populate-registry \
  --title "WP-SCHEMA P3: populated feature + tag registry" \
  --body-file docs/schema-migration/phase-3-notes.md
```

────────────────────────────────────────────────────────────────────────
# PHASE 4 — Zod validation replaces feature-validation.js

**Branch:** `feat/schema-first-p4-zod-validation`

## Objective

Replace the imperative shape checks in `lib/feature-validation.js`
with declarative Zod schemas derived from the FeatureDef entries. Wire
into the store layer so malformed feature bags are rejected (or
flagged) at write time using ONE canonical source.

## Steps

1. Add zod as a dep if not present: `npm install zod --save`.
2. In `lib/schema/validation.js`, export:
   - `buildValidatorForFeature(featureDef)` → Zod schema
   - `buildValidatorForProvision(type, code)` → Zod schema for the
     whole `features` JSONB shape for that provision
   - `validateFeatures(type, code, features)` → returns
     `{ ok: boolean, errors: [{path, message, severity}], warnings: [] }`
   - Severity model unchanged: `error` for shape breaks, `warn` for
     drift. Enforcement stays FLAG, not reject (matches current
     policy — driving to zero errors gates future rejection).
3. Update `lib/parser-v2/store.js` write path to call
   `validateFeatures` and stamp the result into `ai_metadata.validation`
   (existing behavior). Old `feature-validation.js` becomes a thin
   adapter that just delegates for backward compat with API-route
   callers; will be deleted in Phase 8.
4. Add per-feature tests: for each of the TOP 30 most-used features
   (by row count), a positive test (valid shape passes) and a
   negative test (each invalid shape family produces the right error).
   The generator can produce most of these mechanically from
   FeatureDef.
5. Run the corpus dry-run: `node scripts/ingest-qa.js --all` — must
   still be 19/19 PASS. If any deal now shows new validation errors,
   that means the Phase 3 audit missed something — go back to Phase 3
   and fix the registry.

## Verify gate

- `npm test` — all pass
- `node scripts/ingest-qa.js --all` — 19/19 PASS
- Validation error rate across the 19 deals is ≤ current
  `feature-validation.js` error rate (parity check)

## Commit + PR

Standard shape.

────────────────────────────────────────────────────────────────────────
# PHASE 5 — Prompt generation from schema

**Branch:** `feat/schema-first-p5-prompt-gen`

## Objective

Currently `lib/parser-v2/extract.js` hand-writes the "what to extract"
sections of each LLM prompt with per-type/per-code JS. This means
adding a new field requires editing extract.js. Migrate to
schema-driven prompt generation: `renderExtractionPrompt(type, code)`
walks the schema and emits the prompt block.

## Steps

1. In `lib/schema/prompt.js`, export `renderExtractionPrompt(type, code,
   ctx)`:
   - Walks FEATURES for the (type, code) pair
   - Emits a Markdown block per feature: label, description, expected
     valueType, unit, enumSet if any, exampleValue, requiredEvidence
     flag
   - Groups by displayGroup for readability
   - Includes the shared "verbatim quote" instructions when
     requiredEvidence is true anywhere in the block
2. Refactor `extract.js` per-type prompt builders to call
   `renderExtractionPrompt`. Keep the imperative helpers for
   type-specific quirks (backfills, roman-suffix handling) — those
   are extraction LOGIC, not prompt content.
3. For each of the 12 provision types, run a before/after prompt-diff:
   - Old prompt (hand-written) vs new (schema-rendered)
   - Diffs should be READABILITY-only (formatting, ordering,
     wording); content should be the same set of fields
   - If a field appears in old-but-not-new, the schema is missing
     that field — go back to Phase 3 and add it
   - If a field appears in new-but-not-old, decide: is it a genuine
     new field that Phase 3 correctly added, or a spurious inclusion?
4. **Corpus safety-diff.** Run extractor against all 19 deals in
   dry-run mode BEFORE and AFTER Phase 5. Diff:
   - `pre-phase5-extract.jsonl` vs `post-phase5-extract.jsonl`
   - Any change in provision counts, feature counts, or quote counts
     is a red flag. Expected diff: near-zero (prompt reformatting is
     not supposed to change extraction). If diff is significant,
     tune the prompt template until parity is restored.
5. Add `tests/schema/prompt-parity.test.js` — for each of a few
   representative fixture docs, assert that the schema-rendered
   prompt produces the same extracted features as a snapshot from
   the old prompt (within a tolerance for LLM stochasticity — but
   ideally with a deterministic stub client the tolerance is 0).

## Verify gate

- All existing tests pass
- Prompt parity test passes
- Corpus safety-diff: ≤ 1% change in provision counts, ≤ 2% change
  in feature counts, 0 change in unverified-quote counts

## Commit + PR

Standard shape.

────────────────────────────────────────────────────────────────────────
# PHASE 6 — UI renderers switch to schema lookups

**Branch:** `feat/schema-first-p6-ui-renderers`

## Objective

Kill per-key rendering in the UI. Every renderer becomes a call to
`renderFeatureValue(featureKey, value, ctx)` from
`lib/schema/index.js`. `category-summary-features.js` becomes a thin
adapter that reads `displayGroup` + `displayOrder` from the registry.

## Steps

1. Read every UI file that hand-renders feature values. Enumerate:
   - `components/review/table-logic.js` (1,478 lines) — main renderer
   - `components/review/shared.js` (798 lines)
   - `components/review/EditPanel.js` (1,333 lines)
   - `components/review/ConsiderationTables.js` (914 lines)
   - `pages/review/[id].js` (11,501 lines) — largest single file
   - `components/review/TermCell.js`, `SecMeetingTable.js`, etc.

2. For each per-key `if`/`switch` branch, replace with a call to
   `renderFeatureValue`. Preserve special-case UI (e.g., custom
   NOSOL 4-column table) but source the VALUES from the registry.

3. Delete `lib/category-summary-features.js` at the end of this phase.
   Callers should read `getFeaturesForType(type).filter(f =>
   f.displayGroup === X).sort(displayOrder)`.

4. Adopt Codex's audit-brief reorganization of review page around
   "core questions":
   - Structure
   - Consideration
   - Deal certainty
   - Fiduciary out
   - Termination
   - Risk allocation
   - Unusual terms
   These are exactly `displayGroup` values. The main review page
   walks displayGroups in this order, each rendering its features.

5. Kill dashes / raw objects / `Not specified`. Every render call
   that receives an empty value routes through `renderEmpty(feature)`.

6. Add `tests/ui/render-smoke.test.js` that FAILS on any of these
   tokens appearing in rendered HTML:
   - `[object Object]`
   - `null` (as a rendered string)
   - `undefined` (as a rendered string)
   - `NaN`
   - Raw UPPER_SNAKE enum values like `QUORUM_ABSENT` (regex:
     `/\b[A-Z][A-Z_]{5,}\b/` scoped to text nodes, with an allowlist
     for legitimate legal codes like `HSR`)
   - Plain em-dash placeholders `—` where a value is expected
     (allowlist for typographic use)
   - `Not specified` (banned by policy)

   This test renders each of the 19 review pages via a Puppeteer or
   Playwright headless run against a local Next dev server, or against
   Vercel preview. Match up with the Codex audit brief's smoke-test
   recommendation.

## Verify gate

- `npm test` — all pass
- Render smoke test passes on all 19 deals
- Manual spot-check of the top 5 review pages (Metsera, Verve,
  Skechers, Prometheus, Cooper Tire)

## Commit + PR

Standard shape.

────────────────────────────────────────────────────────────────────────
# PHASE 7 — Empty-state normalization

**Branch:** `feat/schema-first-p7-empty-state`

## Objective

Complete the empty-state migration Codex called for. Every field's
"missing" case renders semantically, sourced from `whenEmpty`.

## Steps

1. Audit every FeatureDef's `whenEmpty` setting against the LIVE data
   in Supabase. For each feature, query:
   ```
   SELECT deal_id, COUNT(*)
   FROM provisions
   WHERE (features->>'<feature.key>') IS NULL
     AND provision_type = '<feature.provisionTypes[0]>'
   GROUP BY deal_id;
   ```
   For each empty case, decide:
   - Empty on ALL deals (structurally absent) → `not_applicable`
     (with a `presenceCondition` that would make it apply)
   - Empty on SOME deals matching a structural pattern → same
   - Empty on random deals → likely `extraction_pending` (data bug)
   - Empty because the doc is silent → `silent`
   - Empty and we don't know why → `needs_review`
2. Update the review page render to show these states with the
   correct visual affordance (`renderEmpty(feature)` from
   `empty-policy.js`).
3. Add a "needs review" queue view (small, no design overhaul):
   `pages/review/[id]/needs-review.js` lists every field with
   `whenEmpty === 'needs_review'` and empty on this deal, so lawyers
   can triage.
4. Add a corpus-wide dashboard endpoint `pages/api/schema-coverage.js`
   returning per-feature: total, populated, silent, N/A,
   extraction_pending, needs_review counts. This is the metric that
   will drive future extraction-quality work.

## Verify gate

- `npm test` passes
- Zero renders of `Not specified` in the smoke test
- Zero renders of dash placeholder for a feature whose `whenEmpty`
  is `silent` or `not_applicable` (they use their own affordance)
- Schema-coverage API returns valid JSON for at least 3 feature keys

## Commit + PR

Standard shape.

────────────────────────────────────────────────────────────────────────
# PHASE 8 — Delete old vocabularies (DESTRUCTIVE — checkpoint)

**Branch:** `refactor/schema-first-p8-delete-old-sources`

## Objective

Cleanup phase. Delete `lib/feature-validation.js` (already an adapter
after P4), `lib/expected-sets.js` (functionality absorbed into
FeatureDef.presence), `lib/category-summary-features.js` (deleted in
P6), and collapse `lib/rubric.js` into just PROVISION_TYPES + CODES
metadata (features move fully into `lib/schema/features.js`) and
`lib/taxonomy.js` into just legacy backward-compat exports if any
external tests still need them.

## ⚠ Authorization checkpoint

Before starting Phase 8, print to Ben (via a plain-English summary):
- Diff size of proposed deletion
- List of files being removed or shrunk
- Count of live tests that import from the removed paths (should be 0
  after Phases 4-7 — verify via `grep -rn 'require.*feature-validation\|require.*expected-sets\|require.*category-summary-features' lib/ pages/ components/ tests/`)
- Confirm: "Proceed with destructive cleanup?" — WAIT for Ben's
  explicit "yes" before any `rm` or shrinking edit.

## Steps

1. Verify no active importers:
   ```bash
   grep -rn "require.*feature-validation\|require.*expected-sets\|require.*category-summary-features" \
     lib/ pages/ components/ tests/ scripts/
   ```
   Expect: zero hits. If any remain, migrate the caller BEFORE
   deleting.
2. Move the parts of `lib/rubric.js` that ARE NOT features
   (PROVISION_TYPES, CODES metadata) into `lib/schema/provisions.js`.
   Feature portions of rubric are already duplicated in
   `lib/schema/features.js` — delete them from rubric.
3. Move the parts of `lib/taxonomy.js` that were tags into
   `lib/schema/tags.js` (already done in Phase 3) — delete
   taxonomy.js entirely, or reduce to a backward-compat re-export.
4. Rewrite imports across the codebase:
   ```bash
   grep -rn "require.*rubric\|require.*taxonomy" lib/ pages/ components/ tests/ scripts/
   ```
   Migrate each to import from `lib/schema/index.js`.
5. Run FULL test suite + corpus QA gate.

## Verify gate

- Explicit Ben authorization received
- `npm test` — all pass
- `node scripts/ingest-qa.js --all` — 19/19 PASS
- Grep confirms zero remaining references to deleted files
- Net line count reduction ≥ 3,000 lines across `lib/`

## Commit + PR

Standard shape.

────────────────────────────────────────────────────────────────────────
# PHASE 9 — Cross-deal parity self-audit + benchmark readiness

**Branch:** `chore/schema-first-p9-self-audit`

## Objective

Self-audit that proves the migration was value-neutral (no silent
data loss) and produces the benchmark-readiness report.

## Steps

1. Re-run the corpus extractor against all 19 deals in dry-run.
   Compare against the pre-Phase-1 snapshot (which the very first
   step of Phase 1 should have captured — go back and add that if
   missing).
   - Total provisions per deal: expected ≤ 1% variance
   - Total feature values per deal: expected ≤ 2% variance
   - Unverified quote count: 0 → 0
   - Duplicates: 0 → 0
2. **Benchmark readiness report.** For every feature with
   `benchmarkable: true`, query the corpus and produce:
   - Sample size (deals with a populated value)
   - Data-quality proxies: how many silent, how many N/A, how many
     needs_review
   - Simple distribution: min/median/max for numeric, mode for enum
   - Whether it meets `benchmarkMinN` (default 10)
   Save to `docs/schema-migration/benchmark-readiness.md`.
3. **Feature-page audit.** Regenerate the review-page audit that
   Codex ran earlier (dash placeholders count, raw-object count,
   `Not specified` count, duplicated provision-label groups). All of
   these numbers should be materially lower than the pre-migration
   baseline:
   - dash placeholders: 1,987 → target < 200
   - `Not specified`: 17 → target 0
   - `[object Object]`: present → target 0
   - Raw enum leakage: present → target 0
   - Duplicated provision-label groups: 216 → target < 50 (some
     legitimate duplication remains)
4. Write `docs/schema-migration/COMPLETION.md` with:
   - Overall net line diff
   - Feature-registry stats
   - Corpus safety-diff summary
   - Benchmark-readiness summary
   - Remaining follow-ups (each becomes a future WP)

## Verify gate

- All parity metrics within tolerance
- Benchmark-readiness report exists and shows at least 10 features
  meeting benchmarkMinN
- Review-page audit metrics all below targets

## Commit + PR

Standard shape.

────────────────────────────────────────────────────────────────────────
# Finish

Print a plain-English summary Ben can read:
- Phases completed (PR numbers + URLs)
- Total line delta
- Feature registry size (features count, tags count)
- Corpus parity result (before/after variance)
- Benchmark-readiness summary (features meeting min N)
- Review-page audit deltas (dash placeholders, Not specified, etc.)
- Follow-ups recommended

No sentinel format required — this is interactive Codex work.
