# Step 2B, the read half

Status: done, locally. A generic reader reads validated claims and
open-world evidence out of `canonical_v2_staging` for a given deal, proven
against the real local container (`pm-pg`) with real written data for two
real families plus a synthetic fixture, round-tripped byte-identical through
`canonicalJson`, with the governed/open-world distinction preserved and
tested both hermetically and live.

This is the **local prototype only**. Hosted access design (`SECURITY
DEFINER` function versus grants plus RLS policies) is out of scope here per
`DECISIONS.md`'s "Waiting on Ben" item 1 and the standing action attached to
it — that goes to Fable as an adversarial design review, with this module as
the evidence, not decided here.

## The module and its entry point

**`lib/canonical-v2/local-staging-deal-reader.js`.** Entry point:
`readDealFromLocalCanonicalV2Staging({ client, documentHash, env, expectNonEmpty })`,
returning `{ document_hash, resolved, open_world, relationships }`.

- `resolved[]` is reassembled into `resolution.json`'s `resolved[]` shape —
  `resolved_claim_definition_key`, `concept_key`, `provision_instance`,
  `claim`, `section_reference` — the shape
  `termination-product-projection.js`'s `project()` already reads.
- `open_world[]` is an array of `{ candidate, occurrence, evidenceReferences }`
  bundles, the exact shape `lib/canonical-v2/open-world-evidence-serving.js`'s
  `buildOpenWorldEvidenceCard` already expects — proven directly, not just
  shape-compatible (see the "feeds ... directly" tests below).
- `relationships[]` joins `relationship_revisions` the same way as claims,
  implemented and unit-tested, but no importable run in this project's
  committed baseline publishes any relationship rows yet (checked directly:
  every family's `publishableWriteSet.relationships` is `[]`), so there is
  nothing durable to prove this path against today.

Lower-level exports for direct use/testing:
`readGovernedClaimsForDeal`, `readOpenWorldEvidenceForDeal`,
`readRelationshipsForDeal`.

It does **not** import `lib/canonical-v2/serving-client.js`. That module's
`validateConnectionString` hard-codes the Supabase pooler hostname (cannot
address a local container), and its `RPC_SPECS` read the Step 5A
corpus-release layer (`shared_serving_rows`/`active_corpus_release_pointers`,
zero rows) — the trap the task brief names explicitly. This module takes any
pg-compatible `client` (an object with `async query(text, values)`) and
issues direct `SELECT ... FROM canonical_v2_staging.<table> WHERE
canonical_payload->>'x' = $1 [OR ... = ANY($1::text[])]` queries.

It fails closed the same way every other Canonical V2 serving source does:
`isPermittedCanonicalV2Runtime` (`feature-flags.js`) is checked first, before
any query is issued (proven by a test that hands it a client whose `.query`
throws, in a production-shaped `env`, and confirms the throw is
`RUNTIME_NOT_PERMITTED` rather than the client's own error).

## Why it is reassembly, not translation, and the one field that does not survive

`canonical_payload` on every governed table (`excerpts`, `provision_instances`,
`provision_components`, `claim_revisions`) is the write-set item **verbatim**
— confirmed by direct inspection of rows in `pm-pg`, not assumed. So
`entry.claim` and `entry.provision_instance` in the reader's output are
byte-identical to what the writer received.

One field genuinely does not round-trip, and this is a real finding, not a
guess: `resolution.json`'s `resolved[]` entries carry `section_reference` at
the top level, but neither `CLAIM_REVISION_PAYLOAD_FIELDS` nor a provision
instance's persisted payload includes it — verified directly against a
written row in `pm-pg` (`SELECT canonical_payload FROM
canonical_v2_staging.provision_instances`: no `section_reference` key) and
against `native-write-set-adapter.js`'s field lists. The reader returns
`section_reference: null` rather than a stale or fabricated value.
`termination-product-projection.js`'s `project()` tolerates this (it only
ever assigns the field through, never requires it), so a card renders with
no section reference rather than a wrong one.

## Proof against the local container, real data, two families

`scripts/canonical-v2-local-staging-read-proof.js` is the live proof
(requires a running container); `tests/canonical-v2-local-staging-deal-reader.test.js`
is the hermetic, CI-safe test suite (see further down). Run the live proof:

```
node scripts/canonical-v2-local-staging-read-proof.js
```

Output (this run, against `pm-pg`, `postgres:16-alpine`, already carrying
Step 4A1's `modiv-no-other-reps` write from a prior session):

```
=== Part 1: two real Modiv families, real writer, real DB ===
  wrote NO_OTHER_REPS_FRAUD: claims=3 provisions=2 excerpts=3 sql_status=COMMITTED
  wrote ANTITRUST_REGULATORY: claims=13 provisions=13 excerpts=10 sql_status=COMMITTED

=== Part 1: read back through lib/canonical-v2/local-staging-deal-reader.js ===
PASS  NO_OTHER_REPS_FRAUD: all 3 claims written are present in the deal-level read (deal-level total: 16 claims, shared with other families on this document_hash)
PASS  NO_OTHER_REPS_FRAUD: every one of its claims round-trips byte-identical (canonicalJson) to what was written
PASS  ANTITRUST_REGULATORY: all 13 claims written are present in the deal-level read (deal-level total: 16 claims, shared with other families on this document_hash)
PASS  ANTITRUST_REGULATORY: every one of its claims round-trips byte-identical (canonicalJson) to what was written
PASS  deal-level read total (16) === sum of both families' written claims (16) -- proves document_hash, not deal_key, is the deal boundary
PASS  deal-level read: every governed claim carries no evidence_governance marker

=== Part 2: synthetic fixture, governed + open-world from one call ===
  built fixture: claims=1 open_world_candidates=1 open_world_candidate_occurrences=1 open_world_evidence_references=1
PASS  fixture: 1 governed claim read back
PASS  fixture: 1 open-world bundle read back
PASS  fixture: governed claim carries no evidence_governance marker
PASS  fixture: open-world candidate/occurrence/evidence all carry the marker
PASS  fixture: open-world candidate round-trips byte-identical (canonicalJson) to what was written

=== Part 3: fail-loud guards ===
PASS  reader throws EMPTY_DEAL_READ rather than reporting success for a deal with no data
PASS  reader refuses to run (and never queries) in a production-shaped environment

ALL CHECKS PASSED
```

Exit code 0. Idempotent — rerun twice, same result, no row growth (verified;
the fixture's deal identity is a fixed key, not timestamped, so `ON CONFLICT
DO NOTHING` actually dedupes across runs).

**Claim counts, written vs read, per family:**

| Family | Claims written (this run) | Claims present in deal-level read | Round-trip |
|---|---|---|---|
| `NO_OTHER_REPS_FRAUD` | 3 | 3 of 3 (subset of 16) | byte-identical |
| `ANTITRUST_REGULATORY` | 13 | 13 of 13 (subset of 16) | byte-identical |
| Deal-level total (`document_hash 659bcfaa…`) | 16 (3+13) | 16 | — |

Both families import through the **same real path** Step 4A proved:
`evidence-to-write-set-bridge.js`'s `importRunEvidence` (JS writer, in
memory) → `public.canonical_v2_write` (SQL writer, durable `COMMIT`), against
`pm-pg`. `sql_status: COMMITTED` for both. This is the identical mechanism
`scripts/canonical-v2-local-durable-write.js` uses; this proof script reuses
its exact chain-persistence recipe (`INTAKE_CAPTURE` →
`STAGE_SOURCE_ARTIFACT_CHUNK`* → `PREPARE_SOURCE_ADMISSION` →
`DEAL_SCOPE_RUN`) rather than duplicating a divergent one.

## A finding, stated because it is the one this task's own brief warned about

**Both families share one `document_hash`.** `NO_OTHER_REPS_FRAUD` and
`ANTITRUST_REGULATORY` are both Modiv (`659bcfaa017718ac735811861565fa2cd4e2
12657ba68e06ff1eab53e3729968`). A read by `document_hash` correctly returns
**both families' claims together** — 16, not 3 or 13 — because the reader is
deal-scoped, not family-scoped, exactly per the task brief's trap #2. The
proof script originally asserted "claims written by this family ===
total claims read" and that assertion **failed** on the first run — not
because the reader was wrong, but because the assertion encoded the mistake
the brief warned about. Fixed to assert per-family **subset containment**
(every claim this family wrote is present, byte-identical, in the deal-level
read) plus a separate deal-level total check. Recorded here rather than
silently corrected, per this programme's own convention.

## Round-trip proof, through `canonicalJson`

Every comparison above and in the hermetic test suite uses
`lib/canonical-v2/canonical-bytes.js`'s `canonicalJson`, never
`JSON.stringify`, specifically because Postgres reorders `jsonb` object keys
on output. Concretely: `canonicalJson(writtenClaim) ===
canonicalJson(readClaim.claim)` for every one of the 16 real claims, and for
the synthetic fixture's open-world candidate — compared against rows that
went through a real `jsonb` column and back, not an in-memory value.

## Governed vs. open-world: how the distinction survives, and how it's tested

**On the row, not inferred from the table.** Every open-world row this
reader returns still carries `evidence_governance:
UNGOVERNED_OPEN_WORLD_EVIDENCE`, verified on the way OUT (not just trusted
from the way in) by `assertOpenWorldRowGovernance` /
`assertGovernedRowHasNoOpenWorldMarker` (from the pre-existing
`open-world-evidence-serving.js`, reused rather than reimplemented) inside
the reader itself — a governed claim carrying the marker, or an open-world
row missing it, throws rather than being silently served.

**Proven live**, against real Postgres jsonb: the synthetic fixture's
governed claim comes back with no `evidence_governance` key at all; its
open-world candidate/occurrence/evidence rows all come back with the marker
— see Part 2 of the live proof output above.

**Proven hermetically**, in `tests/canonical-v2-local-staging-deal-reader.test.js`
(16 tests, all passing, `CI=true node --test
tests/canonical-v2-local-staging-deal-reader.test.js` exits 0):
- the marker is present on one kind and absent on the other, read back from
  the same fixture;
- a claim row hand-tampered to carry the marker is refused
  (`GOVERNED_ROW_CARRIES_OPEN_WORLD_MARKER`);
- an open-world candidate row missing the marker is refused
  (`MISSING_OPEN_WORLD_MARKER`);
- the reader's own output is fed **directly** (no adapter, no reshaping) into
  `buildOpenWorldEvidenceCard` and `buildGovernedClaimSummaryCard` — the
  pre-existing serving-side reader this task's brief names as already
  built — and each produces the correct card shape.

The fixture used by both the live proof and the hermetic tests
(`tests/helpers/local-staging-read-fixture.js`) is not hand-typed JSON: it is
built by calling the real write-boundary code
(`native-producer/native-write-set-adapter.js`'s `buildNativeWriteSet`) on a
real provider call that emits one governed proposal and one
`proposal_kind: 'OPEN_WORLD'` proposal together — the identical pattern
`tests/canonical-v2-open-world-write-boundary.test.js` already uses to prove
the write boundary. Re-run as a regression check during this work
(`tests/canonical-v2-open-world-write-boundary.test.js`,
`tests/canonical-v2-open-world-serving-boundary.test.js`): still 10 and 6
tests passing respectively, unaffected.

## The empty-read guard

`expectNonEmpty: true` (the default) makes `readDealFromLocalCanonicalV2Staging`
throw `LocalStagingReadError('EMPTY_DEAL_READ', ...)` if every collection
comes back empty, rather than returning `{ resolved: [], open_world: [],
relationships: [] }` and reporting success. Proven three ways:
- live, against a `document_hash` that was never written (Part 3 of the
  script above);
- hermetically, against an empty fake-table set;
- hermetically, against the **real, populated** fixture tables queried under
  a **wrong** `document_hash` — proving the guard is live on a broken join,
  not just on a genuinely empty database.

## A finding: the committed replay directories cannot yet prove open-world data reaches the database

`DECISIONS.md` decision 2 ("emit open-world rows, flagged") is real in code:
`native-write-set-adapter.js`'s `buildNativeWriteSet` does emit marked
`open_world_candidates`/`open_world_candidate_occurrences`/
`open_world_evidence_references`/`open_world_candidate_dispositions` rows
when given a `resolution` with `open_world` entries — proven by the
pre-existing `tests/canonical-v2-open-world-write-boundary.test.js` and
reconfirmed by this task's own fixture and hermetic tests.

**But every one of the 25 committed run directories' `adapter-result.json`
files still shows zero open-world rows in the publishable write-set when
imported through the real bridge**, measured directly:

```
node -e "... importRunEvidence(..., dryRun:true) over every modiv-*-replay dir ...
  => open_world=0 for all 17 claim-publishing families checked"
```

The reason is not a regression — it is that `evidence-to-write-set-bridge.js`'s
`readRunEvidence` reads `adapter-result.json` **from disk**
(`evidence/canonical-v2/<run>/adapter-result.json`), a committed artefact
that was generated **before** the open-world-emission fix landed in
`native-write-set-adapter.js`. The fix is real and current; the 25 committed
run directories are frozen snapshots of an older adapter's output. Getting
real open-world rows for a real Modiv family into the database would require
either regenerating `adapter-result.json` (which needs the original run's
in-memory `run_receipt`, not persisted anywhere on disk — confirmed by
inspection, it is not part of `adapter-result.json`'s own keys) or a fresh
live/replay run through `native-extraction-run.js`. Both are write-half work
outside this task's scope, and reported here rather than silently worked
around, per this programme's standing rule about reading code rather than
inferring it from what a step's own note claims.

This is why the open-world proof above uses a synthetic fixture (built from
real write-boundary code, inserted directly into the tables using the exact
`(id, closure_id, canonical_payload)` column shape
`supabase/canonical-v2-foundation.sql`'s own INSERT statements use — grepped
directly, not assumed) rather than a Modiv family's real open-world data.
`scripts/canonical-v2-local-staging-read-proof.js`'s own header comment
states precisely what this does and does not prove.

## Governed claims for two real families: how they were written

Reused, not reinvented, Step 4A's exact recipe
(`scripts/canonical-v2-local-durable-write.js`): rebuild the admitted-source
chain from committed raw HTML
(`buildSecEdgarIntakeCapture`/`convertSecHtmlToCanonicalText`/
`verifySecHtmlCanonicalText`/`buildVerifiedSecSourceAdmission`), persist it
via `INTAKE_CAPTURE`/`STAGE_SOURCE_ARTIFACT_CHUNK`/`PREPARE_SOURCE_ADMISSION`
against `pm-pg`, then run `importRunEvidence` (JS writer) and
`public.canonical_v2_write` (SQL writer) for `DEAL_SCOPE_RUN`. Families
written durably this session: `modiv-no-other-reps-20260807-replay` (already
present from a prior session's Step 4A1 proof — 3 claims) and
`modiv-antitrust-20260807-replay` (written fresh this session — 13 claims,
13 provisions, 10 excerpts, `sql_status: COMMITTED`).

## Grants and RLS, confirmed rather than assumed

`pm-pg` has no `FORCE ROW LEVEL SECURITY` anywhere (checked: zero
occurrences in `supabase/canonical-v2-foundation.sql`), every governed and
open-world table has RLS enabled with `Policies (row security enabled):
(none)` (checked directly via `\d` on each table), and the connection this
reader used throughout is the table-owner (`postgres`) role on `pm-pg` — the
exact local shortcut `DECISIONS.md`'s "Waiting on Ben" item 1 names as an
absence, not a design. This module's header comment says so explicitly and
warns against carrying it into a hosted environment.

## Targeted tests and gates run this session

```
CI=true node --test tests/canonical-v2-local-staging-deal-reader.test.js
# tests 16, pass 16, fail 0   (exit 0)

node scripts/canonical-v2-local-staging-read-proof.js
# ALL CHECKS PASSED            (exit 0)

CI=true node --test tests/canonical-v2-open-world-write-boundary.test.js tests/canonical-v2-open-world-serving-boundary.test.js
# tests 16, pass 16, fail 0   (exit 0)  -- regression check, unaffected

bash scripts/lint/forbidden-patterns.sh
# INVARIANT-4: PASS            (exit 0)
```

None of `npm test`'s full suite was run, per this task's ground rules.
`scripts/canonical-v2-local-staging-read-proof.js` is a script, not a
`*.test.js` file, and is not picked up by `npm test`'s glob — same
convention as `scripts/canonical-v2-local-durable-write.js` and
`scripts/canonical-v2-step-4a3-conditional-fee-adapter-proof.js`, both of
which also require a live container and live outside the CI-run test glob
for that reason.

## Files touched

| File | What |
|---|---|
| `lib/canonical-v2/local-staging-deal-reader.js` | New. The reader. Entry point `readDealFromLocalCanonicalV2Staging`. |
| `tests/canonical-v2-local-staging-deal-reader.test.js` | New. 16 hermetic tests, no live DB dependency, part of `npm test`. |
| `tests/helpers/local-staging-read-fixture.js` | New. Shared fixture builder (real `buildNativeWriteSet` call, governed + open-world from one provider call), used by both the hermetic tests and the live proof script. |
| `scripts/canonical-v2-local-staging-read-proof.js` | New. Live proof against `pm-pg`: two real Modiv families through the real writer, the synthetic fixture inserted directly, all read back and checked. Not part of `npm test`. |
