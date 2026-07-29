const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { buildQueryCohortSummary } = require('../__fixtures__/canonical-v2/query-cohort-summary');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { isCanonicalV2QueryEnabled } = require('../lib/canonical-v2/feature-flags');
const {
  MAX_REQUEST_BYTES,
  createCanonicalQueryHandler,
} = require('../lib/canonical-v2/query-api-handler');
const {
  MAX_QUERY_RESULT_BYTES,
  RPC_SPECS,
  boundedRpcData,
  createPostgresServingClient,
} = require('../lib/canonical-v2/serving-client');

const CONNECTION = 'postgresql://canonical_v2_preview.sjumbznveyyiizhwvixj:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true';
const ACTIVE_POINTER_ID = contentId('ACTIVE_POINTER/V1', 'query-api-test');
const ACTIVE_NAMESPACE_ID = contentId('SERVING_NAMESPACE/V1', 'query-api-test');

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

function resultFor(params, rows, identity = {}) {
  return {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
    cache_state: 'MISS',
    pointer_id: identity.pointer_id || ACTIVE_POINTER_ID,
    serving_namespace_id: identity.serving_namespace_id || ACTIVE_NAMESPACE_ID,
    corpus_release_id: identity.corpus_release_id || rows[0]?.corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    query_semantics_digest: params.p_query_semantics_digest,
    total_count: rows.length,
    page_count: rows.length,
    cohort_summary: buildQueryCohortSummary({ params, rows }),
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
  let responseCacheState = 'MISS';
  const handler = createCanonicalQueryHandler({
    enabled: true,
    getClient: () => ({
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({
          data: { ...resultFor(params, [row]), cache_state: responseCacheState },
          error: null,
        });
      },
    }),
  });
  const res = responseRecorder();

  await handler({ method: 'POST', body: requestFor(row) }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_active_query_page_v2');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(Object.hasOwn(calls[0].params, 'p_serving_namespace_id'), false);
  assert.equal(Object.hasOwn(calls[0].params, 'p_corpus_release_id'), false);
  assert.equal(calls[0].params.p_page_size, 25);
  assert.equal(res.body.schema_version, 'CANONICAL_QUERY_RESULT_VIEW/V2');
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.pointer_id, ACTIVE_POINTER_ID);
  assert.equal(res.body.serving_namespace_id, ACTIVE_NAMESPACE_ID);
  assert.equal(res.body.corpus_release_id, row.corpus_release_id);
  assert.match(res.headers['Cache-Control'], /s-maxage=60/);
  assert.match(res.headers.ETag, /^"[a-f0-9]{64}"$/);
  assert.equal(res.headers['X-Canonical-Cache'], 'MISS');
  responseCacheState = 'HIT';
  const hit = responseRecorder();
  await handler({ method: 'POST', body: requestFor(row) }, hit);
  assert.equal(hit.statusCode, 200);
  assert.equal(hit.headers['X-Canonical-Cache'], 'HIT');
  assert.equal(calls.length, 2);
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

test('public Query rejects injected pinned-release identity before database work', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  let rpcCalls = 0;
  const handler = createCanonicalQueryHandler({
    enabled: true,
    getClient: () => ({ rpc() { rpcCalls += 1; } }),
  });
  for (const injected of [
    { serving_namespace_id: 'a'.repeat(64) },
    { corpus_release_id: 'b'.repeat(64) },
    { contract_fingerprint: 'c'.repeat(64) },
    { release_selector: 'PINNED' },
  ]) {
    const res = responseRecorder();
    await handler({ method: 'POST', body: { ...requestFor(row), ...injected } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_REQUEST');
  }
  assert.equal(rpcCalls, 0);
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

test('serving client exposes Query V2 through one typed staging-role RPC and maps database capacity without retry', async () => {
  class QueryPool {
    static instances = [];
    static failureCode = null;

    constructor(options) {
      this.options = options;
      this.calls = [];
      QueryPool.instances.push(this);
    }

    query(command) {
      this.calls.push(command);
      if (QueryPool.failureCode) return Promise.reject({ code: QueryPool.failureCode });
      return Promise.resolve({ rowCount: 1, rows: [{ data: { rows: [] } }] });
    }
  }
  const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: QueryPool });
  const params = {
    p_environment: 'staging',
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

  const response = await client.rpc('canonical_v2_active_query_page_v2', params);
  const pool = QueryPool.instances[0];

  assert.equal(response.error, null);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /^SELECT public\.canonical_v2_active_query_page_v2\(/);
  assert.deepEqual(pool.calls[0].values, Object.values(params));
  assert.equal(pool.options.max, 1);
  QueryPool.failureCode = '55P03';
  const capacity = await client.rpc('canonical_v2_active_query_page_v2', params);
  assert.equal(capacity.error.code, 'AT_CAPACITY');
  assert.equal(pool.calls.length, 2);
});

test('serving client rejects an oversized Query page after one RPC', async () => {
  assert.equal(MAX_QUERY_RESULT_BYTES, 1024 * 1024);
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

  const response = await client.rpc('canonical_v2_active_query_page_v2', params);

  assert.equal(response.data, null);
  assert.match(response.error.message, /exceeded its bounds/);
});

test('Query serving rejects a one-row response above the 1 MiB byte ceiling', () => {
  const response = boundedRpcData({
    rowCount: 1,
    rows: [{ data: { rows: [{ payload: 'x'.repeat(MAX_QUERY_RESULT_BYTES) }] } }],
  }, RPC_SPECS.canonical_v2_active_query_page);
  assert.equal(response.data, null);
  assert.match(response.error.message, /exceeded its bounds/);
});

test('canonical Query route is contained before serving-client creation', () => {
  const route = fs.readFileSync('pages/api/canonical-v2/query.js', 'utf8');
  const marketStatsRoute = fs.readFileSync('pages/api/market-stats.js', 'utf8');
  assert.match(route, /lib\/query-containment/);
  assert.doesNotMatch(route, /isCanonicalV2QueryEnabled|getCanonicalV2ServingClient|process\.env/);
  assert.match(marketStatsRoute, /marketStatsContainedHandler/);
  assert.doesNotMatch(marketStatsRoute, /supabase|row-market-stats|market-metrics/i);
  assert.doesNotMatch(route, /market-stats|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE/);
});
