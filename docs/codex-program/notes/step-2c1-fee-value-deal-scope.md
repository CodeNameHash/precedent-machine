# Step 2C1 — give conditional fee values a deal scope before a second deal writes

Status: DONE. Written incrementally as the work landed.

## The defect, confirmed live

`pm-pg3` (localhost:55433, db `pm`, table owner `postgres`/`pm`):

```
\d canonical_v2_staging.conditional_termination_fee_values
```

showed 6 rows and no `document_hash` (or any deal-scoping) column at all —
just `conditional_termination_fee_value_id`, `fee_side`, `triggering_branch`,
`canonical_payload`, `canonical_payload_digest`. `termination-fee-serving-
source.js`'s `readModivConditionalTerminationFeeValues` does
`SELECT canonical_payload FROM canonical_v2_staging.conditional_termination_fee_values`
with no WHERE clause at all — the whole table, every deal.

## Design decision: where document_hash comes from

`buildConditionalTerminationFeeValue` (lib/canonical-v2/native-producer/
conditional-termination-fee-value.js) builds a closed, content-addressed
`CONDITIONAL_TERMINATION_FEE_VALUE/V1` row from an 11-key contract with no
document_hash field. Adding document_hash to that JS-side contract would
change the schema version's content-addressed id for every existing row
(the file's own sibling, modiv-termination-fee-payment-timing-parser.js, was
built as a SEPARATE sidecar specifically to avoid this — "adding a field
there would change every existing row's own content-addressed id under the
same schema version").

Instead: `p_write_set->'deal'->>'document_hash'` is already present, already
validated (`^[0-9a-f]{64}$`, admitted against `immutable_source_documents`)
and already in scope for every DEAL_SCOPE_RUN call, before the conditional-
fee-value loop runs (supabase/canonical-v2-foundation.sql:3108-3116,
8443-8492). The new column is populated from THAT — the write-set's own deal
identity — not from the payload. No JS builder, no content-addressed id, no
existing pinned fixture changes. Precedent: `deal_admission_records` already
carries `document_hash` as a real column checked against the payload's own
copy; here there is no payload copy to check against, so the column is
populated directly from the deal wrapper instead.

## Changes made

### 1. `supabase/canonical-v2-foundation.sql`

- `conditional_termination_fee_values` gains
  `document_hash text NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$')`,
  same regex every other document_hash column in this file uses, following
  `definition_occurrences`'s existing real-column precedent.
- New index `canonical_v2_conditional_termination_fee_values_document_hash_idx`
  (Postgres truncates the identifier to 63 chars; harmless).
- The INSERT loop in `public.canonical_v2_write`'s `DEAL_SCOPE_RUN` branch
  now inserts `document_hash` from `p_write_set->'deal'->>'document_hash'`
  — the write-set's own deal identity, not the row's own payload (which has
  no such field).
- The identity-conflict guard (both the pre-INSERT short-circuit and the
  post-INSERT verification) now ALSO checks `existing_document_hash IS
  DISTINCT FROM (p_write_set->'deal'->>'document_hash')`, alongside the
  existing payload-digest check. Reasoning: this row's content-addressed id
  is computed over the payload alone (fee_side/triggering_branch/
  base_amount/…), never over document_hash, so two different deals that
  happened to produce a byte-identical conditional-fee row would otherwise
  collide on the primary key, and `ON CONFLICT DO NOTHING` would silently
  keep the FIRST deal's document_hash on a row the second deal also wrote —
  the same cross-deal leakage this step exists to close, just caught at the
  write boundary instead of the read one. New declared variable
  `existing_document_hash text;`.
- New whole-file sha256:
  `e7fda6d94409605908256b958eafc7883a280695583abdbb4eecd49aec308cd1`.

### 2. Digest guards moved (verified BEFORE repinning, not after)

1. **`scripts/canonical-v2-staging-schema.mjs`** — whole-file sha256 pin for
   `canonical-v2-foundation.sql` updated to the value above.
2. **`scripts/canonical-v2-optiona-authority-partition.mjs`** — the
   `canonical_v2_write` function-body digest updated to
   `bb6e01a0a8686d9676e65b8208b90ae82241941a73d02ddce45fb640dce70283`.
   Verified by diffing the freshly-extracted function body against an
   extraction of the pre-edit file (`git show HEAD:...` into a scratch
   file): the ONLY differences are the new `existing_document_hash text;`
   declaration and the one conditional-fee-value INSERT loop — nothing else
   in the ~370k-character function moved. Then ran
   `node scripts/canonical-v2-optiona-authority-partition.mjs --write`;
   `git diff sql/optionA/` shows exactly one file changed
   (`step0b-canonical-writer-by-contract.sql`) with exactly that same diff
   (plus the governed-digest comment line). The other four generated files
   (`step0a`/`step0c`/`step0d`/`step0e`) are untouched, correctly — nothing
   about `canonical_v2_import_candidate_release`,
   `canonical_v2_activate_candidate_release`, or the dependency functions
   (`canonical_json`, `content_id`, the two `validate_*_product_carrier`
   functions) changed.
3. **`scripts/canonical-v2-staging-writer-structure-identity.mjs`** — pins
   exact error-message strings. NONE of them changed: this step added a
   column and an INSERT/guard, it did not alter or add any `RAISE
   EXCEPTION` message text. Confirmed by running
   `tests/canonical-v2-staging-writer-structure-identity-runner.test.js`
   (the CI-safe regex check over this script's own source) — passes
   unchanged. The live-execution version of this script targets a real
   remote "staging" Supabase project (`sjumbznveyyiizhwvixj`) this
   environment has no credentials or authority to reach, so it was not run
   directly; nothing in the diff touches anything it pins.

### 3. `tests/canonical-v2-writer-conditional-termination-fee-shape-sql.test.js`

Not one of the three named guards, but a real pinned test that the exact
INSERT statement text broke. Updated the table-definition and INSERT-loop
assertions for the new column, and added a new test asserting the
document_hash cross-check is present in the identity-conflict guard both
before and after the INSERT.

### 4. `lib/canonical-v2/local-staging-deal-reader.js`

New `readConditionalTerminationFeeValuesForDeal({ client, documentHash })`,
scoped by the new `document_hash` COLUMN (not `canonical_payload->>'…'` —
this kind's payload has no such field). Wired into
`readDealFromLocalCanonicalV2Staging`'s return shape as
`conditional_termination_fee_values`, alongside `resolved`/`open_world`/
`relationships`. The `EMPTY_DEAL_READ` guard now also counts this
collection, so a deal whose ONLY data is a conditional fee value is not
misreported as empty. Header comment updated to document the new capability
and why its scoping mechanism differs from every other collection this
reader returns. 5 new hermetic tests added (2-deal isolation among them);
all 21 tests in the file (16 original + 5 new) pass.

### 5. `lib/canonical-v2/termination-fee-serving-source.js`

`buildModivTerminationFeeCardsFromDatabase` no longer runs its own direct,
unscoped `SELECT canonical_payload FROM
canonical_v2_staging.conditional_termination_fee_values` (the exact bug
this step exists to close). It now reads
`deal.conditional_termination_fee_values` off the same
`readDealFromLocalCanonicalV2Staging` call it already made for
resolved/open_world claims — the reader now owns this read, as the brief
asked. The old `readModivConditionalTerminationFeeValues` function and its
stale header comment (which explicitly recorded the missing-scope gap) are
deleted.

### 6. Found and fixed in passing: a stale, broken proof script

`scripts/canonical-v2-local-conditional-fee-write.js`'s header claimed
"Neither the bridge nor canonical-writer.js knows conditional_termination_
fee_values" — true when Step 4A2 wrote it, false since Step 4A3:
`evidence-to-write-set-bridge.js`'s `readRunEvidence()` builds `writeSet` as
`{...adapter.write_set, provisions, components}`, and `adapter-result.json`
(committed per run directory) already carries
`conditional_termination_fee_values` when non-empty
(`native-write-set-adapter.js` splices `resolution.conditional_termination_
fee_values` in verbatim). So `dryRunResult.receipt.validation.counts.
publishable` already counted the 6 Modiv rows once; the script then added
`conditionalFeeValues.length` a SECOND time (93 + 6 + 6 = 105), which
`public.canonical_v2_write`'s own independently-computed
`publishable_object_count` (99, summed straight off the write-set's own
array lengths) correctly rejected with `'invalid DEAL_SCOPE_RUN write
receipt'`. **Reproduced against an unmodified `canonical-v2-foundation.sql`
(`git show HEAD:...`) on a separate fresh container before touching
anything** — confirmed the failure predates and is independent of this
step's schema edit. Fixed the double-count and corrected the header
comment; added a canonicalJson-based cross-check (not `JSON.stringify`,
which reports a false mismatch on `canonicalise()`'s sorted key order) that
the bridge's copy of the rows agrees with resolution.json's, so the
splice's premise is verified rather than assumed.

### 7. New: `scripts/canonical-v2-conditional-fee-two-deal-isolation-proof.js`

Writes a second, synthetic deal's own admitted source chain (INTAKE_CAPTURE
→ STAGE_SOURCE_ARTIFACT_CHUNK per chunk → PREPARE_SOURCE_ADMISSION) and one
conditional-fee-value row through the real `public.canonical_v2_write`
`DEAL_SCOPE_RUN` path — not a direct table write bypassing the writer, so
this step's new document_hash-population code is what is actually under
test. Goes around `createCanonicalWriter`'s JS-side repository-resolver
convenience wrapper for the `DEAL_SCOPE_RUN` step specifically (that
resolver can only resolve source references a `writer.write()` call wrote
through the SAME in-memory repository, and this synthetic deal's admitted
context was built directly), calling `validateResolvedCanonicalWriteSet`
with the context supplied directly instead — the same shape
`evidence-to-write-set-bridge.js`'s `importRunEvidence` already uses for
the identical reason. Then reads both deals back through the reader and
through `buildModivTerminationFeeCardsFromDatabase`.

## Acceptance proof, run against a fresh container built from the edited
## `canonical-v2-foundation.sql`

Container: fresh `postgres:16-alpine` (`pm-pg4`, port 55434), scaffolded
with `scripts/lib/canonical-v2-local-setup.sql` then the edited
`canonical-v2-foundation.sql` (`psql -v ON_ERROR_STOP=1`, exit 0). Modiv's
real 6 conditional-fee rows written via the (now-fixed)
`canonical-v2-local-conditional-fee-write.js` against
`evidence/canonical-v2/modiv-termination-fee-20260807-replay`.

`node scripts/canonical-v2-conditional-fee-two-deal-isolation-proof.js
postgres://postgres:pm@localhost:55434/pm`:

```
=== Part A: write a second, synthetic deal's conditional fee value ===
  second deal document_hash=db226a8377120d3039f624b35c6d5a01a756083196664c0e7cca15e5cabe2ccf
  conditional_termination_fee_value_id=d83a5adeb6f93fae76a1edd835d27d184a45fd34cfd3658a476acd79870b8d9e
  replayed=false
PASS  second deal document_hash differs from Modiv's
  table now holds 7 rows total (Modiv's 6 + the second deal's)
PASS  table holds at least 7 rows (Modiv's 6 plus the second deal's 1)

=== Part B: read each deal back through local-staging-deal-reader.js, scoped ===
PASS  Modiv's scoped read returns exactly 6 rows -- got 6
PASS  Modiv's scoped read contains NONE of the second deal's row
PASS  the second deal's scoped read returns exactly 1 row -- got 1
PASS  the second deal's scoped read contains NONE of Modiv's 6 rows
PASS  the second deal's row round-trips byte-identical (canonicalJson) to what was written

=== Part B2: the same isolation through the full deal reader ===
PASS  readDealFromLocalCanonicalV2Staging(Modiv) carries exactly Modiv's 6 conditional fee values -- got 6

=== Part C: the Modiv headline still serves correctly with a second deal present ===
  cards produced: 6
PASS  Modiv still produces cards with the second deal present in the same table

ALL CHECKS PASSED
```

Numbers, for the record: Modiv's document_hash is
`659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968` (6 rows);
the second deal's is
`db226a8377120d3039f624b35c6d5a01a756083196664c0e7cca15e5cabe2ccf` (1 row,
`d83a5adeb6f93fae76a1edd835d27d184a45fd34cfd3658a476acd79870b8d9e`). Table
total after both writes: 7. Each scoped read returns exactly its own deal's
rows and no others.

## `scripts/canonical-v2-modiv-termination-fee-serving-proof.js`

The other real container this step touches, `pm-pg3` (port 55433, the one
named in the brief, Modiv already durably written), had the OLD schema —
`CREATE TABLE IF NOT EXISTS` does not retrofit a running container, so it
was migrated in place: `ALTER TABLE ... ADD COLUMN document_hash`, backfill
Modiv's document_hash for its 6 existing rows, `SET NOT NULL`, add the
CHECK constraint, add the index — the equivalent of what a real migration
would do, run directly since this project keeps `canonical-v2-foundation.sql`
as a from-scratch DDL rather than an incremental migration file.

Ran `node scripts/canonical-v2-modiv-termination-fee-serving-proof.js` against
BOTH pm-pg3 (migrated in place) and pm-pg4 (fresh + the two-deal proof
already run, so its table held **7** rows, not 6, at the time this ran) —
**ALL CHECKS PASSED on both**, including the exact assertions the brief
requires:

- `source state is ATTACHED, not NOT_REGISTERED or FAILED`
- `card_count=6` on BOTH containers — pm-pg4's second deal's presence did
  not change Modiv's served card count, proving isolation through the
  actual production call site
  (`attachCanonicalTerminationFeeServing`/`pages/api/review/[id]/cards.js`
  reaches), not just through the reader in isolation
- `the $10,000,000 SELLER conditional-fee headline reaches the served payload`
- `the $15,000,000 BUYER conditional-fee headline reaches the served payload`
- the review table config renders the same 9 rows, same headline text, on
  both containers

## Targeted tests, green

- `tests/canonical-v2-local-staging-deal-reader.test.js` — 21/21 (16
  original + 5 new for Step 2C1)
- `tests/canonical-v2-writer-conditional-termination-fee-shape-sql.test.js`
  — 10/10 (updated + 1 new)
- `tests/canonical-v2-staging-schema-runner.test.js` — 7/7
- `tests/canonical-v2-optiona-authority-partition.test.js` +
  `tests/canonical-v2-sql-identity-pins.test.js` — 4/4
- `tests/canonical-v2-staging-writer-structure-identity-runner.test.js` —
  1/1 (proves guard #3 needed no change)
- `tests/canonical-v2-termination-fee-modiv-database-source.test.js` +
  `tests/canonical-v2-termination-fee-serving-switch.test.js` +
  `tests/canonical-v2-termination-fee-both-sources.test.js` +
  `tests/canonical-v2-parity-serving-boundary.test.js` +
  `tests/canonical-v2-run-projects-to-product-cards.test.js` +
  `tests/canonical-v2-termination-fee-conditional-amount-projection.test.js`
  — 148/148 combined
- `tests/canonical-v2-conditional-fee-values-write-set-wiring.test.js` +
  `tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`
  + `tests/canonical-v2-m3-final-pilot-independent-review.test.js` +
  `tests/canonical-v2-m3-final-sol-adversarial-audit.test.js` +
  `tests/canonical-v2-m3-live-modiv-reviewer-pass-repair.test.js` +
  `tests/canonical-v2-deal-scope-sql-writer.test.js` — 42 pass, 9 skipped
  (need infra this run doesn't have), 0 fail
- `tests/canonical-v2-product-candidate-result-writer.test.js` (reads
  `sql/optionA/step0b-canonical-writer-by-contract.sql` and
  `canonical-v2-foundation.sql` directly) — 20/20 (legitimately slow,
  ~122s; not a hang)
- `tests/canonical-v2-staging-agreement-product-writer-p8.test.js`,
  `tests/canonical-v2-staging-product-query-cache-p8.test.js` — 5/5, 6/6
- `bash scripts/lint/forbidden-patterns.sh` — exit 0, `INVARIANT-4: PASS`

None piped into `head`/`tail` for their pass/fail determination — every
result above was read from a full log file after checking `$?` explicitly.
`CI` was not exported for these targeted node --test runs; nothing in this
diff is documented as CI-sensitive, and the live-container proofs above are
the stronger evidence for this specific change.

## What was wrong, found along the way

1. **A stale header comment that had become false without anyone
   correcting it** (item 6 above) — the exact failure mode CLAUDE.md names:
   "this is the ONLY stage-1 rule this slice ports", except this time
   "neither the bridge nor canonical-writer.js knows conditional_
   termination_fee_values". It blocked reproducing this step's own
   acceptance proof until traced down and fixed.
2. **The identity-conflict guard's blind spot**, described above (§1/§7):
   without the document_hash cross-check, two deals producing a
   byte-identical conditional-fee row (extremely unlikely given real dollar
   amounts differ, but not impossible, and not defended against by
   anything else) would silently misattribute the second deal's row to the
   first deal's document_hash. Closed as part of this step rather than
   filed separately, since it is the same invariant this step exists to
   establish.
3. **`canonical-v2-foundation.sql` is a from-scratch DDL, not an
   incremental migration file** — `CREATE TABLE IF NOT EXISTS` silently
   no-ops against an already-existing table, so applying the edited file to
   an already-populated container (like `pm-pg3`) does NOT add the new
   column. Worth flagging for whoever eventually takes this to a real
   Supabase project: this file has no migration mechanism yet, and this is
   the first schema edit in it that needed one for an existing populated
   table.
