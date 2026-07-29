const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateCanonicalSourceIntervalSet,
} = require('./process-narration-occurrence');
const passageContract = require(
  '../../contracts/canonical-v2/successor/process/passages/process-passage.v1.json',
);

const PASSAGE_IDENTITY_SCHEMA = 'PROCESS_PASSAGE_IDENTITY/V1';
const PASSAGE_ID_DOMAIN = 'PROCESS_PASSAGE/V1';
const PASSAGE_PAYLOAD_DOMAIN = 'PROCESS_PASSAGE_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessPassage';
const SHA256_RE = /^[a-f0-9]{64}$/;

const PASSAGE_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_PASSAGE',
  definition_version: 1,
});

const IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'admitted_source_occurrence_id',
  'canonical_source_interval_set',
  'process_passage_definition_key_and_version',
  'governed_ordinal',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'source_provenance_validation_state',
  'passage_role_registry_state',
  'citation_binding_state',
  'context_action_binding_state',
  'authority_limits',
  'process_passage_id',
  'canonical_payload_digest',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...passageContract.definition.passage_identity.prohibited_inputs,
  'candidate_values',
  'citation_identity',
  'evidence_edges',
  'failure_detail',
  'passage_role_codes',
  'passage_state',
  'process_relationship_revision_ids',
  'source_map',
  'source_text',
  'source_text_digest',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  source_provenance_validation: 'NONE',
  passage_role_registry: 'NONE',
  citation_binding: 'NONE',
  context_action_binding: 'NONE',
  passage_revision: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessPassageIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPassageIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPassageIdentityError(code, message, details);
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
  const code = 'INVALID_PROCESS_PASSAGE_CONTRACT_BINDING';
  const definition = passageContract.definition;
  if (
    passageContract.object_kind !== 'PROCESS_LOGICAL_TYPE_INPUT'
    || passageContract.stable_id !== 'PROCESS_PASSAGE'
    || passageContract.schema_version !== 'PROCESS_LOGICAL_TYPE_INPUT/V1'
    || definition?.logical_type !== LOGICAL_TYPE
    || definition?.logical_type_version !== 1
  ) {
    fail(code, 'The ProcessPassage contract identity is invalid.');
  }
  requireExactValue(
    definition.passage_identity.stable_id_inputs,
    IDENTITY_INPUT_KEYS,
    'ProcessPassage stable ID inputs',
    code,
  );
  const source = definition.source_contract;
  const role = definition.role_contract;
  const citation = definition.citation_contract;
  const context = definition.context_contract;
  if (
    source.coordinate_space !== 'ADMITTED_SOURCE_UTF8_BYTES'
    || source.exact_ordered_unique_intervals_required !== true
    || source.admitted_source_occurrence_required !== true
    || source.source_document_identity_required !== true
    || source.source_accession_or_equivalent_identity_required !== true
    || source.source_intervals_fixed_before_candidate_values !== true
    || source.paragraph_boundary_defines_passage !== false
    || source.clipped_or_reconstructed_text_permitted !== false
    || role.passage_role_registry_required_before_materialisation !== true
    || role.role_codes_are_revision_values_not_identity !== true
    || role.free_text_label_can_create_role !== false
    || role.summary_cannot_substitute_for_actual_drafting !== true
    || citation.exact_release_identity_required !== true
    || citation.citation_open_preserves_release_identity !== true
    || citation.silent_redirect_to_newer_release_permitted !== false
    || citation.stale_release_requires_explicit_rerun_action !== true
    || context.context_action_must_bind_exact_parent_passage_and_release
      !== true
    || context.related_passages_require_typed_relationships !== true
  ) {
    fail(code, 'The ProcessPassage source, citation or context boundary is weakened.');
  }
  const authority = definition.authority_contract;
  if (
    authority.creates_runtime_passage !== false
    || authority.creates_writer_authority !== false
    || authority.creates_serving_authority !== false
    || authority.creates_release_authority !== false
    || authority.creates_contract_freeze_authority !== false
  ) {
    fail(code, 'The ProcessPassage definition grants prohibited authority.');
  }
}

function rejectProhibitedIdentityInputs(input) {
  requireObject(
    input,
    'ProcessPassage identity input',
    'INVALID_PROCESS_PASSAGE_IDENTITY',
  );
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_PASSAGE_VALUE_DERIVED_IDENTITY',
      'Text, citations, roles, context, relationships and model output cannot define ProcessPassage identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function validatePassageSource(input) {
  const code = 'INVALID_PROCESS_PASSAGE_SOURCE_INTERVAL_SET';
  try {
    validateCanonicalSourceIntervalSet(input.canonical_source_interval_set);
  } catch (error) {
    fail(
      code,
      'The ProcessPassage source interval set is invalid.',
      { cause_code: error.code, cause: error.message },
    );
  }
  const intervals = input.canonical_source_interval_set.intervals;
  const first = intervals[0];
  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (
      interval.admitted_source_occurrence_id
        !== input.admitted_source_occurrence_id
    ) {
      fail(
        'PROCESS_PASSAGE_SOURCE_OCCURRENCE_MISMATCH',
        'Every ProcessPassage interval must bind the admitted source occurrence in its identity.',
        { interval_index: index },
      );
    }
    if (
      interval.document_hash !== first.document_hash
      || interval.document_ordinal !== first.document_ordinal
    ) {
      fail(
        'PROCESS_PASSAGE_SOURCE_DOCUMENT_MISMATCH',
        'One ProcessPassage cannot combine intervals from different source documents.',
        { interval_index: index },
      );
    }
  }
}

function passageIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    admitted_source_occurrence_id: input.admitted_source_occurrence_id,
    canonical_source_interval_set: input.canonical_source_interval_set,
    process_passage_definition_key_and_version:
      input.process_passage_definition_key_and_version,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateProcessPassageIdentityInput(input) {
  const code = 'INVALID_PROCESS_PASSAGE_IDENTITY';
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'ProcessPassage identity input',
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
    input.admitted_source_occurrence_id,
    'Admitted source occurrence ID',
    code,
  );
  requireExactValue(
    input.process_passage_definition_key_and_version,
    PASSAGE_DEFINITION,
    'ProcessPassage definition key and version',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(
      code,
      'The governed ProcessPassage ordinal must be a non-negative safe integer.',
    );
  }
  validatePassageSource(input);
  return input;
}

function buildProcessPassageIdentity(input) {
  validateProcessPassageIdentityInput(input);
  const identity = cloneCanonical(
    passageIdentity(input),
    'ProcessPassage identity',
    'INVALID_PROCESS_PASSAGE_IDENTITY',
  );
  const body = {
    schema_version: PASSAGE_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    source_provenance_validation_state: 'UNRESOLVED',
    passage_role_registry_state: 'UNRESOLVED',
    citation_binding_state: 'UNRESOLVED',
    context_action_binding_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'ProcessPassage authority limits',
      'INVALID_PROCESS_PASSAGE_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_passage_id: contentId(
      PASSAGE_ID_DOMAIN,
      passageIdentity(body),
    ),
    canonical_payload_digest: contentId(
      PASSAGE_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessPassageIdentity(value) {
  const code = 'INVALID_PROCESS_PASSAGE_IDENTITY';
  requireExactKeys(
    value,
    IDENTITY_KEYS,
    'ProcessPassage identity',
    code,
  );
  if (
    value.schema_version !== PASSAGE_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.source_provenance_validation_state !== 'UNRESOLVED'
    || value.passage_role_registry_state !== 'UNRESOLVED'
    || value.citation_binding_state !== 'UNRESOLVED'
    || value.context_action_binding_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The ProcessPassage identity type or boundary state is invalid.');
  }
  validateProcessPassageIdentityInput(passageIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'ProcessPassage authority limits',
    code,
  );
  const expectedId = contentId(
    PASSAGE_ID_DOMAIN,
    passageIdentity(value),
  );
  if (value.process_passage_id !== expectedId) {
    fail(
      'PROCESS_PASSAGE_ID_MISMATCH',
      'The ProcessPassage ID does not bind the exact frozen identity.',
    );
  }
  const body = { ...value };
  delete body.process_passage_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    PASSAGE_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_PASSAGE_PAYLOAD_MISMATCH',
      'The ProcessPassage identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  ProcessPassageIdentityError,
  buildProcessPassageIdentity,
  validateProcessPassageIdentity,
};
