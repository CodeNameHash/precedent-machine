const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveBuyerDisplay, SHELL_NAME_REGEX } = require('../lib/query/types');

test('SHELL_NAME_REGEX matches transaction-vehicle naming', () => {
  assert.equal(SHELL_NAME_REGEX.test('Beach Acquisition Co Parent, LLC'), true);
  assert.equal(SHELL_NAME_REGEX.test('BCPE Pequod Buyer, Inc.'), true);
  assert.equal(SHELL_NAME_REGEX.test('Wildcat EGH Holdco, L.P.'), true);
  assert.equal(SHELL_NAME_REGEX.test('Bain Capital'), false);
  assert.equal(SHELL_NAME_REGEX.test('Pfizer Inc.'), false);
});

test('resolveBuyerDisplay prefers acquirer_display, then ultimateParent, then parent_entity, then deal.acquirer', () => {
  assert.equal(resolveBuyerDisplay({ acquirer: 'Beach Acquisition Co Parent, LLC', metadata: { acquirer_display: '3G Capital', ultimateParent: '3G Capital' } }), '3G Capital');
  assert.equal(resolveBuyerDisplay({ acquirer: 'Fallback Inc.', metadata: { ultimateParent: 'Silver Lake' } }), 'Silver Lake');
  assert.equal(resolveBuyerDisplay({ acquirer: 'Fallback Inc.', metadata: { parent_entity: 'General Atlantic' } }), 'General Atlantic');
  assert.equal(resolveBuyerDisplay({ acquirer: 'Pfizer Inc.', metadata: {} }), 'Pfizer Inc.');
});

test('resolveBuyerDisplay skips a shell candidate when a later, non-shell candidate exists', () => {
  // acquirer_display itself is shell-shaped (stale/bad data) — should be skipped in favor of ultimateParent.
  const deal = { acquirer: 'Hearts Parent, LLC', metadata: { acquirer_display: 'Hearts Parent, LLC', ultimateParent: 'General Atlantic' } };
  assert.equal(resolveBuyerDisplay(deal), 'General Atlantic');
});

test('resolveBuyerDisplay falls back to a shell name rather than null when nothing better exists (still fails the ingest-qa gate)', () => {
  const deal = { acquirer: 'SUP Parent Holdings, LLC', metadata: {} };
  const result = resolveBuyerDisplay(deal);
  assert.equal(result, 'SUP Parent Holdings, LLC');
  assert.equal(SHELL_NAME_REGEX.test(result), true); // gate consumers must still treat this as a FAIL
});

test('resolveBuyerDisplay returns null when there is no candidate at all', () => {
  assert.equal(resolveBuyerDisplay({ metadata: {} }), null);
  assert.equal(resolveBuyerDisplay(null), null);
});
