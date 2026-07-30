const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { checkAllowlist } = require('../scripts/ci/check-allowlist');

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
