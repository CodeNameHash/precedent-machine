const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_RESULT_ACTION_CONTRACT_INPUT_KIND =
  'PRODUCT_RESULT_ACTION_CONTRACT_INPUT';
const PRODUCT_RESULT_ACTION_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_RESULT_ACTION_CONTRACT_INPUT/V1';
const PRODUCT_RESULT_ACTION_CONTRACT_IDS = Object.freeze([
  'PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE',
  'PRODUCT_SELECTED_RESULT_EXPORT',
]);
const PRODUCT_RESULT_ACTION_CONTRACT_DEFINITIONS = Object.freeze({
  PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE: Object.freeze({
    contract_type: 'CITATION_AND_SHARE_DEFINITION',
    definition_digest:
      'f31078b524885076e01667cd87d540b993b283c4f4969b32138907ecd1af7fc7',
    error_code:
      'INVALID_PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE_INPUT',
  }),
  PRODUCT_SELECTED_RESULT_EXPORT: Object.freeze({
    contract_type: 'SELECTED_RESULT_EXPORT_DEFINITION',
    definition_digest:
      '833201e1ee579825181b25d5530aeaeb462ce84afa07cf70057c036d662d9eb9',
    error_code: 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_INPUT',
  }),
});

class ProductResultActionContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductResultActionContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductResultActionContractInputError(code, message, details);
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
  const registered = PRODUCT_RESULT_ACTION_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code
    || 'INVALID_PRODUCT_RESULT_ACTION_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product result-action contract input', code);

  if (
    !registered
    || value.object_kind !== PRODUCT_RESULT_ACTION_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_RESULT_ACTION_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product result-action contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(
      code,
      'The Product result-action contract definition is not canonical JSON.',
      { cause: error.message },
    );
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Product result-action contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProductResultActionInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === PRODUCT_RESULT_ACTION_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PRODUCT_RESULT_ACTION_CONTRACT_IDS,
    'Product result-action contract member set',
    'PRODUCT_RESULT_ACTION_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  members.forEach(validateMember);
}

module.exports = {
  PRODUCT_RESULT_ACTION_CONTRACT_DEFINITIONS,
  PRODUCT_RESULT_ACTION_CONTRACT_IDS,
  PRODUCT_RESULT_ACTION_CONTRACT_INPUT_KIND,
  PRODUCT_RESULT_ACTION_CONTRACT_INPUT_SCHEMA,
  ProductResultActionContractInputError,
  validateAuthoredProductResultActionInputs,
};
