# Steps 3B and 3E

## Step 3B. Teach the number parser hyphenated compounds

**File changed.** `lib/canonical-v2/native-producer/cure-period-parse.js` (the
only file this step owns).

**Root cause.** `precedingSpelledWord` walked backward from the digit's
open-paren using `/[A-Za-z]/` to find the preceding spelled word. For
"forty-five (45) days" that scan stops at the hyphen, so it read back only
`"five"`, looked up `SPELLED_NUMBER_VALUES.five === 5`, compared it against
the digit `45`, and abstained `SPELLED_DIGIT_MISMATCH` -- a correctly
drafted period refused as a contradiction it does not contain.

**Fix.**
- `precedingSpelledWord`'s backward scan now includes the hyphen
  (`/[A-Za-z-]/`), so it reads back the whole compound word.
- `SPELLED_NUMBER_VALUES` is now built from three tiers (ones, teens, tens)
  plus every hyphenated tens-ones compound (`twenty-one`...`ninety-nine`),
  generated programmatically rather than hand-typed, so there's no way for
  the ones/tens tables and the compound table to drift out of sync.
- `NON_LITERAL_DAY_PATTERN` (spelled-only, no adjacent digit -> abstain
  `NON_LITERAL_NUMERAL` rather than `NO_DAY_COUNT`) is now generated from the
  same table's keys, longest-first, so it also recognises the hyphenated
  compounds -- it was drifting from `SPELLED_NUMBER_VALUES` before this
  change (a separate literal list), which is exactly the kind of
  can-silently-diverge shape this task's own CLAUDE.md warns about.
- Header comment updated in the same change (a new "HYPHENATED COMPOUNDS"
  paragraph) to record what changed and why, including that compounds above
  one hundred are deliberately not modelled.

**Compounds above one hundred.** Searched, not assumed. Decompressed both
admitted source-map payloads under
`evidence/canonical-v2/_admitted-source-map-payloads/*.deflate`
(`zlib.inflateRawSync`, per `lib/canonical-v2/admitted-source-chain-rebuild.js`'s
own decompression contract) -- the full canonical text of both agreements in
the corpus (Modiv's merger agreement, ~6.9M bytes, and the second admitted
document). `grep -i hundred` / a JS regex scan for `/hundred/gi`: **zero
hits in either document.** The corpus this parser has ever been run against
contains no cure-period (or any other) count phrased as a compound above one
hundred, so none was added to the table -- exactly what the plan asks for
when the corpus doesn't contain one, rather than inventing a case to test
against.

**Unit tests.** Added to the existing suite,
`tests/canonical-v2-cure-period-parse.test.js` (this step's test file to
extend, since it already table-drives the corpus quotes from spec section
6):
- `hyphenated hybrid "forty-five (45) days" -> "45", no SPELLED_DIGIT_MISMATCH`
  -- uses the Modiv 7.1(d)(i) quote verbatim.
- `hyphenated hybrid mismatch "forty-five (46) days" ABSTAINs SPELLED_DIGIT_MISMATCH`
  -- proves the check still catches a genuine contradiction on a hyphenated
  compound, not just widened into a no-op.
- `hyphenated compound with no adjacent digit, "twenty-one days", ABSTAINs NON_LITERAL_NUMERAL`
  -- proves the widened `NON_LITERAL_DAY_PATTERN` recognises compounds too.
- `hyphenated hybrid at the other end of the range, "ninety-nine (99) days" -> "99"`
  -- boundary of the generated compound table.

Run: `CI=true node --test tests/canonical-v2-cure-period-parse.test.js`
**EXIT=0**, `# tests 22`, `# pass 22`, `# fail 0` (18 pre-existing + 4 new).

**Replay: before and after.**

Replayed `scripts/canonical-v2-live-extraction-run.mjs --deal modiv --family
TERMINATION --section-refs 7.1,7.2 --replay-from-run
evidence/canonical-v2/modiv-termination-20260806 --agreement-date
2026-05-03` against the recorded model responses, comparing the committed
`evidence/canonical-v2/modiv-termination-20260807-replay/resolution.json`
(current committed code, i.e. "before" this fix) against a fresh replay run
to `/tmp/.../scratchpad/modiv-termination-3b-after/resolution.json` ("after"
this fix, same recorded model calls, same everything else).

| | BEFORE | AFTER |
|---|---|---|
| `resolved` count | 8 | 8 |
| `review_queue` count | 16 | 16 |
| `open_world` count | 13 | 13 |
| `SPELLED_DIGIT_MISMATCH` occurrences anywhere in resolution.json | 1 | 0 |
| 7.1(d)(i) CURE_PERIOD candidate's `reasons` | `["SPELLED_DIGIT_MISMATCH"]` | `["PERIOD_KIND_UNCORROBORATED"]` |

**Honest finding: the 7.1(d)(i) CURE_PERIOD candidate still does not fully
resolve, for a reason outside this step's scope.** The digit-vs-spelled
cross-check now passes -- 45 correctly matches "forty-five", and
`SPELLED_DIGIT_MISMATCH` is gone from the whole run, not just this one
candidate. But the candidate is still queued, now for
`PERIOD_KIND_UNCORROBORATED`: `candidate-resolution.js`'s period_kind
corroboration (`tests/canonical-v2-termination-rights-resolution.test.js`'s
own "audit M-1" cross-label test names this exact behaviour) requires a cure
verb ("cured"/"cure") to govern the count inside the candidate's own quote
text before it will accept a `CURE` label. The model's extracted `raw_value`
for this candidate is `"forty-five (45) days following notice to the
Company from Parent of such breach or failure"` -- it never quoted the
governing "...is not cured or cannot be cured prior to the earlier of (x)
forty-five (45) days..." language that sits earlier in the same clause. That
is a narrow-quote-window gap in what the native producer extracted for this
citation, not a defect in `cure-period-parse.js` and not a defect in
`candidate-resolution.js`'s corroboration logic (which is doing exactly what
`docs/superpowers/specs/2026-08-02-family-termination-rights-design.md`'s
audit M-1 asks it to do: refuse a `CURE` label the quote itself doesn't
support). It was already flagged, independently, in
`docs/codex-program/notes/resolver-reference-fixes.md` (search
"Also newly exposed") as a report for the family owner's triage, not a fix
for that task either. This step does not touch it: it is in
`candidate-resolution.js` / the extraction prompt, both outside the two
files this step owns, and fixing the digit-mismatch bug this step targets
does not require fixing it -- it only stopped masking it.

**Net effect of this step, stated precisely:** the number-parsing defect
named in PLAN.md Step 3B ("forty-five (45) days" fails a cross-check
comparing the spelled number against the digits) is fixed and proven, both
as a pure-function unit test and as a real corpus replay where the
`SPELLED_DIGIT_MISMATCH` reason disappears. The 7.1(d)(i) candidate does not
reach a canonical value in this replay because of a second, independent,
pre-existing and already-documented gap in what the native producer quoted
for that citation -- not because this step's fix is incomplete.

---

## Step 3E. Close the same negation gap in the third bridge

**Outcome: investigated, not fixed. Stopping per this step's own acceptance
criteria** ("If the false-positive shape written up in the note still
blocks a clean fix, say so and stop on 3E. Shipping it half-right is what
was already rejected once.") No change was made to
`lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`'s grounding/negation
logic. A comment was added at the exact spot the rejected fix would have
gone, recording this task's own re-check for the next reader; a new test
file records the measurements. Both are additive/documentation-only; no
production behaviour changed.

**Read first, in full:** `docs/codex-program/notes/negation-reversal.md`
(484 lines). Section 6 records the rejected attempt: exempting `_ref`-
suffixed attributes closed the first real failure
(`disclaimed_representation_party_ref`) but not the second
(`non_reliance.agreement_scope_quote`, "except those expressly set forth in
this Agreement" -- a carve-out sitting after an unrelated "is not relying"
negation in the same clause, independently true regardless of that
negation). Section 6 sketches, but explicitly does NOT validate, a
refinement: exempt any `_quote` attribute whose own value begins with an
"except"/"excluding"/"other than"/"but for"/"save for" lead-in.

**What this task did: re-ran that unvalidated proposal against the family's
real fixture, in running code, rather than trusting the note's prose.**
`lib/negation-boundary-guard.js` (the shared module, not one of the two
files this task owns, not edited) was imported into a throwaway
investigation and then into a permanent test file,
`tests/canonical-v2-no-other-reps-fraud-negation-investigation.test.js` (6
tests, `CI=true node --test tests/canonical-v2-no-other-reps-fraud-
negation-investigation.test.js` -- **EXIT=0**, `# tests 6`, `# pass 6`,
`# fail 0`). What it found, against
`tests/fixtures/canonical-v2/dark-bridge/no-other-reps-fraud-dark-review.json`,
the only real fixture this family has:

| # | Check | Result |
|---|---|---|
| 1 | The shared guard, unmodified, catches representations-dark-bridge.js's own hostile MAE case ("would not have a Company Material Adverse Effect" -> "have a Company Material Adverse Effect"), reused verbatim | Flags correctly (`true`) -- the detection mechanism itself is sound and portable |
| 2 | The shared guard, unmodified, against this family's own pre-existing `KNOWN LIMITATION` test case (drop the leading "no " from "no Company Party makes...") | Does **not** flag (`false`) -- "no Company"/"no Party" are outside `NEGATION_LEAD_IN_RES`'s deliberately closed "no `<noun>`" list (`event`/`change`/`development`/`effect`/`circumstance`/`fact`/`breach`/`failure`/`action`). Wiring the guard in unmodified would not even close this family's own already-documented gap. |
| 3a | The note's already-found false positive, `non_reliance.agreement_scope_quote` ("except those expressly set forth in this Agreement") | Reproduces (`true`); the note's proposed lead-in exemption *would* close this one (it starts with "except") |
| 3b | **New**, not in the note: `non_reliance.extra_contractual_scope_quote` ("including projections, forecasts or other information made available in the electronic data room"), sitting after the *exact same* "is not relying" negation in the *exact same* sentence | Also flags (`true`) -- and the note's proposed exemption does **not** save it: its own real lead-in is "including", not in the except/excluding/other-than/but-for/save-for list |
| 3c | `non_reliance.disclaimed_representation_party_ref` ("the Company"), a `_ref` field, unexempted | Also flags (`true`) -- confirms the note's validated first step (exempt `_ref` fields by name) is still load-bearing, not optional |
| 4 | With no fix wired in at all, the family's real build path (`bridgeNoOtherRepsFraudCardsToLegacyShape` -> `validateBridgeEnvelope`) on the unmodified fixture | 6 cards, no throw -- genuine cards render exactly as before |

**Why this is decisive, not just a repeat of the note's own caution.** The
note found one real false positive and proposed one refinement, explicitly
flagged as unvalidated. Re-running that refinement against the SAME single
fixture -- the only real corpus text this family has -- finds a SECOND real
false positive the refinement does not cover, on the very first check.
That is not "needs more validation before trusting it"; it is "already
fails the one validation available." A further-widened lead-in list (adding
"including", and whatever the next real deal's drafting turns out to use)
would be exactly the "two rounds of reactive patching" the note already
named as the reason to revert rather than patch again -- this task would be
starting a third round with less real-corpus coverage than the second round
had (one fixture, one deal, same as before).

**What was changed, precisely.**
- `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`: one comment block
  added immediately after the existing `groundedInSource` header (the exact
  spot a fix would have gone), recording this re-check, its two-false-
  positive finding, and a pointer to the investigation test file, so the
  next reader does not have to re-derive any of this or re-attempt the same
  proposal from scratch. No executable line changed.
- New file: `tests/canonical-v2-no-other-reps-fraud-negation-investigation.test.js`
  (permission: "plus any test files you add"). The existing test file,
  `tests/canonical-v2-no-other-reps-fraud-dark-bridge.test.js`, was **not**
  modified -- its own pre-existing `KNOWN LIMITATION` test still documents
  the gap exactly as it did before this task.

**Proof the family's genuine cards still render, via the existing suite
staying green (not by inspection), after the comment-only change:**

```
CI=true node --test tests/canonical-v2-no-other-reps-fraud-dark-bridge.test.js \
  tests/canonical-v2-no-other-reps-fraud-negation-investigation.test.js
```

**EXIT=0**, `# tests 30`, `# pass 30`, `# fail 0` (24 pre-existing + 6 new).
`bash scripts/lint/forbidden-patterns.sh` -- **EXIT=0**, `INVARIANT-4: PASS`.

**Acceptance criteria, addressed directly.**
1. *"The same hostile negation case that representations-dark-bridge.js now
   refuses is refused here too."* Check 1 above proves the underlying
   detection mechanism would refuse it if wired in. It is not wired in,
   for the reason criterion 3 exists: doing so, even with the note's own
   proposed safeguard, breaks real, legitimate output on this family's only
   available real fixture (checks 3a/3b), which is a worse outcome than
   leaving the gap open and honestly documented, exactly as the note
   concluded the first time.
2. *"The family's genuine cards still render, proven by the bridge's
   existing tests staying green."* Proven above, 30/30, both files.
3. *"If the false-positive shape written up in the note still blocks a
   clean fix, say so and stop on 3E."* Invoked, with new evidence (check
   3b) that the blocker is broader than the note recorded, not narrower.

**Net effect of this step:** no functional change to the third bridge; the
asymmetry PLAN.md names (two of four preview bridges protected, one not) is
unchanged in behaviour but is now backed by a second, independent,
measured confirmation -- in permanent, runnable test code, not only prose --
that closing it safely needs either a second real deal's worth of this
family's drafting to validate a refined heuristic against, or the
principled fix the note already specifies (an independently-captured
per-attribute offset from `candidate-resolution.js`), neither of which this
task's scope or file ownership permits.
