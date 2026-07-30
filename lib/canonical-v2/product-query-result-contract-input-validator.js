const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_QUERY_RESULT_CONTRACT_INPUT_KIND =
  'PRODUCT_QUERY_RESULT_CONTRACT_INPUT';
const PRODUCT_QUERY_RESULT_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_QUERY_RESULT_CONTRACT_INPUT/V1';
const PRODUCT_QUERY_RESULT_CONTRACT_IDS = Object.freeze([
  'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER',
  'PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER',
  'PRODUCT_QUERY_RESULT_DEFINITION',
  'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
]);
const PRODUCT_QUERY_RESULT_CONTRACT_DEFINITIONS = Object.freeze({
  PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER: Object.freeze({
    contract_type: 'PROCESS_DOMAIN_RESULT_ADAPTER',
    definition_digest:
      'ee3962525beb6cb2a73091b92e3bb691aed1656e5f61eb79aa03467034e7af0e',
    error_code:
      'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_INPUT',
  }),
  PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER: Object.freeze({
    contract_type: 'PROCESS_DOMAIN_RESULT_SET_ADAPTER',
    definition_digest:
      'c5445c529c6c7845c594cca65521aad502c7e1e48cc027cc18be407e976ab551',
    error_code:
      'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_INPUT',
  }),
  PRODUCT_QUERY_RESULT_DEFINITION: Object.freeze({
    contract_type: 'QUERY_RESULT_DEFINITION',
    definition_digest:
      '4618321afa3b47aa342eb283d8e6a1308b6acc4feff9aca0030eb6cdf9008156',
    error_code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT',
  }),
  QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER: Object.freeze({
    contract_type: 'AGREEMENT_DOMAIN_RESULT_ADAPTER',
    definition_digest:
      'bea2423aca061913ff5601b4efb03041112defbdf317ae81dcaad64f6f9c973e',
    error_code:
      'INVALID_QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_INPUT',
  }),
});

class ProductQueryResultContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductQueryResultContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductQueryResultContractInputError(code, message, details);
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
  const registered = PRODUCT_QUERY_RESULT_CONTRACT_DEFINITIONS[stableId];
  const code = registered?.error_code
    || 'INVALID_PRODUCT_QUERY_RESULT_CONTRACT_INPUT';

  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product query-result contract input', code);

  if (
    !registered
    || value.object_kind !== PRODUCT_QUERY_RESULT_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_QUERY_RESULT_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product query-result contract identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.definition), 'utf8'),
    );
  } catch (error) {
    fail(
      code,
      'The Product query-result contract definition is not canonical JSON.',
      { cause: error.message },
    );
  }
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The Product query-result contract does not match its complete governed definition.',
      {
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredProductQueryResultInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === PRODUCT_QUERY_RESULT_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PRODUCT_QUERY_RESULT_CONTRACT_IDS,
    'Product query-result contract member set',
    'PRODUCT_QUERY_RESULT_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  members.forEach(validateMember);
}

module.exports = {
  PRODUCT_QUERY_RESULT_CONTRACT_DEFINITIONS,
  PRODUCT_QUERY_RESULT_CONTRACT_IDS,
  PRODUCT_QUERY_RESULT_CONTRACT_INPUT_KIND,
  PRODUCT_QUERY_RESULT_CONTRACT_INPUT_SCHEMA,
  ProductQueryResultContractInputError,
  validateAuthoredProductQueryResultInputs,
};
