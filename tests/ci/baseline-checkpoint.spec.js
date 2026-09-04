const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  DIGEST_PATTERN,
  baselineInputDigest,
  digestDomain,
  runtimeIdentity,
  verifyMarker,
  writeMarker,
} = require('../../scripts/ci/baseline-checkpoint');

function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(directory, file, contents) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function commit(directory, message) {
  git(directory, ['add', '--all']);
  git(directory, [
    '-c', 'user.name=CI Test',
    '-c', 'user.email=ci@example.invalid',
    'commit', '-qm', message,
  ]);
  return git(directory, ['rev-parse', 'HEAD']);
}

test('baseline checkpoint digest is stable only across reviewed non-input changes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-checkpoint-digest-'));
  try {
    git(directory, ['init', '-q']);
    write(directory, '.github/workflows/ci.yml', 'name: CI\n');
    write(directory, 'evidence/canonical-v2/example/adapter-result.json', '{"write_set":{}}\n');
    write(directory, 'evidence/canonical-v2/example/input.json', '{"value":1}\n');
    write(directory, 'evidence/canonical-v2/example/source-reference.json', JSON.stringify({
      admitted_source_capture_inputs: { raw_html_path: 'raw/example.htm' },
    }));
    write(directory, 'evidence/canonical-v2/work3/nested/output.json', '{"unrelated":1}\n');
    write(directory, 'raw/example.htm', '<html>one</html>\n');
    write(directory, 'scripts/ci/local-helper.js', 'module.exports = 1;\n');
    write(directory, 'tests/unit/example.test.js', 'module.exports = true;\n');
    const base = commit(directory, 'base');
    const baseDigest = baselineInputDigest({ cwd: directory, ref: base });
    assert.match(baseDigest, DIGEST_PATTERN);
    assert.notEqual(baselineInputDigest({
      cwd: directory,
      ref: base,
      runtime: { ...runtimeIdentity(), node: 'v22.23.2-test-override' },
    }), baseDigest);

    write(directory, '.github/workflows/ci.yml', 'name: Updated CI\n');
    write(directory, 'scripts/ci/local-helper.js', 'module.exports = 2;\n');
    write(directory, 'tests/unit/example.test.js', 'module.exports = false;\n');
    write(directory, 'evidence/canonical-v2/work3/nested/output.json', '{"unrelated":2}\n');
    write(
      directory,
      'lib/canonical-v2/seven-family-v2-review-evidence.js',
      'module.exports = {};\n',
    );
    const safeHead = commit(directory, 'reviewed non-inputs');
    assert.equal(baselineInputDigest({ cwd: directory, ref: safeHead }), baseDigest);

    write(directory, 'evidence/canonical-v2/example/input.json', '{"value":2}\n');
    const changedInput = commit(directory, 'changed input');
    assert.notEqual(baselineInputDigest({ cwd: directory, ref: changedInput }), baseDigest);

    write(directory, 'evidence/canonical-v2/example/input.json', '{"value":1}\n');
    const restoredInput = commit(directory, 'restored input');
    assert.equal(baselineInputDigest({ cwd: directory, ref: restoredInput }), baseDigest);

    fs.rmSync(path.join(directory, 'evidence/canonical-v2/example/adapter-result.json'));
    const removedRun = commit(directory, 'removed immediate run marker');
    assert.notEqual(baselineInputDigest({ cwd: directory, ref: removedRun }), baseDigest);
    write(directory, 'evidence/canonical-v2/example/adapter-result.json', '{"write_set":{}}\n');
    const restoredRun = commit(directory, 'restored immediate run marker');
    assert.equal(baselineInputDigest({ cwd: directory, ref: restoredRun }), baseDigest);

    write(directory, 'raw/example.htm', '<html>two</html>\n');
    const changedRawSource = commit(directory, 'changed referenced raw source');
    assert.notEqual(baselineInputDigest({ cwd: directory, ref: changedRawSource }), baseDigest);
    write(directory, 'raw/example.htm', '<html>one</html>\n');
    const restoredRawSource = commit(directory, 'restored referenced raw source');
    assert.equal(baselineInputDigest({ cwd: directory, ref: restoredRawSource }), baseDigest);

    write(directory, 'evidence/canonical-v2/added/adapter-result.json', '{"write_set":{}}\n');
    write(directory, 'evidence/canonical-v2/added/source-reference.json', JSON.stringify({
      reused_committed_raw_html: 'raw/example.htm',
    }));
    const addedRun = commit(directory, 'added immediate run');
    assert.notEqual(baselineInputDigest({ cwd: directory, ref: addedRun }), baseDigest);
    fs.rmSync(path.join(directory, 'evidence/canonical-v2/added'), { recursive: true });
    const removedAddedRun = commit(directory, 'removed added run');
    assert.equal(baselineInputDigest({ cwd: directory, ref: removedAddedRun }), baseDigest);

    write(directory, ' scripts/ci/runtime-input.js', 'module.exports = true;\n');
    const whitespaceInput = commit(directory, 'leading whitespace input');
    assert.notEqual(baselineInputDigest({ cwd: directory, ref: whitespaceInput }), baseDigest);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('baseline checkpoint digest binds the complete runtime identity', () => {
  const runtime = runtimeIdentity();
  assert.deepEqual(Object.keys(runtime).sort(), ['arch', 'node', 'platform', 'zlib']);
  assert.deepEqual(JSON.parse(digestDomain()).runtime, runtime);
  assert.notEqual(
    digestDomain(runtime),
    digestDomain({ ...runtime, node: 'v22.23.3' }),
  );
  assert.notEqual(
    digestDomain(runtime),
    digestDomain({ ...runtime, zlib: `${runtime.zlib}-different` }),
  );
});

test('baseline checkpoint digest rejects unsafe or unavailable raw source references', () => {
  const cases = [
    ['missing reference', null, /missing .*source-reference\.json/],
    ['malformed reference', '{', /source-reference\.json is malformed/],
    ['absolute reference', JSON.stringify({ reused_committed_raw_html: '/tmp/raw.htm' }), /unsafe or missing/],
    ['traversal reference', JSON.stringify({ reused_committed_raw_html: '../raw.htm' }), /unsafe or missing/],
    ['untracked reference', JSON.stringify({ reused_committed_raw_html: 'raw/missing.htm' }), /is not tracked/],
  ];
  for (const [name, sourceReference, pattern] of cases) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-checkpoint-source-'));
    try {
      git(directory, ['init', '-q']);
      write(directory, 'evidence/canonical-v2/example/adapter-result.json', '{"write_set":{}}\n');
      if (sourceReference !== null) {
        write(directory, 'evidence/canonical-v2/example/source-reference.json', sourceReference);
      }
      const head = commit(directory, name);
      assert.throws(() => baselineInputDigest({ cwd: directory, ref: head }), pattern, name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-checkpoint-symlink-'));
  try {
    git(directory, ['init', '-q']);
    fs.mkdirSync(path.join(directory, 'evidence/canonical-v2'), { recursive: true });
    fs.symlinkSync('../../outside-run', path.join(directory, 'evidence/canonical-v2/linked-run'));
    const head = commit(directory, 'linked run');
    assert.throws(
      () => baselineInputDigest({ cwd: directory, ref: head }),
      /evidence root contains a symlink or submodule/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('baseline checkpoint marker accepts only the exact bytes and digest', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-checkpoint-marker-'));
  const marker = path.join(directory, 'marker.txt');
  const digest = 'a'.repeat(64);
  try {
    writeMarker(marker, digest);
    assert.equal(fs.readFileSync(marker, 'utf8'), `PASS\n${digest}\n`);
    assert.equal(verifyMarker(marker, digest), true);
    assert.equal(verifyMarker(marker, 'b'.repeat(64)), false);

    fs.writeFileSync(marker, `FAIL\n${digest}\n`);
    assert.equal(verifyMarker(marker, digest), false);
    fs.writeFileSync(marker, `PASS\n${digest}\nextra\n`);
    assert.equal(verifyMarker(marker, digest), false);
    fs.writeFileSync(marker, Buffer.alloc(4_097, 0x78));
    assert.equal(verifyMarker(marker, digest), false);

    fs.rmSync(marker);
    assert.equal(verifyMarker(marker, digest), false);
    fs.symlinkSync(path.join(directory, 'missing-target'), marker);
    assert.equal(verifyMarker(marker, digest), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('baseline checkpoint CLI rejects malformed digests and unavailable refs', () => {
  const script = path.resolve('scripts/ci/baseline-checkpoint.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-checkpoint-cli-'));
  try {
    const badWrite = spawnSync(process.execPath, [script, 'write', 'not-a-digest', path.join(directory, 'marker')], {
      encoding: 'utf8',
    });
    assert.notEqual(badWrite.status, 0);

    const missingRef = spawnSync(process.execPath, [script, 'digest', '0'.repeat(40)], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.notEqual(missingRef.status, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
