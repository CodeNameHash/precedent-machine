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

let mergerStructureClosingAuthoring;
try {
  mergerStructureClosingAuthoring = require('../lib/canonical-v2/m7-v2-merger-structure-closing-authoring.js');
} catch (error) {
  throw new Error('MERGER_STRUCTURE_CLOSING Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareMergerStructureClosingPhase2FamilyProposal',
  'prepareMergerStructureClosingFamilyProfilePackageReview',
  'prepareMergerStructureClosingWork3UnapprovedInventoryReview',
  'prepareMergerStructureClosingWork3BenInventorySessionDisposition',
  'prepareMergerStructureClosingWork3FamilyPackageSeal',
  'prepareMergerStructureClosingWork3FamilyPackageRegistration',
]) {
  if (typeof mergerStructureClosingAuthoring[facade] !== 'function') {
    throw new Error(`MERGER_STRUCTURE_CLOSING ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PROFILE_COUNT;
const FLAGS = mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;



const CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';

const MODIV_AGREEMENT_ID =
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'TRANSACTION_STEP',
  'TRANSACTION_PLAN',
  'CLOSING',
  'EFFECTIVE_TIME',
  'LEGAL_EFFECT',
  'GOVERNANCE_SUCCESSION',
  'ORGANISATIONAL_DOCUMENT',
  'BOARD_DESIGNATION',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_PATH,
  schema_version: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'merger_structure_closing_authoring_phase2_authority_id',
  record_id: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_ID,
  byte_length: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_BYTES,
  sha256: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE4_AUTHORITY_PATH,
  schema_version: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'merger_structure_closing_authoring_phase4_family_profile_package_review_authority_id',
  record_id: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE4_AUTHORITY_ID,
  byte_length: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE4_AUTHORITY_BYTES,
  sha256: mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({"byte_length":2225,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-merger-structure-closing-unapproved-inventory-review-authority.json","record_id":"d9127575a95967d35c97a79b40bd2c05f06ede848390968e8dc9c8053e668e01","record_id_field":"work3_merger_structure_closing_unapproved_inventory_review_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MERGER_STRUCTURE_CLOSING_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1","sha256":"410b3400418fae7984a3425993b1bfd29dbf5e17d806403d11f3f2f4ea5638e0"}),
  packet: Object.freeze({"byte_length":126965,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-merger-structure-closing-103-profile-inventory-review-packet-draft.json","record_id":"ba7b654e8f23ea90a357d9b5b590f46086ba47b5ebc95858ce9cd20463ca2fba","record_id_field":"inventory_review_packet_id","schema_version":"STAGE_2Y_M7_V2_MERGER_STRUCTURE_CLOSING_103_PROFILE_INVENTORY_REVIEW_PACKET/V1","sha256":"de03b6b7bd4ccf6038a7b99969cc13122e9d7b3651738e14a6903dc3e0928b05"}),
  disposition: Object.freeze({"byte_length":41442,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-merger-structure-closing-103-profile-inventory-disposition.json","record_id":"5b5848ba388db79d7d628a4cba0493bf6166b63c75c6c5c846699bb05fb34d4f","record_id_field":"inventory_disposition_id","schema_version":"STAGE_2Y_M7_V2_MERGER_STRUCTURE_CLOSING_103_PROFILE_INVENTORY_DISPOSITION/V1","sha256":"ef720e745a9b789f08b5004fb713c0e94fc18f7356ded046cd544dbd11779d69"}),
  session: Object.freeze({"byte_length":1165,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-merger-structure-closing-ben-inventory-session-receipt.json","record_id":"0c639e7b0e672b88a40ce753e14544bf451c37daa640ff70ce89b9064b6e0a0b","record_id_field":"ben_inventory_session_receipt_id","schema_version":"STAGE_2Y_M7_V2_MERGER_STRUCTURE_CLOSING_BEN_INVENTORY_SESSION_RECEIPT/V1","sha256":"e8c15caa7d80017ba8d40df6b38d2be5d05e40c4c7706183c424172cc037e6ba"}),
  benAuthority: Object.freeze({"byte_length":2936,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-merger-structure-closing-ben-inventory-session-successor-authority.json","record_id":"7e2f71bb23f4744c23ced49595a0f75d221481d0f88390fb230fd3cc80b119c9","record_id_field":"work3_merger_structure_closing_ben_inventory_session_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MERGER_STRUCTURE_CLOSING_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1","sha256":"dccf68799ec2a5a2559f04f8137c804dbef2afe736367df732e6d47fc5dfe35a"}),
  sealAuthority: Object.freeze({"byte_length":3484,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-merger-structure-closing-family-package-seal-successor-authority.json","record_id":"081dce0d5e43d4c1a89d9894ea9c43e46f076c252cecd2d487a0541bc8732636","record_id_field":"work3_merger_structure_closing_family_package_seal_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MERGER_STRUCTURE_CLOSING_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1","sha256":"79bc343f7492c7faef18dae9f3627c2bda68e5cf2aa62702940b17d141eb1a87"}),
  sealReceipt: Object.freeze({"byte_length":2352,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-merger-structure-closing-family-package-seal-receipt.json","record_id":"dda6393ade2001627db2c7771e569ff521b30b0691f5f9b4b692083b20e682cb","record_id_field":"merger_structure_closing_family_package_seal_receipt_id","schema_version":"STAGE_2Y_M7_V2_MERGER_STRUCTURE_CLOSING_FAMILY_PACKAGE_SEAL_RECEIPT/V1","sha256":"98f466bbb0a161a277082a854b232781dccbd2285e8a8f68d2b0865dbfc33e1b"}),
  registrationAuthority: Object.freeze({"byte_length":3014,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-merger-structure-closing-registration-successor-authority.json","record_id":"2e3eb8bfa353a4ca795485e6edd5b074ef3a2435dd74fa5890fa5329fc78a08d","record_id_field":"work3_merger_structure_closing_registration_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MERGER_STRUCTURE_CLOSING_REGISTRATION_SUCCESSOR_AUTHORITY/V1","sha256":"9e3e49195e1463126daacb773d658226096a24923a844f3dbfcb575ad21eb437"}),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-merger-structure-closing.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: 'f1ad8ac712c427abe3ae63c650b5b8c3b8ad804e79fd75826f4b9ccd7954c949',
  byte_length: 1308628,
  sha256: '252ff9ed9d3e692c50f5bb7671e9459afb84508596a21ba57dc00b92022e52b0',
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
  const mergerStructureClosingAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    mergerStructureClosingAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      mergerStructureClosingAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    mergerStructureClosingAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    mergerStructureClosingAuthoringPhase2Authority:
      fixture.mergerStructureClosingAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3MergerStructureClosingUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3MergerStructureClosingBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3MergerStructureClosingFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3MergerStructureClosingRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved MERGER_STRUCTURE_CLOSING partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.mergerStructureClosingAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.equal(
    authority.calibration_source_contract.exact_calibration_claim_count,
    PROFILE_COUNT,
  );
  assert.equal(authority.source_terminal_successor_contract.m4_silent_terminal_exact_count, 0);
  assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 13,
      [METSERA_AGREEMENT_ID]: 10,
      [MODIV_AGREEMENT_ID]: 14,
      [REDHAT_AGREEMENT_ID]: 15,
      [SKECHERS_AGREEMENT_ID]: 14,
      [SKYWATER_AGREEMENT_ID]: 17,
      [TOPBUILD_AGREEMENT_ID]: 20,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'BOARD_DESIGNATION',
      'CLOSING',
      'EFFECTIVE_TIME',
      'GOVERNANCE_SUCCESSION',
      'LEGAL_EFFECT',
      'TRANSACTION_STEP',
    ],
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.required_expression_signature)).length,
    PROFILE_COUNT,
  );

  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['CLOSING_CONDITIONS', 'PROXY_MEETING'],
  );

  const result = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_MERGER_STRUCTURE_CLOSING_FAMILY_PROPOSAL/V1',
    family_key: 'MERGER_STRUCTURE_CLOSING',
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
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
    'MERGER_STRUCTURE_CLOSING_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase2 MERGER_STRUCTURE_CLOSING terminals do not collide with sealed General Covenants M4 claims or M2 nodes', () => {
  const iocAuthority = readRecord(PHASE2_AUTHORITY_BINDING.path);
  const gcAuthority = readRecord(
    `${CONTROL}/m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v2.json`,
  );
  const iocTerminals = iocAuthority.source_terminal_successor_contract.terminal_rule_registry;
  const gcTerminals = gcAuthority.source_terminal_successor_contract.terminal_rule_registry;
  const gcClaimIds = new Set(gcTerminals.flatMap((terminal) => terminal.m4_claim_ids));
  const gcNodeIds = new Set(
    gcTerminals.flatMap((terminal) => terminal.source_closure.members.map(
      (member) => member.source_node_occurrence_id,
    )),
  );
  for (const terminal of iocTerminals) {
    for (const claimId of terminal.m4_claim_ids) {
      assert.equal(gcClaimIds.has(claimId), false);
    }
    for (const member of terminal.source_closure.members) {
      assert.equal(gcNodeIds.has(member.source_node_occurrence_id), false);
    }
  }
});

test('Phase4 MERGER_STRUCTURE_CLOSING family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingPhase2FamilyProposal({
      mergerStructureClosingAuthoringPhase2Authority:
        fixture.mergerStructureClosingAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_103_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
    complete_profile_count: PROFILE_COUNT,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: PROFILE_COUNT,
    outside_calibration_example_flag_count:
      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:MERGER_STRUCTURE_CLOSING:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 MERGER_STRUCTURE_CLOSING unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingWork3UnapprovedInventoryReview({
      mergerStructureClosingWork3UnapprovedInventoryReviewEvidence: {
        work3MergerStructureClosingUnapprovedInventoryReviewAuthority:
          evidence.work3MergerStructureClosingUnapprovedInventoryReviewAuthority,
      },
      mergerStructureClosingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_103_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(
    result.review_accounting.subtype_partition_divergence_flag_count,
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.review_accounting.outside_calibration_example_flag_count,
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_OUTSIDE_CALIBRATION_PROFILE_COUNT);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 MERGER_STRUCTURE_CLOSING Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingWork3BenInventorySessionDisposition({
      mergerStructureClosingWork3BenInventorySessionDispositionEvidence: {
        work3MergerStructureClosingUnapprovedInventoryReviewAuthority:
          evidence.work3MergerStructureClosingUnapprovedInventoryReviewAuthority,
        work3MergerStructureClosingBenInventorySessionSuccessorAuthority:
          evidence.work3MergerStructureClosingBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      mergerStructureClosingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 MERGER_STRUCTURE_CLOSING family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = mergerStructureClosingAuthoring.prepareMergerStructureClosingWork3FamilyPackageSeal({
    mergerStructureClosingWork3FamilyPackageSealEvidence: {
      work3MergerStructureClosingUnapprovedInventoryReviewAuthority:
        evidence.work3MergerStructureClosingUnapprovedInventoryReviewAuthority,
      work3MergerStructureClosingBenInventorySessionSuccessorAuthority:
        evidence.work3MergerStructureClosingBenInventorySessionSuccessorAuthority,
      work3MergerStructureClosingFamilyPackageSealSuccessorAuthority:
        evidence.work3MergerStructureClosingFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    mergerStructureClosingPhase4ReviewInput: phase4Fixture(),
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
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 MERGER_STRUCTURE_CLOSING family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingWork3FamilyPackageRegistration({
      mergerStructureClosingWork3FamilyPackageRegistrationEvidence: evidence,
      mergerStructureClosingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_MERGER_STRUCTURE_CLOSING_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Merger Structure / Closing Milestone A inventory packet draft carries shape summaries and honest holds', () => {
  physicalBytes(WORK3_BINDINGS.packet);
  const packet = readRecord(WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.comparator_deal_count, 7);
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
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
});

test('Merger Structure / Closing Milestone A disposition approves 103 profiles and reuses only sealed M5 rulings', () => {
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

test('Merger Structure / Closing Milestone A family profile package on disk validates 103 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:MERGER_STRUCTURE_CLOSING:PROFILE_SET_V1',
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

  const phase4 = mergerStructureClosingAuthoring
    .prepareMergerStructureClosingFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),
    phase4.proposed_profiles
      .map((profile) => profile.canonical_tuple.classification_path[1])
      .sort(),
  );
});

test('lawful Work3 fixture MERGER_STRUCTURE_CLOSING on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'MERGER_STRUCTURE_CLOSING',
  );
  assert.ok(override, 'lawful Work3 fixture has no MERGER_STRUCTURE_CLOSING on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
