const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  ACTIVE_SERVING_FINGERPRINT_SNAPSHOT,
} = require('../lib/canonical-v2/candidate-metric-definition-policy');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

test('F20 staging verification executes the rollback-only class-keyed proof', (t) => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.match(source, /--copy-delivery-query-f20-verify/);
  assert.match(source, /ADD COLUMN comparability_class_digest text/);
  assert.match(
    source,
    /canonical_payload #>>\s+'{canonical_result,comparability_context,comparability_class_digest}'/,
  );
  assert.match(
    source,
    /CREATE INDEX \$\{CANDIDATE_INDEX_NAME\}/,
  );
  assert.match(
    source,
    /p_comparability_class_digest text/,
  );
  assert.match(
    source,
    /row\.comparability_class_digest = p_comparability_class_digest/,
  );
  assert.match(source, /primary_clock_application_scope_code/);
  assert.match(source, /buildComparabilityClass/);
  assert.match(source, /validateOfflineCandidateSharedServingRow/);
  assert.match(source, /EXPLAIN \(ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF\)/);
  assert.match(source, /ROLLBACK;/);
  assert.match(source, /\bINSERT INTO\b/);
  assert.match(source, /\bALTER TABLE\b/);
  const readOnlyModes = withoutF20RollbackOnlyCertification(source);
  assert.doesNotMatch(
    readOnlyModes,
    /\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|UPSERT\s+INTO|ALTER\s+TABLE)\b/i,
  );
  assert.equal(expected.environment, 'STAGING');
  if (process.env.CANONICAL_V2_LIVE_F20 !== '1') {
    t.skip('set CANONICAL_V2_LIVE_F20=1 for the linked staging proof');
    return;
  }
  if (!fs.existsSync('supabase/.temp/project-ref')
    || !fs.existsSync('supabase/.temp/linked-project.json')) {
    t.skip('isolated staging project is not linked in this environment');
    return;
  }
  const run = spawnSync(process.execPath, [
    RUNNER,
    '--copy-delivery-query-f20-verify',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 300_000,
    env: {
      ...process.env,
      QXO_STAGING_QUERY_TIMEOUT_MS: '240000',
    },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), expected);
});

test('F20 certifies the honest indexed executor boundary and no more', () => {
  const value = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(
    value.qxo_no_shop_copy_delivery_query_f20_id,
    'bf2e3edd1bf1247fe2bb5a21f01b86141725beb3ad9b1c0d61091b855fe4ba23',
  );
  assert.equal(
    value.canonical_payload_digest,
    '9108e606e7a423c48a65b6c92efa818793701f16b717a3b949565c1c63eeaccc',
  );
  assert.equal(
    value.query_certification.candidate_executor_function,
    'canonical_v2_staging.canonical_v2_query_page_v3_candidate',
  );
  assert.equal(
    value.query_certification.required_index,
    'canonical_v2_shared_rows_query_v3_candidate_idx',
  );
  assert.equal(value.query_certification.plan_node_type, 'Index Only Scan');
  assert.equal(value.query_certification.plan_actual_rows, 1);
  assert.equal(value.query_certification.database_calls_per_request, 1);
  assert.deepEqual(
    value.query_certification.cache_states_verified,
    ['MISS', 'HIT'],
  );
  assert.equal(
    value.query_certification.different_class_poison_excluded,
    true,
  );
  assert.deepEqual(
    value.query_certification.poison_governed_semantic_delta,
    {
      alternative_value: 'ONE_SHARED_CLOCK',
      baseline_value: 'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE',
      dimension: 'primary_clock_application_scope_code',
    },
  );
  assert.equal(
    value.query_certification.poison_shared_row_validation,
    'PASSED',
  );
  assert.equal(
    value.query_certification.poison_interpretation_validation,
    'PASSED',
  );
  assert.equal(
    value.query_certification.poison_claim_revision_validation,
    'PASSED',
  );
  assert.equal(
    value.query_certification
      .poison_interpretation_identity_propagation,
    'PASSED',
  );
  assert.equal(
    value.query_certification
      .poison_interpretation_warning_digest_alignment,
    'PASSED',
  );
  assert.equal(
    value.query_certification.poison_review_authority,
    'HYPOTHETICAL_NON_ADMITTED_ONLY',
  );
  assert.equal(
    value.query_certification.poison_warning_authority,
    'HYPOTHETICAL_NON_ADMITTED_ONLY',
  );
  assert.equal(
    value.query_certification.poison_admission_state,
    'HYPOTHETICAL_NON_ADMITTED_ROLLBACK_ONLY',
  );
  assert.notEqual(
    value.query_certification.alternative_comparability_class_digest,
    value.query_certification.comparability_class_digest,
  );
  assert.equal(value.query_certification.active_release_unchanged, true);
  assert.equal(value.query_certification.rollback_verified, true);
  assert.equal(
    value.status.indexed_query_executor_certification,
    'RESOLVED_STAGING_ROLLBACK_ONLY',
  );
  assert.equal(value.status.active_serving_authority, 'NONE');
  assert.equal(value.status.active_query_authority, 'NONE');
  assert.equal(value.status.active_pointer_authority, 'NONE');
  assert.equal(value.status.publication_blocked, true);
  assert.equal(value.status.release_eligible, false);
  assert.deepEqual(
    value.status.blocker_codes,
    ['V12_ACTIVE_SERVING_ADMISSION_REQUIRED'],
  );
});

test('F20 rejects semantic leakage, plan drift and rollback residue', () => {
  const value = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.deepEqual(value.adversarial_rejections, {
    nested_f19_drift: true,
    plan_drift: true,
    poison_class_leak: true,
    result_drift: true,
    rollback_residue: true,
  });
  assert.equal(
    value.query_certification.comparability_class_digest,
    'c03185351732d02916e7ffce1fc05f21d2a0a338475fb426c79bbd5665e30bc3',
  );
  assert.equal(
    value.upstream_f19_id,
    '4b825c971317b982e20d2fd231f9f2329f263237648b363a4e3cf988dfc142a8',
  );
});

test('F20 leaves V12 outside active serving and pointer authority', () => {
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      FIXTURE_CONTRACT_FINGERPRINT_V12,
    ),
    false,
  );
  assert.deepEqual(
    [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
    [...ACTIVE_SERVING_FINGERPRINT_SNAPSHOT].sort(),
  );
});
