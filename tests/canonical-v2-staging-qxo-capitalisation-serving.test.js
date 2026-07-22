const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const SCRIPT = 'scripts/canonical-v2-staging-qxo-capitalisation-serving.mjs';
const source = fs.readFileSync(SCRIPT, 'utf8');

test('inactive QXO serving verifier is exact-path, read-only and bounded', () => {
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /d8630dc4dc8fc0a4d88d1e473cf111063b9e71ebc2f0616418236ec2e2f8d4f8/);
  assert.match(source, /2d85d6a990292023e5a9249d1b39acfc89512a72b14e58c79c5e4b660fd9cdf9/);
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /SET LOCAL statement_timeout='10000ms'/);
  assert.match(source, /ROLLBACK/);
  assert.match(source, /MAX_RESULT_BYTES = 128 \* 1024/);
  assert.doesNotMatch(source, /--commit|--apply|--import|--activate/);
  assert.doesNotMatch(source, /INSERT|UPDATE|DELETE|TRUNCATE|canonical_v2_activate_candidate_release/);
});

test('one bounded verification read exercises every serving projection', () => {
  assert.match(source, /canonical_v2_active_release\('staging'\)/);
  assert.match(source, /canonical_v2_query_page\(/);
  assert.equal((source.match(/canonical_v2_market_cohort\(/g) || []).length, 1);
  assert.match(source, /canonical_v2_exact_detail\(/);
  assert.match(source, /rpc_calls: 4/);
  assert.match(source, /page_size => 2/);
  assert.doesNotMatch(source, /setTimeout|retry|maximumAttempts/);
  assert.doesNotMatch(source, /canonical_v2_staging\.(shared_serving_rows|market_observations|market_metric_slot_exclusions|exact_detail_serving_packages)/);
});

test('verification refuses release, legal-component and exact-detail drift', () => {
  assert.match(source, /validateSharedServingRow\(row\)/);
  assert.match(source, /validateMarketCohortResult\(subject, subjectRequest\)/);
  assert.match(source, /validateMarketCohortResult\(inventory, inventoryRequest\)/);
  assert.match(source, /validateServingExactDetailResult\(result, request\)/);
  assert.match(source, /CAPITALISATION_LIMBS_I_AND_III/);
  assert.match(source, /ACCURACY_EXCEPTION/);
  assert.match(source, /KNOWLEDGE_QUALIFIER_LIMB_I/);
  assert.match(source, /KNOWLEDGE_QUALIFIER_LIMB_III/);
  assert.match(source, /MAT_ALL_RESPECTS_DE_MINIMIS/);
  assert.match(source, /RESULT_NOT_COMPARABLE/);
  assert.match(source, /response\?\.components\?\.length !== 4/);
  assert.match(source, /response\?\.excerpts\?\.length !== 5/);
  assert.match(source, /relationship\.target_occurrence_ids\.length !== 2/);
});

test('attestation is compact and exposes no source payload', () => {
  const body = source.slice(source.indexOf('const body = {', source.indexOf('function buildAttestation')));
  assert.match(body, /candidate_remains_inactive: true/);
  assert.match(body, /active_pointer_unchanged: true/);
  assert.match(body, /row_serving_key/);
  assert.match(body, /exact_detail_package_digest/);
  assert.doesNotMatch(body, /^\s+(?:exact_text|raw_value|canonical_payload|response_body):/m);
});

test('ambiguous invocation fails before database work', () => {
  const result = require('node:child_process').spawnSync(
    process.execPath,
    [SCRIPT, '--dry-run'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stderr, /Supabase|database/);
});
