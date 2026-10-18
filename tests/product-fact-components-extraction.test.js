'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { compileExtraction, buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { substantiveSections } = require('../lib/product/source-context');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');
const tableShapes = require('../contracts/product/table-shapes.v3.json');

const sha = (value) => createHash('sha256').update(value).digest('hex');
const text = 'Section 3.1 Organization. For purposes of this Agreement, Material Adverse Effect shall not include any event, change, circumstance, occurrence, effect or state of facts to the extent resulting from geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks), or a fee of $750,000 within 30 days.';
const bytes = (value) => Buffer.byteLength(value, 'utf8');
const nodeId = 'n'.repeat(64);
const fullSpanId = 'f'.repeat(64);
const closure = {
  source_closure_id: 'c'.repeat(64), structure_node_id: nodeId, section_node_id: nodeId, section_reference: '3.1', full_section_span_id: fullSpanId,
  spans: [{ span_id: fullSpanId, kind: 'FULL_SECTION', structure_node_id: nodeId, start_byte: 0, end_byte: bytes(text), exact_text: text }],
};
const sourceDocument = { source_document_id: 'd'.repeat(64), canonical_text: text };
const node = { node_id: nodeId, reference: '3.1', kind: 'SECTION' };
const call = { model_call_id: 'm'.repeat(64) };

function component(ref, kind, label, quote, extra = {}) {
  return { ref, kind, label, quote, source_span_id: fullSpanId, occurrence: 0, origin: 'OWN', children: [], ...extra };
}

function response(components, headline) {
  return {
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'MAE_DEFINITION', subtype_key: 'EXCLUSION', fact_type: 'MAE_CARVEOUT',
      statement: 'Material Adverse Effect shall not include effects resulting from war, terrorism or sabotage.',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'Material Adverse Effect', LEGAL_OPERATION: 'shall not include', OPERATIVE_OBJECT: 'geopolitical conditions or changes' },
      value: null,
      evidence_quotes: [{ quote: 'geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)', source_span_id: fullSpanId, occurrence: 0 }],
      headline, components,
    }],
    groups: [{ client_ref: 'g1', family_key: 'MAE_DEFINITION', subtype_key: 'EXCLUSION' }],
    links: [],
  };
}

function compile(body) {
  return compileExtraction({ sourceDocument, legalSchema: legalSchemaV2, node, closure, call, response: body, routedFamilies: ['MAE_DEFINITION'], ownedNodeIds: new Set([nodeId]) });
}

test('V2 extraction compiles a valid component tree with headline, values and byte spans', () => {
  const components = [
    component('litany', 'LITANY', 'affected matters', 'any event, change, circumstance, occurrence, effect or state of facts', { origin: 'CHAPEAU', origin_structure_node_id: nodeId, members: ['event', 'change', 'circumstance', 'occurrence', 'effect', 'state of facts'] }),
    component('resulting', 'OPERATION', 'resulting from', 'to the extent resulting from'),
    component('war', 'LIST', 'war, terrorism and sabotage', 'geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)', {
      children: [
        component('war-1', 'TERM', 'geopolitical conditions', 'geopolitical conditions or changes that are the result of'),
        component('war-2', 'LIST_ELEMENT', 'war', 'the outbreak, conduct or escalation of war (whether declared or undeclared)'),
        component('war-3', 'LIST_ELEMENT', 'terrorism', 'acts of terrorism'),
        component('war-4', 'LIST_ELEMENT', 'sabotage', 'sabotage', { children: [component('war-4a', 'LIST_ELEMENT', 'cyber-attacks', '(including cyber-attacks)')] }),
      ],
    }),
    component('fee', 'AMOUNT', 'fee', '$750,000', { gap_before: true }),
    component('period', 'PERIOD', 'within', '30 days'),
  ];
  const compiled = compile(response(components, { label: 'MAE carve-out', distinguishing_refs: ['war'] }));
  assert.equal(compiled.proposals.length, 1);
  const proposal = compiled.proposals[0];
  assert.equal(proposal.validation_status, 'VALID', JSON.stringify(compiled.issues.map((issue) => issue.message)));
  assert.equal(proposal.headline.label, 'MAE carve-out');
  assert.equal(proposal.headline.distinguishing_component_ids.length, 1);
  assert.equal(proposal.components.length, 5);
  const war = proposal.components[2];
  assert.equal(war.children.length, 4);
  assert.equal(war.children[3].children[0].label, 'cyber-attacks');
  assert.equal(proposal.components[0].origin, 'CHAPEAU');
  assert.deepEqual(proposal.components[3].value, { canonical: 750000, unit: 'USD' });
  assert.deepEqual(proposal.components[4].value, { canonical: 30, unit: 'DAY' });
  assert.equal(proposal.components[3].gap_before, true);
  const sliced = Buffer.from(text, 'utf8').subarray(war.children[2].start_byte, war.children[2].end_byte).toString('utf8');
  assert.equal(sliced, 'acts of terrorism');
  assert.ok(compiled.spans.some((span) => span.exact_text === 'acts of terrorism' && span.kind === 'SUPPORTING_EVIDENCE'));
  assert.equal(compiled.issues.filter((issue) => issue.code === 'INVALID_FACT_COMPONENTS').length, 0);
});

test('V2 extraction holds a proposal whose component quote is not in the source or whose role text is invented', () => {
  const bad = compile(response([component('x', 'TERM', 'x', 'acts of terror and mayhem')], { label: 'MAE carve-out', distinguishing_refs: ['x'] }));
  assert.equal(bad.proposals[0].validation_status, 'INVALID');
  const issue = bad.issues.find((candidate) => candidate.code === 'INVALID_FACT_COMPONENTS');
  assert.ok(issue);
  assert.match(issue.message, /quote not found in source/);
  const none = response([component('t', 'LIST_ELEMENT', 'terrorism', 'acts of terrorism')], { label: 'MAE carve-out', distinguishing_refs: ['t'] });
  none.proposals[0].roles.QUALIFICATIONS = 'none';
  const compiled = compile(none);
  assert.equal(compiled.proposals[0].validation_status, 'INVALID');
  assert.ok(compiled.issues.some((candidate) => candidate.code === 'INVENTED_ROLE_TEXT'));
  // A carve-out fact may start with a LIST_ELEMENT: it is one element of the
  // definition's exclusion list, so the tree itself is valid.
  assert.ok(!compiled.issues.some((candidate) => candidate.code === 'INVALID_FACT_COMPONENTS' && /LIST_ELEMENT outside a LIST/.test(candidate.message)));
});

test('V1 schema extraction is unchanged: no headline or components keys', () => {
  const legalSchemaV1 = require('../contracts/product/legal-schema.v1.json');
  const body = response(undefined, undefined);
  body.proposals[0].roles = { LEGAL_ACTOR_OR_SUBJECT: 'Material Adverse Effect', LEGAL_OPERATION: 'shall not include', OPERATIVE_OBJECT: 'geopolitical conditions', TEMPORAL_OR_TRIGGER_SCOPE: 'to the extent resulting from', QUALIFICATIONS: 'whether declared or undeclared' };
  const compiled = compileExtraction({ sourceDocument, legalSchema: legalSchemaV1, node, closure, call, response: body, routedFamilies: ['MAE_DEFINITION'], ownedNodeIds: new Set([nodeId]) });
  assert.equal(compiled.proposals[0].validation_status, 'VALID');
  assert.equal(Object.hasOwn(compiled.proposals[0], 'components'), false);
  assert.equal(Object.hasOwn(compiled.proposals[0], 'headline'), false);
});

test('V2 extraction maps synonym kinds to the contract and allows a descriptive period without a number', () => {
  const body = response([
    component('who', 'PARTY', 'subject', 'Material Adverse Effect'),
    component('when', 'TIME', 'timing', 'to the extent resulting from'),
    component('q', 'QUALIFICATION', 'qualifier', '(whether declared or undeclared)'),
    component('p', 'PERIOD', 'period', 'within 30 days'),
    component('r', 'LEGAL_OPERATION', 'operation', 'shall not include'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['who'] });
  const compiled = compile(body);
  assert.equal(compiled.proposals[0].validation_status, 'VALID', JSON.stringify(compiled.issues));
  assert.deepEqual(compiled.proposals[0].components.map((item) => item.kind), ['ACTOR', 'TRIGGER', 'QUALIFIER', 'PERIOD', 'OPERATION']);
  assert.equal(compiled.proposals[0].components[3].value.canonical, 30);
  const descriptive = compile(response([
    component('p', 'PERIOD', 'period', 'to the extent resulting from geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['p'] }));
  assert.equal(descriptive.proposals[0].validation_status, 'VALID', JSON.stringify(descriptive.issues));
  assert.equal(descriptive.proposals[0].components[0].value, null);
  const thresholdPeriod = compile(response([
    component('t', 'THRESHOLD', 'threshold', 'within 30 days'),
    component('d', 'THRESHOLD', 'threshold', 'to the extent resulting from geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['t'] }));
  assert.equal(thresholdPeriod.proposals[0].validation_status, 'VALID', JSON.stringify(thresholdPeriod.issues));
  assert.deepEqual(thresholdPeriod.proposals[0].components[0].value, { canonical: 30, unit: 'DAY' });
  assert.equal(thresholdPeriod.proposals[0].components[1].value, null);
  const amount = compile(response([
    component('a', 'AMOUNT', 'amount', 'geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['a'] }));
  assert.equal(amount.proposals[0].validation_status, 'INVALID');
  const unknown = compile(response([
    component('z', 'WIDGET', 'widget', 'geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['z'] }));
  assert.equal(unknown.proposals[0].validation_status, 'INVALID');
});

// V9 (FACT_CONCLUSIONS/V1, contracts/product/fact-conclusions.v1.json): once
// a table-shapes.v3.json table exists for the routed family (CONSIDERATION ->
// equity-awards-table), compileExtraction also compiles conclusions when
// `tableShapes` is supplied. Reuses this file's shared MAE closure/spans for
// the fixture plumbing; the CONSIDERATION/EQUITY_AWARD proposal below is a
// second, independent family carried over that same closure.

function equityComponents() {
  return [
    component('term', 'TERM', 'Equity type', 'sabotage'),
    component('consid', 'STANDARD', 'consideration', 'the outbreak, conduct or escalation of war (whether declared or undeclared)'),
    component('vest', 'STANDARD', 'vesting', 'acts of terrorism'),
    component('cvr', 'STANDARD', 'CVR entitlement', 'geopolitical conditions or changes'),
  ];
}

function equityResponse({ components, headline, conclusions }) {
  return {
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', fact_type: 'PER_SHARE_CASH_CONSIDERATION',
      statement: 'RSUs convert into the right to receive Parent common stock and continue vesting.',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'Material Adverse Effect', LEGAL_OPERATION: 'shall not include', OPERATIVE_OBJECT: 'geopolitical conditions or changes' },
      value: null,
      evidence_quotes: [{ quote: 'geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)', source_span_id: fullSpanId, occurrence: 0 }],
      headline,
      components,
      ...(conclusions !== undefined ? { conclusions } : {}),
    }],
    groups: [{ client_ref: 'g1', family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD' }],
    links: [],
  };
}

function compileWithTableShapes(body) {
  return compileExtraction({
    sourceDocument, legalSchema: legalSchemaV2, node, closure, call, response: body,
    routedFamilies: ['CONSIDERATION'], ownedNodeIds: new Set([nodeId]), tableShapes,
  });
}

const equityHeadline = { label: 'Equity award', distinguishing_refs: ['term'] };
const validConclusions = {
  table_key: 'equity-awards-table',
  row_label: 'RSUs',
  cells: [
    { column_id: 'consideration', code: 'PARENT_STOCK_ROLLOVER', component_refs: ['consid'] },
    { column_id: 'vestingTreatment', code: 'CONTINUES_VESTING_DOUBLE_TRIGGER_PROTECTION', component_refs: ['vest'] },
    { column_id: 'cvrEntitlement', code: 'NOT_ENTITLED', component_refs: ['cvr'] },
  ],
};

test('V9: a proposal in a family with a table shape gets a validated conclusions readout attached', () => {
  const compiled = compileWithTableShapes(equityResponse({
    components: equityComponents(), headline: equityHeadline, conclusions: validConclusions,
  }));
  assert.equal(compiled.proposals[0].validation_status, 'VALID', JSON.stringify(compiled.issues));
  assert.equal(compiled.proposals[0].conclusions.table_key, 'equity-awards-table');
  assert.equal(compiled.proposals[0].conclusions.row_label, 'RSUs');
  assert.equal(compiled.proposals[0].conclusions.cells.length, 3);
  assert.deepEqual(compiled.proposals[0].conclusions.cells[0].component_ids, [
    compiled.proposals[0].components.find((c) => c.label === 'consideration').component_id,
  ]);
  assert.equal(compiled.issues.filter((issue) => issue.code === 'CONCLUSIONS_DROPPED').length, 0);
  assert.equal(compiled.issues.filter((issue) => issue.code === 'CONCLUSIONS_MISSING').length, 0);
});

test('V9: a cell with an unknown vocabulary code is dropped with a CONCLUSIONS_CELLS_DROPPED note; the readout keeps its row and the fact stays VALID', () => {
  // Metsera generation 7, 3.08: a readout used to be dropped whole on one
  // malformed cell, and the fact lost its row.
  const badConclusions = {
    ...validConclusions,
    cells: [{ column_id: 'consideration', code: 'NOT_A_REAL_CODE', component_refs: ['consid'] }],
  };
  const compiled = compileWithTableShapes(equityResponse({
    components: equityComponents(), headline: equityHeadline, conclusions: badConclusions,
  }));
  assert.equal(compiled.proposals[0].validation_status, 'VALID');
  const issue = compiled.issues.find((candidate) => candidate.code === 'CONCLUSIONS_CELLS_DROPPED');
  assert.ok(issue, JSON.stringify(compiled.issues.map((candidate) => candidate.code)));
  assert.equal(issue.kind, 'NOTE');
  assert.match(issue.message, /unknown code/);
  assert.equal(compiled.proposals[0].conclusions.row_label, validConclusions.row_label);
  assert.deepEqual(compiled.proposals[0].conclusions.cells, []);
  assert.equal(compiled.issues.some((candidate) => candidate.code === 'CONCLUSIONS_DROPPED' || candidate.code === 'INVALID_FACT_CONCLUSIONS'), false);
});

test('V9: valid components with no conclusions from the model stay VALID with a CONCLUSIONS_MISSING note issue', () => {
  const compiled = compileWithTableShapes(equityResponse({
    components: equityComponents(), headline: equityHeadline, conclusions: undefined,
  }));
  assert.equal(compiled.proposals[0].validation_status, 'VALID', JSON.stringify(compiled.issues));
  assert.equal(Object.hasOwn(compiled.proposals[0], 'conclusions'), false);
  const issue = compiled.issues.find((candidate) => candidate.code === 'CONCLUSIONS_MISSING');
  assert.ok(issue);
  assert.equal(issue.kind, 'NOTE');
});

test('V9: without tableShapes, compileExtraction ignores conclusions entirely -- V8 behaviour unchanged', () => {
  const compiled = compileExtraction({
    sourceDocument, legalSchema: legalSchemaV2, node, closure, call,
    response: equityResponse({ components: equityComponents(), headline: equityHeadline, conclusions: validConclusions }),
    routedFamilies: ['CONSIDERATION'], ownedNodeIds: new Set([nodeId]),
  });
  assert.equal(compiled.proposals[0].validation_status, 'VALID');
  assert.equal(Object.hasOwn(compiled.proposals[0], 'conclusions'), false);
  assert.equal(compiled.issues.filter((issue) => issue.code === 'CONCLUSIONS_MISSING' || issue.code === 'CONCLUSIONS_DROPPED').length, 0);
});

test('V9: buildAgreementSectionDraft adds table_shapes/conclusion_instruction and uses PRODUCT_ALL_FAMILY_EXTRACTOR/V9 when a routed family has a table shape', async () => {
  const canonicalText = ['ARTICLE III', 'TREATMENT OF EQUITY AWARDS', 'Section 3.2 RSUs. Each restricted stock unit shall be converted into the right to receive one share of Parent common stock and shall continue vesting on its existing schedule.'].join('\n\n');
  const id = sha(canonicalText);
  const sourceDoc = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: id, agreement_id: id,
    canonical_text: canonicalText, canonical_text_sha256: id,
    retrieval_url: 'https://example.test/equity.htm', final_url: 'https://example.test/equity.htm', source_map_id: id,
    filing_accession: '0000000000-00-000000', exhibit_filename: 'equity.htm',
  };
  const agreementStructure = buildAgreementStructure({ agreement_id: id, canonical_text: canonicalText, canonical_text_sha256: id });
  const sectionNode = substantiveSections(agreementStructure)[0];
  let extractionRequestSeen = null;

  const section = await buildAgreementSectionDraft({
    sourceDocument: sourceDoc, agreementStructure, node: sectionNode, legalSchema: legalSchemaV2, tableShapes,
    model: {
      async complete({ call_kind, request }) {
        let modelResponse;
        if (call_kind === 'ROUTING') {
          modelResponse = { families: ['CONSIDERATION'], disposition: 'FAMILY_ASSIGNED', rationale: 'RSU treatment', deterministic_disagreements: [] };
        } else if (call_kind === 'RESIDUAL') {
          modelResponse = { paragraphs: request.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['CONSIDERATION'], rationale: 'RSU treatment' })) };
        } else {
          extractionRequestSeen = request;
          const spanId = request.source_closure.full_section.span_id;
          const proposal = {
            client_ref: 'p1', group_ref: 'g1', family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', fact_type: 'PER_SHARE_CASH_CONSIDERATION',
            statement: 'Each RSU converts into the right to receive one share of Parent common stock and continues vesting.',
            roles: { LEGAL_ACTOR_OR_SUBJECT: 'Each restricted stock unit', LEGAL_OPERATION: 'shall be converted into', OPERATIVE_OBJECT: 'the right to receive one share of Parent common stock' },
            value: null,
            evidence_quotes: [{ quote: 'shall be converted into the right to receive one share of Parent common stock and shall continue vesting on its existing schedule', source_span_id: spanId, occurrence: 0 }],
            headline: { label: 'Equity award', distinguishing_refs: ['term'] },
            components: [
              { ref: 'term', kind: 'TERM', label: 'Equity type', quote: 'RSUs', source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
              { ref: 'consid', kind: 'STANDARD', label: 'consideration', quote: 'shall be converted into the right to receive one share of Parent common stock', source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
              { ref: 'vest', kind: 'STANDARD', label: 'vesting', quote: 'shall continue vesting on its existing schedule', source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
            ],
            conclusions: {
              table_key: 'equity-awards-table',
              row_label: 'RSUs',
              cells: [
                { column_id: 'consideration', code: 'PARENT_STOCK_ROLLOVER', component_refs: ['consid'] },
                { column_id: 'vestingTreatment', code: 'CONTINUES_VESTING_DOUBLE_TRIGGER_PROTECTION', component_refs: ['vest'] },
              ],
            },
          };
          modelResponse = {
            proposals: [proposal], groups: [{ client_ref: 'g1', family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD' }], links: [],
            coverage: { CONSIDERATION: 'FOUND' },
            fact_type_coverage: { CONSIDERATION: Object.fromEntries(request.family_contracts[0].required_fact_types.map((type) => [type, type === 'PER_SHARE_CASH_CONSIDERATION' ? 'FOUND' : 'NOT_FOUND'])) },
          };
        }
        return {
          provider_id: 'TEST', model_id: 'TEST', response: modelResponse, raw_request: request, raw_response: modelResponse,
          input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1,
        };
      },
    },
  });

  assert.ok(extractionRequestSeen, 'the extraction call must have been made');
  assert.ok(extractionRequestSeen.table_shapes && Array.isArray(extractionRequestSeen.table_shapes.CONSIDERATION),
    'request must carry table_shapes for the routed family');
  assert.ok(extractionRequestSeen.table_shapes.CONSIDERATION.some((entry) => entry.table_key === 'equity-awards-table'));
  assert.ok(typeof extractionRequestSeen.conclusion_instruction === 'string' && extractionRequestSeen.conclusion_instruction.length > 0);
  assert.ok(extractionRequestSeen.response_contract.proposals[0].conclusions);

  const extractionCall = section.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.equal(extractionCall.prompt_version, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V9');
  assert.equal(section.proposals[0].validation_status, 'VALID', JSON.stringify(section.issues));
  assert.equal(section.proposals[0].conclusions.table_key, 'equity-awards-table');
});

// Ben, 2026-09-14: "do you have an agent looking at all of our tweaks and
// seeing if they should be made systematically/throughout the code base
// back to extraction? I don't want to make surface level/one deal level
// fixes". The page-side rules of 2026-09-14 reach the extractor as prompt
// guidance, request data and a validator: every column's guidance and a
// party column's display are in the request; the instruction names the
// value-column, party, label and DEFINED_TERM rules; a REPRESENTATIONS
// proposal cut from an article introduction is held unless it is a
// REPRESENTATION_QUALIFICATION, and the section is told so.
function representationsSource() {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER', 'ARTICLE I', 'THE MERGER',
    'Section 1.01 The Merger. Merger Sub shall be merged with and into the Company.',
    'ARTICLE III', 'REPRESENTATIONS AND WARRANTIES OF THE COMPANY',
    'Except as disclosed in the Company SEC Documents filed since January 1, 2024 or as set forth in the Company Disclosure Letter, the Company represents and warrants to Parent and Merger Sub that:',
    'Section 3.01 Organization. The Company is duly organized and validly existing.',
    'Section 3.02 Capitalization. The authorized capital stock of the Company consists of 100 shares.',
  ].join('\n\n');
  const id = sha(canonicalText);
  const sourceDoc = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: id, agreement_id: id,
    canonical_text: canonicalText, canonical_text_sha256: id,
    retrieval_url: 'https://example.test/reps.htm', final_url: 'https://example.test/reps.htm', source_map_id: id,
    filing_accession: '0000000000-00-000000', exhibit_filename: 'reps.htm',
  };
  const agreementStructure = buildAgreementStructure({ agreement_id: id, canonical_text: canonicalText, canonical_text_sha256: id });
  return { sourceDoc, agreementStructure };
}

async function draftIntroSection(subtypeKey) {
  const { sourceDoc, agreementStructure } = representationsSource();
  const introNode = substantiveSections(agreementStructure).find((candidate) => candidate.reference === 'III-INTRO');
  assert.ok(introNode, 'the sectionizer mints the article introduction node');
  let extractionRequestSeen = null;
  const section = await buildAgreementSectionDraft({
    sourceDocument: sourceDoc, agreementStructure, node: introNode, legalSchema: legalSchemaV2, tableShapes,
    model: {
      async complete({ call_kind, request }) {
        let modelResponse;
        if (call_kind === 'ROUTING') {
          modelResponse = { families: ['REPRESENTATIONS'], disposition: 'FAMILY_ASSIGNED', rationale: 'article intro', deterministic_disagreements: [] };
        } else if (call_kind === 'RESIDUAL') {
          modelResponse = { paragraphs: request.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['REPRESENTATIONS'], rationale: 'article intro' })) };
        } else {
          extractionRequestSeen = request;
          const spanId = request.source_closure.full_section.span_id;
          const roles = subtypeKey === 'REPRESENTATION_QUALIFICATION'
            ? { qualification_source: 'the Company SEC Documents', qualified_scope: 'represents and warrants to Parent and Merger Sub' }
            : { LEGAL_ACTOR_OR_SUBJECT: 'the Company', LEGAL_OPERATION: 'represents and warrants', OPERATIVE_OBJECT: 'to Parent and Merger Sub' };
          const proposal = {
            client_ref: 'p1', group_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: subtypeKey, fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
            statement: 'Except as disclosed in the Company SEC Documents, the Company represents and warrants.',
            roles, value: null,
            evidence_quotes: [{ quote: 'Except as disclosed in the Company SEC Documents', source_span_id: spanId, occurrence: 0 }],
            headline: { label: 'General qualification', distinguishing_refs: ['src'] },
            components: [
              { ref: 'src', kind: 'EXCEPTION', label: 'SEC filings exception', quote: 'Except as disclosed in the Company SEC Documents', source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
              { ref: 'win', kind: 'DATE', label: 'Filing window', quote: 'since January 1, 2024', source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
              { ref: 'op', kind: 'OPERATION', label: 'Representation', quote: 'represents and warrants', source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
            ],
            // Ben, 2026-09-14: "you need to move it over to what we had in the
            // old vesrion": the introduction's readout is the representations
            // table's General Exceptions row, never a table of its own.
            conclusions: {
              table_key: 'representations-qualifiers-table', row_label: 'General Exceptions', row_detail: 'SEC Filings',
              cells: [{ column_id: 'materiality', code: 'EXCEPT_AS_DISCLOSED_IN_SEC_FILINGS', component_refs: ['src'] }],
            },
          };
          modelResponse = {
            proposals: [proposal], groups: [{ client_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: subtypeKey }], links: [],
            coverage: { REPRESENTATIONS: 'FOUND' },
            fact_type_coverage: { REPRESENTATIONS: Object.fromEntries(request.family_contracts[0].required_fact_types.map((type) => [type, type === 'REPRESENTATION_ACCURACY_STANDARD' ? 'FOUND' : 'NOT_FOUND'])) },
          };
        }
        return {
          provider_id: 'TEST', model_id: 'TEST', response: modelResponse, raw_request: request, raw_response: modelResponse,
          input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1,
        };
      },
    },
  });
  return { section, request: extractionRequestSeen };
}

test('an article introduction routed to REPRESENTATIONS is told its facts are REPRESENTATION_QUALIFICATION, and one of another subtype is held INTRO_NOT_QUALIFICATION', async () => {
  const held = await draftIntroSection('STATUS_REPRESENTATION');
  assert.match(held.request.article_introduction_instruction, /REPRESENTATION_QUALIFICATION/);
  assert.equal(held.section.proposals[0].validation_status, 'INVALID');
  const issue = held.section.issues.find((candidate) => candidate.code === 'INTRO_NOT_QUALIFICATION');
  assert.ok(issue, JSON.stringify(held.section.issues));
  assert.equal(issue.kind, 'VALIDATION');
  assert.match(issue.message, /III-INTRO/);

  const accepted = await draftIntroSection('REPRESENTATION_QUALIFICATION');
  assert.equal(accepted.section.proposals[0].validation_status, 'VALID', JSON.stringify(accepted.section.issues));
  assert.equal(accepted.section.issues.some((candidate) => candidate.code === 'INTRO_NOT_QUALIFICATION'), false);
  assert.equal(accepted.section.proposals[0].conclusions.table_key, 'representations-qualifiers-table');
  assert.equal(accepted.section.proposals[0].conclusions.row_label, 'General Exceptions');
  assert.equal(accepted.section.proposals[0].conclusions.row_detail, 'SEC Filings');
  // The Lookback column (the SEC filings cut-off) the readout omitted is
  // completed from the fact's own DATE at extraction, so the stored readout
  // carries it on every deal.
  const lookback = accepted.section.proposals[0].conclusions.cells.find((cell) => cell.column_id === 'lookback');
  assert.ok(lookback, JSON.stringify(accepted.section.proposals[0].conclusions.cells));
  assert.deepEqual(lookback.value, { canonical: '2024-01-01', unit: 'ISO_DATE' });
  // The instruction and every column's guidance reach the extractor: the
  // separate general-qualifications table is gone.
  assert.match(accepted.request.article_introduction_instruction, /"General Exceptions" \(row_detail "SEC Filings", "Disclosure Letter" or "Other"/);
  assert.equal(accepted.request.table_shapes.REPRESENTATIONS.some((entry) => /general-qualifications$/.test(entry.table_key)), false);
  const reps = accepted.request.table_shapes.REPRESENTATIONS.find((entry) => entry.table_key === 'representations-qualifiers-table');
  assert.match(reps.columns.find((column) => column.column_id === 'lookback').guidance, /cut-off of the SEC filings exception/);
  assert.match(reps.guidance, /row_label "General Exceptions" and row_detail the source of exception/);
});

test('a numbered representation section is not an article introduction: no instruction, no hold', async () => {
  const { sourceDoc, agreementStructure } = representationsSource();
  const node = substantiveSections(agreementStructure).find((candidate) => candidate.reference === '3.01');
  const fullSpan = 'a'.repeat(64);
  const compiled = compileExtraction({
    sourceDocument: sourceDoc, legalSchema: legalSchemaV2, node, call,
    closure: {
      source_closure_id: 'c'.repeat(64), structure_node_id: node.node_id, section_node_id: node.node_id, section_reference: '3.01', full_section_span_id: fullSpan,
      spans: [{ span_id: fullSpan, kind: 'FULL_SECTION', structure_node_id: node.node_id, start_byte: 0, end_byte: bytes('The Company is duly organized and validly existing.'), exact_text: 'The Company is duly organized and validly existing.' }],
      components: [{ kind: 'FULL_SECTION', span_id: fullSpan, structure_node_id: node.node_id }],
    },
    response: {
      proposals: [{
        client_ref: 'p1', group_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
        statement: 'The Company is duly organized.', value: null,
        roles: { LEGAL_ACTOR_OR_SUBJECT: 'The Company', LEGAL_OPERATION: 'is duly organized', OPERATIVE_OBJECT: 'validly existing' },
        evidence_quotes: [{ quote: 'The Company is duly organized', source_span_id: fullSpan, occurrence: 0 }],
        headline: { label: 'Status representation', distinguishing_refs: ['op'] },
        components: [{ ref: 'op', kind: 'OPERATION', label: 'Organization', quote: 'is duly organized', source_span_id: fullSpan, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
      }],
      groups: [{ client_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION' }], links: [],
    },
    routedFamilies: ['REPRESENTATIONS'], ownedNodeIds: new Set([node.node_id]),
  });
  assert.equal(compiled.issues.some((candidate) => candidate.code === 'INTRO_NOT_QUALIFICATION'), false);
});

test('the V9 request carries the value-column, party, label and DEFINED_TERM rules and a party column\'s display', async () => {
  const { sourceDoc, agreementStructure } = representationsSource();
  const mergerNode = substantiveSections(agreementStructure).find((candidate) => candidate.reference === '1.01');
  let request = null;
  await buildAgreementSectionDraft({
    sourceDocument: sourceDoc, agreementStructure, node: mergerNode, legalSchema: legalSchemaV2, tableShapes,
    model: {
      async complete({ call_kind, request: seen }) {
        let modelResponse;
        if (call_kind === 'ROUTING') modelResponse = { families: ['MERGER_STRUCTURE_CLOSING'], disposition: 'FAMILY_ASSIGNED', rationale: 'merger', deterministic_disagreements: [] };
        else if (call_kind === 'RESIDUAL') modelResponse = { paragraphs: seen.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['MERGER_STRUCTURE_CLOSING'], rationale: 'merger' })) };
        else {
          request = seen;
          modelResponse = { proposals: [], groups: [], links: [], coverage: { MERGER_STRUCTURE_CLOSING: 'NOT_FOUND' }, fact_type_coverage: { MERGER_STRUCTURE_CLOSING: Object.fromEntries(seen.family_contracts[0].required_fact_types.map((type) => [type, 'NOT_FOUND'])) } };
        }
        return { provider_id: 'TEST', model_id: 'TEST', response: modelResponse, raw_request: seen, raw_response: modelResponse, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
      },
    },
  });
  assert.ok(request);
  assert.match(request.conclusion_instruction, /A value column is never left empty when this proposal's own components include one of its fill_from kinds/);
  assert.match(request.conclusion_instruction, /A column with display party names an entity/);
  assert.match(request.conclusion_instruction, /A table with footer_subtype_keys shows facts of those subtypes as drafted beneath it, never as rows: give such a fact the row_label the table's guidance names, or no conclusions when its subtype is in no_conclusions_subtype_keys\./);
  assert.match(request.component_instruction, /never a tag such as "Subject:", "Operation:" or "Actor:"/);
  assert.match(request.component_instruction, /resolves_to whose text is the definition's own words/);
  // headline.summary on every proposal (Ben, 2026-09-14: "it needs to be a
  // summary of the provision on the right etc - like in the normal course.
  // Not just a sec ref...!"; "1. for now - yes").
  assert.match(request.component_instruction, /and summary, on every proposal: summary is one plain-English line of at most 15 words stating the provision's operative effect in the parties' defined names/);
  assert.match(request.component_instruction, /no reference to a section of the agreement[^.]*no quotation marks and no trailing period/);
  assert.equal(typeof request.response_contract.proposals[0].headline.summary, 'string');
  const structure = request.table_shapes.MERGER_STRUCTURE_CLOSING.find((entry) => entry.table_key === 'structure-mechanics-table');
  const surviving = structure.columns.find((column) => column.column_id === 'survivingEntityStep1');
  assert.equal(surviving.display, 'party');
  assert.match(surviving.guidance, /never the defined term alone/);
  assert.equal('article_introduction_instruction' in request, false);
});

// headline.summary travels from the model's proposal into the compiled fact
// like label and distinguishing_refs (Ben, 2026-09-14, on the Other
// provisions table: "it needs to be a summary of the provision on the right
// etc - like in the normal course. Not just a sec ref...!"; asked whether
// the extractor should write a short summary per fact as part of the fact
// contract: "1. for now - yes"). A missing summary is a VALIDATION note,
// never a held fact: older generations have none.
test('a proposal\'s headline.summary reaches the fact; a missing one is a VALIDATION note and the fact stays VALID', () => {
  const components = [
    component('resulting', 'OPERATION', 'resulting from', 'to the extent resulting from'),
    component('war', 'LIST', 'war, terrorism and sabotage', 'geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)', {
      children: [component('war-2', 'LIST_ELEMENT', 'war', 'the outbreak, conduct or escalation of war (whether declared or undeclared)')],
    }),
  ];
  const withSummary = compile(response(components, { label: 'MAE carve-out', distinguishing_refs: ['war'], summary: ' Material Adverse Effect excludes effects of war, terrorism and sabotage ' }));
  assert.equal(withSummary.proposals[0].validation_status, 'VALID', JSON.stringify(withSummary.issues.map((issue) => issue.message)));
  assert.equal(withSummary.proposals[0].headline.summary, 'Material Adverse Effect excludes effects of war, terrorism and sabotage');
  assert.equal(withSummary.issues.some((issue) => issue.code === 'HEADLINE_SUMMARY_MISSING'), false);

  const without = compile(response(components, { label: 'MAE carve-out', distinguishing_refs: ['war'] }));
  assert.equal(without.proposals[0].validation_status, 'VALID');
  assert.equal(Object.hasOwn(without.proposals[0].headline, 'summary'), false);
  const note = without.issues.find((issue) => issue.code === 'HEADLINE_SUMMARY_MISSING');
  assert.ok(note, 'a missing summary is noted');
  assert.equal(note.kind, 'VALIDATION');
  assert.equal(note.family_key, 'MAE_DEFINITION');

  // A summary that breaks the rule (a section reference) never holds the
  // fact: it is dropped with a HEADLINE_SUMMARY_DROPPED note carrying the
  // problem, the way CONCLUSIONS_DROPPED works, and the fact stays VALID.
  const bad = compile(response(components, { label: 'MAE carve-out', distinguishing_refs: ['war'], summary: 'Parent pays the fee under Section 8.3' }));
  assert.equal(bad.proposals[0].validation_status, 'VALID', JSON.stringify(bad.issues.map((issue) => issue.message)));
  assert.equal(Object.hasOwn(bad.proposals[0].headline, 'summary'), false);
  assert.equal(bad.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS'), false);
  const dropped = bad.issues.find((issue) => issue.code === 'HEADLINE_SUMMARY_DROPPED');
  assert.ok(dropped, 'a malformed summary is noted');
  assert.equal(dropped.kind, 'VALIDATION');
  assert.match(dropped.message, /headline summary contains a section reference/);
  assert.match(dropped.message, /Section 8\.3/);
  assert.equal(bad.issues.some((issue) => issue.code === 'HEADLINE_SUMMARY_MISSING'), false);
});

// Metsera generation 6, 3.09 (Taxes): a no-representation statement limited
// to Tax assets was coded NO_OTHER_REPS_FRAUD. Only the section headed as
// the no-other-representations clause carries that readout; elsewhere the
// readout is dropped with a note and the request says so.
test('isNoOtherRepsSection reads the section heading', () => {
  const { isNoOtherRepsSection } = require('../lib/product/agreement-draft');
  const closure = (text) => ({ full_section_span_id: 'full', spans: [{ span_id: 'full', exact_text: text }] });
  assert.equal(isNoOtherRepsSection(closure('SECTION 3.24. No Other Representations or Warranties. Except for the representations…')), true);
  assert.equal(isNoOtherRepsSection(closure('SECTION 4.06. Non-Reliance on Estimates. Parent acknowledges…')), true);
  assert.equal(isNoOtherRepsSection(closure('SECTION 3.09. Taxes. (a) The Company has filed…\nNo other representations are made')), false);
});

// Plan finding (39), Metsera generation 7, 9.03: the carve-out tables' footer
// took a list of subtypes (footer_from_subtype.subtype_keys) so the
// underlying-cause proviso sits beside the disproportionality carve-back
// under the table. The extraction request had read footer_from_subtype
// .subtype_key alone, so those tables reached the model with no footer at
// all; the capitalization table's single key still did. Both forms now reach
// the extractor as footer_subtype_keys (generation 8 readiness).
test('the extraction request carries every footer subtype, from a single subtype_key or a subtype_keys list', async () => {
  const { sourceDoc, agreementStructure } = representationsSource();
  const node = substantiveSections(agreementStructure).find((candidate) => candidate.reference === '3.02');
  assert.ok(node, 'the capitalization section is a substantive node');
  let extractionRequestSeen = null;
  const families = ['CAPITALISATION', 'MAE_DEFINITION'];
  await buildAgreementSectionDraft({
    sourceDocument: sourceDoc, agreementStructure, node, legalSchema: legalSchemaV2, tableShapes,
    model: {
      async complete({ call_kind, request }) {
        let modelResponse;
        if (call_kind === 'ROUTING') {
          modelResponse = { families, disposition: 'FAMILY_ASSIGNED', rationale: 'capital stock and the MAE term', deterministic_disagreements: [] };
        } else if (call_kind === 'RESIDUAL') {
          modelResponse = { paragraphs: request.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: families, rationale: 'capital stock' })) };
        } else {
          extractionRequestSeen = request;
          modelResponse = {
            proposals: [], groups: [], links: [],
            coverage: Object.fromEntries(request.family_contracts.map((contract) => [contract.family_key, 'NOT_FOUND'])),
            fact_type_coverage: Object.fromEntries(request.family_contracts.map((contract) => [contract.family_key, Object.fromEntries(contract.required_fact_types.map((type) => [type, 'NOT_FOUND']))])),
          };
        }
        return { provider_id: 'TEST', model_id: 'TEST', response: modelResponse, raw_request: request, raw_response: modelResponse, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
      },
    },
  });
  assert.ok(extractionRequestSeen, 'the extraction call was made');
  // The other two changes of finding (39) ride in component_instruction: the
  // MAE layer rule (one DEFINITION_PRONG per limb, never the consummation
  // limb alone) and the summary rule naming a Disclosure Letter section as
  // content.
  assert.match(extractionRequestSeen.component_instruction, /Layer rules for MAE_DEFINITION: [^]*two DEFINITION_PRONG facts, one per limb, each citing that limb's own words; the effect-on-the-business limb is never omitted in favour of the consummation limb/);
  assert.match(extractionRequestSeen.component_instruction, /a statutory section such as Section 259 of the DGCL, a section of the Disclosure Letter, or an Article of the agreement may be named/);
  const capitalization = extractionRequestSeen.table_shapes.CAPITALISATION.find((entry) => entry.table_key === 'capitalization-table');
  assert.deepEqual(capitalization.footer_subtype_keys, ['CAPITALISATION_ABSENCE']);
  for (const tableKey of ['mae-carveouts-parent', 'mae-carveouts-company']) {
    const table = extractionRequestSeen.table_shapes.MAE_DEFINITION.find((entry) => entry.table_key === tableKey);
    assert.ok(table, `${tableKey} reaches the extractor`);
    assert.deepEqual(table.footer_subtype_keys, ['DISPROPORTIONALITY_CARVEBACK', 'UNDERLYING_CAUSE_RESTORATION']);
    assert.equal('footer_subtype_key' in table, false);
    assert.match(table.guidance, /carries no conclusions, as no_conclusions_subtype_keys says/);
  }
  assert.ok(extractionRequestSeen.no_conclusions_subtype_keys.MAE_DEFINITION.includes('UNDERLYING_CAUSE_RESTORATION'));
  const definitions = extractionRequestSeen.table_shapes.MAE_DEFINITION.find((entry) => entry.table_key === 'mae-definitions-table');
  assert.equal('footer_subtype_keys' in definitions, false, 'a table without a footer sends none');
});

// Work package 13 (plan finding (79)): NCS generation 5, 3.4 (and Metsera
// generation 8's 3.19): every component cut from the Article III
// introduction (origin INTRO) cited a span id one character off the
// closure's chapeau span, which holds the words verbatim, and ten of ten
// facts were held UNKNOWN_SOURCE_COMPONENT.
test('a component quote on an unknown span is taken from the one closure span its origin allows, with a note; two candidates or an own-words quote stay unknown', () => {
  const intro = 'ARTICLE III\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\nExcept as set forth in the Company Disclosure Letter, the Company represents and warrants to Parent and Merger Sub as follows:\n';
  const section = 'Section 3.4 Authority. The Company has all necessary corporate power and authority to execute this Agreement.';
  const canonical = `${intro}${section}`;
  const introNode = 'i'.repeat(64);
  const sectionNode = 's'.repeat(64);
  const introSpan = { span_id: 'a'.repeat(64), kind: 'CHAPEAU', structure_node_id: introNode, start_byte: 0, end_byte: bytes(intro), exact_text: intro };
  const headingSpan = { span_id: 'b'.repeat(64), kind: 'CHAPEAU', structure_node_id: sectionNode, start_byte: bytes(intro), end_byte: bytes(intro) + bytes('Section 3.4 Authority.'), exact_text: 'Section 3.4 Authority.' };
  const full = { span_id: 'c'.repeat(64), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: bytes(intro), end_byte: bytes(canonical), exact_text: section };
  const authorityClosure = {
    source_closure_id: 'd'.repeat(64), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: '3.4', full_section_span_id: full.span_id,
    chapeau_span_ids: [introSpan.span_id, headingSpan.span_id], spans: [introSpan, headingSpan, full],
  };
  const doc = { source_document_id: 'e'.repeat(64), canonical_text: canonical };
  const authorityNode = { node_id: sectionNode, reference: '3.4', kind: 'SECTION' };
  const wrongId = `${'a'.repeat(63)}0`;
  const own = (ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: full.span_id, occurrence: 0, origin: 'OWN', children: [] });
  const proposalWith = (components) => ({
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
      statement: 'The Company has all necessary corporate power and authority to execute this Agreement.',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'the Company', LEGAL_OPERATION: 'represents and warrants', OPERATIVE_OBJECT: 'corporate power and authority' },
      value: null,
      evidence_quotes: [{ quote: 'The Company has all necessary corporate power and authority to execute this Agreement.', source_span_id: full.span_id, occurrence: 0 }],
      headline: { label: 'Authority', distinguishing_refs: ['c2'], summary: 'The Company has corporate power and authority to execute the Agreement' },
      components,
    }],
    groups: [{ client_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION' }],
    links: [],
  });
  const compileAuthority = (body) => compileExtraction({ sourceDocument: doc, legalSchema: legalSchemaV2, node: authorityNode, closure: authorityClosure, call, response: body, routedFamilies: ['REPRESENTATIONS'], ownedNodeIds: new Set([sectionNode]) });
  const relocated = compileAuthority(proposalWith([
    { ref: 'c1', kind: 'ACTOR', label: 'representing party', quote: 'the Company represents and warrants to Parent and Merger Sub as follows:', source_span_id: wrongId, occurrence: 0, origin: 'INTRO', children: [] },
    own('c2', 'OPERATION', 'authority', 'has all necessary corporate power and authority to execute this Agreement'),
  ]));
  const [fact] = relocated.proposals;
  assert.equal(fact.validation_status, 'VALID', relocated.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.equal(fact.components[0].source_span_id !== wrongId, true, 'the component cites the span it was found in');
  assert.equal(fact.components[0].origin_structure_node_id, introNode);
  assert.equal(fact.components[0].start_byte, intro.indexOf('the Company represents'));
  const note = relocated.issues.find((issue) => issue.code === 'COMPONENT_SPAN_RELOCATED');
  assert.ok(note && note.kind === 'NOTE', 'the relocation is a note, not a hold');
  const { relocated: [entry], ...noteRest } = JSON.parse(note.message);
  assert.deepEqual(noteRest, { client_ref: 'p1' });
  assert.match(entry.to_span_id, /^[0-9a-f]{64}$/, 'the component\'s own span within the chapeau');
  assert.equal(entry.to_span_id, fact.components[0].source_span_id);
  const { to_span_id: _usedSpan, ...named } = entry;
  assert.deepEqual(named, { quote: 'the Company represents and warrants to Parent and Merger Sub as follows:', from_span_id: wrongId, to_closure_span_id: introSpan.span_id, to_span_kind: 'CHAPEAU', to_structure_node_id: introNode }, 'the id written, the closure span used');
  // Two chapeau spans holding the words: still unknown.
  const twice = compileAuthority(proposalWith([
    { ref: 'c1', kind: 'TERM', label: 'heading', quote: 'Section 3.4 Authority.', source_span_id: wrongId, occurrence: 0, origin: 'CHAPEAU', children: [] },
    own('c2', 'OPERATION', 'authority', 'has all necessary corporate power and authority to execute this Agreement'),
  ]));
  // "Section 3.4 Authority." is in the heading chapeau span and in the full section, but only one CHAPEAU span: relocated.
  assert.equal(twice.proposals[0].validation_status, 'VALID');
  const ambiguousClosure = { ...authorityClosure, spans: [introSpan, { ...introSpan, span_id: 'f'.repeat(64), structure_node_id: 'g'.repeat(64) }, headingSpan, full] };
  const ambiguous = compileExtraction({ sourceDocument: doc, legalSchema: legalSchemaV2, node: authorityNode, closure: ambiguousClosure, call, response: proposalWith([
    { ref: 'c1', kind: 'ACTOR', label: 'representing party', quote: 'the Company represents and warrants to Parent and Merger Sub as follows:', source_span_id: wrongId, occurrence: 0, origin: 'INTRO', children: [] },
    own('c2', 'OPERATION', 'authority', 'has all necessary corporate power and authority to execute this Agreement'),
  ]), routedFamilies: ['REPRESENTATIONS'], ownedNodeIds: new Set([sectionNode]) });
  assert.equal(ambiguous.proposals[0].validation_status, 'INVALID', 'two candidate spans: unknown stays unknown');
  assert.ok(ambiguous.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS' && /UNKNOWN_SOURCE_COMPONENT/.test(issue.message)));
  // An OWN quote on an unknown span resolves through the section only; words that are not the section's stay unknown.
  const ownUnknown = compileAuthority(proposalWith([
    { ref: 'c1', kind: 'ACTOR', label: 'representing party', quote: 'the Company represents and warrants to Parent and Merger Sub as follows:', source_span_id: wrongId, occurrence: 0, origin: 'OWN', children: [] },
    own('c2', 'OPERATION', 'authority', 'has all necessary corporate power and authority to execute this Agreement'),
  ]));
  assert.equal(ownUnknown.proposals[0].validation_status, 'INVALID');
});

// Work package 14 (manager, 2026-10-18, plan finding (81), NCS generation 5):
// 3.2 "no shares of Company Preferred Stock were issued and outstanding" and
// 2.1's cash leg "“Cash Consideration” means cash in an amount equal to the
// product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent
// Closing Price" were held on "AMOUNT needs a canonical value". The count of
// none is 0; the formula carries no number and a note; both facts are VALID.
test('a count of none and a formula amount compile as VALID facts; the formula is noted', () => {
  const capitalization = 'Section 3.2 Capitalization. As of the Capitalization Date, 1,000,000 shares of Company Common Stock were issued and outstanding and no shares of Company Preferred Stock were issued and outstanding.';
  const consideration = ' Section 2.1 Effect on Capital Stock. “Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.';
  const canonical = `${capitalization}${consideration}`;
  const doc = { source_document_id: 'e'.repeat(64), canonical_text: canonical };
  const section = (reference, nodeKey, start, end) => {
    const sectionNode = nodeKey.repeat(64);
    const span = { span_id: `${nodeKey}1`.repeat(32), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: start, end_byte: end, exact_text: canonical.slice(start, end) };
    return {
      node: { node_id: sectionNode, reference, kind: 'SECTION' },
      closure: { source_closure_id: `${nodeKey}2`.repeat(32), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: reference, full_section_span_id: span.span_id, spans: [span] },
      span,
    };
  };
  const cap = section('3.2', 'k', 0, bytes(capitalization));
  const con = section('2.1', 'q', bytes(capitalization), bytes(canonical));
  const own = (span, ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', children: [] });
  const body = (family, subtype, factType, statement, roles, quote, headline, components) => ({
    proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: family, subtype_key: subtype, fact_type: factType, statement, roles, value: null, evidence_quotes: [quote], headline, components }],
    groups: [{ client_ref: 'g1', family_key: family, subtype_key: subtype }],
    links: [],
  });
  const none = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: cap.node, closure: cap.closure, call, routedFamilies: ['CAPITALISATION'], ownedNodeIds: new Set([cap.node.node_id]),
    response: body('CAPITALISATION', 'ISSUED_AND_OUTSTANDING', 'CAPITALISATION_ISSUED_AND_OUTSTANDING', 'No shares of Company Preferred Stock were issued and outstanding.',
      { LEGAL_ACTOR_OR_SUBJECT: 'Company Preferred Stock', LEGAL_OPERATION: 'were issued and outstanding', OPERATIVE_OBJECT: 'no shares' },
      { quote: 'no shares of Company Preferred Stock were issued and outstanding', source_span_id: cap.span.span_id, occurrence: 0 },
      { label: 'Preferred stock outstanding', distinguishing_refs: ['c1'], summary: 'No shares of Company Preferred Stock are issued and outstanding' },
      [own(cap.span, 'c1', 'AMOUNT', 'no preferred shares', 'no shares of Company Preferred Stock'), own(cap.span, 'c2', 'OPERATION', 'issued and outstanding', 'were issued and outstanding')]),
  });
  assert.equal(none.proposals.length, 1);
  assert.equal(none.proposals[0].validation_status, 'VALID', none.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.deepEqual(none.proposals[0].components[0].value, { canonical: 0, unit: 'COUNT' });
  assert.equal(none.issues.some((issue) => issue.code === 'VALUE_IS_FORMULA'), false);

  const formulaQuote = '“Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.';
  const formula = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: con.node, closure: con.closure, call, routedFamilies: ['CONSIDERATION'], ownedNodeIds: new Set([con.node.node_id]),
    response: body('CONSIDERATION', 'CASH_COMPONENT', 'PER_SHARE_CASH_CONSIDERATION', 'The Cash Consideration is the Cash Exchange Ratio multiplied by the Parent Closing Price.',
      { LEGAL_ACTOR_OR_SUBJECT: 'Cash Consideration', LEGAL_OPERATION: 'means', OPERATIVE_OBJECT: 'cash in an amount equal to the product of the Cash Exchange Ratio and the Parent Closing Price' },
      { quote: formulaQuote, source_span_id: con.span.span_id, occurrence: 0 },
      { label: 'Cash Consideration', distinguishing_refs: ['c1'], summary: 'Cash Consideration means the Cash Exchange Ratio multiplied by the Parent Closing Price' },
      [own(con.span, 'c1', 'AMOUNT', 'cash consideration formula', formulaQuote)]),
  });
  assert.equal(formula.proposals.length, 1);
  assert.equal(formula.proposals[0].validation_status, 'VALID', formula.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.deepEqual(formula.proposals[0].components[0].value, { canonical: null, unit: null, form: 'FORMULA' });
  const note = formula.issues.find((issue) => issue.code === 'VALUE_IS_FORMULA');
  assert.ok(note && note.kind === 'NOTE', 'the formula is a note, not a hold');
  const parsed = JSON.parse(note.message);
  assert.equal(parsed.client_ref, 'p1');
  assert.deepEqual(parsed.formulas.map((entry) => [entry.path, entry.text]), [['0', formulaQuote]]);
  assert.equal(parsed.formulas[0].component_id, formula.proposals[0].components[0].component_id);
});

// Work package 18 (b) (plan finding (91), NCS generation 5, 5.11): the D&O
// tail premium cap, "the last aggregate annual premium paid by the Company
// prior to the date hereof", is a reference quantity with no number by
// design; the fact was held on "AMOUNT needs a canonical value".
test('an amount that names a reference quantity compiles as a VALID fact with a VALUE_IS_REFERENCE note; prose still holds', () => {
  const dno = 'Section 5.11 Indemnification. In no event shall the Company commit or spend on such premiums an amount in excess of 300% of the last aggregate annual premium paid by the Company prior to the date hereof for the Company’s current policies of directors’ and officers’ liability insurance (the “Base Amount”), or any other fee.';
  const doc = { source_document_id: 'e'.repeat(64), canonical_text: dno };
  const sectionNode = 'k'.repeat(64);
  const span = { span_id: 'k1'.repeat(32), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: 0, end_byte: bytes(dno), exact_text: dno };
  const dnoClosure = { source_closure_id: 'k2'.repeat(32), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: '5.11', full_section_span_id: span.span_id, spans: [span] };
  const dnoNode = { node_id: sectionNode, reference: '5.11', kind: 'SECTION' };
  const own = (ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', children: [] });
  const bodyWith = (components) => ({
    proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'DNO_INDEMNIFICATION', subtype_key: 'INDEMNIFICATION_AND_EXCULPATION', fact_type: 'TAIL_PREMIUM_CAP_OFF_AGREEMENT',
      statement: 'The Company shall not spend more than 300% of the last aggregate annual premium paid on the tail policy.',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'the Company', LEGAL_OPERATION: 'shall not commit or spend', OPERATIVE_OBJECT: 'an amount in excess of 300% of the last aggregate annual premium' },
      value: null, evidence_quotes: [{ quote: 'the last aggregate annual premium paid by the Company prior to the date hereof', source_span_id: span.span_id, occurrence: 0 }],
      headline: { label: 'Base Amount', distinguishing_refs: ['c1'], summary: 'Base Amount is the last aggregate annual premium paid before signing' }, components }],
    groups: [{ client_ref: 'g1', family_key: 'DNO_INDEMNIFICATION', subtype_key: 'INDEMNIFICATION_AND_EXCULPATION' }],
    links: [],
  });
  const compileDno = (body) => compileExtraction({ sourceDocument: doc, legalSchema: legalSchemaV2, node: dnoNode, closure: dnoClosure, call, routedFamilies: ['DNO_INDEMNIFICATION'], ownedNodeIds: new Set([sectionNode]), response: body });
  const referenceQuote = 'the last aggregate annual premium paid by the Company prior to the date hereof';
  const reference = compileDno(bodyWith([own('c1', 'AMOUNT', 'Base Amount', referenceQuote), own('c2', 'OPERATION', 'spending cap', 'shall the Company commit or spend')]));
  assert.equal(reference.proposals.length, 1);
  assert.equal(reference.proposals[0].validation_status, 'VALID', reference.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.deepEqual(reference.proposals[0].components[0].value, { canonical: null, unit: null, form: 'REFERENCE' });
  const note = reference.issues.find((issue) => issue.code === 'VALUE_IS_REFERENCE');
  assert.ok(note && note.kind === 'NOTE', 'the reference is a note, not a hold');
  const parsed = JSON.parse(note.message);
  assert.equal(parsed.client_ref, 'p1');
  assert.deepEqual(parsed.references.map((entry) => [entry.path, entry.text]), [['0', referenceQuote]]);
  assert.equal(parsed.references[0].component_id, reference.proposals[0].components[0].component_id);
  assert.equal(reference.issues.some((issue) => issue.code === 'VALUE_IS_FORMULA'), false);
  // Prose that is neither a number, a count in words, a formula nor a reference still holds.
  const prose = compileDno(bodyWith([own('c1', 'AMOUNT', 'a fee', 'any other fee'), own('c2', 'OPERATION', 'spending cap', 'shall the Company commit or spend')]));
  assert.equal(prose.proposals[0].validation_status, 'INVALID');
  assert.ok(prose.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS' && /needs a canonical value|no parsable value/.test(issue.message)));
  assert.equal(prose.issues.some((issue) => issue.code === 'VALUE_IS_REFERENCE'), false);
});

// Work package 18 (a) (plan finding (91), NCS generation 5, 4.7; 2026-10-18):
// the model cut the Article IV introduction's words (origin INTRO) and cited
// them on the Article III chapeau span, a span the closure knows that does
// not hold them; three of four facts were held "byte range missing". The
// words below are the two chapeaus and 4.7 as stored for the run.
test('an inherited-origin quote cited on a known span that lacks it is taken from the one closure span its origin allows, with a note; two candidates or own words keep the hold', () => {
  const articleIII = 'ARTICLE III\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\nExcept as set forth in (a) any Company SEC Document filed with or furnished to the Securities and Exchange Commission (the “SEC”) and available on EDGAR on or after January 1, 2026 and at least 24 hours prior to the date hereof ((i) without giving effect to any disclosure set forth in any Company SEC Document or any amendment to any Company SEC Document in each case filed on or after such time and (ii) other than any disclosures contained under the captions “Risk Factors” or “Forward-Looking Statements,” and any other disclosures that are primarily predictive, cautionary or forward-looking in nature), but it being understood that this clause (a) shall not be applicable to Section 3.2 (Capital Stock) and Section 3.25 (Brokers) or (b) the disclosure letter delivered by the Company to Parent immediately prior to or simultaneously with the execution of this Agreement (the “Company Disclosure Letter”), the Company represents and warrants to Parent and Merger Sub as follows:\n';
  const articleIV = 'ARTICLE IV\nREPRESENTATIONS AND WARRANTIES OF PARENT AND MERGER SUB\nExcept as set forth in (a) any Parent SEC Document filed with or furnished to the SEC and available on EDGAR on or after January 1, 2026 and at least 24 hours prior to the date hereof ((i) without giving effect to any disclosure set forth in any Parent SEC Document or any amendment to any Parent SEC Document in each case filed on or after such time and (ii) other than any disclosures contained under the captions “Risk Factors” or “Forward-Looking Statements,” and any other disclosures that are primarily predictive, cautionary or forward-looking in nature) or (b) the disclosure letter delivered by Parent to the Company immediately prior to or simultaneously with the execution of this Agreement (the “Parent Disclosure Letter”), Parent and Merger Sub represent and warrant to the Company as follows:\n34\n';
  const section = 'Section 4.7 Certain Information. None of the information supplied or to be supplied by or on behalf of Parent or Merger Sub for inclusion or incorporation by reference in (a) the Form S-4 will, at the time the Form S-4 becomes effective under the Securities Act, contain any untrue statement of a material fact or omit to state any material fact required to be stated therein or necessary to make the statements therein not misleading or (b) the Information Statement will, on the date it is first mailed to the stockholders of the Company, contain any untrue statement of a material fact or omit to state any material fact required to be stated therein or necessary in order to make the statements therein, in light of the circumstances under which they are made, not misleading. Subject to the first sentence of Section 3.8, the Form S-4 and the Information Statement will comply as to form in all material respects with the provisions of the Exchange Act and the rules and regulations thereunder. Notwithstanding the foregoing, neither Parent nor Merger Sub makes any representation or warranty with respect to statements included or incorporated by reference in the Form S-4 or the Information Statement based on information supplied by or on behalf of the Company specifically for inclusion or incorporation by reference therein.\n';
  const canonical = `${articleIII}${articleIV}${section}`;
  const iiiNode = 'h'.repeat(64);
  const ivNode = 'i'.repeat(64);
  const sectionNode = 's'.repeat(64);
  const iiiSpan = { span_id: 'a'.repeat(64), kind: 'CHAPEAU', structure_node_id: iiiNode, start_byte: 0, end_byte: bytes(articleIII), exact_text: articleIII };
  const ivSpan = { span_id: 'b'.repeat(64), kind: 'CHAPEAU', structure_node_id: ivNode, start_byte: bytes(articleIII), end_byte: bytes(articleIII) + bytes(articleIV), exact_text: articleIV };
  const full = { span_id: 'c'.repeat(64), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: bytes(articleIII) + bytes(articleIV), end_byte: bytes(canonical), exact_text: section };
  const closureWith = (spans) => ({
    source_closure_id: 'd'.repeat(64), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: '4.7', full_section_span_id: full.span_id,
    chapeau_span_ids: spans.filter((span) => span.kind === 'CHAPEAU').map((span) => span.span_id), spans,
  });
  const doc = { source_document_id: 'e'.repeat(64), canonical_text: canonical };
  const sectionNodeEntry = { node_id: sectionNode, reference: '4.7', kind: 'SECTION' };
  const own = (ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: full.span_id, occurrence: 0, origin: 'OWN', children: [] });
  const intro = (ref, kind, label, quote, origin = 'INTRO') => ({ ref, kind, label, quote, source_span_id: iiiSpan.span_id, occurrence: 0, origin, children: [] });
  const ownComponents = [
    own('c4', 'OBJECT', 'the documents', 'the Form S-4 and the Information Statement'),
    own('c5', 'OPERATION', 'form compliance', 'will comply as to form'),
    own('c6', 'MATERIALITY_QUALIFIER', 'materiality', 'in all material respects'),
  ];
  const proposalWith = (components) => ({
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
      statement: 'The Form S-4 and the Information Statement will comply as to form in all material respects with the Exchange Act.',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'Parent and Merger Sub', LEGAL_OPERATION: 'represent and warrant', OPERATIVE_OBJECT: 'the Form S-4 and the Information Statement' },
      value: null,
      evidence_quotes: [{ quote: 'the Form S-4 and the Information Statement will comply as to form in all material respects', source_span_id: full.span_id, occurrence: 0 }],
      headline: { label: 'Form S-4 and Information Statement', distinguishing_refs: ['c5'], summary: 'Form S-4 and Information Statement will comply as to form with the Exchange Act' },
      components,
    }],
    groups: [{ client_ref: 'g1', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION' }],
    links: [],
  });
  const compile47 = (body, closure = closureWith([iiiSpan, ivSpan, full])) => compileExtraction({ sourceDocument: doc, legalSchema: legalSchemaV2, node: sectionNodeEntry, closure, call, response: body, routedFamilies: ['REPRESENTATIONS'], ownedNodeIds: new Set([sectionNode]) });
  const quotes = [
    'Except as set forth in (a) any Parent SEC Document filed with or furnished to the SEC and available on EDGAR on or after January 1, 2026 and at least 24 hours prior to the date hereof',
    'the disclosure letter delivered by Parent to the Company immediately prior to or simultaneously with the execution of this Agreement',
    'Parent and Merger Sub represent and warrant to the Company as follows',
  ];
  const relocated = compile47(proposalWith([
    intro('c1', 'EXCEPTION', 'SEC documents exception', quotes[0]),
    intro('c2', 'EXCEPTION', 'disclosure letter exception', quotes[1]),
    intro('c3', 'ACTOR', 'representing parties', quotes[2]),
    ...ownComponents,
  ]));
  const [fact] = relocated.proposals;
  assert.equal(fact.validation_status, 'VALID', relocated.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  for (const [index, quote] of quotes.entries()) {
    const component = fact.components[index];
    assert.equal(component.start_byte, Buffer.byteLength(canonical.slice(0, canonical.indexOf(quote)), 'utf8'), `${quote.slice(0, 30)} is placed in the Article IV chapeau`);
    assert.equal(component.origin_structure_node_id, ivNode);
    assert.notEqual(component.source_span_id, iiiSpan.span_id, 'the component cites the span it was found in');
  }
  const note = relocated.issues.find((issue) => issue.code === 'COMPONENT_SPAN_RELOCATED');
  assert.ok(note && note.kind === 'NOTE', 'the relocation is a note, not a hold');
  const parsed = JSON.parse(note.message);
  assert.equal(parsed.client_ref, 'p1');
  assert.equal(parsed.relocated.length, 3);
  for (const [index, entry] of parsed.relocated.entries()) {
    const { to_span_id: usedSpan, ...named } = entry;
    assert.equal(usedSpan, fact.components[index].source_span_id);
    assert.deepEqual(named, { quote: quotes[index], from_span_id: iiiSpan.span_id, to_closure_span_id: ivSpan.span_id, to_span_kind: 'CHAPEAU', to_structure_node_id: ivNode, known_span: true }, 'the id written, the closure span used, and that the id was a known span');
  }
  // Two chapeau spans holding the words: the hold stands.
  const twin = { ...ivSpan, span_id: 'f'.repeat(64), structure_node_id: 'g'.repeat(64) };
  const ambiguous = compile47(proposalWith([intro('c3', 'ACTOR', 'representing parties', quotes[2]), ...ownComponents]), closureWith([iiiSpan, ivSpan, twin, full]));
  assert.equal(ambiguous.proposals[0].validation_status, 'INVALID', 'two candidate spans keep the hold');
  assert.ok(ambiguous.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS' && /byte range missing/.test(issue.message)));
  assert.equal(ambiguous.issues.some((issue) => issue.code === 'COMPONENT_SPAN_RELOCATED'), false);
  // Own words cited on a known span that lacks them stay as they are.
  const ownWords = compile47(proposalWith([intro('c3', 'ACTOR', 'representing parties', quotes[2], 'OWN'), ...ownComponents]));
  assert.equal(ownWords.proposals[0].validation_status, 'INVALID', 'own words are not relocated across spans');
  assert.equal(ownWords.issues.some((issue) => issue.code === 'COMPONENT_SPAN_RELOCATED'), false);
});

// Work package 18 (c) (plan finding (91); NCS generation 5, 5.14): at
// extraction the publicity row's words rules name the sub-item, over the
// detail the model wrote, and the change is noted.
test('a publicity proposal takes its sub-item from its words at extraction; the model\'s own detail gives way with a note', () => {
  const publicity = 'Section 5.14 Public Announcements. The press release announcing the execution and delivery of this Agreement shall be a joint release of Parent and the Company.';
  const doc = { source_document_id: 'e'.repeat(64), canonical_text: publicity };
  const sectionNode = 'p'.repeat(64);
  const span = { span_id: 'p1'.repeat(32), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: 0, end_byte: bytes(publicity), exact_text: publicity };
  const publicityClosure = { source_closure_id: 'p2'.repeat(32), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: '5.14', full_section_span_id: span.span_id, spans: [span] };
  const publicityNode = { node_id: sectionNode, reference: '5.14', kind: 'SECTION' };
  const own = (ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', children: [] });
  const compiled = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: publicityNode, closure: publicityClosure, call, routedFamilies: ['GENERAL_COVENANTS'], ownedNodeIds: new Set([sectionNode]), tableShapes,
    response: {
      proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'GENERAL_COVENANTS', subtype_key: 'PUBLICITY', fact_type: 'GENERAL_COVENANT_PRESENT',
        statement: 'The announcement press release is a joint release of Parent and the Company.',
        roles: { LEGAL_ACTOR_OR_SUBJECT: 'Parent and the Company', LEGAL_OPERATION: 'shall be a joint release of', OPERATIVE_OBJECT: 'The press release announcing the execution and delivery of this Agreement' },
        value: null, evidence_quotes: [{ quote: 'The press release announcing the execution and delivery of this Agreement shall be a joint release of Parent and the Company.', source_span_id: span.span_id, occurrence: 0 }],
        headline: { label: 'Publicity', distinguishing_refs: ['c2'], summary: 'Announcement press release must be a joint release of Parent and the Company' },
        components: [own('c1', 'OBJECT', 'the release', 'The press release announcing the execution and delivery of this Agreement'), own('c2', 'OPERATION', 'joint release', 'shall be a joint release of'), own('c3', 'ACTOR', 'parties', 'Parent and the Company')],
        conclusions: { table_key: 'general-covenants-table', row_label: 'Public announcements', row_detail: 'Joint release', cells: [{ column_id: 'obligor', code: 'EACH_PARTY', component_refs: ['c3'] }, { column_id: 'asDrafted', text: 'shall be a joint release of', component_refs: ['c1', 'c2', 'c3'] }] } }],
      groups: [{ client_ref: 'g1', family_key: 'GENERAL_COVENANTS', subtype_key: 'PUBLICITY' }],
      links: [],
    },
  });
  assert.equal(compiled.proposals.length, 1);
  assert.equal(compiled.proposals[0].validation_status, 'VALID', compiled.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.equal(compiled.proposals[0].conclusions.row_label, 'Public announcements');
  assert.equal(compiled.proposals[0].conclusions.row_detail, 'Announcement release');
  const note = compiled.issues.find((issue) => issue.code === 'ROW_DETAIL_FROM_WORDS');
  assert.ok(note && note.kind === 'NOTE');
  assert.deepEqual(JSON.parse(note.message), { client_ref: 'p1', from: 'Joint release', row_label: 'Public announcements', to: 'Announcement release' });
});
