const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_PATH = path.resolve(
  ROOT,
  '.github/workflows/programme-gate-sign-successor.yml',
);
const SIGNER_PATH = path.resolve(ROOT, 'scripts/sign-g0-evidence.mjs');

function workflowFixture() {
  const source = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  return {
    source,
    workflow: YAML.parse(source),
  };
}

test('successor publication is a manual exact-main protected operation', () => {
  const { workflow } = workflowFixture();
  const dispatch = workflow.on.workflow_dispatch;
  const inputs = dispatch.inputs;
  const signJob = workflow.jobs.sign;

  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(inputs).sort(), [
    'authorisation_intent',
    'cold_review_run_id',
    'deployment_id',
    'expected_commit',
    'predecessor_publication_commit',
    'preview_deployment_id',
    'review_basis_commit',
    'review_basis_root',
  ]);
  for (const input of Object.values(inputs)) assert.equal(input.required, true);
  assert.match(signJob.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(signJob.if, /github\.actor == 'CodeNameHash'/);
  assert.match(signJob.if, /github\.actor_id == '264183176'/);
  assert.match(
    signJob.if,
    /AUTHORISE_ISOLATED_STAGING_CANONICAL_IMPLEMENTATION/,
  );
  assert.equal(signJob.environment, 'programme-gate-production');
  assert.deepEqual(workflow.permissions, { actions: 'read', contents: 'write' });
  assert.equal(workflow.concurrency.group, 'programme-status-publication');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);

  const checkout = signJob.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.ref, '${{ inputs.expected_commit }}');
  assert.equal(checkout.with['fetch-depth'], 0);
});

test('workflow verifies the exact current main and protected predecessor', () => {
  const { workflow } = workflowFixture();
  const step = workflow.jobs.sign.steps.find(
    (candidate) => candidate.name === 'Verify exact current main and predecessor',
  );

  assert.deepEqual(step.env, {
    EXPECTED_PROGRAMME_COMMIT: '${{ inputs.expected_commit }}',
    EXPECTED_PROGRAMME_PREDECESSOR_COMMIT:
      '${{ inputs.predecessor_publication_commit }}',
  });
  assert.match(step.run, /test "\$\{GITHUB_SHA\}" = "\$\{EXPECTED_PROGRAMME_COMMIT\}"/);
  assert.match(
    step.run,
    /test "\$\(git rev-parse HEAD\)" = "\$\{EXPECTED_PROGRAMME_COMMIT\}"/,
  );
  assert.match(
    step.run,
    /refs\/heads\/main:refs\/remotes\/origin\/main/,
  );
  assert.match(
    step.run,
    /refs\/heads\/programme-status-publication-head:refs\/remotes\/origin\/programme-status-publication-head/,
  );
  assert.match(
    step.run,
    /test "\$\(git rev-parse refs\/remotes\/origin\/main\)" = "\$\{EXPECTED_PROGRAMME_COMMIT\}"/,
  );
  assert.match(
    step.run,
    /test "\$\(git rev-parse refs\/remotes\/origin\/programme-status-publication-head\)" = "\$\{EXPECTED_PROGRAMME_PREDECESSOR_COMMIT\}"/,
  );
  assert.match(step.run, /test -z "\$\(git status --porcelain\)"/);
});

test('protected secrets exist exactly once and only in the successor signer environment', () => {
  const { source, workflow } = workflowFixture();
  const signer = workflow.jobs.sign.steps.find(
    (step) => step.name === 'Collect, validate, sign and publish successor',
  );
  const secretBindings = {
    PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM:
      'PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM',
    PROGRAMME_GATE_PREVIEW_ACCESS_MATRIX_JSON:
      'PROGRAMME_GATE_PREVIEW_ACCESS_MATRIX_JSON',
    PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY:
      'PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY',
    PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM:
      'PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM',
    PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM:
      'PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM',
    VERCEL_TOKEN: 'VERCEL_TOKEN',
  };

  for (const [environmentName, secretName] of Object.entries(secretBindings)) {
    assert.equal(
      signer.env[environmentName],
      `\${{ secrets.${secretName} }}`,
    );
    assert.equal(
      (source.match(new RegExp(`secrets\\.${secretName}`, 'g')) || []).length,
      1,
    );
  }
  assert.equal(signer.env.PROGRAMME_STATUS_PUBLICATION_MODE, 'SUCCESSOR');
  assert.equal(
    signer.env.EXPECTED_PROGRAMME_PREDECESSOR_COMMIT,
    '${{ inputs.predecessor_publication_commit }}',
  );
  assert.match(signer.run, /set -euo pipefail/);
  assert.match(signer.run, /umask 077/);
  assert.doesNotMatch(source, /printenv|set -x/);
});

test('workflow verifies after publication and always removes transient output', () => {
  const { workflow } = workflowFixture();
  const steps = workflow.jobs.sign.steps;
  const signerIndex = steps.findIndex(
    (step) => step.name === 'Collect, validate, sign and publish successor',
  );
  const verifierIndex = steps.findIndex(
    (step) => step.name === 'Verify published successor',
  );
  const cleanup = steps.find((step) => step.name === 'Remove runner output');

  assert.ok(signerIndex >= 0);
  assert.ok(verifierIndex > signerIndex);
  assert.equal(
    steps[verifierIndex].run,
    'node scripts/verify-programme-status-publication.mjs',
  );
  assert.equal(cleanup.if, 'always()');
  assert.match(
    cleanup.run,
    /rm -f "\$\{RUNNER_TEMP\}\/programme-gate-successor-evidence\.json"/,
  );
  assert.match(
    cleanup.run,
    /rm -rf "\$\{RUNNER_TEMP\}\/cold-reviews"/,
  );
});

test('signer loads the exact predecessor and uses the successor nonce path', () => {
  const signer = fs.readFileSync(SIGNER_PATH, 'utf8');

  assert.match(
    signer,
    /const currentRef = mode === 'SUCCESSOR'\s*\?\s*loadCurrentProgrammePublication\(\{/,
  );
  assert.match(
    signer,
    /currentRef\.observed_git_object_id !== requireCommit\(\s*process\.env\.EXPECTED_PROGRAMME_PREDECESSOR_COMMIT/,
  );
  assert.match(
    signer,
    /generation: currentRef\.generation \+ 1,[\s\S]*predecessorStatusId: currentRef\.status_artefact_id,[\s\S]*bootstrapState: 'CONSUMED'/,
  );
  assert.match(
    signer,
    /bootstrapNonce: mode === 'SUCCESSOR' \? 'NONE' : BOOTSTRAP_NONCE/,
  );
  assert.match(
    signer,
    /remoteRef\(ROOT, 'origin', currentRef\.ref\) !== currentRef\.observed_git_object_id/,
  );
  assert.match(
    signer,
    /executeProgrammeStatusPublication\(\{[\s\S]*plan: publicationPlan,[\s\S]*repositoryRoot: ROOT,[\s\S]*remote: 'origin'/,
  );
});
