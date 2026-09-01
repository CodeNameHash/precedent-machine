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

let tfAuthoring;
try {
  tfAuthoring = require('../lib/canonical-v2/m7-v2-termination-fee-authoring.js');
} catch (error) {
  throw new Error('TERMINATION_FEE authoring facade module is missing.');
}

for (const exportName of [
  'prepareTerminationFeePhase2FamilyProposal',
  'prepareTerminationFeeFamilyProfilePackageReview',
  'prepareTerminationFeeWork3UnapprovedInventoryReview',
  'prepareTerminationFeeWork3BenInventorySessionDisposition',
  'prepareTerminationFeeWork3FamilyPackageSeal',
  'prepareTerminationFeeWork3FamilyPackageRegistration',
]) {
  if (typeof tfAuthoring[exportName] !== 'function') {
    throw new Error(`TERMINATION_FEE facade export ${exportName} is missing.`);
  }
}

const PROFILE_COUNT = tfAuthoring.TERMINATION_FEE_PROFILE_COUNT;
const APPROVE_COUNT = tfAuthoring.TERMINATION_FEE_WORK3_APPROVE_COUNT;
const HOLD_COUNT = tfAuthoring.TERMINATION_FEE_WORK3_HOLD_COUNT;
const HOLD_REVIEW_FLAGS = tfAuthoring.TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS;

const TERMINATION_FEE_PHASE2_AUTHORITY_BINDING = Object.freeze({
  byte_length: tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_BYTES,
  path: tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_PATH,
  record_id: tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_ID,
  record_id_field: 'termination_fee_authoring_phase2_authority_id',
  schema_version: tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA,
  sha256: tfAuthoring.TERMINATION_FEE_PHASE2_AUTHORITY_SHA256,
});

const TERMINATION_FEE_PHASE4_AUTHORITY_BINDING = Object.freeze({
  byte_length: tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_BYTES,
  path: tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_PATH,
  record_id: tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_ID,
  record_id_field:
    'termination_fee_authoring_phase4_family_profile_package_review_authority_id',
  schema_version: tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_SCHEMA,
  sha256: tfAuthoring.TERMINATION_FEE_PHASE4_AUTHORITY_SHA256,
});

const TERMINATION_FEE_WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 1990,
    path: `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-unapproved-inventory-review-authority.json`,
    record_id: '9fe2de9350a622a7ef338b6fc76872579835f03ac915b8a0da6bf6fe0b1d3bf1',
    record_id_field: 'work3_termination_fee_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '421f1dc92e5c45c529878a180bd4582a51095603840d6720927c43fbc71b4428',
  }),
  packet: Object.freeze({
    byte_length: 28015,
    path: `${CONTROL}/m7-v2-repair-termination-fee-20-profile-inventory-review-packet-draft.json`,
    record_id: '8c51a6cc3bfdcc1f2f7415350b5ed081ffa883273f1e4a27f982f9445a644157',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_20_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '63ec37f494447320193bc6bb60366a65ba9e360bede5751113d19d6188520e7c',
  }),
  disposition: Object.freeze({
    byte_length: 8293,
    path: `${CONTROL}/m7-v2-repair-termination-fee-20-profile-inventory-disposition.json`,
    record_id: '4ddda88e01d79526a4e32d53fed6313b5079178bfcd70f4f0543e9f471b4ab37',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_20_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '99316ade43bc84003004092a94ce62e7abf5fbde07d9ab8ec6832f3f51a5a70e',
  }),
  session: Object.freeze({
    byte_length: 1126,
    path: `${CONTROL}/m7-v2-repair-termination-fee-ben-inventory-session-receipt.json`,
    record_id: 'de12ab0a73d257a608b84bfe2feef36c22c624ab99d1f601c2a2cefdd4d9849a',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '3197970e3976d51cf02d90d90246aff116ef860174278a2c425ab5a5aad52087',
  }),
  benAuthority: Object.freeze({
    byte_length: 2759,
    path: `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-ben-inventory-session-successor-authority.json`,
    record_id: '0bc108ee89d43a7b57f86cbfa664606ff652c62f44de921c64429da7cd2a929c',
    record_id_field: 'work3_termination_fee_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '73b3bfd8113bb879c2193490d3217cd00069b2d436416ed48ae81ccab4d7d339',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3308,
    path: `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-family-package-seal-successor-authority.json`,
    record_id: '77d6da32f222daac9914689e43e8709282bf58667af60266c1eab053b6a07149',
    record_id_field: 'work3_termination_fee_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '07fc5191aa706e31dff23dd5f14940d40d74adf6e442f3968b9892f9fe1e990f',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2141,
    path: `${CONTROL}/m7-v2-repair-termination-fee-family-package-seal-receipt.json`,
    record_id: '003ce2ce3c72c6f0e712134a2ab30af3a2fc2b214fa9564b138565b2dd42d42b',
    record_id_field: 'termination_fee_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '2fa63a85a39640354c8637886a1c86c1aac083d1c9f8eb56de1f5ae830ae5119',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2888,
    path: `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-registration-successor-authority.json`,
    record_id: 'fb963d723491c53e37905101baa4d6e4ad56df30238175b33d6e056ef327df67',
    record_id_field: 'work3_termination_fee_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'b96b22dbba021a7402ce1e792bf02c08ad651ff7bfc38749f3eca2a36a68c954',
  }),
});

const TERMINATION_FEE_BEN_RULINGS_BINDING = Object.freeze({
  byte_length: 5815,
  path: 'docs/codex-program/notes/TERMINATION-FEE-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: '94b5bf97818c6bd5f36cf409c8e341488a1c038e9dc6a8dd51af1fd17ce21ae4',
});

const TERMINATION_FEE_FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  byte_length: 251109,
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-termination-fee.json`,
  record_id: 'f15c4aeb5554cb1583fd1e30ef27c2f7196ad5ebb51eb3f06b87e561570da492',
  record_id_field: 'family_profile_package_id',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  sha256: '190f356f8a8174a4638d8702154351d27f0f53e24a5306ef2e29d239904d59c8',
});

const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const LAWFUL_WORK3_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const TERMINATION_FEE_CLASSIFICATION_BUCKETS = Object.freeze([
  'FEE_AMOUNT',
  'TAIL_FEE',
  'SOLE_REMEDY_LINK',
  'CARVEOUT',
]);

const TERMINATION_FEE_PHASE4_PROFILE_KEYS = Object.freeze([
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
  physicalBytes(TERMINATION_FEE_PHASE2_AUTHORITY_BINDING);
  const terminationFeeAuthoringPhase2Authority = sourceEnvelope(
    TERMINATION_FEE_PHASE2_AUTHORITY_BINDING,
  );
  return {
    terminationFeeAuthoringPhase2Authority,
    governedSources: governedSources(terminationFeeAuthoringPhase2Authority.record),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    terminationFeeAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(TERMINATION_FEE_PHASE4_AUTHORITY_BINDING),
    terminationFeeAuthoringPhase2Authority: fixture.terminationFeeAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3TerminationFeeUnapprovedInventoryReviewAuthority:
      sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.inventoryAuthority),
    work3TerminationFeeBenInventorySessionSuccessorAuthority:
      sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.benAuthority),
    work3TerminationFeeFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.sealAuthority),
    work3TerminationFeeRegistrationSuccessorAuthority:
      sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(TERMINATION_FEE_WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved TERMINATION_FEE partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.terminationFeeAuthoringPhase2Authority.record;
  const terminals = authority.source_terminal_successor_contract.terminal_rule_registry;

  assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 6);
  assert.equal(terminals.length, PROFILE_COUNT);
  assert.deepEqual(
    sortedUnique(terminals.map((terminal) => terminal.source_unit_key)),
    terminals.map((terminal) => terminal.source_unit_key).sort(),
  );

  const result = tfAuthoring.prepareTerminationFeePhase2FamilyProposal(fixture);

  assertExactKeys(result, tfAuthoring.TERMINATION_FEE_PHASE2_PROPOSAL_KEYS, 'proposal keys');
  assert.equal(result.family_key, 'TERMINATION_FEE');
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.zero_m4_claim_gaps, true);
  assert.equal(LOWERCASE_HEX_64.test(result.proposal_id), true);
  assert.deepEqual(result.authority_binding, TERMINATION_FEE_PHASE2_AUTHORITY_BINDING);
  assert.equal(result.derived_profile_count, PROFILE_COUNT);
  assert.equal(result.proposed_partition.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(
    result.source_terminal_coverage.classification_buckets,
    TERMINATION_FEE_CLASSIFICATION_BUCKETS,
  );
  assert.equal(result.m4_claim_accounting.expected_count, PROFILE_COUNT);
  assert.equal(result.m4_claim_accounting.accounted_count, PROFILE_COUNT);
  assert.equal(result.symbolic_temporal_graphs.length, 0);
  assert.equal(result.temporal_state_reference_edges.length, 0);
  assert.equal(Object.isFrozen(result), true);

  const signatures = result.proposed_partition.proposed_profiles.map(
    (profile) => profile.canonical_tuple.required_expression_signature,
  );
  assert.equal(sortedUnique(signatures).length, PROFILE_COUNT);
});

test('Phase2 authority records the fee-side and owner-family residuals it cannot settle', () => {
  const authority = readRecord(TERMINATION_FEE_PHASE2_AUTHORITY_BINDING.path);

  assert.equal(authority.fee_side_residuals.non_target_fee_side_row_count, 2);
  assert.equal(authority.fee_side_residuals.sealed_m5_label_distinguishes_fee_side, false);
  assert.deepEqual(
    authority.fee_side_residuals.comparator_observed_fee_sides,
    ['BUYER', 'TARGET'],
  );
  assert.equal(
    authority.comparator_owner_family_residuals.foreign_owner_family_row_count,
    10,
  );
  assert.deepEqual(
    authority.comparator_owner_family_residuals.comparator_declared_owner_families,
    ['SPECIFIC_PERFORMANCE_REMEDIES'],
  );
  assert.deepEqual(
    authority.comparator_owner_family_residuals.foreign_owner_family_buckets,
    ['CARVEOUT', 'SOLE_REMEDY_LINK'],
  );
  assert.deepEqual(
    authority.m5_subtype_reconciliation.comparator_bucket_counts,
    { CARVEOUT: 5, FEE_AMOUNT: 6, SOLE_REMEDY_LINK: 5, TAIL_FEE: 4 },
  );
  assert.deepEqual(
    authority.m5_subtype_reconciliation.comparator_buckets_without_sealed_m5_label,
    [],
  );
  assert.deepEqual(
    authority.m5_subtype_reconciliation.sealed_m5_labels_without_comparator_instance,
    ['FEE_TRIGGER', 'EXPENSE_REIMBURSEMENT', 'LATE_INTEREST', 'CONDITIONAL_FEE_SCHEDULE'],
  );
});

test('Phase4 TERMINATION_FEE package review returns 20 unapproved proposals without Work3 identities', () => {
  physicalBytes(TERMINATION_FEE_PHASE4_AUTHORITY_BINDING);
  const authority = readRecord(TERMINATION_FEE_PHASE4_AUTHORITY_BINDING.path);
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const result = tfAuthoring.prepareTerminationFeeFamilyProfilePackageReview(phase4Fixture());

  assertExactKeys(
    result,
    tfAuthoring.TERMINATION_FEE_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_20_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
  );
  assert.equal(result.profile_approval_state, 'UNAPPROVED');
  assert.equal(result.proposed_profiles.length, PROFILE_COUNT);
  assert.deepEqual(result.review_accounting, {
    complete_profile_count: PROFILE_COUNT,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_hold_row_count: HOLD_COUNT,
    work3_identity_count: 0,
  });
  assert.equal(result.zero_effect_boundary.work3_identity_count, 0);

  for (const profile of result.proposed_profiles) {
    assertExactKeys(
      profile,
      TERMINATION_FEE_PHASE4_PROFILE_KEYS,
      `${profile.proposed_profile_key} keys`,
    );
    assert.equal(profile.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(profile.proposed_validation.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.package_profile_key.startsWith('PROFILE:TERMINATION_FEE:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }

  const holdRows = result.proposed_profiles.filter(
    (profile) => profile.review_flags.some((flag) => HOLD_REVIEW_FLAGS.includes(flag)),
  );
  assert.equal(holdRows.length, HOLD_COUNT);
});

test('Phase4 holds every sole-remedy row the comparator assigns to another family', () => {
  const result = tfAuthoring.prepareTerminationFeeFamilyProfilePackageReview(phase4Fixture());
  const authority = readRecord(TERMINATION_FEE_PHASE2_AUTHORITY_BINDING.path);
  const ownerFamilyBySignature = new Map(
    authority.source_terminal_successor_contract.terminal_rule_registry.map((terminal) => [
      terminal.required_expression_signature,
      terminal.source_closure.members[0].comparator_owner_family,
    ]),
  );
  const feeSideBySignature = new Map(
    authority.source_terminal_successor_contract.terminal_rule_registry.map((terminal) => [
      terminal.required_expression_signature,
      terminal.source_closure.members[0].fee_side,
    ]),
  );

  let foreignOwnerRows = 0;
  let buyerSideRows = 0;
  for (const profile of result.proposed_profiles) {
    const signature = profile.canonical_tuple.required_expression_signature;
    const ownerFamily = ownerFamilyBySignature.get(signature);
    const feeSide = feeSideBySignature.get(signature);
    const foreignOwner = typeof ownerFamily === 'string' && ownerFamily !== 'TERMINATION_FEE';
    const buyerSide = feeSide === 'BUYER';
    if (foreignOwner) foreignOwnerRows += 1;
    if (buyerSide) buyerSideRows += 1;
    assert.equal(
      profile.review_flags.includes('COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED'),
      foreignOwner,
      `${profile.proposed_profile_key} owner-family flag`,
    );
    assert.equal(
      profile.review_flags.includes('FEE_SIDE_PARTITION_DISPOSITION_REQUIRED'),
      buyerSide,
      `${profile.proposed_profile_key} fee-side flag`,
    );
  }
  assert.equal(foreignOwnerRows, 10);
  assert.equal(buyerSideRows, 2);
  assert.equal(foreignOwnerRows + buyerSideRows, HOLD_COUNT);
});

test('Work3 TERMINATION_FEE unapproved inventory review passes the validator without Work3 identity', () => {
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = tfAuthoring.prepareTerminationFeeWork3UnapprovedInventoryReview({
    terminationFeeWork3UnapprovedInventoryReviewEvidence: {
      work3TerminationFeeUnapprovedInventoryReviewAuthority:
        evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
    },
    terminationFeePhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_20_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.inventory_packet_reference.retained_source_gap_count, 0);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.next_governance_stop.package_approval_permitted, false);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 TERMINATION_FEE Ben inventory disposition captures 8 approve and 12 honest holds', () => {
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.benAuthority);
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = tfAuthoring.prepareTerminationFeeWork3BenInventorySessionDisposition({
    terminationFeeWork3BenInventorySessionDispositionEvidence: {
      work3TerminationFeeUnapprovedInventoryReviewAuthority:
        evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
      work3TerminationFeeBenInventorySessionSuccessorAuthority:
        evidence.work3TerminationFeeBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    terminationFeePhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: APPROVE_COUNT,
    hold_count: HOLD_COUNT,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    subtype_partition_hold_count: HOLD_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.deepEqual(result.ben_rulings_binding, TERMINATION_FEE_BEN_RULINGS_BINDING);
  assert.equal(result.session_receipt_reference.completion_state, 'COMPLETE');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 TERMINATION_FEE family package seal defers subtype partition without registering', () => {
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.session);
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = tfAuthoring.prepareTerminationFeeWork3FamilyPackageSeal({
    terminationFeeWork3FamilyPackageSealEvidence: {
      work3TerminationFeeUnapprovedInventoryReviewAuthority:
        evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
      work3TerminationFeeBenInventorySessionSuccessorAuthority:
        evidence.work3TerminationFeeBenInventorySessionSuccessorAuthority,
      work3TerminationFeeFamilyPackageSealSuccessorAuthority:
        evidence.work3TerminationFeeFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    terminationFeePhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.family_package_seal_id,
    evidence.familyPackageSealReceipt.record.family_package_seal_id,
  );
  assert.equal(result.subtype_partition_disposition_binding.disposition_status, 'DEFERRED');
  assert.equal(
    result.subtype_partition_disposition_binding.subtype_partition_hold_count,
    HOLD_COUNT,
  );
  assert.equal(
    result.subtype_partition_disposition_binding.legal_grouping_review_pending_count,
    PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 TERMINATION_FEE family package registration binds the seal receipt without activation', () => {
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.sealReceipt);
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = tfAuthoring.prepareTerminationFeeWork3FamilyPackageRegistration({
    terminationFeeWork3FamilyPackageRegistrationEvidence: evidence,
    terminationFeePhase4ReviewInput: phase4Fixture(),
  });

  assert.equal(
    result.candidate_state,
    'BEN_TERMINATION_FEE_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
  );
  assert.equal(result.registered_profile_identities.length, PROFILE_COUNT);
  assert.equal(result.family_profile_package_identity.profile_id_count, PROFILE_COUNT);
  assert.equal(
    result.family_profile_package_identity.subtype_partition_disposition_state,
    'DEFERRED',
  );
  assert.equal(result.review_accounting.work3_identity_count, PROFILE_COUNT + 1);
  assert.equal(
    result.registered_profile_identities.filter(
      (profile) => profile.inventory_disposition === 'HOLD',
    ).length,
    HOLD_COUNT,
  );
  assert.equal(
    sortedUnique(result.registered_profile_identities.map((profile) => profile.profile_id)).length,
    PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.activation_permitted, false);
  assert.equal(Object.hasOwn(result, 'activation_id'), false);
});

test('TERMINATION_FEE inventory packet carries per-row shape summaries and honest hold flags', () => {
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.packet);
  const packet = readRecord(TERMINATION_FEE_WORK3_BINDINGS.packet.path);

  assert.equal(packet.family_key, 'TERMINATION_FEE');
  assert.equal(packet.profile_count, PROFILE_COUNT);
  assert.equal(packet.profile_review_items.length, PROFILE_COUNT);
  assert.equal(packet.honest_hold_summary.hold_row_count, HOLD_COUNT);
  assert.deepEqual(packet.honest_hold_summary.hold_review_flags, [...HOLD_REVIEW_FLAGS]);
  assert.equal(packet.honest_hold_summary.comparator_owner_family_hold_row_count, 10);
  assert.equal(packet.honest_hold_summary.fee_side_hold_row_count, 2);
  assert.deepEqual(
    packet.honest_hold_summary.m5_sealed_subtype_labels_without_comparator_instances,
    ['FEE_TRIGGER', 'EXPENSE_REIMBURSEMENT', 'LATE_INTEREST', 'CONDITIONAL_FEE_SCHEDULE'],
  );
  assert.deepEqual(
    packet.honest_hold_summary.comparator_declared_owner_families,
    ['SPECIFIC_PERFORMANCE_REMEDIES'],
  );
  assert.deepEqual(packet.honest_hold_summary.comparator_buckets_without_sealed_m5_label, []);
  assert.deepEqual(
    Object.keys(packet.subtype_bucket_counts).sort(),
    [...TERMINATION_FEE_CLASSIFICATION_BUCKETS].sort(),
  );
  assert.equal(
    Object.values(packet.subtype_bucket_counts).reduce((sum, count) => sum + count, 0),
    PROFILE_COUNT,
  );
  assert.deepEqual(packet.deal_counts, {
    concho: 2,
    metsera: 5,
    redhat: 4,
    skechers: 3,
    skywater: 1,
    topbuild: 5,
  });

  for (const item of packet.profile_review_items) {
    assert.equal(typeof item.shape_summary.subtype_bucket, 'string');
    assert.ok(item.shape_summary.subtype_bucket.length > 0);
    assert.equal(item.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED'), true);
    assert.equal(item.review_completion_state, 'COMPLETE');
    assert.equal(typeof item.deal, 'string');
    assert.equal(
      item.proposed_technical_disposition,
      item.review_flags.some((flag) => HOLD_REVIEW_FLAGS.includes(flag)) ? 'HOLD' : 'APPROVE',
    );
  }
});

test('TERMINATION_FEE Ben disposition approves only target-side fee and tail rows', () => {
  physicalBytes(TERMINATION_FEE_WORK3_BINDINGS.disposition);
  const disposition = readRecord(TERMINATION_FEE_WORK3_BINDINGS.disposition.path);
  const packet = readRecord(TERMINATION_FEE_WORK3_BINDINGS.packet.path);
  const shapeByKey = new Map(packet.profile_review_items.map(
    (item) => [item.proposed_profile_key, item.shape_summary],
  ));

  assert.equal(disposition.reviewer, 'BEN_GOODCHILD');
  assert.equal(disposition.ben_rulings_digest, TERMINATION_FEE_BEN_RULINGS_BINDING.sha256);
  assert.equal(disposition.packet_digest, TERMINATION_FEE_WORK3_BINDINGS.packet.sha256);
  assert.equal(disposition.session_summary.approved_count, APPROVE_COUNT);
  assert.equal(disposition.session_summary.hold_count, HOLD_COUNT);
  assert.equal(disposition.session_summary.reject_count, 0);

  const approvedBuckets = new Set(['FEE_AMOUNT', 'TAIL_FEE']);
  for (const row of disposition.profile_dispositions) {
    const shape = shapeByKey.get(row.proposed_profile_key);
    const approvable = approvedBuckets.has(shape.subtype_bucket)
      && shape.fee_side === 'TARGET'
      && shape.comparator_owner_family === null;
    assert.equal(row.legal_grouping_pending_acknowledged, true);
    assert.equal(row.disposition, approvable ? 'APPROVE' : 'HOLD');
    assert.equal(row.hold_reason_flags.length > 0, row.disposition === 'HOLD');
  }
});

test('TERMINATION_FEE Ben rulings note reuses the sealed M5 programme rulings', () => {
  physicalBytes(TERMINATION_FEE_BEN_RULINGS_BINDING);
  const note = readFileSync(join(REPO_ROOT, TERMINATION_FEE_BEN_RULINGS_BINDING.path), 'utf8');
  const sealed = readRecord(`${CONTROL}/m5-programme-rulings.json`);
  assert.equal(note.includes(sealed.ruling_record_id), true);
  for (const ruling of sealed.rulings) {
    assert.equal(note.includes(ruling.ruling_id), true);
  }
});

test('TERMINATION_FEE Milestone A family package on disk validates 20 registered profiles', () => {
  physicalBytes(TERMINATION_FEE_FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(TERMINATION_FEE_FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.family_key, 'TERMINATION_FEE');
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:TERMINATION_FEE:PROFILE_SET_V1',
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

  const phase4 = tfAuthoring.prepareTerminationFeeFamilyProfilePackageReview(phase4Fixture());
  assert.deepEqual(
    packageRecord.profiles.map((profile) => profile.profile_key).sort(),
    phase4.proposed_profiles.map((profile) => profile.package_profile_key).sort(),
  );
});

test('lawful Work3 fixture TERMINATION_FEE on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'TERMINATION_FEE',
  );
  assert.ok(override, 'lawful Work3 fixture has no TERMINATION_FEE on-disk override');
  assert.equal(override.binding.path, TERMINATION_FEE_FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      TERMINATION_FEE_FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
