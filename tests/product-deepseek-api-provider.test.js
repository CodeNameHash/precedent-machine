'use strict';

// 2026-10-23. Ben: "you can build out a deepseek backend if you like - just
// get this working". DeepSeek publishes an Anthropic-compatible Messages
// endpoint (https://api.deepseek.com/anthropic). It is the same adapter
// under a model config that names the provider, the base URL and the key's
// environment variable: deepseek-v4-pro at high effort where the facts are
// written, deepseek-flash at low for routing and residual, every call
// metered at DeepSeek's published peak/off-peak rates. No network here.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PROVIDER_ID, DEEPSEEK_API_CALL_KIND_MODELS, DEEPSEEK_API_MODEL_CONFIG, DEEPSEEK_API_MODEL_CONFIGS, DEEPSEEK_API_PRICES,
  DEEPSEEK_API_PROVIDER_ID, anthropicApiCostMicrousd, anthropicApiModelConfigFor, assertConfiguredRunModelConfig, configuredProductModelConfig, hostedModelConfigFor, isHostedProvider,
  requestProfileFor, resolveAnthropicApiCallModel,
} = require('../lib/product/product-model-config');
const {
  clientOptions, createAnthropicApiProductModel, PROVIDER_ID,
} = require('../lib/product/anthropic-api-model');
const { createHostedProductModel } = require('../lib/product/claude-cli-model');
const { createProductRunHandler } = require('../lib/product/run-handler');
const { SANDBOX_LAUNCHER, wakeSandboxProductRun } = require('../lib/product/sandbox-wake');
const { receivedProviderFailure } = require('../lib/product/model-adapter');

const KEY = `sk-deepseek-test-${'k'.repeat(24)}`;
// A Friday 02:00 UTC and a Friday 20:00 UTC: DeepSeek's peak and off-peak
// schedules (01:00-04:00, 06:00-10:00 UTC on weekdays).
const PEAK = Date.UTC(2026, 9, 23, 2, 0);
const OFF_PEAK = Date.UTC(2026, 9, 23, 20, 0);

function message(text = '{"ok":true}', overrides = {}) {
  return {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'deepseek-v4-pro',
    content: [{ type: 'thinking', thinking: 'thinking', signature: 'sig' }, { type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    stop_reason: 'end_turn',
    ...overrides,
  };
}

function fakeClient(reply, seen = []) {
  return { messages: { stream(request) { seen.push(request); return { async finalMessage() { return typeof reply === 'function' ? reply(request) : reply; } }; } } };
}

test('the DeepSeek config: provider id, models and efforts, base URL, key env, deployed cap and DEFAULT profile', () => {
  assert.equal(DEEPSEEK_API_PROVIDER_ID, 'DEEPSEEK_API');
  assert.equal(DEEPSEEK_API_MODEL_CONFIG.provider_id, DEEPSEEK_API_PROVIDER_ID);
  assert.equal(DEEPSEEK_API_MODEL_CONFIG.model_id, 'PRODUCT_DEEPSEEK_API_CALL_KIND_MAP/V1');
  assert.equal(DEEPSEEK_API_MODEL_CONFIG.base_url, 'https://api.deepseek.com/anthropic');
  assert.equal(DEEPSEEK_API_MODEL_CONFIG.api_key_env, 'DEEPSEEK_API_KEY');
  assert.equal(DEEPSEEK_API_MODEL_CONFIG.max_output_tokens, 128000, 'the deployed Anthropic cap: operational, not identity');
  assert.equal(DEEPSEEK_API_MODEL_CONFIG.billing_basis, 'DEEPSEEK_API_METERED');
  assert.deepEqual(DEEPSEEK_API_CALL_KIND_MODELS, {
    ROUTING: { model: 'deepseek-flash', effort: 'low' },
    RESIDUAL: { model: 'deepseek-flash', effort: 'low' },
    EXTRACTION: { model: 'deepseek-v4-pro', effort: 'high' },
  });
  assert.equal(requestProfileFor(DEEPSEEK_API_MODEL_CONFIG).name, 'DEFAULT', 'the endpoint is Anthropic-shaped');
  assert.equal(isHostedProvider(DEEPSEEK_API_PROVIDER_ID), true);
  assert.deepEqual(DEEPSEEK_API_MODEL_CONFIGS, [DEEPSEEK_API_MODEL_CONFIG]);
  // The known-config identity is the config less the output cap, as for
  // the Anthropic API: a run created under a different cap advances here.
  assert.equal(anthropicApiModelConfigFor(DEEPSEEK_API_MODEL_CONFIG), DEEPSEEK_API_MODEL_CONFIG);
  assert.equal(anthropicApiModelConfigFor({ ...DEEPSEEK_API_MODEL_CONFIG, max_output_tokens: 64000 }), DEEPSEEK_API_MODEL_CONFIG);
  assert.equal(anthropicApiModelConfigFor({ ...DEEPSEEK_API_MODEL_CONFIG, base_url: 'https://example.test' }), null);
  assert.equal(anthropicApiModelConfigFor(ANTHROPIC_API_MODEL_CONFIG), ANTHROPIC_API_MODEL_CONFIG, 'the Anthropic config still resolves as its own');
  assert.deepEqual(resolveAnthropicApiCallModel(DEEPSEEK_API_MODEL_CONFIG, 'ROUTING'), { model: 'deepseek-flash', effort: 'low' });
  assert.deepEqual(resolveAnthropicApiCallModel(DEEPSEEK_API_MODEL_CONFIG, 'RESIDUAL'), { model: 'deepseek-flash', effort: 'low' });
  assert.deepEqual(resolveAnthropicApiCallModel(DEEPSEEK_API_MODEL_CONFIG, 'EXTRACTION'), { model: 'deepseek-v4-pro', effort: 'high' });
  assert.throws(() => resolveAnthropicApiCallModel(DEEPSEEK_API_MODEL_CONFIG, 'UNKNOWN'), /CALL_KIND/);
  // The run keeps its own config by identity on the route and the worker.
  assert.equal(hostedModelConfigFor(DEEPSEEK_API_PROVIDER_ID, null, {}), DEEPSEEK_API_MODEL_CONFIG);
  assert.equal(hostedModelConfigFor(DEEPSEEK_API_PROVIDER_ID, { model_config: { ...DEEPSEEK_API_MODEL_CONFIG, max_output_tokens: 64000 } }, {}), DEEPSEEK_API_MODEL_CONFIG);
  assert.equal(configuredProductModelConfig({ PRODUCT_MODEL_PROVIDER: DEEPSEEK_API_PROVIDER_ID }), DEEPSEEK_API_MODEL_CONFIG);
  assert.equal(hostedModelConfigFor(DEEPSEEK_API_PROVIDER_ID, { model_config: ANTHROPIC_API_MODEL_CONFIG }, {}), DEEPSEEK_API_MODEL_CONFIG, 'another provider\'s config is not a DeepSeek config');
  const run = { run_id: 'r', model_config: { ...DEEPSEEK_API_MODEL_CONFIG, max_output_tokens: 64000 } };
  const expected = hostedModelConfigFor(DEEPSEEK_API_PROVIDER_ID, run, {});
  assert.equal(expected, DEEPSEEK_API_MODEL_CONFIG, 'a run created under an earlier cap advances under this config');
  assert.doesNotThrow(() => assertConfiguredRunModelConfig(run, expected));
  assert.throws(() => assertConfiguredRunModelConfig(run, ANTHROPIC_API_MODEL_CONFIG), /PRODUCT_RUN_MODEL_CONFIG_MISMATCH/);
});

test('the DeepSeek prices are one constant with its source and date, and a call is priced at the schedule it ran under', () => {
  assert.equal(DEEPSEEK_API_PRICES.source, 'https://api-docs.deepseek.com/quick_start/pricing/');
  assert.match(DEEPSEEK_API_PRICES.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(DEEPSEEK_API_PRICES.usd_per_million['deepseek-flash'], {
    peak: { input: 0.3, cache_read: 0.006, output: 1.2 },
    off_peak: { input: 0.15, cache_read: 0.003, output: 0.6 },
  });
  assert.deepEqual(DEEPSEEK_API_PRICES.usd_per_million['deepseek-v4-pro'], {
    peak: { input: 1.32, cache_read: 0.044, output: 3.96 },
    off_peak: { input: 0.66, cache_read: 0.022, output: 1.98 },
  });
  // One million of each: cache-miss input, cache-hit input, output.
  assert.equal(anthropicApiCostMicrousd('deepseek-v4-pro', { input_tokens: 1000000, cache_read_input_tokens: 1000000, output_tokens: 1000000 }, { at: PEAK }), 5324000);
  assert.equal(anthropicApiCostMicrousd('deepseek-v4-pro', { input_tokens: 1000000, cache_read_input_tokens: 1000000, output_tokens: 1000000 }, { at: OFF_PEAK }), 2662000);
  assert.equal(anthropicApiCostMicrousd('deepseek-flash', { input_tokens: 1000000, cache_read_input_tokens: 1000000, output_tokens: 1000000 }, { at: PEAK }), 1506000);
  assert.equal(anthropicApiCostMicrousd('deepseek-flash', { input_tokens: 1000000, cache_read_input_tokens: 1000000, output_tokens: 1000000 }, { at: OFF_PEAK }), 753000);
  // A weekend hour is off-peak whatever the clock.
  assert.equal(anthropicApiCostMicrousd('deepseek-v4-pro', { input_tokens: 1000000 }, { at: Date.UTC(2026, 9, 24, 2, 0) }), 660000);
  // A cache write has no separate DeepSeek rate: it is an uncached input token.
  assert.equal(anthropicApiCostMicrousd('deepseek-v4-pro', { cache_creation_input_tokens: 1000000 }, { at: PEAK }), 1320000);
  // Not Anthropic's prices, which the same usage would cost far more at.
  assert.notEqual(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 1000000 }, { at: PEAK }), 1320000);
  assert.throws(() => anthropicApiCostMicrousd('deepseek-unknown', { input_tokens: 1 }), /RATES_UNKNOWN/);
});

test('the adapter sends each call kind to DeepSeek\'s endpoint with its own key, model, effort and the deployed cap', async () => {
  const built = [];
  const seen = [];
  const factory = (options) => { built.push(options); return fakeClient(message('{"proposals":[]}'), seen); };
  const model = createAnthropicApiProductModel({ apiKey: KEY, clientFactory: factory, modelConfig: DEEPSEEK_API_MODEL_CONFIG });
  const extraction = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V11', request: { instruction: 'Review', source_closure: { full_section: '5.02' } } });
  const routing = await model.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: { instruction: 'Route', section: { exact_text: 'x' } } });
  const residual = await model.complete({ call_kind: 'RESIDUAL', prompt_version: 'P1', request: { instruction: 'Residual', paragraphs: [] } });
  // One client, the Anthropic-compatible base URL and DeepSeek's key, and
  // no workspace header (that header is the Anthropic API's).
  assert.deepEqual(built, [{ apiKey: KEY, baseURL: 'https://api.deepseek.com/anthropic' }]);
  assert.deepEqual(seen.map((request) => [request.model, request.output_config.effort, request.max_tokens]), [
    ['deepseek-v4-pro', 'high', 128000],
    ['deepseek-flash', 'low', 128000],
    ['deepseek-flash', 'low', 128000],
  ]);
  assert.equal('temperature' in seen[0], false);
  assert.equal('thinking' in seen[0], false);
  assert.deepEqual(extraction.response, { proposals: [] });
  assert.equal(extraction.provider_id, DEEPSEEK_API_PROVIDER_ID);
  assert.equal(extraction.model_id, 'deepseek-v4-pro;effort=high');
  assert.equal(routing.provider_id, DEEPSEEK_API_PROVIDER_ID);
  assert.equal(routing.model_id, 'deepseek-flash;effort=low');
  assert.equal(residual.model_id, 'deepseek-flash;effort=low');
  assert.deepEqual(extraction.raw_request, seen[0], 'the stored request is the request as sent');
  // The cost is DeepSeek's, whichever schedule the call ran under.
  const usage = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const expected = [PEAK, OFF_PEAK].map((at) => anthropicApiCostMicrousd('deepseek-v4-pro', usage, { at }));
  assert.ok(expected.includes(extraction.cost_microusd), `${extraction.cost_microusd} in ${expected}`);
  assert.notEqual(extraction.cost_microusd, anthropicApiCostMicrousd('claude-opus-5', usage, { cacheTtl: '1h' }));
});

test('the key comes from DEEPSEEK_API_KEY when none is passed, and a missing key fails by its own name', async () => {
  const saved = process.env.DEEPSEEK_API_KEY;
  const built = [];
  const factory = (options) => { built.push(options); return fakeClient(message()); };
  process.env.DEEPSEEK_API_KEY = KEY;
  try {
    await createAnthropicApiProductModel({ clientFactory: factory, modelConfig: DEEPSEEK_API_MODEL_CONFIG }).complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} });
    assert.deepEqual(built[0], { apiKey: KEY, baseURL: 'https://api.deepseek.com/anthropic' });
    assert.equal(createHostedProductModel({ model_config: DEEPSEEK_API_MODEL_CONFIG }).complete instanceof Function, true, 'the worker builds the API adapter for a DeepSeek run');
  } finally {
    if (saved === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = saved;
  }
  const missing = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    assert.throws(() => createAnthropicApiProductModel({ modelConfig: DEEPSEEK_API_MODEL_CONFIG }), /DEEPSEEK_API_KEY is not configured/);
    assert.throws(() => createAnthropicApiProductModel({ apiKey: 'short', modelConfig: DEEPSEEK_API_MODEL_CONFIG }), /DEEPSEEK_API_KEY is not configured/);
  } finally {
    if (missing !== undefined) process.env.DEEPSEEK_API_KEY = missing;
  }
  // The Anthropic default is untouched: no base URL, its own key name.
  assert.deepEqual(clientOptions({ apiKey: KEY }), { apiKey: KEY });
  assert.deepEqual(clientOptions({ apiKey: KEY, baseUrl: 'https://api.deepseek.com/anthropic' }), { apiKey: KEY, baseURL: 'https://api.deepseek.com/anthropic' });
  assert.equal(PROVIDER_ID, ANTHROPIC_API_PROVIDER_ID);
});

test('a received DeepSeek failure keeps the DeepSeek provider and model', async () => {
  const model = createAnthropicApiProductModel({ apiKey: KEY, client: fakeClient(message('{"proposals":[', { stop_reason: 'max_tokens' })), modelConfig: DEEPSEEK_API_MODEL_CONFIG });
  await assert.rejects(model.complete({ call_kind: 'EXTRACTION', prompt_version: 'E1', request: {} }), (error) => {
    assert.match(error.message, /ANTHROPIC_API_OUTPUT_TRUNCATED/);
    const received = receivedProviderFailure(error);
    assert.equal(received.provider_id, DEEPSEEK_API_PROVIDER_ID);
    assert.equal(received.model_id, 'deepseek-v4-pro;effort=high');
    assert.equal(received.provider_completion_confirmed, false);
    return true;
  });
});

test('the wake carries DEEPSEEK_API_KEY into the sandbox for a DeepSeek run only, and never into its result', async () => {
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
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: DEEPSEEK_API_PROVIDER_ID }), /PRODUCT_SANDBOX_DEEPSEEK_API_KEY_REQUIRED/);
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: DEEPSEEK_API_PROVIDER_ID, deepseekApiKey: 'short' }), /PRODUCT_SANDBOX_DEEPSEEK_API_KEY_REQUIRED/);
  const result = await wakeSandboxProductRun({ ...base, providerId: DEEPSEEK_API_PROVIDER_ID, deepseekApiKey: KEY, anthropicApiKey: 'sk-ant-'.repeat(6), anthropicWorkspaceId: 'wrkspc_never' });
  assert.equal(commandInput.cmd, SANDBOX_LAUNCHER);
  assert.deepEqual(commandInput.env, {
    SUPABASE_URL: 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value',
    PRODUCT_MODEL_PROVIDER: DEEPSEEK_API_PROVIDER_ID,
    PRODUCT_SANDBOX_NAME: 'pm-codex-preview-worker',
    DEEPSEEK_API_KEY: KEY,
  }, 'only DeepSeek\'s key, no Anthropic key or workspace id');
  assert.doesNotMatch(JSON.stringify(result), /sk-deepseek|wrkspc_/);
});

test('the run route wakes a DeepSeek run with the deployment\'s DEEPSEEK_API_KEY, whatever the environment default', async () => {
  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  let wakeInput;
  const store = {
    assertAccess: async () => {},
    getRun: async () => ({ run_id: runId, model_config: DEEPSEEK_API_MODEL_CONFIG }),
    getAgreementAnalysis: async () => ({ status: 'RUNNING' }),
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben',
    modelConfigResolver: () => ANTHROPIC_API_MODEL_CONFIG,
    modelFactory: () => assert.fail('no in-process model for a hosted run'),
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    claudeOauthTokenResolver: () => assert.fail('no OAuth token for an API run'),
    anthropicApiKeyResolver: () => assert.fail('no Anthropic key for a DeepSeek run'),
    anthropicWorkspaceIdResolver: () => assert.fail('no workspace id for a DeepSeek run'),
    deepseekApiKeyResolver: () => KEY,
    wakeRun: async (input) => { wakeInput = input; return { command_id: 'command-1' }; },
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.deepEqual(wakeInput, {
    runId, databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value',
    providerId: DEEPSEEK_API_PROVIDER_ID, deepseekApiKey: KEY,
    sandboxName: 'pm-codex-preview-worker',
  });
  assert.equal(response.body.execution_mode, 'HOSTED');
});

test('the launcher requires DEEPSEEK_API_KEY for a DeepSeek run and withholds it from other providers', () => {
  const launch = fs.readFileSync(path.join(__dirname, '../infra/codex-sandbox-worker/launch.sh'), 'utf8');
  assert.match(launch, /DEEPSEEK_API\)/);
  assert.match(launch, /PRODUCT_HOSTED_DEEPSEEK_API_KEY_REQUIRED/);
  assert.match(launch, /if \[\[ "\$\{PRODUCT_MODEL_PROVIDER:-\}" != 'DEEPSEEK_API' \]\]; then\n  unset DEEPSEEK_API_KEY/);
});
