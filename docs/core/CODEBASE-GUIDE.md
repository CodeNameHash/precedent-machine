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

## Layered fact model, V2 (plan Phase 5B, decided 2026-09-12)

- `contracts/product/fact-components.v2.json`: a fact is a headline plus an ordered tree of verbatim components with byte spans, origins (own, chapeau, intro, definition) and canonical values; rules R1 to R10.
- `lib/product/fact-components.js`: validates a component tree against the contract, parses canonical values in code, builds a tree from model output, renders the headline and one layer. `tests/product-fact-components-contract.test.js`.
- `contracts/product/legal-schema.v2.json`: generated by `scripts/product/build-legal-schema-v2.js` from V1 plus an overlay of Ben's subtype names, per-family headline and layer rules, optional timing, qualification and forum roles, covenant standard components and coverage-only boilerplate. `lib/product/legal-schema.js` validates V1 and V2. `tests/product-legal-schema-v2.test.js`.
- `lib/product/legal-schema-selection.js`: every entry point follows the run's recorded schema version; new submissions use V1 until `NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION=LEGAL_SCHEMA/V2` selects prompt bundle `PRODUCT_LAYERED_COMPONENTS/V7`. `tests/product-legal-schema-selection.test.js`.
- `lib/product/agreement-draft.js` `compileProposalComponents`: under a V2 schema the extractor sends prompt `PRODUCT_ALL_FAMILY_EXTRACTOR/V7`, resolves each component quote to bytes, and holds a proposal as INVALID with `INVALID_FACT_COMPONENTS` or `INVENTED_ROLE_TEXT` rather than dropping it. `tests/product-fact-components-extraction.test.js`.
- `supabase/migrations/20260913000000_product_fact_components_v2.sql` and `lib/product/phase-2-store.js`: component and headline rows written in the same atomic section commit and rebuilt as a tree on the Review read path. `tests/product-fact-components-store.test.js`.
- `components/product/PublishedSummary.jsx`, `lib/product/published-layers.js`: reader view, headline first, click to descend; coverage-only boilerplate as one collapsed section at the end. `tests/product-published-layers.test.js`.
- `lib/product/component-edit.js`: rebuilds a component tree from a lawyer's component-level edits with UTF-8 byte offsets from the section text; `DECIDE_ITEM` EDITED carries `components` and `headline` (`edited_components`, `edited_headline` in `lib/product/review-state.js`). `tests/product-review-component-edit.test.js`.
- `lib/product/claude-cli-model.js` `createClaudeCliProductModel` / `createHostedProductModel`, `lib/llm-cli-client.js` `createClaudeCliProductClient`: the hosted worker's Claude path (Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?"). Provider `ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION` (`PRODUCT_MODEL_PROVIDER` on the deployment): Claude Code `claude -p` in the sandbox on a subscription login (`PRODUCT_CLAUDE_CODE_OAUTH_TOKEN` on the deployment, passed to the sandbox as `CLAUDE_CODE_OAUTH_TOKEN`, from `claude setup-token`), Claude Opus 5 on every call kind (routing and residual at low effort, extraction at high), no tools, no settings, no session on disk, `--output-format stream-json` with every assistant text block joined in order (the CLI's own `result` is the last block alone), zero marginal API cost. The run record's `model_config` names the provider; the launcher `infra/codex-sandbox-worker/launch.sh` checks the login for whichever provider the wake names and tees the worker's output to `/vercel/sandbox/pm-worker-<run>.log`. Failed attempts of a section stay in `product_section_work.error_history`; a part of a split section records its model call under an identity derived from `<attempt token>:part-<n>` (`product_private.product_phase2_model_call_extraction_part`). Every fact carries `headline.summary` (one line, at most 15 words, `lib/product/fact-components.js` `headlineSummaryProblems`), stored on `product_fact_headlines.summary` and shown as the Other provisions Term. `tests/product-claude-cli-provider.test.js`.
- `lib/product/request-auth.js` `internalBearerActor`, `lib/product/sandbox-wake.js` `sandboxCredentials`, `scripts/product/start-generation.js`: the internal bearer token (`PRODUCT_INTERNAL_TOKEN` on the deployment) starts and advances a run from a script, and `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID` let `update-sandbox-worker.js` and the wake run outside a Vercel deployment (Ben, 2026-09-14: "Server side route is fine"). `tests/product-internal-token.test.js`.
- `lib/product/product-model-config.js`: Codex call-kind models; routing and residual on gpt-5.5 since 2026-09-12 (Codex CLI 0.145.0 on a ChatGPT login accepts only gpt-5.5). `scripts/product/probe-sandbox-models.js` reports which models the hosted sandbox accepts; `scripts/product/create-sandbox-worker.js` and `update-sandbox-worker.js` create and update the sandbox checkout.
- `lib/product/review-comparison.js`, `scripts/product/compare-review-items.js`: map a lawyer's V1 review items onto V2 facts by node and byte overlap. `tests/product-review-comparison.test.js`.
- `contracts/product/table-shapes.v3.json`, `lib/product/table-shapes.js`: per-subtype table shapes and coded vocabularies (merger form, bring-down standard, fee payer, cure, triggers) harvested from the legacy configs and Ben's TopBuild review, extended for V2 and decided with Ben 2026-09-13. Generated by `scripts/product/build-table-shapes-pass3.js` (decisions 1 to 33) and `scripts/product/table-shapes-decision-34.js` (2026-09-14: every table is the Envestnet old-app row list, `scripts/product/legacy-review-print.js`; every column coded, a number, yes / no or as drafted; `vocabulary_by_row`, presence-derived cells). `tests/product-table-shapes.test.js`.
- `lib/product/agreement-draft.js` `widenRouting` / `articleHeading`: the model's routing is widened, never narrowed, by two facts the code holds: a section under an article headed "Representations and Warranties" is routed to REPRESENTATIONS, and a family the residual pass names on a paragraph is routed; the routing record keeps `model_families`, `model_disposition` and `widened_families` (Metsera generation 5: 3.04 routed IMMATERIAL, 3.08 to INTERIM_OPERATING alone). `tests/product-routing-widening.test.js`.
- `lib/product/agreement-draft.js` `longSectionGroups` / `mergePartResponses`: a section over 8k bytes with four or more child limbs is extracted per group of limbs and the parts merged when the caller passes `longSectionSplit` (the analysis runner does; Q6, 2026-09-14). `tests/product-long-section-split.test.js`.
- `contracts/product/fact-conclusions.v1.json`, `lib/product/fact-conclusions.js`, `supabase/migrations/20260913020000_product_fact_conclusions.sql`: the conclusions layer (table key, row label, coded cells per fact) written by prompt bundle `PRODUCT_LAYERED_COMPONENTS/V9`, the bundle new V2 submissions use; `lib/product/analysis-runner.js` hands the table shapes to every section of a V9 run. A readout that fails validation is dropped with a `CONCLUSIONS_DROPPED` note and the fact stays valid (Ben, 2026-09-13); conclusions are part of the proposal's content identity. `tests/product-fact-conclusions.test.js`.
- `lib/product/table-view.js`, `components/product/ProvisionTables.jsx`, `components/product/EvidenceSidebar.jsx`, `components/product/ProvisionRail.jsx`: the table layout (coded conclusions as pills per subject, click a pill for the words behind it, review trail in the sidebar; a `one per agreement` table such as Structure & Mechanics renders as a TERM / PROVISION attribute grid). A fact without a readout never becomes a row; it is listed under its section as evidence without a readout (so V8 output, which has no readouts, shows lists, not tables). `tests/product-table-view.test.js`, `tests/product-provision-tables.test.js`.
- `pages/query/provisions.js`, `pages/api/product/published-facts.js`: published layered facts across every agreement in the table layout. `tests/product-published-facts-query.test.js`.
- `pages/review/product/[id]/provisions.js`, `lib/product/provisions-preview.js`, `lib/product/preview-handler.js`, `pages/api/product/analysis/[id]/preview.js`: read-only lawyer preview of one run in the table layout (every valid layered fact, reviewer edits applied, held and rejected facts left out), linked from the review page header. The preview read returns every completed section whether or not the run has finalised, so the page fills in while a run is analysing and polls once a minute until it is READY. `tests/product-provisions-preview.test.js`, `tests/product-preview-handler.test.js`.

## Review page aids (2026-09-09 to 2026-09-12)

- `components/product/FocusedReview.jsx`, `lib/product/section-highlight.js`, `lib/product/review-briefs.js`, `pages/review/product/[id].js`: focused review of briefed provisions (`?focus=`, `?all=1`), provision text beside facts, click-to-highlight, decision colours, comments. `tests/product-focused-review-ui.test.js`.
- `lib/product/review-state.js` commands `COMMENT_ITEM` and `RESET_ITEM`. `tests/product-review-comment.test.js`.
- `supabase/migrations/20260912190000_product_service_role_statement_timeout.sql`: review saves validate the whole state in the database; the service role timeout is 60 seconds.

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
