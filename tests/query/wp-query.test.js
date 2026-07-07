const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runQuery } = require('../../lib/query/engine');
const { QUERY_KINDS, KIND_SLUGS } = require('../../lib/query/types');
const { resolveFeatureValue, resolveKey } = require('../../lib/query/resolve');
const { rawFeatureKeyViolations, rawFeatureKeyViolationsInFile } = require('../../lib/query/lint/no-raw-feature-key');
const { attachVersion, versionedPayload } = require('../../lib/query/version');

const FIELD_PATH = 'field_path';

function feature(value, quote = 'supporting quote') {
  return { value, quotes: [quote] };
}

const deals = [
  { id: 'd1', acquirer: 'Buyer One', target: 'Target One', value_usd: 1000000000, announce_date: '2025-01-15', sector: 'Tech', metadata: { deal_facts: { consideration: { summary: 'Cash' } } } },
  { id: 'd2', acquirer: 'Buyer Two', target: 'Target Two', value_usd: 2000000000, announce_date: '2025-02-15', sector: 'Healthcare', metadata: { deal_facts: { consideration: { summary: 'Stock' } } } },
  { id: 'd3', acquirer: 'Buyer Three', target: 'Target Three', value_usd: 3000000000, announce_date: '2024-03-15', sector: 'Tech', metadata: { deal_facts: { consideration: { summary: 'Mixed' } } } },
];

const provisions = [
  {
    id: 'p1-nosol',
    deal_id: 'd1',
    type: 'NOSOL',
    category: 'No solicitation',
    full_text: 'No-shop with a go-shop and four business day match right.',
    ai_metadata: { features: { go_shop_present: feature(true), initialMatchPeriodDays: feature(4), boardChangeForSuperiorProposal: feature(true) } },
  },
  {
    id: 'p2-nosol',
    deal_id: 'd2',
    type: 'NOSOL',
    category: 'No solicitation',
    full_text: 'No-shop with five business day match right.',
    ai_metadata: { features: { goShopPresent: feature(false), initial_match_period_days: feature(5), boardChangeForSuperiorProposal: feature(true) } },
  },
  {
    id: 'p3-nosol',
    deal_id: 'd3',
    type: 'NOSOL',
    category: 'No solicitation',
    full_text: 'No-shop with three business day match right.',
    ai_metadata: { features: { goShopPresent: feature(true), initialMatchPeriodDays: feature(3), boardChangeForSuperiorProposal: feature(false) } },
  },
  {
    id: 'p1-termf',
    deal_id: 'd1',
    type: 'TERMF',
    category: 'Termination fee',
    full_text: 'Company termination fee equal to three percent of equity value.',
    ai_metadata: { features: { terminationFeePercentEquityValue: feature(3), reverseFeePercentage: feature(6), tailFeeWindowMonths: feature(12) } },
  },
  {
    id: 'p2-termf',
    deal_id: 'd2',
    type: 'TERMF',
    category: 'Termination fee',
    full_text: 'Company termination fee equal to four percent of equity value.',
    ai_metadata: { features: { feePercentage: feature(4), reverseFeePercentage: feature(7), tailPeriod: feature(9) } },
  },
  {
    id: 'p3-termf',
    deal_id: 'd3',
    type: 'TERMF',
    category: 'Termination fee',
    full_text: 'Company termination fee equal to five percent of equity value.',
    ai_metadata: { features: { fee_percentage: feature(5), reverse_fee_percentage: feature(8), tailFeeWindowMonths: feature(6) } },
  },
  {
    id: 'p1-termr',
    deal_id: 'd1',
    type: 'TERMR',
    category: 'Outside date',
    full_text: 'The outside date is six months after signing.',
    ai_metadata: { features: { outside_date_months: feature(6), extensionMaxExercises: feature(1), finalAndNonappealableRequired: feature(true) } },
  },
  {
    id: 'p2-termr',
    deal_id: 'd2',
    type: 'TERMR',
    category: 'Outside date',
    full_text: 'The outside date is nine months after signing.',
    ai_metadata: { features: { outsideDateMonths: feature(9), extensionMaxExercises: feature(2), finalAndNonappealableRequired: feature(false) } },
  },
  {
    id: 'p1-consid',
    deal_id: 'd1',
    type: 'CONSID',
    category: 'Consideration',
    full_text: 'Each share converts into cash consideration.',
    ai_metadata: { features: { consideration_type: feature('cash'), perShareAmount: feature('$10.00') } },
  },
  {
    id: 'p2-consid',
    deal_id: 'd2',
    type: 'CONSID',
    category: 'Consideration',
    full_text: 'Each share converts into stock consideration.',
    ai_metadata: { features: { considerationType: feature('stock'), perShareAmount: feature('0.5 shares') } },
  },
];

const context = { deals, provisions };

test('resolveKey resolves registry aliases and provision values fall back across aliases', () => {
  assert.equal(resolveKey('terminationFeePercentEquityValue'), 'feePercentage');
  const result = resolveFeatureValue('outsideDateMonths', provisions.find((p) => p.id === 'p1-termr'));
  assert.equal(result.key, 'outsideDateMonths');
  assert.equal(result.matchedKey, 'outside_date_months');
  assert.equal(result.raw.value, 6);
});

test('DEAL_COMPARE returns a table with selected deals and requested groups', async () => {
  const result = await runQuery('DEAL_COMPARE', {
    deal_ids: ['d1', 'd2', 'd3'],
    provision_types: ['CONSIDERATION', 'TERMINATION_FEE'],
    highlight_deltas: true,
    included_field_groups: ['primary', 'qualifiers'],
  }, { context });
  assert.equal(result.columns.length, 3);
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every((row) => row.cells.length === 3));
});

test('PROVISION_CROSS_CUT returns rows and evidence for populated columns', async () => {
  const result = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1', 'd2', 'd3'],
    columns: ['go_shop', 'matching_rights_days'],
    sort_by: 'deal_signing_date_desc',
  }, { context });
  assert.equal(result.rows.length, 3);
  assert.ok(result.rows.some((row) => row.cells.some((cell) => cell.value === true)));
  assert.ok(result.rows.some((row) => row.cells.some((cell) => cell.verbatim_quote)));
});

test('MARKET_RANGE returns a well-formed histogram whose counts match n', async () => {
  const result = await runQuery('MARKET_RANGE', {
    provision_type: 'TERMINATION_RIGHT',
    [FIELD_PATH]: 'outsideDateMonths',
    deal_filter: {},
  }, { context });
  assert.ok(result.distribution.length >= 1);
  assert.equal(result.distribution.reduce((sum, bucket) => sum + bucket.count, 0), result.n);
});

test('MARKET_RANGE treats registry usd and percent types as numeric', async () => {
  const result = await runQuery('MARKET_RANGE', {
    provision_type: 'TERMINATION_FEE',
    [FIELD_PATH]: 'fee_amount_percent',
    deal_filter: {},
  }, { context });
  assert.equal(result.field_path, 'feePercentage');
  assert.ok(result.stats);
  assert.equal(result.distribution.reduce((sum, bucket) => sum + bucket.count, 0), 3);
});

test('FILTER_THEN_LIST filters deals by resolved feature aliases', async () => {
  const result = await runQuery('FILTER_THEN_LIST', {
    filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'go_shop', op: 'eq', value: true }],
    columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'],
  }, { context });
  assert.deepEqual(result.rows.map((row) => row.deal_id).sort(), ['d1', 'd3']);
});

test('DEAL_TO_MARKET returns per-feature comparisons with corpus baselines', async () => {
  const result = await runQuery('DEAL_TO_MARKET', {
    deal_id: 'd1',
    comparison_set_filter: {},
    provision_types: ['TERMINATION_FEE'],
  }, { context });
  assert.equal(result.deal_id, 'd1');
  assert.ok(result.scorecard.length >= 1);
  assert.ok(result.scorecard.some((row) => row.field_path === 'feePercentage'));
});

test('raw feature-key lint catches direct feature property access', () => {
  assert.deepEqual(rawFeatureKeyViolations('const x = resolveFeatureValue(key, provision);'), []);
  const violations = rawFeatureKeyViolations('const x = features.terminationFeePercentEquityValue;');
  assert.equal(violations.length, 1);
});

test('saved query payloads are version-pinned without requiring schema columns', () => {
  const payload = versionedPayload({ filters: [], _meta: { user_note: 'keep' } });
  assert.equal(payload._meta.user_note, 'keep');
  assert.equal(payload._meta.schema_version, 'schema-shape-v1');
  assert.equal(payload._meta.query_engine_version, 'query-engine-v1');
  const row = attachVersion({ id: 'sq1', query_payload: payload });
  assert.equal(row.schema_version, 'schema-shape-v1');
  assert.equal(row.query_engine_version, 'query-engine-v1');
});

test('all query kinds have schemas and slugs for + New query wiring', () => {
  assert.equal(QUERY_KINDS.length, 5);
  for (const kind of QUERY_KINDS) {
    assert.ok(KIND_SLUGS[kind]);
    const schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib/query/schemas', `${kind}.json`), 'utf8'));
    assert.equal(schema.type, 'object');
    assert.ok(schema.properties);
  }
});

test('lib/query does not directly access raw feature-key properties', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/query'), { recursive: true })
    .filter((file) => String(file).endsWith('.js'))
    .map((file) => path.join('lib/query', file));
  const violations = files.flatMap((file) => rawFeatureKeyViolationsInFile(file));
  assert.deepEqual(violations, []);
});
