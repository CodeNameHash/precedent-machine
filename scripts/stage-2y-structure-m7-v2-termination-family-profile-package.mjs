#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
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
const PACKAGE_PATH = `${CONTROL}/m7-v2-repair-family-work3-profile-package-termination.json`;
const PACKET_PATH = `${CONTROL}/m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json`;
const DISPOSITION_PATH = `${CONTROL}/m7-v2-repair-termination-45-profile-inventory-disposition.json`;
const WORK3_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PACKAGE_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';

const BEN_APPROVAL_ID = 'BEN_APPROVAL:TERMINATION:PROFILE_SET_V1';

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
  profileKey,
  classificationPath,
  requiredExpressionSignature,
}) {
  const profile = cloneProfileTemplate(templateProfile);
  profile.profile_key = profileKey;
  profile.parent_profile_id = null;
  profile.subtype_path = [...classificationPath];
  profile.classification_path = [...classificationPath];
  profile.required_expression_signature = requiredExpressionSignature;
  profile.legal_authority_ids = [...templateProfile.legal_authority_ids].sort();
  profile.fixture_proofs = [];
  profile.shared_source_lawyer_decision_ids = [];
  profile.match_test = {
    kind: 'SOURCE_TOKEN_SEQUENCE',
    leaf_id: `leaf-${profileKey}`,
    scope: 'EFFECT_SOURCE_SPANS',
    tokens: ['familytermination', profileMatchToken(requiredExpressionSignature)],
  };
  return profile;
}

function profileSpecsFromPacket(packet) {
  return packet.profile_review_items
    .map((item) => ({
      profileKey: item.phase3_profile_key,
      proposedProfileKey: item.proposed_profile_key,
      classificationPath: [...item.classification_path],
      requiredExpressionSignature: item.required_expression_signature,
    }))
    .sort((left, right) => left.profileKey.localeCompare(right.profileKey));
}

function buildPackageRecord() {
  const snapshot = loadLawfulFixtureSnapshot();
  const template = lawfulFamilyTemplate(snapshot, 'TERMINATION');
  const templateProfile = template.profiles[0];
  const packet = read(PACKET_PATH);
  const disposition = read(DISPOSITION_PATH);
  const profileSpecs = profileSpecsFromPacket(packet);

  if (profileSpecs.length !== 45) {
    throw new Error(`expected 45 packet profiles, got ${profileSpecs.length}`);
  }
  if (disposition.profile_dispositions.length !== 45) {
    throw new Error(`expected 45 disposition rows, got ${disposition.profile_dispositions.length}`);
  }

  const approvedCount = disposition.profile_dispositions.filter(
    (row) => row.disposition === 'APPROVE',
  ).length;
  const partialCount = disposition.profile_dispositions.filter(
    (row) => row.disposition === 'PARTIAL_APPROVE',
  ).length;
  if (approvedCount !== 41 || partialCount !== 4) {
    throw new Error(
      `expected 41 APPROVE and 4 PARTIAL_APPROVE, got ${approvedCount} APPROVE and ${partialCount} PARTIAL_APPROVE`,
    );
  }

  const profiles = profileSpecs.map((spec) => buildProfileFromTemplate(templateProfile, {
    profileKey: spec.profileKey,
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
    family_key: 'TERMINATION',
    tree_id: 'tree-TERMINATION',
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

  const structureFixtures = template.structure_fixture_members.map((fixture) => {
    const { fixture_id: ignored, ...unsigned } = fixture;
    return sealBoundRecord(fixture.schema_version, 'fixture_id', unsigned);
  });

  const legalDecisions = [...template.legal_decisions].sort();

  const inventory = {
    family_key: 'TERMINATION',
    profile_set_version: 1,
    legal_decisions: legalDecisions,
    profile_ids: profiles.map((profile) => profile.profile_id),
    subtype_tree_id: subtypeTree.subtype_tree_id,
    match_fixture_record_ids: matchFixtures.map((fixture) => fixture.match_fixture_id),
    dimension_evidence_ids: dimensionEvidence.map((evidence) => evidence.dimension_evidence_id),
    structure_fixture_ids: structureFixtures.map((fixture) => fixture.fixture_id),
  };

  const familyApproval = sealBoundRecord(
    FAMILY_PACKAGE_APPROVAL_SCHEMA,
    'family_approval_id',
    {
      ben_approval_id: BEN_APPROVAL_ID,
      family_key: 'TERMINATION',
      profile_set_version: 1,
      approver: 'BEN_GOODCHILD',
      approved_on: '2026-08-24',
      approval_text:
        'Ben approves the TERMINATION 45-profile Work3 package inventory (41 APPROVE, 4 PARTIAL_APPROVE).',
      approved_inventory_digest: sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8')),
      approved_decision_classes: ['V2_PROFILE_APPROVALS'],
    },
  );

  const packageRecord = sealBoundRecord(
    FAMILY_PACKAGE_SCHEMA,
    'family_profile_package_id',
    {
      state: 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE',
      family_key: 'TERMINATION',
      profile_set_version: 1,
      family_approval: familyApproval,
      legal_decisions: inventory.legal_decisions,
      profiles,
      subtype_tree: subtypeTree,
      match_fixtures: matchFixtures,
      dimension_evidence: dimensionEvidence,
      structure_fixture_members: structureFixtures,
    },
  );

  return {
    packageRecord,
    inventory,
    approvedCount,
    partialCount,
  };
}

function main() {
  const { packageRecord, inventory, approvedCount, partialCount } = buildPackageRecord();
  const work3Authority = read(WORK3_AUTHORITY_PATH);

  const validation = validateSingleFamilyPackageInventory({
    work3Authority,
    familyKey: 'TERMINATION',
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
    approve_count: approvedCount,
    partial_count: partialCount,
    byte_length: outputBinding.byte_length,
    sha256: outputBinding.sha256,
    git_blob_oid: outputBinding.git_blob_oid,
    validation_status: validation.status,
  }, null, 2));
}

main();
