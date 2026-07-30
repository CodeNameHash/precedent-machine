const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_KIND =
  'AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT';
const AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_SCHEMA =
  'AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT/V1';
const AGREEMENT_QUERY_ORDERING_CONTRACT_IDS = Object.freeze([
  'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION',
]);
const AGREEMENT_QUERY_ORDERING_CONTRACT_DEFINITIONS = Object.freeze({
  AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION: Object.freeze({
    contract_type: 'COMPARABLE_RESULT_ORDERING_DEFINITION',
    definition_digest:
      '7101692597e7378f2de083ce28c16b079ffd915fe8419e3c65c4749a54978b5c',
    error_code: 'INVALID_AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT',
  }),
});

class AgreementQueryOrderingContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgreementQueryOrderingContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new AgreementQueryOrderingContractInputError(
    code,
    message,
    details,
  );
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (
    !Array.isArray(value)
    || canonicalJson(value) !== canonicalJson(expected)
  ) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function validateMember(member) {
  const value = member.canonical_value;
  const stableId = value?.stable_id;
  const registered =
    AGREEMENT_QUERY_ORDERING_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code
    || 'INVALID_AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Agreement query-ordering contract input', code);

  if (
    !registered
    || value.object_kind
      !== AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_KIND
    || value.schema_version
      !== AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'AGREEMENT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Agreement query-ordering contract is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(
      code,
      'The Agreement query-ordering contract is not canonical JSON.',
      { cause: error.message },
    );
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Agreement query-ordering contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredAgreementQueryOrderingInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    AGREEMENT_QUERY_ORDERING_CONTRACT_IDS,
    'Agreement query-ordering contract member set',
    'AGREEMENT_QUERY_ORDERING_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  members.forEach(validateMember);
}

module.exports = {
  AGREEMENT_QUERY_ORDERING_CONTRACT_DEFINITIONS,
  AGREEMENT_QUERY_ORDERING_CONTRACT_IDS,
  AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_KIND,
  AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_SCHEMA,
  AgreementQueryOrderingContractInputError,
  validateAuthoredAgreementQueryOrderingInputs,
};
