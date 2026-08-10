'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
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

function acceptedDiff(overrides = {}) {
  const body = {
    schema_version: 'STAGE_2Y_RESOLUTION_SET_DIFF/V1',
    generation_command: 'node scripts/stage-2y-resolution-set-diff.mjs --write fixed',
    phase: 'fixed',
    authority: 'OFFLINE_REPLAY_COMPARISON_ONLY',
    publication_authorisation: 'NONE',
    comparison: 'COMMITTED_RESOLUTION_ARTIFACTS_TO_CURRENT_OFFLINE_REPLAY',
    resolver_source_digest: 'sha256:resolver',
    run_names: ['one', 'two'],
    deals: ['deal'],
    summary: {
      deal_count: 1,
      run_count: 2,
      previously_resolved_claim_count: 2,
      moved_previously_resolved_claim_count: 0,
      newly_resolved_claim_count: 1,
      replay_error_count: 0,
    },
    moved_previously_resolved_claims: [],
    newly_resolved_claims: [{}],
    replay_errors: [],
    open_world_by_family: [{ family: 'ONE', before: 1, after: 1, delta: 0 }],
    ...overrides,
  };
  return { ...body, comparison_digest: `sha256:${sha256Hex(Buffer.from(canonicalJson(body), 'utf8'))}` };
}

function baselineSourceReplay(overrides = {}) {
  return {
    discovered_run_names: ['one', 'two'],
    included_run_names: ['one'],
    excluded_runs: [{ name: 'two', reason: 'SEMANTIC_OUTPUT_MISMATCH' }],
    runs: [
      {
        name: 'one', family: 'ONE', outcome: 'INCLUDED', semantic_output_digest: 'sha256:one-semantic',
        receipt_projection_digest: 'sha256:one-receipt', replay_coverage: { complete: true },
        input_digests: { 'run-receipt.json': 'sha256:one-input' },
      },
      {
        name: 'two', family: 'TWO', outcome: 'EXCLUDED', reason: 'SEMANTIC_OUTPUT_MISMATCH',
        replayed_semantic_output_digest: 'sha256:two-semantic', replayed_receipt_projection_digest: 'sha256:two-receipt',
        replay_coverage: { complete: true }, input_digests: { 'run-receipt.json': 'sha256:two-input' },
      },
    ],
    ...overrides,
  };
}

test('the audited writer derives a complete baseline from accepted semantic movement', async () => {
  const { buildAcceptedBaseline } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-substrate-replay.mjs'));
  const baseline = buildAcceptedBaseline({
    replay: baselineSourceReplay(),
    accepted_diff: acceptedDiff(),
    accepted_diff_path: 'evidence/canonical-v2/stage-2y-parent-approval-resolution-set-diff-fixed.json',
    accepted_diff_sha256: 'sha256:diff-file',
    head_commit: 'a'.repeat(40),
    replay_harness_sha256: 'sha256:harness',
    resolver_source_digest: 'sha256:resolver',
  });
  assert.equal(baseline.schema_version, 'STAGE_2Y_REGISTRY_BASELINE/V2');
  assert.equal(baseline.generation_command, 'node scripts/stage-2y-registry-substrate-replay.mjs --write-baseline --accepted-diff evidence/canonical-v2/stage-2y-parent-approval-resolution-set-diff-fixed.json');
  assert.equal(baseline.baseline_provenance.generation_command, baseline.generation_command);
  assert.deepEqual(baseline.run_names, ['one', 'two']);
  assert.equal(baseline.runs.two.semantic_output_digest, 'sha256:two-semantic');
  assert.deepEqual(baseline.runs.two.input_digests, { 'run-receipt.json': 'sha256:two-input' });
  assert.equal(baseline.runs.two.receipt_projection_digest, 'sha256:two-receipt');
  assert.equal(baseline.accepted_resolution_diff.comparison_digest, acceptedDiff().comparison_digest);
});

test('the audited writer rejects unaccepted movement, bad evidence identity and replay errors', async () => {
  const { buildAcceptedBaseline } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-substrate-replay.mjs'));
  const args = {
    replay: baselineSourceReplay(), accepted_diff_path: 'evidence/fixed.json', accepted_diff_sha256: 'sha256:diff-file',
    head_commit: 'a'.repeat(40), replay_harness_sha256: 'sha256:harness', resolver_source_digest: 'sha256:resolver',
  };
  const moved = acceptedDiff({
    summary: { ...acceptedDiff().summary, moved_previously_resolved_claim_count: 1 },
    moved_previously_resolved_claims: [{}],
  });
  assert.throws(() => buildAcceptedBaseline({ ...args, accepted_diff: moved }), /ACCEPTED_DIFF_MOVED_PREVIOUSLY_RESOLVED/);
  assert.throws(() => buildAcceptedBaseline({ ...args, accepted_diff: { ...acceptedDiff(), comparison_digest: 'sha256:bad' } }), /ACCEPTED_DIFF_DIGEST_MISMATCH/);
  const openWorldRise = acceptedDiff({
    summary: { ...acceptedDiff().summary, open_world_rise_family_count: 1 },
    open_world_by_family: [{ family: 'ONE', before: 1, after: 2, delta: 1 }],
  });
  assert.throws(() => buildAcceptedBaseline({ ...args, accepted_diff: openWorldRise }), /ACCEPTED_DIFF_OPEN_WORLD_RISE/);
  const erroredReplay = baselineSourceReplay({
    excluded_runs: [{ name: 'two', reason: 'INPUT_REJECTED' }],
    runs: [baselineSourceReplay().runs[0], { name: 'two', outcome: 'EXCLUDED', reason: 'INPUT_REJECTED' }],
  });
  assert.throws(() => buildAcceptedBaseline({ ...args, replay: erroredReplay, accepted_diff: acceptedDiff() }), /BASELINE_SOURCE_REPLAY_ERROR/);
});

test('the audited writer requires a clean committed tree', async () => {
  const { assertCleanCommittedTree, assertSourceStateUnchanged } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-substrate-replay.mjs'));
  assert.equal(assertCleanCommittedTree({ status: '', head: 'a'.repeat(40) }), 'a'.repeat(40));
  assert.throws(() => assertCleanCommittedTree({ status: ' M file', head: 'a'.repeat(40) }), /BASELINE_WRITE_DIRTY_TREE/);
  assert.throws(() => assertCleanCommittedTree({ status: '', head: 'not-a-commit' }), /BASELINE_WRITE_HEAD_INVALID/);
  assert.equal(assertSourceStateUnchanged(
    { status: '', head: 'a'.repeat(40) },
    { status: '', head: 'a'.repeat(40) },
  ), 'a'.repeat(40));
  assert.throws(() => assertSourceStateUnchanged(
    { status: '', head: 'a'.repeat(40) },
    { status: '', head: 'b'.repeat(40) },
  ), /BASELINE_WRITE_HEAD_CHANGED/);
  assert.throws(() => assertSourceStateUnchanged(
    { status: '', head: 'a'.repeat(40) },
    { status: ' M changed', head: 'a'.repeat(40) },
  ), /BASELINE_WRITE_DIRTY_TREE/);
});

test('the second replay must match every adopted input and output digest', async () => {
  const { assertAdoptedReplayMatch, buildAcceptedBaseline } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-substrate-replay.mjs'));
  const replay = baselineSourceReplay();
  const baseline = buildAcceptedBaseline({
    replay, accepted_diff: acceptedDiff(), accepted_diff_path: 'evidence/fixed.json',
    accepted_diff_sha256: 'sha256:diff-file', head_commit: 'a'.repeat(40),
    replay_harness_sha256: 'sha256:harness', resolver_source_digest: 'sha256:resolver',
  });
  assert.doesNotThrow(() => assertAdoptedReplayMatch(replay, baseline));
  const changed = structuredClone(replay);
  changed.runs[1].replayed_semantic_output_digest = 'sha256:changed';
  assert.throws(() => assertAdoptedReplayMatch(changed, baseline), /BASELINE_VERIFICATION_ADOPTION_MISMATCH/);
});
