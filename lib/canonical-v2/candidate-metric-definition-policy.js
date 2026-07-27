const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  validateContractBundle,
} = require('./contract-bundle');
const {
  METRIC_DEFINITIONS,
  metricDefinitionId,
} = require('./serving-projection');

const CANDIDATE_DEFINITION_METRIC_KEY =
  'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS';
const ACTIVE_SERVING_FINGERPRINT_SNAPSHOT = Object.freeze([
  '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83',
  '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d',
  '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c',
  'd4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74',
  'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478',
]);

function assertActiveServingPolicyUnchanged() {
  if (canonicalJson([...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort())
    !== canonicalJson(ACTIVE_SERVING_FINGERPRINT_SNAPSHOT)) {
    throw new TypeError(
      'F16 must not change the active serving contract allowlist',
    );
  }
  return true;
}

function buildCandidateMetricDefinitionAdmission({
  contract_bundle: contractBundle,
  metric_key: metricKey,
} = {}) {
  validateContractBundle(contractBundle);
  assertActiveServingPolicyUnchanged();
  const definition = METRIC_DEFINITIONS[metricKey];
  const interpretationAdmission =
    contractBundle.claim_interpretation_policy_definition
      ?.metric_specific_ambiguous_admissions?.find(
        (entry) => entry.metric_key === metricKey
          && entry.metric_version === definition?.metric_version,
      );
  if (metricKey !== CANDIDATE_DEFINITION_METRIC_KEY
    || !definition
    || contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || !contractBundle.concepts.some(
      (entry) => entry.concept_key === definition.concept_key,
    )
    || !contractBundle.claim_definitions.some(
      (entry) => entry.claim_definition_key
        === definition.required_claim_definition_key,
    )
    || !interpretationAdmission
    || interpretationAdmission.admission_semantics
      !== 'SELECTED_PRIMARY_INTERPRETATION_FOR_SEPARATE_RELEASE_KEYED_COHORT_WITH_MANDATORY_LAWYER_WARNING'
    || canonicalJson(interpretationAdmission.accepted_clarity_states)
      !== canonicalJson(definition.accepted_clarity_states)
    || canonicalJson(
      interpretationAdmission.accepted_ambiguity_dimension_codes,
    ) !== canonicalJson(definition.accepted_ambiguity_dimension_codes)
    || canonicalJson(
      interpretationAdmission.accepted_comparability_effect_codes,
    ) !== canonicalJson(definition.accepted_comparability_effect_codes)
    || interpretationAdmission
      .cohort_identity_must_include_interpretation_projection !== true
    || interpretationAdmission.lawyer_warning_required !== true
    || FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      contractBundle.fingerprint,
    )) {
    throw new TypeError(
      'metric is outside the exact F16 candidate-only contract',
    );
  }
  const body = {
    schema_version: 'CANDIDATE_METRIC_DEFINITION_ADMISSION/V1',
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: definition.metric_key,
    metric_version: definition.metric_version,
    metric_definition_id: metricDefinitionId(definition),
    concept_key: definition.concept_key,
    required_claim_definition_key:
      definition.required_claim_definition_key,
    interpretation_policy_version:
      definition.interpretation_policy_version,
    interpretation_admission_digest: contentId(
      'METRIC_SPECIFIC_AMBIGUOUS_ADMISSION/V1',
      interpretationAdmission,
    ),
    metric_definition_authority: 'OFFLINE_GOVERNED_ONLY',
    candidate_projection_authority: 'NONE',
    candidate_release_authority: 'NONE',
    active_serving_authority: 'NONE',
    active_query_authority: 'NONE',
    active_pointer_authority: 'NONE',
  };
  return Object.freeze({
    ...body,
    candidate_metric_definition_admission_id: contentId(
      'CANDIDATE_METRIC_DEFINITION_ADMISSION/V1',
      body,
    ),
  });
}

module.exports = {
  ACTIVE_SERVING_FINGERPRINT_SNAPSHOT,
  CANDIDATE_DEFINITION_METRIC_KEY,
  assertActiveServingPolicyUnchanged,
  buildCandidateMetricDefinitionAdmission,
};
