#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import guarantyAuthoring from '../lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js';
import {
  validateSingleFamilyPackageInventory,
} from '../lib/canonical-v2/m7-v2-contract.js';
import {
  buildFamilyProfileFixtureClosure,
  lawfulFamilyTemplate,
  loadLawfulFixtureSnapshot,
  profileMatchToken,
} from './lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PACKAGE_PATH = `${CONTROL}/m7-v2-repair-family-work3-profile-package-guaranty-financing-party.json`;
const WORK3_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PACKAGE_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';

const BEN_APPROVAL_ID = 'BEN_APPROVAL:GUARANTY_FINANCING_PARTY:PROFILE_SET_V1';
const LEGAL_DECISIONS = [
  BEN_APPROVAL_ID,
  'M5-RULING-ONE-OPERATIVE-LIMB',
  'M5-RULING-ONE-SEMANTIC-OWNER',
  'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
];

const APPROVAL_TEXT =
  'Ben approves the GUARANTY_FINANCING_PARTY five-profile Work3 package inventory; legal grouping review pending.';

const GUARANTY_PHASE2_AUTHORITY_BINDING = {
  path: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE2_AUTHORITY_PATH,
  schema_version: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'guaranty_financing_party_authoring_phase2_authority_id',
  record_id: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE2_AUTHORITY_ID,
  byte_length: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE2_AUTHORITY_BYTES,
  sha256: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE2_AUTHORITY_SHA256,
};

const GUARANTY_PHASE4_AUTHORITY_BINDING = {
  path: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_PATH,
  schema_version: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'guaranty_financing_party_authoring_phase4_family_profile_package_review_authority_id',
  record_id: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_ID,
  byte_length: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_BYTES,
  sha256: guarantyAuthoring.GUARANTY_FINANCING_PARTY_PHASE4_AUTHORITY_SHA256,
};

function read(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}

function gitBlobOid(bytes) {
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
    bytes,
  ])).digest('hex');
}

function sealBoundRecord(schema, idField, body) {
  const unsigned = { schema_version: schema, ...body };
  return { ...unsigned, [idField]: contentId(schema, unsigned) };
}

function binding(path, record, idField) {
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    byte_length: bytes.length,
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function envelope(path, idField) {
  const record = read(path);
  return { binding: binding(path, record, idField), record };
}

function boundEnvelope(sourceBinding) {
  return { binding: structuredClone(sourceBinding), record: read(sourceBinding.path) };
}

function governedSources(authority) {
  const parents = authority.immutable_parent_bindings;
  const agreementEvidenceByAgreementId = Object.fromEntries(
    parents.m2_m3_m4.map((entry) => [entry.agreement_id, {
      canonicalTextIdentity: {
        canonical_text_id: entry.canonical_text_id,
        canonical_text_byte_length: entry.canonical_text_byte_length,
        canonical_text_sha256: entry.canonical_text_sha256,
      },
      m2: boundEnvelope(entry.m2),
      m3: boundEnvelope(entry.m3),
      m4: boundEnvelope(entry.m4),
    }]),
  );
  return {
    baseContractPolicy: boundEnvelope(parents.base_policy),
    temporalPhase1Authority: boundEnvelope(parents.phase1),
    c3CorrectionAuthority: boundEnvelope(parents.c3),
    work3Manifest: boundEnvelope(parents.work3_manifest),
    familyRolePolicy: boundEnvelope(parents.family_role_policy),
    calibrationPack: boundEnvelope(parents.calibration_pack),
    agreementEvidenceByAgreementId,
  };
}

function cloneProfileTemplate(templateProfile) {
  return structuredClone(templateProfile);
}

function sealProfile(profile) {
  const unsigned = { ...profile };
  delete unsigned.schema_version;
  delete unsigned.profile_id;
  profile.profile_id = contentId(FAMILY_PROFILE_SCHEMA, unsigned);
  return profile;
}

function buildProfileFromTemplate(templateProfile, {
  packageProfileKey,
  classificationPath,
  requiredExpressionSignature,
}) {
  const profile = cloneProfileTemplate(templateProfile);
  profile.profile_key = packageProfileKey;
  profile.parent_profile_id = null;
  profile.subtype_path = [...classificationPath];
  profile.classification_path = [...classificationPath];
  profile.required_expression_signature = requiredExpressionSignature;
  profile.legal_authority_ids = [...LEGAL_DECISIONS].sort();
  profile.fixture_proofs = [];
  profile.shared_source_lawyer_decision_ids = [];
  profile.match_test = {
    kind: 'SOURCE_TOKEN_SEQUENCE',
    leaf_id: `leaf-${packageProfileKey}`,
    scope: 'EFFECT_SOURCE_SPANS',
    tokens: [
      'familyguarantyfinancingparty',
      profileMatchToken(requiredExpressionSignature),
    ],
  };
  return profile;
}

function buildRegistrationFixture() {
  const phase2Authority = boundEnvelope(GUARANTY_PHASE2_AUTHORITY_BINDING);
  const phase4Fixture = {
    guarantyFinancingPartyAuthoringPhase4FamilyProfilePackageReviewAuthority:
      boundEnvelope(GUARANTY_PHASE4_AUTHORITY_BINDING),
    guarantyFinancingPartyAuthoringPhase2Authority: phase2Authority,
    governedSources: governedSources(phase2Authority.record),
  };
  const phase4Review = guarantyAuthoring.prepareGuarantyFinancingPartyFamilyProfilePackageReview(
    phase4Fixture,
  );
  const registrationBindings = {
    inventoryAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-guaranty-financing-party-unapproved-inventory-review-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
      record_id_field: 'work3_guaranty_financing_party_unapproved_inventory_review_authority_id',
      record_id: '5fc7252784bee6ed734d90282f1e1c4639d612b1f76381595048bb29810886a8',
      byte_length: 2092,
      sha256: 'b59c91d71e174eecf25efb04dedc21ab1af8f29fe98ab1b927ce74c5d942a956',
    }),
    benInventory: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-guaranty-financing-party-ben-inventory-session-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_guaranty_financing_party_ben_inventory_session_successor_authority_id',
      record_id: '3819888b052e59de76520db8839205040bd85cf86e32435b4c3ba97d295d0cea',
      byte_length: 2851,
      sha256: 'd1c1a277aeb7321934aae16a51fb47f4877074044806ffbf2d24d6cec79c819a',
    }),
    disposition: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-guaranty-5-profile-inventory-disposition.json`,
      schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_5_PROFILE_INVENTORY_DISPOSITION/V1',
      record_id_field: 'inventory_disposition_id',
      record_id: 'b92987487b2803a0026901f590324e3899c64b35a29a738c681cd535d1b4d417',
      byte_length: 1925,
      sha256: 'b80f95de50d877889528b802199f0d6844a5a66ac6218b15fb41a0aa1723fdad',
    }),
    sessionReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-guaranty-ben-inventory-session-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_BEN_INVENTORY_SESSION_RECEIPT/V1',
      record_id_field: 'ben_inventory_session_receipt_id',
      record_id: 'cbfd98f2a0bab840c4a628f8b58d649e9992d10f89d81ec639806a5faf5ea307',
      byte_length: 1127,
      sha256: '2f5c724c93863bff83c3c59f9e8df7ae44db81215bd4da5fb16062c9cbe3c056',
    }),
    sealAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-guaranty-financing-party-family-package-seal-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_guaranty_financing_party_family_package_seal_successor_authority_id',
      record_id: '0dd1e37fa8a30d024ac310f0a05e88597a266a5ee858cdc69750e09630dafe5e',
      byte_length: 3388,
      sha256: 'b80c82b25904597cdb9899ac17e8680c7fdeb6ab50899c679b141b032813ec35',
    }),
    sealReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-guaranty-financing-party-family-package-seal-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
      record_id_field: 'guaranty_financing_party_family_package_seal_receipt_id',
      record_id: 'ce34d6ad583392c284415b6cb5823c9b0a0b487ea5a7010f2cb8060c3376f8ed',
      byte_length: 2436,
      sha256: 'cf8681de66e3e64c5d072c9364dc1b3480f44f53fb3c6953cbcc3c071fe7eba0',
    }),
    registrationAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-guaranty-financing-party-registration-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GUARANTY_FINANCING_PARTY_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_guaranty_financing_party_registration_successor_authority_id',
      record_id: '6e76c084a0558e5c359cd9931715aecc956f706d2696fef6bec6d91c9e4bd317',
      byte_length: 3004,
      sha256: '6f4f3fe42e537275d64c0637a7796aad95b502e7b1f54aeee96ab2165c19f464',
    }),
    packetDraft: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-guaranty-5-profile-inventory-review-packet-draft.json`,
      schema_version: 'STAGE_2Y_M7_V2_GUARANTY_FINANCING_PARTY_5_PROFILE_INVENTORY_REVIEW_PACKET/V1',
      record_id_field: 'inventory_review_packet_id',
      record_id: '73311137535798eb3d396e2ef6742824d768541498fe57de4852bfe152b2711a',
      byte_length: 4819,
      sha256: '8849f940433d4db158307f245a169a85ff3338eb0b5e8c83866545f5b9f65dde',
    }),
  };
  const registration = guarantyAuthoring.prepareGuarantyFinancingPartyWork3FamilyPackageRegistration({
    guarantyFinancingPartyWork3FamilyPackageRegistrationEvidence: {
      work3GuarantyFinancingPartyUnapprovedInventoryReviewAuthority:
        registrationBindings.inventoryAuthority,
      work3GuarantyFinancingPartyBenInventorySessionSuccessorAuthority:
        registrationBindings.benInventory,
      work3GuarantyFinancingPartyFamilyPackageSealSuccessorAuthority:
        registrationBindings.sealAuthority,
      work3GuarantyFinancingPartyRegistrationSuccessorAuthority:
        registrationBindings.registrationAuthority,
      inventoryReviewPacketDraft: registrationBindings.packetDraft,
      benAuthoredInventoryDisposition: registrationBindings.disposition,
      benInventorySessionReceipt: registrationBindings.sessionReceipt,
      familyPackageSealReceipt: registrationBindings.sealReceipt,
    },
    guarantyFinancingPartyPhase4ReviewInput: phase4Fixture,
  });
  return { phase4Review, registration, phase4Fixture };
}

function buildPackageRecord() {
  const snapshot = loadLawfulFixtureSnapshot();
  const template = lawfulFamilyTemplate(snapshot, 'GUARANTY_FINANCING_PARTY');
  const templateProfile = template.profiles.find(
    (profile) => profile.parent_profile_id === null,
  ) ?? template.profiles[0];
  const { phase4Review } = buildRegistrationFixture();

  const profileSpecs = phase4Review.proposed_profiles
    .map((proposed) => ({
      packageProfileKey: proposed.package_profile_key,
      classificationPath: [...proposed.canonical_tuple.classification_path],
      requiredExpressionSignature: proposed.canonical_tuple.required_expression_signature,
      proposedProfileKey: proposed.proposed_profile_key,
      m4ClaimCount: proposed.m4_claim_ids.length,
      reviewFlags: [...proposed.review_flags],
    }))
    .sort((left, right) => left.packageProfileKey.localeCompare(right.packageProfileKey));

  const anchorSpec = profileSpecs.find((spec) => spec.m4ClaimCount === 1);
  if (!anchorSpec) {
    throw new Error('phase4 review missing Skechers-governed profile with one M4 claim');
  }

  const profiles = profileSpecs.map((spec) => buildProfileFromTemplate(templateProfile, {
    packageProfileKey: spec.packageProfileKey,
    classificationPath: spec.classificationPath,
    requiredExpressionSignature: spec.requiredExpressionSignature,
  }));

  const templateFixtures = template.match_fixtures.map((fixture) => {
    const { match_fixture_id: ignored, ...unsigned } = fixture;
    return sealBoundRecord(fixture.schema_version, 'match_fixture_id', unsigned);
  });
  const closure = buildFamilyProfileFixtureClosure({
    packagePath: PACKAGE_PATH,
    profiles,
    templateProfile,
    templateFixtures,
  });
  const matchFixtures = closure.matchFixtures;
  for (const profile of profiles) {
    profile.fixture_proofs = closure.proofsByProfileKey.get(profile.profile_key);
    sealProfile(profile);
  }
  profiles.sort((left, right) => (
    left.profile_key < right.profile_key ? -1 : left.profile_key > right.profile_key ? 1
      : left.profile_id < right.profile_id ? -1 : left.profile_id > right.profile_id ? 1 : 0
  ));

  const subtypeTree = sealBoundRecord(SUBTYPE_TREE_SCHEMA, 'subtype_tree_id', {
    family_key: 'GUARANTY_FINANCING_PARTY',
    tree_id: 'tree-GUARANTY_FINANCING_PARTY',
    profile_set_version: 1,
    completeness_state: 'TREE_OUTPUT_INCOMPLETE',
    nodes: profiles.map((profile) => ({
      profile_key: profile.profile_key,
      parent_profile_key: null,
      node_state: 'TERMINAL_OUTPUT_PERMITTED',
    })),
  });

  const dimensionEvidence = closure.buildDimensionEvidence(
    profiles, template.dimension_evidence[0],
  );

  const inventory = {
    family_key: 'GUARANTY_FINANCING_PARTY',
    profile_set_version: 1,
    legal_decisions: [...LEGAL_DECISIONS].sort(),
    profile_ids: profiles.map((profile) => profile.profile_id),
    subtype_tree_id: subtypeTree.subtype_tree_id,
    match_fixture_record_ids: matchFixtures.map((fixture) => fixture.match_fixture_id),
    dimension_evidence_ids: dimensionEvidence.map((evidence) => evidence.dimension_evidence_id),
    structure_fixture_ids: [],
  };

  const familyApproval = sealBoundRecord(
    FAMILY_PACKAGE_APPROVAL_SCHEMA,
    'family_approval_id',
    {
      ben_approval_id: BEN_APPROVAL_ID,
      family_key: 'GUARANTY_FINANCING_PARTY',
      profile_set_version: 1,
      approver: 'BEN_GOODCHILD',
      approved_on: '2026-08-24',
      approval_text: APPROVAL_TEXT,
      approved_inventory_digest: sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8')),
      approved_decision_classes: ['V2_PROFILE_APPROVALS'],
    },
  );

  const packageRecord = sealBoundRecord(
    FAMILY_PACKAGE_SCHEMA,
    'family_profile_package_id',
    {
      state: 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE',
      family_key: 'GUARANTY_FINANCING_PARTY',
      profile_set_version: 1,
      family_approval: familyApproval,
      legal_decisions: inventory.legal_decisions,
      profiles,
      subtype_tree: subtypeTree,
      match_fixtures: matchFixtures,
      dimension_evidence: dimensionEvidence,
      structure_fixture_members: [],
    },
  );

  return { packageRecord, inventory };
}

function main() {
  const { packageRecord, inventory } = buildPackageRecord();
  const work3Authority = read(WORK3_AUTHORITY_PATH);

  const validation = validateSingleFamilyPackageInventory({
    work3Authority,
    familyKey: 'GUARANTY_FINANCING_PARTY',
    profileSetVersion: 1,
    benApprovalId: BEN_APPROVAL_ID,
    legalDecisions: inventory.legal_decisions,
    members: {
      profiles: packageRecord.profiles,
      subtype_tree: packageRecord.subtype_tree,
      match_fixtures: packageRecord.match_fixtures,
      dimension_evidence: packageRecord.dimension_evidence,
      structure_fixture_members: packageRecord.structure_fixture_members,
    },
    memberInventory: inventory,
    inventoryFingerprint: packageRecord.family_approval.approved_inventory_digest,
  });

  if (validation.status !== 'FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING') {
    throw new Error(`unexpected validation status: ${validation.status}`);
  }

  const bytes = Buffer.from(`${canonicalJson(packageRecord)}\n`, 'utf8');
  const outputPath = join(REPO_ROOT, PACKAGE_PATH);
  writeFileSync(outputPath, bytes);

  const outputBinding = binding(PACKAGE_PATH, packageRecord, 'family_profile_package_id');
  console.log(JSON.stringify({
    path: PACKAGE_PATH,
    family_profile_package_id: packageRecord.family_profile_package_id,
    profile_count: packageRecord.profiles.length,
    approve_count: 5,
    legal_grouping_pending_count: 5,
    byte_length: outputBinding.byte_length,
    sha256: outputBinding.sha256,
    git_blob_oid: outputBinding.git_blob_oid,
    validation_status: validation.status,
  }, null, 2));
}

main();
