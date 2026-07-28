const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const SCRIPT = 'scripts/preflight-local-review-controller.mjs';
const WORKFLOW = '.github/workflows/programme-gate-local-review-preflight.yml';

test('local review preflight uses ChatGPT auth without API credentials', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(source, /Logged in using ChatGPT/);
  assert.match(source, /OPENAI_API_KEY/);
  assert.match(source, /CODEX_API_KEY/);
  assert.match(source, /CODEX_ACCESS_TOKEN/);
  assert.match(source, /delete childEnvironment\[name\]/);
  assert.doesNotMatch(source, /console\.log\(.*pem|process\.stdout\.write\(.*pem/);
});

test('workflow is manual, exact-commit and protected self-hosted only', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /runs-on: \[self-hosted, macOS, ARM64, canonical-review\]/);
  assert.match(source, /environment: programme-gate-production/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /actions\/setup-node@v4/);
  assert.match(source, /Install locked dependencies without protected credentials[\s\S]*npm ci[\s\S]*Preflight protected local controller/);
  assert.match(source, /PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM/);
  assert.match(source, /PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM/);
  assert.doesNotMatch(source, /OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN/);
});
