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
   the data underneath them was being reworked. Not only for that reason,
   though: they were also contained because they load the whole corpus at
   once and that load became a problem. Turning them back on is a build,
   not a switch. See steps 11 and 12.

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
| **73** | The analysis is **finished and approved**. The system reads the clause correctly. But no page displays it yet. | Build a per-family display switch, then use it (step 5) |
| **27** | The analysis itself is **not finished**. These are four areas: Material Contracts, No Other Representations, General Covenants, and Representations. | Finish the analysis, then display it |
| **3** | Parts of the screen nobody has claimed ownership of yet. | Decide who owns them |
| **1** | A calculated figure that is wired up correctly but sits behind a switched-off search route. | Turn the search route on |

**Correction to the first row.** It used to read "wire an existing page to
read the new data". There is no such page waiting to be wired, and the
switch it implies does not exist. See step 5.

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

**The steps were renumbered on 2026-08-05.** An adversarial review checked
this plan's claims against the code and found several of them false. Three
steps changed position as a result: amendment detection moved forward
because it is a live defect rather than future work; search and market moved
to the end because they are builds rather than switches; and the
source-completeness page moved out of the plan altogether, to after launch.
Old and new numbers, so that references in older notes and commit messages
still resolve:

| Old | New | What changed |
| --- | --- | --- |
| 1, 1b, 2, 3, 4 | unchanged | Step 3 is now complete; step 1b turned out to be nearly free |
| 4b | **5** | Split into 5a and 5b; the mechanism it assumed exists does not |
| 5 | **8** | Shrunk to a column and a banner; the admin page is deferred to after launch |
| 6 | **11** | Moved last; it is a rewrite of seven routes, not a flag flip |
| 7 | **12** | Moved last, with it |
| 8 | **6** | Moved forward; it is a live defect, not planned work |
| 9 | **7** | Moved up behind the display work |
| 10 | **9** | Unchanged in substance |
| 11 | **10** | Rewritten; the ordering constraint it asserted was false |
| 12 | **13** | Unchanged in substance |

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
today. Step 1b turns out to be nearly free: the code that computes those
positions is already written and already switched off. See step 1b.

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

**What.** Switch on the code that records the exact position of every quote
in the document, not just the words, and store what it produces.

**Correction, 2026-08-05.** This step was previously written as a change to
the extraction step: new work, a prompt or model concern, and a blocker for
the display work. That was wrong on all three counts. The code already
exists, it is deterministic and involves no model at all, and it is
switched off. This step is a flag flip, two nullable columns and a backfill
over 40 deals. It is one of the cheapest items in this plan, and it does
not gate the display work.

**Why it matters.** It closes the gap in step 1 completely, rather than
partially. It also becomes necessary for the amendment parsing deferred
until after launch: once a deal has both an original agreement and an
amendment, "this text appears in the source" is meaningless without
knowing which source and where.

**Done when.** Every quote carries its position, and every downstream check
verifies against that position rather than searching for the text.

**Needs from Ben.** Nothing.

#### Technical detail

`lib/parser-v2/span-claims.js` is already written and already does the job.
It runs strictly after extraction against text the model has already
produced, states in its own header comment that it involves "no LLM, no
prompt changes", locates an item's text through a three-pass locator
(exact substring, then a whitespace-tolerant regex, then the same regex
against the head of the text to recover a truncated model quote), and
raises a `spanUnlocated` flag when the text cannot be found in the source
at all, which is the hallucination surface. It is gated at
`lib/parser-v2/extract.js:102` behind `opts.spanClaims !== true`, and no
caller passes that option, so it is inert in the ingest path today. The
work is therefore: pass the option, add nullable start and end columns,
backfill 40 deals, and wire the offset-verification rule from step 1 to
read them.

**A related risk that is sharper than the one this step closes.** Offset
columns already exist on the card table, `primary_quote_start` and
`primary_quote_end`, and they are populated and wrong.
`lib/parser-v2/resolve-source-span.js:26-35` records the finding directly:
those offsets are computed relative to the card's own excerpt rather than
the deal's full text, falling back to `{0, quote.length}` when even that
lookup fails, and, verified against live data, they "essentially never
address the right span". The live read path already treats them as an
optimistic guess and falls through a defensive chain rather than trusting
them. Populated-but-wrong offsets are worse than absent ones: absent
offsets fail closed, wrong ones invite a downstream consumer to trust them.
Whatever this step writes must not be confused with those columns, and the
old columns should be either corrected or explicitly marked untrustworthy
in the same change.

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

### Step 3. Retire the duplicate comparison page: COMPLETE

**Status: done and committed**, at `61d7280c` ("feat: retire duplicate
compare surfaces, harden quote grounding, consolidate plan"). `pages/compare.js`
no longer exists in the tree, and the parity register no longer references
it or the cell-fields module anywhere. Earlier versions of this document
described this step as forthcoming. It is not; it has shipped. The text
below is kept as the record of what was done and why.

**What.** There were two separate implementations of deal comparison. One
is the review page with extra columns. The other was an older standalone
page which nothing linked to, no test covered, and which read a rougher,
uncurated copy of the data. The old one was retired, along with the two
search modes that merely redirected into the new one.

**Why it matters.** Two implementations of the same thing drift apart. That
has already caused three separate faults in this codebase, including one
where two parts of the product disagreed about whether to show unverified
data.

There was also a large hidden benefit, and it landed. Seventeen of the
outstanding items were recorded against the old comparison code and are now
re-pointed at the new comparison view, which has no field limit. That
dissolved most of an open technical question rather than requiring it to be
answered: see "The unprovable locator rows", under Known risks and
limitations, below, where the count is now 2 rather than 19.

**Done.** The old page is gone, the records point at the new view, and the
outstanding count still reads 104, verified. It did not fall, correctly.
Those items are not finished; only the place they refer to has changed.

**Needed from Ben.** Was already approved (ruling: Operating rules, "The
comparison and search product shape").

#### Technical detail

The old page was `pages/compare.js` (2,414 lines): zero inbound links
anywhere in navigation, zero tests, and built on the raw `provisions` table
rather than the curated, deduplicated `provision_cards` table the review
page uses, so it was also the less trustworthy surface. The two search
modes were the `DEAL_COMPARE` and `DEAL_TO_MARKET` query kinds;
`pages/query/[kind]/[id].js` already computed their results and immediately
redirected to `/review/<id>?compare=` or `?market=1`, discarding everything
else, so the decision was already half-shipped in practice before it was
taken.

The 17 rows were registered against `lib/query/render/deal-compare-cell-fields.js`
(its top-level `KEY_FIELDS` literal), which existed solely to feed
`DEAL_COMPARE`. They were unprovable there because the field lookup was a
table-driven, computed access with no per-field branch for the current
proof rule to find. That file now appears zero times in the parity
register.

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
compares across the whole corpus, filterable. That last part cannot be
built here, because market statistics are switched off and now come last in
the sequence. It moves with them, to step 12.

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
not simply a second call. None of it can be built until market statistics
are actually serving, since every market route is currently a 503 stub, so
the sidebar is deferred to step 12 and the rest of this step proceeds
without it.

### Step 5. Show the new data on the review page

**Renumbered from step 4b, and the old description of it was wrong.** This
step used to say it was "wiring an existing page to read the better data,
not new analysis". There is no page waiting to be wired, and the mechanism
the step assumed already exists does not exist. Canonical serving today is a
single whole-deal block, `CanonicalReviewSection`, rendered once in
`pages/review/[id].js` alongside the legacy sections. The flag that enables
it, `NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED`, is all or nothing: when it is
on, the legacy market columns are stripped from every family at once. There
is no per-family switch, which is precisely what Ben's permission is phrased
around. The mechanism has to be built before it can be used.

**What.** Display the new system's output for the 73 provisions whose
analysis is already finished and approved. In two parts.

**Step 5a. Build the per-family switch and an equivalence harness, proven on
one family.** Replace the single all-or-nothing flag with a per-family
choice, and build a harness that demonstrates, for the family being
switched, that the new display says the same thing as the old one before the
old one stops being shown. Prove both on exactly one family before touching
a second.

**Step 5b. Roll the remaining families through it.** Once the mechanism is
proven, take the rest through the same route.

**Expect 5a to overrun.** Of everything in this plan, 5a is the item most
likely to take three times as long as it looks. It is a new mechanism, not a
switch, and the equivalence harness is the part that has to be trustworthy,
which is much harder than making it exist. Budget for that rather than being
surprised by it.

**Batch 5b.** If 5a's mechanism turns out to be genuinely generic, take the
remaining families through in batches. Doing them one at a time when the
mechanism already generalises is repetition, not caution.

**Why it is here and not later.** An earlier draft of this plan put all the
display work near the end, after the search tools. That was wrong, and Ben
caught it. Only one of the 104 outstanding items depends on the search tools
being switched on. The other 103 do not.

Three reasons this belongs early:

- The review page is the surface people actually use. Until the new data
  appears there, none of the rest of the work is visible.
- Building search tools over the old data and migrating them afterwards is
  doing the work twice.
- If the new analysis is wrong anywhere, the review page is where it would
  be noticed. Finding that out before building on top of it is cheaper.

**Why it is not step 1.** It depends on the quotation work in step 1,
because displaying a quote that might be trimmed is worse than not
displaying it. It does not depend on step 1b: that step is nearly free and
will have landed already. Everything else before this step is either a live
fault or a consolidation that would otherwise have to be redone.

**Done when.** Those 73 provisions are read from the new system by a real
page, each proven by tracing the full path from page to value, and the
outstanding count falls accordingly. This is the first step where the number
moves, and the first where users would see a difference.

**Needs from Ben.** Permission to switch the display over, family by family
rather than all at once. Note that until 5a is built the permission cannot
be exercised even once given, because there is nothing to switch family by
family.

#### Technical detail

The 73 sit under the `NATIVE_UNVERIFIED` disposition in the parity
register: the underlying legal analysis already carries a terminal, approved
disposition, and the gap is purely a missing served consumer. This is the
more mechanical half of step 7's precondition (see that step): it still
needs a real, non-contained route importing the exact projection, satisfying
both the adapter-proof and locator-proof rulings (Operating rules), but it
does not need new legal-analysis work first, which is what distinguishes it
from the 27 handled in step 7. Note the 2 rows described in Known risks and
limitations, below (the unprovable locators): a small part of the 73 cannot
be cleared by wiring alone, for the separate reason given there.

The legacy display path for a family stays alive and working until
equivalence is proven for that family, per the standing constraint in the
operating rules. The harness built in 5a is what proves it. Switching a
family off because native code exists is not the same as proving it produces
the same answer.

### Step 6. Detect amendments and say so

**This is a live defect, not future work, and that is why it has moved.** It
was previously step 8, near the end of the plan, written as work still to be
scoped. That framing was wrong. The product can already ingest a restatement
and present it as the original agreement, silently, today. It now sits
immediately after the display mechanism, because shipping display over data
that may be the wrong document is worse than shipping neither.

**The mechanism, precisely.** `lib/edgar-catalog.js` picks a deal's
agreement by scoring candidate exhibits with regular expressions. The title
"AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER" contains the phrase
"agreement and plan of merger", so it scores identically to an original.
`chooseAgreementExhibit` then returns whichever candidate ranks top, with no
tie check and no ambiguity guard. The file contains no reference to
amendment or restatement anywhere in it. This is not a weak detector that
needs tightening. There is no detector.

**What.** A deal is not one document. A later filing may be a complete
restated agreement or an amendment changing specific clauses. Ben's decision
is to split this work either side of launch.

**Before launch, detection only.** Work out whether a filing is a fresh
agreement, a restatement or an amendment, and where a deal has an amendment
we have not yet processed, show that plainly on the deal: "this agreement
has been amended; the amendment is not yet reflected here."

**After launch, the parsing.** Working out exactly what an amendment changed
and showing the difference in the review tab is deferred, along with export.

**Why the split.** Going live without any amendment handling would mean an
amended deal silently displays superseded terms. A termination fee that was
renegotiated would read as the original, with nothing to warn the reader.
That is the same "confidently wrong" failure the quotation work exists to
prevent.

Detection is a small fraction of the work of parsing: it classifies a filing
rather than comparing two documents. It converts a silent error into a
visible caveat, which is the honest minimum for launch. It also sits
naturally beside the source-completeness warning from step 8: "nobody has
confirmed we have every document" and "we know there is an amendment we have
not processed" are the same kind of statement, shown in the same place.

Only one deal in the corpus is currently known to have an amendment, so
today's exposure is small. That is a statement about today's corpus, not
about the detector, which would misread a restatement in any corpus. The
corpus grows, and amendments are common in practice.

**Done when.** Filings are classified correctly, anything ambiguous goes to
a human rather than being guessed, and any deal with an unprocessed
amendment carries a visible warning.

**Needs from Ben.** One judgement, and it is only needed when parsing is
built after launch: when a term is amended, which value counts for market
comparison, the original or the amended one? Both are defensible, and the
statistics must pick one deliberately and label it rather than silently
mixing the two.

#### Technical detail

The scoring function is `exhibitScore` in `lib/edgar-catalog.js`, and the
selection is `chooseAgreementExhibit`, which sorts by score and returns
`ranked[0]` with no ambiguity handling. Two fixes are needed and they are
separable: score the amendment and restatement vocabulary explicitly, and
refuse to choose at all when the top two candidates are close enough that
the choice is arbitrary.

Classification must fail closed, using signals such as the title ("AMENDED
AND RESTATED AGREEMENT AND PLAN OF MERGER" versus "AMENDMENT NO. 1 TO..."),
whether a full article structure is present, document length, and operative
language such as "is hereby amended to read as follows"; ambiguous cases go
to human review, not a guess. This classification is the whole of the
pre-launch scope. A full restatement is stored as its own agreement, linked
to its predecessor by an explicit relationship and effective date, with
extraction run normally.

The deferred, post-launch parsing work: an amendment expresses operations
(restate a section, delete and substitute words, insert or delete a
subsection, amend a defined term or a schedule), not prose, and parsing must
capture the target reference, the operation and the new text, failing closed
when the target cannot be resolved unambiguously. Two representations are
expected to be needed: a delta view answering "what changed" (the display
artefact) and a materialised effective text answering "what does the
agreement say now" (the extraction input); storing only one loses the
other's job. The failure mode to design against is silently overwriting
base-agreement provisions; supersession must be explicit and additive so the
original stays readable and citable.

This connects to two pieces of work already done or designed elsewhere: the
card-identity ruling (Operating rules) already requires identity to bind the
source revision, anticipating a second source document per deal; and the
offset-based quote verification in step 1b becomes more important once a
quote must be attributed to a specific document among two, which matters
most once parsing (not just detection) is built. Metsera is the only deal
currently known to carry an amendment, and is the natural first fixture.
This is also where the corpus-completeness state from step 8 and amendment
detection meet: a new amendment appearing is exactly the event that should
revoke a prior human completeness verification, and should drive that state
rather than sit beside it unconnected.

### Step 7. Finish the four unbuilt areas and display them

**Renumbered from step 9.** The content is unchanged.

**What.** Finish the analysis for the four areas where it is genuinely not
done yet, then display them. Those four are Material Contracts, No Other
Representations, General Covenants and Representations, accounting for 27 of
the outstanding items. Step 5 already displayed the 73 whose analysis was
finished.

This step is therefore real analysis work, not wiring. That is the
difference between it and step 5, and it is why the two are separated: one
is a switch-over, the other is building something that does not exist yet.

**Why it matters.** These four are the last areas still served entirely by
the old system. Until they are done, the product runs on two systems at
once.

**Done when.** All four areas are analysed by the new system and displayed,
proven the same way as step 5, and the outstanding count reaches zero apart
from the three unowned screen areas and anything held for review.

**Needs from Ben.** The same family-by-family permission as step 5, and it
is the same single decision covering both steps.

#### Technical detail

The 27 split as Material Contracts 8, No Other Reps/Fraud 7, General
Covenant Router 7, Representations 5. Clearing any one needs two
independent, real things at once: the evidence record reaching a terminal
disposition (all 27 are currently open, with no follow-on outstanding
resolved), and a consumer that a live, non-contained route actually reaches,
importing the exact projection, satisfying both the adapter-proof and
locator-proof rulings (Operating rules). A dark bridge by itself clears none
of these by construction: it is a precondition for serving, never evidence
of it, and this was proven in practice when three bridges landed and the
blocker count did not move. The architectural boundary that governs this
step is ADR-001 (Operating rules, in full): native serving must consume the
new projections directly, never the bridged, flattened preview cards.

### Step 8. Source completeness: a column and a banner

**Correction: the admin page is deferred, and this step shrinks to almost
nothing.** Earlier text put a full admin page in the pre-launch plan. That
was disproportionate. The state is advisory by ruling: it blocks nothing,
fences nothing and gates no route. The corpus is 40 deals, which Ben curated
himself, so there is no scale problem for a page to solve. Before launch, a
column recording what a human concluded and a banner showing it wherever the
data is used are sufficient. The page moves to "Deferred until after
launch", where it belongs.

**What.** A filing is verified when its text is confirmed to match what was
published. That is already built and independently double-checked. What is
not built is a way to record whether a human believes we have *all* the
relevant documents for a deal: the original agreement, any amendments, any
restatements.

Ben's design: a filing counts as verified on its own merits, with a health
warning shown alongside it saying no human has confirmed the document set is
complete. That lets work proceed. Separately, and now after launch, an admin
page where a reviewer confirms the set is complete, or says it is not and
asks an AI to go and find what is missing.

**Why it matters.** Document sets are never provably complete: another
amendment can always appear. Treating completeness as something a person
judges and can revise, rather than something the system proves, is both more
honest and far simpler to build.

**Done when.** The state model exists (done), a column stores what a human
concluded, and a banner surfaces it wherever the data is used.

**Needs from Ben.** One thing before launch: where that state is stored,
which has not been decided. The separate permission for the "go and find it"
button is no longer needed before launch, because the button ships with the
page, after launch.

#### Technical detail

The health warning is strictly advisory: it must never block, fence or
refuse anything, and must not be modelled the way the dark-authority fence
is modelled (`lib/query/dark-authority-fence.js`, which legitimately does
reject records, but over a different axis, source authentication, not corpus
completeness). The state vocabulary should stay limited to what a human
concluded (not yet verified, verified, or believed incomplete); whether an
AI was ever instructed to look for more documents is a workflow action, not
a state the corpus holds.

When the page is eventually built, it belongs alongside the existing
`pages/admin/` family (registry, candidates, gaps, ingest-runs, agreements,
taxonomy, review-queue, schema-loss, processing-flow, reconciliation,
reports) and should follow its conventions. The "go and find it" step is
extraction, which remains unauthorised; the capture function
(`corpus-source-discovery-capture.js`) currently refuses unconditionally and
correctly.

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

### Step 9. Certify the whole corpus

**Renumbered from step 10.** The content is unchanged.

**What.** Run the new system across every deal, not just the test set, and
check quality, consistency, performance and the ability to roll back.

**Why it matters.** Everything so far has been proven on a handful of
agreements. This proves it at full scale, where the awkward cases live. It
also produces the first corpus-wide state against which a real-data baseline
for search and market can be taken, which is why those two steps now follow
it rather than precede it.

**Done when.** The certification gates pass on the full corpus.

**Needs from Ben.** Nothing further. Permission to run extraction was given
on 2026-08-05 (ruling: Operating rules, "Extraction authorised for Canonical
V2 production"). Production data, real credentials and candidate import stay
prohibited, so where the output lands must be settled before any run.

The ruling carries a condition worth repeating here, because it decides the
order: extracting the whole corpus today would guarantee a second pass. Only
3 of roughly 12 legacy termination-fee fields have a governed V2 counterpart,
so a corpus run against today's claim definitions buys three fields at scale
and leaves the rest exactly as they are. Prove the display switch and the
equivalence harness on the deals that already carry canonical data, read off
which fields differ, widen the definitions where a ruling allows, and then
extract once.

#### Technical detail

This is the P9 stage of the programme. All 25 preproduction gates are
currently open (full list under "Current state", below). Most directly
load-bearing for this step specifically: the render-parity and
structured-claims gates (does a native surface actually reproduce what the
legacy card shows), the identity-and-drift gate, and the security and
authentication gate, whose acceptance criteria are an explicit prerequisite
for any production credential issuance or use, any inactive production
import, and production activation itself.

### Step 10. Pin the excerpt-identity invariant and fix the duplicate claim ids

**Correction, and it retracts the most emphatic claim this document ever
made.** This step used to describe three data corrections that had to happen
in a fixed order, and warned that doing the third before the second would
turn a hidden fault into silent live data loss. It was marked
non-negotiable, and it was called the single most important sequencing
constraint in the plan. It was wrong. The collision it described cannot
happen, and the migration it warned against would not even execute.

Why, precisely, so nobody reinstates it:

- `lib/schema/provision-card.js:34-37` builds an excerpt reference as
  `${provisionId}:${index}`. Nothing anywhere in the codebase sets a
  non-zero index; the sole call site takes the default, 0. The database
  migration asserts exactly the same thing:
  `supabase/schema-04-provision-card-canonical.sql:25` sets
  `excerpt_id = provision_instance_id || ':0'`.
- It follows that two cards sharing an excerpt reference necessarily share a
  provision identity, which means they are the same row, merged long before
  any claim is written against them. The scenario the old text described,
  two sibling cards quoting the same sentence colliding at write time, is
  unreachable by construction, not merely unlikely.
- And the migration that was supposed to be dangerous cannot run at all.
  `supabase/schema-05-claims.sql:35` declares
  `excerpt_id text NOT NULL REFERENCES public.provision_cards(excerpt_id)`.
  Postgres refuses to drop a unique index that a foreign key depends on, so
  the third step errors immediately regardless of what order it is attempted
  in.

**What this step is now.** Small. Pin `excerpt_id === provision_instance_id
+ ':0'` as a tested invariant, so that if anyone ever starts minting a
non-zero index the test fails loudly and the question can be reopened
deliberately rather than discovered in production. Leave the indexes alone.

**The real defect in the same area, which the old text missed entirely.**
Claim ids are minted two different ways. `scripts/backfill/claims-from-normalized.js:293`
writes the normaliser's own triple id. `lib/parser-v2/store-claims.js:229`
mints `sha256(excerpt|attribute|index)`. The same logical claim therefore
gets a different id depending on which path wrote it, so re-materialising a
deal that was previously backfilled mints a fresh id rather than updating
the existing row, and produces duplicates. This is reachable today, unlike
the defect that used to be described here, and it is the thing this step
actually has to fix.

**Done when.** The invariant is pinned by a test, the two minting schemes
are reconciled to one, re-materialising a backfilled deal is idempotent, and
any duplicates already present in the data are identified and cleared.

**Needs from Ben.** Approval to touch production data, if duplicates exist
there and have to be cleared. No production schema change is required, which
makes this a materially smaller ask than the version of this step it
replaces.

### Step 11. Turn search back on, in preview

**Correction: this is not a flag flip, and it moves to the end.** Earlier
text treated the search routes as built and simply switched off, so turning
them on read as near-free. Two things are wrong with that.

First, the routes were contained for a reason.
`lib/query/contained-routes/run.js:44` calls a full-corpus context fetch,
wrapped in an emergency containment guard with a concurrency cap and a
circuit breaker. Turning search on reinstates exactly the load pattern that
caused the containment in the first place. That is a capacity problem to be
solved, not a switch to be thrown.

Second, there is no green baseline to turn on against. Nothing has run
against real data since 2026-07-18. The demo-set test is an offline
structural check, and the market tests run against a stubbed database, so a
green suite today says nothing at all about whether search works on the
corpus.

The work itself is a rewrite of seven route files, plus edits to six test
files that currently assert the 503. It is done last, after the display work
and after certification has produced a corpus-wide real-data state worth
baselining against.

**What.** Five search tools exist and are switched off: comparing named
deals, one provision across every deal, the range of a value across the
market, filtering deals by criteria, and a plain-English question box that
routes to the right one. Turn them on in the test environment only.

**Why it matters.** "One provision across every deal" is the precedent
library view, and is arguably the single most valuable thing the product
does. It is built and currently unreachable.

**Done when.** The search routes answer in preview against real data,
production stays off, and each one is checked against real data rather than
assumed to work.

**Needs from Ben.** Nothing. Production activation is a separate later
decision.

#### Technical detail

All five kinds run through seven route files (`/api/query/run`,
`/api/query/interpret`, `/api/query/field-options`, `/api/query/demo-set`,
`/api/query/kinds`, `/api/saved-queries`, `/api/canonical-v2/query`) that
are currently three-line 503 handlers defined by `lib/query-containment.js`.
This is also what keeps `termination-fee-query-derived-values` at
`DERIVED_INTEGRATED_NOT_SERVED` rather than visible (the ruling recorded in
Operating rules). The approved surviving shape (also Operating rules) keeps
provision cross-cut, what's-market, screen-and-filter and the
natural-language router as live destinations; deal-versus-deal comparison is
already served separately through the review page (steps 3 and 4).

The approved activation order is preserved by this renumbering: the trusted
source-admission boundary (step 8) still precedes search, and search still
precedes market (step 12). What has changed is that both now sit after the
display work and after certification, because neither is the cheap switch
the earlier ordering assumed.

### Step 12. Turn market statistics back on, in preview

**Correction: same as step 11.** The market routes are contained for the
same reason and carry the same absence of a real-data baseline. The market
tests specifically run against a stubbed database, so their being green
proves nothing about live behaviour. This is a build, done last, not a
switch.

**What.** The market statistics routes are also switched off. The machinery
behind them is substantial and already handles the hard part: deciding which
other deals are genuinely comparable, by matching the basis and the timing of
a term rather than lumping all deals together.

Once on, add the two-scope view Ben asked for, deferred here from step 4:
how a term compares within the deals currently being compared, and how it
compares against the whole corpus.

**Why it matters.** "What's market" is the question clients ask. This is the
part of the product that answers it.

**Done when.** Statistics answer in preview against real data, and the
comparison view shows both scopes.

**Needs from Ben.** Nothing.

#### Technical detail

`/api/corpus-stats`, `/api/corpus-stats-batch` and `/api/market-stats` are
all currently three-line 503 stubs. The cohort machinery in
`components/review-v2/marketSummaryHelpers.js` is built but unreachable.
Peer-comparability filtering (by basis, semantics and cadence) already
exists; what is missing for step 4's dual-scope sidebar is only scoping the
peer set to the current comparison, which depends on this step rather than
being a standalone build.

### Step 13. Import and go live

**Renumbered from step 12.** The content is unchanged.

**What.** Load the new data into production without switching to it, check
it matches, then switch over as a single act with a tested way back.

**Why it matters.** This is the point of no return, and it should be boring
because everything above made it boring.

**Done when.** The product serves the new data and the old path can still be
restored.

**Needs from Ben.** Explicit one-time authorisation. This is the "go public"
decision.

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

**Deferred until after launch.** Three pieces of work sit deliberately after
go-live. Two are on Ben's instruction; the third was moved out of the
pre-launch plan on 2026-08-05 because it was disproportionate to the problem
it solves. None blocks release, and none carries a correctness risk at
launch, because step 6's detection warning covers the amendment case.

**Export to Excel and PDF.** Purely additive. Nothing in the product
exports anything today, so this is a genuine build rather than a port. It
is what makes large comparisons useful, since nobody reads fifty columns in
a browser.

**Amendment parsing.** Working out precisely what an amendment changed and
showing that difference in the review tab. Until it exists, the step 6
warning tells the reader the agreement has been amended and that the change
is not yet reflected, which is the honest position rather than a silent
one.

**The source-completeness admin page.** Previously in the pre-launch plan,
as its own step. Moved here. The completeness state is advisory by ruling
and blocks nothing, and the corpus is 40 deals Ben curated himself, so a
dedicated page for managing that state solves a problem the product does not
have yet. A column and a banner, which is what step 8 now is, are enough
before launch. Build the page when the corpus is large enough to need it.

---

**Two things worth keeping in view.**

**Only two steps move the count.** Steps 1 to 4 make the product better,
safer and more consolidated, and will leave the outstanding count at 104.
Step 5 moves it substantially, by displaying the 73 provisions whose
analysis is already finished. Step 7 moves the rest, by finishing the four
areas that are genuinely unbuilt. Everything else, including all the search
and market work, is valuable and moves nothing.

That is not a criticism of the other steps. It is a warning against reading
activity as progress toward release. The number is deliberately built to
resist looking better than reality, and it should be checked against this
document rather than inferred from how much work has happened.

**Correction: this document used to claim a non-negotiable ordering
constraint. There is no such constraint.** Earlier versions said the order
of the production data steps was fixed, that reversing it would cause silent
live data loss, and that this was the single most important sequencing
constraint in the plan. It was false. The collision it protected against is
unreachable by construction, and the migration it warned about would be
refused by the database before it could do any harm. The full retraction,
with the code and schema that disprove it, is in step 10 and again under
"Known risks and limitations", below. Do not reinstate it. Order everywhere
in this plan is now a matter of efficiency and risk appetite, not safety.

---

## Decisions still needed

| Decision | Needed by | Consequence of delay |
| --- | --- | --- |
| Switching display to the new data, family by family | **Step 5** | The new analysis stays invisible, and the count cannot move |
| Where source-completeness state is stored | Step 8 | The column has nowhere to live |
| Whether market comparison uses original or amended terms | Step 6, and only when parsing is built after launch | Statistics cannot mix bases honestly |
| Approval to clear duplicate claim rows in production data | Step 10 | Duplicates stay, and re-materialisation keeps adding to them |
| Final go-live | Step 13 | This is the last act |
| **GRANTED 2026-08-05:** permission to run extraction across the corpus | Step 9 | No longer blocking; see step 9 for why the order still matters |

Two rows have left this table. Permission for the AI to search for missing
filings is no longer needed before launch, because the page that carries
that button is deferred until after launch. Approval to change the
production database is no longer needed at all, because step 10 no longer
proposes a schema change; see the retraction recorded there.

**The first decision needed is at step 5**, and it is the one that matters
most: permission to start showing the new analysis in place of the old, one
family at a time. Everything before that point is repair and consolidation
and needs nothing from Ben. The same permission, extended to the four
remaining families, is what step 7 needs later; it is one decision covering
both steps, not two. Note that the permission cannot be acted on until step
5a has built the per-family switch it presumes.

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
  uncommitted, in-progress code (see step 8's technical detail) but has not
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

### The 2 unprovable locator rows

**Correction: this document said 19. The correct figure is 2.** The number
19 was measured before step 3's retirement re-pointed those rows at the new
comparison view, and it was left standing after the re-pointing had already
happened. It has not been 19 for some time.

Of the 73 rows currently marked as unverified in the parity register, 2 now
have a locator that is neither a module-level binding nor evaluated inside
any function body. One is a row-spec pointer into a serving-registry data
file (`remedies-query-registry`, whose locator is a JSON pointer rather than
a symbol), and one (`appraisal-governed-review`) has no candidate evaluation
site anywhere, even in principle, without adding one. Neither can be fixed
merely by wiring up a consumer.

The other 17 were field names inside a single computed lookup table,
`lib/query/render/deal-compare-cell-fields.js`'s `KEY_FIELDS`, which existed
solely to feed the retired `DEAL_COMPARE` kind. That file now appears zero
times in the parity register, verified. The re-registration resolved them,
exactly as Ben predicted it might when he deferred building a new
verification instrument (ruling: Operating rules, "The table-driven locator
verifier is deferred"). The two that remain are the two that were flagged at
the time as not helped by re-registration, and they are still not.

A related, independent finding survives the correction: at least four
specific fields in that former lookup table were plausibly never shown in a
live response at all in production, because every real caller requested a
narrower slice than where those fields sat, regardless of parity status.

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

### RETRACTED: the three-way data migration ordering

**This risk was false, and it was the most emphatic thing in this
document.** It claimed three coupled defects had to be corrected in a fixed
order; that removing a database unique index before fixing the write-path
claim-id composition would convert a latent fault into silent live data
loss; and that this was the single most important sequencing constraint in
the plan. Every load-bearing part of that is wrong. It is retracted here
rather than quietly deleted, so that a future reader who half-remembers it
finds the refutation instead of the claim.

**Why the collision cannot happen.** `lib/schema/provision-card.js:34-37`
composes an excerpt reference as `${provisionId}:${index}`. Nothing in the
codebase sets a non-zero index; the sole call site takes the default, 0.
The schema migration asserts the same thing independently:
`supabase/schema-04-provision-card-canonical.sql:25` sets
`excerpt_id = provision_instance_id || ':0'`. So two cards sharing an
excerpt reference necessarily share a provision identity, which means they
are the same row and were merged before any claim was ever written against
them. "Two sibling cards legitimately share an excerpt" describes the
normalised model in the abstract, not the data this code produces. The
collision is unreachable by construction.

**Why the dangerous migration would not run anyway.**
`supabase/schema-05-claims.sql:35` declares
`excerpt_id text NOT NULL REFERENCES public.provision_cards(excerpt_id)`.
Postgres refuses to drop a unique index that a foreign key depends on. The
third step would error immediately, in any ordering, before touching a
single row. The catastrophe it warned about is not merely improbable; the
database will not permit the operation that was supposed to cause it.

**What is actually true in this area, and was missed.** Claim ids are minted
two different ways. `scripts/backfill/claims-from-normalized.js:293` writes
the normaliser's own triple id; `lib/parser-v2/store-claims.js:229` mints
`sha256(excerpt|attribute|index)`. The same logical claim therefore carries
a different id depending on which path produced it, so re-materialising a
deal that was previously backfilled mints a new id instead of updating the
existing row, and leaves a duplicate behind. This is reachable today, on
real data, with no schema change involved. It is now step 10.

**What replaces the ordering rule.** Nothing needs ordering. Pin
`excerpt_id === provision_instance_id + ':0'` as a tested invariant, leave
the indexes alone, and fix the duplicate claim ids. All three are
independent.

### The existing quote offsets are populated and wrong

Two offset columns already exist on the card table, `primary_quote_start`
and `primary_quote_end`, and they hold values that do not address the right
text. `lib/parser-v2/resolve-source-span.js:26-35` records the finding
directly: the offsets are computed relative to the card's own excerpt rather
than the deal's full text, fall back to `{0, quote.length}` when even that
lookup fails, and, verified against live data, "essentially never address
the right span". The live read path already works around them, treating them
as an optimistic first guess and falling through a defensive chain rather
than trusting them.

This is worse than having no offsets. Absent offsets fail closed. Wrong ones
invite the next consumer, who will not have read that comment, to trust
them. Step 1b writes correct offsets; it must not be confused with these
columns, and these columns should be either corrected or explicitly marked
untrustworthy in the same change.

### The preview lane is frozen

**Decision, 2026-08-05: no further work goes into the fixture-fed preview
lane.** Not a deletion, a freeze. It stays where it is, gated, doing what it
already does.

The reason is structural, not a judgement about quality. The preview lane is
fed by fixtures rather than by a served route, so nothing done to it can
ever clear a parity blocker or move the count, by construction. That was
already established in practice when three bridges landed and the count did
not move. Native serving is the only route that can move it, and it is a
different piece of work.

Improving the preview therefore looks like progress and is not. Anyone
tempted to polish it should be building the per-family switch in step 5a
instead.

### Other recorded risks worth carrying forward

- **The preview lane is scaffold-shaped.** See ADR-001 (Operating rules),
  Consequences: the preview lane inherits its removal condition and must
  not be mistaken for the eventual native review surface. Now also frozen;
  see above.
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
family split is under step 7), 3 with no assigned owner, and 1 held
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
four families into one review deal without identity collision, and now
**frozen** (see "The preview lane is frozen", above: it is fixture-fed, so
no work on it can move the count); the side-by-side deal comparison on the
review page (`?compare=` and `?market=1`), live in production today on the
old data path, independent of anything above; and four of the five
Canonical V2 feature flags now bound to one shared, hardened runtime
allowlist rather than a bare environment check.

**What has shipped since this document was first written:** the duplicate
comparison page and the two redirecting search kinds are retired, at
`61d7280c`. `pages/compare.js` is gone and the parity register no longer
cites it or the cell-fields module. Step 3 is complete.

**Working location.** Branch `codex/m3-production-phase1`. The bulk of the
work described in the (now superseded) handoff document, through roughly
its later sections, is committed at `59568f92` ("feat(canonical-v2): M3
preview activation, parity truth and identity fixes"). At the time of
writing this document, the working tree carries further uncommitted work on
top of that commit, touching the review-page comparison-mode fixes (step 2),
the source-completeness state model (step 8), and additional regression
coverage for three of the four dark bridges. None of this has been
independently verified here by running the test suite; the relevant steps
above flag it individually. A fresh session should run `git status` before
relying on any status in this document being final.

**A separate, smaller thread:** the older, first-generation reclassification
scaffold remains not code-ready (its own status is that it fails hostile
review), with no execution authority issued beyond "go, fixtures first"
(ruling: Operating rules, "Earlier standing ruling: v1 reclassification
apply"). It sits outside the thirteen steps above.

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

This matters at two points in this plan. Step 4's comparison work and step 12's
market statistics both touch exactly this problem. Whoever does either will
otherwise rebuild it from scratch, or worse, wire it up without realising it
accepts unverified trust records.

### Two dormant gaps in the display check itself

Two categories of item skip the display check entirely and are recorded as
complete without any proof: those marked retired, and those marked
evidence-only. Neither fires today, because no family consists only of those
categories. It becomes reachable as families are worked through, and the effect
would be a family reading complete with nothing actually proven.

Worth a look when step 7 starts closing families out.
