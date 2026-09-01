'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { gunzipSync } = require('node:zlib');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateSingleFamilyPackageInventory,
} = require('../lib/canonical-v2/m7-v2-contract');

const REPO_ROOT = join(__dirname, '..');

const DNO_PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'dno_indemnification_authoring_phase2_authority_id',
  record_id: '37573af1b980fb772fdafef7ec1001c6edc2370c05de3d12cf9bece01b76886e',
  byte_length: 79707,
  sha256: '435dafee043efa0290e68e919be9351b7907fe271ad3b0307bef31182e21ee96',
});

const DNO_PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
  record_id_field:
    'dno_indemnification_authoring_phase4_family_profile_package_review_authority_id',
  record_id: '6deefbb6f76c9e4528c7cc281fd76cc6b1aea6cb85b00b79d574cc464c8a3ee5',
  byte_length: 35019,
  sha256: '5f89d018f68826bebee47be4971f0aed02356b8c69049d12eedb91d8d2bcdce7',
});

const DNO_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2038,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-dno-indemnification-unapproved-inventory-review-authority.json',
    record_id: '864a8bdd54537aae0633bae6399d745fd94978977ddc38d58c581fff26b8fae8',
    record_id_field: 'work3_dno_indemnification_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'bee96fa021b4fcb3dd293bfc98119b809c9680fed0066459ad6cda506a1c564a',
  }),
  packet: Object.freeze({
    byte_length: 20022,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-dno-31-profile-inventory-review-packet-draft.json',
    record_id: 'c807c7c53d1077299cca9002384d9ed24aee851d1cc7af1d9211b473e0a6bc36',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_31_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: 'aef0f854f4add5388ab92f9d3a40307c9e0eaf4d8abaae7fe8b47181e285746c',
  }),
  disposition: Object.freeze({
    byte_length: 7519,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-dno-31-profile-inventory-disposition.json',
    record_id: '8ccad1f245ba2fdd17db762fcda4c722ae87728e95b900acb07e6a1bc39009a9',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_31_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '25b59845b4e12f0e59fc782db89252ec40eb90e3c5ee85f182acdc79eee816cd',
  }),
  session: Object.freeze({
    byte_length: 1110,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-dno-ben-inventory-session-receipt.json',
    record_id: '2724ed20e0f3c9fc4a760cd633d21904f11f9278065c9d058bd5f9c2a282c83e',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '31416a526ede14105efe3e3c0add8598eb372ddadcce8046c1ea59e097345399',
  }),
  benAuthority: Object.freeze({
    byte_length: 2787,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-dno-indemnification-ben-inventory-session-successor-authority.json',
    record_id: '4fc9371172caa3ca648267d9d8098343c7c3b702499f7d16f06e7eea6679ccbc',
    record_id_field: 'work3_dno_indemnification_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '69463cc14e20f5c54de688aacd26b436020f4aaaff499c84dae12dab817c8725',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3302,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-dno-indemnification-family-package-seal-successor-authority.json',
    record_id: '3e667bb204322f39a0af0b40bc8949a519159eb342d2daa6f10d0e1aa15b4298',
    record_id_field: 'work3_dno_indemnification_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '533549187d9053dd009e3ecdc11fb4764eddbf9b1e5bd5483dc3d07e3164db52',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2067,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-dno-indemnification-family-package-seal-receipt.json',
    record_id: '245c5274a39a0f4ebbd811b9ca0c8efda715880d8fdfe7665ccbd2cb40908811',
    record_id_field: 'dno_indemnification_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '4f6b831e72617c9b6ff3d68a4c225914042ffb529bc46ac1cc06e8ed4ed89735',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2926,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-dno-indemnification-registration-successor-authority.json',
    record_id: '1e0ff2a2002a848e27cccd3e62e7b08d96dfa490a1a607f223c1d10e5daf3b7c',
    record_id_field: 'work3_dno_indemnification_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'c9ef7402519e55d28b472d2ded01ef492bf24be37bfa0ed33469d14f9f32c88a',
  }),
});

const DNO_PHASE4_OUTPUT_KEYS = Object.freeze([
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

const DNO_PHASE4_PROFILE_KEYS = Object.freeze([
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

const DNO_PHASE4_VALIDATION_KEYS = Object.freeze([
  'extraction_state',
  'issue_codes',
  'no_comparison_authority',
  'output_disposition',
  'source_quality',
]);

const DNO_PHASE4_WITHHELD_WORK3_FIELDS = Object.freeze([
  'work3_profile_id',
  'work3_package_id',
  'work3_registration_id',
  'work3_activation_id',
  'work3_fixture_fact_id',
]);

const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';

const DNO_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

const DNO_PHASE2_CLASSIFICATION_BUCKETS = Object.freeze([
  'INDEMNIFICATION_AND_EXCULPATION',
  'EXPENSE_ADVANCEMENT',
  'CHARTER_AND_CONTRACT_CONTINUATION',
  'DNO_INSURANCE_TAIL',
  'CLAIMS_PROCEDURE',
  'SUCCESSOR_ASSUMPTION',
  'THIRD_PARTY_ENFORCEMENT',
]);

const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

let dnoAuthoring;
try {
  dnoAuthoring = require('../lib/canonical-v2/m7-v2-dno-indemnification-authoring.js');
} catch (error) {
  throw new Error('DNO_INDEMNIFICATION Phase2 proposal facade export is missing.');
}

if (typeof dnoAuthoring.prepareDnoIndemnificationPhase2FamilyProposal !== 'function') {
  throw new Error('DNO_INDEMNIFICATION Phase2 proposal facade export is missing.');
}

if (typeof dnoAuthoring.prepareDnoIndemnificationFamilyProfilePackageReview !== 'function') {
  throw new Error('DNO_INDEMNIFICATION Phase4 package review facade export is missing.');
}

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

function dnoPhase2AuthorityEnvelope() {
  physicalBytes(DNO_PHASE2_AUTHORITY_BINDING);
  return sourceEnvelope(DNO_PHASE2_AUTHORITY_BINDING);
}

function dnoPhase2GovernedSources(authorityRecord) {
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

function dnoPhase2ProposalFixture() {
  const dnoIndemnificationAuthoringPhase2Authority = dnoPhase2AuthorityEnvelope();
  return {
    dnoIndemnificationAuthoringPhase2Authority,
    governedSources: dnoPhase2GovernedSources(
      dnoIndemnificationAuthoringPhase2Authority.record,
    ),
  };
}

function dnoPhase4ProposalFixture() {
  const phase2Fixture = dnoPhase2ProposalFixture();
  return {
    dnoIndemnificationAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(DNO_PHASE4_AUTHORITY_BINDING),
    dnoIndemnificationAuthoringPhase2Authority:
      phase2Fixture.dnoIndemnificationAuthoringPhase2Authority,
    governedSources: phase2Fixture.governedSources,
  };
}

function dnoWork3Evidence() {
  return {
    work3DnoIndemnificationUnapprovedInventoryReviewAuthority:
      sourceEnvelope(DNO_WORK3_BINDINGS.inventoryAuthority),
    work3DnoIndemnificationBenInventorySessionSuccessorAuthority:
      sourceEnvelope(DNO_WORK3_BINDINGS.benAuthority),
    work3DnoIndemnificationFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(DNO_WORK3_BINDINGS.sealAuthority),
    work3DnoIndemnificationRegistrationSuccessorAuthority:
      sourceEnvelope(DNO_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(DNO_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(DNO_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(DNO_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(DNO_WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved DNO_INDEMNIFICATION partition', async (t) => {
  const fixture = dnoPhase2ProposalFixture();
  const authorityEnvelope = fixture.dnoIndemnificationAuthoringPhase2Authority;
  const authority = authorityEnvelope.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, 31);
  assert.equal(authority.calibration_source_contract.exact_calibration_claim_count, 31);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );

  const expectedClaimIds = sortedUnique(terminals.flatMap(
    (terminal) => terminal.m4_claim_ids,
  ));
  assert.equal(expectedClaimIds.length, 31);

  const result = dnoAuthoring.prepareDnoIndemnificationPhase2FamilyProposal(fixture);

  assertExactKeys(result, DNO_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_DNO_INDEMNIFICATION_FAMILY_PROPOSAL/V1',
    family_key: 'DNO_INDEMNIFICATION',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    zero_m4_claim_gaps: true,
  });
  assert.deepEqual(result.authority_binding, DNO_PHASE2_AUTHORITY_BINDING);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.equal(result.derived_profile_count, 31);
  assert.equal(result.proposed_partition.proposed_profiles.length, 31);
  assert.deepEqual(
    result.source_terminal_coverage.classification_buckets,
    DNO_PHASE2_CLASSIFICATION_BUCKETS,
  );
  assert.equal(result.m4_claim_accounting.expected_count, 31);
  assert.equal(result.m4_claim_accounting.accounted_count, 31);
  assert.deepEqual(result.m4_claim_accounting.expected_claim_ids, expectedClaimIds);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(result.authorised_rule_components.length, 0);
});

test('Phase4 DNO_INDEMNIFICATION family profile package review returns unapproved proposals without Work3 identities', async (t) => {
  const authorityBytes = physicalBytes(DNO_PHASE4_AUTHORITY_BINDING);
  const authorityEnvelope = sourceEnvelope(DNO_PHASE4_AUTHORITY_BINDING);
  const authority = authorityEnvelope.record;
  assert.deepEqual(
    Buffer.from(authorityBytes),
    Buffer.from(`${canonicalJson(authority)}\n`, 'utf8'),
  );
  assertExactKeys(authority, [
    'authority_classification',
    'authority_state',
    'candidate_output_contract',
    'design_basis',
    'dno_indemnification_authoring_phase4_family_profile_package_review_authority_id',
    'execution_schedule',
    'first_legal_stop_contract',
    'forbidden_output_contract',
    'immutable_parent_bindings',
    'implementation_contract',
    'profile_review_schedule',
    'profile_review_schedule_contract',
    'schema_version',
    'zero_effect_boundary',
  ], 'Phase4 authority keys');
  const unsignedAuthority = structuredClone(authority);
  delete unsignedAuthority
    .dno_indemnification_authoring_phase4_family_profile_package_review_authority_id;
  assert.equal(
    contentId(authority.schema_version, unsignedAuthority),
    DNO_PHASE4_AUTHORITY_BINDING.record_id,
  );
  assert.deepEqual(
    authority.immutable_parent_bindings.dno_indemnification_authoring_phase2_authority,
    DNO_PHASE2_AUTHORITY_BINDING,
  );
  assert.equal(authority.profile_review_schedule.length, 31);
  assert.equal(
    authority.profile_review_schedule_contract.exact_profile_count,
    31,
  );
  assert.equal(
    authority.profile_review_schedule_contract.schedule_canonical_json_sha256,
    dnoAuthoring.DNO_INDEMNIFICATION_PHASE4_SCHEDULE_SHA256,
  );
  assert.equal(
    authority.design_basis.phase3_reference_materialisation_skipped,
    true,
  );

  const fixture = dnoPhase4ProposalFixture();
  const phase2Proposal = dnoAuthoring.prepareDnoIndemnificationPhase2FamilyProposal({
    dnoIndemnificationAuthoringPhase2Authority:
      fixture.dnoIndemnificationAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  });
  const result = dnoAuthoring.prepareDnoIndemnificationFamilyProfilePackageReview(fixture);
  const outputContract = authority.candidate_output_contract;

  assertExactKeys(result, DNO_PHASE4_OUTPUT_KEYS, 'Phase4 package review candidate keys');
  assert.equal(result.schema_version, outputContract.schema_version);
  assert.equal(result.family_key, 'DNO_INDEMNIFICATION');
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_31_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  const unsignedResult = structuredClone(result);
  delete unsignedResult.review_candidate_id;
  assert.equal(
    result.review_candidate_id,
    contentId(result.schema_version, unsignedResult),
  );
  assert.deepEqual(result.authority_binding, DNO_PHASE4_AUTHORITY_BINDING);
  assert.deepEqual(result.phase2_proposal_reference, {
    schema_version: phase2Proposal.schema_version,
    proposal_id: phase2Proposal.proposal_id,
    source_unit_count: 31,
    claim_count: 31,
    derived_profile_count: 31,
  });
  assert.equal(result.proposed_profiles.length, 31);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: 31,
    incomplete_profile_count: 0,
    linked_duty_review_flag_count: 5,
    proposed_profile_count: 31,
    review_only_profile_count: 31,
    work3_identity_count: 0,
  });
  assert.deepEqual(result.withheld_work3_fields, DNO_PHASE4_WITHHELD_WORK3_FIELDS);
  assert.equal(result.first_legal_stop.work3_approval_payload_present, false);
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  const scheduleByKey = new Map(
    authority.profile_review_schedule.map((item) => [
      item.proposed_profile_key,
      item,
    ]),
  );
  const terminals = fixture.dnoIndemnificationAuthoringPhase2Authority.record
    .source_terminal_successor_contract.terminal_rule_registry;
  const terminalBySourceUnitKey = new Map(
    terminals.map((terminal) => [terminal.source_unit_key, terminal]),
  );
  for (const profile of result.proposed_profiles) {
    assertExactKeys(profile, DNO_PHASE4_PROFILE_KEYS, `${profile.proposed_profile_key} profile keys`);
    assertExactKeys(
      profile.proposed_validation,
      DNO_PHASE4_VALIDATION_KEYS,
      `${profile.proposed_profile_key} validation keys`,
    );
    const schedule = scheduleByKey.get(profile.proposed_profile_key);
    assert(schedule, profile.proposed_profile_key);
    assert.deepEqual(profile.proposed_validation, schedule.proposed_validation);
    assert.deepEqual(profile.review_flags, schedule.review_flags);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:DNO_INDEMNIFICATION:'), true);
    const terminal = terminalBySourceUnitKey.get(profile.source_unit_keys[0]);
    assert(terminal);
    if (terminal.agreement_id === METSERA_AGREEMENT_ID) {
      assert.deepEqual(profile.review_flags, [
        'LINKED_DUTY_SHARED_SOURCE_REVIEW_UNAPPROVED',
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

test('Work3 DNO_INDEMNIFICATION unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(DNO_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(DNO_WORK3_BINDINGS.packet);
  const evidence = dnoWork3Evidence();
  const result = dnoAuthoring.prepareDnoIndemnificationWork3UnapprovedInventoryReview({
    dnoIndemnificationWork3UnapprovedInventoryReviewEvidence: {
      work3DnoIndemnificationUnapprovedInventoryReviewAuthority:
        evidence.work3DnoIndemnificationUnapprovedInventoryReviewAuthority,
    },
    dnoIndemnificationPhase4ReviewInput: dnoPhase4ProposalFixture(),
  });

  assert.equal(result.candidate_state,
    'UNAPPROVED_31_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED');
  assert.equal(result.inventory_packet_reference.profile_count, 31);
  assert.equal(result.inventory_packet_reference.complete_profile_count, 31);
  assert.equal(result.inventory_packet_reference.incomplete_profile_count, 0);
  assert.equal(result.inventory_packet_reference.retained_source_gap_count, 0);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
  assert.equal(Object.isFrozen(result), true);
});

test('Work3 DNO_INDEMNIFICATION Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(DNO_WORK3_BINDINGS.benAuthority);
  physicalBytes(DNO_WORK3_BINDINGS.disposition);
  const evidence = dnoWork3Evidence();
  const result = dnoAuthoring.prepareDnoIndemnificationWork3BenInventorySessionDisposition({
    dnoIndemnificationWork3BenInventorySessionDispositionEvidence: {
      work3DnoIndemnificationUnapprovedInventoryReviewAuthority:
        evidence.work3DnoIndemnificationUnapprovedInventoryReviewAuthority,
      work3DnoIndemnificationBenInventorySessionSuccessorAuthority:
        evidence.work3DnoIndemnificationBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    dnoIndemnificationPhase4ReviewInput: dnoPhase4ProposalFixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, 31);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 26,
    hold_count: 5,
    reject_count: 0,
    partial_count: 0,
    item_42_linked_duty_hold_count: 5,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_seal_state, 'NOT_RECORDED');
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 DNO_INDEMNIFICATION family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(DNO_WORK3_BINDINGS.session);
  physicalBytes(DNO_WORK3_BINDINGS.sealAuthority);
  const evidence = dnoWork3Evidence();
  const result = dnoAuthoring.prepareDnoIndemnificationWork3FamilyPackageSeal({
    dnoIndemnificationWork3FamilyPackageSealEvidence: {
      work3DnoIndemnificationUnapprovedInventoryReviewAuthority:
        evidence.work3DnoIndemnificationUnapprovedInventoryReviewAuthority,
      work3DnoIndemnificationBenInventorySessionSuccessorAuthority:
        evidence.work3DnoIndemnificationBenInventorySessionSuccessorAuthority,
      work3DnoIndemnificationFamilyPackageSealSuccessorAuthority:
        evidence.work3DnoIndemnificationFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    dnoIndemnificationPhase4ReviewInput: dnoPhase4ProposalFixture(),
  });

  assert.equal(result.family_package_seal_id,
    evidence.familyPackageSealReceipt.record.family_package_seal_id);
  assert.equal(result.linked_duty_disposition_binding.disposition_status, 'DEFERRED');
  assert.equal(result.linked_duty_disposition_binding.item_42_linked_duty_hold_count, 5);
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.registration_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 DNO_INDEMNIFICATION family package registration binds seal receipt without activation', () => {
  physicalBytes(DNO_WORK3_BINDINGS.sealReceipt);
  physicalBytes(DNO_WORK3_BINDINGS.registrationAuthority);
  const evidence = dnoWork3Evidence();
  const result = dnoAuthoring.prepareDnoIndemnificationWork3FamilyPackageRegistration({
    dnoIndemnificationWork3FamilyPackageRegistrationEvidence: evidence,
    dnoIndemnificationPhase4ReviewInput: dnoPhase4ProposalFixture(),
  });

  assert.equal(result.candidate_state,
    'BEN_DNO_INDEMNIFICATION_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT');
  assert.deepEqual(result.family_package_seal_receipt_binding,
    DNO_WORK3_BINDINGS.sealReceipt);
  assert.equal(result.registered_profile_identities.length, 31);
  assert.equal(result.registered_profile_identities.every(
    (profile) => profile.phase3_profile_key === null,
  ), true);
  assert.equal(result.family_profile_package_identity.profile_id_count, 31);
  assert.equal(result.review_accounting.profile_identity_count, 31);
  assert.equal(result.review_accounting.work3_identity_count, 32);
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(result.zero_effect_boundary.activation_count, 0);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

const DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dno-indemnification.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: 'e5b568d8eaa764a63a17e4fc6337b3049c8cfa5163947cb230c120027c38395e',
  byte_length: 407522,
  sha256: '5fccaa143aed5deb4eecd81e9efaf3782930eaf282b069e6e5bc35f939acb0ed',
});

const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const DNO_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';

test('DNO Milestone A inventory packet draft has shape_summary and review_flags for 31 profiles', () => {
  physicalBytes(DNO_WORK3_BINDINGS.packet);
  const packet = readRecord(DNO_WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, 31);
  assert.equal(packet.complete_profile_count, 31);
  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary, 'string');
    assert.ok(item.shape_summary.length > 0);
    assert.ok(Array.isArray(item.review_flags));
    assert.equal(item.review_completion_state, 'COMPLETE');
  }
  const linkedDutyRows = packet.profile_review_items.filter((item) => (
    item.review_flags.includes('LINKED_DUTY_SHARED_SOURCE_REVIEW_UNAPPROVED')
  ));
  assert.equal(linkedDutyRows.length, 5);
});

test('DNO Milestone A ben inventory disposition records 26 APPROVE and 5 HOLD rows', () => {
  physicalBytes(DNO_WORK3_BINDINGS.disposition);
  const disposition = readRecord(DNO_WORK3_BINDINGS.disposition.path);
  assert.equal(disposition.session_summary.approved_count, 26);
  assert.equal(disposition.session_summary.hold_count, 5);
  assert.equal(disposition.session_summary.item_42_linked_duty_hold_count, 5);
  assert.equal(disposition.session_summary.taxonomy_expansion_acknowledged, true);
  const holds = disposition.profile_dispositions.filter((row) => row.disposition === 'HOLD');
  assert.equal(holds.length, 5);
  for (const row of holds) {
    assert.equal(row.disposition_reason, 'ITEM_42_LINKED_DUTY_SHARED_SOURCE_REVIEW_DEFERRED');
    assert.ok(row.linked_duty_deferred_acknowledged);
    assert.deepEqual(row.review_flags_acknowledged, [
      'LINKED_DUTY_SHARED_SOURCE_REVIEW_UNAPPROVED',
    ]);
  }
});

test('DNO Milestone A family profile package on disk validates 31 registered profiles', () => {
  physicalBytes(DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, 31);
  assert.equal(packageRecord.subtype_tree.completeness_state, 'TREE_OUTPUT_INCOMPLETE');
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:DNO_INDEMNIFICATION:PROFILE_SET_V1',
  );

  const work3Authority = readRecord(DNO_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
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
    family_key: 'DNO_INDEMNIFICATION',
    profile_set_version: 1,
    ben_approval_id: 'BEN_APPROVAL:DNO_INDEMNIFICATION:PROFILE_SET_V1',
    member_inventory: memberInventory,
    inventory_fingerprint: packageRecord.family_approval.approved_inventory_digest,
  });

  const phase4 = dnoAuthoring.prepareDnoIndemnificationFamilyProfilePackageReview(
    dnoPhase4ProposalFixture(),
  );
  const registration = dnoAuthoring.prepareDnoIndemnificationWork3FamilyPackageRegistration({
    dnoIndemnificationWork3FamilyPackageRegistrationEvidence: dnoWork3Evidence(),
    dnoIndemnificationPhase4ReviewInput: dnoPhase4ProposalFixture(),
  });
  const packageKeys = packageRecord.profiles.map((profile) => profile.profile_key).sort();
  const phase4Keys = phase4.proposed_profiles
    .map((profile) => profile.package_profile_key)
    .sort();
  assert.deepEqual(packageKeys, phase4Keys);
  assert.equal(registration.registered_profile_identities.length, 31);
  const disposition = readRecord(DNO_WORK3_BINDINGS.disposition.path);
  const approvedCount = disposition.profile_dispositions.filter(
    (row) => row.disposition === 'APPROVE',
  ).length;
  const holdCount = disposition.profile_dispositions.filter(
    (row) => row.disposition === 'HOLD',
  ).length;
  assert.equal(approvedCount, 26);
  assert.equal(holdCount, 5);
});

// Regression guard for the sealed-package defect diagnosed in
// docs/codex-program/notes/LAWFUL-FIXTURE-DIMENSION-EVIDENCE-GAP-2026-08-24.md:
// every dimension_evidence row bound match_fixtures[1], a wrong-subtype fixture
// absent from the owning profile's fixture_proofs, which the shared Work3
// profile-set validator rejects. This asserts the same closure rules against
// the real on-disk package without loading the other families.
test('DNO Milestone A package dimension evidence closes on its owner profile fixture proofs', () => {
  physicalBytes(DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path);
  const profilesById = new Map(
    packageRecord.profiles.map((profile) => [profile.profile_id, profile]),
  );
  const claimedKeysByProfile = new Map();

  assert.ok(packageRecord.dimension_evidence.length > 0);
  for (const evidence of packageRecord.dimension_evidence) {
    const label = `dimension evidence ${evidence.dimension_evidence_id}`;
    const profile = profilesById.get(evidence.profile_id);
    assert.ok(profile, `${label} has no owner profile in the package`);
    assert.equal(evidence.family_key, profile.family_key, label);
    assert.equal(evidence.evidence_binding.member_field, 'match_fixtures', label);
    assert.equal(
      evidence.evidence_binding.container_path,
      DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path,
      label,
    );

    const proof = profile.fixture_proofs.find((entry) => (
      canonicalJson(entry.fixture_binding) === canonicalJson(evidence.evidence_binding)
    ));
    assert.ok(proof, `${label} does not bind a fixture proof of ${profile.profile_key}`);
    assert.equal(proof.kind, 'POSITIVE', `${label} binds a non-positive fixture`);

    const fixture = packageRecord.match_fixtures[evidence.evidence_binding.member_index];
    assert.ok(fixture, `${label} binds a match_fixtures index the package does not contain`);
    assert.equal(fixture.match_fixture_id, evidence.evidence_binding.member_record_id, label);
    assert.equal(fixture.fixture_id, proof.fixture_id, label);
    assert.equal(
      sha256Hex(Buffer.from(canonicalJson(fixture), 'utf8')),
      evidence.evidence_binding.member_sha256,
      label,
    );

    const knownKeys = new Set(
      profile.known_relevant_dimensions.map((dimension) => dimension.dimension_key),
    );
    const claimedKeys = claimedKeysByProfile.get(profile.profile_id) ?? new Set();
    for (const dimensionKey of evidence.dimension_keys) {
      assert.ok(knownKeys.has(dimensionKey), `${label} claims unknown dimension ${dimensionKey}`);
      assert.ok(!claimedKeys.has(dimensionKey), `${label} repeats dimension ${dimensionKey}`);
      claimedKeys.add(dimensionKey);
    }
    claimedKeysByProfile.set(profile.profile_id, claimedKeys);
  }

  for (const [profileId, claimedKeys] of claimedKeysByProfile) {
    const profile = profilesById.get(profileId);
    assert.deepEqual(
      [...claimedKeys].sort(),
      sortedUnique(profile.known_relevant_dimensions.map((entry) => entry.dimension_key)),
      profile.profile_key,
    );
    assert.deepEqual(
      sortedUnique(profile.fixture_proofs.map((proof) => proof.kind)),
      ['NEAR_NEGATIVE', 'POSITIVE', 'WRONG_FAMILY', 'WRONG_SUBTYPE'],
      profile.profile_key,
    );
  }
});

test('lawful Work3 fixture DNO on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'DNO_INDEMNIFICATION',
  );
  assert.ok(override, 'lawful Work3 fixture has no DNO_INDEMNIFICATION on-disk override');
  assert.equal(override.binding.path, DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      DNO_WORK3_FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
