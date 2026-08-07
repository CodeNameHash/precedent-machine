'use strict';

// PLAN.md Step 3J ("split payment timing into event and delay"). Two things
// this file proves, both against real, committed data rather than hand-
// typed strings:
//
// 1. All five known real payment-timing patterns -- both of QXO's legacy
//    `allowed_payment_timings` codes, and all three of Modiv's real §7.3(b)
//    patterns (verbatim, parsed from the real committed Modiv fixture by
//    lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-
//    parser.js, the Step 3I sidecar) -- encode into the split
//    {payment_trigger_event, payment_delay} pair without inventing a code
//    beyond the three events / two delays the split requires.
// 2. The cross-check DECISIONS.md decision 5's 2026-08-07 ruling names
//    explicitly: Modiv's real 7.3(b)(ii) branch -- the superior-proposal
//    fiduciary-out fee, paid concurrently with terminating -- encodes as
//    payment_trigger_event = CONCURRENT_WITH_TERMINATION, and that must
//    agree with the TERMR-SUPERIOR row's `feeRequired` (decision 6). No
//    real, committed Modiv `feeRequired` value exists anywhere in this
//    repository to compare against (grepped; it is a V1-extraction, live-
//    database-only value -- see docs/codex-program/notes/step-3j-payment-
//    timing.md section 1), so this proves the GUARD itself: it must pass
//    when they agree and it must fail -- by throwing -- when they diverge,
//    using the real, derived CONCURRENT_WITH_TERMINATION value as one side
//    of the comparison.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { parseModivPaymentTimings } = require('../lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-parser');
const { TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3 } = require('../lib/canonical-v2/contract-bundle');
const {
  classifyPaymentTimingQuote,
  migrateLegacyPaymentTiming,
  paymentTriggerEventAgreesWithFeeRequired,
  assertPaymentTriggerEventAgreesWithFeeRequired,
} = require('../lib/canonical-v2/termination-product-projection');

const rawBytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm'));
const capture = buildSecEdgarIntakeCapture({
  retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/modiv.htm',
  final_url: 'https://www.sec.gov/Archives/edgar/data/1/modiv.htm',
  status_code: 200,
  content_type: 'text/html; charset=UTF-8',
  retrieved_at: '2026-08-07T00:00:00.000Z',
  retrieval_policy_digest: sha256Hex('payment-timing split test'),
  redirect_count: 0,
  response_bytes: rawBytes,
});
const modivText = convertSecHtmlToCanonicalText(capture).canonical_text;
const modivRows = parseModivPaymentTimings(modivText);
const modivByBranch = new Map(modivRows.map((row) => [row.triggering_branch, row]));

function allowedEvent(event) {
  return TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.allowed_payment_trigger_events.includes(event);
}
function allowedDelay(delay) {
  return TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.allowed_payment_delays.includes(delay);
}

// ---------------------------------------------------------------------------
// 1. All five real patterns encode, drawn only from the governed vocabulary.
// ---------------------------------------------------------------------------

test('QXO TWO_BUSINESS_DAYS_AFTER_TERMINATION encodes as TERMINATION + TWO_BUSINESS_DAYS', () => {
  const split = migrateLegacyPaymentTiming('TWO_BUSINESS_DAYS_AFTER_TERMINATION');
  assert.deepEqual(split, { payment_trigger_event: 'TERMINATION', payment_delay: 'TWO_BUSINESS_DAYS' });
  assert.ok(allowedEvent(split.payment_trigger_event) && allowedDelay(split.payment_delay));
});

test('QXO UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION encodes as EARLIER_OF_SIGNING_OR_CONSUMMATION + NONE', () => {
  const split = migrateLegacyPaymentTiming('UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION');
  assert.deepEqual(split, { payment_trigger_event: 'EARLIER_OF_SIGNING_OR_CONSUMMATION', payment_delay: 'NONE' });
  assert.ok(allowedEvent(split.payment_trigger_event) && allowedDelay(split.payment_delay));
});

test('Modiv 7.3(b)(i)/(iv)/(v) and 7.3(c) (real, parsed quotes) encode as TERMINATION + TWO_BUSINESS_DAYS -- same pattern as QXO', () => {
  for (const branch of ['7.3(b)(i)', '7.3(b)(iv)', '7.3(b)(v)', '7.3(c)']) {
    const row = modivByBranch.get(branch);
    assert.ok(row, branch);
    const split = classifyPaymentTimingQuote(row.payment_timing_quote);
    assert.deepEqual(split, { payment_trigger_event: 'TERMINATION', payment_delay: 'TWO_BUSINESS_DAYS' }, branch);
  }
});

test('Modiv 7.3(b)(ii) (real, parsed quote) encodes as CONCURRENT_WITH_TERMINATION + NONE -- the pattern neither legacy code could express', () => {
  const row = modivByBranch.get('7.3(b)(ii)');
  assert.equal(row.payment_timing_quote, 'prior to or substantially concurrently with such termination by the Company');
  const split = classifyPaymentTimingQuote(row.payment_timing_quote);
  assert.deepEqual(split, { payment_trigger_event: 'CONCURRENT_WITH_TERMINATION', payment_delay: 'NONE' });
  assert.ok(allowedEvent(split.payment_trigger_event) && allowedDelay(split.payment_delay));
});

test('Modiv 7.3(b)(iii) (real, parsed quote) encodes as EARLIER_OF_SIGNING_OR_CONSUMMATION + TWO_BUSINESS_DAYS -- the QXO tail event with a different delay, exactly the case the old enum could not reach', () => {
  const row = modivByBranch.get('7.3(b)(iii)');
  const split = classifyPaymentTimingQuote(row.payment_timing_quote);
  assert.deepEqual(split, { payment_trigger_event: 'EARLIER_OF_SIGNING_OR_CONSUMMATION', payment_delay: 'TWO_BUSINESS_DAYS' });
  assert.ok(allowedEvent(split.payment_trigger_event) && allowedDelay(split.payment_delay));
  // This is NOT the same pair as QXO's UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION
  // migration -- same event, different delay, which is the whole point.
  assert.notDeepEqual(split, migrateLegacyPaymentTiming('UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION'));
});

test('all five real patterns together use exactly three trigger events and two delays -- no code invented beyond what the split requires', () => {
  const pairs = [
    migrateLegacyPaymentTiming('TWO_BUSINESS_DAYS_AFTER_TERMINATION'),
    migrateLegacyPaymentTiming('UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION'),
    classifyPaymentTimingQuote(modivByBranch.get('7.3(b)(i)').payment_timing_quote),
    classifyPaymentTimingQuote(modivByBranch.get('7.3(b)(ii)').payment_timing_quote),
    classifyPaymentTimingQuote(modivByBranch.get('7.3(b)(iii)').payment_timing_quote),
  ];
  const events = new Set(pairs.map((pair) => pair.payment_trigger_event));
  const delays = new Set(pairs.map((pair) => pair.payment_delay));
  assert.deepEqual([...events].sort(), ['CONCURRENT_WITH_TERMINATION', 'EARLIER_OF_SIGNING_OR_CONSUMMATION', 'TERMINATION']);
  assert.deepEqual([...delays].sort(), ['NONE', 'TWO_BUSINESS_DAYS']);
  for (const pair of pairs) {
    assert.ok(allowedEvent(pair.payment_trigger_event));
    assert.ok(allowedDelay(pair.payment_delay));
  }
});

test('a quote that is not one of the ruled-on patterns returns null rather than guessing', () => {
  assert.equal(classifyPaymentTimingQuote('within thirty (30) days of a subsequent transaction'), null);
  assert.equal(classifyPaymentTimingQuote(''), null);
  assert.equal(classifyPaymentTimingQuote(null), null);
  assert.throws(() => migrateLegacyPaymentTiming('SOMETHING_ELSE'), /unrecognised legacy allowed_payment_timings code/);
});

// ---------------------------------------------------------------------------
// 2. The cross-check: payment_trigger_event = CONCURRENT_WITH_TERMINATION
//    and TERMR-SUPERIOR's feeRequired must agree, and the guard fails --
//    throws -- if they diverge.
// ---------------------------------------------------------------------------

test('Modiv 7.3(b)(ii)\'s real, derived CONCURRENT_WITH_TERMINATION agrees with a truthy feeRequired (boolean or prose, decision 6\'s own "23 boolean, 5 prose" split)', () => {
  const modivBranchIiEvent = classifyPaymentTimingQuote(
    modivByBranch.get('7.3(b)(ii)').payment_timing_quote,
  ).payment_trigger_event;
  assert.equal(modivBranchIiEvent, 'CONCURRENT_WITH_TERMINATION');
  assert.equal(paymentTriggerEventAgreesWithFeeRequired(modivBranchIiEvent, true), true);
  assert.equal(
    paymentTriggerEventAgreesWithFeeRequired(modivBranchIiEvent, 'prior to or substantially concurrently with termination'),
    true,
  );
  assert.equal(assertPaymentTriggerEventAgreesWithFeeRequired(modivBranchIiEvent, true), true);
});

test('the guard FAILS -- throws -- when payment_trigger_event is CONCURRENT_WITH_TERMINATION but feeRequired is falsy: the exact divergence decision 5 requires surfacing', () => {
  const modivBranchIiEvent = classifyPaymentTimingQuote(
    modivByBranch.get('7.3(b)(ii)').payment_timing_quote,
  ).payment_trigger_event;
  for (const disagreeingFeeRequired of [false, null, undefined, '']) {
    assert.equal(
      paymentTriggerEventAgreesWithFeeRequired(modivBranchIiEvent, disagreeingFeeRequired),
      false,
      JSON.stringify(disagreeingFeeRequired),
    );
    assert.throws(
      () => assertPaymentTriggerEventAgreesWithFeeRequired(modivBranchIiEvent, disagreeingFeeRequired),
      /PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT/,
      JSON.stringify(disagreeingFeeRequired),
    );
  }
});

test('the guard also fails the other direction: feeRequired truthy but payment_trigger_event is not CONCURRENT_WITH_TERMINATION', () => {
  assert.equal(paymentTriggerEventAgreesWithFeeRequired('TERMINATION', true), false);
  assert.throws(
    () => assertPaymentTriggerEventAgreesWithFeeRequired('TERMINATION', 'payable prior to termination'),
    /PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT/,
  );
});

test('a non-concurrent trigger event with a falsy feeRequired agrees (the ordinary QXO case: no condition-precedent fiduciary-out fee)', () => {
  assert.equal(paymentTriggerEventAgreesWithFeeRequired('TERMINATION', false), true);
  assert.equal(paymentTriggerEventAgreesWithFeeRequired('TERMINATION', undefined), true);
  assert.equal(paymentTriggerEventAgreesWithFeeRequired('EARLIER_OF_SIGNING_OR_CONSUMMATION', null), true);
  assert.equal(assertPaymentTriggerEventAgreesWithFeeRequired('TERMINATION', false), true);
});
