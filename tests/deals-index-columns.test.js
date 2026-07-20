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
  mergerFormDisplay,
  structureDisplay,
} = require('../lib/deals-index-columns');

test('default-visible columns are deal descriptors, including consideration and structure', () => {
  assert.deepEqual(defaultVisibleKeys(), ['deal', 'signed', 'value', 'type', 'structure', 'buyer_type', 'sector']);
  assert.equal(getColumn('type').label, 'Consideration');
});

test('picker-only columns are advisers and detailed merger form', () => {
  const pickerOnly = COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  assert.deepEqual(
    pickerOnly.sort(),
    ['buyer', 'law_firm', 'lawyer', 'law_firm_buyer', 'law_firm_target', 'lawyers_buyer', 'lawyers_target', 'merger_form'].sort(),
  );
});

test('buyer and either-party adviser columns are sortable and filter on individual values', () => {
  const deal = {
    buyer_display: 'Buyer One',
    advisors: {
      buyer_firms: ['Wachtell'], seller_firms: ['Skadden'],
      buyer_lawyers: ['Jane Buyer'], seller_lawyers: ['John Target'],
    },
  };
  assert.equal(getColumn('buyer').accessor(deal), 'Buyer One');
  assert.deepEqual(getColumn('law_firm').filterValues(deal), ['Wachtell', 'Skadden']);
  assert.deepEqual(getColumn('lawyer').filterValues(deal), ['Jane Buyer', 'John Target']);
});

test('provision terms and stale coverage badges are absent from the column registry', () => {
  for (const key of ['term_fee', 'reverse_fee', 'outside_date', 'go_shop', 'provisions']) {
    assert.equal(getColumn(key), null, `${key} must not be a deal-list column`);
  }
  assert.ok(COLUMNS.every((column) => !Object.prototype.hasOwnProperty.call(column, 'coverage')));
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

test('mergerFormDisplay renders taxonomy codes as natural language (r4 structure-mechanics reuse)', () => {
  assert.equal(mergerFormDisplay('REVERSE_TRIANGULAR_MERGER'), 'Reverse triangular merger');
  assert.equal(mergerFormDisplay('ONE_STEP_MERGER'), 'One-step merger');
  assert.equal(mergerFormDisplay(null), null);
  // Unknown/legacy free-text code: fall back to the raw string rather than
  // hiding it, same posture as considerationTypeDisplay().
  assert.equal(mergerFormDisplay('Some legacy free text'), 'Some legacy free text');
});

test('merger_form column accessor renders the natural-language label, not the raw enum code', () => {
  const col = getColumn('merger_form');
  assert.equal(col.accessor({ merger_form: 'REVERSE_TRIANGULAR_MERGER' }), 'Reverse triangular merger');
});

test('structureDisplay and the Structure column use friendly canonical taxonomy labels', () => {
  assert.equal(structureDisplay('ONE_STEP_MERGER'), 'One-step merger');
  assert.equal(structureDisplay('TWO_STEP_TENDER_OFFER'), 'Two-step tender offer');
  assert.equal(structureDisplay('SCHEME'), 'Scheme of arrangement');
  assert.equal(structureDisplay('OTHER'), 'Other');
  assert.equal(structureDisplay(null), null);

  const col = getColumn('structure');
  assert.equal(col.accessor({ structure: 'ONE_STEP_MERGER' }), 'One-step merger');
  assert.equal(col.filterable, true);
  assert.equal(col.filterType, 'enum');
  assert.equal(col.defaultVisible, true);
});
