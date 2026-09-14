'use strict';

// Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The Claude
// Code CLI on a subscription login is a hosted provider beside the Codex
// one: same run identity rules, per-call-kind model and effort, one JSON
// object per call, no tools, no settings, no session on disk.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CLAUDE_CLI_CALL_KIND_MODELS, CLAUDE_CLI_MODEL_CONFIG, CLAUDE_CLI_PROVIDER_ID, CODEX_MODEL_CONFIG, CODEX_PROVIDER_ID,
  configuredProductModelConfig, hostedModelConfigFor, isHostedProvider, resolveClaudeCliCallModel,
} = require('../lib/product/product-model-config');
const { createClaudeCliProductModel, createHostedProductModel, SYSTEM_PROMPT, unfenced } = require('../lib/product/claude-cli-model');
const { receivedProviderFailure } = require('../lib/product/model-adapter');
const {
  buildClaudeExecArgs, claudeChildEnv, claudeJsonResult, createClaudeCliProductClient, isUsageLimitError,
} = require('../lib/llm-cli-client');
const { wakeSandboxProductRun, SANDBOX_LAUNCHER } = require('../lib/product/sandbox-wake');
const { createProductRunHandler } = require('../lib/product/run-handler');

function completed(text = '{"ok":true}') {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 2, output_tokens: 3, cache_read_input_tokens: 4, cache_creation_input_tokens: 6 },
    claude_completion: { status: 'COMPLETE', subtype: 'success', stop_reason: 'end_turn' },
    total_cost_usd: 0.01,
  };
}

test('the Claude CLI provider is a hosted provider with a frozen call-kind map', () => {
  assert.deepEqual(CLAUDE_CLI_CALL_KIND_MODELS, {
    ROUTING: { model: 'claude-opus-5', effort: 'low' },
    RESIDUAL: { model: 'claude-opus-5', effort: 'low' },
    EXTRACTION: { model: 'claude-opus-5', effort: 'high' },
  });
  assert.equal(configuredProductModelConfig({ PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID }), CLAUDE_CLI_MODEL_CONFIG);
  assert.equal(isHostedProvider(CLAUDE_CLI_PROVIDER_ID), true);
  assert.equal(isHostedProvider(CODEX_PROVIDER_ID), true);
  assert.equal(isHostedProvider('ANTHROPIC'), false);
  assert.equal(hostedModelConfigFor(CLAUDE_CLI_PROVIDER_ID), CLAUDE_CLI_MODEL_CONFIG);
  assert.equal(hostedModelConfigFor(CODEX_PROVIDER_ID), CODEX_MODEL_CONFIG);
  assert.throws(() => resolveClaudeCliCallModel(CLAUDE_CLI_MODEL_CONFIG, 'UNKNOWN'), /CALL_KIND/);
  assert.throws(() => resolveClaudeCliCallModel(CODEX_MODEL_CONFIG, 'ROUTING'), /CLAUDE_CLI_MODEL_CONFIG_UNSUPPORTED/);
  assert.equal(CLAUDE_CLI_MODEL_CONFIG.marginal_api_cost_microusd, 0);
});

test('the CLI is invoked without tools, settings or a saved session, on the subscription token only', () => {
  assert.deepEqual(buildClaudeExecArgs({ model: 'claude-opus-5', effort: 'high', systemPrompt: 'JSON only' }), [
    '-p', '--output-format', 'json', '--model', 'claude-opus-5', '--effort', 'high',
    '--no-session-persistence', '--tools', '', '--setting-sources', '', '--strict-mcp-config',
    '--permission-mode', 'dontAsk', '--system-prompt', 'JSON only',
  ]);
  assert.throws(() => buildClaudeExecArgs({ model: 'claude-opus-5', effort: 'extreme' }), /effort/);
  assert.throws(() => buildClaudeExecArgs({ model: 'claude opus' }), /model/);
  const env = claudeChildEnv({ PATH: '/bin', HOME: '/home/x', ANTHROPIC_API_KEY: 'sk-secret', OPENAI_API_KEY: 'k', CLAUDE_CODE_OAUTH_TOKEN: 't'.repeat(40), SUPABASE_SERVICE_ROLE_KEY: 's' });
  assert.deepEqual(Object.keys(env).sort(), ['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'CLAUDE_CODE_OAUTH_TOKEN', 'DISABLE_AUTOUPDATER', 'HOME', 'PATH']);
  assert.throws(() => createClaudeCliProductClient({ model: 'claude-opus-5', effort: 'low', env: { PATH: '/bin' } }), /CLAUDE_CLI_LOGIN_REQUIRED/);
  const client = createClaudeCliProductClient({ model: 'claude-opus-5', effort: 'low', env: { PATH: '/bin', CLAUDE_CODE_OAUTH_TOKEN: 't'.repeat(40) } });
  assert.equal(client.backend, 'claude-cli-product');
});

test('the CLI result object is the one accepted shape', () => {
  const raw = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '```json\n{"ok":true}\n```', usage: { input_tokens: 1, output_tokens: 1 } });
  assert.equal(claudeJsonResult(raw).subtype, 'success');
  assert.throws(() => claudeJsonResult('not json'), /CLAUDE_CLI_JSON/);
  assert.throws(() => claudeJsonResult('{"type":"assistant"}'), /CLAUDE_CLI_JSON/);
  assert.equal(unfenced('```json\n{"ok":true}\n```'), '{"ok":true}');
  assert.equal(isUsageLimitError(new Error("claude -p error: You've hit your usage limit")), true);
});

test('the product model selects model and effort per call kind and records the CLI usage', async () => {
  const creations = [];
  const requests = [];
  const model = createClaudeCliProductModel({
    clientFactory(options) {
      creations.push(options);
      return { messages: { create: async (request) => { requests.push(request); return completed('```json\n{"families":[]}\n```'); } } };
    },
  });
  const routing = await model.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: { a: 1 } });
  const residual = await model.complete({ call_kind: 'RESIDUAL', prompt_version: 'R1', request: {} });
  const extraction = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'E1', request: {} });
  assert.deepEqual(creations.map(({ model: m, effort, timeoutMs, systemPrompt }) => [m, effort, timeoutMs, systemPrompt]), [
    ['claude-opus-5', 'low', undefined, SYSTEM_PROMPT],
    ['claude-opus-5', 'high', 30 * 60 * 1000, SYSTEM_PROMPT],
  ]);
  assert.equal(routing.provider_id, CLAUDE_CLI_PROVIDER_ID);
  assert.equal(routing.model_id, 'claude-opus-5;effort=low');
  assert.equal(residual.model_id, 'claude-opus-5;effort=low');
  assert.equal(extraction.model_id, 'claude-opus-5;effort=high');
  assert.deepEqual(routing.response, { families: [] });
  assert.equal(routing.input_tokens, 12);
  assert.equal(routing.output_tokens, 3);
  assert.equal(routing.cost_microusd, 0);
  assert.equal(routing.provider_completion_confirmed, true);
  assert.equal(JSON.parse(requests[0].messages[0].content).call_kind, 'ROUTING');
  assert.equal(requests[0].billing_basis, 'CLAUDE_SUBSCRIPTION_ZERO_MARGINAL_API_COST');
});

test('a non-JSON or incomplete answer fails with the received output attached', async () => {
  const model = createClaudeCliProductModel({ client: { messages: { create: async () => completed('I could not decide.') } } });
  await assert.rejects(model.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} }), (error) => {
    assert.match(error.message, /CLAUDE_PRODUCT_JSON/);
    const received = receivedProviderFailure(error);
    assert.equal(received.provider_completion_confirmed, true);
    assert.equal(received.input_tokens, 12);
    return true;
  });
  const incomplete = createClaudeCliProductModel({ client: { messages: { create: async () => ({ ...completed(), claude_completion: { status: 'COMPLETE', subtype: 'error_max_turns' } }) } } });
  await assert.rejects(incomplete.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} }), /CLAUDE_PRODUCT_COMPLETION/);
});

test('the hosted model factory follows the run record\'s provider', () => {
  assert.ok(createHostedProductModel({ model_config: CLAUDE_CLI_MODEL_CONFIG }));
  assert.ok(createHostedProductModel({ model_config: CODEX_MODEL_CONFIG }));
});

test('the sandbox wake carries the provider and, for Claude, the subscription token', async () => {
  let commandInput;
  const sandboxApi = { async get() {
    return {
      currentSession: () => ({ createdAt: new Date(), timeout: 5 * 60 * 60 * 1000 }),
      async extendTimeout() {},
      async runCommand(command) {
        commandInput = command;
        return { cmdId: 'c', async wait({ signal }) { return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); } };
      },
    };
  } };
  const base = { runId: '46c45080-6935-49e5-96ae-b6cb0609a924', databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value', sandboxApi };
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: CLAUDE_CLI_PROVIDER_ID }), /PRODUCT_SANDBOX_CLAUDE_TOKEN_REQUIRED/);
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: 'ANTHROPIC' }), /PRODUCT_SANDBOX_PROVIDER_MISMATCH/);
  const result = await wakeSandboxProductRun({ ...base, providerId: CLAUDE_CLI_PROVIDER_ID, claudeOauthToken: 'oauth-'.repeat(8) });
  assert.equal(commandInput.cmd, SANDBOX_LAUNCHER);
  assert.deepEqual(commandInput.env, {
    SUPABASE_URL: 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value',
    PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID,
    CLAUDE_CODE_OAUTH_TOKEN: 'oauth-'.repeat(8),
  });
  assert.doesNotMatch(JSON.stringify(result), /oauth-/);
});

test('the run route wakes the sandbox for a Claude CLI run with the deployment\'s token', async () => {
  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  let wakeInput;
  const store = {
    assertAccess: async () => {},
    getRun: async () => ({ run_id: runId, model_config: CLAUDE_CLI_MODEL_CONFIG }),
    getAgreementAnalysis: async () => ({ status: 'RUNNING' }),
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben',
    modelConfigResolver: () => CLAUDE_CLI_MODEL_CONFIG,
    modelFactory: () => assert.fail('no in-process model for a hosted run'),
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    claudeOauthTokenResolver: () => 'oauth-'.repeat(8),
    wakeRun: async (input) => { wakeInput = input; return { command_id: 'command-1' }; },
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.deepEqual(wakeInput, {
    runId, databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value',
    providerId: CLAUDE_CLI_PROVIDER_ID, claudeOauthToken: 'oauth-'.repeat(8),
  });
  assert.equal(response.body.execution_mode, 'HOSTED');
});
