# Reasoning behind the import steps, D4 and D5

Follow-on to `docs/codex-program/ROADMAP.md` steps D4 and D5, added 2026-08-06. Those
two steps are the plan; this note is why they are shaped the way they are, what was
tried and turned down, and what is genuinely still open for Ben to answer. It is a
reasoning record, not a tenth planning document: `OPERATING-RULES.md`'s document table
lists four live planning documents and does not mention the `notes/` directory, the
same way it does not mention the fifteen other files already sitting there.

---

## The task, and what was checked before planning on it

The brief that produced this note said three specific things and asked that they be
checked, not assumed:

1. `lib/canonical-v2/canonical-writer.js` contains exactly one repository
   implementation, `InMemoryCanonicalRepository`, and no persistent one. **Confirmed.**
   `grep -n "class.*Repository" lib/canonical-v2/canonical-writer.js` finds one class,
   `InMemoryCanonicalRepository`, at line 787.
2. Across every file in `lib/canonical-v2/` holding a database connection, there are
   zero `INSERT` and zero `UPDATE` statements, and `serving-client.js` only reads.
   **Confirmed, narrowly.** `grep -rniE "INSERT INTO|UPDATE .* SET" lib/canonical-v2/`
   returns nothing, and `serving-client.js` only ever calls `pool.query` against a
   `SELECT public.<rpc_name>(...)` statement. This claim is true exactly as scoped to
   `lib/canonical-v2/`. It is not the whole picture: see "What actually exists already"
   below, which the original brief did not know about and which changes the shape of
   this plan for the better.
3. The bridge from extraction to the product is not built. **Confirmed, for the
   surface that matters.** `pages/api/review/[id]/cards.js`, the route that actually
   serves the review page's provision cards, imports five things: `getServiceSupabase`,
   `fetchReviewDealCards`, `trimReviewDealForWire`, `attachCanonicalV2Preview`, and
   `attachCanonicalTerminationFeeServing`. None of them is `serving-client.js` or
   anything that reads from a database for Canonical V2. The one family that does
   serve real V2 data, termination fees, does it from a hand-typed, hash-verified
   fixture file (`lib/canonical-v2/termination-fee-serving-source.js`), not from a
   database. So the claim holds for the surface this plan is about, provision cards on
   the review page, even though a different, narrower bridge exists for a different
   surface (see below).

The brief also said, as background, that "the owner has confirmed import is
authorised." That does not sit comfortably next to `OPERATING-RULES.md`'s own
authority boundary, which lists "importing candidate data" as prohibited under current
authority with no carve-out for it the way extraction was carved out by name. This is
the first of the two open questions below, and it is why D5 is gated rather than
written as already permitted.

---

## What actually exists already, and why it changes the shape of this plan

Before designing anything, the repository was searched for prior work on exactly this
problem, because a plan that says "build an importer" without checking is exactly what
this brief warned against.

**A full native schema for Canonical V2 already exists, unused.**
`supabase/canonical-v2-foundation.sql` defines a `canonical_v2_staging` schema with one
table per write-set object kind: `claim_revisions`, `provision_instances`,
`relationship_revisions`, `excerpts`, and the rest of `WRITE_ORDER` from
`canonical-writer.js`, plus `residuals`, `quarantines`, `deals`,
`deal_admission_records` and `write_receipts`. Each table is `(id text PRIMARY KEY,
closure_id text NOT NULL, canonical_payload jsonb NOT NULL, canonical_payload_digest
text GENERATED ALWAYS AS (...))`, keyed by the object's own content-addressed id. This
is not a proposal; it is a committed, unused schema that matches
`canonical-writer.js`'s own object model closely enough that it looks deliberately
designed against it.

**A SQL-native writer function already exists for the same operation.** The same file
defines `public.canonical_v2_write(p_environment, p_operation, p_idempotency_key,
p_input_digest, p_write_set, p_residuals, p_quarantines, p_receipt)`, a `SECURITY
DEFINER` function (line 1167) that independently recomputes each object's
content-addressed identity inside the database before inserting it, the same
defence-in-depth idea `canonical-writer.js` already applies once in the application.
Its parameter list mirrors `buildCanonicalWriteReceipt`'s own inputs closely enough
that it looks built for exactly this write path.

**None of this has been proven to run.** Nine test files,
`tests/canonical-v2-writer-*-identity-sql.test.js`, check this function's behaviour,
but every one of them reads `supabase/canonical-v2-foundation.sql` as a text string
and pattern-matches fragments of it (`sql.indexOf(...)`, `assert.match(branch, ...)`).
None of them opens a database connection. One neighbouring script,
`scripts/canonical-v2-staging-qxo-termination-fee.mjs`, says so itself, in its own
header comment: "it never calls `supabase db query` and never writes anything," and
names building "a real `DEAL_SCOPE_RUN` write" as a "follow-up packet, not authorized
here." So the honest description is: a well-specified, apparently complete SQL writer
that nobody has actually run. D4 below treats proving it, on a throwaway database, as
its first concrete task, before writing anything new on top of it.

**A different, adjacent import mechanism does exist and is wired to live code, for a
different surface.** `lib/canonical-v2/candidate-release-import.js` (1085 lines) and
`supabase/canonical-v2-serving.sql` implement a real "import to an inactive release
partition, then flip an active pointer" pattern, feeding `market_observations`,
`shared_serving_rows` and `product_query_result_serving_records`. It is read by
`pages/api/canonical-v2/review-context.js` and `exact-detail.js` through
`serving-client.js`'s RPCs, which are in turn called only by
`components/review-v2/CanonicalReviewSection.jsx`, a different component from the
plain review page. This is the search and market layer's problem (P7 and P8 in the
roadmap), not the review-page card layer's, and it was deliberately not reused
wholesale for that reason: see "Alternatives rejected" below.

**Historical SQL scaffolding exists and is correctly left alone.** `sql/optionA/` and
`sql/qxo-reverse-f3/`, `sql/qxo-reverse-f4/` hold numbered, generated
dry-run-then-apply-then-verify(-then-rollback) SQL files from 23 to 24 July 2026,
including a real, fully worked QXO termination-fee import attempt with real digests
and row counts. `docs/archive/README.md` describes `sql/optionA/` as a frozen copy of
`canonical-v2-serving.sql`'s function body, and `docs/codex-program/MERGE-PLAN.md`
classes it as inert, comment-and-string-literal-only from a merge-risk point of view.
Neither directory is cited anywhere in `ROADMAP.md`, `DECISIONS.md` or
`OPERATING-RULES.md`. Read as a whole, this looks like early exploration that informed
the later, cleaner `canonical-v2-serving.sql` design and was then left in place as
reference, not as a second, live pipeline to reconcile with. D4 does not build on it
directly, but does reuse its file-numbering convention (`NN-verb.sql`, dry run before
apply, a dedicated verify step) for the artefacts D4 and D5 produce, because it is
already the established shape for this kind of operation in this codebase and nothing
here improves on it.

---

## Why lane D, not lane P

The brief asked for this to be decided and justified, not assumed.

Lane P (product) is about deciding what V2 should learn and proving it is right: which
claims exist (P2), which cards leak into the wrong table (P4), whether a family's
output agrees with V1 (P1, P3, P9). Those are legal-taxonomy and correctness
questions. The mapping from claims to product rows for this problem is **already
solved** by the sixteen `*-product-projection.js` modules; nothing about the import
step changes what a card looks like or what claim types exist.

What is missing is purely mechanical: moving an already-validated file from disk into
a place a reader can query it, safely, reversibly, and without touching the one copy
of production data this product has. That is a delivery problem, the same kind of
problem D1 (merging a branch) and D2 (going live) already are. D2 itself already
named "an import script writing to an inactive namespace with checkpointed resume" as
one of its five decided deliverables and said plainly that none of the objects it
would need exist in code. D4 and D5 are that missing design, placed where D2 already
pointed.

---

## What gets written: the mapping, precisely

| V2 write-set object | What it is, in plain terms | Product surface today | Import destination |
|---|---|---|---|
| `claims` | A single governed fact and its value, for example a termination fee amount | Rendered as a field on a provision card, via `*-product-projection.js`, stamped with `canonical_v2_lineage` | `canonical_v2_staging.claim_revisions` |
| `relationships` | A link between two facts, for example which trigger a fee amount attaches to | Consumed inside projection modules to join related cards | `canonical_v2_staging.relationship_revisions` |
| `provisions` (`provision_instances`) | The clause a claim belongs to | The unit a card's evidence quotes back to | `canonical_v2_staging.provision_instances` |
| `excerpts` | The exact quoted text and its position in the agreement | The verbatim quote shown as evidence on a card | `canonical_v2_staging.excerpts` |
| `components`, `condition_groups` | Sub-parts of a provision or a grouped set of conditions, used by specific families | Feed the families that need them (for example Capitalisation, Closing Conditions) | `canonical_v2_staging.provision_components` / `.condition_group_revisions` |
| `open_world_candidates` and its four related arrays | Facts the taxonomy does not yet have a governed slot for, kept as evidence rather than discarded | Not confirmed in this pass. Flagged as open below. | Schema exists; consumption not verified |
| `semantic_impact_closures` | Internal bookkeeping tying one semantic unit's writes together for identity checking | Not rendered; used for conflict detection only | `canonical_v2_staging.semantic_impact_closures` |
| `reviewed_source_specific_rows`, `incomplete_canonical_result_rows` | Rows shaped for the search and market query layer | A different consumer (P7, P8), not the review page | Schema exists; out of D4/D5's scope |
| `RESOLUTION_REVIEW_QUEUE/V1` (the review queue) | Candidates the resolver could not auto-decide | Human triage only, three admin scripts, never rendered | Never imported. Not part of the write-set at all; see below. |
| `residuals`, `quarantines` | Facts excluded, and why | Not rendered; audit trail only | `canonical_v2_staging.residuals` / `.quarantines`, written for the record, never read by the card-serving path |

**What has no home.** The open-world family of objects (candidates, occurrences,
evidence references, dispositions, primitives) has a schema and a place to be written,
but this pass did not chase down whether any product surface actually reads them today
or is meant to. That is a genuine gap in this note's own research, not a finding that
they are unused; D4 should resolve it empirically (grep every consumer of each object
kind) before assuming either answer.

---

## Idempotency and identity: reusing what already exists, not inventing new keys

`claim_revision_id`, `provision_instance_id`, `subject_occurrence_id` and the rest of
`OBJECT_ID_FIELDS` (`canonical-writer.js`) are content-addressed: the same fact,
extracted the same way, produces the same id every time. `canonical-writer.js` already
uses this for safe replay under an `idempotencyKey`, matched against a content
digest, and already refuses a genuine change under a reused key rather than silently
overwriting it. The plan reuses this exactly, rather than minting a new identity
scheme, because the brief was explicit that these identities' stability has been
carefully preserved and should not be reinvented.

"Checkpointed resume," named by D2 itself and by `EXECUTION-LEDGER.md`'s
`P10-PRODUCTION-IMPORT` entry as a required property, follows from the same
mechanism: a driver that processes one write-set file (one deal, one family, one run)
at a time, keyed by its own idempotency key, can simply be rerun from the start of a
batch after any failure, because every file already committed replays as a no-op. No
separate checkpoint file should be needed, provided this is actually proven, not just
assumed from the design; D4's acceptance criteria include a test that kills the
driver mid-batch and reruns it.

---

## What must never be imported, and how the importer proves it rather than trusts itself

Two categories, excluded two different ways.

**Quarantined objects** never reach `publishableWriteSet` in the first place:
`validateCanonicalWriteSet` / `validateResolvedCanonicalWriteSet`
(`lib/canonical-v2/validate-write-set.js`) already split a write-set into
`publishableWriteSet`, `residuals` and `quarantines` before `canonical-writer.js` ever
calls `writeObject`. The importer must call these same validators itself on whatever
file it is given, never trust that a file on disk was already validated when it was
written, and only ever pass `publishableWriteSet`'s rows to the insert path. This is
enforced by construction, and D4's acceptance criteria require a hostile test that
splices a quarantined object into a write-set's `claims` array and confirms the
importer refuses it.

**Review-queue items** never become part of a write-set at all. They live in a
separate artefact, `RESOLUTION_REVIEW_QUEUE/V1`
(`lib/canonical-v2/native-producer/review-queue-artifact.js`), written by the run
driver and read only by three human-triage scripts. Exclusion here is also by
construction, since the importer never reads that artefact as an input. As a
belt-and-braces check, not a required one, the importer should confirm, where a
sibling review-queue artefact exists for the same run receipt, that none of its item
identities appear among the write-set's claim ids, and refuse if one does.

---

## Reversibility

Two layers, matching D4 and D5.

Locally (D4), reversal costs nothing and is proven anyway, as rehearsal: drop the
throwaway database, and separately, prove that a `pg_dump` taken before a run can be
`pg_restore`d to recover the exact pre-import state. This is D2's own first decided
deliverable, done here for free before it needs to be done for real.

Against a real database (D5, and eventually production), the same content-addressed
idempotency key that makes a rerun safe also makes an undo precise: every row written
under one key can be deleted by that key alone, which is a well-defined, narrow
operation rather than a guess. This becomes a `--rollback` mode on the same script,
dry-run then apply then verify, following the exact convention already established in
`sql/qxo-reverse-f3/generated/` and `sql/qxo-reverse-f4/generated/`
(`09-rollback-dry-run.sql`, `10-rollback-apply.sql`, `11-verify-rollback.sql`), reused
rather than reinvented.

---

## Credentials, and what can be proven without them

D4 needs no credential of any kind. It runs against a Postgres instance the person
doing the work creates and destroys themselves (a local container, or the Supabase CLI
if available), with `supabase/canonical-v2-foundation.sql` applied directly. `pg` is
already a `package.json` dependency, so no new package is needed. No such local
convention exists in this repository today; D4 establishes one, documented precisely
enough that someone with no Supabase account can reproduce it from a clean checkout.

D5 needs the existing `CANONICAL_V2_STAGING_DATABASE_URL` credential, the one
`serving-client.js` already validates the shape of, which per `OPERATING-RULES.md`
only ever runs from Ben's own machine. Production needs its own, separate,
later-authorised credential and is out of scope for both new steps; it stays owned by
D2's own remaining steps 4 and 5 (flip the switch, run a rollback for real) and by
`EXECUTION-LEDGER.md`'s `P10-PRODUCTION-IMPORT` milestone, gated on M3 passing, which
this plan does not claim to satisfy.

---

## Alternatives considered and rejected

**Extending the release-partition and active-pointer pattern
(`candidate-release-import.js`) to claims, instead of a plain idempotent upsert.**
Rejected. That pattern solves a problem specific to precomputed, corpus-wide
aggregates: a search or market query needs a single, consistent snapshot of the whole
corpus to page through, so swapping a pointer atomically matters. Claims and
provisions are read per deal, one at a time, and a deal with no V2 data yet already
degrades gracefully to the V1 fallback, the same way `NOT_REGISTERED` already works in
`termination-fee-serving-source.js` today. There is no partial-corpus inconsistency to
protect against at this layer. Borrowing the heavier pattern anyway would cost real
complexity for a problem this layer does not have. This is a considered judgement, not
a certainty; if a future need for corpus-wide read consistency on the claims layer
turns up, this choice should be revisited, not assumed settled forever.

**Writing V2 data into `public.provision_cards` or `public.claims`, tagged with
`canonical_v2_lineage`, alongside V1 rows.** Rejected outright, not by this plan's own
judgement but because `OPERATING-RULES.md`'s ADR-001 already forbids it in absolute
terms: "Flattened cards must not be written to the production card table, the claims
table, or any other persistent store, ever." `canonical_v2_lineage` is a real,
already-used field, but it belongs to the native card shape the projection modules
already produce at read time, not to a stored row in the legacy tables.

**A bespoke checkpoint file, instead of relying on idempotency-key replay.** Rejected
for now, on the reasoning under "Idempotency and identity" above: if replay-as-no-op
holds, as `canonical-writer.js`'s existing tests already suggest it does for the
in-memory repository, a separate checkpoint mechanism is redundant complexity.
Flagged, not certain: D4 must prove this holds against a real database before relying
on it in D5.

**Generating SQL text for a human to run by hand, rather than a script that calls the
database directly.** Considered, given `sql/optionA/`'s own convention of generated,
reviewable SQL files. Not required as the only mode: recommend the import driver
support both, generate the exact SQL or RPC call it intends to run for review, the
same numbered-file convention `sql/qxo-reverse-f3/f4` already use, and support running
it directly against a connection string the operator supplies. This keeps the local,
credential-free path (D4) fully automated and fast to iterate on, while keeping the
staging and any eventual production path (D5, and later) auditable before it executes,
which matches how this codebase already treats every other risky database operation.

---

## Open questions for the owner

**1. Whether D5 is already authorised, or needs to be.** `OPERATING-RULES.md`'s
authority boundary lists "importing candidate data" as prohibited under current
authority, with no carve-out the way extraction got one by name. `DECISIONS.md` item 9
decides the shape import should take once it runs; read on its own words, it does not
say it may run yet, and D2 itself gates the "load the new data" deliverable on lane S
completing. The brief that produced this plan said import is authorised. This note
does not resolve that tension on its own authority; D5 is written as gated on an
explicit answer, and ROADMAP.md's Part 5 now carries this as its second open item.

**2. Whether `public.canonical_v2_write` actually works.** Its text, and the tests
that pattern-match that text, imply a complete `DEAL_SCOPE_RUN` implementation. Nobody
has run it. D4 is designed so this gets found out cheaply and early, on a throwaway
database, but the answer is not yet known, and this plan should not be read as
promising the existing SQL machinery is production-grade until that first proof
happens.

**3. What the open-world objects, and the reviewed-source-specific and
incomplete-result rows, actually feed on the product side, if anything.** Marked
"not confirmed" in the mapping table above rather than guessed at. Worth a short,
dedicated check before D4 goes further than the claim and provision path the review
page actually needs.
