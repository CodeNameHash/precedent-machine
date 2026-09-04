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

const RECOVERY_PHASE = 'WP-RECOVER-M7-20260812';
const CHECK_ALLOWLIST_SCRIPT = path.resolve(__dirname, '../../scripts/ci/check-allowlist.js');
const RECOVERY_ALLOWLIST_RELATIVE_PATH = path.join(
  '.github',
  'phase-allowlists',
  'wp-recover-m7-20260812.json',
);

function recoveryAllowlist(overrides = {}) {
  return {
    phase: RECOVERY_PHASE,
    name: 'recover-m7-20260812',
    allowed: [
      'scripts/ci/check-allowlist.js',
      'tests/ci/check-allowlist.spec.js',
    ],
    denied: ['secrets/**'],
    note: 'temporary test fixture',
    ...overrides,
  };
}

function checkRecovery(allowlist, files = allowlist.allowed) {
  return checkAllowlist({ phase: RECOVERY_PHASE, files, allowlist });
}

function withRecoveryCliDirectory(allowlist, run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'work3-recovery-allowlist-'));
  const allowlistFile = path.join(directory, RECOVERY_ALLOWLIST_RELATIVE_PATH);
  try {
    fs.mkdirSync(path.dirname(allowlistFile), { recursive: true });
    fs.writeFileSync(allowlistFile, `${JSON.stringify(allowlist, null, 2)}\n`);
    return run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

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
  assert.equal('missing' in result, false);
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

test('Work3 recovery accepts an injected allowlist for isolated unit checks', () => {
  const allowlist = {
    phase: RECOVERY_PHASE,
    allowed: ['unit-fixture/only.js'],
    denied: [],
  };
  const result = checkAllowlist({
    phase: RECOVERY_PHASE,
    files: allowlist.allowed,
    allowlist,
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
  assert.deepEqual(result.missing, []);
});

test('Work3 recovery requires every allowed path in the changed-file set', () => {
  const allowlist = recoveryAllowlist();
  const result = checkRecovery(allowlist, [allowlist.allowed[0]]);
  assert.deepEqual(result.missing, [allowlist.allowed[1]]);
});

test('Work3 recovery rejects an allowlist for a different phase', () => {
  const allowlist = recoveryAllowlist({ phase: 'WP-OTHER' });
  assert.throws(
    () => checkRecovery(allowlist),
    /must declare phase WP-RECOVER-M7-20260812/,
  );
});

test('Work3 recovery rejects duplicate allowed paths', () => {
  const allowlist = recoveryAllowlist({
    allowed: [
      'scripts/ci/check-allowlist.js',
      'scripts/ci/check-allowlist.js',
    ],
  });
  assert.throws(() => checkRecovery(allowlist), /duplicate allowed path/);
});

test('Work3 recovery accepts only normalised concrete allowed file paths', () => {
  for (const invalidPath of [
    './scripts/ci/check-allowlist.js',
    'scripts\\ci\\check-allowlist.js',
    'scripts/ci/',
    'scripts/ci/*.js',
    'scripts/ci/../check-allowlist.js',
    '../outside.js',
    '.',
    '/scripts/ci/check-allowlist.js',
    ' scripts/ci/check-allowlist.js',
  ]) {
    const allowlist = recoveryAllowlist({ allowed: [invalidPath] });
    assert.throws(
      () => checkRecovery(allowlist),
      /normalised concrete file path/,
      invalidPath,
    );
  }
});

test('Work3 recovery accepts literal brackets in concrete Next.js route paths', () => {
  const allowed = ['pages/api/review/[id]/cards.js'];
  const result = checkAllowlist({
    phase: RECOVERY_PHASE,
    files: allowed,
    allowlist: recoveryAllowlist({ allowed }),
  });
  assert.deepEqual(result.denied, []);
  assert.deepEqual(result.outside, []);
  assert.deepEqual(result.missing, []);
});

test('Work3 recovery rejects duplicate changed-file paths', () => {
  const allowlist = recoveryAllowlist({ allowed: ['scripts/ci/check-allowlist.js'] });
  assert.throws(
    () => checkRecovery(allowlist, [allowlist.allowed[0], allowlist.allowed[0]]),
    /duplicate changed-file path/,
  );
});

test('Work3 recovery accepts an identical set and rejects extra changed paths', () => {
  const allowlist = recoveryAllowlist();
  const pass = checkRecovery(allowlist);
  assert.deepEqual(pass.denied, []);
  assert.deepEqual(pass.outside, []);
  assert.deepEqual(pass.missing, []);

  const extra = checkRecovery(allowlist, [...allowlist.allowed, 'unexpected/file.js']);
  assert.deepEqual(extra.denied, []);
  assert.deepEqual(extra.outside, ['unexpected/file.js']);
  assert.deepEqual(extra.missing, []);
});

test('Work3 recovery keeps denied patterns effective', () => {
  const allowlist = recoveryAllowlist({
    allowed: [
      'scripts/ci/check-allowlist.js',
      'secrets/credential.txt',
    ],
  });
  const result = checkRecovery(allowlist);
  assert.deepEqual(result.denied, ['secrets/credential.txt']);
  assert.deepEqual(result.outside, []);
  assert.deepEqual(result.missing, []);
});

test('Work3 recovery CLI fails on omitted and extra changed paths', () => {
  const allowlist = recoveryAllowlist();
  withRecoveryCliDirectory(allowlist, (directory) => {
    const pass = spawnSync(process.execPath, [CHECK_ALLOWLIST_SCRIPT], {
      cwd: directory,
      env: {
        ...process.env,
        CHANGED_FILES: allowlist.allowed.join('\n'),
        CHANGED_FILES_FILE: '',
        PHASE_ID: RECOVERY_PHASE,
      },
      encoding: 'utf8',
    });
    assert.equal(pass.status, 0, `${pass.stdout}\n${pass.stderr}`);
    assert.match(pass.stdout, /PHASE-ALLOWLIST: PASS phase WP-RECOVER-M7-20260812/);

    for (const [files, expectedError] of [
      [[allowlist.allowed[0]], /Allowed files missing from changed-file set/],
      [[...allowlist.allowed, 'unexpected/file.js'], /Files outside allowlist/],
    ]) {
      const result = spawnSync(process.execPath, [CHECK_ALLOWLIST_SCRIPT], {
        cwd: directory,
        env: {
          ...process.env,
          CHANGED_FILES: files.join('\n'),
          CHANGED_FILES_FILE: '',
          PHASE_ID: RECOVERY_PHASE,
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, expectedError);
    }
  });
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
