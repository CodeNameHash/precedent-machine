'use strict';

// Tests for the output-ceiling overflow check added to anthropic-provider.js
// under docs/codex-program/notes/multi-object-response-ruling.md. The
// ruling's diagnosis: a "multi-object" model response is not a format --
// it is a fragment of one answer whose head was destroyed when the CLI's
// per-model output-token ceiling was hit mid-generation and the CLI
// silently continued into a further message that the harness never
// receives. The fix has two parts, both exercised here:
//
//   1. `output_tokens >= maxOutputTokens` is checked BEFORE the response
//      text is parsed, using only the response's own recorded usage --
//      never the response's content.
//   2. On overflow this is a typed, NON-RETRYABLE failure
//      (RESPONSE_TRUNCATED_BY_OUTPUT_CEILING), even when the final message
//      happens to parse as one clean, well-formed object -- a parseable
//      final message is not proof of completeness once the ceiling was hit.
//
// See tests/canonical-v2-native-provider.test.js for the sibling coverage
// this file deliberately does not duplicate (malformed JSON, retries,
// oversized responses, wrapped JSON, ...). This file adds one hostile case
// from that same sibling suite's territory -- an under-ceiling AMBIGUOUS
// response must still refuse as AMBIGUOUS, proving the new check does not
// swallow or reinterpret the pre-existing defence in depth.

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const {
  createAnthropicProvider,
  NativeProducerAnthropicError,
  DEFAULT_MAX_OUTPUT_TOKENS_CEILING,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

const SOURCE_TEXT =
  'SECTION 3.1. Capitalization. (a) The authorized capital stock of the Company '
  + 'consists of 100,000,000 shares. (b) Except as set forth in Schedule 3.1, '
  + 'there are no outstanding options. As of the Closing Date, the representations '
  + 'shall be true.';

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'test-deal:native-anthropic-provider-output-ceiling',
  section_reference: '3.1',
  governed_intervals: ['3.1'],
  source_text: SOURCE_TEXT,
});
const DEFINITIONS = Object.freeze({ known_definitions: [] });

function wellFormedResponse() {
  return {
    representation_instances: [
      {
        section_reference: '3.1',
        party_making: 'the Company',
        chapeau_quote: 'SECTION 3.1. Capitalization.',
        limbs: [
          {
            limb_path: ['(a)'],
            assertion_quote: 'The authorized capital stock of the Company consists of 100,000,000 shares.',
            subject: 'authorized capital stock',
          },
        ],
        qualifiers: [
          {
            kind: 'ACCURACY',
            code: 'MAT_ALL_RESPECTS',
            quote: 'consists of 100,000,000 shares.',
            attachment: {
              position: 'ITEM',
              governs_path: ['(a)'],
              ambiguity_signals: { items_grammatically_parallel: true },
            },
          },
        ],
        definition_uses: [],
        cross_references: [],
      },
    ],
    bring_down_conditions: [
      {
        section_reference: '5.2',
        condition_obligor: 'Parent',
        beneficiary: 'Company',
        measurement_date_quote: 'As of the Closing Date',
        tiers: [
          {
            accuracy_standard: 'MAT_ALL_MATERIAL',
            covered_scope_quote: 'Except as set forth in Schedule 3.1, there are no outstanding options.',
            covered_limb_references: [],
            scrape_quote: null,
            exception_quote: null,
          },
        ],
        nested_definitions: [],
      },
    ],
    open_world_candidates: [
      {
        observed_quote: 'the representations shall be true.',
        why_unmapped: 'a closing-condition proposition with no mapped concept in this fixture',
        nearest_concept: null,
      },
    ],
  };
}

// A response with every required list genuinely empty -- a legitimate,
// complete answer per CLAUDE.md's "a family returning zero can be correct".
function emptyWellFormedResponse() {
  return {
    representation_instances: [],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

function stubClientReturning(text, usage) {
  return {
    messages: {
      async create() {
        return {
          content: [{ text }],
          ...(usage === undefined ? {} : { usage }),
        };
      },
    },
  };
}

function countingClientReturning(text, usage) {
  let calls = 0;
  return {
    calls: () => calls,
    client: {
      messages: {
        async create() {
          calls += 1;
          return {
            content: [{ text }],
            ...(usage === undefined ? {} : { usage }),
          };
        },
      },
    },
  };
}

async function runProvider(providerOptions, { governedScope = GOVERNED_SCOPE, definitions = DEFINITIONS } = {}) {
  const provider = createAnthropicProvider(providerOptions);
  return produceCandidateProposals({
    governed_scope: governedScope,
    definitions,
    contract_bundle: CONTRACT_BUNDLE,
    provider,
  });
}

// ---------------------------------------------------------------------------

test('DEFAULT_MAX_OUTPUT_TOKENS_CEILING matches the CLI\'s current documented default (64000)', () => {
  assert.equal(DEFAULT_MAX_OUTPUT_TOKENS_CEILING, 64000);
});

test('an over-ceiling response is a typed RESPONSE_TRUNCATED_BY_OUTPUT_CEILING failure even though it parses cleanly', async () => {
  // This is the central claim of the ruling: modiv-no-shop-20260806 §5.6
  // parsed fine at 65,008 output tokens purely because the truncation
  // boundary happened to land in invisible thinking rather than visible
  // JSON. Over-ceiling success is a coin flip and must not present as a
  // clean run -- so a WELL-FORMED, fully parseable response must still be
  // rejected once usage says the ceiling was hit.
  const client = stubClientReturning(
    JSON.stringify(wellFormedResponse()),
    { output_tokens: 65008, input_tokens: 1200 },
  );
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 2, retryBackoffMs: 1 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RESPONSE_TRUNCATED_BY_OUTPUT_CEILING');
      assert.equal(error.details.last_details.observed_output_tokens, 65008);
      assert.equal(error.details.last_details.max_output_tokens, DEFAULT_MAX_OUTPUT_TOKENS_CEILING);
      assert.match(error.message, /65008/);
      assert.match(error.message, /64000/);
      return true;
    },
  );
});

test('an over-ceiling response is NEVER retried, even when maxRetries allows it', async () => {
  const { calls, client } = countingClientReturning(
    JSON.stringify(wellFormedResponse()),
    { output_tokens: 74080, input_tokens: 900 },
  );
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 3, retryBackoffMs: 1 }),
    (error) => {
      assert.equal(error.code, 'RESPONSE_TRUNCATED_BY_OUTPUT_CEILING');
      assert.equal(error.details.attempts, 1, 'an output-ceiling overflow must not be retried');
      return true;
    },
  );
  assert.equal(calls(), 1, 'the model must be called exactly once -- retrying a deterministic ceiling overflow just burns a call');
});

test('the overflow check runs BEFORE parsing: an unparseable response over the ceiling reports overflow, not a parse failure', async () => {
  const client = stubClientReturning(
    'garbage that is not JSON at all and would otherwise be MALFORMED_RESPONSE',
    { output_tokens: 71907 },
  );
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 0 }),
    (error) => {
      assert.equal(error.code, 'RESPONSE_TRUNCATED_BY_OUTPUT_CEILING', 'the ceiling check must win over MALFORMED_RESPONSE, proving it runs first');
      return true;
    },
  );
});

test('detection is arithmetic only: an empty-but-well-formed response under the ceiling still succeeds', async () => {
  // A family returning zero rows can be correct (CLAUDE.md). This proves
  // the overflow check never infers truncation from content -- an empty
  // response under the ceiling is a clean success, not a suspect one.
  const client = stubClientReturning(
    JSON.stringify(emptyWellFormedResponse()),
    { output_tokens: 512 },
  );
  const { proposals } = await runProvider({ model: 'test-model', client });
  assert.deepEqual(proposals, []);
});

test('the ceiling is an exact boundary: output_tokens one below the ceiling succeeds, at or above it fails', async () => {
  const okClient = stubClientReturning(
    JSON.stringify(wellFormedResponse()),
    { output_tokens: DEFAULT_MAX_OUTPUT_TOKENS_CEILING - 1 },
  );
  const { proposals } = await runProvider({ model: 'test-model', client: okClient });
  assert.ok(proposals.length >= 4);

  const atCeilingClient = stubClientReturning(
    JSON.stringify(wellFormedResponse()),
    { output_tokens: DEFAULT_MAX_OUTPUT_TOKENS_CEILING },
  );
  await assert.rejects(
    () => runProvider({ model: 'test-model', client: atCeilingClient, maxRetries: 0 }),
    (error) => {
      assert.equal(error.code, 'RESPONSE_TRUNCATED_BY_OUTPUT_CEILING', 'output_tokens == maxOutputTokens must fail: the predicate is >=, not >');
      return true;
    },
  );
});

test('a caller-supplied maxOutputTokens (e.g. once the real CLI ceiling is raised) is honoured, not the default', async () => {
  // Simulates the raised ceiling: a call that would have overflowed the
  // default 64,000 succeeds once the caller tells this module the real
  // ceiling in effect was raised to 128,000, and a call at/over that raised
  // figure still fails.
  const underRaisedCeiling = stubClientReturning(
    JSON.stringify(wellFormedResponse()),
    { output_tokens: 74080 },
  );
  const { proposals } = await runProvider({ model: 'test-model', client: underRaisedCeiling, maxOutputTokens: 128000 });
  assert.ok(proposals.length >= 4);

  const overRaisedCeiling = stubClientReturning(
    JSON.stringify(wellFormedResponse()),
    { output_tokens: 128000 },
  );
  await assert.rejects(
    () => runProvider({
      model: 'test-model', client: overRaisedCeiling, maxOutputTokens: 128000, maxRetries: 0,
    }),
    (error) => {
      assert.equal(error.code, 'RESPONSE_TRUNCATED_BY_OUTPUT_CEILING');
      assert.equal(error.details.last_details.max_output_tokens, 128000);
      return true;
    },
  );
});

test('createAnthropicProvider rejects a non-positive maxOutputTokens as INVALID_CONFIG', () => {
  assert.throws(
    () => createAnthropicProvider({ model: 'test-model', client: stubClientReturning('{}'), maxOutputTokens: 0 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'INVALID_CONFIG');
      return true;
    },
  );
  assert.throws(
    () => createAnthropicProvider({ model: 'test-model', client: stubClientReturning('{}'), maxOutputTokens: -1 }),
    (error) => {
      assert.equal(error.code, 'INVALID_CONFIG');
      return true;
    },
  );
});

test('a response with no usage information at all is unaffected by the ceiling check (existing mock clients keep working)', async () => {
  // Every test double throughout the rest of the suite -- and every direct
  // Anthropic SDK response shape this module has always supported -- can
  // omit usage entirely. The check must skip cleanly, never throw on an
  // unknown output-token count.
  const client = stubClientReturning(JSON.stringify(wellFormedResponse()), undefined);
  const { proposals } = await runProvider({ model: 'test-model', client });
  assert.ok(proposals.length >= 4);
});

test('hostile: an under-ceiling response with two independent JSON objects still refuses as AMBIGUOUS, not swallowed by the new check', async () => {
  // Defence in depth per the ruling section 4.3: the AMBIGUOUS path should
  // only ever be reached when output_tokens is under the ceiling. This
  // proves the new check does not interfere with, mask, or bypass that
  // pre-existing refusal when the ceiling was never actually hit.
  const complete = JSON.stringify(wellFormedResponse());
  const decoy = '{"note":"an example shape, not the answer"}';
  const response = `Here is an example shape: ${decoy}\n\nAnd here is the real answer: ${complete}`;
  const client = stubClientReturning(response, { output_tokens: 4000 });
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 0 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RETRIES_EXHAUSTED');
      assert.equal(error.details.last_code, 'MALFORMED_RESPONSE');
      assert.equal(error.details.last_details.candidate_object_count, 2);
      return true;
    },
  );
});

test('provider_usage takes priority over usage, matching providerResponseMetadata\'s own precedence', async () => {
  const client = {
    messages: {
      async create() {
        return {
          content: [{ text: JSON.stringify(wellFormedResponse()) }],
          // A caller-normalised `provider_usage` field reporting overflow
          // must win even though the raw SDK-shaped `usage` field looks
          // fine, matching providerResponseMetadata's existing precedence
          // (provider_usage ?? usage).
          provider_usage: { output_tokens: 70000 },
          usage: { output_tokens: 100 },
        };
      },
    },
  };
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 0 }),
    (error) => {
      assert.equal(error.code, 'RESPONSE_TRUNCATED_BY_OUTPUT_CEILING');
      assert.equal(error.details.last_details.observed_output_tokens, 70000);
      return true;
    },
  );
});
