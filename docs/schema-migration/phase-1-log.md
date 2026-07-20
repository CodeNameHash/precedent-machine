# WP-SCHEMA P1 Phase Log

Generated: 2026-07-20T12:27:11.723Z

Discovery commands embedded in `scripts/schema-inventory.js`:

- Required `lib/rubric.js`, `lib/taxonomy.js`, `lib/expected-sets.js`, and `lib/feature-validation.js`.
- Text-evaluated `lib/category-summary-features.js` because it uses an ESM export in a CommonJS package.
- Scanned `components/review/**` and `pages/review/**` for feature property and literal references.

Outputs:

- `docs/schema-migration/inventory.jsonl`
- `docs/schema-migration/source-inventory.json`
- `docs/schema-migration/inventory-summary.md`
- `docs/schema-migration/phase-1-findings.md`
