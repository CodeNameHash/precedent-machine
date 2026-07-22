const assert = require('node:assert/strict');
const test = require('node:test');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  compileMarketCohortRequest,
  queryMarketCohort,
} = require('../lib/canonical-v2/market-cohort-query');
const { compileServingExactDetailRequest } = require('../lib/canonical-v2/serving-exact-detail');

const contract = compileFixtureContract();
const active = Object.freeze({
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  corpus_release_id: 'c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3',
});
const candidate = Object.freeze({
  serving_namespace_id: '4e6495edaef5005885278927d445701d4e38e04fea87dd91031f70887e12063d',
  corpus_release_id: 'd8630dc4dc8fc0a4d88d1e473cf111063b9e71ebc2f0616418236ec2e2f8d4f8',
});
const party = Object.freeze({
  role: 'CONDITION_BENEFICIARY',
  value: 'PARENT',
  capacity: 'ACQUIRER',
});

function requestFor(release) {
  return {
    ...release,
    contract_fingerprint: contract.fingerprint,
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    metric_version: 1,
    concept_key: 'COND-B-REP',
    party,
    subject_deal_key: 'deal:qxo-topbuild',
    filters: {},
  };
}

function resultFor(params, count) {
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
      eligible_deals: count,
      applicable_deals: count,
      examined_deals: count,
      present_deals: count,
      comparable_deals: count,
      distribution_deals: count,
      excluded_deals: 0,
      observation_slots: count,
      excluded_slots: 0,
    },
    distribution: count === 0 ? [] : [{
      canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      subject_count: count,
      deal_count: count,
    }],
    exclusions: [],
  };
}

class MemoryCache {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    return this.values.get(key) || null;
  }

  async set(key, value) {
    this.values.set(key, value);
  }
}

test('active and inactive QXO cohorts can never share a cache entry', async () => {
  const activeCompiled = compileMarketCohortRequest(requestFor(active));
  const candidateCompiled = compileMarketCohortRequest(requestFor(candidate));
  assert.notEqual(activeCompiled.cache_key, candidateCompiled.cache_key);
  assert.notEqual(activeCompiled.cohort_digest, candidateCompiled.cohort_digest);

  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      const count = params.p_corpus_release_id === candidate.corpus_release_id ? 0 : 7;
      return Promise.resolve({ data: resultFor(params, count), error: null });
    },
  };
  const cache = new MemoryCache();
  const candidateFirst = await queryMarketCohort({ client, cache, request: requestFor(candidate) });
  const activeFirst = await queryMarketCohort({ client, cache, request: requestFor(active) });
  const candidateSecond = await queryMarketCohort({ client, cache, request: requestFor(candidate) });
  const activeSecond = await queryMarketCohort({ client, cache, request: requestFor(active) });

  assert.equal(candidateFirst.cache, 'MISS');
  assert.equal(activeFirst.cache, 'MISS');
  assert.equal(candidateSecond.cache, 'HIT');
  assert.equal(activeSecond.cache, 'HIT');
  assert.equal(calls.length, 2);
  assert.equal(candidateSecond.result.counts.comparable_deals, 0);
  assert.equal(activeSecond.result.counts.comparable_deals, 7);
  assert.equal(cache.values.size, 2);
});

test('exact-detail identities are release-partitioned even when the selected action is otherwise identical', () => {
  const common = {
    contract_fingerprint: contract.fingerprint,
    application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    row_serving_key: '3868d5c93daaf996970ecee752efd20b024618f55410200304c3998c970cfe93',
    source_detail_reference_id: '529a50186117167276b7f9936afe3d7ec9f847485bbbc2c28de7cb356db40b91',
  };
  const activeRequest = compileServingExactDetailRequest({ ...common, ...active });
  const candidateRequest = compileServingExactDetailRequest({ ...common, ...candidate });

  assert.notEqual(activeRequest.corpus_release_id, candidateRequest.corpus_release_id);
  assert.notEqual(activeRequest.serving_namespace_id, candidateRequest.serving_namespace_id);
  assert.deepEqual(candidateRequest, { ...common, ...candidate });
});
