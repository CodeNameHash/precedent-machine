const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const fixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);
const {
  ACTIVE_PRODUCT_QUERY_RPC,
  queryActiveProductResults,
} = require(
  '../lib/canonical-v2/product-query-result-active-serving',
);

const namespaceId = 'a'.repeat(64);
const corpusReleaseId = 'b'.repeat(64);
const importPlanId = 'c'.repeat(64);
const servingRecordId = 'd'.repeat(64);

function requestFor(result = fixture.shared_result) {
  return {
    environment: 'staging',
    serving_namespace_id: namespaceId,
    corpus_release_id: corpusReleaseId,
    product_query_definition_id: result.product_query_definition_id,
    after_product_query_result_identity: null,
    page_size: 20,
  };
}

function responseFor(result = fixture.shared_result) {
  return {
    schema_version: 'PRODUCT_QUERY_RESULT_ACTIVE_PAGE/V1',
    serving_namespace_id: namespaceId,
    corpus_release_id: corpusReleaseId,
    candidate_release_import_plan_id: importPlanId,
    candidate_manifest_id: result.candidate_release_manifest_id,
    product_query_definition_id: result.product_query_definition_id,
    page_count: 1,
    rows: [{
      product_query_result_serving_record_id: servingRecordId,
      product_query_result_identity: result.product_query_result_identity,
      candidate_product_result_id: fixture.candidate_product_result_id,
      canonical_payload: result,
    }],
    has_more: false,
    next_after_product_query_result_identity: null,
  };
}

test('active Product query makes one bounded RPC and returns the exact validated release row', async () => {
  const calls = [];
  const response = responseFor();
  const page = await queryActiveProductResults({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({ data: response, error: null });
      },
    },
    request: requestFor(),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, ACTIVE_PRODUCT_QUERY_RPC);
  assert.equal(calls[0].params.p_page_size, 20);
  assert.deepEqual(page, response);
});

test('active Product query fails closed on release drift without retry', async () => {
  let calls = 0;
  const response = responseFor();
  response.corpus_release_id = 'e'.repeat(64);
  await assert.rejects(
    queryActiveProductResults({
      client: {
        rpc() {
          calls += 1;
          return Promise.resolve({ data: response, error: null });
        },
      },
      request: requestFor(),
    }),
    (error) => error.code === 'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
  );
  assert.equal(calls, 1);
});

test('active Product query rejects reordered rows and invalid cursors', async () => {
  const response = responseFor();
  response.has_more = true;
  response.next_after_product_query_result_identity = '0'.repeat(64);
  await assert.rejects(
    queryActiveProductResults({
      client: {
        rpc() {
          return Promise.resolve({ data: response, error: null });
        },
      },
      request: requestFor(),
    }),
    (error) => error.code === 'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
  );

  await assert.rejects(
    queryActiveProductResults({
      client: { rpc() {} },
      request: {
        ...requestFor(),
        after_product_query_result_identity: 'not-a-digest',
      },
    }),
    (error) => error.code === 'INVALID_ACTIVE_PRODUCT_QUERY_REQUEST',
  );
});

test('staging SQL serves Product rows through one active release-pinned set query', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = sql.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_active_product_query_results',
  );
  const end = sql.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_active_review_context',
  );
  const activeQuery = sql.slice(start, end);
  const importStart = sql.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_import_candidate_release',
  );
  const importEnd = sql.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_rollback_inactive_candidate_release',
  );
  const importer = sql.slice(importStart, importEnd);

  assert.ok(start >= 0 && end > start);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.product_query_result_release_partitions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.product_query_result_serving_records/);
  assert.match(sql, /canonical_v2_product_query_result_active_page_idx/);
  assert.match(activeQuery, /SET statement_timeout = '2500ms'/);
  assert.match(activeQuery, /active_corpus_release_pointers/);
  assert.match(
    activeQuery,
    /validated AS MATERIALIZED \([\s\S]*product_query_result_release_partitions/,
  );
  assert.match(activeQuery, /candidate_release_import_plan_id[\s\S]*candidate_release_import_plan_id/);
  assert.match(activeQuery, /LIMIT p_page_size \+ 1/);
  assert.match(activeQuery, /WHERE page_payload\.page_count > 0/);
  assert.doesNotMatch(activeQuery, /\bOFFSET\b/i);
  assert.doesNotMatch(activeQuery, /\bLOOP\b/i);
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_PLAN\/V7/);
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_RECEIPT\/V7/);
  assert.match(importer, /product_candidate_results candidate/);
  assert.match(importer, /shared_row_adapter_receipt[\s\S]*product_query_result/);
  assert.match(
    importer,
    /product_query_result_serving_record_id'[\s\S]*canonical_v2_staging\.content_id\([\s\S]*'PRODUCT_QUERY_RESULT_SERVING_RECORD\/V1'/,
  );
  assert.match(
    importer,
    /item - ARRAY\[[\s\S]*'authority_state'[\s\S]*\]::text\[\] <> '\{\}'::jsonb/,
  );
  assert.match(importer, /INSERT INTO canonical_v2_staging\.product_query_result_serving_records/);
  assert.doesNotMatch(importer, /\bLOOP\b/i);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE canonical_v2_staging\.product_query_result_serving_records[\s\S]*canonical_v2_serving/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_product_query_results\([\s\S]*TO canonical_v2_serving/,
  );
});

test('P8 staging proof imports the Product partition only inside a rollback transaction', () => {
  const source = fs.readFileSync(
    'scripts/canonical-v2-staging-product-release-partition-p8.mjs',
    'utf8',
  );
  assert.match(source, /buildCandidateReleaseImportPlan/);
  assert.match(source, /canonical_v2_import_candidate_release/);
  assert.match(source, /canonical_v2_active_product_query_results/);
  assert.match(source, /inactive_page IS NOT NULL/);
  assert.match(source, /canonicalJson\(before\) !== canonicalJson\(after\)/);
  assert.doesNotMatch(source, /runSql\([\s\S]{0,300}\{\s*commit:\s*true/);
});
