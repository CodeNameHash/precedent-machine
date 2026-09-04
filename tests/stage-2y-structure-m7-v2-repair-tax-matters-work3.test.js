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

let taxMattersAuthoring;
try {
  taxMattersAuthoring = require('../lib/canonical-v2/m7-v2-tax-matters-authoring.js');
} catch (error) {
  throw new Error('TAX_MATTERS Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareTaxMattersPhase2FamilyProposal',
  'prepareTaxMattersFamilyProfilePackageReview',
  'prepareTaxMattersWork3UnapprovedInventoryReview',
  'prepareTaxMattersWork3BenInventorySessionDisposition',
  'prepareTaxMattersWork3FamilyPackageSeal',
  'prepareTaxMattersWork3FamilyPackageRegistration',
]) {
  if (typeof taxMattersAuthoring[facade] !== 'function') {
    throw new Error(`TAX_MATTERS ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = taxMattersAuthoring.TAX_MATTERS_PROFILE_COUNT;
const FLAGS = taxMattersAuthoring.TAX_MATTERS_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

const CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';

const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'INTENDED_TAX_TREATMENT',
  'TAX_TREATMENT_PROTECTION',
  'TAX_REPORTING_CONSISTENCY',
  'TAX_OPINION_COOPERATION',
  'TRANSFER_TAX_ALLOCATION',
  'WITHHOLDING_MECHANIC',
  'FIRPTA_CERTIFICATE',
  'TAX_INTEGRATION_OR_SPECIAL_MECHANIC',
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: taxMattersAuthoring.TAX_MATTERS_PHASE2_AUTHORITY_PATH,
  schema_version: taxMattersAuthoring.TAX_MATTERS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'tax_matters_authoring_phase2_authority_id',
  record_id: taxMattersAuthoring.TAX_MATTERS_PHASE2_AUTHORITY_ID,
  byte_length: taxMattersAuthoring.TAX_MATTERS_PHASE2_AUTHORITY_BYTES,
  sha256: taxMattersAuthoring.TAX_MATTERS_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: taxMattersAuthoring.TAX_MATTERS_PHASE4_AUTHORITY_PATH,
  schema_version: taxMattersAuthoring.TAX_MATTERS_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'tax_matters_authoring_phase4_family_profile_package_review_authority_id',
  record_id: taxMattersAuthoring.TAX_MATTERS_PHASE4_AUTHORITY_ID,
  byte_length: taxMattersAuthoring.TAX_MATTERS_PHASE4_AUTHORITY_BYTES,
  sha256: taxMattersAuthoring.TAX_MATTERS_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2067,
    path: `${CONTROL}/m7-v2-repair-contract-work3-tax-matters-unapproved-inventory-review-authority.json`,
    record_id: 'a567c9895288b7454019cdc1f5be76cf3136d8a0f08122ed55d17a722a6d2997',
    record_id_field: 'work3_tax_matters_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TAX_MATTERS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: 'a85e045f2cab2280b7c1b5156aa9ff449ae9a469177c1159eb9fd25fd841d100',
  }),
  packet: Object.freeze({
    byte_length: 21017,
    path: `${CONTROL}/m7-v2-repair-tax-matters-17-profile-inventory-review-packet-draft.json`,
    record_id: 'ea242322ad99543f7778c6a0e31cf916403d4a22624b865d2f57b17150bd6a12',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_TAX_MATTERS_17_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: 'd44327cbd4f39c5dca616aef38685028f2e9d90a67b949a956d6f8a96a50feb1',
  }),
  disposition: Object.freeze({
    byte_length: 8157,
    path: `${CONTROL}/m7-v2-repair-tax-matters-17-profile-inventory-disposition.json`,
    record_id: 'bb69a520521857b23ca7f76c1c3c45f51c3da2000d99892c90ae4417ab2e0114',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_TAX_MATTERS_17_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '74ef3d3c5056035513eae71de4e45981924f17e696a3498c810be35b0cd3245e',
  }),
  session: Object.freeze({
    byte_length: 1110,
    path: `${CONTROL}/m7-v2-repair-tax-matters-ben-inventory-session-receipt.json`,
    record_id: '1309857475bd071fbff9d369ea6ec90d3ccc6c22b2693105b579134f51ca7554',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_TAX_MATTERS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '12e9ae80e1aa15f09ef8ad2ef586aa752c3a40c4c8da84d9f1f350fb9664ba4e',
  }),
  benAuthority: Object.freeze({
    byte_length: 2752,
    path: `${CONTROL}/m7-v2-repair-contract-work3-tax-matters-ben-inventory-session-successor-authority.json`,
    record_id: '43e84a70e0e59f12efbc334a8679913e9221aba9a06313d742f7223938b403f3',
    record_id_field: 'work3_tax_matters_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TAX_MATTERS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '00b7fe9d55940fc5913cbb68144f3172a69e51d7b59a887c60cca6e068e491fb',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3251,
    path: `${CONTROL}/m7-v2-repair-contract-work3-tax-matters-family-package-seal-successor-authority.json`,
    record_id: 'a20f9f79502f8f533911646043417f7d920ee9b0f5097fe26e7f8f2515e8627a',
    record_id_field: 'work3_tax_matters_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TAX_MATTERS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '75e59fa8caf8c1b9c2c58a247e2486ecfbc2955b2ddf6e1dfad3fd8baf74a4ac',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2255,
    path: `${CONTROL}/m7-v2-repair-tax-matters-family-package-seal-receipt.json`,
    record_id: 'f661f034ae37e7701c4ef3c3a68aebff9229a154b7243deb30c3b7f2357f1986',
    record_id_field: 'tax_matters_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_TAX_MATTERS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '9e4fba46b902935e613badb0c59bf67f400a8d7b42f752fa2f3ea051bb884bea',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2782,
    path: `${CONTROL}/m7-v2-repair-contract-work3-tax-matters-registration-successor-authority.json`,
    record_id: '071f902a6c3dc79b3fe1d59edab103e669cc4980480b32513c748163e81c0dc2',
    record_id_field: 'work3_tax_matters_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TAX_MATTERS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'cd6251371a196c8847b2120cfa82fb2d84f9189ac3c4b190d4420225ffc3f5b5',
  }),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-tax-matters.json`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '63f286316389604e958f1c6d4f55b1628ac97d519adc93f9ef2f2a2d8fa319ca',
  byte_length: 215056,
  sha256: '5350378332a66943e9ee6c0ef82e6cfbd9eebef0d8f9cb8f12f190626d6f12a0',
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
  const taxMattersAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    taxMattersAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      taxMattersAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    taxMattersAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    taxMattersAuthoringPhase2Authority:
      fixture.taxMattersAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3TaxMattersUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3TaxMattersBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3TaxMattersFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3TaxMattersRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved TAX_MATTERS partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.taxMattersAuthoringPhase2Authority.record;
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
      [CONCHO_AGREEMENT_ID]: 3,
      [SKECHERS_AGREEMENT_ID]: 7,
      [SKYWATER_AGREEMENT_ID]: 2,
      [TOPBUILD_AGREEMENT_ID]: 5,
    },
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'INTENDED_TAX_TREATMENT',
      'TAX_OPINION_COOPERATION',
      'TAX_TREATMENT_PROTECTION',
      'TRANSFER_TAX_ALLOCATION',
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

  // CC tax-opinion receipt-only closing conditions stay link-only under Q02.
  assert.deepEqual(
    authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['CLOSING_CONDITIONS'],
  );

  const result = taxMattersAuthoring
    .prepareTaxMattersPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    taxMattersAuthoring.TAX_MATTERS_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_TAX_MATTERS_FAMILY_PROPOSAL/V1',
    family_key: 'TAX_MATTERS',
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
    'TAX_MATTERS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 TAX_MATTERS family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = taxMattersAuthoring
    .prepareTaxMattersPhase2FamilyProposal({
      taxMattersAuthoringPhase2Authority:
        fixture.taxMattersAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = taxMattersAuthoring
    .prepareTaxMattersFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    taxMattersAuthoring.TAX_MATTERS_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_17_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
      taxMattersAuthoring.TAX_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    proposed_profile_count: PROFILE_COUNT,
    review_only_profile_count: PROFILE_COUNT,
    subtype_partition_divergence_flag_count:
      taxMattersAuthoring.TAX_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:TAX_MATTERS:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 TAX_MATTERS unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = taxMattersAuthoring
    .prepareTaxMattersWork3UnapprovedInventoryReview({
      taxMattersWork3UnapprovedInventoryReviewEvidence: {
        work3TaxMattersUnapprovedInventoryReviewAuthority:
          evidence.work3TaxMattersUnapprovedInventoryReviewAuthority,
      },
      taxMattersPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_17_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 7);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 TAX_MATTERS Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = taxMattersAuthoring
    .prepareTaxMattersWork3BenInventorySessionDisposition({
      taxMattersWork3BenInventorySessionDispositionEvidence: {
        work3TaxMattersUnapprovedInventoryReviewAuthority:
          evidence.work3TaxMattersUnapprovedInventoryReviewAuthority,
        work3TaxMattersBenInventorySessionSuccessorAuthority:
          evidence.work3TaxMattersBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      taxMattersPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count:
      taxMattersAuthoring.TAX_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
    populated_subtype_bucket_count:
      taxMattersAuthoring.TAX_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT,
    registered_subtype_bucket_count:
      taxMattersAuthoring.TAX_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count:
      taxMattersAuthoring.TAX_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 TAX_MATTERS family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = taxMattersAuthoring.prepareTaxMattersWork3FamilyPackageSeal({
    taxMattersWork3FamilyPackageSealEvidence: {
      work3TaxMattersUnapprovedInventoryReviewAuthority:
        evidence.work3TaxMattersUnapprovedInventoryReviewAuthority,
      work3TaxMattersBenInventorySessionSuccessorAuthority:
        evidence.work3TaxMattersBenInventorySessionSuccessorAuthority,
      work3TaxMattersFamilyPackageSealSuccessorAuthority:
        evidence.work3TaxMattersFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    taxMattersPhase4ReviewInput: phase4Fixture(),
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
    taxMattersAuthoring.TAX_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 TAX_MATTERS family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = taxMattersAuthoring
    .prepareTaxMattersWork3FamilyPackageRegistration({
      taxMattersWork3FamilyPackageRegistrationEvidence: evidence,
      taxMattersPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_TAX_MATTERS_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Tax matters Milestone A inventory packet draft carries shape summaries and honest holds', () => {
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
    taxMattersAuthoring.TAX_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    taxMattersAuthoring.TAX_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  );
});

test('Tax matters Milestone A disposition approves 17 profiles and reuses only sealed M5 rulings', () => {
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

test('Tax matters Milestone A family profile package on disk validates 17 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:TAX_MATTERS:PROFILE_SET_V1',
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

  const phase4 = taxMattersAuthoring
    .prepareTaxMattersFamilyProfilePackageReview(phase4Fixture());
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

test('lawful Work3 fixture TAX_MATTERS on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'TAX_MATTERS',
  );
  assert.ok(override, 'lawful Work3 fixture has no TAX_MATTERS on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
