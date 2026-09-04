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

let antitrustAuthoring;
try {
  antitrustAuthoring = require('../lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js');
} catch (error) {
  throw new Error('ANTITRUST_REGULATORY authoring facade module is missing.');
}

for (const exportName of [
  'prepareAntitrustRegulatoryPhase2FamilyProposal',
  'prepareAntitrustRegulatoryFamilyProfilePackageReview',
  'prepareAntitrustRegulatoryWork3UnapprovedInventoryReview',
  'prepareAntitrustRegulatoryWork3BenInventorySessionDisposition',
  'prepareAntitrustRegulatoryWork3FamilyPackageSeal',
  'prepareAntitrustRegulatoryWork3FamilyPackageRegistration',
]) {
  if (typeof antitrustAuthoring[exportName] !== 'function') {
    throw new Error(`ANTITRUST_REGULATORY facade export ${exportName} is missing.`);
  }
}

const PROFILE_COUNT = antitrustAuthoring.ANTITRUST_REGULATORY_PROFILE_COUNT;
const M5_SUBTYPE_COUNT = antitrustAuthoring.ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT;
const FLAGS = antitrustAuthoring.ANTITRUST_REGULATORY_REVIEW_FLAGS;

const ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BINDING = Object.freeze({
  byte_length: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BYTES,
  path: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE2_AUTHORITY_PATH,
  record_id: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID,
  record_id_field: 'antitrust_regulatory_authoring_phase2_authority_id',
  schema_version: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SCHEMA,
  sha256: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SHA256,
});

const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BINDING = Object.freeze({
  byte_length: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BYTES,
  path: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE4_AUTHORITY_PATH,
  record_id: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ID,
  record_id_field:
    'antitrust_regulatory_authoring_phase4_family_profile_package_review_authority_id',
  schema_version: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SCHEMA,
  sha256: antitrustAuthoring.ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SHA256,
});

const ANTITRUST_REGULATORY_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2050,
    path: `${CONTROL}/m7-v2-repair-contract-work3-antitrust-regulatory-unapproved-inventory-review-authority.json`,
    record_id: '0d1d77aaba5fa12a31c89245d0b473dcc3784d125c5744c0cd3bece9fb85b4cf',
    record_id_field: 'work3_antitrust_regulatory_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'f8ecf198eb0f9e7af967dab8fd175375796938a08d95b6cff8650aa545fe11c8',
  }),
  packet: Object.freeze({
    byte_length: 83533,
    path: `${CONTROL}/m7-v2-repair-antitrust-regulatory-70-profile-inventory-review-packet-draft.json`,
    record_id: 'ad790f284e854c67adfb6d68dbeceb08c8ec174bb43ca21afad84ff677caae7f',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_70_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '444b487bc0b72929005d3bc027430ac30cce06954a16f60e2b230bb05a0aa533',
  }),
  disposition: Object.freeze({
    byte_length: 27477,
    path: `${CONTROL}/m7-v2-repair-antitrust-regulatory-70-profile-inventory-disposition.json`,
    record_id: '896b22b67502d4f893302620432d9ab760924e4b7394513cd06ab9f45f48825e',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_70_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: 'd58415a35b6329137b4ab802e555a8099dcdc723ea89b14d4906a68b30db772f',
  }),
  session: Object.freeze({
    byte_length: 1146,
    path: `${CONTROL}/m7-v2-repair-antitrust-regulatory-ben-inventory-session-receipt.json`,
    record_id: 'b9e7487bac0d1f61fe9d8b2c746b4433f6cd29ae8bcf770092e418c88281f864',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '48848f47bf0b5e80a5b6c9b7f8415525b94a77c46d746b92cecd7d355a7d1fcf',
  }),
  benAuthority: Object.freeze({
    byte_length: 2880,
    path: `${CONTROL}/m7-v2-repair-contract-work3-antitrust-regulatory-ben-inventory-session-successor-authority.json`,
    record_id: '9a3d3c0da46b51152345e1f0f2d782c2c6434cfb3dd9d582bd88b47c92bfbf4b',
    record_id_field: 'work3_antitrust_regulatory_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '88d7184993ae5d280ca6b10bfe142be9809371dfc9cf22958a3a0f207a68f752',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3416,
    path: `${CONTROL}/m7-v2-repair-contract-work3-antitrust-regulatory-family-package-seal-successor-authority.json`,
    record_id: 'e8e842aa34096fab99745e0c9f9ae0922b2ad4b4d6bc00a88589f1b8061aa921',
    record_id_field: 'work3_antitrust_regulatory_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: 'd3b951f67f1907f62aedb962a33b7b34fe0410d77819a231c3429d2f2f134482',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2364,
    path: `${CONTROL}/m7-v2-repair-antitrust-regulatory-family-package-seal-receipt.json`,
    record_id: 'f09a8e6936ea9f43088584e44753e2ec8b7373f18efe6dd3c69e20af823d0c61',
    record_id_field: 'antitrust_regulatory_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '5c002fea77efe119e1e29d3004acb18b6dd8a20067cd25396c5f971dc9dffd89',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2985,
    path: `${CONTROL}/m7-v2-repair-contract-work3-antitrust-regulatory-registration-successor-authority.json`,
    record_id: 'd40f182128e550528a6eb22ef443fc64d2a779cfd91a65f60f27c0f23304aa63',
    record_id_field: 'work3_antitrust_regulatory_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'defe7ccffcef20bab1952fe55fa94b0b3a6fca78e63fbd812d44871b84422b73',
  }),
});

const ANTITRUST_REGULATORY_BEN_RULINGS_BINDING = Object.freeze({
  byte_length: 1519,
  path: `${CONTROL}/m5-programme-rulings.json`,
  sha256: '2711dc5c958da271bfd86a154712c251978ac1f1aec713d22302946bf8f87497',
});

const ANTITRUST_REGULATORY_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-antitrust-regulatory.json`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: 'c1b1427e16b0c15004ace496ac76a6740ccd507e771de8e77a78d400fb8d7b2c',
  byte_length: 880012,
  sha256: 'b022be3d589976484fae005da601a544c76a840d227b9e50ffb7153c6a4c5aa2',
});

const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKETS = Object.freeze([
  'EFFORTS',
  'FILING_OBLIGATION',
  'FILING_DEADLINE',
  'BURDEN',
  'LITIGATION',
  'TIMING_AGREEMENT',
  'STRATEGY_CONTROL',
  'CONSULTATION',
  'COOPERATION',
  'INFORMATION_SHARING',
  'NON_IMPEDIMENT',
  'REGULATORY_REQUEST_RESPONSE',
]);

const ANTITRUST_REGULATORY_PHASE4_PROFILE_KEYS = Object.freeze([
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
  physicalBytes(ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BINDING);
  const antitrustRegulatoryAuthoringPhase2Authority = sourceEnvelope(
    ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BINDING,
  );
  return {
    antitrustRegulatoryAuthoringPhase2Authority,
    governedSources: governedSources(antitrustRegulatoryAuthoringPhase2Authority.record),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    antitrustRegulatoryAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BINDING),
    antitrustRegulatoryAuthoringPhase2Authority:
      fixture.antitrustRegulatoryAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
      sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.inventoryAuthority),
    work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority:
      sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.benAuthority),
    work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.sealAuthority),
    work3AntitrustRegulatoryRegistrationSuccessorAuthority:
      sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(ANTITRUST_REGULATORY_WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic claim-scale ANTITRUST_REGULATORY partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.antitrustRegulatoryAuthoringPhase2Authority.record;
  const successor = authority.source_terminal_successor_contract;
  const terminals = successor.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(successor.classification_path_registry.map(
      (entry) => entry.classification_bucket,
    )).sort(),
    [
      'BURDEN', 'CONSULTATION', 'COOPERATION', 'EFFORTS', 'FILING_DEADLINE',
      'FILING_OBLIGATION', 'FILING_TIMING_STANDARD', 'INFORMATION_SHARING',
      'LITIGATION', 'NON_IMPEDIMENT', 'NOTIFICATION', 'STRATEGY_CONTROL',
      'TIMING_AGREEMENT', 'WITHDRAWAL_REFILING',
    ].sort(),
  );
  for (const terminal of terminals) {
    assert.equal(terminal.m4_claim_ids.length, 1, terminal.source_unit_key);
  }

  const result = antitrustAuthoring.prepareAntitrustRegulatoryPhase2FamilyProposal(fixture);

  assertExactKeys(result, antitrustAuthoring.ANTITRUST_REGULATORY_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.equal(result.family_key, 'ANTITRUST_REGULATORY');
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.zero_m4_claim_gaps, true);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.deepEqual(result.authority_binding, ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BINDING);
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

test('Phase4 ANTITRUST_REGULATORY package review returns 70 unapproved proposals without Work3 identities', () => {
  physicalBytes(ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BINDING);
  const authority = readRecord(ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BINDING.path);
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);
  assert.equal(authority.implementation_contract.phase3_internal_function, null);

  const result = antitrustAuthoring.prepareAntitrustRegulatoryFamilyProfilePackageReview(phase4Fixture());

  assertExactKeys(
    result,
    antitrustAuthoring.ANTITRUST_REGULATORY_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_70_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: 70,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: 70,
    m5_subtype_bucket_partition_unresolved_flag_count: 6,
    non_hsr_filing_regime_flag_count: 5,
    one_sided_obligor_capacity_flag_count: 12,
    proposed_profile_count: 70,
    review_only_profile_count: 70,
    work3_identity_count: 0,
  });
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(
      profile,
      ANTITRUST_REGULATORY_PHASE4_PROFILE_KEYS,
      `${profile.proposed_profile_key} keys`,
    );
    assert.equal(profile.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(
      profile.package_profile_key.startsWith('PROFILE:ANTITRUST_REGULATORY:'),
      true,
    );
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }

  const m5SubtypeRows = result.proposed_profiles.filter(
    (profile) => profile.review_flags.includes('M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED'),
  );
  assert.equal(m5SubtypeRows.length, M5_SUBTYPE_COUNT);
});

test('Work3 ANTITRUST_REGULATORY unapproved inventory review passes the validator without Work3 identity', () => {
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = antitrustAuthoring.prepareAntitrustRegulatoryWork3UnapprovedInventoryReview({
    antitrustRegulatoryWork3UnapprovedInventoryReviewEvidence: {
      work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
        evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
    },
    antitrustRegulatoryPhase4ReviewInput: phase4Fixture(),
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

test('Work3 ANTITRUST_REGULATORY Ben inventory disposition approves 70 rows with the grouping hold acknowledged', () => {
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.benAuthority);
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = antitrustAuthoring.prepareAntitrustRegulatoryWork3BenInventorySessionDisposition({
    antitrustRegulatoryWork3BenInventorySessionDispositionEvidence: {
      work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
        evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
      work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority:
        evidence.work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    antitrustRegulatoryPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 70,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: 70,
    m5_subtype_bucket_partition_unresolved_count: 6,
    non_hsr_filing_regime_count: 5,
    one_sided_obligor_capacity_count: 12,
    populated_subtype_bucket_count: 14,
    registered_subtype_bucket_count: 12,
    taxonomy_expansion_acknowledged: true,
  });
  assert.deepEqual(result.ben_rulings_binding, ANTITRUST_REGULATORY_BEN_RULINGS_BINDING);
  assert.equal(result.session_receipt_reference.completion_state, 'COMPLETE');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 ANTITRUST_REGULATORY family package seal holds the subtype partition without registering', () => {
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.session);
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = antitrustAuthoring.prepareAntitrustRegulatoryWork3FamilyPackageSeal({
    antitrustRegulatoryWork3FamilyPackageSealEvidence: {
      work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
        evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
      work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority:
        evidence.work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority,
      work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority:
        evidence.work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    antitrustRegulatoryPhase4ReviewInput: phase4Fixture(),
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
    14,
  );
  assert.equal(
    result.legal_grouping_disposition_binding.registered_subtype_bucket_count,
    ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKETS.length,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 ANTITRUST_REGULATORY family package registration binds the seal receipt without activation', () => {
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.sealReceipt);
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = antitrustAuthoring.prepareAntitrustRegulatoryWork3FamilyPackageRegistration({
    antitrustRegulatoryWork3FamilyPackageRegistrationEvidence: evidence,
    antitrustRegulatoryPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'BEN_ANTITRUST_REGULATORY_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('ANTITRUST_REGULATORY inventory packet carries per-row shape summaries and no invented holds', () => {
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.packet);
  const packet = readRecord(ANTITRUST_REGULATORY_WORK3_BINDINGS.packet.path);

  assert.equal(packet.family_key, 'ANTITRUST_REGULATORY');
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.profile_review_items.length, PROFILE_COUNT);
  assert.equal(packet.honest_hold_summary.hold_row_count, 0);
  assert.deepEqual(packet.honest_hold_summary.hold_review_flags, []);
  assert.deepEqual(packet.honest_hold_summary.acknowledged_review_flags, [
    'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
  ]);
  assert.equal(
    packet.honest_hold_summary.legal_grouping_review_pending_count,
    PROFILE_COUNT,
  );
  assert.equal(
    packet.honest_hold_summary.m5_subtype_bucket_partition_unresolved_count,
    M5_SUBTYPE_COUNT,
  );
  assert.deepEqual(
    [...packet.honest_hold_summary.registered_subtype_buckets].sort(),
    [...ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKETS].sort(),
  );
  assert.deepEqual(
    packet.honest_hold_summary.populated_subtype_buckets,
    [
      'BURDEN',
      'CONSULTATION',
      'COOPERATION',
      'EFFORTS',
      'FILING_DEADLINE',
      'FILING_OBLIGATION',
      'FILING_TIMING_STANDARD',
      'INFORMATION_SHARING',
      'LITIGATION',
      'NON_IMPEDIMENT',
      'NOTIFICATION',
      'STRATEGY_CONTROL',
      'TIMING_AGREEMENT',
      'WITHDRAWAL_REFILING',
    ],
  );
  assert.deepEqual(packet.honest_hold_summary.unpopulated_subtype_buckets, [
    'REGULATORY_REQUEST_RESPONSE',
  ]);
  assert.equal(Object.keys(packet.subtype_bucket_counts).length, 14);
  assert.equal(
    Object.values(packet.deal_counts).reduce((sum, count) => sum + count, 0),
    PROFILE_COUNT,
  );

  for (const item of packet.profile_review_items) {
    assert.equal(
      ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKETS.includes(item.shape_summary.subtype_bucket)
        || [
          'FILING_TIMING_STANDARD',
          'NOTIFICATION',
          'WITHDRAWAL_REFILING',
        ].includes(item.shape_summary.subtype_bucket),
      true,
    );
    assert.equal(item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(item.review_completion_state, 'COMPLETE');
    assert.equal(typeof item.deal, 'string');
    assert.equal(item.proposed_technical_disposition, 'APPROVE');
    assert.equal(typeof item.shape_summary.claim_definition_key, 'string');
    if (item.review_flags.includes('M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED')) {
      assert.equal(
        ['FILING_TIMING_STANDARD', 'NOTIFICATION', 'WITHDRAWAL_REFILING'].includes(
          item.shape_summary.subtype_bucket,
        ),
        true,
      );
    }
  }
});

test('ANTITRUST_REGULATORY Ben disposition approves every row and acknowledges the grouping hold', () => {
  physicalBytes(ANTITRUST_REGULATORY_WORK3_BINDINGS.disposition);
  const disposition = readRecord(ANTITRUST_REGULATORY_WORK3_BINDINGS.disposition.path);

  assert.equal(disposition.reviewer, 'BEN_GOODCHILD');
  assert.equal(disposition.ben_rulings_digest, ANTITRUST_REGULATORY_BEN_RULINGS_BINDING.sha256);
  assert.equal(disposition.packet_digest, ANTITRUST_REGULATORY_WORK3_BINDINGS.packet.sha256);
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

test('ANTITRUST_REGULATORY Ben rulings note reuses the sealed M5 programme rulings', () => {
  physicalBytes(ANTITRUST_REGULATORY_BEN_RULINGS_BINDING);
  const note = readFileSync(
    join(REPO_ROOT, ANTITRUST_REGULATORY_BEN_RULINGS_BINDING.path),
    'utf8',
  );
  const sealed = readRecord(`${CONTROL}/m5-programme-rulings.json`);
  assert.equal(note.includes(sealed.ruling_record_id), true);
  for (const ruling of sealed.rulings) {
    assert.equal(note.includes(ruling.ruling_id), true);
  }
});

test('ANTITRUST_REGULATORY Milestone A family package on disk validates 70 registered profiles', () => {
  physicalBytes(ANTITRUST_REGULATORY_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(ANTITRUST_REGULATORY_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.family_key, 'ANTITRUST_REGULATORY');
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:ANTITRUST_REGULATORY:PROFILE_SET_V1',
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

  const phase4 = antitrustAuthoring.prepareAntitrustRegulatoryFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
});

test('lawful Work3 fixture ANTITRUST_REGULATORY on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'ANTITRUST_REGULATORY',
  );
  assert.ok(override, 'lawful Work3 fixture has no ANTITRUST_REGULATORY on-disk override');
  assert.equal(override.binding.path, ANTITRUST_REGULATORY_FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      ANTITRUST_REGULATORY_FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
