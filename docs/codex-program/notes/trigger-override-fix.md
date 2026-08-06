# Trigger-code override fix -- working notes

Target: `lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleFeeTriggerCandidate` (~5719-5812 at task start).

## Status: investigation complete, implementing fix

## Grounding read (before touching code)

- Read the full function (5719-5812) plus its two sibling gates in the same
  function: the `feeSide` corroboration gate (~5743-5769) already cross-checks
  the model's asserted `feeSide` against the corroborated side set
  (`!corroboratedSides.includes(feeSide)` -> `FEE_SIDE_UNCORROBORATED`). The
  trigger gate at ~5783-5812 does NOT do the equivalent check against
  `triggerCode` -- it takes `matchedCodes[0]` unconditionally whenever exactly
  one code matches. This asymmetry, in the SAME function, is the strongest
  evidence the brief's read is correct: one sibling gate already implements
  "bind label to text in both directions", the other doesn't.
- `docs/superpowers/specs/2026-08-02-family-termination-fee-design.md`
  (audit C-3, "Trigger ambiguity rule", lines ~289-315): specifies the
  0-match / >=2-match handling precisely (TRIGGER_UNCORROBORATED /
  AMBIGUOUS_TRIGGER_CORROBORATION) but never explicitly states that the
  single-match resolve path must also equal the model's own `trigger_code`.
  It's a gap in the spec, not a contradiction of the brief -- the spec's own
  "matching only the asserted code's own pattern cannot bind label to text"
  reasoning motivates running the FULL table (so a swapped-but-plausible
  model code can't self-certify), but doesn't address the case actually
  found (model silent, or model disagrees, and the full table still only
  turns up one incidental hit).
- Reason-code registry check (brief's instruction to check before emitting
  free strings): searched for a validated enum of `pushReviewUnresolved`
  `reasons` values. Found `contracts/canonical-v2/successor/agreement/
  migration-inputs/residual-reason-codebook.v1.json` -- NOT the right
  registry, it's a different subsystem (`validate-write-set.js`'s
  `retained_residual.reason`, for successor-agreement residuals, unrelated
  to the review queue). No test enumerates/validates the set of strings
  `pushReviewUnresolved`/`pushOpenWorld` may emit. Confirmed convention:
  reason strings are free-form, each documented by a comment at its emission
  site and in the family's design-spec doc. Proceeding on that convention --
  no registry to register the two new reasons into.

## Independent verification of the coordinator's steering (real recorded bug)

Confirmed independently (not just trusting the relayed claim):

- `evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
  native-producer-recorded-response-7.3.json`, `fee_trigger_assertions[2]`:
  model returned `trigger_code: null` for the quote beginning "(A) (1) by the
  Company or Parent pursuant to Section 7.1(b)(ii)...". Confirmed via
  `node -e` parse of the recorded raw_response_text, not by reading the
  rendered file.
- `evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
  resolution.json`: `resolved[]` contains exactly one
  `TERMINATION_FEE_TRIGGER` claim, `canonical_value:
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'`, `raw_value` byte-identical to
  the null-trigger_code quote above, `attributes.trigger_code:
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'`.
- Ran `feeTriggerCorroboratedCodes` and each `FEE_TRIGGER_CORROBORATION_TABLE`
  pattern against that exact raw_value directly (via the module's own
  exports): only `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` matches, because
  the quote's subordinate timing clause names the "Company Common
  Stockholders' Meeting" -- the clause's own operative subject is a
  topping-fee/tail condition (an acquisition proposal received/announced,
  then a definitive agreement signed within 12 months), not a stockholder
  vote failure. Single incidental match, model asserted nothing: confirmed
  live instance of Failure Mode 1.
- Cross-checked against `docs/codex-program/P1-PLAN.md` (untracked, another
  session's own analysis doc) -- describes the identical defect, same quote,
  same published code, independently. Convergent evidence from an unrelated
  source.
- The adjacent "stranded Superior Proposal" issue the coordinator flagged
  (Modiv 7.1(c)(i), `feeSideFromFullPaymentContext` scans only the
  candidate's own dispatched section) is confirmed real but occurs at the
  `feeSide` gate (~5743-5769), BEFORE the code this task touches --
  `resolution.json` `review_queue[0]`: reasons `['FEE_SIDE_UNCORROBORATED']`
  for that exact candidate. Out of scope per brief and per coordinator;
  not modified.

## Fixture/evidence sweep (acceptance criterion 7)

- `evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
  resolution.json`: 1 of 2 resolved claims in this bundle is the buggy
  trigger resolve above. Will flip to review under the fix. Not referenced
  by any committed test (`grep` for the directory name across tests/lib/
  scripts turned up only the run script itself, an authority-boundary
  inventory line, a forbidden-patterns allowlist entry, and the untracked
  P1-PLAN.md -- none assert this claim's resolved value), so no test
  breaks, but this is a real, named outcome change: **Modiv (Global Net
  Lease), 1 trigger claim, STOCKHOLDER_APPROVAL_FAILURE_TERMINATION ->
  review (TRIGGER_NOT_ASSERTED)**.
- `evidence/canonical-v2/m3-pilot-20260804-fresh/` (the EARLIER,
  pre-scope-correction Modiv 7.3-only run): the work item
  `modiv-termination-fee-7-3` is wired to
  `tests/canonical-v2-m3-live-modiv-reviewer-pass-repair.test.js`, gated on
  env var `CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT`. That test SKIPS in this
  repo/CI (verified: CI workflow does not set the env var; even setting it
  locally, the test still skips because `final-output/independent-first-
  six-review-findings.json` is absent from the committed bundle). The
  script's own header comment states this run "rejected every one of them
  TRIGGER_UNCORROBORATED" (all bare 7.1 cross-refs, zero pattern matches),
  and the pinned assertions in that test (`unresolvedTriggers.length ===
  7`, `.every(reasons.includes('TRIGGER_UNCORROBORATED'))`) independently
  confirm zero resolved triggers in that run. No flip here.
- `tests/fixtures/review-parity/cases/termination-fees/
  dfaa71fa-modiv.resolution.json`: 0 resolved `TERMINATION_FEE_TRIGGER`
  claims (checked directly). No flip.
- `tests/fixtures/canonical-v2/termination-fee/quotes.json`: coverage-map
  fixture already exercised by the existing test file's own trigger tests
  (Bioverativ zero-match, Concho full/narrowed). No other trigger fixtures
  present. No flip.

## Existing-test sweep (acceptance criterion 6)

Ran the brief's suggested grep plus a broader one (also matched every one of
`FEE_TRIGGER_CODES`' seven literal values, to catch anything not using the
substring "trigger_code"). Files that actually reference this resolver's
trigger vocabulary in a resolution context:

- `tests/canonical-v2-termination-fee-resolution.test.js` -- the family's
  own resolver test file. Existing trigger tests: Bioverativ (zero-match,
  `TRIGGER_UNCORROBORATED`), Concho full quote (>=2 match, `AMBIGUOUS_
  TRIGGER_CORROBORATION`) and its narrowed sub-quote (`triggerCode` equals
  the single matched code -> resolves). None of these exercise, let alone
  pin, the override case (null or disagreeing `triggerCode` with exactly one
  match). Nothing here was pinning the defect.
- `tests/canonical-v2-m3-live-modiv-reviewer-pass-repair.test.js` -- asserts
  only the zero-match set (see above). Not pinning the defect either.
- Every other test file matching `trigger_code`/`TRIGGER_*`/the seven code
  literals (no-shop notice tests, query/serving-layer tests, contract-bundle
  enum tests, `TERMR-`/termination-RIGHT relationship tests) belongs to
  unrelated subsystems (a different `trigger_code` vocabulary entirely for
  no-shop notices and for termination-RIGHT query serving, e.g.
  `ACQUISITION_PROPOSAL_TAIL` is not one of this family's seven codes) or
  doesn't import `candidate-resolution.js`/`resolveCandidates` at all.
  Confirmed by checking each file's imports.

**Conclusion: no test currently pins the old override behaviour. Nothing to
correct for "was pinning the defect" -- acceptance criterion 6's investigation
came back clean.**

## Reason codes chosen

- `TRIGGER_NOT_ASSERTED` -- model returned `trigger_code: null`
  (abstained/silent), pattern table found exactly one incidental match.
- `TRIGGER_CORROBORATION_DISAGREES` -- model asserted a registered code A,
  pattern table found exactly one match B, A !== B.

Matches the brief's suggested shape. No existing registry to add them to
(see above). Distinct from each other and from `TRIGGER_UNCORROBORATED`
(zero matches) / `AMBIGUOUS_TRIGGER_CORROBORATION` (>=2 matches) so a
reviewer can tell "model said nothing" from "model said something else"
from "text itself is unclear" at a glance.

## Implementation

`lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleFeeTriggerCandidate`: added two gates immediately after the existing
`matchedCodes.length === 0` / `>= 2` checks, before the resolve path.
`singleMatchedCode = matchedCodes[0]` computed once; if `!triggerCode` ->
`pushReviewUnresolved` typed `TRIGGER_NOT_ASSERTED`; else if `triggerCode
!== singleMatchedCode` -> `pushReviewUnresolved` typed
`TRIGGER_CORROBORATION_DISAGREES`; only when they're equal does
`resolvedTriggerCode = singleMatchedCode` proceed to `finalizeTerminationFeeClaim`
as before. Both new `pushReviewUnresolved` calls use the exact call shape
already used by the sibling `TRIGGER_UNCORROBORATED`/`AMBIGUOUS_TRIGGER_
CORROBORATION` blocks in this same function (`mapping: null, conceptFamily:
conceptKey, materiality: materialityFor({ conceptKey, canonicalValue: null,
claimDefinitionKey: 'TERMINATION_FEE_TRIGGER' }), normalisedPhrase,
attachmentPosition: null`). Updated both comment blocks that described the
old ("typically zero matches") behaviour (~5732-5744 and a new block
directly above the new gates) to state the actual rule. No change to
`feeTriggerCorroboratedCodes`, `FEE_TRIGGER_CORROBORATION_TABLE`, the
`feeSide` gate, `finalizeTerminationFeeClaim`, or any other handler.

## Tests added

`tests/canonical-v2-termination-fee-resolution.test.js`, new section after
the existing `TRIGGER_CODE_OUT_OF_ENUM` test, before the tail-period
section:

1. A unit pin on `feeTriggerCorroboratedCodes` against the verbatim
   recorded Modiv quote (`MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE`, copied via
   `JSON.stringify` round-trip from `resolution.json`, not retyped) --
   confirms the single-incidental-match shape the rest of the block depends
   on, so a future pattern-table edit can't silently invalidate the
   regression tests without failing loudly here first.
2. Acceptance 1 / regression, same real quote: `triggerCode: null` -> 0
   resolved, review typed `['TRIGGER_NOT_ASSERTED']`, concept
   `TERMF-TARGET`, materiality rank 20. This is the exact shape of the live
   bug the coordinator's steering flagged.
3. Acceptance 2, same quote: `triggerCode: 'OUTSIDE_DATE_TERMINATION'`
   (disagrees with the single match) -> 0 resolved, review typed
   `['TRIGGER_CORROBORATION_DISAGREES']`.
4. Acceptance 3 (no-regression), same quote: `triggerCode:
   'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'` (agrees with the single
   match) -> resolves exactly as before, canonical_value and
   `attributes.trigger_code` both `'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'`,
   concept `TERMF-TARGET`.

Same underlying quote text across all three behavioural tests, varying only
`triggerCode`, so the three tests demonstrate the SAME text producing three
different outcomes purely as a function of what the model asserted --
directly exercising the property being fixed. Acceptance criterion 4 (zero
matches / >=2 matches unchanged) is not re-tested with new tests: it's
already pinned by the pre-existing Bioverativ (`TRIGGER_UNCORROBORATED`) and
Concho full-quote (`AMBIGUOUS_TRIGGER_CORROBORATION`) tests in this same
file, which pass unmodified (see results below) -- proof neither branch
regressed.

## Verification results

- `node --test tests/canonical-v2-termination-fee-resolution.test.js`:
  43 tests, 43 pass, 0 fail (was 39 before the 4 new tests were added).
- `node --test tests/canonical-v2-m3-live-modiv-reviewer-pass-repair.test.js
  tests/canonical-v2-candidate-resolution.test.js`: 32 tests, 31 pass, 1
  skip (the live-replay test -- skips both before and after this change, in
  this repo/CI state, for the unrelated reason recorded above), 0 fail.
- Full suite, `CI=true npm test > /tmp/trig.log 2>&1; echo "EXIT=$?"`:
  **EXIT=0**. Summary: 7453 tests, 7411 pass, 0 fail, 42 skipped, 0 todo.
  This run reflects the shared working tree's current combined state --
  `git diff --stat` at the time of this run also showed unstaged changes in
  `lib/canonical-v2/native-producer/anthropic-provider.js` and
  `lib/canonical-v2/native-producer/termination-fee-parse.js` from the
  concurrent session (a per-limb fee-amount feature, unrelated to this
  task, per the coordinator's file allocation -- confirmed via `git diff`
  that neither file was touched by this task's edits). Did not run `npm
  run build`: not requested by this task's verification section, and
  nothing is being committed/pushed from this session.

## Outcome-change report (acceptance criterion 7, final)

Exactly one real recorded claim changes outcome under this fix, across all
evidence/fixture data checked:

- **Deal: Modiv (Global Net Lease) / Section 7.3(b)(iii).** 1 trigger claim:
  `TERMINATION_FEE_TRIGGER` canonical_value
  `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION`, currently `resolved` in
  `evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
  resolution.json`, now routes to `review_queue` typed
  `TRIGGER_NOT_ASSERTED`. This is 1 of that bundle's 2 total resolved
  claims (the other, tail period canonical `12`, is a different handler,
  untouched). Not asserted by any committed test (confirmed by import/
  grep sweep above), so no test needed updating for this -- it's a real
  outcome change on recorded data, reported per the brief's instruction not
  to adjust fixtures to keep counts stable. This evidence file itself was
  left unmodified (it's a point-in-time run record, not a live fixture a
  test recomputes against).
- No other evidence/fixture bundle checked (`m3-pilot-20260804-fresh`,
  `tests/fixtures/review-parity/cases/termination-fees/dfaa71fa-modiv.
  resolution.json`, `tests/fixtures/canonical-v2/termination-fee/
  quotes.json`) contains a resolved trigger claim affected by this change --
  all their trigger candidates were already zero-match (`TRIGGER_
  UNCORROBORATED`) or already had `triggerCode` equal to the single match.

## Status: DONE.
