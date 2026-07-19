const test = require('node:test');
const assert = require('node:assert/strict');

const { resultTitle } = require('../../lib/query/result-title');

test('resultTitle: FILTER_THEN_LIST — single boolean filter reads "Deals with <field>"', () => {
  const result = {
    kind: 'FILTER_THEN_LIST',
    filters_applied: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', op: 'eq', value: true }],
  };
  assert.equal(resultTitle(result), 'Deals with go shop present');
});

test('resultTitle: FILTER_THEN_LIST — negated boolean reads "Deals without <field>"', () => {
  const result = {
    kind: 'FILTER_THEN_LIST',
    filters_applied: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', op: 'neq', value: true }],
  };
  assert.equal(resultTitle(result), 'Deals without go shop present');
});

test('resultTitle: FILTER_THEN_LIST — multiple/non-boolean filters join with "and", provision prefix stripped', () => {
  const result = {
    kind: 'FILTER_THEN_LIST',
    filters_applied: [
      { provision_type: 'TERMINATION_FEE', field: 'terminationFeePercentEquityValue', op: 'gte', value: 3 },
      { provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', op: 'eq', value: true },
    ],
  };
  const title = resultTitle(result);
  assert.match(title, /^Deals where /);
  assert.match(title, / and /);
  // The "<Provision label>: " prefix sentenceForFilter() adds is stripped
  // off — it should never leak into the title.
  assert.doesNotMatch(title, /Termination fee:/);
  assert.doesNotMatch(title, /Covenant no solicitation:/);
});

test('resultTitle: FILTER_THEN_LIST — no filters falls back to "All deals"', () => {
  assert.equal(resultTitle({ kind: 'FILTER_THEN_LIST', filters_applied: [] }), 'All deals');
});

test('resultTitle: MARKET_RANGE', () => {
  const result = { kind: 'MARKET_RANGE', field_path: 'terminationFeePercentEquityValue' };
  assert.equal(resultTitle(result), 'Market range — Termination fee percent equity value');
});

test('resultTitle: DEAL_COMPARE joins deal names with " vs "', () => {
  const result = {
    kind: 'DEAL_COMPARE',
    columns: [{ deal_id: 'd1', deal_name: 'Buyer One / Target One' }, { deal_id: 'd2', deal_name: 'Buyer Two / Target Two' }],
  };
  assert.equal(resultTitle(result), 'Compare: Buyer One / Target One vs Buyer Two / Target Two');
});

test('resultTitle: PROVISION_CROSS_CUT', () => {
  const result = { kind: 'PROVISION_CROSS_CUT', provision_type: 'COVENANT_NO_SOLICITATION' };
  assert.equal(resultTitle(result), 'Covenant no solicitation across deals');
});

test('resultTitle: DEAL_TO_MARKET', () => {
  const result = { kind: 'DEAL_TO_MARKET', deal_name: 'Buyer One / Target One' };
  assert.equal(resultTitle(result), 'Buyer One / Target One vs the market');
});

test('resultTitle: unknown kind falls back to kindLabel', () => {
  assert.equal(resultTitle({ kind: 'SOMETHING_ELSE' }), 'SOMETHING ELSE');
});

test('resultTitle: null result returns empty string', () => {
  assert.equal(resultTitle(null), '');
});
