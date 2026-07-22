const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalActiveQueryRequest,
  queryCanonicalResultPage,
} = require('../lib/canonical-v2/query-result');

function activeRequestFor(row, overrides = {}) {
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

function activeResult(params, rows, identity) {
  return {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V1',
    pointer_id: identity.pointer_id,
    serving_namespace_id: identity.serving_namespace_id,
    corpus_release_id: identity.corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    query_semantics_digest: params.p_query_semantics_digest,
    total_count: rows.length,
    page_count: rows.length,
    rows,
    next_cursor: null,
  };
}

function identity(label, corpusReleaseId) {
  return {
    pointer_id: contentId('ACTIVE_POINTER/V1', label),
    serving_namespace_id: contentId('SERVING_NAMESPACE/V1', label),
    corpus_release_id: corpusReleaseId,
  };
}

class MemoryCache {
  constructor() {
    this.reads = [];
    this.writes = [];
  }

  async get(key) {
    this.reads.push(key);
    return null;
  }

  async set(key, value, ttl) {
    this.writes.push({ key, value, ttl });
  }
}

test('active Query compiles only logical browser fields and injects the frozen contract server-side', () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const compiled = compileCanonicalActiveQueryRequest(activeRequestFor(row));

  assert.equal(compiled.release_selector, 'ACTIVE');
  assert.equal(compiled.contract_fingerprint, row.provenance.contract_fingerprint);
  assert.equal(compiled.serving_namespace_id, undefined);
  assert.equal(compiled.corpus_release_id, undefined);
  assert.equal(compiled.cache_key, null);
  for (const injected of [
    { serving_namespace_id: 'a'.repeat(64) },
    { corpus_release_id: 'b'.repeat(64) },
    { contract_fingerprint: 'c'.repeat(64) },
    { release_selector: 'PINNED' },
  ]) {
    assert.throws(
      () => compileCanonicalActiveQueryRequest({ ...activeRequestFor(row), ...injected }),
      /fields do not match/,
    );
  }
});

test('active Query resolves the pointer and page in one RPC without client-selected release IDs', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const activeIdentity = identity('first', row.corpus_release_id);
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({ data: activeResult(params, [row], activeIdentity), error: null });
    },
  };

  const response = await queryCanonicalResultPage({
    client,
    request: activeRequestFor(row),
    releaseSelector: 'ACTIVE',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_active_query_page');
  assert.equal(Object.hasOwn(calls[0].params, 'p_serving_namespace_id'), false);
  assert.equal(Object.hasOwn(calls[0].params, 'p_corpus_release_id'), false);
  assert.equal(calls[0].params.p_contract_fingerprint, row.provenance.contract_fingerprint);
  assert.equal(response.result.pointer_id, activeIdentity.pointer_id);
  assert.equal(response.result.serving_namespace_id, activeIdentity.serving_namespace_id);
  assert.equal(response.result.corpus_release_id, activeIdentity.corpus_release_id);
  assert.match(response.request.cache_key, /^[a-f0-9]{64}$/);
});

test('pointer swaps produce distinct response and cache identities without trusting a stale client release', async () => {
  const originalRow = buildLandosTerminationFeeServingFixture().row;
  const identities = [
    identity('before-swap', originalRow.corpus_release_id),
    identity('after-swap', contentId('CORPUS_RELEASE/V1', 'after-pointer-swap')),
  ];
  const rows = [[], []];
  let calls = 0;
  const client = {
    rpc(name, params) {
      const index = calls++;
      return Promise.resolve({ data: activeResult(params, rows[index], identities[index]), error: null });
    },
  };
  const cache = new MemoryCache();
  const request = activeRequestFor(originalRow);

  const before = await queryCanonicalResultPage({ client, cache, request, releaseSelector: 'ACTIVE' });
  const after = await queryCanonicalResultPage({ client, cache, request, releaseSelector: 'ACTIVE' });

  assert.equal(calls, 2);
  assert.equal(cache.reads.length, 0);
  assert.equal(cache.writes.length, 2);
  assert.notEqual(before.request.cache_key, after.request.cache_key);
  assert.notEqual(before.result.pointer_id, after.result.pointer_id);
  assert.notEqual(before.result.serving_namespace_id, after.result.serving_namespace_id);
  assert.notEqual(before.result.corpus_release_id, after.result.corpus_release_id);
  assert.notEqual(cache.writes[0].key, cache.writes[1].key);
});

test('active Query rejects mismatched pointer and release response identity', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const validIdentity = identity('valid', row.corpus_release_id);
  const cases = [
    { ...validIdentity, pointer_id: 'not-a-digest' },
    { ...validIdentity, corpus_release_id: contentId('CORPUS_RELEASE/V1', 'inactive') },
  ];
  for (const responseIdentity of cases) {
    const client = {
      rpc(name, params) {
        return Promise.resolve({ data: activeResult(params, [row], responseIdentity), error: null });
      },
    };
    await assert.rejects(
      queryCanonicalResultPage({ client, request: activeRequestFor(row), releaseSelector: 'ACTIVE' }),
      (error) => error.code === 'INVALID_RESPONSE',
    );
  }
});

test('active Query SQL resolves one active pointer and invokes the bounded indexed page within the same function call', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page');
  const end = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_review_context');
  const activeFunction = sql.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(activeFunction, /FROM canonical_v2_staging\.active_corpus_release_pointers/);
  assert.match(activeFunction, /public\.canonical_v2_query_page\(/);
  assert.match(activeFunction, /p_serving_namespace_id => active_pointer\.serving_namespace_id/);
  assert.match(activeFunction, /p_corpus_release_id => active_pointer\.corpus_release_id/);
  assert.match(activeFunction, /jsonb_build_object\('pointer_id', active_pointer\.pointer_id\)/);
  assert.doesNotMatch(activeFunction, /p_serving_namespace_id text|p_corpus_release_id text/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_query_page[\s\S]*TO canonical_v2_serving/);
});
