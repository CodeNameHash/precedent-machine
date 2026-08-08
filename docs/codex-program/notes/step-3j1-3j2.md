# Step 3J1 and Step 3J2

Working notes, written incrementally per this step's own ground rules. 3J1
saved before 3J2 started.

Owned files: `lib/canonical-v2/contract-bundle.js`,
`lib/canonical-v2/termination-fee-trigger-path.js`,
`lib/canonical-v2/termination-product-projection.js`, and new test files.
Not touched: `lib/canonical-v2/native-producer/candidate-resolution.js`,
`lib/canonical-v2/native-write-set-adapter.js`, the new database reader and
serving modules another two agents own, and `evidence/canonical-v2/**`
(read-only, used as real fixture data).

## Step 3J1. Wire the cross-check, and widen what Step 3J narrowed

### What was wired, and where

`assertPaymentTriggerEventAgreesWithFeeRequired` was defined, exported and
tested in isolation, and called nowhere else -- confirmed again by grep
before starting (`grep -rn assertPaymentTriggerEventAgreesWithFeeRequired
lib/ pages/ scripts/` returned only its own definition and its own test).

**The real call site is now `lib/canonical-v2/termination-product-
projection.js`'s `feeFeatures()`**, invoked from inside
`projectTerminationFeeProductSurfaces()` -- i.e. from the actual product
projection path, not from a test calling the guard function directly. It
fires when, and only when:

1. the entry being projected is a `TERMINATION_FEE_TRIGGER` claim,
2. on the SELLER (Company) side (`concept_key !== 'TERMF-REVERSE'`),
3. whose own trigger code is `SUPERIOR_PROPOSAL_TERMINATION` (the scoping
   fix, see next section), and
4. the caller supplied a `fee_required_cross_check: { payment_trigger_event,
   fee_required }` argument to `projectTerminationFeeProductSurfaces`.

**Why (4) is a parameter rather than something read off `resolution`
itself.** `feeRequired` is a V1-served field with no resolver anywhere
under `lib/canonical-v2/native-producer/` (decision 6's own "Code" note,
re-confirmed by grep: `grep -rn feeRequired lib/canonical-v2/` finds only
this file's own comments and functions). It genuinely does not exist inside
a native `resolution` object today, for any deal, so there is nothing
inside my three owned files to read it from. Making the guard reachable
therefore means giving `projectTerminationFeeProductSurfaces` an explicit
seam for the caller (eventually the reader/serving layer, owned by another
agent, which will have both the deal's real `feeRequired` and can derive
the real `payment_trigger_event`) to supply both real values through. This
is not a synthetic test hook: it is exercised, in the tests below, with a
`payment_trigger_event` derived by the real `classifyPaymentTimingQuote`
classifier from the real committed Modiv payment-timing quote, not a
hand-typed string.

Before this change, the guard was reachable only by importing the two
functions directly and calling them with two loose arguments -- exactly the
"no path scoping" problem condition 4 names. After this change, the
production path itself enforces which row the check applies to; a caller
cannot mis-pair a different fee-trigger row's event against the
fiduciary-out `feeRequired` by construction, because the check only ever
fires for the one row whose own trigger code is
`SUPERIOR_PROPOSAL_TERMINATION`.

### Removal proof (done by hand, not merely reasoned about)

1. Changed the guard's call-site condition in `feeFeatures()` from
   `if (side === 'SELLER' && trigger.code === SUPERIOR_PROPOSAL_TRIGGER_CODE && feeRequiredCrossCheck)`
   to `if (false && ...)`.
2. Ran `CI=true node --test tests/canonical-v2-payment-timing-guard-wiring.test.js`.
   Result: **5 pass, 1 fail, exit 1.** The failing test was exactly "the
   guard FIRES on the real path: a real derived CONCURRENT_WITH_TERMINATION
   against a genuinely disagreeing feeRequired throws from inside the
   projection, not just from calling the guard function directly" --
   `assert.throws` found no throw. Every other test in the file (scoping,
   agreement, inert-when-omitted) stayed green, which is itself useful: it
   confirms those tests are not accidentally exercising the same code path
   as the removed wiring.
3. Reverted the `if (false && ...)` change.
4. Re-ran the same file: **6 pass, 0 fail, exit 0.**

### Scoping (condition 4)

The pairing discipline is now structural, not a comment. `feeFeatures()`
only ever calls the guard for the `TERMINATION_FEE_TRIGGER` row whose own
`trigger.code === SUPERIOR_PROPOSAL_TRIGGER_CODE` (`'SUPERIOR_PROPOSAL_
TERMINATION'`). A second, differently-grounded fee-trigger row on the same
deal -- modelled on Modiv branch (iii), `ACQUISITION_PROPOSAL_TAIL` -- is
never compared against the fiduciary-out ground's `feeRequired`, regardless
of what its own payment-timing text classifies as.

The real committed Modiv replay
(`evidence/canonical-v2/modiv-termination-fee-20260807-replay/
resolution.json`) has only one resolved `TERMINATION_FEE_TRIGGER` row
(`SUPERIOR_PROPOSAL_TERMINATION`, citation `7.1(c)(i)`) -- the tail fee is
resolved through `conditional_termination_fee_values`, not a second trigger
row -- so there is no second real row to read the branch-(iii) case from.
`tests/canonical-v2-payment-timing-guard-wiring.test.js` constructs one,
modelled on the real row's exact shape (same `provision_instance` /
`claim` structure, different citation and `canonical_value`), documented in
the test file as constructed rather than committed-real, and:

- proves the scoped, wired path does not throw when both rows are present
  and the cross-check payload agrees with the superior-proposal ground
  (`ok 5`);
- separately proves, by calling the bare, unscoped guard function directly
  with branch (iii)'s own real, derived `EARLIER_OF_SIGNING_OR_
  CONSUMMATION` event against the deal's truthy `feeRequired`, that this
  IS a false positive if nothing scopes it (`ok 6`) -- i.e. the exact
  failure mode condition 4 describes, reproduced and pinned, then shown not
  to reach the real wired path.

### Prose (condition 5)

`feeRequiredIsTruthy` (any non-empty string counted as required) is
deleted. In its place:

- `feeRequiredStatus(feeRequired)` returns `'REQUIRED'` (boolean `true`),
  `'NOT_REQUIRED'` (boolean `false`, `null`, `undefined`, or an
  empty/whitespace string), or delegates non-empty strings to
  `classifyFeeRequiredProse`.
- `classifyFeeRequiredProse(prose)` returns `'NOT_REQUIRED'` when "not"
  appears within a short span of "condition" or "required" (a window, not
  an exact phrase -- the step's own illustrative example, "not **as** a
  condition", does not contain the literal substring "not a condition", so
  an exact-phrase match would have missed it); `'REQUIRED'` when the prose
  contains condition-precedent / concurrent-payment language (the pattern
  every real prose example quoted anywhere in this programme's record
  actually uses); otherwise `'REVIEW_REQUIRED'`.
- `paymentTriggerEventAgreesWithFeeRequired` now throws
  `FEE_REQUIRED_PROSE_UNCLASSIFIED` for `'REVIEW_REQUIRED'` rather than
  guessing. It is never silently read as agreement OR silently read as
  disagreement -- the same "surface the defect" discipline the whole guard
  already applies to the event/feeRequired pairing.

No real prose `feeRequired` value is committed anywhere in this repository
(re-confirmed: `feeRequired` is V1-database-only, per decision 6 and
Step 3J's own note), so this was not curated from a real corpus. It is
deliberately narrow: the two prose strings this programme's own existing
tests already use (`'prior to or substantially concurrently with such
termination'`, `'payable prior to termination'`) still classify
`REQUIRED`, unchanged; the exact negation phrasing this step's own text
supplies (`"the fee is payable after termination, not as a condition to
terminating"`) now classifies `NOT_REQUIRED`, and, paired with a
`CONCURRENT_WITH_TERMINATION` event, is refused as a disagreement
(`PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT`) rather than read as
agreement -- the exact quadrant condition 5 names as invisible before this
change. `tests/canonical-v2-fee-required-prose-classification.test.js`
pins all of this, including the unrecognised-prose refusal case.

### V3 reachability

Not made reachable. Recorded in `docs/core/GRAVEYARD.md`, new entry 16,
with the three concrete remaining steps (a metric-operation binding
declaring `trigger_path_schema_version: 3`; registration in
`FIXTURE_CONTRACT_FINGERPRINTS` / `FIXTURE_SERVING_CONTRACT_FINGERPRINTS` /
`FIXTURE_CONTRACTS_BY_FINGERPRINT`; a producer emitting a V3-shaped effect)
and which of the three are inside this step's owned files versus outside
it. Steps 1-2 are inside `contract-bundle.js` (owned) but were left undone
because doing them without step 3 (a producer, owned by another agent's
files) reproduces the exact state Step 3J's first attempt already tried
and reverted -- a registered fingerprint nothing produces, which broke an
unowned exhaustive-equality test
(`tests/canonical-v2-contract-bundle-versions.test.js`).

### Test names and exit codes

```
$ CI=true node --test \
    tests/canonical-v2-payment-timing-guard-wiring.test.js \
    tests/canonical-v2-fee-required-prose-classification.test.js \
    tests/canonical-v2-payment-timing-split.test.js
...
# tests 22
# pass 22
# fail 0
$ echo $?
0
```

Broader regression (27 files, includes files this step does not own,
consumers of `EFFECT_KEYS` / `contract-bundle.js` / `termination-product-
projection.js`):

```
$ CI=true node --test <27 files, listed below> 
...
# tests 320
# pass 320
# fail 0
$ echo $?
0
```

Files: `canonical-v2-contract-bundle-v39.test.js`,
`canonical-v2-termination-fee-trigger-path-v3.test.js`,
`canonical-v2-payment-timing-split.test.js`,
`canonical-v2-payment-timing-guard-wiring.test.js` (new),
`canonical-v2-fee-required-prose-classification.test.js` (new),
`canonical-v2-termination-product-parity.test.js`,
`canonical-v2-termination-fee-conditional-amount-projection.test.js`,
`canonical-v2-termination-fee-both-sources.test.js`,
`canonical-v2-run-projects-to-product-cards.test.js`,
`canonical-v2-qxo-termination-fee-admitted-slice.test.js`,
`canonical-v2-qxo-termination-fee-vocabulary.test.js`,
`canonical-v2-reviewed-termination-fee-slice.test.js`,
`canonical-v2-serving-projection.test.js`,
`canonical-v2-sole-remedy-resolution.test.js`,
`canonical-v2-termination-real-fixture-replay.test.js`,
`canonical-v2-modiv-termination-fee-payment-timing-parser.test.js`,
`canonical-v2-modiv-termination-fee-citation-following-replay.test.js`,
`canonical-v2-p1-vertical-slice.test.js`,
`canonical-v2-metric-serving-admission-f22.test.js`,
`canonical-v2-query-result.test.js`, `canonical-v2-contract-bundle-
versions.test.js`, `canonical-v2-contract-bundle-v14.test.js`,
`canonical-v2-contract-bundle-v15.test.js`, `canonical-v2-contract-bundle-
v17.test.js`, `canonical-v2-shared-serving-row.test.js`,
`canonical-v2-qxo-buyer-termination-fee-admitted-slice.test.js`,
`canonical-v2-canonical-contract-technical-relationship-effects.test.js`.

`bash scripts/lint/forbidden-patterns.sh` -> `INVARIANT-4: PASS`, exit 0.

`npm test` (full suite) was not run, per this step's ground rules.

### Where 3J1's own text was wrong or needed correction

None found in the step text itself. One clarification worth recording:
the step's "make V3 reachable" bullet lists three requirements without
saying which are inside this step's owned files -- two of three are
(`contract-bundle.js`), and doing those two alone would not have made
anything reachable (a registered-but-unproducing fingerprint), so "record
what would make it serve" was the only correct disposition here, not a
partial attempt at 1-2.

---

## Step 3J2. Add the consummation event, and make the delay axis structured

### What changed

`lib/canonical-v2/contract-bundle.js`:

- `PAYMENT_DELAY_STRUCTURE_MIGRATION_V1`: exhaustive map from V3's two
  `payment_delay` tokens to the V4 structured form -- `NONE -> {count: 0,
  unit: 'BUSINESS_DAYS', bound_type: 'EXACT'}`, `TWO_BUSINESS_DAYS ->
  {count: 2, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND'}`. The
  OUTER_BOUND choice for TWO_BUSINESS_DAYS is not a guess: every real
  TWO_BUSINESS_DAYS quote this programme has actually read (QXO's and
  Modiv's, all four "within two (2) Business Days..." sentences in
  `tests/canonical-v2-payment-timing-split.test.js`) uses "within", which is
  an outer bound by ordinary meaning -- decision 5's own text: "[TWO_
  BUSINESS_DAYS] squeeze[s] into ... only if that code silently means outer
  bound".
- `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4`: additive, derived from V3 (not
  hand-retyped) by running V3's 9 `pathway_constraints` through the
  migration above. `allowed_payment_trigger_events` gains `CONSUMMATION` as
  a fourth value (no existing pathway_constraint uses it yet -- Skechers was
  never part of the QXO-derived pathway lineage V2/V3's 9 constraints come
  from, same relationship V3's own CONCURRENT_WITH_TERMINATION already has
  to those 9). `allowed_payment_delays` is replaced by
  `allowed_payment_delay_units` (`['BUSINESS_DAYS']`) and
  `allowed_payment_delay_bound_types` (`['EXACT', 'OUTER_BOUND']`) -- `count`
  is validated for shape, not enumerated, so a new duration needs no schema
  edit.
- `FIXTURE_CONTRACT_INPUT_V40`, `compileFixtureContractV40()`,
  `EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V6`, a new `KNOWN_VERSION_SHAPES` entry,
  `FIXTURE_CONTRACT_FINGERPRINT_V40` -- the same dual-numbering pattern V39
  used (concepts stay at V24, claims stay at V38). `validateInput`'s
  `serving_trigger_path_schemas` branch is now length-3-aware
  (`[V2]` / `[V2, V3]` / `[V2, V3, V4]`).
- **Deliberately NOT registered** in `FIXTURE_CONTRACT_FINGERPRINTS` /
  `FIXTURE_CONTRACTS_BY_FINGERPRINT`, for the identical reason V39 was not:
  no producer emits a V4-shaped effect. Recorded in `docs/core/GRAVEYARD.md`
  entry 16 (extended, not duplicated).

`lib/canonical-v2/termination-fee-trigger-path.js`:

- `usesSplitPaymentTiming` renamed `usesSplitPaymentTimingKeys` (now true for
  version 3 OR 4 -- both use the `payment_trigger_event`/`payment_delay` key
  NAMES) and a new, narrower `usesStructuredPaymentDelay` (true only for
  version 4) added alongside it.
- `EFFECT_KEYS_V3` is reused for V4 unchanged -- no `EFFECT_KEYS_V4` was
  added, because V4 renames no key; only `payment_delay`'s VALUE shape
  changes, which `requireExactKeys` (a key-set check) does not see.
- `isWellFormedPaymentDelay(delay, schema)` (new): the structured-delay
  shape check -- exact 3 keys (`count`, `unit`, `bound_type`), `count` a
  non-negative integer (validated for SHAPE, not against an enumerated
  list), `unit`/`bound_type` each in the schema's own governed lists.
- `paymentTimingGoverned` / `paymentTimingMatchesConstraint`: both gained a
  third branch (structured V4, checked first) alongside the existing V3 and
  V2 branches; neither existing branch's logic changed.

`lib/canonical-v2/termination-product-projection.js`:

- `PAYMENT_TRIGGER_EVENT_QUOTE_CLASSIFICATION_V2` (new): one entry, the real
  Skechers §8.3(b)(i) sentence -> `CONSUMMATION`. `classifyPaymentTriggerEvent
  QuoteV4(quote)` tries the existing V3 table first (so every V3-classifiable
  quote keeps classifying its event exactly as before), then this new one.
- `parsePaymentDelayQuote(quote)` (new): a MEASUREMENT parser, not a curated
  table -- extracts a Business-Days count (digit or spelled-out word form)
  and a bound-type signal ("within" / "no ... later than" / "in any event"
  => `OUTER_BOUND`; "concurrently" / "simultaneously" / "prior to" / "upon"
  with no count => `EXACT`, count 0). Returns `null` on anything it cannot
  parse, the same refusal discipline `classifyPaymentTimingQuote` already
  uses -- never guesses at a value the text does not support.
- `classifyPaymentTimingQuoteV4(quote)`: the full pair, only if BOTH the
  event and the delay resolve.

### How each pattern encodes (from filed text, not typed strings)

All verified in `tests/canonical-v2-skechers-payment-timing-v4.test.js`
against `tests/fixtures/canonical-v2/skechers-first-live-run/
skechers-raw-fetched.htm`, converted through this repository's own
`buildSecEdgarIntakeCapture` + `convertSecHtmlToCanonicalText` pipeline --
the same discipline `tests/canonical-v2-payment-timing-split.test.js`
already uses for Modiv. Every quote below was located by substring search
of the CONVERTED text before being pinned in the classification table or
the test, not typed independently of it.

| Source | Real filed text (Skechers, converted) | `payment_trigger_event` | `payment_delay` |
|---|---|---|---|
| §8.3(b)(i) | "the Company will concurrently with the consummation of such Acquisition Transaction pay or cause to be paid to Parent ... an amount equal to $339,883,891" | `CONSUMMATION` | `{count: 0, unit: 'BUSINESS_DAYS', bound_type: 'EXACT'}` |
| §8.3(b)(ii) | "the Company must promptly (and in any event within two Business Days) following such termination pay ... the Company Termination Fee" | `TERMINATION` (V3 table) | `{count: 2, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND'}` |
| §8.3(c) | "Parent shall promptly, but in no event later than two Business Days after termination of this Agreement, pay ... an amount equal to $534,103,258" | `TERMINATION` (V3 table) | `{count: 2, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND'}` |
| financing corpus (`tests/fixtures/canonical-v2/financing-covenants-fixtures/corpus-cards.json`) | "within three Business Days after the delivery of such notice by the Company" | n/a (not a fee-payment sentence; proves the DELAY parser only) | `{count: 3, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND'}` |

Why §8.3(b)(i) matters most: encoding it as `EARLIER_OF_SIGNING_OR_
CONSUMMATION` (the nearest existing V3 code) would assert the fee is owed at
SIGNING of a later deal even if that deal collapses; Skechers' real text
owes it only at CLOSING. A signed-but-collapsed second deal would owe
$339,883,891 under the wrong code and nothing under the right one --
exactly the inversion decision 5 names.

Every V3 pattern (both QXO legacy codes, all three Modiv branches) still
encodes unchanged -- confirmed both by byte-identity of the V2 and V3
schema constants against the pre-3J2 committed file (`git show HEAD:...`
diffed against the current file, exact block extraction, `==`) and by
`classifyPaymentTriggerEventQuoteV4` returning the same event for every V3
quote as `classifyPaymentTimingQuote` alone does.

### Test names and exit codes

```
$ CI=true node --test \
    tests/canonical-v2-termination-fee-trigger-path-v4.test.js \
    tests/canonical-v2-skechers-payment-timing-v4.test.js
...
# tests 19
# pass 19
# fail 0
$ echo $?
0
```

Full regression re-run (29 files total across both 3J1 and 3J2 work):

```
$ CI=true node --test <29 files>
...
# tests 339
# pass 339
# fail 0
$ echo $?
0
```

`bash scripts/lint/forbidden-patterns.sh` -> `INVARIANT-4: PASS`, exit 0.

`npm test` (full suite) was not run, per this step's ground rules.

### Where 3J2's own text was wrong or needed correction

One thing worth flagging rather than silently working around: the step
text's own illustrative decision-5 quote for §8.3(b)(i) reads "the Company
will concurrently with the consummation of such Acquisition Transaction
pay … the Company Termination Fee" (an ellipsis). The real filed sentence
is longer and more specific -- "...pay or cause to be paid to Parent (or as
directed by Parent) an amount equal to $339,883,891 (the "Company
Termination Fee")" -- confirmed by locating it in the converted text. The
classification table quotes the real, full sentence, not the step's own
paraphrase, per the step's own instruction to read from filed text rather
than a typed string.
