const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_SERVING_CONTRACT_INPUT_KIND =
  'PRODUCT_SERVING_CONTRACT_INPUT';
const PRODUCT_SERVING_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_SERVING_CONTRACT_INPUT/V1';
const PRODUCT_SERVING_CONTRACT_IDS = Object.freeze([
  'PRODUCT_QUERY_SERVING_EXECUTION',
  'PRODUCT_SHARED_SERVING_ROW',
]);
const PRODUCT_SERVING_CONTRACT_DEFINITIONS = Object.freeze({
  PRODUCT_QUERY_SERVING_EXECUTION: Object.freeze({
    contract_type: 'QUERY_SERVING_EXECUTION_DEFINITION',
    definition_digest:
      '8b7e6b2ac6bbe91693ea01c2198a0ad0a5efcaf627ea4187067d9053dfa29493',
    error_code: 'INVALID_PRODUCT_QUERY_SERVING_EXECUTION_INPUT',
  }),
  PRODUCT_SHARED_SERVING_ROW: Object.freeze({
    contract_type: 'SHARED_SERVING_ROW_DEFINITION',
    definition_digest:
      '7078909843e7fc3d402888b04d10b5ee107d74e725e6c1aca521c041bd947b84',
    error_code: 'INVALID_PRODUCT_SHARED_SERVING_ROW_INPUT',
  }),
});

class ProductServingContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductServingContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductServingContractInputError(code, message, details);
}

function requireExactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function validateMember(member) {
  const value = member.canonical_value;
  const registered =
    PRODUCT_SERVING_CONTRACT_DEFINITIONS[value?.stable_id];
  const code = registered?.error_code
    || 'INVALID_PRODUCT_SERVING_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product serving contract input', code);

  if (
    !registered
    || value.object_kind !== PRODUCT_SERVING_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_SERVING_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product serving contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Product serving contract is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== registered.definition_digest) {
    fail(code, 'The Product serving contract definition has changed.', {
      expected_definition_digest: registered.definition_digest,
      actual_definition_digest: actualDigest,
    });
  }
}

function validateAuthoredProductServingInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === PRODUCT_SERVING_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (
    canonicalJson(stableIds)
    !== canonicalJson(PRODUCT_SERVING_CONTRACT_IDS)
  ) {
    fail(
      'PRODUCT_SERVING_CONTRACT_MEMBERSHIP_MISMATCH',
      'The Product serving contract set is incomplete, duplicated, or unregistered.',
      {
        actual_stable_ids: stableIds,
        expected_stable_ids: PRODUCT_SERVING_CONTRACT_IDS,
      },
    );
  }
  members.forEach(validateMember);
}

module.exports = {
  PRODUCT_SERVING_CONTRACT_DEFINITIONS,
  PRODUCT_SERVING_CONTRACT_IDS,
  PRODUCT_SERVING_CONTRACT_INPUT_KIND,
  PRODUCT_SERVING_CONTRACT_INPUT_SCHEMA,
  ProductServingContractInputError,
  validateAuthoredProductServingInputs,
};
