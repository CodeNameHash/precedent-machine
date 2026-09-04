'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');
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

let ccAuthoring;
try {
  ccAuthoring = require('../lib/canonical-v2/m7-v2-closing-conditions-authoring.js');
} catch (error) {
  throw new Error('CLOSING_CONDITIONS authoring facade module is missing.');
}

for (const exportName of [
  'prepareClosingConditionsPhase2FamilyProposal',
  'prepareClosingConditionsFamilyProfilePackageReview',
  'prepareClosingConditionsWork3UnapprovedInventoryReview',
  'prepareClosingConditionsWork3BenInventorySessionDisposition',
  'prepareClosingConditionsWork3FamilyPackageSeal',
  'prepareClosingConditionsWork3FamilyPackageRegistration',
]) {
  if (typeof ccAuthoring[exportName] !== 'function') {
    throw new Error(`CLOSING_CONDITIONS facade export ${exportName} is missing.`);
  }
}

const PROFILE_COUNT = ccAuthoring.CLOSING_CONDITIONS_PROFILE_COUNT;
const APPROVE_COUNT = ccAuthoring.CLOSING_CONDITIONS_WORK3_APPROVE_COUNT;
const HOLD_COUNT = ccAuthoring.CLOSING_CONDITIONS_WORK3_HOLD_COUNT;
const HOLD_REVIEW_FLAGS = ccAuthoring.CLOSING_CONDITIONS_WORK3_HOLD_REVIEW_FLAGS;

const CLOSING_CONDITIONS_PHASE2_AUTHORITY_BINDING = Object.freeze({
  byte_length: ccAuthoring.CLOSING_CONDITIONS_PHASE2_AUTHORITY_BYTES,
  path: ccAuthoring.CLOSING_CONDITIONS_PHASE2_AUTHORITY_PATH,
  record_id: ccAuthoring.CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID,
  record_id_field: 'closing_conditions_authoring_phase2_authority_id',
  schema_version: ccAuthoring.CLOSING_CONDITIONS_PHASE2_AUTHORITY_SCHEMA,
  sha256: ccAuthoring.CLOSING_CONDITIONS_PHASE2_AUTHORITY_SHA256,
});

const CLOSING_CONDITIONS_PHASE4_AUTHORITY_BINDING = Object.freeze({
  byte_length: ccAuthoring.CLOSING_CONDITIONS_PHASE4_AUTHORITY_BYTES,
  path: ccAuthoring.CLOSING_CONDITIONS_PHASE4_AUTHORITY_PATH,
  record_id: ccAuthoring.CLOSING_CONDITIONS_PHASE4_AUTHORITY_ID,
  record_id_field:
    'closing_conditions_authoring_phase4_family_profile_package_review_authority_id',
  schema_version: ccAuthoring.CLOSING_CONDITIONS_PHASE4_AUTHORITY_SCHEMA,
  sha256: ccAuthoring.CLOSING_CONDITIONS_PHASE4_AUTHORITY_SHA256,
});

const CLOSING_CONDITIONS_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2026,
    path: `${CONTROL}/m7-v2-repair-contract-work3-closing-conditions-unapproved-inventory-review-authority.json`,
    record_id: '8f18ec232b2963e4790538029af3058301078229a31436022d0f420b33650b9a',
    record_id_field: 'work3_closing_conditions_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'edc9d7dfc5a3621cc85651d511beaca779c20e5dabba7da6a102e3a5513a2b1f',
  }),
  packet: Object.freeze({
    byte_length: 60503,
    path: `${CONTROL}/m7-v2-repair-closing-conditions-57-profile-inventory-review-packet-draft.json`,
    record_id: '7f776cd1701803469d253a15d8c9654699394ae46afbe7a30b24c17108a59570',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_57_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '9369ae687af3b5188d63d8ed6d47e02edd3b8c9063a2b05c65341371ff2881cf',
  }),
  disposition: Object.freeze({
    byte_length: 17826,
    path: `${CONTROL}/m7-v2-repair-closing-conditions-57-profile-inventory-disposition.json`,
    record_id: 'b715428f1317f070f6503c58adb5e5e9b79f0f94dce24caf2e6c835298eec1a8',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_57_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '054c83aa5fda2ac59d836ba0dc67c24747b7570e1ba36a5727e0fd87d1992fad',
  }),
  session: Object.freeze({
    byte_length: 1138,
    path: `${CONTROL}/m7-v2-repair-closing-conditions-ben-inventory-session-receipt.json`,
    record_id: '1e4d745793602dc5b6db048bb5e61f621be2133bd8523b9570d987bfe6671fa5',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: 'aaabeb52801f944538ee546b27750603af4f1dee424674ab4946709e53132f58',
  }),
  benAuthority: Object.freeze({
    byte_length: 2805,
    path: `${CONTROL}/m7-v2-repair-contract-work3-closing-conditions-ben-inventory-session-successor-authority.json`,
    record_id: 'ca354e360aa4fc8596902bf9fe3ba138248ffb90bae9ee784427eb09e887c008',
    record_id_field: 'work3_closing_conditions_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '9efaedceed5fa3da813ab599102ee340733731af0685acb37f9ac4c810292d98',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3366,
    path: `${CONTROL}/m7-v2-repair-contract-work3-closing-conditions-family-package-seal-successor-authority.json`,
    record_id: '9c7bb2dab9255a82ca09723404ba388c2a80c5050443cb4e041740c72c1d9d65',
    record_id_field: 'work3_closing_conditions_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: 'c43eefe28cdd8b2a0437bad82ef47c2a2414c88b6c5b7aad60691b5451cf16e3',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2169,
    path: `${CONTROL}/m7-v2-repair-closing-conditions-family-package-seal-receipt.json`,
    record_id: '0c9f7d42ad65097a0915b4312de8f219bad67b581536c217e0bfbfef375370e5',
    record_id_field: 'closing_conditions_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '964290f90ac54add6e1c94885f1d06b3a5e7bdd0332507612c1e9ac3b77bdbdc',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2942,
    path: `${CONTROL}/m7-v2-repair-contract-work3-closing-conditions-registration-successor-authority.json`,
    record_id: 'f982e8f13f8fb70d7f7f4b0ab038c74053e9c2eeded8ab7710e10296d6c4127a',
    record_id_field: 'work3_closing_conditions_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '54218aa53c07c9b8d7c913f54e7fb768c0e8cf32060ec38a3bc8a39740202264',
  }),
});

const CLOSING_CONDITIONS_BEN_RULINGS_BINDING = Object.freeze({
  byte_length: 5023,
  path: 'docs/codex-program/notes/CLOSING-CONDITIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: 'd245a19637fa08088c012ca950cd1d2d822c60320b710278c7a9c6edeeb1a8f3',
});

const CLOSING_CONDITIONS_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  byte_length: 716388,
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-closing-conditions.json`,
  record_id: 'ef1c7b0cf3e04160c28db0bda6b7a1d2d1f060d36afed653ef0b6bfb45f66208',
  record_id_field: 'family_profile_package_id',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  sha256: '557315cc5d5aec3acac98f9e2473fc6c784f2eab5c9e400c484e58e7571a1009',
});

const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const CLOSING_CONDITIONS_CLASSIFICATION_BUCKETS = Object.freeze([
  'STOCKHOLDER_APPROVAL',
  'REGULATORY_APPROVAL',
  'LEGAL_RESTRAINT',
  'S4_EFFECTIVENESS',
  'OFFICER_CERTIFICATE',
  'COVENANT_COMPLIANCE',
  'NO_MAE',
  'LISTING',
  'FRUSTRATION',
]);

const CLOSING_CONDITIONS_PHASE4_PROFILE_KEYS = Object.freeze([
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
  physicalBytes(CLOSING_CONDITIONS_PHASE2_AUTHORITY_BINDING);
  const closingConditionsAuthoringPhase2Authority = sourceEnvelope(
    CLOSING_CONDITIONS_PHASE2_AUTHORITY_BINDING,
  );
  return {
    closingConditionsAuthoringPhase2Authority,
    governedSources: governedSources(closingConditionsAuthoringPhase2Authority.record),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    closingConditionsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(CLOSING_CONDITIONS_PHASE4_AUTHORITY_BINDING),
    closingConditionsAuthoringPhase2Authority:
      fixture.closingConditionsAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3ClosingConditionsUnapprovedInventoryReviewAuthority:
      sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.inventoryAuthority),
    work3ClosingConditionsBenInventorySessionSuccessorAuthority:
      sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.benAuthority),
    work3ClosingConditionsFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.sealAuthority),
    work3ClosingConditionsRegistrationSuccessorAuthority:
      sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(CLOSING_CONDITIONS_WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved CLOSING_CONDITIONS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.closingConditionsAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );

  const result = ccAuthoring.prepareClosingConditionsPhase2FamilyProposal(fixture);

  assertExactKeys(result, ccAuthoring.CLOSING_CONDITIONS_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.equal(result.family_key, 'CLOSING_CONDITIONS');
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.zero_m4_claim_gaps, true);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.deepEqual(result.authority_binding, CLOSING_CONDITIONS_PHASE2_AUTHORITY_BINDING);
  assert.equal(result.derived_profile_count, PROFILE_COUNT);
  assert.equal(result.proposed_partition.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(
    result.source_terminal_coverage.classification_buckets,
    CLOSING_CONDITIONS_CLASSIFICATION_BUCKETS,
  );
  assert.equal(result.m4_claim_accounting.expected_count, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.accounted_count, PROFILE_COUNT);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(Object.isFrozen(result), true);

  const signatures = result.proposed_partition.proposed_profiles.map(
    (profile) => profile.canonical_tuple.required_expression_signature,
  );
  assert.equal(sortedUnique(signatures).length, PROFILE_COUNT);
});

test('Phase4 CLOSING_CONDITIONS package review returns 57 unapproved proposals without Work3 identities', () => {
  physicalBytes(CLOSING_CONDITIONS_PHASE4_AUTHORITY_BINDING);
  const authority = readRecord(CLOSING_CONDITIONS_PHASE4_AUTHORITY_BINDING.path);
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const result = ccAuthoring.prepareClosingConditionsFamilyProfilePackageReview(phase4Fixture());

  assertExactKeys(
    result,
    ccAuthoring.CLOSING_CONDITIONS_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_57_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: PROFILE_COUNT,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_hold_row_count: HOLD_COUNT,
    work3_identity_count: 0,
  });
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(
      profile,
      CLOSING_CONDITIONS_PHASE4_PROFILE_KEYS,
      `${profile.proposed_profile_key} keys`,
    );
    assert.equal(profile.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:CLOSING_CONDITIONS:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }

  const holdRows = result.proposed_profiles.filter(
    (profile) => profile.review_flags.some((flag) => HOLD_REVIEW_FLAGS.includes(flag)),
  );
  assert.equal(holdRows.length, HOLD_COUNT);
});

test('Work3 CLOSING_CONDITIONS unapproved inventory review passes the validator without Work3 identity', () => {
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = ccAuthoring.prepareClosingConditionsWork3UnapprovedInventoryReview({
    closingConditionsWork3UnapprovedInventoryReviewEvidence: {
      work3ClosingConditionsUnapprovedInventoryReviewAuthority:
        evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
    },
    closingConditionsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_57_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.inventory_packet_reference.retained_source_gap_count, 0);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 CLOSING_CONDITIONS Ben inventory disposition captures 41 approve and 16 honest holds', () => {
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.benAuthority);
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = ccAuthoring.prepareClosingConditionsWork3BenInventorySessionDisposition({
    closingConditionsWork3BenInventorySessionDispositionEvidence: {
      work3ClosingConditionsUnapprovedInventoryReviewAuthority:
        evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
      work3ClosingConditionsBenInventorySessionSuccessorAuthority:
        evidence.work3ClosingConditionsBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    closingConditionsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: APPROVE_COUNT,
    hold_count: HOLD_COUNT,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    subtype_partition_hold_count: HOLD_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.deepEqual(result.ben_rulings_binding, CLOSING_CONDITIONS_BEN_RULINGS_BINDING);
  assert.equal(result.session_receipt_reference.completion_state, 'COMPLETE');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 CLOSING_CONDITIONS family package seal defers subtype partition without registering', () => {
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.session);
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = ccAuthoring.prepareClosingConditionsWork3FamilyPackageSeal({
    closingConditionsWork3FamilyPackageSealEvidence: {
      work3ClosingConditionsUnapprovedInventoryReviewAuthority:
        evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
      work3ClosingConditionsBenInventorySessionSuccessorAuthority:
        evidence.work3ClosingConditionsBenInventorySessionSuccessorAuthority,
      work3ClosingConditionsFamilyPackageSealSuccessorAuthority:
        evidence.work3ClosingConditionsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    closingConditionsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.family_package_seal_id,
    evidence.familyPackageSealReceipt.record.family_package_seal_id,
  );
  assert.equal(result.subtype_partition_disposition_binding.disposition_status, 'DEFERRED');
  assert.equal(
    result.subtype_partition_disposition_binding.subtype_partition_hold_count,
    HOLD_COUNT,
  );
  assert.equal(
    result.subtype_partition_disposition_binding.legal_grouping_review_pending_count,
    PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 CLOSING_CONDITIONS family package registration binds the seal receipt without activation', () => {
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.sealReceipt);
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = ccAuthoring.prepareClosingConditionsWork3FamilyPackageRegistration({
    closingConditionsWork3FamilyPackageRegistrationEvidence: evidence,
    closingConditionsPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'BEN_CLOSING_CONDITIONS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.equal(result.registered_profile_identities.length, PROFILE_COUNT);
  assert.equal(result.family_profile_package_identity.profile_id_count, PROFILE_COUNT);
  assert.equal(
    result.family_profile_package_identity.subtype_partition_disposition_state,
    'DEFERRED',
  );
  assert.equal(result.review_accounting.work3_identity_count, PROFILE_COUNT + 1);
  assert.equal(
    result.registered_profile_identities.filter(
      (profile) => profile.inventory_disposition === 'HOLD',
    ).length,
    HOLD_COUNT,
  );
  assert.equal(
    sortedUnique(result.registered_profile_identities.map((profile) => profile.profile_id)).length,
    PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

test('CLOSING_CONDITIONS inventory packet carries per-row shape summaries and honest hold flags', () => {
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.packet);
  const packet = readRecord(CLOSING_CONDITIONS_WORK3_BINDINGS.packet.path);

  assert.equal(packet.family_key, 'CLOSING_CONDITIONS');
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.profile_review_items.length, PROFILE_COUNT);
  assert.equal(packet.honest_hold_summary.hold_row_count, HOLD_COUNT);
  assert.deepEqual(packet.honest_hold_summary.hold_review_flags, [...HOLD_REVIEW_FLAGS]);
  assert.deepEqual(
    packet.honest_hold_summary.comparator_buckets_without_sealed_m5_label,
    ['COVENANT_COMPLIANCE', 'LISTING', 'NO_MAE'],
  );
  assert.deepEqual(
    packet.honest_hold_summary.m5_sealed_subtype_labels_without_comparator_instances,
    ['BRINGDOWN', 'TAX_OPINION'],
  );
  assert.deepEqual(
    Object.keys(packet.subtype_bucket_counts).sort(),
    [...CLOSING_CONDITIONS_CLASSIFICATION_BUCKETS].sort(),
  );
  assert.equal(
    Object.values(packet.subtype_bucket_counts).reduce((sum, count) => sum + count, 0),
    PROFILE_COUNT,
  );

  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary.subtype_bucket, 'string');
    assert.ok(item.shape_summary.subtype_bucket.length > 0);
    assert.equal(item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(item.review_completion_state, 'COMPLETE');
    assert.equal(typeof item.deal, 'string');
    assert.equal(
      item.proposed_technical_disposition,
      item.review_flags.some((flag) => HOLD_REVIEW_FLAGS.includes(flag)) ? 'HOLD' : 'APPROVE',
    );
  }
});

test('CLOSING_CONDITIONS Ben disposition holds every row whose bucket has no sealed M5 label', () => {
  physicalBytes(CLOSING_CONDITIONS_WORK3_BINDINGS.disposition);
  const disposition = readRecord(CLOSING_CONDITIONS_WORK3_BINDINGS.disposition.path);
  const packet = readRecord(CLOSING_CONDITIONS_WORK3_BINDINGS.packet.path);
  const bucketByKey = new Map(packet.profile_review_items.map(
    (item) => [item.proposed_profile_key, item.shape_summary.subtype_bucket],
  ));

  assert.equal(disposition.reviewer, 'BEN_GOODCHILD');
  assert.equal(disposition.ben_rulings_digest, CLOSING_CONDITIONS_BEN_RULINGS_BINDING.sha256);
  assert.equal(disposition.packet_digest, CLOSING_CONDITIONS_WORK3_BINDINGS.packet.sha256);
  assert.equal(disposition.session_summary.approved_count, APPROVE_COUNT);
  assert.equal(disposition.session_summary.hold_count, HOLD_COUNT);
  assert.equal(disposition.session_summary.reject_count, 0);

  const unsealedBuckets = new Set(['COVENANT_COMPLIANCE', 'LISTING', 'NO_MAE', 'FRUSTRATION']);
  for (const row of disposition.profile_dispositions) {
    const bucket = bucketByKey.get(row.proposed_profile_key);
    assert.equal(row.legal_grouping_pending_acknowledged, true);
    assert.equal(row.disposition, unsealedBuckets.has(bucket) ? 'HOLD' : 'APPROVE');
    assert.equal(row.hold_reason_flags.length > 0, row.disposition === 'HOLD');
  }
});

test('CLOSING_CONDITIONS Ben rulings note reuses the sealed M5 programme rulings', () => {
  physicalBytes(CLOSING_CONDITIONS_BEN_RULINGS_BINDING);
  const note = readFileSync(
    join(REPO_ROOT, CLOSING_CONDITIONS_BEN_RULINGS_BINDING.path),
    'utf8',
  );
  const sealed = readRecord(`${CONTROL}/m5-programme-rulings.json`);
  assert.equal(note.includes(sealed.ruling_record_id), true);
  for (const ruling of sealed.rulings) {
    assert.equal(note.includes(ruling.ruling_id), true);
  }
});

test('CLOSING_CONDITIONS Milestone A family package on disk validates 57 registered profiles', () => {
  physicalBytes(CLOSING_CONDITIONS_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(CLOSING_CONDITIONS_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.family_key, 'CLOSING_CONDITIONS');
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:CLOSING_CONDITIONS:PROFILE_SET_V1',
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

  const phase4 = ccAuthoring.prepareClosingConditionsFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
});

test('lawful Work3 fixture CLOSING_CONDITIONS on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'CLOSING_CONDITIONS',
  );
  assert.ok(override, 'lawful Work3 fixture has no CLOSING_CONDITIONS on-disk override');
  assert.equal(override.binding.path, CLOSING_CONDITIONS_FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      CLOSING_CONDITIONS_FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
