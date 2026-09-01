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
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

let norAuthoring;
try {
  norAuthoring = require('../lib/canonical-v2/m7-v2-no-other-reps-fraud-authoring.js');
} catch (error) {
  throw new Error('NO_OTHER_REPS_FRAUD authoring facade module is missing.');
}

for (const exportName of [
  'prepareNoOtherRepsFraudPhase2FamilyProposal',
  'prepareNoOtherRepsFraudFamilyProfilePackageReview',
  'prepareNoOtherRepsFraudWork3UnapprovedInventoryReview',
  'prepareNoOtherRepsFraudWork3BenInventorySessionDisposition',
  'prepareNoOtherRepsFraudWork3FamilyPackageSeal',
  'prepareNoOtherRepsFraudWork3FamilyPackageRegistration',
]) {
  if (typeof norAuthoring[exportName] !== 'function') {
    throw new Error(`NO_OTHER_REPS_FRAUD facade export ${exportName} is missing.`);
  }
}

const PROFILE_COUNT = norAuthoring.NO_OTHER_REPS_FRAUD_PROFILE_COUNT;
const SHARED_CITATION_COUNT =
  norAuthoring.NO_OTHER_REPS_FRAUD_SHARED_SOURCE_CITATION_PROFILE_COUNT;
const CROSS_FAMILY_COUNT =
  norAuthoring.NO_OTHER_REPS_FRAUD_CROSS_FAMILY_LINK_PROFILE_COUNT;

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  byte_length: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_BYTES,
  path: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_PATH,
  record_id: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID,
  record_id_field: 'no_other_reps_fraud_authoring_phase2_authority_id',
  schema_version: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SCHEMA,
  sha256: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  byte_length: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_BYTES,
  path: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_PATH,
  record_id: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ID,
  record_id_field:
    'no_other_reps_fraud_authoring_phase4_family_profile_package_review_authority_id',
  schema_version: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SCHEMA,
  sha256: norAuthoring.NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2030,
    path: `${CONTROL}/m7-v2-repair-contract-work3-no-other-reps-fraud-unapproved-inventory-review-authority.json`,
    record_id: '2429271c479b65d107ddc02efa4b3ddf14fafad4a87921cbb2bf9d7d155132cc',
    record_id_field: 'work3_no_other_reps_fraud_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '5efb4345043cfb422f23d1826308b8e6da958c35809ae46d3bd6452d27212329',
  }),
  packet: Object.freeze({
    byte_length: 52906,
    path: `${CONTROL}/m7-v2-repair-no-other-reps-fraud-36-profile-inventory-review-packet-draft.json`,
    record_id: '4f70e99c2d8d6f71be732f23f969f67077a8a54be64715baad19b2c792dc29f7',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_36_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '4f9c1f88ce1caa35577fe82da7de2ea68dac871f8f45b8509ffd79fe053801bf',
  }),
  disposition: Object.freeze({
    byte_length: 14249,
    path: `${CONTROL}/m7-v2-repair-no-other-reps-fraud-36-profile-inventory-disposition.json`,
    record_id: 'b4ebd739e11d2a09e835af4674e3ee2938f6b00851544454ea3c9713444f7b70',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_36_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '1f1ae30bbcdf0fa271c4378983db9a85d5c5cafd0064220ac3ae036f56930c61',
  }),
  session: Object.freeze({
    byte_length: 1142,
    path: `${CONTROL}/m7-v2-repair-no-other-reps-fraud-ben-inventory-session-receipt.json`,
    record_id: '69f00e73da1b463e0b605f9dc80581e6c1c417ecef251e2524ab2db3afef2dc5',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: 'ff9b6c383bc65b87e6651bcd065e7e75823b64a6c42cefb82739501e45bb2988',
  }),
  benAuthority: Object.freeze({
    byte_length: 2943,
    path: `${CONTROL}/m7-v2-repair-contract-work3-no-other-reps-fraud-ben-inventory-session-successor-authority.json`,
    record_id: '3d17a94abf7431b45d4aa11aa25cb58f2475c789c551727d4312fd07fbc78a73',
    record_id_field: 'work3_no_other_reps_fraud_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'c2430ff44223f3521a2cdbd97324af6446f0f279c04e348f7e43f8b1bcd17ff6',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3473,
    path: `${CONTROL}/m7-v2-repair-contract-work3-no-other-reps-fraud-family-package-seal-successor-authority.json`,
    record_id: 'c3f2eb38f56da216c44a65efe5f0ce2591dc4a22e4fc34ba99b7ecc2086b82f0',
    record_id_field: 'work3_no_other_reps_fraud_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '5076f9cb58191f2b6a37f72e1b873ee74d395a9709ca7c12a1c00a3274c87a15',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2224,
    path: `${CONTROL}/m7-v2-repair-no-other-reps-fraud-family-package-seal-receipt.json`,
    record_id: 'b20fe5bf6a1ad2d43a21b97547de21a720efd0d14acb4b5bc04b4cbf4bdd43c0',
    record_id_field: 'no_other_reps_fraud_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '44475eb645a18fc7a7eef2996bb79c3625a571f5a0b149b3211fa532cc0c76b1',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 3046,
    path: `${CONTROL}/m7-v2-repair-contract-work3-no-other-reps-fraud-registration-successor-authority.json`,
    record_id: 'f8bd2cb7ce4a4b7aed28717c32196326c2c6d92511474b7b6c95dd17c7e2ce5e',
    record_id_field: 'work3_no_other_reps_fraud_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'b7da7cbd6d53815b95ca0c389ca360b5310542140f463104bd62b5595d2c7923',
  }),
});

const BEN_RULINGS_BINDING = Object.freeze({
  byte_length: 7536,
  path: 'docs/codex-program/notes/NO-OTHER-REPS-FRAUD-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: '39237140365a260269a71802562e479e9ff756f15d80d9b6af26ed5df0366820',
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  byte_length: 469420,
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json`,
  record_id: '83c2270974509a24d5164aa01d5b1338573c8b6a03f377e707358158d906527a',
  record_id_field: 'family_profile_package_id',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  sha256: '790ee05431882593d8738e65b756c7bd80f86761becb039e2efd284208328845',
});

const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;
const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const REGISTERED_SUBTYPE_BUCKETS = Object.freeze([
  'NO_OTHER_REPRESENTATIONS_DISCLAIMER',
  'NON_RELIANCE_ACKNOWLEDGMENT',
  'FRAUD_CARVEOUT',
  'INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT',
]);

const CLAIM_DEFINITION_KEYS = Object.freeze([
  'EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT',
  'NON_RELIANCE_ACKNOWLEDGMENT_PRESENT',
  'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
]);

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

function assertExactKeys(value, expected, label) {
  assert.equal(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && canonicalJson(Object.keys(value)) === canonicalJson(expected),
    true,
    label,
  );
}

function governedSources(authorityRecord) {
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
  const noOtherRepsFraudAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    noOtherRepsFraudAuthoringPhase2Authority,
    governedSources: governedSources(noOtherRepsFraudAuthoringPhase2Authority.record),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    noOtherRepsFraudAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    noOtherRepsFraudAuthoringPhase2Authority:
      fixture.noOtherRepsFraudAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3NoOtherRepsFraudRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic claim-scale NO_OTHER_REPS_FRAUD partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.noOtherRepsFraudAuthoringPhase2Authority.record;
  const successor = authority.source_terminal_successor_contract;
  const terminals = successor.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 7);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );
  assert.deepEqual(
    sortedUnique(successor.classification_path_registry.map(
      (entry) => entry.classification_bucket,
    )),
    [...REGISTERED_SUBTYPE_BUCKETS].sort(),
  );
  for (const terminal of terminals) {
    assert.equal(terminal.m4_claim_ids.length, 1, terminal.source_unit_key);
    assert.equal(
      terminal.classification_bucket,
      'NO_OTHER_REPRESENTATIONS_DISCLAIMER',
      terminal.source_unit_key,
    );
    assert.equal(
      terminal.unresolved_items.includes('LEGAL_GROUPING_REVIEW_REQUIRED'),
      true,
      terminal.source_unit_key,
    );
    assert.equal(
      CLAIM_DEFINITION_KEYS.includes(
        terminal.source_closure.members[0].claim_definition_key,
      ),
      true,
      terminal.source_unit_key,
    );
  }

  const result = norAuthoring.prepareNoOtherRepsFraudPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    norAuthoring.NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.equal(result.family_key, 'NO_OTHER_REPS_FRAUD');
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.zero_m4_claim_gaps, true);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.deepEqual(result.authority_binding, PHASE2_AUTHORITY_BINDING);
  assert.equal(result.derived_profile_count, PROFILE_COUNT);
  assert.equal(result.proposed_partition.proposed_profiles.length, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.expected_count, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.accounted_count, PROFILE_COUNT);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(result.unresolved_items.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
  assert.equal(Object.isFrozen(result), true);

  const signatures = result.proposed_partition.proposed_profiles.map(
    (profile) => profile.canonical_tuple.required_expression_signature,
  );
  assert.equal(sortedUnique(signatures).length, PROFILE_COUNT);
});

test('Phase2 link censuses are derived from evidence and never duplicate REPRESENTATIONS content', () => {
  const authority = readRecord(PHASE2_AUTHORITY_BINDING.path);
  const overlay = authority.policy_overlay;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(
    overlay.within_family_link_census.shared_source_citation_terminal_count,
    SHARED_CITATION_COUNT,
  );
  assert.equal(
    overlay.cross_family_link_census.shared_printed_section_terminal_count,
    CROSS_FAMILY_COUNT,
  );
  assert.equal(overlay.cross_family_link_census.shared_m2_source_node_count, 0);
  assert.equal(overlay.cross_family_link_census.linked_family_key, 'REPRESENTATIONS');
  assert.equal(
    overlay.cross_family_link_census.state,
    'LINK_ONLY_NO_DUPLICATED_CONTENT',
  );

  const withinFamily = terminals.filter((terminal) => terminal.linked_rule_bindings.some(
    (link) => link.link_kind === 'WITHIN_FAMILY_SHARED_SOURCE_CITATION',
  ));
  const crossFamily = terminals.filter((terminal) => terminal.linked_rule_bindings.some(
    (link) => link.link_kind === 'CROSS_FAMILY_REPRESENTATIONS_SHARED_SECTION',
  ));
  assert.equal(withinFamily.length, SHARED_CITATION_COUNT);
  assert.equal(crossFamily.length, CROSS_FAMILY_COUNT);

  const representations = readRecord(
    overlay.cross_family_link_census.linked_family_authority_binding.path,
  );
  const representationsSourceUnitKeys = new Set(
    representations.source_terminal_successor_contract.terminal_rule_registry.map(
      (terminal) => terminal.source_unit_key,
    ),
  );
  for (const terminal of terminals) {
    assert.equal(representationsSourceUnitKeys.has(terminal.source_unit_key), false);
    for (const link of terminal.linked_rule_bindings) {
      assert.equal(link.owner_family_key, 'NO_OTHER_REPS_FRAUD');
      assert.equal(link.linked_source_unit_keys.length > 0, true);
      if (link.link_kind === 'CROSS_FAMILY_REPRESENTATIONS_SHARED_SECTION') {
        assert.equal(link.disposition, 'LINK_ONLY_DO_NOT_DUPLICATE');
        for (const key of link.linked_source_unit_keys) {
          assert.equal(representationsSourceUnitKeys.has(key), true);
        }
      }
    }
  }
});

test('Phase4 NO_OTHER_REPS_FRAUD family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = readRecord(PHASE4_AUTHORITY_BINDING.path);
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);
  assert.equal(authority.implementation_contract.phase3_internal_function, null);
  assert.equal(
    authority.profile_review_schedule_contract.review_flag_derivation,
    'PHASE2_TERMINAL_LINKED_RULE_BINDINGS_LINK_KIND_MAPPED_ONE_TO_ONE_NO_NEW_ASSIGNMENT',
  );

  const result = norAuthoring.prepareNoOtherRepsFraudFamilyProfilePackageReview(
    phase4Fixture(),
  );

  assertExactKeys(
    result,
    norAuthoring.NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_36_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: PROFILE_COUNT,
    cross_family_representations_link_flag_count: CROSS_FAMILY_COUNT,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    shared_source_citation_link_flag_count: SHARED_CITATION_COUNT,
    work3_identity_count: 0,
  });
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(profile, PHASE4_PROFILE_KEYS, `${profile.proposed_profile_key} keys`);
    assert.equal(profile.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(
      profile.package_profile_key.startsWith(
        'PROFILE:NO_OTHER_REPS_FRAUD:NO_OTHER_REPRESENTATIONS_DISCLAIMER:',
      ),
      true,
    );
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }

  assert.equal(
    result.proposed_profiles.filter(
      (profile) => profile.review_flags.includes('SHARED_SOURCE_CITATION_LINK_ONLY'),
    ).length,
    SHARED_CITATION_COUNT,
  );
  assert.equal(
    result.proposed_profiles.filter(
      (profile) => profile.review_flags.includes('CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY'),
    ).length,
    CROSS_FAMILY_COUNT,
  );
});

test('Work3 NO_OTHER_REPS_FRAUD unapproved inventory review passes the validator without Work3 identity', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = norAuthoring.prepareNoOtherRepsFraudWork3UnapprovedInventoryReview({
    noOtherRepsFraudWork3UnapprovedInventoryReviewEvidence: {
      work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
        evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
    },
    noOtherRepsFraudPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_36_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.inventory_packet_reference.retained_source_gap_count, 0);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 NO_OTHER_REPS_FRAUD Ben inventory disposition approves 36 rows with the grouping hold acknowledged', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = norAuthoring.prepareNoOtherRepsFraudWork3BenInventorySessionDisposition({
    noOtherRepsFraudWork3BenInventorySessionDispositionEvidence: {
      work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
        evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
      work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority:
        evidence.work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    noOtherRepsFraudPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    shared_source_citation_link_only_count: SHARED_CITATION_COUNT,
    cross_family_representations_link_only_count: CROSS_FAMILY_COUNT,
    populated_subtype_bucket_count: 1,
    registered_subtype_bucket_count: REGISTERED_SUBTYPE_BUCKETS.length,
    taxonomy_expansion_acknowledged: true,
  });
  assert.deepEqual(result.ben_rulings_binding, BEN_RULINGS_BINDING);
  assert.equal(result.session_receipt_reference.completion_state, 'COMPLETE');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 NO_OTHER_REPS_FRAUD family package seal holds the subtype partition without registering', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = norAuthoring.prepareNoOtherRepsFraudWork3FamilyPackageSeal({
    noOtherRepsFraudWork3FamilyPackageSealEvidence: {
      work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
        evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
      work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority:
        evidence.work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority,
      work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority:
        evidence.work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    noOtherRepsFraudPhase4ReviewInput: phase4Fixture(),
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
  assert.equal(result.legal_grouping_disposition_binding.populated_subtype_bucket_count, 1);
  assert.equal(
    result.legal_grouping_disposition_binding.registered_subtype_bucket_count,
    REGISTERED_SUBTYPE_BUCKETS.length,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 NO_OTHER_REPS_FRAUD family package registration binds the seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = norAuthoring.prepareNoOtherRepsFraudWork3FamilyPackageRegistration({
    noOtherRepsFraudWork3FamilyPackageRegistrationEvidence: evidence,
    noOtherRepsFraudPhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'BEN_NO_OTHER_REPS_FRAUD_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.equal(result.registered_profile_identities.length, PROFILE_COUNT);
  assert.equal(result.family_profile_package_identity.profile_id_count, PROFILE_COUNT);
  assert.equal(
    result.family_profile_package_identity.legal_grouping_disposition_state,
    'PENDING_LEGAL_REVIEW',
  );
  assert.equal(result.review_accounting.work3_identity_count, PROFILE_COUNT + 1);
  assert.equal(
    result.registered_profile_identities.filter(
      (profile) => profile.inventory_disposition === 'APPROVE',
    ).length,
    PROFILE_COUNT,
  );
  assert.equal(
    result.registered_profile_identities.every(
      (profile) => profile.legal_grouping_pending_acknowledged === true,
    ),
    true,
  );
  assert.equal(
    sortedUnique(
      result.registered_profile_identities.map((profile) => profile.profile_id),
    ).length,
    PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

test('NO_OTHER_REPS_FRAUD inventory packet carries per-row shape summaries and no invented holds', () => {
  physicalBytes(WORK3_BINDINGS.packet);
  const packet = readRecord(WORK3_BINDINGS.packet.path);

  assert.equal(packet.family_key, 'NO_OTHER_REPS_FRAUD');
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.profile_review_items.length, PROFILE_COUNT);
  assert.equal(packet.honest_hold_summary.hold_row_count, 0);
  assert.deepEqual(packet.honest_hold_summary.hold_review_flags, []);
  assert.deepEqual(packet.honest_hold_summary.acknowledged_review_flags, [
    'CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
    'SHARED_SOURCE_CITATION_LINK_ONLY',
  ]);
  assert.equal(
    packet.honest_hold_summary.legal_grouping_review_pending_count,
    PROFILE_COUNT,
  );
  assert.equal(
    packet.honest_hold_summary.shared_source_citation_link_only_count,
    SHARED_CITATION_COUNT,
  );
  assert.equal(
    packet.honest_hold_summary.cross_family_representations_link_only_count,
    CROSS_FAMILY_COUNT,
  );
  assert.deepEqual(
    packet.honest_hold_summary.registered_subtype_buckets,
    [...REGISTERED_SUBTYPE_BUCKETS].sort(),
  );
  assert.deepEqual(packet.honest_hold_summary.populated_subtype_buckets, [
    'NO_OTHER_REPRESENTATIONS_DISCLAIMER',
  ]);
  assert.equal(packet.honest_hold_summary.unpopulated_subtype_buckets.length, 3);
  assert.deepEqual(packet.subtype_bucket_counts, {
    NO_OTHER_REPRESENTATIONS_DISCLAIMER: PROFILE_COUNT,
  });
  assert.deepEqual(
    Object.keys(packet.claim_definition_counts).sort(),
    [...CLAIM_DEFINITION_KEYS].sort(),
  );
  assert.equal(
    Object.values(packet.claim_definition_counts).reduce((sum, count) => sum + count, 0),
    PROFILE_COUNT,
  );
  assert.equal(
    Object.values(packet.deal_counts).reduce((sum, count) => sum + count, 0),
    PROFILE_COUNT,
  );
  assert.equal(Object.keys(packet.deal_counts).length, 7);

  for (const item of packet.profile_review_items) {
    assert.equal(item.shape_summary.subtype_bucket, 'NO_OTHER_REPRESENTATIONS_DISCLAIMER');
    assert.equal(item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(item.review_completion_state, 'COMPLETE');
    assert.equal(typeof item.deal, 'string');
    assert.equal(item.proposed_technical_disposition, 'APPROVE');
    assert.equal(
      CLAIM_DEFINITION_KEYS.includes(item.shape_summary.claim_definition_key),
      true,
    );
  }
});

test('NO_OTHER_REPS_FRAUD Ben disposition approves every row and acknowledges the grouping hold', () => {
  physicalBytes(WORK3_BINDINGS.disposition);
  const disposition = readRecord(WORK3_BINDINGS.disposition.path);

  assert.equal(disposition.reviewer, 'BEN_GOODCHILD');
  assert.equal(disposition.ben_rulings_digest, BEN_RULINGS_BINDING.sha256);
  assert.equal(disposition.packet_digest, WORK3_BINDINGS.packet.sha256);
  assert.equal(disposition.session_summary.approved_count, PROFILE_COUNT);
  assert.equal(disposition.session_summary.hold_count, 0);
  assert.equal(disposition.session_summary.reject_count, 0);
  assert.equal(disposition.profile_dispositions.length, PROFILE_COUNT);

  for (const row of disposition.profile_dispositions) {
    assert.equal(row.disposition, 'APPROVE');
    assert.equal(row.legal_grouping_pending_acknowledged, true);
    assert.deepEqual(row.hold_reason_flags, []);
  }
});

test('NO_OTHER_REPS_FRAUD Ben rulings note reuses the sealed M5 programme rulings', () => {
  physicalBytes(BEN_RULINGS_BINDING);
  const note = readFileSync(join(REPO_ROOT, BEN_RULINGS_BINDING.path), 'utf8');
  const sealed = readRecord(`${CONTROL}/m5-programme-rulings.json`);
  assert.equal(note.includes(sealed.ruling_record_id), true);
  for (const ruling of sealed.rulings) {
    assert.equal(note.includes(ruling.ruling_id), true);
  }
});

test('NO_OTHER_REPS_FRAUD Milestone A family package on disk validates 36 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.family_key, 'NO_OTHER_REPS_FRAUD');
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:NO_OTHER_REPS_FRAUD:PROFILE_SET_V1',
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

  const phase4 = norAuthoring.prepareNoOtherRepsFraudFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
});

test('lawful Work3 fixture NO_OTHER_REPS_FRAUD on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'NO_OTHER_REPS_FRAUD',
  );
  assert.ok(override, 'lawful Work3 fixture has no NO_OTHER_REPS_FRAUD on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
