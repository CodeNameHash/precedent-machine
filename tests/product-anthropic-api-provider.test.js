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
  ANTHROPIC_API_CACHE_TTL, ANTHROPIC_API_CALL_KIND_MODELS, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PRICES, ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_CALL_KIND_MODELS,
  CLAUDE_CLI_MODEL_CONFIG, anthropicApiCostMicrousd, configuredProductModelConfig, hostedModelConfigFor, isHostedProvider, resolveAnthropicApiCallModel,
} = require('../lib/product/product-model-config');
const { createProductIntakeHandler } = require('../lib/product/intake-handler');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { estimateFromSplit, estimateRunCost, parseArguments, usageSplit } = require('../scripts/product/estimate-run-cost');
const { PER_SECTION_KEYS, REQUEST_LAYOUT_NOTE, cacheableContent, clientOptions, createAnthropicApiProductModel, isAccountLimit, isNotConfiguredError, isWorkspaceScopeError, splitRequestForCache } = require('../lib/product/anthropic-api-model');
const { createHostedProductModel, SYSTEM_PROMPT } = require('../lib/product/claude-cli-model');
const { receivedProviderFailure } = require('../lib/product/model-adapter');
const { isUsageLimitError } = require('../lib/llm-cli-client');
const { wakeSandboxProductRun, SANDBOX_LAUNCHER } = require('../lib/product/sandbox-wake');
const { createProductRunHandler } = require('../lib/product/run-handler');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { substantiveSections } = require('../lib/product/source-context');
const tableShapes = require('../contracts/product/table-shapes.v3.json');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { conchoSource } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

function message(text = '{"ok":true}', overrides = {}) {
  return {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5',
    content: [{ type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 300, cache_read_input_tokens: 4000, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 300 } },
    stop_reason: 'end_turn',
    ...overrides,
  };
}

function fakeClient(reply, seen = []) {
  return { messages: { stream(request) { seen.push(request); return { async finalMessage() { return typeof reply === 'function' ? reply(request) : reply; } }; } } };
}

test('the API provider is a hosted provider at the Claude CLI tier, metered at the published rates', () => {
  assert.equal(ANTHROPIC_API_CALL_KIND_MODELS, CLAUDE_CLI_CALL_KIND_MODELS);
  // Work package 15 (plan finding (83)): the documented maximum of the synchronous Messages API for claude-opus-5 ("Max output: 128K tokens", read 2026-10-18).
  assert.equal(ANTHROPIC_API_MODEL_CONFIG.max_output_tokens, 128000, 'the documented maximum output');
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
  // One million of each kind: $5 fresh input, $6.25 5-minute cache write, $0.50 cache read, $25 output.
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 1000000, cache_creation_input_tokens: 1000000, cache_read_input_tokens: 1000000, output_tokens: 1000000 }), 36750000);
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 1000, output_tokens: 200 }), 10000);
  assert.throws(() => anthropicApiCostMicrousd('claude-unknown', { input_tokens: 1 }), /RATES_UNKNOWN/);
  // Work package 10: writes priced at their lifetime. The message's own
  // breakdown first; without one, the lifetime the request asked for.
  assert.equal(ANTHROPIC_API_CACHE_TTL, '1h');
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 0, cache_creation_input_tokens: 1000000 }, { cacheTtl: '1h' }), 10000000);
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 0, cache_creation_input_tokens: 1000000 }), 6250000, '5 minutes when nothing says otherwise');
  assert.equal(anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 0, cache_creation_input_tokens: 300, cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 } }, { cacheTtl: '1h' }), Math.round(100 * 6.25 + 200 * 10));
  assert.throws(() => anthropicApiCostMicrousd('claude-opus-5', { input_tokens: 1 }, { cacheTtl: '2h' }), /CACHE_TTL_UNKNOWN/);
});

test('a call streams one compact-JSON request at the call kind\'s effort under the output cap, in two blocks with the cache breakpoint on the stable one, and records the whole prompt and its cost', async () => {
  const seen = [];
  const model = createAnthropicApiProductModel({ client: fakeClient(message('```json\n{"proposals":[]}\n```'), seen) });
  const request = { instruction: 'Review', family_contracts: [{ family_key: 'NO_SHOP' }], source_closure: { full_section: '5.02' }, part_instruction: 'part 1 of 2' };
  const result = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V9', request });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], {
    model: 'claude-opus-5', max_tokens: 128000, output_config: { effort: 'high' }, system: `${SYSTEM_PROMPT} ${REQUEST_LAYOUT_NOTE}`,
    messages: [{ role: 'user', content: [
      { type: 'text', text: JSON.stringify({ call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V9', instruction: 'Review', family_contracts: [{ family_key: 'NO_SHOP' }] }), cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: JSON.stringify({ source_closure: { full_section: '5.02' }, part_instruction: 'part 1 of 2' }) },
    ] }],
  });
  assert.equal('temperature' in seen[0], false, 'no sampling parameter: the model refuses them');
  assert.equal('thinking' in seen[0], false, 'adaptive thinking is the model\'s default');
  assert.equal(result.provider_id, ANTHROPIC_API_PROVIDER_ID);
  assert.equal(result.model_id, 'claude-opus-5;effort=high');
  assert.deepEqual(result.response, { proposals: [] });
  assert.equal(result.input_tokens, 5300, 'fresh, cache-written and cache-read tokens together, as the CLI path counts');
  assert.equal(result.output_tokens, 200);
  assert.equal(result.cost_microusd, 1000 * 5 + 300 * 10 + 4000 * 0.5 + 200 * 25, 'the 300 written tokens at the 1-hour rate');
  assert.equal(result.provider_completion_confirmed, true);
  // The recorded shape: the request as sent, blocks and all; the response
  // as received, its usage carrying the cache reads and writes separately.
  assert.deepEqual(result.raw_request, seen[0]);
  assert.deepEqual(result.raw_response.usage, { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 300, cache_read_input_tokens: 4000, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 300 } });
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
    assert.equal(received.cost_microusd, 1000 * 5 + 300 * 10 + 4000 * 0.5 + 200 * 25);
    assert.ok(Array.isArray(received.raw_request.messages[0].content), 'the failure keeps the request as sent');
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

// Work package 11 (plan finding (70)): an organisation-level key needs the
// workspace header; a 400 naming it stops the worker as configuration.
const WORKSPACE_REFUSAL = '400 {"type":"error","error":{"type":"invalid_request_error","message":"This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace."}}';

test('the client sends anthropic-workspace-id on every request when ANTHROPIC_WORKSPACE_ID is configured, and nothing when it is not', async () => {
  const key = 'sk-ant-test-'.repeat(3);
  assert.deepEqual(clientOptions({ apiKey: key, workspaceId: ' wrkspc_01ABC ' }), { apiKey: key, defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_01ABC' } });
  assert.deepEqual(clientOptions({ apiKey: key, workspaceId: '' }), { apiKey: key });
  assert.deepEqual(clientOptions({ apiKey: key, workspaceId: undefined }), { apiKey: key });
  const built = [];
  const factory = (options) => { built.push(options); return fakeClient(message()); };
  await createAnthropicApiProductModel({ apiKey: key, workspaceId: 'wrkspc_01ABC', clientFactory: factory }).complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} });
  await createAnthropicApiProductModel({ apiKey: key, workspaceId: undefined, clientFactory: factory }).complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} });
  assert.deepEqual(built, [{ apiKey: key, defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_01ABC' } }, { apiKey: key }]);
  // The environment is the default, as for the key.
  const saved = [process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_WORKSPACE_ID];
  process.env.ANTHROPIC_API_KEY = key;
  process.env.ANTHROPIC_WORKSPACE_ID = 'wrkspc_env';
  try {
    createAnthropicApiProductModel({ clientFactory: factory });
    assert.deepEqual(built[2], { apiKey: key, defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_env' } });
    delete process.env.ANTHROPIC_WORKSPACE_ID;
    createAnthropicApiProductModel({ clientFactory: factory });
    assert.deepEqual(built[3], { apiKey: key });
  } finally {
    for (const [index, name] of ['ANTHROPIC_API_KEY', 'ANTHROPIC_WORKSPACE_ID'].entries()) {
      if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index];
    }
  }
});

test('a 400 naming the workspace header is ANTHROPIC_API_NOT_CONFIGURED with the API\'s message kept, which the worker stops on', async () => {
  const refusal = Object.assign(new Error(WORKSPACE_REFUSAL), { status: 400 });
  assert.equal(isWorkspaceScopeError(refusal), true);
  assert.equal(isAccountLimit(refusal), false, 'not a usage limit');
  assert.equal(isWorkspaceScopeError(Object.assign(new Error('400 invalid_request_error: max_tokens'), { status: 400 })), false);
  assert.equal(isWorkspaceScopeError(Object.assign(new Error(WORKSPACE_REFUSAL), { status: 403 })), false);
  const model = createAnthropicApiProductModel({ client: fakeClient(() => { throw refusal; }) });
  await assert.rejects(model.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} }), (error) => {
    assert.equal(error.code, 'ANTHROPIC_API_NOT_CONFIGURED');
    assert.match(error.message, /^ANTHROPIC_API_NOT_CONFIGURED: the API key is not scoped to a workspace and no ANTHROPIC_WORKSPACE_ID is set \(400\): 400 .*This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header/);
    assert.equal(error.cause, refusal);
    assert.equal(isNotConfiguredError(error), true);
    assert.equal(isUsageLimitError(error), false, 'not the usage-limit rule: the worker has its own test for it');
    return true;
  });
  const withHeader = createAnthropicApiProductModel({ apiKey: 'sk-ant-test-'.repeat(3), workspaceId: 'wrkspc_01ABC', clientFactory: () => fakeClient(() => { throw refusal; }) });
  await assert.rejects(withHeader.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} }), /ANTHROPIC_API_NOT_CONFIGURED: the API refused the key with the ANTHROPIC_WORKSPACE_ID header sent \(400\)/);
  assert.equal(isNotConfiguredError(new Error('ANTHROPIC_API_NOT_CONFIGURED: wrapped')), true);
  assert.equal(isNotConfiguredError(new Error('ANTHROPIC_API_USAGE_LIMIT: x')), false);
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
  // Work package 11: the workspace id rides beside the key when set, by
  // name, for this provider only, and never into the result.
  const withWorkspace = await wakeSandboxProductRun({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6), anthropicWorkspaceId: ' wrkspc_01WORKSPACE ' });
  assert.equal(commandInput.env.ANTHROPIC_WORKSPACE_ID, 'wrkspc_01WORKSPACE');
  assert.deepEqual(Object.keys(commandInput.env), ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PRODUCT_MODEL_PROVIDER', 'ANTHROPIC_API_KEY', 'ANTHROPIC_WORKSPACE_ID']);
  assert.doesNotMatch(JSON.stringify(withWorkspace), /wrkspc_/);
  await wakeSandboxProductRun({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6), anthropicWorkspaceId: '' });
  assert.equal('ANTHROPIC_WORKSPACE_ID' in commandInput.env, false, 'an empty setting is no setting');
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
    anthropicWorkspaceIdResolver: () => 'wrkspc_01WORKSPACE',
    wakeRun: async (input) => { wakeInput = input; return { command_id: 'command-1' }; },
  });
  const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.deepEqual(wakeInput, {
    runId, databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value',
    providerId: ANTHROPIC_API_PROVIDER_ID, anthropicApiKey: 'sk-ant-'.repeat(6), anthropicWorkspaceId: 'wrkspc_01WORKSPACE',
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

// Work package 10 (plan finding (67)): the prompt cache's two blocks.
test('each call kind splits into a stable block under the breakpoint and a section block; a request with nothing per-section is one cached block', () => {
  assert.deepEqual(PER_SECTION_KEYS, {
    ROUTING: ['section_reference', 'section', 'deterministic_family_evidence'],
    RESIDUAL: ['section_reference', 'routed_families', 'paragraphs'],
    EXTRACTION: ['source_closure', 'part_instruction', 'article_introduction_instruction', 'no_other_reps_instruction'],
  });
  const routing = splitRequestForCache({ call_kind: 'ROUTING', prompt_version: 'R3', request: { instruction: 'Classify', allowed_families: ['NO_SHOP'], family_routing_contracts: {}, section_reference: '5.02', section: { exact_text: 'x' }, deterministic_family_evidence: [], response_contract: {} } });
  assert.deepEqual(Object.keys(routing.stable), ['call_kind', 'prompt_version', 'instruction', 'allowed_families', 'family_routing_contracts', 'response_contract']);
  assert.deepEqual(Object.keys(routing.section), ['section_reference', 'section', 'deterministic_family_evidence']);
  const residual = splitRequestForCache({ call_kind: 'RESIDUAL', prompt_version: 'P1', request: { instruction: 'Review', allowed_families: [], section_reference: '5.02', routed_families: ['NO_SHOP'], paragraphs: [], response_contract: {} } });
  assert.deepEqual(Object.keys(residual.stable), ['call_kind', 'prompt_version', 'instruction', 'allowed_families', 'response_contract']);
  assert.deepEqual(Object.keys(residual.section), ['section_reference', 'routed_families', 'paragraphs']);
  const extraction = splitRequestForCache({ call_kind: 'EXTRACTION', prompt_version: 'V9', request: { schema_version: 'LEGAL_SCHEMA/V2', instruction: 'i', scope_instruction: 's', source_closure: {}, family_contracts: [], cross_section_target_contracts: {}, response_contract: {}, component_instruction: 'c', article_introduction_instruction: 'a', no_other_reps_instruction: 'n', table_shapes: {}, conclusion_instruction: 'k', part_instruction: 'p' } });
  assert.deepEqual(Object.keys(extraction.stable), ['call_kind', 'prompt_version', 'schema_version', 'instruction', 'scope_instruction', 'family_contracts', 'cross_section_target_contracts', 'response_contract', 'component_instruction', 'table_shapes', 'conclusion_instruction']);
  assert.deepEqual(Object.keys(extraction.section), ['source_closure', 'article_introduction_instruction', 'no_other_reps_instruction', 'part_instruction']);
  const whole = cacheableContent({ call_kind: 'EXTRACTION', prompt_version: 'V9', request: { instruction: 'i' } });
  assert.equal(whole.system, SYSTEM_PROMPT, 'one block: the system prompt says nothing about a second object');
  assert.deepEqual(whole.content, [{ type: 'text', text: '{"call_kind":"EXTRACTION","prompt_version":"V9","instruction":"i"}', cache_control: { type: 'ephemeral', ttl: '1h' } }]);
  const two = cacheableContent({ call_kind: 'ROUTING', prompt_version: 'R3', request: { instruction: 'i', section: 's' } });
  assert.equal(two.system, `${SYSTEM_PROMPT} ${REQUEST_LAYOUT_NOTE}`);
  assert.equal(two.content.length, 2);
  assert.equal('cache_control' in two.content[1], false, 'the section block is never cached');
});

// Two sections with the same routed families through the real request
// builders (the V2 schema and the V3 table shapes, as a run uses them): the
// stable block is byte-identical, the section block differs.
function noShopModel(inputs) {
  const noShop = legalSchemaV2.families.find((family) => family.family_key === 'NO_SHOP');
  return {
    async complete(input) {
      inputs.push(input);
      const { call_kind: kind, request } = input;
      let response;
      if (kind === 'ROUTING') {
        const others = (request.deterministic_family_evidence || []).map((evidence) => evidence.section_family).filter((family) => family && family !== 'NO_SHOP');
        response = { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'no-shop', deterministic_disagreements: [...new Set(others)].map((family) => ({ family_key: family, reason: 'synthetic test model routes the no-shop family only' })) };
      } else if (kind === 'RESIDUAL') {
        response = { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'covered' })) };
      } else {
        const span = request.source_closure.operative[0];
        const words = span.exact_text.split(/\s+/).filter(Boolean).slice(1, 8).join(' ');
        const quote = span.exact_text.slice(span.exact_text.indexOf(words), span.exact_text.indexOf(words) + words.length);
        response = {
          proposals: [{
            client_ref: 'p-1', group_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
            statement: quote, roles: { covenant_obligor: 'Company', prohibited_action: quote }, value: null,
            evidence_quotes: [{ quote, source_span_id: span.span_id, occurrence: 0 }],
          }],
          groups: [{ client_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' }],
          links: [],
          coverage: { NO_SHOP: 'FOUND' },
          fact_type_coverage: { NO_SHOP: Object.fromEntries(noShop.required_fact_types.map((factType) => [factType, factType === 'PROHIBITED_ACTION' ? 'FOUND' : 'NOT_FOUND'])) },
        };
      }
      return { provider_id: 'SYNTHETIC_TEST_PROVIDER', model_id: 'SYNTHETIC_LEGAL_MODEL/V1', raw_request: request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 1, duration_ms: 1 };
    },
  };
}

test('the stable block is byte-identical across two sections with the same routed families, and the section block carries only the section', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const sections = substantiveSections(agreementStructure);
  const inputs = [];
  const model = noShopModel(inputs);
  for (const reference of ['6.11', '6.13']) {
    const node = sections.find((item) => item.reference === reference);
    assert.ok(node, reference);
    await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: legalSchemaV2, model, node, tableShapes });
  }
  assert.deepEqual(inputs.map((input) => input.call_kind), ['ROUTING', 'RESIDUAL', 'EXTRACTION', 'ROUTING', 'RESIDUAL', 'EXTRACTION']);
  for (const [first, second] of [[0, 3], [1, 4], [2, 5]]) {
    const a = cacheableContent(inputs[first]);
    const b = cacheableContent(inputs[second]);
    assert.equal(a.content.length, 2, inputs[first].call_kind);
    assert.equal(a.content[0].text, b.content[0].text, `${inputs[first].call_kind}: the stable block is byte-identical`);
    assert.deepEqual(a.content[0].cache_control, { type: 'ephemeral', ttl: '1h' });
    assert.notEqual(a.content[1].text, b.content[1].text, `${inputs[first].call_kind}: the section block differs`);
    assert.equal(a.system, `${SYSTEM_PROMPT} ${REQUEST_LAYOUT_NOTE}`);
  }
  // The extraction's stable block carries the routed family's contract and
  // table shapes and none of the section; the section block carries the
  // closure and nothing of the contracts. Both are well over the 512-token
  // minimum the API caches for claude-opus-5.
  const extraction = cacheableContent(inputs[2]);
  const stable = JSON.parse(extraction.content[0].text);
  const section = JSON.parse(extraction.content[1].text);
  assert.deepEqual(stable.family_contracts.map((family) => family.family_key), ['NO_SHOP']);
  assert.ok(stable.table_shapes.NO_SHOP, 'the routed family\'s table shapes ride in the stable block');
  assert.equal('source_closure' in stable, false);
  assert.deepEqual(Object.keys(section), ['source_closure']);
  assert.ok(Buffer.byteLength(extraction.content[0].text) > 20000, String(Buffer.byteLength(extraction.content[0].text)));
  const routing = cacheableContent(inputs[0]);
  assert.ok(Buffer.byteLength(routing.content[0].text) > 10000, 'routing: the instruction and the 25 family routing contracts');
  assert.deepEqual(Object.keys(JSON.parse(routing.content[1].text)), ['section_reference', 'section', 'deterministic_family_evidence']);
  const residual = cacheableContent(inputs[1]);
  assert.ok(Buffer.byteLength(residual.content[0].text) > 1200, 'residual: about 1,600 bytes, above the minimum');
});

// The estimate from generation 7's recorded tokens at the published rates.
test('the estimate script prices a run\'s tokens at the price table, uncached or with the cache split by lifetime', () => {
  const estimate = estimateRunCost({ inputTokens: 9853912, outputTokens: 3146447 });
  assert.equal(estimate.input_usd, 49.27);
  assert.equal(estimate.output_usd, 78.66);
  assert.equal(estimate.total_usd, 127.93);
  assert.equal(estimate.uncached_total_usd, 127.93);
  assert.equal(estimate.price_source, ANTHROPIC_API_PRICES.source);
  assert.equal(estimate.price_date, ANTHROPIC_API_PRICES.retrieved);
  assert.equal(estimateRunCost({ inputTokens: 9853912, outputTokens: 3146447, modelId: 'claude-opus-5-5' }).total_usd, 102.34);
  // Generation 8's profile (313 calls; 10,878,349 input and 3,623,975
  // output tokens) with the cache behaviour its stored calls give the block
  // design: 4,752,416 stable tokens, of which the 1-hour entry reads
  // 3,199,707 and writes 1,552,709; the 5-minute entry reads 1,566,424 and
  // writes 3,185,992.
  const uncached = estimateRunCost({ inputTokens: 10878349, outputTokens: 3623975 });
  assert.equal(uncached.total_usd, 144.99);
  const hour = estimateRunCost({ inputTokens: 10878349, outputTokens: 3623975, cacheWriteTokens: 1552709, cacheReadTokens: 3199707, cacheTtl: '1h' });
  assert.deepEqual([hour.fresh_input_tokens, hour.cache_write_tokens, hour.input_usd, hour.output_usd, hour.total_usd], [6125933, { '5m': 0, '1h': 1552709 }, 47.76, 90.6, 138.36]);
  const fiveMinutes = estimateRunCost({ inputTokens: 10878349, outputTokens: 3623975, cacheWriteTokens: 3185992, cacheReadTokens: 1566424, cacheTtl: '5m' });
  assert.deepEqual([fiveMinutes.cache_write_tokens, fiveMinutes.total_usd], [{ '5m': 3185992, '1h': 0 }, 141.92]);
  assert.throws(() => estimateRunCost({ inputTokens: 100, outputTokens: 1, cacheReadTokens: 101 }), /exceeds the input tokens/);
  assert.throws(() => estimateRunCost({ inputTokens: 1, outputTokens: 1, cacheTtl: '2h' }), /cacheTtl/);
  assert.throws(() => estimateRunCost({ inputTokens: 1, outputTokens: 1, modelId: 'claude-unknown' }), /no published rates/);
  assert.deepEqual(parseArguments(['9,853,912', '3,146,447']), { modelId: 'claude-opus-5', cacheWriteTokens: 0, cacheReadTokens: 0, cacheTtl: '1h', inputTokens: 9853912, outputTokens: 3146447 });
  assert.deepEqual(parseArguments(['10,878,349', '3,623,975', '--cache-write-tokens', '1,552,709', '--cache-read-tokens', '3199707', '--cache-ttl', '5m']), { modelId: 'claude-opus-5', cacheWriteTokens: 1552709, cacheReadTokens: 3199707, cacheTtl: '5m', inputTokens: 10878349, outputTokens: 3623975 });
  assert.deepEqual(parseArguments(['--run', '46c45080-6935-49e5-96ae-b6cb0609a924', '--model', 'claude-opus-5-5']), { modelId: 'claude-opus-5-5', cacheWriteTokens: 0, cacheReadTokens: 0, cacheTtl: '1h', runId: '46c45080-6935-49e5-96ae-b6cb0609a924' });
  assert.throws(() => parseArguments(['1']), /usage/);
  // From a run's stored calls: the whole prompt from input_tokens, the
  // split from each response's usage; a CLI run's calls have no usage and
  // price as uncached.
  const split = usageSplit([
    { call_kind: 'ROUTING', input_tokens: '10000', output_tokens: '100', usage: { input_tokens: 2000, cache_creation_input_tokens: 8000, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 8000 } } },
    { call_kind: 'ROUTING', input_tokens: '11000', output_tokens: '100', usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 8000 } },
    { call_kind: 'EXTRACTION', input_tokens: '50000', output_tokens: '20000', usage: { input_tokens: 20000, cache_creation_input_tokens: 30000, cache_read_input_tokens: 0 } },
    { call_kind: 'EXTRACTION', input_tokens: '40000', output_tokens: '10000', usage: null },
  ]);
  assert.deepEqual(split.total, { calls: 4, input_tokens: 111000, output_tokens: 30200, cache_read_tokens: 8000, cache_writes: { '5m': 0, '1h': 38000 } });
  assert.deepEqual(split.by_call_kind.ROUTING, { calls: 2, input_tokens: 21000, output_tokens: 200, cache_read_tokens: 8000, cache_writes: { '5m': 0, '1h': 8000 } });
  assert.deepEqual(usageSplit([{ call_kind: 'ROUTING', input_tokens: 10, output_tokens: 1, usage: { cache_creation_input_tokens: 5 } }], '5m').total.cache_writes, { '5m': 5, '1h': 0 }, 'no breakdown: the lifetime asked for');
  const fromRun = estimateFromSplit(split, 'claude-opus-5');
  assert.equal(fromRun.calls, 4);
  assert.equal(fromRun.fresh_input_tokens, 111000 - 8000 - 38000);
  assert.equal(fromRun.total_usd, Number(((65000 * 5 + 38000 * 10 + 8000 * 0.5 + 30200 * 25) / 1e6).toFixed(2)));
  assert.deepEqual(Object.keys(fromRun.by_call_kind), ['ROUTING', 'EXTRACTION']);
  assert.equal(fromRun.by_call_kind.EXTRACTION.calls, 2);
});
