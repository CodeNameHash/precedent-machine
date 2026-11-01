# DeepSeek work package 2: compare in the page, 2026-11-01

A dated work package note, not a plan authority. The executable checklist stays
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`.
The manager's PR 490 review was fixed on `deepseek/nav-index-compare-20261101`
and is merged into this branch; this note covers the package 2 work.

## Branch

`deepseek/compare-in-page-20261101`, cut from
`codex/product-implementation-plan-20260904` and with
`deepseek/nav-index-compare-20261101` merged in. PR back to the product branch;
no force-push, no secrets.

## Files

- `components/product/ProvisionTables.jsx` — the Compare and Everything
  toggles, `MarketContext`, `EverythingContext`, the quiet market line under
  each coded answer, and the market payload passed to the sidebar.
- `components/product/EvidenceSidebar.jsx` — the "How this compares" block
  above the Interpretation Tree, with navy bars and deal links; all existing
  blocks and testids are kept.
- `components/product/PublishedSummary.jsx` — carries `runId` to the tables.
- `lib/product/comparison-view.js` — the one normalised `buildTableView`
  view used by the comparison and the market read.
- `lib/product/comparison-read.js` — the view cache
  (`run_id:updated_at:review_version`), paged counts, the four-way draft read,
  and `loadReferenceViews`.
- `lib/product/comparison-tables.js` — `buildComparisonTablesFromViews`,
  `howCommonFromViews`, `marketDistribution` (re-exported), `marketLine`.
- `lib/product/comparison-handlers.js` and
  `pages/api/product/compare/market.js` — `GET /api/product/compare/market?run=`.
- `pages/analysed/index.js` and `pages/analysed/compare.js` — the package 1
  index defaults to comparable runs and shows the new built cells.
- `tests/product-compare-api.test.js` — package 1 blockers and the market API, 14 tests.
- `tests/product-compare-in-page.test.js` — market maths, the market API, the
  toggles, the market line, Everything and the sidebar block, 6 tests.

## The market read

`GET /api/product/compare/market?run=<id>` returns
`PRODUCT_COMPARE_MARKET/V1`: `run`, `total_runs`, `runs` (id to agreement
label) and `cells`. A key is `${table_key}|${row.subject}|${column_id}`; a
cell is `{ total, codes: { <code or value label>: { label, count, run_ids } } }`.
`total` is the runs that answer that table/row/column, so a one-deal row is
"alone", not 0 of every deal. A run counts once per code; a multi-value cell
contributes each value; value cells compare by label. The reference set is the
finished runs (a release or READY draft) plus the run being read, so a reader
on a PARTIAL draft sees where it sits without making it a default denominator.

The response is cached per process through the same `VIEW_CACHE` as the tables
and how-common routes. The API is `Cache-Control: private, no-store`; 400 for a
missing/invalid run, 401 unauthenticated, 404 run not accessible, 405 non-GET
with `Allow: GET`.

## The line, the sidebar and Everything

- `Compare` (`data-testid="compare-toggle"`) is off by default and remembered
  in `localStorage` under `pm-compare`; every access is in try/catch. On, a
  quiet line under each coded answer says `Market · 3 of 4 deals`,
  `Off-market · 1 of 4 · others: <modal labels>` or
  `No comparison · only deal with this row`. It is a button that opens the
  same cell in the sidebar. No new column, no new row.
- The sidebar's `How this compares` block (`data-testid="evidence-market"`)
  sits above the Interpretation Tree. It lists each reading with a count and a
  thin navy bar, marks the selected deal's own reading "This deal", and links
  every deal to `/review/product/<run_id>/provisions`. The existing
  Interpretation Tree, Source text and Comments blocks and their testids are
  unchanged.
- `Everything` (`data-testid="everything-toggle"`) forces every section,
  defined terms, sub-row group, Other provisions block and `collapsible_rows` /
  `rows_start_collapsed` table open, turns specifics on and codes off. Its
  state is one `EverythingContext`; each local toggle still works when
  Everything is off. With Compare on it is the maximal view, including coded
  Other provision lines.

## Tests

Run on this branch after the merge:

- `tests/product-compare-api.test.js`: **14/14**.
- `tests/product-compare-in-page.test.js`: **6/6**.
- `npm run test:active` (run through Node's script runner on this machine,
  which has the node binary but not the npm shim): **995 tests, 995 pass, 0
  fail, 0 cancelled, 0 skipped, 0 todo** (`duration_ms` 317,241). The two known
  Node 22 CI failures are pre-existing: the Codex final-message test and the
  health-route assertion.

## Visual check

The machine has no database credentials or product session, so the live
Skechers/Apache pages could not be reached from this session. The visual check
is a fixture render of `ProvisionTables` (material contracts, with a market
payload) in a local `next dev`, screenshotted through headless Chrome at 1400
and 390 with Compare off/on and Compare + Everything. The fixture data is
representative, not the live deals; the real browser check against the
deployment remains for the manager.

- `visual/deepseek-compare-in-page-20261101/compare-1400.png`
- `visual/deepseek-compare-in-page-20261101/compare-everything-1400.png`
- `visual/deepseek-compare-in-page-20261101/compare-390-sidebar.png`
- `visual/deepseek-compare-in-page-20261101/compare-everything-390.png`

Everything on the 1400 view opens the sub-row and the Other provisions table;
the sidebar block sits above the Interpretation Tree; the table toolbar stays
left of the open sidebar. At 390 the sidebar is full-width (the existing
mobile panel) and nothing overflows horizontally.

## What is not here

- No change to `lib/product/table-view.js`, `lib/product/fact-conclusions.js`,
  `contracts/product/*` or the shapes; the page reads what they provide.
- No market percentage, percentile or label beyond the count line; the
  distribution and n are the claim.
- The sidebar block is only in the Detail tab, above the tree, as asked.
- The old `/compare` surface remains; `/analysed/compare` is the comparison to
  keep when Ben decides.
