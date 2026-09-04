#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import dnoAuthoring from '../lib/canonical-v2/m7-v2-dno-indemnification-authoring.js';
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
const PACKAGE_PATH = `${CONTROL}/m7-v2-repair-family-work3-profile-package-dno-indemnification.json`;
export const ITEM42_SUCCESSOR_PACKAGE_PATH =
  `${CONTROL}/m7-v2-repair-family-work3-profile-package-dno-indemnification-item-42-successor-2026-09-01.json`;
const WORK3_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PACKAGE_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';

const BEN_APPROVAL_ID = 'BEN_APPROVAL:DNO_INDEMNIFICATION:PROFILE_SET_V1';
const ITEM42_PROFILE_KEYS = [
  'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
  'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
];
const PROFILE_LEGAL_AUTHORITIES = [
  BEN_APPROVAL_ID,
  'M5-RULING-ONE-OPERATIVE-LIMB',
  'M5-RULING-ONE-SEMANTIC-OWNER',
  'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
];
const ITEM42_SUCCESSOR_LEGAL_DECISIONS = [
  ...PROFILE_LEGAL_AUTHORITIES,
  'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
];

const DNO_PHASE2_AUTHORITY_BINDING = {
  path: `${CONTROL}/m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json`,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'dno_indemnification_authoring_phase2_authority_id',
  record_id: '37573af1b980fb772fdafef7ec1001c6edc2370c05de3d12cf9bece01b76886e',
  byte_length: 79707,
  sha256: '435dafee043efa0290e68e919be9351b7907fe271ad3b0307bef31182e21ee96',
};

const DNO_PHASE4_AUTHORITY_BINDING = {
  path:
    `${CONTROL}/m7-v2-repair-contract-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json`,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
  record_id_field:
    'dno_indemnification_authoring_phase4_family_profile_package_review_authority_id',
  record_id: '6deefbb6f76c9e4528c7cc281fd76cc6b1aea6cb85b00b79d574cc464c8a3ee5',
  byte_length: 35019,
  sha256: '5f89d018f68826bebee47be4971f0aed02356b8c69049d12eedb91d8d2bcdce7',
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
  profile.legal_authority_ids = [...PROFILE_LEGAL_AUTHORITIES].sort();
  profile.fixture_proofs = [];
  profile.shared_source_lawyer_decision_ids = [];
  profile.match_test = {
    kind: 'SOURCE_TOKEN_SEQUENCE',
    leaf_id: `leaf-${packageProfileKey}`,
    scope: 'EFFECT_SOURCE_SPANS',
    tokens: ['familydnoindemnification', profileMatchToken(requiredExpressionSignature)],
  };
  return profile;
}

function buildItem42Profile(templateProfile) {
  const profile = cloneProfileTemplate(templateProfile);
  profile.parent_profile_id = null;
  profile.fixture_proofs = [];
  return profile;
}

function buildRegistrationFixture() {
  const phase2Authority = boundEnvelope(DNO_PHASE2_AUTHORITY_BINDING);
  const phase4Fixture = {
    dnoIndemnificationAuthoringPhase4FamilyProfilePackageReviewAuthority:
      boundEnvelope(DNO_PHASE4_AUTHORITY_BINDING),
    dnoIndemnificationAuthoringPhase2Authority: phase2Authority,
    governedSources: governedSources(phase2Authority.record),
  };
  const phase4Review = dnoAuthoring.prepareDnoIndemnificationFamilyProfilePackageReview(
    phase4Fixture,
  );
  const registrationBindings = {
    benInventory: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-ben-inventory-session-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_dno_indemnification_ben_inventory_session_successor_authority_id',
      record_id: '4fc9371172caa3ca648267d9d8098343c7c3b702499f7d16f06e7eea6679ccbc',
      byte_length: 2787,
      sha256: '69463cc14e20f5c54de688aacd26b436020f4aaaff499c84dae12dab817c8725',
    }),
    disposition: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-dno-31-profile-inventory-disposition.json`,
      schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_31_PROFILE_INVENTORY_DISPOSITION/V1',
      record_id_field: 'inventory_disposition_id',
      record_id: '8ccad1f245ba2fdd17db762fcda4c722ae87728e95b900acb07e6a1bc39009a9',
      byte_length: 7519,
      sha256: '25b59845b4e12f0e59fc782db89252ec40eb90e3c5ee85f182acdc79eee816cd',
    }),
    sessionReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-dno-ben-inventory-session-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_BEN_INVENTORY_SESSION_RECEIPT/V1',
      record_id_field: 'ben_inventory_session_receipt_id',
      record_id: '2724ed20e0f3c9fc4a760cd633d21904f11f9278065c9d058bd5f9c2a282c83e',
      byte_length: 1110,
      sha256: '31416a526ede14105efe3e3c0add8598eb372ddadcce8046c1ea59e097345399',
    }),
    sealAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-family-package-seal-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_dno_indemnification_family_package_seal_successor_authority_id',
      record_id: '3e667bb204322f39a0af0b40bc8949a519159eb342d2daa6f10d0e1aa15b4298',
      byte_length: 3302,
      sha256: '533549187d9053dd009e3ecdc11fb4764eddbf9b1e5bd5483dc3d07e3164db52',
    }),
    sealReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-dno-indemnification-family-package-seal-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
      record_id_field: 'dno_indemnification_family_package_seal_receipt_id',
      record_id: '245c5274a39a0f4ebbd811b9ca0c8efda715880d8fdfe7665ccbd2cb40908811',
      byte_length: 2067,
      sha256: '4f6b831e72617c9b6ff3d68a4c225914042ffb529bc46ac1cc06e8ed4ed89735',
    }),
    registrationAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-registration-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_dno_indemnification_registration_successor_authority_id',
      record_id: '1e0ff2a2002a848e27cccd3e62e7b08d96dfa490a1a607f223c1d10e5daf3b7c',
      byte_length: 2926,
      sha256: 'c9ef7402519e55d28b472d2ded01ef492bf24be37bfa0ed33469d14f9f32c88a',
    }),
    packetDraft: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-dno-31-profile-inventory-review-packet-draft.json`,
      schema_version: 'STAGE_2Y_M7_V2_DNO_INDEMNIFICATION_31_PROFILE_INVENTORY_REVIEW_PACKET/V1',
      record_id_field: 'inventory_review_packet_id',
      record_id: 'c807c7c53d1077299cca9002384d9ed24aee851d1cc7af1d9211b473e0a6bc36',
      byte_length: 20022,
      sha256: 'aef0f854f4add5388ab92f9d3a40307c9e0eaf4d8abaae7fe8b47181e285746c',
    }),
    inventoryAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-unapproved-inventory-review-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DNO_INDEMNIFICATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
      record_id_field: 'work3_dno_indemnification_unapproved_inventory_review_authority_id',
      record_id: '864a8bdd54537aae0633bae6399d745fd94978977ddc38d58c581fff26b8fae8',
      byte_length: 2038,
      sha256: 'bee96fa021b4fcb3dd293bfc98119b809c9680fed0066459ad6cda506a1c564a',
    }),
  };
  const registration = dnoAuthoring.prepareDnoIndemnificationWork3FamilyPackageRegistration({
    dnoIndemnificationWork3FamilyPackageRegistrationEvidence: {
      work3DnoIndemnificationUnapprovedInventoryReviewAuthority:
        registrationBindings.inventoryAuthority,
      work3DnoIndemnificationBenInventorySessionSuccessorAuthority:
        registrationBindings.benInventory,
      work3DnoIndemnificationFamilyPackageSealSuccessorAuthority:
        registrationBindings.sealAuthority,
      work3DnoIndemnificationRegistrationSuccessorAuthority:
        registrationBindings.registrationAuthority,
      inventoryReviewPacketDraft: registrationBindings.packetDraft,
      benAuthoredInventoryDisposition: registrationBindings.disposition,
      benInventorySessionReceipt: registrationBindings.sessionReceipt,
      familyPackageSealReceipt: registrationBindings.sealReceipt,
    },
    dnoIndemnificationPhase4ReviewInput: phase4Fixture,
  });
  return { phase4Review, registration, phase4Fixture };
}

// The root evidence record supplies the source class and ruling used by the
// generated per-profile records. The two item-42 profiles carry their own
// lawful-fixture field shapes and therefore generate their own exact fixtures.
function rootDimensionEvidenceTemplate(template, templateProfile) {
  const rootEvidence = template.dimension_evidence.find(
    (evidence) => evidence.profile_id === templateProfile.profile_id,
  );
  if (rootEvidence === undefined) {
    throw new Error('lawful fixture has no DNO_INDEMNIFICATION root-profile dimension evidence');
  }
  return rootEvidence;
}

export function buildPackageRecord({ item42Successor = false } = {}) {
  const packagePath = item42Successor ? ITEM42_SUCCESSOR_PACKAGE_PATH : PACKAGE_PATH;
  const snapshot = loadLawfulFixtureSnapshot();
  const template = lawfulFamilyTemplate(snapshot, 'DNO_INDEMNIFICATION');
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
      reviewFlags: [...proposed.review_flags],
    }))
    .sort((left, right) => left.packageProfileKey.localeCompare(right.packageProfileKey));

  const item42TemplateProfiles = item42Successor
    ? ITEM42_PROFILE_KEYS.map((profileKey) => {
      const profile = template.profiles.find((entry) => entry.profile_key === profileKey);
      if (profile === undefined) {
        throw new Error(`lawful fixture has no ${profileKey} profile`);
      }
      return profile;
    })
    : [];

  const profiles = [
    ...profileSpecs.map((spec) => buildProfileFromTemplate(templateProfile, {
      packageProfileKey: spec.packageProfileKey,
      classificationPath: spec.classificationPath,
      requiredExpressionSignature: spec.requiredExpressionSignature,
    })),
    ...item42TemplateProfiles.map(buildItem42Profile),
  ];

  const templateFixtures = template.match_fixtures.map((fixture) => {
    const { match_fixture_id: ignored, ...unsigned } = fixture;
    return sealBoundRecord(fixture.schema_version, 'match_fixture_id', unsigned);
  });
  const closure = buildFamilyProfileFixtureClosure({
    packagePath,
    profiles,
    templateProfile,
    specialisedTemplateProfiles: item42TemplateProfiles,
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
    family_key: 'DNO_INDEMNIFICATION',
    tree_id: 'tree-DNO_INDEMNIFICATION',
    profile_set_version: 1,
    completeness_state: 'TREE_OUTPUT_INCOMPLETE',
    nodes: profiles.map((profile) => ({
      profile_key: profile.profile_key,
      parent_profile_key: null,
      node_state: 'TERMINAL_OUTPUT_PERMITTED',
    })),
  });

  const dimensionEvidence = closure.buildDimensionEvidence(
    profiles, rootDimensionEvidenceTemplate(template, templateProfile),
  );

  const inventory = {
    family_key: 'DNO_INDEMNIFICATION',
    profile_set_version: 1,
    legal_decisions: [...(item42Successor
      ? ITEM42_SUCCESSOR_LEGAL_DECISIONS
      : PROFILE_LEGAL_AUTHORITIES)].sort(),
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
      family_key: 'DNO_INDEMNIFICATION',
      profile_set_version: 1,
      approver: 'BEN_GOODCHILD',
      approved_on: item42Successor ? '2026-09-01' : '2026-08-24',
      approval_text: item42Successor
        ? 'Ben approves the DNO_INDEMNIFICATION 33-profile Work3 successor package inventory (33 APPROVE, 0 HOLD) after applying dno-item-42-linked-duty-blocker-b.'
        : 'Ben approves the DNO_INDEMNIFICATION 31-profile Work3 package inventory (26 APPROVE, 5 HOLD).',
      approved_inventory_digest: sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8')),
      approved_decision_classes: ['V2_PROFILE_APPROVALS'],
    },
  );

  const packageRecord = sealBoundRecord(
    FAMILY_PACKAGE_SCHEMA,
    'family_profile_package_id',
    {
      state: 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE',
      family_key: 'DNO_INDEMNIFICATION',
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

  return { packagePath, packageRecord, inventory };
}

export function generateDnoIndemnificationFamilyProfilePackage(options = {}) {
  const { packagePath, packageRecord, inventory } = buildPackageRecord(options);
  const work3Authority = read(WORK3_AUTHORITY_PATH);

  const validation = validateSingleFamilyPackageInventory({
    work3Authority,
    familyKey: 'DNO_INDEMNIFICATION',
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
  const outputPath = join(REPO_ROOT, packagePath);
  if (options.write ?? true) writeFileSync(outputPath, bytes);

  const outputBinding = binding(packagePath, packageRecord, 'family_profile_package_id');
  const item42Successor = options.item42Successor ?? false;
  console.log(JSON.stringify({
    path: packagePath,
    family_profile_package_id: packageRecord.family_profile_package_id,
    profile_count: packageRecord.profiles.length,
    approve_count: item42Successor ? 33 : 26,
    hold_count: item42Successor ? 0 : 5,
    byte_length: outputBinding.byte_length,
    sha256: outputBinding.sha256,
    git_blob_oid: outputBinding.git_blob_oid,
    validation_status: validation.status,
  }, null, 2));
  return { packagePath, packageRecord, inventory, outputBinding, bytes };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  generateDnoIndemnificationFamilyProfilePackage();
}
