# DeepSeek work package 2: compare inside the page, 2026-11-01

A dated work package, not a plan authority. The executable checklist stays `docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`; do not edit it. Read `CLAUDE.md` and `docs/core/OPERATING-RULES.md` first.

## Ben's words (build to these)

> "The compare functionality should work perfectly, and I want the compare functionality to look exactly like the pages we're creating. I don't want a different interface. I want it to look like the pages we've been looking at together, with just a column added to them, or maybe not even a column. Maybe it's a little bit of text underneath each item showing how market or off-market they are."

> "I also want you to build the comparison feature into the right-hand sidebar in a way that's really well considered and really works with the UI flavor we're going for. If that means you have to tweak the UI of the right-hand sidebar, that's fine with me."

> "when we're in comparison, I want this to be the base setting of the comparison: you're looking at the page we're looking at, but I also want to compare every point ... we have so much more data that I'm showing on these pages because I don't want to blind people with too much science, but almost like a maximal 'Hey, if you want to get every provision, you can do that too.' Think about how to do that in the best UI state."

## 1. Branch and house rules

- Branch `deepseek/compare-in-page-20261101` from `codex/product-implementation-plan-20260904`. If package 1 (`deepseek/nav-index-compare-20261101`, commit da734be2) is not yet merged, merge it into your branch first. PR back to `codex/product-implementation-plan-20260904`.
- Never force-push. Plain commit messages, no model names. No secrets. Product DB only through existing server helpers (`getProductSupabase`, `ProductPhase3Store`). Never touch the V1 project `tzulhdasmioeechxapdy`.
- The only new status document is your own note `docs/codex-program/notes/DEEPSEEK-COMPARE-IN-PAGE-2026-11-01.md`. No registrations, receipts or allowlists.

## 2. Ownership

You now own `components/product/ProvisionTables.jsx`, `components/product/EvidenceSidebar.jsx`, `components/product/PublishedSummary.jsx` and the compare APIs. The other engineer (Claude) stays out of those files overnight and works only in `lib/product/table-view.js`, `lib/product/fact-conclusions.js`, `scripts/product/*`, `contracts/product/*` and their tests. You must NOT change `lib/product/table-view.js` or the shapes. If you need a field on a cell, say so in your note and work with what exists.

## 3. Reuse package 1 first

Check your branch before writing anything. Package 1 added: `lib/product/comparison-read.js` (draft/final read path, `listComparisonRuns`, `loadComparisonAgreements`, `loadReferenceConclusions`, access via `product_run_access`), `comparison-runs.js`, `comparison-tables.js` (`buildComparisonTables`, `howCommonFromConclusions`, `codedFactStats`), `comparison-handlers.js` (factories `createComparison*Handler({ getClient, storeFactory, actorResolver })`, 401/404/405 mapping via `errorStatus`/`sendError`), `components/product/HowCommon.jsx`, routes `pages/api/product/compare/{runs,tables,how-common}.js` (each `export default createComparison...Handler({ getClient: getProductSupabase })`), `tests/product-compare-api.test.js`. Extend these; do not duplicate the read path, the handler factory pattern or the distribution maths. The market read below must call `loadComparisonAgreements`/the draft reader and then `buildTableView` (as `PublishedSummary.jsx` does, line ~179: `buildTableView({ facts, heldFacts, tableShapes, legalSchema })`), so the line on the page and the deal page cannot disagree.

## 4. Data shapes you read (do not change)

`buildTableView` returns `{ sections, defined_terms }`. Nesting: `sections[]` `{ section_key, title, rail, tables[], facts_without_readout }` > `tables[]` `{ table_key, group_header, layout, term_column, columns[], rows[], other_provisions?, embedded_in?, leading_of?, collapsible_rows?, rows_start_collapsed?, sub_rows_label? }` > `rows[]` `{ subject, cells[], sub_rows?, backing_facts[] }` > `cells[]`. A built cell (from the Material Contracts test fixture):

```json
{"column_id":"qualifier","kind":"pill","label":"Material","tone":"buyer","component_ids":["c1"],"fact_ids":["f1"],"source_order":1,"words":"any lease"}
```

Coded cells from conclusions also carry `code` (the vocabulary key; labels per column come from `contracts/product/table-shapes.v3.json`). Optional: `many` (array of readings; "various"), `qualifier`, `options`, `suffix`, `values[]` (multi-value cell; each value has `label`, `kind`, `code`). `kind` is `pill` | `value` | `text` | `dash`. Dash cells have no code and get no line. Attribute-grid tables (`layout === 'attribute grid'`) have one cell per column on `rows[0]`.

## 5. Deliverable A: the market line

**Server.** `GET /api/product/compare/market?run=<id>` (new route `pages/api/product/compare/market.js`, handler `createComparisonMarketHandler` in `comparison-handlers.js`, pure maths `marketDistribution(views)` in `comparison-tables.js`). For every analysed run the actor can open (draft and final), build the view and cache it in a module-level `Map` keyed by `run_id + ':' + updated_at` for the process lifetime. Cap the set at 60 runs, newest first. Response:

```json
{"schema_version":"PRODUCT_COMPARE_MARKET/V1","run":"<id>","total_runs":4,
 "cells":{"material-contracts-table|Real estate leases|qualifier":
   {"total":4,"codes":{"MATERIAL":{"label":"Material","count":3,"run_ids":["a","b","c"]},"NOT_MATERIAL":{"label":"Not material","count":1,"run_ids":["d"]}}}}}
```

Key is `${table_key}|${row.subject}|${column_id}`. Count a run once per code. Cells with `kind: 'value'` have no code and compare by `label`. Multi-value cells contribute one entry per value. Headers `Cache-Control: private, no-store`; 400 missing/blank `run`, 401 unauthenticated, 404 run not accessible, 405 non-GET with `Allow: GET`.

**Page.** In `ProvisionTables.jsx` add a `MarketContext` (default `null`) beside `CodesContext` and `SpecificsContext`, and a `Compare` toolbar toggle: same pill (`tabClass(compareOn)`), `data-testid="compare-toggle"`, `aria-pressed`, label `Compare` / `Hide compare`, off by default, remembered in `localStorage` (key `pm-compare`, every access in try/catch). The market payload loads via `fetch` only when the toggle goes on; accept an optional `initialMarket` prop for tests and static renders. Place it in `section-toggles` next to `specifics-toggle`.

When on, `Cell()` renders under each coded answer one quiet line, using the page's own `QUIET`-registry style: `block font-ui text-[11px] leading-snug text-[#6B7785] hover:underline hover:text-[#0B3D71]` (same as the existing `reading-qualifier` span). No pills, no colours beyond the page's. Wording:

- modal code: `Market · 3 of 4 deals`
- otherwise: `Off-market · 1 of 4 · others: Required promptly` (others = the modal label, or the top two joined by `, `)
- alone: `No comparison · only deal with this row`

Ties for modal: treat the selected deal's code as modal (Market). Multi-value cells: one line per value. The line is a `<button type="button" data-testid="market-line" data-market="market|off|alone">` that calls the same `onSelect` payload the cell uses (reuse it; the sidebar opens on that cell). Nothing else changes: no extra column, no extra row. `Cell()` needs `tableKey` and the row `subject`; thread `subject` through `RowGroup` -> `Cell` as a prop (sub rows use the sub row's own `subject`).

## 6. Deliverable B: "How this compares" in the sidebar

In `EvidenceSidebar.jsx` add a `market` prop (`{ label, total, entries:[{label,count,run_ids,self}], runs:{id:name} }` computed in `ProvisionTables` from the selection key) and render a `<section data-testid="evidence-market">` inside the Detail tab, above `evidence-layers` (the Interpretation Tree block). Plain rows: label, `count of total`, a thin navy bar (`h-[3px] bg-[#03203D]` at width = count/total, track `bg-[#ECF0EF]`), then the deal names as links (`href=/review/product/<run_id>/provisions`, `TEXT_LINK` style). The selected deal's own reading is marked with a quiet `This deal` note and a bolder label. Style vocabulary: white, `border-[#DCE3E1]` 1px rules, 10.5px uppercase eyebrow `text-[10.5px] font-ui font-medium uppercase tracking-[0.12em] text-[#6B7785]`, body `font-ui text-[12.5px] text-[#33475E]`, Inter.

Ben: "'Interpretation tree' is fine. 'Source text,' yeah." Keep those. You may restyle the sidebar header and spacing to fit (the page now uses `#DCE3E1`/`#03203D`/`#6B7785`; the sidebar still has `#dcdcdc`/`#1f1f1f`/`#6b6b6b`), but keep all three existing blocks (interpretation tree `interpretation-tree-toggle`, source text `evidence-clause`/`evidence-source-clause`, review trail `evidence-review-trail-section`) and every existing `data-testid`. Width stays `lg:w-[406px]`.

## 7. Deliverable C: "Everything" mode

Toolbar toggle `Everything` (`data-testid="everything-toggle"`, `aria-pressed`) in `section-toggles`. One click: expand all sections (and defined terms), open every `More detail` / Exceptions sub-row group (`RowGroup` `open`), every `OtherProvisions` block, every `collapsible_rows` / `rows_start_collapsed` table (`Table` `rowsOpen`), show specifics (so `embedded_in` tables render), and show codes off (words). Off returns to the defaults (sections per `coverage_only`, specifics off, codes `SHOW_CODES_BY_DEFAULT`).

Implement by lifting state into an `EverythingContext` (boolean), read in `RowGroup`, `Table`, `OtherProvisions`, `FactsWithoutReadout`, `HeldFacts` as `const forced = useContext(EverythingContext); const isOpen = forced || open;` with each local toggle still working when Everything is off. Do not set local state ad hoc. `ProvisionTables` derives `effectiveCollapsed`, `effectiveSpecifics`, `effectiveCodes` from `everything`. Compare on + Everything on is Ben's "maximal" state: the market line must render on every revealed cell, including `OtherProvisions` lines where the fact has a coded cell (otherwise nothing).

## 8. Tests

`node:test` + `assert/strict`, in the style of `tests/product-provision-tables.test.js` (the `.jsx` require hook, `renderToStaticMarkup`, regex asserts). Add to `tests/product-compare-api.test.js` or new files, and append new files to `test:active` in `package.json`:

- `marketDistribution` (pure, over an array of built views): modal, off-market, alone, value cells by label, multi-value, one count per run.
- Handler 200/400/401/405 (and 404).
- Toolbar: `compare-toggle` and `everything-toggle` present, off by default; with a fake market payload via `initialMarket`, the three line wordings render, `market-line` is a button; absent when off.
- Everything on: sub rows, other-provisions table and collapsible rows are not `hidden`.
- Sidebar: `evidence-market` renders above `evidence-layers`; the three old blocks and testids still render.

Run `npm run test:active`. Known failures to ignore: "Codex client uses one private final-message file" and the health-route assertion. Report pass/fail counts.

## 9. Visual check

Use `next dev` and Playwright yourself (no Playwright in `package.json`: install it in a scratch directory outside the repo, do not commit it). Render the Skechers and Apogee provisions pages (`/review/product/<run_id>/provisions`, `/deals/v2/<id>`) at 1400px and 390px, Compare off, Compare on, Compare + Everything, and with the sidebar open on a coded cell. Put the screenshots in the PR. Check no horizontal overflow at 390px.

## 10. Communication

Your note, the PR description, nothing else. In the note list: files changed, any cell field you wanted but did not get, test counts. The other engineer reviews the PR at hourly check-ins and merges when green.

## Summary

1. Branch `deepseek/compare-in-page-20261101` off the product branch (package 1 merged in); you own ProvisionTables, EvidenceSidebar, PublishedSummary and compare APIs; no edits to table-view.js or shapes.
2. A: `GET /api/product/compare/market?run=` plus a `Compare` toggle and a quiet "Market / Off-market / No comparison" line under each coded answer, no new column.
3. B: a "How this compares" block above the Interpretation Tree in the sidebar, rows with navy bars and deal links; existing blocks and testids kept.
4. C: an `Everything` toggle via `EverythingContext` opens every collapsed group and shows words; with Compare on it is the maximal view.
5. Tests added to `test:active`, Playwright screenshots at 1400 and 390px in the PR, results in your own note.
