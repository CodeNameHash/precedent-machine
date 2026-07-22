const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileServingExactDetailRequest,
  queryServingExactDetail,
  validateServingExactDetailResult,
} = require('../lib/canonical-v2/serving-exact-detail');

function requestAndResult() {
  const fixture = buildLandosCandidateReleaseFixture();
  const detailPackage = fixture.release.exact_detail_packages.find((item) => (
    item.row.row_serving_key === fixture.reviewed.row.row_serving_key
  ));
  assert.ok(detailPackage, 'reviewed capitalisation detail package must be released');
  const reference = detailPackage.references[0];
  const request = compileServingExactDetailRequest({
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    contract_fingerprint: fixture.contract.fingerprint,
    application_deal_id: fixture.release.deal_directory_records[0].application_deal_id,
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: reference.source_detail_reference_id,
  });
  const result = {
    schema_version: 'SERVING_EXACT_DETAIL_RESULT/V1',
    serving_namespace_id: request.serving_namespace_id,
    corpus_release_id: request.corpus_release_id,
    contract_fingerprint: request.contract_fingerprint,
    application_deal_id: request.application_deal_id,
    governed_deal_key: detailPackage.row.governed_deal_key,
    row_serving_key: request.row_serving_key,
    source_detail_reference_id: request.source_detail_reference_id,
    exact_detail_package_digest: contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage),
    package: detailPackage,
  };
  return { request, result };
}

test('exact-detail response closes over one immutable release, row and source action', () => {
  const { request, result } = requestAndResult();
  assert.equal(validateServingExactDetailResult(result, request), result);
  const body = result.package.detail_payloads[0].response_body;
  assert.equal(body.detail_kind, 'RESULT_COMPOSITION_EVIDENCE');
  assert.equal(body.components.length, 4);
  assert.equal(body.relationships[0].relationship_definition_key, 'BRINGS_DOWN');
  assert.ok(body.excerpts.every((excerpt) => excerpt.exact_text));
});

test('exact-detail read is one bounded RPC with no retry', async () => {
  const { request, result } = requestAndResult();
  const calls = [];
  const response = await queryServingExactDetail({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({ data: result, error: null });
      },
    },
    request,
  });
  assert.equal(response.row_serving_key, request.row_serving_key);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_exact_detail');

  let failedCalls = 0;
  await assert.rejects(queryServingExactDetail({
    client: {
      rpc() {
        failedCalls += 1;
        return Promise.resolve({ data: null, error: { message: 'capacity' } });
      },
    },
    request,
  }), (error) => error.code === 'DATA_SOURCE_ERROR');
  assert.equal(failedCalls, 1);
});

test('wrong source reference or row identity cannot return plausible source', () => {
  const { request, result } = requestAndResult();
  const wrongReference = { ...request, source_detail_reference_id: '0'.repeat(64) };
  assert.throws(() => validateServingExactDetailResult({
    ...result,
    source_detail_reference_id: wrongReference.source_detail_reference_id,
  }, wrongReference), /selected row and action/);
});

test('staging exact-detail SQL is one indexed row lookup through the release deal directory', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_exact_detail');
  const end = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_reviewed_deal_context');
  const fn = sql.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /SET statement_timeout = '2500ms'/);
  assert.match(fn, /JOIN canonical_v2_staging\.exact_detail_serving_packages/);
  assert.match(fn, /package\.row_serving_key = p_row_serving_key/);
  assert.match(fn, /p_source_detail_reference_id = ANY\(package\.source_detail_reference_ids\)/);
  assert.doesNotMatch(fn, /\bLOOP\b|\bOFFSET\b/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_exact_detail[\s\S]*TO canonical_v2_serving/);
});
