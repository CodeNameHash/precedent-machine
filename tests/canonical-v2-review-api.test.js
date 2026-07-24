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
  const prepared = res.body.items.find((item) => item.render_kind === 'ROW').prepared;
  const metricKey = prepared.resolution.metrics[0].metricKey;
  const metric = prepared.data.byRow[prepared.row_key].metrics[metricKey];
  assert.equal(prepared.resolution.rowKey, prepared.row_key);
  assert.ok(metric.subject.legalTerms.length > 0);
  assert.equal(prepared.typed_market.data, prepared.data);
  assert.match(res.headers['Cache-Control'], /s-maxage=60/);
});

test('exact-detail API returns the selected response body, not the unbounded source graph', async () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const detailPackage = fixture.release.exact_detail_packages.find((candidate) => (
    candidate.detail_payloads.some((payload) => (
      payload.response_body.excerpt?.exact_text || payload.response_body.exact_excerpts?.length
    ))
  ));
  const selectedPayload = detailPackage.detail_payloads.find((payload) => (
    payload.response_body.excerpt?.exact_text || payload.response_body.exact_excerpts?.length
  ));
  const reference = detailPackage.references.find((candidate) => (
    candidate.source_detail_payload_id === selectedPayload.source_detail_payload_id
  ));
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
  const calls = [];
  const handler = createCanonicalExactDetailHandler({
    enabled: true,
    getClient: () => ({
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({ data: result, error: null });
      },
    }),
  });
  const res = responseRecorder();
  await handler({ method: 'GET', query: {
    namespace: fixture.servingNamespaceId,
    release: fixture.corpusReleaseId,
    contract: fixture.contract.fingerprint,
    dealId: directory.application_deal_id,
    row: result.row_serving_key,
    source: result.source_detail_reference_id,
  } }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.detail.excerpt?.exact_text || res.body.detail.exact_excerpts?.length);
  assert.equal(Object.hasOwn(res.body, 'package'), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.p_contract_fingerprint, fixture.contract.fingerprint);
  assert.match(res.headers['Cache-Control'], /immutable/);

  const governedCalls = [];
  const governedHandler = createCanonicalExactDetailHandler({
    enabled: true,
    getClient: () => ({
      rpc(name, params) {
        governedCalls.push({ name, params });
        return Promise.resolve({ data: result, error: null });
      },
    }),
  });
  const governedRes = responseRecorder();
  await governedHandler({ method: 'GET', query: {
    namespace: fixture.servingNamespaceId,
    release: fixture.corpusReleaseId,
    contract: fixture.contract.fingerprint,
    dealKey: directory.governed_deal_key,
    row: result.row_serving_key,
    source: result.source_detail_reference_id,
  } }, governedRes);
  assert.equal(governedRes.statusCode, 200);
  assert.equal(governedCalls.length, 1);
  assert.equal(governedCalls[0].name, 'canonical_v2_exact_detail_by_governed_deal');
});

test('Review and exact-detail routes are governed by the active release fingerprint', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const reviewStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_review_context');
  const exactStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_exact_detail');
  const exactEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_reviewed_deal_context');
  const review = sql.slice(reviewStart, exactStart);
  const exact = sql.slice(exactStart, exactEnd);

  assert.match(review, /release_contract_fingerprint/);
  assert.match(review, /FROM canonical_v2_staging\.fixture_corpus_releases release/);
  assert.match(review, /directory\.contract_fingerprint = release_contract_fingerprint/);
  assert.doesNotMatch(review, /contract_fingerprint = p_contract_fingerprint/);

  assert.match(exact, /FROM canonical_v2_staging\.active_corpus_release_pointers pointer/);
  assert.match(exact, /FROM canonical_v2_staging\.fixture_corpus_releases release/);
  assert.match(exact, /p_contract_fingerprint IS DISTINCT FROM release_contract_fingerprint/);
  assert.match(exact, /directory\.contract_fingerprint = release_contract_fingerprint/);
  assert.match(exact, /exact-detail route is stale for the active canonical release/);
});

test('Review renders the governed termination-fee trigger response as structured legal terms', () => {
  const source = fs.readFileSync('components/review-v2/CanonicalReviewSection.jsx', 'utf8');
  assert.match(source, /SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE\/V1/);
  assert.match(source, /SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE\/V2/);
  assert.match(source, /CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER/);
  assert.match(source, /CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER/);
  assert.match(source, /TERMINATION_FEE_TRIGGER_EVIDENCE/);
  assert.match(source, /detail\.trigger_count < 1/);
  assert.match(source, /detail\.trigger_count > 16/);
  assert.match(source, /pathwayLabel/);
  assert.match(source, /paymentTimingLabel/);
  assert.match(source, /terminatingPartyLabel/);
  assert.doesNotMatch(source, /TRIGGER_PATHWAY_LABELS|PAYMENT_TIMING_LABELS|TERMINATING_PARTY_LABELS/);
  assert.match(source, /conditionExpressionView/);
  assert.match(source, /indexed_facts/);
  assert.match(source, /All of:/);
  assert.match(source, /Any one of:/);
  assert.match(source, /If:/);
  assert.match(source, /Then:/);
  assert.match(source, /data-canonical-trigger-detail/);
  assert.match(source, /loadMorePendingRef/);
  assert.match(source, /Exact trigger evidence/);
  assert.match(source, /contract: envelope\.contract_fingerprint/);
  assert.match(source, /Certified trigger detail contains an unsupported legal term/);
  assert.doesNotMatch(source, /trigger_count\s*!==?\s*(?:6|9)|triggers\.length\s*!==?\s*(?:6|9)/);
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
