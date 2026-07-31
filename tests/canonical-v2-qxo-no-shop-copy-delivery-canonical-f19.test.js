const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const {
  compileFixtureContractV12,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  compileMarketCohortRequest,
  compileOfflineInterpretedMarketCohortRequest,
} = require('../lib/canonical-v2/market-cohort-query');
const {
  validateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');
const {
  planActiveReleasePointerSwap,
  validateOfflineCandidateRelease,
} = require('../lib/canonical-v2/candidate-release');
const {
  ACTIVE_SERVING_FINGERPRINT_SNAPSHOT,
  QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
} = require('../lib/canonical-v2/candidate-metric-definition-policy');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-canonical-f19-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

function request(classDigest = 'a'.repeat(64)) {
  return {
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    integration_admission_id:
      QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
    serving_namespace_id: 'b'.repeat(64),
    corpus_release_id: 'c'.repeat(64),
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    metric_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
    metric_version: 1,
    concept_key: 'NOSOL-NOTICE',
    party: {
      role: 'OBLIGATED_PARTY',
      value: 'COMPANY',
      capacity: 'TARGET',
    },
    subject_deal_key: 'deal:qxo-topbuild',
    comparability_class_digest: classDigest,
    filters: {},
  };
}

test('F19 staging verification executes the deterministic admitted-source runner', (t) => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.match(source, /buildCopyDeliveryCanonicalF19Runtime/);
  assert.match(source, /buildSourceInputs\(compileFixtureContractV12\(\)\)/);
  assert.match(source, /--copy-delivery-canonical-f19-verify/);
  assert.equal(expected.environment, 'STAGING');
  assert.equal(
    expected.qxo_no_shop_copy_delivery_canonical_f19_id,
    '4b825c971317b982e20d2fd231f9f2329f263237648b363a4e3cf988dfc142a8',
  );
  if (!fs.existsSync('supabase/.temp/project-ref')
    || !fs.existsSync('supabase/.temp/linked-project.json')) {
    t.skip('isolated staging project is not linked in this environment');
    return;
  }
  const run = spawnSync(process.execPath, [
    RUNNER,
    '--copy-delivery-canonical-f19-verify',
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

test('F19 resolves canonical and exact-source readiness but remains non-activatable', () => {
  const value = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(
    value.status.canonical_candidate_contract_integration,
    'RESOLVED_OFFLINE',
  );
  assert.equal(
    value.status.admitted_exact_source_resolver,
    'RESOLVED_OFFLINE',
  );
  assert.equal(value.status.indexed_query_executor_certification, 'NOT_BUILT');
  assert.equal(value.status.active_serving_authority, 'NONE');
  assert.equal(value.status.active_query_authority, 'NONE');
  assert.equal(value.status.active_pointer_authority, 'NONE');
  assert.equal(value.status.publication_blocked, true);
  assert.equal(value.status.release_eligible, false);
  assert.equal(value.exact_excerpt_ids.length, 4);
  assert.equal(
    value.exact_excerpt_ids[0],
    'bf612df38b8732a7908aa6c30ab9b3f85609b3ffc21ce01dc88e28e1367c0ed4',
  );
  assert.deepEqual(value.exact_detail_legal_evidence, {
    company_request_definition_present: true,
    primary_trigger_present: true,
  });
  assert.deepEqual(value.adversarial_rejections, {
    exact_detail_drift: true,
    nested_f17_drift: true,
    resigned_directory_drift: true,
    resigned_exact_detail_drift: true,
    resigned_namespace_drift: true,
    resigned_query_drift: true,
  });
});

test('offline cohort identity is semantic-class keyed and release-aware', () => {
  const first = compileOfflineInterpretedMarketCohortRequest(request());
  const same = compileOfflineInterpretedMarketCohortRequest(request());
  const changed = compileOfflineInterpretedMarketCohortRequest(
    request('d'.repeat(64)),
  );
  assert.equal(first.cohort_digest, same.cohort_digest);
  assert.equal(first.cache_key, same.cache_key);
  assert.notEqual(first.cohort_digest, changed.cohort_digest);
  assert.notEqual(first.cache_key, changed.cache_key);
  assert.equal(first.execution_state, 'NOT_BUILT');
});

test('V12 remains outside every active query and row validator', () => {
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
  const activeRequest = request();
  delete activeRequest.authority_scope;
  delete activeRequest.integration_admission_id;
  delete activeRequest.comparability_class_digest;
  assert.throws(
    () => compileMarketCohortRequest(activeRequest),
    /contract_fingerprint does not match a frozen serving contract/,
  );
  assert.throws(() => validateSharedServingRow({
    schema_version: 'SHARED_SERVING_ROW/V2',
  }));
});

test('offline release schemas cannot enter the active pointer path', () => {
  assert.throws(() => planActiveReleasePointerSwap({
    current_pointer: {},
    candidate_manifest: {
      schema_version: 'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
      certification_state: 'CERTIFIED_OFFLINE_NOT_ACTIVATABLE',
      activation_eligibility:
        'INELIGIBLE_CONTRACT_NOT_SERVING_ADMITTED',
      contract_fingerprint: compileFixtureContractV12().fingerprint,
    },
  }));
});

test('offline release validation rejects skeletal self-asserted partitions', () => {
  assert.throws(() => validateOfflineCandidateRelease({
    schema_version: 'OFFLINE_CANDIDATE_RELEASE_BUNDLE/V1',
    manifest: {
      certification_state: 'CERTIFIED_OFFLINE_NOT_ACTIVATABLE',
      activation_eligibility:
        'INELIGIBLE_CONTRACT_NOT_SERVING_ADMITTED',
    },
    market_observations: [{}],
    shared_rows: [{}],
    exact_detail_packages: [{}],
    cohort_requests: [{}],
    cohort_results: [{}],
    query_records: [{}],
    deal_directory_entries: [{}],
  }));
});
