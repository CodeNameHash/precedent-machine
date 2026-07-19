// r8 "Deal filters" — buyer and law_firm joined sector/signing_year/
// consideration_type in the query engine's deal_filter vocabulary
// (lib/query/executors/shared.js comparisonDeals). Law firms resolve via
// the canonical display forms (lib/canonical-advisors.js) so the filter
// values match what the deals index shows.
const test = require('node:test');
const assert = require('node:assert');

const { comparisonDeals, dealLawFirms } = require('../lib/query/executors/shared.js');

const DEALS = [
  {
    id: 'd1',
    acquirer: 'Pfizer Inc.',
    sector: 'Biopharma',
    announce_date: '2025-11-07',
    metadata: {
      acquirer_display: 'Pfizer',
      advisors_v2: { buyer_firm: 'Wachtell, Lipton, Rosen & Katz', seller_firm: 'Skadden, Arps, Slate, Meagher & Flom LLP' },
    },
  },
  {
    id: 'd2',
    acquirer: 'QXO, Inc.',
    sector: 'Industrials',
    announce_date: '2026-03-01',
    metadata: {
      acquirer_display: 'QXO',
      advisors_v2: { buyer_firm: 'Paul, Weiss, Rifkind, Wharton & Garrison LLP', seller_firm: 'Simpson Thacher & Bartlett LLP' },
    },
  },
];

test('deal_filter.buyer matches raw acquirer or display name', () => {
  assert.deepEqual(comparisonDeals(DEALS, { buyer: ['Pfizer'] }).map((d) => d.id), ['d1']);
  assert.deepEqual(comparisonDeals(DEALS, { buyer: ['QXO, Inc.'] }).map((d) => d.id), ['d2']);
  assert.equal(comparisonDeals(DEALS, { buyer: ['Nobody'] }).length, 0);
});

test('deal_filter.law_firm matches canonical display firm forms on either side', () => {
  const skadden = comparisonDeals(DEALS, { law_firm: ['Skadden'] });
  assert.deepEqual(skadden.map((d) => d.id), ['d1'], 'seller-side firm matches via canonical short form');
  const pw = comparisonDeals(DEALS, { law_firm: dealLawFirms(DEALS[1]).filter((f) => /Paul/.test(f)) });
  assert.deepEqual(pw.map((d) => d.id), ['d2'], 'the filter value space IS dealLawFirms output — no drift possible');
});

test('empty deal_filter keeps every deal (unchanged behavior)', () => {
  assert.equal(comparisonDeals(DEALS, {}).length, 2);
  assert.equal(comparisonDeals(DEALS, { buyer: [], law_firm: [] }).length, 2);
});
