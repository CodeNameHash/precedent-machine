#!/usr/bin/env node
/**
 * Emit the INTERIM_OPERATING Work3 unapproved inventory review authority and the
 * 113-profile inventory review packet draft Ben reads before disposition.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import interimOperatingAuthoring from '../lib/canonical-v2/m7-v2-interim-operating-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PHASE2_PATH = interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_AUTHORITY_PATH;
const PHASE4_PATH = interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_AUTHORITY_PATH;
const AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-interim-operating-unapproved-inventory-review-authority.json`;
const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-interim-operating-113-profile-inventory-review-packet-draft.json`;
const AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1';
const PACKET_SCHEMA =
  'STAGE_2Y_M7_V2_INTERIM_OPERATING_113_PROFILE_INVENTORY_REVIEW_PACKET/V1';

const PROFILE_COUNT = interimOperatingAuthoring.INTERIM_OPERATING_PROFILE_COUNT;
const FLAGS = interimOperatingAuthoring.INTERIM_OPERATING_REVIEW_FLAGS;

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

const phase2 = envelope(PHASE2_PATH, 'interim_operating_authoring_phase2_authority_id');
const phase4 = envelope(
  PHASE4_PATH,
  'interim_operating_authoring_phase4_family_profile_package_review_authority_id',
);
const phase4Input = {
  interimOperatingAuthoringPhase4FamilyProfilePackageReviewAuthority: phase4,
  interimOperatingAuthoringPhase2Authority: phase2,
  governedSources: governedSources(phase2.record),
};
const review = interimOperatingAuthoring
  .prepareInterimOperatingFamilyProfilePackageReview(phase4Input);
const terminalsBySourceUnitKey = new Map(
  phase2.record.source_terminal_successor_contract.terminal_rule_registry
    .map((terminal) => [terminal.source_unit_key, terminal]),
);

function terminalFor(profile) {
  const terminal = terminalsBySourceUnitKey.get(profile.source_unit_keys[0]);
  if (!terminal) throw new Error(`no terminal for ${profile.source_unit_keys[0]}`);
  return terminal;
}

function shapeSummary(profile, terminal) {
  const member = terminal.source_closure.members[0];
  const bucket = profile.canonical_tuple.classification_path[1];
  return `${bucket}: ${member.deal} s${member.section_reference} `
    + `${member.claim_definition_key} (1 M4 claim, subtype grouping pending legal)`;
}

const profileReviewItems = review.proposed_profiles.map((profile, index) => {
  const terminal = terminalFor(profile);
  const member = terminal.source_closure.members[0];
  return {
    ordinal: index + 1,
    proposed_profile_key: profile.proposed_profile_key,
    package_profile_key: profile.package_profile_key,
    deal: member.deal,
    section_reference: member.section_reference,
    claim_definition_key: member.claim_definition_key,
    calibration_provision_example_id: terminal.calibration_provision_example_id,
    calibration_proposed_subtype: terminal.calibration_proposed_subtype,
    derived_classification_bucket: terminal.classification_bucket,
    shape_summary: shapeSummary(profile, terminal),
    classification_path: profile.canonical_tuple.classification_path,
    required_expression_signature: profile.canonical_tuple.required_expression_signature,
    source_unit_keys: profile.source_unit_keys,
    m4_claim_ids: profile.m4_claim_ids,
    review_flags: profile.review_flags,
    review_completion_state: 'COMPLETE',
  };
});

const flagCount = (flag) => profileReviewItems.filter(
  (item) => item.review_flags.includes(flag),
).length;

const authorityUnsigned = {
  schema_version: AUTHORITY_SCHEMA,
  authority_classification: 'WORK3_INTERIM_OPERATING_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY',
  authority_state: 'AUTHORISED_UNAPPROVED_INVENTORY_REVIEW_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
  immutable_parent_bindings: {
    interim_operating_phase4_review_authority: phase4.binding,
  },
  implementation_contract: {
    exported_function: 'prepareInterimOperatingWork3UnapprovedInventoryReview',
    exact_outer_input_keys: [
      'interimOperatingWork3UnapprovedInventoryReviewEvidence',
      'interimOperatingPhase4ReviewInput',
    ],
    exact_successor_evidence_keys: [
      'work3InterimOperatingUnapprovedInventoryReviewAuthority',
    ],
  },
  schema_review_candidate_contract: {
    schema_version: 'M7_V2_INTERIM_OPERATING_WORK3_UNAPPROVED_INVENTORY_REVIEW_CANDIDATE/V1',
    candidate_state:
      'UNAPPROVED_113_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
    review_accounting_exact_values: {
      authority_local_candidate_identity_count: 1,
      inventory_review_count: 1,
      legal_grouping_review_flag_count: flagCount(FLAGS.LEGAL_GROUPING),
      outside_calibration_example_flag_count: flagCount(FLAGS.OUTSIDE_CALIBRATION),
      profile_proposal_count: PROFILE_COUNT,
      runtime_validator_acceptance_count: 1,
      subtype_partition_divergence_flag_count: flagCount(FLAGS.SUBTYPE_DIVERGENCE),
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
  work3_interim_operating_unapproved_inventory_review_authority_id:
    contentId(AUTHORITY_SCHEMA, authorityUnsigned),
};
writeFileSync(join(REPO_ROOT, AUTHORITY_PATH), `${canonicalJson(authority)}\n`);

const packetUnsigned = {
  schema_version: PACKET_SCHEMA,
  family_key: 'INTERIM_OPERATING',
  packet_state: 'DRAFT_FOR_BEN_REVIEW_UNAPPROVED',
  phase4_review_candidate_id: review.review_candidate_id,
  profile_count: PROFILE_COUNT,
  complete_profile_count: PROFILE_COUNT,
  incomplete_profile_count: 0,
  retained_source_gap_count: 0,
  comparator_deal_count: 6,
  review_workflow: {
    intended_reviewer: 'BEN_GOODCHILD',
    default_disposition: 'APPROVE_ALL_WITH_SUBTYPE_GROUPING_REVIEW_PENDING',
    legal_grouping_review_pending_acknowledged: true,
    subtype_grouping_pending_legal: true,
    open_question_for_ben:
      'The sealed M5 role schema admits all three Interim Operating claim keys under all seven '
      + 'subtype buckets. This packet proposes meeting-covenant claims under THRESHOLD and the '
      + 'proxy/meeting subtype partition under THRESHOLD, which diverges from '
      + 'the calibration pack tagging every provision example RESTRICTIVE_COVENANT. The divergence is '
      + 'stamped as a hold, not resolved.',
    sealed_ruling_reuse:
      'Q01-Q03 answered by the sealed M5 programme rulings the role schema already binds; no new '
      + 'lawyer ruling is recorded here.',
  },
  profile_review_items: profileReviewItems,
};
const packet = {
  ...packetUnsigned,
  inventory_review_packet_id: contentId(PACKET_SCHEMA, packetUnsigned),
};
writeFileSync(join(REPO_ROOT, PACKET_PATH), `${canonicalJson(packet)}\n`);

process.stdout.write(`${JSON.stringify({
  authority: binding(
    AUTHORITY_PATH,
    authority,
    'work3_interim_operating_unapproved_inventory_review_authority_id',
  ),
  packet: binding(PACKET_PATH, packet, 'inventory_review_packet_id'),
}, null, 2)}\n`);
