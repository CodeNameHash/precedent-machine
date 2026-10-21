'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, normaliseLeanResponse } = require('../lib/product/agreement-draft');
const { REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Plan finding (197), work package E8: the three answer shapes that failed
// whole sections in the second Sonnet job (derived_statement_sonnet55,
// pm-ablation-20261019T171620Z) compile now. The normaliser repairs what
// the compiler's shape checks would have thrown on: a proposal with no
// statement and no resolved words (5.1, four parts), evidence quotes the
// model wrote under another name or without a span (5.17, 5.11, 3.15,
// 2.5, 3.13), a link whose endpoint names a component (4.12, 3.3).

function firstWordsOf(text, count) { return text.trim().split(/\s+/).slice(0, count).join(' '); }
function lastWordsOf(text, count) { return text.trim().split(/\s+/).slice(-count).join(' '); }

// The answer for one request, in the shape named; the same family and
// subtype the fixture routes 6.3 to.
function answerFor(request, shape) {
  const family = request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative[0];
  const sentence = operative.exact_text.split(/(?<=\.)\s+/)[0];
  const factType = family.required_fact_types[0];
  const proposal = (ref, components, extra = {}) => ({
    client_ref: ref, group_ref: `g${ref}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: factType,
    headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: [components[0].ref], summary: `The no-shop covenant (${ref})` },
    components, ...extra,
  });
  const group = (ref) => ({ client_ref: `g${ref}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key });
  const coverage = Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' ? 'FOUND' : 'NOT_FOUND']));
  if (shape === 'unresolved_anchors') {
    // No statement (the derived mode asked for none), and the one OWN component's anchors are words the span does not hold.
    return { proposals: [proposal('p1', [{ ref: 'c1', kind: 'OPERATION', label: 'the covenant', quote_from: 'zzqx words that', quote_to: 'nowhere appear qxzz', source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }])], groups: [group('p1')], links: [], coverage };
  }
  if (shape === 'evidence_names') {
    // Evidence quotes written anyway: one under span_id and text, one with no span at all.
    return { proposals: [proposal('p1', [{ ref: 'c1', kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }], {
      statement: sentence,
      evidence_quotes: [{ span_id: operative.span_id, text: firstWordsOf(sentence, 6), occurrence: 0 }, { quote: lastWordsOf(sentence, 4) }],
    })], groups: [group('p1')], links: [], coverage };
  }
  if (shape === 'component_link') {
    // Two facts; a link from p2's component to p1, and a link to a ref that is nothing.
    const second = operative.exact_text.split(/(?<=\.)\s+/)[1] || sentence;
    return {
      proposals: [
        proposal('p1', [{ ref: 'c1', kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }], { statement: sentence }),
        proposal('p2', [{ ref: 'c1', kind: 'EXCEPTION', label: 'the carve-out', quote_from: firstWordsOf(second, 4), quote_to: lastWordsOf(second, 4), source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }], { statement: second }),
      ],
      groups: [group('p1'), group('p2')],
      links: [{ from_ref: 'p2c1', to_ref: 'p1', relationship_type: 'EXCEPTS', source_span_ids: [] }, { from_ref: 'p1', to_ref: 'nothing', relationship_type: 'EXCEPTS', source_span_ids: [] }],
      coverage,
    };
  }
  throw new Error(`shape ${shape}`);
}

async function runConcho63(profile, shape, { longSectionSplit = null } = {}) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const response = answerFor(input.request, shape);
    return { provider_id: 'SYNTHETIC', model_id: 'REPAIR/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: profile, longSectionSplit });
  return { result, seen };
}

const leanNote = (result) => JSON.parse(result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED').message);

test('derived statement with no resolved words: the section compiles, the statement is the anchors the model wrote, the fact is held on its component, the note says fallback; the same across a four-part split', async () => {
  const profile = { ...REQUEST_PROFILES.DEFAULT, statement_mode: 'derived' };
  const { result } = await runConcho63(profile, 'unresolved_anchors');
  assert.equal(result.proposals.length, 1, 'no MODEL_RESPONSE_SHAPE proposal.statement');
  const proposal = result.proposals[0];
  assert.match(proposal.statement, /^zzqx words that \.\.\. nowhere appear qxzz$/, 'the anchors verbatim, the fallback the normaliser records as statement_source anchors');
  assert.equal(proposal.validation_status, 'INVALID', 'the words did not resolve: held, not lost');
  const note = leanNote(result);
  assert.equal(note.statements_fallback, 1);
  assert.equal(note.statements_derived, 0);
  assert.equal(note.anchors_unresolved, 1);
  const split = await runConcho63(profile, 'unresolved_anchors', { longSectionSplit: { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 } });
  const parts = split.seen.filter((input) => input.call_kind === 'EXTRACTION').length;
  assert.ok(parts >= 2, `the section split into ${parts} parts`);
  assert.equal(split.result.proposals.length, parts, 'every part compiled');
  assert.equal(leanNote(split.result).statements_fallback, parts);
  // A proposal with neither words nor anchors nor headline still carries a statement.
  const bare = normaliseLeanResponse({ proposals: [{ client_ref: 'p', family_key: 'NO_SHOP', components: [] }] }, { sourceDocument: { canonical_text: '' }, spansById: new Map(), derivedStatement: true });
  assert.equal(bare.response.proposals[0].statement, '[no words of this fact resolved; see its components]');
  assert.equal(bare.response.proposals[0].statement_source, 'placeholder');
  const headline = normaliseLeanResponse({ proposals: [{ client_ref: 'p', family_key: 'NO_SHOP', headline: { label: 'L', summary: 'The summary.' }, components: [] }] }, { sourceDocument: { canonical_text: '' }, spansById: new Map() });
  assert.equal(headline.response.proposals[0].statement, 'The summary.');
  assert.equal(headline.response.proposals[0].statement_source, 'headline');
});

test('evidence quotes the model wrote under span_id and text, or without a span: repaired or dropped, never a shape failure of the section', async () => {
  const { result } = await runConcho63(REQUEST_PROFILES.DEFAULT, 'evidence_names');
  assert.equal(result.proposals.length, 1, 'no MODEL_RESPONSE_SHAPE proposal.evidence_quotes[].source_span_id');
  assert.equal(result.proposals[0].validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  const note = leanNote(result);
  assert.equal(note.evidence_repaired, 1);
  assert.equal(note.evidence_dropped, 1);
  assert.equal(note.evidence_derived, 0, 'the repaired quote stands; nothing derived');
  // Every entry dropped: the components give the evidence.
  const none = normaliseLeanResponse({ proposals: [{ client_ref: 'p', family_key: 'NO_SHOP', statement: 's', evidence_quotes: [{ quote: 'words' }, 'junk'], components: [{ ref: 'c', kind: 'OPERATION', quote: 'the words', source_span_id: 'x', occurrence: 0, origin: 'OWN' }] }] }, { sourceDocument: { canonical_text: '' }, spansById: new Map() });
  assert.deepEqual(none.response.proposals[0].evidence_quotes, [{ quote: 'the words', source_span_id: 'x', occurrence: 0 }]);
  assert.equal(none.stats.evidence_dropped, 2);
  assert.equal(none.stats.evidence_derived, 1);
  // source_span under an alias is mapped like any id.
  const aliased = normaliseLeanResponse({ proposals: [{ client_ref: 'p', family_key: 'NO_SHOP', statement: 's', evidence_quotes: [{ source_span: 's1', quote: 'w' }], components: [] }] }, { aliases: { toId: new Map([['s1', 'SPAN-1']]), toAlias: new Map([['SPAN-1', 's1']]) }, sourceDocument: { canonical_text: '' }, spansById: new Map() });
  assert.deepEqual(aliased.response.proposals[0].evidence_quotes, [{ quote: 'w', source_span_id: 'SPAN-1', occurrence: 0 }]);
});

test('a link from a component ref is read as its proposal; a link to nothing is dropped; the section compiles', async () => {
  const { result } = await runConcho63(REQUEST_PROFILES.DEFAULT, 'component_link');
  assert.equal(result.proposals.length, 2, 'no FACT_LINK_ENDPOINT');
  assert.equal(result.links.length, 1, 'p2c1 -> p1 kept as p2 -> p1; p1 -> nothing dropped');
  const note = leanNote(result);
  assert.equal(note.link_endpoints_mapped, 1);
  assert.equal(note.links_dropped, 1);
  // The prefix form when the component ref is not unique: "p3c1" names p3 by its prefix.
  const prefixed = normaliseLeanResponse({ proposals: [
    { client_ref: 'p1', family_key: 'NO_SHOP', statement: 's', components: [{ ref: 'c1', kind: 'OPERATION', quote: 'a', source_span_id: 'x', occurrence: 0, origin: 'OWN' }] },
    { client_ref: 'p3', family_key: 'NO_SHOP', statement: 's', components: [{ ref: 'c1', kind: 'OPERATION', quote: 'b', source_span_id: 'x', occurrence: 0, origin: 'OWN' }] },
  ], links: [{ from_ref: 'p3c1', to_ref: 'p1', relationship_type: 'EXCEPTS', source_span_ids: [] }], cross_section_links: [{ from_ref: 'p1c1', to_section_reference: '1.1', relationship_type: 'DEFINED_BY', source_span_ids: [] }, { from_ref: 'qq', to_section_reference: '1.1' }] }, { sourceDocument: { canonical_text: '' }, spansById: new Map() });
  assert.deepEqual(prefixed.response.links.map((link) => [link.from_ref, link.to_ref]), [['p3', 'p1']]);
  assert.deepEqual(prefixed.response.cross_section_links.map((link) => link.from_ref), ['p1']);
  assert.equal(prefixed.stats.link_endpoints_mapped, 2);
  assert.equal(prefixed.stats.links_dropped, 1);
});
