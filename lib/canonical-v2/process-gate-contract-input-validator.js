const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_GATE_CONTRACT_INPUT_KIND = 'PROCESS_GATE_CONTRACT_INPUT';
const PROCESS_GATE_CONTRACT_INPUT_SCHEMA = 'PROCESS_GATE_CONTRACT_INPUT/V1';
const PROCESS_GATE_CONTRACT_IDS = Object.freeze([
  'PROCESS_VERTICAL_SLICE_PASS',
]);
const PROCESS_GATE_CONTRACT_DEFINITIONS = Object.freeze({
  PROCESS_VERTICAL_SLICE_PASS: Object.freeze({
    contract_type: 'VERTICAL_SLICE_PASS_DEFINITION',
    definition_digest:
      '70d39329165161a3188ab628085c11e334ee157391a028625db72e606a379609',
    error_code: 'INVALID_PROCESS_VERTICAL_SLICE_PASS_INPUT',
  }),
});

class ProcessGateContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessGateContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessGateContractInputError(code, message, details);
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
  const registered = PROCESS_GATE_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code || 'INVALID_PROCESS_GATE_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process gate contract input', code);

  if (
    !registered
    || value.object_kind !== PROCESS_GATE_CONTRACT_INPUT_KIND
    || value.schema_version !== PROCESS_GATE_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Process gate contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Process gate contract definition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Process gate contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProcessGateInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_GATE_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PROCESS_GATE_CONTRACT_IDS,
    'Process gate contract member set',
    'PROCESS_GATE_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  members.forEach(validateMember);
}

module.exports = {
  PROCESS_GATE_CONTRACT_DEFINITIONS,
  PROCESS_GATE_CONTRACT_IDS,
  PROCESS_GATE_CONTRACT_INPUT_KIND,
  PROCESS_GATE_CONTRACT_INPUT_SCHEMA,
  ProcessGateContractInputError,
  validateAuthoredProcessGateInputs,
};
