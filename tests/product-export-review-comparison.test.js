'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  exportReviewComparisonInputs, runExportReviewComparisonInputs, ExportInputsError,
} = require('../scripts/product/export-review-comparison-inputs');

const V1_RUN_ID = '11111111-1111-4111-8111-111111111111';
const V2_RUN_ID = '22222222-2222-4222-8222-222222222222';

function draftAnalysis({ nodes = [], spans = [], proposals = [] } = {}) {
  return {
    kind: 'draftAnalysis',
    agreement_structure: { nodes },
    spans,
    proposals,
  };
}

function fakeStore({ v1Analysis, v2Analysis, review }) {
  const analysisByRun = { [V1_RUN_ID]: v1Analysis, [V2_RUN_ID]: v2Analysis };
  return {
    async getAgreementAnalysis(runId) {
      if (!(runId in analysisByRun)) throw new Error('analysis run not found');
      return analysisByRun[runId];
    },
    async getReview({ runId }) {
      if (runId !== V1_RUN_ID) return null;
      return review;
    },
  };
}

const NODES = [
  { node_id: 'n31', reference: '3.2' },
  { node_id: 'n55', reference: '4.5' },
];

const V1_SPANS = [
  { span_id: 's-mae-1', start_byte: 157, end_byte: 349, exact_text: 'war and terrorism carve-out text' },
  { span_id: 's-mc-1', start_byte: 100000, end_byte: 100275, exact_text: 'material contract threshold text' },
  { span_id: 's-unused', start_byte: 1, end_byte: 2, exact_text: 'z' },
];

const V1_ITEMS = [
  {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', kind: 'PROPOSAL', item_id: 'item-mae',
    decision: 'ACCEPTED', comment: 'Reads correctly against the signed agreement.', reviewed_at: '2026-08-10T00:00:00Z',
    structure_node_id: 'n31', family_key: 'MAE_DEFINITION', source_closure_id: 'c1', source_span_ids: ['s-mae-1'],
    original: { proposal_id: 'p-mae-1', statement: 'The MAE definition excludes war, terrorism and sabotage.', source_span_ids: ['s-mae-1'] },
    edited_statement: null,
  },
  {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', kind: 'PROPOSAL', item_id: 'item-mc',
    decision: 'PENDING', comment: 'Double check the ordinary-course carve-out is captured too.', reviewed_at: null,
    structure_node_id: 'n55', family_key: 'MATERIAL_CONTRACTS', source_closure_id: 'c2', source_span_ids: ['s-mc-1'],
    original: { proposal_id: 'p-mc-1', statement: 'A Material Contract exceeds $10,000,000.', source_span_ids: ['s-mc-1'] },
    edited_statement: null,
  },
  {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', kind: 'PROPOSAL', item_id: 'item-untouched',
    decision: 'PENDING', comment: null, reviewed_at: null,
    structure_node_id: 'n31', family_key: 'MAE_DEFINITION', source_closure_id: 'c1', source_span_ids: ['s-unused'],
    original: { proposal_id: 'p-untouched-1', statement: 'Not yet reviewed.', source_span_ids: ['s-unused'] },
    edited_statement: null,
  },
];

function baseReview(items = V1_ITEMS) {
  return { version: 1, status: 'DRAFT', state: { items } };
}

const V2_PROPOSAL_WITH_TREE = {
  proposal_id: 'p-mae-2', structure_node_id: 'n31', family_key: 'MAE_DEFINITION', subtype_key: 'EXCLUSION',
  statement: 'The MAE definition excludes war, terrorism and sabotage, including cyber-attacks.',
  validation_status: 'VALID',
  headline: { label: 'MAE carve-out', distinguishing_component_ids: ['c-war'] },
  components: [{ component_id: 'c-war', kind: 'LIST', label: 'war', text: 'war', origin: 'OWN', start_byte: 157, end_byte: 349, children: [] }],
};

const V2_PROPOSAL_NO_TREE = {
  proposal_id: 'p-v1-shape', structure_node_id: 'n55', family_key: 'MATERIAL_CONTRACTS', subtype_key: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
  statement: 'A Material Contract exceeds $10,000,000.', validation_status: 'VALID',
};

function v2Analysis(proposals) {
  return draftAnalysis({ nodes: NODES, spans: [], proposals });
}

test('only review items that are decided (non-PENDING) or carry a comment are exported', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE]),
    review: baseReview(),
  });
  const result = await exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID });
  const ids = result.v1Review.items.map((item) => item.item_id);
  assert.deepEqual(ids.sort(), ['item-mae', 'item-mc']);
  assert.equal(result.counts.v1.totalItems, 3);
  assert.equal(result.counts.v1.keptItems, 2);
});

test('exported items carry a section_reference resolved from the analysis structure node', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE]),
    review: baseReview(),
  });
  const result = await exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID });
  const mae = result.v1Review.items.find((item) => item.item_id === 'item-mae');
  const mc = result.v1Review.items.find((item) => item.item_id === 'item-mc');
  assert.equal(mae.section_reference, '3.2');
  assert.equal(mc.section_reference, '4.5');
});

test('the span subset holds only spans cited by kept items, not by dropped items', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE]),
    review: baseReview(),
  });
  const result = await exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID });
  assert.deepEqual(Object.keys(result.v1Review.spans).sort(), ['s-mae-1', 's-mc-1']);
  assert.deepEqual(result.v1Review.spans['s-mae-1'], { start_byte: 157, end_byte: 349, exact_text: 'war and terrorism carve-out text' });
});

test('a run with no stored review state exports zero items and zero spans, without error', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE]),
    review: null,
  });
  const result = await exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID });
  assert.deepEqual(result.v1Review.items, []);
  assert.deepEqual(result.v1Review.spans, {});
});

test('only V2 proposals with a component tree are exported, shaped for compare-review-items.js', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE, V2_PROPOSAL_NO_TREE]),
    review: baseReview(),
  });
  const result = await exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID });
  assert.equal(result.v2Facts.length, 1);
  assert.equal(result.counts.v2.totalProposals, 2);
  assert.equal(result.counts.v2.keptFacts, 1);
  const [fact] = result.v2Facts;
  assert.deepEqual(fact, {
    fact_id: 'p-mae-2',
    structure_node_id: 'n31',
    section_reference: '3.2',
    headline: V2_PROPOSAL_WITH_TREE.headline,
    components: V2_PROPOSAL_WITH_TREE.components,
    family_key: 'MAE_DEFINITION',
    subtype_key: 'EXCLUSION',
    statement: V2_PROPOSAL_WITH_TREE.statement,
    validation_status: 'VALID',
  });
});

test('rejects when the V1 run has no completed analysis', async () => {
  const store = fakeStore({
    v1Analysis: { kind: 'runStatus', status: 'RUNNING' },
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE]),
    review: baseReview(),
  });
  await assert.rejects(
    exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID }),
    ExportInputsError,
  );
});

test('rejects when the V2 run has no proposals with a component tree', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_NO_TREE]),
    review: baseReview(),
  });
  await assert.rejects(
    exportReviewComparisonInputs({ store, v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID }),
    /has no proposals with a component tree/,
  );
});

test('rejects when a run id does not resolve to any analysis at all', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE]),
    review: baseReview(),
  });
  await assert.rejects(
    exportReviewComparisonInputs({ store, v1RunId: 'not-a-real-run', v2RunId: V2_RUN_ID }),
    /could not be read/,
  );
});

test('runExportReviewComparisonInputs writes both files and prints counts using an injected store', async () => {
  const store = fakeStore({
    v1Analysis: draftAnalysis({ nodes: NODES, spans: V1_SPANS }),
    v2Analysis: v2Analysis([V2_PROPOSAL_WITH_TREE, V2_PROPOSAL_NO_TREE]),
    review: baseReview(),
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-review-comparison-'));
  const lines = [];
  const output = { write: (text) => lines.push(text) };
  await runExportReviewComparisonInputs(
    { v1RunId: V1_RUN_ID, v2RunId: V2_RUN_ID, outDir: tmpDir },
    output,
    { createStore: () => store },
  );
  const v1 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'v1-review.json'), 'utf8'));
  const v2 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'v2-facts.json'), 'utf8'));
  assert.equal(v1.items.length, 2);
  assert.equal(v2.length, 1);
  assert.ok(lines.some((line) => line.includes('v1 review items: 2 of 3')));
  assert.ok(lines.some((line) => line.includes('v2 facts: 1 of 2')));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
