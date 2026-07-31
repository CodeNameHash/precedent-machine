const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'scripts/canonical-v2-staging-product-query-cache-p8.mjs', 'utf8',
);
const allowlist = JSON.parse(fs.readFileSync(
  '.github/phase-allowlists/wp-p8-stage4-product-query-cache-staging-v1.json', 'utf8',
));
const sqlParityAllowlist = JSON.parse(fs.readFileSync(
  '.github/phase-allowlists/wp-p8-stage4-product-query-cache-sql-parity-v1.json', 'utf8',
));
const nonemptyParityAllowlist = JSON.parse(fs.readFileSync(
  '.github/phase-allowlists/wp-p8-stage4-product-nonempty-cache-parity-v1.json', 'utf8',
));

test('P8 Product cache proof is staging-only and rollback-only', () => {
  assert.match(source, /project_ref: 'sjumbznveyyiizhwvixj'/);
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /canonical_v2_active_product_query_results/);
  assert.match(source, /canonical_v2_import_candidate_release/);
  assert.match(source, /canonical_v2_activate_candidate_release/);
  assert.match(source, /ON COMMIT DROP/);
  assert.doesNotMatch(source, /commit:\s*true|production/);
});

test('P8 Product cache proof checks empty and non-empty cache hits, budgets and rollback', () => {
  assert.match(source, /first_page IS DISTINCT FROM second_page/);
  assert.match(source, /first_page->'rows' IS DISTINCT FROM '\[\]'::jsonb/);
  assert.match(source, /product_page IS DISTINCT FROM product_repeat_page/);
  assert.match(source, /canonical_payload,exact_detail_action/);
  assert.match(source, /product_cache_created_at_after IS DISTINCT FROM product_cache_created_at/);
  assert.match(source, /cache_row_count <> 2/);
  assert.match(source, /relrowsecurity/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'/);
  assert.match(source, /SET search_path TO ''pg_catalog'', ''canonical_v2_staging''/);
  assert.match(source, /maximum_database_rows_per_request'', 51/);
  assert.match(source, /maximum_value_ttl_seconds'', 3600/);
  assert.match(source, /canonicalJson\(before\) !== canonicalJson\(after\)/);
  assert.match(source, /rollback_cache_rows/);
  assert.match(source, /rollback_partition_rows/);
  assert.match(source, /rollback_serving_rows/);
  assert.match(source, /active_pointer_generation: after\.generation/);
});

test('P8 Product cache proof uses the actual Agreement writer record without a synthetic bypass', () => {
  assert.match(source, /compileAgreementCandidateProductMaterialisation/);
  assert.match(source, /buildAgreementCandidateEnvelopeCarrier/);
  assert.match(source, /buildProductCandidateResultWriteEnvelope/);
  assert.match(source, /validateProductCandidateResultWriteSet/);
  assert.match(source, /public\.canonical_v2_write/);
  assert.doesNotMatch(source, /PRODUCT_CANDIDATE_RESULT_IMPORT_PROOF/);
  assert.doesNotMatch(source, /INSERT INTO canonical_v2_staging\.product_candidate_results/);
});

test('P8 Product cache proof scope permits only its proof files', () => {
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-stage4-product-query-cache-staging-v1.json',
    'scripts/canonical-v2-staging-product-query-cache-p8.mjs',
    'tests/canonical-v2-staging-product-query-cache-p8.test.js',
  ]);
});

test('P8 Product cache SQL parity scope permits only its correction files', () => {
  assert.deepEqual(sqlParityAllowlist.allowed, [
    '.github/phase-allowlists/wp-p8-stage4-product-query-cache-sql-parity-v1.json',
    'supabase/canonical-v2-serving.sql',
    'tests/canonical-v2-product-query-result-active-serving.test.js',
    'scripts/canonical-v2-staging-product-query-cache-p8.mjs',
    'tests/canonical-v2-staging-product-query-cache-p8.test.js',
  ]);
});

test('P8 non-empty Product cache parity scope permits only its correction files', () => {
  assert.deepEqual(nonemptyParityAllowlist.allowed, [
    '.github/phase-allowlists/wp-p8-stage4-product-nonempty-cache-parity-v1.json',
    'scripts/canonical-v2-optiona-authority-partition.mjs',
    'scripts/canonical-v2-staging-schema.mjs',
    'supabase/canonical-v2-serving.sql',
    'tests/canonical-v2-product-query-result-active-serving.test.js',
    'scripts/canonical-v2-staging-product-query-cache-p8.mjs',
    'tests/canonical-v2-staging-product-query-cache-p8.test.js',
    'sql/optionA/step0c-candidate-import-by-contract.sql',
  ]);
});
