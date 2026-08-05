# Query schemas

Each `<KIND>.json` file in this directory is the **payload** schema for
that query kind — validated client-side by the builder
(`pages/query/index.js`) and server-side against `GET /api/query/kinds`
before a query runs. It describes the request, not the response.

## Result JSON contract

The response shape (`{ kind, ...kind-specific fields }`) is produced by
`lib/query/engine.js#executeQuery`, dispatching to one executor per kind
under `lib/query/executors/`. There is no separate JSON Schema for results
today — the executor + the render switch in `pages/query/[kind]/[id].js`
(`ResultView`) are the source of truth for each kind's field names:

- `PROVISION_CROSS_CUT` — `{ provision_type, columns, rows: [{ ...dealColumn, card_id, cells: [{ value, verbatim_quote, quote_section_ref }] }] }`
- `MARKET_RANGE` — `{ provision_type, field_path, field_kind, n, stats, distribution, deal_points: [{ deal_id, card_id, value, verbatim_quote, quote_section_ref }] }`
- `FILTER_THEN_LIST` — `{ filters_applied, total_matches, rows: [{ ...dealColumn, columns, matched_provision_hits: [{ provision_type, card_id, field, value }] }] }`

`DEAL_COMPARE` and `DEAL_TO_MARKET` were retired as query kinds — deal-vs-deal
and deal-vs-market comparison now live on the review page's own compare mode
and market columns (`pages/review/[id].js`,
`components/review-v2/CompareColumn.jsx`), not through this query engine.
`lib/query/executors/deal-compare.js` and `deal-to-market.js` still exist and
are still directly tested (several canonical-v2 product-parity tests import
them as pure functions), but `lib/query/engine.js` no longer dispatches to
them and `pages/query/[kind]/[id].js`'s `ResultView` no longer renders them —
this directory has no `DEAL_COMPARE.json`/`DEAL_TO_MARKET.json` payload
schema for the same reason.

### `_prov` (WP-3 / M4-02, additive & optional)

Every **value-bearing** cell object above (i.e. one whose `value` — or
`deal_value` on `DEAL_TO_MARKET`'s scorecard rows, or `key_fields[].value`
on `DEAL_COMPARE` — is non-empty) may carry an additional `_prov` object:

```json
"_prov": {
  "canonical_key": "goShopPresent",
  "matched_key": "go_shop_present",
  "registry_version": "normalized-v1.0",
  "extraction_version": "m2-00-store-cards-v1",
  "extraction_run_id": "run-2026-07-14-01"
}
```

- `canonical_key` / `matched_key` — the registry's canonical feature key and
  the raw alias actually found on the provision (`resolveFeatureValue` in
  `lib/query/resolve.js`; identical when the raw key already is the
  canonical one).
- `registry_version` — `docs/schema-shape/normalized-v1.json`'s
  `_meta.version`, read once per query run (see
  `lib/query/resolve.js#registryVersion`), not once per cell.
- `extraction_version` / `extraction_run_id` — resolved by
  `pages/api/query/run.js` via `lib/query/prov.js#attachExtractionVersions`,
  one batched, read-only query per run against `provision_cards.provenance`
  (content-addressed on `(deal_id, spanHash(full_text))` — there is no
  foreign key between the legacy `provisions` table and `provision_cards`).
  These two fields are `null` when no matching card is found; they degrade
  gracefully rather than blocking the other three fields.

**Backward compatibility:** `_prov` is optional. Cells that predate WP-3, or
that come from any code path that hasn't been updated, simply omit it.
`lib/query/csv.js`'s `resultToCsvRows()` never reads `_prov` and must never
emit it — CSV export stays exactly as it was before this field existed
(see `tests/query/normalizer-badges.test.js`'s backward-compatibility
tests).
