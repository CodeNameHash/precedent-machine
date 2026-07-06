const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const { dedupeRegistry } = require('../../scripts/registry/dedupe');

const INVARIANT_COMMANDS = [
  ['node', ['scripts/audit/ioc-scope-mismatch.js'], /^INVARIANT-2: PASS/m],
  ['node', ['scripts/lint/closing-condition-scope.js'], /^INVARIANT-3: PASS/m],
  ['bash', ['scripts/lint/forbidden-patterns.sh'], /^INVARIANT-4: PASS/m],
  ['node', ['scripts/lint/market-registry-completeness.js'], /^INVARIANT-5: PASS/m],
  ['node', ['scripts/lint/component-reuse.js'], /^INVARIANT-6: PASS/m],
  ['node', ['scripts/lint/party-scope-audit.js'], /^INVARIANT-7: PASS/m],
  ['node', ['scripts/registry/detect-duplicates.js'], /^INVARIANT-8: PASS/m],
  ['node', ['scripts/registry/orphan-detector.js'], /^INVARIANT-9: PASS/m],
  ['node', ['scripts/registry/coverage-detector.js'], /^INVARIANT-10: PASS/m],
  ['node', ['scripts/registry/provenance-log.js'], /^INVARIANT-11: PASS/m],
];

const SCRIPT_FILES = [
  'scripts/audit/ioc-scope-mismatch.js',
  'scripts/lint/closing-condition-scope.js',
  'scripts/lint/forbidden-patterns.sh',
  'scripts/lint/market-registry-completeness.js',
  'scripts/lint/component-reuse.js',
  'scripts/lint/party-scope-audit.js',
  'scripts/registry/dedupe.js',
  'scripts/registry/detect-duplicates.js',
  'scripts/registry/orphan-detector.js',
  'scripts/registry/coverage-detector.js',
  'scripts/registry/provenance-log.js',
  'scripts/ci/detect-phase.js',
  'scripts/ci/check-allowlist.js',
  'scripts/ci/run-all-invariants.sh',
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function appendixFBlocks() {
  const src = fs.readFileSync('pm-master-straitjacket.codex.md', 'utf8');
  const appendix = src.slice(src.indexOf('# APPENDIX F'), src.indexOf('# APPENDIX G'));
  return [...appendix.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]));
}

test('PH-1-A every invariant and CI script exists and is executable', () => {
  for (const file of SCRIPT_FILES) {
    assert.equal(fs.existsSync(file), true, file);
    assert.notEqual(fs.statSync(file).mode & 0o111, 0, file);
  }
});

test('PH-1-B every invariant script exits cleanly with PASS stdout', () => {
  for (const [cmd, args, pattern] of INVARIANT_COMMANDS) {
    const result = spawnSync(cmd, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, `${cmd} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, pattern);
  }
});

test('PH-1-C phase allowlist files match Appendix F', () => {
  const blocks = appendixFBlocks().filter((block) => block.phase !== '-1');
  for (const block of blocks) {
    const actual = JSON.parse(fs.readFileSync(`.github/phase-allowlists/phase-${block.phase}.json`, 'utf8'));
    assert.deepEqual(actual, block);
  }
});

test('PH-1-D ACK reference pins straitjacket SHA256', () => {
  const reference = fs.readFileSync('docs/acks/ACK-MASTER-V1.reference.md', 'utf8');
  assert.match(reference, new RegExp(`PM_MASTER_STRAITJACKET_SHA256: ${sha256('pm-master-straitjacket.codex.md')}`));
  assert.match(reference, /I acknowledge master straitjacket WP-MASTER-V1/);
  const worklog = fs.readFileSync('WORKLOG-P-1.md', 'utf8');
  assert.match(worklog, new RegExp(`PM_MASTER_STRAITJACKET_SHA256: ${sha256('pm-master-straitjacket.codex.md')}`));
});

test('PH-1-E CI workflow names every invariant script', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const [, args] of INVARIANT_COMMANDS) {
    assert.match(ci, new RegExp(args[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('dedupe skeleton merges cross-origin rows and flags true duplicates', () => {
  const result = dedupeRegistry({
    generated_from: [],
    fields: [
      { key: 'mainConcept', origin: 'schema-features', applies_to: 'CONSID' },
      { key: 'mainConcept', origin: 'rubric-features', applies_to: 'ANTI' },
      { key: 'carveouts', origin: 'appendix-a-priority' },
      { key: 'carveOuts', origin: 'appendix-a-priority' },
    ],
  });
  const mainConcept = result.registry.fields.find((row) => row.key === 'mainConcept');
  assert.equal(mainConcept.merged_from.length, 1);
  assert.deepEqual(mainConcept.also_matches_provision_codes, ['ANTI']);
  assert.equal(result.registry.fields.filter((row) => row.review_flag === 'REQUIRES_REVIEWER_DECISION').length, 2);
});
