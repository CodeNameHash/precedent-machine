'use strict';

const { canonicalJson } = require('../canonical-v2/canonical-bytes');

const ANTHROPIC_PROVIDER_ID = 'ANTHROPIC';
const CODEX_PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';
const CLAUDE_CLI_PROVIDER_ID = 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION';
const PHASE5_DIAGNOSTIC_RUN_ID = '46c45080-6935-49e5-96ae-b6cb0609a924';
const PHASE5_DIAGNOSTIC_SOURCE_ID = '238dc3fed996667b9124a853745708a003917bcb28c889bad703f6124d13e721';

const ANTHROPIC_MODEL_CONFIG = Object.freeze({
  provider_id: ANTHROPIC_PROVIDER_ID,
  model_id: 'claude-sonnet-4-5-20250929',
  temperature: 0,
  routing_max_tokens: 1200,
  extraction_max_tokens: 12000,
});

const CODEX_DIAGNOSTIC_MODEL_CONFIG = Object.freeze({
  provider_id: CODEX_PROVIDER_ID,
  model_id: 'gpt-5.4-mini;reasoning=low',
  execution_model: 'gpt-5.4-mini',
  reasoning_effort: 'low',
  sandbox: 'read-only',
  ephemeral: true,
  max_attempts_per_call: 1,
  marginal_api_cost_microusd: 0,
});

const CODEX_MINI_MODEL_CONFIG = Object.freeze({
  ...CODEX_DIAGNOSTIC_MODEL_CONFIG,
  sandbox: 'named-permission-profile',
  permission_profile: 'pm_extraction',
  tool_policy_version: 'PRODUCT_CODEX_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CODEX_ENV_ALLOWLIST/V1',
});

// 2026-09-12: Codex CLI 0.145.0 on a ChatGPT login accepts only gpt-5.5
// (probe: scripts/product/probe-sandbox-models.js), so routing and residual
// calls use it at low reasoning effort. The V1 NCS run used gpt-5.4-mini.
const CODEX_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'gpt-5.5', reasoning_effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'gpt-5.5', reasoning_effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'gpt-5.5', reasoning_effort: 'medium' }),
});

const CODEX_MODEL_CONFIG = Object.freeze({
  provider_id: CODEX_PROVIDER_ID,
  model_id: 'PRODUCT_CODEX_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: CODEX_CALL_KIND_MODELS,
  sandbox: 'named-permission-profile',
  permission_profile: 'pm_extraction',
  tool_policy_version: 'PRODUCT_CODEX_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CODEX_ENV_ALLOWLIST/V1',
  ephemeral: true,
  max_attempts_per_call: 1,
  marginal_api_cost_microusd: 0,
});

// Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The hosted
// worker runs Claude Code (`claude -p`) on a Claude subscription login
// (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`), the same shape as the
// Codex path: one JSON object per call, no tools, no settings, no session
// on disk, zero marginal API cost. Claude Opus 5 on every call kind; routing
// and residual at low effort, extraction at high.
const CLAUDE_CLI_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'claude-opus-5', effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'claude-opus-5', effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'claude-opus-5', effort: 'high' }),
});

const CLAUDE_CLI_MODEL_CONFIG = Object.freeze({
  provider_id: CLAUDE_CLI_PROVIDER_ID,
  model_id: 'PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: CLAUDE_CLI_CALL_KIND_MODELS,
  tools: 'none',
  setting_sources: 'none',
  session_persistence: false,
  tool_policy_version: 'PRODUCT_CLAUDE_CLI_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CLAUDE_CLI_ENV_ALLOWLIST/V1',
  max_attempts_per_call: 1,
  marginal_api_cost_microusd: 0,
});

// Work package 3 (plan findings (44), (45) and (46)), Ben, 2026-10-17: "also
// you now have $200 of API tokens you can use if you want to preseve
// subscription capcaity" and "done on the key, will be live on your next
// redploy". The Anthropic API on the hosted worker, at the Claude CLI
// path's model tier and effort per call kind (read from that path's map,
// never a second copy), metered at the published first-party rates. The
// output cap is the documented maximum of the synchronous Messages API
// for claude-opus-5 and claude-opus-5-5, "Max output: 128K tokens"
// (platform.claude.com/docs/en/models/opus-5/overview, read 2026-10-18;
// work package 15, plan finding (83): NCS generation 5's 5.1 lost two
// attempts at a 64,000-token cap on part 2 of 3, the restrictions list,
// 130,758 input tokens, the same split each time); the request streams so
// the cap, not the request timeout, is the limit. A section that still
// runs past it is re-split smaller on its next attempt
// (lib/product/agreement-draft.js splitForAttempt).
const ANTHROPIC_API_PROVIDER_ID = 'ANTHROPIC_API';
const ANTHROPIC_API_CALL_KIND_MODELS = CLAUDE_CLI_CALL_KIND_MODELS;
// USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing
// as read on 2026-10-18 ("Model pricing" table: base input, 5m cache
// writes, 1h cache writes, cache hits and refreshes, output). One constant,
// one source; the cost of every call and the run estimate
// (scripts/product/estimate-run-cost.js) come from here.
const ANTHROPIC_API_PRICES = Object.freeze({
  source: 'https://platform.claude.com/docs/en/about-claude/pricing',
  retrieved: '2026-10-18',
  usd_per_million: Object.freeze({
    'claude-opus-5': Object.freeze({ input: 5, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5, output: 25 }),
    'claude-opus-5-5': Object.freeze({ input: 4, cache_write_5m: 5, cache_write_1h: 8, cache_read: 0.2, output: 20 }),
  }),
});
const ANTHROPIC_API_MODEL_CONFIG = Object.freeze({
  provider_id: ANTHROPIC_API_PROVIDER_ID,
  model_id: 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: ANTHROPIC_API_CALL_KIND_MODELS,
  max_output_tokens: 128000,
  thinking: 'adaptive',
  tools: 'none',
  billing_basis: 'ANTHROPIC_API_METERED',
  max_attempts_per_call: 1,
});

const HOSTED_PROVIDER_IDS = Object.freeze([CODEX_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, ANTHROPIC_API_PROVIDER_ID]);

function isHostedProvider(providerId) {
  return HOSTED_PROVIDER_IDS.includes(providerId);
}

// The canonical model config a hosted run must carry, by its provider.
function hostedModelConfigFor(providerId) {
  if (providerId === CODEX_PROVIDER_ID) return CODEX_MODEL_CONFIG;
  if (providerId === CLAUDE_CLI_PROVIDER_ID) return CLAUDE_CLI_MODEL_CONFIG;
  if (providerId === ANTHROPIC_API_PROVIDER_ID) return ANTHROPIC_API_MODEL_CONFIG;
  throw new Error(`PRODUCT_HOSTED_PROVIDER_UNSUPPORTED: ${providerId}`);
}

function configuredProductModelConfig(env = process.env) {
  const provider = env.PRODUCT_MODEL_PROVIDER || ANTHROPIC_PROVIDER_ID;
  if (provider === ANTHROPIC_PROVIDER_ID) return ANTHROPIC_MODEL_CONFIG;
  if (provider === CODEX_PROVIDER_ID) return CODEX_MODEL_CONFIG;
  if (provider === CLAUDE_CLI_PROVIDER_ID) return CLAUDE_CLI_MODEL_CONFIG;
  if (provider === ANTHROPIC_API_PROVIDER_ID) return ANTHROPIC_API_MODEL_CONFIG;
  throw new Error(`PRODUCT_MODEL_PROVIDER_UNSUPPORTED: ${provider}`);
}

function resolveClaudeCliCallModel(modelConfig, callKind) {
  if (!Object.prototype.hasOwnProperty.call(CLAUDE_CLI_CALL_KIND_MODELS, callKind)) {
    throw new Error(`PRODUCT_MODEL_CALL_KIND_UNSUPPORTED: ${callKind}`);
  }
  if (canonicalJson(modelConfig) !== canonicalJson(CLAUDE_CLI_MODEL_CONFIG)) {
    throw new Error('PRODUCT_CLAUDE_CLI_MODEL_CONFIG_UNSUPPORTED');
  }
  return CLAUDE_CLI_CALL_KIND_MODELS[callKind];
}

function resolveAnthropicApiCallModel(modelConfig, callKind) {
  if (!Object.prototype.hasOwnProperty.call(ANTHROPIC_API_CALL_KIND_MODELS, callKind)) {
    throw new Error(`PRODUCT_MODEL_CALL_KIND_UNSUPPORTED: ${callKind}`);
  }
  if (canonicalJson(modelConfig) !== canonicalJson(ANTHROPIC_API_MODEL_CONFIG)) {
    throw new Error('PRODUCT_ANTHROPIC_API_MODEL_CONFIG_UNSUPPORTED');
  }
  return ANTHROPIC_API_CALL_KIND_MODELS[callKind];
}

// Work package 10 (plan finding (67)): the prompt cache's lifetime for the
// API provider's stable prefix. Generation 8's stored calls (313 calls, four
// workers) decide it: a call that would read an entry starts, per worker,
// a median 233 seconds after the previous extraction call started (p90 457
// seconds, 52 of 126 gaps over five minutes), because the lifetime runs
// from the start of the request that wrote or read the entry and an
// extraction answers for 217 seconds at the median and up to 30 minutes.
// On that profile, at claude-opus-5's rates, the 5-minute entry ($6.25 per
// million written) would be read by 45 of the 90 repeat extraction calls
// and saves $3.07 a generation; the 1-hour entry ($10 per million written,
// one write per routed family set per hour) would be read by 85 of 90 and
// saves $6.64. The hour wins while a generation runs sections for longer
// than a few minutes each.
const ANTHROPIC_API_CACHE_TTL = '1h';
const ANTHROPIC_API_CACHE_TTLS = Object.freeze(['5m', '1h']);

// Microdollars for one call at the published rates: fresh input, cache
// writes at the lifetime they were written for (the message's
// usage.cache_creation breakdown when the API returns it, else the
// lifetime the request asked for; 5 minutes when nothing says otherwise),
// cache reads and output each at their own rate; a model without a
// published row is refused.
function anthropicApiCostMicrousd(modelId, usage, { cacheTtl = '5m' } = {}) {
  const rates = ANTHROPIC_API_PRICES.usd_per_million[modelId];
  if (!rates) throw new Error(`PRODUCT_ANTHROPIC_API_RATES_UNKNOWN: ${modelId}`);
  if (!ANTHROPIC_API_CACHE_TTLS.includes(cacheTtl)) throw new Error(`PRODUCT_ANTHROPIC_API_CACHE_TTL_UNKNOWN: ${cacheTtl}`);
  const integer = (object, key) => (Number.isInteger(object?.[key]) && object[key] >= 0 ? object[key] : null);
  const count = (key) => integer(usage, key) ?? 0;
  const breakdown = usage?.cache_creation;
  const written5m = integer(breakdown, 'ephemeral_5m_input_tokens');
  const written1h = integer(breakdown, 'ephemeral_1h_input_tokens');
  const writes = written5m !== null || written1h !== null
    ? (written5m ?? 0) * rates.cache_write_5m + (written1h ?? 0) * rates.cache_write_1h
    : count('cache_creation_input_tokens') * (cacheTtl === '1h' ? rates.cache_write_1h : rates.cache_write_5m);
  return Math.round(count('input_tokens') * rates.input + writes
    + count('cache_read_input_tokens') * rates.cache_read + count('output_tokens') * rates.output);
}

// A run's model_config is the identity of the model it runs under: the
// provider, the call-kind map, the selection, thinking, tools and the
// billing basis. The output cap is an operational limit the provider
// enforces on each call, not part of that identity: a run begun under one
// cap advances under a larger one (NCS generation 5, 2026-10-18: the run
// was created with the 64,000-token cap, work package 15 raised the cap to
// the documented maximum while it ran, and the run route refused to
// advance it with PRODUCT_RUN_MODEL_CONFIG_MISMATCH). The stored config
// keeps the cap the run was created with as history; the deployed config's
// cap is the one used.
function modelConfigIdentity(config) {
  if (!config || typeof config !== 'object') return config;
  const { max_output_tokens: _cap, ...identity } = config;
  return identity;
}

function assertRunModelConfig(run, expected = configuredProductModelConfig()) {
  if (!run || canonicalJson(modelConfigIdentity(run.model_config)) !== canonicalJson(modelConfigIdentity(expected))) {
    throw new Error('PRODUCT_RUN_MODEL_CONFIG_MISMATCH');
  }
  return expected;
}

function assertConfiguredRunModelConfig(run, expected = configuredProductModelConfig()) {
  if (canonicalJson(expected) === canonicalJson(CODEX_MODEL_CONFIG) && run?.run_id === PHASE5_DIAGNOSTIC_RUN_ID
    && run.source_document_id === PHASE5_DIAGNOSTIC_SOURCE_ID) {
    return assertRunModelConfig(run, CODEX_DIAGNOSTIC_MODEL_CONFIG);
  }
  return assertRunModelConfig(run, expected);
}

function resolveCodexCallModel(modelConfig, callKind) {
  if (!Object.prototype.hasOwnProperty.call(CODEX_CALL_KIND_MODELS, callKind)) {
    throw new Error(`PRODUCT_MODEL_CALL_KIND_UNSUPPORTED: ${callKind}`);
  }
  if (canonicalJson(modelConfig) === canonicalJson(CODEX_MODEL_CONFIG)) {
    return CODEX_CALL_KIND_MODELS[callKind];
  }
  if (canonicalJson(modelConfig) === canonicalJson(CODEX_MINI_MODEL_CONFIG)
    || canonicalJson(modelConfig) === canonicalJson(CODEX_DIAGNOSTIC_MODEL_CONFIG)) {
    return Object.freeze({
      model: modelConfig.execution_model,
      reasoning_effort: modelConfig.reasoning_effort,
    });
  }
  throw new Error('PRODUCT_CODEX_MODEL_CONFIG_UNSUPPORTED');
}

module.exports = {
  modelConfigIdentity,
  ANTHROPIC_API_CALL_KIND_MODELS,
  ANTHROPIC_API_CACHE_TTL,
  ANTHROPIC_API_CACHE_TTLS,
  ANTHROPIC_API_MODEL_CONFIG,
  ANTHROPIC_API_PROVIDER_ID,
  ANTHROPIC_API_PRICES,
  anthropicApiCostMicrousd,
  resolveAnthropicApiCallModel,
  ANTHROPIC_MODEL_CONFIG,
  ANTHROPIC_PROVIDER_ID,
  CLAUDE_CLI_CALL_KIND_MODELS,
  CLAUDE_CLI_MODEL_CONFIG,
  CLAUDE_CLI_PROVIDER_ID,
  HOSTED_PROVIDER_IDS,
  hostedModelConfigFor,
  isHostedProvider,
  resolveClaudeCliCallModel,
  CODEX_CALL_KIND_MODELS,
  CODEX_DIAGNOSTIC_MODEL_CONFIG,
  CODEX_MINI_MODEL_CONFIG,
  CODEX_MODEL_CONFIG,
  CODEX_PROVIDER_ID,
  PHASE5_DIAGNOSTIC_RUN_ID,
  PHASE5_DIAGNOSTIC_SOURCE_ID,
  assertConfiguredRunModelConfig,
  assertRunModelConfig,
  configuredProductModelConfig,
  resolveCodexCallModel,
};
