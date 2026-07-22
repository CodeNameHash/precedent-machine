const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const { buildInitialActiveReleasePointer, planActiveReleasePointerSwap } = require('../lib/canonical-v2/candidate-release');
const { isCanonicalV2ReviewEnabled } = require('../lib/canonical-v2/feature-flags');
const {
  createCanonicalExactDetailHandler,
  createCanonicalReviewContextHandler,
  createGuardedHandler,
} = require('../lib/canonical-v2/review-api-handler');
const { buildActiveReviewContextResult } = require('../lib/canonical-v2/review-context');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

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

function activeFixtureResult(fixture, rows = fixture.release.shared_rows) {
  const initial = buildInitialActiveReleasePointer();
  const pointer = planActiveReleasePointerSwap({
    current_pointer: initial,
    expected_current_pointer_id: initial.pointer_id,
    candidate_manifest: fixture.release.manifest,
  }).next_pointer;
  return buildActiveReviewContextResult({
    pointer,
    directoryRecord: fixture.release.deal_directory_records[0],
    rows,
    request: {
      contract_fingerprint: fixture.contract.fingerprint,
      application_deal_id: fixture.release.deal_directory_records[0].application_deal_id,
      page_size: 100,
      after_row_serving_key: null,
    },
  });
}

test('canonical Review feature is closed by default and does no client work', async () => {
  assert.equal(isCanonicalV2ReviewEnabled({}), false);
  assert.equal(isCanonicalV2ReviewEnabled({ CANONICAL_V2_REVIEW_ENABLED: 'true' }), true);
  let clientCalls = 0;
  const handler = createCanonicalReviewContextHandler({
    enabled: false,
    getClient() { clientCalls += 1; return {}; },
  });
  const res = responseRecorder();
  await handler({ method: 'GET', query: { dealId: 'c34415ed-44f7-432f-8d7c-6464b0310239' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'FEATURE_DISABLED');
  assert.equal(clientCalls, 0);
});

test('Review API adapts all valid rows and isolates one malformed sibling', async () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const rawResult = activeFixtureResult(fixture);
  const malformedResult = {
    ...rawResult,
    rows: rawResult.rows.map((row, index) => (index === 1 ? {
      row_serving_key: row.row_serving_key,
      corpus_release_id: row.corpus_release_id,
      governed_deal_key: row.governed_deal_key,
      row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE',
    } : row)),
  };
  const handler = createCanonicalReviewContextHandler({
    enabled: true,
    getClient: () => ({ rpc: () => Promise.resolve({ data: malformedResult, error: null }) }),
  });
  const res = responseRecorder();
  await handler({
    method: 'GET',
    query: { dealId: fixture.release.deal_directory_records[0].application_deal_id },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 13);
  assert.equal(res.body.items.filter((item) => item.render_kind === 'ROW').length, 12);
  assert.equal(res.body.items.filter((item) => item.render_kind === 'ROW_RENDER_FAILED').length, 1);
  assert.match(res.headers['Cache-Control'], /s-maxage=60/);
});

test('exact-detail API returns the selected response body, not the unbounded source graph', async () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const detailPackage = fixture.release.exact_detail_packages[0];
  const reference = detailPackage.references[0];
  const directory = fixture.release.deal_directory_records[0];
  const result = {
    schema_version: 'SERVING_EXACT_DETAIL_RESULT/V1',
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    contract_fingerprint: fixture.contract.fingerprint,
    application_deal_id: directory.application_deal_id,
    governed_deal_key: directory.governed_deal_key,
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: reference.source_detail_reference_id,
    exact_detail_package_digest: contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage),
    package: detailPackage,
  };
  const handler = createCanonicalExactDetailHandler({
    enabled: true,
    getClient: () => ({ rpc: () => Promise.resolve({ data: result, error: null }) }),
  });
  const res = responseRecorder();
  await handler({ method: 'GET', query: {
    namespace: fixture.servingNamespaceId,
    release: fixture.corpusReleaseId,
    dealId: directory.application_deal_id,
    row: result.row_serving_key,
    source: result.source_detail_reference_id,
  } }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.detail.excerpt?.exact_text || res.body.detail.exact_excerpts?.length);
  assert.equal(Object.hasOwn(res.body, 'package'), false);
  assert.match(res.headers['Cache-Control'], /immutable/);
});

test('guard rejects excess work and opens its local circuit without retrying', async () => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const handler = createGuardedHandler({
    enabled: true,
    maxConcurrent: 1,
    failureThreshold: 1,
    cooldownMs: 10000,
    getClient: () => ({}),
    operation: async () => {
      calls += 1;
      await blocked;
      throw { code: 'DATA_SOURCE_ERROR', message: 'failed' };
    },
  });
  const firstRes = responseRecorder();
  const first = handler({ method: 'GET', query: {} }, firstRes);
  await new Promise((resolve) => setImmediate(resolve));
  const busy = responseRecorder();
  await handler({ method: 'GET', query: {} }, busy);
  assert.equal(busy.body.error.code, 'AT_CAPACITY');
  assert.equal(calls, 1);
  release();
  await first;
  const circuit = responseRecorder();
  await handler({ method: 'GET', query: {} }, circuit);
  assert.equal(circuit.body.error.code, 'CIRCUIT_OPEN');
  assert.equal(calls, 1);
});

test('runtime routes use staging-only credentials and remain behind both server and client flags', () => {
  const reviewRoute = fs.readFileSync('pages/api/canonical-v2/review-context.js', 'utf8');
  const exactRoute = fs.readFileSync('pages/api/canonical-v2/exact-detail.js', 'utf8');
  const client = fs.readFileSync('lib/canonical-v2/serving-client.js', 'utf8');
  assert.match(reviewRoute, /isCanonicalV2ReviewEnabled/);
  assert.match(exactRoute, /isCanonicalV2ReviewEnabled/);
  assert.match(client, /CANONICAL_V2_STAGING_DATABASE_URL/);
  assert.match(client, /max: 1/);
  assert.match(client, /statement_timeout: 2500/);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE/);
});
