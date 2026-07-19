const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchReviewDealCards,
  filterRowsForMode,
  isUncoveredTextCard,
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

// Q5 (perf quick-wins): claims are fetched with a narrowed select (see
// CLAIMS_SELECT in lib/queries/review-deal.js) rather than '*', and the
// claims query is paginated (.order().range()) — support both chains so
// this fake exercises the real query shape fetchDealClaims builds.
function fakeSupabase(rows, claims = []) {
  return {
    from(table) {
      assert.ok(table === 'provision_cards' || table === 'claims', `unexpected table: ${table}`);
      return {
        select(columns) {
          if (table === 'provision_cards') {
            assert.equal(columns, '*');
            return {
              eq(column, value) {
                assert.equal(column, 'deal_id');
                assert.equal(value, 'deal-1');
                return Promise.resolve({ data: rows, error: null });
              },
            };
          }
          return {
            eq(column, value) {
              assert.equal(column, 'deal_id');
              assert.equal(value, 'deal-1');
              return {
                order() {
                  return {
                    range(start, end) {
                      return Promise.resolve({ data: claims.slice(start, end + 1), error: null });
                    },
                  };
                },
              };
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

test('isUncoveredTextCard detects coverage-plumbing card titles and section paths', () => {
  assert.equal(isUncoveredTextCard(card({ short_title: 'Uncovered text — Acquisition Proposals' })), true);
  assert.equal(isUncoveredTextCard(card({ section_ref: '6.2 | Uncovered text — Acquisition Proposals | abc123' })), true);
  assert.equal(isUncoveredTextCard(card({ short_title: 'Covered text' })), false);
});

test('shapeReviewDealRows hides uncovered-text cards in user mode', () => {
  const shaped = shapeReviewDealRows('deal-1', [
    card({ id: 'covered', provision_instance_id: 'covered', short_title: 'The Merger' }),
    card({ id: 'uncovered', provision_instance_id: 'uncovered', short_title: 'Uncovered text — The Merger' }),
  ]);

  assert.deepEqual(shaped.cards.map((item) => item.provision_instance_id), ['covered']);
  assert.equal(shaped.cardCount, 1);
});

test('shapeReviewDealRows preserves uncovered-text cards in admin mode', () => {
  const shaped = shapeReviewDealRows('deal-1', [
    card({ id: 'covered', provision_instance_id: 'covered', short_title: 'The Merger' }),
    card({ id: 'uncovered', provision_instance_id: 'uncovered', short_title: 'Uncovered text — The Merger' }),
  ], { mode: 'admin' });

  assert.deepEqual(shaped.cards.map((item) => item.provision_instance_id), ['covered', 'uncovered']);
  assert.equal(shaped.cardCount, 2);
});

test('filterRowsForMode does not mutate the source row array', () => {
  const rows = [
    card({ id: 'a', provision_instance_id: 'a', short_title: 'Uncovered text — The Merger' }),
    card({ id: 'b', provision_instance_id: 'b', short_title: 'The Merger' }),
  ];
  const filtered = filterRowsForMode(rows);

  assert.equal(rows.length, 2);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].provision_instance_id, 'b');
});

test('resolvedReferences carries only the light preview projection, not full definition rows', () => {
  const rows = [
    { provision_instance_id: 'def-1', kind: 'definition', short_title: 'MAE', defined_term: 'Material Adverse Effect', defined_value: 'means ...', primary_quote: 'q', region_full_text: 'X'.repeat(5000), ai_metadata: { features: { a: 1 } }, provenance: { source_doc_id: 'd' }, references: null, excerpt_id: 'e-def' },
    { provision_instance_id: 'op-1', kind: 'cross-reference', short_title: 'Op', references: JSON.stringify(['def-1']), excerpt_id: 'e-op' },
  ];
  const shaped = shapeReviewDealRows('deal-x', rows, {});
  const op = shaped.cards.find((c) => c.provision_instance_id === 'op-1');
  assert.equal(op.resolvedReferences.length, 1);
  const ref = op.resolvedReferences[0];
  assert.deepEqual(Object.keys(ref).sort(), ['defined_term', 'defined_value', 'primary_quote', 'provision_instance_id', 'short_title']);
  assert.equal(ref.region_full_text, undefined);
  assert.equal(ref.ai_metadata, undefined);
});
