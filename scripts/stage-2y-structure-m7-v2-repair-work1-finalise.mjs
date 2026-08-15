#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const WORK0_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work1-7-authority.json`;
const ACTIVATION_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json`;
const FIXED_SAMPLE_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-fixed-sample-identity-manifest.json`;
const BASELINE_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-baseline-ledger.json`;
const RULING_MAP_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-calibration-question-ruling-map.json`;
const REVIEW_PACKET_PATH = `${MIGRATION_ROOT}/shadow/m7-comparison-entry-correction/lawyer-review-packet.json`;
const CONTRACT_POLICY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-policy.json`;
const FAMILY_PACKET_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-family-packet-set.json`;
const RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json`;
const CORRECTION_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work1-correction-authority.json`;
const RECOVERY_RUNNER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs';
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs';
const EXECUTION_MANIFEST_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const ACTIVATION_COMMIT = '6162798202bda37169917400b8fbebad8e1bdb9a';
const BRANCH = 'codex/recover-m7-20260812';
const WORK0_ID = '885d404502276d85af385fce20cd93b601f09a30a3300c371df870337f7d5fab';
const AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';
const ACTIVATION_ID = '7821c19a5aaae6f974599cefc8460fb88b8f2302fcefbdde4c0efbadbdea0d7a';

const CONTRACT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_POLICY/V1';
const FAMILY_PACKET_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1';
const CORRECTION_AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_CORRECTION_AUTHORITY/V1';
const CORRECTION_APPROVAL_ID = 'BEN-STAGE-2Y-M7-V2-WORK1-RECOVERY-2026-08-15';
const CORRECTION_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state', 'approved_on',
  'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
  'parent_authority_binding', 'activation_receipt_binding', 'stale_output_bindings',
  'executable_bindings', 'authorised_scope', 'exact_path_extension',
  'effective_work1_paths', 'command_extension', 'allowed_effects', 'prohibited_effects',
  'rollback', 'success_conditions',
]);
const STANDARD_BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  'git_blob_oid',
]);
const RECOVERY_TARGETS = Object.freeze([CONTRACT_POLICY_PATH, FAMILY_PACKET_PATH, RECEIPT_PATH]);
const CORRECTION_PATH_EXTENSION = Object.freeze([CORRECTION_AUTHORITY_PATH, RECOVERY_RUNNER_PATH]);
const CORRECTION_AUTHORISED_SCOPE = Object.freeze([
  'PRESERVE_PARENT_AUTHORITY_AND_ACTIVATION_BYTES',
  'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK1_GENERATED_OUTPUTS',
  'RUN_WORK1_FINALISER_EXACTLY_ONCE_MORE',
  'RUN_WORK1_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
  'COMMIT_AND_PUSH_THE_EFFECTIVE_FIFTEEN_PATH_WORK1_DELTA_ONLY',
]);
const CORRECTION_ALLOWED_EFFECTS = Object.freeze({
  deterministic_local_reads: true,
  system_temp_backup_directories: 1,
  work1_generated_output_replacements: 3,
  local_subprocess_runs: 5,
  repository_commits: 0,
  repository_pushes: 0,
});
const CORRECTION_PROHIBITED_EFFECTS = Object.freeze({
  non_target_repository_writes: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  serving_changes: 0,
  publication_changes: 0,
});
const CORRECTION_ROLLBACK = Object.freeze({
  backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
  backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
  restore_on_finaliser_or_validator_failure: true,
  remove_only_new_outputs_before_restore: true,
  retain_backup_on_restore_failure: true,
  second_attempt: 'REJECT_BEFORE_MUTATION',
  protected_paths_never_removed: [WORK0_PATH, AUTHORITY_PATH, ACTIVATION_PATH],
});
const CORRECTION_SUCCESS_CONDITIONS = Object.freeze([
  'THREE_OUTPUTS_REGENERATED',
  'VALIDATOR_PASS',
  'RECEIPT_BINDS_CURRENT_FIFTEEN_PATH_SET',
  'PRIOR_RECEIPT_LINEAGE_BOUND',
  'BACKUP_REMOVED',
  'ZERO_EXTERNAL_EFFECTS',
]);
const CORRECTION_COMMAND_EXTENSION = Object.freeze({
  recovery_argv: ['node', RECOVERY_RUNNER_PATH, '--authority', CORRECTION_AUTHORITY_PATH],
  recovery_run_limit: 1,
  additional_work1_finaliser_runs: 1,
  work1_finaliser_cumulative_run_count: 2,
  work1_validator_cumulative_run_count: 2,
  parent_work1_validator_limit: 3,
  additional_git_add_commit_push_runs: 0,
});
const RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT = Object.freeze({
  work1_finaliser_cumulative_run_count: 2,
  work1_validator_cumulative_run_count: 2,
  recovery_run_count: 1,
});
const RECOVERY_PRECONDITION_KEYS = Object.freeze([
  'correction_authority_binding', 'superseded_receipt_binding', 'recovery_argv',
  'recovery_run_count', 'finaliser_cumulative_run_count',
  'validator_cumulative_run_count', 'replaced_output_paths', 'backup_state', 'rollback_state',
]);
const WORK1_CORRECTION_RECOVERY_CONTRACT = Object.freeze({
  authority_path: CORRECTION_AUTHORITY_PATH,
  authority_schema_version: CORRECTION_AUTHORITY_SCHEMA,
  authority_record_id_field: 'correction_authority_id',
  authority_exact_members: CORRECTION_AUTHORITY_KEYS,
  approval: {
    approved_on: '2026-08-15',
    approver: 'BEN_GOODCHILD',
    ben_approval_id: CORRECTION_APPROVAL_ID,
    approval_text: 'Authorise Work1 recovery',
  },
  runner_path: RECOVERY_RUNNER_PATH,
  authority_presence: 'OPTIONAL_UNLESS_RECOVERY_IS_USED',
  normal_mode: 'EXACT_PARENT_THIRTEEN_PATH_BEHAVIOUR',
  recovery_path_rule: 'PARENT_EXACT_THIRTEEN_PLUS_AUTHORITY_AND_RUNNER',
  exact_path_extension: CORRECTION_PATH_EXTENSION,
  authorised_scope: CORRECTION_AUTHORISED_SCOPE,
  command_extension: CORRECTION_COMMAND_EXTENSION,
  allowed_effects: CORRECTION_ALLOWED_EFFECTS,
  prohibited_effects: CORRECTION_PROHIBITED_EFFECTS,
  rollback: CORRECTION_ROLLBACK,
  success_conditions: CORRECTION_SUCCESS_CONDITIONS,
  receipt_schema_and_top_level_members: 'UNCHANGED_V1',
  receipt_recovery_member: 'repository_precondition.recovery',
  receipt_recovery_exact_members: RECOVERY_PRECONDITION_KEYS,
  artifact_binding_rule: 'EFFECTIVE_WORK1_PATHS_EXCLUDING_RECEIPT',
  command_count_constants: 'PENDING_ROOT_FINAL_RECEIPT_AUDIT',
});
const STALE_OUTPUT_BINDINGS = Object.freeze([
  {
    path: CONTRACT_POLICY_PATH,
    schema_version: CONTRACT_SCHEMA,
    record_id_field: 'contract_policy_id',
    record_id: '7190007634a40b59e578eb8e1c25cc5d605d2472b8ccc0aeac519dabc57b7dda',
    byte_length: 50362,
    sha256: '797aa66a73376be0f8ccac4602b6dc68f789c972ec764d708435fb5ca785814e',
    git_blob_oid: 'e441f0d43361a956ae766da135bc85aac020d33a',
  },
  {
    path: FAMILY_PACKET_PATH,
    schema_version: FAMILY_PACKET_SCHEMA,
    record_id_field: 'family_packet_set_id',
    record_id: '30808afe05e4ab1b9f84fbf537804229c5d9b2ecc888d317a2075bf00712aec2',
    byte_length: 136079,
    sha256: '1bb5f78417360d558ec4ce917b670e6494eed9525321380fc71f7d4095080e39',
    git_blob_oid: '7e195d257bec5044867073b6905a69f7b708dc36',
  },
  {
    path: RECEIPT_PATH,
    schema_version: RECEIPT_SCHEMA,
    record_id_field: 'work1_contract_receipt_id',
    record_id: '852213a4535910c5cb9bfe68dc06387e7fc1ba98787db3c8468ff61437b7c46c',
    byte_length: 46687,
    sha256: 'd5500d0c7b444968618558c23766fba11bf0509f3081160b024d3be035a05488',
    git_blob_oid: '5ede81234ed4c65778f005dd0a42e2fd571fe3c5',
  },
]);
const LINKED_POINT_ORDINALS = Object.freeze([6, 27, 28, 32, 33, 34, 35, 36]);
const CHECK_IDS = Object.freeze([
  'WORK0_AND_ACTIVATION_BINDINGS', 'CONTRACT_POLICY', 'FAMILY_PACKET_COVERAGE',
  'PUBLIC_INTERFACE_BOUNDARY', 'V1_REJECTION_CONTRACT', 'CANDIDATE_REGISTRATION_CONTRACT',
  'LITERAL_ACCEPTANCE_FIXTURES', 'ZERO_EXTERNAL_PRODUCT_AND_SEMANTIC_EFFECTS',
]);
const REPAIR_INVARIANTS = Object.freeze({
  MATERIAL_MEANING_OMITTED_OR_HIDDEN: 'NO_NAMED_EFFECT_PARTY_CONDITION_EXCEPTION_TIMING_STANDARD_THRESHOLD_OR_QUALIFIER_MAY_BE_OMITTED_HIDDEN_IN_DISPLAY_TEXT_OR_RELABELLED_SOURCE_LIMITED',
  CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE: 'CORRECT_FAMILY_AND_MOST_SPECIFIC_SUPPORTED_SUBTYPE_WITH_LAWYER_READABLE_TYPED_FIELDS_FOR_EACH_IDENTIFIED_LEGAL_EFFECT',
  FALSE_PARSER_AMBIGUITY: 'NESTED_LIST_LABEL_RESTART_ALONE_IS_NOT_AMBIGUITY_PRESERVE_AUTHORED_NESTING',
  SOURCE_ARTEFACT: 'EXCLUDE_ONLY_THE_IDENTIFIED_ARTEFACT_SPAN_PRESERVE_ADJACENT_LEGAL_TEXT',
  APPROVED_NO_COMPARISON: 'COMPLETE_NO_COMPARISON_ONLY_FOR_THIS_GOVERNED_MECHANICS_OCCURRENCE_NO_ROW_AND_NO_FAMILY_WIDE_SUPPRESSION',
  CLEAN_CONTROL: 'PRESERVE_ACCEPTED_LEGAL_MEANING_CLASSIFICATION_FIELDS_DISPOSITION_AND_RENDERING_WITH_NO_REGRESSION',
});
const EXPECTED_FAMILY_PACKET_AUTHORITY = Object.freeze({
  schema_version: FAMILY_PACKET_SCHEMA,
  stage: 'M7_V2_REPAIR_WORK1',
  state: 'LEGAL_EVIDENCE_ORACLE_NOT_EXECUTABLE_PROFILE_AUTHORITY',
  exact_top_level_keys: [
    'schema_version', 'family_packet_set_id', 'family_packet_set_digest', 'stage', 'state',
    'work0_evidence_root_binding', 'fixed_sample_identity_binding',
    'repair_baseline_binding', 'calibration_ruling_map_binding',
    'lawyer_review_packet_binding', 'coverage', 'constraints', 'families',
    'structure_ambiguity_members',
  ],
  self_identity:
    'DIGEST_SHA256_OF_CANONICAL_RECORD_WITHOUT_DIGEST_OR_ID_THEN_CONTENT_ID_OVER_RECORD_WITH_DIGEST',
  lawyer_review_packet_native_identity: {
    schema_version: 'STAGE_2Y_LAWYER_REVIEW_PACKET/V1',
    record_id_field: 'lawyer_review_packet_id',
    content_id_payload_excluded_fields: ['schema_version', 'lawyer_review_packet_id'],
  },
  immutable_source_bindings: [
    { role: 'WORK0_EVIDENCE_ROOT', path: WORK0_PATH, authority: 'REGISTERED_CANDIDATE_EXACT_BINDING' },
    { role: 'FIXED_SAMPLE', path: FIXED_SAMPLE_PATH, authority: 'WORK0_RECORD_AND_SNAPSHOT_EXACT_BINDING' },
    { role: 'REPAIR_BASELINE', path: BASELINE_PATH, authority: 'WORK0_RECORD_AND_SNAPSHOT_EXACT_BINDING' },
    { role: 'CALIBRATION_RULING_MAP', path: RULING_MAP_PATH, authority: 'WORK0_RECORD_AND_SNAPSHOT_EXACT_BINDING' },
    { role: 'LAWYER_REVIEW_PACKET', path: REVIEW_PACKET_PATH, authority: 'WORK0_EVIDENCE_INPUT_EXACT_BINDING' },
  ],
  coverage:
    'EXACT_REVIEW_PACKET_COVERAGE_PLUS_WORK0_REPAIR_CONTROL_AND_LINKED_POINT_COUNTS',
  constraints: {
    exact_family_count: 25,
    exact_sample_count: 50,
    exact_structure_ambiguity_count: 1,
    contains_executable_matcher: false,
    can_assert_completeness: false,
    v1_role_relabelling_forbidden: true,
    every_sample_has_broad_and_family_subtype_question: true,
    substantive_notes_preserved_verbatim: true,
    focused_expectations_are_closed_and_testable: true,
  },
  family_contract: {
    order: 'EXACT_BOUND_CALIBRATION_RULING_MAP_ORDER',
    wave_and_calibration_binding: 'EXACT_BOUND_RULING_MAP_MEMBER',
    programme_question_mappings:
      'EXACT_ORDERED_FIVE_FIELD_PROJECTION_OF_ALL_BOUND_RULING_MAP_MAPPINGS',
    legal_oracle_state: 'WORK1_EVIDENCE_ONLY_NOT_COMPLETENESS_AUTHORITY',
    executable_matcher_present: false,
    profile_set_binding_state: 'PENDING_WORK3_BEN_APPROVAL',
  },
  sample_contract: {
    identity_and_source: 'EXACT_BOUND_FIXED_SAMPLE_MEMBER',
    repair_decision_and_note: 'EXACT_BOUND_REPAIR_BASELINE_ENTRY',
    family: 'EXACT_BOUND_FIXED_SAMPLE_AND_REVIEW_PACKET_FAMILY',
    ordinals: 'EXACTLY_1_THROUGH_50_ONCE_IN_BOUND_FAMILY_ORDER',
    linked_point_ordinals: LINKED_POINT_ORDINALS,
    focused_expectation_invariants: REPAIR_INVARIANTS,
    structure_ambiguity: 'EXACT_ITEM_39_NULL_FAMILY_POST_OVERLAY_MEMBER',
  },
});
const TEMPORAL_SHARED_SOURCE_CONTRACT = Object.freeze({
  analysis_member: 'shared_fact_coverages',
  analysis_count_member: 'shared_fact_coverages',
  focused_source_authority_continuity: {
    sample_ordinals: [28, 42, 44],
    exact_fixed_member_fields: [
      'agreement_id', 'agreement_index_binding', 'canonical_source_binding',
      'source_node_occurrence_ids', 'source_spans', 'source_excerpt_sha256',
    ],
    exact_resolved_agreement_index_canonical_source_and_excerpt_bytes_required: true,
    validation_order: 'BEFORE_FACT_EXPRESSION_AND_EFFECT_MATCHING',
    failure_code: 'M7_V2_INPUT_CONSUMPTION',
  },
  shared_fact_coverage: {
    schema_version: 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1',
    exact_members: [
      'schema_version', 'shared_fact_coverage_id', 'input_occurrence_id',
      'source_closure_id', 'span_id', 'fact_ids', 'lawyer_decision_id', 'reason_code',
    ],
    content_id_payload_members: [
      'input_occurrence_id', 'source_closure_id', 'span_id', 'fact_ids',
      'lawyer_decision_id', 'reason_code',
    ],
    exact_fact_count: 2,
    exact_reason_code: 'SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE',
    exact_source_bytes: 'six (6) years',
    fact_support: 'BOTH_FACTS_HAVE_THE_SAME_SINGLETON_MATERIAL_LEXICAL_SPAN',
    boundary_whitespace:
      'SEPARATE_NON_MATERIAL_STRUCTURAL_TEXT_OUTSIDE_CANDIDATE_EFFECT_AND_EFFECT_LEDGER',
    coverage_treatment: 'SHARED_FACT',
    coverage_owner: 'SHARED_FACT_COVERAGE_ID',
  },
  duration_contract: {
    value_members: ['bound_type', 'count', 'unit'],
    bound_types: ['EXACT', 'WITHIN', 'AT_LEAST'],
    units: ['DAY', 'WEEK', 'MONTH', 'YEAR'],
    whole_source_legal_number_grammar:
      'OPTIONAL_NOT_LESS_THAN_WITHIN_OR_EXACTLY_PLUS_WORD_WITH_CONCORDANT_PARENTHETICAL_DIGIT_OR_DIGIT_PLUS_UNIT',
    word_number_concordance_required: true,
    deictic_period_is_reference_not_direct_duration: true,
  },
  item28_contract: {
    lawyer_decision_id: 'b7993d5b54e20fb4a66ef27ec9d4906f49a050fba416cba70362972c200d9fff',
    agreement_id: 'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c',
    source_node_occurrence_id: '717b78ef0bd7b4f18a66f142e1213676c2ebc557e5d91811d348fe0ac9e47dc2',
    rights_source: 'not less than six (6) years',
    rights_value: { bound_type: 'AT_LEAST', count: 6, unit: 'YEAR' },
    no_adverse_source: 'six (6) years',
    no_adverse_value: { bound_type: 'EXACT', count: 6, unit: 'YEAR' },
    source_spans_distinct: true,
    shared_fact_coverage_forbidden: true,
    exact_rule_subtypes: ['RIGHTS_SURVIVAL', 'NO_ADVERSE_AMENDMENT'],
    linked_rule_relationship: {
      link_kind: 'SAME_GOVERNED_INPUT_OCCURRENCE_AND_DISPOSITION',
      same_occurrence_authored_unit_and_source_closure: true,
      distinct_effects: true,
      exact_disposition_rule_set: true,
      distinct_semantic_fact_owners: true,
      cross_effect_fact_reuse_forbidden: true,
    },
  },
  item42_contract: {
    lawyer_decision_id: 'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
    agreement_id: 'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71',
    source_node_occurrence_id: '005e1651ed5ba5f031509229658f4e9682d95f1b59ce894bfb4f319388ad9ad4',
    family_key: 'DNO_INDEMNIFICATION',
    legal_result: 'ADDITIVE_THREE',
    exact_rule_subtypes: [
      'RIGHTS_SURVIVAL', 'NO_ADVERSE_AMENDMENT', 'CLAIM_CONTINUATION',
    ],
    shared_fields: ['NO_ADVERSE_AMENDMENT_DURATION', 'RIGHTS_SURVIVAL_DURATION'],
    shared_legal_effect_roles: [
      'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD', 'RIGHTS_SURVIVAL_PERIOD',
    ],
    shared_temporal_scope_signature: 'FROM_EFFECTIVE_TIME_FOR_SIX_YEARS',
    shared_lawyer_decision_profiles: [
      'RIGHTS_SURVIVAL', 'NO_ADVERSE_AMENDMENT',
    ],
    shared_lawyer_decision_profile_keys: [
      'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
      'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
    ],
    shared_lawyer_decision_authority_scope:
      'EXACT_TWO_SELECTED_ITEM42_PROFILE_IDS_ONLY_FOR_THE_BOUND_OCCURRENCE',
    all_other_profiles_exclude_shared_lawyer_decision: true,
    claim_expression:
      'IF_THEN(CLAIM_MADE_PURSUANT_TO_RIGHTS,ALL_OF(CLAIM_CONTINUES_SUBJECT_TO_SECTION,CLAIM_CONTINUES_WITH_RIGHTS,UNTIL_CLAIM_DISPOSITION))',
    claim_required_fields: [
      'APPLIES_TO', 'LEGAL_EFFECT', 'CLAIM_MADE_PURSUANT_TO_RIGHTS',
      'CLAIM_CONTINUES_SUBJECT_TO_SECTION', 'CLAIM_CONTINUES_WITH_RIGHTS',
      'UNTIL_CLAIM_DISPOSITION',
    ],
    current_work1_state: ['INCOMPLETE', 'SUFFICIENT', 'REVIEW_ONLY'],
    current_work1_issue: 'WORK3_BEN_PROFILE_APPROVAL_PENDING',
    current_work1_normal_rows: 0,
    current_work1_assertion_id: 'item-42-work1-has-zero-normal-rows',
  },
  duration_reference_contract: {
    lexical_source: 'such six-year period',
    dependency_type: 'DURATION_CONDITION_REFERENCE',
    context_edge_type: 'DURATION_REFERENCE_TARGET',
    resolved_target: 'RIGHTS_SURVIVAL_DURATION_SEMANTIC_FACT_KEY',
    delegated_dimension_key: 'CLAIM_CONTINUATION_PERIOD_REFERENCE',
    owner_field_key: 'RIGHTS_SURVIVAL_DURATION',
    lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    one_dependency_one_context_edge_one_ownership_link: true,
    consumer_may_use_delegated_duration_only_through_exact_ownership_link: true,
    direct_duration_or_period_owner_representation_forbidden: true,
    cloned_owner_value_or_reused_owner_support_forbidden: true,
  },
  shared_ledger_contract: {
    exact_uses: 2,
    exact_distinct_effects: 2,
    exact_treatment_kind: 'RULE',
    exact_targets: 'THE_TWO_SHARED_FACT_OWNER_RULE_IDS',
    one_use_three_uses_non_rule_or_same_rule_reuse_forbidden: true,
  },
  projection_contract: {
    render_binding_member: 'ownership_link_id',
    local_fact_value: null,
    delegated_fact_value: 'EXACT_OWNERSHIP_LINK_ID',
    current_work1_item42_and_item44_rows: 0,
    linked_render_and_grouping_acceptance: 'DEFERRED_UNTIL_LAWFUL_WORK3_NORMAL_BASELINE',
  },
  item44_contract: {
    lawyer_decision_id: '0b0efa85bac341e0ee3e29075563620365c9022c2dd8cf08de4e9f73ae7454a4',
    agreement_id: 'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71',
    source_node_occurrence_id: 'd011f79aae3c051670469038a679a5c72c80eb96af29cfe4f5d607c1d614aa19',
    source: 'normal business hours',
    field_key: 'BUSINESS_HOURS_TIMING',
    value_type: 'ENUM',
    typed_value: 'NORMAL_BUSINESS_HOURS',
    normaliser: 'ENUM_LITERAL_MAP/V1',
    current_work1_state: ['INCOMPLETE', 'SUFFICIENT', 'REVIEW_ONLY'],
    current_work1_issue: 'WIDER_MATERIAL_SCOPE_UNMODELLED',
    current_work1_normal_rows: 0,
    current_work1_assertion_id: 'item-44-work1-has-zero-normal-rows',
  },
  activation_seam: {
    executable_matching_owner: 'SEPARATE_BEN_APPROVED_FAMILY_PROFILE_SET',
    packet_set_can_assert_completeness: false,
    packet_set_contains_executable_matchers: false,
    family_packet_may_not_substitute_for_family_profile_set: true,
    candidate_registration_roles: ['FAMILY_PROFILE_SET', 'SUBTYPE_TREES'],
    packet_substitution_error: 'M7_V2_INPUT_CONSUMPTION',
    future_work3_schema_id_path:
      'MUST_BE_FROZEN_BY_THE_WORK3_NARROWING_MANIFEST_BEFORE_NORMAL_OUTPUT',
  },
  error_routes: {
    shared_fact_record_or_coverage: 'M7_V2_SOURCE_COVERAGE',
    duration_atomicity: 'M7_V2_FACT_ATOMICITY',
    shared_fact_ledger_reuse: 'M7_V2_EFFECT_LEDGER',
    duration_dependency_context_or_ownership_link: 'M7_V2_FACT_OWNERSHIP',
    missing_coherent_third_effect: 'M7_V2_EFFECT_LEDGER',
    absorbed_third_effect: 'M7_V2_EFFECT_PROVENANCE',
    incomplete_claim_expression_or_profile_authority: 'M7_V2_PROFILE_GATE',
    premature_work1_normal_output: 'M7_V2_STATE_COMBINATION',
    item44_wrong_value_or_normaliser: 'M7_V2_FACT_ATOMICITY',
    family_packet_profile_substitution: 'M7_V2_INPUT_CONSUMPTION',
  },
});
const WORK1_COMMAND_LEDGER = Object.freeze([
  { argv: ['node', '--check', 'lib/canonical-v2/m7-v2-contract.js'], run_count: 12, state: 'COMPLETED_BEFORE_RECEIPT' },
  { argv: ['node', '--check', 'scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs'], run_count: 18, state: 'COMPLETED_BEFORE_RECEIPT' },
  { argv: ['node', '--check', 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs'], run_count: 17, state: 'COMPLETED_BEFORE_RECEIPT' },
  { argv: ['node', '--check', 'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs'], run_count: 15, state: 'COMPLETED_BEFORE_RECEIPT' },
  { argv: ['node', '--check', 'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs'], run_count: 12, state: 'COMPLETED_BEFORE_RECEIPT' },
  { argv: ['node', '--check', 'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs'], run_count: 12, state: 'COMPLETED_BEFORE_RECEIPT' },
  {
    argv: [
      'node', '--test',
      'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
      'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
      'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
    ],
    run_count: 12,
    state: 'COMPLETED_BEFORE_RECEIPT',
  },
  { argv: ['node', 'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs'], run_count: 1, state: 'WRITES_THIS_RECEIPT' },
  { argv: ['node', 'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs'], run_count: 1, state: 'REQUIRED_AFTER_RECEIPT' },
]);
const DRAFTING_COMMAND_AUDIT = Object.freeze({
  scope: 'NON_MUTATING_DRAFTING_COMMANDS_BEFORE_FINAL_GATE',
  individual_test_runs: 0,
  disclosed_read_only_deviations: [
    { owner: 'CALLER_SEAM_DESIGN', command: 'git diff --check -- <three caller-owned Work1 paths>', run_count: 1 },
    { owner: 'CALLER_SEAM_DESIGN', command: 'node - <read-only candidate fixture inspection>', run_count: 1, result: 'FAILED_BEFORE_PARSE_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'node -e <read authority work1_exact_changed_paths>', run_count: 1, result: 'PRINTED_13_PATHS_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'git status --short -- <three typed-owned Work1 paths>', run_count: 1 },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <stable item39 overlay module audit>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <item39 overlay second stable audit>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <item39 overlay third stable audit>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'sed <item39 overlay fourth stable audit>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <item39 root policy alignment audit>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <transitional contract fixture and test advisory gap map>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg <item39 root policy correction verification>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'wc/sed/jq/rg/sort <stable acceptance registry coverage audit>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'wc/rg/sed/jq <stable acceptance registry coverage re-audit>', run_count: 15, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'jq <stable registry Work0 family mapping re-check>', run_count: 3, result: 'ONE_READ_ERROR_THEN_PASS_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'wc/rg/sed/jq <stable contract test honesty and coverage audit>', run_count: 11, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq <registration test independent-verifier positive implementation and audit>', run_count: 12, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg <overlay global-validation error-gate verification>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <projection mutation helper and exact option-seam implementation>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'git diff --check', run_count: 1 },
    { owner: 'MINIMAL_INTERFACE', command: 'git status --short', run_count: 2 },
    { owner: 'MINIMAL_INTERFACE', command: 'python3 - <read-only finaliser and validator policy equality extraction>', run_count: 1 },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <stable item39 overlay and policy audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <item39 overlay second stable audit>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg <item39 overlay and policy third stable audit>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/jq/sed/tail/wc <transitional contract fixture and test advisory gap map>', run_count: 8, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'wc/rg/head/sed <stable contract test honesty and coverage audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/head/sed <excluded-dimension contract inspection>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/sed/rg/head <fact and source case-specific mutation helper implementation and audit>', run_count: 9, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq <stable 118-case acceptance registry count and uniqueness verification>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq <exact Work0 item44 family and baseline verification>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/rg/head <stable acceptance registry coverage repair and verification>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq <stable registry exact Work0 family audit>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq <stable registry fixture-kind programme-metadata and uniqueness verification>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'ROOT_ORCHESTRATOR', command: 'sed/rg/jq/dd <read-only Work1 plan evidence and contract inspection>', run_count: 22, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'git status --short -- <three typed-owned Work1 paths>', run_count: 1 },
    { owner: 'TYPED_RULE_DESIGN', command: 'git diff --check -- <three typed-owned Work1 paths>', run_count: 1 },
    { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <canonical fixture identity recomputation>', run_count: 1 },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq/dd <post-compaction item39 builder, contract-test identity and negative-fixture audit>', run_count: 44, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <finaliser-validator drafting-command audit equality check>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <whole-clause ENUM positive-baseline and mutation repair inspection>', run_count: 11, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq <focused-state literal and direct-invalid local-positive repair inspection>', run_count: 11, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq <full family-packet finaliser-validator-fixture and immutable-binding inspection>', run_count: 13, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <final temporal subprofile and same-source whole-clause repair inspection>', run_count: 12, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <item39 compound-effect contradiction and repair inspection>', run_count: 7, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/head <item39 compound-effect implementation and static policy audit>', run_count: 13, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <stable item39 consumption fixture and test audit>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'jq/rg/sed <frozen 134-case contract registry test module and family-packet boundary audit>', run_count: 30, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg/jq/diff/awk <exact family-packet authority implementation and static policy audit>', run_count: 21, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq/diff/awk <stable full-packet contract registry module and public-seam re-audit>', run_count: 21, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <family-packet BINDING_DRIFT error-route static audit>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <final temporal subprofile whole-clause and binding-route re-audit>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'jq <recursive frozen authority Work1 path argv branch commit and preflight extraction>', run_count: 2, result: 'FIRST_TOP_LEVEL_QUERY_INSUFFICIENT_SECOND_RECURSIVE_QUERY_PASS_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'ENUMERATED_LIMB_BUILD_AND_REVIEW', run_count: 27, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'ITEM39_SEAM_DESIGN', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'ITEM39_COMPOUND_EFFECT_POLICY_AUDIT', run_count: 26, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'NON_ITEM39_AND_FULL_CONTRACT_AUDIT', run_count: 55, result: 'ONE_READ_PATH_ERROR_THEN_FINDINGS_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'REPAIRED_FOUR_ROUTE_REAUDIT', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'FAMILY_PACKET_REGISTRY_AND_FINAL_FROZEN_AUDIT', run_count: 41, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'FAMILY_PACKET_BINDING_DRIFT_REAUDIT', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'FINAL_TEMPORAL_SUBPROFILE_WHOLE_CLAUSE_REAUDIT', run_count: 11, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'read-only extraction <final drafting-command audit equality confirmation>', run_count: 1, result: 'PASS_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <drafting-command audit location and prepatch extraction>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'read-only extraction <closed final drafting-command audit equality confirmation>', run_count: 1, result: 'PASS_ZERO_EFFECT' },
    { owner: 'ROOT_ORCHESTRATOR', command: 'git <authorised Work1 preflight status diff-check and activation-diff reads>', run_count: 3, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/python <native lawyer review packet identity diagnosis and fix inspection>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <registration predecessor and public-seam cross-audit>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <registration descriptor and public-seam diagnosis and fix inspection>', run_count: 13, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <native lawyer identity and policy audit>', run_count: 20, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'POST_TEST_PREDECESSOR_DESCRIPTOR_AND_LAWYER_PACKET_IDENTITY_DIAGNOSIS', run_count: 22, result: 'ONE_STALE_TEST_PATH_LOOKUP_ERROR_THEN_EXACT_CAUSE_AND_NATIVE_ID_DOMAIN_DIAGNOSED_READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'PREDECESSOR_AND_NATIVE_LAWYER_ID_CROSS_AUDIT', run_count: 9, result: 'PREDECESSOR_PASS_MODULE_PASS_ONE_COMPACT_POLICY_GAP_FOUND_READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'FINAL_NATIVE_ID_POLICY_EQUALITY_AND_PREDECESSOR_REAUDIT', run_count: 5, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'read-only extraction <post-rerun drafting-command audit equality and governed-count confirmation>', run_count: 1, result: 'PARTIAL_EQUALITY_PASS_THEN_COMBINED_ARGV_EXTRACTION_PARSE_ERROR_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'read-only extraction <closed post-rerun ledger and drafting-audit equality confirmation>', run_count: 1, result: 'PASS_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'diagnosing-skill/read <remaining registration enriched-descriptor audit and repair>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'read-only shell <registration bindingForRecord and wrong-subtype fixture exhaustive audit>', run_count: 8, result: 'PASS_WITH_FIXTURE_CAUSE_FOUND_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'read-only shell <wrong-subtype profile fixture diagnosis repair and four-kind static audit>', run_count: 13, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg -n -C <third-run Work1 ledger drafting-audit and combined-result prepatch context>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'read-only extraction <closed third-run ledger and drafting-audit equality confirmation>', run_count: 1, result: 'PASS_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq <run-3 twelve-failure contract-test triage>', run_count: 42, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'terminal-read <run-3 no-output terminal-read attempt>', run_count: 1, result: 'NO_OUTPUT_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq <temporal shared-span design and initial module-policy implementation>', run_count: 31, result: 'READ_ONLY_ZERO_EFFECT_ONE_DISPLAY_TRUNCATION_COMMAND_SUCCEEDED' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq <temporal shared-span completion and stable module-policy audit>', run_count: 30, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'diff -u <process-substituted temporal finaliser-validator policy slices>', run_count: 3, result: 'NO_OUTPUT_EQUAL_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq/diff <temporal shared-source closure read-only static inspection>', run_count: 39, result: '38_COMPLETED_READ_ONLY_INCLUDING_2_NO_OUTPUT_2_BOUNDED_TRUNCATED_SUCCESS_1_FAILED_STALE_PLAN_PATH_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq/diff <typed cross-seam and focused-source authority continuity audit>', run_count: 46, result: '46_SUCCESSFUL_READ_ONLY_INCLUDING_2_NO_OUTPUT_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq/dd <exact focused-source 4/5/3 partition design>', run_count: 25, result: '24_SUCCESSFUL_READ_ONLY_1_FAILED_JQ_PATH_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/diff <APPLIES_TO PARTY projection seam implementation and static audit>', run_count: 4, result: 'READ_ONLY_ZERO_EFFECT_ONE_NO_OUTPUT_EQUALITY' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'diff <APPLIES_TO exact ordered actor authority policy equality>', run_count: 1, result: 'NO_OUTPUT_EQUAL_ZERO_EFFECT' },
    { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq <final frozen exact-source Claim WITHIN PARTY actor-order cross-seam audit>', run_count: 45, result: '43_SUCCESSFUL_READ_ONLY_2_FAILED_SED_NO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq <run-3 twelve-failure contract-test diagnosis and repair inspection>', run_count: 28, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq/comm <item28 item42 item44 temporal registry fixture route source-fidelity and final parity audit>', run_count: 48, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq/dd <exact Work0 focused-source temporal Claim-removal and actor-order fixture inspection>', run_count: 68, result: 'ONE_JQ_ANCESTOR_QUERY_FAILED_REMAINDER_READ_ONLY_ZERO_EFFECT_OUTPUT_TRUNCATION_SUBSET_NOT_EXACTLY_PRESERVED' },
    { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <Item28 scalar PARTY projection acceptance assertion inspection>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <Work5 Work6 execution-manifest create-once fixture audit>', run_count: 11, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/rg/sed <run-3 non-temporal contract and execution-manifest audit>', run_count: 23, result: 'ONE_FAILED_GLOB_READ_REMAINDER_READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <effect-provenance-before-profile pipeline re-audit>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/rg/sed <item42 temporal deictic shared-span seam assessment>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/rg/sed <immutable item28 item42 item44 temporal authority audit>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/rg/sed <Work3 activation-gate authority audit>', run_count: 12, result: 'ONE_MALFORMED_JQ_READ_REMAINDER_READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'jq/rg/sed <temporal negative-oracle matrix audit>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/jq/diff <frozen module-policy temporal audit>', run_count: 29, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/jq/head <whole frozen registry-test exact-source route and parity audit>', run_count: 80, result: 'READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <post-temporal drafting-command boundary ledger and semantic-field preparatory extraction>', run_count: 1, result: 'PARTIAL_CONTEXT_PASS_THEN_VALIDATOR_COMBINED_FIELD_LOOKUP_VALUEERROR_READ_ONLY_ZERO_EFFECT' },
    { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <post-temporal drafting-command ledger equality governed-count and total extraction>', run_count: 1, result: 'FAILED_DRAFTING_OBJECT_FIELD_LOOKUP_VALUEERROR_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <robust balanced-block post-temporal drafting ledger equality governed-count and total extraction>', run_count: 1, result: 'FAILED_ENTRY_REGEX_COUNT_ASSERTION_97_EXPECTED_105_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <nested-balanced-object drafting ledger equality governed-count and total extraction>', run_count: 1, result: 'FAILED_OLDER_AUDIT_RECORD_RESULT_KEY_ASSUMPTION_KEYERROR_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <owner-run-count-only nested drafting ledger equality governed-count and total extraction>', run_count: 1, result: 'FAILED_SEMANTIC_COUNTER_SOURCE_ORDER_ASSERTION_FINALISER_4_0_VALIDATOR_0_4_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <semantic-counter-multiset drafting ledger equality governed-count and total extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'ROOT_ORCHESTRATOR', command: 'sed <diagnosing-bugs skill read for run4 ReferenceError>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <run4 item42ClaimContinuation ReferenceError lexical-scope diagnosis>', run_count: 4, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <run4 item42ClaimContinuation ReferenceError lexical-scope diagnosis>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <run4 scope-fix and timing-mapping static audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <run4 item42ClaimContinuation ReferenceError diagnosis and regression-seam audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <run4 scope-fix and claim timing mapping re-audit>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run5 exact receipt context extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run5 owner-run-count drafting ledger equality governed-count extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg/python <run5 global d44 and Claim profile display-order diagnosis>', run_count: 4, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'rg <mixed-authority dimension-evidence builder registry and route inspection>', run_count: 3, result: 'ONE_STALE_REGISTRY_PATH_PARTIAL_SUCCESS_REMAINDER_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <run5 global d44 and Claim profile display-order diagnosis>', run_count: 9, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <run5 d44 Claim delegation builder patch static audit>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <mixed-authority dimension-evidence module-policy implementation and static audit>', run_count: 7, result: '6_SUCCESS_1_FAILED_INVALID_SED_ARGUMENT_ORDER_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed/jq <mixed-authority builder registry route cross-audit>', run_count: 9, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg/terminal-read <run5 global profile catalogue and Claim delegation diagnosis>', run_count: 6, result: 'ONE_TERMINAL_READ_NO_DATA_TERMINATED_REMAINDER_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <run5 d44 Claim delegation builder patch audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/diff <mixed-authority module-policy partition audit>', run_count: 3, result: 'READ_ONLY_WITH_TWO_TEMP_FILES_CREATED_ZERO_WORKSPACE_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'unlink <self-created temporary policy comparison files>', run_count: 1, result: 'TEMP_FILES_REMOVED_ZERO_PERSISTENT_EFFECT_REJECTED_RM_NOT_EXECUTED' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <mixed-authority builder registry five-route audit>', run_count: 4, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <mixed-authority registry count-lock re-audit>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run6 owner-run-count drafting ledger equality governed-count extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <receipt-safe run-7 drafting-audit reconciliation>', run_count: 2, result: 'ONE_READ_COMPLETED_ONE_OUTPUT_TRUNCATED_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN6_PROCESS_SESSION_TRACE_RECOVERY', run_count: 9, result: '8_SUCCESSFUL_READ_ONLY_INCLUDING_2_BOUNDED_TRUNCATED_1_FAILED_ABSENT_PATH_RG_RUN6_COMBINED_EXIT_STATUS_UNRECOVERABLE_ZERO_EFFECT' },
  { owner: 'ROOT_ORCHESTRATOR', command: 'terminal-read <run-6 combined-command output-recovery attempt>', run_count: 1, result: 'NO_SESSION_NO_OUTPUT_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'codex_app terminal-read <run-6 combined-command process-session trace recovery>', run_count: 1, result: 'NO_OUTPUT_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run7 receipt and combined-result prepatch inspection>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run7 owner-run-count drafting ledger equality governed-count extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'ROOT', command: 'sed/rg <run7 failure diagnosis skill context and profile-fixture inspection>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN6_OUTCOME_TRACE_CONTINUATION', run_count: 19, result: '18_SUCCESSFUL_READ_ONLY_INCLUDING_1_SUCCESS_NO_OUTPUT_AND_4_BOUNDED_TRUNCATED;1_NO_MATCH_RG_NO_OUTPUT_ZERO_EFFECT;ZERO_EFFECTS' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN7_EQUIVALENCE_PROFILE_ROOT_DIAGNOSIS', run_count: 22, result: '21_SUCCESSFUL_READ_ONLY;1_PARTIAL_STALE_PATH_RG_EXIT_WITH_VALID_MATCH_OUTPUT;ZERO_EFFECTS' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN7_LINKED_SIGNATURE_SEAM_AUDIT', run_count: 1, result: 'SUCCESSFUL_READ_ONLY;ZERO_EFFECTS' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN7_FOCUSED_CHILD_NEGATIVE_SELECTION_AUDIT', run_count: 6, result: '6_SUCCESSFUL_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN7_FROZEN_MATCHER_LINKED_SIGNATURE_PATCH_AUDIT', run_count: 11, result: '11_SUCCESSFUL_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/jq <run-7 combined TAP count and PASS-evidence audit>', run_count: 12, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg/jq <run-7 common DNO near-negative fixture diagnosis>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <run-7 delegated ownership equivalence-signature diagnosis>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/jq <delegated-dimension and production LINKED_FACT closure audit>', run_count: 5, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <frozen run-7 fixture-selection LINKED_FACT and restamp cross-audit>', run_count: 9, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg/jq <stable structural-root matcher and positive-only LINKED_FACT assertion re-audit>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg/python <run7 near-negative approved-expectation diagnosis>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT_ONE_OUTPUT_TRUNCATED' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed <run7 subtype-negative expected-selection fixture repair context>', run_count: 2, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg/python <run7 grouping-relevant equivalence and focused-negative fallback diagnosis and repair inspection>', run_count: 15, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/python <frozen profile candidate consumer identity and registry-route parity self-audit>', run_count: 6, result: 'FOUR_SUCCESSFUL_READ_ONLY_ONE_SHALLOW_ACTIVE_SET_UNDERCOUNT_CORRECTED_ONE_BROAD_RETRY_KEYERROR_THEN_TARGETED_198_152_62_PASS_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed <brainstorming skill for structural-root fixture correction>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <Item23 structural-root fixture audit and positive-only linked-signature assertion guard>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run8 exact audit-tail ledger and semantic-counter context extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run8 owner-run-count drafting ledger equality governed-count extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'CALLER_SEAM_DESIGN_RUN8_FROZEN_RECEIPT_LEDGER_AUDIT', run_count: 6, result: '6_SUCCESSFUL_READ_ONLY_INCLUDING_1_BOUNDED_TRUNCATED_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/head/sed/awk/cmp/jq <run-8 drafting-ledger, argv, semantic-counter, protected-path and receipt-scope audit>', run_count: 32, result: 'PASS_READ_ONLY_ZERO_EFFECT_ONE_OUTPUT_TRUNCATED' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run8 final observer-audit drafting ledger equality and total extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'ROOT', command: 'sed <codebase-design skill>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <diagnosing skill and Item42 dependency/profile/effect-local trace>', run_count: 18, result: 'READ_ONLY_ZERO_EFFECT_ONE_SUCCESSFUL_OUTPUT_TRUNCATED' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <effect-local dependency helper and compact-policy implementation static audit>', run_count: 7, result: 'SIX_SUCCESSFUL_READ_ONLY_ONE_STALE_POLICY_PATH_LOOKUP_FAILURE_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg/nl <frozen run8 ownership duration Item39 count and classification-floor cross-audit>', run_count: 26, result: 'READ_ONLY_ZERO_EFFECT_ONE_SUCCESSFUL_AGGREGATE_OUTPUT_TRUNCATED' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <run8 Item42 unapproved dependency common-root diagnosis>', run_count: 26, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <effect-local dependency module and compact-policy frozen audit>', run_count: 28, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <frozen run8 ownership duration Item39 count and classification-floor cross-audit>', run_count: 34, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <run8 Item42 unapproved dependency and fixture root-cause diagnosis>', run_count: 7, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <run8 ownership dependency duration Item39 count and classification-floor fixture repair and static audit>', run_count: 8, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run9 exact audit-tail ledger and semantic-counter context extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run9 current-state receipt reconciliation extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run9 owner-run-count drafting ledger equality governed-count extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg/nl <run9 Item42 direct-duration candidate-set first-gate and identity-restamp diagnosis>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT_ONE_NO_OUTPUT_TWO_SUCCESSFUL_AGGREGATE_OUTPUTS_TRUNCATED' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <run9 frozen deictic direct-duration and Claim modal-support restamp audit>', run_count: 22, result: 'READ_ONLY_ZERO_EFFECT_ONE_AGGREGATE_OUTPUT_TRUNCATED_ONE_READ_REPORTED_TWO_STALE_SCRIPT_PATH_ERRORS' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg <corrected deictic direct-duration normaliser literals>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/head/tail/sed <Item42 support-drift source selection, first-gate and restamp audit>', run_count: 23, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <frozen Item42 direct-parse and two support-drift fixture audit>', run_count: 17, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <run9 deictic direct-duration and reference-support failure diagnosis>', run_count: 12, result: 'READ_ONLY_ZERO_EFFECT_TWO_SUCCESSFUL_OUTPUTS_TRUNCATED' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <run9 deictic direct-duration and Claim support-drift fixture repair inspection>', run_count: 3, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'rg <run9 DURATION_PARSER direct-deictic correction verification>', run_count: 1, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run10 exact receipt context extraction>', run_count: 1, result: 'FAILED_PYTHON_QUOTE_SYNTAXERROR_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run10 corrected exact receipt context extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run10 final current-state receipt reconciliation extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'python3 - <run10 owner-run-count drafting ledger equality governed-count extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg/jq <run10 STATIC_BOUNDARY_INVALID exact failing-predicate diagnosis>', run_count: 18, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg/jq <Work1 finaliser write-once and authorised regeneration audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg/jq/sed <supplemental authority, correction authority, supersession and Work1 recovery design audit>', run_count: 21, result: 'READ_ONLY_ZERO_EFFECT_THREE_AGGREGATE_OUTPUTS_TRUNCATED_ONE_NO_MATCH_QUERY' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <receipt-only recovery authority V1 compatibility and 13-path cross-audit>', run_count: 6, result: 'READ_ONLY_ZERO_EFFECT_ONE_AGGREGATE_OUTPUT_TRUNCATED' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/jq/rg/test <standalone recovery runner implementation context and interrupted existence check>', run_count: 9, result: 'READ_ONLY_ZERO_EFFECT_RUNNER_ABSENT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <Work1 validator STATIC_BOUNDARY_INVALID predicate diagnosis>', run_count: 8, result: 'STATIC_BOUNDARY_INVALID_CAUSED_BY_FALSE_POSITIVE_FS_ALIAS_WRITE_PATTERN_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/git-status/diff <validator alias-regex patch and exact thirteen-path worktree audit>', run_count: 12, result: 'VALIDATOR_ALIAS_REGEX_PATCH_PASS_EXACT_THIRTEEN_PATH_SCOPE_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/jq <frozen authority command-limit receipt-binding and rerun-blocker audit>', run_count: 13, result: 'NO_AUTHORISED_SECOND_FINALISER_ROUTE_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <authority supplement exception supersession rollback and rerun-extension precedent search>', run_count: 3, result: 'NO_EXISTING_CONSUMED_RERUN_EXTENSION_SEAM_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed/git-status <current generated-output correction patterns and narrow recovery interface audit>', run_count: 6, result: 'STANDALONE_CORRECTION_AUTHORITY_AND_RECOVERY_RUNNER_REQUIRED_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <receipt-only V1-compatible recovery transaction and rollback design>', run_count: 8, result: 'RECEIPT_V1_COMPATIBLE_RECOVERY_INTERFACE_DESIGNED_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg/jq/git status/diff <Work1 finaliser and validator standalone correction-authority recovery implementation and static audit>', run_count: 56, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <frozen Work1 recovery acceptance test binding and receipt audit>', run_count: 10, result: 'TWO_MATERIAL_ASSERTION_GAPS_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <initial and restarted Work1 recovery runner audits>', run_count: 11, result: 'MATERIAL_SUBPROCESS_ROLLBACK_AND_STATUS_PARSER_DEFECTS_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/rg/sed+diff <correction local-subprocess cap parity patch audit>', run_count: 3, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <final frozen runner contract transaction and test cross-audit>', run_count: 7, result: 'ONE_MATERIAL_REPOSITORY_INVENTORY_ESCAPE_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'nl -ba <delegated runner transaction-safety audit>', run_count: 1, result: 'MATERIAL_TRANSACTION_DEFECTS_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <post-inventory runner re-audit>', run_count: 2, result: 'ONE_CONTENT_HASH_AND_CHILD_ENV_RESIDUAL_FOUND_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <SHA inventory and explicit child-environment runner re-audit>', run_count: 2, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <frozen SHA inventory Node-environment TMPDIR and rollback acceptance-test audit>', run_count: 3, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <run10 STATIC_BOUNDARY_INVALID false-positive diagnosis>', run_count: 10, result: 'READ_ONLY_ZERO_EFFECT_ONE_BOUNDED_OUTPUT_TRUNCATED' },
  { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed <validator fs-alias guard implementation and static audit>', run_count: 2, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'rg/sed/jq <Work1 correction authority and receipt regeneration blocker audit>', run_count: 7, result: 'READ_ONLY_ZERO_EFFECT_ONE_OUTPUT_TRUNCATED_ONE_NO_OUTPUT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <Work1 recovery authority route and acceptance-test design inspection>', run_count: 7, result: 'READ_ONLY_ZERO_EFFECT_ONE_OUTPUT_TRUNCATED' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg/tail/wc <Work1 recovery acceptance fixture implementation and static authority finaliser validator audit>', run_count: 27, result: 'ONE_STALE_CONTROL_PATH_LOOKUP_ERROR_ONE_OVERBROAD_RG_OUTPUT_TRUNCATED_THREE_ADDITIONAL_AGGREGATE_OUTPUTS_TRUNCATED_REMAINDER_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <initial frozen Work1 recovery runner audit>', run_count: 3, result: 'MATERIAL_EFFECT_ACCOUNTING_AND_ROLLBACK_DEFECTS_FOUND_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <recovery subprocess-count mixed-status and protected-file rollback test patch and stable runner inspection>', run_count: 7, result: 'READ_ONLY_ZERO_EFFECT_ONE_FAILED_APPLY_PATCH_CONTEXT_MATCH_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <final frozen Work1 recovery runner re-audit>', run_count: 9, result: 'PASS_READ_ONLY_ZERO_EFFECT_ONE_MISSING_AUTHORITY_PATH_LOOKUP_ONE_OUTPUT_TRUNCATED' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg <ignored-file TMPDIR Node-environment recovery-test implementation and audit>', run_count: 19, result: 'PASS_READ_ONLY_ZERO_EFFECT_ONE_OUTPUT_TRUNCATED_TWO_PATCH_WRAPPER_FAILURES_ZERO_FILE_EFFECT' },
  { owner: 'RECOVERY_RUNNER_IMPL', command: 'sed/rg/wc/git <recovery-runner blueprint and all static audits through child-environment allowlist and inventory SHA-256 confirmation>', run_count: 39, result: '38_SUCCESSFUL_READ_ONLY_ONE_FAILED_ABSENT_AGENTS_MD_THREE_BOUNDED_OUTPUT_TRUNCATIONS_FINAL_STABLE_RUNNER_PASS_ZERO_WORKSPACE_WRITES_ZERO_NODE_TEST_FINALISER_OR_VALIDATOR_EXECUTIONS' },
  { owner: 'CODEX_ROOT', command: 'rg/sed/jq/python/git-status/wc/du <Work1 recovery design implementation audit and drafting reconciliation>', run_count: 51, result: '48_SUCCESSFUL_READ_ONLY_THREE_FAILED_ZERO_EFFECT_ZERO_GOVERNED_OR_EXTERNAL_EFFECTS' },
  { owner: 'CODEX_ROOT', command: 'python3 - <final recovery drafting-ledger equality and canonical correction-authority extraction>', run_count: 1, result: 'FAILED_ORIGINAL_PATH_LIST_LOOKUP_ASSERTION_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <failed authority-extraction assertion context diagnosis>', run_count: 3, result: 'THREE_SUCCESSFUL_READ_ONLY_ONE_NO_OUTPUT_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <corrected final recovery drafting-ledger equality and canonical correction-authority extraction>', run_count: 1, result: 'FAILED_PROTECTED_WORK0_BINDING_LOOKUP_STOPITERATION_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <second failed authority-extraction assertion context diagnosis>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <final source-constant recovery authority extraction>', run_count: 1, result: 'FAILED_TEMPLATE_LITERAL_WORK0_PATH_LOOKUP_ASSERTION_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'rg <exact recovery runner Work0 protected-path constant>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <final literal-bound recovery authority extraction>', run_count: 1, result: 'FAILED_NULL_SOURCE_RECORD_ID_FIELD_HANDLING_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <final null-safe recovery authority extraction>', run_count: 1, result: 'FAILED_GENERATED_PYTHON_INDENTATIONERROR_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <direct null-safe recovery authority extraction>', run_count: 1, result: 'FAILED_STALE_EXTRACTION_BODY_AUDIT_TOTAL_ASSERTION_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <pinned-body null-safe recovery authority extraction>', run_count: 1, result: 'FAILED_SESSION_BODY_SELECTION_ASSERTION_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <explicit null-safe recovery authority extraction>', run_count: 1, result: 'FAILED_CONTENT_ID_FRAMING_CANDIDATE_ASSERTION_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'rg <canonical content-ID framing implementation>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <native-framing recovery authority extraction>', run_count: 1, result: 'FAILED_GENERATED_SOURCE_NULL_BYTE_VALUEERROR_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <escaped-native-framing recovery authority extraction>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT_CANDIDATE_REJECTED_BEFORE_WRITE_DUPLICATE_ACTIVATION_BINDING' },
  { owner: 'CODEX_ROOT', command: 'python3 - <parent authority and activation binding disambiguation>', run_count: 1, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <schema-bound canonical recovery authority extraction>', run_count: 1, result: 'ANTICIPATED_PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'sed/rg <assertRecoveryCode synchronous recovery assertion diagnosis>', run_count: 8, result: 'READ_ONLY_ZERO_EFFECT_ONE_AGGREGATE_OUTPUT_TRUNCATED' },
  { owner: 'CALLER_SEAM_DESIGN', command: 'rg/sed <landed synchronous-throw mixed-status and exact-ledger bounded audit>', run_count: 10, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'MINIMAL_INTERFACE', command: 'sed/rg <mixed-status and recovery-ledger captured-failure diagnosis>', run_count: 9, result: 'PASS_READ_ONLY_ZERO_EFFECT_ONE_NO_RESULT_CONTEXT_SEARCH' },
  { owner: 'MINIMAL_INTERFACE', command: 'rg/sed <landed recovery test correction audit>', run_count: 2, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'TYPED_RULE_DESIGN', command: 'sed/rg/nl <run11 failure scope recovery-test correction and authority-restamp audit>', run_count: 6, result: 'PASS_READ_ONLY_ZERO_EFFECT_ONE_OUTPUT_TRUNCATED' },
  { owner: 'CODEX_ROOT', command: 'sed/nl <diagnosing skill and captured recovery-test failure source inspection>', run_count: 3, result: 'PASS_READ_ONLY_ZERO_EFFECT' },
  { owner: 'CODEX_ROOT', command: 'python3 - <run12 drafting-ledger equality and correction-authority restamp extraction>', run_count: 1, result: 'ANTICIPATED_PASS_READ_ONLY_ZERO_EFFECT' },
  ],
  effects: 'ZERO_WRITES_ZERO_SEMANTIC_RUNS_ZERO_EXTERNAL_EFFECTS',
  disposition: 'RECORDED_NOT_REPEATED_NOT_AN_UNAUTHORISED_EFFECT',
});
const ID_FIELDS = Object.freeze([
  'authority_id', 'activation_receipt_id', 'evidence_root_id',
  'fixed_sample_identity_manifest_id', 'repair_baseline_ledger_id',
  'calibration_question_ruling_map_id', 'lawyer_review_packet_id',
  'contract_policy_id', 'family_packet_set_id', 'work1_contract_receipt_id',
  'correction_authority_id',
]);

export class Work1FinalisationError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work1FinalisationError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work1FinalisationError(code, detail);
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function resolvePath(repoRoot, repositoryPath, allowMissingLeaf = false) {
  if (typeof repositoryPath !== 'string' || !repositoryPath || path.isAbsolute(repositoryPath)) {
    fail('PATH_INVALID', repositoryPath);
  }
  const parts = repositoryPath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) fail('PATH_INVALID', repositoryPath);
  let current = repoRoot;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) fail('PATH_INVALID', repositoryPath);
      if (index < parts.length - 1 && !stat.isDirectory()) fail('PATH_INVALID', repositoryPath);
      if (index === parts.length - 1 && !stat.isFile()) fail('PATH_INVALID', repositoryPath);
    } catch (error) {
      if (error instanceof Work1FinalisationError) throw error;
      if (allowMissingLeaf && index === parts.length - 1 && error.code === 'ENOENT') return current;
      fail('PATH_INVALID', repositoryPath);
    }
  }
  return current;
}

function readBytes(repoRoot, repositoryPath) {
  return readFileSync(resolvePath(repoRoot, repositoryPath));
}

function readCanonical(repoRoot, repositoryPath) {
  const bytes = readBytes(repoRoot, repositoryPath);
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('INPUT_INVALID', repositoryPath);
  }
  if (!bytes.equals(canonicalBytes(record))) fail('INPUT_INVALID', `${repositoryPath}:canonical`);
  return { bytes, record };
}

function readOptionalCanonical(repoRoot, repositoryPath) {
  let absolute;
  try {
    absolute = resolvePath(repoRoot, repositoryPath, true);
  } catch {
    fail('RECOVERY_PATH_SCOPE', repositoryPath);
  }
  if (!existsSync(absolute)) return null;
  try {
    return readCanonical(repoRoot, repositoryPath);
  } catch (error) {
    if (error instanceof Work1FinalisationError && error.code === 'PATH_INVALID') {
      fail('RECOVERY_PATH_SCOPE', repositoryPath);
    }
    fail('RECOVERY_AUTHORITY_INVALID', repositoryPath);
  }
}

function identityField(record) {
  return ID_FIELDS.find((field) => Object.hasOwn(record, field)) ?? null;
}

function binding(repositoryPath, bytes, record = null) {
  const idField = record ? identityField(record) : null;
  return {
    path: repositoryPath,
    schema_version: record?.schema_version ?? null,
    record_id_field: idField,
    record_id: idField ? record[idField] : null,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function identify(unsigned, schemaVersion, digestField, idField) {
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { ...withDigest, [idField]: contentId(schemaVersion, withDigest) };
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && same(Object.keys(value).sort(), [...keys].sort());
}

function verifyContentIdentity(record, idField, digestField = null) {
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned[idField];
  if (digestField) {
    delete unsigned[digestField];
    const digest = sha256Hex(canonicalJson(unsigned));
    const withDigest = { ...unsigned, [digestField]: digest };
    if (record[digestField] !== digest || record[idField] !== contentId(record.schema_version, withDigest)) {
      fail('INPUT_IDENTITY_DRIFT', idField);
    }
  } else if (record[idField] !== contentId(record.schema_version, unsigned)) {
    fail('INPUT_IDENTITY_DRIFT', idField);
  }
}

function parentWork1Paths(inputs) {
  const paths = inputs.authority.record.command_policy.work1_exact_changed_paths;
  if (!Array.isArray(paths) || paths.length !== 13 || new Set(paths).size !== 13
    || !paths.includes(RECEIPT_PATH) || paths.includes(CORRECTION_AUTHORITY_PATH)
    || paths.includes(RECOVERY_RUNNER_PATH)) {
    fail('AUTHORITY_DRIFT', 'Work1 paths');
  }
  return paths;
}

function effectiveWork1Paths(inputs) {
  return inputs.correctionAuthority?.record.effective_work1_paths ?? parentWork1Paths(inputs);
}

function validateCorrectionAuthority(repoRoot, correctionAuthority, inputs) {
  if (!correctionAuthority) return;
  const record = correctionAuthority.record;
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned.correction_authority_id;
  const parentPaths = parentWork1Paths(inputs);
  const effectivePaths = [...parentPaths, ...CORRECTION_PATH_EXTENSION];
  let executableBindings;
  try {
    executableBindings = [
      FINALISER_PATH, VALIDATOR_PATH, RECOVERY_RUNNER_PATH, EXECUTION_MANIFEST_TEST_PATH,
    ].map((repositoryPath) => binding(repositoryPath, readBytes(repoRoot, repositoryPath)));
  } catch {
    fail('RECOVERY_PATH_SCOPE', 'executable bindings');
  }
  const expectedParentBinding = binding(AUTHORITY_PATH, inputs.authority.bytes, inputs.authority.record);
  const expectedActivationBinding = binding(
    ACTIVATION_PATH, inputs.activation.bytes, inputs.activation.record,
  );
  if (!exactKeys(record, CORRECTION_AUTHORITY_KEYS)
    || record.schema_version !== CORRECTION_AUTHORITY_SCHEMA
    || record.correction_authority_id !== contentId(CORRECTION_AUTHORITY_SCHEMA, unsigned)
    || record.stage !== 'M7_V2_REPAIR_WORK1_CORRECTION'
    || record.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK1_RECOVERY'
    || record.approved_on !== '2026-08-15'
    || record.approver !== 'BEN_GOODCHILD'
    || record.ben_approval_id !== CORRECTION_APPROVAL_ID
    || record.approval_text !== 'Authorise Work1 recovery'
    || record.discovered_defect
      !== 'WORK1_VALIDATOR_STATIC_BOUNDARY_FS_MEMBER_ACCESS_FALSE_POSITIVE_AFTER_FIRST_FINALISATION'
    || !same(record.authorised_scope, CORRECTION_AUTHORISED_SCOPE)
    || !same(record.command_extension, CORRECTION_COMMAND_EXTENSION)
    || !same(record.rollback, CORRECTION_ROLLBACK)
    || !same(record.success_conditions, CORRECTION_SUCCESS_CONDITIONS)) {
    fail('RECOVERY_AUTHORITY_INVALID');
  }
  if (!same(record.exact_path_extension, CORRECTION_PATH_EXTENSION)
    || !same(record.effective_work1_paths, effectivePaths)) {
    fail('RECOVERY_PATH_SCOPE');
  }
  if (!same(record.allowed_effects, CORRECTION_ALLOWED_EFFECTS)
    || !same(record.prohibited_effects, CORRECTION_PROHIBITED_EFFECTS)) {
    fail('RECOVERY_EFFECT_DRIFT');
  }
  if (!same(record.parent_authority_binding, expectedParentBinding)
    || !same(record.activation_receipt_binding, expectedActivationBinding)
    || !same(record.stale_output_bindings, STALE_OUTPUT_BINDINGS)
    || !same(record.executable_bindings, executableBindings)
    || [record.parent_authority_binding, record.activation_receipt_binding,
      ...record.stale_output_bindings, ...record.executable_bindings]
      .some((item) => !exactKeys(item, STANDARD_BINDING_KEYS))) {
    fail('RECOVERY_BINDING_DRIFT');
  }
}

function work1CommandLedger(inputs) {
  if (!inputs.correctionAuthority) return WORK1_COMMAND_LEDGER;
  return [
    ...WORK1_COMMAND_LEDGER.slice(0, 7),
    {
      argv: ['node', FINALISER_PATH],
      run_count: RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT.work1_finaliser_cumulative_run_count,
      state: 'CUMULATIVE_ONE_INITIAL_ONE_CORRECTION_WRITES_THIS_RECEIPT',
    },
    {
      argv: ['node', VALIDATOR_PATH],
      run_count: RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT.work1_validator_cumulative_run_count,
      state: 'CUMULATIVE_ONE_FAILED_ONE_REQUIRED_AFTER_THIS_RECEIPT',
    },
    {
      argv: inputs.correctionAuthority.record.command_extension.recovery_argv,
      run_count: RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT.recovery_run_count,
      state: 'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS',
    },
  ];
}

function exactCommitArgv(inputs, effectivePaths) {
  if (!inputs.correctionAuthority) return inputs.authority.record.command_policy.exact_work1_commit_argv;
  const parentArgv = inputs.authority.record.command_policy.exact_work1_commit_argv;
  if (!Array.isArray(parentArgv) || parentArgv.length !== 3
    || !same(parentArgv[0], ['git', 'add', '--', ...parentWork1Paths(inputs)])) {
    fail('RECOVERY_PATH_SCOPE', 'commit argv');
  }
  return [['git', 'add', '--', ...effectivePaths], parentArgv[1], parentArgv[2]];
}

function recoveryPrecondition(inputs) {
  if (!inputs.correctionAuthority) return null;
  return {
    correction_authority_binding: binding(
      CORRECTION_AUTHORITY_PATH,
      inputs.correctionAuthority.bytes,
      inputs.correctionAuthority.record,
    ),
    superseded_receipt_binding: STALE_OUTPUT_BINDINGS[2],
    recovery_argv: inputs.correctionAuthority.record.command_extension.recovery_argv,
    recovery_run_count: RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT.recovery_run_count,
    finaliser_cumulative_run_count:
      RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT.work1_finaliser_cumulative_run_count,
    validator_cumulative_run_count:
      RECOVERY_LEDGER_COUNTS_PENDING_FINAL_AUDIT.work1_validator_cumulative_run_count,
    replaced_output_paths: RECOVERY_TARGETS,
    backup_state: 'REMOVED_AFTER_VALIDATOR_PASS',
    rollback_state: 'AVAILABLE_DURING_TRANSACTION_ONLY',
  };
}

function assertRecoveryOutputsAbsent(repoRoot, inputs) {
  if (!inputs.correctionAuthority) return;
  for (const repositoryPath of RECOVERY_TARGETS) {
    let absolute;
    try {
      absolute = resolvePath(repoRoot, repositoryPath, true);
    } catch {
      fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
    }
    if (existsSync(absolute)) fail('RECOVERY_ALREADY_APPLIED', repositoryPath);
  }
}

function work0RecordBinding(work0, repositoryPath) {
  return work0.work0_record_bindings.find((entry) => entry.path === repositoryPath);
}

function assertWork0EvidenceBindings(inputs) {
  const generatedRecords = [
    [FIXED_SAMPLE_PATH, inputs.fixed],
    [BASELINE_PATH, inputs.baseline],
    [RULING_MAP_PATH, inputs.rulingMap],
  ];
  for (const [repositoryPath, input] of generatedRecords) {
    const expected = binding(repositoryPath, input.bytes, input.record);
    const recordBinding = work0RecordBinding(inputs.work0.record, repositoryPath);
    const snapshotBinding = inputs.work0.record.snapshot_bindings.find((entry) => entry.path === repositoryPath);
    if (!same(recordBinding, expected) || !same(snapshotBinding, expected)) {
      fail('WORK0_EVIDENCE_DRIFT', repositoryPath);
    }
  }
  const packetBinding = inputs.work0.record.evidence_input_bindings.find(
    (entry) => entry.path === REVIEW_PACKET_PATH,
  );
  if (!packetBinding || packetBinding.role !== 'LAWYER_REVIEW_PACKET'
    || packetBinding.binding_source !== 'ADOPTED_PLAN_COMMIT_BLOB'
    || packetBinding.purpose !== 'WORK0_FAILURE_EVIDENCE'
    || packetBinding.v2_admissible !== false
    || packetBinding.schema_version !== inputs.packet.record.schema_version
    || packetBinding.record_id_field !== 'lawyer_review_packet_id'
    || packetBinding.record_id !== inputs.packet.record.lawyer_review_packet_id
    || packetBinding.byte_length !== inputs.packet.bytes.length
    || packetBinding.sha256 !== sha256Hex(inputs.packet.bytes)) {
    fail('WORK0_EVIDENCE_DRIFT', REVIEW_PACKET_PATH);
  }
}

function buildContractPolicy(inputs) {
  const unsigned = {
    schema_version: CONTRACT_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK1',
    state: 'TECHNICAL_CONTRACT_ORACLE_NOT_LEGAL_PROFILE_APPROVAL',
    version: 1,
    work0_evidence_root_binding: binding(WORK0_PATH, inputs.work0.bytes, inputs.work0.record),
    work1_7_authority_binding: binding(AUTHORITY_PATH, inputs.authority.bytes, inputs.authority.record),
    activation_receipt_binding: binding(ACTIVATION_PATH, inputs.activation.bytes, inputs.activation.record),
    public_interfaces: [
      'validateAnalysisV2({analysis, resolveBinding})',
      'validateProjectionV2({projection, analysis, viewPolicy})',
      'verifyRegisteredCandidate({repoRoot, registrationPath})',
    ],
    semantic_input_contract: {
      count: 6,
      roles: [
        'BASE_ANALYSIS_SET', 'AGREEMENT_INDEX_SET', 'CONTEXT_COMPILATION_SET',
        'APPROVED_FAMILY_PACKET_SET', 'APPROVED_FAMILY_PROFILE_SET',
        'APPROVED_STRUCTURE_DISPOSITION_SET',
      ],
      governance_is_separate: true,
      governance_role: 'CANDIDATE_REGISTRATION_BINDING_PLUS_INDEPENDENT_VERIFICATION_RESULT',
      v1_semantic_input_forbidden: true,
      v1_migration_base_exception: {
        role: 'BASE_ANALYSIS_SET',
        schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
        purpose: 'IDENTITY_AND_PRESERVED_M4_EVIDENCE_ONLY',
        may_supply_v2_semantic_facts: false,
        may_supply_v2_projection_rows: false,
      },
    },
    semantic_input_consumption_contract: {
      all_six_inputs_must_be_consumed: true,
      base_analysis_set: 'EXACT_AGREEMENT_MEMBER_AND_GOVERNED_M4_OCCURRENCE_IDENTITY_HISTORY_ONLY',
      agreement_index_set: 'EXACT_MEMBER_NODE_CANONICAL_SOURCE_AND_SPAN_PROOF',
      context_compilation_set: 'EVERY_RESOLVED_DEPENDENCY_AND_CONTEXT_NORMALISATION_USES_AN_EXACT_BOUND_EDGE',
      approved_family_packet_set: 'EVERY_PROFILE_RULING_DIMENSION_EXCLUSION_AND_FIXTURE_TRACES_TO_AN_EXACT_PACKET_MEMBER',
      approved_family_packet_authority: EXPECTED_FAMILY_PACKET_AUTHORITY,
      approved_family_profile_set: 'EVERY_PROFILE_SNAPSHOT_EQUALS_AN_EXACT_APPROVED_MEMBER',
      approved_structure_disposition_set: 'EVERY_STRUCTURAL_ARTEFACT_LEGAL_EXCLUSION_AND_NO_OUTPUT_AUTHORITY_EQUALS_AN_EXACT_APPROVED_MEMBER',
      executable_matching_owner: 'SEPARATE_BEN_APPROVED_FAMILY_PROFILE_SET',
      packet_set_can_assert_completeness: false,
      packet_set_contains_executable_matchers: false,
      family_packet_may_not_substitute_for_family_profile_set: true,
      v1_family_or_role_semantics_may_not_satisfy_v2_facts_or_profiles: true,
    },
    schema_versions: {
      base_analysis_set: 'AGREEMENT_ANALYSIS_SET/V1',
      agreement_index_set: 'AGREEMENT_INDEX_SET/V1',
      agreement_index: 'AGREEMENT_INDEX/V1',
      context_compilation_set: 'CONTEXT_COMPILATION_SET/V1',
      analysis: 'AGREEMENT_ANALYSIS/V2',
      legal_rule: 'AGREEMENT_LEGAL_RULE/V2',
      semantic_fact: 'AGREEMENT_SEMANTIC_FACT/V2',
      semantic_ownership_link: 'AGREEMENT_SEMANTIC_OWNERSHIP_LINK/V2',
      shared_fact_coverage: 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1',
      source_span: 'AGREEMENT_SOURCE_SPAN/V2',
      expression: 'STAGE_2Y_M7_V2_EXPRESSION/V1',
      disposition: 'STAGE_2Y_M7_V2_DISPOSITION/V1',
      projection: 'AGREEMENT_PROJECTION/V2',
      projection_row: 'AGREEMENT_PROJECTION_ROW/V2',
      projection_validation: 'STAGE_2Y_M7_V2_PROJECTION_VALIDATION/V1',
      family_packet_set: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
      family_profile_set: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
      family_profile: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1',
      dimension_evidence: 'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1',
      profile_requirement: 'STAGE_2Y_M7_V2_PROFILE_REQUIREMENT/V1',
      profile_conditional_requirement: 'STAGE_2Y_M7_V2_PROFILE_CONDITIONAL_REQUIREMENT/V1',
      profile_child_rule_requirement: 'STAGE_2Y_M7_V2_PROFILE_CHILD_RULE_REQUIREMENT/V1',
      subtype_tree: 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
      structure_overlay: 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY/V1',
      structure_candidate_tree: 'STAGE_2Y_M7_V2_STRUCTURE_CANDIDATE_TREE/V1',
      structure_overlay_fixture: 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
      structure_marker_evidence: 'STAGE_2Y_M7_V2_STRUCTURE_MARKER_EVIDENCE/V1',
      family_correction: 'STAGE_2Y_M7_V2_FAMILY_CORRECTION/V1',
      structure_disposition_set: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
      view_policy: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1',
      inspected_candidate_set: 'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1',
      inspected_effect: 'STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1',
      reviewed_source_closure: 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1',
      authored_unit_effect_ledger: 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1',
      candidate_registration: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
      candidate_registration_verification: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1',
      match_fixture: 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
      analysis_validation: 'STAGE_2Y_M7_V2_ANALYSIS_VALIDATION/V1',
    },
    typed_value_kinds: [
      'BOOLEAN', 'PARTY_SET', 'PARTY', 'DEFINED_TERM', 'DATE', 'REFERENCE',
      'ENUM', 'NUMBER', 'PERCENTAGE', 'DURATION', 'PERIOD', 'MONEY',
    ],
    operator_vocabulary: [
      { operator: 'ALL_OF', arity: 'AT_LEAST_2', child_roles: ['MEMBER'], ordered: true },
      { operator: 'ANY_OF', arity: 'AT_LEAST_2', child_roles: ['MEMBER'], ordered: true },
      { operator: 'NOT', arity: 1, child_roles: ['NEGATED'], ordered: true },
      { operator: 'IF_THEN', arity: 2, child_roles: ['CONDITION', 'CONSEQUENCE'], ordered: true },
      { operator: 'EXCEPTION_TO', arity: 2, child_roles: ['BASE', 'EXCEPTION'], ordered: true },
      { operator: 'OVERRIDES', arity: 2, child_roles: ['OVERRIDING', 'OVERRIDDEN'], ordered: true },
      { operator: 'DEEMS_AS', arity: 2, child_roles: ['TRIGGER', 'DEEMED_RESULT'], ordered: true },
      { operator: 'EARLIER_OF', arity: 'AT_LEAST_2_TEMPORAL', child_roles: ['MEMBER'], ordered: true },
      { operator: 'LATER_OF', arity: 'AT_LEAST_2_TEMPORAL', child_roles: ['MEMBER'], ordered: true },
      { operator: 'TO_EXTENT', arity: 2, child_roles: ['BASE', 'EXTENT_LIMIT'], ordered: true },
      { operator: 'CONSEQUENCE_MODIFIER', arity: 2, child_roles: ['BASE_EFFECT', 'MODIFIED_CONSEQUENCE'], ordered: true },
    ].map((entry) => ({
      ...entry,
      result_kind: entry.operator === 'EARLIER_OF' || entry.operator === 'LATER_OF'
        ? 'TEMPORAL' : 'LOGICAL',
      allowed_child_kinds: entry.operator === 'OVERRIDES'
        ? ['RULE', 'EXPRESSION']
        : (entry.operator === 'EARLIER_OF' || entry.operator === 'LATER_OF'
          ? ['FACT', 'EXPRESSION']
          : ['FACT', 'RULE', 'EXPRESSION']),
      ...(entry.operator === 'EARLIER_OF' || entry.operator === 'LATER_OF'
        ? { fact_value_kinds: ['DATE', 'DURATION', 'PERIOD', 'REFERENCE'] } : {}),
    })),
    legal_expression_contract: {
      child_kinds: ['FACT', 'RULE', 'EXPRESSION'],
      child_order: 'CONTIGUOUS_ORDINALS_FROM_1',
      precedence: 'EXPLICIT_PARENT_CHILD_TREE_ONLY_NO_IMPLICIT_PRECEDENCE',
      scope: 'EACH_NODE_HAS_NON_EMPTY_EXACT_SCOPE_SPAN_IDS',
      connective_provenance: 'EACH_NODE_HAS_NON_EMPTY_EXACT_CONNECTIVE_SPAN_IDS_UNIQUELY_OWNED',
      canonical_serialisation: 'OPERATOR(ORDINAL_CHILD_SIGNATURES_COMMA_JOINED)',
      canonical_fact_child_signature: 'FIELD_KEY',
      canonical_rule_child_signature: 'RULE(EXPRESSION_SIGNATURE)',
      parentage: 'ONE_PARENT_EXCEPT_ROOT_NO_SHARED_OR_ORPHAN_NODES',
      authored_limb_marker_provenance:
        'EACH_OVERLAY_AUTHORISED_LIMB_MARKER_HAS_ONE_EXPRESSION_OWNER',
      overlay_tree_parentage:
        'ITEM39_SIX_MARKER_EXPRESSIONS_MIRROR_SELECTED_TREE_PARENTAGE_AND_SIBLING_ORDER',
    },
    allowed_state_combinations: [
      ['COMPLETE', 'SUFFICIENT', 'NORMAL'],
      ['COMPLETE', 'SOURCE_LIMITED', 'APPROVED_LIMITED'],
      ['INCOMPLETE', 'ANY', 'REVIEW_ONLY'],
      ['AMBIGUOUS', 'ANY', 'REVIEW_ONLY'],
      ['ANY', 'DRAFTING_AMBIGUOUS', 'REVIEW_ONLY'],
      ['COMPLETE', 'SUFFICIENT', 'NO_COMPARISON'],
      ['COMPLETE', 'SUFFICIENT', 'NO_OUTPUT'],
    ],
    source_coverage: {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      agreement_index_set_membership_required: true,
      canonical_source_bytes_resolved: true,
      source_node_occurrence_membership_required: true,
      span_hash_recomputed_from_source_bytes: true,
      partition_required: true,
      overlap_forbidden: true,
      gap_forbidden_for_complete: true,
      kinds: [
        'FACT', 'SHARED_FACT', 'LOGIC_CONNECTIVE', 'AUTHORED_LIMB_MARKER',
        'RESOLVED_DEPENDENCY',
        'STRUCTURAL_TEXT', 'SOURCE_ARTEFACT', 'LEGAL_TEXT_EXCLUSION',
      ],
      authored_limb_marker_authority: 'EXACT_EXPRESSION_OWNER_AND_SELECTED_BEN_OVERLAY',
      legal_text_non_modelled_requires_exact_ruling: true,
      whole_clause_semantic_fact_forbidden: true,
      quoted_subclause_semantic_fact_forbidden: true,
      source_span_status_recomputed_from_exact_bound_bytes: true,
      technical_span_definition: 'NO_UNICODE_LETTER_OR_NUMBER',
      operative_marker_kinds: ['MODAL', 'ENUMERATED_LIMB'],
      declared_legal_operative_material_status_must_equal_derived_status: true,
    },
    source_status_derivation_contract: {
      source_status_authority: 'BOUND_CANONICAL_UTF8_BYTES_ONLY',
      technical_span_test: 'NO_UNICODE_LETTER_OR_NUMBER',
      technical_span_status: {
        legal_text: false,
        operative: false,
        materiality: 'NON_MATERIAL',
      },
      substantive_span_status: {
        legal_text: true,
        materiality: 'MATERIAL',
      },
      operative_modal_tokens: [
        'shall', 'must', 'will', 'would', 'may', 'agree', 'agrees', 'undertake',
        'undertakes',
      ],
      verbal_covenant_grammar:
        'COVENANT_OR_COVENANTS_FOLLOWED_BY_NOT_TO_TO_THAT_OR_COORDINATED_AGREE_OR_UNDERTAKE',
      possessive_noun_covenants_are_not_modal: true,
      covenant_noun_predecessor_exclusions: [
        'a', 'an', 'the', 'this', 'that', 'these', 'those', 'its', 'their', 'our',
        'your', 'his', 'her', 'any', 'such', 'all', 'other', 'POSSESSIVE_APOSTROPHE_S',
      ],
      enumerated_limb_test: 'STARTS_WITH_PARENTHESISED_OR_DOTTED_ALPHANUMERIC_LIMB_MARKER',
      operative_marker_partition: 'EXACTLY_ZERO_OR_ONE_DERIVED_MARKER_PER_SOURCE_SPAN',
      operative_marker_scan_scope: 'FULL_BOUND_CLOSURE_BYTES_BEFORE_CALLER_SPAN_PARTITION',
      each_derived_marker_requires_exactly_one_isolating_source_span: true,
      caller_span_boundaries_may_not_split_or_absorb_markers: true,
      caller_status_flags_must_equal_derived_status_and_never_establish_it: true,
      source_artefact_status_requires_approved_match_test_against_exact_source_bytes: true,
      textual_source_artefact_requires_native_agreement_index_artefact_or_page_marker_proof_or_exact_ben_ruling: true,
      native_source_artefact_start_and_end_must_exactly_equal_analysis_span: true,
      self_authored_match_test_alone_cannot_establish_textual_technical_status: true,
      multi_character_alphabetic_and_alphanumeric_limb_markers_required: true,
      parenthesised_limb_lexical_position_alone_is_not_authority: true,
      enumerated_limb_requires_exact_agreement_index_authored_inline_list_marker_span: true,
      agreement_index_non_structural_marker_reasons_are_not_limb_authority: [
        'GLUED_SECTION_REFERENCE', 'BARE_CLAUSE_REFERENCE',
      ],
      false_m2_ambiguity_requires_exact_approved_v2_structure_overlay: true,
      inline_parenthesised_cross_references_must_not_be_operational_limb_markers: true,
    },
    profile_gate: {
      all_25_families_considered: true,
      match_test_version: 1,
      match_boolean_operators: ['ALL', 'ANY', 'NOT'],
      match_atomic_predicates: [
        'SOURCE_TOKEN_SEQUENCE', 'SOURCE_TOKEN_ANY', 'SOURCE_TOKEN_ALL',
        'INDEX_NODE_KIND', 'CONTEXT_EDGE', 'TYPED_FACT_EQUALS',
      ],
      source_token_normalisation: 'UNICODE_SIMPLE_CASE_FOLD_COLLAPSED_WHITESPACE_WHOLE_WORD',
      free_regex_or_callback_forbidden: true,
      v1_family_label_or_heading_only_proof_forbidden: true,
      all_approved_profiles_evaluated: true,
      candidate_match_claim_recomputed: true,
      unsupported_match_predicate_disposition: 'REVIEW_ONLY',
      exactly_one_profile_per_derived_effect: true,
      most_specific_descendant_wins: true,
      sibling_or_family_overlap_for_same_effect: 'AMBIGUOUS_REVIEW_ONLY',
      generic_normal_requires: ['TREE_OUTPUT_COMPLETE_TERMINAL', 'EXACT_GENERIC_LEVEL_OUTPUT_APPROVED'],
      absent_child_profile_is_not_completion_proof: true,
      approved_profile_additional_members: [
        'profile_key', 'optional_fields', 'conditional_requirements', 'allowed_source_types',
        'allowed_dependency_types', 'child_rule_profiles', 'display_order', 'grouping_policy',
        'known_relevant_dimensions', 'excluded_or_delegated_dimensions',
        'equivalence_signature_mapping', 'shared_source_lawyer_decision_ids',
      ],
      profile_set_additional_members: ['dimension_evidence_bindings', 'subtype_tree_bindings'],
      profile_set_subtype_tree_entry_members: ['family_key', 'binding'],
      profile_set_subtype_tree_count: 25,
      profile_set_subtype_tree_order: 'SORTED_25_FAMILY_ORDER',
      candidate_tree_bindings_must_byte_equal_profile_set_tree_bindings: true,
      subtype_tree_members: [
        'schema_version', 'subtype_tree_id', 'family_key', 'tree_id', 'profile_set_version',
        'completeness_state', 'nodes',
      ],
      subtype_tree_node_members: [
        'profile_key', 'parent_profile_key', 'node_state',
      ],
      subtype_tree_identity_uses_stable_profile_keys: true,
      dimension_evidence_members: [
        'schema_version', 'dimension_evidence_id', 'family_key', 'profile_id',
        'source_class', 'evidence_binding', 'dimension_keys', 'lawyer_ruling_id',
      ],
      dimension_evidence_source_classes: ['CALIBRATION', 'ADVERSARIAL'],
      dimension_evidence_binding_kind: 'APPROVED_EXACT_MATCH_FIXTURE',
      match_fixture_dimension_members: [
        'expected_material_field_keys', 'expected_dependency_backed_field_keys',
        'expected_conditional_requirement_ids', 'expected_child_rule_requirement_ids',
        'expected_excluded_dimension_keys', 'expected_delegated_dimension_keys',
      ],
      match_fixture_typed_fact_members: [
        'field_key', 'value_type', 'typed_value', 'materiality', 'dependency_types',
      ],
      dimension_evidence_derivation: 'SORTED_UNION_OF_MATERIAL_FIELDS_DEPENDENCY_BACKED_FIELDS_TRIGGERED_CONDITIONAL_PREDICATE_AND_REQUIRED_FIELDS_EXCLUDED_DELEGATED_AND_CHILD_RULE_REQUIREMENT_IDS',
      dimension_evidence_child_rule_key_prefix: 'CHILD_RULE:',
      dimension_evidence_record_key_contract: 'NON_EMPTY_CANONICAL_EXACT_SUBSET_OF_BOUND_FIXTURE_DERIVED_KEYS',
      dimension_evidence_records_disjoint_per_profile: true,
      known_dimension_inventory_equals_bound_dimension_evidence_union: true,
      known_dimension_source_class_and_ruling_must_match_evidence: true,
      profile_identity_cycle_rule: 'FIXTURES_USE_STABLE_PROFILE_KEY_CONTENT_ID_HASHES_KEY_AND_ALL_FIXTURE_PROOFS',
      source_and_dependency_entries_require_exact_lawyer_ruling: true,
      mandatory_floor_fields: ['APPLIES_TO', 'LEGAL_EFFECT'],
      generic_level_output_authority_members: [
        'authority_kind', 'profile_id', 'profile_set_version', 'profile_set_binding',
        'lawyer_ruling_id', 'approver', 'covered_occurrence_class', 'legal_reason',
        'covered_input_occurrence_ids', 'inclusion_fixture_bindings',
        'exclusion_fixture_bindings',
      ],
      profile_requirement_members: [
        'requirement_id', 'field_key', 'value_type', 'cardinality', 'materiality',
        'lawyer_ruling_id',
      ],
      mandatory_field_cardinalities: ['ONE', 'ONE_OR_MORE'],
      optional_field_cardinalities: ['ZERO_OR_ONE', 'ZERO_OR_MORE'],
      conditional_requirement_members: [
        'conditional_requirement_id', 'predicate', 'required_field_keys', 'lawyer_ruling_id',
      ],
      conditional_predicate_members: ['field_key', 'value_type', 'operator', 'typed_value'],
      conditional_predicate_operators: ['EQUALS'],
      allowed_source_entry_members: ['source_type', 'lawyer_ruling_id'],
      allowed_dependency_entry_members: ['dependency_type', 'lawyer_ruling_id'],
      child_rule_requirement_members: [
        'child_rule_requirement_id', 'profile_id', 'relationship_operator', 'cardinality',
        'lawyer_ruling_id',
      ],
      child_rule_cardinalities: ['ONE', 'ZERO_OR_ONE', 'ONE_OR_MORE', 'ZERO_OR_MORE'],
      display_order_rule: 'EXACTLY_ONCE_FOR_EVERY_DECLARED_FIELD',
      grouping_policy_members: ['allowed', 'compatible_profile_ids', 'lawyer_ruling_id'],
      cross_profile_grouping_requires_mutual_authority: true,
      known_relevant_dimension_members: ['dimension_key', 'source', 'lawyer_ruling_id'],
      known_relevant_dimension_sources: ['CALIBRATION', 'ADVERSARIAL'],
      excluded_or_delegated_dimension_members: [
        'dimension_key', 'disposition', 'lawyer_ruling_id', 'owner_profile_id',
        'owner_field_key',
      ],
      dimension_dispositions: ['EXCLUDED', 'DELEGATED'],
      excluded_dimension_requires_null_owner: true,
      delegated_dimension_requires_exact_approved_profile_and_declared_field: true,
      dimension_inventory_members: [
        'required_fields', 'optional_fields', 'excluded_or_delegated_dimensions',
        'child_rule_profiles',
      ],
      exact_finite_dimension_accounting_required: true,
      candidate_profile_result_members: [
        'profile_id', 'profile_key', 'matched', 'predicate_result_digest', 'decisive_leaf_ids',
      ],
      candidate_effect_selected_profile_members: ['selected_profile_id', 'selected_profile_key'],
    },
    ownership: {
      one_semantic_owner: true,
      consumer_uses_typed_link: true,
      identity_excludes_display_and_family_labels: true,
      effect_role_and_scope_distinguish_same_span_value: true,
      typed_consumer_link_members: [
        'link_id', 'consumer_rule_id', 'owner_rule_id', 'owner_fact_id',
        'source_support_ids', 'consumer_reference_span_ids', 'consumer_dependency_ids',
        'consumer_context_edge_ids', 'resolved_owner_target_id',
      ],
      consumer_reference_spans_must_be_inside_consumer_rule_closure: true,
      consumer_dependencies_require_exact_source_spans_and_context_edges: true,
      one_typed_link_per_delegated_dimension: true,
      resolved_owner_target_must_equal_every_bound_dependency_and_context_target: true,
      owner_fact_value_or_normalisation_context_must_prove_resolved_target: true,
    },
    linked_rule_state_contract: {
      one_occurrence_disposition_required: true,
      rule_validation_members: [
        'extraction_state', 'source_quality', 'output_disposition', 'issue_codes',
        'no_comparison_authority',
      ],
      per_rule_no_comparison_authority_members: [
        'authority_kind', 'policy_id', 'lawyer_ruling_id', 'input_occurrence_id', 'rule_id',
      ],
      occurrence_no_comparison_authorities: 'ORDERED_ARRAY',
      issue_members: [
        'effect_id', 'rule_id', 'issue_code', 'extraction_state', 'source_quality',
        'source_span_ids',
      ],
      issue_rule_id_null_only_when_effect_produced_no_rule: true,
      occurrence_summary_precedence: [
        'REVIEW_ONLY', 'APPROVED_LIMITED', 'NORMAL', 'NO_COMPARISON',
      ],
      normal_siblings_project_when_occurrence_summary_is_review_only: true,
      no_output_requires_zero_rules_and_zero_issues: true,
    },
    semantic_identity_contract: {
      content_addressed_records: [
        'AGREEMENT_LEGAL_RULE/V2',
        'AGREEMENT_SEMANTIC_FACT/V2',
        'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1',
        'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1',
        'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1',
        'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1',
        'STAGE_2Y_M7_V2_EXPRESSION/V1',
        'STAGE_2Y_M7_V2_DISPOSITION/V1',
      ],
      fact_key_members: [
        'agreement_id', 'field_key', 'normalised_typed_value', 'legal_subject',
        'temporal_scope_signature', 'source_support_ids', 'legal_effect_role',
      ],
      fact_key_excludes: ['display_label', 'family_label', 'consumer_reference_span'],
      rule_id_members: [
        'agreement_id', 'input_occurrence_id', 'effect_id', 'family_key', 'profile_id',
        'subtype_path', 'semantic_fact_keys', 'canonical_expression_signature',
        'child_rule_ids', 'source_closure_id',
      ],
      mutually_recursive_owner_and_fact_links_excluded_from_ids: true,
    },
    fact_normalisation_contract: {
      proof_members: ['rule_id', 'input_source_span_ids', 'input_context_edge_ids', 'result_digest'],
      allowed_rule_ids: [
        'EXACT_TOKEN/V1', 'BOOLEAN_LITERAL_MAP/V1', 'NUMBER_PARSER/V1',
        'PERCENTAGE_PARSER/V1', 'MONEY_PARSER/V1', 'DURATION_PARSER/V1',
        'PERIOD_PARSER/V1', 'DATE_ISO_PARSER/V1', 'BOUND_PARTY_ALIAS/V1',
        'DEFINED_TERM_REFERENCE/V1', 'ENUM_LITERAL_MAP/V1', 'REFERENCE_EDGE/V1',
      ],
      rule_to_value_type: {
        'EXACT_TOKEN/V1': ['ENUM'],
        'BOOLEAN_LITERAL_MAP/V1': ['BOOLEAN'],
        'NUMBER_PARSER/V1': ['NUMBER'],
        'PERCENTAGE_PARSER/V1': ['PERCENTAGE'],
        'MONEY_PARSER/V1': ['MONEY'],
        'DURATION_PARSER/V1': ['DURATION'],
        'PERIOD_PARSER/V1': ['PERIOD'],
        'DATE_ISO_PARSER/V1': ['DATE'],
        'BOUND_PARTY_ALIAS/V1': ['PARTY', 'PARTY_SET'],
        'DEFINED_TERM_REFERENCE/V1': ['DEFINED_TERM'],
        'ENUM_LITERAL_MAP/V1': ['ENUM'],
        'REFERENCE_EDGE/V1': ['REFERENCE'],
      },
      typed_value_must_be_recomputed: true,
      whole_clause_or_subclause_blob_forbidden: true,
      source_support_span_order: 'DOCUMENT_ORDER_CONTIGUOUS_NO_GAPS',
      source_boundary_policy: 'IGNORE_ONLY_BOUNDARY_WHITESPACE_WHILE_RETAINING_EXACT_BOUND_SPAN',
      atomic_parse_unconsumed_non_whitespace_forbidden: true,
      normaliser_consumption: 'WHOLE_SOURCE_EXACTLY_ONE_TYPED_VALUE',
      partial_or_first_match_parse_forbidden: true,
      unconsumed_operative_conditional_or_second_value_forbidden: true,
      context_party_targets_unique_and_single_for_non_set_value: true,
      party_alias_grammar: 'CLOSED_ALIAS_LIST_WITH_COMMA_AND_OR_SEPARATORS',
      party_cardinality: {
        PARTY: 'EXACTLY_ONE_ALIAS_AND_EDGE',
        PARTY_SET: 'AT_LEAST_TWO_ALIASES_AND_ONE_EDGE_PER_ALIAS',
      },
      party_context_edge_support: 'UNIQUE_ORDERED_CONTIGUOUS_SUPPORT_INSIDE_FACT_SOURCE_EXACTLY_EQUALS_CORRESPONDING_ALIAS_UTF8_BYTE_INTERVAL',
      reference_edge_type: 'REFERENCE_TARGET',
      reference_edge_support_must_exactly_equal_ordered_fact_source_supports: true,
      duration_bound_types: ['EXACT', 'WITHIN', 'AT_LEAST'],
      duration_legal_number_grammar:
        'OPTIONAL_NOT_LESS_THAN_WITHIN_OR_EXACTLY_PLUS_WORD_WITH_CONCORDANT_PARENTHETICAL_DIGIT_OR_DIGIT_PLUS_DAY_WEEK_MONTH_OR_YEAR',
      duration_word_number_concordance_required: true,
      deictic_duration_reference_may_not_be_parsed_as_direct_duration: true,
    },
    equivalence_signature_contract: {
      mapping_slots: [
        'actor', 'effect', 'standard', 'threshold', 'timing', 'conditions',
        'qualifications',
      ],
      mapping_members: ['field_keys', 'expression_signature_role', 'lawyer_ruling_id'],
      expression_signature_roles: [null, 'CANONICAL_EXPRESSION'],
      derived_fact_members: [
        'kind', 'field_key', 'value_type', 'typed_value', 'legal_subject',
        'temporal_scope_signature', 'legal_effect_role',
      ],
      derived_fact_kind: 'FACT',
      derived_linked_fact_members: [
        'kind', 'field_key', 'value_type', 'typed_value', 'legal_subject',
        'temporal_scope_signature', 'legal_effect_role', 'ownership_link_id',
      ],
      derived_linked_fact_kind: 'LINKED_FACT',
      optional_expression_members: ['kind', 'role', 'signature'],
      optional_expression_kind: 'EXPRESSION',
      rule_signature_recomputed_from_owned_facts_and_canonical_expression: true,
      every_material_grouping_field_mapped: true,
      actor_slot_must_map_field: 'APPLIES_TO',
      effect_slot_must_map_field: 'LEGAL_EFFECT',
      at_least_one_slot_requires_canonical_expression: true,
      derivation_order: 'MAPPING_FIELD_ORDER_THEN_CANONICAL_SORT_WITHIN_FIELD_THEN_EXPRESSION_LAST',
    },
    effect_local_provenance_contract: {
      every_fact_support_inside_exact_effect_source_spans: true,
      fact_owner_rule_effect_id_must_equal_effect_id: true,
      every_reachable_expression_connective_authored_limb_marker_and_scope_inside_effect: true,
      fact_or_expression_cross_effect_sharing_forbidden: true,
      expression_fact_and_rule_children_stay_inside_effect: true,
      every_fact_and_expression_belongs_to_exactly_one_inspected_effect: true,
      dependency_reachability:
        'FULL_SUPPORT_INSIDE_EXACT_EFFECT_OR_EFFECT_FACT_OR_EXACT_CONSUMER_OWNERSHIP_LINK_WHILE_ABSENCE_PROOFS_REMAIN_CLOSURE_WIDE',
    },
    effect_ledger_contract: {
      entry_members: [
        'effect_id', 'input_occurrence_id', 'effect_kind', 'rule_ids', 'source_span_ids',
        'operative_marker_span_ids', 'treatments',
      ],
      treatment_members: ['treatment_kind', 'target_id', 'source_span_ids', 'authority_id'],
      treatment_kinds: ['RULE', 'EXPRESSION', 'DEPENDENCY', 'LEGAL_TEXT_EXCLUSION'],
      effect_kinds: ['MODAL', 'ENUMERATED_LIMB', 'COMBINED_MODAL_LIMB'],
      effect_kind_derivation: {
        MODAL: 'ONE_OR_MORE_MODAL_AND_ZERO_ENUMERATED_LIMB_MARKERS',
        ENUMERATED_LIMB: 'ZERO_MODAL_AND_ONE_OR_MORE_ENUMERATED_LIMB_MARKERS',
        COMBINED_MODAL_LIMB:
          'ONE_OR_MORE_MODAL_AND_ONE_OR_MORE_ENUMERATED_LIMB_MARKERS',
      },
      operative_spans_equal_marker_spans_one_to_one: true,
      operative_marker_order: 'EXACT_SOURCE_DOCUMENT_ORDER',
      rule_treatment_spans_equal_target_rule_fact_source_supports_plus_exact_assigned_operative_markers: true,
      expression_treatment_spans_equal_target_expression_connective_and_authored_limb_marker_supports: true,
      every_linked_expression_treated_exactly_once: true,
      treatments_reconcile_to_exact_effect_source_partition_after_document_order_sort: true,
      each_operative_marker_requires_exactly_one_rule_expression_or_governed_exclusion_treatment: true,
      overlay_limb_marker_route:
        'EXPRESSION_TREATMENT_PLUS_AUTHORED_LIMB_MARKER_COVERAGE_ONLY',
      zero_rule_marker_route: 'LEGAL_TEXT_EXCLUSION_ONLY_FOR_EXACT_NO_OUTPUT_DISPOSITION',
      zero_rule_marker_authority_must_equal_bound_no_output_structure_member: true,
      zero_rule_marker_treatment_spans_must_be_covered_by_full_no_output_authority_scope: true,
      effect_local_provenance_required: true,
      effect_fact_support_must_be_inside_exact_effect_spans: true,
      effect_expression_connective_limb_marker_and_scope_spans_must_be_inside_exact_effect_spans:
        true,
      facts_and_expressions_have_one_effect_owner: true,
      rule_expression_and_fact_support_must_equal_effect_support: true,
      operative_marker_kind_and_effect_kind_recomputed_from_source_status: true,
      treatment_support_must_equal_derived_rule_expression_or_dependency_support: true,
      every_operative_modal_and_authored_limb_accounted_once: true,
      one_candidate_effect_cannot_absorb_distinct_operative_duties_without_exact_expression_and_overlay_tree_proof:
        true,
      shared_fact_source_exception:
        'EXACTLY_TWO_DISTINCT_RULE_TREATMENTS_IN_TWO_EFFECTS_BOUND_TO_ONE_CONTENT_ADDRESSED_SHARED_FACT_COVERAGE',
      shared_fact_non_rule_or_same_rule_reuse_forbidden: true,
      compound_item39_contract: {
        effect_count: 1,
        rule_count: 1,
        modal_marker_count: 4,
        authored_limb_marker_count: 6,
        expression_marker_ownership: 'ONE_TO_ONE',
        expression_tree:
          'MIRRORS_SELECTED_OVERLAY_PARENTAGE_AND_SIBLING_ORDER',
        applies_to: 'DIRECT_LOCAL_PARENT_PARTY_FACT',
        extraction_state: 'INCOMPLETE',
        source_quality: 'SUFFICIENT',
        output_disposition: 'REVIEW_ONLY',
        issue_code: 'MISSING_OPERATIVE_CHAPEAU',
        no_output_forbidden: true,
        actor_inheritance_forbidden: true,
      },
    },
    temporal_shared_source_contract: TEMPORAL_SHARED_SOURCE_CONTRACT,
    profile_fixture_contract: {
      required_kinds: ['POSITIVE', 'NEAR_NEGATIVE', 'WRONG_FAMILY', 'WRONG_SUBTYPE'],
      required_members: [
        'fixture_id', 'kind', 'fixture_binding', 'input_occurrence_id', 'expected_match',
        'expected_selected_profile_key', 'expected_predicate_result_digest',
        'decisive_leaf_ids', 'lawyer_ruling_id',
      ],
      every_profile_requires_positive_and_near_negative: true,
      negative_decisive_leaf_ids_non_empty: true,
      validator_recomputes_every_fixture: true,
    },
    no_output_contract: {
      required_record_members: [
        'input_occurrence_id', 'prior_family_key', 'authored_unit_id', 'source_closure_id',
        'source_closure_digest', 'candidate_set_id', 'candidate_set_digest',
        'all_family_profile_results', 'compatible_cross_family_match_count',
        'extraction_state', 'source_quality', 'output_disposition', 'no_output_authority',
      ],
      required_authority_members: [
        'authority_kind', 'structure_disposition_id', 'policy_id', 'policy_version',
        'lawyer_ruling_id', 'approver', 'legal_reason', 'covered_input_occurrence_ids',
        'inclusion_fixture_bindings', 'exclusion_fixture_bindings',
      ],
      all_25_families_evaluated: true,
      compatible_cross_family_match_count: 0,
      empty_result_cannot_prove_no_match: true,
      exact_structure_disposition_member_required: true,
    },
    structure_disposition_contract: {
      required_members: [
        'schema_version', 'structure_disposition_id', 'kind', 'reason_code', 'policy_id',
        'policy_version', 'authority_class', 'approver', 'lawyer_ruling_id', 'scope',
        'match_test', 'inline_list_overlay',
        'inclusion_fixture_bindings', 'exclusion_fixture_bindings',
      ],
      scope_members: [
        'agreement_index_id', 'source_node_occurrence_id', 'start_byte', 'end_byte',
        'governed_input_occurrence_ids',
      ],
      legal_text_exclusion_and_no_output_require_ben: true,
      technical_disposition_requires_non_legal_non_operative_non_material_span: true,
      technical_disposition_requires_derived_technical_span: true,
      match_test_inclusion_fixtures_must_match_inside_governed_scope: true,
      match_test_exclusion_fixtures_must_not_match_and_must_be_outside_governed_scope: true,
      match_test_inclusion_and_exclusion_fixtures_must_be_disjoint: true,
      authored_unit_predicates_use_full_bound_authored_unit_context: true,
      effect_predicates_use_exact_candidate_span_bytes: true,
      authored_inline_list_overlay_contract: {
        initial_overlay_count: 1,
        overlay_schema_version: 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY/V1',
        candidate_tree_schema_version: 'STAGE_2Y_M7_V2_STRUCTURE_CANDIDATE_TREE/V1',
        ambiguous_repeat_fixture_schema_version: 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
        marker_evidence_identity_domain: 'STAGE_2Y_M7_V2_STRUCTURE_MARKER_EVIDENCE/V1',
        overlay_kind: 'BEN_AUTHORED_INLINE_LIST_OVERLAY',
        overlay_reason_code: 'FALSE_M2_AMBIGUITY',
        overlay_authority_class: 'BEN_LEGAL_RULING',
        overlay_approver: 'BEN_GOODCHILD',
        overlay_members: [
          'schema_version', 'agreement_index_binding', 'sealed_ambiguity_id',
          'sealed_ambiguity_type', 'sealed_ambiguity_span',
          'inline_marker_disposition_id', 'parent_node_occurrence_id',
          'parent_reference', 'parent_scoping_rule', 'candidate_trees',
          'selected_candidate_tree_id', 'technical_review',
          'ambiguous_repeat_fixture_bindings', 'marker_eligibility',
          'lawyer_ruling_id',
        ],
        exact_item39_authority: {
          sample_ordinal: 39,
          agreement_index_id: 'e50464fb97dbd7ead5afc66292a42e5c37f47d3ccdc87d5842df7abef666b3b2',
          ambiguity_id: '21f1bca531ca44030c615da1e88a933704ee74402a35f5aa36982fb1bbb21e00',
          ambiguity_type: 'UNRESOLVED_INLINE_LIST',
          inline_marker_disposition_id: '7bc98f42d8580f9aada5ee4274e9ada3d22ddd12e9150898a3188e7ddbf122d3',
          parent_node_occurrence_id: '9a9d339a33d7c530a9668482cb65f537e96bf9c78836de56cae76d92f6ceff35',
          parent_reference: '7.01(d)',
          source_span: {
            coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
            start_byte: 229260,
            end_byte: 229525,
            text_sha256: '75beb6bb93b368073110d0a8f28dd4d038ba357281a509618b70567dd527cfb7',
          },
          marker_spans: [
            { start_byte: 229260, end_byte: 229263, text_sha256: '272ab01808c90df4053b2227b9742a40013a8eae84e18ec39c2771e91e7b54a6' },
            { start_byte: 229362, end_byte: 229366, text_sha256: '18e46062c2ae326d8cec8711300981d0312f68b824ce2504ae671634d7be02e0' },
            { start_byte: 229492, end_byte: 229495, text_sha256: '272ab01808c90df4053b2227b9742a40013a8eae84e18ec39c2771e91e7b54a6' },
            { start_byte: 229521, end_byte: 229525, text_sha256: '18e46062c2ae326d8cec8711300981d0312f68b824ce2504ae671634d7be02e0' },
          ],
          structural_candidate_markers: [
            {
              source_disposition_id: '6a5b77ebda120dc322edf5febfc44c03663e9c3a3dc92b55000a3a40e53f0c7d',
              marker_text: '(A)',
              start_byte: 229367,
              end_byte: 229370,
              text_sha256: '2e5b320c4307603615d67098d9e1459ea7b6705b7d553049197d1f1e3a750840',
            },
            {
              source_disposition_id: '64c180da22ae7721b3e0e7cced6786ba824bc632a42dccf53330b1cbc4531b2d',
              marker_text: '(B)',
              start_byte: 229432,
              end_byte: 229435,
              text_sha256: '79398e2d8cadfc05f0152f92591166a1f81ebeeb0156179ef1a0f6c55ebc9af9',
            },
          ],
          excluded_glued_references: [
            {
              source_disposition_id: 'c346c4bf8df8e757eeaf8ee241d485c0eb60aec8c19a4da54ee48dcf7ef06afd',
              marker_text: '(a)',
              start_byte: 229335,
              end_byte: 229338,
              text_sha256: 'f89bf797c3b1dda4ee48380783e5e979067686a6a9540c5a40e8d75ae5f3d199',
            },
            {
              source_disposition_id: '8e5b36c152615105d5ba0e3f8c6ef8887e3f4f5a7e3525e9d73cb5f2169c7b54',
              marker_text: '(b)',
              start_byte: 229354,
              end_byte: 229357,
              text_sha256: '8cca9bdc836007edec9df387444bbca0513dcdc3c3b8317206b9c53d045554f2',
            },
          ],
          lawyer_decision_id: 'ac56600e311361f72e9423de2fd9a4a468e536ce25974dbc9f450369b8e097f6',
          reviewer: 'BEN_GOODCHILD',
        },
        parent_scoping_rule_members: [
          'rule_id', 'rule_version', 'marker_identity', 'candidate_enumeration',
          'selection_rule',
        ],
        parent_scoping_rule: {
          rule_id: 'PARENT_SCOPED_ORDERED_SIBLINGS',
          rule_version: 1,
          marker_identity: 'PARENT_SCOPE_PLUS_EXACT_MARKER_SPAN',
          candidate_enumeration: 'ALL_MATERIAL_CONTINUATION_SAME_PARENT_RESTART_AND_IMMEDIATE_NESTING_READINGS_UNDER_PREORDER_AND_CONTIGUOUS_SOURCE_RULES',
          selection_rule: 'EXACTLY_ONE_PASSING_TREE_ELSE_REVIEW_ONLY',
        },
        candidate_tree_members: [
          'schema_version', 'candidate_tree_id', 'nodes', 'constraint_results',
          'tree_state',
        ],
        candidate_node_members: [
          'marker_span', 'marker_text', 'source_disposition_id', 'parent_key',
          'sibling_ordinal', 'depth',
        ],
        marker_eligibility_members: [
          'structural_candidate_disposition_ids',
          'excluded_glued_reference_disposition_ids',
        ],
        marker_eligibility_is_recomputed_from_bound_agreement_index_ambiguity: true,
        eligible_marker_sources: [
          'REFERENCED_UNRESOLVED_INLINE_LIST_SPANS',
          'NATIVE_AUTHORED_INLINE_LIST_SPANS',
          'SAME_PARENT_IN_AMBIGUITY_SPAN_NON_STRUCTURAL_UNCORROBORATED_FIRST_MARKER',
          'SAME_PARENT_IN_AMBIGUITY_SPAN_NON_STRUCTURAL_AMBIGUOUS_MARKER_STYLE',
        ],
        excluded_marker_reason: 'GLUED_SECTION_REFERENCE',
        unknown_overlapping_marker_reason_result: 'REJECT_OVERLAY_AND_REQUIRE_NEW_AUTHORITY',
        exact_structural_candidate_disposition_ids: [
          '7bc98f42d8580f9aada5ee4274e9ada3d22ddd12e9150898a3188e7ddbf122d3',
          '6a5b77ebda120dc322edf5febfc44c03663e9c3a3dc92b55000a3a40e53f0c7d',
          '64c180da22ae7721b3e0e7cced6786ba824bc632a42dccf53330b1cbc4531b2d',
        ],
        exact_excluded_glued_reference_disposition_ids: [
          'c346c4bf8df8e757eeaf8ee241d485c0eb60aec8c19a4da54ee48dcf7ef06afd',
          '8e5b36c152615105d5ba0e3f8c6ef8887e3f4f5a7e3525e9d73cb5f2169c7b54',
        ],
        candidate_node_span_union_equals_structural_disposition_span_union: true,
        candidate_node_disposition_id_span_and_text_must_equal_exact_structural_record: true,
        excluded_glued_reference_dispositions_produce_no_candidate_node: true,
        constraint_result_members: ['constraint_id', 'status', 'evidence_span_ids'],
        exact_constraint_ids: [
          'BOUND_PARENT_CONTAINMENT', 'DOCUMENT_ORDER',
          'CONTIGUOUS_SIBLING_SEQUENCE', 'LABEL_SEQUENCE_PER_PARENT',
        ],
        all_material_readings_materialised: true,
        candidate_tree_set_equals_independently_recomputed_all_material_readings: true,
        independently_recomputed_candidate_set: 'ALL_MATERIAL_CONTINUATION_SAME_PARENT_RESTART_AND_IMMEDIATE_NESTING_READINGS_UNDER_PREORDER_AND_CONTIGUOUS_SOURCE_RULES',
        every_marker_appears_once_per_candidate_tree: true,
        selected_tree_must_be_sole_passing_tree: true,
        item39_selected_parentage: [
          {
            child_marker_spans: [[229260, 229263], [229362, 229366]],
            parent_node_occurrence_id: '9a9d339a33d7c530a9668482cb65f537e96bf9c78836de56cae76d92f6ceff35',
            parent_marker_span: null,
          },
          {
            child_marker_spans: [[229367, 229370], [229432, 229435]],
            parent_node_occurrence_id: null,
            parent_marker_span: [229362, 229366],
          },
          {
            child_marker_spans: [[229492, 229495], [229521, 229525]],
            parent_node_occurrence_id: null,
            parent_marker_span: [229432, 229435],
          },
        ],
        no_unique_passing_tree_disposition: 'REVIEW_ONLY',
        item39_native_ambiguity_reason: 'AMBIGUOUS_SAME_STYLE_RESTART',
        item39_unresolved_disposition_style: 'romanLower',
        global_overlay_candidate_validation_before_closure_consumption: true,
        non_matching_source_closure_skips_overlay_without_failure: true,
        technical_review_members: ['state', 'check_ids', 'effects'],
        technical_review_check_ids: [
          'SEALED_M2_UNCHANGED', 'ALL_CANDIDATE_TREES_MATERIALISED',
          'PARENT_SCOPING_RECOMPUTED', 'UNIQUE_SELECTION',
          'AMBIGUOUS_REPEAT_NEGATIVE',
        ],
        technical_review_zero_effects: [
          'files_written', 'model_calls', 'network_reads', 'network_writes',
          'database_writes', 'product_writes',
        ],
        ambiguous_repeat_fixture_members: [
          'schema_version', 'fixture_id', 'kind', 'agreement_index_binding',
          'ambiguity_id', 'parent_scoping_rule', 'marker_eligibility', 'candidate_trees',
          'expected_selected_candidate_tree_id', 'expected_output_disposition',
          'lawyer_ruling_id',
        ],
        ambiguous_repeat_fixture_kind: 'GENUINELY_AMBIGUOUS_REPEAT',
        ambiguous_repeat_native_reason: 'AMBIGUOUS_SAME_STYLE_RESTART',
        ambiguous_repeat_requires_repeated_exact_style_and_value_across_distinct_spans: true,
        ambiguous_repeat_minimum_passing_candidate_count: 2,
        ambiguous_repeat_candidate_set_must_equal_independently_recomputed_full_material_set: true,
        ambiguous_repeat_selected_tree: null,
        ambiguous_repeat_output_disposition: 'REVIEW_ONLY',
        unknown_duplicate_changed_or_unregistered_overlays_rejected: true,
        overlay_lawyer_ruling_must_equal_enclosing_structure_member_and_exact_packet_decision: true,
        sealed_m2_bytes_parser_and_ambiguity_must_remain_unchanged: true,
        overlay_changes_only_the_m5_reading_and_review_disposition: true,
        native_authored_inline_list_remains_automatic: true,
        non_structural_marker_overlay_forbidden_outside_exact_item39_candidate_set: true,
      },
    },
    projection: {
      source_access_forbidden: true,
      validated_analysis_required: true,
      identical_analysis_object_must_have_private_weakmap_pass: true,
      exact_stored_canonical_analysis_validation_result_required: true,
      analysis_validation_result_members: [
        'schema_version', 'status', 'agreement_id', 'agreement_analysis_id',
        'agreement_analysis_sha256', 'candidate_registration_id', 'counts', 'checks',
        'effects', 'analysis_validation_id',
      ],
      analysis_validation_check_ids: [
        'GOVERNANCE_AND_SIX_INPUTS', 'PROFILE_AND_FIXTURE_GATE',
        'SOURCE_CLOSURE_AND_COVERAGE', 'FACT_OWNERSHIP_AND_NORMALISATION',
        'EXPRESSION_AND_LINKED_RULE_TOPOLOGY', 'EFFECT_AND_DISPOSITION_COMPLETENESS',
        'FAMILY_CORRECTION_COMPLETENESS', 'CONTENT_IDENTITY_AND_COUNTS',
      ],
      analysis_validation_count_additions: [
        'rule_states.normal', 'rule_states.approved_limited', 'rule_states.review_only',
        'rule_states.no_comparison', 'review_only_dispositions', 'no_output_dispositions',
      ],
      analysis_validation_zero_effects: [
        'files_written', 'model_calls', 'network_reads', 'network_writes',
        'database_writes', 'product_writes',
      ],
      full_disposition_records_routed: true,
      approved_limited_required_text: 'Not expressly stated in the complete reviewed clause',
      approved_limited_scope_and_ruling_required: true,
      material_fact_display_policy: 'DISPLAY_REQUIRED',
      every_fact_per_layout: 'EXACTLY_ONE_RENDER_OR_APPROVED_OMISSION',
      never_display_facts_must_not_render: true,
      profile_display_order_required: true,
      cross_profile_grouping_requires_profile_and_view_policy_authority: true,
      display_required_or_material_fact_omission_forbidden: true,
      permitted_omission_requires_non_material_non_display_required_fact: true,
      render_binding_members: [
        'fact_id', 'ownership_link_id', 'field_key', 'label_id', 'typed_value_digest',
        'rendered_value', 'rendered_value_digest', 'layout_id',
      ],
      delegated_render_requires_exact_ownership_link_id: true,
      item42_and_item44_work1_rows_forbidden_pending_future_profile_approval: true,
      compact_floor: ['APPLIES_TO', 'FULL_CLASSIFICATION_PATH'],
      applies_to_classification_value_types: ['PARTY', 'PARTY_SET'],
      party_classification_rendering: {
        PARTY: 'SCALAR_TARGET',
        PARTY_SET: 'SEMICOLON_JOINED_TARGETS',
      },
      applies_to_fact_ids_equal_exact_ordered_owned_applies_to_subset: true,
      non_party_applies_to_classification_forbidden: true,
      compact_and_expanded_reconcile_separately: true,
      v1_input_forbidden: true,
    },
    candidate_registration: {
      external_to_compiler: true,
      content_addressed: true,
      write_once: true,
      lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
      one_byte_change_requires_new_id: true,
      work5_change_reopens_all_50: true,
    },
    deterministic_generator_policy: {
      kind: 'DETERMINISTIC_ONLY',
      model_calls: 0,
      resistant_clause_disposition: 'REVIEW_ONLY',
      repeat_bytes_and_ids_must_match: true,
    },
  };
  if (inputs.correctionAuthority) {
    unsigned.work1_correction_recovery_contract = WORK1_CORRECTION_RECOVERY_CONTRACT;
    unsigned.correction_authority_binding = binding(
      CORRECTION_AUTHORITY_PATH,
      inputs.correctionAuthority.bytes,
      inputs.correctionAuthority.record,
    );
  }
  return identify(unsigned, CONTRACT_SCHEMA, 'contract_policy_digest', 'contract_policy_id');
}

function buildFamilyPacketSet(inputs) {
  const fixedByOrdinal = new Map(inputs.fixed.record.members.map((item) => [item.sample_ordinal, item]));
  const baselineByOrdinal = new Map(inputs.baseline.record.entries.map((item) => [item.sample_ordinal, item]));
  const packetByOrdinal = new Map(inputs.packet.record.items.map((item) => [item.sample_ordinal, item]));
  if (fixedByOrdinal.size !== 50 || baselineByOrdinal.size !== 50 || packetByOrdinal.size !== 50) {
    fail('SAMPLE_DRIFT', 'fixed 50');
  }
  const linked = new Set(LINKED_POINT_ORDINALS);
  const memberFor = (identity) => {
    const baseline = baselineByOrdinal.get(identity.sample_ordinal);
    const packet = packetByOrdinal.get(identity.sample_ordinal);
    if (!baseline || !packet || baseline.review_item_id !== identity.review_item_id
      || packet.review_item_id !== identity.review_item_id || packet.family_key !== identity.family_key) {
      fail('SAMPLE_DRIFT', `${identity.sample_ordinal}`);
    }
    const invariantId = REPAIR_INVARIANTS[baseline.repair_class];
    if (!invariantId) fail('SAMPLE_DRIFT', `${identity.sample_ordinal}:repair class`);
    return {
      sample_ordinal: identity.sample_ordinal,
      review_item_id: identity.review_item_id,
      agreement_id: identity.agreement_id,
      item_kind: identity.item_kind,
      prior_row_id: identity.prior_row_id,
      source_node_occurrence_ids: identity.source_node_occurrence_ids,
      ambiguity_id: identity.ambiguity_id,
      source_spans: identity.source_spans,
      source_excerpt_sha256: identity.source_excerpt_sha256,
      repair_membership: baseline.repair_membership,
      repair_class: baseline.repair_class,
      original_decision: baseline.original_decision,
      original_note: baseline.original_note,
      lawyer_decision_id: baseline.lawyer_decision_id,
      reviewer: baseline.reviewer,
      fresh_work5_question_required: baseline.requires_fresh_work5_question,
      linked_point_annotation: linked.has(identity.sample_ordinal),
      broad_legal_meaning_question: 'Does the V2 result preserve every important legal effect, condition, exception, timing term, standard and qualification in this source?',
      family_and_subtype_question: `Is ${identity.family_key ?? 'the post-overlay result'} assigned to the correct family and most-specific supported subtype?`,
      focused_expectation: {
        state: baseline.requires_fresh_work5_question ? 'FRESH_WORK5_RULING_REQUIRED' : 'TESTABLE',
        invariant_id: invariantId,
        note_application: baseline.requires_fresh_work5_question
          ? 'PRIOR_RECORD_CONFLICT_VISIBLE_NOT_AUTHORITY'
          : baseline.repair_membership === 'CONTROL'
            ? 'NO_REGRESSION_FROM_ACCEPTED_RESULT'
            : baseline.original_note !== null
              ? 'EVERY_SOURCE_FEATURE_IDENTIFIED_BY_VERBATIM_NOTE_MUST_BE_ACCOUNTED_FOR_IN_TYPED_FACT_EXPRESSION_DEPENDENCY_OR_GOVERNED_DISPOSITION'
              : 'CLASS_INVARIANT_ONLY',
      },
    };
  };
  const families = inputs.rulingMap.record.families.map((family) => {
    const members = inputs.fixed.record.members.filter((item) => item.family_key === family.family_key)
      .map(memberFor);
    return {
      family_key: family.family_key,
      wave: family.wave,
      calibration_pack_binding: family.calibration_pack_binding,
      programme_question_mappings: family.question_mappings.map((mapping) => ({
        family_question_id: mapping.family_question_id,
        programme_question_id: mapping.programme_question_id,
        ruling_id: mapping.ruling_id,
        selection: mapping.selection,
        legal_rule: mapping.legal_rule,
      })),
      sample_members: members,
      legal_oracle_state: 'WORK1_EVIDENCE_ONLY_NOT_COMPLETENESS_AUTHORITY',
      executable_matcher_present: false,
      profile_set_binding_state: 'PENDING_WORK3_BEN_APPROVAL',
    };
  });
  const structureAmbiguityMembers = inputs.fixed.record.members
    .filter((item) => item.family_key === null)
    .map(memberFor);
  const allMembers = [
    ...families.flatMap((family) => family.sample_members),
    ...structureAmbiguityMembers,
  ];
  if (families.length !== 25 || allMembers.length !== 50
    || structureAmbiguityMembers.length !== 1
    || structureAmbiguityMembers[0].sample_ordinal !== 39
    || new Set(allMembers.map((item) => item.review_item_id)).size !== 50) {
    fail('SAMPLE_DRIFT', 'family packet coverage');
  }
  const unsigned = {
    schema_version: FAMILY_PACKET_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK1',
    state: 'LEGAL_EVIDENCE_ORACLE_NOT_EXECUTABLE_PROFILE_AUTHORITY',
    work0_evidence_root_binding: binding(WORK0_PATH, inputs.work0.bytes, inputs.work0.record),
    fixed_sample_identity_binding: binding(FIXED_SAMPLE_PATH, inputs.fixed.bytes, inputs.fixed.record),
    repair_baseline_binding: binding(BASELINE_PATH, inputs.baseline.bytes, inputs.baseline.record),
    calibration_ruling_map_binding: binding(RULING_MAP_PATH, inputs.rulingMap.bytes, inputs.rulingMap.record),
    lawyer_review_packet_binding: binding(REVIEW_PACKET_PATH, inputs.packet.bytes, inputs.packet.record),
    coverage: {
      ...inputs.packet.record.coverage,
      repair_item_count: inputs.baseline.record.counts.repair_items,
      control_item_count: inputs.baseline.record.counts.control_items,
      linked_point_count: LINKED_POINT_ORDINALS.length,
      linked_point_ordinals: LINKED_POINT_ORDINALS,
    },
    constraints: {
      exact_family_count: 25,
      exact_sample_count: 50,
      exact_structure_ambiguity_count: 1,
      contains_executable_matcher: false,
      can_assert_completeness: false,
      v1_role_relabelling_forbidden: true,
      every_sample_has_broad_and_family_subtype_question: true,
      substantive_notes_preserved_verbatim: true,
      focused_expectations_are_closed_and_testable: true,
    },
    families,
    structure_ambiguity_members: structureAmbiguityMembers,
  };
  return identify(unsigned, FAMILY_PACKET_SCHEMA, 'family_packet_set_digest', 'family_packet_set_id');
}

function loadInputs(repoRoot) {
  const inputs = {
    work0: readCanonical(repoRoot, WORK0_PATH),
    authority: readCanonical(repoRoot, AUTHORITY_PATH),
    activation: readCanonical(repoRoot, ACTIVATION_PATH),
    fixed: readCanonical(repoRoot, FIXED_SAMPLE_PATH),
    baseline: readCanonical(repoRoot, BASELINE_PATH),
    rulingMap: readCanonical(repoRoot, RULING_MAP_PATH),
    packet: readCanonical(repoRoot, REVIEW_PACKET_PATH),
    correctionAuthority: readOptionalCanonical(repoRoot, CORRECTION_AUTHORITY_PATH),
  };
  if (inputs.work0.record.evidence_root_id !== WORK0_ID
    || inputs.authority.record.authority_id !== AUTHORITY_ID
    || inputs.activation.record.activation_receipt_id !== ACTIVATION_ID) {
    fail('AUTHORITY_DRIFT', 'trust root');
  }
  verifyContentIdentity(inputs.work0.record, 'evidence_root_id');
  verifyContentIdentity(inputs.authority.record, 'authority_id', 'authority_digest');
  verifyContentIdentity(inputs.activation.record, 'activation_receipt_id', 'activation_receipt_digest');
  verifyContentIdentity(inputs.fixed.record, 'fixed_sample_identity_manifest_id');
  verifyContentIdentity(inputs.baseline.record, 'repair_baseline_ledger_id');
  verifyContentIdentity(inputs.rulingMap.record, 'calibration_question_ruling_map_id');
  const boundWork0 = inputs.authority.record.work0_evidence_root_binding;
  if (boundWork0?.path !== WORK0_PATH || boundWork0?.evidence_root_id !== WORK0_ID
    || boundWork0?.byte_length !== inputs.work0.bytes.length
    || boundWork0?.sha256 !== sha256Hex(inputs.work0.bytes)) {
    fail('AUTHORITY_DRIFT', 'Work0 evidence root binding');
  }
  assertWork0EvidenceBindings(inputs);
  validateCorrectionAuthority(repoRoot, inputs.correctionAuthority, inputs);
  return inputs;
}

function buildReceipt(repoRoot, inputs, contractPolicy, familyPacketSet) {
  const authorityPaths = effectiveWork1Paths(inputs);
  const commandLedger = work1CommandLedger(inputs);
  const generated = new Map([
    [CONTRACT_POLICY_PATH, canonicalBytes(contractPolicy)],
    [FAMILY_PACKET_PATH, canonicalBytes(familyPacketSet)],
  ]);
  const artifactBindings = authorityPaths.filter((repositoryPath) => repositoryPath !== RECEIPT_PATH)
    .map((repositoryPath) => {
      const bytes = generated.get(repositoryPath) ?? readBytes(repoRoot, repositoryPath);
      let record = null;
      if (repositoryPath.endsWith('.json')) {
        try { record = JSON.parse(bytes.toString('utf8')); } catch { record = null; }
      }
      return binding(repositoryPath, bytes, record);
    });
  const repositoryPrecondition = {
    proof_state: 'ORCHESTRATOR_VERIFIED_EXTERNAL_TO_FINALISER',
    observed_before_receipt: {
      branch: BRANCH,
      head_commit: ACTIVATION_COMMIT,
      staged_path_count: 0,
      worktree_delta_paths: authorityPaths.filter((repositoryPath) => !RECOVERY_TARGETS.includes(
        repositoryPath,
      )),
      generated_paths_absent: RECOVERY_TARGETS,
      authorised_delta_paths: authorityPaths,
      diff_check: 'PASS',
    },
    required_after_receipt: {
      post_finaliser_proof_required: true,
      branch: BRANCH,
      head_commit: ACTIVATION_COMMIT,
      staged_path_count: 0,
      worktree_delta_paths: authorityPaths,
      validator_argv: ['node', VALIDATOR_PATH],
      validator_run_count: 1,
    },
    required_commit_and_push: {
      exact_argv: exactCommitArgv(inputs, authorityPaths),
      run_count_each: 1,
      commit_parent: ACTIVATION_COMMIT,
      commit_delta_paths: authorityPaths,
      expected_commit_message: 'Define M7 V2 repair Work 1 contracts',
      required_origin_ref: `refs/remotes/origin/${BRANCH}`,
    },
  };
  const recovery = recoveryPrecondition(inputs);
  if (recovery) repositoryPrecondition.recovery = recovery;
  const unsigned = {
    schema_version: RECEIPT_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK1',
    state: 'PASS_WORK1_CONTRACTS',
    status: 'PASS',
    activation_commit_binding: {
      commit: ACTIVATION_COMMIT,
      branch: BRANCH,
      authority_activation_receipt_id: inputs.activation.record.activation_receipt_id,
    },
    work0_evidence_root_binding: binding(WORK0_PATH, inputs.work0.bytes, inputs.work0.record),
    work1_7_authority_binding: binding(AUTHORITY_PATH, inputs.authority.bytes, inputs.authority.record),
    activation_receipt_binding: binding(ACTIVATION_PATH, inputs.activation.bytes, inputs.activation.record),
    contract_policy_binding: binding(CONTRACT_POLICY_PATH, canonicalBytes(contractPolicy), contractPolicy),
    family_packet_set_binding: binding(FAMILY_PACKET_PATH, canonicalBytes(familyPacketSet), familyPacketSet),
    artifact_bindings: artifactBindings,
    artifact_set_digest: sha256Hex(canonicalJson(artifactBindings)),
    command_execution_ledger: commandLedger,
    drafting_command_audit: DRAFTING_COMMAND_AUDIT,
    combined_test_result: {
      argv: commandLedger[6].argv,
      status: 'PASS',
      test_file_count: 3,
    semantic_run_count: 12,
    },
    repository_precondition: repositoryPrecondition,
    counts: {
      family_count: 25,
      fixed_sample_count: 50,
      repair_item_count: 38,
      control_item_count: 12,
      calibration_question_count: 75,
      linked_point_count: 8,
      public_interface_count: 3,
      semantic_run_count: 0,
    },
    checks: CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })),
    effects: {
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      selector_changes: 0,
      serving_changes: 0,
      publication_changes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
      semantic_runs: 0,
    },
    next_work: {
      work2_authorised_under_parent_authority: true,
      work2_predecessor_pass_effective_only_after_exact_commit_push_origin_proof: true,
      work2_start_state_at_receipt_write: 'LOCKED_PENDING_WORK1_MILESTONE_PROOF',
      work2_execution_manifest_required_before_first_command: true,
      candidate_registration_required_before_work2_evidence_run: true,
      candidate_registration_created_in_work1: false,
      legal_profile_approvals_remain_reserved_to_ben: true,
    },
  };
  return identify(unsigned, RECEIPT_SCHEMA, 'work1_contract_receipt_digest', 'work1_contract_receipt_id');
}

function writeExclusive(repoRoot, repositoryPath, bytes) {
  const absolute = resolvePath(repoRoot, repositoryPath, true);
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(absolute,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
      0o644);
    created = true;
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (written <= 0) fail('WRITE_FAILED', repositoryPath);
      offset += written;
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    const parent = openSync(path.dirname(absolute), fsConstants.O_RDONLY | fsConstants.O_DIRECTORY);
    fsyncSync(parent);
    closeSync(parent);
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch {}
    }
    if (created) {
      try {
        unlinkSync(absolute);
        const parent = openSync(path.dirname(absolute), fsConstants.O_RDONLY | fsConstants.O_DIRECTORY);
        fsyncSync(parent);
        closeSync(parent);
      } catch {
        fail('ROLLBACK_FAILED', repositoryPath);
      }
    }
    if (error instanceof Work1FinalisationError) throw error;
    if (error.code === 'EEXIST') fail('OUTPUT_EXISTS', repositoryPath);
    fail('WRITE_FAILED', repositoryPath);
  }
}

function removeCreatedFile(repoRoot, repositoryPath) {
  const absolute = resolvePath(repoRoot, repositoryPath);
  unlinkSync(absolute);
  const parent = openSync(path.dirname(absolute), fsConstants.O_RDONLY | fsConstants.O_DIRECTORY);
  fsyncSync(parent);
  closeSync(parent);
}

export function finaliseWork1(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => !['repoRoot', 'write'].includes(key))) {
    fail('INVALID_OPTIONS');
  }
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const write = options.write ?? true;
  if (typeof repoRoot !== 'string' || typeof write !== 'boolean') fail('INVALID_OPTIONS');
  const requestedRoot = path.resolve(repoRoot);
  const root = realpathSync(requestedRoot);
  if (requestedRoot !== root) fail('PATH_INVALID', 'repository root contains a symlink');
  const inputs = loadInputs(root);
  if (write) assertRecoveryOutputsAbsent(root, inputs);
  const contractPolicy = buildContractPolicy(inputs);
  const familyPacketSet = buildFamilyPacketSet(inputs);
  const receipt = buildReceipt(root, inputs, contractPolicy, familyPacketSet);
  const outputs = [
    [CONTRACT_POLICY_PATH, canonicalBytes(contractPolicy)],
    [FAMILY_PACKET_PATH, canonicalBytes(familyPacketSet)],
    [RECEIPT_PATH, canonicalBytes(receipt)],
  ];
  if (write) {
    const created = [];
    try {
      for (const [repositoryPath, bytes] of outputs) {
        writeExclusive(root, repositoryPath, bytes);
        created.push(repositoryPath);
      }
    } catch (error) {
      const rollbackFailures = [];
      for (const repositoryPath of created.reverse()) {
        try { removeCreatedFile(root, repositoryPath); } catch { rollbackFailures.push(repositoryPath); }
      }
      if (rollbackFailures.length) fail('ROLLBACK_FAILED', rollbackFailures.join(','));
      if (inputs.correctionAuthority && error instanceof Work1FinalisationError) {
        if (error.code === 'OUTPUT_EXISTS') fail('RECOVERY_ALREADY_APPLIED');
        if (error.code === 'PATH_INVALID' || error.code === 'WRITE_FAILED') {
          fail('RECOVERY_OUTPUT_SAFETY');
        }
      }
      throw error;
    }
  }
  return {
    status: 'PASS_WORK1_FINALISATION',
    contract_policy_id: contractPolicy.contract_policy_id,
    family_packet_set_id: familyPacketSet.family_packet_set_id,
    work1_contract_receipt_id: receipt.work1_contract_receipt_id,
    outputs: outputs.map(([repositoryPath, bytes]) => ({
      path: repositoryPath,
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
    })),
  };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) fail('INVALID_ARGUMENTS');
  process.stdout.write(`${canonicalJson(finaliseWork1())}\n`);
}
