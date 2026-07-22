const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-schema.mjs';

test('staging schema runner is fixed to the isolated project and rolls back by default', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /const terminal = mode === 'apply' \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /EXPECTED_DIGESTS/);
  assert.doesNotMatch(source, /precedent-machine['"]|tzulhdasmioeechxapdy/);
});

test('staging schema runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--apply', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /Applying canonical/);
});

test('staging schema verification checks writer, serving RPCs and denied broad roles', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /canonical_v2_write/);
  assert.match(source, /canonical_v2_staging\.validated_semantic_graphs/);
  assert.match(source, /canonical_v2_staging\.candidate_release_semantic_graphs/);
  assert.match(source, /canonical_v2_staging\.candidate_release_correction_input_seals/);
  assert.match(source, /canonical_v2_staging\.candidate_release_correction_discharges/);
  assert.match(source, /canonical_v2_staging\.correction_authority_materialisations/);
  assert.match(source, /canonical_v2_staging\.correction_discharge_maps/);
  assert.match(source, /canonical_v2_staging\.candidate_input_head_versions/);
  assert.match(source, /canonical_v2_staging\.candidate_input_heads/);
  assert.match(source, /receipt_correction_seal_exists/);
  assert.match(source, /receipt_candidate_input_head_exists/);
  assert.match(source, /receipt_correction_discharge_map_exists/);
  assert.match(source, /active_pointer_correction_root_exists/);
  assert.match(source, /market_rpc_exists/);
  assert.match(source, /anon_market_denied/);
  assert.match(source, /service_role_market_denied/);
  assert.match(source, /serving_market_allowed/);
  assert.match(source, /canonical_v2_active_review_context/);
  assert.match(source, /canonical_v2_exact_detail/);
  assert.match(source, /canonical_v2_select_candidate_inputs/);
  assert.match(source, /canonical_v2_recheck_candidate_input_head/);
  assert.match(source, /has_function_privilege\('anon'/);
  assert.match(source, /has_function_privilege\('service_role'/);
  assert.match(source, /has_function_privilege\('canonical_v2_serving'/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'.*candidate_release_semantic_graphs/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'.*candidate_release_correction_input_seals/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'.*candidate_release_correction_discharges/);
  assert.match(source, /writer_candidate_input_selector_allowed/);
  assert.match(source, /writer_candidate_input_recheck_allowed/);
  assert.match(source, /writer_candidate_input_head_table_denied/);
});

test('governed schema uses valid collision-safe advisory lock identities', () => {
  const foundation = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
  const serving = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  assert.doesNotMatch(foundation, /E'\\u0000'/);
  assert.doesNotMatch(serving, /E'\\u0000'/);
  assert.match(foundation, /length\(p_operation\)::text \|\| ':' \|\| p_operation/);
  assert.match(serving, /length\(NEW\.metric_slot_key\)::text \|\| ':' \|\| NEW\.metric_slot_key/);
  assert.match(foundation, /extensions\.digest\(pg_catalog\.convert_to/);
  assert.match(foundation, /correction_discharge_map - ARRAY\[[\s\S]*\]::text\[\]/);
  assert.match(foundation, /\(correction_discharge_map->'counts'\) - 'ordered_entries'/);
});

test('staging correction authority is immutable, bounded, CAS-protected and writer-only', () => {
  const source = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
  assert.match(source, /'FIXTURE_CORRECTION_AUTHORITY'/);
  assert.match(source, /canonical_v2_staging\.correction_authority_materialisations/);
  assert.match(source, /canonical_v2_staging\.correction_discharge_maps/);
  assert.match(source, /canonical_v2_staging\.correction_discharge_map_entries/);
  assert.match(source, /canonical_v2_staging\.candidate_input_events/);
  assert.match(source, /canonical_v2_staging\.candidate_input_head_versions/);
  assert.match(source, /canonical_v2_staging\.candidate_input_heads/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /stale candidate input head compare-and-swap/);
  assert.match(source, /candidate input head changed before compare-and-swap/);
  assert.match(source, /exceeds the 512-materialisation bound/);
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.canonical_v2_select_candidate_inputs/);
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.canonical_v2_recheck_candidate_input_head/);
  assert.match(source, /current_head\.environment = p_environment/);
  assert.match(source, /current_head\.contract_fingerprint = p_contract_fingerprint/);
  assert.match(source, /ORDER BY map_entry\.entry_ordinal/);
  assert.match(source, /REVOKE ALL ON FUNCTION public\.canonical_v2_select_candidate_inputs[\s\S]*service_role/);
  assert.match(source, /REVOKE ALL ON FUNCTION public\.canonical_v2_recheck_candidate_input_head[\s\S]*service_role/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_select_candidate_inputs[\s\S]*TO canonical_v2_writer/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_recheck_candidate_input_head[\s\S]*TO canonical_v2_writer/);
  assert.doesNotMatch(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_(?:select_candidate_inputs|recheck_candidate_input_head)[\s\S]*TO (?:anon|authenticated|service_role)/);
});
