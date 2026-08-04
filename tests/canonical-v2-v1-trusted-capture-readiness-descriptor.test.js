'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const descriptor = require('../lib/canonical-v2/v1-trusted-capture-readiness-descriptor');

const ROOT = path.resolve(__dirname, '..');

test('binds the proposal-only control, capture and replay modules to their exact source digests and remains blocked', () => {
  const value = descriptor.buildV1TrustedCaptureReadinessDescriptor({ repository_root: ROOT });
  assert.equal(value.status, 'BLOCKED_NOT_EXECUTABLE');
  assert.equal(value.authority, 'NONE');
  assert.deepEqual(value.source_modules.map((entry) => entry.module_key), ['CONTROL', 'CAPTURE', 'REPLAY']);
  assert.equal(value.source_modules[0].schema_versions.length, 7);
  assert.equal(value.source_modules[1].schema_versions.length, 4);
  assert.equal(value.source_modules[2].schema_versions.length, 7);
  assert.equal(value.missing_requirements.length, 8);
  assert.equal(value.reconstructed_reference.reference_label, 'RECONSTRUCTED_V1_REFERENCE');
  assert.equal(value.reconstructed_reference.git_commit_id, '484c40a9515366d8efbfdcc72b71aaaa3aafe6e0');
  assert.match(value.reconstructed_reference.git_tree_id, /^[a-f0-9]{40}$/);
  assert.equal(value.reconstructed_reference.truth_state, 'RECONSTRUCTED_REFERENCE_NOT_LIVE_PRODUCTION_TRUTH');
  assert.deepEqual(descriptor.validateV1TrustedCaptureReadinessDescriptor(value, { repository_root: ROOT }), value);
  const stale = structuredClone(value); stale.source_modules[1].source_sha256 = '0'.repeat(64);
  assert.throws(() => descriptor.validateV1TrustedCaptureReadinessDescriptor(stale, { repository_root: ROOT }), /stale|incomplete/i);
});

test('descriptor has no old diagnostic validator, database, browser, network, signing, issuance or production execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js'), 'utf8');
  assert.doesNotMatch(source, /v1-output-routing-reconciliation-audit|v1-render-capture-preflight|node:https|node:http|\bfetch\s*\(|supabase|createClient|playwright|puppeteer|crypto\.sign|createPrivateKey|issueReplayPass|acceptSourceCapture|INSERT\s+INTO|UPDATE\s+|DELETE\s+/i);
});

test('descriptor rejects temporary repository roots', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v1-trusted-capture-readiness-'));
  try {
    assert.throws(() => descriptor.buildV1TrustedCaptureReadinessDescriptor({ repository_root: temporaryRoot }), /temporary repository root/i);
  } finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }); }
});
