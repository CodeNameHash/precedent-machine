'use strict';

const { createCodexCliClient, receivedCodexOutput } = require('../llm-cli-client');
const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');
const { CODEX_MODEL_CONFIG, resolveCodexCallModel } = require('./product-model-config');

const PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';
const MODEL = 'gpt-5.4-mini';
const REASONING_EFFORT = 'low';
// Per-call-kind Codex timeouts. 2026-09-13: NCS generation 4 failed on
// section 3.12 when three extraction attempts each hit the 10-minute default
// while a comparable section finished in 9.6 minutes; extraction on gpt-5.5
// at medium reasoning with 30,000 output tokens needs longer. Routing and
// residual calls keep the default.
const CALL_KIND_TIMEOUT_MS = Object.freeze({ EXTRACTION: 30 * 60 * 1000 });
const MODEL_ID = `${MODEL};reasoning=${REASONING_EFFORT}`;

class CodexCliProductModelError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'CodexCliProductModelError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new CodexCliProductModelError(code, detail);
}

function exactJsonObject(text) {
  let value;
  try {
    value = JSON.parse(String(text || '').trim());
  } catch {
    fail('CODEX_PRODUCT_JSON', 'response must be one exact JSON object');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('CODEX_PRODUCT_JSON', 'response must be one exact JSON object');
  }
  return value;
}

function validateResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)
    || response.codex_completion?.status !== 'COMPLETE'
    || response.codex_completion?.terminal_event !== 'turn.completed') {
    fail('CODEX_PRODUCT_COMPLETION', 'one successful terminal turn is required');
  }
  if (!Array.isArray(response.content) || response.content.length !== 1
    || response.content[0]?.type !== 'text' || typeof response.content[0].text !== 'string') {
    fail('CODEX_PRODUCT_RESPONSE', 'one completed text response is required');
  }
  const usage = response.usage;
  for (const key of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens']) {
    if (!usage || !Number.isInteger(usage[key]) || usage[key] < 0) {
      fail('CODEX_PRODUCT_USAGE', `${key} must be a non-negative integer`);
    }
  }
  return { usage, parsed: exactJsonObject(response.content[0].text) };
}

function createCodexCliProductModel({
  client = null, clientFactory = createCodexCliClient, modelConfig = CODEX_MODEL_CONFIG, timeoutMs,
} = {}) {
  const adapters = new Map();
  const adapterFor = (selection, callKind) => {
    const callTimeoutMs = timeoutMs === undefined ? CALL_KIND_TIMEOUT_MS[callKind] : timeoutMs;
    const selectedModelId = `${selection.model};reasoning=${selection.reasoning_effort}`;
    const adapterKey = `${selectedModelId};timeout=${callTimeoutMs ?? 'default'}`;
    if (adapters.has(adapterKey)) return adapters.get(adapterKey);
    const selectedClient = client || clientFactory({
      model: selection.model,
      reasoningEffort: selection.reasoning_effort,
      maxAttempts: 1,
      ephemeral: true,
      ignoreUserConfig: true,
      ignoreRules: true,
      isolated: true,
      ...(callTimeoutMs === undefined ? {} : { timeoutMs: callTimeoutMs }),
    });
    if (!selectedClient?.messages || typeof selectedClient.messages.create !== 'function') {
      throw new TypeError('a Codex CLI messages client is required');
    }
    const adapter = createJsonModelAdapter({
      providerId: PROVIDER_ID,
      modelId: selectedModelId,
      provider: async (input) => {
      const request = {
        model: selection.model,
        reasoning_effort: selection.reasoning_effort,
        billing_basis: 'CHATGPT_SUBSCRIPTION_ZERO_MARGINAL_API_COST',
        system: 'Return one JSON object only. Follow the supplied response contract exactly. Do not use Markdown.',
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
        const received = receivedCodexOutput(error);
        if (!received) throw error;
        throw attachReceivedProviderFailure(error, {
          provider_id: PROVIDER_ID,
          model_id: selectedModelId,
          raw_request: request,
          raw_response: {
            schema_version: 'CODEX_CLI_RECEIVED_OUTPUT/V1',
            raw_jsonl: received.rawJsonl,
            final_message: received.finalMessage ?? null,
          },
          provider_completion_confirmed: false,
          input_tokens: received.usage?.input_tokens ?? null,
          output_tokens: received.usage?.output_tokens ?? null,
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
          provider_completion_confirmed: response?.codex_completion?.status === 'COMPLETE'
            && response?.codex_completion?.terminal_event === 'turn.completed',
          input_tokens: Number.isSafeInteger(response?.usage?.input_tokens) && response.usage.input_tokens >= 0
            ? response.usage.input_tokens : null,
          output_tokens: Number.isSafeInteger(response?.usage?.output_tokens) && response.usage.output_tokens >= 0
            ? response.usage.output_tokens : null,
          cost_microusd: 0,
          duration_ms: Math.max(0, Date.now() - started),
        });
      }
      const { usage, parsed } = validated;
      return {
        response: parsed,
        raw_request: request,
        raw_response: JSON.parse(JSON.stringify(response)),
        input_tokens: usage.input_tokens,
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
      const selection = resolveCodexCallModel(modelConfig, input?.call_kind);
      return adapterFor(selection, input?.call_kind).complete(input);
    },
  };
}

module.exports = {
  CodexCliProductModelError,
  MODEL,
  MODEL_ID,
  PROVIDER_ID,
  REASONING_EFFORT,
  createCodexCliProductModel,
  exactJsonObject,
};
