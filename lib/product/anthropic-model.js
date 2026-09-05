'use strict';

const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');

function parseJsonText(text) {
  const value = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new TypeError('response must be one JSON object');
    error.code = 'ANTHROPIC_PRODUCT_JSON';
    throw error;
  }
  return parsed;
}

function createAnthropicProductModel({ apiKey = process.env.ANTHROPIC_API_KEY, modelId = process.env.PRODUCT_ANALYSIS_MODEL || 'claude-sonnet-4-5-20250929', client = null } = {}) {
  if (!apiKey && !client) throw new Error('ANTHROPIC_API_KEY is not configured');
  if (!client) {
    const AnthropicModule = require('@anthropic-ai/sdk');
    const Anthropic = AnthropicModule.default || AnthropicModule;
    client = new Anthropic({ apiKey });
  }
  const inputRate = Number(process.env.PRODUCT_MODEL_INPUT_USD_PER_MILLION || 3);
  const outputRate = Number(process.env.PRODUCT_MODEL_OUTPUT_USD_PER_MILLION || 15);
  return createJsonModelAdapter({
    providerId: 'ANTHROPIC',
    modelId,
    provider: async (input) => {
      const started = Date.now();
      const providerRequest = {
        model: modelId,
        max_tokens: input.call_kind === 'ROUTING' ? 1200 : 12000,
        temperature: 0,
        system: 'Return one JSON object only. Follow the supplied response contract exactly. Do not use Markdown.',
        messages: [{ role: 'user', content: JSON.stringify({
          call_kind: input.call_kind,
          prompt_version: input.prompt_version,
          ...input.request,
        }) }],
      };
      const response = await client.messages.create(providerRequest);
      let parsed;
      try {
        const text = (response.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('');
        parsed = parseJsonText(text);
      } catch (error) {
        throw attachReceivedProviderFailure(error, {
          provider_id: 'ANTHROPIC',
          model_id: modelId,
          raw_request: providerRequest,
          raw_response: JSON.parse(JSON.stringify(response)),
          provider_completion_confirmed: response?.stop_reason === 'end_turn',
          input_tokens: Number.isSafeInteger(response?.usage?.input_tokens) && response.usage.input_tokens >= 0
            ? response.usage.input_tokens : null,
          output_tokens: Number.isSafeInteger(response?.usage?.output_tokens) && response.usage.output_tokens >= 0
            ? response.usage.output_tokens : null,
          cost_microusd: Number.isSafeInteger(response?.usage?.input_tokens) && response.usage.input_tokens >= 0
            && Number.isSafeInteger(response?.usage?.output_tokens) && response.usage.output_tokens >= 0
            ? Math.round(response.usage.input_tokens * inputRate + response.usage.output_tokens * outputRate) : null,
          duration_ms: Math.max(0, Date.now() - started),
        });
      }
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const rawResponse = JSON.parse(JSON.stringify(response));
      return {
        response: parsed,
        raw_request: providerRequest,
        raw_response: rawResponse,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_microusd: Math.round(inputTokens * inputRate + outputTokens * outputRate),
        duration_ms: Date.now() - started,
        provider_completion_confirmed: response?.stop_reason === 'end_turn',
      };
    },
  });
}

module.exports = { createAnthropicProductModel, parseJsonText };
