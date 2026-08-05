# Roadmap

Written 2026-08-05.

---

## What this document is

This is the roadmap: the plan for taking Canonical V2 from where it is now
to a live production switch-over, and the current state of the work. Read
this regularly.

It is one of three documents that between them replace `MASTER-PLAN.md`,
which had grown too long to read regularly because its history section
expanded every session, crowding out the forward plan. `MASTER-PLAN.md` now
carries a short stub pointing at all three:

- **`OPERATING-RULES.md`.** What anyone must know before starting work: the
  authority boundary, the glossary, the owner's rulings, and the standing
  working conventions. Self-contained; read once before starting.
- **This document.** The plan and the current state.
- **`WORK-COMPLETED.md`.** The historical record of defects found and
  fixed. Not required reading.

Each fact lives in exactly one of the three. This document does not restate
a ruling; where a step depends on one, it names the ruling in a clause and
points to the operating rules.

`docs/codex-program/EXECUTION-LEDGER.md` is a separate, formal record of
programme milestones and is not part of this split.

This document decides nothing about authority. It does not approve,
activate or release anything. **Production remains prohibited until Ben
says otherwise.** Writing or updating this document changes no status,
closes no gate, and does not itself satisfy any precondition it describes.
"Current state", below, records the current, verified state of the work;
"Decisions still needed", below, records exactly what is still needed from
Ben and what each item blocks.

This document owns the plan. Where technical work happens to move faster
than this document is updated, that is noted honestly wherever it was
found, rather than silently smoothed over. "Current state" flags the
working tree's own state at the time of writing as an example of exactly
that.

---

## Where we are now

The new extraction system produces good data for all the main provision
families. The review page, the comparison view, the search tools and the
market statistics are all built.

Three things are true at once, and holding all three in mind explains the
rest of this document:

1. **The new data is largely correct.** It has been tested hard, including
   by deliberately trying to break it.
2. **Almost none of it is actually displayed yet.**
3. **Several parts of the product are switched off.** Search and market
   statistics currently return "temporarily unavailable" by design, while
   the data underneath them was being reworked.

### What "the count" means

One number recurs throughout this document: **104**. It is worth being
precise about, because it is the measure of how far the product is from
release.

The product tracks every place where a provision should appear on screen.
Each of those is checked: does the new system actually put this in front of
a user? 104 of them currently fail that check. They fail for four different
reasons, and the difference matters:

| How many | What is true | What it needs |
| ---: | --- | --- |
| **73** | The analysis is **finished and approved**. The system reads the clause correctly. But no page displays it yet. | Wire an existing page to read the new data |
| **27** | The analysis itself is **not finished**. These are four areas: Material Contracts, No Other Representations, General Covenants, and Representations. | Finish the analysis, then display it |
| **3** | Parts of the screen nobody has claimed ownership of yet. | Decide who owns them |
| **1** | A calculated figure that is wired up correctly but sits behind a switched-off search route. | Turn the search route on |

Six further items are tracked separately as held for review. They are not
counted in the 104.

The check itself is deliberately strict. It traces the whole path from a
web page down to the code that produces the value, and if it cannot trace
every step it does not count the item as done. An earlier, looser version
of this check would have let 59 of the 104 be marked finished by editing a
record rather than doing any work. That was found and closed (see Work
completed).

**The number has not moved all the way through this work, and that is
correct.** Everything done so far has been making the count honest rather
than making it smaller. A count that fell because a rule was relaxed would
be worse than useless: it would say the product was ready when it was not.

This is still an accurate picture today. The full current breakdown, what
is switched on and off, and what the test suite currently shows, is in
"Current state", below. None of the roughly two dozen checks required
before the whole corpus can be certified has passed yet.

One piece of the product has already moved further than the rest: the
side-by-side comparison of a small number of deals on the review page is
genuinely live in production today, on the old data path. Improving it is
step 4 below. It is unrelated to whether the new system is switched on.

---

## The steps to publication

Each step says what it is, why it matters, what finished looks like, and
what is needed from Ben. Underneath each step, a section marked **Technical
detail** carries the engineering specifics: file paths, module names, exact
rules. Skip those sections entirely if you only want the plan.

### Step 1. Finish hardening the new data path

**What.** A deliberate attempt was made to break the new extraction, and it
found eleven problems. Most are fixed. The last group concerns one family
(representations) where the code that builds a record is less strict than
the code that checks it, so a record can be built that its own checker would
reject.

**Why it matters.** The most serious problem found was that a quotation
could be trimmed in a way that reversed its legal meaning. A fragment
dropping the words "would not" from "would not have a Material Adverse
Effect" was accepted as an exact quote. In a product lawyers rely on, that
is the worst class of error there is: confidently wrong.

**Status.** Largely done, with one honest gap that only became visible once
the work was attempted.

Crude trimming is now rejected everywhere: taking "accurate" out of
"inaccurate", or the first few characters of a phrase, fails in all four
families. Two families are fully airtight, because their quotes are always
stored whole, so an exact match is possible.

The remaining gap is narrower but real. For the two families whose quotes
are fragments of a longer passage, the system can now detect if a quote was
**altered after the fact**, but it cannot detect a quote that arrives
already trimmed and never existed in a correct form. In plain terms: if the
extraction step itself drops the words "would not", nothing downstream can
tell, because there is no record of where in the document the quote was
taken from.

**The proper fix is upstream and is now step 1b.** The extraction step
needs to record the exact position of every quote it takes, not just the
text. Once it does, every downstream check becomes exact and this class of
error disappears entirely. Two of the four families have no such record
today.

**Why this matters more than it sounds.** The realistic risk here is not an
attacker: it is the extraction step making a mistake and trimming a clause
in a way that reverses its meaning. A lawyer reading the result would have
no signal that anything was wrong. This is the single most consequential
correctness gap currently known in the product.

**Needs from Ben.** Nothing yet. Step 1b is engineering work, but it is
worth knowing that until it is done, quotations from two families carry a
small residual risk of being faithful-looking but trimmed.

#### Technical detail

The four families are the four dark bridges: `lib/canonical-v2/legacy-card-bridge.js`
(Material Contracts), `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`,
`lib/canonical-v2/general-covenants-dark-bridge.js` and
`lib/canonical-v2/representations-dark-bridge.js`. An adversarial audit of
these four bridges produced eleven numbered findings (F1 to F11). Gate
ordering, receipt handling and identity findings are closed (see Work
completed for the significant ones and Known risks and limitations, below,
for the one still open). The outstanding item is F5, quote fidelity.

Three of the four bridges verify "verbatim" grounding with plain
`String.includes`. A word-boundary anchor now blocks the crude cases
(`"accurate"` lifted out of `"inaccurate"`, a truncated prefix), but it
cannot catch a fragment that drops a preceding negation, because the
surviving text is already word-boundary aligned on both sides. Containment
can never establish semantic fidelity, because whether a sub-span preserves
meaning depends entirely on what precedes it. `general-covenants-dark-bridge.js`
already requires exact equality against the full stored quote when no
offset exists, which is why it resists this attack better than its
siblings; it is the model the others should be brought up to, not the
outlier to be relaxed toward.

The designed, not-yet-built fix (step 1b) is offset verification: where a
span offset exists, check that the stored text equals
`sourceText.slice(start, end)`, not that the source merely contains it.
Priority order, failing closed at each step: (1) verified offset if one
exists; (2) exact equality against the full source quote if no offset
exists; (3) only if neither is possible, word-boundary anchored containment,
explicitly recorded as the weaker fallback rather than treated as
equivalent. The canonical excerpt identity is already
`contentId(EXCERPT_DOMAIN, { quote, start, end })`, and the Representations
projection already carries `evidence.spans`, so the data needed for the
rigorous check already exists in places; it is not wired into the
verification path yet.

### Step 1b. Record where every quotation came from

**What.** Change the extraction step so that when it takes a quote from an
agreement, it records the exact position in the document, not just the
words.

**Why it matters.** It closes the gap in step 1 completely, rather than
partially. It also becomes necessary for the amendment parsing deferred
until after launch: once a deal has both an original agreement and an
amendment, "this text appears in the source" is meaningless without
knowing which source and where.

**Done when.** Every quote carries its position, and every downstream check
verifies against that position rather than searching for the text.

**Needs from Ben.** Nothing.

#### Technical detail

This design was recorded in an earlier, now-superseded version of the
handoff document, as "the design, before it is built": not yet implemented
as of the last recorded state. Once built, it directly feeds the
offset-verification rule described under step 1, and it is a prerequisite
for amendment handling (step 8), because a quote must be attributable to a
specific source document once a deal has more than one.

### Step 2. Fix two faults in the review page

**What.** Two defects in the existing product, both found while doing the
above. First, opening the side-by-side comparison silently removes the "N of
M present" coverage summary, including for the deal you were already looking
at. Second, the two most complex families lose their specialised layout in
comparison mode.

**Why it matters.** These are live faults affecting the product today,
independent of anything new.

**Done when.** Comparison mode shows the same information as single-deal
mode.

**Needs from Ben.** Nothing.

#### Technical detail

Both faults sit in `components/review-v2/CompareColumn.jsx`'s
`UnifiedCompareSection`. It never called a config's `renderFooter` (the
coverage summary that Closing Conditions and Material Contracts define, and
that `ProvisionTable` calls on both its own render paths, so compare mode
silently dropped it even from the primary column), and it never called a
config's custom `renderBody` (only MAE and Representations define one; MAE
loses its party-split two-table layout, Representations loses its
general-exceptions, knowledge-summary and per-rep table layout).

At the time of writing, the working tree contains further uncommitted
changes to this exact file that appear to address both gaps directly
(`renderFooter` is now invoked from the compare path, and per-family
handling has been added that reproduces the MAE party split and the
Representations block layout without reusing the single-deal-only table
builders). This has not been committed, and this document has not verified
it by running the test suite. Confirm it is finished and tested before
relying on it.

### Step 3. Retire the duplicate comparison page

**What.** There are two separate implementations of deal comparison. One is
the review page with extra columns. The other is an older standalone page
which nothing links to, no test covers, and which reads a rougher,
uncurated copy of the data. Retire the old one and the two search modes
that merely redirect into the new one.

**Why it matters.** Two implementations of the same thing drift apart. That
has already caused three separate faults in this codebase, including one
where two parts of the product disagreed about whether to show unverified
data.

There is also a large hidden benefit. Seventeen of the outstanding items are
recorded against the old comparison code. Moving them onto the new
comparison view, which has no field limit, is likely to resolve an open
technical question entirely rather than requiring it to be answered.

**Done when.** The old page is gone, the records point at the new view, and
the outstanding count still reads 104. It must not fall. Those items are
not finished; only the place they refer to has changed.

**Needs from Ben.** Already approved (ruling: Operating rules, "The
comparison and search product shape").

#### Technical detail

The old page is `pages/compare.js` (2,414 lines): zero inbound links
anywhere in navigation, zero tests, and built on the raw `provisions` table
rather than the curated, deduplicated `provision_cards` table the review
page uses, so it is also the less trustworthy surface. The two search modes
are the `DEAL_COMPARE` and `DEAL_TO_MARKET` query kinds; `pages/query/[kind]/[id].js`
already computes their results and immediately redirects to
`/review/<id>?compare=` or `?market=1`, discarding everything else, so this
decision is already half-shipped in practice.

The 17 rows are registered against `lib/query/render/deal-compare-cell-fields.js`
(its top-level `KEY_FIELDS` literal), which exists solely to feed
`DEAL_COMPARE`. They are unprovable there today because the field lookup is
a table-driven, computed access with no per-field branch for the current
proof rule to find (full breakdown is under Known risks and limitations,
below). Re-pointing them at the review compare mode, which has no field
limit and no table-lookup problem, may dissolve that question rather than
requiring it to be answered. Re-point, do not close: the 104 count must not
move because a surface was retired rather than because the underlying work
finished.

Before deletion: fix step 2's two live defects first (they are defects in
the surface being kept, independent of retirement). The summary-matrix
ruling (Operating rules, "Comparison view requirements") removes the last
objection to retiring the old page. Register paperwork on retirement: of 28
entries citing the cell-fields file, 26 are already closed and 2 remain
open; of 4 citing `pages/compare.js`, 1 remains open
(`representations-compare-side-table`, whose locator names `RepsCompare` by
name, and the Representations design spec also still points there and needs
updating in the same change). `lib/query/natural-language.js` has real
hardcoded detection logic for both retiring kinds and needs editing, not
deletion; existing saved queries should be checked before removing engine
support.

### Step 4. Improve the comparison view

**What.** Three things Ben asked for (approved shape: Operating rules,
"Comparison view requirements"): choose which terms appear rather than
always showing everything, remove the current three-deal limit with
horizontal scrolling for larger sets, and eventually export to Excel and
PDF.

**Why it matters.** This is the working surface for precedent research.
Being able to say "show me the fee and the outside date across these twelve
deals" is the core use.

**Done when.** Terms are selectable at both section and row level, and the
deal limit is gone.

**Needs from Ben.** Nothing. Export is deferred until after launch on Ben's
instruction; see "Deferred until after launch" below.

Alongside these three, when a set of deals is being compared, the market
sidebar must show both how a term compares across just that set and how it
compares across the whole corpus, filterable.

#### Technical detail

The deal limit is `MAX_COMPARED = 3` in `components/review-v2/compareData.js`.
On-screen, a large N has real limits (fetch count, horizontal layout,
`unionRows` cost) and likely needs horizontal scroll or virtualisation
rather than an unbounded table; export is the real consumer of a genuinely
large N, and is a new build, since nothing in the codebase does CSV, Excel
or PDF export today. Selectable terms need two levels, which section
appears and which row within it; the row identity `unionRows` in
`components/review-v2/compareRowUnion.js` already computes is the natural
handle for the row level. There is partial precedent in the query product's
`included_field_groups` (primary, qualifiers, mechanics, all), but that is a
coarse four-way switch over a fixed key list, not user selection.

The dual-scope market sidebar is architecturally straightforward:
`calculateMarketStats(request, dataset, validateMetricResult)` in
`lib/row-market-stats/service.js` already takes an arbitrary dataset, so
scoping to the comparison set is a second invocation with a different
dataset, not new statistics code. Two invocations, two scopes, rendered as
two bands in the same sidebar. The corpus-scope side additionally needs
filtering, which is closer to the screening query kind than to anything
already in the review page, and is the one part of this requirement that is
not simply a second call. This whole step is blocked on step 7 (market
statistics activation), since every market route is currently a 503 stub.

### Step 4b. Show the new data on the review page

**What.** Switch the review page to display the new system's output for
the 73 provisions whose analysis is already finished and approved. This is
wiring an existing page to read the better data, not new analysis.

**Why it is here and not later.** An earlier draft of this plan put all the
display work near the end, after the search tools. That was wrong, and Ben
caught it. Only one of the 104 outstanding items depends on the search
tools being switched on. The other 103 do not.

Three reasons this belongs early:

- The review page is the surface people actually use. Until the new data
  appears there, none of the rest of the work is visible.
- Building search tools over the old data and migrating them afterwards is
  doing the work twice.
- If the new analysis is wrong anywhere, the review page is where it would
  be noticed. Finding that out before building on top of it is cheaper.

**Why it is not step 1.** It depends on the quotation work in steps 1 and
1b, because displaying a quote that might be trimmed is worse than not
displaying it. Everything else before it is either a live fault or a
consolidation that would otherwise have to be redone.

**Done when.** Those 73 provisions are read from the new system by a real
page, each proven by tracing the full path from page to value, and the
outstanding count falls accordingly. This is the first step where the
number moves, and the first where users would see a difference.

**Needs from Ben.** Permission to switch the display over, family by
family rather than all at once.

#### Technical detail

The 73 sit under the `NATIVE_UNVERIFIED` disposition in the parity
register: the underlying legal analysis already carries a terminal,
approved disposition, and the gap is purely a missing served consumer. This
is the more mechanical half of step 9's precondition (see that step): it
still needs a real, non-contained route importing the exact projection,
satisfying both the adapter-proof and locator-proof rulings (Operating
rules), but it does not need new legal-analysis work first, which is what
distinguishes it from the 27 handled in step 9. Note the 19 rows described
in Known risks and limitations, below (the unprovable locators): a portion
of the 73 cannot be cleared by wiring alone, for the separate reason given
there.

### Step 5. Source completeness: a page for confirming we have all the documents

**What.** A filing is verified when its text is confirmed to match what was
published. That is already built and independently double-checked. What is
not built is a way to record whether a human believes we have *all* the
relevant documents for a deal: the original agreement, any amendments, any
restatements.

Ben's design: a filing counts as verified on its own merits, with a health
warning shown alongside it saying no human has confirmed the document set is
complete. That lets work proceed. Separately, an admin page where a
reviewer confirms the set is complete, or says it is not and asks an AI to
go and find what is missing.

**Why it matters.** Document sets are never provably complete: another
amendment can always appear. Treating completeness as something a person
judges and can revise, rather than something the system proves, is both
more honest and far simpler to build.

**Done when.** The state model exists (done), and the admin page lets a
reviewer mark a deal complete or incomplete.

**Needs from Ben.** Two things. Where that state is stored, which has not
been decided. And separate permission for the "go and find it" button,
because fetching further filings is retrieval, which has not been
authorised.

#### Technical detail

The health warning is strictly advisory: it must never block, fence or
refuse anything, and must not be modelled the way the dark-authority fence
is modelled (`lib/query/dark-authority-fence.js`, which legitimately does
reject records, but over a different axis, source authentication, not
corpus completeness). The state vocabulary should stay limited to what a
human concluded (not yet verified, verified, or believed incomplete);
whether an AI was ever instructed to look for more documents is a workflow
action, not a state the corpus holds. The admin page belongs alongside the
existing `pages/admin/` family (registry, candidates, gaps, ingest-runs,
agreements, taxonomy, review-queue, schema-loss, processing-flow,
reconciliation, reports) and should follow its conventions.

The "go and find it" step is extraction, which remains unauthorised; the
capture function (`corpus-source-discovery-capture.js`) currently refuses
unconditionally and correctly. The page is buildable up to the point of the
search button.

At the time of writing, the working tree contains an uncommitted, two-axis
implementation of the state model at `lib/canonical-v2/source-verification-state.js`:
one record type per document (`DOCUMENT_TEXT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES`
/ `DOCUMENT_TEXT_NOT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES`) and a separate
record type per deal for corpus completeness, structurally unable to
reference each other's fields. This is a candidate implementation only, not
committed, not verified here by test run, and no ruling in the source
material records Ben approving this specific naming. Treat the naming
decision under "Decisions still needed", below, as still open until that is
confirmed.

### Step 6. Turn search back on, in preview

**What.** Five search tools exist and are switched off: comparing named
deals, one provision across every deal, the range of a value across the
market, filtering deals by criteria, and a plain-English question box that
routes to the right one. Turn them on in the test environment only.

**Why it matters.** "One provision across every deal" is the precedent
library view, and is arguably the single most valuable thing the product
does. It is built and currently unreachable.

**Done when.** The search routes answer in preview, production stays off,
and each one is checked against real data rather than assumed to work.

**Needs from Ben.** Nothing. Production activation is a separate later
decision.

#### Technical detail

All five kinds run through seven route files
(`/api/query/run`, `/api/query/interpret`, `/api/query/field-options`,
`/api/query/demo-set`, `/api/query/kinds`, `/api/saved-queries`,
`/api/canonical-v2/query`) that are currently three-line 503 handlers
defined by `lib/query-containment.js`. This is also what keeps
`termination-fee-query-derived-values` at `DERIVED_INTEGRATED_NOT_SERVED`
rather than visible (the ruling recorded in Operating rules). The approved
surviving shape (also Operating rules) keeps provision cross-cut, what's-market,
screen-and-filter and the natural-language router as live destinations;
deal-versus-deal comparison is already served separately through the review
page (step 3/4). Activation order: this step follows the trusted
source-admission boundary (step 5) and Compare, and precedes Market (step
7).

### Step 7. Turn market statistics back on, in preview

**What.** The market statistics routes are also switched off. The machinery
behind them is substantial and already handles the hard part: deciding
which other deals are genuinely comparable, by matching the basis and the
timing of a term rather than lumping all deals together.

Once on, add the two-scope view Ben asked for: how a term compares within
the deals currently being compared, and how it compares against the whole
corpus.

**Why it matters.** "What's market" is the question clients ask. This is
the part of the product that answers it.

**Done when.** Statistics answer in preview and the comparison view shows
both scopes.

**Needs from Ben.** Nothing.

#### Technical detail

`/api/corpus-stats`, `/api/corpus-stats-batch` and `/api/market-stats` are
all currently three-line 503 stubs. The cohort machinery in
`components/review-v2/marketSummaryHelpers.js` is built but unreachable.
Peer-comparability filtering (by basis, semantics and cadence) already
exists; what is missing for step 4's dual-scope sidebar is only scoping the
peer set to the current comparison, which depends on this step rather than
being a standalone build.

### Step 8. Detect amendments and say so

**What.** A deal is not one document. A later filing may be a complete
restated agreement or an amendment changing specific clauses. Ben's
decision is to split this work either side of launch.

**Before launch, detection only.** Work out whether a filing is a fresh
agreement, a restatement or an amendment, and where a deal has an amendment
we have not yet processed, show that plainly on the deal: "this agreement
has been amended; the amendment is not yet reflected here."

**After launch, the parsing.** Working out exactly what an amendment
changed and showing the difference in the review tab is deferred, along
with export.

**Why the split.** Going live without any amendment handling would mean an
amended deal silently displays superseded terms. A termination fee that was
renegotiated would read as the original, with nothing to warn the reader.
That is the same "confidently wrong" failure the quotation work exists to
prevent.

Detection is a small fraction of the work of parsing: it classifies a
filing rather than comparing two documents. It converts a silent error into
a visible caveat, which is the honest minimum for launch. It also sits
naturally beside the source-completeness warning from step 5: "nobody has
confirmed we have every document" and "we know there is an amendment we
have not processed" are the same kind of statement, shown in the same
place.

Only one deal in the corpus is currently known to have an amendment, so
today's exposure is small. The corpus grows, and amendments are common in
practice.

**Done when.** Filings are classified correctly, anything ambiguous goes to
a human rather than being guessed, and any deal with an unprocessed
amendment carries a visible warning.

**Needs from Ben.** One judgement, and it is only needed when parsing is
built after launch: when a term is amended, which value counts for market
comparison, the original or the amended one? Both are defensible, and the
statistics must pick one deliberately and label it rather than silently
mixing the two.

#### Technical detail

Classification must fail closed, using signals such as the title ("AMENDED
AND RESTATED AGREEMENT AND PLAN OF MERGER" versus "AMENDMENT NO. 1 TO...")
, whether a full article structure is present, document length, and
operative language such as "is hereby amended to read as follows";
ambiguous cases go to human review, not a guess. This classification is the
whole of the pre-launch scope. A full restatement is stored as its own
agreement, linked to its predecessor by an explicit relationship and
effective date, with extraction run normally.

The deferred, post-launch parsing work: an amendment expresses operations
(restate a section, delete and substitute words, insert or delete a
subsection, amend a defined term or a schedule), not prose, and parsing
must capture the target reference, the operation and the new text, failing
closed when the target cannot be resolved unambiguously. Two
representations are expected to be needed: a delta view answering "what
changed" (the display artefact) and a materialised effective text answering
"what does the agreement say now" (the extraction input); storing only one
loses the other's job. The failure mode to design against is silently
overwriting base-agreement provisions; supersession must be explicit and
additive so the original stays readable and citable.

This connects to two pieces of work already done or designed elsewhere: the
card-identity ruling (Operating rules) already requires identity to bind
the source revision, anticipating a second source document per deal; and
the offset-based quote verification designed for step 1b becomes more
important once a quote must be attributed to a specific document among two,
which matters most once parsing (not just detection) is built. Metsera is
the only deal currently known to carry an amendment, and is the natural
first fixture. This is also where the corpus-completeness state from step 5
and amendment detection meet: a new amendment appearing is exactly the
event that should revoke a prior human completeness verification, and
should drive that state rather than sit beside it unconnected.

### Step 9. Actually display the new data

**What.** Finish the analysis for the four areas where it is genuinely not
done yet, then display them. Those four are Material Contracts, No Other
Representations, General Covenants and Representations, accounting for 27
of the outstanding items. Step 4b already displayed the 73 whose analysis
was finished.

This step is therefore real analysis work, not wiring. That is the
difference between it and step 4b, and it is why the two are separated: one
is a switch-over, the other is building something that does not exist yet.

**Why it matters.** These four are the last areas still served entirely by
the old system. Until they are done, the product runs on two systems at
once.

**Done when.** All four areas are analysed by the new system and
displayed, proven the same way as step 4b, and the outstanding count
reaches zero apart from the three unowned screen areas and anything held
for review.

**Needs from Ben.** The same family-by-family permission as step 4b.

#### Technical detail

The 27 split as Material Contracts 8, No Other Reps/Fraud 7, General
Covenant Router 7, Representations 5. Clearing any one needs two
independent, real things at once: the evidence record reaching a terminal
disposition (all 27 are currently open, with no follow-on outstanding
resolved), and a consumer that a live, non-contained route actually
reaches, importing the exact projection, satisfying both the adapter-proof
and locator-proof rulings (Operating rules). A dark bridge by itself clears
none of these by construction: it is a precondition for serving, never
evidence of it, and this was proven in practice when three bridges landed
and the blocker count did not move. The architectural boundary that governs
this step is ADR-001 (Operating rules, in full): native serving must
consume the new projections directly, never the bridged, flattened preview
cards.

### Step 10. Certify the whole corpus

**What.** Run the new system across every deal, not just the test set, and
check quality, consistency, performance and the ability to roll back.

**Why it matters.** Everything so far has been proven on a handful of
agreements. This proves it at full scale, where the awkward cases live.

**Done when.** The certification gates pass on the full corpus.

**Needs from Ben.** Permission to run extraction across the corpus, which
has not been given.

#### Technical detail

This is the P9 stage of the programme. All 25 preproduction gates are
currently open (full list under "Current state", below). Most directly
load-bearing for this step specifically: the render-parity and
structured-claims gates (does a native surface actually reproduce what the
legacy card shows), the identity-and-drift gate (the excerpt-identity
remediation in step 11 is preparatory work for this, not a substitute for
it), and the security and authentication gate, whose acceptance criteria
are an explicit prerequisite for any production credential issuance or
use, any inactive production import, and production activation itself.

### Step 11. Prepare the production data changes

**What.** Three data corrections have to happen in a fixed order, and the
order matters more than the work:

1. Fix how records are keyed when reading, which is done.
2. Fix how records are keyed when writing. Two clauses quoting the same
   sentence can currently overwrite one another, silently.
3. Only then remove the database rule that has been masking both problems.

**Why it matters.** Doing the third before the second turns a hidden fault
into live data loss. The database rule is currently the only thing
preventing it.

**Done when.** The migrations are rehearsed and reversible.

**Needs from Ben.** Approval to change the production database, which is a
separate act from anything above.

#### Technical detail

Full detail, including the exact code locations and the warning against
reordering, is in "Known risks and limitations", below, which must be read
in full before this step starts. In outline: the read-side fix (item 1) is
complete in `lib/queries/claims-adapter.js` and `lib/queries/review-deal.js`;
the write-side fix (item 2) in `lib/parser-v2/store-claims.js`'s claim-id
composition is not yet done and needs a data migration, not just a code
change, because it re-mints every existing claim id; only after both is it
safe to touch the unique index in
`supabase/schema-04-provision-card-canonical.sql`. The index is also,
incidentally, the only thing currently preventing a flattened preview card
from ever being persisted (ADR-001 constraint 2, Operating rules); anyone
proposing to alter it must satisfy that constraint by some other explicit
means first.

### Step 12. Import and go live

**What.** Load the new data into production without switching to it, check
it matches, then switch over as a single act with a tested way back.

**Why it matters.** This is the point of no return, and it should be boring
because everything above made it boring.

**Done when.** The product serves the new data and the old path can still
be restored.

**Needs from Ben.** Explicit one-time authorisation. This is the "go
public" decision.

#### Technical detail

The gates that govern this step specifically are the cutover chain
(deployment parity, import parity, promotion eligibility, cutover
authorisation) and, to close the programme, the traceability gate and the
terminal programme-completion attestation gate, which is a bundle-freezing,
terminal state. This step is what the eventual production activation
package, once written, will cover in detail; the preconditions gathered for
it so far are under "Decisions still needed", the operating rules' ADR-001,
and "Current state".

---

**Deferred until after launch.** Two pieces of work sit deliberately after
go-live, on Ben's instruction. Neither blocks release, and neither carries
a correctness risk at launch, because step 8's detection warning covers the
amendment case.

**Export to Excel and PDF.** Purely additive. Nothing in the product
exports anything today, so this is a genuine build rather than a port. It
is what makes large comparisons useful, since nobody reads fifty columns in
a browser.

**Amendment parsing.** Working out precisely what an amendment changed and
showing that difference in the review tab. Until it exists, the step 8
warning tells the reader the agreement has been amended and that the change
is not yet reflected, which is the honest position rather than a silent
one.

---

**Two things worth keeping in view.**

**Only two steps move the count.** Steps 1 to 4 make the product better,
safer and more consolidated, and will leave the outstanding count at 104.
Step 4b moves it substantially, by displaying the 73 provisions whose
analysis is already finished. Step 9 moves the rest, by finishing the four
areas that are genuinely unbuilt. Everything else, including all the search
and market work, is valuable and moves nothing.

That is not a criticism of the other steps. It is a warning against reading
activity as progress toward release. The number is deliberately built to
resist looking better than reality, and it should be checked against this
document rather than inferred from how much work has happened.

**The order of steps 11 and 12 is not negotiable.** Everywhere else, order
is a matter of efficiency. There, doing things in the wrong order causes
silent data loss, which is the one failure this product cannot absorb,
because nobody would notice. Why, in full, is under "Known risks and
limitations", below.

---

## Decisions still needed

| Decision | Needed by | Consequence of delay |
| --- | --- | --- |
| Switching display to the new data, family by family | **Step 4b** | The new analysis stays invisible, and the count cannot move |
| Where source-completeness state is stored | Step 5 | Admin page cannot save anything |
| Permission for the AI to search for missing filings | Step 5 | The page ships with that button disabled |
| Whether market comparison uses original or amended terms | Step 8 | Statistics cannot mix bases honestly |
| Permission to run extraction across the whole corpus | Step 10 | Cannot certify at scale |
| Approval to change the production database | Step 11 | Cannot import |
| Final go-live | Step 12 | This is the last act |

**The first decision needed is at step 4b**, and it is the one that matters
most: permission to start showing the new analysis in place of the old, one
family at a time. Everything before that point is repair and consolidation
and needs nothing from Ben. The same permission, extended to the four
remaining families, is what step 9 needs later; it is one decision covering
both steps, not two.

A further set of smaller decisions is genuinely open and does not block any
numbered step today, but should not be lost:

- **A market-position rank for four provision types** (Made Available,
  Ordinary Course, Material Contracts, General Covenants). No exact rank
  has ever been approved for any of the four. Do not invent one.
- **Whether four specific no-shop concepts should become fully approved.**
  They exist in code and are retained, but have no recorded approval, and
  are part of why 6 items sit on permanent hold rather than counted either
  way.
- **Whether a closed list of representation subjects should exist**, or
  whether the list should stay open-ended indefinitely. Nothing has been
  invented in the meantime, correctly, but the question has not been
  answered either.
- **What to name the new "a human has verified this document" status.**
  Whatever is chosen gets built into a permanent, versioned record format,
  so it is expensive to change once real records exist under it. It must
  describe document-level verification specifically, not corpus
  completeness, or a later corpus-completeness state cannot be added
  without colliding with it. A candidate name exists in the working tree's
  uncommitted, in-progress code (see step 5's technical detail) but has not
  been confirmed by Ben, so treat this as still open.
- **Whether it is worth investigating why four specific comparison
  fields may never actually reach a user** in the current comparison-grid
  tool, independent of anything else in this plan (a deal's appraisal
  facts, a dollar threshold, a dividend fact, and a parent-approval
  mechanism all sit beyond the point the tool currently reads to).
- **A small honesty fix, low priority:** two unrelated provision types
  currently assert an identical, non-distinguishing comparison field. Worth
  correcting for register honesty; fixing it does not clear either one.
- **Two live-infrastructure questions that need direct database access**
  and cannot be answered from the repository: how certain staging records
  were populated, and exactly what a particular database role is granted.
  Ben has deprioritised both; they remain open, not answered.

---

## Known risks and limitations

These are the open, unresolved items with real product or legal
consequence. Where this document has noticed the working tree has moved
further than the source material describes, that is flagged plainly rather
than silently updated, because it has not been independently verified here
(this document does not run the test suite or the build).

### The quotation-fidelity residual

The single most consequential correctness gap currently known in the
product: a lawyer reading a trimmed quote has no signal anything is wrong.
Open until step 1b ships. Mechanism, worked example and the designed fix
are under step 1 and step 1b, above; not repeated here.

### The 19 unprovable locator rows

Of the 73 rows currently marked as unverified in the parity register, 19
have a locator that is neither a module-level binding nor evaluated inside
any function body: 17 are field names inside a single computed lookup table
(`lib/query/render/deal-compare-cell-fields.js`'s `KEY_FIELDS`), one is a
row-spec string in a boilerplate config, and one (`appraisal-governed-review`)
has no candidate evaluation site anywhere, even in principle, without
adding one. None of the 19 can be fixed merely by wiring up a consumer; the
architecture itself is table-driven, deliberately, to avoid a many-branch
switch, and the current proof rule cannot certify a field at that
granularity by design. A related, independent finding: at least four
specific fields in that same lookup table are plausibly never shown in a
live response at all in production today, because every real caller
requests a narrower slice than where those fields sit, regardless of parity
status. Ben deferred the decision on how to handle the 19 (ruling: Operating
rules, "The table-driven locator verifier is deferred"); step 3's
retirement of the surface these rows are pinned to may resolve most of
them by re-registration rather than requiring a new verification instrument
to be built, but this is not guaranteed for all 19, and two of them
(the boilerplate row and `appraisal-governed-review`) are not helped by
that at all.

### The duplicated flag logic

One component (`components/review-v2/CanonicalReviewSection.jsx`) reads its
own environment variable directly and reimplements the enable/disable check
inline, rather than calling the shared, hardened runtime-allowlist function
every other Canonical V2 flag now uses. It is display-only today, and the
real data path is gated elsewhere, so this is not currently a live gap. It
is exactly the kind of duplication that produced the original
production-exposure risk this programme already had to close once. Checked
directly in the working tree while writing this document: still present,
unaddressed.

### The non-deterministic row shaping

`lib/queries/review-deal.js`'s row-shaping function is inconsistent about
whether it stamps explicit `undefined`-valued keys onto a row across
separate calls with identical input. This is a latent source of flaky
byte-identity assertions in tests, recorded but not fixed.

### The three-way data migration ordering

This is the single most important sequencing constraint in this document,
and it must not be reordered.

Three defects are coupled, and the order in which they may be touched is
fixed:

1. **Read-path keying on deal, provision and excerpt together: complete.**
   The live review-page read path now narrows its claim lookup by the
   card's own provision identity rather than trusting a bare excerpt
   reference to be unique.
2. **Write-path claim-id composition: not yet fixed.** The ingestion
   writer mints a claim's identity from the excerpt reference, an
   attribute name and an index, with no provision component, and it
   upserts on that identity. If two sibling cards ever legitimately share
   an excerpt (which the new system's data model allows), a same-attribute
   claim on one can silently overwrite the other at write time, with no
   error, no log and no test failure. Fixing this is not a local edit:
   adding a provision component re-mints every existing claim's identity,
   so it needs a data migration alongside the code change, not a code
   change alone.
3. **Only then, replace the database uniqueness rule.** A bare unique
   index on the excerpt reference alone is still present, unchanged, in
   the production schema.

**Why the order is fixed, not a preference.** (Note: "item 1/2/3" below are
this list's own three items, not the publication steps above.) The index in
item 3 is currently the only thing preventing both item 1's pre-fix failure
mode and item 2's collision from ever firing, because the old excerpt
reference happens to be one-to-one with a card today, so the conditions
that would trigger either defect are never reached. The index is holding
two failure paths shut, not one. **Doing item 3 before item 2 converts a
currently latent write-path defect into silent live data loss:** the
moment the index stops enforcing uniqueness, a real deal with two sibling
cards sharing an excerpt will hit the write-path collision on its next
ingest, and the upsert will destroy a claim with no error, no log and no
test failure, because nothing today exercises that write path with the
index removed. This belongs in the eventual production activation package
as a rehearsed migration (publication step 11), not as a side change, and
remains outside current authority regardless of sequencing, because it
touches production schema.

Checked directly in the working tree while writing this document: the
write-path file is untouched and the database index is still present
exactly as described, so this risk stands as written above, unchanged.

### Other recorded risks worth carrying forward

- **The preview lane is scaffold-shaped.** See ADR-001 (Operating rules),
  Consequences: the preview lane inherits its removal condition and must
  not be mistaken for the eventual native review surface.
- **The dark-authority fence is defensive containment, not end-to-end
  enforcement.** It correctly rejects any record carrying an unauthenticated
  or unserved marker when that record is handed to it directly, but the
  live query and market database selectors do not currently select the
  fields it checks. The real reason nothing leaks today is that no bridge
  sits in the query or database path at all, which is a property of
  today's isolation, not a guarantee that survives activation
  automatically. Every newly served path must wire the fence in
  explicitly; it will not happen by default.
- **The gate is not the primary containment.** The environment-variable
  gate that switches on dark preview machinery is a second layer for the
  integration seam. The mechanism actually keeping these modules inert is
  a separate authority-boundary inventory that scans every proposal-only
  source for database, network, signing, deployment and filesystem-write
  patterns and fails if any appear, together with a rule that such a
  source may have no non-test importer.
- **Bridge receipt provenance on chained merges.** When all four families'
  preview cards are merged into one review deal, three of the four merges
  were documented as replacing rather than appending the shared receipt
  list, silently losing two families' provenance binding when chained
  (card content stays correct; the audit trail does not). This is recorded
  as unfixed in the source material this plan was built from. Checked
  directly in the working tree while writing this plan: the currently
  committed code in all four bridge modules now appends rather than
  replaces, with comments referencing this exact defect by name, though the
  accompanying test coverage for it is itself still being extended,
  uncommitted, at the time of writing. Likely fixed; not independently
  confirmed here by test run. Recheck before relying on it.

---

## Current state

As recorded 2026-08-05, cross-checked directly against the working tree
while writing this document.

**Outstanding product-parity items: 104 total.** Composed of 73 marked
unverified pending real serving proof, 27 marked not visible at all (the
family split is under step 9), 3 with no assigned owner, and 1 held
deliberately at "integrated but not served" behind a contained route.
Separately, 6 items sit on review hold (retained, unadjudicated no-shop
concepts and unsupported claims); these are not counted in the 104 either
way. All 21 primary provision families and all 3 supplemental owners
remain open pending follow-on work. Why the total has not moved through
most of this work is explained under "Two things worth keeping in view",
above.

**Preproduction gates: 25 total, 0 closed.** Two contract-and-vertical-slice
gates plus 23 numbered acceptance gates spanning scope, registry
dispositions, market-statistics work, the release runbook, numeric
handling, render parity, structured claims, party-name linting, shadow
re-extraction, identity and drift, browser accessibility and performance,
staging smoke and rollback, a database soak test, backup and restore,
pre-import traceability, security and authentication, deployment parity,
import parity, promotion eligibility, cutover authorisation, post-cutover
smoke, traceability, and a terminal programme-completion attestation. None
has closed. The security and authentication gate is an explicit
prerequisite for any production credential issuance or use, any inactive
production import, and production activation itself.

**Test suite, last full recorded run:** 6,773 tests, 6,732 passing, 0
failing, 41 skipped. `npm run build` exit 0, 29 of 29 static pages compiled.
Focused suites covering the parity register, the dark-bridge gate, the
cross-family merge regression, the Phase-1 authority-boundary inventory and
the family-agnostic dark-rejection proof are all green on the same bytes.

**What is switched off:** all five search kinds (behind seven contained
503 routes), all three market-statistics routes (503), the Canonical V2
Preview lane in production (structurally off; visible only locally or on a
genuine Vercel preview deployment, behind an environment-bound gate that
cannot evaluate true in production on either of two independent signals),
and anything touching the production database or production credentials.

**What is switched on and working:** all four dark bridges, built, gated,
and unreachable from any served route by construction; the shared
Canonical V2 Preview lane, live on local and Vercel preview, merging all
four families into one review deal without identity collision; the
side-by-side deal comparison on the review page (`?compare=` and
`?market=1`), live in production today on the old data path, independent of
anything above; and four of the five Canonical V2 feature flags now bound
to one shared, hardened runtime allowlist rather than a bare environment
check.

**Working location.** Branch `codex/m3-production-phase1`. The bulk of the
work described in the (now superseded) handoff document, through roughly
its later sections, is committed at `59568f92` ("feat(canonical-v2): M3
preview activation, parity truth and identity fixes"). At the time of
writing this document, the working tree carries further uncommitted work on
top of that commit, touching the review-page comparison-mode fixes (step 2),
the source-completeness state model (step 5), and additional regression
coverage for three of the four dark bridges. None of this has been
independently verified here by running the test suite; the relevant steps
above flag it individually. A fresh session should run `git status` before
relying on any status in this document being final.

**A separate, smaller thread:** the older, first-generation reclassification
scaffold remains not code-ready (its own status is that it fails hostile
review), with no execution authority issued beyond "go, fixtures first"
(ruling: Operating rules, "Earlier standing ruling: v1 reclassification
apply"). It sits outside the twelve steps above.

---

## Three risks recovered from the original record, 2026-08-05

Dropped during consolidation, found by a completeness audit. The first is the
most serious thing on this page.

### The served-set check can over-report, and it feeds the count

The mechanism that decides whether something is displayed walks the code looking
for one file referencing another. That walk is still a **text search, not a
proper parse**. A reference sitting inside a piece of text, a comment, or a
branch that never runs still counts as a real reference.

Everything else in that machinery was deliberately built to fail in the safe
direction: when unsure, it refuses to credit something as displayed. **This one
channel fails the other way.** It can silently credit a surface as displayed
when it is not, which would make the count fall without any work being done.

That is the exact outcome this programme has repeatedly refused to accept. It was
left unfixed deliberately, because upgrading it would move pinned numbers for
reasons unrelated to the change that found it, and that would have muddied a
different piece of work. It should be upgraded to a proper parse as its own
measured change, and the count re-derived before and after so any movement is
visible and explained.

Until then: a fall in the count should be checked against real work, not
assumed.

### A built, tested, deliberately blocked component nobody has been told about

There is a module for derived comparisons: converting currencies and time
periods so two deals can be compared on the same basis. It is fully built and
has passed 38 hostile tests. It is deliberately **not connected to anything**,
and its status is "logic ready, production blocked".

It is blocked for a real reason: a caller can currently hand it a self-authored
trust record and it will accept it. Unblocking needs an approved internal source
of trust, an authoritative source registry, and an approved exchange-rate
authority. None exists.

This matters at two points in this plan. Step 4's comparison work and step 7's
market statistics both touch exactly this problem. Whoever does either will
otherwise rebuild it from scratch, or worse, wire it up without realising it
accepts unverified trust records.

### Two dormant gaps in the display check itself

Two categories of item skip the display check entirely and are recorded as
complete without any proof: those marked retired, and those marked
evidence-only. Neither fires today, because no family consists only of those
categories. It becomes reachable as families are worked through, and the effect
would be a family reading complete with nothing actually proven.

Worth a look when step 9 starts closing families out.
