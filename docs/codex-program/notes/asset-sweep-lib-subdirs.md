# Asset sweep — lib subdirectories (excl. canonical-v2, parser-v2, schema, vocab, provisions, and lib/*.js)

Status: COMPLETE. 2026-08-08.

Scope: `git ls-files 'lib/*/**' | grep -vE '^lib/(canonical-v2|parser-v2|schema|vocab|provisions)/'` (~180 files across 17 subdirectories).

## Summary

Most of this slice is either V1 review/query-surface plumbing (live, well-tested, orthogonal to canonical-V2 extraction quality) or codex-program process governance (`lib/programme-gates/`, 70+ files of milestone/signing/staging-isolation infrastructure with zero extraction-quality content despite matching the word "coverage" superficially). Two real, narrowly-scoped absence-vs-zero assets already exist and are already wired into canonical-V2: `lib/schema-loss/residuals.js` (claim-level "found nothing that fit" detection, GAP-E) and `lib/review-parity/*` (a five-outcome IDENTICAL/COSMETIC/V2_LOSS/V2_ADDITION/DISAGREEMENT comparison harness with an explicit "exit 2 means nothing could be compared" contract). The single biggest find is `lib/market-metrics/` + `lib/row-market-stats/`: a complete, contract-typed, fully tested cross-deal statistics engine with a granular result-state taxonomy (`ready`/`no_occurrences`/`unique`/`insufficient_data`/`not_comparable`/`unknown`/`error`) and a peer-prevalence-based MISSING-vs-NOT_APPLICABLE scorer (`lib/query/market-baseline.js#scoreValue`) — but its live API route (`/api/market-stats`) is hard-disabled at `lib/market-stats-containment.js` (a `lib/*.js` file outside this slice) and never calls into it. `lib/corrections/*` is the real, live V1 human-correction-capture mechanism, but it writes to legacy `provisions`/`provision_cards`, not canonical-V2 — the actual V2 correction-feedback loop is `lib/parser-v2/reapply-corrections.js` (also outside this slice). `lib/review-queue/*` is a false lead: it's a codex-handoff PR-decision queue, unrelated to the 96 held-back extraction items, which live under `lib/canonical-v2/native-producer/review-queue-artifact.js` (outside this slice). No UTF-8-byte-vs-UTF-16-code-unit hazard was found anywhere in this slice's files — the one place a document offset is handled (`lib/queries/review-deal.js`, `review-deal-wire.js`) only sorts/passes through `source_doc_offset_start/end`, never slices text with it.

## Table

| Path | Verdict | Why it matters now |
|---|---|---|
| `lib/schema-loss/residuals.js` | ASSET (live, used by canonical-V2) | Claim-level "no code fit" vs "no claim" detector — the template for absence-vs-zero at the attribute level. |
| `lib/review-parity/*` | ASSET (live, used by canonical-V2) | Five-outcome (incl. V2_LOSS) legacy-vs-V2 comparison harness with a strict "unavailable side ⇒ non-zero exit" rule. |
| `lib/market-metrics/*` | ASSET (built+tested, referenced by V2 UI, live route disabled) | Contract-typed result-state taxonomy (`no_occurrences`/`not_comparable`/`unknown`/`error`) + coverage/gap auditor. |
| `lib/row-market-stats/*` | ASSET (built+tested, live route disabled) | Full aggregation engine behind the taxonomy above; dormant because `/api/market-stats` is stubbed to 503 elsewhere. |
| `lib/query/market-baseline.js` (`scoreValue`) | ASSET (live) | Peer-prevalence MISSING-vs-NOT_APPLICABLE scorer — directly answers "is this 0 suspicious or expected". |
| `lib/query/dark-authority-fence.js` | ASSET (live, pervasively reused) | Hard guard: VALIDATED_NOT_SERVED / unauthenticated-source data can never reach a served query result. |
| `lib/corrections/*` | ASSET (live, V1 only) | Real human-correction capture + approve/reject flow — but targets legacy `provisions`, not canonical-V2. |
| `lib/reprocess/reconciliation-surfaces.js` | ASSET (live, V1) | Reads a real, actively-updated 175-row "deferred pending schema decision" catalogue + 44-row "dropped" log. |
| `lib/reports/persist-report.js`, `render-helpers.js` | PARTIAL | Generic durable-report-row plumbing; reusable shell for a future V2 coverage-audit report, has no V2 kind yet. |
| `lib/review-queue/*` | PARTIAL / false lead | Codex-handoff PR-decision queue — NOT the 96-item extraction review queue (that's in `lib/canonical-v2/native-producer/`). |
| `lib/schema-shape/*` | PARTIAL (V1) | normalized-v1.json reconciliation tooling (alias resolution, human-decision logic, registry versioning) — V1, not V2. |
| `lib/programme-gates/*` (70+ files) | IRRELEVANT | Codex-program process governance (milestones, signing, staging isolation) — no extraction-quality content despite HIGH-priority hint. |
| `lib/query/*` (remainder: engine, executors, natural-language, csv, delta, etc.) | IRRELEVANT to this ask | Live, well-built V1 query surface; useful patterns already noted above, rest is UI/query plumbing. |
| `lib/queries/*` | IRRELEVANT | V1 review-page/API row-shaping and perf trimming (claims→card-features adapter, wire payload trimming). |
| `lib/admin/*` | IRRELEVANT | Static admin-page data (processing-flow stage cards) + a Vercel-runtime route blocker. |
| `lib/auth/*` | IRRELEVANT | Session/cookie/credential auth infra for the whole app. |
| `lib/broad-corpus/contained-routes/*` | IRRELEVANT | Dormant, security-repaired V1 ingest/reprocess routes, deliberately left un-wired (503 stubs still live). |
| `lib/client/corpus-version.js` | IRRELEVANT | Client cache-busting token for corpus-stats. |
| `lib/design/*` | IRRELEVANT | UI design tokens/components. |
| `lib/generated/home-deal-directory-v1.json` | IRRELEVANT (machine-generated) | Cached home-page deal directory (40 deals), not read in full per protocol. |
| `lib/ingest/deal-metadata-prompt.js` | IRRELEVANT | Shared deal-metadata extraction prompt for ingest (V1, one dormant caller). |

## Per-directory verdicts

- **`lib/schema-loss/`** — alive, correctly used, worth reading before building anything similar. Not dead.
- **`lib/review-parity/`** — alive, actively used by canonical-V2 for 2 families. Not dead; extend, don't rebuild.
- **`lib/market-metrics/`, `lib/row-market-stats/`** — alive in code and tests, dormant in production (route disabled elsewhere). Worth reviving/reusing before building new coverage tooling.
- **`lib/query/`** — alive, live V1 query surface. Contains two reusable patterns (`market-baseline.js#scoreValue`, `dark-authority-fence.js`) already used by canonical-V2; rest is V1-specific.
- **`lib/corrections/`** — alive, V1-only. Not the V2 correction-feedback mechanism.
- **`lib/review-queue/`** — alive, unrelated to extraction. Don't confuse with `lib/canonical-v2/native-producer/review-queue-artifact.js`.
- **`lib/reprocess/`** — alive, single file, real live data behind it.
- **`lib/reports/`** — alive, generic, not extraction-quality-specific.
- **`lib/schema-shape/`** — alive, V1-only, adjacent to but not the same system as `lib/schema-loss/`.
- **`lib/programme-gates/`** — alive (process governance) but dead end for this quest.
- **`lib/queries/`, `lib/admin/`, `lib/auth/`, `lib/broad-corpus/`, `lib/client/`, `lib/design/`, `lib/generated/`, `lib/ingest/`** — all alive in their own lane, all irrelevant to extraction-quality/coverage/review-queue questions.

## Detail

### ASSET — lib/schema-loss/residuals.js (GAP-E residual capture)
**What it does:** Detects the "found nothing that fit" case for a coded feature: a claim whose attribute has an allowlisted codebook (enum or listItemTagFamily) came back with `canonical: null` but `verbatim` populated. That is exactly "the model saw this and nothing fit" — distinct from "the model saw nothing". Feature-gated by `RESIDUAL_CAPTURE_ENABLED` (returns `[]` unconditionally when off). Pure, dependency-light CommonJS; normalises both the live `public.claims` row shape and the offline normalized-v1.json triple shape.
**Contract:** `computeFeatureResiduals(claims, options)` → array of `{ id, deal_id, attribute, codebook_kind, family, verbatim, evidence_quote, canonical, reason }`.
**Callers:** `scripts/schema-loss/audit-feature-residuals.js`, `pages/api/admin/schema-loss/queue.js`, admin schema-loss UI (`pages/admin/schema-loss.js`, `components/admin/schema-loss/*`). NOT required from `lib/canonical-v2/`.
**Test status:** `tests/schema-loss/residual-capture.spec.js` — PASS (part of a 52/52 combined run with loss-audit.spec.js).
**Hazard:** none notable; header and code agree. It only distinguishes "no code found" from "no claim at all" for coded features — it does not itself explain a family returning 0 rows for a whole deal, which is a different (row-level, not claim-level) absence question.
**Verdict:** live and correctly used already for its narrow purpose (GAP-E). Directly reusable as the pattern for "found-nothing-that-fit" detection on coded attributes; would need a parallel module for row-level (whole-family) absence.

### ASSET — lib/review-parity/* (legacy-vs-Canonical-V2 comparison harness)
**What it does:** A deterministic, pure comparison engine for proving row-level parity between legacy `provision_cards` and Canonical V2 product projections, one family/deal ("case file") at a time. `compare.js` classifies every field into five outcomes — IDENTICAL, COSMETIC, V2_LOSS, V2_ADDITION, DISAGREEMENT — never collapsed into a generic "differs" bucket. `normalise.js` is the single authoritative place deciding what counts as cosmetic (whitespace, Unicode form, absent-vs-empty, set ordering, numeric format, case) vs substantive (any real text change, presence-on-one-side-only, quote truncation, citation change). `mapping.js` validates/compiles the legacy-field ↔ V2-field correspondence table (fail-closed on unknown keys). `case-file.js` loads paired legacy/V2 data per deal, and a side can be declared `unavailable` — which is reported by name and forces a non-zero exit rather than being silently skipped. `report.js` renders a byte-deterministic report leading with row-level V2_LOSS. `views.js` renders both sides through the *same* legacy table-config `selectRows()` so a diff is attributable to data, never to the renderer.
**Contract:** `runComparison({ mapping, cases, corpus })` → report object with `EXIT` codes (`CLEAN=0`, `SUBSTANTIVE_DIFFERENCE=1`, `INCOMPLETE_COVERAGE=2` — this is the "review-parity-check.js exit 2 means nothing could be compared" rule CLAUDE.md calls out).
**Callers:** `scripts/review-parity-check.js`, `scripts/review-parity-build-cases.js`; used directly from `lib/canonical-v2/termination-fee-serving-source.js` and `lib/canonical-v2/phase1-authority-boundary-inventory.js` (real requires, confirmed non-comment); test fixtures exist for termination-fees and material-contracts.
**Test status:** `tests/review-parity-harness.test.js` — PASS (part of the 52/52 combined run above).
**Hazard:** `compareCodeUnits` is explicitly UTF-16 code-unit order by design (never `localeCompare`) — that's intentional determinism, not a UTF-8 hazard, but a caller feeding it byte offsets from the V2 pipeline would still need conversion elsewhere.
**Verdict:** live, actively used by canonical-V2 already for the two families it has mappings for (termination-fees, material-contracts). Not a forgotten asset — but it IS the template for extending V2_LOSS-style comparison to other families, and nobody needs to reinvent the five-outcome taxonomy.

### PARTIAL — lib/review-queue/* (create.js, resolve.js, store.js) — NOT the extraction review queue
**What it does:** A tiny file-based (`docs/review-queue/*.json`) decision queue for **codex-program handoff decisions** (approve/reject/modify a PR), with a fixed set of `choices` (`approve`/`reject`/`modify`) and an append to `archive/HANDOFF.md` on resolution. `store.js` enforces id/choice-key patterns and a closed set of `kind`s (`canonical`, `destructive`, `unfreeze`, `clarify`).
**Callers:** `pages/admin/review-queue.js`, `pages/api/admin/review-queue/*`, `scripts/review-queue/create.js`.
**Test status:** PASS (29/29 combined with corrections tests above).
**Important:** this is a **false lead** for the "96 held-back items" question. The actual extraction-side review/hold queue lives at `lib/canonical-v2/native-producer/review-queue-artifact.js` (out of this agent's slice — under `lib/canonical-v2/`). Grep hits for "review-queue" inside `lib/auth/route-scan.js` and `lib/canonical-v2/phase1-authority-boundary-inventory.js` are comments/route-name strings, not requires of this module — confirmed by grep. Do not confuse the two "review queue" systems.
**Verdict:** alive, does its narrow job, irrelevant to the extraction-quality question. Directory is not dead, just not the droid you're looking for.

### ASSET — lib/corrections/* (submit.js, review.js, log.js, editor-keys.js, rate-limit.js)
**What it does:** The real human-correction-capture mechanism for the "Correct tab" flow (V1 `provisions`/`provision_cards`). `submit.js` validates a proposed correction, resolves it to an automatable `provisions` column update when possible (`kind: code|quote|value`; `party`/`other` never auto-map — always queue `manual_review` rather than guess), rate-limits pending submissions per IP (in-memory, 20/hour), and writes a `corrections` row. `review.js` implements approve/reject: approve applies the mapped patch via `lib/provisions/apply-patch.js` (out of my scope) if resolvable, else still marks the correction applied/reviewed without fabricating a write. `editor-keys.js` is a simple env-var-based (`EDITOR_KEYS=name:secret,...`) auth gate, deliberately silent about *why* a key failed. `log.js` is the shared insert-or-warn helper used by both the v1 PATCH flow and the Correct-tab routes.
**Contract:** `handleCorrectionSubmission(sb, body, opts)`, `approveCorrection(sb, {id, reviewed_by})`, `rejectCorrection(sb, {id, reviewed_by, note})`.
**Callers:** `pages/api/corrections/submit.js`, `pages/api/corrections/review.js`, `pages/api/provisions.js`, `pages/corrections-review.js`.
**Canonical-V2 use:** NOT used by `lib/canonical-v2/*` — grep hits there (`correction-value-evidence.js`, `post-scope-claim-correction.js`) are unrelated error-message text, not requires of this module. V2 has its own, separate correction mechanism (`lib/canonical-v2/post-scope-claim-correction.js`, out of scope here) and a distinct "reapply corrections" module at `lib/parser-v2/reapply-corrections.js` (also out of scope) that replays user edits across re-extraction — that is the actual "correction feeds back into extraction" mechanism for V2, not this one.
**Test status:** `tests/corrections-submit.test.js`, `tests/corrections-review.test.js` — included in the 29/29 PASS run above.
**Hazard:** this module only writes to the *legacy* `provisions`/`provision_cards` schema (explicit header note: `provision_cards` has no FK to `provisions`, so cross-generation writes are structurally blocked, by design).
**Verdict:** alive, well-scoped, does exactly what item 7 in the brief asks — but it's the V1 correction path. The V2 correction-feedback loop is a different, out-of-slice module; don't rebuild either.

### ASSET (dormant, wired but disconnected) — lib/market-metrics/* + lib/row-market-stats/*
**What it does:** Together these two directories are a complete, contract-typed computation engine for cross-deal "what's market" statistics — presence rates, categorical/numeric/money/duration distributions, cohort denominators (all-deals / provision-family / provision-codes), and a normalisation layer for ~25 semantic value kinds (bring-down treatment, financing scope, IOC dollar thresholds, etc.).
- `lib/market-metrics/contract.js` defines `MARKET_RESULT_STATES = ['ready', 'no_occurrences', 'unique', 'insufficient_data', 'not_comparable', 'unknown', 'error']` and `NON_COMPARABLE_REASON_CODES` (`ambiguous_denominator`, `missing_canonical_identity`, `not_legally_comparable`, `unstructured_source`, ...) — this is a fully worked-out **absence-vs-zero taxonomy** far more granular than a single "0 rows" bucket, directly answering the brief's item 1 in spirit (though for market-rate stats, not per-deal family yield).
- `lib/market-metrics/audit.js` (`auditMarketMetricCoverage`) computes row/metric coverage ratios (comparable, presence-covered, value-covered) and surfaces `gaps` (non-comparable rows with reasons) and `invalid` rows — a working coverage/gap measurement tool (brief item 2).
- `lib/row-market-stats/*` is the execution engine: `request.js` validates/normalises a batch request, `source.js` loads the legacy-card/claim dataset from Supabase (bounded, chunked, concurrency-capped), `observations.js` (1578 lines, not fully read per size protocol — indexed by exported function names) extracts and normalises per-claim values into comparable form, `aggregate.js` computes distributions/quantiles, `service.js` orchestrates dependency-ordered metric evaluation and enforces `hasDarkAuthority` cards/claims can never be served, `handler.js` wraps it in an HTTP handler with a circuit breaker.
**Contract:** `createMarketStatsHandler({ getSupabase, validateMetricSpec, validateMetricResult, ... })` → Next.js API handler; core pure function `calculateMarketStats(request, dataset, validateMetricResult)`.
**Wiring status — the actual finding:** `pages/api/market-stats.js` delegates to `lib/market-stats-containment.js` (a file directly in `lib/`, out of my slice), whose `marketStatsContainedHandler` **unconditionally returns 503 `MARKET_STATS_DISABLED`** for every request and never calls `createMarketStatsHandler`, `loadMarketDataset`, or anything in `row-market-stats/`. Grepped `lib/market-stats-containment.js` for `row-market-stats`/`market-metrics` requires: zero hits. So this entire engine is built, tested, and referenced by canonical-V2 product code (`lib/canonical-v2/termination-product-projection.js` requires `market-metrics/adapter.js`; `components/review/table-configs/*.config.js` use both) — but the live `/api/market-stats` route is hard-disabled at the containment layer. Whether that's an intentional freeze (matches "containment" naming used elsewhere in this repo, e.g. `programme-gates/containment-*`) or a stale gate nobody re-opened is not knowable from this code alone.
**Test status:** `tests/row-market-stats.test.js`, `tests/market-metrics-contract.test.js`, `tests/market-stats-api.test.js`, `tests/prevalence-only-market-metrics.test.js`, `tests/market-stats-canonical-numeric.test.js` — 90/90 PASS.
**Hazard:** none UTF-8/16 specific found (operates on already-extracted claim values, not raw byte offsets). Rows/cards keyed by `deal_id + excerpt_id + provision_instance_id` per an explicit 2026-08-05 ruling noted in `source.js` (excerpt_id alone is not unique).
**Verdict:** the single biggest find in this slice. A rich absence/coverage taxonomy and aggregation engine sits fully built and tested but not live in production. Before building any new "coverage/gap/expected-yield" measurement for canonical-V2, read `lib/market-metrics/contract.js` and `lib/market-metrics/audit.js` — the vocabulary (`no_occurrences` vs `not_comparable` vs `unknown` vs `error`) may be exactly what's needed, and re-pointing `market-stats-containment.js` at the real handler may be cheaper than a rebuild if the freeze was incidental.

### PARTIAL — lib/reports/persist-report.js, render-helpers.js, format.js
**What it does:** Generic "write one row per pipeline run to `run_reports`, render it on `/admin/reports`" infrastructure for V1 producers (`ingest-qa`, `coverage-audit`, `mint-cards`, `rematerialize-claims`, `span-residual`, `demo-dryrun`, `v1-reclass-apply`). Fails soft if the table doesn't exist; caps payload at ~1MB by truncating `payload.deals`. `render-helpers.js` derives a pass/fail badge from whatever shape a producer's `summary` happens to have.
**Callers:** V1 scripts (`scripts/ingest-qa.js`, `scripts/coverage-audit.js`, etc.), `pages/admin/reports/*`.
**Canonical-V2 use:** none — `VALID_KINDS` has no V2 entry yet.
**Verdict:** not an "absence vs zero" or coverage-semantics asset itself, just a persistence/rendering shell. Reusable plumbing if a V2 coverage-audit script wants a durable, browsable run history for free — add a kind to `VALID_KINDS` and call `persistReport`. Not exciting on its own.

