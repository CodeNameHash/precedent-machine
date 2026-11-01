# Review of PR 490 (deepseek/nav-index-compare-20261101), 2026-11-01

For the DeepSeek agent. This is the manager's review of your package-1
branch, the same text as the comment on
https://github.com/CodeNameHash/precedent-machine/pull/490. Fix these on
the same branch and push; the manager re-reviews at the next hourly
check-in and merges when green. Reply in your own note
(docs/codex-program/notes/DEEPSEEK-NAV-INDEX-COMPARE-2026-11-01.md), under a
dated heading, with what you changed and the test counts. Package 2 is in
DEEPSEEK-WORK-PACKAGE-2-COMPARE-2026-11-01.md; start it once the blockers
below are pushed, on a branch off the product branch with this branch
merged in.

What holds up: the branch merges cleanly into
`codex/product-implementation-plan-20260904` (now at 3d9bde82);
`tests/product-compare-api.test.js` is 11 of 11; the routes are GET-only,
`Cache-Control: private, no-store`, resolve the actor before any read,
check access per run, write nothing, and touch no secret and no V1 project.

## Blockers (fix before merge)

1. **Cells must come from `buildTableView`.** `lib/product/comparison-tables.js`
   builds cells with `answerFor(fact, shapes)` and never calls
   `lib/product/table-view.js` `buildTableView`. The comparison therefore
   skips the page's rules (merged `values[]`, `many`, `sub_rows`, folds,
   superseded readings) and can disagree with `/review/product/[id]/provisions`.
   Build each run's view with `previewFactsFromWorkspace(workspace)` then
   `buildTableView({ facts, heldFacts, tableShapes, legalSchema })`, exactly
   as `pages/review/product/[id]/provisions.js` does, and read cells from
   `sections[].tables[].rows[].cells[]` and `rows[].sub_rows[].cells[]`.
2. **how-common must count every reading.** `howCommonFromConclusions`
   keeps only `answerFor(...).answer`, the first cell. Count each code in a
   cell's `values[]`, in `sub_rows`, and in Other provisions lines that
   carry a code.
3. **how-common must read the same facts as the tables.** It queries
   `product_fact_conclusions` by `run_id` (`lib/product/comparison-read.js`
   around line 265), which includes rejected and invalid facts for drafts
   and out-of-release rows for releases. Use the built views from (1) for
   both the tables and the counts.
4. **Row-cap truncation.** `fillComparisonRunCounts` and the how-common
   `.in('run_id', ...)` read fetch rows without paging; PostgREST caps at
   1,000 rows and the counts go silently wrong. Use `count: 'exact',
   head: true` per run, or page through the rows.

## Should fix

- `loadComparisonAgreements` reads unfinished drafts one after another on
  the live path (about 16 seconds per 97-section run); with
  `maxDuration: 60`, six drafts time out. Cap live reads and run them in
  parallel, or serve only runs with a stored preview read model.
- Every route calls `listPublishedLayeredFacts` (all releases, all
  payloads, all conclusions) on every request, and the compare page fires
  up to 8 how-common requests, so the full load repeats; nothing is cached.
  Cache built views per process keyed by run id plus `updated_at`. Package
  2's market API needs the same cache: build it once, in one module, and
  use it from both.
- FAILED and PARTIAL runs appear as "analysed" and can be picked for
  comparison; mark their state and keep them out of comparisons by default.
- The product now has two compare surfaces, `/compare` (released facts,
  the old page) and `/analysed/compare`. Say in your note which should stay;
  Ben decides.

## How the manager communicates with you

Through files in this folder on the product branch, and through comments
on your PR. You reply in your own note. Nothing else is needed.
