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

let considerationAuthoring;
try {
  considerationAuthoring = require('../lib/canonical-v2/m7-v2-consideration-authoring.js');
} catch (error) {
  throw new Error('CONSIDERATION Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareConsiderationPhase2FamilyProposal',
  'prepareConsiderationFamilyProfilePackageReview',
  'prepareConsiderationWork3UnapprovedInventoryReview',
  'prepareConsiderationWork3BenInventorySessionDisposition',
  'prepareConsiderationWork3FamilyPackageSeal',
  'prepareConsiderationWork3FamilyPackageRegistration',
]) {
  if (typeof considerationAuthoring[facade] !== 'function') {
    throw new Error(`CONSIDERATION ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = considerationAuthoring.CONSIDERATION_PROFILE_COUNT;
const FLAGS = considerationAuthoring.CONSIDERATION_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'CONSIDERATION_PACKAGE',
  'CASH_COMPONENT',
  'STOCK_COMPONENT',
  'CVR_COMPONENT',
  'ELECTION',
  'APPRAISAL_LINK',
  'EXCLUSION',
  'EQUITY_AWARD',
  'WITHHOLDING',
  'EXCHANGE_MECHANICS',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: considerationAuthoring.CONSIDERATION_PHASE2_AUTHORITY_PATH,
  schema_version: considerationAuthoring.CONSIDERATION_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'consideration_authoring_phase2_authority_id',
  record_id: considerationAuthoring.CONSIDERATION_PHASE2_AUTHORITY_ID,
  byte_length: considerationAuthoring.CONSIDERATION_PHASE2_AUTHORITY_BYTES,
  sha256: considerationAuthoring.CONSIDERATION_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: considerationAuthoring.CONSIDERATION_PHASE4_AUTHORITY_PATH,
  schema_version: considerationAuthoring.CONSIDERATION_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'consideration_authoring_phase4_family_profile_package_review_authority_id',
  record_id: considerationAuthoring.CONSIDERATION_PHASE4_AUTHORITY_ID,
  byte_length: considerationAuthoring.CONSIDERATION_PHASE4_AUTHORITY_BYTES,
  sha256: considerationAuthoring.CONSIDERATION_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2092,
    path: `${CONTROL}/m7-v2-repair-contract-work3-consideration-unapproved-inventory-review-authority.json`,
    record_id: '06fae6e667380d81ed7d8fe58e9dd36f260e0a63f13b6f4bd2c42eb96c29f8ae',
    record_id_field: 'work3_consideration_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '4be8dc2c32e22de9de44303d14526b66edc7a28fb281ec1a93bf1c9864f274d0',
  }),
  packet: Object.freeze({
    byte_length: 9235,
    path: `${CONTROL}/m7-v2-repair-consideration-7-profile-inventory-review-packet-draft.json`,
    record_id: '9ea8e8be8c6324727944caa0398bd4bb1d0900b40ca96c675e5f3ecfa559ee94',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_7_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '837d081a8ed8b6a7d65ebda46d39f2a9a44f8cdf040fd7338e9415bafd947197',
  }),
  disposition: Object.freeze({
    byte_length: 4308,
    path: `${CONTROL}/m7-v2-repair-consideration-7-profile-inventory-disposition.json`,
    record_id: '8c8f47d7974a9dc27eae37b5c53308ef4d07375983180ec1a7242c2d737ee5d3',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_7_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: 'd0221e39b816f22c0a256f1b26e3eb4ed5208820fb5f9b07298f8cc399897e57',
  }),
  session: Object.freeze({
    byte_length: 1115,
    path: `${CONTROL}/m7-v2-repair-consideration-ben-inventory-session-receipt.json`,
    record_id: '0dbce38400328a43572ab3d152de6ddd2e4e27548b99df0e5da2ab7e52ac015b',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '0794273e24cb3862f8a42577c9dc4f76ca0018c923647f2e9cd10e4ace6a537a',
  }),
  benAuthority: Object.freeze({
    byte_length: 2779,
    path: `${CONTROL}/m7-v2-repair-contract-work3-consideration-ben-inventory-session-successor-authority.json`,
    record_id: 'cbd99cc6898e77f615a8a4538fc8204c40b5fae6c806a6267bf340d46beef490',
    record_id_field: 'work3_consideration_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '5be5ec4fa7408273646be7d4a7b53e77c73f3d1835a16bb66d9112d3ece311b0',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3290,
    path: `${CONTROL}/m7-v2-repair-contract-work3-consideration-family-package-seal-successor-authority.json`,
    record_id: '723156b9661236e256cd2d9f287663c69c68f0fb16b98972e83770107b398ac7',
    record_id_field: 'work3_consideration_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: 'bb438787b50bac1dee294a009a7d5d753ddf8c0a53a4192456415d6ff4c7d064',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2267,
    path: `${CONTROL}/m7-v2-repair-consideration-family-package-seal-receipt.json`,
    record_id: 'edd588a96cdb41fcb47e6c982e1701f2f993c2ca8f2ecc7b3fff69f0985b2657',
    record_id_field: 'consideration_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: 'f94be33527b71e565712c8a2147e7d01afe79cd3d35758b2ddd8463fa308af7e',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2820,
    path: `${CONTROL}/m7-v2-repair-contract-work3-consideration-registration-successor-authority.json`,
    record_id: '6b1c099021bbc21a5c620ad91fe266a618c1b39c47760eae078370c1b7db0516',
    record_id_field: 'work3_consideration_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '84e34ea475a2c619133c071166dc6c1499d74afa7830ad3a49983a2867aa251a',
  }),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-consideration.json`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '8803bfd2579ccb3d8a7fe51cf1f71c3a164a5d679aa3f375227bd7cf63aeb10e',
  byte_length: 91494,
  sha256: '92127e5e1187ad9a626429aa914c9d6319254499a2eb1b36c6cfcf7ca1505320',
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
  const considerationAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    considerationAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      considerationAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    considerationAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    considerationAuthoringPhase2Authority:
      fixture.considerationAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3ConsiderationUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3ConsiderationBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3ConsiderationFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3ConsiderationRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved CONSIDERATION partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.considerationAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 4);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.equal(
    authority.calibration_source_contract.exact_calibration_claim_count,
    PROFILE_COUNT,
  );
  assert.equal(authority.source_terminal_successor_contract.m4_silent_terminal_exact_count, 0);
  assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [METSERA_AGREEMENT_ID]: 1,
      [REDHAT_AGREEMENT_ID]: 2,
      [SKECHERS_AGREEMENT_ID]: 3,
      [TOPBUILD_AGREEMENT_ID]: 1,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'APPRAISAL_LINK',
      'CASH_COMPONENT',
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

  // Appraisal / dissenters-rights shared-section mechanics stay link-only under Q02.
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['APPRAISAL_DISSENTERS_RIGHTS'],
  );

  const result = considerationAuthoring
    .prepareConsiderationPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    considerationAuthoring.CONSIDERATION_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_CONSIDERATION_FAMILY_PROPOSAL/V1',
    family_key: 'CONSIDERATION',
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
    'CONSIDERATION_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    FLAGS.LEGAL_GROUPING,
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 CONSIDERATION family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = considerationAuthoring
    .prepareConsiderationPhase2FamilyProposal({
      considerationAuthoringPhase2Authority:
        fixture.considerationAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = considerationAuthoring
    .prepareConsiderationFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    considerationAuthoring.CONSIDERATION_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_7_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
      considerationAuthoring.CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      considerationAuthoring.CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:CONSIDERATION:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 CONSIDERATION unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = considerationAuthoring
    .prepareConsiderationWork3UnapprovedInventoryReview({
      considerationWork3UnapprovedInventoryReviewEvidence: {
        work3ConsiderationUnapprovedInventoryReviewAuthority:
          evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
      },
      considerationPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_7_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 7);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 CONSIDERATION Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = considerationAuthoring
    .prepareConsiderationWork3BenInventorySessionDisposition({
      considerationWork3BenInventorySessionDispositionEvidence: {
        work3ConsiderationUnapprovedInventoryReviewAuthority:
          evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
        work3ConsiderationBenInventorySessionSuccessorAuthority:
          evidence.work3ConsiderationBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      considerationPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      considerationAuthoring.CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      considerationAuthoring.CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      considerationAuthoring.CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      considerationAuthoring.CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 CONSIDERATION family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = considerationAuthoring.prepareConsiderationWork3FamilyPackageSeal({
    considerationWork3FamilyPackageSealEvidence: {
      work3ConsiderationUnapprovedInventoryReviewAuthority:
        evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
      work3ConsiderationBenInventorySessionSuccessorAuthority:
        evidence.work3ConsiderationBenInventorySessionSuccessorAuthority,
      work3ConsiderationFamilyPackageSealSuccessorAuthority:
        evidence.work3ConsiderationFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    considerationPhase4ReviewInput: phase4Fixture(),
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
    considerationAuthoring.CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 CONSIDERATION family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = considerationAuthoring
    .prepareConsiderationWork3FamilyPackageRegistration({
      considerationWork3FamilyPackageRegistrationEvidence: evidence,
      considerationPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_CONSIDERATION_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Consideration Milestone A inventory packet draft carries shape summaries and honest holds', () => {
  physicalBytes(WORK3_BINDINGS.packet);
  const packet = readRecord(WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.comparator_deal_count, 4);
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
    considerationAuthoring.CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    considerationAuthoring.CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
});

test('Consideration Milestone A disposition approves 7 profiles and reuses only sealed M5 rulings', () => {
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

test('Consideration Milestone A family profile package on disk validates 7 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:CONSIDERATION:PROFILE_SET_V1',
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

  const phase4 = considerationAuthoring
    .prepareConsiderationFamilyProfilePackageReview(phase4Fixture());
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

test('lawful Work3 fixture CONSIDERATION on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'CONSIDERATION',
  );
  assert.ok(override, 'lawful Work3 fixture has no CONSIDERATION on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
