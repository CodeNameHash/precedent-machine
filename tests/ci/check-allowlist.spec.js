const test = require('node:test');
const assert = require('node:assert/strict');
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

test('check-allowlist CLI names the failing file', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/check-allowlist.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PHASE_ID: '1', CHANGED_FILES: 'pages/index.js' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /pages\/index\.js/);
});
