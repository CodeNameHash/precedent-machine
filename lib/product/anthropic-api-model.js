'use strict';

// Work package 3 (plan findings (44) and (45)). The Anthropic API as a hosted
// provider beside the Claude CLI path: the same model tier and effort per
// call kind (claude-opus-5; routing and residual at low, extraction at
// high), the same compact-JSON system prompt, Claude Code's default output
// cap, adaptive thinking (the model's default; no sampling parameters, which
// the model refuses), streaming so a long extraction is not cut off by the
// request timeout, and every call's cost recorded at the published rates.
// The key is ANTHROPIC_API_KEY on the deployment, passed to the sandbox by
// the wake, never read from the repository. Ben, 2026-10-17: "also you now
// have $200 of API tokens you can use if you want to preseve subscription
// capcaity".

const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');
const { ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PROVIDER_ID, anthropicApiCostMicrousd, resolveAnthropicApiCallModel } = require('./product-model-config');
const { exactJsonObject } = require('./codex-cli-model');
const { SYSTEM_PROMPT, unfenced } = require('./claude-cli-model');

const PROVIDER_ID = ANTHROPIC_API_PROVIDER_ID;

class AnthropicApiProductModelError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'AnthropicApiProductModelError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new AnthropicApiProductModelError(code, detail);
}

function usageInteger(usage, key) {
  return Number.isInteger(usage?.[key]) && usage[key] >= 0 ? usage[key] : null;
}

// The whole prompt, as the CLI path counts it: fresh, cache-written and
// cache-read tokens together.
function totalInputTokens(usage) {
  return ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
    .reduce((sum, key) => sum + (usageInteger(usage, key) ?? 0), 0);
}

// A 429 (after the SDK's own retries) or an exhausted credit balance (a 400
// naming the balance) is the account's limit, not a section failure: the
// worker stops with its usage-limit reason (scripts/product-hosted-worker.js,
// isUsageLimitError) instead of burning attempts, as it does on the CLI
// paths. The message carries the words that rule matches.
function isAccountLimit(error) {
  const status = Number(error?.status ?? error?.statusCode);
  if (status === 429) return true;
  return status === 400 && /credit balance/i.test(String(error?.message || ''));
}

function accountLimitError(error) {
  const status = Number(error?.status ?? error?.statusCode);
  const limit = new AnthropicApiProductModelError('ANTHROPIC_API_USAGE_LIMIT', `usage limit on the API account (${status}): ${String(error?.message || '').slice(0, 300)}`);
  limit.cause = error;
  return limit;
}

function validateMessage(message) {
  if (!message || typeof message !== 'object' || !Array.isArray(message.content)) fail('ANTHROPIC_API_RESPONSE', 'one message with content is required');
  if (message.stop_reason === 'refusal') fail('ANTHROPIC_API_REFUSAL', `the model declined (${message.stop_details?.category || 'no category'})`);
  const usage = message.usage;
  for (const key of ['input_tokens', 'output_tokens']) {
    if (usageInteger(usage, key) === null) fail('ANTHROPIC_API_USAGE', `${key} must be a non-negative integer`);
  }
  const text = message.content.filter((item) => item && item.type === 'text' && typeof item.text === 'string').map((item) => item.text).join('');
  if (!text) fail('ANTHROPIC_API_RESPONSE', 'one text response is required');
  if (message.stop_reason === 'max_tokens') fail('ANTHROPIC_API_OUTPUT_TRUNCATED', `the answer ran past the output cap (${usage.output_tokens} output tokens)`);
  let parsed;
  try {
    parsed = exactJsonObject(unfenced(text));
  } catch {
    fail('ANTHROPIC_API_JSON', 'response must be one exact JSON object');
  }
  return { usage, parsed };
}

function createAnthropicApiProductModel({
  apiKey = process.env.ANTHROPIC_API_KEY, client = null, modelConfig = ANTHROPIC_API_MODEL_CONFIG,
} = {}) {
  if (!client) {
    if (typeof apiKey !== 'string' || apiKey.length < 20) throw new Error('ANTHROPIC_API_KEY is not configured');
    const AnthropicModule = require('@anthropic-ai/sdk');
    const Anthropic = AnthropicModule.default || AnthropicModule;
    client = new Anthropic({ apiKey });
  }
  if (!client?.messages || typeof client.messages.stream !== 'function') throw new TypeError('an Anthropic messages client with stream() is required');
  const adapters = new Map();
  const adapterFor = (selection) => {
    const selectedModelId = `${selection.model};effort=${selection.effort}`;
    if (adapters.has(selectedModelId)) return adapters.get(selectedModelId);
    const adapter = createJsonModelAdapter({
      providerId: PROVIDER_ID,
      modelId: selectedModelId,
      provider: async (input) => {
        const request = {
          model: selection.model,
          max_tokens: modelConfig.max_output_tokens,
          output_config: { effort: selection.effort },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify({
            call_kind: input.call_kind,
            prompt_version: input.prompt_version,
            ...input.request,
          }) }],
        };
        const started = Date.now();
        let message;
        try {
          message = await client.messages.stream(request).finalMessage();
        } catch (error) {
          if (isAccountLimit(error)) throw accountLimitError(error);
          throw error;
        }
        const rawResponse = JSON.parse(JSON.stringify(message));
        let validated;
        try {
          validated = validateMessage(message);
        } catch (error) {
          throw attachReceivedProviderFailure(error, {
            provider_id: PROVIDER_ID,
            model_id: selectedModelId,
            raw_request: request,
            raw_response: rawResponse,
            provider_completion_confirmed: message?.stop_reason === 'end_turn',
            input_tokens: usageInteger(message?.usage, 'input_tokens') === null ? null : totalInputTokens(message.usage),
            output_tokens: usageInteger(message?.usage, 'output_tokens'),
            cost_microusd: message?.usage ? anthropicApiCostMicrousd(selection.model, message.usage) : null,
            duration_ms: Math.max(0, Date.now() - started),
          });
        }
        const { usage, parsed } = validated;
        return {
          response: parsed,
          raw_request: request,
          raw_response: rawResponse,
          input_tokens: totalInputTokens(usage),
          output_tokens: usage.output_tokens,
          cost_microusd: anthropicApiCostMicrousd(selection.model, usage),
          duration_ms: Date.now() - started,
          provider_completion_confirmed: message.stop_reason === 'end_turn',
        };
      },
    });
    adapters.set(selectedModelId, adapter);
    return adapter;
  };
  return {
    async complete(input) {
      return adapterFor(resolveAnthropicApiCallModel(modelConfig, input?.call_kind)).complete(input);
    },
  };
}

module.exports = {
  AnthropicApiProductModelError,
  PROVIDER_ID,
  createAnthropicApiProductModel,
  isAccountLimit,
  totalInputTokens,
};
