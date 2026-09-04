const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const { detectPhase } = require('../../scripts/ci/detect-phase');

test('detect-phase accepts phase branch names', () => {
  assert.equal(detectPhase('phase-0-A/dedup'), '0-A');
  assert.equal(detectPhase('phase--1/enforcement-teeth'), '-1');
});

test('detect-phase maps tail recovery branches to base phase', () => {
  assert.equal(detectPhase('phase-0-B-tail/canonical-registry-artifacts'), '0-B');
  assert.equal(detectPhase('phase-0-B-tail-2/frozen-vocabs-and-normalize'), '0-B');
});

test('detect-phase preserves late-tail phase ids', () => {
  assert.equal(detectPhase('phase-0-B-tail-3/foo'), '0-B-tail-3');
  assert.equal(detectPhase('phase-0-B-tail-4/foo'), '0-B-tail-4');
});

test('detect-phase preserves non-tail phase ids', () => {
  assert.equal(detectPhase('phase-0-C/audit-and-reconcile'), '0-C');
  assert.equal(detectPhase('phase-0.5/foo'), '0.5');
});

test('detect-phase accepts the WP-CI-INFRA-02 self-hosting branch', () => {
  assert.equal(detectPhase('infra/ci-phase-detection-and-tail-recovery-allowlist'), 'WP-CI-INFRA-02');
});

test('detect-phase accepts wp/<slug> branches', () => {
  assert.equal(detectPhase('wp/promote-newhome-to-root'), 'WP-PROMOTE-NEWHOME-TO-ROOT');
  assert.equal(detectPhase('wp/taxonomy-map-01'), 'WP-TAXONOMY-MAP-01');
});

test('detect-phase accepts the WP-CI-INFRA-03 self-hosting branch', () => {
  assert.equal(detectPhase('infra/wp-branch-support'), 'WP-CI-INFRA-03');
});

test('detect-phase accepts the transitional PLAN system branch', () => {
  assert.equal(detectPhase('plan/land-plan-system'), 'PLAN-SYSTEM');
});

test('detect-phase accepts the exact Work3 recovery branch', () => {
  assert.equal(detectPhase('codex/recover-m7-20260812'), 'WP-RECOVER-M7-20260812');
  assert.throws(() => detectPhase('codex/recover-m7-20260813'), /Branch name must match/);
});

test('detect-phase rejects malformed wp/ slugs', () => {
  assert.throws(() => detectPhase('wp/'), /Branch name must match/);
  assert.throws(() => detectPhase('wp/-leading'), /Branch name must match/);
  assert.throws(() => detectPhase('wp/trailing-'), /Branch name must match/);
  assert.throws(() => detectPhase('wp/UPPER'), /Branch name must match/);
});

test('detect-phase rejects malformed branch names', () => {
  assert.throws(() => detectPhase('feature/random-thing'), /phase-\{N\}\/\*, wp\/<slug>, plan\/land-plan-system/);
});

test('detect-phase CLI returns phase id', () => {
  const stateFile = '.phase-id';
  const previous = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null;
  try {
    const result = spawnSync(process.execPath, ['scripts/ci/detect-phase.js', 'phase-0-A/dedup'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^0-A\s*$/);
  } finally {
    if (previous == null) fs.rmSync(stateFile, { force: true });
    else fs.writeFileSync(stateFile, previous);
  }
});
