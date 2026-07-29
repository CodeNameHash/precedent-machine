const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_QUERY_ACTION_CONTRACT_INPUT_KIND =
  'PRODUCT_QUERY_ACTION_CONTRACT_INPUT';
const PRODUCT_QUERY_ACTION_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_QUERY_ACTION_CONTRACT_INPUT/V1';
const PRODUCT_QUERY_ACTION_CONTRACT_IDS = Object.freeze([
  'PRODUCT_RERUN_ON_ACTIVE_RELEASE',
  'PRODUCT_SAVED_QUERY_DEFINITION',
]);
const PRODUCT_QUERY_ACTION_CONTRACT_DEFINITIONS = Object.freeze({
  PRODUCT_RERUN_ON_ACTIVE_RELEASE: Object.freeze({
    contract_type: 'ACTIVE_RELEASE_RERUN_DEFINITION',
    definition_digest:
      '4d585d3db56da12978ac88626f49fe4060d53d8acaac71ef1fc9f83d39821162',
    error_code: 'INVALID_PRODUCT_ACTIVE_RELEASE_RERUN_INPUT',
  }),
  PRODUCT_SAVED_QUERY_DEFINITION: Object.freeze({
    contract_type: 'SAVED_QUERY_DEFINITION',
    definition_digest:
      '188b2aa0a4c662180874ec444809b011cc954c6f189c562f8ac29cfb3daaf3c1',
    error_code: 'INVALID_PRODUCT_SAVED_QUERY_DEFINITION_INPUT',
  }),
});

class ProductQueryActionContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductQueryActionContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductQueryActionContractInputError(code, message, details);
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
  const registered = PRODUCT_QUERY_ACTION_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code
    || 'INVALID_PRODUCT_QUERY_ACTION_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product query-action contract input', code);

  if (
    !registered
    || value.object_kind !== PRODUCT_QUERY_ACTION_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_QUERY_ACTION_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product query-action contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(
      code,
      'The Product query-action contract definition is not canonical JSON.',
      { cause: error.message },
    );
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Product query-action contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProductQueryActionInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === PRODUCT_QUERY_ACTION_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PRODUCT_QUERY_ACTION_CONTRACT_IDS,
    'Product query-action contract member set',
    'PRODUCT_QUERY_ACTION_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  members.forEach(validateMember);
}

module.exports = {
  PRODUCT_QUERY_ACTION_CONTRACT_DEFINITIONS,
  PRODUCT_QUERY_ACTION_CONTRACT_IDS,
  PRODUCT_QUERY_ACTION_CONTRACT_INPUT_KIND,
  PRODUCT_QUERY_ACTION_CONTRACT_INPUT_SCHEMA,
  ProductQueryActionContractInputError,
  validateAuthoredProductQueryActionInputs,
};
