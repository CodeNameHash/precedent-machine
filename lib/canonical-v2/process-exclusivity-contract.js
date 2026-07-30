const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateAuthoredProcessPredicateInputs,
} = require('./process-predicate-contract-input-validator');
const catalogueContract = require(
  '../../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
);
const predicateChallengeContract = require(
  '../../contracts/canonical-v2/successor/process/predicates/exclusivity-completeness-challenge-protocol.v1.json',
);

const CHECK_SCHEMA = 'PROCESS_EXCLUSIVITY_SEMANTIC_CHECK/V1';
const CHECK_DIGEST_DOMAIN = 'PROCESS_EXCLUSIVITY_SEMANTIC_CHECK_PAYLOAD/V1';
const CATALOGUE_DIGEST_DOMAIN = 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE/V2';
const SHA256_RE = /^[a-f0-9]{64}$/;

const PREDECESSOR_PREDICATE_SEMANTIC_KINDS = Object.freeze({
  EXCLUSIVITY_REQUESTED: 'REQUEST',
  EXCLUSIVITY_SUBJECT: 'SUBJECT',
  EXCLUSIVITY_REQUESTER: 'REQUESTER',
  EXCLUSIVITY_RECIPIENT: 'RECIPIENT',
  EXCLUSIVITY_EXPRESS_REFUSAL: 'EXPRESS_REFUSAL',
  EXCLUSIVITY_COUNTERPROPOSAL: 'COUNTERPROPOSAL',
  EXCLUSIVITY_CONDITIONAL_ACCEPTANCE: 'CONDITIONAL_ACCEPTANCE',
  EXCLUSIVITY_RESPONSE_ANY: 'RESPONSE_UNION',
  EXCLUSIVITY_GRANTED: 'GRANT',
  EXCLUSIVITY_GRANTOR: 'GRANTOR',
  EXCLUSIVITY_BENEFICIARY: 'BENEFICIARY',
  EXCLUSIVITY_START: 'START',
  EXCLUSIVITY_END: 'END',
  EXCLUSIVITY_DURATION: 'DURATION',
  EXCLUSIVITY_EXTENSION: 'EXTENSION',
  EXCLUSIVITY_AMENDMENT: 'AMENDMENT',
  EXCLUSIVITY_WAIVER: 'WAIVER',
  EXCLUSIVITY_EXPIRY: 'EXPIRY',
  EXCLUSIVITY_RATIONALE: 'RATIONALE',
  EXCLUSIVITY_CONDITION: 'CONDITION',
  EXCLUSIVITY_BIDDER_TRACK: 'BIDDER_TRACK',
  EXCLUSIVITY_RESPONSE_RELATIONSHIP: 'RESPONSE_RELATIONSHIP',
  EXCLUSIVITY_ACTUAL_DRAFTING: 'ACTUAL_DRAFTING',
});
const SUCCESSOR_PREDICATE_MACHINE_RULES = Object.freeze(
  Object.fromEntries(
    catalogueContract.definition.successor_predicate_definition_contract
      .definitions.map((definition) => [
        definition.predicate_key,
        definition.machine_rule,
      ]),
  ),
);
const PREDICATE_SEMANTIC_KINDS = Object.freeze({
  ...PREDECESSOR_PREDICATE_SEMANTIC_KINDS,
  ...Object.fromEntries(
    Object.entries(SUCCESSOR_PREDICATE_MACHINE_RULES).map(
      ([predicateKey, rule]) => [predicateKey, rule.semantic_kind],
    ),
  ),
});

const RESPONSE_SEMANTIC_KINDS = Object.freeze({
  EXCLUSIVITY_EXPRESS_REFUSAL: 'EXPRESS_REFUSAL',
  EXCLUSIVITY_COUNTERPROPOSAL: 'COUNTERPROPOSAL',
  EXCLUSIVITY_CONDITIONAL_ACCEPTANCE: 'CONDITIONAL_ACCEPTANCE',
  EXCLUSIVITY_GRANTED: 'GRANT',
});

const SUBJECT_REQUIRED_PREDICATES = new Set([
  'EXCLUSIVITY_REQUESTED',
  'EXCLUSIVITY_SUBJECT',
  'EXCLUSIVITY_EXPRESS_REFUSAL',
  'EXCLUSIVITY_COUNTERPROPOSAL',
  'EXCLUSIVITY_CONDITIONAL_ACCEPTANCE',
  'EXCLUSIVITY_RESPONSE_ANY',
  'EXCLUSIVITY_GRANTED',
]);

const INPUT_KEYS = Object.freeze([
  'predicate_key',
  'predicate_version',
  'predicate_state',
  'subject_code',
  'atomic_response_predicate_key',
  'source_semantic_kind',
  'value_carrier_ids',
  'evidence_edge_ids',
  'complete_governed_scope',
  'failure_detail_id',
]);

const CATALOGUE_BINDING_KEYS = Object.freeze([
  'catalogue_stable_id',
  'catalogue_schema_version',
  'catalogue_version',
  'catalogue_contract_digest',
]);

const CHECK_KEYS = Object.freeze([
  'schema_version',
  ...INPUT_KEYS,
  'catalogue_binding',
  'semantic_check_state',
  'materialisation_state',
  'authority_limits',
  'canonical_payload_digest',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  extraction: 'NONE',
  runtime_predicate: 'NONE',
  witness_materialisation: 'NONE',
  result_materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessExclusivityContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessExclusivityContractError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessExclusivityContractError(code, message, details);
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

function requireDigestArray(value, label, code) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  for (const [index, digest] of value.entries()) {
    requireDigest(digest, `${label} item ${index}`, code);
  }
  if (new Set(value).size !== value.length) {
    fail(code, `${label} cannot contain duplicate values.`);
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

function validateCatalogueContract() {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_CATALOGUE_BINDING';
  try {
    validateAuthoredProcessPredicateInputs([
      predicateChallengeContract,
      catalogueContract,
    ].map((canonicalValue) => ({
      object_kind: canonicalValue.object_kind,
      canonical_value: canonicalValue,
    })));
  } catch (error) {
    fail(code, 'The complete signed Process predicate contract has changed.', {
      cause: error.code || error.message,
    });
  }
  requireExactKeys(
    catalogueContract,
    ['object_kind', 'stable_id', 'schema_version', 'definition'],
    'Process exclusivity predicate catalogue',
    code,
  );
  if (
    catalogueContract.object_kind !== 'PROCESS_PREDICATE_CONTRACT_INPUT'
    || catalogueContract.stable_id
      !== 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE'
    || catalogueContract.schema_version
      !== 'PROCESS_PREDICATE_CONTRACT_INPUT/V1'
    || catalogueContract.definition?.catalogue_version !== 2
  ) {
    fail(code, 'The Process exclusivity predicate catalogue identity is invalid.');
  }

  const definition = catalogueContract.definition;
  requireExactValue(
    definition.ordinary_question_contract.mandatory_predicate_keys,
    Object.keys(PREDICATE_SEMANTIC_KINDS),
    'Mandatory exclusivity predicate keys',
    code,
  );
  requireExactValue(
    definition.response_contract.atomic_response_predicate_keys,
    Object.keys(RESPONSE_SEMANTIC_KINDS),
    'Atomic exclusivity response predicate keys',
    code,
  );
  requireExactValue(
    definition.subject_contract.initial_subject_codes,
    [
      'NEGOTIATION_EXCLUSIVITY',
      'TRANSACTION_EXCLUSIVITY',
      'EXCLUSIVE_DILIGENCE',
      'EXCLUSIVE_DATA_ACCESS',
    ],
    'Initial exclusivity subject codes',
    code,
  );
  requireExactValue(
    definition.state_and_absence_contract.allowed_states,
    ['PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED'],
    'Exclusivity predicate states',
    code,
  );

  const requiredFalseRules = [
    definition.subject_contract
      .exclusive_data_access_can_become_negotiation_exclusivity,
    definition.response_contract.request_can_satisfy_grant,
    definition.response_contract.shortened_term_can_become_express_refusal,
    definition.response_contract.conditional_response_can_become_express_refusal,
    definition.response_contract.silence_can_become_express_refusal,
    definition.response_contract.no_recorded_grant_can_become_express_refusal,
  ];
  if (requiredFalseRules.some((value) => value !== false)) {
    fail(code, 'The Process exclusivity semantic-separation rules are weakened.');
  }
  if (
    definition.response_contract.union_requires_admitted_atomic_constituent
      !== true
    || definition.response_contract.union_preserves_constituent_predicate_key
      !== true
    || definition.response_contract
      .union_preserves_exact_subject_and_response_state !== true
    || definition.state_and_absence_contract
      .absent_requires_complete_governed_scope_and_evidence !== true
  ) {
    fail(code, 'The Process exclusivity union or absence rules are weakened.');
  }
}

function catalogueBinding() {
  validateCatalogueContract();
  return {
    catalogue_stable_id: catalogueContract.stable_id,
    catalogue_schema_version: catalogueContract.schema_version,
    catalogue_version: catalogueContract.definition.catalogue_version,
    catalogue_contract_digest: contentId(
      CATALOGUE_DIGEST_DOMAIN,
      catalogueContract,
    ),
  };
}

function requireSubjectCode(value, code) {
  const allowed = catalogueContract.definition
    .subject_contract.initial_subject_codes;
  if (value !== null && !allowed.includes(value)) {
    fail(code, 'The exclusivity subject code is not governed.', {
      subject_code: value,
    });
  }
}

function validateStateSemantics(input) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK';
  const present = input.predicate_state === 'PRESENT';
  const expectedSemanticKind = input.predicate_key === 'EXCLUSIVITY_RESPONSE_ANY'
    ? RESPONSE_SEMANTIC_KINDS[input.atomic_response_predicate_key]
    : PREDICATE_SEMANTIC_KINDS[input.predicate_key];
  const allowedStates = catalogueContract.definition
    .state_and_absence_contract.allowed_states;
  if (!allowedStates.includes(input.predicate_state)) {
    fail(code, 'The exclusivity predicate state is not governed.');
  }
  if (typeof input.complete_governed_scope !== 'boolean') {
    fail(code, 'The complete governed scope flag must be boolean.');
  }
  requireDigestArray(input.value_carrier_ids, 'Value carrier IDs', code);
  requireDigestArray(input.evidence_edge_ids, 'Evidence edge IDs', code);
  if (input.failure_detail_id !== null) {
    requireDigest(input.failure_detail_id, 'Failure detail ID', code);
  }

  if (present) {
    if (
      input.source_semantic_kind !== expectedSemanticKind
      || input.value_carrier_ids.length === 0
      || input.evidence_edge_ids.length === 0
      || input.complete_governed_scope
      || input.failure_detail_id !== null
    ) {
      fail(
        code,
        'A present exclusivity predicate needs its exact semantic kind, value and evidence only.',
      );
    }
    return;
  }

  if (
    input.source_semantic_kind !== null
    || input.value_carrier_ids.length !== 0
  ) {
    fail(code, 'A non-present exclusivity predicate cannot carry a value.');
  }

  if (input.predicate_state === 'ABSENT') {
    if (
      !input.complete_governed_scope
      || input.evidence_edge_ids.length === 0
      || input.failure_detail_id !== null
    ) {
      fail(
        code,
        'An absent exclusivity predicate needs complete governed scope and evidence.',
      );
    }
    return;
  }

  if (input.predicate_state === 'NOT_APPLICABLE') {
    if (
      input.complete_governed_scope
      || input.evidence_edge_ids.length === 0
      || input.failure_detail_id !== null
    ) {
      fail(
        code,
        'A not-applicable exclusivity predicate needs applicability evidence only.',
      );
    }
    return;
  }

  if (input.predicate_state === 'NOT_EXAMINED') {
    if (
      input.complete_governed_scope
      || input.evidence_edge_ids.length !== 0
      || input.failure_detail_id !== null
    ) {
      fail(code, 'A not-examined exclusivity predicate cannot carry findings.');
    }
    return;
  }

  if (
    input.complete_governed_scope
    || input.evidence_edge_ids.length !== 0
    || input.failure_detail_id === null
  ) {
    fail(code, 'A failed exclusivity predicate needs only a failure detail ID.');
  }
}

function validatePredicateSemantics(input) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK';
  if (
    !Object.hasOwn(PREDICATE_SEMANTIC_KINDS, input.predicate_key)
    || input.predicate_version !== 1
  ) {
    fail(code, 'The exclusivity predicate key and version are not governed.');
  }
  requireSubjectCode(input.subject_code, code);

  const subjectRequired = SUBJECT_REQUIRED_PREDICATES.has(input.predicate_key)
    && ['PRESENT', 'ABSENT', 'NOT_APPLICABLE'].includes(input.predicate_state);
  if (subjectRequired && input.subject_code === null) {
    fail(code, 'This exclusivity predicate requires an exact subject code.');
  }

  if (input.predicate_key === 'EXCLUSIVITY_RESPONSE_ANY') {
    if (input.predicate_state === 'PRESENT' && !Object.hasOwn(
      RESPONSE_SEMANTIC_KINDS,
      input.atomic_response_predicate_key,
    )) {
      fail(
        code,
        'A present response union requires one governed atomic response predicate.',
      );
    }
    if (
      input.predicate_state === 'PRESENT'
      && input.source_semantic_kind
        !== RESPONSE_SEMANTIC_KINDS[input.atomic_response_predicate_key]
    ) {
      fail(
        code,
        'The response union semantic kind does not match its atomic constituent.',
      );
    }
    if (
      input.predicate_state !== 'PRESENT'
      && input.atomic_response_predicate_key !== null
    ) {
      fail(
        code,
        'A non-present response union cannot invent an atomic constituent.',
      );
    }
  } else if (input.atomic_response_predicate_key !== null) {
    fail(
      code,
      'Only the generic response union can carry an atomic response predicate.',
    );
  }

  validateStateSemantics(input);
}

function buildProcessExclusivitySemanticCheck(input) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK';
  requireExactKeys(input, INPUT_KEYS, 'Process exclusivity semantic input', code);
  const candidate = cloneCanonical(
    input,
    'Process exclusivity semantic input',
    code,
  );
  validateCatalogueContract();
  validatePredicateSemantics(candidate);

  const payload = {
    schema_version: CHECK_SCHEMA,
    ...candidate,
    catalogue_binding: catalogueBinding(),
    semantic_check_state: 'CHECKED_CANDIDATE_ONLY',
    materialisation_state: 'DRAFT_ONLY',
    authority_limits: AUTHORITY_LIMITS,
  };
  const result = {
    ...payload,
    canonical_payload_digest: contentId(CHECK_DIGEST_DOMAIN, payload),
  };
  return deepFreeze(result);
}

function validateProcessExclusivitySemanticCheck(value) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK';
  requireExactKeys(value, CHECK_KEYS, 'Process exclusivity semantic check', code);
  requireExactKeys(
    value.catalogue_binding,
    CATALOGUE_BINDING_KEYS,
    'Process exclusivity catalogue binding',
    code,
  );
  requireDigest(
    value.canonical_payload_digest,
    'Process exclusivity semantic check digest',
    code,
  );
  requireDigest(
    value.catalogue_binding.catalogue_contract_digest,
    'Process exclusivity catalogue contract digest',
    code,
  );

  const input = {};
  for (const key of INPUT_KEYS) input[key] = value[key];
  const rebuilt = buildProcessExclusivitySemanticCheck(input);
  requireExactValue(
    value,
    rebuilt,
    'Process exclusivity semantic check',
    code,
  );
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  CHECK_SCHEMA,
  PREDICATE_SEMANTIC_KINDS,
  ProcessExclusivityContractError,
  buildProcessExclusivitySemanticCheck,
  validateProcessExclusivitySemanticCheck,
};
