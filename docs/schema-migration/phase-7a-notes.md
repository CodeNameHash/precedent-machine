# WP-SCHEMA Phase 7A Notes

## Objective

Start the registry semantic audit that Phase 7 intentionally deferred. The goal is not to classify all 524 features in one blind pass; it is to move the highest-risk fields out of all-silent semantics and produce a live audit packet for the next review wave.

## Implemented

- Added `scripts/schema-empty-audit.js` to build a live empty-state audit from the schema registry plus Supabase provisions.
- Generated:
  - `docs/schema-migration/empty-state-audit.json`
  - `docs/schema-migration/empty-state-audit.md`
- Marked `mainConcept` as `extraction_pending` when empty because it is an admin/search fallback, not legal silence.
- Tightened material-contract fields:
  - `materialContractsBuckets`, `materialContractsDollarThresholds`, `materialContractsRedactionsPermitted`, and `materialContractsBucketsSource` now apply only to `REP-T-MATERIAL-CONTRACTS`.
  - bucket and threshold fields are reviewable when empty.
  - bucket extraction requires evidence and preserves `OTHER` with verbatim text when needed.
- Tightened IOC exception fields:
  - `permittedExceptions` now uses the `EXCEPTION_CODES` tag family instead of a bare string list.
  - `negativePreambleExceptions` and `permittedExceptions` are reviewable and citable.
  - all `EXCEPTION_CODES` tags now declare `permittedExceptions` as an appearance target.
- Corrected legacy IOC affirmative fields:
  - `iocAffirmativeScope` and `iocAffirmativeStandard` now attach to IOC, not MISC.
  - they remain legacy/review fields because active extraction stores richer per-limb values on `affirmativeLimbs` / `positiveObligations`.
- Marked `parentBuyerIocBuckets` reviewable but kept its current string-list shape because the active extractor prompt still emits short labels.

## Live Audit Snapshot

- Corpus: 25 deals, 7,667 provisions.
- Feature opportunities after this scoping pass: 150,432.
- Populated: 13,978.
- Empty-state counts:
  - `silent`: 136,330
  - `extraction_pending`: 87
  - `needs_review`: 37
  - `not_applicable`: 0
- Material-contract bucket opportunities dropped from the prior broad 301 to 24 real `REP-T-MATERIAL-CONTRACTS` opportunities; all 24 currently have populated buckets.
- Material-contract dollar thresholds are 0/24 populated and now surface as reviewable.

## Not Done

- No extraction prompt change beyond schema text.
- No reingest was run. These are registry semantics and validation/display shape changes only.
- No destructive P8 cleanup.
- The audit script still surfaces additional benchmarkable low-population candidates, but those are review candidates, not automatically accepted state changes.

## Verification

- `node --test tests/schema/*.test.js tests/schema-coverage.test.js tests/schema-empty-audit.test.js` passed: 34 tests.
- `npm test` passed: 809 tests.
- `node scripts/ingest-qa.js --all` passed: 25/25 deals, 0 unverified quotes, 0 duplicate clauses.
- `npm run build` passed using the temporary dependency cache.
