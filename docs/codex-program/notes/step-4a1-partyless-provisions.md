# Step 4A1. Teach the SQL writer that provisions can have no party

Status: done. All six affected families import durably against a local
container, `claim_revisions` counts match each run's claim count exactly,
JS and SQL receipt identities match per family, and a hostile test confirms
a party-bearing provision with `party` missing is rejected with a message
naming the shape, not the lineage.

## Environment

Same sandbox as Step 4A (`docs/codex-program/notes/step-4a-durable-write.md`):
Linux container, root user. Docker daemon was already running from a prior
step (`pm-pg`, port 55432, holding Step 4A's leftover data). To avoid any
interference with that container or with the other agent working in this
checkout, this step used its own throwaway container:

```bash
docker pull postgres:16-alpine   # 429 from the registry proxy; local image cache already had it, run proceeded
docker run -d --name pm-pg-4a1 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres \
  -p 55433:5432 postgres:16-alpine
```

`docker exec pm-pg-4a1 pg_isready -U postgres` confirmed ready.

## 1. The change

`supabase/canonical-v2-foundation.sql`, `DEAL_SCOPE_RUN`'s provision check
(previously one `IF EXISTS` block, ~3735-3926). Split into two blocks:

1. **New, first: a pure shape check.** A new CTE `typed_provision_shapes`
   evaluates `shape_valid` with two branches, keyed on
   `provision->>'schema_version'`:
   - `STRUCTURAL_PROVISION_INSTANCE/V1`: exact key set
     `schema_version, source_occurrence_id, canonical_text_id, document_hash,
     absolute_start, absolute_end, concept_key, ordinal, source_anchor_id,
     provision_instance_id, closure_id` (11 keys, no `party`) plus the same
     format/hex/regex checks the party-bearing branch already had for every
     field it shares.
   - anything else (kept as `PROVISION_INSTANCE/V1`, strict): the original
     12-key set including `party`, with the original party sub-object
     checks (`role`/`value`/`capacity`, all non-empty strings) untouched.
   If any row fails, `RAISE EXCEPTION 'DEAL_SCOPE_RUN provision shape is
   invalid'` — a new, distinct message.

2. **Second, unchanged in intent: the lineage/anchor/identity check**, now
   only reachable once every row has already passed the shape check above.
   `typed_provisions` gained an `is_structural` column and its
   `provision_instance_id` recomputation branches on it: the structural
   branch's `content_id` payload omits `party` (mirrors
   `source-structure.js`'s `buildStructuralProvisionInstance`, which never
   puts `party` in the hashed payload), the party-bearing branch is
   byte-for-byte what it was before. Message unchanged: `'DEAL_SCOPE_RUN
   provision identity or source lineage is invalid'`.

Key sets and identity payloads were read from
`lib/canonical-v2/validate-write-set.js` (`STRUCTURAL_PROVISION_INSTANCE_KEYS`,
line 123; `expectedObjectId`'s `partylessProvision` branch, line ~844) and
`lib/canonical-v2/source-structure.js` (`buildStructuralProvisionInstance`,
line 344), not inferred from the party-bearing branch minus `party`.

No table changed: `canonical_v2_staging.provision_instances` stores
`canonical_payload jsonb` generically; nothing schema-specific to `party`
exists at the table level (confirmed by reading its `CREATE TABLE`, line 421,
and every other join against it in the file — components, claims, evidence,
relationships — all join on `provision_instance_id` only).

## 2. Schema re-applies cleanly

```bash
export PGPASSWORD=postgres
psql -h localhost -p 55433 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql
psql -h localhost -p 55433 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql
```

Both exit 0. Only the same two expected `NOTICE`s Step 4A saw (`pgcrypto`
already exists; `deal_admission_records_check` does not exist to drop).

## 3. Per-family results

Each family run against a database freshly truncated back to empty first
(`TRUNCATE TABLE canonical_v2_staging.<table> CASCADE` for every table in
the schema), so `claim_revisions` count after each run is that run's count
alone, not a running total across families.

The truncate step (`truncate-all.sql`, throwaway, not committed — reproduce
inline below):

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'canonical_v2_staging'
  LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', r.schemaname, r.tablename);
  END LOOP;
END $$;
```

Command per family:

```bash
export PGPASSWORD=postgres
psql -h localhost -p 55433 -U postgres -d postgres -f truncate-all.sql
node scripts/canonical-v2-local-durable-write.js \
  evidence/canonical-v2/<run-directory> \
  postgres://postgres:postgres@localhost:55433/postgres
```

| Family | Run directory | JS `claims_in_write_set` | SQL `claim_revisions` count | JS receipt ID | SQL receipt ID | Match |
|---|---|---|---|---|---|---|
| `CONSIDERATION` | `modiv-consideration-20260807-replay` | 1 | 1 | `124f7e00f9b4...39c1fa` | `124f7e00f9b4...39c1fa` | identical |
| `MERGER_STRUCTURE_CLOSING` | `modiv-merger-structure-20260807-replay` | 20 | 20 | `d997da64191d...9abac` | `d997da64191d...9abac` | identical |
| `MISC_BOILERPLATE` | `modiv-misc-boilerplate-20260807-replay` | 14 | 14 | `b3870ce4f951...69126` | `b3870ce4f951...69126` | identical |
| `PROXY_MEETING` | `modiv-proxy-meeting-20260807-replay` | 2 | 2 | `96e6379961888...410e91` | `96e6379961888...410e91` | identical |
| `DNO_INDEMNIFICATION` | `modiv-dno-20260807-replay` | 4 | 4 | `63b46d932aa8...31db947` | `63b46d932aa8...31db947` | identical |
| `TERMINATION_FEE` | `modiv-termination-fee-20260807-replay` | 4 | 4 | `8b744a788c51...1e11` | `8b744a788c51...1e11` | identical |

Every family's `SELECT count(*) FROM canonical_v2_staging.claim_revisions`
(after that family's own fresh-truncated run) equals its write-set's claim
count exactly, and the JS-computed and SQL-recomputed `receiptId` are
byte-for-byte identical in all six cases — the same signature Step 4A
established for the one family that already worked
(`NO_OTHER_REPS_FRAUD`). `DNO_INDEMNIFICATION` is the exact control case
Step 4A recorded as failing at this check
(`docs/codex-program/notes/step-4a-durable-write.md` section 6); it now
commits cleanly with the same document and script, `party` absent
throughout.

**Durability, checked from a second connection.** Re-ran `PROXY_MEETING`
after a fresh truncate, then — from a *separate* `psql` invocation, after
the writing Node process had already exited — queried the same database:

```
claim_revisions:                        2
provision_instances:                    1
write_receipts (operation=DEAL_SCOPE_RUN): 1
```

Matches the run's write-set (2 claims, 1 structural provision) exactly;
nothing was rolled back.

## 4. The hostile test

**Requirement:** a party-bearing (`PROVISION_INSTANCE/V1`) provision with
`party` deleted must still be rejected, with a message naming the shape,
not the lineage.

Built from a real, already-persisted source chain (reused
`NO_OTHER_REPS_FRAUD`'s durable write, all `PROVISION_INSTANCE/V1`,
committed first so the source-reference lineage the excerpt/provision
checks join against already exists) plus that same run's own valid,
bridge-produced write-set, with `party` deleted from `provisions[0]` and a
correctly-recomputed `p_input_digest` for the *mutated* envelope (using the
same `contentId`/`canonicalJson` functions from
`lib/canonical-v2/canonical-bytes.js` the SQL side mirrors — otherwise the
function's very first envelope-digest check would fire instead of the
check under test) and a self-consistent receipt (needed because
`canonical_v2_write`'s generic receipt-shape check, ~line 1294, runs before
any operation-specific branch and would otherwise raise first).

Called `public.canonical_v2_write` directly with this envelope, inside
`BEGIN`/`ROLLBACK` (negative test, never intended to commit):

```json
{
  "threw": true,
  "message": "DEAL_SCOPE_RUN provision shape is invalid",
  "code": "23514"
}
```

**Confirmed distinct from the lineage message** (`'DEAL_SCOPE_RUN provision
identity or source lineage is invalid'`) — the exact requirement. A
follow-up query from a fresh `psql` connection confirmed nothing was
committed: `claim_revisions` still read 3 (the `NO_OTHER_REPS_FRAUD` control
run only), and no `write_receipts` row exists for the hostile test's
idempotency key (`step-4a1-hostile-test:party-missing`).

The party-bearing branch itself was not relaxed to accept a missing
`party` — it is the same check, unconditionally rejecting the row, that
this hostile test triggers. Confirmed by reading the diff: the 12-key
`PROVISION_INSTANCE/V1` branch (including `party`, its `role`/`value`/
`capacity` sub-object checks, all non-empty-string) is untouched from
before this step; only a new sibling branch for
`STRUCTURAL_PROVISION_INSTANCE/V1` was added.

## 5. Further divergence found

None. All six previously-blocked families now import durably and agree
with the JS writer on receipt identity. No new JS/SQL disagreement was
found on this data. (Step 4A's own finding — the source-chain
precondition, `INTAKE_CAPTURE`/`STAGE_SOURCE_ARTIFACT_CHUNK`/
`PREPARE_SOURCE_ADMISSION` must precede `DEAL_SCOPE_RUN` — still applies
unchanged and is handled by the existing harness script.)

## 6. Regression test added

`tests/canonical-v2-writer-provision-shape-branch-sql.test.js` (new, text
pattern-matching the SQL source, following this repository's existing
convention for SQL-writer tests since CI has no live Postgres — see that
file's header for why a pass here is not proof the fix works against a
real database; section 3-4 above is that proof). Asserts: the shape check
raises before the lineage check with a distinct message; the structural
branch requires its own 11-key set with no `party` key referenced anywhere
in it; the party-bearing branch still requires the full 12-key set
including a closed, non-empty `party` object (i.e. not relaxed); and the
lineage check's `provision_instance_id` recomputation branches correctly
(structural payload has no `party` key, party-bearing payload still does).

```
CI=true node --test tests/canonical-v2-writer-provision-shape-branch-sql.test.js
# 4 pass, 0 fail
```

Also re-ran the pre-existing SQL-source tests that read this file, to
confirm the edit didn't break their pattern matches:

```
CI=true node --test \
  tests/canonical-v2-writer-structure-identity-sql.test.js \
  tests/canonical-v2-writer-excerpt-identity-sql.test.js \
  tests/canonical-v2-deal-scope-sql-writer.test.js \
  tests/canonical-v2-writer-object-integrity-sql.test.js \
  tests/canonical-v2-canonical-writer.test.js \
  tests/canonical-v2-structural-provision-instance.test.js \
  tests/canonical-v2-consideration-wave-a.test.js \
  tests/canonical-v2-key-terms-mae-product-projection.test.js \
  tests/canonical-v2-defined-terms-family-seam.test.js
# 82 pass, 0 fail
```

One test failed on first run and needed a companion fix:
`tests/canonical-v2-deal-scope-sql-writer.test.js`'s `'the governed schema
digest pins the authoritative deal-scope writer'` pins a sha256 of
`supabase/canonical-v2-foundation.sql` inside
`scripts/canonical-v2-staging-schema.mjs` (`EXPECTED_DIGESTS`), a
governance guard against unreviewed drift before this file is ever applied
to the real staging Supabase project. Editing the schema legitimately
changes that hash, so `EXPECTED_DIGESTS['canonical-v2-foundation.sql']` was
updated from `bf4e1468b0...c69271fee` to the new file's digest,
`0bbff0843530f598d847ad139d94650f979642822881e9de1d6fad846a94e83a`
(`sha256sum supabase/canonical-v2-foundation.sql`). This is the only file
outside `supabase/canonical-v2-foundation.sql` and the new test that this
step touched.

## 7. Files this step added or touched

- `supabase/canonical-v2-foundation.sql` — the fix (section 1 above).
- `scripts/canonical-v2-staging-schema.mjs` — pinned digest updated to
  match the legitimate schema edit (section 6 above). No other line
  touched.
- `tests/canonical-v2-writer-provision-shape-branch-sql.test.js` (new) —
  permanent regression test, section 6.
- `docs/codex-program/notes/step-4a1-partyless-provisions.md` (this file).
- Nothing under `lib/canonical-v2/` was touched, per this step's brief.

## 8. Reproducing from a clean checkout

No Supabase account, credential, or production access. Requires Docker
(working daemon), `psql`, and `node` with `node_modules` installed.

```bash
# 1. Throwaway container.
docker pull postgres:16-alpine
docker run -d --name pm-pg-4a1 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres \
  -p 55433:5432 postgres:16-alpine
export PGPASSWORD=postgres

# 2. Supabase-project scaffolding (same as Step 4A).
psql -h localhost -p 55433 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql

# 3. The schema, with this step's fix applied.
psql -h localhost -p 55433 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql

# 4. Any of the six previously-blocked families, e.g.:
node scripts/canonical-v2-local-durable-write.js \
  evidence/canonical-v2/modiv-dno-20260807-replay \
  postgres://postgres:postgres@localhost:55433/postgres
# ... repeat for modiv-consideration-20260807-replay,
# modiv-merger-structure-20260807-replay, modiv-misc-boilerplate-20260807-replay,
# modiv-proxy-meeting-20260807-replay, modiv-termination-fee-20260807-replay
# (truncate canonical_v2_staging.* between runs -- section 3's inline SQL --
# to keep each family's claim_revisions count isolated to that family).

# 5. Verify.
psql -h localhost -p 55433 -U postgres -d postgres \
  -c "SELECT count(*) FROM canonical_v2_staging.claim_revisions;"

# 6. Regression test (no database needed).
CI=true node --test tests/canonical-v2-writer-provision-shape-branch-sql.test.js

# Teardown.
docker rm -f pm-pg-4a1
```
