const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPostgresServingClient,
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
    return Promise.resolve({ rowCount: 1, rows: [{ data: { ok: true } }] });
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

  assert.deepEqual(response, { data: { ok: true }, error: null });
  assert.equal(pool.options.max, 1);
  assert.equal(pool.options.connectionTimeoutMillis, 1000);
  assert.equal(pool.options.query_timeout, 3000);
  assert.equal(pool.options.statement_timeout, 2500);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /^SELECT public\.canonical_v2_active_review_context\(/);
  assert.deepEqual(pool.calls[0].values, Object.values(params));
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
      return Promise.reject(new Error('sensitive database detail'));
    }
  }
  const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: FailingPool });
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
  assert.deepEqual(response, { data: null, error: { message: 'Canonical serving query failed.' } });
  assert.doesNotMatch(response.error.message, /sensitive/);
});
