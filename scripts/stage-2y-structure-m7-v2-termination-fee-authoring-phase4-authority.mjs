/**
 * Emit TERMINATION_FEE Phase 4 family profile package review authority from the
 * Phase 2 partition (20 comparator-derived profiles; no Phase 3 chain).
 *
 * Review flags are derived per row from the Phase 2 terminal registry, not
 * assigned by hand: a row is flagged for owner-family disposition when the
 * comparator resolution assigns it to another family, and for fee-side
 * disposition when its fee side is not the target side.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import terminationFeeAuthoring from '../lib/canonical-v2/m7-v2-termination-fee-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_FEE_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-fee-authoring-phase4-family-profile-package-review-authority.json';
const PHASE2_PATH = terminationFeeAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_PATH;
const PROFILE_COUNT = terminationFeeAuthoring.TERMINATION_FEE_PROFILE_COUNT;
const HOLD_COUNT = terminationFeeAuthoring.TERMINATION_FEE_WORK3_HOLD_COUNT;
const HOLD_FLAGS = terminationFeeAuthoring.TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS;

const PHASE2_BINDING = Object.freeze({
  path: PHASE2_PATH,
  schema_version: terminationFeeAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'termination_fee_authoring_phase2_authority_id',
  record_id: terminationFeeAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_ID,
  byte_length: terminationFeeAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_BYTES,
  sha256: terminationFeeAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_SHA256,
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

const OUTPUT_EXACT_KEYS = Object.freeze([
  'schema_version',
  'review_candidate_id',
  'family_key',
  'candidate_state',
  'profile_approval_state',
  'authority_binding',
  'phase2_proposal_reference',
  'proposed_profiles',
  'review_accounting',
  'unresolved_items',
  'withheld_work3_fields',
  'first_legal_stop',
  'zero_effect_boundary',
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

const UNRESOLVED_ITEMS = Object.freeze([
  'COMPARATOR_OWNER_FAMILY_ASSIGNMENT_UNRESOLVED',
  'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
  'FEE_SIDE_PARTITION_UNRESOLVED',
  'LEGAL_GROUPING_REVIEW_REQUIRED',
  'TERMINATION_FEE_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
]);

const WITHHELD_WORK3_FIELDS = Object.freeze([
  'work3_profile_id',
  'work3_package_id',
  'work3_registration_id',
  'work3_activation_id',
  'work3_fixture_fact_id',
]);

/** Buckets whose fee semantics reference a termination right owned by the sealed Termination package. */
const TERMINATION_LINK_ONLY_BUCKETS = Object.freeze(['FEE_AMOUNT', 'TAIL_FEE']);

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
  const terminationFeeAuthoringPhase2Authority = sourceEnvelope(PHASE2_BINDING);
  const parents = terminationFeeAuthoringPhase2Authority.record.immutable_parent_bindings;
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
    terminationFeeAuthoringPhase2Authority,
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

function terminalBySignature() {
  const authority = readJson(PHASE2_PATH);
  return new Map(
    authority.source_terminal_successor_contract.terminal_rule_registry.map(
      (terminal) => [terminal.required_expression_signature, terminal],
    ),
  );
}

function reviewFlagsForTerminal(terminal) {
  const member = terminal.source_closure.members[0];
  const flags = ['LEGAL_GROUPING_REVIEW_REQUIRED'];
  if (member.comparator_owner_family !== null) {
    flags.push('COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED');
    flags.push(`CROSS_FAMILY_LINK_ONLY_${member.comparator_owner_family}`);
    flags.push('SUPPLEMENTAL_RESOLUTION_PROVENANCE');
  }
  if (member.fee_side !== null && member.fee_side !== 'TARGET') {
    flags.push('FEE_SIDE_PARTITION_DISPOSITION_REQUIRED');
  }
  if (TERMINATION_LINK_ONLY_BUCKETS.includes(terminal.classification_bucket)) {
    flags.push('CROSS_FAMILY_LINK_ONLY_TERMINATION_RIGHT');
  }
  return flags.sort(compareStrings);
}

function buildSchedule(phase2Proposal) {
  const terminals = terminalBySignature();
  return [...phase2Proposal.proposed_partition.proposed_profiles]
    .sort((left, right) => compareStrings(
      left.proposed_profile_key,
      right.proposed_profile_key,
    ))
    .map((profile) => {
      const bucket = profile.canonical_tuple.classification_path[1];
      const terminal = terminals.get(profile.canonical_tuple.required_expression_signature);
      if (!terminal) {
        throw new Error(`no Phase2 terminal for ${profile.proposed_profile_key}`);
      }
      return {
        proposed_profile_key: profile.proposed_profile_key,
        package_profile_key: [
          'PROFILE',
          'TERMINATION_FEE',
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
  const phase2Proposal = terminationFeeAuthoring.prepareTerminationFeePhase2FamilyProposal(
    phase2Fixture(),
  );
  const profileReviewSchedule = buildSchedule(phase2Proposal);
  const scheduleBytes = Buffer.from(canonicalJson(profileReviewSchedule), 'utf8');
  const profileCount = profileReviewSchedule.length;
  if (profileCount !== PROFILE_COUNT) {
    throw new Error(`Expected ${PROFILE_COUNT} profiles, got ${profileCount}`);
  }
  const legalGroupingFlagCount = profileReviewSchedule.filter(
    (item) => item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'),
  ).length;
  const holdFlagCount = profileReviewSchedule.filter(
    (item) => item.review_flags.some((flag) => HOLD_FLAGS.includes(flag)),
  ).length;
  if (holdFlagCount !== HOLD_COUNT) {
    throw new Error(`Expected ${HOLD_COUNT} hold rows, got ${holdFlagCount}`);
  }

  const firstLegalStop = {
    complete_profile_count: profileCount,
    current_required_disposition:
      `KEEP_ALL_${profileCount}_PROPOSALS_UNAPPROVED_AND_REVIEW_ONLY_AT_PACKAGE_LEVEL`,
    family_key: 'TERMINATION_FEE',
    first_legal_approval_boundary:
      'ONE_EXACT_PREASSIGNED_ID_WORK3_INVENTORY_ONLY_AFTER_BEN_Q01_Q03_AND_INVENTORY_SESSION',
    incomplete_profile_count: 0,
    proposed_profile_count: profileCount,
    reason_code: 'BEN_Q01_Q03_AND_EXACT_PROFILE_INVENTORY_APPROVAL_PENDING',
    state: 'STOP_BEFORE_WORK3_PACKAGE_APPROVAL',
    subtype_partition_hold_row_count: holdFlagCount,
    work3_approval_payload_present: false,
  };

  const zeroEffectBoundary = {
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
    review_proposal_count: profileCount,
    work3_fixture_fact_count: 0,
    work3_identity_count: 0,
  };

  const unsigned = {
    schema_version: SCHEMA,
    authority_classification:
      'TECHNICAL_REVIEW_CONSTRUCTION_ONLY_NO_WORK3_PACKAGE_APPROVAL_REGISTRATION_OR_ACTIVATION',
    authority_state:
      `TEMP_ONLY_ZERO_EFFECT_AUTHORITY_${profileCount}_REVIEW_PROPOSALS_UNAPPROVED_AWAITING_BEN_INVENTORY`,
    design_basis: {
      all_dependencies_in_process: true,
      approved_architecture:
        'PHASE2_PARTITION_DIRECT_PACKAGE_REVIEW_FACADE_NO_PHASE3_REFERENCE_CHAIN',
      caller_produced_phase2_candidate_accepted: false,
      new_legal_ruling_count: 0,
      output_is_ephemeral_and_review_only_at_package_level: true,
      phase3_reference_materialisation_skipped: true,
      phase3_skip_basis:
        'ZERO_COMPARATOR_TERMINALS_CARRY_UNRESOLVED_M3_REFERENCE_OR_DEFINITION_DEPENDENCIES',
      public_facade: 'prepareTerminationFeeFamilyProfilePackageReview',
      public_input_key_count: 3,
      review_flag_derivation:
        'PER_ROW_FROM_PHASE2_TERMINAL_COMPARATOR_OWNER_FAMILY_AND_FEE_SIDE',
    },
    immutable_parent_bindings: {
      termination_fee_authoring_phase2_authority: PHASE2_BINDING,
    },
    implementation_contract: {
      caller_produced_candidate_input_forbidden: true,
      candidate_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
      deep_frozen_non_aliasing_output: true,
      error_precedence: [
        {
          code: 'M7_V2_TERMINATION_FEE_PHASE4_REVIEW_CONTRACT',
          condition: 'NULL_NON_OBJECT_MISSING_EXTRA_OR_REORDERED_OUTER_INPUT_KEYS',
          order: 1,
        },
        {
          code: 'M7_V2_TERMINATION_FEE_PHASE4_REVIEW_AUTHORITY',
          condition: 'AUTHORITY_ENVELOPE_BINDING_PHYSICAL_BYTES_SELF_ID_OR_PARENT_PIN_DRIFT',
          order: 2,
        },
        {
          code: 'M7_V2_TERMINATION_FEE_PHASE4_PHASE2_PROPOSAL',
          condition: `FRESH_PHASE2_PROPOSAL_FAILS_OR_${profileCount}_PROFILE_BINDING_DRIFTS`,
          order: 3,
        },
        {
          code: 'M7_V2_TERMINATION_FEE_PHASE4_PROFILE_SCHEDULE',
          condition: 'TUPLE_PROFILE_SOURCE_CLAIM_OR_PROFILE_ORDER_DRIFT',
          order: 4,
        },
        {
          code: 'M7_V2_TERMINATION_FEE_PHASE4_REVIEW_OUTPUT',
          condition: 'OUTPUT_SHAPE_ID_ACCOUNTING_FORBIDDEN_KEY_FREEZE_OR_NON_ALIASING_DRIFT',
          order: 5,
        },
      ],
      exact_outer_input_keys: [
        'terminationFeeAuthoringPhase4FamilyProfilePackageReviewAuthority',
        'terminationFeeAuthoringPhase2Authority',
        'governedSources',
      ],
      exported_function: 'prepareTerminationFeeFamilyProfilePackageReview',
      module_path: 'lib/canonical-v2/m7-v2-termination-fee-authoring.js',
      phase2_internal_function: 'prepareTerminationFeePhase2FamilyProposal',
      phase3_internal_function: null,
    },
    profile_review_schedule_contract: {
      canonical_tuple_base_exact_keys: [
        'classification_path',
        'required_expression_signature',
      ],
      exact_complete_profile_count: profileCount,
      exact_incomplete_profile_count: 0,
      exact_profile_count: profileCount,
      legal_grouping_review_flag_count: legalGroupingFlagCount,
      proposed_validation_exact_keys: [...PROPOSED_VALIDATION_EXACT_KEYS],
      schedule_canonical_json_byte_length: scheduleBytes.length,
      schedule_canonical_json_sha256: sha256Hex(scheduleBytes),
      schedule_item_exact_keys: [...SCHEDULE_ITEM_EXACT_KEYS],
      subtype_partition_hold_row_count: holdFlagCount,
    },
    profile_review_schedule: profileReviewSchedule,
    candidate_output_contract: {
      candidate_state: `REVIEW_ONLY_${profileCount}_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY`,
      exact_keys: [...OUTPUT_EXACT_KEYS],
      family_key: 'TERMINATION_FEE',
      first_legal_stop: firstLegalStop,
      phase2_profile_fields_rule:
        'COPY_PROPOSED_PROFILE_KEY_CANONICAL_TUPLE_SOURCE_UNITS_M4_CLAIMS_AND_AUTHORISED_COMPONENT_IDS_FROM_THE_FRESH_PHASE2_PROPOSAL',
      profile_approval_state: 'UNAPPROVED',
      profile_exact_keys: [...PROFILE_EXACT_KEYS],
      profile_order: 'PROPOSED_PROFILE_KEY_ASCII',
      proposed_validation_exact_keys: [...PROPOSED_VALIDATION_EXACT_KEYS],
      record_id_field: 'review_candidate_id',
      review_accounting_exact_values: {
        complete_profile_count: profileCount,
        incomplete_profile_count: 0,
        legal_grouping_review_flag_count: legalGroupingFlagCount,
        proposed_profile_count: profileCount,
        review_only_profile_count: profileCount,
        subtype_partition_hold_row_count: holdFlagCount,
        work3_identity_count: 0,
      },
      schema_version:
        'M7_V2_TERMINATION_FEE_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1',
      unresolved_items: [...UNRESOLVED_ITEMS],
      withheld_work3_fields: [...WITHHELD_WORK3_FIELDS],
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
      allowed_paths: [
        OUT_PATH,
        PHASE2_PATH,
        'lib/canonical-v2/m7-v2-termination-fee-authoring.js',
        'tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js',
      ],
      execution_count_in_this_temp_authority_construction: 1,
      focused_test_name:
        'Phase4 TERMINATION_FEE package review returns 20 unapproved proposals without Work3 identities',
      prerequisite_binding: PHASE2_BINDING,
      prerequisite_state:
        `PHASE2_PARTITION_GREEN_${profileCount}_PROFILES_${profileCount}_M4_CLAIMS_0_SILENT_AS_PHASE4_PARENT`,
      state: 'READY_FOR_ONE_USE_RED_GREEN',
      stop_conditions: [
        'PHASE2_AUTHORITY_PHYSICAL_CANONICAL_SELF_SEAL_OR_PHASE4_PARENT_PIN_FAILS',
        'PROFILE_REVIEW_SCHEDULE_CANONICAL_JSON_DIGEST_DRIFT',
        'OUTPUT_CANDIDATE_EMITS_WORK3_IDENTITY_OR_REFERENCE_MATERIALISATION_FIELDS',
      ],
    },
    zero_effect_boundary: zeroEffectBoundary,
  };

  const recordId = contentId(SCHEMA, unsigned);
  const record = {
    ...unsigned,
    termination_fee_authoring_phase4_family_profile_package_review_authority_id: recordId,
  };
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  writeFileSync(path.join(REPO_ROOT, OUT_PATH), bytes);

  process.stdout.write(
    `${JSON.stringify({
      path: OUT_PATH,
      schema_version: SCHEMA,
      record_id_field:
        'termination_fee_authoring_phase4_family_profile_package_review_authority_id',
      record_id: recordId,
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      profile_count: profileCount,
      hold_row_count: holdFlagCount,
      schedule_sha256: sha256Hex(scheduleBytes),
    }, null, 2)}\n`,
  );
}

main();
