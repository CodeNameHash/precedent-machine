const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { compileFixtureContractV5 } = require('../lib/canonical-v2/contract-bundle');

const RUNNER = 'scripts/canonical-v2-staging-schema.mjs';
const F5_CONTRACT_FINGERPRINT = 'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478';

test('staging schema runner is fixed to the isolated project and rolls back by default', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /const terminal = mode === 'apply' \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /EXPECTED_DIGESTS/);
  assert.match(source, /--workdir <isolated-staging-workdir>/);
  assert.match(source, /realpathSync\(resolve\(workdirInput\)\)/);
  assert.match(source, /\['--workdir', workdir, 'db', 'query'/);
  assert.doesNotMatch(source, /precedent-machine['"]|tzulhdasmioeechxapdy/);
});

test('staging schema F5 binding matches the compiled frozen contract', () => {
  const runner = fs.readFileSync(RUNNER, 'utf8');
  const serving = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  assert.equal(compileFixtureContractV5().fingerprint, F5_CONTRACT_FINGERPRINT);
  assert.match(runner, new RegExp(F5_CONTRACT_FINGERPRINT));
  assert.match(serving, new RegExp(F5_CONTRACT_FINGERPRINT));
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

test('staging schema runner requires an explicit isolated workdir before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--workdir <isolated-staging-workdir>/);
  assert.doesNotMatch(result.stdout, /Dry-running canonical/);
});

test('staging schema verification checks writer, serving RPCs and denied broad roles', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /canonical_v2_write/);
  assert.match(source, /canonical_json_parity_passes/);
  assert.match(source, /content_id_parity_passes/);
  assert.match(source, /writer_envelope_identity_enforced/);
  assert.match(source, /legacy canonical write input can only replay an existing receipt/);
  assert.match(source, /existing_receipt\.canonical_payload IS DISTINCT FROM p_receipt/);
  assert.match(source, /canonical_identity_helpers_are_private/);
  assert.match(source, /d6cb15c9f114f22d010f468b08defd504339e33f4ca12dc70f066a3158d3ca98/);
  assert.match(source, /canonical writer accepted a forged input digest/);
  assert.match(source, /canonical writer accepted a forged receipt ID/);
  assert.match(source, /canonical writer input digest does not match the exact write envelope/);
  assert.match(source, /canonical writer receipt ID does not match its canonical body/);
  assert.match(source, /aclexplode/);
  assert.match(source, /checked_privilege\.grantee = 0/);
  assert.match(source, /if \(result\.stdout\) process\.stderr\.write\(result\.stdout\)/);
  assert.match(source, /canonical_v2_staging\.validated_semantic_graphs/);
  assert.match(source, /canonical_v2_staging\.candidate_release_semantic_graphs/);
  assert.match(source, /canonical_v2_staging\.candidate_release_correction_input_seals/);
  assert.match(source, /canonical_v2_staging\.candidate_release_correction_discharges/);
  assert.match(source, /canonical_v2_staging\.correction_authority_materialisations/);
  assert.match(source, /canonical_v2_staging\.correction_discharge_maps/);
  assert.match(source, /canonical_v2_staging\.candidate_input_head_versions/);
  assert.match(source, /canonical_v2_staging\.candidate_input_heads/);
  assert.match(source, /candidate_input_head_partition_key_is_exact/);
  assert.match(source, /denominator_precision_projection_is_canonical/);
  assert.match(source, /denominator_precision_domain_is_governed/);
  assert.match(source, /f5_money_precision_is_required/);
  assert.match(source, /incomplete_canonical_result,components,0,denominator,precision/);
  assert.match(source, /incomplete_canonical_result,components,0,claim_attributes,denominator_precision/);
  assert.match(source, /receipt_correction_seal_exists/);
  assert.match(source, /receipt_candidate_input_head_exists/);
  assert.match(source, /receipt_correction_discharge_map_exists/);
  assert.match(source, /active_pointer_correction_root_exists/);
  assert.match(source, /market_rpc_exists/);
  assert.match(source, /anon_market_denied/);
  assert.match(source, /service_role_market_denied/);
  assert.match(source, /serving_market_allowed/);
  assert.match(source, /active_query_rpc_exists/);
  assert.match(source, /serving_active_query_allowed/);
  assert.match(source, /serving_pinned_query_denied/);
  assert.match(source, /canonical_v2_active_review_context/);
  assert.match(source, /canonical_v2_exact_detail/);
  assert.match(source, /canonical_v2_select_candidate_inputs/);
  assert.match(source, /canonical_v2_recheck_candidate_input_head/);
  assert.match(source, /canonical_v2_rollback_inactive_candidate_release/);
  assert.match(source, /has_function_privilege\('anon'/);
  assert.match(source, /has_function_privilege\('service_role'/);
  assert.match(source, /has_function_privilege\('canonical_v2_serving'/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'.*candidate_release_semantic_graphs/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'.*candidate_release_correction_input_seals/);
  assert.match(source, /has_table_privilege\('canonical_v2_serving'.*candidate_release_correction_discharges/);
  assert.match(source, /writer_candidate_input_selector_allowed/);
  assert.match(source, /writer_candidate_input_recheck_allowed/);
  assert.match(source, /service_role_inactive_candidate_rollback_denied/);
  assert.match(source, /serving_inactive_candidate_rollback_denied/);
  assert.match(source, /writer_inactive_candidate_rollback_allowed/);
  assert.match(source, /writer_candidate_input_head_table_denied/);
  assert.match(source, /const rows = Array\.isArray\(output\) \? output : output\?\.rows/);
  assert.match(source, /rows\.length === 1/);
  assert.match(source, /passed !== true/);
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
  assert.match(source, /PRIMARY KEY \(environment, contract_fingerprint\)/);
  assert.match(source, /environment = next_candidate_input_head->>'environment'/);
  assert.match(source, /contract_fingerprint = next_candidate_input_head->>'contract_fingerprint'/);
  assert.match(source, /exceeds the 512-materialisation bound/);
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.canonical_v2_select_candidate_inputs/);
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.canonical_v2_recheck_candidate_input_head/);
  assert.match(source, /current_head\.environment = p_environment/);
  assert.match(source, /current_head\.contract_fingerprint = p_contract_fingerprint/);
  const recheckStart = source.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_recheck_candidate_input_head',
  );
  const recheckEnd = source.indexOf('REVOKE ALL ON SCHEMA canonical_v2_staging', recheckStart);
  assert.match(source.slice(recheckStart, recheckEnd), /FOR SHARE OF current_head/);
  assert.match(source, /ORDER BY map_entry\.entry_ordinal/);
  assert.match(source, /REVOKE ALL ON FUNCTION public\.canonical_v2_select_candidate_inputs[\s\S]*service_role/);
  assert.match(source, /REVOKE ALL ON FUNCTION public\.canonical_v2_recheck_candidate_input_head[\s\S]*service_role/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_select_candidate_inputs[\s\S]*TO canonical_v2_writer/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_recheck_candidate_input_head[\s\S]*TO canonical_v2_writer/);
  assert.doesNotMatch(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_(?:select_candidate_inputs|recheck_candidate_input_head)[\s\S]*TO (?:anon|authenticated|service_role)/);
});
