'use strict';

/**
 * tests/canonical-v2-transaction-topology-detector.test.js
 *
 * Step 2X-F acceptance: seven hash-verified deals, one right answer each.
 * Detector half only — model-extracted transaction_steps (prompt bump) not
 * required. Zero model calls.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  TOPOLOGIES,
  deriveTopology,
  enforceTransactionStepInvariants,
  CONCURRENCY,
} = require('../lib/schema/topology-detector');
const {
  extractTransactionSteps,
} = require('../lib/parser-v2/detectors/transaction-steps');
const {
  detectTopologyFromAdmittedRun,
} = require('../lib/canonical-v2/sections-for-transaction-detector');

const EVIDENCE = path.join(__dirname, '..', 'evidence', 'canonical-v2');

const SEVEN_DEAL_EXPECTATIONS = Object.freeze([
  Object.freeze({
    deal: 'concho',
    run: 'concho-merger-structure-closing-20260808-r1',
    topology: TOPOLOGIES.SINGLE_MERGER,
    steps: 1,
  }),
  Object.freeze({
    deal: 'metsera',
    run: 'metsera-merger-structure-closing-20260808-r1',
    topology: TOPOLOGIES.SINGLE_MERGER,
    steps: 1,
  }),
  Object.freeze({
    deal: 'redhat',
    run: 'redhat-merger-structure-closing-20260808-r1',
    topology: TOPOLOGIES.SINGLE_MERGER,
    steps: 1,
  }),
  Object.freeze({
    deal: 'skechers',
    run: 'skechers-merger-structure-closing-20260808-rung3',
    topology: TOPOLOGIES.SINGLE_MERGER,
    steps: 1,
  }),
  Object.freeze({
    deal: 'skywater',
    run: 'skywater-merger-structure-closing-20260808-r1',
    topology: TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC,
    steps: 2,
  }),
  Object.freeze({
    deal: 'topbuild',
    run: 'topbuild-merger-structure-closing-20260808-rung4',
    topology: TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC,
    steps: 2,
  }),
  Object.freeze({
    deal: 'modiv',
    run: 'modiv-merger-structure-20260807-replay',
    topology: TOPOLOGIES.PARALLEL_MERGERS,
    steps: 2,
  }),
]);

test('deriveTopology: zero steps is UNDETERMINED, never silent SINGLE_MERGER', () => {
  const row = deriveTopology([]);
  assert.equal(row.topology, TOPOLOGIES.UNDETERMINED);
  assert.equal(row.step_count, 0);
  assert.equal(row.topology_needs_review, true);
  assert.doesNotThrow(() => enforceTransactionStepInvariants([], row));
});

test('deriveTopology: HoldCo sequential pair is DOUBLE_DUMMY; without HoldCo is REVERSE_TRIANGULAR_THEN_LLC', () => {
  const steps = [
    {
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub 1',
      surviving_entity: 'First Surviving Corporation',
      parent_entity: 'Parent',
    },
    {
      step_order: 2,
      step_kind: 'SUBSEQUENT_MERGER',
      disappearing_entity: 'First Surviving Corporation',
      surviving_entity: 'Merger Sub 2',
      parent_entity: 'Parent',
    },
  ];
  assert.equal(deriveTopology(steps).topology, TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC);
  assert.equal(
    deriveTopology(steps, { holdCo: true }).topology,
    TOPOLOGIES.DOUBLE_DUMMY,
  );
});

test('deriveTopology: parallel concurrency yields PARALLEL_MERGERS without chaining warnings', () => {
  const steps = [
    {
      step_order: 1,
      step_kind: 'MERGER',
      concurrency: CONCURRENCY.PARALLEL,
      disappearing_entity: 'Company',
      surviving_entity: 'Company Merger Sub',
    },
    {
      step_order: 2,
      step_kind: 'MERGER',
      concurrency: CONCURRENCY.PARALLEL,
      disappearing_entity: 'OpCo Merger Sub',
      surviving_entity: 'Partnership',
    },
  ];
  const row = deriveTopology(steps, { parallel: true });
  assert.equal(row.topology, TOPOLOGIES.PARALLEL_MERGERS);
  const { warnings } = enforceTransactionStepInvariants(steps, row);
  assert.deepEqual(warnings, []);
});

test('skechers-shaped antitrust "the offer" does not invent a tender topology', () => {
  const text = [
    'Section 2.01 The Merger. Merger Sub shall be merged with and into the Company.',
    'Section 6.05 Antitrust. If the offer is accepted, take or commit to take such action as may be necessary.',
  ].join(' ');
  const model = extractTransactionSteps([
    { provision_type: 'STRUCT', number: '2.01', title: 'The Merger', text },
    { provision_type: 'STRUCT', number: '6.05', title: 'Antitrust', text },
  ]);
  assert.equal(model.topology.topology, TOPOLOGIES.SINGLE_MERGER);
  assert.equal(model.steps.length, 1);
});

test('no merger language yields UNDETERMINED rather than a invented single step', () => {
  const text = 'Section 9.01 Notices. All notices shall be in writing.';
  const model = extractTransactionSteps([
    { provision_type: 'STRUCT', number: '9.01', title: 'Notices', text },
  ]);
  assert.equal(model.topology.topology, TOPOLOGIES.UNDETERMINED);
  assert.equal(model.steps.length, 0);
});

test('named Titanium/Forward mergers classify as REVERSE_TRIANGULAR_THEN_LLC', () => {
  const text = [
    '“Titanium Merger” means the merger of Titanium Merger Sub with and into the Company.',
    '“Forward Merger” means the merger of the Titanium Surviving Corporation with and into Forward Merger Sub.',
    'Titanium Merger Sub shall be merged with and into the Company at the Titanium Merger Effective Time.',
    'Immediately following the Titanium Merger, at the Forward Merger Effective Time, the Titanium Surviving Corporation shall be merged with and into Forward Merger Sub.',
  ].join(' ');
  const model = extractTransactionSteps(
    [{ provision_type: 'STRUCT', number: '2.01', title: 'The Mergers', text }],
    { fullCleanedText: text },
  );
  assert.equal(model.topology.topology, TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC);
  assert.equal(model.steps.length, 2);
  assert.deepEqual(model.steps.map((s) => s.step_name), ['Titanium Merger', 'Forward Merger']);
  assert.equal(model.warnings.length, 0);
});

test('Company/OpCo contemporaneous mergers classify as PARALLEL_MERGERS', () => {
  const text = [
    '“Company Merger” means the merger of the Company with and into Company Merger Sub.',
    '“OpCo Merger” means the merger of OpCo Merger Sub with and into the Partnership.',
    'The Company shall be merged with and into Company Merger Sub at the Company Merger Effective Time.',
    'OpCo Merger Sub shall be merged with and into the Partnership at the OpCo Merger Effective Time.',
    'The parties shall cause the Company Merger Effective Time and the OpCo Merger Effective Time to occur on the Closing Date, with the OpCo Merger Effective Time occurring contemporaneously with or immediately after the Company Merger Effective Time.',
  ].join(' ');
  const model = extractTransactionSteps(
    [{ provision_type: 'STRUCT', number: '2.01', title: 'The Mergers', text }],
    { fullCleanedText: text },
  );
  assert.equal(model.topology.topology, TOPOLOGIES.PARALLEL_MERGERS);
  assert.equal(model.steps.length, 2);
  assert.equal(model.warnings.length, 0);
});

test('production extractor applies cited R4 model-step precedence and rejects ambiguous timing', () => {
  const text = [
    '“Company Merger” means the merger of the Company with and into Company Merger Sub.',
    '“OpCo Merger” means the merger of OpCo Merger Sub with and into the Partnership.',
    'The Company shall be merged with and into Company Merger Sub at the Company Merger Effective Time.',
    'OpCo Merger Sub shall be merged with and into the Partnership at the OpCo Merger Effective Time.',
    'Unless otherwise agreed in writing, the parties shall cause the Company Merger Effective Time and the OpCo Merger Effective Time to occur on the Closing Date, with the OpCo Merger Effective Time occurring contemporaneously with or immediately after the Company Merger Effective Time.',
  ].join(' ');
  const step = ({ section_reference = '1.1', step_order, disappearing_entity, surviving_entity, raw_value }) => ({
    section_reference,
    resolved_claim_definition_key: 'MERGER_TRANSACTION_STEP',
    claim: {
      raw_value,
      attributes: {
        step_order,
        step_kind: 'MERGER',
        disappearing_entity,
        surviving_entity,
        parent_entity: null,
        concurrency: 'SEQUENTIAL',
      },
    },
  });
  const model = extractTransactionSteps(
    [{ provision_type: 'STRUCT', number: '1.1', title: 'The Mergers', text }],
    {
      fullCleanedText: text,
      resolvedModelClaims: [
        step({
          step_order: 1,
          disappearing_entity: 'Company',
          surviving_entity: 'Surviving Company',
          raw_value: 'the Company shall be merged with and into Company Merger Sub and the separate existence of the Company shall thereupon cease and Company Merger Sub shall survive the Company Merger (the “Surviving Company”)',
        }),
        step({
          step_order: 2,
          disappearing_entity: 'OpCo Merger Sub',
          surviving_entity: 'Surviving OpCo',
          raw_value: 'OpCo Merger Sub shall be merged with and into the Partnership and the separate existence of OpCo Merger Sub shall thereupon cease and the Partnership shall be the surviving entity in the OpCo Merger (the “Surviving OpCo”)',
        }),
        {
          section_reference: '1.4',
          resolved_claim_definition_key: 'MERGER_STRUCTURE_MECHANIC_PRESENT',
          claim: {
            raw_value: 'Unless otherwise agreed in writing, the parties shall cause the Company Merger Effective Time and the OpCo Merger Effective Time to occur on the Closing Date, with the OpCo Merger Effective Time occurring contemporaneously with or immediately after the Company Merger Effective Time.',
            attributes: { assertion_kind: 'CLOSING_TIMING' },
          },
        },
        step({
          section_reference: '1.6',
          step_order: 3,
          disappearing_entity: 'Duplicate Merger Sub',
          surviving_entity: 'Duplicate Survivor',
          raw_value: 'Duplicate Merger Sub merges and Duplicate Survivor survives.',
        }),
      ],
    },
  );
  assert.equal(model.topology.topology, TOPOLOGIES.MULTI_STEP_REORG);
  assert.equal(model.topology.step_source, 'MODEL_EXTRACTED');
  assert.equal(model.topology.topology_needs_review, true);
  assert.deepEqual(model.steps.map((entry) => entry.step_order), [1, 2]);
});

test('seven-deal hash-verified corpus: one right answer each', () => {
  for (const row of SEVEN_DEAL_EXPECTATIONS) {
    const model = detectTopologyFromAdmittedRun(path.join(EVIDENCE, row.run));
    assert.equal(
      model.topology.topology,
      row.topology,
      `${row.deal}: expected ${row.topology}, got ${model.topology.topology}`,
    );
    assert.equal(model.steps.length, row.steps, `${row.deal}: step count`);
    assert.equal(model.topology.step_source, 'DETECTOR_INFERRED');
    assert.equal(model.topology.topology_needs_review, true);
    if (row.steps === 2 && row.topology !== TOPOLOGIES.PARALLEL_MERGERS) {
      assert.equal(model.warnings.length, 0, `${row.deal}: chaining warnings`);
    }
  }
});
