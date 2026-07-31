const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_SOURCE_READER_CONTRACT_INPUT_KIND =
  'PRODUCT_SOURCE_READER_CONTRACT_INPUT';
const PRODUCT_SOURCE_READER_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_SOURCE_READER_CONTRACT_INPUT/V1';
const PRODUCT_SOURCE_READER_CONTRACT_IDS = Object.freeze([
  'PRODUCT_SOURCE_READER_DEFINITION',
]);
const PRODUCT_SOURCE_READER_CONTRACT_DEFINITIONS = Object.freeze({
  PRODUCT_SOURCE_READER_DEFINITION: Object.freeze({
    contract_type: 'SOURCE_READER_DEFINITION',
    definition_digest:
      'e1842f8d43eefe8dfc39b436422a26a9a2508e7309a752987a58585828619390',
    error_code: 'INVALID_PRODUCT_SOURCE_READER_DEFINITION_INPUT',
  }),
});

class ProductSourceReaderContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductSourceReaderContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductSourceReaderContractInputError(code, message, details);
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
  const registered = PRODUCT_SOURCE_READER_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code
    || 'INVALID_PRODUCT_SOURCE_READER_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product source-reader contract input', code);

  if (
    !registered
    || value.object_kind !== PRODUCT_SOURCE_READER_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_SOURCE_READER_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product source-reader contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(
      code,
      'The Product source-reader contract definition is not canonical JSON.',
      { cause: error.message },
    );
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Product source-reader contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProductSourceReaderInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === PRODUCT_SOURCE_READER_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PRODUCT_SOURCE_READER_CONTRACT_IDS,
    'Product source-reader contract member set',
    'PRODUCT_SOURCE_READER_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  members.forEach(validateMember);
}

module.exports = {
  PRODUCT_SOURCE_READER_CONTRACT_DEFINITIONS,
  PRODUCT_SOURCE_READER_CONTRACT_IDS,
  PRODUCT_SOURCE_READER_CONTRACT_INPUT_KIND,
  PRODUCT_SOURCE_READER_CONTRACT_INPUT_SCHEMA,
  ProductSourceReaderContractInputError,
  validateAuthoredProductSourceReaderInputs,
};
