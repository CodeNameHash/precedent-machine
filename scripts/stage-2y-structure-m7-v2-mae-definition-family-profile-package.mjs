#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import maeAuthoring from '../lib/canonical-v2/m7-v2-mae-definition-authoring.js';
import {
  validateSingleFamilyPackageInventory,
} from '../lib/canonical-v2/m7-v2-contract.js';
import {
  buildFamilyProfileFixtureClosure,
  lawfulFamilyTemplate,
  loadLawfulFixtureSnapshot,
} from './lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PACKAGE_PATH = `${CONTROL}/m7-v2-repair-family-work3-profile-package-mae-definition.json`;
const WORK3_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PACKAGE_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';

const RULING_ID = 'M5-RULING-ONE-OPERATIVE-LIMB';
const BEN_APPROVAL_ID = 'BEN_APPROVAL:MAE_DEFINITION:PROFILE_SET_V1';
const LEGAL_DECISIONS = [
  BEN_APPROVAL_ID,
  RULING_ID,
  'M5-RULING-ONE-SEMANTIC-OWNER',
  'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
];

const MATCH_TOKENS_BY_SUBTYPE = {
  DEFINITION_INSTANCE: 'familymaedefinition',
  EXCLUSION: 'maeexclusionchangeingaap',
  DISPROPORTIONALITY_CARVEBACK: 'maedisproportionalitycarveback',
  UNDERLYING_CAUSE_RESTORATION: 'maeunderlyingcauserestoration',
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
  parentProfileId,
  matchToken,
}) {
  const profile = cloneProfileTemplate(templateProfile);
  profile.profile_key = packageProfileKey;
  profile.parent_profile_id = parentProfileId;
  profile.subtype_path = [...classificationPath];
  profile.classification_path = [...classificationPath];
  profile.required_expression_signature = requiredExpressionSignature;
  profile.legal_authority_ids = [...LEGAL_DECISIONS].sort();
  profile.fixture_proofs = [];
  profile.match_test = {
    kind: 'SOURCE_TOKEN_SEQUENCE',
    leaf_id: `leaf-${packageProfileKey}`,
    scope: 'EFFECT_SOURCE_SPANS',
    tokens: [matchToken],
  };
  return profile;
}

function buildRegistrationFixture() {
  const phase2Binding = maeAuthoring.MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING;
  const phase2Authority = boundEnvelope(phase2Binding);
  const phase4Binding = {
    path: maeAuthoring.MAE_DEFINITION_PHASE4_AUTHORITY_PATH,
    schema_version: maeAuthoring.MAE_DEFINITION_PHASE4_AUTHORITY_SCHEMA,
    record_id_field:
      'mae_definition_authoring_phase4_family_profile_package_review_authority_id',
    record_id: maeAuthoring.MAE_DEFINITION_PHASE4_AUTHORITY_ID,
    byte_length: maeAuthoring.MAE_DEFINITION_PHASE4_AUTHORITY_BYTES,
    sha256: maeAuthoring.MAE_DEFINITION_PHASE4_AUTHORITY_SHA256,
  };
  const phase4Fixture = {
    maeDefinitionAuthoringPhase4FamilyProfilePackageReviewAuthority:
      boundEnvelope(phase4Binding),
    maeDefinitionAuthoringPhase2Authority: phase2Authority,
    governedSources: governedSources(phase2Authority.record),
  };
  const phase4Review = maeAuthoring.prepareMaeDefinitionFamilyProfilePackageReview(
    phase4Fixture,
  );
  const registrationBindings = {
    benInventory: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-ben-inventory-session-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_mae_definition_ben_inventory_session_successor_authority_id',
      record_id: '1e0bb5e146347af9996d7f6c9383251963d23d8fa6b4cf65cfc1956827ee8fed',
      byte_length: 2717,
      sha256: '10dc754c8582b6bbd71dcec7af18f7cb28f56f6a2552f65350a0702b1d742f33',
    }),
    disposition: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-mae-4-profile-inventory-disposition.json`,
      schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_4_PROFILE_INVENTORY_DISPOSITION/V1',
      record_id_field: 'inventory_disposition_id',
      record_id: '4e2dbc7cf9ce998d06064e8b5f514f2b35afd2d56d3c09d6e902befa375ae6ef',
      byte_length: 1940,
      sha256: 'd5fe4b54e5dcb506ef459cd3aeb082e81bf50c1e18d212b7b2af20757e0d2e04',
    }),
    sessionReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-mae-ben-inventory-session-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_BEN_INVENTORY_SESSION_RECEIPT/V1',
      record_id_field: 'ben_inventory_session_receipt_id',
      record_id: 'a3d4e4ffe4b89c2e2dc1af0d868353fb860ebd45eac93e7e0523eefc1112bc7c',
      byte_length: 1097,
      sha256: 'c9acf50338fbe24cded59f485e59ab983f2392976c01807aea643e93f79377fb',
    }),
    sealAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-family-package-seal-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_mae_definition_family_package_seal_successor_authority_id',
      record_id: 'e9917cb720f2333c8e4669742038492f2c52a69d0e5c95d51eef9e2f258b8a53',
      byte_length: 3219,
      sha256: '3e85694cf56ab11c92ba9873936b6fa2846994326f42c36777d22a3a2fd5d392',
    }),
    sealReceipt: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-mae-definition-family-package-seal-receipt.json`,
      schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
      record_id_field: 'mae_definition_family_package_seal_receipt_id',
      record_id: '4bf42cc155853f29a8ab08d04abc9ab584da3f243e45d9f120316510af2360bd',
      byte_length: 2066,
      sha256: 'cd1c356c808a970d684c6fd4781fdf1abee1b56337ac0a91a21b33ba43739e8e',
    }),
    registrationAuthority: boundEnvelope({
      path:
        `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-registration-successor-authority.json`,
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
      record_id_field: 'work3_mae_definition_registration_successor_authority_id',
      record_id: 'b548686c716f848432b2cdef24d711dbec0fb65cacedb26a9d39caf9098e82fb',
      byte_length: 2831,
      sha256: 'daf7b5d3d9d040fd16d0d09dda4fc47c7c199e867b65e06f39cf5c213e635c58',
    }),
    packetDraft: boundEnvelope({
      path: `${CONTROL}/m7-v2-repair-mae-4-profile-inventory-review-packet-draft.json`,
      schema_version: 'STAGE_2Y_M7_V2_MAE_DEFINITION_4_PROFILE_INVENTORY_REVIEW_PACKET/V1',
      record_id_field: 'inventory_review_packet_id',
      record_id: '274d6c098ce2a1333f22cbabc6a31bebfd92df705aaec44b82125559150ed66b',
      byte_length: 11787,
      sha256: '96ca4e4f55b215ba029e7bca318107c93d1b966ce61249606f6d0da8344ee9b3',
    }),
  };
  const registration = maeAuthoring.prepareMaeDefinitionWork3FamilyPackageRegistration({
    maeDefinitionWork3FamilyPackageRegistrationEvidence: {
      work3MaeDefinitionBenInventorySessionSuccessorAuthority: registrationBindings.benInventory,
      work3MaeDefinitionFamilyPackageSealSuccessorAuthority: registrationBindings.sealAuthority,
      work3MaeDefinitionRegistrationSuccessorAuthority:
        registrationBindings.registrationAuthority,
      inventoryReviewPacketDraft: registrationBindings.packetDraft,
      benAuthoredInventoryDisposition: registrationBindings.disposition,
      benInventorySessionReceipt: registrationBindings.sessionReceipt,
      familyPackageSealReceipt: registrationBindings.sealReceipt,
    },
    maeDefinitionPhase4ReviewInput: phase4Fixture,
  });
  return { phase4Review, registration };
}

function buildPackageRecord() {
  const snapshot = loadLawfulFixtureSnapshot();
  const template = lawfulFamilyTemplate(snapshot, 'MAE_DEFINITION');
  const templateProfile = template.profiles[0];
  const { phase4Review } = buildRegistrationFixture();

  const registrationByKey = new Map(
    phase4Review.proposed_profiles.map((profile) => [
      profile.proposed_profile_key,
      profile,
    ]),
  );

  const profileSpecs = phase4Review.proposed_profiles
    .map((proposed) => {
      const subtype = proposed.canonical_tuple.classification_path[1];
      return {
        packageProfileKey: proposed.package_profile_key,
        classificationPath: [...proposed.canonical_tuple.classification_path],
        requiredExpressionSignature: proposed.canonical_tuple.required_expression_signature,
        subtype,
        proposedProfileKey: proposed.proposed_profile_key,
      };
    })
    .sort((left, right) => left.packageProfileKey.localeCompare(right.packageProfileKey));

  const rootSpec = profileSpecs.find((spec) => spec.subtype === 'DEFINITION_INSTANCE');
  if (!rootSpec) throw new Error('DEFINITION_INSTANCE profile missing from phase4 review');

  const rootProfile = buildProfileFromTemplate(templateProfile, {
    packageProfileKey: rootSpec.packageProfileKey,
    classificationPath: rootSpec.classificationPath,
    requiredExpressionSignature: rootSpec.requiredExpressionSignature,
    parentProfileId: null,
    matchToken: MATCH_TOKENS_BY_SUBTYPE.DEFINITION_INSTANCE,
  });

  const childProfiles = profileSpecs
    .filter((spec) => spec.subtype !== 'DEFINITION_INSTANCE')
    .map((spec) => buildProfileFromTemplate(templateProfile, {
      packageProfileKey: spec.packageProfileKey,
      classificationPath: spec.classificationPath,
      requiredExpressionSignature: spec.requiredExpressionSignature,
      parentProfileId: null,
      matchToken: MATCH_TOKENS_BY_SUBTYPE[spec.subtype],
    }));

  const templateFixtures = template.match_fixtures.map((fixture) => {
    const { match_fixture_id: ignored, ...unsigned } = fixture;
    return sealBoundRecord(fixture.schema_version, 'match_fixture_id', unsigned);
  });
  const closure = buildFamilyProfileFixtureClosure({
    packagePath: PACKAGE_PATH,
    profiles: [rootProfile, ...childProfiles],
    templateProfile,
    templateFixtures,
  });
  const matchFixtures = closure.matchFixtures;
  // The children hang off the root, so the root identity has to be sealed
  // before the children can cite it as their parent.
  rootProfile.fixture_proofs = closure.proofsByProfileKey.get(rootProfile.profile_key);
  sealProfile(rootProfile);
  for (const child of childProfiles) {
    child.fixture_proofs = closure.proofsByProfileKey.get(child.profile_key);
    child.parent_profile_id = rootProfile.profile_id;
    sealProfile(child);
  }

  const profiles = [rootProfile, ...childProfiles].sort((left, right) => (
    left.profile_key < right.profile_key ? -1 : left.profile_key > right.profile_key ? 1
      : left.profile_id < right.profile_id ? -1 : left.profile_id > right.profile_id ? 1 : 0
  ));

  const subtypeTree = sealBoundRecord(SUBTYPE_TREE_SCHEMA, 'subtype_tree_id', {
    family_key: 'MAE_DEFINITION',
    tree_id: 'tree-MAE_DEFINITION',
    profile_set_version: 1,
    completeness_state: 'TREE_OUTPUT_INCOMPLETE',
    nodes: profiles.map((profile) => {
      const parentProfile = profile.parent_profile_id === null
        ? null
        : profiles.find((entry) => entry.profile_id === profile.parent_profile_id);
      const isRoot = profile.parent_profile_id === null;
      const childCount = profiles.filter(
        (entry) => entry.parent_profile_id === profile.profile_id,
      ).length;
      return {
        profile_key: profile.profile_key,
        parent_profile_key: parentProfile?.profile_key ?? null,
        node_state: childCount > 0 ? 'ABSTRACT' : 'TERMINAL_OUTPUT_PERMITTED',
      };
    }),
  });

  const dimensionEvidence = closure.buildDimensionEvidence(
    profiles, template.dimension_evidence[0],
  );

  const inventory = {
    family_key: 'MAE_DEFINITION',
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
      family_key: 'MAE_DEFINITION',
      profile_set_version: 1,
      approver: 'BEN_GOODCHILD',
      approved_on: '2026-08-24',
      approval_text: 'Ben approves the MAE_DEFINITION four-profile Work3 package inventory.',
      approved_inventory_digest: sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8')),
      approved_decision_classes: ['V2_PROFILE_APPROVALS'],
    },
  );

  const packageRecord = sealBoundRecord(
    FAMILY_PACKAGE_SCHEMA,
    'family_profile_package_id',
    {
      state: 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE',
      family_key: 'MAE_DEFINITION',
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
    familyKey: 'MAE_DEFINITION',
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
    byte_length: outputBinding.byte_length,
    sha256: outputBinding.sha256,
    git_blob_oid: outputBinding.git_blob_oid,
    validation_status: validation.status,
  }, null, 2));
}

main();
