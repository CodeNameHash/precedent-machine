# DeepSeek nav, index and compare, 2026-11-01

This is a dated implementation note, not a plan authority. The executable
checklist remains `docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`.

Branch `deepseek/nav-index-compare-20261101`, cut from
`codex/product-implementation-plan-20260904`. No force-push, one pull request
back to that branch.

## What the branch adds

- `/analysed` lists every analysed run, draft and final, in one index. A
  release is `Final`; a run still in analysis or review is `Draft`. The page
  filters by state and searches agreement, party, URL or run id; it selects up
  to six runs and links them to the comparison.
- `/analysed/compare` picks runs and provision tables and shows the coded
  cells side by side. Rows are `table_key` + `row_label`; a run that does not
  answer a row reads `Not stated` rather than disappearing. Each row carries a
  `HowCommon` distribution.
- `GET /api/product/compare/runs` — the runs both surfaces share.
- `GET /api/product/compare/tables?runs=<id,id>` — the selected runs and the
  aligned coded tables.
- `GET /api/product/compare/how-common?table=<key>[&runs=<id,id>]` — the
  answer distribution for one table, over all analysed runs or the selected
  subset.
- `components/product/HowCommon.jsx` — the distribution: `Company in 9 of 12
  runs answer`, a small bar per answer, and `Not stated in 3 — not a “No”.`

The new pages use the Paul, Weiss shell (`PwBar`, which gains an `Analysed`
link); the comparison page is full-bleed and sets `noLayout`.

## Files

| File | Role |
| --- | --- |
| `pages/analysed/index.js` | the index; `AnalysedIndexBody` is the renderable half |
| `pages/analysed/compare.js` | the run/table picker and the coded grid |
| `pages/api/product/compare/runs.js` | route |
| `pages/api/product/compare/tables.js` | route |
| `pages/api/product/compare/how-common.js` | route |
| `lib/product/comparison-runs.js` | labels, phases, status labels, run-id parsing |
| `lib/product/comparison-tables.js` | table alignment, coded cells, coded counts, how-common |
| `lib/product/comparison-read.js` | the draft/final read path and the reference set |
| `lib/product/comparison-handlers.js` | the three GET handlers as factories |
| `components/product/HowCommon.jsx` | the distribution component |

`provisions.js`, `ProvisionTables.jsx`, `EvidenceSidebar.jsx` and
`table-view.js` are deliberately untouched: the other engineer wires the
sidebar. A comparison cell carries `fact_id`, `run_id`, `component_ids`,
`section_reference` and the answer/condition/extras, so that wiring needs no
change to these APIs.

## The data rules

- **Final** is read from the current release's layered facts
  (`listPublishedLayeredFacts`), so it carries the lawyer's decisions, the
  release warning and the coded conclusions.
- **Draft** is read the way the lawyer preview reads it: the finished run's
  stored preview read model when it is current, otherwise
  `loadPreviewSectionResults` + `buildPreviewWorkspace` +
  `previewFactsFromWorkspace`. A rejected or held fact is not offered as a
  valid comparison cell; a `VALID` fact with a coded conclusion is.
- A `QUEUED` run is not analysed and is not listed. A published run is
  readable by any signed-in user; any other run is checked through
  `product_run_access` before its facts are read. A release's health warning
  rides the index row, the run chip and the comparison table header, so a
  degraded release is never compared silently.
- A table is the schema's own `contracts/product/table-shapes.v3.json` table;
  a cell is `lib/product/provision-presentation.js` `answerFor`, the same
  answer the released deal page shows. The two surfaces cannot drift.
- **How common** counts runs, not facts: two facts from one run with the same
  answer count once. The denominator is the runs that answer the row, and the
  not-stated count is shown separately. The default reference set is every
  finished run: a release or a `READY` draft. A `PARTIAL`, `FAILED` or
  `RUNNING` run has not reached every provision, so it is excluded from the
  default; the reader can still compare it by selecting it explicitly.
- The index's `Coded` count uses `answerFor` over the stored conclusions, so a
  conclusion that carries only drafting is not counted as a coded cell.
  `Tables` is the number of distinct tables with at least one coded row. The
  comparison applies the review's rejections and edits; the index count is the
  stored analysis's own coded read, which is what "as analysed" means.

## Tests

`tests/product-compare-api.test.js` covers:

- the identity helpers: party labels, URL labels, phase/status, the run-id
  parser and its limits;
- table alignment, the absent run and the distribution;
- `howCommon` counting runs rather than facts, and not turning a missing
  answer into a negative;
- `HowCommon` static render in both variants;
- all three handlers: 200, 400, 401, 404 and 405, a final and a draft side by
  side, the all-runs and selected-runs reference scopes, and the index body's
  draft/final rows and compare action.

`npm run test:active` (run through Node's script runner on this machine,
which has the node binary but not the npm shim):

Run on the rebased branch, 2026-11-01: **984 tests, 984 pass, 0 fail, 0
cancelled, 0 skipped, 0 todo** (`duration_ms` 316,320). The command was
`node --run test:active`, Node's own script runner, because this machine has
the node binary but not the npm shim; it executes the same `test:active`
script from `package.json`.

## What is not built here

- No database migration and no write path. The routes are GET-only.
- No export, draft-clause intake, saved reference set, percentile or label:
  those remain WP2b to WP4 of
  `docs/codex-program/notes/COMPARISON-MARKET-BUILD-TASK-2026-10-23.md`.
- The evidence sidebar is not wired on the comparison grid; that is the other
  engineer's part. The cells already carry the ids it needs.
- A first compare of a large unfinished draft can take the preview read's
  seconds: a finished run uses its stored preview model, an unfinished one
  reads live. A follow-up should add a comparison read model if the draft
  corpus grows.
- The comparison is by `row_label`, not `row_detail`; a sub-item shows inside
  its cell (`row_detail`) and does not create a second row.
