'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { buildAgreementSectionDraft, modelInvocationId } = require('../lib/product/agreement-draft');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { createAnthropicProductModel } = require('../lib/product/anthropic-model');
const { createCodexCliProductModel } = require('../lib/product/codex-cli-model');
const { createCodexCliClient } = require('../lib/llm-cli-client');
const { substantiveSections } = require('../lib/product/source-context');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function sectionInput() {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER', '', 'ARTICLE I', 'THE MERGER', '',
    'Section 1.1. Closing.',
    'The closing of the Merger shall occur at 10:00 a.m.',
  ].join('\n');
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1',
    source_document_id: sha256('provider-response-durability'),
    canonical_text: canonicalText,
    canonical_text_sha256: sha256(canonicalText),
    retrieval_url: 'https://example.test/agreement.htm',
    final_url: 'https://example.test/agreement.htm',
    filing_accession: '0000000000-00-000001',
    exhibit_filename: 'agreement.htm',
    source_map_id: sha256('provider-response-durability-map'),
  };
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: canonicalText,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  return { sourceDocument, agreementStructure, node: substantiveSections(agreementStructure)[0] };
}

async function captureFailure(model, attemptToken) {
  const input = sectionInput();
  const calls = [];
  await assert.rejects(() => buildAgreementSectionDraft({
    ...input,
    legalSchema,
    model,
    attemptToken,
    onModelCall: async (call) => calls.push(call),
  }));
  return calls;
}

function codexEnvelope(overrides = {}) {
  return {
    codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' },
    content: [{ type: 'text', text: '{not-json' }],
    usage: { input_tokens: 11, cached_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0 },
    ...overrides,
  };
}

test('completed malformed Codex replies create one durable failed call per attempt', async () => {
  const envelope = codexEnvelope();
  const model = createCodexCliProductModel({ client: { messages: { create: async () => envelope } } });
  const firstToken = '00000000-0000-4000-8000-000000000101';
  const secondToken = '00000000-0000-4000-8000-000000000102';
  const first = await captureFailure(model, firstToken);
  const second = await captureFailure(model, secondToken);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.notEqual(first[0].model_call_id, second[0].model_call_id);
  assert.equal(first[0].invocation_id, modelInvocationId(firstToken, 'ROUTING'));
  assert.equal(second[0].invocation_id, modelInvocationId(secondToken, 'ROUTING'));
  assert.equal(first[0].response.status, 'LOCAL_VALIDATION_FAILED');
  assert.equal(first[0].response.provider_completion_confirmed, true);
  assert.deepEqual(first[0].response.raw_response, envelope);
  assert.deepEqual(first[0].response.usage, { status: 'KNOWN', input_tokens: 11, output_tokens: 2 });
  assert.deepEqual(first[0].response.cost, { status: 'KNOWN', cost_microusd: 0 });
  assert.equal(first[0].input_tokens, 11);
  assert.equal(first[0].output_tokens, 2);
  assert.equal(first[0].response.validation_error.code, 'CODEX_PRODUCT_JSON');
});

test('completed non-object Codex output is rejected and retained', async () => {
  const envelope = codexEnvelope({ content: [{ type: 'text', text: 'true' }] });
  const calls = await captureFailure(createCodexCliProductModel({
    client: { messages: { create: async () => envelope } },
  }), '00000000-0000-4000-8000-000000000115');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].response.status, 'LOCAL_VALIDATION_FAILED');
  assert.equal(calls[0].response.validation_error.code, 'CODEX_PRODUCT_JSON');
  assert.equal(calls[0].response.provider_completion_confirmed, true);
  assert.deepEqual(calls[0].response.raw_response, envelope);
});

test('missing usage stays explicitly unknown and missing completion stays rejected', async () => {
  const missingUsage = codexEnvelope({ content: [{ type: 'text', text: '{}' }], usage: undefined });
  const unknownCalls = await captureFailure(createCodexCliProductModel({
    client: { messages: { create: async () => missingUsage } },
  }), '00000000-0000-4000-8000-000000000103');
  assert.equal(unknownCalls[0].response.status, 'LOCAL_VALIDATION_FAILED');
  assert.deepEqual(unknownCalls[0].response.usage, { status: 'UNKNOWN', input_tokens: null, output_tokens: null });
  assert.equal(unknownCalls[0].input_tokens, 0);
  assert.equal(unknownCalls[0].output_tokens, 0);

  const partialUsage = codexEnvelope({
    content: [{ type: 'text', text: '{}' }],
    usage: { input_tokens: 5, cached_input_tokens: 0, reasoning_output_tokens: 0 },
  });
  const partialCalls = await captureFailure(createCodexCliProductModel({
    client: { messages: { create: async () => partialUsage } },
  }), '00000000-0000-4000-8000-000000000107');
  assert.deepEqual(partialCalls[0].response.usage, { status: 'PARTIAL', input_tokens: 5, output_tokens: null });
  assert.equal(partialCalls[0].input_tokens, 5);
  assert.equal(partialCalls[0].output_tokens, 0);

  const incomplete = codexEnvelope({
    codex_completion: { status: 'FAILED', terminal_event: 'turn.failed' },
    content: [{ type: 'text', text: '{}' }],
  });
  const rejectedCalls = await captureFailure(createCodexCliProductModel({
    client: { messages: { create: async () => incomplete } },
  }), '00000000-0000-4000-8000-000000000104');
  assert.equal(rejectedCalls[0].response.status, 'PROVIDER_RESPONSE_REJECTED');
  assert.equal(rejectedCalls[0].response.provider_completion_confirmed, false);
  assert.deepEqual(rejectedCalls[0].response.raw_response, incomplete);
  assert.deepEqual(rejectedCalls[0].response.usage, { status: 'KNOWN', input_tokens: 11, output_tokens: 2 });
});

test('malformed Anthropic replies preserve the exact received envelope and usage', async () => {
  const envelope = {
    id: 'msg_malformed', model: 'test-model', stop_reason: 'end_turn',
    content: [{ type: 'text', text: '```json\n{bad\n```' }],
    usage: { input_tokens: 7, output_tokens: 3 },
  };
  const calls = await captureFailure(createAnthropicProductModel({
    client: { messages: { create: async () => envelope } }, modelId: 'test-model',
  }), '00000000-0000-4000-8000-000000000105');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].response.status, 'LOCAL_VALIDATION_FAILED');
  assert.equal(calls[0].response.provider_completion_confirmed, true);
  assert.deepEqual(calls[0].response.raw_response, envelope);
  assert.deepEqual(calls[0].response.usage, { status: 'KNOWN', input_tokens: 7, output_tokens: 3 });
  assert.deepEqual(calls[0].response.cost, { status: 'KNOWN', cost_microusd: 66 });
  assert.equal(calls[0].cost_microusd, 66);

  const partialEnvelope = {
    ...envelope,
    id: 'msg_partial_usage',
    usage: { input_tokens: 7 },
  };
  const partialCalls = await captureFailure(createAnthropicProductModel({
    client: { messages: { create: async () => partialEnvelope } }, modelId: 'test-model',
  }), '00000000-0000-4000-8000-000000000109');
  assert.deepEqual(partialCalls[0].response.usage, { status: 'PARTIAL', input_tokens: 7, output_tokens: null });
  assert.deepEqual(partialCalls[0].response.cost, { status: 'UNKNOWN', cost_microusd: null });
  assert.equal(partialCalls[0].cost_microusd, 0);
});

test('received JSON arrays rejected by the shared object contract are still retained', async () => {
  const envelope = {
    id: 'msg_array', model: 'test-model', stop_reason: 'end_turn',
    content: [{ type: 'text', text: '[1,2,3]' }],
    usage: { input_tokens: 7, output_tokens: 3 },
  };
  const calls = await captureFailure(createAnthropicProductModel({
    client: { messages: { create: async () => envelope } }, modelId: 'test-model',
  }), '00000000-0000-4000-8000-000000000108');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].response.status, 'LOCAL_VALIDATION_FAILED');
  assert.equal(calls[0].response.validation_error.code, 'ANTHROPIC_PRODUCT_JSON');
  assert.deepEqual(calls[0].response.raw_response, envelope);
  assert.deepEqual(calls[0].response.cost, { status: 'KNOWN', cost_microusd: 66 });

  const unknownEnvelope = { ...envelope, id: 'msg_array_unknown_usage', usage: undefined };
  const unknownCalls = await captureFailure(createAnthropicProductModel({
    client: { messages: { create: async () => unknownEnvelope } }, modelId: 'test-model',
  }), '00000000-0000-4000-8000-000000000110');
  assert.deepEqual(unknownCalls[0].response.usage, { status: 'UNKNOWN', input_tokens: null, output_tokens: null });
  assert.deepEqual(unknownCalls[0].response.cost, { status: 'UNKNOWN', cost_microusd: null });

  const partialEnvelope = {
    ...envelope,
    id: 'msg_scalar_partial_usage',
    content: [{ type: 'text', text: 'true' }],
    usage: { input_tokens: 7 },
  };
  const partialCalls = await captureFailure(createAnthropicProductModel({
    client: { messages: { create: async () => partialEnvelope } }, modelId: 'test-model',
  }), '00000000-0000-4000-8000-000000000111');
  assert.deepEqual(partialCalls[0].response.usage, { status: 'PARTIAL', input_tokens: 7, output_tokens: null });
  assert.deepEqual(partialCalls[0].response.cost, { status: 'UNKNOWN', cost_microusd: null });
});

test('transport failures do not invent a provider response or model call', async () => {
  const transportFailure = new Error('connection reset before response');
  const model = createCodexCliProductModel({
    client: { messages: { create: async () => { throw transportFailure; } } },
  });
  const input = sectionInput();
  const calls = [];
  await assert.rejects(() => buildAgreementSectionDraft({
    ...input,
    legalSchema,
    model,
    attemptToken: '00000000-0000-4000-8000-000000000106',
    onModelCall: async (call) => calls.push(call),
  }), transportFailure);
  assert.deepEqual(calls, []);
});

test('rejected Codex JSONL and trusted final output become one durable failed model call', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-durable-'));
  const executable = path.join(bin, 'codex');
  const rawPath = path.join(bin, 'response.jsonl');
  const raw = [
    '{"type":"thread.started","thread_id":"thread-durable"}',
    '{"type":"turn.started"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"Working."}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"ok\\":true}"}}',
    '{"type":"turn.completed","usage":{"input_tokens":12,"cached_input_tokens":3,"output_tokens":4,"reasoning_output_tokens":5}}',
    '',
  ].join('\n');
  fs.writeFileSync(rawPath, raw);
  fs.writeFileSync(executable, `#!/bin/sh
final=''
previous=''
for argument in "$@"; do
  if [ "$previous" = "--output-last-message" ]; then final="$argument"; fi
  previous="$argument"
done
cat >/dev/null
printf '%s\\n' '{"wrong":true}' > "$final"
cat ${JSON.stringify(rawPath)}
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({
      isolated: true, skipAuthPreflight: true, maxAttempts: 1,
    });
    const calls = await captureFailure(createCodexCliProductModel({ client }),
      '00000000-0000-4000-8000-000000000112');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].response.status, 'PROVIDER_RESPONSE_REJECTED');
    assert.equal(calls[0].response.provider_completion_confirmed, false);
    assert.deepEqual(calls[0].response.raw_response, {
      schema_version: 'CODEX_CLI_RECEIVED_OUTPUT/V1',
      raw_jsonl: raw,
      final_message: '{"wrong":true}\n',
    });
    assert.deepEqual(calls[0].response.usage, {
      status: 'KNOWN', input_tokens: 12, output_tokens: 4,
    });
    assert.match(calls[0].response.validation_error.message, /CODEX_FINAL_MESSAGE_MISMATCH/);
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('Codex JSONL received before a non-zero exit becomes one durable failed model call', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-nonzero-durable-'));
  const executable = path.join(bin, 'codex');
  const rawPath = path.join(bin, 'response.jsonl');
  const raw = [
    '{"type":"thread.started","thread_id":"thread-nonzero"}',
    '{"type":"turn.started"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"ok\\":true}"}}',
    '{"type":"turn.completed","usage":{"input_tokens":8,"cached_input_tokens":2,"output_tokens":3,"reasoning_output_tokens":1}}',
    '',
  ].join('\n');
  fs.writeFileSync(rawPath, raw);
  fs.writeFileSync(executable, `#!/bin/sh
final=''
previous=''
for argument in "$@"; do
  if [ "$previous" = "--output-last-message" ]; then final="$argument"; fi
  previous="$argument"
done
cat >/dev/null
printf '%s\n' '{"ok":true}' > "$final"
cat ${JSON.stringify(rawPath)}
exit 7
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({
      isolated: true, skipAuthPreflight: true, maxAttempts: 1,
    });
    const calls = await captureFailure(createCodexCliProductModel({ client }),
      '00000000-0000-4000-8000-000000000113');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].response.status, 'PROVIDER_RESPONSE_REJECTED');
    assert.equal(calls[0].response.provider_completion_confirmed, false);
    assert.deepEqual(calls[0].response.raw_response, {
      schema_version: 'CODEX_CLI_RECEIVED_OUTPUT/V1',
      raw_jsonl: raw,
      final_message: '{"ok":true}\n',
    });
    assert.deepEqual(calls[0].response.usage, {
      status: 'KNOWN', input_tokens: 8, output_tokens: 3,
    });
    assert.match(calls[0].response.validation_error.message, /codex exited 7/);
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('a non-zero Codex exit without stdout does not invent a provider response', async () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-codex-empty-nonzero-'));
  const executable = path.join(bin, 'codex');
  fs.writeFileSync(executable, `#!/bin/sh
cat >/dev/null
exit 7
`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  try {
    const client = createCodexCliClient({
      isolated: true, skipAuthPreflight: true, maxAttempts: 1,
    });
    const calls = await captureFailure(createCodexCliProductModel({ client }),
      '00000000-0000-4000-8000-000000000114');
    assert.deepEqual(calls, []);
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { recursive: true, force: true });
  }
});
