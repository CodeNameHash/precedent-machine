'use strict';

/**
 * tests/canonical-v2-share-count-parse.test.js
 *
 * Acceptance test 1 (docs/superpowers/specs/2026-08-02-p1-captable-
 * numerics-design.md, section 5): table-driven over the COVERAGE MAP's
 * hand-enumerated split sub-quotes AND the parent compound quotes (parents
 * ABSTAIN MULTIPLE_NUMERIC_LITERALS), run on the LITERAL committed fixture
 * bytes (LTR marks included, never retyped); every exclusion class
 * exercised; strict-grouping rejects; NO_NUMERIC_LITERAL; NON_LITERAL_
 * NUMERAL; the count_kind-keyed zero table (every fixture zero resolves
 * under its correct kind, ZERO_PATTERN_KIND_MISMATCH on cross-kind, and
 * near-misses do not resolve).
 *
 * Every real-fixture quote used here is loaded from the committed fixture
 * JSON/bytes at test time (never retyped) -- see loadCanonicalText/
 * loadOpenWorldEntry below.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SHARE_COUNT_PARSE_VERSION,
  ZERO_PATTERN_TABLE_VERSION,
  ZERO_PATTERN_TABLE,
  parseShareCount,
} = require('../lib/canonical-v2/native-producer/share-count-parse');

function loadFixture(dealDir, name) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', dealDir, name), 'utf8'),
  );
}

function loadCanonicalText(dealDir) {
  const adapterResult = loadFixture(dealDir, 'adapter-result.json');
  return adapterResult.admitted_source_contexts[0].canonical_text.text;
}

// Pulls a real open_world entry's raw_value by closure_id -- never retyped,
// always the literal committed fixture bytes.
function loadOpenWorldQuote(dealDir, closureId) {
  const resolution = loadFixture(dealDir, 'resolution.json');
  const entry = resolution.open_world.find((item) => item.closure_id === closureId);
  assert.ok(entry, `expected an open_world entry with closure_id ${closureId} in ${dealDir}`);
  return entry.raw_value;
}

// Locates the FIRST digit-led numeral run (the count's own token) inside
// canonicalText[start, end) and returns its own absolute span. Throws (via
// assert) if none exists -- a caller asking for anchored overlap on a
// quote with no numeral at all is a test-authoring bug, not a soft case.
function firstNumericTokenSpan(canonicalText, start, end) {
  const slice = canonicalText.slice(start, end);
  const match = /\d[\d,.]*/.exec(slice);
  assert.ok(match, `expected a numeric token inside canonicalText[${start},${end})`);
  const tokenStart = start + match.index;
  return { start: tokenStart, end: tokenStart + match[0].length, text: match[0] };
}

// Anchored-overlap helper (spec's coverage-map pin, Fable review finding
// F-2): POSITIONAL, not merely two independent `.includes()` checks. Both
// `subQuote` and `parentQuote` are located in `canonicalText` by absolute
// byte offset; the sub-quote's own numeric-count token is located within
// its span; and that exact token span is asserted to fall INSIDE the
// parent quote's own span, in the SAME canonical-text coordinate frame --
// i.e. the sub-quote's count token and the parent's count token are the
// same bytes at the same place, not merely two strings that each happen to
// appear somewhere in a 400K-character document.
function assertAnchoredOverlap(canonicalText, subQuote, parentQuote) {
  const subStart = canonicalText.indexOf(subQuote);
  assert.ok(subStart >= 0, 'sub-quote must be a byte-verified substring of the canonical text');
  const subEnd = subStart + subQuote.length;

  const parentStart = canonicalText.indexOf(parentQuote);
  assert.ok(parentStart >= 0, 'parent quote must be a byte-verified substring of the canonical text');
  const parentEnd = parentStart + parentQuote.length;

  const token = firstNumericTokenSpan(canonicalText, subStart, subEnd);
  assert.ok(
    token.start >= parentStart && token.end <= parentEnd,
    `numeric token [${token.start},${token.end}) ("${token.text}") of sub-quote "${subQuote}" must sit inside `
      + `the parent quote's own span [${parentStart},${parentEnd}) ("${parentQuote.slice(0, 60)}...") -- `
      + 'two independent .includes() checks are not enough (Fable review finding F-2)',
  );
}

const F28_DIR = 'f28-third-live-run';
const SKECHERS_DIR = 'skechers-first-live-run';
const MODIV_DIR = 'modiv-first-live-run';

test('SHARE_COUNT_PARSE_VERSION and ZERO_PATTERN_TABLE_VERSION are exported, versioned constants', () => {
  assert.equal(SHARE_COUNT_PARSE_VERSION, 1);
  assert.equal(ZERO_PATTERN_TABLE_VERSION, 1);
  assert.ok(Array.isArray(ZERO_PATTERN_TABLE) && ZERO_PATTERN_TABLE.length > 0);
});

// ---------------------------------------------------------------------------
// Coverage map: F28 (C1 cluster) -- hand-enumerated SPLIT sub-quotes,
// anchored to the real closure_id C1 parent quotes.
// ---------------------------------------------------------------------------

test('F28 C1: AUTHORIZED sub-quote resolves 250000000 (Company Shares, real fixture bytes)', () => {
  const text = loadCanonicalText(F28_DIR);
  const subQuote = 'The authorized capital stock of the Company consists of (A) 250,000,000 Company Shares';
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '7ec6ef38a8d6b66bb6b48b32d813bf1642f6466fee5571c8041bc50270aa60fe',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({ quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares' });
  assert.deepEqual(result, {
    outcome: 'RESOLVED', canonical_value: '250000000', matched_text: '250,000,000',
  });
});

test('F28 C1: ISSUED_OUTSTANDING sub-quote resolves 28142327, excluding the calendar date "April 17, 2026"', () => {
  const text = loadCanonicalText(F28_DIR);
  const subQuote = '28,142,327 Company Shares were outstanding as of the close of business on April 17, 2026';
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '7ec6ef38a8d6b66bb6b48b32d813bf1642f6466fee5571c8041bc50270aa60fe',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'ISSUED_OUTSTANDING', share_class_ref: 'Company Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '28142327');
});

test('F28 C1: OUTSTANDING_AWARDS sub-quote resolves 119994 ("Restricted Stock Awards")', () => {
  const text = loadCanonicalText(F28_DIR);
  const subQuote = '119,994 Company Shares subject to Company Restricted Stock Awards';
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '7ec6ef38a8d6b66bb6b48b32d813bf1642f6466fee5571c8041bc50270aa60fe',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'OUTSTANDING_AWARDS', share_class_ref: 'Company Shares',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '119994', matched_text: '119,994' });
});

test('F28 C1: RESERVED sub-quote resolves 1600514, excluding "2015" inside the plan_ref span', () => {
  const text = loadCanonicalText(F28_DIR);
  const start = text.indexOf('other than 1,600,514 Company Shares reserved');
  assert.ok(start >= 0);
  const subQuoteStart = start + 'other than '.length;
  const planEnd = text.indexOf(')', text.indexOf('A&R 2015 Plan', subQuoteStart)) + 1;
  const subQuote = text.slice(subQuoteStart, planEnd);
  assert.ok(subQuote.startsWith('1,600,514 Company Shares reserved for issuance under the Company'));
  assert.ok(subQuote.includes('A&R 2015 Plan'));
  const planRef = subQuote.slice(subQuote.indexOf('the Company'));
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '57736a8800ed65fcddea0911ece4fd9db81efd93613343edf6ada5ecd3673bb3',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'RESERVED', share_class_ref: 'Company Shares', plan_ref: planRef,
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '1600514');
});

test('F28 C1: the parent compound quote (idx1, "(A) 250,000,000 ... of which 28,142,327 ... (119,994 ...)") ABSTAINs MULTIPLE_NUMERIC_LITERALS', () => {
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '7ec6ef38a8d6b66bb6b48b32d813bf1642f6466fee5571c8041bc50270aa60fe',
  );
  const result = parseShareCount({ quote: parentQuote, count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares' });
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'MULTIPLE_NUMERIC_LITERALS' });
});

// ---------------------------------------------------------------------------
// AMBIGUOUS_LITERAL_AND_ZERO precedence pin (re-audit finding 3) -- the
// exact F28 preferred quote: "10,000,000 shares of preferred stock ...
// none of which were outstanding".
// ---------------------------------------------------------------------------

test('F28: the preferred-stock parent quote (idx2) is the flagship AMBIGUOUS_LITERAL_AND_ZERO case when count_kind is ISSUED_OUTSTANDING', () => {
  const text = loadCanonicalText(F28_DIR);
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '3e0ca2109043920cf37b6f6e095aadd006f109c25561e2753eb0644361fbcd24',
  );
  assert.ok(text.includes(parentQuote));
  assert.equal(parentQuote, '10,000,000 shares of preferred stock, par value $0.01 per share, none of which were outstanding as of the date hereof');
  const result = parseShareCount({
    quote: parentQuote,
    count_kind: 'ISSUED_OUTSTANDING',
    share_class_ref: 'preferred stock, par value $0.01 per share',
  });
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'AMBIGUOUS_LITERAL_AND_ZERO' });
});

test('F28: the SAME clause, quoted as AUTHORIZED (no zero-pattern-kind match), resolves the literal 10000000 -- precedence is per-count_kind, not per-quote', () => {
  const parentQuote = loadOpenWorldQuote(
    F28_DIR, '3e0ca2109043920cf37b6f6e095aadd006f109c25561e2753eb0644361fbcd24',
  );
  const result = parseShareCount({
    quote: parentQuote,
    count_kind: 'AUTHORIZED',
    share_class_ref: 'preferred stock, par value $0.01 per share',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '10000000', matched_text: '10,000,000' });
});

test('F28: the SPLIT-off zero-only sub-quote ("none of which were outstanding") resolves to 0 under ISSUED_OUTSTANDING, real fixture bytes', () => {
  const text = loadCanonicalText(F28_DIR);
  const subQuote = 'shares of preferred stock, par value $0.01 per share, none of which were outstanding as of the date hereof';
  assert.ok(text.includes(subQuote));
  const result = parseShareCount({
    quote: subQuote,
    count_kind: 'ISSUED_OUTSTANDING',
    share_class_ref: 'preferred stock, par value $0.01 per share',
  });
  assert.deepEqual(result, {
    outcome: 'RESOLVED', canonical_value: '0', matched_text: 'none of which were outstanding',
  });
});

// ---------------------------------------------------------------------------
// Skechers coverage-map sub-quotes (C1/C9 + treasury zero).
// ---------------------------------------------------------------------------

test('Skechers C1: AUTHORIZED Class A sub-quote resolves 500000000', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const subQuote = 'The authorized capital stock of the Company consists of (i) 500,000,000 shares of Company Class A Common Stock';
  assert.ok(text.includes(subQuote));
  const result = parseShareCount({
    quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'Company Class A Common Stock',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '500000000', matched_text: '500,000,000' });
});

test('Skechers C1: ISSUED_OUTSTANDING Class A sub-quote resolves 130289468', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const subQuote = '130,289,468 shares of Company Class A Common Stock were issued and outstanding';
  const parentQuote = loadOpenWorldQuote(
    SKECHERS_DIR, 'c5cc993c1356248f25a3c3259d82b23c7eabaa2b55aa25c8710e1de86b29fe49',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  assert.equal(subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'ISSUED_OUTSTANDING', share_class_ref: 'Company Class A Common Stock',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '130289468', matched_text: '130,289,468' });
});

test('Skechers: preferred-stock zero ("(C) no shares ... were issued and outstanding") resolves to 0 under ISSUED_OUTSTANDING', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const subQuote = '(C) no shares of Company Preferred Stock were issued and outstanding';
  assert.ok(text.includes(subQuote));
  const result = parseShareCount({
    quote: subQuote, count_kind: 'ISSUED_OUTSTANDING', share_class_ref: 'Company Preferred Stock',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '0');
});

test('Skechers zero: TREASURY ("no shares ... were held by the Company as treasury shares") resolves to 0, real fixture bytes, own closure_id', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const parentQuote = loadOpenWorldQuote(
    SKECHERS_DIR, 'e40c41100a121238c88741ddf1fcd2ca0b6fa13c17c64f7a8f3f0bb469b5581a',
  );
  assert.equal(parentQuote, 'no shares of Company Common Stock were held by the Company as treasury shares');
  assert.ok(text.includes(parentQuote));
  const result = parseShareCount({ quote: parentQuote, count_kind: 'TREASURY', share_class_ref: 'Company Common Stock' });
  assert.deepEqual(result, {
    outcome: 'RESOLVED', canonical_value: '0', matched_text: 'held by the Company as treasury',
  });
});

test('Skechers zero: the TREASURY sentence, mis-parsed under RESERVED, ABSTAINs ZERO_PATTERN_KIND_MISMATCH (never publishes under the wrong kind)', () => {
  const quote = 'no shares of Company Common Stock were held by the Company as treasury shares';
  const result = parseShareCount({ quote, count_kind: 'RESERVED', share_class_ref: 'Company Common Stock' });
  assert.deepEqual(result, {
    outcome: 'ABSTAIN', reason: 'ZERO_PATTERN_KIND_MISMATCH', matched_text: 'held by the Company as treasury',
    zero_pattern_kind: 'TREASURY',
  });
});

test('Skechers C8/C11: RESERVED (Company ESPP) sub-quote resolves 3360412 with plan_ref "the Company ESPP"', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const subQuote = '3,360,412 shares of Company Common Stock reserved and available for issuance under the Company ESPP';
  const parentQuote = loadOpenWorldQuote(
    SKECHERS_DIR, 'f974f1704f6e9c14091721f23f3cc4b295c0a583e9c3c606ecd0c16226ee4b57',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'RESERVED', share_class_ref: 'Company Common Stock', plan_ref: 'the Company ESPP',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '3360412', matched_text: '3,360,412' });
});

test('Skechers C8/C11: RESERVED (Equity Plans) sub-quote resolves 4682006 with plan_ref "the Company Equity Plans"', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const subQuote = 'the Company has reserved 4,682,006 shares of Company Common Stock for issuance pursuant to the Company Equity Plans.';
  const parentQuote = loadOpenWorldQuote(
    SKECHERS_DIR, '19619bc8b6c1680fe2c491edb56a71745d83aa919592853ec581d3d4b7b6f972',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote,
    count_kind: 'RESERVED',
    share_class_ref: 'Company Common Stock',
    plan_ref: 'the Company Equity Plans',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '4682006', matched_text: '4,682,006' });
});

test('Skechers: OUTSTANDING_AWARDS (RSUs) sub-quote resolves 2653056, word-bounded case-sensitive RSU corroboration exercised at the resolver layer, parser resolves the literal here', () => {
  const text = loadCanonicalText(SKECHERS_DIR);
  const subQuote = 'Company RSUs representing the right to receive up to 2,653,056 shares of Company Common Stock';
  const parentQuote = loadOpenWorldQuote(
    SKECHERS_DIR, '93cbc6001e290387f34a19c4d49adef6adf6ca774eb7d876c4a873224d2f55bd',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'OUTSTANDING_AWARDS', share_class_ref: 'Company Common Stock',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '2653056', matched_text: '2,653,056' });
});

// ---------------------------------------------------------------------------
// Modiv coverage-map sub-quotes (C1/C9 + reserved zero).
// ---------------------------------------------------------------------------

test('Modiv C1: AUTHORIZED (450,000,000 shares of stock) sub-quote resolves 450000000', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = 'The authorized capital stock of the Company consists of 450,000,000 shares of stock';
  assert.ok(text.includes(subQuote));
  // No anchored-overlap check here: "450,000,000" is the CHAPEAU total sum
  // -- it precedes idx0's own raw_value ("400,000,000 Company Common
  // Shares...") in the sentence and is not itself covered by any real
  // open_world closure_id in this fixture, so there is no parent quote to
  // anchor against without inventing one. Real fixture bytes, verified as
  // a substring, honestly reported as having no fixture parent.
  const result = parseShareCount({ quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'shares of stock' });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '450000000', matched_text: '450,000,000' });
});

test('Modiv C1: AUTHORIZED Class C sub-quote ("300,000,000 shares are classified as Class C Common Shares") resolves 300000000', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = '300,000,000 shares are classified as Class C Common Shares';
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, '0e86bf8f309968740e7f60531b0578515ba9587866f96a6cfbd98747784bfef4',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'Class C Common Shares',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '300000000', matched_text: '300,000,000' });
});

test('Modiv C1: AUTHORIZED Class S sub-quote resolves 100000000', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = '100,000,000 shares are classified as Class S Common Shares';
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, '0e86bf8f309968740e7f60531b0578515ba9587866f96a6cfbd98747784bfef4',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'Class S Common Shares',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '100000000', matched_text: '100,000,000' });
});

test('Modiv C1: AUTHORIZED preferred sub-quote resolves 50000000', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = '50,000,000 shares of preferred stock, par value $0.001 per share';
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, '3be1e76f6e0183d7b9c562d7e5c51db56d3feb654f8a74c18d2db5232cb0a38c',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'preferred stock, par value $0.001 per share',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '50000000', matched_text: '50,000,000' });
});

test('Modiv: "1,677,588 shares are classified and designated as Company Preferred Shares" does NOT corroborate AUTHORIZED at the parser level (no "classified as" contiguous substring) -- the parser still resolves the literal; corroboration is the resolver\'s own gate, exercised in the resolution test file', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = '1,677,588 shares are classified and designated as Company Preferred Shares';
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, '3be1e76f6e0183d7b9c562d7e5c51db56d3feb654f8a74c18d2db5232cb0a38c',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  assert.equal(/classified as/i.test(subQuote), false, 'sanity: this real drafting variant breaks the contiguous "classified as" corroboration pattern');
  const result = parseShareCount({
    quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: 'Company Preferred Shares',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '1677588', matched_text: '1,677,588' });
});

test('Modiv C1: ISSUED_OUTSTANDING Class C sub-quote resolves 10323670', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = '10,323,670 Class C Common Shares were issued and outstanding,';
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, 'beb1daa34811e61e000d1497beade47bd1245921c3e81edaf899ca5867781897',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  assert.equal(subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'ISSUED_OUTSTANDING', share_class_ref: 'Class C Common Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '10323670');
});

test('Modiv: "no Class S Common Shares were issued and outstanding" resolves to 0 under ISSUED_OUTSTANDING', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = 'no Class S Common Shares were issued and outstanding';
  assert.ok(text.includes(subQuote));
  const result = parseShareCount({
    quote: subQuote, count_kind: 'ISSUED_OUTSTANDING', share_class_ref: 'Class S Common Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '0');
});

test('Modiv C9: preferred ISSUED_OUTSTANDING sub-quote resolves 1677588', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const subQuote = '1,677,588 shares of Company Preferred Shares were issued and outstanding.';
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, '4586b9f5595876d2217809e71bc508c6e3ed5422698f2e0cd37f2b04cdefb2ec',
  );
  assertAnchoredOverlap(text, subQuote, parentQuote);
  const result = parseShareCount({
    quote: subQuote, count_kind: 'ISSUED_OUTSTANDING', share_class_ref: 'Company Preferred Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '1677588');
});

test('Modiv zero: RESERVED ("the Company had no Company Common Shares or Company Preferred Shares reserved for issuance") resolves to 0 at the PARSER layer (the resolver\'s own plan_ref gate is a separate, resolver-level test)', () => {
  const text = loadCanonicalText(MODIV_DIR);
  const parentQuote = loadOpenWorldQuote(
    MODIV_DIR, '363955ceb0636483050a20a6db0c6ccfe113b671c71f375d024ab64994f327e8',
  );
  assert.ok(text.includes(parentQuote));
  const result = parseShareCount({
    quote: parentQuote, count_kind: 'RESERVED', share_class_ref: 'Company Preferred Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '0');
});

test('near-miss: "no obligation to reserve" does NOT match the RESERVED zero pattern', () => {
  const result = parseShareCount({ quote: 'The Company has no obligation to reserve additional shares.', count_kind: 'RESERVED' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NO_NUMERIC_LITERAL');
});

// ---------------------------------------------------------------------------
// Every exclusion class, exercised directly (synthetic but grammar-faithful
// inputs -- the fixture-bytes obligation is specifically for the section-
// reference LTR-mark grammar, exercised below against real F28 bytes).
// ---------------------------------------------------------------------------

test('exclusion: calendar date via CALENDAR_DATE_PATTERN reuse', () => {
  const result = parseShareCount({
    quote: '250,000,000 Company Shares as of April 17, 2026', count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '250000000');
});

test('exclusion: currency-prefixed literal ($0.01) does not count as a second survivor', () => {
  const result = parseShareCount({
    quote: '250,000,000 shares, $0.01 par value', count_kind: 'AUTHORIZED', share_class_ref: 'shares, $0.01 par value',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '250000000');
});

test('exclusion: clock time ("5:00 p.m.") does not count as a survivor', () => {
  const result = parseShareCount({
    quote: '5:00 p.m. on 250,000,000 Company Shares', count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares',
  });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '250000000');
});

test('exclusion: numbers inside share_class_ref/plan_ref spans ("$0.01 par value" inside the class phrase)', () => {
  const result = parseShareCount({
    quote: '10,000,000 shares of preferred stock, par value $0.01 per share',
    count_kind: 'AUTHORIZED',
    share_class_ref: 'preferred stock, par value $0.01 per share',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '10000000', matched_text: '10,000,000' });
});

// The section-reference exclusion is exercised directly against the literal
// F28 bytes (U+200E marks) via the fixture's own known closure_id, without
// combining it with a share count in the same quote (no real F28 sentence
// does that) -- section references simply must never be misread as a share
// count on their own.
test('exclusion: LTR-mark-tolerant section reference, on the LITERAL F28 fixture bytes ("Section ‎3.1(b)(ii)"), abstains NO_NUMERIC_LITERAL rather than misreading the section number as a count', () => {
  const text = loadCanonicalText(F28_DIR);
  const fullQuote = loadOpenWorldQuote(
    F28_DIR, '22593b534fa9d44374f337c9cb4da9a21dd5778610bc37687877347a81f7c470',
  );
  // Cut before the sentence's OTHER numbers (plan name year, calendar date)
  // -- this test isolates exclusion class 2 (section references) from
  // classes 1/3 (already covered by their own tests above); the cut point
  // is an ASCII anchor, the quote itself (including the LTR mark) is the
  // literal fixture bytes, never retyped.
  const subQuote = fullQuote.slice(0, fullQuote.indexOf('of Company Options')).trimEnd();
  assert.ok(text.includes(subQuote));
  assert.ok(subQuote.includes('‎'), 'sanity: the real fixture bytes carry the LTR mark between "Section" and the number');
  const result = parseShareCount({ quote: subQuote, count_kind: 'AUTHORIZED', share_class_ref: null });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NO_NUMERIC_LITERAL');
});

test('FIXED (Fable review finding F-3): a "Sections X and Y" continuation excludes BOTH references, real F28 bytes, real closure_id -- no longer a live wrong-number path', () => {
  const fullQuote = loadOpenWorldQuote(
    F28_DIR, '751b93616e35a65caf4a8210b7d792094a3e5fde72843c9e0476193c1467b11b',
  );
  assert.equal(fullQuote, 'Except for any obligations pursuant to this Agreement, or as set forth in Sections ‎3.1(b)(i) and ‎3.1(b)(ii), there are no');
  const result = parseShareCount({ quote: fullQuote, count_kind: 'AUTHORIZED', share_class_ref: null });
  // The continuation grammar now excludes the SECOND "‎3.1(b)(ii)" reference
  // too (an "and"-joined follow-on, immediately adjacent to the first
  // reference with only whitespace between) -- both references are
  // excluded, zero survivors, no zero pattern present -> NO_NUMERIC_LITERAL.
  // Previously (finding F-3) this resolved the wrong number '3.1' from the
  // second reference's own leading digits.
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL' });
});

test('negative control: a genuine share count immediately after a single, non-continuation section reference still resolves (the F-3 fix does not over-exclude)', () => {
  const quote = 'Section 3.1(b) of the Agreement, 250,000,000 Company Shares';
  const result = parseShareCount({ quote, count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares' });
  // "of the Agreement" sits between the reference and the comma/count, so
  // the continuation grammar (which requires the conjunction/comma
  // IMMEDIATELY after the reference number, whitespace only) never fires --
  // the real count 250,000,000 survives and resolves normally.
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '250000000', matched_text: '250,000,000' });
});

test('strict grouping rejects "1,23,456" as MALFORMED_GROUPING (no repair)', () => {
  const result = parseShareCount({
    quote: '1,23,456 Company Shares', count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares',
  });
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: '1,23,456' });
});

test('NO_NUMERIC_LITERAL: a quote with no candidate number and no zero pattern', () => {
  const result = parseShareCount({ quote: 'The Company has duly authorized capital stock.', count_kind: 'AUTHORIZED' });
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL' });
});

test('NON_LITERAL_NUMERAL: a spelled-out number ("ten million") never resolves', () => {
  const result = parseShareCount({
    quote: 'ten million shares of Company Shares authorized', count_kind: 'AUTHORIZED', share_class_ref: 'Company Shares',
  });
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
});

test('canonical form pin: preserves a decimal without trailing-zero trimming ("1,600,514.5" -> "1600514.5")', () => {
  const result = parseShareCount({
    quote: '1,600,514.5 Company Shares reserved', count_kind: 'RESERVED', share_class_ref: 'Company Shares',
  });
  assert.deepEqual(result, { outcome: 'RESOLVED', canonical_value: '1600514.5', matched_text: '1,600,514.5' });
});

test('parseShareCount throws on structurally invalid input (missing quote/count_kind), never on prose', () => {
  assert.throws(() => parseShareCount({ count_kind: 'AUTHORIZED' }), TypeError);
  assert.throws(() => parseShareCount({ quote: 'text' }), TypeError);
  assert.doesNotThrow(() => parseShareCount({ quote: 'gibberish prose with no numbers', count_kind: 'AUTHORIZED' }));
});

// F-4 regression block (Fable re-review of the F-3 fix): the earlier
// bare-digit continuation grammar swallowed real counts. These pins hold
// the reference-shape gate in place.
test('F-4: bare count after a single section reference is NOT swallowed ("and" variant resolves)', () => {
  const r = parseShareCount({
    quote: 'Section 3.1 and 250,000,000 Company Shares were issued',
    count_kind: 'ISSUED_OUTSTANDING',
    share_class_ref: 'Company Shares',
    plan_ref: null,
  });
  assert.equal(r.outcome, 'RESOLVED');
  assert.equal(r.canonical_value, '250000000');
});

test('F-4: two-count sentence after a reference ABSTAINs MULTIPLE_NUMERIC_LITERALS, never resolves the wrong survivor', () => {
  const r = parseShareCount({
    quote: 'As set forth in Section 3.1, 250,000,000 shares of Common Stock were issued and outstanding, and 5,000 shares were held in escrow',
    count_kind: 'ISSUED_OUTSTANDING',
    share_class_ref: 'shares of Common Stock',
    plan_ref: null,
  });
  assert.equal(r.outcome, 'ABSTAIN');
  assert.equal(r.reason, 'MULTIPLE_NUMERIC_LITERALS');
  assert.notEqual(r.canonical_value, '5000');
});

test('F-4: comma-adjacent count after a reference abstains conservatively (trailing-comma token, documented), never NO_NUMERIC_LITERAL', () => {
  // The pinned tokenizer keeps the trailing comma on "3.1," so the token is
  // not contained in the excluded reference span -- the quote abstains
  // MULTIPLE_NUMERIC_LITERALS (review), which is the safe direction. It must
  // never be fully swallowed (the F-4 over-exclusion) nor resolve.
  const r = parseShareCount({
    quote: 'Pursuant to Section 3.1, 250,000,000 shares of Common Stock were issued and outstanding',
    count_kind: 'ISSUED_OUTSTANDING',
    share_class_ref: 'shares of Common Stock',
    plan_ref: null,
  });
  assert.equal(r.outcome, 'ABSTAIN');
  assert.equal(r.reason, 'MULTIPLE_NUMERIC_LITERALS');
});
