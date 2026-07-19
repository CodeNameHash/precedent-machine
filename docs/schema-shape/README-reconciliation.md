# Reconciliation log — file map and event shape

WP-4 (M4-01) delta. Prior work (typed-event log, reconcile UI, decision API,
alias registry, read-path resolution, bypass lint) is already in place — see
`docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md` §5 for the audit
conclusion. This doc covers what that plan section adds: `decided_by`
actor tracking, `claim_ids[]` linkage, and the `_meta.version` bump on the
normalized registry, plus the operational constraints around all of it.

## File locations

| File | Role |
| --- | --- |
| `docs/schema-shape/reconciliation-queue.json` | Unresolved/resolved queue entries (one per raw-value-needs-a-canonical-key row). Mutated in place by a decision — resolved entries get `status: 'RESOLVED'` and a `resolution` object. |
| `docs/schema-shape/normalized-v1.json` | The registry of triples (`deal_id`, `field_key`, `raw_value`, `canonicalKey`, ...) plus a top-level `_meta` object. A MERGE/PROMOTE decision sets `canonicalKey` on the matching triples. |
| `docs/schema-shape/reconciliation-log.jsonl` | Append-only decision log, one JSON object per line. This is the durable event history — the queue/registry files are current-state snapshots, this file is the audit trail. |

Logic lives in `lib/schema-shape/reconcile-decide.js` (pure, no fs/network —
unit-testable directly, see `tests/schema-shape/reconcile-decide.spec.js`)
and `lib/schema-shape/registry-version.js` (the version-bump function).
`pages/api/admin/reconcile/decide.js` is a thin route wrapper: it reads the
three files above, calls `applyResolution`, and writes the results back —
see that file for the read/write/rollback-on-error sequence.

## Event shape (`reconciliation-log.jsonl` rows)

Each line is one JSON object. As of WP-4:

```json
{
  "id": "log-1752624000000",
  "action": "MERGE",
  "field_key": "goShopPresent",
  "raw_value": "YES",
  "targetCanonicalKey": "GO_SHOP",
  "rationale": "Standardizing on GO_SHOP for affirmative go-shop language.",
  "decided_by": "ben",
  "touched": ["q1", "q2"],
  "claim_ids": ["t1", "t2"],
  "registry_version": "normalized-v1.1",
  "resolved_at": "2026-07-19T00:00:00.000Z"
}
```

- `decided_by` — the actor who made the decision. Resolved server-side in
  `resolveDecidedBy` (`lib/schema-shape/reconcile-decide.js`), following the
  same pattern as the Correct tab
  (`docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md`,
  `lib/corrections/editor-keys.js`): an `x-editor-key` header resolves
  through the `EDITOR_KEYS` env var to a named editor first; absent/invalid
  key falls back to a free-text `decided_by` sent by the client; absent
  both, the event still records the explicit string `"unknown"` rather than
  omitting the field. Reconcile decisions are not gated on having an
  approved key (unlike the Correct tab's pending-vs-applied split) — the
  whole route is already restricted to local-only execution (see below), so
  every decision commits regardless of actor.
- `claim_ids` — the ids of the `normalized-v1.json` triples this decision
  touched. `touched[]` (queue entry ids) and triple ids live in different id
  spaces, so linkage is resolved by the shared
  `deal_id|field_key|raw_value` key both the queue entry and the triple
  carry — the same join the `canonicalKey` mutation uses. This makes a
  claim's canonical-history queryable: `grep` the log for a `claim_ids`
  entry containing a given triple id to find every reconciliation decision
  that touched it.
- `registry_version` — the `normalized-v1.json` `_meta.version` value
  *after* this decision's bump (see below). Redundant with re-reading
  `normalized-v1.json`, but keeps the log self-contained for history
  queries without cross-referencing the registry snapshot.

**Backward compatibility.** All of the above fields are additive. Rows
written before this delta only have
`{id, action, field_key, raw_value, targetCanonicalKey, rationale, touched,
resolved_at}` — no `decided_by`/`claim_ids`/`registry_version`. Every reader
of this file must keep treating those keys as optional. (A handful of much
older rows in this same file, from the phase-0 migration, use an entirely
different shape — `decision_id`/`decision`/`from`/`to`/`phase_scope` — this
file has always been append-only and heterogeneous across producers; new
readers should not assume a single row shape.)

## `normalized-v1.json` — `_meta.version`

`normalized-v1.json` already had a `_meta` object (source files, entry
counts, phase notes — see `scripts/schema-shape/version-pin-check.js`,
which already gates on `_meta.stored_value_shape`). WP-4 adds a `version`
key to that same object, starting at `"normalized-v1.0"`.

**Bump rule.** `lib/schema-shape/registry-version.js`'s `bumpVersion(current)`
is pure: parses `normalized-v1.<n>`, returns `normalized-v1.<n+1>`; anything
unparseable (missing, corrupt, pre-versioning) resets to
`"normalized-v1.0"` rather than throwing — a decision should never fail to
write because the version marker is malformed. `decide.js` calls this on
every successful decision (`applyResolution` in `reconcile-decide.js`), so
the version increments once per POST to `/api/admin/reconcile/decide`,
regardless of how many queue entries that POST resolved.

**Why:** this feeds WP-3's per-cell `_prov.registry_version` provenance
badge (`docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md` §4) — a cell can
show which registry version resolved its canonical key. WP-3 is not wired up
by this change; only the version field and bump discipline are in place.

**Reader compatibility.** `_meta` is read defensively everywhere it's
consulted (grep the codebase for `normalized-v1.json` to find every reader —
as of this writing: `scripts/generate-registry.js`,
`scripts/schema-shape/{normalize,migrate-to-triples,reconcile-corpus,
version-pin-check,replay-reconciliation,audit-invariants}.js`,
`scripts/audit/legacy-vocab-references.js`,
`scripts/backfill/{promote-canonical,claims-from-normalized}.js`,
`scripts/schema-loss/*.js`, `scripts/reprocess/apply-reconciliation.js`,
`lib/admin/processing-flow-stages.js`, `lib/query/{resolve,derived-fields}.js`,
`lib/schema-loss/residuals.js`, `pages/api/admin/{audit/freeze,audit/matrix,
schema-loss/rerun}.js`, `pages/api/admin/reconcile/{queue,decide}.js`).
None of them destructure `_meta` exhaustively or assert its exact key set —
they read specific keys off it (`_meta?.stored_value_shape`,
`_meta?.source_files`, etc.) or merge into it with a spread
(`...(existing?._meta || {})`), both of which tolerate an unrecognized
sibling key. `tests/schema-shape/reconcile-decide.spec.js` asserts the
committed file's version-pin check still passes with `_meta.version`
present, and that a spread-merge doesn't drop it.

## Local-write-only constraint

`pages/api/admin/reconcile/decide.js` refuses to run when
`process.env.VERCEL` is set (`409`, "Reconciliation writes must run locally
so repo JSON artifacts can be committed."). This is unchanged by WP-4:
reconciliation writes mutate three checked-in JSON/JSONL files directly on
disk, which only makes sense against a local git working tree that a human
then commits and pushes — there is no server-side commit step, and Vercel's
filesystem is ephemeral/read-only per-request anyway. Do not remove this
gate; it is the only thing standing between "local repo write" and "silent
data loss on every deploy."

## Deferred: migrating the JSONL log to a DB table

**Not built in this delta — deliberately.** The reconciliation log,
queue, and registry snapshot are currently flat files, which is why
decisions can only be made locally (see above) and why production has no
way to *make* a reconciliation decision, only to read the resolved output
baked into the deployed `normalized-v1.json`/alias registry at build/deploy
time.

Migrating `reconciliation-log.jsonl` (and, likely, the queue) to a Supabase
table is the prerequisite for letting reconciliation decisions be made
*from* production — e.g. an admin approving a merge from the deployed
`/admin/registry/reconcile` UI instead of a local checkout. That requires:
resolving the current local-write-only gate into an actual write path
(table insert instead of `fs.writeFileSync`), a decision on how
`normalized-v1.json`'s triples get updated from a table-backed log (either
the file becomes derived/generated from the table, or both are
dual-written), and reconciling this with the file's existing heterogeneous
row shapes (see "Backward compatibility" above) so a migration script
doesn't have to special-case every historical producer.

This is out of scope for WP-4. Do not build it as part of this delta —
flagging it here per the plan (`docs/handoffs/M4-M5-RECONCILED-PLAN-
2026-07-18.md` §5, item 4) so it's visible when production reconciliation
becomes a real requirement.
