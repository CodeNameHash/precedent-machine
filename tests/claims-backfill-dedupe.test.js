/* Tests for scripts/backfill/claims-from-normalized.js — the identity-anchor
 * resolution and the triple-id collision handling that guards the idempotent
 * upsert key. See PLAN-CLAIMS-LAYER.md Phase 1/2 and the claims-phase012
 * investigation: all id collisions in the current snapshot are exact
 * duplicates, but the disambiguation branch must not silently drop a
 * genuinely-distinct claim that happens to share an id in a future snapshot. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveAnchor,
  buildCardIndex,
  dedupeAndDisambiguateIds,
} = require('../scripts/backfill/claims-from-normalized');

function claim(overrides = {}) {
  return {
    id: 't1',
    deal_id: 'd1',
    attribute: 'noticePeriod',
    verbatim: '24',
    canonical: null,
    evidence_quote: 'no event later than twenty-four (24) hours',
    ...overrides,
  };
}

test('single row per id passes through untouched', () => {
  const { finalRows, exactDupesCollapsed, disambiguated } = dedupeAndDisambiguateIds([claim()]);
  assert.equal(finalRows.length, 1);
  assert.equal(exactDupesCollapsed, 0);
  assert.equal(disambiguated, 0);
  assert.equal(finalRows[0].id, 't1');
});

test('byte-identical duplicates on the same id collapse to one row (idempotent)', () => {
  const rows = [claim(), claim(), claim()];
  const { finalRows, exactDupesCollapsed, disambiguated } = dedupeAndDisambiguateIds(rows);
  assert.equal(finalRows.length, 1, 'three identical rows collapse to one');
  assert.equal(exactDupesCollapsed, 2);
  assert.equal(disambiguated, 0);
});

test('genuinely-distinct claims sharing an id are disambiguated, never dropped', () => {
  const a = claim({ verbatim: '24' });
  const b = claim({ verbatim: '48', evidence_quote: 'within forty-eight (48) hours' });
  const { finalRows, exactDupesCollapsed, disambiguated } = dedupeAndDisambiguateIds([a, b]);
  assert.equal(finalRows.length, 2, 'no data loss — both distinct claims survive');
  assert.equal(exactDupesCollapsed, 0);
  assert.equal(disambiguated, 1);
  const ids = finalRows.map((r) => r.id).sort();
  assert.deepEqual(ids, ['t1', 't1#1'], 'second distinct claim gets a suffixed id');
});

test('differing evidence_quote alone counts as distinct (citation is load-bearing)', () => {
  const a = claim({ evidence_quote: 'quote A' });
  const b = claim({ evidence_quote: 'quote B' });
  const { finalRows, disambiguated } = dedupeAndDisambiguateIds([a, b]);
  assert.equal(finalRows.length, 2);
  assert.equal(disambiguated, 1);
});

test('differing canonical counts as distinct', () => {
  const a = claim({ canonical: null });
  const b = claim({ canonical: 'RESOLVED_CODE' });
  const { finalRows } = dedupeAndDisambiguateIds([a, b]);
  assert.equal(finalRows.length, 2);
});

test('resolveAnchor: exact full_text match in the same deal resolves to one card', () => {
  const provisions = [{ id: 'p1', deal_id: 'd1', full_text: '  Section 5.2 text  ' }];
  const cards = [{
    deal_id: 'd1', excerpt_id: 'e1', provision_instance_id: 'pi1',
    region_id: 'r1', region_full_text: 'Section 5.2 text',
  }];
  const provisionsById = new Map(provisions.map((p) => [p.id, p]));
  const idx = buildCardIndex(cards);
  const anchor = resolveAnchor({ source_provision_id: 'p1', deal_id: 'd1' }, provisionsById, idx);
  assert.equal(anchor.status, 'resolved');
  assert.equal(anchor.card.excerpt_id, 'e1');
});

test('resolveAnchor: unknown source_provision_id is bucketed, not thrown', () => {
  const idx = buildCardIndex([]);
  const anchor = resolveAnchor({ source_provision_id: 'missing', deal_id: 'd1' }, new Map(), idx);
  assert.equal(anchor.status, 'no_provision_row');
});

test('resolveAnchor: provision with no matching card text is an orphan', () => {
  const provisionsById = new Map([['p1', { id: 'p1', deal_id: 'd1', full_text: 'no card has this' }]]);
  const idx = buildCardIndex([{
    deal_id: 'd1', excerpt_id: 'e1', provision_instance_id: 'pi1', region_id: 'r1',
    region_full_text: 'something else entirely',
  }]);
  const anchor = resolveAnchor({ source_provision_id: 'p1', deal_id: 'd1' }, provisionsById, idx);
  assert.equal(anchor.status, 'no_card_text_match');
});

test('resolveAnchor: match is scoped by deal_id (same text in another deal does not leak)', () => {
  const provisionsById = new Map([['p1', { id: 'p1', deal_id: 'd1', full_text: 'shared clause text' }]]);
  const idx = buildCardIndex([{
    deal_id: 'd2', excerpt_id: 'e-other', provision_instance_id: 'pi', region_id: 'r',
    region_full_text: 'shared clause text',
  }]);
  const anchor = resolveAnchor({ source_provision_id: 'p1', deal_id: 'd1' }, provisionsById, idx);
  assert.equal(anchor.status, 'no_card_text_match', 'a card in a different deal must not resolve the anchor');
});
