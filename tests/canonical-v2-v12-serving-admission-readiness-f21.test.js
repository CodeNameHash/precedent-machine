const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  APPROVED_LEGAL_DECISIONS,
  F20_DIGEST,
  F20_ID,
  VERSION_STEPS,
  buildV12ServingAdmissionReadinessF21,
  fixtureF21Inputs,
  validateV12ServingAdmissionReadinessF21,
} = require('../lib/canonical-v2/v12-serving-admission-readiness-f21');

const FIXTURE_PATH =
  'tests/fixtures/canonical-v2/v12-serving-admission-readiness-f21.json';
const F20_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json';
const MODULE_PATH =
  'lib/canonical-v2/v12-serving-admission-readiness-f21.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function inputs() {
  return fixtureF21Inputs(readJson(F20_FIXTURE_PATH));
}

test('F21 deterministically records the approved non-activating readiness boundary', () => {
  const expected = readJson(FIXTURE_PATH);
  const first = buildV12ServingAdmissionReadinessF21(inputs());
  const second = buildV12ServingAdmissionReadinessF21(inputs());
  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.approval_record.decisions), true);
  assert.equal(
    validateV12ServingAdmissionReadinessF21({
      v12_serving_admission_readiness_f21: expected,
      ...inputs(),
    }),
    true,
  );
});

test('F21 identities cover the complete readiness payload', () => {
  const value = readJson(FIXTURE_PATH);
  const {
    v12_serving_admission_readiness_f21_id: readinessId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = value;
  assert.equal(
    readinessId,
    contentId('V12_SERVING_ADMISSION_READINESS_F21/V1', body),
  );
  assert.equal(
    payloadDigest,
    contentId(
      'V12_SERVING_ADMISSION_READINESS_F21_PAYLOAD/V1',
      body,
    ),
  );
  assert.equal(
    readinessId,
    '7783e9734d257cadf52c330a6f201b246af060c486c5d69a9b2d490dccae6bd9',
  );
  assert.equal(
    payloadDigest,
    '1cf8e29e045c35a36184b499d5d2d91b1ba6cda0acc3d7073bf72a3881c153fc',
  );
});

test('F21 records the exact approved legal decisions without serving authority', () => {
  const value = readJson(FIXTURE_PATH);
  assert.deepEqual(
    value.approval_record.decisions,
    APPROVED_LEGAL_DECISIONS,
  );
  assert.deepEqual(
    value.approval_record.decisions.map(
      (decision) => decision.decision_key,
    ),
    [
      'ATOMIC_NO_SHOP_ACTIONS_AND_EXACT_EXCEPTION_GROUPING',
      'QXO_COPY_CLOCK_PRIMARY_TRIGGER_AND_APPLICATION_SCOPE',
      'AMBIGUITY_QUALIFIED_COPY_DELIVERY_MARKET_COMPARISON',
      'SOURCE_LOCAL_PLURAL_AND_NESTED_DEFINITION_HANDLING',
    ],
  );
  assert.equal(value.approval_record.review_authority, 'BEN');
  assert.equal(value.approval_record.approved_on, '2026-07-27');
  assert.equal(
    value.approval_record.approval_scope,
    'V6_THROUGH_V12_LEGAL_SEMANTICS_READINESS_ONLY',
  );
  assert.equal(
    value.approval_record.serving_admission_authority,
    'NONE',
  );
  assert.equal(
    value.approval_record.release_activation_authority,
    'NONE',
  );
  assert.equal(
    value.approval_record.production_cutover_authority,
    'NONE',
  );
});

test('F21 inventories every cumulative V6 through V12 contract delta', () => {
  const value = readJson(FIXTURE_PATH);
  assert.deepEqual(
    value.version_inventory.map((entry) => ({
      version: entry.contract_version,
      predecessor: entry.predecessor_version,
      delta: entry.exact_delta_fields,
      governed_change: entry.governed_change,
    })),
    VERSION_STEPS.map((entry) => ({
      version: entry.version,
      predecessor: entry.predecessor_version,
      delta: entry.expected_delta_fields,
      governed_change: entry.governed_change,
    })),
  );
  assert.equal(value.version_inventory.length, 7);
  assert.equal(
    value.version_inventory.every(
      (entry) => entry.contract_validation === 'PASSED',
    ),
    true,
  );
  assert.equal(
    value.governed_semantic_checks.length,
    7,
  );
  assert.equal(
    value.governed_semantic_checks.every(
      (entry) => entry.state === 'PASSED',
    ),
    true,
  );
});

test('F21 binds exact F20 evidence while V12 remains outside active serving', () => {
  const value = readJson(FIXTURE_PATH);
  assert.equal(
    value.f20_binding.qxo_no_shop_copy_delivery_query_f20_id,
    F20_ID,
  );
  assert.equal(
    value.f20_binding.canonical_payload_digest,
    F20_DIGEST,
  );
  assert.equal(value.f20_binding.validation, 'PASSED');
  assert.equal(
    value.target_contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V12,
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      FIXTURE_CONTRACT_FINGERPRINT_V12,
    ),
    false,
  );
  assert.deepEqual(
    value.serving_policy.active_serving_fingerprints,
    [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
  );
  assert.equal(value.serving_policy.target_v12_admitted, false);
  assert.equal(
    value.serving_policy.cumulative_v6_through_v12_admitted,
    false,
  );
  assert.equal(value.serving_policy.policy_unchanged, true);
  assert.equal(
    value.serving_policy.current_admission_mechanism_scope,
    'CONTRACT_FINGERPRINT_WIDE',
  );
  assert.equal(
    value.serving_policy.current_admission_policy_evidence
      .serving_policy_snapshot_id,
    'ecbf45b63fd58432aff3a33e9830c6e713965745290ee0457da698cd12cbd275',
  );
  assert.equal(
    value.serving_policy.current_admission_policy_evidence
      .validator_source_artifacts.length,
    2,
  );
});

test('F21 blocks global V12 admission and identifies the exact metric-scoped boundary', () => {
  const value = readJson(FIXTURE_PATH);
  assert.deepEqual(value.readiness, {
    state: 'NOT_READY_FOR_CURRENT_GLOBAL_SERVING_ADMISSION',
    metric_scoped_candidate_state:
      'COPY_DELIVERY_METRIC_EVIDENCE_COMPLETE_PENDING_SCOPED_ADMISSION_MECHANISM',
    certified_scope: {
      contract_fingerprint:
        '261525a8268a1392428a610bbf0c2166c87318192971d08bc7e6ac5f2c7235e5',
      metric_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
      metric_version: 1,
      metric_definition_id:
        '9182ca9ccdba84e9d6f45458b29b9146aab525c55b8fedaa8b482b95ecd114a3',
      concept_key: 'NOSOL-NOTICE',
      required_claim_definition_key:
        'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
      interpretation_admission_digest:
        'a398d8a4bcafbc6765dcf8106c6d42f89827cba80ebbf32da41596ce0e81d069',
      candidate_metric_definition_admission_id:
        '5c0300e32520520db7258b59ccdd133c4ab16d2ad4e636208d47af0148b382a0',
      integration_admission_id:
        '03bdc0671b85755d517a994fb903960beae5969c2bbb5443e1be3fe288524714',
      qxo_no_shop_copy_delivery_canonical_f19_id:
        '4b825c971317b982e20d2fd231f9f2329f263237648b363a4e3cf988dfc142a8',
      qxo_no_shop_copy_delivery_query_f20_id: F20_ID,
      certification_state: 'CERTIFIED_OFFLINE_ONLY',
    },
    required_metric_scoped_gate_key_fields: [
      'contract_fingerprint',
      'metric_key',
      'metric_version',
      'concept_key',
      'required_claim_definition_key',
      'interpretation_admission_digest',
      'candidate_metric_definition_admission_id',
      'integration_admission_id',
    ],
    next_permitted_slice:
      'METRIC_SCOPED_V12_SERVING_ADMISSION_BOUNDARY_DESIGN',
    remaining_required_authority: [
      'SEPARATE_METRIC_SCOPED_V12_SERVING_POLICY_ADMISSION',
    ],
    evidence_blocker_codes: [
      'CURRENT_ADMISSION_POLICY_IS_FINGERPRINT_WIDE',
      'F20_CERTIFIES_COPY_DELIVERY_METRIC_ONLY',
      'GLOBAL_V12_ADMISSION_WOULD_ENABLE_UNCERTIFIED_METRICS',
      'NON_COPY_DELIVERY_V6_V12_FAMILIES_RETAIN_NO_SERVING_AUTHORITY',
      'METRIC_SCOPED_SERVING_ADMISSION_NOT_IMPLEMENTED',
    ],
  });
  assert.deepEqual(value.authority, {
    active_serving_authority: 'NONE',
    active_query_authority: 'NONE',
    active_pointer_authority: 'NONE',
    corpus_write_authority: 'NONE',
    release_activation_authority: 'NONE',
    production_cutover_authority: 'NONE',
  });
  assert.deepEqual(value.status, {
    publication_blocked: true,
    release_eligible: false,
    blocker_codes: [
      'GLOBAL_V12_FINGERPRINT_ADMISSION_FORBIDDEN_WITH_CURRENT_EVIDENCE',
      'V12_COPY_DELIVERY_METRIC_SCOPED_ADMISSION_REQUIRED',
    ],
  });
});

test('F21 proves cumulative V6 through V11 carriers retain no serving authority', () => {
  const value = readJson(FIXTURE_PATH);
  const carrierEvidence = value.serving_evidence_inventory
    .slice(0, 3)
    .flatMap((scope) => scope.source_artifacts);
  assert.equal(carrierEvidence.length, 9);
  carrierEvidence.forEach((artifact) => {
    assert.deepEqual(artifact.operative_status, {
      serving_authority: 'NONE',
      release_authority: 'NONE',
    });
    assert.match(artifact.source_snapshot_digest, /^[a-f0-9]{64}$/);
    assert.match(artifact.source_artifact_id, /^[a-f0-9]{64}$/);
  });

  const carrierPaths = [
    'lib/canonical-v2/qxo-no-shop-actions-f6-parser-bridge.js',
    'lib/canonical-v2/qxo-no-shop-exception-source-binding-f6.js',
    'lib/canonical-v2/qxo-no-shop-notice-review-materialisation-f7.js',
    'lib/canonical-v2/qxo-no-shop-definition-relationships-f8.js',
    'lib/canonical-v2/qxo-no-shop-notice-receipt-f10.js',
    'lib/canonical-v2/qxo-no-shop-definition-control-f11.js',
    'lib/canonical-v2/qxo-no-shop-definition-scope-closure-f13.js',
    'lib/canonical-v2/qxo-no-shop-notice-revision-f14.js',
    'lib/canonical-v2/qxo-no-shop-copy-clock-f15.js',
  ];
  carrierPaths.forEach((path) => {
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /serving_authority:\s*'NONE'/, path);
    assert.match(source, /release_authority:\s*'NONE'/, path);
  });
});

test('F21 records that current live validators admit whole fingerprints', () => {
  const value = readJson(FIXTURE_PATH);
  const policyEvidence =
    value.serving_policy.current_admission_policy_evidence;
  assert.equal(policyEvidence.mechanism_scope, 'CONTRACT_FINGERPRINT_WIDE');
  assert.equal(policyEvidence.admission_key, 'contract_fingerprint');
  policyEvidence.validator_source_artifacts.forEach((artifact) => {
    assert.deepEqual(artifact.operative_status, {
      admission_key: 'contract_fingerprint',
      admission_match:
        'FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes',
      mechanism_scope: 'CONTRACT_FINGERPRINT_WIDE',
    });
  });

  const marketQuery = fs.readFileSync(
    'lib/canonical-v2/market-cohort-query.js',
    'utf8',
  );
  const sharedRow = fs.readFileSync(
    'lib/canonical-v2/shared-serving-row.js',
    'utf8',
  );
  assert.match(
    marketQuery,
    /FIXTURE_SERVING_CONTRACT_FINGERPRINTS\.includes\(request\.contract_fingerprint\)/,
  );
  assert.match(
    sharedRow,
    /FIXTURE_SERVING_CONTRACT_FINGERPRINTS\.includes\(row\.provenance\.contract_fingerprint\)/,
  );
});

test('F21 rejects missing contracts, drifted semantics and serving-policy widening', () => {
  const missing = inputs();
  missing.contract_bundles.splice(3, 1);
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(missing),
    /exact V5 through V12 contract chain/,
  );

  const reordered = inputs();
  [
    reordered.contract_bundles[2],
    reordered.contract_bundles[3],
  ] = [
    reordered.contract_bundles[3],
    reordered.contract_bundles[2],
  ];
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(reordered),
    /contract V7 identity has drifted/,
  );

  const drifted = inputs();
  drifted.contract_bundles[7] = clone(
    drifted.contract_bundles[7],
  );
  drifted.contract_bundles[7].claim_definitions[0]
    .canonical_value_type = 'INVENTED';
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(drifted),
  );

  const widened = inputs();
  widened.active_serving_fingerprints.push(
    FIXTURE_CONTRACT_FINGERPRINT_V12,
  );
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(widened),
    /cannot widen active serving policy/,
  );

  const driftedSource = inputs();
  driftedSource.source_snapshots[0].source_bytes +=
    '\n// widened authority';
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(driftedSource),
    /source evidence drifted/,
  );

  const missingPolicySource = inputs();
  missingPolicySource.source_snapshots.pop();
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(missingPolicySource),
    /exact cumulative carrier and serving-policy source snapshots/,
  );
});

test('F21 rejects drifted F20 evidence and self-rewritten approval output', () => {
  const driftedF20 = inputs();
  driftedF20.f20_attestation = clone(
    driftedF20.f20_attestation,
  );
  driftedF20.f20_attestation.query_certification
    .different_class_poison_excluded = false;
  assert.throws(
    () => buildV12ServingAdmissionReadinessF21(driftedF20),
    /exact content-addressed F20 proof/,
  );

  const candidate = readJson(FIXTURE_PATH);
  candidate.approval_record.decisions[0].approved_value =
    'INVENTED_APPROVAL';
  assert.throws(
    () => validateV12ServingAdmissionReadinessF21({
      v12_serving_admission_readiness_f21: candidate,
      ...inputs(),
    }),
    /readiness attestation has drifted/,
  );
});

test('F21 has no database, network, activation or serving-admission path', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.doesNotMatch(
    source,
    /(?:@supabase|createClient|fetch\(|child_process|execFile|spawnSync)/,
  );
  assert.doesNotMatch(
    source,
    /\b(?:INSERT|UPDATE|DELETE|UPSERT|ALTER|CREATE\s+TABLE|COMMIT)\b/i,
  );
  assert.doesNotMatch(
    source,
    /FIXTURE_SERVING_CONTRACT_FINGERPRINTS\.(?:push|splice|unshift)/,
  );
  assert.equal(
    canonicalJson(FIXTURE_SERVING_CONTRACT_FINGERPRINTS),
    canonicalJson([
      FIXTURE_CONTRACT_FINGERPRINT_V1,
      FIXTURE_CONTRACT_FINGERPRINT_V2,
      FIXTURE_CONTRACT_FINGERPRINT_V3,
      FIXTURE_CONTRACT_FINGERPRINT_V4,
      FIXTURE_CONTRACT_FINGERPRINT_V5,
    ]),
  );
});
