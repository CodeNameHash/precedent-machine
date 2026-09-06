const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ReactDOMServer = require('react-dom/server');

const { transform } = require('next/dist/build/swc');
const { ProductPhase1Store } = require('../lib/product/phase-1-store');

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
      progress: { total: 105, completed: 1, failed: 1, running: 1, cost_microusd: 0 },
    },
    previousRun: hostedProgress,
    navigate: async (route) => routes.push(route),
  });

  assert.equal(failed.status, 'FAILED');
  assert.equal(productRunId(failed), runId);
  assert.equal(shouldPollProductRun(failed), true);
  assert.equal(canAdvanceProductRun(failed), false);
  assert.deepEqual(routes, []);

  const drainedFailure = await acceptProductRunResponse({
    value: {
      schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
      analysis_run_id: runId,
      status: 'FAILED',
      stage: 'SECTION_ANALYSIS',
      progress: { total: 105, completed: 1, failed: 2, running: 0, cost_microusd: 0 },
    },
    previousRun: failed,
    navigate: async (route) => routes.push(route),
  });

  assert.equal(shouldPollProductRun(drainedFailure), false);
  assert.equal(canAdvanceProductRun(drainedFailure), false);

  const partial = await acceptProductRunResponse({
    value: {
      schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
      analysis_run_id: runId,
      status: 'PARTIAL',
      stage: 'SECTION_ANALYSIS',
      progress: { total: 105, completed: 2, failed: 1, cost_microusd: 0 },
    },
    previousRun: drainedFailure,
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

test('status refresh permits one read, shows last-known failure and clears it only after success', async () => {
  const { refreshProductRunStatus } = await loadIntakePanelModule();
  const inFlight = { current: false };
  const messages = [];
  let releaseFirst;
  let calls = 0;
  const readRun = async () => {
    calls += 1;
    if (calls === 1) await new Promise((resolve, reject) => { releaseFirst = () => reject(new Error('Read timed out')); });
    return { status: 'READY' };
  };

  const first = refreshProductRunStatus({
    runId: 'run-1', readRun, acceptRun: async () => {}, currentRunId: () => 'run-1',
    inFlight, setReadError: (message) => messages.push(message),
  });
  assert.equal(inFlight.current, true);
  assert.equal(await refreshProductRunStatus({
    runId: 'run-1', readRun, acceptRun: async () => {}, currentRunId: () => 'run-1',
    inFlight, setReadError: (message) => messages.push(message),
  }), false);
  assert.equal(calls, 1);

  releaseFirst();
  assert.equal(await first, false);
  assert.equal(inFlight.current, false);
  assert.deepEqual(messages, ['Read timed out']);

  assert.equal(await refreshProductRunStatus({
    runId: 'run-1', readRun, acceptRun: async () => {}, currentRunId: () => 'run-1',
    inFlight, setReadError: (message) => messages.push(message),
  }), true);
  assert.equal(calls, 2);
  assert.deepEqual(messages, ['Read timed out', '']);
});

test('a late status refresh cannot update or show an error for a newly submitted run', async () => {
  const { refreshProductRunStatus } = await loadIntakePanelModule();
  const inFlight = { current: false };
  const accepted = [];
  const messages = [];
  let currentRunId = 'old-run';
  let release;
  const pending = refreshProductRunStatus({
    runId: 'old-run',
    readRun: async () => new Promise((resolve) => { release = resolve; }),
    acceptRun: async (value) => accepted.push(value),
    currentRunId: () => currentRunId,
    inFlight,
    setReadError: (message) => messages.push(message),
  });

  currentRunId = 'new-run';
  release({ status: 'READY' });
  assert.equal(await pending, false);
  assert.deepEqual(accepted, []);
  assert.deepEqual(messages, []);

  currentRunId = 'old-run';
  let rejectOld;
  const failing = refreshProductRunStatus({
    runId: 'old-run',
    readRun: async () => new Promise((resolve, reject) => { rejectOld = reject; }),
    acceptRun: async (value) => accepted.push(value),
    currentRunId: () => currentRunId,
    inFlight,
    setReadError: (message) => messages.push(message),
  });
  currentRunId = 'new-run';
  rejectOld(new Error('Late old read failed'));
  assert.equal(await failing, false);
  assert.deepEqual(messages, []);

  assert.equal(await refreshProductRunStatus({
    runId: 'old-run',
    readRun: async () => { throw new Error('Old read failed'); },
    acceptRun: async (value) => accepted.push(value),
    currentRunId: () => currentRunId,
    inFlight,
    setReadError: (message) => messages.push(message),
  }), false);
  assert.deepEqual(messages, []);
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

test('run progress reports active section workers separately from failures', async () => {
  const rows = [
    { status: 'COMPLETE', cost_microusd: 2, input_tokens: 3, output_tokens: 4 },
    { status: 'FAILED', cost_microusd: 5, input_tokens: 6, output_tokens: 7 },
    { status: 'RUNNING', cost_microusd: 8, input_tokens: 9, output_tokens: 10 },
    { status: 'PENDING', cost_microusd: 0, input_tokens: 0, output_tokens: 0 },
  ];
  const client = {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select() { return this; },
      async eq() { return { data: rows, error: null }; },
    }),
  };

  const progress = await new ProductPhase1Store({ client }).getProgress('run-1');

  assert.deepEqual(progress, {
    total: 4,
    completed: 1,
    failed: 1,
    running: 1,
    cost_microusd: 15,
    input_tokens: 18,
    output_tokens: 21,
  });
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
  assert.match(reviewSource, /displayIdentityParties\(workspace\.analysis\.source_document\.display_parties \|\| workspace\.analysis\.source_document\.parties/);
  assert.doesNotMatch(reviewSource, /source_document\.parties\?\.join/);
  assert.match(reviewSource, /Awaiting review: \{view\.pending_count\}/);
  assert.match(reviewSource, /Marked unresolved: \{view\.unresolved_count\}/);
});

test('intake submission sends the current routing prompt contract', async () => {
  const { default: ProductIntakePanel } = await loadIntakePanelModule();
  const React = require('react');
  const routerModule = require('next/router');
  const original = { useState: React.useState, useEffect: React.useEffect, useRef: React.useRef, useRouter: routerModule.useRouter, fetch: global.fetch };
  const states = [];
  let stateIndex = 0;
  const requests = [];
  const routes = [];
  let submittedRunId;
  React.useState = (initial) => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  };
  React.useEffect = () => {};
  React.useRef = (initial) => ({ current: initial });
  routerModule.useRouter = () => ({ isReady: false, query: {}, push: async () => {}, replace: async (route, as, options) => routes.push({ route, as, options }) });
  global.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, async json() { return url === '/api/product/intake' ? (submittedRunId = crypto.randomUUID(), { analysis_run_id: submittedRunId, status: 'QUEUED', stage: 'SECTION_ANALYSIS', execution_mode: 'HOSTED' }) : { status: 'RUNNING', stage: 'SECTION_ANALYSIS', execution_mode: 'HOSTED' }; } }; };
  try {
    const findElement = (value, predicate) => {
      if (!value) return null;
      if (Array.isArray(value)) { for (const child of value) { const found = findElement(child, predicate); if (found) return found; } return null; }
      if (predicate(value)) return value;
      return findElement(value.props?.children, predicate);
    };
    stateIndex = 0;
    let tree = ProductIntakePanel();
    const input = findElement(tree, (value) => value.type === 'input');
    input.props.onChange({ target: { value: 'https://www.sec.gov/Archives/edgar/data/1/10-k.htm' } });
    stateIndex = 0;
    tree = ProductIntakePanel();
    const form = findElement(tree, (value) => value.type === 'form');
    await form.props.onSubmit({ preventDefault() {} });
    const intakeRequests = requests.filter((request) => request.url === '/api/product/intake');
    assert.equal(intakeRequests.length, 1);
    const body = JSON.parse(intakeRequests[0].options.body);
    assert.deepEqual(routes, [{ route: { pathname: '/review', query: { productRun: submittedRunId } }, as: undefined, options: { shallow: true } }]);
    assert.equal(body.url, 'https://www.sec.gov/Archives/edgar/data/1/10-k.htm');
    assert.equal(body.schemaVersion, 'LEGAL_SCHEMA/V1');
    assert.equal(body.promptBundleVersion, 'PRODUCT_ROUTING_CITATION_REPAIR/V6');
    assert.match(body.idempotencyKey, /^[0-9a-f-]{36}$/);
    assert.equal(body.explicitGeneration, 0);
    assert.equal(body.maxAttempts, 3);
  } finally {
    React.useState = original.useState; React.useEffect = original.useEffect; React.useRef = original.useRef; routerModule.useRouter = original.useRouter; global.fetch = original.fetch;
  }
});

test('draft finalization failure explains saved sections and uses draft assembly retry copy', async () => {
  const { default: ProductIntakePanel } = await loadIntakePanelModule();
  const React = require('react');
  const routerModule = require('next/router');
  const original = {
    useState: React.useState,
    useEffect: React.useEffect,
    useRef: React.useRef,
    useRouter: routerModule.useRouter,
  };
  const runs = [
    {
      status: 'FAILED', stage: 'DRAFT_FINALIZATION', run_id: 'draft-run',
      progress: { total: 79, completed: 79, failed: 0, cost_microusd: 0 },
    },
    {
      status: 'FAILED', stage: 'SECTION_ANALYSIS', run_id: 'section-run',
      progress: { total: 79, completed: 78, failed: 1, cost_microusd: 0 },
    },
    { status: 'FAILED', stage: 'DRAFT_FINALIZATION', run_id: 'sparse-run' },
    {
      status: 'RUNNING', stage: 'DRAFT_FINALIZATION', run_id: 'running-run',
      progress: { total: 79, completed: 79, failed: 0, running: 1, cost_microusd: 0 },
    },
    {
      status: 'PENDING', stage: 'SECTION_ANALYSIS', run_id: 'pending-run',
      progress: { total: 79, completed: 0, failed: 0, cost_microusd: 0 },
    },
  ];
  try {
    React.useEffect = () => {};
    React.useRef = (initial) => ({ current: initial });
    routerModule.useRouter = () => ({ isReady: false, query: {}, push: async () => {}, replace: async () => {} });
    for (const run of runs) {
      let stateIndex = 0;
      React.useState = (initial) => {
        const value = stateIndex++ === 1 ? run : (typeof initial === 'function' ? initial() : initial);
        return [value, () => {}];
      };
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(ProductIntakePanel));
      if (run.status === 'FAILED' && run.stage === 'DRAFT_FINALIZATION') {
        if (run.progress) assert.match(html, /All section results are saved, but assembling the review draft failed\./);
        else {
          assert.match(html, /Saved section results are retained\./);
          assert.doesNotMatch(html, /All section results are saved/);
        }
        assert.match(html, />Retry draft assembly</);
        assert.doesNotMatch(html, />Retry failed sections</);
      } else if (run.status === 'FAILED') {
        assert.match(html, />Retry failed sections</);
        assert.doesNotMatch(html, /All section results are saved/);
      } else {
        assert.doesNotMatch(html, /Retry (?:failed sections|draft assembly)/);
        assert.doesNotMatch(html, /All section results are saved/);
      }
    }
  } finally {
    React.useState = original.useState;
    React.useEffect = original.useEffect;
    React.useRef = original.useRef;
    routerModule.useRouter = original.useRouter;
  }
});
