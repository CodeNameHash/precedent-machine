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

let noShopAuthoring;
try {
  noShopAuthoring = require('../lib/canonical-v2/m7-v2-no-shop-authoring.js');
} catch (error) {
  throw new Error('NO_SHOP Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareNoShopPhase2FamilyProposal',
  'prepareNoShopFamilyProfilePackageReview',
  'prepareNoShopWork3UnapprovedInventoryReview',
  'prepareNoShopWork3BenInventorySessionDisposition',
  'prepareNoShopWork3FamilyPackageSeal',
  'prepareNoShopWork3FamilyPackageRegistration',
]) {
  if (typeof noShopAuthoring[facade] !== 'function') {
    throw new Error(`NO_SHOP ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = noShopAuthoring.NO_SHOP_PROFILE_COUNT;
const PHASE2_TERMINAL_COUNT = noShopAuthoring.NO_SHOP_PHASE2_TERMINAL_COUNT;
const FLAGS = noShopAuthoring.NO_SHOP_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const MODIV_AGREEMENT_ID =
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'RESTRICTION',
  'ENGAGEMENT_PERMISSION',
  'NOTICE',
  'STANDSTILL',
  'RECOMMENDATION_CHANGE',
  'SAFE_DISCLOSURE',
  'REPRESENTATIVE_CONTROL',
  'GO_SHOP_WINDOW',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: noShopAuthoring.NO_SHOP_PHASE2_AUTHORITY_PATH,
  schema_version: noShopAuthoring.NO_SHOP_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'no_shop_authoring_phase2_authority_id',
  record_id: noShopAuthoring.NO_SHOP_PHASE2_AUTHORITY_ID,
  byte_length: noShopAuthoring.NO_SHOP_PHASE2_AUTHORITY_BYTES,
  sha256: noShopAuthoring.NO_SHOP_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: noShopAuthoring.NO_SHOP_PHASE4_AUTHORITY_PATH,
  schema_version: noShopAuthoring.NO_SHOP_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'no_shop_authoring_phase4_family_profile_package_review_authority_id',
  record_id: noShopAuthoring.NO_SHOP_PHASE4_AUTHORITY_ID,
  byte_length: noShopAuthoring.NO_SHOP_PHASE4_AUTHORITY_BYTES,
  sha256: noShopAuthoring.NO_SHOP_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({"byte_length":2025,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-no-shop-unapproved-inventory-review-authority.json","record_id":"a60cece80b02ca2e271167c606d7900bea7f94929c62753722ef70f3f08831f9","record_id_field":"work3_no_shop_unapproved_inventory_review_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1","sha256":"7e8122d3290713ebd0e84a3a0cfa6a66ae3334f0b199b3ab10ff1da7e415d8e9"}),
  packet: Object.freeze({"byte_length":397309,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-no-shop-365-profile-inventory-review-packet-draft.json","record_id":"77b2cf1589471399b460de242f30bca156e1c6e91c9e8c338c33ece521a7dda6","record_id_field":"inventory_review_packet_id","schema_version":"STAGE_2Y_M7_V2_NO_SHOP_365_PROFILE_INVENTORY_REVIEW_PACKET/V1","sha256":"d95231d6d8ee35d9353c5aa75ea1f048b88b7514d7651b5a3c6512f08e213bed"}),
  disposition: Object.freeze({"byte_length":134519,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-no-shop-365-profile-inventory-disposition.json","record_id":"2b699f59ddd30753447d2eae74fa1b6978ff5ab4d89084952ad2b4a21961440b","record_id_field":"inventory_disposition_id","schema_version":"STAGE_2Y_M7_V2_NO_SHOP_365_PROFILE_INVENTORY_DISPOSITION/V1","sha256":"8b9327c7f1ba0692e0c85a56f364693b27dc3ea205a8c00fb8454981e78ba512"}),
  session: Object.freeze({"byte_length":1097,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-no-shop-ben-inventory-session-receipt.json","record_id":"6fa1759cf77279f2749a6514408b850ad82f6c0c44bae9cbe7e5bfbc1c6f7f10","record_id_field":"ben_inventory_session_receipt_id","schema_version":"STAGE_2Y_M7_V2_NO_SHOP_BEN_INVENTORY_SESSION_RECEIPT/V1","sha256":"8e1cd69004bbb4977067daa7b7c65602323b6d7747f342935476df007aa72977"}),
  benAuthority: Object.freeze({"byte_length":2703,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-no-shop-ben-inventory-session-successor-authority.json","record_id":"3227e6a2a45d3cf482e9f38c29f0ebe1fb4ac667d0b431e71a88758e8b43ce23","record_id_field":"work3_no_shop_ben_inventory_session_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1","sha256":"fc60b23c46bbd2f1d35e4a015d50e552363a8468538df35368194203374ee5cf"}),
  sealAuthority: Object.freeze({"byte_length":3185,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-no-shop-family-package-seal-successor-authority.json","record_id":"484d18ddf3c539023613dec5584d21657c84ed1cbf7b51a5c71de1014f3f60ab","record_id_field":"work3_no_shop_family_package_seal_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1","sha256":"512cf97f018bc6f4dd04f743bde3e9901b4db0dbb4eec3af846166e63c31fce7"}),
  sealReceipt: Object.freeze({"byte_length":2234,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-no-shop-family-package-seal-receipt.json","record_id":"c23f4b512b7a46dbca2a8a4d177a15e0736f7e1bbe9b01e83cc136bd26afd0cc","record_id_field":"no_shop_family_package_seal_receipt_id","schema_version":"STAGE_2Y_M7_V2_NO_SHOP_FAMILY_PACKAGE_SEAL_RECEIPT/V1","sha256":"865dfdfb1ec76432c91fd769d1ae3f4ad86f803078d2851c39f79533fac75c38"}),
  registrationAuthority: Object.freeze({"byte_length":2715,"path":"evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-no-shop-registration-successor-authority.json","record_id":"e5e446b2ec6ea2b804af38c3b0afd30a976987216d0f1b7d845f301cc6302d8a","record_id_field":"work3_no_shop_registration_successor_authority_id","schema_version":"STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_REGISTRATION_SUCCESSOR_AUTHORITY/V1","sha256":"9284f484768166d87acb3be5a2c0c272650acee24fb5336b560426da2b3f2bf5"}),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: 'be14f1e6dd435214e995dd30683caf13b0fb5db966f23dbb02dc18ec3e867868',
  byte_length: 4394952,
  sha256: '3aa4efb51348ac6b4ff3d06b0d8fd15c99ba2e362960f2ff9ac2bd48edc0c963',
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
  const noShopAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    noShopAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      noShopAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    noShopAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    noShopAuthoringPhase2Authority:
      fixture.noShopAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3NoShopUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3NoShopBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3NoShopFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3NoShopRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved NO_SHOP partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.noShopAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, PHASE2_TERMINAL_COUNT);
  assert.equal(
    authority.calibration_source_contract.exact_calibration_claim_count,
    PHASE2_TERMINAL_COUNT,
  );
  assert.equal(authority.source_terminal_successor_contract.m4_silent_terminal_exact_count, 0);
  assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 58,
      [METSERA_AGREEMENT_ID]: 42,
      [MODIV_AGREEMENT_ID]: 33,
      [REDHAT_AGREEMENT_ID]: 40,
      [SKECHERS_AGREEMENT_ID]: 38,
      [SKYWATER_AGREEMENT_ID]: 49,
      [TOPBUILD_AGREEMENT_ID]: 105,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets.sort(),
    [
      'ENGAGEMENT_PERMISSION',
      'RECOMMENDATION_CHANGE',
      'REPRESENTATIVE_CONTROL',
      'RESTRICTION',
      'SAFE_DISCLOSURE',
      'STANDSTILL',
    ],
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.required_expression_signature)).length,
    PHASE2_TERMINAL_COUNT,
  );

  // KEY_DEFINED_TERMS / TERMINATION_FEE / PROXY_MEETING / TERMINATION Q02 link-only.
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['KEY_DEFINED_TERMS', 'TERMINATION_FEE', 'PROXY_MEETING', 'TERMINATION'],
  );

  const result = noShopAuthoring
    .prepareNoShopPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    noShopAuthoring.NO_SHOP_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_NO_SHOP_FAMILY_PROPOSAL/V1',
    family_key: 'NO_SHOP',
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
    FLAGS.OUTSIDE_CALIBRATION,
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    FLAGS.LEGAL_GROUPING,
    'NO_SHOP_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    FLAGS.SUBTYPE_DIVERGENCE,
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 NO_SHOP family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = noShopAuthoring
    .prepareNoShopPhase2FamilyProposal({
      noShopAuthoringPhase2Authority:
        fixture.noShopAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = noShopAuthoring
    .prepareNoShopFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    noShopAuthoring.NO_SHOP_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_365_PROFILE_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
      noShopAuthoring.NO_SHOP_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      noShopAuthoring.NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:NO_SHOP:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 NO_SHOP unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = noShopAuthoring
    .prepareNoShopWork3UnapprovedInventoryReview({
      noShopWork3UnapprovedInventoryReviewEvidence: {
        work3NoShopUnapprovedInventoryReviewAuthority:
          evidence.work3NoShopUnapprovedInventoryReviewAuthority,
      },
      noShopPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_365_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 88);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 NO_SHOP Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = noShopAuthoring
    .prepareNoShopWork3BenInventorySessionDisposition({
      noShopWork3BenInventorySessionDispositionEvidence: {
        work3NoShopUnapprovedInventoryReviewAuthority:
          evidence.work3NoShopUnapprovedInventoryReviewAuthority,
        work3NoShopBenInventorySessionSuccessorAuthority:
          evidence.work3NoShopBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      noShopPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      noShopAuthoring.NO_SHOP_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      noShopAuthoring.NO_SHOP_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      noShopAuthoring.NO_SHOP_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      noShopAuthoring.NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 NO_SHOP family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = noShopAuthoring.prepareNoShopWork3FamilyPackageSeal({
    noShopWork3FamilyPackageSealEvidence: {
      work3NoShopUnapprovedInventoryReviewAuthority:
        evidence.work3NoShopUnapprovedInventoryReviewAuthority,
      work3NoShopBenInventorySessionSuccessorAuthority:
        evidence.work3NoShopBenInventorySessionSuccessorAuthority,
      work3NoShopFamilyPackageSealSuccessorAuthority:
        evidence.work3NoShopFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    noShopPhase4ReviewInput: phase4Fixture(),
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
    noShopAuthoring.NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 NO_SHOP family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = noShopAuthoring
    .prepareNoShopWork3FamilyPackageRegistration({
      noShopWork3FamilyPackageRegistrationEvidence: evidence,
      noShopPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_NO_SHOP_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('NoShop Milestone A inventory packet draft carries shape summaries and honest holds', () => {
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
    noShopAuthoring.NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    noShopAuthoring.NO_SHOP_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
});

test('NoShop Milestone A disposition approves 365 profiles and reuses only sealed M5 rulings', () => {
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

test('NoShop Milestone A family profile package on disk validates 365 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:NO_SHOP:PROFILE_SET_V1',
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

  const phase4 = noShopAuthoring
    .prepareNoShopFamilyProfilePackageReview(phase4Fixture());
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

test('lawful Work3 fixture NO_SHOP on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'NO_SHOP',
  );
  assert.ok(override, 'lawful Work3 fixture has no NO_SHOP on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
