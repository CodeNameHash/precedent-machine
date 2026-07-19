# Demo dry-run fixture

Used by `scripts/demo-dryrun.js` (WP-7 / M5-06) as the pinned agreement the
CI/local smoke test ingests, QAs, tears down, and never leaves in the corpus.

## `landos-abbvie-agreement.txt`

- **Source**: Landos Biopharma, Inc. Form 8-K, filed 2024-03-25, Exhibit 2.1
  ("Agreement and Plan of Merger" among Bespin Subsidiary, LLC; Bespin Merger
  Sub, Inc.; Landos Biopharma, Inc.; and AbbVie Inc., dated March 24, 2024).
  SEC accession `0001193125-24-075991`, item 1.01.
  `https://www.sec.gov/Archives/edgar/data/1785345/000119312524075991/d779916dex21.htm`
- **Stripping**: fetched the raw EX-2.1 HTML (671,473 bytes) and ran it
  through `scripts/ingest-local.js`'s own `stripHtml()` — the exact function
  the live ingest pipeline uses — so this fixture is byte-for-byte what
  `ingestOne()` would produce from the live URL. That collapses to
  **394,336 bytes** of plain text, under the 500KB fixture budget.
- **Usage**: `scripts/demo-dryrun.js` feeds this file to
  `scripts/ingest-local.js --file <path> --staging --backend codex`, which
  runs it through the full parse/classify/extract/validate/store pipeline
  exactly as a live URL ingest would, tagging the resulting deal
  `ingest_status: 'staging'` / `dryrun: true` with a `DRYRUN-<timestamp>`
  target name so it's excluded from every query/index surface and safe to
  tear down after each run.

## `landos-abbvie-agreement.broken.txt`

The first 25,000 bytes of the same fixture — recitals plus a partial
Article I, with no representations, definitions, or conditions articles at
all. Used only to exercise the negative path (`--fixture <path>` override on
`scripts/demo-dryrun.js`): ingestion succeeds, but
`scripts/ingest-qa.js --deal <id>` fails every count gate (REP-T, REP-B,
DEF, COND all near zero), proving step 2 goes red and teardown still runs.
Never used in the green/gating run.
