#!/usr/bin/env node
/**
 * Emit FINANCING_COVENANTS Phase 4 family profile package review authority from
 * the Phase 2 partition (five claim-scale profiles; no Phase 3 reference chain).
 *
 * Review flags are read back off the Phase 2 terminal registry so the schedule
 * records exactly the holds the source evidence supports.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import financingCovenantsAuthoring from '../lib/canonical-v2/m7-v2-financing-covenants-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA = financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_SCHEMA;
const OUT_PATH = financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_PATH;
const PHASE2_PATH = financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_PATH;
const MODULE_PATH = 'lib/canonical-v2/m7-v2-financing-covenants-authoring.js';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js';
const PROFILE_COUNT = financingCovenantsAuthoring.FINANCING_COVENANTS_PROFILE_COUNT;
const FLAGS = financingCovenantsAuthoring.FINANCING_COVENANTS_REVIEW_FLAGS;

const PHASE2_BINDING = Object.freeze({
  path: PHASE2_PATH,
  schema_version: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'financing_covenants_authoring_phase2_authority_id',
  record_id: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_ID,
  byte_length: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_BYTES,
  sha256: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_SHA256,
});

const PROPOSED_VALIDATION_EXACT_KEYS = Object.freeze([
  'extraction_state',
  'issue_codes',
  'no_comparison_authority',
  'output_disposition',
  'source_quality',
]);

const SCHEDULE_ITEM_EXACT_KEYS = Object.freeze([
  'canonical_tuple',
  'm4_claim_ids',
  'missing_required_field_keys',
  'package_profile_key',
  'proposed_profile_key',
  'proposed_validation',
  'review_flags',
  'source_unit_keys',
]);

const PROFILE_EXACT_KEYS = Object.freeze([
  'authorised_component_ids',
  'canonical_tuple',
  'm4_claim_ids',
  'missing_required_field_keys',
  'package_profile_key',
  'proposed_profile_key',
  'proposed_validation',
  'review_flags',
  'source_unit_keys',
]);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function sourceEnvelope(binding) {
  return { binding: structuredClone(binding), record: readJson(binding.path) };
}

function compareStrings(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function phase2Fixture() {
  const financingCovenantsAuthoringPhase2Authority = sourceEnvelope(PHASE2_BINDING);
  const authority = financingCovenantsAuthoringPhase2Authority.record;
  const parents = authority.immutable_parent_bindings;
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
    financingCovenantsAuthoringPhase2Authority,
    governedSources: {
      baseContractPolicy: sourceEnvelope(parents.base_policy),
      temporalPhase1Authority: sourceEnvelope(parents.phase1),
      c3CorrectionAuthority: sourceEnvelope(parents.c3),
      work3Manifest: sourceEnvelope(parents.work3_manifest),
      familyRolePolicy: sourceEnvelope(parents.family_role_policy),
      calibrationPack: sourceEnvelope(parents.calibration_pack),
      agreementEvidenceByAgreementId,
    },
  };
}

function reviewFlagsForTerminal(terminal) {
  const flags = [FLAGS.LEGAL_GROUPING];
  if (terminal.calibration_provision_example_id === null) {
    flags.push(FLAGS.OUTSIDE_CALIBRATION);
  } else if (terminal.calibration_proposed_subtype !== terminal.classification_bucket) {
    flags.push(FLAGS.SUBTYPE_DIVERGENCE);
  }
  return flags.sort(compareStrings);
}

function buildSchedule(phase2Proposal, terminalsBySourceUnitKey) {
  const profiles = [...phase2Proposal.proposed_partition.proposed_profiles]
    .sort((left, right) => compareStrings(
      left.proposed_profile_key,
      right.proposed_profile_key,
    ));
  return profiles.map((profile) => {
    const bucket = profile.canonical_tuple.classification_path[1];
    const terminal = terminalsBySourceUnitKey.get(profile.source_unit_keys[0]);
    if (!terminal) throw new Error(`no terminal for ${profile.source_unit_keys[0]}`);
    return {
      proposed_profile_key: profile.proposed_profile_key,
      package_profile_key: [
        'PROFILE',
        'FINANCING_COVENANTS',
        bucket,
        profile.proposed_profile_key,
      ].join(':'),
      canonical_tuple: profile.canonical_tuple,
      source_unit_keys: [...profile.source_unit_keys],
      m4_claim_ids: [...profile.m4_claim_ids],
      proposed_validation: {
        extraction_state: 'COMPLETE',
        source_quality: 'SUFFICIENT',
        output_disposition: 'REVIEW_ONLY',
        issue_codes: [],
        no_comparison_authority: null,
      },
      review_flags: reviewFlagsForTerminal(terminal),
      missing_required_field_keys: [],
    };
  });
}

function main() {
  const fixture = phase2Fixture();
  const phase2Proposal = financingCovenantsAuthoring
    .prepareFinancingCovenantsPhase2FamilyProposal(fixture);
  const terminalsBySourceUnitKey = new Map(
    fixture.financingCovenantsAuthoringPhase2Authority.record
      .source_terminal_successor_contract.terminal_rule_registry
      .map((terminal) => [terminal.source_unit_key, terminal]),
  );
  const profileReviewSchedule = buildSchedule(phase2Proposal, terminalsBySourceUnitKey);
  const scheduleBytes = Buffer.from(canonicalJson(profileReviewSchedule), 'utf8');
  if (profileReviewSchedule.length !== PROFILE_COUNT) {
    throw new Error(`Expected ${PROFILE_COUNT} profiles, got ${profileReviewSchedule.length}`);
  }
  const flagCount = (flag) => profileReviewSchedule.filter(
    (item) => item.review_flags.includes(flag),
  ).length;
  const legalGroupingFlagCount = flagCount(FLAGS.LEGAL_GROUPING);
  const subtypeDivergenceFlagCount = flagCount(FLAGS.SUBTYPE_DIVERGENCE);
  const outsideCalibrationFlagCount = flagCount(FLAGS.OUTSIDE_CALIBRATION);

  const firstLegalStop = {
    complete_profile_count: PROFILE_COUNT,
    current_required_disposition:
      'KEEP_ALL_5_PROPOSALS_UNAPPROVED_AND_REVIEW_ONLY_AT_PACKAGE_LEVEL',
    family_key: 'FINANCING_COVENANTS',
    first_legal_approval_boundary:
      'ONE_EXACT_PREASSIGNED_ID_WORK3_INVENTORY_ONLY_AFTER_BEN_SUBTYPE_GROUPING_AND_INVENTORY_SESSION',
    incomplete_profile_count: 0,
    outside_calibration_example_count: outsideCalibrationFlagCount,
    proposed_profile_count: PROFILE_COUNT,
    reason_code: 'SUBTYPE_GROUPING_AND_EXACT_PROFILE_INVENTORY_APPROVAL_PENDING',
    state: 'STOP_BEFORE_WORK3_PACKAGE_APPROVAL',
    subtype_partition_divergence_count: subtypeDivergenceFlagCount,
    work3_approval_payload_present: false,
  };

  const unsigned = {
    schema_version: SCHEMA,
    authority_classification:
      'TECHNICAL_REVIEW_CONSTRUCTION_ONLY_NO_WORK3_PACKAGE_APPROVAL_REGISTRATION_OR_ACTIVATION',
    authority_state:
      'TEMP_ONLY_ZERO_EFFECT_AUTHORITY_5_REVIEW_PROPOSALS_UNAPPROVED_AWAITING_BEN_INVENTORY',
    design_basis: {
      all_dependencies_in_process: true,
      approved_architecture:
        'PHASE2_PARTITION_DIRECT_PACKAGE_REVIEW_FACADE_NO_PHASE3_REFERENCE_CHAIN',
      caller_produced_phase2_candidate_accepted: false,
      new_legal_ruling_count: 0,
      output_is_ephemeral_and_review_only_at_package_level: true,
      phase3_reference_materialisation_skipped: true,
      phase3_skip_basis: 'ALL_CALIBRATION_PROVISION_EXAMPLES_HAVE_EMPTY_M3_DEPENDENCY_IDS',
      public_facade: 'prepareFinancingCovenantsFamilyProfilePackageReview',
      public_input_key_count: 3,
    },
    immutable_parent_bindings: {
      financing_covenants_authoring_phase2_authority: PHASE2_BINDING,
    },
    implementation_contract: {
      caller_produced_candidate_input_forbidden: true,
      candidate_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
      deep_frozen_non_aliasing_output: true,
      error_precedence: [
        {
          code: 'M7_V2_FINANCING_COVENANTS_PHASE4_REVIEW_CONTRACT',
          condition: 'NULL_NON_OBJECT_MISSING_EXTRA_OR_REORDERED_OUTER_INPUT_KEYS',
          order: 1,
        },
        {
          code: 'M7_V2_FINANCING_COVENANTS_PHASE4_REVIEW_AUTHORITY',
          condition: 'AUTHORITY_ENVELOPE_BINDING_PHYSICAL_BYTES_SELF_ID_OR_PARENT_PIN_DRIFT',
          order: 2,
        },
        {
          code: 'M7_V2_FINANCING_COVENANTS_PHASE4_PHASE2_PROPOSAL',
          condition: 'FRESH_PHASE2_PROPOSAL_FAILS_OR_5_PROFILE_BINDING_DRIFTS',
          order: 3,
        },
        {
          code: 'M7_V2_FINANCING_COVENANTS_PHASE4_PROFILE_SCHEDULE',
          condition: 'TUPLE_PROFILE_SOURCE_CLAIM_OR_PROFILE_ORDER_DRIFT',
          order: 4,
        },
        {
          code: 'M7_V2_FINANCING_COVENANTS_PHASE4_REVIEW_OUTPUT',
          condition: 'OUTPUT_SHAPE_ID_ACCOUNTING_FORBIDDEN_KEY_FREEZE_OR_NON_ALIASING_DRIFT',
          order: 5,
        },
      ],
      exact_outer_input_keys: [
        'financingCovenantsAuthoringPhase4FamilyProfilePackageReviewAuthority',
        'financingCovenantsAuthoringPhase2Authority',
        'governedSources',
      ],
      exported_function: 'prepareFinancingCovenantsFamilyProfilePackageReview',
      module_path: MODULE_PATH,
      phase2_internal_function: 'prepareFinancingCovenantsPhase2FamilyProposal',
      phase3_internal_function: null,
    },
    profile_review_schedule_contract: {
      canonical_tuple_base_exact_keys: [
        'classification_path',
        'required_expression_signature',
      ],
      exact_complete_profile_count: PROFILE_COUNT,
      exact_incomplete_profile_count: 0,
      exact_profile_count: PROFILE_COUNT,
      legal_grouping_review_flag_count: legalGroupingFlagCount,
      outside_calibration_example_flag_count: outsideCalibrationFlagCount,
      proposed_validation_exact_keys: [...PROPOSED_VALIDATION_EXACT_KEYS],
      schedule_canonical_json_byte_length: scheduleBytes.length,
      schedule_canonical_json_sha256: sha256Hex(scheduleBytes),
      schedule_item_exact_keys: [...SCHEDULE_ITEM_EXACT_KEYS],
      subtype_partition_divergence_flag_count: subtypeDivergenceFlagCount,
    },
    profile_review_schedule: profileReviewSchedule,
    candidate_output_contract: {
      candidate_state: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_CANDIDATE_STATE,
      exact_keys: [
        ...financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_REVIEW_OUTPUT_KEYS,
      ],
      family_key: 'FINANCING_COVENANTS',
      first_legal_stop: firstLegalStop,
      phase2_profile_fields_rule:
        'COPY_PROPOSED_PROFILE_KEY_CANONICAL_TUPLE_SOURCE_UNITS_M4_CLAIMS_AND_AUTHORISED_COMPONENT_IDS_FROM_THE_FRESH_PHASE2_PROPOSAL',
      profile_approval_state: 'UNAPPROVED',
      profile_exact_keys: [...PROFILE_EXACT_KEYS],
      profile_order: 'PROPOSED_PROFILE_KEY_ASCII',
      proposed_validation_exact_keys: [...PROPOSED_VALIDATION_EXACT_KEYS],
      record_id_field: 'review_candidate_id',
      review_accounting_exact_values: {
        complete_profile_count: PROFILE_COUNT,
        incomplete_profile_count: 0,
        legal_grouping_review_flag_count: legalGroupingFlagCount,
        outside_calibration_example_flag_count: outsideCalibrationFlagCount,
        proposed_profile_count: PROFILE_COUNT,
        review_only_profile_count: PROFILE_COUNT,
        subtype_partition_divergence_flag_count: subtypeDivergenceFlagCount,
        work3_identity_count: 0,
      },
      schema_version:
        financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_CANDIDATE_SCHEMA,
      unresolved_items: [
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'FINANCING_COVENANTS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
        FLAGS.LEGAL_GROUPING,
        FLAGS.OUTSIDE_CALIBRATION,
        FLAGS.SUBTYPE_DIVERGENCE,
      ].sort(compareStrings),
      withheld_work3_fields: [
        'work3_profile_id',
        'work3_package_id',
        'work3_registration_id',
        'work3_activation_id',
        'work3_fixture_fact_id',
      ],
    },
    first_legal_stop_contract: firstLegalStop,
    forbidden_output_contract: {
      recursively_forbidden_candidate_keys: [
        'work3_profile_id',
        'work3_package_id',
        'work3_registration_id',
        'work3_activation_id',
        'work3_fixture_fact_id',
        'work3_identity',
        'reference_value_materialisation_candidate_reference',
        'reference_value_reviews',
      ],
    },
    execution_schedule: {
      allowed_paths: [OUT_PATH, PHASE2_PATH, MODULE_PATH, TEST_PATH],
      execution_count_in_this_temp_authority_construction: 1,
      focused_test_name:
        'Phase4 FINANCING_COVENANTS family profile package review returns unapproved proposals without Work3 identities',
      prerequisite_binding: PHASE2_BINDING,
      prerequisite_state:
        'PHASE2_PARTITION_GREEN_5_PROFILES_5_M4_CLAIMS_0_SILENT_AS_PHASE4_PARENT',
      state: 'READY_FOR_ONE_USE_RED_GREEN',
      stop_conditions: [
        'PHASE2_AUTHORITY_PHYSICAL_CANONICAL_SELF_SEAL_OR_PHASE4_PARENT_PIN_FAILS',
        'PROFILE_REVIEW_SCHEDULE_CANONICAL_JSON_DIGEST_DRIFT',
        'OUTPUT_CANDIDATE_EMITS_WORK3_IDENTITY_OR_REFERENCE_MATERIALISATION_FIELDS',
      ],
    },
    zero_effect_boundary: {
      activation_count: 0,
      approval_count: 0,
      database_write_count: 0,
      family_package_count: 0,
      governed_command_execution_count: 0,
      network_read_count: 0,
      network_write_count: 0,
      product_write_count: 0,
      registration_count: 0,
      repository_write_count: 0,
      review_proposal_count: PROFILE_COUNT,
      work3_fixture_fact_count: 0,
      work3_identity_count: 0,
    },
  };

  const recordId = contentId(SCHEMA, unsigned);
  const record = {
    ...unsigned,
    financing_covenants_authoring_phase4_family_profile_package_review_authority_id: recordId,
  };
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  writeFileSync(path.join(REPO_ROOT, OUT_PATH), bytes);

  process.stdout.write(`${JSON.stringify({
    path: OUT_PATH,
    schema_version: SCHEMA,
    record_id_field:
      'financing_covenants_authoring_phase4_family_profile_package_review_authority_id',
    record_id: recordId,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    profile_count: profileReviewSchedule.length,
    schedule_sha256: sha256Hex(scheduleBytes),
    legal_grouping_flag_count: legalGroupingFlagCount,
    subtype_divergence_flag_count: subtypeDivergenceFlagCount,
    outside_calibration_flag_count: outsideCalibrationFlagCount,
  }, null, 2)}\n`);
}

main();
