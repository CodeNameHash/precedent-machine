const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const agreementContract = require(
  '../../contracts/canonical-v2/successor/process/agreements/process-agreement.v1.json',
);

const AGREEMENT_IDENTITY_SCHEMA = 'PROCESS_AGREEMENT_IDENTITY/V1';
const AGREEMENT_ID_DOMAIN = 'PROCESS_AGREEMENT/V1';
const AGREEMENT_PAYLOAD_DOMAIN = 'PROCESS_AGREEMENT_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessAgreement';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'process_agreement_slot_key',
  'governed_ordinal',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'expected_occurrence_slot_binding_state',
  'agreement_type_registry_state',
  'document_stage_registry_state',
  'party_relationship_state',
  'version_relationship_state',
  'passage_binding_state',
  'temporal_binding_state',
  'authority_limits',
  'process_agreement_id',
  'canonical_payload_digest',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...agreementContract.definition.agreement_identity.prohibited_inputs,
  'agreement_state',
  'candidate_values',
  'evidence_edges',
  'expected_occurrence_id',
  'failure_detail',
  'precomputed_process_agreement_id',
  'process_relationship_revision_ids',
  'slot_binding',
  'version_number',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  expected_occurrence_slot_binding: 'NONE',
  agreement_type_registry: 'NONE',
  document_stage_registry: 'NONE',
  party_relationship: 'NONE',
  version_relationship: 'NONE',
  passage_binding: 'NONE',
  temporal_binding: 'NONE',
  agreement_revision: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessAgreementIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessAgreementIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessAgreementIdentityError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      expected: required,
      actual,
    });
  }
}

function requireExactValue(actual, expected, label, code) {
  let equal = false;
  try {
    equal = canonicalJson(actual) === canonicalJson(expected);
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
  if (!equal) {
    fail(code, `${label} is not the approved value.`, {
      expected,
      actual,
    });
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function requireGovernedKey(value, label, code) {
  if (
    typeof value !== 'string'
    || !GOVERNED_KEY_RE.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed upper-case key.`);
  }
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validateContractBinding() {
  const code = 'INVALID_PROCESS_AGREEMENT_CONTRACT_BINDING';
  const definition = agreementContract.definition;
  if (
    agreementContract.object_kind !== 'PROCESS_LOGICAL_TYPE_INPUT'
    || agreementContract.stable_id !== 'PROCESS_AGREEMENT'
    || agreementContract.schema_version !== 'PROCESS_LOGICAL_TYPE_INPUT/V1'
    || definition?.logical_type !== LOGICAL_TYPE
    || definition?.logical_type_version !== 1
  ) {
    fail(code, 'The ProcessAgreement contract identity is invalid.');
  }
  requireExactValue(
    definition.agreement_identity.stable_id_inputs,
    IDENTITY_INPUT_KEYS,
    'ProcessAgreement stable ID inputs',
    code,
  );
  requireExactValue(
    definition.agreement_type_contract.minimum_governed_types,
    [
      'CONFIDENTIALITY',
      'EXCLUSIVITY',
      'OTHER_PROCESS_AGREEMENT',
      'STANDSTILL',
    ],
    'ProcessAgreement minimum governed types',
    code,
  );
  const slot = definition.occurrence_slot_contract;
  const type = definition.agreement_type_contract;
  const stage = definition.document_stage_contract;
  const party = definition.party_contract;
  const version = definition.version_contract;
  const temporal = definition.temporal_contract;
  if (
    slot.slot_key_field !== 'process_agreement_slot_key'
    || slot.slot_frozen_before_candidate_values !== true
    || slot.slot_key_is_self_authorising !== false
    || slot.precomputed_expected_occurrence_id_binding_required !== true
    || slot.unresolved_or_missing_slot_blocks_materialisation !== true
    || slot.identity_only_kernel_grants_materialisation_authority !== false
    || type.agreement_type_is_revision_value_not_identity !== true
    || type.agreement_type_registry_required_before_materialisation !== true
    || type.unknown_agreement_type_has_runtime_path !== false
    || type.free_text_label_can_create_type !== false
    || stage.document_stage_is_revision_value_not_identity !== true
    || stage.document_stage_registry_required_before_materialisation !== true
    || stage.unknown_document_stage_has_runtime_path !== false
    || stage.free_text_label_can_create_stage !== false
    || party.same_frozen_contract_pair_required !== true
    || party.same_governed_deal_required !== true
    || party.party_names_cannot_create_relationships !== true
    || version.silent_revision_overwrite_permitted !== false
    || version.retelling_implies_version_identity !== false
    || version.exact_drafting_retained_through_process_passages !== true
    || temporal.exact_stated_formulation_retained !== true
    || temporal.computed_value_replaces_source_formulation !== false
  ) {
    fail(code, 'The ProcessAgreement identity or revision boundary is weakened.');
  }
  const authority = definition.authority_contract;
  if (
    authority.creates_runtime_agreement !== false
    || authority.creates_writer_authority !== false
    || authority.creates_serving_authority !== false
    || authority.creates_release_authority !== false
    || authority.creates_contract_freeze_authority !== false
  ) {
    fail(code, 'The ProcessAgreement definition grants prohibited authority.');
  }
}

function rejectProhibitedIdentityInputs(input) {
  requireObject(
    input,
    'ProcessAgreement identity input',
    'INVALID_PROCESS_AGREEMENT_IDENTITY',
  );
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_AGREEMENT_VALUE_DERIVED_IDENTITY',
      'Types, stages, parties, versions, passages, timing and model output cannot define ProcessAgreement identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function agreementIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    process_agreement_slot_key: input.process_agreement_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateProcessAgreementIdentityInput(input) {
  const code = 'INVALID_PROCESS_AGREEMENT_IDENTITY';
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'ProcessAgreement identity input',
    code,
  );
  validateContractBinding();
  requireDigest(
    input.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  requireDigest(
    input.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  requireGovernedKey(
    input.process_agreement_slot_key,
    'ProcessAgreement slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(
      code,
      'The governed ProcessAgreement ordinal must be a non-negative safe integer.',
    );
  }
  return input;
}

function buildProcessAgreementIdentity(input) {
  validateProcessAgreementIdentityInput(input);
  const identity = cloneCanonical(
    agreementIdentity(input),
    'ProcessAgreement identity',
    'INVALID_PROCESS_AGREEMENT_IDENTITY',
  );
  const body = {
    schema_version: AGREEMENT_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    expected_occurrence_slot_binding_state: 'UNRESOLVED',
    agreement_type_registry_state: 'UNRESOLVED',
    document_stage_registry_state: 'UNRESOLVED',
    party_relationship_state: 'UNRESOLVED',
    version_relationship_state: 'UNRESOLVED',
    passage_binding_state: 'UNRESOLVED',
    temporal_binding_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'ProcessAgreement authority limits',
      'INVALID_PROCESS_AGREEMENT_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_agreement_id: contentId(
      AGREEMENT_ID_DOMAIN,
      agreementIdentity(body),
    ),
    canonical_payload_digest: contentId(
      AGREEMENT_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessAgreementIdentity(value) {
  const code = 'INVALID_PROCESS_AGREEMENT_IDENTITY';
  requireExactKeys(
    value,
    IDENTITY_KEYS,
    'ProcessAgreement identity',
    code,
  );
  if (
    value.schema_version !== AGREEMENT_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_occurrence_slot_binding_state !== 'UNRESOLVED'
    || value.agreement_type_registry_state !== 'UNRESOLVED'
    || value.document_stage_registry_state !== 'UNRESOLVED'
    || value.party_relationship_state !== 'UNRESOLVED'
    || value.version_relationship_state !== 'UNRESOLVED'
    || value.passage_binding_state !== 'UNRESOLVED'
    || value.temporal_binding_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The ProcessAgreement identity type or boundary state is invalid.');
  }
  validateProcessAgreementIdentityInput(agreementIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'ProcessAgreement authority limits',
    code,
  );
  const expectedId = contentId(
    AGREEMENT_ID_DOMAIN,
    agreementIdentity(value),
  );
  if (value.process_agreement_id !== expectedId) {
    fail(
      'PROCESS_AGREEMENT_ID_MISMATCH',
      'The ProcessAgreement ID does not bind the exact frozen identity.',
    );
  }
  const body = { ...value };
  delete body.process_agreement_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    AGREEMENT_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_AGREEMENT_PAYLOAD_MISMATCH',
      'The ProcessAgreement identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  ProcessAgreementIdentityError,
  buildProcessAgreementIdentity,
  validateProcessAgreementIdentity,
};
