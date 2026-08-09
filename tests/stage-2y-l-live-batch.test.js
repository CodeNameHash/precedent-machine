'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function subject() {
  return import(path.join(ROOT, 'scripts', 'stage-2y-l-live-batch.mjs'));
}

function outputFor(call, requestId = 'request-1') {
  return {
    provider: { provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION', profile_id: 'TERRA_MEDIUM', requested_model_id: 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM', provider_request_ids: [requestId] },
    source_binding: {
      raw_bytes_sha256: 'a'.repeat(64), converter_digest: 'b'.repeat(64),
      converter_config_digest: 'c'.repeat(64), canonical_text_sha256: 'd'.repeat(64),
      source_map_compressed_sha256: 'e'.repeat(64), source_map_digest: 'f'.repeat(64),
    },
    prompt_identity: { ...call.prompt_identity, prompt_digest: '1'.repeat(64) },
    artifact_digests: { run_manifest: '2'.repeat(64), source_reference: '3'.repeat(64), run_receipt: '4'.repeat(64), adapter_result: '5'.repeat(64), call_telemetry: '6'.repeat(64), recording: '7'.repeat(64) },
    run_identity: { deal: call.deal, family: call.family, section_references: [call.section_reference], requested_model_profile: 'TERRA_MEDIUM' },
  };
}

test('2Y-L fixes the authorised 46 section calls with raw-html and per-section prompt identities', async () => {
  const { STAGE_2Y_L_CALLS } = await subject();
  assert.equal(STAGE_2Y_L_CALLS.length, 46);
  assert.deepEqual(Object.fromEntries(['FINANCING_COVENANTS', 'CLOSING_CONDITIONS', 'PROXY_MEETING'].map((family) => [family, STAGE_2Y_L_CALLS.filter((call) => call.family === family).length])), {
    FINANCING_COVENANTS: 8, CLOSING_CONDITIONS: 26, PROXY_MEETING: 12,
  });
  assert.ok(STAGE_2Y_L_CALLS.every((call) => call.raw_html_path && call.section_reference && call.prompt_identity.prompt_id && call.prompt_identity.prompt_version));
  assert.equal(new Set(STAGE_2Y_L_CALLS.map((call) => call.call_id)).size, 46);
});

test('2Y-L invokes the existing runner with a sealed per-call recording path', async () => {
  const { STAGE_2Y_L_CALLS, buildLiveRunnerArgs } = await subject();
  const outputDir = path.join(os.tmpdir(), 'stage-2y-l-recording-check');
  const args = buildLiveRunnerArgs({ call: STAGE_2Y_L_CALLS[0], outputDir });
  assert.equal(args[args.indexOf('--record') + 1], path.join(outputDir, 'recording.json'));
  assert.equal(args[args.indexOf('--out-dir') + 1], outputDir);
  assert.equal(args[args.indexOf('--profile') + 1], 'TERRA_MEDIUM');
});

test('2Y-L checkpoints each sealed outcome and resume never re-calls a failed or malformed section', async () => {
  const { runStage2yLLiveBatch, validateStage2yLArtifact } = await subject();
  const calls = (await subject()).STAGE_2Y_L_CALLS.slice(0, 3);
  let first = 0;
  const partial = await runStage2yLLiveBatch({
    calls,
    executeSection: async ({ call }) => {
      first += 1;
      if (first === 1) return outputFor(call, 'complete');
      if (first === 2) throw new Error('CLI_EXIT_1');
      return { malformed: true };
    },
  });
  assert.deepEqual(partial.calls.map((call) => call.state), ['COMPLETE', 'CALL_FAILED', 'MALFORMED_OUTPUT']);
  assert.equal(validateStage2yLArtifact({ calls, artifact: partial }).ok, false);
  let resumed = 0;
  const again = await runStage2yLLiveBatch({ calls, checkpointArtifact: partial, executeSection: async () => { resumed += 1; throw new Error('must not call'); } });
  assert.equal(resumed, 0);
  assert.equal(again.calls.length, 3);
});

test('2Y-L check mode does not create an executor or make a model call', async () => {
  const { runStage2yLLiveBatch, validateStage2yLArtifact, checkStage2yLArtifact, STAGE_2Y_L_CALLS } = await subject();
  const calls = STAGE_2Y_L_CALLS.slice(0, 1);
  const artifact = await runStage2yLLiveBatch({ calls, executeSection: async ({ call }) => outputFor(call) });
  assert.equal(validateStage2yLArtifact({ calls, artifact }).ok, true);
  let invoked = 0;
  const checked = checkStage2yLArtifact({ calls, artifact, createExecutor: () => { invoked += 1; throw new Error('must not create'); } });
  assert.equal(checked.ok, true);
  assert.equal(invoked, 0);
});

test('2Y-L final check rejects a partial artifact, while resume accepts the same sealed checkpoint', async () => {
  const { runStage2yLLiveBatch, validateStage2yLArtifact, validateCheckpoint, STAGE_2Y_L_CALLS } = await subject();
  const calls = STAGE_2Y_L_CALLS.slice(0, 2);
  let partial = null;
  await assert.rejects(runStage2yLLiveBatch({
    calls, concurrency: 1, executeSection: async ({ call }) => outputFor(call),
    onCheckpoint: async (artifact) => { partial = structuredClone(artifact); throw new Error('STOP_AFTER_ONE'); },
  }), /STOP_AFTER_ONE/);
  assert.equal(partial.calls.length, 1);
  assert.equal(validateStage2yLArtifact({ calls, artifact: partial }).ok, false);
  assert.ok(validateStage2yLArtifact({ calls, artifact: partial }).errors.includes('ARTIFACT_INCOMPLETE'));
  assert.equal(validateCheckpoint({ calls, artifact: partial }).ok, true);
});

test('2Y-L requires run identity, one request id per section, and ISO checkpoint timestamps', async () => {
  const { runStage2yLLiveBatch, validateStage2yLArtifact, STAGE_2Y_L_CALLS } = await subject();
  const calls = STAGE_2Y_L_CALLS.slice(0, 2);
  const artifact = await runStage2yLLiveBatch({ calls, executeSection: async ({ call }) => outputFor(call, 'same-request') });
  artifact.calls[0].output.run_identity = null;
  artifact.calls[1].sealed_at = 'not-an-iso-timestamp';
  const checked = validateStage2yLArtifact({ calls, artifact });
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.includes('COMPLETE_OUTPUT_INVALID'));
  assert.ok(checked.errors.includes('SEALED_AT_INVALID'));
  assert.ok(checked.errors.includes('PROVIDER_REQUEST_ID_DUPLICATE'));
});

test('2Y-L serializes concurrent checkpoint writes so persisted call counts never regress', async () => {
  const { runStage2yLLiveBatch, STAGE_2Y_L_CALLS } = await subject();
  const calls = STAGE_2Y_L_CALLS.slice(0, 2);
  const persistedCounts = []; let firstWriterStarted; let releaseFirstWriter; let bothExecutionsFinished;
  const firstWriter = new Promise((resolve) => { firstWriterStarted = resolve; });
  const release = new Promise((resolve) => { releaseFirstWriter = resolve; });
  const bothFinished = new Promise((resolve) => { bothExecutionsFinished = resolve; });
  let executions = 0;
  const running = runStage2yLLiveBatch({
    calls, concurrency: 2,
    executeSection: async ({ call }) => {
      executions += 1;
      if (executions === 2) bothExecutionsFinished();
      return outputFor(call, `request-${call.call_id}`);
    },
    onCheckpoint: async (artifact) => {
      if (artifact.calls.length === 1) { firstWriterStarted(); await release; }
      persistedCounts.push(artifact.calls.length);
    },
  });
  await firstWriter;
  await bothFinished;
  assert.deepEqual(persistedCounts, []);
  releaseFirstWriter();
  const artifact = await running;
  assert.deepEqual(persistedCounts, [1, 2]);
  assert.equal(persistedCounts.at(-1), artifact.calls.length);
});

test('2Y-L writes checkpoint files atomically through its public runner seam', async () => {
  const { runStage2yLLiveBatch, STAGE_2Y_L_CALLS, writeAtomic } = await subject();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-l-'));
  try {
    const checkpoint = path.join(scratch, 'checkpoint.json');
    await runStage2yLLiveBatch({ calls: STAGE_2Y_L_CALLS.slice(0, 1), executeSection: async ({ call }) => outputFor(call), onCheckpoint: async (artifact) => writeAtomic(checkpoint, `${JSON.stringify(artifact)}\n`) });
    assert.equal(JSON.parse(fs.readFileSync(checkpoint, 'utf8')).calls.length, 1);
    assert.deepEqual(fs.readdirSync(scratch).filter((entry) => entry.includes('.tmp-')), []);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
