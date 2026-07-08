// Adapter polish (parity audit follow-up): scalar object-valued attributes
// (registry valueType 'object' with no taxonomy dictionary, e.g.
// interestOnLatePayment "object { rate, base }") must render as structured
// fields, not a raw JSON blob; tagged values must never double the raw
// canonical code onto the read-view display string. See
// lib/queries/claims-adapter.js and components/review/table-configs/
// card-utils.js#valueText.
//
// NOTE: this file lives at the top level of tests/ (not tests/queries/)
// because `npm test` runs `node --test tests/*.test.js "tests/**/*.spec.js"`,
// which does not pick up tests/queries/*.test.js. tests/queries/claims-adapter.test.js
// carries the equivalent adapter-only assertions for anyone running that
// directory directly; this file is what the CI gate actually exercises.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  buildFeaturesForCard,
  isStructuredObjectAttribute,
  isTaggedRegistryEntry,
} = require('../lib/queries/claims-adapter');
const { FEATURES } = require('../lib/schema/features');

function claim(overrides = {}) {
  return {
    id: overrides.id || 'claim-1',
    excerpt_id: overrides.excerpt_id || 'card-1:0',
    attribute: overrides.attribute,
    verbatim: overrides.verbatim ?? null,
    evidence_quote: overrides.evidence_quote ?? null,
    canonical: overrides.canonical ?? null,
    created_at: overrides.created_at || '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

let cardUtils;
test.before(async () => {
  cardUtils = await import(path.join('..', 'components', 'review', 'table-configs', 'card-utils.js'));
});

// --- Registry sanity: confirm the scalar/list object split this fix relies on ---

test('interestOnLatePayment is a SCALAR object-valued attribute with no taxonomy dictionary', () => {
  const entry = FEATURES.interestOnLatePayment;
  assert.equal(entry.valueType, 'object');
  assert.notEqual(entry.valueType, 'list');
  assert.equal(isTaggedRegistryEntry(entry, 'interestOnLatePayment'), false);
  assert.equal(isStructuredObjectAttribute(entry, 'interestOnLatePayment'), true);
});

test('mergerForm is a SCALAR object-valued attribute that IS taxonomy-coded (stays tagged)', () => {
  const entry = FEATURES.mergerForm;
  assert.equal(entry.valueType, 'object');
  assert.equal(isTaggedRegistryEntry(entry, 'mergerForm'), true);
  assert.equal(isStructuredObjectAttribute(entry, 'mergerForm'), false);
});

// --- Bug 1: scalar object-valued attributes must parse into structured fields ---

test('scalar object-valued attribute (interestOnLatePayment) with JSON verbatim parses into structured fields, not a JSON blob', () => {
  const rawJson = JSON.stringify({ rate: '5% per annum', base: '360-day year' });
  const features = buildFeaturesForCard([
    claim({
      attribute: 'interestOnLatePayment',
      verbatim: rawJson,
      evidence_quote: 'interest shall accrue at a rate of 5% per annum, calculated on the basis of a 360-day year',
    }),
  ]);

  const value = features.interestOnLatePayment;
  assert.equal(Array.isArray(value), false, 'scalar attribute must not be wrapped in an array');
  assert.equal(typeof value, 'object');
  assert.equal(value.rate, '5% per annum');
  assert.equal(value.base, '360-day year');
  assert.deepEqual(value.quotes, ['interest shall accrue at a rate of 5% per annum, calculated on the basis of a 360-day year']);

  // The read-view render must show the parsed fields, never the raw JSON string.
  const rendered = cardUtils.valueText(value);
  assert.ok(rendered, 'renders something');
  assert.ok(!rendered.includes('{'), `read-view render must not leak raw JSON, got: ${rendered}`);
  assert.match(rendered, /5% per annum/);
  assert.match(rendered, /360-day year/);
});

test('scalar object-valued attribute falls back gracefully when verbatim is not valid JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'interestOnLatePayment',
      verbatim: 'interest accrues at the prime rate plus 2%',
      evidence_quote: 'interest accrues at the prime rate plus 2%',
    }),
  ]);
  const value = features.interestOnLatePayment;
  assert.equal(value.text, 'interest accrues at the prime rate plus 2%');
  assert.equal(cardUtils.valueText(value), 'interest accrues at the prime rate plus 2%');
});

test('list-item object attributes (materialContractsDollarThresholds) are unaffected by the scalar-object change', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'materialContractsDollarThresholds',
      verbatim: JSON.stringify({ bucket: 'INDEBTEDNESS', threshold: '$10,000,000', text: 'in excess of $10,000,000' }),
      evidence_quote: 'Contracts involving indebtedness in excess of $10,000,000',
    }),
  ]);
  assert.ok(Array.isArray(features.materialContractsDollarThresholds));
  const [item] = features.materialContractsDollarThresholds;
  assert.equal(item.bucket, 'INDEBTEDNESS');
  assert.equal(item.threshold, '$10,000,000');
});

// --- Bug 2: tagged read-view pills must not double "Label: CODE" ---

test('tagged value with a known code renders label-only in read mode (no "Label: CODE" doubling)', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'mergerForm',
      canonical: 'ONE_STEP_MERGER',
      verbatim: 'ONE_STEP_MERGER', // backfill echoed the code itself as verbatim
      evidence_quote: 'the Company shall merge with and into Merger Sub',
    }),
  ]);
  const value = features.mergerForm;
  assert.equal(value.code, 'ONE_STEP_MERGER', 'raw code stays on the data for edit-mode/card-view consumers');
  assert.equal(value.label, 'One-step merger');

  const rendered = cardUtils.valueText(value);
  assert.equal(rendered, 'One-step merger', 'read view must show the friendly label only');
  assert.ok(!rendered.includes('ONE_STEP_MERGER'), 'raw code must not leak into the read-view string');
});

test('tagged value resolves its code from a raw-code-shaped verbatim when canonical is null (claims backfill gap)', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'mergerForm',
      canonical: null,
      verbatim: 'REVERSE_TRIANGULAR_MERGER', // synonym regexes expect prose, not the bare enum
      evidence_quote: 'Merger Sub shall merge with and into the Company, with the Company surviving',
    }),
  ]);
  const value = features.mergerForm;
  assert.equal(value.code, 'REVERSE_TRIANGULAR_MERGER');
  assert.equal(value.label, 'Reverse triangular merger');

  const rendered = cardUtils.valueText(value);
  assert.equal(rendered, 'Reverse triangular merger');
  assert.ok(!rendered.includes('REVERSE_TRIANGULAR_MERGER'), 'raw code must not double onto the label');
});

test('tagged value keeps genuinely distinct supporting text (no over-suppression)', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'effortsStandard',
      canonical: 'REASONABLE_BEST_EFFORTS',
      verbatim: 'reasonable best efforts',
      evidence_quote: 'Company shall use its reasonable best efforts to consummate the Merger',
    }),
  ]);
  const rendered = cardUtils.valueText(features.effortsStandard);
  assert.equal(rendered, 'Reasonable best efforts: reasonable best efforts');
});
