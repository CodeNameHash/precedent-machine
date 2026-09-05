'use strict';

const { createCodexCliClient } = require('../llm-cli-client');
const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');

const PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';
const MODEL = 'gpt-5.4-mini';
const REASONING_EFFORT = 'low';
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

function createCodexCliProductModel({ client = null, clientFactory = createCodexCliClient, timeoutMs } = {}) {
  if (!client) {
    client = clientFactory({
      model: MODEL,
      reasoningEffort: REASONING_EFFORT,
      maxAttempts: 1,
      ephemeral: true,
      ignoreUserConfig: true,
      ignoreRules: true,
      isolated: true,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
  }
  if (!client?.messages || typeof client.messages.create !== 'function') {
    throw new TypeError('a Codex CLI messages client is required');
  }
  return createJsonModelAdapter({
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    provider: async (input) => {
      const request = {
        model: MODEL,
        reasoning_effort: REASONING_EFFORT,
        billing_basis: 'CHATGPT_SUBSCRIPTION_ZERO_MARGINAL_API_COST',
        system: 'Return one JSON object only. Follow the supplied response contract exactly. Do not use Markdown.',
        messages: [{ role: 'user', content: JSON.stringify({
          call_kind: input.call_kind,
          prompt_version: input.prompt_version,
          ...input.request,
        }) }],
      };
      const started = Date.now();
      const response = await client.messages.create(request);
      let validated;
      try {
        validated = validateResponse(response);
      } catch (error) {
        if (response === undefined) throw error;
        throw attachReceivedProviderFailure(error, {
          provider_id: PROVIDER_ID,
          model_id: MODEL_ID,
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
