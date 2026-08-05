'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildFinalPilotSynthesis,
} = require('../lib/canonical-v2/native-producer/m3-final-pilot-synthesis');
const {
  validateUnifiedRunManifestDiagnostic,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'),
  'utf8',
));

test('the pilot fixture retains a byte-pinned diagnostic cohort without executable authority', () => {
  const diagnostic = validateUnifiedRunManifestDiagnostic({ manifest: MANIFEST, root_dir: ROOT });
  assert.equal(diagnostic.receipt.authority, 'NONE');
  assert.equal(diagnostic.diagnostic_manifest.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(diagnostic.diagnostic_manifest.work_item_diagnostics.length, 12);
  assert.ok(diagnostic.diagnostic_manifest.work_item_diagnostics.every((item) => (
    item.diagnostic_state === 'EXTRACT_CANDIDATE_PENDING_TRUSTED_SOURCE_ADMISSION'
  )));
});

test('final pilot synthesis rejects incomplete execution input before any replay', async () => {
  let replayCalls = 0;
  await assert.rejects(
    () => buildFinalPilotSynthesis({
      manifest: MANIFEST,
      root_dir: ROOT,
      replay_recording: () => { replayCalls += 1; },
    }),
    (error) => error.code === 'INVALID_EXECUTION_RESULT',
  );
  assert.equal(replayCalls, 0);
});

test('final synthesis keeps the trusted validation boundary and has no provider or network authority import', () => {
  const source = fs.readFileSync(path.join(
    ROOT,
    'lib/canonical-v2/native-producer/m3-final-pilot-synthesis.js',
  ), 'utf8');
  assert.match(source, /validateUnifiedRunManifest/);
  assert.doesNotMatch(source, /codex-cli-provider|anthropic-provider|provider-interface|node:https|node:http|\bfetch\s*\(|supabase/);
});
