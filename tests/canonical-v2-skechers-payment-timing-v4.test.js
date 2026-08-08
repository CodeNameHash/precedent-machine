'use strict';

// PLAN.md Step 3J2. DECISIONS.md decision 5's 2026-08-07 ruling: "Skechers
// §8.3(b)(i) encodes as CONSUMMATION from filed text, read through this
// repository's own conversion, not a typed string... 'Within three Business
// Days' encodes without a new ruling... Skechers' 'promptly (and in any
// event within two Business Days)' records its bound type rather than
// flattening."
//
// This file reads the real, committed Skechers agreement
// (tests/fixtures/canonical-v2/skechers-first-live-run/
// skechers-raw-fetched.htm) through the SAME conversion pipeline
// tests/canonical-v2-payment-timing-split.test.js already uses for Modiv
// (buildSecEdgarIntakeCapture -> convertSecHtmlToCanonicalText), locates
// the real payment-timing sentences by substring search of that CONVERTED
// text, and only then classifies them -- so the classification table's own
// quotes (termination-product-projection.js's
// PAYMENT_TRIGGER_EVENT_QUOTE_CLASSIFICATION_V2) are pinned as real
// substrings of the filed agreement, not independently typed strings this
// test merely assumes are faithful.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  PAYMENT_TRIGGER_EVENT_QUOTE_CLASSIFICATION_V2,
  classifyPaymentTriggerEventQuoteV4,
  parsePaymentDelayQuote,
  classifyPaymentTimingQuoteV4,
} = require('../lib/canonical-v2/termination-product-projection');
const { TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4 } = require('../lib/canonical-v2/contract-bundle');

const rawBytes = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run', 'skechers-raw-fetched.htm'),
);
const capture = buildSecEdgarIntakeCapture({
  retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/skechers.htm',
  final_url: 'https://www.sec.gov/Archives/edgar/data/1/skechers.htm',
  status_code: 200,
  content_type: 'text/html; charset=UTF-8',
  retrieved_at: '2026-08-07T00:00:00.000Z',
  retrieval_policy_digest: sha256Hex('3j2 skechers payment timing'),
  redirect_count: 0,
  response_bytes: rawBytes,
});
const skechersText = convertSecHtmlToCanonicalText(capture).canonical_text;

function allowedEvent(event) {
  return TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.allowed_payment_trigger_events.includes(event);
}

// ---------------------------------------------------------------------------
// 1. Section 8.3(b)(i): consummation alone. Located by substring search of
//    the real converted text, not typed independently of it.
// ---------------------------------------------------------------------------

test('the real Section 8.3(b)(i) sentence is present, verbatim, in the converted filed agreement', () => {
  const sentenceStart = skechersText.indexOf('then the Company will concurrently with the consummation of such Acquisition Transaction');
  assert.notEqual(sentenceStart, -1, 'the real §8.3(b)(i) payment sentence must be locatable in the converted text');
  const region = skechersText.slice(sentenceStart, sentenceStart + 400);
  assert.ok(region.includes('$339,883,891'), 'the real Company Termination Fee amount must be in the same sentence');
  assert.ok(region.includes('“Company Termination Fee”'));
});

// The classification table's own quote, confirmed to be a real substring of
// the same converted text this test just located the sentence in above --
// not a hand-typed paraphrase.
test('the classification table\'s Section 8.3(b)(i) quote is a real, verbatim substring of the filed, converted agreement', () => {
  const tableQuote = PAYMENT_TRIGGER_EVENT_QUOTE_CLASSIFICATION_V2[0].quote;
  assert.ok(skechersText.includes(tableQuote), 'the table quote must appear verbatim in the converted Skechers text');
});

test('Section 8.3(b)(i) classifies as CONSUMMATION -- not EARLIER_OF_SIGNING_OR_CONSUMMATION, which would invert the deal point (fee owed only at closing, never at signing)', () => {
  const tableQuote = PAYMENT_TRIGGER_EVENT_QUOTE_CLASSIFICATION_V2[0].quote;
  const event = classifyPaymentTriggerEventQuoteV4(tableQuote);
  assert.equal(event, 'CONSUMMATION');
  assert.notEqual(event, 'EARLIER_OF_SIGNING_OR_CONSUMMATION');
  assert.ok(allowedEvent(event));
});

test('the full V4 pair for Section 8.3(b)(i): CONSUMMATION event, zero-delay EXACT bound (paid concurrently with the consummation itself, not within a subsequent window)', () => {
  const tableQuote = PAYMENT_TRIGGER_EVENT_QUOTE_CLASSIFICATION_V2[0].quote;
  const pair = classifyPaymentTimingQuoteV4(tableQuote);
  assert.deepEqual(pair, {
    payment_trigger_event: 'CONSUMMATION',
    payment_delay: { count: 0, unit: 'BUSINESS_DAYS', bound_type: 'EXACT' },
  });
});

// ---------------------------------------------------------------------------
// 2. Section 8.3(b)(ii) and 8.3(c): "promptly (and in any event within two
//    Business Days)" / "promptly, but in no event later than two Business
//    Days" -- both real, both located by search, both an OUTER_BOUND on a
//    promptness covenant, not an exact two-day term.
// ---------------------------------------------------------------------------

test('Section 8.3(b)(ii)\'s real promptness-plus-outer-bound sentence is present, verbatim, in the converted filed agreement', () => {
  const idx = skechersText.indexOf('the Company must promptly (and in any event within two Business Days) following such termination');
  assert.notEqual(idx, -1);
});

test('Section 8.3(b)(ii)\'s delay records its bound type as OUTER_BOUND, not flattened to an exact two-day term -- the promptness covenant is not silently lost', () => {
  const delay = parsePaymentDelayQuote('promptly (and in any event within two Business Days)');
  assert.deepEqual(delay, { count: 2, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND' });
});

test('Section 8.3(c)\'s real "promptly, but in no event later than two Business Days" sentence is present, verbatim, in the converted filed agreement', () => {
  const idx = skechersText.indexOf('Parent shall promptly, but in no event later than two Business Days after termination of this Agreement');
  assert.notEqual(idx, -1);
  const region = skechersText.slice(idx, idx + 200);
  assert.ok(region.includes('$534,103,258'), 'the real Parent Termination Fee amount must be in the same sentence');
});

test('Section 8.3(c)\'s delay ALSO records OUTER_BOUND -- a differently-worded outer bound is not a different bound_type', () => {
  const delay = parsePaymentDelayQuote('promptly, but in no event later than two Business Days');
  assert.deepEqual(delay, { count: 2, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND' });
});

// ---------------------------------------------------------------------------
// 3. "Within three Business Days" -- real text in this repository's own
//    financing corpus -- encodes with no schema edit and no new ruling.
// ---------------------------------------------------------------------------

test('"within three Business Days" -- real text in this repository\'s own financing-covenants fixture -- is a well-formed measured delay with no new ruling', () => {
  const financingCorpus = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'financing-covenants-fixtures', 'corpus-cards.json'),
    'utf8',
  ));
  const haystack = JSON.stringify(financingCorpus);
  assert.ok(haystack.includes('within three Business Days after the delivery of such notice by the Company'),
    'the real "within three Business Days" text must still be in the financing corpus fixture');
  const delay = parsePaymentDelayQuote('within three Business Days after the delivery of such notice by the Company');
  assert.deepEqual(delay, { count: 3, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND' });
  assert.ok(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.allowed_payment_delay_units.includes(delay.unit));
  assert.ok(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.allowed_payment_delay_bound_types.includes(delay.bound_type));
});

// ---------------------------------------------------------------------------
// 4. Every V3 pattern still encodes (regression -- V4's event classifier
//    tries the V3 table first).
// ---------------------------------------------------------------------------

test('every V3-classifiable quote still classifies its event correctly through the V4 event classifier', () => {
  assert.equal(
    classifyPaymentTriggerEventQuoteV4('prior to or substantially concurrently with such termination by the Company'),
    'CONCURRENT_WITH_TERMINATION',
  );
  assert.equal(
    classifyPaymentTriggerEventQuoteV4('within two (2) Business Days after the date of such termination by Parent'),
    'TERMINATION',
  );
});

test('a quote matching neither the V3 table nor the V4 table returns null rather than guessing', () => {
  assert.equal(classifyPaymentTriggerEventQuoteV4('within thirty (30) days of a subsequent transaction'), null);
  assert.equal(parsePaymentDelayQuote('at a time to be mutually agreed'), null);
  assert.equal(classifyPaymentTimingQuoteV4('at a time to be mutually agreed'), null);
});
