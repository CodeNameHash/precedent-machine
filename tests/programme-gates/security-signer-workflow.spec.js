const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_PATH = path.resolve(
  ROOT,
  '.github/workflows/programme-gate-sign-security.yml',
);
const SCRIPT_PATH = path.resolve(ROOT, 'scripts/sign-g0-security-dispositions.mjs');

test('the signer workflow is manual, main-only and read-only', () => {
  const workflow = YAML.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.jobs.sign.if, "github.ref == 'refs/heads/main'");
  assert.equal(workflow.jobs.sign.environment, 'programme-gate-production');
  assert.equal(workflow.jobs.sign['timeout-minutes'], 15);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
});

test('the private key is available only to the in-memory signer step', () => {
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const secretReferences = workflowSource.match(
    /secrets\.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM/g,
  ) || [];
  assert.equal(secretReferences.length, 1);
  assert.doesNotMatch(workflowSource, /echo.*PROGRAMME_GATE_VALIDATOR|printenv|set -x/);
  assert.match(workflowSource, /umask 077/);
  assert.match(workflowSource, /actions\/upload-artifact@v4/);
  assert.match(workflowSource, /rm -f programme-gate-security-evidence\.json/);
});

test('the signer excludes the private key from every child process and stdout payload', () => {
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(
    script,
    /delete environment\.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM/,
  );
  assert.doesNotMatch(script, /console\.(log|error)|process\.stderr\.write/);
  assert.match(script, /process\.stdout\.write\(`\$\{JSON\.stringify\(output\)\}\\n`\)/);
  assert.doesNotMatch(script, /private[_A-Za-z]*:\s*privateKey|pem:\s*pem/);
});
