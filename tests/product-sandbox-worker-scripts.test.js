'use strict';

// Work package 4 (plan finding (49)): the persistent worker sandbox idled a
// month and no longer resumed ("Status code 400 is not ok: Cannot resume
// sandbox: no snapshot available"). A gone sandbox is detected the same way
// on a wake (PRODUCT_SANDBOX_GONE, a 503 from the run route), by the update
// script (one line naming the create script) and by the create script,
// which serves every hosted provider and replaces a stale record.

const assert = require('node:assert/strict');
const test = require('node:test');

const { isSandboxGone, keepSandboxAlive, wakeSandboxProductRun, MINIMUM_SESSION_MS, SANDBOX_NAME } = require('../lib/product/sandbox-wake');
const { createProductRunHandler } = require('../lib/product/run-handler');
const { ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, CODEX_PROVIDER_ID } = require('../lib/product/product-model-config');
const { PROVIDER_SETUP, createSandboxWorker, parseArguments } = require('../scripts/product/create-sandbox-worker');
const { resumeFailureMessage } = require('../scripts/product/update-sandbox-worker');

function apiError(status, message, code) {
  const error = new Error(message);
  error.response = { status };
  if (code) error.json = { error: { code } };
  return error;
}

const credentials = { token: 'vercel-token-value', teamId: 'team_1', projectId: 'prj_1' };

test('a sandbox is gone on a 404, a missing snapshot, or the older 400 on resume; not on other failures', () => {
  assert.equal(isSandboxGone(apiError(400, 'Status code 400 is not ok: Cannot resume sandbox: no snapshot available')), true);
  assert.equal(isSandboxGone(apiError(410, 'Status code 410 is not ok', 'snapshot_not_found')), true);
  assert.equal(isSandboxGone(apiError(404, 'Status code 404 is not ok: sandbox not found')), true);
  assert.equal(isSandboxGone(apiError(400, 'Status code 400 is not ok: Cannot resume sandbox: still stopping')), true, 'any 400 on a resume');
  assert.equal(isSandboxGone(apiError(400, 'Status code 400 is not ok: invalid runtime')), false);
  assert.equal(isSandboxGone(apiError(500, 'Status code 500 is not ok')), false);
  assert.equal(isSandboxGone(new Error('network down')), false);
  assert.equal(isSandboxGone(null), false);
});

test('a wake on a gone sandbox fails as PRODUCT_SANDBOX_GONE and the run route answers 503 with that code', async () => {
  const sandboxApi = { async get() { throw apiError(400, 'Status code 400 is not ok: Cannot resume sandbox: no snapshot available'); } };
  const base = { runId: '46c45080-6935-49e5-96ae-b6cb0609a924', databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value', sandboxApi };
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6) }), (error) => {
    assert.equal(error.code, 'PRODUCT_SANDBOX_GONE');
    assert.match(error.message, /PRODUCT_SANDBOX_GONE: pm-codex-preview-worker cannot be resumed .*create-sandbox-worker\.js/);
    assert.doesNotMatch(error.message, /sk-ant-/);
    return true;
  });
  const other = { async get() { throw apiError(500, 'Status code 500 is not ok'); } };
  await assert.rejects(wakeSandboxProductRun({ ...base, sandboxApi: other, providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6) }), /Status code 500/);

  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  const handler = createProductRunHandler({
    getClient: () => ({}), actorResolver: async () => 'ben',
    storeFactory: () => ({ assertAccess: async () => {}, getRun: async () => ({ run_id: runId, model_config: ANTHROPIC_API_MODEL_CONFIG }), getAgreementAnalysis: async () => ({}) }),
    modelConfigResolver: () => ANTHROPIC_API_MODEL_CONFIG,
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    anthropicApiKeyResolver: () => 'sk-ant-'.repeat(6),
    wakeRun: async () => { const error = new Error('PRODUCT_SANDBOX_GONE: gone'); error.code = 'PRODUCT_SANDBOX_GONE'; throw error; },
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'PRODUCT_SANDBOX_GONE' });
});

test('the update script names the create script when the sandbox is gone, and stays silent otherwise', () => {
  const message = resumeFailureMessage(apiError(400, 'Status code 400 is not ok: Cannot resume sandbox: no snapshot available'));
  assert.match(message, /^sandbox pm-codex-preview-worker no longer resumes \(.*no snapshot available\); re-create it with node scripts\/product\/create-sandbox-worker\.js --provider <hosted provider id>$/);
  assert.equal(resumeFailureMessage(apiError(500, 'Status code 500 is not ok')), null);
});

test('the create script takes the provider from --provider, else PRODUCT_MODEL_PROVIDER, else the API, and only a hosted one', () => {
  assert.deepEqual(parseArguments([], {}), { branch: 'codex/product-implementation-plan-20260904', providerId: ANTHROPIC_API_PROVIDER_ID });
  assert.deepEqual(parseArguments([], { PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID }), { branch: 'codex/product-implementation-plan-20260904', providerId: CLAUDE_CLI_PROVIDER_ID });
  assert.deepEqual(parseArguments(['--provider', CODEX_PROVIDER_ID, '--branch', 'main'], { PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID }), { branch: 'main', providerId: CODEX_PROVIDER_ID });
  assert.deepEqual(parseArguments(['main'], {}).branch, 'main');
  assert.throws(() => parseArguments(['--provider', 'ANTHROPIC'], {}), /hosted provider id/);
  assert.throws(() => parseArguments(['--other'], {}), /unknown option/);
  assert.throws(() => parseArguments(['--branch', 'bad branch'], {}), /unexpected branch name/);
  assert.deepEqual(Object.keys(PROVIDER_SETUP).sort(), [ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, CODEX_PROVIDER_ID].sort());
});

// A fake @vercel/sandbox: `get` behaves per the scenario; `create` records
// its parameters; commands record what was run and answer plausibly.
function fakeSandboxApi({ onGet }) {
  const calls = { gets: [], creates: [], commands: [], deleted: 0 };
  const sandbox = (id) => ({
    sandboxId: id,
    async delete(opts) { calls.deleted += 1; calls.deleteOptions = opts; },
    async runCommand({ cmd, args, cwd, detached }) {
      calls.commands.push({ cmd, args, cwd });
      const joined = `${cmd} ${args.join(' ')}`;
      const out = /rev-parse/.test(joined) ? 'abc1234\n' : /--version/.test(joined) ? '1.0.0\n' : /test -f/.test(joined) ? 'yes\n' : /modules load/.test(joined) ? 'modules load\n' : '';
      return {
        exitCode: 0,
        async stdout() { return out; },
        async stderr() { return ''; },
        async *logs() { yield { data: 'login url https://example.test/device\n' }; },
        async wait() { return { exitCode: 0 }; },
        detached,
      };
    },
  });
  return {
    calls,
    async get(params) { calls.gets.push(params); return onGet(params, sandbox); },
    async create(params) { calls.creates.push(params); return sandbox('sbx_new'); },
  };
}

test('an existing sandbox is left to the update script', async () => {
  const api = fakeSandboxApi({ onGet: (params, sandbox) => sandbox('sbx_old') });
  const lines = [];
  const result = await createSandboxWorker({ Sandbox: api, branch: 'main', providerId: ANTHROPIC_API_PROVIDER_ID, credentials, log: (line) => lines.push(line) });
  assert.deepEqual(result, { created: false, sandboxId: 'sbx_old' });
  assert.equal(api.calls.creates.length, 0);
  assert.match(lines.join('\n'), /already exists \(sbx_old\); use update-sandbox-worker\.js/);
});

test('a sandbox that cannot be resumed is deleted and re-created with non-expiring snapshots; the API provider installs no CLI', async () => {
  const api = fakeSandboxApi({ onGet: (params, sandbox) => {
    if (params.resume) throw apiError(400, 'Status code 400 is not ok: Cannot resume sandbox: no snapshot available');
    return sandbox('sbx_stale');
  } });
  const lines = [];
  const result = await createSandboxWorker({ Sandbox: api, branch: 'main', providerId: ANTHROPIC_API_PROVIDER_ID, credentials, log: (line) => lines.push(line) });
  assert.deepEqual(result, { created: true, sandboxId: 'sbx_new', commit: 'abc1234', providerId: ANTHROPIC_API_PROVIDER_ID, clis: [] });
  assert.equal(api.calls.deleted, 1);
  assert.deepEqual(api.calls.deleteOptions, { deleteOrphanSnapshots: true });
  assert.deepEqual(api.calls.gets.map((params) => params.resume), [true, false]);
  assert.deepEqual(api.calls.creates[0], { name: SANDBOX_NAME, persistent: true, runtime: 'node22', timeout: 4 * 60 * 60 * 1000, snapshotExpiration: 0, ...credentials });
  const commands = api.calls.commands.map((command) => `${command.cmd} ${command.args.join(' ')}`);
  assert.ok(commands.some((command) => command.startsWith('git clone --quiet --depth 50 --branch main ')));
  assert.ok(commands.some((command) => command === 'npm ci --no-audit --no-fund --omit=dev'));
  assert.ok(commands.some((command) => /mkdir -p \/vercel\/\.codex \/vercel\/sandbox\/pm-cli\/bin/.test(command)), 'the launcher\'s flock directory and the CLI prefix exist for every path');
  assert.equal(commands.some((command) => /npm install -g/.test(command)), false);
  assert.equal(commands.some((command) => /codex login/.test(command)), false);
  assert.ok(commands.some((command) => /require\('\.\/lib\/product\/anthropic-api-model'\)/.test(command)));
  const output = lines.join('\n');
  assert.match(output, /treating it as gone/);
  assert.match(output, /done: pm-codex-preview-worker \(sbx_new\) on main at abc1234, provider ANTHROPIC_API, CLIs installed: none/);
  assert.doesNotMatch(output, /vercel-token-value/);
});

test('the Claude CLI provider installs claude-code with no login; the Codex provider installs codex and runs the device login', async () => {
  const gone = () => fakeSandboxApi({ onGet: (params, sandbox) => { if (params.resume) throw apiError(404, 'Status code 404 is not ok: not found'); throw apiError(404, 'not found'); } });
  const claude = gone();
  const claudeResult = await createSandboxWorker({ Sandbox: claude, branch: 'main', providerId: CLAUDE_CLI_PROVIDER_ID, credentials, log: () => {} });
  assert.deepEqual(claudeResult.clis, ['@anthropic-ai/claude-code']);
  assert.equal(claude.calls.deleted, 0, 'nothing to delete when the record itself is missing');
  const claudeCommands = claude.calls.commands.map((command) => `${command.cmd} ${command.args.join(' ')}`);
  assert.ok(claudeCommands.some((command) => command === 'npm install -g --no-audit --no-fund --prefix /vercel/sandbox/pm-cli @anthropic-ai/claude-code'));
  assert.ok(claudeCommands.some((command) => /pm-cli\/bin\/claude --version/.test(command)));
  assert.equal(claudeCommands.some((command) => /login/.test(command)), false);
  const codex = gone();
  const written = [];
  const codexResult = await createSandboxWorker({ Sandbox: codex, branch: 'main', providerId: CODEX_PROVIDER_ID, credentials, log: () => {}, stdout: { write: (text) => written.push(text) } });
  assert.deepEqual(codexResult.clis, ['@openai/codex']);
  const codexCommands = codex.calls.commands.map((command) => `${command.cmd} ${command.args.join(' ')}`);
  assert.ok(codexCommands.some((command) => /codex login --device-auth/.test(command)));
  assert.ok(codexCommands.some((command) => /test -f \/vercel\/\.codex\/auth\.json/.test(command)));
  assert.match(written.join(''), /login url/);
});

// Work package 8 (manager, 2026-10-18): generation 8's worker died at about
// 06:10 UTC when the four-hour session the 02:07 wake created ran out; a
// generation takes six. The SDK addresses a sandbox by name with Vercel
// credentials and sets none inside it, so the deployment keeps the session
// alive: the route's keepalive resumes the named sandbox and gives its
// session MINIMUM_SESSION_MS again, launching nothing.
test('keepalive resumes the named sandbox and extends a short session back to the minimum without running a command', async () => {
  const calls = { get: [], extend: [], run: 0 };
  const now = Date.now();
  const sandboxApi = { async get(params) {
    calls.get.push(params);
    return {
      currentSession: () => ({ createdAt: new Date(now - (MINIMUM_SESSION_MS - 10 * 60 * 1000)), timeout: MINIMUM_SESSION_MS }),
      async extendTimeout(ms) { calls.extend.push(ms); },
      async runCommand() { calls.run += 1; throw new Error('never'); },
    };
  } };
  const result = await keepSandboxAlive({ sandboxApi, now: () => now });
  assert.equal(result.schema_version, 'PRODUCT_SANDBOX_KEEPALIVE/V1');
  assert.equal(result.sandbox_name, SANDBOX_NAME);
  assert.deepEqual(calls.get.map((params) => [params.name, params.resume]), [[SANDBOX_NAME, true]]);
  assert.equal(result.remaining_before_ms, 10 * 60 * 1000);
  assert.equal(result.extended_ms, MINIMUM_SESSION_MS - 10 * 60 * 1000);
  assert.deepEqual(calls.extend, [MINIMUM_SESSION_MS - 10 * 60 * 1000]);
  assert.equal(result.remaining_after_ms, MINIMUM_SESSION_MS);
  assert.equal(calls.run, 0, 'no worker is launched');
  // A session with the minimum left is not extended.
  const fresh = { async get() { return { currentSession: () => ({ createdAt: new Date(now), timeout: MINIMUM_SESSION_MS + 1000 }), async extendTimeout() { throw new Error('not needed'); } }; } };
  assert.equal((await keepSandboxAlive({ sandboxApi: fresh, now: () => now })).extended_ms, 0);
  // A gone sandbox is the same code the wake gives.
  const gone = { async get() { throw apiError(404, 'Status code 404 is not ok: sandbox not found'); } };
  await assert.rejects(keepSandboxAlive({ sandboxApi: gone }), (error) => error.code === 'PRODUCT_SANDBOX_GONE');
});

test('the run route answers { keepalive: true } by keeping the sandbox alive and never waking a worker', async () => {
  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  let woke = 0;
  const handler = createProductRunHandler({
    getClient: () => ({}), actorResolver: async () => 'ben',
    storeFactory: () => ({ assertAccess: async () => {}, getRun: async () => ({ run_id: runId, model_config: ANTHROPIC_API_MODEL_CONFIG }), getAgreementAnalysis: async () => ({}) }),
    modelConfigResolver: () => ANTHROPIC_API_MODEL_CONFIG,
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    anthropicApiKeyResolver: () => 'sk-ant-'.repeat(6),
    wakeRun: async () => { woke += 1; return { command_id: 'cmd' }; },
    keepAlive: async () => ({ schema_version: 'PRODUCT_SANDBOX_KEEPALIVE/V1', sandbox_name: SANDBOX_NAME, extended_ms: 1000, remaining_before_ms: 5, remaining_after_ms: 1005, session_created_at: null }),
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: { keepalive: true } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.execution_mode, 'HOSTED');
  assert.equal(response.body.keepalive.extended_ms, 1000);
  assert.equal(woke, 0);
});

// The launcher runs the worker under one lock per sandbox: a wake that finds
// a live worker waits on the lock (up to an hour, then exits 75) and never
// runs a second worker beside it.
test('the launcher starts the worker only under its flock', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const launcher = fs.readFileSync(path.join(__dirname, '../infra/codex-sandbox-worker/launch.sh'), 'utf8');
  const lines = launcher.split('\n');
  const workerLines = lines.filter((line) => /product-hosted-worker\.js/.test(line) && !/^\s*#/.test(line));
  assert.equal(workerLines.length, 1, 'one worker command');
  const lockIndex = lines.findIndex((line) => /exec flock --wait 3600 --conflict-exit-code 75 \/vercel\/\.codex\/pm-worker\.lock/.test(line));
  assert.ok(lockIndex >= 0, 'the flock line');
  assert.equal(lines.indexOf(workerLines[0]), lockIndex + 1, 'the worker command is the flock\'s command');
  // Work package 11: the optional workspace id is passed through for the
  // API provider, never required, and unset with the key for every other.
  assert.ok(lines.some((line) => /^\s*unset ANTHROPIC_API_KEY ANTHROPIC_WORKSPACE_ID$/.test(line)), 'the key and the workspace id leave together');
  assert.equal(lines.some((line) => /ANTHROPIC_WORKSPACE_ID:-/.test(line)), false, 'the workspace id is never required');
});
