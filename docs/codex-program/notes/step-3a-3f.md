# Step 3A / 3F working notes

Both steps are vocabulary widenings in
`lib/canonical-v2/native-producer/candidate-resolution.js`, executed in plan
order: 3A first, 3F second.

## Step 3A. Termination trigger-kind vocabulary

**Change.** `TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE`
(`lib/canonical-v2/native-producer/candidate-resolution.js`, ~line 2681).
Widened three of its eight entries against the four gaps recorded verbatim in
`docs/codex-program/notes/resolver-reference-fixes.md`:

- `VOTE_FAILURE`: added `\bRequisite Vote\b` as a second alternative
  alongside the existing `(?:stock|share)holder approval`. Modiv's real
  candidate at 7.1(b)(iii) says "the Company Requisite Vote shall not have
  been obtained..." and never says stockholder/shareholder approval. The
  AND-paired `TERMINATION_VOTE_FAILURE_PHRASE_PATTERN` second condition
  ("not ... been obtained") was untouched and still gates it.
- `RECOMMENDATION_CHANGE`: added two alternatives. `\bCompany Recommendation\b`
  for 7.1(d)(ii)'s "...failed to publicly reaffirm the Company
  Recommendation..." (Modiv's own text omits "Board" the table's existing
  literal "Company Board Recommendation" required), and
  `\bfailed to publicly recommend against\b` for a second, previously
  unmatched 7.1(d)(ii) ground ("...failed to publicly recommend against any
  tender offer...").
- `NO_SOLICITATION_BREACH`: added `\benters?\s+into\s+an?\s+Alternative\s+Acquisition\s+Agreement\b`
  as a second, independent alternative. Modiv's real no-shop ground at
  7.1(d)(ii) is structurally different from a Section-obligation breach --
  "the Company enters into an Alternative Acquisition Agreement" -- and its
  no-shop section is 5.6, not the table's literal 4.4. Left the original
  Section-4.4 breach alternative untouched: it is written for a different
  deal's drafting, and Modiv simply never uses that phrasing at all, so
  generalising the section number would not have closed this gap. (Its
  presence also meant the file header comment claiming
  "NO_SOLICITATION_BREACH deliberately has NO pattern -- always review
  (audit M-3)" was already stale before this change; fixed in the same diff.)

**Two `null`-`trigger_kind` candidates (7.1(c)(iii), 7.1(d)(iii)) were left
untouched, as required** -- they are not a vocabulary gap (the model itself
asserted no trigger_kind), and both are asserted to still queue under
`TRIGGER_KIND_UNCORROBORATED` in the replay test below.

**Before/after, measured by replay of the real committed evidence**
(`evidence/canonical-v2/modiv-termination-20260806/run-receipt.json`, loaded
and run through the real `resolveCandidates`, no reconstruction -- real SEC
HTML admission of the pinned Modiv raw HTML, same pattern as
`tests/canonical-v2-modiv-closing-conditions-partial-receipt-replay.test.js`):

| | Before | After |
|---|---|---|
| `resolved` | 8 | **12** |
| `review_queue` | 16 | 16 |
| `open_world` | 13 | 13 |
| `TRIGGER_KIND_UNCORROBORATED` candidates | 7 | 3 |

The 4 newly-resolved: 7.1(b)(iii) `VOTE_FAILURE` -> `TERMR-NOVOTE`; two more
7.1(d)(ii) `RECOMMENDATION_CHANGE` grounds -> `TERMR-RECOMMEND` (joining the
one, "Adverse Recommendation Change", that already resolved); 7.1(d)(ii)
`NO_SOLICITATION_BREACH` -> `TERMR-NOSOL-BREACH`. The 3 still queued under
`TRIGGER_KIND_UNCORROBORATED`: the two `null`-trigger_kind candidates
(7.1(c)(iii), 7.1(d)(iii), correctly untouched) plus 7.1(c)(ii)'s
`forty-five (45) days` `CURE_PERIOD` candidate, which is Step 3B's territory
(`SPELLED_NUMBER_VALUES` in `cure-period-parse.js`), not this step's.

**Hostile tests, one per widened pattern, all built from real Modiv quotes
copied verbatim from `docs/codex-program/notes/resolver-reference-fixes.md`
and cross-checked against the run receipt's own `raw_value` fields:**
`tests/canonical-v2-termination-trigger-kind-vocabulary.test.js`.

- `VOTE_FAILURE: real Modiv "Company Requisite Vote" quote now corroborates`
  + `hostile: the VOTE_FAILURE quote under a wrong trigger_kind still fails
    to corroborate`
- `RECOMMENDATION_CHANGE: real Modiv quote omitting "Board" ... now
  corroborates` + its hostile pair
- `RECOMMENDATION_CHANGE: real Modiv "failed to publicly recommend against
  any tender offer" quote now corroborates` + its hostile pair
- `NO_SOLICITATION_BREACH: real Modiv "enters into an Alternative Acquisition
  Agreement" quote now corroborates` + its hostile pair
- `the original Section-4.4 NO_SOLICITATION_BREACH alternative is untouched
  by the new one` -- proves the widening is additive, not a replacement
- `replay: the committed Modiv termination run-receipt now resolves 12
  termination-right candidates, up from 8` -- the end-to-end acceptance
  check, asserting the exact citations/concepts that newly resolve and that
  the two null-trigger_kind candidates still queue

All hostile checks assign the real, unmodified quote a **different**
`trigger_kind` than the one it actually carries and assert
`terminationTriggerKindCorroborated` still returns `false` -- proving each
widening is scoped to its own `trigger_kind` key in the table, not a
blanket "matches something" bypass.

**Pre-existing tests updated because their assertions hard-coded the
pre-3A baseline** (both in
`tests/canonical-v2-termination-limb-grant-context.test.js`, which replays
the same evidence for an earlier, unrelated fix and therefore now observes
the post-3A resolver):

- `resolution.resolved.length` assertion: `8` -> `12`, with a comment
  distinguishing "resolved by fix 2" from "resolved by Step 3A".
- The `7.1(d)(ii)` per-citation check: was `length >= 1` (only the Adverse
  Recommendation Change ground resolved); now asserts `length === 4` (all
  four (d)(ii) grounds resolve) and checks every entry's party capacity.
- The "remaining candidates queue" test: was `stillQueued.length >= 5`
  covering 6 real grounds plus slack; now asserts exactly `2`
  (`7.1(c)(iii)`, `7.1(d)(iii)`) with `reasons` exactly
  `['TRIGGER_KIND_UNCORROBORATED']`.
- `tests/canonical-v2-termination-rights-resolution.test.js`'s
  `NO_SOLICITATION_BREACH has NO pattern` test title was renamed (the
  literal claim in the title is now false) and points at the new test file;
  its assertion itself needed no change -- the generic string it tests still
  matches neither alternative.

**Header comment updated in the same change:** the block above
`TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE` no longer claims
`NO_SOLICITATION_BREACH` has no pattern, and documents both new
alternatives, their source citations, and which test file proves them.

**Exit codes:**

```
CI=true node --test tests/canonical-v2-termination-trigger-kind-vocabulary.test.js  -> pass 10, fail 0, EXIT=0
CI=true node --test tests/canonical-v2-termination-rights-resolution.test.js        -> pass 29, fail 0, EXIT=0
CI=true node --test tests/canonical-v2-termination-limb-grant-context.test.js       -> pass 10, fail 0, EXIT=0
CI=true node --test tests/canonical-v2-termination-real-fixture-replay.test.js \
  tests/canonical-v2-modiv-replay.test.js \
  tests/canonical-v2-termination-fee-resolution.test.js \
  tests/canonical-v2-termination-limb-grant-context.test.js \
  tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js \
  tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js \
  tests/canonical-v2-termination-rights-resolution.test.js \
  tests/canonical-v2-termination-trigger-kind-vocabulary.test.js \
  tests/canonical-v2-termination-rights-lexicon.test.js \
  tests/termination-willful-breach-and-fee-required.test.js  -> pass 183, fail 0, EXIT=0
CI=true node --test tests/canonical-v2-termination-product-parity.test.js \
  tests/canonical-v2-cure-period-parse.test.js \
  tests/canonical-v2-termination-deadline-parse.test.js  -> pass 43, fail 0, EXIT=0
```

**Files touched.**

- `lib/canonical-v2/native-producer/candidate-resolution.js` --
  `TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE` and its header comment.
- `tests/canonical-v2-termination-trigger-kind-vocabulary.test.js` -- new,
  the acceptance test for this step.
- `tests/canonical-v2-termination-limb-grant-context.test.js` -- three
  assertions updated to the post-3A baseline, with comments explaining why.
- `tests/canonical-v2-termination-rights-resolution.test.js` -- one test
  title corrected.

**Where the plan's own text was wrong.** Nowhere of substance. The plan's
"4 gaps -> resolved rises from 8 to at least 12" arithmetic landed exactly
right (4 widened patterns, 4 additional resolves, 8 -> 12), which is worth
recording precisely because several other steps in this plan have not held
up under replay.

---

## Step 3F. Joint obligations and party capacity

**Change.** `PARTY_CAPACITY_LEXICON`'s consulting functions in
`lib/canonical-v2/native-producer/candidate-resolution.js` (`resolvePartyCapacity`,
`resolveParty`, both just above "Party resolution" ~line 1394 at the time of
this change -- confirmed by reading the code, not trusted from the plan's own
"line 1032", which is stale). `PARTY_CAPACITY_LEXICON` itself is unmodified --
no entries added, removed or reordered, because the two traps below are about
its EXISTING order, not its content.

**What was wrong.** `resolvePartyCapacity` scanned a raw party string ONCE,
against the WHOLE string, and returned the FIRST lexicon entry (in array
order) whose pattern matched anywhere in it. Correct for "the Company" or
"Parent". Silently wrong for a joint obligor string naming parties from BOTH
sides of the deal: the resolved capacity picked whichever side's word
happened to appear first in the array's scan order, discarded that the
obligation genuinely binds the other side too, and the result read as an
ordinary, correct single-party resolution -- exactly the "mis-attribution
reads as correct" failure mode the plan names.

**Two real corpus strings, grounded by reading them out of the committed
evidence, not invented:**

- `evidence/canonical-v2/modiv-antitrust-20260806/run-receipt.json`
  (byte-identical in the `-20260807-replay` sibling), an
  `INFORMATION_SHARING_OBLIGATION` candidate's `obligor_party`: **"Parent,
  Company Merger Sub, Parent OpCo, the Company and the Partnership each"** --
  five parties, three buyer-side (Parent, Company Merger Sub, Parent OpCo)
  and two target-side (the Company, the Partnership). Before this fix,
  `resolvePartyCapacity` on this string returned `TARGET` (the `company`
  pattern matches inside "Company Merger Sub" -- itself the second recorded
  trap, below -- before any other pattern is even tried), discarding that
  Parent, Parent OpCo and the Partnership are obligors too.
- `evidence/canonical-v2/modiv-general-covenants-20260807-replay/run-receipt.json`,
  a `COV-PUBLICITY` candidate's `covenant_obligor`: **"The Company and
  Parent, and their respective Subsidiaries"** -- a second, independent
  real example, simpler in shape (two named parties, one from each side),
  used so the fix is not proven against only one string.

**The fix.** `resolvePartyCapacity` now segments a multi-segment raw string
on its own list conjunctions (comma, "and", "or", "&" -- never inside a
party's own name, since none of "Company", "Parent", "Merger Sub", "the
Partnership" contain any of those). If the segments' resolved capacities span
more than one **side** of the deal, it returns a new governed marker,
`JOINT_MULTI_PARTY_CAPACITY` ("JOINT_MULTI_PARTY"), instead of the first
segment's capacity. A new table, `PARTY_CAPACITY_SIDE_OF`, groups the four
existing capacity labels by side: `TARGET`/`SELLER` are sell-side,
`BUYER`/`BUYER_AFFILIATE` are buy-side. A single-segment string (no
conjunction present at all) never enters the new branch and is completely
unchanged from before this fix.

**Why side-keying, not capacity-keying -- found by running the real test
suite, not reasoned in the abstract.** A first draft keyed joint-detection on
"more than one distinct CAPACITY among the segments". That draft would have
also flagged a financing-covenant obligor, real corpus text already covered
by a committed test
(`tests/canonical-v2-financing-guaranty-resolution.test.js`,
`FINANCING_QUOTE`'s `obligor: 'Each of Parent and Merger Sub'`), as joint,
because `BUYER` and `BUYER_AFFILIATE` are different capacity labels even
though both are buy-side. Grouping by side first is what keeps that string
resolving the single ordinary capacity `BUYER` that test already depends on,
while still catching the genuinely cross-side five-party string. Verified
directly (`resolvePartyCapacity('Each of Parent and Merger Sub') === 'BUYER'`,
never `JOINT_MULTI_PARTY_CAPACITY`) and by the untouched financing/guaranty
test file passing.

**A design mistake caught by running the broad test sweep, not by
inspection, and reverted.** The first working version additionally attached
the joint member capacities onto the party object `resolveParty` mints, as a
fourth key (`joint_capacities`), reasoned to be "strictly additive" and
therefore safe. It was not: `lib/canonical-v2/source-structure.js`'s
`assertParty` requires a party to be **exactly** `{ role, value, capacity }`
and throws on any other shape, additive or not, before a provision instance
is ever minted (`buildProvisionInstance` -> `mintProvision`). This surfaced
as two failures in the pre-existing, unrelated
`tests/canonical-v2-step-3g-resolver-defects.test.js` ("party must contain
exactly role, value and capacity") the moment a real joint-shaped
`covenant_obligor` in that file's own general-covenants replay fixture
actually reached `mintProvision` under the new code path -- not from
anything in this step's own new test file, which never exercises
`mintProvision` at all. Fixed by dropping `joint_capacities` from the minted
object entirely; the member capacities remain recoverable from `party.value`
(the untouched original raw string) via the exported
`resolveJointPartyCapacities`, for any caller that wants them. This is the
reason to run the broad `candidate-resolution.js`-touching sweep before
declaring a change safe, not just the new test file for the change itself.

**Two traps recorded in commit `34059a2f`, both proven still true after the
fix, not merely asserted:**

1. **Ordering.** The list is scanned in order and first match wins; Modiv's
   Parent OpCo is also a partnership, so `the Partnership` sits deliberately
   after the buyer patterns. `resolvePartyCapacity('Parent OpCo') === 'BUYER'`,
   both before and after this fix -- a single-segment string never enters the
   new joint-detection branch, so nothing about this trap's mechanism
   changed.
2. **Merger-sub-named-after-target.** A merger sub named after the target
   ("Company Merger Sub") matches the target `company` pattern first --
   wrong in principle, and explicitly not fixed by this step (the plan says
   "not currently reached by any single-party candidate"). Proven unchanged:
   `resolvePartyCapacity('Company Merger Sub') === 'TARGET'`, identical
   before and after. It does still contribute (correctly, as it happens)
   to the five-party string's joint detection, because that string is
   already joint on the strength of Parent/Parent OpCo (buyer) vs. the
   Company/the Partnership (target) alone -- the mislabeled merger-sub
   segment does not change the outcome either way.

**Hostile tests**, all in `tests/canonical-v2-party-capacity-lexicon.test.js`:

- grounding tests reading both real corpus strings out of the committed
  evidence files, so the strings used below cannot silently drift from what
  is actually filed
- `the five-party joint obligor resolves to JOINT_MULTI_PARTY_CAPACITY, not
  the first-matched single capacity` -- and explicitly asserts it is never
  `TARGET`, the old wrong answer
- `resolveJointPartyCapacities lists both sides genuinely present ...`
- `resolveParty mints a JOINT_MULTI_PARTY_CAPACITY party ..., shaped exactly
  { role, value, capacity }` -- guards the source-structure.js shape
  constraint directly, not just by the broader suite passing
- `the general-covenants joint obligor also resolves to
  JOINT_MULTI_PARTY_CAPACITY (second real corpus example)`
- `ordering (commit 34059a2f, trap 1): "Parent OpCo" alone still resolves
  BUYER ...` -- **the existing ordering test** the acceptance criteria
  names; it did not already exist under this name anywhere in the repo
  (searched `tests/*.test.js` for `PARTY_CAPACITY_LEXICON`,
  `resolvePartyCapacity`, and `"Parent OpCo"` -- none referenced it), so it
  is written fresh here rather than merely kept passing
- `side-keying (not capacity-keying) is what keeps the real
  financing-covenant obligor un-joint: "Each of Parent and Merger Sub" ...`
  -- an explicit regression guard for the side-vs-capacity design mistake
  found above
- `a multi-name, single-side list (...) still resolves the single capacity
  TARGET` -- proves multiple mentions of the SAME side is not itself
  "joint"
- `trap 2 (..., unfixed by this step, proven unchanged): a bare "Company
  Merger Sub" ...`
- two hostile tests that a string with no recognised party words, or with
  only one side actually recognised, never produces a spurious joint result
- a sanity check on `PARTY_CAPACITY_LEXICON`'s own capacity-label set, so a
  future edit to the lexicon that would invalidate this file's assumptions
  fails loudly here rather than silently

**Exit codes:**

```
CI=true node --test tests/canonical-v2-party-capacity-lexicon.test.js  -> pass 15, fail 0, EXIT=0
CI=true node --test tests/canonical-v2-financing-guaranty-resolution.test.js \
  tests/canonical-v2-antitrust-expanded-package.test.js \
  tests/canonical-v2-antitrust-regulatory-efforts.test.js \
  tests/canonical-v2-modiv-antitrust-closing-gap-replay.test.js \
  tests/canonical-v2-native-provider-family-dispatch.test.js \
  tests/canonical-v2-no-shop-wave-b.test.js \
  tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js \
  tests/canonical-v2-m3-live-checkpoint-replay.test.js \
  tests/canonical-v2-antitrust-closing-family-completion.test.js \
  tests/canonical-v2-closing-conditions-wave-b-resolution.test.js  -> pass 55, fail 0, EXIT=0
CI=true node --test tests/canonical-v2-step-3g-resolver-defects.test.js  -> pass 9, fail 0, EXIT=0
CI=true node --test $(grep -rl "candidate-resolution" tests/*.test.js) \
  tests/canonical-v2-party-capacity-lexicon.test.js \
  tests/canonical-v2-termination-trigger-kind-vocabulary.test.js  -> pass 781, fail 0, EXIT=0 (74 pre-existing files + the 2 new ones from this session)
bash scripts/lint/forbidden-patterns.sh  -> INVARIANT-4: PASS, EXIT=0
```

**Files touched.**

- `lib/canonical-v2/native-producer/candidate-resolution.js` -- new
  `PARTY_CAPACITY_SIDE_OF`, `sideForCapacity`, `JOINT_MULTI_PARTY_CAPACITY`,
  `segmentPartyListString`, `resolveJointPartyCapacities`; `resolvePartyCapacity`
  widened with the joint-detection branch; `resolveParty` unchanged in
  return shape (deliberately, see above) but now routes through the widened
  `resolvePartyCapacity`. `resolveParty`, `PARTY_CAPACITY_SIDE_OF`,
  `JOINT_MULTI_PARTY_CAPACITY`, `resolveJointPartyCapacities` newly exported
  for tests.
- `tests/canonical-v2-party-capacity-lexicon.test.js` -- new, the acceptance
  test for this step.

**Where the plan's own text needed correcting.** The line number
(`candidate-resolution.js` line 1032) was stale, as the task's own ground
rules warned it would be -- the lexicon is at line 1045 at the time of this
change, its consulting functions further down still. More substantively:
**this step's own risk was not the two traps it named** (both were easy to
keep intact, and both are now covered by a direct test), **it was a third
interaction the plan's text does not mention at all** -- a downstream strict
party-shape validator in a different file (`source-structure.js`) that any
change to what `resolveParty` returns has to satisfy. Nothing in the plan or
in commit `34059a2f`'s own notes flagged this; it was found only by running
the broad sweep of every test file that touches `candidate-resolution.js`
before declaring the change done, which is the reason that sweep, not just
the new test file, is part of this step's own proof.
