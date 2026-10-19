'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { cacheableContent, splitRequestForCache, createAnthropicApiProductModel, ROUTED_KEYS } = require('../lib/product/anthropic-api-model');
const {
  ANTHROPIC_API_DEFAULT_MODEL_CONFIG, ANTHROPIC_API_SONNET_MODEL_CONFIG, ANTHROPIC_API_LEAN_MODEL_CONFIG, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_REQUEST_PROFILES, ANTHROPIC_API_PRICES,
  anthropicApiConfigForEnvironment, anthropicApiModelConfigFor, assertRunModelConfig, hostedModelConfigFor, requestProfileFor, resolveAnthropicApiCallModel,
} = require('../lib/product/product-model-config');
const { extractionPartConcurrency, leanClosureForModel, mapWithConcurrency, normaliseLeanResponse, resolveAnchoredQuote, spanAliases } = require('../lib/product/agreement-draft');
const { callKey } = require('../lib/product/model-adapter');
const { pipelineRequestOf } = require('../lib/product/extraction-cost-ledger');

// Work package E1 (implementer E): the lean request profile behind the
// model-config identity, the provider's block layout under it, and the
// reading of a lean answer back into the compiler's shape.

const TEXT = 'Section 5.2 No Solicitation. (a) The Company shall not, and shall cause its Subsidiaries not to, directly or indirectly solicit any Takeover Proposal. (b) Notwithstanding the foregoing, the Company may furnish information to a Person that has made a bona fide written Takeover Proposal. "Takeover Proposal" means any proposal or offer from any Person.';
const span = (id, node, kind, start, end) => ({ span_id: id, source_document_id: 'doc', structure_node_id: node, kind, start_byte: start, end_byte: end, exact_text: TEXT.slice(start, end) });
const at = (needle) => Buffer.byteLength(TEXT.slice(0, TEXT.indexOf(needle)), 'utf8');
const A_START = at('(a) The Company');
const B_START = at('(b) Notwithstanding');
const D_START = at('"Takeover Proposal" means');
const spans = [
  span('a'.repeat(64), 'n52', 'OPERATIVE', A_START, B_START - 1),
  span('b'.repeat(64), 'n52', 'OPERATIVE', B_START, D_START - 1),
  span('c'.repeat(64), 'n52', 'CHAPEAU', 0, A_START - 1),
  span('d'.repeat(64), 'n83', 'DEFINITION', D_START, Buffer.byteLength(TEXT, 'utf8')),
  span('e'.repeat(64), 'n52', 'SECTION', 0, Buffer.byteLength(TEXT, 'utf8')),
];
const sourceDocument = { source_document_id: 'doc', canonical_text: TEXT };

test('the lean config is a known API config by identity, with its own profile, and the environment selects it', () => {
  assert.equal(requestProfileFor(ANTHROPIC_API_MODEL_CONFIG).name, 'V9');
  assert.equal(requestProfileFor(ANTHROPIC_API_LEAN_MODEL_CONFIG).name, 'LEAN');
  assert.equal(requestProfileFor(null).name, 'V9');
  assert.equal(anthropicApiModelConfigFor({ ...ANTHROPIC_API_LEAN_MODEL_CONFIG, max_output_tokens: 64000 }), ANTHROPIC_API_LEAN_MODEL_CONFIG, 'the cap is not identity');
  assert.equal(anthropicApiModelConfigFor({ ...ANTHROPIC_API_LEAN_MODEL_CONFIG, thinking: 'off' }), null);
  assert.deepEqual(resolveAnthropicApiCallModel(ANTHROPIC_API_LEAN_MODEL_CONFIG, 'EXTRACTION'), { model: 'claude-opus-5', effort: 'high' });
  assert.throws(() => resolveAnthropicApiCallModel({ ...ANTHROPIC_API_LEAN_MODEL_CONFIG, model_id: 'OTHER' }, 'EXTRACTION'), /PRODUCT_ANTHROPIC_API_MODEL_CONFIG_UNSUPPORTED/);
  assert.equal(anthropicApiConfigForEnvironment({}), ANTHROPIC_API_SONNET_MODEL_CONFIG, 'work package E6: the default, Sonnet 5.5 for extraction');
  assert.equal(anthropicApiConfigForEnvironment({ PRODUCT_REQUEST_PROFILE: 'OPUS' }), ANTHROPIC_API_DEFAULT_MODEL_CONFIG, 'work package E3\'s default by name');
  assert.equal(anthropicApiConfigForEnvironment({ PRODUCT_REQUEST_PROFILE: 'V9' }), ANTHROPIC_API_MODEL_CONFIG);
  assert.equal(anthropicApiConfigForEnvironment({ PRODUCT_REQUEST_PROFILE: 'LEAN', PRODUCT_ANTHROPIC_API_PROFILE: 'V9' }), ANTHROPIC_API_MODEL_CONFIG, 'the API\'s own switch wins');
  assert.equal(anthropicApiConfigForEnvironment({ PRODUCT_ANTHROPIC_API_PROFILE: 'lean' }), ANTHROPIC_API_LEAN_MODEL_CONFIG);
  assert.throws(() => anthropicApiConfigForEnvironment({ PRODUCT_ANTHROPIC_API_PROFILE: 'FAST' }), /PRODUCT_ANTHROPIC_API_PROFILE_UNSUPPORTED/);
  // A run created under the lean config advances under it whatever the environment says.
  const run = { run_id: 'r', model_config: ANTHROPIC_API_LEAN_MODEL_CONFIG };
  assert.equal(hostedModelConfigFor('ANTHROPIC_API', run, {}), ANTHROPIC_API_LEAN_MODEL_CONFIG);
  assert.equal(hostedModelConfigFor('ANTHROPIC_API', null, {}), ANTHROPIC_API_SONNET_MODEL_CONFIG);
  assert.equal(hostedModelConfigFor('ANTHROPIC_API', { model_config: ANTHROPIC_API_MODEL_CONFIG }, {}), ANTHROPIC_API_MODEL_CONFIG, 'a run created under V1 keeps it');
  assert.doesNotThrow(() => assertRunModelConfig(run, hostedModelConfigFor('ANTHROPIC_API', run, {})));
  assert.throws(() => assertRunModelConfig(run, ANTHROPIC_API_MODEL_CONFIG), /PRODUCT_RUN_MODEL_CONFIG_MISMATCH/);
  for (const model of ['claude-sonnet-5-5', 'claude-haiku-5-5']) assert.ok(ANTHROPIC_API_PRICES.usd_per_million[model].output > 0);
  assert.deepEqual(Object.keys(ANTHROPIC_API_REQUEST_PROFILES), ['V9', 'LEAN', 'DEFAULT', 'DEFAULT_CLI']);
});

test('under the lean profile the provider lays the agreement block, two stable blocks and the section out, and stores the agreement as a marker', () => {
  const input = {
    call_kind: 'EXTRACTION', prompt_version: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V10',
    request: { instruction: 'read', response_contract: { a: 1 }, cross_section_target_contracts: { x: 1 }, family_contracts: [{ family_key: 'NO_SHOP' }], table_shapes: { NO_SHOP: [] }, source_closure: { operative: [] }, agreement_context: { source_document_id: 'doc', bytes: 352 } },
    context: { agreement_text: TEXT },
  };
  const lean = cacheableContent(input, ANTHROPIC_API_REQUEST_PROFILES.LEAN);
  assert.equal(lean.content.length, 4);
  assert.match(lean.content[0].text, /^AGREEMENT TEXT\n\nSection 5\.2/);
  assert.deepEqual(lean.content[0].cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.deepEqual(Object.keys(JSON.parse(lean.content[1].text)), ['call_kind', 'prompt_version', 'instruction', 'response_contract', 'cross_section_target_contracts', 'agreement_context']);
  assert.deepEqual(Object.keys(JSON.parse(lean.content[2].text)), ['family_contracts', 'table_shapes']);
  assert.ok(lean.content[2].cache_control);
  assert.deepEqual(JSON.parse(lean.content[3].text), { source_closure: { operative: [] } });
  assert.equal(lean.content[3].cache_control, undefined);
  assert.match(lean.system, /4 blocks in one message: the agreement's text, then the instructions/);
  assert.match(lean.system, /The first block is the agreement's whole text/);
  const marker = JSON.parse(lean.stored_content[0].text).agreement_block;
  assert.equal(marker.source_document_id, 'doc');
  assert.equal(marker.bytes, Buffer.byteLength(TEXT));
  assert.equal(marker.sha256.length, 64);
  assert.equal(lean.stored_content[1].text, lean.content[1].text);
  // The stored request rebuilds to the pipeline request without the agreement text, so a replay keys on it.
  const stored = { call_kind: 'EXTRACTION', prompt_version: input.prompt_version, request: { messages: [{ role: 'user', content: lean.stored_content }] } };
  const rebuilt = pipelineRequestOf(stored);
  assert.deepEqual(rebuilt.request, input.request);
  assert.equal(callKey({ call_kind: input.call_kind, prompt_version: input.prompt_version, request: rebuilt.request }), callKey(input), 'the context is not part of the key');
  // V9 is unchanged: two blocks, no agreement block even when context is given.
  const v9 = cacheableContent(input, ANTHROPIC_API_REQUEST_PROFILES.V9);
  assert.equal(v9.content.length, 2);
  assert.deepEqual(Object.keys(JSON.parse(v9.content[0].text)).sort(), ['agreement_context', 'call_kind', 'cross_section_target_contracts', 'family_contracts', 'instruction', 'prompt_version', 'response_contract', 'table_shapes']);
  assert.deepEqual(splitRequestForCache(input).routed, {});
  assert.ok(ROUTED_KEYS.includes('table_shapes'));
});

test('a lean-config provider sends the agreement block and stores the marker, pricing the call at the run model', async () => {
  const sent = [];
  const client = { messages: { stream: (request) => { sent.push(request); return { finalMessage: async () => ({ id: 'm', role: 'assistant', type: 'message', model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"proposals":[]}' }], usage: { input_tokens: 10, cache_creation_input_tokens: 90, cache_read_input_tokens: 0, output_tokens: 5, cache_creation: { ephemeral_1h_input_tokens: 90, ephemeral_5m_input_tokens: 0 } } }) }; } } };
  const model = createAnthropicApiProductModel({ client, modelConfig: ANTHROPIC_API_LEAN_MODEL_CONFIG });
  const result = await model.complete({ call_kind: 'EXTRACTION', prompt_version: 'P', request: { instruction: 'x', source_closure: {} }, context: { agreement_text: 'THE AGREEMENT' } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].messages[0].content.length, 3);
  assert.match(sent[0].messages[0].content[0].text, /THE AGREEMENT/);
  assert.match(result.raw_request.messages[0].content[0].text, /agreement_block/);
  assert.doesNotMatch(result.raw_request.messages[0].content[0].text, /THE AGREEMENT/);
  assert.equal(result.input_tokens, 100);
  assert.equal(result.cost_microusd, 10 * 5 + 90 * 10 + 5 * 25);
  // A variant may name its own models per call kind (the three-section ablation).
  const variant = createAnthropicApiProductModel({ client, modelConfig: ANTHROPIC_API_LEAN_MODEL_CONFIG, callKindModels: { EXTRACTION: { model: 'claude-opus-5-5', effort: 'medium' } } });
  await variant.complete({ call_kind: 'EXTRACTION', prompt_version: 'P', request: { instruction: 'x' } });
  assert.equal(sent[1].model, 'claude-opus-5-5');
  assert.deepEqual(sent[1].output_config, { effort: 'medium' });
});

test('span aliases, the lean closure listing and the anchored quote resolver', () => {
  const aliases = spanAliases(spans);
  assert.deepEqual([...aliases.toAlias.values()], ['s1', 's2', 's3', 's4', 's5']);
  assert.equal(aliases.toId.get('s4'), 'd'.repeat(64));
  const closureForModel = { operative: [spans[0], spans[1]], chapeau: [spans[2]], definitions: [spans[3]], cross_references: [], full_section: spans[4] };
  const nodesById = new Map([['n83', { reference: '8.3' }]]);
  const listed = leanClosureForModel(closureForModel, { aliases, cachedAgreement: true, nodesById });
  assert.equal(listed.operative[0].span_id, 's1');
  assert.equal(listed.operative[0].exact_text, spans[0].exact_text, 'the limbs keep their text');
  assert.deepEqual(listed.definitions[0], { span_id: 's4', structure_node_id: 'n83', section_reference: '8.3', kind: 'DEFINITION', start_byte: D_START, end_byte: Buffer.byteLength(TEXT, 'utf8'), first_words: '"Takeover Proposal" means any proposal or offer from ...', text_in: 'agreement block' });
  const inline = leanClosureForModel(closureForModel, { aliases, cachedAgreement: false, nodesById });
  assert.equal(inline.definitions[0].exact_text, spans[3].exact_text, 'without the cached agreement the definitions keep their text');
  assert.equal(inline.full_section.span_id, 's5');

  assert.equal(resolveAnchoredQuote(TEXT, spans[0], 'The Company shall not,', 'any Takeover Proposal.'), 'The Company shall not, and shall cause its Subsidiaries not to, directly or indirectly solicit any Takeover Proposal.');
  assert.equal(resolveAnchoredQuote(TEXT, spans[1], 'the Company may', 'Takeover Proposal.'), 'the Company may furnish information to a Person that has made a bona fide written Takeover Proposal.');
  assert.equal(resolveAnchoredQuote(TEXT, spans[1], 'The Company shall not,', 'Takeover Proposal.'), null, 'the first words are in another span');
  assert.equal(resolveAnchoredQuote(TEXT, spans[0], 'solicit any', 'solicit any'), 'solicit any', 'from and to may be the same short run');
  assert.equal(resolveAnchoredQuote(TEXT, spans[4], 'Takeover Proposal', 'Proposal.', 1), 'Takeover Proposal.', 'occurrence picks the second run that starts with the words');
});

test('a lean answer is read back into the compiler\'s shape: ids restored, anchors resolved, evidence derived from the OWN components, roles empty', () => {
  const aliases = spanAliases(spans);
  const spansById = new Map(spans.map((item) => [item.span_id, item]));
  const answer = {
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'NO_SHOP', subtype_key: 'X', fact_type: 'Y', statement: 'The Company shall not solicit.',
      headline: { label: 'L', distinguishing_refs: ['c1'], summary: 's' },
      components: [
        { ref: 'c1', kind: 'ACTOR', label: 'Company', quote: 'The Company', source_span_id: 's1', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
        { ref: 'c2', kind: 'OPERATION', label: 'no solicitation', quote_from: 'shall not, and', quote_to: 'any Takeover Proposal.', source_span_id: 's1', occurrence: 0, origin: 'OWN', gap_before: false, children: [
          { ref: 'c3', kind: 'DEFINED_TERM', label: 'Takeover Proposal', quote: 'Takeover Proposal', source_span_id: 's1', occurrence: 0, origin: 'OWN', gap_before: true, resolves_to: { structure_node_id: 'n83', text: 'any proposal or offer from any Person' }, children: [] },
        ] },
        { ref: 'c4', kind: 'QUALIFIER', label: 'definition words', quote: 'means any proposal', source_span_id: 's4', occurrence: 0, origin: 'DEFINITION', gap_before: false, children: [] },
        { ref: 'c5', kind: 'TERM', label: 'lost', quote_from: 'words not there', quote_to: 'either', source_span_id: 's1', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
      ],
      conclusions: { table_key: 't', row_label: 'r', cells: [] },
    }],
    groups: [{ client_ref: 'g1', family_key: 'NO_SHOP', subtype_key: 'X' }],
    links: [{ from_ref: 'p1', to_ref: 'p1', relationship_type: 'QUALIFIES', source_span_ids: ['s1', 'zz'] }],
    coverage: { NO_SHOP: 'FOUND' },
  };
  const { response, stats } = normaliseLeanResponse(answer, { aliases, anchors: true, sourceDocument, spansById });
  const proposal = response.proposals[0];
  assert.equal(proposal.components[0].source_span_id, 'a'.repeat(64));
  assert.equal(proposal.components[1].quote, 'shall not, and shall cause its Subsidiaries not to, directly or indirectly solicit any Takeover Proposal.');
  assert.equal(proposal.components[1].quote_resolved_from, 'anchors');
  assert.equal(proposal.components[1].children[0].source_span_id, 'a'.repeat(64));
  assert.equal(proposal.components[2].source_span_id, 'd'.repeat(64));
  assert.equal(proposal.components[3].quote, undefined, 'anchors that are not in the span leave the quote unresolved for the validator to hold');
  assert.deepEqual(response.links[0].source_span_ids, ['a'.repeat(64), 'zz'], 'an unknown alias is left as written');
  assert.deepEqual(proposal.evidence_quotes, [
    { quote: 'The Company', source_span_id: 'a'.repeat(64), occurrence: 0 },
    { quote: 'shall not, and shall cause its Subsidiaries not to, directly or indirectly solicit any Takeover Proposal.', source_span_id: 'a'.repeat(64), occurrence: 0 },
    { quote: 'Takeover Proposal', source_span_id: 'a'.repeat(64), occurrence: 0 },
  ], 'the OWN components with words are the evidence; the DEFINITION component is not');
  assert.deepEqual(proposal.roles, {});
  assert.deepEqual(stats, { aliases_mapped: 6, anchors_resolved: 1, anchors_unresolved: 1, offsets_resolved: 0, offsets_unresolved: 0, listed_spans_resolved: 0, statements_derived: 0, evidence_derived: 1, roles_defaulted: 1 });
  assert.equal(answer.proposals[0].components[1].quote, undefined, 'the answer as the model wrote it is not changed');
});

test('the parts of a split section go out together up to the environment\'s concurrency, the answers kept in part order and a failure surfacing after the others settle', async () => {
  assert.equal(extractionPartConcurrency({}), 4, 'work package E3: the parts go out together by default');
  assert.equal(extractionPartConcurrency({ PRODUCT_EXTRACTION_PART_CONCURRENCY: '1' }), 1);
  assert.equal(extractionPartConcurrency({ PRODUCT_EXTRACTION_PART_CONCURRENCY: '4' }), 4);
  assert.equal(extractionPartConcurrency({ PRODUCT_EXTRACTION_PART_CONCURRENCY: '40' }), 8);
  assert.equal(extractionPartConcurrency({ PRODUCT_EXTRACTION_PART_CONCURRENCY: 'many' }), 1);
  let inFlight = 0;
  let peak = 0;
  const order = [];
  const results = await mapWithConcurrency([30, 10, 20, 5], 2, async (ms, index) => {
    inFlight += 1; peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, ms));
    inFlight -= 1; order.push(index);
    return index * 2;
  });
  assert.deepEqual(results, [0, 2, 4, 6], 'results sit at their item\'s index whatever order they finished in');
  assert.equal(peak, 2);
  assert.notDeepEqual(order, [0, 1, 2, 3]);
  const settled = [];
  await assert.rejects(() => mapWithConcurrency([1, 2, 3], 3, async (item) => { await new Promise((resolve) => setTimeout(resolve, item * 5)); settled.push(item); if (item === 1) throw new Error('part 1 failed'); return item; }), /part 1 failed/);
  assert.deepEqual(settled, [1, 2, 3], 'the parts already in flight finish before the failure surfaces');
  const serial = await mapWithConcurrency([1, 2], 1, async (item) => item + 1);
  assert.deepEqual(serial, [2, 3]);
});
