const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');

const {
  MAX_CHANGED_FILES_BYTES,
  checkAllowlist,
  isAlwaysAllowed,
  matchesPattern,
} = require('../../scripts/ci/check-allowlist');

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

test('check-allowlist reads a large changed-file set from a bounded file handoff', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-allowlist-files-'));
  const changedFilesFile = path.join(directory, 'changed-files.txt');
  try {
    const input = `${'components/review/ConsiderationHeroRow.jsx\n'.repeat(70_000)}`;
    assert.ok(Buffer.byteLength(input) > 2 * 1024 * 1024);
    assert.ok(Buffer.byteLength(input) < MAX_CHANGED_FILES_BYTES);
    fs.writeFileSync(changedFilesFile, input);

    const result = spawnSync(process.execPath, ['scripts/ci/check-allowlist.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CHANGED_FILES: '',
        CHANGED_FILES_FILE: changedFilesFile,
        PHASE_ID: '1',
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PHASE-ALLOWLIST: PASS phase 1/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('check-allowlist fails closed when the changed-file handoff is missing or empty', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-allowlist-empty-'));
  const emptyFile = path.join(directory, 'empty.txt');
  fs.writeFileSync(emptyFile, '');
  try {
    for (const changedFilesFile of [path.join(directory, 'missing.txt'), emptyFile]) {
      const result = spawnSync(process.execPath, ['scripts/ci/check-allowlist.js'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CHANGED_FILES: 'components/review/ConsiderationHeroRow.jsx',
          CHANGED_FILES_FILE: changedFilesFile,
          PHASE_ID: '1',
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /CHANGED_FILES_FILE/);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('check-allowlist fails closed when the changed-file handoff exceeds its bound', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-allowlist-oversized-'));
  const oversizedFile = path.join(directory, 'oversized.txt');
  fs.writeFileSync(oversizedFile, 'x');
  fs.truncateSync(oversizedFile, MAX_CHANGED_FILES_BYTES + 1);
  try {
    const result = spawnSync(process.execPath, ['scripts/ci/check-allowlist.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CHANGED_FILES: '',
        CHANGED_FILES_FILE: oversizedFile,
        PHASE_ID: '1',
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exceeds 8388608 bytes/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('check-allowlist fails closed on whitespace-padded paths from a real git diff', () => {
  for (const changedPath of [
    ' components/review/ConsiderationHeroRow.jsx',
    'components/review/ConsiderationHeroRow.jsx ',
  ]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-allowlist-whitespace-'));
    const runGit = (args) => execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    try {
      runGit(['init', '-q']);
      runGit(['-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid',
        'commit', '--allow-empty', '-qm', 'base']);
      const base = runGit(['rev-parse', 'HEAD']);
      fs.mkdirSync(path.dirname(path.join(directory, changedPath)), { recursive: true });
      fs.writeFileSync(path.join(directory, changedPath), 'x\n');
      runGit(['add', '--', changedPath]);
      runGit(['-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid',
        'commit', '-qm', 'head']);
      const head = runGit(['rev-parse', 'HEAD']);
      const changedFilesFile = path.join(directory, 'changed-files.txt');
      const changedFiles = execFileSync(
        'git', ['diff', '--no-renames', '--name-only', base, head, '--'],
        { cwd: directory, encoding: 'utf8' },
      );
      assert.equal(changedFiles, `${changedPath}\n`);
      fs.writeFileSync(changedFilesFile, changedFiles);

      const result = spawnSync(process.execPath, ['scripts/ci/check-allowlist.js'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CHANGED_FILES: '',
          CHANGED_FILES_FILE: changedFilesFile,
          PHASE_ID: '1',
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 1, changedPath);
      assert.match(result.stderr, /leading or trailing whitespace/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});
