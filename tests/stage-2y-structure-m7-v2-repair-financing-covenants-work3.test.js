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
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';

let financingCovenantsAuthoring;
try {
  financingCovenantsAuthoring = require('../lib/canonical-v2/m7-v2-financing-covenants-authoring.js');
} catch (error) {
  throw new Error('FINANCING_COVENANTS Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareFinancingCovenantsPhase2FamilyProposal',
  'prepareFinancingCovenantsFamilyProfilePackageReview',
  'prepareFinancingCovenantsWork3UnapprovedInventoryReview',
  'prepareFinancingCovenantsWork3BenInventorySessionDisposition',
  'prepareFinancingCovenantsWork3FamilyPackageSeal',
  'prepareFinancingCovenantsWork3FamilyPackageRegistration',
]) {
  if (typeof financingCovenantsAuthoring[facade] !== 'function') {
    throw new Error(`FINANCING_COVENANTS ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = financingCovenantsAuthoring.FINANCING_COVENANTS_PROFILE_COUNT;
const FLAGS = financingCovenantsAuthoring.FINANCING_COVENANTS_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';

const GOVERNED_CLAIM_IDS = Object.freeze([
  '8dcd3c98a7ac6b3ce7d13b6f0b78a1a1bd3c0fdbd6ee0dbdca1adf1f5aa1f000',
]);

const CLASSIFICATION_BUCKETS = Object.freeze([
  'OBTAIN_FINANCING',
  'ALTERNATIVE_FINANCING',
  'TARGET_COOPERATION',
  'PAYOFF',
  'NO_FINANCING_CONDITION',
  'NOTE_OFFER_OR_CONSENT',
  'COST_AND_RISK_ALLOCATION',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_PATH,
  schema_version: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'financing_covenants_authoring_phase2_authority_id',
  record_id: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_ID,
  byte_length: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_BYTES,
  sha256: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_PATH,
  schema_version: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'financing_covenants_authoring_phase4_family_profile_package_review_authority_id',
  record_id: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_ID,
  byte_length: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_BYTES,
  sha256: financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2160,
    path: `${CONTROL}/m7-v2-repair-contract-work3-financing-covenants-unapproved-inventory-review-authority.json`,
    record_id: '80c1b99fb30fbafc41602ba7ced6e1760864f09ea3d4b6d40963f790979f242c',
    record_id_field: 'work3_financing_covenants_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_FINANCING_COVENANTS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '53b82c61c928ff93819b2e0d9ac2e42d40bdb6caa33ed5d8a67380f09439c187',
  }),
  packet: Object.freeze({
    byte_length: 6978,
    path: `${CONTROL}/m7-v2-repair-financing-covenants-5-profile-inventory-review-packet-draft.json`,
    record_id: '8dd9ee8d9e55f07f60d0f46192e8ce7caec4a40863f30d2d9d5d034cc961ec60',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_FINANCING_COVENANTS_5_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: 'a7970fb43098cf5ed6a074f5cad910e3d178d047bc10f4275e9e7f5ccf13406e',
  }),
  disposition: Object.freeze({
    byte_length: 3400,
    path: `${CONTROL}/m7-v2-repair-financing-covenants-5-profile-inventory-disposition.json`,
    record_id: 'f230e645e373f9f3034376a0bf17555a0a9169ec01bc989f0aff200121655557',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_FINANCING_COVENANTS_5_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '98f047da7eb080c9aafff7511d1a7e462d493586f8a59ded27a8f86000a4a933',
  }),
  session: Object.freeze({
    byte_length: 1139,
    path: `${CONTROL}/m7-v2-repair-financing-covenants-ben-inventory-session-receipt.json`,
    record_id: 'd1d7361b89ff18c55fad173fa5dc9b50490dfc02de62a085a85e2a5cae65bce5',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_FINANCING_COVENANTS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '2d5996eaa90bd5c9c6d950675520acb3cdae1670bd37c72b41ed9f991ddeb5d6',
  }),
  benAuthority: Object.freeze({
    byte_length: 2858,
    path: `${CONTROL}/m7-v2-repair-contract-work3-financing-covenants-ben-inventory-session-successor-authority.json`,
    record_id: 'ed5d90fb1930fede032db32e36140e042ffe4f36061d6054b0b291572aa60fc9',
    record_id_field: 'work3_financing_covenants_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_FINANCING_COVENANTS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'ebde314b584e033116145acd6d9f5ab9957e95ff0e44b31d68072408356a6346',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3392,
    path: `${CONTROL}/m7-v2-repair-contract-work3-financing-covenants-family-package-seal-successor-authority.json`,
    record_id: 'df23cb6e8a7e31cd407f91e8c8ea5dd7113cdf4435172f0691d24c1f6930da24',
    record_id_field: 'work3_financing_covenants_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_FINANCING_COVENANTS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: 'd3190dc4d1f162637f1a31f38e37c6d8b08d422f445f0eb8f9acf9e51a347d7e',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2308,
    path: `${CONTROL}/m7-v2-repair-financing-covenants-family-package-seal-receipt.json`,
    record_id: '6595d655e788d4cfd87fe9d45e4c50e6dd2062c49dfa36efae6f5398f0b28b33',
    record_id_field: 'financing_covenants_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_FINANCING_COVENANTS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '1d94026a271b86811627f00ae0a4be0f7089b9bf40376ef9b6c4cfc12c6412cc',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2921,
    path: `${CONTROL}/m7-v2-repair-contract-work3-financing-covenants-registration-successor-authority.json`,
    record_id: '67ccac138beb44de365f788e4593f472f1ab5234c5482130c61bcb0d7d4293e9',
    record_id_field: 'work3_financing_covenants_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_FINANCING_COVENANTS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '4782ea179bdd004fca2c1113e17d49d154a9ea945558fc6951dc4e2abb9cef49',
  }),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-financing-covenants.json`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '6306273e18b1a7ad04176ffa02ca56f31ea7a26556f4463c7c160ad4c83a51ab',
  byte_length: 68149,
  sha256: '2e545dcb5f0c34b325b689ab951af82675d0662fbda74d2ffc80d83462942cfc',
});

const GROUPING_SUCCESSOR_BINDINGS = Object.freeze({
  package: Object.freeze({
    byte_length: 68960,
    git_blob_oid: 'e8a09d2335f6b4fb50d27d996afff21b85e61ed8',
    path:
      `${CONTROL}/m7-v2-repair-family-work3-profile-package-financing-covenants-grouping-successor-2026-09-01B.json`,
    record_id: 'ad9ebf3969654eaddb5ac8c65c5b06d6baf7a0117e9f732f9663a60006467dd1',
    record_id_field: 'family_profile_package_id',
    schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
    sha256: 'c4738c009a9a681a61097c5a564455e1be051c44907e9545b60231023725caf3',
  }),
  disposition: Object.freeze({
    byte_length: 5646,
    git_blob_oid: '92049f44cfa454a27ec9ac2d10f7fcb0f402179c',
    path:
      `${CONTROL}/m7-v2-repair-financing-covenants-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
    record_id: '218cff17205c7a3f2046cc0e5c37a38303d3b5eaafdabe6916b4980b98fe45ac',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'N1_GROUPING_INVENTORY_DISPOSITION_SUCCESSOR/V1',
    sha256: 'ab8d5cbf2fb6b17a96b769faa0bd70c81d51b0f48087e54c729f7545e86b86cb',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 4244,
    git_blob_oid: 'f78ff82cdae4b5e4039a7d0c17134af78b04cae0',
    path:
      `${CONTROL}/m7-v2-repair-contract-work3-financing-covenants-grouping-registration-successor-authority-2026-09-01B.json`,
    record_id: 'acb932208647c30746addd949cdbe097411a480e5ab7bd58ad156ad68fae6e44',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '80794b2cb9d8effefd61846cd7328c47240cb8aca411fd46a62469f2a151e98f',
  }),
  applicationReceipt: Object.freeze({
    byte_length: 8073,
    git_blob_oid: '4aab6059175c37e03e1931b7c7917b5007ec00b8',
    path:
      'docs/codex-program/notes/N1-FINANCING-COVENANTS-GROUPING-RULING-APPLICATION-RECEIPT-2026-09-01B.json',
    record_id: '1e847b61224967f00bcae4472720df32c2741c1e2723b73ab5f035b06d9b8a29',
    record_id_field: 'ruling_application_receipt_id',
    schema_version: 'N1_RULING_APPLICATION_RECEIPT/V1',
    sha256: '4a49038871051d731f6fd93ff0eabfba2f09d4265604ed5925d277bdb8940e68',
  }),
});

const NO_LINK_GROUPING_FIELDS = Object.freeze({
  approved_link_target: null,
  grouping_note: null,
  party_band: null,
});

const APPROVED_GROUPING_MAPPINGS = Object.freeze([
  Object.freeze({
    ...NO_LINK_GROUPING_FIELDS,
    approved_comparison_fields: ['final executed-payoff timing'],
    approved_comparison_lines: ['Payoff'],
    ordinal: 1,
    proposed_profile_key:
      '0a568cd9afbf5328413901be4eb0d8ac289a0cee3169c884df1a719531edd8d3',
  }),
  Object.freeze({
    ...NO_LINK_GROUPING_FIELDS,
    approved_comparison_fields: [],
    approved_comparison_lines: ['Obtain financing'],
    ordinal: 2,
    proposed_profile_key:
      '4792433a6407a52938ae3f263a556cdd8d32fd180554c6151dbdd4da00360929',
  }),
  Object.freeze({
    ...NO_LINK_GROUPING_FIELDS,
    approved_comparison_fields: [],
    approved_comparison_lines: ['Obtain financing'],
    ordinal: 3,
    proposed_profile_key:
      '49dea85615fac86ac644143dccf7862360b70668d3eeb693b5b4ea7cc57c9441',
  }),
  Object.freeze({
    ...NO_LINK_GROUPING_FIELDS,
    approved_comparison_fields: ['draft payoff timing'],
    approved_comparison_lines: ['Payoff'],
    ordinal: 4,
    proposed_profile_key:
      '4fb23deda115eecd80f8e6c7f5338bcdb5eb1446518c195f16e12946527705e4',
  }),
  Object.freeze({
    ...NO_LINK_GROUPING_FIELDS,
    approved_comparison_fields: [],
    approved_comparison_lines: ['No financing condition'],
    ordinal: 5,
    proposed_profile_key:
      'e34ecd6a67f17651e32cddceaf9c8b40def683dcf2898242d7e877de470eb343',
  }),
]);

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
  assert.equal(contentId(record.schema_version, unsigned), binding.record_id, binding.path);
  return record;
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
  const financingCovenantsAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    financingCovenantsAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      financingCovenantsAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    financingCovenantsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    financingCovenantsAuthoringPhase2Authority:
      fixture.financingCovenantsAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3FinancingCovenantsUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3FinancingCovenantsBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3FinancingCovenantsFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3FinancingCovenantsRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved FINANCING_COVENANTS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.financingCovenantsAuthoringPhase2Authority.record;
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
      [CONCHO_AGREEMENT_ID]: 2,
      [SKECHERS_AGREEMENT_ID]: 2,
      [TOPBUILD_AGREEMENT_ID]: 1,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    ['NO_FINANCING_CONDITION', 'OBTAIN_FINANCING', 'PAYOFF'],
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.required_expression_signature)).length,
    PROFILE_COUNT,
  );

  // TopBuild s7.16 stays with Guaranty under the sealed one-owner rule.
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['GUARANTY_FINANCING_PARTY'],
  );

  const result = financingCovenantsAuthoring
    .prepareFinancingCovenantsPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_FINANCING_COVENANTS_FAMILY_PROPOSAL/V1',
    family_key: 'FINANCING_COVENANTS',
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
    'FINANCING_COVENANTS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    FLAGS.LEGAL_GROUPING,
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  const conchoSignatures = result.proposed_partition.proposed_profiles
    .map((profile) => profile.canonical_tuple.required_expression_signature)
    .filter((signature) => signature.includes('CONCHO_6_17'))
    .sort();
  assert.deepEqual(conchoSignatures, [
    'FINANCING_COVENANTS::PAYOFF::CONCHO_6_17_PAYOFF_DELIVERY_LEAD_TIME_DAYS_DRAFT',
    'FINANCING_COVENANTS::PAYOFF::CONCHO_6_17_PAYOFF_DELIVERY_LEAD_TIME_DAYS_FINAL',
  ]);
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 FINANCING_COVENANTS family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = financingCovenantsAuthoring
    .prepareFinancingCovenantsPhase2FamilyProposal({
      financingCovenantsAuthoringPhase2Authority:
        fixture.financingCovenantsAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = financingCovenantsAuthoring
    .prepareFinancingCovenantsFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    financingCovenantsAuthoring.FINANCING_COVENANTS_PHASE4_REVIEW_OUTPUT_KEYS,
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
    outside_calibration_example_flag_count: 1,
    proposed_profile_count: 5,
    review_only_profile_count: 5,
    subtype_partition_divergence_flag_count: 2,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:FINANCING_COVENANTS:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 FINANCING_COVENANTS unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = financingCovenantsAuthoring
    .prepareFinancingCovenantsWork3UnapprovedInventoryReview({
      financingCovenantsWork3UnapprovedInventoryReviewEvidence: {
        work3FinancingCovenantsUnapprovedInventoryReviewAuthority:
          evidence.work3FinancingCovenantsUnapprovedInventoryReviewAuthority,
      },
      financingCovenantsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_5_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 2);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 FINANCING_COVENANTS Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = financingCovenantsAuthoring
    .prepareFinancingCovenantsWork3BenInventorySessionDisposition({
      financingCovenantsWork3BenInventorySessionDispositionEvidence: {
        work3FinancingCovenantsUnapprovedInventoryReviewAuthority:
          evidence.work3FinancingCovenantsUnapprovedInventoryReviewAuthority,
        work3FinancingCovenantsBenInventorySessionSuccessorAuthority:
          evidence.work3FinancingCovenantsBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      financingCovenantsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 5,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: 5,
    outside_calibration_example_count: 1,
    populated_subtype_bucket_count: 3,
    registered_subtype_bucket_count: 7,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count: 2,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 FINANCING_COVENANTS family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = financingCovenantsAuthoring.prepareFinancingCovenantsWork3FamilyPackageSeal({
    financingCovenantsWork3FamilyPackageSealEvidence: {
      work3FinancingCovenantsUnapprovedInventoryReviewAuthority:
        evidence.work3FinancingCovenantsUnapprovedInventoryReviewAuthority,
      work3FinancingCovenantsBenInventorySessionSuccessorAuthority:
        evidence.work3FinancingCovenantsBenInventorySessionSuccessorAuthority,
      work3FinancingCovenantsFamilyPackageSealSuccessorAuthority:
        evidence.work3FinancingCovenantsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    financingCovenantsPhase4ReviewInput: phase4Fixture(),
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
    2,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 FINANCING_COVENANTS family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = financingCovenantsAuthoring
    .prepareFinancingCovenantsWork3FamilyPackageRegistration({
      financingCovenantsWork3FamilyPackageRegistrationEvidence: evidence,
      financingCovenantsPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_FINANCING_COVENANTS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Financing covenants Milestone A inventory packet draft carries shape summaries and honest holds', () => {
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
    2,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    1,
  );
});

test('Financing covenants Milestone A disposition approves 5 profiles and reuses only sealed M5 rulings', () => {
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

test('Financing covenants Milestone A family profile package on disk validates 5 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:FINANCING_COVENANTS:PROFILE_SET_V1',
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

  const phase4 = financingCovenantsAuthoring
    .prepareFinancingCovenantsFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),
    ['NO_FINANCING_CONDITION', 'OBTAIN_FINANCING', 'OBTAIN_FINANCING', 'PAYOFF', 'PAYOFF'],
  );
});

test('FINANCING_COVENANTS 2026-09-01B grouping successor applies the exact approved mappings', () => {
  const packageRecord = exactPhysicalRecord(GROUPING_SUCCESSOR_BINDINGS.package);
  const disposition = exactPhysicalRecord(GROUPING_SUCCESSOR_BINDINGS.disposition);
  const registrationAuthority = exactPhysicalRecord(
    GROUPING_SUCCESSOR_BINDINGS.registrationAuthority,
  );
  const applicationReceipt = exactPhysicalRecord(
    GROUPING_SUCCESSOR_BINDINGS.applicationReceipt,
  );
  const predecessorDisposition = readRecord(WORK3_BINDINGS.disposition.path);
  const clearanceOrdinals = APPROVED_GROUPING_MAPPINGS.map((mapping) => mapping.ordinal);

  assert.equal(packageRecord.family_key, 'FINANCING_COVENANTS');
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.deepEqual(registrationAuthority.successor_package_binding,
    GROUPING_SUCCESSOR_BINDINGS.package);
  assert.deepEqual(registrationAuthority.successor_disposition_binding,
    GROUPING_SUCCESSOR_BINDINGS.disposition);
  assert.deepEqual(applicationReceipt.package_transition.successor,
    GROUPING_SUCCESSOR_BINDINGS.package);
  assert.deepEqual(applicationReceipt.successor_disposition_binding,
    GROUPING_SUCCESSOR_BINDINGS.disposition);
  assert.deepEqual(
    applicationReceipt.successor_authorities.find(
      (binding) => binding.path === GROUPING_SUCCESSOR_BINDINGS.registrationAuthority.path,
    ),
    GROUPING_SUCCESSOR_BINDINGS.registrationAuthority,
  );

  assert.deepEqual(disposition.profile_dispositions.map((row) => ({
    approved_comparison_fields:
      row.grouping_ruling_application.approved_comparison_fields,
    approved_comparison_lines:
      row.grouping_ruling_application.approved_comparison_lines,
    approved_link_target:
      row.grouping_ruling_application.approved_link_target,
    grouping_note: row.grouping_ruling_application.grouping_note,
    ordinal: row.ordinal,
    party_band: row.grouping_ruling_application.party_band,
    proposed_profile_key: row.proposed_profile_key,
  })), APPROVED_GROUPING_MAPPINGS);
  assert.equal(disposition.session_summary.grouping_ruling_mapped_count, PROFILE_COUNT);
  assert.equal(disposition.session_summary.legal_grouping_review_cleared_count, PROFILE_COUNT);
  assert.equal(disposition.session_summary.legal_grouping_review_held_ambiguous_count, 0);
  assert.equal(disposition.session_summary.legal_grouping_review_pending_count, 0);
  assert.deepEqual(registrationAuthority.exact_grouping_stamp_clearance_ordinals,
    clearanceOrdinals);
  assert.deepEqual(registrationAuthority.exact_held_ambiguous_ordinals, []);
  assert.deepEqual(
    registrationAuthority.exact_mapped_without_predecessor_grouping_stamp_ordinals,
    [],
  );
  assert.equal(registrationAuthority.production_activation_permitted, false);
  assert.deepEqual(registrationAuthority.zero_effect_boundary, {
    database_write_count: 0,
    product_write_count: 0,
    serving_change_count: 0,
  });
  assert.equal(applicationReceipt.grouping_stamp_clearance_count, PROFILE_COUNT);
  assert.equal(applicationReceipt.held_ambiguous_count, 0);
  assert.equal(applicationReceipt.independent_review_state, 'PENDING');
  assert.equal(applicationReceipt.row_applications.length, PROFILE_COUNT);
  assert.equal(applicationReceipt.stamp_cleared, true);

  for (const row of disposition.profile_dispositions) {
    const predecessorRow = predecessorDisposition.profile_dispositions.find(
      (candidate) => candidate.ordinal === row.ordinal
        && candidate.proposed_profile_key === row.proposed_profile_key,
    );
    assert.ok(predecessorRow, `missing predecessor row ${row.ordinal}`);
    assert.deepEqual(row.prior_review_flags_acknowledged,
      predecessorRow.review_flags_acknowledged);
    assert.deepEqual(
      row.review_flags_acknowledged,
      predecessorRow.review_flags_acknowledged.filter(
        (flag) => flag !== FLAGS.LEGAL_GROUPING,
      ),
    );
    assert.deepEqual(
      predecessorRow.review_flags_acknowledged.filter(
        (flag) => !row.review_flags_acknowledged.includes(flag),
      ),
      [FLAGS.LEGAL_GROUPING],
    );
    assert.equal(row.grouping_ruling_application.state,
      'APPLIED_PENDING_INDEPENDENT_REVIEW');
    assert.equal(row.grouping_ruling_application.family_key, 'FINANCING_COVENANTS');
    assert.equal(row.grouping_ruling_application.ruling_ordinal, 5);
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
    (entry) => entry.family_key === 'FINANCING_COVENANTS',
  );
  assert.ok(override, 'lawful Work3 fixture has no FINANCING_COVENANTS on-disk override');
  assert.deepEqual(override.binding, GROUPING_SUCCESSOR_BINDINGS.package);
});
