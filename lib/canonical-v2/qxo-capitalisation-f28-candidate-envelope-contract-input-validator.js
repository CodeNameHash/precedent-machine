const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND =
  'PRODUCT_QUERY_CONTRACT_INPUT';
const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_SCHEMA =
  'PRODUCT_QUERY_CONTRACT_INPUT/V1';
const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID =
  'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE';
const QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST =
  'dd880a25e999eb638a75d12ff9a017a22e5bec5875ae22321379417bcf210330';
const SHA256_RE = /^[a-f0-9]{64}$/;
const TERMINAL_IDENTITY_INPUTS = Object.freeze([
  'ordinal',
  'subject_terminal_kind',
  'subject_terminal_id',
  'subject_terminal_payload_digest',
]);
const ORDERED_METRIC_SLOTS = Object.freeze([
  [0, 'REPRESENTATION_ACCURACY_STANDARD', 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', 'MARKET_OBSERVATION'],
  [1, 'REPRESENTATION_ACCURACY_EXCEPTION', 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', 'MARKET_OBSERVATION'],
  [2, 'REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR', 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', 'MARKET_OBSERVATION'],
  [3, 'DATED_REPRESENTATION_TREATMENT', 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', 'MARKET_OBSERVATION'],
  [4, 'REPRESENTATION_MATERIALITY_SCRAPE', 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', 'MARKET_OBSERVATION'],
  [5, 'REPRESENTATION_ACCURACY_STANDARD', 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', 'MARKET_OBSERVATION'],
  [6, 'REPRESENTATION_ACCURACY_EXCEPTION', 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', 'MARKET_OBSERVATION'],
  [7, 'REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR', 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', 'MARKET_METRIC_SLOT_EXCLUSION'],
  [8, 'DATED_REPRESENTATION_TREATMENT', 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', 'MARKET_OBSERVATION'],
  [9, 'REPRESENTATION_MATERIALITY_SCRAPE', 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', 'MARKET_OBSERVATION'],
  [10, 'REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET', 'CAPITALISATION_MEASUREMENT_DATE', 'MARKET_OBSERVATION'],
  [11, 'KNOWLEDGE_QUALIFIER_STATE', 'GENERAL_KNOWLEDGE_QUALIFIER', 'MARKET_OBSERVATION'],
  [12, 'GENERAL_MATERIALITY_QUALIFIER_STATE', 'GENERAL_MATERIALITY_QUALIFIER', 'MARKET_OBSERVATION'],
  [13, 'RETROSPECTIVE_LOOKBACK_STATE', 'RETROSPECTIVE_LOOKBACK', 'MARKET_OBSERVATION'],
]);

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
    'schema_version',
    'release_validation_required',
    'release_id_source',
    'release_payload_digest_source',
    'unvalidated_source_substitution_permitted',
  ], 'Cross-view release binding', code);
  requireExactKeys(envelope.provision_row, [
    'schema_version',
    'provision_row_id_source',
    'provision_row_payload_digest_source',
    'row_substitution_or_rehash_permitted',
  ], 'Provision row binding', code);
  if (
    envelope.source_cross_view_release.schema_version
      !== 'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1'
    || envelope.source_cross_view_release.release_validation_required !== true
    || envelope.source_cross_view_release.release_id_source
      !== 'VALIDATED_F28_RELEASE_ID'
    || envelope.source_cross_view_release.release_payload_digest_source
      !== 'VALIDATED_F28_RELEASE_CANONICAL_PAYLOAD_DIGEST'
    || envelope.source_cross_view_release
      .unvalidated_source_substitution_permitted !== false
    || envelope.provision_row.schema_version
      !== 'CAPITALISATION_SHARED_PROVISION_ROW_F28/V1'
    || envelope.provision_row.provision_row_id_source
      !== 'VALIDATED_F28_RELEASE_PROVISION_ROW_ID'
    || envelope.provision_row.provision_row_payload_digest_source
      !== 'VALIDATED_F28_RELEASE_PROVISION_ROW_CANONICAL_PAYLOAD_DIGEST'
    || envelope.provision_row.row_substitution_or_rehash_permitted !== false
  ) fail(code, 'Candidate envelope must derive from one validated F28 release.');
  const terminals = envelope.ordered_terminals;
  requireExactKeys(terminals, [
    'terminal_schema_version',
    'terminal_identity_domain',
    'terminal_identity_inputs',
    'terminal_payload_digest_inputs',
    'source_order',
    'subject_terminal_id_source',
    'subject_terminal_payload_digest_source',
    'ordered_metric_slots',
  ], 'Ordered terminal projection', code);
  if (
    terminals.terminal_schema_version
      !== 'QXO_CAPITALISATION_F28_CANDIDATE_TERMINAL/V1'
    || terminals.terminal_identity_domain
      !== 'QXO_CAPITALISATION_F28_CANDIDATE_TERMINAL/V1'
    || canonicalJson(terminals.terminal_identity_inputs)
      !== canonicalJson(TERMINAL_IDENTITY_INPUTS)
    || canonicalJson(terminals.terminal_payload_digest_inputs)
      !== canonicalJson(TERMINAL_IDENTITY_INPUTS)
    || terminals.source_order !== 'VALIDATED_F28_RELEASE_ADMISSION_ORDER'
    || terminals.subject_terminal_id_source
      !== 'VALIDATED_F28_RELEASE_OBSERVATION_OR_TYPED_EXCLUSION_ID'
    || terminals.subject_terminal_payload_digest_source
      !== 'CANONICAL_SUBJECT_TERMINAL_PAYLOAD_DIGEST'
    || !Array.isArray(terminals.ordered_metric_slots)
    || terminals.ordered_metric_slots.length !== 14
  ) fail(code, 'Candidate envelope terminal projection has drifted.');
  let observationCount = 0;
  let exclusionCount = 0;
  terminals.ordered_metric_slots.forEach((terminal, ordinal) => {
    requireExactKeys(terminal, [
      'ordinal',
      'metric_key',
      'value_slot_key',
      'subject_terminal_kind',
    ], `Terminal ${ordinal}`, code);
    if (canonicalJson([
      terminal.ordinal,
      terminal.metric_key,
      terminal.value_slot_key,
      terminal.subject_terminal_kind,
    ]) !== canonicalJson(ORDERED_METRIC_SLOTS[ordinal])) {
      fail(code, 'Candidate envelope terminal order or legal metric has drifted.');
    }
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
    'domain_result_identity_source',
    'domain_result_payload_digest_source',
    'membership_state',
  ], 'Product membership', code);
  if (
    envelope.product_membership.domain_key !== 'AGREEMENT'
    || envelope.product_membership.result_definition_stable_id !== 'TARGET_CAPITALISATION_BRING_DOWN'
    || envelope.product_membership.result_definition_version !== 3
    || envelope.product_membership.domain_result_identity_source
      !== 'VALIDATED_F28_RELEASE_PROVISION_ROW_ID'
    || envelope.product_membership.domain_result_payload_digest_source
      !== 'VALIDATED_F28_RELEASE_PROVISION_ROW_CANONICAL_PAYLOAD_DIGEST'
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
