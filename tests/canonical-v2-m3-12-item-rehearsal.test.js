'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { executeUnifiedRun } = require('../lib/canonical-v2/native-producer/unified-runner-execute');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));
const controls = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-controls.json',
), 'utf8')).work_item_controls;

test('production rehearsal rejects caller-provided manifest authority before provider creation', async () => {
  const calls = [];
  await assert.rejects(
    () => executeUnifiedRun({
      manifest,
      work_item_controls: controls,
      root_dir: ROOT,
      // An explicit zero budget. This is the caller's execution cap, not manifest
      // authority, and it must not by itself let a caller manifest become executable.
      max_model_invocations: 0,
      provider_factory: () => { calls.push('provider_factory'); return async () => {}; },
    }),
    (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
  assert.deepEqual(calls, []);
});

test('an unset model-invocation budget fails closed before provider creation', async () => {
  const calls = [];
  await assert.rejects(
    () => executeUnifiedRun({
      manifest,
      work_item_controls: controls,
      root_dir: ROOT,
      provider_factory: () => { calls.push('provider_factory'); return async () => {}; },
    }),
    (error) => error.code === 'INVALID_MAX_MODEL_INVOCATIONS',
  );
  assert.deepEqual(calls, []);
});
