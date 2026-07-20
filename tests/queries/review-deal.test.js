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
      assert.ok(['provision_cards', 'claims', 'transaction_steps', 'deals'].includes(table), `unexpected table: ${table}`);
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
          if (table === 'transaction_steps') {
            return {
              eq(column, value) {
                assert.equal(column, 'deal_id');
                assert.equal(value, 'deal-1');
                return { order: () => Promise.resolve({ data: [], error: null }) };
              },
            };
          }
          if (table === 'deals') {
            assert.equal(columns, 'value_usd');
            return {
              eq(column, value) {
                assert.equal(column, 'id');
                assert.equal(value, 'deal-1');
                return { maybeSingle: () => Promise.resolve({ data: { value_usd: null }, error: null }) };
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

test('shapeReviewDealRows maps claims-backed definition fields and repairs legacy adjacent-definition spillover', () => {
  const acting = card({
    id: 'acting',
    provision_instance_id: 'acting',
    kind: 'definition',
    defined_term: 'Acting Holders',
    defined_value: 'set forth in the CVR Register.\n\n"Assignee" has the meaning set forth in Section 6.3(a).',
    primary_quote: '"Acting Holders" means Holders of 25% of outstanding CVRs.\n\n"Assignee" has the meaning set forth in Section 6.3(a).',
    region_full_text: '"Acting Holders" means Holders of 25% of outstanding CVRs.\n\n"Assignee" has the meaning set forth in Section 6.3(a).',
  });
  const assignee = card({
    id: 'assignee',
    provision_instance_id: 'assignee',
    kind: 'definition',
    defined_term: 'Assignee',
    defined_value: 'set forth in Section 6.3(a).',
    primary_quote: '"Assignee" has the meaning set forth in Section 6.3(a).',
    region_full_text: '"Assignee" has the meaning set forth in Section 6.3(a).',
  });
  const change = card({
    id: 'change',
    provision_instance_id: 'change',
    kind: 'definition',
    defined_term: 'Change of Control',
    defined_value: 'a sale of substantially all assets.\n\n"Commercially Reasonable Efforts" means customary efforts.',
    primary_quote: '"Change of Control" means a sale of substantially all assets.\n\n"Commercially Reasonable Efforts" means customary efforts.',
    region_full_text: '"Change of Control" means a sale of substantially all assets.\n\n"Commercially Reasonable Efforts" means customary efforts.',
  });
  const claims = [
    { id: 'c1', excerpt_id: acting.excerpt_id, attribute: 'canonicalTerm', canonical: null, verbatim: 'Acting Holders', evidence_quote: null, provenance: { feature_value: 'Acting Holders' } },
    { id: 'c2', excerpt_id: acting.excerpt_id, attribute: 'definitionText', canonical: null, verbatim: 'Holders of 25% of outstanding CVRs.', evidence_quote: null, provenance: { feature_value: 'Holders of 25% of outstanding CVRs.' } },
  ];
  const shaped = shapeReviewDealRows('deal-1', [acting, assignee, change], { claims });
  const repaired = shaped.definitions.find((definition) => definition.defined_term === 'Acting Holders');
  assert.equal(repaired.defined_value, 'Holders of 25% of outstanding CVRs.');
  assert.equal(repaired.primary_quote, '"Acting Holders" means Holders of 25% of outstanding CVRs.');
  assert.equal(repaired.region_full_text, repaired.primary_quote);
  const repairedChange = shaped.definitions.find((definition) => definition.defined_term === 'Change of Control');
  assert.equal(repairedChange.primary_quote, '"Change of Control" means a sale of substantially all assets.');
});

test('definition boundary repair preserves an inline nested definition that is not its own card', () => {
  const text = '"Affiliate" means a Person controlled by another Person; "control" means the power to direct management.';
  const shaped = shapeReviewDealRows('deal-1', [card({
    kind: 'definition',
    type: 'DEF',
    defined_term: 'Affiliate',
    defined_value: text,
    primary_quote: text,
    region_full_text: text,
  })]);

  assert.equal(shaped.definitions[0].primary_quote, text);
});

test('definition boundary repair recognizes a wrapped quoted term header', () => {
  const patents = card({
    id: 'patents',
    provision_instance_id: 'patents',
    kind: 'definition',
    defined_term: 'Relevant Patents',
    defined_value: 'the listed patent rights.\n\n"Rights\nAgent" means the appointed rights agent.',
    primary_quote: '"Relevant Patents" means the listed patent rights.\n\n"Rights\nAgent" means the appointed rights agent.',
    region_full_text: '"Relevant Patents" means the listed patent rights.\n\n"Rights\nAgent" means the appointed rights agent.',
  });
  const rightsAgent = card({
    id: 'rights-agent',
    provision_instance_id: 'rights-agent',
    kind: 'definition',
    defined_term: 'Rights Agent',
    defined_value: 'the appointed rights agent.',
    primary_quote: '"Rights\nAgent" means the appointed rights agent.',
    region_full_text: '"Rights\nAgent" means the appointed rights agent.',
  });

  const shaped = shapeReviewDealRows('deal-1', [patents, rightsAgent]);
  assert.equal(shaped.definitions.find((definition) => definition.defined_term === 'Relevant Patents').primary_quote, '"Relevant Patents" means the listed patent rights.');
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
