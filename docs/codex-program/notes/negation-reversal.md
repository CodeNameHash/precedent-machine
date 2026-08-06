# The negation-reversal quote defect: what was true, what was fixed, what remains open

Status: investigated by construction, against real committed source text, before any
code was changed. Two live surfaces fixed and verified with zero test regressions.
One surface investigated, found to need a different, more careful fix than the one
tried first, and deliberately reverted rather than shipped half-right. One upstream
fix specified but not implemented, because it sits in a file this task is not
permitted to edit. Full suite verification at the end of this note.

This note answers, in order, exactly what the brief asked: what is actually true
today, what "crude trimming is now blocked everywhere" refers to in code, whether a
negation-dropping quote could still be produced and accepted end to end, and what was
then done about it.

## 1. The claim in WORK-COMPLETED.md was false, independently reconfirmed

`docs/codex-program/WORK-COMPLETED.md` said: "Crude trimming is now blocked
everywhere; the negation case specifically remains open and is tracked in the
roadmap's known risks, with its fix designed as step 1b."

Checked directly, before trusting either the original claim or the brief's framing of
it. A full-text search of `docs/codex-program/ROADMAP.md` (1,468 lines) for "step 1b"
finds nothing. The document does have a real "known risks" section (`Part 6. Risks,
in order`), and it does have a real item about quotation provenance (item 7:
"Quotation provenance sits in three incompatible coordinate systems, two of them
populated with wrong values that read as right"), but that item is about coordinate
systems, not about negation, and does not name this defect. `docs/codex-program/
OPERATING-RULES.md` contains the only other appearance of "step 1b" language in the
programme's docs ("the roadmap's step 10 and its known risks"), and that sentence is
about excerpt-identity uniqueness, an unrelated topic. There is no step 1b anywhere,
for this or any other topic.

This matches `docs/codex-program/notes/doc-reality-audit.md` finding F27, produced by
an earlier, independent pass, word for word: "the only place the phrase 'step 1b'
appears anywhere under `docs/codex-program/` is inside `WORK-COMPLETED.md`'s own
sentence claiming it exists elsewhere." Two independent checks, run separately, agree.
The false claim is corrected in `WORK-COMPLETED.md` itself as part of this work (see
section 7 below); this note is the tracking that sentence used to falsely claim
already existed.

## 2. What "crude trimming is now blocked everywhere" actually refers to

Traced to `lib/canonical-v2/general-covenants-dark-bridge.js`,
`lib/canonical-v2/legacy-card-bridge.js`, `lib/canonical-v2/no-other-reps-fraud-dark-
bridge.js` and `lib/canonical-v2/representations-dark-bridge.js`, the four "dark
preview bridges" `review-preview-assembly.js` merges into a review deal (Material
Contracts, General Covenants, No Other Reps / Fraud, Representations). The historical
handoff log (`git show 59568f92:docs/handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md`,
section 61) records the original finding: three of the four bridges verified
"verbatim" quotes with plain `String.includes`, which accepts any substring anywhere
in the source regardless of whether it preserves meaning. The fix that shipped after
that finding replaced plain containment with WORD-BOUNDARY-ANCHORED containment
(`anchoredContains` / `isWordChar`, present in all three of representations, no-other-
reps-fraud and legacy-card-bridge). That closes a truncated prefix, a mid-word slice
("accurate" out of "inaccurate"), and an arbitrary mid-quote substring. That is the
"blocked everywhere" claim, and it is true as far as it goes.

General Covenants and Material Contracts are additionally, structurally immune to the
whole class, by a different mechanism: neither one ever accepts a quote that is a
partial substring of anything. General Covenants requires
`card.features[MAIN_CONCEPT_ATTRIBUTE] === card.primary_quote === card.region_full_text
=== card.full_text`, whole-string equality, always. Material Contracts requires each
governed bucket's `text` to be an EXACT joined segment of `card.primary_quote`
(`isExactJoinedSegment`), never a re-searched substring. Neither has a containment
check to defeat, so neither needed the negation-boundary fix built for this task (see
section 8).

Word-boundary anchoring is real, but it was never capable of closing the negation
case, and the code that added it says so, honestly, in its own header comment
(`representations-dark-bridge.js`, above `groundedInSource`, before this fix):
"it CANNOT close a word-boundary-aligned negation drop, because dropping a whole
preceding word can never itself violate a word boundary." "Have a Company Material
Adverse Effect" is a genuine, complete-word substring of "would not have a Company
Material Adverse Effect"; trimming the leading three words never crosses a word
boundary, so a check that only asks "does this occur, word-boundary-anchored, in the
source" answers yes to both the true sentence and its inverted reading.

## 3. The gap was real and open, proved by construction against real committed text, before any fix

Two independent, real-text probes, run before any code in this repository was
changed for this task.

**Probe 1, the live production path.** `lib/verification.js`'s `quoteAppearsIn`, the
function `lib/parser-v2/store.js` actually calls at ingestion (via
`sanitizeFeatureQuotes`) to decide which quotes survive into the stored feature bag a
lawyer sees on the review page, used plain, UNANCHORED `String.includes`, with no word
boundary check at all, which is weaker than the dark bridges' pre-existing state.
Run against `tests/fixtures/canonical-v2/mae-definition-family/modiv-company-mae-
definition.txt`, a real, committed excerpt of Modiv's filed merger agreement:

```
source (real, filed text): "...provided, however, that in no event would any of
the following, alone or in combination, be deemed to constitute, nor shall any of
the following be taken into account in determining whether there has been or
would reasonably be expected to be a "Company Material Adverse Effect" ..."

attack quote: "any of the following, alone or in combination, be deemed to
constitute, nor shall any of the following be taken into account in determining
whether there has been or would reasonably be expected to be a "Company Material
Adverse Effect""

quoteAppearsIn() result, before this fix: true
```

Then run through `sanitizeFeatureQuotes` directly, the exact function called at
ingestion, with the attack quote placed in a `materialityQualifier` feature (the
field this exact defect concerns): `removed: 0`, the fabricated, meaning-inverted
quote survives ingestion unchanged and would have been stored and shown as verbatim
evidence.

**Probe 2, the dark-bridge preview path.** This repository had already, honestly,
proved the same gap open at `representations-dark-bridge.js`, with two tests literally
named `KNOWN LIMITATION`, both asserting `doesNotThrow` on exactly this shape of
attack (a `materialityQualifier` accuracy-standard quote with "have a Company Material
Adverse Effect" cut out of the fixture's real-shaped "...except as would not have a
Company Material Adverse Effect..." sentence). Reading those tests, before changing
anything, was itself sufficient to confirm the gap was real, open, and already known
to whoever wrote them; the problem this task found was not that the gap existed
(that was already honestly documented in code) but that a governed document claimed,
falsely, that it was tracked for a fix, when it was not tracked anywhere at all.

Both probes are preserved as permanent regression tests: `tests/negation-boundary-
guard.test.js` (probe 1, now asserting the fixed, safe behaviour, against real
TopBuild and Modiv filing text) and `tests/canonical-v2-representations-dark-
bridge.test.js` (probe 2, the two `KNOWN LIMITATION` tests renamed to `FIXED` and
flipped to `assert.throws`).

## 4. The fix: a shared, narrow, bounded negation-boundary guard

New file: `lib/negation-boundary-guard.js`. It answers one question:
"does the text immediately governing the quote that starts at this position carry a
negation the quote itself does not include?" It is deliberately a heuristic over text,
not a grammatical parse, and not the principled fix (an independently-captured,
pre-trim offset; see section 8). It was built this way because the principled fix
needs a change in `lib/canonical-v2/native-producer/candidate-resolution.js`, one of
the two files this task is not permitted to edit.

**Why not a bare "not"/"no" scan.** "Not" appears constantly in merger agreements
without inverting whatever comes after it in the relevant sense. Two disciplines keep
the check narrow, both validated against real corpus text before being trusted:

1. `NEGATION_LEAD_IN_RES` is a closed, specific list (modal or auxiliary verb + "not":
   "would not", "does not", "shall not", ...; "in no event"; "under no circumstances";
   "none of"; a closed "no <noun>" set covering "event", "change", "development",
   "effect", "circumstance", "fact", "breach", "failure", "action"; "never"), the same
   discipline `lib/instrument-negation.js` already applies to a different problem
   (equity-instrument mentions), not a bare "not"/"no" match.
2. The lookback window stops at the nearest clause boundary (`.`, `;`, `:`, newline),
   capped at 240 characters, and is reset to empty when a coordinating conjunction
   (", and", "; but", ", or", optionally followed by "that") sits directly against the
   quote's own start, because that conjunction means the quote opens its own,
   independently joined clause that nothing before the conjunction can govern.

**Validation before wiring in.** Before touching any production file, the guard was
tested standalone against:

- 36 of 36 real "would/does not ... have a Company/Parent Material Adverse Effect"
  qualifiers in TopBuild's actual filed merger agreement
  (`tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm`,
  converted through this repository's own `convertSecHtmlToCanonicalText`, the same
  pipeline the real ingestion path uses), simulated-trimmed: all 36 flagged.
- A stride sample of ~300 arbitrary positions across the same full filing: about 10%
  fired, and every one inspected by hand was, on reading the surrounding real text, a
  position genuinely still inside the reach of a real governing negation, not a false
  positive.
- The repository's own real fixture for `representations-dark-bridge.js`
  (`tests/fixtures/canonical-v2/dark-bridge/representations-dark-review.json`)
  contains, by construction (not by design for this task), the exact false-positive
  shape a naive check would hit: "...except as would not have a Company Material
  Adverse Effect, and the Company has actual knowledge of no fact..." where a
  legitimate quote (the knowledge clause) sits right after an unrelated proviso's
  negation, joined by "and". The reset rule above was written specifically because of
  this case and is validated against it directly, both in the standalone prototype and
  in the full representations-dark-bridge suite (still passing after the fix).

## 5. Where it was wired in, and why there, specifically

**`lib/verification.js` (fixed).** This is the highest-priority fix: the LIVE,
PRODUCTION quote-acceptance gate, not a preview surface. `fragmentAppears`'s two
containment checks (the main check and the trailing-period-tolerant fallback) and
`quoteAppearsIn`'s head-truncation fallback now go through new
`groundedContainment` / `leftGroundedContainment` helpers: word-boundary-anchored
(previously entirely absent here, a strictly weaker starting point than the dark
bridges already had) AND negation-boundary-guarded. All 49 pre-existing tests in
`tests/verification.test.js` pass unchanged. `crossRefAppearsIn` (structural section
citations, e.g. "Section 5.01(f)") was deliberately left untouched: a citation cannot
carry an inverted legal assertion the way a substantive quote can.

**`lib/canonical-v2/representations-dark-bridge.js` (fixed).** `locateGrounding`, the
single function both the fresh-build path (`adaptProvisionGroupToLegacyCard`, which
both accepts/rejects a claim's evidence quote AND computes the span carried forward as
`verbatim_span`) and the untrusted-envelope re-validation path funnel through, now
also requires `hasUnclosedNegationBeforeSpan` to clear. This is the field shape that
is exactly the attack described in `WORK-COMPLETED.md`: `materialityQualifier`
(`REPRESENTATION_ACCURACY_STANDARD`) and `knowledgeQualifier` claims ARE the operative
legal assertion text (the accuracy standard, e.g. "would not have a Company Material
Adverse Effect"), not a reference or a pointer to something else. All 23 pre-existing
tests pass unchanged; the two `KNOWN LIMITATION` tests were updated to `FIXED` and now
assert `assert.throws(..., bridgeError('QUOTE_NOT_GROUNDED'))` instead of
`assert.doesNotThrow`.

**`lib/canonical-v2/legacy-card-bridge.js` and `general-covenants-dark-bridge.js`
(no change needed).** Confirmed structurally immune by design (section 2); adding the
guard to these would be inert (no partial-containment check exists to attach it to)
and adding it to `legacy-card-bridge.js`'s one `anchoredContains` call
(`anchoredContains(bucket.text, threshold)`, matching a numeric threshold like
"$100,000" inside already-verified bucket text) was considered and rejected: a dollar
figure or percentage does not carry a directional truth claim that a preceding
negation can invert the way a prose assertion can.

## 6. `no-other-reps-fraud-dark-bridge.js`: tried, found unsafe as first written, reverted

This file has the identical pre-existing shape (`anchoredContains` /
`groundedInSource`, word-boundary-anchored, same honest "cannot close a negation drop"
comment) and was wired up the same way as representations-dark-bridge.js. It broke
real, pre-existing, legitimate tests, and was reverted rather than shipped. Recorded
in full because the failure is informative, not just the fix.

`assertGovernedClaimShape` checks every governed attribute of a fact
(`relying_party_ref`, `disclaimed_representation_party_ref`, `agreement_scope_quote`,
`extra_contractual_scope_quote`, ...) against that fact's own full evidence quote, in
one shared loop. Unlike representations-dark-bridge.js, most of these attributes are
not the operative assertion; they are POINTERS into it. First attempt: exempt only
`_ref`-suffixed attributes (this family's own contract module,
`no-other-reps-fraud-contract.js`, already names every attribute either `_ref` or
`_quote`), reasoning that a `_ref` value's own referent (a party or defined-term name)
does not change when the sentence around it is negated. That closed the first failure
(`disclaimed_representation_party_ref`, "the Company", cut from "...it is not relying
on any representation or warranty of the Company except...": "not" governs "relying",
not "the Company", and "the Company" still correctly names the disclaimed party).

It did not close the second, real, pre-existing test: `non_reliance.agreement_scope_
quote`, "except those expressly set forth in this Agreement", cut from "Parent
acknowledges that it is not relying on any representation or warranty of the Company
except those expressly set forth in this Agreement, including...". This is a
`_quote`-suffixed field, and it still false-positived, because it is, in substance,
the same kind of thing as the `_ref` case: an "except" clause names a carve-out, and
reading a carve-out on its own does not assert something false the way "have a Company
Material Adverse Effect" does on its own. The `_ref`/`_quote` naming convention does
not track the real distinction (assertion vs. scope-pointer) reliably enough to use as
a blanket rule; it happened to work for one field and not the next one tried.

**Decision: revert, not patch again.** `git checkout` restored
`lib/canonical-v2/no-other-reps-fraud-dark-bridge.js` to its committed state; its
existing 24 tests (including its own honestly-named `KNOWN LIMITATION` test) pass
unchanged. Shipping a heuristic that had already needed two rounds of reactive
patching, in a file this task has weaker real-corpus coverage for than the MAE family
(no non-reliance-disclaimer boilerplate exists in the pinned
`mae-definition-family` fixtures this task was pointed at), was judged a worse outcome
than leaving this one file's pre-existing, honestly-documented gap exactly as it was
found. The non-negotiable is fail closed, not "ship something": a heuristic that
guesses wrong in the other direction, and silently rejects a true, useful
`agreement_scope_quote`, has its own cost, and this file's pre-existing tests are the
only signal available that it was actually guessing wrong, not right.

**What would close it properly.** Split the shared `assertGovernedClaimShape` loop so
the negation guard applies only to attributes that are themselves excerpted operative
clauses, not scope- or identity-pointers. The `_ref` suffix is sound for identity
pointers. `_quote`-suffixed attributes need a further, narrower test before the guard
applies to them; the concrete false positive found here suggests one candidate rule
(exempt a candidate that itself begins with an "except"/"excluding"/"other than"/"but
for"/"save for" lead-in, since a carve-out clause's own truth value does not depend on
what it is an exception to) but that rule was NOT validated against real non-reliance
/ non-other-reps corpus text the way the representations-dark-bridge.js fix was
validated against real MAE text, and should not be trusted until it is. This family's
own dark bridge is preview-only (`Production authority is NONE`,
`lib/canonical-v2/dark-bridge-gate.js`), which is the reason this was judged safe to
leave open rather than rushed.

## 6a. One governance gate crossed along the way, recorded for the reader who reruns verification

The first full-suite run after the fix (section 11) failed exactly one test:
`tests/canonical-v2-phase1-authority-boundary.test.js`, `UNCLASSIFIED_CHANGED_SOURCE:
lib/negation-boundary-guard.js`. This repository requires every new production source
file to be explicitly classified, by capability profile, in
`lib/canonical-v2/phase1-authority-boundary-inventory.js` before it is allowed to
exist; `mae-clause-label.md`'s own status line records the same requirement for its
own new module. `lib/negation-boundary-guard.js` is called unconditionally, behind no
environment gate, from `lib/verification.js`'s live production path
(`quoteAppearsIn` / `sanitizeFeatureQuotes`), and declares zero module dependencies
(no `require`/`import` at all, confirmed by the same mechanical scan the test runs),
so it was classified `PRODUCTION_PATH_PURE_ANALYSIS`, the same class as
`lib/parse-money.js` and `lib/agreement-revision-classifier.js`, both of which are
"live product logic, not proposal or preview scaffolding" for the identical reason.
Not a defect in the fix; a real, working gate doing its job on a genuinely new file.

## 7. `docs/codex-program/WORK-COMPLETED.md` corrected

The sentence "Crude trimming is now blocked everywhere; the negation case specifically
remains open and is tracked in the roadmap's known risks, with its fix designed as
step 1b" is corrected in place, following this repository's own retraction-in-place
convention (`P1-PLAN.md`'s "Retraction: Section 7.1's boundary was never wrong", cited
approvingly in `docs/codex-program/notes/doc-reality-audit.md` Part 3: never delete a
wrong claim quietly, replace it with the correction and say so). The false "tracked...
as step 1b" claim is removed; the entry now points at this note.

## 7a. `lib/parser-v2/span-claims.js` was checked and does not close this either, despite how the roadmap reads

The brief pointed at this file specifically, "since the roadmap says it already does
the work that would make detection possible." Checked directly, against its own code
and its own header comment, not against the roadmap's summary of it.

`ROADMAP.md`'s P5 ("Record where every quotation came from") says: "Without it, a
quote that arrives already trimmed in a way that reverses its legal meaning cannot be
detected," describing `span-claims.js` (currently wired but INERT, gated behind
`opts.spanClaims === true`, never passed) as the fix once turned on. Read as intended,
that sentence implies turning it on WOULD let a reversed-meaning trim be detected. It
would not, for the exact defect this task investigated.

`computeSpanClaims` locates an item's position by calling `locateInSection(sectionText,
itemText)`, and `itemText` is whatever the caller hands it (`item.text || item.quote ||
item.full_text`), already fully formed by the time this module ever sees it. The
module's own header says as much: "this runs strictly AFTER extraction, against text
the model already produced." If that text already had its governing negation trimmed
off before span-claims.js runs, `locateInSection` will happily find "have a Company
Material Adverse Effect" as a genuine substring of the section and return a
perfectly self-consistent span for it, exactly the same failure mode as
`representations-dark-bridge.js`'s pre-fix `locateGrounding`: a real position for a
false quote is still a real position, and re-deriving it from already-wrong text
proves nothing.

What `span-claims.js` genuinely would catch, once turned on: a LATER, second change to
an item's stored text that no longer matches the span computed the first time round,
the same "hand-tampered envelope with a stale span" case
`representations-dark-bridge.js`'s tier 1 already defends against for its own family.
That is a real, useful property (P5 is not wrong to want it), but it is a different
property from "detect a reversed-meaning trim at first extraction," and the roadmap
entry's own wording does not draw that distinction, which is worth fixing there
separately from this note, since a reader who turns P5 on expecting THIS defect to
close will not get that.

## 8. The principled fix belongs in `candidate-resolution.js`, which this task cannot edit

`lib/canonical-v2/native-producer/candidate-resolution.js` is owned by another active
agent for this task and was not edited. What follows is a specification, not a diff
against real line numbers: the file is 10,113 lines and under active edit by its
owning agent, so a literal patch would go stale immediately and could mislead whoever
picks this up. This is guidance for that owner, not a drop-in change.

**Why the fix belongs there, not in a bridge.** Every grounding check this task can
reach (the bridges, `lib/verification.js`) answers "is this candidate text a genuine,
appropriately-bounded substring of a comparison text I already trust." None of them
has access to the ORIGINAL, untrimmed value the model returned before whatever
resolution-stage narrowing happened; by the time a bridge sees a claim, the trim (if
any) has already happened, upstream, invisibly. `representations-dark-bridge.js`'s own
pre-existing comment says this plainly: closing the build-time gap "would require the
resolver to capture and forward a genuine per-attribute start/end offset." That
resolver is `candidate-resolution.js`. It already has the pieces this needs: a
`charToByteOffset` helper (line ~1609, UTF-16 index to UTF-8 byte offset, exactly the
conversion this repository's own standing warning says to reuse rather than
reimplement) and, per its docstring investigation trail, direct access to
`admitted_source_context.source_text`, the real, complete document text a claim's
`raw_value` is checked against.

**The shape of the fix**, illustrative only, not a literal patch:

```
At the point candidate-resolution.js first accepts a claim's raw_value/quote
against admitted_source_context (or a section's text), for every field this
task's investigation found is an operative assertion rather than a reference
(materialityQualifier / REPRESENTATION_ACCURACY_STANDARD and knowledgeQualifier
in representations, the equivalent accuracy-standard fields in other families
that carry a materiality qualifier):

  const { hasUnclosedNegationBeforeSpan } = require('../../negation-boundary-guard');
  // (NOT one of the two files this task could not edit -- already safe to import)

  const groundedAt = sourceText.indexOf(claim.raw_value);
  // ... existing word-boundary / acceptance logic ...
  if (groundedAt !== -1 && hasUnclosedNegationBeforeSpan(sourceText, groundedAt)) {
    // fail closed: reject, or route to a typed residual for human review --
    // this repository already has that pattern (see the commit that introduced
    // "unverifiable evidence is a typed residual, not a silent drop").
  }

  // On acceptance, carry the position forward, not just the text:
  claim.evidence_span = { start: groundedAt, end: groundedAt + claim.raw_value.length };
  // (byte offsets, if that is what gets persisted, via charToByteOffset --
  // never compare this JS-string index directly against a stored byte value)
```

Carrying `evidence_span` forward means `representations-dark-bridge.js`'s existing
tier-1 mechanism (`verifiedAgainstSpan`, `claim.verbatim_span`) would finally be doing
what its own comment already claims it does: verifying against a position captured
BEFORE any trim could happen, not one re-derived, after the fact, from text that may
already be wrong. Today that tier only ever protects against a hand-tampered envelope
that changes text while leaving an old, stale span in place; it cannot help at first
build, because, in the resolver's and bridge's own words, "build time has no prior
value to compare it against." A genuine pre-trim offset from the resolver is the only
thing that gives build time a prior value.

**This was not implemented, and could not safely be, within this task's scope**, for
two reasons beyond the file-ownership rule: first, deciding WHICH fields across the
other twenty-plus registered families (`producer-prompt-registry.js`) are
"operative assertions" versus "references," the same judgement call that broke the
first attempt at `no-other-reps-fraud-dark-bridge.js` (section 6), is exactly the kind
of per-family, per-field legal-shape judgement this brief said should be specified
rather than guessed at under time pressure if it is not clearly mine to make; second,
changing what `candidate-resolution.js` accepts or rejects changes extraction
behaviour for every family it resolves, and verifying that safely needs the golden
evaluation harness and a real corpus run, not a unit test against one fixture.

## 9. Hostile tests, all against real committed source text

`tests/negation-boundary-guard.test.js` (13 tests, new): the guard module tested
directly, and `lib/verification.js`'s production path tested end to end
(`quoteAppearsIn`, `sanitizeFeatureQuotes`), against TopBuild's and Modiv's actually
filed merger agreements (`tests/fixtures/canonical-v2/mae-definition-family/*-raw-
fetched.htm`), converted through this repository's own real
`convertSecHtmlToCanonicalText` pipeline, not hand-copied or paraphrased text. Covers,
per the brief's non-negotiable list:

- the exact "would not have a Material Adverse Effect" shape: TopBuild's real
  "...individually or in the aggregate, would not be reasonably expected to have a
  Company Material Adverse Effect" (the corpus's own real phrasing; the literal eight-
  word string from the brief's illustrative example does not occur verbatim in either
  filing, checked directly, so the corpus's real equivalent was used instead of
  inventing prose to match the illustration word for word);
- a quote legitimately containing "not" that must still pass: TopBuild's real "there
  has not been any Effect that, individually or in the aggregate, has had or is
  reasonably expected to have a Company Material Adverse Effect.";
- a negation separated from the quote by intervening words: Modiv's real "in no event
  would any of the following, alone or in combination, be deemed to constitute...";
- a double negative: searched both full filings directly; no genuine CANCELLING double
  negative near MAE language was found in either. The closest real analogue, and used
  instead, is TopBuild's real compound negation, "Except as does not and would not be
  reasonably expected to have, individually or in the aggregate, a Company Material
  Adverse Effect", two negation cues reinforcing one negation rather than cancelling
  each other; dropping either cue still inverts the clause, and the guard flags the
  fragment with both stripped.

`tests/canonical-v2-representations-dark-bridge.test.js`: two pre-existing hostile
tests (the fixture's own accuracy-standard and knowledge-qualifier negation-drop
attacks) flipped from documenting the gap to proving the fix, plus the file's other 23
tests confirmed unaffected, including the specific coordinating-conjunction false-
positive case (section 4).

## 10. What was proved versus what was judged

Proved, by running real code against real, committed source text, not asserted:
that the WORK-COMPLETED.md tracking claim was false (a full-text search, reproducible);
that the negation-drop attack was accepted, unmodified, by the live production
ingestion path before this fix (`sanitizeFeatureQuotes`, real Modiv text); that it is
rejected after the fix, by the same function, same input; that the representations-
dark-bridge.js fix closes both of its own pre-existing `KNOWN LIMITATION` tests; that
the no-other-reps-fraud-dark-bridge.js attempt broke real, pre-existing tests (not
hypothesised to, actually run and observed to).

Judged, and stated as judgement rather than proof: that `_ref`-suffixed attributes are
safe to exempt (reasoned from this family's own naming convention and one real
fixture's example, not exhaustively checked against every family that will ever use
this shape); that General Covenants and Material Contracts do not need this fix
(reasoned from their exact-equality design, not fuzz-tested against an attempted
bypass); that the "except"-clause exemption sketched in section 6 would close
`no-other-reps-fraud-dark-bridge.js` safely (a hypothesis, explicitly not implemented
or validated); that scoping the guard to specific field shapes, rather than attributes
generally, is the right dividing line at all, as opposed to some other distinction
this investigation did not consider. Where this note states a number or a test result,
it is measured; where it recommends a next step, that is offered as judgement, not
represented as already checked.

## 11. Verification

```
CI=true npm test > /tmp/negation2.log 2>&1; echo "EXIT=$?"
```

`EXIT=0`. 7718 tests, 7676 pass, 0 fail, 42 skipped, 251 seconds, against this
branch's working tree with every change in this note applied (other agents'
concurrent, unrelated edits included, per this task's own file-ownership rule). Read
from `$?` on the `npm test` command itself, per this task's own standing instruction,
never through a pipe to `tail`/`head`.

This was the second full run. The first, run before section 6a's fix, failed exactly
one test (`UNCLASSIFIED_CHANGED_SOURCE: lib/negation-boundary-guard.js`, section 6a);
every other test, across both runs, passed on the first attempt. One further, narrow
cleanup (an unused, never-called export, `boundaryLooksTrimmed`, removed from
`lib/negation-boundary-guard.js`) landed after this second full run started; it was
re-verified separately afterward with a targeted run of every directly affected file
(`tests/verification.test.js`, `tests/negation-boundary-guard.test.js`,
`tests/canonical-v2-representations-dark-bridge.test.js`,
`tests/canonical-v2-phase1-authority-boundary.test.js`,
`tests/canonical-v2-no-other-reps-fraud-dark-bridge.test.js`): 130 tests, 130 pass, 0
fail.
