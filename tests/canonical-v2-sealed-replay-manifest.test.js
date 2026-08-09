'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER_URL = `file://${path.join(ROOT, 'scripts', 'canonical-v2-live-extraction-run.mjs')}`;

function manifestFile(payload) {
  const dir = fs.mkdtempSync(path.join(ROOT, '.sealed-replay-test-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(payload));
  return { dir, file: path.relative(ROOT, file) };
}

function seal(mod, body) {
  const manifest = { ...body };
  manifest.manifest_id = mod.replaySourceManifestId(manifest);
  return manifest;
}

test('sealed replay manifest refuses the five sections that require a live Terra run', async () => {
  const mod = await import(RUNNER_URL);
  const payload = seal(mod, {
    schema_version: 'SEALED_REPLAY_SOURCE_MANIFEST/V1',
    sections: [{
      section_reference: '7.1', source_run_dir: 'missing', fixture_file: 'missing.json', run_receipt_file: 'receipt.json',
      fixture_sha256: 'x', run_receipt_sha256: 'x',
      source_call: { prompt_digest: 'old', producer_receipt_id: 'old' },
    }],
  });
  const { dir, file } = manifestFile(payload);
  try {
    assert.throws(
      () => mod.loadSealedReplaySourceManifest({
        manifestPath: file, orderedSectionRefs: ['7.1'], family: 'TERMINATION_FEE',
        currentPromptDigestByRef: new Map([['7.1', 'old']]), expectedManifestId: payload.manifest_id,
      }),
      /REPLAY_LIVE_REQUIRED/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sealed replay manifest refuses a prompt digest mismatch before reading a fixture', async () => {
  const mod = await import(RUNNER_URL);
  const payload = seal(mod, {
    schema_version: 'SEALED_REPLAY_SOURCE_MANIFEST/V1',
    sections: [{
      section_reference: '3.1', source_run_dir: 'missing', fixture_file: 'missing.json', run_receipt_file: 'receipt.json',
      fixture_sha256: 'x', run_receipt_sha256: 'x',
      source_call: { prompt_digest: 'old', producer_receipt_id: 'old' },
    }],
  });
  const { dir, file } = manifestFile(payload);
  try {
    assert.throws(
      () => mod.loadSealedReplaySourceManifest({
        manifestPath: file, orderedSectionRefs: ['3.1'], family: 'MAE_DEFINITION',
        currentPromptDigestByRef: new Map([['3.1', 'new']]), expectedManifestId: payload.manifest_id,
      }),
      /REPLAY_PROMPT_DIGEST_MISMATCH/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest seal requires both embedded content identity and an independent expected digest', async () => {
  const mod = await import(RUNNER_URL);
  const payload = seal(mod, { schema_version: 'SEALED_REPLAY_SOURCE_MANIFEST/V1', sections: [] });
  const { dir, file } = manifestFile(payload);
  try {
    assert.throws(() => mod.loadSealedReplaySourceManifest({
      manifestPath: file, orderedSectionRefs: [], family: 'MAE_DEFINITION', currentPromptDigestByRef: new Map(),
    }), /REPLAY_MANIFEST_PIN_REQUIRED/);
    const tampered = { ...payload, note: 'changed after sealing' };
    fs.writeFileSync(path.join(ROOT, file), JSON.stringify(tampered));
    assert.throws(() => mod.loadSealedReplaySourceManifest({
      manifestPath: file, expectedManifestId: payload.manifest_id,
      orderedSectionRefs: [], family: 'MAE_DEFINITION', currentPromptDigestByRef: new Map(),
    }), /REPLAY_MANIFEST_SEAL_MISMATCH/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest coverage rejects duplicate, missing, unused, and duplicate target sections', async () => {
  const mod = await import(RUNNER_URL);
  const entry = (reference) => ({
    section_reference: reference, source_run_dir: 'missing', fixture_file: 'f.json', run_receipt_file: 'r.json',
    fixture_sha256: 'x', run_receipt_sha256: 'x', source_call: { prompt_digest: 'd', producer_receipt_id: 'p' },
  });
  for (const [sections, requested, pattern] of [
    [[entry('1'), entry('1')], ['1'], /DUPLICATE_SECTION/],
    [[entry('1')], ['1', '2'], /COVERAGE_MISMATCH/],
    [[entry('1'), entry('2')], ['1'], /COVERAGE_MISMATCH/],
    [[entry('1')], ['1', '1'], /REPLAY_TARGET_DUPLICATE_SECTION/],
  ]) {
    const payload = seal(mod, { schema_version: 'SEALED_REPLAY_SOURCE_MANIFEST/V1', sections });
    const { dir, file } = manifestFile(payload);
    try {
      assert.throws(() => mod.loadSealedReplaySourceManifest({
        manifestPath: file, expectedManifestId: payload.manifest_id, orderedSectionRefs: requested,
        family: 'MAE_DEFINITION', currentPromptDigestByRef: new Map(requested.map((ref) => [ref, 'd'])),
      }), pattern);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('contained replay paths reject traversal, absolute, backslash, NUL, and sibling-prefix escapes', async () => {
  const mod = await import(RUNNER_URL);
  for (const candidate of [
    '../outside', '/tmp/outside', 'dir\\file', 'dir\0file', `../${path.basename(ROOT)}-sibling/file`,
  ]) {
    assert.throws(() => mod.resolveContainedEvidenceFile(ROOT, candidate, 'test'), /REPLAY_SOURCE_PATH_/);
  }
});

test('contained replay paths reject directory and file symlinks', async () => {
  const mod = await import(RUNNER_URL);
  const dir = fs.mkdtempSync(path.join(ROOT, '.sealed-symlink-test-'));
  const realDir = path.join(dir, 'real');
  fs.mkdirSync(realDir);
  fs.writeFileSync(path.join(realDir, 'fixture.json'), '{}');
  fs.symlinkSync(realDir, path.join(dir, 'linked-dir'));
  fs.symlinkSync(path.join(realDir, 'fixture.json'), path.join(dir, 'linked-file'));
  try {
    assert.throws(
      () => mod.resolveContainedEvidenceFile(ROOT, path.relative(ROOT, path.join(dir, 'linked-dir', 'fixture.json')), 'dir-link'),
      /SYMLINK_REFUSED/,
    );
    assert.throws(
      () => mod.resolveContainedEvidenceFile(ROOT, path.relative(ROOT, path.join(dir, 'linked-file')), 'file-link'),
      /SYMLINK_REFUSED/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
