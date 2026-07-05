# WP-SCHEMA P2 Notes

## Scope

Phase 2 adds the schema registry skeleton without wiring it into runtime extraction, storage, or review rendering.

Added:

- `lib/schema/types.js`: FeatureDef and TagDef contracts plus shape validators.
- `lib/schema/features.js`: empty feature registry for Phase 3 population.
- `lib/schema/tags.js`: empty tag registry for Phase 3 population.
- `lib/schema/formatters.js`: pure display formatters for units, enums, dates, quotes, and specialised objects.
- `lib/schema/empty-policy.js`: semantic empty states for `not_applicable`, `silent`, `extraction_pending`, and `needs_review`.
- `lib/schema/index.js`: public lookup and rendering helpers.
- `tests/schema/registry-shape.test.js` and `tests/schema/formatters.test.js`.

## Boundary Decisions

- The registry starts empty by design. Phase 3 populates it from the Phase 1 inventory.
- No package dependency was added in this phase. The repo's Phase 2 gate says only `lib/schema`, `tests/schema`, and `docs/schema-migration` should change. The later Phase 4 brief handles adding Zod if needed for write-time validation.
- The existing `npm test` script runs `tests/*.test.js`, so nested schema tests are run explicitly with `node --test tests/schema/*.test.js` in this phase.

## Verify

- `node --test tests/schema/*.test.js`
- `npm test`
- `npm run build`
- `node scripts/ingest-qa.js --all`
