# WP-SCHEMA Phase 4 Notes

## Discovery

- `zod` was not present in `package.json`.
- Runtime validation was still centred on `lib/feature-validation.js`.
- Store write paths in `lib/parser-v2/store.js` called `validateFeatures()` before stamping `ai_metadata.validation`.
- Existing callers and tests still import `lib/feature-validation.js`, so that path remains as a compatibility adapter in this phase.
- The Phase 3 registry has 524 features and 130 tags. It is broad enough for validation, but labels/descriptions/empty policies remain mechanically generated in many places and should be lawyer-reviewed before P5 prompt generation and P6/P7 UI semantics.

## Implementation

- Added `lib/schema/validation.js` with Zod-backed validators derived from `FeatureDef` entries:
  - `buildValidatorForFeature(featureDef)`
  - `buildValidatorForProvision(type, code)`
  - `validateFeatures(type, code, features)`
  - `validationSummary(result)`
- Updated `lib/parser-v2/store.js` to call `lib/schema/validation` directly.
- Replaced `lib/feature-validation.js` with a thin compatibility adapter preserving the old public API.
- Added `zod` as a runtime dependency.
- Added schema validation tests covering direct schema API use, legacy adapter compatibility, store import routing, and the top 30 high-appearance feature keys from the Phase 1 inventory.

## Compatibility Choices

- Enforcement remains flag-only. Rows are not rejected.
- Validation is intentionally conservative: code-specific schema matching falls back to type-wide feature definitions to avoid false unknown-key warnings where Phase 3 registry metadata is narrower than legacy validation.
- Legacy taxonomy acceptance remains as a transitional fallback for tagged enum/text values. This keeps P4 behaviour-neutral; Phase 8 can remove it once tags are fully authoritative.
- Loose `object` fields without an `objectShape` accept cited array wrappers at the Zod layer and report shape drift as a warning. This avoids turning legacy unknown-key warnings into new write-path errors, while still surfacing registry cleanup work.

## Verification

- Focused tests passed:
  - `node --test tests/feature-validation.test.js tests/schema/validation.test.js tests/schema/registry-shape.test.js tests/store-dedupe.test.js` (`34` passing)
- Full repo tests passed:
  - `npm test` (`799` passing)
- Schema tests passed:
  - `node --test tests/schema/*.test.js` (`19` passing, `1` skipped without env)
  - with Supabase env loaded, `node --test tests/schema/coverage.test.js` passed live coverage
- Live validation parity passed against `origin/main` over `7,667` production provision rows:
  - legacy: `2` errors, `4,930` warnings
  - schema-backed adapter: `2` errors, `4,310` warnings
  - worsened rows: `0`
- Production build passed:
  - `npm run build`
- Corpus QA passed:
  - `node scripts/ingest-qa.js --all`
  - Current corpus size is `25` deals, not the WP's older `19`-deal wording.
  - Overall result: `PASS`, `0` unverified quotes, `0` duplicate clauses.

## Ben Review Point

Registry review is not needed before P4 because P4 is conservative and flag-only. It is needed before P5/P6/P7, where the registry starts driving prompts, UI rendering, and empty-state semantics.
