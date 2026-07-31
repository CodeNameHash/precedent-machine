const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT_KIND =
  'PRODUCT_QUERY_CONTRACT_INPUT';
const PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_QUERY_CONTRACT_INPUT/V1';
const PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_STABLE_ID =
  'PRODUCT_RESULT_SURFACE_BINDING';
const PRODUCT_RESULT_SURFACE_BINDING_DEFINITION_DIGEST =
  '68e9d3155e10966b87646d4ded888dfd7eea12d579660932af17527eb71e7779';

class ProductResultSurfaceBindingContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductResultSurfaceBindingContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductResultSurfaceBindingContractInputError(
    code,
    message,
    details,
  );
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

function validateProductResultSurfaceBindingContractInput(member) {
  const code = 'INVALID_PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT';
  const value = member?.canonical_value || member;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Product result-surface binding contract input', code);
  if (
    value.object_kind !== PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT_KIND
    || value.stable_id !== PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_STABLE_ID
    || value.schema_version
      !== PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== 'RESULT_SURFACE_BINDING'
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Product result-surface binding identity is invalid.');
  }
  const digest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
  if (digest !== PRODUCT_RESULT_SURFACE_BINDING_DEFINITION_DIGEST) {
    fail(code, 'The Product result-surface binding definition has changed.', {
      expected_definition_digest:
        PRODUCT_RESULT_SURFACE_BINDING_DEFINITION_DIGEST,
      actual_definition_digest: digest,
    });
  }
  return true;
}

module.exports = {
  PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT_KIND,
  PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT_SCHEMA,
  PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_STABLE_ID,
  PRODUCT_RESULT_SURFACE_BINDING_DEFINITION_DIGEST,
  ProductResultSurfaceBindingContractInputError,
  validateProductResultSurfaceBindingContractInput,
};
