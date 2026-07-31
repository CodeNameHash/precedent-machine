const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINTS,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  compileFixtureContractV12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
  buildCandidateMetricDefinitionAdmission,
} = require('./candidate-metric-definition-policy');
const {
  METRIC_DEFINITIONS,
  metricDefinitionId,
} = require('./serving-projection');
const {
  REJECTED_SERVING_CONTRACT_FINGERPRINTS,
  isRejectedServingContractFingerprint,
} = require('./serving-contract-policy');

const SHA256_RE = /^[a-f0-9]{64}$/;
const AUTHORITY_SCOPE =
  'OFFLINE_METRIC_SCOPED_SERVING_ADMISSION_F22_ONLY';
const F19_ID =
  '362d2a28419eb77a321267a733ba84ab6d61e44afc42a45a8d13a4ce3586afa1';
const F20_ID =
  'c9045081e5950fbb2d9785ae8c8f40e30f4251b34135ce9e14d8e04c3ed1bc00';
const F21_ID =
  'bdc62dc415b92024c5e6604c46f12041974c9ec63798d9d61206054ff35ccdca';
const F21_DIGEST =
  '0d0bcbcc14ed9dafeebd1952ef30f3d0253f3a6a82d20beb4a0799745e6f2456';
const COPY_DELIVERY_METRIC_KEY =
  'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS';
const LEGACY_SERVING_FINGERPRINTS = Object.freeze([
  ...FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
].sort());

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields are outside the F22 contract`);
  }
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new TypeError(`${label} must be a sha256 digest`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be non-empty text`);
  }
  return value;
}

function validateDeclaredAdmissionIds(values) {
  if (!Array.isArray(values) || values.length > 256) {
    throw new TypeError(
      'declared_metric_serving_admission_ids must be a bounded array',
    );
  }
  values.forEach((value) => requireDigest(
    value,
    'declared_metric_serving_admission_id',
  ));
  const sorted = [...values].sort();
  if (new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson(sorted)) {
    throw new TypeError(
      'declared metric serving admissions must be unique and sorted',
    );
  }
  return values;
}

function buildCopyDeliveryMetricServingAdmission() {
  const contract = compileFixtureContractV12();
  const metric = METRIC_DEFINITIONS[COPY_DELIVERY_METRIC_KEY];
  const candidate = buildCandidateMetricDefinitionAdmission({
    contract_bundle: contract,
    metric_key: COPY_DELIVERY_METRIC_KEY,
  });
  const interpretationAdmission =
    contract.claim_interpretation_policy_definition
      ?.metric_specific_ambiguous_admissions?.find(
        (entry) => entry.metric_key === metric.metric_key
          && entry.metric_version === metric.metric_version,
      );
  const interpretationDigest = contentId(
    'METRIC_SPECIFIC_AMBIGUOUS_ADMISSION/V1',
    interpretationAdmission,
  );
  if (contract.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || metricDefinitionId(metric)
      !== candidate.metric_definition_id
    || metric.concept_key !== candidate.concept_key
    || metric.required_claim_definition_key
      !== candidate.required_claim_definition_key
    || interpretationDigest
      !== candidate.interpretation_admission_digest
    || QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID
      !== '03bdc0671b85755d517a994fb903960beae5969c2bbb5443e1be3fe288524714') {
    throw new TypeError(
      'F22 copy-delivery certification inputs have drifted',
    );
  }
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION/V1',
    authority_scope: AUTHORITY_SCOPE,
    certification_state:
      'CERTIFIED_POLICY_ELIGIBLE_NOT_RELEASED',
    contract_fingerprint: contract.fingerprint,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    metric_definition_id: metricDefinitionId(metric),
    concept_key: metric.concept_key,
    required_claim_definition_key:
      metric.required_claim_definition_key,
    interpretation_admission_digest: interpretationDigest,
    candidate_metric_definition_admission_id:
      candidate.candidate_metric_definition_admission_id,
    integration_admission_id:
      QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
    certification_evidence: {
      qxo_no_shop_copy_delivery_canonical_f19_id: F19_ID,
      qxo_no_shop_copy_delivery_query_f20_id: F20_ID,
      v12_serving_admission_readiness_f21_id: F21_ID,
      f21_canonical_payload_digest: F21_DIGEST,
    },
    authority: {
      metric_serving_policy_authority:
        'EXACT_METRIC_IDENTITY_ONLY',
      candidate_release_authority: 'NONE',
      active_release_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'METRIC_ADMISSION_NOT_BOUND_TO_RELEASE_MANIFEST',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return deepFreeze({
    ...body,
    metric_serving_admission_id: contentId(
      'METRIC_SERVING_ADMISSION/V1',
      body,
    ),
  });
}

function validateMetricServingAdmission(candidate) {
  requireExactKeys(candidate, [
    'schema_version',
    'authority_scope',
    'certification_state',
    'contract_fingerprint',
    'metric_key',
    'metric_version',
    'metric_definition_id',
    'concept_key',
    'required_claim_definition_key',
    'interpretation_admission_digest',
    'candidate_metric_definition_admission_id',
    'integration_admission_id',
    'certification_evidence',
    'authority',
    'status',
    'metric_serving_admission_id',
  ], 'MetricServingAdmission');
  const expected = buildCopyDeliveryMetricServingAdmission();
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError(
      'metric serving admission is outside the exact F22 registry',
    );
  }
  return true;
}

function buildMetricServingAdmissionRegistry() {
  const admission = buildCopyDeliveryMetricServingAdmission();
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION_REGISTRY/V1',
    authority_scope: AUTHORITY_SCOPE,
    legacy_fingerprint_wide_contracts:
      LEGACY_SERVING_FINGERPRINTS,
    legacy_rejected_contracts:
      REJECTED_SERVING_CONTRACT_FINGERPRINTS,
    later_contract_default: 'DENY',
    admission_records: [admission],
    wildcard_admission_authority: 'NONE',
    release_manifest_binding_required: true,
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  return deepFreeze({
    ...body,
    metric_serving_admission_registry_id: contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V1',
      body,
    ),
  });
}

function validateMetricServingAdmissionRegistry(candidate) {
  requireExactKeys(candidate, [
    'schema_version',
    'authority_scope',
    'legacy_fingerprint_wide_contracts',
    'legacy_rejected_contracts',
    'later_contract_default',
    'admission_records',
    'wildcard_admission_authority',
    'release_manifest_binding_required',
    'active_release_authority',
    'production_activation_authority',
    'metric_serving_admission_registry_id',
  ], 'MetricServingAdmissionRegistry');
  const expected = buildMetricServingAdmissionRegistry();
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError(
      'metric serving admission registry has drifted',
    );
  }
  return true;
}

function metricIdentity({
  contractBundle,
  metricKey,
  metricVersion,
  conceptKey,
  claimDefinitionKey,
}) {
  validateContractBundle(contractBundle);
  const metric = METRIC_DEFINITIONS[metricKey];
  if (!metric
    || metric.metric_version !== metricVersion
    || metric.concept_key !== conceptKey
    || metric.required_claim_definition_key
      !== claimDefinitionKey
    || !contractBundle.concepts.some(
      (entry) => entry.concept_key === conceptKey,
    )
    || !contractBundle.claim_definitions.some(
      (entry) => entry.claim_definition_key
        === claimDefinitionKey,
    )) {
    throw new TypeError(
      'metric identity is outside the supplied frozen contract',
    );
  }
  return {
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    metric_definition_id: metricDefinitionId(metric),
    concept_key: metric.concept_key,
    required_claim_definition_key:
      metric.required_claim_definition_key,
  };
}

function resolveMetricServingAdmission(input) {
  requireExactKeys(input, [
    'contract_bundle',
    'metric_key',
    'metric_version',
    'concept_key',
    'required_claim_definition_key',
    'metric_serving_admission_id',
    'declared_metric_serving_admission_ids',
  ], 'metric serving selection');
  const identity = metricIdentity({
    contractBundle: input.contract_bundle,
    metricKey: requireText(input.metric_key, 'metric_key'),
    metricVersion: input.metric_version,
    conceptKey: requireText(input.concept_key, 'concept_key'),
    claimDefinitionKey: requireText(
      input.required_claim_definition_key,
      'required_claim_definition_key',
    ),
  });
  const declaredAdmissionIds = validateDeclaredAdmissionIds(
    input.declared_metric_serving_admission_ids,
  );
  const registry = buildMetricServingAdmissionRegistry();
  const isLegacy = LEGACY_SERVING_FINGERPRINTS.includes(
    identity.contract_fingerprint,
  );

  if (isLegacy) {
    if (isRejectedServingContractFingerprint(
      identity.contract_fingerprint,
    )) {
      throw new TypeError(
        'the rejected legacy contract cannot be used for serving',
      );
    }
    if (input.metric_serving_admission_id !== null) {
      throw new TypeError(
        'legacy serving contracts cannot borrow a scoped admission',
      );
    }
    return deepFreeze({
      schema_version: 'METRIC_SERVING_ADMISSION_RESOLUTION/V1',
      admission_lane: 'LEGACY_FINGERPRINT_WIDE',
      ...identity,
      metric_serving_admission_id: null,
      metric_serving_admission_registry_id:
        registry.metric_serving_admission_registry_id,
      declared_admission_membership:
        'NOT_REQUIRED_FOR_LEGACY_LANE',
      release_manifest_validation:
        'NOT_APPLICABLE_LEGACY_LANE',
      policy_eligibility: 'PASSED',
      active_release_authority: 'NONE',
      production_activation_authority: 'NONE',
    });
  }

  if (!FIXTURE_CONTRACT_FINGERPRINTS.includes(
    identity.contract_fingerprint,
  )) {
    throw new TypeError('contract fingerprint is not frozen');
  }
  const admissionId = requireDigest(
    input.metric_serving_admission_id,
    'metric_serving_admission_id',
  );
  const admission = registry.admission_records.find(
    (entry) => entry.metric_serving_admission_id
      === admissionId,
  );
  if (!admission) {
    throw new TypeError(
      'later contracts require an exact metric-scoped admission',
    );
  }
  if (!declaredAdmissionIds.includes(admissionId)) {
    throw new TypeError(
      'metric admission is absent from the declared ID set',
    );
  }
  validateMetricServingAdmission(admission);
  const expectedIdentity = {
    contract_fingerprint: admission.contract_fingerprint,
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_definition_id: admission.metric_definition_id,
    concept_key: admission.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
  };
  if (canonicalJson(identity) !== canonicalJson(expectedIdentity)) {
    throw new TypeError(
      'metric identity does not match the scoped admission',
    );
  }
  return deepFreeze({
    schema_version: 'METRIC_SERVING_ADMISSION_RESOLUTION/V1',
    admission_lane: 'METRIC_SCOPED',
    ...identity,
    interpretation_admission_digest:
      admission.interpretation_admission_digest,
    candidate_metric_definition_admission_id:
      admission.candidate_metric_definition_admission_id,
    integration_admission_id:
      admission.integration_admission_id,
    metric_serving_admission_id: admissionId,
    metric_serving_admission_registry_id:
      registry.metric_serving_admission_registry_id,
    declared_admission_membership: 'PASSED',
    release_manifest_validation:
      'NOT_PERFORMED_F23_REQUIRED',
    policy_eligibility:
      'PRELIMINARY_POLICY_MATCH_NOT_RELEASED',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
}

module.exports = {
  AUTHORITY_SCOPE,
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
};
