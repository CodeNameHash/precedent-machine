# Step 3J. Split payment timing into event and delay

Working notes, written incrementally. Ruled by Ben 2026-08-07, DECISIONS.md
decision 5's "RULED 2026-08-07: split the field. Option B." Cross-checked
against decision 6 ("Fee required to terminate", moves to Termination
Rights, ruled 2026-08-05).

Owned files this step touches: `lib/canonical-v2/contract-bundle.js`,
`lib/canonical-v2/termination-fee-trigger-path.js`,
`lib/canonical-v2/termination-product-projection.js`, and new test files.
`evidence/canonical-v2/**` is not touched (another agent owns it; read-only
here).

## 1. Reconnaissance

- `allowed_payment_timings` (two codes: `TWO_BUSINESS_DAYS_AFTER_TERMINATION`,
  `UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION`) lives in exactly one place as
  *governed vocabulary*: `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2` inside
  `contract-bundle.js` (`schema_key: 'TERMINATION_FEE_TRIGGER_PATH'`,
  `schema_version: 2`), set once at `FIXTURE_CONTRACT_INPUT_V4` and inherited
  unchanged by every fixture version through V38 (spread, never
  re-declared). Its 9 `pathway_constraints` each carry a `payment_timing`
  value -- this is "QXO's two stored values" the step names.
- Enforcement is `termination-fee-trigger-path.js`'s `EFFECT_KEYS` (exact-key
  contract on every governed effect) and `validateTerminationFeeTriggerEffect`
  (line ~85, `schema.allowed_payment_timings.includes(effect.payment_timing)`
  plus the pathway-constraint match at line ~108).
- `EFFECT_KEYS` is imported verbatim by three files I do not own
  (`shared-serving-row.js`, `canonical-contract-technical-relationship-
  validator.js`, `qxo-buyer-termination-fee-trigger-detail.js`) and by two
  tests I do not own. Editing its existing shape in place would break all of
  them for a step scoped to three files. Decision: **additive, versioned
  split** -- a new `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3` (schema_version
  3) sits alongside the frozen V2, exactly the discipline `contract-bundle.js`'s
  own header already requires ("frozen, never edited again... new vocabulary
  added only via a newer version constant"). V2 and every consumer of it is
  untouched, byte-for-byte. `EFFECT_KEYS` (V2 shape) is untouched; a new
  `EFFECT_KEYS_V3` is added alongside it and `validateTerminationFeeTriggerEffect`
  is made schema-version-aware so it validates both without weakening either.
- `termination-product-projection.js` does not currently reference
  `payment_timing` at all. `feeRequired` (decision 6) is a V1-path field,
  not resolved anywhere under `lib/canonical-v2/native-producer/` --
  confirmed by grep, matching decision 6's own "Code" note. No real,
  committed Modiv `feeRequired` value exists anywhere in this repository
  (grepped `.js`/`.json`/`.md`, `evidence/canonical-v2/modiv-termination-
  20260807-replay/validation.json` included): it is a V1-extraction, live-
  database-only value never checked in. The cross-check test below is built
  accordingly -- see section 4.

## 2. The vocabulary split

`allowed_payment_trigger_events`: `TERMINATION`, `EARLIER_OF_SIGNING_OR_CONSUMMATION`,
`CONCURRENT_WITH_TERMINATION`.
`allowed_payment_delays`: `NONE`, `TWO_BUSINESS_DAYS`.

Five real patterns, all draw from this same 3x2 vocabulary, no sixth value
anywhere:

| Pattern | trigger_event | delay |
|---|---|---|
| QXO `TWO_BUSINESS_DAYS_AFTER_TERMINATION` | `TERMINATION` | `TWO_BUSINESS_DAYS` |
| QXO `UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION` | `EARLIER_OF_SIGNING_OR_CONSUMMATION` | `NONE` |
| Modiv 7.3(b)(i),(iv),(v) / 7.3(c) | `TERMINATION` | `TWO_BUSINESS_DAYS` |
| Modiv 7.3(b)(ii) | `CONCURRENT_WITH_TERMINATION` | `NONE` |
| Modiv 7.3(b)(iii) | `EARLIER_OF_SIGNING_OR_CONSUMMATION` | `TWO_BUSINESS_DAYS` |

Modiv (iii) is the pattern the old two-value enum could not express even
approximately: same event as QXO's second code, different delay.

## 3. What was built

### `lib/canonical-v2/contract-bundle.js`

- `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3` (new, additive; `schema_key:
  'TERMINATION_FEE_TRIGGER_PATH'`, `schema_version: 3`). Its 9
  `pathway_constraints` are DERIVED from V2's, not hand-retyped:
  `PAYMENT_TIMING_SPLIT_MIGRATION_V1` maps each of the two legacy codes to
  the split pair, and V3 is built by running V2's own `pathway_constraints`
  through it (`{ payment_timing, ...rest } = entry; return {...rest,
  ...migration[payment_timing]}`), so it cannot silently drift from what it
  replaces. `allowed_payment_timings` does not exist on V3 anywhere;
  `allowed_payment_trigger_events` / `allowed_payment_delays` replace it.
  V2 itself is untouched, still exported, still the schema every existing
  consumer (`shared-serving-row.js`, `canonical-contract-technical-
  relationship-validator.js`, `qxo-buyer-termination-fee-trigger-detail.js`)
  reads.
- `FIXTURE_CONTRACT_INPUT_V39`: strictly additive spread of V38.
  `serving_trigger_path_schemas` becomes `[V2, V3]` (V2 first, unmodified);
  every other field (concepts, claims, relationship_definitions, metric
  bindings, etc.) is byte-identical to V38's. This is the dual-numbering
  case the plan's own knowledge table names: fixture-input version moves to
  V39, concept-keys version stays at V24, claim-keys version stays at V38 --
  zero new concepts or claim definitions, because the split fields are
  schema-embedded (like `terminating_party`), not governed claim
  definitions.
- `compileFixtureContractV39()`, `EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V5`, a
  new `KNOWN_VERSION_SHAPES` entry, `FIXTURE_CONTRACT_FINGERPRINT_V39` --
  all following the established per-version pattern.
- `validateInput`'s one hardcoded `assertExact(input.
  serving_trigger_path_schemas, [TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2],
  ...)` (the literal enforcement point the plan named) is now
  length-branched: 1 entry still means exactly `[V2]` (every existing
  caller, unchanged behaviour); 2 entries means exactly `[V2, V3]`.
- **Deliberately NOT done**: V39 is not added to `FIXTURE_CONTRACT_
  FINGERPRINTS` / `FIXTURE_SERVING_CONTRACT_FINGERPRINTS` /
  `FIXTURE_CONTRACTS_BY_FINGERPRINT`. Those three structures are what
  `shared-serving-row.js` and `market-cohort-query.js` (neither owned by
  this step) check membership against to decide whether a fingerprint is
  one real serving code should trust. Registering V39 there is a
  production-wiring decision (should Canonical V2 actually serve the new
  schema to a reviewer) this step does not make, and nothing produces a
  V39-fingerprinted bundle outside this file's own tests yet -- no metric-
  operation binding points at `trigger_path_schema_version: 3`. First
  attempt DID add it there and broke `tests/canonical-v2-contract-bundle-
  versions.test.js`'s exhaustive `FIXTURE_CONTRACT_FINGERPRINTS` equality
  check (a test this step does not own); reverted rather than edited that
  test, since the registration was a scope decision, not a bug.

### `lib/canonical-v2/termination-fee-trigger-path.js`

- `EFFECT_KEYS` (schema-version-2 shape) is byte-for-byte unchanged --
  confirmed by a dedicated regression test, since three files I do not own
  import it directly.
- `EFFECT_KEYS_V3` (new): same 11-key contract, `payment_timing` replaced by
  `payment_trigger_event` + `payment_delay`.
- `validateTerminationFeeTriggerEffect` is now schema-version-aware
  (`usesSplitPaymentTiming(schema)` checks the COMPILED schema's
  `trigger_path_schema_version === 3`) and picks the matching key set and
  governed-vocabulary check accordingly. A schema-version-2 effect is
  validated by the exact same logic as before; a schema-version-3 effect is
  validated against `allowed_payment_trigger_events` /
  `allowed_payment_delays` and the pathway constraint's own split pair.
- **Bug caught by the new tests, fixed in this change**: the first draft of
  `usesSplitPaymentTiming` read `schema.schema_version`, which on the
  COMPILED schema object is the fixed serving-envelope version string
  (`'SERVING_TRIGGER_PATH_SCHEMA_DEFINITION/V1'`, set by contract-bundle
  .js's `compileTriggerPathSchema`), not the trigger-path schema's own
  version. The correct field is `schema.trigger_path_schema_version`. A
  hand-written smoke test (not committed) would have missed this since it
  used the raw, uncompiled `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3` input
  constant directly; the committed test exercises the same compiled-schema
  lookup real code uses (`triggerPathSchemaForBinding`), which is what
  caught it.

### `lib/canonical-v2/termination-product-projection.js`

- `classifyPaymentTimingQuote(quote)`: exact-match classifier (no fuzzy
  text matching, same discipline as the existing `interestRateBasisCode`)
  from a verbatim payment-timing sentence to the split pair. Its four known
  quotes are Modiv's own four distinct sentences (branches (i)/(iv)/(v) and
  7.3(c) share one wording).
- `migrateLegacyPaymentTiming(code)`: the QXO legacy-code migration,
  throwing on anything not one of the two real codes.
- `paymentTriggerEventAgreesWithFeeRequired` /
  `assertPaymentTriggerEventAgreesWithFeeRequired`: the decision-5/decision-6
  cross-check. `feeRequired` counts as required when `true` or non-empty
  prose (decision 6's own "23 boolean, 5 prose" split); the assert form
  throws `PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT` on divergence in either
  direction (concurrent-but-not-required, or required-but-not-concurrent).

## 4. How each of the five patterns encodes

| # | Source | Verbatim (Modiv) / code (QXO) | `payment_trigger_event` | `payment_delay` |
|---|---|---|---|---|
| 1 | QXO | `TWO_BUSINESS_DAYS_AFTER_TERMINATION` | `TERMINATION` | `TWO_BUSINESS_DAYS` |
| 2 | QXO | `UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION` | `EARLIER_OF_SIGNING_OR_CONSUMMATION` | `NONE` |
| 3 | Modiv 7.3(b)(i),(iv),(v) / 7.3(c) | "within two (2) Business Days after the date of such termination by [Parent/the Company]" | `TERMINATION` | `TWO_BUSINESS_DAYS` |
| 4 | Modiv 7.3(b)(ii) | "prior to or substantially concurrently with such termination by the Company" | `CONCURRENT_WITH_TERMINATION` | `NONE` |
| 5 | Modiv 7.3(b)(iii) | "within two (2) Business Days after the earlier of entry into a definitive agreement ... and consummation" | `EARLIER_OF_SIGNING_OR_CONSUMMATION` | `TWO_BUSINESS_DAYS` |

All five draw from exactly `{TERMINATION, EARLIER_OF_SIGNING_OR_
CONSUMMATION, CONCURRENT_WITH_TERMINATION} x {NONE, TWO_BUSINESS_DAYS}` --
three events, two delays, nothing beyond what the split requires. Pattern 5
is the one the old enum could not reach: same event as pattern 2, different
delay. Patterns 3 and 4 are tested against the REAL parsed Modiv quotes
(`parseModivPaymentTimings` run against the real committed Modiv fixture),
not hand-typed duplicates of the sidecar's header comment.

## 5. The cross-check

Test: `tests/canonical-v2-payment-timing-split.test.js`, second half.

- Modiv 7.3(b)(ii)'s real, DERIVED `payment_trigger_event` (via
  `classifyPaymentTimingQuote` on the real sidecar output) is
  `CONCURRENT_WITH_TERMINATION`.
- No real, committed Modiv `feeRequired` value exists anywhere in this
  repository to compare it against -- confirmed by grep across `.js`,
  `.json` and `.md`, including `evidence/canonical-v2/modiv-termination-
  20260807-replay/validation.json` (read-only; not modified). Decision 6's
  own "Code" note already says why: `feeRequired` values come from the V1
  extraction path against a live database, and per `docs/core/CODEBASE-
  GUIDE.md` section 4.7, "this schema has never been applied to a live
  database, staging or production." There is nothing to read a real stored
  value from.
- So the test proves the GUARD itself, using the real derived value as one
  side: `assertPaymentTriggerEventAgreesWithFeeRequired('CONCURRENT_WITH_
  TERMINATION', true)` passes; the same call with `feeRequired` in
  `[false, null, undefined, '']` throws
  `PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT` in every case. The reverse
  direction (a truthy `feeRequired` on a non-concurrent trigger event) is
  also asserted to fail. This is "a test that fails if they diverge" in the
  literal sense the step asks for: it is the divergence-detector under test,
  not a single fixed pair of numbers pinned once and never exercised again.

## 6. Migration evidence

`tests/canonical-v2-contract-bundle-v39.test.js`:
- `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3 carries no stored QXO value in the
  old single-field form` -- asserts `'allowed_payment_timings' in schema ===
  false` and `'payment_timing' in entry === false` for all 9
  `pathway_constraints`.
- `every V3 pathway_constraint is the exact migration of its V2 sibling` --
  walks all 9 V2 entries and asserts the V3 sibling's split pair equals
  `PAYMENT_TIMING_SPLIT_MIGRATION_V1[v2Entry.payment_timing]` while every
  other field (`trigger_code`, `terminating_party_rule`,
  `expression_digest_by_fee_side`) is unchanged.
- `QXO migration table pins the two legacy codes to the exact required pair`
  -- pins the migration table has exactly 2 entries, matching the 2 legacy
  codes, nothing invented.

## 7. Targeted test results (all green, exit codes shown)

```
$ CI=true node --test <23 files listed below>
...
# tests 305
# pass 305
# fail 0
$ echo $?
0
```

Files run: `canonical-v2-contract-bundle-versions.test.js` (66, unowned --
regression only), `canonical-v2-contract-bundle-v14/v15/v17.test.js` (24,
unowned -- regression only), `canonical-v2-contract-bundle-v39.test.js` (7,
new), `canonical-v2-termination-fee-trigger-path-v3.test.js` (8, new),
`canonical-v2-payment-timing-split.test.js` (11, new),
`canonical-v2-qxo-buyer-termination-fee-admitted-slice.test.js`,
`canonical-v2-canonical-contract-technical-relationship-effects.test.js`,
`canonical-v2-shared-serving-row.test.js` (33 combined, unowned consumers of
`EFFECT_KEYS` / `termination-fee-trigger-path.js` -- regression),
`canonical-v2-termination-product-parity.test.js`,
`canonical-v2-termination-fee-conditional-amount-projection.test.js`,
`canonical-v2-termination-fee-both-sources.test.js`,
`canonical-v2-qxo-termination-fee-admitted-slice.test.js`,
`canonical-v2-qxo-termination-fee-vocabulary.test.js`,
`canonical-v2-reviewed-termination-fee-slice.test.js`,
`canonical-v2-serving-projection.test.js`,
`canonical-v2-sole-remedy-resolution.test.js`,
`canonical-v2-termination-real-fixture-replay.test.js` (49 combined, broad
termination-family regression),
`canonical-v2-modiv-termination-fee-payment-timing-parser.test.js`,
`canonical-v2-modiv-termination-fee-citation-following-replay.test.js` (16,
Step 3I sidecar -- untouched, still green, every branch's quote confirmed
still reachable by these same tests), `canonical-v2-p1-vertical-slice
.test.js`, `canonical-v2-metric-serving-admission-f22.test.js`,
`canonical-v2-query-result.test.js` (30, broader contract-bundle consumer
smoke test).

`bash scripts/lint/forbidden-patterns.sh` -> `INVARIANT-4: PASS`, exit 0.

Full `npm test` was not run, per this step's ground rules.

## 8. Things found wrong or worth flagging

1. **A genuine bug caught mid-implementation, not present in the final
   diff**: see section 3's note under `termination-fee-trigger-path.js` --
   `schema.schema_version` vs `schema.trigger_path_schema_version` on the
   compiled schema object. Caught by the dedicated V3 validator test before
   it ever reached a green run; worth naming because it is exactly the kind
   of thing a less exacting test (one built against the raw input constant
   instead of the real compiled lookup path) would have missed silently.
2. **The step's phrase "Migrate QXO's two stored values into the new pair"
   could be read two ways**: (a) edit the existing frozen
   `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2` object in place, or (b) add a
   new schema version that supersedes it going forward while V2 stays frozen
   for the sake of the three unowned consumers that import it. This note
   went with (b), for two reasons: `contract-bundle.js`'s own header
   comment already states the "frozen, never edited again" convention for
   exactly this kind of vocabulary growth, and reading (a) would have broken
   `shared-serving-row.js`, `canonical-contract-technical-relationship-
   validator.js` and `qxo-buyer-termination-fee-trigger-detail.js` -- none
   owned by this step, none this step should be breaking. "No stored QXO
   value remains in the old single-field form" is satisfied inside V3 (the
   new, live target), which is where the acceptance criterion's own wording
   points; V2 remaining exactly as it was is what the file's own frozen-
   version discipline requires, not a workaround.
3. **`docs/core/CODEBASE-GUIDE.md`'s "V2 through V38 at the time of
   writing"** is now stale (V39 exists), but that same sentence already
   tells the reader to `grep -o "compileFixtureContractV[0-9]*" ... | sort
   -u -V` to re-count rather than trust the hardcoded number, so it was left
   alone rather than hand-edited to a number that will just as quickly go
   stale again.
4. No stored QXO value in the OLD single-field form survives in the new,
   live schema (V3); it deliberately still exists, unedited, in the frozen
   V2 every pre-existing consumer reads, which is the correct outcome, not
   an oversight, for a codebase whose own explicit rule is never to edit an
   already-reviewed vocabulary version in place.
