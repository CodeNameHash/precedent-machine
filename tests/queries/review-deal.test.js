const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchReviewDealCards,
  parseReferences,
  shapeReviewDealRows,
  stripProposedShortTitle,
} = require('../../lib/queries/review-deal');

function card(overrides = {}) {
  return {
    id: overrides.id || 'row-1',
    deal_id: 'deal-1',
    provision_instance_id: overrides.provision_instance_id || overrides.id || 'card-1',
    excerpt_id: `${overrides.provision_instance_id || overrides.id || 'card-1'}:0`,
    section_ref: overrides.section_ref || 'Section 1.01',
    short_title: overrides.short_title || 'Test card',
    kind: overrides.kind || 'standard',
    defined_term: overrides.defined_term || null,
    defined_value: overrides.defined_value || null,
    references: overrides.references || [],
    provenance: {
      source_doc_id: 'doc-1',
      source_doc_page: 1,
      source_doc_offset_start: overrides.offset ?? 0,
      source_doc_offset_end: (overrides.offset ?? 0) + 10,
      extractor_name: 'parser-v2',
      extractor_version: 'test',
      model: 'test',
      prompt_hash: 'sha256:test',
      run_id: 'run-1',
      extracted_at: '2026-07-08T00:00:00.000Z',
    },
    ...overrides,
  };
}

function fakeSupabase(rows) {
  return {
    from(table) {
      assert.equal(table, 'provision_cards');
      return {
        select(columns) {
          assert.equal(columns, '*');
          return {
            eq(column, value) {
              assert.equal(column, 'deal_id');
              assert.equal(value, 'deal-1');
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  };
}

test('parseReferences accepts arrays and JSON strings', () => {
  assert.deepEqual(parseReferences(['a', '', 'b']), ['a', 'b']);
  assert.deepEqual(parseReferences('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseReferences('not json'), []);
});

test('shapeReviewDealRows groups cards by section and expands definition references', () => {
  const definition = card({
    id: 'def-mae',
    provision_instance_id: 'def-mae',
    kind: 'definition',
    section_ref: 'Article I',
    short_title: 'Company Material Adverse Effect',
    defined_term: 'Company Material Adverse Effect',
    defined_value: 'any effect materially adverse to the Company',
    offset: 10,
  });
  const covenant = card({
    id: 'ioc-mae',
    provision_instance_id: 'ioc-mae',
    kind: 'cross-reference',
    section_ref: 'Section 6.01',
    short_title: 'Conduct of Business',
    references: ['def-mae', 'missing-def'],
    offset: 100,
  });
  const shaped = shapeReviewDealRows('deal-1', [covenant, definition]);

  assert.equal(shaped.cardCount, 2);
  assert.deepEqual(shaped.sections.map((section) => section.sectionRef), ['Article I', 'Section 6.01']);
  assert.equal(shaped.definitions.length, 1);
  const expanded = shaped.cards.find((item) => item.provision_instance_id === 'ioc-mae');
  assert.equal(expanded.resolvedReferences[0].defined_term, 'Company Material Adverse Effect');
  assert.deepEqual(expanded.unresolvedReferences, ['missing-def']);
});

test('fetchReviewDealCards reads provision_cards and returns grouped shape', async () => {
  const rows = [
    card({ id: 'b', provision_instance_id: 'b', section_ref: 'Section 2.01', offset: 20 }),
    card({ id: 'a', provision_instance_id: 'a', section_ref: 'Section 1.01', offset: 10 }),
  ];
  const shaped = await fetchReviewDealCards('deal-1', fakeSupabase(rows));
  assert.deepEqual(shaped.cards.map((item) => item.provision_instance_id), ['a', 'b']);
  assert.deepEqual(shaped.sections.map((section) => section.sectionRef), ['Section 1.01', 'Section 2.01']);
});

test('stripProposedShortTitle strips only the exact user-mode prefix', () => {
  assert.equal(stripProposedShortTitle('[PROPOSED] Transfer Taxes'), 'Transfer Taxes');
  assert.equal(stripProposedShortTitle('[PROPOSED]'), '[PROPOSED]');
  assert.equal(stripProposedShortTitle('[proposed] Transfer Taxes'), '[proposed] Transfer Taxes');
  assert.equal(stripProposedShortTitle('Transfer Taxes'), 'Transfer Taxes');
  assert.equal(stripProposedShortTitle(null), null);
});

test('shapeReviewDealRows strips proposed labels in user mode', () => {
  const shaped = shapeReviewDealRows('deal-1', [
    card({ short_title: '[PROPOSED] Transfer Taxes' }),
  ]);

  assert.equal(shaped.cards[0].short_title, 'Transfer Taxes');
  assert.equal(shaped.sections[0].cards[0].short_title, 'Transfer Taxes');
});

test('shapeReviewDealRows preserves proposed labels in admin mode', () => {
  const shaped = shapeReviewDealRows('deal-1', [
    card({ short_title: '[PROPOSED] Transfer Taxes' }),
  ], { mode: 'admin' });

  assert.equal(shaped.cards[0].short_title, '[PROPOSED] Transfer Taxes');
});

test('fetchReviewDealCards threads admin mode through the grouped shape', async () => {
  const shaped = await fetchReviewDealCards('deal-1', fakeSupabase([
    card({ short_title: '[PROPOSED] Transfer Taxes' }),
  ]), { mode: 'admin' });

  assert.equal(shaped.cards[0].short_title, '[PROPOSED] Transfer Taxes');
});
