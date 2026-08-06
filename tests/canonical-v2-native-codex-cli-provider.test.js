'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const {
  PROVIDER_ID,
  PROFILES,
  NativeProducerCodexError,
  resolveProfile,
  createCodexCliProvider,
} = require('../lib/canonical-v2/native-producer/codex-cli-provider');
const { NativeProducerAnthropicError } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { createCodexCliClient, buildCodexExecArgs } = require('../lib/llm-cli-client');

const CONTRACT_BUNDLE = compileFixtureContract();
const INPUT = Object.freeze({
  governed_scope: Object.freeze({
    deal_key: 'deal:codex-provider-test',
    section_reference: '6.1',
    source_text: 'The Company shall maintain its existence until the Effective Time.',
  }),
  definitions: Object.freeze({ known_definitions: Object.freeze([]) }),
  contract_bundle: CONTRACT_BUNDLE,
  section_family: 'GENERAL_COVENANTS',
});

function successfulClient(onRequest = () => {}) {
  return {
    messages: {
      async create(request) {
        onRequest(request);
        return {
          content: [{
            text: JSON.stringify({ general_covenants: [], open_world_candidates: [] }),
          }],
        };
      },
    },
  };
}

test('profiles pin the approved model and reasoning combinations', () => {
  assert.deepEqual(Object.keys(PROFILES), ['TERRA_MEDIUM', 'SOL_HIGH', 'SOL_XHIGH']);
  assert.deepEqual(resolveProfile('TERRA_MEDIUM'), {
    profile_id: 'TERRA_MEDIUM',
    model: 'gpt-5.6-terra',
    reasoning_effort: 'medium',
  });
  assert.deepEqual(resolveProfile('SOL_HIGH'), {
    profile_id: 'SOL_HIGH',
    model: 'gpt-5.6-sol',
    reasoning_effort: 'high',
  });
  assert.deepEqual(resolveProfile('SOL_XHIGH'), {
    profile_id: 'SOL_XHIGH', model: 'gpt-5.6-sol', reasoning_effort: 'xhigh',
  });
  assert.ok(Object.isFrozen(PROFILES));
  assert.ok(Object.isFrozen(PROFILES.TERRA_MEDIUM));
});

test('unknown profiles fail closed before a client can run', () => {
  assert.throws(
    () => createCodexCliProvider({ profileId: 'LOCAL_DEFAULT' }),
    (error) => error instanceof NativeProducerCodexError && error.code === 'UNKNOWN_PROFILE',
  );
});

for (const profileId of Object.keys(PROFILES)) {
  test(`${profileId} is bound into the immutable producer receipt`, async () => {
    let request = null;
    const provider = createCodexCliProvider({
      profileId,
      client: successfulClient((value) => { request = value; }),
    });
    const result = await produceCandidateProposals({ ...INPUT, provider });
    const profile = PROFILES[profileId];
    const expectedModelId = `${profile.model};reasoning=${profile.reasoning_effort};profile=${profile.profile_id}`;

    assert.equal(request.model, expectedModelId);
    assert.equal(request.max_tokens, 8000);
    assert.equal(result.producer_receipt.provider_id, PROVIDER_ID);
    assert.equal(result.producer_receipt.model_id, expectedModelId);
    assert.equal(result.proposals.length, 0);
    assert.match(result.producer_receipt.producer_receipt_id, /^[a-f0-9]{64}$/);
  });
}

test('native Codex calls make one attempt and expose failure for deliberate resume', async () => {
  let attempts = 0;
  const provider = createCodexCliProvider({
    client: {
      messages: {
        async create() {
          attempts += 1;
          throw new Error('test transport failure');
        },
      },
    },
  });

  await assert.rejects(
    () => produceCandidateProposals({ ...INPUT, provider }),
    (error) => error instanceof NativeProducerAnthropicError
      && error.code === 'RETRIES_EXHAUSTED'
      && error.details.attempts === 1,
  );
  assert.equal(attempts, 1);
});

test('native Codex provider retains the literal response for exact replay', async () => {
  const response = JSON.stringify({ general_covenants: [], open_world_candidates: [] });
  const provider = createCodexCliProvider({
    client: {
      messages: {
        async create() {
          return { content: [{ text: response }] };
        },
      },
    },
  });
  const output = await provider(INPUT);
  assert.equal(output.raw_response_text, response);
  assert.equal(output.raw_response_length, response.length);
});

test('native Codex provider preserves request identity and usage for durable runner telemetry', async () => {
  const provider = createCodexCliProvider({
    client: {
      messages: {
        async create() {
          return {
            id: 'codex-request-123',
            usage: { input_tokens: 123, output_tokens: 45 },
            content: [{ text: JSON.stringify({ general_covenants: [], open_world_candidates: [] }) }],
          };
        },
      },
    },
  });
  const output = await provider(INPUT);
  assert.equal(output.provider_request_id, 'codex-request-123');
  assert.deepEqual(output.provider_usage, { input_tokens: 123, output_tokens: 45 });
});

test('Codex CLI controls reject invalid retry and reasoning settings', () => {
  assert.throws(() => createCodexCliClient({ maxAttempts: 0 }), /positive integer/);
  assert.throws(() => createCodexCliClient({ reasoningEffort: 'high; unsafe' }), /simple non-empty identifier/);
});

test('native Codex execution is pinned, ephemeral, read-only and isolated from repository context', () => {
  const args = buildCodexExecArgs({
    model: 'gpt-5.6-terra',
    reasoningEffort: 'medium',
    ephemeral: true,
    ignoreUserConfig: true,
    ignoreRules: true,
    isolated: true,
  });
  assert.deepEqual(args.slice(0, 9), [
    'exec', '-s', 'read-only', '--color', 'never',
    '-m', 'gpt-5.6-terra', '-c', 'model_reasoning_effort="medium"',
  ]);
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('--ignore-rules'));
  assert.ok(args.includes('--skip-git-repo-check'));
  assert.ok(args.includes('-C'));
  assert.equal(args.at(-1), '-');
});
