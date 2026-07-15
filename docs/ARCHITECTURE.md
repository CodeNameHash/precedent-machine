# Precedent Machine — Current-State Architecture

**Status:** descriptive, not aspirational. This document reflects the code as it exists on
this branch as of 2026-07-15, cross-checked file-by-file. Where `docs/schema-shape/*.md`
describes a target design that the code has not (yet) implemented, this doc says so
explicitly in each section and again in §6. For open bugs and decisions, see
`reports/CODEBASE-REVIEW-2026-07-15.md` (the review that grounds most of the "gotcha"
callouts below) and `reports/BEN-QUEUE-2026-07-15.md` (the decisions waiting on Ben).

---

## 1. What it is, end to end

Precedent Machine ingests M&A merger-agreement filings (SEC EDGAR PDFs/text), splits them
into structural regions, classifies each region as an instance of a known contractual
concept (No-Shop, MAC, termination fee, rep-and-warranty, …), extracts structured features
from each instance via a Claude/Codex LLM call (some features as free text, some as codes
from a closed taxonomy), persists the result across three loosely-coupled Postgres tables,
and renders it as a per-deal review UI and a cross-deal query/comparison surface. It is a
Next.js app (pages router) on Vercel, backed by Supabase Postgres, with no ORM — every
table access goes through `@supabase/supabase-js` directly.

The pipeline, file-by-file:

1. **Ingest** — a document arrives via `pages/api/ingest/from-url.js` (or an uploaded file).
   `lib/parser-v2/text-layers.js` normalizes whitespace/quotes/page artifacts; the raw text
   and its SHA-256 hash land in `agreement_sources`.
2. **Structural segmentation** — `lib/parser-v2/structural.js` (`parseStructure()`) splits
   the cleaned text into sections using regex heading/roman-numeral detection, delegating
   preamble/backmatter/definitions handling to `lib/parser-v2/regions/*`. `region-store.js`
   persists each section as a `parser_regions` row, keyed by a content-derived `region_key`
   hash (`regionKey()`, region-store.js:25) — so unchanged regions keep a stable row across
   re-ingests; this table is upsert-on-conflict, not delete/reinsert.
3. **Classification (stage 3 / "altitude 1")** — `lib/parser-v2/classify.js` runs a
   deterministic regex-rule pass first (`DETERMINISTIC_RULES`, ~classify.js:79-93), then
   sends whatever's left to Claude (`classifyWithAI`, classify.js:626) with article-level
   context. This assigns each region to a provision-type bucket (`REP-T`, `NOSOL`, `COND`,
   …) which in turn selects the rubric — and therefore the coded features — that stage 4
   will use.
4. **Extraction (stage 4 / "altitude 2")** — `lib/parser-v2/extract.js` (~7,960 lines) is
   the core LLM engine. It runs one of four internal "strategies" depending on provision
   type (Strategy A for TERMR ~L3047, Strategy B multi-code for NOSOL/ANTI ~L3552,
   Strategy C one-provision-per-section for REP/STRUCT/CONSID/COV/MISC ~L3949, Strategy D
   ~L4226), builds prompts via `lib/schema/prompt.js`, and returns `{code, label, text}`
   tuples for taxonomy-coded features or free text otherwise. `splitUmbrellaRepSections()`
   (extract.js:3885) explodes one giant Reps section into one child section per individual
   rep (`REP-T-ORG`, `REP-T-CAP`, …) unless the deal already has ≥10 well-segmented sibling
   REP sections (extract.js:3894-3908).
5. **Persist — provisions** — `lib/parser-v2/store.js` (`storeProvisions()`, store.js:573)
   is the write path: it **deletes all existing `provisions` rows (and their annotations)
   for the deal, then bulk-inserts the freshly extracted set** (store.js:646-679, "clean
   slate"). This means `provisions.id` is never stable across a re-ingest.
6. **Persist — cards and claims** — `lib/parser-v2/store-cards.js` maps each `provisions`
   row into a `provision_cards` row via a type/party-scope lookup table, then calls
   `lib/parser-v2/store-claims.js` (`storeClaimsForDeal`) to flatten `ai_metadata.features`
   into atomic `claims` rows, one row per (attribute, value).
7. **Render** — `lib/queries/review-deal.js` fetches `provision_cards` and `claims` for a
   deal (joining them on `claims.excerpt_id`, never on `region_id` — see §2), and
   `lib/queries/claims-adapter.js` turns each claim's `.canonical` code into a rendered
   label via `lib/taxonomy.js`'s `labelForCode`/`taxonomyForFeatureKey`. `pages/review/[id].js`
   and `components/review/*` render the result as cards (`ProvisionCardTable.jsx`) and
   per-family spreadsheet tables (`ProvisionTable.jsx` + `table-logic.js`).
8. **Cross-deal query** — `lib/query/engine.js` + `lib/query/executors/*`, exposed via
   `pages/api/query/run.js` and `pages/api/query/kinds.js`, let a user run one of five
   query kinds (DEAL_COMPARE, PROVISION_CROSS_CUT, MARKET_RANGE, FILTER_THEN_LIST,
   DEAL_TO_MARKET) against the corpus of provisions.

**Design-doc divergence, up front:** `docs/schema-shape/provision-processing-flow.md`
describes an 8-stage pipeline ending in a persisted `normalized-v1.json` snapshot plus a
`reconciliation-log.jsonl` append log (its §1 diagram, stage 7 "Persist"). That JSON file
exists as a **static one-time export** used to backfill the `claims` table (see the header
comment in `supabase/schema-05-claims.sql`) — the live pipeline does not append to it on
every ingest. Runtime persistence is directly to Postgres via `store.js` /
`store-cards.js` / `store-claims.js`, described above. The doc's `Provision.kind` field and
`references_definition` edge (its §2, "realised in Phase 0.5") are likewise not yet in the
schema for most of the corpus; `provision_cards.kind` exists (schema-04) but is populated
only where card-level definition detection ran, not universally.

---

## 2. The data model as built

Five tables carry the load. Pull the authoritative column lists from `supabase/*.sql` —
this section is the relationship map and the parts that surprise a new engineer.

### `deals` (`supabase/schema.sql`)
`id uuid`, `acquirer`, `target`, `value_usd`, `announce_date`, `sector`, `jurisdiction`,
`structure`, `term_fee`, `agreement_type_id → agreement_types`, `metadata jsonb` (this is
where the classified-sections snapshot, full_text, and advisors live — see
`lib/parser-v2/snapshot.js`), `created_by → users`, timestamps.

### `provisions` (`supabase/schema.sql` + additive columns from later migrations)
`id uuid`, `deal_id → deals`, `provision_type_id → provision_types`, `category_id →
provision_categories`, `parent_id → provisions` (self-referencing), plus the legacy
text columns actually used everywhere in application code: `type text`, `category text`,
`full_text`, `text_hash`, `exceptions jsonb`, `ai_metadata jsonb` (this is where
per-feature `{code,label,text}` values live pre-claims-materialization), `display_tier`,
`agreement_source_id`, `region_id → parser_regions` (added by
`parser-regions-consideration-schema.sql`; **NULL on 98.7% of production rows** per the
comment in `schema-05-claims.sql`), `consideration_equity_provision_id`.

**What does NOT exist:** no FK from `provisions` to `provision_cards` in either direction.
The two tables are correlated only by content — `provisions.full_text` (verbatim, trimmed)
equalling `provision_cards.region_full_text`, scoped by `deal_id`. This is the join every
downstream tool (`store-claims.js`, `rematerialize-claims.js`, `mint-cards.js`) has to
re-derive by matching text, not by following a key. `provisions.id` and `region_id` are
**not** usable as stable anchors, because (a) `provisions` is wholesale deleted/reinserted
on every re-ingest (store.js:646-679) and (b) `region_id` is null on almost all rows.

### `provision_cards` (`supabase/schema-03-card-model.sql` + `schema-04-…-canonical.sql`)
`id uuid`, `deal_id → deals`, `provision_type text` (CHECK'd enum: CONSIDERATION,
REPRESENTATION, MATERIAL_CONTRACT, CLOSING_CONDITION, COVENANT_INTERIM_OPERATING,
COVENANT_NO_SOLICITATION, COVENANT_OTHER, TERMINATION_RIGHT, TERMINATION_FEE, DEFINITION,
ANTITRUST_REGULATORY, SEC_FILING_MEETING, EMPLOYEE_BENEFITS, STRUCTURE_MECHANICS, MAE,
NO_OTHER_REPS, MISC_BOILERPLATE), `provision_subtype`, `section_ref`, `short_title`,
`party_scope` (COMPANY/PARENT/BUYER/MERGER_SUB/MUTUAL/N_A), `region_id → parser_regions`
(NOT NULL here, unlike on `provisions`), `region_full_text`, `region_hash`, `primary_quote_*`,
`extracted_by`/`extraction_version`/`extracted_at`, `needs_review`, `review_notes`. Schema-04
additive columns: `provision_instance_id text` (deterministic hash key,
`concat_ws(':', deal_id, section_ref, region_hash)`), `excerpt_id text` (= `provision_instance_id
+ ':0'`), `kind` enum (`standard`/`definition`/`cross-reference`), `defined_term`,
`defined_value`, `"references" jsonb` (array of referenced `provision_instance_id`s —
resolved at render time in `lib/queries/review-deal.js`'s `normalizeCard`), `provenance jsonb`.

Unique constraints worth knowing: `(deal_id, region_hash)` and `(deal_id, section_ref,
provision_type)`, plus unique indexes on `provision_instance_id` and `excerpt_id`
individually. These are the identifiers that survive a re-ingest (they're derived from
content/position, not a sequence), unlike `provisions.id`.

Around `provision_cards` sit a family of per-type-family child tables from
schema-03 — `provision_field_groups`, `provision_analytical_flags`,
`provision_cross_references`, `provision_bring_downs`, `representation_mae_subclauses`,
`material_contract_categories`, `closing_condition_bring_down_tiers` (+
`closing_condition_cited_provisions`), `ioc_positive_obligations`,
`ioc_negative_obligations`, `termination_fee_triggers`, `definition_components`. These are
richly typed (span-validated CHECK constraints throughout) but are a **separate, mostly
dormant persistence layer** from the `claims` table described next — nothing in the current
review-render path (`review-deal.js`, `claims-adapter.js`) reads them; they were built for
the WP-SCHEMA-03 card model before the claims layer superseded it as the render source.

### `claims` (`supabase/schema-05-claims.sql`)
`id text` (opaque triple id from the original normalized-v1.json backfill, not a uuid),
`deal_id → deals`, **`excerpt_id text → provision_cards(excerpt_id)`** (the load-bearing
FK — this is the one real cross-table relationship in the model), `provision_instance_id`,
`region_id → parser_regions` (convenience only, explicitly NOT an identity anchor per the
column comment — `parser_regions.id` isn't deterministic), `attribute text NOT NULL`
(the feature key, e.g. `governingLaw`), `verbatim text`, `evidence_quote text` (the
claim-level supporting quote, used by `lib/citable.js` for hover citations — distinct from
`provision_cards.primary_quote`, which is Excerpt-level), `canonical text` (nullable;
**never fabricated to satisfy NOT NULL** — null means "no code resolved", per the column
comment), `provenance jsonb`, `source_provision_id uuid` (**lineage only** — points at a
`provisions.id` that is not stable across re-ingest; the column comment explicitly warns
the app must never use it as a join key).

The migration's own header comment documents the design decision plainly: `provisions.id`
is regenerated every re-ingest and `provisions.region_id` is null on 98.7% of rows, so the
"obvious" anchor chain (`claims.source_provision_id` → `provisions.region_id` →
`provision_cards.region_id`) resolves only ~1.3% of the corpus. The actual anchor used at
backfill time was `provisions.full_text` == `provision_cards.region_full_text` (exact match,
scoped by deal), which resolved 98.74%. The remaining ~1.26% (141 source provisions, mostly
short inline DEF fragments) were never written to `claims` at all — a permanent,
acknowledged gap, not something any script silently papers over.

### `corrections` (`supabase/corrections-schema.sql`)
`id uuid`, `deal_id → deals` (CASCADE), **`provision_id uuid → provisions(id) ON DELETE SET
NULL`**, `correction_type text`, `before jsonb`, `after jsonb`, `context jsonb`, `reason`,
`user_id`, `created_at`. Every PATCH to a provision via `/api/provisions` inserts a row
here. Because `provisions` is deleted/reinserted wholesale on every re-ingest, and the FK
is `ON DELETE SET NULL`, **`corrections.provision_id` goes null the moment the underlying
deal is reprocessed** — the review confirms 73% of live corrections have already lost this
anchor. `lib/parser-v2/reapply-corrections.js` exists specifically to re-attach orphaned
corrections to the new `provisions` rows post-reprocess, using Jaccard token similarity
plus a category-match bonus (`matchCorrectionToProvision`, reapply-corrections.js:78) —
there is no runner-up margin and no quote re-check, which is the DATA-2 finding in the
review (a correction can misgraft onto the wrong provision if two candidates score
similarly).

### The `(type, category)` cross-deal key
There is **no single `concept_key` column**. Cross-deal comparability (“show me every
deal's No-Shop clause”) is keyed on the pair `provisions.type` (backed by
`provision_types.key`, which carries `party` scope: `REP-T` = target, `REP-B` = buyer) and
`provisions.category` (backed by `provision_categories.label`, the rubric's per-concept
`aliases` list is the classifier's synonym vocabulary that resolves varied source headings
onto one canonical `category`, not a stored column itself). This is functional today but
label-fragile — a `category` string drifting even slightly across deals silently breaks
the join. BEN-QUEUE item 8 records three options for promoting this to a real
`concept_key` column; none has been built yet.

---

## 3. The canonical-coding model in practice

`docs/schema-shape/provision-taxonomy-triple-model.md` §8 documents six hops from "rubric
declares a feature is coded" to "pill renders in the UI." All six are real and traceable in
code today:

1. **`lib/rubric.js`** (~5,000 lines) declares each feature's `type`. Only `'tagged'`
   (single coded scalar, e.g. `superiorProposalDeterminer`, rubric.js:2965) and
   `'list-tagged'` (array of coded items, e.g. `antitrustApprovals`, rubric.js:2683) trigger
   coding. Every other type (`list`, `text`, `string`, …) is free text, no matter how
   plausible a taxonomy dictionary looks.
2. **Pipeline propagates the type.** `scripts/schema-inventory.js` statically scans
   `lib/rubric.js` + `lib/taxonomy.js` (regexing `case '<key>':` inside
   `taxonomyForFeatureKey`, schema-inventory.js:297-309) into an inventory;
   `scripts/generate-registry.js` reads that inventory and emits
   `lib/schema/features.generated.js` and `lib/schema/tags.generated.js`.
   **`lib/schema/features.js` (~20,075 lines) is hand-curated** — the persistence gate that
   `store-claims.js` actually reads is *not* regenerated in normal operation, despite
   carrying a leftover "Generated by…" header comment from when it was first seeded.
3. **Prompt requests codes.** `lib/schema/prompt.js`'s `valueShape()` (prompt.js:117-144)
   emits `"array of tagged objects {code,label,text}"` for `list-tagged` or `"tagged object
   {code,label,text}, or null"` for `tagged`, with the codebook embedded from the feature's
   taxonomy dictionary (extract.js's `TAXONOMY CODEBOOKS` footer, extract.js:1719-1727).
4. **Extraction assigns codes.** The model returns `{code, label, text}`, landing in
   `provisions.ai_metadata.features`.
5. **Claims materialization.** `lib/parser-v2/store-claims.js`'s `atomicValues()`
   (store-claims.js:90-112) recursively unwraps list/scalar/citable-wrapped shapes and, for
   any tagged object, sets `claims.canonical = code` directly — **with no check that the
   code is a member of the relevant taxonomy dictionary.** Any string the model puts in
   `.code`, hallucinated or not, flows straight into the closed-vocabulary column. This is
   the TAX-1 finding (live-confirmed invented codes like `PRIME_BLOOMBERG`, `INFORM`).
6. **Render.** `lib/queries/claims-adapter.js`'s `resolveLabel()` calls
   `lib/taxonomy.js`'s `labelForCode(code, taxonomyForFeatureKey(attribute))`
   (taxonomy.js:1166 / 1178, a ~55-case switch mapping ~40 feature keys to one of ~20
   dictionary constants). If the code isn't in the dict, it falls back to
   `humanizeCode()` (a titlecase/underscore-strip of the raw string) rather than dropping
   it — so an invented code still renders as a *plausible-looking* pill, which is exactly
   why TAX-1 matters: a bad code doesn't look broken.

### The hand-vs-generated split is a live sync hazard, not a hypothetical one

Confirmed today: `lib/schema/features.generated.js` (20,252 lines) has 5 keys absent from
the hand-curated `features.js` (`cashAmount`, `regionId`, `region_id`, `section_number`,
`source_section`) — the hand file has already drifted behind the generator once.
`lib/schema/tags.js` (1,542 lines / 130 entries) is missing **all 20 Stage-4 tags** present
in `tags.generated.js` (1,771 lines / 150 entries) — the entire `SOLICITATION_ACT` code
family (15 codes) plus `ASSIGNMENT_PARENT_EXCEPTION` (3) and `ASSIGNMENT_PROVISO` (2). The
structural reason: `tests/registry-generated-drift.test.js` has two tests — one
(test.js:84) checks the *generated* files are byte-identical to a fresh regen (protects
against silent edits to the generated files themselves), and one (test.js:105) is a
**one-directional** superset check that only confirms every key in hand-curated
`features.js` still exists in a fresh regen (catches the generator *dropping* a key the
hand file needs; does not catch the hand file *missing* a key the generator has). There is
**no equivalent test at all for `tags.js`** — which is exactly why the 20-tag gap went
unnoticed. (The review report's TAX-3 mechanical fix syncs `tags.js` and extends the drift
test; verify it landed before treating this section as historical.)

### Transition-safe render fallback

Every render site that consumes a coded feature follows the same pattern, e.g.
`components/review/table-configs/nosol-noshop.config.js:291-295`:
```js
labelForCode(String(code), taxonomyForFeatureKey('changeOfRecommendationItems')) || valueText(item)
```
Canonical code wins if present and valid; otherwise it falls back to the pre-canonical
regex-derived text (`valueText`/raw verbatim), never to a blank cell. This is intentional
and documented ("transition-safe") — the regex fallbacks are meant to be deleted once a
corpus-wide reprocess confirms codes are populated everywhere (design doc §8.4, §8 corpus
plan), but that reprocess has not yet run corpus-wide, so the fallbacks are still load-bearing
in production today.

### What's proposed but not built: residual buckets (GAP-E)

The design doc (§8.5) and `provision-processing-flow.md` (GAP-E) both describe a residual
bucket ("the model saw this and nothing fit, flag it for review") as the correct escape
hatch instead of force-fitting into the nearest code. **This does not exist yet.** The only
escape hatch today is the regex fallback above, which silently degrades rather than
flagging anything. The plumbing shipped with a flag OFF (`RESIDUAL_CAPTURE_ENABLED`) per
BEN-QUEUE item 10 — enabling it surfaces dimension C on `/admin/schema-loss` with no
write-side risk, but nothing consumes it as a review queue yet.

---

## 4. Scripts an operator actually runs

All of these default to dry-run; `--apply` commits. Read the header comment of each before
running it — several encode hard-won invariants that aren't obvious from the CLI help.

- **`scripts/reprocess.js`** — partial re-processing from stored text (no refetch). Three
  jobs: (1) re-extract one or more `--types` for one `--deal` or `--all` deals; (2)
  `--classify-only` re-runs deterministic rules on every section, consults AI only for
  sections with no snapshot cache-hit, prints a diff before committing; (3) corpus-wide
  type refresh. **Gotcha (GAP-A):** `--apply --types … ` only ever writes `provisions`
  (via `runExtractTypePhase`) — it never calls the claims or `provision_cards` writer. An
  operator can run a full `--apply` pass, see it "succeed," and ship stale/absent codes on
  screen because `claims.canonical` was never touched. There's also no backup/dump step in
  this script at all; recoverability is only the printed pre/post diff, not a restore
  point.
- **`scripts/reprocess/rematerialize-claims.js`** — the fix for GAP-A: re-runs
  `store-claims.js`'s writer per deal, matching each `provision_cards` row to its current
  `provisions` row via a strict ladder (exact `short_title==category` → exact
  `region_full_text==full_text` → normalized-head match). Any ambiguity, or any
  coded-but-unmatched provision, is a hard stop with zero writes unless `--partial` is
  passed. No pre-write backup of `claims`/`provision_cards`; it writes a post-hoc JSON
  report to `reports/rematerialize-claims-<timestamp>.json` after the fact, not a restore
  point before.
- **`scripts/curation/mint-cards.js`** — mints `provision_cards` (plus a synthetic
  `parser_regions` row, `region_key = mint:<provision_id>`, flagged synthetic offsets in
  metadata) for coded provisions that have no card. Reuses the same match ladder as
  rematerialize-claims so "has no card" is defined identically in both tools. Runs a
  post-mint invariant — re-derives the match plan including the newly-minted cards and
  requires each to match its source provision unambiguously — refusing all minting for a
  deal if it doesn't hold (all-or-nothing per deal). `--apply` requires `--backup <path>`
  and refuses to overwrite an existing backup file.
- **`scripts/curation/prune-cards.js`** — acts only on entries in a checked-in
  `scripts/curation/decisions/*.json` file (keep/rehome/delete/add-to-row); never
  discovers targets itself. Skips (and flags) any card whose provision has a human
  correction on that category, regardless of what the decisions file says. All-or-nothing
  for the whole run (any verification failure anywhere ⇒ zero writes), unlike mint-cards'
  per-deal gate. `--apply` requires `--backup <path>` (a full `provision_cards` + `claims`
  dump written before any write).
- **`scripts/curation/rehome-correction.js`** — one-shot, human-directed: re-points one
  named `corrections` row at one named `provisions.id` (both supplied by the caller, no
  auto-discovery). Refuses to write if the target provision's current value for any
  touched key is non-null and differs from the correction's recorded BEFORE value. Inserts
  a **new** `corrections` row keyed on the target's own identity so future automatic
  re-matching finds it; never deletes the original.
- **`scripts/ingest-qa.js`** — read-only post-ingest gate. Per-deal thresholds (REP-T ≥15,
  REP-B ≥5, DEF ≥40, COND ≥8, coverage% ≥95 per the literal default — note the header
  comment says 85%, a doc/code mismatch worth fixing), unverified quotes == 0, duplicate
  clauses == 0, canonical rate ≥0.70. IOC/NOSOL/TERMR/TERMF are counted but not gated. Run
  after every ingest; exits 1 on any failing deal.
- **`scripts/eval.js`** — golden eval harness (`npm run eval`) against hand-audited
  `eval/goldens.json` expectations (counts, required categories, MAE carve-outs, coverage%,
  quote-verification%, schema-error rows). Run before merging any extraction-prompt change
  and after any re-extraction.
- **`scripts/generate-registry.js` + `scripts/schema-inventory.js`** — the two-stage
  rubric→inventory→generated-registry pipeline described in §3. Run whenever the rubric's
  feature `type`s change, then hand-audit the diff into `features.js`/`tags.js`.
- One-liners for the rest of `scripts/`: `backfill/*` are one-off data migrations
  (claims-from-normalized, extract-to-cards, normalize-numeric-claims, promote-canonical);
  `audit/*` are read-only corpus/schema audits; `canonical-sweep/*` are deterministic
  bulk-recode sweeps for specific code families; `registry/*` is registry hygiene
  (coverage/duplicate/orphan detection); `review-queue/*` creates/polls the human review
  queue; `schema-loss/*` audits and applies integrity decisions for schema-migration
  residue.

---

## 5. Key invariants and where they're enforced

- **Quote verification.** `lib/verification.js`'s `verifyDealQuotes` / `quoteAppearsIn()`
  (verification.js:85-102) is the trust gate every extracted quote must pass: quotes under
  12 chars are unjudgeable and skipped; elided (`…`) quotes verify fragment-by-fragment;
  full-string match otherwise. **Known hole (EXT-2, bounded):** a head-fallback at
  verification.js:98-99 accepts a quote if merely its first 80 characters appear
  verbatim in source — a genuine head plus a fabricated tail on a >80-char single-fragment
  quote can pass. `ingest-qa.js` gates on this verifier's output (`unverified quotes == 0`).
- **Backup-before-destructive.** The curation tools (`mint-cards.js`, `prune-cards.js`)
  both hard-require `--backup <path>` before `--apply` and refuse to overwrite an existing
  backup file. `reprocess.js` and `rematerialize-claims.js` do **not** follow this
  pattern — they have no pre-write backup step, only post-hoc diffs/reports. Anyone adding
  a new destructive script should match the curation-tool gate, not the reprocess one.
- **Human-correction preservation.** `corrections` rows are append-only and never
  overwritten in place. Re-matching after a reprocess (`reapply-corrections.js`) or a
  manual rehome (`rehome-correction.js`) always inserts a fresh row rather than mutating
  history; `prune-cards.js` explicitly skips any card a human has touched, regardless of
  what its decisions file says.
- **The match ladder.** Three tools — `store-claims.js`'s implicit assumptions,
  `rematerialize-claims.js`, and `mint-cards.js` — all define "which provision does this
  card/claim belong to" the same way: (1) exact `short_title == category` match, (2) exact
  `region_full_text == full_text` match (scoped by `deal_id`), (3) normalized-head match.
  Any ambiguity anywhere in that ladder is a hard stop (zero writes) unless a tool
  explicitly opts into `--partial`. This ladder is the load-bearing substitute for the FK
  that doesn't exist between `provisions` and `provision_cards` (§2).
- **Never-fabricate-a-canonical.** `claims.canonical` is nullable and the schema comment
  explicitly forbids backfilling it to satisfy a NOT NULL constraint — null means "the
  normalizer left this unresolved," and every consumer must treat null and "invalid code"
  differently from "not yet extracted." (In practice, per §3, an invalid/hallucinated code
  is *not* currently rejected at write time — that's the TAX-1 gap the review flags.)

---

## 6. Known divergences from the design docs

- **`docs/schema-shape/provision-taxonomy-triple-model.md`** describes `Provision.kind` and
  the `references_definition` edge as "declared here in v3... realised in Phase 0.5." In
  code, `provision_cards.kind` (enum: standard/definition/cross-reference) and
  `provision_cards."references"` already exist (schema-04) and are read by
  `lib/queries/review-deal.js`'s `normalizeCard`/`resolvedReferences` — ahead of what the
  doc claims is still pending. But `provisions.kind` (on the base table, not the card
  table) does not exist; the doc's Taxonomy containment diagram (Deal → Section →
  Provision → Excerpt → Claim) is realized across two separate tables
  (`provisions` for the classify/extract output, `provision_cards`/`claims` for the
  render/comparison output) with no FK between them, not the single lineage the diagram
  implies.
- **`provision-processing-flow.md`**'s stage-7 "Persist" writes `normalized-v1.json` +
  `reconciliation-log.jsonl` on every run. In practice these are static/historical
  artifacts from the original backfill; live persistence is directly to Postgres (§1).
- **§8.3 (SOLICITATION_ACT scoping):** the doc promises the extraction prompt scopes each
  of the two NOSOL feature keys (`ceaseDiscussionsProhibitedList`,
  `changeOfRecommendationItems`) to its own code subset so a COR code never tags the
  no-shop list or vice versa. `extract.js` calls both keys with the full codebook (no
  subset filtering implemented) — this is TAX-2 in the review, live-confirmed
  (`WITHDRAW_QUALIFY_REC`, a COR code, appearing on the no-shop list).
- **§8.5 / GAP-E (residual buckets):** explicitly marked "PROPOSED — not yet built" in the
  design doc itself, and confirmed still unbuilt (§3 above).
- **`concept_key`:** the design docs' worked examples imply a clean per-concept identity;
  the actual persisted identity is the `(type, category)` string pair (§2), acknowledged as
  "aspirational" in the design doc's own §8.6 addendum.
- **TAGS registry:** the design doc's six-hop model implies `features.js`/`tags.js` track
  the generated files faithfully; §3 above shows both have already drifted at least once,
  with `tags.js` missing an entire code family until the review's mechanical fix.

For everything else — the full severity-ranked bug list (SEC-1 no-auth, QRY-1/2/3,
TAX-1..4, EXT-1..5, DATA-1/2, PERF-1/2, A11Y-1..4, plus the semantic-correctness audit
findings on bring-down/materiality coding) — see `reports/CODEBASE-REVIEW-2026-07-15.md`.
For what's pending a decision before it can be acted on, see
`reports/BEN-QUEUE-2026-07-15.md`. Do not duplicate that material here; this document is
the map, those are the punch list.
