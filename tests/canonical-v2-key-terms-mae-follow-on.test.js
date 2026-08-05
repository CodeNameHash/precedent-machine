'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESPONSE_SHAPE,
  INSTRUCTIONS,
} = require('../lib/canonical-v2/native-producer/key-terms-mae-follow-on-producer-prompt');
const {
  shapeKeyTermsMaeFollowOnProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

test('the key-terms follow-on prompt excludes MAE disproportionality owned by the MAE definition family', () => {
  assert.doesNotMatch(RESPONSE_SHAPE, /MAE_(?:CLAUSE_DISPROPORTIONALITY|COMPARISON_BASELINE|RENDERED_MECHANIC)/);
  assert.match(INSTRUCTIONS, /MAE definition producer owns MAE disproportionality/);
});

test('a stale MAE follow-on label cannot regain governed status through this open-world route', () => {
  const quote = 'disproportionately affected thereby as compared with other participants in the industries.';
  const output = shapeKeyTermsMaeFollowOnProposals({
    mechanics: [{ surface: 'MAE_CLAUSE_DISPROPORTIONALITY', quote, detail: 'comparison baseline text' }],
    open_world_candidates: [],
  }, quote);
  assert.equal(output.proposals.length, 1);
  assert.equal(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION');
  assert.match(output.proposals[0].attributes.why_unmapped, /^UNCLASSIFIED_SURFACE:/);
});

test('the remaining key-terms follow-on surfaces retain exact evidence', () => {
  const quote = 'Acquisition Proposal uses a twenty percent threshold.';
  const output = shapeKeyTermsMaeFollowOnProposals({
    mechanics: [{ surface: 'ACQUISITION_THRESHOLD', quote, detail: 'twenty percent threshold' }],
    open_world_candidates: [],
  }, quote);
  assert.equal(output.proposals.length, 1);
  assert.equal(output.proposals[0].raw_value, quote);
  assert.match(output.proposals[0].attributes.why_unmapped, /^ACQUISITION_THRESHOLD:/);
});
