#!/usr/bin/env node

/**
 * Emit the REPRESENTATIONS Work3 unapproved inventory review authority and the
 * 70-profile inventory review packet draft from the Phase 4 review candidate.
 *
 * No row is held: LEGAL_GROUPING_REVIEW_REQUIRED and
 * CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY are acknowledged flags, not holds.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import repsAuthoring from '../lib/canonical-v2/m7-v2-representations-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-representations-unapproved-inventory-review-authority.json`;
const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-representations-70-profile-inventory-review-packet-draft.json`;
const AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1';
const PACKET_SCHEMA =
  'STAGE_2Y_M7_V2_REPRESENTATIONS_70_PROFILE_INVENTORY_REVIEW_PACKET/V1';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/REPRESENTATIONS.json';

const PROFILE_COUNT = repsAuthoring.REPRESENTATIONS_PROFILE_COUNT;
const KNOWLEDGE_COUNT = repsAuthoring.REPRESENTATIONS_KNOWLEDGE_QUALIFIER_PROFILE_COUNT;
const REGISTERED_SUBTYPE_BUCKETS = [
  'COMPLIANCE_REPRESENTATION',
  'CONTRACT_REPRESENTATION',
  'DOCUMENT_REPRESENTATION',
  'FINANCIAL_REPRESENTATION',
  'NEGATIVE_REPRESENTATION',
  'STATUS_REPRESENTATION',
];

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

function phase4ReviewInput() {
  const phase2 = boundEnvelope(pinnedBinding(
    repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_PATH,
    repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA,
    'representations_authoring_phase2_authority_id',
    repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_ID,
    repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_BYTES,
    repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_SHA256,
  ));
  const phase4 = boundEnvelope(pinnedBinding(
    repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_PATH,
    repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_SCHEMA,
    'representations_authoring_phase4_family_profile_package_review_authority_id',
    repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_ID,
    repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_BYTES,
    repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_SHA256,
  ));
  return {
    representationsAuthoringPhase4FamilyProfilePackageReviewAuthority: phase4,
    representationsAuthoringPhase2Authority: phase2,
    governedSources: governedSources(phase2.record),
  };
}

function dealByM4ClaimIdMap() {
  const pack = read(CALIBRATION_PACK_PATH);
  const map = new Map();
  for (const runBinding of pack.comparator_run_bindings ?? []) {
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

function signatureField(signature, index) {
  const inner = signature.replace(/^ALL_OF\(/, '').replace(/\)$/, '');
  return inner.split(',')[index] ?? '';
}

function buildShapeSummary(profile) {
  const tuple = profile.canonical_tuple ?? {};
  const path = tuple.classification_path ?? [];
  const signature = tuple.required_expression_signature ?? '';
  return {
    subtype_bucket: path[path.length - 1] ?? '',
    claim_definition_key: signatureField(signature, 2),
    accuracy_standard: signatureField(signature, 5),
    party_capacity: signatureField(signature, 6),
    required_expression_signature: signature,
    source_unit_count: profile.source_unit_keys?.length ?? 0,
    m4_claim_count: profile.m4_claim_ids?.length ?? 0,
  };
}

const phase4Input = phase4ReviewInput();
const review = repsAuthoring.prepareRepresentationsFamilyProfilePackageReview(phase4Input);
const dealMap = dealByM4ClaimIdMap();

const authorityUnsigned = {
  schema_version: AUTHORITY_SCHEMA,
  authority_classification: 'WORK3_REPRESENTATIONS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  authority_state: 'AUTHORISED_UNAPPROVED_INVENTORY_REVIEW_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  immutable_parent_bindings: {
    representations_phase4_review_authority:
      phase4Input.representationsAuthoringPhase4FamilyProfilePackageReviewAuthority.binding,
  },
  implementation_contract: {
    exported_function: 'prepareRepresentationsWork3UnapprovedInventoryReview',
    exact_outer_input_keys: [
      'representationsWork3UnapprovedInventoryReviewEvidence',
      'representationsPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'work3RepresentationsUnapprovedInventoryReviewAuthority',
    ],
  },
  schema_review_candidate_contract: {
    schema_version: 'M7_V2_REPRESENTATIONS_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
    candidate_state:
      'UNAPPROVED_70_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
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
  work3_representations_unapproved_inventory_review_authority_id:
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
  proposed_technical_disposition: 'APPROVE',
}));

const bucketCounts = {};
const dealCounts = {};
const claimDefinitionCounts = {};
for (const item of profileReviewItems) {
  const bucket = item.shape_summary.subtype_bucket;
  bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
  dealCounts[item.deal ?? 'UNKNOWN'] = (dealCounts[item.deal ?? 'UNKNOWN'] ?? 0) + 1;
  const key = item.shape_summary.claim_definition_key;
  claimDefinitionCounts[key] = (claimDefinitionCounts[key] ?? 0) + 1;
}
const knowledgeCount = profileReviewItems.filter(
  (item) => item.review_flags.includes('CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY'),
).length;
const legalGroupingCount = profileReviewItems.filter(
  (item) => item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'),
).length;
if (
  profileReviewItems.length !== PROFILE_COUNT
  || knowledgeCount !== KNOWLEDGE_COUNT
  || legalGroupingCount !== PROFILE_COUNT
) {
  throw new Error(
    `packet census drift: ${profileReviewItems.length} profiles / ${knowledgeCount} knowledge / ${legalGroupingCount} legal`,
  );
}

const packetUnsigned = {
  schema_version: PACKET_SCHEMA,
  family_key: 'REPRESENTATIONS',
  packet_state: 'DRAFT_FOR_BEN_REVIEW_UNAPPROVED',
  phase4_review_candidate_id: review.review_candidate_id,
  profile_count: PROFILE_COUNT,
  complete_profile_count: PROFILE_COUNT,
  incomplete_profile_count: 0,
  retained_source_gap_count: 0,
  subtype_bucket_counts: bucketCounts,
  deal_counts: dealCounts,
  claim_definition_counts: claimDefinitionCounts,
  honest_hold_summary: {
    hold_row_count: 0,
    hold_review_flags: [],
    acknowledged_review_flags: [
      'CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY',
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    ],
    legal_grouping_review_pending_count: PROFILE_COUNT,
    cross_family_knowledge_definition_link_only_count: knowledgeCount,
    registered_subtype_buckets: [...REGISTERED_SUBTYPE_BUCKETS],
    populated_subtype_buckets: Object.keys(bucketCounts).sort(),
    unpopulated_subtype_buckets: REGISTERED_SUBTYPE_BUCKETS.filter(
      (bucket) => !(bucket in bucketCounts),
    ),
    legal_grouping_question:
      'WHICH_OF_THE_SIX_SEALED_M5_SUBTYPE_BUCKETS_EACH_AUTHORED_ACCURACY_STANDARD_BELONGS_TO',
  },
  review_workflow: {
    intended_reviewer: 'BEN_GOODCHILD',
    default_disposition: 'APPROVE_ALL_ROWS_WITH_REVIEW_FLAGS_ACKNOWLEDGED',
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
    'work3_representations_unapproved_inventory_review_authority_id',
  ),
  packet: binding(PACKET_PATH, packet, 'inventory_review_packet_id'),
  profile_count: PROFILE_COUNT,
  hold_count: 0,
  knowledge_link_only_count: knowledgeCount,
  bucket_counts: bucketCounts,
  deal_counts: dealCounts,
  claim_definition_counts: claimDefinitionCounts,
}, null, 2));
