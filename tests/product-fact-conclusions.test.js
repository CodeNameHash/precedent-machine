'use strict';

// Tests for FACT_CONCLUSIONS/V1 (contracts/product/fact-conclusions.v1.json),
// the coded per-table readout decided 2026-09-12/13 (Ben) as an additional
// layer on top of FACT_COMPONENTS/V2. lib/product/fact-conclusions.js is
// pure: no database or model access, validated against the real
// table-shapes.v3.json data.
//
// The two hand-written facts below reuse the real span/document identifiers
// from the recorded PRODUCT_ALL_FAMILY_EXTRACTOR/V8 call in
// tests/fixtures/product/ncs-v8-extraction-call.v1.json (also used by
// tests/product-v8-replay.test.js) so this fixture is built on genuine
// run/document/span identity rather than arbitrary strings; the recorded
// call's own single proposal (MERGER_STRUCTURE_CLOSING, a family with no
// table-shapes table) has no conclusions to reuse, so the two
// conclusions-bearing proposals here -- one CONSIDERATION/EQUITY_AWARD
// ("RSUs"), one EMPLOYEE_MATTERS/EMPLOYEE_COMPENSATION ("Base salary") --
// are hand-authored against that same source_document_id/structure_node_id.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateFactConclusions, renderConclusionCells, tableForFact, tablesForFamily, familyHasTableShape, normaliseConclusionValues, formatValue,
} = require('../lib/product/fact-conclusions');

const tableShapes = require('../contracts/product/table-shapes.v3.json');

const record = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures/product/ncs-v8-extraction-call.v1.json'), 'utf8',
));
const SPAN_ID = JSON.parse(record.request.messages[0].content).source_closure.full_section.span_id;

function equityAwardFact() {
  const components = [
    {
      component_id: 'rsu-term', kind: 'TERM', label: 'Equity type', text: 'RSUs', origin: 'OWN',
      source_span_id: SPAN_ID, start_byte: 0, end_byte: 4, gap_before: false, children: [],
    },
    {
      component_id: 'rsu-consideration', kind: 'STANDARD', label: 'consideration',
      text: 'converted into the right to receive one share of Parent common stock for each restricted stock unit',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 5, end_byte: 106, gap_before: true, children: [],
    },
    {
      component_id: 'rsu-vesting', kind: 'STANDARD', label: 'vesting treatment',
      text: 'continues vesting on its existing schedule, subject to double-trigger acceleration',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 107, end_byte: 191, gap_before: true, children: [],
    },
    {
      component_id: 'rsu-cvr', kind: 'STANDARD', label: 'CVR entitlement',
      text: 'is not entitled to any Contingent Value Right',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 192, end_byte: 238, gap_before: true, children: [],
    },
  ];
  return {
    family_key: 'CONSIDERATION',
    subtype_key: 'EQUITY_AWARD',
    headline: { label: 'Equity award', distinguishing_component_ids: ['rsu-term'] },
    components,
    conclusions: {
      table_key: 'equity-awards-table',
      row_label: 'RSUs',
      cells: [
        { column_id: 'consideration', code: 'PARENT_STOCK_ROLLOVER', component_ids: ['rsu-consideration'] },
        { column_id: 'vestingTreatment', code: 'CONTINUES_VESTING_DOUBLE_TRIGGER_PROTECTION', component_ids: ['rsu-vesting'] },
        { column_id: 'cvrEntitlement', code: 'NOT_ENTITLED', component_ids: ['rsu-cvr'] },
      ],
    },
  };
}

function baseSalaryFact() {
  const components = [
    {
      component_id: 'salary-term', kind: 'TERM', label: 'Benefit', text: 'Base salary', origin: 'OWN',
      source_span_id: SPAN_ID, start_byte: 0, end_byte: 11, gap_before: false, children: [],
    },
    {
      component_id: 'salary-comparison', kind: 'OBJECT', label: 'reference group',
      text: 'similarly situated employees of Parent', origin: 'OWN',
      source_span_id: SPAN_ID, start_byte: 12, end_byte: 51, gap_before: true, children: [],
    },
    {
      component_id: 'salary-standard', kind: 'STANDARD', label: 'standard',
      text: 'no less favorable than the base salary in effect immediately prior to the Closing',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 52, end_byte: 135, gap_before: true, children: [],
    },
    {
      component_id: 'salary-period', kind: 'PERIOD', label: 'period',
      text: 'for twelve (12) months following the Closing Date',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 136, end_byte: 187, gap_before: true, children: [],
    },
  ];
  return {
    family_key: 'EMPLOYEE_MATTERS',
    subtype_key: 'EMPLOYEE_COMPENSATION',
    headline: { label: 'Employee compensation', distinguishing_component_ids: ['salary-period'] },
    components,
    conclusions: {
      table_key: 'employee-benefits-table',
      row_label: 'Base salary',
      cells: [
        { column_id: 'comparison', code: 'SIMILARLY_SITUATED_BUYER_EMPLOYEES', component_ids: ['salary-comparison'] },
        { column_id: 'standard', code: 'NO_LESS_FAVORABLE_THAN_CURRENT', component_ids: ['salary-standard'] },
        { column_id: 'period', value: { canonical: 12, unit: 'MONTH' }, component_ids: ['salary-period'] },
      ],
    },
  };
}

test('familyHasTableShape / tablesForFamily reflect table-shapes.v3.json', () => {
  assert.ok(familyHasTableShape('CONSIDERATION', tableShapes));
  assert.ok(familyHasTableShape('EMPLOYEE_MATTERS', tableShapes));
  assert.equal(familyHasTableShape('NOT_A_REAL_FAMILY', tableShapes), false);
  assert.ok(tablesForFamily('CONSIDERATION', tableShapes).length >= 1);
});

test('tableForFact resolves by explicit table_key checked against the fact family', () => {
  const resolved = tableForFact(equityAwardFact(), tableShapes);
  assert.equal(resolved.table.table_key, 'equity-awards-table');
  const mismatched = tableForFact({ family_key: 'TERMINATION', conclusions: { table_key: 'equity-awards-table' } }, tableShapes);
  assert.equal(mismatched, null, 'a table_key belonging to a different family must not resolve');
  const unknown = tableForFact({ family_key: 'CONSIDERATION', conclusions: { table_key: 'not-a-table' } }, tableShapes);
  assert.equal(unknown, null);
});

test('a valid conclusions readout has no problems, for both a vocabulary-only and a value-bearing table', () => {
  assert.deepEqual(validateFactConclusions(equityAwardFact(), { tableShapes }), []);
  assert.deepEqual(validateFactConclusions(baseSalaryFact(), { tableShapes }), []);
});

test('a fact with no conclusions is not a problem: conclusions is an optional layer', () => {
  const fact = equityAwardFact();
  delete fact.conclusions;
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
});

test('an unknown vocabulary code is a problem', () => {
  const fact = equityAwardFact();
  fact.conclusions.cells[0].code = 'NOT_A_REAL_CODE';
  const problems = validateFactConclusions(fact, { tableShapes });
  assert.ok(problems.some((p) => /unknown code "NOT_A_REAL_CODE"/.test(p)), problems.join('; '));
});

test('a value cell whose value does not match the cited component\'s parsed value is a problem', () => {
  const fact = baseSalaryFact();
  fact.conclusions.cells[2].value = { canonical: 99, unit: 'MONTH' };
  const problems = validateFactConclusions(fact, { tableShapes });
  assert.ok(problems.some((p) => /value does not match parseComponentValue/.test(p)), problems.join('; '));
});

test('a cell citing a component from another fact is a problem (not found on this fact)', () => {
  const fact = baseSalaryFact();
  fact.conclusions.cells[0].component_ids = ['rsu-consideration']; // belongs to equityAwardFact(), not this fact
  const problems = validateFactConclusions(fact, { tableShapes });
  assert.ok(problems.some((p) => /rsu-consideration is not part of this fact/.test(p)), problems.join('; '));
});

test('C6: a cited component of a kind outside the column\'s fill_from is accepted (fill_from is advisory)', () => {
  const fact = baseSalaryFact();
  // 'standard' column's fill_from is STANDARD/MATERIALITY_QUALIFIER; salary-comparison is kind OBJECT.
  fact.conclusions.cells[1].component_ids = ['salary-comparison'];
  const problems = validateFactConclusions(fact, { tableShapes });
  assert.deepEqual(problems, []);
});

test('C6: a component_id that is not part of this fact is still a problem', () => {
  const fact = baseSalaryFact();
  fact.conclusions.cells[1].component_ids = ['someone-elses-component'];
  const problems = validateFactConclusions(fact, { tableShapes });
  assert.ok(problems.some((p) => /someone-elses-component is not part of this fact/.test(p)), problems.join('; '));
});

function closingTimingFact(text) {
  return {
    fact_id: 'f-closing', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'CLOSING',
    headline: { label: 'Closing', distinguishing_component_ids: ['closing-when'] },
    components: [{
      component_id: 'closing-when', kind: 'TRIGGER', label: 'timing',
      text: 'on the third Business Day after the satisfaction or waiver of the conditions set forth in Article VII',
      origin: 'OWN', source_span_id: 's-1', start_byte: 0, end_byte: 100, gap_before: false, children: [],
    }],
    conclusions: {
      table_key: 'structure-mechanics-table', row_label: 'Closing',
      cells: [{ column_id: 'closingTiming', text, component_ids: ['closing-when'] }],
    },
  };
}

// The term column (survivingEntityStep1) is verbatim-checked; closingTiming
// is an as-drafted column since decision 34, so only the citation matters there.
function survivorFact(text) {
  const fact = closingTimingFact(text);
  fact.conclusions.cells = [{ column_id: 'survivingEntityStep1', text, component_ids: ['closing-when'] }];
  return fact;
}

test('C4: a verbatim cell may carry a run of words cut from the cited component, never added words', () => {
  assert.deepEqual(validateFactConclusions(survivorFact('on the third Business Day after the satisfaction or waiver of the conditions set forth in Article VII'), { tableShapes }), []);
  assert.deepEqual(validateFactConclusions(survivorFact('third Business Day after the satisfaction or waiver of the conditions'), { tableShapes }), []);
  const cut = validateFactConclusions(survivorFact('hird Business Day'), { tableShapes });
  assert.ok(cut.some((p) => /run of words/.test(p)), cut.join('; '));
  const added = validateFactConclusions(survivorFact('on the third Business Day after closing'), { tableShapes });
  assert.ok(added.some((p) => /run of words/.test(p)), added.join('; '));
  assert.deepEqual(validateFactConclusions(closingTimingFact('on the third Business Day after closing'), { tableShapes }), [], 'an as-drafted cell is not verbatim-checked');
});

test('row_label must be one of the resolved fixed-list table\'s row labels, unless the table is open to new rows', () => {
  const fact = baseSalaryFact();
  fact.conclusions.row_label = 'Not A Real Row';
  // employee-benefits-table is open_rows (decision 22): a new label is accepted.
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
  // The same table closed: the label is a problem.
  const closed = JSON.parse(JSON.stringify(tableShapes));
  for (const section of closed.sections) for (const table of section.tables || []) if (table.table_key === 'employee-benefits-table') delete table.open_rows;
  const problems = validateFactConclusions(fact, { tableShapes: closed });
  assert.ok(problems.some((p) => /is not one of employee-benefits-table's fixed row labels/.test(p)), problems.join('; '));
});

test('renderConclusionCells renders a pill label per vocabulary cell, a formatted value, and a dash for an absent column', () => {
  const rendered = renderConclusionCells(equityAwardFact(), tableShapes);
  assert.equal(rendered.length, 3);
  const consideration = rendered.find((cell) => cell.column_id === 'consideration');
  assert.equal(consideration.pill_label, 'Parent stock / rollover');
  const cvr = rendered.find((cell) => cell.column_id === 'cvrEntitlement');
  assert.equal(cvr.pill_label, 'Not entitled');

  const salaryRendered = renderConclusionCells(baseSalaryFact(), tableShapes);
  const period = salaryRendered.find((cell) => cell.column_id === 'period');
  assert.equal(period.value_text, '12 months');

  const missingCell = baseSalaryFact();
  missingCell.conclusions.cells = missingCell.conclusions.cells.filter((cell) => cell.column_id !== 'period');
  const withDash = renderConclusionCells(missingCell, tableShapes);
  const dash = withDash.find((cell) => cell.column_id === 'period');
  assert.equal(dash.text, '—');
});

test('C3: a period cited from a TRIGGER component parses as the column\'s value kind', () => {
  const fact = baseSalaryFact();
  fact.components.push({ component_id: 'salary-when', kind: 'TRIGGER', label: 'timing', text: 'For a period of one year following the Effective Time', origin: 'OWN', source_span_id: 's', start_byte: 200, end_byte: 250, gap_before: true, children: [] });
  fact.conclusions.cells[2] = { column_id: 'period', value: { canonical: 1, unit: 'YEAR' }, component_ids: ['salary-when'] };
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
});

test('C4: a verbatim run may span adjacent cited components read in order', () => {
  const fact = closingTimingFact('third Business Day after the satisfaction or waiver of the conditions set forth in Article VII');
  fact.components[0].text = 'on the third Business Day after';
  fact.components.push({ component_id: 'closing-cond', kind: 'CONDITION', label: 'condition', text: 'the satisfaction or waiver of the conditions set forth in Article VII', origin: 'OWN', source_span_id: 's-1', start_byte: 101, end_byte: 200, gap_before: false, children: [] });
  fact.conclusions.cells[0].component_ids = ['closing-when', 'closing-cond'];
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
});

// Metsera generation 5 (3.13): a category clause quoted with its nested
// exception, "... Intellectual Property, except for Standard Contracts",
// is a run of the cited components in source order; the comma between
// them is not an added word. Words that are not in the components still are.
test('C4: a run over several cited components tolerates the punctuation between them, never added words', () => {
  const clause = 'each Contract under which the Company grants any material license under or with respect to Intellectual Property, except for Standard Contracts';
  const fact = survivorFact(clause);
  fact.components = [
    { component_id: 'closing-when', kind: 'OBJECT', label: 'category', text: 'each Contract under which the Company grants any material license under or with respect to Intellectual Property', origin: 'OWN', source_span_id: 's-1', start_byte: 0, end_byte: 114, gap_before: false, children: [
      { component_id: 'mat', kind: 'MATERIALITY_QUALIFIER', label: 'material', text: 'material', origin: 'OWN', source_span_id: 's-1', start_byte: 48, end_byte: 56, gap_before: false, children: [] },
    ] },
    { component_id: 'exc', kind: 'EXCEPTION', label: 'exception', text: 'except for Standard Contracts', origin: 'OWN', source_span_id: 's-1', start_byte: 116, end_byte: 145, gap_before: false, children: [] },
  ];
  fact.conclusions.cells[0].component_ids = ['exc', 'mat', 'closing-when'];
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
  fact.conclusions.cells[0].text = clause.replace('except for', 'other than');
  assert.match(validateFactConclusions(fact, { tableShapes })[0], /not the verbatim text/);
});

// C10 (decision 29, Ben 2026-09-13): a merger form cites the merging party,
// the operation, the party merged into and the survivor together.
const structureFact = () => ({
  fact_id: 'st-1', proposal_id: 'st-1', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'MERGER_MECHANICS', section_reference: '1.01',
  headline: { label: 'The Merger', distinguishing_component_ids: ['st-op'] },
  components: [
    { component_id: 'st-actor', kind: 'ACTOR', label: 'merging party', text: 'Merger Sub', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] },
    { component_id: 'st-op', kind: 'OPERATION', label: 'merger', text: 'shall be merged with and into', origin: 'OWN', source_span_id: 's', start_byte: 11, end_byte: 40, gap_before: false, children: [] },
    { component_id: 'st-obj', kind: 'OBJECT', label: 'merged into', text: 'the Company', origin: 'OWN', source_span_id: 's', start_byte: 41, end_byte: 52, gap_before: false, children: [] },
    { component_id: 'st-term', kind: 'TERM', label: 'survivor', text: 'the Company shall continue as the surviving corporation', origin: 'OWN', source_span_id: 's', start_byte: 60, end_byte: 110, gap_before: true, children: [] },
  ],
  conclusions: { table_key: 'structure-mechanics-table', row_label: 'The deal', cells: [
    { column_id: 'mergerFormStep1', code: 'REVERSE_TRIANGULAR_MERGER', component_ids: ['st-actor', 'st-op', 'st-obj', 'st-term'] },
  ] },
});

test('C10: a merger form cited on every basis component is valid; cited on the merging party alone it is a problem', () => {
  assert.deepEqual(validateFactConclusions(structureFact(), { tableShapes }), []);
  const partial = structureFact();
  partial.conclusions.cells[0].component_ids = ['st-actor'];
  const problems = validateFactConclusions(partial, { tableShapes });
  assert.ok(problems.some((p) => /basis incomplete, no cited OPERATION \/ OBJECT \/ TERM component/.test(p)), problems.join('; '));
});

test('a value cell takes the code-parsed value of its cited words: a lookback cited as a date becomes that date and validates', () => {
  const fact = {
    fact_id: 'rep-1', proposal_id: 'rep-1', family_key: 'REPRESENTATIONS', subtype_key: 'COMPLIANCE_REPRESENTATION', section_reference: '3.25',
    headline: { label: 'Compliance', distinguishing_component_ids: ['rep-1-d'] },
    components: [{ component_id: 'rep-1-d', kind: 'DATE', label: 'lookback', text: 'since January 1, 2023', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 21, gap_before: false, children: [] }],
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Compliance with Laws; Permits; Licenses', cells: [{ column_id: 'lookback', value: { canonical: 2023, unit: 'year' }, component_ids: ['rep-1-d'] }] },
  };
  assert.ok(validateFactConclusions(fact, { tableShapes }).some((p) => /parseComponentValue/.test(p)), 'the model\'s own number does not validate');
  const normalised = { ...fact, conclusions: normaliseConclusionValues(fact, tableShapes) };
  assert.deepEqual(normalised.conclusions.cells[0].value, { canonical: '2023-01-01', unit: 'ISO_DATE' });
  assert.deepEqual(validateFactConclusions(normalised, { tableShapes }), []);
  assert.equal(formatValue(normalised.conclusions.cells[0].value, 'PERIOD'), 'January 1, 2023');
});

test('a counted instrument keeps its parsed COUNT whatever unit the model wrote', () => {
  const fact = {
    fact_id: 'cvr-1', proposal_id: 'cvr-1', family_key: 'CONSIDERATION', subtype_key: 'PER_SHARE_CONSIDERATION', section_reference: '2.01',
    headline: { label: 'CVR', distinguishing_component_ids: ['cvr-1-a'] },
    components: [{ component_id: 'cvr-1-a', kind: 'AMOUNT', label: 'count', text: 'one (1)', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 7, gap_before: false, children: [] }],
    conclusions: { table_key: 'consideration-components', row_label: 'CVR', cells: [{ column_id: 'amount', value: { canonical: 1, unit: 'CVR' }, component_ids: ['cvr-1-a'] }] },
  };
  const normalised = normaliseConclusionValues(fact, tableShapes);
  assert.deepEqual(normalised.cells[0].value, { canonical: 1, unit: 'COUNT' });
  assert.equal(formatValue(normalised.cells[0].value, 'AMOUNT'), '1');
});

test('C11 / C14: an exchange-mechanics fact gets no per-share row, and appraisal rights are derived from the appraisal provision, never coded', () => {
  const mechanics = {
    fact_id: 'xm-1', proposal_id: 'xm-1', family_key: 'CONSIDERATION', subtype_key: 'EXCHANGE_MECHANICS', section_reference: '2.02',
    headline: { label: 'Exchange fund', distinguishing_component_ids: ['xm-1-c'] },
    components: [{ component_id: 'xm-1-c', kind: 'OBJECT', label: 'deposit', text: 'an amount of cash', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 17, gap_before: false, children: [] }],
    conclusions: { table_key: 'consideration-components', row_label: 'Cash', cells: [{ column_id: 'form', code: 'CASH', component_ids: ['xm-1-c'] }] },
  };
  assert.ok(validateFactConclusions(mechanics, { tableShapes }).some((p) => /does not belong in consideration-components/.test(p)));
  const exclusion = {
    fact_id: 'ex-1', proposal_id: 'ex-1', family_key: 'CONSIDERATION', subtype_key: 'EXCLUSION', section_reference: '2.01(b)',
    headline: { label: 'Cancelled shares', distinguishing_component_ids: ['ex-1-c'] },
    components: [{ component_id: 'ex-1-c', kind: 'OPERATION', label: 'no consideration', text: 'no consideration shall be delivered or deliverable in exchange therefor', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 70, gap_before: false, children: [] }],
    conclusions: { table_key: 'consideration-structure', row_label: 'The deal', cells: [{ column_id: 'appraisalRights', text: 'no consideration shall be delivered or deliverable in exchange therefor', component_ids: ['ex-1-c'] }] },
  };
  assert.ok(validateFactConclusions(exclusion, { tableShapes }).some((p) => /derived by the page from CONSIDERATION facts/.test(p)));
});

test('a vocabulary column accepts two distinct codes on one fact (knowledge and materiality qualifiers), not the same code twice', () => {
  const fact = {
    fact_id: 'rep-2', proposal_id: 'rep-2', family_key: 'REPRESENTATIONS', subtype_key: 'COMPLIANCE_REPRESENTATION', section_reference: '3.25',
    headline: { label: 'Compliance', distinguishing_component_ids: ['k'] },
    components: [
      { component_id: 'k', kind: 'QUALIFIER', label: 'knowledge', text: 'to the knowledge of the Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 31, gap_before: false, children: [] },
      { component_id: 'm', kind: 'MATERIALITY_QUALIFIER', label: 'materiality', text: 'except as would not reasonably be expected to be material', origin: 'OWN', source_span_id: 's', start_byte: 40, end_byte: 98, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Compliance with Laws; Permits; Licenses', cells: [
      { column_id: 'materiality', code: 'KNOWLEDGE_QUALIFIED_PARTIAL', component_ids: ['k'] },
      { column_id: 'materiality', code: 'MATERIAL_TO_THE_REP_PARTIAL', component_ids: ['m'] },
    ] },
  };
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
  const twice = { ...fact, conclusions: { ...fact.conclusions, cells: [fact.conclusions.cells[0], { ...fact.conclusions.cells[0] }] } };
  assert.ok(validateFactConclusions(twice, { tableShapes }).some((p) => /duplicate column materiality/.test(p)));
});

test('C13: a vocabulary_by_row column rejects a code from another row\'s list and accepts one from its own', () => {
  const fact = (rowLabel, codeValue) => ({
    fact_id: 'ar-1', proposal_id: 'ar-1', family_key: 'ANTITRUST_REGULATORY', subtype_key: 'EFFORTS', section_reference: '6.03',
    headline: { label: 'Efforts', distinguishing_component_ids: ['ar-1-c'] },
    components: [{ component_id: 'ar-1-c', kind: 'EFFORTS_STANDARD', label: 'efforts', text: 'reasonable best efforts', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 23, gap_before: false, children: [] }],
    conclusions: { table_key: 'antitrust-regulatory-table', row_label: rowLabel, cells: [{ column_id: 'provision', code: codeValue, component_ids: ['ar-1-c'] }] },
  });
  assert.deepEqual(validateFactConclusions(fact('Efforts standard', 'REASONABLE_BEST_EFFORTS'), { tableShapes }), []);
  const problems = validateFactConclusions(fact('Efforts standard', 'PARENT_CONTROLS'), { tableShapes });
  assert.ok(problems.some((p) => /is not one of the provision codes for row "Efforts standard"/.test(p)), problems.join('; '));
});

test('an as-drafted (fact_text) cell needs cited components, not verbatim text: the page shows the fact\'s own words', () => {
  const fact = closingTimingFact('third Business Day after the satisfaction or waiver of the conditions set forth in Article VII');
  fact.conclusions.cells = [{ column_id: 'closingTiming', text: 'the third business day after the conditions are met', component_ids: fact.conclusions.cells[0].component_ids }];
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
});

// Ben, 2026-09-14: "do you have an agent looking at all of our tweaks and
// seeing if they should be made systematically/throughout the code base
// back to extraction? I don't want to make surface level/one deal level
// fixes". The two page-side rules of 2026-09-14 (the fully-vested remap
// and the Lookback cell filled from the fact's DATE) now hold at
// extraction on every deal: C15 drops a readout whose code the fact's own
// words contradict; normaliseConclusionValues completes a value column
// the readout omitted from the fact's one parsable fill_from component.
function optionFact(conditionText, code = 'FULLY_VESTED_ACCELERATED') {
  return {
    fact_id: 'opt-1', proposal_id: 'opt-1', family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', section_reference: '2.03',
    headline: { label: 'Equity award', distinguishing_component_ids: ['opt-1-o'] },
    components: [
      ...(conditionText ? [{ component_id: 'opt-1-c', kind: 'CONDITION', label: 'Continued service', text: conditionText, origin: 'OWN', source_span_id: SPAN_ID, start_byte: 0, end_byte: conditionText.length, gap_before: false, children: [] }] : []),
      { component_id: 'opt-1-o', kind: 'OPERATION', label: 'Vesting', text: 'shall become vested', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 200, end_byte: 219, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'equity-awards-table', row_label: 'Company Stock Option', row_detail: 'Unvested, not vesting by its terms', cells: [{ column_id: 'vestingTreatment', code, component_ids: ['opt-1-o'] }] },
  };
}

test('C15: "Fully vested (accelerated)" on a fact whose own words say "continued service" is a problem; the conditional code, or no such words, is not', () => {
  const problems = validateFactConclusions(optionFact('subject to the holder’s continued service with Parent through the first anniversary of the Closing'), { tableShapes });
  assert.ok(problems.some((problem) => /contradicted by the fact's own words "continued service"/.test(problem)), JSON.stringify(problems));
  assert.deepEqual(validateFactConclusions(optionFact('subject to the holder’s Continued Employment through the first anniversary'), { tableShapes }).filter((problem) => /contradicted/.test(problem)).length, 1);
  assert.deepEqual(validateFactConclusions(optionFact(null), { tableShapes }), []);
  assert.deepEqual(validateFactConclusions(optionFact('subject to the holder’s continued service through the first anniversary', 'FULLY_VESTED_CONDITIONAL_UPON_SERVICE'), { tableShapes }), []);
  // Whole words only: "discontinued service" is not the phrase.
  assert.deepEqual(validateFactConclusions(optionFact('after any discontinued service arrangement'), { tableShapes }), []);
});

function absenceFact(dates, extraCells = []) {
  return {
    fact_id: 'r-3-08', proposal_id: 'r-3-08', family_key: 'REPRESENTATIONS', subtype_key: 'NEGATIVE_REPRESENTATION', section_reference: '3.08',
    headline: { label: 'Negative representation', distinguishing_component_ids: [] },
    components: [
      ...dates.map((text, index) => ({ component_id: `r-3-08-d${index}`, kind: 'DATE', label: 'Look-back start date', text, origin: 'OWN', source_span_id: SPAN_ID, start_byte: index * 30, end_byte: index * 30 + text.length, gap_before: false, children: [] })),
      { component_id: 'r-3-08-o', kind: 'OPERATION', label: 'Absence statement', text: 'there has not been', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 100, end_byte: 118, gap_before: false, children: [] },
      { component_id: 'r-3-08-m', kind: 'DEFINED_TERM', label: 'Company Material Adverse Effect', text: 'any Company Material Adverse Effect', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 120, end_byte: 155, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Absence of Certain Changes or Events', cells: [{ column_id: 'materiality', code: 'MAE_AGGREGATE', component_ids: ['r-3-08-m'] }, ...extraCells] },
  };
}

test('a value column the readout omitted is completed at extraction from the fact\'s one parsable fill_from component, and validates', () => {
  const fact = absenceFact(['Since January 1, 2025']);
  const normalised = { ...fact, conclusions: normaliseConclusionValues(fact, tableShapes) };
  const lookback = normalised.conclusions.cells.find((cell) => cell.column_id === 'lookback');
  assert.ok(lookback, JSON.stringify(normalised.conclusions.cells));
  assert.deepEqual(lookback.value, { canonical: '2025-01-01', unit: 'ISO_DATE' });
  assert.deepEqual(lookback.component_ids, ['r-3-08-d0']);
  assert.deepEqual(validateFactConclusions(normalised, { tableShapes }), []);
  assert.equal(formatValue(lookback.value, 'PERIOD'), 'January 1, 2025');
});

test('an omitted value column is not completed when two components could fill it, nor when the readout already fills it', () => {
  const two = absenceFact(['Since January 1, 2025', 'since December 31, 2023']);
  assert.equal(normaliseConclusionValues(two, tableShapes).cells.some((cell) => cell.column_id === 'lookback'), false);
  const filled = absenceFact(['Since January 1, 2025'], [{ column_id: 'lookback', value: { canonical: 2025, unit: 'year' }, component_ids: ['r-3-08-d0'] }]);
  const cells = normaliseConclusionValues(filled, tableShapes).cells.filter((cell) => cell.column_id === 'lookback');
  assert.equal(cells.length, 1);
  assert.deepEqual(cells[0].value, { canonical: '2025-01-01', unit: 'ISO_DATE' });
  // A readout on a fact with no parsable words is left as it was.
  const none = absenceFact([]);
  assert.deepEqual(normaliseConclusionValues(none, tableShapes).cells, none.conclusions.cells);
});

// Ben, 2026-09-14: "sure add a table". A capitalization count is parsed
// from the cited words as a COUNT (the par value in the same words is not
// the count), never taken from the model.
test('a COUNT value cell on the capitalization table takes the code-parsed count of its cited words', () => {
  const component = (id, kind, text, start) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [] });
  const fact = {
    fact_id: 'cap-1', proposal_id: 'cap-1', family_key: 'CAPITALISATION', subtype_key: 'AUTHORISED_CAPITAL', section_reference: '3.02',
    headline: { label: 'Authorised capital', distinguishing_component_ids: ['cap-1-pref'] },
    components: [component('cap-1-pref', 'AMOUNT', '10,000,000 shares of preferred stock, par value $0.00001 per share', 0)],
    conclusions: { table_key: 'capitalization-table', row_label: 'Preferred Stock', cells: [{ column_id: 'authorised', value: { canonical: 10, unit: 'million' }, component_ids: ['cap-1-pref'] }] },
  };
  assert.ok(validateFactConclusions(fact, { tableShapes }).some((p) => /parseComponentValue/.test(p)), 'the model\'s own number does not validate');
  const normalised = { ...fact, conclusions: normaliseConclusionValues(fact, tableShapes) };
  assert.deepEqual(normalised.conclusions.cells[0].value, { canonical: 10000000, unit: 'COUNT' });
  assert.deepEqual(validateFactConclusions(normalised, { tableShapes }), []);
  assert.equal(formatValue(normalised.conclusions.cells[0].value, 'COUNT'), '10000000');
  // The issued count never fills the authorised column (C12), and an
  // absence fact is the footer, never a row with cells.
  const issued = { ...fact, subtype_key: 'ISSUED_AND_OUTSTANDING', conclusions: { ...normalised.conclusions, row_label: 'Common Stock' } };
  assert.ok(validateFactConclusions(issued, { tableShapes }).some((p) => /filled only by AUTHORISED_CAPITAL facts/.test(p)));
  const absence = { ...fact, subtype_key: 'CAPITALISATION_ABSENCE', conclusions: { table_key: 'capitalization-table', row_label: 'No other securities', cells: [] } };
  assert.deepEqual(validateFactConclusions(absence, { tableShapes }), []);
});

// Ben, 2026-09-14: "you need to move it over to what we had in the old
// vesrion". The article introduction's readout goes to the representations
// table's General Exceptions row with the row's own codes.
test('a REPRESENTATION_QUALIFICATION readout on the General Exceptions row validates with a code from that row\'s list, not with a representation qualifier', () => {
  const component = (id, kind, text, start) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [] });
  const fact = {
    fact_id: 'intro-1', proposal_id: 'intro-1', family_key: 'REPRESENTATIONS', subtype_key: 'REPRESENTATION_QUALIFICATION', section_reference: 'III-INTRO',
    headline: { label: 'SEC filings exception', distinguishing_component_ids: ['intro-1-period'] },
    components: [
      component('intro-1-risk', 'LIST_ELEMENT', '“Risk Factors,”', 0),
      component('intro-1-period', 'PERIOD', 'at least one (1) business day prior to the date of this Agreement', 20),
    ],
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'General Exceptions', row_detail: 'SEC Filings', cells: [
      { column_id: 'materiality', code: 'EXCLUDES_RISK_FACTORS', component_ids: ['intro-1-risk'] },
      { column_id: 'lookback', value: { canonical: 1, unit: 'BUSINESS_DAY' }, component_ids: ['intro-1-period'] },
    ] },
  };
  assert.deepEqual(validateFactConclusions(fact, { tableShapes }), []);
  const wrongRow = { ...fact, conclusions: { ...fact.conclusions, cells: [{ column_id: 'materiality', code: 'MAE_AGGREGATE', component_ids: ['intro-1-risk'] }] } };
  assert.ok(validateFactConclusions(wrongRow, { tableShapes }).some((p) => /not one of the materiality codes for row "General Exceptions"/.test(p)));
  const knowledge = {
    ...fact, fact_id: 'kn-1', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'KNOWLEDGE',
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Knowledge', row_detail: 'Standard', cells: [{ column_id: 'materiality', code: 'KNOWLEDGE_AFTER_REASONABLE_INQUIRY', component_ids: ['intro-1-risk'] }] },
  };
  assert.deepEqual(validateFactConclusions(knowledge, { tableShapes }), [], 'the knowledge definition belongs on the Knowledge row');
  assert.equal(tableForFact({ family_key: 'REPRESENTATIONS', conclusions: { table_key: 'representations-general-qualifications' } }, tableShapes), null, 'the separate table is gone');
});


// Generation 6: the benefit-plan look-back read "6 year". A period's unit
// is a word, plural past one.
test('formatValue writes a period unit as a word, plural past one', () => {
  const { formatValue } = require('../lib/product/fact-conclusions');
  assert.equal(formatValue({ canonical: 6, unit: 'YEAR' }, 'PERIOD'), '6 years');
  assert.equal(formatValue({ canonical: 1, unit: 'BUSINESS_DAY' }, 'PERIOD'), '1 business day');
  assert.equal(formatValue({ canonical: 2, unit: 'BUSINESS_DAY' }, 'PERIOD'), '2 business days');
});
