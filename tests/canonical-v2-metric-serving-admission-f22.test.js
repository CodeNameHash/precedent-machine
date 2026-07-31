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
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  compileFixtureContractV6,
  compileFixtureContractV7,
  compileFixtureContractV8,
  compileFixtureContractV9,
  compileFixtureContractV10,
  compileFixtureContractV11,
  compileFixtureContractV12,
  fixtureContractForFingerprint,
} = require('../lib/canonical-v2/contract-bundle');
const {
  METRIC_DEFINITIONS,
} = require('../lib/canonical-v2/serving-projection');
const {
  COPY_DELIVERY_METRIC_KEY,
  F19_ID,
  F20_ID,
  F21_DIGEST,
  F21_ID,
  LEGACY_SERVING_FINGERPRINTS,
  buildCopyDeliveryMetricServingAdmission,
  buildMetricServingAdmissionRegistry,
  resolveMetricServingAdmission,
  validateMetricServingAdmission,
  validateMetricServingAdmissionRegistry,
} = require('../lib/canonical-v2/metric-serving-admission');

const FIXTURE_PATH =
  'tests/fixtures/canonical-v2/metric-serving-admission-f22.json';
const MODULE_PATH =
  'lib/canonical-v2/metric-serving-admission.js';
const ACTIVE_VALIDATOR_SNAPSHOTS = Object.freeze({
  'lib/canonical-v2/market-cohort-query.js':
    '5a4f29bada0792b784441cb38ac47e08d80ba16bf9add853644a2f152e848b9c',
  'lib/canonical-v2/shared-serving-row.js':
    'f46f3e9610b54a9b0d08a29e4768ac5de52a4722abc89a152cb11931961b7e69',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function scopedInput(overrides = {}) {
  const admission = buildCopyDeliveryMetricServingAdmission();
  return {
    contract_bundle: compileFixtureContractV12(),
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    concept_key: admission.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    declared_metric_serving_admission_ids: [
      admission.metric_serving_admission_id,
    ],
    ...overrides,
  };
}

function firstSupportedMetric(contract) {
  return Object.values(METRIC_DEFINITIONS).find(
    (metric) => contract.concepts.some(
      (entry) => entry.concept_key === metric.concept_key,
    ) && contract.claim_definitions.some(
      (entry) => entry.claim_definition_key
        === metric.required_claim_definition_key,
    ),
  );
}

test('F22 registry and sole admission are deterministic and immutable', () => {
  const expected = readJson(FIXTURE_PATH);
  const first = buildMetricServingAdmissionRegistry();
  const second = buildMetricServingAdmissionRegistry();
  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.admission_records), true);
  assert.equal(Object.isFrozen(first.admission_records[0]), true);
  assert.equal(validateMetricServingAdmissionRegistry(expected), true);
  assert.equal(
    validateMetricServingAdmission(expected.admission_records[0]),
    true,
  );
});

test('F22 identities cover the complete admission and registry payloads', () => {
  const registry = readJson(FIXTURE_PATH);
  const admission = registry.admission_records[0];
  const {
    metric_serving_admission_id: admissionId,
    ...admissionBody
  } = admission;
  const {
    metric_serving_admission_registry_id: registryId,
    ...registryBody
  } = registry;
  assert.equal(
    admissionId,
    contentId('METRIC_SERVING_ADMISSION/V1', admissionBody),
  );
  assert.equal(
    registryId,
    contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V1',
      registryBody,
    ),
  );
  assert.equal(
    admissionId,
    '374bdce70c2e9425c66c20cb929daafa68a10b79b5da8a382437945d474366d7',
  );
  assert.equal(
    registryId,
    'd826967dfe53ae68c1513dd555d60be0ac0153e8a68dd3488cb4e14bec294b1d',
  );
});

test('F22 binds the exact F19 through F21 copy-delivery evidence', () => {
  const admission = readJson(FIXTURE_PATH).admission_records[0];
  assert.equal(admission.metric_key, COPY_DELIVERY_METRIC_KEY);
  assert.equal(
    admission.certification_evidence
      .qxo_no_shop_copy_delivery_canonical_f19_id,
    F19_ID,
  );
  assert.equal(
    admission.certification_evidence
      .qxo_no_shop_copy_delivery_query_f20_id,
    F20_ID,
  );
  assert.equal(
    admission.certification_evidence
      .v12_serving_admission_readiness_f21_id,
    F21_ID,
  );
  assert.equal(
    admission.certification_evidence
      .f21_canonical_payload_digest,
    F21_DIGEST,
  );
  const f21 = readJson(
    'tests/fixtures/canonical-v2/v12-serving-admission-readiness-f21.json',
  );
  assert.equal(
    f21.v12_serving_admission_readiness_f21_id,
    F21_ID,
  );
  assert.equal(f21.canonical_payload_digest, F21_DIGEST);
});

test('the exact V12 copy-delivery identity resolves only through the scoped lane', () => {
  const admission = buildCopyDeliveryMetricServingAdmission();
  const resolution = resolveMetricServingAdmission(scopedInput());
  assert.deepEqual(resolution, {
    schema_version: 'METRIC_SERVING_ADMISSION_RESOLUTION/V1',
    admission_lane: 'METRIC_SCOPED',
    contract_fingerprint: admission.contract_fingerprint,
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_definition_id: admission.metric_definition_id,
    concept_key: admission.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
    interpretation_admission_digest:
      admission.interpretation_admission_digest,
    candidate_metric_definition_admission_id:
      admission.candidate_metric_definition_admission_id,
    integration_admission_id:
      admission.integration_admission_id,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    metric_serving_admission_registry_id:
      buildMetricServingAdmissionRegistry()
        .metric_serving_admission_registry_id,
    declared_admission_membership: 'PASSED',
    release_manifest_validation:
      'NOT_PERFORMED_F23_REQUIRED',
    policy_eligibility:
      'PRELIMINARY_POLICY_MATCH_NOT_RELEASED',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
  assert.equal(Object.isFrozen(resolution), true);
});

test('every other V12 metric remains denied by the copy-delivery admission', () => {
  const contract = compileFixtureContractV12();
  const admission = buildCopyDeliveryMetricServingAdmission();
  const otherSupportedMetrics = Object.values(METRIC_DEFINITIONS)
    .filter((metric) => metric.metric_key !== COPY_DELIVERY_METRIC_KEY)
    .filter((metric) => contract.concepts.some(
      (entry) => entry.concept_key === metric.concept_key,
    ))
    .filter((metric) => contract.claim_definitions.some(
      (entry) => entry.claim_definition_key
        === metric.required_claim_definition_key,
    ));
  assert.equal(otherSupportedMetrics.length, 9);
  otherSupportedMetrics.forEach((metric) => {
    assert.throws(
      () => resolveMetricServingAdmission(scopedInput({
        metric_key: metric.metric_key,
        metric_version: metric.metric_version,
        concept_key: metric.concept_key,
        required_claim_definition_key:
          metric.required_claim_definition_key,
      })),
      /does not match the scoped admission/,
      metric.metric_key,
    );
  });
  assert.equal(
    buildMetricServingAdmissionRegistry().admission_records.length,
    1,
  );
  assert.equal(
    buildMetricServingAdmissionRegistry().admission_records[0]
      .metric_serving_admission_id,
    admission.metric_serving_admission_id,
  );
});

test('V6 through V11 remain denied without their own metric admission', () => {
  [
    compileFixtureContractV6,
    compileFixtureContractV7,
    compileFixtureContractV8,
    compileFixtureContractV9,
    compileFixtureContractV10,
    compileFixtureContractV11,
  ].forEach((compile) => {
    const contract = compile();
    const metric = firstSupportedMetric(contract);
    assert.ok(metric);
    assert.throws(
      () => resolveMetricServingAdmission({
        contract_bundle: contract,
        metric_key: metric.metric_key,
        metric_version: metric.metric_version,
        concept_key: metric.concept_key,
        required_claim_definition_key:
          metric.required_claim_definition_key,
        metric_serving_admission_id: null,
        declared_metric_serving_admission_ids: [],
      }),
      /sha256 digest/,
    );
  });
});

test('all eight scoped identity dimensions are substitution-resistant', () => {
  const admission = buildCopyDeliveryMetricServingAdmission();
  [
    ['contract_fingerprint', '0'.repeat(64)],
    ['metric_key', 'INVENTED_METRIC'],
    ['metric_version', 2],
    ['concept_key', 'INVENTED-CONCEPT'],
    ['required_claim_definition_key', 'INVENTED_CLAIM'],
    ['interpretation_admission_digest', '1'.repeat(64)],
    ['candidate_metric_definition_admission_id', '2'.repeat(64)],
    ['integration_admission_id', '3'.repeat(64)],
  ].forEach(([key, value]) => {
    const drifted = clone(admission);
    drifted[key] = value;
    assert.throws(
      () => validateMetricServingAdmission(drifted),
      /outside the exact F22 registry/,
      key,
    );
  });
});

test('missing, forged, unlisted and duplicate declared admissions fail closed', () => {
  const admission = buildCopyDeliveryMetricServingAdmission();
  assert.throws(
    () => resolveMetricServingAdmission(scopedInput({
      metric_serving_admission_id: null,
    })),
    /sha256 digest/,
  );
  assert.throws(
    () => resolveMetricServingAdmission(scopedInput({
      metric_serving_admission_id: '0'.repeat(64),
    })),
    /exact metric-scoped admission/,
  );
  assert.throws(
    () => resolveMetricServingAdmission(scopedInput({
      declared_metric_serving_admission_ids: [],
    })),
    /absent from the declared ID set/,
  );
  assert.throws(
    () => resolveMetricServingAdmission(scopedInput({
      declared_metric_serving_admission_ids: [
        admission.metric_serving_admission_id,
        admission.metric_serving_admission_id,
      ],
    })),
    /unique and sorted/,
  );
  assert.throws(
    () => resolveMetricServingAdmission(scopedInput({
      declared_metric_serving_admission_ids: Array(257)
        .fill(admission.metric_serving_admission_id),
    })),
    /bounded array/,
  );
});

test('legacy policy preserves the V3 rejection inside the V1 through V5 lane', () => {
  const listed = [
    FIXTURE_CONTRACT_FINGERPRINT_V1,
    FIXTURE_CONTRACT_FINGERPRINT_V2,
    FIXTURE_CONTRACT_FINGERPRINT_V3,
    FIXTURE_CONTRACT_FINGERPRINT_V4,
    FIXTURE_CONTRACT_FINGERPRINT_V5,
  ].sort();
  const eligible = [
    FIXTURE_CONTRACT_FINGERPRINT_V1,
    FIXTURE_CONTRACT_FINGERPRINT_V2,
    FIXTURE_CONTRACT_FINGERPRINT_V4,
    FIXTURE_CONTRACT_FINGERPRINT_V5,
  ].sort();
  assert.deepEqual(LEGACY_SERVING_FINGERPRINTS, listed);
  assert.deepEqual(
    [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
    listed,
  );
  assert.deepEqual(
    buildMetricServingAdmissionRegistry()
      .legacy_rejected_contracts,
    [FIXTURE_CONTRACT_FINGERPRINT_V3],
  );
  eligible.forEach((fingerprint) => {
    const contract = fixtureContractForFingerprint(fingerprint);
    const metric = firstSupportedMetric(contract);
    const resolution = resolveMetricServingAdmission({
      contract_bundle: contract,
      metric_key: metric.metric_key,
      metric_version: metric.metric_version,
      concept_key: metric.concept_key,
      required_claim_definition_key:
        metric.required_claim_definition_key,
      metric_serving_admission_id: null,
      declared_metric_serving_admission_ids: [],
    });
    assert.equal(
      resolution.admission_lane,
      'LEGACY_FINGERPRINT_WIDE',
    );
    assert.equal(resolution.metric_serving_admission_id, null);
    assert.equal(resolution.policy_eligibility, 'PASSED');
  });
  const rejectedContract = fixtureContractForFingerprint(
    FIXTURE_CONTRACT_FINGERPRINT_V3,
  );
  const rejectedMetric = firstSupportedMetric(rejectedContract);
  assert.throws(
    () => resolveMetricServingAdmission({
      contract_bundle: rejectedContract,
      metric_key: rejectedMetric.metric_key,
      metric_version: rejectedMetric.metric_version,
      concept_key: rejectedMetric.concept_key,
      required_claim_definition_key:
        rejectedMetric.required_claim_definition_key,
      metric_serving_admission_id: null,
      declared_metric_serving_admission_ids: [],
    }),
    /rejected legacy contract/,
  );
});

test('legacy contracts cannot borrow the V12 scoped admission', () => {
  const contract = fixtureContractForFingerprint(
    FIXTURE_CONTRACT_FINGERPRINT_V5,
  );
  const metric = firstSupportedMetric(contract);
  const admission = buildCopyDeliveryMetricServingAdmission();
  assert.throws(
    () => resolveMetricServingAdmission({
      contract_bundle: contract,
      metric_key: metric.metric_key,
      metric_version: metric.metric_version,
      concept_key: metric.concept_key,
      required_claim_definition_key:
        metric.required_claim_definition_key,
      metric_serving_admission_id:
        admission.metric_serving_admission_id,
      declared_metric_serving_admission_ids: [
        admission.metric_serving_admission_id,
      ],
    }),
    /cannot borrow a scoped admission/,
  );
});

test('F22 rejects unknown fields and drifted registry authority', () => {
  assert.throws(
    () => resolveMetricServingAdmission({
      ...scopedInput(),
      wildcard: true,
    }),
    /outside the F22 contract/,
  );
  const registry = clone(buildMetricServingAdmissionRegistry());
  registry.wildcard_admission_authority = 'ALL_METRICS';
  assert.throws(
    () => validateMetricServingAdmissionRegistry(registry),
    /registry has drifted/,
  );
});

test('F22 is pure and leaves the active serving validators byte-identical', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.doesNotMatch(
    source,
    /(?:@supabase|createClient|fetch\(|child_process|execFile|spawnSync)/,
  );
  assert.doesNotMatch(
    source,
    /\b(?:INSERT|UPDATE|DELETE|UPSERT|ALTER|CREATE\s+TABLE|COMMIT)\b/i,
  );
  assert.doesNotMatch(source, /(?:setTimeout|process\.env|setActiveRelease)/);
  Object.entries(ACTIVE_VALIDATOR_SNAPSHOTS).forEach(
    ([sourcePath, expectedDigest]) => {
      const sourceBytes = fs.readFileSync(sourcePath, 'utf8');
      assert.equal(
        contentId('F21_SOURCE_SNAPSHOT/V1', {
          source_path: sourcePath,
          source_bytes: sourceBytes,
        }),
        expectedDigest,
      );
    },
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
