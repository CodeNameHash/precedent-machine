# Step 3A1 / 3F1 working notes

Executed in plan order: 3A1 first (the live wrong-answer path), 3F1 second
(latent). Both close defects adversarial review found in commit `ec801d1e`
(Step 3A and Step 3F).

## Step 3A1. Close the fiduciary-out false positive Step 3A opened

**Change.** `lib/canonical-v2/native-producer/candidate-resolution.js`,
`terminationTriggerKindCorroborated` and the block around
`TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE`. Two new AND-gated exclusions,
same shape as the pre-existing `VOTE_FAILURE` AND gate (a pattern match is
necessary but not sufficient):

- `TERMINATION_NO_SOLICITATION_BREACH_EXCLUSION_PATTERN` (`/\bSuperior
  Proposal\b/i`): a quote that matches the "enters into ... Alternative
  Acquisition Agreement" alternative AND also carries "Superior Proposal"
  no longer corroborates `NO_SOLICITATION_BREACH`. Chosen over the plan's
  second-preference option (anchoring on the no-shop ground's own "other
  than an Acceptable Confidentiality Agreement" parenthetical) because it is
  the plan's first preference and is semantically sound, not just
  corpus-convenient: the no-solicitation BREACH ground fires because the
  Company entered an Alternative Acquisition Agreement in violation of the
  standstill, full stop -- it is never itself conditioned on a Superior
  Proposal determination (Modiv's own ground never says those words). The
  Company's fiduciary-out ground is always conditioned on one. The two
  vocabularies are not coincidentally disjoint in the corpus; they are
  disjoint by what the ground legally requires.
- `TERMINATION_RECOMMENDATION_REAFFIRM_WITHOUT_FAILURE_PATTERN` /
  `TERMINATION_RECOMMENDATION_FAILED_TO_REAFFIRM_PATTERN`: a quote
  mentioning "reaffirm" only corroborates `RECOMMENDATION_CHANGE` when
  "failed" appears within 80 characters before it. A bare reaffirmation is
  the Board affirmatively standing behind its recommendation -- the opposite
  of a change.

Header comment above the table rewritten in the same change to document both
exclusions, why each is needed, and which test file proves them.

### Probe results, before and after

Real corpus quotes only (see "kind-fixed, quote-varied" tests below for
sourcing):

| Probe | Kind | Before | After |
|---|---|---|---|
| Skechers 5.3(d) fiduciary-out ("...authorize the Company to terminate this Agreement to enter into an Alternative Acquisition Agreement with respect to such Acquisition Proposal", following a Superior Proposal determination) | `NO_SOLICITATION_BREACH` | `true` | `false` |
| Plan's illustrative fiduciary-out probe ("the Company may terminate this Agreement in order to enter into an Alternative Acquisition Agreement with respect to a Superior Proposal") | `NO_SOLICITATION_BREACH` | `true` | `false` |
| Plan's illustrative reaffirmation probe ("the Company Board shall have publicly reaffirmed the Company Recommendation following an Intervening Event") | `RECOMMENDATION_CHANGE` | `true` | `false` |
| Real Modiv no-shop-breach ground ("the Company enters into an Alternative Acquisition Agreement (other than an Acceptable Confidentiality Agreement entered into in compliance with Section 5.6)") | `NO_SOLICITATION_BREACH` | `true` | `true` (unaffected) |
| Real Modiv "failed to publicly reaffirm" ground | `RECOMMENDATION_CHANGE` | `true` | `true` (unaffected) |
| Original Section-4.4 literal | `NO_SOLICITATION_BREACH` | `true` | `true` (unaffected) |

No committed corpus fixture pairs a bare (non-"failed to") Board
reaffirmation with "Company Recommendation" -- both real instances in the
fixture corpus (Modiv 7.1(d)(ii), Skechers 5.3(c)) only ever say "failed to
publicly reaffirm". The reaffirmation hostile probe therefore uses the
plan's own illustrative quote, not corpus text; this is stated explicitly in
the test file rather than left implicit. The fiduciary-out hostile probe
does have real corpus text -- Skechers Inc.'s merger agreement (Skechers/3G
Capital), `tests/fixtures/canonical-v2/skechers-first-live-run/
skechers-raw-fetched.htm`, section 5.3(d) -- and both the real-corpus and the
plan's illustrative version of that probe are tested.

### Replay

`evidence/canonical-v2/modiv-termination-20260806/run-receipt.json` replayed
through the real `resolveCandidates` (real SEC HTML admission, no
reconstruction): `resolved` stays at **12**, exactly as required. Confirmed
both by the pre-existing end-to-end test and directly:

```
counts { compiled_candidates: 29, resolved: 12, auto_pass: 0, review_queue: 16, open_world: 13, residuals: 0, provisions: 9, ... }
```

### Kind-fixed, quote-varied hostile tests

Added to `tests/canonical-v2-termination-trigger-kind-vocabulary.test.js`
(the file's header comment was rewritten to explain why part 1's eight
existing hostile checks are quote-fixed/kind-varied and pass by
construction, and why the new ones are kind-fixed/quote-varied instead):

- `HOSTILE (kind-fixed, quote-varied): the Company's own fiduciary-out
  ground (real Skechers text) does NOT corroborate NO_SOLICITATION_BREACH,
  even though it carries "enters into an Alternative Acquisition Agreement"`
- `the real Modiv NO_SOLICITATION_BREACH ground still corroborates after the
  fiduciary-out exclusion` (paired discriminator)
- `HOSTILE (kind-fixed, quote-varied): a Board reaffirming (not "failed to
  reaffirm") the Company Recommendation does NOT corroborate
  RECOMMENDATION_CHANGE`
- `the real Modiv "failed to publicly reaffirm" RECOMMENDATION_CHANGE ground
  still corroborates after the reaffirm exclusion` (paired discriminator)

**Exit codes.**

```
CI=true node --test tests/canonical-v2-termination-trigger-kind-vocabulary.test.js
  -> 14 pass, 0 fail, EXIT=0 (replay subtest asserts resolved === 12)

CI=true node --test tests/canonical-v2-termination-rights-resolution.test.js \
  tests/canonical-v2-termination-limb-grant-context.test.js \
  tests/canonical-v2-m3-live-checkpoint-replay.test.js
  -> 42 pass, 0 fail, EXIT=0
```

### The note misattribution (also fixed)

`docs/codex-program/notes/step-3a-3f.md` claimed 7.1(c)(ii)'s `CURE_PERIOD`
candidate was "Step 3B's territory (`SPELLED_NUMBER_VALUES` in
`cure-period-parse.js`)". Verified wrong by direct replay and reading
`resolution.review_queue`:

```
7.1(d)(i) [ 'PERIOD_KIND_UNCORROBORATED' ] TERMR-BREACH
7.1(c)(ii) [ 'TRIGGER_KIND_UNCORROBORATED' ] TERMR-PENDING
```

7.1(c)(ii)'s `CURE_PERIOD` candidate queues under `TRIGGER_KIND_UNCORROBORATED`
-- its own quote ("...of such breach or failure") matches none of the
`BREACH` alternatives, so `terminationTriggerKindCorroborated` refuses it
before `parseCurePeriod` is ever reached. Its sibling, 7.1(d)(i)'s
`CURE_PERIOD` candidate, genuinely does clear the trigger-kind gate (its
`sourceCitationContext().child_clause_quote` includes the parent clause's
"shall have breached") and queues under `PERIOD_KIND_UNCORROBORATED` --
that one is Step 3B's territory. The two candidates are structurally
near-identical mirror images (Company-breach vs. Parent-breach) and reach
different gates; the note conflated them. Corrected in place in
`docs/codex-program/notes/step-3a-3f.md` per `OPERATING-RULES.md`'s "keep
the reasoning, correct the specifics" -- the original line is kept and
marked, not silently deleted.

**Not fixed, and correctly out of scope:** 7.1(c)(ii)'s `CURE_PERIOD`
candidate itself still queues. The plan's "also fix" instruction was to
correct the misattribution, not to widen the `BREACH` trigger-kind pattern
or change `sourceCitationContext`'s citation-to-clause matching so this
candidate resolves -- that would be new scope, not named in Step 3A1's
acceptance criteria, and risks the same kind of undocumented widening that
caused the original defect.

### What in the step's own text I found to be wrong

- The plan's illustrative fiduciary-out probe ("...in order to enter into an
  Alternative Acquisition Agreement with respect to a Superior Proposal") is
  not itself corpus text (confirmed by searching `evidence/` and
  `tests/fixtures/`), but the defect it illustrates is real and reachable --
  Skechers' real 5.3(d) text triggers the same false positive, confirming
  the probe was a fair characterisation rather than a hypothetical.

## Step 3F1. Stop the joint-capacity fix manufacturing phantom joints, and give the marker a downstream contract

### Defect 1: phantom joints

**Change.** `lib/canonical-v2/native-producer/candidate-resolution.js`:

- New `PARTY_CAPACITY_SEGMENT_LEXICON`: `PARTY_CAPACITY_LEXICON` with only
  `merger\s*sub` moved to the front; every other pattern keeps its original
  relative order (so `the Partnership` still sits after every buyer
  pattern). Used ONLY by the two per-segment loops
  (`resolveJointPartyCapacities`, `resolvePartyCapacity`'s joint-detection
  branch) -- never for the single-segment whole-string fallback, which is
  what keeps both commit-34059a2f traps' single-party behaviour unchanged.
  `PARTY_CAPACITY_LEXICON` itself is untouched, per the plan's explicit
  instruction not to reorder it globally.
- `resolvePartyCapacity`: when segments span exactly ONE side (not joint),
  it now returns that side's own first-seen capacity directly instead of
  falling through to a fresh whole-string scan on the RAW full string. That
  fallback was itself reachable by the same trap: a purely buyer-side list
  containing "Company Merger Sub" still contains the literal substring
  "Company", so the old whole-string scan (global order) would have matched
  `\bcompany\b` and returned `TARGET` even after the joint-check itself
  correctly decided the list was single-sided.

### Probe results, before and after

| Probe | Before | After |
|---|---|---|
| `'Parent and Company Merger Sub'` | `JOINT_MULTI_PARTY` (members `[BUYER, TARGET]`) | `'BUYER'`, never joint |
| `'Parent, Company Merger Sub, Parent OpCo or OpCo Merger Sub'` (Modiv's real buyer group, verbatim from 7.1(c)(ii)/(c)(iii)) | `JOINT_MULTI_PARTY` (members `[BUYER, TARGET, BUYER_AFFILIATE]`) | `'BUYER'`, never joint |

Grounded: the second probe is read directly out of
`evidence/canonical-v2/modiv-termination-20260806/run-receipt.json` in the
test file's own grounding test, not retyped. (The plan's own probe text used
"and"; the real filed text says "or" -- both conjunctions split identically
in `segmentPartyListString`, so this is wording only, not behavioural. Noted
and corrected in the test rather than silently changed.)

### Both 34059a2f traps, reconfirmed after the fix

```
resolvePartyCapacity('Parent OpCo') === 'BUYER'                        -> true (trap 1 intact)
resolvePartyCapacity('Each of Parent and Merger Sub') === 'BUYER'      -> true, never JOINT_MULTI_PARTY_CAPACITY
resolvePartyCapacity('Company Merger Sub') === 'TARGET'                -> true (trap 2 intact, single-segment path unchanged)
```

### A byproduct correctness improvement, not required by acceptance but worth recording

The real five-party joint-obligor string's own `resolveJointPartyCapacities`
member breakdown used to read `['BUYER', 'TARGET']` -- its own "Company
Merger Sub" segment was itself misclassified `TARGET` by the same trap,
silently absent from the buyer-side members even though the aggregate JOINT
determination was already correct (tipped by "the Company"/"the Partnership"
alone). It now correctly reads `['BUYER', 'BUYER_AFFILIATE', 'TARGET']`. The
pre-existing test asserting the old two-element list was updated with an
explanatory comment, not silently changed.

### Defect 2: the marker's downstream contract

**Change, per projection, each with a test:**

- `lib/canonical-v2/termination-product-projection.js` (`partyCode`,
  `rightCode`): both already fell through to `return null` for an
  unrecognised capacity; the fallthrough is now an explicit, commented
  refusal rather than an accident of "no branch matched". No existing enum
  value fits -- `PARTY_MUTUAL` asserts "either party may act", a different
  legal claim from "several buyer-side entities jointly hold this", and
  `lib/taxonomy.js`'s `TERMINATION_PARTY` enum has no fourth value; adding
  one is a taxonomy change this projection does not own.
- `lib/canonical-v2/proxy-meeting-product-projection.js` (`meetingParty`):
  changed from `return entry.party?.capacity || null` (which would render
  any unrecognised capacity, including the raw `'JOINT_MULTI_PARTY'`
  marker, as if it were a party label) to an explicit `return null` for
  everything outside `TARGET`/`BUYER`. This field is COMPANY/PARENT-shaped
  and rendered directly to a user (`adjournmentRights[].party`).
- `lib/canonical-v2/ioc-wave-a-product-projection.js`: **no code change**.
  `validateEntry` already throws a typed `IocWaveAProjectionError` /
  `INVALID_INHERITED_PARTY` for any capacity outside `TARGET`/`BUYER`,
  written before `JOINT_MULTI_PARTY_CAPACITY` existed but correct for it
  anyway -- this is the "refuses it explicitly" side of the acceptance
  criteria, not a defect. The comment was strengthened to say so, and the
  missing test (nothing had ever exercised this path) was added.
- `lib/canonical-v2/general-covenants-product-projection.js`: confirmed by
  `grep` to never read `capacity` at all -- correctly out of scope, per the
  plan's own note that this projection ignores capacity.

**Tests, one per projection:**

- `tests/canonical-v2-termination-product-parity.test.js`: "JOINT_MULTI_PARTY
  capacity: partyWhoCanTerminate is omitted..." and "...a TERMR-BREACH right
  with joint capacity is dropped rather than mislabeled..."
- `tests/canonical-v2-proxy-meeting-product-parity.test.js`: "JOINT_MULTI_PARTY
  capacity: adjournmentRights[].party is null..."
- `tests/canonical-v2-ioc-parent-child-resolution.test.js`: "JOINT_MULTI_PARTY
  capacity: projectIocWaveAClaims throws INVALID_INHERITED_PARTY..."

**The general-covenants replay, pinned end to end** (the plan's "also pin
the behaviour change nobody claimed"):
`tests/canonical-v2-step-3g-resolver-defects.test.js`, "Step 3F1 pin: the
two general-covenants COV-PUBLICITY provisions resolve
JOINT_MULTI_PARTY_CAPACITY, not TARGET, end to end" -- replays the real
committed `modiv-general-covenants-20260807-replay` evidence through the
real `resolveCandidates` and asserts both 5.7 rows carry
`party.capacity === 'JOINT_MULTI_PARTY'`, `party.value === 'The Company and
Parent, and their respective Subsidiaries'`, and explicitly
`notEqual(..., 'TARGET')`.

### Exit codes

```
CI=true node --test tests/canonical-v2-party-capacity-lexicon.test.js
  -> 19 pass, 0 fail, EXIT=0
CI=true node --test tests/canonical-v2-termination-product-parity.test.js
  -> 7 pass, 0 fail, EXIT=0
CI=true node --test tests/canonical-v2-proxy-meeting-product-parity.test.js
  -> 3 pass, 0 fail, EXIT=0
CI=true node --test tests/canonical-v2-ioc-parent-child-resolution.test.js
  -> 3 pass, 0 fail, EXIT=0
CI=true node --test tests/canonical-v2-step-3g-resolver-defects.test.js
  -> 10 pass, 0 fail, EXIT=0
CI=true node --test $(grep -rl "candidate-resolution" tests/*.js) \
  tests/canonical-v2-party-capacity-lexicon.test.js \
  tests/canonical-v2-termination-trigger-kind-vocabulary.test.js \
  tests/canonical-v2-termination-product-parity.test.js \
  tests/canonical-v2-proxy-meeting-product-parity.test.js \
  tests/canonical-v2-ioc-parent-child-resolution.test.js
  -> 823 tests, 809 pass, 0 fail, 14 skipped, EXIT=0
bash scripts/lint/forbidden-patterns.sh -> INVARIANT-4: PASS, EXIT=0
```

### What in the step's own text I found to be wrong or worth flagging

- The plan's probe 2 wording ("...Parent OpCo **and** OpCo Merger Sub")
  differs from the real filed text ("...Parent OpCo **or** OpCo Merger
  Sub", 7.1(c)(ii)/(c)(iii)). Behaviourally identical (both conjunctions
  split identically), but the test uses the verbatim real string, not the
  plan's paraphrase, per the acceptance criterion's own "Modiv's real buyer
  group, verbatim".
- `ioc-wave-a-product-projection.js` was named alongside the other two
  projections as needing a fix ("hard-fails ... on any capacity outside
  TARGET/BUYER"), but on inspection its hard-fail is already the correct,
  explicit-refusal behaviour the acceptance criteria's second branch asks
  for -- it needed a test, not a code change. Recorded as a finding rather
  than silently doing nothing there.
