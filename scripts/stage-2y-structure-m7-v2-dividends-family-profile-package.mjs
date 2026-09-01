#!/usr/bin/env node
/**
 * Regenerate the on-disk DIVIDENDS Work3 family profile package from the
 * Phase 4 review schedule and the lawful package template.
 *
 * Idempotent: re-running reproduces identical bytes as long as the Phase 2 and
 * Phase 4 authorities are unchanged.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import dividendsAuthoring from '../lib/canonical-v2/m7-v2-dividends-authoring.js';
import { validateSingleFamilyPackageInventory } from '../lib/canonical-v2/m7-v2-contract.js';
import {
  buildFamilyProfileFixtureClosure,
  lawfulFamilyTemplate,
  loadLawfulFixtureSnapshot,
  profileMatchToken,
} from './lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PACKAGE_PATH = `${CONTROL}/m7-v2-repair-family-work3-profile-package-dividends.json`;
const WORK3_AUTHORITY_PATH = `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;

const FAMILY_KEY = 'DIVIDENDS';
const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PACKAGE_APPROVAL_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';

const PROFILE_COUNT = dividendsAuthoring.DIVIDENDS_PROFILE_COUNT;

const BEN_APPROVAL_ID = `BEN_APPROVAL:${FAMILY_KEY}:PROFILE_SET_V1`;
const LEGAL_DECISIONS = [
  BEN_APPROVAL_ID,
  'M5-RULING-ONE-OPERATIVE-LIMB',
  'M5-RULING-ONE-SEMANTIC-OWNER',
  'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
];
const APPROVAL_TEXT =
  'Ben approves the DIVIDENDS 1-profile Work3 package inventory; subtype grouping '
  + 'review pending.';

const PHASE2_BINDING = {
  path: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_PATH,
  schema_version: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_SCHEMA,
  record_id_field: 'dividends_authoring_phase2_authority_id',
  record_id: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_ID,
  byte_length: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_BYTES,
  sha256: dividendsAuthoring.DIVIDENDS_PHASE2_AUTHORITY_SHA256,
};

const PHASE4_BINDING = {
  path: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_PATH,
  schema_version: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_SCHEMA,
  record_id_field:
    'dividends_authoring_phase4_family_profile_package_review_authority_id',
  record_id: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_ID,
  byte_length: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_BYTES,
  sha256: dividendsAuthoring.DIVIDENDS_PHASE4_AUTHORITY_SHA256,
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
  const profile = structuredClone(templateProfile);
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
      'familydividends',
      profileMatchToken(requiredExpressionSignature),
    ],
  };
  return profile;
}

function buildPhase4Review() {
  const phase2Authority = boundEnvelope(PHASE2_BINDING);
  return dividendsAuthoring.prepareDividendsFamilyProfilePackageReview({
    dividendsAuthoringPhase4FamilyProfilePackageReviewAuthority:
      boundEnvelope(PHASE4_BINDING),
    dividendsAuthoringPhase2Authority: phase2Authority,
    governedSources: governedSources(phase2Authority.record),
  });
}

function buildPackageRecord() {
  const snapshot = loadLawfulFixtureSnapshot();
  const template = lawfulFamilyTemplate(snapshot, FAMILY_KEY);
  const templateProfile = template.profiles.find(
    (profile) => profile.parent_profile_id === null,
  ) ?? template.profiles[0];
  const phase4Review = buildPhase4Review();

  const profileSpecs = phase4Review.proposed_profiles
    .map((proposed) => ({
      packageProfileKey: proposed.package_profile_key,
      classificationPath: [...proposed.canonical_tuple.classification_path],
      requiredExpressionSignature: proposed.canonical_tuple.required_expression_signature,
      proposedProfileKey: proposed.proposed_profile_key,
    }))
    .sort((left, right) => left.packageProfileKey.localeCompare(right.packageProfileKey));

  if (profileSpecs.length !== PROFILE_COUNT) {
    throw new Error(`expected ${PROFILE_COUNT} profiles, got ${profileSpecs.length}`);
  }

  const profiles = profileSpecs.map((spec) => buildProfileFromTemplate(templateProfile, {
    packageProfileKey: spec.packageProfileKey,
    classificationPath: spec.classificationPath,
    requiredExpressionSignature: spec.requiredExpressionSignature,
  }));

  const templateFixtures = template.match_fixtures.map((fixture) => {
    const { match_fixture_id: _ignored, ...unsigned } = fixture;
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
    family_key: FAMILY_KEY,
    tree_id: `tree-${FAMILY_KEY}`,
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
    family_key: FAMILY_KEY,
    profile_set_version: 1,
    legal_decisions: [...LEGAL_DECISIONS].sort(),
    profile_ids: profiles.map((profile) => profile.profile_id),
    subtype_tree_id: subtypeTree.subtype_tree_id,
    match_fixture_record_ids: matchFixtures.map((fixture) => fixture.match_fixture_id),
    dimension_evidence_ids: dimensionEvidence.map((evidence) => evidence.dimension_evidence_id),
    structure_fixture_ids: [],
  };

  const familyApproval = sealBoundRecord(FAMILY_PACKAGE_APPROVAL_SCHEMA, 'family_approval_id', {
    ben_approval_id: BEN_APPROVAL_ID,
    family_key: FAMILY_KEY,
    profile_set_version: 1,
    approver: 'BEN_GOODCHILD',
    approved_on: '2026-08-24',
    approval_text: APPROVAL_TEXT,
    approved_inventory_digest: sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8')),
    approved_decision_classes: ['V2_PROFILE_APPROVALS'],
  });

  const packageRecord = sealBoundRecord(FAMILY_PACKAGE_SCHEMA, 'family_profile_package_id', {
    state: 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE',
    family_key: FAMILY_KEY,
    profile_set_version: 1,
    family_approval: familyApproval,
    legal_decisions: inventory.legal_decisions,
    profiles,
    subtype_tree: subtypeTree,
    match_fixtures: matchFixtures,
    dimension_evidence: dimensionEvidence,
    structure_fixture_members: [],
  });

  return { packageRecord, inventory };
}

function main() {
  const { packageRecord, inventory } = buildPackageRecord();
  const work3Authority = read(WORK3_AUTHORITY_PATH);

  const validation = validateSingleFamilyPackageInventory({
    work3Authority,
    familyKey: FAMILY_KEY,
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
  writeFileSync(join(REPO_ROOT, PACKAGE_PATH), bytes);

  const outputBinding = binding(PACKAGE_PATH, packageRecord, 'family_profile_package_id');
  process.stdout.write(`${JSON.stringify({
    path: PACKAGE_PATH,
    family_profile_package_id: packageRecord.family_profile_package_id,
    profile_count: packageRecord.profiles.length,
    approve_count: PROFILE_COUNT,
    legal_grouping_pending_count: PROFILE_COUNT,
    byte_length: outputBinding.byte_length,
    sha256: outputBinding.sha256,
    git_blob_oid: outputBinding.git_blob_oid,
    validation_status: validation.status,
  }, null, 2)}\n`);
}

main();
