# Step 4A2. Give conditional termination fee values a table

Status: done. `canonical_v2_staging.conditional_termination_fee_values` exists,
`public.canonical_v2_write`'s `DEAL_SCOPE_RUN` branch shape-checks it,
recomputes its identity inside the database, and writes it durably. Real
Modiv conditional fee values (6 rows, from
`evidence/canonical-v2/modiv-termination-fee-20260807-replay`) went through
against a local container: 6 in the write-set, 6 rows in the table. The
headline row round-trips byte-identical (canonical form). Three hostile
malformed rows are refused, all with the same shape-naming message. All
three digest guards are updated and green.

Ruled by Ben 2026-08-07 (`docs/core/DECISIONS.md` decision 3): give it a
table. `docs/core/PLAN.md` Step 4A2.

## What this closes

`conditional_termination_fee_values` is a write-set object kind
`lib/canonical-v2/native-producer/conditional-termination-fee-value.js`'s
`buildConditionalTerminationFeeValue` builds
(`CONDITIONAL_TERMINATION_FEE_VALUE/V1`) and
`resolveModivConditionalFees` (`modiv-termination-fee-source-parser.js`)
produces for Modiv's §7.3 formula fee. Before this step it had no table
anywhere in `supabase/canonical-v2-foundation.sql`. Two of the ten cards a
termination-fee run projects come from it
(`lib/canonical-v2/termination-product-projection.js`'s
`conditionalFeeCardSeed`), including the Modiv headline number.

## Shape, taken from the code that builds and would validate it

`buildConditionalTerminationFeeValue`'s `required` array plus `schema_version`
and the id itself gives the frozen 11-key contract:

```
schema_version, fee_side, triggering_branch, base_amount, currency,
operator, reit_limit_cap_term_ref, defined_term_lineage, source_citations,
raw_formula, conditional_termination_fee_value_id
```

`fee_side` is `SELLER`/`BUYER`; `triggering_branch` is one of six literal
Modiv §7.3 citations; `base_amount` matches `^\d+(?:\.\d+)?$`; `currency` is
always `'USD'`; `operator` is always `'LOWER_OF'`; `defined_term_lineage`
and `source_citations` are arrays of at least 2 strings.

**Finding: `lib/canonical-v2/validate-write-set.js` does not know this kind
at all.** `WRITE_SET_KEYS` has no `conditional_termination_fee_values`
entry, and neither does `lib/canonical-v2/canonical-writer.js`'s
`WRITE_ORDER`/`OBJECT_ID_FIELDS`/`DEAL_SCOPE_WRITE_SET_KEYS`. Confirmed with
`grep -rn "conditional_termination_fee_value" lib/canonical-v2/*.js`: zero
matches outside `termination-product-projection.js` (reads it for cards),
`m3-final-sol-adversarial-audit.js` and the two native-producer files that
build/parse it. Nor does `native-write-set-adapter.js` (the module that
turns `resolution` into a `DEAL_SCOPE_RUN` write-set) carry it through — that
wiring is a different, explicitly out-of-scope file (owned by another agent
this task's brief says not to edit). So the JS bridge/writer path never
carries this key today; this step's brief is specifically the SQL side, and
the SQL side is what is proven here. The shape check added to
`canonical_v2_write` below is derived directly from
`buildConditionalTerminationFeeValue`'s own validation, not inferred from a
sibling table, since there is no sibling JS validator to read it from.

## The change

`supabase/canonical-v2-foundation.sql`:

1. **New table** (after `relationship_revisions`):

   ```sql
   CREATE TABLE IF NOT EXISTS canonical_v2_staging.conditional_termination_fee_values (
     conditional_termination_fee_value_id text PRIMARY KEY
       CHECK (conditional_termination_fee_value_id ~ '^[0-9a-f]{64}$'),
     fee_side text NOT NULL CHECK (fee_side IN ('SELLER', 'BUYER')),
     triggering_branch text NOT NULL CHECK (triggering_branch IN (
       '7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)', '7.3(c)'
     )),
     canonical_payload jsonb NOT NULL,
     canonical_payload_digest text GENERATED ALWAYS AS (
       canonical_v2_staging.payload_digest(canonical_payload)
     ) STORED
   );
   ```

   Unlike every sibling per-object-kind table, **this table has no
   `closure_id`** — the JS shape has none, so inventing one would be
   inventing a fact the producer never emits. `ENABLE ROW LEVEL SECURITY`
   added alongside its siblings.

2. **`DEAL_SCOPE_RUN`'s top-level key gate**: `conditional_termination_fee_values`
   added to the OPTIONAL-key subtraction list, next to
   `persisted_object_references` — not the required `?&` list, since most
   deals never produce this kind (same "OMITTED, not an empty array"
   convention `candidate-resolution.js` uses for this field).

3. **A new, self-contained shape + identity + duplicate check**, placed
   after the validated-semantic-graph check and before the closure-keyed
   loops. Two `IF EXISTS` blocks:
   - Shape: `?&`/`- ARRAY[...] = '{}'::jsonb` exact-11-key check (the same
     extra-key-proof pattern Step 4A1's `STRUCTURAL_PROVISION_INSTANCE/V1`
     branch uses), plus every enum/regex/array-length constraint above.
     Identity is recomputed with
     `canonical_v2_staging.content_id('CONDITIONAL_TERMINATION_FEE_VALUE/V1',
     supplied.conditional_fee - 'conditional_termination_fee_value_id')` and
     compared to the supplied id, **guarded by `CASE WHEN shape_valid THEN
     ... ELSE true END`** so `content_id()`/the `-` operator never runs
     against an already-known-malformed (possibly non-object) row. One
     message either way: `'DEAL_SCOPE_RUN conditional termination fee value
     shape is invalid'` — there is no lineage check for this kind (no
     `canonical_text_id`/anchors to check against), so there is nothing to
     distinguish a shape failure from, unlike the provisions branch.
   - Duplicates: a `GROUP BY ... HAVING count(*) > 1` check, message
     `'DEAL_SCOPE_RUN contains duplicate conditional termination fee
     values'`.

4. **Every generic closure-keyed loop in the `DEAL_SCOPE_RUN` branch**
   (persisted-reference overlap ×2, the advisory-lock closure collection,
   duplicate/malformed-object detection ×2, residual/quarantine
   reconciliation ×2 — 9 occurrences of the same
   `'source_references', 'deal', 'persisted_object_references'` exclusion
   literal) **now also excludes `conditional_termination_fee_values`.** This
   kind has no `closure_id`, and those loops assume every collection object
   has one; silently letting it fall into one of them would make that
   loop's own `WHERE` clause evaluate to `NULL` (not `TRUE`) for every
   conditional-fee row — passing vacuously instead of validating anything,
   which is worse than no check because it reads as covered. **One
   exception, deliberately not touched**: the `publishable_object_count`
   sum (`SELECT coalesce(sum(jsonb_array_length(value)), 0) ... WHERE key
   NOT IN ('source_references', 'deal', 'persisted_object_references')`)
   keeps its original three-key exclusion list, because this kind IS a real
   write and must count toward the receipt's `publishableObjectCount` —
   only that one site (uses bare `key`, not `collection.key`, which is how
   the regression test tells the two apart) was left alone.

5. **INSERT loop**, placed after `relationships` and before
   `open_world_candidates`, following the `claim_revisions`/
   `relationship_revisions` pattern exactly (pre-insert digest-conflict
   check, `ON CONFLICT ... DO NOTHING`, post-insert digest re-check), with
   `fee_side`/`triggering_branch` also written to their denormalised
   columns.

## Live proof against a local container

Environment: `docker`/`psql` available; daemon started with
`nohup dockerd > /tmp/dockerd.log 2>&1 &` (same workaround as Step 4A — the
`/etc/init.d/docker` ulimit call is not permitted in this sandbox). Container
`pm-pg` (`postgres:16-alpine`, port 55432) was already running from earlier
work; a fresh database inside it (`pm_step4a2_final`) was used for a clean
apply, following Step 4A's scaffolding convention:

```bash
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d postgres \
  -c "CREATE DATABASE pm_step4a2_final;"
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d pm_step4a2_final \
  -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d pm_step4a2_final \
  -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql
```

Result: **exit 0**, whole 9,000+-line file applied cleanly. The only two
non-DDL lines were the same benign `NOTICE`s Step 4A's own note records
(`pgcrypto` already exists; a legacy `CHECK` constraint that does not exist
on a fresh database).

### The harness

`scripts/canonical-v2-local-conditional-fee-write.js` — a new script, not an
edit to `scripts/canonical-v2-local-durable-write.js` (that file's source-
chain-persistence steps are duplicated rather than imported, since it is not
factored to export them and the brief for this step is not to edit files
outside `supabase/canonical-v2-foundation.sql`, its digest pins, and test
files). It:

1. Persists the source chain (`INTAKE_CAPTURE`, 13×
   `STAGE_SOURCE_ARTIFACT_CHUNK`, `PREPARE_SOURCE_ADMISSION`) exactly as
   Step 4A's harness does — the `DEAL_SCOPE_RUN` branch resolves source
   references against rows already persisted by those three prior calls.
2. Dry-runs `importRunEvidence` against
   `evidence/canonical-v2/modiv-termination-fee-20260807-replay` to get the
   real base write-set (excerpts/provisions/claims/etc.) exactly as the JS
   bridge would build it.
3. Reads the run's own `resolution.json#conditional_termination_fee_values`
   (the real 6 rows `resolveModivConditionalFees` produced) and splices them
   onto the base write-set as `conditional_termination_fee_values` — this is
   the one place this script does something the production JS bridge does
   not do today, because that wiring lives in `native-write-set-adapter.js`,
   which this step does not touch.
4. Computes a fresh, correct `inputDigest`/receipt over the combined
   write-set with `buildCanonicalWriteInputDigest`/`contentId` — the same
   schema-agnostic helpers the real writer uses internally, not a shortcut.
   `public.canonical_v2_write` only ever compares `p_input_digest`/
   `p_receipt` against `p_write_set` content (recomputing
   `CANONICAL_WRITE_INPUT/V2`'s content id and checking it, then
   `CANONICAL_WRITE_RECEIPT/V1`'s), so this is a faithful proof of the SQL
   side, not a bypass of it.
5. Calls `public.canonical_v2_write` and reports both counts, both receipt
   ids, and a headline round trip.

### Run

```bash
node scripts/canonical-v2-local-conditional-fee-write.js \
  evidence/canonical-v2/modiv-termination-fee-20260807-replay \
  postgres://postgres:postgres@localhost:55432/pm_step4a2_final
```

Full output (trimmed to the load-bearing parts):

```
--- SQL writer (public.canonical_v2_write), DEAL_SCOPE_RUN ---
{
  "status": "COMMITTED",
  "replayed": false,
  "receiptId": "fce4e261b6bac9ea682e8e18e14391131f7c51c4fbdd273b604158ed326e66f5",
  "publishableObjectCount": 19,
  ...
}

--- Verification ---
{
  "conditional_termination_fee_values_in_write_set": 6,
  "conditional_termination_fee_values_row_count": 6,
  "counts_match": true,
  "js_receipt_id": "fce4e261b6bac9ea682e8e18e14391131f7c51c4fbdd273b604158ed326e66f5",
  "sql_receipt_id": "fce4e261b6bac9ea682e8e18e14391131f7c51c4fbdd273b604158ed326e66f5",
  "receipt_ids_match": true,
  "headline_conditional_termination_fee_value_id": "e76d73adc20f35c77cc09dfc0a0c6a4843d49dfdda44b1583d809dab42a24561",
  "headline_base_amount": "10000000",
  "headline_stored_canonical_payload_digest": "18203fa5cfe754309b88c8c9499c99eb913f0348b8a8867dfdae3588623e4f1c",
  "headline_round_trip_canonical_bytes_identical": true
}
```

**The two counts asked for: 6 in the write-set, 6 rows in the table.**
Verified again from a fresh connection after the script exited (durable, not
an artefact of the same session):

```sql
SELECT count(*) FROM canonical_v2_staging.conditional_termination_fee_values;
--  6
```

**Receipt identities match exactly** — the JS-side receipt this script
computed and the SQL function's independently-recomputed
`content_id('CANONICAL_WRITE_RECEIPT/V1', ...)` are the same 64-hex string,
the same proof Step 4A's own durable write produced for the base run.

### The headline round trip

The Modiv headline is the SELLER-side Company Termination Fee for the
lowest-numbered branch, `7.3(b)(i)` — `$10,000,000`, capped by the REIT
Requirements. Read back by its own id from a **fresh connection**:

```sql
SELECT canonical_payload, canonical_payload_digest
FROM canonical_v2_staging.conditional_termination_fee_values
WHERE conditional_termination_fee_value_id =
  'e76d73adc20f35c77cc09dfc0a0c6a4843d49dfdda44b1583d809dab42a24561';
```

**A naive `JSON.stringify(dbRow) === JSON.stringify(jsRow)` comparison
reports a false mismatch** — the first run of this script's verification
step did exactly that and printed `false`, even though the row was
untouched. `jsonb`'s text output does not preserve input key order (Postgres
stores object keys by an internal length/lexicographic order and prints them
back that way, not in insertion order); this is documented `jsonb` behaviour,
not a defect. The codebase's own notion of "identical" is the canonical form
`lib/canonical-v2/canonical-bytes.js`'s `canonicalJson`/`content_id` use
(sorted keys, ASCII-safe) — the same form `canonical_v2_staging.payload_digest`
hashes. Comparing on that canonical form: **`true`**, byte-identical. Both
the raw formula text (with its curly-quote `"REIT Requirements"`) and every
other field, including `base_amount: "10000000"`, survive untouched.

## Hostile tests

Four probes, run against the same `pm_step4a2_final` database, reusing the
real committed run's base write-set (source chain + real
excerpts/provisions/claims) with only `conditional_termination_fee_values`
swapped, each under its own idempotency key so none of them replay a prior
result:

| Probe | Row | Result |
|---|---|---|
| Control | well-formed, one extra probe-only row | **ACCEPTED**, `COMMITTED` |
| Extra key | control row + `garbage_field` | **REJECTED**: `DEAL_SCOPE_RUN conditional termination fee value shape is invalid` |
| Missing key | control row, `raw_formula` dropped | **REJECTED**: same message |
| Wrong enum | control row, `currency: 'GBP'` | **REJECTED**: same message |
| Duplicate id | two identical rows in one array | **REJECTED**: `DEAL_SCOPE_RUN contains duplicate conditional termination fee values` |

The control accepting proves the four rejections are about the malformed
field each one changes, not some other envelope mismatch the probe also
happens to trip. All three shape-hostile messages **name the shape**
(`... shape is invalid`), not any lineage — this kind has no lineage check
to misdirect toward, unlike the provisions branch Step 4A1 fixed.

## Digest guards, all three updated

1. **`scripts/canonical-v2-staging-schema.mjs`** —
   `EXPECTED_DIGESTS['canonical-v2-foundation.sql']` repinned from
   `0bbff084...e83a` to `3f72f34c...ec50` (whole-file sha256). Not directly
   exercised by any test in this repository (it requires a real linked
   Supabase project), but kept correct for the day it is.

2. **`scripts/canonical-v2-optiona-authority-partition.mjs`** — the
   `canonical_v2_write` function-body digest repinned from
   `94539982...ad784` to `ea375cd4...e808a28`. Verified before repinning
   that the extracted statement contains `conditional_termination_fee_values`,
   both new messages, and — unchanged — Step 4A1's `STRUCTURAL_PROVISION_
   INSTANCE` branch and its `'DEAL_SCOPE_RUN provision shape is invalid'`
   message. Regenerated the governed extract:

   ```bash
   node scripts/canonical-v2-optiona-authority-partition.mjs --write
   # Wrote 5 Option A authority-partition files.
   node scripts/canonical-v2-optiona-authority-partition.mjs --check
   # Verified 5 Option A authority-partition files.
   ```

   `tests/canonical-v2-optiona-authority-partition.test.js`: **pass** (this
   is the test that runs `--check` and recomputes every embedded governed
   digest).

3. **`scripts/canonical-v2-staging-writer-structure-identity.mjs`** —
   inspected for pinned strings this change could collide with. It requires
   a real linked Supabase project (`createCanonicalV2StagingRuntime`,
   `--linked`) and is not executable here; its own test
   (`tests/canonical-v2-staging-writer-structure-identity-runner.test.js`)
   is a static pattern-match against the `.mjs` file's own source, unrelated
   to this change. **Nothing in this step required editing it**: every new
   check added is reached only when `conditional_termination_fee_values` is
   present in the write-set, which none of that script's existing probes
   ever supply (its `COLLECTIONS` constant does not name this key) — so
   every existing probe's behaviour, including every exact error message it
   pins, is unchanged.

## Targeted test runs (not the full suite)

```
node --test tests/canonical-v2-writer-conditional-termination-fee-shape-sql.test.js
# tests 9, pass 9, fail 0        (new regression test, this step)

CI=true node --test \
  tests/canonical-v2-optiona-authority-partition.test.js \
  tests/canonical-v2-staging-schema-runner.test.js \
  tests/canonical-v2-staging-writer-structure-identity-runner.test.js \
  tests/canonical-v2-writer-provision-shape-branch-sql.test.js \
  tests/canonical-v2-sql-identity-pins.test.js
# tests 16, pass 16, fail 0      (all three digest guards + Step 4A1 regression)

CI=true node --test \
  tests/canonical-v2-writer-source-admission-identity-sql.test.js \
  tests/canonical-v2-writer-structure-identity-sql.test.js \
  tests/canonical-v2-writer-relationship-identity-sql.test.js \
  tests/canonical-v2-deal-scope-sql-writer.test.js \
  tests/canonical-v2-agreement-writer-sql-native-validator.test.js \
  tests/canonical-v2-definition-occurrence-sql.test.js \
  tests/canonical-v2-writer-object-integrity-sql.test.js \
  tests/canonical-v2-writer-semantic-graph-identity-sql.test.js \
  tests/canonical-v2-canonical-writer.test.js \
  tests/canonical-v2-writer-object-identity-sql.test.js \
  tests/canonical-v2-writer-claim-identity-sql.test.js \
  tests/canonical-v2-write-envelope.test.js \
  tests/canonical-v2-writer-envelope-integrity-sql.test.js \
  tests/canonical-v2-writer-excerpt-identity-sql.test.js \
  tests/canonical-v2-source-admission-sql-writer.test.js \
  tests/canonical-v2-intake-sql-writer.test.js
# tests 90, pass 90, fail 0      (every other SQL-writer test file that reads
                                  # supabase/canonical-v2-foundation.sql)
```

`bash scripts/lint/forbidden-patterns.sh`: `INVARIANT-4: PASS`, exit 0.

Full `npm test`/`npm run build` were **not** run, per this step's explicit
instruction (targeted only).

## What this does not do

- Does not wire `conditional_termination_fee_values` into
  `native-write-set-adapter.js`'s production write-set — that file is owned
  by another agent, and the SQL side working ahead of it is the point (the
  schema must be ready before the adapter starts sending it real data, not
  the other way round).
- Does not add `conditional_termination_fee_values` to
  `lib/canonical-v2/validate-write-set.js` or `canonical-writer.js`'s
  `DEAL_SCOPE_WRITE_SET_KEYS`. Neither file recognises this kind today,
  which is why the harness above computes its own input digest/receipt
  rather than calling the real `writer.write()` with this key spliced in —
  that call would be rejected by `assertResolvedWriteSetShape`'s exact
  key-set check. This is a real, currently-true gap, not a decision made
  today: whoever wires the adapter next will need to widen that key set too,
  or `DEAL_SCOPE_RUN` calls through the ordinary JS path will keep silently
  dropping this field.
- Does not support `conditional_termination_fee_values` in the
  `persisted_object_references` replay mechanism (no `closure_id` to key it
  by). Not required by this step's acceptance criteria, and consistent with
  the kind's own JS shape.
