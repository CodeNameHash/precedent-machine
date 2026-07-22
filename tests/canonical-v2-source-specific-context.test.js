const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildReviewedDealContextResult,
  compileReviewedDealContextRequest,
  projectReviewedSourceSpecificRecord,
  queryReviewedDealContext,
  validateReviewedSourceSpecificRecord,
} = require('../lib/canonical-v2/source-specific-context');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function request(fixture, overrides = {}) {
  return {
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    contract_fingerprint: fixture.contract.fingerprint,
    governed_deal_key: 'deal:landos-abbvie',
    page_size: 25,
    after_row_serving_key: null,
    ...overrides,
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

test('candidate release emits one compact reviewed source-specific projection with no market identity', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const [record] = fixture.release.source_specific_serving_records;

  assert.equal(validateReviewedSourceSpecificRecord(record), true);
  assert.equal(record.canonical_payload.row_kind, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(record.row_serving_key, fixture.release.reviewed_source_specific_rows[0].row_serving_key);
  assert.equal(
    fixture.release.manifest.counts.source_specific_serving_records,
    fixture.release.reviewed_source_specific_rows.length,
  );
});

test('reviewed source-specific projection carries only reviewed serving payload and no canonical cohort dimensions', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const record = projectReviewedSourceSpecificRecord({
    row: fixture.sourceSpecific.row,
    serving_namespace_id: fixture.servingNamespaceId,
  });

  assert.equal(validateReviewedSourceSpecificRecord(record), true);
  assert.equal(record.disposition_code, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(record.market_cohort_eligible, false);
  assert.equal(record.aggregate_authority, 'NO_AGGREGATE_AUTHORITY');
  assert.equal(record.canonical_payload.row_kind, 'REVIEWED_SOURCE_SPECIFIC');
  for (const forbidden of ['concept_key', 'metric_key', 'party_role', 'canonical_numeric_value']) {
    assert.equal(Object.hasOwn(record, forbidden), false);
  }
  assert.equal(fixture.release.query_records.some((row) => (
    row.row_serving_key === record.row_serving_key
  )), false);
});

test('one selected-deal projection read returns the reviewed row and excludes comparable rows', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const result = buildReviewedDealContextResult({
    records: fixture.release.source_specific_serving_records,
    request: request(fixture),
  });

  assert.equal(result.total_count, 1);
  assert.equal(result.page_count, 1);
  assert.equal(result.next_cursor, null);
  assert.equal(result.rows[0].row_kind, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(result.rows[0].reviewed_source_specific.final_disposition.review_state, 'FINAL');
  assert.equal(result.rows.some((row) => row.row_kind === 'CANONICAL_RESULT'), false);
});

test('one reviewed-deal request executes one bounded RPC and a release-aware cache hit executes none', async () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({
        data: buildReviewedDealContextResult({
          records: fixture.release.source_specific_serving_records,
          request: request(fixture),
        }),
        error: null,
      });
    },
  };
  const cache = new MemoryCache();
  const first = await queryReviewedDealContext({ client, cache, request: request(fixture) });
  const second = await queryReviewedDealContext({ client, cache, request: request(fixture) });

  assert.equal(first.cache, 'MISS');
  assert.equal(second.cache, 'HIT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_reviewed_deal_context');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(calls[0].params.p_governed_deal_key, 'deal:landos-abbvie');
  assert.equal(cache.writes[0].ttl, 3600);
});

test('release and selected deal are cache identity while database failures are never retried', async () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const base = compileReviewedDealContextRequest(request(fixture));
  const otherRelease = compileReviewedDealContextRequest(request(fixture, {
    corpus_release_id: contentId('CORPUS_RELEASE/V1', 'other'),
  }));
  const otherDeal = compileReviewedDealContextRequest(request(fixture, {
    governed_deal_key: 'deal:other',
  }));
  assert.notEqual(base.cache_key, otherRelease.cache_key);
  assert.notEqual(base.cache_key, otherDeal.cache_key);

  let calls = 0;
  await assert.rejects(
    queryReviewedDealContext({
      client: {
        rpc() {
          calls += 1;
          return Promise.resolve({ data: null, error: { message: 'capacity' } });
        },
      },
      request: request(fixture),
    }),
    (error) => error.code === 'DATA_SOURCE_ERROR',
  );
  assert.equal(calls, 1);
});

test('unresolved, canonical or out-of-scope payloads cannot masquerade as reviewed deal context', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  assert.throws(() => projectReviewedSourceSpecificRecord({
    row: fixture.ioc.row,
    serving_namespace_id: fixture.servingNamespaceId,
  }), /Only a final reviewed source-specific row/);

  const unresolved = clone(fixture.release.source_specific_serving_records[0]);
  unresolved.canonical_payload.reviewed_source_specific.final_disposition.review_state = 'UNRESOLVED';
  assert.throws(() => validateReviewedSourceSpecificRecord(unresolved), /final disposition/);

  const result = buildReviewedDealContextResult({
    records: fixture.release.source_specific_serving_records,
    request: request(fixture, { governed_deal_key: 'deal:other' }),
  });
  assert.equal(result.total_count, 0);
  assert.deepEqual(result.rows, []);
});

test('staging SQL uses one indexed set-based deal read with no app-role table access', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.reviewed_source_specific_serving_rows/);
  assert.match(sql, /canonical_v2_reviewed_source_specific_deal_idx/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_reviewed_deal_context/);
  assert.match(sql, /SET statement_timeout = '2500ms'/);
  assert.match(sql, /p_page_size > 50/);
  assert.match(sql, /ORDER BY row\.row_serving_key[\s\S]*LIMIT p_page_size \+ 1/);
  assert.match(sql, /row\.market_cohort_eligible = false/);
  assert.match(sql, /row\.aggregate_authority = 'NO_AGGREGATE_AUTHORITY'/);
  assert.match(sql, /REVOKE ALL ON TABLE canonical_v2_staging\.reviewed_source_specific_serving_rows[\s\S]*service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_reviewed_deal_context[\s\S]*TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /\bOFFSET\b/i);
  assert.doesNotMatch(sql, /GRANT SELECT[\s\S]*TO (anon|authenticated|service_role|canonical_v2_serving)/);
});
