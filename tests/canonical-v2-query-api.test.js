const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { isCanonicalV2QueryEnabled } = require('../lib/canonical-v2/feature-flags');
const {
  MAX_REQUEST_BYTES,
  createCanonicalQueryHandler,
} = require('../lib/canonical-v2/query-api-handler');
const { createPostgresServingClient } = require('../lib/canonical-v2/serving-client');

const CONNECTION = 'postgresql://canonical_v2_preview.sjumbznveyyiizhwvixj:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true';

function responseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function requestFor(row, overrides = {}) {
  const body = row.canonical_result;
  const market = body.market_context;
  return {
    serving_namespace_id: contentId('SERVING_NAMESPACE/V1', 'query-api-test'),
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: row.provenance.contract_fingerprint,
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

function resultFor(params, rows) {
  return {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V1',
    serving_namespace_id: params.p_serving_namespace_id,
    corpus_release_id: params.p_corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    query_semantics_digest: params.p_query_semantics_digest,
    total_count: rows.length,
    page_count: rows.length,
    rows,
    next_cursor: null,
  };
}

test('canonical Query is feature-gated closed and never acquires a client by default', async () => {
  assert.equal(isCanonicalV2QueryEnabled({}), false);
  assert.equal(isCanonicalV2QueryEnabled({ CANONICAL_V2_QUERY_ENABLED: 'true' }), true);
  let clientCalls = 0;
  const handler = createCanonicalQueryHandler({
    enabled: false,
    getClient() { clientCalls += 1; return {}; },
  });
  const res = responseRecorder();

  await handler({ method: 'POST', body: {} }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'FEATURE_DISABLED');
  assert.equal(clientCalls, 0);
});

test('canonical Query route performs one bounded RPC and returns a release-aware cache contract', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const calls = [];
  const handler = createCanonicalQueryHandler({
    enabled: true,
    getClient: () => ({
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({ data: resultFor(params, [row]), error: null });
      },
    }),
  });
  const res = responseRecorder();

  await handler({ method: 'POST', body: requestFor(row) }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_query_page');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(calls[0].params.p_page_size, 25);
  assert.equal(res.body.schema_version, 'CANONICAL_QUERY_RESULT_VIEW/V1');
  assert.equal(res.body.rows.length, 1);
  assert.match(res.headers['Cache-Control'], /s-maxage=60/);
  assert.match(res.headers.ETag, /^"[a-f0-9]{64}"$/);
  assert.equal(res.headers['X-Canonical-Cache'], 'MISS');
});

test('canonical Query rejects oversized and invalid requests without database work', async () => {
  let clientCalls = 0;
  const handler = createCanonicalQueryHandler({
    enabled: true,
    getClient() { clientCalls += 1; return { rpc() { throw new Error('must not run'); } }; },
  });
  const oversized = responseRecorder();
  await handler({ method: 'POST', body: JSON.stringify({ value: 'x'.repeat(MAX_REQUEST_BYTES) }) }, oversized);
  assert.equal(oversized.statusCode, 413);
  assert.equal(oversized.body.error.code, 'REQUEST_TOO_LARGE');

  const invalid = responseRecorder();
  await handler({ method: 'POST', body: [] }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.error.code, 'INVALID_REQUEST');
  assert.equal(clientCalls, 0);
});

test('canonical Query isolates failures, applies local capacity, and never retries', async () => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let rpcCalls = 0;
  let currentTime = 1_000;
  const handler = createCanonicalQueryHandler({
    enabled: true,
    maxConcurrent: 1,
    failureThreshold: 1,
    cooldownMs: 10_000,
    now: () => currentTime,
    getClient: () => ({
      async rpc() {
        rpcCalls += 1;
        await blocked;
        return { data: null, error: { message: 'sensitive database detail' } };
      },
    }),
  });
  const row = buildLandosTerminationFeeServingFixture().row;
  const firstRes = responseRecorder();
  const first = handler({ method: 'POST', body: requestFor(row) }, firstRes);
  await new Promise((resolve) => setImmediate(resolve));

  const busy = responseRecorder();
  await handler({ method: 'POST', body: requestFor(row) }, busy);
  assert.equal(busy.body.error.code, 'AT_CAPACITY');
  assert.equal(rpcCalls, 1);

  release();
  await first;
  assert.equal(firstRes.body.error.code, 'DATA_SOURCE_ERROR');
  assert.doesNotMatch(firstRes.body.error.message, /sensitive/);

  const circuit = responseRecorder();
  await handler({ method: 'POST', body: requestFor(row) }, circuit);
  assert.equal(circuit.body.error.code, 'CIRCUIT_OPEN');
  assert.equal(rpcCalls, 1);

  currentTime += 10_001;
});

test('serving client exposes Query through one typed staging-role RPC with no retry', async () => {
  class QueryPool {
    static instances = [];

    constructor(options) {
      this.options = options;
      this.calls = [];
      QueryPool.instances.push(this);
    }

    query(command) {
      this.calls.push(command);
      return Promise.resolve({ rowCount: 1, rows: [{ data: { rows: [] } }] });
    }
  }
  const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: QueryPool });
  const params = {
    p_environment: 'staging',
    p_serving_namespace_id: 'a'.repeat(64),
    p_corpus_release_id: 'b'.repeat(64),
    p_contract_fingerprint: 'c'.repeat(64),
    p_query_semantics_digest: 'd'.repeat(64),
    p_metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    p_metric_version: 1,
    p_concept_key: 'TERMF-TARGET',
    p_party_role: 'FEE_PAYER',
    p_party_value: 'COMPANY',
    p_party_capacity: 'TARGET',
    p_basis_key: 'PERCENT_OF_DEAL_VALUE',
    p_sector: null,
    p_buyer: null,
    p_merger_form: null,
    p_adviser_either: null,
    p_lawyer_either: null,
    p_year_from: null,
    p_year_to: null,
    p_min_value_usd: null,
    p_max_value_usd: null,
    p_min_canonical_value: null,
    p_max_canonical_value: null,
    p_fee_side: null,
    p_payer_capacity: null,
    p_payee_capacity: null,
    p_trigger_code: null,
    p_payment_timing: null,
    p_trigger_condition: null,
    p_criterion_code: null,
    p_contract_scope_code: null,
    p_cash_flow_direction_code: null,
    p_measurement_period_code: null,
    p_comparison_operator: null,
    p_page_size: 25,
    p_after_governed_deal_key: null,
    p_after_row_serving_key: null,
  };

  const response = await client.rpc('canonical_v2_query_page', params);
  const pool = QueryPool.instances[0];

  assert.equal(response.error, null);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /^SELECT public\.canonical_v2_query_page\(/);
  assert.deepEqual(pool.calls[0].values, Object.values(params));
  assert.equal(pool.options.max, 1);
});

test('serving client rejects an oversized Query page after one RPC', async () => {
  class OversizedQueryPool {
    constructor() {
      this.calls = [];
    }

    query(command) {
      this.calls.push(command);
      return Promise.resolve({
        rowCount: 1,
        rows: [{ data: { rows: Array.from({ length: 51 }, () => ({})) } }],
      });
    }
  }
  const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: OversizedQueryPool });
  const params = {
    p_environment: 'staging',
    p_serving_namespace_id: 'a'.repeat(64),
    p_corpus_release_id: 'b'.repeat(64),
    p_contract_fingerprint: 'c'.repeat(64),
    p_query_semantics_digest: 'd'.repeat(64),
    p_metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    p_metric_version: 1,
    p_concept_key: 'TERMF-TARGET',
    p_party_role: 'FEE_PAYER',
    p_party_value: 'COMPANY',
    p_party_capacity: 'TARGET',
    p_basis_key: 'PERCENT_OF_DEAL_VALUE',
    p_sector: null,
    p_buyer: null,
    p_merger_form: null,
    p_adviser_either: null,
    p_lawyer_either: null,
    p_year_from: null,
    p_year_to: null,
    p_min_value_usd: null,
    p_max_value_usd: null,
    p_min_canonical_value: null,
    p_max_canonical_value: null,
    p_fee_side: null,
    p_payer_capacity: null,
    p_payee_capacity: null,
    p_trigger_code: null,
    p_payment_timing: null,
    p_trigger_condition: null,
    p_criterion_code: null,
    p_contract_scope_code: null,
    p_cash_flow_direction_code: null,
    p_measurement_period_code: null,
    p_comparison_operator: null,
    p_page_size: 50,
    p_after_governed_deal_key: null,
    p_after_row_serving_key: null,
  };

  const response = await client.rpc('canonical_v2_query_page', params);

  assert.equal(response.data, null);
  assert.match(response.error.message, /exceeded its bounds/);
});

test('Query route remains separate from the contained market-stats route', () => {
  const route = fs.readFileSync('pages/api/canonical-v2/query.js', 'utf8');
  const marketStatsRoute = fs.readFileSync('pages/api/market-stats.js', 'utf8');
  assert.match(route, /isCanonicalV2QueryEnabled/);
  assert.match(route, /getCanonicalV2ServingClient/);
  assert.match(route, /sizeLimit: '32kb'/);
  assert.match(marketStatsRoute, /enabled: false/);
  assert.doesNotMatch(route, /market-stats|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE/);
});
