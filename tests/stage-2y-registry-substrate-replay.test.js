'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { MANIFEST, DIGEST } = require('../lib/vocab/resolution/registry-substrate-manifest');
const generalCovenants = require('../lib/vocab/resolution/general-covenant-registry');
const materialContracts = require('../lib/vocab/resolution/material-contract-registry');
const materialityQualifiers = require('../lib/vocab/resolution/materiality-qualifier-registry');
const { registryFingerprint } = require('../lib/vocab/resolution/registry-fingerprint');
test('Stage 2Y-C/H manifest pins seven concern registries and keeps V1 MAE meanings distinct', () => {
  assert.equal(MANIFEST.schema_version, 'RESOLUTION_REGISTRY_SUBSTRATE_MANIFEST/V1');
  assert.equal(MANIFEST.modules.length, 7);
  assert.equal(MANIFEST.preserved_v1_collisions.length, 2);
  assert.ok(DIGEST.startsWith('sha256:'));
});
test('browser-safe registry digests remain pinned to their payloads', () => {
  assert.equal(generalCovenants.DIGEST, registryFingerprint(generalCovenants.FINGERPRINT_INPUT_V1));
  assert.equal(materialContracts.DIGEST, registryFingerprint(materialContracts.FINGERPRINT_INPUT_V1));
  assert.equal(materialityQualifiers.DIGEST, registryFingerprint(materialityQualifiers.FINGERPRINT_INPUT_V1));
});
test('Stage 2Y-C replay baseline is current', () => {
  const root = path.resolve(__dirname, '..');
  const run = spawnSync(process.execPath, [path.resolve(root, 'scripts/stage-2y-registry-substrate-replay.mjs'), '--check', '--baseline', 'evidence/canonical-v2/stage-2y-registry-substrate-head-baseline.json'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('the browser-consumed taxonomy does not load Node crypto through the registry', () => {
  const root = path.resolve(__dirname, '..');
  const script = `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === 'node:crypto') throw new Error('NODE_CRYPTO_REACHED');
      return load.call(this, request, parent, isMain);
    };
    require('./lib/taxonomy');
  `;
  const run = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('a baseline-covered semantic mismatch and any exclusion reject the replay', async () => {
  const { assertBaselineAcceptance } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-substrate-replay.mjs'));
  const baseline = { run_names: ['one'] };
  assert.throws(() => assertBaselineAcceptance({ included_run_names: [], excluded_runs: [{ name: 'one', reason: 'SEMANTIC_OUTPUT_MISMATCH' }] }, baseline), /BASELINE_REPLAY_INCOMPLETE/);
  assert.throws(() => assertBaselineAcceptance({ included_run_names: [], excluded_runs: [{ name: 'one', reason: 'INPUT_REJECTED' }] }, baseline), /BASELINE_REPLAY_INCOMPLETE/);
});
