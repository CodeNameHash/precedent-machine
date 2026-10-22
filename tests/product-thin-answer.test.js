'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { LONG_SECTION_SPLIT, THIN_ANSWER, buildAgreementSectionDraft, splitForAttempt, thinAnswerSignals } = require('../lib/product/agreement-draft');
const { isRetryableAblationFailure } = require('../lib/product/cost-ablation');
const { REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Plan finding (199): the thin-answer guard of (196), built. A part or an
// unsplit section whose answer is thin by the signals read from the answer
// and the request is a failed attempt once (THIN_ANSWER) and, on an
// attempt after one, kept and marked (THIN_PART_ANSWER, the routed
// families UNRESOLVED). Shapes: 5.1 part 1 of the Opus 5.5 medium job
// (2,079 output tokens on a long part, finding (219)) and an article
// introduction answered with no facts at all (III-INTRO, finding (221)).

function spansOf(sizes) {
  let at = 1000;
  return sizes.map((size, index) => { const span = { span_id: `op${index + 1}`, start_byte: at, end_byte: at + size }; at += size + 2; return span; });
}
const cite = (ids) => ({ proposals: ids.map((id, index) => ({ client_ref: `p${index + 1}`, components: [{ ref: 'c', kind: 'OPERATION', quote: 'w', source_span_id: id, occurrence: 0, origin: 'OWN' }] })) });

test('the signals: 5.1 part 1\'s shape is thin by its uncited bytes and its output; a full answer is not; a residual paragraph in a routed family that no fact cites is thin on its own', () => {
  assert.deepEqual(THIN_ANSWER, { uncited_share: 0.5, uncited_min_bytes: 1500, min_operative_bytes: 2000, budget_fraction: 0.25, output_tokens_per_byte: 0.5 });
  const spans = spansOf([3000, 2500, 2800, 2200]);
  // One fact on the first span of a 10,500-byte part, 2,079 output tokens: the shape of 5.1 part 1 on Opus 5.5 medium.
  const thin = thinAnswerSignals({ answer: cite(['op1']), spans, outputTokens: 2079, routedFamilies: ['INTERIM_OPERATING_COVENANTS'] });
  assert.equal(thin.thin, true);
  assert.deepEqual(thin.reasons, ['OPERATIVE_BYTES_UNCITED', 'BELOW_FACT_BUDGET_AND_OUTPUT']);
  assert.equal(thin.operative_bytes, 10500);
  assert.equal(thin.uncited_bytes, 7500);
  assert.deepEqual(thin.uncited_span_ids, ['op2', 'op3', 'op4']);
  assert.equal(thin.expected_facts, 36);
  // Every span cited, many facts, the output in proportion: not thin.
  const full = thinAnswerSignals({ answer: { proposals: Array.from({ length: 17 }, (_, index) => ({ client_ref: `p${index}`, components: [{ ref: 'c', kind: 'OPERATION', quote: 'w', source_span_id: `op${(index % 4) + 1}`, occurrence: 0, origin: 'OWN' }] })) }, spans, outputTokens: 22739 });
  assert.equal(full.thin, false);
  assert.equal(full.uncited_bytes, 0);
  // Two of four spans cited and the output in proportion: under the share, not thin.
  const half = thinAnswerSignals({ answer: cite(['op1', 'op3']), spans, outputTokens: 9000 });
  assert.equal(half.thin, false);
  assert.equal(half.uncited_share, 0.448);
  // A residual paragraph the pass put in the routed family, inside the part and uncited: thin on that alone, whatever the share.
  const paragraphs = [{ span_id: 'para7', start_byte: spans[2].start_byte + 10, end_byte: spans[2].start_byte + 400 }];
  const dispositions = [{ source_span_id: 'para7', disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'] }, { source_span_id: 'para7', disposition: 'IMMATERIAL', family_keys: [] }];
  const residual = thinAnswerSignals({ answer: cite(['op1', 'op2', 'op4']), spans, paragraphs, dispositions, routedFamilies: ['NO_SHOP'], outputTokens: 20000 });
  assert.equal(residual.thin, true);
  assert.deepEqual(residual.reasons, ['RESIDUAL_PARAGRAPHS_UNCITED']);
  assert.deepEqual(residual.uncited_known_paragraphs, ['para7']);
  // The same paragraph in a family not routed, or cited, is nothing.
  assert.equal(thinAnswerSignals({ answer: cite(['op1', 'op2', 'op4']), spans, paragraphs, dispositions, routedFamilies: ['TERMINATION'], outputTokens: 20000 }).thin, false);
  assert.equal(thinAnswerSignals({ answer: cite(['op1', 'op2', 'op3', 'op4']), spans, paragraphs, dispositions, routedFamilies: ['NO_SHOP'], outputTokens: 20000 }).thin, false);
  // A short part never trips the byte floor; an empty answer on a long one does (the article introductions).
  assert.equal(thinAnswerSignals({ answer: { proposals: [] }, spans: spansOf([600, 500]), outputTokens: 300 }).thin, false);
  assert.equal(thinAnswerSignals({ answer: { proposals: [] }, spans: spansOf([1200, 900]), outputTokens: 300 }).thin, true);
  // The attempt history: a THIN_ANSWER failure counts on the split; the ablation retries it.
  assert.equal(splitForAttempt(LONG_SECTION_SPLIT, { error_history: [] }), LONG_SECTION_SPLIT);
  assert.deepEqual(splitForAttempt(LONG_SECTION_SPLIT, { error_history: [{ error: { code: 'THIN_ANSWER', message: 'THIN_ANSWER: {...}' } }] }), { ...LONG_SECTION_SPLIT, thin_answers: 1 });
  assert.equal(splitForAttempt(LONG_SECTION_SPLIT, { error_history: [{ error: { code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', message: 'ran past the output cap' } }, { error: { code: 'THIN_ANSWER' } }] }).thin_answers, 1);
  assert.equal(isRetryableAblationFailure({ code: 'THIN_ANSWER' }), true);
});

function answerFor(request, { facts }) {
  const family = request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative;
  const coverage = Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' && facts > 0 ? 'FOUND' : 'NOT_FOUND']));
  const proposals = [];
  const groups = [];
  for (let index = 0; index < facts && index < operative.length; index += 1) {
    const span = operative[index];
    const sentence = span.exact_text.split(/(?<=\.)\s+/)[0];
    groups.push({ client_ref: `g${index + 1}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key });
    proposals.push({
      client_ref: `p${index + 1}`, group_ref: `g${index + 1}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0], statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: [`c${index + 1}`], summary: 'The no-shop covenant' },
      components: [{ ref: `c${index + 1}`, kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
    });
  }
  return { proposals, groups, links: [], coverage };
}

async function runConcho63({ factsByPart, longSectionSplit = null, outputTokens = 2079, thinAnswerGuard = true, attemptToken = null }) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const part = input.request.source_closure.extraction_part?.part || 1;
    const facts = typeof factsByPart === 'function' ? factsByPart(part, input.request) : factsByPart[part] ?? factsByPart.default;
    const response = answerFor(input.request, { facts });
    return { provider_id: 'SYNTHETIC', model_id: 'THIN/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: typeof outputTokens === 'function' ? outputTokens(part) : outputTokens, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: REQUEST_PROFILES.DEFAULT, longSectionSplit, thinAnswerGuard, attemptToken });
  return { result, seen };
}

test('an unsplit section answered with no facts is a failed attempt the first time and a marked section the second; the guard is off without an attempt unless asked', async () => {
  await assert.rejects(() => runConcho63({ factsByPart: { default: 0 }, outputTokens: 300 }), (error) => {
    assert.equal(error.code, 'THIN_ANSWER');
    assert.deepEqual(error.thin_answer.reasons, ['RESIDUAL_PARAGRAPHS_UNCITED', 'OPERATIVE_BYTES_UNCITED', 'BELOW_FACT_BUDGET_AND_OUTPUT'], 'the synthetic residual put every paragraph in NO_SHOP and nothing cites them');
    assert.equal(error.thin_answer.section_reference, '6.3');
    assert.equal(error.thin_answer.proposals, 0);
    assert.equal(error.extraction_part, undefined, 'no part: the whole section');
    return true;
  });
  // The attempt after a THIN_ANSWER failure: kept and marked, the routed family UNRESOLVED.
  const marked = await runConcho63({ factsByPart: { default: 0 }, outputTokens: 300, longSectionSplit: splitForAttempt(LONG_SECTION_SPLIT, { error_history: [{ error: { code: 'THIN_ANSWER', message: 'x' } }] }) });
  const issue = marked.result.issues.find((item) => item.code === 'THIN_PART_ANSWER');
  assert.ok(issue, 'the section says the answer was thin');
  assert.equal(JSON.parse(issue.message).prior_thin_answers, 1);
  const family = marked.result.coverage.filter((item) => item.subject_kind === 'SECTION_FAMILY' && item.family_key === 'NO_SHOP');
  assert.deepEqual(family.map((item) => item.state), ['UNRESOLVED']);
  assert.match(family[0].reason, /^THIN_PART_ANSWER:/);
  assert.ok(marked.result.coverage.filter((item) => item.subject_kind === 'FACT_TYPE' && item.family_key === 'NO_SHOP').every((item) => item.state === 'UNRESOLVED'));
  // A full answer is untouched.
  const full = await runConcho63({ factsByPart: { default: 7 }, outputTokens: 20000 });
  assert.ok(!full.result.issues.some((item) => item.code === 'THIN_PART_ANSWER'));
  assert.ok(full.result.proposals.length >= 5);
  // No attempt token and nothing asked: a bare draft call accepts the thin answer as before (the fixtures' minimal answers).
  const bare = await runConcho63({ factsByPart: { default: 0 }, outputTokens: 300, thinAnswerGuard: null });
  assert.ok(!bare.result.issues.some((item) => item.code === 'THIN_PART_ANSWER'));
  // An attempt token alone turns it on.
  await assert.rejects(() => runConcho63({ factsByPart: { default: 0 }, outputTokens: 300, thinAnswerGuard: null, attemptToken: 'attempt-1' }), /THIN_ANSWER/);
});

test('a split section: the thin part fails the attempt naming its part, the other parts are not blamed; the attempt after is kept with the part marked', async () => {
  const split = { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 };
  const thinFirst = (part) => (part === 1 ? 1 : 3);
  await assert.rejects(() => runConcho63({ factsByPart: thinFirst, outputTokens: (part) => (part === 1 ? 2079 : 22739), longSectionSplit: split }), (error) => {
    assert.equal(error.code, 'THIN_ANSWER');
    assert.equal(error.thin_answer.part, 1);
    assert.equal(error.extraction_part.part, 1);
    assert.equal(error.extraction_part.mode, 'thin');
    assert.ok(error.extraction_part.span_ids.length >= 1);
    return true;
  });
  const marked = await runConcho63({ factsByPart: thinFirst, outputTokens: (part) => (part === 1 ? 2079 : 22739), longSectionSplit: splitForAttempt(split, { error_history: [{ error: { code: 'THIN_ANSWER', message: 'x', part: { part: 1 } } }] }) });
  const issue = marked.result.issues.find((item) => item.code === 'THIN_PART_ANSWER');
  assert.ok(issue);
  assert.equal(JSON.parse(issue.message).part, 1);
  assert.ok(marked.result.proposals.length >= 3, 'the other parts\' facts are kept');
  assert.deepEqual(marked.result.coverage.filter((item) => item.subject_kind === 'SECTION_FAMILY' && item.family_key === 'NO_SHOP').map((item) => item.state), ['UNRESOLVED']);
});
