const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const AGREEMENT_CANDIDATE_ENVELOPE_KIND = 'PRODUCT_QUERY_CONTRACT_INPUT';
const AGREEMENT_CANDIDATE_ENVELOPE_SCHEMA = 'PRODUCT_QUERY_CONTRACT_INPUT/V1';
const AGREEMENT_CANDIDATE_ENVELOPE_ID = 'AGREEMENT_CANDIDATE_ENVELOPE';
const AGREEMENT_CANDIDATE_ENVELOPE_DEFINITION_DIGEST =
  '71e4ec4e55ff8ad86c4125d58f4aa6aef79917d5a1abd885f570f564ce608484';

function fail(message) {
  const error = new TypeError(message);
  error.code = 'INVALID_AGREEMENT_CANDIDATE_ENVELOPE_CONTRACT_INPUT';
  throw error;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())) {
    fail(`${label} fields do not match the closed contract`);
  }
}

function validateAuthoredAgreementCandidateEnvelopeInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === AGREEMENT_CANDIDATE_ENVELOPE_KIND
      && member?.canonical_value?.stable_id
        === AGREEMENT_CANDIDATE_ENVELOPE_ID,
  );
  if (members.length !== 1) {
    fail('the Agreement candidate-envelope contract member is missing or duplicated');
  }
  const value = members[0].canonical_value;
  exactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Agreement candidate-envelope contract');
  if (
    value.object_kind !== AGREEMENT_CANDIDATE_ENVELOPE_KIND
    || value.stable_id !== AGREEMENT_CANDIDATE_ENVELOPE_ID
    || value.schema_version !== AGREEMENT_CANDIDATE_ENVELOPE_SCHEMA
    || value.definition?.domain_key !== 'PRODUCT'
    || value.definition?.contract_type !== 'AGREEMENT_CANDIDATE_ENVELOPE'
    || value.definition?.contract_version !== 1
  ) {
    fail('the Agreement candidate-envelope contract identity is not governed');
  }
  const digest = sha256Hex(Buffer.from(
    canonicalJson(value.definition),
    'utf8',
  ));
  if (digest !== AGREEMENT_CANDIDATE_ENVELOPE_DEFINITION_DIGEST) {
    fail('the Agreement candidate-envelope definition has changed');
  }
  return true;
}

module.exports = {
  AGREEMENT_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  AGREEMENT_CANDIDATE_ENVELOPE_ID,
  AGREEMENT_CANDIDATE_ENVELOPE_KIND,
  AGREEMENT_CANDIDATE_ENVELOPE_SCHEMA,
  validateAuthoredAgreementCandidateEnvelopeInputs,
};
