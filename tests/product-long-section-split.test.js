'use strict';

// Q6 (plan Phase 5B, 2026-09-14): a long section is extracted per group of
// its child limbs and the parts merge into one response.

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, longSectionGroups, limblessSectionParts, mergePartResponses, splitForAttempt, LONG_SECTION_SPLIT } = require('../lib/product/agreement-draft');
const { buildSourceClosure, residualParagraphSpans, substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { conchoSource, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

async function conchoNoShop() {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  return { sourceDocument, agreementStructure, node };
}

test('longSectionGroups splits a long section with children into source-ordered runs of limbs, and leaves a short one whole', async () => {
  const { sourceDocument, agreementStructure, node } = await conchoNoShop();
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const production = longSectionGroups(closure);
  assert.ok(production.length > 1, 'Concho 6.3 (20k bytes, 7 limbs) splits under the production thresholds');
  // 5,000 bytes and three limbs since 2026-09-14 (Metsera generation 6,
  // 3.09: eleven limbs in 7k bytes outran the CLI's output cap).
  const mid = substantiveSections(agreementStructure).find((item) => item.reference === '4.10');
  assert.ok(longSectionGroups(buildSourceClosure({ sourceDocument, agreementStructure, nodeId: mid.node_id })).length > 1, '4.10 (5k bytes, 12 limbs) splits under the production thresholds');
  const sized = (item) => item.span.end_byte - item.span.start_byte;
  const short = substantiveSections(agreementStructure).filter((item) => sized(item) < 4000).sort((left, right) => sized(right) - sized(left))[0];
  assert.deepEqual(longSectionGroups(buildSourceClosure({ sourceDocument, agreementStructure, nodeId: short.node_id })), [], `${short.reference} (${sized(short)} bytes) stays whole`);
  const groups = longSectionGroups(closure, { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 });
  assert.ok(groups.length > 1, `groups: ${groups.length}`);
  // The section's own opening words (limb (a) when it runs on from the
  // heading) lead the first group: Metsera generation 6 lost every split
  // section's (a) when the chapeau was context only.
  const localChapeau = closure.spans.find((span) => closure.chapeau_span_ids.includes(span.span_id) && span.structure_node_id === closure.structure_node_id);
  assert.ok(localChapeau, 'Concho 6.3 has its own opening words');
  assert.deepEqual(groups.flat(), [localChapeau.span_id, ...closure.operative_span_ids], 'the opening words and every operative limb are in exactly one group, in order');
  assert.equal(groups[0][0], localChapeau.span_id);
  assert.deepEqual(longSectionGroups(closure, { min_section_bytes: 1000, min_children: 8, group_bytes: 6000 }), [], 'too few children: no split');
  assert.deepEqual(LONG_SECTION_SPLIT, { min_section_bytes: 5000, min_children: 3, group_bytes: 3500 });
});

test('mergePartResponses prefixes every ref per part and merges coverage to the strongest state', () => {
  const merged = mergePartResponses([
    { proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'NO_SHOP' }], groups: [{ client_ref: 'g1' }], links: [{ from_ref: 'p1', to_ref: 'p1', relationship_type: 'EXCEPTS' }], coverage: { NO_SHOP: 'NOT_FOUND' }, fact_type_coverage: { NO_SHOP: { PROHIBITED_ACTION: 'NOT_FOUND' } } },
    { proposals: [{ client_ref: 'p1', group_ref: 'g1', family_key: 'NO_SHOP' }], groups: [{ client_ref: 'g1' }], coverage: { NO_SHOP: 'FOUND' }, fact_type_coverage: { NO_SHOP: { PROHIBITED_ACTION: 'FOUND' } }, coverage_reason: { NO_SHOP: 'limbs (d) to (f)' } },
  ]);
  assert.deepEqual(merged.proposals.map((proposal) => proposal.client_ref), ['part1:p1', 'part2:p1']);
  assert.deepEqual(merged.groups.map((group) => group.client_ref), ['part1:g1', 'part2:g1']);
  assert.deepEqual(merged.links[0], { from_ref: 'part1:p1', to_ref: 'part1:p1', relationship_type: 'EXCEPTS' });
  assert.deepEqual(merged.coverage, { NO_SHOP: 'FOUND' });
  assert.deepEqual(merged.fact_type_coverage, { NO_SHOP: { PROHIBITED_ACTION: 'FOUND' } });
  assert.deepEqual(merged.coverage_reason, { NO_SHOP: 'limbs (d) to (f)' });
});

function partModel({ declinePart = null } = {}) {
  const extractionRequests = [];
  return {
    extractionRequests,
    async complete({ call_kind: kind, request }) {
      let response;
      if (kind === 'ROUTING') {
        // The synthetic router answers NO_SHOP and disagrees, with a reason,
        // with any other family the deterministic evidence names (Concho
        // 6.1's interim operating covenants, work package 9).
        const others = (request.deterministic_family_evidence || []).map((evidence) => evidence.section_family).filter((family) => family && family !== 'NO_SHOP');
        response = { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'no-shop', deterministic_disagreements: [...new Set(others)].map((family) => ({ family_key: family, reason: 'synthetic test model routes the no-shop family only' })) };
      } else if (kind === 'RESIDUAL') {
        response = { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'covered' })) };
      } else {
        extractionRequests.push(request);
        const part = request.source_closure.extraction_part?.part || 1;
        if (declinePart === part) {
          response = { proposals: [], groups: [], links: [], coverage: { NO_SHOP: 'UNRESOLVED' }, fact_type_coverage: {} };
        } else {
          const span = request.source_closure.operative[0];
          const words = span.exact_text.split(/\s+/).filter(Boolean).slice(1, 8).join(' ');
          const quote = span.exact_text.slice(span.exact_text.indexOf(words), span.exact_text.indexOf(words) + words.length);
          response = {
            proposals: [{
              client_ref: 'p-1', group_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
              statement: `Part ${part}: ${quote}`, roles: { covenant_obligor: 'Company', prohibited_action: quote }, value: null,
              evidence_quotes: [{ quote, source_span_id: span.span_id, occurrence: 0 }],
            }],
            groups: [{ client_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' }],
            links: [],
            coverage: { NO_SHOP: 'FOUND' },
            fact_type_coverage: { NO_SHOP: Object.fromEntries(schema.families.find((family) => family.family_key === 'NO_SHOP').required_fact_types.map((factType) => [factType, factType === 'PROHIBITED_ACTION' ? 'FOUND' : 'NOT_FOUND'])) },
          };
        }
      }
      return { provider_id: 'SYNTHETIC_TEST_PROVIDER', model_id: 'SYNTHETIC_LEGAL_MODEL/V1', raw_request: request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 1, duration_ms: 1 };
    },
  };
}

test('a long section is extracted in parts, each part carrying only its limbs with the chapeau as context, and the parts merge into one section draft', async () => {
  const { sourceDocument, agreementStructure, node } = await conchoNoShop();
  const model = partModel();
  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
    longSectionSplit: { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 },
  });
  const parts = model.extractionRequests.length;
  assert.ok(parts > 1, `parts: ${parts}`);
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  assert.deepEqual(model.extractionRequests.flatMap((request) => request.source_closure.operative.map((span) => span.span_id)), closure.operative_span_ids);
  const first = model.extractionRequests[0];
  assert.equal(first.source_closure.extraction_part.covers_chapeau, true, 'the first part covers the opening words');
  assert.match(first.part_instruction, /also covers the section's own opening words, the source_closure.chapeau span [0-9a-f]{64}/);
  for (const request of model.extractionRequests.slice(1)) {
    assert.equal(request.source_closure.extraction_part.covers_chapeau, false);
    assert.doesNotMatch(request.part_instruction, /opening words/);
  }
  const splitIssue = section.issues.find((issue) => issue.code === 'LONG_SECTION_SPLIT');
  assert.match(splitIssue.message, /"chapeau_in_part":1/);
  for (const request of model.extractionRequests) {
    assert.equal(request.source_closure.full_section.exact_text, '', 'the whole section is not resent with each part');
    assert.ok(request.source_closure.full_section.span_id, 'the span identity stays');
    assert.ok(request.source_closure.chapeau.length >= 0 && Array.isArray(request.source_closure.definitions));
    assert.match(request.part_instruction, /part \d+ of \d+/);
  }
  assert.equal(section.model_calls.length, 2 + parts, 'routing, residual and one extraction call per part');
  assert.equal(section.proposals.length, parts, 'one proposal per part, refs kept apart by the part prefix');
  assert.ok(section.issues.some((issue) => issue.code === 'LONG_SECTION_SPLIT'));
  const family = section.coverage.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY' && assertion.family_key === 'NO_SHOP');
  assert.equal(family.state, 'FOUND');
});

test('a part that declines (no proposals, every family UNRESOLVED) fails the attempt naming the part', async () => {
  const { sourceDocument, agreementStructure, node } = await conchoNoShop();
  const model = partModel({ declinePart: 2 });
  await assert.rejects(
    buildAgreementSectionDraft({
      sourceDocument, agreementStructure, legalSchema: schema, model, node,
      longSectionSplit: { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 },
    }),
    (error) => error.code === 'EXTRACTION_DECLINED' && /part 2 of/.test(error.message),
  );
});

// Work package 9 (plan finding (62), 2026-10-18): generation 8 FAILED on
// 9.03, the definitions section, which has no lettered limbs and so was
// never split: a 30-minute timeout, then two answers past the output cap.
// A long section with too few limbs splits by its paragraphs, each
// paragraph whole in exactly one part of the usual size.
async function conchoSection(reference) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === reference);
  return { sourceDocument, agreementStructure, node };
}

test('a long section with too few limbs splits by its paragraphs, each paragraph whole, into parts of the usual size', async () => {
  const { sourceDocument, agreementStructure, node } = await conchoSection('6.1');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  assert.ok(closure.operative_span_ids.length < LONG_SECTION_SPLIT.min_children, 'Concho 6.1 (14k bytes) has fewer limbs than the split asks for');
  assert.deepEqual(longSectionGroups(closure), [], 'the limb split leaves it whole');
  const paragraphs = residualParagraphSpans({ sourceDocument, closure });
  const parts = limblessSectionParts({ closure, paragraphs });
  assert.ok(parts && parts.groups.length > 1, `parts: ${parts && parts.groups.length}`);
  assert.deepEqual(parts.groups.flat(), paragraphs.map((span) => span.span_id), 'every paragraph is in exactly one part, in order');
  const bytesOf = new Map(paragraphs.map((span) => [span.span_id, span.end_byte - span.start_byte]));
  for (const group of parts.groups) {
    const total = group.reduce((sum, id) => sum + bytesOf.get(id), 0);
    assert.ok(total <= LONG_SECTION_SPLIT.group_bytes || group.length === 1, `a part is the usual size unless one paragraph alone exceeds it (${total})`);
  }
  // A short section, or one with enough limbs, takes no paragraph split.
  assert.equal(limblessSectionParts({ closure, paragraphs, split: { min_section_bytes: 50000, min_children: 3, group_bytes: 3500 } }), null);
  const { node: limbed } = await conchoSection('6.3');
  const limbedClosure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: limbed.node_id });
  assert.equal(limblessSectionParts({ closure: limbedClosure, paragraphs: residualParagraphSpans({ sourceDocument, closure: limbedClosure }) }), null, 'a section with limbs splits by its limbs, never its paragraphs');
});

test('a limbless long section is extracted in paragraph parts and the parts merge into one section draft', async () => {
  const { sourceDocument, agreementStructure, node } = await conchoSection('6.1');
  const model = partModel();
  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node, longSectionSplit: LONG_SECTION_SPLIT,
  });
  const parts = model.extractionRequests.length;
  assert.ok(parts > 1, `parts: ${parts}`);
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const paragraphs = residualParagraphSpans({ sourceDocument, closure });
  assert.deepEqual(model.extractionRequests.flatMap((request) => request.source_closure.operative.map((span) => span.span_id)), paragraphs.map((span) => span.span_id), 'the parts carry the paragraphs, each once, in order');
  for (const request of model.extractionRequests) {
    assert.ok(request.source_closure.operative.every((span) => span.kind === 'RESIDUAL_PARAGRAPH' && span.exact_text), 'each part carries its paragraphs\' words');
    assert.equal(request.source_closure.extraction_part.mode, 'paragraphs');
    assert.equal(request.source_closure.extraction_part.covers_chapeau, request.source_closure.extraction_part.part === 1, 'part 1 carries the opening words');
    assert.match(request.part_instruction, /has no lettered limbs, so it is extracted in \d+ parts by its paragraphs/);
    assert.match(request.part_instruction, /definitions in other parts are extracted elsewhere, cite them as context only/);
    assert.doesNotMatch(request.part_instruction, /opening words/);
    assert.equal(request.source_closure.full_section.exact_text, '', 'the whole section is not resent with each part');
  }
  const splitIssue = section.issues.find((issue) => issue.code === 'LONG_SECTION_SPLIT');
  assert.match(splitIssue.message, /"mode":"paragraphs"/);
  assert.match(splitIssue.message, /"chapeau_in_part":1/);
  assert.equal(section.model_calls.length, 2 + parts, 'routing, residual and one extraction call per part');
  assert.equal(section.proposals.length, parts, 'one proposal per part, each quoting its own paragraph');
});

// Work package 15 (plan finding (83), 2026-10-18): NCS generation 5's 5.1
// lost two attempts to the output cap on part 2 of 3 and each attempt sent
// the same three parts. The split for an attempt halves the parts for every
// earlier attempt that ran past an output cap, splits a section that was
// too short to split before, and leaves any other failure alone.
test('splitForAttempt halves the parts after an output-cap failure and leaves other failures alone', () => {
  const split = { min_section_bytes: 5000, min_children: 3, group_bytes: 3500 };
  assert.equal(splitForAttempt(split, null), split);
  assert.equal(splitForAttempt(split, { error_history: [] }), split);
  assert.equal(splitForAttempt(split, { error_history: [{ attempt: 1, error: { message: 'ANTHROPIC_API_JSON: response must be one exact JSON object' } }] }), split, 'a JSON failure is not an output cap');
  // The messages NCS 5.1's two attempts recorded (no code stored then).
  const once = splitForAttempt(split, { error_history: [{ attempt: 1, error: { message: 'ANTHROPIC_API_OUTPUT_TRUNCATED: the answer ran past the output cap (64000 output tokens)' } }] });
  assert.deepEqual(once, { min_section_bytes: 0, min_children: 3, group_bytes: 1750, after_output_cap: 1 });
  const twice = splitForAttempt(split, { error_history: [
    { attempt: 1, error: { message: 'ANTHROPIC_API_OUTPUT_TRUNCATED: the answer ran past the output cap (64000 output tokens)' } },
    { attempt: 2, error: { message: 'ANTHROPIC_API_OUTPUT_TRUNCATED: the answer ran past the output cap (64000 output tokens)', code: 'ANTHROPIC_API_OUTPUT_TRUNCATED' } },
  ] });
  assert.deepEqual(twice, { min_section_bytes: 0, min_children: 3, group_bytes: 875, after_output_cap: 2 });
  // The CLI path's cap, by code; and the floor.
  assert.equal(splitForAttempt(split, { error_history: [{ error: { code: 'CLAUDE_OUTPUT_TRUNCATED', message: 'x' } }] }).group_bytes, 1750);
  assert.equal(splitForAttempt(split, { error_history: Array.from({ length: 5 }, () => ({ error: { code: 'CLAUDE_OUTPUT_TRUNCATED', message: 'x' } })) }).group_bytes, 500);
  assert.equal(splitForAttempt(null, { error_history: [{ error: { code: 'CLAUDE_OUTPUT_TRUNCATED' } }] }), null, 'a caller that extracts whole keeps extracting whole');
});

test('after an output-cap failure the section is extracted in more, smaller parts and the split issue says so', async () => {
  const { sourceDocument, agreementStructure, node } = await conchoNoShop();
  const first = partModel();
  const usual = { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 };
  const before = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schema, model: first, node, longSectionSplit: usual });
  const retry = partModel();
  const claim = { error_history: [{ attempt: 1, error: { message: 'ANTHROPIC_API_OUTPUT_TRUNCATED: the answer ran past the output cap (64000 output tokens)' } }] };
  const after = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schema, model: retry, node, longSectionSplit: splitForAttempt(usual, claim) });
  assert.ok(retry.extractionRequests.length > first.extractionRequests.length, `${retry.extractionRequests.length} parts after, ${first.extractionRequests.length} before`);
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  assert.deepEqual(retry.extractionRequests.flatMap((request) => request.source_closure.operative.map((span) => span.span_id)), closure.operative_span_ids, 'every limb still goes to exactly one part, in order');
  const issue = JSON.parse(after.issues.find((candidate) => candidate.code === 'LONG_SECTION_SPLIT').message);
  assert.equal(issue.after_output_cap, 1);
  assert.equal(issue.group_bytes, 3000);
  assert.equal(JSON.parse(before.issues.find((candidate) => candidate.code === 'LONG_SECTION_SPLIT').message).after_output_cap, undefined);
});
