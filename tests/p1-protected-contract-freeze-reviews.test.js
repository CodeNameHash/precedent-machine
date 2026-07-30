const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { checkAllowlist } = require('../scripts/ci/check-allowlist');
const {
  createP1ContractFreezeReviewExecutionPlan,
  finaliseP1ContractFreezeReviewExecution,
  ContractFreezeReviewTaskError,
} = require('../lib/programme-gates/contract-freeze-review-tasks');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-p1-protected-contract-freeze-reviews.mjs');
const WORKFLOW = path.join(ROOT, '.github/workflows/programme-gate-p1-contract-freeze-reviews.yml');
const ALLOWLIST = require('../.github/phase-allowlists/wp-p1-protected-contract-freeze-reviews-v1.json');

test('protected P1 producer has one closed finding schema and no gate authority', async () => {
  const { FINDING_OUTPUT_SCHEMA } = await import(`${pathToFileUrl(SCRIPT)}?test=${Date.now()}`);
  assert.deepEqual(FINDING_OUTPUT_SCHEMA.required, ['disposition', 'findings']);
  assert.equal(FINDING_OUTPUT_SCHEMA.additionalProperties, false);
  assert.deepEqual(FINDING_OUTPUT_SCHEMA.properties.disposition.enum, ['PASS', 'BLOCKING', 'NON-BLOCKING']);
  assert.match(fs.readFileSync(SCRIPT, 'utf8'), /EVIDENCE_CREATED_NO_GATE_AUTHORITY/);
  assert.doesNotMatch(fs.readFileSync(SCRIPT, 'utf8'), /P1_CONTRACT_FREEZE_ATTESTED:\s*PASS/);
});

test('protected P1 producer enforces exact clean code, exact package and three concurrent fresh read-only sessions', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(source, /exactCleanCommit\(commit\)/);
  assert.match(source, /sourceClosure\(commit, nonce\)/);
  assert.match(source, /Promise\.all\(P1_CONTRACT_FREEZE_REVIEW_LANES\.map/);
  assert.match(source, /new Set\(sessions\)\.size/);
  assert.match(source, /'-s', 'read-only'/);
  assert.match(source, /'--ephemeral'/);
  assert.match(source, /PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM/);
  assert.match(source, /review output must be outside the checkout in RUNNER_TEMP/);
});

test('protected workflow runs only on exact main, uses the protected key, and deletes the external artifact', () => {
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /git rev-parse origin\/main/);
  assert.match(workflow, /PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM/);
  assert.match(workflow, /runner\.temp/);
  assert.match(workflow, /Remove runner output/);
});

test('protected P1 producer allowlist is closed around the controller path', () => {
  const expected = [
    '.github/phase-allowlists/wp-p1-protected-contract-freeze-reviews-v1.json',
    '.github/workflows/programme-gate-p1-contract-freeze-reviews.yml',
    'lib/programme-gates/contract-freeze-review-tasks.js',
    'scripts/run-p1-protected-contract-freeze-reviews.mjs',
    'tests/p1-protected-contract-freeze-reviews.test.js',
  ];
  assert.equal(ALLOWLIST.required_work_class, 'canonical_work_start');
  assert.deepEqual(ALLOWLIST.allowed, expected);
  const checked = checkAllowlist({ phase: ALLOWLIST.phase, files: expected });
  assert.deepEqual(checked.denied, []);
  assert.deepEqual(checked.outside, []);
});

function pathToFileUrl(file) {
  return require('node:url').pathToFileURL(file).href;
}

test('sealed pre-execution templates finalise only from observed fresh sessions', async () => {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const { generateReviewSourceClosure } = await import(
    `${pathToFileUrl(path.join(ROOT, 'scripts/generate-canonical-contract-current-review.mjs'))}?plan=${Date.now()}`,
  );
  const closure = JSON.parse(generateReviewSourceClosure({
    repositoryRoot: ROOT,
    codeCommit: commit,
    approvalEpochNonce: 'protected-p1-producer-test',
  }).toString('utf8'));
  const packageBytes = Buffer.from(canonicalJson(closure.exact_review_package), 'utf8');
  const plan = createP1ContractFreezeReviewExecutionPlan({
    schema_version: 'P1ContractFreezeReviewExecutionPlanInput/V1',
    exact_review_package_fingerprint: closure.exact_review_package_fingerprint,
    exact_review_package_bytes_base64: packageBytes.toString('base64'),
    code_commit: commit,
    frozen_contract_pair_digest: closure.exact_review_package.frozen_contract_pair_digest,
    source_closure_identity: closure.exact_review_package.contract_freeze_attestation_identity,
  });
  const observedReviews = plan.task_templates.map((template, index) => ({
    lane_id: template.lane_id,
    immutable_session_id: `observed-fresh-session-${index + 1}`,
    reviewer_model_identifier: 'gpt-5.6-sol',
    reasoning_level: 'high',
    finding_output: { disposition: 'PASS', findings: [] },
  }));
  const finalised = finaliseP1ContractFreezeReviewExecution({
    executionPlan: plan,
    observedReviews,
    gitRuntime: { repositoryRoot: ROOT },
  });
  assert.deepEqual(
    finalised.results.map((result) => result.immutable_session_id),
    observedReviews.map((review) => review.immutable_session_id),
  );
  assert.equal(new Set(finalised.request.tasks.map(
    (task) => task.reviewer_binding.reviewer_principal_id,
  )).size, 3);
  const { signedCarriers } = await import(
    `${pathToFileUrl(SCRIPT)}?signed=${Date.now()}`,
  );
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const carriers = signedCarriers(
    finalised.request,
    finalised.results,
    privateKey,
  );
  assert.equal(
    carriers.registration.gate_id,
    'P1_CONTRACT_FREEZE_ATTESTED',
  );
  assert.throws(
    () => signedCarriers(
      { ...finalised.request, gate_id: 'P1_VERTICAL_SLICE_PASS' },
      finalised.results,
      privateKey,
    ),
    /exact governed P1 gate ID/,
  );
  const missingGate = { ...finalised.request };
  delete missingGate.gate_id;
  assert.throws(
    () => signedCarriers(missingGate, finalised.results, privateKey),
    /exact governed P1 gate ID/,
  );
  const duplicate = observedReviews.map((review) => ({ ...review }));
  duplicate[1].immutable_session_id = duplicate[0].immutable_session_id;
  assert.throws(() => finaliseP1ContractFreezeReviewExecution({
    executionPlan: plan,
    observedReviews: duplicate,
    gitRuntime: { repositoryRoot: ROOT },
  }), (error) => error instanceof ContractFreezeReviewTaskError && error.code === 'DUPLICATE_P1_REVIEWER');
});
