'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { LONG_SECTION_SPLIT, THIN_ANSWER, buildAgreementSectionDraft, limbLead, longSectionGroups, resplitAfterOutputCap, splitForAttempt, thinAnswerSignals } = require('../lib/product/agreement-draft');
const { extractionPart, resumableCalls, resumingModel } = require('../lib/product/attempt-resume');
const { isRetryableAblationFailure, reusableAfterFailure } = require('../lib/product/cost-ablation');
const { REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { buildSourceClosure, substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');
const { FAMILY_FOR, LEAD_A, LEAD_B, conductOfBusinessSource, countedAnswerFor, countsNamed } = require('./fixtures/product/conduct-of-business-layout');

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
  assert.deepEqual(THIN_ANSWER, { uncited_share: 0.5, uncited_min_bytes: 1500, min_operative_bytes: 2000, budget_fraction: 0.25, paragraph_min_bytes: 80, output_tokens_per_byte: 0.5 });
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
  // A paragraph shorter than a sentence (a heading line) does not count.
  const short = [{ span_id: 'para8', start_byte: spans[2].start_byte + 10, end_byte: spans[2].start_byte + 40 }];
  assert.equal(thinAnswerSignals({ answer: cite(['op1', 'op2', 'op4']), spans, paragraphs: short, dispositions: [{ source_span_id: 'para8', disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'] }], routedFamilies: ['NO_SHOP'], outputTokens: 20000 }).thin, false);
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
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: { ...REQUEST_PROFILES.DEFAULT, part_counts: false }, longSectionSplit, thinAnswerGuard, attemptToken });
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

// Plan findings (199d) and (199e), work packages E11 and E12, on NCS 5.1's
// layout as the structure reads it (finding (226); the fixture in
// tests/fixtures/product/conduct-of-business-layout.js): a heading chapeau
// of 32 bytes, limb (a) with a two-sentence lead before its roman
// sub-limbs, limb (b) with a one-sentence lead, limb (c) without one; and
// 5.3, whose chapeau states covenants in three sentences.
const SPLIT_51 = { min_section_bytes: 1000, min_children: 3, group_bytes: 1500 };
const SPLIT_53 = { min_section_bytes: 1000, min_children: 3, group_bytes: 6000, chapeau_min_sentences: 1 };

async function runLayout(reference, { shortfall = () => 0, longSectionSplit, profile = { ...REQUEST_PROFILES.DEFAULT, part_counts: true }, outputTokens = 20000, thinAnswerGuard = true, attemptToken = null, wrap = null } = {}) {
  const sourceDocument = await conductOfBusinessSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === reference);
  const familyKey = FAMILY_FOR[reference];
  const seen = [];
  const calls = [];
  const base = { async complete(input) {
    seen.push(input);
    const reply = (response, tokens) => ({ provider_id: 'SYNTHETIC', model_id: 'LAYOUT/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: tokens, cost_microusd: 0, duration_ms: 1 });
    if (input.call_kind === 'ROUTING') return reply({ families: [familyKey], disposition: 'FAMILY_ASSIGNED', rationale: 'The test routes it.', deterministic_disagreements: [] }, 1);
    if (input.call_kind === 'RESIDUAL') return reply({ paragraphs: input.request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'IMMATERIAL', family_keys: [], rationale: 'Covered by the limbs.' })) }, 1);
    return reply(countedAnswerFor(input.request, { familyKey, shortfall }), outputTokens);
  } };
  const model = wrap ? wrap(base) : base;
  try {
    const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: profile, longSectionSplit, thinAnswerGuard, attemptToken, onModelCall: async (call) => { calls.push(call); } });
    return { result, seen, calls };
  } catch (error) {
    // A rejection carries what the model saw and what was recorded.
    error.seen = seen;
    error.calls = calls;
    throw error;
  }
}
const extractionRequests = (seen) => seen.filter((input) => input.call_kind === 'EXTRACTION').map((input) => input.request);
const partOf = (request) => request.source_closure.extraction_part;

test('under part_counts a chapeau that states covenants is a part of its own (5.3); a heading chapeau never is (5.1), under the flag or not: it goes with limb (a), and the opening-words count is the limb\'s', async () => {
  const own = await runLayout('5.3', { longSectionSplit: SPLIT_53 });
  const requests = extractionRequests(own.seen);
  const first = requests.find((request) => partOf(request).part === 1);
  assert.deepEqual(first.source_closure.operative, [], 'the chapeau part lists no limb');
  assert.equal(partOf(first).covers_chapeau, true);
  assert.match(first.part_instruction, /This part covers only the section's own opening words/);
  assert.match(first.part_instruction, /The opening words state 4 sentences of covenant/);
  assert.ok(requests.filter((request) => partOf(request).part > 1).every((request) => request.source_closure.operative.length >= 1 && !partOf(request).covers_chapeau));
  const splitIssue = JSON.parse(own.result.issues.find((issue) => issue.code === 'LONG_SECTION_SPLIT').message);
  assert.equal(splitIssue.chapeau_own_part, true);
  assert.equal(splitIssue.chapeau_in_part, 1);
  assert.ok(!own.result.issues.some((issue) => issue.code === 'THIN_PART_ANSWER'));
  assert.ok(own.result.proposals.length >= 4 + 4, 'the chapeau\'s four sentences and one per limb');
  // Without the flag: the first part carries the chapeau and the limbs, as before.
  const plain = await runLayout('5.3', { longSectionSplit: SPLIT_53, profile: { ...REQUEST_PROFILES.DEFAULT, part_counts: false } });
  const plainIssue = plain.result.issues.find((issue) => issue.code === 'LONG_SECTION_SPLIT');
  assert.ok(!plainIssue || JSON.parse(plainIssue.message).chapeau_own_part === undefined);
  // 5.1: the heading chapeau (32 bytes) is never a part of its own, whatever
  // the sentence threshold; it goes with limb (a); the count sentence names
  // limb (a)'s two-sentence lead, not the heading.
  const heading = await runLayout('5.1', { longSectionSplit: { ...SPLIT_51, chapeau_own_part: true, chapeau_min_sentences: 1 } });
  const parts = extractionRequests(heading.seen);
  assert.equal(parts.length, 2);
  const opening = parts.find((request) => partOf(request).covers_chapeau);
  assert.equal(partOf(opening).part, 1);
  assert.equal(opening.source_closure.operative.length, 1, 'limb (a) with the heading');
  assert.doesNotMatch(opening.part_instruction, /The opening words state/);
  assert.match(opening.part_instruction, /This part also covers the section's own opening words/);
  const counts = countsNamed(opening);
  assert.equal(counts.chapeau, 0);
  assert.deepEqual([...counts.leads.values()], [2], 'limb (a) states two sentences before (i)');
  assert.equal(counts.leads.keys().next().value, opening.source_closure.operative[0].span_id);
  assert.match(opening.part_instruction, /each affirmative covenant, each consent standard, each source of exception\), never fewer than the sentences, each citing that limb's span/);
  const second = parts.find((request) => partOf(request).part === 2);
  assert.deepEqual([...countsNamed(second).leads.values()], [1], 'limb (b) states one sentence before (i); limb (c) has no sub-limb and is not named');
  assert.equal(second.source_closure.operative.length, 2);
  const issue = JSON.parse(heading.result.issues.find((item) => item.code === 'LONG_SECTION_SPLIT').message);
  assert.equal(issue.chapeau_own_part, undefined);
  assert.deepEqual(issue.operative_spans_per_part, [2, 2]);
  assert.ok(!heading.result.issues.some((item) => item.code === 'THIN_PART_ANSWER'));
  assert.ok(heading.result.proposals.length >= 2 + 1 + 1);
  // No group of a heading alone, even when every limb exceeds the group bytes.
  const sourceDocument = await conductOfBusinessSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '5.1');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const bytesOf = new Map(closure.spans.map((span) => [span.span_id, span.end_byte - span.start_byte]));
  assert.deepEqual(longSectionGroups(closure, { ...SPLIT_51, group_bytes: 20 }).map((group) => group.map((id) => bytesOf.get(id))), [[32, 2729], [609], [347]]);
  // The lead reader: a colon ends a lead; a cross-reference is not a marker; no marker, no lead.
  assert.equal(limbLead(`(b) ${LEAD_B}\n(i) incur debt.`).sentences, 1);
  assert.equal(limbLead(`(a) ${LEAD_A}\n(i) amend;`).sentences, 2);
  assert.equal(limbLead('(a) Subject to clause (i) of Section 5.1, the Company shall act. (i) first;').text, 'Subject to clause (i) of Section 5.1, the Company shall act.');
  assert.equal(limbLead('(c) Nothing herein gives Parent control.'), null);
});

test('the part minimum is the sum of the limbs\' lead counts: 5.1 part 1 (limb (a), two sentences) one short fails the attempt once every part has answered, naming the thin part; a part under min_operative_bytes has no minimum; the attempt after is kept and marked', async () => {
  const oneShort = (part) => (part === 1 ? 1 : 0);
  await assert.rejects(() => runLayout('5.1', { shortfall: oneShort, longSectionSplit: SPLIT_51 }), (error) => {
    assert.equal(error.code, 'THIN_ANSWER');
    assert.equal(error.thin_answer.part, 1);
    assert.equal(error.thin_answer.minimum_proposals, 2);
    assert.equal(error.thin_answer.proposals, 1);
    assert.deepEqual(error.thin_answer.reasons, ['BELOW_PART_MINIMUM']);
    assert.deepEqual(error.extraction_part.thin_parts, [1]);
    assert.deepEqual(error.thin_answer.thin_parts, [1]);
    assert.equal(error.extraction_part.mode, 'thin');
    // Every part answered before the attempt failed: the healthy part's call is on the record.
    assert.equal(error.seen.filter((input) => input.call_kind === 'EXTRACTION').length, 2);
    assert.equal(error.calls.filter((call) => call.call_kind === 'EXTRACTION').length, 2);
    return true;
  });
  // Part 2 (limb (b) and (c), 956 bytes) is under min_operative_bytes: its count is named, not enforced.
  const short2 = await runLayout('5.1', { shortfall: (part) => (part === 2 ? 1 : 0), longSectionSplit: SPLIT_51 });
  assert.ok(!short2.result.issues.some((item) => item.code === 'THIN_PART_ANSWER'));
  // The attempt after: kept and marked.
  const marked = await runLayout('5.1', { shortfall: oneShort, longSectionSplit: splitForAttempt(SPLIT_51, { error_history: [{ error: { code: 'THIN_ANSWER', message: 'x', part: { part: 1, of: 2, mode: 'thin', thin_parts: [1] } } }] }) });
  const issue = marked.result.issues.find((item) => item.code === 'THIN_PART_ANSWER');
  assert.ok(issue);
  assert.equal(JSON.parse(issue.message).part, 1);
  assert.ok(JSON.parse(issue.message).reasons.includes('BELOW_PART_MINIMUM'));
  assert.ok(marked.result.proposals.length >= 3, 'the other part\'s facts are kept');
  // The signal on its own: the minimum applies at min_operative_bytes, not under it.
  assert.deepEqual(thinAnswerSignals({ answer: cite(['op1', 'op2']), spans: spansOf([1200, 900]), outputTokens: 5000, minimumProposals: 3 }).reasons, ['BELOW_PART_MINIMUM']);
  assert.equal(thinAnswerSignals({ answer: cite(['op1', 'op2']), spans: spansOf([1200, 900]), outputTokens: 5000, minimumProposals: 2 }).thin, false);
  assert.equal(thinAnswerSignals({ answer: cite(['op1', 'op2']), spans: spansOf([900, 800]), outputTokens: 5000, minimumProposals: 3 }).thin, false);
});

test('a THIN_ANSWER retry re-runs only the thin part: the resume rule frees every other call of the failed attempt, and the resuming model answers them from the record', async () => {
  const oneShort = (part) => (part === 1 ? 1 : 0);
  // The first attempt, with its token: the failure and the calls the runner would have recorded.
  const failure = await runLayout('5.1', { shortfall: oneShort, longSectionSplit: SPLIT_51, attemptToken: 'attempt-1' }).then(() => null, (error) => error);
  assert.equal(failure.code, 'THIN_ANSWER');
  const run1 = failure.calls.map((call, index) => ({ ...call, created_at: `2026-10-22T10:00:0${index}Z` }));
  assert.deepEqual(run1.map((call) => call.call_kind), ['ROUTING', 'RESIDUAL', 'EXTRACTION', 'EXTRACTION']);
  assert.ok(run1.every((call) => typeof call.invocation_id === 'string'));
  // The history entry as the store writes it (phase-1-store failureRecord) with the attempt's token.
  const entry = { attempt_token: 'attempt-1', error: { code: failure.code, message: failure.message, part: failure.extraction_part } };
  const reusable = resumableCalls({ errorHistory: [entry], calls: run1 });
  assert.equal(reusable.size, 3, 'routing, residual and part 2; the thin part 1 is not reusable');
  assert.deepEqual([...reusable.values()].map((call) => extractionPart(call.request)?.part ?? call.call_kind).sort(), [2, 'RESIDUAL', 'ROUTING']);
  // The ablation harness reads the same from its own records.
  const harness = reusableAfterFailure(run1, { error: { code: failure.code, message: failure.message, part: failure.extraction_part } });
  assert.deepEqual([...harness.keys()].sort(), [...reusable.keys()].sort());
  assert.equal(reusableAfterFailure(run1, { error: { code: 'CLAUDE_PRODUCT_JSON', message: 'prose' } }).size, 0, 'a failure that names no part frees nothing');
  // The next attempt, through the resuming model: the provider answers part 1 alone; the other calls are records with the original named and no spend.
  const provider = [];
  const second = await runLayout('5.1', {
    longSectionSplit: splitForAttempt(SPLIT_51, { error_history: [entry] }), attemptToken: 'attempt-2',
    wrap: (base) => resumingModel({ async complete(input) { provider.push(input); return base.complete(input); } }, { calls: reusable }),
  });
  assert.deepEqual(provider.map((input) => `${input.call_kind}${input.call_kind === 'EXTRACTION' ? ` part ${input.request.source_closure.extraction_part.part}` : ''}`), ['EXTRACTION part 1']);
  const resumed = second.calls.filter((call) => call.resumed_from_model_call_id);
  assert.equal(resumed.length, 3);
  assert.ok(resumed.every((call) => call.output_tokens === 0 && call.cost_microusd === 0));
  assert.ok(resumed.every((call) => run1.some((original) => original.model_call_id === call.resumed_from_model_call_id)));
  assert.ok(!second.result.issues.some((item) => item.code === 'THIN_PART_ANSWER'), 'part 1 answered whole the second time');
  assert.ok(second.result.proposals.length >= 4);
});

test('the output-cap re-split never leaves the heading alone: a cap failure on part 1 (the heading with limb (a)) splits limb (a) by its paragraphs with the heading folded into the first run', async () => {
  const sourceDocument = await conductOfBusinessSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '5.1');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const [firstGroup] = longSectionGroups(closure, SPLIT_51);
  assert.equal(firstGroup.length, 2, 'the heading and limb (a)');
  const capped = splitForAttempt(SPLIT_51, { error_history: [{ error: { code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', message: 'ran past the output cap', part: { part: 1, of: 2, mode: 'limbs', span_ids: firstGroup } } }] });
  const after = await runLayout('5.1', { longSectionSplit: capped });
  const requests = extractionRequests(after.seen);
  assert.ok(requests.length >= 3, `limb (a) re-split into paragraph parts: ${requests.length} parts`);
  assert.ok(requests.every((request) => request.source_closure.operative.length >= 1), 'no part lists nothing');
  const opening = requests.find((request) => partOf(request).covers_chapeau);
  assert.equal(partOf(opening).part, 1);
  assert.equal(partOf(opening).mode, 'paragraphs');
  assert.match(opening.part_instruction, /covers only the paragraphs of one limb/);
  assert.match(opening.part_instruction, /This part also covers the section's own opening words/);
  assert.ok(opening.source_closure.operative[0].exact_text.includes(LEAD_A.slice(0, 40)), 'limb (a)\'s lead paragraph is the first paragraph of part 1');
  assert.equal(requests.filter((request) => partOf(request).covers_chapeau).length, 1);
  const issue = JSON.parse(after.result.issues.find((item) => item.code === 'LONG_SECTION_SPLIT').message);
  assert.equal(issue.mode, 'limbs+paragraphs');
  assert.ok(issue.after_output_cap);
  // The halving of a group with two substantive members never cuts a short member off alone.
  const bytes = { h: 32, a: 2000, b: 1800 };
  const spans = Object.entries(bytes).map(([id, size], index) => ({ span_id: id, start_byte: index * 10000, end_byte: index * 10000 + size, exact_text: 'x' }));
  const fake = { spans, structure_node_id: 'n', chapeau_span_ids: ['h'], operative_span_ids: ['a', 'b'], full_section_span_id: 'h' };
  const halved = resplitAfterOutputCap({ groups: [['h', 'a', 'b']], closure: fake, paragraphs: [], split: SPLIT_51, failedParts: [{ span_ids: ['h', 'a', 'b'] }] });
  assert.deepEqual(halved.groups, [['h', 'a'], ['b']]);
});
