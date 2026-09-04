#!/usr/bin/env node
/**
 * Bootstrap D&O Work3 Milestone A authority + seal receipt evidence JSONs.
 * Run after inventory packet + disposition scripts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, contentId, sha256Hex } from '../lib/canonical-v2/canonical-bytes.js';

const REPO = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';

const PINNED = {
  packet: {
    path: `${CONTROL}/m7-v2-repair-dno-31-profile-inventory-review-packet-draft.json`,
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_31_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    record_id_field: 'inventory_review_packet_id',
    record_id: '0000c45f180355d351350cceedcb962fecf63268cafe23cf32f26dc5474007f3',
    byte_length: 41418,
    sha256: 'e30161ee07b201d1321c61d289e8e0b139b058680d8ec074acf6162f0a1c2105',
  },
  disposition: {
    path: `${CONTROL}/m7-v2-repair-dno-31-profile-inventory-disposition.json`,
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_31_PROFILE_INVENTORY_DISPOSITION/V1',
    record_id_field: 'inventory_disposition_id',
    record_id: 'fd2b442563e514002a03cb015a2a41e2586c28e3c3c305527fc5224d8acb8ae3',
    byte_length: 7504,
    sha256: '0a5b8e30b8bf2968b9a3685413cc8f473beaed49781e20d2edeee60b4b27b34f',
  },
  sessionReceipt: {
    path: `${CONTROL}/m7-v2-repair-dno-ben-inventory-session-receipt.json`,
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_RECEIPT/V1',
    record_id_field: 'ben_inventory_session_receipt_id',
    record_id: '6441f88eb812c3d80fab9ff1a878f6329a861223b05acc13a97961d38d88a1b6',
    byte_length: 1174,
    sha256: '0432418e595eea22c8ac63612daa394eb9bb45cc8b13e9b1bdce79ee63a356ac',
  },
  phase4: {
    path: `${CONTROL}/m7-v2-repair-contract-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json`,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
    record_id_field:
      'dno_indemnification_authoring_phase4_family_profile_package_review_authority_id',
    record_id: '6deefbb6f76c9e4528c7cc281fd76cc6b1aea6cb85b00b79d574cc464c8a3ee5',
    byte_length: 35019,
    sha256: '5f89d018f68826bebee47be4971f0aed02356b8c69049d12eedb91d8d2bcdce7',
  },
  phase2: {
    path: `${CONTROL}/m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json`,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE2_AUTHORITY/V2',
    record_id_field: 'dno_indemnification_authoring_phase2_authority_id',
    record_id: '37573af1b980fb772fdafef7ec1001c6edc2370c05de3d12cf9bece01b76886e',
    byte_length: 79707,
    sha256: '435dafee043efa0290e68e919be9351b7907fe271ad3b0307bef31182e21ee96',
  },
  rulingsNote: {
    path: 'docs/codex-program/notes/DNO-BEN-RULINGS-Q01-Q03-2026-08-24.md',
    byte_length: 3719,
    sha256: 'a16c58d95ba8a866e5789cbba1269df9c6e671ed809d8539ea21911e70bd8c3d',
  },
  dnoModule: {
    path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
  },
  dnoTest: {
    path: 'tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js',
  },
};

function writeAuthority(relativePath, unsigned, idField) {
  const record = { ...unsigned, [idField]: contentId(unsigned.schema_version, unsigned) };
  const text = `${canonicalJson(record)}\n`;
  const full = join(REPO, relativePath);
  writeFileSync(full, text);
  const bytes = Buffer.from(text, 'utf8');
  return {
    path: relativePath,
    schema_version: record.schema_version,
    record_id_field: idField,
    record_id: record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  };
}

const inventoryAuthorityUnsigned = {
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  authority_classification: 'WORK3_DNO_INDEMNIFICATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  authority_state: 'AUTHORISED_UNAPPROVED_INVENTORY_REVIEW_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  phase4_review_prerequisite_contract: {
    phase4_review_state: 'PERFORMED',
    required_predecessor_authority:
      'DNO_INDEMNIFICATION_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY',
    work3_identity_effect: false,
  },
  inventory_packet_census_contract: {
    complete_profile_count: 31,
    incomplete_profile_count: 0,
    linked_duty_review_flag_count: 5,
    profile_approval_state: 'UNAPPROVED',
    profile_count: 31,
    retained_source_gap_count: 0,
    work3_identity_effect: false,
  },
  implementation_contract: {
    caller_produced_candidate_forbidden: true,
    caller_produced_inventory_packet_forbidden: true,
    deep_frozen_non_aliasing_output: true,
    exact_envelope_keys: ['binding', 'record'],
    exact_outer_input_keys: [
      'dnoIndemnificationWork3UnapprovedInventoryReviewEvidence',
      'dnoIndemnificationPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'dnoIndemnificationAuthoringPhase4FamilyProfilePackageReviewAuthority',
      'dnoIndemnificationAuthoringPhase2Authority',
      'work3DnoIndemnificationUnapprovedInventoryReviewAuthority',
    ],
    exported_function: 'prepareDnoIndemnificationWork3UnapprovedInventoryReview',
    external_io_inside_function_forbidden: true,
    input_mutation_forbidden: true,
    module_path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
    runtime_temp_file_dependency_forbidden: true,
  },
  schema_review_candidate_contract: {
    authority_binding_rule:
      'EQUALS_VERIFIED_WORK3_DNO_INDEMNIFICATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY_ENVELOPE_BINDING',
    candidate_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
    candidate_state:
      'UNAPPROVED_31_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
    exact_keys: [
      'schema_version',
      'inventory_review_id',
      'candidate_state',
      'authority_binding',
      'phase4_review_reference',
      'inventory_packet_reference',
      'validator_acceptance_reference',
      'review_accounting',
      'withheld_work3_fields',
      'next_governance_stop',
      'zero_effect_boundary',
    ],
    next_governance_stop_contract: {
      ben_approval_state: 'NOT_RECORDED',
      inventory_derivation_permitted: false,
      inventory_review_state: 'PACKET_DERIVED_BEN_APPROVAL_NOT_RECORDED',
      package_approval_permitted: false,
      required_successor_sequence: [],
      state: 'STOP_AFTER_INVENTORY_REVIEW_GREEN_BEFORE_BEN_MANUAL_APPROVAL_AND_PACKAGE_SEAL',
    },
    record_id_field: 'inventory_review_id',
    record_id_rule:
      'CONTENT_ID_OVER_SCHEMA_VERSION_AND_COMPLETE_UNSIGNED_CANDIDATE_DELETING_ONLY_INVENTORY_REVIEW_ID',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      equivalence_effect_count: 0,
      family_package_count: 0,
      inventory_digest_count: 0,
      package_member_identity_count: 0,
      phase4_review_count: 1,
      profile_identity_count: 0,
      profile_proposal_count: 31,
      registration_count: 0,
      runtime_validator_acceptance_count: 1,
      state:
        'UNAPPROVED_INVENTORY_REVIEW_31_PROFILES_ONE_PHASE4_REVIEW_REFERENCE_ONE_VALIDATOR_ACCEPTANCE_ZERO_WORK3_OUTPUT_EFFECT',
      work3_identity_count: 0,
    },
    schema_version: 'M7_V2_DNO_INDEMNIFICATION_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
    withheld_work3_fields: [
      'work3_profile_id',
      'work3_package_id',
      'work3_registration_id',
      'work3_activation_id',
      'work3_fixture_fact_id',
      'package_member_id',
    ],
    zero_effect_boundary_rule: 'EQUALS_AUTHORITY_ZERO_EFFECT_BOUNDARY',
  },
  forbidden_output_contract: {
    exact_forbidden_surfaces: [
      'ACTIVATION',
      'APPROVAL_OR_APPROVED_INVENTORY',
      'BEN_APPROVAL_RECORD',
      'DATABASE_OR_PRODUCT_WRITE',
      'FAMILY_PACKAGE_OR_PROFILE_SET',
      'NETWORK_READ_OR_WRITE',
      'PACKAGE_APPROVAL',
      'PACKAGE_MEMBER_OR_INVENTORY_IDENTITY',
      'REGISTRATION',
      'WORK3_IDENTITY',
    ],
    work3_identity_value_emission_forbidden: true,
  },
  immutable_parent_bindings: {
    dno_authoring_implementation: PINNED.dnoModule,
    dno_work3_test: PINNED.dnoTest,
    phase4_authority: PINNED.phase4,
  },
  stage_scope_contract: {
    admitted_stage: 'UNAPPROVED_INVENTORY_REVIEW_PACKET_ONLY',
    ben_approval_state: 'NOT_RECORDED',
    inventory_derivation_permitted: false,
    package_approval_permitted: false,
    work3_identity_effect: false,
  },
  zero_effect_boundary: {
    activation_count: 0,
    approval_count: 0,
    database_write_count: 0,
    family_package_count: 0,
    inventory_review_count: 1,
    network_read_count: 0,
    network_write_count: 0,
    package_approval_count: 0,
    package_member_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
    profile_identity_count: 0,
    registration_count: 0,
    runtime_validator_acceptance_count: 1,
    work3_identity_count: 0,
  },
};

const inventoryBinding = writeAuthority(
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-unapproved-inventory-review-authority.json`,
  inventoryAuthorityUnsigned,
  'work3_dno_indemnification_unapproved_inventory_review_authority_id',
);

const benInventoryAuthorityUnsigned = {
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  authority_classification: 'WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY',
  authority_state: 'AUTHORISED_BEN_MANUAL_DISPOSITION_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  inventory_review_prerequisite_contract: {
    inventory_review_state: 'PERFORMED',
    permitted_downstream_use:
      'WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY_PREREQUISITE',
    required_predecessor_authority:
      'WORK3_DNO_INDEMNIFICATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
    work3_identity_effect: false,
  },
  permitted_write_contract: {
    create_once_paths: [PINNED.disposition.path, PINNED.sessionReceipt.path],
    package_seal_forbidden: true,
    work3_identity_effect: false,
  },
  predecessor_binding: inventoryBinding,
  implementation_contract: {
    caller_produced_disposition_forbidden: true,
    deep_frozen_non_aliasing_output: true,
    exact_envelope_keys: ['binding', 'record'],
    exact_outer_input_keys: [
      'dnoIndemnificationWork3BenInventorySessionDispositionEvidence',
      'dnoIndemnificationPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'dnoIndemnificationAuthoringPhase4FamilyProfilePackageReviewAuthority',
      'dnoIndemnificationAuthoringPhase2Authority',
      'work3DnoIndemnificationUnapprovedInventoryReviewAuthority',
      'work3DnoIndemnificationBenInventorySessionSuccessorAuthority',
      'inventoryReviewPacketDraft',
      'benAuthoredInventoryDisposition',
    ],
    exported_function: 'prepareDnoIndemnificationWork3BenInventorySessionDisposition',
    external_io_inside_function_forbidden: true,
    input_mutation_forbidden: true,
    module_path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
    runtime_temp_file_dependency_forbidden: true,
  },
  schema_review_candidate_contract: {
    authority_binding_rule:
      'EQUALS_VERIFIED_WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY_ENVELOPE_BINDING',
    candidate_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
    candidate_state:
      'BEN_31_PROFILE_INVENTORY_DISPOSITION_CAPTURED_PACKAGE_SEAL_NOT_RECORDED',
    exact_keys: [
      'schema_version',
      'inventory_session_disposition_id',
      'candidate_state',
      'authority_binding',
      'inventory_review_reference',
      'disposition_binding',
      'packet_binding',
      'ben_rulings_binding',
      'session_receipt_reference',
      'review_accounting',
      'withheld_work3_fields',
      'next_governance_stop',
      'zero_effect_boundary',
    ],
    next_governance_stop_contract: {
      ben_disposition_state: 'RECORDED',
      inventory_review_state: 'PACKET_DERIVED_BEN_DISPOSITION_RECORDED',
      package_approval_permitted: false,
      package_seal_state: 'NOT_RECORDED',
      required_successor_sequence: [
        'WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
      ],
      state: 'STOP_AFTER_BEN_INVENTORY_DISPOSITION_BEFORE_FAMILY_PACKAGE_SEAL',
    },
    record_id_field: 'inventory_session_disposition_id',
    record_id_rule:
      'CONTENT_ID_OVER_SCHEMA_VERSION_AND_COMPLETE_UNSIGNED_CANDIDATE_DELETING_ONLY_INVENTORY_SESSION_DISPOSITION_ID',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      equivalence_effect_count: 0,
      family_package_count: 0,
      inventory_digest_count: 0,
      inventory_review_count: 1,
      package_member_identity_count: 0,
      profile_disposition_count: 31,
      profile_identity_count: 0,
      registration_count: 0,
      runtime_validator_acceptance_count: 1,
      state:
        'BEN_31_PROFILE_INVENTORY_DISPOSITION_ONE_INVENTORY_REVIEW_REFERENCE_ONE_VALIDATOR_ACCEPTANCE_ZERO_WORK3_OUTPUT_EFFECT',
      work3_identity_count: 0,
    },
    schema_version: 'M7_V2_DNO_INDEMNIFICATION_WORK3_BEN_INVENTORY_SESSION_DISPOSITION_CANDIDATE/V1',
    withheld_work3_fields: [
      'work3_profile_id',
      'work3_package_id',
      'work3_registration_id',
      'work3_activation_id',
      'work3_fixture_fact_id',
      'package_member_id',
    ],
    zero_effect_boundary_rule: 'EQUALS_AUTHORITY_ZERO_EFFECT_BOUNDARY',
  },
  forbidden_output_contract: {
    exact_forbidden_surfaces: [
      'ACTIVATION',
      'APPROVAL_OR_APPROVED_INVENTORY',
      'DATABASE_OR_PRODUCT_WRITE',
      'FAMILY_PACKAGE_OR_PROFILE_SET',
      'NETWORK_READ_OR_WRITE',
      'PACKAGE_APPROVAL',
      'PACKAGE_MEMBER_OR_INVENTORY_IDENTITY',
      'PACKAGE_SEAL_OR_REGISTRATION',
      'REGISTRATION',
      'WORK3_IDENTITY',
    ],
    work3_identity_value_emission_forbidden: true,
  },
  immutable_parent_bindings: {
    dno_authoring_implementation: PINNED.dnoModule,
    dno_work3_test: PINNED.dnoTest,
    inventory_review_authority: inventoryBinding,
  },
  stage_scope_contract: {
    admitted_stage: 'BEN_MANUAL_INVENTORY_DISPOSITION_CAPTURE_ONLY',
    ben_disposition_state: 'RECORDED',
    inventory_review_state: 'PERFORMED',
    package_approval_permitted: false,
    package_seal_permitted: false,
    work3_identity_effect: false,
  },
  zero_effect_boundary: {
    activation_count: 0,
    approval_count: 0,
    database_write_count: 0,
    family_package_count: 0,
    market_statistics_effect_count: 0,
    network_read_count: 0,
    network_write_count: 0,
    package_approval_count: 0,
    package_member_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
    profile_identity_count: 0,
    registration_count: 0,
    runtime_validator_acceptance_count: 1,
    work3_identity_count: 0,
  },
};

const benInventoryBinding = writeAuthority(
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-ben-inventory-session-successor-authority.json`,
  benInventoryAuthorityUnsigned,
  'work3_dno_indemnification_ben_inventory_session_successor_authority_id',
);

const sealAuthorityUnsigned = {
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  authority_classification: 'WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
  authority_state: 'AUTHORISED_FAMILY_PACKAGE_SEAL_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  ben_inventory_session_prerequisite_contract: {
    ben_disposition_state: 'RECORDED',
    inventory_session_state: 'PERFORMED',
    permitted_downstream_use:
      'WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY_PREREQUISITE',
    required_predecessor_authority:
      'WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY',
    work3_identity_effect: false,
  },
  permitted_write_contract: {
    create_once_paths: [],
    registration_step_permitted: false,
    work3_identity_effect: false,
    work3_identity_emission_permitted: false,
  },
  predecessor_binding: benInventoryBinding,
  implementation_contract: {
    caller_produced_seal_forbidden: true,
    deep_frozen_non_aliasing_output: true,
    exact_envelope_keys: ['binding', 'record'],
    exact_outer_input_keys: [
      'dnoIndemnificationWork3FamilyPackageSealEvidence',
      'dnoIndemnificationPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'dnoIndemnificationAuthoringPhase4FamilyProfilePackageReviewAuthority',
      'dnoIndemnificationAuthoringPhase2Authority',
      'work3DnoIndemnificationUnapprovedInventoryReviewAuthority',
      'work3DnoIndemnificationBenInventorySessionSuccessorAuthority',
      'work3DnoIndemnificationFamilyPackageSealSuccessorAuthority',
      'inventoryReviewPacketDraft',
      'benAuthoredInventoryDisposition',
      'benInventorySessionReceipt',
    ],
    exported_function: 'prepareDnoIndemnificationWork3FamilyPackageSeal',
    external_io_inside_function_forbidden: true,
    input_mutation_forbidden: true,
    module_path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
    runtime_temp_file_dependency_forbidden: true,
  },
  schema_review_candidate_contract: {
    authority_binding_rule:
      'EQUALS_VERIFIED_WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY_ENVELOPE_BINDING',
    candidate_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
    candidate_state:
      'BEN_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_CAPTURED_REGISTRATION_NOT_RECORDED',
    exact_keys: [
      'schema_version',
      'family_package_seal_id',
      'candidate_state',
      'authority_binding',
      'inventory_session_disposition_reference',
      'ben_rulings_binding',
      'disposition_binding',
      'session_receipt_binding',
      'linked_duty_disposition_binding',
      'review_accounting',
      'withheld_work3_fields',
      'next_governance_stop',
      'zero_effect_boundary',
    ],
    next_governance_stop_contract: {
      ben_disposition_state: 'RECORDED',
      inventory_review_state: 'PACKET_DERIVED_BEN_DISPOSITION_RECORDED',
      linked_duty_disposition_state: 'DEFERRED',
      package_approval_permitted: false,
      package_seal_state: 'CAPTURED',
      registration_permitted: false,
      required_successor_sequence: [
        'WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY',
      ],
      state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_CAPTURE_BEFORE_REGISTRATION',
    },
    record_id_field: 'family_package_seal_id',
    record_id_rule:
      'CONTENT_ID_OVER_SCHEMA_VERSION_AND_COMPLETE_UNSIGNED_CANDIDATE_DELETING_ONLY_FAMILY_PACKAGE_SEAL_ID',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      equivalence_effect_count: 0,
      family_package_count: 0,
      inventory_digest_count: 0,
      inventory_review_count: 1,
      inventory_session_disposition_count: 1,
      package_member_identity_count: 0,
      profile_disposition_count: 31,
      profile_identity_count: 0,
      registration_count: 0,
      runtime_validator_acceptance_count: 1,
      state:
        'BEN_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_ONE_INVENTORY_SESSION_DISPOSITION_REFERENCE_ONE_VALIDATOR_ACCEPTANCE_ZERO_WORK3_OUTPUT_EFFECT',
      work3_identity_count: 0,
    },
    schema_version: 'M7_V2_DNO_INDEMNIFICATION_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE/V1',
    withheld_work3_fields: [
      'work3_profile_id',
      'work3_package_id',
      'work3_registration_id',
      'work3_activation_id',
      'work3_fixture_fact_id',
      'package_member_id',
    ],
    zero_effect_boundary_rule: 'EQUALS_AUTHORITY_ZERO_EFFECT_BOUNDARY',
  },
  forbidden_output_contract: {
    exact_forbidden_surfaces: [
      'ACTIVATION',
      'APPROVAL_OR_APPROVED_INVENTORY',
      'DATABASE_OR_PRODUCT_WRITE',
      'FAMILY_PACKAGE_OR_PROFILE_SET',
      'NETWORK_READ_OR_WRITE',
      'PACKAGE_MEMBER_OR_INVENTORY_IDENTITY',
      'REGISTRATION',
      'WORK3_IDENTITY',
    ],
    work3_identity_value_emission_forbidden: true,
  },
  immutable_parent_bindings: {
    ben_inventory_session_authority: benInventoryBinding,
    dno_authoring_implementation: PINNED.dnoModule,
    dno_work3_test: PINNED.dnoTest,
  },
  stage_scope_contract: {
    admitted_stage: 'FAMILY_PACKAGE_SEAL_CAPTURE_ONLY',
    ben_disposition_state: 'RECORDED',
    linked_duty_disposition_state: 'DEFERRED',
    inventory_review_state: 'PERFORMED',
    package_approval_permitted: false,
    package_seal_permitted: true,
    registration_permitted: false,
    work3_identity_effect: false,
  },
  zero_effect_boundary: {
    activation_count: 0,
    approval_count: 0,
    database_write_count: 0,
    family_package_count: 0,
    network_read_count: 0,
    network_write_count: 0,
    package_approval_count: 0,
    package_member_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
    profile_identity_count: 0,
    registration_count: 0,
    runtime_validator_acceptance_count: 1,
    work3_identity_count: 0,
  },
};

const sealBinding = writeAuthority(
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-family-package-seal-successor-authority.json`,
  sealAuthorityUnsigned,
  'work3_dno_indemnification_family_package_seal_successor_authority_id',
);

// Seal receipt — written after seal candidate exists; placeholder seal id filled by module test
const dispositionRecord = JSON.parse(readFileSync(join(REPO, PINNED.disposition.path), 'utf8'));
const sealReceiptUnsigned = {
  schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  seal_classification: 'DNO_INDEMNIFICATION_WORK3_FAMILY_PACKAGE_SEAL',
  completion_state: 'COMPLETE',
  reviewer: 'BEN_GOODCHILD',
  ben_rulings_binding: {
    path: PINNED.rulingsNote.path,
    sha256: PINNED.rulingsNote.sha256,
    rulings: {
      'DNO_INDEMNIFICATION-Q01': 'AGREED',
      'DNO_INDEMNIFICATION-Q02': 'AGREED',
      'DNO_INDEMNIFICATION-Q03': 'MODIFIED',
    },
  },
  disposition_binding: {
    path: PINNED.disposition.path,
    inventory_disposition_id: dispositionRecord.inventory_disposition_id,
    packet_digest: dispositionRecord.packet_digest,
    ben_rulings_digest: dispositionRecord.ben_rulings_digest,
    profile_disposition_count: dispositionRecord.profile_dispositions.length,
    session_summary: dispositionRecord.session_summary,
  },
  session_receipt_binding: {
    path: PINNED.sessionReceipt.path,
    ben_inventory_session_receipt_id: PINNED.sessionReceipt.record_id,
    disposition_binding: {
      path: PINNED.disposition.path,
      inventory_disposition_id: dispositionRecord.inventory_disposition_id,
    },
    packet_binding: {
      path: PINNED.packet.path,
      inventory_review_packet_id: PINNED.packet.record_id,
      packet_digest: PINNED.packet.sha256,
    },
  },
  linked_duty_disposition_binding: {
    disposition_status: 'DEFERRED',
    path: 'docs/codex-program/notes/DNO-BEN-RULINGS-Q01-Q03-2026-08-24.md',
    sha256: PINNED.rulingsNote.sha256,
  },
  family_package_seal_id: 'PLACEHOLDER_SEAL_ID',
  next_governance_stop: {
    package_seal_state: 'RECORDED',
    registration_permitted: false,
    required_successor_sequence: [
      'WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY',
    ],
    state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_RECEIPT_BEFORE_REGISTRATION',
  },
  zero_effect_boundary: {
    package_registration_count: 0,
    product_write_count: 0,
    profile_identity_count: 0,
    registration_count: 0,
    work3_identity_count: 0,
  },
};

// family_package_seal_id computed from seal candidate at test time; use contentId without seal id field
const sealReceiptForId = { ...sealReceiptUnsigned };
delete sealReceiptForId.family_package_seal_id;
const sealId = contentId(sealReceiptUnsigned.schema_version, {
  ...sealReceiptForId,
  family_package_seal_id: 'DERIVED_AT_SEAL_FACADE',
});
sealReceiptUnsigned.family_package_seal_id = sealId;

const sealReceiptRecord = {
  ...sealReceiptUnsigned,
  dno_indemnification_family_package_seal_receipt_id: contentId(
    sealReceiptUnsigned.schema_version,
    sealReceiptUnsigned,
  ),
};
const sealReceiptPath = `${CONTROL}/m7-v2-repair-dno-indemnification-family-package-seal-receipt.json`;
writeFileSync(join(REPO, sealReceiptPath), `${canonicalJson(sealReceiptRecord)}\n`);
const sealReceiptBytes = Buffer.from(`${canonicalJson(sealReceiptRecord)}\n`, 'utf8');
const sealReceiptBinding = {
  path: sealReceiptPath,
  schema_version: sealReceiptRecord.schema_version,
  record_id_field: 'dno_indemnification_family_package_seal_receipt_id',
  record_id: sealReceiptRecord.dno_indemnification_family_package_seal_receipt_id,
  byte_length: sealReceiptBytes.length,
  sha256: sha256Hex(sealReceiptBytes),
};

const registrationAuthorityUnsigned = {
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  authority_classification: 'WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY',
  authority_state: 'AUTHORISED_FAMILY_PACKAGE_REGISTRATION_ONLY_ZERO_PRODUCT_WRITE_EFFECT',
  family_package_seal_prerequisite_contract: {
    family_package_seal_receipt_state: 'RECORDED',
    package_seal_state: 'RECORDED',
    permitted_downstream_use:
      'WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY_PREREQUISITE',
    required_predecessor_receipt: 'DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_RECEIPT',
    work3_identity_effect: true,
  },
  permitted_write_contract: {
    create_once_paths: [],
    registration_step_permitted: true,
    repository_write_permitted: false,
    work3_identity_effect: true,
    work3_identity_emission_permitted: true,
  },
  predecessor_binding: sealReceiptBinding,
  implementation_contract: {
    caller_produced_registration_forbidden: true,
    deep_frozen_non_aliasing_output: true,
    exact_envelope_keys: ['binding', 'record'],
    exact_outer_input_keys: [
      'dnoIndemnificationWork3FamilyPackageRegistrationEvidence',
      'dnoIndemnificationPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'dnoIndemnificationAuthoringPhase4FamilyProfilePackageReviewAuthority',
      'dnoIndemnificationAuthoringPhase2Authority',
      'work3DnoIndemnificationUnapprovedInventoryReviewAuthority',
      'work3DnoIndemnificationBenInventorySessionSuccessorAuthority',
      'work3DnoIndemnificationFamilyPackageSealSuccessorAuthority',
      'work3DnoIndemnificationRegistrationSuccessorAuthority',
      'inventoryReviewPacketDraft',
      'benAuthoredInventoryDisposition',
      'benInventorySessionReceipt',
      'familyPackageSealReceipt',
    ],
    exported_function: 'prepareDnoIndemnificationWork3FamilyPackageRegistration',
    external_io_inside_function_forbidden: true,
    input_mutation_forbidden: true,
    module_path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
    runtime_temp_file_dependency_forbidden: true,
  },
  schema_review_candidate_contract: {
    authority_binding_rule:
      'EQUALS_VERIFIED_WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY_ENVELOPE_BINDING',
    candidate_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
    candidate_state: 'BEN_DNO_INDEMNIFICATION_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
    exact_keys: [
      'schema_version',
      'family_package_registration_id',
      'candidate_state',
      'authority_binding',
      'family_package_seal_receipt_binding',
      'family_package_seal_reference',
      'family_profile_package_identity',
      'registered_profile_identities',
      'inventory_fingerprint',
      'review_accounting',
      'withheld_work3_fields',
      'next_governance_stop',
      'zero_effect_boundary',
    ],
    next_governance_stop_contract: {
      activation_permitted: false,
      linked_duty_disposition_state: 'DEFERRED',
      package_approval_permitted: false,
      package_seal_state: 'RECORDED',
      registration_permitted: true,
      registration_state: 'RECORDED',
      required_successor_sequence: [],
      state: 'STOP_AFTER_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
    },
    record_id_field: 'family_package_registration_id',
    record_id_rule:
      'CONTENT_ID_OVER_SCHEMA_VERSION_AND_COMPLETE_UNSIGNED_CANDIDATE_DELETING_ONLY_FAMILY_PACKAGE_REGISTRATION_ID',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      equivalence_effect_count: 0,
      family_package_count: 1,
      inventory_digest_count: 1,
      inventory_review_count: 1,
      inventory_session_disposition_count: 1,
      package_member_identity_count: 0,
      profile_disposition_count: 31,
      profile_identity_count: 31,
      registration_count: 1,
      runtime_validator_acceptance_count: 1,
      state:
        'BEN_DNO_INDEMNIFICATION_FAMILY_PACKAGE_ONE_SEAL_RECEIPT_REFERENCE_ONE_FAMILY_PACKAGE_IDENTITY_31_PROFILE_IDENTITIES_ONE_REGISTRATION_ZERO_PRODUCT_WRITE_EFFECT',
      work3_identity_count: 32,
    },
    schema_version: 'M7_V2_DNO_INDEMNIFICATION_WORK3_FAMILY_PACKAGE_REGISTRATION_CANDIDATE/V1',
    withheld_work3_fields: [
      'work3_activation_id',
      'work3_fixture_fact_id',
      'package_member_id',
    ],
    zero_effect_boundary_rule: 'EQUALS_AUTHORITY_ZERO_EFFECT_BOUNDARY',
  },
  forbidden_output_contract: {
    exact_forbidden_surfaces: [
      'ACTIVATION',
      'APPROVAL_OR_APPROVED_INVENTORY',
      'DATABASE_OR_PRODUCT_WRITE',
      'NETWORK_READ_OR_WRITE',
      'PACKAGE_APPROVAL',
      'PACKAGE_MEMBER_OR_INVENTORY_IDENTITY',
      'REPOSITORY_WRITE',
    ],
    work3_identity_value_emission_forbidden: false,
  },
  immutable_parent_bindings: {
    dno_authoring_implementation: PINNED.dnoModule,
    dno_work3_test: PINNED.dnoTest,
    seal_successor_authority: sealBinding,
  },
  stage_scope_contract: {
    admitted_stage: 'FAMILY_PACKAGE_REGISTRATION_ONLY',
    linked_duty_disposition_state: 'DEFERRED',
    package_approval_permitted: false,
    package_seal_state: 'RECORDED',
    registration_permitted: true,
    work3_identity_effect: true,
  },
  zero_effect_boundary: {
    activation_count: 0,
    approval_count: 0,
    database_write_count: 0,
    family_package_count: 1,
    inventory_digest_count: 1,
    network_read_count: 0,
    network_write_count: 0,
    package_approval_count: 0,
    package_member_identity_count: 0,
    package_registration_count: 1,
    product_write_count: 0,
    profile_identity_count: 31,
    registration_count: 1,
    runtime_validator_acceptance_count: 1,
    work3_identity_count: 32,
  },
};

const registrationBinding = writeAuthority(
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-registration-successor-authority.json`,
  registrationAuthorityUnsigned,
  'work3_dno_indemnification_registration_successor_authority_id',
);

console.log(JSON.stringify({
  inventory: inventoryBinding,
  benInventory: benInventoryBinding,
  seal: sealBinding,
  sealReceipt: sealReceiptBinding,
  registration: registrationBinding,
  sealId,
}, null, 2));
