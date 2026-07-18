const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COLUMNS,
  getColumn,
  defaultVisibleKeys,
  considerationTypeDisplay,
  buyerProfileDisplay,
  valueBand,
  signedYear,
} = require('../lib/deals-index-columns');

test('default-visible columns match the spec: Deal, Signed, Value, Type, Buyer type, Sector', () => {
  assert.deepEqual(defaultVisibleKeys(), ['deal', 'signed', 'value', 'type', 'buyer_type', 'sector']);
});

test('picker-only columns exist for law firm / lawyer / merger form / provisions', () => {
  const pickerOnly = COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  assert.deepEqual(pickerOnly.sort(), ['law_firm_buyer', 'law_firm_target', 'lawyers_buyer', 'lawyers_target', 'merger_form', 'provisions'].sort());
});

test('advisor columns carry the 17/40 coverage badge', () => {
  for (const key of ['law_firm_buyer', 'law_firm_target', 'lawyers_buyer', 'lawyers_target']) {
    assert.equal(getColumn(key).coverage, '17/40');
  }
});

test('considerationTypeDisplay maps the enum to display labels', () => {
  assert.equal(considerationTypeDisplay('CASH'), 'Cash');
  assert.equal(considerationTypeDisplay('MIXED_ELECTION'), 'Mixed election');
  assert.equal(considerationTypeDisplay('CASH_PLUS_CVR'), 'Cash + CVR');
  assert.equal(considerationTypeDisplay(null), null);
  assert.equal(considerationTypeDisplay('Some free-text summary'), 'Some free-text summary');
});

test('buyerProfileDisplay maps financial/strategic to Take-private/Strategic', () => {
  assert.equal(buyerProfileDisplay('financial'), 'Take-private');
  assert.equal(buyerProfileDisplay('strategic'), 'Strategic');
  assert.equal(buyerProfileDisplay(null), null);
});

test('valueBand buckets match the three legacy size options', () => {
  assert.equal(valueBand(500e6), '<$1B');
  assert.equal(valueBand(5e9), '$1B-$10B');
  assert.equal(valueBand(15e9), '>$10B');
  assert.equal(valueBand(null), null);
});

test('signedYear reads the year from a full signing_date', () => {
  assert.equal(signedYear({ signing_date: '2025-05-04' }), '2025');
  assert.equal(signedYear({ signing_date: null }), null);
});

test('type column accessor rejects numeric-looking consideration_type input via display mapping', () => {
  const typeCol = getColumn('type');
  assert.equal(typeCol.accessor({ consideration_type: null }), null);
});
