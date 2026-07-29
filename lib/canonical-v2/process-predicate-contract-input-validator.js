const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_PREDICATE_CONTRACT_INPUT_KIND = 'PROCESS_PREDICATE_CONTRACT_INPUT';
const PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA = 'PROCESS_PREDICATE_CONTRACT_INPUT/V1';
const PROCESS_PREDICATE_CONTRACT_IDS = Object.freeze([
  'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
]);

const PROCESS_PREDICATE_DEFINITION_LOCKS = Object.freeze({
  PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE:
    'a75fde64f61ac5d0d6b40034c1c206a3560ec20221db23d9a0cc677ed54f0360',
});

class ProcessPredicateContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPredicateContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPredicateContractInputError(code, message, details);
}

function validateAuthoredProcessPredicateInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_PREDICATE_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (canonicalJson(stableIds) !== canonicalJson(PROCESS_PREDICATE_CONTRACT_IDS)) {
    fail(
      'PROCESS_PREDICATE_CONTRACT_MEMBERSHIP_MISMATCH',
      'The Process predicate contract member set is incomplete, duplicated, or unregistered.',
      {
        actual_stable_ids: stableIds,
        expected_stable_ids: PROCESS_PREDICATE_CONTRACT_IDS,
      },
    );
  }

  const value = members[0].canonical_value;
  const keys = Object.keys(value || {}).sort();
  if (
    canonicalJson(keys) !== canonicalJson([
      'definition',
      'object_kind',
      'schema_version',
      'stable_id',
    ])
    || value.object_kind !== PROCESS_PREDICATE_CONTRACT_INPUT_KIND
    || value.stable_id !== 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE'
    || value.schema_version !== PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.topic_key !== 'EXCLUSIVITY'
    || value.definition?.catalogue_version !== 1
  ) {
    fail(
      'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
      'The Process exclusivity predicate catalogue identity is invalid.',
    );
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
  } catch (error) {
    fail(
      'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
      'The Process exclusivity predicate catalogue is not canonical JSON.',
      { cause: error.message },
    );
  }
  const expectedDigest = PROCESS_PREDICATE_DEFINITION_LOCKS[value.stable_id];
  if (actualDigest !== expectedDigest) {
    fail(
      'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
      'The Process exclusivity predicate catalogue does not match its complete governed definition.',
      {
        expected_definition_digest: expectedDigest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

module.exports = {
  PROCESS_PREDICATE_CONTRACT_IDS,
  PROCESS_PREDICATE_CONTRACT_INPUT_KIND,
  PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA,
  ProcessPredicateContractInputError,
  validateAuthoredProcessPredicateInputs,
};
