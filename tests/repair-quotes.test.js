/* Tests for scripts/repair-quotes.js helpers — deterministic near-miss quote
   repairs. Run: npm test (node --test tests/) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeForMatch } = require('../lib/verification');
const {
  locateNormSpan,
  findRawSpan,
  rewriteQuotes,
  stripPipelineMarkers,
} = require('../scripts/repair-quotes');

// ── locateNormSpan: uniqueness is a hard gate ─────────────────────────────

const NORM_SRC = normalizeForMatch(
  'Section 5.06. Fees. The Company shall pay the fee within two Business Days. '
  + 'Section 8.10. Remedies. The parties hereto acknowledge and agree that either party seeking an injunction '
  + 'shall not be required to provide any bond or other security in connection with any such order. '
  + 'Section 9.01. Notices. All notices shall be in writing.',
);

test('locateNormSpan finds a unique start+end span', () => {
  const span = locateNormSpan(
    NORM_SRC,
    'The parties hereto acknowledge and agree',
    'any bond or other security in connection with any such order.',
    400,
  );
  assert.equal(span.error, undefined);
  const text = NORM_SRC.slice(span.ns, span.ne);
  assert.ok(text.startsWith('the parties hereto acknowledge'));
  assert.ok(text.endsWith('any such order.'));
});

test('locateNormSpan rejects an ambiguous start anchor', () => {
  const span = locateNormSpan(NORM_SRC, 'Section', null);
  assert.match(span.error, /spanStart occurs \d+x/);
});

test('locateNormSpan rejects a missing end anchor within the window', () => {
  const span = locateNormSpan(
    NORM_SRC,
    'The parties hereto acknowledge and agree',
    'this phrase does not exist in the source at all',
    400,
  );
  assert.match(span.error, /spanEnd occurs 0x/);
});

test('locateNormSpan without spanEnd returns the start phrase itself', () => {
  const span = locateNormSpan(NORM_SRC, 'All notices shall be in writing.', null);
  assert.equal(NORM_SRC.slice(span.ns, span.ne), 'all notices shall be in writing.');
});

// ── findRawSpan: normalized span → verbatim raw substring ─────────────────

test('findRawSpan recovers the verbatim raw span across markers and typography', () => {
  const raw =
    'preamble text here. [[SECTION]]Section 8.10[[/SECTION]] The parties hereto agree that the “Company’s” obligations '
    + 'under [[REF]]Section 5.06[[/REF]] survive the Closing — in all respects. Trailing text follows.';
  const norm = normalizeForMatch(raw);
  const startN = normalizeForMatch('The parties hereto agree that the Companys obligations');
  const ns = norm.indexOf(startN);
  assert.ok(ns > 0);
  const endN = normalizeForMatch('in all respects.');
  const ne = norm.indexOf(endN) + endN.length;
  const got = findRawSpan(raw, norm, ns, ne);
  assert.ok(got, 'span should be found');
  assert.ok(raw.includes(got), 'result must be a verbatim substring of raw');
  assert.ok(got.startsWith('The parties hereto agree'));
  assert.ok(got.endsWith('in all respects.'));
  // Round-trip: the raw span normalizes back to exactly the target.
  assert.equal(normalizeForMatch(got), norm.slice(ns, ne));
});

test('stripPipelineMarkers removes markers without disturbing agreement text', () => {
  assert.equal(
    stripPipelineMarkers('pursuant to [[REF]]Section 8.1(b)(ii)[[/REF]] (End Date) «or» later'),
    'pursuant to Section 8.1(b)(ii) (End Date) or later',
  );
});

// ── rewriteQuotes: touches quote-bearing fields only ───────────────────────

test('rewriteQuotes replaces in quotes arrays and citable/tagged text, reports paths', () => {
  const features = {
    fee: { value: '$1m', quotes: ['a fee of one million payable at close'] },
    remedy: { value: true, text: 'a fee of one million payable at close' },
    tagged: [{ code: 'X', label: 'x', text: 'unrelated tagged text stays put' }],
    mainConcept: 'a fee of one million payable at close', // plain value — NOT a quote
  };
  const { features: out, paths } = rewriteQuotes(
    features,
    'one million payable',
    'one million ($1,000,000) payable',
  );
  assert.deepEqual(paths.sort(), ['fee.quotes[0]', 'remedy.text']);
  assert.equal(out.fee.quotes[0], 'a fee of one million ($1,000,000) payable at close');
  assert.equal(out.remedy.text, 'a fee of one million ($1,000,000) payable at close');
  assert.equal(out.mainConcept, 'a fee of one million payable at close'); // untouched
  assert.equal(out.tagged[0].text, 'unrelated tagged text stays put');
  // Input is not mutated.
  assert.equal(features.fee.quotes[0], 'a fee of one million payable at close');
});
