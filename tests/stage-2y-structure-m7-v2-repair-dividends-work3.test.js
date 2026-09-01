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

let dividendsAuthoring;
try {
  dividendsAuthoring = require('../lib/canonical-v2/m7-v2-dividends-authoring.js');
} catch (error) {
  throw new Error('DIVIDENDS Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareDividendsPhase2FamilyProposal',
  'prepareDividendsFamilyProfilePackageReview',
  'prepareDividendsWork3UnapprovedInventoryReview',
  'prepareDividendsWork3BenInventorySessionDisposition',
  'prepareDividendsWork3FamilyPackageSeal',
  'prepareDividendsWork3FamilyPackageRegistration',
]) {
  if (typeof dividendsAuthoring[facade] !== 'function') {
    throw new Error(`DIVIDENDS ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = dividendsAuthoring.DIVIDENDS_PROFILE_COUNT;
const FLAGS = dividendsAuthoring.DIVIDENDS_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'DIVIDEND_COORDINATION',
  'PERMITTED_PRE_CLOSING_DISTRIBUTION',
  'UNPAID_DECLARED_DISTRIBUTION',
  'CONSIDERATION_ADJUSTMENT_LINK',
  'INTERIM_RESTRICTION_LINK',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_PATH,
  schema_version: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'dividends_authoring_phase2_authority_id',
  record_id: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_ID,
  byte_length: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_BYTES,
  sha256: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_PATH,
  schema_version: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'dividends_authoring_phase4_family_profile_package_review_authority_id',
  record_id: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_ID,
  byte_length: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_BYTES,
  sha256: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2043,
    path: `${CONTROL}/m7-v2-repair-contract-work3-dividends-unapproved-inventory-review-authority.json`,
    record_id: '2607841294b5f236ec61851d2ff2bd1651342c4989077f63489506eda7bdaa54',
    record_id_field: 'work3_dividends_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'd33685efb816492f164a7b9343f485e07ec64ef19bdfa5fb95af9aca2ca1b8c5',
  }),
  packet: Object.freeze({
    byte_length: 2387,
    path: `${CONTROL}/m7-v2-repair-dividends-1-profile-inventory-review-packet-draft.json`,
    record_id: '719e194e750d41beb5400e9f8771ee5c2d69cc19b64c4362d8c1bf63a80514a3',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_1_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: 'fdde3ea31bdc2821de307d5fda89bb1b7a25b60b72180700e2defe84f0ff06b1',
  }),
  disposition: Object.freeze({
    byte_length: 1867,
    path: `${CONTROL}/m7-v2-repair-dividends-1-profile-inventory-disposition.json`,
    record_id: '2a8bced08d00987060a30861cdb53ed0c2b78ebf7f428cd784ecfe1ed6c8f689',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_1_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '44cbeeda2e96460aa1b1b1cf96ce31bc4711a50661e53e78005f94187bafcef9',
  }),
  session: Object.freeze({
    byte_length: 1099,
    path: `${CONTROL}/m7-v2-repair-dividends-ben-inventory-session-receipt.json`,
    record_id: '5790414e5d3525cce40ca89a6922d339310d6aa8c419f2acbbf520749828a017',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: 'e20a2a22c4ffc7aabdd12353e173e664000df9b6e80cadc73165fe388616857c',
  }),
  benAuthority: Object.freeze({
    byte_length: 2723,
    path: `${CONTROL}/m7-v2-repair-contract-work3-dividends-ben-inventory-session-successor-authority.json`,
    record_id: '13a77f180980a2c485b50d9f59a7263f44c2104b665525adb82f50d98903601d',
    record_id_field: 'work3_dividends_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'b5a333dfe4bc8fc81e7a2213809e0732031223d88e288aaae5be7e0f83c3eba7',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3218,
    path: `${CONTROL}/m7-v2-repair-contract-work3-dividends-family-package-seal-successor-authority.json`,
    record_id: '021b9c749f86bd34a0567cbc880c98a0f569a7195e9c8c3066a6494a47d178f3',
    record_id_field: 'work3_dividends_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '7941928134a8f6105ee1b02380d3aab09ac49aa6f3071b905a43caeb7245ee1b',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2238,
    path: `${CONTROL}/m7-v2-repair-dividends-family-package-seal-receipt.json`,
    record_id: '96396c292a86e63cfade899891942ebc0e6c0bd7450e69aea1479bc136a4bc96',
    record_id_field: 'dividends_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '5797baf16641401fe5d5ed63c97ff3843f4db1597bc30be745bbcf21276d2439',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2748,
    path: `${CONTROL}/m7-v2-repair-contract-work3-dividends-registration-successor-authority.json`,
    record_id: '3d4e7ba3c345d6e3148b009ca1d5e4ba15dd3bdc186e2b2c824c357aa224d41a',
    record_id_field: 'work3_dividends_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '893eee79fcdf885b0376ed783cff09f372ffad2fcc9fbadf91c5889d6fdf8190',
  }),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-dividends.json`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '4226cea7ffbdbdc8a9c7a6d5e3d57f224d96731838f87228d38592fd9221064c',
  byte_length: 18004,
  sha256: '560ecb4655a5e9afc8388b89285f863e0179d6f3f56784bd020a93e49848dce0',
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
  const dividendsAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    dividendsAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      dividendsAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    dividendsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    dividendsAuthoringPhase2Authority:
      fixture.dividendsAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3DividendsUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3DividendsBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3DividendsFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3DividendsRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved DIVIDENDS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.dividendsAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 1);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.equal(
    authority.calibration_source_contract.exact_calibration_claim_count,
    PROFILE_COUNT,
  );
  assert.equal(authority.source_terminal_successor_contract.m4_silent_terminal_exact_count, 0);
  assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 1,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    ['DIVIDEND_COORDINATION'],
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.required_expression_signature)).length,
    PROFILE_COUNT,
  );

  // No cross-family link-only boundaries in the Concho comparator slice.
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.length, 0
  );

  const result = dividendsAuthoring
    .prepareDividendsPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    dividendsAuthoring.DIVIDENDS_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_DIVIDENDS_FAMILY_PROPOSAL/V1',
    family_key: 'DIVIDENDS',
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
    'DIVIDENDS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
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

test('Phase4 DIVIDENDS family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = dividendsAuthoring
    .prepareDividendsPhase2FamilyProposal({
      dividendsAuthoringPhase2Authority:
        fixture.dividendsAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = dividendsAuthoring
    .prepareDividendsFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    dividendsAuthoring.DIVIDENDS_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_1_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
    complete_profile_count: 1,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: 1,
    outside_calibration_example_flag_count: 0,
    proposed_profile_count: 1,
    review_only_profile_count: 1,
    subtype_partition_divergence_flag_count: 0,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:DIVIDENDS:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 DIVIDENDS unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = dividendsAuthoring
    .prepareDividendsWork3UnapprovedInventoryReview({
      dividendsWork3UnapprovedInventoryReviewEvidence: {
        work3DividendsUnapprovedInventoryReviewAuthority:
          evidence.work3DividendsUnapprovedInventoryReviewAuthority,
      },
      dividendsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_1_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 0);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 DIVIDENDS Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = dividendsAuthoring
    .prepareDividendsWork3BenInventorySessionDisposition({
      dividendsWork3BenInventorySessionDispositionEvidence: {
        work3DividendsUnapprovedInventoryReviewAuthority:
          evidence.work3DividendsUnapprovedInventoryReviewAuthority,
        work3DividendsBenInventorySessionSuccessorAuthority:
          evidence.work3DividendsBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      dividendsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 1,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: 1,
    outside_calibration_example_count: 0,
    populated_subtype_bucket_count: 1,
    registered_subtype_bucket_count: 5,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count: 0,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 DIVIDENDS family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = dividendsAuthoring.prepareDividendsWork3FamilyPackageSeal({
    dividendsWork3FamilyPackageSealEvidence: {
      work3DividendsUnapprovedInventoryReviewAuthority:
        evidence.work3DividendsUnapprovedInventoryReviewAuthority,
      work3DividendsBenInventorySessionSuccessorAuthority:
        evidence.work3DividendsBenInventorySessionSuccessorAuthority,
      work3DividendsFamilyPackageSealSuccessorAuthority:
        evidence.work3DividendsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    dividendsPhase4ReviewInput: phase4Fixture(),
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
    0,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 DIVIDENDS family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = dividendsAuthoring
    .prepareDividendsWork3FamilyPackageRegistration({
      dividendsWork3FamilyPackageRegistrationEvidence: evidence,
      dividendsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_DIVIDENDS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Dividends Milestone A inventory packet draft carries shape summaries and honest holds', () => {
  physicalBytes(WORK3_BINDINGS.packet);
  const packet = readRecord(WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.comparator_deal_count, 1);
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
    0,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    0,
  );
});

test('Dividends Milestone A disposition approves 1 profiles and reuses only sealed M5 rulings', () => {
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

test('Dividends Milestone A family profile package on disk validates 1 registered profile', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:DIVIDENDS:PROFILE_SET_V1',
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

  const phase4 = dividendsAuthoring
    .prepareDividendsFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),
    ['DIVIDEND_COORDINATION'],
  );
});

test('lawful Work3 fixture DIVIDENDS on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'DIVIDENDS',
  );
  assert.ok(override, 'lawful Work3 fixture has no DIVIDENDS on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
