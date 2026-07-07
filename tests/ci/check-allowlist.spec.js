const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const { checkAllowlist, isAlwaysAllowed, matchesPattern } = require('../../scripts/ci/check-allowlist');

test('matches exact files, directory prefixes, and simple globs', () => {
  assert.equal(matchesPattern('components/review/Sidebar.js', 'components/review/Sidebar.js'), true);
  assert.equal(matchesPattern('db/migrations/001.sql', 'db/migrations/'), true);
  assert.equal(matchesPattern('tests/review/phase-3-a.spec.js', 'tests/review/phase-3-*.spec.js'), true);
});

test('check-allowlist accepts in-scope files', () => {
  const result = checkAllowlist({
    phase: '1',
    files: ['components/review/ConsiderationHeroRow.jsx', 'WORKLOG-P1.md'],
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
});

test('check-allowlist bootstrap-passes Phase -1', () => {
  const result = checkAllowlist({
    phase: '-1',
    files: ['.github/workflows/ci.yml', 'scripts/ci/check-allowlist.js'],
  });
  assert.equal(result.bootstrap, true);
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
});

test('check-allowlist rejects out-of-scope files', () => {
  const result = checkAllowlist({ phase: '1', files: ['pages/index.js'] });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, ['pages/index.js']);
});

test('check-allowlist always allows root BLOCKED files', () => {
  assert.equal(isAlwaysAllowed('BLOCKED-P0-B-TAIL-2.md'), true);
  assert.equal(isAlwaysAllowed('docs/BLOCKED-P0-B-TAIL-2.md'), false);
  const result = checkAllowlist({ phase: '1', files: ['BLOCKED-P0-B-TAIL-2.md'] });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
});

test('check-allowlist self-hosts WP-CI-INFRA-02', () => {
  const result = checkAllowlist({
    phase: 'WP-CI-INFRA-02',
    files: [
      'scripts/ci/detect-phase.js',
      'scripts/ci/check-allowlist.js',
      '.github/phase-allowlists/phase-0-B.json',
      'HANDOFF.md',
      'tests/ci/detect-phase.spec.js',
      'tests/ci/check-allowlist.spec.js',
    ],
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
});

test('check-allowlist self-hosts WP-CI-INFRA-03', () => {
  const result = checkAllowlist({
    phase: 'WP-CI-INFRA-03',
    files: [
      'scripts/ci/detect-phase.js',
      'scripts/ci/check-allowlist.js',
      'tests/ci/detect-phase.spec.js',
      'tests/ci/check-allowlist.spec.js',
      'HANDOFF.md',
    ],
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
});

test('check-allowlist rejects out-of-scope WP-CI-INFRA-03 files', () => {
  const result = checkAllowlist({
    phase: 'WP-CI-INFRA-03',
    files: ['scripts/ci/detect-phase.js', '.github/workflows/ci.yml'],
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, ['.github/workflows/ci.yml']);
});

test('check-allowlist self-hosts PLAN system branch', () => {
  const result = checkAllowlist({
    phase: 'PLAN-SYSTEM',
    files: [
      '.github/phase-allowlists/phase-0-D.json',
      'PLAN.md',
      'PLAN-M1-review-queue.md',
      'PLAN-M2-schema-deploy.md',
      'PLAN-M3-ingest-seamless.md',
      'PLAN-M4-query.md',
      'PLAN-M5-ui-homogenized.md',
      'PLAN-TAXONOMY-GAPS.md',
      'docs/acks/ACK-MASTER-V1.reference.md',
      'pm-master-straitjacket.codex.md',
      'pm-wp-ux-shell.codex.md',
      'scripts/ci/detect-phase.js',
      'scripts/ci/check-allowlist.js',
      'tests/ci/detect-phase.spec.js',
      'tests/ci/check-allowlist.spec.js',
      'WORKLOG-P-1.md',
    ],
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
});

test('check-allowlist loads wp/<slug> allowlist files', () => {
  const file = '.github/phase-allowlists/wp-test-wp.json';
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  try {
    fs.writeFileSync(file, `${JSON.stringify({
      phase: 'WP-TEST-WP',
      name: 'test-wp',
      allowed: ['allowed/path.js', 'HANDOFF.md'],
      denied: ['denied/**'],
      note: 'temporary test fixture',
    }, null, 2)}\n`);
    const pass = checkAllowlist({
      phase: 'WP-TEST-WP',
      files: ['allowed/path.js', 'HANDOFF.md'],
    });
    assert.deepEqual(pass.denied, []);
    assert.deepEqual(pass.outside, []);

    const fail = checkAllowlist({
      phase: 'WP-TEST-WP',
      files: ['allowed/path.js', 'denied/file.js', 'other/file.js'],
    });
    assert.deepEqual(fail.denied, ['denied/file.js']);
    assert.deepEqual(fail.outside, ['other/file.js']);
  } finally {
    if (previous == null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, previous);
  }
});

test('check-allowlist CLI names the failing file', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/check-allowlist.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PHASE_ID: '1', CHANGED_FILES: 'pages/index.js' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /pages\/index\.js/);
});
