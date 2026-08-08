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


