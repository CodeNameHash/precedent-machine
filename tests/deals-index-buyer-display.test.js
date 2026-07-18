const test = require('node:test');
const assert = require('node:assert/strict');

const { dealName, dealRow, resolveBuyerDisplay, resolveTargetDisplay } = require('../lib/query/types');

test('resolveBuyerDisplay prefers acquirer_display over a locked shell parent_entity (Skechers/3G case)', () => {
  const deal = {
    id: 'skechers',
    acquirer: 'Beach Acquisition Co Parent, LLC',
    metadata: {
      acquirer_display: '3G Capital',
      ultimateParent: '3G Capital',
      // deal_facts.parties.parent_entity must NOT drive display naming even
      // though it is present and "locked" — DEALS-INDEX-SPEC item 1.
      deal_facts: { parties: { parent_entity: 'Beach Acquisition Co Parent, LLC' } },
    },
  };
  assert.equal(resolveBuyerDisplay(deal), '3G Capital');
  assert.equal(dealName({ ...deal, target: 'Skechers' }), '3G Capital / Skechers');
});

test('resolveBuyerDisplay skips a shell candidate when a later non-shell candidate exists', () => {
  const deal = { acquirer: 'Hearts Parent', metadata: { ultimateParent: 'General Atlantic' } };
  assert.equal(resolveBuyerDisplay(deal), 'General Atlantic');
});

test('resolveBuyerDisplay keeps a shell name as a last resort when nothing else is available', () => {
  const deal = { acquirer: 'Wildcat EGH Holdco', metadata: {} };
  assert.equal(resolveBuyerDisplay(deal), 'Wildcat EGH Holdco');
});

test('resolveBuyerDisplay falls through the full precedence chain', () => {
  assert.equal(resolveBuyerDisplay({ acquirer: 'Acme Corp', metadata: {} }), 'Acme Corp');
  assert.equal(resolveBuyerDisplay({ metadata: { parent_entity: 'Legal ParentCo' } }), 'Legal ParentCo');
  assert.equal(resolveBuyerDisplay({ metadata: { ultimate_parent: 'Sponsor B' } }), 'Sponsor B');
  assert.equal(resolveBuyerDisplay({ metadata: { acquirer_display: 'Sponsor A' } }), 'Sponsor A');
});

test('resolveTargetDisplay prefers target_display then target_entity then deal.target', () => {
  assert.equal(resolveTargetDisplay({ target: 'Fallback Target', metadata: {} }), 'Fallback Target');
  assert.equal(resolveTargetDisplay({ metadata: { target_entity: 'Target Legal Co' } }), 'Target Legal Co');
  assert.equal(resolveTargetDisplay({ metadata: { target_display: 'Target Co', target_entity: 'Target Legal Co' } }), 'Target Co');
});

test('dealRow consideration_type prefers headlineConsiderationType over a numeric per-share summary', () => {
  const deal = {
    value_usd: 100,
    announce_date: '2025-01-01',
    metadata: {
      headlineConsiderationType: 'CASH',
      deal_facts: { consideration: { summary: '52.5' } },
    },
  };
  assert.equal(dealRow(deal).consideration_type, 'CASH');
});

test('dealRow consideration_type falls back to a non-numeric summary when no enum is present', () => {
  const deal = { metadata: { deal_facts: { consideration: { summary: 'Cash and CVR' } } } };
  assert.equal(dealRow(deal).consideration_type, 'Cash and CVR');
});

test('dealRow consideration_type ignores a numeric-looking summary junk value', () => {
  const deal = { metadata: { deal_facts: { consideration: { summary: '20.42 + CVR' } } } };
  assert.equal(dealRow(deal).consideration_type, null);
});
