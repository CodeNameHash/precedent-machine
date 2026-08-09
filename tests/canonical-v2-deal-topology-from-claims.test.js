'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { TOPOLOGIES, CONCURRENCY } = require('../lib/schema/topology-detector');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const {
  MERGER_TRANSACTION_STEP_CLAIM_KEY,
  shapeMergerStructureProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  STEP_SOURCES,
  mergeDealTopology,
  mergeDealTopologyAcrossCitedSections,
  stepsFromModelClaims,
} = require('../lib/canonical-v2/deal-topology-from-claims');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const CONTRACT = compileFixtureContractV42();

const SINGLE_STEP_SOURCE = [
  'Section 1.1 The Merger.',
  'At the Effective Time, Merger Sub shall merge with and into the Company,',
  'the separate corporate existence of Merger Sub shall cease,',
  'and the Company shall continue as the Surviving Corporation.',
].join('\n');

const TWO_STEP_SOURCE = [
  'Section 1.1 The Titanium Merger.',
  'At the Titanium Merger Effective Time, Titanium Merger Sub shall merge with and into the Company,',
  'the separate corporate existence of Titanium Merger Sub shall cease,',
  'and the Company shall continue as Titanium Surviving Corporation.',
  'Section 1.2 The Forward Merger.',
  'At the Forward Merger Effective Time, Titanium Surviving Corporation shall merge with and into Forward Merger Sub,',
  'the separate corporate existence of Titanium Surviving Corporation shall cease.',
].join('\n');

const PARALLEL_SOURCE = [
  'Section 1.1 The Operating Partnership Merger.',
  'The Operating Partnership Merger and the Merger shall be consummated simultaneously.',
  'At the Operating Partnership Merger Effective Time, Merger Sub OP shall merge with and into the Operating Partnership.',
  'At the Merger Effective Time, Merger Sub shall merge with and into the Company.',
].join('\n');

test('shapeMergerStructureProposals mints byte-verified transaction step claims', () => {
  const quote = 'At the Effective Time, Merger Sub shall merge with and into the Company,';
  const shaped = shapeMergerStructureProposals({
    structure_assertions: [],
    structure_mechanics: [],
    transaction_steps: [{
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub',
      surviving_entity: 'Company',
      parent_entity: null,
      concurrency: 'SEQUENTIAL',
      quote,
    }],
    open_world_candidates: [],
  }, SINGLE_STEP_SOURCE);

  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, MERGER_TRANSACTION_STEP_CLAIM_KEY);
  assert.equal(shaped.proposals[0].attributes.step_kind, 'MERGER');
  assert.equal(shaped.proposals[0].attributes.step_order, 1);
  assert.equal(shaped.evidence_residuals.length, 0);
});

test('shapeMergerStructureProposals drops unverified transaction step quotes', () => {
  const shaped = shapeMergerStructureProposals({
    structure_assertions: [],
    structure_mechanics: [],
    transaction_steps: [{
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub',
      surviving_entity: 'Surviving Corporation',
      parent_entity: null,
      quote: 'this quote is not in the source text',
    }],
    open_world_candidates: [],
  }, SINGLE_STEP_SOURCE);

  assert.equal(shaped.proposals.length, 0);
  assert.equal(shaped.evidence_residuals[0].reason, 'MERGER_TRANSACTION_STEP_QUOTE_UNVERIFIED');
});

async function resolveTransactionSteps(sourceText, transactionSteps, { dealKey = null, sectionReferences = ['1.1'] } = {}) {
  const resolvedDealKey = dealKey || `deal:topology-${sha256Hex(sourceText).slice(0, 16)}`;
  const admitted = buildIdentityAdmittedSourceContext(sourceText, {
    dealKey: resolvedDealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${resolvedDealKey}`),
  });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: sectionReferences,
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      // Per-section calls only see that section's text. Pass only steps whose
      // quote appears in-scope so peer steps are not dropped as unverified.
      const inScope = transactionSteps.filter((step) => governedScope.source_text.includes(step.quote));
      const shaped = shapeMergerStructureProposals({
        structure_assertions: [],
        structure_mechanics: [],
        transaction_steps: inScope,
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'topology-transaction-step-test/v1',
        model_id: 'recorded-response',
        prompt: 'topology-transaction-step-test/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admitted,
  });
}

test('resolver finalizes MERGER_TRANSACTION_STEP claims with topology attributes', async () => {
  const quote = 'At the Effective Time, Merger Sub shall merge with and into the Company,';
  const resolution = await resolveTransactionSteps(SINGLE_STEP_SOURCE, [{
    step_order: 1,
    step_kind: 'MERGER',
    disappearing_entity: 'Merger Sub',
    surviving_entity: 'Company',
    parent_entity: null,
    concurrency: 'SEQUENTIAL',
    quote,
  }]);

  const claims = resolution.resolved.filter(
    (row) => row.resolved_claim_definition_key === 'MERGER_TRANSACTION_STEP',
  );
  assert.equal(claims.length, 1);
  assert.equal(resolution.residuals.length, 0);
  assert.equal(claims[0].claim.attributes.step_kind, 'MERGER');
  assert.equal(claims[0].claim.attributes.step_order, 1);
  assert.equal(claims[0].concept_key, 'MERGER-STRUCTURE');
});

test('resolver clears an unquoted optional parent without weakening required entity grounding', async () => {
  const quote = 'At the Effective Time, Merger Sub shall merge with and into the Company,';
  const resolution = await resolveTransactionSteps(SINGLE_STEP_SOURCE, [{
    step_order: 1,
    step_kind: 'MERGER',
    disappearing_entity: 'Merger Sub',
    surviving_entity: 'Company',
    parent_entity: 'Parent',
    concurrency: 'SEQUENTIAL',
    quote,
  }]);
  const claims = resolution.resolved.filter(
    (row) => row.resolved_claim_definition_key === 'MERGER_TRANSACTION_STEP',
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].claim.attributes.parent_entity, null);
});

test('resolver holds transaction steps when either required entity is absent from the quote', async () => {
  const quote = 'At the Effective Time, Merger Sub shall merge with and into the Company,';
  const resolution = await resolveTransactionSteps(SINGLE_STEP_SOURCE, [{
    step_order: 1,
    step_kind: 'MERGER',
    disappearing_entity: 'Absent Merger Sub',
    surviving_entity: 'Company',
    parent_entity: null,
    concurrency: 'SEQUENTIAL',
    quote,
  }]);
  assert.equal(resolution.resolved.filter(
    (row) => row.resolved_claim_definition_key === 'MERGER_TRANSACTION_STEP',
  ).length, 0);
  assert.equal(resolution.open_world[0].reason, 'MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE');
});

function citedTopologyStep({
  sectionReference = '1.1',
  stepOrder,
  disappearingEntity,
  survivingEntity,
  quote,
  concurrency = 'SEQUENTIAL',
} = {}) {
  return {
    section_reference: sectionReference,
    resolved_claim_definition_key: 'MERGER_TRANSACTION_STEP',
    claim: {
      raw_value: quote,
      attributes: {
        step_order: stepOrder,
        step_kind: 'MERGER',
        disappearing_entity: disappearingEntity,
        surviving_entity: survivingEntity,
        parent_entity: null,
        concurrency,
      },
    },
  };
}

function citedClosingTiming({ sectionReference = '1.4', quote } = {}) {
  return {
    section_reference: sectionReference,
    resolved_claim_definition_key: 'MERGER_STRUCTURE_MECHANIC_PRESENT',
    claim: { raw_value: quote, attributes: { assertion_kind: 'CLOSING_TIMING' } },
  };
}

function primaryParallelSteps() {
  return [
    citedTopologyStep({
      stepOrder: 1,
      disappearingEntity: 'Company',
      survivingEntity: 'Surviving Company',
      quote: 'the Company shall be merged with and into Company Merger Sub and the separate existence of the Company shall thereupon cease and Company Merger Sub shall survive the Company Merger (the “Surviving Company”)',
    }),
    citedTopologyStep({
      stepOrder: 2,
      disappearingEntity: 'OpCo Merger Sub',
      survivingEntity: 'Surviving OpCo',
      quote: 'OpCo Merger Sub shall merge with and into the Partnership, and Surviving OpCo shall continue.',
    }),
  ];
}

test('cross-section merge uses cited 1.1 steps and unambiguous cited 1.4 timing only', () => {
  const merged = mergeDealTopologyAcrossCitedSections({
    modelClaims: [
      ...primaryParallelSteps(),
      citedTopologyStep({
        sectionReference: '1.6',
        stepOrder: 3,
        disappearingEntity: 'Duplicate Merger Sub',
        survivingEntity: 'Duplicate Survivor',
        quote: 'Duplicate Merger Sub merges and Duplicate Survivor survives.',
      }),
      citedClosingTiming({
        quote: 'The Company Merger Effective Time and OpCo Merger Effective Time shall occur contemporaneously.',
      }),
    ],
  });
  assert.equal(merged.topology, TOPOLOGIES.PARALLEL_MERGERS);
  assert.equal(merged.step_source, STEP_SOURCES.MODEL_EXTRACTED);
  assert.equal(merged.step_count, 2);
  assert.deepEqual(merged.transaction_steps.map((step) => step.step_order), [1, 2]);
});

test('HOSTILE: ambiguous 1.4 contemporaneous-or-immediately-after timing does not promote parallel', () => {
  const merged = mergeDealTopologyAcrossCitedSections({
    modelClaims: [
      ...primaryParallelSteps(),
      citedClosingTiming({
        quote: 'Unless otherwise agreed in writing, the parties shall cause the Company Merger Effective Time and the OpCo Merger Effective Time to occur on the Closing Date, with the OpCo Merger Effective Time occurring contemporaneously with or immediately after the Company Merger Effective Time.',
      }),
    ],
  });
  assert.equal(merged.topology, TOPOLOGIES.MULTI_STEP_REORG);
  assert.equal(merged.transaction_steps.every((step) => step.concurrency === CONCURRENCY.SEQUENTIAL), true);
});

test('HOSTILE: an alternative sequential timing in cited 1.4 does not promote parallel', () => {
  const merged = mergeDealTopologyAcrossCitedSections({
    modelClaims: [
      ...primaryParallelSteps(),
      citedClosingTiming({
        quote: 'The Company Merger Effective Time and OpCo Merger Effective Time shall occur contemporaneously or sequentially, as agreed by the parties.',
      }),
    ],
  });
  assert.equal(merged.topology, TOPOLOGIES.MULTI_STEP_REORG);
});

test('HOSTILE: absent required primary entity rejects the whole primary set and unrelated timing cannot promote parallel', () => {
  const fallback = [{
    step_order: 1,
    step_kind: 'MERGER',
    disappearing_entity: 'Fallback Merger Sub',
    surviving_entity: 'Fallback Survivor',
    parent_entity: null,
    concurrency: CONCURRENCY.SEQUENTIAL,
  }];
  const merged = mergeDealTopologyAcrossCitedSections({
    modelClaims: [
      ...primaryParallelSteps(),
      citedTopologyStep({
        stepOrder: 3,
        disappearingEntity: 'Absent Entity',
        survivingEntity: 'Surviving Company',
        quote: 'A different entity shall merge and Surviving Company shall continue.',
      }),
      citedClosingTiming({
        sectionReference: '1.5',
        quote: 'The Company Merger Effective Time and OpCo Merger Effective Time shall occur contemporaneously.',
      }),
    ],
    detectorSteps: fallback,
  });
  assert.equal(merged.step_source, STEP_SOURCES.DETECTOR_INFERRED);
  assert.equal(merged.topology, TOPOLOGIES.SINGLE_MERGER);
});

test('mergeDealTopology prefers model steps over detector and flags detector fallback', () => {
  const modelClaims = [{
    claim_definition_key: 'MERGER_TRANSACTION_STEP',
    attributes: {
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub',
      surviving_entity: 'Surviving Corporation',
      parent_entity: 'Parent',
      concurrency: CONCURRENCY.SEQUENTIAL,
    },
  }];
  const detectorSteps = [
    {
      step_order: 1,
      step_kind: 'TENDER_OFFER',
      disappearing_entity: 'Shares',
      surviving_entity: 'Parent',
      parent_entity: 'Parent',
      concurrency: CONCURRENCY.SEQUENTIAL,
    },
    {
      step_order: 2,
      step_kind: 'BACK_END_MERGER',
      disappearing_entity: 'Company',
      surviving_entity: 'Merger Sub',
      parent_entity: 'Parent',
      concurrency: CONCURRENCY.SEQUENTIAL,
    },
  ];

  const merged = mergeDealTopology({ modelClaims, detectorSteps });
  assert.equal(merged.step_source, STEP_SOURCES.MODEL_EXTRACTED);
  assert.equal(merged.topology, TOPOLOGIES.SINGLE_MERGER);
  assert.equal(merged.step_count, 1);
  assert.equal(merged.topology_needs_review, true);
  assert.equal(merged.detector_topology, TOPOLOGIES.TWO_STEP_TENDER);
});

test('mergeDealTopology uses detector when model steps are absent', () => {
  const detectorSteps = [
    {
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Titanium Merger Sub',
      surviving_entity: 'Titanium Surviving Corporation',
      parent_entity: 'Parent',
      concurrency: CONCURRENCY.SEQUENTIAL,
    },
    {
      step_order: 2,
      step_kind: 'SUBSEQUENT_MERGER',
      disappearing_entity: 'Titanium Surviving Corporation',
      surviving_entity: 'Forward Merger Sub',
      parent_entity: 'Parent',
      concurrency: CONCURRENCY.SEQUENTIAL,
    },
  ];
  const merged = mergeDealTopology({ modelClaims: [], detectorSteps });
  assert.equal(merged.step_source, STEP_SOURCES.DETECTOR_INFERRED);
  assert.equal(merged.topology, TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC);
  assert.equal(merged.topology_needs_review, true);
});

test('mergeDealTopology resolves parallel dual mergers from model steps', () => {
  const modelClaims = [
    {
      claim_definition_key: 'MERGER_TRANSACTION_STEP',
      attributes: {
        step_order: 1,
        step_kind: 'MERGER',
        disappearing_entity: 'Merger Sub OP',
        surviving_entity: 'Operating Partnership',
        parent_entity: 'Parent',
        concurrency: CONCURRENCY.PARALLEL,
      },
    },
    {
      claim_definition_key: 'MERGER_TRANSACTION_STEP',
      attributes: {
        step_order: 2,
        step_kind: 'MERGER',
        disappearing_entity: 'Merger Sub',
        surviving_entity: 'Company',
        parent_entity: 'Parent',
        concurrency: CONCURRENCY.PARALLEL,
      },
    },
  ];
  const merged = mergeDealTopology({ modelClaims });
  assert.equal(merged.topology, TOPOLOGIES.PARALLEL_MERGERS);
  assert.equal(merged.step_source, STEP_SOURCES.MODEL_EXTRACTED);
  assert.equal(merged.topology_needs_review, false);
});

test('mergeDealTopology returns UNDETERMINED when neither source has steps', () => {
  const merged = mergeDealTopology({});
  assert.equal(merged.topology, TOPOLOGIES.UNDETERMINED);
  assert.equal(merged.step_source, STEP_SOURCES.UNDETERMINED);
});

test('stepsFromModelClaims sorts by step_order', () => {
  const claims = [
    {
      claim_definition_key: 'MERGER_TRANSACTION_STEP',
      attributes: { step_order: 2, step_kind: 'SUBSEQUENT_MERGER' },
    },
    {
      claim_definition_key: 'MERGER_TRANSACTION_STEP',
      attributes: { step_order: 1, step_kind: 'MERGER' },
    },
  ];
  const steps = stepsFromModelClaims(claims);
  assert.deepEqual(steps.map((step) => step.step_order), [1, 2]);
});

test('two-step chained model claims resolve to REVERSE_TRIANGULAR_THEN_LLC', async () => {
  // parent_entity stays null unless the supporting quote names Parent —
  // handleMergerTransactionStepCandidate corroborates every non-null entity
  // into the quote before resolving.
  const resolution = await resolveTransactionSteps(TWO_STEP_SOURCE, [
    {
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Titanium Merger Sub',
      surviving_entity: 'Titanium Surviving Corporation',
      parent_entity: null,
      quote: [
        'At the Titanium Merger Effective Time, Titanium Merger Sub shall merge with and into the Company,',
        'the separate corporate existence of Titanium Merger Sub shall cease,',
        'and the Company shall continue as Titanium Surviving Corporation.',
      ].join('\n'),
    },
    {
      step_order: 2,
      step_kind: 'SUBSEQUENT_MERGER',
      disappearing_entity: 'Titanium Surviving Corporation',
      surviving_entity: 'Forward Merger Sub',
      parent_entity: null,
      quote: 'At the Forward Merger Effective Time, Titanium Surviving Corporation shall merge with and into Forward Merger Sub,',
    },
  ], { sectionReferences: ['1.1', '1.2'] });
  const claims = resolution.resolved.filter(
    (row) => row.resolved_claim_definition_key === 'MERGER_TRANSACTION_STEP',
  );
  assert.equal(claims.length, 2);
  const merged = mergeDealTopology({ modelClaims: claims });
  assert.equal(merged.topology, TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC);
  assert.equal(merged.step_count, 2);
  assert.equal(merged.warnings.length, 0);
});

test('parallel model claims shaped from fixture-like source', async () => {
  const resolution = await resolveTransactionSteps(PARALLEL_SOURCE, [
    {
      step_order: 1,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub OP',
      surviving_entity: 'Operating Partnership',
      parent_entity: null,
      concurrency: 'PARALLEL',
      quote: 'At the Operating Partnership Merger Effective Time, Merger Sub OP shall merge with and into the Operating Partnership.',
    },
    {
      step_order: 2,
      step_kind: 'MERGER',
      disappearing_entity: 'Merger Sub',
      surviving_entity: 'Company',
      parent_entity: null,
      concurrency: 'PARALLEL',
      quote: 'At the Merger Effective Time, Merger Sub shall merge with and into the Company.',
    },
  ]);
  const claims = resolution.resolved.filter(
    (row) => row.resolved_claim_definition_key === 'MERGER_TRANSACTION_STEP',
  );
  assert.equal(claims.length, 2);
  const merged = mergeDealTopology({ modelClaims: claims });
  assert.equal(merged.topology, TOPOLOGIES.PARALLEL_MERGERS);
});
