# Step 4A3. Carry conditional fee values into the write-set

Status: done. `native-write-set-adapter.js` now carries
`resolution.conditional_termination_fee_values` into a real `DEAL_SCOPE_RUN`
write set, `validate-write-set.js` validates its shape/identity/duplicates
and publishes it, and `canonical-writer.js`'s own DEAL_SCOPE_RUN shape gate
was widened to accept the key too (a necessary follow-up Step 4A2's own note
named, not part of the two files this step's brief names as owned -- see
"What else had to change" below). A real extraction run's own adapter
output -- not a hand-built harness input -- went through the real bridge
path into `public.canonical_v2_write` against a local container: 6 rows in
the write-set, 6 rows in the table, JS/SQL receipt identities matching, the
Modiv headline round-tripping byte-identical.

Found and disclosed by Step 4A2 itself (`docs/codex-program/notes/
step-4a2-conditional-fee-table.md`, "What this does not do"). `docs/core/
PLAN.md` Step 4A3.

## What this closes

Before this step, `conditional_termination_fee_values` had a table
(`canonical_v2_staging.conditional_termination_fee_values`, Step 4A2) and a
SQL shape check, but the JS side never sent it data:
`native-write-set-adapter.js` and `validate-write-set.js` had zero
references to the kind, confirmed by grep, while
`termination-product-projection.js:736` reads
`resolution.conditional_termination_fee_values` for two of the ten cards a
termination-fee run projects (including the Modiv headline number) and
`resolveModivConditionalFees` (`modiv-termination-fee-source-parser.js`)
produces it. So the resolver produced the values, the projection consumed
them, and the write-set never carried them -- "the database can hold the
headline number", not "the headline number reaches the database".

## The change

### `lib/canonical-v2/native-producer/native-write-set-adapter.js`

Added one pass to `buildNativeWriteSet`, alongside the existing citation-
relationship and open-world passes:

```js
const conditionalTerminationFeeValues = resolutionProvided
  && Array.isArray(resolution.conditional_termination_fee_values)
  ? resolution.conditional_termination_fee_values
  : [];
```

...spliced into the write set only when non-empty:

```js
...(conditionalTerminationFeeValues.length > 0
  ? { conditional_termination_fee_values: conditionalTerminationFeeValues }
  : {}),
```

**Unlike every other collection this module builds, this pass does no
coordinate shifting.** `resolveModivConditionalFees` already builds each row
as a closed, content-addressed `CONDITIONAL_TERMINATION_FEE_VALUE/V1` object
via `buildConditionalTerminationFeeValue`
(`conditional-termination-fee-value.js`), with `source_citations` as
verbatim clause-reference strings -- never excerpt ids, never a
section-local offset. There is nothing for `shiftEdge`/`excerptFor` to touch,
so the rows are carried through unchanged, the same "strictly additive,
absent without a `resolution` context" rule the open-world/component-row/
citation-relationship passes already follow.

**Omitted, not an empty array, when absent or empty** -- mirrors
`candidate-resolution.js`'s own "OMITTED entirely" choice for this exact
field (`resolveCandidates`'s return statement), and matches
`persisted_object_references`'s independently-optional top-level key
treatment in both validators below and in
`supabase/canonical-v2-foundation.sql`'s Step 4A2 OPTIONAL-key subtraction
list. `counts.conditional_termination_fee_values_written` added alongside
the existing open-world counts, and the header/`EMPTY_COLLECTION_KEYS`
comments updated to say so, per this programme's "update the header in the
same change" rule.

### `lib/canonical-v2/validate-write-set.js`

1. **`CONDITIONAL_TERMINATION_FEE_VALUE_KEYS`** (the frozen 11-key contract)
   plus `CONDITIONAL_TERMINATION_FEE_VALUE_SIDES`/`_BRANCHES`, read directly
   from `buildConditionalTerminationFeeValue`'s own `required` array and enum
   checks -- not inferred from a sibling collection, since this kind has none
   of the evidence/closure/party machinery every `CANONICAL_COLLECTION_KEYS`
   row carries.
2. **`validateConditionalTerminationFeeValueRow(row, label)`** -- mirrors
   `supabase/canonical-v2-foundation.sql`'s `typed_conditional_termination_
   fee_values` CTE (Step 4A2) field for field: exact-11-key check, `fee_side`
   in `{SELLER, BUYER}`, `triggering_branch` in the six literal Modiv
   citations, `base_amount` matching `^\d+(?:\.\d+)?$`, `currency === 'USD'`,
   `operator === 'LOWER_OF'`, non-empty `reit_limit_cap_term_ref`,
   `defined_term_lineage`/`source_citations` each an array of >=2 non-empty
   strings, non-empty `raw_formula`. Then recomputes the row's own
   content-addressed identity via `contentId('CONDITIONAL_TERMINATION_FEE_
   VALUE/V1', ...)` and compares it to the supplied id -- the same
   never-trust-a-supplied-id discipline every other kind in this file already
   applies -- with a message that names identity specifically
   (`conditional termination fee value identity does not match its content`)
   so a shape failure and an identity failure read differently, same as the
   SQL side's own distinction where one exists.
3. **`assertResolvedWriteSetShape`**: `conditional_termination_fee_values`
   added as the write set's THIRD independently-optional key (alongside
   `persisted_object_references` and `write_set_origin`), generated into the
   existing powerset rather than hand-enumerated.
4. **`validateWithAdmittedSources`**: a dedicated block, placed after the
   `OPEN_WORLD_COLLECTION_KEYS` loop and before the retained/quarantine
   machinery -- **deliberately not one of the `COLLECTION_KEYS` loops**,
   because this kind carries no `closure_id` (the adapter never mints one,
   matching the resolver's own rows) and so takes no part in the
   closure/residual/quarantine pipeline those loops feed. Validates shape +
   identity per row, rejects duplicate ids
   (`writeSet contains a duplicate conditional termination fee value.`), and
   copies the rows straight into `publishableWriteSet.conditional_
   termination_fee_values` when supplied -- never quarantined, never
   dropped, matching the SQL branch's own "excluded from every generic
   closure-keyed loop, but the one write that IS still counted" treatment
   (Step 4A2's note on `publishable_object_count`). `counts.publishable` now
   adds this kind's length too, for the identical reason.

### `lib/canonical-v2/canonical-writer.js` (not in this step's owned-file
list, but required -- see next section)

`assertDealScopeWriteSetShape`'s own powerset key check (separate from, and
run BEFORE, `validate-write-set.js`'s) widened the same way: a third
optional key, `conditional_termination_fee_values`, plus the same
`undefined-or-Array` inline guard `persisted_object_references` already has.

## What else had to change, and why

This step's brief names two owned files: `native-write-set-adapter.js` and
`validate-write-set.js`. Making the acceptance criterion true --
**"a real extraction run's own write-set... carries conditional fee values
through the bridge into `canonical_v2_write`"** -- required a third,
minimal edit to `lib/canonical-v2/canonical-writer.js`, and Step 4A2's own
note predicted exactly this:

> Does not add `conditional_termination_fee_values` to
> `lib/canonical-v2/validate-write-set.js` or `canonical-writer.js`'s
> `DEAL_SCOPE_WRITE_SET_KEYS`. ... whoever wires the adapter next will need
> to widen that key set too, or `DEAL_SCOPE_RUN` calls through the ordinary
> JS path will keep silently dropping this field.

Verified directly: `canonical-writer.js`'s `assertDealScopeWriteSetShape`
runs its own closed-key check independently of `validate-write-set.js`'s
(a pre-existing split the file's own comment documents, from the
`write_set_origin` bug it names). Before this edit, calling the real bridge
(`evidence-to-write-set-bridge.js`'s `importRunEvidence`, which calls
`createCanonicalWriter(...).write({operation: 'DEAL_SCOPE_RUN', ...})`) with
a write set carrying `conditional_termination_fee_values` threw
`INVALID_DEAL_SCOPE_WRITE_SET` **before `validateResolvedCanonicalWriteSet`
-- and therefore this kind's own shape check -- ever ran.** Fixing only the
two named files would have made the JS-side validator accept the key while
the actual writer that calls it still rejected every write set that carried
it, which is exactly the shape of "a protection that has never run" this
program keeps finding. The edit is three lines (one optional-key array
entry, one inline `Array.isArray` guard) and does not touch `WRITE_ORDER`/
`OBJECT_ID_FIELDS` -- this kind has no `closure_id` and takes no part in the
per-object `transaction.writeObject` loop those drive, exactly like
`validate-write-set.js`'s own treatment.

`WRITE_ORDER` was deliberately left untouched for the same reason
`COLLECTION_KEYS` was: adding a `closure_id`-less kind to a closure-keyed
loop does not error, it passes vacuously -- worse than no check, per this
kind's own design note in Step 4A2.

## Live proof against a local container

Environment: `pm-pg` (`postgres:16-alpine`, port 55432) already running from
earlier work; a fresh database (`pm_step4a3`) for a clean apply, following
Step 4A/4A2's scaffolding convention:

```bash
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS pm_step4a3; CREATE DATABASE pm_step4a3;"
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d pm_step4a3 \
  -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d pm_step4a3 \
  -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql
```

Result: exit 0, same two benign `NOTICE`s Step 4A/4A2 record (pgcrypto
already exists; a legacy `CHECK` constraint that does not exist on a fresh
database). `supabase/canonical-v2-foundation.sql` was not edited by this
step.

### The proof script: `scripts/canonical-v2-step-4a3-conditional-fee-adapter-proof.js`

New script (not an edit to Step 4A2's harness, which this step does not own
and which exists specifically to prove the SQL side in isolation). Unlike
that harness, **this script never touches `conditional_termination_fee_
values` itself** -- it proves the field arrives through the ordinary
production call chain, with the adapter and both validators doing the
carrying:

1. Reads `evidence/canonical-v2/modiv-termination-fee-20260807-replay`'s
   already-committed `run-receipt.json` and `resolution.json` -- no live
   model call, fully deterministic from committed data. **This run
   directory is read-only throughout**: never overwritten, so the baseline
   manifest and every other test pinned against its committed files (in
   particular `adapter-result.json`, still the OLD, pre-this-step shape on
   disk) stay unaffected.
2. Reconstructs the RESOLVED run receipt exactly as
   `canonical-v2-live-extraction-run.mjs:1304-1307` does
   (`{...receipt, compiled_candidates: resolution.resolved.map(e =>
   e.compiled_candidate)}`) and calls the real, now-fixed
   `buildNativeWriteSet` fresh, with `resolution` passed through exactly as
   production does. `admitted_source_context`/`source_text`/`document_hash`
   are read from the OLD `adapter-result.json`'s
   `admitted_source_contexts[0]` -- a genuine input this step's change does
   not affect, since it is built by the SEC-HTML admission pipeline, not by
   the adapter.
3. Composes the full write-set exactly as `evidence-to-write-set-bridge.js`'s
   `readRunEvidence` does (adapter `write_set` plus `provisions`/
   `components` recovered from `resolution.json`).
4. Runs it through the real bridge path: `validateResolvedCanonicalWriteSet`
   directly (to inspect the publishable write-set), then
   `createCanonicalWriter`'s `DEAL_SCOPE_RUN` writer (dry run, decorated with
   the same rebuilding source-reference resolver `importRunEvidence` uses) --
   the exact call that would have thrown `INVALID_DEAL_SCOPE_WRITE_SET`
   before `canonical-writer.js` was also widened.
5. Persists the source chain (Step 4A's pattern: `INTAKE_CAPTURE`, 13x
   `STAGE_SOURCE_ARTIFACT_CHUNK`, `PREPARE_SOURCE_ADMISSION`), then calls
   `public.canonical_v2_write` with the writer's own dry-run
   `publishableWriteSet`/`residuals`/`quarantines`/receipt -- never a
   manually re-assembled write-set.
6. Verifies both counts and the headline round trip.

### Run

```bash
node scripts/canonical-v2-step-4a3-conditional-fee-adapter-proof.js \
  evidence/canonical-v2/modiv-termination-fee-20260807-replay \
  postgres://postgres:postgres@localhost:55432/pm_step4a3
```

Full output (trimmed to the load-bearing parts):

```json
--- Fresh adapter call (real inputs, no manual splicing) ---
{
  "write_set_carries_key": true,
  "conditional_termination_fee_values_in_fresh_write_set": 6,
  "counts_conditional_termination_fee_values_written": 6
}

--- validateResolvedCanonicalWriteSet (the real bridge validator) ---
{
  "accepted": true,
  "conditional_termination_fee_values_in_publishable_write_set": 6,
  "counts": { "publishable": 99, "residuals": 0, "quarantinedClosures": 0 }
}

--- JS writer (createCanonicalWriter), DEAL_SCOPE_RUN, dry run ---
{
  "inputDigest": "a9490bb8f55a345a31eece1f7110ffaa562e653b337ec76da4e886d476257f47",
  "conditional_termination_fee_values_in_publishable_write_set": 6
}

--- SQL writer (public.canonical_v2_write), DEAL_SCOPE_RUN ---
{
  "status": "COMMITTED",
  "receiptId": "6c5d11640c15149b804623b3619520b047052a1d9d03541f9c010f28cebb05a9",
  "inputDigest": "a9490bb8f55a345a31eece1f7110ffaa562e653b337ec76da4e886d476257f47",
  "publishableObjectCount": 99
}

--- Verification ---
{
  "conditional_termination_fee_values_in_write_set": 6,
  "conditional_termination_fee_values_row_count": 6,
  "js_receipt_id": "6c5d11640c15149b804623b3619520b047052a1d9d03541f9c010f28cebb05a9",
  "sql_receipt_id": "6c5d11640c15149b804623b3619520b047052a1d9d03541f9c010f28cebb05a9",
  "receipt_ids_match": true,
  "headline_conditional_termination_fee_value_id": "e76d73adc20f35c77cc09dfc0a0c6a4843d49dfdda44b1583d809dab42a24561",
  "headline_base_amount": "10000000",
  "headline_stored_canonical_payload_digest": "18203fa5cfe754309b88c8c9499c99eb913f0348b8a8867dfdae3588623e4f1c",
  "headline_round_trip_canonical_bytes_identical": true
}
```

**The two counts asked for: 6 in the write-set, 6 in the table.** Verified
again from a fresh `psql` connection after the script exited:

```sql
SELECT count(*) FROM canonical_v2_staging.conditional_termination_fee_values;
--  6
SELECT conditional_termination_fee_value_id, fee_side, triggering_branch,
       canonical_payload->>'base_amount' AS base_amount
FROM canonical_v2_staging.conditional_termination_fee_values ORDER BY triggering_branch;
--  e76d73ad...  SELLER  7.3(b)(i)    10000000       <- the headline
--  8c537292...  SELLER  7.3(b)(ii)   10000000
--  2e3493e2...  SELLER  7.3(b)(iii)  10000000
--  e5f9e653...  SELLER  7.3(b)(iv)   15000000.00
--  57425cfc...  SELLER  7.3(b)(v)    15000000.00
--  c1b2e1e5...  BUYER   7.3(c)       15000000.00
```

**The headline `$10,000,000` SELLER 7.3(b)(i) row round-trips
byte-identical**, same `canonical_payload_digest`
(`18203fa5cfe754309b88c8c9499c99eb913f0348b8a8867dfdae3588623e4f1c`) Step
4A2's own hand-spliced proof produced for this exact row -- confirming this
step's real-bridge path and Step 4A2's harness-spliced path agree on the
identical content, as they must.

**JS and SQL receipt identities match exactly**
(`6c5d11640c15149b804623b3619520b047052a1d9d03541f9c010f28cebb05a9`), the
same proof pattern Step 4A/4A2 established, now produced without any manual
digest assembly -- `createCanonicalWriter`'s ordinary dry run computed it,
because `assertDealScopeWriteSetShape` now accepts the key that would
otherwise have blocked the call before it started.

## Test that pins the wiring

`tests/canonical-v2-conditional-fee-values-write-set-wiring.test.js`, ten
tests, all against the REAL functions (never a mock):

1. **`THE WIRING PIN`** -- calls the real `buildNativeWriteSet` with
   `resolution.conditional_termination_fee_values` set to two rows built
   through the real `buildConditionalTerminationFeeValue` (including the
   actual Modiv headline row, reconstructed field-for-field from the
   committed fixture), and asserts `write_set.conditional_termination_fee_
   values` equals them exactly. **Verified to fail if the wiring is
   removed**: stashing only the adapter's change and re-running this file
   fails 5 of 10 tests, including this one, with the key simply absent from
   the write set -- restored afterward, confirmed still green.
2. Absent/empty `resolution` (three variants) all OMIT the key entirely --
   never a present-but-empty array -- and produce byte-identical write sets
   to each other.
3. `validateResolvedCanonicalWriteSet` accepts a real adapter write set
   carrying the kind and publishes it unchanged, counted in
   `counts.publishable`.
4. A write set with no such key validates exactly as before this step
   (regression safety).
5. Four hostile probes mirroring Step 4A2's SQL-side probes: extra key,
   wrong enum (`currency`), tampered id (refused on identity, not shape,
   with a distinct message), duplicate ids -- all refused with the expected
   message.
6. Two `canonical-writer.js`-level tests: `createCanonicalWriter`'s
   `DEAL_SCOPE_RUN` writer accepts the key on both a dry run and a real
   commit, and replay stays idempotent (same receipt id, one transaction).

```
CI=true node --test tests/canonical-v2-conditional-fee-values-write-set-wiring.test.js
# tests 10, pass 10, fail 0
```

## Targeted test runs (not the full suite)

```
CI=true node --test \
  tests/canonical-v2-conditional-fee-values-write-set-wiring.test.js \
  tests/canonical-v2-native-write-set-adapter.test.js \
  tests/canonical-v2-conditional-termination-fee-value.test.js \
  tests/canonical-v2-writer-conditional-termination-fee-shape-sql.test.js
# tests 39, pass 39, fail 0

# Every other test file requiring validate-write-set.js or canonical-writer.js
# (35 files, run in batches to stay inside the tool's per-call timeout):
# tests 351 total across all batches, pass 351, fail 0. Includes the three
# Modiv replay tests that exercise resolution.conditional_termination_fee_values
# from real committed fixtures
# (canonical-v2-modiv-termination-fee-scope-correction-replay.test.js,
# canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js,
# canonical-v2-modiv-termination-fee-citation-following-replay.test.js) and
# canonical-v2-modiv-replay.test.js's full replay-through-admission-
# resolution-adapter-validation path.
```

`bash scripts/lint/forbidden-patterns.sh`: `INVARIANT-4: PASS`, exit 0.

Full `npm test`/`npm run build` were **not** run, per this step's explicit
instruction (targeted only).

## What this does not do

- Does not add `conditional_termination_fee_values` to `WRITE_ORDER`/
  `OBJECT_ID_FIELDS` in `canonical-writer.js`, or to the generic
  `WRITE_SET_KEYS` set in `validate-write-set.js`. Both are deliberate:
  this kind has no `closure_id` and is not a per-object write the generic
  closure-keyed machinery in either file can process without a closure to
  key on (adding it there would make those checks pass vacuously rather
  than validate anything -- Step 4A2's own reasoning for the SQL side's
  loop exclusions, mirrored here). `persisted_object_references` is the
  existing precedent for a DEAL_SCOPE_RUN-only optional key excluded from
  the generic set the same way.
- Does not overwrite `evidence/canonical-v2/modiv-termination-fee-
  20260807-replay/adapter-result.json` (or `validation.json`) to reflect the
  new adapter output. That file is a committed, tracked fixture other tests
  may pin against; the proof script instead recomputes the adapter's output
  fresh, in memory, from the run's other committed inputs, leaving the
  directory exactly as Step 4A2 left it.
- Does not touch `supabase/canonical-v2-foundation.sql` or its digest pins,
  per this step's brief.
