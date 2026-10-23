'use strict';

// Held facts from the live preview of 2026-10-23 (the analysis preview
// response kept at /tmp/prev.json for the run): eight proposals are INVALID,
// six of them on INVALID_FACT_COMPONENTS and two on the duplicate occurrence
// rule. Both shapes are fed through compileExtraction here.
//
// Case A: a LIST with no words of its own and three resolved LIST_ELEMENT
// children is held "quote not found in source (EMPTY)", "text missing",
// "byte range missing". The live case is 62f1b6…, a MATERIAL_CONTRACT_
// BUCKET_PRESENT fact whose component 4 is kind LIST, label "Entity or
// relationship types", text "", source_span_id set, bytes null.
//
// Case B: two REPRESENTATION_QUALIFICATION facts at 744cf5… whose components
// all carry verified bytes — "the Company Disclosure Schedule delivered by
// the Company to Parent and Merger Sub prior to the execution of this
// Agreement" at 34376-34511 and the SEC Documents exception — are still
// held. No INVALID_FACT_COMPONENTS issue names them; DUPLICATE_FACT_
// OCCURRENCE holds both because their only OWN component is the same
// "Section 3.3 Capitalization." heading and the rule's footprint counted
// only OWN bytes, ignoring the INTRO words that distinguish the two facts.

const assert = require('node:assert/strict');
const test = require('node:test');
const { compileExtraction } = require('../lib/product/agreement-draft');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');

const SECTION_NODE = 'w'.repeat(64);
const FULL_ID = 'x'.repeat(64);
const call = { model_call_id: 'm'.repeat(64) };
const bytes = (text) => Buffer.byteLength(text, 'utf8');

function spanAt(canonical, text, kind) {
  const at = canonical.indexOf(text);
  assert.ok(at >= 0, `fixture text is present: ${text.slice(0, 50)}`);
  const start = bytes(canonical.slice(0, at));
  return {
    span_id: require('node:crypto').createHash('sha256').update(`${kind}:${start}:${text}`).digest('hex'),
    kind, structure_node_id: SECTION_NODE, start_byte: start, end_byte: start + bytes(text), exact_text: text,
  };
}

function compile({ canonical, contextSpans = [], proposals, base = {} }) {
  const full = {
    span_id: FULL_ID, kind: 'FULL_SECTION', structure_node_id: SECTION_NODE,
    start_byte: 0, end_byte: bytes(canonical), exact_text: canonical,
  };
  const spans = [...contextSpans, full];
  const closure = {
    source_closure_id: 'y'.repeat(64), structure_node_id: SECTION_NODE, section_node_id: SECTION_NODE,
    section_reference: '3.13', full_section_span_id: full.span_id,
    chapeau_span_ids: spans.filter((item) => item.kind === 'CHAPEAU').map((item) => item.span_id),
    spans,
  };
  const built = proposals.map((proposal, index) => {
    const merged = {
      client_ref: `p${index + 1}`, group_ref: `g${index + 1}`, family_key: 'REPRESENTATIONS',
      subtype_key: 'COMPLIANCE_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'the Company', LEGAL_OPERATION: 'represents and warrants', OPERATIVE_OBJECT: 'the matter' },
      value: null,
      headline: { label: 'Representation', distinguishing_refs: [proposal.components[0].ref], summary: 'The Company represents the matter stated in the section' },
      ...base,
      ...proposal,
    };
    for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
    return merged;
  });
  const response = {
    proposals: built,
    groups: built.map((proposal) => ({ client_ref: proposal.group_ref, family_key: proposal.family_key, subtype_key: proposal.subtype_key })),
    links: [],
  };
  return compileExtraction({
    sourceDocument: { source_document_id: 'z'.repeat(64), canonical_text: canonical },
    legalSchema: legalSchemaV2, node: { node_id: SECTION_NODE, reference: '3.13', kind: 'SECTION' },
    closure, call, response, routedFamilies: ['REPRESENTATIONS'], ownedNodeIds: new Set([SECTION_NODE]),
  });
}

const issueLines = (result) => result.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n');

test('A: a LIST with no words of its own takes its span from its resolved elements when its own cited span does not hold them', () => {
  const listWords = 'joint venture, partnership or limited liability company';
  const canonical = `Section 3.13 Material Contracts.\nSection 3.13(a) of the Company Disclosure Schedule identifies each of the following Company Contracts to which the Company is a party as of the date of this Agreement: any Company Contract constituting ${listWords}.\n`;
  const heading = spanAt(canonical, 'Section 3.13 Material Contracts.', 'SUPPORTING_EVIDENCE');
  const elements = ['joint venture', 'partnership', 'limited liability company'].map((text) => spanAt(canonical, text, 'SUPPORTING_EVIDENCE'));
  const result = compile({
    canonical,
    // The cited spans are in the closure, as they are on a live run; a
    // span the closure does not know would be relocated to the section and
    // the case would not reproduce.
    contextSpans: [heading, ...elements],
    proposals: [{
      statement: `Material Contract category: any Company Contract constituting ${listWords}.`,
      components: [
        { ref: 'c1', kind: 'OBJECT', label: 'Company Contract', quote: 'any Company Contract', source_span_id: FULL_ID, origin: 'OWN', children: [] },
        { ref: 'c2', kind: 'OPERATION', label: 'Constituting', quote: 'constituting', source_span_id: FULL_ID, origin: 'OWN', children: [] },
        {
          // The live LIST cites a span that does not hold its elements
          // (62f1b6… cited a paragraph span at 76932-77312; its elements
          // are at 80311-80367). The heading span plays that part here.
          ref: 'c3', kind: 'LIST', label: 'Entity or relationship types', source_span_id: heading.span_id, origin: 'OWN',
          children: elements.map((element, index) => ({
            ref: `c3${index}`, kind: 'LIST_ELEMENT', label: element.exact_text, quote: element.exact_text,
            source_span_id: element.span_id, origin: 'OWN', children: [],
          })),
        },
      ],
    }],
  });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].validation_status, 'VALID', issueLines(result));
  const list = result.proposals[0].components[2];
  assert.equal(list.kind, 'LIST');
  assert.equal(list.text, listWords, 'the list words run from the first element to the last');
  assert.equal(list.start_byte, elements[0].start_byte);
  assert.equal(list.end_byte, elements[2].end_byte);
  const cited = result.spans.find((span) => span.span_id === list.source_span_id);
  assert.ok(cited, 'the list cites a span of the compiled result');
  assert.ok(cited.start_byte <= list.start_byte && cited.end_byte >= list.end_byte, 'the list\'s span holds its words');
  const note = result.issues.find((issue) => issue.code === 'LIST_WORDS_FROM_ELEMENTS');
  assert.ok(note, issueLines(result));
  assert.deepEqual(JSON.parse(note.message).lists, [{ path: '2', elements: 3 }]);
});

test('B: two qualification facts that differ only in their INTRO words are distinct occurrences, not duplicates', () => {
  const intro = 'The Company hereby represents and warrants to Parent and Merger Sub that, except as (A) set forth in the Company Disclosure Schedule delivered by the Company to Parent and Merger Sub prior to the execution of this Agreement or (B) expressly disclosed in any Company SEC Documents filed with, or furnished to, the SEC and publicly available on or after July 13, 2023.';
  const headingWords = 'Section 3.3 Capitalization.';
  const canonical = `${intro}\n${headingWords}\n`;
  const chapeau = spanAt(canonical, intro, 'CHAPEAU');
  const disclosure = 'set forth in the Company Disclosure Schedule delivered by the Company to Parent and Merger Sub prior to the execution of this Agreement';
  const secDocuments = 'expressly disclosed in any Company SEC Documents filed with, or furnished to, the SEC';
  const qualification = (source) => ({
    subtype_key: 'REPRESENTATION_QUALIFICATION',
    fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
    statement: `The Company represents and warrants the capitalization representations except as ${source}.`,
    roles: { qualification_source: source, qualified_scope: 'the capitalization representations' },
    // The model wrote evidence for the one OWN heading; the INTRO words are
    // components only. Both facts therefore share this evidence span, as the
    // live pair does (source_span_ids [a9933be0]).
    evidence_quotes: [{ quote: headingWords, source_span_id: FULL_ID, occurrence: 0 }],
    components: [
      { ref: 'c1', kind: 'TERM', label: 'Qualified representation: Capitalization', quote: headingWords, source_span_id: FULL_ID, origin: 'OWN', children: [] },
      { ref: 'c2', kind: 'ACTOR', label: 'Company representing and warranting', quote: 'The Company hereby represents and warrants', source_span_id: chapeau.span_id, origin: 'INTRO', origin_structure_node_id: SECTION_NODE, children: [] },
      { ref: 'c3', kind: 'OBJECT', label: 'Source of exception', quote: source, source_span_id: chapeau.span_id, origin: 'INTRO', origin_structure_node_id: SECTION_NODE, children: [] },
    ],
  });
  const result = compile({ canonical, contextSpans: [chapeau], proposals: [qualification(disclosure), qualification(secDocuments)] });
  assert.equal(result.proposals.length, 2);
  for (const proposal of result.proposals) assert.equal(proposal.validation_status, 'VALID', issueLines(result));
  assert.notEqual(result.proposals[0].fact_occurrence_id, result.proposals[1].fact_occurrence_id);
  assert.equal(result.issues.filter((issue) => issue.code === 'DUPLICATE_FACT_OCCURRENCE').length, 0, issueLines(result));
  assert.equal(result.issues.filter((issue) => issue.code === 'INVALID_FACT_COMPONENTS').length, 0, issueLines(result));
});
