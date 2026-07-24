const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPostgresServingClient,
  MAX_EXACT_DETAIL_RESULT_BYTES,
  MAX_REVIEW_RESULT_ROWS,
  validateConnectionString,
} = require('../lib/canonical-v2/serving-client');

const CONNECTION = 'postgresql://canonical_v2_preview.sjumbznveyyiizhwvixj:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true';

class FakePool {
  static instances = [];

  constructor(options) {
    this.options = options;
    this.calls = [];
    FakePool.instances.push(this);
  }

  query(command) {
    this.calls.push(command);
    return Promise.resolve({ rowCount: 1, rows: [{ data: { ok: true, rows: [] } }] });
  }
}

test('serving client accepts only the dedicated projection-project transaction-pooler role', () => {
  assert.equal(validateConnectionString(CONNECTION), CONNECTION);
  assert.throws(() => validateConnectionString(CONNECTION.replace('sjumbznveyyiizhwvixj', 'tzulhdasmioeechxapdy')), /outside/);
  assert.throws(() => validateConnectionString(CONNECTION.replace(':6543/', ':5432/')), /outside/);
  assert.throws(() => validateConnectionString(CONNECTION.replace('canonical_v2_preview', 'postgres')), /outside/);
  assert.throws(() => validateConnectionString(CONNECTION.replace('&uselibpqcompat=true', '')), /outside/);
});

test('one Review request executes one typed SQL function call through a one-connection pool', async () => {
  FakePool.instances.length = 0;
  const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: FakePool });
  const params = {
    p_environment: 'staging',
    p_contract_fingerprint: 'a'.repeat(64),
    p_request_digest: 'b'.repeat(64),
    p_application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    p_page_size: 100,
    p_after_row_serving_key: null,
  };
  const response = await client.rpc('canonical_v2_active_review_context', params);
  const pool = FakePool.instances[0];

  assert.deepEqual(response, { data: { ok: true, rows: [] }, error: null });
  assert.equal(pool.options.max, 1);
  assert.equal(pool.options.connectionTimeoutMillis, 1000);
  assert.equal(pool.options.query_timeout, 3000);
  assert.equal(pool.options.statement_timeout, 2500);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /^SELECT public\.canonical_v2_active_review_context\(/);
  assert.deepEqual(pool.calls[0].values, Object.values(params));
});

test('Review RPC work remains one set-based call when corpus metadata grows', async () => {
  const params = {
    p_environment: 'staging',
    p_contract_fingerprint: 'a'.repeat(64),
    p_request_digest: 'b'.repeat(64),
    p_application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    p_page_size: 100,
    p_after_row_serving_key: null,
  };

  for (const totalCount of [1, 1_000_000]) {
    class CorpusSizedPool extends FakePool {
      query(command) {
        this.calls.push(command);
        return Promise.resolve({
          rowCount: 1,
          rows: [{ data: { total_count: totalCount, rows: [] } }],
        });
      }
    }
    const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: CorpusSizedPool });
    const response = await client.rpc('canonical_v2_active_review_context', params);
    const pool = FakePool.instances.at(-1);

    assert.equal(response.error, null);
    assert.equal(response.data.total_count, totalCount);
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0].text, /^SELECT public\.canonical_v2_active_review_context\(/);
  }
});

test('serving client fails closed when SQL-row, payload-row, or byte ceilings are exceeded', async () => {
  const reviewParams = {
    p_environment: 'staging',
    p_contract_fingerprint: 'a'.repeat(64),
    p_request_digest: 'b'.repeat(64),
    p_application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    p_page_size: 100,
    p_after_row_serving_key: null,
  };
  const exactParams = {
    p_environment: 'staging',
    p_serving_namespace_id: 'a'.repeat(64),
    p_corpus_release_id: 'b'.repeat(64),
    p_contract_fingerprint: 'c'.repeat(64),
    p_application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    p_row_serving_key: 'd'.repeat(64),
    p_source_detail_reference_id: 'e'.repeat(64),
  };
  const cases = [
    {
      name: 'SQL rows',
      rpc: 'canonical_v2_active_review_context',
      params: reviewParams,
      result: { rowCount: 2, rows: [{ data: { rows: [] } }, { data: { rows: [] } }] },
    },
    {
      name: 'payload rows',
      rpc: 'canonical_v2_active_review_context',
      params: reviewParams,
      result: {
        rowCount: 1,
        rows: [{ data: { rows: Array.from({ length: MAX_REVIEW_RESULT_ROWS + 1 }, () => ({})) } }],
      },
    },
    {
      name: 'payload bytes',
      rpc: 'canonical_v2_exact_detail',
      params: exactParams,
      result: {
        rowCount: 1,
        rows: [{ data: { payload: 'x'.repeat(MAX_EXACT_DETAIL_RESULT_BYTES) } }],
      },
    },
  ];

  for (const entry of cases) {
    class OversizedPool extends FakePool {
      query(command) {
        this.calls.push(command);
        return Promise.resolve(entry.result);
      }
    }
    const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: OversizedPool });
    const response = await client.rpc(entry.rpc, entry.params);
    const pool = FakePool.instances.at(-1);

    assert.equal(response.data, null, entry.name);
    assert.match(response.error.message, /exceeded its bounds/, entry.name);
    assert.equal(pool.calls.length, 1, entry.name);
  }
});

test('unknown RPCs and parameter drift fail before a database call', async () => {
  FakePool.instances.length = 0;
  const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: FakePool });
  const pool = FakePool.instances[0];
  const unknown = await client.rpc('canonical_v2_write', {});
  const drifted = await client.rpc('canonical_v2_exact_detail', { p_environment: 'staging' });

  assert.ok(unknown.error);
  assert.ok(drifted.error);
  assert.equal(pool.calls.length, 0);
});

test('database errors are returned once without retries or diagnostics leakage', async () => {
  class FailingPool extends FakePool {
    query(command) {
      this.calls.push(command);
      return Promise.reject(Object.assign(new Error('sensitive database detail'), {
        code: '42501',
        severity: 'ERROR',
        routine: 'aclcheck_error',
        constraint: 'safe_constraint_name',
      }));
    }
  }
  const diagnostics = [];
  const client = createPostgresServingClient({
    connectionString: CONNECTION,
    PoolClass: FailingPool,
    onError(details) { diagnostics.push(details); },
  });
  const pool = FakePool.instances.at(-1);
  const response = await client.rpc('canonical_v2_exact_detail', {
    p_environment: 'staging',
    p_serving_namespace_id: 'a'.repeat(64),
    p_corpus_release_id: 'b'.repeat(64),
    p_contract_fingerprint: 'c'.repeat(64),
    p_application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    p_row_serving_key: 'd'.repeat(64),
    p_source_detail_reference_id: 'e'.repeat(64),
  });

  assert.equal(pool.calls.length, 1);
  assert.deepEqual(diagnostics, [{
    rpc: 'canonical_v2_exact_detail',
    code: '42501',
    severity: 'ERROR',
    routine: 'aclcheck_error',
    constraint: 'safe_constraint_name',
  }]);
  assert.doesNotMatch(JSON.stringify(diagnostics), /sensitive/);
  assert.deepEqual(response, { data: null, error: { message: 'Canonical serving query failed.' } });
  assert.doesNotMatch(response.error.message, /sensitive/);
});
