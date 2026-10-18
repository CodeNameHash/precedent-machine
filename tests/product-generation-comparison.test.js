'use strict';

// Phase 6: the V1 against V2 comparison (lib/product/generation-comparison.js)
// on a fixture of one agreement in two generations: three sections, one
// shared structure, V1 one-sentence facts citing spans, V2 layered facts
// with component bytes. Checks the pairing on bytes, the four kinds of
// difference the report names (routing, held, new to V2, no counterpart),
// the V1 review notes, the by-table part and the Markdown.

const assert = require('node:assert/strict');
const test = require('node:test');

const { compareGenerations, renderGenerationComparison, spanRanges, factRanges, statusForShare } = require('../lib/product/generation-comparison');
const tableShapes = require('../contracts/product/table-shapes.v3.json');
const legalSchema = require('../contracts/product/legal-schema.v2.json');

const node = (id, reference, order, title) => ({ node_id: id.repeat(64), reference, authored_order: order, title, kind: 'SECTION' });
const NODE_A = 'a'.repeat(64);
const NODE_B = 'b'.repeat(64);
const NODE_C = 'c'.repeat(64);
const structure = { structure_id: 's'.repeat(64), nodes: [node('a', '6.3', 1, 'No solicitation'), node('b', '8.3', 2, 'Termination fee'), node('c', '9.1', 3, 'Notices')] };

function v1Fact(id, nodeId, family, subtype, statement, spanIds, status = 'VALID') {
  return { proposal_id: id.padEnd(64, '0'), structure_node_id: nodeId, family_key: family, subtype_key: subtype, fact_type: subtype, statement, roles: {}, canonical_value: null, source_span_ids: spanIds, validation_status: status };
}

function component(id, text, start, end, origin = 'OWN', kind = 'OPERATION') {
  return { component_id: id, kind, label: id, text, origin, start_byte: start, end_byte: end, source_span_id: 'x'.repeat(64), gap_before: false, children: [] };
}

function v2Fact(id, nodeId, family, subtype, label, components, extra = {}) {
  return { proposal_id: id.padEnd(64, '0'), structure_node_id: nodeId, family_key: family, subtype_key: subtype, fact_type: subtype, statement: label, roles: {}, canonical_value: null, source_span_ids: ['x'.repeat(64)], validation_status: 'VALID', headline: { label, distinguishing_component_ids: [] }, components, ...extra };
}

const v1Analysis = {
  schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: '00000000-0000-4000-8000-000000000001', status: 'READY', legal_schema_version: 'LEGAL_SCHEMA/V1',
  source_document: { source_document_id: 'd'.repeat(64), retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000100000001/ex21.htm' },
  agreement_structure: structure,
  sections: [
    { structure_node_id: NODE_A, section_reference: '6.3', disposition: 'FAMILY_ASSIGNED', families: ['NO_SHOP'] },
    { structure_node_id: NODE_B, section_reference: '8.3', disposition: 'FAMILY_ASSIGNED', families: ['TERMINATION_FEE', 'TERMINATION'] },
    { structure_node_id: NODE_C, section_reference: '9.1', disposition: 'IMMATERIAL', families: [] },
  ],
  proposals: [
    v1Fact('v1-prohibit', NODE_A, 'NO_SHOP', 'PROHIBITED_ACTION', 'The Company shall not solicit proposals.', ['p'.repeat(64)]),
    v1Fact('v1-exception', NODE_A, 'NO_SHOP', 'EXCEPTION_PREREQUISITE', 'The Company may furnish information on a superior proposal.', ['e'.repeat(64)]),
    v1Fact('v1-orphan', NODE_A, 'NO_SHOP', 'NOTICE_PERIOD', 'The Company shall notify Parent within 24 hours.', ['n'.repeat(64)]),
    v1Fact('v1-fee', NODE_B, 'TERMINATION_FEE', 'FEE_AMOUNT', 'The Company shall pay $50,000,000.', ['f'.repeat(64)]),
    v1Fact('v1-outside', NODE_B, 'TERMINATION', 'OUTSIDE_DATE', 'Either party may terminate after the Outside Date.', ['o'.repeat(64)]),
    v1Fact('v1-held', NODE_B, 'TERMINATION', 'BREACH', 'A held V1 fact.', ['o'.repeat(64)], 'INVALID'),
  ],
  proposition_groups: [], fact_links: [], coverage_assertions: [
    { coverage_assertion_id: '1'.repeat(64), structure_node_id: NODE_B, family_key: 'TERMINATION', subject_kind: 'FAMILY', state: 'FOUND' },
  ],
  issues: [{ issue_id: 'i'.repeat(64), code: 'ROLE_MISSING', proposal_id: 'v1-held'.padEnd(64, '0'), structure_node_id: NODE_B, state: 'OPEN' }],
  spans: [
    { span_id: 'p'.repeat(64), structure_node_id: NODE_A, kind: 'OPERATIVE', start_byte: 100, end_byte: 140 },
    { span_id: 'e'.repeat(64), structure_node_id: NODE_A, kind: 'OPERATIVE', start_byte: 150, end_byte: 200 },
    { span_id: 'n'.repeat(64), structure_node_id: NODE_A, kind: 'OPERATIVE', start_byte: 300, end_byte: 340 },
    { span_id: 'f'.repeat(64), structure_node_id: NODE_B, kind: 'OPERATIVE', start_byte: 500, end_byte: 540 },
    { span_id: 'o'.repeat(64), structure_node_id: NODE_B, kind: 'OPERATIVE', start_byte: 600, end_byte: 650 },
  ],
};

const v2Analysis = {
  ...v1Analysis, analysis_run_id: '00000000-0000-4000-8000-000000000002', legal_schema_version: 'LEGAL_SCHEMA/V2',
  sections: [
    { structure_node_id: NODE_A, section_reference: '6.3', disposition: 'FAMILY_ASSIGNED', families: ['NO_SHOP', 'KEY_DEFINED_TERMS'], widened_families: ['KEY_DEFINED_TERMS'] },
    { structure_node_id: NODE_B, section_reference: '8.3', disposition: 'FAMILY_ASSIGNED', families: ['TERMINATION_FEE'] },
    { structure_node_id: NODE_C, section_reference: '9.1', disposition: 'IMMATERIAL', families: [] },
  ],
  proposals: [
    // The whole V1 prohibition's bytes: MATCHED.
    v2Fact('v2-prohibit', NODE_A, 'NO_SHOP', 'PROHIBITED_ACTION', 'No-shop prohibition', [component('c1', 'The Company shall not solicit proposals.', 100, 140)], { headline: { label: 'No-shop prohibition', summary: 'Company may not solicit', distinguishing_component_ids: [] } }),
    // A fifth of the V1 exception's bytes: PARTIAL.
    v2Fact('v2-exception', NODE_A, 'NO_SHOP', 'EXCEPTION_PREREQUISITE', 'Fiduciary exception', [component('c2', 'superior', 190, 200)]),
    // New to V2 on bytes no V1 fact cites.
    v2Fact('v2-new', NODE_A, 'KEY_DEFINED_TERMS', 'SUPERIOR_PROPOSAL', 'Superior Proposal definition', [component('c3', '“Superior Proposal” means', 400, 430, 'OWN', 'DEFINED_TERM')]),
    // Held in V2 over the V1 notice fact's bytes.
    { ...v2Fact('v2-held', NODE_A, 'NO_SHOP', 'NOTICE_PERIOD', 'Notice period', [component('c4', 'within 24 hours', 320, 335)]), validation_status: 'INVALID' },
    // A readout: a termination fee row.
    v2Fact('v2-fee', NODE_B, 'TERMINATION_FEE', 'FEE_AMOUNT', 'Company termination fee amount', [component('c5a', 'The Company shall pay', 500, 520), component('c5', '$50,000,000', 520, 531, 'OWN', 'AMOUNT')], {
      conclusions: { row_label: 'Company termination fee', cells: { amount: { kind: 'value', label: '$50,000,000', tone: 'neutral', component_ids: ['c5'] } } },
    }),
  ],
  coverage_assertions: [{ coverage_assertion_id: '2'.repeat(64), structure_node_id: NODE_B, family_key: 'TERMINATION', subject_kind: 'FAMILY', state: 'NOT_FOUND' }],
  issues: [{ issue_id: 'j'.repeat(64), code: 'INVALID_FACT_COMPONENTS', proposal_id: 'v2-held'.padEnd(64, '0'), structure_node_id: NODE_A, state: 'OPEN' }],
  spans: [{ span_id: 'x'.repeat(64), structure_node_id: NODE_A, kind: 'FULL_SECTION', start_byte: 0, end_byte: 1000 }],
};

const v1Review = { version: 3, state: { status: 'DRAFT', items: [
  { kind: 'PROPOSAL', item_id: '1'.repeat(64), source_id: 'v1-prohibit'.padEnd(64, '0'), decision: 'EDITED', edited_statement: 'The Company shall not solicit Acquisition Proposals.', comment: 'Use the defined term.' },
  { kind: 'PROPOSAL', item_id: '2'.repeat(64), source_id: 'v1-orphan'.padEnd(64, '0'), decision: 'PENDING', comments: [{ text: 'Is this the notice period?' }] },
  { kind: 'PROPOSAL', item_id: '3'.repeat(64), source_id: 'v1-fee'.padEnd(64, '0'), decision: 'PENDING' },
] } };

test('byte helpers: spans merge, a layered fact uses its own component bytes, status thresholds', () => {
  const spans = new Map(v1Analysis.spans.map((span) => [span.span_id, span]));
  assert.deepEqual(spanRanges(['p'.repeat(64), 'e'.repeat(64)], spans), [[100, 140], [150, 200]]);
  assert.deepEqual(factRanges(v2Analysis.proposals[0], new Map()), [[100, 140]]);
  assert.deepEqual(factRanges({ components: [], source_span_ids: ['p'.repeat(64)] }, spans), [[100, 140]]);
  assert.equal(statusForShare(0.5), 'MATCHED');
  assert.equal(statusForShare(0.2), 'PARTIAL');
  assert.equal(statusForShare(0), 'UNMATCHED');
});

test('the comparison pairs V1 facts with V2 facts on bytes and names every difference', () => {
  const model = compareGenerations({ v1: { analysis: v1Analysis, review: v1Review }, v2: { analysis: v2Analysis, review: null }, tableShapes, legalSchema });
  assert.equal(model.structure_shared, true);
  assert.deepEqual(model.runs.v1, { ...model.runs.v1, proposals: 6, valid: 5, held: 1, layered: 0 });
  assert.deepEqual(model.runs.v2, { ...model.runs.v2, proposals: 5, valid: 4, held: 1, layered: 4 });
  assert.deepEqual(model.totals, {
    v1_valid: 5, v2_valid: 4, v1_matched: 2, v1_partial: 1, v1_unmatched: 2, v1_unmatched_held_in_v2: 1,
    v2_new: 1, v2_held: 1, v1_held: 1, routing_same: 1, routing_differs: 2,
  });

  const noShop = model.sections.find((section) => section.reference === '6.3');
  assert.deepEqual(noShop.routing.added, ['KEY_DEFINED_TERMS']);
  assert.deepEqual(noShop.routing.dropped, []);
  assert.match(noShop.explanation[0], /V2 adds KEY_DEFINED_TERMS \(widened by code: KEY_DEFINED_TERMS\)/);
  const byV1 = Object.fromEntries(noShop.pairs.map((pair) => [pair.v1_id.replace(/0+$/, ''), pair]));
  assert.equal(byV1['v1-prohibit'].status, 'MATCHED');
  assert.equal(byV1['v1-prohibit'].matches[0].headline, 'Company may not solicit');
  assert.deepEqual(byV1['v1-prohibit'].review, { decision: 'EDITED', comments: ['Use the defined term.'], edited_statement: 'The Company shall not solicit Acquisition Proposals.' });
  assert.equal(byV1['v1-exception'].status, 'PARTIAL');
  assert.equal(byV1['v1-exception'].matches[0].share, 0.2);
  assert.equal(byV1['v1-orphan'].status, 'UNMATCHED');
  assert.equal(byV1['v1-orphan'].held_in_v2.length, 1);
  assert.deepEqual(byV1['v1-orphan'].held_in_v2[0].codes, ['INVALID_FACT_COMPONENTS']);
  assert.deepEqual(byV1['v1-orphan'].review, { decision: 'PENDING', comments: ['Is this the notice period?'], edited_statement: null });
  assert.equal(noShop.v2_only.length, 1);
  assert.equal(noShop.v2_only[0].family_key, 'KEY_DEFINED_TERMS');
  assert.equal(noShop.v2_held.length, 1);

  const fee = model.sections.find((section) => section.reference === '8.3');
  assert.deepEqual(fee.routing.dropped, ['TERMINATION']);
  assert.equal(fee.pairs.find((pair) => pair.v1_id.startsWith('v1-outside')).status, 'UNMATCHED');
  assert.equal(fee.pairs.find((pair) => pair.v1_id.startsWith('v1-outside')).held_in_v2.length, 0);
  assert.equal(fee.pairs.find((pair) => pair.v1_id.startsWith('v1-held')).status, 'HELD_IN_V1');
  assert.deepEqual(fee.pairs.find((pair) => pair.v1_id.startsWith('v1-held')).v1_issues, ['ROLE_MISSING']);
  assert.deepEqual(fee.coverage_differences, [{ family_key: 'TERMINATION', v1: 'FOUND', v2: 'NOT_FOUND' }]);

  const notices = model.sections.find((section) => section.reference === '9.1');
  assert.equal(notices.routing.same, true);
  assert.equal(notices.pairs.length, 0);

  const family = model.families.find((entry) => entry.family_key === 'TERMINATION');
  assert.deepEqual(family, { ...family, v1_valid: 1, v1_unmatched: 1, v2_valid: 0, v2_held: 0, v2_new: 0 });

  const feeTables = model.tables.find((section) => section.section_key === 'termination-fees');
  assert.ok(feeTables, 'the V2 fee fact lands on the termination fees table');
  const row = feeTables.tables.flatMap((table) => table.rows).find((candidate) => candidate.subject === 'Company termination fee');
  assert.ok(row);
  assert.equal(row.v1_counterparts.length, 1);
  assert.equal(row.v1_counterparts[0].statement, 'The Company shall pay $50,000,000.');
  assert.equal(row.v1_counterparts[0].reference, '8.3');
  assert.deepEqual(feeTables.v1_without_v2_counterpart, [], 'the outside date fact is TERMINATION, not a fee');
  assert.deepEqual(model.families_without_table, [{ family_key: 'TERMINATION', v1_valid: 1, v1_unmatched: 1, v2_valid: 0, v2_held: 0 }]);
});

test('the Markdown report names the runs, the counts and each section\'s differences', () => {
  const model = compareGenerations({ v1: { analysis: v1Analysis, review: v1Review }, v2: { analysis: v2Analysis, review: null }, tableShapes, legalSchema });
  const report = renderGenerationComparison(model);
  assert.match(report, /^# V1 to V2 generation comparison: https:\/\/www\.sec\.gov\//);
  assert.match(report, /\| Valid facts \| 5 \| 4 \|/);
  assert.match(report, /\| No V2 counterpart \| 2 \|/);
  assert.match(report, /### 6\.3 No solicitation/);
  assert.match(report, /routing differs: V2 adds KEY_DEFINED_TERMS/);
  assert.match(report, /→ MATCHED 100%: "Company may not solicit" \[NO_SHOP\/PROHIBITED_ACTION\]/);
  assert.match(report, /V1 review: EDITED, edited to "The Company shall not solicit Acquisition Proposals\."; "Use the defined term\."/);
  assert.match(report, /→ UNMATCHED; V2 held "Notice period: within 24 hours" over these bytes \(INVALID_FACT_COMPONENTS\)/);
  assert.match(report, /- V2 only \[KEY_DEFINED_TERMS\/SUPERIOR_PROPOSAL\]/);
  assert.match(report, /coverage differs for TERMINATION \(FOUND in V1, NOT_FOUND in V2\)/);
  assert.match(report, /## By table/);
  assert.match(report, /- Company termination fee \(1 V2 facts, 8\.3\) ← V1: 8\.3 "The Company shall pay \$50,000,000\." \(MATCHED 78%\)/);
  assert.match(report, /Families with V1 facts and no V2 table:\n\n- TERMINATION: 1 V1 facts \(1 without a V2 counterpart\); V2 0 valid, 0 held/);
  assert.doesNotMatch(report, /### 9\.1/, 'a section with nothing to say is left out');
});

test('without table shapes the report has no table part, and a bare analysis pair still compares', () => {
  const model = compareGenerations({ v1: { analysis: v1Analysis }, v2: { analysis: v2Analysis } });
  assert.equal(model.tables, null);
  assert.equal(model.v1_review_notes, 0);
  assert.doesNotMatch(renderGenerationComparison(model), /## By table/);
  assert.throws(() => compareGenerations({ v1: {}, v2: { analysis: v2Analysis } }), /v1\.analysis and v2\.analysis are required/);
});
