'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LINTER = path.join(ROOT, 'scripts', 'lint', 'forbidden-patterns.sh');
const DUPLICATE_CHECK = path.join(ROOT, 'scripts', 'lint', 'resolution-registry-duplicates.js');
const LEDGER = 'evidence/canonical-v2/stage-2y-f-lexical-classification.json';
const REPRESENTATION_REPLAY = 'evidence/canonical-v2/stage-2y-h-representation-topic-replay.json';

function lintFixture({ relativePath, source }) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'forbidden-patterns-stage-2y-f-'));
  const target = path.join(fixture, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts', 'lint'), { recursive: true });
  fs.copyFileSync(DUPLICATE_CHECK, path.join(fixture, 'scripts', 'lint', 'resolution-registry-duplicates.js'));
  fs.writeFileSync(target, source);
  try {
    return spawnSync('bash', [LINTER, fixture], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CHANGED_FILES: relativePath },
    });
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

test('Stage 2Y-F lexical evidence ignores prose-only fingerprints', () => {
  const result = lintFixture({ relativePath: LEDGER, source: 'QUALIFICATION from recorded agreement text litigation' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('Stage 2Y-F lexical evidence still rejects code fingerprints', () => {
  const result = lintFixture({ relativePath: LEDGER, source: 'const unsafe: any <any> = value;' });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${LEDGER} :: any\\s*<any>`));
});

test('other evidence files remain subject to prose-only fingerprints', () => {
  const otherEvidence = 'evidence/canonical-v2/stage-2y-f-lexical-classification-copy.json';
  const result = lintFixture({ relativePath: otherEvidence, source: 'QUALIFICATION from recorded agreement text litigation' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, new RegExp(`${otherEvidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} :: QUALIFICATION\\.\\*litigation`));
});

test('Stage 2Y-H representation replay ignores prose-only fingerprints', () => {
  const result = lintFixture({ relativePath: REPRESENTATION_REPLAY, source: 'QUALIFICATION from recorded agreement text litigation' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('Stage 2Y-H representation replay still rejects code fingerprints', () => {
  const result = lintFixture({ relativePath: REPRESENTATION_REPLAY, source: 'const unsafe: any <any> = value;' });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${REPRESENTATION_REPLAY} :: any\\s*<any>`));
});

test('Stage 2Y-H adjacent replay paths remain subject to prose-only fingerprints', () => {
  const adjacentReplay = 'evidence/canonical-v2/stage-2y-h-representation-topic-replay-copy.json';
  const result = lintFixture({ relativePath: adjacentReplay, source: 'QUALIFICATION from recorded agreement text litigation' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, new RegExp(`${adjacentReplay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} :: QUALIFICATION\\.\\*litigation`));
});
