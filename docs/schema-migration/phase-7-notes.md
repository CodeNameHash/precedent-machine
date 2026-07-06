# WP-SCHEMA Phase 7 Notes

## Discovery

- The Phase 3 generated registry currently has `524` features.
- Every feature currently has `whenEmpty: "silent"`.
- That means there is no meaningful `needs_review` queue until the registry is lawyer-reviewed and selected fields are promoted from `silent` to `needs_review`, `extraction_pending`, or `not_applicable`.
- The storage shape is `provisions.ai_metadata.features`, not a top-level `features` column.
- Supabase/PostgREST responses can silently page at 1,000 rows, so corpus-wide schema coverage needs paged reads.

## Implementation

- Added `lib/schema/coverage.js`:
  - determines which schema features apply to each provision by `type` and canonical `code`
  - treats `false` as populated
  - counts empty fields by registry `whenEmpty`
  - builds per-provision empty-field rows for the needs-review view
- Added `/api/schema-coverage`:
  - reads live deals/provisions with service Supabase
  - filters staging deals
  - pages through provisions
  - returns per-feature totals: `total`, `populated`, `silent`, `not_applicable`, `extraction_pending`, `needs_review`
- Added `/review/[id]/needs-review`:
  - lists empty fields whose registry state is `needs_review`
  - currently expected to be empty unless/until registry entries are reclassified
- Routed generic review summary rows and feature cells through schema empty-state chips.
- Added an edit-mode link from the review header to the needs-review page.

## Compatibility Choices

- No mass `whenEmpty` edits were made. Treating all 524 generated entries as legally `silent`/`N/A`/`needs_review` without review would create false product semantics.
- Bespoke tables with their own deliberate absence copy remain bespoke. The P7 bridge applies to schema-backed generic render paths first.
- `scheduleReference` remains low-value metadata and stays `silent`.
- `permittedExceptions` and material-contract bucket shape cleanup remains a registry-review item because Ben flagged those as nuanced.

## Verification

- Focused tests passed:
  - `node --test tests/schema-coverage.test.js tests/schema/formatters.test.js tests/admin-gaps-scroll.test.js` (`17` passing)
- Full repo tests passed:
  - `npm test` (`805` passing)
- Schema tests passed:
  - `node --test tests/schema/*.test.js` (`25` passing, `1` skipped without env)
  - with root Supabase env loaded, `node --test tests/schema/coverage.test.js` passed live coverage
- Production build passed:
  - `npm run build`
- Corpus QA passed:
  - `node scripts/ingest-qa.js --all`
  - Current corpus size is `25` deals.
  - Overall result: `PASS`, `0` unverified quotes, `0` duplicate clauses.
- Runtime API check passed:
  - `GET /api/schema-coverage?limit=3`
  - returned `3` feature rows over `25` deals and `7,667` provisions.
