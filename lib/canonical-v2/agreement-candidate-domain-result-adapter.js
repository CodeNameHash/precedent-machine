const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateAgreementCandidateEnvelope,
} = require('./agreement-candidate-envelope');
const {
  PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
  validatePilotProductAuthorityContext,
} = require('./pilot-product-authority-context');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
} = require('./product-citation-share-compiler');

const AGREEMENT_CANDIDATE_DOMAIN_RESULT_ADAPTER_SCHEMA =
  'AGREEMENT_CANDIDATE_DOMAIN_RESULT_ADAPTER/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const PROFILE_ADMISSIONS = Object.freeze({
  CAPITALISATION_BRING_DOWN_V3: Object.freeze({
    predicate_key: 'TARGET_CAPITALISATION_BRING_DOWN',
    predicate_version: 1,
    result_definition: Object.freeze({
      stable_id: 'TARGET_CAPITALISATION_BRING_DOWN',
      version: 3,
    }),
    exact_detail_action: 'RESULT_COMPOSITION_EVIDENCE',
  }),
  IOC_CAPEX_RESTRICTION_V1: Object.freeze({
    predicate_key: 'TARGET_CAPEX_RESTRICTION',
    predicate_version: 1,
    result_definition: Object.freeze({
      stable_id: 'TARGET_CAPEX_RESTRICTION',
      version: 1,
    }),
    exact_detail_action: 'RESULT_COMPOSITION_EVIDENCE',
  }),
});

class AgreementCandidateDomainResultAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgreementCandidateDomainResultAdapterError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new AgreementCandidateDomainResultAdapterError(code, message, details);
}

function clone(value, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Agreement domain-result input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function exactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())) {
    fail(code, `${label} fields do not match the closed contract.`);
  }
}

function requireDigest(value, label, code) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a SHA-256 digest.`);
  }
}

function profileFor(envelope) {
  const profile = PROFILE_ADMISSIONS[envelope?.family_profile_id];
  if (!profile) {
    fail('UNKNOWN_AGREEMENT_DOMAIN_RESULT_PROFILE',
      'The Agreement candidate profile is not admitted for a Product domain result.');
  }
  return profile;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function patternAdmission(context, profile) {
  const patterns = context.product_navigation_catalogue_manifest
    ?.navigation_definition?.domains
    ?.filter((domain) => domain.domain_key === 'AGREEMENT')
    .flatMap((domain) => domain.topics || [])
    .flatMap((topic) => topic.patterns || [])
    .filter((pattern) => (
      pattern.predicate_key === profile.predicate_key
      && pattern.predicate_version === profile.predicate_version
      && pattern.pattern_key === profile.result_definition.stable_id
    )) || [];
  if (patterns.length !== 1) {
    fail('MISSING_AGREEMENT_PROFILE_NAVIGATION_ADMISSION',
      'The exact Agreement profile is not admitted to Product navigation.');
  }
}

function authorityAdmission(context, profile) {
  const admissions = context.predicate_admissions?.filter((admission) => (
    admission.domain_key === 'AGREEMENT'
    && admission.predicate_key === profile.predicate_key
    && admission.predicate_version === profile.predicate_version
    && same(admission.result_definitions, [profile.result_definition])
  )) || [];
  if (admissions.length !== 1
    || !context.product_query_admission_context?.exact_detail_actions
      ?.includes(profile.exact_detail_action)
    || !context.product_query_admission_context?.predicate_admissions
      ?.some((admission) => admission.admission_id === admissions[0].admission_id)) {
    fail('MISSING_AGREEMENT_PROFILE_PRODUCT_ADMISSION',
      'The exact Agreement profile has no Product predicate, result and detail-action admission.');
  }
  return admissions[0];
}

function validateEnvelope(value, input) {
  const code = 'INVALID_AGREEMENT_CANDIDATE_ENVELOPE';
  try {
    validateAgreementCandidateEnvelope(value, input);
  } catch (error) {
    fail(code, 'The Agreement candidate envelope does not match its validated source input.', {
      cause: error.code || error.message,
    });
  }
  exactKeys(value.product_membership, [
    'domain_key',
    'domain_result_identity',
    'domain_result_payload_digest',
    'membership_state',
    'result_definition_stable_id',
    'result_definition_version',
  ], 'Agreement candidate membership', code);
  if (
    value.schema_version !== 'AGREEMENT_CANDIDATE_ENVELOPE/V1'
    || value.candidate_state !== 'VALIDATED_NOT_MATERIALISED'
    || value.authority_state !== 'NONE'
    || value.product_membership.domain_key !== 'AGREEMENT'
    || value.product_membership.membership_state !== 'CANDIDATE_ENVELOPE_ONLY'
  ) {
    fail(code, 'The Agreement candidate envelope is not an inactive validated carrier.');
  }
  requireDigest(value.agreement_candidate_envelope_id,
    'Agreement candidate envelope ID', code);
  requireDigest(value.product_membership.domain_result_identity,
    'Agreement candidate result identity', code);
  requireDigest(value.product_membership.domain_result_payload_digest,
    'Agreement candidate result payload digest', code);
}

function validateAuthorityContext(value, input) {
  const code = 'INVALID_PILOT_PRODUCT_AUTHORITY_CONTEXT';
  try {
    validatePilotProductAuthorityContext(value, input);
  } catch (error) {
    fail(code, 'The Product authority context does not match its exact verified inputs.', {
      cause: error.code || error.message,
    });
  }
  if (
    value.schema_version !== PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA
    || Object.values(value.authority_limits || {}).some((state) => state !== 'NONE')
  ) {
    fail(code, 'The Product authority context grants an unsupported authority.');
  }
}

function buildAgreementCandidateDomainResult(input = {}) {
  const code = 'INVALID_AGREEMENT_DOMAIN_RESULT_ADAPTER_INPUT';
  exactKeys(input, [
    'agreement_candidate_envelope',
    'agreement_candidate_envelope_input',
    'pilot_product_authority_context',
    'pilot_product_authority_context_input',
  ], 'Agreement domain-result adapter input', code);
  const {
    agreement_candidate_envelope,
    agreement_candidate_envelope_input,
    pilot_product_authority_context,
    pilot_product_authority_context_input,
  } = input;
  validateEnvelope(
    agreement_candidate_envelope,
    agreement_candidate_envelope_input,
  );
  validateAuthorityContext(
    pilot_product_authority_context,
    pilot_product_authority_context_input,
  );
  const profile = profileFor(agreement_candidate_envelope);
  if (
    agreement_candidate_envelope.product_membership.result_definition_stable_id
      !== profile.result_definition.stable_id
    || agreement_candidate_envelope.product_membership.result_definition_version
      !== profile.result_definition.version
  ) {
    fail('AGREEMENT_PROFILE_RESULT_DEFINITION_DRIFT',
      'The Agreement envelope result definition does not match its admitted profile.');
  }
  patternAdmission(pilot_product_authority_context, profile);
  const predicateAdmission = authorityAdmission(
    pilot_product_authority_context,
    profile,
  );
  const payload = clone(agreement_candidate_envelope.provision_row, code);
  const payloadDigest = digest(payload);
  if (
    agreement_candidate_envelope.product_membership.domain_result_identity
      !== agreement_candidate_envelope.provision_row.provision_row_id
    && agreement_candidate_envelope.product_membership.domain_result_identity
      !== agreement_candidate_envelope.provision_row.row_serving_key
  ) {
    fail('AGREEMENT_PROVISION_ROW_IDENTITY_DRIFT',
      'The Agreement profile does not bind the provision-row identity.');
  }
  if (
    agreement_candidate_envelope.product_membership.domain_result_payload_digest
      !== payloadDigest
  ) {
    fail('AGREEMENT_PROVISION_ROW_PAYLOAD_DRIFT',
      'The Agreement profile does not bind the exact provision-row payload.');
  }
  const validationBody = {
    validator_stable_id: 'AGREEMENT_CANDIDATE_DOMAIN_RESULT_ADAPTER',
    validator_version: 1,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  const body = {
    adapter_schema_version: AGREEMENT_CANDIDATE_DOMAIN_RESULT_ADAPTER_SCHEMA,
    agreement_candidate_envelope_id:
      agreement_candidate_envelope.agreement_candidate_envelope_id,
    authority_context_id: pilot_product_authority_context.authority_context_id,
    profile_id: agreement_candidate_envelope.family_profile_id,
    predicate_admission_id: predicateAdmission.admission_id,
    domain_key: 'AGREEMENT',
    domain_result_definition: clone(profile.result_definition),
    domain_result_identity:
      agreement_candidate_envelope.product_membership.domain_result_identity,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigest,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
      ...validationBody,
    },
    domain_result_source_representation_kind: 'STRUCTURED_RESULT',
  };
  return deepFreeze(clone({
    domain_key: body.domain_key,
    domain_result_definition: body.domain_result_definition,
    domain_result_identity: body.domain_result_identity,
    domain_result_payload: body.domain_result_payload,
    domain_result_payload_digest: body.domain_result_payload_digest,
    domain_result_validation: body.domain_result_validation,
    domain_result_source_representation_kind:
      body.domain_result_source_representation_kind,
  }, code));
}

module.exports = {
  AGREEMENT_CANDIDATE_DOMAIN_RESULT_ADAPTER_SCHEMA,
  AgreementCandidateDomainResultAdapterError,
  buildAgreementCandidateDomainResult,
};
