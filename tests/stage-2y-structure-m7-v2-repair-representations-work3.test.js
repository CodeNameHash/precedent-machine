'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { gunzipSync } = require('node:zlib');
const { join } = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateSingleFamilyPackageInventory,
} = require('../lib/canonical-v2/m7-v2-contract');

const REPO_ROOT = join(__dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

let repsAuthoring;
try {
  repsAuthoring = require('../lib/canonical-v2/m7-v2-representations-authoring.js');
} catch (error) {
  throw new Error('REPRESENTATIONS authoring facade module is missing.');
}

for (const exportName of [
  'prepareRepresentationsPhase2FamilyProposal',
  'prepareRepresentationsFamilyProfilePackageReview',
  'prepareRepresentationsWork3UnapprovedInventoryReview',
  'prepareRepresentationsWork3BenInventorySessionDisposition',
  'prepareRepresentationsWork3FamilyPackageSeal',
  'prepareRepresentationsWork3FamilyPackageRegistration',
]) {
  if (typeof repsAuthoring[exportName] !== 'function') {
    throw new Error(`REPRESENTATIONS facade export ${exportName} is missing.`);
  }
}

const PROFILE_COUNT = repsAuthoring.REPRESENTATIONS_PROFILE_COUNT;
const KNOWLEDGE_COUNT = repsAuthoring.REPRESENTATIONS_KNOWLEDGE_QUALIFIER_PROFILE_COUNT;

const REPRESENTATIONS_PHASE2_AUTHORITY_BINDING = Object.freeze({
  byte_length: repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_BYTES,
  path: repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_PATH,
  record_id: repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_ID,
  record_id_field: 'representations_authoring_phase2_authority_id',
  schema_version: repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA,
  sha256: repsAuthoring.REPRESENTATIONS_PHASE2_AUTHORITY_SHA256,
});

const REPRESENTATIONS_PHASE4_AUTHORITY_BINDING = Object.freeze({
  byte_length: repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_BYTES,
  path: repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_PATH,
  record_id: repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_ID,
  record_id_field:
    'representations_authoring_phase4_family_profile_package_review_authority_id',
  schema_version: repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_SCHEMA,
  sha256: repsAuthoring.REPRESENTATIONS_PHASE4_AUTHORITY_SHA256,
});

const REPRESENTATIONS_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 1994,
    path: `${CONTROL}/m7-v2-repair-contract-work3-representations-unapproved-inventory-review-authority.json`,
    record_id: '54a21da8da87fceae46aff72c0d3d08e8d7aa7f9283b476c22e877d6141321fb',
    record_id_field: 'work3_representations_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'b32fe50c9908eb4b75df232e9753f2933505cede1dc379abe98b09bacc17a594',
  }),
  packet: Object.freeze({
    byte_length: 91350,
    path: `${CONTROL}/m7-v2-repair-representations-70-profile-inventory-review-packet-draft.json`,
    record_id: 'e0eedadf6b3944a4c4d9f63528eb16c7bac5ff827b9a5dc60ceae373f2c4355a',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_70_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '9eb1cf48d48558f66eaeb3e009a2566f94d6379b75f2308342aaafb164c77870',
  }),
  disposition: Object.freeze({
    byte_length: 23190,
    path: `${CONTROL}/m7-v2-repair-representations-70-profile-inventory-disposition.json`,
    record_id: 'f45a5a0118d90cd10bbd4355dccfeb32eb31893313a0c461e71d6ee8ee712b65',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_70_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '347e2ef5fc339d5ce7932425a0a53335e2eb50b4e320f02f29bb04c5ea0ceaf2',
  }),
  session: Object.freeze({
    byte_length: 1126,
    path: `${CONTROL}/m7-v2-repair-representations-ben-inventory-session-receipt.json`,
    record_id: '8ca0e9c6c48f72368d698eb23db7c53d61688ba8bd35b7a2b93d5ccbad9382c8',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: 'c02180657c0aa90f8e7e64fb69f0cf571a053cc8d6accd8904dedf968321693f',
  }),
  benAuthority: Object.freeze({
    byte_length: 2805,
    path: `${CONTROL}/m7-v2-repair-contract-work3-representations-ben-inventory-session-successor-authority.json`,
    record_id: '27e1082d45136c9bc6d7f78bc166f1498522d6f762439ca3325135eee371bd3b',
    record_id_field: 'work3_representations_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'dd84a1d11a299c5d4c57877d57539bcaa8fa3d095c38b69415ff1b9e3be14a47',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3322,
    path: `${CONTROL}/m7-v2-repair-contract-work3-representations-family-package-seal-successor-authority.json`,
    record_id: '2e6e86f44a54a3460dfb98c5bedaad1faa5d75f825552ac218f3d14c8a6cf57b',
    record_id_field: 'work3_representations_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '059269aab18f95bd01e688bb43ea1bab4750815e8144074031aae24f2ab6afdb',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2188,
    path: `${CONTROL}/m7-v2-repair-representations-family-package-seal-receipt.json`,
    record_id: '511852dda8b6f96120718d8ded052065cf09805c00a9b8dd023aa3f2e2afce69',
    record_id_field: 'representations_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '345daeaf213bef76da990b5866ac963e5e97fa282105013833532b35742ce70f',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2902,
    path: `${CONTROL}/m7-v2-repair-contract-work3-representations-registration-successor-authority.json`,
    record_id: '14dfe476c724396857247973f8880f353615b31e5133910722f07150e6416e9c',
    record_id_field: 'work3_representations_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'd9c4695234b30535d6184cfa64e456209613c02ff695a76ffb2555c90cba21e9',
  }),
});

const REPRESENTATIONS_BEN_RULINGS_BINDING = Object.freeze({
  byte_length: 5549,
  path: 'docs/codex-program/notes/REPRESENTATIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: '707c7e2df981885d6e62a2ecace37cd3d5030ec08d9ed763032b651cf10b3ade',
});

const REPRESENTATIONS_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  byte_length: 881471,
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-representations.json`,
  record_id: 'e8b1f464ea2861d9494d4a455c45525824c482b50d56df63362c8f8f10e8e1ae',
  record_id_field: 'family_profile_package_id',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  sha256: 'ee84e5d00e68feddc019ffa1af7010af432d75273d65740132fdff42265c0d21',
});

const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const REPRESENTATIONS_REGISTERED_SUBTYPE_BUCKETS = Object.freeze([
  'STATUS_REPRESENTATION',
  'COMPLIANCE_REPRESENTATION',
  'DOCUMENT_REPRESENTATION',
  'CONTRACT_REPRESENTATION',
  'FINANCIAL_REPRESENTATION',
  'NEGATIVE_REPRESENTATION',
]);

const REPRESENTATIONS_PHASE4_PROFILE_KEYS = Object.freeze([
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

function readRecord(relativePath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'));
}

function physicalBytes(binding) {
  const file = readFileSync(join(REPO_ROOT, binding.path));
  const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  assert.equal(bytes.byteLength, binding.byte_length, binding.path);
  assert.equal(sha256Hex(bytes), binding.sha256, binding.path);
  return bytes;
}

function sourceEnvelope(binding) {
  return { binding: structuredClone(binding), record: readRecord(binding.path) };
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function assertExactKeys(value, expected, label) {
  assert.equal(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && canonicalJson(Object.keys(value)) === canonicalJson(expected),
    true,
    label,
  );
}

function governedSources(authorityRecord) {
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

function phase2Fixture() {
  physicalBytes(REPRESENTATIONS_PHASE2_AUTHORITY_BINDING);
  const representationsAuthoringPhase2Authority = sourceEnvelope(
    REPRESENTATIONS_PHASE2_AUTHORITY_BINDING,
  );
  return {
    representationsAuthoringPhase2Authority,
    governedSources: governedSources(representationsAuthoringPhase2Authority.record),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    representationsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(REPRESENTATIONS_PHASE4_AUTHORITY_BINDING),
    representationsAuthoringPhase2Authority:
      fixture.representationsAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3RepresentationsUnapprovedInventoryReviewAuthority:
      sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.inventoryAuthority),
    work3RepresentationsBenInventorySessionSuccessorAuthority:
      sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.benAuthority),
    work3RepresentationsFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.sealAuthority),
    work3RepresentationsRegistrationSuccessorAuthority:
      sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(REPRESENTATIONS_WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic claim-scale REPRESENTATIONS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.representationsAuthoringPhase2Authority.record;
  const successor = authority.source_terminal_successor_contract;
  const terminals = successor.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 6);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(successor.classification_path_registry.map(
      (entry) => entry.classification_bucket,
    )),
    [...REPRESENTATIONS_REGISTERED_SUBTYPE_BUCKETS].sort(),
  );
  for (const terminal of terminals) {
    assert.equal(terminal.m4_claim_ids.length, 1, terminal.source_unit_key);
    assert.equal(
      terminal.unresolved_items.includes('LEGAL_GROUPING_REVIEW_REQUIRED'),
      true,
      terminal.source_unit_key,
    );
  }

  const result = repsAuthoring.prepareRepresentationsPhase2FamilyProposal(fixture);

  assertExactKeys(result, repsAuthoring.REPRESENTATIONS_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.equal(result.family_key, 'REPRESENTATIONS');
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.zero_m4_claim_gaps, true);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.deepEqual(result.authority_binding, REPRESENTATIONS_PHASE2_AUTHORITY_BINDING);
  assert.equal(result.derived_profile_count, PROFILE_COUNT);
  assert.equal(result.proposed_partition.proposed_profiles.length, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.expected_count, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.accounted_count, PROFILE_COUNT);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(
    result.unresolved_items.includes('LEGAL_GROUPING_REVIEW_REQUIRED'),
    true,
  );
  assert.equal(Object.isFrozen(result), true);

  const signatures = result.proposed_partition.proposed_profiles.map(
    (profile) => profile.canonical_tuple.required_expression_signature,
  );
  assert.equal(sortedUnique(signatures).length, PROFILE_COUNT);
});

test('Phase4 REPRESENTATIONS package review returns 70 unapproved proposals without Work3 identities', () => {
  physicalBytes(REPRESENTATIONS_PHASE4_AUTHORITY_BINDING);
  const authority = readRecord(REPRESENTATIONS_PHASE4_AUTHORITY_BINDING.path);
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);
  assert.equal(authority.implementation_contract.phase3_internal_function, null);

  const result = repsAuthoring.prepareRepresentationsFamilyProfilePackageReview(phase4Fixture());

  assertExactKeys(
    result,
    repsAuthoring.REPRESENTATIONS_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_70_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: PROFILE_COUNT,
    cross_family_knowledge_definition_flag_count: KNOWLEDGE_COUNT,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    work3_identity_count: 0,
  });
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(
      profile,
      REPRESENTATIONS_PHASE4_PROFILE_KEYS,
      `${profile.proposed_profile_key} keys`,
    );
    assert.equal(profile.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(
      profile.package_profile_key.startsWith('PROFILE:REPRESENTATIONS:STATUS_REPRESENTATION:'),
      true,
    );
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }

  const knowledgeRows = result.proposed_profiles.filter(
    (profile) => profile.review_flags.includes('CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY'),
  );
  assert.equal(knowledgeRows.length, KNOWLEDGE_COUNT);
});

test('Work3 REPRESENTATIONS unapproved inventory review passes the validator without Work3 identity', () => {
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = repsAuthoring.prepareRepresentationsWork3UnapprovedInventoryReview({
    representationsWork3UnapprovedInventoryReviewEvidence: {
      work3RepresentationsUnapprovedInventoryReviewAuthority:
        evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
    },
    representationsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_70_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.inventory_packet_reference.retained_source_gap_count, 0);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 REPRESENTATIONS Ben inventory disposition approves 70 rows with the grouping hold acknowledged', () => {
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.benAuthority);
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = repsAuthoring.prepareRepresentationsWork3BenInventorySessionDisposition({
    representationsWork3BenInventorySessionDispositionEvidence: {
      work3RepresentationsUnapprovedInventoryReviewAuthority:
        evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
      work3RepresentationsBenInventorySessionSuccessorAuthority:
        evidence.work3RepresentationsBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    representationsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    cross_family_knowledge_definition_link_only_count: KNOWLEDGE_COUNT,
    populated_subtype_bucket_count: 1,
    registered_subtype_bucket_count: 6,
    taxonomy_expansion_acknowledged: true,
  });
  assert.deepEqual(result.ben_rulings_binding, REPRESENTATIONS_BEN_RULINGS_BINDING);
  assert.equal(result.session_receipt_reference.completion_state, 'COMPLETE');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 REPRESENTATIONS family package seal holds the subtype partition without registering', () => {
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.session);
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = repsAuthoring.prepareRepresentationsWork3FamilyPackageSeal({
    representationsWork3FamilyPackageSealEvidence: {
      work3RepresentationsUnapprovedInventoryReviewAuthority:
        evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
      work3RepresentationsBenInventorySessionSuccessorAuthority:
        evidence.work3RepresentationsBenInventorySessionSuccessorAuthority,
      work3RepresentationsFamilyPackageSealSuccessorAuthority:
        evidence.work3RepresentationsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    representationsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.family_package_seal_id,
    evidence.familyPackageSealReceipt.record.family_package_seal_id,
  );
  assert.equal(
    result.legal_grouping_disposition_binding.disposition_status,
    'PENDING_LEGAL_REVIEW',
  );
  assert.equal(
    result.legal_grouping_disposition_binding.legal_grouping_review_pending_count,
    PROFILE_COUNT,
  );
  assert.equal(
    result.legal_grouping_disposition_binding.populated_subtype_bucket_count,
    1,
  );
  assert.equal(
    result.legal_grouping_disposition_binding.registered_subtype_bucket_count,
    REPRESENTATIONS_REGISTERED_SUBTYPE_BUCKETS.length,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 REPRESENTATIONS family package registration binds the seal receipt without activation', () => {
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.sealReceipt);
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = repsAuthoring.prepareRepresentationsWork3FamilyPackageRegistration({
    representationsWork3FamilyPackageRegistrationEvidence: evidence,
    representationsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'BEN_REPRESENTATIONS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.equal(result.registered_profile_identities.length, PROFILE_COUNT);
  assert.equal(result.family_profile_package_identity.profile_id_count, PROFILE_COUNT);
  assert.equal(
    result.family_profile_package_identity.legal_grouping_disposition_state,
    'PENDING_LEGAL_REVIEW',
  );
  assert.equal(result.review_accounting.work3_identity_count, PROFILE_COUNT + 1);
  assert.equal(
    result.registered_profile_identities.filter(
      (profile) => profile.inventory_disposition === 'APPROVE',
    ).length,
    PROFILE_COUNT,
  );
  assert.equal(
    result.registered_profile_identities.every(
      (profile) => profile.legal_grouping_pending_acknowledged === true,
    ),
    true,
  );
  assert.equal(
    sortedUnique(result.registered_profile_identities.map((profile) => profile.profile_id)).length,
    PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

test('REPRESENTATIONS inventory packet carries per-row shape summaries and no invented holds', () => {
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.packet);
  const packet = readRecord(REPRESENTATIONS_WORK3_BINDINGS.packet.path);

  assert.equal(packet.family_key, 'REPRESENTATIONS');
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.profile_review_items.length, PROFILE_COUNT);
  assert.equal(packet.honest_hold_summary.hold_row_count, 0);
  assert.deepEqual(packet.honest_hold_summary.hold_review_flags, []);
  assert.deepEqual(packet.honest_hold_summary.acknowledged_review_flags, [
    'CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
  ]);
  assert.equal(
    packet.honest_hold_summary.legal_grouping_review_pending_count,
    PROFILE_COUNT,
  );
  assert.equal(
    packet.honest_hold_summary.cross_family_knowledge_definition_link_only_count,
    KNOWLEDGE_COUNT,
  );
  assert.deepEqual(
    packet.honest_hold_summary.registered_subtype_buckets,
    [...REPRESENTATIONS_REGISTERED_SUBTYPE_BUCKETS].sort(),
  );
  assert.deepEqual(packet.honest_hold_summary.populated_subtype_buckets, [
    'STATUS_REPRESENTATION',
  ]);
  assert.equal(packet.honest_hold_summary.unpopulated_subtype_buckets.length, 5);
  assert.deepEqual(packet.subtype_bucket_counts, { STATUS_REPRESENTATION: PROFILE_COUNT });
  assert.deepEqual(packet.claim_definition_counts, {
    KNOWLEDGE_QUALIFIER: KNOWLEDGE_COUNT,
    REPRESENTATION_ACCURACY_STANDARD: PROFILE_COUNT - KNOWLEDGE_COUNT,
  });
  assert.equal(
    Object.values(packet.deal_counts).reduce((sum, count) => sum + count, 0),
    PROFILE_COUNT,
  );

  for (const item of packet.profile_review_items) {
    assert.equal(item.shape_summary.subtype_bucket, 'STATUS_REPRESENTATION');
    assert.equal(item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(item.review_completion_state, 'COMPLETE');
    assert.equal(typeof item.deal, 'string');
    assert.equal(item.proposed_technical_disposition, 'APPROVE');
    assert.equal(
      item.shape_summary.claim_definition_key === 'KNOWLEDGE_QUALIFIER',
      item.review_flags.includes('CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY'),
    );
  }
});

test('REPRESENTATIONS Ben disposition approves every row and acknowledges the grouping hold', () => {
  physicalBytes(REPRESENTATIONS_WORK3_BINDINGS.disposition);
  const disposition = readRecord(REPRESENTATIONS_WORK3_BINDINGS.disposition.path);

  assert.equal(disposition.reviewer, 'BEN_GOODCHILD');
  assert.equal(disposition.ben_rulings_digest, REPRESENTATIONS_BEN_RULINGS_BINDING.sha256);
  assert.equal(disposition.packet_digest, REPRESENTATIONS_WORK3_BINDINGS.packet.sha256);
  assert.equal(disposition.session_summary.approved_count, PROFILE_COUNT);
  assert.equal(disposition.session_summary.hold_count, 0);
  assert.equal(disposition.session_summary.reject_count, 0);
  assert.equal(disposition.profile_dispositions.length, PROFILE_COUNT);

  for (const row of disposition.profile_dispositions) {
    assert.equal(row.disposition, 'APPROVE');
    assert.equal(row.legal_grouping_pending_acknowledged, true);
    assert.deepEqual(row.hold_reason_flags, []);
  }
});

test('REPRESENTATIONS Ben rulings note reuses the sealed M5 programme rulings', () => {
  physicalBytes(REPRESENTATIONS_BEN_RULINGS_BINDING);
  const note = readFileSync(
    join(REPO_ROOT, REPRESENTATIONS_BEN_RULINGS_BINDING.path),
    'utf8',
  );
  const sealed = readRecord(`${CONTROL}/m5-programme-rulings.json`);
  assert.equal(note.includes(sealed.ruling_record_id), true);
  for (const ruling of sealed.rulings) {
    assert.equal(note.includes(ruling.ruling_id), true);
  }
});

test('REPRESENTATIONS Milestone A family package on disk validates 70 registered profiles', () => {
  physicalBytes(REPRESENTATIONS_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(REPRESENTATIONS_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.family_key, 'REPRESENTATIONS');
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:REPRESENTATIONS:PROFILE_SET_V1',
  );

  const work3Authority = readRecord(WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
  const memberInventory = {
    family_key: packageRecord.family_key,
    profile_set_version: packageRecord.profile_set_version,
    legal_decisions: packageRecord.legal_decisions,
    profile_ids: packageRecord.profiles.map((profile) => profile.profile_id),
    subtype_tree_id: packageRecord.subtype_tree.subtype_tree_id,
    match_fixture_record_ids: packageRecord.match_fixtures.map(
      (fixture) => fixture.match_fixture_id,
    ),
    dimension_evidence_ids: packageRecord.dimension_evidence.map(
      (evidence) => evidence.dimension_evidence_id,
    ),
    structure_fixture_ids: [],
  };
  const validation = validateSingleFamilyPackageInventory({
    work3Authority,
    familyKey: packageRecord.family_key,
    profileSetVersion: packageRecord.profile_set_version,
    benApprovalId: packageRecord.family_approval.ben_approval_id,
    legalDecisions: packageRecord.legal_decisions,
    members: {
      profiles: packageRecord.profiles,
      subtype_tree: packageRecord.subtype_tree,
      match_fixtures: packageRecord.match_fixtures,
      dimension_evidence: packageRecord.dimension_evidence,
      structure_fixture_members: packageRecord.structure_fixture_members,
    },
    memberInventory,
    inventoryFingerprint: packageRecord.family_approval.approved_inventory_digest,
  });
  assert.equal(validation.status, 'FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING');

  const phase4 = repsAuthoring.prepareRepresentationsFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
});

test('lawful Work3 fixture REPRESENTATIONS on-disk override tracks the sealed package bytes', () => {
  const encoded = readFileSync(join(REPO_ROOT, LAWFUL_WORK3_FIXTURE_PATH), 'utf8').trim();
  const fixture = JSON.parse(
    gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'),
  );
  const body = { ...fixture };
  delete body.fixture_digest;
  assert.equal(
    fixture.fixture_digest,
    sha256Hex(Buffer.from(canonicalJson(body), 'utf8')),
    'lawful Work3 fixture digest is stale',
  );
  const override = fixture.on_disk_family_package_overrides.find(
    (entry) => entry.family_key === 'REPRESENTATIONS',
  );
  assert.ok(override, 'lawful Work3 fixture has no REPRESENTATIONS on-disk override');
  assert.equal(override.binding.path, REPRESENTATIONS_FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      REPRESENTATIONS_FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
