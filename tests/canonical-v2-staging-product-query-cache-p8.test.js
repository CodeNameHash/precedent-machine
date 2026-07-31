const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'scripts/canonical-v2-staging-product-query-cache-p8.mjs', 'utf8',
);
const allowlist = JSON.parse(fs.readFileSync(
  '.github/phase-allowlists/wp-p8-stage4-product-query-cache-staging-v1.json', 'utf8',
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

test('P8 Product cache proof checks empty caching, repeat identity, budgets and rollback', () => {
  assert.match(source, /first_page IS DISTINCT FROM second_page/);
  assert.match(source, /first_page->'rows' IS DISTINCT FROM '\[\]'::jsonb/);
  assert.match(source, /cache_row_count <> 1/);
  assert.match(source, /relrowsecurity/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'/);
  assert.match(source, /maximum_database_rows_per_request'', 51/);
  assert.match(source, /maximum_value_ttl_seconds'', 3600/);
  assert.match(source, /canonicalJson\(before\) !== canonicalJson\(after\)/);
  assert.match(source, /rollback_cache_rows/);
});

test('P8 Product cache proof scope permits only its proof files', () => {
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-stage4-product-query-cache-staging-v1.json',
    'scripts/canonical-v2-staging-product-query-cache-p8.mjs',
    'tests/canonical-v2-staging-product-query-cache-p8.test.js',
  ]);
});
