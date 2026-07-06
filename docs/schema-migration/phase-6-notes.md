# WP-SCHEMA Phase 6 Notes

## Discovery

- At discovery time, the review page and compare page still imported `lib/category-summary-features.js` directly.
- That file is the shared curated row-order adapter for review and compare. The Phase 6 brief says it should become a thin adapter, but also says to delete it. Deletion is destructive while active importers remain and belongs in the Phase 8 cleanup checkpoint.
- The lowest-risk P6 bridge is to route generic value rendering through `lib/schema/index.js#renderFeatureValue` while preserving bespoke legal tables, row ordering, evidence hovers, and tagged-value pills.
- Ben confirmed `mainConcept` is useful in admin/review contexts. The admin gap queue did not expose it for Needs Code items, nor adjacent concepts for coverage gaps.

## Implementation

- Hardened schema fallback rendering so object values do not leak `[object Object]`.
- Added `lib/schema/summary.js` as the runtime summary-row helper. It preserves the current curated row shape while attaching schema metadata for each row's feature keys.
- Moved review and compare runtime imports from `lib/category-summary-features.js` to `lib/schema/summary.js`.
- Routed the main review page's generic scalar feature rendering through schema `renderFeatureValue`.
- Routed the compare page's generic feature text fallback through schema `renderFeatureValue`.
- Added `main_concept` to Needs Code payloads from provision features.
- Added adjacent provision `main_concept` to coverage gap payloads.
- Rendered main concepts in `/admin/gaps` review queue, selected item panel, gap-adjacent context, and Needs Code detail cards.

## Compatibility Choices

- `lib/category-summary-features.js` remains in place as the compatibility source because scripts/tests still inspect it and because its row labels, fallback keys, MAE carveout rows, aliases, and custom render markers are not yet fully represented in generated registry metadata. Review and compare no longer import it directly.
- Bespoke review tables remain bespoke. They encode legal layout, evidence hover behaviour, and custom grouping that the generated registry does not yet fully model.
- `scheduleReference` remains low-value metadata. No admin or review display added it as a primary signal.
- `permittedExceptions` and material-contract buckets were not changed in this phase. They remain prompt/schema review items for P7/P8 because their shapes need careful treatment.

## Verification

- Focused tests passed:
  - `node --test tests/schema/formatters.test.js tests/gap-review.test.js tests/admin-gaps-scroll.test.js` (`25` passing)
  - `node --test tests/anti-regulatory-efforts.test.js tests/tender-offer-mechanics.test.js tests/raw-enum-labels.test.js tests/evidence-hover.test.js` (`22` passing)
- Full repo tests passed:
  - `npm test` (`801` passing)
- Schema tests passed:
  - `node --test tests/schema/*.test.js` (`25` passing, `1` skipped without env)
  - with root Supabase env loaded, `node --test tests/schema/coverage.test.js` passed live coverage
- Production build passed:
  - `npm run build`
- Corpus QA passed:
  - `node scripts/ingest-qa.js --all`
  - Current corpus size is `25` deals.
  - Overall result: `PASS`, `0` unverified quotes, `0` duplicate clauses.
