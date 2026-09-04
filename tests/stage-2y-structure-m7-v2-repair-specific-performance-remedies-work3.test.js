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

let specificPerformanceRemediesAuthoring;
try {
  specificPerformanceRemediesAuthoring = require('../lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js');
} catch (error) {
  throw new Error('SPECIFIC_PERFORMANCE_REMEDIES Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareSpecificPerformanceRemediesPhase2FamilyProposal',
  'prepareSpecificPerformanceRemediesFamilyProfilePackageReview',
  'prepareSpecificPerformanceRemediesWork3UnapprovedInventoryReview',
  'prepareSpecificPerformanceRemediesWork3BenInventorySessionDisposition',
  'prepareSpecificPerformanceRemediesWork3FamilyPackageSeal',
  'prepareSpecificPerformanceRemediesWork3FamilyPackageRegistration',
]) {
  if (typeof specificPerformanceRemediesAuthoring[facade] !== 'function') {
    throw new Error(`SPECIFIC_PERFORMANCE_REMEDIES ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PROFILE_COUNT;
const WORK3_APPROVE_COUNT = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_WORK3_APPROVE_COUNT;
const WORK3_HOLD_COUNT = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_WORK3_HOLD_COUNT;
const FLAGS = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_REVIEW_FLAGS;
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
  'GENERAL_EQUITABLE_RELIEF',
  'CLOSING_ENFORCEMENT',
  'NON_OBJECTION',
  'BOND_SECURITY_WAIVER',
  'REMEDY_COORDINATION',
  'REMEDY_ACTION_EXTENSION',
  'COST_SHIFT',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_PATH,
  schema_version: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'specific_performance_remedies_authoring_phase2_authority_id',
  record_id: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_ID,
  byte_length: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_BYTES,
  sha256: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE4_AUTHORITY_PATH,
  schema_version: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'specific_performance_remedies_authoring_phase4_family_profile_package_review_authority_id',
  record_id: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE4_AUTHORITY_ID,
  byte_length: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE4_AUTHORITY_BYTES,
  sha256: specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({"byte_length":2319,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-specific-performance-remedies-unapproved-inventory-review-authority.json","record_id":"056d5f43adc13ec79f37ec4db25e9cb89e5fb62d360a951c20ca34a12de60146","record_id_field":"work3_specific_performance_remedies_unapproved_inventory_review_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1","sha256":"1c99c2ea1c0dfa8434680072bab7db875b1bd5a66d51c69bed9eb74f1b899f34"}),
  packet: Object.freeze({"byte_length":11537,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-specific-performance-remedies-8-profile-inventory-review-packet-draft.json","record_id":"2d367a0f72c5caf96d4a39a2f0e8f7e97c39e53bb0ec2411accb6e7cba4a106c","record_id_field":"inventory_review_packet_id","schema_version":"STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_8_PROFILE_INVENTORY_REVIEW_PACKET/V1","sha256":"8439dfdc7d279b8acbf9a0a2e00b405fcaba14677d143ab993ffcce82eefd35b"}),
  disposition: Object.freeze({"byte_length":5524,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-specific-performance-remedies-8-profile-inventory-disposition.json","record_id":"2d3502019874feea5505d22549d821b46ab0e3f95a90c74dd8bf27d0f1c8607c","record_id_field":"inventory_disposition_id","schema_version":"STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_8_PROFILE_INVENTORY_DISPOSITION/V1","sha256":"07e3341f18fd9c08216e93cc7fd4055f75381f5eb0018670de73585e6bfca744"}),
  session: Object.freeze({"byte_length":1179,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-specific-performance-remedies-ben-inventory-session-receipt.json","record_id":"81c33b3aa5f6639c1cf5c4adfddfd9f2f0661632cf7cf81e4c0a6afca33fea9a","record_id_field":"ben_inventory_session_receipt_id","schema_version":"STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_BEN_INVENTORY_SESSION_RECEIPT/V1","sha256":"5c51aa920fee709ec410747b71b23f9e85b5a027f17f134015cd6270aa0901aa"}),
  benAuthority: Object.freeze({"byte_length":3034,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-specific-performance-remedies-ben-inventory-session-successor-authority.json","record_id":"a98543a632426239801c83c170bfc5836948a53b78090d6beaaec9f8f83d6998","record_id_field":"work3_specific_performance_remedies_ben_inventory_session_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1","sha256":"99e71f8d857d12a0dcb2792fdecc154ba3f50ca7b8a6d98d87e82728965fd246"}),
  sealAuthority: Object.freeze({"byte_length":3566,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-specific-performance-remedies-family-package-seal-successor-authority.json","record_id":"66bbceb626ce189d8533401ba1960aeb2ad8ce631ae0b1dd872fdc54e2751d72","record_id_field":"work3_specific_performance_remedies_family_package_seal_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1","sha256":"ffad3ec06c8e08ebba99b37e6c00a5874f46f993f913e67368bccf0bc323cd13"}),
  sealReceipt: Object.freeze({"byte_length":2464,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-specific-performance-remedies-family-package-seal-receipt.json","record_id":"0beb790cc4971c8819da0d1a2f9314e234f5d0a1e916ab1598b2a4d4633b66d5","record_id_field":"specific_performance_remedies_family_package_seal_receipt_id","schema_version":"STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_SEAL_RECEIPT/V1","sha256":"9e618595e9e0b416b78dc34c4ac997605a279c4c82d73f443437e06ffa7289cc"}),
  registrationAuthority: Object.freeze({"byte_length":3094,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-specific-performance-remedies-registration-successor-authority.json","record_id":"3ee5988625fc2c9074d576d16d8dbebc452d9e2f5543fdf21f058e0b9b29910a","record_id_field":"work3_specific_performance_remedies_registration_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_REGISTRATION_SUCCESSOR_AUTHORITY/V1","sha256":"11a3faae1f1fb28806327547a3f84bacbe5e7efd66c78c3329428c463ed69918"}),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-specific-performance-remedies.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: 'fad946796c2f5d6b50a66a906d35be00335d4f61a1f59ba59c26a4dbeff28669',
  byte_length: 110000,
  sha256: 'f0a3747b85dce18846d8eedee2b63802e31a8bc82b31f70191e2dcf46df2d39c',
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
  const specificPerformanceRemediesAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    specificPerformanceRemediesAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      specificPerformanceRemediesAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    specificPerformanceRemediesAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    specificPerformanceRemediesAuthoringPhase2Authority:
      fixture.specificPerformanceRemediesAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3SpecificPerformanceRemediesFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3SpecificPerformanceRemediesRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved SPECIFIC_PERFORMANCE_REMEDIES partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.specificPerformanceRemediesAuthoringPhase2Authority.record;
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
      ['1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116']: 1,
      [METSERA_AGREEMENT_ID]: 2,
      [REDHAT_AGREEMENT_ID]: 1,
      [SKECHERS_AGREEMENT_ID]: 1,
      [SKYWATER_AGREEMENT_ID]: 1,
      [TOPBUILD_AGREEMENT_ID]: 2,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    ['GENERAL_EQUITABLE_RELIEF'],
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.required_expression_signature)).length,
    PROFILE_COUNT,
  );

  // Termination Fee sole-remedy fee sections stay link-only under Q02.
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['TERMINATION_FEE', 'TERMINATION_FEE', 'TERMINATION_FEE', 'TERMINATION_FEE', 'TERMINATION_FEE'],
  );

  const result = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PROPOSAL/V1',
    family_key: 'SPECIFIC_PERFORMANCE_REMEDIES',
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
    FLAGS.LEGAL_GROUPING,
    'SPECIFIC_PERFORMANCE_REMEDIES_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 SPECIFIC_PERFORMANCE_REMEDIES family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesPhase2FamilyProposal({
      specificPerformanceRemediesAuthoringPhase2Authority:
        fixture.specificPerformanceRemediesAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_8_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
      specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:SPECIFIC_PERFORMANCE_REMEDIES:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 SPECIFIC_PERFORMANCE_REMEDIES unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesWork3UnapprovedInventoryReview({
      specificPerformanceRemediesWork3UnapprovedInventoryReviewEvidence: {
        work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority:
          evidence.work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority,
      },
      specificPerformanceRemediesPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_8_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(
    result.review_accounting.subtype_partition_divergence_flag_count,
    specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.review_accounting.owner_family_disposition_hold_flag_count, WORK3_HOLD_COUNT);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 SPECIFIC_PERFORMANCE_REMEDIES Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesWork3BenInventorySessionDisposition({
      specificPerformanceRemediesWork3BenInventorySessionDispositionEvidence: {
        work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority:
          evidence.work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority,
        work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority:
          evidence.work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      specificPerformanceRemediesPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: WORK3_APPROVE_COUNT,
    hold_count: WORK3_HOLD_COUNT,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    subtype_partition_hold_count: WORK3_HOLD_COUNT,
    termination_fee_sole_remedy_owner_family_open: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 SPECIFIC_PERFORMANCE_REMEDIES family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = specificPerformanceRemediesAuthoring.prepareSpecificPerformanceRemediesWork3FamilyPackageSeal({
    specificPerformanceRemediesWork3FamilyPackageSealEvidence: {
      work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority:
        evidence.work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority,
      work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority:
        evidence.work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority,
      work3SpecificPerformanceRemediesFamilyPackageSealSuccessorAuthority:
        evidence.work3SpecificPerformanceRemediesFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    specificPerformanceRemediesPhase4ReviewInput: phase4Fixture(),
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
    specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 SPECIFIC_PERFORMANCE_REMEDIES family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesWork3FamilyPackageRegistration({
      specificPerformanceRemediesWork3FamilyPackageRegistrationEvidence: evidence,
      specificPerformanceRemediesPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('SpecificPerformanceRemedies Milestone A inventory packet draft carries shape summaries and honest holds', () => {
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
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OWNER_FAMILY),
    ).length,
    7,
  );
});

test('SpecificPerformanceRemedies Milestone A disposition holds seven owner-family rows and approves Skywater', () => {
  physicalBytes(WORK3_BINDINGS.disposition);
  const disposition = readRecord(WORK3_BINDINGS.disposition.path);
  assert.equal(disposition.session_summary.approved_count, 1);
  assert.equal(disposition.session_summary.hold_count, 7);
  assert.equal(disposition.session_summary.subtype_grouping_pending_legal, true);
  assert.equal(disposition.sealed_ruling_reuse.new_family_specific_ruling_count, 0);
  assert.deepEqual(disposition.sealed_ruling_reuse.ruling_ids, [
    'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
    'M5-RULING-ONE-OPERATIVE-LIMB',
    'M5-RULING-ONE-SEMANTIC-OWNER',
  ]);
  assert.equal(
    disposition.profile_dispositions.filter((row) => row.disposition === 'APPROVE').length,
    1,
  );
  assert.equal(
    disposition.profile_dispositions.filter((row) => row.disposition === 'HOLD').length,
    7,
  );
});

test('SpecificPerformanceRemedies Milestone A family profile package on disk validates eight registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:SPECIFIC_PERFORMANCE_REMEDIES:PROFILE_SET_V1',
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

  const phase4 = specificPerformanceRemediesAuthoring
    .prepareSpecificPerformanceRemediesFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),
    phase4.proposed_profiles.map(
      (profile) => profile.canonical_tuple.classification_path[1],
    ).sort(),
  );
});

test('lawful Work3 fixture SPECIFIC_PERFORMANCE_REMEDIES on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'SPECIFIC_PERFORMANCE_REMEDIES',
  );
  assert.ok(override, 'lawful Work3 fixture has no SPECIFIC_PERFORMANCE_REMEDIES on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
