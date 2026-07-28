const NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND = 'NO_SHOP_SEMANTIC_SCHEMA_INPUT';
const NO_SHOP_SEMANTIC_SCHEMA_INPUT_VERSION = 'NO_SHOP_SEMANTIC_SCHEMA_INPUT/V1';

class CanonicalContractNoShopSchemaInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractNoShopSchemaInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, details = {}) {
  throw new CanonicalContractNoShopSchemaInputError(
    'INVALID_CANONICAL_BUNDLE_NO_SHOP_SEMANTIC_SCHEMA_INPUT',
    message,
    details,
  );
}

function validateNoShopSemanticSchemaInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('No-shop semantic schema input must be an object.');
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [
    'authored_schema',
    'object_kind',
    'schema_version',
    'stable_id',
  ];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    fail('No-shop semantic schema input fields do not match the authored contract.', {
      actual: actualKeys,
      expected: expectedKeys,
    });
  }
  const authoredSchema = value.authored_schema;
  if (
    value.object_kind !== NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND
    || value.schema_version !== NO_SHOP_SEMANTIC_SCHEMA_INPUT_VERSION
    || !authoredSchema
    || typeof authoredSchema !== 'object'
    || Array.isArray(authoredSchema)
    || typeof authoredSchema.schema_key !== 'string'
    || authoredSchema.schema_key.length === 0
    || value.stable_id !== authoredSchema.schema_key
    || !Number.isSafeInteger(authoredSchema.schema_version)
    || authoredSchema.schema_version < 1
  ) {
    fail('No-shop semantic schema input does not match the authored envelope.', {
      stable_id: value.stable_id ?? null,
    });
  }
}

function validateAuthoredNoShopSchemaInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  for (const member of authoredMembers) {
    if (member?.object_kind === NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND) {
      validateNoShopSemanticSchemaInput(member.canonical_value);
    }
  }
}

module.exports = {
  NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND,
  NO_SHOP_SEMANTIC_SCHEMA_INPUT_VERSION,
  CanonicalContractNoShopSchemaInputError,
  validateAuthoredNoShopSchemaInputs,
};
