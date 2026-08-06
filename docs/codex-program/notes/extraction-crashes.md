# Extraction crashes: three families, three bugs in our own code

Scope: fix the three crashes from last night's 25-family live run against
Modiv. A separate agent is analysing aggregate resolution quality across all
25; this note covers only the three that crashed outright, and is
independent of that analysis. All three were reproduced offline from the
real recorded evidence under `evidence/canonical-v2/modiv-*-20260806/`, not
from invented inputs, and all three fixes were proven against a live
before/after run of their own regression test (see each section's
"proof of regression" below).

Files touched, all under `lib/` or `tests/`:

- `lib/canonical-v2/native-producer/sole-remedy-resolution.js` (Crash 1)
- `lib/canonical-v2/native-producer/ioc-mechanic-resolution.js` (Crash 1)
- `lib/canonical-v2/native-producer/candidate-resolution.js` (Crash 2)
- `lib/canonical-v2/native-producer/native-extraction-run.js` (Crash 3)
- `tests/canonical-v2-modiv-interim-operating-open-world-freeze-replay.test.js` (new, Crash 1)
- `tests/canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js` (new, Crash 2)
- `tests/canonical-v2-modiv-closing-conditions-partial-receipt-replay.test.js` (new, Crash 3)

Nothing under `docs/codex-program/ROADMAP.md`,
`docs/codex-program/notes/all-families-aggregate.md`, or
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs` was
read or touched, per the file constraint for this task.

---

## Crash 1: INTERIM_OPERATING, section 5.1

### Symptom

```
TypeError: Cannot assign to read only property '0' of object '[object Array]'
```

### Diagnosed to a line

`lib/canonical-v2/native-producer/candidate-resolution.js:9522` (line number
after the fix; unmoved by it):

```js
openWorld.splice(0, openWorld.length, ...iocMechanicResolution.open_world);
```

`.splice()` on a frozen array throws exactly this error. `openWorld` here is
`resolveCandidates`'s own local, `const`-bound array (`candidate-resolution.js:3816`,
originally declared as a plain mutable `[]`). It should never be frozen at
this point. It was.

### Mechanism, proved not guessed

Immediately above the crash site, `resolveCandidates` calls
`resolveSoleRemedyOpenWorld({ open_world: openWorld, ... })`
(`sole-remedy-resolution.js`). That function has a "vocabulary does not
support sole remedy" early-return branch:

```js
if (!vocabularySupportsSoleRemedy(contractVocabulary)) {
  return freeze({ ..., open_world: openWorld, ... });
}
```

`openWorld` here is not a copy. It is the exact same array object
`resolveCandidates` is still holding and about to mutate again. `freeze()`
(both `sole-remedy-resolution.js` and `ioc-mechanic-resolution.js` define
their own identical copy of this helper) recursively calls `Object.freeze()`
on every value it finds, including this one. Passed the caller's live array
by reference, it froze that array in place, as a side effect of building an
unrelated return value.

Proved with a Node script (`node -e`) that `compileFixtureContractV34()` --
the contract bundle `unified-runner-execute.js` defaults to, and the shape my
replay reproduced the crash under -- registers no `REM-SOLE` concept and no
`SOLE_REMEDY_LEGAL_EFFECT_PRESENT` / `SOLE_REMEDY_CARVEOUT_KIND` claim
definitions. `vocabularySupportsSoleRemedy` is a pure membership check against
exactly those three names, so it returns `false` for this vocabulary, always,
for every family. This means every single `resolveCandidates()` call under
this contract version hits this freeze, not just INTERIM_OPERATING's.

`ioc-mechanic-resolution.js`'s `resolveIocMechanics` has the identical
pattern in its own disabled branch (no IOC-surface items present):
`return freeze({ ..., open_world: openWorld, ... });`, same aliasing bug,
same file-header `freeze()` helper.

The reason only INTERIM_OPERATING crashed: `resolveCandidates` calls both
functions in sequence, then conditionally does a second `openWorld.splice()`
only when the SECOND call (`resolveIocMechanics`) is `enabled: true` -- which
only happens when the section's open-world items include at least one
IOC-surface mechanic (`AFFIRMATIVE_COVENANT`, `LONG_TAIL_RESTRICTION`,
`CONSENT_OR_EFFORTS_STANDARD`, `EXCEPTION`, `THRESHOLD_OR_NOTICE_WINDOW`).
Those surfaces are only ever produced by the INTERIM_OPERATING family's own
producer prompt. Every other family's `resolveCandidates()` run also
silently freezes its own `openWorld` (via the sole-remedy step, which is
disabled for every family under this vocabulary), but nothing downstream
ever tries to write into it again, so nothing crashes. INTERIM_OPERATING is
the only family whose own downstream code performs a second write into an
array something else already froze out from under it.

Proved directly: reproduced the exact crash, at the exact line, by replaying
the real recorded model response for Modiv 5.1
(`evidence/canonical-v2/modiv-interim-operating-20260806/native-producer-recorded-response-5.1.json`,
a valid, complete, non-truncated JSON response -- this is purely a bug in our
own resolution code, never a model-quality issue) through
`sectionizeAdmittedSource` -> `runNativeExtraction` -> `resolveCandidates`
against the committed Modiv HTML fixture, `compileFixtureContractV34()`, and
`covenant_side: 'TARGET'`.

### Fix

Both disabled branches now return a copy, `open_world: [...openWorld]`,
never the caller's own reference -- exactly matching what their own
`enabled: true` branches already do (`retainedOpenWorld` in
`sole-remedy-resolution.js`, `nextOpenWorld` in `ioc-mechanic-resolution.js`,
both freshly built arrays, never the input). `freeze()` now only ever
freezes a copy. The caller's `openWorld` is never touched.

I judged removing the freeze was the wrong fix and did not do it. The freeze
itself is not the bug; it is doing exactly its job (making a published
resolution result immutable). The bug is that a value the function does not
own was let inside the thing being frozen. Copying at the boundary is the
correct fix, per the task's own framing, and it is a one-line change per
site with no change to any published shape.

### Regression test

`tests/canonical-v2-modiv-interim-operating-open-world-freeze-replay.test.js`,
4 tests:

- Two direct unit tests, one per fixed function, asserting the disabled
  branch never returns the caller's own array reference, the caller's array
  is never frozen, and the caller can still mutate it afterward (the exact
  operation that used to crash).
- Two full-pipeline tests replaying the real Modiv 5.1 evidence through
  `sectionizeAdmittedSource` -> `runNativeExtraction` -> `resolveCandidates`,
  pinning section bounds and the measured resolved/review_queue/open_world
  counts (10 / 54 / 46).

Proof of regression (both proofs done the same way for all three crashes:
temporarily reverted the fix with the Edit tool back to the exact pre-fix
line, ran only that crash's own test file, confirmed it failed with the same
error the real run hit, then re-applied the fix and confirmed green again):

Reverted both `sole-remedy-resolution.js` and `ioc-mechanic-resolution.js`
back to `open_world: openWorld` (no copy). All 4 tests failed: both unit
tests on the direct `notEqual` assertion, both pipeline tests with the exact
same `TypeError: Cannot assign to read only property '0' of object
'[object Array]'` at `candidate-resolution.js`'s splice, that the real
overnight run hit. Restored the fix; all 4 passed again.

### Could this affect families beyond INTERIM_OPERATING?

Yes, in two distinct ways, both already covered by this fix:

1. Every family's `resolveCandidates()` run freezes its own `openWorld` as
   an unnoticed side effect of the sole-remedy step, today, regardless of
   family -- confirmed by the `compileFixtureContractV34()` check above.
   This has been silently true for every run in this repo since the
   sole-remedy resolver landed. It only crashes when something downstream
   tries to mutate `openWorld` a second time. INTERIM_OPERATING is the only
   family that currently does; a future family whose own resolution wiring
   adds a second `openWorld` mutation after the sole-remedy step would hit
   the identical crash, at a different line, until this fix.
2. `resolveIocMechanics`'s own disabled branch had the same bug
   independently of the sole-remedy one. Any future code path that mutates
   `openWorld` a third time, after both the sole-remedy and IOC steps, would
   have hit it too, again until this fix (both are fixed now, not just the
   one that happened to crash first).

No other `open_world: openWorld`-shaped alias exists anywhere in
`lib/canonical-v2/native-producer/` or `lib/canonical-v2/` (checked by grep
across the whole tree); these were the only two.

---

## Crash 2: NO_OTHER_REPS_FRAUD, section 3.25

### Symptom

```
CanonicalValidationError: writeSet.claims[<id>].attributes.answer_provenance
is required: this write set originates from the native producer
(write_set_origin: 'NATIVE_PRODUCER').
```

### Diagnosed to a line

`lib/canonical-v2/native-producer/candidate-resolution.js`, inside
`handleNoOtherRepsCandidate` (the handler for the NO_OTHER_REPS /
NON_RELIANCE / EXTRA_CONTRACTUAL generic claim keys). The `rebuildClaim(...)`
call at the end of that handler used `attributesReplace: governedAttributes`,
and `governedAttributes` (built a few lines above from `{representation_side:
side}` plus the model's own allowed attributes) never included
`answer_provenance`.

### Mechanism, proved not guessed

`rebuildClaim`'s `attributesReplace` option is a full replace of the claim's
`attributes`, never a merge (`lib/canonical-v2/native-producer/candidate-resolution.js`,
`rebuildClaim`'s own header comment states this explicitly, contrasting it
with `attributesExtra`, which does merge). Whatever `attributesReplace` is
handed becomes the entire published `attributes` object. Every other
`attributesReplace` call site in the file (SHARE_COUNT, bring-down tiers,
antitrust-regulatory, defined terms) folds `answer_provenance:
buildMechanicalAnswerProvenance(...)` into the replacement set inline.
`handleNoOtherRepsCandidate` was the one handler that omitted it, so every
claim it resolved published with the key entirely absent, not merely null.

`resolveCandidates()` itself never checks for `answer_provenance` (it is not
one of its own gates), so the bad claim passed resolution cleanly and only
surfaced downstream, in `validateResolvedCanonicalWriteSet`
(`lib/canonical-v2/validate-write-set.js`'s `validateAnswerProvenanceRow`),
which correctly requires it on every claim whose `write_set_origin` is
`NATIVE_PRODUCER`.

Proved directly: reproduced the exact crash, with the exact claim id from
the real run, by replaying the real recorded model response for Modiv 3.25
through the full pipeline (`sectionize` -> `runNativeExtraction` ->
`resolveCandidates` -> `buildNativeWriteSet` ->
`validateResolvedCanonicalWriteSet`) against the committed Modiv HTML
fixture and `compileFixtureContractV34()`.

### Fix

`handleNoOtherRepsCandidate` now attaches `answer_provenance:
buildMechanicalAnswerProvenance({})` at the `rebuildClaim` call site.
MECHANICAL, no extra pins: this handler's `canonical_value` is always the
fixed constant `true`, gated only by verbatim quote and attribute checks,
never a model judgement call about what the value should be. That is the
same shape `IOC_RESTRICTION_PRESENT` uses immediately above it in the same
file (also a mechanically-gated PRESENT claim, also `buildMechanicalAnswerProvenance({})`
with no extra pins), so it is the correct, consistent tag, not a new
category invented for this fix.

### Regression test

`tests/canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js`,
3 tests, replaying the real Modiv 3.25 evidence through sectionize ->
runNativeExtraction -> resolveCandidates -> buildNativeWriteSet ->
validateResolvedCanonicalWriteSet: pins the section bounds, asserts all
three resolved claims carry the exact `answer_provenance` value
`buildMechanicalAnswerProvenance({})` produces (recomputed independently in
the test, not hand-copied, so the assertion tracks the real helper), and
asserts write-set validation accepts all 3 claims with zero residuals and
zero quarantines.

Proof of regression: reverted `handleNoOtherRepsCandidate`'s
`attributesReplace` back to bare `governedAttributes` (no
`answer_provenance`). All 3 tests failed with the identical
`CanonicalValidationError`, same claim id, same message, that the real
overnight run hit. Restored the fix; all 3 passed again.

### Could this affect families beyond NO_OTHER_REPS_FRAUD?

No other family routes through `handleNoOtherRepsCandidate`; it is gated on
`NO_OTHER_REPS_REPRESENTATION_KEYS`, a closed set of exactly the three
generic claim keys this one family's producer emits. It cannot fire for any
other family's claims.

Within NO_OTHER_REPS_FRAUD itself, the bug was total, not partial: every
claim reaching this handler was affected, for all three of the generic keys
it handles (NO_OTHER_REPS, NON_RELIANCE, EXTRA_CONTRACTUAL), not just the
one this fixture happened to exercise. The other three of the family's six
generic claim keys (FRAUD_CARVEOUT, INDEPENDENT_INVESTIGATION,
WILLFUL_BREACH_DEFINITION) are declined by this same handler
(`NO_OTHER_REPS_REPRESENTATION_KEYS.has(genericKey)` is false for them) and
routed elsewhere; this fixture contained none of them, so I did not trace
that separate path as part of this fix -- it is out of scope for the crash
actually observed, and I did not want to guess at behaviour I have not
reproduced.

I checked whether the same omission exists anywhere else: every other
`attributesReplace` call site in `candidate-resolution.js` (grepped, all
five, including this one) was inspected directly. The other four already
include `answer_provenance`. This handler was the only exception.

---

## Crash 3: CLOSING_CONDITIONS, sections 6.1, 6.2, 6.3, 6.4

### Symptom

```
native producer model call failed after 1 attempt(s): model response does
not contain one complete, parseable JSON object
```

### What I proved, versus what the task described

The task's framing says this died "on the third call" and that "one
malformed response discards three successful calls that were already paid
for." I could not confirm that framing against a run log (none exists in
the evidence directory; only the JSON artefacts do), so I reproduced the
failure directly from the recorded evidence instead, per this task's own
"or reproduce ... offline" instruction. What I found, and can show
mechanically:

- `evidence/canonical-v2/modiv-closing-conditions-20260806/call-telemetry.json`
  records exactly two calls: `call_index 0` for section 6.1 (succeeded,
  parses as clean JSON), `call_index 1` for section 6.2 (billed, recorded,
  real usage numbers), then `"failed": true` with the exact error string
  above. No `native-producer-recorded-response-6.3.json` or `-6.4.json`
  exist anywhere in evidence, because the run never reached them.
- The recorded response for section 6.2 itself
  (`native-producer-recorded-response-6.2.json`) is not JSON. It is 1031
  characters of complete, well-punctuated prose in which the model narrates
  "Written to `evidence/canonical-v2/modiv-closing-conditions-20260806/native-producer-recorded-response-6.2.json`,
  matching the sibling `6.1` file's schema" and summarises "8 closing-condition
  assertions" and "3 open_world_candidates" in prose, rather than emitting
  the JSON payload itself. Checked mechanically: zero `{` and zero `}`
  characters anywhere in the text.
- Replaying sections `['6.1','6.2','6.3','6.4']` through the real
  `runNativeExtraction`, feeding the real recorded 6.1 and 6.2 text through
  a replay client that throws if ever asked for a third section, reproduces
  the exact error text above, on the SECOND call, and the harness's own
  "never asked for a third section" guard never fires -- proving, not just
  asserting, that 6.3 and 6.4 are never dispatched.

So: what I can prove from the evidence is that the malformed response is
section 6.2's own (the second of the four dispatched sections), and that the
run discarded one already-successful call (6.1's), not three. I am
reporting this discrepancy plainly rather than either silently adopting the
task's "third call" / "three calls" framing or silently contradicting it.
It does not change the engineering problem or the fix: whether it is one
prior call discarded or three, the failure mode -- "a later malformed
response erases earlier successful, already-paid-for work in the same
batch" -- and its fix are identical.

### Truncated versus malformed in some other way

Not truncated. Proved, not assumed: the recorded text ends on a complete
sentence ("...verified as a byte-identical contiguous substring of the
source text before writing."), carries balanced markdown formatting
throughout, and shows no sign of a mid-word or mid-token cutoff. Compare the
call's own telemetry: `output_tokens: 27268` against a `maxOutputTokens` of
64000 for `claude-sonnet-5`, nowhere near the cap. This is also a strong,
if secondary, clue about what actually happened: 27268 output tokens is far
more than the 1031-character response that was actually captured could
account for. The model backing this call is invoked through the `claude -p`
Claude Code CLI, itself a full agentic coding harness, not a bare completion
endpoint. The most consistent explanation is that the model spent most of
those tokens on an internal tool-use turn (plausibly an actual attempt to
write the JSON to a file, matching the prose's own claim of having done
exactly that), and the CLI wrapper's `result` field -- which is what this
pipeline treats as "the model's response" -- only captured its final,
short, natural-language wrap-up message, not the tool call's own payload.
I am reporting this as the most consistent explanation of the evidence, not
as a confirmed root cause of the CLI's own internal behaviour, which is
outside this repo.

This matters directly for the retry question below: a truncation failure is
usually structural (the same prompt against the same document tends to
truncate again) and a bare retry would not reliably fix it. An agentic
derailment on one particular call is closer to stochastic; a second attempt
at the identical prompt has a real chance of getting a direct, un-narrated
JSON response instead.

### The three options, and what I recommend

**1. A single bounded retry with honest counting.** I looked for where this
would have to live before designing it, and found it already exists, fully
built and already wired for honest counting on both outcomes.
`lib/canonical-v2/native-producer/anthropic-provider.js`'s
`createAnthropicProvider` already supports a `maxRetries` parameter
(default 2, i.e. three attempts, per its own JSDoc) with exponential
backoff, and every attempt increments `attemptsUsed`, which is surfaced as
`attempts` on both the success return path (line ~3741) and the failure
return path (`RETRIES_EXHAUSTED`, line ~3719) -- nothing here needed
building. The choice to run last night's batch at `maxRetries: 0` was made
at the call site, in the runner script this task puts off limits to me, and
the task states that reasoning is sound (avoid a retry silently blurring
the runner's own reported call count). I have not verified that reasoning
myself and it is not my file to change; I am not recommending it be
overridden. If a future operator decides the stochastic-agentic-derailment
risk is worth one bounded retry, the honest-counting machinery to do it
safely is already there and does not need this task to add anything.

**2. Persist partial results from successful calls.** This is the fix I
implemented, in `lib/canonical-v2/native-producer/native-extraction-run.js`.
I judged this the right one to actually build, for three reasons: it is
squarely inside files this task put in scope; it is valuable regardless of
whatever turns out to cause any future malformed response (truncation,
agentic derailment, or something else entirely); and it does not touch, or
need to touch, the `maxRetries` policy question at all.

Before this fix, `runNativeExtraction`'s per-section loop accumulated
`resolved_sections`, `compiled_candidates`, and every other receipt field
into local arrays, and only assembled them into the returned receipt after
the whole loop finished without error. A thrown error from any section's
provider call propagated straight out, and every earlier section's
already-succeeded work, still sitting in those local arrays, was never
returned to any caller. Fixed by wrapping the one call that can fail this
way (`produceCandidateProposals`, the provider call itself) in a try/catch.
On failure, a frozen `partial_run_receipt` -- same field shape as the real
receipt for everything resolved strictly before the failure, plus which
section failed, why, and which sections were never attempted -- is attached
to `error.details.partial_run_receipt` before the exact same error (same
constructor, same `.code`, same `.message`) is re-thrown. Every existing
catch site keeps working completely unmodified; nothing about this fix can
turn a bad response into a good one, because the error still propagates and
the run still stops -- it only stops discarding what already succeeded
before that point. The partial receipt carries its own distinct
`schema_version` (`NATIVE_EXTRACTION_RUN_PARTIAL_RECEIPT/V1`, never
`NATIVE_EXTRACTION_RUN_RECEIPT/V1`) specifically so nothing downstream could
ever mistake it for a complete, content-addressed receipt by accident.

Proved the preserved data is not just present but correct: the 6.1 data
inside the partial receipt from the four-section replay is byte-identical
(compared via `canonicalJson`) to what a wholly separate, section-6.1-only
`runNativeExtraction` run produces.

**3. What I deliberately did not build.** A retry loop inside
`native-extraction-run.js` or `anthropic-provider.js` beyond what already
exists, and any change to the overnight runner's `maxRetries: 0` policy
itself (out of scope, in an off-limits file, and not mine to second-guess
given the task's own statement that its reasoning is sound). I also did not
make the per-section loop continue past a failed section to attempt later
ones (e.g. still trying 6.3/6.4 after 6.2 fails) -- that would mean spending
more model calls immediately after a demonstrated malformed response, a
strictly more aggressive default than today's, and the task's fail-closed
constraint reads more naturally as "stop, but do not lose what already
succeeded" than "keep going anyway."

### Regression test

`tests/canonical-v2-modiv-closing-conditions-partial-receipt-replay.test.js`,
7 tests:

- A grounding test confirming the recorded 6.2 evidence really is
  zero-brace, complete prose, not truncated JSON (if this ever fails, every
  other test in the file is testing the wrong failure mode).
- Section-bounds pin against a standalone 6.1-only run.
- The real recorded 6.1/6.2 evidence, replayed through all four
  `section_references`, still throws the identical error type, `.code`, and
  `.message` as before this fix (proves the fix changed nothing about the
  fail-closed behaviour itself).
- The thrown error now carries a well-formed `partial_run_receipt`: 6.2
  named as `failed_section_reference`, `['6.3','6.4']` as
  `unattempted_section_references`, 6.1 alone in `resolved_sections`, a
  positive `compiled_candidate_count`, frozen.
- 6.3/6.4 are never dispatched, proved (not merely asserted) by a replay
  client that throws if it is ever invoked a third time -- the test reaching
  this point at all, without that guard firing, is the proof.
- The preserved 6.1 data is byte-identical, via `canonicalJson`, to a
  wholly independent 6.1-only run.
- `NativeExtractionRunError` stays exported and distinct from the actual
  thrown error class, documenting that this crash is the provider's own
  error type, re-thrown with data attached, never a new error type invented
  for this fix.

Proof of regression: reverted the try/catch in `native-extraction-run.js`'s
per-section loop back to a bare `await produceCandidateProposals(...)`, no
partial-receipt attachment. Result: 5 of 7 tests still passed unchanged
(grounding, section bounds, "still throws the identical error," "6.3/6.4
never dispatched," and the `NativeExtractionRunError` export check -- all of
these test pre-existing or fix-independent behaviour, correctly). The 2
tests that specifically assert on `error.details.partial_run_receipt`
failed: one on `partial_run_receipt` being `undefined`, the other with a
`TypeError: Cannot read properties of undefined (reading 'resolved_sections')`
trying to read it. Restored the fix; all 7 passed again. This asymmetric
result is the correct one for this fix: it does not change whether or how
the run fails, only whether the earlier work survives that failure, so only
the tests checking survival should move.

### Could this affect families beyond CLOSING_CONDITIONS?

Yes, structurally, for any family whose live run dispatches more than one
section per `runNativeExtraction` call (i.e. any multi-section family run
through the same batch-style runner CLOSING_CONDITIONS ran through last
night). The bug was never CLOSING_CONDITIONS-specific: it was that
`runNativeExtraction`'s per-section loop discarded every prior section's
work on any provider failure, regardless of which family or which section
triggered it. The fix lives at that same general level (the loop itself,
inside `native-extraction-run.js`), not inside anything CLOSING_CONDITIONS-
specific, so it protects every family's multi-section runs going forward,
not just this one. The malformed-response TRIGGER (an agentic, narrated
non-JSON reply) is plausibly specific to large prompts/contexts under the
`claude -p` CLI transport, and could recur for any family whose dispatched
section is large enough to provoke the same behaviour -- I have not
reproduced that trigger condition precisely enough to say which families
are more or less exposed to it, only that the discard-on-failure bug it
exposed here is general, and is now fixed generally.

---

## Verification

`CI=true npm test > /tmp/crashes.log 2>&1; echo "EXIT=$?"`, full suite, run
after all three fixes and all three new test files landed.

`$?` on the `npm test` command itself: `EXIT=0`.

Suite summary: `tests 7690, pass 7648, fail 0, cancelled 0, skipped 42,
todo 0`. One summary block in the log (confirmed by grep, not assumed), so
this is the whole suite's own aggregate, not one shard of several. All 14
new tests across the three new files (4 + 3 + 7) confirmed present and
passing by name in the log, not just inferred from the pass count.

The 7675-test baseline this task quoted predates this session's other
concurrent work on this shared branch (see e.g.
`docs/codex-program/notes/general-extraction-runner.md`'s own note about
other agents' in-flight changes on this branch); 7690 here is that baseline
plus this task's 14 new tests plus a small amount of other unrelated
concurrent activity, not a discrepancy in this task's own work. Every
individual regression proof in this note (each fix reverted, its own test
file re-run, failure confirmed, fix restored, green confirmed again) was
already done in isolation before this full-suite run; this run is the
whole-suite confirmation that nothing else broke.
