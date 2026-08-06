# Fee-side section-family scope fix -- working notes

Target: `lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleFeeTriggerCandidate` and its fee-side corroboration fallback
(`feeSideFromFullPaymentContext`, ~5737 at task start).

## Status: DONE

## The defect, confirmed against the evidence before changing anything

Read `evidence/canonical-v2/modiv-termination-fee-promptv3-20260805/resolution.json`
(78 KB, as instructed) in full. `review_queue[0]`:

```
"section_reference": "7.1", "source_citation": "7.1(c)(i)",
"generic_claim_key": "NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE",
"reasons": ["FEE_SIDE_UNCORROBORATED"],
"raw_value": "the Company Board has approved, and substantially concurrently
with the termination of this Agreement, the Company enters into, a
definitive agreement providing for the implementation of a Superior
Proposal"
```

Cross-checked against `native-producer-recorded-response-7.1.json` (1.9 KB):
the model's own `fee_trigger_assertions[0]` for section 7.1 carries
`"fee_side": "SELLER", "trigger_code": "SUPERIOR_PROPOSAL_TERMINATION"` on
this exact, byte-identical quote. The model got it right.

Read `handleFeeTriggerCandidate` and `feeSideFromFullPaymentContext` in
`candidate-resolution.js` in full (they were at ~5719-5812 before this
session's edits, per `docs/codex-program/notes/trigger-override-fix.md`'s
own line numbers, confirmed still current at task start). Confirmed
directly, not inferred:

```js
function feeSideFromFullPaymentContext({ sectionReference, feeSide }) {
  const section = sectionsByReference.get(sectionReference);
  ...
}
```

only ever looks up `sectionsByReference.get(entry.section_reference)` --
i.e. the ONE section this specific candidate was dispatched from (7.1) --
and never any other section. `FEE_SIDE_FULL_PAYMENT_CONTEXT_PATTERNS.SELLER`
is a full sentence ("the Company shall pay ... the Company Termination Fee
... by wire transfer ... to an account designated by Parent.") that does not
appear anywhere in Section 7.1's text (7.1 is the termination-grounds
section; confirmed structurally by `run-receipt.json`'s per-section
`start`/`end` spans -- read only the small, targeted fields needed
(`section_reference`, `start`, `end`, `section_family`,
`section_family_provenance`) via a script, per the brief's instruction not
to read this 291 KB file directly). The payment sentence lives in Section
7.3, dispatched in the same run, same `section_family` (`TERMINATION_FEE`,
`section_family_provenance: SECTION_FAMILY_MANIFEST_ASSIGNED` for all three
of 7.1/7.3/8.12), confirmed directly by regex-matching the real committed
Modiv HTML fixture through the real sectionizer (see "Empirical correction"
below) -- Section 7.3 contains the SELLER sentence exactly once.

**Diagnosis confirmed exactly as briefed.** `docs/codex-program/P1-PLAN.md`
(Part 2.3, Part 2.4's "second condition", RES1's own residual note) makes
the identical claim independently, and
`docs/codex-program/notes/trigger-override-fix.md` (a sibling task's own
notes, written concurrently) independently names this exact issue as "out
of scope per brief and per coordinator; not modified" for that task, a third
convergent source. Not a case of "diagnosis was wrong, stop."

## The design question, and what I chose

Three candidate scopes were named in the brief: same section family, quote-
cross-referenced sections only, or a specifically-named fees section. I
chose **same section family** (`run_receipt.resolved_sections[i].section_family`,
already assigned at dispatch time, before this fix existed, for an unrelated
reason -- routing to the right producer prompt).

**Why not "quote cross-references only" (citation-following).** Section
7.1(c)(i)'s quote names no other section and no defined fee term at all
("the Company Board has approved ... a Superior Proposal" -- no cross-
reference). Citation-following, even if built, structurally cannot reach
this candidate; P1-PLAN.md 2.3 makes the same observation. This is why RES1
(citation-following, a *different*, larger, not-yet-built mechanism for
TRIGGER codes) and this fix are not the same lever, and this fix does not
touch RES1's territory at all -- confirmed by grep, `findSectionByReference`
is never called from `handleFeeTriggerCandidate` before or after this
change.

**Why not "a specifically-named fees section."** Would require hardcoding a
section reference or title pattern specific to this one family's usual
shape ("7.3", or "Fees", or similar), which breaks the moment a deal numbers
its fees section differently, and is exactly the kind of deal-specific
special-casing the rest of this family's code deliberately avoids (compare
`feeSideFromFeeTermRef`'s own comment on why it reads the candidate's own
attribute rather than a named section).

**Why "same section family" is principled, not "every section in the run."**
`section_family` is not something I invented for this fix -- it is the same
field `native-extraction-run.js` already uses to route each section to its
producer prompt (`TERMINATION_FEE` -> `termination-fee-producer-prompt.js`,
`MAE_DEFINITION` -> a different producer, etc.), assigned once, at dispatch
time, before any candidate exists. Widening to "every section in the run"
would let a completely unrelated family's section (MAE Definition,
Antitrust, a different Article) corroborate a termination-fee candidate
merely because it happened to be dispatched in the same batch -- the exact
unprincipled scope the brief warned against, and directly tested against
below (hostile test 3).

## A safety hole I found, not given, and closed

`native-extraction-run.js`'s `DEFAULT_SECTION_FAMILY` stamps **every**
resolved section with the identical literal string `'CAPITALISATION'`,
`section_family_provenance: null`, whenever a run supplies neither a
manifest nor a classifier (its own comment: "no classifier means every
section is still CAPITALISATION, exactly as when the import was hard-
required"). If my widened scan trusted `section_family` alone, ANY run built
without a manifest/classifier -- which includes most of the existing
resolver test suite's own harness, `resolveTerminationFeeAssertions` in
`tests/canonical-v2-termination-fee-resolution.test.js`, which never passes
either -- would have every one of its sections silently collapse into one
giant "family," and "same section family" would degrade into exactly
"every section in the run" by accident, for any multi-section run that
happens not to use a manifest.

Closed by requiring a REAL provenance
(`SECTION_FAMILY_MANIFEST_ASSIGNED` or `SECTION_FAMILY_AI_CLASSIFIED`, the
two provenances `section-family-classifier.js` actually mints when
something deliberately decided a section's family) on BOTH the candidate's
own section and every sibling section scanned, not just a `section_family`
string match. Tested directly (hostile test 6 below): two sections, one
containing the real defect's quote and the other containing the exact
payment sentence, with NO `section_family_assignments` supplied at all
(both default to `CAPITALISATION`/`null`) -- the fallback must not fire,
and does not.

## Empirical correction to my own first draft (the ambiguity rule)

The brief requires: "If the wider scan finds evidence for BOTH sides, that
is `AMBIGUOUS_FEE_SIDE`, never a coin flip." My first implementation took
this literally and aggregated matches across the whole family: if the
SELLER pattern matched anywhere in the family AND the BUYER pattern matched
anywhere in the family, ambiguous.

**This failed against the real evidence**, measured, not assumed. Ran the
existing full-pipeline replay test
(`tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`,
which replays the real committed Modiv HTML fixture, the real
`sectionizeAdmittedSource`, and the real recorded model responses for
7.1/7.3/8.12 dispatched together as `TERMINATION_FEE`) against that first
draft: ALL SIX of the fixture's `FEE_SIDE_UNCORROBORATED` trigger candidates
flipped to `AMBIGUOUS_FEE_SIDE`, including the one this task targets. Wrote
a direct diagnostic (`/tmp/diag-fee-side2.js`, not committed) that slices
Section 7.3 out of the real, sectionized Modiv text with the same
`utf8Slice` byte-offset helper the production code uses, and confirmed why:
**Section 7.3, dispatched as the single node it is, contains BOTH complete
payment sentences** -- "the Company shall pay ... the Company Termination
Fee ..." (7.3(b), SELLER) and "Parent shall pay ... the Parent Termination
Fee ..." (7.3(c), BUYER) -- because Modiv, like most merger agreements, has
a two-way fee structure, and 7.3 states both parties' payment mechanics
side by side. Under "both sides matched anywhere = ambiguous," this is true
for essentially every zero-corroboration candidate in a two-sided fee
family, which makes the widening self-defeating: everything that used to
say `FEE_SIDE_UNCORROBORATED` now says `AMBIGUOUS_FEE_SIDE` instead, a
differently-labelled dead end, not a safer answer, and the one item the task
requires to resolve does not resolve.

**The corrected rule**, implemented and re-verified against the same real
replay (now green, see below): two clean matches drawn from the **same**
sibling section are not ambiguous -- each
`FEE_SIDE_FULL_PAYMENT_CONTEXT_PATTERNS` entry is a complete, self-
attributing sentence (its own grammatical subject names its own payer), so
finding "the Company shall pay ... the Company Termination Fee" is evidence
the Company-payable mechanism is real, on its own terms, regardless of
whether the Parent-payable mechanism is *also* stated nearby. This is the
identical trust level `feeSideFromFullPaymentContext` (unchanged, pre-
existing) already extends today whenever both sentences happen to sit in a
candidate's own section -- confirmed directly: Modiv's five other 7.3-
native trigger candidates already resolve their fee side through that
existing, untouched function, for exactly this reason, unaffected by
anything in this fix. `AMBIGUOUS_FEE_SIDE` now fires for the narrower shape
the brief's concern is actually about: the claimed side's clean match and
the *opposite* side's clean match coming from two **different** sibling
sections (support scattered rather than co-located) -- a shape this
codebase has no evidence is a real Modiv shape, but is cheap to guard
against and directly tested (hostile test 2 below).

I judged this distinction (self-attributing full sentence vs. bare word/
phrase) rather than proved it as a law of language; it is grounded in the
codebase's own existing precedent, not invented for this fix --
`feeSideFromFeeTermRef`'s own comment gives the identical reasoning for why
RES2 deliberately did NOT do a blind whole-section scan for the *shorter*
`FEE_SIDE_CORROBORATION_TABLE` phrases: "Section 8.12 defines both sides'
terms together ... would confirm EITHER claimed side and stop discriminating
at all." That concern is real for a bare word like "Amount"; it does not
apply the same way to a complete sentence whose own subject names its own
payer. Flagging this explicitly as a judgement call, not a mechanically
proven fact, per the brief's request to distinguish the two.

## Implementation

`lib/canonical-v2/native-producer/candidate-resolution.js`:

1. Added `SECTION_FAMILY_MANIFEST_ASSIGNED` to the existing
   `section-family-classifier` import, and a new module-level
   `SECTION_FAMILY_REAL_PROVENANCES` Set (the two real provenances).
2. New function `feeSideFromSectionFamilyPaymentContext({ sectionReference,
   feeSide })`, directly below the existing `feeSideFromFullPaymentContext`,
   same nesting level (inside `resolveCandidates`, closing over
   `sectionsByReference`/`runReceipt`/`admittedSourceContext`, same as its
   neighbour). Looks up the candidate's own section's `section_family`
   (returns `null` immediately if that section lacks a real provenance),
   then scans every OTHER section in `runReceipt.resolved_sections` sharing
   that family AND itself carrying a real provenance, testing BOTH sides'
   patterns per section (the existing function only ever tests one, because
   its caller already knows which side to check; this one has to test both
   because a sibling section could corroborate the side the model did NOT
   claim). Returns `null` (no evidence), `{ ambiguous: true }`, or
   `{ ambiguous: false, sectionReference, quote }`.
3. `handleFeeTriggerCandidate`'s corroboration block: the existing
   `directSides` / `feeSideFromFullPaymentContext` / `corroboratedSides`
   computation is **untouched, first three lines identical**. Only when
   `corroboratedSides.length === 0` (both the direct quote and the same-
   section fallback already came back empty -- provably the ONLY case that
   value can be zero, since a truthy `fullPaymentQuote` always yields
   `[feeSide]`, length 1) does it call the new function. An `ambiguous`
   result pushes `AMBIGUOUS_FEE_SIDE` immediately and returns. A real match
   reassigns `corroboratedSides = [feeSide]` and remembers the match for
   the output marker. No match leaves `corroboratedSides` at `[]`,
   unchanged, falling through to the pre-existing `>= 2` / `=== 0` checks
   exactly as before.
4. The final `finalizeTerminationFeeClaim` call's `extraAttributes` gains
   three keys **only when the widened path fired**
   (`fee_side_corroboration_scope: 'SECTION_FAMILY'`,
   `fee_side_corroboration_section_reference`,
   `fee_side_corroboration_quote`), omitted (not `false`/`null`) otherwise
   -- the exact convention `handleFeeAmountCandidate`'s own
   `limb_amount_disambiguated` already uses immediately above it in the
   same file, chosen deliberately to match, so `claim_revision_id` stays
   byte-identical for every claim that resolves the ordinary, same-section
   way.

**Not touched:** `feeSideFromFullPaymentContext` itself (0 lines changed),
`FEE_SIDE_FULL_PAYMENT_CONTEXT_PATTERNS`, `FEE_SIDE_CORROBORATION_TABLE`,
`feeSideFromFeeTermRef`, `handleFeeAmountCandidate`, `handleTailPeriodCandidate`,
`feeTriggerCorroboratedCodes`, `resolveModivConditionalFees`, or anything
outside this one file.

## Acceptance criterion 5: blast radius, checked by grep, not assumption

- `feeSideFromFullPaymentContext(` has exactly one call site: inside
  `handleFeeTriggerCandidate` (line ~5904 after this fix). Unchanged.
- `feeSideFromSectionFamilyPaymentContext(` (new) has exactly one call
  site: also inside `handleFeeTriggerCandidate` (line ~5917). It is not
  exported and cannot be called from anywhere else.
- `handleFeeTriggerCandidate(` is called from exactly one place, the main
  dispatcher, gated `if (genericKey === FEE_TRIGGER_CLAIM_KEY)`.
  `FEE_TRIGGER_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE'`
  (`anthropic-provider.js`), a termination-fee-family-only generic key.
- `handleFeeAmountCandidate` (the other termination-fee handler that
  resolved claims in this same evidence run) uses a structurally different
  mechanism, `feeSideFromFeeTermRef`, which reads the candidate's own
  asserted attribute and never scans any section -- confirmed unaffected
  directly: `git diff` shows zero lines changed inside
  `handleFeeAmountCandidate`, and the fixture replay test's two AMOUNT
  claims resolve to byte-identical values before and after.
- `handleTailPeriodCandidate` and every other family's handler
  (MAE, No-Shop, Antitrust, Termination Rights, Regulatory, ...) do not
  call, import, or reference either fee-side function; grepped directly,
  not inferred from naming.
- The other reader of `claim_definition_key === FEE_TRIGGER_CLAIM_KEY`,
  `resolveModivConditionalFees` (the Modiv REIT-cap side channel,
  P1-PLAN.md Part 3.3), filters `runReceipt.compiled_candidates` directly
  -- raw, pre-resolution candidates -- and never calls
  `resolveCandidates`'s internal handlers at all. Confirmed unaffected:
  the fixture replay test's `conditional_termination_fee_values` count is
  untouched (still 6, same values, same test assertion, unmodified by this
  session).

**Conclusion: this change affects exactly one code path -- termination-fee
TRIGGER candidates whose own quote and own dispatched section are both
silent on fee side -- and nothing else.**

## Tests added

`tests/canonical-v2-termination-fee-resolution.test.js`: new multi-section
fixture helper (`wrapMultiClauseAgreementShell` /
`resolveMultiSectionTerminationFeeAssertions`, three lettered sub-clauses
under one "Section 3.1" heading, each independently dispatchable and each
assignable its own `section_family` -- the existing single-section harness
in this file structurally cannot exercise a fallback that only fires when a
candidate's OWN section is silent, since it only ever dispatches one
section). Eight new tests:

1. **Real bytes, positive.** The real, byte-identical Section 7.1(c)(i)
   quote (copied from `resolution.json`/`native-producer-recorded-
   response-7.1.json`, not retyped/paraphrased) as the candidate, own
   section silent, sibling section (same family) carrying the SELLER
   sentence -> resolves `SUPERIOR_PROPOSAL_TERMINATION`/SELLER/TERMF-TARGET,
   with all three new attribute keys present and correct.
2. **Distinguishability, direct-quote path.** A same-section, direct-quote
   corroboration resolves without any `fee_side_corroboration_scope` key at
   all (`in` check, not just a falsy check).
3. **Distinguishability, same-section-fallback path.** A quote with no fee-
   side language of its own, but its OWN section (not a sibling) carrying
   the payment sentence -- the pre-existing, untouched
   `feeSideFromFullPaymentContext` path -- also resolves without the new
   key. Together with test 1, this is the acceptance-criterion-3 pin: same-
   section (2 shapes) vs. section-family (1 shape) are each exercised end
   to end and are distinguishable in the resolved claim's own output.
4. **Hostile, unrelated family.** Sibling section carries the exact SELLER
   sentence but is assigned `MAE_DEFINITION` (a different, real, registered
   family, real provenance) instead of `TERMINATION_FEE` -> stays
   `FEE_SIDE_UNCORROBORATED`, never resolves.
5. **Hostile, both sides, different sections.** SELLER sentence alone in
   one sibling section, BUYER sentence alone in a different sibling section,
   both `TERMINATION_FEE` -> `AMBIGUOUS_FEE_SIDE`, never resolves.
6. **Both sides, same section (not ambiguous).** SELLER and BUYER sentences
   both in the SAME sibling section (Modiv's real 7.3 shape) -> resolves
   cleanly to the claimed side, with the marker present. This is the direct
   regression pin for the empirical correction above.
7. **Hostile, no corroboration anywhere.** Sibling section present, same
   family, but contains neither sentence -> `FEE_SIDE_UNCORROBORATED`,
   unchanged from today.
8. **Hostile, the CAPITALISATION-default-bucket guard.** Two sections, no
   `section_family_assignments` supplied at all (both default to
   `CAPITALISATION`/`null` provenance) -- sibling section carries the exact
   SELLER sentence -> still `FEE_SIDE_UNCORROBORATED`, fallback must not
   fire even though the text would otherwise match.

`tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`
(pre-existing, NOT created by me -- see "why this file, not a new one"
below): updated three pinned assertions and the header comment to the new,
measured, post-fix counts (see "Outcome-change report"). This file replays
the real Modiv HTML fixture, real sectionizer, and real recorded model
responses for a sibling evidence bundle
(`modiv-termination-fee-scope-correction-20260805`) through the real
`runNativeExtraction` -> `resolveCandidates` -> `buildNativeWriteSet` ->
`validateResolvedCanonicalWriteSet` pipeline, dispatching 7.1/7.3/8.12 all
as `TERMINATION_FEE` -- i.e. it already carries the exact real-data shape
the brief asks for, for the identical underlying defect (confirmed by its
own pre-existing comment naming "Section 7.1(c)(i)'s Superior Proposal
ground" as one of its six `FEE_SIDE_UNCORROBORATED` items before this fix).
Rather than build a second, parallel full-pipeline replay myself --
something close to "creating a new recorded-response replay test," which
the brief says another agent already owns -- I ran this existing one before
touching any code (established the stale-assertion baseline), applied my
fix, re-ran it, and updated exactly the assertions my own change legitimately
invalidates, with a dated header addendum explaining why, matching this
file's own established convention for recording a correction in place
(the file already does this once, for the retracted RES1 count).

## Verification results

- `node --test tests/canonical-v2-termination-fee-resolution.test.js`: 51
  tests, 51 pass, 0 fail (was 43 before the 8 new tests).
- `node --test tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`:
  8 tests, 8 pass, 0 fail (all 8 pre-existing, 3 of them updated to new
  counts).
- Full suite: `CI=true npm test > /tmp/feeside.log 2>&1; echo "EXIT=$?"`
  read from `$?` on the `npm test` command itself, not piped. **EXIT=0.**
  Summary: 7487 tests, 7445 pass, 0 fail, 42 skipped, 0 todo. Grepped the
  full log for failure markers separately (`not ok`, `AssertionError`,
  red `✖`) -- none found outside the two intentionally-updated test files'
  own (now-passing) output. 42 skipped matches the pre-existing skip count
  reported by the concurrent trigger-override-fix session, consistent with
  no new or newly-broken skips introduced here.
- Did not run `npm run build`: this task's own Verification section
  specifies only the `npm test` command above, and nothing in this change
  touches UI/build-time code.

## Outcome-change report (acceptance criterion 2, before and after)

**MEASURED against the exact evidence bundle named in the brief**
(`modiv-termination-fee-promptv3-20260805`), not reasoned by analogy: wrote
a throwaway diagnostic (`/tmp/diag-promptv3.js`, not committed -- reads the
same committed Modiv HTML fixture and this bundle's own three recorded
responses, replays them through the real `runNativeExtraction` ->
`resolveCandidates`, exactly mirroring what the committed replay test above
already does for the sibling bundle) and ran it against this session's
finished code:

| | resolved | review_queue | open_world |
|---|---:|---:|---:|
| BEFORE (committed `resolution.json`, live, pre-fix) | 3 | 11 | 13 |
| AFTER (measured, this fix applied, same fixture + same recorded responses) | 4 | 11 | 13 |

The one new resolved claim: `NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE` /
`TERMF-TARGET` / canonical value `SUPERIOR_PROPOSAL_TERMINATION` -- exactly
the target, exactly the SELLER side. `open_world` is untouched (this fix
never reads or writes an open-world path). `review_queue`'s total is
unchanged (11); its composition shifts: the target item moves out into the
new resolved claim's mirror entry, and two near-duplicate 8.12 trigger
fragments ("if payable pursuant to Section 7.3(b)(iv) or Section
7.3(b)(v)", a bare citation with no trigger-ground language of its own)
move from `FEE_SIDE_UNCORROBORATED` to the more precise
`TRIGGER_UNCORROBORATED` -- their fee side now ALSO resolves via the same
widened family scan, but neither carries any trigger-ground keyword at all,
so both correctly fail at the separate, unrelated, unchanged
`feeTriggerCorroboratedCodes` gate. **Still unresolved, a more accurate
rejection reason, not a new resolution** -- these two items' real defect was
always "no trigger ground stated," not "no fee-side evidence," and this fix
makes that visible rather than leaving it masked behind the wrong reason
code. No other item in this bundle's `review_queue` changed reason or
resolution status. No `open_world` item changed. **Exactly one item resolved
that did not resolve before; zero items regressed from resolved to
unresolved; two items' rejection reason became more precise without
becoming a resolution.**

**Cross-checked against a second, independent, full-pipeline measurement**
on the sibling evidence bundle (`modiv-termination-fee-scope-correction-
20260805`, PROMPT_VERSION 1, a different extraction run against the
identical underlying Modiv document): the same shape holds. Resolved 3 -> 4
(same claim: Superior Proposal, SELLER, `SUPERIOR_PROPOSAL_TERMINATION`).
`review_queue` total unchanged at 16; five (not two, this bundle has more
near-duplicate 8.12 fragments) `FEE_SIDE_UNCORROBORATED` items move to
`TRIGGER_UNCORROBORATED` for the identical reason. `open_world` unchanged at
16. `conditional_termination_fee_values` (the separate REIT-cap side
channel) unchanged at 6. This second measurement is committed and CI-
checked (the updated replay test above), not a throwaway script, so it will
catch a future regression the promptv3 diagnostic (uncommitted) cannot.

## What I proved vs. what I judged

**Proved, mechanically, against real recorded bytes:** the diagnosis (both
functions read in full, the missing-scope cause confirmed by direct
inspection, not inference); the section-family assignment shape (`resolved_
sections[i].section_family`/`section_family_provenance`, read directly);
that Section 7.3 contains both payment sentences (regex-matched against the
real, sectionized Modiv text); that the fix resolves exactly the target
item and nothing else, on two independent full-pipeline replays of the real
document; that no other family or handler calls either fee-side function
(grep); that the full suite passes, `EXIT=0`.

**Judged:** that "same section family" is the right scope boundary (argued
above, against the two rejected alternatives); that a complete, self-
attributing sentence is safe to trust across sibling sections in a way a
bare defined-term phrase is not (grounded in the codebase's own existing
`feeSideFromFeeTermRef` reasoning, not independently re-derived from
scratch); that "different sections, different sides" is the right ambiguity
trigger rather than some other boundary (chosen because it is the shape the
brief's concern is actually about, and because "same section, both sides"
is empirically Modiv's own real shape and treating it as ambiguous makes
the fix self-defeating, not because I can prove no other boundary would
also work).

I did not conclude the widening was too risky to make. The version that
shipped is narrower than my first draft, for a reason grounded in real data,
not a guess.
