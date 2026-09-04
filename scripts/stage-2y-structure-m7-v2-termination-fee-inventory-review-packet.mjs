#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import tfAuthoring from '../lib/canonical-v2/m7-v2-termination-fee-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-unapproved-inventory-review-authority.json`;
const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-termination-fee-20-profile-inventory-review-packet-draft.json`;
const AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1';
const PACKET_SCHEMA =
  'STAGE_2Y_M7_V2_TERMINATION_FEE_20_PROFILE_INVENTORY_REVIEW_PACKET/V1';
const SEALED_ROLE_SCHEMA_PATH = `${CONTROL}/family-role-schemas/TERMINATION_FEE.json`;
const PROFILE_COUNT = tfAuthoring.TERMINATION_FEE_PROFILE_COUNT;
const HOLD_FLAGS = tfAuthoring.TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS;

function read(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}

function binding(path, record, idField) {
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    byte_length: bytes.length,
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(bytes),
  };
}

function boundEnvelope(sourceBinding) {
  return { binding: structuredClone(sourceBinding), record: read(sourceBinding.path) };
}

function governedSources(authority) {
  const parents = authority.immutable_parent_bindings;
  const agreementEvidenceByAgreementId = Object.fromEntries(
    parents.m2_m3_m4.map((entry) => [entry.agreement_id, {
      canonicalTextIdentity: {
        canonical_text_id: entry.canonical_text_id,
        canonical_text_byte_length: entry.canonical_text_byte_length,
        canonical_text_sha256: entry.canonical_text_sha256,
      },
      m2: boundEnvelope(entry.m2),
      m3: boundEnvelope(entry.m3),
      m4: boundEnvelope(entry.m4),
    }]),
  );
  return {
    baseContractPolicy: boundEnvelope(parents.base_policy),
    temporalPhase1Authority: boundEnvelope(parents.phase1),
    c3CorrectionAuthority: boundEnvelope(parents.c3),
    work3Manifest: boundEnvelope(parents.work3_manifest),
    familyRolePolicy: boundEnvelope(parents.family_role_policy),
    calibrationPack: boundEnvelope(parents.calibration_pack),
    agreementEvidenceByAgreementId,
  };
}

function pinnedBinding(path, schema, idField, recordId, byteLength, sha256) {
  return {
    byte_length: byteLength,
    path,
    record_id: recordId,
    record_id_field: idField,
    schema_version: schema,
    sha256,
  };
}

function phase4ReviewInput() {
  const phase2 = boundEnvelope(pinnedBinding(
    tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_PATH,
    tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA,
    'termination_fee_authoring_phase2_authority_id',
    tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_ID,
    tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_BYTES,
    tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_SHA256,
  ));
  const phase4 = boundEnvelope(pinnedBinding(
    tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_PATH,
    tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_SCHEMA,
    'termination_fee_authoring_phase4_family_profile_package_review_authority_id',
    tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_ID,
    tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_BYTES,
    tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_SHA256,
  ));
  return {
    terminationFeeAuthoringPhase4FamilyProfilePackageReviewAuthority: phase4,
    terminationFeeAuthoringPhase2Authority: phase2,
    governedSources: governedSources(phase2.record),
  };
}

function terminalBySignature(phase2Authority) {
  return new Map(
    phase2Authority.source_terminal_successor_contract.terminal_rule_registry.map(
      (terminal) => [terminal.required_expression_signature, terminal],
    ),
  );
}

function shapeSummary(profile, terminal) {
  const tuple = profile.canonical_tuple ?? {};
  const path = tuple.classification_path ?? [];
  const member = terminal.source_closure.members[0];
  return {
    subtype_bucket: path[path.length - 1] ?? '',
    required_expression_signature: tuple.required_expression_signature ?? '',
    source_unit_count: profile.source_unit_keys?.length ?? 0,
    m4_claim_count: profile.m4_claim_ids?.length ?? 0,
    concept_key: member.concept_key,
    claim_definition_key: member.claim_definition_key,
    section_reference: member.section_reference,
    fee_side: member.fee_side,
    comparator_owner_family: member.comparator_owner_family,
    comparator_resolution_provenance: member.comparator_resolution_provenance,
  };
}

const phase4Input = phase4ReviewInput();
const review = tfAuthoring.prepareTerminationFeeFamilyProfilePackageReview(phase4Input);
const phase2Authority = phase4Input.terminationFeeAuthoringPhase2Authority.record;
const terminals = terminalBySignature(phase2Authority);
const sealedRoleSchema = read(SEALED_ROLE_SCHEMA_PATH);

const authorityUnsigned = {
  schema_version: AUTHORITY_SCHEMA,
  authority_classification: 'WORK3_TERMINATION_FEE_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  authority_state: 'AUTHORISED_UNAPPROVED_INVENTORY_REVIEW_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  immutable_parent_bindings: {
    termination_fee_phase4_review_authority:
      phase4Input.terminationFeeAuthoringPhase4FamilyProfilePackageReviewAuthority.binding,
  },
  implementation_contract: {
    exported_function: 'prepareTerminationFeeWork3UnapprovedInventoryReview',
    exact_outer_input_keys: [
      'terminationFeeWork3UnapprovedInventoryReviewEvidence',
      'terminationFeePhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'work3TerminationFeeUnapprovedInventoryReviewAuthority',
    ],
  },
  schema_review_candidate_contract: {
    schema_version: 'M7_V2_TERMINATION_FEE_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
    candidate_state:
      'UNAPPROVED_20_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      inventory_review_count: 1,
      profile_proposal_count: PROFILE_COUNT,
      runtime_validator_acceptance_count: 1,
      work3_identity_count: 0,
    },
  },
  zero_effect_boundary: {
    activation_count: 0,
    approval_count: 0,
    database_write_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
    profile_identity_count: 0,
    work3_identity_count: 0,
  },
};
const authority = {
  ...authorityUnsigned,
  work3_termination_fee_unapproved_inventory_review_authority_id:
    contentId(AUTHORITY_SCHEMA, authorityUnsigned),
};
writeFileSync(join(REPO_ROOT, AUTHORITY_PATH), `${canonicalJson(authority)}\n`);

const profileReviewItems = review.proposed_profiles.map((profile, index) => {
  const terminal = terminals.get(profile.canonical_tuple.required_expression_signature);
  if (!terminal) {
    throw new Error(`no Phase2 terminal for ${profile.proposed_profile_key}`);
  }
  return {
    ordinal: index + 1,
    proposed_profile_key: profile.proposed_profile_key,
    package_profile_key: profile.package_profile_key,
    deal: terminal.source_closure.members[0].deal,
    shape_summary: shapeSummary(profile, terminal),
    classification_path: profile.canonical_tuple.classification_path,
    required_expression_signature: profile.canonical_tuple.required_expression_signature,
    source_unit_keys: profile.source_unit_keys,
    m4_claim_ids: profile.m4_claim_ids,
    review_flags: profile.review_flags,
    review_completion_state: 'COMPLETE',
    proposed_technical_disposition: profile.review_flags.some(
      (flag) => HOLD_FLAGS.includes(flag),
    ) ? 'HOLD' : 'APPROVE',
  };
});

const bucketCounts = {};
const dealCounts = {};
for (const item of profileReviewItems) {
  const bucket = item.shape_summary.subtype_bucket;
  bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
  dealCounts[item.deal] = (dealCounts[item.deal] ?? 0) + 1;
}
const holdCount = profileReviewItems.filter(
  (item) => item.proposed_technical_disposition === 'HOLD',
).length;
const reconciliation = phase2Authority.m5_subtype_reconciliation;

const packetUnsigned = {
  schema_version: PACKET_SCHEMA,
  family_key: 'TERMINATION_FEE',
  packet_state: 'DRAFT_FOR_BEN_REVIEW_UNAPPROVED',
  phase4_review_candidate_id: review.review_candidate_id,
  profile_count: PROFILE_COUNT,
  complete_profile_count: PROFILE_COUNT,
  incomplete_profile_count: 0,
  retained_source_gap_count: 0,
  subtype_bucket_counts: bucketCounts,
  deal_counts: dealCounts,
  honest_hold_summary: {
    hold_row_count: holdCount,
    hold_review_flags: [...HOLD_FLAGS],
    comparator_owner_family_hold_row_count: profileReviewItems.filter(
      (item) => item.review_flags.includes('COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED'),
    ).length,
    comparator_declared_owner_families:
      phase2Authority.comparator_owner_family_residuals.comparator_declared_owner_families,
    fee_side_hold_row_count: profileReviewItems.filter(
      (item) => item.review_flags.includes('FEE_SIDE_PARTITION_DISPOSITION_REQUIRED'),
    ).length,
    comparator_observed_fee_sides:
      phase2Authority.fee_side_residuals.comparator_observed_fee_sides,
    m5_sealed_subtype_labels_without_comparator_instances:
      reconciliation.sealed_m5_labels_without_comparator_instance,
    comparator_buckets_without_sealed_m5_label:
      reconciliation.comparator_buckets_without_sealed_m5_label,
  },
  sealed_role_schema_binding: {
    byte_length: readFileSync(join(REPO_ROOT, SEALED_ROLE_SCHEMA_PATH)).length,
    path: SEALED_ROLE_SCHEMA_PATH,
    record_id: sealedRoleSchema.family_role_schema_id,
    record_id_field: 'family_role_schema_id',
    schema_version: sealedRoleSchema.schema_version,
    sha256: sha256Hex(readFileSync(join(REPO_ROOT, SEALED_ROLE_SCHEMA_PATH))),
  },
  review_workflow: {
    intended_reviewer: 'BEN_GOODCHILD',
    default_disposition: 'APPROVE_ALL_EXCEPT_FLAGGED_HOLDS_WITH_REVIEW_FLAGS_ACKNOWLEDGED',
    subtype_partition_reconciliation_acknowledged: true,
    taxonomy_expansion_acknowledged: true,
  },
  profile_review_items: profileReviewItems,
};
const packet = {
  ...packetUnsigned,
  inventory_review_packet_id: contentId(PACKET_SCHEMA, packetUnsigned),
};
writeFileSync(join(REPO_ROOT, PACKET_PATH), `${canonicalJson(packet)}\n`);

console.log(JSON.stringify({
  authority: binding(
    AUTHORITY_PATH,
    authority,
    'work3_termination_fee_unapproved_inventory_review_authority_id',
  ),
  packet: binding(PACKET_PATH, packet, 'inventory_review_packet_id'),
  profile_count: PROFILE_COUNT,
  hold_count: holdCount,
  bucket_counts: bucketCounts,
  deal_counts: dealCounts,
}, null, 2));
