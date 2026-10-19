'use strict';

// Attempt resume after a worker stop (work package D3, plan finding (142)),
// on fakes: the call identity across the three stored request shapes, the
// reuse rule over the work row's history, the resuming model (zero spend,
// the original named), a stop between calls, the dead-claim release at a
// worker's start, the runner's release of a stopped attempt, and the hosted
// worker's signal handling. No database, no live call.

const assert = require('node:assert/strict');
const test = require('node:test');

const resume = require('../lib/product/attempt-resume');
const { releaseStoppedAttempt } = require('../lib/product/analysis-runner');
const { runHostedWorker, sandboxNameFromEnv, STOP_SIGNALS } = require('../scripts/product-hosted-worker');
const { CLAUDE_CLI_MODEL_CONFIG } = require('../lib/product/product-model-config');

const TOKEN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const CALL_ID = 'a'.repeat(64);

const logical = (part) => ({
  instructions: 'extract', families: ['TERMINATION'],
  source_closure: { structure_node_id: 'node-1', operative: [{ span_id: `s${part}`, exact_text: `text ${part}` }], extraction_part: { part, of: 2, mode: 'limbs', covers_chapeau: part === 1 } },
  part_instruction: `part ${part} of 2`,
});
const cliShape = (request) => ({ model: 'm', messages: [{ role: 'user', content: JSON.stringify({ call_kind: 'EXTRACTION', prompt_version: 'P/V1', ...request }) }] });
const apiShape = (request) => {
  const { source_closure, part_instruction, ...stable } = request;
  return { model: 'm', messages: [{ role: 'user', content: [
    { type: 'text', text: JSON.stringify({ call_kind: 'EXTRACTION', prompt_version: 'P/V1', ...stable }), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: JSON.stringify({ source_closure, part_instruction }) },
  ] }] };
};
const answer = { proposals: [{ client_ref: 'p1' }], coverage: [] };
const apiResponse = { id: 'msg', content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\`` }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' };

function storedCall({ kind = 'EXTRACTION', part = 1, token = TOKEN, request = null, response = apiResponse, id = CALL_ID, createdAt = '2026-10-18T18:00:00Z' } = {}) {
  const invocation = kind === 'EXTRACTION' && part ? resume.invocationId(`${token}:part-${part}`, kind) : resume.invocationId(token, kind);
  return { model_call_id: id, invocation_id: invocation, call_kind: kind, prompt_version: 'P/V1', provider_id: 'ANTHROPIC_API', model_id: 'claude-opus-5', request: request || apiShape(logical(part)), response, input_tokens: 10, output_tokens: 5, cost_microusd: 1000, duration_ms: 1, created_at: createdAt, structure_node_id: 'node-1' };
}

test('the call identity is the logical request, the same from the object, the CLI string and the API blocks; a re-split part is another call', () => {
  const object = resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: logical(1) });
  assert.match(object, /^[0-9a-f]{64}$/);
  assert.equal(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: cliShape(logical(1)) }), object);
  assert.equal(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: apiShape(logical(1)) }), object);
  assert.notEqual(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: logical(2) }), object);
  assert.notEqual(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V2', request: logical(1) }), object, 'another prompt version');
  const resplit = { ...logical(1), source_closure: { ...logical(1).source_closure, extraction_part: { part: 1, of: 3, mode: 'limbs', covers_chapeau: true } }, part_instruction: 'part 1 of 3' };
  assert.notEqual(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: resplit }), object, 'a re-split section reuses nothing');
  assert.deepEqual(resume.logicalRequest(apiShape(logical(2))).source_closure.extraction_part, { part: 2, of: 2, mode: 'limbs', covers_chapeau: false });
  assert.deepEqual(resume.extractionPart(cliShape(logical(2))), { part: 2, of: 2 });
  assert.equal(resume.extractionPart({ section: 'x' }), null);
  assert.equal(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: { messages: [{ content: 'not json' }] } }), null);
});

test('the reuse rule reads the history: an interruption with a token frees every call, a part failure the calls before it, anything else none', () => {
  const invocations = (history) => [...resume.resumableInvocations(history).values()].map((meta) => `${meta.kind}${meta.part ? `:${meta.part}` : ''}`).sort();
  const all = invocations([{ attempt: 1, attempt_token: TOKEN, worker_id: 'w', reason: { code: 'WORKER_STOPPED', parts_completed: [1] } }]);
  assert.equal(all.length, 3 + resume.MAX_PARTS);
  assert.ok(all.includes('ROUTING') && all.includes('RESIDUAL') && all.includes('EXTRACTION') && all.includes('EXTRACTION:1'));
  assert.equal(invocations([{ attempt: 1, attempt_token: TOKEN, error: { code: 'SECTION_LEASE_EXPIRED' } }]).length, 3 + resume.MAX_PARTS);
  assert.equal(invocations([{ attempt: 1, attempt_token: TOKEN, reason: { code: 'WORKER_RESTART' } }]).length, 3 + resume.MAX_PARTS);
  assert.deepEqual(invocations([{ attempt: 1, attempt_token: TOKEN, error: { message: 'ANTHROPIC_API_OUTPUT_TRUNCATED: the cap', code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', part: { part: 3, of: 4 } } }]),
    ['EXTRACTION', 'EXTRACTION:1', 'EXTRACTION:2', 'RESIDUAL', 'ROUTING']);
  assert.deepEqual(invocations([{ attempt: 1, attempt_token: TOKEN, error: { message: 'ANTHROPIC_API_JSON: not one object' } }]), [], 'a failure on the whole call frees nothing');
  assert.deepEqual(invocations([{ attempt: 1, attempt_token: TOKEN, error: { message: 'RESIDUAL_FAMILY_CONSISTENCY: x' } }]), [], 'a failure the calls themselves caused frees nothing');
  assert.deepEqual(invocations([{ attempt: 1, worker_id: 'w', error: { code: 'SECTION_LEASE_EXPIRED' } }]), [], 'no token, no reuse (rows written before this rule)');
  assert.equal(resume.historyCode({ error: { message: 'ANTHROPIC_API_OUTPUT_TRUNCATED: the cap' } }), 'ANTHROPIC_API_OUTPUT_TRUNCATED');
  assert.equal(resume.historyCode({ reason: { code: 'WORKER_STOPPED' } }), 'WORKER_STOPPED');
  assert.equal(resume.historyCode({ error: { message: 'plain words' } }), null);
});

test('the resumable calls are the eligible successful records by identity, the latest attempt first; failure records never', () => {
  const history = [
    { attempt: 1, attempt_token: TOKEN, reason: { code: 'WORKER_STOPPED' } },
    { attempt: 2, attempt_token: OTHER, error: { code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', part: { part: 2, of: 2 } } },
  ];
  const first = storedCall({ part: 1, token: TOKEN, id: 'b'.repeat(64), createdAt: '2026-10-18T18:00:00Z' });
  const again = storedCall({ part: 1, token: OTHER, id: 'c'.repeat(64), createdAt: '2026-10-18T18:30:00Z' });
  const failedPart2 = storedCall({ part: 2, token: OTHER, id: 'd'.repeat(64), response: { schema_version: 'PRODUCT_MODEL_FAILURE_RESPONSE/V1', status: 'LOCAL_VALIDATION_FAILED' } });
  const routing = storedCall({ kind: 'ROUTING', part: null, token: TOKEN, id: 'e'.repeat(64), request: cliShape({ section: 'words' }) });
  const stranger = storedCall({ part: 1, token: '33333333-3333-4333-8333-333333333333', id: 'f'.repeat(64) });
  const calls = resume.resumableCalls({ errorHistory: history, calls: [first, failedPart2, again, routing, stranger] });
  assert.equal(calls.size, 2);
  assert.equal(calls.get(resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: logical(1) })).model_call_id, 'c'.repeat(64), 'the later attempt\'s record');
  assert.equal(calls.get(resume.callIdentity({ callKind: 'ROUTING', promptVersion: 'P/V1', request: { section: 'words' } })).model_call_id, 'e'.repeat(64));
  assert.deepEqual(resume.attemptProgress([routing, first, failedPart2]), { calls: 3, kinds: ['ROUTING', 'EXTRACTION'], parts_completed: [1], parts_total: 2 });
  assert.equal(resume.isFailureRecord(failedPart2), true);
});

test('the resuming model answers a reusable call from the store with zero spend and the original named, calls the provider otherwise, and stops between calls', async () => {
  const provider = { calls: [], async complete(input) { provider.calls.push(input.call_kind); return { response: answer, provider_id: 'ANTHROPIC_API', model_id: 'claude-opus-5', input_tokens: 7, output_tokens: 3, cost_microusd: 500, duration_ms: 9 }; } };
  const stored = storedCall({ part: 1 });
  const calls = new Map([[resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: logical(1) }), stored]]);
  let stop = false;
  const model = resume.resumingModel(provider, { calls, stopRequested: () => stop });
  const reused = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'P/V1', request: logical(1) });
  assert.deepEqual(reused.response, answer, 'parsed from the stored text blocks, fences stripped');
  assert.equal(reused.raw_response, apiResponse);
  assert.equal(reused.raw_request, stored.request);
  assert.deepEqual([reused.input_tokens, reused.output_tokens, reused.cost_microusd, reused.duration_ms], [0, 0, 0, 0]);
  assert.equal(reused.resumed_from_model_call_id, CALL_ID);
  assert.equal(reused.model_id, 'claude-opus-5');
  assert.deepEqual(model.reused, [{ call_kind: 'EXTRACTION', model_call_id: CALL_ID, part: 1 }]);
  const fresh = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'P/V1', request: logical(2) });
  assert.equal(fresh.cost_microusd, 500);
  assert.deepEqual(provider.calls, ['EXTRACTION']);
  // A stored answer that is not one JSON object is not reused.
  const broken = new Map([[resume.callIdentity({ callKind: 'EXTRACTION', promptVersion: 'P/V1', request: logical(1) }), storedCall({ response: { content: [{ type: 'text', text: '{not json' }] } })]]);
  await resume.resumingModel(provider, { calls: broken }).complete({ call_kind: 'EXTRACTION', prompt_version: 'P/V1', request: logical(1) });
  assert.deepEqual(provider.calls, ['EXTRACTION', 'EXTRACTION']);
  // A plain stored object (the synthetic model records no raw response) is the answer itself.
  assert.deepEqual(resume.parsedStoredResponse({ proposals: [] }), { proposals: [] });
  assert.equal(resume.parsedStoredResponse({ schema_version: 'PRODUCT_MODEL_FAILURE_RESPONSE/V1' }), null);
  // The stop: before the next call, never inside one.
  stop = true;
  await assert.rejects(model.complete({ call_kind: 'RESIDUAL', prompt_version: 'P/V1', request: { paragraphs: [] } }), (error) => resume.isWorkerStopRequested(error));
  assert.deepEqual(provider.calls, ['EXTRACTION', 'EXTRACTION']);
});

function fakeStore({ running = [], calls = [] } = {}) {
  const store = {
    released: [], failed: [],
    async listRunningSections() { return running; },
    async loadSectionModelCalls({ nodeId }) { return calls.filter((call) => call.structure_node_id === nodeId); },
    async releaseSection(input) { store.released.push(input); return { work: {}, run: {} }; },
    async failSection(input) { store.failed.push(input); },
  };
  return store;
}

test('a worker that starts after a restart hands back the claims of its own sandbox\'s dead processes, with the parts they completed, and nothing else', async () => {
  const running = [
    { node_id: 'node-1', worker_id: 'product-hosted:pm-codex-preview-worker-2:4242:1', attempt_token: TOKEN, attempts: 1 },
    { node_id: 'node-2', worker_id: 'product-hosted:pm-codex-preview-worker-2:4243:2', attempt_token: OTHER, attempts: 2 },
    { node_id: 'node-3', worker_id: 'product-hosted:pm-codex-preview-worker:4242:1', attempt_token: OTHER, attempts: 1 },
    { node_id: 'node-4', worker_id: 'web:ben', attempt_token: OTHER, attempts: 1 },
  ];
  const calls = [storedCall({ kind: 'ROUTING', part: null, token: TOKEN, request: cliShape({ section: 'x' }) }), storedCall({ part: 1, token: TOKEN, id: 'b'.repeat(64) }), storedCall({ part: 2, token: OTHER, id: 'c'.repeat(64) })];
  const store = fakeStore({ running, calls });
  const events = [];
  const released = await resume.releaseDeadClaims({ store, runId: 'run', sandbox: 'pm-codex-preview-worker-2', isAlive: (pid) => pid === 4243, log: (event) => events.push(event) });
  assert.deepEqual(released.map((entry) => entry.node_id), ['node-1'], 'the live process keeps node-2; the other sandbox keeps node-3; a web claim is not a hosted worker\'s');
  assert.deepEqual(store.released[0], { runId: 'run', nodeId: 'node-1', workerId: 'product-hosted:pm-codex-preview-worker-2:4242:1', attemptToken: TOKEN,
    reason: { code: 'WORKER_RESTART', dead_worker_id: 'product-hosted:pm-codex-preview-worker-2:4242:1', calls: 2, kinds: ['ROUTING', 'EXTRACTION'], parts_completed: [1], parts_total: 2 } });
  assert.equal(events[0].event, 'DEAD_CLAIM_RELEASED');
  // Worker ids before the pool carry no sandbox: a worker without one releases those.
  const legacy = fakeStore({ running: [{ node_id: 'node-9', worker_id: 'product-hosted:77:1', attempt_token: TOKEN, attempts: 1 }] });
  assert.equal((await resume.releaseDeadClaims({ store: legacy, runId: 'run', sandbox: null, isAlive: () => false })).length, 1);
  assert.equal((await resume.releaseDeadClaims({ store: legacy, runId: 'run', sandbox: 'pm-codex-preview-worker', isAlive: () => false })).length, 1, 'an id from before the pool is this sandbox\'s: a run owns one sandbox');
  assert.deepEqual(resume.parseWorkerId('product-hosted:pm-codex-preview-worker:12:2'), { sandbox: 'pm-codex-preview-worker', pid: 12, loop: 2 });
  assert.deepEqual(resume.parseWorkerId('product-hosted:12:2'), { sandbox: null, pid: 12, loop: 2 });
  assert.equal(resume.parseWorkerId('phase3-db-lawyer'), null);
  assert.equal(resume.hostedWorkerId({ sandbox: 'pm-codex-preview-worker-2', pid: 5, loop: 1 }), 'product-hosted:pm-codex-preview-worker-2:5:1');
  assert.equal(resume.hostedWorkerId({ sandbox: null, pid: 5, loop: 1 }), 'product-hosted:5:1');
  assert.equal(resume.processAlive(process.pid), true);
  // A store without the release has nothing to do.
  assert.deepEqual(await resume.releaseDeadClaims({ store: {}, runId: 'run' }), []);
});

test('the runner hands a stopped attempt back with the reason and the parts done, and falls back to the failure record without the release', async () => {
  const store = fakeStore();
  const calls = [storedCall({ kind: 'ROUTING', part: null, request: cliShape({ section: 'x' }) }), storedCall({ part: 1 })];
  const error = resume.workerStopError('SIGTERM');
  error.extraction_part = { part: 2, of: 2 };
  const events = [];
  await releaseStoppedAttempt({ store, runId: 'run', claim: { node_id: 'node-1', attempt_token: TOKEN }, workerId: 'product-hosted:1:1', error, modelCalls: calls, log: (event) => events.push(event) });
  assert.equal(store.released.length, 1);
  assert.deepEqual(store.released[0].reason, { code: 'WORKER_STOPPED', message: 'WORKER_STOP_REQUESTED: SIGTERM', calls: 2, kinds: ['ROUTING', 'EXTRACTION'], parts_completed: [1], parts_total: 2 });
  assert.equal(events[0].event, 'ATTEMPT_RELEASED');
  const plain = { failed: [], async failSection(input) { plain.failed.push(input); } };
  await releaseStoppedAttempt({ store: plain, runId: 'run', claim: { node_id: 'node-1', attempt_token: TOKEN }, workerId: 'w', error, modelCalls: [], log: null });
  assert.equal(plain.failed.length, 1, 'a store without the release records the failure, as before');
});

test('the hosted worker names its sandbox in its worker ids, releases dead claims at start, and a stop signal ends it with its claims handed back', async () => {
  const prior = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, PRODUCT_SANDBOX_NAME: process.env.PRODUCT_SANDBOX_NAME };
  process.env.SUPABASE_URL = 'https://ecrtoofsyxozazkvsvcl.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-service-key';
  process.env.PRODUCT_SANDBOX_NAME = 'pm-codex-preview-worker-2';
  process.env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN || 'oauth-test-value';
  try {
    assert.equal(sandboxNameFromEnv(), 'pm-codex-preview-worker-2');
    assert.equal(sandboxNameFromEnv({ PRODUCT_SANDBOX_NAME: 'Bad Name' }), null);
    assert.deepEqual([...STOP_SIGNALS], ['SIGTERM', 'SIGINT', 'SIGHUP']);
    const runId = '11111111-1111-4111-8111-111111111111';
    const store = {
      released: [],
      async getRun() { return { run_id: runId, status: 'RUNNING', stage: 'SECTION_ANALYSIS', model_config: CLAUDE_CLI_MODEL_CONFIG }; },
      async assertAccess() {},
      async recoverExpiredSections() {},
      async listRunningSections() { return [{ node_id: 'node-1', worker_id: 'product-hosted:pm-codex-preview-worker-2:999999:1', attempt_token: TOKEN, attempts: 1 }]; },
      async loadSectionModelCalls() { return []; },
      async releaseSection(input) { store.released.push(input); },
    };
    const advances = [];
    let requestStop = null;
    const lines = [];
    const output = { write: (line) => lines.push(JSON.parse(line)) };
    const result = runHostedWorker({ runId, actor: 'ben', workers: 1 }, output, {
      createStore: () => store, createModel: () => ({ complete: async () => { throw new Error('never'); } }),
      signals: false, isAlive: () => false, onStopHandle: (handle) => { requestStop = handle; },
      advance: async (input) => {
        advances.push({ workerId: input.workerId, stopRequested: input.stopRequested });
        if (advances.length === 1) {
          requestStop('SIGTERM');
          assert.equal(input.stopRequested(), true, 'the runner sees the stop between calls');
          const error = resume.workerStopError('SIGTERM');
          throw error;
        }
        return { status: 'RUNNING', stage: 'SECTION_ANALYSIS', progress: {} };
      },
    });
    await assert.rejects(result, /PRODUCT_HOSTED_WORKER_STOPPED: SIGTERM/);
    assert.equal(advances.length, 1);
    assert.equal(advances[0].workerId, `product-hosted:pm-codex-preview-worker-2:${process.pid}:1`);
    assert.deepEqual(store.released.map((entry) => [entry.nodeId, entry.reason.code]), [['node-1', 'WORKER_RESTART']], 'the dead claim of this sandbox was handed back at start');
    assert.ok(lines.some((line) => line.event === 'DEAD_CLAIM_RELEASED'));
    assert.ok(lines.some((line) => line.event === 'WORKER_STOP_REQUESTED' && line.signal === 'SIGTERM'));
  } finally {
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
