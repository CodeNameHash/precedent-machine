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

let employeeMattersAuthoring;
try {
  employeeMattersAuthoring = require('../lib/canonical-v2/m7-v2-employee-matters-authoring.js');
} catch (error) {
  throw new Error('EMPLOYEE_MATTERS Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareEmployeeMattersPhase2FamilyProposal',
  'prepareEmployeeMattersFamilyProfilePackageReview',
  'prepareEmployeeMattersWork3UnapprovedInventoryReview',
  'prepareEmployeeMattersWork3BenInventorySessionDisposition',
  'prepareEmployeeMattersWork3FamilyPackageSeal',
  'prepareEmployeeMattersWork3FamilyPackageRegistration',
]) {
  if (typeof employeeMattersAuthoring[facade] !== 'function') {
    throw new Error(`EMPLOYEE_MATTERS ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = employeeMattersAuthoring.EMPLOYEE_MATTERS_PROFILE_COUNT;
const FLAGS = employeeMattersAuthoring.EMPLOYEE_MATTERS_REVIEW_FLAGS;
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
  'EMPLOYEE_COMPENSATION',
  'SERVICE_CREDIT',
  'WELFARE_RELIEF',
  'RETIREMENT_PLAN_ACTION',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE2_AUTHORITY_PATH,
  schema_version: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'employee_matters_authoring_phase2_authority_id',
  record_id: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE2_AUTHORITY_ID,
  byte_length: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE2_AUTHORITY_BYTES,
  sha256: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE4_AUTHORITY_PATH,
  schema_version: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'employee_matters_authoring_phase4_family_profile_package_review_authority_id',
  record_id: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE4_AUTHORITY_ID,
  byte_length: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE4_AUTHORITY_BYTES,
  sha256: employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  "inventoryAuthority": {
    "byte_length": 2128,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-employee-matters-unapproved-inventory-review-authority.json",
    "record_id": "df1cba112824446575d4e12c37c18086015e26a2d66c2837a980b2481281a0cc",
    "record_id_field": "work3_employee_matters_unapproved_inventory_review_authority_id",
    "schema_version": "STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_EMPLOYEE_MATTERS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1",
    "sha256": "76a2991fc4de531fa535eb0d01d8c0a55090eb6577b840bc284a738ea7f1c5b7"
  },
  "packet": {
    "byte_length": 32349,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-employee-matters-27-profile-inventory-review-packet-draft.json",
    "record_id": "d6834b0b98ff498d0b2424b833e2b7a8a445f2598c15e9835080ce275de238c3",
    "record_id_field": "inventory_review_packet_id",
    "schema_version": "STAGE_2Y_M7_V2_EMPLOYEE_MATTERS_27_PROFILE_INVENTORY_REVIEW_PACKET/V1",
    "sha256": "f8b9be6c1755bf833fceb79b6968ce2f3e9bf65229e4e20e9c8abe19311d9160"
  },
  "disposition": {
    "byte_length": 11553,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-employee-matters-27-profile-inventory-disposition.json",
    "record_id": "da88331925766f3ed80b4ce404c4cea68ed843c85db046ed353fe4e6b8a5e7c7",
    "record_id_field": "inventory_disposition_id",
    "schema_version": "STAGE_2Y_M7_V2_EMPLOYEE_MATTERS_27_PROFILE_INVENTORY_DISPOSITION/V1",
    "sha256": "ce6a66f19bc8f0b7c46dcd41a5f37ce05b6b58cfbd183f804dec6f253ee4f5f0"
  },
  "session": {
    "byte_length": 1130,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-employee-matters-ben-inventory-session-receipt.json",
    "record_id": "958788ca97eb6c59651763a21b04551f9785bb6e113608d6343ee271884f2fe2",
    "record_id_field": "ben_inventory_session_receipt_id",
    "schema_version": "STAGE_2Y_M7_V2_EMPLOYEE_MATTERS_BEN_INVENTORY_SESSION_RECEIPT/V1",
    "sha256": "ce01f9d8611ff4364d9e353893e1c6f3e46e99f9d4b76dbb1d8b8b1c2f2d7630"
  },
  "benAuthority": {
    "byte_length": 2823,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-employee-matters-ben-inventory-session-successor-authority.json",
    "record_id": "38ae07dc822fce30b48c021c65cb11a79c7db7adf9eaf792d6d4df7b1ce896e3",
    "record_id_field": "work3_employee_matters_ben_inventory_session_successor_authority_id",
    "schema_version": "STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_EMPLOYEE_MATTERS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1",
    "sha256": "0e98a46b51f6d0470af9258c7e0e278ddb62288eb4074506d0c48ef9b66edc4d"
  },
  "sealAuthority": {
    "byte_length": 3343,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-employee-matters-family-package-seal-successor-authority.json",
    "record_id": "286350c7b7e659c1040d2fc77ab38b682f7571048d5ab806bcded050d03e71ae",
    "record_id_field": "work3_employee_matters_family_package_seal_successor_authority_id",
    "schema_version": "STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_EMPLOYEE_MATTERS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1",
    "sha256": "c5ab96b6be4b993f9d5ae8b3aa86e051f66ef9f8bfde298b49ebcdfd0dc8c05c"
  },
  "sealReceipt": {
    "byte_length": 2292,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-employee-matters-family-package-seal-receipt.json",
    "record_id": "ecf3c231eac42649fcd0c9749d406c08110a61260325b83d9c8e6de733333a3e",
    "record_id_field": "employee_matters_family_package_seal_receipt_id",
    "schema_version": "STAGE_2Y_M7_V2_EMPLOYEE_MATTERS_FAMILY_PACKAGE_SEAL_RECEIPT/V1",
    "sha256": "b8a8f943f7c8fa36804725f13cd0d7f8a3c45e6797684ed1b71e9dfbb2657813"
  },
  "registrationAuthority": {
    "byte_length": 2872,
    "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-employee-matters-registration-successor-authority.json",
    "record_id": "9c951e7c68f836a455c1e077f2a83d013438c49295f23006fbf511406b1727cf",
    "record_id_field": "work3_employee_matters_registration_successor_authority_id",
    "schema_version": "STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_EMPLOYEE_MATTERS_REGISTRATION_SUCCESSOR_AUTHORITY/V1",
    "sha256": "1865acbdd9959b873331101ae1483db4846551ee3994017ad4da1f1489558b3e"
  }
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-employee-matters.json",
  "schema_version": "STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2",
  "record_id_field": "family_profile_package_id",
  "record_id": "0a03846c919dc6a7ebac871edf36a2ef8fd3ffc5241263a98034f6fd39758114",
  "byte_length": 340824,
  "sha256": "248f302a8fa9c354f8de2fef7529b378404e99cb52a0b46af23e9d97e78c857e"
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
  const employeeMattersAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    employeeMattersAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      employeeMattersAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    employeeMattersAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    employeeMattersAuthoringPhase2Authority:
      fixture.employeeMattersAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3EmployeeMattersUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3EmployeeMattersBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3EmployeeMattersFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3EmployeeMattersRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved EMPLOYEE_MATTERS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.employeeMattersAuthoringPhase2Authority.record;
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
      [CONCHO_AGREEMENT_ID]: 6,
      [METSERA_AGREEMENT_ID]: 5,
      [REDHAT_AGREEMENT_ID]: 3,
      [SKECHERS_AGREEMENT_ID]: 5,
      [SKYWATER_AGREEMENT_ID]: 4,
      [TOPBUILD_AGREEMENT_ID]: 4,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'EMPLOYEE_COMPENSATION',
      'SERVICE_CREDIT',
      'WELFARE_RELIEF',
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
    ['REPRESENTATIONS'],
  );

  const result = employeeMattersAuthoring
    .prepareEmployeeMattersPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_EMPLOYEE_MATTERS_FAMILY_PROPOSAL/V1',
    family_key: 'EMPLOYEE_MATTERS',
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
    'EMPLOYEE_MATTERS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 EMPLOYEE_MATTERS family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = employeeMattersAuthoring
    .prepareEmployeeMattersPhase2FamilyProposal({
      employeeMattersAuthoringPhase2Authority:
        fixture.employeeMattersAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = employeeMattersAuthoring
    .prepareEmployeeMattersFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    employeeMattersAuthoring.EMPLOYEE_MATTERS_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_27_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
      employeeMattersAuthoring.EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      employeeMattersAuthoring.EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:EMPLOYEE_MATTERS:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 EMPLOYEE_MATTERS unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = employeeMattersAuthoring
    .prepareEmployeeMattersWork3UnapprovedInventoryReview({
      employeeMattersWork3UnapprovedInventoryReviewEvidence: {
        work3EmployeeMattersUnapprovedInventoryReviewAuthority:
          evidence.work3EmployeeMattersUnapprovedInventoryReviewAuthority,
      },
      employeeMattersPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_27_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 16);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 EMPLOYEE_MATTERS Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = employeeMattersAuthoring
    .prepareEmployeeMattersWork3BenInventorySessionDisposition({
      employeeMattersWork3BenInventorySessionDispositionEvidence: {
        work3EmployeeMattersUnapprovedInventoryReviewAuthority:
          evidence.work3EmployeeMattersUnapprovedInventoryReviewAuthority,
        work3EmployeeMattersBenInventorySessionSuccessorAuthority:
          evidence.work3EmployeeMattersBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      employeeMattersPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      employeeMattersAuthoring.EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      employeeMattersAuthoring.EMPLOYEE_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      employeeMattersAuthoring.EMPLOYEE_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      employeeMattersAuthoring.EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 EMPLOYEE_MATTERS family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = employeeMattersAuthoring.prepareEmployeeMattersWork3FamilyPackageSeal({
    employeeMattersWork3FamilyPackageSealEvidence: {
      work3EmployeeMattersUnapprovedInventoryReviewAuthority:
        evidence.work3EmployeeMattersUnapprovedInventoryReviewAuthority,
      work3EmployeeMattersBenInventorySessionSuccessorAuthority:
        evidence.work3EmployeeMattersBenInventorySessionSuccessorAuthority,
      work3EmployeeMattersFamilyPackageSealSuccessorAuthority:
        evidence.work3EmployeeMattersFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    employeeMattersPhase4ReviewInput: phase4Fixture(),
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
    employeeMattersAuthoring.EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 EMPLOYEE_MATTERS family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = employeeMattersAuthoring
    .prepareEmployeeMattersWork3FamilyPackageRegistration({
      employeeMattersWork3FamilyPackageRegistrationEvidence: evidence,
      employeeMattersPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_EMPLOYEE_MATTERS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Employee Matters Milestone A inventory packet draft carries shape summaries and honest holds', () => {
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
    employeeMattersAuthoring.EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    employeeMattersAuthoring.EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
});

test('Employee Matters Milestone A disposition approves 27 profiles and reuses only sealed M5 rulings', () => {
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

test('Employee Matters Milestone A family profile package on disk validates 27 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:EMPLOYEE_MATTERS:PROFILE_SET_V1',
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

  const phase4 = employeeMattersAuthoring
    .prepareEmployeeMattersFamilyProfilePackageReview(phase4Fixture());
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

test('lawful Work3 fixture EMPLOYEE_MATTERS on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'EMPLOYEE_MATTERS',
  );
  assert.ok(override, 'lawful Work3 fixture has no EMPLOYEE_MATTERS on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
