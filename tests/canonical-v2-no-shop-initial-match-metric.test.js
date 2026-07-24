// Tests for the D3 widening (docs/handoffs/SPEC-QUERY-METRICS-WIDENING-
// 2026-07-23.md): serving NO_SHOP_INITIAL_MATCH_PERIOD_DAYS through
// lib/canonical-v2/query-result.js. Covers the spec's numbered test groups
// 1, 2 and 4. Group 3 (mapper routing) and group 5 (refinementOptionsFromView)
// live in tests/canonical-v2-legacy-query-mapper.test.js, alongside the rest
// of that module's coverage.
//
// The whole safety case for this widening is that
// FIXTURE_CONTRACT_FINGERPRINT (compiled from contract-bundle.js inputs
// only) must not move — this file pins that value against a real fixture
// row's provenance so any accidental drift, from this change or any future
// one, fails loudly.

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { buildMultiDealCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const {
  CanonicalQueryError,
  FIXTURE_CONTRACT_FINGERPRINT,
  QUERY_METRICS,
  compileCanonicalActiveQueryRequest,
} = require('../lib/canonical-v2/query-result');

// Party sourced verbatim from the frozen reviewed no-shop slice's
// canonical_result.party for the NOSOL-MATCH concept — see
// lib/canonical-v2/reviewed-no-shop-slice.js:24 (BUYER_PARTY definition) and
// its NOSOL-MATCH result spec at lines 503-512. Also confirmed against the
// frozen QXO no-shop slice (lib/canonical-v2/reviewed-qxo-no-shop-slice.js:20
// and lines 211-220): both frozen reviewed slices agree on this tuple.
const NO_SHOP_MATCH_PARTY = Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' });

function bodyFor(row, overrides = {}) {
  const body = row.canonical_result;
  const market = body.market_context;
  return {
    intent: 'MARKET_RANGE',
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: body.concept_key,
    party: body.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
    ...overrides,
  };
}

// ── 1. Fingerprint pin ───────────────────────────────────────────────────────

test('1. FIXTURE_CONTRACT_FINGERPRINT matches the Landos no-shop-match row\'s own provenance fingerprint', () => {
  const fixture = buildLandosNoShopServingFixture();
  const row = fixture.rows.find(
    (candidate) => candidate.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  assert.ok(row, 'the Landos no-shop fixture must expose a NO_SHOP_INITIAL_MATCH_PERIOD_DAYS row');
  assert.equal(row.canonical_result.concept_key, 'NOSOL-MATCH');
  assert.equal(row.provenance.contract_fingerprint, FIXTURE_CONTRACT_FINGERPRINT);
});

// ── 2. QUERY_METRICS / DEFAULT_COLUMNS pin ──────────────────────────────────

test('2a. QUERY_METRICS contains exactly the 6 expected governed metric keys', () => {
  assert.deepEqual([...QUERY_METRICS].sort(), [
    'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    'NO_SHOP_NOTICE_PERIOD_DAYS',
    'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  ].sort());
});

test('2b. the 4 pre-existing metrics\' default columns are unchanged by this widening', () => {
  const feeRow = buildLandosTerminationFeeServingFixture().row;
  const iocRow = buildLandosIocCapexServingFixture().row;
  const materialRow = buildLandosMaterialContractsServingFixture().row;
  const noticeRow = buildMultiDealCandidateReleaseFixture().release.shared_rows.find(
    (candidate) => candidate.row_kind === 'CANONICAL_RESULT'
      && candidate.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  );

  assert.deepEqual(
    compileCanonicalActiveQueryRequest(bodyFor(feeRow)).selected_columns,
    ['deal', 'buyer', 'percent_of_deal_value', 'raw_value', 'fee_side', 'payer', 'payee', 'triggers', 'source'],
  );
  assert.deepEqual(
    compileCanonicalActiveQueryRequest(bodyFor(materialRow)).selected_columns,
    ['deal', 'buyer', 'percent_of_deal_value', 'raw_value', 'material_contract_criterion', 'measurement_period', 'source'],
  );
  assert.deepEqual(
    compileCanonicalActiveQueryRequest(bodyFor(iocRow)).selected_columns,
    ['deal', 'buyer', 'percent_of_deal_value', 'raw_value', 'party', 'source'],
  );
  assert.deepEqual(
    compileCanonicalActiveQueryRequest(bodyFor(noticeRow)).selected_columns,
    ['deal', 'buyer', 'party', 'duration', 'day_basis', 'trigger', 'source'],
  );
});

test('2c. the new metric\'s default columns are modeled on the notice metric\'s, invented no new keys', () => {
  const matchRow = buildLandosNoShopServingFixture().rows.find(
    (candidate) => candidate.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  assert.deepEqual(
    compileCanonicalActiveQueryRequest(bodyFor(matchRow)).selected_columns,
    ['deal', 'buyer', 'party', 'duration', 'day_basis', 'trigger', 'source'],
  );
});

// ── 4. Endpoint-level compile ────────────────────────────────────────────────

test('4a. the new metric request compiles through the real compileCanonicalActiveQueryRequest', () => {
  const matchRow = buildLandosNoShopServingFixture().rows.find(
    (candidate) => candidate.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  const compiled = compileCanonicalActiveQueryRequest(bodyFor(matchRow));
  assert.equal(compiled.schema_version, 'CANONICAL_ACTIVE_QUERY_SEMANTICS/V1');
  assert.equal(compiled.metric_key, 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');
  assert.equal(compiled.metric_version, 1);
  assert.equal(compiled.concept_key, 'NOSOL-MATCH');
  assert.equal(compiled.basis_key, 'DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE');
  assert.deepEqual(compiled.party, NO_SHOP_MATCH_PARTY);
  assert.equal(compiled.page_size, 25);
});

test('4b. fee-only column_filters (fee_side etc.) are rejected with INVALID_REQUEST for this metric', () => {
  const matchRow = buildLandosNoShopServingFixture().rows.find(
    (candidate) => candidate.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  assert.throws(
    () => compileCanonicalActiveQueryRequest(bodyFor(matchRow, { column_filters: { fee_side: 'SELLER' } })),
    (error) => error instanceof CanonicalQueryError
      && error.code === 'INVALID_REQUEST'
      && /fee refinements require a governed termination fee metric/.test(error.message),
  );
  assert.throws(
    () => compileCanonicalActiveQueryRequest(bodyFor(matchRow, {
      column_filters: { min_percent_of_deal_value: '0.5' },
    })),
    (error) => error instanceof CanonicalQueryError
      && error.code === 'INVALID_REQUEST'
      && /percentage refinements require/.test(error.message),
  );
});
