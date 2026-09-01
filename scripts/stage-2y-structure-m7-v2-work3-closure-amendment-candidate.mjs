#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import contractModule from '../lib/canonical-v2/m7-v2-contract.js';
import fixtureModule from '../tests/helpers/m7-v2-work3-family-package-fixture.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const { validateFamilyProfilePackageSetForWork3 } = contractModule;
const { buildLawfulWork3FamilyPackageSetFixture } = fixtureModule;

const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
export const CANDIDATE_PATH = CONTROL
  + '/m7-v2-repair-work3-execution-manifest-closure-amendment.json';
const MANIFEST_PATH = CONTROL + '/m7-v2-repair-work3-execution-manifest.json';
const ENTRY_AUTHORITY_PATH = CONTROL
  + '/m7-v2-repair-contract-work3-entry-correction-authority.json';
const STANDING_AUTHORITY_PATH =
  'docs/codex-program/notes/BEN-STANDING-AUTHORIZATION-2026-09-01.md';
const DECISIONS_PATH = 'docs/core/DECISIONS.md';
const PLAN_PATH = 'docs/core/PLAN.md';
const FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';
const FIXTURE_HELPER_PATH = 'tests/helpers/m7-v2-work3-family-package-fixture.js';
const CONTRACT_PATH = 'lib/canonical-v2/m7-v2-contract.js';
const CANDIDATE_GENERATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.mjs';
const CANDIDATE_TEST_PATH =
  'tests/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.test.js';
const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK3_EXECUTION_MANIFEST_CLOSURE_AMENDMENT/V1';
const ID_FIELD = 'closure_amendment_id';
const PREDECESSOR_SUCCESS_CONDITION =
  'ALL_25_FAMILY_PACKAGES_ARE_CREATE_ONCE_CONTENT_ADDRESSED_AND_BEN_APPROVED';
const SUCCESSOR_SUCCESS_CONDITION =
  'EXACTLY_24_SEALED_FAMILY_PACKAGES_AND_CAPITALISATION_PARKED';
const PREDECESSOR_RECEIPT_CHECK = 'TWENTY_FIVE_BEN_APPROVED_FAMILY_PACKAGES';
const SUCCESSOR_RECEIPT_CHECK =
  'TWENTY_FOUR_SEALED_FAMILY_PACKAGES_AND_CAPITALISATION_PARKED';
const PREDECESSOR_MANIFEST_RECEIPT_CHECK = 'EXECUTION_MANIFEST_P50';
const SUCCESSOR_MANIFEST_RECEIPT_CHECK = 'EXECUTION_MANIFEST_P53_SUCCESSOR';
const PREDECESSOR_PATH_CONDITION = 'P50_IS_EXACT_AND_MANIFEST_WRITES_P49';
const SUCCESSOR_PATH_CONDITION =
  'P53_IS_EXACT_AND_RICH_RECEIPT_BINDS_EXACT_52_ARTIFACTS';
const PREDECESSOR_TRANSACTION_CONDITION =
  'ALL_32_CREATE_ONCE_OUTPUTS_USE_RECEIPT_LAST_DURABLE_TRANSACTION_WITH_CLOSED_ROLLBACK_AND_RETRY';
const SUCCESSOR_TRANSACTION_CONDITION =
  'ALL_7_CREATE_ONCE_OUTPUTS_USE_RECEIPT_LAST_DURABLE_TRANSACTION_WITH_CLOSED_ROLLBACK_AND_RETRY';
const EXTERNAL_REVIEW_RECEIPT_PATH = CONTROL
  + '/m7-v2-repair-work3-execution-manifest-closure-amendment-external-review-receipt.json';
const APPLICATION_RECEIPT_PATH = CONTROL
  + '/m7-v2-repair-work3-execution-manifest-closure-amendment-application-receipt.json';
const SUCCESSOR_MANIFEST_PATH = CONTROL
  + '/m7-v2-repair-work3-execution-manifest-closure-successor.json';
const EXTERNAL_REVIEW_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1';
const EXTERNAL_REVIEW_RECEIPT_ID_FIELD =
  'work3_closure_amendment_external_review_receipt_id';
const AUTHORING_VENDOR_ID = 'OPENAI';
const REVIEWER_MODEL_WITHHELD_VALUE = 'WITHHELD_BY_HOST_POLICY';
const REVIEW_TARGET_BRANCH = 'codex/recover-m7-20260812';
const REVIEW_TARGET_REMOTE_REF = `origin/${REVIEW_TARGET_BRANCH}`;
const REVIEW_TARGET_REMOTE_BRANCH_REF = `refs/heads/${REVIEW_TARGET_BRANCH}`;
const REVIEW_TARGET_ORIGIN_URL =
  'https://github.com/CodeNameHash/precedent-machine.git';
const REVIEW_TARGET_PATHS = Object.freeze([
  CANDIDATE_PATH,
  CANDIDATE_GENERATOR_PATH,
  CANDIDATE_TEST_PATH,
]);
const BASE_COMMIT_BINDING = Object.freeze({
  commit_sha: '05b5c49bd549a1d985bb3d888ee92fc313ac88df',
  parent_commit_sha: 'b167a3ed3353bb0b8f42855636b78ad9c8a137b7',
  tree_sha: 'c7e738bfaca3dfb47e8f49b63517c33179d71312',
});
const EXTERNAL_REVIEW_CHECKS = Object.freeze([
  'CANONICAL_IDENTITY_AND_THREE_FILE_BINDINGS',
  'DECISION_22_AND_CAPITALISATION_PARKING_AUTHORITY',
  'EXACT_24_SEALED_PACKAGES_AND_1382_PROFILES',
  'EXACT_SEVEN_OUTPUT_PRESERVATION_CLOSE',
  'EXACT_52_ARTIFACT_AND_53_EFFECTIVE_PATH_ROSTER',
  'APPROVED_SET_AND_PACKAGE_MEMBER_CLOSURE',
  'RICH_31_KEY_V2_RECEIPT_CONTRACT',
  'SUCCESSOR_MANIFEST_V2_AND_COMMAND_PARITY',
  'WORK4_24_TREE_PLUS_CAPITALISATION_PARKED_CONSUMER',
  'ACYCLIC_REVIEW_APPLICATION_AND_SUCCESSOR_SEQUENCE',
  'ZERO_LEGAL_SEMANTIC_PRODUCT_DATABASE_AND_SERVING_EFFECT',
]);

function bytes(repositoryPath) {
  return readFileSync(join(REPO_ROOT, repositoryPath));
}

function gitBlobOid(value) {
  const selected = Buffer.from(value);
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${selected.length}\0`, 'utf8'),
    selected,
  ])).digest('hex');
}

function physicalFileBinding(repositoryPath) {
  const value = bytes(repositoryPath);
  return {
    byte_length: value.length,
    git_blob_oid: gitBlobOid(value),
    path: repositoryPath,
    schema_version: null,
    sha256: sha256Hex(value),
  };
}

function physicalRecordBinding(repositoryPath, recordIdField) {
  const value = bytes(repositoryPath);
  const record = JSON.parse(value.toString('utf8'));
  if (!value.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8'))) {
    throw new Error(`record is not canonical JSON with one trailing LF: ${repositoryPath}`);
  }
  return {
    byte_length: value.length,
    git_blob_oid: gitBlobOid(value),
    path: repositoryPath,
    record_id: record[recordIdField],
    record_id_field: recordIdField,
    schema_version: record.schema_version,
    sha256: sha256Hex(value),
  };
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function assertExactKeys(record, expectedKeys, label) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)
      || !same(Object.keys(record).sort(), [...expectedKeys].sort())) {
    throw new Error(`${label} exact keys are invalid`);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0;
}

function normalisedVendorId(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '')
    : '';
}

function gitText(argv) {
  return execFileSync('git', argv, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commitPathBlobBinding(commitSha, repositoryPath) {
  const line = gitText([
    'ls-tree', '-r', '--full-tree', commitSha, '--', repositoryPath,
  ]);
  const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/.exec(line);
  if (!match || match[2] !== repositoryPath) {
    throw new Error(`review-target commit path is not an exact regular blob: ${repositoryPath}`);
  }
  return {
    git_blob_oid: match[1],
    path: repositoryPath,
  };
}

function observeReviewTargetCommitBinding() {
  const branch = gitText(['branch', '--show-current']);
  const commitSha = gitText(['rev-parse', 'HEAD']);
  const originUrl = gitText(['remote', 'get-url', 'origin']);
  const remoteRefCommitSha = gitText(['rev-parse', REVIEW_TARGET_REMOTE_REF]);
  const liveRemoteLine = gitText([
    'ls-remote',
    '--exit-code',
    REVIEW_TARGET_ORIGIN_URL,
    REVIEW_TARGET_REMOTE_BRANCH_REF,
  ]);
  const liveRemoteMatch = /^([0-9a-f]{40})\t(.+)$/.exec(liveRemoteLine);
  if (!liveRemoteMatch || liveRemoteMatch[2] !== REVIEW_TARGET_REMOTE_BRANCH_REF) {
    throw new Error('live review-target remote branch observation is invalid');
  }
  const ancestry = gitText(['rev-list', '--parents', '-n', '1', commitSha])
    .split(/\s+/);
  if (ancestry.length !== 2 || ancestry[0] !== commitSha) {
    throw new Error('review-target commit must have exactly one parent');
  }
  const changedPaths = gitText([
    'diff-tree', '--no-commit-id', '--name-only', '-r', commitSha,
  ]).split('\n').filter(Boolean).sort();
  return {
    branch,
    changed_paths: changedPaths,
    commit_sha: commitSha,
    live_remote_commit_sha: liveRemoteMatch[1],
    live_remote_ref: REVIEW_TARGET_REMOTE_BRANCH_REF,
    origin_url: originUrl,
    parent_commit_sha: ancestry[1],
    path_blob_bindings: REVIEW_TARGET_PATHS.map(
      (repositoryPath) => commitPathBlobBinding(commitSha, repositoryPath),
    ),
    remote_ref: REVIEW_TARGET_REMOTE_REF,
    remote_ref_commit_sha: remoteRefCommitSha,
    tree_sha: gitText(['show', '-s', '--format=%T', commitSha]),
  };
}

function reviewTargetPathBlobBindings(reviewedArtifactBindings) {
  const byPath = new Map(Object.values(reviewedArtifactBindings).map(
    (binding) => [binding.path, binding],
  ));
  return REVIEW_TARGET_PATHS.map((repositoryPath) => {
    const binding = byPath.get(repositoryPath);
    if (binding === undefined) {
      throw new Error(`review-target artifact binding is missing: ${repositoryPath}`);
    }
    return {
      git_blob_oid: binding.git_blob_oid,
      path: repositoryPath,
    };
  });
}

function validateReviewTargetCommitBinding(
  binding,
  observedBinding,
  reviewedArtifactBindings,
  contract,
) {
  assertExactKeys(binding, contract.exact_keys, 'review-target commit binding');
  for (const field of [
    'commit_sha',
    'live_remote_commit_sha',
    'parent_commit_sha',
    'remote_ref_commit_sha',
    'tree_sha',
  ]) {
    if (!/^[0-9a-f]{40}$/.test(binding[field])) {
      throw new Error(`review-target commit ${field} is invalid`);
    }
  }
  const expectedPathBlobBindings = reviewTargetPathBlobBindings(
    reviewedArtifactBindings,
  );
  if (binding.branch !== contract.branch_exact_value
      || binding.origin_url !== contract.origin_url_exact_value
      || binding.live_remote_ref !== contract.live_remote_ref_exact_value
      || binding.remote_ref !== contract.remote_ref_exact_value
      || binding.parent_commit_sha
        !== contract.authority_base_parent_commit_sha_exact_value
      || binding.commit_sha === binding.parent_commit_sha
      || binding.live_remote_commit_sha !== binding.commit_sha
      || binding.remote_ref_commit_sha !== binding.commit_sha
      || !same(binding.changed_paths, contract.changed_paths_exact_value)
      || !same(binding.path_blob_bindings, expectedPathBlobBindings)) {
    throw new Error('review-target commit binding is invalid');
  }
  for (const pathBlobBinding of binding.path_blob_bindings) {
    assertExactKeys(
      pathBlobBinding,
      contract.path_blob_binding_exact_keys,
      'review-target path blob binding',
    );
  }
  assertExactKeys(
    observedBinding,
    contract.exact_keys,
    'observed review-target commit binding',
  );
  if (!same(observedBinding, binding)) {
    throw new Error('pushed review-target commit observation is invalid');
  }
}

function exactlyOneIndex(values, selected, label) {
  const indexes = values.flatMap((value, index) => (
    same(value, selected) ? [index] : []
  ));
  if (indexes.length !== 1) {
    throw new Error(`${label} is not present exactly once`);
  }
  return indexes[0];
}

function replaceExactlyOnce(values, predecessor, successor, label) {
  const result = [...values];
  result[exactlyOneIndex(result, predecessor, label)] = successor;
  return result;
}

function withoutExactPaths(values, removedPaths, label) {
  const removed = new Set(removedPaths);
  if (removed.size !== removedPaths.length) {
    throw new Error(`${label} removal paths are not unique`);
  }
  for (const path of removed) {
    if (values.filter((value) => value === path).length !== 1) {
      throw new Error(`${label} does not contain exact removal path ${path}`);
    }
  }
  return values.filter((path) => !removed.has(path));
}

function canonicalValueBinding(value) {
  const canonicalBytes = Buffer.from(canonicalJson(value), 'utf8');
  return {
    canonical_byte_length: canonicalBytes.length,
    canonical_sha256: sha256Hex(canonicalBytes),
  };
}

function unchangedObjectCommitment(jsonPointer, object, changedFields) {
  const changed = new Set(changedFields);
  const exactUnchangedFields = Object.keys(object).filter((key) => !changed.has(key));
  const value = Object.fromEntries(exactUnchangedFields.map((key) => [
    key,
    object[key],
  ]));
  return {
    exact_unchanged_fields: exactUnchangedFields,
    json_pointer: jsonPointer,
    value_binding: canonicalValueBinding(value),
  };
}

function fixtureSnapshot() {
  const encoded = bytes(FIXTURE_PATH).toString('utf8').trim();
  const snapshot = JSON.parse(
    gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'),
  );
  const unsigned = { ...snapshot };
  delete unsigned.fixture_digest;
  if (snapshot.schema_version
      !== 'STAGE_2Y_M7_V2_LAWFUL_FAMILY_PACKAGE_SET_TEST_FIXTURE/V1'
      || snapshot.fixture_digest
        !== sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8'))) {
    throw new Error('lawful Work3 fixture identity is invalid');
  }
  return snapshot;
}

function assertDecisionAuthority(decisions, standingAuthority, plan) {
  const decisionHeading =
    '## 22. Standing authorization and severity-one repair rule: DECIDED 2026-09-01';
  const standingSection =
    '## 2. Mechanical amendments implementing existing rulings — pre-approved';
  const closureText =
    'This includes the Work3 closure amendment accepting 24 sealed\n'
    + 'family packages with CAPITALISATION recorded PARKED';
  const parkingRule = 'Keep capitalisation parked until Stage 9F.';
  if (!decisions.includes(decisionHeading)
      || !standingAuthority.includes(standingSection)
      || !standingAuthority.includes(closureText)
      || plan.split(parkingRule).length !== 2) {
    throw new Error('Decision 22 standing authority no longer states the Work3 closure rule');
  }
}

function exactSealedPackages(entryAuthority, snapshot, fixture) {
  const familyKeys = entryAuthority.work3_scope_contract?.family_keys;
  if (!Array.isArray(familyKeys)
      || familyKeys.length !== 25
      || familyKeys.filter((familyKey) => familyKey === 'CAPITALISATION').length !== 1) {
    throw new Error('Work3 authority family set is not the expected 25-family set');
  }
  const overrides = snapshot.on_disk_family_package_overrides;
  if (!Array.isArray(overrides) || overrides.length !== 24) {
    throw new Error('lawful Work3 fixture does not bind exactly 24 on-disk overrides');
  }
  const overrideByFamily = new Map(overrides.map((override) => [
    override.family_key,
    override,
  ]));
  if (overrideByFamily.size !== 24 || overrideByFamily.has('CAPITALISATION')) {
    throw new Error('lawful Work3 fixture override family set is false');
  }
  const sourceByFamily = new Map(fixture.familyPackageSources.map((source) => [
    source.record.family_key,
    source,
  ]));
  const sealed = familyKeys.filter((familyKey) => familyKey !== 'CAPITALISATION')
    .map((familyKey) => {
      const override = overrideByFamily.get(familyKey);
      const source = sourceByFamily.get(familyKey);
      if (override === undefined || source === undefined
          || !same(source.binding, override.binding)) {
        throw new Error(`lawful Work3 fixture lacks exact sealed package ${familyKey}`);
      }
      const binding = physicalRecordBinding(
        override.binding.path,
        'family_profile_package_id',
      );
      if (!same(binding, override.binding)
          || source.record.family_key !== familyKey
          || source.record.state !== 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE') {
        throw new Error(`sealed package binding or state changed for ${familyKey}`);
      }
      return {
        family_key: familyKey,
        package_binding: binding,
        profile_count: source.record.profiles.length,
      };
    });
  if (sealed.length !== 24
      || new Set(sealed.map((entry) => entry.package_binding.path)).size !== 24) {
    throw new Error('effective sealed package path set is not exact');
  }
  return sealed;
}

function capitalisationState(entryAuthority, fixture) {
  const packagePath = entryAuthority.work3_scope_contract
    ?.family_profile_package_paths_by_family_key?.find(
      (entry) => entry.family_key === 'CAPITALISATION',
    )?.path;
  const source = fixture.familyPackageSources.find(
    (entry) => entry.record.family_key === 'CAPITALISATION',
  );
  if (typeof packagePath !== 'string'
      || source === undefined
      || source.binding.path !== packagePath
      || source.record.profiles.length !== 1
      || existsSync(join(REPO_ROOT, packagePath))) {
    throw new Error('Capitalisation is not the expected synthetic-only parked family');
  }
  return {
    family_key: 'CAPITALISATION',
    on_disk_package_binding: null,
    on_disk_package_present: false,
    parked_state: 'PARKED',
    planned_package_path: packagePath,
    product_activation_permitted: false,
    serving_permitted: false,
    stage_9f_authority_required: true,
    synthetic_validation_package: {
      package_id: source.record.family_profile_package_id,
      profile_count: source.record.profiles.length,
      state: 'IN_MEMORY_VALIDATION_ONLY_NOT_A_SEALED_PACKAGE',
    },
  };
}

function sealedMemberInventory(sealedFamilyPackages, fixture) {
  const sources = new Map(fixture.familyPackageSources.map((source) => [
    source.record.family_key,
    source.record,
  ]));
  const byFamily = sealedFamilyPackages.map(({ family_key: familyKey }) => {
    const record = sources.get(familyKey);
    if (record === undefined) {
      throw new Error(`sealed package source is missing for ${familyKey}`);
    }
    const counts = {
      dimension_evidence_count: record.dimension_evidence.length,
      match_fixture_count: record.match_fixtures.length,
      profile_count: record.profiles.length,
      structure_fixture_member_count: record.structure_fixture_members.length,
      subtype_tree_count: record.subtype_tree === null ? 0 : 1,
    };
    return {
      family_key: familyKey,
      ...counts,
      total_package_member_count: Object.values(counts).reduce(
        (total, count) => total + count,
        0,
      ),
    };
  });
  const total = (field) => byFamily.reduce(
    (sum, entry) => sum + entry[field],
    0,
  );
  const totals = {
    dimension_evidence_count: total('dimension_evidence_count'),
    match_fixture_count: total('match_fixture_count'),
    profile_count: total('profile_count'),
    structure_fixture_member_count: total('structure_fixture_member_count'),
    subtype_tree_count: total('subtype_tree_count'),
    total_package_member_count: total('total_package_member_count'),
  };
  if (!same(totals, {
    dimension_evidence_count: 1382,
    match_fixture_count: 2866,
    profile_count: 1382,
    structure_fixture_member_count: 1,
    subtype_tree_count: 24,
    total_package_member_count: 5655,
  })) {
    throw new Error('sealed package member inventory is not exact');
  }
  return { by_family: byFamily, totals };
}

function preservationClosePaths(entryAuthority, manifest, sealedFamilyPackages) {
  const scope = entryAuthority.work3_scope_contract;
  const predecessorPackagePaths = scope.family_profile_package_paths;
  if (!Array.isArray(predecessorPackagePaths)
      || predecessorPackagePaths.length !== 25
      || new Set(predecessorPackagePaths).size !== 25) {
    throw new Error('predecessor family package path set is not exact');
  }
  const closureOutputPaths = withoutExactPaths(
    scope.create_once_output_paths,
    predecessorPackagePaths,
    'predecessor create-once path set',
  );
  const expectedClosureOutputs = [
    scope.create_once_output_paths[0],
    ...scope.candidate_native_set_paths,
    scope.approved_family_profile_set_contract.path,
    scope.structure_disposition_set_contract.path,
    manifest.work_receipt_path,
  ];
  if (!same(closureOutputPaths, expectedClosureOutputs)
      || closureOutputPaths.length !== 7
      || new Set(closureOutputPaths).size !== 7
      || closureOutputPaths.at(-1) !== manifest.work_receipt_path) {
    throw new Error('preservation-close seven-output order is not exact');
  }

  const predecessorPackageMap = new Map(
    scope.family_profile_package_paths_by_family_key.map((entry) => [
      entry.family_key,
      entry.path,
    ]),
  );
  const supersededPackagePaths = [];
  const effectivePackagePathMapping = sealedFamilyPackages.map((entry) => {
    const predecessorPath = predecessorPackageMap.get(entry.family_key);
    const effectivePath = entry.package_binding.path;
    if (typeof predecessorPath !== 'string') {
      throw new Error(`predecessor package mapping is missing ${entry.family_key}`);
    }
    if (predecessorPath !== effectivePath) {
      supersededPackagePaths.push({
        effective_path: effectivePath,
        family_key: entry.family_key,
        predecessor_path: predecessorPath,
      });
    }
    return { family_key: entry.family_key, path: effectivePath };
  });
  if (supersededPackagePaths.length !== 8) {
    throw new Error('effective package path set does not contain eight successors');
  }

  const predecessorArtifactPaths = scope.rich_work3_receipt_contract
    .artifact_bindings_contract.paths;
  if (predecessorArtifactPaths.length !== 49) {
    throw new Error('predecessor receipt artifact roster is not P49');
  }
  const capitalisationPath = predecessorPackageMap.get('CAPITALISATION');
  const replacementByPath = new Map(effectivePackagePathMapping.map((entry) => [
    predecessorPackageMap.get(entry.family_key),
    entry.path,
  ]));
  const effectivePredecessorArtifacts = predecessorArtifactPaths.flatMap((path) => {
    if (path === capitalisationPath) return [];
    return [replacementByPath.get(path) ?? path];
  });
  if (effectivePredecessorArtifacts.length !== 48
      || new Set(effectivePredecessorArtifacts).size !== 48) {
    throw new Error('effective predecessor artifact roster is not exact P48');
  }
  const governanceChainPaths = [
    CANDIDATE_PATH,
    EXTERNAL_REVIEW_RECEIPT_PATH,
    APPLICATION_RECEIPT_PATH,
    SUCCESSOR_MANIFEST_PATH,
  ];
  const receiptArtifactPaths = [
    ...effectivePredecessorArtifacts,
    ...governanceChainPaths,
  ].sort();
  if (receiptArtifactPaths.length !== 52
      || new Set(receiptArtifactPaths).size !== 52
      || receiptArtifactPaths.includes(manifest.work_receipt_path)) {
    throw new Error('successor receipt artifact roster is not exact P52');
  }
  return {
    closureOutputPaths,
    effectivePackagePathMapping,
    governanceChainPaths,
    predecessorPackagePaths,
    receiptArtifactPaths,
    supersededPackagePaths,
  };
}

function exactReceiptChecks(entryAuthority) {
  const checks = entryAuthority.work3_scope_contract.rich_work3_receipt_contract
    .checks_contract.exact_ordered_checks;
  const successorManifestChecks = replaceExactlyOnce(
    checks,
    { check_id: PREDECESSOR_MANIFEST_RECEIPT_CHECK, status: 'PASS' },
    { check_id: SUCCESSOR_MANIFEST_RECEIPT_CHECK, status: 'PASS' },
    'predecessor receipt manifest check',
  );
  return replaceExactlyOnce(
    successorManifestChecks,
    { check_id: PREDECESSOR_RECEIPT_CHECK, status: 'PASS' },
    { check_id: SUCCESSOR_RECEIPT_CHECK, status: 'PASS' },
    'predecessor receipt package check',
  );
}

function exactSuccessConditions(manifest) {
  let conditions = replaceExactlyOnce(
    manifest.success_conditions,
    PREDECESSOR_PATH_CONDITION,
    SUCCESSOR_PATH_CONDITION,
    'predecessor manifest path condition',
  );
  conditions = replaceExactlyOnce(
    conditions,
    PREDECESSOR_SUCCESS_CONDITION,
    SUCCESSOR_SUCCESS_CONDITION,
    'predecessor manifest family-package condition',
  );
  return replaceExactlyOnce(
    conditions,
    PREDECESSOR_TRANSACTION_CONDITION,
    SUCCESSOR_TRANSACTION_CONDITION,
    'predecessor manifest transaction condition',
  );
}

let cachedCandidate;

export function buildWork3ClosureAmendmentCandidate() {
  if (cachedCandidate !== undefined) return structuredClone(cachedCandidate);
  const decisions = bytes(DECISIONS_PATH).toString('utf8');
  const standingAuthority = bytes(STANDING_AUTHORITY_PATH).toString('utf8');
  const plan = bytes(PLAN_PATH).toString('utf8');
  assertDecisionAuthority(decisions, standingAuthority, plan);

  const manifest = JSON.parse(bytes(MANIFEST_PATH).toString('utf8'));
  const entryAuthority = JSON.parse(bytes(ENTRY_AUTHORITY_PATH).toString('utf8'));
  const snapshot = fixtureSnapshot();
  const fixture = buildLawfulWork3FamilyPackageSetFixture({
    useOnDiskFamilyPackages: true,
  });
  const validation = validateFamilyProfilePackageSetForWork3(fixture.validationInput);
  if (validation.status !== 'PASS'
      || validation.family_package_count !== 25
      || validation.profile_count !== 1383
      || validation.dimension_evidence_count !== 1383) {
    throw new Error('current 24-plus-synthetic full-set validation is not exact');
  }

  const sealedFamilyPackages = exactSealedPackages(
    entryAuthority,
    snapshot,
    fixture,
  );
  const sealedProfileCount = sealedFamilyPackages.reduce(
    (count, entry) => count + entry.profile_count,
    0,
  );
  if (sealedProfileCount !== 1382) {
    throw new Error('sealed Work3 package profile count is not 1,382');
  }
  const capitalisation = capitalisationState(entryAuthority, fixture);
  const scope = entryAuthority.work3_scope_contract;
  const approvedSetContract = scope.approved_family_profile_set_contract;
  const memberBindingContract = scope.package_member_binding_contract;
  const finalisationContract = scope.work3_finalisation_transaction_contract;
  const receiptContract = scope.rich_work3_receipt_contract;
  const sealedMembers = sealedMemberInventory(sealedFamilyPackages, fixture);
  const closurePaths = preservationClosePaths(
    entryAuthority,
    manifest,
    sealedFamilyPackages,
  );
  const effectiveSuccessConditions = exactSuccessConditions(manifest);
  const effectiveReceiptChecks = exactReceiptChecks(entryAuthority);
  const sealedFamilyKeys = sealedFamilyPackages.map((entry) => entry.family_key);
  const effectivePackageBindings = sealedFamilyPackages.map(
    (entry) => entry.package_binding,
  );
  if (scope.create_once_output_count !== 32
      || scope.manifest_write_path_count !== 49
      || scope.path_count !== 50
      || scope.receipt_artifact_binding_count !== 49
      || finalisationContract.target_count !== 32
      || receiptContract.counts_contract.exact_values.family_profile_package_count !== 25
      || !same(scope.family_keys, [
        ...sealedFamilyKeys.slice(0, 2),
        'CAPITALISATION',
        ...sealedFamilyKeys.slice(2),
      ])) {
    throw new Error('predecessor 25/32/P49/P50 closure contract is not exact');
  }

  const successorManifestReadPaths = [
    ...scope.manifest_permitted_read_paths,
    ...effectivePackageBindings.map((binding) => binding.path),
    CANDIDATE_PATH,
    EXTERNAL_REVIEW_RECEIPT_PATH,
    APPLICATION_RECEIPT_PATH,
  ].sort();
  if (successorManifestReadPaths.length !== 121
      || new Set(successorManifestReadPaths).size !== 121
      || !successorManifestReadPaths.includes(
        'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/'
        + 'calibration-packs/CAPITALISATION.json',
      )) {
    throw new Error('successor manifest read roster is not exact P121');
  }

  const effectiveGitArgv = structuredClone(manifest.exact_git_commit_and_push_argv);
  effectiveGitArgv[0] = ['git', 'add', '--', ...closurePaths.closureOutputPaths];
  const successorExactArgvWithRunLimits = structuredClone(
    manifest.exact_argv_with_run_limits,
  );
  if (successorExactArgvWithRunLimits[0].argv[2] !== MANIFEST_PATH) {
    throw new Error('predecessor manifest-validator argv is not exact');
  }
  successorExactArgvWithRunLimits[0].argv[2] = SUCCESSOR_MANIFEST_PATH;
  const successorCommandLedgerContract = structuredClone(
    receiptContract.command_execution_ledger_contract,
  );
  const receiptWriteStateIndex = successorCommandLedgerContract.state_ranges.findIndex(
    (range) => range.state === 'WRITES_THIRTY_TWO_CREATE_ONCE_OUTPUTS_AND_THIS_RECEIPT',
  );
  if (successorCommandLedgerContract.argv_order[4][2] !== MANIFEST_PATH
      || receiptWriteStateIndex === -1
      || successorCommandLedgerContract.state_ranges.filter(
        (range) => range.state === 'WRITES_THIRTY_TWO_CREATE_ONCE_OUTPUTS_AND_THIS_RECEIPT',
      ).length !== 1) {
    throw new Error('predecessor command ledger P50/32 state is not exact');
  }
  successorCommandLedgerContract.argv_order[4][2] = SUCCESSOR_MANIFEST_PATH;
  successorCommandLedgerContract.state_ranges[receiptWriteStateIndex].state =
    'WRITES_SEVEN_CREATE_ONCE_OUTPUTS_AND_THIS_RECEIPT';
  const successorManifestStopConditions = manifest.stop_conditions.map((condition) => {
    if (condition === 'ANY_MISSING_BEN_APPROVAL') {
      return 'ANY_MISSING_SEALED_PACKAGE_BEN_APPROVAL_OR_CAPITALISATION_PARKING_AUTHORITY';
    }
    if (condition === 'ANY_CREATE_ONCE_OUTPUT_PREEXISTS') {
      return 'ANY_OF_7_CREATE_ONCE_OUTPUTS_PREEXISTS';
    }
    return condition;
  });
  successorManifestStopConditions.splice(4, 0,
    'ANY_OF_24_SEALED_INPUT_BINDINGS_MISSING_OR_BYTE_IDENTITY_DRIFTED',
    'CAPITALISATION_PACKAGE_PATH_PRESENT',
    'CAPITALISATION_PARKED_STATE_MISSING_OR_SUBSTITUTED',
    'ANY_SEALED_PACKAGE_PATH_PRESENTED_AS_AN_OUTPUT',
    'ANY_MISSING_OR_INVALID_EXTERNAL_REVIEW_APPLICATION_OR_SUCCESSOR_LINEAGE_BINDING');
  if (new Set(successorManifestStopConditions).size
      !== successorManifestStopConditions.length) {
    throw new Error('successor manifest stop conditions are not unique');
  }
  const successorManifestScopeEqualities = {
    authorised_parent_write_extensions:
      scope.work3_manifest_contract.scope_equalities.authorised_parent_write_extensions,
    authorised_work1_write_exceptions: [],
    authorised_work2_write_exceptions: [],
    c3_path_is_preexisting_create_once_and_may_not_be_overwritten: true,
    commands: 'EXACT_SUCCESSOR_SEVENTEEN_COMMANDS_MAXIMUM_RUNS_MAPPED_TO_MAX_RUNS',
    cross_work_filename_exceptions: [],
    git_add_paths: 'EXACT_SEVEN_PRESERVATION_CLOSE_OUTPUT_PATHS',
    permitted_write_paths: 'EXACT_SEVEN_PRESERVATION_CLOSE_OUTPUT_PATHS',
    read_paths: 'EXACT_SUCCESSOR_CANONICAL_SORTED_UNIQUE_121_PATHS',
  };
  const effectiveAllowedEffects = {
    ...manifest.allowed_effects,
    create_once_output_writes: 7,
    family_profile_package_writes: 0,
    named_repository_writes: closurePaths.closureOutputPaths,
  };
  const effectiveFinalisationContract = {
    ...finalisationContract,
    clean_rollback_contract: {
      fsync_each_parent_after_removal: true,
      preserve_primary_error: true,
      remove_only_paths_created_by_current_attempt: true,
      reverse_creation_order: true,
      verify_all_7_targets_absent: true,
    },
    preflight_contract:
      'ALL_7_TARGETS_ABSENT_AND_EXACT_24_SEALED_INPUT_BINDINGS_UNCHANGED_'
      + 'AND_CAPITALISATION_PACKAGE_ABSENT_AND_EVERY_PARENT_REAL_DIRECTORY_'
      + 'SAFE_NO_SYMLINK_BEFORE_FIRST_WRITE',
    target_count: 7,
    write_order: 'EXACT_6_NON_RECEIPT_OUTPUTS_IN_CREATE_ONCE_PATH_ORDER_THEN_RECEIPT_LAST',
  };
  const predecessorChecksExceptClosure = receiptContract.checks_contract
    .exact_ordered_checks.filter((check) => ![
      PREDECESSOR_MANIFEST_RECEIPT_CHECK,
      PREDECESSOR_RECEIPT_CHECK,
    ].includes(check.check_id));
  const successorWork4RequiredBindings = receiptContract.next_work_contract
    .exact_values.work4_required_bindings.map((binding) => (
      binding === 'EXACT_25_PACKAGE_SUBTYPE_TREE_MEMBER_BINDINGS'
        ? 'EXACT_24_SEALED_PACKAGE_SUBTYPE_TREE_MEMBER_BINDINGS'
        : binding
    ));
  successorWork4RequiredBindings.splice(3, 0, 'CAPITALISATION_PARKED_CLOSURE_BINDING');
  if (successorWork4RequiredBindings.filter(
    (binding) => binding === 'CAPITALISATION_PARKED_CLOSURE_BINDING',
  ).length !== 1) {
    throw new Error('successor Work4 binding roster is not exact');
  }
  const receiptTopLevelAddedKeys = [
    'closure_amendment_binding',
    'external_review_receipt_binding',
    'closure_application_receipt_binding',
    'successor_execution_manifest_binding',
  ];
  const receiptCountAddedKeys = [
    'dimension_evidence_count',
    'match_fixture_count',
    'package_member_count',
    'parked_family_count',
    'profile_count',
    'structure_fixture_member_count',
    'subtype_tree_binding_count',
    'validation_fixture_dimension_evidence_count',
    'validation_fixture_family_package_count',
    'validation_fixture_profile_count',
  ];
  const capitalisationPredecessorPath = scope.family_profile_package_paths_by_family_key
    .find((entry) => entry.family_key === 'CAPITALISATION').path;
  const artifactRemovedPackagePaths = [
    capitalisationPredecessorPath,
    ...closurePaths.supersededPackagePaths.map((entry) => entry.predecessor_path),
  ].sort();
  const artifactAddedPackagePaths = closurePaths.supersededPackagePaths
    .map((entry) => entry.effective_path).sort();
  if (artifactRemovedPackagePaths.length !== 9
      || artifactAddedPackagePaths.length !== 8) {
    throw new Error('P49 to P52 artifact derivation is not exact');
  }
  const predecessorRecordIdCategories = receiptContract.artifact_bindings_contract
    .record_id_categories;
  let packageCategoryCount = 0;
  const successorBaseRecordIdCategories = predecessorRecordIdCategories.map((category) => {
    if (category.record_id_field !== 'family_profile_package_id') return category;
    packageCategoryCount += 1;
    return {
      ...category,
      paths: effectivePackageBindings.map((binding) => binding.path),
    };
  });
  if (packageCategoryCount !== 1) {
    throw new Error('predecessor artifact package category is not unique');
  }
  const genericCategory = successorBaseRecordIdCategories.at(-1);
  if (genericCategory.remaining_code_test_and_raw_fixture_paths
      !== 'NULL_SCHEMA_AND_ID_FIELDS') {
    throw new Error('predecessor generic artifact category is not last');
  }
  const successorRecordIdCategories = [
    ...successorBaseRecordIdCategories.slice(0, -1),
    {
      paths: [CANDIDATE_PATH],
      record_id_field: ID_FIELD,
      schema_version: SCHEMA,
    },
    {
      paths: [EXTERNAL_REVIEW_RECEIPT_PATH],
      record_id_field: 'work3_closure_amendment_external_review_receipt_id',
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
    },
    {
      paths: [APPLICATION_RECEIPT_PATH],
      record_id_field: 'work3_closure_amendment_application_receipt_id',
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_APPLICATION_RECEIPT/V1',
    },
    {
      paths: [SUCCESSOR_MANIFEST_PATH],
      record_id_field: 'execution_manifest_id',
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V2',
    },
    genericCategory,
  ];
  const successorManifestAddedBindingFields = {
    closure_amendment_binding: {
      path: CANDIDATE_PATH,
      record_id_field: ID_FIELD,
      schema_version: SCHEMA,
    },
    closure_application_receipt_binding: {
      path: APPLICATION_RECEIPT_PATH,
      record_id_field: 'work3_closure_amendment_application_receipt_id',
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_APPLICATION_RECEIPT/V1',
    },
    external_review_receipt_binding: {
      path: EXTERNAL_REVIEW_RECEIPT_PATH,
      record_id_field: 'work3_closure_amendment_external_review_receipt_id',
      schema_version:
        'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
    },
    predecessor_execution_manifest_binding: {
      path: MANIFEST_PATH,
      record_id_field: 'execution_manifest_id',
      schema_version: manifest.schema_version,
    },
  };
  const successorManifestRecordExactKeys = [
    ...Object.keys(manifest),
    ...Object.keys(successorManifestAddedBindingFields),
  ].sort();
  if (successorManifestRecordExactKeys.length !== 27
      || new Set(successorManifestRecordExactKeys).size !== 27) {
    throw new Error('successor manifest record key set is not exact');
  }
  const rootExecutionPolicy = entryAuthority.execution_policy;
  const successorRootExecutionPolicy = structuredClone(rootExecutionPolicy);
  if (successorRootExecutionPolicy.work3_commands[0].argv[2] !== MANIFEST_PATH) {
    throw new Error('root execution-policy manifest-validator argv is not exact');
  }
  successorRootExecutionPolicy.allowed_effects = {
    ...rootExecutionPolicy.allowed_effects,
    create_once_output_writes: 7,
    family_profile_package_writes: 0,
    named_repository_writes: closurePaths.closureOutputPaths,
  };
  successorRootExecutionPolicy.exact_git_commit_and_push_argv = effectiveGitArgv;
  successorRootExecutionPolicy.success_conditions = effectiveSuccessConditions;
  successorRootExecutionPolicy.work3_commands[0].argv[2] = SUCCESSOR_MANIFEST_PATH;
  const successorWork3ExecutionFixtureContract = {
    ...scope.work3_execution_fixture_contract,
    command_run_counts: {
      ...scope.work3_execution_fixture_contract.command_run_counts,
      argv_order: successorCommandLedgerContract.argv_order,
    },
  };
  if (!same(
    successorWork3ExecutionFixtureContract.command_run_counts.argv_order,
    successorCommandLedgerContract.argv_order,
  )) {
    throw new Error('successor fixture and receipt command orders differ');
  }
  const externalReviewReceiptExactKeys = [
    'schema_version',
    EXTERNAL_REVIEW_RECEIPT_ID_FIELD,
    'reviewed_on',
    'review_state',
    'status',
    'base_commit_binding',
    'review_target_commit_binding',
    'reviewed_artifact_bindings',
    'reviewer_identity',
    'independence_attestation',
    'checks',
    'findings',
    'authority_boundary',
    'zero_effect_boundary',
  ];
  const externalReviewReceiptContract = {
    authority_boundary_exact_value: {
      authority_granted: 'NONE',
      legal_ruling_authority: false,
      mechanical_review_only: true,
      mutation_authority: false,
    },
    base_commit_binding: BASE_COMMIT_BINDING,
    base_commit_role:
      'IMMUTABLE_PRE_BUNDLE_AUTHORITY_BASE_NOT_THE_REVIEW_TARGET_COMMIT',
    canonical_bytes: 'UTF8_CANONICAL_JSON_PLUS_ONE_TRAILING_LF',
    checks_exact_value: EXTERNAL_REVIEW_CHECKS.map((checkId) => ({
      check_id: checkId,
      status: 'PASS',
    })),
    content_identity:
      'CONTENT_ID_OF_SCHEMA_AND_UNSIGNED_EXACT_FOURTEEN_KEY_RECEIPT',
    exact_keys: externalReviewReceiptExactKeys,
    findings_exact_value: [],
    path: EXTERNAL_REVIEW_RECEIPT_PATH,
    record_id_field: EXTERNAL_REVIEW_RECEIPT_ID_FIELD,
    reviewed_artifact_binding_contracts: {
      amendment_binding: {
        exact_final_binding_computed_after_candidate_bytes_are_frozen: true,
        path: CANDIDATE_PATH,
        record_id_field: ID_FIELD,
        schema_version: SCHEMA,
        self_binding_inside_amendment_forbidden: true,
      },
      generator_binding: physicalFileBinding(CANDIDATE_GENERATOR_PATH),
      test_binding: physicalFileBinding(CANDIDATE_TEST_PATH),
    },
    reviewed_artifact_bindings_exact_keys: [
      'amendment_binding',
      'generator_binding',
      'test_binding',
    ],
    review_target_commit_binding_contract: {
      authority_base_parent_commit_sha_exact_value: BASE_COMMIT_BINDING.commit_sha,
      branch_exact_value: REVIEW_TARGET_BRANCH,
      candidate_embeds_review_target_commit_or_tree_sha: false,
      changed_paths_exact_value: REVIEW_TARGET_PATHS,
      commit_and_tree_sha_format: 'LOWERCASE_SHA1_40_HEX',
      exact_keys: [
        'branch',
        'changed_paths',
        'commit_sha',
        'live_remote_commit_sha',
        'live_remote_ref',
        'origin_url',
        'parent_commit_sha',
        'path_blob_bindings',
        'remote_ref',
        'remote_ref_commit_sha',
        'tree_sha',
      ],
      live_remote_commit_sha_equals_commit_sha: true,
      live_remote_ref_exact_value: REVIEW_TARGET_REMOTE_BRANCH_REF,
      live_remote_verification_argv: [
        'git',
        'ls-remote',
        '--exit-code',
        REVIEW_TARGET_ORIGIN_URL,
        REVIEW_TARGET_REMOTE_BRANCH_REF,
      ],
      local_head_equals_commit_sha: true,
      origin_url_exact_value: REVIEW_TARGET_ORIGIN_URL,
      path_blob_binding_exact_keys: ['git_blob_oid', 'path'],
      path_blob_bindings_match_reviewed_artifact_bindings: true,
      production_validation_requires_live_repository_observation: true,
      remote_ref_commit_sha_equals_commit_sha: true,
      remote_ref_exact_value: REVIEW_TARGET_REMOTE_REF,
      target_commit_must_be_pushed: true,
    },
    review_state_exact_value: 'EXTERNAL_CROSS_VENDOR_REVIEW_COMPLETE',
    reviewed_on_contract: 'ISO_8601_DATE',
    reviewer_identity_contract: {
      authoring_vendor_id_exact_value: AUTHORING_VENDOR_ID,
      exact_keys: [
        'authoring_vendor_id',
        'reviewer_instance_id',
        'reviewer_model_id',
        'reviewer_vendor_id',
      ],
      every_value: 'NON_EMPTY_TRIMMED_STRING',
      reviewer_model_id_contract: {
        exact_value: REVIEWER_MODEL_WITHHELD_VALUE,
        required: true,
        value_rule: 'EXACT_WITHHELD_BY_HOST_POLICY',
      },
      reviewer_vendor_aliases_forbidden_case_insensitively: [
        'OPENAI',
        'CHATGPT',
        'CODEX',
      ],
      reviewer_vendor_id_format: 'UPPERCASE_ASCII_ALPHANUMERIC_WITH_INTERNAL_UNDERSCORES',
    },
    independence_attestation_exact_value: {
      cross_vendor_review: true,
      reviewer_model_identity_or_host_withholding_state_recorded: true,
      reviewer_not_authoring_session: true,
      reviewer_vendor_differs_from_authoring_vendor: true,
    },
    schema_version: EXTERNAL_REVIEW_RECEIPT_SCHEMA,
    status_exact_value: 'PASS',
    zero_effect_boundary_exact_value: {
      authority_change_count: 0,
      database_write_count: 0,
      legal_semantic_change_count: 0,
      product_write_count: 0,
      repository_mutation_count: 0,
      serving_change_count: 0,
    },
  };

  const body = {
    amended_on: '2026-09-01',
    amendment_scope: {
      effective_success_conditions: effectiveSuccessConditions,
      operation: 'PRESERVATION_CLOSE_WORK3_WITH_24_SEALED_PACKAGES_AND_ONE_PARKED_FAMILY',
      predecessor_manifest_mutated: false,
      successor_manifest_required: true,
      success_condition_replacements: [
        {
          index: exactlyOneIndex(
            manifest.success_conditions,
            PREDECESSOR_PATH_CONDITION,
            'predecessor path success condition',
          ),
          predecessor: PREDECESSOR_PATH_CONDITION,
          successor: SUCCESSOR_PATH_CONDITION,
        },
        {
          index: exactlyOneIndex(
            manifest.success_conditions,
            PREDECESSOR_SUCCESS_CONDITION,
            'predecessor package success condition',
          ),
          predecessor: PREDECESSOR_SUCCESS_CONDITION,
          successor: SUCCESSOR_SUCCESS_CONDITION,
        },
        {
          index: exactlyOneIndex(
            manifest.success_conditions,
            PREDECESSOR_TRANSACTION_CONDITION,
            'predecessor transaction success condition',
          ),
          predecessor: PREDECESSOR_TRANSACTION_CONDITION,
          successor: SUCCESSOR_TRANSACTION_CONDITION,
        },
      ],
      unchanged_success_conditions: manifest.success_conditions.filter(
        (condition) => ![
          PREDECESSOR_PATH_CONDITION,
          PREDECESSOR_SUCCESS_CONDITION,
          PREDECESSOR_TRANSACTION_CONDITION,
        ].includes(condition),
      ),
    },
    root_execution_policy_overlay: {
      changed_fields: [
        'allowed_effects',
        'exact_git_commit_and_push_argv',
        'success_conditions',
        'work3_commands[0].argv[2]',
      ],
      effective_execution_policy: successorRootExecutionPolicy,
      predecessor_execution_policy_binding:
        canonicalValueBinding(rootExecutionPolicy),
      predecessor_record_remains_immutable: true,
    },
    approved_profile_set_contract_overlay: {
      dimension_evidence_binding_count: sealedMembers.totals.dimension_evidence_count,
      exact_keys: approvedSetContract.exact_keys,
      family_key_order: sealedFamilyKeys,
      family_profile_package_binding_count: effectivePackageBindings.length,
      family_profile_package_bindings_contract:
        'EXACT_24_STANDARD_SEVEN_FIELD_PHYSICAL_FILE_BINDINGS_IN_SEALED_FAMILY_KEY_ORDER',
      package_path_mapping: closurePaths.effectivePackagePathMapping,
      parked_family_members_forbidden: true,
      path: approvedSetContract.path,
      profile_and_package_inventory_closure:
        'EXACT_1382_PROFILE_IDS_24_PACKAGE_BINDINGS_1382_DIMENSION_EVIDENCE_'
        + 'BINDINGS_AND_24_SUBTYPE_TREES_ARE_COMPLETE_UNIQUE_AND_BYTE_EQUAL_'
        + 'TO_THE_EXACT_24_SEALED_PACKAGE_MEMBERS',
      profile_count: sealedMembers.totals.profile_count,
      record_id_field: approvedSetContract.record_id_field,
      schema_version: approvedSetContract.schema_version,
      state: approvedSetContract.state,
      subtype_tree_binding_count: sealedMembers.totals.subtype_tree_count,
      subtype_tree_bindings_contract:
        'EXACT_24_ENTRIES_EACH_SEALED_FAMILY_KEY_PLUS_PACKAGE_MEMBER_BINDING_'
        + 'TO_ITS_SINGLETON_SUBTYPE_TREE_IN_SEALED_FAMILY_KEY_ORDER',
    },
    authority_basis: {
      capitalisation_parking_ruling: {
        ruling_id: 'BEN_2026_08_08_CAPITALISATION_PARKED_UNTIL_STAGE_9F',
        rule_text: 'Keep capitalisation parked until Stage 9F.',
        source_binding: physicalFileBinding(PLAN_PATH),
        source_line: 1133,
      },
      decision_22: {
        decision_number: 22,
        source_binding: physicalFileBinding(DECISIONS_PATH),
        title:
          'Standing authorization and severity-one repair rule: DECIDED 2026-09-01',
      },
      mechanical_authorisation: {
        section_number: 2,
        source_binding: physicalFileBinding(STANDING_AUTHORITY_PATH),
      },
      rule_implemented:
        'WORK3_ACCEPTS_24_SEALED_FAMILY_PACKAGES_WITH_CAPITALISATION_PARKED',
    },
    authority_state:
      'AUTHORIZED_BY_DECISION_22_PENDING_EXTERNAL_REVIEW_AND_APPLICATION',
    effective_family_package_closure: {
      capitalisation,
      family_count: 25,
      governed_family_keys: scope.family_keys,
      full_set_validation: {
        dimension_evidence_count: validation.dimension_evidence_count,
        family_package_count: validation.family_package_count,
        profile_count: validation.profile_count,
        state: 'PASS_WITH_SYNTHETIC_CAPITALISATION_VALIDATION_INPUT_ONLY',
      },
      parked_family_count: 1,
      sealed_family_keys: sealedFamilyKeys,
      sealed_family_package_count: sealedFamilyPackages.length,
      sealed_family_packages: sealedFamilyPackages,
      sealed_member_inventory: sealedMembers,
      sealed_profile_count: sealedProfileCount,
    },
    external_review_receipt_contract: externalReviewReceiptContract,
    exact_artifact_inventory_overlay: {
      artifact_binding_count: closurePaths.receiptArtifactPaths.length,
      artifact_binding_paths: closurePaths.receiptArtifactPaths,
      artifact_set_digest_contract: 'SHA256_CANONICAL_JSON_OF_EXACT_52_BINDING_ARRAY',
      derivation: {
        added_governance_path_count: closurePaths.governanceChainPaths.length,
        added_governance_paths: closurePaths.governanceChainPaths,
        added_successor_package_path_count: artifactAddedPackagePaths.length,
        added_successor_package_paths: artifactAddedPackagePaths,
        equation: '49_MINUS_9_PLUS_8_PLUS_4_EQUALS_52',
        predecessor_artifact_binding_count: 49,
        removed_package_path_count: artifactRemovedPackagePaths.length,
        removed_package_paths: artifactRemovedPackagePaths,
        successor_artifact_binding_count: 52,
      },
      effective_path_count: closurePaths.receiptArtifactPaths.length + 1,
      governance_chain_paths: closurePaths.governanceChainPaths,
      package_record_id_category: {
        paths: effectivePackageBindings.map((binding) => binding.path),
        record_id_field: 'family_profile_package_id',
        schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
      },
      path_order: 'CANONICAL_ASCENDING_REPOSITORY_PATH',
      predecessor_artifact_binding_count: 49,
      predecessor_effective_path_count: 50,
      receipt_excluded_from_artifact_bindings: true,
      receipt_path: manifest.work_receipt_path,
      record_id_categories: successorRecordIdCategories,
      superseded_package_paths: closurePaths.supersededPackagePaths,
    },
    landing_preconditions: [
      'REVIEW_TARGET_TRIO_COMMIT_PUBLISHED_FOR_EXTERNAL_REVIEW_ONLY',
      'EXTERNAL_CROSS_VENDOR_REVIEW_PASS',
      'EXACT_CANDIDATE_BYTES_UNCHANGED',
    ],
    landing_review_and_application_sequence: {
      application_receipt_contract: {
        binds_exact_closure_amendment: true,
        binds_exact_external_review_pass_receipt: true,
        binding_to_successor_manifest_forbidden: true,
        new_overlay_fields_or_rules_forbidden: true,
        path: APPLICATION_RECEIPT_PATH,
        state: 'IMMUTABLE_ZERO_EFFECT_APPLICATION',
      },
      cycle_prohibition:
        'APPLICATION_RECEIPT_MUST_NOT_BIND_SUCCESSOR_MANIFEST_SUCCESSOR_MANIFEST_'
        + 'MUST_BIND_APPLICATION_RECEIPT',
      exact_order: [
        'FROZEN_COMPLETE_AMENDMENT',
        'PUSH_EXACT_TRIO_COMMIT_AS_PUBLISHED_FOR_EXTERNAL_REVIEW_ONLY',
        'EXTERNAL_REVIEW_RECEIPT_BINDS_PUSHED_TRIO_COMMIT',
        'LAND_EXACT_AMENDMENT_WITH_PASS_RECEIPT_AS_LANDED_WITH_PASS_RECEIPT',
        'IMMUTABLE_ZERO_EFFECT_APPLICATION_RECEIPT',
        'SUCCESSOR_EXECUTION_MANIFEST',
        'SEVEN_OUTPUT_PRESERVATION_CLOSE_FINALISER',
        'RICH_WORK3_RECEIPT_LAST',
      ],
      external_review_receipt_contract: {
        binds_exact_candidate_bytes: true,
        exact_v1_contract: 'external_review_receipt_contract',
        path: EXTERNAL_REVIEW_RECEIPT_PATH,
        required_status: 'PASS',
      },
      external_review_receipt_must_bind_exact_candidate_bytes: true,
      landed_with_pass_receipt_contract: {
        application_receipt_still_required: true,
        exact_candidate_bytes_rewritten: false,
        external_review_pass_receipt_required: true,
        state: 'LANDED_WITH_PASS_RECEIPT',
      },
      application_receipt_may_fill_only_exact_bindings_hashes_and_ids: true,
      application_receipt_new_overlay_fields_or_rules_forbidden: true,
      rich_work3_receipt_contract: {
        binds_application_receipt: true,
        binds_closure_amendment: true,
        binds_external_review_receipt: true,
        binds_successor_manifest: true,
      },
      successor_manifest_contract: {
        binds_closure_application_receipt: true,
        binds_predecessor_execution_manifest: true,
        path: SUCCESSOR_MANIFEST_PATH,
      },
      work3_receipt_must_bind_amendment_external_review_application_and_successor_manifest:
        true,
    },
    review_publication_contract: {
      application_effect_count: 0,
      authority_effect_count: 0,
      exact_commit_paths: REVIEW_TARGET_PATHS,
      external_review_receipt_write_count: 0,
      legal_semantic_change_count: 0,
      product_write_count: 0,
      publication_is_application: false,
      publication_is_sealed_closure: false,
      sealed_closure_effect_count: 0,
      state: 'PUBLISHED_FOR_EXTERNAL_REVIEW_ONLY',
      successor_manifest_write_count: 0,
      work3_receipt_write_count: 0,
    },
    lawful_fixture: {
      fixture_binding: physicalFileBinding(FIXTURE_PATH),
      fixture_digest: snapshot.fixture_digest,
      fixture_schema_version: snapshot.schema_version,
      on_disk_override_count: snapshot.on_disk_family_package_overrides.length,
      validation_implementation_bindings: [
        physicalFileBinding(CONTRACT_PATH),
        physicalFileBinding(FIXTURE_HELPER_PATH),
      ],
    },
    work3_execution_fixture_contract_overlay: {
      effective_contract: successorWork3ExecutionFixtureContract,
      receipt_command_execution_ledger_argv_order_must_byte_equal_fixture: true,
      unchanged_fields: [
        'canonical_bytes',
        'case_ids',
        'case_ids_order',
        'combined_test_result',
        'exact_keys',
        'path',
        'receipt_must_byte_equal_fixture_counts_and_combined_result',
        'schema_version',
        'state',
      ],
    },
    package_authoring_contract_overlay: {
      ben_approval_id_preassignment_global_contract:
        'EXACTLY_24_NON_EMPTY_VALUES_GLOBALLY_UNIQUE_ACROSS_THE_24_SEALED_FAMILY_PACKAGES',
      create_once_repository_write_precondition:
        'NO_FAMILY_PACKAGE_WRITES_24_EFFECTIVE_SEALED_PACKAGES_PREEXIST_AND_MATCH_'
        + 'EXACT_BINDINGS_AND_CAPITALISATION_PACKAGE_PATH_IS_ABSENT',
      family_profile_package_write_count: 0,
      immutable_pre_existing_package_bindings: effectivePackageBindings,
      immutable_pre_existing_package_count: effectivePackageBindings.length,
      one_physical_package_per_sealed_family: true,
      package_output_path_count: 0,
      sealed_family_profile_package_paths:
        effectivePackageBindings.map((binding) => binding.path),
    },
    package_member_container_contract_overlay: {
      container_path_contract: 'EXACT_ONE_OF_24_EFFECTIVE_SEALED_FAMILY_PACKAGE_PATHS',
      effective_container_paths: effectivePackageBindings.map((binding) => binding.path),
      member_counts: sealedMembers.totals,
      outer_package_join_contract: {
        approved_set_registry:
          'EXACT_24_SEALED_FAMILY_PACKAGE_STANDARD_BINDINGS_VALIDATED_BEFORE_'
          + 'ANY_INNER_MEMBER_RESOLUTION',
        container_path_join_cardinality:
          'EXACTLY_ONE_APPROVED_SET_SEALED_FAMILY_PROFILE_PACKAGE_BINDING',
        capitalisation_container_path_forbidden: true,
      },
    },
    predecessor_work3_entry_correction_authority_binding: physicalRecordBinding(
      ENTRY_AUTHORITY_PATH,
      'correction_authority_id',
    ),
    predecessor_work3_execution_manifest_binding: physicalRecordBinding(
      MANIFEST_PATH,
      'execution_manifest_id',
    ),
    prohibited_mutations_in_amendment_authoring_and_landing_transaction: [
      'SEALED_FAMILY_PACKAGES',
      'FAMILY_INVENTORY_DISPOSITIONS',
      'FAMILY_SESSION_RECEIPTS',
      'FAMILY_REGISTRATION_AUTHORITIES',
      'WORK3_ENTRY_CORRECTION_AUTHORITY',
      'WORK3_EXECUTION_MANIFEST',
      'WORK3_RECEIPT',
    ],
    preservation_close_transaction_contract_overlay: {
      allowed_effects: {
        ambiguous_repeat_agreement_index_writes: 1,
        approved_family_profile_set_writes: 1,
        candidate_native_set_writes: 3,
        candidate_registration_writes: 0,
        candidate_transition_writes: 0,
        create_once_output_writes: 7,
        database_writes: 0,
        family_profile_package_writes: 0,
        model_calls: 0,
        network_reads: 0,
        network_writes: 0,
        product_writes: 0,
        receipt_writes: 1,
        semantic_runs: 0,
        structure_disposition_set_writes: 1,
      },
      create_once_output_count: 7,
      create_once_output_paths: closurePaths.closureOutputPaths,
      finalisation_contract: effectiveFinalisationContract,
      immutable_pre_existing_evidence_input_count: 24,
      immutable_pre_existing_evidence_inputs:
        'effective_family_package_closure.sealed_family_packages[].package_binding',
      non_receipt_output_count: 6,
      predecessor_create_once_output_count: 32,
      predecessor_package_outputs_reclassified_as_immutable_inputs: 24,
      receipt_last: true,
    },
    receipt_contract_overlay: {
      artifact_bindings_contract: {
        all_bindings_recomputed_from_final_live_bytes: true,
        artifact_set_digest: 'SHA256_CANONICAL_JSON_OF_EXACT_52_BINDING_ARRAY',
        count: closurePaths.receiptArtifactPaths.length,
        path_order: 'CANONICAL_ASCENDING_REPOSITORY_PATH',
        paths: closurePaths.receiptArtifactPaths,
        paths_unique: true,
        receipt_excluded: true,
        record_id_categories: successorRecordIdCategories,
      },
      checks_contract: {
        exact_ordered_checks: effectiveReceiptChecks,
        predecessor_manifest_check_id: PREDECESSOR_MANIFEST_RECEIPT_CHECK,
        successor_manifest_check_id: SUCCESSOR_MANIFEST_RECEIPT_CHECK,
        predecessor_check_id: PREDECESSOR_RECEIPT_CHECK,
        successor_check_id: SUCCESSOR_RECEIPT_CHECK,
        unchanged_checks: predecessorChecksExceptClosure,
      },
      command_execution_ledger_contract: successorCommandLedgerContract,
      counts_contract: {
        exact_keys: [
          ...receiptContract.counts_contract.exact_keys,
          ...receiptCountAddedKeys,
        ],
        exact_values: {
          ...receiptContract.counts_contract.exact_values,
          artifact_binding_count: 52,
          create_once_output_count: 7,
          dimension_evidence_count: sealedMembers.totals.dimension_evidence_count,
          effective_path_count: 53,
          family_key_count: 25,
          family_profile_package_count: 24,
          match_fixture_count: sealedMembers.totals.match_fixture_count,
          package_member_count: sealedMembers.totals.total_package_member_count,
          parked_family_count: 1,
          profile_count: sealedMembers.totals.profile_count,
          structure_fixture_member_count:
            sealedMembers.totals.structure_fixture_member_count,
          subtype_tree_binding_count: sealedMembers.totals.subtype_tree_count,
          validation_fixture_dimension_evidence_count: validation.dimension_evidence_count,
          validation_fixture_family_package_count: validation.family_package_count,
          validation_fixture_profile_count: validation.profile_count,
        },
        package_member_component_equality:
          '1382_PROFILES_PLUS_1382_DIMENSION_EVIDENCE_PLUS_2866_MATCH_FIXTURES_'
          + 'PLUS_24_SUBTYPE_TREES_PLUS_1_STRUCTURE_FIXTURE_EQUALS_5655',
        sealed_package_member_counts_frozen: true,
        unapproved_dynamic_profile_fixture_and_dimension_counts_not_frozen: false,
      },
      effects_contract: {
        exact_keys: receiptContract.effects_contract.exact_keys,
        exact_values: {
          ...receiptContract.effects_contract.exact_values,
          family_profile_package_writes: 0,
          files_written: 7,
        },
      },
      family_profile_evidence_contract: {
        approved_family_profile_set_binding:
          'STANDARD_BINDING_TO_EXACT_FINAL_24_SEALED_FAMILY_APPROVED_SET',
        exact_keys: [
          'family_profile_package_bindings',
          'approved_family_profile_set_binding',
          'governed_family_keys',
          'sealed_package_family_keys',
          'parked_family_evidence',
        ],
        family_profile_package_bindings:
          'EXACT_24_STANDARD_BINDINGS_IN_SEALED_FAMILY_KEY_ORDER_AND_BYTE_EQUAL_'
          + 'APPROVED_SET_BINDINGS',
        governed_family_keys: scope.family_keys,
        outer_package_join_before_member_resolution:
          'VALIDATE_ALL_24_SEALED_STANDARD_BINDINGS_THEN_REQUIRE_EACH_CONTAINER_'
          + 'PATH_JOIN_EXACTLY_ONCE_AND_REJECT_CAPITALISATION_AS_A_CONTAINER',
        parked_family_evidence: capitalisation,
        sealed_package_family_keys: sealedFamilyKeys,
      },
      create_once_output_paths: closurePaths.closureOutputPaths,
      exact_keys: [
        ...receiptContract.exact_keys,
        ...receiptTopLevelAddedKeys,
      ],
      lineage_contract:
        'SUCCESSOR_MANIFEST_ID_AND_DIGEST_PARENT_ACTIVATION_PREDECESSOR_ORDERING_'
        + 'C3_AMENDMENT_EXTERNAL_REVIEW_APPLICATION_AND_FINAL_ARTIFACT_BINDINGS_'
        + 'EXACTLY_EQUAL_RESOLVED_FINAL_BYTES',
      lineage_equalities: {
        closure_lineage_bindings_each_equal_exactly_one_artifact_binding: true,
        execution_manifest_id_and_digest_equal_successor_manifest_binding: true,
        predecessor_manifest_remains_bound_in_successor_lineage_and_artifacts: true,
      },
      next_work_contract: {
        exact_keys: receiptContract.next_work_contract.exact_keys,
        exact_values: {
          ...receiptContract.next_work_contract.exact_values,
          work4_required_bindings: successorWork4RequiredBindings,
        },
      },
      repository_precondition_contract: {
        candidate_registration_root_state: 'EMPTY',
        effective_work3_paths: [
          ...closurePaths.receiptArtifactPaths,
          manifest.work_receipt_path,
        ].sort(),
        exact_git_commit_and_push_argv: effectiveGitArgv,
        exact_keys: [
          ...receiptContract.repository_precondition_contract.exact_keys,
          'immutable_pre_existing_package_bindings',
        ],
        generated_paths_absent: closurePaths.closureOutputPaths,
        immutable_pre_existing_package_bindings: effectivePackageBindings,
        proof_state: 'ORCHESTRATOR_VERIFIED_EXTERNAL_TO_FINALISER',
        required_validator_argv:
          receiptContract.repository_precondition_contract.required_validator_argv,
      },
      top_level_lineage_binding_contracts: {
        closure_amendment_binding: {
          path: CANDIDATE_PATH,
          record_id_field: ID_FIELD,
          schema_version: SCHEMA,
        },
        closure_application_receipt_binding: {
          path: APPLICATION_RECEIPT_PATH,
          record_id_field: 'work3_closure_amendment_application_receipt_id',
          schema_version:
            'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_APPLICATION_RECEIPT/V1',
        },
        external_review_receipt_binding: {
          path: EXTERNAL_REVIEW_RECEIPT_PATH,
          record_id_field: 'work3_closure_amendment_external_review_receipt_id',
          schema_version:
            'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
        },
        successor_execution_manifest_binding: {
          path: SUCCESSOR_MANIFEST_PATH,
          record_id_field: 'execution_manifest_id',
          schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V2',
        },
      },
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2',
      top_level_added_exact_keys: receiptTopLevelAddedKeys,
      top_level_key_count: receiptContract.top_level_key_count + 4,
      work3_receipt_path: manifest.work_receipt_path,
    },
    rich_work3_receipt_consumer_contract_overlay: {
      closure_v2_contract: {
        consumer_paths: scope.rich_work3_receipt_consumer_contract.consumer_paths,
        exact_key_count: receiptContract.top_level_key_count + 4,
        exact_keys: [
          ...receiptContract.exact_keys,
          ...receiptTopLevelAddedKeys,
        ],
        schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2',
        shared_semantic_contract:
          'ALL_THREE_CONSUMERS_IMPLEMENT_THE_EXACT_SAME_CLOSURE_QUALIFIED_'
          + 'RICH_31_KEY_V2_RECEIPT_CONTRACT_BINDING_RESOLUTION_AND_CROSS_FIELD_EQUALITIES',
      },
      consumer_native_error_codes_preserved: true,
      legacy_v1_contract: {
        exact_key_count: receiptContract.top_level_key_count,
        exact_keys: receiptContract.exact_keys,
        remains_valid_for_legacy_v1_receipts: true,
        schema_version: receiptContract.schema_version,
      },
      schema_dispatch_requires_exact_version_no_cross_version_fallback: true,
      shared_consumer_parity_required: true,
    },
    successor_manifest_contract_overlay: {
      added_binding_fields: successorManifestAddedBindingFields,
      allowed_effects: effectiveAllowedEffects,
      binding_field_exact_keys: [
        'path',
        'schema_version',
        'record_id_field',
        'record_id',
        'byte_length',
        'sha256',
        'git_blob_oid',
      ],
      create_once_output_count: 7,
      create_once_output_paths: closurePaths.closureOutputPaths,
      exact_argv_with_run_limits: successorExactArgvWithRunLimits,
      exact_effective_path_count: 53,
      exact_effective_paths: [
        ...closurePaths.receiptArtifactPaths,
        manifest.work_receipt_path,
      ].sort(),
      exact_git_commit_and_push_argv: effectiveGitArgv,
      lineage_binding_order: [
        'predecessor_execution_manifest_binding',
        'closure_amendment_binding',
        'external_review_receipt_binding',
        'closure_application_receipt_binding',
      ],
      manifest_write_path_count: 7,
      new_path_count: 7,
      path: SUCCESSOR_MANIFEST_PATH,
      path_count: 53,
      permitted_read_path_count: successorManifestReadPaths.length,
      permitted_read_paths: successorManifestReadPaths,
      permitted_write_paths: closurePaths.closureOutputPaths,
      predecessor_manifest_binding_required: true,
      record_added_exact_keys: Object.keys(successorManifestAddedBindingFields).sort(),
      record_exact_keys: successorManifestRecordExactKeys,
      record_id_field: 'execution_manifest_id',
      record_key_count: successorManifestRecordExactKeys.length,
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V2',
      scope_equalities: successorManifestScopeEqualities,
      semantic_family_scope: scope.family_keys,
      stop_conditions: successorManifestStopConditions,
      success_conditions: effectiveSuccessConditions,
      work3_receipt_repository_precondition_contract: {
        candidate_registration_root_state: 'EMPTY',
        effective_work3_paths: [
          ...closurePaths.receiptArtifactPaths,
          manifest.work_receipt_path,
        ].sort(),
        exact_git_commit_and_push_argv: effectiveGitArgv,
        generated_paths_absent: closurePaths.closureOutputPaths,
        immutable_pre_existing_package_bindings: effectivePackageBindings,
        proof_state: 'ORCHESTRATOR_VERIFIED_EXTERNAL_TO_FINALISER',
        required_validator_argv:
          receiptContract.repository_precondition_contract.required_validator_argv,
      },
    },
    exact_contract_delta_derivation: {
      approved_profile_set_dimension_evidence_binding_count: {
        predecessor: 'DYNAMIC_OVER_25_PACKAGE_SET',
        successor: 1382,
      },
      approved_profile_set_profile_count: {
        predecessor: 'DYNAMIC_OVER_25_PACKAGE_SET',
        successor: 1382,
      },
      approved_profile_set_subtype_tree_binding_count: { predecessor: 25, successor: 24 },
      create_once_output_count: { predecessor: 32, successor: 7 },
      family_profile_package_count: { predecessor: 25, successor: 24 },
      family_profile_package_write_count: { predecessor: 25, successor: 0 },
      governed_family_count: { predecessor: 25, successor: 25 },
      manifest_write_path_count: { predecessor: 49, successor: 7 },
      receipt_artifact_binding_count: { predecessor: 49, successor: 52 },
      receipt_effective_path_count: { predecessor: 50, successor: 53 },
      receipt_files_written: { predecessor: 32, successor: 7 },
      synthetic_validation_dimension_evidence_count: { predecessor: 1383, successor: 1383 },
      synthetic_validation_family_package_count: { predecessor: 25, successor: 25 },
      synthetic_validation_profile_count: { predecessor: 1383, successor: 1383 },
      transaction_target_count: { predecessor: 32, successor: 7 },
      work4_subtype_tree_binding_count: { predecessor: 25, successor: 24 },
    },
    unchanged_contract_field_commitments: {
      all_predecessor_fields_not_identified_by_this_overlay:
        'EXACTLY_UNCHANGED_FROM_THE_TWO_BOUND_PREDECESSOR_RECORDS',
      commitments: [
        unchangedObjectCommitment(
          '/work3_scope_contract/approved_family_profile_set_contract',
          approvedSetContract,
          [
            'family_key_order',
            'family_profile_package_bindings_contract',
            'package_path_mapping',
            'profile_and_package_inventory_closure',
            'subtype_tree_bindings_contract',
          ],
        ),
        unchangedObjectCommitment(
          '/work3_scope_contract/family_profile_package_contract',
          scope.family_profile_package_contract,
          [
            'ben_approval_id_preassignment_global_contract',
            'create_once_repository_write_precondition',
            'one_physical_package_per_family',
          ],
        ),
        unchangedObjectCommitment(
          '/work3_scope_contract/package_member_binding_contract',
          memberBindingContract,
          ['container_path_contract', 'outer_package_join_contract'],
        ),
        unchangedObjectCommitment(
          '/work3_scope_contract/work3_finalisation_transaction_contract',
          finalisationContract,
          ['clean_rollback_contract', 'preflight_contract', 'target_count', 'write_order'],
        ),
        unchangedObjectCommitment(
          '/work3_scope_contract/rich_work3_receipt_contract',
          receiptContract,
          [
            'artifact_bindings_contract',
            'checks_contract',
            'command_execution_ledger_contract',
            'counts_contract',
            'create_once_output_paths',
            'effects_contract',
            'exact_keys',
            'family_profile_evidence_contract',
            'lineage_contract',
            'next_work_contract',
            'repository_precondition_contract',
            'schema_version',
            'top_level_key_count',
          ],
        ),
      ],
      exact_unchanged_domains: [
        'ALL_24_SEALED_PACKAGE_BYTES',
        'ALL_FAMILY_DISPOSITIONS_SESSION_RECEIPTS_AND_REGISTRATION_AUTHORITIES',
        'THE_25_FAMILY_SEMANTIC_UNIVERSE_AND_CALIBRATION_READ_PATHS',
        'THE_SYNTHETIC_25_PACKAGE_1383_PROFILE_VALIDATION_FIXTURE',
        'THE_THREE_TEN_MEMBER_NATIVE_SETS_AND_SEVEN_PLUS_THREE_CORPUS',
        'AMBIGUOUS_REPEAT_CONTENT',
        'BUILD_ONLY_NULL_CANDIDATE_AND_TRANSITION',
        'RECEIPT_LAST_DURABILITY_ROLLBACK_AND_RETRY',
        'PACKAGE_MEMBER_NO_SELF_REFERENCE',
        'ALL_RECEIPT_CHECKS_EXCEPT_THE_P50_AND_PACKAGE_CLOSURE_CHECKS',
        'WORK4_FIRST_CANDIDATE_OWNERSHIP',
        'ZERO_MODEL_NETWORK_DATABASE_PRODUCT_M0_M4_M8_AND_SEMANTIC_EFFECTS',
      ],
    },
    work4_consumer_contract_overlay: {
      capitalisation_injection_omission_duplicate_or_path_substitution_rejected: true,
      exact_sealed_subtype_tree_binding_count: sealedMembers.totals.subtype_tree_count,
      exact_values: {
        ...receiptContract.next_work_contract.exact_values,
        work4_required_bindings: successorWork4RequiredBindings,
      },
      registration_and_verification_use_sealed_family_order: sealedFamilyKeys,
    },
    work3_receipt_creation_requires:
      'PUBLISHED_REVIEW_TARGET_COMMIT_THEN_EXTERNAL_REVIEW_PASS_RECEIPT_THEN_'
      + 'AMENDMENT_LANDED_WITH_PASS_RECEIPT_THEN_'
      + 'VALID_ZERO_EFFECT_APPLICATION_RECEIPT_THEN_VALID_SUCCESSOR_MANIFEST',
    zero_effect_boundary: {
      candidate_registration_count: 0,
      candidate_transition_count: 0,
      database_write_count: 0,
      legal_grouping_review_closure_count: 0,
      legal_semantic_change_count: 0,
      manifest_mutation_count: 0,
      product_write_count: 0,
      remaining_review_states: 'PRESERVED',
      serving_change_count: 0,
      work3_receipt_write_count: 0,
    },
  };
  const unsigned = { schema_version: SCHEMA, ...body };
  cachedCandidate = {
    ...unsigned,
    [ID_FIELD]: contentId(SCHEMA, unsigned),
  };
  return structuredClone(cachedCandidate);
}

export function validateWork3ClosureAmendmentCandidate(
  candidate,
  expected = buildWork3ClosureAmendmentCandidate(),
) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Work3 closure amendment candidate must be an object');
  }
  const unsigned = { ...candidate };
  delete unsigned[ID_FIELD];
  if (candidate.schema_version !== SCHEMA
      || candidate[ID_FIELD] !== contentId(SCHEMA, unsigned)) {
    throw new Error('Work3 closure amendment candidate identity is invalid');
  }
  if (!same(candidate, expected)) {
    throw new Error('Work3 closure amendment candidate differs from the exact live closure');
  }
  return {
    artifact_binding_count:
      candidate.exact_artifact_inventory_overlay.artifact_binding_count,
    closure_amendment_id: candidate[ID_FIELD],
    create_once_output_count:
      candidate.preservation_close_transaction_contract_overlay.create_once_output_count,
    effective_path_count:
      candidate.exact_artifact_inventory_overlay.effective_path_count,
    family_count: candidate.effective_family_package_closure.family_count,
    full_set_profile_count:
      candidate.effective_family_package_closure.full_set_validation.profile_count,
    parked_family_count:
      candidate.effective_family_package_closure.parked_family_count,
    sealed_family_package_count:
      candidate.effective_family_package_closure.sealed_family_package_count,
    sealed_profile_count:
      candidate.effective_family_package_closure.sealed_profile_count,
    state: candidate.authority_state,
  };
}

export function buildExternalReviewReceiptTestFixture({
  reviewTargetCommitSha = '1'.repeat(40),
  reviewTargetTreeSha = '2'.repeat(40),
  reviewedOn = '2026-09-01',
  reviewerInstanceId = 'independent-reviewer-instance-fixture',
  reviewerModelId = REVIEWER_MODEL_WITHHELD_VALUE,
  reviewerVendorId = 'INDEPENDENT_VENDOR_FIXTURE',
} = {}) {
  const candidate = buildWork3ClosureAmendmentCandidate();
  const contract = candidate.external_review_receipt_contract;
  const reviewedArtifactBindings = {
    amendment_binding: physicalRecordBinding(CANDIDATE_PATH, ID_FIELD),
    generator_binding: contract.reviewed_artifact_binding_contracts.generator_binding,
    test_binding: contract.reviewed_artifact_binding_contracts.test_binding,
  };
  const reviewTargetContract = contract.review_target_commit_binding_contract;
  const body = {
    authority_boundary: contract.authority_boundary_exact_value,
    base_commit_binding: contract.base_commit_binding,
    checks: contract.checks_exact_value,
    findings: contract.findings_exact_value,
    independence_attestation: contract.independence_attestation_exact_value,
    review_target_commit_binding: {
      branch: reviewTargetContract.branch_exact_value,
      changed_paths: reviewTargetContract.changed_paths_exact_value,
      commit_sha: reviewTargetCommitSha,
      live_remote_commit_sha: reviewTargetCommitSha,
      live_remote_ref: reviewTargetContract.live_remote_ref_exact_value,
      origin_url: reviewTargetContract.origin_url_exact_value,
      parent_commit_sha:
        reviewTargetContract.authority_base_parent_commit_sha_exact_value,
      path_blob_bindings: reviewTargetPathBlobBindings(reviewedArtifactBindings),
      remote_ref: reviewTargetContract.remote_ref_exact_value,
      remote_ref_commit_sha: reviewTargetCommitSha,
      tree_sha: reviewTargetTreeSha,
    },
    reviewed_artifact_bindings: reviewedArtifactBindings,
    reviewed_on: reviewedOn,
    review_state: contract.review_state_exact_value,
    reviewer_identity: {
      authoring_vendor_id: AUTHORING_VENDOR_ID,
      reviewer_instance_id: reviewerInstanceId,
      reviewer_model_id: reviewerModelId,
      reviewer_vendor_id: reviewerVendorId,
    },
    schema_version: contract.schema_version,
    status: contract.status_exact_value,
    zero_effect_boundary: contract.zero_effect_boundary_exact_value,
  };
  return {
    ...body,
    [EXTERNAL_REVIEW_RECEIPT_ID_FIELD]: contentId(contract.schema_version, body),
  };
}

export function validateExternalReviewReceipt(receipt, receiptBytes, {
  observedReviewTargetCommitBinding,
} = {}) {
  const candidate = buildWork3ClosureAmendmentCandidate();
  const contract = candidate.external_review_receipt_contract;
  assertExactKeys(receipt, contract.exact_keys, 'external review receipt');
  const expectedBytes = Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8');
  if (!Buffer.isBuffer(receiptBytes) || !receiptBytes.equals(expectedBytes)) {
    throw new Error('external review receipt bytes are not canonical JSON plus one LF');
  }
  const unsigned = { ...receipt };
  delete unsigned[EXTERNAL_REVIEW_RECEIPT_ID_FIELD];
  if (receipt.schema_version !== contract.schema_version
      || receipt[EXTERNAL_REVIEW_RECEIPT_ID_FIELD]
        !== contentId(contract.schema_version, unsigned)) {
    throw new Error('external review receipt identity is invalid');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.reviewed_on)
      || new Date(`${receipt.reviewed_on}T00:00:00.000Z`).toISOString().slice(0, 10)
        !== receipt.reviewed_on) {
    throw new Error('external review receipt date is invalid');
  }
  if (receipt.review_state !== contract.review_state_exact_value
      || receipt.status !== contract.status_exact_value
      || !same(receipt.base_commit_binding, contract.base_commit_binding)
      || !same(receipt.checks, contract.checks_exact_value)
      || !same(receipt.findings, contract.findings_exact_value)
      || !same(receipt.authority_boundary, contract.authority_boundary_exact_value)
      || !same(receipt.zero_effect_boundary, contract.zero_effect_boundary_exact_value)
      || !same(
        receipt.independence_attestation,
        contract.independence_attestation_exact_value,
      )) {
    throw new Error('external review receipt exact PASS contract is invalid');
  }
  assertExactKeys(
    receipt.reviewed_artifact_bindings,
    contract.reviewed_artifact_bindings_exact_keys,
    'external review artifact bindings',
  );
  const candidateRecord = JSON.parse(bytes(CANDIDATE_PATH).toString('utf8'));
  validateWork3ClosureAmendmentCandidate(candidateRecord, candidate);
  if (!same(
    receipt.reviewed_artifact_bindings,
    {
      amendment_binding: physicalRecordBinding(CANDIDATE_PATH, ID_FIELD),
      generator_binding: contract.reviewed_artifact_binding_contracts.generator_binding,
      test_binding: contract.reviewed_artifact_binding_contracts.test_binding,
    },
  )) {
    throw new Error('external review receipt three-file bindings are invalid');
  }
  validateReviewTargetCommitBinding(
    receipt.review_target_commit_binding,
    observedReviewTargetCommitBinding ?? observeReviewTargetCommitBinding(),
    receipt.reviewed_artifact_bindings,
    contract.review_target_commit_binding_contract,
  );
  assertExactKeys(
    receipt.reviewer_identity,
    contract.reviewer_identity_contract.exact_keys,
    'external review reviewer identity',
  );
  const reviewerVendorId = receipt.reviewer_identity.reviewer_vendor_id;
  const normalisedReviewerVendorId = normalisedVendorId(reviewerVendorId);
  const reviewerModelId = receipt.reviewer_identity.reviewer_model_id;
  if (!Object.values(receipt.reviewer_identity).every(nonEmptyString)
      || receipt.reviewer_identity.authoring_vendor_id !== AUTHORING_VENDOR_ID
      || reviewerModelId !== REVIEWER_MODEL_WITHHELD_VALUE
      || !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(reviewerVendorId)
      || contract.reviewer_identity_contract
        .reviewer_vendor_aliases_forbidden_case_insensitively
        .some((alias) => normalisedReviewerVendorId.includes(normalisedVendorId(alias)))) {
    throw new Error('external review receipt is not independently identified cross-vendor review');
  }
  return Object.freeze({
    amendment_id: candidate[ID_FIELD],
    external_review_receipt_id: receipt[EXTERNAL_REVIEW_RECEIPT_ID_FIELD],
    status: receipt.status,
  });
}

function candidateBytes(candidate) {
  return Buffer.from(`${canonicalJson(candidate)}\n`, 'utf8');
}

function removeIfPresent(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function createOnce(value) {
  const fullPath = join(REPO_ROOT, CANDIDATE_PATH);
  if (existsSync(fullPath)) {
    const existing = readFileSync(fullPath);
    if (!existing.equals(value)) {
      throw new Error('create-once Work3 closure amendment exists with different bytes');
    }
    return 'EXISTING_EXACT';
  }
  const tempPath = fullPath + '.tmp-work3-closure-' + process.pid + '-'
    + randomBytes(12).toString('hex');
  let descriptor = null;
  let installed = false;
  try {
    descriptor = openSync(tempPath, 'wx', 0o666);
    writeFileSync(descriptor, value);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    linkSync(tempPath, fullPath);
    installed = true;
    unlinkSync(tempPath);
    return 'CREATED_ONCE';
  } catch (error) {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Preserve the original write failure.
      }
    }
    if (installed) {
      const finalStat = lstatSync(fullPath, { bigint: true });
      const tempStat = lstatSync(tempPath, { bigint: true });
      if (finalStat.dev === tempStat.dev
          && finalStat.ino === tempStat.ino
          && readFileSync(fullPath).equals(value)) {
        removeIfPresent(fullPath);
      }
    }
    removeIfPresent(tempPath);
    throw error;
  }
}

function main() {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  if (check === write || process.argv.length !== 3) {
    throw new Error('use exactly one of --check or --write');
  }
  const candidate = buildWork3ClosureAmendmentCandidate();
  const expectedBytes = candidateBytes(candidate);
  const fullPath = join(REPO_ROOT, CANDIDATE_PATH);
  let persistenceState = 'CHECK_EXACT';
  if (check) {
    if (!existsSync(fullPath) || !readFileSync(fullPath).equals(expectedBytes)) {
      throw new Error('Work3 closure amendment candidate is missing or stale');
    }
  } else {
    persistenceState = createOnce(expectedBytes);
  }
  const result = validateWork3ClosureAmendmentCandidate(
    JSON.parse(readFileSync(fullPath, 'utf8')),
    candidate,
  );
  console.log(JSON.stringify({
    mode: check ? 'CHECK' : 'WRITE_CREATE_ONCE',
    path: CANDIDATE_PATH,
    persistence_state: persistenceState,
    result,
  }, null, 2));
}

if (process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
