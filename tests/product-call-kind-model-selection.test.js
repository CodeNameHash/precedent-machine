'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { receivedProviderFailure } = require('../lib/product/model-adapter');
const { createCodexCliProductModel } = require('../lib/product/codex-cli-model');
const {
  CODEX_CALL_KIND_MODELS,
  CODEX_DIAGNOSTIC_MODEL_CONFIG,
  CODEX_MINI_MODEL_CONFIG,
  CODEX_MODEL_CONFIG,
  PHASE5_DIAGNOSTIC_RUN_ID,
  PHASE5_DIAGNOSTIC_SOURCE_ID,
  assertConfiguredRunModelConfig,
  configuredProductModelConfig,
  resolveCodexCallModel,
} = require('../lib/product/product-model-config');

function completed(text = '{"ok":true}') {
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 2, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0,
    },
    codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' },
  };
}

test('new Codex run identity freezes the exact call-kind model map', () => {
  assert.deepEqual(CODEX_CALL_KIND_MODELS, {
    ROUTING: { model: 'gpt-5.4-mini', reasoning_effort: 'low' },
    RESIDUAL: { model: 'gpt-5.4-mini', reasoning_effort: 'low' },
    EXTRACTION: { model: 'gpt-5.5', reasoning_effort: 'medium' },
  });
  assert.deepEqual(configuredProductModelConfig({ PRODUCT_MODEL_PROVIDER: 'OPENAI_CODEX_CLI_SUBSCRIPTION' }),
    CODEX_MODEL_CONFIG);
  assert.notDeepEqual(CODEX_MODEL_CONFIG, CODEX_MINI_MODEL_CONFIG);
  assert.throws(() => assertConfiguredRunModelConfig({
    run_id: '11111111-1111-4111-8111-111111111111',
    source_document_id: 'a'.repeat(64), model_config: CODEX_MINI_MODEL_CONFIG,
  }, CODEX_MODEL_CONFIG), /MODEL_CONFIG_MISMATCH/);
  assert.doesNotThrow(() => assertConfiguredRunModelConfig({
    run_id: PHASE5_DIAGNOSTIC_RUN_ID,
    source_document_id: PHASE5_DIAGNOSTIC_SOURCE_ID,
    model_config: CODEX_DIAGNOSTIC_MODEL_CONFIG,
  }, CODEX_MODEL_CONFIG));
  assert.throws(() => resolveCodexCallModel(CODEX_MODEL_CONFIG, 'UNKNOWN'), /CALL_KIND/);
});

test('Codex boundary selects and records the actual model for every call kind', async () => {
  const creations = [];
  const requests = [];
  const model = createCodexCliProductModel({
    modelConfig: CODEX_MODEL_CONFIG,
    clientFactory(options) {
      creations.push(options);
      return { messages: { create: async (request) => {
        requests.push(request);
        return completed();
      } } };
    },
  });
  const routing = await model.complete({ call_kind: 'ROUTING', prompt_version: 'R1', request: {} });
  const residual = await model.complete({ call_kind: 'RESIDUAL', prompt_version: 'R1', request: {} });
  const extraction = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'E1', request: {} });

  assert.deepEqual(creations.map(({ model: selected, reasoningEffort }) => (
    [selected, reasoningEffort]
  )), [['gpt-5.4-mini', 'low'], ['gpt-5.5', 'medium']]);
  assert.equal(routing.model_id, 'gpt-5.4-mini;reasoning=low');
  assert.equal(residual.model_id, 'gpt-5.4-mini;reasoning=low');
  assert.equal(extraction.model_id, 'gpt-5.5;reasoning=medium');
  assert.deepEqual(requests.map(({ model: selected, reasoning_effort: effort }) => (
    [selected, effort]
  )), [['gpt-5.4-mini', 'low'], ['gpt-5.4-mini', 'low'], ['gpt-5.5', 'medium']]);
});

test('unknown kinds fail before transport and received failures retain selected identity', async () => {
  let creations = 0;
  const model = createCodexCliProductModel({
    modelConfig: CODEX_MODEL_CONFIG,
    clientFactory() {
      creations += 1;
      return { messages: { create: async () => ({
        ...completed(), codex_completion: { status: 'FAILED', terminal_event: 'turn.failed' },
      }) } };
    },
  });
  await assert.rejects(() => model.complete({ call_kind: 'UNKNOWN', prompt_version: 'V1', request: {} }),
    /CALL_KIND/);
  assert.equal(creations, 0);

  let thrown;
  try {
    await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'V1', request: {} });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown);
  const durable = receivedProviderFailure(thrown);
  assert.equal(durable.model_id, 'gpt-5.5;reasoning=medium');
  assert.equal(durable.raw_request.model, 'gpt-5.5');
  assert.equal(durable.raw_request.reasoning_effort, 'medium');
});

test('legacy mini-only runs remain executable only under their stored exact config', async () => {
  const selections = [];
  const legacy = createCodexCliProductModel({
    modelConfig: CODEX_MINI_MODEL_CONFIG,
    clientFactory(options) {
      selections.push(options);
      return { messages: { create: async () => completed() } };
    },
  });
  const extraction = await legacy.complete({
    call_kind: 'EXTRACTION', prompt_version: 'V1', request: {},
  });
  assert.equal(extraction.model_id, 'gpt-5.4-mini;reasoning=low');
  assert.deepEqual(selections.map(({ model, reasoningEffort }) => [model, reasoningEffort]), [
    ['gpt-5.4-mini', 'low'],
  ]);

  let invoked = false;
  const changed = createCodexCliProductModel({
    modelConfig: {
      ...CODEX_MODEL_CONFIG,
      call_kind_models: {
        ...CODEX_MODEL_CONFIG.call_kind_models,
        EXTRACTION: { model: 'gpt-5.4-mini', reasoning_effort: 'low' },
      },
    },
    clientFactory() { invoked = true; return { messages: { create: async () => completed() } }; },
  });
  await assert.rejects(() => changed.complete({
    call_kind: 'EXTRACTION', prompt_version: 'V1', request: {},
  }), /MODEL_CONFIG_UNSUPPORTED/);
  assert.equal(invoked, false);
});
