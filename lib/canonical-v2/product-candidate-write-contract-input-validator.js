const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_KIND =
  'PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT';
const PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_SCHEMA =
  'PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT/V1';
const PRODUCT_CANDIDATE_WRITE_CONTRACT_IDS = Object.freeze([
  'PRODUCT_CANDIDATE_RESULT_WRITER',
]);

const DEFINITION_DIGEST =
  'e4a5c302a9814ad0b0e43da9d4c89695b4093391888a4223832ca5a8138e6b94';

class ProductCandidateWriteContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductCandidateWriteContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductCandidateWriteContractInputError(
    code,
    message,
    details,
  );
}

function validateAuthoredProductCandidateWriteInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind
      === PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;
  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (canonicalJson(stableIds)
    !== canonicalJson(PRODUCT_CANDIDATE_WRITE_CONTRACT_IDS)) {
    fail(
      'PRODUCT_CANDIDATE_WRITE_CONTRACT_MEMBERSHIP_MISMATCH',
      'The Product candidate-write contract member set is not closed.',
    );
  }
  const value = members[0].canonical_value;
  if (
    canonicalJson(Object.keys(value || {}).sort())
      !== canonicalJson([
        'definition',
        'object_kind',
        'schema_version',
        'stable_id',
      ])
    || value.object_kind !== PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_KIND
    || value.schema_version !== PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_SCHEMA
    || value.stable_id !== PRODUCT_CANDIDATE_WRITE_CONTRACT_IDS[0]
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== 'CANDIDATE_RESULT_WRITER'
    || value.definition?.contract_version !== 1
  ) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT',
      'The Product candidate-write contract identity is invalid.',
    );
  }
  const digest = sha256Hex(Buffer.from(
    canonicalJson(value.definition),
    'utf8',
  ));
  if (digest !== DEFINITION_DIGEST) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT',
      'The Product candidate-write contract meaning changed.',
      { expected: DEFINITION_DIGEST, actual: digest },
    );
  }
}

module.exports = {
  PRODUCT_CANDIDATE_WRITE_CONTRACT_IDS,
  PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_KIND,
  PRODUCT_CANDIDATE_WRITE_CONTRACT_INPUT_SCHEMA,
  ProductCandidateWriteContractInputError,
  validateAuthoredProductCandidateWriteInputs,
};
