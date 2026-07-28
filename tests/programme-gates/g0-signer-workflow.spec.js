const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_PATH = path.resolve(
  ROOT,
  '.github/workflows/programme-gate-sign-g0.yml',
);
const SCRIPT_PATH = path.resolve(ROOT, 'scripts/sign-g0-evidence.mjs');

test('the G0 signer workflow is manual, main-only and read-only', () => {
  const workflow = YAML.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.jobs.sign.if, "github.ref == 'refs/heads/main'");
  assert.equal(workflow.jobs.sign.environment, 'programme-gate-production');
  assert.equal(workflow.jobs.sign['timeout-minutes'], 20);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(
    Object.keys(workflow.on.workflow_dispatch.inputs).sort(),
    ['deployment_id', 'expected_commit', 'preview_deployment_id'],
  );
});

test('the protected credentials exist only in the combined in-memory signer step', () => {
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const workflow = YAML.parse(workflowSource);
  const validatorReferences = workflowSource.match(
    /secrets\.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM/g,
  ) || [];
  const vercelReferences = workflowSource.match(/secrets\.VERCEL_TOKEN/g) || [];
  const supabaseReferences = workflowSource.match(
    /secrets\.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY/g,
  ) || [];
  assert.equal(validatorReferences.length, 1);
  assert.equal(vercelReferences.length, 1);
  assert.equal(supabaseReferences.length, 1);
  assert.doesNotMatch(
    workflowSource,
    /echo.*PROGRAMME_GATE_VALIDATOR|echo.*VERCEL_TOKEN|printenv|set -x/,
  );
  assert.match(workflowSource, /umask 077/);
  assert.match(workflowSource, /actions\/upload-artifact@v4/);
  assert.equal(
    workflow.jobs.sign.steps.find((step) => step.name === 'Upload signed evidence')
      .with.path,
    '${{ runner.temp }}/programme-gate-g0-evidence.json',
  );
  assert.match(
    workflowSource,
    /rm -f "\$\{RUNNER_TEMP\}\/programme-gate-g0-evidence\.json"/,
  );
  assert.doesNotMatch(
    workflowSource,
    /> programme-gate-g0-evidence\.json/,
  );
});

test('the signer excludes both protected credentials from every child process and payload', () => {
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(
    script,
    /delete environment\.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM/,
  );
  assert.match(script, /delete environment\.VERCEL_TOKEN/);
  assert.match(
    script,
    /delete environment\.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY/,
  );
  assert.doesNotMatch(script, /console\.(log|error)|process\.stderr\.write/);
  assert.match(script, /process\.stdout\.write\(`\$\{JSON\.stringify\(output\)\}\\n`\)/);
  assert.doesNotMatch(
    script,
    /private[_A-Za-z]*:\s*privateKey|pem:\s*pem|vercel_token|vercelToken:\s*token/,
  );
});
