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
  // Work package 20 (b): the extractor quotes across an SEC page footer (generation 5 stopped 42 quotes at one).
  assert.match(request.component_instruction, /a page number on a line of its own between two words of a sentence is an SEC page footer, not part of the words: quote across it with the number left out, never stop a quote at it/);
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
  assert.deepEqual(named, { quote: 'the Company represents and warrants to Parent and Merger Sub as follows:', from_span_id: wrongId, to_closure_span_id: introSpan.span_id, to_span_kind: 'CHAPEAU', to_structure_node_id: introNode, unknown_span: true }, 'the id written, the closure span used, and that the id was unknown');
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
  // Work package 20 (a) (implementer B's rule, finding (105); the manager's
  // (168)): the unknown inherited component is dropped with a note and the
  // fact, whose own words resolved, stays VALID.
  assert.equal(ambiguous.proposals[0].validation_status, 'VALID', 'two candidate spans: the inherited component is dropped, the fact kept');
  assert.equal(ambiguous.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS'), false);
  assert.equal(ambiguous.issues.some((issue) => issue.code === 'COMPONENT_SPAN_RELOCATED'), false);
  const droppedUnknown = ambiguous.issues.find((issue) => issue.code === 'CONTEXT_COMPONENT_DROPPED');
  assert.ok(droppedUnknown && droppedUnknown.kind === 'NOTE');
  assert.deepEqual(JSON.parse(droppedUnknown.message).dropped.map((entry) => [entry.origin, entry.reason, entry.source_span_id]), [['INTRO', 'UNKNOWN_SOURCE_COMPONENT', wrongId]]);
  assert.deepEqual(ambiguous.proposals[0].components.map((component) => component.label), ['authority']);
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
  // Two chapeau spans holding the words: no relocation. Work package 20
  // (a) (implementer B's rule, finding (105); the manager's (168)): the
  // inherited component that resolves nowhere is dropped with a note and
  // the fact, whose own words resolved, stays VALID.
  const twin = { ...ivSpan, span_id: 'f'.repeat(64), structure_node_id: 'g'.repeat(64) };
  const ambiguous = compile47(proposalWith([intro('c3', 'ACTOR', 'representing parties', quotes[2]), ...ownComponents]), closureWith([iiiSpan, ivSpan, twin, full]));
  assert.equal(ambiguous.proposals[0].validation_status, 'VALID', ambiguous.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.deepEqual(ambiguous.proposals[0].components.map((component) => component.text), ownComponents.map((component) => component.quote), 'the unresolved inherited component is gone, the own words kept');
  assert.equal(ambiguous.issues.some((issue) => issue.code === 'COMPONENT_SPAN_RELOCATED'), false);
  assert.equal(ambiguous.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS'), false);
  const droppedNote = ambiguous.issues.find((issue) => issue.code === 'CONTEXT_COMPONENT_DROPPED');
  assert.ok(droppedNote && droppedNote.kind === 'NOTE');
  assert.deepEqual(JSON.parse(droppedNote.message), { client_ref: 'p1', dropped: [{ path: '0', kind: 'ACTOR', origin: 'INTRO', label: 'representing parties', quote: quotes[2], source_span_id: iiiSpan.span_id, reason: 'NOT_EXACT_CONTIGUOUS_SOURCE_TEXT' }] });
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

// Work package 18 (d) (plan finding (93); NCS generation 5, 5.17): at
// extraction a covenant naming the Registration Statement leaves the row
// the model chose for Registration rights, with its sub-item, both noted.
test('a registration-rights covenant moves from General notification to the Registration rights table at extraction, one line, with the note', () => {
  const text = 'Section 5.17 Registration Rights. Parent shall use its reasonable best efforts to keep such Registration Statement continuously effective under the Securities Act until the date on which all Registrable Securities covered by such Registration Statement have been sold.';
  const doc = { source_document_id: 'e'.repeat(64), canonical_text: text };
  const sectionNode = 'r'.repeat(64);
  const span = { span_id: 'r1'.repeat(32), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: 0, end_byte: bytes(text), exact_text: text };
  const rightsClosure = { source_closure_id: 'r2'.repeat(32), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: '5.17', full_section_span_id: span.span_id, spans: [span] };
  const rightsNode = { node_id: sectionNode, reference: '5.17', kind: 'SECTION' };
  const own = (ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', children: [] });
  const compiled = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: rightsNode, closure: rightsClosure, call, routedFamilies: ['GENERAL_COVENANTS'], ownedNodeIds: new Set([sectionNode]), tableShapes,
    response: {
      proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'GENERAL_COVENANTS', subtype_key: 'GENERAL_NOTIFICATION', fact_type: 'GENERAL_COVENANT_PRESENT',
        statement: 'Parent keeps the Registration Statement effective until all Registrable Securities are sold.',
        roles: { LEGAL_ACTOR_OR_SUBJECT: 'Parent', LEGAL_OPERATION: 'shall use its reasonable best efforts to keep such Registration Statement continuously effective', OPERATIVE_OBJECT: 'such Registration Statement' },
        value: null, evidence_quotes: [{ quote: 'to keep such Registration Statement continuously effective under the Securities Act', source_span_id: span.span_id, occurrence: 0 }],
        headline: { label: 'Registration rights', distinguishing_refs: ['c3'], summary: 'Parent keeps Registration Statement effective until all Registrable Securities have been sold' },
        components: [own('c1', 'ACTOR', 'Parent', 'Parent'), own('c2', 'EFFORTS_STANDARD', 'standard', 'shall use its reasonable best efforts'), own('c3', 'OPERATION', 'keep effective', 'to keep such Registration Statement continuously effective under the Securities Act'), own('c4', 'PERIOD', 'until sold', 'until the date on which all Registrable Securities covered by such Registration Statement have been sold')],
        conclusions: { table_key: 'general-covenants-table', row_label: 'General notification', cells: [{ column_id: 'obligor', code: 'PARENT', component_refs: ['c1'] }, { column_id: 'standard', code: 'REASONABLE_BEST_EFFORTS', component_refs: ['c2'] }, { column_id: 'asDrafted', text: 'to keep such Registration Statement continuously effective under the Securities Act', component_refs: ['c3'] }] } }],
      groups: [{ client_ref: 'g1', family_key: 'GENERAL_COVENANTS', subtype_key: 'GENERAL_NOTIFICATION' }],
      links: [],
    },
  });
  assert.equal(compiled.proposals.length, 1);
  const [fact] = compiled.proposals;
  assert.equal(fact.validation_status, 'VALID', compiled.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  assert.equal(fact.conclusions.table_key, 'consideration-registration-rights', 'Ben: "reg rights I think goes with consideration (but at bottom)"');
  assert.equal(fact.conclusions.row_label, 'Registration rights');
  // Ben (plan finding (166)): "I wouldn't go into anywhere near this depth in this product": no sub-item.
  assert.equal(fact.conclusions.row_detail, undefined);
  assert.deepEqual(JSON.parse(compiled.issues.find((issue) => issue.code === 'ROW_FROM_WORDS').message), { client_ref: 'p1', from: 'General notification', from_table_key: 'general-covenants-table', to: 'Registration rights', to_table_key: 'consideration-registration-rights' });
  assert.equal(compiled.issues.some((issue) => issue.code === 'ROW_DETAIL_FROM_WORDS'), false);
});


// Work package 19 (c) (manager finding (165); NCS generation 5, 6.4): "this
// Article VI" resolves to the article node of the structure, so the three
// frustration facts are VALID and FRUSTRATION_BREACH_STANDARD is found.
test('a cross-reference to "this Article VI" resolves to the article node and the frustration fact is VALID', () => {
  const { buildAgreementStructure } = require('../lib/product/agreement-structure');
  const { buildSourceClosure } = require('../lib/product/source-context');
  const canonical = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE VI',
    'CONDITIONS PRECEDENT',
    'Section 6.1 Conditions to Each Party\'s Obligation.',
    'The obligations of each Party are subject to the satisfaction of the conditions in this Article VI.',
    'Section 6.4 Frustration of Closing Conditions.',
    'None of Parent, Merger Sub or the Company may rely on the failure of any condition set forth in this Article VI to be satisfied if such failure was caused by such Party\'s breach of this Agreement.',
  ].join('\n');
  const digest = sha(canonical);
  const doc = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: digest, agreement_id: digest,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm', final_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm',
    filing_accession: '0001193125-25-000001', exhibit_filename: 'ex21.htm', source_map_id: digest, canonical_text: canonical, canonical_text_sha256: digest,
  };
  const agreementStructure = buildAgreementStructure(doc);
  const article = agreementStructure.nodes.find((candidate) => candidate.kind === 'ARTICLE' && /ARTICLE VI$/.test(candidate.reference));
  const frustration = agreementStructure.nodes.find((candidate) => candidate.reference === '6.4');
  assert.ok(article && frustration);
  const frustrationClosure = buildSourceClosure({ sourceDocument: doc, agreementStructure, nodeId: frustration.node_id });
  const span = frustrationClosure.spans.find((candidate) => candidate.span_id === frustrationClosure.full_section_span_id);
  const own = (ref, kind, label, quote, extra = {}) => ({ ref, kind, label, quote, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', children: [], ...extra });
  const compiled = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: { node_id: frustration.node_id, reference: '6.4', kind: 'SECTION' }, closure: frustrationClosure, call,
    routedFamilies: ['CLOSING_CONDITIONS'], ownedNodeIds: new Set([frustration.node_id]), agreementStructure,
    response: {
      proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'CLOSING_CONDITIONS', subtype_key: 'FRUSTRATION', fact_type: 'FRUSTRATION_BREACH_STANDARD',
        statement: 'Parent cannot rely on a condition failure its own breach caused.',
        roles: { LEGAL_ACTOR_OR_SUBJECT: 'Parent', LEGAL_OPERATION: 'may rely on the failure of any condition', OPERATIVE_OBJECT: 'any condition set forth in this Article VI' },
        value: null, evidence_quotes: [{ quote: 'may rely on the failure of any condition set forth in this Article VI', source_span_id: span.span_id, occurrence: 0 }],
        headline: { label: 'Frustration of conditions', distinguishing_refs: ['c3'], summary: 'Parent cannot rely on a condition failure its own breach caused' },
        components: [
          own('c1', 'ACTOR', 'parties', 'None of Parent, Merger Sub or the Company'),
          own('c2', 'OPERATION', 'reliance', 'may rely on the failure of any condition set forth in this Article VI', { children: [own('c2a', 'CROSS_REFERENCE', 'this Article', 'this Article VI')] }),
          own('c3', 'CONDITION', 'own breach', 'if such failure was caused by such Party\'s breach of this Agreement'),
        ] }],
      groups: [{ client_ref: 'g1', family_key: 'CLOSING_CONDITIONS', subtype_key: 'FRUSTRATION' }],
      links: [],
      coverage: { CLOSING_CONDITIONS: 'FOUND' },
      fact_type_coverage: { CLOSING_CONDITIONS: { FRUSTRATION_BREACH_STANDARD: 'FOUND' } },
    },
  });
  assert.equal(compiled.proposals.length, 1);
  const [fact] = compiled.proposals;
  assert.equal(fact.validation_status, 'VALID', compiled.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
  const reference = fact.components[1].children[0];
  assert.equal(reference.kind, 'CROSS_REFERENCE');
  assert.equal(reference.resolves_to.structure_node_id, article.node_id, 'the article node of the structure');
  assert.equal(reference.resolves_to.text, 'ARTICLE VI CONDITIONS PRECEDENT');
  const frustrationCoverage = compiled.coverage.find((assertion) => assertion.subject_kind === 'FACT_TYPE' && assertion.reason === 'FACT_TYPE:FRUSTRATION_BREACH_STANDARD');
  if (frustrationCoverage) assert.equal(frustrationCoverage.state, 'FOUND');
  // Without the structure, the reference still has nothing to resolve to and the fact is held.
  const unresolved = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: { node_id: frustration.node_id, reference: '6.4', kind: 'SECTION' }, closure: frustrationClosure, call,
    routedFamilies: ['CLOSING_CONDITIONS'], ownedNodeIds: new Set([frustration.node_id]),
    response: {
      proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'CLOSING_CONDITIONS', subtype_key: 'FRUSTRATION', fact_type: 'FRUSTRATION_BREACH_STANDARD',
        statement: 'Parent cannot rely on a condition failure its own breach caused.',
        roles: { LEGAL_ACTOR_OR_SUBJECT: 'Parent', LEGAL_OPERATION: 'may rely on the failure of any condition', OPERATIVE_OBJECT: 'any condition set forth in this Article VI' },
        value: null, evidence_quotes: [{ quote: 'may rely on the failure of any condition set forth in this Article VI', source_span_id: span.span_id, occurrence: 0 }],
        headline: { label: 'Frustration of conditions', distinguishing_refs: ['c3'], summary: 'Parent cannot rely on a condition failure its own breach caused' },
        components: [own('c2', 'OPERATION', 'reliance', 'may rely on the failure of any condition set forth in this Article VI', { children: [own('c2a', 'CROSS_REFERENCE', 'this Article', 'this Article VI')] })] }],
      groups: [{ client_ref: 'g1', family_key: 'CLOSING_CONDITIONS', subtype_key: 'FRUSTRATION' }],
      links: [],
    },
  });
  assert.equal(unresolved.proposals[0].validation_status, 'INVALID');
});

// Work package 22, item 4 (the manager's second addendum, finding (217)):
// the cheaper tiers omit the representation qualifiers and the Exchange
// Fund sentence on every run; the request names those facts per routed
// family.
test('the extraction request names the representation qualification facts and the Exchange Fund fact for the routed families only', async () => {
  const { sourceDoc, agreementStructure } = representationsSource();
  const representationNode = substantiveSections(agreementStructure).find((candidate) => candidate.reference === '3.01');
  const mergerNode = substantiveSections(agreementStructure).find((candidate) => candidate.reference === '1.01');
  const requestFor = async (node, families) => {
    let request = null;
    await buildAgreementSectionDraft({
      sourceDocument: sourceDoc, agreementStructure, node, legalSchema: legalSchemaV2, tableShapes,
      model: {
        async complete({ call_kind, request: seen }) {
          let modelResponse;
          if (call_kind === 'ROUTING') modelResponse = { families, disposition: 'FAMILY_ASSIGNED', rationale: 'routed', deterministic_disagreements: [] };
          else if (call_kind === 'RESIDUAL') modelResponse = { paragraphs: seen.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: families, rationale: 'routed' })) };
          else {
            request = seen;
            modelResponse = { proposals: [], groups: [], links: [], coverage: Object.fromEntries(families.map((key) => [key, 'NOT_FOUND'])), fact_type_coverage: Object.fromEntries(seen.family_contracts.map((contract) => [contract.family_key, Object.fromEntries(contract.required_fact_types.map((type) => [type, 'NOT_FOUND']))])) };
          }
          return { provider_id: 'TEST', model_id: 'TEST', response: modelResponse, raw_request: seen, raw_response: modelResponse, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
        },
      },
    });
    assert.ok(request);
    return request;
  };
  const both = await requestFor(representationNode, ['REPRESENTATIONS', 'CONSIDERATION']);
  assert.match(both.component_instruction, /return one REPRESENTATION_QUALIFICATION proposal per source of exception as a fact of this section, its components the introduction's words with origin INTRO/);
  // Finding (204): a framing phrase is not a reference; the agreement as a whole resolves to the agreement.
  assert.match(both.component_instruction, /a framing phrase that names no provision \("For purposes of this Agreement", "hereof", "as used herein"\) is not a CROSS_REFERENCE/);
  assert.match(both.component_instruction, /The sentence that constitutes the exchange fund \(the deposit of the consideration with the Exchange Agent, "\(the “Exchange Fund”\)"\) is an EXCHANGE_MECHANICS fact of its own/);
  // The merger article's section, routed to the merger family alone,
  // carries neither sentence.
  const merger = await requestFor(mergerNode, ['MERGER_STRUCTURE_CLOSING']);
  assert.doesNotMatch(merger.component_instruction, /REPRESENTATION_QUALIFICATION proposal per source of exception/);
  assert.doesNotMatch(merger.component_instruction, /EXCHANGE_MECHANICS fact of its own/);
});

// Work package 22 (the manager's (216); the Sonnet 5.5 confirmation on NCS
// generation 5): ten MAE carve-out, carve-back and underlying-cause facts
// on 3.1 and 4.1 were held "CROSS_REFERENCE must resolve" because the
// reference's words are the definition's own clause numbers ("clauses (1),
// (2), (3), (4) and (7)", "this clause (10)"), which have no node of the
// structure, and Sonnet gave no resolves_to where Opus 5 had filled it
// with the section's node. The code now resolves the clause form from the
// text; a plain "Section 2.1(a)" (8.3) resolves to its section; a LIST the
// model wrote without words of its own takes its resolved elements' words
// (5.16, 3.18).
test('a cross-reference by clause number resolves to the clauses of the definition it sits in; a plain Section reference to its section; a wordless LIST takes its elements\' words', () => {
  const definition = '"Material Adverse Effect" means any event, change or effect that is materially adverse to the Company, excluding (1) changes or conditions generally affecting the industry, (2) changes in Law, (3) changes in GAAP, (4) acts of war or terrorism, (5) the announcement of this Agreement, (6) any change in the market price of the Company Common Stock (provided, that the exception in this clause (6) shall not prevent a determination that the underlying cause has resulted in a Material Adverse Effect) or (7) seasonal fluctuations in revenue; provided that, with respect to clauses (1), (2), (3) and (4), the impact of such event is not disproportionately adverse to the Company as compared to other participants in the industry.';
  const canonical = `Section 3.1 Organization, Standing and Power. The Company is duly organized. ${definition}\n`;
  const fullId = 'x'.repeat(64);
  const own = wp20Own(fullId);
  const fact = (components, extra = {}) => ({
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'The disproportionality carve-back applies to the industry, Law, GAAP and war carve-outs.',
    evidence_quotes: [{ quote: 'is not disproportionately adverse to the Company', source_span_id: fullId, occurrence: 0 }],
    components,
    ...extra,
  });
  const compiled = wp20Compile({ canonical, reference: '3.1', proposals: [
    // Sonnet's form: the clause numbers, no resolves_to.
    fact([
      own('c1', 'CROSS_REFERENCE', 'clauses subject to the carve-back', 'clauses (1), (2), (3) and (4)'),
      own('c2', 'OPERATION', 'carve-back', 'is not disproportionately adverse to the Company'),
    ]),
    fact([
      own('c1', 'CROSS_REFERENCE', 'share price exception', 'the exception in this clause (6)'),
      own('c2', 'OPERATION', 'restoration', 'shall not prevent a determination that the underlying cause has resulted in a Material Adverse Effect'),
    ]),
    // Opus 5's form: the model's own resolves_to stands.
    fact([
      own('c1', 'CROSS_REFERENCE', 'clauses subject to the carve-back', 'with respect to clauses (1), (2), (3) and (4)', { resolves_to: { structure_node_id: 'n'.repeat(64), text: 'the carve-outs' } }),
      own('c2', 'OPERATION', 'carve-back', 'is not disproportionately adverse to the Company'),
    ]),
    // A clause the text does not have stays unresolved and the fact held.
    fact([
      own('c1', 'CROSS_REFERENCE', 'clauses subject to the carve-back', 'clauses (1) and (9)'),
      own('c2', 'OPERATION', 'carve-back', 'is not disproportionately adverse to the Company'),
    ]),
  ] });
  const [carveBack, restoration, opus, missing] = compiled.proposals;
  assert.equal(carveBack.validation_status, 'VALID', issueLines(compiled));
  assert.equal(carveBack.components[0].resolves_to.structure_node_id, compiled.full.structure_node_id, 'the section the definition sits in');
  assert.equal(carveBack.components[0].resolves_to.text, '(1) changes or conditions generally affecting the industry | (2) changes in Law | (3) changes in GAAP | (4) acts of war or terrorism');
  assert.equal(restoration.validation_status, 'VALID', issueLines(compiled));
  assert.match(restoration.components[0].resolves_to.text, /^\(6\) any change in the market price of the Company Common Stock \(provided, that the exception in this clause \(6\)/);
  assert.equal(restoration.components[0].resolves_to.text.includes('(7) seasonal'), false, 'the clause ends at the next enumerator');
  assert.equal(opus.validation_status, 'VALID', issueLines(compiled));
  assert.deepEqual(opus.components[0].resolves_to, { structure_node_id: 'n'.repeat(64), text: 'the carve-outs' });
  assert.equal(missing.validation_status, 'INVALID');
  assert.ok(compiled.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS' && /CROSS_REFERENCE must resolve/.test(issue.message)), issueLines(compiled));

  // A plain "Section 2.1(a)" resolves to its section node of the structure.
  const { buildSourceClosure } = require('../lib/product/source-context');
  const agreement = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE II',
    'THE MERGER',
    'Section 2.1 Conversion of Capital Stock.',
    '(a) Each Eligible Share shall be converted into the right to receive the Merger Consideration.',
    'Section 2.3 Exchange Fund.',
    'Parent shall deposit the Parent Ordinary Shares issuable pursuant to Section 2.1(a) with the Exchange Agent.',
  ].join('\n');
  const digest = sha(agreement);
  const doc = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: digest, agreement_id: digest,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm', final_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm',
    filing_accession: '0001193125-25-000001', exhibit_filename: 'ex21.htm', source_map_id: digest, canonical_text: agreement, canonical_text_sha256: digest,
  };
  const agreementStructure = buildAgreementStructure(doc);
  const conversion = agreementStructure.nodes.find((candidate) => candidate.reference === '2.1');
  const exchange = agreementStructure.nodes.find((candidate) => candidate.reference === '2.3');
  assert.ok(conversion && exchange);
  const exchangeClosure = buildSourceClosure({ sourceDocument: doc, agreementStructure, nodeId: exchange.node_id });
  const exchangeSpan = exchangeClosure.spans.find((candidate) => candidate.span_id === exchangeClosure.full_section_span_id);
  const sectionOwn = (ref, kind, label, quote, extra = {}) => ({ ref, kind, label, quote, source_span_id: exchangeSpan.span_id, occurrence: 0, origin: 'OWN', children: [], ...extra });
  const deposited = compileExtraction({
    sourceDocument: doc, legalSchema: legalSchemaV2, node: { node_id: exchange.node_id, reference: '2.3', kind: 'SECTION' }, closure: exchangeClosure, call,
    routedFamilies: ['CONSIDERATION'], ownedNodeIds: new Set([exchange.node_id]), agreementStructure,
    response: {
      proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'CONSIDERATION', subtype_key: 'EXCHANGE_MECHANICS', fact_type: 'PER_SHARE_CASH_CONSIDERATION',
        statement: 'Parent deposits the Parent Ordinary Shares issuable under Section 2.1(a) with the Exchange Agent.',
        roles: { LEGAL_ACTOR_OR_SUBJECT: 'Parent', LEGAL_OPERATION: 'shall deposit', OPERATIVE_OBJECT: 'the Parent Ordinary Shares' },
        value: null, evidence_quotes: [{ quote: 'Parent shall deposit the Parent Ordinary Shares issuable pursuant to Section 2.1(a)', source_span_id: exchangeSpan.span_id, occurrence: 0 }],
        headline: { label: 'Exchange fund', distinguishing_refs: ['c2'], summary: 'Parent deposits the share consideration with the Exchange Agent' },
        components: [
          sectionOwn('c1', 'ACTOR', 'depositor', 'Parent'),
          sectionOwn('c2', 'OPERATION', 'deposit', 'shall deposit the Parent Ordinary Shares issuable pursuant to Section 2.1(a)', { children: [sectionOwn('c2a', 'CROSS_REFERENCE', 'conversion provision', 'Section 2.1(a)')] }),
        ] }],
      groups: [{ client_ref: 'g1', family_key: 'CONSIDERATION', subtype_key: 'EXCHANGE_MECHANICS' }],
      links: [],
    },
  });
  assert.equal(deposited.proposals.length, 1, issueLines(deposited));
  const [deposit] = deposited.proposals;
  const sectionReference = deposit.components[1].children[0];
  assert.equal(sectionReference.resolves_to?.structure_node_id, conversion.node_id, issueLines(deposited));
  assert.equal(deposited.issues.some((issue) => /CROSS_REFERENCE must resolve/.test(issue.message)), false, issueLines(deposited));
  // 5.10 and 8.3 of the same confirmation: the reference cut with the words
  // that introduce it resolves the same way; "this Agreement" to the root.
  const article = agreementStructure.nodes.find((candidate) => candidate.kind === 'ARTICLE');
  const context = { sourceDocument: doc, closure: exchangeClosure, agreementStructure };
  const { resolveSpanReference: _unused, ...draft } = require('../lib/product/agreement-draft');
  assert.equal(draft.structureReferenceTarget('set forth in Article II', context)?.structure_node_id, article.node_id);
  assert.equal(draft.structureReferenceTarget('pursuant to Section 2.1(a)', context)?.structure_node_id, conversion.node_id);
  assert.equal(draft.structureReferenceTarget('For purposes of this Agreement', context)?.structure_node_id, agreementStructure.root_node_id);
  assert.equal(draft.structureReferenceTarget('Section 9.9', context), null, 'a section the agreement lacks stays unresolved');

  // A LIST with no words of its own and every element resolved takes the
  // elements' words; the note says so.
  const welfare = 'Section 5.16 Employee Matters. Parent shall cause each welfare plan to waive all preexisting conditions or limitations, eligibility waiting periods, actively at work requirements and evidence of insurability requirements for the Continuing Employees.\n';
  const listed = wp20Compile({ canonical: welfare, reference: '5.16', proposals: [{
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'Parent causes each welfare plan to waive preexisting condition limitations, waiting periods, actively-at-work and insurability requirements.',
    evidence_quotes: [{ quote: 'waive all preexisting conditions or limitations', source_span_id: fullId, occurrence: 0 }],
    components: [
      own('c1', 'OPERATION', 'waiver', 'waive all'),
      { ref: 'c2', kind: 'LIST', label: 'waived requirements', source_span_id: fullId, origin: 'OWN', children: [
        own('c2a', 'LIST_ELEMENT', 'preexisting conditions', 'preexisting conditions or limitations'),
        own('c2b', 'LIST_ELEMENT', 'waiting periods', 'eligibility waiting periods'),
        own('c2c', 'LIST_ELEMENT', 'actively at work', 'actively at work requirements'),
        own('c2d', 'LIST_ELEMENT', 'insurability', 'evidence of insurability requirements'),
      ] },
    ],
  }] });
  const [waiver] = listed.proposals;
  assert.equal(waiver.validation_status, 'VALID', issueLines(listed));
  const list = waiver.components[1];
  assert.equal(list.kind, 'LIST');
  assert.equal(list.text, 'preexisting conditions or limitations, eligibility waiting periods, actively at work requirements and evidence of insurability requirements');
  assert.equal(list.start_byte, list.children[0].start_byte);
  assert.equal(list.end_byte, list.children[3].end_byte);
  assert.deepEqual(JSON.parse(listed.issues.find((issue) => issue.code === 'LIST_WORDS_FROM_ELEMENTS').message), { client_ref: 'p1', lists: [{ path: '1', elements: 4 }] });
});

// Work package 20 (implementer B's defects (5) to (7) and rule, finding
// (105); the manager's (168); 2026-10-18). The fixtures below are cut from
// the NCS filing as stored for generation 5.
function wp20Compile({ canonical, reference, contextSpans = [], proposals, sectionText = canonical, answer = {} }) {
  const sectionNode = 'w'.repeat(64);
  const sectionStart = bytes(canonical) - bytes(sectionText);
  const full = { span_id: 'x'.repeat(64), kind: 'FULL_SECTION', structure_node_id: sectionNode, start_byte: sectionStart, end_byte: bytes(canonical), exact_text: sectionText };
  const spans = [...contextSpans, full];
  const closure = {
    source_closure_id: 'y'.repeat(64), structure_node_id: sectionNode, section_node_id: sectionNode, section_reference: reference, full_section_span_id: full.span_id,
    chapeau_span_ids: spans.filter((span) => span.kind === 'CHAPEAU').map((span) => span.span_id), spans,
  };
  const doc = { source_document_id: 'z'.repeat(64), canonical_text: canonical };
  const built = proposals.map((proposal, index) => {
    const merged = {
      client_ref: `p${index + 1}`, group_ref: `g${index + 1}`, family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'the Company', LEGAL_OPERATION: 'represents and warrants', OPERATIVE_OBJECT: 'the matter' },
      value: null,
      headline: { label: 'Representation', distinguishing_refs: [proposal.components[0].ref], summary: 'The Company represents the matter stated in the section' },
      ...proposal,
    };
    // A key given as undefined is a key the model left out.
    for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
    return merged;
  });
  const body = {
    proposals: built,
    groups: built.map((proposal) => ({ client_ref: proposal.group_ref, family_key: proposal.family_key, subtype_key: proposal.subtype_key })),
    links: [],
    ...answer,
  };
  const result = compileExtraction({ sourceDocument: doc, legalSchema: legalSchemaV2, node: { node_id: sectionNode, reference, kind: 'SECTION' }, closure, call, response: body, routedFamilies: ['REPRESENTATIONS'], ownedNodeIds: new Set([sectionNode]) });
  return { ...result, full, doc };
}
function* walkComponents(list) { for (const component of list || []) { yield component; yield* walkComponents(component.children); } }
const wp20Own = (fullSpanId) => (ref, kind, label, quote, extra = {}) => ({ ref, kind, label, quote, source_span_id: fullSpanId, occurrence: 0, origin: 'OWN', children: [], ...extra });
const issueLines = (result) => result.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n');

// (b) NCS generation 5, 5.4: "any information relating to the Transactions,
// \n49\nthe Company or Parent" runs across a page footer; the model's
// TRIGGER stopped at the footer. A quote across the footer is matched with
// the footer line skipped; its bytes include the footer and its text is
// those bytes, which the page shows without the footer.
test('a quote across an SEC page footer is matched with the footer skipped, with or without the page number in the quote; whitespace alone never relaxes the verbatim rule', () => {
  const { hidePageFooters } = require('../lib/product/source-display');
  const canonical = 'Section 5.4 Preparation of Form S-4. If, at any time prior to the Effective Time, any information relating to the Transactions,\n49\nthe Company or Parent, or any of their respective Affiliates, should be discovered by the Company or Parent, the Party that discovers such information shall promptly notify the other Parties.\n';
  const fullId = 'x'.repeat(64);
  const own = wp20Own(fullId);
  const trigger = 'If, at any time prior to the Effective Time, any information relating to the Transactions, the Company or Parent, or any of their respective Affiliates, should be discovered by the Company or Parent';
  const components = (triggerQuote) => [
    own('c1', 'TRIGGER', 'discovery', triggerQuote),
    own('c2', 'ACTOR', 'discovering party', 'the Party that discovers such information'),
    own('c3', 'OPERATION', 'notice', 'shall promptly notify the other Parties'),
  ];
  const proposal = (triggerQuote, evidenceQuote) => ({
    statement: 'The Party that discovers information requiring an amendment shall promptly notify the other Parties.',
    evidence_quotes: [{ quote: evidenceQuote, source_span_id: fullId, occurrence: 0 }],
    components: components(triggerQuote),
  });
  const skipped = wp20Compile({ canonical, reference: '5.4', proposals: [proposal(trigger, 'relating to the Transactions, 49 the Company or Parent')] });
  const [fact] = skipped.proposals;
  assert.equal(fact.validation_status, 'VALID', issueLines(skipped));
  const [component] = fact.components;
  const start = bytes(canonical.slice(0, canonical.indexOf('If, at any time')));
  const end = bytes(canonical.slice(0, canonical.indexOf(', the Party that discovers')));
  assert.equal(component.start_byte, start);
  assert.equal(component.end_byte, end, 'the byte range runs across the footer');
  assert.equal(component.text, canonical.slice(canonical.indexOf('If, at any time'), canonical.indexOf(', the Party that discovers')), 'the text is the canonical bytes, footer included');
  assert.match(component.text, /Transactions,\n49\nthe Company/);
  assert.equal(hidePageFooters(component.text), trigger, 'the page shows the words without the footer');
  assert.equal(fact.source_span_ids.length, 1, 'the evidence quote with the page number as a word matched too');
  // The footer is not a licence for other whitespace differences.
  const loose = wp20Compile({ canonical, reference: '5.4', proposals: [proposal('If, at any time prior to the  Effective Time', 'the Party that discovers such information')] });
  assert.equal(loose.proposals[0].validation_status, 'INVALID');
  assert.ok(loose.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS' && /byte range missing/.test(issue.message)), issueLines(loose));
});

// (a) The evidence-quote side of work packages 13 (a) and 18 (a), and B's
// rule. NCS generation 5, 4.7: the three facts cited the Article IV
// introduction's words on the Article III chapeau span (in 4.7's closure
// through its reference to Section 3.8) as evidence quotes, which carry no
// origin, and were held PROPOSAL_EVIDENCE_NOT_EXACT while their components
// relocated. The cited span's kind stands for the origin; an inherited
// quote that resolves nowhere is dropped with a note when the own words
// resolved; own words that do not resolve still hold.
test('an evidence quote cited on a context span that lacks it is relocated by the span kind; an unresolvable one is dropped with a note when the own evidence is exact', () => {
  const articleIII = 'ARTICLE III\nExcept as set forth in the Company Disclosure Letter, the Company represents and warrants to Parent and Merger Sub as follows:\n';
  const articleIV = 'ARTICLE IV\nExcept as set forth in the Parent Disclosure Letter, Parent and Merger Sub represent and warrant to the Company as follows:\n';
  const section = 'Section 4.7 Certain Information. Subject to the first sentence of Section 3.8, the Form S-4 and the Information Statement will comply as to form in all material respects with the provisions of the Exchange Act.\n';
  const canonical = `${articleIII}${articleIV}${section}`;
  const iiiSpan = { span_id: 'a'.repeat(64), kind: 'CHAPEAU', structure_node_id: 'h'.repeat(64), start_byte: 0, end_byte: bytes(articleIII), exact_text: articleIII };
  const ivSpan = { span_id: 'b'.repeat(64), kind: 'CHAPEAU', structure_node_id: 'i'.repeat(64), start_byte: bytes(articleIII), end_byte: bytes(articleIII) + bytes(articleIV), exact_text: articleIV };
  const twin = { ...ivSpan, span_id: 'f'.repeat(64), structure_node_id: 'g'.repeat(64) };
  const fullId = 'x'.repeat(64);
  const own = wp20Own(fullId);
  const introQuote = 'Parent and Merger Sub represent and warrant to the Company as follows';
  const proposal = (ownQuote = 'will comply as to form in all material respects') => ({
    statement: 'The Form S-4 and the Information Statement will comply as to form in all material respects with the Exchange Act.',
    evidence_quotes: [
      { quote: ownQuote, source_span_id: fullId, occurrence: 0 },
      { quote: introQuote, source_span_id: iiiSpan.span_id, occurrence: 0 },
    ],
    components: [
      own('c1', 'OBJECT', 'the documents', 'the Form S-4 and the Information Statement'),
      own('c2', 'OPERATION', 'form compliance', 'will comply as to form'),
      own('c3', 'MATERIALITY_QUALIFIER', 'materiality', 'in all material respects'),
    ],
  });
  const relocated = wp20Compile({ canonical, reference: '4.7', sectionText: section, contextSpans: [iiiSpan, ivSpan], proposals: [proposal()] });
  assert.equal(relocated.proposals[0].validation_status, 'VALID', issueLines(relocated));
  assert.equal(relocated.proposals[0].unmatched_evidence, undefined);
  const relocationNote = relocated.issues.find((issue) => issue.code === 'EVIDENCE_SPAN_RELOCATED');
  assert.ok(relocationNote && relocationNote.kind === 'NOTE', issueLines(relocated));
  assert.deepEqual(JSON.parse(relocationNote.message), { relocated: [{ quote: introQuote, from_span_id: iiiSpan.span_id, to_closure_span_id: ivSpan.span_id, to_span_kind: 'CHAPEAU', to_structure_node_id: ivSpan.structure_node_id }] });
  // Two chapeau spans holding the words: the inherited quote is dropped, the fact stays VALID.
  const dropped = wp20Compile({ canonical, reference: '4.7', sectionText: section, contextSpans: [iiiSpan, ivSpan, twin], proposals: [proposal()] });
  assert.equal(dropped.proposals[0].validation_status, 'VALID', issueLines(dropped));
  assert.equal(dropped.issues.some((issue) => issue.code === 'PROPOSAL_EVIDENCE_NOT_EXACT'), false);
  const droppedNote = dropped.issues.find((issue) => issue.code === 'CONTEXT_EVIDENCE_DROPPED');
  assert.ok(droppedNote && droppedNote.kind === 'NOTE', issueLines(dropped));
  assert.deepEqual(JSON.parse(droppedNote.message), { dropped: [{ quote: introQuote, source_span_id: iiiSpan.span_id, span_kind: 'CHAPEAU', reason: 'NOT_EXACT_CONTIGUOUS_SOURCE_TEXT' }] });
  assert.deepEqual(dropped.proposals[0].dropped_evidence.map((item) => item.quote), [introQuote]);
  // Own words that are not in the section still hold the fact.
  const ownMissing = wp20Compile({ canonical, reference: '4.7', sectionText: section, contextSpans: [iiiSpan, ivSpan, twin], proposals: [proposal('words not in the agreement')] });
  assert.equal(ownMissing.proposals[0].validation_status, 'INVALID');
  assert.ok(ownMissing.issues.some((issue) => issue.code === 'PROPOSAL_EVIDENCE_NOT_EXACT'));
  assert.equal(ownMissing.issues.some((issue) => issue.code === 'CONTEXT_EVIDENCE_DROPPED'), false, 'nothing is dropped when no own evidence is exact');
});

// (c) NCS generation 5, 3.27 and 4.13: "has taken any action or knows of
// any fact, agreement, plan or other circumstance that would reasonably be
// expected to prevent ..." as one fact. Two predicates of one subject
// joined by "or" are a reviewer note; "and" between a status and its
// consequence (3.17) is not.
test('two predicates of one subject joined by "or" in a representation are noted as fused limbs; a predicate joined by "and" is not', () => {
  const fullId = 'x'.repeat(64);
  const own = wp20Own(fullId);
  const canonical = 'Section 3.27 Reorganization Qualification. Neither the Company nor any of its Subsidiaries has taken any action or knows of any fact, agreement, plan or other circumstance that would reasonably be expected to prevent or preclude the Merger from qualifying for the Intended Tax Treatment.\n';
  const fused = wp20Compile({ canonical, reference: '3.27', proposals: [{
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'The Company represents and warrants that neither it nor any Subsidiary has taken any action or knows of any fact that would reasonably be expected to prevent the Intended Tax Treatment.',
    evidence_quotes: [{ quote: 'has taken any action or knows of any fact', source_span_id: fullId, occurrence: 0 }],
    components: [
      own('c1', 'ACTOR', 'subject', 'Neither the Company nor any of its Subsidiaries'),
      own('c2', 'OPERATION', 'no action taken', 'has taken any action'),
      own('c3', 'QUALIFIER', 'no knowledge', 'knows of any fact, agreement, plan or other circumstance'),
      own('c4', 'STANDARD', 'standard', 'would reasonably be expected to'),
      own('c5', 'OBJECT', 'tax treatment', 'prevent or preclude the Merger from qualifying for the Intended Tax Treatment'),
    ],
  }] });
  assert.equal(fused.proposals[0].validation_status, 'VALID', issueLines(fused));
  const note = fused.issues.find((issue) => issue.code === 'FUSED_REPRESENTATION_LIMBS');
  assert.ok(note && note.kind === 'NOTE', issueLines(fused));
  const parsed = JSON.parse(note.message);
  assert.deepEqual(parsed.limbs, [{ first: 'has taken any action', second: 'knows of any fact, agreement, plan or other circumstance', joined_by: 'or' }]);
  const breach = 'Section 3.17 Material Contracts. Neither the Company nor any of its Subsidiaries is in material breach or default, and has not taken any action or failed to take any action which would constitute a default under any Material Contract.\n';
  const conjoined = wp20Compile({ canonical: breach, reference: '3.17', proposals: [{
    subtype_key: 'CONTRACT_REPRESENTATION',
    statement: 'The Company represents and warrants that neither it nor any Subsidiary is in material breach or default under any Material Contract.',
    evidence_quotes: [{ quote: 'is in material breach or default', source_span_id: fullId, occurrence: 0 }],
    components: [
      own('c1', 'ACTOR', 'subject', 'Neither the Company nor any of its Subsidiaries'),
      own('c2', 'OPERATION', 'no breach', 'is in material breach or default'),
      own('c3', 'QUALIFIER', 'no action', 'has not taken any action or failed to take any action which would constitute a default'),
    ],
  }] });
  assert.equal(conjoined.proposals[0].validation_status, 'VALID', issueLines(conjoined));
  assert.equal(conjoined.issues.some((issue) => issue.code === 'FUSED_REPRESENTATION_LIMBS'), false);
});

// (d) NCS generation 5, 3.5(b) and 4.4(b) (3.7 the same): the consents
// representation's "except for (i) ..., (ii) ..., (iii) ..." cut as one
// fact per item beside the representation. The representations table has
// no row per exception: an exception-only proposal is held, the
// representation with its exception stays VALID, and the article
// introduction's qualification is never held.
test('an enumerated exception of a representation cut as its own fact is held; the representation that carries the exception is not', () => {
  const fullId = 'x'.repeat(64);
  const own = wp20Own(fullId);
  // 3.5(b) as stored for the run, page footer ("16") included.
  const canonical = 'Section 3.5 Consents and Approvals; No Violations. (b) Except as set forth in Section 3.5(b) of the Company Disclosure Letter, no consent, approval, order or authorization of, or registration, declaration, filing with or notice to, any federal, state, local or foreign government or subdivision thereof or any other governmental, administrative, judicial, arbitrator or arbitral panel (public or private),\n16\nlegislative, executive, regulatory or self-regulatory authority, instrumentality, agency, commission or body (each, a “Governmental Entity”) is required by or with respect to the Company or any of its Subsidiaries in connection with the execution, delivery and performance of this Agreement by the Company or the consummation by the Company of the Transactions or compliance with the provisions hereof, except for (i) such filings and reports as may be required pursuant to the applicable requirements of the Securities Act of 1933, as amended (the “Securities Act”), the Securities Exchange Act of 1934, as amended (the “Exchange Act”), and any other applicable state or federal securities, takeover and “blue sky” laws, (ii) the filing of the Certificate of Merger with the Delaware Secretary of State as required by the DGCL, (iii) any filings or approvals required under the rules and regulations of any stock exchange (including the Nasdaq Capital Market) and (iv) such other consents, approvals, orders, authorizations, registrations, declarations, filings or notices the failure of which to be obtained or made, individually or in the aggregate, have not had and would not reasonably be expected to have a Material Adverse Effect.\n';
  const subject = 'no consent, approval, order or authorization of, or registration, declaration, filing with or notice to, any federal, state, local or foreign government or subdivision thereof';
  const predicate = 'is required by or with respect to the Company or any of its Subsidiaries in connection with the execution, delivery and performance of this Agreement by the Company or the consummation by the Company of the Transactions or compliance with the provisions hereof';
  const exceptions = canonical.slice(canonical.indexOf('except for (i)'), canonical.indexOf(' a Material Adverse Effect.') + ' a Material Adverse Effect'.length);
  const first = '(i) such filings and reports as may be required pursuant to the applicable requirements of the Securities Act of 1933, as amended (the “Securities Act”), the Securities Exchange Act of 1934, as amended (the “Exchange Act”), and any other applicable state or federal securities, takeover and “blue sky” laws';
  const proposals = [
    {
      subtype_key: 'NEGATIVE_REPRESENTATION',
      statement: 'Except as set forth in the Company Disclosure Letter, no Governmental Entity consent or filing is required for the Agreement, except for the enumerated filings and consents.',
      evidence_quotes: [{ quote: subject, source_span_id: fullId, occurrence: 0 }],
      components: [
        own('c1', 'EXCEPTION', 'disclosure letter exception', 'Except as set forth in Section 3.5(b) of the Company Disclosure Letter,'),
        own('c2', 'OBJECT', 'consents and filings', subject),
        own('c3', 'OPERATION', 'none required', predicate),
        own('c4', 'EXCEPTION', 'enumerated exceptions', exceptions),
      ],
    },
    {
      // The stored 1907c534: the predicate as a QUALIFIER and the (i) exception, nothing else.
      subtype_key: 'COMPLIANCE_REPRESENTATION',
      statement: 'The Company\'s representation to Parent and Merger Sub that no Governmental Entity consent, approval, order, authorization, registration, declaration, filing or notice is required excepts such filings and reports as may be required under the securities laws.',
      evidence_quotes: [{ quote: first, source_span_id: fullId, occurrence: 0 }],
      components: [
        own('c1', 'QUALIFIER', 'requirement', predicate),
        own('c2', 'EXCEPTION', 'securities law filings', first),
      ],
    },
    {
      // 4.4(b)'s shape: the shared subject, the introducer, the enumerated item as an OBJECT.
      subtype_key: 'COMPLIANCE_REPRESENTATION',
      statement: 'The Company\'s representation to Parent and Merger Sub that no Governmental Entity consent or filing is required excepts the filing of the Certificate of Merger with the Delaware Secretary of State.',
      evidence_quotes: [{ quote: '(ii) the filing of the Certificate of Merger with the Delaware Secretary of State as required by the DGCL', source_span_id: fullId, occurrence: 0 }],
      components: [
        own('c1', 'QUALIFIER', 'consents and filings', subject),
        own('c2', 'EXCEPTION', 'introducer', 'except for'),
        own('c3', 'OBJECT', 'Certificate of Merger filing', '(ii) the filing of the Certificate of Merger with the Delaware Secretary of State as required by the DGCL'),
      ],
    },
  ];
  const result = wp20Compile({ canonical, reference: '3.5', proposals });
  const [representation, filings, certificate] = result.proposals;
  assert.equal(representation.validation_status, 'VALID', issueLines(result));
  assert.equal(filings.validation_status, 'INVALID', 'the (i) exception alone is not a fact');
  assert.equal(certificate.validation_status, 'INVALID', 'the (ii) exception alone is not a fact');
  const holds = result.issues.filter((issue) => issue.code === 'REPRESENTATION_EXCEPTION_NOT_A_FACT');
  assert.equal(holds.length, 2, issueLines(result));
  assert.ok(holds.every((issue) => issue.kind === 'VALIDATION'));
  const parsed = holds.map((issue) => JSON.parse(issue.message));
  assert.deepEqual(parsed.map((entry) => entry.client_ref), ['p2', 'p3']);
  assert.match(parsed[0].exception, /^\(i\) such filings and reports/);
  assert.deepEqual(parsed[0].shared_context, [predicate.slice(0, 120)]);
  assert.match(parsed[1].exception, /^except for \(ii\) the filing of the Certificate of Merger/);
  assert.match(parsed[0].rule, /EXCEPTION component of the representation/);
  // The article introduction's own qualification is an exception by design.
  const intro = 'ARTICLE III\nExcept as set forth in the Company Disclosure Letter, the Company represents and warrants to Parent and Merger Sub as follows:\n';
  const qualification = wp20Compile({ canonical: intro, reference: 'III-INTRO', proposals: [{
    subtype_key: 'REPRESENTATION_QUALIFICATION',
    statement: 'The representations are given except as set forth in the Company Disclosure Letter.',
    evidence_quotes: [{ quote: 'Except as set forth in the Company Disclosure Letter', source_span_id: fullId, occurrence: 0 }],
    components: [own('c1', 'EXCEPTION', 'disclosure letter', 'Except as set forth in the Company Disclosure Letter')],
  }] });
  assert.equal(qualification.proposals[0].validation_status, 'VALID', issueLines(qualification));
  assert.equal(qualification.issues.some((issue) => issue.code === 'REPRESENTATION_EXCEPTION_NOT_A_FACT'), false);
});

// Work package 21 (finding (172); the manager's message of 22:30 UTC;
// implementer E's ledger, levers 1 and 7): the validator accepts the
// shorter answer the extractor will be asked for. A span may be cited by
// an integer alias from the response's span_aliases table, by a
// deterministic alias (agreement-draft.js spanAliases: F, C1, O1, D1, X1)
// or by a unique prefix of its id; words may be named by a quote, by
// absolute byte offsets or by anchors (first and last words); a proposal
// without evidence_quotes takes its evidence from its own components;
// roles may be left out. Whichever form the model writes, the fact is the
// same; offsets that disagree with a quote, lie outside the span or cite
// an alias the table lacks hold the fact by name.
test('a span cited by alias or id prefix, words named by offsets or anchors, evidence derived from the own components and roles left out compile to the same fact as the full form', () => {
  const { spanAliases } = require('../lib/product/agreement-draft');
  const canonical = 'Section 3.27 Reorganization Qualification. Neither the Company nor any of its Subsidiaries has taken any action that would reasonably be expected to prevent or preclude the Merger from qualifying for the Intended Tax Treatment. The Company has taken any action it deems fit in the ordinary course.\n';
  const fullId = 'x'.repeat(64);
  const own = wp20Own(fullId);
  const byteAt = (text) => bytes(canonical.slice(0, canonical.indexOf(text)));
  const subject = 'Neither the Company nor any of its Subsidiaries';
  const operation = 'has taken any action';
  const object = 'prevent or preclude the Merger from qualifying for the Intended Tax Treatment';
  const full = (components, extra = {}) => ({
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'The Company represents that neither it nor any Subsidiary has taken any action that would prevent the Intended Tax Treatment.',
    evidence_quotes: [{ quote: operation, source_span_id: fullId, occurrence: 0 }],
    components,
    ...extra,
  });
  const heading = 'Section 3.27 Reorganization Qualification.';
  const chapeau = { span_id: 'abcdef12'.repeat(8), kind: 'CHAPEAU', structure_node_id: 'h'.repeat(64), start_byte: 0, end_byte: bytes(heading), exact_text: heading };
  const inherited = { ref: 'c0', kind: 'TERM', label: 'heading', quote: heading, source_span_id: chapeau.span_id, occurrence: 0, origin: 'CHAPEAU', children: [] };
  const baseline = wp20Compile({ canonical, reference: '3.27', contextSpans: [chapeau], proposals: [full([
    inherited,
    own('c1', 'ACTOR', 'subject', subject),
    own('c2', 'OPERATION', 'no action taken', operation),
    own('c3', 'OBJECT', 'tax treatment', object),
  ])] });
  const [before] = baseline.proposals;
  assert.equal(before.validation_status, 'VALID', issueLines(baseline));
  const closureSpans = baseline.source_closure ? baseline.source_closure.spans : null;
  assert.equal(spanAliases([{ span_id: fullId, kind: 'FULL_SECTION' }]).toAlias.get(fullId), 's1', "E's lean alias of the one span");
  // Component ids follow the fact id, which follows the evidence spans, so
  // the comparison is of the words, bytes and headline, not the ids.
  const shape = (proposal) => JSON.stringify({ status: proposal.validation_status, components: proposal.components.map((c) => [c.kind, c.text, c.start_byte, c.end_byte, c.origin]), headline: [proposal.headline.label, proposal.headline.summary, proposal.headline.distinguishing_component_ids.length] });
  // (1) an integer alias from the response's table, E's lean alias (s2 is
  // the full section: the chapeau comes first in this closure) and a hex
  // prefix; words by absolute offsets, by E's span-relative quote_offsets
  // and by anchors under E's names; no evidence_quotes, no roles.
  const short = wp20Compile({ canonical, reference: '3.27', contextSpans: [chapeau], answer: { span_aliases: { 1: fullId } }, proposals: [{
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'The Company represents that neither it nor any Subsidiary has taken any action that would prevent the Intended Tax Treatment.',
    roles: undefined,
    components: [
      { ref: 'c0', kind: 'TERM', label: 'heading', quote_offsets: [0, heading.length], source_span_id: 'abcdef12abcdef12', origin: 'CHAPEAU', children: [] },
      { ref: 'c1', kind: 'ACTOR', label: 'subject', start_byte: byteAt(subject), end_byte: byteAt(subject) + bytes(subject), source_span_id: 1, origin: 'OWN', children: [] },
      { ref: 'c2', kind: 'OPERATION', label: 'no action taken', quote_offsets: [canonical.indexOf(operation), canonical.indexOf(operation) + operation.length], source_span_id: 's2', origin: 'OWN', children: [] },
      { ref: 'c3', kind: 'OBJECT', label: 'tax treatment', quote_from: 'prevent or preclude', quote_to: 'Intended Tax Treatment', source_span_id: 1, origin: 'OWN', children: [] },
    ],
  }] });
  const [after] = short.proposals;
  assert.equal(after.validation_status, 'VALID', issueLines(short));
  assert.equal(shape(after), shape(before), 'the same fact from the short form');
  assert.equal(after.evidence_derived, true);
  assert.equal(after.source_span_ids.length, 4, 'every component is the evidence');
  assert.deepEqual(after.components.map((component) => component.text), [heading, subject, operation, object]);
  assert.equal(short.issues.some((issue) => /ROLE|PROPOSAL_ROLES/.test(issue.code) && issue.kind !== 'NOTE'), false, issueLines(short));
  // Offsets name the occurrence by position: the second "has taken any action" is the second one.
  const second = canonical.lastIndexOf(operation);
  const positioned = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'later action', start_byte: bytes(canonical.slice(0, second)), end_byte: bytes(canonical.slice(0, second)) + bytes(operation), source_span_id: fullId, origin: 'OWN', children: [] },
  ])] });
  assert.equal(positioned.proposals[0].components[1].start_byte, bytes(canonical.slice(0, second)));
  // (2) anchors that name two runs are held; an occurrence picks one.
  const ambiguous = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote_start: 'has taken', quote_end: 'any action', source_span_id: 's1', origin: 'OWN', children: [] },
  ])] });
  assert.equal(ambiguous.proposals[0].validation_status, 'INVALID');
  assert.ok(ambiguous.issues.some((issue) => issue.code === 'INVALID_FACT_COMPONENTS' && /ANCHORS_AMBIGUOUS/.test(issue.message)), issueLines(ambiguous));
  const picked = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote_start: 'has taken', quote_end: 'any action', occurrence: 1, source_span_id: 's1', origin: 'OWN', children: [] },
  ])] });
  assert.equal(picked.proposals[0].validation_status, 'VALID', issueLines(picked));
  assert.equal(picked.proposals[0].components[1].start_byte, bytes(canonical.slice(0, second)));
  assert.equal(picked.proposals[0].components[1].text, operation);
  // Anchors absent from the span hold.
  const absent = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote_start: 'has refrained', quote_end: 'from action', source_span_id: 's1', origin: 'OWN', children: [] },
  ])] });
  assert.equal(absent.proposals[0].validation_status, 'INVALID');
  assert.ok(absent.issues.some((issue) => /ANCHORS_NOT_FOUND/.test(issue.message)), issueLines(absent));
  // Ablation run 1 (finding (188); NCS generation 5, 5.17): the trimmed rung
  // lost the Registration Statement fact to ANCHORS_NOT_FOUND because its
  // first words run across a page footer, "The Registration\n57\nStatement
  // (or any prospectus". An anchor across a footer is found as a quote
  // across one is (work package 20 (b)); the footer is recorded; whitespace
  // alone still never relaxes the verbatim rule.
  const paged = 'Section 5.17 Registration Rights. The Registration\n57\nStatement (or any prospectus or prospectus supplement forming a part of such Registration Statement), as initially filed, shall include the Registrable Securities of the Specified Stockholders.\n';
  const pagedFact = (first, last) => wp20Compile({ canonical: paged, reference: '5.17', proposals: [{
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'The Registration Statement as initially filed shall include the Registrable Securities of the Specified Stockholders.',
    components: [
      { ref: 'c1', kind: 'ACTOR', label: 'registration statement', quote_start: first, quote_end: last, source_span_id: 's1', origin: 'OWN', children: [] },
      { ref: 'c2', kind: 'OPERATION', label: 'inclusion', quote_start: 'shall include', quote_end: 'Specified Stockholders', source_span_id: 's1', origin: 'OWN', children: [] },
    ],
  }] });
  const acrossFooter = pagedFact('The Registration Statement (or', 'as initially filed');
  assert.equal(acrossFooter.proposals[0].validation_status, 'VALID', issueLines(acrossFooter));
  const [actor] = acrossFooter.proposals[0].components;
  assert.equal(actor.start_byte, bytes(paged.slice(0, paged.indexOf('The Registration\n57'))));
  assert.equal(actor.end_byte, bytes(paged.slice(0, paged.indexOf('as initially filed') + 'as initially filed'.length)), 'the run opens on the anchor across the footer and closes on the last words');
  assert.match(actor.text, /^The Registration\n57\nStatement \(or any prospectus/, 'the text is the canonical bytes, footer included');
  assert.equal(acrossFooter.proposals[0].components[1].text, 'shall include the Registrable Securities of the Specified Stockholders');
  // The footer is not a licence for other whitespace differences: an anchor
  // whose run holds no footer must be verbatim.
  const doubleSpaced = wp20Compile({ canonical: paged, reference: '5.17', proposals: [{
    subtype_key: 'NEGATIVE_REPRESENTATION',
    statement: 'The Registration Statement as initially filed shall include the Registrable Securities of the Specified Stockholders.',
    components: [
      { ref: 'c1', kind: 'ACTOR', label: 'registration statement', quote_start: 'The Registration Statement (or', quote_end: 'as initially filed', source_span_id: 's1', origin: 'OWN', children: [] },
      { ref: 'c2', kind: 'OPERATION', label: 'inclusion', quote_start: 'shall  include', quote_end: 'Specified Stockholders', source_span_id: 's1', origin: 'OWN', children: [] },
    ],
  }] });
  assert.equal(doubleSpaced.proposals[0].validation_status, 'INVALID', 'two spaces are not a footer');
  assert.ok(doubleSpaced.issues.some((issue) => /ANCHORS_NOT_FOUND/.test(issue.message)), issueLines(doubleSpaced));
  // (3) an alias no closure span answers to is an unknown span, as an unknown id is.
  const unknown = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote: operation, source_span_id: 'Q9', occurrence: 0, origin: 'OWN', children: [] },
  ])] });
  assert.equal(unknown.proposals[0].validation_status, 'VALID', 'own words on an unknown alias resolve through the section, as work package 13 (a) says');
  // (4) offsets outside the canonical text are held, never a crash; offsets that disagree with a quote beside them hold by name; an integer alias the table lacks holds by name.
  const outside = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', start_byte: 10, end_byte: 5, source_span_id: 's1', origin: 'OWN', children: [] },
  ])] });
  assert.equal(outside.proposals[0].validation_status, 'INVALID');
  assert.ok(outside.issues.some((issue) => /INVALID_OFFSETS/.test(issue.message)), issueLines(outside));
  const disagree = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote: operation, start_byte: byteAt(subject), end_byte: byteAt(subject) + bytes(subject), source_span_id: fullId, occurrence: 0, origin: 'OWN', children: [] },
  ])] });
  assert.equal(disagree.proposals[0].validation_status, 'INVALID');
  assert.ok(disagree.issues.some((issue) => /OFFSETS_DISAGREE_WITH_QUOTE/.test(issue.message)), issueLines(disagree));
  const agree = wp20Compile({ canonical, reference: '3.27', proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote: operation, start_byte: byteAt(operation), end_byte: byteAt(operation) + bytes(operation), source_span_id: fullId, occurrence: 0, origin: 'OWN', children: [] },
  ])] });
  assert.equal(agree.proposals[0].validation_status, 'VALID', issueLines(agree));
  const noAlias = wp20Compile({ canonical, reference: '3.27', answer: { span_aliases: { 1: fullId } }, proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', quote: operation, source_span_id: 2, occurrence: 0, origin: 'OWN', children: [] },
  ])] });
  assert.equal(noAlias.proposals[0].validation_status, 'INVALID');
  assert.ok(noAlias.issues.some((issue) => /SPAN_ALIAS_UNKNOWN/.test(issue.message)), issueLines(noAlias));
  // Offsets inside the canonical text but outside the cited span hold by name.
  const elsewhere = wp20Compile({ canonical, reference: '3.27', contextSpans: [chapeau], proposals: [full([
    own('c1', 'ACTOR', 'subject', subject),
    { ref: 'c2', kind: 'OPERATION', label: 'action', start_byte: byteAt(operation), end_byte: byteAt(operation) + bytes(operation), source_span_id: chapeau.span_id, origin: 'OWN', children: [] },
  ])] });
  assert.equal(elsewhere.proposals[0].validation_status, 'INVALID');
  assert.ok(elsewhere.issues.some((issue) => /OFFSETS_OUTSIDE_SPAN/.test(issue.message)), issueLines(elsewhere));
  // (5) a link may cite spans by alias.
  const linked = wp20Compile({ canonical, reference: '3.27', proposals: [
    full([own('c1', 'ACTOR', 'subject', subject), own('c2', 'OPERATION', 'no action taken', operation)]),
    full([own('c1', 'ACTOR', 'subject', subject), own('c2', 'OBJECT', 'tax treatment', object)], { subtype_key: 'STATUS_REPRESENTATION' }),
  ] });
  assert.equal(linked.proposals.length, 2);
  void closureSpans;
});

// Work package 21 on a stored call: NCS generation 5's 6.4 as the model
// answered it (tests/fixtures/product/ncs-generation-5-6-4-extraction-call.json,
// the bytes rebased to a window from the Article VI heading), compiled as
// written and again with span aliases and words by offsets or by the
// shortest unique anchors, no evidence_quotes and no roles: the same facts.
test('the stored 6.4 call compiles to the same facts from the full answer and from the short forms', () => {
  const fixture = require('./fixtures/product/ncs-generation-5-6-4-extraction-call.json');
  const nodesById = new Map(fixture.structure.nodes.map((node) => [node.node_id, node]));
  const node = nodesById.get(fixture.closure.structure_node_id);
  const owned = new Set(fixture.structure.nodes.filter((candidate) => { for (let cursor = candidate; cursor; cursor = cursor.parent_id ? nodesById.get(cursor.parent_id) : null) if (cursor.node_id === node.node_id) return true; return false; }).map((candidate) => candidate.node_id));
  const compile = (response) => compileExtraction({
    sourceDocument: fixture.source_document, legalSchema: legalSchemaV2, node, closure: fixture.closure, call, response,
    routedFamilies: [...new Set([...fixture.routed_families, ...response.proposals.map((proposal) => proposal.family_key)])], ownedNodeIds: owned, tableShapes, agreementStructure: fixture.structure,
  });
  const shape = (proposal) => JSON.stringify({
    status: proposal.validation_status, statement: proposal.statement, headline: [proposal.headline.label, proposal.headline.summary],
    components: (function strip(list) { return list.map((component) => [component.kind, component.origin, component.text, component.start_byte, component.end_byte, component.resolves_to?.structure_node_id || null, strip(component.children)]); }(proposal.components)),
    conclusions: proposal.conclusions ? [proposal.conclusions.table_key, proposal.conclusions.row_label, (proposal.conclusions.cells || []).map((cell) => [cell.column_id, cell.code || null, cell.text || null])] : null,
  });
  const baseline = compile(fixture.answer);
  assert.equal(baseline.proposals.length, 3);
  assert.ok(baseline.proposals.every((proposal) => proposal.validation_status === 'VALID'), issueLines(baseline));
  assert.ok(baseline.proposals.some((proposal) => [...walkComponents(proposal.components)].some((component) => component.kind === 'CROSS_REFERENCE' && /this Article VI/.test(component.text) && component.resolves_to?.structure_node_id)), 'the Article VI reference resolves (work package 19 (c))');
  // The manager's alias form: a per-call table of small integers, supplied with the answer.
  const aliases = new Map(fixture.closure.spans.map((span, index) => [span.span_id, String(index + 1)]));
  const shorten = (mode) => {
    const answer = JSON.parse(JSON.stringify(fixture.answer));
    answer.span_aliases = Object.fromEntries([...aliases.entries()].map(([id, number]) => [number, id]));
    answer.proposals.forEach((proposal, index) => {
      delete proposal.roles;
      delete proposal.evidence_quotes;
      const compiled = baseline.proposals[index];
      (function walk(raw, done) {
        (raw || []).forEach((item, position) => {
          item.source_span_id = aliases.get(item.source_span_id) || item.source_span_id;
          const compiledItem = done ? done[position] : null;
          if (mode === 'offsets' && compiledItem && Number.isInteger(compiledItem.start_byte) && compiledItem.text === item.quote) {
            item.start_byte = compiledItem.start_byte; item.end_byte = compiledItem.end_byte; delete item.quote;
          } else if (mode === 'anchors' && compiledItem && Number.isInteger(compiledItem.start_byte)) {
            const span = fixture.closure.spans.find((candidate) => candidate.span_id === compiledItem.source_span_id) || fixture.closure.spans.find((candidate) => candidate.span_id === fixture.closure.full_section_span_id);
            const words = item.quote.split(/\s+/).filter(Boolean);
            for (let n = 3; n <= 8 && words.length > 2 * n; n += 1) {
              const first = words.slice(0, n).join(' '); const last = words.slice(-n).join(' ');
              const runs = []; let at = span.exact_text.indexOf(first);
              while (at >= 0) { const end = span.exact_text.indexOf(last, at); if (end >= 0) runs.push(span.exact_text.slice(at, end + last.length)); at = span.exact_text.indexOf(first, at + 1); }
              if (runs.length === 1 && runs[0] === item.quote) { item.quote_start = first; item.quote_end = last; delete item.quote; delete item.occurrence; break; }
            }
          }
          walk(item.children, compiledItem?.children);
        });
      }(proposal.components, compiled.components));
    });
    for (const link of answer.links || []) link.source_span_ids = (link.source_span_ids || []).map((id) => aliases.get(id) || id);
    return answer;
  };
  for (const mode of ['offsets', 'anchors']) {
    const short = shorten(mode);
    const text = JSON.stringify({ ...short, span_aliases: undefined });
    assert.ok(!/[0-9a-f]{64}/.test(text), `${mode}: no 64-hex span id left in the answer outside its alias table`);
    assert.equal(Object.keys(short.span_aliases).length, fixture.closure.spans.length);
    assert.ok(!text.includes('"roles"') && !text.includes('evidence_quotes'));
    if (mode === 'offsets') assert.ok(!text.includes('"quote"'), 'every component by offsets');
    const result = compile(short);
    assert.equal(result.proposals.length, 3, issueLines(result));
    result.proposals.forEach((proposal, index) => {
      assert.equal(shape(proposal), shape(baseline.proposals[index]), `${mode}: proposal ${index + 1} is the same fact`);
      assert.equal(proposal.evidence_derived, true);
    });
    assert.ok(Buffer.byteLength(text, 'utf8') < Buffer.byteLength(JSON.stringify(fixture.answer), 'utf8') * 0.7, `${mode}: the answer is under 70 per cent of the full form`);
  }
});
