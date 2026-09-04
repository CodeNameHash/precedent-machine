'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildV2ViewPolicy,
  projectAgreement,
} = require('../lib/canonical-v2/agreement-projection');
const {
  validateViewPolicyForProjection,
} = require('../lib/canonical-v2/m7-v2-contract');
const {
  loadSevenFamilyGroupingPreview,
} = require('../lib/canonical-v2/seven-family-grouping-preview-source');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROFILE_SET_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-approved-profile-set.json';
const VIEW_POLICY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/v2-view-policy.json';
// Work4 candidate correction (Ben, 2026-09-03): with the correction authority
// in the tree the governed Work4 manifest is the successor, and the committed
// original is retained as a superseded record that this test no longer
// validates against the live tree.
const CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work4-candidate-correction-authority.json';
const MANIFEST_PATH = fs.existsSync(path.join(REPO_ROOT, CORRECTION_AUTHORITY_PATH))
  ? 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json'
  : 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest.json';

function readCanonical(repositoryPath) {
  const bytes = fs.readFileSync(path.join(REPO_ROOT, repositoryPath));
  const record = JSON.parse(bytes.toString('utf8'));
  assert.equal(bytes.toString('utf8'), `${canonicalJson(record)}\n`);
  return record;
}

function candidateStateTestOptions(repoRoot = REPO_ROOT) {
  return fs.existsSync(path.join(repoRoot, MANIFEST_PATH))
    ? {}
    : { skip: 'Work4 candidate transition has not created the execution manifest' };
}

test('Work4 view policy is the deterministic generic policy for every approved profile', () => {
  const profileSet = readCanonical(PROFILE_SET_PATH);
  const policy = readCanonical(VIEW_POLICY_PATH);
  const expected = buildV2ViewPolicy(profileSet.profiles);

  assert.deepEqual(policy, expected);
  assert.equal(policy.schema_version, 'STAGE_2Y_M7_V2_VIEW_POLICY/V1');
  const unsignedPolicy = { ...policy };
  delete unsignedPolicy.view_policy_id;
  assert.equal(
    policy.view_policy_id,
    contentId(policy.schema_version, unsignedPolicy),
  );
  assert.equal(policy.labels.length, 23);
  assert.equal(policy.formatters.length, 12);
  assert.deepEqual(policy.layouts.map((layout) => layout.required_classification_levels), [
    ['APPLIES_TO', 'PROVISION_TYPE'],
    ['APPLIES_TO', 'PROVISION_TYPE'],
  ]);
  assert.equal(policy.grouping_policy.allowed, false);
  validateViewPolicyForProjection(policy);
});

test('Work4 validates the sealed Work3 receipt against its pinned Git tree', async () => {
  const { validateWork3 } = await import(
    '../scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs'
  );
  const result = validateWork3({
    repoRoot: REPO_ROOT,
    sourceCommit: 'a0df3f8621107481144e5be1429466d8b193f9be',
  });

  assert.equal(result.schema_version, 'STAGE_2Y_M7_V2_REPAIR_WORK3_VALIDATION/V2');
  assert.equal(result.status, 'PASS');
  assert.equal(result.work3_receipt_id,
    '29381fbb51555e5ada776be29245348d6f5b3830ff0eaada28ba3b28ccab2c4b');
  assert.equal(result.family_package_count, 24);
  assert.equal(result.profile_count, 1382);
});

test('Work4 candidate-state gate opens only when the exact manifest exists', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work4-state-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(
    candidateStateTestOptions(root).skip,
    'Work4 candidate transition has not created the execution manifest');
  const manifest = path.join(root, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, '{}\n');
  assert.deepEqual(candidateStateTestOptions(root), {});
});

test('Work4 binds and independently verifies one exact 24-family candidate',
  candidateStateTestOptions(), async () => {
  const { validateExecutionManifest } = await import(
    '../scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs'
  );
  const { verifyRegisteredCandidate } = await import(
    '../scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs'
  );
  const manifest = readCanonical(MANIFEST_PATH);
  const result = await validateExecutionManifest({
    repoRoot: REPO_ROOT,
    manifestPath: MANIFEST_PATH,
  });
  const registrationPath = manifest.candidate_registration_binding.registration_binding.path;
  const verification = verifyRegisteredCandidate({
    repoRoot: REPO_ROOT,
    registrationPath,
  });

  assert.equal(result.status, 'PASS_NARROWING_EXECUTION_MANIFEST');
  assert.equal(result.candidate_stage_state, 'VERIFIED_CANDIDATE_BOUND');
  assert.equal(result.candidate_registration_id, verification.candidate_registration_id);
  assert.equal(verification.state, 'PASS_CANDIDATE_REGISTRATION');
  assert.equal(verification.counts.subtype_tree_count, 24);
  assert.equal(verification.checks.some(
    (entry) => entry.check_id === 'EXACT_24_SEALED_PACKAGE_SUBTYPE_TREE_MEMBER_BINDINGS',
  ), true);
  const registration = readCanonical(registrationPath);
  assert.equal(registration.code_bindings.tests.some(
    (binding) => binding.path
      === 'tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js',
  ), true);
});

test('Work4 keeps every unmeasured IOC threshold and exception visible and review-only', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: { NODE_ENV: 'test' } });
  const interimOperating = preview.families.find(
    (family) => family.family_key === 'INTERIM_OPERATING',
  );
  const statuses = interimOperating.v2_rows.flatMap(
    (row) => row.profiles.flatMap((profile) => profile.measurement_statuses),
  );

  assert.equal(interimOperating.profile_count, 113);
  assert.equal(statuses.length, 226);
  assert.equal(statuses.every(
    (status) => status.measurement_state === 'NOT_YET_MEASURED'
      && status.disposition === null,
  ), true);
  assert.deepEqual(interimOperating.measurement_summary, {
    required_disposition_count: 226,
    explicit_disposition_count: 0,
    not_yet_measured_count: 226,
    absent_count: 0,
    review_only: true,
    comparison_complete: false,
    product_ready: false,
  });
});

test('the Work4 projector rejects every V1 analysis at its public seam', () => {
  assert.throws(
    () => projectAgreement({ schema_version: 'AGREEMENT_ANALYSIS/V1' }, {}),
    (error) => error.code === 'M7_V2_SCHEMA',
  );
});
