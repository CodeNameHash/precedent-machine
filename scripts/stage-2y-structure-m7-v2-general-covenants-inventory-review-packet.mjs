#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import gcAuthoring from '../lib/canonical-v2/m7-v2-general-covenants-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PHASE2_PATH =
  `${CONTROL}/m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v2.json`;
const PHASE4_PATH =
  `${CONTROL}/m7-v2-repair-contract-general-covenants-authoring-phase4-family-profile-package-review-authority.json`;
const AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-general-covenants-unapproved-inventory-review-authority.json`;
const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-general-covenants-54-profile-inventory-review-packet-draft.json`;
const AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1';
const PACKET_SCHEMA =
  'STAGE_2Y_M7_V2_GENERAL_COVENANTS_54_PROFILE_INVENTORY_REVIEW_PACKET/V1';
const GC_CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/GENERAL_COVENANTS.json';

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

function envelope(path, idField) {
  const record = read(path);
  return { binding: binding(path, record, idField), record };
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

function dealByM4ClaimIdMap() {
  const cal = read(GC_CALIBRATION_PACK_PATH);
  const map = new Map();
  for (const runBinding of cal.comparator_run_bindings ?? []) {
    const m4Path =
      `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/${runBinding.agreement_id}.agreement-analysis.json`;
    const m4 = read(m4Path);
    for (const claim of m4.claims ?? []) {
      if (typeof claim.analysis_claim_id === 'string') {
        map.set(claim.analysis_claim_id, runBinding.deal);
      }
    }
  }
  return map;
}

function resolveSourceDeal(profile, dealMap) {
  for (const claimId of profile.m4_claim_ids ?? []) {
    const deal = dealMap.get(claimId);
    if (deal) return deal;
  }
  return null;
}

function buildShapeSummary(profile) {
  const tuple = profile.canonical_tuple ?? {};
  const subtype = tuple.classification_path?.[2] ?? '';
  const signature = tuple.required_expression_signature ?? '';
  return {
    subtype_bucket: subtype,
    required_expression_signature: signature,
    source_unit_count: profile.source_unit_keys?.length ?? 0,
    m4_claim_count: profile.m4_claim_ids?.length ?? 0,
  };
}

const phase2 = envelope(PHASE2_PATH, 'general_covenants_authoring_phase2_authority_id');
const phase4 = envelope(
  PHASE4_PATH,
  'general_covenants_authoring_phase4_family_profile_package_review_authority_id',
);
const phase4Input = {
  generalCovenantsAuthoringPhase4FamilyProfilePackageReviewAuthority: phase4,
  generalCovenantsAuthoringPhase2Authority: phase2,
  governedSources: governedSources(phase2.record),
};
const review = gcAuthoring.prepareGeneralCovenantsFamilyProfilePackageReview(phase4Input);
const dealMap = dealByM4ClaimIdMap();

const authorityUnsigned = {
  schema_version: AUTHORITY_SCHEMA,
  authority_classification: 'WORK3_GENERAL_COVENANTS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  authority_state: 'AUTHORISED_UNAPPROVED_INVENTORY_REVIEW_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  immutable_parent_bindings: {
    general_covenants_phase4_review_authority: phase4.binding,
  },
  implementation_contract: {
    exported_function: 'prepareGeneralCovenantsWork3UnapprovedInventoryReview',
    exact_outer_input_keys: [
      'generalCovenantsWork3UnapprovedInventoryReviewEvidence',
      'generalCovenantsPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'work3GeneralCovenantsUnapprovedInventoryReviewAuthority',
    ],
  },
  schema_review_candidate_contract: {
    schema_version: 'M7_V2_GENERAL_COVENANTS_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
    candidate_state:
      'UNAPPROVED_54_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      inventory_review_count: 1,
      profile_proposal_count: 54,
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
  work3_general_covenants_unapproved_inventory_review_authority_id:
    contentId(AUTHORITY_SCHEMA, authorityUnsigned),
};
writeFileSync(join(REPO_ROOT, AUTHORITY_PATH), `${canonicalJson(authority)}\n`);

const profileReviewItems = review.proposed_profiles.map((profile, index) => ({
  ordinal: index + 1,
  proposed_profile_key: profile.proposed_profile_key,
  package_profile_key: profile.package_profile_key,
  deal: resolveSourceDeal(profile, dealMap),
  shape_summary: buildShapeSummary(profile),
  classification_path: profile.canonical_tuple.classification_path,
  required_expression_signature: profile.canonical_tuple.required_expression_signature,
  source_unit_keys: profile.source_unit_keys,
  m4_claim_ids: profile.m4_claim_ids,
  review_flags: profile.review_flags,
  review_completion_state: 'COMPLETE',
}));
const packetUnsigned = {
  schema_version: PACKET_SCHEMA,
  family_key: 'GENERAL_COVENANTS',
  packet_state: 'DRAFT_FOR_BEN_REVIEW_UNAPPROVED',
  phase4_review_candidate_id: review.review_candidate_id,
  profile_count: 54,
  complete_profile_count: 54,
  incomplete_profile_count: 0,
  retained_source_gap_count: 0,
  review_workflow: {
    intended_reviewer: 'BEN_GOODCHILD',
    default_disposition: 'APPROVE_ALL_WITH_REVIEW_FLAGS_ACKNOWLEDGED',
    access_scope_item_44_acknowledged: true,
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
    'work3_general_covenants_unapproved_inventory_review_authority_id',
  ),
  packet: binding(PACKET_PATH, packet, 'inventory_review_packet_id'),
  access_scope_flag_count: profileReviewItems.filter((item) => (
    item.review_flags.includes('ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED')
  )).length,
}));
