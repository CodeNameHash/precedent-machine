# Grounds-to-amount mapping, design note

Status: implemented and wired into `candidate-resolution.js`. Full suite
green, see section 11.

Target files: `lib/canonical-v2/native-producer/termination-fee-parse.js`
(new pure function), `lib/canonical-v2/native-producer/candidate-
resolution.js` (resolver wiring, both files already mine per the task
brief), and their tests. No change to `anthropic-provider.js`, the
termination-fee producer prompt, `validate-write-set.js`, the Modiv sidecar,
or any file outside my assigned scope.

## 1. The claim verified before designing on it

Per-limb-fee-amount.md (committed) fixed the amount side: Modiv's two
Company Base Amount limbs ($10,000,000 and $15,000,000.00) each resolve as
their own `TERMINATION_FEE_AMOUNT` claim, distinguished by `limb_amount_
quote`. Section 7 of that note named, and deliberately did not solve,
"which cross-referenced sections gate which limb's amount."

Read `evidence/canonical-v2/modiv-termination-fee-citation-following-
20260806/resolution.json` directly. Two `review_queue` entries, both
`generic_claim_key: NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE`, both
`section_reference: "8.12"`, both `reasons: ["TRIGGER_UNCORROBORATED"]`:

- `raw_value: "if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)"`
- `raw_value: "if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v)"`

Confirmed against the recorded model response itself (`evidence/canonical-
v2/modiv-termination-fee-citation-following-20260806/native-producer-
recorded-response-8.12.json`), not just the summary: the model emits these
as two `fee_trigger_assertions` entries, `trigger_code: null`, in the SAME
response that also carries the two `fee_amount_assertions` entries for the
same sentence. No prompt change of mine produced this. It is today's,
unmodified, PROMPT_VERSION 3 behaviour.

Traced why they land in `TRIGGER_UNCORROBORATED`, not something else, by
reading `handleFeeTriggerCandidate` and `bare-citation-trigger-parser.js`
directly. Both quotes are bare-citation-shaped (`parseBareCitationTriggerQuote`
returns `is_bare_citation: true`, `cited_references: ['7.3(b)(i)',
'7.3(b)(ii)', '7.3(b)(iii)']` for the first). Citation-following
(`resolveCitationFollowupTriggerCode`) tries to borrow a single trigger_code
from the cited sections but correctly refuses: the three cited grounds do
not all resolve to the same code (they are genuinely different termination
grounds), so it returns null by design ("a disjunctive bare citation naming
two grounds that turn out to be genuinely different codes is real,
legitimate ambiguity... not something this function is licensed to pick a
side on" -- that function's own comment). The raw quote itself then matches
zero trigger-code patterns (it is a cross-reference, not ground-describing
prose), so `TRIGGER_UNCORROBORATED` is the correct, honest outcome for the
TRIGGER family. It is not a bug and this change does not touch it.

**Conclusion, independently verified: this is a representation problem, not
an extraction problem.** The model already extracts the condition text, as
its own well-formed candidate, unprompted. Nothing downstream had anywhere
to put "this condition gates that amount." No prompt change, no shaping-
layer change, and no live model call were needed to make this data useful;
see sections 2-4.

## 2. `condition_groups`: confirmed dead end, independently

Read `validate-write-set.js`'s `validateConditionGroupRows` (~line 951)
myself rather than inheriting the prior finding. Confirmed, not just
accepted:

- `rows.length === 0` short-circuits (a no-op, so it is at least safe to
  leave untouched), but any non-empty use requires `rows.length ===
  semantic.condition_group_contracts.length`, a **frozen, fixed-length**
  array from `contract-bundle.js`'s `CAPITALISATION_REPRESENTATION_SCHEMA_
  V1` (exactly two entries, `source_clause_code: 'B'`/`'C'`).
- Every row must carry `review_version === 'QXO_CAPITALISATION_BRING_DOWN_
  F27/V1'` (a hardcoded literal), match `contract.source_clause_code` and
  `contract.required_limb_ordinals` positionally, and its parent provision
  must carry `concept_key === semantic.condition_concept_key` (fixed:
  `'COND-B-REP'`) and `party === semantic.party_contract.result_party`
  (fixed, deal-specific party labels).

This is closed at authoring time to one reviewed capitalisation pilot. It
has no notion of "register a new condition group for a different family."
Generalising it for termination-fee grounds would mean writing a **new**
parallel frozen contract object and a **new** parallel validator function,
i.e. not reuse. **Confirmed: dead end, not a foundation.** My mechanism does
not touch `condition_groups`, `validateConditionGroupRows`, or `contract-
bundle.js` at all -- deliberately a different root word, "grounds" not
"condition[_group]", so the two are never confused in code or in review.

## 3. The Modiv pilot sidecar: what it encodes, mined for the general design

Read `conditional-termination-fee-value.js` and `modiv-termination-fee-
source-parser.js` (`resolveModivConditionalFees`, wired into
`resolveCandidates` at the very end, gated on the six expected
`FEE_TRIGGER_CLAIM_KEY` branches all being present with the correct
corroborated `fee_side`). It then **ignores the model's own assertions
entirely** and regexes the raw admitted source text against Modiv's exact,
hardcoded defined-term sentences, including the REIT-cap formula's own
section citations (`8.12(m)`, `8.12(f)`, `8.12(vv)`, `8.12(gg)`) that exist
in no general schema.

What it is mining, in domain terms: a conditional fee is (a) a base amount,
(b) capped by a `LOWER_OF` formula against a named cap term, (c) with the
base amount keyed on which of several cross-referenced sections fired, (d)
with the cap formula's own defining sentence living in a *different*
section, cited separately. My mechanism generalises exactly (c) -- the
grounds-to-amount join -- and nothing else. It does not model the `LOWER_
OF` operator, the REIT cap term, or the cross-section formula lineage; that
enrichment has no home in the general `TERMINATION_FEE_AMOUNT` claim shape
today, and building one is a separate, larger task the per-limb note
already scoped out correctly.

**Disposition: sits alongside, kept, not retired.** See section 7 for the
full reasoning; short version: the sidecar's own trigger-branch amounts
would now be **redundant** with the general path for Modiv itself (both
independently produce 10000000/15000000.00 gated on the same grounds), but
the sidecar's REIT-cap/`LOWER_OF`/formula-lineage output has no general
equivalent, and retiring the sidecar would silently drop that enrichment
for the one deal that has it hand-verified. No change to the sidecar was
made or is proposed.

## 4. Design: reuse over new extraction

Two possible designs were weighed before writing code.

**Rejected: a new prompt field** (e.g. `grounds_quote` on `fee_amount_
assertions[]`, mirroring `limb_amount_quote`'s own precedent exactly). This
would need a live model call to populate, which this task cannot make, and
which would not exercise on a **replay** of the already-committed run (a
frozen recorded response has no such field and never will, replayed or
not). Acceptance criterion 1 requires the committed run to associate
grounds with amounts *by replaying it*, so a new-field design cannot, on
its own, satisfy criterion 1 at all. Rejected on that basis, not on
principle -- a future, purely additive `grounds_quote` field remains a
reasonable enhancement for a condition that is NOT textually nested inside
its own amount's quote (see section 6's residual-risk note), but it is a
different, separately-scoped, unverifiable-without-a-live-run change, and
was not built here.

**Chosen: derive the mapping from data already flowing today.** The
producer already emits the grounds clause as its own bare-citation-shaped
`fee_trigger_assertions` entry, in the SAME response, quoting a literal
substring of the amount's own defining sentence. The resolver already
byte-verifies every such trigger quote before it becomes a compiled
candidate (the ordinary trigger-family shaping path, unchanged). So the
only new work is a **join**: given an amount limb's own quote and anchor
figure, find the one bare-citation trigger candidate in the same section
whose own quote is nested inside it and structurally "belongs" to this
limb rather than a sibling, then verify every section it cites actually
resolves. No new byte-verification is invented; two already-independently-
verified strings are related to each other, exactly the trust boundary
`handleFeeAmountCandidate`'s own pre-existing `fee_term_ref`-in-quote check
already relies on (a plain containment check between two already-trusted
strings, done in the resolver, not a fresh sourceBytes re-verification).

## 5. The ownership rule, and why "nearest preceding" alone is not enough

Naive design: for a limb's anchor (its `limb_amount_quote`, or the end of
its own quote when undisambiguated), pick the nearest-preceding bare-
citation candidate nested in the same quote. This correctly separates
Modiv's two real citation-following limbs (verified, section 6).

It is WRONG on Modiv's own earlier, PROMPT_VERSION-1 recorded response
(`evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
native-producer-recorded-response-8.12.json`), found by deliberately
checking my design against a second, differently-shaped real fixture rather
than only the one the task named. That response fragments the SAME
three-way disjunction into THREE separate single-reference `fee_trigger_
assertions` ("Section 7.3(b)(i)", "Section 7.3(b)(ii)", "Section
7.3(b)(iii)", each its own entry) rather than one combined quote. All three
are independently nested in the (x)-limb's own fragment quote and all three
precede its one anchor (no `limb_amount_quote` at that prompt version). A
plain "nearest preceding, must be unique" rule would arbitrarily attach
only "(iii)" and silently drop "(i)" and "(ii)" -- a wrong, misleading
grounds record, worse than none, exactly the kind of guess the task
prohibits.

Fixed with a two-part rule, implemented as `selectFeeAmountGroundsCondition`
(`termination-fee-parse.js`, pure, no resolver dependency):

1. **Ownership.** A candidate is owned by an anchor only if no OTHER anchor
   (a sibling amount limb's own anchor, sharing the exact same quote text)
   is both smaller and still at or after the candidate's own end -- i.e. a
   condition clause belongs to the nearest FOLLOWING anchor, never to every
   later limb it also happens to precede. This is what correctly separates
   Modiv's two combined-quote limbs (section 6).
2. **Cardinality.** Among the candidates owned by one limb's anchor: zero
   is the ordinary case (no condition recorded, silently, exactly as if
   this feature did not exist); exactly one is a clean match; more than one
   is reported as `AMBIGUOUS` rather than picked or merged. This is what
   correctly refuses Modiv's own fragmented, pre-fix shape rather than
   silently corrupting it -- proven directly, both as a pure-function unit
   test reproducing that exact real fixture, and end to end by re-running
   `tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`
   against the real recorded bytes (see section 8): it now asserts exactly
   one `FEE_AMOUNT_GROUNDS_CONDITION_AMBIGUOUS` residual, re-measured from a
   fresh run per that file's own header instruction, not guessed.

Nesting position uses plain string `indexOf`/`lastIndexOf` on already-
trusted strings (see section 4), with one added safeguard: a candidate
whose own text appears MORE than once inside the outer quote is excluded
entirely (treated as not-found), mirroring `evidenceForNestedSubQuote`'s
own "ambiguous nesting fails closed" rule for `limb_amount_quote`.

## 6. Section-reference resolution: fail closed, visibly

A chosen condition's `cited_references` (from `parseBareCitationTriggerQuote`,
reused unmodified) are each checked against `sectionsByReference`, the same
plain, first-match, run-scoped map every other section-addressing call site
in this file already uses (`finalizeTerminationFeeClaim`, `feeSideFrom
FullPaymentContext`, etc.) -- this is "the same section addressing used
elsewhere" the task named, not a new lookup mechanism. If ANY cited
reference is missing from that map (never dispatched this run), the WHOLE
condition is declined, not narrowed to the references that did resolve:
a typed residual (`FEE_AMOUNT_GROUNDS_REFERENCE_UNRESOLVED`, naming the
section, the specific unresolved reference, and the grounds quote) is
recorded so the decision is never silent, and the amount claim resolves
exactly as it would if the condition had never been asserted at all.

Residual risk, stated plainly rather than left implicit (mirrors per-limb-
fee-amount.md section 8's own discipline): nesting-and-ownership proves a
condition clause is genuine source text that structurally belongs to this
limb. It does not prove the MODEL correctly associated the right grounds
with the right dollar figure in the first place -- if the producer ever
mis-split a compound sentence (attached the wrong `fee_trigger_assertions`
citation set to the wrong sentence position), this mechanism would
faithfully record a wrong pairing rather than catch it, exactly the same
class of limitation every corroboration table in this file already carries
("does the text match the claimed label, never was the candidate
classified correctly"). Not mitigated further here; flagged for the same
reason per-limb-fee-amount.md flagged its own analogous risk.

A second, narrower gap not attempted: this mechanism only fires when the
condition clause is a literal substring of the amount's own quote (the
Modiv shape: `(x) if payable pursuant to..., $10,000,000`). An agreement
whose condition and amount sit in genuinely separate sentences would
produce no match today -- silently, safely, exactly like the ordinary
"no condition at all" case, never a false attach. Closing that gap would
need a new, model-asserted, byte-verified field (the rejected design in
section 4), which remains a real option for a later task, not attempted
here.

## 7. The Modiv sidecar: final disposition

Not retired. Not subsumed. Kept, alongside, unchanged -- same conclusion as
per-limb-fee-amount.md section 3 reached for the amount figures alone, now
re-confirmed for the grounds mapping specifically:

- For Modiv itself, the general mechanism now derives the SAME branch-to-
  amount mapping the sidecar hardcodes (10000000 gated on (i)/(ii)/(iii),
  15000000.00 gated on (iv)/(v)) -- verified directly, see section 8. The
  sidecar's OWN amount/branch output is therefore redundant for this one
  deal, going forward.
- The sidecar does strictly more than grounds-to-amount: the `LOWER_OF`
  REIT-cap formula, its own defined-term lineage, and its own separate
  section citations for the cap term (`8.12(m)`/`8.12(f)`/`8.12(vv)`/
  `8.12(gg)`) have no representation anywhere in the general
  `TERMINATION_FEE_AMOUNT` claim shape, before or after this change. That
  enrichment is real, already hand-verified, and would be silently lost if
  the sidecar were deleted.
- The sidecar's own output (`conditional_termination_fee_values`) is a
  wholly separate array that never touches `resolved`/`review_queue` for
  `TERMINATION_FEE_AMOUNT` -- it cannot conflict with, override, or be
  confused with the general claims my change enriches. The two can safely
  coexist as a cross-check: a future QA pass could compare the sidecar's
  six regex-derived rows against the general path's resolved grounds for
  Modiv specifically, as an independent confirmation that both agree, but
  building that comparison was not asked for here and is not built.

**Recommendation: keep as a cross-check, do not retire.** Retiring it would
require first building a general representation for the REIT-cap formula,
which is out of scope for this task and was correctly scoped out of the
last one too.

## 8. Implementation -- what was actually changed

All changes additive; no existing exported name, response array, or default
behaviour removed or repurposed. No change to `anthropic-provider.js`, the
producer prompt, `validate-write-set.js`, `contract-bundle.js`, or the
Modiv sidecar files.

- **`lib/canonical-v2/native-producer/termination-fee-parse.js`** -- new
  pure function `selectFeeAmountGroundsCondition({ quote, anchorQuote,
  siblingAnchorQuotes, candidates })`, exported alongside `resolveFeeAmount`.
  No dependency on `parseBareCitationTriggerQuote`, section maps, or
  anything resolver-shaped -- pure string-position arithmetic, directly
  unit-testable, mirroring `resolveFeeAmount`'s own architecture exactly.
  `parseFeeAmount`, `resolveFeeAmount` and `parseTailPeriodMonths`
  themselves are byte-for-byte unchanged.
- **`lib/canonical-v2/native-producer/candidate-resolution.js`** --
  - New `indexFeeAmountCandidatesBySection`, mirroring the pre-existing
    `indexFeeTriggerCandidatesBySection` exactly (same filter shape, same
    "built once per `resolveCandidates` call" discipline), wired in
    alongside `feeTriggerCandidatesBySection`.
  - New `resolveFeeAmountGrounds`, the resolver-side orchestration: builds
    the sibling-anchor list and the bare-citation candidate list, calls
    `selectFeeAmountGroundsCondition`, then resolves `cited_references`
    against `sectionsByReference`. Pure with respect to resolver state (no
    `residuals.push` inside it) -- mirrors `resolveCitationFollowupTrigger
    Code`'s own shape exactly, for the same reason: directly testable
    against hand-built indexes, independent of a full run.
  - `handleFeeAmountCandidate` calls `resolveFeeAmountGrounds` once, only
    after the amount itself is about to resolve (party already assigned),
    pushes the returned residual when present, and conditionally spreads
    `grounds_quote`/`grounds_cited_references` into `extraAttributes` --
    same additive pattern as the pre-existing `limb_amount_disambiguated`
    line immediately above it.
  - Both new functions exported, with the same "so tests can pin the exact
    gate... independent of a full resolveCandidates run" comment already
    used for the citation-following exports they sit beside.
- **Tests** --
  - `tests/canonical-v2-termination-fee-parse.test.js`: 11 new
    `selectFeeAmountGroundsCondition` unit tests (43 -> 54), including the
    real Modiv combined-quote shape, the real Modiv fragmented-disjunction
    shape reproduced from the actual recorded bytes, sibling-ownership
    exclusion, duplicate-position nesting, and malformed-input throws.
  - `tests/canonical-v2-termination-fee-resolution.test.js`: 7 new tests --
    direct tests of both new exports against hand-built indexes, then five
    full-pipeline tests (`resolveTerminationFeeAssertions`/`resolveMulti
    SectionTerminationFeeAssertions`): the regression pin (no condition at
    all), the two named hostile scenarios (unresolvable reference, quote
    not nested in this amount), the fragmented-disjunction hostile at full-
    pipeline level, and the non-Modiv generalisation proof (different
    section numbers, different figures, real multi-section dispatch). The
    local `feeAmountAssertion()` test helper gained an optional
    `limbAmountQuote` parameter, omitted entirely (not null) when not
    passed, so every pre-existing call site is byte-for-byte unaffected --
    same convention `per-limb-fee-amount.md` used for the sibling
    `termination-fee-producer-prompt.test.js` helper.
  - `tests/canonical-v2-modiv-termination-fee-citation-following-
    replay.test.js`: 1 new test pinning the real grounds values for both
    Modiv limbs and the correct absence for the unconditional Parent Base
    Amount, against the committed run, replayed.
  - `tests/canonical-v2-modiv-termination-fee-scope-correction-
    replay.test.js`: 1 EXISTING test's assertion updated (`residuals.length`
    `0` -> `1`, plus the new residual's exact shape asserted), per this
    file's own header instruction to rewrite counts from a fresh
    measurement when resolver behaviour legitimately changes, not to keep
    a stale number passing. Re-measured against the real recorded bytes,
    not guessed -- see section 5.

## 9. Identity stability: proven by construction and by replay

**By construction.** `grounds_quote`/`grounds_cited_references` are added
to `extraAttributes` only inside `...(groundsResult && groundsResult.matched
? { ... } : {})` -- a conditional spread, never `?? null`, so the keys are
OMITTED, not present-as-null, whenever no grounds match. `attributes` is one
of `CLAIM_REVISION_PAYLOAD_FIELDS` (confirmed by reading that frozen array
directly, not assumed), so `claim_revision_id` is a content hash over
`attributes` among other fields -- an omitted key cannot perturb it. Grepped
every test file that mentions `TERMINATION_FEE_AMOUNT` (ten files) for an
exact hash-literal assertion on `claim_revision_id`/`subject_occurrence_id`/
`claim_occurrence_id`: none exist, so no test in the suite could be pinned
to a hash this change might have moved, checked directly rather than
inherited from the per-limb note's own equivalent check.

**By replay.** The new "regression (no condition at all)" test asserts the
FULL, exact attribute-key set for an ordinary resolved amount claim
(`['answer_provenance', 'fee_side', 'fee_term_ref', 'payer_party',
'section_reference']`, empirically measured before writing the assertion,
not guessed) -- proving nothing new leaks in for the common case. The
pre-existing "acceptance 1: every claim NOT part of a merge resolves under
the SAME content identity... and carries no merge attribute" test in the
citation-following replay file, which independently checks `party.value`
and `raw_value` for the untouched claims against the ORIGINAL committed
run, passes unmodified after this change -- section/concept/party/
raw_value are unaffected for every claim, touched or not. Every pre-
existing termination-fee test in the repository (Dyax, Landos, QXO fixture
replays, the fee-side-scope-fix suite, the citation-following suite, the
Modiv static resolution/review-parity fixtures) passes unmodified -- full
suite, section 11.

## 10. What is proven and what is not

Proven, by tests run against real, unmodified code, this session:

- The pure ownership/cardinality rule (`selectFeeAmountGroundsCondition`)
  is correct in isolation, including the sibling-exclusion direction, the
  duplicate-position-nesting exclusion, and both real Modiv shapes (the
  combined-quote citation-following response and the fragmented single-
  reference scope-correction response) -- direct unit tests, no resolver
  dependency.
- The resolver-side join (`resolveFeeAmountGrounds`) correctly classifies
  bare-citation siblings, resolves `sectionsByReference`, and fails closed
  with the right typed residual in both failure shapes -- direct tests
  against hand-built indexes.
- The two layers compose correctly inside the REAL, unmodified resolver:
  replaying the actual committed citation-following run produces the exact
  grounds mapping for both real Modiv limbs, derived entirely from the
  model's own already-extracted `fee_trigger_assertions`, with zero new
  residuals on that run (every cited reference genuinely resolves).
- The mechanism generalises beyond the one committed Modiv fixture: a
  synthetic, differently-numbered, differently-valued two-limb conditional
  fee, dispatched across independently-resolved sibling sections through
  the real `runNativeExtraction`/`resolveCandidates` pipeline, resolves
  correctly end to end.
- All three named hostile scenarios (unresolvable section reference, a
  condition not nested in this amount's own quote, an amount with no
  condition at all) behave exactly as designed, proven against the real
  pipeline, not simulated.
- Identity stability, section 9.
- Full existing suite unaffected: `CI=true npm test`, section 11.

NOT proven, and cannot be proven without a live model call (none was made,
per this task's constraints):

- Whether a live model, on a DIFFERENT conditional-fee agreement, will
  keep producing a bare-citation `fee_trigger_assertions` entry whose text
  is nested inside the corresponding amount's own quote. This is NOT the
  same open question `limb_amount_quote` carried (a brand-new field the
  model had never been asked to populate) -- the committed evidence proves
  the model already does this today, unprompted, for Modiv, under the
  CURRENT, unmodified prompt. What remains open is only whether that same
  shape recurs across OTHER agreements, which no amount of offline
  analysis of one fixture can settle.
- The narrower gap named in section 6: a condition stated in a genuinely
  separate sentence from its amount (never nested as a substring) produces
  no match today, silently and safely, not a false attach -- whether that
  shape is common enough across the corpus to be worth a dedicated,
  model-asserted field is a live-run, cross-deal question, not an offline
  one.
- Whether the fragmented-disjunction AMBIGUOUS outcome (section 5) recurs
  on other agreements, or was specific to Modiv's own PROMPT_VERSION-1
  response. Either way the behaviour is safe (a typed residual, no
  corruption), but only a live corpus run would show how often it fires.

## 11. Verification results

Targeted, this session, real output from the actual runs:

- `node --test tests/canonical-v2-termination-fee-parse.test.js` -- 54
  pass, 0 fail (11 new `selectFeeAmountGroundsCondition` tests among them).
- `node --test tests/canonical-v2-termination-fee-resolution.test.js` -- 78
  pass, 0 fail (7 new tests among them).
- `node --test tests/canonical-v2-modiv-termination-fee-citation-following-
  replay.test.js` -- 10 pass, 0 fail (the 9 pre-existing acceptance/
  grounding tests, unmodified, plus the 1 new grounds-mapping test).
- `node --test tests/canonical-v2-modiv-termination-fee-scope-correction-
  replay.test.js` -- 8 pass, 0 fail (the updated residual-count assertion
  included).
- Wide net (`termination-fee-*`, `modiv-*`, `qxo-termination-fee-*`,
  `qxo-buyer-termination-fee-*`, the reviewed-slice/excerpt-module tests,
  citation-followup, native-provider(-family-dispatch), native-write-set-
  adapter, the real Landos fixture replay) -- 384 pass, 0 fail.

Full suite, exactly as CI runs it:

```
CI=true npm test > /tmp/grounds.log 2>&1; echo "EXIT=$?"
EXIT=0
```

`tests 7641`, `pass 7599`, `fail 0`, `cancelled 0`, `skipped 42`, `todo 0`.
Skipped count (42) is unchanged from the per-limb-fee-amount.md baseline
(also 42) -- confirms this change introduced no new skip. Total tests rose
7471 -> 7641; this change's own additions (19 new tests, section 8) account
for a small part of that, the rest being other, concurrent, unrelated work
landing in the repository during this same session (the task brief's own
warning that other agents were mid-edit in the sectionizer) -- `git status`
at the moment of this run showed no file outside this change's own list
(section 8) as modified, confirming the delta is other agents' committed
work, not an uncommitted side effect of this one. Two false-positive
`grep -c "not ok"` hits in the log are test NAMES containing that substring
(`✔ ... "not ok" ...`), not TAP failures -- checked directly, not assumed.

`npm run build` was not run -- not listed in this task's own Verification
section, and this change touches no runtime/UI code path (candidate-
resolution.js and termination-fee-parse.js are both server-side extraction
library code, not imported by any page/component).
