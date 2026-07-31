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

test('active Product query accepts a complete valid empty page', async () => {
  const response = responseFor();
  response.page_count = 0;
  response.rows = [];
  const page = await queryActiveProductResults({
    client: {
      rpc() {
        return Promise.resolve({ data: response, error: null });
      },
    },
    request: requestFor(),
  });
  assert.deepEqual(page.rows, []);
  assert.equal(page.has_more, false);
  assert.equal(page.next_after_product_query_result_identity, null);
});

test('staging SQL serves Product rows through one active release-pinned set query', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = sql.lastIndexOf(
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
  assert.match(activeQuery, /LANGUAGE plpgsql[\s\S]*VOLATILE/);
  assert.match(activeQuery, /SET statement_timeout = '2500ms'/);
  assert.match(activeQuery, /active_corpus_release_pointers/);
  assert.match(activeQuery, /Product query release is not actively admitted/);
  assert.match(activeQuery, /product_query_result_active_page_cache/);
  assert.match(activeQuery, /authorisation_scope_id/);
  assert.match(
    activeQuery,
    /cache\.authorisation_scope_id = v_authorisation_scope_id/,
  );
  assert.doesNotMatch(
    activeQuery,
    /cache\.authorisation_scope_id = authorisation_scope_id/,
  );
  for (const column of [
    'capacity_manifest_id',
    'capacity_manifest_payload_digest',
    'route_budget_manifest_id',
    'route_budget_manifest_payload_digest',
    'cache_budget_manifest_id',
    'cache_budget_manifest_payload_digest',
    'exact_query_semantics',
  ]) {
    assert.match(activeQuery, new RegExp(`cache\\.${column} = v_${column}`));
    assert.doesNotMatch(activeQuery, new RegExp(`cache\\.${column} = ${column}`));
  }
  assert.match(activeQuery, /capacity_manifest_payload_digest/);
  assert.match(activeQuery, /route_budget_manifest_payload_digest/);
  assert.match(activeQuery, /cache_budget_manifest_payload_digest/);
  assert.match(activeQuery, /clock_timestamp\(\) \+ interval '1 hour'/);
  assert.match(activeQuery, /active Product query response exceeds its byte ceiling/);
  assert.match(activeQuery, /active Product query contains an invalid result row/);
  assert.match(activeQuery, /jsonb_object_keys\(candidate\.canonical_payload\)/);
  assert.match(activeQuery, /PRODUCT_QUERY_RESULT\/V1/);
  assert.match(
    activeQuery,
    /jsonb_typeof\(candidate\.canonical_payload->'exact_detail_action'\) IS DISTINCT FROM 'string'/,
  );
  assert.match(activeQuery, /candidate\.canonical_payload->>'exact_detail_action' = ''/);
  assert.match(activeQuery, /btrim\(candidate\.canonical_payload->>'exact_detail_action'\)/);
  assert.match(activeQuery, /octet_length\(candidate\.canonical_payload->>'exact_detail_action'\) > 512/);
  assert.doesNotMatch(
    activeQuery,
    /jsonb_typeof\(candidate\.canonical_payload->'exact_detail_action'\) IS DISTINCT FROM 'object'/,
  );
  assert.match(
    activeQuery,
    /SELECT pointer\.\* INTO active_pointer[\s\S]*product_query_result_release_partitions/,
  );
  assert.match(activeQuery, /candidate_release_import_plan_id[\s\S]*candidate_release_import_plan_id/);
  assert.match(activeQuery, /LIMIT p_page_size \+ 1/);
  assert.doesNotMatch(activeQuery, /WHERE page_payload\.page_count > 0/);
  assert.doesNotMatch(activeQuery, /\bOFFSET\b/i);
  assert.doesNotMatch(activeQuery, /\bLOOP\b/i);
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_PLAN\/V7/);
  assert.match(importer, /CANDIDATE_RELEASE_IMPORT_RECEIPT\/V7/);
  assert.match(importer, /product_candidate_results candidate/);
  assert.match(
    importer,
    /PRODUCT_CANDIDATE_RESULT_RECORD\/V1[\s\S]*complete_write_set[\s\S]*AGREEMENT_CANDIDATE_ENVELOPE_CARRIER\/V1[\s\S]*product_materialisation[\s\S]*product_query_result/,
  );
  assert.match(
    importer,
    /PRODUCT_CANDIDATE_RESULT_WRITE_SET\/V1[\s\S]*shared_row_adapter_receipt[\s\S]*product_query_result/,
  );
  assert.doesNotMatch(
    importer,
    /candidate\.canonical_payload\s*->'product_row'/,
  );
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
    /ALTER TABLE canonical_v2_staging\.product_query_result_active_page_cache ENABLE ROW LEVEL SECURITY/,
  );
  assert.match(
    sql,
    /REVOKE ALL ON TABLE canonical_v2_staging\.product_query_result_active_page_cache[\s\S]*canonical_v2_serving/,
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
