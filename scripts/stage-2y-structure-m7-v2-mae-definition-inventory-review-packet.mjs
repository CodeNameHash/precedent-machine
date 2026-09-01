#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import maeAuthoring from '../lib/canonical-v2/m7-v2-mae-definition-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PHASE2_PATH = `${CONTROL}/m7-v2-repair-contract-mae-definition-authoring-phase2-authority-v1.json`;
const PHASE4_PATH =
  `${CONTROL}/m7-v2-repair-contract-mae-definition-authoring-phase4-family-profile-package-review-authority.json`;
const AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-unapproved-inventory-review-authority.json`;
const PACKET_PATH = `${CONTROL}/m7-v2-repair-mae-4-profile-inventory-review-packet-draft.json`;
const AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1';
const PACKET_SCHEMA =
  'STAGE_2Y_M7_V2_MAE_DEFINITION_4_PROFILE_INVENTORY_REVIEW_PACKET/V1';
const MAE_CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/MAE_DEFINITION.json';

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
    c3CorrectionAuthority: boundEnvelope(parents.c3),
    work3Manifest: boundEnvelope(parents.work3_manifest),
    familyRolePolicy: boundEnvelope(parents.family_role_policy),
    calibrationPack: boundEnvelope(parents.calibration_pack),
    agreementEvidenceByAgreementId,
  };
}

function dealByM4ClaimIdMap() {
  const cal = read(MAE_CALIBRATION_PACK_PATH);
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
  const subtype = tuple.classification_path?.[1] ?? '';
  const signature = tuple.required_expression_signature ?? '';
  const summary = {
    subtype_bucket: subtype,
    required_expression_signature: signature,
    source_unit_count: profile.source_unit_keys?.length ?? 0,
    m4_claim_count: profile.m4_claim_ids?.length ?? 0,
  };
  if (tuple.mae_carveout_code) {
    summary.mae_carveout_code = tuple.mae_carveout_code;
  }
  if (signature.includes('CONSEQUENCE_MODIFIER')) {
    summary.topology = 'CONSEQUENCE_MODIFIER';
  }
  if (signature.includes('MAE_DEFINITION_INSTANCE')) {
    summary.topology = 'OPERATIVE_DEFINITION_HEADER';
  }
  if (signature.includes('MAE_CARVEOUT::')) {
    summary.topology = 'CARVEOUT_EXCLUSION';
  }
  return summary;
}

const phase2 = envelope(PHASE2_PATH, 'mae_definition_authoring_phase2_authority_id');
const phase4 = envelope(
  PHASE4_PATH,
  'mae_definition_authoring_phase4_family_profile_package_review_authority_id',
);
const phase4Input = {
  maeDefinitionAuthoringPhase4FamilyProfilePackageReviewAuthority: phase4,
  maeDefinitionAuthoringPhase2Authority: phase2,
  governedSources: governedSources(phase2.record),
};
const review = maeAuthoring.prepareMaeDefinitionFamilyProfilePackageReview(phase4Input);
const dealMap = dealByM4ClaimIdMap();

const authorityUnsigned = {
  schema_version: AUTHORITY_SCHEMA,
  authority_classification: 'WORK3_MAE_DEFINITION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  authority_state: 'AUTHORISED_UNAPPROVED_INVENTORY_REVIEW_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  immutable_parent_bindings: {
    mae_definition_phase4_review_authority: phase4.binding,
  },
  implementation_contract: {
    exported_function: 'prepareMaeDefinitionWork3UnapprovedInventoryReview',
    exact_outer_input_keys: [
      'maeDefinitionWork3UnapprovedInventoryReviewEvidence',
      'maeDefinitionPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'work3MaeDefinitionUnapprovedInventoryReviewAuthority',
    ],
  },
  schema_review_candidate_contract: {
    schema_version: 'M7_V2_MAE_DEFINITION_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
    candidate_state:
      'UNAPPROVED_4_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      inventory_review_count: 1,
      profile_proposal_count: 4,
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
  work3_mae_definition_unapproved_inventory_review_authority_id:
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
  family_key: 'MAE_DEFINITION',
  packet_state: 'DRAFT_FOR_BEN_REVIEW_UNAPPROVED',
  phase4_review_candidate_id: review.review_candidate_id,
  profile_count: 4,
  complete_profile_count: 4,
  incomplete_profile_count: 0,
  retained_source_gap_count: 0,
  review_workflow: {
    intended_reviewer: 'BEN_GOODCHILD',
    default_disposition: 'APPROVE_ALL_WITH_REVIEW_FLAGS_ACKNOWLEDGED',
    self_containment_unproven_acknowledged: true,
    subject_term_mismatch_acknowledged: true,
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
    'work3_mae_definition_unapproved_inventory_review_authority_id',
  ),
  packet: binding(PACKET_PATH, packet, 'inventory_review_packet_id'),
}));
