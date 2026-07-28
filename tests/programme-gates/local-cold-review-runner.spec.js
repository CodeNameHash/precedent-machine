const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const SCRIPT = 'scripts/run-g0-local-cold-reviews.mjs';
const WORKFLOW = '.github/workflows/programme-gate-local-cold-reviews.yml';

test('runner creates five fresh read-only ChatGPT-authenticated review sessions', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(source, /COLD_REVIEW_TASKS\.map/);
  assert.match(source, /fs\.mkdtempSync/);
  assert.match(source, /fs\.copyFileSync\(authFile/);
  assert.match(source, /chmodSync\(path\.join\(codexHome, 'auth\.json'\), 0o600\)/);
  assert.match(source, /env: \{\}/);
  assert.match(source, /sourceDigest\(specificationDirectory\)/);
  assert.match(source, /review changed frozen inputs/);
  assert.match(source, /fs\.rmSync\(runRoot, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(source, /console\.log\(.*auth|readFileSync\(authFile,\s*['"]utf8/);
  assert.doesNotMatch(source, /OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN/);
});

test('workflow is manual, protected, exact-commit and one-use-runner compatible', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /runs-on: \[self-hosted, macOS, ARM64, canonical-review\]/);
  assert.match(source, /environment: programme-gate-production/);
  assert.match(source, /fetch-depth: 0/);
  assert.match(source, /persist-credentials: false/);
  assert.match(
    source,
    /Install locked dependencies without protected credentials[\s\S]*npm ci[\s\S]*Run protected local cold reviews/,
  );
  assert.match(source, /PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM/);
  assert.match(source, /PROGRAMME_REVIEW_OUTPUT: \$\{\{ runner\.temp \}\}/);
  assert.match(source, /if: always\(\)[\s\S]*rm -f/);
  assert.doesNotMatch(source, /OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN/);
});

test('review output cannot be written into the checkout', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(source, /path\.isAbsolute\(outputPath/);
  assert.match(source, /outputPath\.startsWith\(`\$\{process\.env\.RUNNER_TEMP\}\//);
  assert.match(source, /review output must be outside the checkout in RUNNER_TEMP/);
});
