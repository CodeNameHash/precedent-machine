const test = require('node:test');
const assert = require('node:assert/strict');

const { extractTransactionSteps } = require('../../../lib/parser-v2/detectors/transaction-steps');

test('General Dynamics-shaped tender deal emits tender offer then back-end merger', () => {
  const text = [
    'Section 1.01 Definitions. "Acceptance Time" has the meaning set forth in Section 2.1(d).',
    'Section 2.1 The Offer. Parent shall cause Merger Sub to commence a tender offer to purchase all Shares. The time Merger Sub accepts Shares for payment is the Acceptance Time.',
    'Section 2.2 The Merger. Following the Acceptance Time, Merger Sub shall merge with and into the Company at the Effective Time.',
  ].join(' ');
  const model = extractTransactionSteps([
    { provision_type: 'DEF', number: '1.01', title: 'Definitions', text, regionId: 'r-def' },
    { provision_type: 'STRUCT', number: '2.1', title: 'The Offer', text, regionId: 'r-offer' },
  ]);

  assert.equal(model.topology.topology, 'TWO_STEP_TENDER');
  assert.equal(model.steps.length, 2);
  assert.equal(model.steps[0].step_kind, 'TENDER_OFFER');
  assert.equal(model.steps[1].step_kind, 'BACK_END_MERGER');
});

test('double-dummy language emits merger then subsequent merger', () => {
  const text = [
    'Section 2.01 The First Merger. Merger Subsidiary 1 shall merge with and into the Company at the First Effective Time.',
    'Immediately following the Effective Time, at the Second Effective Time, the First Surviving Corporation shall merge with and into Merger Subsidiary 2.',
    'The parties intend both Parent and the Company to become subsidiaries of HoldCo.',
  ].join(' ');
  const model = extractTransactionSteps([
    { provision_type: 'STRUCT', number: '2.01', title: 'The Mergers', text, regionId: 'r-struct' },
  ]);

  assert.equal(model.topology.topology, 'DOUBLE_DUMMY');
  assert.equal(model.steps[0].step_kind, 'MERGER');
  assert.equal(model.steps[1].step_kind, 'SUBSEQUENT_MERGER');
  assert.equal(model.steps[1].effective_time_ref, 'Second Effective Time');
});

test('Conoco-shaped single merger control emits one single-merger step', () => {
  const text = [
    'Section 2.01 The Merger. Merger Sub shall be merged with and into the Company.',
    'The separate existence of Merger Sub shall cease and the Company shall continue as the surviving corporation.',
    'The Merger shall become effective at the Effective Time.',
  ].join(' ');
  const model = extractTransactionSteps([
    { provision_type: 'STRUCT', number: '2.01', title: 'The Merger', text, regionId: 'r-struct' },
  ]);

  assert.equal(model.topology.topology, 'SINGLE_MERGER');
  assert.equal(model.steps.length, 1);
  assert.equal(model.steps[0].step_kind, 'MERGER');
});
