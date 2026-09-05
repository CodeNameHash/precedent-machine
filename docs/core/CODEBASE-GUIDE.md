# Codebase guide

## Active product path

The target path is:

`SEC URL -> source document -> agreement structure -> analysis run -> proposals -> lawyer review -> agreement release -> Review`

Phases 0 to 3 define the contracts, durable intake path, three-family draft analysis, lawyer decisions and immutable publication.

## Source and identity

- `lib/canonical-v2/sec-edgar-intake-capture.js`: reusable SEC retrieval controls and raw capture.
- `lib/canonical-v2/sec-html-canonical-text.js`: reusable canonical text and source map.
- `lib/agreement-revision-classifier.js`: original, amendment and restatement classification.
- `lib/product/sec-intake.js`: the active SEC adapter. It accepts one exact SEC exhibit URL, refuses redirects and changed final URLs, caps the response, stores the raw response and canonical conversion, and routes uncertain document identity to one review.
- `pages/api/product/intake.js`: the authenticated server entry point for a new intake submission.

## Durable runs and drafts

- `lib/product/phase-1-foundation.js`: submits or resumes a source and run. It persists the source before structure work and reuses the one structure for later generations.
- `lib/product/phase-1-store.js`: the server-only Supabase adapter for sources, runs, section work, identity review and draft saves.
- `supabase/migrations/20260905020346_product_phase_1_foundation.sql`: immutable source and structure tables, resumable section leases, cost and token totals, optimistic draft revisions, audit history and narrowly granted atomic database functions. It has no visible-deal write path.

## Structure and context

- `lib/canonical-v2/native-producer/deterministic-sectionizer.js`: the shared pure parser reused by the active product structure builder.
- `lib/product/agreement-structure.js`: the only active structure builder and contract. It builds `AgreementStructure` once from canonical source text and exposes source-ordered nodes, source-derived identity, UTF-8 spans, parser residual diagnostics and deterministic annotations.
- `lib/product/source-context.js`: builds a complete, cycle-safe source closure for each substantive section. It includes operative text, chapeau text, definitions, transitive cross-references, the full section and SEC mapping.
- `lib/canonical-v2/agreement-index.js`: historical Stage 2Y compatibility wrapper. Do not use it in the active path because it requires policy and digest bindings.
- `lib/canonical-v2/context-compilation.js`: historical Stage 2Y context compiler. Do not use it in the active path because its interface requires Stage 2Y policy and digest bindings.

## Legal denominator and development data

- `contracts/product/legal-schema.v1.json`: the 25-family outline and full Termination, Termination Fee and No-Shop definitions.
- `lib/product/legal-schema.js`: active schema validation.
- `fixtures/product/development-regressions.v1.json`: 50 curated, atomic product regressions with explicit error classes and assertions.
- `lib/product/development-regressions.js`: validates the product regression fixture without loading M-stage files.
- `contracts/product/development-cohort.v1.json`: development, calibration and blind agreements. Do not inspect the blind product result before Phase 5.

## Draft analysis and Review read

- `lib/product/model-adapter.js`: normalises a JSON model provider and replays raw responses only when the complete call request matches a recording.
- `lib/product/agreement-draft.js`: routes every substantive section, compiles Termination, Termination Fee and No-Shop proposals, groups and links, and validates source spans, values, roles, relationships and four-state coverage.
- `lib/product/analysis-runner.js`: claims one section lease at a time, commits each completed section atomically, resumes persisted section results and finalises one coherent draft.
- `lib/product/phase-2-store.js`: server-only database adapter for section graph commits, draft finalisation and Review reads.
- `pages/api/product/analysis/[id].js`: authenticated, private, read-only analysis endpoint for Review.
- `supabase/migrations/20260905043000_product_phase_2_vertical_slice.sql`: immutable normalised analysis graph, exact source bindings, lease-checked atomic section commits, full-graph finalisation and least-privilege Review reads.

## Lawyer review and publication

- `pages/review/index.js` and `components/product/ProductIntakePanel.jsx`: authenticated SEC submission, resumable progress, visible cost, failure recovery and automatic Review navigation.
- `pages/review/product/[id].js` and `components/product/ReviewWorkspace.jsx`: source-ordered proposal review, compact coverage, exact source context, revision restore and accepted three-family summary.
- `lib/product/review-state.js`: the typed review command model. It requires explicit decisions for proposals, exceptions, issues, uncertain immaterial sections and absence results. Edits retain their source closure and spans.
- `lib/product/review-handler.js`, `lib/product/run-handler.js` and `lib/product/source-handler.js`: authenticated server boundaries for one analysis step, review commands and canonical source reads.
- `lib/product/anthropic-model.js`: the live Anthropic adapter. It records the exact credential-free provider request, raw response, tokens, duration and cost.
- `supabase/migrations/20260905070000_product_phase_3_review.sql`: run ownership, idempotent retry, immutable review revisions and actions, database-validated publication, immutable releases and one atomic current-release pointer.

## Existing evidence used as input

- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json`: stable identity and exact source spans for 50 reviewed items.
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-baseline-ledger.json`: lawyer decisions and error notes.
- `evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-review-packet.json`: proposed facts and display material.

These files are development data. Their authorities, receipts and programme gates are not active dependencies.

## Verification

- `tests/product-phase-0.test.js`: Phase 0 denominator, structure and regression tests.
- `tests/product-phase-1.test.js`: SEC intake, identity, deduplication, resume, structure reuse and API-boundary tests.
- `tests/product-phase-1-db.test.js`: inactive Postgres migration, state-transition, permission and rollback test.
- `tests/product-phase-2.test.js`: source closure, exact-request recording adapter, synthetic model orchestration over the real Concho source, fail-closed validation and Review read tests.
- `tests/product-phase-2-db.test.js`: real Concho runner-to-Review persistence, migration, permission and rollback test on inactive Postgres.
- `tests/product-phase-3.test.js`: review decisions, relationship integrity, source retention, HTTP command boundaries and exact provider-request cost tests.
- `tests/product-phase-3-calibration.test.js`: real Modiv source through the current runner and review state, with measured run cost, proposal corrections, omissions and review time.
- `tests/product-phase-3-db.test.js`: Concho review save, restore, retry, idempotency, stale-write rejection, tamper rejection, publish, reopen, second release, permissions and rollback on inactive Postgres.
- `npm run test:active`: current product behaviour checks.
- `npm run test:auth`: authentication checks.
- `.github/workflows/ci.yml`: one pull-request workflow. It runs active behaviour, authentication, Phase 1 to Phase 3 database rollback tests, tracked-secret scanning and the production build.

Historical Canonical V2 and Stage 2Y tools remain searchable in Git and the archive. They do not block product delivery.
