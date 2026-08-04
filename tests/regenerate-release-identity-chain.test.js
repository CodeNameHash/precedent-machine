const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_RELATIVE = path.join('scripts', 'regenerate-release-identity-chain.mjs');
const F21_FIXTURE = 'tests/fixtures/canonical-v2/v12-serving-admission-readiness-f21.json';
const F20_FIXTURE = 'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json';
const F22_FIXTURE = 'tests/fixtures/canonical-v2/metric-serving-admission-f22.json';
const F21_UPSTREAM_SOURCE = 'lib/canonical-v2/shared-serving-row.js';

// Runs the script that lives inside `cwd` itself (not the real repo's copy).
// This matters because the lib modules under test read their own source
// snapshots via cwd-relative fs.readFileSync calls: the script, its lib
// dependencies, and the process cwd must all come from the same copy of the
// tree for a temp-copy test to be internally consistent.
function run(args, cwd) {
  const script = path.join(cwd, SCRIPT_RELATIVE);
  try {
    const stdout = execFileSync('node', [script, ...args], {
      cwd,
      encoding: 'utf8',
    });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status, stdout: err.stdout };
  }
}

// Makes an isolated on-disk copy of the repository (minus .git and
// node_modules, neither of which the script or its lib dependencies touch)
// so tests can perturb files without affecting the real working tree.
function makeTempRepoCopy() {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'release-identity-chain-'),
  );
  execFileSync('bash', [
    '-c',
    `tar --exclude=.git --exclude=node_modules -cf - -C '${REPO_ROOT}' . | tar -xf - -C '${dir}'`,
  ]);
  for (const fixture of [F20_FIXTURE, F21_FIXTURE, F22_FIXTURE]) {
    const destination = path.join(dir, fixture);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, fixture), destination);
  }
  return dir;
}

function cleanupTempRepoCopy(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('clean tree: --check passes with zero drift', () => {
  const result = run(['--check'], REPO_ROOT);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /\[MATCH\] f21/);
  assert.match(result.stdout, /\[MATCH\] f22/);
  assert.match(result.stdout, /0 drifted, 0 blocked/);
});

test('default mode (no flags) behaves like --check and does not write', () => {
  const before = fs.readFileSync(path.join(REPO_ROOT, F21_FIXTURE), 'utf8');
  const result = run([], REPO_ROOT);
  const after = fs.readFileSync(path.join(REPO_ROOT, F21_FIXTURE), 'utf8');
  assert.equal(result.status, 0);
  assert.equal(before, after);
});

test('perturbing an upstream source file is reported as drift on the F21 link, not silently ignored', () => {
  const dir = makeTempRepoCopy();
  try {
    const sourcePath = path.join(dir, F21_UPSTREAM_SOURCE);
    const original = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(sourcePath, `${original}\n// perturbed for test\n`, 'utf8');

    const result = run(['--check'], dir);
    assert.equal(result.status, 1, result.stdout);
    // The build's own internal consistency check catches this before it can
    // silently produce a new digest, so the tool must surface it as a
    // blocked link naming the exact upstream file that moved -- not pass.
    assert.match(result.stdout, /\[BLOCKED\] f21/);
    assert.match(result.stdout, new RegExp(F21_UPSTREAM_SOURCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(result.stdout, /recompute link\(s\) checked:.*1 blocked/s);

    // --check must never modify files, even when it finds drift/blocks.
    const untouched = fs.readFileSync(
      path.join(dir, F21_FIXTURE),
      'utf8',
    );
    const originalFixture = fs.readFileSync(
      path.join(REPO_ROOT, F21_FIXTURE),
      'utf8',
    );
    assert.equal(untouched, originalFixture);
  } finally {
    cleanupTempRepoCopy(dir);
  }
});

test('a real upstream fixture change is detected as DRIFT, written under --write, then --check passes clean, and --write is idempotent', () => {
  const dir = makeTempRepoCopy();
  try {
    // Perturb the F20 upstream fixture that feeds F21's build inputs, in a
    // way that keeps its JSON shape valid (F21's own consistency checks are
    // otherwise very strict about which fields may differ), by touching a
    // free-form evidence field that flows straight into the F21 payload.
    const f20Path = path.join(
      dir,
      'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json',
    );
    const f20 = JSON.parse(fs.readFileSync(f20Path, 'utf8'));
    // Sanity check on the fixture shape before mutating it.
    assert.equal(typeof f20, 'object');

    // Instead of guessing at F20's internal shape (which is validated
    // strictly upstream of F21), drive drift the same way the real Metsera
    // incident did: perturb one of F21's own pinned SOURCE_EVIDENCE_SPECS
    // carrier files' bytes AND its matching pinned digest inside the lib
    // module, exactly mirroring a legitimate upstream source edit that has
    // already been reconciled in lib/. That leaves the fixture as the only
    // thing left to mechanically rebind -- precisely this tool's job.
    const modulePath = path.join(
      dir,
      'lib/canonical-v2/v12-serving-admission-readiness-f21.js',
    );
    const sourcePath = path.join(dir, F21_UPSTREAM_SOURCE);
    const originalSource = fs.readFileSync(sourcePath, 'utf8');
    const perturbedSource = `${originalSource}\n// comment-only change, preserves all matched substrings\n`;
    fs.writeFileSync(sourcePath, perturbedSource, 'utf8');

    const { contentId } = require('../lib/canonical-v2/canonical-bytes');
    const newDigest = contentId('F21_SOURCE_SNAPSHOT/V1', {
      source_path: F21_UPSTREAM_SOURCE,
      source_bytes: perturbedSource,
    });

    const moduleSource = fs.readFileSync(modulePath, 'utf8');
    const oldDigestMatch = moduleSource.match(
      /source_path: 'lib\/canonical-v2\/shared-serving-row\.js',\s*\n\s*source_snapshot_digest:\s*\n\s*'([a-f0-9]{64,})'/,
    );
    assert.ok(oldDigestMatch, 'expected to find the pinned shared-serving-row digest in the lib module');
    const oldDigest = oldDigestMatch[1];
    const updatedModuleSource = moduleSource.replace(oldDigest, newDigest);
    assert.notEqual(updatedModuleSource, moduleSource);
    fs.writeFileSync(modulePath, updatedModuleSource, 'utf8');

    // Now the lib is internally consistent (pin matches real bytes) but the
    // frozen F21 fixture still reflects the old digest chain: this is
    // exactly the "upstream source hash changed" scenario the tool exists
    // for.
    const checkBefore = run(['--check'], dir);
    assert.equal(checkBefore.status, 1, checkBefore.stdout);
    assert.match(checkBefore.stdout, /\[DRIFT\] f21/);
    assert.match(checkBefore.stdout, /identity\/digest field/);

    const writeResult = run(['--write'], dir);
    assert.equal(writeResult.status, 0, writeResult.stdout);
    assert.match(writeResult.stdout, /REWROTE fixture/);

    const checkAfter = run(['--check'], dir);
    assert.equal(checkAfter.status, 0, checkAfter.stdout);
    assert.match(checkAfter.stdout, /\[MATCH\] f21/);

    // Idempotence: a second --write on an already-clean tree changes nothing.
    const fixtureAfterFirstWrite = fs.readFileSync(
      path.join(dir, F21_FIXTURE),
      'utf8',
    );
    const secondWrite = run(['--write'], dir);
    assert.equal(secondWrite.status, 0, secondWrite.stdout);
    assert.doesNotMatch(secondWrite.stdout, /REWROTE fixture/);
    const fixtureAfterSecondWrite = fs.readFileSync(
      path.join(dir, F21_FIXTURE),
      'utf8',
    );
    assert.equal(fixtureAfterFirstWrite, fixtureAfterSecondWrite);
  } finally {
    cleanupTempRepoCopy(dir);
  }
});

test('report-only links are always skipped by --write with a printed notice', () => {
  const result = run(['--write'], REPO_ROOT);
  assert.equal(result.status, 0, result.stdout);
  ['f23', 'f24', 'f25', 'f26', 'f28'].forEach((id) => {
    assert.match(result.stdout, new RegExp(`\\[REPORT_ONLY\\] ${id}`));
  });
  assert.match(result.stdout, /5 link\(s\) are report-only/);
});
