'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');
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

const GUARANTY_PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_GUARANTY_FINANCING_PARTY_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'guaranty_financing_party_authoring_phase2_authority_id',
  record_id: '080c15fc2686a0b56fb05b2b74a70a3346f67cfceb1b55b33ea34287078745eb',
  byte_length: 28899,
  sha256: '1f84b8fd0866331675fa71ac7b7aabbd37c8b2f8c4234e48f3d70c63947cf75b',
});

const GUARANTY_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

const GUARANTY_PHASE2_CLASSIFICATION_BUCKETS = Object.freeze([
  'PERFORMANCE_GUARANTY',
  'LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP',
  'GUARANTY_NO_DEFAULT_REP',
  'FINANCING_SOURCE_PROTECTION',
]);

const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const SKECHERS_GOVERNED_CLAIM_ID =
  'ab3d1eedf5d9e8c5b44bb367398bc280f003b5a4a076e01cac1a638168bafad7';

const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;
const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

let guarantyAuthoring;
try {
  guarantyAuthoring = require('../lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js');
} catch (error) {
  throw new Error('GUARANTY_FINANCING_PARTY Phase2 proposal facade export is missing.');
}

if (typeof guarantyAuthoring.prepareGuarantyFinancingPartyPhase2FamilyProposal !== 'function') {
  throw new Error('GUARANTY_FINANCING_PARTY Phase2 proposal facade export is missing.');
}

if (typeof guarantyAuthoring.prepareGuarantyFinancingPartyFamilyProfilePackageReview !== 'function') {
  throw new Error('GUARANTY_FINANCING_PARTY Phase4 package review facade export is missing.');
}

const GUARANTY_PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_PATH,
  schema_version: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'guaranty_financing_party_authoring_phase4_family_profile_package_review_authority_id',
  record_id: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_ID,
  byte_length: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_BYTES,
  sha256: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_SHA256,
});

const GUARANTY_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2092,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-guaranty-financing-party-unapproved-inventory-review-authority.json',
    record_id: '5fc7252784bee6ed734d90282f1e1c4639d612b1f76381595048bb29810886a8',
    record_id_field: 'work3_guaranty_financing_party_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'b59c91d71e174eecf25efb04dedc21ab1af8f29fe98ab1b927ce74c5d942a956',
  }),
  packet: Object.freeze({
    byte_length: 4819,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-5-profile-inventory-review-packet-draft.json',
    record_id: '73311137535798eb3d396e2ef6742824d768541498fe57de4852bfe152b2711a',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_5_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '8849f940433d4db158307f245a169a85ff3338eb0b5e8c83866545f5b9f65dde',
  }),
  disposition: Object.freeze({
    byte_length: 1925,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-5-profile-inventory-disposition.json',
    record_id: 'b92987487b2803a0026901f590324e3899c64b35a29a738c681cd535d1b4d417',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_5_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: 'b80f95de50d877889528b802199f0d6844a5a66ac6218b15fb41a0aa1723fdad',
  }),
  session: Object.freeze({
    byte_length: 1127,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-ben-inventory-session-receipt.json',
    record_id: 'cbfd98f2a0bab840c4a628f8b58d649e9992d10f89d81ec639806a5faf5ea307',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '2f5c724c93863bff83c3c59f9e8df7ae44db81215bd4da5fb16062c9cbe3c056',
  }),
  benAuthority: Object.freeze({
    byte_length: 2851,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-guaranty-financing-party-ben-inventory-session-successor-authority.json',
    record_id: '3819888b052e59de76520db8839205040bd85cf86e32435b4c3ba97d295d0cea',
    record_id_field: 'work3_guaranty_financing_party_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'd1c1a277aeb7321934aae16a51fb47f4877074044806ffbf2d24d6cec79c819a',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3388,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-guaranty-financing-party-family-package-seal-successor-authority.json',
    record_id: '0dd1e37fa8a30d024ac310f0a05e88597a266a5ee858cdc69750e09630dafe5e',
    record_id_field: 'work3_guaranty_financing_party_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: 'b80c82b25904597cdb9899ac17e8680c7fdeb6ab50899c679b141b032813ec35',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2436,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-financing-party-family-package-seal-receipt.json',
    record_id: 'ce34d6ad583392c284415b6cb5823c9b0a0b487ea5a7010f2cb8060c3376f8ed',
    record_id_field: 'guaranty_financing_party_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: 'cf8681de66e3e64c5d072c9364dc1b3480f44f53fb3c6953cbcc3c071fe7eba0',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 3004,
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-guaranty-financing-party-registration-successor-authority.json',
    record_id: '6e76c084a0558e5c359cd9931715aecc956f706d2696fef6bec6d91c9e4bd317',
    record_id_field: 'work3_guaranty_financing_party_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '6f4f3fe42e537275d64c0637a7796aad95b502e7b1f54aeee96ab2165c19f464',
  }),
});

const GUARANTY_PHASE4_OUTPUT_KEYS = Object.freeze([
  ...guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_REVIEW_OUTPUT_KEYS,
]);
const GUARANTY_PHASE4_PROFILE_KEYS = Object.freeze([
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
const GUARANTY_PHASE4_VALIDATION_KEYS = Object.freeze([
  'extraction_state',
  'issue_codes',
  'no_comparison_authority',
  'output_disposition',
  'source_quality',
]);
const GUARANTY_PHASE4_WITHHELD_WORK3_FIELDS = Object.freeze([
  'work3_profile_id',
  'work3_package_id',
  'work3_registration_id',
  'work3_activation_id',
  'work3_fixture_fact_id',
]);

const GUARANTY_WORK3_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '7aca6955f1763b0e99c560901f262ebe9b62cef750a5eada375828fbfd9f8d7e',
  byte_length: 69564,
  sha256: '155c65d3bfd366ce28b5d889e5f05a71685081e8d12c2bc6b2c1ad7aa52552cb',
});

const GUARANTY_GROUPING_SUCCESSOR_BINDINGS = Object.freeze({
  package: Object.freeze({
    byte_length: 70377,
    git_blob_oid: 'f8c7bc8ab13c94c4537a628ccc8e0d6c219f5250',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-guaranty-financing-party-grouping-successor-2026-09-01B.json',
    record_id: '02acdf8a496350988f03581e638198fa62a45fd456a356c2439a1bab7a555d4f',
    record_id_field: 'family_profile_package_id',
    schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
    sha256: 'f2c700bef8eca84a346d1416ae7da20b3a75fc7c257c9e9cba27a480ec23b4b6',
  }),
  disposition: Object.freeze({
    byte_length: 4986,
    git_blob_oid: 'eaa2696f3ce7401926bf4535be044643de00c86f',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json',
    record_id: 'bb3771095e24a3d38f760cff1a94b4ebd372a7892109eb7f0dd10a312ef098a4',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'N1_GROUPING_INVENTORY_DISPOSITION_SUCCESSOR/V1',
    sha256: '652b571d5570b79ea93e9745fcab0cda43cbfc1e02abc5c48bb6e085b7fba511',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 4247,
    git_blob_oid: 'fc286c5d39a2213e946124f926d2f3dd608b1356',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-guaranty-financing-party-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: 'ad1efb8ad4b499e5f08f05fae77cc86b70b9f27325dd8d15beab87a799c94d71',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '7316d5fb453b4c0d4e4b23e8fff0f6e879f549b39fad35cde87c314af215e7d4',
  }),
  applicationReceipt: Object.freeze({
    byte_length: 8054,
    git_blob_oid: 'ac1695d05cc72ffcc8ff1d183aa93a30d5d96e7e',
    path:
      'docs/codex-program/notes/N1-GUARANTY-FINANCING-PARTY-GROUPING-RULING-APPLICATION-RECEIPT-2026-09-01B.json',
    record_id: '013fd7fd17bfd16ffe85d92cdb6921f23321d711ae8e8148268b8b4b1a271ae9',
    record_id_field: 'ruling_application_receipt_id',
    schema_version: 'N1_RULING_APPLICATION_RECEIPT/V1',
    sha256: '33abd45942a933875da07b4d30c41af0cbf9ba3ae99a857878bca81d670f6df2',
  }),
});

const GUARANTY_APPROVED_GROUPING_MAPPINGS = Object.freeze([
  '54c2f682259425029ab2fe9f4b3b403033d0ecc7030560af5b35612cdcd25f4f',
  '5f8d891db2433a344dd4d2e286b15ccfc2bb93082601c73a76f34b4a8b09cc73',
  '9b4c3a664306ceab1fb9e74fd58bcf569e2e111703068b31f5eb4814a67e9b67',
  'a54ba3d2c5547f28a83e1f59f8380e15cb78be83d425a93d930662bf9d87d857',
  'd5c5094f1ad8de4b994aee71b2bd657429936a144bc5dc22f6997565cb88267c',
].map((proposedProfileKey, index) => Object.freeze({
  approved_comparison_fields: [
    'per-deal presence',
    'named guarantor where evidence supplies it',
  ],
  approved_comparison_lines: ['Performance guaranty'],
  approved_link_target: null,
  family_key: 'GUARANTY_FINANCING_PARTY',
  grouping_note: null,
  ordinal: index + 1,
  party_band: null,
  proposed_profile_key: proposedProfileKey,
  ruling_ordinal: 3,
  state: 'APPLIED_PENDING_INDEPENDENT_REVIEW',
})));

const GUARANTY_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';

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

function exactPhysicalRecord(binding) {
  const file = readFileSync(join(REPO_ROOT, binding.path));
  assert.equal(file.length, binding.byte_length, binding.path);
  assert.equal(sha256Hex(file), binding.sha256, binding.path);
  assert.equal(
    createHash('sha1').update(Buffer.concat([
      Buffer.from(`blob ${file.length}\0`, 'utf8'),
      file,
    ])).digest('hex'),
    binding.git_blob_oid,
    binding.path,
  );
  const record = JSON.parse(file.toString('utf8'));
  assert.equal(record.schema_version, binding.schema_version, binding.path);
  assert.equal(record[binding.record_id_field], binding.record_id, binding.path);
  const unsigned = { ...record };
  delete unsigned[binding.record_id_field];
  assert.equal(
    contentId(record.schema_version, unsigned),
    binding.record_id,
    binding.path,
  );
  return record;
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

function guarantyPhase2AuthorityEnvelope() {
  physicalBytes(GUARANTY_PHASE2_AUTHORITY_BINDING);
  return sourceEnvelope(GUARANTY_PHASE2_AUTHORITY_BINDING);
}

function guarantyPhase2GovernedSources(authorityRecord) {
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

function guarantyPhase2ProposalFixture() {
  const guarantyFinancingPartyAuthoringPhase2Authority = guarantyPhase2AuthorityEnvelope();
  return {
    guarantyFinancingPartyAuthoringPhase2Authority,
    governedSources: guarantyPhase2GovernedSources(
      guarantyFinancingPartyAuthoringPhase2Authority.record,
    ),
  };
}

function guarantyPhase4ProposalFixture() {
  const phase2Fixture = guarantyPhase2ProposalFixture();
  return {
    guarantyFinancingPartyAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(GUARANTY_PHASE4_AUTHORITY_BINDING),
    guarantyFinancingPartyAuthoringPhase2Authority:
      phase2Fixture.guarantyFinancingPartyAuthoringPhase2Authority,
    governedSources: phase2Fixture.governedSources,
  };
}

function guarantyWork3Evidence() {
  return {
    work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority:
      sourceEnvelope(GUARANTY_WORK3_BINDINGS.inventoryAuthority),
    work3GuarantyFinancingPartyBenInventorySessionSuccessorAuthority:
      sourceEnvelope(GUARANTY_WORK3_BINDINGS.benAuthority),
    work3GuarantyFinancingPartyFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(GUARANTY_WORK3_BINDINGS.sealAuthority),
    work3GuarantyFinancingPartyRegistrationSuccessorAuthority:
      sourceEnvelope(GUARANTY_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(GUARANTY_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(GUARANTY_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(GUARANTY_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(GUARANTY_WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved GUARANTY_FINANCING_PARTY partition', async (t) => {
  const fixture = guarantyPhase2ProposalFixture();
  const authorityEnvelope = fixture.guarantyFinancingPartyAuthoringPhase2Authority;
  const authority = authorityEnvelope.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 2);
  assert.equal(terminals.length, 5);
  assert.equal(authority.calibration_source_contract.exact_calibration_claim_count, 1);
  assert.equal(
    authority.source_terminal_successor_contract.m4_silent_terminal_exact_count,
    4,
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );

  const expectedClaimIds = sortedUnique(terminals.flatMap(
    (terminal) => terminal.m4_claim_ids,
  ));
  assert.equal(expectedClaimIds.length, 1);
  assert.deepEqual(expectedClaimIds, [SKECHERS_GOVERNED_CLAIM_ID]);

  const result = guarantyAuthoring.prepareGuarantyFinancingPartyPhase2FamilyProposal(fixture);

  assertExactKeys(result, GUARANTY_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_GUARANTY_FINANCING_PARTY_FAMILY_PROPOSAL/V1',
    family_key: 'GUARANTY_FINANCING_PARTY',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    zero_m4_claim_gaps: true,
  });
  assert.deepEqual(result.authority_binding, GUARANTY_PHASE2_AUTHORITY_BINDING);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.equal(result.derived_profile_count, 5);
  assert.equal(result.proposed_partition.proposed_profiles.length, 5);
  assert.deepEqual(
    result.source_terminal_coverage.classification_buckets,
    GUARANTY_PHASE2_CLASSIFICATION_BUCKETS,
  );
  assert.equal(result.m4_claim_accounting.expected_count, 1);
  assert.equal(result.m4_claim_accounting.accounted_count, 1);
  assert.deepEqual(result.m4_claim_accounting.expected_claim_ids, expectedClaimIds);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(result.authorised_rule_components.length, 0);
  assert.equal(result.proposed_partition.source_unit_assignment_count, 5);
  assert.equal(result.proposed_partition.m4_claim_assignment_count, 1);
  assert.deepEqual(result.unresolved_items, [
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    'GUARANTY_FINANCING_PARTY_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
  ]);

  const silentAssignments = result.source_terminal_coverage.source_unit_assignments.filter(
    (assignment) => assignment.m4_claim_ids.length === 0,
  );
  assert.equal(silentAssignments.length, 4);
  const skechersAssignments = result.source_terminal_coverage.source_unit_assignments.filter(
    (assignment) => terminals.find(
      (terminal) => terminal.source_unit_key === assignment.source_unit_key,
    )?.agreement_id === SKECHERS_AGREEMENT_ID,
  );
  const redhatAssignments = result.source_terminal_coverage.source_unit_assignments.filter(
    (assignment) => terminals.find(
      (terminal) => terminal.source_unit_key === assignment.source_unit_key,
    )?.agreement_id === REDHAT_AGREEMENT_ID,
  );
  assert.equal(skechersAssignments.length, 3);
  assert.equal(redhatAssignments.length, 2);

  const governedProfile = result.proposed_partition.proposed_profiles.find(
    (profile) => profile.m4_claim_ids.length === 1,
  );
  assert(governedProfile);
  assert.equal(governedProfile.m4_claim_ids[0], SKECHERS_GOVERNED_CLAIM_ID);
  assert.equal(
    governedProfile.canonical_tuple.required_expression_signature,
    'GUARANTY_FINANCING_PARTY::PERFORMANCE_GUARANTY::SKECHERS_4_13_COMPLETE_PROVISION',
  );
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 GUARANTY_FINANCING_PARTY family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(GUARANTY_PHASE4_AUTHORITY_BINDING);
  const authorityEnvelope = sourceEnvelope(GUARANTY_PHASE4_AUTHORITY_BINDING);
  const authority = authorityEnvelope.record;
  assert.equal(authority.profile_review_schedule.length, 5);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = guarantyPhase4ProposalFixture();
  const phase2Proposal = guarantyAuthoring.prepareGuarantyFinancingPartyPhase2FamilyProposal({
    guarantyFinancingPartyAuthoringPhase2Authority:
      fixture.guarantyFinancingPartyAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  });
  const result = guarantyAuthoring.prepareGuarantyFinancingPartyFamilyProfilePackageReview(fixture);

  assertExactKeys(result, GUARANTY_PHASE4_OUTPUT_KEYS, 'Phase4 package review candidate keys');
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_5_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.deepEqual(result.phase2_proposal_reference, {
    schema_version: phase2Proposal.schema_version,
    proposal_id: phase2Proposal.proposal_id,
    source_unit_count: 5,
    claim_count: 1,
    derived_profile_count: 5,
  });
  assert.equal(result.proposed_profiles.length, 5);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: 5,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: 5,
    proposed_profile_count: 5,
    review_only_profile_count: 5,
    work3_identity_count: 0,
  });
  assert.deepEqual(result.withheld_work3_fields, GUARANTY_PHASE4_WITHHELD_WORK3_FIELDS);
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(profile, GUARANTY_PHASE4_PROFILE_KEYS, `${profile.proposed_profile_key} keys`);
    assertExactKeys(
      profile.proposed_validation,
      GUARANTY_PHASE4_VALIDATION_KEYS,
      `${profile.proposed_profile_key} validation`,
    );
    assert.deepEqual(profile.review_flags, ['LEGAL_GROUPING_REVIEW_REQUIRED']);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:GUARANTY_FINANCING_PARTY:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 GUARANTY_FINANCING_PARTY unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(GUARANTY_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(GUARANTY_WORK3_BINDINGS.packet);
  const evidence = guarantyWork3Evidence();
  const result = guarantyAuthoring.prepareGuarantyFinancingPartyWork3UnapprovedInventoryReview({
    guarantyFinancingPartyWork3UnapprovedInventoryReviewEvidence: {
      work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority:
        evidence.work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority,
    },
    guarantyFinancingPartyPhase4ReviewInput: guarantyPhase4ProposalFixture(),
  });

  assert.equal(result.candidate_state,
    'UNAPPROVED_5_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED');
  assert.equal(result.inventory_packet_reference.profile_count, 5);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 GUARANTY_FINANCING_PARTY Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(GUARANTY_WORK3_BINDINGS.benAuthority);
  physicalBytes(GUARANTY_WORK3_BINDINGS.disposition);
  const evidence = guarantyWork3Evidence();
  const result = guarantyAuthoring.prepareGuarantyFinancingPartyWork3BenInventorySessionDisposition({
    guarantyFinancingPartyWork3BenInventorySessionDispositionEvidence: {
      work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority:
        evidence.work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority,
      work3GuarantyFinancingPartyBenInventorySessionSuccessorAuthority:
        evidence.work3GuarantyFinancingPartyBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    guarantyFinancingPartyPhase4ReviewInput: guarantyPhase4ProposalFixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, 5);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 5,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: 5,
    performance_guaranty_grouping_pending_legal: true,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 GUARANTY_FINANCING_PARTY family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(GUARANTY_WORK3_BINDINGS.session);
  physicalBytes(GUARANTY_WORK3_BINDINGS.sealAuthority);
  const evidence = guarantyWork3Evidence();
  const result = guarantyAuthoring.prepareGuarantyFinancingPartyWork3FamilyPackageSeal({
    guarantyFinancingPartyWork3FamilyPackageSealEvidence: {
      work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority:
        evidence.work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority,
      work3GuarantyFinancingPartyBenInventorySessionSuccessorAuthority:
        evidence.work3GuarantyFinancingPartyBenInventorySessionSuccessorAuthority,
      work3GuarantyFinancingPartyFamilyPackageSealSuccessorAuthority:
        evidence.work3GuarantyFinancingPartyFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    guarantyFinancingPartyPhase4ReviewInput: guarantyPhase4ProposalFixture(),
  });

  assert.equal(result.family_package_seal_id,
    evidence.familyPackageSealReceipt.record.family_package_seal_id);
  assert.equal(result.legal_grouping_disposition_binding.disposition_status, 'PENDING_LEGAL_REVIEW');
  assert.equal(result.legal_grouping_disposition_binding.legal_grouping_review_pending_count, 5);
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 GUARANTY_FINANCING_PARTY family package registration binds seal receipt without activation', () => {
  physicalBytes(GUARANTY_WORK3_BINDINGS.sealReceipt);
  physicalBytes(GUARANTY_WORK3_BINDINGS.registrationAuthority);
  const evidence = guarantyWork3Evidence();
  const result = guarantyAuthoring.prepareGuarantyFinancingPartyWork3FamilyPackageRegistration({
    guarantyFinancingPartyWork3FamilyPackageRegistrationEvidence: evidence,
    guarantyFinancingPartyPhase4ReviewInput: guarantyPhase4ProposalFixture(),
  });

  assert.equal(result.candidate_state,
    'BEN_GUARANTY_FINANCING_PARTY_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT');
  assert.equal(result.registered_profile_identities.length, 5);
  assert.equal(result.family_profile_package_identity.profile_id_count, 5);
  assert.equal(result.review_accounting.work3_identity_count, 6);
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

test('Guaranty Milestone A inventory packet draft has shape_summary and review_flags for 5 profiles', () => {
  physicalBytes(GUARANTY_WORK3_BINDINGS.packet);
  const packet = readRecord(GUARANTY_WORK3_BINDINGS.packet.path);
  assert.equal(packet.profile_count, 5);
  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary, 'string');
    assert.ok(item.shape_summary.length > 0);
    assert.deepEqual(item.review_flags, ['LEGAL_GROUPING_REVIEW_REQUIRED']);
  }
});

test('Guaranty Milestone A ben inventory disposition records 5 APPROVE rows with legal grouping pending', () => {
  physicalBytes(GUARANTY_WORK3_BINDINGS.disposition);
  const disposition = readRecord(GUARANTY_WORK3_BINDINGS.disposition.path);
  assert.equal(disposition.session_summary.approved_count, 5);
  assert.equal(disposition.session_summary.hold_count, 0);
  assert.equal(disposition.session_summary.legal_grouping_review_pending_count, 5);
  assert.equal(disposition.session_summary.performance_guaranty_grouping_pending_legal, true);
  assert.equal(
    disposition.profile_dispositions.filter((row) => row.disposition === 'APPROVE').length,
    5,
  );
});

test('Guaranty Milestone A family profile package on disk validates 5 registered profiles', () => {
  physicalBytes(GUARANTY_WORK3_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(GUARANTY_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, 5);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:GUARANTY_FINANCING_PARTY:PROFILE_SET_V1',
  );

  const work3Authority = readRecord(GUARANTY_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
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

  const phase4 = guarantyAuthoring.prepareGuarantyFinancingPartyFamilyProfilePackageReview(
    guarantyPhase4ProposalFixture(),
  );
  const packageKeys = packageRecord.profiles.map((profile) => profile.profile_key).sort();
  const phase4Keys = phase4.proposed_profiles
    .map((profile) => profile.package_profile_key)
    .sort();
  assert.deepEqual(packageKeys, phase4Keys);
});

test('GUARANTY_FINANCING_PARTY 2026-09-01B grouping successor applies the exact mapping set', () => {
  const packageRecord = exactPhysicalRecord(GUARANTY_GROUPING_SUCCESSOR_BINDINGS.package);
  const disposition = exactPhysicalRecord(GUARANTY_GROUPING_SUCCESSOR_BINDINGS.disposition);
  const registrationAuthority = exactPhysicalRecord(
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.registrationAuthority,
  );
  const applicationReceipt = exactPhysicalRecord(
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.applicationReceipt,
  );
  const predecessorDisposition = readRecord(GUARANTY_WORK3_BINDINGS.disposition.path);

  assert.equal(packageRecord.family_key, 'GUARANTY_FINANCING_PARTY');
  assert.equal(packageRecord.profiles.length, 5);
  assert.deepEqual(registrationAuthority.successor_package_binding,
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.package);
  assert.deepEqual(registrationAuthority.successor_disposition_binding,
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.disposition);
  assert.deepEqual(applicationReceipt.package_transition.successor,
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.package);
  assert.deepEqual(applicationReceipt.successor_disposition_binding,
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.disposition);
  assert.deepEqual(
    applicationReceipt.successor_authorities.find(
      (binding) => binding.path
        === GUARANTY_GROUPING_SUCCESSOR_BINDINGS.registrationAuthority.path,
    ),
    GUARANTY_GROUPING_SUCCESSOR_BINDINGS.registrationAuthority,
  );

  assert.deepEqual(disposition.profile_dispositions.map((row) => ({
    ...row.grouping_ruling_application,
    ordinal: row.ordinal,
    proposed_profile_key: row.proposed_profile_key,
  })), GUARANTY_APPROVED_GROUPING_MAPPINGS);
  assert.equal(disposition.session_summary.grouping_ruling_mapped_count, 5);
  assert.equal(disposition.session_summary.legal_grouping_review_cleared_count, 5);
  assert.equal(disposition.session_summary.legal_grouping_review_held_ambiguous_count, 0);
  assert.equal(disposition.session_summary.legal_grouping_review_pending_count, 0);
  assert.deepEqual(
    registrationAuthority.exact_grouping_stamp_clearance_ordinals,
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(registrationAuthority.exact_held_ambiguous_ordinals, []);
  assert.deepEqual(
    registrationAuthority.exact_mapped_without_predecessor_grouping_stamp_ordinals,
    [],
  );
  assert.equal(applicationReceipt.grouping_stamp_clearance_count, 5);
  assert.equal(applicationReceipt.held_ambiguous_count, 0);
  assert.equal(applicationReceipt.independent_review_state, 'PENDING');
  assert.equal(applicationReceipt.row_applications.length, 5);
  assert.equal(applicationReceipt.stamp_cleared, true);

  for (const row of disposition.profile_dispositions) {
    const predecessorRow = predecessorDisposition.profile_dispositions.find(
      (candidate) => candidate.ordinal === row.ordinal
        && candidate.proposed_profile_key === row.proposed_profile_key,
    );
    assert.ok(predecessorRow, `missing predecessor row ${row.ordinal}`);
    assert.deepEqual(
      row.prior_review_flags_acknowledged,
      predecessorRow.review_flags_acknowledged,
    );
    assert.deepEqual(
      row.review_flags_acknowledged,
      predecessorRow.review_flags_acknowledged.filter(
        (flag) => flag !== 'LEGAL_GROUPING_REVIEW_REQUIRED',
      ),
    );
    assert.deepEqual(
      predecessorRow.review_flags_acknowledged.filter(
        (flag) => !row.review_flags_acknowledged.includes(flag),
      ),
      ['LEGAL_GROUPING_REVIEW_REQUIRED'],
    );
    assert.equal(
      row.grouping_ruling_application.state,
      'APPLIED_PENDING_INDEPENDENT_REVIEW',
    );
    const receiptRow = applicationReceipt.row_applications.find(
      (candidate) => candidate.ordinal === row.ordinal,
    );
    assert.deepEqual(receiptRow.prior_review_flags_acknowledged,
      row.prior_review_flags_acknowledged);
    assert.deepEqual(receiptRow.after_review_flags_acknowledged,
      row.review_flags_acknowledged);
    assert.deepEqual(receiptRow.grouping_ruling_application,
      row.grouping_ruling_application);
  }

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
    (entry) => entry.family_key === 'GUARANTY_FINANCING_PARTY',
  );
  assert.ok(
    override,
    'lawful Work3 fixture has no GUARANTY_FINANCING_PARTY on-disk override',
  );
  assert.deepEqual(override.binding, GUARANTY_GROUPING_SUCCESSOR_BINDINGS.package);
});
