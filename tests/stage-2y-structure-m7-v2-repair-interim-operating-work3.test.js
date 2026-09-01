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

let interimOperatingAuthoring;
try {
  interimOperatingAuthoring = require('../lib/canonical-v2/m7-v2-interim-operating-authoring.js');
} catch (error) {
  throw new Error('INTERIM_OPERATING Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareInterimOperatingPhase2FamilyProposal',
  'prepareInterimOperatingFamilyProfilePackageReview',
  'prepareInterimOperatingWork3UnapprovedInventoryReview',
  'prepareInterimOperatingWork3BenInventorySessionDisposition',
  'prepareInterimOperatingWork3FamilyPackageSeal',
  'prepareInterimOperatingWork3FamilyPackageRegistration',
]) {
  if (typeof interimOperatingAuthoring[facade] !== 'function') {
    throw new Error(`INTERIM_OPERATING ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = interimOperatingAuthoring.INTERIM_OPERATING_PROFILE_COUNT;
const FLAGS = interimOperatingAuthoring.INTERIM_OPERATING_REVIEW_FLAGS;
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

const CLASSIFICATION_BUCKETS = Object.freeze([
  'RESTRICTIVE_COVENANT',
  'AFFIRMATIVE_COVENANT',
  'CONSENT_STANDARD',
  'THRESHOLD',
  'EXCEPTION',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_AUTHORITY_PATH,
  schema_version: interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'interim_operating_authoring_phase2_authority_id',
  record_id: interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_AUTHORITY_ID,
  byte_length: interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES,
  sha256: interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_AUTHORITY_PATH,
  schema_version: interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'interim_operating_authoring_phase4_family_profile_package_review_authority_id',
  record_id: interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_AUTHORITY_ID,
  byte_length: interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_AUTHORITY_BYTES,
  sha256: interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({"byte_length":2143,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-unapproved-inventory-review-authority.json","record_id":"2f7e0f950dc99cf6a248622ebf096c581d81c59964aa6499c1753e27bc1d3d64","record_id_field":"work3_interim_operating_unapproved_inventory_review_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1","sha256":"e142c3f907db2b8443034375a63cc7a994f0752887db87b46b049d70722357f6"}),
  packet: Object.freeze({"byte_length":129268,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-113-profile-inventory-review-packet-draft.json","record_id":"4227e263550d0be3688f3ce70dcc2384db6ef06020edd4b4bb39005e26867cc3","record_id_field":"inventory_review_packet_id","schema_version":"STAGE_2Y_M7_V2_INTERIM_OPERATING_113_PROFILE_INVENTORY_REVIEW_PACKET/V1","sha256":"6a96d87205fceba135708866084c90c042d4f6fc142551faa77c51f6b282fa83"}),
  disposition: Object.freeze({"byte_length":39759,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-113-profile-inventory-disposition.json","record_id":"26d4a2b856351019383bb40b0dfd43bec7459b619c87100e7b61d30e8663eb70","record_id_field":"inventory_disposition_id","schema_version":"STAGE_2Y_M7_V2_INTERIM_OPERATING_113_PROFILE_INVENTORY_DISPOSITION/V1","sha256":"39bed2651c04612b13f7aebb3a70754b47eccffc48df511c4b7f2c04efd83e6c"}),
  session: Object.freeze({"byte_length":1137,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-ben-inventory-session-receipt.json","record_id":"9c86a0bc063ab90694836c526696df17eab5cfbf560b1e02711b4da4eac4bb0f","record_id_field":"ben_inventory_session_receipt_id","schema_version":"STAGE_2Y_M7_V2_INTERIM_OPERATING_BEN_INVENTORY_SESSION_RECEIPT/V1","sha256":"9e276c95eb209ac5dd446447dec57866a9bb8a4c437ebddd3a991a84b5aa54ee"}),
  benAuthority: Object.freeze({"byte_length":2842,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-ben-inventory-session-successor-authority.json","record_id":"bd40a0e5344f82bc831f7dc7a817e7fb1dfce1f21d2af9a2ec8b51fd44811f41","record_id_field":"work3_interim_operating_ben_inventory_session_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1","sha256":"ae92136400c07668a0bc87944f3bb6c01fcb39c916e2fa998f29327b47d426df"}),
  sealAuthority: Object.freeze({"byte_length":3363,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-family-package-seal-successor-authority.json","record_id":"50d77232f2e758783b94fd6b570cd23f0283b0cdbaf15d4e1e04c4a49fdb5dd0","record_id_field":"work3_interim_operating_family_package_seal_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1","sha256":"af81c93c0504109f15975fffef9ffaf1ecd909cf9ff4716d4c8b7443e9407fba"}),
  sealReceipt: Object.freeze({"byte_length":2301,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-family-package-seal-receipt.json","record_id":"32ab4e7567d7ca44a8e9475f635ab98197bb51ea38fd0f2bcbe31a8fc5092da7","record_id_field":"interim_operating_family_package_seal_receipt_id","schema_version":"STAGE_2Y_M7_V2_INTERIM_OPERATING_FAMILY_PACKAGE_SEAL_RECEIPT/V1","sha256":"c122ea458f115210321c16db904294874414bd179f3463632d9be02ab0adf258"}),
  registrationAuthority: Object.freeze({"byte_length":2895,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-registration-successor-authority.json","record_id":"6bb0511d04ec6994ba4365f8653f89e1095da466f07c05d4eeaad6847876b902","record_id_field":"work3_interim_operating_registration_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_REGISTRATION_SUCCESSOR_AUTHORITY/V1","sha256":"292b1a8fb16424a8845fa65e0ccbfcf2fc1837ee7349d676f9c77c87d6beac29"}),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-interim-operating.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '037376ce906360c30bdc15eaa1c2efc1bceba94157d46aa7305908c610cdcf3b',
  byte_length: 1418275,
  sha256: 'ea245e721869f8f20d88cec57363c5ec62402dce696e63a642442558fbd4d730',
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
  const interimOperatingAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    interimOperatingAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      interimOperatingAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    interimOperatingAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    interimOperatingAuthoringPhase2Authority:
      fixture.interimOperatingAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3InterimOperatingUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3InterimOperatingBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3InterimOperatingFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3InterimOperatingRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved INTERIM_OPERATING partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.interimOperatingAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 6);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.equal(
    authority.calibration_source_contract.exact_calibration_claim_count,
    PROFILE_COUNT,
  );
  assert.equal(authority.source_terminal_successor_contract.m4_silent_terminal_exact_count, 0);
  assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 18,
      [METSERA_AGREEMENT_ID]: 18,
      [REDHAT_AGREEMENT_ID]: 13,
      [SKECHERS_AGREEMENT_ID]: 19,
      [SKYWATER_AGREEMENT_ID]: 19,
      [TOPBUILD_AGREEMENT_ID]: 26,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'RESTRICTIVE_COVENANT',
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
    [],
  );

  const result = interimOperatingAuthoring
    .prepareInterimOperatingPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    interimOperatingAuthoring.INTERIM_OPERATING_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_INTERIM_OPERATING_FAMILY_PROPOSAL/V1',
    family_key: 'INTERIM_OPERATING',
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
    'INTERIM_OPERATING_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase2 INTERIM_OPERATING terminals do not collide with sealed General Covenants M4 claims or M2 nodes', () => {
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

test('Phase4 INTERIM_OPERATING family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = interimOperatingAuthoring
    .prepareInterimOperatingPhase2FamilyProposal({
      interimOperatingAuthoringPhase2Authority:
        fixture.interimOperatingAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = interimOperatingAuthoring
    .prepareInterimOperatingFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    interimOperatingAuthoring.INTERIM_OPERATING_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_113_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
      interimOperatingAuthoring.INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      interimOperatingAuthoring.INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:INTERIM_OPERATING:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 INTERIM_OPERATING unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = interimOperatingAuthoring
    .prepareInterimOperatingWork3UnapprovedInventoryReview({
      interimOperatingWork3UnapprovedInventoryReviewEvidence: {
        work3InterimOperatingUnapprovedInventoryReviewAuthority:
          evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
      },
      interimOperatingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_113_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 0);
  assert.equal(result.review_accounting.outside_calibration_example_flag_count, 8);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 INTERIM_OPERATING Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = interimOperatingAuthoring
    .prepareInterimOperatingWork3BenInventorySessionDisposition({
      interimOperatingWork3BenInventorySessionDispositionEvidence: {
        work3InterimOperatingUnapprovedInventoryReviewAuthority:
          evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
        work3InterimOperatingBenInventorySessionSuccessorAuthority:
          evidence.work3InterimOperatingBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      interimOperatingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      interimOperatingAuthoring.INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      interimOperatingAuthoring.INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      interimOperatingAuthoring.INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      interimOperatingAuthoring.INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 INTERIM_OPERATING family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = interimOperatingAuthoring.prepareInterimOperatingWork3FamilyPackageSeal({
    interimOperatingWork3FamilyPackageSealEvidence: {
      work3InterimOperatingUnapprovedInventoryReviewAuthority:
        evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
      work3InterimOperatingBenInventorySessionSuccessorAuthority:
        evidence.work3InterimOperatingBenInventorySessionSuccessorAuthority,
      work3InterimOperatingFamilyPackageSealSuccessorAuthority:
        evidence.work3InterimOperatingFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    interimOperatingPhase4ReviewInput: phase4Fixture(),
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
    interimOperatingAuthoring.INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 INTERIM_OPERATING family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = interimOperatingAuthoring
    .prepareInterimOperatingWork3FamilyPackageRegistration({
      interimOperatingWork3FamilyPackageRegistrationEvidence: evidence,
      interimOperatingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_INTERIM_OPERATING_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Interim Operating Milestone A inventory packet draft carries shape summaries and honest holds', () => {
  physicalBytes(WORK3_BINDINGS.packet);
  const packet = readRecord(WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.comparator_deal_count, 6);
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
    interimOperatingAuthoring.INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    interimOperatingAuthoring.INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
});

test('Interim Operating Milestone A disposition approves 113 profiles and reuses only sealed M5 rulings', () => {
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

test('Interim Operating Milestone A family profile package on disk validates 113 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:INTERIM_OPERATING:PROFILE_SET_V1',
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

  const phase4 = interimOperatingAuthoring
    .prepareInterimOperatingFamilyProfilePackageReview(phase4Fixture());
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

test('lawful Work3 fixture INTERIM_OPERATING on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'INTERIM_OPERATING',
  );
  assert.ok(override, 'lawful Work3 fixture has no INTERIM_OPERATING on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
