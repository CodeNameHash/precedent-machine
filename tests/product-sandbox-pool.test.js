'use strict';

// Parallel hosted worker sandboxes (implementer D, plan finding (140)):
// the pool's names from one constant, the assignment rule, a run's
// ownership of its sandbox across wakes, the BUSY answer and its code on
// the run route, the keepalive on the run's own sandbox, a gone sandbox
// releasing the run, and the sandbox on every read. No live sandbox call.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const {
  SANDBOX_POOL_SIZE, assignSandboxForRun, decideSandboxAssignment, describeOccupancy, isMissingSandboxTable, isSandboxPoolName, runSandbox, sandboxPoolNames,
} = require('../lib/product/sandbox-pool');
const { SANDBOX_NAME, SANDBOX_POOL, keepSandboxAlive, wakeSandboxProductRun, MINIMUM_SESSION_MS } = require('../lib/product/sandbox-wake');
const { createProductRunHandler } = require('../lib/product/run-handler');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { buildPreviewWorkspace } = require('../lib/product/preview-handler');
const { ANTHROPIC_API_MODEL_CONFIG, CLAUDE_CLI_MODEL_CONFIG } = require('../lib/product/product-model-config');
const { createFakeSandboxStore } = require('./helpers/sandbox-pool-fake');

const RUN_A = '46c45080-6935-49e5-96ae-b6cb0609a924';
const RUN_B = '5a0b2a6e-1d8f-4c3a-9b1e-2f7c8d9e0a1b';
const RUN_C = '6b1c3b7f-2e9a-4d4b-8c2f-3a8d9e0f1b2c';
const [FIRST, SECOND] = SANDBOX_POOL;

function responseDouble() {
  return { statusCode: null, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function pooledRuns(statuses) {
  const runs = new Map();
  for (const [runId, status] of Object.entries(statuses)) runs.set(runId, { run_id: runId, status, stage: 'SECTION_ANALYSIS', model_config: CLAUDE_CLI_MODEL_CONFIG });
  return runs;
}

function handlerOn(store, { wakeRun, keepAlive } = {}) {
  return createProductRunHandler({
    getClient: () => ({}), actorResolver: async () => 'ben', storeFactory: () => store,
    modelConfigResolver: () => CLAUDE_CLI_MODEL_CONFIG,
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    claudeOauthTokenResolver: () => 'oauth-'.repeat(8),
    wakeRun: wakeRun || (async (input) => ({ command_id: `cmd-${input.sandboxName}`, sandbox_name: input.sandboxName })),
    keepAlive: keepAlive || (async ({ sandboxName } = {}) => ({ sandbox_name: sandboxName || SANDBOX_NAME, extended_ms: 0, remaining_before_ms: MINIMUM_SESSION_MS, remaining_after_ms: MINIMUM_SESSION_MS, session_created_at: null })),
  });
}

async function post(handler, runId, body = {}) {
  const response = responseDouble();
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body }, response);
  return response;
}

test('the pool is named from one constant: the first keeps the earlier name, the others are numbered from 2', () => {
  assert.equal(SANDBOX_POOL_SIZE, 2);
  assert.deepEqual([...sandboxPoolNames()], ['pm-codex-preview-worker', 'pm-codex-preview-worker-2']);
  assert.deepEqual([...sandboxPoolNames(3)], ['pm-codex-preview-worker', 'pm-codex-preview-worker-2', 'pm-codex-preview-worker-3']);
  assert.deepEqual([...sandboxPoolNames(1)], ['pm-codex-preview-worker']);
  assert.equal(SANDBOX_NAME, 'pm-codex-preview-worker');
  assert.deepEqual([...SANDBOX_POOL], [...sandboxPoolNames()]);
  assert.equal(isSandboxPoolName('pm-codex-preview-worker-2'), true);
  assert.equal(isSandboxPoolName('pm-codex-preview-worker-3'), false, 'outside the pool');
  assert.equal(isSandboxPoolName('pm-codex-preview-worker-02'), false);
  assert.equal(isSandboxPoolName('other'), false);
  assert.throws(() => sandboxPoolNames(0), /at least one/);
});

test('the assignment rule: a run keeps its sandbox, a new run takes the first free one, ended runs release theirs, a full pool is BUSY', () => {
  const pool = [FIRST, SECOND];
  const held = (runId, name, status) => ({ run_id: runId, sandbox_name: name, assigned_at: '2026-10-18T20:00:00.000Z', released_at: null, run_status: status });
  // An empty pool: the first sandbox.
  let decision = decideSandboxAssignment({ runId: RUN_A, runStatus: 'QUEUED', pool, assignments: [] });
  assert.equal(decision.state, 'ASSIGNED');
  assert.equal(decision.sandbox_name, FIRST);
  assert.deepEqual(decision.sandboxes.map((entry) => [entry.sandbox_name, entry.run_id]), [[FIRST, RUN_A], [SECOND, null]]);
  // The first held by a live run: the second.
  decision = decideSandboxAssignment({ runId: RUN_B, runStatus: 'QUEUED', pool, assignments: [held(RUN_A, FIRST, 'RUNNING')] });
  assert.equal(decision.state, 'ASSIGNED');
  assert.equal(decision.sandbox_name, SECOND);
  // A PARTIAL run holds its sandbox (its worker may be live, or a plain wake resumes it there).
  decision = decideSandboxAssignment({ runId: RUN_B, runStatus: 'QUEUED', pool, assignments: [held(RUN_A, FIRST, 'PARTIAL')] });
  assert.equal(decision.sandbox_name, SECOND);
  // Both held: BUSY, with the holders.
  decision = decideSandboxAssignment({ runId: RUN_C, runStatus: 'QUEUED', pool, assignments: [held(RUN_A, FIRST, 'RUNNING'), held(RUN_B, SECOND, 'PARTIAL')] });
  assert.equal(decision.state, 'BUSY');
  assert.equal(decision.sandbox_name, null);
  assert.deepEqual(decision.sandboxes.map((entry) => [entry.sandbox_name, entry.run_id, entry.run_status]), [[FIRST, RUN_A, 'RUNNING'], [SECOND, RUN_B, 'PARTIAL']]);
  assert.equal(describeOccupancy(decision.sandboxes), `${FIRST}: run ${RUN_A} RUNNING; ${SECOND}: run ${RUN_B} PARTIAL`);
  // A run that owns the second keeps it, even with the first free.
  decision = decideSandboxAssignment({ runId: RUN_B, runStatus: 'RUNNING', pool, assignments: [held(RUN_B, SECOND, 'RUNNING')] });
  assert.equal(decision.state, 'KEPT');
  assert.equal(decision.sandbox_name, SECOND);
  // An owner that is READY or FAILED releases; its sandbox is free for the new run.
  decision = decideSandboxAssignment({ runId: RUN_C, runStatus: 'QUEUED', pool, assignments: [held(RUN_A, FIRST, 'READY'), held(RUN_B, SECOND, 'RUNNING')] });
  assert.equal(decision.state, 'ASSIGNED');
  assert.equal(decision.sandbox_name, FIRST);
  assert.deepEqual(decision.releases, [RUN_A]);
  decision = decideSandboxAssignment({ runId: RUN_C, runStatus: 'QUEUED', pool, assignments: [held(RUN_A, FIRST, 'FAILED')] });
  assert.deepEqual([decision.state, decision.sandbox_name, decision.releases], ['ASSIGNED', FIRST, [RUN_A]]);
  // A released row is not a holder.
  decision = decideSandboxAssignment({ runId: RUN_C, runStatus: 'QUEUED', pool, assignments: [{ ...held(RUN_A, FIRST, 'RUNNING'), released_at: '2026-10-18T21:00:00.000Z' }] });
  assert.equal(decision.sandbox_name, FIRST);
  // A run that is READY or FAILED takes no sandbox.
  decision = decideSandboxAssignment({ runId: RUN_A, runStatus: 'READY', pool, assignments: [held(RUN_A, FIRST, 'READY')] });
  assert.deepEqual([decision.state, decision.sandbox_name, decision.releases], ['RUN_ENDED', null, [RUN_A]]);
  assert.equal(decideSandboxAssignment({ runId: RUN_A, runStatus: 'FAILED', pool, assignments: [] }).state, 'RUN_ENDED');
  assert.throws(() => decideSandboxAssignment({ runId: '', runStatus: 'QUEUED', pool }), /runId/);
  assert.throws(() => decideSandboxAssignment({ runId: RUN_A, runStatus: 'QUEUED', pool: [] }), /pool/);
});

test('a run owns one sandbox from its first wake until READY or FAILED; a third run is PRODUCT_SANDBOX_POOL_BUSY until one ends', async () => {
  const store = createFakeSandboxStore({ runs: pooledRuns({ [RUN_A]: 'QUEUED', [RUN_B]: 'QUEUED', [RUN_C]: 'QUEUED' }) });
  const first = await assignSandboxForRun({ store, runId: RUN_A });
  assert.deepEqual([first.state, first.sandbox_name], ['ASSIGNED', FIRST]);
  store.runs.get(RUN_A).status = 'RUNNING';
  const again = await assignSandboxForRun({ store, runId: RUN_A });
  assert.deepEqual([again.state, again.sandbox_name], ['KEPT', FIRST], 'a second wake of the same run goes to the same sandbox');
  const second = await assignSandboxForRun({ store, runId: RUN_B });
  assert.deepEqual([second.state, second.sandbox_name], ['ASSIGNED', SECOND]);
  store.runs.get(RUN_B).status = 'PARTIAL';
  await assert.rejects(assignSandboxForRun({ store, runId: RUN_C }), (error) => {
    assert.equal(error.code, 'PRODUCT_SANDBOX_POOL_BUSY');
    assert.match(error.message, new RegExp(`${FIRST}: run ${RUN_A} RUNNING; ${SECOND}: run ${RUN_B} PARTIAL`));
    assert.equal(error.sandboxes.length, 2);
    return true;
  });
  assert.equal(store.rows.has(RUN_C), false, 'a BUSY answer writes nothing for the run');
  store.runs.get(RUN_A).status = 'READY';
  const third = await assignSandboxForRun({ store, runId: RUN_C });
  assert.deepEqual([third.state, third.sandbox_name, third.releases], ['ASSIGNED', FIRST, [RUN_A]]);
  assert.equal(store.rows.get(RUN_A).release_reason, 'READY');
  // The read of a run's sandbox.
  assert.deepEqual(await runSandbox(store, RUN_C), { sandbox_name: FIRST, assigned_at: store.rows.get(RUN_C).assigned_at, released_at: null, release_reason: null, live: true });
  assert.equal((await runSandbox(store, RUN_A)).live, false);
  assert.equal(await runSandbox(store, '7c2d4c80-3f0b-4e5c-9d3a-4b9e0f1a2c3d'), null);
  // A store without the pool: the first sandbox, as before the pool.
  assert.deepEqual(await assignSandboxForRun({ store: { assertAccess: async () => {} }, runId: RUN_A }), { state: 'UNPOOLED', sandbox_name: FIRST, releases: [], sandboxes: [] });
  assert.equal(await runSandbox({}, RUN_A), null);
  // A read before the migration is applied is no placement, not a failure
  // of the status poll; any other database error is still thrown.
  const missing = { async getRunSandbox() { throw new Error("DATABASE_ERROR: Could not find the table 'public.product_run_sandboxes' in the schema cache"); } };
  const warned = [];
  const warn = console.warn;
  console.warn = (line) => warned.push(line);
  try {
    assert.equal(await runSandbox(missing, RUN_A), null);
    assert.equal(await runSandbox(missing, RUN_B), null);
  } finally { console.warn = warn; }
  assert.equal(warned.length, 1, 'said once');
  assert.match(warned[0], /apply supabase\/migrations\/20261018200000_product_run_sandboxes\.sql/);
  assert.equal(isMissingSandboxTable(new Error('relation "public.product_run_sandboxes" does not exist')), true);
  assert.equal(isMissingSandboxTable(new Error('DATABASE_ERROR: permission denied for table product_run_sandboxes')), false);
  await assert.rejects(runSandbox({ async getRunSandbox() { throw new Error('DATABASE_ERROR: connection refused'); } }, RUN_A), /connection refused/);
});

test('the run route places two runs on two sandboxes, answers the third 503 PRODUCT_SANDBOX_POOL_BUSY with the holders, and launches nothing for a finished run', async () => {
  const store = createFakeSandboxStore({ runs: pooledRuns({ [RUN_A]: 'QUEUED', [RUN_B]: 'QUEUED', [RUN_C]: 'QUEUED' }), analysis: (runId) => ({ analysis_run_id: runId, status: 'RUNNING' }) });
  const wakes = [];
  const handler = handlerOn(store, { wakeRun: async (input) => { wakes.push(input); return { command_id: `cmd-${wakes.length}` }; } });
  const first = await post(handler, RUN_A);
  assert.equal(first.statusCode, 202);
  assert.equal(first.body.wake_command_id, 'cmd-1');
  assert.deepEqual([first.body.sandbox.sandbox_name, first.body.sandbox.state], [FIRST, 'ASSIGNED']);
  assert.equal(wakes[0].sandboxName, FIRST);
  assert.equal(wakes[0].claudeOauthToken, 'oauth-'.repeat(8));
  store.runs.get(RUN_A).status = 'RUNNING';
  const second = await post(handler, RUN_B);
  assert.equal(second.statusCode, 202);
  assert.deepEqual([second.body.sandbox.sandbox_name, second.body.sandbox.state], [SECOND, 'ASSIGNED']);
  assert.equal(wakes[1].sandboxName, SECOND);
  store.runs.get(RUN_B).status = 'RUNNING';
  // The first run woken again: the same sandbox, KEPT.
  const kept = await post(handler, RUN_A);
  assert.deepEqual([kept.statusCode, kept.body.sandbox.sandbox_name, kept.body.sandbox.state], [202, FIRST, 'KEPT']);
  assert.equal(wakes[2].sandboxName, FIRST);
  // A third run: the code, the holders, a Retry-After, no wake.
  const busy = await post(handler, RUN_C);
  assert.equal(busy.statusCode, 503);
  assert.equal(busy.body.error, 'PRODUCT_SANDBOX_POOL_BUSY');
  assert.deepEqual(busy.body.sandboxes.map((entry) => [entry.sandbox_name, entry.run_id, entry.run_status]), [[FIRST, RUN_A, 'RUNNING'], [SECOND, RUN_B, 'RUNNING']]);
  assert.equal(busy.headers['Retry-After'], '300');
  assert.equal(wakes.length, 3);
  // The first run finishes: the third takes its sandbox at the next wake.
  store.runs.get(RUN_A).status = 'READY';
  const third = await post(handler, RUN_C);
  assert.deepEqual([third.statusCode, third.body.sandbox.sandbox_name, third.body.sandbox.state], [202, FIRST, 'ASSIGNED']);
  assert.equal(wakes[3].sandboxName, FIRST);
  // A wake for the READY run launches nothing and names no sandbox.
  const ended = await post(handler, RUN_A);
  assert.equal(ended.statusCode, 202);
  assert.equal(ended.body.wake_command_id, null);
  assert.deepEqual([ended.body.sandbox.sandbox_name, ended.body.sandbox.state], [null, 'RUN_ENDED']);
  assert.equal(wakes.length, 4);
});

test('a gone sandbox releases the run so its next wake takes another; the 503 names the sandbox', async () => {
  const store = createFakeSandboxStore({ runs: pooledRuns({ [RUN_A]: 'QUEUED' }) });
  let gone = true;
  const wakes = [];
  const handler = handlerOn(store, { wakeRun: async (input) => {
    wakes.push(input.sandboxName);
    if (gone && input.sandboxName === FIRST) { const error = new Error(`PRODUCT_SANDBOX_GONE: ${FIRST} cannot be resumed`); error.code = 'PRODUCT_SANDBOX_GONE'; error.sandbox_name = FIRST; throw error; }
    return { command_id: 'cmd' };
  } });
  const failed = await post(handler, RUN_A);
  assert.equal(failed.statusCode, 503);
  assert.deepEqual(failed.body, { error: 'PRODUCT_SANDBOX_GONE', sandbox_name: FIRST });
  assert.deepEqual(store.calls.release, [{ runId: RUN_A, reason: 'SANDBOX_GONE' }]);
  assert.equal(store.rows.get(RUN_A).release_reason, 'SANDBOX_GONE');
  // The pool cannot know a sandbox is gone until a wake tries it: the next
  // wake takes the first free name again and fails the same way while the
  // operator recreates it; nothing is held meanwhile.
  const still = await post(handler, RUN_A);
  assert.equal(still.statusCode, 503);
  assert.equal(store.rows.get(RUN_A).released_at !== null, true);
  gone = false;
  const next = await post(handler, RUN_A);
  assert.deepEqual([next.statusCode, next.body.sandbox.sandbox_name, next.body.sandbox.state], [202, FIRST, 'ASSIGNED']);
  assert.equal(store.rows.get(RUN_A).released_at, null);
  assert.deepEqual(wakes, [FIRST, FIRST, FIRST]);
  // A store without the pool releases nothing on a gone sandbox.
  const legacyReleases = [];
  const legacy = createProductRunHandler({
    getClient: () => ({}), actorResolver: async () => 'ben',
    storeFactory: () => ({ assertAccess: async () => {}, getRun: async () => ({ run_id: RUN_A, model_config: ANTHROPIC_API_MODEL_CONFIG }), getAgreementAnalysis: async () => ({}), releaseRunSandbox: async (input) => { legacyReleases.push(input); } }),
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKeyResolver: () => 'service-role-secret-value', anthropicApiKeyResolver: () => 'sk-ant-'.repeat(6),
    wakeRun: async () => { const error = new Error('PRODUCT_SANDBOX_GONE: gone'); error.code = 'PRODUCT_SANDBOX_GONE'; throw error; },
  });
  assert.equal((await post(legacy, RUN_A)).statusCode, 503);
  assert.deepEqual(legacyReleases, []);
});

test('the keepalive goes to the sandbox the run owns, says NOT_ASSIGNED for a run without one, and an operator can release a run', async () => {
  const store = createFakeSandboxStore({ runs: pooledRuns({ [RUN_A]: 'QUEUED', [RUN_B]: 'QUEUED' }) });
  const kept = [];
  const handler = handlerOn(store, { keepAlive: async ({ sandboxName } = {}) => { kept.push(sandboxName); return { sandbox_name: sandboxName, extended_ms: 5, remaining_before_ms: 1, remaining_after_ms: 6, session_created_at: null }; } });
  // Before any wake: nothing to keep alive.
  const none = await post(handler, RUN_B, { keepalive: true });
  assert.equal(none.statusCode, 200);
  assert.deepEqual(none.body.keepalive, { state: 'NOT_ASSIGNED', sandbox_name: null, released: null });
  assert.deepEqual(kept, []);
  await post(handler, RUN_A);
  store.runs.get(RUN_A).status = 'RUNNING';
  await post(handler, RUN_B);
  const alive = await post(handler, RUN_B, { keepalive: true });
  assert.equal(alive.statusCode, 200);
  assert.deepEqual([alive.body.keepalive.state, alive.body.keepalive.sandbox_name, alive.body.keepalive.extended_ms], ['ASSIGNED', SECOND, 5]);
  assert.deepEqual(kept, [SECOND]);
  // An operator frees an abandoned run's sandbox.
  const released = await post(handler, RUN_A, { release_sandbox: true });
  assert.equal(released.statusCode, 200);
  assert.deepEqual(released.body.released, { run_id: RUN_A, released: true, sandbox_name: FIRST });
  assert.equal(store.rows.get(RUN_A).release_reason, 'OPERATOR:ben');
  const after = await post(handler, RUN_A, { keepalive: true });
  assert.equal(after.body.keepalive.state, 'NOT_ASSIGNED');
  assert.equal(after.body.keepalive.released.release_reason, 'OPERATOR:ben');
  assert.deepEqual(kept, [SECOND], 'a released run keeps nothing alive');
  // A store without the pool keeps the first sandbox alive, as before.
  const legacy = createProductRunHandler({
    getClient: () => ({}), actorResolver: async () => 'ben',
    storeFactory: () => ({ assertAccess: async () => {}, getRun: async () => ({ run_id: RUN_A, model_config: ANTHROPIC_API_MODEL_CONFIG }), getAgreementAnalysis: async () => ({}) }),
    keepAlive: async (options) => { kept.push(options?.sandboxName ?? 'default'); return { sandbox_name: SANDBOX_NAME, extended_ms: 0 }; },
  });
  const unpooled = await post(legacy, RUN_A, { keepalive: true });
  assert.equal(unpooled.body.keepalive.state, 'UNPOOLED');
  assert.deepEqual(kept, [SECOND, 'default']);
});

test('the wake and the keepalive resume the named sandbox and refuse a name outside the pool', async () => {
  const gets = [];
  const commands = [];
  const now = Date.now();
  const sandboxApi = { async get(params) {
    gets.push(params.name);
    return {
      currentSession: () => ({ createdAt: new Date(now), timeout: MINIMUM_SESSION_MS + 1000 }),
      async extendTimeout() { throw new Error('not needed'); },
      async runCommand(command) { commands.push(command); return { cmdId: `cmd-${params.name}`, async wait() { return { exitCode: 0 }; } }; },
    };
  } };
  const base = { runId: RUN_A, databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value', providerId: CLAUDE_CLI_MODEL_CONFIG.provider_id, claudeOauthToken: 'oauth-'.repeat(8), sandboxApi, now: () => now };
  const wake = await wakeSandboxProductRun({ ...base, sandboxName: SECOND });
  assert.deepEqual([wake.sandbox_name, wake.command_id], [SECOND, `cmd-${SECOND}`]);
  assert.equal(commands[0].env.CLAUDE_CODE_OAUTH_TOKEN, 'oauth-'.repeat(8));
  assert.equal((await wakeSandboxProductRun(base)).sandbox_name, FIRST, 'the first sandbox without a name');
  const keepalive = await keepSandboxAlive({ sandboxApi, now: () => now, sandboxName: SECOND });
  assert.equal(keepalive.sandbox_name, SECOND);
  assert.deepEqual(gets, [SECOND, FIRST, SECOND]);
  await assert.rejects(wakeSandboxProductRun({ ...base, sandboxName: 'pm-codex-preview-worker-9' }), /PRODUCT_SANDBOX_NAME_INVALID/);
  await assert.rejects(keepSandboxAlive({ sandboxApi, sandboxName: 'other' }), /PRODUCT_SANDBOX_NAME_INVALID/);
  // A gone second sandbox names itself and its create command.
  const gone = { async get() { const error = new Error('Status code 404 is not ok: not found'); error.response = { status: 404 }; throw error; } };
  await assert.rejects(wakeSandboxProductRun({ ...base, sandboxApi: gone, sandboxName: SECOND }), (error) => {
    assert.equal(error.code, 'PRODUCT_SANDBOX_GONE');
    assert.equal(error.sandbox_name, SECOND);
    assert.match(error.message, new RegExp(`${SECOND} cannot be resumed .*create-sandbox-worker\\.js --name ${SECOND}`));
    return true;
  });
});

test('the analysis read, the preview progress and the provisions page show which sandbox a run is on', async () => {
  const store = createFakeSandboxStore({ runs: pooledRuns({ [RUN_A]: 'RUNNING' }), analysis: (runId) => ({ analysis_run_id: runId, status: 'RUNNING' }) });
  await store.assignRunSandbox({ runId: RUN_A, pool: [...SANDBOX_POOL] });
  const read = createProductAnalysisHandler({ getClient: () => ({}), storeFactory: () => store });
  const response = responseDouble();
  await read({ method: 'GET', query: { id: RUN_A } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.model_provider, CLAUDE_CLI_MODEL_CONFIG.provider_id);
  assert.deepEqual([response.body.sandbox.sandbox_name, response.body.sandbox.live], [FIRST, true]);
  // A run never woken on the pool carries no sandbox.
  const bare = responseDouble();
  await read({ method: 'GET', query: { id: RUN_B } }, bare);
  assert.equal(bare.statusCode, 200);
  assert.equal('sandbox' in bare.body, false);

  const context = {
    run: { run_id: RUN_A, status: 'RUNNING', stage: 'SECTION_ANALYSIS', schema_version: 'LEGAL_SCHEMA/V2', model_config: CLAUDE_CLI_MODEL_CONFIG },
    sourceDocument: { parties: ['Parent Inc.', 'Target Corp.'], canonical_text: 'Section 3.14. Text.' },
    agreementStructure: { nodes: [{ node_id: 'n1', reference: '3.14', authored_order: 1, kind: 'SECTION', substantive: true }] },
  };
  const live = buildPreviewWorkspace({ ...context, sections: [], sandbox: await runSandbox(store, RUN_A) });
  assert.equal(live.progress.sandbox, FIRST);
  assert.equal(buildPreviewWorkspace({ ...context, sections: [] }).progress.sandbox, null);
  await store.releaseRunSandbox({ runId: RUN_A, reason: 'READY' });
  assert.equal(buildPreviewWorkspace({ ...context, sections: [], sandbox: await runSandbox(store, RUN_A) }).progress.sandbox, null, 'a released assignment is not shown');

  // The page's eyebrow is asserted in tests/product-provisions-preview.test.js,
  // which carries the JSX loader.
});

test('the intake panel names the busy pool in words and shows the run\'s sandbox under its status', async () => {
  const { transform } = require('next/dist/build/swc');
  const filename = require.resolve('../components/product/ProductIntakePanel.jsx');
  const transformed = await transform(fs.readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(transformed.code, filename);
  const { describeProductRunError, acceptProductRunResponse } = compiled.exports;
  assert.equal(describeProductRunError({ error: 'PRODUCT_SANDBOX_POOL_BUSY', sandboxes: [
    { sandbox_name: FIRST, run_id: RUN_A, run_status: 'RUNNING' }, { sandbox_name: SECOND, run_id: RUN_B, run_status: 'PARTIAL' },
  ] }), `Every worker sandbox is busy: ${FIRST} (run ${RUN_A.slice(0, 8)}, RUNNING); ${SECOND} (run ${RUN_B.slice(0, 8)}, PARTIAL). The submission is saved; press Continue analysis when one finishes.`);
  assert.equal(describeProductRunError({ error: 'PRODUCT_SANDBOX_POOL_BUSY' }), 'Every worker sandbox is busy. The submission is saved; press Continue analysis when one finishes.');
  assert.equal(describeProductRunError({ error: 'PRODUCT_SANDBOX_GONE' }), 'PRODUCT_SANDBOX_GONE');
  assert.equal(describeProductRunError({}), 'Analysis could not continue');
  // The sandbox rides the run record the panel keeps between reads.
  const run = await acceptProductRunResponse({ value: { analysis_run_id: RUN_A, status: 'RUNNING', stage: 'SECTION_ANALYSIS', sandbox: { sandbox_name: SECOND, live: true } } });
  assert.equal(run.sandbox.sandbox_name, SECOND);
  const source = fs.readFileSync(filename, 'utf8');
  assert.match(source, /data-testid="product-run-sandbox">Worker sandbox: \{run\.sandbox\.sandbox_name\}/);
});
