# P1: making the termination fee family serve real data

Written 2026-08-05 after a full evidence sweep of tonight's live run, the resolver
code and its tests, the sectionizer, the projection layer, and the family's own
design spec. This replaces guessing with reproduction: every claim below either
cites a committed evidence file or was independently re-derived this session by
running the actual deterministic code against the actual committed fixture, not
assumed from the run's own summary text.

This is a revised draft. An adversarial review reproduced this plan's own
experiments and checked its claims directly. One claim was false: the
section-boundary defect the old Lane SEC was built on. It is retracted below,
in place, not deleted, because a wrong claim in this programme has already
resurfaced once after a quiet deletion. Everything else the review checked
held up. The corrections below tighten acceptance criteria to match what was
actually measured, not what would be convenient.

## How to read this

Same convention as `ROADMAP.md`. Each numbered step has two parts:

1. **What it is.** Plain English, no internal names.
2. **Technical.** File paths, what "done" means, cost, and what could go wrong.

One note on provenance, updated for this revision:
`lib/canonical-v2/native-producer/candidate-resolution.js` was being edited by
another agent while the first draft was written. That diff has since landed
in the working tree and is verified directly in RES2 below, 39 of 39 tests
passing; it is no longer moving, as far as this revision can tell. Two other
files are being edited live by other agents as this revision is written:
`lib/canonical-v2/native-producer/termination-fee-producer-prompt.js` (the
limb-split ruling, see the closing note at the end of this plan) and
`lib/canonical-v2/phase1-authority-boundary-inventory.js` (unrelated to this
plan). Neither is described by line number here, for the same reason the
first draft gave.

---

## Part 1: The headline finding, in plain English

Tonight's run got the law right and the plumbing wrong. The model read Modiv's
termination fee provisions and produced, verbatim and without error, both dollar
figures ($10,000,000 and $15,000,000 on the seller side, $15,000,000 on the buyer
side), the REIT formula that caps them, and five of six termination grounds. A
downstream checker then threw almost all of it away, not because it doubted the
extraction, but because its rule for "is this trustworthy" is narrower than the
rule a lawyer actually uses. A lawyer sees "the Company Base Amount" in a
definitions section and knows, because the agreement itself says so two clauses
later, that this is the Company Termination Fee. Today's checker only recognises
the fee by name. It cannot follow the two clauses.

That checker, not the model, is why the review page would show two facts (a
termination ground and a tail period) instead of the twelve-ish a lawyer would
expect, and why every dollar figure is missing.
(`evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/validation.json`)

A second problem looked, at first, like it sat underneath the first: a claim
that the tool cutting the agreement into sections gets Section 7.1's own
boundary wrong by 1,450 bytes, cascading through every subsection label inside
it. That claim is false. It compared a JavaScript string position against a
byte offset, two different numbers for the same point in the text, and read
the gap between them as a bug. Section 7.1's boundary, and everything inside
it, was correct all along. The full retraction is recorded where the old fix
used to sit (Lane SEC, Part 6). Two real sectionizer defects do exist, neither
of them this one, and neither blocks work on Modiv, because Modiv's own
section tree is already correct.

A third problem is not a defect at all: nothing in the live system currently
connects a fresh extraction run for *any* deal to the review page. The one deal
that already shows real termination fee data (QXO/TopBuild) does so through a
hand-written file that encodes that one deal's reviewed numbers by hand. Modiv is
not in that file. Fixing everything above would still show nothing on screen
until this wiring gap is closed too.

None of this is a reason to distrust the model. It is a reason to widen, carefully
and auditably, what the checker is allowed to look at.

---

## Part 2: The central design question

**Should the resolver be able to corroborate a candidate using text from a
section other than the one it came from?**

### 2.1 My answer

Yes, in one narrow form: the resolver may follow a citation the candidate's own
quote explicitly names, to the specific clause it names, for the specific fact it
was asked to corroborate, and it must record that it did so. It may not search a
section, an article, or the document for supporting language. The distinction
Ben draws in the brief, follow a named citation versus pool evidence, is the
right one, and it is checkable in code: a citation-follower takes a specific
target address as input and returns one fact; an evidence-pooler takes a search
pattern and returns however many places it matched.

This is not a new idea for this codebase. It is the codebase's own stated
direction, not yet built.

### 2.2 The evidence that this is already the intended design

The family's own design spec addresses this exact scenario, using a different
real deal:

> A trigger quote that cites ONLY a section number ("terminated by the Company
> pursuant to Section 8.01(d)(i)" -- Bioverativ) fails corroboration -> review,
> typed `TRIGGER_UNCORROBORATED`. This is the honest outcome: resolving a bare
> cross-reference to its legal content is relationship machinery (`TRIGGERED_BY`
> + citation resolution), not quote-local production.
> (`docs/superpowers/specs/2026-08-02-family-termination-fee-design.md:307-311`)

`TRIGGERED_BY` is not a hypothetical name. It is a fully registered relationship
type, validated by the write-set validator on equal footing with claims
(`lib/canonical-v2/contract-bundle.js:3715`, `EXPECTED_RELATIONSHIP_KEYS`;
`lib/canonical-v2/validate-write-set.js:30,48,1268...`), and it has already been
used, by hand, on two real deals: QXO/TopBuild carries six `TRIGGERED_BY`
relationships for its termination fee triggers
(`lib/canonical-v2/qxo-termination-fee-admitted-slice.js:19,498`,
`lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice.js:741`), and
Landos/AbbVie's termination fee section was reviewed the same way
(`lib/canonical-v2/reviewed-termination-fee-slice.js`). A second registered
relationship key, `USES_DEFINITION`, is a further candidate for the defined-term
side of this problem (Company Base Amount feeding Company Termination Fee); I
have not verified its exact semantics against `contract-bundle.js` and the next
person should before assuming it applies as neatly as `TRIGGERED_BY` does.

What none of the three hand-built precedents do is run inside the live,
automatic path. `candidate-resolution.js`, the module every real deal actually
goes through, never constructs a `TRIGGERED_BY` relationship anywhere (confirmed
by grep across the whole file). Every existing example is a bespoke,
human-reviewed, single-deal module: `qxo-termination-fee-admitted-slice.js`,
`qxo-buyer-termination-fee-admitted-slice.js`, and
`reviewed-termination-fee-slice.js` (Landos). The schema is proven. The
automation that would let it fire on a fourth deal without a human hand-encoding
it first does not exist. That is the actual gap, and it is narrower than "design
the resolver a new capability from scratch": it is "generalise a pattern this
codebase has already trusted enough to ship three times by hand."

### 2.3 What this would let through that is blocked today

On tonight's Modiv run, 14 of the 16 items sitting in `review_queue` are
extractions the model got right, rejected only for lack of context (counted
precisely in Part 3 below). Thirteen of the fourteen are citation-shaped:
either the candidate's own quote names a specific other clause ("pursuant to
Section 7.1(d)(ii)") and needs to know what that clause says, or the
candidate's own quote uses an intermediate defined term ("Company Base
Amount") and needs to know what that term ultimately resolves to. Neither
requires reading anything the candidate did not already point at by name.

The fourteenth is neither shape, and citation-following would not reach it.
Section 7.1(c)(i)'s Superior Proposal ground, the Company board's fiduciary
out and arguably the single most consequential seller-side termination right
in the agreement, is fully self-contained: the model quoted it correctly and
coded its trigger correctly (`SUPERIOR_PROPOSAL_TERMINATION`,
`native-producer-recorded-response-7.1.json`), naming no other clause and no
defined fee term at all. It was rejected `FEE_SIDE_UNCORROBORATED` because the
one whole-section fallback that could have corroborated it
(`feeSideFromFullPaymentContext`) scans only the candidate's own dispatched
section, and the boilerplate payment language it looks for sits in Section
7.3, not 7.1. Part 6's RES1 names this residual on purpose, rather than
letting it disappear into the other thirteen: its fix is different, and its
legal weight is higher than anything else in the queue.

### 2.4 What must stay blocked, and how this design keeps it out

Two risks are worth naming because both are visible in tonight's evidence, not
hypothetical.

**Risk A: a citation that resolves to the wrong text.** Citation-following is
only as trustworthy as the section tree underneath it, in general. The first
draft of this plan treated one specific instance of that risk, a claimed
mislabelling of Section 7.1's own internal structure, as a hard prerequisite
blocking all resolver work. That specific claim was wrong (Lane SEC records
the retraction in full), and the dependency does not run the way the first
draft described: every offline replay in this plan is pinned to Modiv, and
Modiv's section tree is already correct, so resolver work proceeds now,
unblocked by anything in Lane SEC. The general risk still stands for other
deals. Two real sectionizer defects do exist (Lane SEC, SEC1 and SEC2 below),
and a citation-follower run on a deal that hits either one would confidently
fetch the wrong clause, or fail to find one it should, and report the result
as verified. That is why citation resolution must fail closed on anything
less than exactly one match (2.6 below), so a future deal with a broken tree
produces a visible failure, not a silent wrong answer.

**Risk B: a keyword that matches the wrong thing.** This is the live wrongness
risk today, and it is not a cross-referencing failure at all: no citation was
followed, nothing outside the candidate's own quote was read. The model coded
7.3(b)(iii)'s trigger as `trigger_code: null`, meaning it declined to name a
ground, and in the same response separately tagged the identical quote as
`TAIL_FEE_STRUCTURE` (a topping fee triggered by a competing bid within 12
months, `native-producer-recorded-response-7.3.json`, `wave_b_mechanics[0]`),
a materially different mechanism from a stockholder vote failing. The
resolver overrode that abstention anyway: `feeTriggerCorroboratedCodes` runs
the full trigger pattern table over the candidate's own raw quote regardless
of what `trigger_code` said, found exactly one match
(`STOCKHOLDER_APPROVAL_FAILURE_TERMINATION`, because the quote's own
subordinate timing clause happens to contain the words "Stockholders'
Meeting"), and, because exactly one code matched, published it with no
warning (confirmed against `resolution.json`: the resolved claim's
`canonical_value` is `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION`, sourced from
that exact quote). This published tonight, on the current, live code path,
and nothing in the first draft of this plan fixed it. It is the one thing
here that is not a completeness gap but a wrongness one: a fact a reviewer
would see as confidently verified and is not true. RES1 below folds the fix
for this, anchoring a match to the clause's own operative subject rather than
any subordinate clause inside it, into the same step as citation-following,
not alongside it as a separate, deprioritisable lane, because an unanchored
match is exactly what citation-following would inherit if it read a followed
citation's text the same way.

The design that avoids both: a citation-follower takes (a) an explicit,
syntactically-recognisable reference string already present in the candidate's
own quote, (b) resolves it, through the sectionizer, to exactly one node,
failing closed if more than one node in the tree shares that reference (2.6
below), (c) reads only that node's own text for the one fact requested, with
the match anchored to the clause's own operative subject rather than any
subordinate clause inside it (the same anchoring Risk B needs, regardless of
whether the text came from a citation or the candidate's own quote), and (d)
records the followed citation on the resulting claim, the same shape
`TRIGGERED_BY` already uses for QXO and Landos. No step in that chain touches
text the candidate did not already name.

### 2.5 A data point that agrees, found while researching the first draft

The agent who was editing `candidate-resolution.js` while the first draft of
this plan was being written landed, independently, on the same texture of fix
for the fee-side half of this problem: rather than
either adding "Base Amount" as a fourth hardcoded literal, or copying the
existing whole-section blind-search fallback (`feeSideFromFullPaymentContext`,
used today only for trigger candidates), it generalised the *shape* the three
existing phrases already share (a capitalised party word, 0-2 filler words, then
one of a closed set of fee nouns) and, separately, added a fallback that checks
the candidate's *own* asserted `fee_term_ref` field rather than searching
elsewhere. Its own comment explicitly rejects the blind-section-search shape for
this case, for exactly the reason Part 2.4 above gives: Section 8.12 defines both
sides' terms together, so a "does this pattern appear anywhere in the section"
search would confirm either side and stop discriminating at all. That is the same
argument this plan is making, arrived at independently. It does not touch the
trigger-code cross-reference problem (Section 2.3), which remains fully open
(see RES1 in Part 6). This diff has since been verified directly, not just
read: RES2 in Part 6 confirms it against the full test suite, 39 of 39
passing.

### 2.6 Two conditions this design depends on, not yet built

Both are real gaps, not yet built, worth naming up front rather than
discovering during implementation.

**No ambiguity detection on section lookup.** `findSectionByReference` is a
plain first match: it returns the first tree node whose `reference` string
equals the one asked for, silently, with no check for a second node carrying
the same reference. Modiv has no duplicate references, so this has not yet
caused a wrong answer. A filing with an annexed agreement, a schedule that
repeats the main document's own numbering, or an exhibit that happens to
define its own "Section 7.1", would silently resolve to whichever one the
tree lists first. RES1 below must add the "exactly one match" check itself;
it does not exist today and nothing upstream provides it.

**The resolver already reads more than the candidate's own quote, in one
place.** 2.1 above draws the line at "the resolver may not search a section,
an article, or the document for supporting language", and that line is
right. But `feeSideFromFullPaymentContext`, in the live code today, already
scans an entire section's text for a boilerplate payment sentence when a
trigger candidate's own quote is a bare citation with no fee-side language of
its own, exactly the five bare-citation triggers this plan is built around.
It is narrow in practice (one exact sentence shape, side-unique within the
section it scans), but it is a whole-section scan, not a quote-local read.
State this plainly rather than implying citation-following starts from a
cleaner baseline than actually exists: the honest description of today's
design is "the resolver already does one narrow, whole-section scan for
fee-side language, and RES1 adds one narrow, cited-clause lookup for trigger
grounds", not "the resolver reads only its own quote today."

---

## Part 3: Resolver, extraction, or schema, and in what proportion

Counting tonight's 16 `review_queue` entries precisely
(`evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/resolution.json`,
`resolution_receipt.counts`):

| Cause | Count | Share | Evidence |
|---|---:|---:|---|
| Resolver: corroboration pattern too narrow (fee side or trigger code), model extraction was correct | 14 of 16 | ~88% | `resolution.json` `review_queue[*].reasons` (`FEE_SIDE_UNCORROBORATED` x9, `TRIGGER_UNCORROBORATED` x5); each traced against `candidate-resolution.js`'s `feeSideCorroboratedSides`/`feeTriggerCorroboratedCodes`, both of which test only `claim.raw_value` |
| Genuinely resolved, no defect | 2 of 16 | ~13% | same file, `reasons: []`, `has_resolution: true` |
| Extraction miss (nothing proposed at all) | 1 confirmed | separate count | Adverse Recommendation Change ground, confirmed present in scope, never proposed; see EXTRACT1 below |
| Schema gap | 0 of the 16 rejections, but real | separate | the REIT cap has no cross-deal governed claim shape; see 3.3. This does not explain any of the 16 review-queue items, it would still block the *display* of an already-corroborated capped amount |

**Resolver, roughly seven-eighths of what is visibly blocked.** Every one of the
14 rejected candidates was extracted correctly (verified: the model's raw
response for each contains the right quote, right amount or right party) and
rejected because the resolver's corroboration rules could not confirm what the
model already got right: `feeTriggerCorroboratedCodes` tests only the
candidate's own raw quote for a trigger code, and `feeSideCorroboratedSides`
tests only the quote for a fee-side phrase before falling back to one narrow
whole-section scan or the candidate's own asserted term (2.6 above spells out
exactly how narrow those fallbacks are)
(`candidate-resolution.js`, `handleFeeAmountCandidate` line region ~5510-5613,
`handleFeeTriggerCandidate` ~5624-5717; confirmed by reading both functions in
full this session). This is the dominant share by a wide margin and is the
correct place to spend most of the effort.

**Extraction, one confirmed miss, not the dominant cause.** The Adverse
Recommendation Change ground sits at byte 326532 in the canonical text, inside
the resolved Section 7.1 node's own span [321761, 331500], a span that was
always correct (Lane SEC's retraction explains why), so it was in scope for
the model's 7.1 call and the model saw it complete, not truncated. No
`fee_trigger_assertions` entry covers it, and it does not appear in
`open_world_candidates` either (`native-producer-recorded-response-7.1.json`).
This is real, but it explains 1 gap, not 14, and should not be treated as
evidence that extraction quality is the bottleneck. See EXTRACT1 in Part 6 for
what this does, and does not, still need.

**Schema, real but narrow, and orthogonal to the 14 rejections.** The REIT
"lesser of" cap genuinely has no cross-deal governed claim shape (Part 3.3
below). But a plain, uncapped fee introduced only through an intermediate
defined term, no REIT formula at all, would face the identical
`FEE_SIDE_UNCORROBORATED` rejection today. The schema gap and the corroboration
gap are two different problems that happen to co-occur on this one deal.

**A fourth category the brief's three-way split does not name: serving is not
wired at all.** Even a fully corrected pipeline publishes nothing to a screen
today, because `lib/canonical-v2/termination-fee-serving-source.js`'s per-deal
registry, `CANONICAL_TERMINATION_FEE_SOURCES`, has exactly one entry
(`QXO_TOPBUILD_DEAL_ID`). Modiv is not in it. This is not a quality defect, it is
an absence: nothing connects `resolveCandidates()`'s output for a fresh deal to
the review page without a human first writing a bespoke JS module for that deal,
the same pattern used for QXO and Landos. Part 6's SERVE1 addresses this
directly, because without it, none of the other fixes change what a reviewer
sees.

### 3.3 The REIT cap: partially built, not what it looks like

The user's framing that the REIT-capped formula "has no governed claim shape at
all" is right in the sense that matters (no `contract-bundle.js` claim
definition, not reachable for any live deal, not cross-deal general) but needs
one correction: a working *computation* already exists and ran successfully
tonight.

`resolveCandidates()` already calls `resolveModivConditionalFees()`
automatically on every run
(`candidate-resolution.js`, guarded by try/catch, "Most agreements will not
carry the exact Modiv definitions. They remain on the ordinary resolver path. A
partial match emits nothing."), and tonight it correctly produced six
`conditional_termination_fee_values` entries: the right amounts, the right
`LOWER_OF` operator, the right REIT cap reference, and citations spanning both
7.3 and 8.12 together (`resolution.json`, `conditional_termination_fee_values`).
A real projection module already turns this into a correctly worded headline
("Lesser of $10,000,000 (§7.3(b)(i), (ii) or (iii)) or $15,000,000 (§7.3(b)(iv)
or (v)) and the REIT Requirements cap"),
(`lib/canonical-v2/termination-product-projection.js:394-437`,
`conditionalFeeHeadline`), and it is wired into the family's real projection
function, `projectTerminationFeeProductSurfaces`, via `conditionalFeeExtraGroups`
(same file, line region 573-606).

The catch: `lib/canonical-v2/native-producer/modiv-termination-fee-source-parser.js`
matches Modiv's REIT clause by regex against its *exact, literal wording*
("Company Base Amount" means (x) if payable pursuant to Section
7.3(b)(i)..."), and `conditional-termination-fee-value.js`'s own validator
hardcodes Modiv's literal branch citations
(`'7.3(b)(i)', '7.3(b)(ii)', ...`) as the only values its `triggering_branch`
field will accept. This cannot fire on any other deal's differently worded cap,
even a near-identical REIT merger. It also bypasses `claims` and
`validate-write-set.js` entirely (grep confirms
`native-write-set-adapter.js` never references
`conditional_termination_fee_values`); the projection layer reads the
resolver's raw output directly, a side channel, not the governed publication
path. And even where it works, it never reaches a screen for Modiv today,
because of the serving gap in 3.2.

So: the computation is real and correct, the display code is real and correct,
and neither is a cross-deal capability, neither is a governed claim, and neither
is currently reachable. SCHEMA1 in Part 6 turns this from a one-deal regex into a
real claim shape.

---

## Part 4: What "V2 is better than V1" would concretely mean

This should not be argued about after the fact. The instrument to measure it
already exists and is more precise than "does it look better":
`scripts/review-parity-check.js`, backed by `lib/review-parity/report.js`. It
leads with `V2_LOSS`: a row V1 renders and V2 does not, "the failure mode nobody
can eyeball their way to" (the file's own header comment). Its exit codes are a
contract: 0 clean, 1 a substantive difference exists and needs a human judgement,
2 coverage is incomplete and the run is not a valid comparison at all, 3 usage
error (`lib/review-parity/report.js:24-29`).

Concretely, for termination fees, "V2 is better than V1" means, field by field,
for a comparable set of real deals:

1. **Zero `V2_LOSS` rows.** Every fact V1 currently shows on the termination fee
   table, V2 either matches or explicitly, visibly supersedes with cited
   evidence. Silence where V1 has an answer is a regression, not neutral.
2. **A written judgement on every disagreement**, not just a count. Per
   `ROADMAP.md` P1's own "done when": the side-by-side view renders for real
   deals, and there is a written list of every field where V1 and V2 disagree,
   with a judgement on which is right.
3. **The harness exits 0 or 1, never 2.** Exit 2 means the comparison itself is
   invalid (incomplete coverage), and any "V2 is better" claim made while it
   would exit 2 is not measuring what it claims to measure.
4. **This is the gate Ben already set for retiring V1.** DECISIONS.md item 13:
   V1 is not removed from a family's row until the harness proves V2 agrees or
   is demonstrably better, "on real data." That gate is already the right
   definition; this plan does not need to invent a new one, only satisfy the
   existing one honestly.

What this is not: a claim count, a percentage, or "V2 governs 3 claim types" as
a headline. A family can govern fewer claim types than V1 displays fields and
still be better, if every field V1 shows is covered by a V2 claim plus an
honestly labelled evidence card for what remains ungoverned (see 3.3's point
about wave-B mechanics below, which V2 already does deliberately for sole
remedy, late payment interest, expense reimbursement, and the tail/topping fee
mechanism: these are evidence-only by design, not a gap. `FEE_EVIDENCE_SURFACES`,
`termination-product-projection.js`; confirmed by the producer prompt's own
instruction, "The Remedies family owns the legal effect. This fee family
retains the payment context and evidence only.",
`termination-fee-producer-prompt.js:141`). Do not count these as blocked; they
are working as designed.

---

## Part 5: Is termination fee the right family to prove this on

Honestly, no, not alone, and the evidence explains why without needing to guess.

Termination fees on Modiv compound three independent sources of difficulty at
once: heavy defined-term indirection (a fee is never named in the clause that
states its amount; it is always reached through at least one intermediate
capitalised term), a genuinely atypical conditional structure (the REIT
qualifying-income cap is a real-estate-sector-specific mechanism, not something
most merger agreements carry), and cross-referencing across three separate
articles (triggers live in Section 7.1, the fee itself in 7.3, the amounts in
8.12). None of these three is unique to termination fees as a family, but their
combination on this specific deal is close to a worst case. A real, different
sectionizer defect also sits inside this exact family's own most fact-dense
section on this exact deal (Section 8.12's nested-lettering collision, SEC2
below), though it blocks none of tonight's specific targets. Together these
make this an unusually hard first proof point, not a representative one.

**Keep termination fees as the primary family regardless**, because the sunk,
working infrastructure is real and specific to it: the per-family switch, the
side-by-side compare view, DECISIONS.md items 4 through 6 already resolving the
hard legal-judgement calls, and the equivalence harness are all built and
already wired to this family specifically (`ROADMAP.md` P1's own technical
section). Restarting on a different family would throw that away for no
architectural reason; the resolver, sectionizer, and schema fixes in Part 6
benefit every family that shares this machinery, termination fee just happens to
be where the gaps are most visible.

**But prove the resolver-quality bar on a second, deliberately easier family in
parallel, before trusting the harder result alone.** The cleanest candidate by
the roadmap's own gap table is **MAE Definition**: its source text is already
admitted and committed, only the live run is missing
(`ROADMAP.md` 2.4: "MAE Definition | 3 | complete | real text, no run | data"),
and a Material Adverse Effect definition is structurally self-contained, a
single clause with carve-outs, not a fact assembled by reading three separate
articles. Running the fixed resolver against MAE Definition is a genuinely
useful decomposition for whoever reviews this, but be precise about what it
would and would not show. It exercises the shared pipeline: the sectionizer,
dispatch, and the general claim and party-resolution machinery, because MAE
Definition runs through the same infrastructure. It does not exercise
anything this plan fixes in Lane RES: `FEE_SIDE_CORROBORATION_TABLE`,
`FEE_TRIGGER_CORROBORATION_TABLE`, and the citation-following this plan adds
are all termination-fee-specific code, and an MAE run never calls any of it.
A clean MAE run is evidence the shared pipeline is sound. It is not evidence
that RES1 or RES2 below are correct; only termination fee's own regression
test, and eventually its own fresh run, can show that. If MAE Definition
comes back clean and termination fee does not, the remaining problem is
scoped to the fee-specific corroboration code; if both come back with
problems, the shared pipeline has a more general issue. I have not done for
MAE Definition the same line-by-line verification this plan does for
termination fee; this is a recommendation based on the roadmap's own gap
table, not an independently reproduced finding.

---

## Part 6: The plan

Five lanes. None of them blocks any other this round: every offline replay
here is pinned to Modiv, and Modiv's section tree is already correct, so Lane
SEC's two fixes can land whenever convenient rather than gating anything
else. The one internal order that does matter is inside RES1 itself: anchor
the trigger-code match first, then extend it to follow citations, not the
other way round (see RES1 below for why). Each step names what it is, why,
done when, rough cost, and what could go wrong.

### Lane SEC: sectionizer (not on the critical path, land when ready)

#### Retraction: Section 7.1's boundary was never wrong

**What was claimed.** The first draft of this plan said the tool that cuts the
agreement into sections starts Section 7.1 about 1,450 bytes after its real
heading, dropping the section's own heading, ground (a), and most of ground
(b)(i), and that the internal lettering of every subsection inside it was
consequently wrong. It called this a hard prerequisite blocking all resolver
work.

**What was actually measured, and why the original claim was wrong.** The
claim compared two different kinds of number as if they were the same thing.
JavaScript strings are UTF-16: `text.indexOf(...)` and `.length` count code
units, not bytes. The sectionizer's own node offsets are real UTF-8 byte
offsets, produced through a dedicated conversion helper that exists in the
file for exactly this reason (`charToByteOffset`,
`deterministic-sectionizer.js`: `Buffer.byteLength(text.slice(0, charIndex),
'utf8')`). The original claim never went through that conversion: it took a
character index from one measurement and a byte offset from another and read
the gap between them as a bug. Modiv's canonical text is full of curly quotes
and apostrophes, as SEC filings almost always are (every defined term sits in
quotation marks, every possessive after "Stockholders" or "Company" uses a
curly apostrophe), each one a single UTF-16 code unit but three UTF-8 bytes,
and by byte 320,000 those differences add up to exactly the reported gap.

Re-measured correctly this session, and now pinned by a regression test
already written, currently uncommitted in the working tree
(`tests/canonical-v2-native-sectionizer.test.js`, "Modiv Section 7.1
resolves from its real heading..."): the resolved node for Section 7.1 starts
at byte 321761, and the bytes there are exactly `"Section 7.1 Termination."`,
delta zero. Ground (a) (mutual written consent) and ground (b)(i) (regulatory
restraint) are, and always were, fully inside the section's own span. The
showpiece claim that node "7.1(c)(iii)" secretly contained the true (d)
heading is also false: `"(d) by written notice from Parent"` begins at byte
326973, exactly where the tree's own (c)(iii) node ends. The test asserts the
unit confusion directly, so it cannot resurface silently: the byte length of
the text up to `sourceText.indexOf('Section 7.1 Termination.')` equals
`node.start`, the same position, not two different ones.

**What this means for the rest of the plan.** Everything built on top of the
retracted claim goes with it: there is no "hard prerequisite" sequencing
before resolver work, and the extraction lane's premise that the model saw a
truncated span (EXTRACT1, below) is false, the model saw the complete,
correct section. Resolver work in Lane RES is not blocked by anything in this
lane: every offline replay in this plan is pinned to Modiv, and Modiv's tree
is, and was, correct.

**Do not delete this section.** It stays here, in place, as the record of
what was claimed, what was measured, and why the claim was wrong, so it
cannot quietly come back. This programme has already had one confidently
wrong claim reinstated after an earlier quiet deletion.

#### SEC1. Land and adversarially verify the article-chapeau fix

**What it is.** A real, different sectionizer defect, found independently of
the retracted claim above: on TopBuild and Skechers, an article's synthetic
"chapeau" node (the lead-in text between an ARTICLE heading and its first
real SECTION heading) swallows the entire article, including every real
section that follows, whenever every section in that article uses bare,
non-blank-line-anchored inline numbering. This is the dangerous shape for
citation-following specifically: an over-extended node feeds a neighbouring
section's text into whatever reads it next, which can produce
exactly-one-wrong-match published as verified, the same failure class as
Risk B in Part 2.4, just at the section-tree layer instead of the
corroboration layer.

**Why it matters.** `deterministic-sectionizer.js`'s own
`reconcileStaleArticleChildren` comment already names this, confirmed on real
filings: TopBuild and Skechers both mint an INTRO node that swallows an
article's first several real sections whole, with phantom subsection nodes
misattributed to the INTRO reference instead of their real section. Modiv's
own sections use the blank-line-anchored heading style the base classifier
already handles natively, so this defect does not reach it, which is exactly
why it is real without being any part of tonight's Section 7.1 story above.
Confirmed this session by running the sectionizer against all three real
fixtures: before the fix, TopBuild's Article I "I-INTRO" node ends at byte
15734, straddling section "1.1" which starts at byte 8619, swallowing "1.1"
through "1.8" whole; Skechers similarly misattributes clause "(r)" (the
Company Material Adverse Effect definition) to the stale INTRO node instead
of the real "1.1" Certain Definitions section it is actually inside.

**Status.** The fix already exists, uncommitted, in the working tree
(`reconcileStaleArticleChildren`, `deterministic-sectionizer.js`): once a run
of real inline sections is accepted for an article, it clips any pre-existing
sibling node that straddles the new first section's start down to that
boundary, and rebuilds its, now much smaller, subtree from the corrected
span. It only ever reuses the start of the clipped node, so genuine chapeau
prose before a real first section is preserved exactly; only the
over-extension past a now-known boundary is corrected. Regression tests
already exist and already pass: run this session,
`tests/canonical-v2-native-sectionizer.test.js` is 23 of 23 green, including
the corpus-wide sweep described below and named assertions for both TopBuild
and Skechers by byte position.

**Done when.** Reviewed and landed as a normal change, not built from
scratch: read the diff, confirm the regression tests above still pass,
confirm the corpus-wide sweep (below) still passes across the full committed
fixture set, and commit. Adversarial verification here means checking the fix
against a fixture it was not written for, not just the two it was found on;
the sweep below already does that for every fixture the corpus currently has,
and should be re-run against any fixture added later.

**Technical.** `lib/canonical-v2/native-producer/deterministic-sectionizer.js`,
the `reconcileStaleArticleChildren` function and its call site inside
`appendInlineDecimalHeadingSections`. This diff already exists in the working
tree; treat it as a normal review item, not greenfield work.

**Cost.** Small: review and land, not build. The corpus-wide regression sweep
this step depends on is already written (see below).

**Risk.** Low, and already mitigated: the sweep runs across every real fixture
the corpus has (Modiv, TopBuild, Skechers), not just the two deals the defect
was found on, which is exactly the blast-radius concern a shared boundary fix
should be checked against.

#### SEC2. Fix Section 8.12's nested-lettering collision

**Correction, 2026-08-06.** This section originally described the mechanism
as an inner lettered list swallowing the outer list's next item, because
Section 8.12's Intellectual Property definition sits at outer label "(z)"
with its own inner sub-clauses lettered (a) through (f). That description is
wrong, found independently by a dedicated investigation that traced the real
Modiv tree directly rather than reasoning from the label pattern
(`docs/codex-program/notes/nested-lettering-collision.md`, section 1.2). The
real mechanism has nothing to do with an inner list: the letter "z" itself
has no defined successor in the marker-tree builder's alphabet sequence, so
the outer list simply stops at "(z)" and cannot continue to "(aa)" at all,
whether or not "(z)" happens to contain its own inner (a)-(f) run. Neither
bug requires an inner list to be present, and the fix, landed in commit
`991330ee`, teaches the sectionizer that the letter after "z" is "aa", not
nothing. What follows below is left as the original diagnosis for the record
of what was believed at the time; read the note above for what is actually
true.

**What it is.** A different, unrelated bug in the same file: Section 8.12's own
sub-clause labels "(gg)" (Parent Base Amount, $15,000,000) and "(vv)" (Parent
Termination Fee, the REIT-capped formula) cannot be looked up individually at
all.

**Why it matters, and why it is not urgent.** Independently reproduced this
session: `findSectionByReference(tree, '8.12(gg)')` and `'8.12(vv)'` both
return null against the committed fixture. The cause, per the correction
above, is that the outer list's own lettering has no successor defined past
"z", not an inner list collision. This fails closed: a lookup for "8.12(gg)"
returns `null`, not a wrong node, so nothing downstream can silently trust bad
text from it. That makes this a completeness blocker, not a wrongness risk,
and none of tonight's fourteen review-queue targets needs it, none of them
cite "(gg)" or "(vv)". Tonight's scope-correction run worked around it by
pinning the whole "8.12" node rather than the specific sub-clause; that
remains a viable short-term move.

**Done when.** `8.12(gg)` and `8.12(vv)` (and any other outer-list letter
past "z") resolve to their real, printed spans. A regression test pins this
specific collision shape, because the underlying gap (no successor defined
past "z") is a general ambiguity, not a Modiv-only quirk. This is now fixed;
see the correction above.

**Technical.** Same file as SEC1, a scoped algorithmic change to the
marker-tree continuation rule (for example, preferring a shallower match when
a candidate matches more than one open frame, or resetting an inner run more
aggressively when a large structural gap intervenes) plus targeted tests.
Zero model spend.

**Cost.** Small, and not on this round's critical path. Sequence it whenever
convenient; nothing in RES1 through SCHEMA1 below needs it first.

**Risk.** Low in isolation, but shares an underlying algorithm with SEC1; fix
and test both together rather than in two uncoordinated passes, since both
live in `buildMarkerTree`'s continuation logic. This lane's proposed cost and
risk are left as written above for the record; the fix itself already landed
(commit `991330ee`, see the correction at the top of this section), so
nothing here is still to be sequenced.

#### The acceptance test for this lane: a corpus-wide tree-integrity sweep

This is the one idea worth keeping whole from the retracted claim: the right
way to trust a section tree is not a claim about one byte offset, it is a
sweep that checks structural properties across every real filing the corpus
has. This already exists, written this session and currently uncommitted in
the working tree alongside the fix it tests
(`tests/canonical-v2-native-sectionizer.test.js`): every pair of sibling
nodes at every depth must exactly tile, no overlap, no silently dropped text,
checked byte by byte against the raw filing; every decimal section must
anchor its own span on its own printed heading text; and parentage must stay
internally consistent. It runs today against Modiv, TopBuild, and Skechers,
and passes on all three. Run it against any fixture added to the corpus
later, and treat a failure anywhere in it as blocking, the same "nothing from
a neighbouring section" standard this codebase already holds itself to
elsewhere.

---

### Lane RES: resolver corroboration (the largest lever)

#### RES1. Anchor trigger-code matching to its operative clause, then extend it to follow citations

**What it is.** Two changes that land together, in this order, because the
second would silently inherit the first's defect if built first. First: stop
matching a trigger code anywhere in a quote, and require the match to sit at
the clause's own operative subject, not inside a subordinate timing or
parenthetical clause. Second, only once that holds: when a fee-trigger
candidate's own quote is a bare cross reference ("by Parent pursuant to
Section 7.1(d)(ii)") and carries no descriptive ground text of its own, look
up that exact cited clause, and only that clause, through the sectionizer,
and run the same, now-anchored, trigger-code pattern table against its text
instead of the candidate's own empty quote.

**Why the order matters.** The first draft of this plan treated these as two
independent lanes and described the anchoring half as something to
deprioritise because it looked cosmetic. It is not, and the dependency
between the two runs the opposite way to how the first draft sequenced them.
`feeTriggerCorroboratedCodes` today runs the full pattern table over
whatever text it is handed, with no anchoring, and that is exactly the
mechanism that published tonight's one wrong claim (Part 2.4, Risk B): a
match found anywhere inside a long, compound quote, with no requirement that
the match sit at the text's own operative position. Building citation-
following on top of that same unanchored function would make the failure
more likely, not less, because the resolver would then be running the same
ungrounded search over text the candidate never even quoted. Anchor the
match first, against the existing single-section fixture corpus, where it is
already checkable with no cross-referencing involved at all; only then
extend the anchored version to read a followed citation's text.

**Why it matters.** This is the single largest source of blocked, correctly
extracted facts: 5 of 6 trigger candidates from tonight's 7.3 call carry
`trigger_code: null` for exactly this reason
(`native-producer-recorded-response-7.3.json`), and all 5 are rejected
`TRIGGER_UNCORROBORATED` (`resolution.json`, `review_queue`). The model
cannot be asked to fix this by prompting alone: scoped to Section 7.3 alone,
it genuinely cannot know what ground 7.1(d)(ii) states, because that text is
not in front of it. This is squarely resolver work, and it is the same gap
the family's own design spec already named as the intended fix (Part 2.2).

**Done when, corrected to the measured outcome.** The first draft claimed all
five bare-citation triggers would resolve. They do not, and the corrected
target is the measured outcome, not a number to hit: running the
corroboration table over each cited clause's own text, checkable offline
today against Modiv's already-correct tree, gives one clean match, two
clauses that match two codes each and correctly route to
`AMBIGUOUS_TRIGGER_CORROBORATION`, and two clauses that match no code and
correctly stay `TRIGGER_UNCORROBORATED`. That is success: one more published
claim, four honestly routed to a human, every one traceable to the exact
citation followed. Widening either pattern table to force the ambiguous or
unmatched ones to resolve is failure, even though it would raise the count,
because it is precisely the move that publishes a wrong answer with no
warning, the thing Risk B already shows this resolver is capable of.
Whoever implements this should expect, and accept, a review queue that still
has items in it afterward.

**Two conditions that must hold, not optional hardening (2.6 above).** First,
resolving a citation must fail closed on anything other than exactly one
matching node: `findSectionByReference` is a plain first match today, with
no check for a duplicate reference elsewhere in the tree. Modiv has none, so
this has not yet mattered, but it will on a filing with an annexed agreement
or a repeated exhibit numbering, and this lane must add the check, not
assume the sectionizer already has it. Second, do not describe this as
adding search where none existed before: `feeSideFromFullPaymentContext`
already scans a full section for fee-side language today, for these same
five candidates' fee-side leg, before this lane touches anything.
Citation-following adds one narrow, cited-clause lookup on top of an
already-partial baseline, not a clean one.

**The residual this lane does not reach, and should not hide.** Section
7.1(c)(i)'s Superior Proposal ground (2.3 above) is rejected
`FEE_SIDE_UNCORROBORATED`, not `TRIGGER_UNCORROBORATED`: its trigger code is
already correct, and it names no citation and no defined fee term, so
neither half of this lane touches it. It fails today because
`feeSideFromFullPaymentContext` scans only the candidate's own section (7.1),
and the boilerplate payment sentence it looks for sits in 7.3. The narrow,
plan-consistent fix is to widen that one scan from "the candidate's own
section" to "the full set of sections dispatched together in this run" (7.1,
7.3, and 8.12 were dispatched together tonight), the same "look at what was
actually shown to the model, not just this one candidate's own slice of it"
principle the rest of this lane already relies on, not a new kind of
widening. Build it as part of this lane if the cost is small; if not, name
it explicitly as an accepted residual for this round, not a silent absence.
It should not be the family's single most important seller-side termination
right and also be the one nobody wrote down.

**Technical.** Lives in `candidate-resolution.js`'s `handleFeeTriggerCandidate`
and the `FEE_TRIGGER_CORROBORATION_TABLE`/`feeTriggerCorroboratedCodes` pair.
The anchoring change is a matching change to `feeTriggerCorroboratedCodes` (or
a new function called in its place) and needs no cross-referencing to build
or test. The citation-following half needs: (a) a parser for "does this quote
contain an explicit section reference and nothing else usable" (distinct from
a quote that merely mentions a section in passing among other descriptive
text: only the bare-citation shape licenses the lookup); (b) a lookup against
the resolved section tree, which today is built from
`runReceipt.resolved_sections`, i.e. only sections that were actually
dispatched to the model (`sectionsByReference` construction,
`resolveCandidates`). This means the cited target section (here, 7.1) must
either already be part of the same run's dispatched scope, as tonight's did, or
the resolver needs to independently re-derive a full-document section tree from
`admittedSourceContext.canonical_text.text` (already available regardless of
dispatch scope, as `resolveModivConditionalFees` already proves by reading the
whole document directly). The second option is the more general fix and should
be preferred if the cost is small, because it decouples "which sections a model
call needed to see for its own candidates" from "which sections a citation may
be followed into", removing a coupling that has no legal justification.

**Cost.** Medium. The anchoring half is a pattern-matching refinement,
testable entirely against the existing single-section fixture corpus. The
citation-following half is new resolver capability and needs its own tests
covering: a citation that resolves to exactly one node, a citation to a
section never dispatched, a citation to a target with an ambiguous or
multi-ground clause (still routes to `AMBIGUOUS_TRIGGER_CORROBORATION`, never
silently picks one), a citation that resolves to more than one node (fails
closed, 2.6 above), and a citation that does not parse as a bare reference at
all. Zero model spend to build or to verify against tonight's already-recorded
responses (see Part 7).

**Risk.** The bounded design in Part 2.4 is what keeps this safe; the risk is
scope creep during implementation, drifting from "follow the one named
citation, anchored to its own operative text" toward "search the target
section for anything relevant", which reintroduces the pooling problem this
design exists to avoid. Review this diff specifically for that drift, and
treat a review queue with the corrected proportions above, not a fuller one,
as the sign the implementation is honest.

#### RES2. The fee-side-via-defined-term fix: landed, tested, two of three

**What it is.** The change described in Part 2.5 has landed:
`candidate-resolution.js` generalises `FEE_SIDE_CORROBORATION_TABLE` from
three hardcoded phrases to a shape pattern (a capitalised party word, at most
one capitalised filler word, then one of a closed set of fee nouns), and adds
`feeSideFromFeeTermRef`, a fallback for amount candidates that checks the
candidate's own asserted `fee_term_ref` attribute when its quote alone
corroborates nothing.

**Why it matters.** This is what turns most of tonight's three rejected
fee-amount candidates into published `TERMINATION_FEE_AMOUNT` claims, without
which the family's headline number, the fee itself, stays blank regardless of
anything else in this plan.

**Done when, corrected to the measured outcome.** The first draft claimed all
three resolve. It is two of three, and that is the honest current state, not
a shortfall to paper over. Confirmed this session, `node --test
tests/canonical-v2-termination-fee-resolution.test.js` is 39 of 39 green: the
"Parent Base Amount" quote resolves `BUYER`, `15000000.00`; the "Company Base
Amount" (x)-limb quote resolves `SELLER`, `10000000`. The (y)-limb quote,
"(y) if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v),
$15,000,000.00", now correctly corroborates `SELLER` through the new
`fee_term_ref` fallback, then is honestly rejected on a different, narrower
reason than it was live: `FEE_TERM_NOT_IN_QUOTE`, not
`FEE_SIDE_UNCORROBORATED`, because the words "Company Base Amount" never
appear in that limb's own quote, only in the sibling (x)-limb's. This is the
unchanged gate `claim.raw_value.includes(feeTermRef)`
(`candidate-resolution.js`, `handleFeeAmountCandidate`), and it is correct to
leave it unchanged: loosening it to let a term through that the quote never
states would be exactly the kind of widening Part 2.4 and RES1 above both
warn against. Three hostile tests already confirm the widened table does not
over-match: a per-share price, an MAE dollar threshold, and an unrelated
"Company Working Capital Amount" all stay correctly rejected.

Separately, and unaffected by anything above: five `fee_trigger`-shaped
entries from the same 8.12 call, whose raw value is a bare "Section
7.3(b)(x)" fragment with no party word at all, still fail, because there is
no defined-term shape to match in a bare citation. These read as
near-duplicate noise from 8.12's own cross-references back to 7.3, not lost
information; confirm that reading, and if correct, consider suppressing them
at the producer or resolver level as a small follow-on, not as part of this
step.

**What closes the third limb, and why it belongs elsewhere.** The owner has
since ruled on exactly this gap (see the closing note at the end of this
plan): defined-term limbs split across separate producer assertions must
each carry the defining language that precedes the split, not just their own
branch, so a limb like the (y)-limb above states what it is the amount of
without relying on its sibling's quote. That is an extraction-side fix, in
`termination-fee-producer-prompt.js`, being made in another session as this
plan is revised. It is the right fix, not a reason to loosen the resolver
gate here: the gate stays strict, and the quote becomes complete instead.
Once it lands, replay this same test against the new quote shape; do not
change `FEE_TERM_NOT_IN_QUOTE`'s own logic to anticipate it.

**Technical.** No further resolver work needed; this step is verification
plus, where the hostile-test coverage above is not already sufficient, a
handful of additional targeted assertions. Confirm against the `node --test`
suite plus tonight's exact recorded `raw_response_text` for section 8.12, not
a rebuilt fixture, so the check is against what was actually said, not a
paraphrase of it.

**Cost.** Small, and mostly already spent: review plus, once the
producer-prompt limb fix above lands, one replay to confirm three of three.

**Risk.** Watch for over-matching if the shape pattern's case sensitivity or
one-word cap is relaxed later without a fresh corpus check; the hostile tests
already committed are the guard, keep them green.

---

### Lane SCHEMA: claim and schema changes

#### SCHEMA1. A real, cross-deal claim shape for a capped or conditional fee amount

**What it is.** Turn the REIT "lesser of" formula from a single-deal, regex-matched
side channel into a governed claim shape any deal with a conditional fee
structure can use.

**Why it matters.** Without this, the REIT cap can never appear as a claim, only
as the projection-layer side channel described in Part 3.3, which is Modiv-only,
bypasses `validate-write-set.js` entirely, and (independent of all of that)
still cannot reach a screen until SERVE1 exists. A cross-deal shape also removes
the need for a bespoke, hand-written regex parser for the next REIT-structured
or otherwise-capped deal that comes through the corpus.

**Done when.** `TERMINATION_FEE_AMOUNT` (or a sibling claim definition) can
express "the lesser of a stated base figure and a named, unquantified cap",
sourced from `resolution.conditional_termination_fee_values`'s already-correct
shape (fee side, triggering branch, base amount, operator, cap term reference,
defined-term lineage, source citations) rather than inventing a new one, and
flows through the ordinary `claims` / `validate-write-set.js` path rather than
the current side channel. Tonight's six already-computed values become the
regression fixture: no new model call is needed to build or test this.

**Technical.** Per `ROADMAP.md` P2, a genuine new claim definition costs 11
edits in `lib/canonical-v2/contract-bundle.js` and needs to watch the dual
numbering there (input version currently at V38, concept keys at V24), then
still needs projecting and wiring into the termination-fees switch before it
reaches the review page (this is SERVE1's job, not this step's). Do not
duplicate DECISIONS.md items 4 through 6 here: willful breach, the sole-remedy
carve-out, and per-limb payment deadlines are already ruled and are cross-referenced
to this same step in `ROADMAP.md` P2 and `DECISIONS.md`, but their claim
vocabulary belongs to the Remedies family, not this one; this step is scoped
to the capped-amount shape only.

**Cost.** Medium, matching ROADMAP's own estimate for a new claim definition.
Zero model spend to build or verify.

**Risk.** Scope discipline: it would be easy to fold DECISIONS 4-6 into this
step because they touch the same family, but they are separately ruled,
separately owned, and mixing them into one PR makes review harder, not easier.

---

### Lane EXTRACT: prompt and producer changes

#### EXTRACT1. The Adverse Recommendation Change miss, already checkable, no new call needed

**What it is.** One genuine gap: the model, given Section 7.1's text, did not
propose a `fee_trigger_assertions` entry for the Adverse Recommendation
Change ground, even though it is textually clear and within scope.

**Why this is no longer a wait-and-see.** The first draft put this last, not
first, because it assumed the model saw a truncated, mis-numbered span and
wanted to rule that out before touching the prompt. That assumption is gone
(Lane SEC's retraction): the span the model actually saw tonight was always
the complete, correctly bounded Section 7.1, including ground (a) and ground
(b)(i) in full. There is nothing left to re-run to answer "did the model see
the right text": it already did. The question this step actually needs to
answer, whether the miss is a genuine gap or a defensible non-guess, is
answerable right now against the already-recorded response, with no new
model call.

**Checked this session, offline, against
`native-producer-recorded-response-7.1.json`.** The Adverse Recommendation
Change ground appears in neither `fee_trigger_assertions` nor
`open_world_candidates`; it is not proposed, and it is not flagged as an
uncertain candidate either, the shape the prompt's own discipline asks for
when the model is unsure rather than silent. Read alongside what the model
did produce from the same call, this leans toward a genuine miss rather than
principled abstention: of Section 7.1's four lettered grounds, the model
proposed exactly one fee trigger, the Superior Proposal ground, correctly
quoted and correctly coded. That selectivity is a point in the prompt's
favour elsewhere, it did not over-propose grounds that do not actually carry
a fee, which makes a silent, unflagged gap on this one ground less likely to
be deliberate. This is a reasonable reading, not a certain one; treat it as
the starting point for whoever owns this family's prompt, not as a closed
question.

**Done when.** No further offline work is needed to answer whether the model
saw the right text, it did. Whoever picks this up should decide, as a
judgement call, whether one missed ground on an otherwise-correct call
justifies a prompt change, weighing the selectivity point above. If a prompt
change is made, verify it against a fresh single-section call before trusting
it, since this is the one place in this step where a model call is the only
way to check the fix.

**Technical.** `lib/canonical-v2/native-producer/termination-fee-producer-prompt.js`.
Nothing here depends on Lane SEC any longer.

**Cost.** Zero to reach the finding above; it is already checked. A single
model call only if a prompt change is actually made and needs verifying (a
fraction of the $1.35, seven-minute full run, since it would be one call, not
three).

**Risk.** Low. The main risk is treating "one missed ground" as proof the
prompt is broken and over-correcting it in a way that starts proposing
grounds that do not carry a fee, the opposite failure from tonight's.

---

### Lane SERVE: connecting a fresh run to a screen

#### SERVE1. Stop requiring a hand-written module per deal

**What it is.** Today, the only way a deal's termination fee data reaches the
review page is a bespoke, hand-authored JavaScript module, written and reviewed
once per deal, that re-encodes that deal's reviewed quotes and figures by hand
(QXO/TopBuild is the only live example; Landos/AbbVie and Modiv both have their
own such modules that are not wired into serving at all). This step builds a
general path: a deal's actual `resolveCandidates()` / `validate-write-set.js`
output, once reviewed, becomes servable without writing a new file for it.

**Why it matters.** Without this, every other fix in this plan is invisible.
Fixing SEC1, SEC2, RES1, RES2, and SCHEMA1 completely would still show
nothing for Modiv on the review page, because
`CANONICAL_TERMINATION_FEE_SOURCES` (`lib/canonical-v2/termination-fee-serving-source.js`)
has exactly one entry and Modiv is not it. This is the step that makes "the
side-by-side view renders for real deals" (`ROADMAP.md` P1's own done-when)
achievable for more than the one deal that already happens to have a hand-built
module.

**Done when.** A deal with a validated, reviewed resolution can be served
without a new bespoke source file, verified by pointing the generalised
registry at tonight's already-committed `resolution.json` /
`validation.json` for Modiv as a fixture and confirming the review page's data
path renders it. Critically, preserve the human review checkpoint the current
hand-authored modules provide by construction (every quote in the QXO and
Modiv-parser modules is individually hash-pinned and re-verified against the
source at build time): do not turn this into "any resolver output auto-publishes
the moment it exists." A stored, explicit reviewed flag per deal or per
resolution run, populated once a human has looked at the review queue, is the
right shape, not a silent removal of the gate.

**Technical.** `lib/canonical-v2/termination-fee-serving-source.js`'s
`CANONICAL_TERMINATION_FEE_SOURCES` registry and
`describeCanonicalTerminationFeeSource`. The three-state outcome model already
built here (`NOT_REGISTERED` / `ATTACHED` / `FAILED`) is worth preserving as-is;
extend what feeds it, not its own shape. Read this file's own VERCEL FILE
TRACING comment before choosing a storage mechanism: a previous version of this
same module broke in production because it read a file at request time in a way
Vercel's static tracer could not see; whatever replaces the per-deal function
registry must not reintroduce a runtime filesystem or database read that the
build-time tracer cannot follow, or must go through an API route rather than
the page-render path.

**Cost.** Medium: this is a real architectural change to how serving decides
what it has, not a data fix. Zero model spend; testable entirely against
already-committed fixtures.

**Risk.** The main risk is exactly the one named above: building an automatic
path that quietly drops the manual review step the current, slower, hand-authored
approach provides for free. A second risk is repeating the Vercel file-tracing
incident this module's own comments already document from experience.

---

## Part 7: Sequencing, and what a new run actually needs to prove

Re-running is $1.35 and about seven minutes each time
(`call-telemetry.json`: $0.2556 + $0.5816 + $0.5140 = $1.3512; 421,847ms =
7.03 minutes). That is cheap enough to not obsess over, and expensive enough
that paying for it before the offline fixes land would very likely just
reproduce tonight's result: pinning more scope without fixing corroboration
first is exactly what tonight's run already tried, and it is on record as
having quadrupled the open-world count (4 to 16) and doubled the review queue
(8 to 16, confirmed by comparing `resolution_receipt.counts` against the prior
run's own `resolution.review_queue.length` in
`m3-pilot-20260804-fresh/final-output/execution-result.json`) without a
corresponding jump in resolved claims (1 to 2). One extra claim, arguably
mislabelled (Part 2.4).

**Note on a figure I could not verify.** The evidence brief states the earlier
attempt "cost 4.4 times the spend" of the original single-section run. I could
not confirm this multiple: the original 7.3-only run's committed work item
carries no cost or telemetry field at all
(`m3-pilot-20260804-fresh/final-output/execution-result.json`; confirmed by
direct inspection), consistent with `ROADMAP.md`'s own statement that no cost
data exists for pre-tonight runs. The direction is real and checkable (per-call
cost rose across tonight's three calls as pinned scope grew: cache-creation
tokens climbed 24,590 to 26,757 to 36,678 across the three calls,
`call-telemetry.json`), but the specific "4.4x" figure is not independently
checkable from what is committed to the repository. Treat it as directionally
right, not as a pinned number.

**Verifiable for free, against what is already committed, no new model call:**

- SEC1: already verified this session, 23 of 23 sectionizer tests passing,
  including the corpus-wide sweep across Modiv, TopBuild, and Skechers. What
  remains is review and landing, not verification.
- SEC2: still open. `node --test` against the committed Modiv HTML fixture
  once built.
- RES1, once built: replay tonight's five bare-citation trigger candidates
  from `native-producer-recorded-response-7.3.json` against Modiv's
  already-correct section tree and confirm the corrected mixed outcome, one
  resolves, two route to `AMBIGUOUS_TRIGGER_CORROBORATION`, two stay
  `TRIGGER_UNCORROBORATED`, entirely offline. Separately, replay the
  7.3(b)(iii) quote against the anchored pattern table and confirm it no
  longer mis-resolves, against both tonight's fixture and the existing
  multi-deal fixture corpus.
- RES2: already verified this session, 39 of 39 termination-fee-resolution
  tests passing, against tonight's exact recorded `raw_value` and
  `fee_term_ref` fields: two of three fee-amount candidates resolve, the
  third correctly stays in review on `FEE_TERM_NOT_IN_QUOTE`.
- SCHEMA1: build and test against tonight's already-computed
  `conditional_termination_fee_values`, no new extraction needed.
- SERVE1: point the generalised registry at tonight's already-committed
  `resolution.json` / `validation.json` as the fixture.
- EXTRACT1: already checked this session against
  `native-producer-recorded-response-7.1.json`, no model call needed. The
  Adverse Recommendation Change ground is absent from every field in the
  recorded response; it was never truncated out of what the model saw.

Build a single regression test now that loads all three of tonight's recorded
responses plus the committed HTML fixture and runs them through
sectionize -> resolve -> validate with each fix applied, asserting the new
expected counts. This turns "did the fix work" into a mechanical, CI-checkable
fact rather than a judgement call. Lane SEC's half of this already exists and
passes (`tests/canonical-v2-native-sectionizer.test.js`); Lane RES's half, an
end-to-end replay of all three recorded responses through the anchored,
citation-following resolver against the corrected counts above, is the piece
still outstanding, and remains the first deliverable before RES1 is
considered done.

**What genuinely needs a fresh, paid run, and only after everything above is
verified offline:**

- A genuine end-to-end cost and timing reading on the fully corrected pipeline.
- Feeding `scripts/review-parity-check.js` for the real field-by-field V1-vs-V2
  diff Part 4 defines as "done."
- Any prompt change EXTRACT1 actually decides to make, verified against a
  fresh single-section call. This is the only remaining question a model call
  can answer that the record does not already settle.

Recommended order: SEC1 (review and land, already verified), RES1, RES2
(replay to confirm three of three once the producer-prompt limb fix lands),
SCHEMA1, and SERVE1, verified offline against the regression test above, in
one batch; SEC2 whenever convenient, nothing above depends on it; then
exactly one fresh full run (not incremental per-section reruns); then the
harness.

---

## Part 8: Risks, in order

1. **The sectionizer fix (SEC1) has corpus-wide blast radius, and this round
   already budgeted for it.** It touches shared boundary logic, not a
   Modiv-only code path, and the underlying defect class already broke two
   other real filings differently (TopBuild, Skechers). The corpus-wide
   regression sweep is not a future line item, it is already written and
   already passing across all three fixtures; keep it green as the corpus
   grows, rather than treating this risk as closed just because it is found.
2. **Citation-following, built loosely, becomes evidence-pooling by another
   name.** The design in Part 2.4 is narrow on purpose: one named citation, one
   resolved target, one fact, recorded, anchored to the clause's own operative
   subject. Review RES1's implementation specifically for drift away from that
   shape, in both halves of it, the anchoring and the citation lookup.
3. **The keyword-mismatch risk is not a separate, deprioritisable lane.** The
   first draft treated it as an independent step (RES3) and easy to push
   later. It is not: it is the mechanism that published tonight's one wrong
   claim with no warning, and it is a precondition for citation-following's
   own safety, not a parallel nice-to-have. RES1 above merges the two for
   this reason; do not split them back apart during implementation.
4. **SERVE1 could quietly remove the human review step** the current
   hand-authored per-deal modules provide as a side effect of their own
   tedium. Build the replacement with an explicit, visible review checkpoint,
   not an implicit one.
5. **Paying for another run before the offline fixes land** would very likely
   just repeat tonight's outcome: more review-queue noise, no proportional
   gain. This is avoidable and cheap to avoid, and cheaper still now than the
   first draft assumed: EXTRACT1 no longer needs a run at all to answer its
   own question.
6. **The retracted section-boundary claim could resurface.** This programme
   has already had one confidently wrong claim reinstated after a quiet
   deletion. The retraction in Lane SEC is written to prevent a repeat: it
   states what was claimed, what was measured, and why the claim was wrong,
   pinned by a regression test that asserts the unit confusion directly. If a
   future draft of this plan mentions a byte-offset defect in Section 7.1
   again, treat that as a claim to re-verify from scratch, not a fact to
   carry forward.

---

## Appendix: what was independently reproduced this session versus cited

To make this checkable rather than trusted: this section lists what was
directly executed against committed code and fixtures, across both this
plan's first draft and this revision, rather than taken from any evidence
file's own narrative.

**Reproduced in the first draft, retracted by this revision.** The claimed
1,450-byte offset for Section 7.1's boundary, the specific text supposedly
dropped, and the internal relabeling cascade under 7.1, including the claimed
mismatch between the tree's own "(c)(iii)" node and the true printed (d)
heading, were all reported as independently reproduced. They were not real:
the underlying measurement mixed a UTF-16 character index with a UTF-8 byte
offset. The retraction in Lane SEC records the corrected numbers and the
mechanism in full; nothing from that original claim should be treated as
reproduced.

**Reproduced in the first draft, still standing.** The non-resolution of
`8.12(gg)` and `8.12(vv)`; the location of the Adverse Recommendation Change
ground relative to Section 7.1's span (correct, and, per the retraction, that
span was never truncated); that `extractSingleJsonObject` in
`anthropic-provider.js` already strips markdown fences at current HEAD
(commit `2396bf50`, which lands after the evidence bundle's own failed-run
diagnosis of this as a live, general risk, meaning that diagnosis is now
stale, not wrong at the time it was written); and the resolved/review-queue/
open-world counts for both tonight's run and the original 7.3-only run,
compared directly.

**Reproduced this revision, against the adversarial review that shaped it.**
The corrected byte positions for Section 7.1 (321761, exactly "Section 7.1
Termination.") and for the true (d) heading (326973, exactly where the
tree's own (c)(iii) node ends), and the UTF-16-versus-byte mechanism behind
the original error, checked against `charToByteOffset` and the raw fixture
directly. That `reconcileStaleArticleChildren` already exists, uncommitted,
in the working tree, and that both it and the retraction are already covered
by passing tests, themselves currently uncommitted alongside the fix:
`tests/canonical-v2-native-sectionizer.test.js`, 23 of 23, run this session.
That `tests/canonical-v2-termination-fee-resolution.test.js`
is 39 of 39, run this session, confirming RES2's two-of-three outcome and its
specific `FEE_TERM_NOT_IN_QUOTE` rejection reason for the (y)-limb. The exact
composition of all 16 `review_queue` entries, read directly from
`review-queue.json`: which 5 are the bare-citation triggers, which 3 are the
real fee amounts, which 5 are the near-duplicate 8.12 fragments, and which 1
is the previously unnamed Superior Proposal residual. That the resolved
7.3(b)(iii) claim's `canonical_value` is
`STOCKHOLDER_APPROVAL_FAILURE_TERMINATION`, read directly from
`resolution.json`, and that the model's own recorded response for that
section carries `trigger_code: null` for that exact quote alongside a
separate `TAIL_FEE_STRUCTURE` tag, read directly from
`native-producer-recorded-response-7.3.json`, together the full evidentiary
basis for Part 2.4's Risk B. That Section 7.1(c)(i)'s Superior Proposal
ground was extracted with a correct, non-null `trigger_code` and fails only
on `FEE_SIDE_UNCORROBORATED`, read directly from
`native-producer-recorded-response-7.1.json` and `review-queue.json`
together, the basis for naming it as a residual in 2.3 and RES1 rather than
leaving it unnamed. That `feeSideFromFullPaymentContext` scans only the
entry's own `sectionReference`, not the full dispatched scope, read directly
from `candidate-resolution.js`, the basis for 2.6's second condition.

Everything else is cited to its file directly above and was not
independently re-executed beyond reading the source.

---

## Note: a ruling since the review

One open question flagged during review needed an explicit decision, not
another round of analysis: when a defined term's amount is split across
separate limbs for extraction (Modiv's "Company Base Amount", limbs (x) and
(y), RES2 above), so that each limb's own cross-references can tie to its own
amount, does each split assertion still need to carry the defining language
that precedes the split.

The owner ruled yes. Split the definition so each limb's cross-references tie
to the relevant amount, but tie the split to the language that precedes it,
so each limb still states what it is the amount of. His words: "you need to
split the definitions so you can trace the cross references and tie them to
the relevant amounts, but you need to tie the split to the language pre-split
so that the definition stays with the limbs."

This is being implemented in `termination-fee-producer-prompt.js`, in another
session, alongside this revision. This plan reflects the ruling, in RES2
above, and does not design the implementation: the exact instruction wording,
and how the model is told to repeat the defining language per limb, belongs
to whoever is already making that change.
