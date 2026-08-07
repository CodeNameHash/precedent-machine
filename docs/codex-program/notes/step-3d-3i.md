# Steps 3D and 3I

## Step 3D. Capture a quote's position before anything trims it

**Read first, in full:** `docs/codex-program/notes/negation-reversal.md` (484
lines). That note fixed the negation-reversal defect at `lib/verification.js`
(the live ingestion gate) and at `representations-dark-bridge.js`, and
specified but did not build the "principled fix": using a claim's own
byte-verified evidence span to check, before anything downstream re-derives a
position from possibly-already-wrong text, whether the text immediately
preceding it in the real filed document carries a negation the quote itself
does not include. It could not be built at the time because
`candidate-resolution.js` was under another agent's edit.

### What changed

**File.** `lib/canonical-v2/native-producer/candidate-resolution.js` only
(plus the one new test file this step owns).

**New shared helper**, `claimGoverningNegationTrimmed(entry, claim)`, added
next to the existing `operativeEvidenceEdge`. It:

1. Reads the claim's OPERATIVE_TEXT evidence edge (`absolute_start`,
   section-local bytes, already byte-verified against the section the
   producer was shown by `native-extraction-run.js`'s `checkEvidenceScope`
   before this module ever sees the claim -- see that function's own
   comment, "Verifies one proposal's evidence stays entirely inside the
   section text ... and that each edge's byte slice reproduces the
   proposal's own raw_value exactly").
2. Adds the claim's governing section's own document-absolute `.start` to
   get the claim's real, document-absolute BYTE position.
3. Slices a 960-byte window of the real document immediately before that
   position (`admitted_source_context.canonical_text.text`, converted to
   bytes and decoded only for that bounded window -- not the whole,
   sometimes multi-megabyte, document, and not a UTF-16-index/UTF-8-byte
   mix: everything up to the final decode is byte arithmetic).
4. Calls the existing `lib/negation-boundary-guard.js`'s
   `hasUnclosedNegationBeforeSpan` on that window.

This is the "independently-captured, pre-trim offset" the note's section 8
specified: the position comes from the claim's own evidence span, never from
re-searching the (possibly already-trimmed) `raw_value` text in a stored
comparison string the way `lib/verification.js` and the dark bridges have to.

**Wired into exactly one place: `BRING_DOWN_TIER_CLAIM_KEY`'s resolution**
(the generic-claim-key table's sole remaining unconditional entry, mapping to
`REPRESENTATION_ACCURACY_STANDARD`). This is where it matters most: that
table entry's own comment already said "gated only by allowed-values
membership" -- there was, and outside this fix still is, no lexicon or
pattern check anywhere tying a bring-down tier's `raw_value` text to its
`canonical_value` code. A model returning
`{ raw_value: "have a Company Material Adverse Effect", canonical_value:
"MAT_MAE_QUALIFIED" }` passed every existing check.

**Investigated for, and deliberately NOT wired into, the other
`REPRESENTATION_ACCURACY_STANDARD` path** --
`handleRepresentationQualifierCarrier`'s ACCURACY branch (the
`REPRESENTATION_QUALIFIER_CLAIM_KEY` family, i.e. a qualifier's CHAPEAU
attached to one of `representation_instances[].qualifiers[]`). See "Where
this stopped, and why" below. A comment recording the finding was left at
that function, in place of a change, so the next reader does not re-attempt
it from scratch.

### Where this stopped, and why (the wall this step hit)

Before wiring the guard into `handleRepresentationQualifierCarrier`, the same
discipline the negation-reversal note itself used was applied: checked
against real corpus text before trusting the idea.

`handleRepresentationQualifierCarrier`'s ACCURACY branch only ever resolves
to `CLASSIFIED` when `claim.raw_value`, in its ENTIRETY, exactly matches one
of five fixed phrases in `qualifier-kind-lexicon.js`'s
`ACCURACY_CODE_WHITELIST` (`deriveAccuracyCode` does a whole-string
comparison, not a marker search). That means: for this path to ever produce a
resolved claim at all, the model's `raw_value` for a CHAPEAU accuracy
qualifier must already be exactly one of those short phrases (e.g. "true and
correct in all material respects") -- not a surrounding sentence.
This is not a hypothetical reading of the code: this test suite's own
long-established fixture for a clean, auto-passing ACCURACY qualifier
(`tests/canonical-v2-candidate-resolution.test.js`'s `ACCURACY_CHAPEAU_QUOTE
= 'true and correct in all respects'`) sets `qualifier.quote` to exactly that
bare phrase, not the sentence around it.

Checked directly against Modiv's real filed merger agreement (converted
through this repo's own `convertSecHtmlToCanonicalText`, not hand-typed):

```
real text: "...(y) that are not qualified by materiality or Company
Material Adverse Effect shall be true and correct in all material
respects..."
```

`hasUnclosedNegationBeforeSpan` flags the position of the bare phrase "true
and correct in all material respects" here as `true` -- a real, current
false positive. Legally this is wrong to flag: "are not" negates "qualified
by materiality" (which subset of reps this clause covers), three clauses
before "true and correct", which is itself a genuine, UNNEGATED accuracy
standard for that subset. The guard is a bounded text heuristic, not a
parse, and its lookback window (240 characters, `negation-boundary-guard.js`'s
own `DEFAULT_MAX_LOOKBACK_CHARS`) has no way to know "are not" governs a
different clause three commas back. Given that the bare-whitelist-phrase
shape is not a rare edge case here but the ONLY shape this path ever
resolves, wiring the guard in would mean: every time a real deal's bring-down
tier happens to use this exact drafting pattern (an affirmative standard
following an unrelated negated scope clause), a genuine, correct
`REPRESENTATION_ACCURACY_STANDARD` chapeau would be refused alongside a real
attack.

This is the same finding Step 3E made for `no-other-reps-fraud-dark-bridge.js`,
independently arrived at here: a real false positive, on real corpus text,
severe enough that shipping the fix would trade one failure mode (an
unflagged negation-reversed quote) for another (a genuine quote incorrectly
refused) on a shape this path's own design makes common, not rare. Per this
step's own acceptance criteria ("If 3D hits the same wall, say so and stop
rather than shipping it half-right"), this one path was left as found, with
the finding recorded in `candidate-resolution.js` itself (the header's new
NEGATION-BOUNDARY GUARD paragraph, and a comment at
`handleRepresentationQualifierCarrier` itself) so nobody re-attempts the same
unvalidated idea without first re-reading why it failed.

The `KNOWLEDGE` branch of the same function was not separately wired in
either, for the same structural reason (its own match is a whole-quote
anchored regex over a small closed set of knowledge-standard phrasings, no
richer than ACCURACY's whitelist) -- not independently corpus-tested, since
the ACCURACY finding alone was decisive for the whole function.

### Proof: before and after, against real filed text

Real TopBuild merger-agreement text (`tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm`,
converted through the real pipeline), Article VIII-shaped bring-down clause
(D):

```
GENUINE (a correct extraction): "(D) any of the other representations and
warranties of the Company set forth in this Agreement (other than those
listed in the preceding clauses (A), (B) and (C)) shall be true and
correct at and as of the date of this Agreement and the Closing Date as
though made at and as of the Closing Date, except where the failure to be
so true and correct (disregarding all qualifications or limitations as to
"material", "materiality" or "Company Material Adverse Effect") would
not, individually or in the aggregate, reasonably be expected to have a
Company Material Adverse Effect"

ATTACK (the identical real text, front-trimmed at the negation's own
boundary): "have a Company Material Adverse Effect; provided, however,
that, with respect to clauses (A), (B), (C) and (D) above, representations
and warranties that are made as of a particular date or period shall be
true and correct (in the manner set forth in clause (A), (B), (C) or (D),
as applicable) only as of such date or period."
```

Both are genuine, contiguous, byte-verifiable substrings of the same real
sentence -- `checkEvidenceScope` (native-extraction-run.js) accepts either,
since it only ever checks that `raw_value` reproduces the source bytes at its
own claimed span, never whether that span's start is a sound place to begin
quoting.

Measured, not asserted (`tests/canonical-v2-negation-boundary-resolver.test.js`):

| | BEFORE this fix (git `HEAD`'s `candidate-resolution.js`) | AFTER |
|---|---|---|
| ATTACK quote's `BRING_DOWN_TIER_CLAIM_KEY` candidate | resolves: `resolved_claim_definition_key = REPRESENTATION_ACCURACY_STANDARD`, `canonical_value = MAT_MAE_QUALIFIED`, no review flag | never reaches `resolved`; lands in `review_queue` with reason `REPRESENTATION_ACCURACY_STANDARD_GOVERNING_NEGATION_TRIMMED`, `raw_value` still carried for a human to check |
| GENUINE quote's candidate | resolves | still resolves, unchanged (`resolved_claim_definition_key = REPRESENTATION_ACCURACY_STANDARD`, `canonical_value = MAT_MAE_QUALIFIED`) |

The "BEFORE" row was run directly, not inferred: `git show HEAD:lib/canonical-v2/native-producer/candidate-resolution.js`
was written to a scratch copy in the same directory (so its relative
`require`s still resolved), the identical attack scenario was run against it,
and the scratch copy was deleted afterward (no state-changing git command
used; `git show` is read-only).

### Hostile tests, all against real filed text

`tests/canonical-v2-negation-boundary-resolver.test.js` (4 tests):

1. `sanity: the guard itself flags the real attack position and clears the
   real genuine position` -- the guard module alone, against real TopBuild
   byte positions.
2. `BRING_DOWN_TIER_CLAIM_KEY: a genuine, real, unnegated bring-down clause
   resolves normally` -- regression: the fix must not block real, correct
   data. Full `resolveCandidates` pipeline, real TopBuild text through
   `runNativeExtraction`/`shapeProposals`, not a hand-built receipt.
3. `PLAN.md Step 3D FIXED: BRING_DOWN_TIER_CLAIM_KEY refuses a real,
   byte-verified quote whose governing MAE negation was trimmed off its own
   front` -- the acceptance-criteria test: same pipeline, ATTACK quote,
   proves it never reaches `resolved` and is refused with the specific typed
   reason.
4. `regression: the real Modiv "(y) that are not qualified..." shape is
   unaffected when quoted with its own real lead-in` -- proves the
   false-positive shape found while investigating
   `handleRepresentationQualifierCarrier` does NOT recur for a realistic,
   CONTEXTUAL `BRING_DOWN_TIER` quote (one that includes its own scope
   lead-in, the normal shape for this claim type -- the guard never looks
   inside the quote itself), and separately documents, as a second assertion
   in the same test, the bare-phrase shape that DOES still false-positive
   (the one this step left unwired), so the residual risk is pinned in
   runnable code, not only in prose.

Run: `CI=true node --test tests/canonical-v2-negation-boundary-resolver.test.js`
-- **EXIT=0**, 4/4 pass.

### Regression: existing suites

```
CI=true node --test <every test file `grep -rl "native-producer/candidate-resolution" tests/*.test.js` finds>
```
**EXIT=0**, 649 tests, 635 pass, 0 fail, 14 skipped (pre-existing skips,
unrelated to this change).

`tests/canonical-v2-phase1-authority-boundary.test.js` -- **EXIT=0**, 19/19
(no new production source file was added; `negation-boundary-guard.js` was
already classified `PRODUCTION_PATH_PURE_ANALYSIS` by the earlier
verification.js/dark-bridge work, so no new classification entry was
needed for this step's new `require` of it).

`bash scripts/lint/forbidden-patterns.sh` -- **EXIT=0**, `INVARIANT-4: PASS`.

### Header comment updated in the same change

`candidate-resolution.js`'s own file header gained a new "NEGATION-BOUNDARY
GUARD" paragraph (next to the existing corroboration-tables paragraph, which
already instructs "whoever adds the next ... gate should extend this
paragraph, not just the code") explaining the mechanism, where it is wired,
and why it was deliberately not wired into the other path. A second, inline
comment sits at `handleRepresentationQualifierCarrier` itself, at the exact
point a naive reader might try to wire the guard in, recording the same
finding.

### What this step found wrong in its own text

The step's acceptance criteria say to build the test "against real filed
text, not a synthetic string" -- done, but worth being precise about what
"real" means here: the two quotes compared (GENUINE/ATTACK) are computed
substrings of TopBuild's real converted text, located by real anchor strings
at test-load time (never hand-typed full quotes, which risks silently
transcribing TopBuild's own smart quotes/dashes wrong); the SURROUNDING
document shell (agreement preamble, `ARTICLE VIII` heading, `Section 8.2`
label) is synthetic scaffolding, the same "real excerpt inside a minimal
synthetic wrapper" pattern this repo's own `tests/fixtures/canonical-v2/
m3-v31-fixtures/corpus-cards.json`-driven tests already use. The operative
clause under test -- the part whose position the fix actually reasons about
-- is 100% real, filed text.

### Guard existence, checked directly (per this task's own standing
instruction to verify before relying on memory)

`lib/negation-boundary-guard.js` exists, is exported, and is already
`require`d (unmodified) by `lib/verification.js` and
`lib/canonical-v2/representations-dark-bridge.js` per the earlier work
recorded in `negation-reversal.md`. `git grep -n "require.*negation-boundary-guard"`
confirms three importers after this step: those two, plus
`candidate-resolution.js` (new, this step). No file this step touches claims
a test exists that does not: `tests/canonical-v2-negation-boundary-resolver.test.js`
is the file actually created and actually run, cited here by that exact path.

---

## Step 3I. The P2 remainder: payment timing and the grounds-naming field

Read first: `docs/core/DECISIONS.md` items 4, 5 and 6 (the "step P2"
cross-references this step exists to un-orphan) and `archive/ROADMAP.md`'s
own P2 section, which is where the exact wording of both fields ("payment
timing", "a field naming which cross-referenced sections gate it") comes
from.

### Grounds-naming field: already done, found already committed

Before building anything, searched for prior work on this, per this task's
own standing warning about declaring things missing that already exist.
Found it immediately: `resolveFeeAmountGrounds` and
`selectFeeAmountGroundsCondition`
(`lib/canonical-v2/native-producer/candidate-resolution.js` and
`termination-fee-parse.js`) were already committed, at `c42ceae7` ("feat:
say which termination grounds trigger which fee amount") -- an ancestor of
this session's own starting commit, `c16f4ee1` -- with a complete design
note, `docs/codex-program/notes/grounds-to-amount-mapping.md`, whose own
status line already reads "implemented and wired into
candidate-resolution.js. Full suite green."

**Independently re-verified, not just trusted.**

```
CI=true node --test tests/canonical-v2-termination-fee-parse.test.js \
  tests/canonical-v2-termination-fee-resolution.test.js \
  tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js \
  tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js
```
**EXIT=0**, 150/150.

And the specific claim re-checked directly against the real committed Modiv
run, not re-derived from the note's own prose: replaying
`evidence/canonical-v2/modiv-termination-fee-citation-following-20260806/`
through the current `resolveCandidates`, the two conditional Company Base
Amount limbs each carry their own `grounds_quote`/`grounds_cited_references`:

| limb (canonical_value) | `grounds_quote` | `grounds_cited_references` |
|---|---|---|
| `10000000` | `if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)` | `['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)']` |
| `15000000.00` | `if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v)` | `['7.3(b)(iv)', '7.3(b)(v)']` |

The unconditional Parent Base Amount carries neither attribute, correctly.

**One correction to the record, found while re-checking.** The STORED
snapshot `evidence/canonical-v2/modiv-termination-fee-citation-following-
20260806/resolution.json` predates the grounds fix and does NOT itself carry
`grounds_quote`/`grounds_cited_references` -- read directly, confirmed by
`node -e` inspection, not assumed. This is not a functional defect (the
tests above replay the run_receipt through the CURRENT resolver, which is
what proves the feature works; nothing reads the stale resolution.json
snapshot as a source of truth), but it means anyone reading that JSON file
directly, rather than running the tests, would incorrectly conclude the
feature is missing. Flagged here rather than silently left for the next
person to rediscover.

**Disposition.** No code changed for this half of the step. `PLAN.md` Step
3I and `DECISIONS.md` item 5 both updated to record this as done and to
correct the record -- this exact gap (real work landing without the
tracking step ever being told) is what Step 3I itself exists to prevent, and
it had just recurred one level down: the fix shipped and was documented in
its own note, but no `PLAN.md`/`COMPLETED.md` entry pointed at it.

### Payment timing: built as a scoped, cited, Modiv-only sidecar

**What was checked before building.** DECISIONS.md item 5's own "Code"
section says the shape exists (`payment_timing`, `allowed_payment_timings`
in `contract-bundle.js`, `PAYMENT_TIMING_LABELS`) but nothing in
`lib/canonical-v2/native-producer/` sets it -- reconfirmed directly,
`grep -rn "payment_timing" lib/canonical-v2/native-producer/*.js` returns
nothing.

The grounds field's own note (`grounds-to-amount-mapping.md` section 4)
found a way around needing a live model call: the model ALREADY emits the
grounds condition text unprompted, as its own bare-citation-shaped
candidate, so the only new work was a join between two already-verified
quotes. Checked whether the same trick applies to payment timing, directly
against the real recorded evidence, before assuming it does not: every
`native-producer-recorded-response-*.json` under every
`evidence/canonical-v2/**termination-fee**` directory was grepped for
"Business Day", "simultaneously with" and "substantially concurrently
with". Zero hits. Read Modiv's own Section 7.3 recorded response
(`evidence/canonical-v2/modiv-termination-fee-citation-following-20260806/
native-producer-recorded-response-7.3.json`) in full: the model's own
`fee_trigger_assertions`, `tail_period_assertions`, `wave_b_mechanics` and
`open_world_candidates` cover the fee triggers, the tail period, the
sole-remedy and late-payment-interest surfaces, and three other genuinely
unmapped clauses -- and never mentions the payment-timing sentence at all,
not even as an open-world candidate it declined to place. **Conclusion:
unlike grounds, there is nothing already flowing here to join against.**

Populating a genuinely new producer field (`payment_timing_quote` on
`fee_trigger_assertions[]`, the obvious mirror of `covered_scope_quote`)
would need a live model call. Checked directly whether one is available in
this session: `env | grep ANTHROPIC_API_KEY` is empty, and
`anthropic-provider.js`'s own live-call path
(`process.env.ANTHROPIC_API_KEY`) confirms that is the only credential path
it looks for. No live call is possible here -- the identical constraint
`grounds-to-amount-mapping.md` section 4 hit and rejected the "new prompt
field" design for, for the same reason (a frozen recorded response has no
such field and never will, replayed or not, so a new-field design cannot be
proven against a replay of the already-committed run).

**Also checked, and also a dead end: reusing the existing two-value
`allowed_payment_timings` enum** (`contract-bundle.js`'s
`TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2`, hand-curated for QXO:
`TWO_BUSINESS_DAYS_AFTER_TERMINATION`, `UPON_EARLIER_OF_SIGNING_OR_
CONSUMMATION`). Modiv's real Section 7.3(b) payment sentence (located by
real anchor text, converted through this repo's own
`convertSecHtmlToCanonicalText`, not hand-typed) has THREE distinct
payment-timing patterns, keyed to which sub-branch fired:

```
"The payment of the Company Termination Fee shall be made (1) in the case
of a payment pursuant to Section 7.3(b)(i), Section 7.3(b)(iv) or Section
7.3(b)(v), within two (2) Business Days after the date of such termination
by Parent, (2) in the case of a payment pursuant to Section 7.3(b)(ii),
prior to or substantially concurrently with such termination by the Company
and (3) in the case of a payment pursuant to Section 7.3(b)(iii), within two
(2) Business Days after the earlier of entry into a definitive agreement
relating to the Company Acquisition Proposal referred to in clause (B) of
Section 7.3(b)(iii) and consummation of such Company Acquisition Proposal."

"The payment of the Parent Termination Fee shall be made within two (2)
Business Days after the date of such termination by the Company."
```

Pattern (2) ("prior to or substantially concurrently with such termination
by the Company") matches neither existing code exactly. Coining a third code
-- or deciding pattern (1)/(3)/the Parent sentence really are the same code
as `TWO_BUSINESS_DAYS_AFTER_TERMINATION` despite the different governing
event ("by Parent" vs "by the Company" vs "the earlier of...") -- is a
codebook/taxonomy decision. `docs/core/OPERATING-RULES.md` reserves
taxonomy values and codebook vocabularies to Ben; this task does not invent
one to save time.

**What was built instead.** A new pilot-only sidecar,
`lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-
parser.js`, deliberately mirroring the shape and the safety discipline of
the pre-existing, sanctioned `modiv-termination-fee-source-parser.js`
(`resolveModivConditionalFees`) exactly:

- Regexes the ADMITTED SOURCE TEXT directly (not a model quote) against
  Modiv's own two real sentences above, byte-verifiable and located by real
  anchor strings, not hand-typed against the raw filing.
- Gated on all six expected `FEE_TRIGGER_CLAIM_KEY` branches being present
  in THIS run's own compiled candidates, with a corroborated `fee_side`
  matching the expected one -- identical gate to the sibling sidecar,
  duplicated rather than imported (per that sidecar's own "no change to the
  Modiv sidecar files" discipline, extended here to mean this file never
  becomes a second place that can drift the first one's gate out of sync).
- Emits `payment_timing_quote` VERBATIM per branch, plus `source_citations`
  naming that branch -- never a coded value. This is narrower than
  DECISIONS.md item 5's eventual target (a fully coded, general, per-family
  `payment_timing` field), but it is real, per-limb, cited data today,
  rather than nothing, and it invents no vocabulary.
- Wired into `resolveCandidates` (`candidate-resolution.js`) the same way as
  the sibling sidecar: `try`/`catch`, empty result on any mismatch, a new
  top-level output field (`termination_fee_payment_timings`) omitted
  entirely (not an empty array) when nothing fires -- the same "byte-
  identical for every run that never uses this" convention the pre-existing
  sidecars and the grounds fields both already use.
- New production file classified in `lib/canonical-v2/phase1-authority-
  boundary-inventory.js` (`PURE_PROPOSAL_SOURCES`, same class as the sibling
  resolver modules `ioc-mechanic-resolution.js`/`sole-remedy-resolution.js`
  sit in -- cannot be `PRODUCTION_PATH_PURE_ANALYSIS` because it imports
  `../canonical-bytes` for `contentId`, and that class forbids any module
  dependency). Checked this gate exists and fires before assuming it would
  catch an unclassified file: it did, on the first run, exactly as
  designed (`UNCLASSIFIED_CHANGED_SOURCE`), then passed once classified.

### Proof

Real, committed Modiv run, replayed (not simulated):
`tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js`'s
new "payment timing" test asserts all six branches resolve with their own
real quote:

| branch | `fee_side` | `payment_timing_quote` |
|---|---|---|
| `7.3(b)(i)`, `7.3(b)(iv)`, `7.3(b)(v)` | SELLER | `within two (2) Business Days after the date of such termination by Parent` |
| `7.3(b)(ii)` | SELLER | `prior to or substantially concurrently with such termination by the Company` |
| `7.3(b)(iii)` | SELLER | `within two (2) Business Days after the earlier of entry into a definitive agreement relating to the Company Acquisition Proposal referred to in clause (B) of Section 7.3(b)(iii) and consummation of such Company Acquisition Proposal` |
| `7.3(c)` | BUYER | `within two (2) Business Days after the date of such termination by the Company` |

Direct unit tests,
`tests/canonical-v2-modiv-termination-fee-payment-timing-parser.test.js` (5
tests): the builder's own required-field/content-addressing contract; the
six-row parse against real Modiv text, with every quote checked to be a
genuine substring of that text; and three hostile cases, all refusing rather
than guessing -- a missing branch, a side-mismatched branch, a differently-
worded (non-Modiv) agreement, and a duplicated payment-timing sentence
(ambiguous nesting).

```
CI=true node --test tests/canonical-v2-modiv-termination-fee-payment-timing-parser.test.js \
  tests/canonical-v2-modiv-termination-fee-source-parser.test.js \
  tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js \
  tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js \
  tests/canonical-v2-termination-fee-parse.test.js \
  tests/canonical-v2-termination-fee-resolution.test.js \
  tests/canonical-v2-conditional-termination-fee-value.test.js \
  tests/canonical-v2-candidate-resolution.test.js
```
**EXIT=0**, 191/191.

```
CI=true node --test <every test file `grep -rl "native-producer/candidate-resolution" tests/*.test.js` finds> \
  tests/canonical-v2-modiv-termination-fee-payment-timing-parser.test.js \
  tests/canonical-v2-negation-boundary-resolver.test.js
```
**EXIT=0**, 655 tests, 641 pass, 0 fail, 14 skipped (pre-existing).

`tests/canonical-v2-phase1-authority-boundary.test.js` -- **EXIT=0**, 19/19,
after classifying the new file (failed with `UNCLASSIFIED_CHANGED_SOURCE`
before that classification was added, confirming the gate is live).

`bash scripts/lint/forbidden-patterns.sh` -- **EXIT=0**, `INVARIANT-4: PASS`.

### What this step's own text got wrong

The step's own "Change" section named `lib/canonical-v2/contract-bundle.js`,
"as claim-definition work, with the eleven-edit cost per genuine new claim
definition that file's own convention requires." Neither field ended up
touching `contract-bundle.js` at all: the grounds field is an additive
claim `attributes` key (no registered claim definition needed, the same
shape `limb_amount_quote` and `limb_amount_disambiguated` already used); the
payment-timing field is a wholly separate sidecar output array, structurally
identical in kind to the pre-existing `conditional_termination_fee_values`
sidecar, never a claim at all. The step's prediction about WHAT needed
building (two real fields, cited, per-limb) was right; its prediction about
HOW was wrong for both fields, independently.

### Disposition, not deferred

Both fields are now extracted, cited, against a real agreement, satisfying
this step's own acceptance criterion literally. Neither is "deferred" in the
sense the step's own escape hatch describes (Ben ruling it out of scope) --
grounds is genuinely complete; payment timing is genuinely, and honestly,
narrower than DECISIONS.md item 5's eventual target, for reasons (no live
model access, a codebook decision this task does not own) recorded in both
`PLAN.md` and `DECISIONS.md` directly, not left implicit. The general,
coded, per-family payment-timing extraction DECISIONS.md item 5 ultimately
wants remains open, and is now precisely scoped (a live-model producer-field
change plus a Ben-reviewed codebook decision) rather than untracked.
