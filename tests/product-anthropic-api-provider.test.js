'use strict';

// Work package 3 (plan findings (44) and (45)). Ben, 2026-10-17: "also you
// now have $200 of API tokens you can use if you want to preseve
// subscription capcaity" and "done on the key, will be live on your next
// redploy". The Anthropic API is a hosted provider beside the Claude CLI
// path: the same model tier and effort per call kind, the same output cap,
// the key from the deployment and never from the repository, every call
// metered at the published rates, an account limit stopping the worker.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ANTHROPIC_API_CALL_KIND_MODELS, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PRICES, ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_CALL_KIND_MODELS,
  CLAUDE_CLI_MODEL_CONFIG, anthropicApiCostMicrousd, configuredProductModelConfig, hostedModelConfigFor, isHostedProvider, resolveAnthropicApiCallModel,
} = require('../lib/product/product-model-config');
const { createProductIntakeHandler } = require('../lib/product/intake-handler');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { estimateRunCost, parseArguments } = require('../scripts/product/estimate-run-cost');
const { createAnthropicApiProductModel, isAccountLimit } = require('../lib/product/anthropic-api-model');
const { createHostedProductModel, SYSTEM_PROMPT } = require('../lib/product/claude-cli-model');
const { receivedProviderFailure } = require('../lib/product/model-adapter');
const { isUsageLimitError } = require('../lib/llm-cli-client');
const { wakeSandboxProductRun, SANDBOX_LAUNCHER } = require('../lib/product/sandbox-wake');
const { createProductRunHandler } = require('../lib/product/run-handler');

function message(text = '{"ok":true}', overrides = {}) {
  return {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5',
    content: [{ type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 300, cache_read_input_tokens: 4000 },
    stop_reason: 'end_turn',
    ...overrides,
  };
}

function fakeClient(reply, seen = []) {
  return { messages: { stream(request) { seen.push(request); return { async finalMessage() { return typeof reply === 'function' ? reply(request) : reply; } }; } } };
}

test('the API provider is a hosted provider at the Claude CLI tier, metered at the published rates', () => {
  assert.equal(ANTHROPIC_API_CALL_KIND_MODELS, CLAUDE_CLI_CALL_KIND_MODELS);
  assert.equal(ANTHROPIC_API_MODEL_CONFIG.max_output_tokens, 64000, 'a 60,000-token extraction completes');
  assert.equal('rates_usd_per_million' in ANTHROPIC_API_MODEL_CONFIG, false, 'prices live in one constant, not in the stored run config');
  assert.equal(ANTHROPIC_API_PRICES.source, 'https://platform.claude.com/docs/en/about-claude/pricing');
  assert.match(ANTHROPIC_API_PRICES.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(ANTHROPIC_API_PRICES.usd_per_million['claude-opus-5'], { input: 5, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5, output: 25 });
  assert.equal(ANTHROPIC_API_MODEL_CONFIG.billing_basis, 'ANTHROPIC_API_METERED');
  assert.equal(isHostedProvider(ANTHROPIC_API_PROVIDER_ID), true);
  assert.equal(isHostedProvider('ANTHROPIC'), false, 'the in-request Sonnet provider stays where it is');
  assert.equal(hostedModelConfigFor(ANTHROPIC_API_PROVIDER_ID), ANTHROPIC_API_MODEL_CONFIG);
  assert.equal(configuredProductModelConfig({ PRODUCT_MODEL_PROVIDER: ANTHROPIC_API_PROVIDER_ID }), ANTHROPIC_API_MODEL_CONFIG);
  assert.deepEqual(resolveAnthropicApiCallModel(ANTHROPIC_API_MODEL_CONFIG, 'EXTRACTION'), { model: 'claude-opus-5', effort: 'high' });
  assert.throws(() => resolveAnthropicApiCallModel(ANTHROPIC_API_MODEL_CONFIG, 'UNKNOWN'), /CALL_KIND/);
  assert.throws(() => resolveAnthropicApiCallModel({ ...ANTHROPIC_API_MODEL_CONFIG, max_output_tokens: 1 }, 'ROUTING'), /ANTHROPIC_API_MODEL_CONFIG_UNSUPPORTED/);
  // One million of each kind: $5 fresh input, $6.25 cache write, $0.50 cache read, $25 output.
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 1000000, cache_creation_input_tokens: 1000000, cache_read_input_tokens: 1000000, output_tokens: 1000000 }), 36750000);
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 1000, output_tokens: 200 }), 10000);
  assert.throws(() => anthropicApiCostMicrousd('claude-unknown', { input_tokens: 1 }), /RATES_UNKNOWN/);
});

test('a call streams one compact-JSON request at the call kind\'s effort under the output cap, and records the whole prompt and its cost', async () => {
  const seen = [];
  const model = createAnthropicApiProductModel({ client: fakeClient(message('```json\n{"proposals":[]}\n```'), seen) });
  const result = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V9', request: { section: '5.02' } });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], {
    model: 'claude-opus-5', max_tokens: 64000, output_config: { effort: 'high' }, system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify({ call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V9', section: '5.02' }) }],
  });
  assert.equal('temperature' in seen[0], false, 'no sampling parameter: the model refuses them');
  assert.equal('thinking' in seen[0], false, 'adaptive thinking is the model\'s default');
  assert.equal(result.provider_id, ANTHROPIC_API_PROVIDER_ID);
  assert.equal(result.model_id, 'claude-opus-5;effort=high');
  assert.deepEqual(result.response, { proposals: [] });
  assert.equal(result.input_tokens, 5300, 'fresh, cache-written and cache-read tokens together, as the CLI path counts');
  assert.equal(result.output_tokens, 200);
  assert.equal(result.cost_microusd, 1000 * 5 + 300 * 6.25 + 4000 * 0.5 + 200 * 25);
  assert.equal(result.provider_completion_confirmed, true);
  const routing = await createAnthropicApiProductModel({ client: fakeClient(message(), seen) }).complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} });
  assert.deepEqual(seen[1].output_config, { effort: 'low' });
  assert.equal(routing.model_id, 'claude-opus-5;effort=low');
});

test('an answer cut off by the output cap, a refusal and a non-JSON answer fail with the received output kept', async () => {
  const truncated = createAnthropicApiProductModel({ client: fakeClient(message('{"proposals":[', { stop_reason: 'max_tokens' })) });
  await assert.rejects(truncated.complete({ call_kind: 'EXTRACTION', prompt_version: 'E1', request: {} }), (error) => {
    assert.match(error.message, /ANTHROPIC_API_OUTPUT_TRUNCATED/);
    const received = receivedProviderFailure(error);
    assert.ok(received, 'the received output rides with the failure');
    assert.equal(received.provider_completion_confirmed, false);
    assert.equal(received.input_tokens, 5300);
    assert.equal(received.cost_microusd, 1000 * 5 + 300 * 6.25 + 4000 * 0.5 + 200 * 25);
    return true;
  });
  const refused = createAnthropicApiProductModel({ client: fakeClient(message('', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } })) });
  await assert.rejects(refused.complete({ call_kind: 'EXTRACTION', prompt_version: 'E1', request: {} }), /ANTHROPIC_API_REFUSAL: the model declined \(cyber\)/);
  const prose = createAnthropicApiProductModel({ client: fakeClient(message('Here is the answer: {"a":1}')) });
  await assert.rejects(prose.complete({ call_kind: 'EXTRACTION', prompt_version: 'E1', request: {} }), /ANTHROPIC_API_JSON/);
});

test('a 429 or an exhausted credit balance is the account\'s limit, which stops the worker; any other error passes through', async () => {
  const rateLimited = Object.assign(new Error('429 rate_limit_error: Number of request tokens has exceeded your per-minute rate limit'), { status: 429 });
  const model = createAnthropicApiProductModel({ client: fakeClient(() => { throw rateLimited; }) });
  await assert.rejects(model.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} }), (error) => {
    assert.match(error.message, /ANTHROPIC_API_USAGE_LIMIT: usage limit on the API account \(429\)/);
    assert.ok(isUsageLimitError(error), 'the worker\'s usage-limit rule matches it');
    assert.equal(error.cause, rateLimited);
    return true;
  });
  const noCredit = Object.assign(new Error('400 Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'), { status: 400 });
  assert.equal(isAccountLimit(noCredit), true);
  assert.equal(isAccountLimit(Object.assign(new Error('400 invalid_request_error: max_tokens'), { status: 400 })), false);
  const broken = Object.assign(new Error('500 internal server error'), { status: 500 });
  const failing = createAnthropicApiProductModel({ client: fakeClient(() => { throw broken; }) });
  await assert.rejects(failing.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} }), (error) => error === broken);
});

test('the key is required unless a client is supplied, and a hosted run on the API provider builds this model', () => {
  assert.throws(() => createAnthropicApiProductModel({ apiKey: undefined, client: null }), /ANTHROPIC_API_KEY is not configured/);
  assert.throws(() => createAnthropicApiProductModel({ apiKey: 'short', client: null }), /ANTHROPIC_API_KEY is not configured/);
  assert.throws(() => createAnthropicApiProductModel({ client: { messages: { create() {} } } }), /stream\(\)/);
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-'.repeat(3);
  try {
    const hosted = createHostedProductModel({ model_config: ANTHROPIC_API_MODEL_CONFIG });
    assert.equal(typeof hosted.complete, 'function');
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('the wake carries the API key into the sandbox for the API provider only, and never into its result', async () => {
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
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID }), /PRODUCT_SANDBOX_ANTHROPIC_API_KEY_REQUIRED/);
  await assert.rejects(wakeSandboxProductRun({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'short' }), /PRODUCT_SANDBOX_ANTHROPIC_API_KEY_REQUIRED/);
  const result = await wakeSandboxProductRun({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6) });
  assert.equal(commandInput.cmd, SANDBOX_LAUNCHER);
  assert.deepEqual(commandInput.env, {
    SUPABASE_URL: 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value',
    PRODUCT_MODEL_PROVIDER: ANTHROPIC_API_PROVIDER_ID,
    ANTHROPIC_API_KEY: 'sk-ant-'.repeat(6),
  });
  assert.doesNotMatch(JSON.stringify(result), /sk-ant-/);
});

test('the run route wakes the sandbox for an API run with the deployment\'s key', async () => {
  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  let wakeInput;
  const store = {
    assertAccess: async () => {},
    getRun: async () => ({ run_id: runId, model_config: ANTHROPIC_API_MODEL_CONFIG }),
    getAgreementAnalysis: async () => ({ status: 'RUNNING' }),
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben',
    modelConfigResolver: () => ANTHROPIC_API_MODEL_CONFIG,
    modelFactory: () => assert.fail('no in-process model for a hosted run'),
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    claudeOauthTokenResolver: () => assert.fail('the OAuth token is not read for an API run'),
    anthropicApiKeyResolver: () => 'sk-ant-'.repeat(6),
    wakeRun: async (input) => { wakeInput = input; return { command_id: 'command-1' }; },
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.deepEqual(wakeInput, {
    runId, databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value',
    providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6),
  });
  assert.equal(response.body.execution_mode, 'HOSTED');
});

test('the intake takes an explicit hosted provider for one run and refuses anything else; the environment default stays', async () => {
  const submitted = [];
  const handler = (resolver) => createProductIntakeHandler({
    getClient: () => ({}), intakeFactory: () => ({ intake() {} }), storeFactory: () => ({}),
    modelConfigResolver: resolver,
    foundationFactory: () => ({ submit: async (input) => { submitted.push(input); return { run_id: 'run-1', source_document_id: 's', source_generation: 8, status: 'QUEUED', stage: 'SECTION_ANALYSIS' }; } }),
  });
  const recorder = () => ({ statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const body = { url: 'https://www.sec.gov/Archives/edgar/data/1/0001/x.htm', idempotencyKey: 'k-1', explicitGeneration: 8 };
  const chosen = recorder();
  await handler(() => CLAUDE_CLI_MODEL_CONFIG)({ method: 'POST', body: { ...body, provider: ANTHROPIC_API_PROVIDER_ID } }, chosen);
  assert.equal(chosen.statusCode, 202);
  assert.equal(submitted[0].modelConfig, ANTHROPIC_API_MODEL_CONFIG);
  assert.equal('provider' in submitted[0], false, 'the field is consumed here, not passed to the foundation');
  const defaulted = recorder();
  await handler(() => CLAUDE_CLI_MODEL_CONFIG)({ method: 'POST', body }, defaulted);
  assert.equal(submitted[1].modelConfig, CLAUDE_CLI_MODEL_CONFIG);
  for (const bad of ['ANTHROPIC', 'SOMETHING_ELSE', 7]) {
    const refused = recorder();
    await handler(() => CLAUDE_CLI_MODEL_CONFIG)({ method: 'POST', body: { ...body, provider: bad } }, refused);
    assert.equal(refused.statusCode, 400, `${bad} is not a hosted provider`);
  }
  assert.equal(submitted.length, 2);
});

test('the run route drives a run on the provider its own model_config names, whatever the environment default', async () => {
  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  let wakeInput;
  const store = {
    assertAccess: async () => {},
    getRun: async () => ({ run_id: runId, model_config: ANTHROPIC_API_MODEL_CONFIG }),
    getAgreementAnalysis: async () => ({ status: 'RUNNING' }),
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben',
    modelConfigResolver: () => CLAUDE_CLI_MODEL_CONFIG,
    modelFactory: () => assert.fail('no in-process model for a hosted run'),
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    claudeOauthTokenResolver: () => assert.fail('the OAuth token is not read for an API run'),
    anthropicApiKeyResolver: () => 'sk-ant-'.repeat(6),
    wakeRun: async (input) => { wakeInput = input; return { command_id: 'command-1' }; },
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(wakeInput.providerId, ANTHROPIC_API_PROVIDER_ID);
  assert.equal(typeof wakeInput.anthropicApiKey, 'string');
});

test('the analysis read names the run\'s provider', async () => {
  const runId = '46c45080-6935-49e5-96ae-b6cb0609a924';
  const handler = createProductAnalysisHandler({
    getClient: () => ({}),
    storeFactory: () => ({ getAgreementAnalysis: async () => ({ status: 'RUNNING' }), getRun: async () => ({ run_id: runId, model_config: ANTHROPIC_API_MODEL_CONFIG }) }),
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: runId } }, response);
  assert.deepEqual(response.body, { status: 'RUNNING', model_provider: ANTHROPIC_API_PROVIDER_ID });
});

// The estimate from generation 7's recorded tokens at the published rates.
test('the estimate script prices generation 7\'s tokens at the price table, with and without cache reads', () => {
  const estimate = estimateRunCost({ inputTokens: 9853912, outputTokens: 3146447 });
  assert.equal(estimate.input_usd, 49.27);
  assert.equal(estimate.output_usd, 78.66);
  assert.equal(estimate.total_usd, 127.93);
  assert.equal(estimate.price_source, ANTHROPIC_API_PRICES.source);
  assert.equal(estimate.price_date, ANTHROPIC_API_PRICES.retrieved);
  const cached = estimateRunCost({ inputTokens: 9853912, outputTokens: 3146447, cacheReadShare: 2 / 3 });
  assert.ok(cached.total_usd < estimate.total_usd && cached.total_usd > 90, String(cached.total_usd));
  assert.equal(estimateRunCost({ inputTokens: 9853912, outputTokens: 3146447, modelId: 'claude-opus-5-5' }).total_usd, 102.34);
  assert.deepEqual(parseArguments(['9,853,912', '3,146,447']), { modelId: 'claude-opus-5', cacheReadShare: 0, inputTokens: 9853912, outputTokens: 3146447 });
  assert.deepEqual(parseArguments(['--run', '46c45080-6935-49e5-96ae-b6cb0609a924', '--model', 'claude-opus-5-5']), { modelId: 'claude-opus-5-5', cacheReadShare: 0, runId: '46c45080-6935-49e5-96ae-b6cb0609a924' });
  assert.throws(() => estimateRunCost({ inputTokens: 1, outputTokens: 1, modelId: 'claude-unknown' }), /no published rates/);
  assert.throws(() => parseArguments(['1']), /usage/);
});
