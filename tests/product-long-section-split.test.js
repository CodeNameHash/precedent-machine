'use strict';

// Q6 (plan Phase 5B, 2026-09-14): a long section is extracted per group of
// its child limbs and the parts merge into one response.

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, longSectionGroups, mergePartResponses, LONG_SECTION_SPLIT } = require('../lib/product/agreement-draft');
const { buildSourceClosure, substantiveSections } = require('../lib/product/source-context');

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
  const short = substantiveSections(agreementStructure).find((item) => item.reference === '4.10');
  assert.deepEqual(longSectionGroups(buildSourceClosure({ sourceDocument, agreementStructure, nodeId: short.node_id })), [], '4.10 (5k bytes, 12 limbs) stays whole');
  const groups = longSectionGroups(closure, { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 });
  assert.ok(groups.length > 1, `groups: ${groups.length}`);
  assert.deepEqual(groups.flat(), closure.operative_span_ids, 'every operative limb is in exactly one group, in order');
  assert.deepEqual(longSectionGroups(closure, { min_section_bytes: 1000, min_children: 8, group_bytes: 6000 }), [], 'too few children: no split');
  assert.equal(LONG_SECTION_SPLIT.min_children, 4);
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
        response = { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'no-shop', deterministic_disagreements: [] };
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
