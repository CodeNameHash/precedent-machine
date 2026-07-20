# Canonicalization program — revised plan (response to the Codex review)

2026-07-20. Status: adopted, with the amendments below. The Codex
architectural review was independently fact-checked against the repo and
live production (five verification passes: admin pages, registry typing,
identity/lineage, the schema-shape docs, and a full inventory of
comparison-layer normalisers). This document is the governing plan; the
review's phase structure is kept, its factual base is corrected where
verification found nuance, and governance + sequencing rules are added.
docs/PLAN.md's work packages (WP-R1..R10) fold into the phases noted.

## Verification results (what we confirmed, corrected, or sharpened)

CONFIRMED as stated:
- provisions ↔ provision_cards has no FK in either direction; the only
  join is content-addressed best-effort (lib/query/prov.js, spanHash).
  Nuance kept for the record: claims → provision_cards IS a real
  DB-enforced FK (schema-05-claims.sql:32) — the fragile seam is
  specifically provisions↔cards, and every downstream tool re-derives it
  by text matching.
- No concept_key exists anywhere in schema or code (grep: zero hits
  outside design prose). Cross-deal identity is the (type, category)
  string pair in the query engine and a subtype-string priority chain in
  the review UI; compareRowUnion's ROW_FAMILY map is an enumerated
  allowlist over KNOWN drift, not a key. The 2026-07-20 incidents
  (four deals with 50–89% null subtypes; the 'Unclassified' vs
  '[PROPOSED] Unclassified' sentinel matching zero of 475 real cards)
  are direct consequences.
- /admin/processing-flow metrics are hardcoded stubs (STAGE_METRICS_STUB,
  stub:true) and stage descriptions cover the target file-based pipeline,
  not the live Postgres path.
- /admin/schema-loss zeros are structural: residual capture is disabled
  by default (RESIDUAL_CAPTURE_ENABLED unset), Dimension A
  unconditionally returns empty clusters, and Dimension B reads a static
  artefact that is stale on the deployment (the committed local file has
  200 flagged entries while production shows 0).
- /admin/registry counts verified EXACTLY: 704 total / 455 pending /
  59 flagged / 29 suggested (+46 approved / 7 rejected). The active
  contract is not frozen.
- Registry typing errors are real: discussionInitiationNoticeHours
  data_type FLOAT_PERCENT; terminationFeePercentEquityValue,
  feePercentage, reverseFeePercentage, tailFeeThresholdPct all
  data_type USD_AMOUNT.
- The normaliser accumulation is real and "probably an understatement":
  dozens of regex/text-mining reconstructions in table configs exist
  because party_scope is baked MUTUAL, section subjects are unstored,
  mechanisms are stored as prose, and stored shapes drift.

CORRECTED (the plan below rests on these, not the review's wording):
1. /admin/taxonomy does not "report an error" — it is SILENTLY OFFLINE
   (getServiceSupabase() null branch: env vars unset on that deployment;
   status "offline", counts 0). The pseudo-claims-from-ai_metadata claim
   is TRUE (the page's own source label admits it) and the real claims
   table it should read exists and is populated.
2. The unit/type errors do NOT live in lib/schema/features.js (its
   `unit` fields are correct — percent fields say percent). They live in
   the DERIVED market registry's data_type
   (docs/market-registry/generated-v1*.json), which /admin/registry
   renders. Fix the derivation and the derived rows; do not "correct"
   the hand registry, which is right.
3. lib/unelide-quote.js is query-layer (lib/queries/review-deal.js),
   not presentation — already on the right side of the line the review
   draws.
4. lib/query/derived-fields.js is NOT a compatibility shim — it is the
   governed query-time-derived-field pattern the target architecture
   wants MORE of (one entry, feePctOfDealValue, computed from two
   canonical fields). Phase 4 should promote this pattern, not migrate
   it away.
5. lib/party-scope.js is shared write+render infrastructure, not a
   comparison-layer patch — fixing it changes ingestion, so it belongs
   in Phase 3, not Phase 4.
6. Seven registry-like artefacts exist (hand feature registry gating DB
   writes; generated feature/tag registry; 54 taxonomy dicts of which
   only 2 went through the freeze-gate JSON process; frozen vocab files;
   canonical-registry-v1.md; normalized-v1.json; market registry +
   reviewer state). "Not one coherent contract" is confirmed; Phase 1's
   "do not create another registry" is therefore binding.

## Governance (non-negotiable, applies to every phase)

- Decision rights: Codex agents DRAFT; Fable REVIEWS every diff that
  touches legal semantics, identity, or extraction behavior; Ben DECIDES
  taxonomy values, codebook vocabularies, and freeze-gate changes. A
  plausible-but-wrong legal answer is the worst failure class — worse
  than no output. Nothing merges unreviewed.
- Every Codex prompt is self-contained (no session history, no secrets)
  and carries the repo primer from docs/PLAN.md.
- Corpus writes run only on Ben's machine, dry-run-first, using the
  established delivery-script pattern (embedded human-reviewed tables,
  paginated reads, per-deal diffs, --apply).
- Mechanical gates on every PR: npm test, npm run build, INVARIANT lint
  (post-commit), golden evals (node scripts/eval.js) for anything
  touching extraction, drift tests for anything touching registries.
- Product delivery does not stop. Ben's feedback rounds interleave with
  program phases; the program must be structured as independently
  shippable increments, not a big-bang migration branch.

## Phases (Codex's structure, amended)

### Phase 0 — Factual baseline (adopt, with a P0 pre-step)
P0 pre-step, ship in days: (a) fix the market-registry data_type
derivation + the five verified wrong rows; (b) point /admin/taxonomy at
the real claims/provisions/cards tables and give that deployment its env
vars (it is offline, not broken); (c) classify the 704 registry entries
into active-and-visible / extracted-not-surfaced / dormant — resolve the
ACTIVE subset only, exactly as the review says.
Then the comparability matrix as specced (every rendered row: concept,
party, source, attributes, shape, presence semantics, normaliser owner,
comparison dimensions, UI consumers, representative deals,
extracted-vs-inferred-vs-repaired). Seed it from the verification
inventory of normalisers (in the session record) rather than starting
cold. Gate as specced.

### Phase 1 — One canonical contract (adopt)
ProvisionConcept / ClaimDefinition / MetricDefinition, extending the
EXISTING canonical model (triple-model doc) — no eighth registry. The
hand feature registry (lib/schema/features.js) remains the write gate
during transition; the contract generator must reconcile it, the
taxonomy dicts, and the market registry with bidirectional drift tests
(the pattern already exists: tests/registry-generated-drift.test.js).
Freeze Gate governs vocabulary changes; note only 2 of 54 dicts are
frozen today — freezing the rest is part of this phase, Ben-gated.
Review-table components reference metric keys; they stop manufacturing
metric specs (this retires the class of bugs the r18/r19 rounds patched
one at a time).

### Phase 2 — Identity and lineage (adopt, one gate amended)
concept_key, provision_instance_id, excerpt_id, claim_id, metric_key as
specced; explicit provisions↔cards relationship replacing the spanHash
best-effort join; definitions as Provision(kind=definition) with
references_definition edges; corrections attached to stable identities
(reapply-corrections migrates off fuzzy rematching).
AMENDED GATE: "re-ingesting the same deal twice produces identical
identities" holds only when identity is anchored to (document hash,
source offsets, concept_key, party, ordinal) — never to LLM-produced
content. LLM extraction is not deterministic at the content level;
requiring content-level determinism would fail permanently or force
degenerate anchoring. Claim CONTENT may vary across runs and is
reconciled; claim IDENTITY may not.

### Phase 3 — Classification and extraction repair (adopt)
As specced (two-pass definitions, codebook enforcement at persistence,
residual capture ON — implementing the GAP-E design, concept-aware
dedup, Strategy-B offsets, cross-type post-passes on per-type reprocess,
explicit absence only when examined). Add from the current punchlist:
the sentinel standardization (WP-R6), party_scope real values at write
time (retiring the text-mining party attribution in ioc-exceptions),
the fold-in minting pattern (WP-R7, Fable-gated), and the quote-capture
repairs (WP-R4). Bring-down as a typed relationship: adopt.
Golden tests per family: adopt; extend the existing eval harness rather
than building a second one.

### Phase 4 — Centralised normalisation (adopt, scope corrected)
Versioned normalisers owned by the Claim registry; the normalised-
observation shape and cohort rules as specced (no silent
equity/enterprise/transaction cohort mixing; 24h → 1 elapsed day never
1 business day; unresolved stays unresolved). Migration source list =
the Phase 0 inventory; migrate the table-config text-miners
(party/band/limb/fragment/qualifier/person/mechanism reconstruction)
INTO extraction or registry normalisers as their underlying data gaps
close in Phase 3 — each keeps a recovery_reason counter until its
family's backfill hits 100%, then dies. derived-fields.js is the
blessed pattern for query-time derivation; unelide-quote stays at the
query layer until WP-R4 makes it unnecessary.

### Phase 5 — Backfill (adopt)
Four correction classes and staged rollout (QXO → Verve → Metsera → 10
varied → corpus) as specced; each stage uses the existing discipline:
pre-write backup, dry-run diff, correction-preservation audit
(reapply-corrections), idempotence re-run, before/after market-stat
diff, no partial writes. WP-R1 (Summit fee) and WP-R2 (Heinz equity)
ride the first applicable stages as targeted re-extractions.

### Phase 6 — One row model across surfaces (adopt)
As specced. Note convergence already underway: compare/market/sidebar
now share row-identity and distribution machinery (compareRowUnion,
corpus-stats-core deal-counted distributions); this phase completes it
and adds the presentation rules (explicit absent / not-applicable /
extraction-failure states replacing blanket "No market data" — the
distinction the r19 numeric work already began).

### Phase 7 — Operational admin (adopt, wording corrected)
Repair /admin/taxonomy to live tables (and fix its deployment env);
replace processing-flow stubs with real run metrics, labeling each
stage current-vs-target; four live schema-loss queues (turn residual
capture ON as part of Phase 3); the drill-down chain as specced.

### Phase 8 — Continuous release gates (adopt)
All eleven invariants adopted. Implement as additions to the existing
invariant lint + test suite; "compatibility-recovery usage can only
decrease" is measured via the recovery_reason counters from Phase 4.

## Sequencing and ownership

- Order: P0 pre-step immediately (Codex, mechanical); Phase 0 matrix
  next (Codex drafts, Fable reviews coverage); Phases 1–2 are the
  architectural core (Codex drafts the contract + migration, Fable
  reviews, Ben freeze-gates); Phase 3 items can start in parallel where
  they are independent (sentinel, party_scope, residual capture);
  Phases 4–6 follow the contract; 7–8 land incrementally throughout.
- Ben's product feedback retains priority: rounds interleave, and the
  program's increments must each leave main shippable.
- The existing WP-R punchlist in docs/PLAN.md maps: R1/R2→Phase 5,
  R3/R8→Phase 3 data passes, R4→Phase 3, R5→Phase 5, R6→Phase 3,
  R7→Phase 3 (Fable-gated), R9→Phase 1 vocabulary work (Ben-gated),
  R10→independent cosmetic.
