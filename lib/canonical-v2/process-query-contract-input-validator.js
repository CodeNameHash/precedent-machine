const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_QUERY_CONTRACT_INPUT_KIND = 'PROCESS_QUERY_CONTRACT_INPUT';
const PROCESS_QUERY_CONTRACT_INPUT_SCHEMA = 'PROCESS_QUERY_CONTRACT_INPUT/V1';
const PROCESS_QUERY_CONTRACT_IDS = Object.freeze([
  'PROCESS_ASK_QUERY_COMPILER',
  'PROCESS_BROWSE_QUERY_COMPILER',
  'PROCESS_QUERY_IR',
]);
const PROCESS_QUERY_CONTRACT_DEFINITIONS = Object.freeze({
  PROCESS_ASK_QUERY_COMPILER: Object.freeze({
    contract_type: 'ASK_QUERY_COMPILER_DEFINITION',
    definition_digest:
      '779bcdfe1ec950058d5fa83c8f4120113b683fad6ec24f53c0dbc42015628369',
    error_code: 'INVALID_PROCESS_ASK_QUERY_COMPILER_INPUT',
  }),
  PROCESS_BROWSE_QUERY_COMPILER: Object.freeze({
    contract_type: 'BROWSE_QUERY_COMPILER_DEFINITION',
    definition_digest:
      'edb7240138fd0c48a3fe5c1b032ccd079b86bfaff3f7573c9b1b1f7598103c4b',
    error_code: 'INVALID_PROCESS_BROWSE_QUERY_COMPILER_INPUT',
  }),
  PROCESS_QUERY_IR: Object.freeze({
    contract_type: 'QUERY_IR_DEFINITION',
    definition_digest:
      '17d5922c3290fe1b2812d3c9fdcecfa45363776774a74a14123e3a3843c5dc1a',
    error_code: 'INVALID_PROCESS_QUERY_IR_INPUT',
  }),
});

class ProcessQueryContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessQueryContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessQueryContractInputError(code, message, details);
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function validateMember(member) {
  const value = member.canonical_value;
  const stableId = value?.stable_id;
  const registered = PROCESS_QUERY_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code || 'INVALID_PROCESS_QUERY_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process query contract input', code);

  if (
    !registered
    || value.object_kind !== PROCESS_QUERY_CONTRACT_INPUT_KIND
    || value.schema_version !== PROCESS_QUERY_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Process query contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Process query contract definition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Process query contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProcessQueryInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_QUERY_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PROCESS_QUERY_CONTRACT_IDS,
    'Process query contract member set',
    'PROCESS_QUERY_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  members.forEach(validateMember);
}

module.exports = {
  PROCESS_QUERY_CONTRACT_DEFINITIONS,
  PROCESS_QUERY_CONTRACT_IDS,
  PROCESS_QUERY_CONTRACT_INPUT_KIND,
  PROCESS_QUERY_CONTRACT_INPUT_SCHEMA,
  ProcessQueryContractInputError,
  validateAuthoredProcessQueryInputs,
};
