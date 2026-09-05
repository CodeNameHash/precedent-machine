'use strict';

const { canonicalJson } = require('../canonical-v2/canonical-bytes');

const ANTHROPIC_PROVIDER_ID = 'ANTHROPIC';
const CODEX_PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';
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

const CODEX_MODEL_CONFIG = Object.freeze({
  ...CODEX_DIAGNOSTIC_MODEL_CONFIG,
  sandbox: 'named-permission-profile',
  permission_profile: 'pm_extraction',
  tool_policy_version: 'PRODUCT_CODEX_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CODEX_ENV_ALLOWLIST/V1',
});

function configuredProductModelConfig(env = process.env) {
  const provider = env.PRODUCT_MODEL_PROVIDER || ANTHROPIC_PROVIDER_ID;
  if (provider === ANTHROPIC_PROVIDER_ID) return ANTHROPIC_MODEL_CONFIG;
  if (provider === CODEX_PROVIDER_ID) return CODEX_MODEL_CONFIG;
  throw new Error(`PRODUCT_MODEL_PROVIDER_UNSUPPORTED: ${provider}`);
}

function assertRunModelConfig(run, expected = configuredProductModelConfig()) {
  if (!run || canonicalJson(run.model_config) !== canonicalJson(expected)) {
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

module.exports = {
  ANTHROPIC_MODEL_CONFIG,
  ANTHROPIC_PROVIDER_ID,
  CODEX_DIAGNOSTIC_MODEL_CONFIG,
  CODEX_MODEL_CONFIG,
  CODEX_PROVIDER_ID,
  PHASE5_DIAGNOSTIC_RUN_ID,
  PHASE5_DIAGNOSTIC_SOURCE_ID,
  assertConfiguredRunModelConfig,
  assertRunModelConfig,
  configuredProductModelConfig,
};
