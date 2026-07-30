const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_PREDICATE_CONTRACT_INPUT_KIND = 'PROCESS_PREDICATE_CONTRACT_INPUT';
const PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA = 'PROCESS_PREDICATE_CONTRACT_INPUT/V1';
const PROCESS_PREDICATE_CONTRACT_IDS = Object.freeze([
  'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL',
  'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
]);

const PROCESS_PREDICATE_DEFINITION_CONTRACTS = Object.freeze({
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL: Object.freeze({
    version_field: 'protocol_version',
    expected_version: 1,
    definition_digest: 'aca7f7c72abb4dc14b6e5f09fb672f1cbf8f2b574a8f8645bd82cd7ca43498df',
    error_code: 'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL',
    label: 'Process exclusivity completeness-challenge protocol',
  }),
  PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE: Object.freeze({
    version_field: 'catalogue_version',
    expected_version: 2,
    definition_digest: '7999d80bb861eac71b8bd3f0dfce7992f85258ae695303c77b85daeb03f38bc0',
    error_code: 'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
    label: 'Process exclusivity predicate catalogue',
  }),
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

  for (const member of members) {
    const value = member.canonical_value;
    const contract = PROCESS_PREDICATE_DEFINITION_CONTRACTS[value?.stable_id];
    const keys = Object.keys(value || {}).sort();
    if (
      !contract
      || canonicalJson(keys) !== canonicalJson([
        'definition',
        'object_kind',
        'schema_version',
        'stable_id',
      ])
      || value.object_kind !== PROCESS_PREDICATE_CONTRACT_INPUT_KIND
      || value.schema_version !== PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA
      || value.definition?.domain_key !== 'PROCESS'
      || value.definition?.topic_key !== 'EXCLUSIVITY'
      || value.definition?.[contract.version_field]
        !== contract.expected_version
    ) {
      fail(
        contract?.error_code || 'INVALID_PROCESS_PREDICATE_CONTRACT_INPUT',
        'The Process predicate contract identity is invalid.',
      );
    }

    let actualDigest;
    try {
      actualDigest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
    } catch (error) {
      fail(
        contract.error_code,
        `The ${contract.label} is not canonical JSON.`,
        { cause: error.message },
      );
    }
    if (actualDigest !== contract.definition_digest) {
      fail(
        contract.error_code,
        `The ${contract.label} does not match its complete governed definition.`,
        {
          expected_definition_digest: contract.definition_digest,
          actual_definition_digest: actualDigest,
        },
      );
    }
  }
}

module.exports = {
  PROCESS_PREDICATE_CONTRACT_IDS,
  PROCESS_PREDICATE_CONTRACT_INPUT_KIND,
  PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA,
  ProcessPredicateContractInputError,
  validateAuthoredProcessPredicateInputs,
};
