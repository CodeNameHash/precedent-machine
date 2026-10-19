'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { LEAN_PROMPT_VERSION, buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { ANTHROPIC_API_REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { ABLATION_VARIANTS, analysisFromResults, compareFacts, createRecorder, createVariantModel, recordingKey, renderAblationTable, runSectionAblation, thinkingOf } = require('../lib/product/cost-ablation');
const { indexStoredCalls } = require('../lib/product/run-replay');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Work package E1 item 3 (implementer E): the lean request profile end to
// end on a real section (Concho 6.3, the no-shop, through the synthetic
// routing and a lean answer written from the request the way the model
// would), the fact matcher on the bytes, and the variant model that
// replays, records and goes live.

function firstWordsOf(text, count) { return text.trim().split(/\s+/).slice(0, count).join(' '); }
function lastWordsOf(text, count) { return text.trim().split(/\s+/).slice(-count).join(' '); }

// A lean answer the way the model would write it: aliases as span ids, a
// short component quoted whole, a long one by its first and last words,
// no roles, no evidence_quotes.
function leanAnswer(request) {
  const family = request.family_contracts[0];
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative[0];
  const sentence = operative.exact_text.split(/(?<=\.)\s+/)[0];
  assert.match(operative.span_id, /^s\d+$/, 'the request names spans by alias');
  const actorWords = sentence.match(/\b(?:the Company|Parent|Company)\b/)?.[0] || firstWordsOf(sentence, 2);
  return {
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: family.family_key, subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0],
      statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: ['c2'], summary: 'The lean answer on the no-shop covenant' },
      components: [
        { ref: 'c1', kind: 'ACTOR', label: 'obligor', quote: actorWords, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
        { ref: 'c2', kind: 'OPERATION', label: 'the covenant', quote_from: firstWordsOf(sentence, 4), quote_to: lastWordsOf(sentence, 4), source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
      ],
    }],
    groups: [{ client_ref: 'g1', family_key: family.family_key, subtype_key: subtype.subtype_key }],
    links: [],
    coverage: Object.fromEntries(request.family_contracts.map((item) => [item.family_key, item.family_key === family.family_key ? 'FOUND' : 'NOT_FOUND'])),
    fact_type_coverage: Object.fromEntries(request.family_contracts.map((item) => [item.family_key, Object.fromEntries(item.required_fact_types.map((type) => [type, item.family_key === family.family_key && type === family.required_fact_types[0] ? 'FOUND' : 'NOT_FOUND']))])),
  };
}

test('the lean profile end to end on Concho 6.3: aliased request without roles or evidence quotes, the agreement beside it, the answer read back and compiled', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = {
    async complete(input) {
      seen.push(input);
      if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
      const response = leanAnswer(input.request);
      return { provider_id: 'SYNTHETIC', model_id: 'LEAN/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
    },
  };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: ANTHROPIC_API_REQUEST_PROFILES.LEAN });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  assert.equal(extraction.prompt_version, LEAN_PROMPT_VERSION);
  assert.equal(extraction.request.response_contract.proposals[0].roles, undefined);
  assert.equal(extraction.request.response_contract.proposals[0].evidence_quotes, undefined);
  assert.match(extraction.request.response_contract.proposals[0].components[0].quote_from, /first 4 words/);
  assert.match(extraction.request.instruction, /Do not return roles or evidence_quotes/);
  assert.match(extraction.request.component_instruction, /quote_from/);
  assert.match(extraction.request.context_instruction, /first block of this message/);
  assert.equal(extraction.context.agreement_text, sourceDocument.canonical_text);
  assert.equal(extraction.request.agreement_context.source_document_id, sourceDocument.source_document_id);
  assert.ok(extraction.request.source_closure.operative.every((span) => /^s\d+$/.test(span.span_id) && span.exact_text));
  for (const listed of [...extraction.request.source_closure.definitions, ...extraction.request.source_closure.cross_references]) {
    assert.equal(listed.exact_text, undefined, 'definitions and cross-references are listed, not copied');
    assert.equal(listed.text_in, 'agreement block');
    assert.ok(typeof listed.first_words === 'string' && listed.first_words.length > 0);
  }
  // The compiled section: real span ids, the anchored quote resolved, the fact VALID, the roles empty and their coverage FOUND from the components.
  assert.equal(result.model_calls.find((call) => call.call_kind === 'EXTRACTION').prompt_version, LEAN_PROMPT_VERSION);
  const note = result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED');
  assert.ok(note, 'the section carries the lean note');
  const stats = JSON.parse(note.message);
  assert.equal(stats.request_profile, 'LEAN');
  assert.equal(stats.anchors_resolved, 1);
  assert.equal(stats.anchors_unresolved, 0);
  assert.equal(stats.evidence_derived, 1);
  assert.equal(stats.roles_defaulted, 1);
  assert.ok(stats.aliases_mapped >= 2);
  assert.equal(result.proposals.length, 1);
  const fact = result.proposals[0];
  assert.equal(fact.validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  assert.deepEqual(fact.roles, {});
  assert.ok(fact.source_span_ids.every((id) => /^[0-9a-f]{64}$/.test(id)), 'the evidence spans are real ids');
  assert.ok(fact.components.length === 2 && fact.components.every((component) => Number.isSafeInteger(component.start_byte)));
  assert.ok(fact.components[1].text.split(/\s+/).length > 8, 'the long component carries the resolved words');
  const roleCoverage = result.coverage.filter((item) => item.subject_kind === 'ROLE');
  assert.ok(roleCoverage.length > 0);
  assert.ok(roleCoverage.every((item) => item.state === 'FOUND' && item.reason === 'ROLE_IN_COMPONENTS'));
  // The analysis read's shape for compare-generations: the fact with its component bytes under its section.
  const analysis = analysisFromResults({ run: { run_id: 'r' }, results: [result], label: 'lean' });
  assert.equal(analysis.kind, 'draftAnalysis');
  assert.equal(analysis.sections[0].section_reference, '6.3');
  assert.equal(analysis.proposals.length, 1);
  assert.ok(analysis.spans.length > 0);
});

test('the offsets mode reads a component\'s words from the span by character offsets, and the trimmed context keeps the sections the words name', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = {
    async complete(input) {
      seen.push(input);
      if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
      const family = input.request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
      const subtype = family.subtypes[0];
      const operative = input.request.source_closure.operative[0];
      const characters = Array.from(operative.exact_text);
      const end = Math.min(characters.length, 120);
      const response = {
        proposals: [{
          client_ref: 'p1', group_ref: 'g1', family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0],
          statement: characters.slice(0, end).join(''),
          headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: ['c1'], summary: 'Offsets on the no-shop' },
          components: [{ ref: 'c1', kind: 'OPERATION', label: 'the covenant', quote_offsets: [0, end], source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
        }],
        groups: [{ client_ref: 'g1', family_key: 'NO_SHOP', subtype_key: subtype.subtype_key }],
        links: [],
        coverage: Object.fromEntries(input.request.response_contract.allowed_fact_types_by_family ? Object.keys(input.request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' ? 'FOUND' : 'NOT_FOUND']) : []),
      };
      return { provider_id: 'SYNTHETIC', model_id: 'LEAN/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
    },
  };
  const profile = { name: 'OFFSETS_TRIMMED_ALL', response_format: 'V10', quote_mode: 'offsets', context_mode: 'trimmed', stable_blocks: 2, contracts_scope: 'all' };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: profile });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  assert.ok(extraction.request.family_contracts.length > 1, 'every family\'s contract is in the request');
  assert.deepEqual(extraction.request.routed_families, ['NO_SHOP']);
  assert.deepEqual(Object.keys(extraction.request.response_contract.allowed_fact_types_by_family), ['NO_SHOP'], 'the answer is still bound to the routed families');
  assert.match(extraction.request.component_instruction, /quote_offsets/);
  assert.ok(extraction.request.response_contract.proposals[0].components[0].quote_offsets);
  const listed = extraction.request.source_closure.cross_references.filter((span) => span.text_in === 'agreement block');
  const whole = extraction.request.source_closure.cross_references.filter((span) => span.exact_text);
  assert.ok(whole.length + listed.length === extraction.request.source_closure.cross_references.length);
  assert.equal(extraction.context, undefined, 'the trimmed context sends no agreement block');
  const note = JSON.parse(result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED').message);
  assert.equal(note.offsets_resolved, 1);
  assert.equal(note.offsets_unresolved, 0);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  assert.equal(result.proposals[0].components[0].text.length, 120);
  assert.deepEqual(thinkingOf([{ output_tokens: 100, visible_output_tokens: 64 }, { output_tokens: 50 }]), { visible_output_tokens: 64, thinking_tokens: 36, thinking_share: 0.36, thinking_source: null });
  assert.deepEqual(thinkingOf([{ output_tokens: 100, visible_output_tokens: 60, thinking_source: 'reported', list_cost_microusd: 12300 }]), { list_cost_microusd: 12300, visible_output_tokens: 60, thinking_tokens: 40, thinking_share: 0.4, thinking_source: 'reported' });
  assert.deepEqual(thinkingOf([]), {});
});

test('compareFacts matches stored facts to a variant\'s on the bytes and names the new ones', () => {
  const stored = [
    { proposal_id: 'a', family_key: 'F', subtype_key: 'S', ranges: [[100, 200]] },
    { proposal_id: 'b', family_key: 'F', subtype_key: 'S', ranges: [[300, 400]] },
    { proposal_id: 'c', family_key: 'F', subtype_key: 'S', ranges: [[500, 600]] },
  ];
  const variant = [
    { proposal_id: 'x', validation_status: 'VALID', family_key: 'F', subtype_key: 'S', components: [{ origin: 'OWN', start_byte: 110, end_byte: 190 }] },
    { proposal_id: 'y', validation_status: 'VALID', family_key: 'F', subtype_key: 'S', components: [{ origin: 'OWN', start_byte: 390, end_byte: 410 }] },
    { proposal_id: 'z', validation_status: 'VALID', family_key: 'F', subtype_key: 'T', components: [{ origin: 'OWN', start_byte: 700, end_byte: 720 }] },
  ];
  const comparison = compareFacts({ storedFacts: stored, variantFacts: variant });
  assert.deepEqual(comparison.counts, { stored: 3, matched: 1, partial: 1, unmatched: 1, new: 1 });
  assert.deepEqual(comparison.rows.map((row) => [row.proposal_id, row.status, row.counterpart]), [['a', 'MATCHED', 'x'], ['b', 'PARTIAL', 'y'], ['c', 'UNMATCHED', null]]);
  assert.deepEqual(comparison.new_facts.map((fact) => fact.proposal_id), ['z']);
});

test('the variant model replays the stored kinds, records a live answer once and refuses a live call without a provider', async () => {
  const storedCall = { model_call_id: 'm1', structure_node_id: 'n1', call_kind: 'ROUTING', prompt_version: 'R/V3', provider_id: 'P', model_id: 'M', request: { instruction: 'route', section_reference: '1.1' }, response: { families: ['TERMINATION'] }, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1, created_at: '2026-10-18T00:00:00Z' };
  const index = indexStoredCalls([storedCall], { referenceByNode: new Map([['n1', '1.1']]) });
  const recorder = createRecorder();
  let liveCalls = 0;
  const liveModel = { async complete(input) { liveCalls += 1; return { provider_id: 'ANTHROPIC_API', model_id: 'claude-opus-5;effort=high', raw_request: input.request, raw_response: { content: [{ type: 'text', text: '{"proposals":[],"groups":[],"links":[]}' }] }, response: { proposals: [], groups: [], links: [] }, input_tokens: 5, output_tokens: 2, cost_microusd: 75, duration_ms: 3 }; } };
  const variant = { ...ABLATION_VARIANTS.format, name: 'format' };
  const model = createVariantModel({ variant, replayIndex: index, nodeByReference: new Map([['1.1', 'n1']]), liveModel, recorder });
  const routing = await model.complete({ call_kind: 'ROUTING', prompt_version: 'R/V3', request: { instruction: 'route', section_reference: '1.1' } });
  assert.deepEqual(routing.response, { families: ['TERMINATION'] });
  assert.equal(liveCalls, 0);
  const extraction = { call_kind: 'EXTRACTION', prompt_version: 'X/V10', request: { instruction: 'extract', source_closure: { section_reference: '1.1' } } };
  const first = await model.complete(extraction);
  assert.equal(liveCalls, 1);
  assert.deepEqual(first.response, { proposals: [], groups: [], links: [] });
  assert.equal(recorder.entries().length, 1);
  assert.equal(model.liveCalls.length, 1);
  const again = await model.complete(extraction);
  assert.equal(liveCalls, 1, 'the recording answers the second time');
  assert.deepEqual(again.response, { proposals: [], groups: [], links: [] });
  assert.equal(again.cost_microusd, 75);
  const offline = createVariantModel({ variant, replayIndex: index, nodeByReference: new Map([['1.1', 'n1']]), liveModel: null, recorder: createRecorder() });
  await assert.rejects(() => offline.complete(extraction), (error) => error.code === 'LIVE_CALL_REQUIRED');
  // The replay answers loosely by default (the first ladder's replay rungs all missed on byte identity): the stored call of the same section, kind and part, with the drift listed; the exact mode still misses.
  const moved = await model.complete({ call_kind: 'ROUTING', prompt_version: 'R/V3', request: { instruction: 'other', section_reference: '1.1' } });
  assert.deepEqual(moved.response, { families: ['TERMINATION'] });
  assert.deepEqual(model.drifts.map((drift) => [drift.section_reference, drift.call_kind, drift.part]), [['1.1', 'ROUTING', null]]);
  const exact = createVariantModel({ variant, replayIndex: index, nodeByReference: new Map([['1.1', 'n1']]), liveModel: null, recorder: createRecorder(), match: 'exact' });
  await assert.rejects(() => exact.complete({ call_kind: 'ROUTING', prompt_version: 'R/V3', request: { instruction: 'other', section_reference: '1.1' } }), (error) => error.code === 'REPLAY_MISS');
  await assert.rejects(() => model.complete({ call_kind: 'ROUTING', prompt_version: 'R/V3', request: { instruction: 'other', section_reference: '9.9' } }), (error) => error.code === 'REPLAY_MISS', 'a section the stored run never called');
});

test('the ablation table renders a stored row per section and a row per variant', () => {
  const ablations = [{
    variant: 'format', note: 'n', sections: [{
      section_reference: '5.2', stored_facts: { valid: 27, held: 0 }, facts: { valid: 26, held: 1 }, comparison: { counts: { stored: 27, matched: 24, partial: 2, unmatched: 1, new: 1 } },
      extraction: { fresh_input_tokens: 1000, cache_read_tokens: 2000, cache_write_tokens: 0, output_tokens: 500, duration_ms: 60000, cost_microusd: 150000, live_calls: 3, model_ids: ['claude-opus-5;effort=high'] },
      stored_extraction: { fresh_input_tokens: 122046, cache_read_tokens: 99061, cache_write_tokens: 44917, output_tokens: 92732, duration_ms: 1032000, cost_microusd: 3430000, model_ids: ['claude-opus-5;effort=high'], repriced_opus_5_5_usd: 2.7 },
      routing_families: ['NO_SHOP'], stored_routing_families: ['NO_SHOP'], lean_note: null,
    }],
  }];
  const table = renderAblationTable(ablations);
  assert.match(table, /\| stored run \| 5\.2 \| 27 \(0\) \|/);
  assert.match(table, /\| format \| 5\.2 \| 26 \(1\) \| 24 \/ 2 \/ 1 of 27 \| 1 \| 1,000 \| 2,000 \| 0 \| 500 \| 60 \| \$0\.15 \| 3 live/);
});

// Plan finding (187), the first ladder's defects (1) and (2): the recording
// key carries the model, the effort and the profile; a recording made under
// another model or effort is a miss; the per-section figures of a rung are
// that rung's own, never a running sum over the ladder.
test('two rungs that share a recorder and differ only in model or effort never reuse each other\'s answers, and an older recording without the model is a miss', async () => {
  const index = indexStoredCalls([], { referenceByNode: new Map() });
  const recorder = createRecorder();
  const seen = [];
  const liveModel = { async complete(input) { seen.push(input); return { provider_id: 'P', model_id: `${seen.length <= 1 ? 'claude-sonnet-5-5' : 'claude-opus-5-5'};effort=high`, raw_request: input.request, raw_response: { content: [{ type: 'text', text: `{"proposals":[],"groups":[],"links":[],"n":${seen.length}}` }], usage: { output_tokens: 10 * seen.length, output_tokens_details: { thinking_tokens: 4 * seen.length } }, model_usage: { m: { costUSD: 0.01 * seen.length } } }, response: { proposals: [], groups: [], links: [], n: seen.length }, input_tokens: 5, output_tokens: 10 * seen.length, cost_microusd: 0, duration_ms: 3 }; } };
  const extraction = { call_kind: 'EXTRACTION', prompt_version: 'X/V10', request: { instruction: 'extract', source_closure: { section_reference: '1.1' } } };
  const profile = { name: 'ANCHORS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2 };
  const sonnet = createVariantModel({ variant: { ...ABLATION_VARIANTS.anchors_sonnet55, name: 'anchors_sonnet55' }, replayIndex: index, nodeByReference: new Map(), liveModel, recorder, selectionFor: () => ({ model: 'claude-sonnet-5-5', effort: 'high' }), profile });
  const first = await sonnet.complete(extraction);
  assert.equal(first.response.n, 1);
  const opus = createVariantModel({ variant: { ...ABLATION_VARIANTS.anchors_opus55, name: 'anchors_opus55' }, replayIndex: index, nodeByReference: new Map(), liveModel, recorder, selectionFor: () => ({ model: 'claude-opus-5-5', effort: 'high' }), profile });
  const second = await opus.complete(extraction);
  assert.equal(second.response.n, 2, 'the same request under another model is a live call, not the recording');
  assert.equal(seen.length, 2);
  // The same model and effort again: the recording answers.
  const sonnetAgain = createVariantModel({ variant: { ...ABLATION_VARIANTS.anchors_sonnet55, name: 'anchors_sonnet55' }, replayIndex: index, nodeByReference: new Map(), liveModel, recorder, selectionFor: () => ({ model: 'claude-sonnet-5-5', effort: 'high' }), profile });
  assert.equal((await sonnetAgain.complete(extraction)).response.n, 1);
  assert.equal(seen.length, 2);
  // Medium effort on the same model: a miss, live.
  const medium = createVariantModel({ variant: { ...ABLATION_VARIANTS.anchors_medium, name: 'anchors_medium' }, replayIndex: index, nodeByReference: new Map(), liveModel, recorder, selectionFor: () => ({ model: 'claude-sonnet-5-5', effort: 'medium' }), profile });
  await medium.complete(extraction);
  assert.equal(seen.length, 3);
  // Another profile with the same words: a miss too.
  const other = createVariantModel({ variant: { ...ABLATION_VARIANTS.anchors_sonnet55, name: 'x' }, replayIndex: index, nodeByReference: new Map(), liveModel, recorder, selectionFor: () => ({ model: 'claude-sonnet-5-5', effort: 'high' }), profile: { ...profile, name: 'OTHER' } });
  await other.complete(extraction);
  assert.equal(seen.length, 4);
  const entries = recorder.entries();
  assert.equal(entries.length, 4);
  assert.ok(entries.every((entry) => typeof entry.recording_key === 'string' && entry.model && entry.effort && entry.profile));
  assert.notEqual(recordingKey(extraction, { model: 'a', effort: 'high', profile: 'p' }), recordingKey(extraction, { model: 'b', effort: 'high', profile: 'p' }));
  // An older recording, keyed by the call alone, answers nothing; and an entry whose own model id disagrees with the key is refused.
  const old = createRecorder([{ call_key: 'legacy', model_id: 'claude-sonnet-5-5;effort=high', raw_response: {} }]);
  assert.equal(old.entries().length, 0);
  const forged = createRecorder([{ ...entries[0], model_id: 'claude-haiku-5-5;effort=low' }]);
  assert.equal(forged.lookup(extraction, { model: 'claude-sonnet-5-5', effort: 'high', profile: entries[0].profile }), null);
  // Per-rung figures: each model's answered list holds its own entries only.
  assert.deepEqual(sonnet.answered.map((entry) => entry.output_tokens), [10]);
  assert.deepEqual(opus.answered.map((entry) => entry.output_tokens), [20]);
  assert.deepEqual(thinkingOf(opus.answered), { list_cost_microusd: 20000, visible_output_tokens: 12, thinking_tokens: 8, thinking_share: 0.4, thinking_source: 'reported' });
});
