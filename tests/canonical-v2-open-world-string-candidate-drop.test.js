'use strict';

// A model that emits open-world candidates as BARE STRINGS must lose them
// LOUDLY, as recorded evidence residuals -- never silently.
//
// `shapeOpenWorldCandidate` returned a bare `null` for any non-object
// candidate until 2026-08-08, while the branch immediately below it recorded
// its own drop. So string-typed candidates vanished without trace.
//
// This is not a hypothetical shape. Re-parsing the Step 2F2 baseline
// recordings showed the ANTITRUST_REGULATORY baseline had emitted 3
// open-world candidates and the SPECIFIC_PERFORMANCE_REMEDIES baseline 5 --
// every one a bare string, every one destroyed here. Those runs were then
// recorded in the evidence as having produced ZERO open-world rows, and that
// apparent zero is part of what the 2F2 probe was built to explain. The
// prompts showed `"open_world_candidates":[]` with no element schema, giving
// the model no format to copy, so string emission was the predictable
// failure -- and this drop made it invisible.
//
// The open-world channel exists precisely so content the taxonomy cannot
// express is still captured. A silent drop on that path defeats its only
// purpose, which is why the fix records rather than merely returns.

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');

const SOURCE_TEXT =
  'SECTION 3.1. Capitalization. (a) The authorized capital stock of the Company '
  + 'consists of 100,000,000 shares. As of the Closing Date, the representations '
  + 'shall be true.';

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'test-deal:open-world-string-candidate-drop',
  section_reference: '3.1',
  governed_intervals: ['3.1'],
  source_text: SOURCE_TEXT,
});
const DEFINITIONS = Object.freeze({ known_definitions: [] });

const VERBATIM = 'the representations shall be true.';

function responseWith(openWorldCandidates) {
  return JSON.stringify({
    representation_instances: [],
    bring_down_conditions: [],
    open_world_candidates: openWorldCandidates,
  });
}

function stubClientReturning(text) {
  return { messages: { async create() { return { content: [{ text }] }; } } };
}

async function run(openWorldCandidates) {
  const provider = createAnthropicProvider({
    client: stubClientReturning(responseWith(openWorldCandidates)),
    model: 'test-model',
    maxRetries: 0,
  });
  return produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    provider,
  });
}

const residualReasons = (out) => (out.evidence_residuals || []).map((r) => r.reason);

test('a bare-string open-world candidate is recorded as a residual, not silently dropped', async () => {
  const out = await run([VERBATIM]);
  assert.ok(
    residualReasons(out).includes('OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT'),
    'a string candidate must leave a residual naming why it was dropped -- it used to leave nothing, '
      + 'which is how two Step 2F2 baselines came to be recorded as having produced zero open-world rows '
      + `when they had in fact emitted eight between them. Got: ${JSON.stringify(residualReasons(out))}`,
  );
});

test('the residual carries the dropped text, so the loss is diagnosable afterwards', async () => {
  const out = await run([VERBATIM]);
  const residual = (out.evidence_residuals || [])
    .find((r) => r.reason === 'OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT');
  assert.ok(residual, 'expected the residual to exist');
  assert.ok(
    String(residual.quote_preview).includes('representations shall be true'),
    'a residual that does not carry what was dropped tells a later reader that something was lost '
      + 'without telling them what, which is barely better than losing it',
  );
});

test('a well-formed object candidate is unaffected -- it compiles, and leaves no residual', async () => {
  // The fix must not turn a working path into a noisy one. This is the shape
  // every prompt is supposed to produce.
  const out = await run([{
    observed_quote: VERBATIM,
    why_unmapped: 'no mapped concept in this fixture',
    nearest_concept: null,
  }]);
  assert.ok(out.proposals.length > 0, 'a valid object candidate must still compile into a proposal');
  assert.ok(
    !residualReasons(out).includes('OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT'),
    'a valid candidate must not be reported as a malformed drop',
  );
});

test('null and undefined entries stay silent -- absence is not a drop', async () => {
  // An empty slot carries no content, so there is nothing to report losing.
  // Recording it would make every run with a sparse array look lossy, and a
  // residual list that cries wolf stops being read.
  const out = await run([null, undefined]);
  assert.deepEqual(
    residualReasons(out).filter((r) => r === 'OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT'),
    [],
    'null/undefined entries must not be recorded as dropped content',
  );
});

test('a string candidate whose text is NOT in the source still records the drop', async () => {
  // The drop is recorded on SHAPE, before any byte-verification of the quote.
  // A string that also fails verification must not fall through the gap
  // between the two checks and vanish the way it used to.
  const out = await run(['language that appears nowhere in the source text']);
  assert.ok(
    residualReasons(out).includes('OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT'),
    'shape is checked before quote verification, so an unverifiable string must still be recorded',
  );
});
