# Citation scope: should the producer see the sections its quote cites?

Status: DRAFT, written incrementally. Offline design work only -- no model
call was made, no live extraction path was changed, `native-extraction-run.js`'s
dispatch invariant is unmodified, `docs/codex-program/ROADMAP.md` and
`EXECUTION-LEDGER.md` were not touched (other agents own those files).

Everything under "Part 1" and "Part 2" below is independently reproduced
this session, not taken on trust from `docs/codex-program/P1-PLAN.md` or
`docs/codex-program/notes/trigger-override-fix.md`, even where it agrees
with them. Where this document only cites a source without re-deriving it,
that is stated.

## Answer, up front

**Yes, narrowly: dispatch the cited section as its own, ordinary, independent
single-section call, and correlate its result back to the citing candidate
by reference string, never by sharing a byte buffer.** This is "Option B" in
the brief's list. The reasoning and the rejected alternatives are in Parts
3-6. The short version: the byte-offset verification contract
(`checkEvidenceScope`, `deriveGlobalEvidenceSpan` in
`lib/canonical-v2/native-producer/native-extraction-run.js`) is built
assuming exactly one contiguous span per call and does not survive a
multi-span call unmodified; two independent single-section calls need no
change to it at all, and the codebase already has a shipped, working
precedent for representing a cross-section fact this way
(`TRIGGERED_BY` relationships on QXO/TopBuild and Landos/AbbVie). Separately,
real cited text run through the existing deterministic trigger-vocabulary
table only cleanly resolves 1 of 9 real bare-citation candidates on Modiv
(Part 4) -- the other 8 need a reader, not a keyword table, which is
independent evidence for a model-based answer regardless of the byte-offset
question.

---

## Part 1: Verifying the premise

### 1.1 Why the one-section-per-call rule exists

Read in full: `lib/canonical-v2/native-producer/native-extraction-run.js`,
its ~155-line file header (lines 1-154), plus `checkEvidenceScope` (333-358)
and `deriveGlobalEvidenceSpan` (395-417), which are the two functions that
actually enforce it.

**The stated reason is evidence integrity, not cost.** The header's own
words: "The producer is handed only the resolved section's own exact text as
`governed_scope.source_text` (never the whole document), so a compliant
provider's evidence offsets are necessarily local to that section's bytes"
(lines 38-41), and separately, on why an unresolvable reference throws
before any call is made rather than falling back to the whole document:
"a silent scope widening would make a NOT_EXAMINED reference look like a
real search" (line 36). I searched this file and
`docs/superpowers/specs/2026-08-02-family-termination-fee-design.md` for
"cost" or "token" as a stated rationale for the one-section rule and found
neither -- "cost" in the family spec means review-queue cost (a human item),
never API spend. Nothing in the file header frames narrow dispatch as a
spend control. It is framed, throughout, as: never let a proposal claim
evidence for text the model was not actually shown.

**There is a real, historical, non-hypothetical hallucination finding
behind this, though not in this file.** `docs/archive/handoffs/F28-FIRST-LIVE-RUN.md`,
finding 3 (lines 293-303): on a real live run, scoped to a single
representation's ~4,689 bytes containing no digit sequence "3.1" anywhere in
what the model was shown, every extracted fragment's `section_reference`
nonetheless read `"3.1(b)(i)"`, `"3.1(b)(ii)"`, etc. -- a plausible,
convention-shaped citation the model invented, not copied. The handoff's own
conclusion: "`section_reference` is a free-text metadata field, not a
verbatim-quote field, so it is **not** caught by the byte-exact evidence
gate -- this is a class of hallucination the current architecture has no
mechanism to detect at all." `citation-constructibility.js` exists because
of this: it treats the model's own citation as "a cross-check, not a
source" and independently re-derives the true citation from the sectionizer's
tree (`citation-constructibility.js:21-36`). This matters for Part 5 below:
scope narrowness is not the only defence against this failure mode in this
codebase, and citation-constructibility's existence means widening scope
does not automatically make `section_reference` hallucination worse than it
already, independently, is guarded against.

**The mechanism that actually enforces the rule is a single-buffer,
single-offset-base scheme, and this is the part that does not generalise for
free.** Concretely: `sliceSectionText(sourceText, node.start, node.end)`
(lines 300-302) cuts exactly one contiguous span out of the full document
per call. `checkEvidenceScope(proposal, sectionBytes)` (333-358) takes that
ONE buffer and checks every evidence edge's `absolute_start`/`absolute_end`
are in `[0, sectionBytes.length)` and that the byte slice at those offsets,
read out of that SAME buffer, equals the proposal's own `raw_value` exactly.
`deriveGlobalEvidenceSpan(proposal, sectionStart)` (405-417) later converts a
verified local offset back to a document-global one by adding exactly ONE
`sectionStart`. Every one of these three functions is written for exactly
one contiguous span. This is the part I was asked to work out and had not
been told the answer to; the finding is in Part 3.

**Conclusion on 1.1:** the rule is not arbitrary, and the strongest reason to
respect it is evidence-grounding (never claim evidence for unexamined text),
enforced today by machinery that structurally assumes one span. Cost is a
real, separate cost of any option that adds calls (quantified in Part 6),
but it is not why this rule exists.

### 1.2 The null `trigger_code` claim, verified directly

Parsed `raw_response_text` (stripping the model's own ` ```json ` fence) out
of `evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/native-producer-recorded-response-7.3.json`
via `node -e`, not by reading the rendered file. All six `fee_trigger_assertions`
entries carry `trigger_code: null`:

| # | quote | trigger_code |
|---|---|---|
| 0 | "by Parent pursuant to Section 7.1(d)(ii)" | null |
| 1 | "by the Company pursuant to Section 7.1(c)(i)" | null |
| 2 | "(A) (1) by the Company or Parent pursuant to Section 7.1(b)(ii) and a Company Acquisition Proposal shall have been received... or (2) by the Company or Parent pursuant to Section 7.1(b)(iii) and a Person shall have publicly proposed..." | null |
| 3 | "by Parent pursuant to Section 7.1(d)(i)" | null |
| 4 | "by Parent pursuant to Section 7.1(d)(iii)" | null |
| 5 | "terminated by the Company pursuant to Section 7.1(c)(ii) or Section 7.1(c)(iii)" | null |

Confirmed as stated in the brief.

**Extends further than the brief's framing.** The same parse of
`native-producer-recorded-response-8.12.json` shows Section 8.12
(Definitions) independently produced FIVE MORE `fee_trigger_assertions`
entries, also all `trigger_code: null`, citing "Section 7.3(b)(i)" through
"Section 7.3(b)(v)" -- these exist because 8.12(m)'s "Company Base Amount"
definition itself gates on which of those five sub-clauses fires. So the
real bundle-wide count of bare-citation, null-`trigger_code` fee-trigger
candidates in this evidence set is **9, not 6**: 6 citing into Section 7.1
from 7.3, and 5 citing into Section 7.3(b) from 8.12. This second set turns
out to matter a great deal in Part 2 and Part 4 below: it is not a second,
independent hop into new territory, it is a *chained* citation (8.12 cites
7.3(b)(i), and 7.3(b)(i)'s own text is itself just "(i) by Parent pursuant to
Section 7.1(d)(ii),"  -- another bare citation, one hop further into 7.1).

Section 7.1's own recorded response (`native-producer-recorded-response-7.1.json`)
is worth reading precisely because of what it does *not* contain: dispatched
as its own full section this same run, it produced exactly ONE
`fee_trigger_assertions` entry (the Superior Proposal ground, `trigger_code:
"SUPERIOR_PROPOSAL_TERMINATION"`), not six. This confirms something the
citation-following design needs to be honest about: **a section being
already-dispatched in the same run does not mean its own output already
answers the cross-reference.** The termination-fee prompt (see 1.3) asks
the model reading Section 7.1 to find *fee-linked* assertions; from within
7.1 alone, most of its termination grounds do not textually connect to a
fee (that connection is stated in 7.3, not 7.1), so the model correctly did
not flag them. Any design based on "just join what was already dispatched"
would not have worked for 5 of these 6 candidates even before considering
whether the join is legitimate.

### 1.3 The resolver fix, and why it forecloses resolver-side recovery

Read `lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleFeeTriggerCandidate` (5733-5875) in full, and
`docs/codex-program/notes/trigger-override-fix.md` in full.

The fix added two gates, both AFTER the existing zero-match /
multi-match checks, and both keyed on the model's own `triggerCode`, not on
how many patterns matched:

```js
// lines 5845-5863, candidate-resolution.js
const singleMatchedCode = matchedCodes[0];
if (!triggerCode) {
  pushReviewUnresolved({
    entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
    reasons: ['TRIGGER_NOT_ASSERTED'],
    ...
  });
  return;
}
if (triggerCode !== singleMatchedCode) {
  pushReviewUnresolved({
    ...
    reasons: ['TRIGGER_CORROBORATION_DISAGREES'],
    ...
  });
  return;
}
```

The `!triggerCode` branch fires **unconditionally** whenever the model's own
`trigger_code` is null, regardless of how many patterns matched the text
that was checked, and regardless of *which* text was checked. This is the
crux: `triggerCode` (the value on the left of both `if`s) can only ever
become non-null through the model's own structured output. No pattern-table
change, no matching refinement, no widening of `FEE_TRIGGER_CORROBORATION_TABLE`,
and no change to *what text the corroboration table is run against* can
manufacture a non-null `triggerCode`, because the corroboration table's
output (`matchedCodes`) is never itself written back into `triggerCode` --
it can only be *compared* to it. On all 6 (in fact 9, see 1.2) real bare
citations in this evidence set, `triggerCode` is null because the model was
never shown the cited text, not because it read the cited text and declined
to name a ground. Confirmed against `termination-fee-producer-prompt.js`
line 195: the model is explicitly instructed that a bare-citation quote
"still gets its own `fee_trigger_assertions` entry with `trigger_code` null
if you cannot otherwise identify the ground -- do not invent descriptive
text that is not in the source." Null here is not abstention-after-reading;
it is the model correctly declining to guess at content it cannot see.

**This is why the brief's framing holds up under direct code reading, not
just by report:** a resolver-only change, no matter how it is built, cannot
touch this gate's outcome, because the gate does not consult the pattern
table at all until *after* it has already confirmed `triggerCode` is
non-null. The only lever left is getting the model to assert a real
`triggerCode` for the ground the citation names -- which requires showing it
that ground's own text. This is genuinely an extraction-scope question. I
looked for a way this conclusion could be wrong -- e.g. a resolver path that
treats a clean single pattern-match on cited text as equivalent to a model
assertion -- and concluded in Part 4 that this would not just contradict the
principle the fix just established, it would reproduce the fix's own bug on
different text (a real, reproduced instance of exactly that recurrence is in
Part 4).

---

## Part 2: what `findSectionByReference` can and cannot resolve

Read `lib/canonical-v2/native-producer/deterministic-sectionizer.js` in
full. The function itself, lines 919-925:

```js
function findSectionByReference(tree, reference) {
  if (!tree || !reference) return null;
  const nodes = Array.isArray(tree) ? tree : tree.nodes;
  if (!Array.isArray(nodes)) return null;
  const normalized = String(reference).trim();
  return nodes.find((node) => node.reference === normalized) || null;
}
```

**Confirmed: plain first match, no ambiguity detection.** `Array.prototype.find`
returns the first element satisfying the predicate and stops; there is no
check anywhere in this function, or called by it, for a second node sharing
the same `reference` string. If two nodes ever did share a reference (an
annexed agreement repeating the main document's numbering, an exhibit that
defines its own "Section 7.1"), this function would silently return
whichever one the tree lists first, with no signal that a second match
existed. This is exactly as reported. It also means: whatever design
follows a citation MUST perform its own independent duplicate check before
trusting a single match, because this function will never tell you it found
more than one.

**Confirmed: `8.12(gg)` and `8.12(vv)` return null**, by direct call
against the real, re-derived Modiv tree (not by trusting the run script's
comment, though it says the same thing):

```
8.12(gg) -> null
8.12(vv) -> null
8.12(f)  -> RESOLVED
8.12(m)  -> RESOLVED
```

The mechanism is visible by dumping every `8.12*`-prefixed reference in the
tree (74 nodes). Up to `8.12(y)` the tree is flat and correct. At `8.12(z)`
(itself a real defined term, "Intellectual Property", whose own internal
sub-points happen to be lettered (a)-(f)) the sectionizer's marker-depth
heuristic reads the document's *next* top-level letter, "(aa)", as a CHILD
of `(z)`'s own inner list rather than as `(z)`'s sibling, and every
subsequent top-level letter cascades the same way:

```
8.12(z)(aa)(bb)(cc)(dd)(ee)(ff)(gg)(hh)... down through (zz),
then restarts as 8.12(z)(aaa)(bbb)(ccc)... for the next 26
```

So the real, printed "(gg)" clause (the run script's own header names this
as "Parent Base Amount") exists in the tree only as the deeply nested
reference `8.12(z)(aa)(bb)(cc)(dd)(ee)(ff)(gg)`, never as `8.12(gg)`. This is
a second, independent, real sectionizer defect (matches "SEC2" in
`docs/codex-program/P1-PLAN.md` Part 6) -- separate from the marker-depth
issue's specific numbers, this session re-derived it directly rather than
citing the plan's description of it.

**What this means for a citation-following design: it cannot follow a
citation the tree cannot address, and on this document, an entire run of
printed sub-clause letters after `(z)` is unaddressable by their own printed
names.** No live recorded response happens to cite `8.12(gg)` or `8.12(vv)`
directly -- the Modiv run script sidesteps this by pinning the whole `8.12`
node rather than any sub-clause of it (its own header, lines 28-46, says so
explicitly) -- but that is a workaround for a known landmine, not evidence
the addressing scheme is safe in general. Any citation-following design
must fail closed, per-citation, the moment `findSectionByReference` returns
null or (independently checked) more than one node -- never guess, never
widen to a parent node as a substitute.

### 2.1 Offline harness: every cross-reference actually cited in the recorded Modiv responses

Built `scripts/canonical-v2-citation-scope-resolution-harness.mjs` (new
file, this session): reproduces the exact source-admission pipeline the live
run script uses (same modules, same pinned hashes, re-verified, zero network
or model calls), sectionizes the real Modiv text, extracts every
`"Section X..."`-shaped citation out of every string field in all three
recorded responses (7.1, 7.3, 8.12), resolves each distinct one against the
tree, and independently counts how many nodes in the WHOLE tree share that
exact reference string (the ambiguity check `findSectionByReference` itself
cannot perform). Run via `node scripts/canonical-v2-citation-scope-resolution-harness.mjs`.

**Whole-tree ambiguity scan (independent of what got cited): zero reference
collisions anywhere in Modiv's 472-node tree.** Confirms the P1 plan's claim
that Modiv itself has no duplicate references, checked exhaustively this
session rather than assumed.

**18 distinct reference strings are cited across the three recorded
responses. All 18 resolve to exactly one node. Zero ambiguous. Zero null.**

| reference | status | occurrences | cited from |
|---|---|---:|---|
| 5.11 | RESOLVED | 3 | 7.3 |
| 7.1(b)(ii) | RESOLVED | 4 | 7.3 |
| 7.1(b)(iii) | RESOLVED | 3 | 7.3 |
| 7.1(c)(i) | RESOLVED | 1 | 7.3 |
| 7.1(c)(ii) | RESOLVED | 1 | 7.3 |
| 7.1(c)(iii) | RESOLVED | 1 | 7.3 |
| 7.1(d)(i) | RESOLVED | 1 | 7.3 |
| 7.1(d)(ii) | RESOLVED | 1 | 7.3 |
| 7.1(d)(iii) | RESOLVED | 1 | 7.3 |
| 7.2 | RESOLVED | 2 | 7.3 |
| 7.3 | RESOLVED | 2 | 7.3 |
| 7.3(b) | RESOLVED | 2 | 7.1, 8.12 |
| 7.3(b)(i) | RESOLVED | 2 | 8.12 |
| 7.3(b)(ii) | RESOLVED | 2 | 8.12 |
| 7.3(b)(iii) | RESOLVED | 5 | 7.3, 8.12 |
| 7.3(b)(iv) | RESOLVED | 2 | 8.12 |
| 7.3(b)(v) | RESOLVED | 2 | 8.12 |
| 7.3(c) | RESOLVED | 1 | 8.12 |

**Two caveats that make "18/18 resolve" less reassuring than it looks, both
found by the harness, not assumed:**

1. **This corpus never once cites a sub-clause of 8.12 after `(z)`.** The
   run that produced these recorded responses deliberately pinned the whole
   `8.12` node rather than dispatching `8.12(gg)`/`8.12(vv)` as their own
   scopes, specifically because those references do not resolve (2 above).
   A clean 18/18 here is a property of a corpus that already routed around
   the one confirmed landmine on this document, not proof the addressing
   scheme is safe on citations in general.
2. **5 of the 18 "resolved" references resolve to a node whose own text is
   itself still just a bare citation.** `7.3(b)(i)`'s entire node text is
   `"(i) by Parent pursuant to Section 7.1(d)(ii),"` -- 46 bytes, no ground
   description at all, the sectionizer's answer to "what does 7.3(b)(i)
   say" is itself another bare cross-reference into 7.1. Same for `(ii)`,
   `(iv)`. `(v)` and `(c)` are slightly longer but the additional text is
   payment mechanics ("then the Company shall pay... by wire transfer..."),
   never a restatement of the ground. **A citation-following design that
   assumes one hop is enough would resolve these 5 to nothing useful.** The
   real ground text is one hop further, in Section 7.1. This is a chained
   citation, and it is real, present-today data, not a hypothetical edge
   case: it accounts for 5 of the 9 bare-citation trigger candidates counted
   in Part 1.2.

**Honest count, as asked for:** of the 18 distinct cross-references
actually cited in the three recorded Modiv responses, the sectionizer
resolves **18 to exactly one node, 0 ambiguously, 0 to null** -- and,
separately and just as important, **8.12(gg) and 8.12(vv), the two specific
references this task asked about, both resolve to null** when tested
directly (they are not among the 18 because this corpus avoids citing them,
not because they would have worked). Of the 18 that do resolve, 5 resolve to
a node that is itself still a bare citation one hop short of real ground
text.

---

## Part 3: does the byte-offset verification contract survive more than one span in scope?

This is the question the brief flagged as the one most worth worrying
about. Traced the exact mechanism in
`lib/canonical-v2/native-producer/native-extraction-run.js`:

1. `sliceSectionText(sourceText, node.start, node.end)` (300-302) cuts one
   contiguous byte range out of the full document.
2. The dispatch loop (`for (const { reference, node } of resolved)`,
   573-589) builds exactly one `governedScope` per requested reference, each
   with its own `source_text: sectionText` -- one call, one buffer, always.
3. `checkEvidenceScope(proposal, sectionBytes)` (333-358) bounds-checks
   every evidence edge against `[0, sectionBytes.length)` of that ONE
   buffer, and byte-slices `raw_value` out of that SAME buffer.
4. `deriveGlobalEvidenceSpan(proposal, sectionStart)` (405-417) converts a
   verified local offset back to a document-global one with `sectionStart +
   edge.absolute_start` -- one constant added to every offset in the
   proposal.

Every one of these four steps is written for **exactly one contiguous span
per call.** None of them takes a segment map, none of them asks "which
sub-range of the buffer did this offset fall in." This is not a defect --
it is a correct, minimal implementation of a contract that has never
needed to represent more than one span. The question is what happens to
each option when that stops being true.

**Option A (expand the dispatched span to include the cited section) and
Option C (pass cited text as labelled secondary context) both put more than
one original document range inside one `governed_scope.source_text`, and
neither survives today's verification code unmodified:**

- If the two spans are concatenated into one buffer, `checkEvidenceScope`'s
  bounds check still mechanically "passes" (it only checks against the
  buffer's total length), but it can no longer tell you *which original
  section* an evidence edge's bytes actually came from -- exactly what
  `deriveGlobalEvidenceSpan`'s single `sectionStart` needs to know and
  cannot represent. Both functions would need to become segment-aware:
  carry the boundaries of each concatenated segment, and for a given local
  offset, know which segment it falls in and which original node's `start`
  to add. This is buildable, but it is new code with no existing test to
  model it on, in a function that is currently one of the more heavily
  load-bearing, unmodified-since-inception pieces of this pipeline.
- Option C specifically needs a **new enforcement rule that does not exist
  anywhere in this codebase today**: reject any evidence edge whose local
  offset falls inside the secondary segment, so a "read but never quote"
  instruction is actually enforced in code, not just in prompt text. The
  important nuance here, found while re-reading `checkEvidenceScope`: the
  existing byte-exact check is already very good at stopping *fabricated*
  text (a quote that does not appear anywhere in the buffer fails
  immediately, regardless of how many spans are in scope) -- the F28
  hallucinated-citation finding (1.1 above) was a metadata-field failure,
  not a quote failure, precisely because quotes ARE byte-checked and
  `section_reference` is not. So Option C's real, additional risk is not
  that the model invents bytes -- it is **misattribution of real bytes**:
  correctly quoting words that genuinely appear in the cited section, but
  presenting them as if they were the primary provision's own operative
  text. Nothing in `checkEvidenceScope` today distinguishes "these bytes
  came from the section this candidate is about" from "these bytes came
  from context supplied alongside it" -- that distinction would have to be
  invented, and if it were forgotten, nothing would fail: there is no test
  today that could catch its absence, because the scenario does not exist
  yet.

**Option B (a second, independent, single-section call dispatched against
the cited section) needs zero changes to any of the four steps above.**
Each call, the original and the follow-up, is still exactly one section,
one buffer, one `sectionStart`. The existing contract is not stretched, it
is simply invoked twice. What is new is not a wider evidence span, but a
**relationship between two independently-verified facts**, joined after
both have already been verified on their own terms.

**This is not a novel idea for this codebase -- it is already shipped, on
real deals, for exactly this shape of problem.**
`lib/canonical-v2/qxo-termination-fee-admitted-slice.js` (lines 496-510)
builds `TRIGGERED_BY` relationships connecting a termination-fee claim to
each of its termination grounds:

```js
const relationships = freeze(GROUNDS.map((ground, index) => buildRelationshipRevision({
  source_occurrence_id: feeComponent.provision_component_id,
  relationship_definition_key: 'TRIGGERED_BY',
  ...
  target_occurrence_ids: [groundComponents[index].provision_component_id],
  effect: ground.effect,
  evidence: [
    claimEvidence(excerpts.fee_payment, 'DERIVATION_INPUT', agreementSourceContext.source_ordinal),
    claimEvidence(excerpts[ground.key], 'CROSS_REFERENCE', agreementSourceContext.source_ordinal),
  ],
  ...
})));
```

Two evidence edges, each independently anchored to its own section's own
bytes (`fee_payment` in the fee section, `excerpts[ground.key]` in the
ground's own section), joined by a relationship rather than by a shared
buffer. `TRIGGERED_BY` is a fully registered relationship key
(`contract-bundle.js:3715`, `EXPECTED_RELATIONSHIP_KEYS`), already used by
hand on QXO/TopBuild (six instances) and Landos/AbbVie
(`lib/canonical-v2/reviewed-termination-fee-slice.js`). It has never run
inside the automatic, model-driven path (`candidate-resolution.js` never
constructs one, confirmed by grep) -- which is exactly the gap Option B
closes.

**Conclusion on Part 3, the question I was told to worry about most: the
byte-offset verification contract does not survive a multi-span single call
without new, currently-nonexistent, safety-critical code. It survives two
independent single-section calls with no change at all, and the target data
shape for joining them is already proven in production on two real deals.**
This is the single strongest technical reason to prefer Option B over
Option A or C, independent of anything about cost or prompt design.

---

## Part 4: what the cited text's own vocabulary would actually match

Even if every citation resolved cleanly and cheaply, would a purely
mechanical pass over the cited text -- no model, just the existing
`feeTriggerCorroboratedCodes` pattern table -- be enough on its own? The
harness answers this on real text for all 9 bare-citation candidates from
Part 1.2 (running the SAME, unmodified `feeTriggerCorroboratedCodes` export
from `candidate-resolution.js` against each cited node's own sliced text,
informationally -- no claim is constructed, nothing is published):

| cited section | text (summarised) | pattern-table result |
|---|---|---|
| 7.1(c)(i) | Superior Proposal fiduciary-out ground | `SUPERIOR_PROPOSAL_TERMINATION` -- clean single match |
| 7.1(d)(i) | Company/Partnership breach of reps/covenants, uncured, backstopped by the Outside Date as the cure deadline | `OUTSIDE_DATE_TERMINATION`, `COUNTERPARTY_COVENANT_BREACH_TERMINATION` -- two matches |
| 7.1(d)(ii) | Board recommendation breakdown: Adverse Recommendation Change, failure to recommend against a tender offer, failure to reaffirm, or signing an Alternative Acquisition Agreement | `CHANGE_IN_RECOMMENDATION_TERMINATION`, `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` -- two matches |
| 7.1(d)(iii) | Conditions satisfied, notice given, other side ready, Company fails to close | zero matches |
| 7.3(b)(i) | "(i) by Parent pursuant to Section 7.1(d)(ii)," -- itself a bare citation | zero matches |
| 7.3(b)(ii) | "(ii) by the Company pursuant to Section 7.1(c)(i)," -- itself a bare citation | zero matches |
| 7.3(b)(iii) | tail/topping-fee mechanism, mentions "Company Common Stockholders' Meeting" only as a subordinate timing reference | `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` -- single match |
| 7.3(b)(iv) | "(iv) by Parent pursuant to Section 7.1(d)(i), or" -- itself a bare citation | zero matches |
| 7.3(b)(v) | "(v) by Parent pursuant to Section 7.1(d)(iii)," then payment mechanics only | zero matches |

**Reading these as a lawyer, not just as a pattern-match count, sharpens
what this table means:**

- **7.1(c)(i): genuinely clean.** One ground, one code, real corroborating
  evidence for the model-and-text-agree design in Part 6.
- **7.1(d)(i) and 7.1(d)(ii): the two-match results are false ambiguity, not
  real ambiguity.** 7.1(d)(i) is a counterparty-breach ground whose cure
  clause happens to mention "the Outside Date" as the backstop deadline for
  curing -- the regex fires on that incidental mention, not because this
  clause is actually an Outside-Date-termination ground (that is a
  different, separately-cited clause, 7.1(b)(ii)). 7.1(d)(ii) is a
  board-recommendation-breakdown ground whose subclause (C) happens to
  mention the "Company Common Stockholders' Meeting" only to fix a notice
  timing window -- the regex fires on that mention, not because this clause
  is about a stockholder vote failing (that is, again, a different clause,
  7.1(b)(iii)). A competent reader resolves both cleanly on a first read;
  the fixed-vocabulary regex table cannot tell an operative subject from an
  incidental one.
- **7.3(b)(iii)'s single match is the exact, already-diagnosed Risk B bug,
  reproduced identically one hop away.** This is the same
  `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` false positive
  `docs/codex-program/notes/trigger-override-fix.md` was written to stop --
  same underlying quote, same spurious "Stockholders' Meeting" mention
  inside a topping-fee timing clause, not a real stockholder-vote-failure
  ground. **If any design ran this pattern table over cited text and
  auto-published on a clean single match, it would republish, on cited
  text, precisely the bug that was just fixed on primary text.** This is
  not a hypothetical risk -- it is reproduced, on real data, in this
  session.
- **7.1(d)(iii) and the three chained citations (7.3(b)(i), (ii), (iv)):
  zero matches, honestly.** 7.1(d)(iii) is a real vocabulary gap (a
  ready-to-close-but-didn't walkaway right that does not cleanly fit any of
  the seven controlled codes as worded); the three chained ones are zero
  matches because their own text is not a ground at all, it is another
  citation one hop further in.

**Conclusion on Part 4:** even granting perfect, ambiguity-free addressing,
a purely deterministic pass over cited text would cleanly and *correctly*
resolve only 1 of these 9 real candidates (7.1(c)(i)), would need a second
hop for 3 more, would produce a real, reproduced false positive on a 5th if
allowed to auto-publish, and would honestly abstain on the rest. This is
independent evidence, beyond the model-and-text-must-agree principle from
Part 1.3, for why the answer runs through a model reading the cited text,
not a keyword table matching it.

---

## Part 5: the options, weighed

**(a) Expand the dispatched span to include cited sections.** Rejected.
Requires the segment-aware byte-verification rework Part 3 shows does not
exist today (new bounds logic, new global-offset mapping); makes "which
section does this candidate belong to" ambiguous for every downstream
consumer that assumes one candidate maps to one governing section
(`finalizeTerminationFeeClaim`'s own `sectionsByReference.get(entry.section_reference)`
lookup, `citation-constructibility.js`'s per-candidate derived citation,
materiality/grouping keyed on `sectionReference`); and touches
`native-extraction-run.js`, shared, heavily-depended-on infrastructure every
other family also dispatches through, for the benefit of one family's
citation-following need. The information gain over Option B is zero -- both
end with a model having read the cited text -- so there is no offsetting
benefit for the added risk.

**(b) A second, separate call that resolves only the trigger, given the
cited section.** Recommended. Needs no change to the byte-verification
contract (Part 3); the target data shape it produces (`TRIGGERED_BY`,
evidence anchored per-section) is already shipped and validated on two real
deals; each call stays exactly the shape `native-extraction-run.js` already
verifies today, so "how the model is stopped from quoting secondary context
as if it were the provision" has a structural answer rather than a
procedural one -- **there is no secondary context inside either call.** The
7.3 candidate's own `raw_value` never changes; the cited section's own call
produces its own, independently-quoted, independently-verified candidate
about itself, exactly as Section 7.1's Superior Proposal ground already does
today. The two are joined after verification, at the relationship level,
never inside one candidate's own quote field.

**(c) Keep one call, pass cited text as labelled secondary context, read
but never quoted.** Not recommended for v1, plausible later. Requires
inventing the anti-quoting/segment-attribution check Part 3 shows does not
exist, with no existing test shape to build it against and a real, named
failure mode if it is forgotten (a real quote, correctly byte-verified,
silently laundered from the wrong section). If Option B's per-citation call
volume proves too costly at corpus scale (Part 6), this is the natural next
lever -- but it should not be built until that check is designed and tested
first, deliberately, not as a side effect of a prompt change.

**(d) A deterministic pass matching cited text against the trigger
vocabulary, no model call.** Not recommended as an auto-resolving
mechanism -- rejected on two independent grounds, not one. First,
principle: Part 1.3 shows the resolver's own, just-fixed rule is "text
alone, without a mind that read it and agreed, is not evidence" -- a
resolver-only pass over cited text has no mind attached to it at all, on
either side of the comparison, so it cannot satisfy the rule that was just
written; it can only ever be a fancier version of the exact bug that was
fixed. Second, and this does not require accepting the first argument to be
persuasive on its own: Part 4 shows it is empirically wrong on real data --
it reproduces the fixed bug's identical false positive
(`7.3(b)(iii)`) and produces two more false-ambiguous results a reader would
resolve instantly. **Accepted, though, as a non-authoritative sidecar
signal** -- attach what the pattern table finds in the cited text to the
review-queue item as a hint for the human reviewer, never as a published
value. This is not a new shape of thing for this codebase:
`resolveModivConditionalFees` (`candidate-resolution.js`, called around
line 8481) is already exactly this pattern -- a deterministic,
non-model, whole-document-reading computation, wrapped in a try/catch,
explicitly scoped out of the governed claims path ("This is a pilot-only
sidecar. It does not turn a conditional amount into the registered scalar
TERMINATION_FEE_AMOUNT claim," line 8470-8472). Reusing
`feeTriggerCorroboratedCodes` this way, purely as a hint attached to a
`review_queue` entry, is cheap, safe, needs no model call, and can ship
independently of everything else in this document.

**A hybrid considered and rejected:** one call, given both texts, with the
model required to tag each assertion with which span it came from (a looser
version of (c) that allows quoting either span, provided it is labelled).
Rejected because it still needs the same segment-aware verification (c)
needs -- tagging is a prompt-level promise, not a byte-level guarantee, and
the codebase's own house rule throughout this file is to check structure
independently, never take the model's word for it (`citation-constructibility.js`'s
own stated general principle). It also does not clearly beat (b) on cost
(Part 6's real telemetry shows call cost is dominated by fixed
instruction/output overhead, not input span size, so one larger call is not
obviously cheaper than two smaller ones), while giving up something (b) gets
for free: the cited section's own trigger determination becomes its own,
independently reviewable fact, the same way 7.1(c)(i)'s Superior Proposal
ground already is today, rather than existing only as corroboration fodder
buried inside a bigger response.

---

## Part 6: the recommended design, as a specification

### 6.1 Which model call sees what text

Unchanged for the primary call: the section that produced the bare-citation
candidate (e.g. 7.3) is dispatched exactly as today, `governed_scope.source_text`
equal to that section's own bytes, nothing more.

New, second call, dispatched only when a bare-citation trigger candidate is
found: the CITED section (e.g. 7.1(d)(ii)) is dispatched as its own,
ordinary, independent single-section scope, through the exact same
`native-extraction-run.js` dispatch loop (573-589), with
`governed_scope.source_text` equal to *that* section's own bytes, nothing
from the citing section included. It is not told about the candidate that
cited it; it is asked the same question every other dispatched section is
asked: what termination grounds and fee-linked facts does your own text
state. This is deliberate -- it keeps the second call's prompt and
verification identical in kind to every existing call, so no new class of
model behaviour needs to be reasoned about.

### 6.2 Byte verification, and the anti-quoting question

Both calls are ordinary single-section dispatches, so `checkEvidenceScope`
and `deriveGlobalEvidenceSpan` (native-extraction-run.js, 333-358, 405-417)
run completely unmodified, once per call, exactly as they do today. There is
no multi-span buffer at any point, so the segment-aware rework Part 3
identifies as missing is never needed. "How is the model stopped from
quoting secondary context as if it were the provision" has a structural
answer instead of a procedural one: **there is no secondary context in
either call.** The citing candidate's `raw_value` is never touched or
extended; the cited section's own candidate is a normal, independently
byte-verified quote of itself. Nothing is joined at the text level. The join
happens only afterward (6.4), at the relationship level, between two facts
that have each already individually passed verification on their own
terms -- the same shape `qxo-termination-fee-admitted-slice.js` (496-510)
already uses for `TRIGGERED_BY` today.

### 6.3 New code

**`lib/canonical-v2/native-producer/bare-citation-trigger-parser.js` (new
file).** Exports `parseBareCitationTriggerQuote(quote)`, hardening the
heuristic this session's harness prototyped
(`isBareCitationQuote` in `scripts/canonical-v2-citation-scope-resolution-harness.mjs`)
into the parser RES1 in `docs/codex-program/P1-PLAN.md` (Part 6, "Technical")
already names as needed: "a parser for 'does this quote contain an explicit
section reference and nothing else usable' (distinct from a quote that
merely mentions a section in passing among other descriptive text: only the
bare-citation shape licenses the lookup)". Returns
`{ is_bare_citation: boolean, cited_references: string[] }` -- an array
because a bare quote can cite more than one section disjunctively (e.g.
`"terminated by the Company pursuant to Section 7.1(c)(ii) or Section
7.1(c)(iii)"`, a real quote in this evidence set). A quote that cites a
section but also carries independent descriptive text of its own (the
topping-fee arming quote, `fee_trigger_assertions[2]` in the 7.3 response)
must NOT be treated as bare -- it already has a chance to resolve on its own
quote, and citation-following is not licensed for it.

**`lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js`
(new file).** Exports `runNativeExtractionWithCitationFollowup(args)`,
orchestrating:

1. Call `runNativeExtraction` with the caller's natural `section_references`
   -- byte-identical to calling it directly today. Produces receipt A.
2. Filter receipt A's `compiled_candidates` for `TERMINATION_FEE_TRIGGER`-shaped
   entries with a null `trigger_code`, the same filter shape already used at
   `candidate-resolution.js:8474-8478` for a different purpose (`entry.ok
   === true && entry.candidate.kind === 'claim' && entry.candidate.claim.claim_definition_key
   === FEE_TRIGGER_CLAIM_KEY`), plus `attributes.trigger_code == null`. Run
   `parseBareCitationTriggerQuote` on each; keep only the bare-shaped ones.
3. For each cited reference found, resolve it against the SAME tree
   `runNativeExtraction` already builds internally (re-derivable for free,
   deterministically, from the same `source_text`/`document_hash` --
   `sectionizeAdmittedSource` is pure and cheap, no model call). Apply the
   independent duplicate check Part 2 established `findSectionByReference`
   itself does not perform. Any reference that resolves to zero or more
   than one node is dropped from the follow-up batch and recorded (6.5).
   Dedupe the remaining set (the 8.12(m) branch citations and 7.3's own six
   overlap in practice -- Part 2's table shows several references cited
   more than once).
4. If the resulting set is non-empty, call `runNativeExtraction` again with
   exactly those references (reusing the `TERMINATION_FEE` family and
   `termination-fee-producer-prompt.js` unmodified for v1 -- see 6.6 on why
   not a leaner prompt yet). Produces receipt B.
5. Merge receipt A and receipt B via a new `mergeNativeExtractionReceipts(a,
   b)` helper in the same file: concatenate `resolved_sections`,
   `compiled_candidates`, `evidence_residuals`, `scope_violations`,
   `citation_residuals`, `undispatched_sections`, `coverage_proxies`,
   `limb_enumeration_scan`, and recompute `run_receipt_id` over the merged
   body using the same `contentId` mechanism `native-extraction-run.js`
   already uses for its own receipt -- the merge is itself deterministic and
   content-addressed, not an ad hoc splice. If no follow-up call was needed
   (step 3 found nothing), return receipt A unchanged; a deal with no bare
   citations pays nothing extra and produces a byte-identical receipt to
   today.

**`lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleFeeTriggerCandidate` (5733-5875): one small, additive change.**
Today, the `if (!triggerCode)` branch at line 5846 falls straight to
`TRIGGER_NOT_ASSERTED`. The change: immediately before that fallback, if
`parseBareCitationTriggerQuote(claim.raw_value).is_bare_citation` is true
and every cited reference resolves (via `sectionsByReference`, now
populated from the merged receipt, so it includes the follow-up section
when one was dispatched) to another compiled candidate in this SAME run
that is itself a `TERMINATION_FEE_TRIGGER` candidate for that cited
section -- apply the *exact same* two gates (`matchedCodes.length ===
0`/`>= 2`, `!triggerCode`, `triggerCode !== singleMatchedCode`) to *that*
candidate instead of the original. If it resolves cleanly, proceed to
`finalizeTerminationFeeClaim` using its `trigger_code`, and additionally
call a new `mintCitationTriggeredByRelationship({ citingCandidate,
citedCandidate, citedReference })` (new function, same file, modelled
directly on `qxo-termination-fee-admitted-slice.js:496-510`'s
`buildRelationshipRevision` call: `relationship_definition_key:
'TRIGGERED_BY'`, `source_occurrence_id` the citing provision,
`target_occurrence_ids` the cited section's own minted provision, two
evidence edges, each independently anchored to its own section's already-verified
bytes). If the cited candidate does not resolve either, fall through to
today's behaviour, but typed with the new `_AFTER_CITATION`-suffixed
reasons (6.5) so a reviewer can tell "not attempted" from "attempted, cited
section itself does not resolve either." **No other line in
`handleFeeTriggerCandidate` changes.** The zero-match, multi-match,
fee-side, and out-of-enum gates are untouched.

### 6.4 What "resolves" produces

A new claim exactly as `finalizeTerminationFeeClaim` produces one today,
plus a `TRIGGERED_BY` relationship recording the followed citation --
the same registered relationship key already validated by
`validate-write-set.js` and already live on QXO/TopBuild and Landos/AbbVie,
now reachable through the automatic path for the first time (P1-PLAN.md
2.2 names this exact gap: "the automation that would let it fire on a
fourth deal without a human hand-encoding it first does not exist"). This
design is that automation, scoped to the one relationship kind this task
was about.

### 6.5 Fail-closed behaviour, enumerated

Every one of these is a real, distinct outcome the implementation must
produce, not a single generic failure:

1. **Quote is not bare-citation-shaped** (real descriptive text alongside a
   citation, like the topping-fee arming quote) -- follow-up never
   attempted, behaviour identical to today, no new reason code.
2. **Cited reference resolves to null** (e.g. an `8.12(gg)`-shaped
   citation) -- follow-up skipped for that candidate; falls through to
   `TRIGGER_NOT_ASSERTED` as today, but record a typed
   `CITATION_REFERENCE_UNRESOLVED` entry in a new `citation_followup_residuals`
   receipt array (same "typed, never silent" convention as
   `scope_violations`/`citation_residuals`), so this is visible and
   distinguishable from "never tried" -- and so it becomes concrete pressure
   to fix SEC2 (the `8.12(z)` nested-lettering defect, `P1-PLAN.md` Part 6),
   without making that fix a hard prerequisite for anything this design
   ships on citations the tree can already address.
3. **Cited reference resolves to more than one node** (does not occur on
   Modiv, per Part 2's exhaustive scan, but must be handled) -- same
   fallback, typed `CITATION_REFERENCE_AMBIGUOUS`.
4. **Cited node's own text is itself still a bare citation** (the 5
   chained citations in Part 2.1) -- v1 scope explicitly does not chase a
   second hop automatically. Typed `CITATION_CHAIN_NOT_FOLLOWED`, falls
   through to today's behaviour. Chasing transitively is a real, visible
   option for a later revision (Part 9), deliberately not built here: each
   additional hop is another call, another place ambiguity can hide, and
   none of Modiv's evidence needs more than one hop to reach real text for
   the citations that matter for the trigger-code question specifically.
5. **Cited section's own call also returns `trigger_code: null`** -- the
   model read the actual ground text and still could not name one of the
   seven controlled codes (a real, honest outcome, not a failure of this
   design). Falls through, typed `TRIGGER_NOT_ASSERTED_AFTER_CITATION`
   (new) instead of plain `TRIGGER_NOT_ASSERTED`, so a reviewer can see the
   citation WAS followed.
6. **Cited section's own model-asserted code disagrees with, or is
   ambiguous against, its own text's pattern-table result** -- same
   fallback, typed `TRIGGER_CORROBORATION_DISAGREES_AFTER_CITATION` or
   `AMBIGUOUS_TRIGGER_CORROBORATION_AFTER_CITATION` (new) respectively.
7. **Cited section's own call cleanly resolves** -- the only case that
   proceeds to publication (6.4).

Nothing here ever guesses. Every skip is typed and recorded, matching the
"never silently discard" discipline `native-extraction-run.js`'s own file
header already states as this codebase's house rule (lines 96-118).

### 6.6 Cost change per deal, using this run's own real telemetry

`call-telemetry.json` for the exact run this evidence is drawn from: 3
calls, one per whole section (7.1, 7.3, 8.12), costing $0.2556, $0.5816 and
$0.5140 respectively (`total_cost_usd_cli`), **$1.3512 total.** Cost does
not track section byte-size cleanly -- 7.3 (6,494 bytes) cost more than 7.1
(9,739 bytes) -- because output token volume (27,284 tokens for 7.3 versus
6,364 for 7.1) dominates, not input span size. A large (23,684-30,397
token) block also shows as cache-creation/cache-read on every one of the
three calls, roughly constant regardless of how much dispatched source text
each call carried; I have not verified what that block specifically
contains (it is at least as large as this script's own fixed
instructions/vocabulary/response-shape text, but 23.7K tokens is also
consistent with fixed overhead carried by the `claude -p` CLI harness
itself, present even on the first call of a fresh run, which this script
drives rather than calling the API directly -- see
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs`,
`runClaudeCli`). Whichever it is, the number that matters for a cost
estimate does not change: it recurs per call, materially larger than any of
these clauses' own byte spans, and does not shrink because the dispatched
section is small.

Applying `parseBareCitationTriggerQuote` + dedupe to this run's own 9 bare
citations collapses to **4 distinct, resolvable, non-chained target
sections needing a follow-up call**: 7.1(c)(i), 7.1(d)(i), 7.1(d)(ii),
7.1(d)(iii) (the 5 chained ones under 7.3(b) fail closed at step 4 above in
v1 and add no calls). Reusing the full termination-fee prompt unmodified for
each, per-call cost should land in the same $0.25-$0.58 order of magnitude
this run already shows for a full section, dominated by the same fixed
overhead regardless of the much smaller (205-1,841 byte) span -- so a
realistic estimate is **roughly +4 calls, +$1.00-$2.00, on a deal shaped
like this one**, an increase of comparable size to the original 3-call,
$1.35 run, not a small tweak. This is the real, unrounded reason 6.3 defers
a leaner, dedicated response schema (smaller output, the confirmed dominant
cost driver) to a v1.1 rather than building it now: proving the mechanism
correct on the existing, already-verified prompt first, then shrinking cost
once the join logic is trusted, is the safer order. A deal with no bare
citations at all -- most families, most sections, most of the time -- pays
exactly $0, because step 2 in 6.3 finds nothing and no follow-up call is
ever made.

### 6.7 Test plan pointers

`tests/canonical-v2-termination-fee-resolution.test.js` (43 tests today,
per `trigger-override-fix.md`'s own verification log) is the natural home
for `handleFeeTriggerCandidate`'s new branch: pin the real Modiv
`MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE`-style fixture pattern already
established there, plus a new cited-candidate pair per Part 6.5's seven
enumerated outcomes (bare/not-bare, unresolved/ambiguous/chained citation,
cited-call resolves/disagrees/ambiguous/still-null). A new
`tests/canonical-v2-native-sectionizer.test.js`-adjacent suite, or a new
file, should pin `parseBareCitationTriggerQuote` directly against every
real quote in this evidence bundle (9 bare, at least the topping-fee quote
as a real not-bare negative case) and against the disjunctive
`"...Section 7.1(c)(ii) or Section 7.1(c)(iii)"` shape specifically, since
that is the one real quote in this corpus that must yield two references,
not one. `mergeNativeExtractionReceipts` needs its own unit tests
independent of the model-dependent orchestration: two hand-built minimal
receipts in, one merged receipt out, content-addressed and order-stable.

---

## Part 7: the offline prototype actually built and run this session

`scripts/canonical-v2-citation-scope-resolution-harness.mjs` (new file).
Makes zero network or model calls: reuses the already-committed,
already-admitted raw HTML fixture
(`tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`),
re-derives and re-verifies both the raw-bytes and canonical-text SHA-256
against the same pins the live run script checks, sectionizes the real
Modiv document, parses the three real recorded responses, extracts every
citation, resolves each one, independently checks the whole tree for
duplicate references, and runs the existing, unmodified
`feeTriggerCorroboratedCodes` export against each resolved cited node's own
text -- purely to report what it finds, never to construct a claim. It does
not call `resolveCandidates`, does not write to `evidence/`, and does not
touch the sectionizer, the resolver, or the dispatch invariant. Run with:

```
node scripts/canonical-v2-citation-scope-resolution-harness.mjs
```

Its output is the source for the tables in Parts 2.1 and 4 above (not
reproduced a second time here). This is a genuine, runnable prototype of
the "which of Modiv's cited sections resolve, and what vocabulary their
text would match" question the brief asked for, not a description of one.

---

## Part 8: honest count, restated together

Two different counts, both real, both needed, easy to conflate:

**All cross-references appearing anywhere in the three recorded Modiv
responses (mechanical, sectionizer-only, Part 2.1): 18 distinct reference
strings. 18 resolve to exactly one node. 0 ambiguous. 0 null.** Whole-tree
duplicate scan, independent of what was cited: 0 collisions anywhere in
472 nodes.

**The two specific references this task named, tested directly, not found
among the 18 because this corpus routes around them: `8.12(gg)` -> null.
`8.12(vv)` -> null.** Real defect, confirmed by direct call, mechanism
identified (the `8.12(z)` nested-lettering collision cascading through the
rest of the section).

**The legally salient subset -- bare-citation-shaped, `trigger_code: null`
`fee_trigger_assertions` entries, the actual set this design exists to
help: 9**, not the 6 the brief's own framing led with (6 in Section 7.3
citing into 7.1; 5 more in Section 8.12 citing into 7.3(b), found this
session, one of which, 7.3(b)(iii), overlaps a reference also cited
directly from 7.3). Of those 9: 4 cite a section whose own text is real,
substantive ground language reachable in one hop (7.1(c)(i), 7.1(d)(i),
7.1(d)(ii), 7.1(d)(iii)); 5 cite a section whose own text is itself still a
bare citation, one hop short (the five 7.3(b)(i)-(v) entries cited from
8.12).

Of the 4 one-hop, substantive citations, running the existing deterministic
vocabulary table over their real, resolved text (Part 4): 1 resolves
cleanly and correctly (7.1(c)(i)); 2 produce false ambiguity a competent
reader resolves instantly (7.1(d)(i), 7.1(d)(ii)); 1 is an honest vocabulary
gap (7.1(d)(iii)). None of the 5 chained citations produce a usable pattern
match at all except the one (7.3(b)(iii)) that reproduces, verbatim, the
false positive `trigger-override-fix.md` was written to eliminate.

---

## Part 9: what this document does not settle, on purpose

**Chained (multi-hop) citations are scoped out of v1, deliberately, not
overlooked.** 5 of the 9 real candidates in this evidence set need it. The
honest reason to defer rather than build it now: each additional hop is
another call and another place a wrong address or a wrong reading can hide,
and "fail closed, never guess" (Part 6.5, case 4) is a legitimate, reviewable
outcome for a first version. Whether to chase a second hop automatically,
versus always surfacing it to a human once one hop is exhausted, is a real
product decision this document leaves open rather than defaults quietly.

**`producer-prompt-registry.js`'s registration mechanics were read (its file
header and its existing entries, lines 1-70) but a new, leaner cited-clause
response schema was not designed in this session** -- 6.6 recommends
deferring it to v1.1 and reusing the existing termination-fee prompt
unmodified for v1, precisely so this document does not understate the cost
of getting the mechanism right the first time.

**`mergeNativeExtractionReceipts` is specified in shape (6.3, step 5) but
not written or tested.** The claim that `resolveCandidates` does not care
whether its `run_receipt` came from one call or a merge of two is verified
directly against its own input contract (`candidate-resolution.js:3066-3067`
requires only that `run_receipt.resolved_sections` and `.compiled_candidates`
be arrays; `sectionsByReference` is built from the former at line 3087-3088
with no assumption about provenance) -- but the merge helper itself is a
specification, not a prototype, per this task's own instruction not to
touch the live extraction path.

**Fee side is explicitly out of scope for this document**, and this is a
deliberate boundary, not an oversight: `handleFeeTriggerCandidate`'s
`feeSide` gate is independent of, and runs before, the `triggerCode` gate
this document is about (5742-5790 versus 5845-5863), and P1-PLAN.md's Part
2.3 already separately names the one real fee-side residual this run
produces (Section 7.1(c)(i)'s Superior Proposal ground, rejected
`FEE_SIDE_UNCORROBORATED` for an unrelated reason -- `feeSideFromFullPaymentContext`
scanning only its own dispatched section). Interestingly, this design's own
follow-up call for 7.1(c)(i) (dispatched because ITS trigger code is
already fine and needed no help) does not fix that residual either -- they
are genuinely orthogonal, and RES1 in `P1-PLAN.md` already names the
fee-side fix separately (widening `feeSideFromFullPaymentContext`'s own
scan to the run's full dispatched set, not to a followed citation).

---

## What was proved versus what is recommended on judgement

**Proved, by direct code reading or by running real code against real,
committed data this session:**

- The one-section-per-call rule's stated rationale is evidence-grounding,
  not cost, and is backed by a real historical hallucination finding
  (F28-FIRST-LIVE-RUN.md), not a hypothetical one.
- All six Section 7.3 trigger assertions carry `trigger_code: null`; five
  more exist in Section 8.12, not mentioned in the brief's own framing,
  citing into 7.3(b) rather than 7.1 directly.
- The trigger-override fix's gate order makes `triggerCode` unconditionally
  model-sourced; no resolver-side pattern-table change of any kind can
  produce a different outcome for a candidate the model never saw enough
  text to code. This is a structural fact about the code as it stands
  today, not an inference from behaviour.
- `findSectionByReference` is a plain first match with no ambiguity
  detection, confirmed by reading the whole function; Modiv's tree
  nonetheless has zero actual reference collisions, confirmed by an
  exhaustive scan, not assumed.
- `8.12(gg)` and `8.12(vv)` both resolve to null, confirmed by direct call
  against the real, re-derived tree; the mechanism (the `8.12(z)`
  nested-lettering collision) is visible in the tree's own node dump.
- The byte-offset verification contract (`checkEvidenceScope`,
  `deriveGlobalEvidenceSpan`) is written for exactly one contiguous span
  per call and does not generalise to a multi-span buffer without new code
  that does not exist today; two independent single-section calls need no
  change to it at all.
- A deterministic pass over real cited text, using the existing,
  unmodified pattern table, cleanly resolves 1 of 9 real bare-citation
  candidates, and reproduces the exact false positive the resolver fix was
  written to eliminate on a second one, if allowed to auto-publish.

**Recommended on judgement, not mechanically derived:**

- Option B (a second, independent, single-section call, joined by a
  `TRIGGERED_BY` relationship) over Options A, C and D. The supporting
  evidence above is real, but choosing B is a design call informed by it,
  not a fact the evidence alone dictates -- a team more tolerant of
  building new segment-aware verification code, for instance, could
  reasonably still choose C for its lower steady-state call count.
- Reusing the full termination-fee prompt unmodified for the follow-up call
  in v1, deferring a leaner schema to v1.1.
- Scoping chained (multi-hop) citations out of v1 entirely rather than
  building single-hop chasing now.
- Keeping the deterministic pattern table alive only as a non-publishing
  review-queue hint (Option D's sidecar form), never wired to publish.

**The invariant is not load-bearing in a way that makes this a bad idea.**
The scope-discipline rule protects something real (evidence-grounding,
backed by a real historical failure), and this design does not weaken it --
it satisfies the same rule twice, once per section, and joins the two
results afterward rather than asking the rule to hold across a boundary it
was never built to represent. If the recommendation in this document turns
out wrong, it is more likely to be wrong on cost-at-scale (Part 6.6) or on
the chained-citation boundary (Part 9) than on whether the invariant
permits it at all.

