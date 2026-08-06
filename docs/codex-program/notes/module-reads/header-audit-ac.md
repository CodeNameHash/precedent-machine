# Header audit — batch AC (39 modules)

Status: IN PROGRESS — written incrementally, entries appended as each module is
finished. Per-module verdict + "what it actually does" + capability/defect
findings, per the coordinator's 2026-08-06 scope note. Ranked summary goes at
the top once all 39 are done; until then, read module sections in list order.

Scope reminder: comment-only edits, source files on this list only, nothing
under docs/ or archive/, no em-dashes, British spelling, suite must stay green.

---

## RANKED FINDINGS (placeholder — filled in once all 39 modules are read)

---

## Module-by-module

### 1. lib/review-parity/case-file.js
**Header:** accurate. Loads/validates "case file" JSON (one deal's legacy +
Canonical V2 input for one family), enforces `.case.json` suffix in directory
mode, sorts by deal_id, treats an `unavailable` side as UNCOMPARABLE rather
than silently skipped. All of this matches the code exactly.

**What it does:** Reads and strictly validates REVIEW_PARITY_CASE/V1 JSON
files (single file or a directory of them), resolving `*_file` pointers
relative to the repo root so a case file can't escape the repo, and returns a
normalised `{legacy, v2}` pair per deal, sorted deterministically by deal_id.

**Findings:** none. No unused exports (`resolveSide` used internally and by
`loadCaseFile`; all five exports consumed by `run.js`/`views.js`/tests).

### 2. lib/review-parity/compare.js
**Header:** accurate. Five outcomes (IDENTICAL/COSMETIC/V2_LOSS/V2_ADDITION/
DISAGREEMENT), three of them substantive and each counted separately — matches
`OUTCOMES`, `SUBSTANTIVE_OUTCOMES`. Severity ordering (V2_LOSS ranks above
DISAGREEMENT) matches `OUTCOME_ORDER`.

**What it does:** Pure comparison engine for the legacy-vs-Canonical-V2
review-parity harness: buckets rows by a declared row key, pairs same-key
rows by ordinal (so duplicate-key rows don't silently collapse), classifies
each field per its declared `kind` (text/quote/citation/number/set/sequence/
flag), and rolls the result into a deterministic, sorted findings list plus
outcome counts.

**Findings:** none functionally wrong. Checked the `sequence` classification
carefully (subsequence-based LOSS/ADDITION detection) — logic holds given the
prior identical-after-normalisation check already excludes the equal case.
All exports are consumed by `report.js`/`run.js`/`views.js` or tests.

### 3. lib/review-parity/mapping.js
**Header:** accurate. Seven field kinds documented (text, quote, citation,
number, set, sequence, flag) — code declares exactly seven (`FIELD_KINDS`),
and each kind's documented comparison rule matches its handling in
`compare.js` exactly (checked cross-file). `ALLOWED_MODULE_PREFIXES`
(`components/review/table-configs/`, `lib/canonical-v2/`) matches where table
configs and projections actually live.

**What it does:** Validates and content-addresses a declarative field-mapping
table (which legacy row path corresponds to which Canonical V2 row path, and
under what comparison semantics) so a review-parity report can be traced back
to the exact mapping that produced it. Fails closed on unknown keys/paths to
stop a typo silently excluding a field from comparison.

**Findings:** none. Not dead code — two real mappings exist on disk
(`lib/review-parity/mappings/material-contracts.example.json`,
`termination-fees.json`) with matching fixture case files, and the harness is
referenced throughout `docs/codex-program/{P1-PLAN,ROADMAP,DECISIONS,
MERGE-PLAN}.md` (read-only check, per constraint) — this is a live,
plan-tracked gate, not an experiment nobody runs.

### 4. lib/review-parity/normalise.js
**Header:** accurate in detail — checked all eight "folded away" rules and
both "never folded" bullets against `foldText`/`normaliseValue` line by line;
every one matches (whitespace-run regex includes NBSP per the ECMAScript
`\s` class, invisibles regex covers ZWSP/ZWNJ/ZWJ/word-joiner/BOM/soft-hyphen
exactly as claimed, `-0`/`0` collapse, empty-container-recursion to ABSENT,
etc). "No Date, no locale" reads as "this module doesn't consult the wall
clock / ICU", not "Date values never appear" — the module does handle
`instanceof Date` inputs deterministically, which doesn't contradict the
claim.

**What it does:** The single place that decides cosmetic vs substantive for
the review-parity harness: folds whitespace/Unicode-punctuation/invisibles,
collapses empty-ish values to a shared ABSENT sentinel (recursively), and
provides the injective `normKey` encoding used both for equality and for
row-pairing keys, plus a raw-bytes `stableStringify` used only to distinguish
IDENTICAL from COSMETIC.

**Findings:** none.

### 5. lib/review-parity/report.js
**Header:** accurate. "Documented here because the CLI is the contract" for
the EXIT codes checks out — `scripts/review-parity-check.js` imports `EXIT`
and `exitCodeFor` from this file directly and its own `--help` text embeds
the same exit-code table. Row-level V2_LOSS genuinely gets its own headline
field, its own report section (`row_level_losses`), and its own summary line,
never folded into a total.

**What it does:** Aggregates per-deal comparison results into one frozen,
content-addressed report object (byte-deterministic — no clock, no locale, no
unordered iteration) and renders it as plain text, with row-level loss always
surfaced first and a coverage section that shouts if a declared deal was
never reached.

**Findings:** none.

### 6. lib/review-parity/run.js
**Header:** accurate — a thin, side-effect-free pipeline wiring case files to
views to comparison to report, deliberately kept out of the CLI so it stays
callable/testable without a process. Matches: no `process`, no `console`,
just function composition.

**What it does:** For one family's mapping and a set of loaded cases, builds
both sides' rows via `views.js` and classifies each deal via `compare.js`,
downgrading a deal to UNCOMPARABLE (rather than throwing) when its family
doesn't match, a side is marked unavailable, or view-building itself throws.

**Findings:** none.

### 7. lib/review-parity/views.js
**Header:** accurate on every checkable claim. Confirmed by cross-file grep:
the swc+jiti ESM/JSX bridge really is the same one used by the "dark-bridge"
test suites in `tests/` (7 files: `canonical-v2-*-dark-bridge*.test.js` etc.,
all requiring `jiti`). `v2.view = 'projection_cards'` really does skip
`loadTableConfig`/`selectRows` and return the projection's cards directly.
`renderCell`/`renderFooter` are genuinely never referenced anywhere in the
file — only `config.selectRows(...)` is called.

**What it does:** Builds the two row arrays the comparison engine diffs, by
running both the legacy cards and the Canonical-V2-projection-shaped cards
through the *same* table config's `selectRows()`, so any difference found is
attributable to the data, not the renderer.

**Findings:** none.

### 8. lib/run-history.js
**Header:** accurate. `MAX_RUNS_PER_DEAL = 40`, capped via `.slice(-40)` after
append (keeps newest 40, matches "capped, newest kept"). The motivating
anecdote ("Tonight's... a June TERMF extraction stored a misclassified
'Acquirer Expense Reimbursement'...") is history correctly marked as history
— left alone.

**What it does:** Builds and appends a lightweight per-run snapshot (type,
category, code, text hash/length, feature-key set) of what an extraction
phase stored, capped at 40 records per deal, and diffs two snapshots into
added/removed/changed/unchanged buckets keyed on (type, category) with
ordinal pairing for duplicate categories.

**Findings:** none — genuinely live, not a "built and bypassed" case. All
four non-trivial exports (`diffSnapshots`, `formatDiff`, `snapshotStoredProvision`,
`buildRunRecord`/`appendRunRecord`) are wired into `scripts/extract-local.js`,
`scripts/reprocess.js`, `scripts/diff-runs.js`, and `lib/parser-v2/run-extract.js`,
confirmed by grep, not just imported-and-ignored.

### 9. lib/search.js — HEADER FIXED, HIGH-CONSEQUENCE FINDING
**Header claimed:** "The search endpoints (pages/api/search/*) let a user
query the WHOLE corpus — every provision across every deal — by free text,
provision type/family, canonical code, category, favorability, and
feature-key presence." Present tense, stated as current fact.

**What is actually true:** `pages/api/search/facets.js` and
`pages/api/search/provisions.js` — the two API routes this module was built
to serve — were deleted on 2026-07-07 in commit `0811c979` ("feat(wp):
promote newhome routes to root (#163)"), along with the entire search UI
page (`pages/search.js`, 375 lines) and the provisions-list page
(`pages/provisions/index.js`). `pages/api/search.js` (singular file) does
exist today, but it's a *different*, older (2026-02-27) Claude-backed
freeform query-intent endpoint that never imported this module and doesn't
use PostgREST filters at all. No page or component anywhere links to
`/search` any more (grep for the route string returns nothing) — the removal
was clean, not a dangling link.

Net effect: `parseSearchParams`, `typeFamilyOrConditions`, `buildSnippet` and
`expandFavorability` have **zero callers outside this module's own test**
(`tests/search.test.js`). The only export still used in production is
`canonicalFavorability`, pulled in by three unrelated files
(`lib/feature-validation.js`, `lib/parser-v2/store.js`,
`scripts/deal-context.js`) purely to normalise a favorability label — none of
them do cross-deal search.

**What I changed the header to:** rewrote it to state, in present tense, that
the two API routes were removed in #163 and no longer exist; that the module
is still correct and still tested but has no live caller for its
search-request-building exports; and that `canonicalFavorability` alone
survives via reuse elsewhere. Kept the original explanation of *why* the
helpers are shaped the way they are (family-vs-variant type expansion,
favorability synonym collapsing) — that reasoning is still true and still
useful to whoever reconnects this.

**Why this is the most valuable finding so far:** this is a complete,
unit-tested, correct backend for corpus-wide provision search — free text,
type/family (with the REP-T/REP-B, TERMR-M/B/T, COND-M/B/S, IOC-T/B party-
variant expansion), canonical code, category, favorability bucket, and
feature-key presence — sitting fully built with no wiring to anything a user
can reach. Recreating this from scratch would be redundant; the missing piece
is two thin API routes (`facets`, `provisions`) and a page, all of which have
a working prior implementation in git history (commit `35e74353`) that could
be resurrected and adapted rather than re-designed. If corpus-wide search is
wanted for the V2 product, this belongs in the plan as "reconnect, don't
rebuild."

### 10. lib/section-ref.js
**Header:** accurate on scope ("Section 8.01(b)(i)" / "§8.01(c)" / "Article
VIII" parsing; pure JS, no React; consumed by rubric/render layer and
tests"). Confirmed 12 real consumers beyond tests (ClauseSidebar.jsx,
compareRowUnion.js, ioc-exceptions.config.js, lib/parser-v2/structural.js,
three canonical-v2/native-producer files, lib/query/types.js) — actively used,
not orphaned. The inline truncation-sweep comment ("E (truncation sweep):
drop the literal '…'") is correctly marked as a past change and still matches
current behaviour (no ellipsis appended, clean 57-char cut).

**What it does:** Parses a section/article citation string into
`{kind, sectionNumber, subclauses[]}`, then resolves it against a provisions
array to find the matching provision and build a display label
(`§8.01(b)(i) [category]`), trying an exact section-number match first and
falling back to stripping one trailing subclause group so a bare-tier
reference can still hit a provision stored under a single subclause.

**Defect (moderate, worth checking against real data):** the "bare-number
variant" fallback strips only the *last* trailing `(x)` group:
`s.replace(/\([A-Za-z0-9]+\)$/i, '')` has no `/g` flag and is anchored at the
end, so it removes exactly one parenthetical. For a provision whose own
stored section number carries **two or more** subclause levels (e.g. an
extracted `section_number` of `"8.01(b)(i)"` — the exact shape the module's
own header uses as its flagship example), one pass reduces it only to
`"8.01(b)"`, not the bare tier `"8.01"`. A search for the bare tier would
then fail to match that provision even though it conceptually belongs to it.
Single-level suffixes (`"3.05(a)"` → `"3.05"`, the case the inline comment
actually gives as its example) work correctly. I did not change behaviour
(out of scope for a comment-only pass) — flagging because whether this bites
depends on how often stored `section_number` values carry 2+ levels, which I
did not check against live data. If it matters, the fix is trivial: anchor
with `+` (`/(\([A-Za-z0-9]+\))+$/`) to strip the whole trailing chain.

### 11. lib/sidebar-groups.js — HEADER FIXED, MEDIUM-CONSEQUENCE FINDING
**Header claimed:** this module "[m]irrors the constant historically embedded
in pages/review/[id].js so the comparison view (and any future surfaces) can
share the same grouping + type-color hex map without duplicating it" —
i.e., that something in the app imports and shares this table.

**What is actually true:** nothing in application code imports
`lib/sidebar-groups.js`. `components/review/shared.js` holds its own,
independently-maintained "richer copy" of `SIDEBAR_GROUPS`/`TYPE_HEX`, and
that is what `components/review/Sidebar.js`, `FullDocumentView.js`,
`BoundaryAuditPanel.js` and `pages/review-v1/[id].js` all actually import
(confirmed by grep — every real `typeHex`/`TYPE_HEX` call site resolves to
`./shared`, none to `lib/sidebar-groups`). The *only* consumer of this module
anywhere is `tests/review-layout.test.js`, which imports it specifically
because `shared.js` contains JSX and can't be loaded under plain
`node --test`; the test then separately re-reads `shared.js` as text and
diffs the label order against this module's `SIDEBAR_GROUPS`, i.e. this
module's real job today is "JSX-free stand-in so a test can catch drift in
the real copy." Two of its four helper exports — `sidebarTypeOrder()` and
`findGroupForType()` — have **no caller anywhere, including the test**; they
are fully implemented, exported, and inert.

I also found the array itself was fine (both `SEC Filing / Meeting
Requirements` and `Employee Benefits`, added 2026-07-04, are present and in
the right place) but the "Metsera fb2 block 4a" order comment above the array
had drifted: it walks Antitrust straight to Conditions, silently skipping the
SEC Filing/Meeting step added the same day. Fixed by inserting it.

**What I changed the header to:** states plainly that `shared.js` is the
real, actively-rendered source; that this file is a plain-JS mirror kept
only for the one JSX-avoidance test; that no application code imports it
today; and names the two dead exports. Also fixed the stale order comment
(inserted "SEC Filing / Meeting" between Antitrust and Conditions to match
the actual array and the actual commit history).

**Consequence:** medium, not high — there's no missing user capability here
(grouping/colour rendering works fine via `shared.js`), so this isn't a
"gold" find like `lib/search.js`. But the old header actively asserts a
sharing relationship that doesn't exist, which is exactly the shape of claim
that misleads a future change: someone told "the comparison view shares this"
would edit this file expecting it to affect rendering, and nothing would
happen.

### 12. lib/termf.js — HEADER FIXED, defect found
**Header claimed:** a stored-shape table listing five card subtypes
(TERMF-TARGET, TERMF-TAIL, TERMF-SOLE, TERMF-EFFECT, TERMF-EXPENSE), and that
"the review-page renderer (TermfHero / TermfTriggerMatrix / TermfTailMechanics)"
reads the flat keys this module derives.

**What is actually true:** the code has always handled a sixth card subtype,
TERMF-REVERSE / `reverseTerminationFee` (present since the very first commit
that built this bridge, `185a9de5`, 2026-06-29 — the header's shape table
never listed it) — `buildTerminationFees()` emits a full REVERSE_TERMINATION_FEE
row for it, `normalizeTermfFeatures()` derives `reverseFeeAmount`/
`reverseFeePercentage` from it, and `lib/schema/features.js` registers
TERMF-REVERSE as a real card code. Separately, `TermfHero` no longer exists:
`pages/review-v1/[id].js` line 5789 documents it was deleted "per user
feedback — the standalone amount/% card added little," folding the headline
into `TermfTriggerMatrix`'s own header; a fourth component the header never
mentioned, `TermfRemedyEffect` (line 5589), now renders willful-breach/
effect-of-termination. I also traced the renderer claim more precisely: the
current PRODUCTION route (`pages/review/[id].js`, promoted from review-v2)
never imports `lib/termf.js` directly — it reaches this module only through
`components/review/table-configs/termination-fees.config.js` and
`tail-fee.config.js` via the shared `ProvisionTable`. The bespoke
Termf* React components live only in `pages/review-v1/[id].js`, which its
own header calls "the old UI... kept, unchanged... as a fallback." Both
paths are live and both are correctly fed by this module — I checked because
the discrepancy raised the question of whether the rich TERMF presentation
had been silently left behind on the deprecated page during the /review-v2 →
/review promotion; it hasn't, the table-config path reimplements equivalent
rendering using the same `buildTerminationFees()`/`normalizeTermfFeatures()`
functions.

**What I changed the header to:** added the TERMF-REVERSE row to the shape
table; replaced the stale three-component list with an accurate account of
who reads the flat keys today (the shared table-configs, plus the fallback
page's own components), noted TermfHero's removal and why, and named
TermfRemedyEffect.

**Defect found (moderate-to-high, worth a real fix, not just a comment):**
`buildTerminationFees()` computes `sole = unwrapBoolish(features.soleAndExclusiveRemedy)`
once and threads `soleRemedy: sole.bool` (plus `exceptions`) onto the
COMPANY_TERMINATION_FEE row only (lib/termf.js, the `feeRow({...})` calls
building that row). The REVERSE_TERMINATION_FEE row — both branches, object
and flat-key — never receives `soleRemedy` or `exceptions` at all, so it is
hardcoded to `null` by `feeRow()`'s own default. `components/review/
table-configs/termination-fees.config.js:219` reads exactly this per-row
field (`if (feeRow.soleRemedy === true) parts.push('Sole and exclusive
remedy')`) to annotate each fee row's summary line, and
`lib/category-summary-features.js:185` has a dedicated "Antitrust RTF Sole
Remedy" line expecting it. Net effect: whenever a deal's termination article
has a sole-and-exclusive-remedy clause covering BOTH the company fee and the
reverse/antitrust fee (a common single-clause drafting pattern), the review
table's antitrust/reverse-fee row will never show that annotation, while the
company-fee row correctly does — a same-clause, different-answer
inconsistency inside one table. (The unrelated flat top-level `soleRemedy`
key that `normalizeTermfFeatures()` sets is fee-type-agnostic and correct;
only the per-row field inside the `terminationFees` array is affected.) I did
not fix this — it is a logic change, not a comment, and out of scope for this
pass — but it's a concrete, reproducible gap worth a follow-up ticket: thread
`soleRemedy`/`exceptions` onto the REVERSE_TERMINATION_FEE (and arguably
EXPENSE_REIMBURSEMENT) rows the same way the company fee row already gets
them.

### 13. lib/verification.js — HEADER FIXED, subtle but consequential
**Header claimed:** "verifyDealQuotes() walks every provision's feature bag,
extracts each quote, and fuzzy-matches it against the deal's source text
(and the provision's own full_text)" — read naturally, this says a match
against either text counts as verified.

**What is actually true:** `verifyDealQuotes()` only tests a quote against
the deal's SOURCE text (`quoteAppearsIn(nq, normSource)`); a match against
the provision's own `full_text` is computed only for entries that already
FAILED, and stored as `in_provision_text` — a triage annotation, never a
route to `verified`. The code's own inline comment explains why this is
deliberate: a quote that only appears in the provision's own captured text
usually means the reconstructed source text drifted, not that the quote is
trustworthy. This is a genuinely different, and stricter, function from its
mutating sibling `sanitizeFeatureQuotes()`, which DOES accept a match
against either the source text or the supplied provision text
(`normHaystacks = [normSource, normProvision]`, checked via
`quoteVerifiesAgainstAny`). The header's wording described
`sanitizeFeatureQuotes()`'s behaviour and attached it to `verifyDealQuotes()`.

**Why this matters more than it looks:** `verifyDealQuotes()` feeds
`scripts/ingest-qa.js` and `scripts/eval.js` — the two gates this repo's own
CLAUDE.md calls load-bearing ("quote verification stays at zero flags") —
plus `pages/api/trust/report.js` and `lib/deal-quality-metrics.js`. A reader
who trusted the old header's wording could reasonably "fix" a stubborn
unverified-quote count by making `verifyDealQuotes()` also accept a
provision-text-only match, since the header already claimed it did. That
would be a real weakening of the trust gate this file exists to enforce —
exactly the class of mistake the header should prevent, not invite. Not
flagging this as a "defect" (the code is right, deliberately, and explains
itself) but as a header/behaviour mismatch worth fixing precisely because
the gap points toward a dangerous "fix."

**What I changed the header to:** split the two functions' matching rules
apart explicitly — verifyDealQuotes against source text only, with
provision-text match kept as a named triage signal, not verification;
sanitizeFeatureQuotes against either, by design. Kept the surrounding
"hallucination surface" framing, which is still exactly right.

**Everything else in this file checked out.** This is the most heavily
battle-tested file I've read on this list — dozens of inline comments tied
to specific named deals (Metsera, Landos, Redfin, M.D.C., Kraft, Concho,
Cox, Forest City, CSRA, Noble Africa, Whole Foods, Summit Materials) that
explain a specific regex fix and stay coupled to the code they describe, not
a drifting summary. `normalizeForMatch`'s marker-stripping claims, the
CommonJS/"API routes and node --test" claim (confirmed:
`pages/api/trust/report.js` requires it directly), and the coverage-exclusion
design all check out against the code. `collectQuotes`, `detectAncillaryRegions`
and `detectHeadMatter` have no consumer outside this file and its test —
that's an intentional "export the sub-algorithm for direct unit testing"
pattern, not a dead capability; the module's three real entry points
(`verifyDealQuotes`, `sanitizeFeatureQuotes`, `computeCoverage`) are all
wired into multiple scripts and an API route.

### 14. lib/taxonomy.js (1767 lines) — HEADER FIXED (misplaced comment)
**Header (top-of-file):** accurate and generic — canonical codes for
exceptions/qualifiers, tagged-item shape, CommonJS "required from both the
parser (Node/API routes) and the Next.js client bundle." Confirmed: this
file's dictionaries are imported directly by `lib/parser-v2/extract.js`
(server, prompt-building) AND by `pages/review-v1/[id].js` (client-bundled
page component — e.g. `CLEAR_SKIES_FAMILY`), so "both" checks out.

**What it does:** A big, append-only registry of canonical code→label
dictionaries (materiality qualifiers, consent/efforts standards, MAE
carve-outs, IOC categories, termination-fee triggers, etc.), most paired with
a `_META` variant carrying regex synonyms so free-text extractor output can
be normalized to a stable code without re-ingesting. `taxonomyForFeatureKey()`
is the single dispatcher mapping a feature key to its dictionary; `extract.js`
uses `formatDict()` to embed the relevant codebook directly into extraction
prompts; the UI uses `labelForCode()`/`isValidTaxonomyCode()` to render pills.

**This is the most heavily corpus-tested file I've read on this list** — the
dictionaries are dense with dated, named-deal-anchored comments (Modiv,
Redfin, Kraft, Concho, Heinz/Kraft, ENDRA/Renergen, etc.) explaining exactly
why a given regex was widened and what it was hostile-tested against. I
scanned the whole file for count/scope claims that could have gone stale the
way the classifier's did (grepped for "only/exactly/single/never/always/these
N"); the one substantive numeric claim I found — "Five independent fields, not
a single grade" above the Information Sharing codebook (~line 1322) — checked
out exactly: five dictionaries (INFORMATION_SHARING_GRADE, COPIES_SCOPE,
BIDDER_IDENTITY_REQUIREMENT, ONGOING_UPDATES_STANDARD, ENGAGEMENT_NOTICE_TIMING)
for five described fields, nothing added since.

**What I fixed:** a misplaced section comment, not a stale one. The block
"Absence-of-Changes rep type — how the rep is structured. Three canonical
shapes; HYBRID gets a verbose label..." sat immediately above
`IOC_AFFIRMATIVE_STANDARD_META` (a 7-key efforts/qualifier dictionary that
has nothing to do with Absence-of-Changes rep structure, and already had its
OWN correct header comment right below the orphaned one). The dictionary the
orphaned comment actually describes — `ABSENCE_OF_CHANGES_TYPE_META`, which
genuinely has exactly three keys (GENERAL_ORDINARY_COURSE, SPECIFIED_IOCS,
HYBRID) — sits about 75 lines further down with no header comment of its
own. This is a same-file cousin of the classifier bug: not a count that
drifted, but a comment separated from its subject (almost certainly by a
later insertion between them) that now reads as an authoritative description
of the wrong code. Moved the comment block to sit directly above
`ABSENCE_OF_CHANGES_TYPE_META`, where its "three canonical shapes" claim is
true; `IOC_AFFIRMATIVE_STANDARD_META` keeps its own already-correct header.
No dictionary contents changed.

**Also checked and cleared a false lead:** `TERMF_TRIGGER_CODES`/
`TERMF_TRIGGER_META` and `CLEAR_SKIES_FAMILY` looked, on a first pass,
like they might be unused (no case for either in `taxonomyForFeatureKey`'s
switch, and I initially misread `CLEAR_SKIES_FAMILY` as missing from
`module.exports`). Grepping before reporting it (per the coordinator's
warning that "nothing calls this" has already been wrongly claimed on this
programme before) showed both are very much live: `CLEAR_SKIES_FAMILY` is
exported and imported directly by `extract.js` and `pages/review-v1/[id].js`;
`TERMF_TRIGGER_CODES` is imported directly by `extract.js` and asserted
against in `tests/metsfb2-extraction-batch2.test.js`. Both are simply
consumed by direct import rather than through the generic dispatcher — a
legitimate second access pattern this file supports, not dead code. No
finding here; noting it so the "unused" question isn't reopened by the next
reader for the same reason I nearly did.

### 15. lib/rubric.js (5386 lines) — HEADER FIXED, 3 findings, highest-consequence of the lib/ batch
This is the file CLAUDE.md itself flags as Fable/Opus-only ("a wrong call
corrupts the product"), and it earned that. It is the single source of truth
for provision types (22 of them), canonical codes (~2500 lines), and their
field schemas (~2400 lines), consumed by both the extraction prompt builder
(`lib/parser-v2/extract.js` destructures `CODES, FEATURES, PROVISION_TYPES`
directly) and the UI (`pages/review-v1/[id].js`, `pages/admin/registry.js`,
`components/review/EditPanel.js`, table-configs). I did not read all 5386
lines top to bottom — nobody should, it's mostly flat data — but I read the
full header, the full ~330-line helper-function section, and swept the whole
file for exclusivity/count language ("ONLY", "MUST NOT", "exactly", "never")
the same way the classifier's header failed, then verified each hit that
made a falsifiable structural claim against the actual CODES/FEATURES data.

**Finding 1 — stale doc pointer.** Header said "Canonical reference:
/RUBRIC.md". That file no longer exists at the repo root: `git status` shows
`RUBRIC.md -> archive/RUBRIC.md` as a currently-staged rename (this looks
like it's part of the concurrent docs/archive reorganisation the coordinator
mentioned other agents are doing right now). Worse, the archived doc's own
content is itself stale against this file — it opens "Derived from 6
precedent agreements" and describes 16 provision types; `PROVISION_TYPES`
here now has 22 (verified by count). The emerging replacement doc,
`docs/core/CODEBASE-GUIDE.md`, already lists `lib/rubric.js` itself (not a
markdown file) as the reference for "Legacy provision types and field
shapes". Fixed the header to say RUBRIC.md moved to archive/, is stale, and
that this file is the reference — nothing external to chase. (I did not
touch archive/RUBRIC.md or anything else under archive/ — out of scope and
explicitly not mine to edit.)

**Finding 2 — false exclusivity claim, classifier-shaped.** The comment
directly above `FEATURES['TERMR-OUTSIDE']` read: "This is the ONLY TERMR
code that carries outsideDate / outsideDateExtension fields. Per fix #3,
those keys MUST NOT appear on any other TERMR-* code." I checked every
TERMR-* entry in FEATURES: `TERMR-EXTENSION` also carries
`outsideDateExtension` — and says so in its own comment three lines below
("Most agreements DON'T have this as a separate clause; when they do it
carries the SAME EXTENSION DATA but lives in its own provision"), so this
isn't drift nobody noticed, it's two adjacent, self-contradicting comments.
`TERMR-EXTENSION` is an active code (`frequency: 'common'`, not retired).
Fixed by narrowing the exclusivity claim to the outside-date VALUE fields
(outsideDate, outsideDateMonths, outsideDateISO, extendedOutsideDateISO,
which genuinely appear nowhere else) and naming outsideDateExtension as the
one deliberate, cross-referenced exception. This is the same shape of bug as
the classifier's — an absolute claim invalidated by a later, legitimate
addition — just caught here instead of costing someone a wrong "is this
field safe to key off of uniquely" decision.

**Finding 3 — stale enumeration from the most recent change in the file.**
The MISC-ENTIRE schema carries a fallback copy of five No-Other-Reps/Fraud
(Abry) fields for deals that embed that language in the Entire Agreement
section with no dedicated heading (the Metsera §9.07 pattern). Its comment
said the field keys "match REP-T-NOREP / REP-B-NOREP / REP-B-ANTIRELIANCE
exactly" so `lib/abry.js` can scan uniformly. Those three codes were retired
2026-08-02 (four days before this audit) in favour of eight element-level
successor codes (REP-T-/REP-B- × NOOTHERREPS/NONRELIANCE/INDEPINVEST/
FRAUDCARVEOUT) — confirmed via each retired code's own `superseded_by` array
and `tests/retired-code-enforcement.test.js`. I checked: all eight
successors do use the identical five (really six, with
`independentInvestigationAcknowledged`) key names, so the underlying
mechanism is sound — but the comment only ever named the three now-retired
codes. Concretely: the SAME R3 commit that retired them also added
`independentInvestigationAcknowledged` to this exact MISC-ENTIRE block 16
lines below, with its own comment correctly citing "v1 reclassification
(2026-08-02, R3)" — so the commit that created the staleness edited this
very region and simply didn't touch the older comment sitting just above it.
`lib/abry.js`'s own header, by contrast, already documents this correctly
("scans EVERY provision regardless of type/code... agnostic to which... a
given deal used") — it was updated during the same reclassification;
rubric.js's copy of the same explanation wasn't. Fixed by naming the
successor codes and the retirement, and generalising the "keys match X
exactly" claim to cover all eleven landing spots instead of three. No
runtime behaviour is affected either way (abry.js doesn't key off this
comment) but the NEXT person adding a twelfth landing spot, reading only the
old comment, would have had an incomplete picture of what "matching" means
here.

**Everything else checked and clean:** `getCodesForType`'s retired-code
exclusion (verified against `isRetiredCode`/`getSupersededBy`), the
sub-code union/subset logic in `getFeaturesForType` (spot-checked its own
`TERMR-MUTUAL` example — correct, no `outsideDate` on that code), the
CITABLE_FEATURE_KEYS auto-decoration loop, and the "consumed by both parser
and UI" claim (confirmed both sides by import, after an initial grep pattern
of mine wrongly came back empty on the parser side — re-ran it broader
before concluding anything, per the coordinator's warning about false
"nothing calls this" claims).

### 16. scripts/backfill-advisors.js
**Header:** accurate. Deterministic notice-block parser
(`lib/parser-v2/notice-advisors.js`) with an LLM fallback (subscription CLI
client, `lib/llm-cli-client`) only when the deterministic pass finds no firm
on either side; `--no-llm` disables the fallback exactly as documented.
"Canonicalization happens at READ time in lib/canonical-advisors.js" checked
and confirmed — that module is imported by real read-path code
(`components/query/QueryFilterControls.jsx`, `lib/home-data.js`,
`lib/query/natural-language.js`, `lib/query/executors/shared.js`), not just
by this backfill script's own diagnostic printing. "Merge, not replace"
matches `{ ...meta, advisors_v2: v2 }`. Dry-run-by-default and flag list all
match `parseArgs`.

**What it does:** For each deal, finds its NOTICES provision, extracts
outside-counsel firm/lawyer names deterministically by splitting "if to
<party>... with a copy to..." blocks, and falls back to an LLM read of the
same text only when the deterministic pass draws a blank; writes the raw
(uncanonicalized) capture to `deals.metadata.advisors_v2`.

**Findings:** none.

### 17. scripts/backfill-consideration.js
**Header:** accurate — short, functional description matches the code
exactly (dry-run by default, builds `consideration_equity_provisions`/
`consideration_treatments` from legacy `CONSID-EQUITY` rows, flags
incomplete conversions `needs_reextraction`).

**What it does:** A one-time bridge that reshapes already-extracted legacy
CONSID-EQUITY provision data into the new `consideration_equity_provisions`/
`consideration_treatments` tables without re-running extraction, so the new
schema has data before a real re-extraction pass exists. Detects when a
legacy row is too thin to convert faithfully (an instrument mentioned in the
text but not structured, or a treatment/instrument count mismatch) and marks
those rows for reprocessing rather than silently shipping a partial
conversion.

**Findings:** none.

### 18. scripts/backfill-elections.js
**Header:** accurate — minimal (two usage lines, dry-run by default),
matches `parseArgs`'s `apply` default of `false`.

**What it does:** Derives election mechanisms (cash/stock election choices,
proration) from each deal's consideration-equity region text via
`buildElectionMechanism`, and separately finds CONSID provisions that carry
election language but have no linked `consideration_equity_provisions` row
yet, building a "carrier" row for them via `buildElectionCarrierProvision`.
Idempotent by construction — `existingIds` prevents re-creating a carrier
for a provision that already has one.

**Findings:** none.

### 19. scripts/backfill-ftv-type.js — HEADER FIXED, defect found
**Header claimed:** a strict two-tier placement policy — match the deal's
`forceTheVoteDetails` quote in a NOSOL provision, else match the
`features.forceTheVote === true` flag, "otherwise SKIP with a warning
(never guess)."

**What is actually true:** the code has two MORE fallback tiers before any
skip: a category-name match on "Solicitation Prohibition", then — genuinely
unconditionally — "the longest NOSOL provision in the deal" as a last
resort. The code's own inline comment for this tier already calls it what it
is: "Tier 4 last resort: the longest NOSOL provision. Both are
deterministic and logged." That is a guess, not evidence, and it directly
contradicts the header's "(never guess)" promise three lines above it.

**Consequence:** this script writes a legally meaningful classification
(hard vs soft force-the-vote) onto a specific provision row. A reader who
trusted the header would assume every write is anchored either to the
verbatim clause the codebook was coded from or to an explicit boolean flag —
not realizing that some fraction of deals (whichever ones don't match tiers
1-2 or the category-name tier) get the value stamped onto whatever NOSOL
text happens to be longest, with no evidentiary link to FTV strength
specifically. That's a real, if narrow, provenance gap in a script whose
whole point is "verified claims values" placement.

**Also found (reported, not fixed — logic change, out of scope for a
comment pass): the final `if (!target) { SKIP: no placement }` guard (line
124) is unreachable.** `dealProvisions` is already guaranteed non-empty at
that point (an earlier, separate guard skips the deal entirely when there
are no NOSOL provisions at all), and tier 4's `.reduce()` over a
guaranteed-non-empty array always returns an element. So the one case this
final check exists to catch can never occur given the current tier
ordering — a check that cannot fire, worth knowing about before anyone
relies on it as a real safety net.

**What I changed the header to:** listed all four tiers, said plainly that
only the first two are evidence-anchored, described tier 4 as a logged
guess rather than a skip, and corrected "lib/query/context" (no such file)
to "lib/query/context-cache.js" (confirmed: it reads `provisions.ai_metadata`
and is what the query engine actually consults).

### 20. scripts/backfill-parser-regions.js
**Header:** accurate — minimal, matches code (dry-run by default, usage
examples match `parseArgs`).

**What it does:** Re-parses each deal's stored full text through the
current structural parser and matches the freshly-parsed section boundaries
back onto the deal's already-classified sections (by section number + start
offset, falling back to a unique-number match), then persists parser
regions and re-attaches region IDs — a way to backfill region linkage onto
deals classified before regions existed, without re-classifying anything.

**Findings:** none.

### 21. scripts/backfill-transaction-steps.js
**Header:** accurate — minimal, matches code.

**What it does:** Runs the transaction-step detector
(`lib/parser-v2/detectors/transaction-steps.js`) over each deal's already-
classified sections to build a step topology (single merger vs multi-step),
persists it, and — only for genuinely multi-step deals — binds each
consideration-equity row to the specific step its text belongs to, flagging
low-confidence bindings for review rather than asserting them silently.

**Findings:** none.

### 22. scripts/backfill-parent-entities.js — HEADER FIXED
**Header claimed:** ingest at both `scripts/ingest-local.js` and
`pages/api/ingest/from-url.js` "now asks the extractor for parent_entity /
target_entity / acquirer_display / target_display."

**What is actually true:** `pages/api/ingest/from-url.js` is currently a
contained 503 stub (its own header: "Contained (503)... ingestion stays
off"; see `docs/API-ROUTE-CLASSIFICATION.md`, read-only per constraint). The
real URL-ingest logic that does request these four fields now lives at
`lib/broad-corpus/contained-routes/from-url.js` (confirmed: it references
all four fields substantively, not just in a comment) — the named file is a
dispatcher stub, not where the behaviour lives. This script's own core claim
(same subscription CLI client as `scripts/ingest-local.js`, confirmed by
grep) is unaffected and still true.

**What I changed the header to:** repointed to the file that actually
contains the logic, and noted the containment status in one clause so a
reader doesn't need to go find that out independently the way I just did.

### 23. scripts/backfill-law-firms.js
**Header:** accurate, and unusually careful about tense — where it cites a
point-in-time fact ("~8 deals... as of 2026-07-18") it says so explicitly
rather than stating it as current fact, which is exactly the discipline that
prevents this kind of header from going stale. Verified the one concrete,
checkable architecture claim: `lib/ingest/deal-metadata-prompt.js` does
export `extractLawFirms`, which does call `buildAdvisorsV2` from
`lib/parser-v2/notice-advisors.js` — matches "the SAME deterministic
extraction... now runs at ingest time" exactly.

**What it does:** Two sub-jobs behind `--only`: extract each deal's law
firms from its stored full text (deterministic Notices-excerpt parse, LLM
CLI fallback if that draws a blank), and separately re-run advisor
extraction, sourced from raw text rather than requiring an already-
classified MISC-NOTICES provision, for the smaller set of deals that slipped
past `scripts/backfill-advisors.js`'s narrower provision-only source.

**Findings:** none.

### 24. scripts/backfill-deal-display.js — HEADER FIXED
762 lines, almost entirely a dated, hand-verified, per-deal dataset
(`BUYER_DISPLAY_ROWS`, `VALUE_ROWS`, `FINANCIAL_BUYER_ID_PREFIXES`) backing
a one-time "deals-index audit" backfill, not a general algorithm — this is
the correct shape for this kind of script and I want to be clear the dense,
narrated header (specific deals, specific SEC filing quotes, specific
reviewer names/dates) is doing exactly what it should: recording a hand-
verification trail, which is worth more here than a terse summary would be.

**What it does:** Backfills four independent, hand-curated corrections onto
a fixed, named set of deals identified in a specific 2026-07-18/19 audit:
buyer display names + ultimate parent (piercing shell/SPV buyers back to
the real sponsor, e.g. "Glow Midco, LLC" -> "General Atlantic"), deal value
+ its SEC press-release source citation, headline consideration type
(mostly derived live from the deal's own stored CONSID provisions, with a
2-deal pinned fallback), and financial-vs-strategic buyer classification.
VERIFY-flagged rows are never written regardless of `--apply` — a
deliberate safety rail, not an oversight.

**Finding — count drifted exactly like the classifier's, one entry.** The
header's item 1 says buyer_display covers "the 6 confident rows
(Envestnet, Endeavor, HireRight, European Wax Center, Superior Industries,
Sekisui House/M.D.C.) + a United Homes Group ultimateParent-only note."
`BUYER_DISPLAY_ROWS` actually has 8 entries, not 7 (6+1): it also carries
Catalent / Novo Holdings A/S, added — per that entry's own detailed inline
comment — on 2026-07-19, one day after the "Ben review round (2026-07-18)"
the header narrates, to fix "an omission, not a considered VERIFY/skip
decision" from earlier rounds. The header was never revised to mention it.
Cross-checked the sibling count (`VALUE_ROWS`, "all 13 rows resolved") by
counting `idPrefix` entries — that one is exactly 13, correct as stated, and
does NOT include Catalent (it has no value row, only a buyer_display row),
so the two counts aren't simply out of sync with each other — item 1
specifically lost track of one entry added the day after it was written.
Fixed by naming Catalent in the enumeration and correcting 6 -> 7.

**Checked and ruled out a bigger-looking concern.** `FINANCIAL_BUYER_ID_PREFIXES`
is a hardcoded Set of 8 deal-id prefixes (item 4, buyer_profile) — on first
look this reads like the "hardcoded value that should be derived" pattern
the coordinator flagged. It is not: `lib/ingest/deal-metadata-prompt.js`
has its own live `classifyBuyerProfile()` (shell-buyer + guarantee-language
heuristic) that runs automatically at ingest time for every new deal
(confirmed: `meta.buyer_profile = classifyBuyerProfile(...)` in that
file's `buildDealMetadata`-equivalent flow) — the hardcoded list here is a
one-time catch-up for deals ingested before that classifier existed, same
role as `scripts/backfill-parent-entities.js`, not an ongoing dependency
for the corpus going forward. Worth recording so the next reader doesn't
have to re-derive this the way I did.

---

*(modules 25–39 continue below as completed)*
