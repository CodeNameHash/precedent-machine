'use strict';

// Work package 18 (e) (plan finding (123); Metsera generation 8's Exhibit-B,
// the Form CVR Agreement; 2026-10-18): a reference inside an exhibit
// resolves within the exhibit's own text first and reaches the main
// agreement only when the exhibit does not hold the number, so the exhibit
// is extracted like any section. The source is the Metsera filing as
// fetched (tests/fixtures/canonical-v2/metsera-first-live-run).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { buildSourceClosure } = require('../lib/product/source-context');

const ROOT = path.resolve(__dirname, '..');
const METSERA_URL = 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm';

async function metseraSource() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm'));
  const fetchImpl = async () => ({
    status: 200,
    url: METSERA_URL,
    headers: new Headers({ 'content-type': 'text/html', 'content-length': String(raw.length) }),
    body: null,
    arrayBuffer: async () => raw,
  });
  return createSecIntakeAdapter({ fetchImpl, clock: () => new Date('2026-10-18T12:00:00Z') }).intake({ url: METSERA_URL });
}

test('the CVR Agreement exhibit resolves its own section references within itself, reaches the merger agreement only for numbers it does not hold, and its closure is complete', async () => {
  const sourceDocument = await metseraSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const exhibit = agreementStructure.nodes.find((node) => node.reference === 'Exhibit-B');
  assert.ok(exhibit, 'the filing carries Exhibit B, the Form of CVR Agreement');
  assert.equal(agreementStructure.nodes.some((node) => node.parent_id === exhibit.node_id), false, 'the exhibit\'s sections have no node of their own');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: exhibit.node_id });
  const diagnostics = closure.context_diagnostics;
  assert.deepEqual(diagnostics.unresolved_section_references, [], 'nothing the exhibit says of itself is unresolved');
  assert.equal(diagnostics.traversal_complete, true);
  // The exhibit's own numbering: the generation 8 closure recorded the
  // first six as unresolved and resolved the rest into the merger agreement.
  for (const reference of ['2.4', '2.4(a)', '2.4(e)', '2.4(i)', '2.6', '5.3', '2.2', '3.2', '4.2', '5.1', '6.12', '6.5']) {
    assert.ok(diagnostics.exhibit_internal_section_references.includes(reference), `${reference} is the exhibit's own`);
  }
  // "Section 2.01(b) of the Merger Agreement" and "Section 2.03" are
  // written as the merger agreement numbers them; the exhibit has 2.1 and
  // 2.3, not 2.01 and 2.03, so they still reach the main agreement.
  const crossScope = diagnostics.cross_scope_section_references.map((entry) => entry.reference);
  assert.ok(crossScope.includes('2.01(b)') && crossScope.includes('2.03'), crossScope.join(','));
  assert.ok(crossScope.every((reference) => /^2\.0[13]/.test(reference)), `only the merger agreement's own numbers cross: ${crossScope.join(',')}`);
  assert.ok(diagnostics.cross_scope_section_references.every((entry) => entry.from_scope === 'Exhibit-B' && entry.to_scope === 'MAIN_AGREEMENT'));
  // An internal reference is a cross-reference to the exhibit's own words.
  const exhibitSpan = closure.spans.find((span) => span.kind === 'CROSS_REFERENCE' && span.structure_node_id === exhibit.node_id);
  assert.ok(exhibitSpan, 'the exhibit cites itself as the cross-reference span');
  // The extraction gate agreement-draft applies: complete and nothing unresolved.
  assert.equal(!diagnostics.traversal_complete || diagnostics.unresolved_section_references.length > 0, false, 'the exhibit is extracted like any section');
  // A section of the main agreement resolves as before: no internal list,
  // its cross-references into other sections of the agreement.
  const section = agreementStructure.nodes.find((node) => node.reference === '6.03' || node.reference === '6.3');
  assert.ok(section, 'the merger agreement\'s 6.03');
  const sectionClosure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: section.node_id });
  assert.equal('exhibit_internal_section_references' in sectionClosure.context_diagnostics, false);
  assert.ok(sectionClosure.cross_reference_span_ids.length > 0, 'a main-agreement section still reaches the sections it names');
  assert.equal(sectionClosure.context_diagnostics.cross_scope_section_references.length, 0);
});
