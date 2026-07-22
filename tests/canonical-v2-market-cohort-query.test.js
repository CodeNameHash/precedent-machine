const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  compileMarketCohortRequest,
  queryMarketCohort,
} = require('../lib/canonical-v2/market-cohort-query');
const {
  createPostgresServingClient,
  MAX_MARKET_RESULT_BYTES,
  RPC_SPECS,
} = require('../lib/canonical-v2/serving-client');

const contract = compileFixtureContract();
const id = (domain, value) => contentId(`${domain}/V1`, value);
const CONNECTION = 'postgresql://canonical_v2_preview.sjumbznveyyiizhwvixj:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true';

function request(overrides = {}) {
  return {
    serving_namespace_id: id('SERVING_NAMESPACE', 'candidate'),
    corpus_release_id: id('CORPUS_RELEASE', 'candidate-a'),
    contract_fingerprint: contract.fingerprint,
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    metric_version: 1,
    concept_key: 'COND-B-REP',
    party: { role: 'CONDITION_BENEFICIARY', value: 'BUYER', capacity: 'ACQUIRER' },
    subject_deal_key: 'deal:qxo',
    filters: {
      sector: 'Industrials',
      adviser_either: 'Wachtell',
      lawyer_either: 'Ben Goodchild',
      year_from: 2024,
      year_to: 2026,
      min_value_usd: '100000000.50',
      max_value_usd: '10000000000',
    },
    ...overrides,
  };
}

function resultFor(params) {
  return {
    schema_version: 'MARKET_COHORT_RESULT/V1',
    serving_namespace_id: params.p_serving_namespace_id,
    corpus_release_id: params.p_corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    cohort_digest: params.p_cohort_digest,
    metric_key: params.p_metric_key,
    metric_version: params.p_metric_version,
    concept_key: params.p_concept_key,
    subject_deal_key: params.p_subject_deal_key,
    counts: {
      eligible_deals: 39,
      applicable_deals: 39,
      examined_deals: 38,
      present_deals: 38,
      comparable_deals: 37,
      distribution_deals: 37,
      excluded_deals: 2,
      observation_slots: 37,
      excluded_slots: 2,
    },
    distribution: [
      { canonical_value: 'MAT_ALL_MATERIAL', subject_count: 20, deal_count: 20 },
      { canonical_value: 'MAT_MAE_QUALIFIED', subject_count: 17, deal_count: 17 },
    ],
    exclusions: [
      { reason_code: 'OWNER_RELATIONSHIP_NOT_EXAMINED', slot_count: 2, deal_count: 2 },
    ],
  };
}

class MemoryCache {
  constructor() {
    this.values = new Map();
    this.writes = [];
  }

  async get(key) {
    return this.values.get(key) || null;
  }

  async set(key, value, ttl) {
    this.values.set(key, value);
    this.writes.push({ key, ttl });
  }
}

test('one market request executes exactly one bounded RPC and a release-aware cache hit executes none', async () => {
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({ data: resultFor(params), error: null });
    },
  };
  const cache = new MemoryCache();
  const first = await queryMarketCohort({ client, cache, request: request() });
  const second = await queryMarketCohort({ client, cache, request: request() });

  assert.equal(first.cache, 'MISS');
  assert.equal(second.cache, 'HIT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_market_cohort');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(calls[0].params.p_contract_fingerprint, contract.fingerprint);
  assert.equal(calls[0].params.p_subject_deal_key, 'deal:qxo');
  assert.equal(cache.writes.length, 1);
  assert.equal(cache.writes[0].ttl, 3600);
  assert.equal(first.result.counts.comparable_deals, 37);
});

test('real serving boundary executes one SQL call independent of corpus size and fails closed on overflow', async () => {
  const spec = RPC_SPECS.canonical_v2_market_cohort;
  const instances = [];

  for (const corpusSize of [1, 1_000_000]) {
    class CorpusPool {
      constructor() {
        this.calls = [];
        instances.push(this);
      }

      query(command) {
        this.calls.push(command);
        const params = Object.fromEntries(spec.params.map(([name], index) => [name, command.values[index]]));
        const result = resultFor(params);
        result.counts = {
          eligible_deals: corpusSize,
          applicable_deals: corpusSize,
          examined_deals: corpusSize,
          present_deals: corpusSize,
          comparable_deals: corpusSize,
          distribution_deals: corpusSize,
          excluded_deals: 0,
          observation_slots: corpusSize,
          excluded_slots: 0,
        };
        result.distribution = [{ canonical_value: 'MAT_ALL_MATERIAL', subject_count: corpusSize, deal_count: corpusSize }];
        result.exclusions = [];
        return Promise.resolve({ rowCount: 1, rows: [{ data: result }] });
      }
    }

    const client = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: CorpusPool });
    const queried = await queryMarketCohort({ client, request: request() });
    const pool = instances.at(-1);

    assert.equal(queried.result.counts.eligible_deals, corpusSize);
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0].text, /^SELECT public\.canonical_v2_market_cohort\(/);
    assert.equal(pool.calls[0].values.length, 22);
  }

  class OversizedPool {
    constructor() {
      this.calls = [];
      instances.push(this);
    }

    query(command) {
      this.calls.push(command);
      return Promise.resolve({
        rowCount: 1,
        rows: [{ data: { payload: 'x'.repeat(MAX_MARKET_RESULT_BYTES) } }],
      });
    }
  }
  const oversizedClient = createPostgresServingClient({ connectionString: CONNECTION, PoolClass: OversizedPool });
  await assert.rejects(
    queryMarketCohort({ client: oversizedClient, request: request() }),
    (error) => error.code === 'DATA_SOURCE_ERROR',
  );
  assert.equal(instances.at(-1).calls.length, 1);
});

test('release, party capacity and either-side adviser filters are identity-bearing', () => {
  const base = compileMarketCohortRequest(request());
  const release = compileMarketCohortRequest(request({ corpus_release_id: id('CORPUS_RELEASE', 'candidate-b') }));
  const capacity = compileMarketCohortRequest(request({
    party: { role: 'CONDITION_BENEFICIARY', value: 'BUYER', capacity: 'GUARANTOR' },
  }));
  const adviser = compileMarketCohortRequest(request({
    filters: { ...request().filters, adviser_either: 'Paul Weiss' },
  }));
  const namespace = compileMarketCohortRequest(request({
    serving_namespace_id: id('SERVING_NAMESPACE', 'other-physical-carrier'),
  }));

  assert.notEqual(base.cohort_digest, release.cohort_digest);
  assert.notEqual(base.cache_key, release.cache_key);
  assert.notEqual(base.cohort_digest, capacity.cohort_digest);
  assert.notEqual(base.cohort_digest, adviser.cohort_digest);
  assert.equal(base.cohort_digest, namespace.cohort_digest);
  assert.notEqual(base.cache_key, namespace.cache_key);
});

test('request and response contracts reject corpus payloads, unknown filters and broad rows', async () => {
  assert.throws(() => compileMarketCohortRequest({ ...request(), observations: [] }), /Unsupported request fields/);
  assert.throws(() => compileMarketCohortRequest({
    ...request(),
    contract_fingerprint: id('CANONICAL_CONTRACT_BUNDLE', 'wrong'),
  }), /does not match/);
  assert.throws(() => compileMarketCohortRequest(request({
    filters: { ...request().filters, guessed_law_firm: 'Unknown' },
  })), /Unsupported filters/);
  assert.throws(() => compileMarketCohortRequest(request({
    filters: { ...request().filters, min_value_usd: '100.2', max_value_usd: '100.19' },
  })), /cannot exceed/);

  const client = {
    rpc(name, params) {
      return Promise.resolve({ data: { ...resultFor(params), rows: [] }, error: null });
    },
  };
  await assert.rejects(
    queryMarketCohort({ client, request: request() }),
    (error) => error.code === 'INVALID_RESPONSE' && /broad rows/.test(error.message),
  );

  const impossibleClient = {
    rpc(name, params) {
      const result = resultFor(params);
      result.counts.applicable_deals = 50;
      return Promise.resolve({ data: result, error: null });
    },
  };
  await assert.rejects(
    queryMarketCohort({ client: impossibleClient, request: request() }),
    (error) => error.code === 'INVALID_RESPONSE' && /denominator ordering/.test(error.message),
  );
});

test('database failures are not retried in-process', async () => {
  let calls = 0;
  const client = {
    rpc() {
      calls += 1;
      return Promise.resolve({ data: null, error: { message: 'capacity' } });
    },
  };
  await assert.rejects(
    queryMarketCohort({ client, request: request() }),
    (error) => error.code === 'DATA_SOURCE_ERROR',
  );
  assert.equal(calls, 1);
});

test('the staging SQL uses one set-based RPC, fixed dimensions and no direct app-role reads', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.market_observations/);
  assert.match(sql, /PRIMARY KEY \(serving_namespace_id, corpus_release_id, metric_observation_occurrence_id\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.market_metric_slot_exclusions/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_market_cohort/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog, canonical_v2_staging/);
  assert.match(sql, /SET statement_timeout = '2500ms'/);
  assert.match(sql, /p_environment IS DISTINCT FROM 'staging'/);
  assert.match(sql, /IF p_environment IS DISTINCT FROM 'staging' THEN/);
  assert.match(sql, /enforce_market_metric_slot_partition/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /count\(DISTINCT governed_deal_key\)/);
  assert.match(sql, /p_adviser_either = ANY\(observation\.adviser_firms\)/);
  assert.match(sql, /p_lawyer_either = ANY\(observation\.lawyers\)/);
  assert.match(sql, /observation\.governed_deal_key <> p_subject_deal_key/);
  assert.match(sql, /LIMIT 50/);
  assert.doesNotMatch(sql, /\bOFFSET\b/i);
  assert.doesNotMatch(sql, /\bEXECUTE\s+format\s*\(/i);
  assert.doesNotMatch(sql, /\bLOOP\b/i);
  assert.match(sql, /REVOKE ALL ON TABLE canonical_v2_staging\.market_observations[\s\S]*service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_market_cohort[\s\S]*TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /GRANT SELECT[\s\S]*TO (anon|authenticated|service_role|canonical_v2_serving)/);
});

test('the production market-stats route remains hard-closed and the new query does not read legacy cards or claims', () => {
  const route = fs.readFileSync('pages/api/market-stats.js', 'utf8');
  const querySource = fs.readFileSync('lib/canonical-v2/market-cohort-query.js', 'utf8');

  assert.match(route, /enabled:\s*false/);
  assert.doesNotMatch(querySource, /provision_cards|\.from\(['"]claims['"]\)|loadMarketDataset/);
});
