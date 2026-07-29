const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const resultContract = require(
  '../../contracts/canonical-v2/successor/process/results/process-exclusivity-event-result.v1.json',
);

const RESULT_IDENTITY_SCHEMA =
  'PROCESS_EXCLUSIVITY_EVENT_RESULT_IDENTITY/V1';
const RESULT_ID_DOMAIN = 'PROCESS_EXCLUSIVITY_EVENT_RESULT/V1';
const RESULT_PAYLOAD_DOMAIN =
  'PROCESS_EXCLUSIVITY_EVENT_RESULT_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessExclusivityEventResult';
const CONTRACT_DEFINITION_DIGEST =
  'ae0d567ab67be4ae5064f984b6be3e81175db79136da56be70033fa51cc05b6a';
const SHA256_RE = /^[a-f0-9]{64}$/;

const RESULT_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  definition_version: 1,
});

const IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'precomputed_process_event_id',
  'result_definition_key_and_version',
  'governed_ordinal',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'expected_result_slot_binding_state',
  'process_event_revision_state',
  'predicate_witnesses_state',
  'actual_drafting_state',
  'result_input_lineage_state',
  'history_projection_state',
  'phrasebook_link_state',
  'exact_detail_state',
  'release_membership_state',
  'authority_limits',
  'process_exclusivity_event_result_id',
  'canonical_payload_digest',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...resultContract.definition.occurrence_identity.prohibited_inputs,
  'actual_drafting_revision_ids',
  'bidder_track_id',
  'candidate_membership',
  'component_revision_ids',
  'coverage',
  'event_revision_id',
  'exact_detail',
  'history_projection',
  'lineage',
  'phrasebook_result_id',
  'predicate_witness_revision_ids',
  'release_identity',
  'result_input_lineage',
  'runtime_result',
  'source_evidence',
  'summary',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  expected_result_slot_binding: 'NONE',
  process_event_revision_binding: 'NONE',
  predicate_witness_binding: 'NONE',
  actual_drafting_binding: 'NONE',
  result_input_lineage: 'NONE',
  history_projection: 'NONE',
  phrasebook_link: 'NONE',
  exact_detail: 'NONE',
  release_membership: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessExclusivityResultIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessExclusivityResultIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessExclusivityResultIdentityError(code, message, details);
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
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
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

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
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
  const code = 'INVALID_PROCESS_EXCLUSIVITY_RESULT_CONTRACT_BINDING';
  requireExactKeys(
    resultContract,
    ['object_kind', 'stable_id', 'schema_version', 'definition'],
    'ProcessExclusivityEventResult contract',
    code,
  );
  if (
    resultContract.object_kind !== 'SERVING_PROCESS_CONTRACT_INPUT'
    || resultContract.stable_id !== 'PROCESS_EXCLUSIVITY_EVENT_RESULT'
    || resultContract.schema_version !== 'SERVING_PROCESS_CONTRACT_INPUT/V1'
    || resultContract.definition?.domain_key !== 'PROCESS'
    || resultContract.definition?.contract_type !== 'RESULT_DEFINITION'
    || resultContract.definition?.contract_version !== 1
  ) {
    fail(code, 'The ProcessExclusivityEventResult contract identity is invalid.');
  }
  requireExactValue(
    resultContract.definition.occurrence_identity,
    {
      stable_id_domain: RESULT_ID_DOMAIN,
      stable_id_inputs: IDENTITY_INPUT_KEYS,
      prohibited_inputs: [
        'application_join_order',
        'candidate_values',
        'display_text',
        'model_output',
        'query_text',
        'selected_revision_id',
      ],
      expected_result_slot_required_before_materialisation: true,
    },
    'ProcessExclusivityEventResult occurrence identity',
    code,
  );
  let digest;
  try {
    digest = sha256Hex(Buffer.from(
      canonicalJson(resultContract.definition),
      'utf8',
    ));
  } catch (error) {
    fail(code, 'The result definition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (digest !== CONTRACT_DEFINITION_DIGEST) {
    fail(
      code,
      'The ProcessExclusivityEventResult governed definition has changed.',
      {
        expected_definition_digest: CONTRACT_DEFINITION_DIGEST,
        actual_definition_digest: digest,
      },
    );
  }
}

function rejectProhibitedIdentityInputs(input) {
  requireObject(
    input,
    'ProcessExclusivityEventResult identity input',
    'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY',
  );
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_EXCLUSIVITY_RESULT_VALUE_DERIVED_IDENTITY',
      'Values, components, lineage, projections, release data and model output cannot define result identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function resultIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    precomputed_process_event_id: input.precomputed_process_event_id,
    result_definition_key_and_version:
      input.result_definition_key_and_version,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateProcessExclusivityResultIdentityInput(input) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY';
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'ProcessExclusivityEventResult identity input',
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
  requireDigest(
    input.precomputed_process_event_id,
    'Precomputed ProcessEvent ID',
    code,
  );
  requireExactValue(
    input.result_definition_key_and_version,
    RESULT_DEFINITION,
    'ProcessExclusivityEventResult definition key and version',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(
      code,
      'The governed result ordinal must be a non-negative safe integer.',
    );
  }
  return input;
}

function buildProcessExclusivityResultIdentity(input) {
  validateProcessExclusivityResultIdentityInput(input);
  const identity = cloneCanonical(
    resultIdentity(input),
    'ProcessExclusivityEventResult identity',
    'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY',
  );
  const body = {
    schema_version: RESULT_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    expected_result_slot_binding_state: 'UNRESOLVED',
    process_event_revision_state: 'UNRESOLVED',
    predicate_witnesses_state: 'UNRESOLVED',
    actual_drafting_state: 'UNRESOLVED',
    result_input_lineage_state: 'UNRESOLVED',
    history_projection_state: 'UNRESOLVED',
    phrasebook_link_state: 'UNRESOLVED',
    exact_detail_state: 'UNRESOLVED',
    release_membership_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'ProcessExclusivityEventResult authority limits',
      'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_exclusivity_event_result_id: contentId(
      RESULT_ID_DOMAIN,
      resultIdentity(body),
    ),
    canonical_payload_digest: contentId(
      RESULT_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessExclusivityResultIdentity(value) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY';
  requireExactKeys(
    value,
    IDENTITY_KEYS,
    'ProcessExclusivityEventResult identity',
    code,
  );
  if (
    value.schema_version !== RESULT_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_result_slot_binding_state !== 'UNRESOLVED'
    || value.process_event_revision_state !== 'UNRESOLVED'
    || value.predicate_witnesses_state !== 'UNRESOLVED'
    || value.actual_drafting_state !== 'UNRESOLVED'
    || value.result_input_lineage_state !== 'UNRESOLVED'
    || value.history_projection_state !== 'UNRESOLVED'
    || value.phrasebook_link_state !== 'UNRESOLVED'
    || value.exact_detail_state !== 'UNRESOLVED'
    || value.release_membership_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The result identity type or boundary state is invalid.');
  }
  validateProcessExclusivityResultIdentityInput(resultIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'ProcessExclusivityEventResult authority limits',
    code,
  );
  const expectedId = contentId(
    RESULT_ID_DOMAIN,
    resultIdentity(value),
  );
  if (value.process_exclusivity_event_result_id !== expectedId) {
    fail(
      'PROCESS_EXCLUSIVITY_RESULT_ID_MISMATCH',
      'The ProcessExclusivityEventResult ID does not bind its exact frozen identity.',
    );
  }
  const body = { ...value };
  delete body.process_exclusivity_event_result_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    RESULT_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_EXCLUSIVITY_RESULT_PAYLOAD_MISMATCH',
      'The ProcessExclusivityEventResult identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  RESULT_DEFINITION,
  ProcessExclusivityResultIdentityError,
  buildProcessExclusivityResultIdentity,
  validateProcessExclusivityResultIdentity,
};
