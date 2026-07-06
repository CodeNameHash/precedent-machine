const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const { detectPhase } = require('../../scripts/ci/detect-phase');

test('detect-phase accepts phase branch names', () => {
  assert.equal(detectPhase('phase-0-A/dedup'), '0-A');
  assert.equal(detectPhase('phase--1/enforcement-teeth'), '-1');
});

test('detect-phase rejects malformed branch names', () => {
  assert.throws(() => detectPhase('feature/random-thing'), /phase-\{N\}/);
});

test('detect-phase CLI returns phase id', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/detect-phase.js', 'phase-0-A/dedup'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^0-A\s*$/);
});
