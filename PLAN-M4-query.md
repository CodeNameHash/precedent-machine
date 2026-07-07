# M4 — Query surface works

Goal: `/query` cross-cutting queries return correct answers on the schema-first data. Query UI is polished enough to demo. Reconciliation-tagged events (G6) surface in query results.

Absorbs taxonomy gap G6 (reconciliation log typed events) and G7 (normalizer citation).

## Exit criteria

- 20 canned demo queries (in `lib/query/fixtures/demo-set.json`) return the correct answers against the full 40-deal corpus.
- Query UI at `/query` supports: text input, saved-query list, results table with per-row provenance drilldown, CSV export.
- Query results include an "evidence" column that resolves through the reconciliation log (G6) so a raw string like "Material Adverse Effect (as defined in Section 3.1)" resolves to the canonical MAE provision.
- Normalizer citation (G7): every query result cell shows a badge indicating which normalizer version produced the underlying canonical value.
- Query executor unit tests + fixture-based integration tests green in CI.

## WPs in M4

### WP-M4-01: Reconciliation-tagged events (G6)

- Ships:
  - `docs/reconciliation-log.jsonl` — append-only typed event log; every canonical mapping decision emits one event
  - Event shape: `{ts, event_type, raw_string, canonical_key, decided_by, evidence[]}`
  - `lib/query/executors/*.js` reads the log to resolve raw → canonical during query time
- Classification: **mechanical** (log format was already implicit; this makes it explicit)
- Branch: `wp/m4-01-reconciliation-tagged`

### WP-M4-02: Normalizer citation (G7)

- Ships:
  - Every query result cell carries `{value, normalizer, normalizer_version}`
  - Renderer surfaces the normalizer badge; hover shows normalizer + version
  - Query result JSON schema updated
- Classification: **mechanical**
- Branch: `wp/m4-02-normalizer-citation`

### WP-M4-03: Query executor completeness for demo set

- Ships:
  - Every query in `lib/query/fixtures/demo-set.json` (20 canonical demo queries) resolves end-to-end
  - Missing executors get implemented; missing canonical fields get extractor fills (each canonical field addition is a **canonical** classification PR — one Queue entry per field)
  - Full fixture-based integration test green
- Classification: **mixed** — executor implementations are mechanical; canonical field additions are canonical (Ben-review).
- Branch: `wp/m4-03-query-completeness`

### WP-M4-04: Query UI polish

- Ships:
  - `/query` page: input, saved-query dropdown, results table, per-row provenance drilldown drawer, CSV export
  - Uses design tokens from M5-01 (or drops in a stub if M5 hasn't landed the tokens yet)
- Classification: **mechanical**
- Branch: `wp/m4-04-query-ui`

## Ben interruptions in M4

- N queue entries in WP-M4-03 for each new canonical field added to satisfy a demo query. Estimated 3-6 clicks.

Everything else in M4 is mechanical.

## Handoff to M5

M5 (UI homogenization) is a mostly-independent track — can run in parallel with M4 from the start, but M4-04 (query UI polish) depends on M5-01 (design tokens). Order: M5-01 first, then M4-04 uses the tokens.
