# Asset sweep — `lib/` top level

Status: IN PROGRESS. Scope: every tracked file directly in `lib/` (top level only, not subdirectories), ~65 files. Goal: find V1 modules reusable for canonical-V2 extraction quality work (inheritance/chapeau/limb structure, hold-whole-clause qualifier tagging, canonical vocabularies, party/scope derivation, negation/exception handling, absence-vs-zero discipline, comparison/outlier stats, quote/citation handling, expected-yield-per-family).

Summary: TBD — filled in once sweep completes.

## Table

| Path | Verdict | Why it matters now (one line) |
|---|---|---|
| lib/agreement-revision-classifier.js | IRRELEVANT | classifies SEC exhibit revision type |
| lib/anthropic.js | IRRELEVANT | Anthropic client singleton wrapper |
| lib/broad-corpus-containment.js | IRRELEVANT | route allowlist/containment config |
| lib/coding-tasks.js | IRRELEVANT | admin coding-task API input validation |
| lib/deal-display.js | IRRELEVANT | UI display-name fallback chains |
| lib/deals-index-columns.js | IRRELEVANT | deals-index table column registry (UI) |
| lib/edgar-catalog.js | IRRELEVANT | SEC EDGAR fetch/discovery, not extraction |
| lib/edgar-cleanup.js | IRRELEVANT | raw text cleanup regexes for EDGAR artifacts |
| lib/feature-validation.js | IRRELEVANT | thin delegate to lib/schema/validation (subdir) |
| lib/four-deal-local-demo-preview.js | IRRELEVANT | demo fixture assembly for a sales preview |
| lib/four-deal-local-demo.js | IRRELEVANT | demo fixture (4 fixed deal ids) |
| lib/home-data.js | IRRELEVANT | deals-index data shaping/select lists |
| lib/home-search.js | IRRELEVANT | client-side search snapshot loader |
| lib/home-snapshot.js | IRRELEVANT | static deal-directory snapshot validator |
| lib/home-static-props.js | IRRELEVANT | getStaticProps wrapper for home page |
| lib/html-entities.js | IRRELEVANT | cp1252-aware HTML entity decoder |
| lib/ingest-job-plan.js | IRRELEVANT | ingest batch job scheduling/manifest |
| lib/llm-cli-client.js | IRRELEVANT | CLI-subprocess LLM client plumbing |
| lib/market-stats-containment.js | IRRELEVANT | route containment stub (503 body) |
| lib/model.js | IRRELEVANT | single model-id constant |
| lib/programme-decision-console.js | IRRELEVANT | 128KB programme decision/ruling log, not extraction logic (size-capped, headed only) |
| lib/provision-metadata-locks.js | IRRELEVANT | locks definitionText on correction merge |
| lib/query-containment.js | IRRELEVANT | route allowlist/containment config |
| lib/review-route.js | IRRELEVANT | review page URL query (de)serialization |
| lib/sec-meeting.js | IRRELEVANT | SEC filing/meeting deadlines synthetic table (dup pattern of citable.js unwrap, not new) |
| lib/service-client-route-actions.js | IRRELEVANT | route/auth/service-client action matrix |
| lib/sidebar-groups.js | IRRELEVANT | UI sidebar grouping mirror (test-only) |
| lib/supabase.js | IRRELEVANT | Supabase client singletons |
| lib/useLazyAgreementSource.js | IRRELEVANT | React hook, lazy full-text fetch |
| lib/useRealtime.js | IRRELEVANT | React hook, Supabase realtime subscriptions |
| lib/useSupabaseData.js | IRRELEVANT | React hooks, generic data fetching |
| lib/useToast.js | IRRELEVANT | React toast context/provider |
| lib/useUser.js | IRRELEVANT | React user context (no real auth) |
| lib/bring-down-tiers.js | CONFIRMED KNOWN | pre-identified; in slice, uses parser-v2/subclauses chapeau split — not re-analysed |
| lib/canonical-advisors.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/canonical-conditions.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/category-summary-features.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/party-scope.js | SKIP (known) | pre-identified party/scope derivation, per brief |
| lib/rubric.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/taxonomy.js | SKIP (known) | pre-identified canonical vocab, per brief |
| lib/citable.js | ASSET (in progress) | quote/evidence value-shape discriminators — HIGH priority per brief |
| lib/instrument-negation.js | ASSET (in progress) | negation-of-existence guard — HIGH priority per brief |
| lib/negation-boundary-guard.js | ASSET (in progress) | quote-reversal negation lookback — HIGH priority per brief |
| lib/feature-compare.js | ASSET (in progress) | cross-deal comparison/outlier engine — HIGH priority per brief |
| lib/expected-sets.js | ASSET (in progress) | corpus-derived expected-canonical-set per family |
| lib/gap-review.js | ASSET (in progress) | classifies uncoded text gaps vs genuine absence |
| lib/verification.js | ASSET (in progress) | quote verification + document coverage |
| lib/unelide-quote.js | ASSET (in progress) | reconstructs elided quotes from full_text |
| lib/doc-match.js | ASSET (in progress) | quote-to-source offset locator cascade |
| lib/deal-quality-metrics.js | ASSET (in progress) | aggregates coverage/canonical-rate/gap quality per deal |

(more rows added as full write-ups complete below)

## Detailed ASSET writeups

(filling in as I go)
