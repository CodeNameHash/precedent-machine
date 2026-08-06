# Module read: batch AD (scripts/, 39 modules)

Status: IN PROGRESS — written incrementally, one module section at a time.

Verification pending until all modules read; see bottom of file for the final
`npm test` / `forbidden-patterns.sh` results.

---

## 1. `scripts/code-information-sharing.js`

**What it does.** One-off backfill: stamps a hardcoded, Ben-reviewed
`CODING` table (30 deals) of five NOSOL info-sharing fields
(`informationSharing`, `copiesScope`, `bidderIdentity`, `ongoingUpdates`,
`engagementNotice`) onto each deal's NOSOL provision row in Supabase. Locates
the target row with a three-tier placement heuristic (verbatim `keyQuote`
containment first, then NOSOL-NOTICE/DISCLOSE type code, then the bare
NOSOL/NOSOL-PROHIBIT head row as last resort) and only writes under
`--apply`; a bare run is a dry-run diff. Genuinely a delivery vehicle, not a
classifier, matching its own header — nothing here is re-derived at runtime.

**Defect: the five stamped fields never carry their evidentiary quote.**
The schema (`lib/schema/features.js`, generated) marks all five fields
`citable: true`, and the `citable` review-UI convention (see
`EditPanel.js`, `nosol-noshop.config.js`, `mae-definitions.config.js`,
`material-contracts.config.js`, `conditions.config.js`,
`ioc-exceptions.config.js`) is to render `item.quotes[0]` as the on-screen
evidence for a coded value. Every `CODING` entry carries a hand-picked
`keyQuote` — that is literally what the placement heuristic keys off — but
`taggedValue()` (line 413) only takes `(dict, dictName, code)`, never the
entry's `keyQuote`, and always writes `quotes: []`. Contrast with the sibling
script `code-intervening-event.js`, whose `taggedType()` does pass
`quotes: [entry.keyQuote]` through onto the field it writes. If/when a
review-page config is built for these fields (see next finding), it will
render "coded value, no source text" for all 30 deals unless this is fixed
alongside it — a one-line change (`taggedValue(dict, dictName, code, quote)`
threading `entry.keyQuote` into the returned object).

**Capability nobody is using — orphaned data, not orphaned code.** This is
the inverse of the classifier story but the same shape: `lib/taxonomy.js`
fully defines the five-field codebook, `lib/schema/features.js` has full
generated entries for all five (`provisionTypes: ["NOSOL"]`, `citable:
true`), and this script has already back-filled reviewed values across most
of the NOSOL corpus (30 CODING + 4 explicitly UNRESOLVED). But nothing
renders any of the five fields anywhere a human would see them: grepped
`components/review-v2`, `pages/review`, and every `components/review/
table-configs/nosol-*.config.js` for all five field names — zero hits. The
only other place these five names appear is
`lib/registry-review-suggestions.js`/`RegistryMergeBoard.jsx` (generic
cross-deal admin merge tool, not the per-deal review page) and one unrelated
name collision (`informationSharingRow` in `antitrust-regulatory.config.js`
is a different HSR-adjacent concept). Data a human already reviewed and
approved is sitting in the DB with no display path. Worth a line in
`docs/core/PLAN.md` if that plan tracks review-UI coverage of the NOSOL
codebook fields — I did not check PLAN.md's current contents (out of scope
for edits) but flag this because "coded and stored, never shown" is exactly
the class of gap the task asked to surface.

**Header accuracy.** Accurate as written; no change made.

---

## 2. `scripts/code-intervening-event.js`

**What it does.** Same delivery-vehicle pattern as module 1, for a
different codebook: stamps `interveningEventType` (IE_POSITIVE_ONLY /
IE_POSITIVE_OR_NEGATIVE) and `interveningEventExceptions` onto the NOSOL row
that actually carries the deal's `interveningEventDefinition` text (10 coded
decks, 15 UNRESOLVED, `--apply` gated). Placement is simpler and stricter
than module 1's: only rows whose stored `ai_metadata.features
.interveningEventDefinition` is a non-empty string qualify as targets — no
fallback tiers — "the row the coding was read FROM."

**Consumer confirmed live**, unlike module 1: `interveningEventType`/
`interveningEventExceptions` are read by
`components/review/table-configs/nosol-intervening.config.js`,
`lib/row-market-stats/legal-normalizers.js`, and
`lib/market-metrics/registry.js` — this codebook feeds both the review page
and cross-deal market-metrics, so this script's write path matters
operationally, unlike module 1's currently-orphaned one.

**Minor asymmetry, not a bug.** `taggedType()` sets `quotes: [entry
.keyQuote]` on `interveningEventType` (evidence carried through, correctly),
but `taggedExceptions()` sets `quotes: []` on every exception tag — there is
no per-exception quote in the CODING table to carry (exceptions are read off
the same definition text as the type grade, not separately quoted), so this
looks like a deliberate, defensible omission rather than the module-1 defect.
Flagging only so it isn't mistaken for the same bug on a skim.

**Header accuracy.** Accurate; no change made. The UNRESOLVED comments
correctly distinguish "no stored definition text" from "legacy
`interveningEventScope=POSITIVE_ONLY` with empty quotes, not trustworthy" —
worth noting this legacy field (`interveningEventScope`) still exists
somewhere upstream; this script does not touch it and does not clear it, so
a stale `interveningEventScope` and a fresh `interveningEventType` can
coexist on the same row post-`--apply`. Whether any reader still prefers the
legacy field over the new one is outside this script; flagging as a question
for whoever owns `nosol-intervening.config.js`.

---

## 3. `scripts/compare-report.js`

**What it does.** Read-only demo/proof script for the general
cross-deal comparison engine in `lib/feature-compare.js`: prints the
schema-derived catalog of every distributable feature per provision type
(`comparableFeatures()`), sample distributions for three fields across
kinds (coded/taxonomy, set-membership, ordinal enum), and a materiality
outliers pass demonstrating the n<12 guardrail (`featureOutliers`). Accepts
`--sector` to rescope the cohort; everything is recomputed live from
Supabase, nothing cached.

**Capability check.** `comparableFeatures`, `compareFeature`,
`cohortFeatureStats`, `featureOutliers` are not orphaned — `lib/rep-
materiality.js` wraps the same four functions for production use (rep
materiality stats/outliers). This script is genuinely just the "prove it
works end-to-end" harness its header says it is, mirroring
`scripts/taxonomy-report.js` (module 37, read below). No gap found.

**Header accuracy.** Accurate; no change made.

---

## 4. `scripts/confirm-kind-ruling.mjs`

**What it does.** The only code path that writes
`contracts/ruling-corpus/ruling-corpus.v1.json` (per its own header, and
confirmed by grep — no other file writes that path). Reads one item from a
persisted `RESOLUTION_REVIEW_QUEUE/V1` artifact by `--index`, requires a
human-typed `--kind`/`--code`/`--reviewer` on the command line, and appends
a `provenance_tag: 'VERIFIED'` entry via `lib/canonical-v2/native-producer/
ruling-corpus.js`'s `appendRuling`, recomputing the corpus's content
address. `--reviewer` is checked first, before any file I/O. Exports
`resolveQueueItemKeyFields`/`selectQueueItem`/`buildVerifiedRulingEntry` for
direct unit testing (exercised by `tests/canonical-v2-ruling-corpus.test.js`).

**Header fixed (was stale, corrected in place).** The header claimed
`--lexicon-version` "defaults to the corpus's own QUALIFIER_KIND_LEXICON_VERSION
import when that module exists; since it does not yet, it is REQUIRED until
that module lands." `lib/canonical-v2/native-producer/qualifier-kind-
lexicon.js` now exists and exports `QUALIFIER_KIND_LEXICON_VERSION = 2` — but
the script was never updated: `--lexicon-version` is still unconditionally
required via `requireStringArg`, there is no import of the lexicon module,
and no default was ever wired up. Rewrote the paragraph to state the current
(still-manual) behaviour and flagged the gap explicitly rather than
re-describing a pending future as if it were still pending.

**Defect this surfaces: no cross-check on the typed lexicon version.**
Not just a missing default — `ruling-corpus.js`'s entry validator (line
177-178) only checks `lexicon_version_at_ruling` is a positive integer, and
`draft-kind-rulings.mjs` never references lexicon version at all. Nothing,
anywhere, checks the human-typed `--lexicon-version` against the real
`QUALIFIER_KIND_LEXICON_VERSION` constant. Since the design's own stated
purpose for recording this field is provenance/audit ("the lexicon version
in force at ruling time"), a stale or fat-fingered number silently
corrupts that audit trail with no error anywhere in the pipeline. Concrete
fix: import `QUALIFIER_KIND_LEXICON_VERSION` in this script, default
`--lexicon-version` to it, and warn (or fail) loudly if an explicitly-passed
value disagrees with the live constant. Worth a line item if
`docs/core/PLAN.md` has a ruling-corpus hardening task — I did not check.

---

## 5. `scripts/coverage-audit.js`

**What it does.** LLM-backed post-check on the coverage metric
(`lib/verification.js`'s `computeCoverage`). For a deal (or `--all`), samples
every region the coverage gate EXCLUDED from its denominator and every large
remaining GAP, asks an LLM (`--backend claude`/`codex` via
`lib/llm-cli-client.js`) to classify each as boilerplate vs
`SUBSTANTIVE_DEAL_CONTENT`, and writes `reports/coverage-audit-<ts>.json`
(optionally to `run_reports` via `--report-db`). Exits 1 if any excluded
region is flagged substantive — the intended failure mode being "the
heuristic wrongly threw away real content."

**Not run, not gated anywhere.** Confirmed by grep: not referenced in
`package.json`, not in `docs/codex-program/programme-gates.yaml`. It is a
manually-invoked tool, consistent with its own header. `persist-report.js`
already lists `coverage-audit` as a valid `run_reports` kind and
`/admin/reports` presumably can render its history if `--report-db` is ever
used, so the plumbing is ready even though nothing schedules the audit
itself. No action needed unless Ben wants this on a cadence — not currently
in scope of this task to judge.

**Header accuracy.** Accurate; no change made. (Note for the reader, not the
header: this script makes real LLM calls under `--backend`, so it was not
executed as part of this review, only read.)

---

## 6. `scripts/curation/mint-cards.js`

**What it does.** Ben-gated tool that mints a `provision_cards` row (plus
the `parser_regions` row it must anchor to) for any coded provision that
currently has no card and therefore "renders nowhere in the review UI and
[whose] codes never reach claims." Target selection reuses the exact match
ladder `rematerialize-claims.js` uses (`buildDealPlan`) so "has no card" is
defined identically in both tools, then applies a skip ladder (ambiguous /
title-taken-by-an-EXISTING-card / region-hash-taken) before writing. Every
mint is re-verified post-hoc by re-running the match ladder with the new
cards included; any minted card that fails to match its own source
provision at rung 1-2, or that introduces a new ambiguity, zeroes out
writes for that whole deal (not the whole run). `--apply` requires
`--backup <path>` (own local dump, since it must also cover
`parser_regions`, which `prune-cards.js`'s dump does not).

**Checked, not a defect.** The title-collision guard only checks a
candidate's category against pre-existing cards' `short_title`
(`existingTitles`, built once from `cards`, never updated as candidates
accumulate) — so two card-less provisions that share a category but have
different text CAN both be minted in one run, each with the same
`short_title`. Read this as a possible reintroduction of the "duplicate
title" pathology `prune-cards.js` exists to clean up, but
`tests/curation-mint-cards.test.js` (~line 405) proves this is deliberate
and tested: same-category/distinct-text pairs resolve 1:1 at rung 2 and are
allowed; only same-category-AND-identical-text pairs are the guarded-against
pathology (both skipped, `SKIPPED-REGION-HASH-TAKEN`). The header's own
wording ("collide with an EXISTING card's short_title") is precise, not
overclaiming — noting this only so the same question doesn't get re-asked.

**Wiring confirmed live.** Imported by `scripts/demo-dryrun.js` (module 10)
and referenced from `lib/query/prov.js` (shared hashing convention comment)
and `lib/reports/persist-report.js` (`'mint-cards'` is a valid `run_reports`
kind). `checkBackupGate` is imported FROM `prune-cards.js` rather than
duplicated — documented in the header, confirmed in code.

**Header accuracy.** Accurate; no change made.

---

## 7. `scripts/curation/prune-cards.js`

**What it does.** Deterministic, decisions-file-driven prune of duplicate
`provision_cards` rows: keep / rehome / delete / verify-then-hold /
recat-provision, acting only on cards explicitly named in a checked-in
JSON decisions file (`scripts/curation/decisions/*.json` — five real files
present, including `2026-07-pilot-prune.json` and `2026-07-round2-
approved.json`, so this has actually been used, not just built). Every
delete/rehome first checks a human-correction flag (skip, never override,
unless explicitly acked via `ackHumanCorrection`); an uncovered delete
(text not found in any remaining provision) is blocked by default unless
acked via `ackUncovered`. Whole run is all-or-nothing: any ambiguity,
missing-card reference, or unacked flag anywhere zeroes ALL writes, not
just the offending line.

**Capability nobody is using (exported, no caller found).**
`resolveCardRef` supports id-PREFIX matching ("full uuid or 8+-char
prefix") deliberately, per its own comment — a nice-to-have for hand-typing
decisions files with short ids. This works and is tested, but every
decisions file actually present under `scripts/curation/decisions/` should
be checked if any exploit this (did not verify — would need to compare id
lengths in the JSON files against full Supabase UUIDs; flagging as
low-priority since the feature degrades gracefully to exact-match either
way, it's just possibly unused convenience).

**Header accuracy.** Accurate; no change made.

---

## 8. `scripts/curation/rehome-correction.js`

**What it does.** One-shot, human-targeted tool: re-homes a single
`corrections` row onto an explicitly-named provision when the automatic
matcher (`lib/parser-v2/reapply-corrections.js`'s `matchCorrectionToProvision`)
can't find it (category/text drift after re-ingest, a card split into a new
row). Applies the delta the same way `reapplyCorrections` would
(`computeUserDelta`, contract-checked against `lib/parser-v2/reapply-
corrections.js` — matches), then — the actual point of the tool — writes a
FRESH `corrections` row anchored to the target provision's own identity
fields, so future automatic matching runs can find it without another
manual rehome. Refuses (no write) if the provision's current value for any
touched key has already diverged from the correction's recorded BEFORE
value.

**Design note, not a defect.** Unlike `prune-cards.js`/`mint-cards.js`,
`--apply` here has no `--backup` requirement — the tool's own safety model
is narrower blast radius (one correction, one provision) plus "never
deletes the original corrections row" for the audit trail, rather than a
pre-write dump. Consistent internally; flagging only because the other two
curation tools in this batch both gate `--apply` on a backup and a reader
skimming all three could wonder why this one doesn't.

**Header accuracy.** Accurate; no change made.

---

## 9. `scripts/deal-context.js`

**What it does.** Compact deal digest for LLM context, backing the
`/deal` skill (confirmed: `.claude/skills/deal/SKILL.md` is the only other
reference to this filename in the repo). Prints deal header + per-type
provisions with category/code/favorability/feature-values, truncated to
token budgets (`VALUE_MAX`=90, `FEATURES_MAX`=360 chars/provision,
`FULL_TEXT_MAX`=4000 with `--full`). Read-only; `deals.metadata` (which
holds the full agreement text) is deliberately never selected wholesale —
only `metadata->structure` via a scoped Postgres JSON-path select.

**Documented, verified-safe duplication.** The header admits `isCitable()`
restates `lib/citable.js`'s discriminator because that module is ESM-only
and this script is CommonJS. Compared both implementations line-for-line —
`isCitableValue` in `lib/citable.js` (`v != null && typeof v === 'object'
&& !Array.isArray(v) && 'value' in v && !('code' in v)`) is character-
identical to this file's `isCitable`. No drift today. Flagging only as a
standing risk the header already owns: if `lib/citable.js`'s discriminator
ever changes, nothing enforces this copy changes with it.

**Header accuracy.** Accurate; no change made.

---

## 10. `scripts/demo-dryrun.js`

**What it does.** The full pre-demo/CI smoke test against the LIVE
Supabase project: ingest a pinned fixture as a STAGING deal (shells out to
`ingest-local.js`, not required in-process, "so this script exercises the
exact CLI surface Ben runs"), run `ingest-qa.js`, materialize cards via
`mint-cards.js`, verify the review surface (cards + source-span resolution)
and query surface (`query-demo-check.js`, 20/20 + staging-invisibility),
optionally persist a `run_reports` row, then ALWAYS tear the staging deal
back out via an 18-table dependency-ordered delete + zero-residual
verification — success or failure. Wired into `.github/workflows/ci.yml`
(job `demo-dryrun`, path-gated, env/CLI-gated) — this is a live CI gate, not
a manual-only tool.

**Belongs in the plan — confirmed still-live production gap.** The
header itself documents "KNOWN PIPELINE GAP (2026-07-19 live-gate finding,
tracked separately — not fixed in this WP): production ingest does NOT mint
`provision_cards`. The only card writers are `mint-cards.js`, `backfill/
extract-to-cards.js`, and `reprocess/rematerialize-claims.js` — every
existing corpus deal got its cards via a one-off backfill... A freshly-
ingested deal renders EMPTY on /review until one of those runs." I verified
this is still true today, not stale history: grepped `scripts/ingest-
local.js` and `pages/api/ingest/from-url.js` for `mint-cards`/`provision_
cards`/`extract-to-cards`/`rematerialize` — zero hits in either. This
script's own `runMintCards()` step is a workaround scoped to its own
staging deal only, exactly as documented, not a fix. I also grepped
`docs/core/PLAN.md` for `mint`, `materializ`, `provision_cards`, "renders
empty" — zero hits. **A merger agreement ingested today through the actual
production path (CLI or API route) will show an empty review page until
someone manually runs one of three backfill scripts, and this is not
tracked anywhere in the production plan.** Given the repo is called
"m3-production-phase1," this reads as a launch blocker worth a line item,
not background noise — flagging it prominently rather than letting it sit
inside one script's header comment.

**Header accuracy.** Accurate; no change made. (DEFECT 1/2/3 notes inline
are historical — already-fixed live-gate findings from 2026-07-19 kept as
institutional memory, correctly framed in past tense; left untouched.)

---

## 11. `scripts/diff-runs.js`

**What it does.** Read-only inspector for `deals.metadata.extraction_runs`
(list runs, or diff run-vs-run / run-vs-current-stored) via
`lib/run-history.js`'s `diffSnapshots`/`formatDiff`/`snapshotStoredProvision`.
Confirmed the "written by every non-dry extraction since P0.2" header claim
is architecturally true, not just asserted: the writer
(`buildRunRecord`/`appendRunRecord` in `lib/run-history.js`) is called from
the single shared `lib/parser-v2/run-extract.js` entrypoint, not
re-implemented per caller.

**Header accuracy.** Accurate; no change made. Nothing else notable — small,
clean, does exactly what it says.

---

## 12. `scripts/draft-kind-rulings.mjs`

**What it does.** Task-7 "AI review drafter" for the ruling-corpus
subsystem (see module 4). Reads a `RESOLUTION_REVIEW_QUEUE/V1` artifact,
selects items flagged `QUALIFIER_KIND_DISAGREEMENT` /
`QUALIFIER_KIND_UNCLASSIFIED` / `RULING_LEXICON_CONFLICT`, composes a
self-contained prompt per item (quote + kind definitions + binding-rule
summary + current VERIFIED corpus entries), and runs it through a cheap
model (`claude -p --model haiku` by default, injectable `--runner`). Every
draft is REJECTED (not written) unless every `reasons_anchored_to_quote`
entry is a verbatim (or zero-width-normalised) substring of the quote
itself — a draft with an unanchored reason is "worse than no draft," per
its own header, and never reaches the drafts artifact.

**Verified wiring, not just claimed.** The header's cross-references all
check out: `.claude/skills/ruling-drafter/SKILL.md` exists (6.7KB, real
content, not a stub); `lib/canonical-v2/native-producer/ruling-corpus.js`'s
write path (`appendRuling`) is genuinely never imported here — grepped the
file, confirmed absent; drafts land only in `<queue>.drafts.json`, a
separate artifact from both the queue and the corpus. Strict separation of
"AI drafts" from "human VERIFIED rulings" is real, not just asserted.

**One header claim I could not verify either way.** "THIS ENVIRONMENT DOES
NOT HAVE THE CODEX CLI AVAILABLE" (hence `claude -p`, not Codex, despite
CLAUDE.md's routing table generally preferring Codex for producer work). The
design spec this implements is dated 2026-08-01, five days before this
review, so it's very likely still accurate for whatever execution context
it describes — but I can't tell from the repo alone whether "this
environment" means Ben's interactive terminal (where Codex CLI is in fact
available per this repo's own CLAUDE.md) or some other runner this script
executes under. Not changed; flagging per the task's instruction to say so
rather than guess.

**Header accuracy.** Accurate; no change made.

---

## 13. `scripts/eval.js`

**What it does.** The golden eval harness named explicitly in this repo's
CLAUDE.md as one of the required mechanical gates for extraction-prompt
changes (`npm run eval`, confirmed wired in `package.json`). Asserts
hand-audited expectations in `eval/goldens.json` (11 deals currently:
Landos, Metsera, Verve, Concho, Pharmasset, Kraft, Anadarko, TopBuild,
Covance, Frontier, Noble Africa) against LIVE Supabase data: provision/DEF
counts, required terms/categories, MAE carve-out counts (via a scored
`selectMaeDefinition` heuristic that prefers `DEF-MAE`-coded, exact-term,
non-Parent-specific definitions), coverage %, quote-verified %, schema-error
row counts, and two rollout-aware checks (`required_features`,
`feature_code_pins`).

**Not CI-gated — matches CLAUDE.md's own framing, worth restating.**
Grepped `.github/workflows/*.yml`: `eval.js` is not invoked anywhere in CI,
unlike `demo-dryrun.js` (module 10) which is. This matches CLAUDE.md's
description of it as a manual gate run "before merging any prompt/model/
pipeline change," so it is not itself a gap — but it does mean the gate
only fires if the person/agent making the prompt change remembers to run
it. Noting only because it sits in the same "important but not CI-enforced"
bucket as `coverage-audit.js` (module 5).

**Minor trap worth knowing, not a bug.** `feature_code_pins` reports a pin
as passing ("not yet extracted (pin armed)") whenever zero provisions in
the type group carry the feature yet — by design, so a codebook change can
be pinned before a re-extraction populates it. Reading the eval output
casually, an all-✓ run can mean "verified" or "not applicable yet,
technically true," and the two look identical in the console output (both
print `✓`). Not a defect — the "(pin armed)" text in the `actual` column is
the tell — but worth knowing before trusting a green `eval` run as proof a
codebook rollout actually reached the corpus.

**Header accuracy.** Accurate; no change made.

---

## 14. `scripts/export-m3-family-source-pack.mjs`

**What it does.** Read-only exporter: given `--family` (`general-covenants`
or `no-other-reps-fraud`, each a hardcoded array of canonical codes),
fetches every `provision_cards` row whose `provision_subtype` is in that
family (plus, for `general-covenants` only, a legacy-text routing rule that
recovers `COV-SECREPORT` cards mis-coded as `COV-LIST` by matching literal
"Post-Closing SEC Reports" text in the quote), and writes a content-
addressed `M3_FAMILY_LITERAL_SOURCE_PACK/V1` JSON artifact with a SHA-256 of
every quote and a per-code coverage disposition
(`GROUNDED`/`NO_GROUNDED_PRODUCTION_EVIDENCE`). Meant to be committed as a
replay fixture. Standalone tool — its only other reference in the repo is
its own test file.

**Header clarified, not a defect (cross-checked against a sibling
module).** On first read, `buildSourcePackSql`/`assertReadOnlySql` looked
like dead code: `run()` builds a parameterised SQL string, asserts it's
SELECT-only, then discards it and fetches via the supabase-js query builder
instead (`.select().in()`/`.or()`), never executing the asserted string or
using its `values`. That looked like a guard that doesn't actually guard
the real query. Reading `scripts/export-v1-provision-snapshot.mjs` (module
15) next showed this is a deliberate, named convention across this
repo's read-only exporters, explained clearly there: the SQL builder is
"a documented, testable artifact" of what the query is EQUIVALENT to (pure,
unit-testable without a DB connection, auditable spec of intent), while the
actual fetch intentionally uses the supabase-js builder for its own safe
parameterisation. This module's header didn't say that, so I added a
paragraph mirroring module 15's explanation and pointing at both siblings
(this file, `export-v1-provision-snapshot.mjs`, and
`scripts/audit/all-deals-card-backed.js`) so a future reader isn't misled
the way this review initially was. Correction-worthy lesson for the
household style: when this pattern recurs, the shorter header (this file's
original one) is the one that reads as a bug; the fuller one (module 15's)
reads as intentional. Worth keeping the fuller phrasing as the template if
more exporters are added.

---

## 15. `scripts/export-v1-provision-snapshot.mjs`

**What it does.** Read-only exporter of v1 `provision_cards` into a
content-addressed `V1_PROVISION_SNAPSHOT/V1` artifact — the exact input
`lib/canonical-v2/native-producer/v1v2-comparator.js`'s comparator net
consumes. Genuinely wired into production code, not a standalone tool:
referenced from `lib/canonical-v2/identity-consumer-closure-audit.js`,
`lib/canonical-v2/successor-m1-readiness-packet.js`,
`lib/canonical-v2/native-producer/v1v2-comparator.js`, and
`scripts/nets-eligibility-report.mjs` (module 23). Refuses to run without
an explicit `--deal` UUID allowlist (checked in `parseArgs`, before any I/O
— unit-testable with zero network) AND a `--deal-identity-evidence
<uuid>=<path>` JSON file per deal that must validate as a closed,
issued V2 identity-evidence record (`validateV2DealIdentityAuthorityEvidence`
+ `requireIssuedIdentityConsumerEvidence`, both confirmed to exist and
export correctly in `lib/canonical-v2/governed-identity-proposal-packet.js`
/ `deal-identity-allocation-readiness.js`) bound to that exact production
deal id before a snapshot will be built for it.

**Same SQL-builder-vs-real-fetch pattern as module 14, explained well
here.** This is the module that documents the convention module 14 was
missing: `buildSnapshotSql` is explicitly "kept as a documented, testable
artifact even though the actual fetch below goes through the supabase-js
query builder... see the 'SQL builder' section for why both exist." Good
model for the rest of the repo's exporters.

**Header accuracy.** Accurate; no change made.

---

## 16. `scripts/extract-local.js`

**What it does.** Thin CLI wrapper over the shared `lib/parser-v2/run-
extract.js`'s `runExtractTypePhase` (dry-run or live, per `--dry-run`),
letting extraction run through subscription CLI backends
(`createClaudeCliClient`/`createCodexCliClient` from `lib/llm-cli-client.js`)
instead of the metered API. On a dry run, auto-diffs the would-be result
against what's currently stored so a dry-run doubles as a change preview.

**Header corrected — the API-route parity claim is currently suspended,
not permanent.** The header said this "runs the identical extraction phase
as POST /api/ingest/extract-type." That was true by design at introduction
(commit `b41d3281`, "P0.1" — the phase was deliberately factored into
`lib/parser-v2/run-extract.js` so route and script share one orchestration).
It is no longer operationally true: `pages/api/ingest/extract-type.js` was
later replaced (commit `bc3b6267`) with
`lib/broad-corpus-containment.js`'s generic handler, which now returns
HTTP 503 (`ROUTE_CONTAINED`) unconditionally — confirmed by reading both
the current file and its git history. This is a deliberate, documented,
tracked security posture (`docs/API-ROUTE-CLASSIFICATION.md`,
`ROADMAP.md` P7/P8 — essentially every unauthenticated write/destructive
route in the app is 503'd pending a session/auth gate), not a bug I'm
raising fresh. Unlike `from-url.js`/`reprocess-cond.js`/`users.js`, no
`lib/broad-corpus/contained-routes/extract-type.js` sibling preserves the
route's original logic for restoration — it was deleted outright, though
the shared `run-extract.js` module it called still exists and is what this
script itself still runs. Rewrote the header paragraph to state this
precisely: today, this script is not merely the cheaper way to run this
extraction phase, it is the ONLY live way, since the API path is fully
dead. Worth reading together with module 10's finding — production
extraction and production card-materialization are both currently
script-only, not API-reachable.

---

## 17. `scripts/generate-codebase-inventory.js`

**What it does.** Regenerates `docs/codex-program/generated/system-
inventory.json`, a fully code-derived structural map of the canonical-v2/M3
pipeline (registered section families + producer prompts, product
projections, resolver exports, review table configs, dark bridges, serving
sources, live-run scripts) — nothing hand-counted, every number recomputed
from the current working tree on each run. Explicitly exists because
`docs/codex-program/notes/doc-reality-audit.md` found 28 cases of stale
hand-written documentation; this is the "derive, don't assert" fix for the
"what exists and where" question specifically. Wired into CI:
`npm run generate:codebase-inventory` (package.json) and, more importantly,
`tests/codex-program-generated-docs.test.js` runs the generator in
`--check` mode on every `npm test` and fails the suite if the committed
JSON doesn't match a fresh derivation. **Not executed by this review** (did
not run `node scripts/generate-codebase-inventory.js` even in `--check`
mode, and did not need to) — its own file lives under `scripts/`, in
scope, but its write target is under `docs/`, out of scope for this task,
so I read it statically only. `npm test` (required at the end of this
task) will exercise it in `--check` mode, which is read-only.

**Worth flagging, not mine to verify.** This script's own embedded
`LAYER_LOCATIONS` documentation string (informational, not derived) says of
`canonical_writer`: "lib/canonical-v2/canonical-writer.js... (see
GRAVEYARD.md: unexecuted against a real database as of this writing)." If
still true, that is a significant fact about the canonical-v2 write path's
production-readiness — but `canonical-writer.js` is not one of my 39
modules (other agents are working `lib/canonical-v2/*` in parallel per
today's git status), so I have not verified it myself. Flagging so whoever
owns that file/GRAVEYARD.md checks whether it's still accurate rather than
letting it sit unexamined.

**Header accuracy.** Accurate; no change made.

---

## 18. `scripts/generate-registry.js`

**What it does.** WP-SCHEMA P3 registry generator: reads
`docs/schema-migration/inventory.jsonl` + `source-inventory.json`, derives
`lib/schema/features.generated.js` / `tags.generated.js` (the audit-start
baseline hand-copied into the real `lib/schema/features.js`/`tags.js`),
plus two supplemental hand-authored feature blocks
(`supplementalLiveFeatures` — 17 internal/live-only keys the Supabase
coverage test found with no rubric source; `supplementalReconciliationFeatures`
— reviewer-added signals layered on extracted values) merged in on top of
the inventory-derived ones. Also (re)writes `docs/schema-migration/
phase-3-notes.md` unconditionally every run and `deletions.md` if absent.

**Trap: no `require.main === module` guard — `main()` runs on load, not
just on invocation.** This file calls `main()` unconditionally at module
scope; there is no CLI-entry guard anywhere in the file, and it has no
`module.exports` at all. Today this is safe in practice: grepped every
reference to `generate-registry` in the repo, and the only thing that
actually executes it is `tests/registry-generated-drift.test.js`, correctly
via `execFileSync(process.execPath, ['scripts/generate-registry.js'], {
env: { SCHEMA_REGISTRY_IN, SCHEMA_REGISTRY_OUT } })` — a genuine subprocess
with temp-dir env overrides, exactly matching the header's stated intent
("overridable so the registry drift-guard test can run... without
clobbering anything on disk"). But that safety is convention, not
enforcement: a future `require('../scripts/generate-registry.js')` from
anywhere in-process — for instance to reuse `camelToLabel`/`buildFeature`
as a pure helper, since nothing signals they aren't meant to be reused —
would immediately regenerate and overwrite `lib/schema/features.generated
.js`, `tags.generated.js`, and `docs/schema-migration/phase-3-notes.md`
against the REAL repo paths (the env-var overrides default to the real
`docs/schema-migration` / `lib/schema` dirs when unset) as a side effect of
being imported, not run. I did not add a guard myself — that would be a
behavioural change, not a header fix, and outside this task's remit — but
flagging clearly since this is exactly the kind of undocumented, load-
bearing convention the task asked me to surface. I did NOT execute or
`require()` this file at any point during this review, for the same
reason.

**Small defect: a hardcoded count next to its own source of truth.**
`writeAuditFiles()` writes a literal, hand-typed sentence into
`phase-3-notes.md`: "The generator adds 17 supplemental live-only keys
found by the Supabase coverage test..." — "17" is a bare numeral in a
template string, not derived from `Object.keys(supplementalLiveFeatures(
validTypes)).length`, which sits a few hundred lines above it in the same
file and is the obvious source of truth. I counted `supplementalLiveFeatures`'s
returned keys by hand (flags, parentProvisionType, erisaCompliance,
erisaParachutePayments, erisaPlansListed, erisaTitleIVPlans,
erisaMultiemployer, lookbackAnchor, lookbackDateISO,
lookbackTiedToIncorporation, materialContractsBucketsSource,
maeQualifiedRepsEvidence, counterparts, severability,
carveouts_disproportionateImpactCarveouts_note, cvrMilestonePayments,
standstillWaiverPermitted_flagRef) — it is exactly 17 today, so this has
not yet drifted, but nothing would catch it silently going stale the next
time someone adds or removes a supplemental key and forgets to update the
sentence by hand. Not a header-comment issue (it's in a function body, a
generated-doc template string), so I did not change it — flagging as a
one-line fix for whoever next touches this function:
`` `- The generator adds ${Object.keys(supplementalLiveFeatures(validTypes)).length} supplemental live-only keys...` ``.

**Header accuracy.** Accurate as far as it goes; not expanded (the two
findings above are body-logic observations, not header inaccuracies, so I
left the header text itself untouched per the header-comments-only edit
scope).

---

## 19. `scripts/ingest-agreements.js`

**What it does.** Fetches a merger agreement from a hardcoded SEC EDGAR
URL for one of four named deals (`d1`-`d4`: Broadcom/VMware, Microsoft/
Activision Blizzard, Pfizer/Seagen, Amgen/Horizon Therapeutics — real deal
names, but `deal_id: 'd1'` etc. are not real UUIDs), strips HTML, and POSTs
the result to `/api/ingest/agreement`.

**Header fixed — currently non-functional end-to-end, not just old.**
This is one of the repo's earliest files (first committed Feb 27 2026,
"Major update... full agreement ingest"). Its target route,
`POST /api/ingest/agreement`, is now unconditionally hard-503'd by
`lib/broad-corpus-containment.js` — confirmed directly in
`lib/broad-corpus-containment.js`'s `BROAD_CORPUS_CONTAINED_ROUTES` map.
Every invocation of this script today will fail with a contained-route
error; it cannot silently succeed or partially succeed. Added a header
note stating this plainly, naming the current supported path instead
(`scripts/ingest-local.js` / `pages/api/ingest/from-url.js`).

**Worth flagging outside my edit scope.** `lib/admin/processing-flow-
stages.js` (a live `lib/` file, not docs/archive — presumably powers an
admin "how the pipeline works" view) still lists `scripts/ingest-
agreements.js` as one of the files implementing the "Ingest" stage,
alongside the real current path `pages/api/ingest/from-url.js`. That file
is not one of my 39 modules, so I did not edit it, but it is presenting a
dead script as a live pipeline component to whoever reads that admin view.

---

## 20. `scripts/ingest-local.js`

**What it does.** The real, current, full new-deal ingestion pipeline,
run locally against subscription CLI backends instead of the metered API:
fetch EDGAR EX-2.1 (or a local `--file` fixture) → strip HTML → derive deal
metadata (acquirer/target/value/sector, with a press-release fallback for
stated deal value) → create or update the `deals` row → parse structure →
classify sections → extract provisions → validate → store. Two entry
points live in this one file: `ingestOne()` (the simple, direct `--url`/
`--manifest`/`--file` CLI flow `main()` actually calls) and
`prepareDealForIngest()` (classify-and-stage only, deliberately stops
before extraction — exported but NOT called anywhere in this file).
Confirmed `prepareDealForIngest` is not dead: it's the entry point
`scripts/ingest-worker.js` (a separate queue/job-claiming worker, kinds
`deal-prepare`/`family-extract`/`deal-qa`/`finalize-candidate`) calls for
its own candidate-ingestion pipeline — a second, broader ingestion system
outside this file, worth knowing about even though `ingest-worker.js`
itself is not one of my 39 modules.

**Header strengthened — confirms and sharpens the module 10/16 finding,
with the project's own words.** Checked `pages/api/ingest/from-url.js`
directly, since this script's header claims to mirror it: as of today that
route is ALSO fully contained (503), and its own one-line comment is
unambiguous: *"Un-containing this route is separate work (ingestion stays
off); this task's job was to make it safe to turn on, not to turn it on."*
So there are now two independent, confirmed facts about the live ingestion
surface, and they compound: (1) the API route is deliberately, trackedly
turned off — "ingestion stays off" in the codebase's own words — and (2)
even the one remaining live path, this script, never mints
`provision_cards` (module 10's finding; re-confirmed here independently —
neither `ingestOne` nor `prepareDealForIngest` calls
`mint-cards`/`extract-to-cards`/`rematerialize-claims`, and grepping
`storeProvisions`/`runParserPipeline` in this file shows no such call).
**Put together: today, getting one new deal from "found the SEC filing" to
"visible and reviewable on /review" requires running this script by hand,
then separately running `mint-cards.js --apply` by hand, with no API path
at all.** Added a header note capturing both facts together, since reading
either script's header alone only shows half the picture.

---

## 21. `scripts/ingest-qa.js`

**What it does.** The post-ingest QA gate CLAUDE.md itself names as a
required mechanical check ("scripts/ingest-qa.js gates for anything
touching ingestion"). Three independent, ALL-must-pass gate groups per
deal: (1) counts/coverage/trust — REP-T/REP-B/DEF/COND minimums, coverage
%, zero unverified quotes, zero duplicate clauses, canonical-code hit rate;
(2) deal-metadata completeness — buyer_display, value, consideration_type,
buyer_profile, signing_date all populated (staging deals exempt); (3) an
additive claims gate — a deal with any coded-taxonomy feature must have
`claims` rows, and coded cards that matched a provision must mostly carry
a claim. Read-only; degrades to "skip" (never fails) if `claims`/
`provision_cards` are unreachable (pre-schema database).

**Header fixed — a real numeric mismatch, not just staleness.** The
header's own printed gate table said `coverage % >= 85`. The actual
`DEFAULT_GATES` constant in the same file says `coverage: 95`. A reader
relying on the header would believe a materially weaker bar than what is
enforced. Fixed the number in place. While in there, also added the two
entire gate GROUPS ((2) and (3) above) that the header's "Gates" list
omitted completely — someone reading only the header would not know a deal
can fail ingest-qa purely on missing `buyer_profile` or
`consideration_type`, or on a claims/coded-card-coverage shortfall.

**Cross-check that meaningfully qualifies modules 10/16/20's finding.**
Traced what happens if `ingest-qa.js` is run against a deal that
`ingest-local.js` just created but `mint-cards.js` has not yet touched
(module 10/20's "production ingest never mints cards" gap): `provisions`
exist and are coded, but `provision_cards`/`claims` are both empty for
that deal. `evaluateClaimsGates`'s first check — "claims present (coded
features exist)" — is grounded in `provisions` vs. real `claims` rows
(not cards vs. cards), so it correctly reports `0 < 1 FAIL` in exactly
this scenario; the second check ("coded card coverage") is vacuously 1
here (nothing to grade) but the first check alone is enough to fail the
gate. So the missing-materialization gap IS caught -- but only if a human
(or agent) actually runs `ingest-qa.js` after ingest, which is a manual
step with the same "nobody is forced to run it" caveat as `eval.js`
(module 13) and `coverage-audit.js` (module 5). Worth knowing this safety
net exists, and worth knowing it depends on the same discipline the other
manual gates do.

---

## 22. `scripts/integrity-orphan-check.mjs`

**What it does.** Read-only release-gate: checks orphan rates across four
canonical-corpus relationships not (fully) enforced by a real DB foreign
key — `claims.source_provision_id -> provisions.id` (explicitly
non-stable across re-ingests, per schema comment quoted in the header),
`claims.excerpt_id -> provision_cards.excerpt_id` (real FK, checked as a
regression guard), and both `*.deal_id -> deals.id` relationships (also
real FKs, same regression-guard rationale). Exits 1 if any check's orphan
% exceeds `--max-orphan-pct` (default 2.0). Not wired into CI or
package.json — confirmed manual-only, consistent with its own "meant to
run as a release gate" framing.

**Open question, not a confirmed defect.** One global 2.0% ceiling applies
to all four checks via `decideGate`, including
`claims.source_provision_id -> provisions.id`, which the header itself
says is lineage-only and NOT expected to stay stable across re-ingests —
every re-ingest of an existing deal orphans that deal's old claims'
`source_provision_id` pointers by construction, since re-ingest replaces
`provisions` rows wholesale. Whether this check's orphan rate is expected
to drift upward over time (if nothing re-materializes claims after a
re-ingest) or stays low (if `rematerialize-claims.js`, module 29, always
runs after a re-ingest) determines whether a future gate failure here
means "real corpus damage" or "expected drift nobody rebaselined the
threshold for." Deferred to module 29's own writeup rather than guessing
here.

**Header accuracy.** Accurate; no change made.

---

## 23. `scripts/nets-eligibility-report.mjs`

**What it does.** Read-only, offline report over three COMMITTED fixture
runs (TopBuild, Skechers, Modiv) that replays the comparator-wiring
two-pass flow (`resolveCandidates` plain, then with V1/V2 comparison +
lexical-disagreement wired in) and prints, per deal, claims
resolved/review-queue/open-world/`both_nets_clean`/blocked-by/v1-recall
counts. Explicitly never touches the network or a database — no `--deal`
argument exists at all, everything is a fixture.

**Major finding: the script is currently completely broken, not merely
degraded — confirmed from four independent sources.** Reading `main()`'s
`deals` loop (TopBuild, Skechers, Modiv, no try/catch around
`await deal.load()`) against `loadSkechersReplayRun()` shows the function's
literal FIRST statement is an unconditional `throw new Error('NETS
eligibility report is blocked: no verified snapshot identity binding
exists for Skechers...')`, ahead of ~38 lines of now-dead replay logic
(EDGAR capture, HTML conversion/verification, admission bundle, native
extraction run) that can never execute. Since Skechers is second in the
`deals` array and nothing catches the throw, **running this script
today produces NO output at all for ANY deal** — not just Skechers, but
also TopBuild and Modiv, which have complete, real data and nothing to do
with Skechers' identity gap.

Confirmed this is a real, current regression (not a misreading) via: (1)
`git log` — the throw was added in `0d17ad00`, "feat(canonical-v2): add
Phase 1 production-readiness controls", the MOST RECENT commit on this
branch (2026-08-04); (2) the same commit's diff also REMOVED a hardcoded
`governed_deal_key: 'deal:skechers-first-live-run:...'` literal from the
same function and ADDED a matching guard in `runTwoPassFlow` (`if
(!snapshot?.snapshot_identity_evidence) throw ...`) — a deliberate,
principled hardening: stop trusting a raw derived deal key as a substitute
for issued/verified identity evidence, consistent with the governed-
identity discipline seen in modules 4 and 15; (3)
`tests/nets-eligibility-report-identity-fence.test.js` tests exactly that
`runTwoPassFlow` guard directly, confirming the FENCE is intentional and
correctly scoped to Skechers in principle; but (4) no test anywhere calls
`main()` or asserts on the full-script behavior, so the actual, larger
consequence — the whole report going to zero output, including for the two
unaffected deals — was never caught. `docs/archive/handoffs/
NETS-ELIGIBILITY-2026-08-02.md`, dated two days before the breaking
commit, has the actual last-successful-run table (all three deals, real
counts), proving this script did work end-to-end before 0d17ad00 and
confirming what "working" output looks like.

**Header fixed.** Added a paragraph stating this plainly: the fence's
principle is right, its blast radius is wrong (it takes three deals down
to correctly block one), and the script cannot produce its stated report
until either Skechers gets real issued identity evidence or `main()` is
changed to isolate a per-deal failure instead of aborting the whole run.
I did not change `main()`'s control flow myself — that is a body-logic /
behavioural fix, not a header comment, and outside this pass's edit scope
— but the fix is narrow and obvious for whoever picks this up: wrap each
`await deal.load()` / `runTwoPassFlow` pair in its own try/catch, same
pattern `scripts/ingest-qa.js`'s per-deal loop already uses.

**Belongs in the plan.** If `docs/core/PLAN.md` tracks the comparator-
wiring/NETS eligibility work as "done" or "reporting available" based on
the 2026-08-02 handoff doc, that status is now stale as of the very next
commit after it — flagging so whoever owns that plan section knows the
report is currently non-functional, not just pending more fixture
coverage.

---

## 24. `scripts/query-demo-check.js`

**What it does.** WP-1 (M4-03) live demo-set gate: loads the full live
corpus exactly as `pages/api/query/run.js` does, runs every
`lib/query/fixtures/demo-set.json` entry through the real query engine
(`lib/query/engine.js`), diffs against each entry's pinned `expected`, and
prints a PASS/FAIL table (exit 1 on any failure). `--update` rewrites
`expected` from the live answer — explicitly marked "NEVER run this in CI
— it launders a wrong answer into 'passing.'" Staging deals are excluded
from context the same way `pages/api/home.js`/`query/run.js` exclude them.
Called by `scripts/demo-dryrun.js` (module 10) with no `--update`.

**Header fixed — the "20" was a stale count, found via a two-file cross-
check.** The header said "run and grade all 20." `lib/query/fixtures/
demo-set.json` has 18 entries today. `git log` on that file shows why:
commit `61d7280c` ("retire duplicate compare surfaces...") deleted the
`DEAL_COMPARE`/`DEAL_TO_MARKET` query kinds and, correctly, their two
demo-set entries with them (48 lines removed) — a deliberate, correct
change that simply never touched this script's or `demo-dryrun.js`'s
header. Fixed both (see module 10, revisited) to describe the shape
("every entry in demo-set.json") with the count as a dated observation,
not a pinned fact, so the next legitimate demo-set change doesn't
reintroduce the same drift.

**Header accuracy.** Fixed as above; otherwise accurate.

---

## 25. `scripts/queue-volume-dry-run.mjs`

**What it does.** Pre-flight instrumentation for the ruling-corpus /
review-queue subsystem (design spec "Recall and volume instrumentation,"
audit finding B6: "one human verifier; the number has never been
computed"), meant to run "BEFORE the 50-deal corpus is attempted." Reads N
committed `RESOLUTION_REVIEW_QUEUE/V1` artifacts and reports projected
review-queue volume per deal plus a leave-one-out exact-key hit-rate
estimate (what fraction of items share an exact ruling-corpus key with an
earlier-processed deal). Explicitly self-honest about precision: an item
carrying the real Task-4 key triple (`attachment_position`/
`concept_family`/quote) gets `TASK4_ALIGNED_KEY`; everything else falls
back to a documented, coarser `PROXY_KEY` so the script still produces a
number today, and every aggregate is broken out by `key_strategy` so a
reader can see how much of the reported rate rests on the weaker proxy —
"never a silently blended number," per its own header, and the code
matches that claim.

**Confirmed runnable today, not just theoretical.** Real
`RESOLUTION_REVIEW_QUEUE/V1` artifacts already exist in the repo (10+
found under `evidence/canonical-v2/*/review-queue.json`, several dated
2026-08-06 — today). I did not execute this script (no need to, and it
would only print a report, not change anything, but running tools wasn't
this task's job) — flagging only that this is a ready, low-risk,
already-testable capability (pure JSON analysis, no DB, no model call)
that someone could point at the real evidence directory right now to get
an actual answer to the B6 audit question, rather than the estimate
remaining hypothetical.

**Header accuracy.** Accurate; no change made.

---
