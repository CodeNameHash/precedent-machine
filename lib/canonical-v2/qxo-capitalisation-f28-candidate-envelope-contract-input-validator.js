const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND =
  'PRODUCT_QUERY_CONTRACT_INPUT';
const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_SCHEMA =
  'PRODUCT_QUERY_CONTRACT_INPUT/V1';
const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID =
  'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE';
const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST =
  '05217faf3bdae80fa666929d3e48f419bfe5299abc9ea296fe705678a1011cc2';
const SHA256_RE = /^[a-f0-9]{64}$/;

class QxoCapitalisationF28CandidateEnvelopeContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QxoCapitalisationF28CandidateEnvelopeContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new QxoCapitalisationF28CandidateEnvelopeContractInputError(
    code, message, details,
  );
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

function requireDigest(value, label, code) {
  if (!SHA256_RE.test(value)) fail(code, `${label} must be a SHA-256 digest.`);
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function validateDefinition(value, code) {
  requireExactKeys(value, [
    'domain_key',
    'contract_type',
    'contract_version',
    'candidate_envelope_contract',
  ], 'Candidate envelope definition', code);
  if (
    value.domain_key !== 'PRODUCT'
    || value.contract_type !== 'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE'
    || value.contract_version !== 1
  ) {
    fail(code, 'The candidate envelope contract identity is not governed.');
  }
  const envelope = value.candidate_envelope_contract;
  requireExactKeys(envelope, [
    'source_cross_view_release',
    'provision_row',
    'ordered_terminals',
    'terminal_count_contract',
    'preservation_contract',
    'product_membership',
    'successor_adapter_requirement',
    'authority',
  ], 'Candidate envelope definition', code);
  requireExactKeys(envelope.source_cross_view_release, [
    'schema_version', 'release_id', 'release_payload_digest',
  ], 'Cross-view release binding', code);
  requireExactKeys(envelope.provision_row, [
    'schema_version', 'provision_row_id', 'provision_row_payload_digest',
  ], 'Provision row binding', code);
  requireDigest(envelope.source_cross_view_release.release_id, 'Cross-view release ID', code);
  requireDigest(envelope.source_cross_view_release.release_payload_digest, 'Cross-view release payload digest', code);
  requireDigest(envelope.provision_row.provision_row_id, 'Provision row ID', code);
  requireDigest(envelope.provision_row.provision_row_payload_digest, 'Provision row payload digest', code);
  const terminals = envelope.ordered_terminals;
  if (!Array.isArray(terminals) || terminals.length !== 14) {
    fail(code, 'Candidate envelope must bind exactly fourteen terminals.');
  }
  const terminalIds = new Set();
  const subjectIds = new Set();
  let observationCount = 0;
  let exclusionCount = 0;
  terminals.forEach((terminal, ordinal) => {
    requireExactKeys(terminal, [
      'ordinal',
      'terminal_id',
      'terminal_payload_digest',
      'subject_terminal_kind',
      'subject_terminal_id',
      'subject_terminal_payload_digest',
    ], `Terminal ${ordinal}`, code);
    if (terminal.ordinal !== ordinal) fail(code, 'Candidate envelope terminal order has drifted.');
    requireDigest(terminal.terminal_id, `Terminal ${ordinal} ID`, code);
    requireDigest(terminal.terminal_payload_digest, `Terminal ${ordinal} payload digest`, code);
    requireDigest(terminal.subject_terminal_id, `Terminal ${ordinal} subject ID`, code);
    requireDigest(terminal.subject_terminal_payload_digest, `Terminal ${ordinal} subject payload digest`, code);
    if (terminalIds.has(terminal.terminal_id) || subjectIds.has(terminal.subject_terminal_id)) {
      fail(code, 'Candidate envelope terminal identities must be unique.');
    }
    terminalIds.add(terminal.terminal_id);
    subjectIds.add(terminal.subject_terminal_id);
    if (terminal.subject_terminal_kind === 'MARKET_OBSERVATION') observationCount += 1;
    else if (terminal.subject_terminal_kind === 'MARKET_METRIC_SLOT_EXCLUSION') exclusionCount += 1;
    else fail(code, 'Candidate envelope terminal has an unsupported subject type.');
  });
  requireExactKeys(envelope.terminal_count_contract, [
    'terminal_count',
    'market_observation_count',
    'typed_exclusion_count',
    'terminal_order_is_immutable',
    'terminal_ids_are_unique',
  ], 'Terminal count contract', code);
  if (
    envelope.terminal_count_contract.terminal_count !== 14
    || envelope.terminal_count_contract.market_observation_count !== 13
    || envelope.terminal_count_contract.typed_exclusion_count !== 1
    || envelope.terminal_count_contract.terminal_order_is_immutable !== true
    || envelope.terminal_count_contract.terminal_ids_are_unique !== true
    || observationCount !== 13
    || exclusionCount !== 1
  ) fail(code, 'Candidate envelope must contain thirteen observations and one typed exclusion.');
  requireExactKeys(envelope.preservation_contract, [
    'all_f28_metric_subrow_evidence_bytes_preserved',
    'row_digest_covers_all_metric_subrows_and_evidence',
    'terminal_digest_covers_each_terminal_payload',
    'semantic_rehash_or_substitution_permitted',
  ], 'Preservation contract', code);
  if (
    envelope.preservation_contract.all_f28_metric_subrow_evidence_bytes_preserved !== true
    || envelope.preservation_contract.row_digest_covers_all_metric_subrows_and_evidence !== true
    || envelope.preservation_contract.terminal_digest_covers_each_terminal_payload !== true
    || envelope.preservation_contract.semantic_rehash_or_substitution_permitted !== false
  ) fail(code, 'Candidate envelope must preserve the authoritative F28 bytes.');
  requireExactKeys(envelope.product_membership, [
    'domain_key',
    'result_definition_stable_id',
    'result_definition_version',
    'domain_result_identity',
    'domain_result_payload_digest',
    'membership_state',
  ], 'Product membership', code);
  if (
    envelope.product_membership.domain_key !== 'AGREEMENT'
    || envelope.product_membership.result_definition_stable_id !== 'TARGET_CAPITALISATION_BRING_DOWN'
    || envelope.product_membership.result_definition_version !== 3
    || envelope.product_membership.domain_result_identity !== envelope.provision_row.provision_row_id
    || envelope.product_membership.domain_result_payload_digest
      !== envelope.provision_row.provision_row_payload_digest
    || envelope.product_membership.membership_state !== 'CANDIDATE_ENVELOPE_ONLY'
  ) fail(code, 'Candidate envelope Product membership has drifted.');
  requireExactKeys(envelope.successor_adapter_requirement, [
    'required_successor_stable_id',
    'required_successor_contract_version',
    'require_additive_successor_before_product_materialisation',
    'signed_v1_adapter_is_envelope_authority',
  ], 'Successor adapter requirement', code);
  if (
    envelope.successor_adapter_requirement.required_successor_stable_id
      !== 'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2'
    || envelope.successor_adapter_requirement.required_successor_contract_version !== 2
    || envelope.successor_adapter_requirement.require_additive_successor_before_product_materialisation !== true
    || envelope.successor_adapter_requirement.signed_v1_adapter_is_envelope_authority !== false
  ) fail(code, 'Candidate envelope requires the additive Product adapter V2.');
  requireExactKeys(envelope.authority, [
    'authority_state',
    'creates_materialisation_authority',
    'creates_import_authority',
    'creates_query_authority',
    'creates_serving_authority',
    'creates_activation_authority',
    'creates_database_authority',
    'creates_writer_authority',
  ], 'Candidate envelope authority', code);
  if (
    envelope.authority.authority_state !== 'NONE'
    || Object.entries(envelope.authority).some(([key, entry]) => key !== 'authority_state' && entry !== false)
  ) fail(code, 'Candidate envelope cannot grant authority.');
}

function validateMember(member) {
  const code = 'INVALID_QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_CONTRACT_INPUT';
  requireObject(member, 'Candidate envelope contract member', code);
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind', 'stable_id', 'schema_version', 'definition',
  ], 'Candidate envelope contract input', code);
  if (
    member.object_kind !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND
    || value.object_kind !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND
    || value.stable_id !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID
    || value.schema_version !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_SCHEMA
  ) fail(code, 'Candidate envelope contract identity is not registered.');
  validateDefinition(value.definition, code);
  const digest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
  if (digest !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST) {
    fail(code, 'Candidate envelope definition does not match its complete governed definition.', {
      expected_definition_digest: QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
      actual_definition_digest: digest,
    });
  }
}

function validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) throw new TypeError('authoredMembers must be an array');
  const members = authoredMembers.filter(
    (member) => member?.object_kind === QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND,
  );
  const stableIds = members.map((member) => member.canonical_value?.stable_id).sort();
  requireExactArray(stableIds, [QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID], 'Candidate envelope contract member set', 'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_MEMBERSHIP_MISMATCH');
  validateMember(members[0]);
}

module.exports = {
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_SCHEMA,
  QxoCapitalisationF28CandidateEnvelopeContractInputError,
  validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs,
};
