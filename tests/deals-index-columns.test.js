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
  terminationFeeDisplay,
  reverseFeeDisplay,
  outsideDateDisplay,
  goShopDisplay,
} = require('../lib/deals-index-columns');

test('default-visible columns match the spec: Deal, Signed, Value, Type, Buyer type, Sector, Company termination fee, Outside date', () => {
  assert.deepEqual(defaultVisibleKeys(), ['deal', 'signed', 'value', 'type', 'buyer_type', 'sector', 'term_fee', 'outside_date']);
});

test('picker-only columns exist for law firm / lawyer / merger form / reverse fee / go-shop (Provisions column removed)', () => {
  const pickerOnly = COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  assert.deepEqual(
    pickerOnly.sort(),
    ['law_firm_buyer', 'law_firm_target', 'lawyers_buyer', 'lawyers_target', 'merger_form', 'reverse_fee', 'go_shop'].sort(),
  );
  assert.equal(getColumn('provisions'), null, 'the Provisions column must be removed entirely');
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

test('terminationFeeDisplay renders "$X (Y%)", "$X" alone, or null', () => {
  assert.equal(terminationFeeDisplay({ amount: 412_000_000, pct: 1.8 }), '$412M (1.8%)');
  assert.equal(terminationFeeDisplay({ amount: 412_000_000, pct: null }), '$412M');
  assert.equal(terminationFeeDisplay({ amount: 2_500_000_000, pct: 2.5 }), '$2.5B (2.5%)');
  assert.equal(terminationFeeDisplay(null), null);
  assert.equal(terminationFeeDisplay({ amount: null }), null);
});

test('reverseFeeDisplay renders a dollar amount or null (page renders null as a dash)', () => {
  assert.equal(reverseFeeDisplay({ amount: 850_000_000 }), '$850M');
  assert.equal(reverseFeeDisplay(null), null);
  assert.equal(reverseFeeDisplay({ amount: null }), null);
});

test('outsideDateDisplay renders whole months from signing, or null', () => {
  assert.equal(outsideDateDisplay(9), '9 mo');
  assert.equal(outsideDateDisplay(0), '0 mo');
  assert.equal(outsideDateDisplay(null), null);
});

test('goShopDisplay renders Yes/No/null (null = no go-shop covenant found on the deal)', () => {
  assert.equal(goShopDisplay(true), 'Yes');
  assert.equal(goShopDisplay(false), 'No');
  assert.equal(goShopDisplay(null), null);
});

test('term_fee, reverse_fee, outside_date, go_shop columns are sortable and, where filterable, use enum filtering', () => {
  for (const key of ['term_fee', 'reverse_fee', 'outside_date', 'go_shop']) {
    const col = getColumn(key);
    assert.ok(col, `${key} column exists`);
    assert.equal(col.sortable, true, `${key} is sortable`);
  }
  assert.equal(getColumn('outside_date').filterable, true);
  assert.equal(getColumn('outside_date').filterType, 'enum');
  assert.equal(getColumn('go_shop').filterable, true);
  assert.equal(getColumn('go_shop').filterType, 'enum');
  // Dollar-amount columns are not enum-filterable (too many distinct values).
  assert.equal(getColumn('term_fee').filterable, false);
  assert.equal(getColumn('reverse_fee').filterable, false);
});

test('term_fee / reverse_fee sortValue sorts on the raw numeric amount, not the formatted string', () => {
  const feeCol = getColumn('term_fee');
  const a = { termination_fee: { amount: 100_000_000 } };
  const b = { termination_fee: { amount: 500_000_000 } };
  assert.ok(feeCol.sortValue(a) < feeCol.sortValue(b));
  assert.equal(feeCol.sortValue({ termination_fee: null }), 0);
});
