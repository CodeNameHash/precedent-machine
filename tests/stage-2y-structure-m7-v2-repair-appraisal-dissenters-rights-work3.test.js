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

let appraisalDissentersRightsAuthoring;
try {
  appraisalDissentersRightsAuthoring = require('../lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js');
} catch (error) {
  throw new Error('APPRAISAL_DISSENTERS_RIGHTS Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareAppraisalDissentersRightsPhase2FamilyProposal',
  'prepareAppraisalDissentersRightsFamilyProfilePackageReview',
  'prepareAppraisalDissentersRightsWork3UnapprovedInventoryReview',
  'prepareAppraisalDissentersRightsWork3BenInventorySessionDisposition',
  'prepareAppraisalDissentersRightsWork3FamilyPackageSeal',
  'prepareAppraisalDissentersRightsWork3FamilyPackageRegistration',
]) {
  if (typeof appraisalDissentersRightsAuthoring[facade] !== 'function') {
    throw new Error(`APPRAISAL_DISSENTERS_RIGHTS ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PROFILE_COUNT;
const FLAGS = appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'APPRAISAL_STATUS',
  'APPRAISAL_ENTITLEMENT',
  'WITHDRAWAL_RECONVERSION',
  'APPRAISAL_NOTICE',
  'NEGOTIATION_CONTROL',
  'SETTLEMENT_CONSENT',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_PATH,
  schema_version: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'appraisal_dissenters_rights_authoring_phase2_authority_id',
  record_id: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_ID,
  byte_length: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_BYTES,
  sha256: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE4_AUTHORITY_PATH,
  schema_version: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'appraisal_dissenters_rights_authoring_phase4_family_profile_package_review_authority_id',
  record_id: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE4_AUTHORITY_ID,
  byte_length: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE4_AUTHORITY_BYTES,
  sha256: appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2252,
    path: `${CONTROL}/m7-v2-repair-contract-work3-appraisal-dissenters-rights-unapproved-inventory-review-authority.json`,
    record_id: 'ccae233b4acd0eb37e10f051b80c7787b4297662c38e0f8ff1343b9f670834ff',
    record_id_field: 'work3_appraisal_dissenters_rights_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_APPRAISAL_DISSENTERS_RIGHTS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '21c84f4c34a6d6e8ee378759347c1be90604af445675ff60b72e7e151dee805d',
  }),
  packet: Object.freeze({
    byte_length: 7531,
    path: `${CONTROL}/m7-v2-repair-appraisal-dissenters-rights-5-profile-inventory-review-packet-draft.json`,
    record_id: 'a921ff983db9698df974d628c8143c51049745122a65b2452d67377f0bab7526',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_APPRAISAL_DISSENTERS_RIGHTS_5_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '3b5640a098a271f0ebb68f37088c7c673e61af547227cf2cfdd56550792592e1',
  }),
  disposition: Object.freeze({
    byte_length: 3545,
    path: `${CONTROL}/m7-v2-repair-appraisal-dissenters-rights-5-profile-inventory-disposition.json`,
    record_id: '67576f0f5f52b7466c1e1a08fa6824b7ce15c69f695e61b76a4908ad3bb6dcf7',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_APPRAISAL_DISSENTERS_RIGHTS_5_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '4f3d7d1e4a9c6f2e4da0cb8a6c0e31b734612c015da1b4f9ec67ce8de7244de2',
  }),
  session: Object.freeze({
    byte_length: 1171,
    path: `${CONTROL}/m7-v2-repair-appraisal-dissenters-rights-ben-inventory-session-receipt.json`,
    record_id: 'a90fe66ee7deba7294e351ac68712d0165e34b9d005361e2c591d5fdbcc8bcb4',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_APPRAISAL_DISSENTERS_RIGHTS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '8c130e3acf625e8b968f7829ee6763fe0e330c10c6d794bc4e0449130d4db400',
  }),
  benAuthority: Object.freeze({
    byte_length: 2965,
    path: `${CONTROL}/m7-v2-repair-contract-work3-appraisal-dissenters-rights-ben-inventory-session-successor-authority.json`,
    record_id: '284ebd3581b4781c9f2857afbefefe42e1a304642920d1c6427d879e1ee70287',
    record_id_field: 'work3_appraisal_dissenters_rights_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_APPRAISAL_DISSENTERS_RIGHTS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '7b4755b9e7ea78ae447f836954a8c9c6bd255b9e11809d59790fccf9a5b6f336',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3530,
    path: `${CONTROL}/m7-v2-repair-contract-work3-appraisal-dissenters-rights-family-package-seal-successor-authority.json`,
    record_id: '7c361ef7c77b728c36960190435ee5b91b05de10501915e28c2785613a7d63ad',
    record_id_field: 'work3_appraisal_dissenters_rights_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_APPRAISAL_DISSENTERS_RIGHTS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '7c86fce3cd6e589d11c41815d69d4ba5c8a8897c19fb4376075ae31dd8da7dad',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2364,
    path: `${CONTROL}/m7-v2-repair-appraisal-dissenters-rights-family-package-seal-receipt.json`,
    record_id: '9fbd9def150a5eb6660738be45660ddc6a0a8ee435288a07fa86734d822ddca9',
    record_id_field: 'appraisal_dissenters_rights_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_APPRAISAL_DISSENTERS_RIGHTS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '482f07517bc2834025c96c8601c2910447e05b1364f8c89ee3b5e9bd8454cf96',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 3058,
    path: `${CONTROL}/m7-v2-repair-contract-work3-appraisal-dissenters-rights-registration-successor-authority.json`,
    record_id: '426cea782c549bd11156c81a4911aca25c17c8f97830ae5d894868f3d997f0ff',
    record_id_field: 'work3_appraisal_dissenters_rights_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_APPRAISAL_DISSENTERS_RIGHTS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'e6741fa3e6cf91ea142078fb2b4ff7ed28344c8d5283c724d0bf7bf7bb9ece02',
  }),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights.json`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '4d269a4c0388edfcb616f0a1aefa7dfa0465a21c327ae224d0d53fc4967d0a4f',
  byte_length: 70317,
  sha256: 'dd5327e4037801753cb06d9725568580aca998967ae0ba9d63081ec324eb4f74',
});

const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const PHASE4_PROFILE_KEYS = Object.freeze([
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
const PHASE4_VALIDATION_KEYS = Object.freeze([
  'extraction_state',
  'issue_codes',
  'no_comparison_authority',
  'output_disposition',
  'source_quality',
]);
const PHASE4_WITHHELD_WORK3_FIELDS = Object.freeze([
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
  return { binding: structuredClone(binding), record: readRecord(binding.path) };
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

function phase2GovernedSources(authorityRecord) {
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
  physicalBytes(PHASE2_AUTHORITY_BINDING);
  const appraisalDissentersRightsAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    appraisalDissentersRightsAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      appraisalDissentersRightsAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    appraisalDissentersRightsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    appraisalDissentersRightsAuthoringPhase2Authority:
      fixture.appraisalDissentersRightsAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3AppraisalDissentersRightsBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3AppraisalDissentersRightsFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3AppraisalDissentersRightsRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved APPRAISAL_DISSENTERS_RIGHTS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.appraisalDissentersRightsAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 3);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.equal(
    authority.calibration_source_contract.exact_calibration_claim_count,
    PROFILE_COUNT,
  );
  assert.equal(authority.source_terminal_successor_contract.m4_silent_terminal_exact_count, 0);
  assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [SKECHERS_AGREEMENT_ID]: 2,
      [SKYWATER_AGREEMENT_ID]: 1,
      [TOPBUILD_AGREEMENT_ID]: 2,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    ['SETTLEMENT_CONSENT', 'WITHDRAWAL_RECONVERSION'],
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.required_expression_signature)).length,
    PROFILE_COUNT,
  );

  // Consideration (#15) owns appraisal-rights availability on shared sections (Q02 link-only).
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['CONSIDERATION', 'CONSIDERATION'],
  );

  const result = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_APPRAISAL_DISSENTERS_RIGHTS_FAMILY_PROPOSAL/V1',
    family_key: 'APPRAISAL_DISSENTERS_RIGHTS',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    zero_m4_claim_gaps: true,
  });
  assert.deepEqual(result.authority_binding, PHASE2_AUTHORITY_BINDING);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.equal(result.derived_profile_count, PROFILE_COUNT);
  assert.equal(result.proposed_partition.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(
    result.source_terminal_coverage.classification_buckets,
    CLASSIFICATION_BUCKETS,
  );
  assert.equal(result.m4_claim_accounting.expected_count, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.accounted_count, PROFILE_COUNT);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(result.authorised_rule_components.length, 0);
  assert.equal(result.proposed_partition.source_unit_assignment_count, PROFILE_COUNT);
  assert.equal(result.proposed_partition.m4_claim_assignment_count, PROFILE_COUNT);
  assert.deepEqual(result.unresolved_items, [
    'APPRAISAL_DISSENTERS_RIGHTS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    FLAGS.LEGAL_GROUPING,
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  const skechersSignatures = result.proposed_partition.proposed_profiles
    .map((profile) => profile.canonical_tuple.required_expression_signature)
    .filter((signature) => signature.includes('SKECHERS_2_7'))
    .sort();
  assert.deepEqual(skechersSignatures, [
    'APPRAISAL_DISSENTERS_RIGHTS::SETTLEMENT_CONSENT::SKECHERS_2_7_APPRAISAL_SETTLEMENT_CONSENT',
    'APPRAISAL_DISSENTERS_RIGHTS::WITHDRAWAL_RECONVERSION::SKECHERS_2_7_APPRAISAL_WITHDRAWAL_RECONVERSION',
  ]);
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 APPRAISAL_DISSENTERS_RIGHTS family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsPhase2FamilyProposal({
      appraisalDissentersRightsAuthoringPhase2Authority:
        fixture.appraisalDissentersRightsAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    appraisalDissentersRightsAuthoring.APPRAISAL_DISSENTERS_RIGHTS_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_5_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.deepEqual(result.phase2_proposal_reference, {
    schema_version: phase2Proposal.schema_version,
    proposal_id: phase2Proposal.proposal_id,
    source_unit_count: PROFILE_COUNT,
    claim_count: PROFILE_COUNT,
    derived_profile_count: PROFILE_COUNT,
  });
  assert.equal(result.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: 5,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: 5,
    outside_calibration_example_flag_count: 0,
    proposed_profile_count: 5,
    review_only_profile_count: 5,
    subtype_partition_divergence_flag_count: 5,
    work3_identity_count: 0,
  });
  assert.deepEqual(result.withheld_work3_fields, PHASE4_WITHHELD_WORK3_FIELDS);
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(profile, PHASE4_PROFILE_KEYS, `${profile.proposed_profile_key} keys`);
    assertExactKeys(
      profile.proposed_validation,
      PHASE4_VALIDATION_KEYS,
      `${profile.proposed_profile_key} validation`,
    );
    assert.equal(profile.review_flags.includes(FLAGS.LEGAL_GROUPING), true);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:APPRAISAL_DISSENTERS_RIGHTS:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 APPRAISAL_DISSENTERS_RIGHTS unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsWork3UnapprovedInventoryReview({
      appraisalDissentersRightsWork3UnapprovedInventoryReviewEvidence: {
        work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority:
          evidence.work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority,
      },
      appraisalDissentersRightsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_5_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 5);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 APPRAISAL_DISSENTERS_RIGHTS Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsWork3BenInventorySessionDisposition({
      appraisalDissentersRightsWork3BenInventorySessionDispositionEvidence: {
        work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority:
          evidence.work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority,
        work3AppraisalDissentersRightsBenInventorySessionSuccessorAuthority:
          evidence.work3AppraisalDissentersRightsBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      appraisalDissentersRightsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 5,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: 5,
    outside_calibration_example_count: 0,
    populated_subtype_bucket_count: 2,
    registered_subtype_bucket_count: 6,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count: 5,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 APPRAISAL_DISSENTERS_RIGHTS family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = appraisalDissentersRightsAuthoring.prepareAppraisalDissentersRightsWork3FamilyPackageSeal({
    appraisalDissentersRightsWork3FamilyPackageSealEvidence: {
      work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority:
        evidence.work3AppraisalDissentersRightsUnapprovedInventoryReviewAuthority,
      work3AppraisalDissentersRightsBenInventorySessionSuccessorAuthority:
        evidence.work3AppraisalDissentersRightsBenInventorySessionSuccessorAuthority,
      work3AppraisalDissentersRightsFamilyPackageSealSuccessorAuthority:
        evidence.work3AppraisalDissentersRightsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    appraisalDissentersRightsPhase4ReviewInput: phase4Fixture(),
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
    result.legal_grouping_disposition_binding.subtype_partition_divergence_count,
    5,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 APPRAISAL_DISSENTERS_RIGHTS family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsWork3FamilyPackageRegistration({
      appraisalDissentersRightsWork3FamilyPackageRegistrationEvidence: evidence,
      appraisalDissentersRightsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_APPRAISAL_DISSENTERS_RIGHTS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.equal(result.registered_profile_identities.length, PROFILE_COUNT);
  assert.equal(result.family_profile_package_identity.profile_id_count, PROFILE_COUNT);
  assert.equal(
    result.family_profile_package_identity.legal_grouping_disposition_state,
    'PENDING_LEGAL_REVIEW',
  );
  assert.equal(result.review_accounting.work3_identity_count, PROFILE_COUNT + 1);
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
  assert.equal(LOWERCASE_HEX_64.test(result.inventory_fingerprint), true);
});

test('Appraisal / dissenters-rights Milestone A inventory packet draft carries shape summaries and honest holds', () => {
  physicalBytes(WORK3_BINDINGS.packet);
  const packet = readRecord(WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.comparator_deal_count, 3);
  assert.equal(packet.review_workflow.subtype_grouping_pending_legal, true);
  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary, 'string');
    assert.ok(item.shape_summary.length > 0);
    assert.equal(item.review_flags.includes(FLAGS.LEGAL_GROUPING), true);
  }
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.SUBTYPE_DIVERGENCE),
    ).length,
    5,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    0,
  );
});

test('Appraisal / dissenters-rights Milestone A disposition approves 5 profiles and reuses only sealed M5 rulings', () => {
  physicalBytes(WORK3_BINDINGS.disposition);
  const disposition = readRecord(WORK3_BINDINGS.disposition.path);
  assert.equal(disposition.session_summary.approved_count, PROFILE_COUNT);
  assert.equal(disposition.session_summary.hold_count, 0);
  assert.equal(disposition.session_summary.subtype_grouping_pending_legal, true);
  assert.equal(disposition.sealed_ruling_reuse.new_family_specific_ruling_count, 0);
  assert.deepEqual(disposition.sealed_ruling_reuse.ruling_ids, [
    'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
    'M5-RULING-ONE-OPERATIVE-LIMB',
    'M5-RULING-ONE-SEMANTIC-OWNER',
  ]);
  assert.equal(
    disposition.profile_dispositions.filter((row) => row.disposition === 'APPROVE').length,
    PROFILE_COUNT,
  );
});

test('Appraisal / dissenters-rights Milestone A family profile package on disk validates 5 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:APPRAISAL_DISSENTERS_RIGHTS:PROFILE_SET_V1',
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

  const phase4 = appraisalDissentersRightsAuthoring
    .prepareAppraisalDissentersRightsFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),
    ['SETTLEMENT_CONSENT', 'SETTLEMENT_CONSENT', 'WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION'],
  );
});

test('lawful Work3 fixture APPRAISAL_DISSENTERS_RIGHTS on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'APPRAISAL_DISSENTERS_RIGHTS',
  );
  assert.ok(override, 'lawful Work3 fixture has no APPRAISAL_DISSENTERS_RIGHTS on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
