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

// Regression (2026-07-19 law-firms/deals-index live tail): bare "holdings"
// is a real corporate suffix, not a shell-vehicle signal on its own —
// "Novo Holdings A/S" is the actual verified acquirer of Catalent, and was
// being wrongly skipped in favor of the raw filed shell name "Creek Parent,
// Inc." because the two SHELL_NAME_REGEX copies (this file and
// lib/ingest/deal-metadata-prompt.js) had drifted apart.
test('SHELL_NAME_REGEX no longer flags bare "Holdings" as shell-shaped (Novo Holdings A/S case)', () => {
  assert.equal(SHELL_NAME_REGEX.test('Novo Holdings A/S'), false);
  assert.equal(SHELL_NAME_REGEX.test('HireRight Holdings Corporation'), false);
  // "Holdco" remains a strong deal-vehicle signal and still matches.
  assert.equal(SHELL_NAME_REGEX.test('Wildcat EGH Holdco, L.P.'), true);
});

test('resolveBuyerDisplay: Catalent case — Novo Holdings A/S (real name containing "Holdings") is preferred over the raw filed shell "Creek Parent, Inc."', () => {
  const deal = { acquirer: 'Creek Parent, Inc.', metadata: { acquirer_display: 'Novo Holdings A/S', ultimateParent: 'Novo Holdings A/S' } };
  assert.equal(resolveBuyerDisplay(deal), 'Novo Holdings A/S');
});
