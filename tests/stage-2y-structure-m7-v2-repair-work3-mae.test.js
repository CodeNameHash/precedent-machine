'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateSingleFamilyPackageInventory,
} = require('../lib/canonical-v2/m7-v2-contract');
const maeDefinitionAuthoring = require('../lib/canonical-v2/m7-v2-mae-definition-authoring');

const REPO_ROOT = join(__dirname, '..');
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const REDHAT_SOURCE_UNIT_KEY =
  'ed638ab1aa10ee6515e40634e3d100a8af7ef3b61634e4b056e82c1351c65a23';
const REDHAT_DEFINITION_SIGNATURE =
  'MAE_DEFINITION_INSTANCE::REDHAT_8_03_COMPLETE_PROVISION';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const METSERA_SOURCE_UNIT_KEY =
  '925c1346368703386eec065a0a77f4d36b0fef48fa4adac0423fa6bb8ac84162';
const METSERA_CARVEOUT_CODE = 'CHANGE_IN_GAAP';
const METSERA_EXCLUSION_SIGNATURE = `MAE_CARVEOUT::${METSERA_CARVEOUT_CODE}`;
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKECHERS_SOURCE_UNIT_KEY =
  '133cb7b50fa9d7ee58168408a92aca8092738bdd45d45fba3f4a58d85ab4ce75';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';
const SKYWATER_SOURCE_UNIT_KEY =
  '20bcbb1f2d662a2ca9fb09229579e32c0b26c971516e923dd3eda5366eefbb87';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';
const TOPBUILD_SOURCE_UNIT_KEY =
  'a257b4d1202cb775af7513904e59d29d3fca2fa4b34026b44b5c89814eeecbbf';
const TOPBUILD_PARENT_SOURCE_UNIT_KEY =
  '813850b486fa32dfc99177707068473466e8c04cc2ff7389f028edcdb81e7c2a';
const ITEM33_DISPROPORTIONALITY_SIGNATURE =
  'CONSEQUENCE_MODIFIER(TO_EXTENT(EXCEPTION_TO(BASE_EXCLUSION,DISPROPORTIONATE_EFFECT),INCREMENTAL_DISPROPORTIONATE_SCOPE),INCREMENTAL_EFFECT_MAY_BE_TAKEN_INTO_ACCOUNT)';
const ITEM47_PARTIAL_EXCEPTION_SIGNATURE =
  'CONSEQUENCE_MODIFIER(TO_EXTENT(EXCEPTION_TO(BASE_RULE,PARTIAL_EXCEPTION),EXACT_EXCEPTION_SCOPE),LIMITED_CONSEQUENCE)';
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const {
  MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING,
  MAE_DEFINITION_PHASE2_PROPOSAL_CODES,
  MAE_DEFINITION_PHASE2_PROPOSAL_KEYS,
  MAE_DEFINITION_PHASE4_AUTHORITY_BYTES,
  MAE_DEFINITION_PHASE4_AUTHORITY_ID,
  MAE_DEFINITION_PHASE4_AUTHORITY_PATH,
  MAE_DEFINITION_PHASE4_AUTHORITY_SCHEMA,
  MAE_DEFINITION_PHASE4_AUTHORITY_SHA256,
  MAE_DEFINITION_PHASE4_REVIEW_CODES,
  MAE_DEFINITION_PHASE4_REVIEW_OUTPUT_KEYS,
  MAE_DEFINITION_PHASE4_SCHEDULE_SHA256,
  prepareMaeDefinitionFamilyProfilePackageReview,
  prepareMaeDefinitionFamilyProposal,
  prepareMaeDefinitionWork3BenInventorySessionDisposition,
  prepareMaeDefinitionWork3FamilyPackageRegistration,
  prepareMaeDefinitionWork3FamilyPackageSeal,
  prepareMaeDefinitionWork3StageBBlueprintProposal,
  prepareMaeDefinitionWork3UnapprovedInventoryReview,
} = maeDefinitionAuthoring;

const MAE_DEFINITION_PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: MAE_DEFINITION_PHASE4_AUTHORITY_PATH,
  schema_version: MAE_DEFINITION_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'mae_definition_authoring_phase4_family_profile_package_review_authority_id',
  record_id: MAE_DEFINITION_PHASE4_AUTHORITY_ID,
  byte_length: MAE_DEFINITION_PHASE4_AUTHORITY_BYTES,
  sha256: MAE_DEFINITION_PHASE4_AUTHORITY_SHA256,
});

const MAE_PHASE4_OUTPUT_KEYS = [...MAE_DEFINITION_PHASE4_REVIEW_OUTPUT_KEYS];
const MAE_PHASE4_PROFILE_KEYS = Object.freeze([
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
const MAE_PHASE4_VALIDATION_KEYS = Object.freeze([
  'extraction_state',
  'issue_codes',
  'no_comparison_authority',
  'output_disposition',
  'source_quality',
]);
const MAE_PHASE4_WITHHELD_WORK3_FIELDS = Object.freeze([
  'work3_profile_id',
  'work3_package_id',
  'work3_registration_id',
  'work3_activation_id',
  'work3_fixture_fact_id',
]);

function readRecord(relativePath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'));
}

function sourceEnvelope(binding) {
  return {
    binding: structuredClone(binding),
    record: readRecord(binding.path),
  };
}

function physicalBytes(binding) {
  const bytes = readFileSync(join(REPO_ROOT, binding.path));
  assert.equal(bytes.length, binding.byte_length);
  assert.equal(sha256Hex(bytes), binding.sha256);
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

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function proposalUnsignedRecord(proposal) {
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  return unsigned;
}

function maeDefinitionPhase2AuthorityEnvelope() {
  physicalBytes(MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING);
  return sourceEnvelope(MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING);
}

function maeDefinitionPhase2GovernedSources(authorityRecord) {
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
    c3CorrectionAuthority: sourceEnvelope(parents.c3),
    work3Manifest: sourceEnvelope(parents.work3_manifest),
    familyRolePolicy: sourceEnvelope(parents.family_role_policy),
    calibrationPack: sourceEnvelope(parents.calibration_pack),
    agreementEvidenceByAgreementId,
  };
}

function maeDefinitionPhase2ProposalFixture() {
  const maeDefinitionAuthoringPhase2Authority = maeDefinitionPhase2AuthorityEnvelope();
  return {
    maeDefinitionAuthoringPhase2Authority,
    governedSources: maeDefinitionPhase2GovernedSources(
      maeDefinitionAuthoringPhase2Authority.record,
    ),
  };
}

function maeDefinitionPhase4ProposalFixture() {
  const phase2Fixture = maeDefinitionPhase2ProposalFixture();
  return {
    maeDefinitionAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(MAE_DEFINITION_PHASE4_AUTHORITY_BINDING),
    maeDefinitionAuthoringPhase2Authority:
      phase2Fixture.maeDefinitionAuthoringPhase2Authority,
    governedSources: phase2Fixture.governedSources,
  };
}

function expectCode(code, fn) {
  assert.throws(fn, (error) => error.code === code, `Expected ${code}`);
}

test('MAE_DEFINITION family-local facade exports are present', () => {
  assert.equal(typeof prepareMaeDefinitionFamilyProposal, 'function');
  assert.equal(typeof prepareMaeDefinitionFamilyProfilePackageReview, 'function');
  assert.equal(typeof prepareMaeDefinitionWork3StageBBlueprintProposal, 'function');
  assert.equal(typeof maeDefinitionAuthoring.maeDefinitionProposalPartition, 'function');
});

test('Phase2 proposal derives deterministic partition for six calibration terminals', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const authority = fixture.maeDefinitionAuthoringPhase2Authority.record;
  const result = prepareMaeDefinitionFamilyProposal(fixture);

  assert.equal(isDeepFrozen(result), true);
  assertExactKeys(result, MAE_DEFINITION_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_MAE_DEFINITION_FAMILY_PROPOSAL/V1',
    family_key: 'MAE_DEFINITION',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    zero_m4_claim_gaps: true,
  });
  assert.deepEqual(result.authority_binding, {
    path: MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING.path,
    schema_version: MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING.schema_version,
    record_id_field: MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING.record_id_field,
    record_id: MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING.record_id,
    byte_length: MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING.byte_length,
    sha256: MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING.sha256,
  });
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.equal(
    result.proposal_id,
    contentId(result.schema_version, proposalUnsignedRecord(result)),
  );

  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;
  assert.equal(terminals.length, 6);
  const redhatTerminal = terminals.find(
    (terminal) => terminal.agreement_id === REDHAT_AGREEMENT_ID,
  );
  const metseraTerminal = terminals.find(
    (terminal) => terminal.agreement_id === METSERA_AGREEMENT_ID,
  );
  const skechersTerminal = terminals.find(
    (terminal) => terminal.agreement_id === SKECHERS_AGREEMENT_ID,
  );
  const skywaterTerminal = terminals.find(
    (terminal) => terminal.agreement_id === SKYWATER_AGREEMENT_ID,
  );
  const topbuildTerminal = terminals.find(
    (terminal) => terminal.source_unit_key === TOPBUILD_SOURCE_UNIT_KEY,
  );
  const topbuildParentTerminal = terminals.find(
    (terminal) => terminal.source_unit_key === TOPBUILD_PARENT_SOURCE_UNIT_KEY,
  );
  assert.equal(redhatTerminal.classification_bucket, 'DEFINITION_INSTANCE');
  assert.equal(redhatTerminal.source_unit_key, REDHAT_SOURCE_UNIT_KEY);
  assert.equal(metseraTerminal.classification_bucket, 'EXCLUSION');
  assert.equal(metseraTerminal.source_unit_key, METSERA_SOURCE_UNIT_KEY);
  assert.equal(metseraTerminal.mae_carveout_code, METSERA_CARVEOUT_CODE);
  assert.equal(skechersTerminal.classification_bucket, 'DISPROPORTIONALITY_CARVEBACK');
  assert.equal(skechersTerminal.source_unit_key, SKECHERS_SOURCE_UNIT_KEY);
  assert.equal(skechersTerminal.required_expression_signature, ITEM33_DISPROPORTIONALITY_SIGNATURE);
  assert.equal(skywaterTerminal.classification_bucket, 'DISPROPORTIONALITY_CARVEBACK');
  assert.equal(skywaterTerminal.source_unit_key, SKYWATER_SOURCE_UNIT_KEY);
  assert.equal(skywaterTerminal.required_expression_signature, ITEM33_DISPROPORTIONALITY_SIGNATURE);
  assert.equal(topbuildTerminal.classification_bucket, 'DISPROPORTIONALITY_CARVEBACK');
  assert.equal(topbuildTerminal.source_unit_key, TOPBUILD_SOURCE_UNIT_KEY);
  assert.equal(topbuildTerminal.required_expression_signature, ITEM33_DISPROPORTIONALITY_SIGNATURE);
  assert.equal(topbuildParentTerminal.classification_bucket, 'UNDERLYING_CAUSE_RESTORATION');
  assert.equal(topbuildParentTerminal.source_unit_key, TOPBUILD_PARENT_SOURCE_UNIT_KEY);
  assert.equal(
    topbuildParentTerminal.required_expression_signature,
    ITEM47_PARTIAL_EXCEPTION_SIGNATURE,
  );
  assert.deepEqual(topbuildParentTerminal.work1_item_ordinals, [47]);
  assert.equal(
    topbuildParentTerminal.signature_binding_kind,
    'FIFTH_SLICE_WORK1_ITEM_47_PARTIAL_EXCEPTION_TOPOLOGY',
  );

  const expectedClaimIds = sortedUnique(terminals.flatMap(
    (terminal) => terminal.m4_claim_ids,
  ));
  assert.equal(expectedClaimIds.length, 108);
  assert.deepEqual(result.m4_claim_accounting.expected_claim_ids, expectedClaimIds);
  assert.equal(result.derived_profile_count, 4);
  assert.equal(result.proposed_partition.proposed_profiles.length, 4);

  const redhatProfile = result.proposed_partition.proposed_profiles.find(
    (profile) => profile.source_unit_keys.includes(REDHAT_SOURCE_UNIT_KEY),
  );
  assert.deepEqual(redhatProfile.canonical_tuple, {
    classification_path: ['MAE_DEFINITION', 'DEFINITION_INSTANCE'],
    required_expression_signature: REDHAT_DEFINITION_SIGNATURE,
  });
  assert.equal(
    redhatProfile.proposed_profile_key,
    sha256Hex(canonicalJson(redhatProfile.canonical_tuple)),
  );
  assert.deepEqual(redhatProfile.source_unit_keys, [REDHAT_SOURCE_UNIT_KEY]);
  assert.deepEqual(
    redhatProfile.m4_claim_ids,
    sortedUnique(redhatTerminal.m4_claim_ids),
  );
  assert.deepEqual(redhatProfile.authorised_component_ids, []);

  const metseraProfile = result.proposed_partition.proposed_profiles.find(
    (profile) => profile.source_unit_keys.includes(METSERA_SOURCE_UNIT_KEY),
  );
  assert.deepEqual(metseraProfile.canonical_tuple, {
    classification_path: ['MAE_DEFINITION', 'EXCLUSION'],
    required_expression_signature: METSERA_EXCLUSION_SIGNATURE,
    mae_carveout_code: METSERA_CARVEOUT_CODE,
  });
  assert.equal(
    metseraProfile.proposed_profile_key,
    sha256Hex(canonicalJson(metseraProfile.canonical_tuple)),
  );
  assert.deepEqual(metseraProfile.source_unit_keys, [METSERA_SOURCE_UNIT_KEY]);
  assert.deepEqual(
    metseraProfile.m4_claim_ids,
    sortedUnique(metseraTerminal.m4_claim_ids),
  );
  assert.deepEqual(metseraProfile.authorised_component_ids, []);

  const convergenceProfile = result.proposed_partition.proposed_profiles.find(
    (profile) => profile.source_unit_keys.includes(SKECHERS_SOURCE_UNIT_KEY),
  );
  assert.deepEqual(convergenceProfile.canonical_tuple, {
    classification_path: ['MAE_DEFINITION', 'DISPROPORTIONALITY_CARVEBACK'],
    required_expression_signature: ITEM33_DISPROPORTIONALITY_SIGNATURE,
  });
  assert.deepEqual(
    sortedUnique(convergenceProfile.source_unit_keys),
    sortedUnique([
      SKECHERS_SOURCE_UNIT_KEY,
      SKYWATER_SOURCE_UNIT_KEY,
      TOPBUILD_SOURCE_UNIT_KEY,
    ]),
  );
  assert.deepEqual(
    sortedUnique(convergenceProfile.m4_claim_ids),
    sortedUnique([
      ...skechersTerminal.m4_claim_ids,
      ...skywaterTerminal.m4_claim_ids,
      ...topbuildTerminal.m4_claim_ids,
    ]),
  );
  assert.equal(convergenceProfile.m4_claim_ids.length, 59);
  assert.equal(result.proposed_partition.m4_claim_assignment_count, 108);
  assert.equal(result.proposed_partition.source_unit_assignment_count, 6);
  assert.ok(result.unresolved_items.includes(
    'FIFTH_SLICE_TOPBUILD_PARENT_MAE_WORK1_ITEM_47_PARTIAL_EXCEPTION_TOPOLOGY',
  ));

  const item47Profile = result.proposed_partition.proposed_profiles.find(
    (profile) => profile.source_unit_keys.includes(TOPBUILD_PARENT_SOURCE_UNIT_KEY),
  );
  assert.deepEqual(item47Profile.canonical_tuple, {
    classification_path: ['MAE_DEFINITION', 'UNDERLYING_CAUSE_RESTORATION'],
    required_expression_signature: ITEM47_PARTIAL_EXCEPTION_SIGNATURE,
  });
  assert.deepEqual(item47Profile.source_unit_keys, [TOPBUILD_PARENT_SOURCE_UNIT_KEY]);
  assert.deepEqual(
    item47Profile.m4_claim_ids,
    sortedUnique(topbuildParentTerminal.m4_claim_ids),
  );
  assert.equal(item47Profile.m4_claim_ids.length, 19);
});

test('Phase2 partition adds mae_carveout_code for EXCLUSION terminals only', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const authority = fixture.maeDefinitionAuthoringPhase2Authority.record;
  const metseraTerminal = authority.source_terminal_successor_contract.terminal_rule_registry.find(
    (terminal) => terminal.agreement_id === METSERA_AGREEMENT_ID,
  );
  const tuple = maeDefinitionAuthoring.maeDefinitionProposalPartitionCanonicalTuple(
    metseraTerminal,
  );
  assert.deepEqual(tuple, {
    classification_path: ['MAE_DEFINITION', 'EXCLUSION'],
    required_expression_signature: METSERA_EXCLUSION_SIGNATURE,
    mae_carveout_code: METSERA_CARVEOUT_CODE,
  });
  assert.equal(
    maeDefinitionAuthoring.maeDefinitionTerminalCarveoutCode(metseraTerminal),
    METSERA_CARVEOUT_CODE,
  );
});

test('Phase2 partition keeps Work1 item-33 signature on Skechers DISPROPORTIONALITY_CARVEBACK', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const authority = fixture.maeDefinitionAuthoringPhase2Authority.record;
  const skechersTerminal = authority.source_terminal_successor_contract.terminal_rule_registry.find(
    (terminal) => terminal.agreement_id === SKECHERS_AGREEMENT_ID,
  );
  const tuple = maeDefinitionAuthoring.maeDefinitionProposalPartitionCanonicalTuple(
    skechersTerminal,
  );
  assert.deepEqual(tuple, {
    classification_path: ['MAE_DEFINITION', 'DISPROPORTIONALITY_CARVEBACK'],
    required_expression_signature: ITEM33_DISPROPORTIONALITY_SIGNATURE,
  });
  assert.equal(
    maeDefinitionAuthoring.maeDefinitionTerminalCarveoutCode(skechersTerminal),
    null,
  );
});

test('Phase2 partition binds Work1 items 34-36 on skywater and topbuild convergence terminals', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const authority = fixture.maeDefinitionAuthoringPhase2Authority.record;
  const skywaterTerminal = authority.source_terminal_successor_contract.terminal_rule_registry.find(
    (terminal) => terminal.agreement_id === SKYWATER_AGREEMENT_ID,
  );
  const topbuildTerminal = authority.source_terminal_successor_contract.terminal_rule_registry.find(
    (terminal) => terminal.source_unit_key === TOPBUILD_SOURCE_UNIT_KEY,
  );
  assert.deepEqual(skywaterTerminal.work1_item_ordinals, [34]);
  assert.deepEqual(topbuildTerminal.work1_item_ordinals, [35, 36]);
  assert.equal(skywaterTerminal.work1_convergence_group, 'mae-partial-exception-topology-v1');
  assert.equal(topbuildTerminal.work1_convergence_group, 'mae-partial-exception-topology-v1');
  assert.equal(
    skywaterTerminal.signature_binding_kind,
    'FOURTH_SLICE_WORK1_ITEM_34_PARTIAL_EXCEPTION_TOPOLOGY',
  );
  assert.equal(
    topbuildTerminal.signature_binding_kind,
    'FOURTH_SLICE_WORK1_ITEMS_35_36_PARTIAL_EXCEPTION_TOPOLOGY',
  );
  const skywaterTuple = maeDefinitionAuthoring.maeDefinitionProposalPartitionCanonicalTuple(
    skywaterTerminal,
  );
  const topbuildTuple = maeDefinitionAuthoring.maeDefinitionProposalPartitionCanonicalTuple(
    topbuildTerminal,
  );
  assert.deepEqual(skywaterTuple, {
    classification_path: ['MAE_DEFINITION', 'DISPROPORTIONALITY_CARVEBACK'],
    required_expression_signature: ITEM33_DISPROPORTIONALITY_SIGNATURE,
  });
  assert.deepEqual(topbuildTuple, skywaterTuple);
});

test('Phase2 convergence merges items 33-36 into one DISPROPORTIONALITY_CARVEBACK profile', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const result = prepareMaeDefinitionFamilyProposal(fixture);
  const disproportionalityProfiles = result.proposed_partition.proposed_profiles.filter(
    (profile) => profile.canonical_tuple.classification_path[1] === 'DISPROPORTIONALITY_CARVEBACK',
  );
  assert.equal(disproportionalityProfiles.length, 1);
  assert.equal(disproportionalityProfiles[0].source_unit_keys.length, 3);
  assert.equal(disproportionalityProfiles[0].m4_claim_ids.length, 59);
});

test('Phase2 partition binds Work1 item-47 on topbuild parent MAE terminal', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const authority = fixture.maeDefinitionAuthoringPhase2Authority.record;
  const topbuildParentTerminal = authority.source_terminal_successor_contract.terminal_rule_registry.find(
    (terminal) => terminal.source_unit_key === TOPBUILD_PARENT_SOURCE_UNIT_KEY,
  );
  const tuple = maeDefinitionAuthoring.maeDefinitionProposalPartitionCanonicalTuple(
    topbuildParentTerminal,
  );
  assert.deepEqual(tuple, {
    classification_path: ['MAE_DEFINITION', 'UNDERLYING_CAUSE_RESTORATION'],
    required_expression_signature: ITEM47_PARTIAL_EXCEPTION_SIGNATURE,
  });
  assert.equal(
    maeDefinitionAuthoring.maeDefinitionTerminalCarveoutCode(topbuildParentTerminal),
    null,
  );
});

test('Phase2 item-47 profile stays distinct from item-33 convergence profile', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const result = prepareMaeDefinitionFamilyProposal(fixture);
  const disproportionalityProfiles = result.proposed_partition.proposed_profiles.filter(
    (profile) => profile.canonical_tuple.classification_path[1] === 'DISPROPORTIONALITY_CARVEBACK',
  );
  const item47Profiles = result.proposed_partition.proposed_profiles.filter(
    (profile) => profile.canonical_tuple.classification_path[1] === 'UNDERLYING_CAUSE_RESTORATION',
  );
  assert.equal(disproportionalityProfiles.length, 1);
  assert.equal(item47Profiles.length, 1);
  assert.notDeepEqual(
    disproportionalityProfiles[0].canonical_tuple,
    item47Profiles[0].canonical_tuple,
  );
});

test('Phase2 proposal rejects missing governed sources', () => {
  const fixture = maeDefinitionPhase2ProposalFixture();
  const missing = { ...fixture };
  delete missing.governedSources;
  expectCode(
    MAE_DEFINITION_PHASE2_PROPOSAL_CODES.CONTRACT,
    () => prepareMaeDefinitionFamilyProposal(missing),
  );
});

test('Work3 Stage B blueprint facade remains unimplemented on first slice', () => {
  expectCode(
    MAE_DEFINITION_PHASE2_PROPOSAL_CODES.CONTRACT,
    () => prepareMaeDefinitionWork3StageBBlueprintProposal(),
  );
});

test('Phase4 MAE_DEFINITION family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(MAE_DEFINITION_PHASE4_AUTHORITY_BINDING);
  const authorityEnvelope = sourceEnvelope(MAE_DEFINITION_PHASE4_AUTHORITY_BINDING);
  const authority = authorityEnvelope.record;
  assertExactKeys(authority, [
    'authority_classification',
    'authority_state',
    'candidate_output_contract',
    'design_basis',
    'execution_schedule',
    'first_legal_stop_contract',
    'forbidden_output_contract',
    'immutable_parent_bindings',
    'implementation_contract',
    'mae_definition_authoring_phase4_family_profile_package_review_authority_id',
    'profile_review_schedule',
    'profile_review_schedule_contract',
    'schema_version',
    'zero_effect_boundary',
  ], 'Phase4 authority keys');
  const unsignedAuthority = structuredClone(authority);
  delete unsignedAuthority
    .mae_definition_authoring_phase4_family_profile_package_review_authority_id;
  assert.equal(
    contentId(authority.schema_version, unsignedAuthority),
    MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.record_id,
  );
  assert.deepEqual(
    authority.immutable_parent_bindings.mae_definition_authoring_phase2_authority,
    MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING,
  );
  assert.equal(authority.profile_review_schedule.length, 4);
  assert.equal(
    authority.profile_review_schedule_contract.exact_profile_count,
    4,
  );
  assert.equal(
    authority.profile_review_schedule_contract.schedule_canonical_json_sha256,
    MAE_DEFINITION_PHASE4_SCHEDULE_SHA256,
  );
  assert.equal(
    authority.design_basis.phase3_reference_materialisation_skipped,
    true,
  );

  const fixture = maeDefinitionPhase4ProposalFixture();
  const phase2Proposal = prepareMaeDefinitionFamilyProposal({
    maeDefinitionAuthoringPhase2Authority:
      fixture.maeDefinitionAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  });
  const result = prepareMaeDefinitionFamilyProfilePackageReview(fixture);
  const outputContract = authority.candidate_output_contract;

  assert.equal(isDeepFrozen(result), true);
  assertExactKeys(result, MAE_PHASE4_OUTPUT_KEYS, 'Phase4 package review candidate keys');
  assert.equal(result.schema_version, outputContract.schema_version);
  assert.equal(result.family_key, 'MAE_DEFINITION');
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_4_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  const unsignedResult = structuredClone(result);
  delete unsignedResult.review_candidate_id;
  assert.equal(
    result.review_candidate_id,
    contentId(result.schema_version, unsignedResult),
  );
  assert.deepEqual(result.authority_binding, {
    path: MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.path,
    schema_version: MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.schema_version,
    record_id_field: MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.record_id_field,
    record_id: MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.record_id,
    byte_length: MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.byte_length,
    sha256: MAE_DEFINITION_PHASE4_AUTHORITY_BINDING.sha256,
  });
  assert.deepEqual(result.phase2_proposal_reference, {
    schema_version: phase2Proposal.schema_version,
    proposal_id: phase2Proposal.proposal_id,
    source_unit_count: 6,
    claim_count: 108,
    derived_profile_count: 4,
  });
  assert.equal(result.proposed_profiles.length, 4);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: 4,
    incomplete_profile_count: 0,
    mae_self_containment_review_flag_count: 4,
    mae_subject_term_review_flag_count: 1,
    proposed_profile_count: 4,
    review_only_profile_count: 4,
    work3_identity_count: 0,
  });
  assert.deepEqual(result.withheld_work3_fields, MAE_PHASE4_WITHHELD_WORK3_FIELDS);
  assert.equal(result.first_legal_stop.work3_approval_payload_present, false);
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);
  assert.ok(result.unresolved_items.includes(
    'MAE_DEFINITION_Q01_Q02_Q03_RECORDED_AWAITING_INVENTORY_SESSION',
  ));

  const scheduleByKey = new Map(
    authority.profile_review_schedule.map((item) => [
      item.proposed_profile_key,
      item,
    ]),
  );
  for (const profile of result.proposed_profiles) {
    assertExactKeys(profile, MAE_PHASE4_PROFILE_KEYS, `${profile.proposed_profile_key} profile keys`);
    assertExactKeys(
      profile.proposed_validation,
      MAE_PHASE4_VALIDATION_KEYS,
      `${profile.proposed_profile_key} validation keys`,
    );
    const schedule = scheduleByKey.get(profile.proposed_profile_key);
    assert(schedule, profile.proposed_profile_key);
    assert.deepEqual(profile.proposed_validation, schedule.proposed_validation);
    assert.deepEqual(profile.review_flags, schedule.review_flags);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:MAE_DEFINITION:'), true);
    if (profile.canonical_tuple.classification_path[1] === 'EXCLUSION') {
      assert.deepEqual(profile.review_flags, [
        'MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN',
        'MAE_DEFINITION_SUBJECT_TERM_MISMATCH',
      ]);
    } else {
      assert.deepEqual(
        profile.review_flags,
        ['MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN'],
      );
    }
    assert.deepEqual(profile.missing_required_field_keys, []);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
    assert.equal(Object.hasOwn(profile, 'reference_value_reviews'), false);
  }

  const metseraProfile = result.proposed_profiles.find(
    (profile) => profile.source_unit_keys.includes(METSERA_SOURCE_UNIT_KEY),
  );
  assert.deepEqual(metseraProfile.review_flags, [
    'MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN',
    'MAE_DEFINITION_SUBJECT_TERM_MISMATCH',
  ]);

  const phase2ProfileKeys = phase2Proposal.proposed_partition.proposed_profiles
    .map((profile) => profile.proposed_profile_key)
    .sort();
  const resultProfileKeys = result.proposed_profiles
    .map((profile) => profile.proposed_profile_key)
    .sort();
  assert.deepEqual(resultProfileKeys, phase2ProfileKeys);
});

test('Phase4 package review rejects missing Phase4 authority input', () => {
  const fixture = maeDefinitionPhase4ProposalFixture();
  const missing = { ...fixture };
  delete missing.maeDefinitionAuthoringPhase4FamilyProfilePackageReviewAuthority;
  expectCode(
    MAE_DEFINITION_PHASE4_REVIEW_CODES.CONTRACT,
    () => prepareMaeDefinitionFamilyProfilePackageReview(missing),
  );
});

const MAE_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-mae-definition-unapproved-inventory-review-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  record_id_field: 'work3_mae_definition_unapproved_inventory_review_authority_id',
  record_id: '915027773c6eac81a9ca64690d7f7dd428b58492c6e46a15698a4b551e38a32b',
  byte_length: 1976,
  sha256: '9427646de422472e30c90f0df53e52c796403bd0d6f46c2ea983acdbeb650895',
});

const MAE_WORK3_PACKET_DRAFT_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-mae-4-profile-inventory-review-packet-draft.json',
  schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_4_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  record_id_field: 'inventory_review_packet_id',
  record_id: '274d6c098ce2a1333f22cbabc6a31bebfd92df705aaec44b82125559150ed66b',
  byte_length: 11787,
  sha256: '96ca4e4f55b215ba029e7bca318107c93d1b966ce61249606f6d0da8344ee9b3',
});

const MAE_WORK3_BEN_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-mae-definition-ben-inventory-session-successor-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  record_id_field: 'work3_mae_definition_ben_inventory_session_successor_authority_id',
  record_id: '1e0bb5e146347af9996d7f6c9383251963d23d8fa6b4cf65cfc1956827ee8fed',
  byte_length: 2717,
  sha256: '10dc754c8582b6bbd71dcec7af18f7cb28f56f6a2552f65350a0702b1d742f33',
});

const MAE_WORK3_DISPOSITION_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-mae-4-profile-inventory-disposition.json',
  schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_4_PROFILE_INVENTORY_DISPOSITION/V1',
  record_id_field: 'inventory_disposition_id',
  record_id: '4e2dbc7cf9ce998d06064e8b5f514f2b35afd2d56d3c09d6e902befa375ae6ef',
  byte_length: 1940,
  sha256: 'd5fe4b54e5dcb506ef459cd3aeb082e81bf50c1e18d212b7b2af20757e0d2e04',
});

const MAE_WORK3_SESSION_RECEIPT_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-mae-ben-inventory-session-receipt.json',
  schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_BEN_INVENTORY_SESSION_RECEIPT/V1',
  record_id_field: 'ben_inventory_session_receipt_id',
  record_id: 'a3d4e4ffe4b89c2e2dc1af0d868353fb860ebd45eac93e7e0523eefc1112bc7c',
  byte_length: 1097,
  sha256: 'c9acf50338fbe24cded59f485e59ab983f2392976c01807aea643e93f79377fb',
});

const MAE_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-mae-definition-family-package-seal-successor-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  record_id_field: 'work3_mae_definition_family_package_seal_successor_authority_id',
  record_id: 'e9917cb720f2333c8e4669742038492f2c52a69d0e5c95d51eef9e2f258b8a53',
  byte_length: 3219,
  sha256: '3e85694cf56ab11c92ba9873936b6fa2846994326f42c36777d22a3a2fd5d392',
});

const MAE_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-mae-definition-family-package-seal-receipt.json',
  schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  record_id_field: 'mae_definition_family_package_seal_receipt_id',
  record_id: '4bf42cc155853f29a8ab08d04abc9ab584da3f243e45d9f120316510af2360bd',
  byte_length: 2066,
  sha256: 'cd1c356c808a970d684c6fd4781fdf1abee1b56337ac0a91a21b33ba43739e8e',
});

const MAE_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-mae-definition-registration-successor-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  record_id_field: 'work3_mae_definition_registration_successor_authority_id',
  record_id: 'b548686c716f848432b2cdef24d711dbec0fb65cacedb26a9d39caf9098e82fb',
  byte_length: 2831,
  sha256: 'daf7b5d3d9d040fd16d0d09dda4fc47c7c199e867b65e06f39cf5c213e635c58',
});

const MAE_WORK3_FAMILY_PACKAGE_SEAL_ID =
  '28b252b3e60125cf4a098dec3321f52df854a1261c81355f38122933f9dd21a9';

function maeWork3MilestoneAFixture() {
  const phase4Fixture = maeDefinitionPhase4ProposalFixture();
  return {
    phase4Fixture,
    benInventoryAuthority: sourceEnvelope(MAE_WORK3_BEN_INVENTORY_AUTHORITY_BINDING),
    disposition: sourceEnvelope(MAE_WORK3_DISPOSITION_BINDING),
    sessionReceipt: sourceEnvelope(MAE_WORK3_SESSION_RECEIPT_BINDING),
    sealAuthority: sourceEnvelope(MAE_WORK3_SEAL_AUTHORITY_BINDING),
    sealReceipt: sourceEnvelope(MAE_WORK3_SEAL_RECEIPT_BINDING),
    registrationAuthority: sourceEnvelope(MAE_WORK3_REGISTRATION_AUTHORITY_BINDING),
    packetDraft: sourceEnvelope(MAE_WORK3_PACKET_DRAFT_BINDING),
  };
}

test('MAE Milestone A inventory packet draft has shape_summary and review_flags for 4 profiles', () => {
  physicalBytes(MAE_WORK3_PACKET_DRAFT_BINDING);
  const packet = readRecord(MAE_WORK3_PACKET_DRAFT_BINDING.path);
  assert.equal(packet.profile_count, 4);
  assert.equal(packet.complete_profile_count, 4);
  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary, 'object');
    assert.ok(Array.isArray(item.review_flags));
    assert.ok(item.review_flags.includes('MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN'));
    assert.equal(item.review_completion_state, 'COMPLETE');
  }
  const metsera = packet.profile_review_items.find((item) => item.deal === 'metsera');
  assert.deepEqual(metsera.review_flags, [
    'MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN',
    'MAE_DEFINITION_SUBJECT_TERM_MISMATCH',
  ]);
});

test('MAE Milestone A ben inventory disposition approves all 4 profiles with review_flags acknowledged', () => {
  physicalBytes(MAE_WORK3_DISPOSITION_BINDING);
  const disposition = readRecord(MAE_WORK3_DISPOSITION_BINDING.path);
  assert.equal(disposition.session_summary.approved_count, 4);
  assert.equal(disposition.session_summary.hold_count, 0);
  assert.equal(disposition.session_summary.self_containment_unproven_acknowledged, true);
  assert.equal(disposition.session_summary.subject_term_mismatch_acknowledged, true);
  for (const row of disposition.profile_dispositions) {
    assert.equal(row.disposition, 'APPROVE');
    assert.ok(row.review_flags_acknowledged.length > 0);
  }
});

test('Work3 MAE_DEFINITION family package seal captures Ben seal without Work3 identity or premature registration', () => {
  const fixture = maeWork3MilestoneAFixture();
  const input = {
    maeDefinitionWork3FamilyPackageSealEvidence: {
      work3MaeDefinitionBenInventorySessionSuccessorAuthority:
        fixture.benInventoryAuthority,
      work3MaeDefinitionFamilyPackageSealSuccessorAuthority: fixture.sealAuthority,
      inventoryReviewPacketDraft: fixture.packetDraft,
      benAuthoredInventoryDisposition: fixture.disposition,
      benInventorySessionReceipt: fixture.sessionReceipt,
    },
    maeDefinitionPhase4ReviewInput: fixture.phase4Fixture,
  };
  const result = prepareMaeDefinitionWork3FamilyPackageSeal(input);
  assert.equal(isDeepFrozen(result), true);
  assert.equal(result.family_package_seal_id, MAE_WORK3_FAMILY_PACKAGE_SEAL_ID);
  assert.equal(
    result.candidate_state,
    'BEN_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_CAPTURED_REGISTRATION_NOT_RECORDED',
  );
  assert.equal(result.review_accounting.profile_disposition_count, 4);
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.registration_permitted, false);
  assert.equal(result.review_stamps_binding.self_containment_status, 'UNPROVEN_ACKNOWLEDGED');
  assert.equal(
    result.review_stamps_binding.subject_term_mismatch_status,
    'FLAGGED_ACKNOWLEDGED',
  );
});

test('Work3 MAE_DEFINITION family package registration emits in-memory identities when seal permits', () => {
  const fixture = maeWork3MilestoneAFixture();
  const input = {
    maeDefinitionWork3FamilyPackageRegistrationEvidence: {
      work3MaeDefinitionBenInventorySessionSuccessorAuthority:
        fixture.benInventoryAuthority,
      work3MaeDefinitionFamilyPackageSealSuccessorAuthority: fixture.sealAuthority,
      work3MaeDefinitionRegistrationSuccessorAuthority: fixture.registrationAuthority,
      inventoryReviewPacketDraft: fixture.packetDraft,
      benAuthoredInventoryDisposition: fixture.disposition,
      benInventorySessionReceipt: fixture.sessionReceipt,
      familyPackageSealReceipt: fixture.sealReceipt,
    },
    maeDefinitionPhase4ReviewInput: fixture.phase4Fixture,
  };
  const result = prepareMaeDefinitionWork3FamilyPackageRegistration(input);
  assert.equal(isDeepFrozen(result), true);
  assert.equal(
    result.candidate_state,
    'BEN_MAE_DEFINITION_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.equal(result.registered_profile_identities.length, 4);
  assert.equal(result.review_accounting.work3_identity_count, 5);
  assert.equal(result.review_accounting.profile_identity_count, 4);
  assert.equal(result.review_accounting.package_registration_count, 1);
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(result.zero_effect_boundary.product_write_count, 0);
  for (const row of result.registered_profile_identities) {
    assert.equal(row.disposition, 'APPROVE');
    assert.ok(row.review_flags_acknowledged.includes(
      'MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN',
    ));
  }
});

const MAE_WORK3_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path:
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-mae-definition.json',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '397b293c632d87d6fe91d0d2bb6f32eb916dc8f35775e693957ef3f431be0d8e',
  byte_length: 54673,
  sha256: 'ad1490989320e4175f3f11130abab6b4c64d6a2f25ed830d31b648effa7545f7',
});

const MAE_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';

test('MAE Milestone A family profile package on disk validates four registered profiles', () => {
  physicalBytes(MAE_WORK3_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(MAE_WORK3_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, 4);
  assert.equal(packageRecord.subtype_tree.completeness_state, 'TREE_OUTPUT_INCOMPLETE');
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:MAE_DEFINITION:PROFILE_SET_V1',
  );

  const work3Authority = readRecord(MAE_WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
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
    family_key: 'MAE_DEFINITION',
    profile_set_version: 1,
    ben_approval_id: 'BEN_APPROVAL:MAE_DEFINITION:PROFILE_SET_V1',
    member_inventory: memberInventory,
    inventory_fingerprint: packageRecord.family_approval.approved_inventory_digest,
  });

  const registration = prepareMaeDefinitionWork3FamilyPackageRegistration({
    maeDefinitionWork3FamilyPackageRegistrationEvidence: {
      work3MaeDefinitionBenInventorySessionSuccessorAuthority:
        sourceEnvelope(MAE_WORK3_BEN_INVENTORY_AUTHORITY_BINDING),
      work3MaeDefinitionFamilyPackageSealSuccessorAuthority:
        sourceEnvelope(MAE_WORK3_SEAL_AUTHORITY_BINDING),
      work3MaeDefinitionRegistrationSuccessorAuthority:
        sourceEnvelope(MAE_WORK3_REGISTRATION_AUTHORITY_BINDING),
      inventoryReviewPacketDraft: sourceEnvelope(MAE_WORK3_PACKET_DRAFT_BINDING),
      benAuthoredInventoryDisposition: sourceEnvelope(MAE_WORK3_DISPOSITION_BINDING),
      benInventorySessionReceipt: sourceEnvelope(MAE_WORK3_SESSION_RECEIPT_BINDING),
      familyPackageSealReceipt: sourceEnvelope(MAE_WORK3_SEAL_RECEIPT_BINDING),
    },
    maeDefinitionPhase4ReviewInput: maeDefinitionPhase4ProposalFixture(),
  });
  const packageKeys = packageRecord.profiles.map((profile) => profile.profile_key).sort();
  const registeredKeys = registration.registered_profile_identities
    .map((row) => row.package_profile_key)
    .sort();
  assert.deepEqual(packageKeys, registeredKeys);
});
