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
const { ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, CODEX_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID } = require('../lib/product/product-model-config');
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
  assert.match(message, /^sandbox pm-codex-preview-worker no longer resumes \(.*no snapshot available\); re-create it with node scripts\/product\/create-sandbox-worker\.js --provider <hosted provider id> --name pm-codex-preview-worker$/);
  assert.match(resumeFailureMessage(apiError(404, 'not found'), 'pm-codex-preview-worker-2'), /sandbox pm-codex-preview-worker-2 no longer resumes .* --name pm-codex-preview-worker-2$/);
  assert.equal(resumeFailureMessage(apiError(500, 'Status code 500 is not ok')), null);
});

test('the create script takes the provider from --provider, else PRODUCT_MODEL_PROVIDER, else the API, and only a hosted one', () => {
  const pool = ['pm-codex-preview-worker', 'pm-codex-preview-worker-2'];
  assert.deepEqual(parseArguments([], {}), { branch: 'codex/product-implementation-plan-20260904', providerId: ANTHROPIC_API_PROVIDER_ID, names: pool });
  assert.deepEqual(parseArguments([], { PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID }), { branch: 'codex/product-implementation-plan-20260904', providerId: CLAUDE_CLI_PROVIDER_ID, names: pool });
  assert.deepEqual(parseArguments(['--provider', CODEX_PROVIDER_ID, '--branch', 'main'], { PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID }), { branch: 'main', providerId: CODEX_PROVIDER_ID, names: pool });
  assert.deepEqual(parseArguments(['main'], {}).branch, 'main');
  assert.throws(() => parseArguments(['--provider', 'ANTHROPIC'], {}), /hosted provider id/);
  assert.throws(() => parseArguments(['--other'], {}), /unknown option/);
  assert.throws(() => parseArguments(['--branch', 'bad branch'], {}), /unexpected branch name/);
  assert.deepEqual(Object.keys(PROVIDER_SETUP).sort(), [ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, CODEX_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID].sort());
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

// Plan finding (140): the scripts serve the pool. Without --name they walk
// every sandbox of the pool; with --name one; a name outside the pool is
// refused. The update script skips a sandbox whose launcher lock is held (a
// worker is live on it) unless --force says otherwise.
const { createSandboxPool } = require('../scripts/product/create-sandbox-worker');
const updateScript = require('../scripts/product/update-sandbox-worker');
const { SANDBOX_POOL } = require('../lib/product/sandbox-wake');

test('the create script takes --name for one sandbox of the pool, else the whole pool, and refuses a name outside it', () => {
  assert.deepEqual(parseArguments(['--name', 'pm-codex-preview-worker-2'], {}).names, ['pm-codex-preview-worker-2']);
  assert.deepEqual(parseArguments(['--name', 'pm-codex-preview-worker', '--provider', CLAUDE_CLI_PROVIDER_ID], {}).names, ['pm-codex-preview-worker']);
  assert.deepEqual(parseArguments([], {}).names, [...SANDBOX_POOL]);
  // Work package E2: the experiments sandbox is created by name for the
  // ablation job; it is never part of the run pool.
  assert.deepEqual(parseArguments(['--name', 'pm-codex-preview-worker-3', '--provider', CLAUDE_CLI_PROVIDER_ID], {}).names, ['pm-codex-preview-worker-3']);
  assert.throws(() => parseArguments(['--name', 'pm-codex-preview-worker-4'], {}), /--name must be a sandbox of the pool or the experiments sandbox \(pm-codex-preview-worker, pm-codex-preview-worker-2, pm-codex-preview-worker-3\), not pm-codex-preview-worker-4/);
  assert.throws(() => parseArguments(['--name', 'worker'], {}), /--name must be a sandbox of the pool or the experiments sandbox/);
});

test('the create script provisions each missing sandbox of the pool under its own name and leaves an existing one to the update script', async () => {
  const api = fakeSandboxApi({ onGet: (params, sandbox) => {
    if (params.name === 'pm-codex-preview-worker') return sandbox('sbx_first');
    throw apiError(404, 'Status code 404 is not ok: not found');
  } });
  const lines = [];
  const results = await createSandboxPool({ Sandbox: api, branch: 'main', providerId: CLAUDE_CLI_PROVIDER_ID, credentials, log: (line) => lines.push(line) });
  assert.deepEqual(Object.keys(results), ['pm-codex-preview-worker', 'pm-codex-preview-worker-2']);
  assert.deepEqual(results['pm-codex-preview-worker'], { created: false, sandboxId: 'sbx_first' });
  assert.deepEqual(results['pm-codex-preview-worker-2'], { created: true, sandboxId: 'sbx_new', commit: 'abc1234', providerId: CLAUDE_CLI_PROVIDER_ID, clis: ['@anthropic-ai/claude-code'] });
  assert.deepEqual(api.calls.creates.map((params) => params.name), ['pm-codex-preview-worker-2']);
  assert.deepEqual(api.calls.creates[0], { name: 'pm-codex-preview-worker-2', persistent: true, runtime: 'node22', timeout: 4 * 60 * 60 * 1000, snapshotExpiration: 0, ...credentials });
  const output = lines.join('\n');
  assert.match(output, /sandbox pm-codex-preview-worker already exists \(sbx_first\); use update-sandbox-worker\.js/);
  assert.match(output, /creating persistent sandbox pm-codex-preview-worker-2 for ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION/);
  assert.match(output, /done: pm-codex-preview-worker-2 \(sbx_new\) on main at abc1234, provider ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION, CLIs installed: @anthropic-ai\/claude-code/);
  assert.doesNotMatch(output, /vercel-token-value/);
  // One name: that sandbox alone.
  const one = fakeSandboxApi({ onGet: () => { throw apiError(404, 'not found'); } });
  await createSandboxPool({ Sandbox: one, names: ['pm-codex-preview-worker-2'], branch: 'main', providerId: ANTHROPIC_API_PROVIDER_ID, credentials, log: () => {} });
  assert.deepEqual(one.calls.creates.map((params) => params.name), ['pm-codex-preview-worker-2']);
  await assert.rejects(createSandboxWorker({ Sandbox: one, name: 'pm-codex-preview-worker-9', branch: 'main', providerId: ANTHROPIC_API_PROVIDER_ID, credentials, log: () => {} }), /not a sandbox of the pool or the experiments sandbox/);
});

test('the update script takes --name, --force and the branch, and refuses a name outside the pool', () => {
  assert.deepEqual(updateScript.parseArguments([]), { branch: 'codex/product-implementation-plan-20260904', names: [...SANDBOX_POOL], force: false });
  assert.deepEqual(updateScript.parseArguments(['main', '--name', 'pm-codex-preview-worker-2', '--force']), { branch: 'main', names: ['pm-codex-preview-worker-2'], force: true });
  assert.deepEqual(updateScript.parseArguments(['--branch', 'main']).branch, 'main');
  assert.deepEqual(updateScript.parseArguments(['--name', 'pm-codex-preview-worker-3']).names, ['pm-codex-preview-worker-3']);
  assert.throws(() => updateScript.parseArguments(['--name', 'pm-codex-preview-worker-4']), /--name must be a sandbox of the pool or the experiments sandbox/);
  assert.throws(() => updateScript.parseArguments(['bad branch']), /unexpected characters/);
  assert.throws(() => updateScript.parseArguments(['--other']), /unknown option/);
});

// A fake sandbox for the update script: the lock answer per name, the
// checkout a git repository, every command recorded.
function fakeUpdateApi({ busy = [], gone = [] } = {}) {
  const calls = { gets: [], commands: {} };
  return {
    calls,
    async get(params) {
      calls.gets.push(params.name);
      if (gone.includes(params.name)) throw apiError(400, 'Status code 400 is not ok: Cannot resume sandbox: no snapshot available');
      calls.commands[params.name] = calls.commands[params.name] || [];
      return {
        async runCommand({ cmd, args }) {
          const joined = `${cmd} ${args.join(' ')}`;
          calls.commands[params.name].push(joined);
          const out = /flock -n/.test(joined) ? (busy.includes(params.name) ? 'busy\n' : 'free\n')
            : /test -d/.test(joined) ? 'yes\n' : /rev-parse/.test(joined) ? 'abc1234\n' : /modules load/.test(joined) ? 'modules load\n' : '';
          return { exitCode: 0, async stdout() { return out; }, async stderr() { return ''; } };
        },
      };
    },
  };
}

test('the update script updates each free sandbox of the pool, skips one whose worker holds the launcher lock unless forced, and names the create command for a gone one', async () => {
  const api = fakeUpdateApi({ busy: ['pm-codex-preview-worker'] });
  const lines = [];
  const results = await updateScript.updateSandboxPool({ Sandbox: api, branch: 'main', credentials, log: (line) => lines.push(line) });
  assert.deepEqual(results, {
    'pm-codex-preview-worker': { updated: false, skipped: 'WORKER_RUNNING' },
    'pm-codex-preview-worker-2': { updated: true, before: 'abc1234', after: 'abc1234' },
  });
  assert.deepEqual(api.calls.gets, ['pm-codex-preview-worker', 'pm-codex-preview-worker-2']);
  const busyCommands = api.calls.commands['pm-codex-preview-worker'];
  assert.equal(busyCommands.length, 1, 'the lock check alone on the busy sandbox');
  assert.match(busyCommands[0], /flock -n \/vercel\/\.codex\/pm-worker\.lock true/);
  const freeCommands = api.calls.commands['pm-codex-preview-worker-2'];
  assert.ok(freeCommands.some((command) => command === 'git fetch --quiet origin main'));
  assert.ok(freeCommands.some((command) => command === 'git checkout --quiet -B main origin/main'));
  assert.ok(freeCommands.some((command) => command === 'npm ci --no-audit --no-fund --omit=dev'));
  const output = lines.join('\n');
  assert.match(output, /skipped pm-codex-preview-worker: a worker holds its launcher lock \(\/vercel\/\.codex\/pm-worker\.lock\); update it when its run is READY or FAILED, or pass --force/);
  assert.match(output, /done: pm-codex-preview-worker-2 now runs main at abc1234/);
  assert.doesNotMatch(output, /vercel-token-value/);
  // --force updates under the lock, and says so.
  const forced = fakeUpdateApi({ busy: ['pm-codex-preview-worker'] });
  const forcedLines = [];
  const forcedResult = await updateScript.updateSandboxWorker({ Sandbox: forced, name: 'pm-codex-preview-worker', branch: 'main', force: true, credentials, log: (line) => forcedLines.push(line) });
  assert.equal(forcedResult.updated, true);
  assert.ok(forced.calls.commands['pm-codex-preview-worker'].some((command) => /npm ci/.test(command)));
  assert.match(forcedLines.join('\n'), /updating pm-codex-preview-worker under a running worker \(--force\)/);
  // A gone sandbox: the line naming the create command for that name.
  const gone = fakeUpdateApi({ gone: ['pm-codex-preview-worker-2'] });
  await assert.rejects(updateScript.updateSandboxWorker({ Sandbox: gone, name: 'pm-codex-preview-worker-2', branch: 'main', credentials, log: () => {} }),
    /^Error: sandbox pm-codex-preview-worker-2 no longer resumes \(.*no snapshot available\); re-create it with node scripts\/product\/create-sandbox-worker\.js --provider <hosted provider id> --name pm-codex-preview-worker-2$/);
  await assert.rejects(updateScript.updateSandboxWorker({ Sandbox: gone, name: 'other', branch: 'main', credentials, log: () => {} }), /not a sandbox of the pool/);
});
