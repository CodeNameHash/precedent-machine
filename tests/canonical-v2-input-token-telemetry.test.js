'use strict';

// Step 2X-H: the Claude Code CLI reports `usage.input_tokens` as only the
// non-cached tail of the prompt. Live extraction calls carry ~40k tokens in
// cache fields, so summing raw `input_tokens` across a REPRESENTATIONS run
// produced 426 across 172 calls. These tests pin the normalisation path with
// committed fixtures -- no live model calls.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeProviderUsage,
  createAnthropicProvider,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');

const ROOT = path.resolve(__dirname, '..');
const CONCHO_REPS_TELEMETRY = path.join(
  ROOT,
  'evidence',
  'canonical-v2',
  'concho-representations-20260808-r1d',
  'call-telemetry.json',
);
const CONCHO_TERMINATION_FEE_RECORDING = path.join(
  ROOT,
  'evidence',
  'canonical-v2',
  'concho-termination-fee-20260808-r1',
  'recording.json',
);

function promptCharLength(messages) {
  return messages.map((message) => {
    if (typeof message.content === 'string') return message.content.length;
    return (message.content || []).map((block) => block.text || '').join('').length;
  }).reduce((sum, length) => sum + length, 0);
}

test('normalizeProviderUsage sums cache fields into billed input_tokens', () => {
  const telemetry = JSON.parse(fs.readFileSync(CONCHO_REPS_TELEMETRY, 'utf8'));
  const raw = telemetry.calls[0].usage;
  const normalized = normalizeProviderUsage(raw);

  assert.equal(raw.input_tokens, 2);
  assert.equal(normalized.input_tokens_non_cache, 2);
  assert.equal(
    normalized.input_tokens,
    raw.input_tokens + raw.cache_creation_input_tokens + raw.cache_read_input_tokens,
  );
  assert.ok(normalized.input_tokens > 40_000, 'billed input should reflect ~40k-token prompts');
});

test('normalizeProviderUsage leaves SDK-shaped usage without cache fields unchanged', () => {
  const usage = { input_tokens: 1200, output_tokens: 450 };
  assert.deepEqual(normalizeProviderUsage(usage), usage);
  assert.equal(normalizeProviderUsage(usage).input_tokens_non_cache, undefined);
});

test('provider metadata preserves normalised usage end-to-end from the client seam', async () => {
  const telemetry = JSON.parse(fs.readFileSync(CONCHO_REPS_TELEMETRY, 'utf8'));
  const cliUsage = telemetry.calls[0].usage;
  const client = {
    messages: {
      async create() {
        return {
          content: [{ text: JSON.stringify({ representation_instances: [], bring_down_conditions: [], open_world_candidates: [] }) }],
          usage: cliUsage,
        };
      },
    },
  };

  const provider = createAnthropicProvider({
    model: 'test-model',
    client,
    maxRetries: 0,
    section_family: 'REPRESENTATIONS',
  });

  const output = await provider({
    governed_scope: {
      deal_key: 'test:input-token-telemetry',
      section_reference: '5.10',
      governed_intervals: ['5.10'],
      source_text: 'SECTION 5.10. Representations.',
    },
    definitions: { known_definitions: [] },
    contract_bundle: compileFixtureContract(),
    section_family: 'REPRESENTATIONS',
  });

  const billed = output.provider_usage.input_tokens;
  assert.equal(
    billed,
    cliUsage.input_tokens + cliUsage.cache_creation_input_tokens + cliUsage.cache_read_input_tokens,
  );
  assert.ok(billed > 40_000);
});

test('normalised input_tokens are consistent with the recorded prompt length', () => {
  const recording = JSON.parse(fs.readFileSync(CONCHO_TERMINATION_FEE_RECORDING, 'utf8'));
  const telemetry = JSON.parse(fs.readFileSync(
    path.join(path.dirname(CONCHO_TERMINATION_FEE_RECORDING), 'call-telemetry.json'),
    'utf8',
  ));

  const call = recording.calls[0];
  const promptChars = promptCharLength(call.request_messages);
  const normalized = normalizeProviderUsage(telemetry.calls[0].usage);

  // A billed input count far below prompt size would be the 426-tokens bug.
  assert.ok(
    normalized.input_tokens * 4 >= promptChars * 0.25,
    `billed input_tokens (${normalized.input_tokens}) should track prompt length (~${promptChars} chars)`,
  );
});
