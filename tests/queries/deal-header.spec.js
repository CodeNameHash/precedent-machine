const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const { DEAL_HEADER_SELECT, headerRowToDeal } = require('../../lib/queries/deal-header');

test('DEAL_HEADER_SELECT never asks for full_text/classified_sections/extraction_runs', () => {
  assert.ok(!/full_text/.test(DEAL_HEADER_SELECT));
  assert.ok(!/classified_sections/.test(DEAL_HEADER_SELECT));
  assert.ok(!/extraction_runs/.test(DEAL_HEADER_SELECT));
});

test('DEAL_HEADER_SELECT covers every field DealHeader/sectionList read', () => {
  for (const key of [
    'target_display', 'acquirer_display', 'deal_facts', 'merger_form',
    'headlineConsiderationType', 'advisors_v2', 'value_usd', 'announce_date', 'sector',
  ]) {
    assert.ok(DEAL_HEADER_SELECT.includes(key), `missing ${key}`);
  }
});

test('headerRowToDeal reshapes a flat PostgREST row into deal.metadata.* the same way listRowToDeal does', () => {
  const row = {
    id: 'deal-1', acquirer: 'Pfizer', target: 'Metsera', value_usd: 1e9,
    announce_date: '2025-09-21', sector: 'Biopharma', created_at: '2025-09-01T00:00:00Z', created_by: 'user-1',
    target_display: 'Metsera, Inc.', acquirer_display: 'Pfizer Inc.',
    deal_facts: { value_usd: { summary: '$10B' } },
    merger_form: 'ONE_STEP_MERGER',
    advisors_v2: { acquirer: ['Goldman Sachs'] },
  };
  const deal = headerRowToDeal(row);
  assert.equal(deal.id, 'deal-1');
  assert.equal(deal.metadata.target_display, 'Metsera, Inc.');
  assert.equal(deal.metadata.acquirer_display, 'Pfizer Inc.');
  assert.equal(deal.metadata.merger_form, 'ONE_STEP_MERGER');
  assert.deepEqual(deal.metadata.deal_facts, { value_usd: { summary: '$10B' } });
  assert.deepEqual(deal.metadata.advisors_v2, { acquirer: ['Goldman Sachs'] });
  assert.equal(deal.metadata.full_text, undefined);
});

// Q3 acceptance criterion: header response <=10KB gz, even including a
// generously-populated metadata blob + topology join (Cox-scale deal with a
// non-trivial deal_facts object and long advisor lists).
test('a fully-populated header response stays under the 10KB gz budget', () => {
  const row = {
    id: 'deal-cox', acquirer: 'Warren Buffett / Berkshire Hathaway', target: 'Occidental Petroleum',
    value_usd: 5.4e10, announce_date: '2019-05-09', sector: 'Energy',
    created_at: '2019-05-09T00:00:00Z', created_by: 'ingest-pipeline',
    target_display: 'Occidental Petroleum Corporation', acquirer_display: 'Berkshire Hathaway Inc.',
    target_entity: 'Occidental Petroleum Corporation, a Delaware corporation',
    merger_form: 'ONE_STEP_MERGER', headlineConsiderationType: 'CASH',
    deal_facts: {
      value_usd: { summary: '$54.0 billion', value: 5.4e10 },
      consideration: { summary: 'Cash and preferred stock' },
      termination_fee: { summary: '$1.0 billion' },
      price_per_share: { summary: '$76.00 per share' },
    },
    advisors_v2: {
      acquirer: ['Munger, Tolles & Olson LLP', 'Berkshire Hathaway internal counsel'],
      target: ['Evercore', 'Citigroup Global Markets Inc.', 'Wachtell, Lipton, Rosen & Katz'],
    },
  };
  const deal = headerRowToDeal(row);
  deal.deal_topology = {
    id: 'topo-1', deal_id: 'deal-cox', structure: 'one-step-merger',
    primary_step: { id: 'step-1', kind: 'merger', ordinal: 1 },
  };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ deal }), 'utf8'));
  assert.ok(gz.length <= 10 * 1024, `expected <=10KB gz, got ${gz.length} bytes`);
});
