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

let proxyMeetingAuthoring;
try {
  proxyMeetingAuthoring = require('../lib/canonical-v2/m7-v2-proxy-meeting-authoring.js');
} catch (error) {
  throw new Error('PROXY_MEETING Phase2 proposal facade export is missing.');
}

for (const facade of [
  'prepareProxyMeetingPhase2FamilyProposal',
  'prepareProxyMeetingFamilyProfilePackageReview',
  'prepareProxyMeetingWork3UnapprovedInventoryReview',
  'prepareProxyMeetingWork3BenInventorySessionDisposition',
  'prepareProxyMeetingWork3FamilyPackageSeal',
  'prepareProxyMeetingWork3FamilyPackageRegistration',
]) {
  if (typeof proxyMeetingAuthoring[facade] !== 'function') {
    throw new Error(`PROXY_MEETING ${facade} facade export is missing.`);
  }
}

const PROFILE_COUNT = proxyMeetingAuthoring.PROXY_MEETING_PROFILE_COUNT;
const FLAGS = proxyMeetingAuthoring.PROXY_MEETING_REVIEW_FLAGS;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;



const GOVERNED_CLAIM_IDS = Object.freeze([
  '8dcd3c98a7ac6b3ce7d13b6f0b78a1a1bd3c0fdbd6ee0dbdca1adf1f5aa1f000',
]);

const CLASSIFICATION_BUCKETS = Object.freeze([
  'DOCUMENT_FILING',
  'MEETING_CALL_OR_HOLD',
  'RECORD_DATE_OR_BROKER_SEARCH',
  'RECOMMENDATION_INCLUSION',
  'ADJOURNMENT',
  'SUBSIDIARY_APPROVAL',
  
]);

const PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: proxyMeetingAuthoring.PROXY_MEETING_PHASE2_AUTHORITY_PATH,
  schema_version: proxyMeetingAuthoring.PROXY_MEETING_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'proxy_meeting_authoring_phase2_authority_id',
  record_id: proxyMeetingAuthoring.PROXY_MEETING_PHASE2_AUTHORITY_ID,
  byte_length: proxyMeetingAuthoring.PROXY_MEETING_PHASE2_AUTHORITY_BYTES,
  sha256: proxyMeetingAuthoring.PROXY_MEETING_PHASE2_AUTHORITY_SHA256,
});

const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: proxyMeetingAuthoring.PROXY_MEETING_PHASE4_AUTHORITY_PATH,
  schema_version: proxyMeetingAuthoring.PROXY_MEETING_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'proxy_meeting_authoring_phase4_family_profile_package_review_authority_id',
  record_id: proxyMeetingAuthoring.PROXY_MEETING_PHASE4_AUTHORITY_ID,
  byte_length: proxyMeetingAuthoring.PROXY_MEETING_PHASE4_AUTHORITY_BYTES,
  sha256: proxyMeetingAuthoring.PROXY_MEETING_PHASE4_AUTHORITY_SHA256,
});

const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2092,
    path: `${CONTROL}/m7-v2-repair-contract-work3-proxy-meeting-unapproved-inventory-review-authority.json`,
    record_id: 'c786cb8ca77f7938694e9a2aad4a503c75b258b5391597dc57df4b18397c0d27',
    record_id_field: 'work3_proxy_meeting_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_PROXY_MEETING_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '6875dfe5b3e1a975ceb67ceb98a156c3e21e09ee32f1b29b6b4a9992dfff428c',
  }),
  packet: Object.freeze({
    byte_length: 37028,
    path: `${CONTROL}/m7-v2-repair-proxy-meeting-31-profile-inventory-review-packet-draft.json`,
    record_id: '0bd35723ac2e0c13bcb2aeceec054e5aaf5cabdc9182b495ece9b635550e4ca0',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_PROXY_MEETING_31_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: 'c0af6813590cef69c6e667787da44c882f0bc6d84c9bf82d69e7b4a659b8a37d',
  }),
  disposition: Object.freeze({
    byte_length: 13679,
    path: `${CONTROL}/m7-v2-repair-proxy-meeting-31-profile-inventory-disposition.json`,
    record_id: 'd255e5235cb99995b03ccc43488c45a5f918736811e21a5ea78340708f62a8ce',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_PROXY_MEETING_31_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '99b0502977a1f06d9932ef4906c17513ff82bf3092b6174eaaf86ef690a1dfbd',
  }),
  session: Object.freeze({
    byte_length: 1118,
    path: `${CONTROL}/m7-v2-repair-proxy-meeting-ben-inventory-session-receipt.json`,
    record_id: '2971a885a542735f61ebb9bd944f841761151a3aaa4339af5e1552e081db2c0a',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_PROXY_MEETING_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: 'ce69c74bceb2b3816933e70316382f82be8a0ada9c979dc36ec048bc324e5b46',
  }),
  benAuthority: Object.freeze({
    byte_length: 2781,
    path: `${CONTROL}/m7-v2-repair-contract-work3-proxy-meeting-ben-inventory-session-successor-authority.json`,
    record_id: 'd1133400b6943a86299ba611dd74f06b130e7716f9514a94bade92149fac2cdf',
    record_id_field: 'work3_proxy_meeting_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_PROXY_MEETING_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: '2355d8316431452515b5bd580ea5aad262aa8dd5a9e54fe0bcef03ee064fd600',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3289,
    path: `${CONTROL}/m7-v2-repair-contract-work3-proxy-meeting-family-package-seal-successor-authority.json`,
    record_id: 'e689ff7436605ab4d4e1bae53c26622baf549d0558ebfcd996009b8c6445eae5',
    record_id_field: 'work3_proxy_meeting_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_PROXY_MEETING_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: '549fe6897478480cf0d643c4fd5e6ff0b482906ebb44fc1fb9a4e074a15db056',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2271,
    path: `${CONTROL}/m7-v2-repair-proxy-meeting-family-package-seal-receipt.json`,
    record_id: '7f4ea88e6319efba56c819d14fd4ce390ce66ed1e43d505363163b483605fc1a',
    record_id_field: 'proxy_meeting_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_PROXY_MEETING_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: '3224fa1745f1193649ed4859b345a9fd612af4c9316cf0ecdb15b7c71a36ac1e',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2818,
    path: `${CONTROL}/m7-v2-repair-contract-work3-proxy-meeting-registration-successor-authority.json`,
    record_id: '726ec27894d8fd1fc92adf826cf9acf309373700be54b662ff708496810dce2e',
    record_id_field: 'work3_proxy_meeting_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_PROXY_MEETING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'ce6a424a1b19acb5e8a7c3e8acf98e2efb75ec8b1f6bb0d53a815b74f771c218',
  }),
});

const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  "byte_length": 388729,
  "path": "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-proxy-meeting.json",
  "record_id": "d39988aa5e841919da0d0ec77231b0c56611c46d391e552920986874537700eb",
  "record_id_field": "family_profile_package_id",
  "schema_version": "STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2",
  "sha256": "a859198669e1d399a8bea64a9f761928a06809e4206942f20c07753641d2ce50"
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
  const proxyMeetingAuthoringPhase2Authority = sourceEnvelope(PHASE2_AUTHORITY_BINDING);
  return {
    proxyMeetingAuthoringPhase2Authority,
    governedSources: phase2GovernedSources(
      proxyMeetingAuthoringPhase2Authority.record,
    ),
  };
}

function phase4Fixture() {
  const fixture = phase2Fixture();
  return {
    proxyMeetingAuthoringPhase4FamilyProfilePackageReviewAuthority:
      sourceEnvelope(PHASE4_AUTHORITY_BINDING),
    proxyMeetingAuthoringPhase2Authority:
      fixture.proxyMeetingAuthoringPhase2Authority,
    governedSources: fixture.governedSources,
  };
}

function work3Evidence() {
  return {
    work3ProxyMeetingUnapprovedInventoryReviewAuthority:
      sourceEnvelope(WORK3_BINDINGS.inventoryAuthority),
    work3ProxyMeetingBenInventorySessionSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.benAuthority),
    work3ProxyMeetingFamilyPackageSealSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.sealAuthority),
    work3ProxyMeetingRegistrationSuccessorAuthority:
      sourceEnvelope(WORK3_BINDINGS.registrationAuthority),
    inventoryReviewPacketDraft: sourceEnvelope(WORK3_BINDINGS.packet),
    benAuthoredInventoryDisposition: sourceEnvelope(WORK3_BINDINGS.disposition),
    benInventorySessionReceipt: sourceEnvelope(WORK3_BINDINGS.session),
    familyPackageSealReceipt: sourceEnvelope(WORK3_BINDINGS.sealReceipt),
  };
}

test('Phase2 proposal derives a deterministic unapproved PROXY_MEETING partition', () => {
  const fixture = phase2Fixture();
  const authority = fixture.proxyMeetingAuthoringPhase2Authority.record;
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
      '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a': 4,
      '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116': 6,
      '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb': 8,
      'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363': 4,
      'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c': 4,
      'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c': 5
},
  );
  assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    ["ADJOURNMENT","DOCUMENT_FILING","MEETING_CALL_OR_HOLD","RECOMMENDATION_INCLUSION","RECORD_DATE_OR_BROKER_SEARCH"],
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
    authority.policy_overlay.cross_family_link_only_boundaries,
    [],
  );

  const result = proxyMeetingAuthoring
    .prepareProxyMeetingPhase2FamilyProposal(fixture);

  assertExactKeys(
    result,
    proxyMeetingAuthoring.PROXY_MEETING_PHASE2_PROPOSAL_KEYS,
    'proposal keys',
  );
  assert.deepEqual({
    schema_version: result.schema_version,
    family_key: result.family_key,
    proposal_state: result.proposal_state,
    profile_approval_state: result.profile_approval_state,
    zero_m4_claim_gaps: result.zero_m4_claim_gaps,
  }, {
    schema_version: 'M7_V2_PROXY_MEETING_FAMILY_PROPOSAL/V1',
    family_key: 'PROXY_MEETING',
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
    'LEGAL_GROUPING_REVIEW_REQUIRED',
    'PROXY_MEETING_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
  ]);

  // Every profile is claim-scale: one governed M4 claim, no silent rows.
  for (const profile of result.proposed_partition.proposed_profiles) {
    assert.equal(profile.m4_claim_ids.length, 1);
    assert.equal(profile.source_unit_keys.length, 1);
  }
  const conchoMeetingConveneSignatures = result.proposed_partition.proposed_profiles
    .map((profile) => profile.canonical_tuple.required_expression_signature)
    .filter((signature) => signature.includes('CONCHO_6_6') && signature.includes('MEETING_CONVENE_OBLIGATION'))
    .sort();
  assert.equal(conchoMeetingConveneSignatures.length, 2);
  assert.equal(Object.isFrozen(result), true);
});

test('Phase4 PROXY_MEETING family profile package review returns unapproved proposals without Work3 identities', () => {
  physicalBytes(PHASE4_AUTHORITY_BINDING);
  const authority = sourceEnvelope(PHASE4_AUTHORITY_BINDING).record;
  assert.equal(authority.profile_review_schedule.length, PROFILE_COUNT);
  assert.equal(authority.design_basis.phase3_reference_materialisation_skipped, true);

  const fixture = phase4Fixture();
  const phase2Proposal = proxyMeetingAuthoring
    .prepareProxyMeetingPhase2FamilyProposal({
      proxyMeetingAuthoringPhase2Authority:
        fixture.proxyMeetingAuthoringPhase2Authority,
      governedSources: fixture.governedSources,
    });
  const result = proxyMeetingAuthoring
    .prepareProxyMeetingFamilyProfilePackageReview(fixture);

  assertExactKeys(
    result,
    proxyMeetingAuthoring.PROXY_MEETING_PHASE4_REVIEW_OUTPUT_KEYS,
    'Phase4 package review candidate keys',
  );
  assert.equal(
    result.candidate_state,
    'REVIEW_ONLY_31_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY',
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
    complete_profile_count: 31,
    incomplete_profile_count: 0,
    legal_grouping_review_flag_count: 31,
    outside_calibration_example_flag_count: 2,
    proposed_profile_count: 31,
    review_only_profile_count: 31,
    subtype_partition_divergence_flag_count: 27,
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
    assert.equal(profile.package_profile_key.startsWith('PROFILE:PROXY_MEETING:'), true);
    assert.equal(Object.hasOwn(profile, 'work3_profile_id'), false);
  }
});

test('Work3 PROXY_MEETING unapproved inventory review proves validator acceptance without Work3 identity or package approval', () => {
  physicalBytes(WORK3_BINDINGS.inventoryAuthority);
  physicalBytes(WORK3_BINDINGS.packet);
  const evidence = work3Evidence();
  const result = proxyMeetingAuthoring
    .prepareProxyMeetingWork3UnapprovedInventoryReview({
      proxyMeetingWork3UnapprovedInventoryReviewEvidence: {
        work3ProxyMeetingUnapprovedInventoryReviewAuthority:
          evidence.work3ProxyMeetingUnapprovedInventoryReviewAuthority,
      },
      proxyMeetingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'UNAPPROVED_31_PROFILE_INVENTORY_REVIEW_PACKET_ONLY_BEN_APPROVAL_NOT_RECORDED',
  );
  assert.equal(result.inventory_packet_reference.profile_count, PROFILE_COUNT);
  assert.equal(result.validator_acceptance_reference.status, 'PASS');
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 27);
  assert.equal(Object.hasOwn(result, 'family_profile_package_id'), false);
});

test('Work3 PROXY_MEETING Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal', () => {
  physicalBytes(WORK3_BINDINGS.benAuthority);
  physicalBytes(WORK3_BINDINGS.disposition);
  const evidence = work3Evidence();
  const result = proxyMeetingAuthoring
    .prepareProxyMeetingWork3BenInventorySessionDisposition({
      proxyMeetingWork3BenInventorySessionDispositionEvidence: {
        work3ProxyMeetingUnapprovedInventoryReviewAuthority:
          evidence.work3ProxyMeetingUnapprovedInventoryReviewAuthority,
        work3ProxyMeetingBenInventorySessionSuccessorAuthority:
          evidence.work3ProxyMeetingBenInventorySessionSuccessorAuthority,
        inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
        benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      },
      proxyMeetingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(result.disposition_binding.profile_disposition_count, PROFILE_COUNT);
  assert.deepEqual(result.disposition_binding.session_summary, {
    approved_count: 31,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: 31,
    outside_calibration_example_count: 2,
    populated_subtype_bucket_count: 5,
    registered_subtype_bucket_count: 6,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count: 27,
    taxonomy_expansion_acknowledged: true,
  });
  assert.equal(
    result.ben_rulings_binding.path,
    `${CONTROL}/m5-programme-rulings.json`,
  );
  assert.equal(result.review_accounting.work3_identity_count, 0);
  assert.equal(Object.hasOwn(result, 'family_package_seal_id'), false);
});

test('Work3 PROXY_MEETING family package seal captures Ben seal without Work3 identity or premature registration', () => {
  physicalBytes(WORK3_BINDINGS.session);
  physicalBytes(WORK3_BINDINGS.sealAuthority);
  const evidence = work3Evidence();
  const result = proxyMeetingAuthoring.prepareProxyMeetingWork3FamilyPackageSeal({
    proxyMeetingWork3FamilyPackageSealEvidence: {
      work3ProxyMeetingUnapprovedInventoryReviewAuthority:
        evidence.work3ProxyMeetingUnapprovedInventoryReviewAuthority,
      work3ProxyMeetingBenInventorySessionSuccessorAuthority:
        evidence.work3ProxyMeetingBenInventorySessionSuccessorAuthority,
      work3ProxyMeetingFamilyPackageSealSuccessorAuthority:
        evidence.work3ProxyMeetingFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    proxyMeetingPhase4ReviewInput: phase4Fixture(),
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
    27,
  );
  assert.equal(result.next_governance_stop.registration_permitted, false);
});

test('Work3 PROXY_MEETING family package registration binds seal receipt without activation', () => {
  physicalBytes(WORK3_BINDINGS.sealReceipt);
  physicalBytes(WORK3_BINDINGS.registrationAuthority);
  const evidence = work3Evidence();
  const result = proxyMeetingAuthoring
    .prepareProxyMeetingWork3FamilyPackageRegistration({
      proxyMeetingWork3FamilyPackageRegistrationEvidence: evidence,
      proxyMeetingPhase4ReviewInput: phase4Fixture(),
    });

  assert.equal(
    result.candidate_state,
    'BEN_PROXY_MEETING_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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

test('Proxy / Meeting Milestone A inventory packet draft carries shape summaries and honest holds', () => {
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
    27,
  );
  assert.equal(
    packet.profile_review_items.filter(
      (item) => item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
    ).length,
    2,
  );
});

test('Proxy / Meeting Milestone A disposition approves 31 profiles and reuses only sealed M5 rulings', () => {
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

test('Proxy / Meeting Milestone A family profile package on disk validates 31 registered profiles', () => {
  physicalBytes(FAMILY_PROFILE_PACKAGE_BINDING);
  const packageRecord = readRecord(FAMILY_PROFILE_PACKAGE_BINDING.path);
  assert.equal(packageRecord.profiles.length, PROFILE_COUNT);
  assert.equal(
    packageRecord.family_approval.ben_approval_id,
    'BEN_APPROVAL:PROXY_MEETING:PROFILE_SET_V1',
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

  const phase4 = proxyMeetingAuthoring
    .prepareProxyMeetingFamilyProfilePackageReview(phase4Fixture());
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

test('lawful Work3 fixture PROXY_MEETING on-disk override tracks the sealed package bytes', () => {
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
    (entry) => entry.family_key === 'PROXY_MEETING',
  );
  assert.ok(override, 'lawful Work3 fixture has no PROXY_MEETING on-disk override');
  assert.equal(override.binding.path, FAMILY_PROFILE_PACKAGE_BINDING.path);
  for (const field of ['byte_length', 'record_id', 'schema_version', 'sha256']) {
    assert.equal(
      override.binding[field],
      FAMILY_PROFILE_PACKAGE_BINDING[field],
      `lawful Work3 fixture override ${field} is stale`,
    );
  }
});
