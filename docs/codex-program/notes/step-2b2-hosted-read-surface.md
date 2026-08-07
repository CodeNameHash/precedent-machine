# Step 2B2 — hosted read access to `canonical_v2_staging`

Implements the ruling in `DECISIONS.md`, "Waiting on Ben" item 1, **RULED
2026-08-07 by Fable under Ben's delegation**: `SECURITY DEFINER` functions
granted to a new dedicated `NOLOGIN` role, `canonical_v2_staging_reader`. No
table grants, no RLS policies, no `FORCE ROW LEVEL SECURITY`.

Working notes, written incrementally as the work proceeds.

## What this does NOT do

Per the ruling's own limits and `OPERATING-RULES.md`: no hosted database is
touched, no real credential is used, nothing is activated in production. All
verification below runs against a **throwaway local Postgres container**
(`pm-pg-2b2`, port 55435) started fresh for this task — `pm-pg3`/`pm-pg4` are
untouched, per the ground rules (another agent may be writing to them).

## Plan

1. `supabase/canonical-v2-staging-read.sql` — additive, new role
   `canonical_v2_staging_reader`, one `SECURITY DEFINER` function per read the
   local prototype performs, EXECUTE revoked from everyone else, `search_path`
   pinned, bounded row/byte results, the positive governed/open-world
   predicate, a mechanical verification block.
2. Refactor `lib/canonical-v2/local-staging-deal-reader.js` behind a small
   query interface: local (raw SQL, unchanged text/shape) vs hosted (named
   RPC calls, bounded). Everything above the interface — joins, closure
   computation, the ORPHAN_CLAIM_REVISION guard, the governance assertions —
   stays verbatim.
3. Drift test: reads the committed SQL file's text and asserts its two
   literals (`CLAIM_REVISION/V1`, `UNGOVERNED_OPEN_WORLD_EVIDENCE`) equal the
   real JS constants, not a hand-typed copy of them.
4. Apply to the fresh container, prove: existing hermetic tests still pass
   through the new interface; a non-owner role holding only
   `canonical_v2_staging_reader` reads real written data back; `anon`,
   `service_role`, `canonical_v2_writer` are each refused.

## Environment

`dockerd` was already running; containers `pm-pg3`/`pm-pg4` pre-existed and
were left alone. Started `pm-pg-2b2` on port 55435
(`docker run -d --name pm-pg-2b2 -p 55435:5432 -e POSTGRES_PASSWORD=postgres
postgres:16-alpine`). Applied, in order: `scripts/lib/canonical-v2-local-setup.sql`,
`supabase/canonical-v2-foundation.sql`, `supabase/canonical-v2-serving.sql`
(needed only so the `canonical_v2_serving` role exists for this file's REVOKE
list — Step 5A's own tables are untouched). All three applied clean, no
errors.

Then ran the existing live proof script
(`scripts/canonical-v2-local-staging-read-proof.js`) against this container to
get REAL written rows to test the hosted surface against, not synthetic ones:
two real Modiv families (`modiv-no-other-reps-20260807-replay`,
`modiv-antitrust-20260807-replay`) through the real writer, plus the
synthetic mixed fixture for the governed/open-world split. All checks passed.
Real Modiv `document_hash` for the rest of this work:
`659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968` (15
provisions, 16 claims). Synthetic fixture `document_hash`:
`3453966958619a61b38c294c5ba03efed37e0cf34354cfc1d0958596e0765dc5` (1
provision, 1 claim, 1 open-world bundle).

## What was built

**`supabase/canonical-v2-staging-read.sql`** (new, additive). Eight
`SECURITY DEFINER` functions in `public`, one per read the local prototype
performs, granted only to a new `NOLOGIN` role `canonical_v2_staging_reader`:

| Function | Reads | Positive predicate |
|---|---|---|
| `canonical_v2_staging_read_provision_instances(p_document_hash)` | `provision_instances` | -- |
| `canonical_v2_staging_read_provision_components(p_parent_provision_instance_ids)` | `provision_components` | -- |
| `canonical_v2_staging_read_claim_revisions(p_closure_ids, p_subject_occurrence_ids)` | `claim_revisions` | `schema_version = 'CLAIM_REVISION/V1'` |
| `canonical_v2_staging_read_relationship_revisions(p_source_occurrence_ids)` | `relationship_revisions` | -- |
| `canonical_v2_staging_read_open_world_candidates(p_document_hash)` | `open_world_candidates` | `evidence_governance = 'UNGOVERNED_OPEN_WORLD_EVIDENCE'` |
| `canonical_v2_staging_read_open_world_candidate_occurrences(p_candidate_ids)` | `open_world_candidate_occurrences` | same |
| `canonical_v2_staging_read_open_world_evidence_references(p_open_world_candidate_occurrence_ids)` | `open_world_evidence_references` | same |
| `canonical_v2_staging_read_conditional_termination_fee_values(p_document_hash)` | `conditional_termination_fee_values` (real `document_hash` column, PLAN.md Step 2C1) | -- |

`EXECUTE` revoked from `PUBLIC, anon, authenticated, service_role,
canonical_v2_writer, canonical_v2_serving` on every one; the sole grantee is
`canonical_v2_staging_reader`. `search_path` pinned
(`pg_catalog, canonical_v2_staging`) on every function. `canonical_payload`
selected verbatim, never reshaped. Bounded: 2,000 rows / 4 MiB per call,
enforced inside a shared `canonical_v2_staging.staging_read_bound()` helper
(`RAISE EXCEPTION`, ERRCODE `54000`, on either ceiling). The file's own
verification block (three mechanical, always-zero-or-exact-set queries) is
at its end.

**`lib/canonical-v2/local-staging-deal-reader.js`** (refactored, not
rewritten). Every read function now calls named methods on a query
interface (`createStagingQueryInterface`) instead of building SQL inline.
Two implementations: `createLocalStagingQueryInterface` (unchanged raw SQL
text, so the existing 21 hermetic tests -- whose fake client routes on query
TEXT -- pass without modification) and `createHostedStagingQueryInterface`
(calls the eight whitelisted RPCs by name via `client.rpc(name, params)`,
re-bounds the response client-side -- 2,000 rows / 4 MiB, mirroring the SQL
side -- before handing it back). Which one runs is decided purely by
whether the caller's client exposes `.query` or `.rpc`; the joins, closure
computation, `ORPHAN_CLAIM_REVISION` guard and governance assertions are
untouched, above the interface, and run identically either way.

**`lib/canonical-v2/open-world-evidence-serving.js`**: one additive export,
`CLAIM_REVISION_SCHEMA` (already existed internally; just added to
`module.exports`), so the drift test imports the real constant instead of a
second hand-typed copy of `'CLAIM_REVISION/V1'`.

**Tests added**:
- `tests/canonical-v2-staging-read-sql-drift.test.js` (11 tests) -- the
  mandatory drift test. Extracts each function's own `AS $$ ... $$` body
  (comments stripped) and asserts its literal equals the real JS constant,
  not the SQL file's own prose (which mentions both strings extensively and
  would make a naive `includes()` check trivially pass). Also asserts the
  full REVOKE/GRANT shape per function, and that the file introduces no
  `CREATE POLICY`, no `FORCE ROW LEVEL SECURITY`, no table grant.
  **Proven to actually fire**: temporarily changed the SQL literal from
  `CLAIM_REVISION/V1` to `CLAIM_REVISION/V2` and reran -- test 4 failed as
  expected; reverted, all 11 pass again.
- `tests/canonical-v2-staging-deal-reader-hosted-interface.test.js` (14
  tests) -- dispatch (`.query` vs `.rpc`), whitelist coverage (all 8 RPC
  names, exact params per call), refusal surfacing (`HOSTED_RPC_FAILED` on a
  `permission denied` response, the exact shape the live proof below
  produces), bounds enforcement (row ceiling, byte ceiling, non-array,
  null-as-empty), and an end-to-end round trip through the SAME
  `buildSyntheticMixedFixture` fixture the local interface's own tests use,
  proving the hosted path reassembles byte-identical output.

**`scripts/canonical-v2-staging-read-hosted-grant-boundary-proof.js`** (new,
not run in `npm test` -- needs a live container). Drives the ACTUAL hosted
query interface (`createHostedStagingQueryInterface`), not raw `psql`,
against a real container using `SET ROLE` to become each role in turn (a
genuine non-owner-role read: `GRANT`/`REVOKE` enforcement reads
`current_user`, which `SET ROLE` changes, not `session_user`).

## Live proof: the required evidence

Run twice against `pm-pg-2b2`, once per document_hash:

```
node scripts/canonical-v2-staging-read-hosted-grant-boundary-proof.js \
  postgres://postgres:postgres@localhost:55435/postgres \
  659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968
```

```
=== canonical_v2_staging_reader: the non-owner read ===
PASS  hosted read succeeds as canonical_v2_staging_reader (16 claims, 0 open-world bundles)

=== Also proves: canonical_v2_staging_reader has NO table grant (SECURITY DEFINER boundary is real) ===
PASS  direct table SELECT as canonical_v2_staging_reader is refused -- permission denied for schema canonical_v2_staging

=== The four refusals: same read, three other roles, one whitelist name check ===
PASS  read refused as anon -- ... permission denied for function canonical_v2_staging_read_provision_instances
PASS  read refused as service_role -- ... permission denied for function canonical_v2_staging_read_provision_instances
PASS  read refused as canonical_v2_writer -- ... permission denied for function canonical_v2_staging_read_provision_instances

=== All 8 read RPCs succeed as canonical_v2_staging_reader ===
PASS  provisions=15 components=0 claims=16 relationships=0 open_world_candidates=0 open_world_occurrences=0 open_world_evidence=0 conditional_fee_values=0

ALL CHECKS PASSED
```

Rerun against the synthetic fixture's `document_hash`
(`3453966958619a61b38c294c5ba03efed37e0cf34354cfc1d0958596e0765dc5`) to prove
the open-world path too: `provisions=1 components=0 claims=1 relationships=0
open_world_candidates=1 open_world_occurrences=1 open_world_evidence=1
conditional_fee_values=0`, all four checks PASS.

**Independently, via raw `psql`** (before the JS proof script existed, kept
as a second, driver-independent confirmation): connected as `postgres`
(table owner), `SET ROLE canonical_v2_staging_reader` then called each RPC
directly -- succeeded, returned the same counts. `SET ROLE anon` /
`service_role` / `canonical_v2_writer` / `canonical_v2_serving` (also
checked, though not named in the acceptance list -- confirms
`canonical_v2_serving` is genuinely excluded too, not merely undocumented)
all produced `ERROR: permission denied for function
canonical_v2_staging_read_provision_instances`. A direct
`SELECT * FROM canonical_v2_staging.provision_instances` as
`canonical_v2_staging_reader` produced `ERROR: permission denied for schema
canonical_v2_staging` -- proving there is no table-grant escape hatch, only
the function boundary.

**The positive check, proven by insertion.** Inserted a synthetic QXO-era row
directly into `open_world_candidates` for the fixture's `document_hash`:
`schema_version: 'NOVEL_CONCEPT_CANDIDATE/V1'`, no `evidence_governance`
field at all (the shape a pre-marker QXO row actually has). Before the
insert, `canonical_v2_staging_read_open_world_candidates` returned 1 row for
that `document_hash`; after, the raw table has 2 rows for it (confirmed by a
table-owner count) but the RPC still returns exactly 1 -- the QXO row is
invisible through the function, not mislabelled, exactly as the ruling
requires.

**Mechanical audit** (the file's own verification block, run against the
container): `pg_policies` for `canonical_v2_staging` -- 0 rows.
`information_schema.role_table_grants` for `canonical_v2_staging` scoped to
`grantee = 'canonical_v2_staging_reader'` -- 0 rows (the query is
deliberately scoped to the new role rather than the whole schema: the table
OWNER's implicit privileges always appear in this view regardless of any
`REVOKE`, so an unscoped query could never mechanically read as zero even in
a correctly locked-down database -- this is documented in the SQL file's own
comment, corrected after first writing an unscoped version and seeing owner
rows). `information_schema.role_routine_grants` for the 8 new functions,
excluding each function's own self-granted owner row (`grantor = grantee`,
the same unrevokable-owner-privilege phenomenon) -- exactly 8 rows, each
`grantee = canonical_v2_staging_reader`.

## Targeted tests, exit codes

```
CI=true node --test \
  tests/canonical-v2-local-staging-deal-reader.test.js \
  tests/canonical-v2-staging-deal-reader-hosted-interface.test.js \
  tests/canonical-v2-staging-read-sql-drift.test.js \
  tests/canonical-v2-open-world-serving-boundary.test.js \
  tests/canonical-v2-open-world-write-boundary.test.js
# tests 56, pass 56, fail 0, exit 0
```

`bash scripts/lint/forbidden-patterns.sh .` -- `INVARIANT-4: PASS`, exit 0.

## What the ruling asked for that I did NOT implement, or implemented
differently

- The ruling's own prose estimates "the six reads the local prototype
  already performs". The actual count is eight distinct query shapes
  (`provision_instances` is one of them, reused by both the governed-claims
  and relationships reads, which may be where "six" came from if counted by
  caller rather than by query shape). Implemented all eight as separate,
  narrowly-scoped RPCs rather than collapsing any two, since each maps to a
  distinct real predicate and collapsing them would either overfetch or
  reintroduce a hand-rolled union inside one function.
- The positive governed/open-world predicate is applied to the three
  functions the ruling names explicitly (claims, and the three open-world
  reads). `provision_instances`, `provision_components`,
  `relationship_revisions` and `conditional_termination_fee_values` carry no
  equivalent predicate, because nothing in the ruling or the current schema
  describes a second grammar sharing those tables the way
  `open_world_candidates`/`claim_revisions` share theirs with QXO-era rows --
  adding an invented predicate there would be scope beyond what was ruled,
  not scope matching it.
- Did not create or bind any real credential, apply this SQL to a hosted
  database, or touch `pm-pg3`/`pm-pg4`. All verification is against a
  throwaway container (`pm-pg-2b2`) created for this task.
