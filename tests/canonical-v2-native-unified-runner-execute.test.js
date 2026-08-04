'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { sectionizeAdmittedSource, findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  NativeUnifiedRunExecutionError,
  executeUnifiedRun,
  validateIteration2LiveLaunch,
} = require('../lib/canonical-v2/native-producer/unified-runner-execute');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');

const ROOT = path.resolve(__dirname, '..');
const RAW_PATH = 'tests/fixtures/canonical-v2/native-unified-runner/compact-source.htm';
const RAW = fs.readFileSync(path.resolve(ROOT, RAW_PATH));
const RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm';
const RETRIEVAL_POLICY_DIGEST = sha256Hex('native unified runner execute test');
const DEAL_ADMISSION_ID = sha256Hex('native unified runner execute deal');

function sourceMaterial() {
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: RETRIEVAL_URL,
    final_url: RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: RETRIEVAL_POLICY_DIGEST,
    redirect_count: 0,
    response_bytes: RAW,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const tree = sectionizeAdmittedSource({
    source_text: conversion.canonical_text,
    document_hash: sha256Hex(RAW),
  });
  return { conversion, tree };
}

const MATERIAL = sourceMaterial();

function source() {
  return {
    source_id: 'topbuild-original',
    disposition: 'ADMITTED_LOCAL',
    raw_file_path: RAW_PATH,
    retrieval_url: RETRIEVAL_URL,
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: RETRIEVAL_POLICY_DIGEST,
    raw_sha256: sha256Hex(RAW),
    canonical_text_sha256: MATERIAL.conversion.canonical_text_sha256,
    canonical_text_byte_length: MATERIAL.conversion.canonical_text_byte_length,
    governed_deal_key: 'deal:topbuild-execute-test',
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 0,
  };
}

function extract(workItemId, familyId, reference) {
  const node = findSectionByReference(MATERIAL.tree, reference);
  assert.ok(node, `missing fixture section ${reference}`);
  return {
    work_item_id: workItemId,
    source_id: 'topbuild-original',
    family_id: familyId,
    disposition: 'EXTRACT',
    section_pin: {
      section_reference: node.reference,
      section_id: node.section_id,
      section_kind: node.kind,
      section_text_sha256: node.text_sha256,
    },
  };
}

function manifest(workItems) {
  return {
    schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1',
    sources: [source()],
    work_items: workItems,
  };
}

function controls(workItems) {
  return workItems.map((item) => ({
    work_item_id: item.work_item_id,
    profile_id: 'TERRA_MEDIUM',
    covenant_side: item.family_id === 'INTERIM_OPERATING' ? 'TARGET' : null,
  }));
}

function iteration2LaunchManifest() {
  return {
    schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1',
    sources: [],
    work_items: [
      { work_item_id: 'topbuild-no-shop-company-4-3', disposition: 'EXTRACT' },
      { work_item_id: 'topbuild-remedies-specific-performance-7-6', disposition: 'EXTRACT' },
    ],
  };
}

function iteration2LaunchControls() {
  return [
    { work_item_id: 'topbuild-no-shop-company-4-3', profile_id: 'SOL_HIGH', covenant_side: null },
    { work_item_id: 'topbuild-remedies-specific-performance-7-6', profile_id: 'TERRA_MEDIUM', covenant_side: null },
  ];
}

function successfulProviderFactory(observed) {
  return ({ profileId }) => async (input) => {
    observed.push({ profileId, input });
    return {
      provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION',
      model_id: 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM',
      prompt: [{ role: 'user', content: 'recorded test prompt' }],
      proposals: [],
      evidence_residuals: [],
      raw_response_text: '{"open_world_candidates":[]}',
      raw_response_length: 28,
      attempts: 1,
    };
  };
}

test('executes exact manifest families, records replay output and is order-stable', async () => {
  const workItems = [
    extract('topbuild-ioc', 'INTERIM_OPERATING', '2.1'),
    extract('topbuild-consideration', 'CONSIDERATION', '2.1'),
  ];
  const observed = [];
  const first = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    max_concurrency: 2,
    provider_factory: successfulProviderFactory(observed),
  });
  const reversed = [...workItems].reverse();
  const second = await executeUnifiedRun({
    manifest: manifest(reversed),
    work_item_controls: controls(reversed).reverse(),
    root_dir: ROOT,
    max_concurrency: 1,
    provider_factory: successfulProviderFactory([]),
  });

  assert.equal(first.execution_result_id, second.execution_result_id);
  assert.equal(first.succeeded_count, 2);
  assert.equal(first.failed_count, 0);
  assert.equal(observed.length, 2);
  const iocCall = observed.find(({ input }) => input.section_family === 'INTERIM_OPERATING');
  assert.equal(iocCall.profileId, 'TERRA_MEDIUM');
  assert.equal(iocCall.input.governed_scope.covenant_side, 'TARGET');
  first.work_results.forEach((result) => {
    assert.equal(result.status, 'SUCCEEDED');
    assert.equal(result.run_receipt.resolved_sections[0].section_family_provenance, 'SECTION_FAMILY_MANIFEST_ASSIGNED');
    assert.equal(result.provider_recording.provider_output.raw_response_text, '{"open_world_candidates":[]}');
    assert.match(result.provider_recording.provider_recording_id, /^[a-f0-9]{64}$/);
  });
});

test('one provider failure is resumable and does not suppress a valid sibling', async () => {
  const workItems = [
    extract('a-fails', 'CAPITALISATION', '2.1'),
    extract('b-succeeds', 'CONSIDERATION', '2.1'),
  ];
  const result = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    provider_factory: () => async ({ section_family: familyId }) => {
      if (familyId === 'CAPITALISATION') {
        const error = new Error('recorded test failure');
        error.code = 'RETRIES_EXHAUSTED';
        throw error;
      }
      return successfulProviderFactory([])({ profileId: 'TERRA_MEDIUM' })({ section_family: familyId });
    },
  });
  assert.equal(result.succeeded_count, 1);
  assert.equal(result.failed_count, 1);
  assert.equal(result.work_results[0].failure_code, 'RETRIES_EXHAUSTED');
  assert.equal(result.work_results[0].failure_stage, 'PROVIDER_CALL');
  assert.equal(result.work_results[1].status, 'SUCCEEDED');
});

test('a truncated native response is checkpointed with its raw bytes and fails closed', async () => {
  const workItems = [extract('topbuild-capitalisation', 'CAPITALISATION', '2.1')];
  const rawResponse = '{"representation_instances":[],"bring_down_conditions":[],"open_world_candidates":[],"truncated":';
  const checkpoints = [];
  const result = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    provider_factory: () => createAnthropicProvider({
      model: 'strict-json-test',
      maxRetries: 0,
      client: { messages: { async create() { return { content: [{ text: rawResponse }] }; } } },
    }),
    on_work_result: async (_result, checkpoint) => checkpoints.push(checkpoint),
  });
  assert.equal(result.succeeded_count, 0);
  assert.equal(result.failed_count, 1);
  assert.equal(result.work_results[0].failure_code, 'RETRIES_EXHAUSTED');
  assert.equal(result.work_results[0].failure_stage, 'POST_PROVIDER_VALIDATION');
  assert.equal(result.work_results[0].provider_recording.provider_output.raw_response_text, rawResponse);
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].work_result.provider_recording.provider_output.raw_response_text, rawResponse);
});

test('validated successful checkpoints resume without another provider call', async () => {
  const workItems = [extract('topbuild-capitalisation', 'CAPITALISATION', '2.1')];
  const checkpoints = [];
  let calls = 0;
  const first = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    provider_factory: () => async () => {
      calls += 1;
      return successfulProviderFactory([])({ profileId: 'TERRA_MEDIUM' })({});
    },
    on_work_result: async (_result, checkpoint) => checkpoints.push(checkpoint),
  });
  const resumed = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    provider_factory: () => async () => { throw new Error('provider must not be called for a valid checkpoint'); },
    resume_checkpoints: checkpoints,
  });
  assert.equal(calls, 1);
  assert.equal(resumed.execution_result_id, first.execution_result_id);
});

test('checkpoint handler failure becomes a recorded result with replay output', async () => {
  const workItems = [extract('topbuild-capitalisation', 'CAPITALISATION', '2.1')];
  const result = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    provider_factory: successfulProviderFactory([]),
    on_work_result: async () => { throw new Error('simulated checkpoint volume failure'); },
  });
  assert.equal(result.failed_count, 1);
  assert.equal(result.work_results[0].failure_code, 'CHECKPOINT_WRITE_FAILED');
  assert.equal(result.work_results[0].failure_stage, 'CHECKPOINT_WRITE');
  assert.equal(result.work_results[0].provider_recording.provider_output.raw_response_text, '{"open_world_candidates":[]}');
});

test('execution preserves blocked source validation evidence without a provider call', async () => {
  const blockedSource = {
    source_id: 'blocked-source',
    disposition: 'BLOCKED_SOURCE_PIN',
    source_locator: 'SEC Exhibit 2.1',
    blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  const blockedWork = {
    work_item_id: 'blocked-consideration',
    source_id: blockedSource.source_id,
    family_id: 'CONSIDERATION',
    disposition: 'BLOCKED_SOURCE_PIN',
    blocking_code: blockedSource.blocking_code,
  };
  const result = await executeUnifiedRun({
    manifest: { schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1', sources: [blockedSource], work_items: [blockedWork] },
    work_item_controls: [],
    root_dir: ROOT,
    provider_factory: () => { throw new Error('blocked source must not create a provider'); },
  });
  assert.equal(result.work_results.length, 0);
  assert.equal(result.validation_evidence.non_extract_evidence[0].declared_work_item.work_item_id, blockedWork.work_item_id);
  assert.equal(result.validation_evidence.non_extract_evidence[0].source_declaration.source_locator, blockedSource.source_locator);
});

test('controls fail closed on missing rows, wrong sides and unknown profiles', async () => {
  const workItems = [extract('topbuild-ioc', 'INTERIM_OPERATING', '2.1')];
  const base = { manifest: manifest(workItems), root_dir: ROOT, provider_factory: successfulProviderFactory([]) };
  await assert.rejects(
    () => executeUnifiedRun({ ...base, work_item_controls: [] }),
    (error) => error instanceof NativeUnifiedRunExecutionError && error.code === 'INVALID_CONTROLS',
  );
  await assert.rejects(
    () => executeUnifiedRun({
      ...base,
      work_item_controls: [{ work_item_id: 'topbuild-ioc', profile_id: 'TERRA_MEDIUM', covenant_side: null }],
    }),
    (error) => error.code === 'INVALID_CONTROLS',
  );
  await assert.rejects(
    () => executeUnifiedRun({
      ...base,
      work_item_controls: [{ work_item_id: 'topbuild-ioc', profile_id: 'LOCAL_DEFAULT', covenant_side: 'TARGET' }],
    }),
    (error) => error.code === 'INVALID_CONTROLS',
  );
});

test('iteration 2 launch binds the exact Terra/Sol work-item set and two-call ceiling', () => {
  const launch = validateIteration2LiveLaunch({
    manifest: iteration2LaunchManifest(),
    work_item_controls: iteration2LaunchControls(),
  });
  assert.equal(launch.max_model_invocations, 2);
  assert.deepEqual(launch.work_item_ids, [
    'topbuild-no-shop-company-4-3',
    'topbuild-remedies-specific-performance-7-6',
  ]);
  assert.throws(
    () => validateIteration2LiveLaunch({
      manifest: {
        ...iteration2LaunchManifest(),
        work_items: [...iteration2LaunchManifest().work_items, {
          work_item_id: 'outside-iteration-2', disposition: 'EXTRACT',
        }],
      },
      work_item_controls: iteration2LaunchControls(),
    }),
    (error) => error instanceof NativeUnifiedRunExecutionError
      && error.code === 'ITERATION_2_WORK_ITEM_SET_MISMATCH',
  );
  const wrongProfile = iteration2LaunchControls();
  wrongProfile[0] = { ...wrongProfile[0], profile_id: 'TERRA_MEDIUM' };
  assert.throws(
    () => validateIteration2LiveLaunch({
      manifest: iteration2LaunchManifest(), work_item_controls: wrongProfile,
    }),
    (error) => error instanceof NativeUnifiedRunExecutionError
      && error.code === 'ITERATION_2_CONTROL_MISMATCH',
  );
});

test('model invocation ceiling prevents a later work item from reaching its provider', async () => {
  const workItems = [
    extract('topbuild-ioc', 'INTERIM_OPERATING', '2.1'),
    extract('topbuild-consideration', 'CONSIDERATION', '2.1'),
  ];
  const observed = [];
  const result = await executeUnifiedRun({
    manifest: manifest(workItems),
    work_item_controls: controls(workItems),
    root_dir: ROOT,
    max_concurrency: 1,
    max_model_invocations: 1,
    provider_factory: successfulProviderFactory(observed),
  });
  assert.equal(observed.length, 1);
  assert.equal(result.failed_count, 1);
  assert.ok(result.work_results.some((workResult) => (
    workResult.failure_code === 'MAX_MODEL_INVOCATIONS_EXCEEDED'
  )));
});

test('execute CLI requires a closed controls file before any provider can run', () => {
  const workItems = [extract('topbuild-capitalisation', 'CAPITALISATION', '2.1')];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-unified-execute-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const controlsPath = path.join(tempDir, 'controls.json');
  const outputPath = path.join(tempDir, 'result.json');
  const checkpointPath = path.join(tempDir, 'checkpoints');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest(workItems)));
  fs.writeFileSync(controlsPath, JSON.stringify({ work_item_controls: controls(workItems) }));
  const result = spawnSync(process.execPath, [
    'scripts/canonical-v2-native-unified-runner.mjs',
    '--mode=execute',
    '--manifest', manifestPath,
    '--controls', controlsPath,
    '--artifact-root', tempDir,
    '--out', 'result.json',
    '--checkpoint-dir', 'checkpoints',
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /controls file must match NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS\/V1/);
  assert.equal(fs.existsSync(outputPath), false);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('execute CLI keeps artefacts inside the declared artefact root', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-unified-artifact-root-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const controlsPath = path.join(tempDir, 'controls.json');
  const outsidePath = path.join(path.dirname(tempDir), 'native-unified-escaped-result.json');
  const blockedSource = {
    source_id: 'blocked-source', disposition: 'BLOCKED_SOURCE_PIN',
    source_locator: 'SEC Exhibit 2.1', blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  fs.writeFileSync(manifestPath, JSON.stringify({
    schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1',
    sources: [blockedSource],
    work_items: [{
      work_item_id: 'blocked-consideration', source_id: blockedSource.source_id,
      family_id: 'CONSIDERATION', disposition: 'BLOCKED_SOURCE_PIN',
      blocking_code: blockedSource.blocking_code,
    }],
  }));
  fs.writeFileSync(controlsPath, JSON.stringify({
    schema_version: 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1', work_item_controls: [],
  }));
  fs.rmSync(outsidePath, { force: true });
  const result = spawnSync(process.execPath, [
    'scripts/canonical-v2-native-unified-runner.mjs', '--mode=execute',
    '--manifest', manifestPath, '--controls', controlsPath,
    '--artifact-root', tempDir, '--checkpoint-dir', 'checkpoints', '--out', '../native-unified-escaped-result.json',
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--out escapes --artifact-root/);
  assert.equal(fs.existsSync(outsidePath), false);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('iteration 2 CLI requires its isolated paths and refuses an existing checkpoint directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-unified-iteration-2-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const controlsPath = path.join(tempDir, 'controls.json');
  const iteration1Dir = path.join(tempDir, 'iteration-1');
  const iteration1Output = path.join(iteration1Dir, 'execution-result.json');
  fs.mkdirSync(iteration1Dir);
  fs.writeFileSync(iteration1Output, 'iteration 1 remains immutable');
  fs.writeFileSync(manifestPath, JSON.stringify(iteration2LaunchManifest()));
  fs.writeFileSync(controlsPath, JSON.stringify({
    schema_version: 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1',
    work_item_controls: iteration2LaunchControls(),
  }));

  const wrongPath = spawnSync(process.execPath, [
    'scripts/canonical-v2-native-unified-runner.mjs', '--mode=execute-iteration-2',
    '--manifest', manifestPath, '--controls', controlsPath, '--artifact-root', tempDir,
    '--checkpoint-dir', 'iteration-2/checkpoints', '--out', 'iteration-2/other.json',
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(wrongPath.status, 1);
  assert.match(wrongPath.stderr, /iteration 2 output path must be iteration-2\/execution-result\.json/);
  assert.equal(fs.readFileSync(iteration1Output, 'utf8'), 'iteration 1 remains immutable');

  fs.mkdirSync(path.join(tempDir, 'iteration-2'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'iteration-2', 'checkpoints'));
  const existingCheckpoint = spawnSync(process.execPath, [
    'scripts/canonical-v2-native-unified-runner.mjs', '--mode=execute-iteration-2',
    '--manifest', manifestPath, '--controls', controlsPath, '--artifact-root', tempDir,
    '--checkpoint-dir', 'iteration-2/checkpoints', '--out', 'iteration-2/execution-result.json',
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(existingCheckpoint.status, 1);
  assert.match(existingCheckpoint.stderr, /checkpoint directory must be new/);
  assert.equal(fs.readFileSync(iteration1Output, 'utf8'), 'iteration 1 remains immutable');
  assert.equal(fs.existsSync(path.join(tempDir, 'iteration-2', 'execution-result.json')), false);
  fs.rmSync(tempDir, { recursive: true, force: true });
});
