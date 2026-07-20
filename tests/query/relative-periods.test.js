// r14 (Ben, "when comparing look-back periods — we should be comparing the
// LENGTH not the dates"): lib/query/relative-periods.js converts a stored
// deal-relative anchor (a date like "December 31, 2023", or a stored
// duration like "two years") to whole months-before-signing against the
// deal's own signing date — like fees comparing as % of deal value rather
// than dollars. Null over guesses, always.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RELATIVE_PERIOD_FIELDS,
  RELATIVE_MONTHS_UNIT,
  isRelativePeriodField,
  parseAnchorDate,
  parseMonthsDuration,
  toRelativeMonths,
  toRelativeMonthsForField,
} = require('../../lib/query/relative-periods');

const { executeMarketRange } = require('../../lib/query/executors/market-range');

const DEAL = { announce_date: '2024-04-02' }; // Endeavor signing, from corpus

test('registry contains exactly the audited keys', () => {
  assert.deepEqual(Object.keys(RELATIVE_PERIOD_FIELDS).sort(), [
    'absenceOfChangesStartDate',
    'aocNoMaeSinceDate',
    'lookbackDateISO',
    'lookbackPeriod',
    'secFilingsExceptionLookback',
    'secFilingsExceptionLookbackDate',
  ]);
  assert.equal(isRelativePeriodField('lookbackDateISO'), true);
  assert.equal(isRelativePeriodField('outsideDateISO'), false);
  assert.equal(isRelativePeriodField('feeAmount'), false);
});

test('date form: ISO and long dates convert to whole months before signing', () => {
  // 2023-12-31 -> 2024-04-02 is 93 days = round(93 / 30.4375) = 3 months.
  assert.equal(toRelativeMonths('2023-12-31', DEAL), 3);
  assert.equal(toRelativeMonths('December 31, 2023', DEAL), 3);
  // Embedded "since <date>" prose (real corpus value, Skechers).
  assert.equal(
    toRelativeMonths('Since January 1, 2022', { announce_date: '2025-05-04' }),
    40,
  );
  // signing_date accepted as alias of announce_date (home/deal-row shape).
  assert.equal(toRelativeMonths('2023-12-31', { signing_date: '2024-04-02' }), 3);
  // Same-day anchor = 0 months, not null.
  assert.equal(toRelativeMonths('2024-04-02', DEAL), 0);
});

test('duration form: parses to months directly, no signing date needed', () => {
  assert.equal(toRelativeMonths('two years', {}), 24);
  assert.equal(toRelativeMonths('24 months', {}), 24);
  assert.equal(toRelativeMonths('In the past three (3) years', {}), 36);
  assert.equal(toRelativeMonths('previous five years', {}), 60);
  assert.equal(toRelativeMonths('90 days', {}), 3);
  assert.equal(parseMonthsDuration('the past five years'), 60);
});

test('bare numbers only convert with a declared unit', () => {
  // lookbackPeriod stores DAYS (features.js unit) — 1095 days = 36 months.
  assert.equal(toRelativeMonthsForField('lookbackPeriod', 1095, {}), 36);
  assert.equal(toRelativeMonthsForField('lookbackPeriod', '913', {}), 30);
  // A bare number on a date-typed field has no interpretable unit.
  assert.equal(toRelativeMonthsForField('lookbackDateISO', 1095, DEAL), null);
  assert.equal(toRelativeMonths(1095, DEAL), null);
  // Non-registry key never converts.
  assert.equal(toRelativeMonthsForField('outsideDateISO', '2023-12-31', DEAL), null);
});

test('unparseable values return null, never a guess', () => {
  // Defined-term anchors (the dominant corpus null case).
  assert.equal(toRelativeMonths('the Balance Sheet Date', DEAL), null);
  assert.equal(toRelativeMonths('since the Applicable Date', DEAL), null);
  // Business-day delivery-timing prose is not a look-back length.
  assert.equal(toRelativeMonths('at least two Business Days prior to the date hereof', DEAL), null);
  // Multi-part ";"-joined anchor lists are ambiguous.
  assert.equal(toRelativeMonths('six years prior to the date of this Agreement; since January 1, 2023', DEAL), null);
  // A date + duration in one value ("12 month period ended March 31, 2025")
  // is a period END, not a look-back start — ambiguous, so null.
  assert.equal(toRelativeMonths('for the twelve (12) month period ended March 31, 2025', { announce_date: '2025-07-08' }), null);
  // Two literal dates: which is the anchor? Null.
  assert.equal(toRelativeMonths('from January 1, 2023 to December 31, 2023', DEAL), null);
  assert.equal(toRelativeMonths('', DEAL), null);
  assert.equal(toRelativeMonths(null, DEAL), null);
  assert.equal(toRelativeMonths('February 30, 2024', DEAL), null); // rolled-over date
});

test('missing signing date or future anchor returns null', () => {
  assert.equal(toRelativeMonths('2023-12-31', {}), null);
  assert.equal(toRelativeMonths('2023-12-31', { announce_date: 'unknown' }), null);
  // Anchor AFTER signing: a look-back cannot end in the future.
  assert.equal(toRelativeMonths('2025-01-01', DEAL), null);
});

test('single "since/from <date> until <boilerplate>" prose keeps the anchor', () => {
  // One literal date + signing-boilerplate tail (real corpus value shape) —
  // the business-day phrase must not block the date read.
  assert.equal(
    toRelativeMonths(
      'from January 1, 2023 until the date that is one (1) Business Day prior to the execution of this Agreement',
      { announce_date: '2024-09-04' },
    ),
    20,
  );
});

// -- distribution fixture: MARKET_RANGE parallel months-before-signing ----

function citable(value) {
  return { value, quotes: ['supporting quote'] };
}

function repProvision(dealId, id, lookbackDateISO) {
  return {
    id,
    deal_id: dealId,
    type: 'REP-T',
    category: 'Representations',
    full_text: 'Since the look-back date, no Material Adverse Effect has occurred.',
    ai_metadata: { features: { lookbackDateISO: citable(lookbackDateISO) } },
  };
}

test('MARKET_RANGE adds a parallel months-before-signing distribution for a registry field', () => {
  const deals = [
    { id: 'd1', acquirer: 'B1', target: 'T1', value_usd: 1e9, announce_date: '2024-04-02', sector: 'Tech' },
    { id: 'd2', acquirer: 'B2', target: 'T2', value_usd: 2e9, announce_date: '2025-05-04', sector: 'Tech' },
    // No signing date on file -> excluded-and-counted, never guessed.
    { id: 'd3', acquirer: 'B3', target: 'T3', value_usd: 5e8, announce_date: null, sector: 'Tech' },
  ];
  const provisions = [
    repProvision('d1', 'p1', '2023-12-31'), // 3 months before signing
    repProvision('d2', 'p2', '2022-01-01'), // 40 months before signing
    repProvision('d3', 'p3', '2023-12-31'), // no signing date -> null
  ];
  const result = executeMarketRange(
    { provision_type: 'REPRESENTATION', field_path: 'lookbackDateISO', deal_filter: {} },
    { deals, provisions },
  );

  // Existing fields untouched: raw dates still flow through as before.
  assert.equal(result.n, 3);
  assert.equal(result.stats, null); // date field is non-numeric, as before

  assert.ok(result.relativeMonthsStats, 'relativeMonthsStats should be present');
  assert.equal(result.relativeMonthsStats.unit, RELATIVE_MONTHS_UNIT);
  assert.equal(result.relativeMonthsStats.n, 2);
  assert.equal(result.relativeMonthsStats.excludedCount, 1);
  assert.equal(result.relativeMonthsStats.min, 3);
  assert.equal(result.relativeMonthsStats.max, 40);

  const byDeal = new Map(result.deal_points.map((point) => [point.deal_id, point]));
  assert.equal(byDeal.get('d1').relative_months, 3);
  assert.equal(byDeal.get('d2').relative_months, 40);
  assert.equal(byDeal.get('d3').relative_months, null);
});

test('MARKET_RANGE does not add relativeMonthsStats for a non-registry date field', () => {
  const deals = [
    { id: 'd1', acquirer: 'B1', target: 'T1', value_usd: 1e9, announce_date: '2024-04-02' },
  ];
  const provisions = [
    {
      id: 'p1',
      deal_id: 'd1',
      type: 'TERMR',
      category: 'Termination',
      full_text: 'The outside date is January 2, 2025.',
      ai_metadata: { features: { outsideDateISO: citable('2025-01-02') } },
    },
  ];
  const result = executeMarketRange(
    { provision_type: 'TERMINATION_RIGHT', field_path: 'outsideDateISO', deal_filter: {} },
    { deals, provisions },
  );
  assert.equal(result.relativeMonthsStats, null);
  assert.equal(result.deal_points.every((point) => !('relative_months' in point)), true);
});

// -- sidebar path: corpus-stats rowContext distribution -------------------

const { buildRelativePeriodDistribution } = require('../../lib/queries/corpus-stats-core');

test('sidebar rowContext distributes look-back fields as months before signing', () => {
  const dealsById = new Map([
    ['d1', { id: 'd1', name: 'Buyer1 / Target1' }],
    ['d2', { id: 'd2', name: 'Buyer2 / Target2' }],
    ['d3', { id: 'd3', name: 'Buyer3 / Target3' }],
    ['d4', { id: 'd4', name: 'Buyer4 / Target4' }],
  ]);
  const dealMetaById = new Map([
    ['d1', { id: 'd1', announce_date: '2024-04-02' }],
    ['d2', { id: 'd2', announce_date: '2025-05-04' }],
    ['d3', { id: 'd3', announce_date: '2024-02-15' }],
    ['d4', { id: 'd4', announce_date: null }], // no signing date
  ]);
  const cardIdByKey = new Map([['d1|e1', 'card-1']]);
  const claims = [
    { deal_id: 'd1', attribute: 'absenceOfChangesStartDate', canonical: null, verbatim: 'December 31, 2023', provenance: {}, excerpt_id: 'e1' }, // 3 months
    { deal_id: 'd2', attribute: 'absenceOfChangesStartDate', canonical: '2022-01-01', verbatim: 'January 1, 2022', provenance: {}, excerpt_id: null }, // 40 months
    // Defined-term anchor -> excluded-and-counted, never guessed.
    { deal_id: 'd3', attribute: 'absenceOfChangesStartDate', canonical: null, verbatim: 'the Company Balance Sheet Date', provenance: {}, excerpt_id: null },
    // Parseable date, but the deal has no signing date -> excluded too.
    { deal_id: 'd4', attribute: 'absenceOfChangesStartDate', canonical: '2023-12-31', verbatim: 'December 31, 2023', provenance: {}, excerpt_id: null },
  ];
  const dist = buildRelativePeriodDistribution('absenceOfChangesStartDate', claims, 'd1', dealsById, cardIdByKey, dealMetaById);
  assert.ok(dist);
  assert.equal(dist.kind, 'numeric');
  assert.equal(dist.unit, RELATIVE_MONTHS_UNIT);
  assert.equal(dist.basis, 'months-before-signing');
  assert.equal(dist.count, 2);
  assert.equal(dist.excludedCount, 2);
  assert.equal(dist.min, 3);
  assert.equal(dist.max, 40);
  assert.equal(dist.thisDealValue, 3);
  assert.equal(dist.thisDealRank, 1);
  // Point list is in months, sorted ascending, with deal links intact.
  assert.deepEqual(dist.values.map((v) => v.value), [3, 40]);
  assert.equal(dist.values[0].cardId, 'card-1');
});

test('sidebar rowContext returns null when no peer value converts', () => {
  const dist = buildRelativePeriodDistribution(
    'aocNoMaeSinceDate',
    [{ deal_id: 'd1', attribute: 'aocNoMaeSinceDate', canonical: null, verbatim: 'the Balance Sheet Date', provenance: {}, excerpt_id: null }],
    null,
    new Map(),
    new Map(),
    new Map([['d1', { announce_date: '2024-04-02' }]]),
  );
  assert.equal(dist, null);
});

test('pages/api/corpus-stats.js routes registry fields to the relative distribution', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'pages', 'api', 'corpus-stats.js'), 'utf8');
  assert.match(src, /isRelativePeriodField\(attribute\)/,
    'buildFeatureDistribution must branch on isRelativePeriodField');
  assert.match(src, /buildRelativePeriodDistribution\(/,
    'the relative branch must use the shared core builder');
});

test('parseAnchorDate handles the corpus forms', () => {
  assert.equal(parseAnchorDate('2023-09-30').toISOString().slice(0, 10), '2023-09-30');
  assert.equal(parseAnchorDate('September 30, 2023').toISOString().slice(0, 10), '2023-09-30');
  assert.equal(parseAnchorDate('the Company Balance Sheet Date'), null);
  assert.equal(parseAnchorDate('a; b'), null);
});
