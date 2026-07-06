# WP-SCHEMA Phase 7B Notes

## Objective

Correct the P7A audit recommendation layer so benchmarkable low-population fields are triage signals only. They should not become `needs_review` unless the registry explicitly promotes them.

## Implemented

- Added `candidate_flags` to `scripts/schema-empty-audit.js`.
- Kept curated empty-state policy narrow:
  - `mainConcept` remains `extraction_pending`.
  - `materialContractsBuckets` remains `needs_review` when empty.
  - `permittedExceptions` and `negativePreambleExceptions` are `extraction_pending` when empty.
  - `parentBuyerIocBuckets` is `not_applicable` when empty.
  - deprecated or legacy standalone fields such as `materialContractsDollarThresholds`, `iocAffirmativeScope`, and `iocAffirmativeStandard` are `silent`.
  - Optional absent deal terms, including go-shop and termination-fee fields, remain `silent` unless deliberately promoted.
- Split the generated audit into:
  - proposed state changes, for actual registry policy changes; and
  - candidate signals, for low-population benchmarkable/citable fields that may need extractor or product review.
- Added regression coverage that prevents low-population benchmarkable fields from being auto-promoted to `needs_review`.

## Live Audit Snapshot

- Corpus: 25 deals, 7,667 provisions.
- Feature opportunities: 150,432.
- Populated: 13,978.
- Empty-state counts:
  - `silent`: 136,360
  - `extraction_pending`: 91
  - `needs_review`: 0
  - `not_applicable`: 3
- Proposed registry states:
  - `silent`: 519
  - `extraction_pending`: 3
  - `needs_review`: 1
  - `not_applicable`: 1
- Proposed state changes: 0.
- Candidate signals: 115.

## Verification So Far

- `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/schema-empty-audit.test.js` passed.
