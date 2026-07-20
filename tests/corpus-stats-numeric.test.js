// r19 (WP-A, "numeric market cells"): the batch endpoint's payload used to
// carry NO numeric distribution for numeric attributes at all -- rich
// amount-object claims (companyTerminationFee etc.) have canonical: null, so
// buildCodeStats' old canonical-only grouping silently dropped them, and
// plain numeric attributes (noticePeriod) would have landed as a useless
// per-exact-value categorical tally. This covers the fix: featureSummary now
// carries a numeric entry (min/p25/median/p75/max/unit/excludedCount, plus a
// parallel percent-of-deal-value distribution for dollar amounts) for every
// numeric or deal-relative-period attribute, additively alongside the
// unchanged categorical path -- see lib/queries/corpus-stats-core.js's r19
// block (buildNumericAttributeSummary / buildRelativePeriodAttributeSummary).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCorpusBase,
  buildCodeStats,
  extractNumeric,
  isNumericAttribute,
  numericAttributeUnit,
} = require('../lib/queries/corpus-stats-core');

function deal(id, overrides = {}) {
  return {
    id,
    acquirer: `Acquirer-${id}`,
    target: `Target-${id}`,
    sector: 'Tech',
    value_usd: 1e9,
    announce_date: '2025-01-01',
    metadata: {},
    ...overrides,
  };
}

function feeClaim(dealId, amount, overrides = {}) {
  return {
    deal_id: dealId,
    attribute: 'companyTerminationFee',
    canonical: null,
    verbatim: null,
    evidence_quote: null,
    provenance: { code: 'TERMF-TARGET', feature_value: { amount, percentage_of_equity: 7.01 } },
    id: `${dealId}-fee`,
    created_at: '2026-01-01T00:00:00Z',
    excerpt_id: null,
    ...overrides,
  };
}

test('extractNumeric prefers canonical, then feature_value.amount, and ignores percentage_of_equity (unit-mixing guard)', () => {
  assert.equal(extractNumeric({ canonical: '42', provenance: {} }), 42);
  assert.equal(extractNumeric({ canonical: null, provenance: { feature_value: { amount: 279000000, percentage_of_equity: 7.01 } } }), 279000000);
  assert.equal(extractNumeric({ canonical: null, provenance: {} }), null, 'no signal -> null, never a guess');
});

test('isNumericAttribute/numericAttributeUnit: plain number attribute carries its registry unit, rich object attribute defaults to usd', () => {
  assert.equal(isNumericAttribute('noticePeriod', []), true);
  assert.equal(numericAttributeUnit('noticePeriod'), 'days');
  assert.equal(isNumericAttribute('companyTerminationFee', [feeClaim('d1', 100)]), true);
  assert.equal(numericAttributeUnit('companyTerminationFee'), 'usd');
  assert.equal(isNumericAttribute('feeRequired', []), false, 'boolean attribute is never numeric');
});

test('buildCodeStats: a rich amount-object attribute (canonical always null) gets a numeric featureSummary entry, not silently dropped', () => {
  const deals = [
    deal('d1', { value_usd: 1e9 }),
    deal('d2', { value_usd: 2e9 }),
    deal('d3', { value_usd: 5e8 }),
  ];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: null, filters: {} });
  const claimsForCode = [
    feeClaim('d1', 30_000_000),
    feeClaim('d2', 60_000_000),
    feeClaim('d3', 10_000_000),
  ];
  const stats = buildCodeStats({
    code: 'TERMF-TARGET',
    cardsForCode: [],
    claimsForCode,
    subjectDealId: null,
    subject: null,
    peerSet: base.peerSet,
    peerIds: base.peerIds,
    firmsByDeal: base.firmsByDeal,
  });
  assert.equal(stats.featureSummary.length, 1);
  const entry = stats.featureSummary[0];
  assert.equal(entry.attribute, 'companyTerminationFee');
  assert.equal(entry.kind, 'numeric');
  assert.equal(entry.unit, 'usd');
  assert.equal(entry.count, 3);
  assert.equal(entry.excludedCount, 0);
  assert.equal(entry.min, 10_000_000);
  assert.equal(entry.max, 60_000_000);
  assert.equal(entry.median, 30_000_000);
  assert.ok(Number.isFinite(entry.p25) && Number.isFinite(entry.p75), 'p25/p75 present');
  // percent-of-deal: 30M/1B=3%, 60M/2B=3%, 10M/500M=2%.
  assert.ok(entry.percentOfDeal, 'dollar attribute gets a parallel percent-of-deal-value distribution');
  assert.equal(entry.percentOfDeal.excludedCount, 0);
  assert.ok(Math.abs(entry.percentOfDeal.median - 3) < 0.01);
});

test('buildCodeStats: percentOfDeal excludes deals with no positive value_usd, counted honestly, never guessed', () => {
  const deals = [deal('d1', { value_usd: 1e9 }), deal('d2', { value_usd: 0 })];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: null, filters: {} });
  const claimsForCode = [feeClaim('d1', 30_000_000), feeClaim('d2', 5_000_000)];
  const stats = buildCodeStats({
    code: 'TERMF-TARGET', cardsForCode: [], claimsForCode, subjectDealId: null, subject: null, peerSet: base.peerSet, peerIds: base.peerIds, firmsByDeal: base.firmsByDeal,
  });
  const entry = stats.featureSummary[0];
  assert.equal(entry.count, 2, 'both deals still count toward the dollar-amount distribution');
  assert.equal(entry.percentOfDeal.excludedCount, 1, 'the zero-value_usd deal is excluded from percentOfDeal only');
});

test('buildCodeStats: plain numeric attribute (noticePeriod, canonical carries the number) gets a numeric entry with its registry unit', () => {
  const deals = [deal('d1'), deal('d2'), deal('d3')];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: null, filters: {} });
  const claimsForCode = [
    { deal_id: 'd1', attribute: 'noticePeriod', canonical: '10', provenance: { code: 'NOSOL-CEASE' } },
    { deal_id: 'd2', attribute: 'noticePeriod', canonical: '5', provenance: { code: 'NOSOL-CEASE' } },
    { deal_id: 'd3', attribute: 'noticePeriod', canonical: 'not-a-number', provenance: { code: 'NOSOL-CEASE' } },
  ];
  const stats = buildCodeStats({
    code: 'NOSOL-CEASE', cardsForCode: [], claimsForCode, subjectDealId: null, subject: null, peerSet: base.peerSet, peerIds: base.peerIds, firmsByDeal: base.firmsByDeal,
  });
  const entry = stats.featureSummary[0];
  assert.equal(entry.attribute, 'noticePeriod');
  assert.equal(entry.kind, 'numeric');
  assert.equal(entry.unit, 'days');
  assert.equal(entry.count, 2, 'the unparseable claim is excluded, not coerced to 0 or NaN');
  assert.equal(entry.excludedCount, 1);
  assert.equal(entry.percentOfDeal, null, 'a duration field never gets a dollar percent-of-deal distribution');
});

test('buildCodeStats: deal-relative anchor field (lookbackDateISO) distributes as months-before-signing, not raw dates', () => {
  const deals = [
    deal('d1', { announce_date: '2025-06-30' }),
    deal('d2', { announce_date: '2025-06-30' }),
    deal('d3', { announce_date: '2025-06-30' }), // no convertible anchor -> excluded
  ];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: null, filters: {} });
  const claimsForCode = [
    { deal_id: 'd1', attribute: 'lookbackDateISO', canonical: '2023-12-31', provenance: { code: 'REP-T-FINSTMT' } },
    { deal_id: 'd2', attribute: 'lookbackDateISO', canonical: '2024-06-30', provenance: { code: 'REP-T-FINSTMT' } },
    { deal_id: 'd3', attribute: 'lookbackDateISO', canonical: 'the Balance Sheet Date', provenance: { code: 'REP-T-FINSTMT' } },
  ];
  const stats = buildCodeStats({
    code: 'REP-T-FINSTMT', cardsForCode: [], claimsForCode, subjectDealId: null, subject: null, peerSet: base.peerSet, peerIds: base.peerIds, firmsByDeal: base.firmsByDeal,
  });
  const entry = stats.featureSummary[0];
  assert.equal(entry.attribute, 'lookbackDateISO');
  assert.equal(entry.kind, 'numeric');
  assert.equal(entry.unit, 'months before signing');
  assert.equal(entry.basis, 'months-before-signing');
  assert.equal(entry.count, 2);
  assert.equal(entry.excludedCount, 1, 'the defined-term anchor (no literal date) is excluded, not guessed');
  assert.ok(Number.isFinite(entry.p25) && Number.isFinite(entry.p75));
});

test('buildCodeStats: numeric routing is additive -- categorical attributes on the SAME code are untouched (regression)', () => {
  const deals = [deal('d1'), deal('d2')];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: 'd1', filters: {} });
  const claimsForCode = [
    { deal_id: 'd1', attribute: 'feeRequired', canonical: 'YES', provenance: { code: 'TERMF-COMPANY' } },
    { deal_id: 'd2', attribute: 'feeRequired', canonical: 'NO', provenance: { code: 'TERMF-COMPANY' } },
    feeClaim('d1', 30_000_000, { attribute: 'companyTerminationFee', provenance: { code: 'TERMF-COMPANY', feature_value: { amount: 30_000_000 } } }),
    feeClaim('d2', 40_000_000, { attribute: 'companyTerminationFee', provenance: { code: 'TERMF-COMPANY', feature_value: { amount: 40_000_000 } } }),
  ];
  const stats = buildCodeStats({
    code: 'TERMF-COMPANY', cardsForCode: [], claimsForCode, subjectDealId: 'd1', subject: base.subject, peerSet: base.peerSet, peerIds: base.peerIds, firmsByDeal: base.firmsByDeal,
  });
  assert.equal(stats.featureSummary.length, 2);
  const categorical = stats.featureSummary.find((f) => f.attribute === 'feeRequired');
  const numeric = stats.featureSummary.find((f) => f.attribute === 'companyTerminationFee');
  assert.equal(categorical.kind, 'categorical');
  assert.equal(categorical.total, 2);
  assert.equal(numeric.kind, 'numeric');
  assert.equal(numeric.unit, 'usd');
});
