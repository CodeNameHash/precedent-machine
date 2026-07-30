const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_QUERY_CONTRACT_INPUT_KIND = 'PRODUCT_QUERY_CONTRACT_INPUT';
const PRODUCT_QUERY_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_QUERY_CONTRACT_INPUT/V1';
const PRODUCT_QUERY_CONTRACT_IDS = Object.freeze([
  'PRODUCT_QUERY_IR',
  'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE',
]);
const PRODUCT_QUERY_CONTRACT_DEFINITIONS = Object.freeze({
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE: Object.freeze({
    contract_type: 'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE',
    definition_digest:
      '7d922344b0add592de2658c08a2a67a8f8ab57e22b3462713e9696bfa1e30a91',
    error_code:
      'INVALID_QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_CONTRACT_INPUT',
  }),
  PRODUCT_QUERY_IR: Object.freeze({
    contract_type: 'QUERY_IR_DEFINITION',
    definition_digest:
      '3c57cdc2827cb7275fff90084f5c12d81311358bc2b2d13704f6823b14d4b7a1',
    error_code: 'INVALID_PRODUCT_QUERY_IR_CONTRACT_INPUT',
  }),
});

class ProductQueryContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductQueryContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductQueryContractInputError(code, message, details);
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
  const registered = PRODUCT_QUERY_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code || 'INVALID_PRODUCT_QUERY_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product query contract input', code);

  if (
    !registered
    || value.object_kind !== PRODUCT_QUERY_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_QUERY_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product query contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Product query contract definition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Product query contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProductQueryInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PRODUCT_QUERY_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PRODUCT_QUERY_CONTRACT_IDS,
    'Product query contract member set',
    'PRODUCT_QUERY_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  members.forEach(validateMember);
}

module.exports = {
  PRODUCT_QUERY_CONTRACT_DEFINITIONS,
  PRODUCT_QUERY_CONTRACT_IDS,
  PRODUCT_QUERY_CONTRACT_INPUT_KIND,
  PRODUCT_QUERY_CONTRACT_INPUT_SCHEMA,
  ProductQueryContractInputError,
  validateAuthoredProductQueryInputs,
};
