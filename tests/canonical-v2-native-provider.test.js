'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const { compileCandidateProposals } = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const {
  createAnthropicProvider,
  NativeProducerAnthropicError,
  shapeProposals,
  QUALIFIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  SHARE_COUNT_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

// ---------------------------------------------------------------------------
// Shared fixture: a small source text plus a well-formed model response whose
// quotes are exact substrings of it, so evidence spans byte-verify.
// ---------------------------------------------------------------------------

const SOURCE_TEXT =
  'SECTION 3.1. Capitalization. (a) The authorized capital stock of the Company '
  + 'consists of 100,000,000 shares. (b) Except as set forth in Schedule 3.1, '
  + 'there are no outstanding options. As of the Closing Date, the representations '
  + 'shall be true.';

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'test-deal:native-anthropic-provider',
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

function stubClientReturning(text) {
  return {
    messages: {
      async create() {
        return { content: [{ text }] };
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

test('a well-formed stubbed response compiles end to end through provider-interface + candidate-proposal-compiler', async () => {
  const client = stubClientReturning(JSON.stringify(wellFormedResponse()));
  const { proposals, producer_receipt: producerReceipt } = await runProvider({ model: 'test-model', client });

  assert.ok(proposals.length >= 4, `expected at least 4 shaped proposals, got ${proposals.length}`);

  const results = compileCandidateProposals({
    proposals,
    governed_scope: GOVERNED_SCOPE,
    producer_receipt: producerReceipt,
    extractor_id: 'native-anthropic-provider-test',
    extractor_version: 'v1',
  });

  for (const result of results) {
    assert.equal(result.ok, true, `proposal failed to compile: ${result.reason_code} ${result.message}`);
    assert.equal(result.candidate.kind, 'claim');
    assert.ok(['VALIDATED', 'QUARANTINED'].includes(result.candidate.claim.publication_state));
  }
});

test('malformed JSON is a typed failure, not an empty success', async () => {
  const client = stubClientReturning('{not valid json at all');
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 0 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RETRIES_EXHAUSTED');
      assert.equal(error.details.last_code, 'MALFORMED_RESPONSE');
      return true;
    },
  );
});

test('native extraction tolerates wrapped JSON: markdown fences, leading prose, and trailing commentary', async () => {
  const complete = JSON.stringify(wellFormedResponse());
  const acceptedResponses = {
    'bare object with incidental surrounding whitespace': `\n ${complete}\t`,
    'fenced in a triple-backtick json code block': `\`\`\`json\n${complete}\n\`\`\``,
    'fenced in a bare triple-backtick block with no language tag': `\`\`\`\n${complete}\n\`\`\``,
    'a leading prose sentence before the object': `Here is the JSON you requested:\n\n${complete}`,
    'trailing commentary after the object': `${complete}\nLet me know if you need anything else!`,
    'leading prose, a fence, and trailing commentary together':
      `Here is the JSON:\n\`\`\`json\n${complete}\n\`\`\`\nHope that helps!`,
  };
  for (const [label, response] of Object.entries(acceptedResponses)) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runProvider({ model: 'test-model', client: stubClientReturning(response) });
    assert.ok(result.proposals.length >= 4, `expected proposals for case: ${label}`);
  }
});

test('native extraction rejects a truncated object and a response with no JSON at all, retaining the raw response', async () => {
  const rejectedResponses = {
    'truncated mid-object': '{"representation_instances":[],"bring_down_conditions":[],"open_world_candidates":[],"truncated":',
    'no JSON object anywhere in the text': 'The model declined to produce structured output for this section.',
  };
  for (const [label, response] of Object.entries(rejectedResponses)) {
    // eslint-disable-next-line no-await-in-loop
    await assert.rejects(
      () => runProvider({ model: 'test-model', client: stubClientReturning(response), maxRetries: 0 }),
      (error) => {
        assert.ok(error instanceof NativeProducerAnthropicError);
        assert.equal(error.code, 'RETRIES_EXHAUSTED');
        assert.equal(error.details.last_code, 'MALFORMED_RESPONSE');
        assert.equal(error.details.provider_output.raw_response_text, response, `raw response preserved for: ${label}`);
        return true;
      },
    );
  }
});

test('two independent JSON objects in one response is ambiguous and fails rather than picking one', async () => {
  const complete = JSON.stringify(wellFormedResponse());
  const decoy = '{"note":"an example shape, not the answer"}';
  const response = `Here is an example shape: ${decoy}\n\nAnd here is the real answer: ${complete}`;
  await assert.rejects(
    () => runProvider({ model: 'test-model', client: stubClientReturning(response), maxRetries: 0 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RETRIES_EXHAUSTED');
      assert.equal(error.details.last_code, 'MALFORMED_RESPONSE');
      assert.equal(error.details.last_details.candidate_object_count, 2);
      assert.equal(
        error.details.provider_output.raw_response_text,
        response,
        'the ambiguous raw response is preserved even though it could not be resolved',
      );
      return true;
    },
  );
});

test('a response missing a required top-level key is a typed failure', async () => {
  const incomplete = { representation_instances: [], open_world_candidates: [] }; // bring_down_conditions missing
  const client = stubClientReturning(JSON.stringify(incomplete));
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 0 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RETRIES_EXHAUSTED');
      assert.equal(error.details.last_code, 'SCHEMA_MISSING_KEY');
      return true;
    },
  );
});

test('an oversized response is a bounded failure, not retried into a longer wait', async () => {
  const oversized = JSON.stringify(wellFormedResponse()).padEnd(500, ' ');
  const client = stubClientReturning(oversized);
  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 2, maxResponseChars: 50 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RESPONSE_TOO_LARGE');
      assert.equal(error.details.attempts, 1, 'an oversized response must not be retried');
      return true;
    },
  );
});

test('a transient call failure followed by success still produces proposals', async () => {
  let calls = 0;
  const client = {
    messages: {
      async create() {
        calls += 1;
        if (calls === 1) throw new Error('ECONNRESET (simulated transient failure)');
        return { content: [{ text: JSON.stringify(wellFormedResponse()) }] };
      },
    },
  };

  const { proposals } = await runProvider({ model: 'test-model', client, maxRetries: 1, retryBackoffMs: 1 });
  assert.equal(calls, 2, 'expected exactly one retry after the transient failure');
  assert.ok(proposals.length >= 4);
});

test('exhausted retries on a persistently failing call surface a typed failure', async () => {
  let calls = 0;
  const client = {
    messages: {
      async create() {
        calls += 1;
        throw new Error('ECONNRESET (simulated persistent failure)');
      },
    },
  };

  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 1, retryBackoffMs: 1 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RETRIES_EXHAUSTED');
      assert.equal(error.details.last_code, 'TRANSIENT_CALL_FAILED');
      assert.equal(error.details.attempts, 2);
      return true;
    },
  );
  assert.equal(calls, 2, 'expected exactly maxRetries + 1 attempts');
});

test('a malformed response is retried, and a later attempt that parses succeeds', async () => {
  let calls = 0;
  const client = {
    messages: {
      async create() {
        calls += 1;
        if (calls === 1) return { content: [{ text: 'Sorry, I cannot produce that right now.' }] };
        return { content: [{ text: JSON.stringify(wellFormedResponse()) }] };
      },
    },
  };

  const { proposals } = await runProvider({
    model: 'test-model', client, maxRetries: 1, retryBackoffMs: 1,
  });
  assert.equal(calls, 2, 'expected exactly one retry after the malformed first response');
  assert.ok(proposals.length >= 4);
});

test('retries exhaust and fail cleanly, preserving the raw response from the final attempt', async () => {
  let calls = 0;
  const client = {
    messages: {
      async create() {
        calls += 1;
        return { content: [{ text: `malformed attempt number ${calls}` }] };
      },
    },
  };

  await assert.rejects(
    () => runProvider({ model: 'test-model', client, maxRetries: 2, retryBackoffMs: 1 }),
    (error) => {
      assert.ok(error instanceof NativeProducerAnthropicError);
      assert.equal(error.code, 'RETRIES_EXHAUSTED');
      assert.equal(error.details.attempts, 3);
      assert.equal(error.details.last_code, 'MALFORMED_RESPONSE');
      assert.equal(
        error.details.provider_output.raw_response_text,
        'malformed attempt number 3',
        'the raw text of the final failed attempt is preserved, not an earlier one',
      );
      return true;
    },
  );
  assert.equal(calls, 3, 'expected exactly maxRetries + 1 attempts, none skipped');
});

test('retry backoff actually delays before the next attempt, rather than retrying instantly', async () => {
  const alwaysMalformedClient = () => ({
    messages: {
      async create() {
        return { content: [{ text: 'not json' }] };
      },
    },
  });

  const zeroBackoffStart = Date.now();
  await assert.rejects(() => runProvider({
    model: 'test-model', client: alwaysMalformedClient(), maxRetries: 2, retryBackoffMs: 0,
  }));
  const zeroBackoffElapsedMs = Date.now() - zeroBackoffStart;

  const baseMs = 40;
  const factor = 2;
  const realBackoffStart = Date.now();
  await assert.rejects(() => runProvider({
    model: 'test-model',
    client: alwaysMalformedClient(),
    maxRetries: 2,
    retryBackoffMs: baseMs,
    retryBackoffFactor: factor,
  }));
  const realBackoffElapsedMs = Date.now() - realBackoffStart;

  // maxRetries: 2 means two retries fire (three attempts total), so two
  // backoff delays are awaited in sequence: baseMs, then baseMs * factor.
  // The assertion uses a generous lower bound rather than the full
  // theoretical sum, so it stays robust against timer-scheduling slop on a
  // loaded machine while still proving the delay is real, not spinning.
  const expectedMinimumMs = (baseMs + baseMs * factor) * 0.7;
  assert.ok(
    realBackoffElapsedMs >= expectedMinimumMs,
    `expected at least ~${expectedMinimumMs}ms with backoff enabled, measured ${realBackoffElapsedMs}ms`,
  );
  assert.ok(
    realBackoffElapsedMs > zeroBackoffElapsedMs,
    `backoff-enabled run (${realBackoffElapsedMs}ms) should take meaningfully longer than `
      + `the zero-backoff run (${zeroBackoffElapsedMs}ms)`,
  );
});

test('the same stubbed response produces a byte-identical receipt and proposal set across two independent runs', async () => {
  const responseText = JSON.stringify(wellFormedResponse());
  const runOnce = () => runProvider({ model: 'test-model', client: stubClientReturning(responseText) });

  const first = await runOnce();
  const second = await runOnce();

  assert.equal(canonicalJson(first.producer_receipt), canonicalJson(second.producer_receipt));
  assert.equal(canonicalJson(first.proposals), canonicalJson(second.proposals));
});

test('with no injected client, no apiKey and no ANTHROPIC_API_KEY, the provider fails closed before any network path is reachable', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      () => runProvider({ model: 'test-model' }),
      (error) => {
        assert.ok(error instanceof NativeProducerAnthropicError);
        assert.equal(error.code, 'MISSING_API_KEY');
        return true;
      },
    );
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  }
});

// Every test above injects a `client` (or, for the MISSING_API_KEY test,
// fails before a client would ever be constructed) -- this file performs no
// network I/O anywhere, by construction, not just by assertion.

test('unverifiable evidence becomes a typed residual bound into the receipt, never a silent drop', async () => {
  const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');

  // A provider run that could not verify one quote.
  const withResidual = await produceCandidateProposals({
    governed_scope: { source_text: 'x', intervals: [] },
    definitions: {},
    contract_bundle: { id: 'b' },
    provider: async () => ({
      provider_id: 'STUB',
      model_id: 'stub-model',
      prompt_digest: 'a'.repeat(64),
      proposals: [],
      evidence_residuals: [
        { reason: 'LIMB_ASSERTION_QUOTE_UNVERIFIED', quote_preview: 'text the model asserted' },
      ],
    }),
  });

  // The same run, if the residual had been silently dropped.
  const withoutResidual = await produceCandidateProposals({
    governed_scope: { source_text: 'x', intervals: [] },
    definitions: {},
    contract_bundle: { id: 'b' },
    provider: async () => ({
      provider_id: 'STUB',
      model_id: 'stub-model',
      prompt_digest: 'a'.repeat(64),
      proposals: [],
      evidence_residuals: [],
    }),
  });

  assert.equal(withResidual.evidence_residuals.length, 1);
  assert.equal(withResidual.evidence_residuals[0].reason, 'LIMB_ASSERTION_QUOTE_UNVERIFIED');
  assert.equal(withResidual.producer_receipt.evidence_residual_count, 1);
  assert.equal(withoutResidual.producer_receipt.evidence_residual_count, 0);

  // The receipt id itself must differ: a run that lost evidence can never be
  // presented as byte-identical to a clean run.
  assert.notEqual(
    withResidual.producer_receipt.producer_receipt_id,
    withoutResidual.producer_receipt.producer_receipt_id,
  );
});

// ---------------------------------------------------------------------------
// limb_path (docs/archive/handoffs/F28-FIRST-LIVE-RUN.md defect 1): nested limbs
// stay inside ONE representation_instance, and a shared trailing label under
// two different parents produces two DISTINCT limb_path values.
// ---------------------------------------------------------------------------

const NESTED_SOURCE_TEXT = 'SECTION 9. Capitalization. (A) Common stock details apply. '
  + '(i) foo common detail here. (B) Preferred stock details apply. (i) foo preferred detail here.';

function nestedLimbResponse() {
  return {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [
        { limb_path: ['(A)'], assertion_quote: 'Common stock details apply.', subject: 'common stock' },
        { limb_path: ['(A)', '(i)'], assertion_quote: 'foo common detail here.', subject: 'common stock detail' },
        { limb_path: ['(B)'], assertion_quote: 'Preferred stock details apply.', subject: 'preferred stock' },
        { limb_path: ['(B)', '(i)'], assertion_quote: 'foo preferred detail here.', subject: 'preferred stock detail' },
      ],
      qualifiers: [],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

test('limb_path round-trips through shaping, and a shared trailing label under two different parents stays distinct', () => {
  const { proposals } = shapeProposals(nestedLimbResponse(), NESTED_SOURCE_TEXT);
  const limbAssertions = proposals.filter((p) => p.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.equal(limbAssertions.length, 4, 'all four limbs (two top-level, two nested) produced one proposal each');

  const byQuote = Object.fromEntries(limbAssertions.map((p) => [p.raw_value, p.attributes.limb_path]));
  assert.deepEqual(byQuote['Common stock details apply.'], ['(A)']);
  assert.deepEqual(byQuote['Preferred stock details apply.'], ['(B)']);
  assert.deepEqual(byQuote['foo common detail here.'], ['(A)', '(i)']);
  assert.deepEqual(byQuote['foo preferred detail here.'], ['(B)', '(i)']);

  // The load-bearing assertion: both nested limbs end in the SAME bare
  // label "(i)", but their full paths are NOT equal -- this is exactly the
  // ambiguity a flat limb_reference could not express (see the F28 live run,
  // where the model reused "(i)" across three unrelated fragments).
  assert.notDeepEqual(byQuote['foo common detail here.'], byQuote['foo preferred detail here.']);

  // All four proposals share ONE subject_occurrence_id: one representation,
  // per defect 1's "exactly one representation_instance per governing
  // section" rule -- nesting lives in limb_path, never in new instances.
  const subjectIds = new Set(limbAssertions.map((p) => p.subject_occurrence_id));
  assert.equal(subjectIds.size, 1);
});

test('a limb with no usable limb_path (e.g. a stale pre-PROMPT_VERSION-2 recording) still shapes, with a null path rather than a guess', () => {
  const staleResponse = {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [{ limb_reference: '(A)', assertion_quote: 'Common stock details apply.', subject: 'common stock' }],
      qualifiers: [],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
  const { proposals } = shapeProposals(staleResponse, NESTED_SOURCE_TEXT);
  const [limbAssertion] = proposals.filter((p) => p.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.ok(limbAssertion, 'the assertion quote still verifies and shapes even without a usable limb_path');
  assert.equal(limbAssertion.attributes.limb_path, null);
});

const ITEM_QUALIFIER_SOURCE_TEXT = 'SECTION 9. Capitalization. (i) As of April 17, 2026, Common stock exists. '
  + '(ii) As of April 17, 2026, Preferred stock exists.';

function itemQualifierResponse(assertionQuote = 'As of April 17, 2026, Preferred stock exists.') {
  return {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [
        { limb_path: ['(i)'], assertion_quote: 'As of April 17, 2026, Common stock exists.', subject: 'common stock' },
        { limb_path: ['(ii)'], assertion_quote: assertionQuote, subject: 'preferred stock' },
      ],
      qualifiers: [{
        kind: 'TEMPORAL',
        code: null,
        quote: 'As of April 17, 2026',
        attachment: {
          position: 'ITEM',
          governs_path: ['(ii)'],
          ambiguity_signals: { items_grammatically_parallel: false },
        },
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

test('an ITEM qualifier with repeated text binds evidence to its unique occurrence in the governed limb', () => {
  const { proposals, evidence_residuals: residuals } = shapeProposals(
    itemQualifierResponse(),
    ITEM_QUALIFIER_SOURCE_TEXT,
  );
  const [qualifier] = proposals.filter((proposal) => proposal.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier);
  assert.equal(
    qualifier.evidence[0].absolute_start,
    Buffer.byteLength(ITEM_QUALIFIER_SOURCE_TEXT.slice(0, ITEM_QUALIFIER_SOURCE_TEXT.lastIndexOf('As of April 17, 2026'))),
  );
  assert.equal(residuals.some((residual) => residual.reason === 'QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS'), false);
});

test('an ITEM qualifier without one governed-limb occurrence emits a typed ambiguity residual and no proposal', () => {
  const source = ITEM_QUALIFIER_SOURCE_TEXT.replace(
    'As of April 17, 2026, Preferred stock exists.',
    'As of April 17, 2026, then As of April 17, 2026, Preferred stock exists.',
  );
  const response = itemQualifierResponse('As of April 17, 2026, then As of April 17, 2026, Preferred stock exists.');
  const { proposals, evidence_residuals: residuals } = shapeProposals(response, source);
  assert.equal(proposals.filter((proposal) => proposal.claim_definition_key === QUALIFIER_CLAIM_KEY).length, 0);
  assert.ok(residuals.some((residual) => residual.reason === 'QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS'));
});

test('a derived none-outstanding zero preserves the exact source bytes', () => {
  const zeroQuote = 'Shares of preferred stock, par value $0.01 per share,\n  none of which were outstanding as of signing';
  const source = `SECTION 9. Capitalization. (i) ${zeroQuote}.`;
  const response = {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [{ limb_path: ['(i)'], assertion_quote: zeroQuote, subject: 'preferred stock' }],
      qualifiers: [],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
    share_count_assertions: [],
  };

  const { proposals, evidence_residuals: residuals } = shapeProposals(response, source);
  const zeroClaims = proposals.filter((proposal) => proposal.claim_definition_key === SHARE_COUNT_CLAIM_KEY);
  assert.equal(zeroClaims.length, 1);
  assert.equal(zeroClaims[0].raw_value, zeroQuote);
  assert.equal(residuals.some((residual) => residual.reason === 'SHARE_COUNT_QUOTE_UNVERIFIED'), false);
});

test('an unverified explicit count cannot suppress a verified derived zero', () => {
  const zeroQuote = 'no shares of Company Preferred Stock were issued and outstanding';
  const source = `SECTION 9. Capitalization. (i) ${zeroQuote}.`;
  const response = {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [{ limb_path: ['(i)'], assertion_quote: zeroQuote, subject: 'preferred stock' }],
      qualifiers: [],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
    share_count_assertions: [{
      section_reference: '9',
      party_making: 'the Company',
      count_kind: 'ISSUED_OUTSTANDING',
      share_class: 'Company Preferred Stock',
      plan: null,
      quote: 'NO SHARES OF COMPANY PREFERRED STOCK WERE ISSUED AND OUTSTANDING',
      limb_path: ['(i)'],
    }],
  };

  const { proposals, evidence_residuals: residuals } = shapeProposals(response, source);
  const zeroClaims = proposals.filter((proposal) => proposal.claim_definition_key === SHARE_COUNT_CLAIM_KEY);
  assert.equal(zeroClaims.length, 1);
  assert.equal(zeroClaims[0].raw_value, zeroQuote);
  assert.ok(residuals.some((residual) => residual.reason === 'SHARE_COUNT_QUOTE_UNVERIFIED'));
});

test('verified explicit and derived zeros deduplicate by evidence rather than section label', () => {
  const zeroQuote = 'no shares of Company Preferred Stock were issued and outstanding';
  const source = `SECTION 9. Capitalization. (i) ${zeroQuote}.`;
  const response = {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [{ limb_path: ['(i)'], assertion_quote: zeroQuote, subject: 'preferred stock' }],
      qualifiers: [],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
    share_count_assertions: [{
      section_reference: '9(i)',
      party_making: 'the Company',
      count_kind: 'ISSUED_OUTSTANDING',
      share_class: 'Company Preferred Stock',
      plan: null,
      quote: zeroQuote,
      limb_path: ['(i)'],
    }],
  };

  const { proposals } = shapeProposals(response, source);
  const zeroClaims = proposals.filter((proposal) => proposal.claim_definition_key === SHARE_COUNT_CLAIM_KEY);
  assert.equal(zeroClaims.length, 1);
  assert.equal(zeroClaims[0].attributes.section_reference, '9(i)');
});

test('a derived zero without one unique governed-limb occurrence fails closed', () => {
  const zeroQuote = 'no shares of Company Preferred Stock were issued and outstanding';
  const source = `SECTION 8. Capitalization. (i) ${zeroQuote}. SECTION 9. Capitalization. (i) ${zeroQuote}.`;
  const response = {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [{ limb_path: ['(i)'], assertion_quote: zeroQuote, subject: 'preferred stock' }],
      qualifiers: [],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
    share_count_assertions: [],
  };

  const { proposals, evidence_residuals: residuals } = shapeProposals(response, source);
  assert.equal(proposals.filter((proposal) => proposal.claim_definition_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  assert.ok(residuals.some((residual) => (
    residual.reason === 'SHARE_COUNT_GOVERNED_LIMB_OCCURRENCE_AMBIGUOUS'
  )));
});

// ---------------------------------------------------------------------------
// Qualifier attachment (docs/archive/handoffs/F28-FIRST-LIVE-RUN.md defect 2): the
// model cannot express a resolved TRAILING reading through the schema --
// scope_reading is always computed here, never taken from the response.
// ---------------------------------------------------------------------------

const TRAILING_SOURCE_TEXT = 'SECTION 9. Capitalization. (i) Common stock exists. (ii) Preferred stock exists. '
  + 'with a fair market value that is material to the Company and its Subsidiaries, taken as a whole.';

function trailingQualifierResponse(extraAttachmentFields = {}) {
  return {
    representation_instances: [{
      section_reference: '9',
      party_making: 'the Company',
      chapeau_quote: 'SECTION 9. Capitalization.',
      limbs: [
        { limb_path: ['(i)'], assertion_quote: 'Common stock exists.', subject: 'common stock' },
        { limb_path: ['(ii)'], assertion_quote: 'Preferred stock exists.', subject: 'preferred stock' },
      ],
      qualifiers: [{
        kind: 'THRESHOLD',
        code: null,
        quote: 'with a fair market value that is material to the Company and its Subsidiaries, taken as a whole.',
        attachment: {
          position: 'TRAILING',
          governs_path: ['(ii)'],
          // A non-conforming model response smuggling in a resolved
          // reading -- the schema has no such field, and even if a
          // malformed provider tried, it must be discarded.
          scope_reading: 'ALL_ITEMS',
          ...extraAttachmentFields,
          ambiguity_signals: { items_grammatically_parallel: true, ...(extraAttachmentFields.ambiguity_signals || {}) },
        },
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

test('a bare TRAILING qualifier is AMBIGUOUS end to end, even if the raw response smuggles in a resolved scope_reading', () => {
  const { proposals } = shapeProposals(trailingQualifierResponse(), TRAILING_SOURCE_TEXT);
  const [qualifier] = proposals.filter((p) => p.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier);
  assert.equal(qualifier.attributes.attachment.scope_reading, 'AMBIGUOUS',
    'the smuggled scope_reading: ALL_ITEMS must never survive -- only the deterministic marker test decides');
  assert.ok(Array.isArray(qualifier.attributes.attachment.readings));
  const series = qualifier.attributes.attachment.readings.find((r) => r.reading === 'SERIES');
  assert.deepEqual(series.governs_paths, [['(i)'], ['(ii)']]);
});

test('a TRAILING qualifier with an explicit series marker resolves ALL_ITEMS through the full shaping path', () => {
  const response = trailingQualifierResponse();
  response.representation_instances[0].qualifiers[0].quote =
    'in each case, with a fair market value that is material to the Company and its Subsidiaries, taken as a whole.';
  const source = TRAILING_SOURCE_TEXT.replace(
    'with a fair market value',
    'in each case, with a fair market value',
  );
  const { proposals } = shapeProposals(response, source);
  const [qualifier] = proposals.filter((p) => p.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.equal(qualifier.attributes.attachment.scope_reading, 'ALL_ITEMS');
  assert.equal(qualifier.attributes.attachment.readings, null);
});

test('a qualifier with a malformed (pre-PROMPT_VERSION-2) attachment is dropped as a typed residual, never guessed at', () => {
  const staleResponse = trailingQualifierResponse();
  staleResponse.representation_instances[0].qualifiers[0].attachment = 'LIMB'; // old flat-string shape
  const { proposals, evidence_residuals: residuals } = shapeProposals(staleResponse, TRAILING_SOURCE_TEXT);
  assert.equal(proposals.filter((p) => p.claim_definition_key === QUALIFIER_CLAIM_KEY).length, 0);
  assert.ok(residuals.some((r) => r.reason === 'QUALIFIER_ATTACHMENT_MALFORMED'));
});
