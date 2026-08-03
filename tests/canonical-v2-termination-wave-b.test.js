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
      section_reference: '8.1',
      quote,
      detail: 'automatic extension date',
      extension_mode: 'AUTOMATIC',
      extension_period_quote: 'extended to April 30, 2026',
    }],
    open_world_candidates: [],
  }, quote);
  assert.strictEqual(waveB(output.proposals).length, 1);
  assert.strictEqual(waveB(output.proposals)[0].raw_value, quote);
  assert.strictEqual(waveB(output.proposals)[0].canonical_value, null);
  assert.match(waveB(output.proposals)[0].attributes.why_unmapped, /^OUTSIDE_DATE_EXTENSION:/);
  assert.deepEqual(waveB(output.proposals)[0].attributes.structured_mechanic, {
    surface: 'OUTSIDE_DATE_EXTENSION',
    section_reference: '8.1',
    extension_mode: 'AUTOMATIC',
    electing_party: null,
    consent_requirement_quote: null,
    trigger_quote: null,
    maximum_exercises: null,
    extension_period_quote: 'extended to April 30, 2026',
  });
}

{
  const quote = 'if payment is not made when due, interest shall accrue at the Applicable Rate.';
  const output = shapeTerminationFeeProposals({
    fee_amount_assertions: [],
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    wave_b_mechanics: [{
      surface: 'LATE_PAYMENT_INTEREST',
      section_reference: '8.3',
      quote,
      detail: 'interest applies after a late payment',
      benchmark_quote: 'Applicable Rate',
      due_date_reference_quote: 'when due',
    }],
    open_world_candidates: [],
  }, quote);
  assert.strictEqual(waveB(output.proposals).length, 1);
  assert.strictEqual(waveB(output.proposals)[0].raw_value, quote);
  assert.strictEqual(waveB(output.proposals)[0].canonical_value, null);
  assert.match(waveB(output.proposals)[0].attributes.why_unmapped, /^LATE_PAYMENT_INTEREST:/);
  assert.deepEqual(waveB(output.proposals)[0].attributes.structured_mechanic, {
    surface: 'LATE_PAYMENT_INTEREST',
    section_reference: '8.3',
    interest_present: true,
    benchmark_quote: 'Applicable Rate',
    due_date_reference_quote: 'when due',
  });
}

{
  const quote = 'payment of the Termination Fee shall be the sole and exclusive remedy, except in the case of Fraud or Willful Breach.';
  const output = shapeTerminationFeeProposals({
    fee_amount_assertions: [], fee_trigger_assertions: [], tail_period_assertions: [],
    wave_b_mechanics: [{
      surface: 'SOLE_REMEDY', section_reference: '8.3', quote,
      detail: 'sole remedy with two separate exceptions',
      payment_context_quote: 'payment of the Termination Fee',
      remedy_effect_quote: 'shall be the sole and exclusive remedy',
      carve_outs: [
        { kind: 'FRAUD', quote: 'Fraud' },
        { kind: 'WILLFUL_BREACH', quote: 'Willful Breach' },
      ],
    }],
    open_world_candidates: [],
  }, quote);
  const item = waveB(output.proposals)[0];
  assert.match(item.attributes.why_unmapped, /^SOLE_REMEDY_EVIDENCE:/);
  assert.equal(item.attributes.structured_mechanic.owner_family, 'SPECIFIC_PERFORMANCE_REMEDIES');
  assert.deepEqual(item.attributes.structured_mechanic.carve_outs.map((entry) => entry.kind), ['FRAUD', 'WILLFUL_BREACH']);
}

{
  const quote = 'within twelve months after termination, if an Acquisition Proposal is consummated.';
  const output = shapeTerminationFeeProposals({
    fee_amount_assertions: [], fee_trigger_assertions: [], tail_period_assertions: [],
    wave_b_mechanics: [{
      surface: 'TAIL_FEE_STRUCTURE', section_reference: '8.3', quote,
      detail: 'structured tail', period_quote: 'within twelve months after termination',
      arming_event_quote: 'after termination',
      qualifying_transaction_quote: 'an Acquisition Proposal is consummated',
      threshold_quote: null, same_proposal_requirement_quote: null,
    }],
    open_world_candidates: [],
  }, quote);
  const mechanic = waveB(output.proposals)[0].attributes.structured_mechanic;
  assert.equal(mechanic.period_quote, 'within twelve months after termination');
  assert.equal(mechanic.arming_event_quote, 'after termination');
  assert.equal(mechanic.qualifying_transaction_quote, 'an Acquisition Proposal is consummated');
  assert.equal(Object.hasOwn(mechanic, 'effective_threshold'), false);
}

console.log('canonical-v2 termination wave B tests passed');
