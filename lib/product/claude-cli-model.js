'use strict';

// Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The Claude
// Code CLI (`claude -p`) on a Claude subscription login, wrapped the same
// way as the Codex CLI: one JSON object per call, the CLI's own usage
// accounting, zero marginal API cost, and a received-output record on
// every failure so nothing the model returned is lost.

const { createClaudeCliProductClient, receivedClaudeOutput } = require('../llm-cli-client');
const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');
const { CLAUDE_CLI_MODEL_CONFIG, CLAUDE_CLI_PROVIDER_ID, resolveClaudeCliCallModel } = require('./product-model-config');
const { exactJsonObject } = require('./codex-cli-model');

const PROVIDER_ID = CLAUDE_CLI_PROVIDER_ID;
// Extraction on a long section at high effort runs past ten minutes.
const CALL_KIND_TIMEOUT_MS = Object.freeze({ EXTRACTION: 30 * 60 * 1000 });
const SYSTEM_PROMPT = 'Return one JSON object only. Follow the supplied response contract exactly. Do not use Markdown. Do not use tools or inspect files. Use only the source text in the request.';

class ClaudeCliProductModelError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'ClaudeCliProductModelError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ClaudeCliProductModelError(code, detail);
}

// The CLI sometimes wraps the object in a ```json fence even when told not
// to (probe 2026-09-14); the fence is stripped and the body must then be one
// exact JSON object.
function unfenced(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function totalInputTokens(usage) {
  return ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
    .reduce((sum, key) => sum + (usageInteger(usage, key) ?? 0), 0);
}

function usageInteger(usage, key) {
  return Number.isInteger(usage?.[key]) && usage[key] >= 0 ? usage[key] : null;
}

function validateResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)
    || response.claude_completion?.status !== 'COMPLETE' || response.claude_completion?.subtype !== 'success') {
    fail('CLAUDE_PRODUCT_COMPLETION', 'one successful result is required');
  }
  if (!Array.isArray(response.content) || response.content.length !== 1
    || response.content[0]?.type !== 'text' || typeof response.content[0].text !== 'string') {
    fail('CLAUDE_PRODUCT_RESPONSE', 'one completed text response is required');
  }
  const usage = response.usage;
  for (const key of ['input_tokens', 'output_tokens']) {
    if (usageInteger(usage, key) === null) fail('CLAUDE_PRODUCT_USAGE', `${key} must be a non-negative integer`);
  }
  let parsed;
  try {
    parsed = exactJsonObject(unfenced(response.content[0].text));
  } catch {
    fail('CLAUDE_PRODUCT_JSON', 'response must be one exact JSON object');
  }
  return { usage, parsed };
}

function createClaudeCliProductModel({
  client = null, clientFactory = createClaudeCliProductClient, modelConfig = CLAUDE_CLI_MODEL_CONFIG, timeoutMs, env,
} = {}) {
  const adapters = new Map();
  const adapterFor = (selection, callKind) => {
    const callTimeoutMs = timeoutMs === undefined ? CALL_KIND_TIMEOUT_MS[callKind] : timeoutMs;
    const selectedModelId = `${selection.model};effort=${selection.effort}`;
    const adapterKey = `${selectedModelId};timeout=${callTimeoutMs ?? 'default'}`;
    if (adapters.has(adapterKey)) return adapters.get(adapterKey);
    const selectedClient = client || clientFactory({
      model: selection.model,
      effort: selection.effort,
      systemPrompt: SYSTEM_PROMPT,
      ...(env ? { env } : {}),
      ...(callTimeoutMs === undefined ? {} : { timeoutMs: callTimeoutMs }),
    });
    if (!selectedClient?.messages || typeof selectedClient.messages.create !== 'function') {
      throw new TypeError('a Claude CLI messages client is required');
    }
    const adapter = createJsonModelAdapter({
      providerId: PROVIDER_ID,
      modelId: selectedModelId,
      provider: async (input) => {
        const request = {
          model: selection.model,
          effort: selection.effort,
          billing_basis: 'CLAUDE_SUBSCRIPTION_ZERO_MARGINAL_API_COST',
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify({
            call_kind: input.call_kind,
            prompt_version: input.prompt_version,
            ...input.request,
          }) }],
        };
        const started = Date.now();
        let response;
        try {
          response = await selectedClient.messages.create(request);
        } catch (error) {
          const received = receivedClaudeOutput(error);
          if (!received) throw error;
          throw attachReceivedProviderFailure(error, {
            provider_id: PROVIDER_ID,
            model_id: selectedModelId,
            raw_request: request,
            raw_response: { schema_version: 'CLAUDE_CLI_RECEIVED_OUTPUT/V1', raw_json: received },
            provider_completion_confirmed: false,
            input_tokens: null,
            output_tokens: null,
            cost_microusd: 0,
            duration_ms: Math.max(0, Date.now() - started),
          });
        }
        let validated;
        try {
          validated = validateResponse(response);
        } catch (error) {
          if (response === undefined) throw error;
          throw attachReceivedProviderFailure(error, {
            provider_id: PROVIDER_ID,
            model_id: selectedModelId,
            raw_request: request,
            raw_response: JSON.parse(JSON.stringify(response)),
            provider_completion_confirmed: response?.claude_completion?.status === 'COMPLETE'
              && response?.claude_completion?.subtype === 'success',
            input_tokens: usageInteger(response?.usage, 'input_tokens') === null ? null : totalInputTokens(response.usage),
            output_tokens: usageInteger(response?.usage, 'output_tokens'),
            cost_microusd: 0,
            duration_ms: Math.max(0, Date.now() - started),
          });
        }
        const { usage, parsed } = validated;
        return {
          response: parsed,
          raw_request: request,
          raw_response: JSON.parse(JSON.stringify(response)),
          // Claude Code serves most of the prompt from its cache; the input
          // count is the whole prompt (fresh, cache-written and cache-read),
          // not the fresh slice alone (generation 6 showed 26 input tokens
          // for three sections).
          input_tokens: totalInputTokens(usage),
          output_tokens: usage.output_tokens,
          cost_microusd: 0,
          duration_ms: Date.now() - started,
          provider_completion_confirmed: true,
        };
      },
    });
    adapters.set(adapterKey, adapter);
    return adapter;
  };
  return {
    async complete(input) {
      const selection = resolveClaudeCliCallModel(modelConfig, input?.call_kind);
      return adapterFor(selection, input?.call_kind).complete(input);
    },
  };
}

// The product model for a run record, by the provider its model_config names.
function createHostedProductModel(run) {
  const providerId = run?.model_config?.provider_id;
  if (providerId === CLAUDE_CLI_PROVIDER_ID) return createClaudeCliProductModel({ modelConfig: run.model_config });
  const { createCodexCliProductModel } = require('./codex-cli-model');
  return createCodexCliProductModel({ modelConfig: run?.model_config });
}

module.exports = {
  CALL_KIND_TIMEOUT_MS,
  ClaudeCliProductModelError,
  PROVIDER_ID,
  SYSTEM_PROMPT,
  createClaudeCliProductModel,
  createHostedProductModel,
  totalInputTokens,
  unfenced,
};
