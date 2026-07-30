const { canonicalJson, sha256Hex } = require('./canonical-bytes');
const {
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_SCHEMA,
  validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs,
} = require('./qxo-capitalisation-f28-candidate-envelope-contract-input-validator');

const QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND =
  'PRODUCT_QUERY_RESULT_CONTRACT_INPUT';
const QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_SCHEMA =
  'PRODUCT_QUERY_RESULT_CONTRACT_INPUT/V1';
const QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_ID =
  'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2';
const QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_DEFINITION_DIGEST =
  'abac432011acccc930a67979e8c788fe545db0979b720aae5e1db7a3d92eae76';

class QxoCapitalisationF28ProductResultAdapterV2ContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QxoCapitalisationF28ProductResultAdapterV2ContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new QxoCapitalisationF28ProductResultAdapterV2ContractInputError(
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

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function requireFalseAuthority(value, label, code) {
  requireObject(value, label, code);
  if (
    value.authority_state !== 'NONE'
    || Object.entries(value).some(
      ([key, entry]) => key !== 'authority_state' && entry !== false,
    )
  ) {
    fail(code, `${label} cannot grant authority.`);
  }
}

function validateDefinition(definition, code) {
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'lifecycle_contract',
    'candidate_envelope_dependency',
    'product_query_ir_binding_contract',
    'exact_row_preservation_contract',
    'surface_and_evidence_preservation_contract',
    'prohibited_state_contract',
    'authority_contract',
  ], 'Product adapter V2 definition', code);
  if (
    definition.domain_key !== 'PRODUCT'
    || definition.contract_type !== 'AGREEMENT_DOMAIN_RESULT_ADAPTER'
    || definition.contract_version !== 2
  ) fail(code, 'The Product adapter V2 contract identity is not governed.');

  requireExactKeys(definition.lifecycle_contract, [
    'lifecycle_state',
    'historical_v1_adapter_stable_id',
    'historical_v1_adapter_contract_version',
    'historical_v1_adapter_may_authorise_envelope_materialisation',
    'product_materialisation_requires_this_successor',
    'this_contract_is_not_a_materialisation_authority',
  ], 'Lifecycle contract', code);
  if (
    definition.lifecycle_contract.lifecycle_state
      !== 'ADDITIVE_SUCCESSOR_REQUIRED_FOR_ENVELOPE_MATERIALISATION'
    || definition.lifecycle_contract.historical_v1_adapter_stable_id
      !== 'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER'
    || definition.lifecycle_contract.historical_v1_adapter_contract_version !== 1
    || definition.lifecycle_contract.historical_v1_adapter_may_authorise_envelope_materialisation !== false
    || definition.lifecycle_contract.product_materialisation_requires_this_successor !== true
    || definition.lifecycle_contract.this_contract_is_not_a_materialisation_authority !== true
  ) fail(code, 'Product adapter V1 cannot authorise candidate-envelope materialisation.');

  requireExactKeys(definition.candidate_envelope_dependency, [
    'stable_id',
    'schema_version',
    'definition_digest',
    'candidate_membership_state',
    'full_definition_digest_required',
    'envelope_substitution_or_semantic_rehash_permitted',
  ], 'Candidate envelope dependency', code);
  if (
    definition.candidate_envelope_dependency.stable_id
      !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID
    || definition.candidate_envelope_dependency.schema_version
      !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_SCHEMA
    || definition.candidate_envelope_dependency.definition_digest
      !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST
    || definition.candidate_envelope_dependency.candidate_membership_state
      !== 'CANDIDATE_ENVELOPE_ONLY'
    || definition.candidate_envelope_dependency.full_definition_digest_required !== true
    || definition.candidate_envelope_dependency.envelope_substitution_or_semantic_rehash_permitted !== false
  ) fail(code, 'Product adapter V2 must bind the exact candidate envelope definition.');

  requireExactKeys(definition.product_query_ir_binding_contract, [
    'product_query_ir_schema_version',
    'candidate_release_manifest_id_source',
    'candidate_release_manifest_payload_digest_source',
    'candidate_release_manifest_id_must_equal_envelope_source_release_id',
    'candidate_release_manifest_payload_digest_must_equal_envelope_source_release_payload_digest',
    'old_cross_view_manifest_binding_permitted',
    'query_ir_can_substitute_or_rehash_candidate_manifest',
  ], 'Product Query IR binding contract', code);
  if (
    definition.product_query_ir_binding_contract.product_query_ir_schema_version
      !== 'PRODUCT_QUERY_IR/V1'
    || definition.product_query_ir_binding_contract.candidate_release_manifest_id_source
      !== 'CANDIDATE_ENVELOPE_SOURCE_CROSS_VIEW_RELEASE_ID'
    || definition.product_query_ir_binding_contract.candidate_release_manifest_payload_digest_source
      !== 'CANDIDATE_ENVELOPE_SOURCE_CROSS_VIEW_RELEASE_PAYLOAD_DIGEST'
    || definition.product_query_ir_binding_contract.candidate_release_manifest_id_must_equal_envelope_source_release_id !== true
    || definition.product_query_ir_binding_contract.candidate_release_manifest_payload_digest_must_equal_envelope_source_release_payload_digest !== true
    || definition.product_query_ir_binding_contract.old_cross_view_manifest_binding_permitted !== false
    || definition.product_query_ir_binding_contract.query_ir_can_substitute_or_rehash_candidate_manifest !== false
  ) fail(code, 'Product Query IR must bind the candidate envelope, not a cross-view manifest.');

  requireExactKeys(definition.exact_row_preservation_contract, [
    'domain_result_identity_source',
    'domain_result_payload_digest_source',
    'domain_result_identity_must_equal_envelope_provision_row_id',
    'domain_result_payload_must_equal_exact_envelope_row',
    'domain_result_payload_digest_must_equal_envelope_row_payload_digest',
    'exact_row_count',
    'ordered_terminal_count',
    'market_observation_count',
    'typed_exclusion_count',
    'terminal_order_is_immutable',
    'terminal_rehash_or_substitution_permitted',
  ], 'Exact row preservation contract', code);
  const row = definition.exact_row_preservation_contract;
  if (
    row.domain_result_identity_source !== 'CANDIDATE_ENVELOPE_PROVISION_ROW_ID'
    || row.domain_result_payload_digest_source !== 'CANDIDATE_ENVELOPE_PROVISION_ROW_PAYLOAD_DIGEST'
    || row.domain_result_identity_must_equal_envelope_provision_row_id !== true
    || row.domain_result_payload_must_equal_exact_envelope_row !== true
    || row.domain_result_payload_digest_must_equal_envelope_row_payload_digest !== true
    || row.exact_row_count !== 1
    || row.ordered_terminal_count !== 14
    || row.market_observation_count !== 13
    || row.typed_exclusion_count !== 1
    || row.terminal_order_is_immutable !== true
    || row.terminal_rehash_or_substitution_permitted !== false
  ) fail(code, 'Product adapter V2 must preserve the exact candidate-envelope row and terminal inventory.');

  requireExactKeys(definition.surface_and_evidence_preservation_contract, [
    'required_surfaces',
    'all_surfaces_use_exact_same_row',
    'required_subrow_count',
    'all_six_subrows_preserved',
    'all_subrow_evidence_preserved',
    'all_exact_detail_preserved',
    'all_metric_contexts_preserved',
    'required_metric_context_count',
    'source_lineage_preserved',
    'summary_or_tier_label_substitution_permitted',
  ], 'Surface and evidence preservation contract', code);
  const surfaces = definition.surface_and_evidence_preservation_contract;
  requireExactArray(surfaces.required_surfaces, [
    'COMPARE', 'CORPUS_CONTEXT', 'QUERY', 'REVIEW',
  ], 'Required Product surfaces', code);
  if (
    surfaces.all_surfaces_use_exact_same_row !== true
    || surfaces.required_subrow_count !== 6
    || surfaces.all_six_subrows_preserved !== true
    || surfaces.all_subrow_evidence_preserved !== true
    || surfaces.all_exact_detail_preserved !== true
    || surfaces.all_metric_contexts_preserved !== true
    || surfaces.required_metric_context_count !== 14
    || surfaces.source_lineage_preserved !== true
    || surfaces.summary_or_tier_label_substitution_permitted !== false
  ) fail(code, 'Product adapter V2 must preserve all surfaces, subrows, evidence, and metric contexts.');

  requireExactKeys(definition.prohibited_state_contract, [
    'adapter_can_manufacture_query_pass',
    'adapter_can_manufacture_cohort_pass',
    'adapter_can_manufacture_filter_pass',
    'adapter_can_manufacture_field_pass',
    'adapter_can_manufacture_membership_pass',
    'adapter_can_upgrade_candidate_envelope_to_materialised',
    'adapter_can_upgrade_inactive_candidate_to_active',
  ], 'Prohibited state contract', code);
  if (Object.values(definition.prohibited_state_contract).some((value) => value !== false)) {
    fail(code, 'Product adapter V2 cannot manufacture Product pass or materialisation state.');
  }

  requireExactKeys(definition.authority_contract, [
    'authority_state',
    'creates_runtime_result',
    'creates_execution_authority',
    'creates_import_authority',
    'creates_query_authority',
    'creates_serving_authority',
    'creates_writer_authority',
    'creates_database_authority',
    'creates_activation_authority',
    'creates_materialisation_authority',
    'creates_release_authority',
    'creates_production_authority',
    'creates_contract_freeze_authority',
  ], 'Authority contract', code);
  requireFalseAuthority(definition.authority_contract, 'Product adapter V2 authority contract', code);
}

function validateV2Member(member, code) {
  requireObject(member, 'Product adapter V2 contract member', code);
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind', 'stable_id', 'schema_version', 'definition',
  ], 'Product adapter V2 contract input', code);
  if (
    member.object_kind !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND
    || value.object_kind !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND
    || value.stable_id !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_ID
    || value.schema_version !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_SCHEMA
  ) fail(code, 'Product adapter V2 contract identity is not registered.');
  validateDefinition(value.definition, code);
  const actualDigest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
  if (actualDigest !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_DEFINITION_DIGEST) {
    fail(code, 'Product adapter V2 does not match its complete governed definition.', {
      expected_definition_digest: QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_DEFINITION_DIGEST,
      actual_definition_digest: actualDigest,
    });
  }
}

function validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) throw new TypeError('authoredMembers must be an array');
  const code = 'INVALID_QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_CONTRACT_INPUT';
  const adapters = authoredMembers.filter(
    (member) => member?.object_kind === QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND,
  );
  if (adapters.length !== 1) {
    fail(code, 'Exactly one Product adapter V2 contract member is required.');
  }
  const envelopes = authoredMembers.filter(
    (member) => member?.object_kind === QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND,
  );
  if (envelopes.length !== 1 || envelopes[0]?.canonical_value?.stable_id !== QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_ID) {
    fail(code, 'Product adapter V2 requires exactly one exact candidate-envelope dependency.');
  }
  try {
    validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs(envelopes);
  } catch (error) {
    fail(code, 'The Product adapter V2 candidate-envelope dependency is invalid.', {
      cause: error.code || error.message,
    });
  }
  validateV2Member(adapters[0], code);
}

module.exports = {
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_DEFINITION_DIGEST,
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_ID,
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND,
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_SCHEMA,
  QxoCapitalisationF28ProductResultAdapterV2ContractInputError,
  validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs,
};
