'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateSingleFamilyPackageInventory,
} = require('../lib/canonical-v2/m7-v2-contract');

const REPO_ROOT = join(__dirname, '..');

const GC_PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v2.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_GENERAL_COVENANTS_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'general_covenants_authoring_phase2_authority_id',
  record_id: 'a265c3bff03b7dcadc9da15812f2957c0bf41a0a2633be05afa1319e1c7dcd39',
  byte_length: 113323,
  sha256: 'f8aa0e233e74d736440908851bc51a611dee30ad1d93e6a8ed52577723b6e398',
});

const GC_PHASE2_PROPOSAL_KEYS = Object.freeze([
  'schema_version',
  'proposal_id',
  'family_key',
  'proposal_state',
  'profile_approval_state',
  'authority_binding',
  'm4_claim_accounting',
  'source_terminal_coverage',
  'zero_m4_claim_gaps',
  'symbolic_temporal_graphs',
  'temporal_state_reference_edges',
  'authorised_rule_components',
  'proposed_partition',
  'derived_profile_count',
  'inventory_digest',
  'unresolved_items',
]);

const GC_PHASE2_CLASSIFICATION_BUCKETS = Object.freeze([
  'ACCESS',
  'LITIGATION_NOTIFICATION',
  'GENERAL_NOTIFICATION',
  'SECTION_16',
  'DELISTING',
  'TAKEOVER_LAW',
  'MERGER_SUB_OBLIGATION',
  'PUBLICITY',
  'RESIGNATION',
  'CVR',
  'LISTING',
]);

const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const EXPECTED_PROFILE_COUNT = 54;

let gcAuthoring;
try {
  gcAuthoring = require('../lib/canonical-v2/m7-v2-general-covenants-authoring.js');
} catch (error) {
  throw new Error('GENERAL_COVENANTS Phase2 proposal facade export is missing.');
}

if (typeof gcAuthoring.prepareGeneralCovenantsPhase2FamilyProposal !== 'function') {
  throw new Error('GENERAL_COVENANTS Phase2 proposal facade export is missing.');
}

if (typeof gcAuthoring.prepareGeneralCovenantsFamilyProfilePackageReview !== 'function') {
  throw new Error('GENERAL_COVENANTS Phase4 package review facade export is missing.');
}

const GC_PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-general-covenants-authoring-phase4-family-profile-package-review-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_GENERAL_COVENANTS_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
  record_id_field:
    'general_covenants_authoring_phase4_family_profile_package_review_authority_id',
  record_id: 'a429d7e26e6a6c521c7882684295b1696195cc1c630332c0f1451b2f352fc401',
  byte_length: 55131,
  sha256: '31d066474b7c755f23ab070b601923da813d2477f167c07f686911d75be3f69a',
});

const GC_PHASE4_OUTPUT_KEYS = Object.freeze([
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

const GC_PHASE4_PROFILE_KEYS = Object.freeze([
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

const GC_PHASE4_VALIDATION_KEYS = Object.freeze([
  'extraction_state',
  'issue_codes',
  'no_comparison_authority',
  'output_disposition',
  'source_quality',
]);

const GC_PHASE4_WITHHELD_WORK3_FIELDS = Object.freeze([
  'work3_profile_id',
  'work3_package_id',
  'work3_registration_id',
  'work3_activation_id',
  'work3_fixture_fact_id',
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
  return {
    binding: structuredClone(binding),
    record: readRecord(binding.path),
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function exactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value)) === canonicalJson(expected);
}

function assertExactKeys(value, expected, label) {
  assert.equal(exactKeys(value, expected), true, label);
}

function gcPhase2AuthorityEnvelope() {
  physicalBytes(GC_PHASE2_AUTHORITY_BINDING);
  return sourceEnvelope(GC_PHASE2_AUTHORITY_BINDING);
}

function gcPhase2GovernedSources(authorityRecord) {
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

function gcPhase2ProposalFixture() {
  const generalCovenantsAuthoringPhase2Authority = gcPhase2AuthorityEnvelope();
  return {
    generalCovenantsAuthoringPhase2Authority,
    governedSources: gcPhase2GovernedSources(
      generalCovenantsAuthoringPhase2Authority.record,
    ),
  };
}

function gcPhase4ProposalFixture() {
  const phase2Fixture = gcPhase2ProposalFixture();
  return {
    generalCovenantsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(GC_PHASE4_AUTHORITY_BINDING),
    generalCovenantsAuthoringPhase2Authority:
      phase2Fixture.generalCovenantsAuthoringPhase2Authority,
    governedSources: phase2Fixture.governedSources,
  };
}

test('Phase2 proposal derives a deterministic unapproved GENERAL_COVENANTS partition', async (t) => {
  const fixture = gcPhase2ProposalFixture();
  const authorityEnvelope = fixture.generalCovenantsAuthoringPhase2Authority;
  const authority = authorityEnvelope.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, EXPECTED_PROFILE_COUNT);
  assert.equal(authority.calibration_source_contract.exact_calibration_claim_count, EXPECTED_PROFILE_COUNT);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );

  const expectedClaimIds = sortedUnique(terminals.flatMap(
    (terminal) => terminal.m4_claim_ids,
  ));
  assert.equal(expectedClaimIds.length, EXPECTED_PROFILE_COUNT);

  const result = gcAuthoring.prepareGeneralCovenantsPhase2FamilyProposal(fixture);

  assertExactKeys(result, GC_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_GENERAL_COVENANTS_FAMILY_PROPOSAL/V1',
    family_key: 'GENERAL_COVENANTS',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    zero_m4_claim_gaps: true,
  });
  assert.deepEqual(result.authority_binding, GC_PHASE2_AUTHORITY_BINDING);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.equal(result.derived_profile_count, EXPECTED_PROFILE_COUNT);
  assert.equal(result.proposed_partition.proposed_profiles.length, EXPECTED_PROFILE_COUNT);
  assert.deepEqual(
    result.source_terminal_coverage.classification_buckets,
    GC_PHASE2_CLASSIFICATION_BUCKETS,
  );
  assert.equal(result.m4_claim_accounting.expected_count, EXPECTED_PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.accounted_count, EXPECTED_PROFILE_COUNT);
  assert.deepEqual(result.m4_claim_accounting.expected_claim_ids, expectedClaimIds);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(result.authorised_rule_components.length, 0);
  assert.deepEqual(result.unresolved_items, [
    'ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED',
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    'GENERAL_COVENANTS_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
  ]);
});

test('Phase4 GENERAL_COVENANTS family profile package review returns unapproved proposals without Work3 identities', async (t) => {
  const authorityBytes = physicalBytes(GC_PHASE4_AUTHORITY_BINDING);
  const authorityEnvelope = sourceEnvelope(GC_PHASE4_AUTHORITY_BINDING);
  const authority = authorityEnvelope.record;
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(authority)}\n`, 'utf8'),
  );
  assert.deepEqual(
    authority.immutable_parent_bindings.general_covenants_authoring_phase2_authority,
    GC_PHASE2_AUTHORITY_BINDING,
  );
  assert.equal(authority.profile_review_schedule.length, EXPECTED_PROFILE_COUNT);
  assert.equal(
    authority.profile_review_schedule_contract.exact_profile_count,
    EXPECTED_PROFILE_COUNT,
  );
  assert.equal(
    authority.profile_review_schedule_contract.schedule_canonical_json_sha256,
    gcAuthoring.GENERAL_COVENANTS_PHASE4_SCHEDULE_SHA256,
  );
  assert.equal(
    authority.design_basis.phase3_reference_materialisation_skipped,
    true,
  );

  const fixture = gcPhase4ProposalFixture();
  const phase2Proposal = gcAuthoring.prepareGeneralCovenantsPhase2FamilyProposal({
    generalCovenantsAuthoringPhase2Authority:
      fixture.generalCovenantsAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  });
  const result = gcAuthoring.prepareGeneralCovenantsFamilyProfilePackageReview(fixture);
  const outputContract = authority.candidate_output_contract;

  assertExactKeys(result, GC_PHASE4_OUTPUT_KEYS, 'Phase4 package review candidate keys');
  assert.equal(result.schema_version, outputContract.schema_version);
  assert.equal(result.family_key, 'GENERAL_COVENANTS');
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_54_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.deepEqual(result.authority_binding, GC_PHASE4_AUTHORITY_BINDING);
  assert.deepEqual(result.phase2_proposal_reference, {
    schema_version: phase2Proposal.schema_version,
    proposal_id: phase2Proposal.proposal_id,
    source_unit_count: EXPECTED_PROFILE_COUNT,
    claim_count: EXPECTED_PROFILE_COUNT,
    derived_profile_count: EXPECTED_PROFILE_COUNT,
  });
  assert.equal(result.proposed_profiles.length, EXPECTED_PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    access_scope_review_flag_count: 6,
    complete_profile_count: EXPECTED_PROFILE_COUNT,
    incomplete_profile_count: 0,
    proposed_profile_count: EXPECTED_PROFILE_COUNT,
    review_only_profile_count: EXPECTED_PROFILE_COUNT,
    work3_identity_count: 0,
  });
  assert.deepEqual(result.withheld_work3_fields, GC_PHASE4_WITHHELD_WORK3_FIELDS);
  assert.equal(result.first_legal_stop.work3_approval_payload_present, false);
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  const scheduleByKey = new Map(
    authority.profile_review_schedule.map((item) => [
      item.proposed_profile_key,
      item,
    ]),
  );
  const terminals = fixture.generalCovenantsAuthoringPhase2Authority.record
    .source_terminal_successor_contract.terminal_rule_registry;
  const terminalBySourceUnitKey = new Map(
    terminals.map((terminal) => [terminal.source_unit_key, terminal]),
  );
  for (const profile of result.proposed_profiles) {
    assertExactKeys(profile, GC_PHASE4_PROFILE_KEYS, `${profile.proposed_profile_key} profile keys`);
    assertExactKeys(
      profile.proposed_validation,
      GC_PHASE4_VALIDATION_KEYS,
      `${profile.proposed_profile_key} validation keys`,
    );
    const schedule = scheduleByKey.get(profile.proposed_profile_key);
    assert(schedule, profile.proposed_profile_key);
    assert.deepEqual(profile.proposed_validation, schedule.proposed_validation);
    assert.deepEqual(profile.review_flags, schedule.review_flags);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:GENERAL_COVENANTS:'), true);
    const terminal = terminalBySourceUnitKey.get(profile.source_unit_keys[0]);
    assert(terminal);
    if (terminal.classification_bucket === 'ACCESS') {
      assert.deepEqual(profile.review_flags, [
        'ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED',
      ]);
    } else {
      assert.deepEqual(profile.review_flags, []);
    }
    assert.deepEqual(profile.missing_required_field_keys, []);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
    assert.equal(Object.hasOwn(profile, 'reference_value_reviews'), false);
  }

  const phase2ProfileKeys = phase2Proposal.proposed_partition.proposed_profiles
    .map((profile) => profile.proposed_profile_key)
    .sort();
  const resultProfileKeys = result.proposed_profiles
    .map((profile) => profile.proposed_profile_key)
    .sort();
  assert.deepEqual(resultProfileKeys, phase2ProfileKeys);
});

const GC_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2014,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-general-covenants-unapproved-inventory-review-authority.json',
    record_id: '5cf8d088c1e99fa2396a1eb65c095068eec4737b16d5623dbe5d375b17290bc7',
    record_id_field: 'work3_general_covenants_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '8284374b317888fcefbde7399ef7fcfd65a3fa814067a6f30d3d27d27fffc509',
  }),
  packet: Object.freeze({
    byte_length: 51977,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-general-covenants-54-profile-inventory-review-packet-draft.json',
    record_id: 'd9a144126174d9eec0e7cec1862187ad058ea81905430f522a7609600517c303',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_54_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '32d66a6208266e63475a1b0982f5bbc8f1144ff417c02335e9a6e266f5538224',
  }),
  disposition: Object.freeze({
    byte_length: 11872,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-general-covenants-54-profile-inventory-disposition.json',
    record_id: '06c0cf6fa6ba1663af1f22a05f6f8150166a8a70ddba4c2ee3952fa97505232d',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_54_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '40192d483464f4d594817c84141d88b2ca787576c896135dad4fbba13cfc3fae',
  }),
  session: Object.freeze({
    byte_length: 1134,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-general-covenants-ben-inventory-session-receipt.json',
    record_id: 'a417680bb95ed58a858eff2ff86f75004a76a3f16446592f426498433b42b63f',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: 'fe11e75f24f8ca60d2abd53d1143ad810a2333d95f0e6ff2faba27a67d8a60bc',
  }),
  benAuthority: Object.freeze({
    byte_length: 2789,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-general-covenants-ben-inventory-session-successor-authority.json',
    record_id: '7e2269feaa12fe62bc66b79ea7ee8c05c73b3632ea1403fbb210057582620a87',
    record_id_field: 'work3_general_covenants_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'a77ac7efcc58d2748a8a6412edf055d28ea520a4e814dd5b1b2adc6c97cc2f71',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3313,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-general-covenants-family-package-seal-successor-authority.json',
    record_id: '7329318d9933667923ac0a75a047ed44b106fca69d7f11e449078e26558e7c84',
    record_id_field: 'work3_general_covenants_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '0ba865183ddd58f994f0ff9cc44fdca34c153c6016ea744dc919532ab85ba836',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2118,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-general-covenants-family-package-seal-receipt.json',
    record_id: '8ea713512fb1f1391d73cccae64fe4cccf18c7ce693b7acbb79bbd4016acae9f',
    record_id_field: 'general_covenants_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: 'd5eb545944fb888d163c313ad5bea4744e58abd821b18e649f9b6de73ec9393f',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2890,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-general-covenants-registration-successor-authority.json',
    record_id: '1cf99f145c5ce54884f1d05ebad9badb27d248cd5c405e6b3b8235ad538552a0',
    record_id_field: 'work3_general_covenants_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'fe8bd00c3f42ab79446724ef59ff233b3ce2d09e0d538505765c648747d95714',
  }),
});

const GC_WORK3_FAMILY_PACKAGE_SEAL_ID =
  'e64d55a46f9374be94fcd9e5b8f6287ea7fa113f70e24b2042109d9fae080c26';

const GC_WORK3_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-general-covenants.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: 'c82de67354f300f2368005c995b2ce0531625fc995042a4efbccf173e8510852',
  byte_length: 677028,
  sha256: '38cde42587342b79e574fa995c75916c1ea96c496c1c712e4cdff62836cc5393',
});

const GC_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';

function gcWork3Evidence() {
  return {
    work3GeneralCovenantsUnapprovedInventoryReviewAuthority:
      sourceEnvelope(GC_WORK3_BINDINGS.inventoryAuthority),
    work3GeneralCovenantsBenInventorySessionSuccessorAuthority:
      sourceEnvelope(GC_WORK3_BINDINGS.benAuthority),
    work3GeneralCovenantsFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(GC_WORK3_BINDINGS.sealAuthority),
    work3GeneralCovenantsRegistrationSuccessorAuthority:
      sourceEnvelope(GC_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(GC_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(GC_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(GC_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(GC_WORK3_BINDINGS.sealReceipt),
  };
}

test('Work3 GENERAL_COVENANTS unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(GC_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(GC_WORK3_BINDINGS.packet);
  const evidence = gcWork3Evidence();
  const result = gcAuthoring.prepareGeneralCovenantsWork3UnapprovedInventoryReview({
    generalCovenantsWork3UnapprovedInventoryReviewEvidence: {
      work3GeneralCovenantsUnapprovedInventoryReviewAuthority:
        evidence.work3GeneralCovenantsUnapprovedInventoryReviewAuthority,
    },
    generalCovenantsPhase4ReviewInput: gcPhase4ProposalFixture(),
  });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_54_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, EXPECTED_PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
  assert.equal(Object.isFrozen(result), true);
});

test('Work3 GENERAL_COVENANTS Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(GC_WORK3_BINDINGS.benAuthority);
  physicalBytes(GC_WORK3_BINDINGS.disposition);
  const evidence = gcWork3Evidence();
  const result = gcAuthoring.prepareGeneralCovenantsWork3BenInventorySessionDisposition({
    generalCovenantsWork3BenInventorySessionDispositionEvidence: {
      work3GeneralCovenantsUnapprovedInventoryReviewAuthority:
        evidence.work3GeneralCovenantsUnapprovedInventoryReviewAuthority,
      work3GeneralCovenantsBenInventorySessionSuccessorAuthority:
        evidence.work3GeneralCovenantsBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    generalCovenantsPhase4ReviewInput: gcPhase4ProposalFixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, EXPECTED_PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 54,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    access_scope_item_44_acknowledged_count: 6,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_seal_state, 'NOT_RECORDED');
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 GENERAL_COVENANTS family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(GC_WORK3_BINDINGS.session);
  physicalBytes(GC_WORK3_BINDINGS.sealAuthority);
  const evidence = gcWork3Evidence();
  const result = gcAuthoring.prepareGeneralCovenantsWork3FamilyPackageSeal({
    generalCovenantsWork3FamilyPackageSealEvidence: {
      work3GeneralCovenantsUnapprovedInventoryReviewAuthority:
        evidence.work3GeneralCovenantsUnapprovedInventoryReviewAuthority,
      work3GeneralCovenantsBenInventorySessionSuccessorAuthority:
        evidence.work3GeneralCovenantsBenInventorySessionSuccessorAuthority,
      work3GeneralCovenantsFamilyPackageSealSuccessorAuthority:
        evidence.work3GeneralCovenantsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    generalCovenantsPhase4ReviewInput: gcPhase4ProposalFixture(),
  });

  assert.equal(result.family_package_seal_id, GC_WORK3_FAMILY_PACKAGE_SEAL_ID);
  assert.equal(result.family_package_seal_id,
    evidence.familyPackageSealReceipt.record.family_package_seal_id);
  assert.equal(result.access_scope_disposition_binding.disposition_status, 'DEFERRED');
  assert.equal(result.access_scope_disposition_binding.access_scope_item_44_review_count, 6);
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.registration_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 GENERAL_COVENANTS family package registration binds seal receipt without activation', () => {
  physicalBytes(GC_WORK3_BINDINGS.sealReceipt);
  physicalBytes(GC_WORK3_BINDINGS.registrationAuthority);
  const evidence = gcWork3Evidence();
  const result = gcAuthoring.prepareGeneralCovenantsWork3FamilyPackageRegistration({
    generalCovenantsWork3FamilyPackageRegistrationEvidence: evidence,
    generalCovenantsPhase4ReviewInput: gcPhase4ProposalFixture(),
  });

  assert.equal(
    result.candidate_state,
    'BEN_GENERAL_COVENANTS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.deepEqual(result.family_package_seal_receipt_binding, GC_WORK3_BINDINGS.sealReceipt);
  assert.equal(result.registered_profile_identities.length, EXPECTED_PROFILE_COUNT);
  assert.equal(result.family_profile_package_identity.profile_id_count, EXPECTED_PROFILE_COUNT);
  assert.equal(result.review_accounting.profile_identity_count, EXPECTED_PROFILE_COUNT);
  assert.equal(result.review_accounting.work3_identity_count, 55);
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(result.zero_effect_boundary.activation_count, 0);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

test('GENERAL_COVENANTS Milestone A inventory packet draft has shape_summary and review_flags for 54 profiles', () => {
  physicalBytes(GC_WORK3_BINDINGS.packet);
  const packet = readRecord(GC_WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, EXPECTED_PROFILE_COUNT);
  assert.equal(packet.complete_profile_count, EXPECTED_PROFILE_COUNT);
  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary, 'object');
    assert.ok(Array.isArray(item.review_flags));
    assert.equal(item.review_completion_state, 'COMPLETE');
  }
  const accessRows = packet.profile_review_items.filter((item) => (
    item.review_flags.includes('ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED')
  ));
  assert.equal(accessRows.length, 6);
});

test('GENERAL_COVENANTS Milestone A ben inventory disposition approves all 54 profiles with access-scope stamps acknowledged', () => {
  physicalBytes(GC_WORK3_BINDINGS.disposition);
  const disposition = readRecord(GC_WORK3_BINDINGS.disposition.path);
  assert.equal(disposition.session_summary.approved_count, EXPECTED_PROFILE_COUNT);
  assert.equal(disposition.session_summary.hold_count, 0);
  assert.equal(disposition.session_summary.access_scope_item_44_acknowledged_count, 6);
  assert.equal(disposition.session_summary.taxonomy_expansion_acknowledged, true);
  for (const row of disposition.profile_dispositions) {
    assert.equal(row.disposition, 'APPROVE');
    if (row.review_flags_acknowledged.includes('ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED')) {
      assert.equal(row.access_scope_item_44_acknowledged, true);
    }
  }
});

test('GENERAL_COVENANTS Milestone A family profile package on disk validates 54 registered profiles', () => {
  physicalBytes(GC_WORK3_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(GC_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, EXPECTED_PROFILE_COUNT);
  assert.equal(packageRecord.subtype_tree.completeness_state, 'TREE_OUTPUT_INCOMPLETE');
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:GENERAL_COVENANTS:PROFILE_SET_V1',
  );

  const work3Authority = readRecord(GC_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
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
  const result = validateSingleFamilyPackageInventory({
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
  assert.deepEqual(result, {
    status: 'FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING',
    family_key: 'GENERAL_COVENANTS',
    profile_set_version: 1,
    ben_approval_id: 'BEN_APPROVAL:GENERAL_COVENANTS:PROFILE_SET_V1',
    member_inventory: memberInventory,
    inventory_fingerprint: packageRecord.family_approval.approved_inventory_digest,
  });

  const phase4 = gcAuthoring.prepareGeneralCovenantsFamilyProfilePackageReview(
    gcPhase4ProposalFixture(),
  );
  const registration = gcAuthoring.prepareGeneralCovenantsWork3FamilyPackageRegistration({
    generalCovenantsWork3FamilyPackageRegistrationEvidence: gcWork3Evidence(),
    generalCovenantsPhase4ReviewInput: gcPhase4ProposalFixture(),
  });
  const packageKeys = packageRecord.profiles.map((profile) => profile.profile_key).sort();
  const phase4Keys = phase4.proposed_profiles
    .map((profile) => profile.package_profile_key)
    .sort();
  assert.deepEqual(packageKeys, phase4Keys);
  assert.equal(registration.registered_profile_identities.length, EXPECTED_PROFILE_COUNT);
});
