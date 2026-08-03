# WP-SCHEMA P3 Notes

## Generated Registry Baseline

- Features generated: 563
- Tags generated: 172
- TODO descriptions pending hand-audit: 546
- Benchmarkable hints retained: 218
- Generated baseline has been copied into `lib/schema/features.js` and `lib/schema/tags.js` so Phase 4+ can import the populated registry.
- The generator adds 17 supplemental live-only keys found by the Supabase coverage test, including internal metadata keys such as `flags` and `parentProvisionType`.

## Live Coverage

- `node --test tests/schema/coverage.test.js` passes with root `.env.local` injected.
- The test queries `provisions.ai_metadata.features` and requires every live feature key to exist in `FEATURES`.
- Initial live misses were incorporated as supplemental registry entries rather than excluded.

## Orphan Check

- `docs/schema-migration/orphan-check.txt` records live counts for 40 one-source candidate keys.
- No deletion decisions have been made yet.
- Several one-source keys are materially live-used, including `sourceSection`, `sourceSectionType`, `inlineDefinition`, and `sort_order`, so one-source status is not a safe deletion signal.

## Next Manual Audit

- Replace TODO descriptions with lawyer-facing one-sentence definitions.
- Confirm `benchmarkable`, `whenEmpty`, and `stableAnchor` per feature.
- Use `orphan-check.txt` before deleting or aliasing any one-source key.
- Decide whether internal metadata keys should stay in `FEATURES` long-term or move to a separate internal registry in a later phase. For Phase 3, they stay represented to preserve live-data parity.

