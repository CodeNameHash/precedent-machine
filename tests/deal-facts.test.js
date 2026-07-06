const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPartiesFact,
  buildValueUsdFact,
  considerationFromMetadata,
  deriveConsiderationFactFromProvisions,
  mergeDealFacts,
  valueUsdFromDeal,
} = require('../lib/deal-facts');
const { getDisplayAcquirer, getDisplayTarget } = require('../lib/deal-display');

test('deal facts merge value with source and project sortable value', () => {
  const metadata = mergeDealFacts({}, {
    value_usd: buildValueUsdFact('1.25B', {
      source_url: 'https://example.com/release',
      source_label: 'Company press release',
      method: 'manual_review',
    }),
  });

  assert.equal(metadata.deal_facts.value_usd.value, 1_250_000_000);
  assert.equal(metadata.deal_facts.value_usd.source_url, 'https://example.com/release');
  assert.equal(metadata.deal_facts.value_usd.locked, true);
  assert.equal(valueUsdFromDeal({ value_usd: null, metadata }), 1_250_000_000);
});

test('deal display prefers deal_facts party display but keeps contractual fallback', () => {
  const metadata = mergeDealFacts({}, {
    parties: buildPartiesFact({
      acquirer: 'Project Echo Merger Sub, LLC',
      target: 'Envestnet, Inc.',
      parent_entity: 'Bain Capital',
      acquirer_display: 'Bain Capital',
      target_display: 'Envestnet',
    }),
  });
  const deal = { acquirer: 'Project Echo Merger Sub, LLC', target: 'Envestnet, Inc.', metadata };

  assert.equal(getDisplayAcquirer(deal), 'Bain Capital');
  assert.equal(getDisplayTarget(deal), 'Envestnet');
  assert.equal(metadata.deal_facts.parties.acquirer, 'Project Echo Merger Sub, LLC');
});

test('consideration fact derives human summary from extracted provisions', () => {
  const fact = deriveConsiderationFactFromProvisions([
    {
      id: 'p1',
      type: 'CONSID',
      full_text: 'Each share shall be converted into the right to receive $47.50 in cash plus one CVR.',
      features: {
        considerationType: 'cash-with-cvr',
        perShareAmount: '$47.50',
      },
    },
  ]);

  assert.equal(fact.type, 'CASH_PLUS_CVR');
  assert.equal(fact.summary, '$47.50 + CVR');
});

test('consideration metadata prefers deal_facts before legacy uppercase enum', () => {
  const meta = mergeDealFacts({ headlineConsiderationType: 'MIXED' }, {
    consideration: { type: 'MIXED_ELECTION', summary: 'Cash / stock election' },
  });
  assert.deepEqual(considerationFromMetadata(meta), {
    type: 'MIXED_ELECTION',
    summary: 'Cash / stock election',
  });
});
