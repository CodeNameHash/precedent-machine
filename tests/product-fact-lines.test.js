'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { createAnthropicApiProductModel } = require('../lib/product/anthropic-api-model');
const { createClaudeCliProductModel, LINES_SYSTEM_PROMPT, SYSTEM_PROMPT } = require('../lib/product/claude-cli-model');
const { ABLATION_VARIANTS } = require('../lib/product/cost-ablation');
const { FACT_LINES_INSTRUCTION, isFactLinesRequest, lineKind, readFactLines } = require('../lib/product/fact-lines');
const { REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Plan finding (192), the fresh sheet's row 7: the answer as one JSON
// object per line. A capped answer keeps every whole line; the words after
// the cut go to a continuation call.

const P1 = '{"line":"proposal","client_ref":"p1","group_ref":"g1","family_key":"NO_SHOP","subtype_key":"NO_SOLICITATION","fact_type":"NO_SOLICITATION_COVENANT","components":[{"ref":"c1","kind":"OPERATION","quote":"shall not solicit","source_span_id":"3","occurrence":0,"origin":"OWN"}]}';
const P2 = '{"line":"proposal","client_ref":"p2","group_ref":"g2","family_key":"NO_SHOP","subtype_key":"FIDUCIARY_OUT","fact_type":"FIDUCIARY_OUT","components":[{"ref":"c2","kind":"EXCEPTION","quote":"unless the Board determines","source_span_id":"5","occurrence":0,"origin":"OWN"}]}';
const G1 = '{"line":"group","client_ref":"g1","family_key":"NO_SHOP","subtype_key":"NO_SOLICITATION"}';
const L1 = '{"line":"link","from_ref":"p2","to_ref":"p1","relationship_type":"EXCEPTION_TO","source_span_ids":[]}';
const TRAILER = '{"line":"coverage","coverage":{"NO_SHOP":"FOUND"},"fact_type_coverage":{"NO_SHOP":{"NO_SOLICITATION_COVENANT":"FOUND"}},"coverage_reason":{"NO_SHOP":"the covenant"}}';

test('the reader: whole lines become the object answer; a capped answer keeps its whole lines, drops the broken one and derives the groups the cut left unwritten', () => {
  const whole = readFactLines(['```jsonl', P1, P2, G1, L1, TRAILER, '```'].join('\n'));
  assert.equal(whole.lines.kept, 5);
  assert.equal(whole.lines.trailer, true);
  assert.equal(whole.lines.truncated, false);
  assert.deepEqual(whole.response.proposals.map((item) => item.client_ref), ['p1', 'p2']);
  assert.deepEqual(whole.response.groups.map((item) => item.client_ref), ['g1', 'g2'], 'g2 is derived from p2');
  assert.equal(whole.response.groups[1].subtype_key, 'FIDUCIARY_OUT');
  assert.equal(whole.response.links.length, 1);
  assert.deepEqual(whole.response.coverage, { NO_SHOP: 'FOUND' });
  assert.deepEqual(whole.response.coverage_reason, { NO_SHOP: 'the covenant' });
  assert.equal(whole.response.proposals[0].line, undefined, 'the line marker is not part of the proposal');
  assert.equal(whole.lines.groups_derived, 1);
  const cut = readFactLines([P1, P2.slice(0, 80)].join('\n'), { truncated: true });
  assert.equal(cut.lines.kept, 1);
  assert.equal(cut.lines.broken_last_line, true);
  assert.equal(cut.lines.malformed, 0);
  assert.equal(cut.lines.trailer, false);
  assert.equal(cut.response.coverage, undefined, 'no trailer: the compiler reads the omission as UNRESOLVED');
  assert.deepEqual(cut.response.groups, [{ client_ref: 'g1', family_key: 'NO_SHOP', subtype_key: 'NO_SOLICITATION' }]);
  assert.equal(cut.response.answer_lines.truncated, true);
  const noisy = readFactLines(['not json', P1, '{"unknown":1}', TRAILER].join('\n'));
  assert.equal(noisy.lines.malformed, 1);
  assert.equal(noisy.lines.unreadable, 1);
  assert.equal(noisy.lines.kept, 2);
  // Lines without the marker are read by their fields.
  assert.equal(lineKind({ fact_type: 'X', client_ref: 'p' }), 'proposal');
  assert.equal(lineKind({ subtype_key: 'S', client_ref: 'g' }), 'group');
  assert.equal(lineKind({ from_ref: 'a', to_ref: 'b' }), 'link');
  assert.equal(lineKind({ coverage: {} }), 'coverage');
  assert.equal(lineKind({ other: 1 }), null);
  assert.equal(isFactLinesRequest({ answer_mode: 'lines' }), true);
  assert.equal(isFactLinesRequest({}), false);
  assert.match(FACT_LINES_INSTRUCTION, /one compact JSON object per line/);
});

function apiMessage(text, overrides = {}) {
  return { id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, stop_reason: 'end_turn', ...overrides };
}

test('the API provider in lines mode: a max_tokens answer is returned with its whole lines and answer_lines.truncated, not a failure; the object mode still fails; the system prompt asks for lines', async () => {
  const seen = [];
  const client = (reply) => ({ messages: { stream(request) { seen.push(request); return { async finalMessage() { return reply; } }; } } });
  const request = { answer_mode: 'lines', family_contracts: [], source_closure: { section_reference: '6.3', operative: [] }, response_contract: {} };
  const model = createAnthropicApiProductModel({ apiKey: 'k'.repeat(24), client: client(apiMessage([P1, P2.slice(0, 60)].join('\n'), { stop_reason: 'max_tokens' })) });
  const result = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_LEAN_EXTRACTOR/V10', request });
  assert.equal(result.response.proposals.length, 1);
  assert.equal(result.response.answer_lines.truncated, true);
  assert.equal(result.response.answer_lines.broken_last_line, true);
  assert.equal(result.provider_completion_confirmed, false);
  assert.match(seen[0].system, /JSON Lines only/);
  const object = createAnthropicApiProductModel({ apiKey: 'k'.repeat(24), client: client(apiMessage('{"proposals":[', { stop_reason: 'max_tokens' })) });
  await assert.rejects(object.complete({ call_kind: 'EXTRACTION', prompt_version: 'V10', request: { ...request, answer_mode: undefined } }), /ANTHROPIC_API_OUTPUT_TRUNCATED/);
  const empty = createAnthropicApiProductModel({ apiKey: 'k'.repeat(24), client: client(apiMessage('{"proposals":[', { stop_reason: 'max_tokens' })) });
  await assert.rejects(empty.complete({ call_kind: 'EXTRACTION', prompt_version: 'V10', request }), /ANTHROPIC_API_OUTPUT_TRUNCATED: response must be JSON Lines; 1 lines, none readable/);
});

test('the CLI provider in lines mode: two text blocks are a cut, the whole lines are kept; the system prompt asks for lines', async () => {
  const requests = [];
  const completed = (text, extra = {}) => ({ content: [{ type: 'text', text }], usage: { input_tokens: 2, output_tokens: 3 }, claude_completion: { status: 'COMPLETE', subtype: 'success', stop_reason: 'end_turn', ...extra }, total_cost_usd: 0 });
  const model = createClaudeCliProductModel({ client: { messages: { create: async (request) => { requests.push(request); return completed([P1, G1, P2.slice(0, 40)].join('\n'), { text_blocks: 2 }); } } } });
  const result = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'V10', request: { answer_mode: 'lines', source_closure: { section_reference: '6.3' } } });
  assert.equal(result.response.proposals.length, 1);
  assert.equal(result.response.groups.length, 1);
  assert.equal(result.response.answer_lines.truncated, true);
  assert.equal(requests[0].system, LINES_SYSTEM_PROMPT);
  const plain = createClaudeCliProductModel({ client: { messages: { create: async (request) => { requests.push(request); return completed('{"families":[],"disposition":"IMMATERIAL","rationale":"r"}'); } } } });
  await plain.complete({ call_kind: 'ROUTING', prompt_version: 'V1', request: { section_reference: '6.3' } });
  assert.equal(requests[1].system, SYSTEM_PROMPT);
});

function linesAnswer(request, { truncated = false } = {}) {
  const family = request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative[0];
  const sentence = operative.exact_text.split(/(?<=\.)\s+/)[0];
  const ref = truncated ? 'a' : 'b';
  const response = {
    proposals: [{
      client_ref: `p${ref}`, group_ref: `g${ref}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0], statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: [`c${ref}`], summary: 'The no-shop covenant' },
      components: [{ ref: `c${ref}`, kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
    }],
    groups: [{ client_ref: `g${ref}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key }],
    links: [],
    answer_lines: { lines: truncated ? 2 : 3, kept: truncated ? 1 : 3, malformed: 0, unreadable: 0, truncated, trailer: !truncated, broken_last_line: truncated },
  };
  if (!truncated) response.coverage = Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' ? 'FOUND' : 'NOT_FOUND']));
  return response;
}

test('answer_mode lines on Concho 6.3: a cut answer keeps its facts, the spans after the last cited one go to one continuation call, the two answers merge and the section says where the cut fell', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const continuation = input.request.source_closure.extraction_part?.mode === 'continuation';
    const response = linesAnswer(input.request, { truncated: !continuation });
    return { provider_id: 'SYNTHETIC', model_id: 'LINES/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: { ...REQUEST_PROFILES.DEFAULT, answer_mode: 'lines' } });
  const extractions = seen.filter((input) => input.call_kind === 'EXTRACTION');
  assert.equal(extractions.length, 2, 'the first call and its continuation');
  const [first, second] = extractions;
  assert.equal(first.request.answer_mode, 'lines');
  assert.match(first.request.lines_instruction, /one compact JSON object per line/);
  assert.ok(first.request.source_closure.operative.length >= 2, 'the fixture section has several limbs');
  assert.deepEqual(second.request.source_closure.operative.map((span) => span.span_id), first.request.source_closure.operative.slice(1).map((span) => span.span_id), 'the continuation covers the spans after the one the kept fact cites');
  assert.equal(second.request.source_closure.extraction_part.mode, 'continuation');
  assert.equal(second.request.source_closure.extraction_part.continues_after_span_id, first.request.source_closure.operative[0].span_id);
  assert.match(second.request.continuation_instruction, /cut short after the facts of span/);
  assert.equal(second.request.answer_mode, 'lines');
  assert.deepEqual([...result.model_calls.map((call) => call.call_kind)].sort(), ['EXTRACTION', 'EXTRACTION', 'RESIDUAL', 'ROUTING'], 'the section keeps both extraction calls');
  assert.equal(result.proposals.length, 2);
  assert.ok(result.proposals.every((proposal) => proposal.validation_status === 'VALID'), JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  const note = result.issues.find((issue) => issue.code === 'FACT_LINES_TRUNCATED');
  assert.ok(note, 'the section says the answer was cut');
  const detail = JSON.parse(note.message);
  assert.equal(detail.kept, 1);
  assert.equal(detail.trailer, false);
  assert.equal(detail.cut_in_span, first.request.source_closure.operative[0].span_id);
  assert.equal(detail.remaining_spans, first.request.source_closure.operative.length - 1);
  assert.deepEqual(detail.continuation, { kept: 3, truncated: false });
  assert.ok(!result.issues.some((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED' && /answer_lines/.test(issue.message)), 'the reading counts are not part of the lean stats');
  // Without the flag: one call, no note, and no answer_mode in the request.
  const plainSeen = [];
  const plainModel = { async complete(input) { plainSeen.push(input); if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input); const response = linesAnswer(input.request); delete response.answer_lines; return { provider_id: 'S', model_id: 'O', raw_request: input.request, raw_response: response, response, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 }; } };
  const plain = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model: plainModel, node, requestProfile: REQUEST_PROFILES.DEFAULT });
  assert.equal(plainSeen.filter((input) => input.call_kind === 'EXTRACTION').length, 1);
  assert.equal(plainSeen.find((input) => input.call_kind === 'EXTRACTION').request.answer_mode, undefined);
  assert.ok(!plain.issues.some((issue) => issue.code === 'FACT_LINES_TRUNCATED'));
  // The rung.
  assert.equal(ABLATION_VARIANTS.fact_lines.profile.answer_mode, 'lines');
  assert.deepEqual(ABLATION_VARIANTS.fact_lines.replay, ['ROUTING', 'RESIDUAL']);
});
