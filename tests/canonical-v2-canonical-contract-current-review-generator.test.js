const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_RELATIVE_PATH =
  'scripts/generate-canonical-contract-current-review.mjs';
const SCRIPT = path.join(ROOT, SCRIPT_RELATIVE_PATH);
const ALLOWLIST_PATH = path.join(
  ROOT,
  '.github/phase-allowlists/wp-canonical-contract-current-review-generator-v1.json',
);
const NODE_MODULES = path.resolve(require.resolve('ajv'), '..', '..', '..');

function nodeEnvironment() {
  return {
    ...process.env,
    NODE_PATH: process.env.NODE_PATH
      ? `${NODE_MODULES}${path.delimiter}${process.env.NODE_PATH}`
      : NODE_MODULES,
  };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function cleanRepository(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-review-generator-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  execFileSync('git', ['clone', '--quiet', ROOT, directory]);
  const scriptDestination = path.join(directory, SCRIPT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(scriptDestination), { recursive: true });
  fs.copyFileSync(SCRIPT, scriptDestination);
  git(directory, ['config', 'user.email', 'tests@example.invalid']);
  git(directory, ['config', 'user.name', 'Generator test']);
  git(directory, ['add', SCRIPT_RELATIVE_PATH]);
  git(directory, ['commit', '--quiet', '-m', 'Add review generator fixture']);
  return directory;
}

function run(root, args) {
  return spawnSync(process.execPath, [
    path.join(root, SCRIPT_RELATIVE_PATH),
    '--code-commit', git(root, ['rev-parse', 'HEAD']),
    '--environment', 'STAGING',
    '--approval-epoch-nonce', 'review-epoch-1',
    ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: nodeEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
  });
}

test('creates one deterministic pre-review source-closure package with no authority', (t) => {
  const root = cleanRepository(t);
  const first = run(root, []);
  const second = run(root, []);

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  const packageValue = JSON.parse(first.stdout);
  assert.equal(
    packageValue.disposition.state,
    'PRE_REVIEW_SOURCE_CLOSED_NOT_REVIEWED',
  );
  for (const key of [
    'freeze_authority',
    'signing_authority',
    'status_publication_authority',
    'writer_authority',
    'serving_authority',
    'database_authority',
    'release_authority',
    'activation_authority',
    'production_authority',
  ]) {
    assert.equal(packageValue.disposition[key], 'NONE');
  }
  assert.equal(
    packageValue.exact_review_package.contract_bundle_freeze_candidate
      .determinism_report.compile_run_count,
    2,
  );
  assert.equal(
    packageValue.remaining_formal_freeze_input_inventory.some(
      (entry) => entry.member_type === 'ContractDiffReviewAttestation'
        && entry.state === 'REVIEW_CONCLUSION_NOT_SUPPLIED',
    ),
    true,
  );
});

test('refuses a mismatched code commit and dirty worktree', (t) => {
  const root = cleanRepository(t);
  const mismatched = spawnSync(process.execPath, [
    path.join(root, SCRIPT_RELATIVE_PATH),
    '--code-commit', '0'.repeat(40),
    '--environment', 'STAGING',
    '--approval-epoch-nonce', 'review-epoch-1',
  ], { cwd: root, encoding: 'utf8', env: nodeEnvironment() });
  assert.equal(mismatched.status, 1);
  assert.match(mismatched.stderr, /exactly equal git rev-parse HEAD/);

  fs.writeFileSync(path.join(root, 'dirty.txt'), 'not bound\n');
  const dirty = run(root, []);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /dirty Git worktree/);
});

test('validates governing specification drift and unsafe declared paths', (t) => {
  const driftRoot = cleanRepository(t);
  const governed = path.join(driftRoot, 'docs/CODEX-PROGRAM.md');
  fs.appendFileSync(governed, '\nDRIFT\n');
  git(driftRoot, ['add', 'docs/CODEX-PROGRAM.md']);
  git(driftRoot, ['commit', '--quiet', '-m', 'Drift governing source']);
  const drift = run(driftRoot, []);
  assert.equal(drift.status, 1);
  assert.match(drift.stderr, /Governing specification member drift/);

  const traversalRoot = cleanRepository(t);
  const manifestPath = path.join(
    traversalRoot,
    'docs/codex-program/specification-manifest.json',
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.files[0].path = '../escape.md';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  git(traversalRoot, ['add', 'docs/codex-program/specification-manifest.json']);
  git(traversalRoot, ['commit', '--quiet', '-m', 'Attempt traversal']);
  const traversal = run(traversalRoot, []);
  assert.equal(traversal.status, 1);
  assert.match(traversal.stderr, /safe repository-relative path/);
});

test('writes only an explicit evidence path and checks exact output bytes without writing', (t) => {
  const root = cleanRepository(t);
  const output = 'evidence/contract-freeze/current-review.json';
  const written = run(root, ['--output', output]);
  assert.equal(written.status, 0, written.stderr);
  assert.equal(written.stdout, '');
  const outputPath = path.join(root, ...output.split('/'));
  const expected = fs.readFileSync(outputPath);

  const checked = run(root, ['--output', output, '--check']);
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(fs.readFileSync(outputPath), expected);

  fs.writeFileSync(outputPath, 'drift');
  const drift = run(root, ['--output', output, '--check']);
  assert.equal(drift.status, 1);
  assert.match(drift.stderr, /output drifted/);
  assert.equal(fs.readFileSync(outputPath, 'utf8'), 'drift');

  const traversal = run(root, ['--output', 'evidence/contract-freeze/../../outside.json']);
  assert.equal(traversal.status, 1);
  assert.match(traversal.stderr, /safe repository-relative path/);
});

test('uses one exact three-file canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-canonical-contract-current-review-generator-v1.json',
    'scripts/generate-canonical-contract-current-review.mjs',
    'tests/canonical-v2-canonical-contract-current-review-generator.test.js',
  ]);
  assert.match(allowlist.note, /no review, approval, freeze, signing, deployment/i);
});
