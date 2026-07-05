# Schema Registry

This directory is the Phase 2 skeleton for the schema-first feature model.

Phase 2 intentionally does not wire the registry into extraction, storage, or
review rendering. It defines the contract, empty registries, formatters, and
empty-state semantics that later phases will populate and adopt.

## Files

- `types.js`: JSDoc typedefs plus shape validators for feature and tag entries.
- `features.js`: canonical feature registry, empty until Phase 3.
- `tags.js`: canonical tag registry, empty until Phase 3.
- `formatters.js`: pure display formatters referenced by feature definitions.
- `empty-policy.js`: semantic empty-state output for missing values.
- `index.js`: public entry point for schema lookups and rendering helpers.

## Phase Boundaries

- Phase 3 populates `features.js` and `tags.js` from the Phase 1 inventory.
- Phase 4 replaces legacy write-time validation with schema-derived validation.
- Phase 6 switches review UI renderers to `renderFeatureValue`.
- Phase 7 completes empty-state normalisation through `whenEmpty`.
