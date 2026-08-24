'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileSyntheticProfileExpression,
} = require('../lib/canonical-v2/m7-v2-deterministic-generator');
const {
  validateSyntheticExpressionEvidence,
} = require('../lib/canonical-v2/m7-v2-contract');
const profileAuthoring = require('../lib/canonical-v2/m7-v2-profile-authoring');

const REPO_ROOT = join(__dirname, '..');
const C3_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';
const TERMINATION_PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'termination_authoring_phase2_authority_id',
  record_id: 'df1e3d4711e1b2fca09ea681e43db19a6b7cbfe1055e6a57c3ea48b2f588bf15',
  byte_length: 787442,
  sha256: '897022076002dc07d16d7a60071dd932c829428fe0763d42d9b70fd1b21055cb',
});
const TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-review-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_REVIEW_AUTHORITY/V1',
  record_id_field: 'termination_authoring_phase3_reference_review_authority_id',
  record_id: 'd466e16fb7fcd505028915490dfb9faf763e520c3b41dc8ed0eb13c9f39b9187',
  byte_length: 257497,
  sha256: 'd890455c92915f086ce7638c4604d9ad9f767ec3c69826d0b299ba0ff35d940a',
});
const TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-target-evidence-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_target_evidence_authority_id',
  record_id: '5561951e4aa04b5abb34ec1de169d8b85f1117277511e2cd506d9a364d390bfa',
  byte_length: 266529,
  sha256: '1ac96462036fbaadab74f6808706b6e96db7feff75a4ab4430538133a83717c4',
});
const TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-source-normaliser-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_source_normaliser_authority_id',
  record_id: 'e0f0848b106d06a35d341a2359a9bf6494ebd0930ea1f28cef82221c62b901f0',
  byte_length: 151288,
  sha256: '9127af004564fc4a2cc21ffb09ebd71e022780c8fc5beeec6538fcb1273fb26a',
});
const TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-edge-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_edge_value_authority_id',
  record_id: '59121d8247deab7b687e08d7e214c40010ce95cedf69933e4f6cbba4a1c8db73',
  byte_length: 72911,
  sha256: 'ec0060d8e05393a757957385694a2cf60a7bd8b6b367f9f1a461b651511d220e',
});
const TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-linked-rule-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_linked_rule_reference_value_authority_id',
  record_id: 'c81adc75621a0803d7d6b77c6e24a7d31fcb68f4dfb8e277662f7c14c223f132',
  byte_length: 89096,
  sha256: 'e688564c3c12d27d1c06f10d2fcb0c8ff250c942add02bee63682a877a0ca560',
});
const TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-raw-m2-reference-owner-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_raw_m2_reference_owner_value_authority_id',
  record_id: '2c0ddcf958608fd29af0a3b8e25bb3df2a970e91a30b5131c8a7b475e10d5922',
  byte_length: 87185,
  sha256: '54f3d78528357ff839b7d011358868d3fcf53c1cd91bb090b5f574b5f9ed7b2f',
});
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-source-occurrence-self-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_source_occurrence_self_reference_value_authority_id',
  record_id: '70ec2fb9a7b0e4c0346d9f7ee4549bf3c7dc6d4d5f1764d4bfe77a48cf7f3a7e',
  byte_length: 99021,
  sha256: '76b407edb52e510b918e9eeceb6d31f3dd1ad4344b15264ff7356993c7f9c94f',
});
const TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-agreement-date-source-pair-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_agreement_date_source_pair_reference_value_authority_id',
  record_id: '7a12c30c856c4b70552dcd649b759baeeb857386d0827626e3a63cb9f6ff874a',
  byte_length: 63778,
  sha256: '8444a80d040d773fa200a3d590179b73947516d4cbc4b90c8ac943f95d74eb55',
});
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-company-stockholders-meeting-event-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_company_stockholders_meeting_event_reference_value_authority_id',
  record_id: 'fa6f5fe95a168261cc2a42a8fc86eece406a0a034aeb4f802e23e2333d02f451',
  byte_length: 118849,
  sha256: '176c09fea829c7395573b4fe5dcd4bd07d78ce83cb34d9791b98aaf0d2760411',
});
const TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-red-hat-company-letter-section-6-01-c-source-discovery-frontier-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RED_HAT_COMPANY_LETTER_SECTION_6_01_C_SOURCE_DISCOVERY_FRONTIER_AUTHORITY/V3',
  record_id_field:
    'termination_authoring_phase3_red_hat_company_letter_section_6_01_c_source_discovery_frontier_authority_id',
  record_id: '692f3eae2f160c48a0f8ac624498cc18f2ee0731e49c0fbf2c09f56c5310aa5f',
  byte_length: 326103,
  sha256: 'b479b305775e4a165769311bd37bdc5c4421cb9e0bfced3baab7cdd977d11712',
});
const TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-value-materialisation-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_value_materialisation_authority_id',
  record_id: '7b76d93eb880e4dd5eaeae65829d1059b3a5fb19ef12fc7b45fa179e416c6126',
  byte_length: 300160,
  sha256: '3d16169299072a2a3e8485bc51084fe17172edbf98fba350fe5164d21d540156',
});
const TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'raw_m2_reference_owner_value_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'phase3_source_normaliser_authority_binding',
  'phase3_reference_edge_value_authority_binding',
  'phase3_linked_rule_reference_value_authority_binding',
  'predecessor_linked_rule_reference_value_candidate_binding',
  'phase3_raw_m2_reference_owner_value_authority_binding',
  'raw_m2_reference_owner_value_accounting',
  'raw_m2_reference_owner_value_contract',
  'raw_m2_reference_owner_values',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_KEYS = Object.freeze([
  'agreement_id',
  'definition_source_support',
  'exact_raw_definition_occurrence',
  'exact_term',
  'field_key',
  'materialisation_state',
  'normalisation_proof',
  'normalisation_rule_id',
  'phase2_defined_term_or_reference_dependencies',
  'profile_key',
  'proposed_reference_target_string',
  'raw_m2_reference_owner_target_string_review_id',
  'reference_slot_key',
  'repair_subclass',
  'resolved_same_term_m3_definition_edges',
  'source_normaliser_descriptor_id',
  'source_unit_key',
  'terminal_source_occurrence',
  'terminal_term_source_support',
  'value_type',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_RAW_M2_DEFINITION_OCCURRENCE_KEYS = Object.freeze([
  'definition_span',
  'definition_text',
  'm2_node',
]);
const TERMINATION_PHASE3_RAW_M2_TERMINAL_OCCURRENCE_KEYS = Object.freeze([
  'm2_node',
  'occurrence_span',
  'occurrence_text',
  'source_closure_role',
]);
const TERMINATION_PHASE3_RAW_M2_NORMALISATION_PROOF_KEYS = Object.freeze([
  'input_definition_source_span_ids',
  'input_terminal_term_source_span_ids',
  'result_digest',
  'rule_id',
]);
const TERMINATION_PHASE3_RAW_M2_DEFINED_TERM_DEPENDENCY_KEYS = Object.freeze([
  'field_key',
  'native_m3_definition_edge_id',
  'owner_node_occurrence_id',
  'resolution_state',
  'source_text',
]);
const TERMINATION_PHASE3_RAW_M2_EVENT_DEPENDENCY_KEYS = Object.freeze([
  'field_key',
  'graph_key',
  'native_m3_reference_edge_id',
  'resolution_state',
  'target_field_key',
  'target_kind',
  'target_node_occurrence_id',
]);
const TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_linked_rule_reference_value_count',
  'predecessor_remaining_source_normaliser_descriptor_count',
  'predecessor_remaining_source_admission_gap_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'raw_m2_reference_owner_value_count',
  'unique_raw_m2_reference_owner_review_id_count',
  'unique_raw_m2_reference_owner_reference_slot_count',
  'proposed_reference_target_string_count',
  'unique_proposed_reference_target_string_count',
  'raw_m2_reference_owner_normalisation_count',
  'unique_source_normaliser_descriptor_id_count',
  'raw_quoted_defined_term_owner_value_count',
  'event_boundary_defined_period_value_count',
  'unique_definition_source_support_id_count',
  'unique_terminal_term_source_support_id_count',
  'work3_fixture_consumable_reference_value_count',
  'remaining_source_normaliser_descriptor_count',
  'remaining_source_admission_gap_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'work3_normaliser_extension_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
  'family_package_count',
  'activation_count',
]);
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'source_occurrence_self_reference_value_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'phase3_source_normaliser_authority_binding',
  'phase3_reference_edge_value_authority_binding',
  'phase3_linked_rule_reference_value_authority_binding',
  'phase3_raw_m2_reference_owner_value_authority_binding',
  'predecessor_raw_m2_reference_owner_value_candidate_binding',
  'phase3_source_occurrence_self_reference_value_authority_binding',
  'source_occurrence_self_reference_value_accounting',
  'source_occurrence_self_reference_value_contract',
  'source_occurrence_self_reference_values',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_KEYS = Object.freeze([
  'agreement_id',
  'exact_same_field_phase2_dependencies',
  'exact_terminal_source_occurrence',
  'field_key',
  'materialisation_state',
  'normalisation_proof',
  'normalisation_rule_id',
  'occurrence_subclass',
  'profile_key',
  'projection_rule_needed',
  'proposed_reference_target_string',
  'reference_slot_key',
  'rejected_differently_named_owner_candidates',
  'source_normaliser_descriptor_id',
  'source_occurrence_self_reference_target_string_review_id',
  'source_support',
  'source_unit_key',
  'value_type',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_KEYS = Object.freeze([
  'm2_node',
  'occurrence_span',
  'occurrence_text',
  'source_closure_role',
]);
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_PROOF_KEYS = Object.freeze([
  'input_source_span_ids',
  'result_digest',
  'rule_id',
]);
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_DEPENDENCY_KEYS = Object.freeze([
  'field_key',
  'native_m3_definition_edge_id',
  'owner_node_occurrence_id',
  'resolution_state',
  'source_text',
]);
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_raw_m2_reference_owner_value_count',
  'predecessor_remaining_source_normaliser_descriptor_count',
  'predecessor_remaining_source_admission_gap_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'source_occurrence_self_reference_value_count',
  'unique_source_occurrence_self_reference_review_id_count',
  'unique_source_occurrence_self_reference_reference_slot_count',
  'proposed_reference_target_string_count',
  'unique_proposed_reference_target_string_count',
  'source_occurrence_self_reference_normalisation_count',
  'unique_source_normaliser_descriptor_id_count',
  'event_or_reference_source_occurrence_value_count',
  'singular_source_term_plural_alias_withheld_value_count',
  'unique_source_support_id_count',
  'rejected_differently_named_owner_candidate_count',
  'nonempty_same_field_dependency_row_count',
  'work3_fixture_consumable_reference_value_count',
  'remaining_source_normaliser_descriptor_count',
  'remaining_source_admission_gap_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'work3_normaliser_extension_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
  'family_package_count',
  'activation_count',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'agreement_date_source_pair_reference_value_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'phase3_source_normaliser_authority_binding',
  'phase3_reference_edge_value_authority_binding',
  'phase3_linked_rule_reference_value_authority_binding',
  'phase3_raw_m2_reference_owner_value_authority_binding',
  'phase3_source_occurrence_self_reference_value_authority_binding',
  'predecessor_source_occurrence_self_reference_value_candidate_binding',
  'phase3_agreement_date_source_pair_reference_value_authority_binding',
  'agreement_date_source_pair_reference_value_accounting',
  'agreement_date_source_pair_reference_value_contract',
  'agreement_date_source_pair_reference_values',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_KEYS = Object.freeze([
  'agreement_date_source_pair_reference_target_string_review_id',
  'agreement_id',
  'canonical_preamble_date_occurrence',
  'date_pair_subclass',
  'exact_same_field_phase2_dependencies',
  'field_key',
  'materialisation_state',
  'normalisation_proof',
  'normalisation_rule_id',
  'normaliser_requirement',
  'preamble_date_source_support',
  'profile_key',
  'proposed_reference_target_string',
  'reference_slot_key',
  'same_node_defined_term_owner_reuse_exception',
  'source_normaliser_descriptor_id',
  'source_unit_key',
  'terminal_date_reference_source_support',
  'terminal_source_occurrence',
  'value_type',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_PREAMBLE_OCCURRENCE_KEYS = Object.freeze([
  'm2_node',
  'occurrence_span',
  'occurrence_text',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_TERMINAL_OCCURRENCE_KEYS = Object.freeze([
  'm2_node',
  'occurrence_span',
  'occurrence_text',
  'source_closure_role',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_NORMALISATION_PROOF_KEYS = Object.freeze([
  'input_preamble_date_source_span_ids',
  'input_terminal_reference_source_span_ids',
  'result_digest',
  'rule_id',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_SAME_NODE_EXCEPTION_KEYS = Object.freeze([
  'defined_term',
  'disposition',
  'exact_resolved_definition_edge_count',
  'owner_node_occurrence_id',
  'selected_definition_annotation_occurrence_id',
  'work3_reference_value_materialisation_withheld',
]);
const TERMINATION_PHASE3_AGREEMENT_DATE_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_source_occurrence_self_reference_value_count',
  'predecessor_remaining_source_normaliser_descriptor_count',
  'predecessor_remaining_source_admission_gap_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'agreement_date_source_pair_reference_value_count',
  'unique_agreement_date_source_pair_reference_review_id_count',
  'unique_agreement_date_source_pair_reference_reference_slot_count',
  'proposed_reference_target_string_count',
  'unique_proposed_reference_target_string_count',
  'agreement_date_source_pair_reference_normalisation_count',
  'unique_source_normaliser_descriptor_id_count',
  'unique_preamble_date_source_support_id_count',
  'unique_terminal_date_reference_source_support_id_count',
  'same_node_defined_term_owner_reuse_exception_count',
  'same_node_company_resolved_definition_edge_count',
  'work3_fixture_consumable_reference_value_count',
  'remaining_source_normaliser_descriptor_count',
  'remaining_source_admission_gap_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'work3_normaliser_extension_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
  'family_package_count',
  'activation_count',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'company_stockholders_meeting_event_reference_value_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'phase3_source_normaliser_authority_binding',
  'phase3_reference_edge_value_authority_binding',
  'phase3_linked_rule_reference_value_authority_binding',
  'phase3_raw_m2_reference_owner_value_authority_binding',
  'phase3_source_occurrence_self_reference_value_authority_binding',
  'phase3_agreement_date_source_pair_reference_value_authority_binding',
  'predecessor_agreement_date_source_pair_reference_value_candidate_binding',
  'phase3_company_stockholders_meeting_event_reference_value_authority_binding',
  'company_stockholders_meeting_event_reference_value_accounting',
  'company_stockholders_meeting_event_reference_value_contract',
  'company_stockholders_meeting_event_reference_values',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_KEYS = Object.freeze([
  'agreement_id',
  'approved_event_defined_term_mapping',
  'company_stockholders_meeting_event_reference_target_string_review_id',
  'direct_provenance_meeting_definition_edge',
  'field_key',
  'materialisation_state',
  'normalisation_proof',
  'normalisation_rule_id',
  'profile_key',
  'proposed_reference_target_string',
  'reference_slot_key',
  'rejected_approval_defined_term_owner',
  'rejected_approval_definition_occurrence',
  'section_8_01_g_approval_definition_edge',
  'section_8_01_g_meeting_definition_edge',
  'selected_meeting_defined_term_owner',
  'selected_meeting_definition_occurrence',
  'source_normaliser_descriptor_id',
  'source_unit_key',
  'terminal_source_occurrence',
  'terminal_source_support',
  'value_type',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_MAPPING_KEYS = Object.freeze([
  'approval_class',
  'approval_date',
  'approved_source_field_key',
  'approved_target_field_key',
  'approved_target_owner_node_occurrence_id',
  'exact_response',
  'provenance_only_rejected_target_node_occurrence_id',
  'scope',
  'work3_reference_value_materialisation_withheld',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_OWNER_KEYS = Object.freeze([
  'field_key',
  'native_m3_definition_edge_id',
  'owner_node_occurrence_id',
  'resolution_state',
  'source_text',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINITION_OCCURRENCE_KEYS = Object.freeze([
  'definition_annotation',
  'definition_m2_node',
  'definition_source_support',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINITION_ANNOTATION_KEYS = Object.freeze([
  'annotation_kind',
  'annotation_occurrence_id',
  'owner_node_occurrence_id',
  'roles',
  'schema_version',
  'span',
  'value',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_TERMINAL_OCCURRENCE_KEYS = Object.freeze([
  'm2_node',
  'occurrence_span',
  'occurrence_text',
  'source_closure_role',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_M3_EDGE_KEYS = Object.freeze([
  'definition_edge_id',
  'owner_node_occurrence_id',
  'raw_text',
  'reason_code',
  'rule_id',
  'rule_version',
  'schema_version',
  'selected_definition_annotation_occurrence_id',
  'source_annotation_occurrence_id',
  'source_span',
  'state',
  'target_definition_annotation_occurrence_ids',
  'target_owner_node_occurrence_ids',
  'term',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_PROOF_KEYS = Object.freeze([
  'input_direct_provenance_definition_edge_ids',
  'input_rejected_definition_edge_ids',
  'input_section_meeting_definition_edge_ids',
  'input_source_span_ids',
  'result_digest',
  'rule_id',
]);
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_agreement_date_source_pair_reference_value_count',
  'predecessor_remaining_source_normaliser_descriptor_count',
  'predecessor_remaining_source_admission_gap_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'company_stockholders_meeting_event_reference_value_count',
  'unique_company_stockholders_meeting_event_reference_review_id_count',
  'unique_company_stockholders_meeting_event_reference_reference_slot_count',
  'proposed_reference_target_string_count',
  'unique_proposed_reference_target_string_count',
  'company_stockholders_meeting_event_reference_normalisation_count',
  'unique_source_normaliser_descriptor_id_count',
  'approved_event_defined_term_mapping_count',
  'direct_provenance_meeting_definition_edge_count',
  'section_8_01_g_meeting_definition_edge_count',
  'section_8_01_g_approval_definition_edge_count',
  'selected_meeting_defined_term_owner_count',
  'rejected_approval_defined_term_owner_count',
  'rejected_source_occurrence_target_count',
  'unique_terminal_source_support_id_count',
  'unique_selected_meeting_definition_source_support_id_count',
  'unique_rejected_approval_definition_source_support_id_count',
  'work3_fixture_consumable_reference_value_count',
  'remaining_source_normaliser_descriptor_count',
  'remaining_source_admission_gap_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'work3_normaliser_extension_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
  'family_package_count',
  'activation_count',
]);
const TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'linked_rule_reference_value_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'phase3_source_normaliser_authority_binding',
  'phase3_reference_edge_value_authority_binding',
  'predecessor_reference_edge_value_candidate_binding',
  'phase3_linked_rule_reference_value_authority_binding',
  'linked_rule_reference_value_accounting',
  'linked_rule_reference_value_contract',
  'linked_rule_reference_values',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_KEYS = Object.freeze([
  'agreement_id',
  'exact_bound_m2_occurrence',
  'exact_phase2_linked_rule_binding',
  'field_key',
  'linked_rule_reference_target_string_review_id',
  'materialisation_state',
  'normalisation_proof',
  'normalisation_rule_id',
  'profile_key',
  'proposed_reference_target_string',
  'reference_slot_key',
  'source_normaliser_descriptor_id',
  'source_support',
  'source_unit_key',
  'unresolved_same_field_phase2_dependencies',
  'value_type',
  'withheld_owner_choice',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_LINKED_RULE_BOUND_OCCURRENCE_KEYS = Object.freeze([
  'm2_node',
  'occurrence_span',
  'occurrence_text',
]);
const TERMINATION_PHASE3_LINKED_RULE_BINDING_KEYS = Object.freeze([
  'binding_key',
  'binding_kind',
  'resolution_state',
  'target_component_key',
  'target_node_occurrence_id',
  'target_signature',
]);
const TERMINATION_PHASE3_LINKED_RULE_PROOF_KEYS = Object.freeze([
  'input_linked_rule_binding_keys',
  'input_source_span_ids',
  'result_digest',
  'rule_id',
]);
const TERMINATION_PHASE3_LINKED_RULE_DEPENDENCY_KEYS = Object.freeze([
  'field_key',
  'graph_key',
  'native_m3_reference_edge_id',
  'resolution_state',
  'target_field_key',
  'target_kind',
  'target_node_occurrence_id',
]);
const TERMINATION_PHASE3_LINKED_RULE_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_reference_edge_value_count',
  'predecessor_remaining_source_normaliser_descriptor_count',
  'predecessor_remaining_source_admission_gap_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'linked_rule_reference_value_count',
  'unique_linked_rule_review_id_count',
  'unique_linked_rule_reference_slot_count',
  'proposed_reference_target_string_count',
  'unique_proposed_reference_target_string_count',
  'source_proved_linked_rule_normalisation_count',
  'unique_source_normaliser_descriptor_id_count',
  'unique_source_support_id_count',
  'work3_fixture_consumable_reference_value_count',
  'remaining_source_normaliser_descriptor_count',
  'remaining_source_admission_gap_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
  'family_package_count',
  'activation_count',
]);
const TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'reference_edge_value_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'phase3_source_normaliser_authority_binding',
  'predecessor_source_normaliser_candidate_binding',
  'phase3_reference_edge_value_authority_binding',
  'reference_edge_value_accounting',
  'reference_edge_value_contract',
  'reference_edge_values',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_KEYS = Object.freeze([
  'agreement_id',
  'exact_agreement_local_m2_target',
  'field_key',
  'materialisation_state',
  'native_m3_reference_edge',
  'normalisation_proof',
  'normalisation_rule_id',
  'profile_key',
  'projected_context_edge',
  'proposed_reference_target_string',
  'reference_edge_target_string_review_id',
  'reference_slot_key',
  'source_normaliser_descriptor_id',
  'source_support',
  'source_unit_key',
  'value_type',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_NATIVE_REFERENCE_EDGE_KEYS = Object.freeze([
  'normalised_reference',
  'owner_node_occurrence_id',
  'raw_text',
  'reason_code',
  'reference_edge_id',
  'rule_id',
  'rule_version',
  'schema_version',
  'selected_target_node_occurrence_id',
  'source_annotation_occurrence_id',
  'source_span',
  'state',
  'target_node_occurrence_ids',
]);
const TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS = Object.freeze([
  'agreement_index_id',
  'source_node_occurrence_id',
  'source_span',
  'source_support_id',
  'source_text',
]);
const TERMINATION_PHASE3_SOURCE_SPAN_KEYS = Object.freeze([
  'coordinate_system',
  'end_byte',
  'start_byte',
  'text_sha256',
]);
const TERMINATION_PHASE3_PROJECTED_CONTEXT_EDGE_KEYS = Object.freeze([
  'edge_id',
  'edge_type',
  'source_support_ids',
  'state',
  'target_id',
]);
const TERMINATION_PHASE3_M2_TARGET_KEYS = Object.freeze([
  'agreement_index_id',
  'extent_span',
  'node_kind',
  'node_occurrence_id',
  'reference',
]);
const TERMINATION_PHASE3_REFERENCE_NORMALISATION_PROOF_KEYS = Object.freeze([
  'input_context_edge_ids',
  'input_source_span_ids',
  'result_digest',
  'rule_id',
]);
const TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_source_normaliser_descriptor_count',
  'predecessor_source_admission_gap_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'reference_edge_value_count',
  'unique_reference_edge_value_id_count',
  'unique_reference_edge_value_slot_count',
  'proposed_reference_target_string_count',
  'unique_proposed_reference_target_string_count',
  'reference_edge_v1_normalisation_count',
  'work3_fixture_consumable_reference_value_count',
  'remaining_source_normaliser_descriptor_count',
  'remaining_source_admission_gap_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
  'family_package_count',
]);
const TERMINATION_PHASE3_SOURCE_NORMALISER_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'source_normaliser_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'predecessor_target_evidence_candidate_binding',
  'phase3_source_normaliser_authority_binding',
  'source_normaliser_accounting',
  'source_normaliser_descriptor_contract',
  'source_normaliser_descriptors',
  'source_admission_gap_contract',
  'source_admission_gaps',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_SOURCE_NORMALISER_DESCRIPTOR_KEYS = Object.freeze([
  'agreement_id',
  'field_key',
  'materialisation_state',
  'normaliser_kind',
  'normaliser_payload',
  'phase2_terminal_contract_path',
  'profile_key',
  'reference_slot_key',
  'source_normaliser_descriptor_id',
  'source_unit_key',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_SOURCE_ADMISSION_GAP_KEYS = Object.freeze([
  'agreement_id',
  'external_source_name',
  'field_key',
  'materialisation_state',
  'phase2_terminal_contract_path',
  'profile_key',
  'reference_slot_key',
  'source_admission_gap_id',
  'source_admission_payload',
  'source_unit_key',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_SOURCE_NORMALISER_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'predecessor_reference_target_evidence_count',
  'predecessor_remaining_unresolved_reference_slot_count',
  'source_normaliser_descriptor_count',
  'unique_source_normaliser_slot_count',
  'exact_source_occurrence_descriptor_count',
  'raw_m2_definition_or_event_boundary_descriptor_count',
  'exact_m3_section_citation_descriptor_count',
  'exact_agreement_date_source_pair_descriptor_count',
  'source_admission_gap_count',
  'unique_source_admission_gap_slot_count',
  'remaining_unresolved_reference_slot_count',
  'substantive_legal_question_count',
  'emitted_reference_target_string_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
]);
const TERMINATION_PHASE3_TARGET_EVIDENCE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'target_evidence_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_reference_review_authority_binding',
  'phase3_target_evidence_authority_binding',
  'reference_target_evidence_accounting',
  'reference_target_evidence_contract',
  'reference_target_evidence_descriptors',
  'remaining_unresolved_reference_slot_contract',
  'remaining_unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_TARGET_EVIDENCE_DESCRIPTOR_KEYS = Object.freeze([
  'agreement_id',
  'evidence_kind',
  'evidence_payload',
  'field_key',
  'materialisation_state',
  'profile_key',
  'reference_slot_key',
  'source_unit_key',
  'target_evidence_id',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_TARGET_EVIDENCE_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'reference_occurrence_count',
  'predecessor_non_empty_reference_string_count',
  'predecessor_unresolved_reference_slot_count',
  'reference_target_evidence_count',
  'unique_reference_target_evidence_slot_count',
  'canonical_text_m2_section_citation_count',
  'explicit_section_citation_count',
  'coordinated_shorthand_citation_count',
  'phase2_row_local_target_evidence_count',
  'shared_chapeau_effective_time_owner_evidence_count',
  'source_proved_linked_rule_target_evidence_count',
  'native_m3_defined_term_owner_non_event_evidence_count',
  'native_m3_defined_term_owner_event_evidence_count',
  'raw_m3_same_term_definition_owner_evidence_count',
  'raw_m3_definition_edge_count',
  'remaining_unresolved_reference_slot_count',
  'work3_typed_reference_value_count',
  'work3_typed_fact_count',
  'work3_identity_count',
]);
const TERMINATION_PHASE3_REFERENCE_REVIEW_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'review_candidate_id',
  'family_key',
  'candidate_state',
  'phase2_authority_binding',
  'phase2_proposal_binding',
  'phase3_authority_binding',
  'phase3_review_schedule_sha256',
  'reference_ledger_sha256',
  'reference_ledger',
  'reference_accounting',
  'unresolved_reference_slot_contract',
  'unresolved_reference_slots',
  'withheld_work3_identity_fields',
  'unresolved_items',
  'zero_effect_boundary',
]);
const TERMINATION_PHASE3_REFERENCE_LEDGER_ROW_KEYS = Object.freeze([
  'profile_key',
  'source_unit_key',
  'field_key',
  'reference_classification',
  'materialisation_state',
  'typed_value',
  'value_source',
  'review_descriptor',
  'governed_reference_materialisation',
  'work3_fixture_consumable_value_shape',
]);
const TERMINATION_PHASE3_GOVERNED_REFERENCE_KEYS = Object.freeze([
  'descriptor_resolution_source',
  'owner_template_authority_path',
  'owner_template_descriptor_key',
  'phase1_authority_path',
  'semantic_fact_identity_domain',
  'semantic_fact_identity_payload',
  'semantic_fact_key',
]);
const TERMINATION_PHASE3_REFERENCE_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'reference_occurrence_count',
  'non_empty_reference_string_count',
  'direct_non_empty_reference_string_count',
  'governed_semantic_fact_key_occurrence_count',
  'governed_semantic_fact_key_unique_count',
  'unresolved_reference_slot_count',
]);
const TERMINATION_PHASE3_REFERENCE_SLOT_KEYS = Object.freeze([
  'reference_slot_key',
  'profile_key',
  'source_unit_key',
  'field_key',
  'materialisation_state',
  'review_descriptor',
]);
const TERMINATION_PHASE3_WITHHELD_WORK3_IDENTITIES = Object.freeze([
  'approved_inventory_digest',
  'ben_approval_id',
  'child_rule_requirement_id',
  'conditional_requirement_id',
  'dimension_evidence_id',
  'family_approval_id',
  'family_profile_package_id',
  'fixture_id',
  'inventory_fingerprint',
  'lawyer_ruling_id',
  'match_fixture_id',
  'profile_id',
  'requirement_id',
  'subtype_tree_id',
  'tree_id',
]);
const TERMINATION_PHASE2_PROPOSAL_KEYS = Object.freeze([
  'schema_version',
  'proposal_id',
  'family_key',
  'proposal_state',
  'profile_approval_state',
  'authority_binding',
  'm4_claim_accounting',
  'source_terminal_coverage',
  'zero_m4_claim_gaps',
  'symbolic_temporal_graphs',
  'temporal_state_reference_edges',
  'authorised_rule_components',
  'proposed_partition',
  'derived_profile_count',
  'inventory_digest',
  'unresolved_items',
]);
const TERMINATION_PHASE2_CLAIM_ACCOUNTING_KEYS = Object.freeze([
  'state',
  'expected_claim_ids',
  'accounted_claim_ids',
  'expected_count',
  'accounted_count',
  'claim_ids_sha256',
]);
const TERMINATION_PHASE2_SOURCE_COVERAGE_KEYS = Object.freeze([
  'state',
  'classification_buckets',
  'source_unit_assignments',
  'expected_source_unit_ids',
  'accounted_source_unit_ids',
  'expected_count',
  'accounted_count',
]);
const TERMINATION_PHASE2_SOURCE_ASSIGNMENT_KEYS = Object.freeze([
  'source_unit_key',
  'classification_bucket',
  'source_row_keys',
  'm4_claim_ids',
  'm4_silent_source_row_keys',
]);
const TERMINATION_PHASE2_GRAPH_KEYS = Object.freeze([
  'graph_key',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'defined_term_owner_fact_id',
  'states',
  'state_edges',
]);
const TERMINATION_PHASE2_STATE_KEYS = Object.freeze([
  'schema_version',
  'state_id',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'state_key',
  'ordinal',
  'value_ref',
  'source_node_occurrence_id',
  'source_support_ids',
  'resolution_state',
  'unresolved_dimensions',
]);
const TERMINATION_PHASE2_EDGE_KEYS = Object.freeze([
  'schema_version',
  'temporal_state_edge_id',
  'edge_rule_id',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'predecessor_state_id',
  'successor_state_id',
  'trigger_expression_id',
  'evaluation_expression_ids',
  'transition_kind',
  'source_node_occurrence_ids',
  'source_support_ids',
  'resolution_state',
]);
const TERMINATION_PHASE2_REFERENCE_KEYS = Object.freeze([
  'schema_version',
  'temporal_state_reference_edge_id',
  'edge_rule_id',
  'edge_type',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'consumer_rule_id',
  'consumer_fact_id',
  'consumer_dependency_id',
  'consumer_context_edge_id',
  'state_ids',
  'transition_edge_ids',
  'source_support_ids',
  'resolution_state',
]);
const TERMINATION_PHASE2_COMPONENT_KEYS = Object.freeze([
  'component_id',
  'component_key',
  'agreement_id',
  'root_expression_id',
  'fact_ids',
  'expression_ids',
  'source_support_ids',
  'unresolved_items',
]);
const TERMINATION_PHASE2_PARTITION_KEYS = Object.freeze([
  'proposed_profiles',
  'source_unit_assignment_count',
  'm4_claim_assignment_count',
]);
const TERMINATION_PHASE2_PROFILE_KEYS = Object.freeze([
  'proposed_profile_key',
  'canonical_tuple',
  'source_unit_keys',
  'm4_claim_ids',
  'authorised_component_ids',
  'temporal_state_reference_edge_ids',
]);
const TERMINATION_PHASE2_TUPLE_KEYS = Object.freeze([
  'classification_path',
  'required_expression_signature',
]);
const TERMINATION_PHASE2_UNRESOLVED_ITEMS = Object.freeze([
  'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
  'FUTURE_APPLIES_TO_PARTY_RESOLUTION_PENDING_NATIVE_PARTY_ALIAS_EDGE_OR_LATER_POLICY',
  'OPERATIVE_TEMPORAL_STATE_SELECTION_UNAPPROVED',
  'SKECHERS_INITIAL_TERMINATION_DATE_CLOCK_TIME_TIME_ZONE_AND_ZONED_VALUE_UNRESOLVED',
  'SKECHERS_SUCCESSOR_CLOCK_TIME_AND_TIME_ZONE_INHERITANCE_UNAPPROVED',
]);
const TERMINATION_PHASE2_CLASSIFICATION_BUCKETS = Object.freeze([
  'MUTUAL_CONSENT',
  'OUTSIDE_DATE',
  'LEGAL_RESTRAINT',
  'STOCKHOLDER_APPROVAL_FAILURE',
  'BREACH',
  'RECOMMENDATION_CHANGE',
  'SUPERIOR_PROPOSAL',
  'FIDUCIARY_NOTICE',
  'NO_SOLICITATION_BREACH',
  'FAILURE_TO_CLOSE',
]);
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;
const MISSING_SOURCE_TEXT = 'SOURCE_TEXT_NOT_PRESENT_IN_BOUND_AUTHORING_INPUT';
const EXPECTED_PACKET_BINDING = Object.freeze({
  byte_length: 136079,
  git_blob_oid: '7e195d257bec5044867073b6905a69f7b708dc36',
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-packet-set.json',
  record_id: '30808afe05e4ab1b9f84fbf537804229c5d9b2ecc888d317a2075bf00712aec2',
  record_id_field: 'family_packet_set_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
  sha256: '1bb5f78417360d558ec4ce917b670e6494eed9525321380fc71f7d4095080e39',
});
const EXPECTED_FIRST_CANDIDATES = Object.freeze({
  ANTITRUST_REGULATORY: 'ANTITRUST_REGULATORY::EFFORTS',
  APPRAISAL_DISSENTERS_RIGHTS: 'APPRAISAL_DISSENTERS_RIGHTS::APPRAISAL_STATUS',
  CAPITALISATION: 'CAPITALISATION::AUTHORISED_CAPITAL',
  CLOSING_CONDITIONS: 'CLOSING_CONDITIONS::STOCKHOLDER_APPROVAL',
  CONSIDERATION: 'CONSIDERATION::CONSIDERATION_PACKAGE',
  DIVIDENDS: 'DIVIDENDS::DIVIDEND_COORDINATION',
  DNO_INDEMNIFICATION: 'DNO_INDEMNIFICATION::INDEMNIFICATION_AND_EXCULPATION',
  EMPLOYEE_MATTERS: 'EMPLOYEE_MATTERS::EMPLOYEE_COMPENSATION',
  FINANCING_COVENANTS: 'FINANCING_COVENANTS::OBTAIN_FINANCING',
  GENERAL_COVENANTS: 'GENERAL_COVENANTS::ACCESS',
  GUARANTY_FINANCING_PARTY: 'GUARANTY_FINANCING_PARTY::PERFORMANCE_GUARANTY',
  INTERIM_OPERATING: 'INTERIM_OPERATING::RESTRICTIVE_COVENANT',
  KEY_DEFINED_TERMS: 'KEY_DEFINED_TERMS::ACQUISITION_PROPOSAL',
  MAE_DEFINITION: 'MAE_DEFINITION::DEFINITION_INSTANCE',
  MATERIAL_CONTRACTS: 'MATERIAL_CONTRACTS::MATERIAL_CONTRACT_CATEGORY_CRITERION',
  MERGER_STRUCTURE_CLOSING: 'MERGER_STRUCTURE_CLOSING::TRANSACTION_STEP',
  MISC_BOILERPLATE: 'MISC_BOILERPLATE::GOVERNING_LAW',
  NO_OTHER_REPS_FRAUD: 'NO_OTHER_REPS_FRAUD::NO_OTHER_REPRESENTATIONS_DISCLAIMER',
  NO_SHOP: 'NO_SHOP::RESTRICTION',
  PROXY_MEETING: 'PROXY_MEETING::DOCUMENT_FILING',
  REPRESENTATIONS: 'REPRESENTATIONS::STATUS_REPRESENTATION',
  SPECIFIC_PERFORMANCE_REMEDIES: 'SPECIFIC_PERFORMANCE_REMEDIES::GENERAL_EQUITABLE_RELIEF',
  TAX_MATTERS: 'TAX_MATTERS::INTENDED_TAX_TREATMENT',
  TERMINATION: 'TERMINATION::TERMINATION_RIGHT',
  TERMINATION_FEE: 'TERMINATION_FEE::FEE_AMOUNT',
});
const SYNTHETIC_TRANSIENT_ANSWER = Object.freeze({
  family_key: 'ANTITRUST_REGULATORY',
  profile_key: 'SYNTHETIC_REVIEW_TARGET',
  field_key: 'DIMENSION_EVIDENCE',
  answer_text: 'Synthetic memory-only answer for the transient review transport test.',
});
const SYNTHETIC_SECOND_TRANSIENT_ANSWER = Object.freeze({
  family_key: 'TAX_MATTERS',
  profile_key: 'SYNTHETIC_SECOND_REVIEW_TARGET',
  field_key: 'PROFILE_TAXONOMY_AND_PARENTAGE',
  answer_text: 'Second synthetic memory-only answer for family routing coverage.',
});
const SYNTHETIC_UNMAPPED_TRANSIENT_ANSWER = Object.freeze({
  family_key: 'CAPITALISATION',
  profile_key: 'SYNTHETIC_UNMAPPED_TARGET',
  field_key: 'SYNTHETIC_UNMAPPED_FIELD',
  answer_text: 'Synthetic memory-only answer outside the authoring section inventory.',
});
const TRANSIENT_ANSWER_AVAILABLE_STATE = 'TRANSIENT_MEMORY_ANSWER_AVAILABLE_NOT_AUTHORITY';
const PHYSICAL_BYTES_BY_PATH = new Map();
const RESULT_KEYS = Object.freeze([
  'state',
  'source_closure',
  'counts',
  'rows',
  'family_dossiers',
  'transient_review_answers',
  'transient_review_evidence',
  'family_package_authoring_work_queue',
  'rendered_review_text',
]);
const AUTHORING_QUEUE_KEYS = Object.freeze([
  'state',
  'storage',
  'families',
]);
const AUTHORING_FAMILY_KEYS = Object.freeze([
  'family_key',
  'state',
  'source_candidate_subtype_ids',
  'evidence_covered_candidate_subtype_ids',
  'source_deferred_candidate_subtype_ids',
  'source_positive_example_ids',
  'controlling_programme_ruling_ids',
  'transient_review_answers',
  'transient_review_evidence',
  'authoring_sections',
]);
const AUTHORING_SECTION_KEYS = Object.freeze(['section_key', 'state']);
const EXPECTED_AUTHORING_SECTION_KEYS = Object.freeze([
  'PROFILE_TAXONOMY_AND_PARENTAGE',
  'SUBTYPE_AND_CLASSIFICATION_PATHS',
  'FIELD_REQUIREMENTS_TYPES_CARDINALITY_AND_MATERIALITY',
  'CONDITIONAL_REQUIREMENTS_AND_MINIMUM_FLOORS',
  'ALLOWED_SOURCE_AND_DEPENDENCY_TYPES',
  'CHILD_RULES_AND_OPERATORS',
  'EXPRESSION_AND_SEVEN_SLOT_EQUIVALENCE_SIGNATURE',
  'DISPLAY_GROUPING_AND_DIMENSION_OWNERSHIP',
  'STRUCTURE_AND_NO_COMPARISON_POLICY',
  'LEGAL_AUTHORITY_SELECTION',
  'FOUR_CLASS_FIXTURE_OUTCOMES',
  'DIMENSION_EVIDENCE',
  'TREE_TERMINALITY_AND_COMPLETENESS',
]);
const EXPECTED_PROGRAMME_RULING_IDS = Object.freeze([
  'M5-RULING-ONE-OPERATIVE-LIMB',
  'M5-RULING-ONE-SEMANTIC-OWNER',
  'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
]);
const SOURCE_CLOSURE_KEYS = Object.freeze([
  'state',
  'source_count',
  'family_keys',
  'family_packet_set_source',
  'common_sources',
  'family_sources',
  'native_m2_source_closure',
  'native_m3_source_closure',
  'native_m4_source_closure',
  'native_additive_source_closure',
]);
const COUNT_KEYS = Object.freeze([
  'source_count',
  'family_count',
  'candidate_subtype_count',
  'evidence_covered_candidate_subtype_count',
  'remaining_candidate_subtype_count',
  'source_example_count',
  'historical_calibration_question_count',
  'open_programme_question_count',
  'packet_sample_count',
  'structure_ambiguity_count',
  'governed_review_item_count',
  'comparator_binding_count',
  'supplemental_binding_count',
  'cross_family_dependency_count',
]);
const ROW_KEYS = Object.freeze([
  'family_key',
  'calibration_pack_binding',
  'review_state',
  'candidate_subtype_profile_ids',
  'first_evidence_covered_candidate_subtype_id',
  'positive_evidence_example_ids',
  'proposed_approved_candidate_subtype_ids',
  'deferred_candidate_subtype_ids',
  'candidate_subtype_count',
  'deferred_candidate_subtype_count',
  'proposed_tree_completeness_state',
]);
const DOSSIER_KEYS = Object.freeze([
  'family_key',
  'wave',
  'family_packet_evidence',
  'calibration_pack_source',
  'programme_rulings',
  'governed_sample_evidence',
  'provision_example_evidence',
  'required_decision_slots',
  'source_text_gap_example_ids',
  'fresh_work5_items',
]);

function readRecord(relativePath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'));
}

function sourceEnvelope(binding) {
  return {
    binding: structuredClone(binding),
    record: readRecord(binding.path),
  };
}

function exactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value)) === canonicalJson(expected);
}

function assertExactKeys(value, expected, label) {
  assert.equal(exactKeys(value, expected), true, label);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function canonicalSortedUnique(values) {
  const byCanonical = new Map(values.map((value) => [canonicalJson(value), value]));
  return [...byCanonical.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, value]) => value);
}

function assertSortedUnique(values, label) {
  assert.deepEqual(values, sortedUnique(values), label);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function assertRecursivelyUnfrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), false);
  Object.values(value).forEach((child) => assertRecursivelyUnfrozen(child, seen));
}

function terminationPhase2AuthorityEnvelope() {
  physicalBytes(TERMINATION_PHASE2_AUTHORITY_BINDING);
  return sourceEnvelope(TERMINATION_PHASE2_AUTHORITY_BINDING);
}

function terminationPhase2GovernedSources(authorityRecord) {
  const parents = authorityRecord.immutable_parent_bindings;
  const agreementEvidenceByAgreementId = Object.fromEntries(
    parents.m2_m3_m4.map((agreement) => [agreement.agreement_id, {
      canonicalTextIdentity: {
        canonical_text_id: agreement.canonical_text_id,
        canonical_text_byte_length: agreement.canonical_text_byte_length,
        canonical_text_sha256: agreement.canonical_text_sha256,
      },
      m2: sourceEnvelope(agreement.m2),
      m3: sourceEnvelope(agreement.m3),
      m4: sourceEnvelope(agreement.m4),
    }]),
  );
  return {
    baseContractPolicy: sourceEnvelope(parents.base_policy),
    temporalPhase1Authority: sourceEnvelope(parents.phase1),
    c3CorrectionAuthority: sourceEnvelope(parents.c3),
    work3Manifest: sourceEnvelope(parents.work3_manifest),
    familyRolePolicy: sourceEnvelope(parents.family_role_policy),
    calibrationPack: sourceEnvelope(parents.calibration_pack),
    agreementEvidenceByAgreementId,
  };
}

function terminationPhase2ProposalFixture() {
  const terminationAuthoringPhase2Authority = terminationPhase2AuthorityEnvelope();
  return {
    terminationAuthoringPhase2Authority,
    governedSources: terminationPhase2GovernedSources(
      terminationAuthoringPhase2Authority.record,
    ),
  };
}

function terminationPhase3ReferenceReviewAuthorityEnvelope() {
  physicalBytes(TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING);
  return sourceEnvelope(TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING);
}

function terminationPhase3ReferenceReviewFixture() {
  const phase2 = terminationPhase2ProposalFixture();
  return {
    terminationPhase3ReviewAuthority:
      terminationPhase3ReferenceReviewAuthorityEnvelope(),
    terminationAuthoringPhase2Authority:
      phase2.terminationAuthoringPhase2Authority,
    governedSources: phase2.governedSources,
  };
}

function terminationPhase3TargetEvidenceAuthorityEnvelope() {
  physicalBytes(TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING);
  return sourceEnvelope(TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING);
}

function terminationPhase3TargetEvidenceFixture() {
  return {
    terminationPhase3TargetEvidenceAuthority:
      terminationPhase3TargetEvidenceAuthorityEnvelope(),
    ...terminationPhase3ReferenceReviewFixture(),
  };
}

function terminationPhase3SourceNormaliserAuthorityEnvelope() {
  physicalBytes(TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING);
  return sourceEnvelope(TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING);
}

function terminationPhase3SourceNormaliserFixture() {
  return {
    terminationPhase3ReferenceSourceNormaliserAuthority:
      terminationPhase3SourceNormaliserAuthorityEnvelope(),
    ...terminationPhase3TargetEvidenceFixture(),
  };
}

function terminationPhase3ReferenceEdgeValueAuthorityEnvelope() {
  physicalBytes(TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING);
  return sourceEnvelope(TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING);
}

function terminationPhase3ReferenceEdgeValueFixture() {
  return {
    terminationPhase3ReferenceEdgeValueAuthority:
      terminationPhase3ReferenceEdgeValueAuthorityEnvelope(),
    ...terminationPhase3SourceNormaliserFixture(),
  };
}

function terminationPhase3LinkedRuleReferenceValueAuthorityEnvelope() {
  physicalBytes(
    TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  return sourceEnvelope(
    TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
}

function terminationPhase3LinkedRuleReferenceValueFixture() {
  return {
    terminationPhase3LinkedRuleReferenceValueAuthority:
      terminationPhase3LinkedRuleReferenceValueAuthorityEnvelope(),
    ...terminationPhase3ReferenceEdgeValueFixture(),
  };
}

function terminationPhase3RawM2ReferenceOwnerValueAuthorityEnvelope() {
  physicalBytes(
    TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING,
  );
  return sourceEnvelope(
    TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING,
  );
}

function terminationPhase3RawM2ReferenceOwnerValueFixture() {
  return {
    terminationPhase3RawM2ReferenceOwnerValueAuthority:
      terminationPhase3RawM2ReferenceOwnerValueAuthorityEnvelope(),
    ...terminationPhase3LinkedRuleReferenceValueFixture(),
  };
}

function terminationPhase3SourceOccurrenceSelfReferenceValueAuthorityEnvelope() {
  physicalBytes(
    TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  return sourceEnvelope(
    TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
}

function terminationPhase3SourceOccurrenceSelfReferenceValueFixture() {
  return {
    terminationPhase3SourceOccurrenceSelfReferenceValueAuthority:
      terminationPhase3SourceOccurrenceSelfReferenceValueAuthorityEnvelope(),
    ...terminationPhase3RawM2ReferenceOwnerValueFixture(),
  };
}

function terminationPhase3AgreementDateSourcePairReferenceValueAuthorityEnvelope() {
  physicalBytes(
    TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  return sourceEnvelope(
    TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
}

function terminationPhase3AgreementDateSourcePairReferenceValueFixture() {
  return {
    terminationPhase3AgreementDateSourcePairReferenceValueAuthority:
      terminationPhase3AgreementDateSourcePairReferenceValueAuthorityEnvelope(),
    ...terminationPhase3SourceOccurrenceSelfReferenceValueFixture(),
  };
}

function terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthorityEnvelope() {
  physicalBytes(
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  return sourceEnvelope(
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
}

function terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture() {
  return {
    terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority:
      terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthorityEnvelope(),
    ...terminationPhase3AgreementDateSourcePairReferenceValueFixture(),
  };
}

function terminationPhase3ReferenceValueMaterialisationAuthorityEnvelope() {
  physicalBytes(
    TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING,
  );
  return sourceEnvelope(
    TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING,
  );
}

function terminationPhase3ReferenceValueMaterialisationFixture() {
  physicalBytes(
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING,
  );
  return {
    terminationPhase3ReferenceValueMaterialisationAuthority:
      terminationPhase3ReferenceValueMaterialisationAuthorityEnvelope(),
    terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority:
      sourceEnvelope(
        TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING,
      ),
    ...terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(),
  };
}

function forkTerminationPhase3ReferenceValueMaterialisationFixture(base) {
  return {
    terminationPhase3ReferenceValueMaterialisationAuthority: {
      ...base.terminationPhase3ReferenceValueMaterialisationAuthority,
      binding: {
        ...base.terminationPhase3ReferenceValueMaterialisationAuthority.binding,
      },
    },
    terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority: {
      ...base.terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority,
      binding: {
        ...base
          .terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority
          .binding,
      },
    },
    ...forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
      base,
    ),
  };
}

function forkTerminationPhase2ProposalFixture(base) {
  return {
    terminationAuthoringPhase2Authority: {
      ...base.terminationAuthoringPhase2Authority,
      binding: { ...base.terminationAuthoringPhase2Authority.binding },
    },
    governedSources: {
      ...base.governedSources,
      agreementEvidenceByAgreementId: {
        ...base.governedSources.agreementEvidenceByAgreementId,
      },
    },
  };
}

function forkTerminationPhase3ReferenceReviewFixture(base) {
  const phase2 = forkTerminationPhase2ProposalFixture(base);
  return {
    terminationPhase3ReviewAuthority: {
      ...base.terminationPhase3ReviewAuthority,
      binding: { ...base.terminationPhase3ReviewAuthority.binding },
    },
    terminationAuthoringPhase2Authority:
      phase2.terminationAuthoringPhase2Authority,
    governedSources: phase2.governedSources,
  };
}

function forkTerminationPhase3TargetEvidenceFixture(base) {
  return {
    terminationPhase3TargetEvidenceAuthority: {
      ...base.terminationPhase3TargetEvidenceAuthority,
      binding: { ...base.terminationPhase3TargetEvidenceAuthority.binding },
    },
    ...forkTerminationPhase3ReferenceReviewFixture(base),
  };
}

function forkTerminationPhase3SourceNormaliserFixture(base) {
  return {
    terminationPhase3ReferenceSourceNormaliserAuthority: {
      ...base.terminationPhase3ReferenceSourceNormaliserAuthority,
      binding: {
        ...base.terminationPhase3ReferenceSourceNormaliserAuthority.binding,
      },
    },
    ...forkTerminationPhase3TargetEvidenceFixture(base),
  };
}

function forkTerminationPhase3ReferenceEdgeValueFixture(base) {
  return {
    terminationPhase3ReferenceEdgeValueAuthority: {
      ...base.terminationPhase3ReferenceEdgeValueAuthority,
      binding: {
        ...base.terminationPhase3ReferenceEdgeValueAuthority.binding,
      },
    },
    ...forkTerminationPhase3SourceNormaliserFixture(base),
  };
}

function forkTerminationPhase3LinkedRuleReferenceValueFixture(base) {
  return {
    terminationPhase3LinkedRuleReferenceValueAuthority: {
      ...base.terminationPhase3LinkedRuleReferenceValueAuthority,
      binding: {
        ...base.terminationPhase3LinkedRuleReferenceValueAuthority.binding,
      },
    },
    ...forkTerminationPhase3ReferenceEdgeValueFixture(base),
  };
}

function forkTerminationPhase3RawM2ReferenceOwnerValueFixture(base) {
  return {
    terminationPhase3RawM2ReferenceOwnerValueAuthority: {
      ...base.terminationPhase3RawM2ReferenceOwnerValueAuthority,
      binding: {
        ...base.terminationPhase3RawM2ReferenceOwnerValueAuthority.binding,
      },
    },
    ...forkTerminationPhase3LinkedRuleReferenceValueFixture(base),
  };
}

function forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(base) {
  return {
    terminationPhase3SourceOccurrenceSelfReferenceValueAuthority: {
      ...base.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority,
      binding: {
        ...base.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
          .binding,
      },
    },
    ...forkTerminationPhase3RawM2ReferenceOwnerValueFixture(base),
  };
}

function forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(base) {
  return {
    terminationPhase3AgreementDateSourcePairReferenceValueAuthority: {
      ...base.terminationPhase3AgreementDateSourcePairReferenceValueAuthority,
      binding: {
        ...base.terminationPhase3AgreementDateSourcePairReferenceValueAuthority
          .binding,
      },
    },
    ...forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(base),
  };
}

function forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(base) {
  return {
    terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority: {
      ...base
        .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority,
      binding: {
        ...base
          .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority
          .binding,
      },
    },
    ...forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(base),
  };
}

function forkTerminationAgreementEvidence(fixture, agreementId) {
  const current = fixture.governedSources.agreementEvidenceByAgreementId[agreementId];
  const fork = { ...current };
  fixture.governedSources.agreementEvidenceByAgreementId[agreementId] = fork;
  return fork;
}

function forkTerminationSourceEnvelope(owner, key) {
  const current = owner[key];
  const fork = { ...current, binding: { ...current.binding } };
  owner[key] = fork;
  return fork;
}

function compiledTerminationPhase2Components(authorityEnvelope) {
  return authorityEnvelope.record.authorised_synthetic_rule_components.map(
    (component) => ({
      component,
      compiled: compileSyntheticProfileExpression({
        terminationAuthoringPhase2Authority: authorityEnvelope,
        component_key: component.component_key,
      }),
    }),
  );
}

function nativeComponentSourceSupportIds(component) {
  return sortedUnique(component.source_supports.map((support) => contentId(
    'AGREEMENT_SOURCE_SPAN/V2',
    {
      agreement_index_id: component.agreement_index_id,
      source_node_occurrence_id: support.node_occurrence_id,
      start_byte: support.source_span.start_byte,
      end_byte: support.source_span.end_byte,
      text_sha256: support.source_span.text_sha256,
    },
  )));
}

function restampTerminationPhase2Authority(envelope) {
  const unsigned = structuredClone(envelope.record);
  delete unsigned.termination_authoring_phase2_authority_id;
  envelope.record.termination_authoring_phase2_authority_id = contentId(
    envelope.record.schema_version,
    unsigned,
  );
  const bytes = Buffer.from(`${canonicalJson(envelope.record)}\n`, 'utf8');
  envelope.binding.record_id = envelope.record.termination_authoring_phase2_authority_id;
  envelope.binding.byte_length = bytes.byteLength;
  envelope.binding.sha256 = sha256Hex(bytes);
  return envelope;
}

function restampTerminationPhase3ReferenceReviewAuthority(envelope) {
  const unsigned = structuredClone(envelope.record);
  delete unsigned.termination_authoring_phase3_reference_review_authority_id;
  envelope.record.termination_authoring_phase3_reference_review_authority_id =
    contentId(envelope.record.schema_version, unsigned);
  const bytes = Buffer.from(`${canonicalJson(envelope.record)}\n`, 'utf8');
  envelope.binding.record_id =
    envelope.record.termination_authoring_phase3_reference_review_authority_id;
  envelope.binding.byte_length = bytes.byteLength;
  envelope.binding.sha256 = sha256Hex(bytes);
  return envelope;
}

function restampTerminationPhase3TargetEvidenceAuthority(envelope) {
  const unsigned = structuredClone(envelope.record);
  delete unsigned.termination_authoring_phase3_reference_target_evidence_authority_id;
  envelope.record
    .termination_authoring_phase3_reference_target_evidence_authority_id =
      contentId(envelope.record.schema_version, unsigned);
  const bytes = Buffer.from(`${canonicalJson(envelope.record)}\n`, 'utf8');
  envelope.binding.record_id = envelope.record
    .termination_authoring_phase3_reference_target_evidence_authority_id;
  envelope.binding.byte_length = bytes.byteLength;
  envelope.binding.sha256 = sha256Hex(bytes);
  return envelope;
}

function restampTerminationPhase3SourceNormaliserAuthority(envelope) {
  const unsigned = structuredClone(envelope.record);
  delete unsigned
    .termination_authoring_phase3_reference_source_normaliser_authority_id;
  envelope.record
    .termination_authoring_phase3_reference_source_normaliser_authority_id =
      contentId(envelope.record.schema_version, unsigned);
  const bytes = Buffer.from(`${canonicalJson(envelope.record)}\n`, 'utf8');
  envelope.binding.record_id = envelope.record
    .termination_authoring_phase3_reference_source_normaliser_authority_id;
  envelope.binding.byte_length = bytes.byteLength;
  envelope.binding.sha256 = sha256Hex(bytes);
  return envelope;
}

function restampTerminationPhase3ReferenceEdgeValueAuthority(envelope) {
  const unsigned = structuredClone(envelope.record);
  delete unsigned
    .termination_authoring_phase3_reference_edge_value_authority_id;
  envelope.record
    .termination_authoring_phase3_reference_edge_value_authority_id =
      contentId(envelope.record.schema_version, unsigned);
  const bytes = Buffer.from(`${canonicalJson(envelope.record)}\n`, 'utf8');
  envelope.binding.record_id = envelope.record
    .termination_authoring_phase3_reference_edge_value_authority_id;
  envelope.binding.byte_length = bytes.byteLength;
  envelope.binding.sha256 = sha256Hex(bytes);
  return envelope;
}

function proposalUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.proposal_id;
  return unsigned;
}

function referenceReviewCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.review_candidate_id;
  return unsigned;
}

function targetEvidenceCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.target_evidence_candidate_id;
  return unsigned;
}

function sourceNormaliserCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.source_normaliser_candidate_id;
  return unsigned;
}

function referenceEdgeValueCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.reference_edge_value_candidate_id;
  return unsigned;
}

function linkedRuleReferenceValueCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.linked_rule_reference_value_candidate_id;
  return unsigned;
}

function rawM2ReferenceOwnerValueCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.raw_m2_reference_owner_value_candidate_id;
  return unsigned;
}

function sourceOccurrenceSelfReferenceValueCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.source_occurrence_self_reference_value_candidate_id;
  return unsigned;
}

function agreementDateSourcePairReferenceValueCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.agreement_date_source_pair_reference_value_candidate_id;
  return unsigned;
}

function companyStockholdersMeetingEventReferenceValueCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.company_stockholders_meeting_event_reference_value_candidate_id;
  return unsigned;
}

function referenceValueMaterialisationCandidateUnsignedRecord(result) {
  const unsigned = structuredClone(result);
  delete unsigned.reference_value_materialisation_candidate_id;
  return unsigned;
}

function jsonPointerValue(root, pointer) {
  return pointer.slice(1).split('/').map(
    (token) => token.replace(/~1/g, '/').replace(/~0/g, '~'),
  ).reduce((value, token) => value[token], root);
}

function expectedTerminationPhase3ReferenceSlots(authority) {
  return authority.reference_ledger.filter(
    (row) => row.reference_classification === 'UNRESOLVED_REFERENCE_SLOT',
  ).map((row) => ({
    reference_slot_key: contentId(
      authority.unresolved_reference_slot_contract.identity_domain,
      {
        profile_key: row.profile_key,
        source_unit_key: row.source_unit_key,
        field_key: row.field_key,
      },
    ),
    profile_key: row.profile_key,
    source_unit_key: row.source_unit_key,
    field_key: row.field_key,
    materialisation_state:
      authority.unresolved_reference_slot_contract.materialisation_state,
    review_descriptor: row.review_descriptor,
  }));
}

function terminationReferenceMaterialisationSlotKey(row, reviewAuthority) {
  return contentId(reviewAuthority.unresolved_reference_slot_contract.identity_domain, {
    profile_key: row.profile_key,
    source_unit_key: row.source_unit_key,
    field_key: row.field_key,
  });
}

function terminationReferenceRowIdentity(row) {
  return [row.profile_key, row.source_unit_key, row.field_key].join('\0');
}

function terminationRowLocalProjectionTarget(
  descriptor,
  phase2Authority,
  governedSources,
) {
  const members = descriptor.evidence_payload.source_contract_members.map(
    ({ contract_path: contractPath, member }) => {
      const authorityMember = jsonPointerValue(phase2Authority, contractPath);
      assert.deepEqual(authorityMember, member, contractPath);
      return { contractPath, member: authorityMember };
    },
  );
  const subtype = descriptor.evidence_payload.evidence_subtype;
  if (
    subtype === 'SHARED_CHAPEAU_EFFECTIVE_TIME_OWNER_EVIDENCE'
    || subtype === 'SOURCE_PROVED_LINKED_RULE_TARGET_EVIDENCE'
  ) {
    const targets = members.filter(
      ({ member }) => member && typeof member === 'object'
        && Object.hasOwn(member, 'target_node_occurrence_id'),
    );
    assert.equal(targets.length, 1, descriptor.target_evidence_id);
    const target = targets[0].member.target_node_occurrence_id;
    assert.equal(LOWERCASE_HEX_64.test(target), true);
    assert.equal(members.some(
      ({ member }) => member && typeof member === 'object'
        && member.node_occurrence_id === target,
    ), true);
    return target;
  }

  assert.equal([
    'NATIVE_M3_DEFINED_TERM_OWNER_NON_EVENT_EVIDENCE',
    'NATIVE_M3_DEFINED_TERM_OWNER_EVENT_EVIDENCE',
  ].includes(subtype), true);
  const dependencies = members.filter(
    ({ member }) => member && typeof member === 'object'
      && Object.hasOwn(member, 'owner_node_occurrence_id'),
  );
  assert.equal(dependencies.length, 1, descriptor.target_evidence_id);
  const dependency = dependencies[0].member;
  const target = dependency.owner_node_occurrence_id;
  assert.equal(LOWERCASE_HEX_64.test(target), true);
  assert.equal(members.some(
    ({ member }) => member && typeof member === 'object'
      && member.node_occurrence_id === target,
  ), true);
  const agreementEvidence = governedSources
    .agreementEvidenceByAgreementId[descriptor.agreement_id];
  const edges = agreementEvidence.m3.record.definition_edges.filter(
    (edge) => edge.definition_edge_id === dependency.native_m3_definition_edge_id,
  );
  assert.equal(edges.length, 1, descriptor.target_evidence_id);
  assert.equal(edges[0].state, 'RESOLVED');
  assert.equal(edges[0].reason_code, 'UNIQUE_EXACT_DEFINITION_TARGET');
  assert.equal(edges[0].target_owner_node_occurrence_ids.includes(target), true);
  return target;
}

function terminationTargetEvidenceProjectionTarget(
  descriptor,
  phase2Authority,
  governedSources,
) {
  if (descriptor.evidence_kind === 'CANONICAL_TEXT_M2_SECTION_CITATION') {
    return descriptor.evidence_payload.m2_target.node_occurrence_id;
  }
  if (descriptor.evidence_kind === 'PHASE2_ROW_LOCAL_TARGET_EVIDENCE') {
    return terminationRowLocalProjectionTarget(
      descriptor,
      phase2Authority,
      governedSources,
    );
  }
  assert.equal(
    descriptor.evidence_kind,
    'RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE',
  );
  return descriptor.evidence_payload.m2_owner_node.node_occurrence_id;
}

function terminationReferenceSuccessorCandidateSet() {
  return [
    {
      sourceClass: 'REFERENCE_EDGE_VALUE',
      candidate: profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(
        terminationPhase3ReferenceEdgeValueFixture(),
      ),
      valueKey: 'reference_edge_values',
      reviewIdKey: 'reference_edge_target_string_review_id',
      expectedCount: 6,
    },
    {
      sourceClass: 'LINKED_RULE_REFERENCE_VALUE',
      candidate: profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        terminationPhase3LinkedRuleReferenceValueFixture(),
      ),
      valueKey: 'linked_rule_reference_values',
      reviewIdKey: 'linked_rule_reference_target_string_review_id',
      expectedCount: 10,
    },
    {
      sourceClass: 'RAW_M2_REFERENCE_OWNER_VALUE',
      candidate: profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        terminationPhase3RawM2ReferenceOwnerValueFixture(),
      ),
      valueKey: 'raw_m2_reference_owner_values',
      reviewIdKey: 'raw_m2_reference_owner_target_string_review_id',
      expectedCount: 7,
    },
    {
      sourceClass: 'SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE',
      candidate:
        profileAuthoring.prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          terminationPhase3SourceOccurrenceSelfReferenceValueFixture(),
        ),
      valueKey: 'source_occurrence_self_reference_values',
      reviewIdKey: 'source_occurrence_self_reference_target_string_review_id',
      expectedCount: 12,
    },
    {
      sourceClass: 'AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE',
      candidate:
        profileAuthoring.prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          terminationPhase3AgreementDateSourcePairReferenceValueFixture(),
        ),
      valueKey: 'agreement_date_source_pair_reference_values',
      reviewIdKey: 'agreement_date_source_pair_reference_target_string_review_id',
      expectedCount: 1,
    },
    {
      sourceClass: 'COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE',
      candidate:
        profileAuthoring
          .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
            terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(),
          ),
      valueKey: 'company_stockholders_meeting_event_reference_values',
      reviewIdKey:
        'company_stockholders_meeting_event_reference_target_string_review_id',
      expectedCount: 1,
    },
  ];
}

function expectedTerminationReferenceValueMaterialisation(fixture) {
  const reviewAuthority = fixture.terminationPhase3ReviewAuthority.record;
  const targetAuthority = fixture.terminationPhase3TargetEvidenceAuthority.record;
  const phase2Authority = fixture.terminationAuthoringPhase2Authority.record;
  const frontier = fixture
    .terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority.record;
  const bySlot = new Map();
  const add = (slotKey, source) => {
    assert.equal(bySlot.has(slotKey), false, `duplicate source ${slotKey}`);
    bySlot.set(slotKey, source);
  };

  for (const row of reviewAuthority.reference_ledger) {
    if (row.typed_value === null) continue;
    add(terminationReferenceMaterialisationSlotKey(row, reviewAuthority), {
      sourceClass: row.reference_classification
        === 'GOVERNED_SEMANTIC_FACT_KEY'
        ? 'PREDECESSOR_GOVERNED_REFERENCE_VALUE'
        : 'PREDECESSOR_DIRECT_REFERENCE_VALUE',
      typedValue: row.typed_value,
      sourceRecord: row,
    });
  }

  for (const descriptor of targetAuthority.reference_target_evidence_descriptors) {
    add(descriptor.reference_slot_key, {
      sourceClass: descriptor.evidence_kind,
      typedValue: terminationTargetEvidenceProjectionTarget(
        descriptor,
        phase2Authority,
        fixture.governedSources,
      ),
      sourceRecord: descriptor,
    });
  }

  const successorCandidates = terminationReferenceSuccessorCandidateSet();
  for (const entry of successorCandidates) {
    const values = entry.candidate[entry.valueKey];
    assert.equal(values.length, entry.expectedCount, entry.sourceClass);
    for (const value of values) {
      add(value.reference_slot_key, {
        sourceClass: entry.sourceClass,
        typedValue: value.proposed_reference_target_string,
        sourceRecord: value,
      });
    }
  }

  assert.equal(frontier.retained_company_letter_source_frontier.retained_unresolved_reference_slots.length, 1);
  assert.equal(frontier.retained_company_letter_source_frontier.retained_source_admission_gaps.length, 1);
  const retainedSlot = frontier.retained_company_letter_source_frontier.retained_unresolved_reference_slots[0];
  const retainedGap = frontier.retained_company_letter_source_frontier.retained_source_admission_gaps[0];
  assert.equal(
    retainedSlot.reference_slot_key,
    'b386c34a17e216f31b164dc1638a6a2310f357932aea083b923626e6ac0818ad',
  );
  assert.equal(
    retainedGap.source_admission_gap_id,
    '9f7a5e21e19e105e6ed6e4a45ce50dea9be3d8ffc2a4b4e1ccba87d3efbfed3b',
  );
  add(retainedSlot.reference_slot_key, {
    sourceClass: 'RETAINED_PRIVATE_COMPANY_LETTER_GAP',
    typedValue: null,
    sourceRecord: retainedGap,
  });
  assert.equal(bySlot.size, 221);

  const entries = reviewAuthority.reference_ledger.map((predecessorRow) => {
    const slotKey = terminationReferenceMaterialisationSlotKey(
      predecessorRow,
      reviewAuthority,
    );
    const source = bySlot.get(slotKey);
    assert(source, `missing source ${slotKey}`);
    return { predecessorRow, slotKey, ...source };
  });
  assert.equal(entries.length, 221);
  assert.equal(new Set(entries.map(({ slotKey }) => slotKey)).size, 221);
  assert.deepEqual(
    entries.map(({ predecessorRow }) => terminationReferenceRowIdentity(predecessorRow)),
    reviewAuthority.reference_ledger.map(terminationReferenceRowIdentity),
  );
  return { entries, successorCandidates, retainedGap, retainedSlot };
}

function collectKeyOccurrences(
  value,
  targetKey,
  path = [],
  result = [],
  seen = new Set(),
) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const childPath = [...path, Array.isArray(value) ? Number(key) : key];
    if (key === targetKey) result.push({ owner: value, path: childPath, value: value[key] });
    collectKeyOccurrences(value[key], targetKey, childPath, result, seen);
  }
  return result;
}

function collectStrings(value, result = [], seen = new Set()) {
  if (typeof value === 'string') {
    result.push(value);
    return result;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  Object.values(value).forEach((child) => collectStrings(child, result, seen));
  return result;
}

function collectLowercaseHex64(value, result = new Set(), seen = new Set()) {
  if (typeof value === 'string') {
    if (LOWERCASE_HEX_64.test(value)) result.add(value);
    return result;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  Object.values(value).forEach((child) => collectLowercaseHex64(child, result, seen));
  return result;
}

function collectObjectIdentities(value, result = new Set(), seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  result.add(value);
  Object.values(value).forEach((child) => collectObjectIdentities(child, result, seen));
  return result;
}

function assertDisjoint(left, right, label) {
  for (const value of left) assert.equal(right.has(value), false, `${label}: ${value}`);
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.byteLength}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function physicalBytes(binding) {
  const cached = PHYSICAL_BYTES_BY_PATH.get(binding.path);
  if (cached) {
    assert.equal(binding.byte_length, cached.byte_length, binding.path);
    assert.equal(binding.sha256, cached.sha256, binding.path);
    return cached.bytes;
  }
  const file = readFileSync(join(REPO_ROOT, binding.path));
  const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  assert.equal(bytes.byteLength, binding.byte_length, binding.path);
  assert.equal(sha256Hex(bytes), binding.sha256, binding.path);
  PHYSICAL_BYTES_BY_PATH.set(binding.path, {
    byte_length: bytes.byteLength,
    sha256: binding.sha256,
    bytes,
  });
  return bytes;
}

function physicalRecord(binding) {
  const bytes = physicalBytes(binding);
  const cached = PHYSICAL_BYTES_BY_PATH.get(binding.path);
  if (!Object.hasOwn(cached, 'record')) {
    cached.record = JSON.parse(
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8'),
    );
  }
  return cached.record;
}

function corruptFirstByte(source) {
  const bytes = new Uint8Array(source.bytes);
  bytes[0] ^= 1;
  source.bytes = bytes;
}

function sourceEnvelopeWithBytes(binding) {
  const bytes = physicalBytes(binding);
  return {
    binding: structuredClone(binding),
    bytes,
    record: physicalRecord(binding),
  };
}

function agreementIndexSourceEnvelope(binding) {
  const source = sourceEnvelopeWithBytes(binding);
  source.binding = {
    ...source.binding,
    git_blob_oid: gitBlobOid(source.bytes),
    record_id: source.record.agreement_index_id,
    record_id_field: 'agreement_index_id',
    schema_version: 'AGREEMENT_INDEX/V1',
  };
  return source;
}

function byteSourceEnvelope(binding) {
  return {
    binding: structuredClone(binding),
    bytes: physicalBytes(binding),
  };
}

function fixtureFingerprint(root) {
  const hash = createHash('sha256');
  const seen = new Set();
  const token = (kind, raw = '') => {
    const value = String(raw);
    hash.update(`${kind}${Buffer.byteLength(value, 'utf8')}:`, 'ascii');
    hash.update(value, 'utf8');
  };
  const visit = (value) => {
    if (value === null) {
      token('n');
      return;
    }
    if (value instanceof Uint8Array) {
      token('y', `${value.constructor.name}\0${value.byteLength}`);
      hash.update(value);
      return;
    }
    if (typeof value === 'string') {
      token('s', value);
      return;
    }
    if (typeof value === 'boolean') {
      token('b', value ? '1' : '0');
      return;
    }
    if (typeof value === 'undefined') {
      token('u');
      return;
    }
    if (typeof value === 'number') {
      token('d', Number.isNaN(value) ? 'NaN'
        : Object.is(value, -0) ? '-0' : String(value));
      return;
    }
    if (typeof value === 'bigint') {
      token('i', value);
      return;
    }
    if (typeof value !== 'object') {
      throw new TypeError(`unsupported fixture value: ${typeof value}`);
    }
    if (seen.has(value)) throw new TypeError('cyclic fixture');
    if (Object.getOwnPropertySymbols(value).some(
      (key) => Object.prototype.propertyIsEnumerable.call(value, key),
    )) throw new TypeError('symbol fixture key');
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        token('a', value.length);
      } else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new TypeError('non-plain fixture object');
        }
        token('o', prototype === null ? 'null' : 'plain');
      }
      const keys = Object.keys(value);
      token('k', keys.length);
      for (const key of keys) {
        token('p', key);
        visit(value[key]);
      }
      token('e');
    } finally {
      seen.delete(value);
    }
  };
  visit(root);
  return hash.digest('hex');
}

function buildNativeM3SourceSet(transitiveSources) {
  const c3 = readRecord(C3_PATH);
  const contextSetBinding = c3.agreement_index_set_authority
    .work2_sealed_set_bindings.find(
      (binding) => binding.schema_version === 'CONTEXT_COMPILATION_SET/V1',
    );
  const contextCompilationSetSource = sourceEnvelopeWithBytes(contextSetBinding);
  const m3ReceiptBindings = transitiveSources.slice(3, 28).map(
    (source) => source.record.m3_receipt_binding,
  );
  assert(m3ReceiptBindings.every(
    (binding) => canonicalJson(binding) === canonicalJson(m3ReceiptBindings[0]),
  ));
  const receiptSource = sourceEnvelopeWithBytes(m3ReceiptBindings[0]);
  const contextOutputs = receiptSource.record.output_bindings.filter(
    (binding) => binding.schema_version === 'CONTEXT_COMPILATION/V1',
  );
  assert.equal(contextOutputs.length, 7);
  const membersByAgreement = new Map(
    contextCompilationSetSource.record.members.map(
      (member) => [member.agreement_id, member.context_compilation_binding],
    ),
  );
  const contextCompilationSources = contextOutputs.map((output) => {
    const binding = membersByAgreement.get(output.agreement_id);
    assert(binding);
    assert.deepEqual({
      agreement_id: output.agreement_id,
      agreement_index_id: output.agreement_index_id,
      byte_length: binding.byte_length,
      context_compilation_id: binding.record_id,
      path: binding.path,
      schema_version: binding.schema_version,
      sha256: binding.sha256,
    }, output);
    return byteSourceEnvelope(binding);
  });
  return {
    receiptSource,
    contextCompilationSetSource,
    contextCompilationSources,
  };
}

function buildNativeM4SourceSet(transitiveSources) {
  const c3 = readRecord(C3_PATH);
  const analysisSetBinding = c3.agreement_index_set_authority
    .work2_sealed_set_bindings.find(
      (binding) => binding.schema_version === 'AGREEMENT_ANALYSIS_SET/V1',
    );
  const agreementAnalysisSetSource = sourceEnvelopeWithBytes(analysisSetBinding);
  const m4ReceiptBindings = transitiveSources.slice(3, 28).map(
    (source) => source.record.m4_receipt_binding,
  );
  assert(m4ReceiptBindings.every(
    (binding) => canonicalJson(binding) === canonicalJson(m4ReceiptBindings[0]),
  ));
  const receiptSource = sourceEnvelopeWithBytes(m4ReceiptBindings[0]);
  const analysisOutputs = receiptSource.record.output_bindings.filter(
    (binding) => binding.schema_version === 'AGREEMENT_ANALYSIS/V1',
  );
  assert.equal(analysisOutputs.length, 7);
  const membersByAgreement = new Map(
    agreementAnalysisSetSource.record.members.map(
      (member) => [member.agreement_id, member.agreement_analysis_binding],
    ),
  );
  const agreementAnalysisSources = analysisOutputs.map((output) => {
    const binding = membersByAgreement.get(output.agreement_id);
    assert(binding);
    assert.deepEqual({
      agreement_analysis_id: binding.record_id,
      agreement_id: output.agreement_id,
      byte_length: binding.byte_length,
      path: binding.path,
      schema_version: binding.schema_version,
      sha256: binding.sha256,
    }, output);
    return byteSourceEnvelope(binding);
  });
  return {
    receiptSource,
    agreementAnalysisSetSource,
    agreementAnalysisSources,
  };
}

function buildNativeAdditiveSourceSet() {
  const c3 = readRecord(C3_PATH);
  const authority = c3.agreement_index_set_authority;
  const rows = authority.immutable_source_promotion_contract.additive_three.exact_rows;
  assert.equal(rows.length, 3);
  return {
    receiptSource: sourceEnvelopeWithBytes(authority.additive_three_receipt_binding),
    members: rows.map((row) => ({
      agreement_id: row.agreement_id,
      agreementIndexSource: agreementIndexSourceEnvelope(row.m2_binding),
      contextCompilationSource: byteSourceEnvelope(row.m3_binding),
      agreementAnalysisSource: byteSourceEnvelope(row.m4_binding),
    })),
  };
}

function syntheticTransientEvidenceRequest(
  input,
  nativeM3SourceSet,
  answer = SYNTHETIC_TRANSIENT_ANSWER,
  additiveMember = null,
) {
  const output = additiveMember === null
    ? nativeM3SourceSet.receiptSource.record.output_bindings.find(
      (binding) => binding.schema_version === 'CONTEXT_COMPILATION/V1',
    ) : {
      agreement_id: additiveMember.agreement_id,
      context_compilation_id:
        additiveMember.contextCompilationSource.binding.record_id,
    };
  const contextSource = additiveMember === null
    ? nativeM3SourceSet.contextCompilationSources.find(
      (source) => source.binding.record_id === output.context_compilation_id,
    ) : additiveMember.contextCompilationSource;
  const context = JSON.parse(Buffer.from(contextSource.bytes).toString('utf8'));
  const reference = context.reference_edges.find(
    (edge) => edge.state === 'RESOLVED'
      && edge.target_node_occurrence_ids.length === 1
      && edge.selected_target_node_occurrence_id === edge.target_node_occurrence_ids[0],
  );
  assert(reference);
  const scope = context.scope_edges.find(
    (edge) => edge.state === 'RESOLVED'
      && (edge.source_node_occurrence_id === reference.owner_node_occurrence_id
        || edge.target_node_occurrence_id === reference.owner_node_occurrence_id),
  );
  assert(scope);
  const scopeEdgeIds = context.scope_edges.filter((edge) => (
    edge.source_node_occurrence_id === scope.source_node_occurrence_id
      && edge.target_node_occurrence_id === scope.target_node_occurrence_id
      && edge.edge_kind === scope.edge_kind
      && edge.rule_id === scope.rule_id
      && edge.rule_version === scope.rule_version
      && canonicalJson(edge.proof) === canonicalJson(scope.proof)
  )).map((edge) => edge.scope_edge_id).sort();
  const nodeOccurrenceIds = [...new Set([
    scope.source_node_occurrence_id,
    scope.target_node_occurrence_id,
    scope.proof.shared_parent_node_occurrence_id,
    reference.owner_node_occurrence_id,
    reference.selected_target_node_occurrence_id,
  ].filter((nodeId) => nodeId !== null))].sort();
  const indexSource = additiveMember === null
    ? input.nativeM2SourceSet.agreementIndexSources.find(
      (source) => source.record.source_binding.agreement_id === output.agreement_id,
    ) : additiveMember.agreementIndexSource;
  assert(indexSource);
  const nativeNodeIds = new Set(indexSource.record.nodes.map(
    (node) => node.node_occurrence_id,
  ));
  assert(nodeOccurrenceIds.every((nodeId) => nativeNodeIds.has(nodeId)));
  return {
    family_key: answer.family_key,
    profile_key: answer.profile_key,
    field_key: answer.field_key,
    agreement_id: output.agreement_id,
    node_occurrence_ids: nodeOccurrenceIds,
    scope_edge_ids: scopeEdgeIds,
    reference_edge_ids: [reference.reference_edge_id],
  };
}

function buildProfileSourceFixture({
  transientReviewAnswers = [],
  transientReviewEvidenceRequests = [],
} = {}) {
  const c3 = readRecord(C3_PATH);
  const sourceContract = c3.work3_scope_contract.family_packet_set_source_contract;
  assert.deepEqual(sourceContract.binding, EXPECTED_PACKET_BINDING);
  const familyPacketSetSource = sourceEnvelope(sourceContract.binding);
  const packet = familyPacketSetSource.record;
  const expectedBindings = [
    packet.repair_baseline_binding,
    packet.calibration_ruling_map_binding,
    packet.fixed_sample_identity_binding,
    ...packet.families.map((family) => family.calibration_pack_binding),
    packet.work0_evidence_root_binding,
    packet.lawyer_review_packet_binding,
  ];
  assert.equal(expectedBindings.length, 30);
  assert.deepEqual(
    expectedBindings.map((binding) => binding.path),
    sourceContract.transitive_binding_paths,
  );
  const transitiveSources = expectedBindings.map(sourceEnvelope);
  const m2ReceiptBindings = transitiveSources.slice(3, 28).map(
    (source) => source.record.m2_receipt_binding,
  );
  assert(m2ReceiptBindings.every(
    (binding) => canonicalJson(binding) === canonicalJson(m2ReceiptBindings[0]),
  ));
  const receiptSource = sourceEnvelopeWithBytes(m2ReceiptBindings[0]);
  const fixture = {
    familyPacketSetSource,
    transitiveSources,
    transientReviewAnswers: structuredClone(transientReviewAnswers),
    transientReviewEvidenceRequests: structuredClone(transientReviewEvidenceRequests),
    nativeM2SourceSet: {
      receiptSource,
      agreementIndexSources: receiptSource.record.output_bindings.map(
        agreementIndexSourceEnvelope,
      ),
    },
  };
  fixture.nativeM3SourceSet = buildNativeM3SourceSet(transitiveSources);
  fixture.nativeM4SourceSet = buildNativeM4SourceSet(transitiveSources);
  fixture.nativeAdditiveSourceSet = buildNativeAdditiveSourceSet();
  return fixture;
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Reflect.ownKeys(value).every((key) => isDeepFrozen(value[key], seen));
}

function collectKeys(value, result = new Set(), seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    result.add(key);
    collectKeys(child, result, seen);
  }
  return result;
}

function expectCode(code, operation) {
  assert.throws(operation, (error) => (
    error instanceof profileAuthoring.M7V2ProfileAuthoringError
    && error.code === code
    && error.message.startsWith(`${code}:`)
    && isDeepFrozen(error.details)
  ));
}

function forkAdditiveFixture(base) {
  return {
    ...base,
    nativeAdditiveSourceSet: {
      ...base.nativeAdditiveSourceSet,
      members: base.nativeAdditiveSourceSet.members.slice(),
    },
  };
}

function forkAdditiveReceipt(fixture) {
  const source = fixture.nativeAdditiveSourceSet.receiptSource;
  const fork = { ...source, binding: { ...source.binding } };
  fixture.nativeAdditiveSourceSet.receiptSource = fork;
  return fork;
}

function forkAdditiveMemberSource(fixture, index, sourceKey) {
  const member = { ...fixture.nativeAdditiveSourceSet.members[index] };
  const source = { ...member[sourceKey], binding: { ...member[sourceKey].binding } };
  member[sourceKey] = source;
  fixture.nativeAdditiveSourceSet.members[index] = member;
  return source;
}

test('Work3 profile source adapter closes the exact additive three in memory', () => {
  const input = buildProfileSourceFixture();
  const before = fixtureFingerprint(input);
  const result = profileAuthoring.prepareFamilyProfileGapReview(input);
  assert.equal(fixtureFingerprint(input), before);
  assert.equal(isDeepFrozen(result), true);
  assert.deepEqual({
    receipt_record_id:
      result.source_closure.native_additive_source_closure.receipt_binding.record_id,
    source_count: result.source_closure.native_additive_source_closure.source_count,
    m2_record_ids: result.source_closure.native_additive_source_closure
      .agreement_index_bindings.map((binding) => binding.record_id),
    m3_record_ids: result.source_closure.native_additive_source_closure
      .context_compilation_bindings.map((binding) => binding.record_id),
    m4_record_ids: result.source_closure.native_additive_source_closure
      .agreement_analysis_bindings.map((binding) => binding.record_id),
  }, {
    receipt_record_id:
      'fab7777f867f090b77f25e320324f9b7ae0942a9fd53a4f47571f7305835316e',
    source_count: 3,
    m2_record_ids: [
      '00ae4e2e5b06cbf5b897d25194fa352652e62e67d49bd2635099ddff8e2b92b3',
      'cae4e394148e52ee379e8a3676efcbedeac52f6b204a4bc9c3a6e50d4cca0d23',
      '03b347c39651d3ef5e7a87ed87a21c4db657379c5df2d374adc9485a14e2239f',
    ],
    m3_record_ids: [
      '2cfdbcd78747fdb89b8cc02d1ca634da0acf6894f8cfe213538d86c34adfb745',
      '0685610f673e20b2a15c7bb12983351d581fb920d2cac76b26aa54979628ae8b',
      '4a4db3a3a24ed6d1abdd64ed6d9e1f64957e2e0fa1527f2c49ac9d59c9c4ebe6',
    ],
    m4_record_ids: [
      '222d36d8a020fff58303b2aee2736ed336c628ba44ee814f70856a4f0024ea5a',
      'f69b8799dddc051eff93f258a1ee4cd254967cc3038ca0ec226fee2492e6ce93',
      '6cedcf8101a5e2d1607706f5aac1647886b6fc13197bdb6e35f0b616b193e7b5',
    ],
  });
  assert.equal(collectKeys(result.source_closure).has('bytes'), false);
});

test('Work3 profile source adapter requires the native additive source set', () => {
  const input = buildProfileSourceFixture();
  delete input.nativeAdditiveSourceSet;
  expectCode(
    'M7_V2_PROFILE_SOURCE_OPTIONS',
    () => profileAuthoring.prepareFamilyProfileGapReview(input),
  );
});

test('Work3 profile source adapter closes governed samples to exact native M2 text', () => {
  const input = buildProfileSourceFixture();
  const result = profileAuthoring.prepareFamilyProfileGapReview(input);
  const governed = result.family_dossiers.flatMap(
    (dossier) => dossier.governed_sample_evidence,
  );
  assert.equal(governed.length, 49);
  assert(governed.every((entry) => (
    Object.keys(entry).sort().join(',')
      === 'agreement_index_id,family_packet_sample,lawyer_review_item'
    && /^[0-9a-f]{64}$/.test(entry.agreement_index_id)
  )));
  const m2ByAgreement = new Map([
    ...input.nativeM2SourceSet.agreementIndexSources.map((source) => [
      source.record.source_binding.agreement_id,
      source,
    ]),
    ...input.nativeAdditiveSourceSet.members.map((member) => [
      member.agreement_id,
      member.agreementIndexSource,
    ]),
  ]);
  const fixedByOrdinal = new Map(
    input.transitiveSources[2].record.members.map(
      (member) => [member.sample_ordinal, member],
    ),
  );
  for (const evidence of governed) {
    const sample = evidence.family_packet_sample;
    const span = sample.source_spans[0];
    const m2Source = m2ByAgreement.get(sample.agreement_id);
    const fixed = fixedByOrdinal.get(sample.sample_ordinal);
    assert(m2Source);
    assert(fixed);
    const exactText = utf8Slice(
      m2Source.record.source_binding.canonical_text,
      span.start_byte,
      span.end_byte,
    );
    assert.equal(evidence.agreement_index_id, m2Source.binding.record_id);
    assert.equal(fixed.review_item_id, sample.review_item_id);
    assert.equal(fixed.family_key, evidence.lawyer_review_item.family_key);
    assert.deepEqual(fixed.source_spans, sample.source_spans);
    assert.deepEqual(fixed.source_node_occurrence_ids, sample.source_node_occurrence_ids);
    assert.deepEqual(fixed.agreement_index_binding, {
      byte_length: m2Source.binding.byte_length,
      path: m2Source.binding.path,
      record_id: m2Source.binding.record_id,
      record_id_field: m2Source.binding.record_id_field,
      schema_version: m2Source.binding.schema_version,
      sha256: m2Source.binding.sha256,
    });
    assert.equal(evidence.lawyer_review_item.source_excerpt, exactText);
    assert.equal(sha256Hex(exactText), sample.source_excerpt_sha256);
  }
  const maeSamples = input.familyPacketSetSource.record.families.find(
    (family) => family.family_key === 'MAE_DEFINITION',
  ).sample_members.filter((sample) => [47, 48].includes(sample.sample_ordinal));
  assert.deepEqual(maeSamples.map((sample) => sample.sample_ordinal), [47, 48]);
  for (const sample of maeSamples) {
    const evidence = governed.find(
      (entry) => entry.family_packet_sample.sample_ordinal === sample.sample_ordinal,
    );
    assert(evidence);
    assert.equal(
      evidence.agreement_index_id,
      'cae4e394148e52ee379e8a3676efcbedeac52f6b204a4bc9c3a6e50d4cca0d23',
    );
  }
  const item39 = input.familyPacketSetSource.record.structure_ambiguity_members[0];
  const fixed39 = fixedByOrdinal.get(39);
  const item39M2 = m2ByAgreement.get(item39.agreement_id);
  const item39Span = item39.source_spans[0];
  const item39Text = utf8Slice(
    item39M2.record.source_binding.canonical_text,
    item39Span.start_byte,
    item39Span.end_byte,
  );
  assert.equal(sha256Hex(item39Text), item39.source_excerpt_sha256);
  assert.equal(fixed39.ambiguity_id, item39.ambiguity_id);
  assert.deepEqual(fixed39.source_spans, item39.source_spans);
  const item39Review = input.transitiveSources[29].record.items.find(
    (item) => item.sample_ordinal === 39,
  );
  assert(result.rendered_review_text.includes(canonicalJson({
    agreement_index_id: item39M2.binding.record_id,
    family_packet_structure_decision: item39,
    fixed_sample_identity: fixed39,
    lawyer_review_item: item39Review,
  })));
  assert(result.rendered_review_text.includes(
    `AGREEMENT_INDEX_ID: ${item39M2.binding.record_id}`,
  ));
  assert(result.rendered_review_text.includes(item39Text));
});

test('Work3 profile source adapter rejects additive source drift in fixed order', async (t) => {
  const base = buildProfileSourceFixture();
  const cases = [
    {
      name: 'receipt binding',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_RECEIPT_BINDING',
      mutate: (fixture) => {
        forkAdditiveReceipt(fixture).binding.sha256 = '0'.repeat(64);
      },
    },
    {
      name: 'receipt bytes',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_RECEIPT_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(forkAdditiveReceipt(fixture));
      },
    },
    {
      name: 'member count',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_COUNT',
      mutate: (fixture) => {
        fixture.nativeAdditiveSourceSet.members.pop();
      },
    },
    {
      name: 'member row order',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_PATH_ORDER',
      mutate: (fixture) => {
        fixture.nativeAdditiveSourceSet.members.reverse();
      },
    },
    {
      name: 'M2 binding',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_M2_BINDING',
      mutate: (fixture) => {
        forkAdditiveMemberSource(
          fixture, 0, 'agreementIndexSource',
        ).binding.sha256 = '0'.repeat(64);
      },
    },
    {
      name: 'M2 bytes',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_M2_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(forkAdditiveMemberSource(
          fixture, 0, 'agreementIndexSource',
        ));
      },
    },
    {
      name: 'M3 binding',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_M3_BINDING',
      mutate: (fixture) => {
        forkAdditiveMemberSource(
          fixture, 0, 'contextCompilationSource',
        ).binding.sha256 = '0'.repeat(64);
      },
    },
    {
      name: 'M3 bytes',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_M3_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(forkAdditiveMemberSource(
          fixture, 0, 'contextCompilationSource',
        ));
      },
    },
    {
      name: 'M4 binding',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_M4_BINDING',
      mutate: (fixture) => {
        forkAdditiveMemberSource(
          fixture, 0, 'agreementAnalysisSource',
        ).binding.sha256 = '0'.repeat(64);
      },
    },
    {
      name: 'M4 bytes',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_M4_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(forkAdditiveMemberSource(
          fixture, 0, 'agreementAnalysisSource',
        ));
      },
    },
    {
      name: 'receipt binding precedes member count',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_RECEIPT_BINDING',
      mutate: (fixture) => {
        forkAdditiveReceipt(fixture).binding.sha256 = '0'.repeat(64);
        fixture.nativeAdditiveSourceSet.members.pop();
      },
    },
    {
      name: 'member row order precedes M2 bytes',
      code: 'M7_V2_PROFILE_NATIVE_ADDITIVE_PATH_ORDER',
      mutate: (fixture) => {
        fixture.nativeAdditiveSourceSet.members.reverse();
        corruptFirstByte(forkAdditiveMemberSource(
          fixture, 0, 'agreementIndexSource',
        ));
      },
    },
  ];
  for (const { name, code, mutate } of cases) {
    await t.test(name, () => {
      const fixture = forkAdditiveFixture(base);
      mutate(fixture);
      expectCode(code, () => profileAuthoring.prepareFamilyProfileGapReview(fixture));
    });
  }
  for (const [path, cached] of PHYSICAL_BYTES_BY_PATH) {
    assert.equal(cached.bytes.byteLength, cached.byte_length, path);
    assert.equal(sha256Hex(cached.bytes), cached.sha256, path);
  }
});

test('Work3 profile source adapter closes exact thirty sources and renders no-default gap review', async (t) => {
  assert.deepEqual(Object.keys(profileAuthoring).sort(), [
    'M7V2ProfileAuthoringError',
    'prepareFamilyProfileGapReview',
    'prepareTerminationAgreementDateSourcePairReferenceValueCandidate',
    'prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate',
    'prepareTerminationFamilyProfilePackageResolution',
    'prepareTerminationFamilyProfilePackageReview',
    'prepareTerminationFamilyProposal',
    'prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview',
    'prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview',
    'prepareTerminationLinkedRuleReferenceValueCandidate',
    'prepareTerminationRawM2ReferenceOwnerValueCandidate',
    'prepareTerminationReferenceEdgeValueCandidate',
    'prepareTerminationReferenceReviewCandidate',
    'prepareTerminationReferenceSourceNormaliserCandidate',
    'prepareTerminationReferenceTargetEvidenceCandidate',
    'prepareTerminationReferenceValueMaterialisationCandidate',
    'prepareTerminationSourceOccurrenceSelfReferenceValueCandidate',
    'prepareTerminationWork3StageBBlueprintProposal',
  ]);

  const input = buildProfileSourceFixture();
  const before = fixtureFingerprint(input);
  const result = profileAuthoring.prepareFamilyProfileGapReview(input);
  assert.equal(fixtureFingerprint(input), before);
  assert.equal(isDeepFrozen(result), true);
  assert.notEqual(result.source_closure.family_packet_set_source, input.familyPacketSetSource);
  assert.deepEqual(Object.keys(result), RESULT_KEYS);
  assert.deepEqual(Object.keys(result.source_closure), SOURCE_CLOSURE_KEYS);
  assert.deepEqual(Object.keys(result.counts), COUNT_KEYS);
  assert.equal(result.state, 'REVIEW_ONLY_AWAITING_BEN_APPROVAL');
  assert.equal(result.source_closure.source_count, 30);
  assert.deepEqual(result.source_closure.native_m2_source_closure, {
    receipt_binding: input.nativeM2SourceSet.receiptSource.binding,
    agreement_index_bindings: input.nativeM2SourceSet.agreementIndexSources.map(
      (source) => source.binding,
    ),
    source_count: 7,
  });
  assert.deepEqual(result.source_closure.native_m3_source_closure, {
    receipt_binding: input.nativeM3SourceSet.receiptSource.binding,
    context_compilation_set_binding:
      input.nativeM3SourceSet.contextCompilationSetSource.binding,
    context_compilation_bindings: input.nativeM3SourceSet.contextCompilationSources.map(
      (source) => source.binding,
    ),
    source_count: 7,
  });
  assert.deepEqual(result.source_closure.native_m4_source_closure, {
    receipt_binding: input.nativeM4SourceSet.receiptSource.binding,
    agreement_analysis_set_binding:
      input.nativeM4SourceSet.agreementAnalysisSetSource.binding,
    agreement_analysis_bindings: input.nativeM4SourceSet.agreementAnalysisSources.map(
      (source) => source.binding,
    ),
    source_count: 7,
  });
  assert.deepEqual(result.transient_review_evidence, []);
  assert.equal(collectKeys(result.source_closure).has('bytes'), false);
  assert.deepEqual(result.counts, {
    source_count: 30,
    family_count: 25,
    candidate_subtype_count: 171,
    evidence_covered_candidate_subtype_count: 25,
    remaining_candidate_subtype_count: 146,
    source_example_count: 143,
    historical_calibration_question_count: 75,
    open_programme_question_count: 0,
    packet_sample_count: 49,
    structure_ambiguity_count: 1,
    governed_review_item_count: 50,
    comparator_binding_count: 130,
    supplemental_binding_count: 10,
    cross_family_dependency_count: 0,
  });
  assert.equal(Object.hasOwn(result.counts, 'open_legal_question_count'), false);
  assert.equal(result.rows.length, 25);
  assert.equal(result.family_dossiers.length, 25);
  assert.deepEqual(
    Object.keys(result.family_package_authoring_work_queue),
    AUTHORING_QUEUE_KEYS,
  );
  assert.equal(
    result.family_package_authoring_work_queue.state,
    'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW',
  );
  assert.equal(result.family_package_authoring_work_queue.storage, 'IN_MEMORY_ONLY');
  assert.equal(result.family_package_authoring_work_queue.families.length, 25);

  for (const [index, row] of result.rows.entries()) {
    const dossier = result.family_dossiers[index];
    const authoringFamily = result.family_package_authoring_work_queue.families[index];
    assert.deepEqual(Object.keys(row), ROW_KEYS);
    assert.deepEqual(Object.keys(dossier), DOSSIER_KEYS);
    assert.deepEqual(Object.keys(authoringFamily), AUTHORING_FAMILY_KEYS);
    assert.equal(row.family_key, result.source_closure.family_keys[index]);
    assert.equal(authoringFamily.family_key, row.family_key);
    assert.equal(authoringFamily.state, 'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW');
    assert.deepEqual(
      authoringFamily.source_candidate_subtype_ids,
      row.candidate_subtype_profile_ids,
    );
    assert.deepEqual(
      authoringFamily.evidence_covered_candidate_subtype_ids,
      [row.first_evidence_covered_candidate_subtype_id],
    );
    assert.deepEqual(
      authoringFamily.source_deferred_candidate_subtype_ids,
      row.deferred_candidate_subtype_ids,
    );
    assert.deepEqual(
      authoringFamily.source_positive_example_ids,
      row.positive_evidence_example_ids,
    );
    assert.deepEqual(
      authoringFamily.controlling_programme_ruling_ids,
      EXPECTED_PROGRAMME_RULING_IDS,
    );
    assert.deepEqual(authoringFamily.transient_review_answers, []);
    assert.deepEqual(authoringFamily.transient_review_evidence, []);
    assert.deepEqual(
      authoringFamily.authoring_sections.map((section) => section.section_key),
      EXPECTED_AUTHORING_SECTION_KEYS,
    );
    assert(authoringFamily.authoring_sections.every((section) => (
      Object.keys(section).length === AUTHORING_SECTION_KEYS.length
      && AUTHORING_SECTION_KEYS.every((key) => Object.hasOwn(section, key))
      && section.state === 'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW'
    )));
    assert.equal(
      row.first_evidence_covered_candidate_subtype_id,
      EXPECTED_FIRST_CANDIDATES[row.family_key],
    );
    assert.deepEqual(row.proposed_approved_candidate_subtype_ids, [
      row.first_evidence_covered_candidate_subtype_id,
    ]);
    assert.deepEqual(
      row.deferred_candidate_subtype_ids,
      row.candidate_subtype_profile_ids.slice(1),
    );
    assert.equal(row.candidate_subtype_count, row.candidate_subtype_profile_ids.length);
    assert.equal(
      row.deferred_candidate_subtype_count,
      row.deferred_candidate_subtype_ids.length,
    );
    assert.equal(row.review_state, 'REVIEW_ONLY_AWAITING_BEN_APPROVAL');
    assert.equal(row.proposed_tree_completeness_state, 'TREE_OUTPUT_INCOMPLETE');
    assert(row.positive_evidence_example_ids.length > 0);
    assert.equal(dossier.family_key, row.family_key);
    assert(result.rendered_review_text.includes(canonicalJson(
      input.familyPacketSetSource.record.families[index],
    )));
    assert(result.rendered_review_text.includes(canonicalJson(
      input.transitiveSources[index + 3].record,
    )));
    for (const candidateId of row.candidate_subtype_profile_ids) {
      assert(result.rendered_review_text.includes(candidateId));
    }
  }
  const authoringQueueKeys = collectKeys(result.family_package_authoring_work_queue);
  for (const forbidden of [
    'schema_version',
    'family_profile_package_id',
    'profile_set_version',
    'family_approval',
    'family_approval_id',
    'ben_approval_id',
    'approved_inventory_digest',
    'legal_decisions',
    'profiles',
    'profile_id',
    'subtype_tree',
    'subtype_tree_id',
    'match_fixtures',
    'match_fixture_id',
    'dimension_evidence',
    'dimension_evidence_id',
    'structure_fixture_members',
    'fixture_id',
    'binding',
    'path',
    'bytes',
  ]) {
    assert.equal(authoringQueueKeys.has(forbidden), false);
  }

  const capitalisation = result.family_dossiers.find(
    (dossier) => dossier.family_key === 'CAPITALISATION',
  );
  assert.equal(capitalisation.calibration_pack_source.record.comparator_run_bindings.length, 0);
  assert.equal(capitalisation.calibration_pack_source.record.supplemental_input_bindings.length, 5);
  assert.equal(result.rendered_review_text.includes(MISSING_SOURCE_TEXT), false);
  assert(result.family_dossiers.every(
    (dossier) => dossier.source_text_gap_example_ids.length === 0,
  ));
  assert.equal(
    result.family_dossiers.reduce(
      (count, dossier) => count + dossier.provision_example_evidence.length,
      0,
    ),
    143,
  );
  const termination = result.family_dossiers.find(
    (dossier) => dossier.family_key === 'TERMINATION',
  );
  const redHat = termination.provision_example_evidence.find(
    (evidence) => evidence.provision_example.example_id === 'TERMINATION-EX-03',
  );
  assert.equal(redHat.source_text_state, 'BOUND_NATIVE_M2_TEXT_AVAILABLE');
  assert.match(redHat.source_excerpt, /^Section 7\.01 Termination\./);
  assert.match(redHat.source_excerpt, /notice of its intent to terminate this Agreement/);
  const orderedSources = [input.familyPacketSetSource, ...input.transitiveSources];
  for (const source of orderedSources) {
    assert(result.rendered_review_text.includes(canonicalJson(source.binding)));
    for (const stateKey of [
      'stage',
      'state',
      'status',
      'packet_state',
      'gate_state',
      'lifecycle_state',
      'purpose',
    ]) {
      if (stateKey in source.record) {
        assert(result.rendered_review_text.includes(
          `${stateKey}=${JSON.stringify(source.record[stateKey])}`,
        ));
      }
    }
  }
  assert(result.rendered_review_text.includes(
    'gate_state="FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR"',
  ));
  assert(result.rendered_review_text.includes(
    'lifecycle_state="SEALED_WORK0_ONLY"',
  ));
  assert(result.rendered_review_text.includes(
    'purpose="LEGAL_CALIBRATION_PREPARATION_ONLY"',
  ));
  const structureDecision = input.familyPacketSetSource.record.structure_ambiguity_members[0];
  const lawyerReviewPacket = input.transitiveSources[29].record;
  const structureReviewItem = lawyerReviewPacket.items.find(
    (item) => item.sample_ordinal === structureDecision.sample_ordinal,
  );
  assert(result.rendered_review_text.includes(canonicalJson(structureDecision)));
  assert(result.rendered_review_text.includes(canonicalJson(structureReviewItem)));
  const expectedProgrammeResolutions = [
    {
      programme_question_id: 'PROGRAMME-Q01',
      ruling_id: 'M5-RULING-ONE-OPERATIVE-LIMB',
      selection: 'ONE_COMPOUND_PROPOSITION',
    },
    {
      programme_question_id: 'PROGRAMME-Q02',
      ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
      selection: 'ONE_OWNER_WITH_LINKED_CONSUMERS',
    },
    {
      programme_question_id: 'PROGRAMME-Q03',
      ruling_id: 'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
      selection: 'FAIL_ONLY_THE_DEPENDENT_PROPOSITION',
    },
  ];
  for (const [index, packSource] of input.transitiveSources.slice(3, 28).entries()) {
    const mappings = result.family_dossiers[index].programme_rulings;
    assert.deepEqual(
      mappings.map((mapping) => mapping.family_question_id),
      packSource.record.narrow_legal_questions.map((question) => question.question_id),
    );
    assert.deepEqual(
      mappings.map((mapping) => ({
        programme_question_id: mapping.programme_question_id,
        ruling_id: mapping.ruling_id,
        selection: mapping.selection,
      })),
      expectedProgrammeResolutions,
    );
    for (const question of packSource.record.narrow_legal_questions) {
      assert(result.rendered_review_text.includes(canonicalJson(question)));
    }
    for (const mapping of mappings) {
      assert(result.rendered_review_text.includes(
        `${mapping.family_question_id} | REBOUND_TO ${mapping.ruling_id} | ${mapping.selection}`,
      ));
    }
  }
  assert.match(
    result.rendered_review_text,
    /EXACT CALIBRATION PACK EVIDENCE: HISTORICAL STATUS FIELDS ARE NOT CURRENT OPEN QUESTIONS/,
  );
  assert.match(
    result.rendered_review_text,
    /SEALED PROGRAMME QUESTION RESOLUTIONS: CONTROLLING AUTHORITY, DO NOT RE-ASK/,
  );
  assert.match(
    result.rendered_review_text,
    /HISTORICAL CALIBRATION QUESTIONS: ALL REBOUND, DO NOT RE-ASK/,
  );
  assert.doesNotMatch(result.rendered_review_text, /SOURCE NARROW LEGAL QUESTIONS/);
  assert.doesNotMatch(result.rendered_review_text, /GENERAL PROGRAMME RULINGS/);
  assert.match(
    result.rendered_review_text,
    /REQUIRED PACKAGE AUTHORING SECTIONS: NOT BEN QUESTIONS/,
  );
  assert.match(
    result.rendered_review_text,
    /FUTURE WORK 5 BEN REVIEW ITEMS: NOT WORK 3 BLOCKERS/,
  );
  assert.match(result.rendered_review_text, /FAMILY PACKAGES READY FOR APPROVAL: 0 OF 25/);
  assert.match(result.rendered_review_text, /FAMILY APPROVAL RECORDS ISSUED: 0 OF 25/);
  assert.doesNotMatch(result.rendered_review_text, /REQUIRED BEN DECISIONS/);
  assert.doesNotMatch(result.rendered_review_text, /BEN_RULING_REQUIRED/);
  assert.doesNotMatch(result.rendered_review_text, /\n- FRESH_WORK5_RULING_REQUIRED:/);
  const forbiddenKeys = collectKeys(result.rows);
  for (const forbidden of [
    'ben_approval_id',
    'family_approval_id',
    'approved_inventory_digest',
    'family_profile_package_id',
    'profile_id',
    'subtype_tree_id',
    'canonical_bytes',
  ]) {
    assert.equal(forbiddenKeys.has(forbidden), false);
    assert.equal(result.rendered_review_text.includes(`"${forbidden}":`), false);
  }
  assert.equal(
    canonicalJson(profileAuthoring.prepareFamilyProfileGapReview(buildProfileSourceFixture())),
    canonicalJson(result),
  );

  await t.test('cached physical bytes use copy-on-write drift isolation', () => {
    const baseline = input.nativeM3SourceSet.contextCompilationSources[0];
    const drift = byteSourceEnvelope(baseline.binding);
    assert.strictEqual(drift.bytes, baseline.bytes);
    corruptFirstByte(drift);
    assert.notStrictEqual(drift.bytes, baseline.bytes);
    assert.equal(sha256Hex(baseline.bytes), baseline.binding.sha256);
    assert.notEqual(sha256Hex(drift.bytes), drift.binding.sha256);
  });

  const oneDeltaCases = [
    {
      code: 'M7_V2_PROFILE_SOURCE_OPTIONS',
      mutate: (fixture) => ({ ...fixture, extra: true }),
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_PACKET_ENVELOPE',
      mutate: (fixture) => {
        fixture.familyPacketSetSource.extra = true;
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_PACKET_BINDING',
      mutate: (fixture) => {
        fixture.familyPacketSetSource.binding.sha256 = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_PACKET_RECORD',
      mutate: (fixture) => {
        fixture.familyPacketSetSource.record.stage = 'DRIFT';
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_COUNT',
      mutate: (fixture) => {
        fixture.transitiveSources.pop();
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_ENVELOPE',
      mutate: (fixture) => {
        fixture.transitiveSources[0].extra = true;
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_PATH_ORDER',
      mutate: (fixture) => {
        [fixture.transitiveSources[0], fixture.transitiveSources[1]] = [
          fixture.transitiveSources[1], fixture.transitiveSources[0],
        ];
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_BINDING',
      mutate: (fixture) => {
        fixture.transitiveSources[0].binding.sha256 = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_SOURCE_RECORD',
      mutate: (fixture) => {
        fixture.transitiveSources[0].record.__drift = true;
        return fixture;
      },
    },
    {
      name: 'SEALED_RULING_MAP_DRIFT_PRECEDES_HISTORICAL_PACK_DRIFT',
      code: 'M7_V2_PROFILE_SOURCE_RECORD',
      mutate: (fixture) => {
        fixture.transitiveSources[1].record.counts.question_count = 74;
        fixture.transitiveSources[3].record.narrow_legal_questions[0].status = 'DRIFT';
        return fixture;
      },
    },
    {
      name: 'SEALED_RULING_MAP_BINDING_DRIFT_PRECEDES_TRANSIENT_DRIFT',
      code: 'M7_V2_PROFILE_SOURCE_BINDING',
      mutate: (fixture) => {
        fixture.transitiveSources[1].binding.sha256 = '0'.repeat(64);
        fixture.transientReviewAnswers = {};
        return fixture;
      },
    },
    {
      name: 'M7_V2_PROFILE_SOURCE_RECORD_PRETTY_BYTE_ORDER',
      code: 'M7_V2_PROFILE_SOURCE_RECORD',
      mutate: (fixture) => {
        fixture.transitiveSources[3].record = Object.fromEntries(
          Object.entries(fixture.transitiveSources[3].record).reverse(),
        );
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_ENVELOPE',
      mutate: (fixture) => {
        fixture.nativeM2SourceSet.extra = true;
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_RECEIPT_BINDING',
      mutate: (fixture) => {
        fixture.nativeM2SourceSet.receiptSource.binding.sha256 = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_RECEIPT_RECORD',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM2SourceSet.receiptSource);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_COUNT',
      mutate: (fixture) => {
        fixture.nativeM2SourceSet.agreementIndexSources.pop();
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_PATH_ORDER',
      mutate: (fixture) => {
        const sources = fixture.nativeM2SourceSet.agreementIndexSources;
        [sources[0], sources[1]] = [sources[1], sources[0]];
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_BINDING',
      mutate: (fixture) => {
        fixture.nativeM2SourceSet.agreementIndexSources[0]
          .binding.schema_version = 'AGREEMENT_INDEX/V0';
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM2SourceSet.agreementIndexSources[0]);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M2_RECORD',
      mutate: (fixture) => {
        const source = fixture.nativeM2SourceSet.agreementIndexSources[0];
        source.record = structuredClone(source.record);
        source.record.agreement_index_id = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_ENVELOPE',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.extra = true;
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_RECEIPT_BINDING',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.receiptSource.binding.sha256 = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_RECEIPT_RECORD',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM3SourceSet.receiptSource);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_SET_BINDING',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.contextCompilationSetSource.binding.sha256
          = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_SET_RECORD',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM3SourceSet.contextCompilationSetSource);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_COUNT',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.contextCompilationSources.pop();
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_PATH_ORDER',
      mutate: (fixture) => {
        const sources = fixture.nativeM3SourceSet.contextCompilationSources;
        [sources[0], sources[1]] = [sources[1], sources[0]];
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_BINDING',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.contextCompilationSources[0]
          .binding.record_id = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M3_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM3SourceSet.contextCompilationSources[0]);
        return fixture;
      },
    },
    {
      name: 'NATIVE_M3_RECEIPT_DRIFT_PRECEDES_MEMBER_ENVELOPE_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M3_RECEIPT_BINDING',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.receiptSource.binding.sha256 = '0'.repeat(64);
        fixture.nativeM3SourceSet.contextCompilationSources[0].extra = true;
        return fixture;
      },
    },
    {
      name: 'NATIVE_M3_COUNT_DRIFT_PRECEDES_MEMBER_ENVELOPE_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M3_COUNT',
      mutate: (fixture) => {
        fixture.nativeM3SourceSet.contextCompilationSources.pop();
        fixture.nativeM3SourceSet.contextCompilationSources[0].extra = true;
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_ENVELOPE',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.extra = true;
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_RECEIPT_BINDING',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.receiptSource.binding.sha256 = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_RECEIPT_RECORD',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM4SourceSet.receiptSource);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_SET_BINDING',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.agreementAnalysisSetSource.binding.sha256
          = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_SET_RECORD',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM4SourceSet.agreementAnalysisSetSource);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_COUNT',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.agreementAnalysisSources.pop();
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_PATH_ORDER',
      mutate: (fixture) => {
        const sources = fixture.nativeM4SourceSet.agreementAnalysisSources;
        [sources[0], sources[1]] = [sources[1], sources[0]];
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_BINDING',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.agreementAnalysisSources[0]
          .binding.record_id = '0'.repeat(64);
        return fixture;
      },
    },
    {
      code: 'M7_V2_PROFILE_NATIVE_M4_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM4SourceSet.agreementAnalysisSources[0]);
        return fixture;
      },
    },
    {
      name: 'NATIVE_M3_DRIFT_PRECEDES_NATIVE_M4_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M3_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM3SourceSet.contextCompilationSources[0]);
        corruptFirstByte(fixture.nativeM4SourceSet.agreementAnalysisSources[0]);
        return fixture;
      },
    },
    {
      name: 'NATIVE_M4_DRIFT_PRECEDES_TRANSIENT_INPUT_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M4_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM4SourceSet.agreementAnalysisSources[0]);
        fixture.transientReviewAnswers = {};
        fixture.transientReviewEvidenceRequests = {};
        return fixture;
      },
    },
    {
      name: 'NATIVE_M4_RECEIPT_DRIFT_PRECEDES_MEMBER_ENVELOPE_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M4_RECEIPT_BINDING',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.receiptSource.binding.sha256 = '0'.repeat(64);
        fixture.nativeM4SourceSet.agreementAnalysisSources[0].extra = true;
        return fixture;
      },
    },
    {
      name: 'NATIVE_M4_COUNT_DRIFT_PRECEDES_MEMBER_ENVELOPE_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M4_COUNT',
      mutate: (fixture) => {
        fixture.nativeM4SourceSet.agreementAnalysisSources.pop();
        fixture.nativeM4SourceSet.agreementAnalysisSources[0].extra = true;
        return fixture;
      },
    },
    {
      name: 'EXISTING_SOURCE_DRIFT_PRECEDES_NATIVE_M2_DRIFT',
      code: 'M7_V2_PROFILE_SOURCE_BINDING',
      mutate: (fixture) => {
        fixture.transitiveSources[0].binding.sha256 = '0'.repeat(64);
        corruptFirstByte(fixture.nativeM2SourceSet.agreementIndexSources[0]);
        return fixture;
      },
    },
    {
      name: 'NATIVE_M2_DRIFT_PRECEDES_NATIVE_M3_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M2_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM2SourceSet.agreementIndexSources[0]);
        corruptFirstByte(fixture.nativeM3SourceSet.contextCompilationSources[0]);
        return fixture;
      },
    },
    {
      name: 'NATIVE_M3_DRIFT_PRECEDES_TRANSIENT_INPUT_DRIFT',
      code: 'M7_V2_PROFILE_NATIVE_M3_BYTES',
      mutate: (fixture) => {
        corruptFirstByte(fixture.nativeM3SourceSet.contextCompilationSources[0]);
        fixture.transientReviewAnswers = {};
        fixture.transientReviewEvidenceRequests = {};
        return fixture;
      },
    },
  ];

  for (const { code, name = code, mutate } of oneDeltaCases) {
    await t.test(name, () => {
      const fixture = mutate(buildProfileSourceFixture());
      expectCode(code, () => profileAuthoring.prepareFamilyProfileGapReview(fixture));
    });
  }

  for (const [path, cached] of PHYSICAL_BYTES_BY_PATH) {
    assert.equal(cached.bytes.byteLength, cached.byte_length, path);
    assert.equal(sha256Hex(cached.bytes), cached.sha256, path);
  }

  await t.test('canonical transitive source key order is not physical identity', () => {
    const fixture = buildProfileSourceFixture();
    fixture.transitiveSources[0].record = Object.fromEntries(
      Object.entries(fixture.transitiveSources[0].record).reverse(),
    );
    assert.equal(
      profileAuthoring.prepareFamilyProfileGapReview(fixture).state,
      'REVIEW_ONLY_AWAITING_BEN_APPROVAL',
    );
  });
});

test('Work3 profile gap review carries a transient answer in memory without governing it', async (t) => {
  const answers = [SYNTHETIC_TRANSIENT_ANSWER, SYNTHETIC_SECOND_TRANSIENT_ANSWER];
  const input = buildProfileSourceFixture({
    transientReviewAnswers: answers,
  });
  const before = fixtureFingerprint(input);
  const result = profileAuthoring.prepareFamilyProfileGapReview(input);

  assert.equal(fixtureFingerprint(input), before);
  assert.equal(isDeepFrozen(result), true);
  assert.deepEqual(result.transient_review_answers, answers);
  assert.equal(result.state, 'REVIEW_ONLY_AWAITING_BEN_APPROVAL');
  assert.equal(result.counts.historical_calibration_question_count, 75);
  assert.equal(result.counts.open_programme_question_count, 0);
  const expectedAnswersByFamily = new Map([
    ['ANTITRUST_REGULATORY', [SYNTHETIC_TRANSIENT_ANSWER]],
    ['TAX_MATTERS', [SYNTHETIC_SECOND_TRANSIENT_ANSWER]],
  ]);
  const expectedAnsweredSectionByFamily = new Map([
    ['ANTITRUST_REGULATORY', 'DIMENSION_EVIDENCE'],
    ['TAX_MATTERS', 'PROFILE_TAXONOMY_AND_PARENTAGE'],
  ]);
  assert.equal(
    result.family_package_authoring_work_queue.state,
    'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW',
  );
  for (const family of result.family_package_authoring_work_queue.families) {
    assert.equal(family.state, 'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW');
    assert.deepEqual(
      family.transient_review_answers,
      expectedAnswersByFamily.get(family.family_key) ?? [],
    );
    for (const section of family.authoring_sections) {
      assert.deepEqual(Object.keys(section), AUTHORING_SECTION_KEYS);
      assert.equal(
        section.state,
        section.section_key === expectedAnsweredSectionByFamily.get(family.family_key)
          ? TRANSIENT_ANSWER_AVAILABLE_STATE
          : 'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW',
      );
    }
    assert.deepEqual(
      family.controlling_programme_ruling_ids,
      EXPECTED_PROGRAMME_RULING_IDS,
    );
    assert(answers.every(
      (answer) => !canonicalJson(family.controlling_programme_ruling_ids)
        .includes(answer.answer_text),
    ));
  }
  assert.equal(
    result.family_package_authoring_work_queue.families.flatMap(
      (family) => family.authoring_sections,
    ).filter((section) => section.state === TRANSIENT_ANSWER_AVAILABLE_STATE).length,
    2,
  );
  assert.equal(
    result.family_package_authoring_work_queue.families.reduce(
      (count, family) => count + family.transient_review_answers.length,
      0,
    ),
    2,
  );
  assert.match(
    result.rendered_review_text,
    /TRANSIENT MEMORY-ONLY ANSWERS — NOT LEGAL AUTHORITY/,
  );
  for (const answer of answers) {
    assert(result.rendered_review_text.includes(canonicalJson(answer)));
  }
  assert.match(
    result.rendered_review_text,
    /- DIMENSION_EVIDENCE: TRANSIENT_MEMORY_ANSWER_AVAILABLE_NOT_AUTHORITY/,
  );
  assert.match(
    result.rendered_review_text,
    /- PROFILE_TAXONOMY_AND_PARENTAGE: TRANSIENT_MEMORY_ANSWER_AVAILABLE_NOT_AUTHORITY/,
  );
  assert.match(result.rendered_review_text, /FAMILY PACKAGES READY FOR APPROVAL: 0 OF 25/);
  assert.match(result.rendered_review_text, /FAMILY APPROVAL RECORDS ISSUED: 0 OF 25/);
  for (const excluded of [result.source_closure, result.rows, result.family_dossiers]) {
    for (const answer of answers) {
      assert.equal(canonicalJson(excluded).includes(answer.answer_text), false);
    }
  }
  const keys = collectKeys(result.transient_review_answers);
  for (const forbidden of [
    'ben_approval_id',
    'family_approval_id',
    'legal_decisions',
    'approved_inventory_digest',
    'family_profile_package_id',
  ]) {
    assert.equal(keys.has(forbidden), false);
  }
  const queueKeys = collectKeys(result.family_package_authoring_work_queue);
  for (const forbidden of [
    'legal_decisions',
    'family_approval',
    'family_approval_id',
    'ben_approval_id',
    'approved_inventory_digest',
    'family_profile_package_id',
    'profile_id',
    'subtype_tree_id',
    'match_fixture_id',
    'dimension_evidence_id',
    'fixture_id',
  ]) {
    assert.equal(queueKeys.has(forbidden), false);
  }

  await t.test('non-section transient answer does not mark an authoring section', () => {
    const fixture = buildProfileSourceFixture({
      transientReviewAnswers: [SYNTHETIC_UNMAPPED_TRANSIENT_ANSWER],
    });
    const review = profileAuthoring.prepareFamilyProfileGapReview(fixture);
    const capitalisation = review.family_package_authoring_work_queue.families.find(
      (family) => family.family_key === SYNTHETIC_UNMAPPED_TRANSIENT_ANSWER.family_key,
    );
    assert.deepEqual(capitalisation.transient_review_answers, [
      SYNTHETIC_UNMAPPED_TRANSIENT_ANSWER,
    ]);
    assert(capitalisation.authoring_sections.every(
      (section) => section.state === 'AUTHORING_REQUIRED_BEFORE_PACKAGE_REVIEW',
    ));
  });

  await t.test('malformed transient target fails closed', () => {
    const fixture = buildProfileSourceFixture({
      transientReviewAnswers: [{
        ...SYNTHETIC_TRANSIENT_ANSWER,
        field_key: 'synthetic_field',
      }],
    });
    expectCode(
      'M7_V2_PROFILE_TRANSIENT_REVIEW_ANSWER',
      () => profileAuthoring.prepareFamilyProfileGapReview(fixture),
    );
  });

  await t.test('one transient target cannot be answered twice', () => {
    const fixture = buildProfileSourceFixture({
      transientReviewAnswers: [
        SYNTHETIC_TRANSIENT_ANSWER,
        SYNTHETIC_TRANSIENT_ANSWER,
      ],
    });
    expectCode(
      'M7_V2_PROFILE_TRANSIENT_REVIEW_ANSWER_DUPLICATE',
      () => profileAuthoring.prepareFamilyProfileGapReview(fixture),
    );
  });

  await t.test('governed source drift precedes malformed transient context', () => {
    const fixture = buildProfileSourceFixture({
      transientReviewAnswers: [{
        ...SYNTHETIC_TRANSIENT_ANSWER,
        answer_text: '',
      }],
    });
    fixture.transitiveSources[0].binding.sha256 = '0'.repeat(64);
    expectCode(
      'M7_V2_PROFILE_SOURCE_BINDING',
      () => profileAuthoring.prepareFamilyProfileGapReview(fixture),
    );
  });
});

test('Work3 review binds transient evidence to sealed and additive M2, M3, and M4 sources without authority', async (t) => {
  const answers = [SYNTHETIC_TRANSIENT_ANSWER, SYNTHETIC_SECOND_TRANSIENT_ANSWER];
  const input = buildProfileSourceFixture({
    transientReviewAnswers: answers,
  });
  const request = syntheticTransientEvidenceRequest(input, input.nativeM3SourceSet);
  const secondRequest = syntheticTransientEvidenceRequest(
    input,
    input.nativeM3SourceSet,
    SYNTHETIC_SECOND_TRANSIENT_ANSWER,
  );
  const additiveRequest = syntheticTransientEvidenceRequest(
    input,
    input.nativeM3SourceSet,
    SYNTHETIC_SECOND_TRANSIENT_ANSWER,
    input.nativeAdditiveSourceSet.members[0],
  );
  const requests = [request, secondRequest, additiveRequest];
  input.transientReviewEvidenceRequests = requests;
  const before = fixtureFingerprint(input);

  const result = profileAuthoring.prepareFamilyProfileGapReview(input);
  assert.equal(fixtureFingerprint(input), before);
  assert.equal(result.state, 'REVIEW_ONLY_AWAITING_BEN_APPROVAL');
  assert.equal(result.counts.historical_calibration_question_count, 75);
  assert.equal(result.counts.open_programme_question_count, 0);
  assert.equal(isDeepFrozen(result), true);
  assert.deepEqual(result.transient_review_answers, answers);
  assert.equal(result.transient_review_evidence.length, 3);
  const evidence = result.transient_review_evidence[0];
  assert.deepEqual({
    family_key: evidence.family_key,
    profile_key: evidence.profile_key,
    field_key: evidence.field_key,
    agreement_id: evidence.agreement_id,
    node_occurrence_ids: evidence.node_occurrence_ids,
    scope_edge_ids: evidence.scope_edge_ids,
    reference_edge_ids: evidence.reference_edge_ids,
  }, request);
  assert.match(evidence.agreement_index_id, /^[0-9a-f]{64}$/);
  assert.match(evidence.context_compilation_id, /^[0-9a-f]{64}$/);
  assert.match(evidence.agreement_analysis_id, /^[0-9a-f]{64}$/);
  const secondEvidence = result.transient_review_evidence[1];
  assert.deepEqual({
    family_key: secondEvidence.family_key,
    profile_key: secondEvidence.profile_key,
    field_key: secondEvidence.field_key,
    agreement_id: secondEvidence.agreement_id,
    node_occurrence_ids: secondEvidence.node_occurrence_ids,
    scope_edge_ids: secondEvidence.scope_edge_ids,
    reference_edge_ids: secondEvidence.reference_edge_ids,
  }, secondRequest);
  assert.match(secondEvidence.agreement_index_id, /^[0-9a-f]{64}$/);
  assert.match(secondEvidence.context_compilation_id, /^[0-9a-f]{64}$/);
  assert.match(secondEvidence.agreement_analysis_id, /^[0-9a-f]{64}$/);
  const additiveEvidence = result.transient_review_evidence[2];
  assert.deepEqual({
    family_key: additiveEvidence.family_key,
    profile_key: additiveEvidence.profile_key,
    field_key: additiveEvidence.field_key,
    agreement_id: additiveEvidence.agreement_id,
    node_occurrence_ids: additiveEvidence.node_occurrence_ids,
    scope_edge_ids: additiveEvidence.scope_edge_ids,
    reference_edge_ids: additiveEvidence.reference_edge_ids,
  }, additiveRequest);
  assert.deepEqual({
    agreement_analysis_id: additiveEvidence.agreement_analysis_id,
    agreement_id: additiveEvidence.agreement_id,
    agreement_index_id: additiveEvidence.agreement_index_id,
    context_compilation_id: additiveEvidence.context_compilation_id,
  }, {
    agreement_analysis_id:
      '222d36d8a020fff58303b2aee2736ed336c628ba44ee814f70856a4f0024ea5a',
    agreement_id:
      'aa72f3af29316df52ab5cb75eb2b0bb0a5b31036bd24c7f812241c5a688f4319',
    agreement_index_id:
      '00ae4e2e5b06cbf5b897d25194fa352652e62e67d49bd2635099ddff8e2b92b3',
    context_compilation_id:
      '2cfdbcd78747fdb89b8cc02d1ca634da0acf6894f8cfe213538d86c34adfb745',
  });
  const expectedAnswersByFamily = new Map(answers.map((answer) => [
    answer.family_key,
    [answer],
  ]));
  const expectedEvidenceByFamily = new Map();
  for (const entry of result.transient_review_evidence) {
    expectedEvidenceByFamily.set(entry.family_key, [
      ...(expectedEvidenceByFamily.get(entry.family_key) ?? []),
      entry,
    ]);
  }
  for (const family of result.family_package_authoring_work_queue.families) {
    assert.deepEqual(
      family.transient_review_answers,
      expectedAnswersByFamily.get(family.family_key) ?? [],
    );
    assert.deepEqual(
      family.transient_review_evidence,
      expectedEvidenceByFamily.get(family.family_key) ?? [],
    );
  }
  assert.equal(
    result.family_package_authoring_work_queue.families.reduce(
      (count, family) => count + family.transient_review_evidence.length,
      0,
    ),
    3,
  );
  for (const entry of result.transient_review_evidence) {
    assert.deepEqual(Object.keys(entry).sort(), [
      'agreement_analysis_id',
      'agreement_id',
      'agreement_index_id',
      'context_compilation_id',
      'family_key',
      'field_key',
      'node_occurrence_ids',
      'profile_key',
      'reference_edge_ids',
      'scope_edge_ids',
    ]);
  }
  assert.match(result.rendered_review_text, /NATIVE M3 SOURCE CLOSURE/);
  assert.match(result.rendered_review_text, /NATIVE M4 SOURCE CLOSURE/);
  assert.match(
    result.rendered_review_text,
    /TRANSIENT REQUESTED SOURCE LINKS, NOT LEGAL AUTHORITY/,
  );
  assert.equal(canonicalJson(evidence).includes(SYNTHETIC_TRANSIENT_ANSWER.answer_text), false);
  assert.equal(collectKeys(result.source_closure).has('bytes'), false);
  for (const forbidden of [
    'ben_approval_id',
    'family_approval_id',
    'legal_decisions',
    'approved_inventory_digest',
    'family_profile_package_id',
  ]) {
    assert.equal(collectKeys(result.transient_review_evidence).has(forbidden), false);
  }

  const evidenceFixture = () => {
    const fixture = buildProfileSourceFixture({
      transientReviewAnswers: [SYNTHETIC_TRANSIENT_ANSWER],
    });
    fixture.transientReviewEvidenceRequests = [structuredClone(request)];
    return fixture;
  };
  const negativeCases = [
    {
      name: 'malformed request',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_REQUEST',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests[0].extra = true;
      },
    },
    {
      name: 'duplicate target and agreement',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_DUPLICATE',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests.push(structuredClone(
          fixture.transientReviewEvidenceRequests[0],
        ));
      },
    },
    {
      name: 'request without exact answer target',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_ANSWER',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests[0].field_key = 'OTHER_FIELD';
      },
    },
    {
      name: 'request outside paired source inventory',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_SOURCE',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests[0].agreement_id = '0'.repeat(64);
      },
    },
    {
      name: 'unknown M2 node',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_NODE',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests[0]
          .node_occurrence_ids.push('0'.repeat(64));
      },
    },
    {
      name: 'unknown M3 scope edge',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_SCOPE_EDGE',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests[0].scope_edge_ids = ['0'.repeat(64)];
      },
    },
    {
      name: 'partial M3 scope-edge class',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_SCOPE_EDGE',
      mutate: (fixture) => {
        const output = fixture.nativeM3SourceSet.receiptSource.record.output_bindings.find(
          (binding) => binding.schema_version === 'CONTEXT_COMPILATION/V1',
        );
        const source = fixture.nativeM3SourceSet.contextCompilationSources.find(
          (entry) => entry.binding.record_id === output.context_compilation_id,
        );
        const context = JSON.parse(Buffer.from(source.bytes).toString('utf8'));
        const groups = new Map();
        for (const edge of context.scope_edges) {
          const key = canonicalJson({
            edge_kind: edge.edge_kind,
            proof: edge.proof,
            rule_id: edge.rule_id,
            rule_version: edge.rule_version,
            source_node_occurrence_id: edge.source_node_occurrence_id,
            target_node_occurrence_id: edge.target_node_occurrence_id,
          });
          groups.set(key, [...(groups.get(key) ?? []), edge]);
        }
        const partialClass = [...groups.values()].find((entries) => entries.length > 1);
        assert(partialClass);
        const edge = partialClass[0];
        fixture.transientReviewEvidenceRequests[0] = {
          agreement_id: output.agreement_id,
          family_key: SYNTHETIC_TRANSIENT_ANSWER.family_key,
          field_key: SYNTHETIC_TRANSIENT_ANSWER.field_key,
          node_occurrence_ids: [...new Set([
            edge.source_node_occurrence_id,
            edge.target_node_occurrence_id,
            edge.proof.shared_parent_node_occurrence_id,
          ].filter((nodeId) => nodeId !== null))].sort(),
          profile_key: SYNTHETIC_TRANSIENT_ANSWER.profile_key,
          reference_edge_ids: [],
          scope_edge_ids: [edge.scope_edge_id],
        };
      },
    },
    {
      name: 'unknown M3 reference edge',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_REFERENCE_EDGE',
      mutate: (fixture) => {
        fixture.transientReviewEvidenceRequests[0].reference_edge_ids
          = ['0'.repeat(64)];
      },
    },
    {
      name: 'disconnected valid M2 node',
      code: 'M7_V2_PROFILE_TRANSIENT_REVIEW_EVIDENCE_GRAPH',
      mutate: (fixture) => {
        const request = fixture.transientReviewEvidenceRequests[0];
        const selected = new Set(request.node_occurrence_ids);
        const indexSource = fixture.nativeM2SourceSet.agreementIndexSources.find(
          (source) => source.record.source_binding.agreement_id === request.agreement_id,
        );
        const disconnected = indexSource.record.nodes.find((node) => (
          !selected.has(node.node_occurrence_id)
            && !selected.has(node.parent_node_occurrence_id)
            && node.child_node_occurrence_ids.every((nodeId) => !selected.has(nodeId))
        ));
        assert(disconnected);
        request.node_occurrence_ids.push(disconnected.node_occurrence_id);
      },
    },
  ];
  for (const { name, code, mutate } of negativeCases) {
    await t.test(name, () => {
      const fixture = evidenceFixture();
      mutate(fixture);
      expectCode(code, () => profileAuthoring.prepareFamilyProfileGapReview(fixture));
    });
  }
});

test('Phase2 proposal derives a deterministic unapproved Termination partition', async (t) => {
  const fixture = terminationPhase2ProposalFixture();
  const authorityEnvelope = fixture.terminationAuthoringPhase2Authority;
  const authority = authorityEnvelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);
  const result = profileAuthoring.prepareTerminationFamilyProposal(fixture);

  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertExactKeys(result, TERMINATION_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_TERMINATION_FAMILY_PROPOSAL/V1',
    family_key: 'TERMINATION',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    zero_m4_claim_gaps: true,
  });
  assert.deepEqual(result.authority_binding, TERMINATION_PHASE2_AUTHORITY_BINDING);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.equal(
    result.proposal_id,
    contentId(result.schema_version, proposalUnsignedRecord(result)),
  );

  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;
  assert.equal(terminals.length, 47);
  assert.deepEqual(
    terminals.map((terminal) => terminal.source_unit_key),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  const expectedClaimIds = sortedUnique(terminals.flatMap(
    (terminal) => terminal.m4_claim_ids,
  ));
  const expectedSilentKeys = sortedUnique(terminals.flatMap(
    (terminal) => terminal.m4_silent_source_row_keys,
  ));
  const expectedSourceUnitIds = terminals.map(
    (terminal) => terminal.source_unit_key,
  ).sort();
  assert.equal(expectedClaimIds.length, 73);
  assert.equal(expectedSilentKeys.length, 10);
  assert.deepEqual(
    expectedSilentKeys,
    authority.implementation_contract.output_member_contracts
      .source_terminal_coverage.m4_silent_source_unit_keys,
  );
  const topBuildAgreementId =
    '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';
  const topBuildTerminals = terminals.filter(
    (terminal) => terminal.agreement_id === topBuildAgreementId,
  );
  assert.equal(topBuildTerminals.length, 1);
  assert.deepEqual(topBuildTerminals[0].m4_claim_ids, [
    'bc46137e3b21b888214c92ae19fa0e79d92ca54f135d2ec26b4411e3e44dd9dd',
    'c8b297f355bb78fc01172b74e1f4f80379dd22c4dc5b7a8f574dbe89fe504f33',
  ]);
  const topBuildM4 = fixture.governedSources
    .agreementEvidenceByAgreementId[topBuildAgreementId].m4.record;
  const topBuildTerminationClaimIds = sortedUnique(topBuildM4.claims.filter(
    (claim) => claim.family === 'TERMINATION',
  ).map((claim) => claim.analysis_claim_id));
  const topBuildExcludedClaimIds = topBuildTerminationClaimIds.filter(
    (claimId) => !topBuildTerminals[0].m4_claim_ids.includes(claimId),
  );
  assert.equal(topBuildTerminationClaimIds.length, 20);
  assert.equal(topBuildExcludedClaimIds.length, 18);
  assert.equal(
    topBuildExcludedClaimIds.some((claimId) => expectedClaimIds.includes(claimId)),
    false,
  );

  assertExactKeys(
    result.m4_claim_accounting,
    TERMINATION_PHASE2_CLAIM_ACCOUNTING_KEYS,
    'claim accounting keys',
  );
  assert.deepEqual(result.m4_claim_accounting, {
    state: 'COMPLETE',
    expected_claim_ids: expectedClaimIds,
    accounted_claim_ids: expectedClaimIds,
    expected_count: 73,
    accounted_count: 73,
    claim_ids_sha256: 'c68e6afa063cdc40607927598de8f856f3d9cd0aa5b363da787bb19177030299',
  });
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(expectedClaimIds), 'utf8')),
    result.m4_claim_accounting.claim_ids_sha256,
  );

  const expectedAssignments = terminals.map((terminal) => ({
    source_unit_key: terminal.source_unit_key,
    classification_bucket: terminal.classification_bucket,
    source_row_keys: [terminal.source_unit_key],
    m4_claim_ids: terminal.m4_claim_ids,
    m4_silent_source_row_keys: terminal.m4_silent_source_row_keys,
  }));
  assertExactKeys(
    result.source_terminal_coverage,
    TERMINATION_PHASE2_SOURCE_COVERAGE_KEYS,
    'source coverage keys',
  );
  result.source_terminal_coverage.source_unit_assignments.forEach(
    (assignment) => assertExactKeys(
      assignment,
      TERMINATION_PHASE2_SOURCE_ASSIGNMENT_KEYS,
      `${assignment.source_unit_key} source assignment keys`,
    ),
  );
  assert.deepEqual(result.source_terminal_coverage, {
    state: 'COMPLETE',
    classification_buckets: TERMINATION_PHASE2_CLASSIFICATION_BUCKETS,
    source_unit_assignments: expectedAssignments,
    expected_source_unit_ids: expectedSourceUnitIds,
    accounted_source_unit_ids: expectedSourceUnitIds,
    expected_count: 47,
    accounted_count: 47,
  });
  assert.deepEqual(
    sortedUnique(result.source_terminal_coverage.source_unit_assignments.flatMap(
      (assignment) => assignment.m4_silent_source_row_keys,
    )),
    expectedSilentKeys,
  );

  const compiledComponents = compiledTerminationPhase2Components(authorityEnvelope);
  assert.equal(result.authorised_rule_components.length, 11);
  assert.deepEqual(
    result.authorised_rule_components.map((component) => component.component_key),
    authority.authorised_synthetic_rule_components.map(
      (component) => component.component_key,
    ),
  );
  const componentIds = result.authorised_rule_components.map(
    (component) => component.component_id,
  );
  assert.equal(new Set(componentIds).size, 11);
  componentIds.forEach((componentId) => assert.equal(
    LOWERCASE_HEX_64.test(componentId),
    true,
  ));
  const authorisedComponentKeySet = new Set(
    authority.authorised_synthetic_rule_components.map(
      (component) => component.component_key,
    ),
  );
  const componentIdByKey = new Map();
  for (const [index, outputComponent] of result.authorised_rule_components.entries()) {
    const { component, compiled } = compiledComponents[index];
    assertExactKeys(
      outputComponent,
      TERMINATION_PHASE2_COMPONENT_KEYS,
      `${component.component_key} component keys`,
    );
    const nativeSourceSupportIds = nativeComponentSourceSupportIds(component);
    const factPathSourceSupportIds = sortedUnique(
      authority.synthetic_component_contract.synthetic_fixture_identity_contract
        .fact_path_registry.filter(
          (row) => row.component_key === component.component_key,
        ).map((row) => row.source_support_id),
    );
    const syntheticSpanIds = new Set(compiled.source_spans.map((span) => span.span_id));
    assert.deepEqual(factPathSourceSupportIds, nativeSourceSupportIds);
    assert.equal(
      outputComponent.source_support_ids.some((id) => syntheticSpanIds.has(id)),
      false,
      `${component.component_key} leaks a synthetic compiler span ID`,
    );
    assert.deepEqual(outputComponent, {
      component_id: outputComponent.component_id,
      component_key: component.component_key,
      agreement_id: component.agreement_id,
      root_expression_id: compiled.root_expression_id,
      fact_ids: sortedUnique(compiled.facts.map((fact) => fact.fact_id)),
      expression_ids: sortedUnique(compiled.expressions.map(
        (expression) => expression.expression_id,
      )),
      source_support_ids: nativeSourceSupportIds,
      unresolved_items: sortedUnique(component.unresolved_items),
    });
    componentIdByKey.set(component.component_key, outputComponent.component_id);
  }
  const phase1ComponentKeys = sortedUnique(terminals.flatMap(
    (terminal) => terminal.linked_rule_bindings.filter(
      (binding) => binding.binding_kind === 'PHASE1_COMPONENT_RELATIONSHIP',
    ).map((binding) => binding.target_component_key),
  ));
  assert.deepEqual(phase1ComponentKeys, ['red_hat_7_01_c_ii', 'red_hat_7_01_d']);
  assert.equal(
    phase1ComponentKeys.every((componentKey) => !componentIdByKey.has(componentKey)),
    true,
  );

  assert.equal(result.symbolic_temporal_graphs.length, 5);
  assert.deepEqual(
    result.symbolic_temporal_graphs.map((graph) => graph.graph_key),
    ['CONCHO', 'METSERA', 'SKYWATER', 'RH', 'SKECHERS'],
  );
  const ownerRegistry = authority.implementation_contract
    .reference_target_owner_template_registry;
  for (const [index, graph] of result.symbolic_temporal_graphs.entries()) {
    const fixtureGraph = authority.authorised_symbolic_graph_fixtures[index];
    assertExactKeys(graph, TERMINATION_PHASE2_GRAPH_KEYS, `${graph.graph_key} graph keys`);
    assert.deepEqual({
      graph_key: graph.graph_key,
      agreement_id: graph.agreement_id,
      defined_term_key: graph.defined_term_key,
      defined_term_owner_node_occurrence_id:
        graph.defined_term_owner_node_occurrence_id,
    }, {
      graph_key: fixtureGraph.graph_key,
      agreement_id: fixtureGraph.agreement_id,
      defined_term_key: fixtureGraph.defined_term_key,
      defined_term_owner_node_occurrence_id:
        fixtureGraph.defined_term_owner_node_occurrence_id,
    });
    const ownerTemplates = ownerRegistry.templates.filter((template) => (
      template.agreement_id === graph.agreement_id
        && template.descriptor_key.graph_key === graph.graph_key
        && template.descriptor_key.defined_term_key === graph.defined_term_key
    ));
    assert.equal(ownerTemplates.length, 1);
    const [ownerTemplate] = ownerTemplates;
    assert.equal(graph.defined_term_owner_fact_id, contentId(
      ownerRegistry.agreement_semantic_fact_v2_identity_projection.domain,
      {
        agreement_id: ownerTemplate.agreement_id,
        field_key: ownerTemplate.field_key,
        normalised_typed_value: ownerTemplate.typed_value,
        legal_subject: ownerTemplate.legal_subject,
        temporal_scope_signature: ownerTemplate.temporal_scope_signature,
        source_support_ids: ownerTemplate.source_supports.map(
          (support) => support.source_support_id,
        ),
        legal_effect_role: ownerTemplate.legal_effect_role,
      },
    ));
    assert.deepEqual(
      graph.states.map((state) => state.state_key),
      fixtureGraph.ordered_state_templates.map((state) => state.state_key),
    );
    graph.states.forEach((state) => {
      assertExactKeys(state, TERMINATION_PHASE2_STATE_KEYS, `${state.state_id} state keys`);
      assertExactKeys(state.value_ref, ['kind', 'id'], `${state.state_id} value-ref keys`);
      assert.equal(
        new Set(state.source_support_ids).size,
        state.source_support_ids.length,
      );
      assertSortedUnique(state.unresolved_dimensions, `${state.state_id} unresolved dimensions`);
    });
    assert.equal(graph.state_edges.length, fixtureGraph.ordered_edge_templates.length);
    graph.state_edges.forEach((edge) => {
      assertExactKeys(
        edge,
        TERMINATION_PHASE2_EDGE_KEYS,
        `${edge.temporal_state_edge_id} edge keys`,
      );
      assert.equal(
        new Set(edge.source_node_occurrence_ids).size,
        edge.source_node_occurrence_ids.length,
      );
      assert.equal(
        new Set(edge.source_support_ids).size,
        edge.source_support_ids.length,
      );
    });
  }
  const temporalStates = result.symbolic_temporal_graphs.flatMap(
    (graph) => graph.states,
  );
  const temporalEdges = result.symbolic_temporal_graphs.flatMap(
    (graph) => graph.state_edges,
  );
  assert.equal(temporalStates.length, 12);
  assert.equal(temporalEdges.length, 8);
  assert.equal(result.temporal_state_reference_edges.length, 41);
  result.temporal_state_reference_edges.forEach((reference) => {
    assertExactKeys(
      reference,
      TERMINATION_PHASE2_REFERENCE_KEYS,
      `${reference.temporal_state_reference_edge_id} reference keys`,
    );
    assert.equal(Object.hasOwn(reference, 'operative_state'), false);
  });
  const evidenceResult = validateSyntheticExpressionEvidence({
    terminationAuthoringPhase2Authority: authorityEnvelope,
    authorised_rule_components: compiledComponents.map(({ component, compiled }) => ({
      component_key: component.component_key,
      compiled_output: compiled,
    })),
    temporal_defined_term_states: temporalStates,
    temporal_state_edges: temporalEdges,
    temporal_state_reference_edges: result.temporal_state_reference_edges,
  });
  assert.deepEqual(evidenceResult, {
    schema_version: 'STAGE_2Y_M7_V2_TERMINATION_PHASE2_SYNTHETIC_EVIDENCE_VALIDATION/V1',
    status: 'PASS',
    authorised_rule_component_count: 11,
    temporal_defined_term_state_count: 12,
    temporal_state_edge_count: 8,
    temporal_state_reference_edge_count: 41,
  });

  assertExactKeys(
    result.proposed_partition,
    TERMINATION_PHASE2_PARTITION_KEYS,
    'partition keys',
  );
  const expectedGroups = new Map();
  for (const terminal of terminals) {
    const tuple = {
      classification_path: terminal.classification_path,
      required_expression_signature: terminal.required_expression_signature,
    };
    const tupleKey = canonicalJson(tuple);
    const group = expectedGroups.get(tupleKey) || { tuple, terminals: [] };
    group.terminals.push(terminal);
    expectedGroups.set(tupleKey, group);
  }
  assert.equal(expectedGroups.size, 45);
  assert.deepEqual(
    [...expectedGroups.values()].filter((group) => group.terminals.length > 1)
      .map((group) => group.terminals.map((terminal) => terminal.source_unit_key).sort())
      .sort((left, right) => left[0].localeCompare(right[0])),
    [
      [
        '9fc758c5e313b4f178f604313e53b6157b4292416ac9bcafcd64bf85df6d88f2',
        'b811640569872085ff541d957c6a329bdcb3b40de7e9c96ac3a9f4d7c1faf520',
      ],
      [
        'b04c658087bf2bac0b2fed06bbf484125ba914b798624c8c717b4ee99b771f3f',
        'e9e5efcfd7558b9a5e88391f4336021c70c6ba150dfafcfb5b4c31257398ccb4',
      ],
    ],
  );
  assert.equal(result.derived_profile_count, 45);
  assert.equal(result.proposed_partition.proposed_profiles.length, 45);
  assert.equal(result.proposed_partition.source_unit_assignment_count, 47);
  assert.equal(result.proposed_partition.m4_claim_assignment_count, 73);
  const proposedProfileKeys = result.proposed_partition.proposed_profiles.map(
    (profile) => profile.proposed_profile_key,
  );
  assert.deepEqual(proposedProfileKeys, proposedProfileKeys.slice().sort());
  assert.equal(new Set(proposedProfileKeys).size, 45);
  proposedProfileKeys.forEach((profileKey) => assert.equal(
    LOWERCASE_HEX_64.test(profileKey),
    true,
  ));
  const globalReferenceIds = result.temporal_state_reference_edges.map(
    (reference) => reference.temporal_state_reference_edge_id,
  );
  const globalReferenceIdSet = new Set(globalReferenceIds);
  const seenTupleKeys = new Set();
  for (const profile of result.proposed_partition.proposed_profiles) {
    assertExactKeys(
      profile,
      TERMINATION_PHASE2_PROFILE_KEYS,
      `${profile.proposed_profile_key} profile keys`,
    );
    assertExactKeys(
      profile.canonical_tuple,
      TERMINATION_PHASE2_TUPLE_KEYS,
      `${profile.proposed_profile_key} tuple keys`,
    );
    const tupleKey = canonicalJson(profile.canonical_tuple);
    const expectedGroup = expectedGroups.get(tupleKey);
    assert(expectedGroup);
    assert.equal(seenTupleKeys.has(tupleKey), false);
    seenTupleKeys.add(tupleKey);
    const expectedGroupSourceUnitKeys = expectedGroup.terminals.map(
      (terminal) => terminal.source_unit_key,
    ).sort();
    const expectedGroupClaimIds = sortedUnique(expectedGroup.terminals.flatMap(
      (terminal) => terminal.m4_claim_ids,
    ));
    const linkedTargetComponentKeys = sortedUnique(expectedGroup.terminals.flatMap(
      (terminal) => terminal.linked_rule_bindings
        .map((binding) => binding.target_component_key)
        .filter((componentKey) => componentKey !== null),
    ));
    const expectedComponentKeys = linkedTargetComponentKeys.filter(
      (componentKey) => authorisedComponentKeySet.has(componentKey),
    );
    assert.equal(
      linkedTargetComponentKeys.filter(
        (componentKey) => !authorisedComponentKeySet.has(componentKey),
      ).every((componentKey) => !componentIdByKey.has(componentKey)),
      true,
    );
    assert.deepEqual(profile.source_unit_keys, expectedGroupSourceUnitKeys);
    assert.deepEqual(profile.m4_claim_ids, expectedGroupClaimIds);
    assert.deepEqual(
      profile.authorised_component_ids,
      expectedComponentKeys.map((componentKey) => {
        assert.equal(componentIdByKey.has(componentKey), true);
        return componentIdByKey.get(componentKey);
      }).sort(),
    );
    assertSortedUnique(
      profile.temporal_state_reference_edge_ids,
      `${profile.proposed_profile_key} temporal references`,
    );
    assert.equal(
      profile.temporal_state_reference_edge_ids.every(
        (referenceId) => globalReferenceIdSet.has(referenceId),
      ),
      true,
    );
  }
  assert.equal(seenTupleKeys.size, 45);

  const callerNativeIds = collectLowercaseHex64(fixture);
  const compilerIds = new Set(compiledComponents.flatMap(({ compiled }) => [
    compiled.profile_id,
    compiled.root_expression_id,
    ...compiled.facts.map((fact) => fact.fact_id),
    ...compiled.facts.map((fact) => fact.semantic_fact_key),
    ...compiled.expressions.map((expression) => expression.expression_id),
    ...compiled.source_spans.map((span) => span.span_id),
  ]));
  const graphAndReferenceIds = new Set([
    ...result.symbolic_temporal_graphs.map(
      (graph) => graph.defined_term_owner_fact_id,
    ),
    ...temporalStates.flatMap((state) => [state.state_id, state.value_ref.id]),
    ...temporalEdges.flatMap((edge) => [
      edge.temporal_state_edge_id,
      edge.trigger_expression_id,
      ...edge.evaluation_expression_ids,
    ]),
    ...temporalEdges.map((edge) => edge.edge_rule_id).filter(
      (edgeRuleId) => typeof edgeRuleId === 'string',
    ),
    ...result.temporal_state_reference_edges.flatMap((reference) => [
      reference.temporal_state_reference_edge_id,
      reference.consumer_rule_id,
      reference.consumer_fact_id,
      reference.consumer_dependency_id,
      reference.consumer_context_edge_id,
    ]),
    ...result.temporal_state_reference_edges.map(
      (reference) => reference.edge_rule_id,
    ).filter((edgeRuleId) => typeof edgeRuleId === 'string'),
  ]);
  const proposalTechnicalIds = new Set([
    result.proposal_id,
    ...componentIds,
    ...proposedProfileKeys,
  ]);
  assert.equal(proposalTechnicalIds.size, 57);
  assertDisjoint(compilerIds, callerNativeIds, 'compiler/native ID collision');
  assertDisjoint(graphAndReferenceIds, callerNativeIds, 'graph/native ID collision');
  assertDisjoint(proposalTechnicalIds, callerNativeIds, 'proposal/native ID collision');
  assertDisjoint(compilerIds, graphAndReferenceIds, 'compiler/graph ID collision');
  assertDisjoint(proposalTechnicalIds, compilerIds, 'proposal/compiler ID collision');
  assertDisjoint(proposalTechnicalIds, graphAndReferenceIds, 'proposal/graph ID collision');

  const inventoryDigestInput = {
    m4_claim_ids: expectedClaimIds,
    source_unit_ids: expectedSourceUnitIds,
    authorised_component_ids: componentIds.slice().sort(),
    temporal_state_reference_edge_ids: globalReferenceIds.slice().sort(),
    proposed_profile_tuples: canonicalSortedUnique(
      result.proposed_partition.proposed_profiles.map(
        (profile) => profile.canonical_tuple,
      ),
    ),
  };
  assert.equal(
    result.inventory_digest,
    sha256Hex(Buffer.from(canonicalJson(inventoryDigestInput), 'utf8')),
  );
  assert.equal(LOWERCASE_HEX_64.test(result.inventory_digest), true);
  assert.deepEqual(result.unresolved_items, TERMINATION_PHASE2_UNRESOLVED_ITEMS);
  const forbiddenKeys = new Set([
    'ben_approval_id',
    'ben_decision_id',
    'approval_id',
    'decision_id',
    'package_id',
    'candidate_id',
    'registration_id',
    'transition_id',
    'activation_id',
    'profile_id',
    'member_id',
    'tree_id',
    'operative_state',
  ]);
  for (const key of collectKeys(result)) assert.equal(forbiddenKeys.has(key), false, key);

  const repeated = profileAuthoring.prepareTerminationFamilyProposal(fixture);
  assert.notStrictEqual(repeated, result);
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated result object alias',
  );
  assert.notStrictEqual(repeated.m4_claim_accounting, result.m4_claim_accounting);
  assert.notStrictEqual(repeated.source_terminal_coverage, result.source_terminal_coverage);
  assert.notStrictEqual(
    repeated.source_terminal_coverage.source_unit_assignments,
    result.source_terminal_coverage.source_unit_assignments,
  );
  assert.notStrictEqual(repeated.symbolic_temporal_graphs, result.symbolic_temporal_graphs);
  assert.notStrictEqual(
    repeated.temporal_state_reference_edges,
    result.temporal_state_reference_edges,
  );
  assert.notStrictEqual(
    repeated.authorised_rule_components,
    result.authorised_rule_components,
  );
  assert.notStrictEqual(repeated.proposed_partition, result.proposed_partition);
  assert.notStrictEqual(
    repeated.proposed_partition.proposed_profiles,
    result.proposed_partition.proposed_profiles,
  );
  assert.notStrictEqual(repeated.unresolved_items, result.unresolved_items);
  assert.notStrictEqual(result.authority_binding, authorityEnvelope.binding);
  assert.notStrictEqual(
    result.authorised_rule_components,
    authority.authorised_synthetic_rule_components,
  );
  assert.notStrictEqual(
    result.source_terminal_coverage.source_unit_assignments,
    terminals,
  );
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  freezeDeep(fixture);
  const frozenInputResult = profileAuthoring.prepareTerminationFamilyProposal(fixture);
  assert.equal(canonicalJson(frozenInputResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenInputResult), true);

  await t.test('rejects malformed public input', () => {
    expectCode('M7_V2_TERMINATION_PHASE2_PROPOSAL_CONTRACT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(null)
    ));
    const extra = forkTerminationPhase2ProposalFixture(fixture);
    extra.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE2_PROPOSAL_CONTRACT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(extra)
    ));
    const missing = forkTerminationPhase2ProposalFixture(fixture);
    delete missing.governedSources;
    expectCode('M7_V2_TERMINATION_PHASE2_PROPOSAL_CONTRACT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(missing)
    ));
  });

  await t.test('rejects authority drift before all later errors', () => {
    const absent = forkTerminationPhase2ProposalFixture(fixture);
    absent.terminationAuthoringPhase2Authority = null;
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(absent)
    ));

    const envelopeExtra = forkTerminationPhase2ProposalFixture(fixture);
    envelopeExtra.terminationAuthoringPhase2Authority.extra = true;
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(envelopeExtra)
    ));

    const bindingExtra = forkTerminationPhase2ProposalFixture(fixture);
    bindingExtra.terminationAuthoringPhase2Authority.binding.extra = true;
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(bindingExtra)
    ));

    const predecessor = forkTerminationPhase2ProposalFixture(fixture);
    predecessor.terminationAuthoringPhase2Authority = sourceEnvelope(
      authority.immutable_predecessor_binding,
    );
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(predecessor)
    ));

    const bindingDrift = forkTerminationPhase2ProposalFixture(fixture);
    bindingDrift.terminationAuthoringPhase2Authority.binding.record_id = '0'.repeat(64);
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(bindingDrift)
    ));

    const recordDrift = forkTerminationPhase2ProposalFixture(fixture);
    recordDrift.terminationAuthoringPhase2Authority.record = {
      ...authority,
      authority_state: authority.authority_state === 'APPROVED'
        ? 'UNAPPROVED' : 'APPROVED',
    };
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(recordDrift)
    ));

    const restampedExtra = forkTerminationPhase2ProposalFixture(fixture);
    restampedExtra.terminationAuthoringPhase2Authority.record = {
      ...structuredClone(authority),
      extra_authority_member: true,
    };
    restampTerminationPhase2Authority(
      restampedExtra.terminationAuthoringPhase2Authority,
    );
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(restampedExtra)
    ));

    const combined = forkTerminationPhase2ProposalFixture(fixture);
    combined.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationFamilyProposal(combined)
    ));
  });

  await t.test('rejects governed source shape and binding drift as source coverage', () => {
    const extraGoverned = forkTerminationPhase2ProposalFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(extraGoverned)
    ));

    const missingGoverned = forkTerminationPhase2ProposalFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(missingGoverned)
    ));

    const envelopeExtra = forkTerminationPhase2ProposalFixture(fixture);
    const envelopeSource = forkTerminationSourceEnvelope(
      envelopeExtra.governedSources,
      'baseContractPolicy',
    );
    envelopeSource.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(envelopeExtra)
    ));

    const bindingExtra = forkTerminationPhase2ProposalFixture(fixture);
    const bindingSource = forkTerminationSourceEnvelope(
      bindingExtra.governedSources,
      'baseContractPolicy',
    );
    bindingSource.binding.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(bindingExtra)
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase2ProposalFixture(fixture);
      const source = forkTerminationSourceEnvelope(drift.governedSources, sourceKey);
      source.binding.sha256 = '0'.repeat(64);
      expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
        profileAuthoring.prepareTerminationFamilyProposal(drift)
      ));
    }

    const recordExtra = forkTerminationPhase2ProposalFixture(fixture);
    const baseSource = forkTerminationSourceEnvelope(
      recordExtra.governedSources,
      'baseContractPolicy',
    );
    baseSource.record = { ...baseSource.record, extra: true };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(recordExtra)
    ));

    const calibrationDrift = forkTerminationPhase2ProposalFixture(fixture);
    const calibrationSource = forkTerminationSourceEnvelope(
      calibrationDrift.governedSources,
      'calibrationPack',
    );
    calibrationSource.record = {
      ...calibrationSource.record,
      family_key: 'TERMINATION_FEE',
    };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(calibrationDrift)
    ));
  });

  await t.test('rejects agreement evidence drift as source coverage', () => {
    const agreementIds = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const [agreementId] = agreementIds;

    const missing = forkTerminationPhase2ProposalFixture(fixture);
    delete missing.governedSources.agreementEvidenceByAgreementId[agreementId];
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(missing)
    ));

    const extra = forkTerminationPhase2ProposalFixture(fixture);
    extra.governedSources.agreementEvidenceByAgreementId['0'.repeat(64)] =
      fixture.governedSources.agreementEvidenceByAgreementId[agreementId];
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(extra)
    ));

    const identityDrift = forkTerminationPhase2ProposalFixture(fixture);
    const identityEvidence = forkTerminationAgreementEvidence(
      identityDrift,
      agreementId,
    );
    identityEvidence.canonicalTextIdentity = {
      ...identityEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(identityDrift)
    ));

    const identityExtra = forkTerminationPhase2ProposalFixture(fixture);
    const extraIdentityEvidence = forkTerminationAgreementEvidence(
      identityExtra,
      agreementId,
    );
    extraIdentityEvidence.canonicalTextIdentity = {
      ...extraIdentityEvidence.canonicalTextIdentity,
      extra: true,
    };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(identityExtra)
    ));

    const agreementExtra = forkTerminationPhase2ProposalFixture(fixture);
    const extraEvidence = forkTerminationAgreementEvidence(agreementExtra, agreementId);
    extraEvidence.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(agreementExtra)
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase2ProposalFixture(fixture);
      const evidence = forkTerminationAgreementEvidence(drift, agreementId);
      const source = forkTerminationSourceEnvelope(evidence, sourceKey);
      source.binding.record_id = '0'.repeat(64);
      expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
        profileAuthoring.prepareTerminationFamilyProposal(drift)
      ));
    }

    const m4ClaimDrift = forkTerminationPhase2ProposalFixture(fixture);
    const conchoEvidence = forkTerminationAgreementEvidence(
      m4ClaimDrift,
      '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116',
    );
    const conchoM4 = forkTerminationSourceEnvelope(conchoEvidence, 'm4');
    const admittedConchoClaimId =
      '2803d81e65a77250f1caf34b90993f219b86b18890774eadbe3893907918093a';
    const conchoClaims = conchoM4.record.claims.filter(
      (claim) => claim.analysis_claim_id !== admittedConchoClaimId,
    );
    assert.equal(conchoClaims.length, conchoM4.record.claims.length - 1);
    conchoM4.record = { ...conchoM4.record, claims: conchoClaims };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(m4ClaimDrift)
    ));

    const m3DefinitionDrift = forkTerminationPhase2ProposalFixture(fixture);
    const redHatEvidence = forkTerminationAgreementEvidence(
      m3DefinitionDrift,
      '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
    );
    const redHatM3 = forkTerminationSourceEnvelope(redHatEvidence, 'm3');
    const nativeDefinitionEdgeId =
      '2d4f3f99f521f9caab96d49437780db60d58de0dada1222fbf7377a14610c767';
    const definitionEdges = redHatM3.record.definition_edges.filter(
      (edge) => edge.definition_edge_id !== nativeDefinitionEdgeId,
    );
    assert.equal(definitionEdges.length, redHatM3.record.definition_edges.length - 1);
    redHatM3.record = { ...redHatM3.record, definition_edges: definitionEdges };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(m3DefinitionDrift)
    ));

    const primaryTerminal = terminals.find(
      (terminal) => terminal.agreement_id === agreementId,
    );
    assert(primaryTerminal);
    const nodeDrift = forkTerminationPhase2ProposalFixture(fixture);
    const nodeEvidence = forkTerminationAgreementEvidence(nodeDrift, agreementId);
    const m2Source = forkTerminationSourceEnvelope(nodeEvidence, 'm2');
    const nodeIndex = m2Source.record.nodes.findIndex(
      (node) => node.node_occurrence_id === primaryTerminal.source_unit_key,
    );
    assert.notEqual(nodeIndex, -1);
    const nodes = m2Source.record.nodes.slice();
    const node = nodes[nodeIndex];
    nodes[nodeIndex] = {
      ...node,
      node_kind: node.node_kind === 'LIMB' ? 'PARAGRAPH' : 'LIMB',
    };
    m2Source.record = { ...m2Source.record, nodes };
    expectCode('M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationFamilyProposal(nodeDrift)
    ));
  });

  assert.equal(t.name, 'Phase2 proposal derives a deterministic unapproved Termination partition');
});

test('Phase3 reference review candidate preserves unresolved Termination references without Work3 activation', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationReferenceReviewCandidate,
    'function',
  );

  const fixture = terminationPhase3ReferenceReviewFixture();
  const phase3Envelope = fixture.terminationPhase3ReviewAuthority;
  const phase3Authority = phase3Envelope.record;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);
  const phase3Bytes = physicalBytes(
    TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(phase3Bytes),
    Buffer.from(`${canonicalJson(phase3Authority)}\n`, 'utf8'),
  );
  const unsignedPhase3Authority = structuredClone(phase3Authority);
  delete unsignedPhase3Authority
    .termination_authoring_phase3_reference_review_authority_id;
  assert.equal(
    phase3Authority.termination_authoring_phase3_reference_review_authority_id,
    contentId(phase3Authority.schema_version, unsignedPhase3Authority),
  );

  const result = profileAuthoring.prepareTerminationReferenceReviewCandidate(fixture);

  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertExactKeys(
    result,
    TERMINATION_PHASE3_REFERENCE_REVIEW_CANDIDATE_KEYS,
    'Phase3 reference review candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version: 'M7_V2_TERMINATION_PHASE3_REFERENCE_REVIEW_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state: 'REVIEW_ONLY_REFERENCE_RESOLUTION_PENDING',
  });
  assertExactKeys(
    result.phase2_authority_binding,
    phase3Authority.candidate_output_contract.phase2_authority_binding_exact_keys,
    'Phase2 authority binding keys',
  );
  assertExactKeys(
    result.phase3_authority_binding,
    phase3Authority.candidate_output_contract.phase3_authority_binding_exact_keys,
    'Phase3 authority binding keys',
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(result.phase3_authority_binding, phase3Envelope.binding);
  assert.equal(
    result.phase3_review_schedule_sha256,
    phase3Authority.phase3_review_schedule_contract.source_record_sha256,
  );
  assert.equal(
    result.reference_ledger_sha256,
    phase3Authority.reference_ledger_contract.sha256,
  );
  assert.equal(
    result.review_candidate_id,
    contentId(
      result.schema_version,
      referenceReviewCandidateUnsignedRecord(result),
    ),
  );

  const phase2Proposal = profileAuthoring.prepareTerminationFamilyProposal({
    terminationAuthoringPhase2Authority: phase2Envelope,
    governedSources: fixture.governedSources,
  });
  const expectedPhase2ProposalBinding = {
    proposal_id: phase2Proposal.proposal_id,
    inventory_digest: phase2Proposal.inventory_digest,
    derived_profile_count: phase2Proposal.derived_profile_count,
    source_unit_count: phase2Proposal.source_terminal_coverage.accounted_count,
    claim_count: phase2Proposal.m4_claim_accounting.accounted_count,
  };
  assertExactKeys(
    result.phase2_proposal_binding,
    phase3Authority.candidate_output_contract.phase2_proposal_binding_exact_keys,
    'Phase2 proposal binding keys',
  );
  assert.deepEqual(
    result.phase2_proposal_binding,
    expectedPhase2ProposalBinding,
  );
  assert.deepEqual(
    expectedPhase2ProposalBinding,
    phase3Authority.phase2_proposal_binding,
  );

  const ledger = result.reference_ledger;
  assert.equal(ledger.length, 221);
  assert.deepEqual(ledger, phase3Authority.reference_ledger);
  assert.notStrictEqual(ledger, phase3Authority.reference_ledger);
  assertDisjoint(
    collectObjectIdentities(ledger),
    collectObjectIdentities(phase3Authority.reference_ledger),
    'candidate/authority reference ledger alias',
  );
  const ledgerBytes = Buffer.from(canonicalJson(ledger), 'utf8');
  assert.equal(
    ledgerBytes.byteLength,
    phase3Authority.reference_ledger_contract.canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(ledgerBytes),
    phase3Authority.reference_ledger_contract.sha256,
  );
  const rowIdentityKeys = ledger.map((row) => [
    row.profile_key,
    row.source_unit_key,
    row.field_key,
  ].join('\0'));
  assert.deepEqual(rowIdentityKeys, rowIdentityKeys.slice().sort());
  assert.equal(new Set(rowIdentityKeys).size, 221);
  for (const row of ledger) {
    assert.deepEqual(
      Object.keys(row).sort(),
      TERMINATION_PHASE3_REFERENCE_LEDGER_ROW_KEYS.slice().sort(),
      `${row.profile_key}:${row.source_unit_key}:${row.field_key} ledger keys`,
    );
  }

  const directRows = ledger.filter(
    (row) => row.reference_classification === 'DIRECT_NON_EMPTY_REFERENCE_STRING',
  );
  const governedRows = ledger.filter(
    (row) => row.reference_classification === 'GOVERNED_SEMANTIC_FACT_KEY',
  );
  const unresolvedRows = ledger.filter(
    (row) => row.reference_classification === 'UNRESOLVED_REFERENCE_SLOT',
  );
  assert.deepEqual({
    DIRECT_NON_EMPTY_REFERENCE_STRING: directRows.length,
    GOVERNED_SEMANTIC_FACT_KEY: governedRows.length,
    UNRESOLVED_REFERENCE_SLOT: unresolvedRows.length,
  }, phase3Authority.reference_ledger_contract.classification_counts);

  for (const row of directRows) {
    assert.equal(row.materialisation_state, 'NON_EMPTY_REFERENCE_STRING_PRESENT');
    assert.equal(typeof row.typed_value, 'string');
    assert.notEqual(row.typed_value.length, 0);
    assert.equal(row.review_descriptor, null);
    assert.equal(row.governed_reference_materialisation, null);
    assert.equal(row.work3_fixture_consumable_value_shape, true);
    assert.equal(row.value_source.startsWith('V2_COMPONENT:'), true);
    const componentKey = row.value_source.slice('V2_COMPONENT:'.length);
    const component = phase2Authority.authorised_synthetic_rule_components.find(
      (candidate) => candidate.component_key === componentKey,
    );
    assert(component, componentKey);
    const matchingFacts = component.fact_contracts.filter((fact) => (
      fact.field_key === row.field_key
        && fact.value_type === 'REFERENCE'
        && fact.typed_value === row.typed_value
    ));
    assert.equal(matchingFacts.length, 1, `${componentKey}:${row.field_key}`);
  }

  const ownerRegistry = phase2Authority.implementation_contract
    .reference_target_owner_template_registry;
  const terminalBySourceUnitKey = new Map(
    phase2Authority.source_terminal_successor_contract.terminal_rule_registry.map(
      (terminal) => [terminal.source_unit_key, terminal],
    ),
  );
  const governedSemanticKeys = new Set();
  const governedValueSourceCounts = {
    PHASE1_EVENT_REFERENCE_OWNER_CONTRACT_TO_V2_REFERENCE_TARGET_OWNER_TEMPLATE: 0,
    V2_REFERENCE_TARGET_OWNER_TEMPLATE_REGISTRY: 0,
  };
  const governedResolutionCounts = {
    RESOLVED_PHASE2_TEMPORAL_STATE_REFERENCE: 0,
    RESOLVED_PHASE2_EVENT_REFERENCE: 0,
  };
  for (const row of governedRows) {
    assert.equal(row.materialisation_state, 'NON_EMPTY_REFERENCE_STRING_PRESENT');
    assert.equal(LOWERCASE_HEX_64.test(row.typed_value), true);
    assert.equal(row.work3_fixture_consumable_value_shape, true);
    const materialisation = row.governed_reference_materialisation;
    assert(materialisation);
    assert.deepEqual(
      Object.keys(materialisation).sort(),
      TERMINATION_PHASE3_GOVERNED_REFERENCE_KEYS.slice().sort(),
    );
    assert.equal(
      materialisation.semantic_fact_identity_domain,
      'AGREEMENT_SEMANTIC_FACT/V2',
    );
    assert.equal(
      materialisation.semantic_fact_key,
      contentId(
        materialisation.semantic_fact_identity_domain,
        materialisation.semantic_fact_identity_payload,
      ),
    );
    assert.equal(row.typed_value, materialisation.semantic_fact_key);
    governedSemanticKeys.add(row.typed_value);
    governedValueSourceCounts[row.value_source] += 1;
    if (row.value_source
      === 'PHASE1_EVENT_REFERENCE_OWNER_CONTRACT_TO_V2_REFERENCE_TARGET_OWNER_TEMPLATE') {
      const phase1EventReferenceContract = fixture.governedSources
        .temporalPhase1Authority.record.policy_overlay.event_reference_contract;
      assert.equal(row.field_key, phase1EventReferenceContract.consumer_fact_field_key);
      assert.deepEqual(row.review_descriptor, {
        owner_fact_field_key: phase1EventReferenceContract.owner_fact_field_key,
        owner_node_occurrence_id:
          phase1EventReferenceContract.owner_node_occurrence_id,
      });
      assert.equal(
        materialisation.phase1_authority_path,
        phase3Authority.immutable_parent_bindings
          .termination_temporal_phase1_authority.path,
      );
    } else {
      assert.equal(row.value_source, 'V2_REFERENCE_TARGET_OWNER_TEMPLATE_REGISTRY');
      assert.deepEqual(
        row.review_descriptor,
        materialisation.owner_template_descriptor_key,
      );
      assert.equal(materialisation.phase1_authority_path, null);
    }

    const matchingTemplates = ownerRegistry.templates.filter((template) => (
      canonicalJson(template.descriptor_key)
        === canonicalJson(materialisation.owner_template_descriptor_key)
    ));
    assert.equal(matchingTemplates.length, 1, row.field_key);
    const [template] = matchingTemplates;
    const templateIndex = ownerRegistry.templates.indexOf(template);
    assert.equal(
      materialisation.owner_template_authority_path,
      `${TERMINATION_PHASE2_AUTHORITY_BINDING.path}`
        + '#/implementation_contract/reference_target_owner_template_registry/'
        + `templates/${templateIndex}`,
    );
    assert.deepEqual(materialisation.semantic_fact_identity_payload, {
      agreement_id: template.agreement_id,
      field_key: template.field_key,
      legal_effect_role: template.legal_effect_role,
      legal_subject: template.legal_subject,
      normalised_typed_value: template.typed_value,
      source_support_ids: template.source_supports.map(
        (support) => support.source_support_id,
      ),
      temporal_scope_signature: template.temporal_scope_signature,
    });
    for (const support of template.source_supports) {
      assert.equal(support.source_support_id, contentId(
        'AGREEMENT_SOURCE_SPAN/V2',
        {
          agreement_index_id: template.agreement_index_id,
          source_node_occurrence_id: support.node_occurrence_id,
          start_byte: support.source_span.start_byte,
          end_byte: support.source_span.end_byte,
          text_sha256: support.source_span.text_sha256,
        },
      ));
      const agreementEvidence = fixture.governedSources
        .agreementEvidenceByAgreementId[template.agreement_id];
      assert(agreementEvidence);
      assert.equal(
        agreementEvidence.m2.record.nodes.some(
          (node) => node.node_occurrence_id === support.node_occurrence_id,
        ),
        true,
      );
    }

    const terminal = terminalBySourceUnitKey.get(row.source_unit_key);
    assert(terminal);
    assert.equal(terminal.agreement_id, template.agreement_id);
    const dependencies = terminal.dependency_contracts.reference_dependencies.filter(
      (dependency) => dependency.field_key === row.field_key
        && phase3Authority.row_local_reference_projection_contract
          .allowed_resolution_states.includes(dependency.resolution_state),
    );
    assert.equal(dependencies.length, 1, `${row.source_unit_key}:${row.field_key}`);
    const [dependency] = dependencies;
    governedResolutionCounts[dependency.resolution_state] += 1;
    const expectedDescriptor = dependency.target_kind === 'EVENT_OWNER_FACT'
      ? {
        kind: 'DERIVED_REFERENCE_TARGET/V1',
        resolved_analysis_value_kind: 'SEMANTIC_FACT_KEY',
        target_field_key: dependency.target_field_key,
        target_kind: dependency.target_kind,
        target_node_occurrence_id: dependency.target_node_occurrence_id,
      }
      : {
        defined_term_key: dependency.target_field_key,
        graph_key: dependency.graph_key,
        kind: 'DERIVED_REFERENCE_TARGET/V1',
        resolved_analysis_value_kind: 'SEMANTIC_FACT_KEY',
        target_kind: dependency.target_kind,
      };
    assert.equal(
      canonicalJson(materialisation.owner_template_descriptor_key),
      canonicalJson(expectedDescriptor),
    );
    assert.equal(
      terminal.source_closure.members.some(
        (member) => member.node_occurrence_id === dependency.target_node_occurrence_id,
      ),
      true,
    );
  }
  assert.deepEqual(governedResolutionCounts, {
    RESOLVED_PHASE2_TEMPORAL_STATE_REFERENCE: 28,
    RESOLVED_PHASE2_EVENT_REFERENCE: 34,
  });
  assert.deepEqual(governedValueSourceCounts, {
    PHASE1_EVENT_REFERENCE_OWNER_CONTRACT_TO_V2_REFERENCE_TARGET_OWNER_TEMPLATE: 1,
    V2_REFERENCE_TARGET_OWNER_TEMPLATE_REGISTRY: 61,
  });
  assert.equal(
    phase3Authority.reference_ledger_contract
      .exact_preexisting_governed_semantic_fact_key_occurrence_count
      + phase3Authority.reference_ledger_contract
        .exact_row_local_projected_semantic_fact_key_occurrence_count,
    governedRows.length,
  );
  assert.equal(governedSemanticKeys.size, 7);
  assert.deepEqual(
    [...governedSemanticKeys].sort(),
    phase3Authority.reference_ledger_contract.governed_semantic_fact_keys,
  );
  const endDateRows = governedRows.filter((row) => (
    row.governed_reference_materialisation.owner_template_descriptor_key
      .defined_term_key === 'END_DATE'
  ));
  assert.equal(endDateRows.length, 7);
  assert.equal(new Set(endDateRows.map((row) => row.typed_value)).size, 2);
  const noticeRows = governedRows.filter((row) => (
    row.governed_reference_materialisation.owner_template_descriptor_key
      .target_field_key === 'TERMINATION_EXERCISE_NOTICE_EVENT'
  ));
  assert.equal(noticeRows.length, 34);
  assert.equal(new Set(noticeRows.map((row) => row.typed_value)).size, 2);

  for (const row of unresolvedRows) {
    assert.equal(
      row.materialisation_state,
      'PENDING_SUCCESSOR_RULING_AND_BUILDER_NON_EMPTY_REFERENCE_STRING',
    );
    assert.equal(row.typed_value, null);
    assert.equal(row.value_source, 'PROPOSED_REVIEW_DESCRIPTOR_NOT_WORK3_TYPED_VALUE');
    assert.equal(row.governed_reference_materialisation, null);
    assert.equal(row.work3_fixture_consumable_value_shape, false);
    assert.equal(typeof row.review_descriptor, 'object');
    assert.notEqual(row.review_descriptor, null);
    assert.equal(Array.isArray(row.review_descriptor), false);
  }

  assertExactKeys(
    result.reference_accounting,
    TERMINATION_PHASE3_REFERENCE_ACCOUNTING_KEYS,
    'Phase3 reference accounting keys',
  );
  assert.deepEqual(result.reference_accounting, {
    state: 'COMPLETE_221_ROW_TECHNICAL_REFERENCE_REVIEW',
    reference_occurrence_count: 221,
    non_empty_reference_string_count: 74,
    direct_non_empty_reference_string_count: 12,
    governed_semantic_fact_key_occurrence_count: 62,
    governed_semantic_fact_key_unique_count: 7,
    unresolved_reference_slot_count: 147,
  });

  const expectedSlots = expectedTerminationPhase3ReferenceSlots(phase3Authority);
  assert.equal(expectedSlots.length, 147);
  result.unresolved_reference_slots.forEach((slot) => assertExactKeys(
    slot,
    TERMINATION_PHASE3_REFERENCE_SLOT_KEYS,
    `${slot.reference_slot_key} unresolved slot keys`,
  ));
  assert.deepEqual(result.unresolved_reference_slots, expectedSlots);
  assert.equal(
    new Set(result.unresolved_reference_slots.map(
      (slot) => slot.reference_slot_key,
    )).size,
    147,
  );
  const slotBytes = Buffer.from(canonicalJson(result.unresolved_reference_slots), 'utf8');
  assert.equal(
    slotBytes.byteLength,
    phase3Authority.unresolved_reference_slot_contract.canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(slotBytes),
    phase3Authority.unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.unresolved_reference_slot_contract,
    phase3Authority.unresolved_reference_slot_contract,
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    TERMINATION_PHASE3_WITHHELD_WORK3_IDENTITIES,
  );
  assert.deepEqual(
    result.unresolved_items,
    phase3Authority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(result.zero_effect_boundary, {
    activation_count: 0,
    candidate_registration_count: 0,
    database_write_count: 0,
    family_package_count: 0,
    product_write_count: 0,
    unresolved_reference_slot_count: 147,
    unresolved_reference_string_substitution_count: 0,
    validate_single_family_package_inventory_call_count: 0,
    work3_member_id_count: 0,
    work3_typed_fact_count: 0,
  });
  const outputKeys = collectKeys(result);
  phase3Authority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  phase3Authority.forbidden_output_contract.forbidden_schema_versions_anywhere.forEach(
    (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
  );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);
  assert.equal(outputStrings.some((value) => /LEGAL_QUESTION_SHA256/i.test(value)), false);

  const repeated = profileAuthoring.prepareTerminationReferenceReviewCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated Phase3 result object alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture = terminationPhase3ReferenceReviewFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring.prepareTerminationReferenceReviewCandidate(
    frozenFixture,
  );
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    expectCode('M7_V2_TERMINATION_PHASE3_REFERENCE_REVIEW_CONTRACT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(null)
    ));
    const extra = forkTerminationPhase3ReferenceReviewFixture(fixture);
    extra.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE3_REFERENCE_REVIEW_CONTRACT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing = forkTerminationPhase3ReferenceReviewFixture(fixture);
      delete missing[key];
      expectCode('M7_V2_TERMINATION_PHASE3_REFERENCE_REVIEW_CONTRACT', () => (
        profileAuthoring.prepareTerminationReferenceReviewCandidate(missing)
      ));
    }
  });

  await t.test('rejects Phase3 authority drift before all later errors', () => {
    const absent = forkTerminationPhase3ReferenceReviewFixture(fixture);
    absent.terminationPhase3ReviewAuthority = null;
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(absent)
    ));

    const envelopeExtra = forkTerminationPhase3ReferenceReviewFixture(fixture);
    envelopeExtra.terminationPhase3ReviewAuthority.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(envelopeExtra)
    ));

    const bindingDrift = forkTerminationPhase3ReferenceReviewFixture(fixture);
    bindingDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(bindingDrift)
    ));

    const recordDrift = forkTerminationPhase3ReferenceReviewFixture(fixture);
    recordDrift.terminationPhase3ReviewAuthority.record = {
      ...phase3Authority,
      authority_state: 'DRIFTED',
    };
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(recordDrift)
    ));

    const restampedLedgerDrift = forkTerminationPhase3ReferenceReviewFixture(fixture);
    const driftedLedger = structuredClone(phase3Authority.reference_ledger);
    driftedLedger[0] = {
      ...driftedLedger[0],
      reference_classification: 'UNRESOLVED_REFERENCE_SLOT',
    };
    restampedLedgerDrift.terminationPhase3ReviewAuthority.record = {
      ...structuredClone(phase3Authority),
      reference_ledger: driftedLedger,
    };
    restampTerminationPhase3ReferenceReviewAuthority(
      restampedLedgerDrift.terminationPhase3ReviewAuthority,
    );
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(restampedLedgerDrift)
    ));

    const combined = forkTerminationPhase3ReferenceReviewFixture(fixture);
    combined.terminationPhase3ReviewAuthority.binding.record_id = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(combined)
    ));
  });

  await t.test('rejects Phase2 authority and proposal drift before sources', () => {
    const predecessor = forkTerminationPhase3ReferenceReviewFixture(fixture);
    predecessor.terminationAuthoringPhase2Authority = sourceEnvelope(
      phase2Authority.immutable_predecessor_binding,
    );
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(predecessor)
    ));

    const bindingDrift = forkTerminationPhase3ReferenceReviewFixture(fixture);
    bindingDrift.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(bindingDrift)
    ));

    const restampedExtra = forkTerminationPhase3ReferenceReviewFixture(fixture);
    restampedExtra.terminationAuthoringPhase2Authority.record = {
      ...structuredClone(phase2Authority),
      extra_authority_member: true,
    };
    restampTerminationPhase2Authority(
      restampedExtra.terminationAuthoringPhase2Authority,
    );
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(restampedExtra)
    ));

    const combined = forkTerminationPhase3ReferenceReviewFixture(fixture);
    combined.terminationAuthoringPhase2Authority.binding.record_id = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode('M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(combined)
    ));
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const extraGoverned = forkTerminationPhase3ReferenceReviewFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(extraGoverned)
    ));

    const missingGoverned = forkTerminationPhase3ReferenceReviewFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(missingGoverned)
    ));

    const sourceBindingExtra = forkTerminationPhase3ReferenceReviewFixture(fixture);
    forkTerminationSourceEnvelope(
      sourceBindingExtra.governedSources,
      'baseContractPolicy',
    ).binding.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(sourceBindingExtra)
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase3ReferenceReviewFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
        profileAuthoring.prepareTerminationReferenceReviewCandidate(drift)
      ));
    }

    const agreementIds = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const [agreementId] = agreementIds;
    const missingAgreement = forkTerminationPhase3ReferenceReviewFixture(fixture);
    delete missingAgreement.governedSources
      .agreementEvidenceByAgreementId[agreementId];
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(missingAgreement)
    ));

    const extraAgreement = forkTerminationPhase3ReferenceReviewFixture(fixture);
    extraAgreement.governedSources.agreementEvidenceByAgreementId['0'.repeat(64)] =
      fixture.governedSources.agreementEvidenceByAgreementId[agreementId];
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(extraAgreement)
    ));

    const canonicalTextDrift = forkTerminationPhase3ReferenceReviewFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
      profileAuthoring.prepareTerminationReferenceReviewCandidate(canonicalTextDrift)
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase3ReferenceReviewFixture(fixture);
      const evidence = forkTerminationAgreementEvidence(drift, agreementId);
      forkTerminationSourceEnvelope(evidence, sourceKey).binding.record_id =
        '0'.repeat(64);
      expectCode('M7_V2_TERMINATION_PHASE3_REVIEW_SOURCE_COVERAGE', () => (
        profileAuthoring.prepareTerminationReferenceReviewCandidate(drift)
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 reference review candidate preserves unresolved Termination references without Work3 activation',
  );
});

test('Phase3 reference target evidence preserves exact Termination source targets without Work3 materialisation', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate,
    'function',
  );

  const fixture = terminationPhase3TargetEvidenceFixture();
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const targetAuthority = targetEnvelope.record;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(targetAuthority)}\n`, 'utf8'),
  );
  const unsignedTargetAuthority = structuredClone(targetAuthority);
  delete unsignedTargetAuthority
    .termination_authoring_phase3_reference_target_evidence_authority_id;
  assert.equal(
    targetAuthority
      .termination_authoring_phase3_reference_target_evidence_authority_id,
    contentId(targetAuthority.schema_version, unsignedTargetAuthority),
  );

  const predecessor = profileAuthoring.prepareTerminationReferenceReviewCandidate({
    terminationPhase3ReviewAuthority: reviewEnvelope,
    terminationAuthoringPhase2Authority: phase2Envelope,
    governedSources: fixture.governedSources,
  });
  assert.deepEqual({
    schema_version: predecessor.schema_version,
    review_candidate_id: predecessor.review_candidate_id,
    reference_occurrence_count:
      predecessor.reference_accounting.reference_occurrence_count,
    non_empty_reference_string_count:
      predecessor.reference_accounting.non_empty_reference_string_count,
    unresolved_reference_slot_count:
      predecessor.reference_accounting.unresolved_reference_slot_count,
    reference_ledger_sha256: predecessor.reference_ledger_sha256,
    unresolved_reference_slot_sha256:
      predecessor.unresolved_reference_slot_contract.sha256,
  }, targetAuthority.predecessor_review_candidate_binding);

  const result = profileAuthoring
    .prepareTerminationReferenceTargetEvidenceCandidate(fixture);

  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'target evidence result/caller input alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_TARGET_EVIDENCE_CANDIDATE_KEYS,
    'Phase3 target evidence candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_TARGET_EVIDENCE_WORK3_MATERIALISATION_WITHHELD',
  });
  assert.equal(
    result.target_evidence_candidate_id,
    contentId(
      result.schema_version,
      targetEvidenceCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    predecessor.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase2_proposal_binding,
    targetAuthority.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assertExactKeys(
    result.phase2_authority_binding,
    targetAuthority.candidate_output_contract
      .phase2_authority_binding_exact_keys,
    'target evidence Phase2 binding keys',
  );
  assertExactKeys(
    result.phase2_proposal_binding,
    targetAuthority.candidate_output_contract
      .phase2_proposal_binding_exact_keys,
    'target evidence Phase2 proposal binding keys',
  );
  assertExactKeys(
    result.phase3_reference_review_authority_binding,
    targetAuthority.candidate_output_contract
      .phase3_reference_review_authority_binding_exact_keys,
    'target evidence predecessor authority binding keys',
  );
  assertExactKeys(
    result.phase3_target_evidence_authority_binding,
    targetAuthority.candidate_output_contract
      .phase3_target_evidence_authority_binding_exact_keys,
    'target evidence authority binding keys',
  );

  const descriptors = result.reference_target_evidence_descriptors;
  assert.equal(descriptors.length, 109);
  assert.deepEqual(
    descriptors,
    targetAuthority.reference_target_evidence_descriptors,
  );
  assert.notStrictEqual(
    descriptors,
    targetAuthority.reference_target_evidence_descriptors,
  );
  assertDisjoint(
    collectObjectIdentities(descriptors),
    collectObjectIdentities(targetAuthority.reference_target_evidence_descriptors),
    'candidate/authority target evidence alias',
  );
  const descriptorBytes = Buffer.from(canonicalJson(descriptors), 'utf8');
  assert.equal(
    descriptorBytes.byteLength,
    targetAuthority.reference_target_evidence_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(descriptorBytes),
    targetAuthority.reference_target_evidence_contract.sha256,
  );

  const predecessorSlotByKey = new Map(
    predecessor.unresolved_reference_slots.map((slot, index) => [
      slot.reference_slot_key,
      { slot, index },
    ]),
  );
  const terminalRegistry = phase2Authority.source_terminal_successor_contract
    .terminal_rule_registry;
  const terminalBySourceUnitKey = new Map(
    terminalRegistry.map((terminal, index) => [
      terminal.source_unit_key,
      { terminal, index },
    ]),
  );
  const evidenceByAgreementId = fixture.governedSources
    .agreementEvidenceByAgreementId;
  const descriptorSlotKeys = new Set();
  const descriptorIds = new Set();
  const evidenceKindCounts = {
    CANONICAL_TEXT_M2_SECTION_CITATION: 0,
    PHASE2_ROW_LOCAL_TARGET_EVIDENCE: 0,
    RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE: 0,
  };
  const citationKindCounts = {
    EXACT_EXPLICIT_SECTION_CITATION: 0,
    EXACT_COORDINATED_SECTION_SHORTHAND: 0,
  };
  const rowLocalSubtypeCounts = {
    SHARED_CHAPEAU_EFFECTIVE_TIME_OWNER_EVIDENCE: 0,
    SOURCE_PROVED_LINKED_RULE_TARGET_EVIDENCE: 0,
    NATIVE_M3_DEFINED_TERM_OWNER_NON_EVENT_EVIDENCE: 0,
    NATIVE_M3_DEFINED_TERM_OWNER_EVENT_EVIDENCE: 0,
  };
  const rawM3FieldByTerm = Object.freeze({
    'Company Letter': 'COMPANY_LETTER_REFERENCE',
    'Shareholders Meeting': 'SHAREHOLDERS_MEETING_REFERENCE',
    'Shareholder Approval': 'SHAREHOLDER_APPROVAL_REFERENCE',
    'Termination Fee': 'TERMINATION_FEE_REFERENCE',
  });
  let precedingSlotIndex = -1;
  let rawM3EdgeCount = 0;

  for (const descriptor of descriptors) {
    assertExactKeys(
      descriptor,
      TERMINATION_PHASE3_TARGET_EVIDENCE_DESCRIPTOR_KEYS,
      `${descriptor.reference_slot_key} target evidence keys`,
    );
    const unsignedDescriptor = structuredClone(descriptor);
    delete unsignedDescriptor.target_evidence_id;
    assert.equal(
      descriptor.target_evidence_id,
      contentId(
        targetAuthority.reference_target_evidence_contract.identity_domain,
        unsignedDescriptor,
      ),
    );
    assert.equal(descriptorIds.has(descriptor.target_evidence_id), false);
    descriptorIds.add(descriptor.target_evidence_id);
    assert.equal(descriptorSlotKeys.has(descriptor.reference_slot_key), false);
    descriptorSlotKeys.add(descriptor.reference_slot_key);
    assert.equal(
      descriptor.materialisation_state,
      'EXACT_SOURCE_TARGET_EVIDENCE_PROVED_WORK3_VALUE_WITHHELD',
    );
    assert.equal(descriptor.work3_fixture_consumable_value_shape, false);

    const predecessorSlot = predecessorSlotByKey.get(
      descriptor.reference_slot_key,
    );
    assert(predecessorSlot, descriptor.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingSlotIndex, true);
    precedingSlotIndex = predecessorSlot.index;
    assert.deepEqual({
      profile_key: descriptor.profile_key,
      source_unit_key: descriptor.source_unit_key,
      field_key: descriptor.field_key,
    }, {
      profile_key: predecessorSlot.slot.profile_key,
      source_unit_key: predecessorSlot.slot.source_unit_key,
      field_key: predecessorSlot.slot.field_key,
    });

    const terminalEntry = terminalBySourceUnitKey.get(
      descriptor.source_unit_key,
    );
    assert(terminalEntry, descriptor.source_unit_key);
    const { terminal, index: terminalIndex } = terminalEntry;
    assert.equal(descriptor.agreement_id, terminal.agreement_id);
    const agreementEvidence = evidenceByAgreementId[descriptor.agreement_id];
    assert(agreementEvidence, descriptor.agreement_id);
    const m2 = agreementEvidence.m2.record;
    const m3 = agreementEvidence.m3.record;
    evidenceKindCounts[descriptor.evidence_kind] += 1;

    if (descriptor.evidence_kind
      === 'CANONICAL_TEXT_M2_SECTION_CITATION') {
      const contract = targetAuthority.reference_target_evidence_contract
        .evidence_payload_contracts.CANONICAL_TEXT_M2_SECTION_CITATION;
      const payload = descriptor.evidence_payload;
      const occurrence = payload.citation_occurrence;
      const target = payload.m2_target;
      assertExactKeys(
        payload,
        [...contract.exact_keys].sort(),
        'citation payload keys',
      );
      assertExactKeys(
        occurrence,
        [...contract.citation_occurrence_exact_keys].sort(),
        'citation occurrence keys',
      );
      assertExactKeys(
        target,
        [...contract.m2_target_exact_keys].sort(),
        'M2 target keys',
      );
      assert.equal(payload.citation_kind, occurrence.citation_parse_kind);
      citationKindCounts[payload.citation_kind] += 1;

      const closureMembers = terminal.source_closure.members.filter(
        (member) => member.node_occurrence_id
          === occurrence.source_node_occurrence_id
          && member.closure_role === occurrence.source_closure_role
          && canonicalJson(member.source_span)
            === canonicalJson(occurrence.source_span),
      );
      assert.equal(closureMembers.length, 1);
      assert.equal(
        m2.nodes.some((node) => node.node_occurrence_id
          === occurrence.source_node_occurrence_id),
        true,
      );
      assert.equal(
        occurrence.citation_span.start_byte
          >= occurrence.source_span.start_byte,
        true,
      );
      assert.equal(
        occurrence.citation_span.end_byte <= occurrence.source_span.end_byte,
        true,
      );
      const printedCitation = utf8Slice(
        m2.source_binding.canonical_text,
        occurrence.citation_span.start_byte,
        occurrence.citation_span.end_byte,
      );
      assert.equal(printedCitation, occurrence.printed_citation);
      assert.equal(
        sha256Hex(Buffer.from(printedCitation, 'utf8')),
        occurrence.citation_span.text_sha256,
      );
      assert.equal(
        occurrence.parsed_references.includes(occurrence.selected_reference),
        true,
      );
      if (payload.citation_kind === 'EXACT_EXPLICIT_SECTION_CITATION') {
        const match = occurrence.printed_citation.match(
          /^Sections? ([0-9]+(?:\.[0-9]+)+(?:\([A-Za-z0-9]+\))*)$/,
        );
        assert(match, occurrence.printed_citation);
        assert.deepEqual(occurrence.parsed_references, [match[1]]);
        assert.equal(occurrence.selected_reference, match[1]);
      } else {
        assert.equal(
          payload.citation_kind,
          'EXACT_COORDINATED_SECTION_SHORTHAND',
        );
        assert.equal(
          occurrence.printed_citation,
          'Sections 7.2(a) or (b) or Section 7.3(a) or (b)',
        );
        assert.deepEqual(
          occurrence.parsed_references,
          ['7.2(a)', '7.2(b)', '7.3(a)', '7.3(b)'],
        );
        assert.equal(
          ['7.2(b)', '7.3(b)'].includes(occurrence.selected_reference),
          true,
        );
        assert.deepEqual(occurrence.citation_span, {
          coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
          start_byte: 275030,
          end_byte: 275077,
          text_sha256:
            '08ef206283b22b4405a858b95548d8cf71fa538648794a94962d1c05aa71b53f',
        });
      }
      const matchingTargets = m2.nodes.filter(
        (node) => node.reference === occurrence.selected_reference,
      );
      assert.equal(matchingTargets.length, 1);
      const [matchingTarget] = matchingTargets;
      assert.deepEqual(target, {
        agreement_index_id: m2.agreement_index_id,
        node_occurrence_id: matchingTarget.node_occurrence_id,
        node_kind: matchingTarget.node_kind,
        reference: matchingTarget.reference,
        extent_span: matchingTarget.extent_span,
      });
    } else if (descriptor.evidence_kind
      === 'PHASE2_ROW_LOCAL_TARGET_EVIDENCE') {
      const contract = targetAuthority.reference_target_evidence_contract
        .evidence_payload_contracts.PHASE2_ROW_LOCAL_TARGET_EVIDENCE;
      const payload = descriptor.evidence_payload;
      assertExactKeys(
        payload,
        [...contract.exact_keys].sort(),
        'row-local payload keys',
      );
      rowLocalSubtypeCounts[payload.evidence_subtype] += 1;
      const members = payload.source_contract_members.map((sourceMember) => {
        assertExactKeys(
          sourceMember,
          [...contract.source_contract_member_exact_keys].sort(),
          'row-local source member keys',
        );
        assert.equal(
          sourceMember.contract_path.startsWith(
            `/source_terminal_successor_contract/terminal_rule_registry/${terminalIndex}/`,
          ),
          true,
        );
        const authorityMember = jsonPointerValue(
          phase2Authority,
          sourceMember.contract_path,
        );
        assert.deepEqual(sourceMember.member, authorityMember);
        return authorityMember;
      });
      if (payload.evidence_subtype
        === 'SHARED_CHAPEAU_EFFECTIVE_TIME_OWNER_EVIDENCE') {
        assert.equal(descriptor.field_key, 'EFFECTIVE_TIME_REFERENCE');
        assert.equal(members.length, 3);
        assert.equal(members[0].binding_kind, 'COMMON_CHAPEAU_RELATIONSHIP');
        assert.equal(members[0].resolution_state, 'SOURCE_PROVED');
        assert.equal(members[0].target_node_occurrence_id, members[2].node_occurrence_id);
        assert.equal(members[1].includes(descriptor.field_key), true);
      } else if (payload.evidence_subtype
        === 'SOURCE_PROVED_LINKED_RULE_TARGET_EVIDENCE') {
        assert.equal(members.length, 2);
        assert.equal(
          members[0].binding_kind,
          'CROSS_NODE_MATERIAL_RULE_RELATIONSHIP',
        );
        assert.equal(members[0].resolution_state, 'SOURCE_PROVED');
        assert.equal(members[0].target_node_occurrence_id, members[1].node_occurrence_id);
        assert.equal(members[0].target_signature.includes(descriptor.field_key), true);
      } else {
        assert.equal([
          'NATIVE_M3_DEFINED_TERM_OWNER_NON_EVENT_EVIDENCE',
          'NATIVE_M3_DEFINED_TERM_OWNER_EVENT_EVIDENCE',
        ].includes(payload.evidence_subtype), true);
        assert.equal(members.length, 2);
        const [dependency, ownerMember] = members;
        assert.equal(dependency.field_key, descriptor.field_key);
        assert.equal(
          dependency.resolution_state,
          'RESOLVED_NATIVE_M3_DEFINITION_EDGE',
        );
        assert.equal(
          dependency.owner_node_occurrence_id,
          ownerMember.node_occurrence_id,
        );
        const edge = m3.definition_edges.find(
          (candidate) => candidate.definition_edge_id
            === dependency.native_m3_definition_edge_id,
        );
        assert(edge, dependency.native_m3_definition_edge_id);
        assert.equal(edge.state, 'RESOLVED');
        assert.equal(edge.reason_code, 'UNIQUE_EXACT_DEFINITION_TARGET');
        assert.equal(edge.rule_id, 'EXACT_M2_DEFINED_TERM_USE/V1');
        assert.equal(edge.term, dependency.source_text);
        assert.equal(
          edge.target_owner_node_occurrence_ids.includes(
            dependency.owner_node_occurrence_id,
          ),
          true,
        );
      }
    } else {
      assert.equal(
        descriptor.evidence_kind,
        'RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE',
      );
      const contract = targetAuthority.reference_target_evidence_contract
        .evidence_payload_contracts.RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE;
      const payload = descriptor.evidence_payload;
      assertExactKeys(
        payload,
        [...contract.exact_keys].sort(),
        'raw M3 payload keys',
      );
      assert.equal(descriptor.field_key, rawM3FieldByTerm[payload.term]);
      assertExactKeys(
        payload.m2_owner_node,
        [...contract.m2_owner_node_exact_keys].sort(),
        'raw M3 owner keys',
      );
      const edgeIds = payload.m3_definition_edges.map(
        (edge) => edge.definition_edge_id,
      );
      assert.deepEqual(edgeIds, edgeIds.slice().sort());
      rawM3EdgeCount += edgeIds.length;
      const ownerIds = new Set();
      for (const edge of payload.m3_definition_edges) {
        const boundEdge = m3.definition_edges.find(
          (candidate) => candidate.definition_edge_id
            === edge.definition_edge_id,
        );
        assert.deepEqual(edge, boundEdge);
        assert.equal(edge.term, payload.term);
        assert.equal(edge.raw_text, payload.term);
        assert.equal(edge.state, 'RESOLVED');
        assert.equal(edge.reason_code, 'UNIQUE_EXACT_DEFINITION_TARGET');
        assert.equal(edge.rule_id, 'EXACT_M2_DEFINED_TERM_USE/V1');
        assert.equal(edge.target_owner_node_occurrence_ids.length, 1);
        ownerIds.add(edge.target_owner_node_occurrence_ids[0]);
        assert.equal(
          terminal.source_closure.members.some((member) => (
            member.source_span.coordinate_system
              === edge.source_span.coordinate_system
            && member.source_span.start_byte <= edge.source_span.start_byte
            && edge.source_span.end_byte <= member.source_span.end_byte
          )),
          true,
        );
        assert.equal(
          utf8Slice(
            m2.source_binding.canonical_text,
            edge.source_span.start_byte,
            edge.source_span.end_byte,
          ),
          payload.term,
        );
      }
      assert.equal(ownerIds.size, 1);
      const ownerNode = m2.nodes.find(
        (node) => node.node_occurrence_id === [...ownerIds][0],
      );
      assert(ownerNode, [...ownerIds][0]);
      assert.deepEqual(payload.m2_owner_node, {
        agreement_index_id: m2.agreement_index_id,
        node_occurrence_id: ownerNode.node_occurrence_id,
        node_kind: ownerNode.node_kind,
        reference: ownerNode.reference,
        extent_span: ownerNode.extent_span,
      });
    }
  }

  assert.deepEqual(evidenceKindCounts, {
    CANONICAL_TEXT_M2_SECTION_CITATION: 87,
    PHASE2_ROW_LOCAL_TARGET_EVIDENCE: 18,
    RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE: 4,
  });
  assert.deepEqual(citationKindCounts, {
    EXACT_EXPLICIT_SECTION_CITATION: 85,
    EXACT_COORDINATED_SECTION_SHORTHAND: 2,
  });
  assert.deepEqual(rowLocalSubtypeCounts, {
    SHARED_CHAPEAU_EFFECTIVE_TIME_OWNER_EVIDENCE: 8,
    SOURCE_PROVED_LINKED_RULE_TARGET_EVIDENCE: 3,
    NATIVE_M3_DEFINED_TERM_OWNER_NON_EVENT_EVIDENCE: 4,
    NATIVE_M3_DEFINED_TERM_OWNER_EVENT_EVIDENCE: 3,
  });
  assert.equal(rawM3EdgeCount, 5);
  assert.equal(descriptorIds.size, 109);
  assert.equal(descriptorSlotKeys.size, 109);

  assertExactKeys(
    result.reference_target_evidence_accounting,
    TERMINATION_PHASE3_TARGET_EVIDENCE_ACCOUNTING_KEYS,
    'target evidence accounting keys',
  );
  assert.deepEqual(
    result.reference_target_evidence_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_TARGET_EVIDENCE_ACCOUNTING_KEYS.map((key) => [
        key,
        targetAuthority.candidate_output_contract
          .reference_target_evidence_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.reference_target_evidence_contract,
    targetAuthority.candidate_output_contract
      .reference_target_evidence_contract,
  );

  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 38);
  assert.deepEqual(
    remainingSlots,
    targetAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    targetAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(targetAuthority.remaining_unresolved_reference_slots),
    'candidate/authority remaining slot alias',
  );
  remainingSlots.forEach((slot) => assertExactKeys(
    slot,
    [
      ...targetAuthority.remaining_unresolved_reference_slot_contract
        .exact_member_keys,
    ].sort(),
    `${slot.reference_slot_key} remaining slot keys`,
  ));
  let precedingRemainingSlotIndex = -1;
  remainingSlots.forEach((slot) => {
    const predecessorSlot = predecessorSlotByKey.get(slot.reference_slot_key);
    assert(predecessorSlot, slot.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingRemainingSlotIndex, true);
    precedingRemainingSlotIndex = predecessorSlot.index;
    assert.deepEqual(slot, predecessorSlot.slot);
  });
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(
    remainingBytes.byteLength,
    targetAuthority.remaining_unresolved_reference_slot_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(remainingBytes),
    targetAuthority.remaining_unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    targetAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  descriptorSlotKeys.forEach(
    (key) => assert.equal(remainingSlotKeys.has(key), false, key),
  );
  assert.equal(descriptorSlotKeys.size + remainingSlotKeys.size, 147);
  predecessor.unresolved_reference_slots.forEach((slot) => assert.equal(
    descriptorSlotKeys.has(slot.reference_slot_key)
      || remainingSlotKeys.has(slot.reference_slot_key),
    true,
    slot.reference_slot_key,
  ));

  assert.deepEqual(
    result.withheld_work3_identity_fields,
    TERMINATION_PHASE3_WITHHELD_WORK3_IDENTITIES,
  );
  assert.deepEqual(
    result.unresolved_items,
    targetAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    targetAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  targetAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  targetAuthority.forbidden_output_contract
    .forbidden_reference_value_keys_anywhere.forEach(
      (key) => assert.equal(outputKeys.has(key), false, key),
    );
  const outputStrings = collectStrings(result);
  targetAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(
        outputStrings.includes(schemaVersion),
        false,
      ),
    );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);

  const repeated = profileAuthoring
    .prepareTerminationReferenceTargetEvidenceCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated target evidence result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture = terminationPhase3TargetEvidenceFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationReferenceTargetEvidenceCandidate(frozenFixture);
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(null)
    ));
    const extra = forkTerminationPhase3TargetEvidenceFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing = forkTerminationPhase3TargetEvidenceFixture(fixture);
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
          missing,
        )
      ));
    }
  });

  await t.test('rejects target evidence authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT';

    const absent = forkTerminationPhase3TargetEvidenceFixture(fixture);
    absent.terminationPhase3TargetEvidenceAuthority = null;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(absent)
    ));

    const envelopeExtra = forkTerminationPhase3TargetEvidenceFixture(fixture);
    envelopeExtra.terminationPhase3TargetEvidenceAuthority.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        envelopeExtra,
      )
    ));

    const bindingDrift = forkTerminationPhase3TargetEvidenceFixture(fixture);
    bindingDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        bindingDrift,
      )
    ));

    const recordDrift = forkTerminationPhase3TargetEvidenceFixture(fixture);
    recordDrift.terminationPhase3TargetEvidenceAuthority.record = {
      ...structuredClone(targetAuthority),
      authority_state: 'DRIFTED',
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        recordDrift,
      )
    ));

    const restampedExtra = forkTerminationPhase3TargetEvidenceFixture(fixture);
    restampedExtra.terminationPhase3TargetEvidenceAuthority.record = {
      ...structuredClone(targetAuthority),
      extra_authority_member: true,
    };
    restampTerminationPhase3TargetEvidenceAuthority(
      restampedExtra.terminationPhase3TargetEvidenceAuthority,
    );
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        restampedExtra,
      )
    ));

    const combined = forkTerminationPhase3TargetEvidenceFixture(fixture);
    combined.terminationPhase3TargetEvidenceAuthority.binding.record_id =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(combined)
    ));
  });

  await t.test('rejects predecessor authority drift before Phase2 and sources', () => {
    const code = 'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT';

    const bindingDrift = forkTerminationPhase3TargetEvidenceFixture(fixture);
    bindingDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        bindingDrift,
      )
    ));

    const restampedExtra = forkTerminationPhase3TargetEvidenceFixture(fixture);
    restampedExtra.terminationPhase3ReviewAuthority.record = {
      ...structuredClone(reviewEnvelope.record),
      extra_authority_member: true,
    };
    restampTerminationPhase3ReferenceReviewAuthority(
      restampedExtra.terminationPhase3ReviewAuthority,
    );
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        restampedExtra,
      )
    ));

    const combined = forkTerminationPhase3TargetEvidenceFixture(fixture);
    combined.terminationPhase3ReviewAuthority.binding.record_id = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(combined)
    ));
  });

  await t.test('rejects Phase2 authority drift before governed sources', () => {
    const code = 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT';

    const predecessor = forkTerminationPhase3TargetEvidenceFixture(fixture);
    predecessor.terminationAuthoringPhase2Authority = sourceEnvelope(
      phase2Authority.immutable_predecessor_binding,
    );
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        predecessor,
      )
    ));

    const bindingDrift = forkTerminationPhase3TargetEvidenceFixture(fixture);
    bindingDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        bindingDrift,
      )
    ));

    const restampedExtra = forkTerminationPhase3TargetEvidenceFixture(fixture);
    restampedExtra.terminationAuthoringPhase2Authority.record = {
      ...structuredClone(phase2Authority),
      extra_authority_member: true,
    };
    restampTerminationPhase2Authority(
      restampedExtra.terminationAuthoringPhase2Authority,
    );
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        restampedExtra,
      )
    ));

    const combined = forkTerminationPhase3TargetEvidenceFixture(fixture);
    combined.terminationAuthoringPhase2Authority.binding.record_id =
      '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(combined)
    ));
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_SOURCE_COVERAGE';

    const extraGoverned = forkTerminationPhase3TargetEvidenceFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        extraGoverned,
      )
    ));

    const missingGoverned = forkTerminationPhase3TargetEvidenceFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        missingGoverned,
      )
    ));

    const sourceBindingExtra = forkTerminationPhase3TargetEvidenceFixture(fixture);
    forkTerminationSourceEnvelope(
      sourceBindingExtra.governedSources,
      'baseContractPolicy',
    ).binding.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        sourceBindingExtra,
      )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase3TargetEvidenceFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(drift)
      ));
    }

    const agreementIds = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const [agreementId] = agreementIds;
    const missingAgreement = forkTerminationPhase3TargetEvidenceFixture(fixture);
    delete missingAgreement.governedSources
      .agreementEvidenceByAgreementId[agreementId];
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        missingAgreement,
      )
    ));

    const extraAgreement = forkTerminationPhase3TargetEvidenceFixture(fixture);
    extraAgreement.governedSources.agreementEvidenceByAgreementId[
      '0'.repeat(64)
    ] = fixture.governedSources.agreementEvidenceByAgreementId[agreementId];
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        extraAgreement,
      )
    ));

    const canonicalTextDrift = forkTerminationPhase3TargetEvidenceFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(
        canonicalTextDrift,
      )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase3TargetEvidenceFixture(fixture);
      const agreementEvidence = forkTerminationAgreementEvidence(
        drift,
        agreementId,
      );
      forkTerminationSourceEnvelope(agreementEvidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceTargetEvidenceCandidate(drift)
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 reference target evidence preserves exact Termination source targets without Work3 materialisation',
  );
});

test('Phase3 reference source normaliser records exact Termination source evidence without target strings', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate,
    'function',
  );

  const fixture = terminationPhase3SourceNormaliserFixture();
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const sourceAuthority = sourceEnvelope.record;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(sourceAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(sourceAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_reference_source_normaliser_authority_id;
  assert.equal(
    sourceAuthority
      .termination_authoring_phase3_reference_source_normaliser_authority_id,
    contentId(sourceAuthority.schema_version, unsignedAuthority),
  );

  const predecessor = profileAuthoring
    .prepareTerminationReferenceTargetEvidenceCandidate({
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  assert.deepEqual({
    schema_version: predecessor.schema_version,
    target_evidence_candidate_id: predecessor.target_evidence_candidate_id,
    reference_target_evidence_count:
      predecessor.reference_target_evidence_accounting
        .reference_target_evidence_count,
    remaining_unresolved_reference_slot_count:
      predecessor.reference_target_evidence_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  }, sourceAuthority.predecessor_target_evidence_candidate_binding);

  const result = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate(fixture);

  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'source normaliser result/caller input alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_SOURCE_NORMALISER_CANDIDATE_KEYS,
    'Phase3 source normaliser candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_SOURCE_NORMALISER_EVIDENCE_WORK3_TARGET_STRINGS_WITHHELD',
  });
  assert.equal(
    result.source_normaliser_candidate_id,
    contentId(
      result.schema_version,
      sourceNormaliserCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    predecessor.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase2_proposal_binding,
    sourceAuthority.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assert.deepEqual(
    result.predecessor_target_evidence_candidate_binding,
    sourceAuthority.predecessor_target_evidence_candidate_binding,
  );
  assert.deepEqual(
    result.phase3_source_normaliser_authority_binding,
    sourceEnvelope.binding,
  );
  for (const [label, binding] of [
    ['Phase2 authority', result.phase2_authority_binding],
    ['Phase3 review authority', result.phase3_reference_review_authority_binding],
    ['Phase3 target authority', result.phase3_target_evidence_authority_binding],
    ['Phase3 source normaliser authority',
      result.phase3_source_normaliser_authority_binding],
  ]) {
    assertExactKeys(
      binding,
      sourceAuthority.candidate_output_contract.authority_binding_exact_keys,
      `${label} binding keys`,
    );
  }
  assertExactKeys(
    result.phase2_proposal_binding,
    sourceAuthority.candidate_output_contract
      .phase2_proposal_binding_exact_keys,
    'source normaliser Phase2 proposal binding keys',
  );
  assertExactKeys(
    result.predecessor_target_evidence_candidate_binding,
    sourceAuthority.candidate_output_contract
      .predecessor_target_evidence_candidate_binding_exact_keys,
    'source normaliser predecessor candidate binding keys',
  );

  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map((slot, index) => [
      slot.reference_slot_key,
      { slot, index },
    ]),
  );
  const evidenceByAgreementId = fixture.governedSources
    .agreementEvidenceByAgreementId;
  const descriptorSlotKeys = new Set();
  const descriptorIds = new Set();
  const normaliserKindCounts = {
    EXACT_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_EVIDENCE: 0,
    EXACT_M3_SECTION_CITATION_REFERENCE_EVIDENCE: 0,
    EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE: 0,
    RAW_M2_DEFINITION_OR_EVENT_BOUNDARY_REFERENCE_EVIDENCE: 0,
  };
  const proofSubclassCounts = {
    EVENT_BOUNDARY_DEFINED_PERIOD_SOURCE_REPAIR: 0,
    EXACT_EVENT_OR_REFERENCE_SOURCE_OCCURRENCE: 0,
    EXACT_SINGULAR_SOURCE_TERM_OCCURRENCE_WITH_PLURAL_ALIAS_WITHHELD: 0,
    EXACT_SYMBOLIC_AGREEMENT_DATE_SOURCE_PAIR: 0,
    RAW_QUOTED_DEFINED_TERM_OWNER_REPAIR: 0,
    RESOLVED_EXACT_SECTION_CITATION_TARGET: 0,
    SOURCE_PROVED_COMMON_WRITTEN_NOTICE_DELIVERY_OCCURRENCE: 0,
  };
  const m2NodeProjection = (m2, projection) => {
    const node = m2.nodes.find(
      (candidate) => candidate.node_occurrence_id
        === projection.node_occurrence_id,
    );
    assert(node, projection.node_occurrence_id);
    assert.deepEqual(projection, {
      agreement_index_id: m2.agreement_index_id,
      extent_span: node.extent_span,
      node_kind: node.node_kind,
      node_occurrence_id: node.node_occurrence_id,
      reference: node.reference,
    });
    return node;
  };
  const assertBoundOccurrence = (m2, occurrence, terminal, closureRequired) => {
    const node = m2NodeProjection(m2, occurrence.m2_node);
    assert.equal(
      node.extent_span.start_byte <= occurrence.occurrence_span.start_byte,
      true,
    );
    assert.equal(
      occurrence.occurrence_span.end_byte <= node.extent_span.end_byte,
      true,
    );
    const text = utf8Slice(
      m2.source_binding.canonical_text,
      occurrence.occurrence_span.start_byte,
      occurrence.occurrence_span.end_byte,
    );
    assert.equal(text, occurrence.occurrence_text);
    assert.equal(
      sha256Hex(Buffer.from(text, 'utf8')),
      occurrence.occurrence_span.text_sha256,
    );
    if (closureRequired) {
      assert.equal(
        terminal.source_closure.members.some((member) => (
          member.node_occurrence_id === node.node_occurrence_id
          && member.closure_role === occurrence.source_closure_role
          && member.source_span.coordinate_system
            === occurrence.occurrence_span.coordinate_system
          && member.source_span.start_byte
            <= occurrence.occurrence_span.start_byte
          && occurrence.occurrence_span.end_byte <= member.source_span.end_byte
        )),
        true,
      );
    }
    return node;
  };
  const phase2Dependencies = (terminal) => [
    ...terminal.dependency_contracts.defined_term_dependencies,
    ...terminal.dependency_contracts.reference_dependencies,
  ];
  let precedingDescriptorSlotIndex = -1;

  const descriptors = result.source_normaliser_descriptors;
  assert.equal(descriptors.length, 37);
  assert.deepEqual(descriptors, sourceAuthority.source_normaliser_descriptors);
  assert.notStrictEqual(
    descriptors,
    sourceAuthority.source_normaliser_descriptors,
  );
  assertDisjoint(
    collectObjectIdentities(descriptors),
    collectObjectIdentities(sourceAuthority.source_normaliser_descriptors),
    'candidate/authority source normaliser descriptor alias',
  );
  const descriptorBytes = Buffer.from(canonicalJson(descriptors), 'utf8');
  assert.equal(
    descriptorBytes.byteLength,
    sourceAuthority.source_normaliser_descriptor_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(descriptorBytes),
    sourceAuthority.source_normaliser_descriptor_contract.sha256,
  );

  for (const descriptor of descriptors) {
    assertExactKeys(
      descriptor,
      TERMINATION_PHASE3_SOURCE_NORMALISER_DESCRIPTOR_KEYS,
      `${descriptor.reference_slot_key} source normaliser descriptor keys`,
    );
    const unsignedDescriptor = structuredClone(descriptor);
    delete unsignedDescriptor.source_normaliser_descriptor_id;
    assert.equal(
      descriptor.source_normaliser_descriptor_id,
      contentId(
        sourceAuthority.source_normaliser_descriptor_contract.identity_domain,
        unsignedDescriptor,
      ),
    );
    assert.equal(descriptorIds.has(descriptor.source_normaliser_descriptor_id), false);
    descriptorIds.add(descriptor.source_normaliser_descriptor_id);
    assert.equal(descriptorSlotKeys.has(descriptor.reference_slot_key), false);
    descriptorSlotKeys.add(descriptor.reference_slot_key);
    assert.equal(
      descriptor.materialisation_state,
      'EXACT_SOURCE_REFERENCE_EVIDENCE_PROVED_WORK3_TARGET_STRING_WITHHELD',
    );
    assert.equal(descriptor.work3_fixture_consumable_value_shape, false);
    normaliserKindCounts[descriptor.normaliser_kind] += 1;

    const predecessorSlot = predecessorSlotByKey.get(
      descriptor.reference_slot_key,
    );
    assert(predecessorSlot, descriptor.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingDescriptorSlotIndex, true);
    precedingDescriptorSlotIndex = predecessorSlot.index;
    assert.deepEqual({
      profile_key: descriptor.profile_key,
      source_unit_key: descriptor.source_unit_key,
      field_key: descriptor.field_key,
    }, {
      profile_key: predecessorSlot.slot.profile_key,
      source_unit_key: predecessorSlot.slot.source_unit_key,
      field_key: predecessorSlot.slot.field_key,
    });

    const terminal = jsonPointerValue(
      phase2Authority,
      descriptor.phase2_terminal_contract_path,
    );
    assert.equal(terminal.source_unit_key, descriptor.source_unit_key);
    assert.equal(terminal.agreement_id, descriptor.agreement_id);
    const evidence = evidenceByAgreementId[descriptor.agreement_id];
    assert(evidence, descriptor.agreement_id);
    const m2 = evidence.m2.record;
    const m3 = evidence.m3.record;
    const payload = descriptor.normaliser_payload;

    if (descriptor.normaliser_kind
      === 'EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE') {
      proofSubclassCounts[payload.occurrence_subclass] += 1;
      const dependencies = phase2Dependencies(terminal);
      if (payload.occurrence_subclass
        === 'SOURCE_PROVED_COMMON_WRITTEN_NOTICE_DELIVERY_OCCURRENCE') {
        assertBoundOccurrence(
          m2,
          payload.exact_bound_m2_occurrence,
          terminal,
          false,
        );
        assert.equal(
          terminal.linked_rule_bindings.some((binding) => (
            canonicalJson(binding)
              === canonicalJson(payload.exact_phase2_linked_rule_binding)
          )),
          true,
        );
        assert.equal(
          payload.exact_phase2_linked_rule_binding.target_node_occurrence_id,
          payload.exact_bound_m2_occurrence.m2_node.node_occurrence_id,
        );
        assert.deepEqual(
          payload.unresolved_same_field_phase2_dependencies,
          dependencies.filter((row) => (
            row.field_key === descriptor.field_key
            && row.resolution_state.includes('UNRESOLVED')
          )),
        );
      } else {
        assertBoundOccurrence(
          m2,
          payload.exact_terminal_source_occurrence,
          terminal,
          true,
        );
        assert.deepEqual(
          payload.exact_same_field_phase2_dependencies,
          dependencies.filter((row) => row.field_key === descriptor.field_key),
        );
        for (const candidate of payload.rejected_differently_named_owner_candidates) {
          const dependency = dependencies.find((row) => (
            row.field_key === candidate.field_key
            && row.native_m3_definition_edge_id
              === candidate.native_m3_definition_edge_id
            && row.owner_node_occurrence_id
              === candidate.owner_node_occurrence_id
          ));
          assert(dependency, candidate.field_key);
          assert.deepEqual(candidate, dependency);
          const edge = m3.definition_edges.find((row) => (
            row.definition_edge_id === candidate.native_m3_definition_edge_id
          ));
          assert(edge, candidate.native_m3_definition_edge_id);
          assert.equal(edge.term, candidate.source_text);
          assert.equal(
            edge.target_owner_node_occurrence_ids.includes(
              candidate.owner_node_occurrence_id,
            ),
            true,
          );
        }
      }
    } else if (descriptor.normaliser_kind
      === 'RAW_M2_DEFINITION_OR_EVENT_BOUNDARY_REFERENCE_EVIDENCE') {
      proofSubclassCounts[payload.repair_subclass] += 1;
      assertBoundOccurrence(
        m2,
        payload.terminal_source_occurrence,
        terminal,
        true,
      );
      const definitionNode = m2NodeProjection(
        m2,
        payload.exact_raw_definition_occurrence.m2_node,
      );
      const definitionSpan = payload.exact_raw_definition_occurrence
        .definition_span;
      assert.equal(definitionNode.extent_span.start_byte <= definitionSpan.start_byte, true);
      assert.equal(definitionSpan.end_byte <= definitionNode.extent_span.end_byte, true);
      const definitionText = utf8Slice(
        m2.source_binding.canonical_text,
        definitionSpan.start_byte,
        definitionSpan.end_byte,
      );
      assert.equal(
        definitionText,
        payload.exact_raw_definition_occurrence.definition_text,
      );
      assert.equal(
        sha256Hex(Buffer.from(definitionText, 'utf8')),
        definitionSpan.text_sha256,
      );
      const canonicalTextBytes = Buffer.from(
        m2.source_binding.canonical_text,
        'utf8',
      );
      const definitionTextBytes = Buffer.from(definitionText, 'utf8');
      assert.equal(
        canonicalTextBytes.indexOf(definitionTextBytes),
        definitionSpan.start_byte,
      );
      assert.equal(
        canonicalTextBytes.indexOf(definitionTextBytes, definitionSpan.end_byte),
        -1,
      );
      assert.equal(definitionText.includes(payload.exact_term), true);
      assert.deepEqual(
        payload.phase2_defined_term_or_reference_dependencies,
        phase2Dependencies(terminal).filter(
          (row) => row.field_key === descriptor.field_key,
        ),
      );
      const resolvedSameTermEdges = m3.definition_edges.filter((edge) => (
        edge.term === payload.exact_term
        && edge.state === 'RESOLVED'
        && edge.reason_code === 'UNIQUE_EXACT_DEFINITION_TARGET'
        && edge.rule_id === 'EXACT_M2_DEFINED_TERM_USE/V1'
      ));
      assert.equal(
        resolvedSameTermEdges.length,
        payload.agreement_local_resolved_exact_term_m3_definition_edge_count,
      );
      assert.equal(resolvedSameTermEdges.length, 0);
    } else if (descriptor.normaliser_kind
      === 'EXACT_M3_SECTION_CITATION_REFERENCE_EVIDENCE') {
      proofSubclassCounts.RESOLVED_EXACT_SECTION_CITATION_TARGET += 1;
      const edge = m3.reference_edges.find((row) => (
        row.reference_edge_id
          === payload.exact_closure_local_m3_reference_edge.reference_edge_id
      ));
      assert.deepEqual(edge, payload.exact_closure_local_m3_reference_edge);
      assert.equal(edge.state, 'RESOLVED');
      assert.equal(edge.reason_code, 'UNIQUE_EXACT_REFERENCE_TARGET');
      assert.equal(edge.rule_id, 'EXACT_M2_SECTION_REFERENCE/V1');
      assert.equal(edge.target_node_occurrence_ids.length, 1);
      assert.equal(
        terminal.source_closure.members.some((member) => (
          member.source_span.coordinate_system === edge.source_span.coordinate_system
          && member.source_span.start_byte <= edge.source_span.start_byte
          && edge.source_span.end_byte <= member.source_span.end_byte
        )),
        true,
      );
      const edgeText = utf8Slice(
        m2.source_binding.canonical_text,
        edge.source_span.start_byte,
        edge.source_span.end_byte,
      );
      assert.equal(edgeText, edge.raw_text);
      assert.equal(
        sha256Hex(Buffer.from(edgeText, 'utf8')),
        edge.source_span.text_sha256,
      );
      const target = m2NodeProjection(
        m2,
        payload.exact_agreement_local_m2_target,
      );
      assert.equal(edge.selected_target_node_occurrence_id, target.node_occurrence_id);
      assert.deepEqual(edge.target_node_occurrence_ids, [target.node_occurrence_id]);
      assert.equal(edge.normalised_reference, target.reference);
    } else {
      assert.equal(
        descriptor.normaliser_kind,
        'EXACT_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_EVIDENCE',
      );
      proofSubclassCounts[payload.occurrence_subclass] += 1;
      assert.equal(descriptor.field_key, 'AGREEMENT_DATE_REFERENCE');
      assertBoundOccurrence(
        m2,
        payload.terminal_source_occurrence,
        terminal,
        true,
      );
      assertBoundOccurrence(
        m2,
        payload.canonical_preamble_date_occurrence,
        terminal,
        false,
      );
      const canonicalTextBytes = Buffer.from(
        m2.source_binding.canonical_text,
        'utf8',
      );
      const preambleDateBytes = Buffer.from(
        payload.canonical_preamble_date_occurrence.occurrence_text,
        'utf8',
      );
      assert.equal(
        canonicalTextBytes.indexOf(preambleDateBytes),
        payload.canonical_preamble_date_occurrence.occurrence_span.start_byte,
      );
      assert.equal(
        canonicalTextBytes.indexOf(
          preambleDateBytes,
          payload.canonical_preamble_date_occurrence.occurrence_span.end_byte,
        ),
        -1,
      );
      assert.equal(
        payload.normaliser_requirement,
        'TECHNICAL_SYMBOLIC_AGREEMENT_DATE_NORMALISER_REQUIRED_TARGET_STRING_WITHHELD',
      );
    }
  }

  assert.deepEqual(normaliserKindCounts, {
    EXACT_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_EVIDENCE: 1,
    EXACT_M3_SECTION_CITATION_REFERENCE_EVIDENCE: 6,
    EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE: 23,
    RAW_M2_DEFINITION_OR_EVENT_BOUNDARY_REFERENCE_EVIDENCE: 7,
  });
  assert.deepEqual(proofSubclassCounts, {
    EVENT_BOUNDARY_DEFINED_PERIOD_SOURCE_REPAIR: 2,
    EXACT_EVENT_OR_REFERENCE_SOURCE_OCCURRENCE: 11,
    EXACT_SINGULAR_SOURCE_TERM_OCCURRENCE_WITH_PLURAL_ALIAS_WITHHELD: 2,
    EXACT_SYMBOLIC_AGREEMENT_DATE_SOURCE_PAIR: 1,
    RAW_QUOTED_DEFINED_TERM_OWNER_REPAIR: 5,
    RESOLVED_EXACT_SECTION_CITATION_TARGET: 6,
    SOURCE_PROVED_COMMON_WRITTEN_NOTICE_DELIVERY_OCCURRENCE: 10,
  });
  assert.equal(descriptorIds.size, 37);
  assert.equal(descriptorSlotKeys.size, 37);
  assert.deepEqual(
    result.source_normaliser_descriptor_contract,
    sourceAuthority.candidate_output_contract
      .source_normaliser_descriptor_contract,
  );

  const gaps = result.source_admission_gaps;
  assert.equal(gaps.length, 1);
  assert.deepEqual(gaps, sourceAuthority.source_admission_gaps);
  assert.notStrictEqual(gaps, sourceAuthority.source_admission_gaps);
  assertDisjoint(
    collectObjectIdentities(gaps),
    collectObjectIdentities(sourceAuthority.source_admission_gaps),
    'candidate/authority source admission gap alias',
  );
  const gapBytes = Buffer.from(canonicalJson(gaps), 'utf8');
  assert.equal(
    gapBytes.byteLength,
    sourceAuthority.source_admission_gap_contract.canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(gapBytes),
    sourceAuthority.source_admission_gap_contract.sha256,
  );
  const [gap] = gaps;
  assertExactKeys(
    gap,
    TERMINATION_PHASE3_SOURCE_ADMISSION_GAP_KEYS,
    'source admission gap keys',
  );
  const unsignedGap = structuredClone(gap);
  delete unsignedGap.source_admission_gap_id;
  assert.equal(
    gap.source_admission_gap_id,
    contentId(
      sourceAuthority.source_admission_gap_contract.identity_domain,
      unsignedGap,
    ),
  );
  assert.equal(gap.external_source_name, 'Company Letter');
  assert.equal(gap.field_key, 'JURISDICTION_LIST_REFERENCE');
  assert.equal(gap.work3_fixture_consumable_value_shape, false);
  const gapPredecessorSlot = predecessorSlotByKey.get(gap.reference_slot_key);
  assert(gapPredecessorSlot, gap.reference_slot_key);
  assert.deepEqual({
    profile_key: gap.profile_key,
    source_unit_key: gap.source_unit_key,
    field_key: gap.field_key,
  }, {
    profile_key: gapPredecessorSlot.slot.profile_key,
    source_unit_key: gapPredecessorSlot.slot.source_unit_key,
    field_key: gapPredecessorSlot.slot.field_key,
  });
  assert.equal(descriptorSlotKeys.has(gap.reference_slot_key), false);
  const gapTerminal = jsonPointerValue(
    phase2Authority,
    gap.phase2_terminal_contract_path,
  );
  assert.equal(gapTerminal.source_unit_key, gap.source_unit_key);
  assert.equal(gapTerminal.agreement_id, gap.agreement_id);
  const gapEvidence = evidenceByAgreementId[gap.agreement_id];
  const gapM2 = gapEvidence.m2.record;
  const gapM3 = gapEvidence.m3.record;
  const gapPayload = gap.source_admission_payload;
  assertBoundOccurrence(
    gapM2,
    gapPayload.exact_external_source_citation_occurrence,
    gapTerminal,
    true,
  );
  assert.equal(
    gapPayload.exact_external_source_citation_occurrence.occurrence_text,
    'jurisdictions identified on Section 6.01(c) of the Company Letter',
  );
  const rejectedEdge = gapM3.reference_edges.find((edge) => (
    edge.reference_edge_id
      === gapPayload.rejected_main_agreement_reference_edge.reference_edge_id
  ));
  assert.deepEqual(
    rejectedEdge,
    gapPayload.rejected_main_agreement_reference_edge,
  );
  assert.equal(rejectedEdge.normalised_reference, '6.01(c)');
  const gapOccurrence = gapPayload.exact_external_source_citation_occurrence;
  assert.equal(
    gapOccurrence.occurrence_span.start_byte <= rejectedEdge.source_span.start_byte,
    true,
  );
  assert.equal(
    rejectedEdge.source_span.end_byte <= gapOccurrence.occurrence_span.end_byte,
    true,
  );
  const rejectedEdgeText = utf8Slice(
    gapM2.source_binding.canonical_text,
    rejectedEdge.source_span.start_byte,
    rejectedEdge.source_span.end_byte,
  );
  assert.equal(rejectedEdgeText, rejectedEdge.raw_text);
  assert.equal(
    sha256Hex(Buffer.from(rejectedEdgeText, 'utf8')),
    rejectedEdge.source_span.text_sha256,
  );
  const rejectedLocalTargetProjection = descriptors
    .filter((descriptor) => (
      descriptor.agreement_id === gap.agreement_id
      && descriptor.normaliser_kind
        === 'EXACT_M3_SECTION_CITATION_REFERENCE_EVIDENCE'
    ))
    .map((descriptor) => (
      descriptor.normaliser_payload.exact_agreement_local_m2_target
    ))
    .find((target) => (
      target.node_occurrence_id
        === rejectedEdge.selected_target_node_occurrence_id
    ));
  assert(
    rejectedLocalTargetProjection,
    rejectedEdge.selected_target_node_occurrence_id,
  );
  const rejectedLocalTarget = m2NodeProjection(
    gapM2,
    rejectedLocalTargetProjection,
  );
  assert.equal(rejectedLocalTarget.reference, '6.01(c)');
  assert.deepEqual(
    rejectedEdge.target_node_occurrence_ids,
    [rejectedLocalTarget.node_occurrence_id],
  );
  assert.equal(
    gapPayload.rejection_reason,
    'THE_PRINTED_REFERENCE_IS_TO_SECTION_6_01_C_OF_THE_EXTERNAL_COMPANY_LETTER_NOT_SECTION_6_01_C_OF_THE_MERGER_AGREEMENT',
  );
  assert.equal(
    gapPayload.source_admission_state,
    'NO_ADMITTED_COMPANY_LETTER_SOURCE_BINDING_FOR_THIS_SUCCESSOR',
  );
  assert.deepEqual(
    result.source_admission_gap_contract,
    sourceAuthority.candidate_output_contract.source_admission_gap_contract,
  );

  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 38);
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots,
  );
  assert.deepEqual(
    remainingSlots,
    sourceAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    sourceAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(predecessor.remaining_unresolved_reference_slots),
    'candidate/predecessor remaining slot alias',
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(sourceAuthority.remaining_unresolved_reference_slots),
    'candidate/authority remaining slot alias',
  );
  let precedingRemainingIndex = -1;
  remainingSlots.forEach((slot) => {
    assertExactKeys(
      slot,
      [
        ...sourceAuthority.remaining_unresolved_reference_slot_contract
          .exact_member_keys,
      ].sort(),
      `${slot.reference_slot_key} remaining slot keys`,
    );
    const predecessorSlot = predecessorSlotByKey.get(slot.reference_slot_key);
    assert(predecessorSlot, slot.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingRemainingIndex, true);
    precedingRemainingIndex = predecessorSlot.index;
    assert.deepEqual(slot, predecessorSlot.slot);
    assert.equal(
      slot.reference_slot_key,
      contentId(
        sourceAuthority.remaining_unresolved_reference_slot_contract
          .identity_domain,
        {
          profile_key: slot.profile_key,
          source_unit_key: slot.source_unit_key,
          field_key: slot.field_key,
        },
      ),
    );
  });
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(
    remainingBytes.byteLength,
    sourceAuthority.remaining_unresolved_reference_slot_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(remainingBytes),
    sourceAuthority.remaining_unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    sourceAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );
  const classifiedSlotKeys = new Set([
    ...descriptorSlotKeys,
    gap.reference_slot_key,
  ]);
  assert.equal(classifiedSlotKeys.size, 38);
  remainingSlots.forEach((slot) => assert.equal(
    classifiedSlotKeys.has(slot.reference_slot_key),
    true,
    slot.reference_slot_key,
  ));

  assertExactKeys(
    result.source_normaliser_accounting,
    TERMINATION_PHASE3_SOURCE_NORMALISER_ACCOUNTING_KEYS,
    'source normaliser accounting keys',
  );
  assert.deepEqual(
    result.source_normaliser_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_SOURCE_NORMALISER_ACCOUNTING_KEYS.map((key) => [
        key,
        sourceAuthority.candidate_output_contract
          .source_normaliser_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    sourceAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    sourceAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    sourceAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  sourceAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  sourceAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(
        outputStrings.includes(schemaVersion),
        false,
      ),
    );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);

  const repeated = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated source normaliser result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture = terminationPhase3SourceNormaliserFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate(frozenFixture);
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_CONTRACT';
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(null)
    ));
    const extra = forkTerminationPhase3SourceNormaliserFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing = forkTerminationPhase3SourceNormaliserFixture(fixture);
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
          missing,
        )
      ));
    }
  });

  await t.test('rejects source normaliser authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT';
    const absent = forkTerminationPhase3SourceNormaliserFixture(fixture);
    absent.terminationPhase3ReferenceSourceNormaliserAuthority = null;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(absent)
    ));

    const envelopeExtra = forkTerminationPhase3SourceNormaliserFixture(fixture);
    envelopeExtra.terminationPhase3ReferenceSourceNormaliserAuthority.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        envelopeExtra,
      )
    ));

    const bindingDrift = forkTerminationPhase3SourceNormaliserFixture(fixture);
    bindingDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        bindingDrift,
      )
    ));

    const recordDrift = forkTerminationPhase3SourceNormaliserFixture(fixture);
    recordDrift.terminationPhase3ReferenceSourceNormaliserAuthority.record = {
      ...structuredClone(sourceAuthority),
      authority_state: 'DRIFTED',
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        recordDrift,
      )
    ));

    const restampedExtra = forkTerminationPhase3SourceNormaliserFixture(fixture);
    restampedExtra.terminationPhase3ReferenceSourceNormaliserAuthority.record = {
      ...structuredClone(sourceAuthority),
      extra_authority_member: true,
    };
    restampTerminationPhase3SourceNormaliserAuthority(
      restampedExtra.terminationPhase3ReferenceSourceNormaliserAuthority,
    );
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        restampedExtra,
      )
    ));

    const combined = forkTerminationPhase3SourceNormaliserFixture(fixture);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.record_id = '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        combined,
      )
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', () => {
    const targetDrift = forkTerminationPhase3SourceNormaliserFixture(fixture);
    targetDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    targetDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    targetDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete targetDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceSourceNormaliserCandidate(targetDrift),
    );

    const reviewDrift = forkTerminationPhase3SourceNormaliserFixture(fixture);
    reviewDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    reviewDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete reviewDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceSourceNormaliserCandidate(reviewDrift),
    );

    const phase2Drift = forkTerminationPhase3SourceNormaliserFixture(fixture);
    phase2Drift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete phase2Drift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceSourceNormaliserCandidate(phase2Drift),
    );
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_SOURCE_COVERAGE';
    const extraGoverned = forkTerminationPhase3SourceNormaliserFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        extraGoverned,
      )
    ));

    const missingGoverned = forkTerminationPhase3SourceNormaliserFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        missingGoverned,
      )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase3SourceNormaliserFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
          drift,
        )
      ));
    }

    const [agreementId] = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const canonicalTextDrift = forkTerminationPhase3SourceNormaliserFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
        canonicalTextDrift,
      )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase3SourceNormaliserFixture(fixture);
      const agreementEvidence = forkTerminationAgreementEvidence(
        drift,
        agreementId,
      );
      forkTerminationSourceEnvelope(agreementEvidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceSourceNormaliserCandidate(
          drift,
        )
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 reference source normaliser records exact Termination source evidence without target strings',
  );
});

test('Phase3 reference edge values project six exact Termination section targets without Work3 identity creation', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationReferenceEdgeValueCandidate,
    'function',
  );

  const fixture = terminationPhase3ReferenceEdgeValueFixture();
  const edgeValueEnvelope = fixture.terminationPhase3ReferenceEdgeValueAuthority;
  const edgeValueAuthority = edgeValueEnvelope.record;
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(edgeValueAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(edgeValueAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_reference_edge_value_authority_id;
  assert.equal(
    edgeValueAuthority
      .termination_authoring_phase3_reference_edge_value_authority_id,
    contentId(edgeValueAuthority.schema_version, unsignedAuthority),
  );

  const predecessor = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate({
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  const predecessorBinding = {
    schema_version: predecessor.schema_version,
    source_normaliser_candidate_id: predecessor.source_normaliser_candidate_id,
    source_normaliser_descriptor_count:
      predecessor.source_normaliser_accounting.source_normaliser_descriptor_count,
    source_admission_gap_count:
      predecessor.source_normaliser_accounting.source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      predecessor.source_normaliser_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  };
  assert.deepEqual(
    predecessorBinding,
    edgeValueAuthority.predecessor_source_normaliser_candidate_binding,
  );
  assert.equal(
    predecessor.source_normaliser_candidate_id,
    contentId(
      predecessor.schema_version,
      sourceNormaliserCandidateUnsignedRecord(predecessor),
    ),
  );
  assert.equal(
    predecessor.source_normaliser_candidate_id,
    '853a4dd5fce6e86c71417716e06997f28a73b65e6242f3db94a55d3c5e9af311',
  );

  const result = profileAuthoring
    .prepareTerminationReferenceEdgeValueCandidate(fixture);
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'reference edge value result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(predecessor),
    'reference edge value result/predecessor candidate alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_CANDIDATE_KEYS,
    'Phase3 reference edge value candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_REFERENCE_EDGE_VALUES_WORK3_FACT_AND_ID_MATERIALISATION_WITHHELD',
  });
  assert.equal(
    result.reference_edge_value_candidate_id,
    contentId(
      result.schema_version,
      referenceEdgeValueCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(result.phase2_proposal_binding, predecessor.phase2_proposal_binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    edgeValueAuthority.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_source_normaliser_authority_binding,
    sourceEnvelope.binding,
  );
  assertExactKeys(
    result.predecessor_source_normaliser_candidate_binding,
    edgeValueAuthority.candidate_output_contract
      .predecessor_source_normaliser_candidate_binding_exact_keys,
    'predecessor source normaliser candidate binding keys',
  );
  assert.deepEqual(
    result.predecessor_source_normaliser_candidate_binding,
    predecessorBinding,
  );
  assert.deepEqual(
    result.phase3_reference_edge_value_authority_binding,
    edgeValueEnvelope.binding,
  );

  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map(
      (slot, index) => [slot.reference_slot_key, { slot, index }],
    ),
  );
  const predecessorDescriptorById = new Map(
    predecessor.source_normaliser_descriptors.map(
      (descriptor) => [descriptor.source_normaliser_descriptor_id, descriptor],
    ),
  );
  const reviewIds = new Set();
  const reviewSlotKeys = new Set();
  const sourceNormaliserDescriptorIds = new Set();
  const sourceSupportIds = new Set();
  const proposedTargets = new Set();
  let precedingReviewSlotIndex = -1;
  const values = result.reference_edge_values;
  assert.equal(values.length, 6);
  assert.deepEqual(values, edgeValueAuthority.reference_edge_values);
  assert.notStrictEqual(values, edgeValueAuthority.reference_edge_values);
  assertDisjoint(
    collectObjectIdentities(values),
    collectObjectIdentities(edgeValueAuthority.reference_edge_values),
    'candidate/authority reference edge value alias',
  );

  for (const value of values) {
    assertExactKeys(
      value,
      TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_KEYS,
      `${value.reference_slot_key} reference edge value keys`,
    );
    const unsignedValue = structuredClone(value);
    delete unsignedValue.reference_edge_target_string_review_id;
    assert.equal(
      value.reference_edge_target_string_review_id,
      contentId(
        edgeValueAuthority.reference_edge_value_contract.identity_domain,
        unsignedValue,
      ),
    );
    assert.equal(reviewIds.has(value.reference_edge_target_string_review_id), false);
    reviewIds.add(value.reference_edge_target_string_review_id);
    assert.equal(reviewSlotKeys.has(value.reference_slot_key), false);
    reviewSlotKeys.add(value.reference_slot_key);
    assert.equal(sourceSupportIds.has(value.source_support.source_support_id), false);
    sourceSupportIds.add(value.source_support.source_support_id);
    assert.equal(proposedTargets.has(value.proposed_reference_target_string), false);
    proposedTargets.add(value.proposed_reference_target_string);
    assert.match(value.proposed_reference_target_string, /^[0-9a-f]{64}$/u);
    assert.equal(value.value_type, 'REFERENCE');
    assert.equal(value.normalisation_rule_id, 'REFERENCE_EDGE/V1');
    assert.equal(
      value.materialisation_state,
      'REVIEW_ONLY_REFERENCE_EDGE_V1_TARGET_STRING_PROVED_WORK3_FACT_AND_ID_WITHHELD',
    );
    assert.equal(value.work3_fixture_consumable_value_shape, true);

    const predecessorSlot = predecessorSlotByKey.get(value.reference_slot_key);
    assert(predecessorSlot, value.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingReviewSlotIndex, true);
    precedingReviewSlotIndex = predecessorSlot.index;
    assert.deepEqual({
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
    }, {
      profile_key: predecessorSlot.slot.profile_key,
      source_unit_key: predecessorSlot.slot.source_unit_key,
      field_key: predecessorSlot.slot.field_key,
    });

    const descriptor = predecessorDescriptorById.get(
      value.source_normaliser_descriptor_id,
    );
    assert(descriptor, value.source_normaliser_descriptor_id);
    assert.equal(
      sourceNormaliserDescriptorIds.has(value.source_normaliser_descriptor_id),
      false,
    );
    sourceNormaliserDescriptorIds.add(value.source_normaliser_descriptor_id);
    assert.equal(
      descriptor.normaliser_kind,
      'EXACT_M3_SECTION_CITATION_REFERENCE_EVIDENCE',
    );
    assert.deepEqual({
      reference_slot_key: descriptor.reference_slot_key,
      profile_key: descriptor.profile_key,
      source_unit_key: descriptor.source_unit_key,
      field_key: descriptor.field_key,
      agreement_id: descriptor.agreement_id,
    }, {
      reference_slot_key: value.reference_slot_key,
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
      agreement_id: value.agreement_id,
    });
    assert.deepEqual(
      value.native_m3_reference_edge,
      descriptor.normaliser_payload.exact_closure_local_m3_reference_edge,
    );
    assert.deepEqual(
      value.exact_agreement_local_m2_target,
      descriptor.normaliser_payload.exact_agreement_local_m2_target,
    );

    const terminal = jsonPointerValue(
      phase2Authority,
      descriptor.phase2_terminal_contract_path,
    );
    assert.equal(terminal.source_unit_key, value.source_unit_key);
    assert.equal(terminal.agreement_id, value.agreement_id);
    const evidence = fixture.governedSources
      .agreementEvidenceByAgreementId[value.agreement_id];
    assert(evidence, value.agreement_id);
    const m2 = evidence.m2.record;
    const m3 = evidence.m3.record;
    const nativeEdges = m3.reference_edges.filter((edge) => (
      edge.reference_edge_id === value.native_m3_reference_edge.reference_edge_id
    ));
    assert.equal(nativeEdges.length, 1);
    const [nativeEdge] = nativeEdges;
    assert.deepEqual(nativeEdge, value.native_m3_reference_edge);
    assertExactKeys(
      nativeEdge,
      TERMINATION_PHASE3_NATIVE_REFERENCE_EDGE_KEYS,
      `${value.reference_slot_key} native M3 reference edge keys`,
    );
    assert.equal(nativeEdge.schema_version, 'CONTEXT_REFERENCE_EDGE/V1');
    assert.equal(nativeEdge.state, 'RESOLVED');
    assert.equal(nativeEdge.reason_code, 'UNIQUE_EXACT_REFERENCE_TARGET');
    assert.equal(nativeEdge.rule_id, 'EXACT_M2_SECTION_REFERENCE/V1');
    assert.deepEqual(
      nativeEdge.target_node_occurrence_ids,
      [nativeEdge.selected_target_node_occurrence_id],
    );

    const ownerNode = m2.nodes.find((node) => (
      node.node_occurrence_id === nativeEdge.owner_node_occurrence_id
    ));
    assert(ownerNode, nativeEdge.owner_node_occurrence_id);
    assert.equal(
      ownerNode.extent_span.start_byte <= nativeEdge.source_span.start_byte,
      true,
    );
    assert.equal(
      nativeEdge.source_span.end_byte <= ownerNode.extent_span.end_byte,
      true,
    );
    assert.equal(
      terminal.source_closure.members.some((member) => (
        member.node_occurrence_id === ownerNode.node_occurrence_id
        && member.source_span.coordinate_system
          === nativeEdge.source_span.coordinate_system
        && member.source_span.start_byte <= nativeEdge.source_span.start_byte
        && nativeEdge.source_span.end_byte <= member.source_span.end_byte
      )),
      true,
    );
    const sourceText = utf8Slice(
      m2.source_binding.canonical_text,
      nativeEdge.source_span.start_byte,
      nativeEdge.source_span.end_byte,
    );
    assert.equal(sourceText, nativeEdge.raw_text);
    assert.equal(
      sha256Hex(Buffer.from(sourceText, 'utf8')),
      nativeEdge.source_span.text_sha256,
    );
    assert.match(
      sourceText,
      /^(?:section|article|clause|schedule|exhibit|annex)\s+[\p{L}\p{N}().\-]+$/iu,
    );

    assertExactKeys(
      value.source_support,
      TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
      `${value.reference_slot_key} source support keys`,
    );
    assertExactKeys(
      value.source_support.source_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} source support span keys`,
    );
    assert.deepEqual(value.source_support, {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: nativeEdge.owner_node_occurrence_id,
      source_span: nativeEdge.source_span,
      source_support_id: value.source_support.source_support_id,
      source_text: sourceText,
    });
    assert.equal(
      value.source_support.source_support_id,
      contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: m2.agreement_index_id,
        source_node_occurrence_id: nativeEdge.owner_node_occurrence_id,
        start_byte: nativeEdge.source_span.start_byte,
        end_byte: nativeEdge.source_span.end_byte,
        text_sha256: nativeEdge.source_span.text_sha256,
      }),
    );

    const targetNodes = m2.nodes.filter((node) => (
      node.node_occurrence_id === nativeEdge.selected_target_node_occurrence_id
    ));
    assert.equal(targetNodes.length, 1);
    const [targetNode] = targetNodes;
    assert(targetNode, nativeEdge.selected_target_node_occurrence_id);
    assertExactKeys(
      value.exact_agreement_local_m2_target,
      TERMINATION_PHASE3_M2_TARGET_KEYS,
      `${value.reference_slot_key} exact M2 target keys`,
    );
    assert.deepEqual(value.exact_agreement_local_m2_target, {
      agreement_index_id: m2.agreement_index_id,
      extent_span: targetNode.extent_span,
      node_kind: targetNode.node_kind,
      node_occurrence_id: targetNode.node_occurrence_id,
      reference: targetNode.reference,
    });
    assert.equal(nativeEdge.normalised_reference, targetNode.reference);
    assert.equal(value.proposed_reference_target_string, targetNode.node_occurrence_id);

    assertExactKeys(
      value.projected_context_edge,
      TERMINATION_PHASE3_PROJECTED_CONTEXT_EDGE_KEYS,
      `${value.reference_slot_key} projected context edge keys`,
    );
    assert.deepEqual(value.projected_context_edge, {
      edge_id: nativeEdge.reference_edge_id,
      edge_type: 'REFERENCE_TARGET',
      source_support_ids: [value.source_support.source_support_id],
      state: 'RESOLVED',
      target_id: targetNode.node_occurrence_id,
    });
    assertExactKeys(
      value.normalisation_proof,
      TERMINATION_PHASE3_REFERENCE_NORMALISATION_PROOF_KEYS,
      `${value.reference_slot_key} normalisation proof keys`,
    );
    assert.deepEqual(value.normalisation_proof, {
      input_context_edge_ids: [nativeEdge.reference_edge_id],
      input_source_span_ids: [value.source_support.source_support_id],
      result_digest: sha256Hex(Buffer.from(
        canonicalJson(value.proposed_reference_target_string),
        'utf8',
      )),
      rule_id: 'REFERENCE_EDGE/V1',
    });
  }

  assert.equal(reviewIds.size, 6);
  assert.equal(reviewSlotKeys.size, 6);
  assert.equal(sourceNormaliserDescriptorIds.size, 6);
  assert.equal(sourceSupportIds.size, 6);
  assert.equal(proposedTargets.size, 6);
  assert.deepEqual(
    result.reference_edge_value_contract,
    edgeValueAuthority.candidate_output_contract.reference_edge_value_contract,
  );
  const valueBytes = Buffer.from(canonicalJson(values), 'utf8');
  assert.equal(
    valueBytes.byteLength,
    edgeValueAuthority.reference_edge_value_contract.canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(valueBytes),
    edgeValueAuthority.reference_edge_value_contract.sha256,
  );

  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 32);
  assert.deepEqual(
    remainingSlots,
    edgeValueAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    edgeValueAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(edgeValueAuthority.remaining_unresolved_reference_slots),
    'candidate/authority remaining reference slot alias',
  );
  let precedingRemainingSlotIndex = -1;
  for (const slot of remainingSlots) {
    assertExactKeys(
      slot,
      [...edgeValueAuthority.remaining_unresolved_reference_slot_contract
        .exact_member_keys].sort(),
      `${slot.reference_slot_key} remaining reference slot keys`,
    );
    const predecessorSlot = predecessorSlotByKey.get(slot.reference_slot_key);
    assert(predecessorSlot, slot.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingRemainingSlotIndex, true);
    precedingRemainingSlotIndex = predecessorSlot.index;
    assert.deepEqual(slot, predecessorSlot.slot);
    assert.equal(reviewSlotKeys.has(slot.reference_slot_key), false);
    assert.equal(
      slot.reference_slot_key,
      contentId(
        edgeValueAuthority.remaining_unresolved_reference_slot_contract
          .identity_domain,
        {
          profile_key: slot.profile_key,
          source_unit_key: slot.source_unit_key,
          field_key: slot.field_key,
        },
      ),
    );
  }
  assert.deepEqual(
    values.map((value) => value.reference_slot_key),
    predecessor.remaining_unresolved_reference_slots
      .filter((slot) => reviewSlotKeys.has(slot.reference_slot_key))
      .map((slot) => slot.reference_slot_key),
  );
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots.filter(
      (slot) => remainingSlotKeys.has(slot.reference_slot_key),
    ),
  );
  assert.equal(
    new Set([...reviewSlotKeys, ...remainingSlotKeys]).size,
    predecessor.remaining_unresolved_reference_slots.length,
  );
  predecessor.remaining_unresolved_reference_slots.forEach((slot) => {
    assert.equal(
      reviewSlotKeys.has(slot.reference_slot_key)
        || remainingSlotKeys.has(slot.reference_slot_key),
      true,
      slot.reference_slot_key,
    );
  });
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(
    remainingBytes.byteLength,
    edgeValueAuthority.remaining_unresolved_reference_slot_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(remainingBytes),
    edgeValueAuthority.remaining_unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    edgeValueAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );

  assertExactKeys(
    result.reference_edge_value_accounting,
    TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_ACCOUNTING_KEYS,
    'reference edge value accounting keys',
  );
  assert.deepEqual(
    result.reference_edge_value_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_ACCOUNTING_KEYS.map((key) => [
        key,
        edgeValueAuthority.candidate_output_contract
          .reference_edge_value_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    edgeValueAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    edgeValueAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    edgeValueAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  edgeValueAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  edgeValueAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
    );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);
  const proposedValueOwners = [];
  const collectProposedValueOwners = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Object.hasOwn(value, 'proposed_reference_target_string')) {
      proposedValueOwners.push(value);
    }
    Object.values(value).forEach((child) => (
      collectProposedValueOwners(child, seen)
    ));
  };
  collectProposedValueOwners(result);
  assert.deepEqual(proposedValueOwners, values);

  const repeated = profileAuthoring
    .prepareTerminationReferenceEdgeValueCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated reference edge value result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture = terminationPhase3ReferenceEdgeValueFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationReferenceEdgeValueCandidate(frozenFixture);
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code = 'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(null)
    ));
    const extra = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(missing)
      ));
    }
  });

  await t.test('rejects reference edge value authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT';
    const absent = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    absent.terminationPhase3ReferenceEdgeValueAuthority = null;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(absent)
    ));

    const envelopeExtra = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    envelopeExtra.terminationPhase3ReferenceEdgeValueAuthority.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(envelopeExtra)
    ));

    const bindingDrift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    bindingDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(bindingDrift)
    ));

    const recordDrift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    recordDrift.terminationPhase3ReferenceEdgeValueAuthority.record = {
      ...structuredClone(edgeValueAuthority),
      authority_state: 'DRIFTED',
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(recordDrift)
    ));

    const restampedScheduleDrift =
      forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    restampedScheduleDrift.terminationPhase3ReferenceEdgeValueAuthority.record =
      structuredClone(edgeValueAuthority);
    restampedScheduleDrift.terminationPhase3ReferenceEdgeValueAuthority
      .record.reference_edge_values[0].proposed_reference_target_string =
        '0'.repeat(64);
    restampTerminationPhase3ReferenceEdgeValueAuthority(
      restampedScheduleDrift.terminationPhase3ReferenceEdgeValueAuthority,
    );
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(
        restampedScheduleDrift,
      )
    ));

    const combined = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    combined.terminationPhase3ReferenceEdgeValueAuthority.binding.record_id =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 = '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(combined)
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', () => {
    const sourceDrift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    sourceDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    sourceDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete sourceDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceEdgeValueCandidate(sourceDrift),
    );

    const targetDrift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    targetDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    targetDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    targetDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete targetDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceEdgeValueCandidate(targetDrift),
    );

    const reviewDrift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    reviewDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    reviewDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete reviewDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceEdgeValueCandidate(reviewDrift),
    );

    const phase2Drift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    phase2Drift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete phase2Drift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationReferenceEdgeValueCandidate(phase2Drift),
    );
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_SOURCE_COVERAGE';
    const extraGoverned = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(extraGoverned)
    ));

    const missingGoverned = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(missingGoverned)
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(drift)
      ));
    }

    const [agreementId] = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const canonicalTextDrift =
      forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(
        canonicalTextDrift,
      )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase3ReferenceEdgeValueFixture(fixture);
      const agreementEvidence = forkTerminationAgreementEvidence(
        drift,
        agreementId,
      );
      forkTerminationSourceEnvelope(agreementEvidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationReferenceEdgeValueCandidate(drift)
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 reference edge values project six exact Termination section targets without Work3 identity creation',
  );
});

test('Phase3 linked-rule reference values preserve ten exact Termination notice targets without Work3 materialisation', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate,
    'function',
  );

  const fixture = terminationPhase3LinkedRuleReferenceValueFixture();
  const linkedEnvelope =
    fixture.terminationPhase3LinkedRuleReferenceValueAuthority;
  const linkedAuthority = linkedEnvelope.record;
  const edgeEnvelope = fixture.terminationPhase3ReferenceEdgeValueAuthority;
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(linkedAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(linkedAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_linked_rule_reference_value_authority_id;
  assert.equal(
    linkedAuthority
      .termination_authoring_phase3_linked_rule_reference_value_authority_id,
    contentId(linkedAuthority.schema_version, unsignedAuthority),
  );

  const predecessor = profileAuthoring
    .prepareTerminationReferenceEdgeValueCandidate({
      terminationPhase3ReferenceEdgeValueAuthority: edgeEnvelope,
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  assert.equal(
    predecessor.reference_edge_value_candidate_id,
    contentId(
      predecessor.schema_version,
      referenceEdgeValueCandidateUnsignedRecord(predecessor),
    ),
  );
  assert.equal(
    predecessor.reference_edge_value_candidate_id,
    'fbc74d7f30cd192119b7a861cffae6966e5b218130460f1127bcca0e32db7e47',
  );
  const predecessorBinding = {
    schema_version: predecessor.schema_version,
    reference_edge_value_candidate_id:
      predecessor.reference_edge_value_candidate_id,
    reference_edge_value_count:
      predecessor.reference_edge_value_accounting.reference_edge_value_count,
    remaining_source_normaliser_descriptor_count:
      predecessor.reference_edge_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_source_admission_gap_count:
      predecessor.reference_edge_value_accounting
        .remaining_source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      predecessor.reference_edge_value_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  };
  assertExactKeys(
    predecessorBinding,
    linkedAuthority.candidate_output_contract
      .predecessor_reference_edge_value_candidate_binding_exact_keys,
    'predecessor reference edge value candidate binding keys',
  );
  assert.deepEqual(
    predecessorBinding,
    linkedAuthority.predecessor_reference_edge_value_candidate_binding,
  );

  const result = profileAuthoring
    .prepareTerminationLinkedRuleReferenceValueCandidate(fixture);
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'linked-rule reference value result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(predecessor),
    'linked-rule reference value result/predecessor alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_CANDIDATE_KEYS,
    'Phase3 linked-rule reference value candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_SOURCE_PROVED_LINKED_RULE_TARGET_STRINGS_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
  });
  assert.equal(
    result.linked_rule_reference_value_candidate_id,
    contentId(
      result.schema_version,
      linkedRuleReferenceValueCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(result.phase2_proposal_binding, predecessor.phase2_proposal_binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    linkedAuthority.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_source_normaliser_authority_binding,
    sourceEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_reference_edge_value_authority_binding,
    edgeEnvelope.binding,
  );
  assert.deepEqual(
    result.predecessor_reference_edge_value_candidate_binding,
    predecessorBinding,
  );
  assert.deepEqual(
    result.phase3_linked_rule_reference_value_authority_binding,
    linkedEnvelope.binding,
  );
  for (const [label, binding] of [
    ['Phase2', result.phase2_authority_binding],
    ['Phase3 review', result.phase3_reference_review_authority_binding],
    ['Phase3 target evidence', result.phase3_target_evidence_authority_binding],
    ['Phase3 source normaliser', result.phase3_source_normaliser_authority_binding],
    ['Phase3 reference edge value', result.phase3_reference_edge_value_authority_binding],
    ['Phase3 linked-rule reference value',
      result.phase3_linked_rule_reference_value_authority_binding],
  ]) {
    assertExactKeys(
      binding,
      linkedAuthority.candidate_output_contract.authority_binding_exact_keys,
      `${label} authority binding keys`,
    );
  }
  assertExactKeys(
    result.phase2_proposal_binding,
    linkedAuthority.candidate_output_contract
      .phase2_proposal_binding_exact_keys,
    'linked-rule Phase2 proposal binding keys',
  );

  const sourceCandidate = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate({
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map(
      (slot, index) => [slot.reference_slot_key, { slot, index }],
    ),
  );
  const sourceDescriptorById = new Map(
    sourceCandidate.source_normaliser_descriptors.map(
      (descriptor) => [descriptor.source_normaliser_descriptor_id, descriptor],
    ),
  );
  const edgeDescriptorIds = new Set(
    predecessor.reference_edge_values.map(
      (value) => value.source_normaliser_descriptor_id,
    ),
  );
  const reviewIds = new Set();
  const reviewSlotKeys = new Set();
  const descriptorIds = new Set();
  const supportIds = new Set();
  const proposedTargets = new Set();
  const withheldOwnerChoices = new Set();
  let nonemptyDependencyRowCount = 0;
  let precedingReviewSlotIndex = -1;
  const values = result.linked_rule_reference_values;
  assert.equal(values.length, 10);
  assert.deepEqual(values, linkedAuthority.linked_rule_reference_values);
  assert.notStrictEqual(values, linkedAuthority.linked_rule_reference_values);
  assertDisjoint(
    collectObjectIdentities(values),
    collectObjectIdentities(linkedAuthority.linked_rule_reference_values),
    'candidate/authority linked-rule value alias',
  );

  for (const value of values) {
    assertExactKeys(
      value,
      TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_KEYS,
      `${value.reference_slot_key} linked-rule value keys`,
    );
    const unsignedValue = structuredClone(value);
    delete unsignedValue.linked_rule_reference_target_string_review_id;
    assert.equal(
      value.linked_rule_reference_target_string_review_id,
      contentId(
        linkedAuthority.linked_rule_reference_value_contract.identity_domain,
        unsignedValue,
      ),
    );
    assert.equal(
      reviewIds.has(value.linked_rule_reference_target_string_review_id),
      false,
    );
    reviewIds.add(value.linked_rule_reference_target_string_review_id);
    assert.equal(reviewSlotKeys.has(value.reference_slot_key), false);
    reviewSlotKeys.add(value.reference_slot_key);
    assert.equal(descriptorIds.has(value.source_normaliser_descriptor_id), false);
    descriptorIds.add(value.source_normaliser_descriptor_id);
    supportIds.add(value.source_support.source_support_id);
    proposedTargets.add(value.proposed_reference_target_string);
    withheldOwnerChoices.add(value.withheld_owner_choice);
    if (value.unresolved_same_field_phase2_dependencies.length > 0) {
      nonemptyDependencyRowCount += 1;
    }
    assert.equal(value.value_type, 'REFERENCE');
    assert.equal(
      value.normalisation_rule_id,
      'SOURCE_PROVED_LINKED_RULE_REFERENCE/V1',
    );
    assert.equal(
      value.materialisation_state,
      'REVIEW_ONLY_SOURCE_PROVED_LINKED_RULE_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
    );
    assert.equal(value.work3_fixture_consumable_value_shape, false);

    const predecessorSlot = predecessorSlotByKey.get(value.reference_slot_key);
    assert(predecessorSlot, value.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingReviewSlotIndex, true);
    precedingReviewSlotIndex = predecessorSlot.index;
    assert.deepEqual({
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
    }, {
      profile_key: predecessorSlot.slot.profile_key,
      source_unit_key: predecessorSlot.slot.source_unit_key,
      field_key: predecessorSlot.slot.field_key,
    });

    const descriptor = sourceDescriptorById.get(
      value.source_normaliser_descriptor_id,
    );
    assert(descriptor, value.source_normaliser_descriptor_id);
    assert.equal(edgeDescriptorIds.has(value.source_normaliser_descriptor_id), false);
    assert.equal(
      descriptor.normaliser_kind,
      'EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE',
    );
    assert.equal(
      descriptor.normaliser_payload.occurrence_subclass,
      'SOURCE_PROVED_COMMON_WRITTEN_NOTICE_DELIVERY_OCCURRENCE',
    );
    assert.deepEqual({
      reference_slot_key: descriptor.reference_slot_key,
      profile_key: descriptor.profile_key,
      source_unit_key: descriptor.source_unit_key,
      field_key: descriptor.field_key,
      agreement_id: descriptor.agreement_id,
    }, {
      reference_slot_key: value.reference_slot_key,
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
      agreement_id: value.agreement_id,
    });
    assert.deepEqual(
      value.exact_bound_m2_occurrence,
      descriptor.normaliser_payload.exact_bound_m2_occurrence,
    );
    assert.deepEqual(
      value.exact_phase2_linked_rule_binding,
      descriptor.normaliser_payload.exact_phase2_linked_rule_binding,
    );
    assert.deepEqual(
      value.unresolved_same_field_phase2_dependencies,
      descriptor.normaliser_payload.unresolved_same_field_phase2_dependencies,
    );
    assert.equal(
      value.withheld_owner_choice,
      descriptor.normaliser_payload.withheld_owner_choice,
    );
    value.unresolved_same_field_phase2_dependencies.forEach((dependency) => {
      assertExactKeys(
        dependency,
        TERMINATION_PHASE3_LINKED_RULE_DEPENDENCY_KEYS,
        `${value.reference_slot_key} unresolved dependency keys`,
      );
      assert.equal(dependency.field_key, value.field_key);
      assert.equal(
        dependency.resolution_state,
        'SOURCE_STATED_TARGET_UNRESOLVED',
      );
    });

    const terminal = jsonPointerValue(
      phase2Authority,
      descriptor.phase2_terminal_contract_path,
    );
    assert.equal(terminal.source_unit_key, value.source_unit_key);
    assert.equal(terminal.agreement_id, value.agreement_id);
    assert.equal(
      terminal.required_expression_signature
        .split(/[(),]/u).includes(value.field_key),
      true,
    );
    const matchingBindings = terminal.linked_rule_bindings.filter(
      (binding) => binding.binding_key
        === value.exact_phase2_linked_rule_binding.binding_key,
    );
    assert.equal(matchingBindings.length, 1);
    assert.deepEqual(matchingBindings[0], value.exact_phase2_linked_rule_binding);
    assertExactKeys(
      value.exact_phase2_linked_rule_binding,
      TERMINATION_PHASE3_LINKED_RULE_BINDING_KEYS,
      `${value.reference_slot_key} Phase2 linked-rule binding keys`,
    );
    assert.equal(
      value.exact_phase2_linked_rule_binding.binding_kind,
      'CROSS_NODE_MATERIAL_RULE_RELATIONSHIP',
    );
    assert.equal(
      value.exact_phase2_linked_rule_binding.resolution_state,
      'SOURCE_PROVED',
    );
    assert.equal(value.exact_phase2_linked_rule_binding.target_component_key, null);
    assert.equal(
      value.exact_phase2_linked_rule_binding.target_signature
        .split(/[(),]/u).includes(value.field_key),
      true,
    );
    const closureTargets = terminal.source_closure.members.filter((member) => (
      member.node_occurrence_id
        === value.exact_phase2_linked_rule_binding.target_node_occurrence_id
    ));
    assert.equal(closureTargets.length, 1);
    assert.deepEqual({
      closure_role: closureTargets[0].closure_role,
      node_kind: closureTargets[0].node_kind,
    }, {
      closure_role: 'COMMON_EXERCISE_RULE_NODE',
      node_kind: 'SENTENCE',
    });

    const evidence = fixture.governedSources
      .agreementEvidenceByAgreementId[value.agreement_id];
    assert(evidence, value.agreement_id);
    const m2 = evidence.m2.record;
    const occurrence = value.exact_bound_m2_occurrence;
    assertExactKeys(
      occurrence,
      TERMINATION_PHASE3_LINKED_RULE_BOUND_OCCURRENCE_KEYS,
      `${value.reference_slot_key} exact bound occurrence keys`,
    );
    assertExactKeys(
      occurrence.m2_node,
      TERMINATION_PHASE3_M2_TARGET_KEYS,
      `${value.reference_slot_key} exact M2 node keys`,
    );
    assertExactKeys(
      occurrence.occurrence_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} occurrence span keys`,
    );
    const targetNodes = m2.nodes.filter((node) => (
      node.node_occurrence_id === occurrence.m2_node.node_occurrence_id
    ));
    assert.equal(targetNodes.length, 1);
    const [targetNode] = targetNodes;
    assert.deepEqual(occurrence.m2_node, {
      agreement_index_id: m2.agreement_index_id,
      extent_span: targetNode.extent_span,
      node_kind: targetNode.node_kind,
      node_occurrence_id: targetNode.node_occurrence_id,
      reference: targetNode.reference,
    });
    assert.deepEqual(closureTargets[0].source_span, targetNode.extent_span);
    assert.equal(
      value.exact_phase2_linked_rule_binding.target_node_occurrence_id,
      targetNode.node_occurrence_id,
    );
    assert.equal(
      targetNode.extent_span.start_byte <= occurrence.occurrence_span.start_byte,
      true,
    );
    assert.equal(
      occurrence.occurrence_span.end_byte <= targetNode.extent_span.end_byte,
      true,
    );
    const occurrenceText = utf8Slice(
      m2.source_binding.canonical_text,
      occurrence.occurrence_span.start_byte,
      occurrence.occurrence_span.end_byte,
    );
    assert.equal(occurrenceText, occurrence.occurrence_text);
    assert.equal(
      sha256Hex(Buffer.from(occurrenceText, 'utf8')),
      occurrence.occurrence_span.text_sha256,
    );

    assertExactKeys(
      value.source_support,
      TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
      `${value.reference_slot_key} source support keys`,
    );
    assertExactKeys(
      value.source_support.source_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} source support span keys`,
    );
    assert.deepEqual(value.source_support, {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: targetNode.node_occurrence_id,
      source_span: occurrence.occurrence_span,
      source_support_id: value.source_support.source_support_id,
      source_text: occurrenceText,
    });
    assert.equal(
      value.source_support.source_support_id,
      contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: m2.agreement_index_id,
        source_node_occurrence_id: targetNode.node_occurrence_id,
        start_byte: occurrence.occurrence_span.start_byte,
        end_byte: occurrence.occurrence_span.end_byte,
        text_sha256: occurrence.occurrence_span.text_sha256,
      }),
    );
    assert.equal(
      value.proposed_reference_target_string,
      targetNode.node_occurrence_id,
    );
    assert.match(value.proposed_reference_target_string, /^[0-9a-f]{64}$/u);
    assert.equal(Object.hasOwn(value, 'projected_context_edge'), false);

    assertExactKeys(
      value.normalisation_proof,
      TERMINATION_PHASE3_LINKED_RULE_PROOF_KEYS,
      `${value.reference_slot_key} normalisation proof keys`,
    );
    assert.deepEqual(value.normalisation_proof, {
      input_linked_rule_binding_keys: [
        value.exact_phase2_linked_rule_binding.binding_key,
      ],
      input_source_span_ids: [value.source_support.source_support_id],
      result_digest: sha256Hex(Buffer.from(
        canonicalJson(value.proposed_reference_target_string),
        'utf8',
      )),
      rule_id: 'SOURCE_PROVED_LINKED_RULE_REFERENCE/V1',
    });
  }

  assert.equal(reviewIds.size, 10);
  assert.equal(reviewSlotKeys.size, 10);
  assert.equal(descriptorIds.size, 10);
  assert.equal(supportIds.size, 1);
  assert.equal(proposedTargets.size, 1);
  assert.equal(withheldOwnerChoices.size, 1);
  assert.equal(nonemptyDependencyRowCount, 3);
  assert.deepEqual(
    [...supportIds],
    ['83352b81558d364fd4ce76eb5ab96d169dbc14ba948ea5841a69e8408593e860'],
  );
  assert.deepEqual(
    [...proposedTargets],
    ['1f20ce7e97b9ef135a1fabc4d743c22aab7ca2d5dfb872db30db54a93159426d'],
  );
  assert.deepEqual(
    new Set(values.map((value) => value.normalisation_proof.result_digest)),
    new Set([
      '5d0c91e3bf36a7ba3709ffb4ce0db8d22897723430c26e335a13105430b19a39',
    ]),
  );
  assert.deepEqual(
    result.linked_rule_reference_value_contract,
    linkedAuthority.candidate_output_contract
      .linked_rule_reference_value_contract,
  );
  const valueBytes = Buffer.from(canonicalJson(values), 'utf8');
  assert.equal(
    valueBytes.byteLength,
    linkedAuthority.linked_rule_reference_value_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(valueBytes),
    linkedAuthority.linked_rule_reference_value_contract.sha256,
  );

  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 22);
  assert.deepEqual(
    remainingSlots,
    linkedAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    linkedAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(linkedAuthority.remaining_unresolved_reference_slots),
    'candidate/authority linked-rule remaining slot alias',
  );
  let precedingRemainingSlotIndex = -1;
  for (const slot of remainingSlots) {
    assertExactKeys(
      slot,
      linkedAuthority.remaining_unresolved_reference_slot_contract
        .exact_member_keys,
      `${slot.reference_slot_key} linked-rule remaining slot keys`,
    );
    const predecessorSlot = predecessorSlotByKey.get(slot.reference_slot_key);
    assert(predecessorSlot, slot.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingRemainingSlotIndex, true);
    precedingRemainingSlotIndex = predecessorSlot.index;
    assert.deepEqual(slot, predecessorSlot.slot);
    assert.equal(reviewSlotKeys.has(slot.reference_slot_key), false);
    assert.equal(
      slot.reference_slot_key,
      contentId(
        linkedAuthority.remaining_unresolved_reference_slot_contract
          .identity_domain,
        {
          profile_key: slot.profile_key,
          source_unit_key: slot.source_unit_key,
          field_key: slot.field_key,
        },
      ),
    );
  }
  assert.deepEqual(
    values.map((value) => value.reference_slot_key),
    predecessor.remaining_unresolved_reference_slots
      .filter((slot) => reviewSlotKeys.has(slot.reference_slot_key))
      .map((slot) => slot.reference_slot_key),
  );
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots.filter(
      (slot) => remainingSlotKeys.has(slot.reference_slot_key),
    ),
  );
  assert.equal(
    new Set([...reviewSlotKeys, ...remainingSlotKeys]).size,
    predecessor.remaining_unresolved_reference_slots.length,
  );
  predecessor.remaining_unresolved_reference_slots.forEach((slot) => {
    assert.equal(
      reviewSlotKeys.has(slot.reference_slot_key)
        || remainingSlotKeys.has(slot.reference_slot_key),
      true,
      slot.reference_slot_key,
    );
  });
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(
    remainingBytes.byteLength,
    linkedAuthority.remaining_unresolved_reference_slot_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(remainingBytes),
    linkedAuthority.remaining_unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    linkedAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );

  assertExactKeys(
    result.linked_rule_reference_value_accounting,
    TERMINATION_PHASE3_LINKED_RULE_ACCOUNTING_KEYS,
    'linked-rule reference value accounting keys',
  );
  assert.deepEqual(
    result.linked_rule_reference_value_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_LINKED_RULE_ACCOUNTING_KEYS.map((key) => [
        key,
        linkedAuthority.candidate_output_contract
          .linked_rule_reference_value_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    linkedAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    linkedAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    linkedAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  linkedAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  linkedAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
    );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);
  const proposedValueOwners = [];
  const collectProposedValueOwners = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Object.hasOwn(value, 'proposed_reference_target_string')) {
      proposedValueOwners.push(value);
    }
    Object.values(value).forEach((child) => (
      collectProposedValueOwners(child, seen)
    ));
  };
  collectProposedValueOwners(result);
  assert.deepEqual(proposedValueOwners, values);

  const repeated = profileAuthoring
    .prepareTerminationLinkedRuleReferenceValueCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated linked-rule reference value result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture = terminationPhase3LinkedRuleReferenceValueFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationLinkedRuleReferenceValueCandidate(frozenFixture);
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(null)
    ));
    const extra = forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3LinkedRuleReferenceValueAuthority',
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing = forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
          missing,
        )
      ));
    }
  });

  await t.test('rejects linked-rule authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_DRIFT';
    const absent = forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    absent.terminationPhase3LinkedRuleReferenceValueAuthority = null;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        absent,
      )
    ));

    const envelopeExtra =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    envelopeExtra.terminationPhase3LinkedRuleReferenceValueAuthority.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        envelopeExtra,
      )
    ));

    const bindingDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    bindingDrift.terminationPhase3LinkedRuleReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        bindingDrift,
      )
    ));

    const recordDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    recordDrift.terminationPhase3LinkedRuleReferenceValueAuthority.record = {
      ...structuredClone(linkedAuthority),
      authority_state: 'DRIFTED',
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        recordDrift,
      )
    ));

    const combined =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    combined.terminationPhase3LinkedRuleReferenceValueAuthority
      .binding.record_id = '0'.repeat(64);
    combined.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        combined,
      )
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', () => {
    const edgeDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    edgeDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3ReferenceSourceNormaliserAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    edgeDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete edgeDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationLinkedRuleReferenceValueCandidate(edgeDrift),
    );

    const sourceDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    sourceDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    sourceDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete sourceDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationLinkedRuleReferenceValueCandidate(sourceDrift),
    );

    const targetDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    targetDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    targetDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    targetDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete targetDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationLinkedRuleReferenceValueCandidate(targetDrift),
    );

    const reviewDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    reviewDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    reviewDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete reviewDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationLinkedRuleReferenceValueCandidate(reviewDrift),
    );

    const phase2Drift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    phase2Drift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete phase2Drift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationLinkedRuleReferenceValueCandidate(phase2Drift),
    );
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_SOURCE_COVERAGE';
    const extraGoverned =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        extraGoverned,
      )
    ));

    const missingGoverned =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        missingGoverned,
      )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
          drift,
        )
      ));
    }

    const [agreementId] = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const canonicalTextDrift =
      forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
        canonicalTextDrift,
      )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase3LinkedRuleReferenceValueFixture(fixture);
      const agreementEvidence = forkTerminationAgreementEvidence(
        drift,
        agreementId,
      );
      forkTerminationSourceEnvelope(agreementEvidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationLinkedRuleReferenceValueCandidate(
          drift,
        )
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 linked-rule reference values preserve ten exact Termination notice targets without Work3 materialisation',
  );
});

test('Phase3 raw-M2 reference owner values preserve seven exact Termination source owners without Work3 materialisation', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate,
    'function',
  );

  const fixture = terminationPhase3RawM2ReferenceOwnerValueFixture();
  const rawEnvelope =
    fixture.terminationPhase3RawM2ReferenceOwnerValueAuthority;
  const rawAuthority = rawEnvelope.record;
  const linkedEnvelope =
    fixture.terminationPhase3LinkedRuleReferenceValueAuthority;
  const edgeEnvelope = fixture.terminationPhase3ReferenceEdgeValueAuthority;
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(rawAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(rawAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_raw_m2_reference_owner_value_authority_id;
  assert.equal(
    rawAuthority
      .termination_authoring_phase3_raw_m2_reference_owner_value_authority_id,
    contentId(rawAuthority.schema_version, unsignedAuthority),
  );

  const predecessor = profileAuthoring
    .prepareTerminationLinkedRuleReferenceValueCandidate({
      terminationPhase3LinkedRuleReferenceValueAuthority: linkedEnvelope,
      terminationPhase3ReferenceEdgeValueAuthority: edgeEnvelope,
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  assert.equal(
    predecessor.linked_rule_reference_value_candidate_id,
    contentId(
      predecessor.schema_version,
      linkedRuleReferenceValueCandidateUnsignedRecord(predecessor),
    ),
  );
  assert.equal(
    predecessor.linked_rule_reference_value_candidate_id,
    '824a94cb83324fff671dba51cfea5662e51e364cce24bedd915f114173db1477',
  );
  const predecessorBinding = {
    schema_version: predecessor.schema_version,
    linked_rule_reference_value_candidate_id:
      predecessor.linked_rule_reference_value_candidate_id,
    linked_rule_reference_value_count:
      predecessor.linked_rule_reference_value_accounting
        .linked_rule_reference_value_count,
    remaining_source_normaliser_descriptor_count:
      predecessor.linked_rule_reference_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_source_admission_gap_count:
      predecessor.linked_rule_reference_value_accounting
        .remaining_source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      predecessor.linked_rule_reference_value_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  };
  assertExactKeys(
    predecessorBinding,
    rawAuthority.candidate_output_contract
      .predecessor_linked_rule_reference_value_candidate_binding_exact_keys,
    'predecessor linked-rule reference value candidate binding keys',
  );
  assert.deepEqual(
    predecessorBinding,
    rawAuthority.predecessor_linked_rule_reference_value_candidate_binding,
  );

  const result = profileAuthoring
    .prepareTerminationRawM2ReferenceOwnerValueCandidate(fixture);
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'raw-M2 reference owner result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(predecessor),
    'raw-M2 reference owner result/predecessor alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_CANDIDATE_KEYS,
    'Phase3 raw-M2 reference owner value candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_RAW_M2_REFERENCE_OWNER_TARGET_STRINGS_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
  });
  assert.equal(
    result.raw_m2_reference_owner_value_candidate_id,
    contentId(
      result.schema_version,
      rawM2ReferenceOwnerValueCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(result.phase2_proposal_binding, predecessor.phase2_proposal_binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    rawAuthority.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_source_normaliser_authority_binding,
    sourceEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_reference_edge_value_authority_binding,
    edgeEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_linked_rule_reference_value_authority_binding,
    linkedEnvelope.binding,
  );
  assert.deepEqual(
    result.predecessor_linked_rule_reference_value_candidate_binding,
    predecessorBinding,
  );
  assert.deepEqual(
    result.phase3_raw_m2_reference_owner_value_authority_binding,
    rawEnvelope.binding,
  );
  for (const [label, binding] of [
    ['Phase2', result.phase2_authority_binding],
    ['Phase3 review', result.phase3_reference_review_authority_binding],
    ['Phase3 target evidence', result.phase3_target_evidence_authority_binding],
    ['Phase3 source normaliser', result.phase3_source_normaliser_authority_binding],
    ['Phase3 reference edge value', result.phase3_reference_edge_value_authority_binding],
    ['Phase3 linked-rule reference value',
      result.phase3_linked_rule_reference_value_authority_binding],
    ['Phase3 raw-M2 reference owner value',
      result.phase3_raw_m2_reference_owner_value_authority_binding],
  ]) {
    assertExactKeys(
      binding,
      rawAuthority.candidate_output_contract.authority_binding_exact_keys,
      `${label} authority binding keys`,
    );
  }
  assertExactKeys(
    result.phase2_proposal_binding,
    rawAuthority.candidate_output_contract.phase2_proposal_binding_exact_keys,
    'raw-M2 Phase2 proposal binding keys',
  );

  const sourceCandidate = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate({
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map(
      (slot, index) => [slot.reference_slot_key, { slot, index }],
    ),
  );
  const sourceDescriptorById = new Map(
    sourceCandidate.source_normaliser_descriptors.map(
      (descriptor) => [descriptor.source_normaliser_descriptor_id, descriptor],
    ),
  );
  const reviewIds = new Set();
  const reviewSlotKeys = new Set();
  const descriptorIds = new Set();
  const proposedTargets = new Set();
  const definitionSupportIds = new Set();
  const terminalSupportIds = new Set();
  const subclassCounts = new Map();
  let precedingReviewSlotIndex = -1;
  const values = result.raw_m2_reference_owner_values;
  assert.equal(values.length, 7);
  assert.deepEqual(values, rawAuthority.raw_m2_reference_owner_values);
  assert.notStrictEqual(values, rawAuthority.raw_m2_reference_owner_values);
  assertDisjoint(
    collectObjectIdentities(values),
    collectObjectIdentities(rawAuthority.raw_m2_reference_owner_values),
    'candidate/authority raw-M2 value alias',
  );

  for (const value of values) {
    assertExactKeys(
      value,
      TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_KEYS,
      `${value.reference_slot_key} raw-M2 reference owner value keys`,
    );
    const unsignedValue = structuredClone(value);
    delete unsignedValue.raw_m2_reference_owner_target_string_review_id;
    assert.equal(
      value.raw_m2_reference_owner_target_string_review_id,
      contentId(
        rawAuthority.raw_m2_reference_owner_value_contract.identity_domain,
        unsignedValue,
      ),
    );
    assert.equal(
      reviewIds.has(value.raw_m2_reference_owner_target_string_review_id),
      false,
    );
    reviewIds.add(value.raw_m2_reference_owner_target_string_review_id);
    assert.equal(reviewSlotKeys.has(value.reference_slot_key), false);
    reviewSlotKeys.add(value.reference_slot_key);
    assert.equal(descriptorIds.has(value.source_normaliser_descriptor_id), false);
    descriptorIds.add(value.source_normaliser_descriptor_id);
    proposedTargets.add(value.proposed_reference_target_string);
    definitionSupportIds.add(value.definition_source_support.source_support_id);
    terminalSupportIds.add(value.terminal_term_source_support.source_support_id);
    subclassCounts.set(
      value.repair_subclass,
      (subclassCounts.get(value.repair_subclass) || 0) + 1,
    );
    assert.equal(value.value_type, 'REFERENCE');
    assert.equal(value.normalisation_rule_id, 'RAW_M2_REFERENCE_OWNER/V1');
    assert.equal(
      value.materialisation_state,
      'REVIEW_ONLY_RAW_M2_REFERENCE_OWNER_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
    );
    assert.equal(value.work3_fixture_consumable_value_shape, false);
    assert.equal(Object.hasOwn(value, 'projected_context_edge'), false);

    const predecessorSlot = predecessorSlotByKey.get(value.reference_slot_key);
    assert(predecessorSlot, value.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingReviewSlotIndex, true);
    precedingReviewSlotIndex = predecessorSlot.index;
    assert.deepEqual({
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
    }, {
      profile_key: predecessorSlot.slot.profile_key,
      source_unit_key: predecessorSlot.slot.source_unit_key,
      field_key: predecessorSlot.slot.field_key,
    });

    const descriptor = sourceDescriptorById.get(
      value.source_normaliser_descriptor_id,
    );
    assert(descriptor, value.source_normaliser_descriptor_id);
    assert.equal(
      descriptor.normaliser_kind,
      'RAW_M2_DEFINITION_OR_EVENT_BOUNDARY_REFERENCE_EVIDENCE',
    );
    assert.deepEqual({
      reference_slot_key: descriptor.reference_slot_key,
      profile_key: descriptor.profile_key,
      source_unit_key: descriptor.source_unit_key,
      field_key: descriptor.field_key,
      agreement_id: descriptor.agreement_id,
    }, {
      reference_slot_key: value.reference_slot_key,
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
      agreement_id: value.agreement_id,
    });
    const payload = descriptor.normaliser_payload;
    assert.deepEqual(
      value.exact_raw_definition_occurrence,
      payload.exact_raw_definition_occurrence,
    );
    assert.equal(value.exact_term, payload.exact_term);
    assert.deepEqual(
      value.phase2_defined_term_or_reference_dependencies,
      payload.phase2_defined_term_or_reference_dependencies,
    );
    assert.equal(value.repair_subclass, payload.repair_subclass);
    assert.deepEqual(
      value.terminal_source_occurrence,
      payload.terminal_source_occurrence,
    );
    assert.equal(
      payload.agreement_local_resolved_exact_term_m3_definition_edge_count,
      0,
    );

    const terminal = jsonPointerValue(
      phase2Authority,
      descriptor.phase2_terminal_contract_path,
    );
    assert.equal(terminal.source_unit_key, value.source_unit_key);
    assert.equal(terminal.agreement_id, value.agreement_id);
    assert.equal(
      terminal.required_expression_signature
        .split(/[(),]/u).includes(value.field_key),
      true,
    );
    assert.equal(value.phase2_defined_term_or_reference_dependencies.length, 1);
    const dependency = value.phase2_defined_term_or_reference_dependencies[0];
    const dependencySource = value.repair_subclass
      === 'EVENT_BOUNDARY_DEFINED_PERIOD_SOURCE_REPAIR'
      ? terminal.dependency_contracts.reference_dependencies
      : terminal.dependency_contracts.defined_term_dependencies;
    const matchingDependencies = dependencySource.filter(
      (candidate) => candidate.field_key === value.field_key,
    );
    assert.equal(matchingDependencies.length, 1);
    assert.deepEqual(matchingDependencies[0], dependency);
    if (value.repair_subclass
      === 'EVENT_BOUNDARY_DEFINED_PERIOD_SOURCE_REPAIR') {
      assertExactKeys(
        dependency,
        TERMINATION_PHASE3_RAW_M2_EVENT_DEPENDENCY_KEYS,
        `${value.reference_slot_key} event dependency keys`,
      );
      assert.equal(dependency.resolution_state, 'SOURCE_STATED_TARGET_UNRESOLVED');
      assert.equal(dependency.target_kind, 'EVENT_OWNER_FACT');
    } else {
      assertExactKeys(
        dependency,
        TERMINATION_PHASE3_RAW_M2_DEFINED_TERM_DEPENDENCY_KEYS,
        `${value.reference_slot_key} defined-term dependency keys`,
      );
      assert.equal(dependency.resolution_state, 'SOURCE_STATED_OWNER_UNRESOLVED');
      assert.equal(dependency.source_text, value.exact_term);
    }

    const evidence = fixture.governedSources
      .agreementEvidenceByAgreementId[value.agreement_id];
    assert(evidence, value.agreement_id);
    const m2 = evidence.m2.record;
    const m3 = evidence.m3.record;
    const canonicalTextBytes = Buffer.from(
      m2.source_binding.canonical_text,
      'utf8',
    );
    const definition = value.exact_raw_definition_occurrence;
    const terminalOccurrence = value.terminal_source_occurrence;
    assertExactKeys(
      definition,
      TERMINATION_PHASE3_RAW_M2_DEFINITION_OCCURRENCE_KEYS,
      `${value.reference_slot_key} raw definition occurrence keys`,
    );
    assertExactKeys(
      terminalOccurrence,
      TERMINATION_PHASE3_RAW_M2_TERMINAL_OCCURRENCE_KEYS,
      `${value.reference_slot_key} terminal occurrence keys`,
    );
    for (const node of [definition.m2_node, terminalOccurrence.m2_node]) {
      assertExactKeys(
        node,
        TERMINATION_PHASE3_M2_TARGET_KEYS,
        `${value.reference_slot_key} M2 node keys`,
      );
      assertExactKeys(
        node.extent_span,
        TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
        `${value.reference_slot_key} M2 extent span keys`,
      );
      const matchingNodes = m2.nodes.filter(
        (candidate) => candidate.node_occurrence_id === node.node_occurrence_id,
      );
      assert.equal(matchingNodes.length, 1);
      assert.deepEqual(node, {
        agreement_index_id: m2.agreement_index_id,
        extent_span: matchingNodes[0].extent_span,
        node_kind: matchingNodes[0].node_kind,
        node_occurrence_id: matchingNodes[0].node_occurrence_id,
        reference: matchingNodes[0].reference,
      });
    }
    const closureMembers = terminal.source_closure.members.filter(
      (member) => member.node_occurrence_id
        === terminalOccurrence.m2_node.node_occurrence_id,
    );
    assert.equal(closureMembers.length, 1);
    assert.equal(
      closureMembers[0].closure_role,
      terminalOccurrence.source_closure_role,
    );

    const definitionSpan = definition.definition_span;
    assertExactKeys(
      definitionSpan,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} definition span keys`,
    );
    assert.equal(
      definition.m2_node.extent_span.start_byte <= definitionSpan.start_byte,
      true,
    );
    assert.equal(
      definitionSpan.end_byte <= definition.m2_node.extent_span.end_byte,
      true,
    );
    const definitionBytes = Buffer.from(definition.definition_text, 'utf8');
    assert.deepEqual(
      canonicalTextBytes.subarray(
        definitionSpan.start_byte,
        definitionSpan.end_byte,
      ),
      definitionBytes,
    );
    assert.equal(sha256Hex(definitionBytes), definitionSpan.text_sha256);
    const definitionFirst = canonicalTextBytes.indexOf(definitionBytes);
    assert.equal(definitionFirst, definitionSpan.start_byte);
    assert.equal(
      canonicalTextBytes.indexOf(definitionBytes, definitionFirst + 1),
      -1,
    );
    assert.notEqual(definitionBytes.indexOf(Buffer.from(value.exact_term, 'utf8')), -1);

    const occurrenceSpan = terminalOccurrence.occurrence_span;
    assertExactKeys(
      occurrenceSpan,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} terminal occurrence span keys`,
    );
    assert.equal(
      terminalOccurrence.m2_node.extent_span.start_byte
        <= occurrenceSpan.start_byte,
      true,
    );
    assert.equal(
      occurrenceSpan.end_byte
        <= terminalOccurrence.m2_node.extent_span.end_byte,
      true,
    );
    const occurrenceBytes = Buffer.from(
      terminalOccurrence.occurrence_text,
      'utf8',
    );
    assert.deepEqual(
      canonicalTextBytes.subarray(
        occurrenceSpan.start_byte,
        occurrenceSpan.end_byte,
      ),
      occurrenceBytes,
    );
    assert.equal(sha256Hex(occurrenceBytes), occurrenceSpan.text_sha256);
    const termBytes = Buffer.from(value.exact_term, 'utf8');
    const termFirst = occurrenceBytes.indexOf(termBytes);
    assert.notEqual(termFirst, -1);
    assert.equal(occurrenceBytes.indexOf(termBytes, termFirst + 1), -1);
    const terminalTermSpan = {
      coordinate_system: occurrenceSpan.coordinate_system,
      end_byte: occurrenceSpan.start_byte + termFirst + termBytes.length,
      start_byte: occurrenceSpan.start_byte + termFirst,
      text_sha256: sha256Hex(termBytes),
    };

    for (const [label, support] of [
      ['definition', value.definition_source_support],
      ['terminal term', value.terminal_term_source_support],
    ]) {
      assertExactKeys(
        support,
        TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
        `${value.reference_slot_key} ${label} support keys`,
      );
      assertExactKeys(
        support.source_span,
        TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
        `${value.reference_slot_key} ${label} support span keys`,
      );
    }
    assert.deepEqual(value.definition_source_support, {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: definition.m2_node.node_occurrence_id,
      source_span: definitionSpan,
      source_support_id: value.definition_source_support.source_support_id,
      source_text: definition.definition_text,
    });
    assert.equal(
      value.definition_source_support.source_support_id,
      contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: m2.agreement_index_id,
        source_node_occurrence_id: definition.m2_node.node_occurrence_id,
        start_byte: definitionSpan.start_byte,
        end_byte: definitionSpan.end_byte,
        text_sha256: definitionSpan.text_sha256,
      }),
    );
    assert.deepEqual(value.terminal_term_source_support, {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: terminalOccurrence.m2_node.node_occurrence_id,
      source_span: terminalTermSpan,
      source_support_id: value.terminal_term_source_support.source_support_id,
      source_text: value.exact_term,
    });
    assert.equal(
      value.terminal_term_source_support.source_support_id,
      contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: m2.agreement_index_id,
        source_node_occurrence_id: terminalOccurrence.m2_node.node_occurrence_id,
        start_byte: terminalTermSpan.start_byte,
        end_byte: terminalTermSpan.end_byte,
        text_sha256: terminalTermSpan.text_sha256,
      }),
    );

    const resolvedSameTermEdges = m3.definition_edges.filter(
      (edge) => edge.term === value.exact_term && edge.state === 'RESOLVED',
    );
    assert.deepEqual(value.resolved_same_term_m3_definition_edges, []);
    assert.deepEqual(resolvedSameTermEdges, []);
    assert.equal(
      value.proposed_reference_target_string,
      definition.m2_node.node_occurrence_id,
    );
    assert.match(value.proposed_reference_target_string, /^[0-9a-f]{64}$/u);
    assertExactKeys(
      value.normalisation_proof,
      TERMINATION_PHASE3_RAW_M2_NORMALISATION_PROOF_KEYS,
      `${value.reference_slot_key} raw-M2 normalisation proof keys`,
    );
    assert.deepEqual(value.normalisation_proof, {
      input_definition_source_span_ids: [
        value.definition_source_support.source_support_id,
      ],
      input_terminal_term_source_span_ids: [
        value.terminal_term_source_support.source_support_id,
      ],
      result_digest: sha256Hex(Buffer.from(
        canonicalJson(value.proposed_reference_target_string),
        'utf8',
      )),
      rule_id: 'RAW_M2_REFERENCE_OWNER/V1',
    });
  }

  assert.equal(reviewIds.size, 7);
  assert.equal(reviewSlotKeys.size, 7);
  assert.equal(descriptorIds.size, 7);
  assert.equal(proposedTargets.size, 5);
  assert.equal(definitionSupportIds.size, 5);
  assert.equal(terminalSupportIds.size, 6);
  assert.deepEqual(Object.fromEntries(subclassCounts), {
    EVENT_BOUNDARY_DEFINED_PERIOD_SOURCE_REPAIR: 2,
    RAW_QUOTED_DEFINED_TERM_OWNER_REPAIR: 5,
  });
  assert.deepEqual(
    result.raw_m2_reference_owner_value_contract,
    rawAuthority.candidate_output_contract.raw_m2_reference_owner_value_contract,
  );
  const valueBytes = Buffer.from(canonicalJson(values), 'utf8');
  assert.equal(
    valueBytes.byteLength,
    rawAuthority.raw_m2_reference_owner_value_contract.canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(valueBytes),
    rawAuthority.raw_m2_reference_owner_value_contract.sha256,
  );

  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 15);
  assert.deepEqual(
    remainingSlots,
    rawAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    rawAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(rawAuthority.remaining_unresolved_reference_slots),
    'candidate/authority raw-M2 remaining slot alias',
  );
  let precedingRemainingSlotIndex = -1;
  for (const slot of remainingSlots) {
    assertExactKeys(
      slot,
      rawAuthority.remaining_unresolved_reference_slot_contract
        .exact_member_keys,
      `${slot.reference_slot_key} raw-M2 remaining slot keys`,
    );
    const predecessorSlot = predecessorSlotByKey.get(slot.reference_slot_key);
    assert(predecessorSlot, slot.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingRemainingSlotIndex, true);
    precedingRemainingSlotIndex = predecessorSlot.index;
    assert.deepEqual(slot, predecessorSlot.slot);
    assert.equal(reviewSlotKeys.has(slot.reference_slot_key), false);
    assert.equal(
      slot.reference_slot_key,
      contentId(
        rawAuthority.remaining_unresolved_reference_slot_contract.identity_domain,
        {
          profile_key: slot.profile_key,
          source_unit_key: slot.source_unit_key,
          field_key: slot.field_key,
        },
      ),
    );
  }
  assert.deepEqual(
    values.map((value) => value.reference_slot_key),
    predecessor.remaining_unresolved_reference_slots
      .filter((slot) => reviewSlotKeys.has(slot.reference_slot_key))
      .map((slot) => slot.reference_slot_key),
  );
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots.filter(
      (slot) => remainingSlotKeys.has(slot.reference_slot_key),
    ),
  );
  assert.equal(
    new Set([...reviewSlotKeys, ...remainingSlotKeys]).size,
    predecessor.remaining_unresolved_reference_slots.length,
  );
  predecessor.remaining_unresolved_reference_slots.forEach((slot) => {
    assert.equal(
      reviewSlotKeys.has(slot.reference_slot_key)
        || remainingSlotKeys.has(slot.reference_slot_key),
      true,
      slot.reference_slot_key,
    );
  });
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(
    remainingBytes.byteLength,
    rawAuthority.remaining_unresolved_reference_slot_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(remainingBytes),
    rawAuthority.remaining_unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    rawAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );

  assertExactKeys(
    result.raw_m2_reference_owner_value_accounting,
    TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_ACCOUNTING_KEYS,
    'raw-M2 reference owner value accounting keys',
  );
  assert.deepEqual(
    result.raw_m2_reference_owner_value_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_ACCOUNTING_KEYS.map((key) => [
        key,
        rawAuthority.candidate_output_contract
          .raw_m2_reference_owner_value_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    rawAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    rawAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    rawAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  rawAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  rawAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
    );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);
  const proposedValueOwners = [];
  const collectProposedValueOwners = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Object.hasOwn(value, 'proposed_reference_target_string')) {
      proposedValueOwners.push(value);
    }
    Object.values(value).forEach((child) => (
      collectProposedValueOwners(child, seen)
    ));
  };
  collectProposedValueOwners(result);
  assert.deepEqual(proposedValueOwners, values);

  const repeated = profileAuthoring
    .prepareTerminationRawM2ReferenceOwnerValueCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated raw-M2 reference owner value result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture = terminationPhase3RawM2ReferenceOwnerValueFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationRawM2ReferenceOwnerValueCandidate(frozenFixture);
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(null)
    ));
    const extra = forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3RawM2ReferenceOwnerValueAuthority',
      'terminationPhase3LinkedRuleReferenceValueAuthority',
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing = forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
          missing,
        )
      ));
    }
  });

  await t.test('rejects raw-M2 authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_DRIFT';
    const absent = forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    absent.terminationPhase3RawM2ReferenceOwnerValueAuthority = null;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        absent,
      )
    ));

    const envelopeExtra =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    envelopeExtra.terminationPhase3RawM2ReferenceOwnerValueAuthority.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        envelopeExtra,
      )
    ));

    const bindingDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    bindingDrift.terminationPhase3RawM2ReferenceOwnerValueAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        bindingDrift,
      )
    ));

    const recordDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    recordDrift.terminationPhase3RawM2ReferenceOwnerValueAuthority.record = {
      ...structuredClone(rawAuthority),
      authority_state: 'DRIFTED',
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        recordDrift,
      )
    ));

    const combined =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    combined.terminationPhase3RawM2ReferenceOwnerValueAuthority
      .binding.record_id = '0'.repeat(64);
    combined.terminationPhase3LinkedRuleReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        combined,
      )
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', () => {
    const linkedDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    linkedDrift.terminationPhase3LinkedRuleReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    linkedDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    linkedDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    linkedDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    linkedDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    linkedDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete linkedDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationRawM2ReferenceOwnerValueCandidate(linkedDrift),
    );

    const edgeDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    edgeDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3ReferenceSourceNormaliserAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    edgeDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete edgeDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationRawM2ReferenceOwnerValueCandidate(edgeDrift),
    );

    const sourceDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    sourceDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    sourceDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete sourceDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationRawM2ReferenceOwnerValueCandidate(sourceDrift),
    );

    const targetDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    targetDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    targetDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    targetDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete targetDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationRawM2ReferenceOwnerValueCandidate(targetDrift),
    );

    const reviewDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    reviewDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    reviewDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete reviewDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationRawM2ReferenceOwnerValueCandidate(reviewDrift),
    );

    const phase2Drift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    phase2Drift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete phase2Drift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationRawM2ReferenceOwnerValueCandidate(phase2Drift),
    );
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_SOURCE_COVERAGE';
    const extraGoverned =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        extraGoverned,
      )
    ));

    const missingGoverned =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        missingGoverned,
      )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift = forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
          drift,
        )
      ));
    }

    const [agreementId] = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const canonicalTextDrift =
      forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
        canonicalTextDrift,
      )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift = forkTerminationPhase3RawM2ReferenceOwnerValueFixture(fixture);
      const agreementEvidence = forkTerminationAgreementEvidence(
        drift,
        agreementId,
      );
      forkTerminationSourceEnvelope(agreementEvidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring.prepareTerminationRawM2ReferenceOwnerValueCandidate(
          drift,
        )
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 raw-M2 reference owner values preserve seven exact Termination source owners without Work3 materialisation',
  );
});

test('Phase3 source-occurrence self-reference values preserve twelve exact Termination source owners without Work3 materialisation', async (t) => {
  assert.equal(
    typeof profileAuthoring
      .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate,
    'function',
  );

  const fixture = terminationPhase3SourceOccurrenceSelfReferenceValueFixture();
  const selfEnvelope =
    fixture.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority;
  const selfAuthority = selfEnvelope.record;
  const rawEnvelope = fixture.terminationPhase3RawM2ReferenceOwnerValueAuthority;
  const linkedEnvelope =
    fixture.terminationPhase3LinkedRuleReferenceValueAuthority;
  const edgeEnvelope = fixture.terminationPhase3ReferenceEdgeValueAuthority;
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(selfAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(selfAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_source_occurrence_self_reference_value_authority_id;
  assert.equal(
    selfAuthority
      .termination_authoring_phase3_source_occurrence_self_reference_value_authority_id,
    contentId(selfAuthority.schema_version, unsignedAuthority),
  );

  const predecessor = profileAuthoring
    .prepareTerminationRawM2ReferenceOwnerValueCandidate({
      terminationPhase3RawM2ReferenceOwnerValueAuthority: rawEnvelope,
      terminationPhase3LinkedRuleReferenceValueAuthority: linkedEnvelope,
      terminationPhase3ReferenceEdgeValueAuthority: edgeEnvelope,
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  assert.equal(
    predecessor.raw_m2_reference_owner_value_candidate_id,
    contentId(
      predecessor.schema_version,
      rawM2ReferenceOwnerValueCandidateUnsignedRecord(predecessor),
    ),
  );
  assert.equal(
    predecessor.raw_m2_reference_owner_value_candidate_id,
    'a419d66860c26d36e4bd58119b5d11d7cede9580e04d2b48d78ccf609374a10b',
  );
  const predecessorBinding = {
    schema_version: predecessor.schema_version,
    raw_m2_reference_owner_value_candidate_id:
      predecessor.raw_m2_reference_owner_value_candidate_id,
    raw_m2_reference_owner_value_count:
      predecessor.raw_m2_reference_owner_value_accounting
        .raw_m2_reference_owner_value_count,
    remaining_source_normaliser_descriptor_count:
      predecessor.raw_m2_reference_owner_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_source_admission_gap_count:
      predecessor.raw_m2_reference_owner_value_accounting
        .remaining_source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      predecessor.raw_m2_reference_owner_value_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  };
  assertExactKeys(
    predecessorBinding,
    selfAuthority.candidate_output_contract
      .predecessor_raw_m2_reference_owner_value_candidate_binding_exact_keys,
    'predecessor raw-M2 reference owner value candidate binding keys',
  );
  assert.deepEqual(
    predecessorBinding,
    selfAuthority.predecessor_raw_m2_reference_owner_value_candidate_binding,
  );

  const result = profileAuthoring
    .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(fixture);
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'source-occurrence self-reference result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(predecessor),
    'source-occurrence self-reference result/predecessor alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_CANDIDATE_KEYS,
    'Phase3 source-occurrence self-reference value candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_SOURCE_OCCURRENCE_SELF_REFERENCE_TARGET_STRINGS_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
  });
  assert.equal(
    result.source_occurrence_self_reference_value_candidate_id,
    contentId(
      result.schema_version,
      sourceOccurrenceSelfReferenceValueCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(result.phase2_proposal_binding, predecessor.phase2_proposal_binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    selfAuthority.phase2_proposal_binding,
  );
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_source_normaliser_authority_binding,
    sourceEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_reference_edge_value_authority_binding,
    edgeEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_linked_rule_reference_value_authority_binding,
    linkedEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_raw_m2_reference_owner_value_authority_binding,
    rawEnvelope.binding,
  );
  assert.deepEqual(
    result.predecessor_raw_m2_reference_owner_value_candidate_binding,
    predecessorBinding,
  );
  assert.deepEqual(
    result.phase3_source_occurrence_self_reference_value_authority_binding,
    selfEnvelope.binding,
  );
  for (const [label, binding] of [
    ['Phase2', result.phase2_authority_binding],
    ['Phase3 review', result.phase3_reference_review_authority_binding],
    ['Phase3 target evidence', result.phase3_target_evidence_authority_binding],
    ['Phase3 source normaliser', result.phase3_source_normaliser_authority_binding],
    ['Phase3 reference edge value', result.phase3_reference_edge_value_authority_binding],
    ['Phase3 linked-rule reference value',
      result.phase3_linked_rule_reference_value_authority_binding],
    ['Phase3 raw-M2 reference owner value',
      result.phase3_raw_m2_reference_owner_value_authority_binding],
    ['Phase3 source-occurrence self-reference value',
      result.phase3_source_occurrence_self_reference_value_authority_binding],
  ]) {
    assertExactKeys(
      binding,
      selfAuthority.candidate_output_contract.authority_binding_exact_keys,
      `${label} authority binding keys`,
    );
  }
  assertExactKeys(
    result.phase2_proposal_binding,
    selfAuthority.candidate_output_contract.phase2_proposal_binding_exact_keys,
    'source-occurrence self-reference Phase2 proposal binding keys',
  );

  const sourceCandidate = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate({
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map(
      (slot, index) => [slot.reference_slot_key, { slot, index }],
    ),
  );
  const sourceDescriptorById = new Map(
    sourceCandidate.source_normaliser_descriptors.map(
      (descriptor) => [descriptor.source_normaliser_descriptor_id, descriptor],
    ),
  );
  const reviewIds = new Set();
  const reviewSlotKeys = new Set();
  const descriptorIds = new Set();
  const proposedTargets = new Set();
  const supportIds = new Set();
  const subclassCounts = new Map();
  let rejectedOwnerCount = 0;
  let nonemptyDependencyRows = 0;
  let precedingReviewSlotIndex = -1;
  const values = result.source_occurrence_self_reference_values;
  assert.equal(values.length, 12);
  assert.deepEqual(
    values,
    selfAuthority.source_occurrence_self_reference_values,
  );
  assert.notStrictEqual(
    values,
    selfAuthority.source_occurrence_self_reference_values,
  );
  assertDisjoint(
    collectObjectIdentities(values),
    collectObjectIdentities(selfAuthority.source_occurrence_self_reference_values),
    'candidate/authority source-occurrence self-reference value alias',
  );

  for (const value of values) {
    assertExactKeys(
      value,
      TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_KEYS,
      `${value.reference_slot_key} source-occurrence self-reference value keys`,
    );
    const unsignedValue = structuredClone(value);
    delete unsignedValue
      .source_occurrence_self_reference_target_string_review_id;
    assert.equal(
      value.source_occurrence_self_reference_target_string_review_id,
      contentId(
        selfAuthority.source_occurrence_self_reference_value_contract
          .identity_domain,
        unsignedValue,
      ),
    );
    assert.equal(
      reviewIds.has(
        value.source_occurrence_self_reference_target_string_review_id,
      ),
      false,
    );
    reviewIds.add(value.source_occurrence_self_reference_target_string_review_id);
    assert.equal(reviewSlotKeys.has(value.reference_slot_key), false);
    reviewSlotKeys.add(value.reference_slot_key);
    assert.equal(descriptorIds.has(value.source_normaliser_descriptor_id), false);
    descriptorIds.add(value.source_normaliser_descriptor_id);
    proposedTargets.add(value.proposed_reference_target_string);
    supportIds.add(value.source_support.source_support_id);
    subclassCounts.set(
      value.occurrence_subclass,
      (subclassCounts.get(value.occurrence_subclass) || 0) + 1,
    );
    rejectedOwnerCount += value.rejected_differently_named_owner_candidates.length;
    if (value.exact_same_field_phase2_dependencies.length) {
      nonemptyDependencyRows += 1;
    }
    assert.equal(value.value_type, 'REFERENCE');
    assert.equal(
      value.normalisation_rule_id,
      'SOURCE_OCCURRENCE_SELF_REFERENCE/V1',
    );
    assert.equal(
      value.materialisation_state,
      'REVIEW_ONLY_SOURCE_OCCURRENCE_SELF_REFERENCE_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
    );
    assert.equal(value.work3_fixture_consumable_value_shape, false);
    assert.equal(Object.hasOwn(value, 'projected_context_edge'), false);

    const predecessorSlot = predecessorSlotByKey.get(value.reference_slot_key);
    assert(predecessorSlot, value.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingReviewSlotIndex, true);
    precedingReviewSlotIndex = predecessorSlot.index;
    assert.deepEqual({
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
    }, {
      profile_key: predecessorSlot.slot.profile_key,
      source_unit_key: predecessorSlot.slot.source_unit_key,
      field_key: predecessorSlot.slot.field_key,
    });

    const descriptor = sourceDescriptorById.get(
      value.source_normaliser_descriptor_id,
    );
    assert(descriptor, value.source_normaliser_descriptor_id);
    assert.equal(
      descriptor.normaliser_kind,
      'EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE',
    );
    assert.deepEqual({
      reference_slot_key: descriptor.reference_slot_key,
      profile_key: descriptor.profile_key,
      source_unit_key: descriptor.source_unit_key,
      field_key: descriptor.field_key,
      agreement_id: descriptor.agreement_id,
    }, {
      reference_slot_key: value.reference_slot_key,
      profile_key: value.profile_key,
      source_unit_key: value.source_unit_key,
      field_key: value.field_key,
      agreement_id: value.agreement_id,
    });
    assert.deepEqual(descriptor.normaliser_payload, {
      exact_same_field_phase2_dependencies:
        value.exact_same_field_phase2_dependencies,
      exact_terminal_source_occurrence: value.exact_terminal_source_occurrence,
      occurrence_subclass: value.occurrence_subclass,
      projection_rule_needed: value.projection_rule_needed,
      rejected_differently_named_owner_candidates:
        value.rejected_differently_named_owner_candidates,
    });

    const terminal = jsonPointerValue(
      phase2Authority,
      descriptor.phase2_terminal_contract_path,
    );
    assert.equal(terminal.source_unit_key, value.source_unit_key);
    assert.equal(terminal.agreement_id, value.agreement_id);
    const exactDependencies = Object.values(terminal.dependency_contracts)
      .flat()
      .filter((dependency) => (
        dependency.field_key === value.field_key
        && String(dependency.resolution_state).includes('UNRESOLVED')
      ));
    assert.deepEqual(
      value.exact_same_field_phase2_dependencies,
      exactDependencies,
    );
    for (const dependency of value.exact_same_field_phase2_dependencies) {
      assertExactKeys(
        dependency,
        TERMINATION_PHASE3_SOURCE_OCCURRENCE_DEPENDENCY_KEYS,
        `${value.reference_slot_key} same-field dependency keys`,
      );
    }

    const evidence = fixture.governedSources
      .agreementEvidenceByAgreementId[value.agreement_id];
    assert(evidence, value.agreement_id);
    const m2 = evidence.m2.record;
    const m3 = evidence.m3.record;
    const canonicalTextBytes = Buffer.from(
      m2.source_binding.canonical_text,
      'utf8',
    );
    assert.equal(
      canonicalTextBytes.byteLength,
      evidence.canonicalTextIdentity.canonical_text_byte_length,
    );
    assert.equal(
      sha256Hex(canonicalTextBytes),
      evidence.canonicalTextIdentity.canonical_text_sha256,
    );
    const occurrence = value.exact_terminal_source_occurrence;
    assertExactKeys(
      occurrence,
      TERMINATION_PHASE3_SOURCE_OCCURRENCE_KEYS,
      `${value.reference_slot_key} exact source occurrence keys`,
    );
    assertExactKeys(
      occurrence.m2_node,
      TERMINATION_PHASE3_M2_TARGET_KEYS,
      `${value.reference_slot_key} exact source occurrence M2 keys`,
    );
    assertExactKeys(
      occurrence.m2_node.extent_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} M2 extent span keys`,
    );
    assertExactKeys(
      occurrence.occurrence_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} occurrence span keys`,
    );
    const matchingNodes = m2.nodes.filter(
      (node) => node.node_occurrence_id
        === occurrence.m2_node.node_occurrence_id,
    );
    assert.equal(matchingNodes.length, 1);
    assert.deepEqual(occurrence.m2_node, {
      agreement_index_id: m2.agreement_index_id,
      extent_span: matchingNodes[0].extent_span,
      node_kind: matchingNodes[0].node_kind,
      node_occurrence_id: matchingNodes[0].node_occurrence_id,
      reference: matchingNodes[0].reference,
    });
    const closureMembers = terminal.source_closure.members.filter(
      (member) => member.node_occurrence_id
        === occurrence.m2_node.node_occurrence_id,
    );
    assert.equal(closureMembers.length, 1);
    assert.equal(closureMembers[0].closure_role, occurrence.source_closure_role);
    assert.equal(
      closureMembers[0].source_span.start_byte
        <= occurrence.occurrence_span.start_byte,
      true,
    );
    assert.equal(
      occurrence.occurrence_span.end_byte
        <= closureMembers[0].source_span.end_byte,
      true,
    );
    assert.equal(
      occurrence.m2_node.extent_span.start_byte
        <= occurrence.occurrence_span.start_byte,
      true,
    );
    assert.equal(
      occurrence.occurrence_span.end_byte
        <= occurrence.m2_node.extent_span.end_byte,
      true,
    );
    const occurrenceBytes = Buffer.from(occurrence.occurrence_text, 'utf8');
    assert.deepEqual(
      canonicalTextBytes.subarray(
        occurrence.occurrence_span.start_byte,
        occurrence.occurrence_span.end_byte,
      ),
      occurrenceBytes,
    );
    assert.equal(
      sha256Hex(occurrenceBytes),
      occurrence.occurrence_span.text_sha256,
    );

    assertExactKeys(
      value.source_support,
      TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
      `${value.reference_slot_key} source support keys`,
    );
    assertExactKeys(
      value.source_support.source_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      `${value.reference_slot_key} source support span keys`,
    );
    const expectedSupport = {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: occurrence.m2_node.node_occurrence_id,
      source_span: occurrence.occurrence_span,
      source_support_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: m2.agreement_index_id,
        source_node_occurrence_id: occurrence.m2_node.node_occurrence_id,
        start_byte: occurrence.occurrence_span.start_byte,
        end_byte: occurrence.occurrence_span.end_byte,
        text_sha256: occurrence.occurrence_span.text_sha256,
      }),
      source_text: occurrence.occurrence_text,
    };
    assert.deepEqual(value.source_support, expectedSupport);
    assert.equal(
      value.proposed_reference_target_string,
      occurrence.m2_node.node_occurrence_id,
    );
    assert.match(value.proposed_reference_target_string, /^[0-9a-f]{64}$/u);
    assertExactKeys(
      value.normalisation_proof,
      TERMINATION_PHASE3_SOURCE_OCCURRENCE_PROOF_KEYS,
      `${value.reference_slot_key} source-occurrence proof keys`,
    );
    assert.deepEqual(value.normalisation_proof, {
      input_source_span_ids: [expectedSupport.source_support_id],
      result_digest: sha256Hex(Buffer.from(
        canonicalJson(value.proposed_reference_target_string),
        'utf8',
      )),
      rule_id: 'SOURCE_OCCURRENCE_SELF_REFERENCE/V1',
    });

    for (const rejected of value.rejected_differently_named_owner_candidates) {
      assertExactKeys(
        rejected,
        TERMINATION_PHASE3_SOURCE_OCCURRENCE_DEPENDENCY_KEYS,
        `${value.reference_slot_key} rejected owner keys`,
      );
      const edges = m3.definition_edges.filter(
        (edge) => edge.definition_edge_id
          === rejected.native_m3_definition_edge_id,
      );
      assert.equal(edges.length, 1);
      assert.equal(edges[0].state, 'RESOLVED');
      assert.equal(edges[0].term, rejected.source_text);
      assert.deepEqual(
        edges[0].target_owner_node_occurrence_ids,
        [rejected.owner_node_occurrence_id],
      );
      assert.equal(
        rejected.resolution_state,
        'RESOLVED_NATIVE_M3_DEFINITION_EDGE',
      );
      assert.notEqual(
        rejected.owner_node_occurrence_id,
        occurrence.m2_node.node_occurrence_id,
      );
    }
  }

  assert.equal(reviewIds.size, 12);
  assert.equal(reviewSlotKeys.size, 12);
  assert.equal(descriptorIds.size, 12);
  assert.equal(proposedTargets.size, 11);
  assert.equal(supportIds.size, 11);
  assert.equal(rejectedOwnerCount, 18);
  assert.equal(nonemptyDependencyRows, 1);
  assert.deepEqual(Object.fromEntries(subclassCounts), {
    EXACT_EVENT_OR_REFERENCE_SOURCE_OCCURRENCE: 10,
    EXACT_SINGULAR_SOURCE_TERM_OCCURRENCE_WITH_PLURAL_ALIAS_WITHHELD: 2,
  });

  const singularContract = selfAuthority
    .source_occurrence_self_reference_value_contract
    .singular_source_phrase_contract;
  const singularValues = values.filter(
    (value) => value.occurrence_subclass
      === 'EXACT_SINGULAR_SOURCE_TERM_OCCURRENCE_WITH_PLURAL_ALIAS_WITHHELD',
  );
  assert.equal(singularValues.length, singularContract.exact_review_count);
  assert.deepEqual(
    singularValues.map((value) => value.reference_slot_key),
    singularContract.exact_reference_slot_keys,
  );
  singularValues.forEach((value) => {
    assert.equal(value.field_key, singularContract.exact_field_key);
    assert.equal(
      value.exact_terminal_source_occurrence.occurrence_text,
      singularContract.exact_occurrence_text,
    );
    assert.deepEqual(
      value.exact_terminal_source_occurrence.occurrence_span,
      singularContract.exact_occurrence_span,
    );
    assert.equal(
      value.proposed_reference_target_string,
      singularContract.exact_selected_occurrence_node_id,
    );
    assert.equal(
      value.source_support.source_support_id,
      singularContract.exact_source_support_id,
    );
    assert.deepEqual(value.exact_same_field_phase2_dependencies, []);
    assert.deepEqual(value.rejected_differently_named_owner_candidates, []);
  });

  const nonemptyRows = values.filter(
    (value) => value.exact_same_field_phase2_dependencies.length,
  );
  assert.equal(nonemptyRows.length, 1);
  const exactDependencyContract = selfAuthority
    .source_occurrence_self_reference_value_contract
    .exact_nonempty_dependency_contract;
  assert.equal(
    nonemptyRows[0].reference_slot_key,
    exactDependencyContract.exact_reference_slot_key,
  );
  const [exactDependency] = nonemptyRows[0]
    .exact_same_field_phase2_dependencies;
  assert.deepEqual(exactDependency, {
    field_key: exactDependencyContract.exact_field_key,
    native_m3_definition_edge_id:
      exactDependencyContract.exact_native_m3_definition_edge_id,
    owner_node_occurrence_id:
      exactDependencyContract.exact_owner_node_occurrence_id,
    resolution_state: exactDependencyContract.exact_resolution_state,
    source_text: exactDependencyContract.exact_source_text,
  });

  assert.deepEqual(
    result.source_occurrence_self_reference_value_contract,
    selfAuthority.candidate_output_contract
      .source_occurrence_self_reference_value_contract,
  );
  const valueBytes = Buffer.from(canonicalJson(values), 'utf8');
  assert.equal(
    valueBytes.byteLength,
    selfAuthority.source_occurrence_self_reference_value_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(valueBytes),
    selfAuthority.source_occurrence_self_reference_value_contract.sha256,
  );

  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 3);
  assert.deepEqual(
    remainingSlots,
    selfAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    selfAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(selfAuthority.remaining_unresolved_reference_slots),
    'candidate/authority source-occurrence remaining slot alias',
  );
  let precedingRemainingSlotIndex = -1;
  for (const slot of remainingSlots) {
    assertExactKeys(
      slot,
      selfAuthority.remaining_unresolved_reference_slot_contract
        .exact_member_keys,
      `${slot.reference_slot_key} source-occurrence remaining slot keys`,
    );
    const predecessorSlot = predecessorSlotByKey.get(slot.reference_slot_key);
    assert(predecessorSlot, slot.reference_slot_key);
    assert.equal(predecessorSlot.index > precedingRemainingSlotIndex, true);
    precedingRemainingSlotIndex = predecessorSlot.index;
    assert.deepEqual(slot, predecessorSlot.slot);
    assert.equal(reviewSlotKeys.has(slot.reference_slot_key), false);
    assert.equal(
      slot.reference_slot_key,
      contentId(
        selfAuthority.remaining_unresolved_reference_slot_contract
          .identity_domain,
        {
          profile_key: slot.profile_key,
          source_unit_key: slot.source_unit_key,
          field_key: slot.field_key,
        },
      ),
    );
  }
  assert.deepEqual(
    values.map((value) => value.reference_slot_key),
    predecessor.remaining_unresolved_reference_slots
      .filter((slot) => reviewSlotKeys.has(slot.reference_slot_key))
      .map((slot) => slot.reference_slot_key),
  );
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots.filter(
      (slot) => remainingSlotKeys.has(slot.reference_slot_key),
    ),
  );
  assert.equal(
    new Set([...reviewSlotKeys, ...remainingSlotKeys]).size,
    predecessor.remaining_unresolved_reference_slots.length,
  );
  predecessor.remaining_unresolved_reference_slots.forEach((slot) => {
    assert.equal(
      reviewSlotKeys.has(slot.reference_slot_key)
        || remainingSlotKeys.has(slot.reference_slot_key),
      true,
      slot.reference_slot_key,
    );
  });
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(
    remainingBytes.byteLength,
    selfAuthority.remaining_unresolved_reference_slot_contract
      .canonical_json_byte_length,
  );
  assert.equal(
    sha256Hex(remainingBytes),
    selfAuthority.remaining_unresolved_reference_slot_contract.sha256,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    selfAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );

  const collision = selfAuthority.collision_exclusion_contract;
  assert.equal(remainingSlotKeys.has(collision.reference_slot_key), true);
  assert.equal(reviewSlotKeys.has(collision.reference_slot_key), false);
  const collisionDescriptor = sourceDescriptorById.get(
    collision.source_normaliser_descriptor_id,
  );
  assert(collisionDescriptor, collision.source_normaliser_descriptor_id);
  assert.equal(
    collisionDescriptor.normaliser_kind,
    'EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE',
  );
  assert.deepEqual({
    reference_slot_key: collisionDescriptor.reference_slot_key,
    profile_key: collisionDescriptor.profile_key,
    source_unit_key: collisionDescriptor.source_unit_key,
    field_key: collisionDescriptor.field_key,
    agreement_id: collisionDescriptor.agreement_id,
  }, {
    reference_slot_key: collision.reference_slot_key,
    profile_key: collision.profile_key,
    source_unit_key: collision.source_unit_key,
    field_key: collision.field_key,
    agreement_id: collision.agreement_id,
  });
  assert.deepEqual(
    collisionDescriptor.normaliser_payload.exact_terminal_source_occurrence,
    collision.exact_terminal_source_occurrence,
  );
  assert.deepEqual(
    collisionDescriptor.normaliser_payload
      .rejected_differently_named_owner_candidates,
    [
      collision.colliding_rejected_owner_candidate,
      collision.separate_same_semantic_owner_candidate,
    ],
  );
  const collisionEvidence = fixture.governedSources
    .agreementEvidenceByAgreementId[collision.agreement_id];
  const collisionM2 = collisionEvidence.m2.record;
  const collisionM3 = collisionEvidence.m3.record;
  const collisionOccurrence = collision.exact_terminal_source_occurrence;
  const collisionNodes = collisionM2.nodes.filter(
    (node) => node.node_occurrence_id
      === collisionOccurrence.m2_node.node_occurrence_id,
  );
  assert.equal(collisionNodes.length, 1);
  assert.deepEqual(collisionOccurrence.m2_node, {
    agreement_index_id: collisionM2.agreement_index_id,
    extent_span: collisionNodes[0].extent_span,
    node_kind: collisionNodes[0].node_kind,
    node_occurrence_id: collisionNodes[0].node_occurrence_id,
    reference: collisionNodes[0].reference,
  });
  const collisionTextBytes = Buffer.from(
    collisionM2.source_binding.canonical_text,
    'utf8',
  );
  const collisionOccurrenceBytes = Buffer.from(
    collisionOccurrence.occurrence_text,
    'utf8',
  );
  assert.deepEqual(
    collisionTextBytes.subarray(
      collisionOccurrence.occurrence_span.start_byte,
      collisionOccurrence.occurrence_span.end_byte,
    ),
    collisionOccurrenceBytes,
  );
  assert.equal(
    sha256Hex(collisionOccurrenceBytes),
    collisionOccurrence.occurrence_span.text_sha256,
  );
  assert.equal(
    collision.colliding_rejected_owner_candidate.owner_node_occurrence_id,
    collisionOccurrence.m2_node.node_occurrence_id,
  );
  assert.notEqual(
    collision.separate_same_semantic_owner_candidate.owner_node_occurrence_id,
    collisionOccurrence.m2_node.node_occurrence_id,
  );
  for (const candidate of [
    collision.colliding_rejected_owner_candidate,
    collision.separate_same_semantic_owner_candidate,
  ]) {
    const edges = collisionM3.definition_edges.filter(
      (edge) => edge.definition_edge_id
        === candidate.native_m3_definition_edge_id,
    );
    assert.equal(edges.length, 1);
    assert.equal(edges[0].state, 'RESOLVED');
    assert.equal(edges[0].term, candidate.source_text);
    assert.deepEqual(
      edges[0].target_owner_node_occurrence_ids,
      [candidate.owner_node_occurrence_id],
    );
  }

  assertExactKeys(
    result.source_occurrence_self_reference_value_accounting,
    TERMINATION_PHASE3_SOURCE_OCCURRENCE_ACCOUNTING_KEYS,
    'source-occurrence self-reference value accounting keys',
  );
  assert.deepEqual(
    result.source_occurrence_self_reference_value_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_SOURCE_OCCURRENCE_ACCOUNTING_KEYS.map((key) => [
        key,
        selfAuthority.candidate_output_contract
          .source_occurrence_self_reference_value_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    selfAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    selfAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    selfAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  selfAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  selfAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
    );
  assert.equal(outputStrings.some((value) => value.includes('/tmp/')), false);
  const proposedValueOwners = [];
  const collectProposedValueOwners = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Object.hasOwn(value, 'proposed_reference_target_string')) {
      proposedValueOwners.push(value);
    }
    Object.values(value).forEach((child) => (
      collectProposedValueOwners(child, seen)
    ));
  };
  collectProposedValueOwners(result);
  assert.deepEqual(proposedValueOwners, values);

  const repeated = profileAuthoring
    .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated source-occurrence self-reference result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture =
    terminationPhase3SourceOccurrenceSelfReferenceValueFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
      frozenFixture,
    );
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);
  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(null)
    ));
    const extra =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
      'terminationPhase3RawM2ReferenceOwnerValueAuthority',
      'terminationPhase3LinkedRuleReferenceValueAuthority',
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing =
        forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
            missing,
          )
      ));
    }
  });

  await t.test('rejects self-reference authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_DRIFT';
    const absent =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    absent.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority = null;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(absent)
    ));

    const envelopeExtra =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    envelopeExtra.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
      .extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          envelopeExtra,
        )
    ));

    const bindingDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    bindingDrift.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          bindingDrift,
        )
    ));

    const recordDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    recordDrift.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
      .record = {
        ...structuredClone(selfAuthority),
        authority_state: 'DRIFTED',
      };
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          recordDrift,
        )
    ));

    const combined =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    combined.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
      .binding.record_id = '0'.repeat(64);
    combined.terminationPhase3RawM2ReferenceOwnerValueAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3LinkedRuleReferenceValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(combined)
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', () => {
    const rawDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    rawDrift.terminationPhase3RawM2ReferenceOwnerValueAuthority.binding.sha256 =
      '0'.repeat(64);
    rawDrift.terminationPhase3LinkedRuleReferenceValueAuthority.binding.sha256 =
      '0'.repeat(64);
    rawDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    rawDrift.terminationPhase3ReferenceSourceNormaliserAuthority.binding.sha256 =
      '0'.repeat(64);
    rawDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    rawDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    rawDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete rawDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(rawDrift),
    );

    const linkedDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    linkedDrift.terminationPhase3LinkedRuleReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    linkedDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    linkedDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    linkedDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    linkedDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    linkedDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete linkedDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          linkedDrift,
        ),
    );

    const edgeDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    edgeDrift.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3ReferenceSourceNormaliserAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    edgeDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    edgeDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete edgeDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(edgeDrift),
    );

    const sourceDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    sourceDrift.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    sourceDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    sourceDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete sourceDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          sourceDrift,
        ),
    );

    const targetDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    targetDrift.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    targetDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    targetDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete targetDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          targetDrift,
        ),
    );

    const reviewDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    reviewDrift.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    reviewDrift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete reviewDrift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          reviewDrift,
        ),
    );

    const phase2Drift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    phase2Drift.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete phase2Drift.governedSources.baseContractPolicy;
    expectCode(
      'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      () => profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          phase2Drift,
        ),
    );
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_SOURCE_COVERAGE';
    const extraGoverned =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          extraGoverned,
        )
    ));

    const missingGoverned =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          missingGoverned,
        )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift =
        forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(drift)
      ));
    }

    const [agreementId] = Object.keys(
      fixture.governedSources.agreementEvidenceByAgreementId,
    );
    const canonicalTextDrift =
      forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      agreementId,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(
          canonicalTextDrift,
        )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift =
        forkTerminationPhase3SourceOccurrenceSelfReferenceValueFixture(fixture);
      const agreementEvidence = forkTerminationAgreementEvidence(
        drift,
        agreementId,
      );
      forkTerminationSourceEnvelope(agreementEvidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate(drift)
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 source-occurrence self-reference values preserve twelve exact Termination source owners without Work3 materialisation',
  );
});

test('Phase3 agreement-date source-pair reference value preserves one exact Termination date owner without Work3 materialisation', async (t) => {
  assert.equal(
    typeof profileAuthoring
      .prepareTerminationAgreementDateSourcePairReferenceValueCandidate,
    'function',
  );

  const fixture = terminationPhase3AgreementDateSourcePairReferenceValueFixture();
  const dateEnvelope =
    fixture.terminationPhase3AgreementDateSourcePairReferenceValueAuthority;
  const dateAuthority = dateEnvelope.record;
  const selfEnvelope =
    fixture.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority;
  const rawEnvelope = fixture.terminationPhase3RawM2ReferenceOwnerValueAuthority;
  const linkedEnvelope =
    fixture.terminationPhase3LinkedRuleReferenceValueAuthority;
  const edgeEnvelope = fixture.terminationPhase3ReferenceEdgeValueAuthority;
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(dateAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(dateAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_agreement_date_source_pair_reference_value_authority_id;
  assert.equal(
    dateAuthority
      .termination_authoring_phase3_agreement_date_source_pair_reference_value_authority_id,
    contentId(dateAuthority.schema_version, unsignedAuthority),
  );

  const predecessor = profileAuthoring
    .prepareTerminationSourceOccurrenceSelfReferenceValueCandidate({
      terminationPhase3SourceOccurrenceSelfReferenceValueAuthority:
        selfEnvelope,
      terminationPhase3RawM2ReferenceOwnerValueAuthority: rawEnvelope,
      terminationPhase3LinkedRuleReferenceValueAuthority: linkedEnvelope,
      terminationPhase3ReferenceEdgeValueAuthority: edgeEnvelope,
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  assert.equal(
    predecessor.source_occurrence_self_reference_value_candidate_id,
    contentId(
      predecessor.schema_version,
      sourceOccurrenceSelfReferenceValueCandidateUnsignedRecord(predecessor),
    ),
  );
  assert.equal(
    predecessor.source_occurrence_self_reference_value_candidate_id,
    'c4ec884883fe8062a5fabb72e78313242c56ea13fb8e025f1d1c3e3ac499936a',
  );
  const predecessorBinding = {
    schema_version: predecessor.schema_version,
    source_occurrence_self_reference_value_candidate_id:
      predecessor.source_occurrence_self_reference_value_candidate_id,
    source_occurrence_self_reference_value_count:
      predecessor.source_occurrence_self_reference_value_accounting
        .source_occurrence_self_reference_value_count,
    remaining_source_normaliser_descriptor_count:
      predecessor.source_occurrence_self_reference_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_source_admission_gap_count:
      predecessor.source_occurrence_self_reference_value_accounting
        .remaining_source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      predecessor.source_occurrence_self_reference_value_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  };
  assertExactKeys(
    predecessorBinding,
    dateAuthority.candidate_output_contract
      .predecessor_source_occurrence_self_reference_value_candidate_binding_exact_keys,
    'agreement-date predecessor binding keys',
  );
  assert.deepEqual(
    predecessorBinding,
    dateAuthority.predecessor_source_occurrence_self_reference_value_candidate_binding,
  );

  const result = profileAuthoring
    .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(fixture);
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'agreement-date result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(predecessor),
    'agreement-date result/predecessor alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_CANDIDATE_KEYS,
    'Phase3 agreement-date source-pair reference value candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
  });
  assert.equal(
    result.agreement_date_source_pair_reference_value_candidate_id,
    contentId(
      result.schema_version,
      agreementDateSourcePairReferenceValueCandidateUnsignedRecord(result),
    ),
  );
  assert.deepEqual(result.phase2_authority_binding, phase2Envelope.binding);
  assert.deepEqual(result.phase2_proposal_binding, predecessor.phase2_proposal_binding);
  assert.deepEqual(result.phase2_proposal_binding, dateAuthority.phase2_proposal_binding);
  assert.deepEqual(
    result.phase3_reference_review_authority_binding,
    reviewEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_target_evidence_authority_binding,
    targetEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_source_normaliser_authority_binding,
    sourceEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_reference_edge_value_authority_binding,
    edgeEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_linked_rule_reference_value_authority_binding,
    linkedEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_raw_m2_reference_owner_value_authority_binding,
    rawEnvelope.binding,
  );
  assert.deepEqual(
    result.phase3_source_occurrence_self_reference_value_authority_binding,
    selfEnvelope.binding,
  );
  assert.deepEqual(
    result.predecessor_source_occurrence_self_reference_value_candidate_binding,
    predecessorBinding,
  );
  assert.deepEqual(
    result.phase3_agreement_date_source_pair_reference_value_authority_binding,
    dateEnvelope.binding,
  );
  for (const [label, binding] of [
    ['Phase2', result.phase2_authority_binding],
    ['Phase3 review', result.phase3_reference_review_authority_binding],
    ['Phase3 target evidence', result.phase3_target_evidence_authority_binding],
    ['Phase3 source normaliser', result.phase3_source_normaliser_authority_binding],
    ['Phase3 reference edge value', result.phase3_reference_edge_value_authority_binding],
    ['Phase3 linked-rule reference value',
      result.phase3_linked_rule_reference_value_authority_binding],
    ['Phase3 raw-M2 reference owner value',
      result.phase3_raw_m2_reference_owner_value_authority_binding],
    ['Phase3 source-occurrence self-reference value',
      result.phase3_source_occurrence_self_reference_value_authority_binding],
    ['Phase3 agreement-date source-pair reference value',
      result.phase3_agreement_date_source_pair_reference_value_authority_binding],
  ]) {
    assertExactKeys(
      binding,
      dateAuthority.candidate_output_contract.authority_binding_exact_keys,
      `${label} authority binding keys`,
    );
  }
  assertExactKeys(
    result.phase2_proposal_binding,
    dateAuthority.candidate_output_contract.phase2_proposal_binding_exact_keys,
    'agreement-date Phase2 proposal binding keys',
  );

  const sourceCandidate = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate({
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  const values = result.agreement_date_source_pair_reference_values;
  assert.equal(values.length, 1);
  assert.deepEqual(values, dateAuthority.agreement_date_source_pair_reference_values);
  assert.notStrictEqual(values, dateAuthority.agreement_date_source_pair_reference_values);
  assertDisjoint(
    collectObjectIdentities(values),
    collectObjectIdentities(dateAuthority.agreement_date_source_pair_reference_values),
    'candidate/authority agreement-date value alias',
  );
  const value = values[0];
  assertExactKeys(
    value,
    TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_KEYS,
    'agreement-date value keys',
  );
  assertExactKeys(
    value.canonical_preamble_date_occurrence,
    TERMINATION_PHASE3_AGREEMENT_DATE_PREAMBLE_OCCURRENCE_KEYS,
    'agreement-date preamble occurrence keys',
  );
  assertExactKeys(
    value.terminal_source_occurrence,
    TERMINATION_PHASE3_AGREEMENT_DATE_TERMINAL_OCCURRENCE_KEYS,
    'agreement-date terminal occurrence keys',
  );
  for (const occurrence of [
    value.canonical_preamble_date_occurrence,
    value.terminal_source_occurrence,
  ]) {
    assertExactKeys(
      occurrence.m2_node,
      TERMINATION_PHASE3_M2_TARGET_KEYS,
      'agreement-date M2 node keys',
    );
    assertExactKeys(
      occurrence.m2_node.extent_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'agreement-date M2 extent keys',
    );
    assertExactKeys(
      occurrence.occurrence_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'agreement-date occurrence span keys',
    );
  }
  for (const support of [
    value.preamble_date_source_support,
    value.terminal_date_reference_source_support,
  ]) {
    assertExactKeys(
      support,
      TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
      'agreement-date source support keys',
    );
    assertExactKeys(
      support.source_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'agreement-date source support span keys',
    );
  }
  assertExactKeys(
    value.normalisation_proof,
    TERMINATION_PHASE3_AGREEMENT_DATE_NORMALISATION_PROOF_KEYS,
    'agreement-date proof keys',
  );
  assertExactKeys(
    value.same_node_defined_term_owner_reuse_exception,
    TERMINATION_PHASE3_AGREEMENT_DATE_SAME_NODE_EXCEPTION_KEYS,
    'agreement-date same-node exception keys',
  );
  const unsignedValue = structuredClone(value);
  delete unsignedValue
    .agreement_date_source_pair_reference_target_string_review_id;
  assert.equal(
    value.agreement_date_source_pair_reference_target_string_review_id,
    contentId(
      dateAuthority.agreement_date_source_pair_reference_value_contract
        .identity_domain,
      unsignedValue,
    ),
  );
  assert.deepEqual({
    value_type: value.value_type,
    normalisation_rule_id: value.normalisation_rule_id,
    date_pair_subclass: value.date_pair_subclass,
    materialisation_state: value.materialisation_state,
    normaliser_requirement: value.normaliser_requirement,
    work3_fixture_consumable_value_shape:
      value.work3_fixture_consumable_value_shape,
  }, {
    value_type: 'REFERENCE',
    normalisation_rule_id: 'AGREEMENT_DATE_SOURCE_PAIR_REFERENCE/V1',
    date_pair_subclass: 'EXACT_SYMBOLIC_AGREEMENT_DATE_SOURCE_PAIR',
    materialisation_state:
      'REVIEW_ONLY_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
    normaliser_requirement:
      'TECHNICAL_SYMBOLIC_AGREEMENT_DATE_NORMALISER_REQUIRED_TARGET_STRING_WITHHELD',
    work3_fixture_consumable_value_shape: false,
  });
  assert.equal(Object.hasOwn(value, 'projected_context_edge'), false);

  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map(
      (slot, index) => [slot.reference_slot_key, { slot, index }],
    ),
  );
  const selectedSlot = predecessorSlotByKey.get(value.reference_slot_key);
  assert(selectedSlot, value.reference_slot_key);
  assert.deepEqual({
    profile_key: value.profile_key,
    source_unit_key: value.source_unit_key,
    field_key: value.field_key,
  }, {
    profile_key: selectedSlot.slot.profile_key,
    source_unit_key: selectedSlot.slot.source_unit_key,
    field_key: selectedSlot.slot.field_key,
  });
  assert.deepEqual(
    values.map((row) => row.reference_slot_key),
    predecessor.remaining_unresolved_reference_slots
      .filter((slot) => slot.reference_slot_key === value.reference_slot_key)
      .map((slot) => slot.reference_slot_key),
  );

  const descriptor = sourceCandidate.source_normaliser_descriptors.find(
    (row) => row.source_normaliser_descriptor_id
      === value.source_normaliser_descriptor_id,
  );
  assert(descriptor, value.source_normaliser_descriptor_id);
  assert.equal(
    descriptor.normaliser_kind,
    'EXACT_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_EVIDENCE',
  );
  assert.deepEqual({
    reference_slot_key: descriptor.reference_slot_key,
    profile_key: descriptor.profile_key,
    source_unit_key: descriptor.source_unit_key,
    field_key: descriptor.field_key,
    agreement_id: descriptor.agreement_id,
  }, {
    reference_slot_key: value.reference_slot_key,
    profile_key: value.profile_key,
    source_unit_key: value.source_unit_key,
    field_key: value.field_key,
    agreement_id: value.agreement_id,
  });
  assert.deepEqual(
    descriptor.normaliser_payload.canonical_preamble_date_occurrence,
    value.canonical_preamble_date_occurrence,
  );
  assert.deepEqual(
    descriptor.normaliser_payload.terminal_source_occurrence,
    value.terminal_source_occurrence,
  );
  assert.equal(
    descriptor.normaliser_payload.normaliser_requirement,
    value.normaliser_requirement,
  );
  assert.equal(
    descriptor.normaliser_payload.occurrence_subclass,
    value.date_pair_subclass,
  );

  const terminal = jsonPointerValue(
    phase2Authority,
    descriptor.phase2_terminal_contract_path,
  );
  assert.equal(terminal.source_unit_key, value.source_unit_key);
  assert.equal(terminal.agreement_id, value.agreement_id);
  const sameFieldUnresolvedDependencies = Object.values(
    terminal.dependency_contracts,
  ).flat().filter((dependency) => (
    dependency.field_key === value.field_key
    && String(dependency.resolution_state).includes('UNRESOLVED')
  ));
  assert.deepEqual(
    value.exact_same_field_phase2_dependencies,
    sameFieldUnresolvedDependencies,
  );
  assert.deepEqual(value.exact_same_field_phase2_dependencies, []);

  const agreementEvidence = fixture.governedSources
    .agreementEvidenceByAgreementId[value.agreement_id];
  assert(agreementEvidence, value.agreement_id);
  const m2 = agreementEvidence.m2.record;
  const m3 = agreementEvidence.m3.record;
  const canonicalTextBytes = Buffer.from(m2.source_binding.canonical_text, 'utf8');
  assert.equal(
    canonicalTextBytes.byteLength,
    agreementEvidence.canonicalTextIdentity.canonical_text_byte_length,
  );
  assert.equal(
    sha256Hex(canonicalTextBytes),
    agreementEvidence.canonicalTextIdentity.canonical_text_sha256,
  );
  const projectM2Node = (node) => ({
    agreement_index_id: m2.agreement_index_id,
    extent_span: node.extent_span,
    node_kind: node.node_kind,
    node_occurrence_id: node.node_occurrence_id,
    reference: node.reference,
  });
  const preambleOccurrence = value.canonical_preamble_date_occurrence;
  const terminalOccurrence = value.terminal_source_occurrence;
  const preambleNodes = m2.nodes.filter(
    (node) => node.node_occurrence_id
      === preambleOccurrence.m2_node.node_occurrence_id,
  );
  const terminalNodes = m2.nodes.filter(
    (node) => node.node_occurrence_id
      === terminalOccurrence.m2_node.node_occurrence_id,
  );
  assert.equal(preambleNodes.length, 1);
  assert.equal(terminalNodes.length, 1);
  const preambleNode = preambleNodes[0];
  const terminalNode = terminalNodes[0];
  assert.deepEqual(preambleOccurrence.m2_node, projectM2Node(preambleNode));
  assert.deepEqual(terminalOccurrence.m2_node, projectM2Node(terminalNode));
  for (const [occurrence, node] of [
    [preambleOccurrence, preambleNode],
    [terminalOccurrence, terminalNode],
  ]) {
    assert.equal(
      occurrence.occurrence_span.start_byte >= node.extent_span.start_byte,
      true,
    );
    assert.equal(
      occurrence.occurrence_span.end_byte <= node.extent_span.end_byte,
      true,
    );
    const occurrenceBytes = Buffer.from(occurrence.occurrence_text, 'utf8');
    assert.deepEqual(
      canonicalTextBytes.subarray(
        occurrence.occurrence_span.start_byte,
        occurrence.occurrence_span.end_byte,
      ),
      occurrenceBytes,
    );
    assert.equal(
      sha256Hex(occurrenceBytes),
      occurrence.occurrence_span.text_sha256,
    );
  }
  const closureMembers = terminal.source_closure.members.filter(
    (member) => member.node_occurrence_id
      === terminalOccurrence.m2_node.node_occurrence_id,
  );
  assert.equal(closureMembers.length, 1);
  assert.equal(
    closureMembers[0].closure_role,
    terminalOccurrence.source_closure_role,
  );
  assert.equal(
    closureMembers[0].source_span.start_byte
      <= terminalOccurrence.occurrence_span.start_byte,
    true,
  );
  assert.equal(
    terminalOccurrence.occurrence_span.end_byte
      <= closureMembers[0].source_span.end_byte,
    true,
  );

  const preambleBytes = Buffer.from(preambleOccurrence.occurrence_text, 'utf8');
  assert.equal(
    canonicalTextBytes.indexOf(preambleBytes),
    preambleOccurrence.occurrence_span.start_byte,
  );
  assert.equal(
    canonicalTextBytes.indexOf(
      preambleBytes,
      preambleOccurrence.occurrence_span.start_byte + 1,
    ),
    -1,
  );
  assert.match(
    preambleOccurrence.occurrence_text,
    /^dated as of [A-Z][a-z]+ [0-9]{1,2}, [0-9]{4}$/,
  );
  const terminalNodeBytes = canonicalTextBytes.subarray(
    terminalNode.extent_span.start_byte,
    terminalNode.extent_span.end_byte,
  );
  const terminalTextBytes = Buffer.from(terminalOccurrence.occurrence_text, 'utf8');
  const terminalRelativeStart = terminalOccurrence.occurrence_span.start_byte
    - terminalNode.extent_span.start_byte;
  assert.equal(terminalNodeBytes.indexOf(terminalTextBytes), terminalRelativeStart);
  assert.equal(
    terminalNodeBytes.indexOf(terminalTextBytes, terminalRelativeStart + 1),
    -1,
  );

  const expectedSupport = (node, span, sourceText) => ({
    agreement_index_id: m2.agreement_index_id,
    source_node_occurrence_id: node.node_occurrence_id,
    source_span: span,
    source_support_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: node.node_occurrence_id,
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      text_sha256: span.text_sha256,
    }),
    source_text: sourceText,
  });
  assert.deepEqual(
    value.preamble_date_source_support,
    expectedSupport(
      preambleNode,
      preambleOccurrence.occurrence_span,
      preambleOccurrence.occurrence_text,
    ),
  );
  assert.deepEqual(
    value.terminal_date_reference_source_support,
    expectedSupport(
      terminalNode,
      terminalOccurrence.occurrence_span,
      terminalOccurrence.occurrence_text,
    ),
  );
  assert.deepEqual(value.normalisation_proof, {
    input_preamble_date_source_span_ids: [
      value.preamble_date_source_support.source_support_id,
    ],
    input_terminal_reference_source_span_ids: [
      value.terminal_date_reference_source_support.source_support_id,
    ],
    result_digest: sha256Hex(
      Buffer.from(canonicalJson(value.proposed_reference_target_string), 'utf8'),
    ),
    rule_id: 'AGREEMENT_DATE_SOURCE_PAIR_REFERENCE/V1',
  });
  assert.equal(
    value.proposed_reference_target_string,
    preambleNode.node_occurrence_id,
  );

  const exception = value.same_node_defined_term_owner_reuse_exception;
  const annotations = m2.annotations.filter(
    (annotation) => annotation.annotation_occurrence_id
      === exception.selected_definition_annotation_occurrence_id,
  );
  assert.equal(annotations.length, 1);
  const annotation = annotations[0];
  assert.deepEqual(annotation, {
    annotation_kind: 'DEFINED_TERM_DEFINITION',
    annotation_occurrence_id:
      '0f8b64a65357064ea9b39ce964998b5343f5e3725109703fccdcfb748a7be5f5',
    owner_node_occurrence_id: preambleNode.node_occurrence_id,
    roles: ['DEFINED_TERM'],
    schema_version: 'AGREEMENT_SOURCE_ANNOTATION/V1',
    span: {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      end_byte: 6740,
      start_byte: 6727,
      text_sha256:
        'ba03443b2c09782367ec735a5b0f9707866821994a785fa329ea0a4abb7ecceb',
    },
    value: 'Company',
  });
  const annotationBytes = canonicalTextBytes.subarray(
    annotation.span.start_byte,
    annotation.span.end_byte,
  );
  assert.equal(annotationBytes.toString('utf8'), '“Company”');
  assert.equal(sha256Hex(annotationBytes), annotation.span.text_sha256);
  const companyEdges = m3.definition_edges.filter(
    (edge) => edge.term === 'Company' && edge.state === 'RESOLVED',
  );
  assert.equal(companyEdges.length, 814);
  companyEdges.forEach((edge) => {
    assert.equal(
      edge.selected_definition_annotation_occurrence_id,
      annotation.annotation_occurrence_id,
    );
    assert.deepEqual(
      edge.target_definition_annotation_occurrence_ids,
      [annotation.annotation_occurrence_id],
    );
    assert.deepEqual(
      edge.target_owner_node_occurrence_ids,
      [preambleNode.node_occurrence_id],
    );
  });
  assert.deepEqual(exception, {
    defined_term: 'Company',
    disposition:
      'EXACT_REVIEW_ONLY_AGREEMENT_DATE_SOURCE_PAIR_REUSE_PERMITTED_ONLY_WITH_BOTH_BOUND_SPANS_AND_FIELD_KEY_WORK3_REFERENCE_VALUE_WITHHELD',
    exact_resolved_definition_edge_count: 814,
    owner_node_occurrence_id: preambleNode.node_occurrence_id,
    selected_definition_annotation_occurrence_id:
      annotation.annotation_occurrence_id,
    work3_reference_value_materialisation_withheld: true,
  });

  const selectedSlotKeys = new Set(values.map((row) => row.reference_slot_key));
  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 2);
  assert.deepEqual(remainingSlots, dateAuthority.remaining_unresolved_reference_slots);
  assert.notStrictEqual(remainingSlots, dateAuthority.remaining_unresolved_reference_slots);
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(dateAuthority.remaining_unresolved_reference_slots),
    'candidate/authority agreement-date remaining-slot alias',
  );
  remainingSlots.forEach((slot) => {
    assertExactKeys(
      slot,
      dateAuthority.remaining_unresolved_reference_slot_contract
        .exact_member_keys,
      `${slot.reference_slot_key} agreement-date remaining-slot keys`,
    );
    assert.equal(
      contentId(
        dateAuthority.remaining_unresolved_reference_slot_contract
          .identity_domain,
        {
          profile_key: slot.profile_key,
          source_unit_key: slot.source_unit_key,
          field_key: slot.field_key,
        },
      ),
      slot.reference_slot_key,
    );
  });
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  assert.equal(
    new Set([...selectedSlotKeys, ...remainingSlotKeys]).size,
    predecessor.remaining_unresolved_reference_slots.length,
  );
  predecessor.remaining_unresolved_reference_slots.forEach((slot) => {
    assert.equal(
      selectedSlotKeys.has(slot.reference_slot_key)
        || remainingSlotKeys.has(slot.reference_slot_key),
      true,
      slot.reference_slot_key,
    );
  });
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots.filter(
      (slot) => remainingSlotKeys.has(slot.reference_slot_key),
    ),
  );
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(remainingBytes.byteLength, 1108);
  assert.equal(
    sha256Hex(remainingBytes),
    '578bd53e8844ecc59fe1528b27aa82964dd9f84b07a37e25583dc423509eb682',
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    dateAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );

  assertExactKeys(
    result.agreement_date_source_pair_reference_value_accounting,
    TERMINATION_PHASE3_AGREEMENT_DATE_ACCOUNTING_KEYS,
    'agreement-date accounting keys',
  );
  assert.deepEqual(
    result.agreement_date_source_pair_reference_value_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_AGREEMENT_DATE_ACCOUNTING_KEYS.map((key) => [
        key,
        dateAuthority.candidate_output_contract
          .agreement_date_source_pair_reference_value_accounting[key],
      ]),
    ),
  );
  assert.deepEqual(
    result.agreement_date_source_pair_reference_value_contract,
    dateAuthority.candidate_output_contract
      .agreement_date_source_pair_reference_value_contract,
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    dateAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    dateAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    dateAuthority.candidate_output_contract.zero_effect_boundary,
  );
  const outputKeys = collectKeys(result);
  dateAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  dateAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
    );
  assert.equal(outputStrings.some((entry) => entry.includes('/tmp/')), false);
  const proposedValueOwners = [];
  const collectProposedValueOwners = (current, seen = new Set()) => {
    if (!current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);
    if (Object.hasOwn(current, 'proposed_reference_target_string')) {
      proposedValueOwners.push(current);
    }
    Object.values(current).forEach((child) => (
      collectProposedValueOwners(child, seen)
    ));
  };
  collectProposedValueOwners(result);
  assert.deepEqual(proposedValueOwners, values);

  const repeated = profileAuthoring
    .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(fixture);
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated agreement-date result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture =
    terminationPhase3AgreementDateSourcePairReferenceValueFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
      frozenFixture,
    );
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(null)
    ));
    const extra =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(extra)
    ));
    for (const key of [
      'terminationPhase3AgreementDateSourcePairReferenceValueAuthority',
      'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
      'terminationPhase3RawM2ReferenceOwnerValueAuthority',
      'terminationPhase3LinkedRuleReferenceValueAuthority',
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing =
        forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(
          fixture,
        );
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
            missing,
          )
      ));
    }
  });

  await t.test('rejects agreement-date authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_DRIFT';
    const absent =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    absent.terminationPhase3AgreementDateSourcePairReferenceValueAuthority = null;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          absent,
        )
    ));

    const envelopeExtra =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    envelopeExtra.terminationPhase3AgreementDateSourcePairReferenceValueAuthority
      .extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          envelopeExtra,
        )
    ));

    const bindingDrift =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    bindingDrift.terminationPhase3AgreementDateSourcePairReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          bindingDrift,
        )
    ));

    const recordDrift =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    recordDrift.terminationPhase3AgreementDateSourcePairReferenceValueAuthority
      .record = {
        ...structuredClone(dateAuthority),
        authority_state: 'DRIFTED',
      };
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          recordDrift,
        )
    ));

    const combined =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    combined.terminationPhase3AgreementDateSourcePairReferenceValueAuthority
      .binding.record_id = '0'.repeat(64);
    combined.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3RawM2ReferenceOwnerValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3LinkedRuleReferenceValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          combined,
        )
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', async (st) => {
    const authorityPrecedence = [
      {
        name: 'source-occurrence self-reference value',
        key: 'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'raw-M2 reference owner value',
        key: 'terminationPhase3RawM2ReferenceOwnerValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'linked-rule reference value',
        key: 'terminationPhase3LinkedRuleReferenceValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'reference edge value',
        key: 'terminationPhase3ReferenceEdgeValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'reference source normaliser',
        key: 'terminationPhase3ReferenceSourceNormaliserAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
      },
      {
        name: 'reference target evidence',
        key: 'terminationPhase3TargetEvidenceAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      },
      {
        name: 'reference review',
        key: 'terminationPhase3ReviewAuthority',
        code: 'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      },
      {
        name: 'Phase2',
        key: 'terminationAuthoringPhase2Authority',
        code: 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      },
    ];
    for (let index = 0; index < authorityPrecedence.length; index += 1) {
      const current = authorityPrecedence[index];
      await st.test(current.name, () => {
        const drift =
          forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(
            fixture,
          );
        authorityPrecedence.slice(index).forEach(({ key }) => {
          drift[key].binding.sha256 = '0'.repeat(64);
        });
        delete drift.governedSources.baseContractPolicy;
        expectCode(current.code, () => (
          profileAuthoring
            .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
              drift,
            )
        ));
      });
    }
  });

  await t.test('rejects governed source and agreement proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_SOURCE_COVERAGE';
    const extraGoverned =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          extraGoverned,
        )
    ));

    const missingGoverned =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          missingGoverned,
        )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift =
        forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(
          fixture,
        );
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
            drift,
          )
      ));
    }

    const canonicalTextDrift =
      forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(fixture);
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      value.agreement_id,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
          canonicalTextDrift,
        )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift =
        forkTerminationPhase3AgreementDateSourcePairReferenceValueFixture(
          fixture,
        );
      const evidence = forkTerminationAgreementEvidence(
        drift,
        value.agreement_id,
      );
      forkTerminationSourceEnvelope(evidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
            drift,
          )
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 agreement-date source-pair reference value preserves one exact Termination date owner without Work3 materialisation',
  );
});

test('Phase3 Company Stockholders Meeting event reference value preserves the approved exact Termination owner without Work3 materialisation', async (t) => {
  assert.equal(
    typeof profileAuthoring
      .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate,
    'function',
  );

  const fixture =
    terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture();
  const meetingEnvelope = fixture
    .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority;
  const meetingAuthority = meetingEnvelope.record;
  const dateEnvelope =
    fixture.terminationPhase3AgreementDateSourcePairReferenceValueAuthority;
  const selfEnvelope =
    fixture.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority;
  const rawEnvelope = fixture.terminationPhase3RawM2ReferenceOwnerValueAuthority;
  const linkedEnvelope = fixture.terminationPhase3LinkedRuleReferenceValueAuthority;
  const edgeEnvelope = fixture.terminationPhase3ReferenceEdgeValueAuthority;
  const sourceEnvelope =
    fixture.terminationPhase3ReferenceSourceNormaliserAuthority;
  const targetEnvelope = fixture.terminationPhase3TargetEvidenceAuthority;
  const reviewEnvelope = fixture.terminationPhase3ReviewAuthority;
  const phase2Envelope = fixture.terminationAuthoringPhase2Authority;
  const phase2Authority = phase2Envelope.record;
  const before = fixtureFingerprint(fixture);
  assertRecursivelyUnfrozen(fixture);

  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(meetingAuthority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(meetingAuthority);
  delete unsignedAuthority
    .termination_authoring_phase3_company_stockholders_meeting_event_reference_value_authority_id;
  assert.equal(
    meetingAuthority
      .termination_authoring_phase3_company_stockholders_meeting_event_reference_value_authority_id,
    contentId(meetingAuthority.schema_version, unsignedAuthority),
  );
  assert.deepEqual(
    meetingAuthority.candidate_output_contract.exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CANDIDATE_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .exact_member_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .approved_event_defined_term_mapping_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_MAPPING_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .defined_term_owner_projection_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_OWNER_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .definition_occurrence_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINITION_OCCURRENCE_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .definition_annotation_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINITION_ANNOTATION_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .terminal_source_occurrence_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_TERMINAL_OCCURRENCE_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .native_m3_definition_edge_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_M3_EDGE_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.company_stockholders_meeting_event_reference_value_contract
      .normalisation_proof_exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_PROOF_KEYS,
  );
  assert.deepEqual(
    meetingAuthority.candidate_output_contract
      .company_stockholders_meeting_event_reference_value_accounting.exact_keys,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_ACCOUNTING_KEYS,
  );

  const predecessorInput = {
    terminationPhase3AgreementDateSourcePairReferenceValueAuthority:
      dateEnvelope,
    terminationPhase3SourceOccurrenceSelfReferenceValueAuthority: selfEnvelope,
    terminationPhase3RawM2ReferenceOwnerValueAuthority: rawEnvelope,
    terminationPhase3LinkedRuleReferenceValueAuthority: linkedEnvelope,
    terminationPhase3ReferenceEdgeValueAuthority: edgeEnvelope,
    terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
    terminationPhase3TargetEvidenceAuthority: targetEnvelope,
    terminationPhase3ReviewAuthority: reviewEnvelope,
    terminationAuthoringPhase2Authority: phase2Envelope,
    governedSources: fixture.governedSources,
  };
  const predecessor = profileAuthoring
    .prepareTerminationAgreementDateSourcePairReferenceValueCandidate(
      predecessorInput,
    );
  assert.equal(
    predecessor.agreement_date_source_pair_reference_value_candidate_id,
    contentId(
      predecessor.schema_version,
      agreementDateSourcePairReferenceValueCandidateUnsignedRecord(predecessor),
    ),
  );
  assert.equal(
    predecessor.agreement_date_source_pair_reference_value_candidate_id,
    '7c8fa69e41b570a1ecbbd6c320857bdb98d6ace286323f624ae961c7c176be86',
  );
  const predecessorBinding = {
    schema_version: predecessor.schema_version,
    agreement_date_source_pair_reference_value_candidate_id:
      predecessor.agreement_date_source_pair_reference_value_candidate_id,
    agreement_date_source_pair_reference_value_count:
      predecessor.agreement_date_source_pair_reference_value_accounting
        .agreement_date_source_pair_reference_value_count,
    remaining_source_normaliser_descriptor_count:
      predecessor.agreement_date_source_pair_reference_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_source_admission_gap_count:
      predecessor.agreement_date_source_pair_reference_value_accounting
        .remaining_source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      predecessor.agreement_date_source_pair_reference_value_accounting
        .remaining_unresolved_reference_slot_count,
    remaining_unresolved_reference_slot_sha256:
      predecessor.remaining_unresolved_reference_slot_contract.sha256,
  };
  assertExactKeys(
    predecessorBinding,
    meetingAuthority.candidate_output_contract
      .predecessor_agreement_date_source_pair_reference_value_candidate_binding_exact_keys,
    'meeting-event predecessor binding keys',
  );
  assert.deepEqual(
    predecessorBinding,
    meetingAuthority
      .predecessor_agreement_date_source_pair_reference_value_candidate_binding,
  );

  const result = profileAuthoring
    .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
      fixture,
    );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'meeting-event result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(predecessor),
    'meeting-event result/predecessor alias',
  );
  assertExactKeys(
    result,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CANDIDATE_KEYS,
    'Phase3 Company Stockholders Meeting event reference value candidate keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    candidate_state: result.candidate_state,
  }, {
    schema_version:
      'M7_V2_TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CANDIDATE/V1',
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINED_TERM_OWNER_REFERENCE_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
  });
  assert.equal(
    result.company_stockholders_meeting_event_reference_value_candidate_id,
    contentId(
      result.schema_version,
      companyStockholdersMeetingEventReferenceValueCandidateUnsignedRecord(
        result,
      ),
    ),
  );

  const authorityBindings = [
    ['Phase2', 'phase2_authority_binding', phase2Envelope],
    ['Phase3 review', 'phase3_reference_review_authority_binding', reviewEnvelope],
    ['Phase3 target evidence', 'phase3_target_evidence_authority_binding', targetEnvelope],
    ['Phase3 source normaliser', 'phase3_source_normaliser_authority_binding', sourceEnvelope],
    ['Phase3 reference edge value', 'phase3_reference_edge_value_authority_binding', edgeEnvelope],
    ['Phase3 linked-rule reference value', 'phase3_linked_rule_reference_value_authority_binding', linkedEnvelope],
    ['Phase3 raw-M2 reference owner value', 'phase3_raw_m2_reference_owner_value_authority_binding', rawEnvelope],
    ['Phase3 source-occurrence self-reference value', 'phase3_source_occurrence_self_reference_value_authority_binding', selfEnvelope],
    ['Phase3 agreement-date source-pair reference value', 'phase3_agreement_date_source_pair_reference_value_authority_binding', dateEnvelope],
    ['Phase3 Company Stockholders Meeting event reference value', 'phase3_company_stockholders_meeting_event_reference_value_authority_binding', meetingEnvelope],
  ];
  for (const [label, key, envelope] of authorityBindings) {
    assert.deepEqual(result[key], envelope.binding);
    assertExactKeys(
      result[key],
      meetingAuthority.candidate_output_contract.authority_binding_exact_keys,
      `${label} authority binding keys`,
    );
  }
  assert.deepEqual(result.phase2_proposal_binding, predecessor.phase2_proposal_binding);
  assert.deepEqual(
    result.phase2_proposal_binding,
    meetingAuthority.phase2_proposal_binding,
  );
  assertExactKeys(
    result.phase2_proposal_binding,
    meetingAuthority.candidate_output_contract.phase2_proposal_binding_exact_keys,
    'meeting-event Phase2 proposal binding keys',
  );
  assert.deepEqual(
    result.predecessor_agreement_date_source_pair_reference_value_candidate_binding,
    predecessorBinding,
  );

  const sourceCandidate = profileAuthoring
    .prepareTerminationReferenceSourceNormaliserCandidate({
      terminationPhase3ReferenceSourceNormaliserAuthority: sourceEnvelope,
      terminationPhase3TargetEvidenceAuthority: targetEnvelope,
      terminationPhase3ReviewAuthority: reviewEnvelope,
      terminationAuthoringPhase2Authority: phase2Envelope,
      governedSources: fixture.governedSources,
    });
  const values =
    result.company_stockholders_meeting_event_reference_values;
  assert.equal(values.length, 1);
  assert.deepEqual(
    values,
    meetingAuthority.company_stockholders_meeting_event_reference_values,
  );
  assert.notStrictEqual(
    values,
    meetingAuthority.company_stockholders_meeting_event_reference_values,
  );
  assertDisjoint(
    collectObjectIdentities(values),
    collectObjectIdentities(
      meetingAuthority.company_stockholders_meeting_event_reference_values,
    ),
    'candidate/authority meeting-event value alias',
  );
  const value = values[0];
  assertExactKeys(
    value,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_KEYS,
    'meeting-event value keys',
  );
  assertExactKeys(
    value.approved_event_defined_term_mapping,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_MAPPING_KEYS,
    'meeting-event approved mapping keys',
  );
  for (const owner of [
    value.selected_meeting_defined_term_owner,
    value.rejected_approval_defined_term_owner,
  ]) {
    assertExactKeys(
      owner,
      TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_OWNER_KEYS,
      'meeting-event owner keys',
    );
  }
  for (const occurrence of [
    value.selected_meeting_definition_occurrence,
    value.rejected_approval_definition_occurrence,
  ]) {
    assertExactKeys(
      occurrence,
      TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINITION_OCCURRENCE_KEYS,
      'meeting-event definition occurrence keys',
    );
    assertExactKeys(
      occurrence.definition_annotation,
      TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINITION_ANNOTATION_KEYS,
      'meeting-event definition annotation keys',
    );
    assertExactKeys(
      occurrence.definition_annotation.span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'meeting-event definition annotation span keys',
    );
    assertExactKeys(
      occurrence.definition_m2_node,
      TERMINATION_PHASE3_M2_TARGET_KEYS,
      'meeting-event definition M2 node keys',
    );
    assertExactKeys(
      occurrence.definition_m2_node.extent_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'meeting-event definition M2 extent keys',
    );
    assertExactKeys(
      occurrence.definition_source_support,
      TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
      'meeting-event definition support keys',
    );
    assertExactKeys(
      occurrence.definition_source_support.source_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'meeting-event definition support span keys',
    );
  }
  assertExactKeys(
    value.terminal_source_occurrence,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_TERMINAL_OCCURRENCE_KEYS,
    'meeting-event terminal occurrence keys',
  );
  assertExactKeys(
    value.terminal_source_occurrence.m2_node,
    TERMINATION_PHASE3_M2_TARGET_KEYS,
    'meeting-event terminal M2 node keys',
  );
  assertExactKeys(
    value.terminal_source_occurrence.m2_node.extent_span,
    TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
    'meeting-event terminal M2 extent keys',
  );
  assertExactKeys(
    value.terminal_source_occurrence.occurrence_span,
    TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
    'meeting-event terminal occurrence span keys',
  );
  assertExactKeys(
    value.terminal_source_support,
    TERMINATION_PHASE3_SOURCE_SUPPORT_KEYS,
    'meeting-event terminal support keys',
  );
  assertExactKeys(
    value.terminal_source_support.source_span,
    TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
    'meeting-event terminal support span keys',
  );
  for (const edge of [
    value.direct_provenance_meeting_definition_edge,
    value.section_8_01_g_meeting_definition_edge,
    value.section_8_01_g_approval_definition_edge,
  ]) {
    assertExactKeys(
      edge,
      TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_M3_EDGE_KEYS,
      'meeting-event M3 edge keys',
    );
    assertExactKeys(
      edge.source_span,
      TERMINATION_PHASE3_SOURCE_SPAN_KEYS,
      'meeting-event M3 edge span keys',
    );
  }
  assertExactKeys(
    value.normalisation_proof,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_PROOF_KEYS,
    'meeting-event proof keys',
  );
  const unsignedValue = structuredClone(value);
  delete unsignedValue
    .company_stockholders_meeting_event_reference_target_string_review_id;
  assert.equal(
    value.company_stockholders_meeting_event_reference_target_string_review_id,
    contentId(
      meetingAuthority.company_stockholders_meeting_event_reference_value_contract
        .identity_domain,
      unsignedValue,
    ),
  );
  assert.equal(
    Buffer.byteLength(canonicalJson(values), 'utf8'),
    11071,
  );
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(values), 'utf8')),
    '94cda0098098bc50c10a76fd06c82529c24df89bfab392490e891122af08dc7d',
  );
  assert.deepEqual({
    value_type: value.value_type,
    normalisation_rule_id: value.normalisation_rule_id,
    materialisation_state: value.materialisation_state,
    work3_fixture_consumable_value_shape:
      value.work3_fixture_consumable_value_shape,
  }, {
    value_type: 'REFERENCE',
    normalisation_rule_id:
      'COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINED_TERM_OWNER_REFERENCE/V1',
    materialisation_state:
      'REVIEW_ONLY_COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINED_TERM_OWNER_REFERENCE_TARGET_STRING_WORK3_NORMALISER_FACT_AND_ID_WITHHELD',
    work3_fixture_consumable_value_shape: false,
  });
  assert.equal(Object.hasOwn(value, 'projected_context_edge'), false);

  const predecessorSlotByKey = new Map(
    predecessor.remaining_unresolved_reference_slots.map(
      (slot, index) => [slot.reference_slot_key, { slot, index }],
    ),
  );
  const selectedSlot = predecessorSlotByKey.get(value.reference_slot_key);
  assert(selectedSlot, value.reference_slot_key);
  assert.deepEqual({
    profile_key: value.profile_key,
    source_unit_key: value.source_unit_key,
    field_key: value.field_key,
  }, {
    profile_key: selectedSlot.slot.profile_key,
    source_unit_key: selectedSlot.slot.source_unit_key,
    field_key: selectedSlot.slot.field_key,
  });
  assert.deepEqual(
    values.map((row) => row.reference_slot_key),
    ['65d5112e2ffb34510f1e76e7b38f5307d5a709315bc624809bd10e287b2ed1cb'],
  );

  const descriptor = sourceCandidate.source_normaliser_descriptors.find(
    (row) => row.source_normaliser_descriptor_id
      === value.source_normaliser_descriptor_id,
  );
  assert(descriptor, value.source_normaliser_descriptor_id);
  assert.deepEqual({
    source_normaliser_descriptor_id: descriptor.source_normaliser_descriptor_id,
    reference_slot_key: descriptor.reference_slot_key,
    profile_key: descriptor.profile_key,
    source_unit_key: descriptor.source_unit_key,
    field_key: descriptor.field_key,
    agreement_id: descriptor.agreement_id,
    normaliser_kind: descriptor.normaliser_kind,
    materialisation_state: descriptor.materialisation_state,
    phase2_terminal_contract_path: descriptor.phase2_terminal_contract_path,
    work3_fixture_consumable_value_shape:
      descriptor.work3_fixture_consumable_value_shape,
  }, {
    source_normaliser_descriptor_id:
      '96b70afc38c282e5f32ac64af2e821e900a0f54c2417d372e1ccc9ea1bb7fadb',
    reference_slot_key: value.reference_slot_key,
    profile_key: value.profile_key,
    source_unit_key: value.source_unit_key,
    field_key: value.field_key,
    agreement_id: value.agreement_id,
    normaliser_kind: 'EXACT_SOURCE_OCCURRENCE_REFERENCE_EVIDENCE',
    materialisation_state:
      'EXACT_SOURCE_REFERENCE_EVIDENCE_PROVED_WORK3_TARGET_STRING_WITHHELD',
    phase2_terminal_contract_path:
      '/source_terminal_successor_contract/terminal_rule_registry/21',
    work3_fixture_consumable_value_shape: false,
  });
  assert.deepEqual(
    descriptor.normaliser_payload.exact_terminal_source_occurrence,
    value.terminal_source_occurrence,
  );
  assert.deepEqual(
    descriptor.normaliser_payload.exact_same_field_phase2_dependencies,
    [],
  );
  assert.equal(
    descriptor.normaliser_payload.occurrence_subclass,
    'EXACT_EVENT_OR_REFERENCE_SOURCE_OCCURRENCE',
  );
  assert.equal(
    descriptor.normaliser_payload.projection_rule_needed,
    'PROJECT_THE_EXACT_SOURCE_OCCURRENCE_AS_REVIEW_REFERENCE_EVIDENCE_WITHOUT_REUSING_A_DIFFERENTLY_NAMED_OWNER',
  );
  assert.deepEqual(
    descriptor.normaliser_payload.rejected_differently_named_owner_candidates,
    [
      value.rejected_approval_defined_term_owner,
      value.selected_meeting_defined_term_owner,
    ],
  );

  const terminal = jsonPointerValue(
    phase2Authority,
    descriptor.phase2_terminal_contract_path,
  );
  assert.equal(terminal.source_unit_key, value.source_unit_key);
  assert.equal(terminal.agreement_id, value.agreement_id);
  const closureByNode = new Map(
    terminal.source_closure.members.map(
      (member) => [member.node_occurrence_id, member],
    ),
  );
  assert.equal(
    closureByNode.get(
      value.terminal_source_occurrence.m2_node.node_occurrence_id,
    ).closure_role,
    value.terminal_source_occurrence.source_closure_role,
  );
  assert.equal(
    closureByNode.get(
      value.selected_meeting_defined_term_owner.owner_node_occurrence_id,
    ).closure_role,
    'MATERIAL_CROSS_NODE_RULE',
  );
  const definedTerms = terminal.dependency_contracts.defined_term_dependencies;
  assert.deepEqual(definedTerms, [
    value.rejected_approval_defined_term_owner,
    value.selected_meeting_defined_term_owner,
  ]);
  assert.notEqual(definedTerms[0].field_key, definedTerms[1].field_key);
  assert.notEqual(
    definedTerms[0].owner_node_occurrence_id,
    definedTerms[1].owner_node_occurrence_id,
  );

  const agreementEvidence = fixture.governedSources
    .agreementEvidenceByAgreementId[value.agreement_id];
  assert(agreementEvidence, value.agreement_id);
  const m2 = agreementEvidence.m2.record;
  const m3 = agreementEvidence.m3.record;
  const canonicalTextBytes = Buffer.from(m2.source_binding.canonical_text, 'utf8');
  assert.equal(
    canonicalTextBytes.byteLength,
    agreementEvidence.canonicalTextIdentity.canonical_text_byte_length,
  );
  assert.equal(
    sha256Hex(canonicalTextBytes),
    agreementEvidence.canonicalTextIdentity.canonical_text_sha256,
  );
  const projectM2Node = (node) => ({
    agreement_index_id: m2.agreement_index_id,
    extent_span: node.extent_span,
    node_kind: node.node_kind,
    node_occurrence_id: node.node_occurrence_id,
    reference: node.reference,
  });
  const uniqueNode = (nodeId) => {
    const matches = m2.nodes.filter(
      (node) => node.node_occurrence_id === nodeId,
    );
    assert.equal(matches.length, 1, nodeId);
    return matches[0];
  };
  const terminalNode = uniqueNode(
    value.terminal_source_occurrence.m2_node.node_occurrence_id,
  );
  const selectedDefinitionNode = uniqueNode(
    value.selected_meeting_defined_term_owner.owner_node_occurrence_id,
  );
  const rejectedDefinitionNode = uniqueNode(
    value.rejected_approval_defined_term_owner.owner_node_occurrence_id,
  );
  assert.deepEqual(
    value.terminal_source_occurrence.m2_node,
    projectM2Node(terminalNode),
  );
  assert.deepEqual(
    value.selected_meeting_definition_occurrence.definition_m2_node,
    projectM2Node(selectedDefinitionNode),
  );
  assert.deepEqual(
    value.rejected_approval_definition_occurrence.definition_m2_node,
    projectM2Node(rejectedDefinitionNode),
  );
  const assertRawSpan = (span, sourceText, label) => {
    const expectedBytes = Buffer.from(sourceText, 'utf8');
    const actualBytes = canonicalTextBytes.subarray(
      span.start_byte,
      span.end_byte,
    );
    assert.deepEqual(actualBytes, expectedBytes, label);
    assert.equal(sha256Hex(actualBytes), span.text_sha256, label);
  };
  const assertUniqueWithinNode = (node, span, sourceText, label) => {
    const nodeBytes = canonicalTextBytes.subarray(
      node.extent_span.start_byte,
      node.extent_span.end_byte,
    );
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    const relativeStart = span.start_byte - node.extent_span.start_byte;
    assert.equal(nodeBytes.indexOf(sourceBytes), relativeStart, label);
    assert.equal(
      nodeBytes.indexOf(sourceBytes, relativeStart + 1),
      -1,
      label,
    );
  };
  assertRawSpan(
    value.terminal_source_occurrence.occurrence_span,
    value.terminal_source_occurrence.occurrence_text,
    'meeting-event terminal occurrence bytes',
  );
  assertUniqueWithinNode(
    terminalNode,
    value.terminal_source_occurrence.occurrence_span,
    value.terminal_source_occurrence.occurrence_text,
    'meeting-event terminal occurrence uniqueness',
  );
  const terminalClosure = closureByNode.get(terminalNode.node_occurrence_id);
  assert.equal(
    terminalClosure.source_span.start_byte
      <= value.terminal_source_occurrence.occurrence_span.start_byte,
    true,
  );
  assert.equal(
    value.terminal_source_occurrence.occurrence_span.end_byte
      <= terminalClosure.source_span.end_byte,
    true,
  );
  const expectedSupport = (node, span, sourceText) => ({
    agreement_index_id: m2.agreement_index_id,
    source_node_occurrence_id: node.node_occurrence_id,
    source_span: span,
    source_support_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
      agreement_index_id: m2.agreement_index_id,
      source_node_occurrence_id: node.node_occurrence_id,
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      text_sha256: span.text_sha256,
    }),
    source_text: sourceText,
  });
  assert.deepEqual(
    value.terminal_source_support,
    expectedSupport(
      terminalNode,
      value.terminal_source_occurrence.occurrence_span,
      value.terminal_source_occurrence.occurrence_text,
    ),
  );

  const uniqueAnnotation = (annotationId) => {
    const matches = m2.annotations.filter(
      (annotation) => annotation.annotation_occurrence_id === annotationId,
    );
    assert.equal(matches.length, 1, annotationId);
    return matches[0];
  };
  for (const [occurrence, node, sourceText] of [
    [
      value.selected_meeting_definition_occurrence,
      selectedDefinitionNode,
      '“Company Stockholders Meeting”',
    ],
    [
      value.rejected_approval_definition_occurrence,
      rejectedDefinitionNode,
      '“Company Stockholder Approval”',
    ],
  ]) {
    const annotation = uniqueAnnotation(
      occurrence.definition_annotation.annotation_occurrence_id,
    );
    assert.deepEqual(occurrence.definition_annotation, annotation);
    assertRawSpan(annotation.span, sourceText, `${sourceText} definition bytes`);
    assertUniqueWithinNode(
      node,
      annotation.span,
      sourceText,
      `${sourceText} definition uniqueness`,
    );
    assert.deepEqual(
      occurrence.definition_source_support,
      expectedSupport(node, annotation.span, sourceText),
    );
  }

  const uniqueEdge = (edgeId) => {
    const matches = m3.definition_edges.filter(
      (edge) => edge.definition_edge_id === edgeId,
    );
    assert.equal(matches.length, 1, edgeId);
    return matches[0];
  };
  const f638Node = uniqueNode(
    'f6380bd10e251423e9e85afc73dd67d6ca197dbf336459510494b951473fca73',
  );
  const sourceUnitNode = uniqueNode(value.source_unit_key);
  assert.equal(
    sourceUnitNode.extent_span.start_byte <= f638Node.extent_span.start_byte,
    true,
  );
  assert.equal(
    f638Node.extent_span.end_byte <= sourceUnitNode.extent_span.end_byte,
    true,
  );
  const expectedEdges = [
    [
      value.direct_provenance_meeting_definition_edge,
      terminalNode,
      48783,
      48811,
      'Company Stockholders Meeting',
      true,
    ],
    [
      value.section_8_01_g_meeting_definition_edge,
      f638Node,
      230453,
      230481,
      'Company Stockholders Meeting',
      true,
    ],
    [
      value.section_8_01_g_approval_definition_edge,
      f638Node,
      230388,
      230416,
      'Company Stockholder Approval',
      false,
    ],
  ];
  for (const [expected, ownerNode, start, end, sourceText, unique] of expectedEdges) {
    assert.deepEqual(uniqueEdge(expected.definition_edge_id), expected);
    assert.equal(expected.source_span.start_byte, start);
    assert.equal(expected.source_span.end_byte, end);
    assertRawSpan(expected.source_span, sourceText, expected.definition_edge_id);
    const sourceAnnotation = uniqueAnnotation(
      expected.source_annotation_occurrence_id,
    );
    assert.equal(sourceAnnotation.annotation_kind, 'DEFINED_TERM_USE');
    assert.equal(
      sourceAnnotation.owner_node_occurrence_id,
      expected.owner_node_occurrence_id,
    );
    assert.equal(sourceAnnotation.value, expected.term);
    assert.deepEqual(sourceAnnotation.span, expected.source_span);
    if (unique) {
      assertUniqueWithinNode(
        ownerNode,
        expected.source_span,
        sourceText,
        `${expected.definition_edge_id} uniqueness`,
      );
    }
  }

  const trailingApprovalEdge = uniqueEdge(
    '11fbfb3b3fc9b44aae0b630273a4a459c0e704b365062e3b5b395175b5f614f8',
  );
  assert.deepEqual({
    owner_node_occurrence_id: trailingApprovalEdge.owner_node_occurrence_id,
    term: trailingApprovalEdge.term,
    raw_text: trailingApprovalEdge.raw_text,
    source_span: trailingApprovalEdge.source_span,
    selected_definition_annotation_occurrence_id:
      trailingApprovalEdge.selected_definition_annotation_occurrence_id,
    target_definition_annotation_occurrence_ids:
      trailingApprovalEdge.target_definition_annotation_occurrence_ids,
    target_owner_node_occurrence_ids:
      trailingApprovalEdge.target_owner_node_occurrence_ids,
  }, {
    owner_node_occurrence_id: f638Node.node_occurrence_id,
    term: 'Company Stockholder Approval',
    raw_text: 'Company Stockholder Approval',
    source_span: {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      end_byte: 230818,
      start_byte: 230790,
      text_sha256:
        '33a8177817c1c16413e78226facbf2e170523dbeddae03b687c536e26120b051',
    },
    selected_definition_annotation_occurrence_id:
      value.rejected_approval_definition_occurrence.definition_annotation
        .annotation_occurrence_id,
    target_definition_annotation_occurrence_ids: [
      value.rejected_approval_definition_occurrence.definition_annotation
        .annotation_occurrence_id,
    ],
    target_owner_node_occurrence_ids: [
      value.rejected_approval_defined_term_owner.owner_node_occurrence_id,
    ],
  });
  assertRawSpan(
    trailingApprovalEdge.source_span,
    trailingApprovalEdge.raw_text,
    'trailing approval edge bytes',
  );
  const trailingApprovalSourceAnnotation = uniqueAnnotation(
    trailingApprovalEdge.source_annotation_occurrence_id,
  );
  assert.equal(
    trailingApprovalSourceAnnotation.annotation_kind,
    'DEFINED_TERM_USE',
  );
  assert.equal(
    trailingApprovalSourceAnnotation.owner_node_occurrence_id,
    f638Node.node_occurrence_id,
  );
  assert.equal(
    trailingApprovalSourceAnnotation.value,
    trailingApprovalEdge.term,
  );
  assert.deepEqual(
    trailingApprovalSourceAnnotation.span,
    trailingApprovalEdge.source_span,
  );
  const startsWithinNode = (node, sourceText) => {
    const nodeBytes = canonicalTextBytes.subarray(
      node.extent_span.start_byte,
      node.extent_span.end_byte,
    );
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    const starts = [];
    let relativeStart = nodeBytes.indexOf(sourceBytes);
    while (relativeStart !== -1) {
      starts.push(node.extent_span.start_byte + relativeStart);
      relativeStart = nodeBytes.indexOf(sourceBytes, relativeStart + 1);
    }
    return starts;
  };
  assert.deepEqual(
    startsWithinNode(f638Node, 'Company Stockholder Approval'),
    [230388, 230790],
  );
  assert.deepEqual(
    startsWithinNode(f638Node, 'Company Stockholders Meeting'),
    [230453],
  );
  const relevantEdgeIds = m3.definition_edges.filter(
    (edge) => edge.state === 'RESOLVED'
      && [terminalNode.node_occurrence_id, f638Node.node_occurrence_id]
        .includes(edge.owner_node_occurrence_id)
      && ['Company Stockholders Meeting', 'Company Stockholder Approval']
        .includes(edge.term),
  ).map((edge) => edge.definition_edge_id).sort();
  assert.deepEqual(relevantEdgeIds, [
    value.direct_provenance_meeting_definition_edge.definition_edge_id,
    value.section_8_01_g_meeting_definition_edge.definition_edge_id,
    value.section_8_01_g_approval_definition_edge.definition_edge_id,
    trailingApprovalEdge.definition_edge_id,
  ].sort());
  assert.equal(
    definedTerms.some(
      (dependency) => dependency.native_m3_definition_edge_id
        === trailingApprovalEdge.definition_edge_id,
    ),
    false,
  );
  assert.equal(
    value.direct_provenance_meeting_definition_edge.owner_node_occurrence_id,
    value.rejected_approval_defined_term_owner.owner_node_occurrence_id,
  );
  assert.deepEqual(
    value.direct_provenance_meeting_definition_edge
      .target_owner_node_occurrence_ids,
    [value.selected_meeting_defined_term_owner.owner_node_occurrence_id],
  );
  assert.equal(
    value.section_8_01_g_meeting_definition_edge.owner_node_occurrence_id,
    value.section_8_01_g_approval_definition_edge.owner_node_occurrence_id,
  );
  assert.deepEqual(
    value.section_8_01_g_meeting_definition_edge
      .target_owner_node_occurrence_ids,
    [value.selected_meeting_defined_term_owner.owner_node_occurrence_id],
  );
  assert.deepEqual(
    value.section_8_01_g_approval_definition_edge
      .target_owner_node_occurrence_ids,
    [value.rejected_approval_defined_term_owner.owner_node_occurrence_id],
  );

  const proofSupportIds = [
    value.terminal_source_support.source_support_id,
    expectedSupport(
      terminalNode,
      value.direct_provenance_meeting_definition_edge.source_span,
      value.direct_provenance_meeting_definition_edge.raw_text,
    ).source_support_id,
    expectedSupport(
      f638Node,
      value.section_8_01_g_meeting_definition_edge.source_span,
      value.section_8_01_g_meeting_definition_edge.raw_text,
    ).source_support_id,
    expectedSupport(
      f638Node,
      value.section_8_01_g_approval_definition_edge.source_span,
      value.section_8_01_g_approval_definition_edge.raw_text,
    ).source_support_id,
    value.selected_meeting_definition_occurrence.definition_source_support
      .source_support_id,
    value.rejected_approval_definition_occurrence.definition_source_support
      .source_support_id,
  ];
  assert.deepEqual(proofSupportIds, [
    '21a98bbd28e7253d1ab873d29d1ac3e953237245b1e2a7193063157a79ca204e',
    '8ca02b87af9d0a1a25e67487c5b5e9968cd1b4aaa8c04cd520662acda8b5e61b',
    '073ab9a605882ebd041d1f701f283a35f6bc774dcbe67bbfabc0f9c431cbf38f',
    '801ab67c254d2ea09858e00800a7ab605a3ddaac780042b459020997d46bbd01',
    '106c3e4516d54cf720d48f73c2d47123f7704957979a639615a0e2f08b3d3ade',
    'bb34a1addafdc9b4395379354432884fd952d31ab88744d0a8a50746e37c4f9e',
  ]);
  assert.deepEqual(value.normalisation_proof, {
    input_direct_provenance_definition_edge_ids: [
      value.direct_provenance_meeting_definition_edge.definition_edge_id,
    ],
    input_rejected_definition_edge_ids: [
      value.section_8_01_g_approval_definition_edge.definition_edge_id,
    ],
    input_section_meeting_definition_edge_ids: [
      value.section_8_01_g_meeting_definition_edge.definition_edge_id,
    ],
    input_source_span_ids: proofSupportIds,
    result_digest: sha256Hex(
      Buffer.from(canonicalJson(value.proposed_reference_target_string), 'utf8'),
    ),
    rule_id:
      'COMPANY_STOCKHOLDERS_MEETING_EVENT_DEFINED_TERM_OWNER_REFERENCE/V1',
  });

  assert.deepEqual({
    field_key: value.selected_meeting_defined_term_owner.field_key,
    native_m3_definition_edge_id:
      value.selected_meeting_defined_term_owner.native_m3_definition_edge_id,
    owner_node_occurrence_id:
      value.selected_meeting_defined_term_owner.owner_node_occurrence_id,
    resolution_state:
      value.selected_meeting_defined_term_owner.resolution_state,
    source_text: value.selected_meeting_defined_term_owner.source_text,
  }, {
    field_key: 'COMPANY_STOCKHOLDERS_MEETING',
    native_m3_definition_edge_id:
      '438a968f6321d9fee80ed4da1f49360d8f59eae450e8f52e880a04adc550b78e',
    owner_node_occurrence_id:
      '3550d8fad09ac1f43535925e829837245e2cbb9c9b6abe767cd78b14fd6da75c',
    resolution_state: 'RESOLVED_NATIVE_M3_DEFINITION_EDGE',
    source_text: 'Company Stockholders Meeting',
  });
  assert.deepEqual({
    field_key: value.rejected_approval_defined_term_owner.field_key,
    native_m3_definition_edge_id:
      value.rejected_approval_defined_term_owner.native_m3_definition_edge_id,
    owner_node_occurrence_id:
      value.rejected_approval_defined_term_owner.owner_node_occurrence_id,
    resolution_state:
      value.rejected_approval_defined_term_owner.resolution_state,
    source_text: value.rejected_approval_defined_term_owner.source_text,
  }, {
    field_key: 'COMPANY_STOCKHOLDER_APPROVAL',
    native_m3_definition_edge_id:
      'c6361456d4bafdd58e87f2d7a99affb25e585810ac90b1ff46ae589edf357d9b',
    owner_node_occurrence_id:
      'f97a8e958aaca57b195dcf002a0391e9daa8999d1d2bccbbd8796b90b3f472d5',
    resolution_state: 'RESOLVED_NATIVE_M3_DEFINITION_EDGE',
    source_text: 'Company Stockholder Approval',
  });
  assert.equal(
    value.selected_meeting_definition_occurrence.definition_annotation
      .annotation_occurrence_id,
    'ddc42ca9ac9b5666c5e71552ac5951789b67c3b841a3c9a2313dc978047da11f',
  );
  assert.equal(
    value.rejected_approval_definition_occurrence.definition_annotation
      .annotation_occurrence_id,
    '46621340dd790d5201890cecf001047fdcca438acc5526ee897013e35f38adbe',
  );
  assert.equal(
    value.proposed_reference_target_string,
    value.selected_meeting_defined_term_owner.owner_node_occurrence_id,
  );
  assert.notEqual(
    value.proposed_reference_target_string,
    value.rejected_approval_defined_term_owner.owner_node_occurrence_id,
  );

  const approvalBasis = meetingAuthority.approval_basis;
  const mapping = value.approved_event_defined_term_mapping;
  assert.deepEqual(approvalBasis, {
    approval_class: 'SUBSTANTIVE_LEGAL_MAPPING_DECISION',
    approval_date: '2026-08-20',
    approved_source_field_key: 'COMPANY_STOCKHOLDERS_MEETING_EVENT',
    approved_target_field_key: 'COMPANY_STOCKHOLDERS_MEETING',
    approved_target_owner_node_occurrence_id:
      '3550d8fad09ac1f43535925e829837245e2cbb9c9b6abe767cd78b14fd6da75c',
    exact_response: 'yep agree',
    external_approval_id_created: false,
    provenance_only_rejected_target_node_occurrence_id:
      'f97a8e958aaca57b195dcf002a0391e9daa8999d1d2bccbbd8796b90b3f472d5',
    response_context:
      'IMMEDIATELY_FOLLOWING_THE_DETAILED_RECOMMENDATION_TO_MAP_COMPANY_STOCKHOLDERS_MEETING_EVENT_TO_THE_COMPANY_STOCKHOLDERS_MEETING_OWNER_3550D8FA_AND_KEEP_F97A8E95_AS_PROVENANCE_ONLY',
  });
  for (const key of [
    'approval_class',
    'approval_date',
    'approved_source_field_key',
    'approved_target_field_key',
    'approved_target_owner_node_occurrence_id',
    'exact_response',
    'provenance_only_rejected_target_node_occurrence_id',
  ]) {
    assert.equal(mapping[key], approvalBasis[key], key);
  }
  assert.deepEqual(mapping, {
    approval_class: 'SUBSTANTIVE_LEGAL_MAPPING_DECISION',
    approval_date: '2026-08-20',
    approved_source_field_key: value.field_key,
    approved_target_field_key:
      value.selected_meeting_defined_term_owner.field_key,
    approved_target_owner_node_occurrence_id:
      value.proposed_reference_target_string,
    exact_response: 'yep agree',
    provenance_only_rejected_target_node_occurrence_id:
      value.rejected_approval_defined_term_owner.owner_node_occurrence_id,
    scope: 'EXACT_REFERENCE_SLOT_65D5112E_ONLY',
    work3_reference_value_materialisation_withheld: true,
  });

  const selectedSlotKeys = new Set(values.map((row) => row.reference_slot_key));
  const remainingSlots = result.remaining_unresolved_reference_slots;
  assert.equal(remainingSlots.length, 1);
  assert.deepEqual(
    remainingSlots,
    meetingAuthority.remaining_unresolved_reference_slots,
  );
  assert.notStrictEqual(
    remainingSlots,
    meetingAuthority.remaining_unresolved_reference_slots,
  );
  assertDisjoint(
    collectObjectIdentities(remainingSlots),
    collectObjectIdentities(meetingAuthority.remaining_unresolved_reference_slots),
    'candidate/authority meeting-event remaining-slot alias',
  );
  const remainingSlot = remainingSlots[0];
  assertExactKeys(
    remainingSlot,
    meetingAuthority.remaining_unresolved_reference_slot_contract
      .exact_member_keys,
    'meeting-event remaining-slot keys',
  );
  assert.equal(
    remainingSlot.reference_slot_key,
    'b386c34a17e216f31b164dc1638a6a2310f357932aea083b923626e6ac0818ad',
  );
  assert.equal(
    contentId(
      meetingAuthority.remaining_unresolved_reference_slot_contract
        .identity_domain,
      {
        profile_key: remainingSlot.profile_key,
        source_unit_key: remainingSlot.source_unit_key,
        field_key: remainingSlot.field_key,
      },
    ),
    remainingSlot.reference_slot_key,
  );
  assert.equal(
    remainingSlot.materialisation_state,
    meetingAuthority.remaining_unresolved_reference_slot_contract
      .materialisation_state,
  );
  const remainingSlotKeys = new Set(
    remainingSlots.map((slot) => slot.reference_slot_key),
  );
  assert.equal(
    new Set([...selectedSlotKeys, ...remainingSlotKeys]).size,
    predecessor.remaining_unresolved_reference_slots.length,
  );
  predecessor.remaining_unresolved_reference_slots.forEach((slot) => {
    assert.equal(
      selectedSlotKeys.has(slot.reference_slot_key)
        || remainingSlotKeys.has(slot.reference_slot_key),
      true,
      slot.reference_slot_key,
    );
  });
  assert.deepEqual(
    remainingSlots,
    predecessor.remaining_unresolved_reference_slots.filter(
      (slot) => remainingSlotKeys.has(slot.reference_slot_key),
    ),
  );
  assert.deepEqual(
    predecessor.remaining_unresolved_reference_slots
      .map((slot) => slot.reference_slot_key),
    [...selectedSlotKeys, ...remainingSlotKeys].sort(
      (left, right) => (
        predecessor.remaining_unresolved_reference_slots.findIndex(
          (slot) => slot.reference_slot_key === left,
        )
        - predecessor.remaining_unresolved_reference_slots.findIndex(
          (slot) => slot.reference_slot_key === right,
        )
      ),
    ),
  );
  const remainingBytes = Buffer.from(canonicalJson(remainingSlots), 'utf8');
  assert.equal(remainingBytes.byteLength, 541);
  assert.equal(
    sha256Hex(remainingBytes),
    '22ffac79c5eccdaaf51c24fed0714643bd405e0a8260eab6975cc59e0ff40a62',
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    meetingAuthority.candidate_output_contract
      .remaining_unresolved_reference_slot_contract,
  );
  assert.deepEqual(meetingAuthority.remaining_source_normaliser_descriptors, []);
  const remainingDescriptorBytes = Buffer.from(
    canonicalJson(meetingAuthority.remaining_source_normaliser_descriptors),
    'utf8',
  );
  assert.equal(remainingDescriptorBytes.byteLength, 2);
  assert.equal(
    sha256Hex(remainingDescriptorBytes),
    '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  );
  assert.deepEqual(
    meetingAuthority.retained_source_admission_gaps,
    sourceCandidate.source_admission_gaps,
  );
  assert.equal(meetingAuthority.retained_source_admission_gaps.length, 1);
  const retainedGapBytes = Buffer.from(
    canonicalJson(meetingAuthority.retained_source_admission_gaps),
    'utf8',
  );
  assert.equal(retainedGapBytes.byteLength, 2885);
  assert.equal(
    sha256Hex(retainedGapBytes),
    '406ba6f13e1218332a3c9ba7f34eb3ad30f86bce3b908beb4b5f4b453a8ebe1d',
  );
  assert.deepEqual({
    reference_slot_key:
      meetingAuthority.retained_source_admission_gaps[0].reference_slot_key,
    external_source_name:
      meetingAuthority.retained_source_admission_gaps[0].external_source_name,
    field_key: meetingAuthority.retained_source_admission_gaps[0].field_key,
  }, {
    reference_slot_key: remainingSlot.reference_slot_key,
    external_source_name: 'Company Letter',
    field_key: 'JURISDICTION_LIST_REFERENCE',
  });

  assertExactKeys(
    result.company_stockholders_meeting_event_reference_value_accounting,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_ACCOUNTING_KEYS,
    'meeting-event accounting keys',
  );
  assert.deepEqual(
    result.company_stockholders_meeting_event_reference_value_accounting,
    Object.fromEntries(
      TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_ACCOUNTING_KEYS
        .map((key) => [
          key,
          meetingAuthority.candidate_output_contract
            .company_stockholders_meeting_event_reference_value_accounting[key],
        ]),
    ),
  );
  assert.deepEqual(
    result.company_stockholders_meeting_event_reference_value_accounting,
    {
      state:
        'COMPLETE_ONE_APPROVED_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_REVIEW',
      predecessor_agreement_date_source_pair_reference_value_count: 1,
      predecessor_remaining_source_normaliser_descriptor_count: 1,
      predecessor_remaining_source_admission_gap_count: 1,
      predecessor_remaining_unresolved_reference_slot_count: 2,
      company_stockholders_meeting_event_reference_value_count: 1,
      unique_company_stockholders_meeting_event_reference_review_id_count: 1,
      unique_company_stockholders_meeting_event_reference_reference_slot_count: 1,
      proposed_reference_target_string_count: 1,
      unique_proposed_reference_target_string_count: 1,
      company_stockholders_meeting_event_reference_normalisation_count: 1,
      unique_source_normaliser_descriptor_id_count: 1,
      approved_event_defined_term_mapping_count: 1,
      direct_provenance_meeting_definition_edge_count: 1,
      section_8_01_g_meeting_definition_edge_count: 1,
      section_8_01_g_approval_definition_edge_count: 1,
      selected_meeting_defined_term_owner_count: 1,
      rejected_approval_defined_term_owner_count: 1,
      rejected_source_occurrence_target_count: 1,
      unique_terminal_source_support_id_count: 1,
      unique_selected_meeting_definition_source_support_id_count: 1,
      unique_rejected_approval_definition_source_support_id_count: 1,
      work3_fixture_consumable_reference_value_count: 0,
      remaining_source_normaliser_descriptor_count: 0,
      remaining_source_admission_gap_count: 1,
      remaining_unresolved_reference_slot_count: 1,
      substantive_legal_question_count: 0,
      work3_normaliser_extension_count: 0,
      work3_typed_reference_value_count: 0,
      work3_typed_fact_count: 0,
      work3_identity_count: 0,
      family_package_count: 0,
      activation_count: 0,
    },
  );
  assert.deepEqual(
    result.company_stockholders_meeting_event_reference_value_contract,
    meetingAuthority.candidate_output_contract
      .company_stockholders_meeting_event_reference_value_contract,
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    meetingAuthority.candidate_output_contract.withheld_work3_identity_fields,
  );
  assert.deepEqual(
    result.unresolved_items,
    meetingAuthority.candidate_output_contract.unresolved_items,
  );
  assert.deepEqual(
    result.unresolved_items,
    [{
      field_key: 'JURISDICTION_LIST_REFERENCE',
      reference_slot_key: remainingSlot.reference_slot_key,
      state:
        'EXTERNAL_COMPANY_LETTER_SOURCE_NOT_ADMITTED_OR_M2_INDEXED_TARGET_SELECTION_WITHHELD',
      substantive_legal_question_required: false,
    }],
  );
  assert.deepEqual(
    result.zero_effect_boundary,
    meetingAuthority.candidate_output_contract.zero_effect_boundary,
  );
  assert.deepEqual(result.zero_effect_boundary, {
    activation_count: 0,
    candidate_registration_count: 0,
    company_stockholders_meeting_event_reference_value_count: 1,
    database_write_count: 0,
    executable_semantics_count: 0,
    family_package_count: 0,
    network_write_count: 0,
    product_write_count: 0,
    repository_write_count: 0,
    retained_company_letter_source_admission_gap_count: 1,
    retained_unresolved_reference_slot_count: 1,
    work3_identity_count: 0,
    work3_member_id_count: 0,
    work3_normaliser_extension_count: 0,
    work3_typed_fact_count: 0,
    work3_typed_reference_value_count: 0,
  });

  const outputKeys = collectKeys(result);
  meetingAuthority.forbidden_output_contract.forbidden_keys_anywhere.forEach(
    (key) => assert.equal(outputKeys.has(key), false, key),
  );
  const outputStrings = collectStrings(result);
  meetingAuthority.forbidden_output_contract
    .forbidden_schema_versions_anywhere.forEach(
      (schemaVersion) => assert.equal(outputStrings.includes(schemaVersion), false),
    );
  assert.equal(outputStrings.some((entry) => entry.includes('/tmp/')), false);
  const proposedValueOwners = [];
  const collectProposedValueOwners = (current, seen = new Set()) => {
    if (!current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);
    if (Object.hasOwn(current, 'proposed_reference_target_string')) {
      proposedValueOwners.push(current);
    }
    Object.values(current).forEach((child) => (
      collectProposedValueOwners(child, seen)
    ));
  };
  collectProposedValueOwners(result);
  assert.deepEqual(proposedValueOwners, values);

  const repeated = profileAuthoring
    .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
      fixture,
    );
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated meeting-event result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);
  const frozenFixture =
    terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture();
  freezeDeep(frozenFixture);
  const frozenResult = profileAuthoring
    .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
      frozenFixture,
    );
  assert.equal(canonicalJson(frozenResult), canonicalJson(result));
  assert.equal(isDeepFrozen(frozenResult), true);

  await t.test('rejects malformed exact public input', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CONTRACT';
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          null,
        )
    ));
    const extra =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    extra.extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          extra,
        )
    ));
    for (const key of [
      'terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority',
      'terminationPhase3AgreementDateSourcePairReferenceValueAuthority',
      'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
      'terminationPhase3RawM2ReferenceOwnerValueAuthority',
      'terminationPhase3LinkedRuleReferenceValueAuthority',
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ]) {
      const missing =
        forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
          fixture,
        );
      delete missing[key];
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
            missing,
          )
      ));
    }
  });

  await t.test('rejects meeting-event authority drift before all later errors', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_DRIFT';
    const absent =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    absent
      .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority =
        null;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          absent,
        )
    ));

    const envelopeExtra =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    envelopeExtra
      .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority
      .extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          envelopeExtra,
        )
    ));

    const bindingDrift =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    bindingDrift
      .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          bindingDrift,
        )
    ));

    const recordDrift =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    recordDrift
      .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority
      .record = {
        ...structuredClone(meetingAuthority),
        authority_state: 'DRIFTED',
      };
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          recordDrift,
        )
    ));

    const combined =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    combined
      .terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority
      .binding.record_id = '0'.repeat(64);
    combined.terminationPhase3AgreementDateSourcePairReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3SourceOccurrenceSelfReferenceValueAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3RawM2ReferenceOwnerValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3LinkedRuleReferenceValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceEdgeValueAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReferenceSourceNormaliserAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3TargetEvidenceAuthority.binding.sha256 =
      '0'.repeat(64);
    combined.terminationPhase3ReviewAuthority.binding.sha256 = '0'.repeat(64);
    combined.terminationAuthoringPhase2Authority.binding.sha256 =
      '0'.repeat(64);
    delete combined.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          combined,
        )
    ));
  });

  await t.test('rejects predecessor authority drift in exact precedence order', async (st) => {
    const authorityPrecedence = [
      {
        name: 'agreement-date source-pair reference value',
        key: 'terminationPhase3AgreementDateSourcePairReferenceValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'source-occurrence self-reference value',
        key: 'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'raw-M2 reference owner value',
        key: 'terminationPhase3RawM2ReferenceOwnerValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'linked-rule reference value',
        key: 'terminationPhase3LinkedRuleReferenceValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'reference edge value',
        key: 'terminationPhase3ReferenceEdgeValueAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT',
      },
      {
        name: 'reference source normaliser',
        key: 'terminationPhase3ReferenceSourceNormaliserAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
      },
      {
        name: 'reference target evidence',
        key: 'terminationPhase3TargetEvidenceAuthority',
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
      },
      {
        name: 'reference review',
        key: 'terminationPhase3ReviewAuthority',
        code: 'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
      },
      {
        name: 'Phase2',
        key: 'terminationAuthoringPhase2Authority',
        code: 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
      },
    ];
    for (let index = 0; index < authorityPrecedence.length; index += 1) {
      const current = authorityPrecedence[index];
      await st.test(current.name, () => {
        const drift =
          forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
            fixture,
          );
        authorityPrecedence.slice(index).forEach(({ key }) => {
          drift[key].binding.sha256 = '0'.repeat(64);
        });
        delete drift.governedSources.baseContractPolicy;
        expectCode(current.code, () => (
          profileAuthoring
            .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
              drift,
            )
        ));
      });
    }
  });

  await t.test('rejects governed source and approved meeting proof drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_SOURCE_COVERAGE';
    const extraGoverned =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    extraGoverned.governedSources.extra = true;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          extraGoverned,
        )
    ));

    const missingGoverned =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    delete missingGoverned.governedSources.baseContractPolicy;
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          missingGoverned,
        )
    ));

    for (const sourceKey of [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
    ]) {
      const drift =
        forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
          fixture,
        );
      forkTerminationSourceEnvelope(drift.governedSources, sourceKey)
        .binding.sha256 = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
            drift,
          )
      ));
    }

    const canonicalTextDrift =
      forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
        fixture,
      );
    const driftedEvidence = forkTerminationAgreementEvidence(
      canonicalTextDrift,
      value.agreement_id,
    );
    driftedEvidence.canonicalTextIdentity = {
      ...driftedEvidence.canonicalTextIdentity,
      canonical_text_sha256: '0'.repeat(64),
    };
    expectCode(code, () => (
      profileAuthoring
        .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
          canonicalTextDrift,
        )
    ));

    for (const sourceKey of ['m2', 'm3', 'm4']) {
      const drift =
        forkTerminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(
          fixture,
        );
      const evidence = forkTerminationAgreementEvidence(
        drift,
        value.agreement_id,
      );
      forkTerminationSourceEnvelope(evidence, sourceKey)
        .binding.record_id = '0'.repeat(64);
      expectCode(code, () => (
        profileAuthoring
          .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
            drift,
          )
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 Company Stockholders Meeting event reference value preserves the approved exact Termination owner without Work3 materialisation',
  );
});

test('Phase3 reference value materialisation preserves the 221-slot Termination ledger as 220 consumable values and one private Company Letter gap without package activation', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationReferenceValueMaterialisationCandidate,
    'function',
  );

  const fixture = terminationPhase3ReferenceValueMaterialisationFixture();
  const before = fixtureFingerprint(fixture);
  const oracle = expectedTerminationReferenceValueMaterialisation(fixture);
  const result = profileAuthoring
    .prepareTerminationReferenceValueMaterialisationCandidate(fixture);
  const authority = fixture
    .terminationPhase3ReferenceValueMaterialisationAuthority.record;
  const outputContract = authority.candidate_output_contract;
  assertExactKeys(
    result,
    outputContract.exact_keys,
    'reference value materialisation candidate keys',
  );
  assert.equal(result.schema_version, outputContract.schema_version);
  assert.equal(result.family_key, 'TERMINATION');
  assert.equal(outputContract.exact_keys.length, 28);
  assert.equal(result.candidate_state, outputContract.candidate_state);
  assert.equal(
    result.reference_value_materialisation_candidate_id,
    contentId(
      result.schema_version,
      referenceValueMaterialisationCandidateUnsignedRecord(result),
    ),
  );
  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(authority)}\n`, 'utf8'),
  );
  const unsignedAuthority = structuredClone(authority);
  delete unsignedAuthority
    .termination_authoring_phase3_reference_value_materialisation_authority_id;
  assert.equal(
    authority
      .termination_authoring_phase3_reference_value_materialisation_authority_id,
    contentId(authority.schema_version, unsignedAuthority),
  );
  assert.deepEqual(
    authority.implementation_contract.dependency_validation_precedence,
    [
      'EXACT_INPUT_SHAPE',
      'REFERENCE_VALUE_MATERIALISATION_AUTHORITY_SEAL_AND_SCHEDULE',
      'RED_HAT_COMPANY_LETTER_V3_FRONTIER_SEAL',
      'COMPANY_STOCKHOLDERS_MEETING_EVENT_AUTHORITY_AND_E50_CANDIDATE',
      'AGREEMENT_DATE_SOURCE_PAIR_AUTHORITY_AND_CANDIDATE',
      'SOURCE_OCCURRENCE_SELF_AUTHORITY_AND_CANDIDATE',
      'RAW_M2_REFERENCE_OWNER_AUTHORITY_AND_CANDIDATE',
      'LINKED_RULE_REFERENCE_AUTHORITY_AND_CANDIDATE',
      'REFERENCE_EDGE_AUTHORITY_AND_CANDIDATE',
      'REFERENCE_SOURCE_NORMALISER_AUTHORITY_AND_CANDIDATE',
      'REFERENCE_TARGET_EVIDENCE_AUTHORITY_AND_CANDIDATE',
      'REFERENCE_REVIEW_AUTHORITY_AND_CANDIDATE',
      'PHASE2_AUTHORITY_AND_PROPOSAL',
      'GOVERNED_SOURCE_PHYSICAL_BYTES',
      'FRESH_RECOMPUTED_PREDECESSOR_CHAIN',
      'EXACT_221_EQUALS_74_PLUS_109_PLUS_37_PLUS_1_PARTITION',
      'CANDIDATE_OUTPUT_AND_FORBIDDEN_SURFACE',
    ],
  );

  const authorityBindings = [
    ['phase2_authority_binding', 'terminationAuthoringPhase2Authority'],
    ['phase3_reference_review_authority_binding', 'terminationPhase3ReviewAuthority'],
    ['phase3_target_evidence_authority_binding', 'terminationPhase3TargetEvidenceAuthority'],
    ['phase3_source_normaliser_authority_binding', 'terminationPhase3ReferenceSourceNormaliserAuthority'],
    ['phase3_reference_edge_value_authority_binding', 'terminationPhase3ReferenceEdgeValueAuthority'],
    ['phase3_linked_rule_reference_value_authority_binding', 'terminationPhase3LinkedRuleReferenceValueAuthority'],
    ['phase3_raw_m2_reference_owner_value_authority_binding', 'terminationPhase3RawM2ReferenceOwnerValueAuthority'],
    ['phase3_source_occurrence_self_reference_value_authority_binding', 'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority'],
    ['phase3_agreement_date_source_pair_reference_value_authority_binding', 'terminationPhase3AgreementDateSourcePairReferenceValueAuthority'],
    ['phase3_company_stockholders_meeting_event_reference_value_authority_binding', 'terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority'],
    ['phase3_red_hat_company_letter_source_discovery_frontier_authority_binding', 'terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority'],
    ['phase3_reference_value_materialisation_authority_binding', 'terminationPhase3ReferenceValueMaterialisationAuthority'],
  ];
  for (const [outputKey, fixtureKey] of authorityBindings) {
    assertExactKeys(
      result[outputKey],
      outputContract.authority_binding_exact_keys,
      `${outputKey} keys`,
    );
    assert.deepEqual(result[outputKey], fixture[fixtureKey].binding);
  }
  assert.deepEqual(result.phase2_proposal_binding, authority.phase2_proposal_binding);

  const meetingCandidate = oracle.successorCandidates.find(
    ({ sourceClass }) => (
      sourceClass === 'COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE'
    ),
  ).candidate;
  assert.equal(
    meetingCandidate
      .company_stockholders_meeting_event_reference_value_candidate_id,
    'e50ffe7d3a0c0e55a702c5441ccc2d1b2a7d00efa6bebe4a3cc2dc6679bdd137',
  );
  assert.equal(
    meetingCandidate
      .company_stockholders_meeting_event_reference_value_candidate_id,
    contentId(
      meetingCandidate.schema_version,
      companyStockholdersMeetingEventReferenceValueCandidateUnsignedRecord(
        meetingCandidate,
      ),
    ),
  );
  const predecessorBinding = {
    schema_version: meetingCandidate.schema_version,
    company_stockholders_meeting_event_reference_value_candidate_id:
      meetingCandidate
        .company_stockholders_meeting_event_reference_value_candidate_id,
    company_stockholders_meeting_event_reference_value_count:
      meetingCandidate
        .company_stockholders_meeting_event_reference_value_accounting
        .company_stockholders_meeting_event_reference_value_count,
    remaining_source_normaliser_descriptor_count:
      meetingCandidate
        .company_stockholders_meeting_event_reference_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_source_admission_gap_count:
      meetingCandidate
        .company_stockholders_meeting_event_reference_value_accounting
        .remaining_source_admission_gap_count,
    remaining_unresolved_reference_slot_count:
      meetingCandidate.remaining_unresolved_reference_slots.length,
    remaining_unresolved_reference_slot_sha256: sha256Hex(Buffer.from(
      canonicalJson(meetingCandidate.remaining_unresolved_reference_slots),
      'utf8',
    )),
  };
  assertExactKeys(
    predecessorBinding,
    outputContract.predecessor_binding_exact_keys,
    'materialisation predecessor binding keys',
  );
  assert.deepEqual(
    predecessorBinding,
    authority
      .predecessor_company_stockholders_meeting_event_reference_value_candidate_binding,
  );
  assert.deepEqual(
    result
      .predecessor_company_stockholders_meeting_event_reference_value_candidate_binding,
    predecessorBinding,
  );
  assert.deepEqual(
    result.phase2_proposal_binding,
    meetingCandidate.phase2_proposal_binding,
  );

  const ledger = result.reference_value_ledger;
  assert.equal(ledger.length, 221);
  assert.equal(new Set(ledger.map(terminationReferenceRowIdentity)).size, 221);
  assert.deepEqual(
    ledger.map(terminationReferenceRowIdentity),
    oracle.entries.map(
      ({ predecessorRow }) => terminationReferenceRowIdentity(predecessorRow),
    ),
  );

  const sourceClassCounts = {};
  for (let index = 0; index < oracle.entries.length; index += 1) {
    const expected = oracle.entries[index];
    const row = ledger[index];
    assertExactKeys(
      row,
      TERMINATION_PHASE3_REFERENCE_LEDGER_ROW_KEYS,
      `materialisation ledger row ${index}`,
    );
    assert.equal(row.profile_key, expected.predecessorRow.profile_key);
    assert.equal(row.source_unit_key, expected.predecessorRow.source_unit_key);
    assert.equal(row.field_key, expected.predecessorRow.field_key);
    assert.equal(row.typed_value, expected.typedValue, expected.slotKey);
    sourceClassCounts[expected.sourceClass] =
      (sourceClassCounts[expected.sourceClass] || 0) + 1;
    if (
      expected.sourceClass === 'PREDECESSOR_DIRECT_REFERENCE_VALUE'
      || expected.sourceClass === 'PREDECESSOR_GOVERNED_REFERENCE_VALUE'
      || expected.sourceClass === 'RETAINED_PRIVATE_COMPANY_LETTER_GAP'
    ) {
      assert.deepEqual(row, expected.predecessorRow, expected.slotKey);
      assert.notStrictEqual(row, expected.predecessorRow);
    } else {
      const targetEvidenceClasses = [
        'CANONICAL_TEXT_M2_SECTION_CITATION',
        'PHASE2_ROW_LOCAL_TARGET_EVIDENCE',
        'RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE',
      ];
      const isTargetEvidence = targetEvidenceClasses.includes(
        expected.sourceClass,
      );
      assert.equal(
        row.reference_classification,
        isTargetEvidence
          ? 'TARGET_EVIDENCE_MATERIALISED_REFERENCE_STRING'
          : 'SPECIALISED_SOURCE_NORMALISER_MATERIALISED_REFERENCE_STRING',
      );
      assert.equal(row.materialisation_state, 'NON_EMPTY_REFERENCE_STRING_PRESENT');
      assert.equal(row.review_descriptor, null);
      assert.equal(row.governed_reference_materialisation, null);
      assert.equal(
        row.value_source,
        isTargetEvidence
          ? `PHASE3_REFERENCE_TARGET_EVIDENCE:${expected.sourceClass}`
          : `PHASE3_${expected.sourceClass}_AUTHORITY`,
      );
      assert.equal(row.work3_fixture_consumable_value_shape, true);
    }
  }
  assert.deepEqual(sourceClassCounts, {
    PREDECESSOR_DIRECT_REFERENCE_VALUE: 12,
    PREDECESSOR_GOVERNED_REFERENCE_VALUE: 62,
    CANONICAL_TEXT_M2_SECTION_CITATION: 87,
    PHASE2_ROW_LOCAL_TARGET_EVIDENCE: 18,
    RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE: 4,
    REFERENCE_EDGE_VALUE: 6,
    LINKED_RULE_REFERENCE_VALUE: 10,
    RAW_M2_REFERENCE_OWNER_VALUE: 7,
    SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE: 12,
    AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE: 1,
    COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE: 1,
    RETAINED_PRIVATE_COMPANY_LETTER_GAP: 1,
  });

  const nonEmptyRows = ledger.filter((row) => row.typed_value !== null);
  const nullRows = ledger.filter((row) => row.typed_value === null);
  assert.equal(nonEmptyRows.length, 220);
  assert.equal(nullRows.length, 1);
  assert.equal(nonEmptyRows.every((row) => (
    LOWERCASE_HEX_64.test(row.typed_value)
      && row.work3_fixture_consumable_value_shape === true
  )), true);
  assert.equal(new Set(nonEmptyRows.map((row) => row.typed_value)).size, 84);
  assert.equal(
    terminationReferenceMaterialisationSlotKey(
      nullRows[0],
      fixture.terminationPhase3ReviewAuthority.record,
    ),
    'b386c34a17e216f31b164dc1638a6a2310f357932aea083b923626e6ac0818ad',
  );
  assert.equal(nullRows[0].work3_fixture_consumable_value_shape, false);
  const classificationCounts = ledger.reduce((counts, row) => {
    counts[row.reference_classification] =
      (counts[row.reference_classification] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(
    classificationCounts,
    authority.reference_value_ledger_contract.classification_counts,
  );
  assert.deepEqual(classificationCounts, {
    DIRECT_NON_EMPTY_REFERENCE_STRING: 12,
    GOVERNED_SEMANTIC_FACT_KEY: 62,
    TARGET_EVIDENCE_MATERIALISED_REFERENCE_STRING: 109,
    SPECIALISED_SOURCE_NORMALISER_MATERIALISED_REFERENCE_STRING: 37,
    UNRESOLVED_REFERENCE_SLOT: 1,
  });
  const materialisationStateCounts = ledger.reduce((counts, row) => {
    counts[row.materialisation_state] =
      (counts[row.materialisation_state] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(
    materialisationStateCounts,
    authority.reference_value_ledger_contract.materialisation_state_counts,
  );
  const ledgerBytes = Buffer.from(canonicalJson(ledger), 'utf8');
  assert.equal(ledgerBytes.byteLength, 230200);
  assert.equal(
    sha256Hex(ledgerBytes),
    '7f89a3596907c26682a9d140b1c266072a24ab305663aaffcc5cbe979354a5f7',
  );
  assert.deepEqual(
    result.reference_value_ledger_contract,
    authority.reference_value_ledger_contract,
  );
  assert.notStrictEqual(
    result.reference_value_ledger_contract,
    authority.reference_value_ledger_contract,
  );

  const targetEntries = oracle.entries.filter(({ sourceClass }) => [
    'CANONICAL_TEXT_M2_SECTION_CITATION',
    'PHASE2_ROW_LOCAL_TARGET_EVIDENCE',
    'RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE',
  ].includes(sourceClass));
  assert.equal(targetEntries.length, 109);
  assert.equal(new Set(targetEntries.map(({ slotKey }) => slotKey)).size, 109);
  assert.deepEqual(
    targetEntries.map(({ sourceRecord }) => sourceRecord.target_evidence_id),
    fixture.terminationPhase3TargetEvidenceAuthority.record
      .reference_target_evidence_descriptors
      .map((descriptor) => descriptor.target_evidence_id),
  );
  assert.equal(new Set(targetEntries.map(({ typedValue }) => typedValue)).size, 49);
  const rowLocalEntries = targetEntries.filter(
    ({ sourceClass }) => sourceClass === 'PHASE2_ROW_LOCAL_TARGET_EVIDENCE',
  );
  assert.equal(rowLocalEntries.length, 18);
  assert.deepEqual(
    [...rowLocalEntries.reduce((counts, { typedValue }) => {
      counts.set(typedValue, (counts.get(typedValue) || 0) + 1);
      return counts;
    }, new Map()).values()].sort((left, right) => right - left),
    [8, 4, 2, 1, 1, 1, 1],
  );
  const targetKinds = targetEntries.reduce((groups, entry) => {
    if (!groups[entry.sourceClass]) {
      groups[entry.sourceClass] = [];
    }
    groups[entry.sourceClass].push(entry);
    return groups;
  }, {});
  assert.deepEqual(Object.fromEntries(Object.entries(targetKinds).map(
    ([key, values]) => [key, values.length],
  )), {
    CANONICAL_TEXT_M2_SECTION_CITATION: 87,
    PHASE2_ROW_LOCAL_TARGET_EVIDENCE: 18,
    RAW_M3_SAME_TERM_DEFINITION_OWNER_EVIDENCE: 4,
  });
  const citationEntries = targetKinds.CANONICAL_TEXT_M2_SECTION_CITATION;
  assert.equal(citationEntries.filter(
    ({ sourceRecord }) => sourceRecord.evidence_payload.citation_kind
      === 'EXACT_EXPLICIT_SECTION_CITATION',
  ).length, 85);
  assert.equal(citationEntries.filter(
    ({ sourceRecord }) => sourceRecord.evidence_payload.citation_kind
      === 'EXACT_COORDINATED_SECTION_SHORTHAND',
  ).length, 2);

  const successorEntries = oracle.entries.filter(({ sourceClass }) => [
    'REFERENCE_EDGE_VALUE',
    'LINKED_RULE_REFERENCE_VALUE',
    'RAW_M2_REFERENCE_OWNER_VALUE',
    'SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE',
    'AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE',
    'COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE',
  ].includes(sourceClass));
  assert.equal(successorEntries.length, 37);
  assert.equal(new Set(successorEntries.map(({ slotKey }) => slotKey)).size, 37);
  assert.equal(successorEntries.every(({ typedValue, sourceRecord }) => (
    typedValue === sourceRecord.proposed_reference_target_string
  )), true);

  const independentReducedOracle = [
    ...fixture.terminationPhase3TargetEvidenceAuthority.record
      .reference_target_evidence_descriptors.map((descriptor) => ({
        reference_slot_key: descriptor.reference_slot_key,
        source_class: descriptor.evidence_kind,
        source_id: descriptor.target_evidence_id,
        typed_value: terminationTargetEvidenceProjectionTarget(
          descriptor,
          fixture.terminationAuthoringPhase2Authority.record,
          fixture.governedSources,
        ),
      })),
    ...oracle.successorCandidates.flatMap((entry) => (
      entry.candidate[entry.valueKey].map((value) => ({
        reference_slot_key: value.reference_slot_key,
        source_class: entry.sourceClass,
        source_id: value[entry.reviewIdKey],
        typed_value: value.proposed_reference_target_string,
      }))
    )),
  ];
  const authorityReducedOracle = [
    ...authority.reference_value_materialisation_schedules
      .target_evidence_reference_values.map((row) => ({
        reference_slot_key: row.reference_slot_key,
        source_class: row.evidence_kind,
        source_id: row.source_target_evidence_id,
        typed_value: row.proposed_reference_target_string,
      })),
    ...authority.reference_value_materialisation_schedules
      .specialised_successor_reference_values.map((row) => ({
        reference_slot_key: row.reference_slot_key,
        source_class: row.source_authority_role,
        source_id: row.source_review_id,
        typed_value: row.proposed_reference_target_string,
      })),
  ];
  assert.deepEqual(independentReducedOracle, authorityReducedOracle);
  const independentOracleBytes = Buffer.from(
    canonicalJson(independentReducedOracle),
    'utf8',
  );
  assert.equal(independentOracleBytes.byteLength, 43965);
  assert.equal(
    sha256Hex(independentOracleBytes),
    '226551020ebe12821c0b723c4653826ab4d689f04bb81fc28ecae4d053c40468',
  );

  const pinnedRowLocalSchedule = authority
    .reference_value_materialisation_schedules
    .target_evidence_reference_values.filter(
      (row) => row.evidence_kind === 'PHASE2_ROW_LOCAL_TARGET_EVIDENCE',
    );
  assert.equal(pinnedRowLocalSchedule.length, 18);
  const pinnedRowLocalBytes = Buffer.from(
    canonicalJson(pinnedRowLocalSchedule),
    'utf8',
  );
  assert.equal(pinnedRowLocalBytes.byteLength, 22439);
  assert.equal(
    sha256Hex(pinnedRowLocalBytes),
    'e225ffcfceb63e7f3dd8e9e11722a199d4f1bd81ef8510d2e667ce57a2e75a8f',
  );
  const independentRowLocalBySlot = new Map(
    rowLocalEntries.map(({ slotKey, typedValue }) => [slotKey, typedValue]),
  );
  assert.equal(independentRowLocalBySlot.size, 18);
  for (const pin of pinnedRowLocalSchedule) {
    assert.equal(
      independentRowLocalBySlot.get(pin.reference_slot_key),
      pin.proposed_reference_target_string,
      pin.reference_slot_key,
    );
  }

  assertExactKeys(
    result.reference_value_materialisation_accounting,
    outputContract.accounting_exact_keys,
    'reference value materialisation accounting keys',
  );
  assert.deepEqual(
    result.reference_value_materialisation_accounting,
    authority.reference_value_materialisation_accounting_contract
      .expected_values,
  );
  assert.equal(
    result.reference_value_materialisation_accounting
      .work3_typed_reference_value_count,
    220,
  );
  assert.equal(
    result.reference_value_materialisation_accounting
      .work3_typed_fact_count,
    0,
  );
  assert.equal(
    result.reference_value_materialisation_accounting.work3_identity_count,
    0,
  );
  assert.equal(
    result.reference_value_materialisation_accounting
      .remaining_unresolved_reference_slot_count,
    1,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slot_contract,
    authority.retained_unresolved_reference_slot_contract,
  );
  assert.deepEqual(
    result.retained_source_admission_gap_contract,
    authority.retained_source_admission_gap_contract,
  );
  assert.deepEqual(
    result.withheld_work3_identity_fields,
    outputContract.withheld_work3_identity_fields,
  );
  assert.deepEqual(result.unresolved_items, outputContract.unresolved_items);
  assert.deepEqual(result.zero_effect_boundary, outputContract.zero_effect_boundary);

  assert.deepEqual(
    result.remaining_unresolved_reference_slots,
    fixture.terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority
      .record.retained_company_letter_source_frontier
      .retained_unresolved_reference_slots,
  );
  assert.deepEqual(
    result.remaining_unresolved_reference_slots,
    authority.retained_unresolved_reference_slots,
  );
  assert.deepEqual(
    result.retained_source_admission_gaps,
    fixture.terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority
      .record.retained_company_letter_source_frontier
      .retained_source_admission_gaps,
  );
  assert.deepEqual(
    result.retained_source_admission_gaps,
    authority.retained_source_admission_gaps,
  );
  assert.notStrictEqual(result.remaining_unresolved_reference_slots[0], oracle.retainedSlot);
  assert.notStrictEqual(result.retained_source_admission_gaps[0], oracle.retainedGap);
  assert.equal(
    Buffer.byteLength(canonicalJson(result.remaining_unresolved_reference_slots), 'utf8'),
    541,
  );
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(result.remaining_unresolved_reference_slots), 'utf8')),
    '22ffac79c5eccdaaf51c24fed0714643bd405e0a8260eab6975cc59e0ff40a62',
  );
  assert.equal(
    Buffer.byteLength(canonicalJson(result.retained_source_admission_gaps), 'utf8'),
    2885,
  );
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(result.retained_source_admission_gaps), 'utf8')),
    '406ba6f13e1218332a3c9ba7f34eb3ad30f86bce3b908beb4b5f4b453a8ebe1d',
  );

  const typedValueOwners = collectKeyOccurrences(result, 'typed_value');
  assert.equal(typedValueOwners.length, 221);
  assert.equal(typedValueOwners.every(({ path }) => (
    path.length === 3
      && path[0] === 'reference_value_ledger'
      && Number.isInteger(path[1])
      && path[2] === 'typed_value'
  )), true);
  assert.equal(typedValueOwners.filter(({ value }) => value !== null).length, 220);
  assert.equal(typedValueOwners.filter(({ value }) => value === null).length, 1);

  const semanticKeyOwners = collectKeyOccurrences(result, 'semantic_fact_key');
  assert.equal(semanticKeyOwners.length, 62);
  for (const occurrence of semanticKeyOwners) {
    assert.equal(occurrence.path.length, 4);
    assert.equal(occurrence.path[0], 'reference_value_ledger');
    assert.equal(Number.isInteger(occurrence.path[1]), true);
    assert.equal(occurrence.path[2], 'governed_reference_materialisation');
    assert.equal(occurrence.path[3], 'semantic_fact_key');
    const index = occurrence.path[1];
    const row = ledger[index];
    const predecessor = oracle.entries[index].predecessorRow;
    assert.equal(row.reference_classification, 'GOVERNED_SEMANTIC_FACT_KEY');
    assert.deepEqual(row, predecessor);
    assert.equal(row.typed_value, occurrence.value);
    assert.equal(
      occurrence.value,
      contentId(
        row.governed_reference_materialisation.semantic_fact_identity_domain,
        row.governed_reference_materialisation.semantic_fact_identity_payload,
      ),
    );
  }

  const forbiddenKeys = [
    'typed_facts',
    'approved_inventory_digest',
    'ben_approval_id',
    'child_rule_requirement_id',
    'conditional_requirement_id',
    'dimension_evidence_id',
    'family_approval_id',
    'family_profile_package_id',
    'fixture_id',
    'inventory_fingerprint',
    'lawyer_ruling_id',
    'match_fixture_id',
    'profile_id',
    'requirement_id',
    'subtype_tree_id',
    'tree_id',
  ];
  assert.deepEqual(
    [...forbiddenKeys].sort(),
    [
      ...authority.forbidden_output_contract
        .forbidden_keys_anywhere_except_exact_inherited_governed_reference_materialisation,
    ].sort(),
  );
  assert.equal(forbiddenKeys.includes('semantic_fact_key'), false);
  const resultKeys = collectKeys(result);
  forbiddenKeys.forEach((key) => assert.equal(resultKeys.has(key), false, key));
  const resultStrings = collectStrings(result);
  const forbiddenSchemaVersions = [
    'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1',
    'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
    'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
    'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1',
    'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
    'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
    'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1',
  ];
  assert.deepEqual(
    forbiddenSchemaVersions,
    authority.forbidden_output_contract.forbidden_schema_versions_anywhere,
  );
  forbiddenSchemaVersions.forEach((schemaVersion) => (
    assert.equal(resultStrings.includes(schemaVersion), false, schemaVersion)
  ));
  for (const key of [
    'work3_typed_fact_count',
    'work3_identity_count',
    'work3_member_id_count',
    'family_package_count',
    'validate_single_family_package_inventory_call_count',
    'candidate_registration_count',
    'activation_count',
    'database_write_count',
    'product_write_count',
    'repository_write_count',
    'network_read_count',
    'network_write_count',
  ]) {
    if (Object.hasOwn(result.zero_effect_boundary, key)) {
      assert.equal(result.zero_effect_boundary[key], 0, key);
    }
  }
  assert.equal(
    result.zero_effect_boundary.work3_typed_reference_value_count,
    220,
  );

  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(fixture),
    'materialisation result/caller input alias',
  );
  for (const { candidate } of oracle.successorCandidates) {
    assertDisjoint(
      collectObjectIdentities(result),
      collectObjectIdentities(candidate),
      'materialisation result/successor candidate alias',
    );
  }
  const repeated = profileAuthoring
    .prepareTerminationReferenceValueMaterialisationCandidate(
      terminationPhase3ReferenceValueMaterialisationFixture(),
    );
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated materialisation result alias',
  );
  assert.equal(fixtureFingerprint(fixture), before);
  assertRecursivelyUnfrozen(fixture);

  await t.test('rejects exact public input shape before authority drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_CONTRACT';
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceValueMaterialisationCandidate(null)
    ));
    const combined = forkTerminationPhase3ReferenceValueMaterialisationFixture(
      fixture,
    );
    combined.extra = true;
    combined.terminationPhase3ReferenceValueMaterialisationAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority
      .binding.sha256 = '1'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceValueMaterialisationCandidate(
        combined,
      )
    ));
  });

  await t.test('rejects the new authority before frontier drift', () => {
    const code =
      'M7_V2_TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_DRIFT';
    const combined = forkTerminationPhase3ReferenceValueMaterialisationFixture(
      fixture,
    );
    combined.terminationPhase3ReferenceValueMaterialisationAuthority
      .binding.sha256 = '0'.repeat(64);
    combined.terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority
      .binding.sha256 = '1'.repeat(64);
    expectCode(code, () => (
      profileAuthoring.prepareTerminationReferenceValueMaterialisationCandidate(
        combined,
      )
    ));
  });

  await t.test('enforces the exact externally mutable dependency precedence', () => {
    const bindingMutation = (key) => (input, marker) => {
      input[key].binding.sha256 = marker.repeat(64);
    };
    const cases = [
      {
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3ReferenceValueMaterialisationAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_FRONTIER_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3AgreementDateSourcePairReferenceValueAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3RawM2ReferenceOwnerValueAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3LinkedRuleReferenceValueAuthority',
        ),
      },
      {
        code: 'M7_V2_TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3ReferenceEdgeValueAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY_DRIFT',
        mutate: bindingMutation(
          'terminationPhase3ReferenceSourceNormaliserAuthority',
        ),
      },
      {
        code:
          'M7_V2_TERMINATION_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY_DRIFT',
        mutate: bindingMutation('terminationPhase3TargetEvidenceAuthority'),
      },
      {
        code: 'M7_V2_TERMINATION_PHASE3_REVIEW_AUTHORITY_DRIFT',
        mutate: bindingMutation('terminationPhase3ReviewAuthority'),
      },
      {
        code: 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
        mutate: bindingMutation('terminationAuthoringPhase2Authority'),
      },
      {
        code: 'M7_V2_TERMINATION_PHASE2_SOURCE_COVERAGE',
        mutate: (input, marker) => {
          forkTerminationSourceEnvelope(
            input.governedSources,
            'baseContractPolicy',
          ).binding.sha256 = marker.repeat(64);
        },
      },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const combined = forkTerminationPhase3ReferenceValueMaterialisationFixture(
        fixture,
      );
      cases[index].mutate(combined, '0');
      if (index + 1 < cases.length) {
        cases[index + 1].mutate(combined, '1');
      }
      expectCode(cases[index].code, () => (
        profileAuthoring.prepareTerminationReferenceValueMaterialisationCandidate(
          combined,
        )
      ));
    }
  });

  assert.equal(
    t.name,
    'Phase3 reference value materialisation preserves the 221-slot Termination ledger as 220 consumable values and one private Company Letter gap without package activation',
  );
});

test('Phase3 Red Hat Company Letter source-discovery frontier preserves the sole Termination gap without inventing a candidate', (t) => {
  const authorityBytes = physicalBytes(
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING,
  );
  const authority = physicalRecord(
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(authority)}\n`, 'utf8'),
  );
  assertExactKeys(authority, [
    'authority_classification',
    'authority_state',
    'execution_scope',
    'external_citation_proof',
    'forbidden_authorisation_contract',
    'immutable_parent_bindings',
    'predecessor_company_stockholders_meeting_event_reference_value_candidate_binding',
    'private_source_acquisition_next_action',
    'retained_company_letter_source_frontier',
    'schema_version',
    'scoped_absence_finding',
    'sec_filing_census',
    'sec_filing_census_contract',
    'self_audit_plan',
    'source_discovery_basis',
    'termination_authoring_phase3_red_hat_company_letter_section_6_01_c_source_discovery_frontier_authority_id',
    'zero_effect_boundary',
  ], 'Red Hat Company Letter authority keys');
  assert.equal(
    authority.schema_version,
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING
      .schema_version,
  );
  assert.equal(
    authority
      .termination_authoring_phase3_red_hat_company_letter_section_6_01_c_source_discovery_frontier_authority_id,
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING
      .record_id,
  );
  const unsignedAuthority = structuredClone(authority);
  delete unsignedAuthority
    .termination_authoring_phase3_red_hat_company_letter_section_6_01_c_source_discovery_frontier_authority_id;
  assert.equal(
    contentId(authority.schema_version, unsignedAuthority),
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING
      .record_id,
  );
  assert.equal(
    authority.authority_classification,
    'OBSERVED_PUBLIC_SOURCE_DISCOVERY_EVIDENCE_ONLY_NO_SOURCE_ADMISSION_TARGET_SELECTION_VALUE_OR_WORK3_AUTHORITY',
  );
  assert.equal(
    authority.authority_state,
    'EVIDENCE_ONLY_NO_SEPARATELY_IDENTIFIED_ADMISSIBLE_COMPANY_LETTER_FOUND_UNDER_THE_FROZEN_PROCEDURE_IN_THE_EXACT_ENUMERATED_SEC_RESPONSES_PRIVATE_SOURCE_ACQUISITION_REQUIRED',
  );

  assertExactKeys(authority.immutable_parent_bindings, [
    'termination_authoring_phase3_company_stockholders_meeting_event_reference_value_authority',
  ], 'Red Hat Company Letter parent keys');
  assert.deepEqual(
    authority.immutable_parent_bindings
      .termination_authoring_phase3_company_stockholders_meeting_event_reference_value_authority,
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  const meetingAuthority = physicalRecord(
    TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING,
  );
  const predecessor = profileAuthoring
    .prepareTerminationCompanyStockholdersMeetingEventReferenceValueCandidate(
      terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(),
    );
  const predecessorBinding = {
    company_stockholders_meeting_event_reference_value_candidate_id:
      predecessor.company_stockholders_meeting_event_reference_value_candidate_id,
    company_stockholders_meeting_event_reference_value_count:
      predecessor.company_stockholders_meeting_event_reference_value_accounting
        .company_stockholders_meeting_event_reference_value_count,
    remaining_source_admission_gap_count:
      predecessor.company_stockholders_meeting_event_reference_value_accounting
        .remaining_source_admission_gap_count,
    remaining_source_normaliser_descriptor_count:
      predecessor.company_stockholders_meeting_event_reference_value_accounting
        .remaining_source_normaliser_descriptor_count,
    remaining_unresolved_reference_slot_count:
      predecessor.remaining_unresolved_reference_slots.length,
    remaining_unresolved_reference_slot_sha256: sha256Hex(
      Buffer.from(canonicalJson(predecessor.remaining_unresolved_reference_slots), 'utf8'),
    ),
    schema_version: predecessor.schema_version,
  };
  assert.deepEqual(
    predecessorBinding,
    authority
      .predecessor_company_stockholders_meeting_event_reference_value_candidate_binding,
  );
  assert.equal(
    predecessorBinding.company_stockholders_meeting_event_reference_value_candidate_id,
    'e50ffe7d3a0c0e55a702c5441ccc2d1b2a7d00efa6bebe4a3cc2dc6679bdd137',
  );
  const unsignedPredecessor = structuredClone(predecessor);
  delete unsignedPredecessor.company_stockholders_meeting_event_reference_value_candidate_id;
  assert.equal(Buffer.byteLength(canonicalJson(unsignedPredecessor), 'utf8'), 27642);
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(unsignedPredecessor), 'utf8')),
    '5a0716f5b6364352f57b2903613a5114a6940c2460977171b64da7447467684e',
  );
  assert.equal(Buffer.byteLength(canonicalJson(predecessorBinding), 'utf8'), 551);
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(predecessorBinding), 'utf8')),
    '6a71e42fe8985254ff87c9337e7e0c8d1755fb96e28b90c6edf03791db26f0d9',
  );

  const frontier = authority.retained_company_letter_source_frontier;
  assertExactKeys(frontier, [
    'retained_source_admission_gap_contract',
    'retained_source_admission_gaps',
    'retained_unresolved_reference_slot_contract',
    'retained_unresolved_reference_slots',
  ], 'Red Hat Company Letter frontier keys');
  assert.deepEqual(
    frontier.retained_unresolved_reference_slot_contract,
    meetingAuthority.remaining_unresolved_reference_slot_contract,
  );
  assert.deepEqual(
    frontier.retained_unresolved_reference_slots,
    meetingAuthority.remaining_unresolved_reference_slots,
  );
  assert.deepEqual(
    frontier.retained_source_admission_gap_contract,
    meetingAuthority.retained_source_admission_gap_contract,
  );
  assert.deepEqual(
    frontier.retained_source_admission_gaps,
    meetingAuthority.retained_source_admission_gaps,
  );
  assert.equal(frontier.retained_unresolved_reference_slots.length, 1);
  assert.equal(frontier.retained_source_admission_gaps.length, 1);
  assert.equal(
    Buffer.byteLength(canonicalJson(frontier.retained_unresolved_reference_slots), 'utf8'),
    541,
  );
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(frontier.retained_unresolved_reference_slots), 'utf8')),
    '22ffac79c5eccdaaf51c24fed0714643bd405e0a8260eab6975cc59e0ff40a62',
  );
  assert.equal(
    Buffer.byteLength(canonicalJson(frontier.retained_source_admission_gaps), 'utf8'),
    2885,
  );
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(frontier.retained_source_admission_gaps), 'utf8')),
    '406ba6f13e1218332a3c9ba7f34eb3ad30f86bce3b908beb4b5f4b453a8ebe1d',
  );
  const slot = frontier.retained_unresolved_reference_slots[0];
  const gap = frontier.retained_source_admission_gaps[0];
  assert.equal(
    slot.reference_slot_key,
    'b386c34a17e216f31b164dc1638a6a2310f357932aea083b923626e6ac0818ad',
  );
  assert.equal(
    gap.source_admission_gap_id,
    '9f7a5e21e19e105e6ed6e4a45ce50dea9be3d8ffc2a4b4e1ccba87d3efbfed3b',
  );
  assert.equal(slot.reference_slot_key, gap.reference_slot_key);
  assert.equal(slot.profile_key, gap.profile_key);
  assert.equal(slot.source_unit_key, gap.source_unit_key);
  assert.equal(slot.field_key, gap.field_key);
  assert.equal(
    contentId(
      frontier.retained_unresolved_reference_slot_contract.identity_domain,
      {
        profile_key: slot.profile_key,
        source_unit_key: slot.source_unit_key,
        field_key: slot.field_key,
      },
    ),
    slot.reference_slot_key,
  );
  const unsignedGap = structuredClone(gap);
  delete unsignedGap.source_admission_gap_id;
  assert.equal(
    contentId(frontier.retained_source_admission_gap_contract.identity_domain, unsignedGap),
    gap.source_admission_gap_id,
  );

  assertExactKeys(authority.external_citation_proof, [
    'exact_external_source_citation_occurrence',
    'rejected_main_agreement_reference_edge',
    'rejection_reason',
    'source_admission_state',
    'source_repair_needed',
    'source_unit_key',
  ], 'Red Hat Company Letter citation proof keys');
  assert.deepEqual(
    authority.external_citation_proof.exact_external_source_citation_occurrence,
    gap.source_admission_payload.exact_external_source_citation_occurrence,
  );
  assert.deepEqual(
    authority.external_citation_proof.rejected_main_agreement_reference_edge,
    gap.source_admission_payload.rejected_main_agreement_reference_edge,
  );
  assert.equal(
    authority.external_citation_proof
      .exact_external_source_citation_occurrence.occurrence_text,
    'jurisdictions identified on Section 6.01(c) of the Company Letter',
  );
  assert.equal(
    authority.external_citation_proof.rejected_main_agreement_reference_edge
      .reference_edge_id,
    '97e4987a752ab1ff0b02729ee8a4ce7c4e97aac23ee4b71f325f1d09864ee4ed',
  );
  assert.equal(
    authority.external_citation_proof.source_admission_state,
    'NO_ADMITTED_COMPANY_LETTER_SOURCE_BINDING_FOR_THIS_SUCCESSOR',
  );
  assert.equal(
    authority.external_citation_proof.source_unit_key,
    '77fd31b1daacccb607cfdf1e7469c583b6a63a790469c1ff49f2e5f95e7594bb',
  );
  const redHatM2Bytes = readFileSync(join(
    REPO_ROOT,
    'evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-index.json',
  ));
  const redHatM3Bytes = readFileSync(join(
    REPO_ROOT,
    'evidence/canonical-v2/stage-2y-structure-migration/shadow/m3/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.context-compilation.json',
  ));
  assert.equal(redHatM2Bytes.byteLength, 4631977);
  assert.equal(
    sha256Hex(redHatM2Bytes),
    '06c649dec40e3391f1d1da16b7b6eed6392f736a1d80a775fc9a141aa803e6a9',
  );
  assert.equal(redHatM3Bytes.byteLength, 24254198);
  assert.equal(
    sha256Hex(redHatM3Bytes),
    '9f514743d510c97746b3b76a1891e7ec5491b999463fa3debd86d85e1f1d80e4',
  );
  const redHatM2 = JSON.parse(redHatM2Bytes.toString('utf8'));
  const redHatM3 = JSON.parse(redHatM3Bytes.toString('utf8'));
  assert.equal(redHatM2Bytes.toString('utf8'), `${canonicalJson(redHatM2)}\n`);
  assert.equal(redHatM3Bytes.toString('utf8'), `${canonicalJson(redHatM3)}\n`);
  assert.equal(
    redHatM2.agreement_index_id,
    'e50464fb97dbd7ead5afc66292a42e5c37f47d3ccdc87d5842df7abef666b3b2',
  );
  const occurrence = authority.external_citation_proof
    .exact_external_source_citation_occurrence;
  const occurrenceNode = redHatM2.nodes.find(
    (node) => node.node_occurrence_id === occurrence.m2_node.node_occurrence_id,
  );
  assert.notEqual(occurrenceNode, undefined);
  assert.deepEqual({
    agreement_index_id: redHatM2.agreement_index_id,
    extent_span: occurrenceNode.extent_span,
    node_kind: occurrenceNode.node_kind,
    node_occurrence_id: occurrenceNode.node_occurrence_id,
    reference: occurrenceNode.reference,
  }, occurrence.m2_node);
  const canonicalTextBytes = Buffer.from(redHatM2.source_binding.canonical_text, 'utf8');
  assert.equal(
    canonicalTextBytes.byteLength,
    redHatM2.source_binding.canonical_text_byte_length,
  );
  assert.equal(
    sha256Hex(canonicalTextBytes),
    redHatM2.source_binding.canonical_text_sha256,
  );
  const occurrenceNodeBytes = canonicalTextBytes.subarray(
    occurrenceNode.extent_span.start_byte,
    occurrenceNode.extent_span.end_byte,
  );
  assert.equal(sha256Hex(occurrenceNodeBytes), occurrenceNode.extent_span.text_sha256);
  const occurrenceBytes = canonicalTextBytes.subarray(
    occurrence.occurrence_span.start_byte,
    occurrence.occurrence_span.end_byte,
  );
  assert.equal(occurrenceBytes.toString('utf8'), occurrence.occurrence_text);
  assert.equal(sha256Hex(occurrenceBytes), occurrence.occurrence_span.text_sha256);
  assert.equal(
    occurrence.occurrence_span.start_byte >= occurrenceNode.extent_span.start_byte
      && occurrence.occurrence_span.end_byte <= occurrenceNode.extent_span.end_byte,
    true,
  );
  const relativeOccurrenceStart =
    occurrence.occurrence_span.start_byte - occurrenceNode.extent_span.start_byte;
  assert.equal(occurrenceNodeBytes.indexOf(occurrenceBytes), relativeOccurrenceStart);
  assert.equal(
    occurrenceNodeBytes.indexOf(occurrenceBytes, relativeOccurrenceStart + 1),
    -1,
  );
  const rejectedEdges = redHatM3.reference_edges.filter(
    (edge) => edge.reference_edge_id ===
      authority.external_citation_proof.rejected_main_agreement_reference_edge
        .reference_edge_id,
  );
  assert.equal(rejectedEdges.length, 1);
  const rejectedEdge = rejectedEdges[0];
  assert.deepEqual(
    rejectedEdge,
    authority.external_citation_proof.rejected_main_agreement_reference_edge,
  );
  const sourceAnnotations = redHatM2.annotations.filter(
    (annotation) => annotation.annotation_occurrence_id ===
      rejectedEdge.source_annotation_occurrence_id,
  );
  assert.equal(sourceAnnotations.length, 1);
  const sourceAnnotation = sourceAnnotations[0];
  assert.equal(
    sourceAnnotation.annotation_occurrence_id,
    '17ec85c2d8cb55fc52894082f79dd4e786be8dd848fde845ef95a3528c92a97b',
  );
  assert.equal(sourceAnnotation.annotation_kind, 'SECTION_REFERENCE');
  assert.equal(sourceAnnotation.owner_node_occurrence_id, rejectedEdge.owner_node_occurrence_id);
  assert.equal(sourceAnnotation.value, '6.01(c)');
  assert.deepEqual(sourceAnnotation.span, rejectedEdge.source_span);
  const rejectedEdgeBytes = canonicalTextBytes.subarray(
    rejectedEdge.source_span.start_byte,
    rejectedEdge.source_span.end_byte,
  );
  assert.equal(rejectedEdgeBytes.toString('utf8'), rejectedEdge.raw_text);
  assert.equal(sha256Hex(rejectedEdgeBytes), rejectedEdge.source_span.text_sha256);
  assert.equal(
    rejectedEdge.source_span.start_byte >= occurrence.occurrence_span.start_byte
      && rejectedEdge.source_span.end_byte <= occurrence.occurrence_span.end_byte,
    true,
  );
  const rejectedTarget = redHatM2.nodes.find(
    (node) => node.node_occurrence_id === rejectedEdge.selected_target_node_occurrence_id,
  );
  assert.notEqual(rejectedTarget, undefined);
  assert.equal(rejectedEdge.state, 'RESOLVED');
  assert.deepEqual(
    rejectedEdge.target_node_occurrence_ids,
    [rejectedTarget.node_occurrence_id],
  );
  assert.equal(rejectedTarget.reference, '6.01(c)');
  assert.notEqual(rejectedTarget.node_occurrence_id, occurrenceNode.node_occurrence_id);

  const censusContract = authority.sec_filing_census_contract;
  assertExactKeys(censusContract, [
    'candidate_binding_exact_keys',
    'census_accounting_exact_keys',
    'census_row_exact_keys',
    'census_scope_exact_keys',
    'document_metadata_absence_counts_exact_keys',
    'embedded_packet_binding',
    'embedded_packet_root_exact_keys',
    'exact_accessions_in_order',
    'exact_census_zero_effect_boundary',
    'exact_counts',
    'exact_method_literals',
    'exact_non_inferences',
    'exact_scoped_conclusion',
    'exact_source_frontier_state',
    'exact_substantive_legal_question_count',
    'external_temp_packet_runtime_dependency_forbidden',
    'frontier_binding_exact_keys',
    'metadata_absence_predicates_exact_keys',
    'metadata_predicate_exact_keys',
    'method_exact_keys',
    'omission_notice_evidence_exact_keys',
    'public_document_exact_keys',
    'response_binding_exact_keys',
    'retrieval_policy_exact_keys',
    'source_span_exact_keys',
    'term_search_count_exact_keys',
    'term_search_counts_exact_keys',
    'text_document_evidence_exact_keys',
  ], 'Red Hat Company Letter census contract keys');
  const census = authority.sec_filing_census;
  assertExactKeys(census, [
    'candidate_binding',
    'census_accounting',
    'census_rows',
    'census_scope',
    'frontier_binding',
    'method',
    'non_inferences',
    'schema_version',
    'scoped_conclusion',
    'sec_public_source_census_packet_id',
    'source_frontier_state',
    'substantive_legal_question_count',
    'zero_effect_boundary',
  ], 'Red Hat Company Letter census packet keys');
  const censusBytes = Buffer.from(`${canonicalJson(census)}\n`, 'utf8');
  assert.equal(censusBytes.byteLength, 162259);
  assert.equal(
    sha256Hex(censusBytes),
    'bc5ddb1973108cb5690277fead3505d7c8f8b3a5a6834d1ce5fce2ff05686b03',
  );
  assert.equal(
    census.sec_public_source_census_packet_id,
    '7fad95a30f12727f8c677e75f3a366510797b04d352649c648ffb052bfe935bf',
  );
  const unsignedCensus = structuredClone(census);
  delete unsignedCensus.sec_public_source_census_packet_id;
  assert.equal(
    contentId(census.schema_version, unsignedCensus),
    census.sec_public_source_census_packet_id,
  );
  assert.deepEqual(census.candidate_binding, predecessorBinding);
  assert.deepEqual(censusContract.embedded_packet_binding, {
    byte_length: 162259,
    record_id: '7fad95a30f12727f8c677e75f3a366510797b04d352649c648ffb052bfe935bf',
    record_id_field: 'sec_public_source_census_packet_id',
    schema_version: 'M7_V2_TERMINATION_PHASE3_COMPANY_LETTER_SEC_PUBLIC_SOURCE_CENSUS/V1',
    sha256: 'bc5ddb1973108cb5690277fead3505d7c8f8b3a5a6834d1ce5fce2ff05686b03',
  });
  assert.equal(censusContract.external_temp_packet_runtime_dependency_forbidden, true);
  assert.deepEqual(census.method, censusContract.exact_method_literals);
  assert.equal(
    census.method.index_response_use,
    'BODY_BYTE_LENGTH_AND_SHA256_PIN_ONLY_INDEX_CONTENT_IS_NOT_PARSED_FOR_DOCUMENT_ENUMERATION',
  );
  assert.equal(
    census.method.response_body_retention,
    'NO_INDEX_COMPLETE_SUBMISSION_OR_INDIVIDUAL_DOCUMENT_RESPONSE_BODY_IS_RETAINED_IN_THIS_PACKET',
  );
  assert.equal(
    census.method.term_and_omission_evidence_status,
    'SEALED_RETRIEVAL_RUN_OBSERVATIONS_BOUND_TO_RESPONSE_BYTE_LENGTH_AND_SHA256_NOT_OFFLINE_RECOMPUTABLE_FROM_THIS_PACKET_ALONE',
  );
  assert.equal(
    census.method.raw_decoded_body_rule,
    'DECODE_EXACT_RESPONSE_BYTES_AS_UTF8_WITH_REPLACEMENT_THEN_COUNT_CASE_INSENSITIVE_NON_OVERLAPPING_LITERALS',
  );
  assert.equal(
    census.method.visible_text_decode_rule,
    'DECODE_USING_DECLARED_CONTENT_TYPE_CHARSET_IF_PRESENT_AND_VALID_OTHERWISE_UTF8_WITH_REPLACEMENT',
  );
  assert.equal(
    census.method.visible_text_normalisation,
    'HTML_PARSER_DATA_NODES_WITH_SCRIPT_STYLE_EXCLUDED_HTML_ENTITIES_DECODED_NBSP_TO_SPACE_AND_WHITESPACE_COLLAPSED',
  );
  assert.equal(
    census.method.search_case_rule,
    'CASE_INSENSITIVE_NON_OVERLAPPING_LITERAL_COUNT',
  );
  assert.equal(
    census.method.retrieval_policy_digest,
    '57656dea722cfb390a8c869c39177e0d4d91ec7a110983a49e8f096a32625c45',
  );
  assertExactKeys(census.method.metadata_absence_predicates, [
    'match_rule',
    'predicate_language',
    'predicates',
    'surface_fields_in_order',
    'surface_join',
    'surface_normalisation',
    'surface_python3_expression',
  ], 'SEC metadata predicate contract keys');
  assert.deepEqual(
    census.method.metadata_absence_predicates.surface_fields_in_order,
    ['type', 'filename', 'description'],
  );
  assert.equal(
    census.method.metadata_absence_predicates.surface_join,
    'NON_NULL_VALUES_JOINED_WITH_ONE_ASCII_SPACE',
  );
  assert.equal(
    census.method.metadata_absence_predicates.surface_normalisation,
    'COLLAPSE_UNICODE_WHITESPACE_TRIM_AND_UNICODE_CASEFOLD',
  );
  assert.deepEqual(
    census.method.metadata_absence_predicates.predicates.map((predicate) => ({
      count_key: predicate.count_key,
      literals: predicate.literals,
    })),
    [
      {
        count_key: 'separate_company_letter_document_count',
        literals: ['company letter'],
      },
      {
        count_key: 'separate_disclosure_letter_document_count',
        literals: ['disclosure letter'],
      },
      {
        count_key: 'separate_section_6_01_c_jurisdiction_list_document_count',
        literals: ['6.01(c)', '6_01_c', 'jurisdiction list'],
      },
    ],
  );

  const expectedAccessions = [
    '0001193125-18-310577',
    '0001193125-18-310579',
    '0001104659-18-064384',
    '0001193125-18-310738',
    '0001193125-18-310748',
    '0001193125-18-310755',
    '0001193125-18-310760',
    '0001193125-18-310773',
    '0001193125-18-311007',
    '0001193125-18-312328',
    '0001193125-18-312632',
    '0001193125-18-315726',
    '0001193125-18-316142',
    '0001193125-18-317212',
    '0001193125-18-320094',
    '0001193125-18-322866',
    '0001193125-18-332626',
    '0001193125-18-339886',
    '0001193125-18-347874',
    '0001193125-19-002581',
    '0001193125-19-010422',
    '0000950142-19-001515',
    '0000950142-19-001516',
  ];
  assert.deepEqual(censusContract.exact_accessions_in_order, expectedAccessions);
  assert.deepEqual(census.census_scope.exact_accessions_in_order, expectedAccessions);
  assert.deepEqual(census.census_rows.map((row) => row.accession), expectedAccessions);
  assert.equal(census.census_scope.accession_count_ceiling, 23);
  assert.equal(census.census_scope.all_sec_filings_exhaustiveness_claim, false);
  assert.equal(census.census_scope.universe_beyond_exact_accessions_claim, 'NONE');

  const rowKeys = [
    'acceptance_datetime',
    'accession',
    'accession_term_search_aggregate_over_individually_fetched_non_graphic_documents',
    'cik',
    'complete_submission_response_binding',
    'complete_submission_url',
    'document_metadata_absence_counts',
    'filer',
    'filing_date',
    'form',
    'index_response_binding',
    'index_url',
    'omission_notice_occurrence_count',
    'ordered_public_documents',
    'parsed_document_block_count',
    'public_document_count',
    'public_document_count_equals_parsed_document_block_count',
    'text_document_evidence',
  ];
  const responseKeys = [
    'content_type',
    'final_url',
    'redirect_count',
    'response_byte_length',
    'response_bytes_sha256',
    'retrieval_policy_digest',
    'retrieval_url',
    'retrieved_at',
    'status_code',
  ];
  const documentKeys = [
    'description',
    'direct_url',
    'filename',
    'individual_response_binding',
    'individual_response_not_fetched_reason',
    'sequence',
    'type',
  ];
  const evidenceKeys = [
    'direct_url',
    'filename',
    'observation_state',
    'omission_notice_evidence',
    'response_binding',
    'term_search_counts',
    'visible_text_normalisation',
  ];
  const termKeys = [
    'case_insensitive_normalised_visible_text_count',
    'case_insensitive_raw_decoded_body_count',
    'term',
  ];
  assert.deepEqual(censusContract.census_row_exact_keys, rowKeys);
  assert.deepEqual(censusContract.response_binding_exact_keys, responseKeys);
  assert.deepEqual(censusContract.public_document_exact_keys, documentKeys);
  assert.deepEqual(censusContract.text_document_evidence_exact_keys, evidenceKeys);
  assert.deepEqual(censusContract.term_search_count_exact_keys, termKeys);
  assert.deepEqual(censusContract.omission_notice_evidence_exact_keys, [
    'exact_text',
    'response_role',
    'source_span',
  ]);
  assert.deepEqual(censusContract.source_span_exact_keys, [
    'coordinate_system',
    'end_byte',
    'start_byte',
    'text_sha256',
  ]);

  let publicDocumentCount = 0;
  let fetchedDocumentCount = 0;
  let graphicDocumentCount = 0;
  let omissionCount = 0;
  const successfulResponses = [];
  const metadataCounts = {
    separate_company_letter_document_count: 0,
    separate_disclosure_letter_document_count: 0,
    separate_section_6_01_c_jurisdiction_list_document_count: 0,
  };
  const expectedTerms = {
    company_letter: 'Company Letter',
    disclosure_letter: 'Disclosure Letter',
    exact_external_jurisdiction_phrase:
      'jurisdictions identified on Section 6.01(c) of the Company Letter',
    section_6_01_c: 'Section 6.01(c)',
  };
  assert.deepEqual(census.method.search_terms, expectedTerms);
  const omissionObservations = [];
  for (const row of census.census_rows) {
    assertExactKeys(row, rowKeys, `${row.accession} census row keys`);
    successfulResponses.push(row.index_response_binding);
    successfulResponses.push(row.complete_submission_response_binding);
    assert.equal(row.public_document_count, row.ordered_public_documents.length);
    assert.equal(row.parsed_document_block_count, row.ordered_public_documents.length);
    assert.equal(row.public_document_count_equals_parsed_document_block_count, true);
    publicDocumentCount += row.ordered_public_documents.length;
    assertExactKeys(row.document_metadata_absence_counts, [
      'separate_company_letter_document_count',
      'separate_disclosure_letter_document_count',
      'separate_section_6_01_c_jurisdiction_list_document_count',
    ], `${row.accession} metadata-count keys`);
    const rowMetadataCounts = {
      separate_company_letter_document_count: 0,
      separate_disclosure_letter_document_count: 0,
      separate_section_6_01_c_jurisdiction_list_document_count: 0,
    };
    let rowFetchedDocumentCount = 0;
    for (const document of row.ordered_public_documents) {
      assertExactKeys(document, documentKeys, `${row.accession} document keys`);
      if (document.type === 'GRAPHIC') {
        graphicDocumentCount += 1;
        assert.equal(document.individual_response_binding, null);
        assert.equal(
          document.individual_response_not_fetched_reason,
          'GRAPHIC_DOCUMENT_ENUMERATED_FROM_SEC_COMPLETE_SUBMISSION_ONLY',
        );
      } else {
        fetchedDocumentCount += 1;
        rowFetchedDocumentCount += 1;
        assert.notEqual(document.individual_response_binding, null);
        assert.equal(document.individual_response_not_fetched_reason, null);
        successfulResponses.push(document.individual_response_binding);
      }
      const metadataParts = [document.type, document.filename, document.description]
        .filter((value) => value !== null && value !== undefined);
      assert.equal(
        metadataParts.every((value) => (
          typeof value === 'string' && /^[\x00-\x7f]*$/u.test(value)
        )),
        true,
      );
      const metadataSurface = metadataParts
        .join(' ')
        .replace(/\s+/gu, ' ')
        .trim()
        .toLocaleLowerCase('und');
      if (metadataSurface.includes('company letter')) {
        rowMetadataCounts.separate_company_letter_document_count += 1;
      }
      if (metadataSurface.includes('disclosure letter')) {
        rowMetadataCounts.separate_disclosure_letter_document_count += 1;
      }
      if (
        ['6.01(c)', '6_01_c', 'jurisdiction list']
          .some((literal) => metadataSurface.includes(literal))
      ) {
        rowMetadataCounts
          .separate_section_6_01_c_jurisdiction_list_document_count += 1;
      }
    }
    assert.deepEqual(row.document_metadata_absence_counts, rowMetadataCounts);
    for (const [key, value] of Object.entries(rowMetadataCounts)) {
      metadataCounts[key] += value;
    }
    assert.equal(row.text_document_evidence.length, rowFetchedDocumentCount);
    const rowTermAggregate = Object.fromEntries(
      Object.entries(expectedTerms).map(([key, term]) => [key, {
        case_insensitive_normalised_visible_text_count: 0,
        case_insensitive_raw_decoded_body_count: 0,
        term,
      }]),
    );
    for (const evidence of row.text_document_evidence) {
      assertExactKeys(evidence, evidenceKeys, `${row.accession} evidence keys`);
      assertExactKeys(evidence.term_search_counts, [
        'company_letter',
        'disclosure_letter',
        'exact_external_jurisdiction_phrase',
        'section_6_01_c',
      ], `${row.accession} term-map keys`);
      for (const [termKey, termCount] of Object.entries(evidence.term_search_counts)) {
        assertExactKeys(termCount, termKeys, `${row.accession} term-count keys`);
        assert.equal(termCount.term, expectedTerms[termKey]);
        assert.equal(
          Number.isInteger(termCount.case_insensitive_normalised_visible_text_count)
            && termCount.case_insensitive_normalised_visible_text_count >= 0,
          true,
        );
        assert.equal(
          Number.isInteger(termCount.case_insensitive_raw_decoded_body_count)
            && termCount.case_insensitive_raw_decoded_body_count >= 0,
          true,
        );
        rowTermAggregate[termKey]
          .case_insensitive_normalised_visible_text_count +=
            termCount.case_insensitive_normalised_visible_text_count;
        rowTermAggregate[termKey]
          .case_insensitive_raw_decoded_body_count +=
            termCount.case_insensitive_raw_decoded_body_count;
      }
      for (const omission of evidence.omission_notice_evidence) {
        omissionCount += 1;
        assertExactKeys(omission, [
          'exact_text',
          'response_role',
          'source_span',
        ], `${row.accession} omission keys`);
        assertExactKeys(omission.source_span, [
          'coordinate_system',
          'end_byte',
          'start_byte',
          'text_sha256',
        ], `${row.accession} omission span keys`);
        assert.equal(
          omission.source_span.end_byte - omission.source_span.start_byte,
          Buffer.byteLength(omission.exact_text, 'utf8'),
        );
        assert.equal(omission.source_span.text_sha256, sha256Hex(omission.exact_text));
        assert.equal(
          omission.response_role,
          'INDIVIDUAL_PUBLIC_DOCUMENT_NORMALISED_VISIBLE_TEXT',
        );
        assert.equal(
          omission.source_span.coordinate_system,
          'UTF8_NORMALISED_VISIBLE_TEXT_HALF_OPEN',
        );
        omissionObservations.push({
          accession: row.accession,
          exact_text: omission.exact_text,
          filename: evidence.filename,
          source_span: omission.source_span,
        });
      }
    }
    assert.deepEqual(
      row.accession_term_search_aggregate_over_individually_fetched_non_graphic_documents,
      rowTermAggregate,
    );
  }
  assert.deepEqual(omissionObservations, [
    {
      accession: '0001193125-18-310577',
      exact_text:
        'Schedules have been omitted pursuant to Item 601(b)(2) of Regulation S-K. The Company hereby undertakes to furnish supplementally copies of any of the omitted schedules upon request by SEC.',
      filename: 'd640856d8k.htm',
      source_span: {
        coordinate_system: 'UTF8_NORMALISED_VISIBLE_TEXT_HALF_OPEN',
        end_byte: 19728,
        start_byte: 19539,
        text_sha256:
          'fb8e450d13cc3e6a5be64d61782173183c4c42d5dff09693a8a8a72e0d42fe96',
      },
    },
    {
      accession: '0001193125-18-310579',
      exact_text:
        'Schedules have been omitted pursuant to Item 601(b)(2) of Regulation S-K. The Company hereby undertakes to furnish supplementally copies of any of the omitted schedules upon request by SEC.',
      filename: 'd640856d8k.htm',
      source_span: {
        coordinate_system: 'UTF8_NORMALISED_VISIBLE_TEXT_HALF_OPEN',
        end_byte: 19732,
        start_byte: 19543,
        text_sha256:
          'fb8e450d13cc3e6a5be64d61782173183c4c42d5dff09693a8a8a72e0d42fe96',
      },
    },
    {
      accession: '0001104659-18-064384',
      exact_text:
        'Schedules have been omitted pursuant to Item 601(b)(2) of Regulation S-K. IBM hereby undertakes to furnish supplementally copies of any of the omitted schedules upon request by the SEC.',
      filename: 'a18-37205_28k.htm',
      source_span: {
        coordinate_system: 'UTF8_NORMALISED_VISIBLE_TEXT_HALF_OPEN',
        end_byte: 14297,
        start_byte: 14112,
        text_sha256:
          'bf39b4f852b89cbdc666fd102eabf2d95b28fd90e71dcbf086c4e77fe5dde155',
      },
    },
  ]);
  for (const response of successfulResponses) {
    assertExactKeys(response, responseKeys, 'SEC response keys');
    assert.equal(response.status_code, 200);
    assert.equal(response.redirect_count, 0);
    assert.equal(response.retrieval_url, response.final_url);
    assert.equal(response.retrieval_policy_digest, census.method.retrieval_policy_digest);
  }
  assert.equal(census.census_rows.length, 23);
  assert.equal(publicDocumentCount, 67);
  assert.equal(fetchedDocumentCount, 32);
  assert.equal(graphicDocumentCount, 35);
  assert.equal(successfulResponses.length, 78);
  assert.equal(omissionCount, 3);
  assert.deepEqual(metadataCounts, {
    separate_company_letter_document_count: 0,
    separate_disclosure_letter_document_count: 0,
    separate_section_6_01_c_jurisdiction_list_document_count: 0,
  });
  assert.deepEqual(censusContract.exact_counts, {
    accession_count: 23,
    exact_separate_company_letter_document_count: 0,
    exact_separate_disclosure_letter_document_count: 0,
    exact_separate_section_6_01_c_jurisdiction_list_document_count: 0,
    fetched_non_graphic_document_count: 32,
    graphic_document_count_enumerated_but_not_individually_fetched: 35,
    omission_notice_occurrence_count: 3,
    public_document_count: 67,
    successful_http_response_count: 78,
  });
  assert.deepEqual(census.census_accounting, {
    accession_count: 23,
    exact_separate_company_letter_document_count: 0,
    exact_separate_disclosure_letter_document_count: 0,
    exact_separate_section_6_01_c_jurisdiction_list_document_count: 0,
    fetched_non_graphic_document_count: 32,
    graphic_document_count_enumerated_but_not_individually_fetched: 35,
    omission_notice_occurrence_count: 3,
    public_document_count: 67,
  });
  const expectedNonInferences = [
    'DO_NOT_INFER_THAT_THE_PRIVATE_COMPANY_LETTER_DID_NOT_EXIST',
    'DO_NOT_INFER_THE_CONTENTS_OF_THE_PRIVATE_COMPANY_LETTER_OR_ITS_SECTION_6_01_C',
    'DO_NOT_SELECT_A_JURISDICTION_LIST_REFERENCE_TARGET_FROM_THE_MAIN_MERGER_AGREEMENT',
    'DO_NOT_TREAT_AN_OMITTED_SCHEDULE_UNDERTAKING_AS_PUBLICATION_OR_ADMISSION_OF_THE_OMITTED_MATERIAL',
    'DO_NOT_GENERALISE_BEYOND_THE_INSPECTED_SEC_ACCESSIONS_AND_PUBLIC_DOCUMENTS',
  ];
  assert.deepEqual(census.non_inferences, expectedNonInferences);
  assert.deepEqual(censusContract.exact_non_inferences, expectedNonInferences);
  assert.deepEqual(
    census.zero_effect_boundary,
    censusContract.exact_census_zero_effect_boundary,
  );
  assert.deepEqual(census.zero_effect_boundary, {
    database_write_count: 0,
    governed_command_execution_count: 0,
    network_write_count: 0,
    product_write_count: 0,
    repository_write_count: 0,
    successful_http_response_accounting_scope:
      'THIS_SEALED_PACKET_GENERATION_RUN_ONLY_RETRIES_AND_PRIOR_EXPLORATORY_READS_EXCLUDED',
    successful_http_response_count: 78,
    system_temp_packet_write_count: 1,
    work3_identity_count: 0,
    work3_typed_fact_count: 0,
    work3_typed_reference_value_count: 0,
  });
  assert.equal(census.zero_effect_boundary.successful_http_response_count, 78);
  assert.equal(census.substantive_legal_question_count, 0);
  assert.equal(
    census.scoped_conclusion,
    'NO_SEPARATELY_FILED_ADMISSIBLE_PUBLIC_SEC_COMPANY_LETTER_OR_SECTION_6_01_C_JURISDICTION_LIST_FOUND_IN_THE_EXACT_ENUMERATED_BOUND_IBM_RED_HAT_MERGER_RESPONSES',
  );
  assert.equal(censusContract.exact_scoped_conclusion, census.scoped_conclusion);
  assert.equal(
    census.source_frontier_state,
    'ONE_EXTERNAL_COMPANY_LETTER_SOURCE_ADMISSION_GAP_RETAINS_TARGET_SELECTION_AND_WORK3_MATERIALISATION_WITHHELD',
  );
  assert.equal(censusContract.exact_source_frontier_state, census.source_frontier_state);
  assert.equal(
    censusContract.exact_substantive_legal_question_count,
    census.substantive_legal_question_count,
  );

  const finding = authority.scoped_absence_finding;
  assertExactKeys(finding, [
    'all_sec_filings_exhaustiveness_claim',
    'exact_accession_count_ceiling',
    'exact_separate_company_letter_document_count',
    'exact_separate_disclosure_letter_document_count',
    'exact_separate_section_6_01_c_jurisdiction_list_document_count',
    'exact_successful_http_response_observation_count',
    'fetched_non_graphic_document_count',
    'graphic_document_count_enumerated_as_metadata_only',
    'index_body_document_enumeration_claim',
    'omission_notice_observation_count',
    'private_company_letter_existence_claim',
    'public_document_count',
    'response_body_retained_for_offline_re_slice',
    'scope_rule',
    'source_admission_state',
    'state',
    'target_selection_state',
    'term_absence_claim',
    'universe_beyond_exact_accessions_claim',
  ], 'Red Hat Company Letter scoped-finding keys');
  assert.equal(finding.all_sec_filings_exhaustiveness_claim, false);
  assert.equal(finding.exact_accession_count_ceiling, 23);
  assert.equal(finding.public_document_count, 67);
  assert.equal(finding.fetched_non_graphic_document_count, 32);
  assert.equal(finding.graphic_document_count_enumerated_as_metadata_only, 35);
  assert.equal(finding.exact_successful_http_response_observation_count, 78);
  assert.equal(finding.omission_notice_observation_count, 3);
  assert.equal(finding.private_company_letter_existence_claim, 'NONE');
  assert.equal(finding.term_absence_claim, 'NONE');
  assert.equal(finding.universe_beyond_exact_accessions_claim, 'NONE');
  assert.equal(finding.index_body_document_enumeration_claim, false);
  assert.equal(finding.response_body_retained_for_offline_re_slice, false);
  assert.equal(
    finding.scope_rule,
    'ONLY_THE_EXACT_TWENTY_THREE_ENUMERATED_ACCESSIONS_AND_SEVENTY_EIGHT_BOUND_SUCCESSFUL_SEC_RESPONSES',
  );
  assert.equal(
    finding.source_admission_state,
    'WITHHELD_NO_ADMITTED_COMPANY_LETTER_SOURCE_BINDING',
  );
  assert.equal(
    finding.target_selection_state,
    'WITHHELD_PENDING_EXACT_COMPANY_LETTER_SOURCE_ADMISSION_AND_M2_INDEX',
  );
  assert.equal(
    finding.state,
    'NO_SEPARATELY_IDENTIFIED_ADMISSIBLE_COMPANY_LETTER_FOUND_UNDER_THE_FROZEN_METADATA_AND_BODY_SEARCH_PROCEDURE_IN_THE_EXACT_ENUMERATED_SEC_RESPONSES',
  );
  const sourceBasis = authority.source_discovery_basis;
  assertExactKeys(sourceBasis, [
    'basis_classification',
    'evidence_observation_date',
    'exact_scope_rule',
    'legal_ruling_created',
    'source_admission_authority_created',
    'source_candidate_authority_created',
    'substantive_legal_question_required',
    'target_selection_authority_created',
    'value_authority_created',
    'work3_authority_created',
  ], 'Red Hat Company Letter source-basis keys');
  assert.equal(
    sourceBasis.basis_classification,
    'FACTUAL_SEC_RESPONSE_OBSERVATION_NOT_APPROVAL_OR_LEGAL_RULING',
  );
  assert.equal(sourceBasis.evidence_observation_date, '2026-08-20');
  for (const key of [
    'legal_ruling_created',
    'source_admission_authority_created',
    'source_candidate_authority_created',
    'substantive_legal_question_required',
    'target_selection_authority_created',
    'value_authority_created',
    'work3_authority_created',
  ]) assert.equal(sourceBasis[key], false, key);
  assert.equal(
    Object.hasOwn(authority, 'approval_basis'),
    false,
  );
  const nextAction = authority.private_source_acquisition_next_action;
  assertExactKeys(nextAction, [
    'current_acquisition_authority_granted',
    'current_fetch_authority_granted',
    'current_m2_construction_authority_granted',
    'current_repository_write_authority_granted',
    'current_source_admission_authority_granted',
    'current_target_selection_authority_granted',
    'future_condition',
    'future_private_source_or_later_public_filing_condition_required_before_any_source_admission',
    'required_sequence_after_future_condition',
    'state',
  ], 'Red Hat Company Letter next-action keys');
  for (const key of [
    'current_acquisition_authority_granted',
    'current_fetch_authority_granted',
    'current_m2_construction_authority_granted',
    'current_repository_write_authority_granted',
    'current_source_admission_authority_granted',
    'current_target_selection_authority_granted',
  ]) assert.equal(nextAction[key], false, key);
  assert.equal(
    nextAction.future_private_source_or_later_public_filing_condition_required_before_any_source_admission,
    true,
  );
  assert.equal(
    nextAction.future_condition,
    'EXACT_COMPANY_LETTER_BYTES_ARE_OBTAINED_FROM_AN_AUTHORISED_PRIVATE_SOURCE_OR_A_LATER_PUBLIC_FILING',
  );
  assert.equal(
    nextAction.state,
    'FUTURE_CONDITION_ONLY_NO_CURRENT_ACQUISITION_FETCH_WRITE_ADMISSION_M2_OR_TARGET_SELECTION_AUTHORITY',
  );
  assert.deepEqual(nextAction.required_sequence_after_future_condition, [
    'VERIFY_EXACT_SOURCE_PROVENANCE_AND_BYTES',
    'SELECT_THE_EXISTING_SEC_HTML_INTAKE_LANE_ONLY_IF_THE_SOURCE_SATISFIES_ITS_EXACT_FORMAT_AND_HOST_CONTRACT_OTHERWISE_REQUIRE_A_FORMAT_SPECIFIC_ADMISSION_AUTHORITY',
    'RUN_SOURCE_INTAKE_CONVERSION_CANONICAL_BYTE_VERIFICATION_AND_SOURCE_ADMISSION',
    'BUILD_M2_ONLY_AFTER_SOURCE_ADMISSION',
    'RETURN_FOR_SEPARATE_REFERENCE_TARGET_SELECTION_REVIEW',
  ]);

  const effects = authority.zero_effect_boundary;
  assertExactKeys(effects, [
    'activation_count',
    'candidate_registration_count',
    'database_write_count',
    'effect_scope',
    'executable_semantics_count',
    'family_package_count',
    'network_read_count',
    'network_write_count',
    'new_canonical_source_document_count',
    'new_m2_agreement_index_count',
    'new_m3_context_compilation_count',
    'new_public_seam_count',
    'new_reference_target_selection_count',
    'new_reference_value_count',
    'new_source_admission_bundle_count',
    'new_source_admission_manifest_count',
    'new_source_candidate_count',
    'new_source_document_count',
    'product_write_count',
    'repository_write_count',
    'retained_company_letter_source_admission_gap_count',
    'retained_unresolved_reference_slot_count',
    'substantive_legal_question_count',
    'work3_identity_count',
    'work3_member_id_count',
    'work3_typed_fact_count',
    'work3_typed_reference_value_count',
  ], 'Red Hat Company Letter zero-effect keys');
  assert.equal(effects.retained_company_letter_source_admission_gap_count, 1);
  assert.equal(effects.retained_unresolved_reference_slot_count, 1);
  assert.equal(
    effects.effect_scope,
    'SEMANTIC_AND_RUNTIME_OUTPUT_EFFECTS_ONLY_AUTHORISED_AUTHORITY_AND_TEST_FILE_WRITES_AND_THE_PRIOR_SEALED_CENSUS_PACKET_RETRIEVAL_RUN_ARE_ACCOUNTED_SEPARATELY',
  );
  for (const [key, value] of Object.entries(effects)) {
    if (
      key === 'effect_scope'
      || key === 'retained_company_letter_source_admission_gap_count'
      || key === 'retained_unresolved_reference_slot_count'
    ) continue;
    assert.equal(value, 0, key);
  }

  const forbidden = authority.forbidden_authorisation_contract;
  assertExactKeys(forbidden, [
    'allowed_embedded_existing_evidence',
    'approval_or_legal_ruling_created',
    'external_source_acquisition_authorised',
    'forbidden_keys_anywhere',
    'forbidden_new_output_classes',
    'forbidden_schema_versions_anywhere',
    'new_target_node_occurrence_id_forbidden',
    'predecessor_candidate_exemption_rule',
    'retained_reference_edge_rule',
    'scan_exemptions',
    'source_admission_authorised',
    'source_candidate_creation_authorised',
    'target_selection_authorised',
    'value_creation_authorised',
    'work3_materialisation_authorised',
  ], 'Red Hat Company Letter forbidden-contract keys');
  assert.deepEqual(forbidden.forbidden_keys_anywhere, [
    'activation_id',
    'agreement_index_id',
    'approval_decision_id',
    'ben_approval_id',
    'context_compilation_id',
    'external_approval_id',
    'family_approval_id',
    'family_profile_package_id',
    'fixture_id',
    'immutable_source_document_id',
    'lawyer_ruling_id',
    'profile_id',
    'proposed_reference_target_string',
    'registration_id',
    'semantic_fact_key',
    'source_admission_bundle_id',
    'source_admission_manifest_id',
    'source_candidate_id',
    'typed_facts',
    'typed_value',
  ]);
  assert.deepEqual(forbidden.forbidden_schema_versions_anywhere, [
    'STAGE_2Y_M7_SOURCE_CANDIDATE/V1',
    'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1',
    'IMMUTABLE_SOURCE_DOCUMENT/V2',
    'SOURCE_ADMISSION_MANIFEST/V2',
    'AGREEMENT_INDEX/V1',
    'CONTEXT_COMPILATION/V1',
    'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1',
    'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
    'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
    'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1',
    'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
    'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
    'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1',
  ]);
  assert.deepEqual(forbidden.allowed_embedded_existing_evidence, [
    'FINAL_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CANDIDATE_BINDING',
    'EXACT_RETAINED_B386_UNRESOLVED_REFERENCE_SLOT_AND_CONTRACT',
    'EXACT_RETAINED_9F7A_SOURCE_ADMISSION_GAP_AND_CONTRACT',
    'EXACT_77FD_EXTERNAL_CITATION_AND_REJECTED_MAIN_AGREEMENT_REFERENCE_EDGE',
    'EXACT_EMBEDDED_SEC_PUBLIC_SOURCE_CENSUS_PACKET',
  ]);
  assert.deepEqual(forbidden.forbidden_new_output_classes, [
    'SOURCE_CANDIDATE',
    'PUBLIC_SOURCE_DISCOVERY_SEAM',
    'SOURCE_ADMISSION_BUNDLE',
    'SOURCE_ADMISSION_MANIFEST',
    'IMMUTABLE_SOURCE_DOCUMENT',
    'CANONICAL_SOURCE_DOCUMENT',
    'M2_AGREEMENT_INDEX',
    'M3_CONTEXT_COMPILATION',
    'REFERENCE_TARGET_SELECTION',
    'REFERENCE_VALUE',
    'WORK3_FIXTURE',
    'WORK3_TYPED_FACT',
    'WORK3_IDENTITY',
    'FAMILY_PACKAGE',
    'CANDIDATE_REGISTRATION',
    'ACTIVATION',
  ]);
  assert.deepEqual(forbidden.scan_exemptions, [
    'predecessor_company_stockholders_meeting_event_reference_value_candidate_binding',
    'external_citation_proof',
    'retained_company_letter_source_frontier',
  ]);
  assert.equal(forbidden.approval_or_legal_ruling_created, false);
  assert.equal(forbidden.external_source_acquisition_authorised, false);
  assert.equal(forbidden.source_admission_authorised, false);
  assert.equal(forbidden.source_candidate_creation_authorised, false);
  assert.equal(forbidden.target_selection_authorised, false);
  assert.equal(forbidden.value_creation_authorised, false);
  assert.equal(forbidden.work3_materialisation_authorised, false);
  assert.equal(forbidden.new_target_node_occurrence_id_forbidden, true);
  assert.equal(forbidden.forbidden_keys_anywhere.length, 20);
  assert.equal(forbidden.forbidden_schema_versions_anywhere.length, 13);
  assert.equal(forbidden.forbidden_new_output_classes.length, 16);
  assert.equal(
    forbidden.predecessor_candidate_exemption_rule,
    'THE_EXISTING_E50FFE7D_COMPANY_STOCKHOLDERS_MEETING_EVENT_CANDIDATE_MAY_APPEAR_ONLY_AS_THE_EXACT_SEVEN_KEY_BINDING_AND_IS_NOT_RECREATED_OR_REAUTHORISED',
  );
  assert.equal(
    forbidden.retained_reference_edge_rule,
    'THE_EXISTING_97E4987A_MAIN_AGREEMENT_EDGE_IS_REJECTED_EVIDENCE_ONLY_AND_MUST_NOT_BECOME_A_TARGET_SELECTION',
  );
  const scanned = structuredClone(authority);
  for (const key of forbidden.scan_exemptions) delete scanned[key];
  delete scanned.forbidden_authorisation_contract.forbidden_schema_versions_anywhere;
  function assertNoForbiddenSurface(value, path = []) {
    if (typeof value === 'string') {
      assert.equal(
        forbidden.forbidden_schema_versions_anywhere.includes(value),
        false,
        `forbidden schema at ${path.join('.')}`,
      );
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((member, index) => assertNoForbiddenSurface(member, [...path, index]));
      return;
    }
    for (const [key, member] of Object.entries(value)) {
      assert.equal(
        forbidden.forbidden_keys_anywhere.includes(key),
        false,
        `forbidden key at ${[...path, key].join('.')}`,
      );
      assertNoForbiddenSurface(member, [...path, key]);
    }
  }
  assertNoForbiddenSurface(scanned);

  const scope = authority.execution_scope;
  assertExactKeys(scope, [
    'additional_governed_command_count',
    'all_other_commands_forbidden',
    'authorised_write_path_count',
    'authorised_write_paths',
    'authority_record_create_once_path',
    'consumed_governed_command_count',
    'exact_governed_command_count',
    'governed_command_budget_reset_forbidden',
    'implementation_write_paths_after_authority_creation',
    'maximum_runs_per_command',
    'named_test',
      'no_unlisted_write_path',
      'ordered_executions',
      'post_correction_execution_observability_recovery_lineage',
      'post_recovery_offline_audit_transport_correction_lineage',
      'pre_activation_correction_lineage',
    'production_write_path_count',
    'production_write_paths',
    'red_or_nonzero_exit_authority_count',
    'remaining_governed_command_count',
    'retry_forbidden',
    'state',
  ], 'Red Hat Company Letter execution-scope keys');
  assert.equal(scope.named_test, t.name);
  assert.equal(scope.additional_governed_command_count, 0);
  assert.equal(scope.consumed_governed_command_count, 0);
  assert.equal(scope.exact_governed_command_count, 6);
  assert.equal(scope.remaining_governed_command_count, 6);
  assert.equal(scope.maximum_runs_per_command, 1);
  assert.equal(scope.red_or_nonzero_exit_authority_count, 0);
  assert.equal(scope.all_other_commands_forbidden, true);
  assert.equal(scope.governed_command_budget_reset_forbidden, true);
  assert.equal(scope.no_unlisted_write_path, true);
  assert.equal(scope.retry_forbidden, true);
  assert.equal(
    scope.state,
    'SUPERSEDING_EVIDENCE_ONLY_ZERO_EFFECT_OFFLINE_AUDIT_TRANSPORT_RECOVERY_SCOPED_TDD_NOT_A_RETRY_OR_BUDGET_RESET',
  );
  assert.equal(scope.authorised_write_path_count, 2);
  assert.deepEqual(scope.authorised_write_paths, [
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.path,
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  assert.equal(
    scope.authority_record_create_once_path,
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.path,
  );
  assert.deepEqual(scope.implementation_write_paths_after_authority_creation, [
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  assert.equal(scope.production_write_path_count, 0);
  assert.deepEqual(scope.production_write_paths, []);

  const lineage = scope.pre_activation_correction_lineage;
  assertExactKeys(lineage, [
    'candidate_identity_correction',
    'correction_classification',
    'failed_execution_observation',
    'historical_and_superseding_schedule_accounting',
    'schema_version',
    'state',
    'subsequent_execution_disposition',
    'superseded_authority_binding',
    'supersession_rule',
    'zero_effect_boundary',
  ], 'Red Hat Company Letter correction-lineage keys');
  assert.equal(
    lineage.schema_version,
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PRE_ACTIVATION_CORRECTION_LINEAGE/V1',
  );
  assert.equal(
    lineage.correction_classification,
    'PRE_ACTIVATION_EVIDENCE_AUTHORITY_PIN_CORRECTION_NO_PRODUCTION_OR_SEMANTIC_CHANGE',
  );
  assert.equal(
    lineage.state,
    'SEALED_OLD_AUTHORITY_SUPERSEDED_AFTER_FIRST_PHYSICAL_AUDIT_FAILED_BEFORE_ANY_ACTIVATION',
  );

  const identityCorrection = lineage.candidate_identity_correction;
  assertExactKeys(identityCorrection, [
    'accounting_source_rule',
    'corrected_candidate_binding',
    'corrected_unsigned_candidate_canonical_json_byte_length',
    'corrected_unsigned_candidate_sha256',
    'correction_reason',
    'stale_candidate_binding',
    'stale_unsigned_candidate_canonical_json_byte_length',
    'stale_unsigned_candidate_sha256',
  ], 'Red Hat Company Letter identity-correction keys');
  assert.equal(
    identityCorrection.accounting_source_rule,
    'RECONSTRUCT_ACCOUNTING_FROM_CANDIDATE_OUTPUT_CONTRACT_EXACT_KEYS_AND_THEIR_VALUE_MEMBERS',
  );
  assert.equal(
    identityCorrection.correction_reason,
    'PREDECESSOR_PINS_WERE_NOT_RECOMPUTED_AFTER_THE_GROUP_4_ACCOUNTING_SOURCE_WAS_CORRECTED',
  );
  assert.deepEqual(identityCorrection.corrected_candidate_binding, predecessorBinding);
  assert.equal(
    identityCorrection.corrected_unsigned_candidate_canonical_json_byte_length,
    27642,
  );
  assert.equal(
    identityCorrection.corrected_unsigned_candidate_sha256,
    '5a0716f5b6364352f57b2903613a5114a6940c2460977171b64da7447467684e',
  );
  const stalePredecessorBinding = {
    company_stockholders_meeting_event_reference_value_candidate_id:
      '69038d4d252cadbee18555c11bacfac0252787352218f00a97af3c3990a237e7',
    company_stockholders_meeting_event_reference_value_count: 1,
    remaining_source_admission_gap_count: 1,
    remaining_source_normaliser_descriptor_count: 0,
    remaining_unresolved_reference_slot_count: 1,
    remaining_unresolved_reference_slot_sha256:
      '22ffac79c5eccdaaf51c24fed0714643bd405e0a8260eab6975cc59e0ff40a62',
    schema_version:
      'M7_V2_TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_CANDIDATE/V1',
  };
  assert.deepEqual(identityCorrection.stale_candidate_binding, stalePredecessorBinding);
  assert.equal(identityCorrection.stale_unsigned_candidate_canonical_json_byte_length, 29161);
  assert.equal(
    identityCorrection.stale_unsigned_candidate_sha256,
    '2f4256ffa5a6b127e5f0972926a9bc3e777f8a4a57aba14db71abd681888abc9',
  );
  assert.equal(Buffer.byteLength(canonicalJson(stalePredecessorBinding), 'utf8'), 551);
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(stalePredecessorBinding), 'utf8')),
    '049605f4adba5e63bd3e4c827a3a88cec9e0fa0a4c390f250e011e74b8dd33ef',
  );

  assert.deepEqual(lineage.failed_execution_observation, {
    actual_exit_code: 1,
    argv: [
      'node',
      '--test',
      `--test-name-pattern=${t.name}`,
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    ],
    execution_id:
      'PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PHYSICAL_AUDIT',
    expected_exit_code: 0,
    failure_classification: 'STALE_PREDECESSOR_CANDIDATE_ID_PIN',
    named_test: t.name,
    observed_candidate_id:
      predecessorBinding.company_stockholders_meeting_event_reference_value_candidate_id,
    ordered_execution_number: 1,
    sealed_expected_candidate_id:
      stalePredecessorBinding.company_stockholders_meeting_event_reference_value_candidate_id,
  });
  assert.deepEqual(lineage.historical_and_superseding_schedule_accounting, {
    historical_consumed_governed_command_count: 1,
    historical_failed_governed_command_count: 1,
    historical_not_run_governed_command_count: 5,
    historical_successful_governed_command_count: 0,
    superseding_schedule_consumed_governed_command_count: 0,
    superseding_schedule_governed_command_count: 6,
    superseding_schedule_remaining_governed_command_count: 6,
    superseding_schedule_retry_or_budget_reset: false,
  });
  assert.deepEqual(lineage.subsequent_execution_disposition, {
    not_run_execution_ids: [
      'WORK3_FULL_REGRESSION',
      'PHASE2_AND_PHASE3_COMBINED_REGRESSION',
      'AUTHORITY_OFFLINE_SOURCE_DISCOVERY_AND_FRONTIER_AUDIT',
      'SCOPED_DIFF_CHECK',
      'SCOPED_STATUS_CHECK',
    ],
    not_run_governed_command_count: 5,
    state: 'COMMANDS_TWO_THROUGH_SIX_NOT_RUN_AFTER_FIRST_COMMAND_FAILURE',
  });
  assert.deepEqual(lineage.superseded_authority_binding, {
    byte_length: 270270,
    path:
      TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING
        .path,
    record_id: '6e608ba5b44f6c8930339542a26e5272ae81d1f468e511f2cf15f5897a9f9ae0',
    record_id_field:
      TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING
        .record_id_field,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RED_HAT_COMPANY_LETTER_SECTION_6_01_C_SOURCE_DISCOVERY_FRONTIER_AUTHORITY/V1',
    sha256: '819ccb4a319701e2ea68f32e1f50c0b18a3c329f9156d10fd25111b1fda60822',
  });
  assert.equal(
    lineage.supersession_rule,
    'THE_6E608BA5_AUTHORITY_IS_SUPERSEDED_BEFORE_ACTIVATION_BY_THIS_CANONICAL_AUTHORITY_ITS_FAILED_FIRST_COMMAND_IS_HISTORICAL_ONLY_AND_THE_FRESH_SIX_COMMAND_SCHEDULE_IS_NOT_A_RETRY_OR_BUDGET_RESET',
  );
  assert.deepEqual(Object.keys(lineage.zero_effect_boundary), Object.keys(effects));
  assert.equal(
    lineage.zero_effect_boundary.effect_scope,
    'FAILED_OLD_COMMAND_ONE_TEST_PROCESS_ONLY_NO_NETWORK_REPOSITORY_PRODUCT_PRODUCTION_SEMANTIC_SOURCE_ADMISSION_TARGET_SELECTION_WORK3_FAMILY_REGISTRATION_OR_ACTIVATION_EFFECT',
  );
  assert.equal(
    lineage.zero_effect_boundary.retained_company_letter_source_admission_gap_count,
    1,
  );
  assert.equal(lineage.zero_effect_boundary.retained_unresolved_reference_slot_count, 1);
  for (const [key, value] of Object.entries(lineage.zero_effect_boundary)) {
    if (
      key === 'effect_scope'
      || key === 'retained_company_letter_source_admission_gap_count'
      || key === 'retained_unresolved_reference_slot_count'
    ) continue;
    assert.equal(value, 0, `correction lineage ${key}`);
  }

  const priorLineageBytes = Buffer.from(`${canonicalJson(lineage)}\n`, 'utf8');
  assert.equal(priorLineageBytes.byteLength, 5627);
  assert.equal(
    sha256Hex(priorLineageBytes),
    '844ce50622d948d74f8af355ec6b797d2ca7e825a22464cf380af8727636078b',
  );
  const recovery = scope.post_correction_execution_observability_recovery_lineage;
  assertExactKeys(
    recovery,
    [
      'corrected_combined_regression_unobservable_observation',
      'corrected_physical_audit_observation',
      'corrected_work3_full_regression_observation',
      'execution_observation_accounting',
      'lineage_classification',
      'lineage_state',
      'not_run_execution_ids',
      'prior_pre_activation_correction_lineage_binding',
      'recovery_schedule_accounting',
      'schema_version',
      'substantive_legal_question_required',
      'superseded_authority_binding',
      'supersession_rule',
      'zero_effect_boundary',
    ],
    'Red Hat Company Letter execution-observability recovery-lineage keys',
  );
  assert.equal(
    recovery.schema_version,
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_EXECUTION_OBSERVABILITY_RECOVERY_LINEAGE/V2',
  );
  assert.equal(
    recovery.lineage_classification,
    'FAIL_CLOSED_CORRECTED_COMBINED_REGRESSION_EXECUTION_OUTCOME_UNOBSERVABLE_NO_PASS_OR_FAILURE_CLAIM',
  );
  assert.equal(
    recovery.lineage_state,
    'SEALED_CORRECTED_AUTHORITY_SUPERSEDED_AFTER_THIRD_COMMAND_OUTCOME_BECAME_UNOBSERVABLE_BEFORE_ANY_ACTIVATION',
  );
  assert.equal(recovery.substantive_legal_question_required, false);
  assert.deepEqual(recovery.corrected_physical_audit_observation, {
    actual_exit_code: 0,
    argv: [
      'node',
      '--test',
      `--test-name-pattern=${t.name}`,
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    ],
    execution_id:
      'PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_CORRECTED_PHYSICAL_AUDIT',
    expected_exit_code: 0,
    observed_result: 'PASS',
    ordered_execution_number: 1,
    state: 'OBSERVABLE_PASS_EXIT_ZERO',
  });
  assert.deepEqual(recovery.corrected_work3_full_regression_observation, {
    actual_exit_code: 0,
    argv: ['node', '--test', 'tests/stage-2y-structure-m7-v2-repair-work3.test.js'],
    execution_id: 'CORRECTED_WORK3_FULL_REGRESSION',
    expected_exit_code: 0,
    observed_pass_count: 150,
    observed_test_count: 150,
    ordered_execution_number: 2,
    state: 'OBSERVABLE_PASS_EXIT_ZERO',
  });
  assert.deepEqual(recovery.corrected_combined_regression_unobservable_observation, {
    actual_exit_code: null,
    argv: [
      'node',
      '--test',
      'tests/canonical-v2-m7-v2-deterministic-generator-nested-expression.test.js',
      'tests/canonical-v2-m7-v2-contract-nested-expression-evidence.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    ],
    completion_summary_observed: false,
    execution_id: 'CORRECTED_PHASE2_AND_PHASE3_COMBINED_REGRESSION',
    exit_code_observed: false,
    expected_exit_code: 0,
    observed_partial_output: true,
    ordered_execution_number: 3,
    prior_execution_retry_authorised: false,
    process_session_id: 53202,
    replacement_execution_in_new_authority_authorised: true,
    state: 'OBSERVABILITY_FAILURE',
    terminal_poll_result: 'UNKNOWN_PROCESS_ID',
    test_pass_or_failure_claim: 'NONE',
    tool_output_state:
      'TOOL_OUTPUT_TRUNCATED_BEFORE_COMPLETION_SUMMARY_AND_SESSION_CLOSED_BEFORE_A_RESULT_COULD_BE_RECOVERED',
  });
  assert.deepEqual(recovery.execution_observation_accounting, {
    consumed_governed_command_count: 3,
    not_run_governed_command_count: 3,
    observable_failure_count: 0,
    observable_success_count: 2,
    unobservable_outcome_count: 1,
  });
  assert.deepEqual(recovery.not_run_execution_ids, [
    'CORRECTED_AUTHORITY_OFFLINE_SOURCE_DISCOVERY_AND_FRONTIER_AUDIT',
    'CORRECTED_SCOPED_DIFF_CHECK',
    'CORRECTED_SCOPED_STATUS_CHECK',
  ]);
  assert.deepEqual(recovery.prior_pre_activation_correction_lineage_binding, {
    byte_length: 5627,
    member_count: 10,
    preservation_rule:
      'PRESERVE_THE_CF22_PRE_ACTIVATION_CORRECTION_LINEAGE_BYTE_SEMANTICALLY_WITHOUT_RECLASSIFICATION',
    schema_version:
      'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PRE_ACTIVATION_CORRECTION_LINEAGE/V1',
    sha256: '844ce50622d948d74f8af355ec6b797d2ca7e825a22464cf380af8727636078b',
  });
  assert.deepEqual(recovery.recovery_schedule_accounting, {
    consumed_governed_command_count: 0,
    governed_command_count: 6,
    remaining_governed_command_count: 6,
    retry_or_budget_reset: false,
    schedule_rule:
      'NEW_AUTHORITY_VERSION_REPLACEMENT_SCHEDULE_PRIOR_CF22_COMMAND_CONSUMPTION_REMAINS_HISTORICAL_THE_UNOBSERVABLE_RESULT_IS_NOT_RECLASSIFIED_AND_NO_BUDGET_IS_RESET',
  });
  assert.deepEqual(recovery.superseded_authority_binding, {
    byte_length: 285959,
    path: TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.path,
    record_id: 'cf22c12206d0ea3b209d18315cede5cc987dce27001665baaa1a897e39912c3a',
    record_id_field:
      TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.record_id_field,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RED_HAT_COMPANY_LETTER_SECTION_6_01_C_SOURCE_DISCOVERY_FRONTIER_AUTHORITY/V1',
    sha256: '4dc2fb290edbcd76a57f012ca6c9d681c8ab52da2ca7a27607898213be1b047d',
  });
  assert.equal(
    recovery.supersession_rule,
    'THE_CF22C122_AUTHORITY_IS_SUPERSEDED_BEFORE_ACTIVATION_BY_THIS_CANONICAL_AUTHORITY_THE_UNOBSERVABLE_THIRD_COMMAND_REMAINS_HISTORICAL_WITH_NO_PASS_OR_FAILURE_RECLASSIFICATION_AND_THE_FRESH_SIX_COMMAND_RECOVERY_SCHEDULE_IS_A_NEW_AUTHORITY_VERSION_REPLACEMENT_NOT_A_RETRY_OR_BUDGET_RESET',
  );
  assert.deepEqual(Object.keys(recovery.zero_effect_boundary), Object.keys(effects));
  assert.equal(
    recovery.zero_effect_boundary.effect_scope,
    'CORRECTED_COMMANDS_ONE_THROUGH_THREE_TEST_PROCESSES_ONLY_NO_NETWORK_REPOSITORY_PRODUCT_PRODUCTION_SEMANTIC_SOURCE_ADMISSION_TARGET_SELECTION_WORK3_FAMILY_REGISTRATION_OR_ACTIVATION_EFFECT',
  );
  assert.equal(recovery.zero_effect_boundary.retained_company_letter_source_admission_gap_count, 1);
  assert.equal(recovery.zero_effect_boundary.retained_unresolved_reference_slot_count, 1);
  for (const [key, value] of Object.entries(recovery.zero_effect_boundary)) {
    if (
      key === 'effect_scope' ||
      key === 'retained_company_letter_source_admission_gap_count' ||
      key === 'retained_unresolved_reference_slot_count'
    ) continue;
    assert.equal(value, 0, `execution observability recovery ${key}`);
  }

  const priorRecoveryBytes = Buffer.from(`${canonicalJson(recovery)}\n`, 'utf8');
  assert.equal(priorRecoveryBytes.byteLength, 5310);
  assert.equal(
    sha256Hex(priorRecoveryBytes),
    'a72e1221d92dfb8864d8b6061bea73a773554a0bcf25e312220f1075fb942043',
  );
  const transport = scope.post_recovery_offline_audit_transport_correction_lineage;
  assertExactKeys(
    transport,
    [
      'execution_observation_accounting',
      'lineage_classification',
      'lineage_state',
      'not_run_execution_ids',
      'prior_execution_observability_recovery_lineage_binding',
      'recovery_combined_regression_observation',
      'recovery_offline_audit_transport_failure_observation',
      'recovery_physical_audit_observation',
      'recovery_work3_full_regression_observation',
      'replacement_schedule_accounting',
      'schema_version',
      'source_transport_correction',
      'substantive_legal_question_required',
      'superseded_authority_binding',
      'supersession_rule',
      'zero_effect_boundary',
    ],
    'Red Hat Company Letter offline-audit transport-correction lineage keys',
  );
  assert.equal(
    transport.schema_version,
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_OFFLINE_AUDIT_TRANSPORT_CORRECTION_LINEAGE/V3',
  );
  assert.equal(
    transport.lineage_classification,
    'FAIL_CLOSED_RECOVERY_OFFLINE_AUDIT_NODE_E_SHEBANG_TRANSPORT_PARSE_FAILURE_NO_AUDIT_RESULT_CLAIM',
  );
  assert.equal(
    transport.lineage_state,
    'SEALED_V2_AUTHORITY_SUPERSEDED_AFTER_FOURTH_COMMAND_TRANSPORT_PARSE_FAILURE_BEFORE_ANY_ACTIVATION',
  );
  assert.equal(transport.substantive_legal_question_required, false);
  assert.deepEqual(transport.recovery_physical_audit_observation, {
    actual_exit_code: 0,
    argv: [
      'node',
      '--test',
      `--test-name-pattern=${t.name}`,
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    ],
    execution_id:
      'RECOVERY_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PHYSICAL_AUDIT',
    expected_exit_code: 0,
    observed_pass_count: 1,
    observed_test_count: 1,
    ordered_execution_number: 1,
    state: 'OBSERVABLE_PASS_EXIT_ZERO',
  });
  assert.deepEqual(transport.recovery_work3_full_regression_observation, {
    actual_exit_code: 0,
    argv: ['node', '--test', 'tests/stage-2y-structure-m7-v2-repair-work3.test.js'],
    execution_id: 'RECOVERY_WORK3_FULL_REGRESSION',
    expected_exit_code: 0,
    observed_pass_count: 150,
    observed_test_count: 150,
    ordered_execution_number: 2,
    state: 'OBSERVABLE_PASS_EXIT_ZERO',
  });
  assert.deepEqual(transport.recovery_combined_regression_observation, {
    actual_exit_code: 0,
    argv: [
      'node',
      '--test',
      'tests/canonical-v2-m7-v2-deterministic-generator-nested-expression.test.js',
      'tests/canonical-v2-m7-v2-contract-nested-expression-evidence.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    ],
    execution_id: 'RECOVERY_PHASE2_AND_PHASE3_COMBINED_REGRESSION',
    expected_exit_code: 0,
    observed_pass_count: 177,
    observed_test_count: 177,
    ordered_execution_number: 3,
    state: 'OBSERVABLE_PASS_EXIT_ZERO',
  });
  assert.deepEqual(transport.recovery_offline_audit_transport_failure_observation, {
    actual_exit_code: 1,
    argv_binding: {
      argument_count: 4,
      authority_path:
        TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING
          .path,
      embedded_source_byte_length: 94644,
      embedded_source_sha256:
        '6c1d2161cbfaf3ce1f13b368c504189aaaadb4296a84e2edc56a1faa47ef0c09',
      executable: 'node',
      source_flag: '-e',
    },
    audit_logic_entered: false,
    execution_id: 'RECOVERY_AUTHORITY_OFFLINE_SOURCE_DISCOVERY_AND_FRONTIER_AUDIT',
    expected_exit_code: 0,
    failure_classification:
      'NODE_E_SHEBANG_TRANSPORT_PARSE_FAILURE_BEFORE_OFFLINE_AUDIT_LOGIC',
    observed_error_class: 'SyntaxError',
    observed_error_location: '[eval]:1',
    observed_error_source_line: '#!/usr/bin/env node',
    ordered_execution_number: 4,
    state: 'TRANSPORT_PARSE_FAILURE',
    test_or_audit_pass_or_failure_claim: 'NONE',
  });
  assert.deepEqual(transport.execution_observation_accounting, {
    consumed_governed_command_count: 4,
    not_run_governed_command_count: 2,
    observable_success_count: 3,
    offline_audit_result_observation_count: 0,
    transport_parse_failure_count: 1,
  });
  assert.deepEqual(transport.not_run_execution_ids, [
    'RECOVERY_SCOPED_DIFF_CHECK',
    'RECOVERY_SCOPED_STATUS_CHECK',
  ]);
  assert.deepEqual(transport.prior_execution_observability_recovery_lineage_binding, {
    byte_length: 5310,
    member_count: 14,
    preservation_rule:
      'PRESERVE_THE_9509_EXECUTION_OBSERVABILITY_RECOVERY_LINEAGE_BYTE_SEMANTICALLY_WITHOUT_RECLASSIFICATION',
    schema_version:
      'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_EXECUTION_OBSERVABILITY_RECOVERY_LINEAGE/V2',
    sha256: 'a72e1221d92dfb8864d8b6061bea73a773554a0bcf25e312220f1075fb942043',
  });
  assert.deepEqual(transport.source_transport_correction, {
    baseline_source_byte_length: 94624,
    baseline_source_sha256:
      'afed4a1b1d6f86c6d7e1025d018aaaee3700a7a60db214282e250cffc2f4eb79',
    derivation_rule:
      'SHEBANG_REMOVED_BASELINE_SOURCE_EQUALS_PRIOR_EMBEDDED_SOURCE_BYTES_AFTER_REMOVING_EXACT_FIRST_TWENTY_BYTES',
    prior_embedded_source_byte_length: 94644,
    prior_embedded_source_sha256:
      '6c1d2161cbfaf3ce1f13b368c504189aaaadb4296a84e2edc56a1faa47ef0c09',
    removed_prefix_byte_length: 20,
    removed_prefix_sha256:
      'a59c47872b71f12589942892464e764c0db350c20b72228645615cc36e0a0725',
    removed_prefix_text: '#!/usr/bin/env node\n',
    resulting_first_line: "'use strict';",
    transport_failure_rule: 'NODE_E_SOURCE_MUST_NOT_BEGIN_WITH_A_UNIX_SHEBANG_LINE',
  });
  assert.deepEqual(transport.replacement_schedule_accounting, {
    consumed_governed_command_count: 0,
    governed_command_count: 6,
    remaining_governed_command_count: 6,
    retry_or_budget_reset: false,
    schedule_rule:
      'NEW_AUTHORITY_VERSION_TRANSPORT_REPLACEMENT_SCHEDULE_PRIOR_9509_COMMAND_CONSUMPTION_REMAINS_HISTORICAL_THE_TRANSPORT_PARSE_FAILURE_IS_NOT_RECLASSIFIED_AND_NO_BUDGET_IS_RESET',
  });
  assert.deepEqual(transport.superseded_authority_binding, {
    byte_length: 303327,
    path: TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.path,
    record_id: '9509fafa1112ec201ef5dbc798126db4107b072e3fc0f49d5b1ed5b297e146b8',
    record_id_field:
      TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.record_id_field,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RED_HAT_COMPANY_LETTER_SECTION_6_01_C_SOURCE_DISCOVERY_FRONTIER_AUTHORITY/V2',
    sha256: '5b56c2ffd67b01702f4f446ca771842dc871366463ac5c0e71068a9a74787440',
  });
  assert.equal(
    transport.supersession_rule,
    'THE_9509FAFA_AUTHORITY_IS_SUPERSEDED_BEFORE_ACTIVATION_BY_THIS_CANONICAL_AUTHORITY_THE_FOURTH_COMMAND_TRANSPORT_PARSE_FAILURE_REMAINS_HISTORICAL_WITH_NO_AUDIT_PASS_OR_FAILURE_RECLASSIFICATION_AND_THE_FRESH_SIX_COMMAND_TRANSPORT_RECOVERY_SCHEDULE_IS_A_NEW_AUTHORITY_VERSION_REPLACEMENT_NOT_A_RETRY_OR_BUDGET_RESET',
  );
  assert.deepEqual(transport.zero_effect_boundary, {
    ...effects,
    effect_scope:
      'RECOVERY_COMMANDS_ONE_THROUGH_FOUR_TEST_AND_OFFLINE_AUDIT_TRANSPORT_PROCESSES_ONLY_NO_NETWORK_REPOSITORY_PRODUCT_PRODUCTION_SEMANTIC_SOURCE_ADMISSION_TARGET_SELECTION_WORK3_FAMILY_REGISTRATION_OR_ACTIVATION_EFFECT',
  });

  assert.equal(scope.ordered_executions.length, 6);
  for (const execution of scope.ordered_executions) {
    assertExactKeys(execution, [
      'argv',
      'execution_id',
      'expected_exit_code',
      'maximum_runs',
      'nonzero_exit_authority',
    ], `${execution.execution_id} command keys`);
    assert.equal(execution.expected_exit_code, 0);
    assert.equal(execution.maximum_runs, 1);
    assert.equal(execution.nonzero_exit_authority, null);
  }
  assert.deepEqual(
    scope.ordered_executions.map((execution) => execution.execution_id),
    [
      'TRANSPORT_RECOVERY_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PHYSICAL_AUDIT',
      'TRANSPORT_RECOVERY_WORK3_FULL_REGRESSION',
      'TRANSPORT_RECOVERY_PHASE2_AND_PHASE3_COMBINED_REGRESSION',
      'TRANSPORT_RECOVERY_AUTHORITY_OFFLINE_SOURCE_DISCOVERY_AND_FRONTIER_AUDIT',
      'TRANSPORT_RECOVERY_SCOPED_DIFF_CHECK',
      'TRANSPORT_RECOVERY_SCOPED_STATUS_CHECK',
    ],
  );
  assert.deepEqual(scope.ordered_executions[0].argv, [
    'node',
    '--test',
    `--test-name-pattern=${t.name}`,
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  assert.deepEqual(scope.ordered_executions[1].argv, [
    'node',
    '--test',
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  assert.deepEqual(scope.ordered_executions[2].argv, [
    'node',
    '--test',
    'tests/canonical-v2-m7-v2-deterministic-generator-nested-expression.test.js',
    'tests/canonical-v2-m7-v2-contract-nested-expression-evidence.test.js',
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  const auditExecution = scope.ordered_executions[3];
  assert.equal(
    auditExecution.execution_id,
    'TRANSPORT_RECOVERY_AUTHORITY_OFFLINE_SOURCE_DISCOVERY_AND_FRONTIER_AUDIT',
  );
  assert.equal(auditExecution.argv.length, 4);
  assert.deepEqual(auditExecution.argv.slice(0, 2), ['node', '-e']);
  assert.equal(auditExecution.argv[3], scope.authority_record_create_once_path);
  assert.deepEqual(scope.ordered_executions[4].argv, [
    'git',
    'diff',
    '--check',
    '--',
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.path,
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  assert.deepEqual(scope.ordered_executions[5].argv, [
    'git',
    'status',
    '--short',
    '--',
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING.path,
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ]);
  const embeddedSource = auditExecution.argv[2];
  assert.equal(Buffer.byteLength(embeddedSource, 'utf8'), 110132);
  assert.equal(
    sha256Hex(Buffer.from(embeddedSource, 'utf8')),
    '718b1c79c59ff5f881b8400f088f68236affea100931eb7a684f012540fc1078',
  );
  assert.equal(embeddedSource.startsWith("'use strict';\n"), true);
  assert.equal(embeddedSource.startsWith('#!'), false);
  assert.equal(embeddedSource.endsWith('\n'), true);
  assert.equal(embeddedSource.includes('\r'), false);
  assert.doesNotThrow(() => new Function(embeddedSource));
  assert.notEqual(
    Buffer.byteLength(embeddedSource, 'utf8'),
    transport.source_transport_correction.baseline_source_byte_length,
  );
  assert.notEqual(
    sha256Hex(Buffer.from(embeddedSource, 'utf8')),
    transport.source_transport_correction.baseline_source_sha256,
  );
  assert.equal(authority.self_audit_plan.embedded_source_byte_length, 110132);
  assert.equal(
    authority.self_audit_plan.embedded_source_sha256,
    '718b1c79c59ff5f881b8400f088f68236affea100931eb7a684f012540fc1078',
  );
  assertExactKeys(authority.self_audit_plan, [
    'audit_labels_in_precedence_order',
    'authority_path_argument_index',
    'embedded_source_byte_length',
    'embedded_source_sha256',
    'execution_id',
    'external_temp_packet_runtime_dependency_forbidden',
    'network_refetch_forbidden',
    'offline_import_allowlist',
    'response_body_offline_re_slice_claim_forbidden',
    'state',
  ], 'Red Hat Company Letter self-audit-plan keys');
  assert.equal(authority.self_audit_plan.audit_labels_in_precedence_order.length, 21);
  assert.deepEqual(authority.self_audit_plan.audit_labels_in_precedence_order, [
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_RAW_SEAL',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_ROOT_CONTRACT',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_SELF_ID',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PARENT_AUTHORITY',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_PREDECESSOR_CANDIDATE',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_RETAINED_FRONTIER',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_EXTERNAL_CITATION',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_CENSUS_CONTRACT',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_CENSUS_RESPONSE',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_CENSUS_DOCUMENT',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_OMISSION_PROOF',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_CENSUS_ORDER_AND_COUNTS',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_SCOPED_ABSENCE',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_NEXT_ACTION',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_FORBIDDEN_AUTHORISATION',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_ZERO_EFFECT',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_CORRECTION_LINEAGES',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_OFFLINE_AUDIT_TRANSPORT_CORRECTION_LINEAGE',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_EXECUTION_SCOPE',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_OFFLINE_ONLY',
    'M7_V2_TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_STALE_PIN',
  ]);
  assert.equal(authority.self_audit_plan.authority_path_argument_index, 3);
  assert.equal(authority.self_audit_plan.execution_id, auditExecution.execution_id);
  assert.equal(authority.self_audit_plan.network_refetch_forbidden, true);
  assert.equal(authority.self_audit_plan.external_temp_packet_runtime_dependency_forbidden, true);
  assert.equal(authority.self_audit_plan.response_body_offline_re_slice_claim_forbidden, true);
  assert.deepEqual(authority.self_audit_plan.offline_import_allowlist, [
    'node:crypto',
    'node:fs',
    './lib/canonical-v2/canonical-bytes',
  ]);
  assert.equal(
    authority.self_audit_plan.state,
    'SEALED_FAIL_CLOSED_TWENTY_ONE_GROUP_OFFLINE_SOURCE_DISCOVERY_FRONTIER_EXECUTION_OBSERVABILITY_AND_AUDIT_TRANSPORT_RECOVERY_AUDIT',
  );
  assert.equal(embeddedSource.includes('/tmp/'), false);
  assert.deepEqual(
    Object.keys(profileAuthoring).filter((key) => (
      /RedHat|CompanyLetter|SourceDiscoveryFrontier/u.test(key)
    )),
    [],
  );
});

test('Phase4 Termination family profile package review returns 45 unapproved proposals and retains b9e as incomplete source-limited review-only without Work3 identities', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationFamilyProfilePackageReview,
    'function',
    'Phase4 facade export is missing.',
  );

  const phase4AuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
    record_id_field:
      'termination_authoring_phase4_family_profile_package_review_authority_id',
    record_id:
      '3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e',
    byte_length: 115221,
    sha256:
      '2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18',
  });
  const phase3CompletionReceiptBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-value-materialisation-audit-transport-supersession-completion-receipt.json',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUDIT_TRANSPORT_SUPERSESSION_COMPLETION_RECEIPT/V1',
    record_id_field:
      'termination_authoring_phase3_reference_value_materialisation_audit_transport_supersession_completion_receipt_id',
    record_id:
      '93d469ebcd04640669646dda578ca1521c2e017a14a8fc737bb71902735c4b4e',
    byte_length: 4193,
    sha256:
      '2874464a4b26a6c547e65f837a0c93ea4abf8a0ed1fcb847359b795b16692c4c',
  });
  const phase3SupersessionAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-value-materialisation-audit-transport-supersession-authority.json',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUDIT_TRANSPORT_SUPERSESSION/V1',
    record_id_field:
      'termination_authoring_phase3_reference_value_materialisation_audit_transport_supersession_authority_id',
    record_id:
      '78515ce0a45027a5ef62211c453fac60d54740bb592ce36ac5fb54155158d687',
    byte_length: 11825,
    sha256:
      'd759f169327db614b08b2bcba174fce73502ca62fc13313e97a5785b59bea510',
  });
  const authorityBytes = physicalBytes(phase4AuthorityBinding);
  const authorityEnvelope = sourceEnvelope(phase4AuthorityBinding);
  const authority = authorityEnvelope.record;
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(authority)}\n`, 'utf8'),
  );
  assertExactKeys(authority, [
    'authority_classification',
    'authority_state',
    'candidate_output_contract',
    'design_basis',
    'execution_schedule',
    'first_legal_stop_contract',
    'forbidden_output_contract',
    'immutable_parent_bindings',
    'implementation_contract',
    'profile_review_schedule',
    'profile_review_schedule_contract',
    'schema_version',
    'termination_authoring_phase4_family_profile_package_review_authority_id',
    'zero_effect_boundary',
  ], 'Phase4 authority keys');
  const unsignedAuthority = structuredClone(authority);
  delete unsignedAuthority
    .termination_authoring_phase4_family_profile_package_review_authority_id;
  assert.equal(
    contentId(authority.schema_version, unsignedAuthority),
    phase4AuthorityBinding.record_id,
  );
  assert.equal(authorityBytes.byteLength, phase4AuthorityBinding.byte_length);
  assert.equal(sha256Hex(authorityBytes), phase4AuthorityBinding.sha256);
  assert.deepEqual(
    authority.immutable_parent_bindings
      .termination_authoring_phase3_reference_value_materialisation_authority,
    TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    authority.immutable_parent_bindings
      .termination_authoring_phase3_red_hat_company_letter_section_6_01_c_source_discovery_frontier_authority,
    TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING,
  );
  assert.deepEqual(
    authority.execution_schedule.prerequisite_binding,
    phase3CompletionReceiptBinding,
  );
  assert.equal(
    authority.execution_schedule.prerequisite_state,
    'PHASE3_AUDIT_TRANSPORT_SUPERSESSION_COMPLETION_RECEIPT_ADMITTED_AS_PHASE4_EXECUTION_ADMISSION_EVIDENCE_ONLY',
  );
  assert.equal(
    authority.execution_schedule.stop_conditions[2],
    'PHASE3_AUDIT_TRANSPORT_SUPERSESSION_COMPLETION_RECEIPT_PHYSICAL_CANONICAL_SELF_SEAL_OR_PHASE4_EXECUTION_ADMISSION_EVIDENCE_ONLY_CONTRACT_FAILS',
  );

  const completionReceiptBytes = physicalBytes(
    phase3CompletionReceiptBinding,
  );
  const completionReceiptEnvelope = sourceEnvelope(
    phase3CompletionReceiptBinding,
  );
  const completionReceipt = completionReceiptEnvelope.record;
  assert.deepEqual(
    Buffer.from(completionReceiptBytes),
    Buffer.from(`${canonicalJson(completionReceipt)}\n`, 'utf8'),
  );
  assertExactKeys(completionReceipt, [
    'authority_bindings',
    'completion_state',
    'phase4_admission_contract',
    'recovery_accounting',
    'recovery_execution_receipts',
    'schema_version',
    'termination_authoring_phase3_reference_value_materialisation_audit_transport_supersession_completion_receipt_id',
    'zero_effect_boundary',
  ], 'Phase3 completion receipt keys');
  const unsignedCompletionReceipt = structuredClone(completionReceipt);
  delete unsignedCompletionReceipt
    .termination_authoring_phase3_reference_value_materialisation_audit_transport_supersession_completion_receipt_id;
  assert.equal(
    contentId(completionReceipt.schema_version, unsignedCompletionReceipt),
    phase3CompletionReceiptBinding.record_id,
  );
  assert.equal(
    completionReceiptBytes.byteLength,
    phase3CompletionReceiptBinding.byte_length,
  );
  assert.equal(
    sha256Hex(completionReceiptBytes),
    phase3CompletionReceiptBinding.sha256,
  );
  assert.deepEqual(
    completionReceipt.authority_bindings,
    {
      audit_transport_supersession_authority:
        phase3SupersessionAuthorityBinding,
      reference_value_materialisation_authority:
        TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING,
    },
  );
  assert.equal(
    completionReceipt.completion_state,
    'COMPLETE_3_OF_3_SUPERSESSION_RECOVERY_EXECUTIONS_PHASE4_ADMISSION_EVIDENCE_ONLY',
  );
  assert.deepEqual(
    completionReceipt.phase4_admission_contract,
    {
      permitted_downstream_use: 'PHASE4_EXECUTION_ADMISSION',
      phase4_binding_required: true,
      receipt_effect: 'EVIDENCE_ONLY_NO_EXECUTION_AUTHORITY',
    },
  );
  assert.deepEqual(
    completionReceipt.recovery_accounting,
    {
      completed_execution_count: 3,
      failed_execution_count: 0,
      required_execution_count: 3,
      required_order_satisfied: true,
      successful_execution_count: 3,
    },
  );
  const expectedAuditSections = [
    'AUTHORITY_CANONICAL_BYTES',
    'AUTHORITY_SELF_ID',
    'EMBEDDED_AUDIT_SEAL',
    'FOURTEEN_PHYSICAL_PARENT_SEALS',
    'TRANSITIVE_GOVERNED_SOURCE_SEALS',
    'E50_MEETING_CANDIDATE',
    'PREDECESSOR_BINDING',
    'V3_FRONTIER',
    'INHERITED_74_SCHEDULE',
    'TARGET_87_18_4_SCHEDULE',
    'ROW_LOCAL_18_TARGET_STRINGS_PINNED',
    'SPECIALISED_37_SCHEDULE',
    'CHANGED_146_LEDGER_SEMANTICS_AND_ORACLE',
    'B386_PRIVATE_SOURCE_GAP',
    'PARTITION_221_EQUALS_74_PLUS_109_PLUS_37_PLUS_1',
    'FINAL_220_PLUS_1_LEDGER',
    'FINAL_LEDGER_CLASSIFICATIONS',
    'ACCOUNTING',
    'CANDIDATE_28_KEY_CONTRACT',
    'INPUT_13_KEY_CONTRACT',
    'FRESH_EXACT_EXECUTION_SCHEDULE',
    'FORBIDDEN_EFFECTS',
  ];
  assert.deepEqual(
    completionReceipt.recovery_execution_receipts,
    [
      {
        actual_exit_code: 0,
        execution_id: 'SUPERSESSION_EMBEDDED_OFFLINE_AUTHORITY_AUDIT',
        expected_exit_code: 0,
        ordinal: 1,
        result_facts: {
          audit_section_count: 22,
          audit_sections: expectedAuditSections,
          audit_state: 'PASS_22_OF_22_SECTIONS',
          canonical_stdout_record_count: 1,
          stderr_empty: true,
          stdout_terminal_lf: true,
        },
        run_count: 1,
        state: 'PASS',
      },
      {
        actual_exit_code: 0,
        execution_id: 'SUPERSESSION_SCOPED_DIFF_CHECK',
        expected_exit_code: 0,
        ordinal: 2,
        result_facts: {
          stderr_empty: true,
          stdout_empty: true,
        },
        run_count: 1,
        state: 'PASS',
      },
      {
        actual_exit_code: 0,
        execution_id: 'SUPERSESSION_SCOPED_STATUS_CHECK',
        expected_exit_code: 0,
        ordinal: 3,
        result_facts: {
          other_path_count: 0,
          stderr_empty: true,
          stdout_lines: [
            `?? ${phase3SupersessionAuthorityBinding.path}`,
            `?? ${TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING.path}`,
            '?? lib/canonical-v2/m7-v2-profile-authoring.js',
            '?? tests/stage-2y-structure-m7-v2-repair-work3.test.js',
          ],
          stdout_terminal_lf: true,
        },
        run_count: 1,
        state: 'PASS',
      },
    ],
  );
  assert.deepEqual(
    completionReceipt.zero_effect_boundary,
    {
      company_letter_acquisition_count: 0,
      original_execution_7_run_count: 0,
      original_execution_8_run_count: 0,
      original_scoped_status_binding_count: 0,
      phase4_execution_count: 0,
      runtime_absolute_path_field_count: 0,
    },
  );

  const newInput = () => ({
    terminationPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(phase4AuthorityBinding),
    terminationReferenceValueMaterialisationInput:
      terminationPhase3ReferenceValueMaterialisationFixture(),
  });
  const input = newInput();
  const before = fixtureFingerprint(input);
  assertRecursivelyUnfrozen(input);
  assert.deepEqual(
    Object.keys(input),
    authority.implementation_contract.exact_outer_input_keys,
  );
  assert.deepEqual(
    Object.keys(input.terminationReferenceValueMaterialisationInput),
    authority.implementation_contract
      .exact_nested_materialisation_input_keys,
  );
  assert.deepEqual(
    authority.implementation_contract.exact_outer_input_keys,
    [
      'terminationPhase4FamilyProfilePackageReviewAuthority',
      'terminationReferenceValueMaterialisationInput',
    ],
  );
  assert.deepEqual(
    authority.implementation_contract
      .exact_nested_materialisation_input_keys,
    [
      'terminationPhase3ReferenceValueMaterialisationAuthority',
      'terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority',
      'terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority',
      'terminationPhase3AgreementDateSourcePairReferenceValueAuthority',
      'terminationPhase3SourceOccurrenceSelfReferenceValueAuthority',
      'terminationPhase3RawM2ReferenceOwnerValueAuthority',
      'terminationPhase3LinkedRuleReferenceValueAuthority',
      'terminationPhase3ReferenceEdgeValueAuthority',
      'terminationPhase3ReferenceSourceNormaliserAuthority',
      'terminationPhase3TargetEvidenceAuthority',
      'terminationPhase3ReviewAuthority',
      'terminationAuthoringPhase2Authority',
      'governedSources',
    ],
  );
  assert.equal(
    authority.implementation_contract.phase3_internal_function,
    'prepareTerminationReferenceValueMaterialisationCandidate',
  );
  assert.equal(
    authority.implementation_contract.phase2_internal_function,
    'prepareTerminationFamilyProposal',
  );
  assert.equal(
    authority.implementation_contract
      .caller_produced_candidate_input_forbidden,
    true,
  );

  const materialisationInput =
    input.terminationReferenceValueMaterialisationInput;
  const phase2Proposal = profileAuthoring.prepareTerminationFamilyProposal({
    terminationAuthoringPhase2Authority:
      materialisationInput.terminationAuthoringPhase2Authority,
    governedSources: materialisationInput.governedSources,
  });
  const materialisationCandidate = profileAuthoring
    .prepareTerminationReferenceValueMaterialisationCandidate(
      materialisationInput,
    );
  assert.equal(phase2Proposal.derived_profile_count, 45);
  assert.equal(
    materialisationCandidate.reference_value_ledger.length,
    221,
  );
  assert.equal(
    materialisationCandidate.reference_value_ledger.filter(
      (row) => row.typed_value !== null,
    ).length,
    220,
  );

  const terminalBySourceUnitKey = new Map(
    materialisationInput.terminationAuthoringPhase2Authority.record
      .source_terminal_successor_contract.terminal_rule_registry.map(
        (terminal) => [terminal.source_unit_key, terminal],
      ),
  );
  const independentlyDerivedSchedule = phase2Proposal.proposed_partition
    .proposed_profiles.map((profile) => {
      const classificationBuckets = sortedUnique(
        profile.source_unit_keys.map((sourceUnitKey) => {
          const terminal = terminalBySourceUnitKey.get(sourceUnitKey);
          assert(terminal, sourceUnitKey);
          return terminal.classification_bucket;
        }),
      );
      assert.equal(classificationBuckets.length, 1);
      const phase3ProfileKey = [
        'PROFILE',
        'TERMINATION',
        classificationBuckets[0],
        profile.proposed_profile_key,
      ].join(':');
      const referenceValueReviews = materialisationCandidate
        .reference_value_ledger.filter(
          (row) => row.profile_key === phase3ProfileKey,
        );
      const referenceValueReviewBytes = Buffer.from(
        canonicalJson(referenceValueReviews),
        'utf8',
      );
      const materialisedReferenceValueCount = referenceValueReviews.filter(
        (row) => row.typed_value !== null,
      ).length;
      const isB9e = profile.proposed_profile_key
        === 'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712';
      return {
        proposed_profile_key: profile.proposed_profile_key,
        phase3_profile_key: phase3ProfileKey,
        canonical_tuple: profile.canonical_tuple,
        source_unit_keys: profile.source_unit_keys,
        m4_claim_ids: profile.m4_claim_ids,
        proposed_validation: isB9e ? {
          extraction_state: 'INCOMPLETE',
          source_quality: 'SOURCE_LIMITED',
          output_disposition: 'REVIEW_ONLY',
          issue_codes: [
            'PRIVATE_COMPANY_LETTER_SOURCE_NOT_ADMITTED_OR_M2_INDEXED_TARGET_SELECTION_AND_TYPED_VALUE_WITHHELD',
          ],
          no_comparison_authority: null,
        } : {
          extraction_state: 'COMPLETE',
          source_quality: 'SUFFICIENT',
          output_disposition: 'NORMAL',
          issue_codes: [],
          no_comparison_authority: null,
        },
        reference_occurrence_count: referenceValueReviews.length,
        materialised_reference_value_count:
          materialisedReferenceValueCount,
        unresolved_reference_value_count:
          referenceValueReviews.length - materialisedReferenceValueCount,
        work3_fixture_consumable_reference_value_count:
          referenceValueReviews.filter(
            (row) => row.work3_fixture_consumable_value_shape === true,
          ).length,
        missing_required_field_keys: isB9e
          ? ['JURISDICTION_LIST_REFERENCE']
          : [],
        new_dependency_proposal_count: 0,
        absence_proof_count: 0,
        reference_value_reviews_canonical_json_byte_length:
          referenceValueReviewBytes.byteLength,
        reference_value_reviews_sha256:
          sha256Hex(referenceValueReviewBytes),
      };
    }).sort((left, right) => (
      left.proposed_profile_key.localeCompare(right.proposed_profile_key)
    ));
  assert.deepEqual(
    independentlyDerivedSchedule,
    authority.profile_review_schedule,
  );
  const independentScheduleBytes = Buffer.from(
    canonicalJson(independentlyDerivedSchedule),
    'utf8',
  );
  assert.equal(independentScheduleBytes.byteLength, 94235);
  assert.equal(
    sha256Hex(independentScheduleBytes),
    '58257a6b57c5a2398af37b7d0bbbd07db73d5e5805c09a77e70816afd09c42fe',
  );
  assert.equal(independentlyDerivedSchedule.length, 45);
  assert.equal(independentlyDerivedSchedule.filter(
    (profile) => profile.proposed_validation.extraction_state === 'COMPLETE',
  ).length, 44);
  assert.equal(independentlyDerivedSchedule.filter(
    (profile) => profile.proposed_validation.extraction_state === 'INCOMPLETE',
  ).length, 1);
  assert.equal(independentlyDerivedSchedule.filter(
    (profile) => profile.reference_occurrence_count > 0,
  ).length, 43);
  assert.equal(independentlyDerivedSchedule.reduce(
    (count, profile) => count + profile.reference_occurrence_count,
    0,
  ), 221);
  assert.equal(independentlyDerivedSchedule.reduce(
    (count, profile) => count + profile.materialised_reference_value_count,
    0,
  ), 220);
  assert.equal(independentlyDerivedSchedule.reduce(
    (count, profile) => count + profile.unresolved_reference_value_count,
    0,
  ), 1);
  for (const profile of independentlyDerivedSchedule) {
    assertExactKeys(
      profile,
      authority.profile_review_schedule_contract.schedule_item_exact_keys,
      `${profile.proposed_profile_key} Phase4 schedule keys`,
    );
    assertExactKeys(
      profile.proposed_validation,
      authority.profile_review_schedule_contract
        .proposed_validation_exact_keys,
      `${profile.proposed_profile_key} proposed validation keys`,
    );
    assert.equal(profile.new_dependency_proposal_count, 0);
    assert.equal(profile.absence_proof_count, 0);
  }

  const b9eSchedule = independentlyDerivedSchedule.find(
    (profile) => profile.proposed_profile_key
      === 'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712',
  );
  assert(b9eSchedule);
  assert.deepEqual(b9eSchedule, authority.profile_review_schedule.find(
    (profile) => profile.proposed_profile_key
      === b9eSchedule.proposed_profile_key,
  ));
  assert.equal(
    b9eSchedule.phase3_profile_key,
    'PROFILE:TERMINATION:LEGAL_RESTRAINT:b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712',
  );
  assert.deepEqual(b9eSchedule.source_unit_keys, [
    '77fd31b1daacccb607cfdf1e7469c583b6a63a790469c1ff49f2e5f95e7594bb',
  ]);
  assert.equal(b9eSchedule.reference_occurrence_count, 7);
  assert.equal(b9eSchedule.materialised_reference_value_count, 6);
  assert.equal(b9eSchedule.unresolved_reference_value_count, 1);
  assert.equal(
    b9eSchedule.reference_value_reviews_sha256,
    'f72a382ac4043d7f8505ad29b725c051b3ac4ebed8a61e961ab839d6cac25337',
  );
  assert.deepEqual(b9eSchedule.proposed_validation, {
    extraction_state: 'INCOMPLETE',
    source_quality: 'SOURCE_LIMITED',
    output_disposition: 'REVIEW_ONLY',
    issue_codes: [
      'PRIVATE_COMPANY_LETTER_SOURCE_NOT_ADMITTED_OR_M2_INDEXED_TARGET_SELECTION_AND_TYPED_VALUE_WITHHELD',
    ],
    no_comparison_authority: null,
  });
  assert.deepEqual(
    b9eSchedule.missing_required_field_keys,
    ['JURISDICTION_LIST_REFERENCE'],
  );
  const unresolvedB9eRows = materialisationCandidate.reference_value_ledger
    .filter((row) => (
      row.profile_key === b9eSchedule.phase3_profile_key
      && row.source_unit_key === b9eSchedule.source_unit_keys[0]
      && row.field_key === 'JURISDICTION_LIST_REFERENCE'
    ));
  assert.equal(unresolvedB9eRows.length, 1);
  assert.equal(unresolvedB9eRows[0].typed_value, null);
  assert.equal(
    unresolvedB9eRows[0].work3_fixture_consumable_value_shape,
    false,
  );
  const independentB9eSlotKey = contentId(
    materialisationInput.terminationPhase3ReviewAuthority.record
      .unresolved_reference_slot_contract.identity_domain,
    {
      profile_key: unresolvedB9eRows[0].profile_key,
      source_unit_key: unresolvedB9eRows[0].source_unit_key,
      field_key: unresolvedB9eRows[0].field_key,
    },
  );
  assert.equal(
    independentB9eSlotKey,
    'b386c34a17e216f31b164dc1638a6a2310f357932aea083b923626e6ac0818ad',
  );
  const remainingB9eSlots = materialisationCandidate
    .remaining_unresolved_reference_slots.filter((slot) => (
      slot.profile_key === b9eSchedule.phase3_profile_key
      && slot.source_unit_key === b9eSchedule.source_unit_keys[0]
      && slot.field_key === 'JURISDICTION_LIST_REFERENCE'
    ));
  assert.equal(remainingB9eSlots.length, 1);
  assert.equal(
    remainingB9eSlots[0].reference_slot_key,
    independentB9eSlotKey,
  );
  const retainedB9eGaps = materialisationCandidate
    .retained_source_admission_gaps.filter((gap) => (
      gap.reference_slot_key === independentB9eSlotKey
      && gap.profile_key === b9eSchedule.phase3_profile_key
      && gap.source_unit_key === b9eSchedule.source_unit_keys[0]
      && gap.field_key === 'JURISDICTION_LIST_REFERENCE'
    ));
  assert.equal(retainedB9eGaps.length, 1);
  const retainedB9eGap = retainedB9eGaps[0];
  const unsignedRetainedB9eGap = structuredClone(retainedB9eGap);
  delete unsignedRetainedB9eGap.source_admission_gap_id;
  assert.equal(
    contentId(
      materialisationCandidate.retained_source_admission_gap_contract
        .identity_domain,
      unsignedRetainedB9eGap,
    ),
    retainedB9eGap.source_admission_gap_id,
  );
  assert.equal(
    retainedB9eGap.source_admission_gap_id,
    '9f7a5e21e19e105e6ed6e4a45ce50dea9be3d8ffc2a4b4e1ccba87d3efbfed3b',
  );
  assert.equal(
    retainedB9eGap.phase2_terminal_contract_path,
    '/source_terminal_successor_contract/terminal_rule_registry/23',
  );
  assert.equal(
    jsonPointerValue(
      materialisationInput.terminationAuthoringPhase2Authority.record,
      retainedB9eGap.phase2_terminal_contract_path,
    ).source_unit_key,
    b9eSchedule.source_unit_keys[0],
  );

  const result = profileAuthoring
    .prepareTerminationFamilyProfilePackageReview(input);
  const outputContract = authority.candidate_output_contract;
  assertExactKeys(
    result,
    outputContract.exact_keys,
    'Phase4 package review candidate keys',
  );
  assert.equal(result.schema_version, outputContract.schema_version);
  assert.equal(result.family_key, 'TERMINATION');
  assert.equal(result.candidate_state, outputContract.candidate_state);
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  const unsignedResult = structuredClone(result);
  delete unsignedResult.review_candidate_id;
  assert.equal(
    result.review_candidate_id,
    contentId(result.schema_version, unsignedResult),
  );
  assert.deepEqual(result.authority_binding, phase4AuthorityBinding);
  assertExactKeys(result.authority_binding, [
    'path',
    'schema_version',
    'record_id_field',
    'record_id',
    'byte_length',
    'sha256',
  ], 'Phase4 candidate authority binding keys');
  assert.deepEqual(result.phase2_proposal_reference, {
    schema_version: phase2Proposal.schema_version,
    proposal_id: phase2Proposal.proposal_id,
    source_unit_count:
      phase2Proposal.source_terminal_coverage.accounted_count,
    claim_count: phase2Proposal.m4_claim_accounting.accounted_count,
    derived_profile_count: phase2Proposal.derived_profile_count,
  });
  assertExactKeys(result.phase2_proposal_reference, [
    'schema_version',
    'proposal_id',
    'source_unit_count',
    'claim_count',
    'derived_profile_count',
  ], 'Phase4 Phase2 proposal reference keys');
  assert.deepEqual(
    result.reference_value_materialisation_candidate_reference,
    {
      schema_version: materialisationCandidate.schema_version,
      reference_value_materialisation_candidate_id:
        materialisationCandidate.reference_value_materialisation_candidate_id,
      reference_value_ledger_sha256:
        materialisationCandidate.reference_value_ledger_contract.sha256,
      reference_occurrence_count:
        materialisationCandidate.reference_value_materialisation_accounting
          .reference_occurrence_count,
      materialised_reference_value_count:
        materialisationCandidate.reference_value_materialisation_accounting
          .materialised_reference_value_count,
      remaining_unresolved_reference_slot_count:
        materialisationCandidate.reference_value_materialisation_accounting
          .remaining_unresolved_reference_slot_count,
    },
  );
  assertExactKeys(
    result.reference_value_materialisation_candidate_reference,
    [
      'schema_version',
      'reference_value_materialisation_candidate_id',
      'reference_value_ledger_sha256',
      'reference_occurrence_count',
      'materialised_reference_value_count',
      'remaining_unresolved_reference_slot_count',
    ],
    'Phase4 materialisation candidate reference keys',
  );

  const scheduleByProposedProfileKey = new Map(
    independentlyDerivedSchedule.map(
      (profile) => [profile.proposed_profile_key, profile],
    ),
  );
  const expectedProfiles = phase2Proposal.proposed_partition
    .proposed_profiles.map((profile) => {
      const schedule = scheduleByProposedProfileKey.get(
        profile.proposed_profile_key,
      );
      assert(schedule);
      return {
        proposed_profile_key: profile.proposed_profile_key,
        phase3_profile_key: schedule.phase3_profile_key,
        canonical_tuple: profile.canonical_tuple,
        source_unit_keys: profile.source_unit_keys,
        m4_claim_ids: profile.m4_claim_ids,
        authorised_component_ids: profile.authorised_component_ids,
        temporal_state_reference_edge_ids:
          profile.temporal_state_reference_edge_ids,
        proposed_validation: schedule.proposed_validation,
        reference_value_reviews: materialisationCandidate
          .reference_value_ledger.filter(
            (row) => row.profile_key === schedule.phase3_profile_key,
          ),
        missing_required_field_keys:
          schedule.missing_required_field_keys,
        dependency_proposals: [],
        absence_proofs: [],
      };
    });
  assert.deepEqual(result.proposed_profiles, expectedProfiles);
  assert.equal(result.proposed_profiles.length, 45);
  for (const profile of result.proposed_profiles) {
    assertExactKeys(
      profile,
      outputContract.profile_exact_keys,
      `${profile.proposed_profile_key} Phase4 profile keys`,
    );
    assertExactKeys(
      profile.proposed_validation,
      outputContract.proposed_validation_exact_keys,
      `${profile.proposed_profile_key} Phase4 validation keys`,
    );
    profile.reference_value_reviews.forEach((review) => assertExactKeys(
      review,
      outputContract.reference_value_review_exact_keys,
      `${profile.proposed_profile_key} reference review keys`,
    ));
    assert.deepEqual(profile.dependency_proposals, []);
    assert.deepEqual(profile.absence_proofs, []);
  }
  const resultB9e = result.proposed_profiles.find(
    (profile) => profile.proposed_profile_key
      === b9eSchedule.proposed_profile_key,
  );
  assert(resultB9e);
  assert.deepEqual(resultB9e.proposed_validation, b9eSchedule.proposed_validation);
  assert.deepEqual(
    resultB9e.missing_required_field_keys,
    ['JURISDICTION_LIST_REFERENCE'],
  );
  assert.equal(
    resultB9e.reference_value_reviews.filter(
      (review) => review.typed_value === null,
    ).length,
    1,
  );
  const b9eResultKeys = collectKeys(resultB9e);
  for (const key of [
    'allowed_dependency_types',
    'proposed_reference_target',
    'fixture_fact',
    'fixture_fact_id',
  ]) assert.equal(b9eResultKeys.has(key), false, key);

  assert.deepEqual(
    result.review_accounting,
    outputContract.review_accounting_exact_values,
  );
  assert.deepEqual(result.unresolved_items, outputContract.unresolved_items);
  assert.deepEqual(
    result.withheld_work3_fields,
    outputContract.withheld_work3_fields,
  );
  assert.deepEqual(result.first_legal_stop, authority.first_legal_stop_contract);
  assert.equal(
    result.first_legal_stop.state,
    'STOP_BEFORE_WORK3_PACKAGE_APPROVAL',
  );
  assert.equal(
    result.first_legal_stop.work3_approval_payload_present,
    false,
  );
  assert.deepEqual(result.zero_effect_boundary, authority.zero_effect_boundary);
  for (const key of [
    'repository_write_count',
    'network_read_count',
    'network_write_count',
    'database_write_count',
    'product_write_count',
    'governed_command_execution_count',
    'work3_identity_count',
    'work3_fixture_fact_count',
    'family_package_count',
    'approval_count',
    'registration_count',
    'activation_count',
  ]) assert.equal(result.zero_effect_boundary[key], 0, key);

  const candidateKeys = collectKeys(result);
  for (const key of authority.forbidden_output_contract
    .recursively_forbidden_candidate_keys) {
    assert.equal(candidateKeys.has(key), false, key);
  }
  for (const key of [
    'approved_inventory_digest',
    'ben_approval_id',
    'ben_decision_id',
    'family_approval_id',
    'family_profile_package_id',
    'inventory_digest',
    'inventory_fingerprint',
    'lawyer_ruling_id',
    'profile_id',
    'registration_id',
    'activation_id',
  ]) assert.equal(candidateKeys.has(key), false, key);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(input),
    'Phase4 result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(phase2Proposal),
    'Phase4 result/Phase2 proposal alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(materialisationCandidate),
    'Phase4 result/materialisation candidate alias',
  );
  assert.equal(fixtureFingerprint(input), before);
  assertRecursivelyUnfrozen(input);
  const repeated = profileAuthoring
    .prepareTerminationFamilyProfilePackageReview(newInput());
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated Phase4 result alias',
  );

  const expectedErrorPrecedence = [
    {
      order: 1,
      code: 'M7_V2_TERMINATION_PHASE4_REVIEW_CONTRACT',
      condition:
        'NULL_NON_OBJECT_MISSING_EXTRA_OR_REORDERED_OUTER_INPUT_KEYS',
    },
    {
      order: 2,
      code: 'M7_V2_TERMINATION_PHASE4_REVIEW_AUTHORITY',
      condition:
        'AUTHORITY_ENVELOPE_BINDING_PHYSICAL_BYTES_SELF_ID_OR_PARENT_PIN_DRIFT',
    },
    {
      order: 3,
      code: 'M7_V2_TERMINATION_PHASE4_MATERIALISATION_INPUT',
      condition:
        'NESTED_THIRTEEN_KEY_INPUT_DRIFT_OR_CALLER_CANDIDATE_PRESENT',
    },
    {
      order: 4,
      code: 'M7_V2_TERMINATION_PHASE4_MATERIALISATION_CANDIDATE',
      condition:
        'INTERNAL_PHASE3_CALL_FAILS_OR_221_220_1_BINDING_DRIFTS',
    },
    {
      order: 5,
      code: 'M7_V2_TERMINATION_PHASE4_PHASE2_PROPOSAL',
      condition:
        'FRESH_PHASE2_PROPOSAL_FAILS_OR_47_73_45_BINDING_DRIFTS',
    },
    {
      order: 6,
      code: 'M7_V2_TERMINATION_PHASE4_PROFILE_SCHEDULE',
      condition:
        'TUPLE_PROFILE_SOURCE_CLAIM_OR_PROFILE_ORDER_DRIFT',
    },
    {
      order: 7,
      code: 'M7_V2_TERMINATION_PHASE4_REFERENCE_LEDGER',
      condition:
        'ROW_GROUPING_ROW_SHAPE_ROW_ORDER_OR_PROFILE_HASH_DRIFT',
    },
    {
      order: 8,
      code:
        'M7_V2_TERMINATION_PHASE4_PRIVATE_COMPANY_LETTER_GAP',
      condition:
        'B9E_IS_NOT_THE_SOLE_INCOMPLETE_SOURCE_LIMITED_REVIEW_ONLY_PROFILE',
    },
    {
      order: 9,
      code: 'M7_V2_TERMINATION_PHASE4_REVIEW_OUTPUT',
      condition:
        'OUTPUT_SHAPE_ID_ACCOUNTING_FORBIDDEN_KEY_FREEZE_OR_NON_ALIASING_DRIFT',
    },
  ];
  assert.deepEqual(
    authority.implementation_contract.error_precedence,
    expectedErrorPrecedence,
  );
  authority.implementation_contract.error_precedence.forEach(
    (entry) => assertExactKeys(
      entry,
      ['code', 'condition', 'order'],
      `${entry.code} precedence keys`,
    ),
  );

  await t.test('rejects the outer shape before every deeper fault', () => {
    expectCode('M7_V2_TERMINATION_PHASE4_REVIEW_CONTRACT', () => (
      profileAuthoring.prepareTerminationFamilyProfilePackageReview(null)
    ));
    const extra = newInput();
    extra.terminationReferenceValueMaterialisationCandidate = {};
    extra.terminationPhase4FamilyProfilePackageReviewAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode('M7_V2_TERMINATION_PHASE4_REVIEW_CONTRACT', () => (
      profileAuthoring.prepareTerminationFamilyProfilePackageReview(extra)
    ));
  });

  await t.test('rejects the Phase4 authority before nested input drift', () => {
    const drift = newInput();
    drift.terminationPhase4FamilyProfilePackageReviewAuthority
      .binding.sha256 = '0'.repeat(64);
    drift.terminationReferenceValueMaterialisationInput.extra = true;
    expectCode('M7_V2_TERMINATION_PHASE4_REVIEW_AUTHORITY', () => (
      profileAuthoring.prepareTerminationFamilyProfilePackageReview(drift)
    ));
  });

  await t.test('rejects nested shape before Phase3 candidate failure', () => {
    const drift = newInput();
    drift.terminationReferenceValueMaterialisationInput.extra = true;
    drift.terminationReferenceValueMaterialisationInput
      .terminationPhase3ReferenceValueMaterialisationAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(
      'M7_V2_TERMINATION_PHASE4_MATERIALISATION_INPUT',
      () => profileAuthoring.prepareTerminationFamilyProfilePackageReview(
        drift,
      ),
    );
  });

  await t.test('maps the first internal Phase3 failure to the facade code', () => {
    const drift = newInput();
    drift.terminationReferenceValueMaterialisationInput
      .terminationPhase3ReferenceValueMaterialisationAuthority
      .binding.sha256 = '0'.repeat(64);
    expectCode(
      'M7_V2_TERMINATION_PHASE4_MATERIALISATION_CANDIDATE',
      () => profileAuthoring.prepareTerminationFamilyProfilePackageReview(
        drift,
      ),
    );
  });

  assert.equal(
    authority.execution_schedule
      .execution_count_in_this_temp_authority_construction,
    0,
  );
  assert.equal(authority.execution_schedule.focused_test_name, t.name);
  const focusedArgv = [
    'node',
    '--test',
    '--test-name-pattern',
    `^${t.name}$`,
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ];
  assert.deepEqual(authority.execution_schedule.red.argv, focusedArgv);
  assert.equal(authority.execution_schedule.red.expected_exit_code, 1);
  assert.equal(authority.execution_schedule.red.maximum_runs, 1);
  assert.deepEqual(authority.execution_schedule.green.argv, focusedArgv);
  assert.equal(authority.execution_schedule.green.expected_exit_code, 0);
  assert.equal(authority.execution_schedule.green.maximum_runs, 1);
});

test('Phase5 Termination package resolution uses one governed disclosure note to satisfy b9e without a typed fact, target, dependency, absence proof or Work3 identity', async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationFamilyProfilePackageResolution,
    'function',
    'Phase5 resolution facade export is missing.',
  );

  const captureAuthorityBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-ruling-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_RULING_AUTHORITY/V1","record_id_field":"termination_authoring_phase5_governed_disclosure_note_ruling_authority_id","record_id":"98ee4f4779c5ac12e4c0b87a856c3383c1a40e10d014441b2f7f01094e9888fa","byte_length":7933,"sha256":"66dacd7e6151e261e2eeb422443e340787be6699ec8a7a5e15673376c1034b98"});
  const rulingRecordBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_TERMINATION_B9E_JURISDICTION_LIST_DISCLOSURE_NOTE_RULING/V1","record_id_field":"lawyer_ruling_id","record_id":"5612a68b5416a51e26e604c525b8d93ec7285a51f6eba2edca6d251043aa7567","byte_length":1639,"sha256":"f0e1155fe4f07f2f710666815afacea109f6978a6c9d04d581016301fe6efa5a"});
  const phase5AuthorityBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_AUTHORITY/V1","record_id_field":"termination_authoring_phase5_governed_disclosure_note_authority_id","record_id":"10bcf58ff7c7a95794fcc1cb2788ce7b768c49865a5f8b2271f1a2d6e2b1f126","byte_length":22512,"sha256":"11022734a686d0f6efeee52b957e2d6e125f2b2167e7136a14e3d3d69dd786e8"});
  const phase4AuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
    record_id_field:
      'termination_authoring_phase4_family_profile_package_review_authority_id',
    record_id:
      '3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e',
    byte_length: 115221,
    sha256:
      '2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18',
  });
  const phase3SupersessionAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-value-materialisation-audit-transport-supersession-authority.json',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUDIT_TRANSPORT_SUPERSESSION/V1',
    record_id_field:
      'termination_authoring_phase3_reference_value_materialisation_audit_transport_supersession_authority_id',
    record_id:
      '78515ce0a45027a5ef62211c453fac60d54740bb592ce36ac5fb54155158d687',
    byte_length: 11825,
    sha256:
      'd759f169327db614b08b2bcba174fce73502ca62fc13313e97a5785b59bea510',
  });
  const phase3CompletionReceiptBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-value-materialisation-audit-transport-supersession-completion-receipt.json',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUDIT_TRANSPORT_SUPERSESSION_COMPLETION_RECEIPT/V1',
    record_id_field:
      'termination_authoring_phase3_reference_value_materialisation_audit_transport_supersession_completion_receipt_id',
    record_id:
      '93d469ebcd04640669646dda578ca1521c2e017a14a8fc737bb71902735c4b4e',
    byte_length: 4193,
    sha256:
      '2874464a4b26a6c547e65f837a0c93ea4abf8a0ed1fcb847359b795b16692c4c',
  });
  const productionBinding = Object.freeze({
    path: 'lib/canonical-v2/m7-v2-profile-authoring.js',
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 673122,
    sha256:
      '87c670616968b1c86d6ec1d9519e8a1cc9bc31f3a261e0b4c011777ca2640d22',
  });
  const testBinding = Object.freeze({
    path: 'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 670711,
    sha256:
      'a8924571a0adf0f8f9e3e69b0d8e23f32900b03a524fc630cc28babe70c0066c',
  });
  const exactLinkedBindingKeys = [
    'path',
    'schema_version',
    'record_id_field',
    'record_id',
    'byte_length',
    'sha256',
  ];
  const exactPhysicalBindingKeys = [
    'byte_length',
    'path',
    'record_id',
    'record_id_field',
    'schema_version',
    'sha256',
  ];
  const sealedEnvelope = (binding, idField, rootKeys, label) => {
    const bytes = physicalBytes(binding);
    const envelope = sourceEnvelope(binding);
    assertExactKeys(envelope.binding, exactLinkedBindingKeys, label + ' binding');
    assert.deepEqual(
      Buffer.from(bytes),
      Buffer.from(canonicalJson(envelope.record) + '\n', 'utf8'),
      label + ' canonical LF',
    );
    assertExactKeys(envelope.record, rootKeys, label + ' root keys');
    const unsigned = structuredClone(envelope.record);
    delete unsigned[idField];
    assert.equal(
      contentId(envelope.record.schema_version, unsigned),
      binding.record_id,
      label + ' self ID',
    );
    assert.equal(bytes.byteLength, binding.byte_length, label + ' bytes');
    assert.equal(sha256Hex(bytes), binding.sha256, label + ' SHA');
    return envelope;
  };

  const captureAuthorityEnvelope = sealedEnvelope(
    captureAuthorityBinding,
    'termination_authoring_phase5_governed_disclosure_note_ruling_authority_id',
    [
      'authority_classification',
      'authority_state',
      'execution_schedule',
      'filesystem_scope',
      'forbidden_effects',
      'immutable_parent_bindings',
      'phase4_legal_stop_contract',
      'question_and_response',
      'ruling_record_contract',
      'schema_version',
      'termination_authoring_phase5_governed_disclosure_note_ruling_authority_id',
      'zero_effect_boundary',
    ],
    'Phase5 ruling capture authority',
  );
  const rulingEnvelope = sealedEnvelope(
    rulingRecordBinding,
    'lawyer_ruling_id',
    [
      'agreement_id',
      'approver',
      'authority_class',
      'family_key',
      'field_key',
      'lawyer_ruling_id',
      'profile_key',
      'reference_slot_key',
      'ruling_effect',
      'ruling_text',
      'schema_version',
      'source_admission_gap_id',
      'source_unit_key',
    ],
    'Phase5 standalone ruling',
  );
  const phase5AuthorityEnvelope = sealedEnvelope(
    phase5AuthorityBinding,
    'termination_authoring_phase5_governed_disclosure_note_authority_id',
    [
      'authority_classification',
      'authority_state',
      'candidate_output_contract',
      'design_basis',
      'execution_schedule',
      'forbidden_output_contract',
      'governed_disclosure_note_contract',
      'immutable_parent_bindings',
      'implementation_contract',
      'legal_ruling_binding',
      'profile_resolution_contract',
      'schema_version',
      'termination_authoring_phase5_governed_disclosure_note_authority_id',
      'zero_effect_boundary',
    ],
    'Phase5 technical authority',
  );
  const captureAuthority = captureAuthorityEnvelope.record;
  const ruling = rulingEnvelope.record;
  const phase5Authority = phase5AuthorityEnvelope.record;

  assert.deepEqual(
    captureAuthority.question_and_response,
    {
      approver: 'BEN_GOODCHILD',
      approved_on: '2026-08-21',
      normalised_question:
        'What text should the approved b9e output display for JURISDICTION_LIST_REFERENCE while the referenced Company Letter remains non-public and its contents are not admitted?',
      raw_user_instruction:
        'I would instead just say for list of jurisdictions “contained in non-public disclosure letter”',
      exact_decision_answer: 'contained in non-public disclosure letter',
      decision_construction:
        'THE_EXACT_DECISION_ANSWER_NORMALISES_ONLY_THE_QUOTED_DISPLAY_TEXT_IN_THE_RAW_USER_INSTRUCTION',
    },
  );
  assert.deepEqual(
    captureAuthority.immutable_parent_bindings,
    {
      phase4_family_profile_package_review_authority:
        phase4AuthorityBinding,
      phase4_profile_authoring_implementation: productionBinding,
      phase4_work3_test: testBinding,
    },
  );
  const legalStop = captureAuthority.phase4_legal_stop_contract;
  assert.equal(legalStop.family_key, 'TERMINATION');
  assert.equal(
    legalStop.proposed_profile_key,
    'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712',
  );
  assert.equal(
    legalStop.phase3_profile_key,
    'PROFILE:TERMINATION:LEGAL_RESTRAINT:b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712',
  );
  assert.equal(
    legalStop.source_unit_key,
    '77fd31b1daacccb607cfdf1e7469c583b6a63a790469c1ff49f2e5f95e7594bb',
  );
  assert.equal(legalStop.field_key, 'JURISDICTION_LIST_REFERENCE');
  assert.equal(
    legalStop.reference_slot_key,
    'b386c34a17e216f31b164dc1638a6a2310f357932aea083b923626e6ac0818ad',
  );
  assert.equal(
    legalStop.source_admission_gap_id,
    '9f7a5e21e19e105e6ed6e4a45ce50dea9be3d8ffc2a4b4e1ccba87d3efbfed3b',
  );
  assert.deepEqual(legalStop.retained_validation, {
    extraction_state: 'INCOMPLETE',
    source_quality: 'SOURCE_LIMITED',
    output_disposition: 'REVIEW_ONLY',
    issue_codes: [
      'PRIVATE_COMPANY_LETTER_SOURCE_NOT_ADMITTED_OR_M2_INDEXED_TARGET_SELECTION_AND_TYPED_VALUE_WITHHELD',
    ],
    no_comparison_authority: null,
  });
  assert.equal(
    legalStop.phase4_execution_evidence.red.execution_id,
    'RED_PHASE4_PUBLIC_FACADE',
  );
  assert.equal(
    legalStop.phase4_execution_evidence.green.execution_id,
    'GREEN_PHASE4_PUBLIC_FACADE',
  );
  assert.equal(
    legalStop.phase4_execution_evidence.red.total_duration_ms,
    73.2265,
  );
  assert.equal(
    legalStop.phase4_execution_evidence.green.total_duration_ms,
    21756.186583,
  );
  assert.equal(legalStop.work3_approval_payload_present, false);
  assert.deepEqual(captureAuthority.execution_schedule, {
    exact_execution_count: 0,
    executions: [],
    persistence_method: 'APPLY_PATCH_ONLY',
  });

  assert.equal(ruling.authority_class, 'BEN_LEGAL_RULING');
  assert.equal(ruling.approver, 'BEN_GOODCHILD');
  assert.equal(ruling.family_key, 'TERMINATION');
  assert.equal(
    ruling.agreement_id,
    '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
  );
  assert.equal(ruling.profile_key, legalStop.phase3_profile_key);
  assert.equal(ruling.source_unit_key, legalStop.source_unit_key);
  assert.equal(ruling.field_key, legalStop.field_key);
  assert.equal(ruling.reference_slot_key, legalStop.reference_slot_key);
  assert.equal(
    ruling.source_admission_gap_id,
    legalStop.source_admission_gap_id,
  );
  assert.equal(
    ruling.ruling_text,
    'contained in non-public disclosure letter',
  );
  assert.deepEqual(ruling.ruling_effect.resulting_validation, {
    extraction_state: 'COMPLETE',
    source_quality: 'SUFFICIENT',
    output_disposition: 'NORMAL',
    issue_codes: [],
    no_comparison_authority: null,
  });
  assert.equal(
    ruling.ruling_effect.effect_kind,
    'AUTHORISE_ONE_GOVERNED_DISCLOSURE_NOTE_NOT_A_REFERENCE_TARGET_FACT_OR_ABSENCE_PROOF',
  );
  assert.equal(
    ruling.ruling_effect.governed_disclosure_note_authorised,
    true,
  );
  for (const [key, value] of Object.entries(ruling.ruling_effect)) {
    if (key.endsWith('_authorised')
      && key !== 'governed_disclosure_note_authorised') {
      assert.equal(value, false, key);
    }
  }

  assert.deepEqual(
    phase5Authority.immutable_parent_bindings,
    {
      phase3_audit_transport_supersession_authority:
        phase3SupersessionAuthorityBinding,
      phase3_audit_transport_supersession_completion_receipt:
        phase3CompletionReceiptBinding,
      phase3_reference_value_materialisation_authority:
        TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING,
      phase4_family_profile_package_review_authority:
        phase4AuthorityBinding,
      phase4_profile_authoring_implementation: productionBinding,
      phase4_work3_test: testBinding,
    },
  );
  assert.deepEqual(
    phase5Authority.legal_ruling_binding.ruling_authority_binding,
    captureAuthorityBinding,
  );
  assert.deepEqual(
    phase5Authority.legal_ruling_binding.ruling_record_binding,
    rulingRecordBinding,
  );
  assert.deepEqual(
    phase5Authority.legal_ruling_binding.ruling_record,
    ruling,
  );
  assert.deepEqual(
    phase5Authority.implementation_contract.exact_outer_input_keys,
    [
      'terminationPhase5ResolutionEvidence',
      'terminationFamilyProfilePackageReviewInput',
    ],
  );
  assert.deepEqual(
    phase5Authority.implementation_contract.exact_resolution_evidence_keys,
    [
      'governedDisclosureNoteRulingAuthority',
      'governedDisclosureNoteRuling',
      'familyProfilePackageResolutionAuthority',
    ],
  );
  assert.deepEqual(
    phase5Authority.implementation_contract.exact_envelope_keys,
    ['binding', 'record'],
  );
  assert.deepEqual(
    phase5Authority.implementation_contract.exact_nested_review_input_keys,
    [
      'terminationPhase4FamilyProfilePackageReviewAuthority',
      'terminationReferenceValueMaterialisationInput',
    ],
  );
  assert.deepEqual(
    phase5Authority.implementation_contract.observable_error_order,
    [
      'M7_V2_TERMINATION_PHASE5_CONTRACT',
      'M7_V2_TERMINATION_PHASE5_AUTHORITY',
      'M7_V2_TERMINATION_PHASE5_LEGAL_RULING',
      'M7_V2_TERMINATION_PHASE5_PHASE4_INPUT',
      'M7_V2_TERMINATION_PHASE5_PHASE4_CANDIDATE',
      'M7_V2_TERMINATION_PHASE5_OUTPUT',
    ],
  );
  assert.equal(
    phase5Authority.governed_disclosure_note_contract
      .authority_local_profile_requirement_record_id_rule,
    'CONTENT_ID_OVER_SCHEMA_VERSION_AND_EXACT_FIVE_KEY_AUTHORITY_LOCAL_REQUIREMENT_BODY_ONLY_EXCLUDING_WORK3_IDENTITY',
  );
  assert.equal(
    Object.hasOwn(
      phase5Authority.governed_disclosure_note_contract
        .authority_local_profile_requirement_body,
      'work3_identity',
    ),
    false,
  );
  assert.equal(
    phase5Authority.governed_disclosure_note_contract.work3_identity,
    false,
  );
  assert.equal(
    phase5Authority.governed_disclosure_note_contract
      .downstream_restamp_required,
    true,
  );

  const phase5Schedule = phase5Authority.execution_schedule;
  assert.equal(phase5Schedule.test_name, t.name);
  assert.equal(phase5Schedule.exact_execution_count, 2);
  assert.deepEqual(
    phase5Schedule.executions.map((entry) => entry.execution_id),
    [
      'RED_PHASE5_GOVERNED_DISCLOSURE_NOTE_RESOLUTION',
      'GREEN_PHASE5_GOVERNED_DISCLOSURE_NOTE_RESOLUTION',
    ],
  );
  assert.equal(
    phase5Schedule.executions[1].predecessor_execution_id,
    'RED_PHASE5_GOVERNED_DISCLOSURE_NOTE_RESOLUTION',
  );
  const focusedArgv = [
    'node',
    '--test',
    '--test-name-pattern',
    '^' + t.name + '$',
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ];
  assert.deepEqual(phase5Schedule.executions[0].argv, focusedArgv);
  assert.deepEqual(phase5Schedule.executions[1].argv, focusedArgv);
  assert.deepEqual(
    phase5Schedule.executions[0].success_contract,
    {
      required_first_assertion:
        'MISSING_FACADE_EXPORT_BEFORE_ANY_PHASE5_AUTHORITY_ACCESS',
      required_first_failure_message:
        'Phase5 resolution facade export is missing.',
      required_actual_type: 'undefined',
      required_expected_type: 'function',
    },
  );
  assert.deepEqual(
    phase5Schedule.executions[1].success_contract,
    {
      required_test_count: 6,
      required_pass_count: 6,
      required_fail_count: 0,
      required_stderr_state: 'EMPTY',
    },
  );
  assert.equal(phase5Schedule.broader_execution_forbidden, true);
  assert.equal(phase5Schedule.phase5_completion_receipt_required, true);

  const newPhase4Input = () => ({
    terminationPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(phase4AuthorityBinding),
    terminationReferenceValueMaterialisationInput:
      terminationPhase3ReferenceValueMaterialisationFixture(),
  });
  const newInput = () => ({
    terminationPhase5ResolutionEvidence: {
      governedDisclosureNoteRulingAuthority:
        sourceEnvelope(captureAuthorityBinding),
      governedDisclosureNoteRuling: sourceEnvelope(rulingRecordBinding),
      familyProfilePackageResolutionAuthority:
        sourceEnvelope(phase5AuthorityBinding),
    },
    terminationFamilyProfilePackageReviewInput: newPhase4Input(),
  });
  const input = newInput();
  const before = fixtureFingerprint(input);
  assertRecursivelyUnfrozen(input);
  assert.deepEqual(
    Object.keys(input),
    phase5Authority.implementation_contract.exact_outer_input_keys,
  );
  assert.deepEqual(
    Object.keys(input.terminationPhase5ResolutionEvidence),
    phase5Authority.implementation_contract.exact_resolution_evidence_keys,
  );
  Object.values(input.terminationPhase5ResolutionEvidence).forEach(
    (envelope) => assertExactKeys(
      envelope,
      ['binding', 'record'],
      'Phase5 resolution evidence envelope',
    ),
  );
  assert.deepEqual(
    Object.keys(input.terminationFamilyProfilePackageReviewInput),
    phase5Authority.implementation_contract.exact_nested_review_input_keys,
  );

  const phase4Candidate = profileAuthoring
    .prepareTerminationFamilyProfilePackageReview(
      input.terminationFamilyProfilePackageReviewInput,
    );
  const materialisationInput = input
    .terminationFamilyProfilePackageReviewInput
    .terminationReferenceValueMaterialisationInput;
  const materialisationCandidate = profileAuthoring
    .prepareTerminationReferenceValueMaterialisationCandidate(
      materialisationInput,
    );
  assert.equal(phase4Candidate.proposed_profiles.length, 45);
  assert.equal(phase4Candidate.review_accounting.complete_profile_count, 44);
  assert.equal(phase4Candidate.review_accounting.incomplete_profile_count, 1);
  assert.equal(
    materialisationCandidate.reference_value_ledger.length,
    221,
  );
  assert.equal(
    materialisationCandidate.reference_value_ledger.filter(
      (row) => row.typed_value !== null,
    ).length,
    220,
  );
  const unresolvedB386 = materialisationCandidate.reference_value_ledger
    .filter((row) => (
      row.profile_key === legalStop.phase3_profile_key
      && row.source_unit_key === legalStop.source_unit_key
      && row.field_key === legalStop.field_key
    ));
  assert.equal(unresolvedB386.length, 1);
  assert.equal(unresolvedB386[0].typed_value, null);
  assert.equal(
    unresolvedB386[0].work3_fixture_consumable_value_shape,
    false,
  );

  const requirementBody = {
    field_key: 'JURISDICTION_LIST_REFERENCE',
    value_type: 'REFERENCE',
    cardinality: 'ONE',
    materiality: 'MATERIAL',
    lawyer_ruling_id: ruling.lawyer_ruling_id,
  };
  const profileRequirementId = contentId(
    'M7_V2_TERMINATION_PHASE5_AUTHORITY_LOCAL_PROFILE_REQUIREMENT/V1',
    requirementBody,
  );
  assert.equal(
    profileRequirementId,
    'be9441b716439e2119e024ea3ea5ac9e50dff4bc0b3b22a2cc27f06bc8442124',
  );
  assert.deepEqual(
    requirementBody,
    phase5Authority.governed_disclosure_note_contract
      .authority_local_profile_requirement_body,
  );
  const profileRequirement = {
    schema_version:
      'M7_V2_TERMINATION_PHASE5_AUTHORITY_LOCAL_PROFILE_REQUIREMENT/V1',
    profile_requirement_id: profileRequirementId,
    field_key: requirementBody.field_key,
    value_type: requirementBody.value_type,
    cardinality: requirementBody.cardinality,
    materiality: requirementBody.materiality,
    lawyer_ruling_id: requirementBody.lawyer_ruling_id,
    work3_identity: false,
  };
  assertExactKeys(
    profileRequirement,
    phase5Authority.governed_disclosure_note_contract
      .authority_local_profile_requirement_exact_keys,
    'authority-local Phase5 requirement keys',
  );

  const unsignedNote = {
    agreement_id:
      '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
    profile_key: legalStop.phase3_profile_key,
    source_unit_key: legalStop.source_unit_key,
    field_key: legalStop.field_key,
    profile_requirement_id: profileRequirementId,
    reference_slot_key: legalStop.reference_slot_key,
    source_admission_gap_id: legalStop.source_admission_gap_id,
    disposition_kind: 'NON_PUBLIC_DISCLOSURE_LOCATION',
    display_text: 'contained in non-public disclosure letter',
    lawyer_ruling_id: ruling.lawyer_ruling_id,
  };
  const governedDisclosureNote = {
    schema_version: 'M7_V2_GOVERNED_DISCLOSURE_NOTE/V1',
    governed_disclosure_note_id: contentId(
      'M7_V2_GOVERNED_DISCLOSURE_NOTE/V1',
      {
        schema_version: 'M7_V2_GOVERNED_DISCLOSURE_NOTE/V1',
        ...unsignedNote,
      },
    ),
    ...unsignedNote,
  };
  assertExactKeys(
    governedDisclosureNote,
    phase5Authority.governed_disclosure_note_contract.exact_keys,
    'governed disclosure note keys',
  );

  const expectedProfiles = phase4Candidate.proposed_profiles.map(
    (phase4Profile) => {
      const profile = structuredClone(phase4Profile);
      const isB9e = profile.proposed_profile_key
        === legalStop.proposed_profile_key;
      if (isB9e) {
        profile.proposed_validation = {
          extraction_state: 'COMPLETE',
          source_quality: 'SUFFICIENT',
          output_disposition: 'NORMAL',
          issue_codes: [],
          no_comparison_authority: null,
        };
        profile.missing_required_field_keys = [];
        profile.dependency_proposals = [];
        profile.absence_proofs = [];
      }
      profile.governed_disclosure_notes = isB9e
        ? [structuredClone(governedDisclosureNote)]
        : [];
      return profile;
    },
  );
  assert.equal(expectedProfiles.length, 45);
  assert.deepEqual(
    expectedProfiles.map((profile) => profile.proposed_profile_key),
    expectedProfiles.map((profile) => profile.proposed_profile_key).sort(),
  );
  const expectedAccounting = {
    activation_count: 0,
    approval_count: 0,
    authority_local_identity_count: 3,
    complete_profile_count: 45,
    comparison_effect_count: 0,
    family_package_count: 0,
    governed_disclosure_note_count: 1,
    incomplete_profile_count: 0,
    inventory_digest_count: 0,
    market_statistics_effect_count: 0,
    materialised_reference_value_count: 220,
    normal_output_disposition_count: 45,
    proposed_profile_count: 45,
    reference_occurrence_count: 221,
    registration_count: 0,
    retained_source_admission_gap_count: 1,
    review_only_output_disposition_count: 0,
    source_limited_profile_count: 0,
    state:
      'COMPLETE_TECHNICAL_RESOLUTION_45_PROPOSALS_45_COMPLETE_ONE_GOVERNED_DISCLOSURE_NOTE_ONE_RETAINED_SOURCE_GAP',
    unresolved_reference_value_count: 1,
    work3_fixture_fact_count: 0,
    work3_identity_count: 0,
  };
  const expectedRetainedGaps = [{
    phase3_profile_key: legalStop.phase3_profile_key,
    source_unit_key: legalStop.source_unit_key,
    field_key: legalStop.field_key,
    reference_slot_key: legalStop.reference_slot_key,
    source_admission_gap_id: legalStop.source_admission_gap_id,
    typed_value: null,
    target_id: null,
    required_field_blocking: false,
  }];
  const expectedWithheld = [
    'approved_inventory_digest',
    'ben_approval_id',
    'child_rule_requirement_id',
    'conditional_requirement_id',
    'dimension_evidence_id',
    'family_approval_id',
    'family_profile_package_id',
    'fixture_id',
    'inventory_fingerprint',
    'match_fixture_id',
    'profile_id',
    'requirement_id',
    'subtype_tree_id',
    'tree_id',
  ];
  const expectedNextStop = {
    state: 'STOP_AFTER_PHASE5_GREEN_BEFORE_WORK3_SUCCESSOR_AUTHORITY',
    required_next_evidence: 'PHASE5_EXECUTION_COMPLETION_RECEIPT',
    required_next_authority:
      'WORK3_GOVERNED_DISCLOSURE_NOTE_SCHEMA_PACKAGE_ANALYSIS_PROJECTION_SUCCESSOR_AUTHORITY',
    legal_question_state: 'RESOLVED_NO_NEW_LEGAL_DECISION_REQUIRED',
    work3_inventory_approval_state: 'NOT_YET_CONSTRUCTED_OR_PERMITTED',
    package_approval_permitted: false,
  };
  const expectedZero = {
    activation_count: 0,
    authority_local_identity_count: 3,
    comparison_value_count: 0,
    database_write_count: 0,
    family_package_count: 0,
    governed_analysis_count: 0,
    governed_disclosure_note_count: 1,
    governed_projection_count: 0,
    inventory_digest_count: 0,
    market_statistics_count: 0,
    network_read_count: 0,
    network_write_count: 0,
    package_approval_count: 0,
    product_write_count: 0,
    registration_count: 0,
    repository_write_count: 0,
    review_proposal_count: 45,
    source_admission_count: 0,
    typed_fact_count: 0,
    work3_identity_count: 0,
  };
  const expectedUnsignedCandidate = {
    family_key: 'TERMINATION',
    candidate_state:
      'REVIEW_ONLY_45_PROFILES_45_COMPLETE_ONE_GOVERNED_DISCLOSURE_NOTE_RETAINED_PRIVATE_COMPANY_LETTER_GAP',
    profile_approval_state: 'UNAPPROVED',
    authority_binding: structuredClone(phase5AuthorityBinding),
    legal_ruling_reference: {
      ruling_authority_binding: structuredClone(captureAuthorityBinding),
      ruling_record_binding: structuredClone(rulingRecordBinding),
      lawyer_ruling_id: ruling.lawyer_ruling_id,
    },
    phase4_review_reference: {
      review_candidate_id: phase4Candidate.review_candidate_id,
      phase4_authority_id: phase4AuthorityBinding.record_id,
      profile_review_schedule_sha256:
        '58257a6b57c5a2398af37b7d0bbbd07db73d5e5805c09a77e70816afd09c42fe',
    },
    proposed_profiles: expectedProfiles,
    review_accounting: expectedAccounting,
    retained_source_gaps: expectedRetainedGaps,
    withheld_work3_fields: expectedWithheld,
    next_governance_stop: expectedNextStop,
    zero_effect_boundary: expectedZero,
  };
  const expectedCandidate = {
    schema_version:
      'M7_V2_TERMINATION_PHASE5_FAMILY_PROFILE_PACKAGE_RESOLUTION_CANDIDATE/V1',
    resolution_candidate_id: contentId(
      'M7_V2_TERMINATION_PHASE5_FAMILY_PROFILE_PACKAGE_RESOLUTION_CANDIDATE/V1',
      {
        schema_version:
          'M7_V2_TERMINATION_PHASE5_FAMILY_PROFILE_PACKAGE_RESOLUTION_CANDIDATE/V1',
        ...expectedUnsignedCandidate,
      },
    ),
    ...expectedUnsignedCandidate,
  };

  const result = profileAuthoring
    .prepareTerminationFamilyProfilePackageResolution(input);
  const outputContract = phase5Authority.candidate_output_contract;
  assertExactKeys(outputContract, [
    'authority_binding_rule',
    'candidate_lifecycle',
    'candidate_state',
    'exact_keys',
    'family_key',
    'legal_ruling_reference_contract',
    'legal_ruling_reference_exact_keys',
    'next_governance_stop',
    'phase4_review_reference_contract',
    'phase4_review_reference_exact_keys',
    'profile_approval_state',
    'profile_derivation_rule',
    'profile_exact_keys',
    'profile_order',
    'record_id_field',
    'record_id_rule',
    'retained_source_gap_exact_keys',
    'retained_source_gaps',
    'review_accounting_exact_keys',
    'review_accounting_exact_values',
    'schema_version',
    'withheld_work3_fields',
    'zero_effect_boundary_rule',
  ], 'Phase5 candidate output contract keys');
  assert.equal(outputContract.family_key, 'TERMINATION');
  assert.equal(
    outputContract.authority_binding_rule,
    'EQUALS_VERIFIED_FAMILY_PROFILE_PACKAGE_RESOLUTION_AUTHORITY_ENVELOPE_BINDING',
  );
  assert.deepEqual(outputContract.legal_ruling_reference_contract, {
    ruling_authority_binding_rule:
      'EQUALS_PHASE5_AUTHORITY_LEGAL_RULING_BINDING_RULING_AUTHORITY_BINDING',
    ruling_record_binding_rule:
      'EQUALS_PHASE5_AUTHORITY_LEGAL_RULING_BINDING_RULING_RECORD_BINDING',
    lawyer_ruling_id: ruling.lawyer_ruling_id,
  });
  assert.deepEqual(outputContract.phase4_review_reference_contract, {
    review_candidate_id_rule:
      'EQUALS_INTERNALLY_RECOMPUTED_PHASE4_REVIEW_CANDIDATE_ID',
    phase4_authority_id: phase4AuthorityBinding.record_id,
    profile_review_schedule_sha256:
      '58257a6b57c5a2398af37b7d0bbbd07db73d5e5805c09a77e70816afd09c42fe',
  });
  assert.equal(
    outputContract.profile_derivation_rule,
    'COPY_44_PHASE4_PROFILES_UNCHANGED_EXCEPT_EMPTY_GOVERNED_DISCLOSURE_NOTES_AND_RESOLVE_ONLY_B9E_PER_PROFILE_RESOLUTION_CONTRACT',
  );
  assert.deepEqual(
    outputContract.review_accounting_exact_values,
    expectedAccounting,
  );
  assert.deepEqual(outputContract.retained_source_gaps, expectedRetainedGaps);
  assert.equal(
    outputContract.zero_effect_boundary_rule,
    'EQUALS_PHASE5_AUTHORITY_ZERO_EFFECT_BOUNDARY',
  );
  assertExactKeys(
    result,
    outputContract.exact_keys,
    'Phase5 resolution candidate keys',
  );
  assert.deepEqual(result, expectedCandidate);
  assert.equal(result.family_key, 'TERMINATION');
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(
    result.resolution_candidate_id,
    contentId(result.schema_version, {
      schema_version: result.schema_version,
      ...expectedUnsignedCandidate,
    }),
  );
  assertExactKeys(
    result.authority_binding,
    exactLinkedBindingKeys,
    'Phase5 candidate authority binding keys',
  );
  assertExactKeys(
    result.legal_ruling_reference,
    outputContract.legal_ruling_reference_exact_keys,
    'Phase5 legal ruling reference keys',
  );
  assertExactKeys(
    result.phase4_review_reference,
    outputContract.phase4_review_reference_exact_keys,
    'Phase5 Phase4 review reference keys',
  );
  assertExactKeys(
    result.review_accounting,
    outputContract.review_accounting_exact_keys,
    'Phase5 accounting keys',
  );
  assert.deepEqual(result.review_accounting, expectedAccounting);
  assert.deepEqual(result.retained_source_gaps, expectedRetainedGaps);
  assert.deepEqual(result.withheld_work3_fields, expectedWithheld);
  assert.deepEqual(result.next_governance_stop, expectedNextStop);
  assert.deepEqual(result.zero_effect_boundary, expectedZero);
  assert.equal(result.proposed_profiles.length, 45);
  for (const profile of result.proposed_profiles) {
    assertExactKeys(
      profile,
      outputContract.profile_exact_keys,
      profile.proposed_profile_key + ' Phase5 profile keys',
    );
  }
  const resolvedB9e = result.proposed_profiles.find(
    (profile) => profile.proposed_profile_key
      === legalStop.proposed_profile_key,
  );
  assert(resolvedB9e);
  assert.deepEqual(
    resolvedB9e.proposed_validation,
    ruling.ruling_effect.resulting_validation,
  );
  assert.deepEqual(resolvedB9e.missing_required_field_keys, []);
  assert.deepEqual(resolvedB9e.dependency_proposals, []);
  assert.deepEqual(resolvedB9e.absence_proofs, []);
  assert.deepEqual(
    resolvedB9e.governed_disclosure_notes,
    [governedDisclosureNote],
  );
  assert.equal(
    resolvedB9e.reference_value_reviews.filter(
      (review) => review.typed_value === null,
    ).length,
    1,
  );
  for (const profile of result.proposed_profiles.filter(
    (candidate) => candidate !== resolvedB9e,
  )) {
    const predecessor = phase4Candidate.proposed_profiles.find(
      (phase4Profile) => phase4Profile.proposed_profile_key
        === profile.proposed_profile_key,
    );
    const withoutNotes = structuredClone(profile);
    delete withoutNotes.governed_disclosure_notes;
    assert.deepEqual(withoutNotes, predecessor);
    assert.deepEqual(profile.governed_disclosure_notes, []);
  }
  assert.equal(
    result.proposed_profiles.reduce(
      (count, profile) => (
        count + profile.governed_disclosure_notes.length
      ),
      0,
    ),
    1,
  );
  result.proposed_profiles.forEach((profile) => {
    assert.deepEqual(profile.dependency_proposals, []);
    assert.deepEqual(profile.absence_proofs, []);
  });
  const candidateKeys = collectKeys(result);
  for (const key of expectedWithheld) {
    assert.equal(candidateKeys.has(key), false, key);
  }
  for (const key of [
    'typed_fact',
    'typed_fact_id',
    'fixture_fact',
    'fixture_fact_id',
    'proposed_reference_target',
    'proposed_reference_target_id',
    'comparison_value',
    'market_statistics',
    'rendering_overlay',
    'registration_id',
    'activation_id',
  ]) assert.equal(candidateKeys.has(key), false, key);
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(input),
    'Phase5 result/caller input alias',
  );
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(phase4Candidate),
    'Phase5 result/Phase4 candidate alias',
  );
  assert.equal(fixtureFingerprint(input), before);
  assertRecursivelyUnfrozen(input);
  const repeated = profileAuthoring
    .prepareTerminationFamilyProfilePackageResolution(newInput());
  assert.notStrictEqual(repeated, result);
  assert.equal(canonicalJson(repeated), canonicalJson(result));
  assertDisjoint(
    collectObjectIdentities(repeated),
    collectObjectIdentities(result),
    'repeated Phase5 result alias',
  );

  await t.test(
    'contract precedence rejects malformed outer and evidence shapes before all lower faults',
    () => {
      const drift = newInput();
      const originalEnvelope = drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRulingAuthority;
      drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRulingAuthority = {
          record: originalEnvelope.record,
          binding: originalEnvelope.binding,
        };
      drift.terminationPhase5ResolutionEvidence
        .familyProfilePackageResolutionAuthority.record.authority_state =
        'DRIFT';
      drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRuling.record.ruling_text += '.';
      drift.terminationFamilyProfilePackageReviewInput
        .terminationReferenceValueMaterialisationInput
        .terminationPhase3ReferenceValueMaterialisationAuthority
        .binding.sha256 = '0'.repeat(64);
      const malformed = {
        terminationFamilyProfilePackageReviewInput:
          drift.terminationFamilyProfilePackageReviewInput,
        terminationPhase5ResolutionEvidence:
          drift.terminationPhase5ResolutionEvidence,
        terminationFamilyProfilePackageReviewCandidate: {},
      };
      expectCode('M7_V2_TERMINATION_PHASE5_CONTRACT', () => (
        profileAuthoring.prepareTerminationFamilyProfilePackageResolution(
          malformed,
        )
      ));
    },
  );

  await t.test(
    'authority precedence rejects the Phase5 authority before ruling and Phase4 faults',
    () => {
      const drift = newInput();
      drift.terminationPhase5ResolutionEvidence
        .familyProfilePackageResolutionAuthority
        .binding.sha256 = '0'.repeat(64);
      drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRuling.record.ruling_text += '.';
      drift.terminationFamilyProfilePackageReviewInput.extra = true;
      expectCode('M7_V2_TERMINATION_PHASE5_AUTHORITY', () => (
        profileAuthoring.prepareTerminationFamilyProfilePackageResolution(
          drift,
        )
      ));
    },
  );

  await t.test(
    'legal ruling precedence rejects capture or ruling drift before Phase4 faults',
    () => {
      const drift = newInput();
      drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRulingAuthority
        .binding.sha256 = '0'.repeat(64);
      drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRuling.record.ruling_text += '.';
      drift.terminationPhase5ResolutionEvidence
        .governedDisclosureNoteRuling.record.ruling_effect
        .typed_fact_authorised = true;
      drift.terminationFamilyProfilePackageReviewInput.extra = true;
      expectCode('M7_V2_TERMINATION_PHASE5_LEGAL_RULING', () => (
        profileAuthoring.prepareTerminationFamilyProfilePackageResolution(
          drift,
        )
      ));
    },
  );

  await t.test(
    'Phase4 input precedence rejects caller-supplied note or candidate before predecessor execution',
    () => {
      const drift = newInput();
      drift.terminationFamilyProfilePackageReviewInput
        .governedDisclosureNote = {};
      drift.terminationFamilyProfilePackageReviewInput
        .terminationFamilyProfilePackageReviewCandidate = {};
      drift.terminationFamilyProfilePackageReviewInput
        .terminationReferenceValueMaterialisationInput
        .terminationPhase3ReferenceValueMaterialisationAuthority
        .binding.sha256 = '0'.repeat(64);
      expectCode('M7_V2_TERMINATION_PHASE5_PHASE4_INPUT', () => (
        profileAuthoring.prepareTerminationFamilyProfilePackageResolution(
          drift,
        )
      ));
    },
  );

  await t.test(
    'Phase4 candidate precedence rejects internal predecessor drift before output derivation',
    () => {
      const drift = newInput();
      drift.terminationFamilyProfilePackageReviewInput
        .terminationReferenceValueMaterialisationInput
        .terminationPhase3ReferenceValueMaterialisationAuthority
        .binding.sha256 = '0'.repeat(64);
      expectCode('M7_V2_TERMINATION_PHASE5_PHASE4_CANDIDATE', () => (
        profileAuthoring.prepareTerminationFamilyProfilePackageResolution(
          drift,
        )
      ));
    },
  );
});

test("Work3 Termination governed disclosure note Stage A proves prospective schema compatibility without core integration or Work3 identity", async (t) => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview,
    'function',
    'Work3 governed disclosure note schema compatibility review facade export is missing.',
  );

  const stageAAuthorityBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_SCHEMA_PACKAGE_ANALYSIS_PROJECTION_SUCCESSOR_AUTHORITY/V1","record_id_field":"work3_governed_disclosure_note_schema_package_analysis_projection_successor_authority_id","record_id":"054de9dc959cbb12062099efea3620e9582578fc64c90c6d21b878e009adf28a","byte_length":44726,"sha256":"850c9170b0367e83a9030c54f8e896be30cfac14a7b9ba8b15a49cab3270b45b"});
  const completionBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-execution-completion-incident-lineage-superseding-evidence-receipt.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_EXECUTION_COMPLETION_INCIDENT_LINEAGE_SUPERSEDING_EVIDENCE_RECEIPT/V1","record_id_field":"termination_authoring_phase5_governed_disclosure_note_execution_completion_incident_lineage_superseding_evidence_receipt_id","record_id":"1e9c53620dbeac0e3f582ebfca91000111611ede9054193ed174173a78f12e49","byte_length":8867,"sha256":"905b824dd9a76aab8ca2164d08e647ee798143473ef49dbf40d9e6a768dbfe52"});
  const work3Binding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1","record_id_field":"correction_authority_id","record_id":"561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873","byte_length":237749,"sha256":"42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb"});
  const captureBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-ruling-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_RULING_AUTHORITY/V1","record_id_field":"termination_authoring_phase5_governed_disclosure_note_ruling_authority_id","record_id":"98ee4f4779c5ac12e4c0b87a856c3383c1a40e10d014441b2f7f01094e9888fa","byte_length":7933,"sha256":"66dacd7e6151e261e2eeb422443e340787be6699ec8a7a5e15673376c1034b98"});
  const rulingBinding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_TERMINATION_B9E_JURISDICTION_LIST_DISCLOSURE_NOTE_RULING/V1","record_id_field":"lawyer_ruling_id","record_id":"5612a68b5416a51e26e604c525b8d93ec7285a51f6eba2edca6d251043aa7567","byte_length":1639,"sha256":"f0e1155fe4f07f2f710666815afacea109f6978a6c9d04d581016301fe6efa5a"});
  const phase5Binding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_AUTHORITY/V1","record_id_field":"termination_authoring_phase5_governed_disclosure_note_authority_id","record_id":"10bcf58ff7c7a95794fcc1cb2788ce7b768c49865a5f8b2271f1a2d6e2b1f126","byte_length":22512,"sha256":"11022734a686d0f6efeee52b957e2d6e125f2b2167e7136a14e3d3d69dd786e8"});
  const phase4Binding = Object.freeze({"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1","record_id_field":"termination_authoring_phase4_family_profile_package_review_authority_id","record_id":"3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e","byte_length":115221,"sha256":"2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18"});

  const stageAAuthorityEnvelope = sourceEnvelope(stageAAuthorityBinding);
  const completionEnvelope = sourceEnvelope(completionBinding);
  const work3Envelope = sourceEnvelope(work3Binding);
  const phase5Authority = sourceEnvelope(phase5Binding).record;
  const ruling = sourceEnvelope(rulingBinding).record;
  const exactLinkedBindingKeys = [
    'path',
    'schema_version',
    'record_id_field',
    'record_id',
    'byte_length',
    'sha256',
  ];

  const newPhase4Input = () => ({
    terminationPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(phase4Binding),
    terminationReferenceValueMaterialisationInput:
      terminationPhase3ReferenceValueMaterialisationFixture(),
  });
  const newPhase5Input = () => ({
    terminationPhase5ResolutionEvidence: {
      governedDisclosureNoteRulingAuthority: sourceEnvelope(captureBinding),
      governedDisclosureNoteRuling: sourceEnvelope(rulingBinding),
      familyProfilePackageResolutionAuthority: sourceEnvelope(phase5Binding),
    },
    terminationFamilyProfilePackageReviewInput: newPhase4Input(),
  });
  const newInput = () => ({
    terminationWork3SchemaSuccessorEvidence: {
      work3EntryCorrectionAuthority: sourceEnvelope(work3Binding),
      phase5ExecutionCompletionReceipt: sourceEnvelope(completionBinding),
      work3GovernedDisclosureNoteSchemaSuccessorAuthority:
        sourceEnvelope(stageAAuthorityBinding),
    },
    terminationPhase5ResolutionInput: newPhase5Input(),
  });

  const input = newInput();
  const before = fixtureFingerprint(input);
  assertRecursivelyUnfrozen(input);
  const phase4Candidate = profileAuthoring
    .prepareTerminationFamilyProfilePackageReview(
      input.terminationPhase5ResolutionInput
        .terminationFamilyProfilePackageReviewInput,
    );
  const phase5OutputContract = phase5Authority.candidate_output_contract;
  const phase5NoteContract = phase5Authority
    .governed_disclosure_note_contract;
  const exactNote = phase5NoteContract.exact_note_contract;
  const requirementBody = phase5NoteContract
    .authority_local_profile_requirement_body;
  const profileRequirementId = contentId(
    phase5NoteContract.authority_local_profile_requirement_schema_version,
    requirementBody,
  );
  const noteUnsigned = {
    agreement_id: exactNote.agreement_id,
    profile_key: exactNote.profile_key,
    source_unit_key: exactNote.source_unit_key,
    field_key: exactNote.field_key,
    profile_requirement_id: profileRequirementId,
    reference_slot_key: exactNote.reference_slot_key,
    source_admission_gap_id: exactNote.source_admission_gap_id,
    disposition_kind: exactNote.disposition_kind,
    display_text: exactNote.display_text,
    lawyer_ruling_id: ruling.lawyer_ruling_id,
  };
  const phase5Note = {
    schema_version: phase5NoteContract.schema_version,
    governed_disclosure_note_id: contentId(
      phase5NoteContract.schema_version,
      {
        schema_version: phase5NoteContract.schema_version,
        ...noteUnsigned,
      },
    ),
    ...noteUnsigned,
  };
  const expectedProfiles = phase4Candidate.proposed_profiles.map(
    (phase4Profile) => {
      const profile = structuredClone(phase4Profile);
      const isB9e = profile.proposed_profile_key
        === phase5Authority.profile_resolution_contract
          .resolved_proposed_profile_key;
      if (isB9e) {
        profile.proposed_validation = structuredClone(
          phase5Authority.profile_resolution_contract.after_validation,
        );
        profile.missing_required_field_keys = [];
        profile.dependency_proposals = [];
        profile.absence_proofs = [];
      }
      profile.governed_disclosure_notes = isB9e
        ? [structuredClone(phase5Note)]
        : [];
      return profile;
    },
  );
  const expectedPhase5Unsigned = {
    family_key: phase5OutputContract.family_key,
    candidate_state: phase5OutputContract.candidate_state,
    profile_approval_state: phase5OutputContract.profile_approval_state,
    authority_binding: structuredClone(phase5Binding),
    legal_ruling_reference: {
      ruling_authority_binding: structuredClone(captureBinding),
      ruling_record_binding: structuredClone(rulingBinding),
      lawyer_ruling_id: ruling.lawyer_ruling_id,
    },
    phase4_review_reference: {
      review_candidate_id: phase4Candidate.review_candidate_id,
      phase4_authority_id:
        phase5OutputContract.phase4_review_reference_contract
          .phase4_authority_id,
      profile_review_schedule_sha256:
        phase5OutputContract.phase4_review_reference_contract
          .profile_review_schedule_sha256,
    },
    proposed_profiles: expectedProfiles,
    review_accounting: structuredClone(
      phase5OutputContract.review_accounting_exact_values,
    ),
    retained_source_gaps: structuredClone(
      phase5OutputContract.retained_source_gaps,
    ),
    withheld_work3_fields: structuredClone(
      phase5OutputContract.withheld_work3_fields,
    ),
    next_governance_stop: structuredClone(
      phase5OutputContract.next_governance_stop,
    ),
    zero_effect_boundary: structuredClone(
      phase5Authority.zero_effect_boundary,
    ),
  };
  const phase5CandidateSchema = phase5OutputContract.schema_version;
  const expectedFreshPhase5CandidateId = contentId(
    phase5CandidateSchema,
    {
      schema_version: phase5CandidateSchema,
      ...expectedPhase5Unsigned,
    },
  );

  const result = profileAuthoring
    .prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview(
      input,
    );
  const authority = stageAAuthorityEnvelope.record;
  const candidateContract = authority.schema_review_candidate_contract;
  const expectedUnsignedCandidate = {
    candidate_state: candidateContract.candidate_state,
    authority_binding: structuredClone(stageAAuthorityBinding),
    phase5_resolution_reference: {
      phase5_authority_id:
        candidateContract.phase5_resolution_reference_contract
          .phase5_authority_id,
      resolution_candidate_id: expectedFreshPhase5CandidateId,
      retained_source_gap_id:
        candidateContract.phase5_resolution_reference_contract
          .retained_source_gap_id,
      review_accounting_state:
        candidateContract.phase5_resolution_reference_contract
          .review_accounting_state,
      work3_identity_reuse:
        candidateContract.phase5_resolution_reference_contract
          .work3_identity_reuse,
    },
    phase5_completion_reference: {
      binding: structuredClone(completionBinding),
      completion_state:
        candidateContract.phase5_completion_reference_contract
          .completion_state,
      receipt_id:
        candidateContract.phase5_completion_reference_contract.receipt_id,
    },
    work3_predecessor_reference: {
      binding: structuredClone(work3Binding),
      correction_authority_id:
        candidateContract.work3_predecessor_reference_contract
          .correction_authority_id,
    },
    profile_routing_fixture: structuredClone(
      authority.mixed_profile_routing_contract,
    ),
    requirement_fixture: structuredClone(
      authority.requirement_restamp_contract,
    ),
    governed_disclosure_note_fixture: structuredClone(
      authority.governed_disclosure_note_contract,
    ),
    expression_fixture: structuredClone(
      authority.termination_expression_successor_contract,
    ),
    rule_fixture: structuredClone(authority.rule_successor_contract),
    projection_fixture: structuredClone(
      authority.projection_successor_contract,
    ),
    semantic_exclusion_contract: structuredClone(
      candidateContract.semantic_exclusion_exact_values,
    ),
    review_accounting: structuredClone(
      candidateContract.review_accounting_exact_values,
    ),
    withheld_work3_fields: structuredClone(
      candidateContract.withheld_work3_fields,
    ),
    next_governance_stop: structuredClone(
      candidateContract.next_governance_stop_contract,
    ),
    zero_effect_boundary: structuredClone(authority.zero_effect_boundary),
  };
  const expectedCandidate = {
    schema_version: candidateContract.schema_version,
    schema_compatibility_review_id: contentId(
      candidateContract.schema_version,
      {
        schema_version: candidateContract.schema_version,
        ...expectedUnsignedCandidate,
      },
    ),
    ...expectedUnsignedCandidate,
  };

  assertExactKeys(result, candidateContract.exact_keys, 'Stage A result');
  assert.deepEqual(result, expectedCandidate);
  assert.equal(
    result.schema_compatibility_review_id,
    contentId(result.schema_version, {
      schema_version: result.schema_version,
      ...expectedUnsignedCandidate,
    }),
  );
  assert.deepEqual(
    result.phase5_resolution_reference,
    expectedCandidate.phase5_resolution_reference,
  );
  assert.deepEqual(
    result.phase5_completion_reference,
    expectedCandidate.phase5_completion_reference,
  );
  assert.deepEqual(
    result.work3_predecessor_reference,
    expectedCandidate.work3_predecessor_reference,
  );
  assertExactKeys(
    result.authority_binding,
    exactLinkedBindingKeys,
    'Stage A authority binding',
  );
  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(input),
    'Stage A result/caller input alias',
  );
  assert.equal(fixtureFingerprint(input), before);
  assertRecursivelyUnfrozen(input);

  const historicalOutput = completionEnvelope.record.incident_observation
    .output_observation.combined_output_exact;
  assert.equal(
    historicalOutput,
    expectedFreshPhase5CandidateId + '\n',
    'historical discarded output matches independently recomputed fresh ID',
  );
  const collectStringPaths = (
    value,
    currentPath = '',
    resultPaths = [],
    seen = new Set(),
  ) => {
    if (typeof value === 'string') {
      if (value === expectedFreshPhase5CandidateId) {
        resultPaths.push(currentPath);
      }
      assert.notEqual(value, expectedFreshPhase5CandidateId + '\n');
      return resultPaths;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) {
      return resultPaths;
    }
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      collectStringPaths(child, currentPath + '/' + key, resultPaths, seen);
    }
    return resultPaths;
  };
  assert.deepEqual(collectStringPaths(result), [
    '/phase5_resolution_reference/resolution_candidate_id',
  ]);
  assert.equal(
    Buffer.from(physicalBytes(stageAAuthorityBinding))
      .includes(Buffer.from(expectedFreshPhase5CandidateId, 'utf8')),
    false,
  );
  for (const key of candidateContract.withheld_work3_fields) {
    assert.equal(collectKeys(result).has(key), false, key);
  }
  for (const key of [
    'profile_id',
    'requirement_id',
    'governed_disclosure_note_id',
    'expression_id',
    'rule_id',
    'governed_disclosure_note_render_binding_id',
    'family_profile_package_id',
    'inventory_fingerprint',
    'approval_record',
  ]) assert.equal(collectKeys(result).has(key), false, key);

  const decodePointer = (token) => token
    .replace(/~1/gu, '/')
    .replace(/~0/gu, '~');
  const applyMutation = (target, mutation) => {
    const parts = mutation.json_pointer.slice(1).split('/').map(decodePointer);
    const key = parts.pop();
    let parent = target;
    for (const part of parts) parent = parent[part];
    if (mutation.operation === 'REORDER_EXISTING_OBJECT_KEYS') {
      const current = parent[key];
      const reordered = {};
      for (const orderedKey of mutation.value) {
        reordered[orderedKey] = current[orderedKey];
      }
      parent[key] = reordered;
      return;
    }
    parent[key] = structuredClone(mutation.value);
  };
  const probeContract = authority.implementation_contract
    .compound_precedence_probe_contract;
  assert.equal(probeContract.exact_case_count, 5);
  assert.equal(
    probeContract.cases.reduce(
      (count, probe) => count + probe.calls.length,
      0,
    ),
    11,
  );
  for (const probe of probeContract.cases) {
    await t.test(probe.label, () => {
      assert.equal(probe.calls.length, probe.exact_call_count);
      for (const call of probe.calls) {
        const drift = newInput();
        for (const mutation of call.mutations) {
          applyMutation(drift, mutation);
        }
        expectCode(call.expected_error_code, () => (
          profileAuthoring
            .prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview(
              drift,
            )
        ));
      }
    });
  }
});

test("Work3 Termination Stage B builds the 45-profile unapproved blueprint proposal without Work3 identity or core integration", () => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationWork3StageBBlueprintProposal,
    'function',
    'Work3 Stage B 45-profile blueprint proposal facade export is missing.',
  );

  const stageAAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_SCHEMA_PACKAGE_ANALYSIS_PROJECTION_SUCCESSOR_AUTHORITY/V1',
    record_id_field: 'work3_governed_disclosure_note_schema_package_analysis_projection_successor_authority_id',
    record_id: '054de9dc959cbb12062099efea3620e9582578fc64c90c6d21b878e009adf28a',
    byte_length: 44726,
    sha256: '850c9170b0367e83a9030c54f8e896be30cfac14a7b9ba8b15a49cab3270b45b',
  });
  const completionBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-execution-completion-incident-lineage-superseding-evidence-receipt.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_EXECUTION_COMPLETION_INCIDENT_LINEAGE_SUPERSEDING_EVIDENCE_RECEIPT/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_execution_completion_incident_lineage_superseding_evidence_receipt_id',
    record_id: '1e9c53620dbeac0e3f582ebfca91000111611ede9054193ed174173a78f12e49',
    byte_length: 8867,
    sha256: '905b824dd9a76aab8ca2164d08e647ee798143473ef49dbf40d9e6a768dbfe52',
  });
  const work3Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
    record_id_field: 'correction_authority_id',
    record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
    byte_length: 237749,
    sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  });
  const captureBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-ruling-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_RULING_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_ruling_authority_id',
    record_id: '98ee4f4779c5ac12e4c0b87a856c3383c1a40e10d014441b2f7f01094e9888fa',
    byte_length: 7933,
    sha256: '66dacd7e6151e261e2eeb422443e340787be6699ec8a7a5e15673376c1034b98',
  });
  const rulingBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_TERMINATION_B9E_JURISDICTION_LIST_DISCLOSURE_NOTE_RULING/V1',
    record_id_field: 'lawyer_ruling_id',
    record_id: '5612a68b5416a51e26e604c525b8d93ec7285a51f6eba2edca6d251043aa7567',
    byte_length: 1639,
    sha256: 'f0e1155fe4f07f2f710666815afacea109f6978a6c9d04d581016301fe6efa5a',
  });
  const phase5Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_authority_id',
    record_id: '10bcf58ff7c7a95794fcc1cb2788ce7b768c49865a5f8b2271f1a2d6e2b1f126',
    byte_length: 22512,
    sha256: '11022734a686d0f6efeee52b957e2d6e125f2b2167e7136a14e3d3d69dd786e8',
  });
  const phase4Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase4_family_profile_package_review_authority_id',
    record_id: '3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e',
    byte_length: 115221,
    sha256: '2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18',
  });
  const input = {
    terminationWork3SchemaSuccessorEvidence: {
      work3EntryCorrectionAuthority: sourceEnvelope(work3Binding),
      phase5ExecutionCompletionReceipt: sourceEnvelope(completionBinding),
      work3GovernedDisclosureNoteSchemaSuccessorAuthority:
        sourceEnvelope(stageAAuthorityBinding),
    },
    terminationPhase5ResolutionInput: {
      terminationPhase5ResolutionEvidence: {
        governedDisclosureNoteRulingAuthority: sourceEnvelope(captureBinding),
        governedDisclosureNoteRuling: sourceEnvelope(rulingBinding),
        familyProfilePackageResolutionAuthority: sourceEnvelope(phase5Binding),
      },
      terminationFamilyProfilePackageReviewInput: {
        terminationPhase4FamilyProfilePackageReviewAuthority:
          sourceEnvelope(phase4Binding),
        terminationReferenceValueMaterialisationInput:
          terminationPhase3ReferenceValueMaterialisationFixture(),
      },
    },
  };
  const before = fixtureFingerprint(input);
  assertRecursivelyUnfrozen(input);

  const stageA = profileAuthoring
    .prepareTerminationGovernedDisclosureNoteWork3SchemaCompatibilityReview(
      structuredClone(input),
    );
  const phase5 = profileAuthoring.prepareTerminationFamilyProfilePackageResolution(
    structuredClone(input.terminationPhase5ResolutionInput),
  );
  const result = profileAuthoring.prepareTerminationWork3StageBBlueprintProposal(
    input,
  );

  assertExactKeys(result, [
    'schema_version',
    'blueprint_proposal_id',
    'candidate_state',
    'profile_approval_state',
    'proposed_profile_count',
    'complete_profile_count',
    'incomplete_profile_count',
    'stage_a_reference',
    'proposed_profiles',
    'review_accounting',
    'retained_source_gaps',
    'withheld_work3_fields',
    'next_governance_stop',
    'zero_effect_boundary',
  ], 'Stage B result');
  assert.equal(
    result.schema_version,
    'M7_V2_TERMINATION_WORK3_STAGE_B_45_PROFILE_BLUEPRINT_PROPOSAL/V1',
  );
  assert.equal(
    result.candidate_state,
    'UNAPPROVED_45_PROFILE_BLUEPRINT_PROPOSAL_NO_WORK3_IDENTITY_OR_CORE_INTEGRATION',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.proposed_profile_count, 45);
  assert.equal(result.complete_profile_count, 44);
  assert.equal(result.incomplete_profile_count, 1);
  assert.equal(result.proposed_profiles.length, 45);
  assert.deepEqual(result.proposed_profiles, phase5.proposed_profiles);
  assert.deepEqual(result.retained_source_gaps, phase5.retained_source_gaps);
  assert.equal(
    result.stage_a_reference.schema_compatibility_review_id,
    stageA.schema_compatibility_review_id,
  );
  assert.equal(
    result.next_governance_stop.legal_blueprint_state,
    'CONSTRUCTED_UNAPPROVED',
  );
  assert.deepEqual(result.next_governance_stop.required_successor_sequence, [
    'WORK3_GOVERNED_DISCLOSURE_NOTE_CORE_INTEGRATION_AUTHORITY_AND_TDD',
    'WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  ]);

  const b9e = result.proposed_profiles.find((profile) => (
    profile.proposed_profile_key ===
      'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712'
  ));
  assert.equal(Boolean(b9e), true);
  assert.equal(b9e.governed_disclosure_notes.length, 1);
  assert.equal(
    b9e.governed_disclosure_notes[0].display_text,
    'contained in non-public disclosure letter',
  );
  assert.equal(
    b9e.governed_disclosure_notes[0].disposition_kind,
    'NON_PUBLIC_DISCLOSURE_LOCATION',
  );

  for (const key of [
    'profile_id',
    'requirement_id',
    'expression_id',
    'rule_id',
    'family_profile_package_id',
    'inventory_fingerprint',
    'approval_record',
    'registration_id',
    'activation_id',
  ]) assert.equal(collectKeys(result).has(key), false, key);

  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(input),
    'Stage B result/caller input alias',
  );
  assert.equal(fixtureFingerprint(input), before);
  assertRecursivelyUnfrozen(input);
});

test("Work3 Termination governed disclosure note core integration proves validator acceptance without Work3 identity or inventory", () => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview,
    'function',
    'Work3 governed disclosure note core integration review facade export is missing.',
  );

  const coreAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-core-integration-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_CORE_INTEGRATION_AUTHORITY/V1',
    record_id_field: 'work3_governed_disclosure_note_core_integration_authority_id',
    record_id: '61b45adaefc622d608293046f15190f9dafdfd12a1d6403305a7469935279d7d',
    byte_length: 23266,
    sha256: '448dc37e73aa8b045512000d6beebd3353fa555e54ad363c90628337025e4a7b',
  });
  const stageAAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_SCHEMA_PACKAGE_ANALYSIS_PROJECTION_SUCCESSOR_AUTHORITY/V1',
    record_id_field: 'work3_governed_disclosure_note_schema_package_analysis_projection_successor_authority_id',
    record_id: '054de9dc959cbb12062099efea3620e9582578fc64c90c6d21b878e009adf28a',
    byte_length: 44726,
    sha256: '850c9170b0367e83a9030c54f8e896be30cfac14a7b9ba8b15a49cab3270b45b',
  });
  const completionBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-execution-completion-incident-lineage-superseding-evidence-receipt.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_EXECUTION_COMPLETION_INCIDENT_LINEAGE_SUPERSEDING_EVIDENCE_RECEIPT/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_execution_completion_incident_lineage_superseding_evidence_receipt_id',
    record_id: '1e9c53620dbeac0e3f582ebfca91000111611ede9054193ed174173a78f12e49',
    byte_length: 8867,
    sha256: '905b824dd9a76aab8ca2164d08e647ee798143473ef49dbf40d9e6a768dbfe52',
  });
  const work3Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
    record_id_field: 'correction_authority_id',
    record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
    byte_length: 237749,
    sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  });
  const captureBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-ruling-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_RULING_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_ruling_authority_id',
    record_id: '98ee4f4779c5ac12e4c0b87a856c3383c1a40e10d014441b2f7f01094e9888fa',
    byte_length: 7933,
    sha256: '66dacd7e6151e261e2eeb422443e340787be6699ec8a7a5e15673376c1034b98',
  });
  const rulingBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_TERMINATION_B9E_JURISDICTION_LIST_DISCLOSURE_NOTE_RULING/V1',
    record_id_field: 'lawyer_ruling_id',
    record_id: '5612a68b5416a51e26e604c525b8d93ec7285a51f6eba2edca6d251043aa7567',
    byte_length: 1639,
    sha256: 'f0e1155fe4f07f2f710666815afacea109f6978a6c9d04d581016301fe6efa5a',
  });
  const phase5Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_authority_id',
    record_id: '10bcf58ff7c7a95794fcc1cb2788ce7b768c49865a5f8b2271f1a2d6e2b1f126',
    byte_length: 22512,
    sha256: '11022734a686d0f6efeee52b957e2d6e125f2b2167e7136a14e3d3d69dd786e8',
  });
  const phase4Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase4_family_profile_package_review_authority_id',
    record_id: '3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e',
    byte_length: 115221,
    sha256: '2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18',
  });

  const input = {
    terminationWork3CoreIntegrationEvidence: {
      work3EntryCorrectionAuthority: sourceEnvelope(work3Binding),
      phase5ExecutionCompletionReceipt: sourceEnvelope(completionBinding),
      work3GovernedDisclosureNoteSchemaSuccessorAuthority:
        sourceEnvelope(stageAAuthorityBinding),
      work3GovernedDisclosureNoteCoreIntegrationAuthority:
        sourceEnvelope(coreAuthorityBinding),
    },
    terminationPhase5ResolutionInput: {
      terminationPhase5ResolutionEvidence: {
        governedDisclosureNoteRulingAuthority: sourceEnvelope(captureBinding),
        governedDisclosureNoteRuling: sourceEnvelope(rulingBinding),
        familyProfilePackageResolutionAuthority: sourceEnvelope(phase5Binding),
      },
      terminationFamilyProfilePackageReviewInput: {
        terminationPhase4FamilyProfilePackageReviewAuthority:
          sourceEnvelope(phase4Binding),
        terminationReferenceValueMaterialisationInput:
          terminationPhase3ReferenceValueMaterialisationFixture(),
      },
    },
  };
  const before = fixtureFingerprint(input);
  assertRecursivelyUnfrozen(input);

  const result = profileAuthoring
    .prepareTerminationGovernedDisclosureNoteWork3CoreIntegrationReview(input);

  assertExactKeys(result, [
    'schema_version',
    'core_integration_review_id',
    'candidate_state',
    'authority_binding',
    'stage_a_reference',
    'stage_b_reference',
    'phase5_resolution_reference',
    'phase5_completion_reference',
    'work3_predecessor_reference',
    'restamped_requirement',
    'restamped_governed_disclosure_note',
    'validator_acceptance_reference',
    'semantic_exclusion_contract',
    'review_accounting',
    'withheld_work3_fields',
    'next_governance_stop',
    'zero_effect_boundary',
  ], 'Core integration result');
  assert.equal(
    result.schema_version,
    'M7_V2_TERMINATION_WORK3_GOVERNED_DISCLOSURE_NOTE_CORE_INTEGRATION_REVIEW_CANDIDATE/V1',
  );
  assert.equal(
    result.candidate_state,
    'CORE_INTEGRATION_FIXTURE_ONLY_INVENTORY_REVIEW_NOT_PERFORMED',
  );
  assert.equal(result.review_accounting.runtime_validator_acceptance_count, 1);
  assert.equal(result.review_accounting.core_integration_count, 1);
  assert.equal(result.next_governance_stop.core_integration_state, 'PERFORMED');
  assert.deepEqual(result.next_governance_stop.required_successor_sequence, [
    'WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  ]);
  assert.equal(
    result.validator_acceptance_reference.core_integration_evidence_status,
    'PASS',
  );
  assert.equal(
    result.restamped_governed_disclosure_note.display_text,
    'contained in non-public disclosure letter',
  );
  assert.equal(
    result.restamped_governed_disclosure_note.schema_version,
    'STAGE_2Y_M7_V2_GOVERNED_DISCLOSURE_NOTE/V1',
  );
  assert.equal(
    result.restamped_requirement.field_key,
    'JURISDICTION_LIST_REFERENCE',
  );
  assert.equal(
    result.restamped_governed_disclosure_note.requirement_id,
    result.restamped_requirement.requirement_id,
  );

  for (const key of [
    'profile_id',
    'inventory_fingerprint',
    'activation_id',
    'registration_id',
    'family_profile_package_id',
    'expression_id',
    'rule_id',
  ]) assert.equal(collectKeys(result).has(key), false, key);

  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(input),
    'Core integration result/caller input alias',
  );
  assert.equal(fixtureFingerprint(input), before);
  assertRecursivelyUnfrozen(input);
});

test("Work3 Termination unapproved inventory review proves validator acceptance without Work3 identity or package approval", () => {
  assert.equal(
    typeof profileAuthoring.prepareTerminationWork3UnapprovedInventoryReview,
    'function',
    'Work3 termination unapproved inventory review facade export is missing.',
  );

  const inventoryAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-termination-unapproved-inventory-review-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    record_id_field: 'work3_termination_unapproved_inventory_review_authority_id',
    record_id: 'a6bb07bf18ab3ebfb7188cd6b9f5786f16c56045963793a33ad439aa55d709fa',
    byte_length: 10837,
    sha256: '1fc2826ff9e7b5dd9617cf6d735b6a025c3f4294f0811199cf7c7e1e4a60e07c',
  });
  const coreAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-core-integration-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_CORE_INTEGRATION_AUTHORITY/V1',
    record_id_field: 'work3_governed_disclosure_note_core_integration_authority_id',
    record_id: '61b45adaefc622d608293046f15190f9dafdfd12a1d6403305a7469935279d7d',
    byte_length: 23266,
    sha256: '448dc37e73aa8b045512000d6beebd3353fa555e54ad363c90628337025e4a7b',
  });
  const stageAAuthorityBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_SCHEMA_PACKAGE_ANALYSIS_PROJECTION_SUCCESSOR_AUTHORITY/V1',
    record_id_field: 'work3_governed_disclosure_note_schema_package_analysis_projection_successor_authority_id',
    record_id: '054de9dc959cbb12062099efea3620e9582578fc64c90c6d21b878e009adf28a',
    byte_length: 44726,
    sha256: '850c9170b0367e83a9030c54f8e896be30cfac14a7b9ba8b15a49cab3270b45b',
  });
  const completionBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-execution-completion-incident-lineage-superseding-evidence-receipt.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_EXECUTION_COMPLETION_INCIDENT_LINEAGE_SUPERSEDING_EVIDENCE_RECEIPT/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_execution_completion_incident_lineage_superseding_evidence_receipt_id',
    record_id: '1e9c53620dbeac0e3f582ebfca91000111611ede9054193ed174173a78f12e49',
    byte_length: 8867,
    sha256: '905b824dd9a76aab8ca2164d08e647ee798143473ef49dbf40d9e6a768dbfe52',
  });
  const work3Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
    record_id_field: 'correction_authority_id',
    record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
    byte_length: 237749,
    sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  });
  const captureBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-ruling-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_RULING_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_ruling_authority_id',
    record_id: '98ee4f4779c5ac12e4c0b87a856c3383c1a40e10d014441b2f7f01094e9888fa',
    byte_length: 7933,
    sha256: '66dacd7e6151e261e2eeb422443e340787be6699ec8a7a5e15673376c1034b98',
  });
  const rulingBinding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_TERMINATION_B9E_JURISDICTION_LIST_DISCLOSURE_NOTE_RULING/V1',
    record_id_field: 'lawyer_ruling_id',
    record_id: '5612a68b5416a51e26e604c525b8d93ec7285a51f6eba2edca6d251043aa7567',
    byte_length: 1639,
    sha256: 'f0e1155fe4f07f2f710666815afacea109f6978a6c9d04d581016301fe6efa5a',
  });
  const phase5Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase5_governed_disclosure_note_authority_id',
    record_id: '10bcf58ff7c7a95794fcc1cb2788ce7b768c49865a5f8b2271f1a2d6e2b1f126',
    byte_length: 22512,
    sha256: '11022734a686d0f6efeee52b957e2d6e125f2b2167e7136a14e3d3d69dd786e8',
  });
  const phase4Binding = Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
    record_id_field: 'termination_authoring_phase4_family_profile_package_review_authority_id',
    record_id: '3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e',
    byte_length: 115221,
    sha256: '2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18',
  });

  const input = {
    terminationWork3UnapprovedInventoryReviewEvidence: {
      work3EntryCorrectionAuthority: sourceEnvelope(work3Binding),
      phase5ExecutionCompletionReceipt: sourceEnvelope(completionBinding),
      work3GovernedDisclosureNoteSchemaSuccessorAuthority:
        sourceEnvelope(stageAAuthorityBinding),
      work3GovernedDisclosureNoteCoreIntegrationAuthority:
        sourceEnvelope(coreAuthorityBinding),
      work3TerminationUnapprovedInventoryReviewAuthority:
        sourceEnvelope(inventoryAuthorityBinding),
    },
    terminationPhase5ResolutionInput: {
      terminationPhase5ResolutionEvidence: {
        governedDisclosureNoteRulingAuthority: sourceEnvelope(captureBinding),
        governedDisclosureNoteRuling: sourceEnvelope(rulingBinding),
        familyProfilePackageResolutionAuthority: sourceEnvelope(phase5Binding),
      },
      terminationFamilyProfilePackageReviewInput: {
        terminationPhase4FamilyProfilePackageReviewAuthority:
          sourceEnvelope(phase4Binding),
        terminationReferenceValueMaterialisationInput:
          terminationPhase3ReferenceValueMaterialisationFixture(),
      },
    },
  };
  const before = fixtureFingerprint(input);
  assertRecursivelyUnfrozen(input);

  const result = profileAuthoring.prepareTerminationWork3UnapprovedInventoryReview(input);

  assertExactKeys(result, [
    'schema_version',
    'inventory_review_id',
    'candidate_state',
    'authority_binding',
    'core_integration_reference',
    'stage_b_reference',
    'inventory_packet_reference',
    'validator_acceptance_reference',
    'semantic_exclusion_contract',
    'review_accounting',
    'withheld_work3_fields',
    'next_governance_stop',
    'zero_effect_boundary',
  ], 'Inventory review result');
  assert.equal(
    result.schema_version,
    'M7_V2_TERMINATION_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
  );
  assert.equal(
    result.candidate_state,
    'UNAPPROVED_45_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.review_accounting.runtime_validator_acceptance_count, 1);
  assert.equal(result.review_accounting.core_integration_count, 1);
  assert.equal(result.review_accounting.profile_proposal_count, 45);
  assert.equal(result.next_governance_stop.core_integration_state, 'PERFORMED');
  assert.equal(result.next_governance_stop.ben_approval_state, 'NOT_RECORDED');
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(
    result.validator_acceptance_reference.inventory_review_evidence_status,
    'PASS',
  );
  assert.equal(result.inventory_packet_reference.profile_count, 45);
  assert.equal(result.inventory_packet_reference.complete_profile_count, 44);
  assert.equal(result.inventory_packet_reference.incomplete_profile_count, 1);
  assert.equal(result.inventory_packet_reference.profile_approval_state, 'UNAPPROVED');

  for (const key of [
    'profile_id',
    'inventory_fingerprint',
    'activation_id',
    'registration_id',
    'family_profile_package_id',
    'ben_approval_id',
    'expression_id',
    'rule_id',
  ]) assert.equal(collectKeys(result).has(key), false, key);

  assert.equal(isDeepFrozen(result), true);
  assertDisjoint(
    collectObjectIdentities(result),
    collectObjectIdentities(input),
    'Inventory review result/caller input alias',
  );
  assert.equal(fixtureFingerprint(input), before);
  assertRecursivelyUnfrozen(input);
});
