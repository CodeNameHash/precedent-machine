'use strict';

const { canonicalJson, sha256Hex } = require('../canonical-v2/canonical-bytes');

class ProductModelAdapterError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'ProductModelAdapterError';
    this.code = code;
  }
}

const RECEIVED_PROVIDER_FAILURE = Symbol('receivedProviderFailure');

function attachReceivedProviderFailure(error, details) {
  const failure = error instanceof Error ? error : new Error(String(error));
  Object.defineProperty(failure, RECEIVED_PROVIDER_FAILURE, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ ...details }),
  });
  return failure;
}

function receivedProviderFailure(error) {
  return error?.[RECEIVED_PROVIDER_FAILURE] || null;
}

function callKey(input) {
  return sha256Hex(Buffer.from(canonicalJson(input), 'utf8'));
}

function createJsonModelAdapter({ provider, providerId, modelId }) {
  if (typeof provider !== 'function') throw new TypeError('provider must be a function');
  if (!providerId || !modelId) throw new TypeError('providerId and modelId are required');
  return {
    async complete(input) {
      const result = await provider(input);
      if (!result || typeof result !== 'object') throw new ProductModelAdapterError('PROVIDER_RESULT', input.call_kind);
      return {
        provider_id: providerId,
        model_id: modelId,
        raw_request: result.raw_request ?? input.request,
        raw_response: result.raw_response ?? result.response,
        response: result.response ?? result.raw_response,
        input_tokens: result.input_tokens ?? 0,
        output_tokens: result.output_tokens ?? 0,
        cost_microusd: result.cost_microusd ?? 0,
        duration_ms: result.duration_ms ?? 0,
        provider_completion_confirmed: result.provider_completion_confirmed === true,
      };
    },
  };
}

function createRecordedModelAdapter(recording) {
  if (!recording || recording.schema_version !== 'PRODUCT_MODEL_RECORDING/V1' || !Array.isArray(recording.calls)) {
    throw new ProductModelAdapterError('RECORDING_SHAPE', 'PRODUCT_MODEL_RECORDING/V1 is required');
  }
  const calls = new Map();
  for (const entry of recording.calls) {
    if (!entry || typeof entry.call_key !== 'string') throw new ProductModelAdapterError('RECORDING_SHAPE', 'call_key is required');
    if (calls.has(entry.call_key)) throw new ProductModelAdapterError('RECORDING_DUPLICATE_KEY', entry.call_key);
    calls.set(entry.call_key, entry);
  }
  const used = new Set();
  return {
    async complete(input) {
      const key = callKey(input);
      const entry = calls.get(key);
      if (!entry) throw new ProductModelAdapterError('RECORDING_MISS', key);
      if (used.has(key)) throw new ProductModelAdapterError('RECORDING_REUSED', key);
      used.add(key);
      return {
        provider_id: entry.provider_id,
        model_id: entry.model_id,
        raw_request: input.request,
        raw_response: entry.raw_response,
        response: entry.raw_response,
        input_tokens: entry.input_tokens ?? 0,
        output_tokens: entry.output_tokens ?? 0,
        cost_microusd: entry.cost_microusd ?? 0,
        duration_ms: entry.duration_ms ?? 0,
      };
    },
    assertExhausted() {
      const unused = [...calls.keys()].filter((key) => !used.has(key));
      if (unused.length > 0) throw new ProductModelAdapterError('RECORDING_UNUSED', unused.join(','));
      return true;
    },
  };
}

module.exports = {
  ProductModelAdapterError,
  attachReceivedProviderFailure,
  callKey,
  createJsonModelAdapter,
  createRecordedModelAdapter,
  receivedProviderFailure,
};
