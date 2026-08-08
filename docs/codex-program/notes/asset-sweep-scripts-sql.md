# Asset sweep: scripts/ sql/ supabase/

Status: IN PROGRESS (incremental write-up; do not treat as final until this line is removed)

Scope: `scripts/**`, `sql/**`, `supabase/**` (~300 files). Read-only analysis
for canonical-V2 extraction quality work. Companion sweeps cover lib/, pages/,
components/, tests/ separately.

## 1. Summary

(to be filled in last)

## 2. Scripts worth keeping

| Path | What it answers | Invocation | Access needed |
|---|---|---|---|
| `scripts/canonical-v2-live-extraction-run.mjs` (124KB) | THE general native-extraction runner: any of the 25 registered section families, against any deal in its hardcoded `DEAL_PINS` table (source hash pinned per deal). This is the script CLAUDE.md's header-comment warns not to miss. | `node scripts/canonical-v2-live-extraction-run.mjs --deal <key> --section-ref <ref> --family <FAMILY> --out-dir <dir> [--api-key-mode] [--model sonnet]` | Live model call (Claude Code subscription CLI by default, or `ANTHROPIC_API_KEY` + `--api-key-mode`); reads committed source HTML fixtures only, no DB. |
| `scripts/canonical-v2-native-extract.mjs` | Native-producer CLI with a genuine **replay mode**: `--replay <path>` re-runs candidate resolution/compilation from a previously recorded model response with **zero model/network calls**; `--dry-run` sectionizes and prints the prompt without calling the model at all. `--record` captures a live response for later replay. | `node scripts/canonical-v2-native-extract.mjs --source-file <path> --section-ref <ref> [--record <path>\|--replay <path>\|--dry-run] [--model <id>]` | Replay/dry-run: none. Live: model call. |
| `scripts/canonical-v2-native-unified-runner.mjs` | Manifest-driven multi-source extraction runner with `--mode=validate` (no model call, just manifest shape-checking), `--mode=execute` and `--mode=execute-iteration-2` (checkpointed, resumable, concurrency-limited live runs). | `node scripts/canonical-v2-native-unified-runner.mjs --mode=validate --manifest <path>` (offline) or `--mode=execute --manifest <path> --controls <path> --artifact-root <path> --out <path> --checkpoint-dir <path>` | validate: none. execute: live model calls. |
| `scripts/canonical-v2-baseline-manifest.mjs` | "What does the committed baseline actually contain, per family" — re-derives publish counts (excerpts/provisions/claims/relationships/components/definition_occurrences/condition_groups) from committed evidence run directories, not from what each run's own validation.json *claims*. `--check` is a CI gate that fails on any disagreement with the committed manifest. | `node scripts/canonical-v2-baseline-manifest.mjs [--out <path>] [--check]` | None — zero model calls, zero network, reads `evidence/canonical-v2/**` only. |
| `scripts/canonical-v2-generate-family-section-refs.mjs` | Generates a `family -> [section_reference]` proposal for a pinned deal from titles/headings alone (Stage-1 matching), and with `--compare` diffs it against the deal's committed human-corrected pins, printing only disagreements — i.e. "where might a family be extracted from the wrong section". | `node scripts/canonical-v2-generate-family-section-refs.mjs --deal modiv\|topbuild [--out <path>] [--compare]` | None — zero model calls, reads committed fixture HTML only. |
| `scripts/canonical-v2-parser-runtime-manifest.mjs` | Builds/checks a dependency manifest for the `lib/parser-v2/canonical-structural-definitions.js` runtime module graph (governed limits: max source bytes, max sections, max definitions, etc.) — a drift gate for the sectionizer's own module boundary. | `node scripts/canonical-v2-parser-runtime-manifest.mjs [--check]` | None. |
| `scripts/generate-canonical-v2-required-kind-registry.mjs` / `scripts/generate-canonical-v2-successor-manifest.mjs` | Generate/check (`--check`) governance registry files under `contracts/canonical-v2/successor/` — what "kinds" a canonical bundle input is required to declare, and the successor manifest's own content hash. | `node scripts/generate-canonical-v2-required-kind-registry.mjs [--check\|--stdout] [--root <path>]` (successor-manifest script takes the same flags) | None. |
| `scripts/review-parity-check.js` | **THE parity harness.** Proves (or refuses to prove) that the Canonical V2 view of a review family says the same thing as the legacy view, deal by deal, from committed case files. Exit codes are load-bearing and match CLAUDE.md's warning exactly: **0** = clean/all agree; **1** = a real disagreement (V2_LOSS/V2_ADDITION/DISAGREEMENT); **2** = no disagreement found BUT coverage incomplete — some deal could not be compared, i.e. **nothing was proven**; **3** = usage error. Its own header states this in so many words: "A run that proves nothing must not look like a run that proves everything." | `node scripts/review-parity-check.js --mapping lib/review-parity/mappings/material-contracts.example.json --cases tests/fixtures/review-parity/cases/material-contracts [--json <file>] [--corpus-deals <n>] [--corpus-ids <file>]` | None — files only, no DB/network/model. |
| `scripts/review-parity-build-cases.js` | Builds the parity-check case files for one family (Material Contracts today) entirely from data already committed to the repo — replays real recorded model responses through the real producer/resolver/projection code, zero DB/network/model calls. `--check` proves the generator is deterministic. Its own output is candid about corpus gaps: 3 of 4 built cases carry an honest `unavailable` V2 side because no committed Canonical V2 resolution exists for that family/deal yet — a finding about the corpus, not the harness. | `node scripts/review-parity-build-cases.js [--check]` | None. |
| `scripts/nets-eligibility-report.mjs` | Replay-only report over 3 committed live-run fixtures (TopBuild/F28, Skechers, Modiv): per-deal claims-resolved / both-nets-clean / blocked-by-condition breakdown / v1-recall outcome, from the v1↔v2 comparator two-pass flow. Explicitly documents WHY `both_nets_clean` is currently always zero (no REP-family Tier-2 value-mapping entries yet) rather than letting a zero read as a bug. | `node scripts/nets-eligibility-report.mjs [--json]` | None — no network, no DB, no model; fixtures only. |
| `scripts/eval.js` | Golden eval harness (`npm run eval`). Asserts hand-audited golden expectations (`eval/goldens.json`) against LIVE data: provision counts, required categories/terms, MAE carve-outs, coverage %, quote-verification %, schema-error rows. Run before merging any prompt/model/pipeline change. | `node scripts/eval.js [--deal Landos]` | Supabase read (env/.env.local). |
| `scripts/ingest-qa.js` | Post-ingest QA gate: per-deal scorecard (REP-T/REP-B/DEF/COND counts, coverage %, unverified quotes, duplicate clauses, canonical-code hit rate) against fixed/overridable gates, plus deal-metadata completeness and claims-materialization checks. Exits 1 if any deal fails any gate. | `node scripts/ingest-qa.js --deal Anadarko` / `--all [--min-coverage 80 --min-def 30 ...]` | Supabase read. |
| `scripts/diff-runs.js` | "What did this extraction run produce, and how does it differ from the currently-stored provisions (or from another run)" — reads `deals.metadata.extraction_runs` + live `provisions`. Closest direct match in this slice to the brief's "family X on deal Y vs expected" ask, at the whole-run granularity. | `node scripts/diff-runs.js --deal <id\|name> [--run <id> [--run <id>]]` | Supabase read. |
| `scripts/compare-report.js` | Proves the general cross-deal comparison/cohort-statistics engine (`lib/feature-compare.js`) on live data: schema-derived catalog of every distributable feature per provision type with per-feature cohort n, plus sample distributions (materiality qualifiers, IOC exceptions, ANTI efforts standard) and an outlier pass with an n<12 guardrail. | `node scripts/compare-report.js [--sector pharma]` | Supabase read. |
| `scripts/coverage-audit.js` | LLM post-check on the coverage metric itself: for a deal, has an LLM classify every region EXCLUDED from the coverage denominator (flagging any that's actually substantive) and every large REMAINING gap (missed content vs residual boilerplate), producing a re-extraction worklist. Persists `reports/coverage-audit-<ts>.json`. | `node scripts/coverage-audit.js --deal "Cox" [--backend claude]` / `--all` | Supabase read + LLM calls (subscription CLI). |
| `scripts/taxonomy-report.js` | Corpus-derived expected-set registry (core/common/rare categories per provision type) plus per-deal coverage against it (present / missing-core / extra non-canonical categories) and a corpus-wide taxonomy-growth queue. | `node scripts/taxonomy-report.js [--deal <name>]` | Supabase read. |
| `scripts/schema-empty-audit.js` | Per-feature-key empty-state audit against `lib/schema/features.js` — which fields are legitimately silent vs. extraction-pending vs. needs-review, corpus-wide. Writes `docs/schema-migration/empty-state-audit.{json,md}`. | `node scripts/schema-empty-audit.js` | Supabase read. |
| `scripts/integrity-orphan-check.mjs` | Release-gate orphan-rate check across corpus relationships not (fully) FK-enforced (`claims.source_provision_id`, `provisions`↔`provision_cards`, deal FKs as a regression guard). **Exit 2 = could not run the checks at all** (missing config/query failure) — same "2 means nothing proven" pattern as review-parity-check.js, worth not confusing with a clean pass. | `node scripts/integrity-orphan-check.mjs [--max-orphan-pct 1.5] [--json]` | Supabase read. |
| `scripts/span-residual-baseline.js` | Report-only corpus baseline for extraction completeness: for every classified section, maps stored provisions back to it by content and computes the residual (unclaimed) span; flags `EXTRACTION_INCOMPLETE` sections. Explicitly scoped to Strategy A/C provision types only (COND/IOC/REP) — documents why DEF/NOSOL/ANTI/TERMF would produce noise, not signal, under this model. Writes `reports/span-residual-baseline.json`. | `node scripts/span-residual-baseline.js` | Supabase read. |
| `scripts/safety-check-nosol-rule.js` / `scripts/safety-check-reclass-rules.js` | Pattern worth reusing: diffs OLD (`git show HEAD:...`) vs NEW classify-rule behavior against every deal's STORED `classified_sections` snapshot — no re-parse, no LLM call — and reports every section whose classification would flip, with a PINNED expected-flip-set to compare against. "Any other flip is a STOP signal." | `node scripts/safety-check-nosol-rule.js [--json]`; reclass-rules script is read-only-capable but per its own header was NOT executed as part of its build slice (no live DB reads yet performed with it). | Supabase read. |
| `scripts/wp5-verbatim-check.js` / `scripts/wp5-unresolved-sweep.js` | Source-span resolution acceptance checks: byte-verbatim quote-to-span resolution for 5 hand-picked cards (3 deals), and a corpus-wide sweep of the first 10 cards/deal counting unresolved spans. | `node scripts/wp5-verbatim-check.js`; `node scripts/wp5-unresolved-sweep.js` | Supabase read. |
| `scripts/generate-codebase-inventory.js` | Re-derives, from the CURRENT working tree (never hand-counted), an inventory of the canonical-V2/M3 pipeline layers: registered section families + producer prompts, product projections, resolver handlers, review-table configs, dark bridges, serving sources, live-run scripts. Written explicitly as the antidote to stale hand-written docs (cites a 28-case doc-reality audit). `npm run generate:codebase-inventory`; checked in CI (`tests/codex-program-generated-docs.test.js` runs it in `--check` mode). Directly relevant to CLAUDE.md's "this project repeatedly forgets what it has already built" warning. | `node scripts/generate-codebase-inventory.js` (writes); test suite runs it with `--check` | None — reads the working tree only. |
| `scripts/deal-context.js` | Compact per-deal digest of extracted provisions sized for an LLM context window (used by the `/deal` skill) — category/canonical-code/favorability/feature-values per provision. | `node scripts/deal-context.js --deal <id\|name> [--type TERMR] [--full]` | Supabase read. |
| `scripts/demo-dryrun.js` | Full pre-demo smoke gate against live Supabase: ingest a pinned fixture as a STAGING deal, QA it, verify review + query surfaces, persist a `run_reports` row, ALWAYS tears the staging deal back out. Documents a known pipeline gap in its own header: production ingest does not mint `provision_cards` — only `curation/mint-cards.js`, `backfill/extract-to-cards.js`, `reprocess/rematerialize-claims.js` do. | `node scripts/demo-dryrun.js [--backend claude] [--json <path>] [--no-report-db]` | Supabase read/write (scoped to its own staging deal) + LLM call. |
| `scripts/generate-query-serving-registry.js` | Regenerates `lib/query/serving-registry-v1.json` from `docs/schema-shape/normalized-v1.json`, with a real correctness fix baked in (strips alias entries that shadow a DIFFERENT field's own canonical key) and hand-documented type corrections for fields whose declared type contradicts their own display name. | `node scripts/generate-query-serving-registry.js` (see `npm run generate:query-registry`) | None. |
| `scripts/verify-page.cjs` | Reusable live-app Playwright verification: logs in, loads a deal's `/review/[id]` page, reports JS crashes, optional content-needle checks, and horizontal-overflow detection. Useful for the "live verification" step CLAUDE.md's delegation checklist requires for anything user-facing. | `node scripts/verify-page.cjs <dealId> [needle1] [needle2]...` (env `VPORT`/`VW`/`VH`/`SHOT`) | Running local app (`npm run dev`) + Playwright/Chromium. |
| `scripts/reprocess/rematerialize-claims.js` | Re-runs the claims writer (`lib/parser-v2/store-claims.js`) for one or more deals from already-stored `provisions`, without touching `provision_cards` — the fix for "claims went stale after a type refresh". Match ladder never guesses: any ambiguity is a hard stop, zero writes, even under `--apply`. Directly relevant to CLAUDE.md's warning that a writer for extraction output was committed and then forgotten. | `node scripts/reprocess/rematerialize-claims.js --deal <uuid>[,<uuid>...] [--apply] [--json]` / `--all` | Supabase read (+write under `--apply`). |
| `scripts/backfill/extract-to-cards.js` | One of only three writers of `provision_cards` in this repo (with `curation/mint-cards.js` and `reprocess/rematerialize-claims.js`, per `demo-dryrun.js`'s own header) — the card backfill that makes a deal render on `/review` at all. | `node scripts/backfill/extract-to-cards.js --deal <uuid> --apply [--extraction-version <label>]` / `--all` | Supabase read/write. |
| `scripts/curation/mint-cards.js` / `scripts/curation/prune-cards.js` / `scripts/curation/rehome-correction.js` | Ben-gated, dry-run-by-default card curation trio: mint a card for a coded-but-card-less provision (deterministic match ladder, never guesses); prune duplicate cards from a checked-in decisions file only (`scripts/curation/decisions/*.json`), all-or-nothing, requires `--backup`; re-home one correction onto an explicitly-named provision when the automatic matcher can't find it. | `node scripts/curation/mint-cards.js --deal <uuid> --apply`; `node scripts/curation/prune-cards.js --decisions <file> --apply --backup <path>`; `node scripts/curation/rehome-correction.js --correction <uuid> --provision <uuid> --apply` | Supabase read/write. |
| `scripts/canonical-sweep/run-all.js` (+ 3 sibling scripts, `_shared.js` helper) | Small reusable pattern: pull every provision of given types, extract a named feature-value phrase, frequency-rank it, write a markdown report — a cheap way to see what free-text values a given feature actually holds across the corpus before deciding a taxonomy. Currently wired for IOC "other" exclusions and R&W lookback-scope / SEC-filings-portions-excluded free text. | `node scripts/canonical-sweep/run-all.js` (runs all 3; each is also independently runnable) | Supabase read. Writes `reports/canonical-sweep/*.md`. |

## 3. Schema map (canonical-V2)

Source: `supabase/canonical-v2-foundation.sql` (466KB — grepped for
`CREATE TABLE`, not read in full), `supabase/canonical-v2-serving.sql`
(215KB), `supabase/canonical-v2-product-candidate-result-writer.sql` (72KB),
`supabase/canonical-v2-staging-read.sql`. All object kinds live in schema
`canonical_v2_staging`, written ONLY through `public.canonical_v2_write(...)`
(a single SECURITY DEFINER writer function, ~370K characters, in
foundation.sql) and read either locally (`lib/canonical-v2/local-staging-
deal-reader.js`, out of my slice) or through hosted `SECURITY DEFINER`
functions granted to dedicated NOLOGIN roles (`canonical_v2_writer`,
`canonical_v2_serving`, `canonical_v2_staging_reader` — three roles, no
table GRANTs, zero RLS policies anywhere under `supabase/` as of this sweep).
Every object-kind table follows the same shape: an opaque
`..._id text PRIMARY KEY` (usually a sha256 hex content-hash, `CHECK (... ~
'^[0-9a-f]{64}$')`), a `closure_id text NOT NULL` (the validation-closure /
extraction-run this row belongs to), a `canonical_payload jsonb NOT NULL`
carrying the actual structured content, and a `canonical_payload_digest`
GENERATED STORED column hashing that payload. The interesting structure
therefore lives inside `canonical_payload` (JS-side, out of my slice), not in
SQL columns — SQL enforces identity/shape, not semantics.

Full table list in `canonical_v2_staging` (from foundation.sql): `deals`,
`deal_admission_records`, `immutable_source_documents`,
`source_admission_manifests`, `intake_capture_receipts`,
`source_artifact_manifests`, `source_artifact_chunks`,
`canonical_text_conversions`, `canonical_text_verification_manifests`,
`source_admission_preparation_receipts`,
`semantic_extraction_input_envelopes`, `validated_semantic_graphs`,
`excerpts`, `definition_occurrences`, `provision_instances`,
`provision_components`, `condition_group_revisions`, `claim_revisions`,
`relationship_revisions`, `conditional_termination_fee_values`,
`open_world_candidates`, `open_world_candidate_occurrences`,
`open_world_evidence_references`, `open_world_candidate_dispositions`,
`open_world_primitives`, `semantic_impact_closures`,
`reviewed_source_specific_rows`, `incomplete_canonical_result_rows`,
`product_candidate_results`, **`residuals`**, **`quarantines`**,
`correction_authority_materialisations`, `correction_discharge_maps`,
`correction_discharge_map_entries`, `candidate_input_events`,
`candidate_input_head_versions`, `candidate_input_heads`, `write_receipts`.
Plus, from `canonical-v2-serving.sql`: `fixture_corpus_releases` (governs
which `corpus_release_id`/`contract_fingerprint` combination is "active" for
serving) and active-release-pointer machinery.

**The four live questions, answered from SQL:**

1. **Limb/component trees.** `provision_instances` (the parent provision)
   and `provision_components` (its children — a limb, a carve-out, an
   exception, an assertion node) are SEPARATE tables, each a flat row keyed
   by opaque id + `closure_id`, with the tree structure encoded *inside*
   `canonical_payload` (parent/child linkage is not a SQL foreign key — the
   hosted read RPC `canonical_v2_staging_read_provision_components` takes
   `p_parent_provision_instance_ids` as its argument, confirming components
   are looked up BY their parent provision's id, not joined via a FK
   column). One example `component_key` value seen in a serving function
   body: `'EXCEPTION_LIMB'` (foundation.sql line ~6368) — so "limb" is a
   real, live component-key vocabulary term, not just a doc word.
   `condition_group_revisions` is a third, separate tree-shaped table for
   closing-condition groupings specifically.

2. **Evidence residuals.** Table `canonical_v2_staging.residuals`
   (foundation.sql ~581). Every residual row carries a `reason_code` with a
   **closed CHECK-constrained vocabulary of 12 values** — this is the
   authoritative list of every reason a proposed fact can be held back from
   publication: `UNKNOWN_ATTRIBUTE`, `INVALID_TAXONOMY_CODE`,
   `PRESENT_WITHOUT_EVIDENCE`, `ABSENT_WITHOUT_COMPLETE_SCOPE`,
   `NON_PRESENT_ASSERTED_VALUE`, `PRESENT_WITHOUT_RESOLVED_TARGET`,
   `PRESENT_WITHOUT_EFFECT`, `STATE_DETAIL_REQUIRED`,
   `INVALID_CANONICAL_VALUE`, `CANONICAL_IDENTITY_MISMATCH`,
   `EVIDENCE_REFERENCE_UNRESOLVED`, `SEMANTIC_REFERENCE_UNRESOLVED`.

3. **Hold-back reasons.** Same table as above for first-order holds. A
   SEPARATE, second-order table, `canonical_v2_staging.quarantines`, holds
   rows whose `reason_code` is constrained to the single value
   `'UNRESOLVED_RESIDUAL'` — i.e. quarantine is what happens to a whole
   validation closure when it still has an unresolved residual in it; it is
   not a parallel vocabulary, it is residuals' escalation state.

4. **Qualifier attachment.** Not a SQL column — SQL only shows that
   qualifier concepts are modelled as **metric slots on components/claims**,
   not as flags on provisions. A serving-function literal (foundation.sql
   ~976, part of a capitalisation-representation metric-slot table) lists
   `metric_key` values including `KNOWLEDGE_QUALIFIER_STATE` and
   `GENERAL_MATERIALITY_QUALIFIER_STATE`, each attached to a
   `value_slot_key` (e.g. `GENERAL_KNOWLEDGE_QUALIFIER`,
   `GENERAL_MATERIALITY_QUALIFIER`) with `subject_terminal_kind` typically
   `MARKET_OBSERVATION`. So a qualifier (knowledge, materiality) is a named
   metric attached to a specific value-slot on a specific claim/component,
   not a boolean on the parent provision — consistent with the
   limb/component-tree answer above (attachment happens at whatever
   granularity the qualifying language actually modifies).

**`write_receipts.operation`** (the writer's closed vocabulary of what kind
of write is legal) is itself informative about the write surface's shape:
`FIXTURE_DEAL_EXTRACTION_RUN`, `FIXTURE_CORRECTION_AUTHORITY`,
`INTAKE_CAPTURE`, `STAGE_SOURCE_ARTIFACT_CHUNK`, `PREPARE_SOURCE_ADMISSION`,
`DEAL_SCOPE_RUN` (the one real per-deal extraction write), and
`PRODUCT_RESULT_CANDIDATE_RUN` (added by
`canonical-v2-product-candidate-result-writer.sql` for the P8 "Agreement
Product" candidate-result work).

**Legacy (pre-canonical-V2) schema, still live and separate:** `public.
provisions` / `public.provision_cards` (schema.sql, schema-03-card-model.sql,
schema-04-provision-card-canonical.sql) and `public.claims` (schema-05-
claims.sql — the (Attribute, Verbatim, Canonical, Provenance) claim node,
anchored to `provision_cards.excerpt_id`, NOT the same `excerpts` table as
canonical-v2; different schema, different id space, described in
`docs/schema-shape/provision-taxonomy-triple-model.md`). Do not confuse the
two `excerpt_id` concepts — one is `public.provision_cards.excerpt_id`
(legacy), the other is `canonical_v2_staging.excerpts.excerpt_id`
(canonical-v2); the writer note in `canonical-v2-staging-schema.mjs`
(2026-08-07 excerpt-identity repin) is specifically about the canonical-v2
one.


## 4. Gates and lint rules

`scripts/ci/run-all-invariants.sh` is the orchestrator: `npm test` then 10
numbered "INVARIANT-N" checks in sequence (any non-zero exit fails the
gate). Each encodes a rule learned the hard way, from an earlier taxonomy-
freeze / legacy-review-page phase:

- `scripts/lint/forbidden-patterns.sh` — the one everyone already knows
  about. Greps the whole tree (via a Node heredoc) for ~28 literal/regex
  anti-patterns: leftover debug strings, banned `.only(`/`.skip(`/`xit(` in
  tests, TypeScript `any`, hardcoded `field_path`/`provision_type` literals
  that should come from the schema registry, stale tooltip constants, etc.
  Each pattern is a scar from a real incident. `bash scripts/lint/forbidden-patterns.sh [root]`.
- `scripts/lint/closing-condition-scope.js` (INVARIANT-3) — scans
  `components/review/**` and `pages/review/**` for text suggesting
  "burdensome"/"Substantial Detriment" language leaking into closing-
  condition rendering outside its proper scope. Still live/real (scans real
  source).
- `scripts/lint/market-registry-completeness.js` (INVARIANT-5),
  `scripts/registry/detect-duplicates.js` (unnumbered, called
  `INVARIANT` via detect-duplicates), `scripts/registry/orphan-detector.js`
  (INVARIANT-9), `scripts/registry/coverage-detector.js` (INVARIANT-10),
  `scripts/registry/provenance-log.js` (INVARIANT-11) — all gate
  `docs/market-registry/*.json` (a frozen feature-taxonomy registry from an
  earlier "market registry" work package). All five short-circuit to a bare
  `PASS` once `docs/market-registry/FROZEN-v1.json` exists and is the active
  file (`isPreFreeze()` check) — i.e. **these are dormant now**: they only
  bite again if the registry is un-frozen or a new pre-freeze file
  reappears. Still wired into the invariant chain, so worth knowing they
  exist and why they're currently no-ops rather than assuming they're
  actively checking anything today.
- `scripts/lint/component-reuse.js` (INVARIANT-6) and
  `scripts/lint/party-scope-audit.js` (INVARIANT-7) and
  `scripts/audit/ioc-scope-mismatch.js` (INVARIANT-2) — **permanently-PASS
  stubs**. component-reuse.js's own `if` branch that would fail is dead code
  (both its true and false branches print PASS); party-scope-audit.js and
  ioc-scope-mismatch.js just print `PASS` unconditionally. These gates
  policed legacy components (`OutsideDateRow.jsx`, `ClosingConditionRow.jsx`)
  that have since been deleted — kept as numbered placeholders in the
  invariant chain rather than removed. Do not mistake a PASS from these for
  evidence of anything; they cannot fail as currently written.
- `scripts/ci/detect-phase.js` / `scripts/ci/check-allowlist.js` — branch-
  name-driven "what work package is this PR allowed to touch" gate, from an
  earlier phased-rollout CI regime (`WP-CI-INFRA-02`, `PLAN-SYSTEM`, generic
  `wp/<slug>` and `phase-<n>/` branch patterns). Only bites on branches
  matching those naming conventions; a normal feature branch is unaffected.


## 5. Dead scripts (grouped)

## 6. Log (working notes, in-order, may be pruned from final)

### canonical-v2-* scripts (77 files in scripts/, 4 in scripts/lib/)

Surveyed via headers (all but the two >100KB files, which were left
ungrepped for now). Overwhelming majority are one-off, hash-pinned
"authority genesis" / "candidate release" / "acceptance proof" scripts tied
to ONE specific hosted Supabase staging project
(`sjumbznveyyiizhwvixj`/`deal-corpus-canonical-v2-staging`) and refuse to run
anywhere else (`guardProject()` checks `supabase/.temp/project-ref`). They
are artifacts of individual PLAN.md steps (2A, 2B, 2B2, 2C, 2C1, 2D1, 4A,
4A2, 4A3, F27/F28 breadth runs, M3 pilot/iteration-2/final-sol) and of
specific deals (QXO/TopBuild, Metsera, Modiv, Skechers, Verve/Lilly). Most
hardcode dozens of content-addressed hashes for one deal's one filing and
cannot be pointed at a different deal without editing constants.

REUSABLE / worth keeping (added to table below): the general live-extraction
runner (`canonical-v2-live-extraction-run.mjs`), the native-producer CLI
with replay mode (`canonical-v2-native-extract.mjs`), the unified
manifest-driven runner (`canonical-v2-native-unified-runner.mjs`), the
zero-cost baseline/coverage diagnostics (`canonical-v2-baseline-manifest.mjs`,
`canonical-v2-generate-family-section-refs.mjs`,
`canonical-v2-parser-runtime-manifest.mjs`), and the two successor-registry
generators (`generate-canonical-v2-required-kind-registry.mjs`,
`generate-canonical-v2-successor-manifest.mjs`).

Two explicit dead stubs worth flagging by name:
- `scripts/canonical-v2-staging-qxo-reverse-f3.mjs` — its entire body is
  `throw new Error('F3 failed adversarial legal review and cannot be
  regenerated or published.')`. F3 (whatever candidate that was) is a known
  dead end, not a bug. `sql/qxo-reverse-f3/` (9 files) is presumably the
  corpse of that abandoned candidate — do not resurrect without re-reading
  why it failed review.
- `scripts/canonical-v2-corpus-source-discovery-capture.js` — body is
  `throw new Error('CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE...')`, a
  deliberate not-yet-implemented placeholder.

The rest (~65 files: all `canonical-v2-staging-qxo-*`, `-metsera-*`,
`-modiv-*`, `-skechers-*`, `-f28-*-live-extraction-run.mjs`, `-local-*-proof`,
`-m3-*` prep/audit scripts, `-writer-*-identity`, `-writer-race`,
`-optiona-authority-partition`, `-generate-qxo-*-authority`,
`-generate-qxo-f4-span-fixture`, `-assess-m3-attempt-3-live`,
`-verify-m3-attempt-3`, `-run-m3-final-pilot-synthesis`,
`-prepare-m3-*`) are one-shot step-proofs: they prove a PLAN.md acceptance
criterion happened once, against a specific pinned deal/hash, generally
requiring either a live hosted Supabase staging session, a local throwaway
Postgres container, or (for the `-f28-*-live-extraction-run` /
`-modiv-first-live` / `-skechers-first-live` family) a live model call via
the Claude Code subscription CLI. Treat as GRAVEYARD candidates (KEEP for
provenance/history, not for re-running) unless a specific step needs
re-verifying.


