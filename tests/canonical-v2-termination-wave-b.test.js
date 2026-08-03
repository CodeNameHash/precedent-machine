'use strict';

const assert = require('assert');
const {
  shapeTerminationProposals,
  shapeTerminationFeeProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

function waveB(proposals) {
  return proposals.filter((proposal) => proposal.claim_definition_key === 'OPEN_WORLD_PROPOSITION');
}

{
  const quote = 'the End Date will be automatically extended to April 30, 2026.';
  const output = shapeTerminationProposals({
    termination_right_assertions: [],
    wave_b_mechanics: [{
      surface: 'OUTSIDE_DATE_EXTENSION',
      quote,
      detail: 'automatic extension date',
    }],
    open_world_candidates: [],
  }, quote);
  assert.strictEqual(waveB(output.proposals).length, 1);
  assert.strictEqual(waveB(output.proposals)[0].raw_value, quote);
  assert.strictEqual(waveB(output.proposals)[0].canonical_value, null);
  assert.match(waveB(output.proposals)[0].attributes.why_unmapped, /^OUTSIDE_DATE_EXTENSION:/);
}

{
  const quote = 'if payment is not made when due, interest shall accrue at the Applicable Rate.';
  const output = shapeTerminationFeeProposals({
    fee_amount_assertions: [],
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    wave_b_mechanics: [{
      surface: 'LATE_PAYMENT_INTEREST',
      quote,
      detail: 'interest applies after a late payment',
    }],
    open_world_candidates: [],
  }, quote);
  assert.strictEqual(waveB(output.proposals).length, 1);
  assert.strictEqual(waveB(output.proposals)[0].raw_value, quote);
  assert.strictEqual(waveB(output.proposals)[0].canonical_value, null);
  assert.match(waveB(output.proposals)[0].attributes.why_unmapped, /^LATE_PAYMENT_INTEREST:/);
}

console.log('canonical-v2 termination wave B tests passed');
