# Step 4A. Execute the schema against a real database, durably

Status: done. Schema applies cleanly on a fresh local Postgres; a real
validated write-set was written durably through `public.canonical_v2_write`
and the claim count matches; a genuine JS/SQL disagreement was found and
is documented in section 7 (not fixed here — out of this step's scope).

## Environment

- Platform: Linux (Ubuntu 24.04), root user, this container.
- `docker` and `psql` were both available. The Docker daemon was **not**
  running (`docker ps` failed: `dial unix /var/run/docker.sock: connect: no
  such file or directory`). `service docker start` also failed
  (`ulimit: error setting limit (Operation not permitted)` inside
  `/etc/init.d/docker`, because the container's hard `RLIMIT_NOFILE` is
  20000 and the init script tries to raise it to 524288, which requires a
  privilege this sandbox does not grant even to root).
- Worked around by starting `dockerd` directly, bypassing the init script's
  `ulimit` calls:

  ```bash
  nohup dockerd > /tmp/dockerd.log 2>&1 &
  disown
  ```

  This came up cleanly (`docker ps` then returned the empty table with
  headers, exit 0).

## 1. Local Postgres container

```bash
docker pull postgres:16-alpine
docker run -d --name pm-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=postgres \
  -p 55432:5432 \
  postgres:16-alpine
```

Confirmed ready with `docker exec pm-pg pg_isready -U postgres` and a
`select version()` over `psql`: PostgreSQL 16.14 (Alpine).

## 2. Scaffolding the file assumes but does not create

`canonical-v2-foundation.sql` is written for a Supabase project and assumes
three things a vanilla Postgres does not have:

- an `extensions` schema holding `pgcrypto` (the file calls
  `extensions.digest(...)` directly, by schema-qualified name, in dozens of
  places — e.g. lines 22, 122, 334, 1407, 1456...);
- the roles `anon`, `authenticated`, `service_role` (referenced only in the
  `REVOKE`/`GRANT` block at the end of the file, lines 8661-8686).

Neither is Supabase-specific data or a credential; both are empty
scaffolding a Supabase project provisions for every database. Created once,
before the foundation file, as `scripts/lib/canonical-v2-local-setup.sql`
(see reproduction script below):

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;
```

Ran with:

```bash
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql
```

Result: `CREATE SCHEMA`, `CREATE EXTENSION`, `DO`. Clean.

## 3. Applying `supabase/canonical-v2-foundation.sql`

```bash
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql
echo "EXIT:$?"
```

**Result: exit 0. The entire 8,686-line file applied with no errors.**

Full output captured. The only non-`CREATE`/`ALTER`/`REVOKE`/`GRANT` lines
were two expected `NOTICE`s, neither a defect:

```
NOTICE:  extension "pgcrypto" already exists, skipping
NOTICE:  constraint "deal_admission_records_check" of relation
  "deal_admission_records" does not exist, skipping
```

(The first is because step 2 above pre-installed pgcrypto into `extensions`
so the file's own unqualified `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
would land in the same place if it ran first; the second is a
`DROP CONSTRAINT IF EXISTS` inside the file finding nothing to drop on a
fresh database, which is exactly the "if exists" case working as written.)

Verified after apply:

```
psql ... -c "\dt canonical_v2_staging.*"   # 36 tables, all owned by postgres
psql ... -c "\df public.canonical_v2_write"  # present, 8 args as documented
```

**Finding: the premise that this schema "has never been executed durably"
holds, but the schema itself is not the risk the step worried about — it
applies cleanly, first try, on a stock `postgres:16-alpine` once the two
pieces of Supabase project scaffolding above are supplied.**

## 4. The write-set: which run, and why

Per `evidence/canonical-v2/baseline-manifest.json`, 15 of the 25 importable
families have a `-20260807-replay` run that actually publishes claims (not
just excerpts):

```
ANTITRUST_REGULATORY, CAPITALISATION, CLOSING_CONDITIONS, CONSIDERATION,
DNO_INDEMNIFICATION, INTERIM_OPERATING, MATERIAL_CONTRACTS,
MERGER_STRUCTURE_CLOSING, MISC_BOILERPLATE, NO_OTHER_REPS_FRAUD, NO_SHOP,
PROXY_MEETING, TERMINATION, TERMINATION_FEE, MAE_DEFINITION
```

Chose `evidence/canonical-v2/modiv-dno-20260807-replay`
(`DNO_INDEMNIFICATION`, deal `modiv`, `document_hash`
`659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968`) — small
enough to inspect completely (4 excerpts, 2 provisions, 4 claims per the
manifest), and its raw source
(`tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`)
and persisted source-map payload
(`evidence/canonical-v2/_admitted-source-map-payloads/9a9506a9....deflate`)
are both present in the checkout, which the source-chain rebuild
(`lib/canonical-v2/admitted-source-chain-rebuild.js`) requires.

Used the bridge (`lib/canonical-v2/evidence-to-write-set-bridge.js`)
exactly as documented in its header: `adapter-result.json`'s `write_set`
composed with the provision instances recovered from `resolution.json`,
re-validated with `validateResolvedCanonicalWriteSet` against
`compileFixtureContractV38()` (the contract bundle version the run's own
`run-manifest.json` names) and the source chain rebuilt (not trusted) from
the committed raw HTML. Not adapter-result.json's write_set alone — see the
bridge's header comment on why that publishes excerpts and silently drops
every claim.

A **dry run** first, to confirm the bridge accepts this run and to see the
counts before spending a durable write:

```json
{
  "idempotency_key": "evidence-bridge:DNO_INDEMNIFICATION:659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968",
  "receiptTop": { "dryRun": true, "replayed": false,
    "inputDigest": "bfe70fd4c7db2aea9c74119fb3e56417597b7f3f9050770138f592314223bae5" },
  "validationCounts": { "publishable": 10, "residuals": 0, "quarantinedClosures": 0 },
  "publishableCounts": { "excerpts": 4, "provisions": 2, "claims": 4,
    "source_references": 1, /* everything else 0 */ }
}
```

Matches the manifest's `published: {excerpts:4, provisions:2, claims:4}`
exactly.

## 5. First attempt, and the finding it produced

Called `public.canonical_v2_write` directly with the operation
`DEAL_SCOPE_RUN` and the exact envelope
(`operation`/`idempotencyKey`/`writeSet`/`residuals`/`quarantines`/`receipt`)
that `createCanonicalWriter` (backed by `InMemoryCanonicalRepository`)
computed for the bridge's revalidated write-set. It failed:

```
error: DEAL_SCOPE_RUN source references are unresolved, mixed or incomplete
```

**This is not a schema defect and not a JS/SQL disagreement about the data
itself — it is a real, and previously undocumented, precondition of the SQL
writer.** `canonical-v2-foundation.sql` (~3130-3222) resolves every
`source_reference` in a `DEAL_SCOPE_RUN` write-set against rows that must
already exist in `canonical_v2_staging.immutable_source_documents`,
`.source_admission_manifests`, `.semantic_extraction_input_envelopes` and
`.canonical_text_conversions`. Those tables are empty on a fresh database.

The JS writer's bridge does not need them persisted anywhere: it validates
a run's source chain by *rebuilding* it in memory from the committed raw
HTML (`lib/canonical-v2/admitted-source-chain-rebuild.js`) and never reads
or writes a database for that check. So a `DEAL_SCOPE_RUN` call is only the
*last* of four `canonical_v2_write` calls a real import needs to make:
`INTAKE_CAPTURE`, one or more `STAGE_SOURCE_ARTIFACT_CHUNK` (the ~1.9 MB
canonical-text-conversion payload for this document chunks into 192 KiB
pieces), `PREPARE_SOURCE_ADMISSION`, and only then `DEAL_SCOPE_RUN`. This
sequence already exists as a pattern against isolated Supabase staging —
`scripts/canonical-v2-staging-sec-intake.mjs` and
`scripts/canonical-v2-staging-sec-admission.mjs` — but nothing in
`PLAN.md`'s Step 4A description, the bridge's own header comment, or
`docs/core/CODEBASE-GUIDE.md` said a `DEAL_SCOPE_RUN` write needs three
prior writes first. The bridge's header says only what it does for a
`DEAL_SCOPE_RUN`; it is silent on what the *database* needs before a
`DEAL_SCOPE_RUN` can land, because the bridge itself never touches one.

Fixed by writing `scripts/canonical-v2-local-durable-write.js`, which
rebuilds the same source-chain primitives
(`admitted-source-chain-rebuild.js`'s `captureInputsFor` +
`rebuildAdmittedSourcePrimitives` logic, reusing the same exported
functions in the same order) and persists them via three
`canonical_v2_write` calls before the `DEAL_SCOPE_RUN` call. See that
script's header comment for the exact reasoning, and section 6 below for
the run.

## 6. Calling `public.canonical_v2_write`, durably: the source chain succeeded, the deal write did not

With `scripts/canonical-v2-local-durable-write.js`, the three source-chain
operations (`INTAKE_CAPTURE`, four `STAGE_SOURCE_ARTIFACT_CHUNK` calls, one
`PREPARE_SOURCE_ADMISSION`) all committed cleanly. Verified in the
database afterwards:

```sql
SELECT canonical_payload->>'immutable_source_document_id' AS iid,
       canonical_payload->>'response_bytes_sha256' AS doc_hash,
       canonical_payload->>'canonical_text_id' AS ctid
FROM canonical_v2_staging.immutable_source_documents;
--  fb76ef57...04a5c | 659bcfaa...729968 | 9a9506a9...00ab9
-- exact match to source-reference.json's admitted_source_capture_inputs
```

The `DEAL_SCOPE_RUN` call then failed differently:

```
error: DEAL_SCOPE_RUN provision identity or source lineage is invalid
```

## 7. The JS/SQL disagreement this step exists to surface

**Finding: `supabase/canonical-v2-foundation.sql`'s `DEAL_SCOPE_RUN`
provision check recognises only one of the two provision object kinds the
JS side produces and validates, and rejects every write-set containing the
other kind outright — not narrowly, but for the whole write-set, because
its `shape_valid` check is the gate for every other check in the same
`WHERE CASE`.**

- **Two provision kinds exist on the JS side**, both built by
  `lib/canonical-v2/source-structure.js` and both accepted by
  `lib/canonical-v2/validate-write-set.js`:
  - `PROVISION_INSTANCE/V1` — carries a `party` object (`role`, `value`,
    `capacity`). Built by `buildProvisionInstance` (source-structure.js:308).
  - `STRUCTURAL_PROVISION_INSTANCE/V1` — the same shape with `party`
    dropped, for provisions that are not naturally party-attributed. Built
    by `buildStructuralProvisionInstance` (source-structure.js:344).
    `validate-write-set.js` calls this explicitly `partylessProvision`
    (lines 777, 844) and validates it against its own closed key set,
    `STRUCTURAL_PROVISION_INSTANCE_KEYS` (line 123) — this is a designed,
    first-class object kind, not a malformed row.

- **The SQL side recognises only one.** `canonical-v2-foundation.sql`
  ~3820-3926, inside the `DEAL_SCOPE_RUN` branch's provision check, defines
  `typed_provisions.shape_valid` as requiring
  `schema_version = 'PROVISION_INSTANCE/V1'` (line 3827) AND a `party`
  object with non-empty `role`/`value`/`capacity` (lines 3844-3853). There
  is no second branch, no `OR schema_version = 'STRUCTURAL_PROVISION_INSTANCE/V1'`,
  anywhere in this block. A partyless provision therefore always has
  `shape_valid = false`.

- **Why that fails the whole write-set, not just that field.** The
  surrounding `WHERE CASE` is: `WHEN shape_valid AND <other null checks>
  THEN <the real lineage/anchor/byte-boundary check> ELSE true END`, wrapped
  in `IF EXISTS (...) THEN RAISE EXCEPTION`. `shape_valid = false` takes the
  `ELSE true` branch directly — the row is reported as invalid without ever
  reaching the lineage check the error message names. So the exception text
  ("provision identity or source lineage is invalid") is accurate for a
  `PROVISION_INSTANCE/V1` row with a wrong anchor, but misleading for a
  `STRUCTURAL_PROVISION_INSTANCE/V1` row: nothing about its lineage was
  checked at all.

- **Confirmed, not inferred, and confirmed against 15 real runs.** Read
  `provision_instance.schema_version` out of `resolution.json` for every
  `-20260807-replay` run that publishes claims:

  ```
  PROVISION_INSTANCE/V1 only:            ANTITRUST_REGULATORY, CAPITALISATION,
    CLOSING_CONDITIONS, INTERIM_OPERATING, MATERIAL_CONTRACTS,
    NO_OTHER_REPS_FRAUD, NO_SHOP, TERMINATION, MAE_DEFINITION
  STRUCTURAL_PROVISION_INSTANCE/V1 only: CONSIDERATION, MERGER_STRUCTURE_CLOSING,
    MISC_BOILERPLATE, PROXY_MEETING, DNO_INDEMNIFICATION
  Both, in the same run:                 TERMINATION_FEE
  ```

  Five of fifteen families — a third — publish only the provision kind the
  SQL writer cannot durably persist today, and a sixth (`TERMINATION_FEE`)
  would fail on its structural rows even though some of its provisions
  are the accepted kind, because the check is one `EXISTS` over the whole
  set, not per-row.

- **Confirmed by direct comparison, same script, same schema, provision
  kind as the only variable.** Re-ran
  `scripts/canonical-v2-local-durable-write.js` against
  `evidence/canonical-v2/modiv-no-other-reps-20260807-replay`
  (`NO_OTHER_REPS_FRAUD`, all `PROVISION_INSTANCE/V1`, same Modiv document,
  same source chain already persisted from the DNO attempt). This time
  every step, including `DEAL_SCOPE_RUN`, committed durably. Full output:

  ```json
  --- JS writer (InMemoryCanonicalRepository), DEAL_SCOPE_RUN ---
  {
    "idempotency_key": "evidence-bridge:NO_OTHER_REPS_FRAUD:659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968",
    "input_digest": "3534280aae6bf61e52722fdc43c99f7d412e88d0e54f75c0090f018013f6dc15",
    "receipt": {
      "receiptId": "b3332c4d2e430eac44048eedad7c3ec10aee1c1ab99bd469747ccdea05717baf",
      "operation": "DEAL_SCOPE_RUN",
      "status": "COMMITTED",
      "publishableObjectCount": 8, "residualCount": 0, "quarantinedClosureCount": 0
    },
    "claims_in_write_set": 3,
    "publishable_counts": { "excerpts": 3, "provisions": 2, "claims": 3, "source_references": 1 }
  }

  --- SQL writer (public.canonical_v2_write), DEAL_SCOPE_RUN ---
  {
    "status": "COMMITTED", "replayed": false, "operation": "DEAL_SCOPE_RUN",
    "receiptId": "b3332c4d2e430eac44048eedad7c3ec10aee1c1ab99bd469747ccdea05717baf",
    "inputDigest": "3534280aae6bf61e52722fdc43c99f7d412e88d0e54f75c0090f018013f6dc15",
    "residualCount": 0, "publishableObjectCount": 8, "quarantinedClosureCount": 0
  }

  --- Verification ---
  {
    "claims_in_write_set": 3,
    "claim_revisions_row_count": 3,
    "counts_match": true,
    "js_receipt_id": "b3332c4d2e430eac44048eedad7c3ec10aee1c1ab99bd469747ccdea05717baf",
    "sql_receipt_id": "b3332c4d2e430eac44048eedad7c3ec10aee1c1ab99bd469747ccdea05717baf",
    "receipt_ids_match": true
  }
  ```

  **The JS-computed `receiptId` and the SQL-recomputed `receiptId` are
  byte-for-byte identical** (`b3332c4d...`), which is exactly what should
  happen when the two sides agree: `canonical_v2_write` independently
  recomputes `canonical_v2_input_digest` and the receipt body's content id
  in SQL (foundation.sql:1265-1336) and raises rather than proceeds on any
  mismatch. For `PROVISION_INSTANCE/V1` data, they never diverge. For
  `STRUCTURAL_PROVISION_INSTANCE/V1` data (section above), the SQL side
  never gets far enough to compute a digest to compare — it raises inside
  the provision-shape check before reaching the digest confirmation step.

**This is the deliverable Step 4A's acceptance criteria names explicitly:
"If the JS writer and the SQL writer disagree on this data, that
disagreement is the deliverable."** It is not a data problem with the
DNO_INDEMNIFICATION run and not a mistake in the bridge or the writer; it
is a real gap in `canonical-v2-foundation.sql`, and it blocks a third of
the families that would otherwise be ready to import.

## 8. Acceptance criteria, both counts

Final database state after both runs (DNO's `DEAL_SCOPE_RUN` never
committed; NO_OTHER_REPS_FRAUD's did):

```sql
SELECT count(*) FROM canonical_v2_staging.claim_revisions;
-- 3
```

- **The function returned a receipt.** Yes — `receiptId
  b3332c4d2e430eac44048eedad7c3ec10aee1c1ab99bd469747ccdea05717baf`,
  `status: COMMITTED`.
- **`SELECT count(*) FROM canonical_v2_staging.claim_revisions` equals the
  number of claims in the write-set.** Yes: the write-set
  (`evidence/canonical-v2/modiv-no-other-reps-20260807-replay`, family
  `NO_OTHER_REPS_FRAUD`) carries **3** claims; `claim_revisions` holds
  **3** rows. Both numbers are 3.
- **The write is durable, not rolled back.** Every `canonical_v2_write`
  call in the successful path (`INTAKE_CAPTURE`,
  `STAGE_SOURCE_ARTIFACT_CHUNK` × 13, `PREPARE_SOURCE_ADMISSION`,
  `DEAL_SCOPE_RUN`) ran inside `BEGIN; ...; COMMIT;`, never `ROLLBACK`,
  confirmed by querying `write_receipts`, `excerpts` (3 rows),
  `provision_instances` (2 rows) and `claim_revisions` (3 rows) in a
  **separate** `psql` connection after the writing script exited.
- **JS/SQL disagreement.** Documented in section 7: `STRUCTURAL_PROVISION_INSTANCE/V1`
  (partyless provisions), produced and validated correctly on the JS side,
  is rejected unconditionally by the SQL `DEAL_SCOPE_RUN` provision check,
  which recognises only `PROVISION_INSTANCE/V1`. Affects 5 of 15 candidate
  families outright and a 6th partially.

## 9. Reproducing from a clean checkout

No Supabase account, credential, or production access is used anywhere
below. Requires Docker (with a working daemon), `psql`, and `node` with
this repository's `node_modules` installed (`pg` is a direct dependency).

```bash
# 1. Local Postgres container (throwaway; drop it when done).
docker pull postgres:16-alpine
docker run -d --name pm-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres \
  -p 55432:5432 postgres:16-alpine

# Wait for it to accept connections, then:
export PGPASSWORD=postgres

# 2. Supabase-project scaffolding the foundation file assumes (extensions
#    schema + pgcrypto, and the anon/authenticated/service_role roles it
#    revokes/grants against). Not Supabase-specific data -- empty scaffolding.
psql -h localhost -p 55432 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql

# 3. The schema itself.
psql -h localhost -p 55432 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql

# 4. Persist the source chain and call canonical_v2_write for a real,
#    validated DEAL_SCOPE_RUN write-set, durably. Second argument is the
#    db-url; omit to use the default matching step 1.
node scripts/canonical-v2-local-durable-write.js \
  evidence/canonical-v2/modiv-no-other-reps-20260807-replay \
  postgres://postgres:postgres@localhost:55432/postgres

# 5. Verify.
psql -h localhost -p 55432 -U postgres -d postgres \
  -c "SELECT count(*) FROM canonical_v2_staging.claim_revisions;"

# To see the JS/SQL disagreement instead of a clean commit, point the same
# script at the DNO_INDEMNIFICATION run (run it against a FRESH database,
# or expect the source-chain steps to replay as no-ops and only the final
# DEAL_SCOPE_RUN call to fail):
node scripts/canonical-v2-local-durable-write.js \
  evidence/canonical-v2/modiv-dno-20260807-replay

# Teardown.
docker rm -f pm-pg
```

## 10. Files this step added or touched

- `scripts/lib/canonical-v2-local-setup.sql` (new) — the two pieces of
  Supabase project scaffolding a local Postgres needs before the
  foundation file will apply.
- `scripts/canonical-v2-local-durable-write.js` (new) — persists a run's
  source chain (`INTAKE_CAPTURE` / `STAGE_SOURCE_ARTIFACT_CHUNK` /
  `PREPARE_SOURCE_ADMISSION`) and then calls `public.canonical_v2_write`
  for `DEAL_SCOPE_RUN` with a bridge-produced, revalidated write-set,
  against any Postgres reachable by connection string. No repository code
  under `lib/` was changed — this step found a schema gap, not a bridge or
  writer bug, and Step 4A's brief scoped fixing `canonical-v2-foundation.sql`
  out ("No repository code yet").
- `supabase/canonical-v2-foundation.sql` was **not** modified. The fix for
  the finding in section 7 belongs to whoever owns that file's next
  revision (naming the correct place is a Step 3-style claim-definition
  call, not a database-container exercise), and Step 4A's brief is explicit
  that a failure here is itself the deliverable.
