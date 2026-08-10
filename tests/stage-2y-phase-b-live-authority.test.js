'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

function blocked(script, args, route) {
  assert.throws(() => execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  }), (error) => String(error.stderr).includes(`PHASE_B_LIVE_DEFERRED:${route}`));
}

test('the shared Phase B authority rejects live model calls', async () => {
  const authority = await import(pathToFileURL(path.join(ROOT, 'scripts/stage-2y-phase-b-live-authority.mjs')).href);
  assert.equal(authority.PHASE_B_LIVE_DEFERRED, true);
  assert.throws(() => authority.assertPhaseBLiveAllowed('TEST'), /PHASE_B_LIVE_DEFERRED:TEST/);
});

test('every Phase B experiment executor uses the shared live deferral', () => {
  blocked('stage-2y-phase-b-sol-probe.mjs', ['--live'], 'SOL_PROBE');
  blocked('stage-2y-phase-b-sol-financing-continuation.mjs', ['--live'], 'SOL_FINANCING_CONTINUATION');
  blocked('stage-2y-phase-b-model-experiment.mjs', ['--run-terra'], 'V1_TERRA');
  blocked('stage-2y-phase-b-model-experiment.mjs', ['--run-cross-vendor'], 'V1_CROSS_VENDOR');
  blocked('stage-2y-phase-b-v2-model-experiment.mjs', ['--run-baseline'], 'V2_BASELINE');
  blocked('stage-2y-phase-b-v2-model-experiment.mjs', ['--run-cross-vendor'], 'V2_CROSS_VENDOR');
});

test('the generic extraction runner rejects a direct live Phase B lead probe', async () => {
  const runner = await import(pathToFileURL(path.join(ROOT, 'scripts/canonical-v2-live-extraction-run.mjs')).href);
  assert.throws(() => runner.parseArgs([
    '--deal', 'modiv',
    '--family', 'TERMINATION_FEE',
    '--section-refs', '9.1',
    '--out-dir', '/tmp/phase-b-live-authority-test',
    '--profile', 'SOL_MEDIUM',
    '--phase-b-lead-probe',
  ]), /PHASE_B_LIVE_DEFERRED:GENERIC_LEAD_PROBE/);
});
