const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const relationshipContract = require(
  '../../contracts/canonical-v2/successor/process/relationships/process-relationship.v2.json',
);

const RELATIONSHIP_IDENTITY_SCHEMA = 'PROCESS_RELATIONSHIP_IDENTITY/V1';
const RELATIONSHIP_ID_DOMAIN = 'PROCESS_RELATIONSHIP/V1';
const RELATIONSHIP_PAYLOAD_DOMAIN =
  'PROCESS_RELATIONSHIP_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessRelationship';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const RELATIONSHIP_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_RELATIONSHIP',
  definition_version: 1,
});

const ENDPOINT_DEFINITIONS = Object.freeze({
  BidderTrack: 'BIDDER_TRACK',
  ConsiderationPackage: 'CONSIDERATION_PACKAGE',
  ProcessAgreement: 'PROCESS_AGREEMENT',
  ProcessEvent: 'PROCESS_EVENT',
  ProcessNarrationOccurrence: 'PROCESS_NARRATION_OCCURRENCE',
  ProcessParticipant: 'PROCESS_PARTICIPANT',
  ProcessPassage: 'PROCESS_PASSAGE',
  ProcessPhase: 'PROCESS_PHASE',
  ProcessPosition: 'PROCESS_POSITION',
});

const IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'relationship_definition_key_and_version',
  'source_process_object_kind_and_id',
  'target_process_object_kind_and_id',
  'process_relationship_slot_key',
  'governed_ordinal',
]);

const ENDPOINT_KEYS = Object.freeze([
  'logical_type',
  'definition_stable_id',
  'stable_object_id',
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'expected_occurrence_slot_binding_state',
  'endpoint_binding_state',
  'relationship_type_registry_state',
  'authority_limits',
  'process_relationship_id',
  'canonical_payload_digest',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...relationshipContract.definition.relationship_identity.prohibited_inputs,
  'display_label',
  'expected_occurrence_id',
  'precomputed_process_relationship_id',
  'relationship_state',
  'relationship_type_code',
  'slot_binding',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  endpoint_resolution: 'NONE',
  relationship_type: 'NONE',
  relationship_revision: 'NONE',
  occurrence_slot_resolution: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessRelationshipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessRelationshipError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessRelationshipError(code, message, details);
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
  const code = 'INVALID_PROCESS_RELATIONSHIP_CONTRACT_BINDING';
  if (
    relationshipContract.object_kind !== 'PROCESS_LOGICAL_TYPE_INPUT'
    || relationshipContract.stable_id !== 'PROCESS_RELATIONSHIP'
    || relationshipContract.schema_version !== 'PROCESS_LOGICAL_TYPE_INPUT/V1'
    || relationshipContract.definition?.logical_type !== LOGICAL_TYPE
    || relationshipContract.definition?.logical_type_version !== 2
  ) {
    fail(code, 'The ProcessRelationship contract identity is invalid.');
  }
  requireExactValue(
    relationshipContract.definition.relationship_identity.stable_id_inputs,
    IDENTITY_INPUT_KEYS,
    'ProcessRelationship stable ID inputs',
    code,
  );
  requireExactValue(
    relationshipContract.definition.endpoint_contract
      .allowed_endpoint_logical_types,
    Object.keys(ENDPOINT_DEFINITIONS),
    'ProcessRelationship endpoint logical types',
    code,
  );
  requireExactValue(
    relationshipContract.definition.endpoint_contract
      .allowed_endpoint_definition_stable_ids,
    Object.values(ENDPOINT_DEFINITIONS),
    'ProcessRelationship endpoint definitions',
    code,
  );
  const endpointContract = relationshipContract.definition.endpoint_contract;
  const slotContract = relationshipContract.definition.occurrence_slot_contract;
  if (
    endpointContract.stable_object_ids_not_revision_ids_define_relationship_identity
      !== true
    || endpointContract.same_frozen_contract_pair_required !== true
    || endpointContract.same_governed_deal_required !== true
    || endpointContract.source_and_target_must_be_distinct !== true
    || endpointContract.unresolved_endpoint_blocks_materialisation !== true
    || slotContract.slot_key_is_self_authorising !== false
    || slotContract.precomputed_expected_occurrence_id_binding_required !== true
    || slotContract.unresolved_or_missing_slot_blocks_materialisation !== true
  ) {
    fail(code, 'The ProcessRelationship endpoint or slot boundary is weakened.');
  }
}

function rejectProhibitedIdentityInputs(input) {
  requireObject(input, 'ProcessRelationship identity input', 'INVALID_PROCESS_RELATIONSHIP_IDENTITY');
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_RELATIONSHIP_VALUE_DERIVED_IDENTITY',
      'Values, revisions, evidence, relationship types and slot assertions cannot define ProcessRelationship identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function validateEndpointReference(endpoint, label, input) {
  const code = 'INVALID_PROCESS_RELATIONSHIP_ENDPOINT';
  requireExactKeys(endpoint, ENDPOINT_KEYS, label, code);
  if (
    !Object.hasOwn(ENDPOINT_DEFINITIONS, endpoint.logical_type)
    || endpoint.definition_stable_id
      !== ENDPOINT_DEFINITIONS[endpoint.logical_type]
  ) {
    fail(code, `${label} does not use one governed endpoint type.`);
  }
  requireDigest(endpoint.stable_object_id, `${label} stable object ID`, code);
  requireDigest(
    endpoint.frozen_contract_pair_digest,
    `${label} frozen contract pair digest`,
    code,
  );
  requireDigest(
    endpoint.governed_deal_admission_id,
    `${label} governed deal admission ID`,
    code,
  );
  if (
    endpoint.frozen_contract_pair_digest
      !== input.frozen_contract_pair_digest
    || endpoint.governed_deal_admission_id
      !== input.governed_deal_admission_id
  ) {
    fail(
      'PROCESS_RELATIONSHIP_ENDPOINT_SCOPE_MISMATCH',
      `${label} must bind the exact relationship contract pair and admitted deal.`,
    );
  }
}

function relationshipIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    relationship_definition_key_and_version:
      input.relationship_definition_key_and_version,
    source_process_object_kind_and_id:
      input.source_process_object_kind_and_id,
    target_process_object_kind_and_id:
      input.target_process_object_kind_and_id,
    process_relationship_slot_key: input.process_relationship_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateProcessRelationshipIdentityInput(input) {
  const code = 'INVALID_PROCESS_RELATIONSHIP_IDENTITY';
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'ProcessRelationship identity input',
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
  requireExactValue(
    input.relationship_definition_key_and_version,
    RELATIONSHIP_DEFINITION,
    'ProcessRelationship definition key and version',
    code,
  );
  requireGovernedKey(
    input.process_relationship_slot_key,
    'ProcessRelationship slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(code, 'The governed ProcessRelationship ordinal must be a non-negative safe integer.');
  }
  validateEndpointReference(
    input.source_process_object_kind_and_id,
    'ProcessRelationship source endpoint',
    input,
  );
  validateEndpointReference(
    input.target_process_object_kind_and_id,
    'ProcessRelationship target endpoint',
    input,
  );
  if (
    input.source_process_object_kind_and_id.logical_type
      === input.target_process_object_kind_and_id.logical_type
    && input.source_process_object_kind_and_id.stable_object_id
      === input.target_process_object_kind_and_id.stable_object_id
  ) {
    fail(
      'PROCESS_RELATIONSHIP_SELF_ENDPOINT',
      'A ProcessRelationship source and target must be distinct stable objects.',
    );
  }
  return input;
}

function buildProcessRelationshipIdentity(input) {
  validateProcessRelationshipIdentityInput(input);
  const identity = cloneCanonical(
    relationshipIdentity(input),
    'ProcessRelationship identity',
    'INVALID_PROCESS_RELATIONSHIP_IDENTITY',
  );
  const body = {
    schema_version: RELATIONSHIP_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    expected_occurrence_slot_binding_state: 'UNRESOLVED',
    endpoint_binding_state: 'UNRESOLVED',
    relationship_type_registry_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'ProcessRelationship authority limits',
      'INVALID_PROCESS_RELATIONSHIP_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_relationship_id: contentId(
      RELATIONSHIP_ID_DOMAIN,
      relationshipIdentity(body),
    ),
    canonical_payload_digest: contentId(
      RELATIONSHIP_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessRelationshipIdentity(value) {
  const code = 'INVALID_PROCESS_RELATIONSHIP_IDENTITY';
  requireExactKeys(
    value,
    IDENTITY_KEYS,
    'ProcessRelationship identity',
    code,
  );
  if (
    value.schema_version !== RELATIONSHIP_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_occurrence_slot_binding_state !== 'UNRESOLVED'
    || value.endpoint_binding_state !== 'UNRESOLVED'
    || value.relationship_type_registry_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The ProcessRelationship identity type or boundary state is invalid.');
  }
  validateProcessRelationshipIdentityInput(relationshipIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'ProcessRelationship authority limits',
    code,
  );
  const expectedId = contentId(
    RELATIONSHIP_ID_DOMAIN,
    relationshipIdentity(value),
  );
  if (value.process_relationship_id !== expectedId) {
    fail(
      'PROCESS_RELATIONSHIP_ID_MISMATCH',
      'The ProcessRelationship ID does not bind the exact frozen identity.',
    );
  }
  const body = { ...value };
  delete body.process_relationship_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    RELATIONSHIP_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_RELATIONSHIP_PAYLOAD_MISMATCH',
      'The ProcessRelationship identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  ENDPOINT_DEFINITIONS,
  ProcessRelationshipError,
  buildProcessRelationshipIdentity,
  validateProcessRelationshipIdentity,
};
