const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review-v2', 'marketSummaryHelpers.js'));
});

test('mixed categorical and numeric corpus summaries normalise without assuming values exists', () => {
  const payload = [
    {
      attribute: 'boardChangeStandard',
      label: 'Board-change standard',
      values: [{ value: 'FIDUCIARY_DUTIES', label: 'Fiduciary duties', count: 18 }],
    },
    {
      attribute: 'noticePeriod',
      label: 'Notice period',
      kind: 'numeric',
      unit: 'business_days',
      min: 2,
      p25: 3,
      median: 4,
      p75: 4,
      max: 5,
      count: 31,
    },
  ];

  const summaries = payload.map(mod.normalizeFeatureSummary);
  assert.equal(summaries[0].kind, 'categorical');
  assert.deepEqual(summaries[0].values, [{ value: 'FIDUCIARY_DUTIES', label: 'Fiduciary duties', count: 18 }]);
  assert.equal(summaries[1].kind, 'numeric');
  assert.equal(summaries[1].unit, 'business days');
  assert.equal(summaries[1].median, 4);
  assert.equal('values' in summaries[1], false);
  assert.equal(mod.formatFeatureSummaryNumber(summaries[1].median, summaries[1].unit), '4 business days');
});

test('malformed categorical values fail closed to an empty distribution', () => {
  const summary = mod.normalizeFeatureSummary({ attribute: 'noticeContent', label: 'Notice content', values: null });
  assert.equal(summary.kind, 'categorical');
  assert.deepEqual(summary.values, []);
});

test('numeric summaries are inferred from quartiles during mixed API-version responses', () => {
  const summary = mod.normalizeFeatureSummary({ attribute: 'matchingPeriod', label: 'Matching period', min: '2', median: '4', max: '5', count: '23' });
  assert.equal(summary.kind, 'numeric');
  assert.equal(summary.min, 2);
  assert.equal(summary.median, 4);
  assert.equal(summary.max, 5);
  assert.equal(summary.count, 23);
});

test('duration display helpers humanize strict canonical clocks', () => {
  assert.equal(mod.formatFeatureSummaryNumber(4, 'business_days'), '4 business days');
  assert.equal(mod.formatFeatureSummaryNumber(1, 'calendar_days'), '1 calendar day');
  assert.equal(mod.formatFeatureSummaryNumber(96, 'elapsed_hours'), '96 elapsed hours');
  assert.equal(mod.formatFeatureSummaryUnit('business_days'), 'business days');
  assert.equal(mod.isDurationFeatureSummaryUnit('elapsed_hours'), true);
  assert.equal(mod.isDurationFeatureSummaryUnit('USD'), false);
});

test('money cohorts require an exact subject deal-value basis', () => {
  const distribution = {
    normalised: {
      cohorts: [
        { basis: 'enterprise_value', percent: { stats: { median: 1.2 } } },
        { basis: 'equity_value', percent: { stats: { median: 0.8 } } },
      ],
    },
  };

  assert.equal(mod.matchingMoneyCohort(distribution, 'equity_value').basis, 'equity_value');
  assert.equal(mod.matchingMoneyCohort(distribution, 'headline_transaction_value'), null);
  assert.equal(mod.matchingMoneyCohort(distribution, null), null);
});
