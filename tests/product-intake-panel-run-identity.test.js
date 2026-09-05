const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const { transform } = require('next/dist/build/swc');

async function loadIntakePanelModule() {
  const filename = require.resolve('../components/product/ProductIntakePanel.jsx');
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = await transform(source, {
    filename,
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      transform: { react: { runtime: 'automatic' } },
    },
    module: { type: 'commonjs' },
  });
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(transformed.code, filename);
  return compiled.exports;
}

test('API analysis_run_id survives hosted polling and drives FAILED retry identity and READY navigation', async () => {
  const {
    acceptProductRunResponse, canAdvanceProductRun, productRunId, shouldPollProductRun,
  } = await loadIntakePanelModule();
  const runId = '2935661c-3cb5-45cf-98fd-570c73be8e2a';
  const routes = [];
  const hostedProgress = await acceptProductRunResponse({
    value: {
      schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
      analysis_run_id: runId,
      status: 'RUNNING',
      stage: 'SECTION_ANALYSIS',
      execution_mode: 'HOSTED',
      progress: { total: 105, completed: 1, failed: 0, cost_microusd: 0 },
    },
    navigate: async (route) => routes.push(route),
  });

  assert.equal(hostedProgress.run_id, runId);
  assert.equal(shouldPollProductRun(hostedProgress), true);
  assert.deepEqual(routes, []);

  const failed = await acceptProductRunResponse({
    value: {
      schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
      analysis_run_id: runId,
      status: 'FAILED',
      stage: 'SECTION_ANALYSIS',
      progress: { total: 105, completed: 1, failed: 1, cost_microusd: 0 },
    },
    previousRun: hostedProgress,
    navigate: async (route) => routes.push(route),
  });

  assert.equal(failed.status, 'FAILED');
  assert.equal(productRunId(failed), runId);
  assert.equal(shouldPollProductRun(failed), false);
  assert.deepEqual(routes, []);

  const partial = await acceptProductRunResponse({
    value: {
      schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
      analysis_run_id: runId,
      status: 'PARTIAL',
      stage: 'SECTION_ANALYSIS',
      progress: { total: 105, completed: 2, failed: 1, cost_microusd: 0 },
    },
    previousRun: failed,
    navigate: async (route) => routes.push(route),
  });

  assert.equal(productRunId(partial), runId);
  assert.equal(shouldPollProductRun(partial), true);
  assert.equal(canAdvanceProductRun(partial), false);
  assert.deepEqual(routes, []);

  const ready = await acceptProductRunResponse({
    value: {
      schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
      analysis_run_id: runId,
      status: 'READY',
      stage: 'READY',
      progress: { total: 105, completed: 105, failed: 0, cost_microusd: 0 },
    },
    previousRun: partial,
    navigate: async (route) => routes.push(route),
  });

  assert.equal(ready.run_id, runId);
  assert.equal(shouldPollProductRun(ready), false);
  assert.deepEqual(routes, [`/review/product/${runId}`]);
});

test('a sparse hosted wake response preserves the submitted run identity and progress', async () => {
  const { acceptProductRunResponse } = await loadIntakePanelModule();
  const runId = '2935661c-3cb5-45cf-98fd-570c73be8e2a';
  const submitted = {
    run_id: runId,
    status: 'QUEUED',
    stage: 'SECTION_ANALYSIS',
    progress: { total: 105, completed: 0, failed: 0, cost_microusd: 0 },
  };

  const woken = await acceptProductRunResponse({
    value: {
      analysis_run_id: runId,
      status: 'RUNNING',
      stage: 'SECTION_ANALYSIS',
      execution_mode: 'HOSTED',
      wake_command_id: 'command-1',
    },
    fallbackRunId: runId,
    previousRun: submitted,
    navigate: async () => {},
  });

  assert.equal(woken.run_id, runId);
  assert.deepEqual(woken.progress, submitted.progress);
});

test('a sparse response for a new run does not inherit the prior agreement state', async () => {
  const { acceptProductRunResponse } = await loadIntakePanelModule();
  const oldRunId = '2935661c-3cb5-45cf-98fd-570c73be8e2a';
  const newRunId = '3935661c-3cb5-45cf-98fd-570c73be8e2a';
  const nextRun = await acceptProductRunResponse({
    value: { status: 'RUNNING', stage: 'SECTION_ANALYSIS', execution_mode: 'HOSTED' },
    fallbackRunId: newRunId,
    previousRun: {
      run_id: oldRunId,
      status: 'FAILED',
      stage: 'DOCUMENT_IDENTITY_REVIEW',
      source_identity: { parties: ['Old Parent', 'Old Target'] },
      error: { code: 'OLD_RUN_FAILURE' },
      progress: { total: 9, completed: 1, failed: 1, cost_microusd: 0 },
    },
    navigate: async () => {},
  });

  assert.equal(nextRun.run_id, newRunId);
  assert.equal(nextRun.source_identity, undefined);
  assert.equal(nextRun.error, undefined);
  assert.equal(nextRun.progress, undefined);
});

test('identity parties render structured API values and historical strings', async () => {
  const { displayIdentityParties } = await loadIntakePanelModule();
  const reviewSource = fs.readFileSync(require.resolve('../components/product/ReviewWorkspace.jsx'), 'utf8');

  assert.equal(displayIdentityParties([
    { name: 'National Storage Affiliates Trust', role: 'COMPANY' },
    { name: 'Public Storage', role: 'PARENT' },
  ]), 'National Storage Affiliates Trust (Company) / Public Storage (Parent)');
  assert.equal(displayIdentityParties(['Old Parent', 'Old Target']), 'Old Parent / Old Target');
  assert.equal(displayIdentityParties([]), 'Not identified');
  assert.match(reviewSource, /displayIdentityParties\(workspace\.analysis\.source_document\.parties/);
  assert.doesNotMatch(reviewSource, /source_document\.parties\?\.join/);
});
