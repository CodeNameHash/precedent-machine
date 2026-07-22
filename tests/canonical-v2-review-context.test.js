const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const { buildInitialActiveReleasePointer, planActiveReleasePointerSwap } = require('../lib/canonical-v2/candidate-release');
const {
  buildActiveReviewContextResult,
  compileActiveReviewContextRequest,
  queryActiveReviewContext,
} = require('../lib/canonical-v2/review-context');

function fixtureRequest(fixture, overrides = {}) {
  return {
    contract_fingerprint: fixture.contract.fingerprint,
    application_deal_id: 'c34415ed-44f7-432f-8d7c-6464b0310239',
    page_size: 100,
    after_row_serving_key: null,
    ...overrides,
  };
}

function activePointer(fixture) {
  return planActiveReleasePointerSwap({
    current_pointer: buildInitialActiveReleasePointer(),
    expected_current_pointer_id: buildInitialActiveReleasePointer().pointer_id,
    candidate_manifest: fixture.release.manifest,
  }).next_pointer;
}

test('active Review context returns canonical and reviewed source-specific rows in one selected-deal page', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const result = buildActiveReviewContextResult({
    pointer: activePointer(fixture),
    directoryRecord: fixture.release.deal_directory_records[0],
    rows: fixture.release.shared_rows,
    request: fixtureRequest(fixture),
  });

  assert.equal(result.total_count, 13);
  assert.equal(result.page_count, 13);
  assert.equal(result.rows.filter((row) => row.row_kind === 'CANONICAL_RESULT').length, 12);
  assert.equal(result.rows.filter((row) => row.row_kind === 'REVIEWED_SOURCE_SPECIFIC').length, 1);
  assert.equal(result.application_deal_id, 'c34415ed-44f7-432f-8d7c-6464b0310239');
});

test('one Review request executes one bounded RPC and never retries a failure', async () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const pointer = activePointer(fixture);
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({
        data: buildActiveReviewContextResult({
          pointer,
          directoryRecord: fixture.release.deal_directory_records[0],
          rows: fixture.release.shared_rows,
          request: fixtureRequest(fixture),
        }),
        error: null,
      });
    },
  };
  const response = await queryActiveReviewContext({ client, request: fixtureRequest(fixture) });
  assert.equal(response.result.page_count, 13);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_active_review_context');
  assert.equal(calls[0].params.p_page_size, 100);

  let failedCalls = 0;
  await assert.rejects(queryActiveReviewContext({
    client: {
      rpc() {
        failedCalls += 1;
        return Promise.resolve({ data: null, error: { message: 'capacity' } });
      },
    },
    request: fixtureRequest(fixture),
  }), (error) => error.code === 'DATA_SOURCE_ERROR');
  assert.equal(failedCalls, 1);
});

test('Review request identity includes deal, cursor and frozen contract', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const base = compileActiveReviewContextRequest(fixtureRequest(fixture));
  const otherDeal = compileActiveReviewContextRequest(fixtureRequest(fixture, {
    application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
  }));
  assert.notEqual(base.request_digest, otherDeal.request_digest);
  assert.throws(() => compileActiveReviewContextRequest(fixtureRequest(fixture, {
    contract_fingerprint: '0'.repeat(64),
  })), /frozen contract/);
});

test('staging SQL resolves active release and selected deal in one indexed set-based read', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_review_context');
  const end = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_reviewed_deal_context');
  const fn = sql.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(sql, /canonical_v2_deal_serving_directory_lookup_idx/);
  assert.match(fn, /SET statement_timeout = '2500ms'/);
  assert.match(fn, /p_page_size > 200/);
  assert.match(fn, /canonical_v2_staging\.active_corpus_release_pointers/);
  assert.match(fn, /canonical_v2_staging\.deal_serving_directory/);
  assert.match(fn, /canonical_v2_staging\.shared_serving_rows[\s\S]*UNION ALL[\s\S]*canonical_v2_staging\.reviewed_source_specific_serving_rows/);
  assert.match(fn, /ORDER BY row\.row_serving_key[\s\S]*LIMIT p_page_size \+ 1/);
  assert.doesNotMatch(fn, /\bOFFSET\b/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_review_context[\s\S]*TO canonical_v2_serving/);
});
