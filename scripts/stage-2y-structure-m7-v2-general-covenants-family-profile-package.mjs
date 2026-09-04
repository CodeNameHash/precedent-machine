#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import gcAuthoring from '../lib/canonical-v2/m7-v2-general-covenants-authoring.js';
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
const PACKAGE_PATH = `${CONTROL}/m7-v2-repair-family-work3-profile-package-general-covenants.json`;
const WORK3_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PACKAGE_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';

const BEN_APPROVAL_ID = 'BEN_APPROVAL:GENERAL_COVENANTS:PROFILE_SET_V1';
const LEGAL_DECISIONS = [
  BEN_APPROVAL_ID,
  'M5-RULING-ONE-OPERATIVE-LIMB',
  'M5-RULING-ONE-SEMANTIC-OWNER',
  'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
];

const GC_PHASE2_AUTHORITY_BINDING = {
  path: `${CONTROL}/m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v2.json`,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_GENERAL_COVENANTS_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'general_covenants_authoring_phase2_authority_id',
  record_id: 'a265c3bff03b7dcadc9da15812f2957c0bf41a0a2633be05afa1319e1c7dcd39',
  byte_length: 113323,
  sha256: 'f8aa0e233e74d736440908851bc51a611dee30ad1d93e6a8ed52577723b6e398',
};

const GC_PHASE4_AUTHORITY_BINDING = {
  path:
    `${CONTROL}/m7-v2-repair-contract-general-covenants-authoring-phase4-family-profile-package-review-authority.json`,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_GENERAL_COVENANTS_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
  record_id_field:
    'general_covenants_authoring_phase4_family_profile_package_review_authority_id',
  record_id: 'a429d7e26e6a6c521c7882684295b1696195cc1c630332c0f1451b2f352fc401',
  byte_length: 55131,
  sha256: '31d066474b7c755f23ab070b601923da813d2477f167c07f686911d75be3f69a',
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
    tokens: ['familygeneralcovenants', profileMatchToken(requiredExpressionSignature)],
  };
  return profile;
}

function buildRegistrationFixture() {
  const phase2Authority = boundEnvelope(GC_PHASE2_AUTHORITY_BINDING);
  const phase4Fixture = {
    generalCovenantsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      boundEnvelope(GC_PHASE4_AUTHORITY_BINDING),
    generalCovenantsAuthoringPhase2Authority: phase2Authority,
    governedSources: governedSources(phase2Authority.record),
  };
  const phase4Review = gcAuthoring.prepareGeneralCovenantsFamilyProfilePackageReview(
    phase4Fixture,
  );
  const registrationBindings = {
    benInventory: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-general-covenants-ben-inventory-session-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_general_covenants_ben_inventory_session_successor_authority_id',
      record_id: '7e2269feaa12fe62bc66b79ea7ee8c05c73b3632ea1403fbb210057582620a87',
      byte_length: 2789,
      sha256: 'a77ac7efcc58d2748a8a6412edf055d28ea520a4e814dd5b1b2adc6c97cc2f71',
    }),
    disposition: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-general-covenants-54-profile-inventory-disposition.json`,
      schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_54_PROFILE_INVENTORY_DISPOSITION/V1',
      record_id_field: 'inventory_disposition_id',
      record_id: '06c0cf6fa6ba1663af1f22a05f6f8150166a8a70ddba4c2ee3952fa97505232d',
      byte_length: 11872,
      sha256: '40192d483464f4d594817c84141d88b2ca787576c896135dad4fbba13cfc3fae',
    }),
    sessionReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-general-covenants-ben-inventory-session-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_BEN_INVENTORY_SESSION_RECEIPT/V1',
      record_id_field: 'ben_inventory_session_receipt_id',
      record_id: 'a417680bb95ed58a858eff2ff86f75004a76a3f16446592f426498433b42b63f',
      byte_length: 1134,
      sha256: 'fe11e75f24f8ca60d2abd53d1143ad810a2333d95f0e6ff2faba27a67d8a60bc',
    }),
    sealAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-general-covenants-family-package-seal-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_general_covenants_family_package_seal_successor_authority_id',
      record_id: '7329318d9933667923ac0a75a047ed44b106fca69d7f11e449078e26558e7c84',
      byte_length: 3313,
      sha256: '0ba865183ddd58f994f0ff9cc44fdca34c153c6016ea744dc919532ab85ba836',
    }),
    sealReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-general-covenants-family-package-seal-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
      record_id_field: 'general_covenants_family_package_seal_receipt_id',
      record_id: '8ea713512fb1f1391d73cccae64fe4cccf18c7ce693b7acbb79bbd4016acae9f',
      byte_length: 2118,
      sha256: 'd5eb545944fb888d163c313ad5bea4744e58abd821b18e649f9b6de73ec9393f',
    }),
    registrationAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-general-covenants-registration-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_general_covenants_registration_successor_authority_id',
      record_id: '1cf99f145c5ce54884f1d05ebad9badb27d248cd5c405e6b3b8235ad538552a0',
      byte_length: 2890,
      sha256: 'fe8bd00c3f42ab79446724ef59ff233b3ce2d09e0d538505765c648747d95714',
    }),
    packetDraft: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-general-covenants-54-profile-inventory-review-packet-draft.json`,
      schema_version: 'STAGE_2Y_M7_V2_GENERAL_COVENANTS_54_PROFILE_INVENTORY_REVIEW_PACKET/V1',
      record_id_field: 'inventory_review_packet_id',
      record_id: 'd9a144126174d9eec0e7cec1862187ad058ea81905430f522a7609600517c303',
      byte_length: 51977,
      sha256: '32d66a6208266e63475a1b0982f5bbc8f1144ff417c02335e9a6e266f5538224',
    }),
    inventoryAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-general-covenants-unapproved-inventory-review-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GENERAL_COVENANTS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
      record_id_field: 'work3_general_covenants_unapproved_inventory_review_authority_id',
      record_id: '5cf8d088c1e99fa2396a1eb65c095068eec4737b16d5623dbe5d375b17290bc7',
      byte_length: 2014,
      sha256: '8284374b317888fcefbde7399ef7fcfd65a3fa814067a6f30d3d27d27fffc509',
    }),
  };
  const registration = gcAuthoring.prepareGeneralCovenantsWork3FamilyPackageRegistration({
    generalCovenantsWork3FamilyPackageRegistrationEvidence: {
      work3GeneralCovenantsUnapprovedInventoryReviewAuthority:
        registrationBindings.inventoryAuthority,
      work3GeneralCovenantsBenInventorySessionSuccessorAuthority:
        registrationBindings.benInventory,
      work3GeneralCovenantsFamilyPackageSealSuccessorAuthority:
        registrationBindings.sealAuthority,
      work3GeneralCovenantsRegistrationSuccessorAuthority:
        registrationBindings.registrationAuthority,
      inventoryReviewPacketDraft: registrationBindings.packetDraft,
      benAuthoredInventoryDisposition: registrationBindings.disposition,
      benInventorySessionReceipt: registrationBindings.sessionReceipt,
      familyPackageSealReceipt: registrationBindings.sealReceipt,
    },
    generalCovenantsPhase4ReviewInput: phase4Fixture,
  });
  return { phase4Review, registration, phase4Fixture };
}

function buildPackageRecord() {
  const snapshot = loadLawfulFixtureSnapshot();
  const template = lawfulFamilyTemplate(snapshot, 'GENERAL_COVENANTS');
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
    family_key: 'GENERAL_COVENANTS',
    tree_id: 'tree-GENERAL_COVENANTS',
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
    family_key: 'GENERAL_COVENANTS',
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
      family_key: 'GENERAL_COVENANTS',
      profile_set_version: 1,
      approver: 'BEN_GOODCHILD',
      approved_on: '2026-08-24',
      approval_text:
        'Ben approves the GENERAL_COVENANTS 54-profile Work3 package inventory (54 APPROVE).',
      approved_inventory_digest: sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8')),
      approved_decision_classes: ['V2_PROFILE_APPROVALS'],
    },
  );

  const packageRecord = sealBoundRecord(
    FAMILY_PACKAGE_SCHEMA,
    'family_profile_package_id',
    {
      state: 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE',
      family_key: 'GENERAL_COVENANTS',
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
    familyKey: 'GENERAL_COVENANTS',
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
    approve_count: 54,
    hold_count: 0,
    byte_length: outputBinding.byte_length,
    sha256: outputBinding.sha256,
    git_blob_oid: outputBinding.git_blob_oid,
    validation_status: validation.status,
  }, null, 2));
}

main();
