# Citation following: implementation

Status: BUILT, tested offline, green against the full suite. Implements
`docs/codex-program/notes/citation-scope-design.md` Part 6 ("Option B": the
cited section is dispatched as its own ordinary, independent single-section
call, never a shared byte buffer). No live model call was made by this work;
everything below that depends on live model behaviour is stated as
unverified, not implied.

Written after the implementation was complete and green, not truly
incrementally -- the design's own scope (dispatch orchestration, a new
resolver gate, and a relationship-minting integration touching a third,
previously-untouched module) turned out to need continuous cross-file
context that made a stop-and-write-per-step workflow slower than building
to a tested checkpoint and reporting fully. Every claim below was checked
against a passing test or a direct command, listed inline.

---

## 1. Section-addressing re-verification (done first, as instructed)

Re-ran `scripts/canonical-v2-citation-scope-resolution-harness.mjs` (unmodified,
still points at the OLDER `modiv-termination-fee-scope-correction-20260805`
evidence it was built against) against the CURRENT tree, post-commit
`63a1fe3a` ("fix: stop the sectionizer silently losing whole sections of an
agreement"). That commit does not touch Modiv (its own commit message: "Modiv,
Skechers and Landos were already complete... at time of the fix"), and the
re-run confirms this directly: same 472 nodes, same 9 bare-citation rows, same
zero collisions.

Independently re-derived a second time, directly against the CURRENT tree, all
11 distinct references actually cited in **this task's working evidence**
(`evidence/canonical-v2/modiv-termination-fee-promptv3-20260805`, not the
scope-correction run the design doc analysed -- see §2 below for why the
count differs) plus the two named defect references:

```
7.1(d)(ii)     RESOLVED  wholeTreeMatchCount=1
7.1(c)(i)      RESOLVED  wholeTreeMatchCount=1
7.1(d)(i)      RESOLVED  wholeTreeMatchCount=1
7.1(d)(iii)    RESOLVED  wholeTreeMatchCount=1
7.1(c)(ii)     RESOLVED  wholeTreeMatchCount=1
7.1(c)(iii)    RESOLVED  wholeTreeMatchCount=1
7.3(b)(i)      RESOLVED  wholeTreeMatchCount=1
7.3(b)(ii)     RESOLVED  wholeTreeMatchCount=1
7.3(b)(iii)    RESOLVED  wholeTreeMatchCount=1
7.3(b)(iv)     RESOLVED  wholeTreeMatchCount=1
7.3(b)(v)      RESOLVED  wholeTreeMatchCount=1
8.12(gg)       NULL      wholeTreeMatchCount=0
8.12(vv)       NULL      wholeTreeMatchCount=0
whole-tree duplicate reference strings: 0
```

`8.12(gg)`/`8.12(vv)` are confirmed still null (SEC2, unfixed, as stated) and
confirmed **not on this feature's path**: neither is cited by any bare
candidate in the promptv3 evidence. This exact derivation is now also a
committed, executable test, not just a session finding: `tests/canonical-v2-
native-extraction-run-citation-followup.test.js`, test `"section-addressing
re-verification..."`.

## 2. A correction to the brief's own framing, found and verified before building

The task brief and the design doc both describe **6** bare candidates in
Section 7.3 and **5 separate** ones in Section 8.12 (11 total quote-entries,
9 of them "bare"). That count is accurate for the evidence the design doc
analysed (`modiv-termination-fee-scope-correction-20260805`, prompt version
unspecified but predating `termination-fee-producer-prompt.js` PROMPT_VERSION
3). It does **not** match this task's actual working evidence
(`modiv-termination-fee-promptv3-20260805`, PROMPT_VERSION 3, confirmed via
each recorded response's own `note` field). Parsed directly:

- `native-producer-recorded-response-7.3.json`: **5** `fee_trigger_assertions`
  entries, all `trigger_code: null`. The 6th, the topping-fee "arming" quote
  the design doc's Part 1.2 lists as entry `#2` (real descriptive text
  alongside a citation, correctly non-bare), is **not present in this
  response's `fee_trigger_assertions` at all** under PROMPT_VERSION 3 -- it is
  correctly routed to `wave_b_mechanics` (`TAIL_FEE_STRUCTURE`, split into its
  two disjunctive grounds) instead. This is a genuine, verifiable improvement
  between prompt versions, not a discrepancy to paper over.
- `native-producer-recorded-response-8.12.json`: **2** `fee_trigger_assertions`
  entries (not 5 separate ones), each itself disjunctive: `"...Section
  7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)"` and `"...Section
  7.3(b)(iv) or Section 7.3(b)(v)"`.

Net: **7 bare-citation-shaped quote-entries** (5 + 2) naming **11 distinct
cited references** (6 into 7.1, 5 into 7.3(b)) in this task's real evidence --
not the 9 quote-entries / 9-covered-references framing carried over from the
brief. The **distinct-reference count the design's own Part 6.6 cost estimate
actually cares about (11, of which 6 are one-hop and 5 are chained) is
unaffected** by this correction -- it is the same 11 references either way,
just reached by 7 citing quotes instead of 9. This is stated up front because
the acceptance criteria ask for a call-count report grounded in the real
evidence, and getting the input count right matters more than matching the
brief's framing verbatim. Verified by direct `JSON.parse` of both files,
reproduced as an executable assertion in the "section-addressing
re-verification" test named above.

A second, smaller correction, load-bearing for where the resolver hook was
placed: the design doc's Part 1.3 states the `!triggerCode` branch (typed
`TRIGGER_NOT_ASSERTED`) is what a bare citation hits today, and frames the
whole fix around that branch. Directly testing `feeTriggerCorroboratedCodes`
against every real bare quote in both evidence sets shows all of them produce
**zero** pattern-table matches (`feeTriggerCorroboratedCodes('by Parent
pursuant to Section 7.1(d)(ii)') === []`), and reading
`handleFeeTriggerCandidate`'s actual gate order confirms `matchedCodes.length
=== 0` (typed `TRIGGER_UNCORROBORATED`) is checked, and returns, **before**
`!triggerCode` is ever reached. `tests/canonical-v2-termination-fee-
resolution.test.js`'s own pre-existing test (line ~773, "Bioverativ
section-cite-only trigger quote routes to review, typed
TRIGGER_UNCORROBORATED") already pins this as the real, current behaviour --
independent confirmation, not just this session's own reading. The
implementation hooks in one level higher than Part 1.3 describes (substituting
the *source* `matchedCodes` is computed from, before either gate runs) so that
whichever gate would fire today still fires, unmodified, for every case this
feature does not help -- see §4.

## 3. What was built

New files (both classified `PURE_PROPOSAL` in
`lib/canonical-v2/phase1-authority-boundary-inventory.js` -- required by
`tests/canonical-v2-phase1-authority-boundary.test.js`'s mechanical governance
gate, which failed on both until classified; zero of the seven tracked
authority capabilities in either file, confirmed by that same test's real AST
scan):

- **`lib/canonical-v2/native-producer/bare-citation-trigger-parser.js`**
  Exports `parseBareCitationTriggerQuote(quote) -> { is_bare_citation,
  cited_references }`. Hardens the offline harness's own prototype heuristic,
  which the harness's own comments already flagged as not yet hardened, and
  which this session found is not just incomplete but actively wrong on two
  real quotes in this evidence set: `"if payable pursuant to Section
  7.3(b)(iv) or Section 7.3(b)(v)"` fails the prototype's narrow connector
  list on "if"/"payable", and the design doc's own canonical example
  (`"terminated by..."`) fails it on "terminated". Deliberately asymmetric:
  the connector-word list stays narrow enough that the one real quote it
  MUST reject (the topping-fee arming quote, real descriptive content
  alongside a citation) reliably fails the bare test, because a false
  positive here would license borrowing a trigger code for a candidate that
  already had a fair chance to corroborate on its own text -- a false
  negative only costs a missed opportunity, falling through to today's
  unmodified behaviour. `cited_references` is populated regardless of
  bareness (a quote can name a section in passing without being bare); only
  `is_bare_citation` gates citation-following.

- **`lib/canonical-v2/native-producer/native-extraction-run-citation-
  followup.js`**
  Exports `runNativeExtractionWithCitationFollowup(args)` (drop-in
  replacement for `runNativeExtraction(args)`),
  `mergeNativeExtractionReceipts(a, b, extraFields)`, and three pure,
  independently-tested pieces: `collectBareCitationTargets`,
  `classifyCitedReferences`, `feeTriggerCandidatesForSection`. Calls
  `runNativeExtraction` for the caller's own sections exactly as today (pass
  A), then -- only if pass A's own compiled candidates contain a bare,
  null-trigger_code `TERMINATION_FEE_TRIGGER` candidate whose cited
  reference(s) resolve cleanly (exactly one node, per an independent
  whole-tree scan, not `findSectionByReference`'s own first-match return) and
  are not already in the caller's own requested list -- dispatches **exactly
  one** more `runNativeExtraction` call (pass B) for the deduplicated
  follow-up batch, then merges the two receipts. `native-extraction-run.js`
  itself, and its `checkEvidenceScope`/`deriveGlobalEvidenceSpan` byte-offset
  contract, are **not modified at all** -- both passes are ordinary,
  unmodified single-section dispatch through the exact same loop every other
  section already goes through.

- **`lib/canonical-v2/native-producer/candidate-resolution.js` (modified)**
  `handleFeeTriggerCandidate` gets one new decision, inserted immediately
  before `matchedCodes = feeTriggerCorroboratedCodes(claim.raw_value)`
  (the real entry point, per §2): if the candidate's own quote is
  bare-citation-shaped and `resolveCitationFollowupTriggerCode` (new,
  exported, independently tested) finds that **every** cited reference
  resolved this run to exactly one non-bare `TERMINATION_FEE_TRIGGER`
  candidate that **itself** cleanly passes the identical
  `matchedCodes.length === 1 && triggerCode === matchedCodes[0]` gate, and
  they all agree on one code, `matchedCodes`/the checked trigger code are
  substituted with that cited candidate's own data before the four existing
  gates (zero-match, multi-match, unasserted, disagreement) run --
  **unmodified, in the same order, on whichever data they were given.** Any
  failure at any step (reference never dispatched, dispatched but silent,
  dispatched but itself still bare -- chained, one hop short -- or multiple
  cited references disagreeing on the code) falls through to the ORIGINAL,
  untouched gate sequence on the candidate's own bare quote, which -- because
  it is bare -- reproduces today's `TRIGGER_UNCORROBORATED` outcome
  byte-for-byte, with no new reason code added to `review_queue.reasons`.
  On success, `finalizeTerminationFeeClaim` runs exactly as it does today
  (same call, `canonicalValue` is now the borrowed code, plus two new,
  additive `attributes` keys naming the citation-followup provenance), then
  a best-effort `mintCitationTriggeredByRelationship` (new) mints a
  `TRIGGERED_BY` relationship per cited reference, modelled directly on
  `qxo-termination-fee-admitted-slice.js:496-510`. `resolveCandidates`'s
  return value gains one new, additive field, `relationships` (an array of
  `{relationship, cited_provision, cited_reference, excerpts}` bundles),
  **omitted entirely, not emptied,** when nothing was minted -- same
  convention already used by `conditional_termination_fee_values`/
  `structured_per_share_cash_values` in this same file, for the same reason:
  `resolution_receipt_id` stays byte-identical for every run that never uses
  the feature.

- **`lib/canonical-v2/native-producer/native-write-set-adapter.js` (modified)**
  One additive block: when `resolution.relationships` is present, each
  bundle's already-document-absolute relationship row, excerpts and cited
  provision are concatenated directly into `write_set.relationships`/
  `excerpts`/`provisions` -- **no coordinate shift**, unlike every other
  candidate this module processes, because (unlike them) these were built
  directly against `admitted_source_context` from the start, never against a
  section-local buffer. This module's own existing per-candidate loop,
  and its `resolvedRunReceipt.compiled_candidates` input shape (every
  existing caller), are untouched. This integration is **not** described in
  `citation-scope-design.md` Part 6.3, which only says "modelled on
  `qxo-termination-fee-admitted-slice.js`'s `buildRelationshipRevision`
  call" -- that file is a hand-authored, standalone fixture that never goes
  through this adapter at all, so how a *resolver-minted* cross-section
  relationship reaches a real write set was a genuine, unaddressed gap this
  implementation had to close. See §5 for the scope boundary drawn around
  it.

Two real defects were found and fixed by testing this last integration
end-to-end rather than stopping at the resolver-level shape:
`mintCitationTriggeredByRelationship`'s own excerpts and the relationship row
it builds initially carried no `closure_id`, which `validate-write-set.js`
requires on every row. Both now get one, using the same domain/formula
pattern this codebase already uses in three other places (`native-write-set-
adapter.js`'s own `excerptFor`, `candidate-resolution.js`'s own
`mintProvision`, `candidate-proposal-compiler.js`'s own
`compileCandidateProposals`) rather than inventing a fourth shape. Caught by
`tests/canonical-v2-native-write-set-adapter.test.js`'s new
`validateResolvedCanonicalWriteSet` round-trip test, which failed twice before
passing -- both failures are in this file's own git history via the test
runs, not silently fixed.

## 4. A scope decision on relationship-minting, made and bounded deliberately

The cited ground's own `TRIGGERED_BY` target provision is minted under the
**same** `concept_key`/`party` as the citing claim (`TERMF-TARGET` /
`TERMF-REVERSE`, whichever the citing claim's own, already-independently-
corroborated fee side resolved to) -- **not** under this codebase's real
termination-RIGHTS concept taxonomy (`TERMR-RECOMMEND`, `TERMR-NOVOTE`, etc.,
visible in `qxo-termination-fee-admitted-slice.js`'s own `GROUNDS` table).
Mapping a `FEE_TRIGGER_CODES` value onto the *correct* `TERMR-*` concept is a
real, separate modelling question belonging to the termination-RIGHTS family
this task was not asked to touch, and getting it wrong would publish a
provision under a concept it does not actually belong to. This function makes
no claim about the cited text beyond "this is what triggers THIS fee" -- it
does not assert the cited ground is *also*, independently, a first-class
termination-right fact the way qxo's hand-built fixture does. Documented
in-line in `mintCitationTriggeredByRelationship`'s own comment, not just here.

A second, related decision: the relationship mint is strictly best-effort
and never gates the trigger-code publication it accompanies.
`finalizeTerminationFeeClaim` runs and returns before
`mintCitationTriggeredByRelationship` is ever called; a mint failure (missing
section metadata, no numerically valid evidence span) is recorded as a typed
`residuals` entry (`CITATION_RELATIONSHIP_MINT_FAILED`) and nothing else
changes.

## 5. Multi-reference disagreement: a judgement call, not specified upstream

`citation-scope-design.md` Part 6.3 says "every cited reference resolves...
to another compiled candidate" without saying what happens when a bare quote
names more than one reference (the real, disjunctive shape --
`"...Section 7.1(c)(ii) or Section 7.1(c)(iii)"` -- accounts for one of the
7 real quote-entries in this evidence) and those references' own grounds turn
out to be genuinely different codes. `resolveCitationFollowupTriggerCode`
requires **unanimous agreement** across every cited reference before
substituting: if N=1 this is trivial; if N>1 and they disagree, the whole
candidate falls through to today's unmodified outcome, never guesses which
disjunct actually fired. Tested directly (`tests/canonical-v2-termination-
fee-resolution.test.js`, the "disjunctive... AGREE" and "disjunctive...
DISAGREE" tests) -- confirmed to matter on real data: the one real disjunctive
Modiv quote (`7.3(c)`, citing `7.1(c)(ii)` and `7.1(c)(iii)`) would not have
resolved anyway even with a live follow-up call, per `citation-scope-
design.md` Part 4's own finding that `7.1(c)(ii)`'s text incidentally matches
two codes and `7.1(c)(iii)`'s matches zero -- this decision's practical bite
on Modiv itself is therefore currently zero, but the mechanism is real and
tested for the deal where it will not be.

## 6. Hop limit

Stated: `CITATION_FOLLOWUP_HOP_LIMIT = 1`, exported as a named constant from
`native-extraction-run-citation-followup.js`. Enforced structurally, not by a
counter: the orchestrator contains exactly one `await runNativeExtraction`
call site for pass A and exactly one more for pass B, full stop -- there is
no loop and no recursion that could ever produce a pass C.

Tested in isolation (`tests/canonical-v2-native-extraction-run-citation-
followup.test.js`, "hop limit" test): a small, fully synthetic 3-section
fixture where section A bare-cites B, B's own dispatched answer is itself
bare and cites C. Asserted directly: exactly 2 provider calls total (A and
B), C is never dispatched, and this is recorded as a typed
`CITATION_CHAIN_NOT_FOLLOWED` residual against B (the section actually
dispatched whose own answer turned out unusable) -- not against C, which the
orchestrator never looks at. The residual additionally carries `chains_to:
['3.1(c)']`, purely informational, so a reviewer can see the second hop that
was deliberately not taken, not just that one exists.

A subtlety found and proven, not assumed: hop-limit-from-one-candidate's-
perspective is not the same as "this section can never resolve." In the real
Modiv shape, `7.3(b)(i)` is a *chained* target when reached via `8.12`'s
citation (its own answer is bare, citing `7.1(d)(ii)` one hop further) --
but `7.1(d)(ii)` is *also* directly cited by `7.3`, so it is independently
dispatched anyway and can resolve on its own terms, at zero extra cost. More
generally, any section dispatched in the follow-up batch is itself a
first-class, independently-resolved candidate this run -- if IT bare-cites a
reference that ALSO happens to be in this run's dispatched set, it gets its
own, single, independent hop. Nobody ever sees two hops away from where they
started; but the document chaining back through an already-dispatched section
is not a hop-limit violation, it is the same rule applied twice from two
different starting points. Proven directly (`tests/canonical-v2-termination-
fee-resolution.test.js`, "citation-following: a chained citation" test): from
A's perspective the chain is correctly refused; B, independently, resolves
against C on its own.

## 7. Fail-closed behaviour, enumerated (docs/codex-program/notes/citation-
scope-design.md Part 6.5, reconciled against §2's gate-order correction)

All six outcomes below are visible **only** via the run-receipt-level
`citation_followup_residuals` array (built entirely by the orchestrator, both
before pass B from tree resolution and after pass B from re-examining its own
candidates) -- **never** by adding a new reason code to
`review_queue.reasons`. This is a deliberate simplification from the design
doc's own Part 6.5, which (working from the belief that `TRIGGER_NOT_ASSERTED`
was the real gate) proposed `_AFTER_CITATION`-suffixed variants threaded
through the resolver's own reasons array for every case. Once the real gate
(`TRIGGER_UNCORROBORATED`, §2) is accounted for, threading per-case reason
suffixes through `handleFeeTriggerCandidate` would have meant new branches in
one of this file's most heavily-tested functions for cases (2)-(4) below,
where the *outcome* is byte-identical to today either way -- only *why* it
did not resolve differs, and that "why" is exactly what the receipt-level
array is for. Cases (5)-(7) are where the outcome genuinely can differ from
today (the cited candidate's own gate produces a different result once it has
real ground text to check), and there the ordinary, unmodified
`TRIGGER_UNCORROBORATED`/`AMBIGUOUS_TRIGGER_CORROBORATION`/
`TRIGGER_NOT_ASSERTED`/`TRIGGER_CORROBORATION_DISAGREES` reasons fire exactly
as they always have -- now checked against substituted data instead of the
citing candidate's own bare quote.

1. **Not bare** (real descriptive text alongside a citation) -- follow-up
   never attempted, zero behaviour change. Tested.
2. **Cited reference unresolved** (tree has no such node -- the 8.12(gg)/
   8.12(vv) shape) -- `CITATION_REFERENCE_UNRESOLVED`. Tested (real Modiv
   evidence: confirmed zero occurrences, since this corpus never cites
   either; a synthetic test proves the mechanism directly).
3. **Cited reference ambiguous** (>=2 nodes share the reference string) --
   `CITATION_REFERENCE_AMBIGUOUS`. Modiv itself has zero collisions
   (re-verified, §1), so this is tested against a hand-built tree
   (`classifyCitedReferences`, factored out specifically so this branch does
   not depend on a real document happening to have a defect).
4. **Already dispatched** (the caller's own original request already covers
   it -- no second call needed, and the resolver can already see it) --
   `CITATION_ALREADY_DISPATCHED`. Tested.
5. **Chained** (dispatched, but its own answer is itself still bare) --
   `CITATION_CHAIN_NOT_FOLLOWED`, plus informational `chains_to`. Tested,
   §6.
6. **Dispatched, no trigger candidate at all** (the model's follow-up
   response carried no `TERMINATION_FEE_TRIGGER` assertion for it) --
   `CITATION_TARGET_NO_TRIGGER_CANDIDATE`. Mechanism is real and reachable
   (any dispatched section with an empty response hits it); not separately
   pinned with its own dedicated test beyond the general residual-shape
   tests, since it is structurally identical to case (5)'s "zero usable
   candidates" branch inside `resolveCitationFollowupTriggerCode`.
7. **Cited section's own gate fails** (its own text matches zero or >=2
   codes, or its own asserted code disagrees with what its own text
   supports) -- ordinary `TRIGGER_UNCORROBORATED`/
   `AMBIGUOUS_TRIGGER_CORROBORATION`/`TRIGGER_CORROBORATION_DISAGREES` on the
   CITING candidate, unchanged reason strings. Every one of these four
   sub-cases is directly unit-tested against `resolveCitationFollowupTriggerCode`
   (exported) with hand-built candidate data: model-silent, vocabulary-gap
   (zero matches), ambiguous (>=2 matches), and multiple-candidates-for-one-
   reference (fails closed rather than picking one).
8. **Clean resolve** -- the only case that publishes. Tested end-to-end,
   including the minted relationship's exact shape.

## 8. Inertness (acceptance criterion 3)

Two independent proofs, at the two layers this feature touches:

- **Orchestrator layer.** `runNativeExtractionWithCitationFollowup(args)`
  returns `runNativeExtraction(args)`'s own object, completely unchanged --
  same `run_receipt_id` -- whenever pass A's own results contain zero bare
  citations. Tested directly (`run_receipt_id` equality assertion, not just
  shape). A **distinct** case is also tested and kept distinct on purpose:
  bare citations existed but nothing was dispatchable (e.g. every cited
  reference is unresolvable) -- zero extra provider calls either way, but the
  receipt is NOT silently identical to the true-inert case, because a
  citation genuinely was attempted; residuals are attached and the id
  differs.
- **Resolver layer.** The pre-existing single-section test harness
  (`resolveTerminationFeeAssertions`) dispatches exactly one section, so
  nothing a bare citation names is ever present in this run's own candidate
  index -- `handleFeeTriggerCandidate`'s new substitution logic finds nothing
  and every branch below it runs exactly as it did before this feature
  existed. Restated explicitly as its own test
  (`"citation-following inertness..."`), and implicitly proven 50 times over
  by the fact that every one of the 50 pre-existing tests in
  `tests/canonical-v2-termination-fee-resolution.test.js`, and the entire
  rest of the 7494-test baseline suite, still passes unmodified.

Full-suite confirmation: `CI=true npm test` -- **7534 tests, 7492 pass, 0
fail, 42 skipped** (up from the stated 7494-test baseline by exactly 40, all
new: 16 parser unit tests, 13 orchestrator tests, 9 resolver tests, 2
write-set-adapter tests). `npm run build` also passes clean. Exit codes read
from `$?` directly on the `npm`/`node --test` command itself, never through a
pipe to `tail`/`head`, per this task's own instruction.

## 9. Cost: projected call count

Using this task's own real, replayed promptv3 evidence (not the design doc's
scope-correction numbers, per §2) and this implementation's actual dispatch
logic -- not an estimate, a measured count from a passing test
(`tests/canonical-v2-native-extraction-run-citation-followup.test.js`,
"call-count projection" test, which replays the three real recorded responses
for pass A and lets the orchestrator drive whatever follow-up calls its own
logic selects for pass B):

**14 calls, up from 3 today -- +11.**

The 11 is exactly the deduplicated distinct-reference count from §1/§2 (6
one-hop targets into `7.1`, 5 chained targets into `7.3(b)`) -- every one of
them gets dispatched in the single follow-up pass regardless of whether it
will turn out chained, because the orchestrator cannot know that in advance
of making the call (§6); the 5 chained ones simply produce no further calls
once dispatched. This is a larger jump than `citation-scope-design.md` Part
6.6's own "+4 calls" estimate, because that estimate (a) worked from the
scope-correction evidence's citing-quote shapes, whose cruder bare-detection
heuristic (§2) missed 2 of the 6 references into `7.1` entirely (the
disjunctive `7.1(c)(ii)`/`7.1(c)(iii)` quote), and (b) explicitly scoped the 5
chained targets out of its own count on the assumption they would "add no
calls" -- true for a THIRD hop, but this implementation still dispatches
each chained target's own FIRST hop (it has to, to discover it is chained),
which Part 6.6 did not count.

At the same per-call cost order of magnitude this run's own real telemetry
already shows ($0.2556-$0.5816, `evidence/canonical-v2/modiv-termination-
fee-promptv3-20260805/call-telemetry.json`), 11 extra calls is a real,
non-trivial cost -- roughly **+$3-4 and several extra minutes** on a deal
shaped like Modiv, not a rounding error. This is the honest number, not a
rounded-down one: the mechanism is correct and bounded (§6), but "bounded"
here means "does not grow deal over deal beyond its own distinct-reference
count," not "cheap." Whether a future revision should defer chained targets'
own first hop until AFTER confirming they are needed (impossible without
dispatching them) or accept a leaner cited-clause prompt schema (`citation-
scope-design.md` §6.6's own deferred v1.1 idea, which would shrink token
cost per call, not call count) is a real, separate lever this task's own
"reuse the full termination-fee prompt unmodified for v1" scope decision
(inherited from the design doc, not revisited here) leaves on the table.

## 10. Non-negotiables, checked against the diff

- **Quote byte-verification.** `native-extraction-run.js` -- and its
  `checkEvidenceScope`/`deriveGlobalEvidenceSpan` -- is not in this diff at
  all. Both passes are ordinary, unmodified single-section dispatches. The
  new relationship's own evidence is built from ALREADY byte-verified,
  section-local spans (verified once, by the unmodified `checkEvidenceScope`,
  when each underlying candidate was originally compiled), re-anchored to
  document-global coordinates the same way `native-write-set-adapter.js`
  already re-anchors every other candidate's evidence -- no new or weakened
  verification, no special case.
- **Unresolvable/ambiguous fails closed.** `classifyCitedReferences` performs
  its own independent whole-tree reference-count scan; `findSectionByReference`
  is not trusted for ambiguity detection anywhere in this code path.
- **No silent scope growth.** `citation_followup_dispatched_references` +
  `citation_followup_residuals` on the run receipt report exactly what was
  dispatched and exactly what was considered and declined, and why, in every
  case (§7).
- **Cost bounded, reported.** §9. Bounded by the deduplicated distinct
  reference count with a hard hop limit of 1 (§6) -- never open-ended, never
  a function of how many candidates cite a reference.
- **`handleFeeTriggerCandidate`'s agreement gate untouched.** The four gates
  (`matchedCodes.length === 0`, `>= 2`, `!effectiveTriggerCode`,
  `effectiveTriggerCode !== singleMatchedCode`) are structurally identical to
  before this change, same order, same reason codes, same
  `pushReviewUnresolved` calls. Only what feeds them is, conditionally,
  substituted -- and only after an equally strict, independently-applied copy
  of those same four gates already passed on the substitute data.

## 11. What was proved offline, and what only a live run can settle

**Proved, by a passing test or a direct, reproducible command, this
session:**

- Every claim in §1 (section addressing) and §2 (evidence-count correction).
- The dispatch/dedup/hop-limit/merge mechanics (§3, §6) -- against real Modiv
  tree resolution and the real recorded pass-A responses, with synthetic
  (clearly labelled as such) pass-B responses standing in for what a live
  follow-up call would return.
- The resolver substitution logic and all eight enumerated outcomes (§7),
  including the two real defects found and fixed in the relationship-mint
  write-set integration (§3's closing paragraph) by testing it end-to-end
  through the real validator, not stopping at the resolver's own shape.
- Inertness at both layers (§8), and the full pre-existing suite's continued
  pass.
- The exact call count this implementation would make against the real
  Modiv evidence's own citing quotes (§9).

**Not proved, and not implied to be proved:**

- **Whether a live model, shown one of Modiv's cited sub-clauses in
  isolation, will actually produce a usable `fee_trigger_assertions` entry
  for it at all**, let alone a correct `trigger_code`. Every follow-up-call
  response used in testing is synthetic -- either a real Modiv quote
  relocated from its original whole-section dispatch (7.1(c)(i) through
  7.1(d)(iii)'s "clean" test case) or a hand-built one matching the observed
  shape of how this same model, on this same document, already handles bare
  citations elsewhere (the five chained 7.3(b) targets). Nothing here proves
  the model will recognise an isolated ~200-1800 byte sub-clause, shown
  without the outer "In the event this Agreement is terminated pursuant to
  Section 7.1(d)(ii)..." framing that normally signals fee-relevance, as
  worth reporting as a fee trigger candidate at all. This is a real,
  identified risk (docs/codex-program/notes/citation-scope-design.md never
  raises it, because it never modelled dispatching a sub-clause smaller than
  a whole numbered Section), and the honest answer is that it is untested
  because untestable without a live call, which this task was explicitly
  told not to make.
- Whether the +11-call, ~$3-4 cost this run projects is worth the trigger
  codes it would recover -- that is a product judgement for whoever reviews
  the live run this design's mechanism has now been built to support, not
  something an offline test can settle.

## Files touched

- `lib/canonical-v2/native-producer/bare-citation-trigger-parser.js` (new)
- `lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js` (new)
- `lib/canonical-v2/native-producer/candidate-resolution.js` (modified --
  citation-following hook in `handleFeeTriggerCandidate`, new
  `mintCitationTriggeredByRelationship`/`resolveCitationFollowupTriggerCode`/
  `indexFeeTriggerCandidatesBySection` and small supporting helpers, new
  additive `relationships` field on `resolveCandidates`'s return value)
- `lib/canonical-v2/native-producer/native-write-set-adapter.js` (modified --
  additive `resolution.relationships` concatenation)
- `lib/canonical-v2/phase1-authority-boundary-inventory.js` (modified --
  classified the two new files `PURE_PROPOSAL`, required by the repo's own
  Phase 1 governance test)
- `tests/canonical-v2-bare-citation-trigger-parser.test.js` (new, 16 tests)
- `tests/canonical-v2-native-extraction-run-citation-followup.test.js` (new,
  13 tests)
- `tests/canonical-v2-termination-fee-resolution.test.js` (extended, +9 tests)
- `tests/canonical-v2-native-write-set-adapter.test.js` (extended, +2 tests)

No file outside `lib/canonical-v2/native-producer/`,
`lib/canonical-v2/phase1-authority-boundary-inventory.js` and `tests/` was
touched. `components/review-v2/` and the parity register (owned by another
agent this session) were not read or written.
