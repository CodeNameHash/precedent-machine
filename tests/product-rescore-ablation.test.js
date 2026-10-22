'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { chapeauRangesOf, compareGenerations, matchFacts, rangesOutside, scoredRanges } = require('../lib/product/generation-comparison');
const { chapeauRangesOfClosure, compareFacts } = require('../lib/product/cost-ablation');
const { dumpFacts, renderRescore, rescoreJobDir } = require('../scripts/product/re-score-ablation');

// Plan finding (199g), work package E14: the comparison matcher scored on
// the bytes outside the section's chapeau span, each live fact the
// counterpart of one stored fact at most, and the re-score of a job dir.
// The fixture is NCS 5.1's shape as read in (199f): the stored Tax
// covenant's OWN components are the chapeau words (900 bytes) and its
// limb (400 bytes); the live equity-award covenant cites the whole chapeau
// and its own limb; the live Tax fact cites a chapeau fragment and 80
// bytes of the Tax limb (the limitation-period waiver). The byte numbers
// are the shape's, not the agreement's: this session has no access to the
// job dirs; `--dump 5.1:Tax` on the sandbox prints the real rows.

const NODE = 'n'.repeat(64);
const CHAPEAU = { span_id: 'c'.repeat(64), structure_node_id: NODE, kind: 'CHAPEAU', start_byte: 1000, end_byte: 1900 };
const TAX = { span_id: 't'.repeat(64), structure_node_id: NODE, kind: 'OPERATIVE', start_byte: 3000, end_byte: 3400 };
const EQUITY = { span_id: 'e'.repeat(64), structure_node_id: NODE, kind: 'OPERATIVE', start_byte: 5000, end_byte: 5300 };
const SPANS = [CHAPEAU, TAX, EQUITY];

const component = (id, kind, start, end, text = kind.toLowerCase(), origin = 'OWN') => ({ component_id: id, kind, label: id, text, origin, start_byte: start, end_byte: end, source_span_id: 'x'.repeat(64), gap_before: false, children: [] });
const fact = (id, summary, components, extra = {}) => ({ proposal_id: id.padEnd(64, '0'), structure_node_id: NODE, family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', fact_type: 'IOC_RESTRICTION_PRESENT', validation_status: 'VALID', headline: { label: summary, summary }, statement: summary, source_span_ids: [CHAPEAU.span_id, TAX.span_id], components, ...extra });

const storedTax = fact('stored-tax', 'Tax covenant: no settlement, amended return, election, waiver or accounting change without Parent consent', [component('a1', 'ACTOR', 1000, 1900, 'the Company shall not ... without Parent consent'), component('a2', 'OPERATION', 3000, 3400, 'settle or compromise ... change any material method of accounting for Tax purposes')]);
const storedEquity = fact('stored-equity', 'Equity awards: no grant or amendment without Parent consent', [component('b1', 'ACTOR', 1000, 1900, 'the Company shall not ... without Parent consent'), component('b2', 'OPERATION', 5000, 5300, 'grant or amend any Company Equity Award')]);
const liveEquity = fact('live-equity', 'Equity awards: no grant or amendment without Parent consent', [component('c1', 'ACTOR', 1000, 1900, 'the Company shall not ... without Parent consent'), component('c2', 'OPERATION', 5000, 5300, 'grant or amend any Company Equity Award')]);
const liveWaiver = fact('live-waiver', 'Tax: no waiver of a limitation period without Parent consent', [component('d1', 'ACTOR', 1100, 1200, 'the Company shall not'), component('d2', 'OPERATION', 3300, 3380, 'consent to any extension or waiver of the limitation period')]);

test('byte helpers: the chapeau bytes come out of a fact\'s ranges when other bytes remain, and a chapeau-only fact keeps its bytes', () => {
  assert.deepEqual(rangesOutside([[1000, 1900], [3000, 3400]], [[1000, 1900]]), [[3000, 3400]]);
  assert.deepEqual(rangesOutside([[900, 2000]], [[1000, 1900]]), [[900, 1000], [1900, 2000]]);
  assert.deepEqual(rangesOutside([[1000, 1900]], [[1000, 1900]]), []);
  assert.deepEqual(scoredRanges([[1000, 1900], [3000, 3400]], [[1000, 1900]]), [[3000, 3400]]);
  assert.deepEqual(scoredRanges([[1100, 1300]], [[1000, 1900]]), [[1100, 1300]], 'a chapeau-only fact is scored on its own bytes');
  assert.deepEqual(scoredRanges([[1000, 1900], [3000, 3400]], []), [[1000, 1900], [3000, 3400]]);
  assert.deepEqual(chapeauRangesOf(SPANS, NODE), [[1000, 1900]]);
  assert.deepEqual(chapeauRangesOf(SPANS, 'other'), []);
  assert.deepEqual(chapeauRangesOfClosure({ structure_node_id: NODE, chapeau_span_ids: [CHAPEAU.span_id, 'parent'], spans: [{ span_id: CHAPEAU.span_id, structure_node_id: NODE, kind: 'CHAPEAU', start_byte: 1000, end_byte: 1900 }, { span_id: 'parent', structure_node_id: 'p', kind: 'CHAPEAU', start_byte: 10, end_byte: 90 }, TAX] }), [[1000, 1900]], 'the section\'s own chapeau span, not the parent\'s');
  assert.deepEqual(chapeauRangesOfClosure(null), []);
});

test('matchFacts: the old rule matched the Tax covenant with the equity-award covenant on the shared chapeau bytes; the rule now scores the limb and gives each live fact one stored fact', () => {
  const stored = [{ id: 'tax', ranges: [[1000, 1900], [3000, 3400]] }, { id: 'equity', ranges: [[1000, 1900], [5000, 5300]] }];
  const candidates = [{ id: 'live-equity', ranges: [[1000, 1900], [5000, 5300]] }, { id: 'live-waiver', ranges: [[1100, 1200], [3300, 3380]] }];
  const old = matchFacts({ stored, candidates, exclusive: false });
  assert.equal(old.assigned.get('tax').id, 'live-equity');
  assert.equal(Number(old.assigned.get('tax').share.toFixed(2)), 0.69, '900 of the Tax fact\'s 1,300 bytes are the chapeau the equity fact also cites');
  assert.equal(old.assigned.get('equity').id, 'live-equity');
  const now = matchFacts({ stored, candidates, chapeauRanges: [[1000, 1900]] });
  assert.deepEqual(now.scored_bytes.get('tax'), 400);
  assert.equal(now.assigned.get('tax').id, 'live-waiver');
  assert.equal(now.assigned.get('tax').share, 0.2);
  assert.deepEqual(now.shares.get('tax').map((entry) => entry.id), ['live-waiver'], 'the equity fact overlaps none of the Tax limb');
  assert.equal(now.assigned.get('equity').id, 'live-equity');
  assert.equal(now.assigned.get('equity').share, 1);
  // Exclusivity: one live fact over two stored facts' limbs goes to the better share; the other takes its next candidate or none.
  const two = matchFacts({ stored: [{ id: 's1', ranges: [[0, 100]] }, { id: 's2', ranges: [[100, 200]] }], candidates: [{ id: 'v', ranges: [[50, 200]] }, { id: 'w', ranges: [[0, 20]] }] });
  assert.equal(two.assigned.get('s2').id, 'v');
  assert.equal(two.assigned.get('s1').id, 'w');
  const one = matchFacts({ stored: [{ id: 's1', ranges: [[0, 100]] }, { id: 's2', ranges: [[100, 200]] }], candidates: [{ id: 'v', ranges: [[50, 200]] }] });
  assert.equal(one.assigned.get('s2').id, 'v');
  assert.equal(one.assigned.has('s1'), false);
  assert.deepEqual(one.shares.get('s1').map((entry) => entry.id), ['v'], 'the candidate list still names it');
});

test('compareFacts with the section\'s chapeau ranges: the Tax covenant is PARTIAL by its own limb, the equity covenant MATCHED, nothing new; without them the old reading returns', () => {
  const storedFacts = [
    { proposal_id: 'tax', family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', summary: 'Tax covenant', ranges: [[1000, 1900], [3000, 3400]] },
    { proposal_id: 'equity', family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', summary: 'Equity awards', ranges: [[1000, 1900], [5000, 5300]] },
  ];
  const variantFacts = [liveEquity, liveWaiver];
  const now = compareFacts({ storedFacts, variantFacts, chapeauRanges: [[1000, 1900]] });
  assert.deepEqual(now.counts, { stored: 2, matched: 1, partial: 1, unmatched: 0, new: 0 });
  assert.deepEqual(now.rows.map((row) => [row.proposal_id, row.status, row.share, row.scored_bytes, row.counterpart]), [['tax', 'PARTIAL', 0.2, 400, liveWaiver.proposal_id], ['equity', 'MATCHED', 1, 300, liveEquity.proposal_id]]);
  const old = compareFacts({ storedFacts, variantFacts });
  assert.deepEqual(old.rows.map((row) => [row.proposal_id, row.status]), [['tax', 'PARTIAL'], ['equity', 'MATCHED']], 'without chapeau ranges the equity fact still goes to one stored fact only');
  assert.equal(old.rows[0].counterpart, liveWaiver.proposal_id);
  assert.equal(old.rows[0].share, 0.14);
});

function analysisOf(label, proposals, spans = SPANS) {
  return { kind: 'draftAnalysis', label, run_id: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: [{ structure_node_id: NODE, section_reference: '5.1', families: ['INTERIM_OPERATING'], disposition: 'FAMILY_ASSIGNED' }], proposals, spans, issues: [], coverage_assertions: [] };
}

test('compareGenerations applies the rule: a V1 fact citing the chapeau and its limb is scored on the limb, and a V2 fact is one V1 fact\'s counterpart', () => {
  const v1 = { analysis: { ...analysisOf('stored', [
    { ...storedTax, source_span_ids: [CHAPEAU.span_id, TAX.span_id], components: undefined },
    { ...storedEquity, source_span_ids: [CHAPEAU.span_id, EQUITY.span_id], components: undefined },
  ]), agreement_structure: { nodes: [{ node_id: NODE, reference: '5.1', heading: 'Conduct of Business' }] } }, review: null };
  const v2 = { analysis: { ...analysisOf('live', [liveEquity, liveWaiver]), agreement_structure: v1.analysis.agreement_structure }, review: null };
  const comparison = compareGenerations({ v1, v2 });
  const section = comparison.sections.find((item) => item.node_id === NODE);
  const byId = Object.fromEntries(section.pairs.map((pair) => [pair.v1_id.replace(/0+$/, ''), pair]));
  assert.equal(byId['stored-tax'].status, 'PARTIAL');
  assert.equal(byId['stored-tax'].counterpart, liveWaiver.proposal_id);
  assert.equal(byId['stored-tax'].cited_bytes, 1300);
  assert.equal(byId['stored-tax'].scored_bytes, 400);
  assert.deepEqual(byId['stored-tax'].matches.map((match) => match.v2_id), [liveWaiver.proposal_id]);
  assert.equal(byId['stored-equity'].status, 'MATCHED');
  assert.equal(byId['stored-equity'].counterpart, liveEquity.proposal_id);
});

test('the re-score script reads a job dir\'s analysis files and prints the rows the rule changes beside the recorded ones; --dump prints the fixture rows', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ablation-rescore-'));
  fs.mkdirSync(path.join(dir, 'analysis'));
  fs.writeFileSync(path.join(dir, 'analysis', 'stored.analysis.json'), JSON.stringify({ analysis: analysisOf('stored', [storedTax, storedEquity]) }));
  fs.writeFileSync(path.join(dir, 'analysis', 'default_sonnet55.analysis.json'), JSON.stringify({ analysis: analysisOf('default_sonnet55', [liveEquity, liveWaiver]) }));
  fs.writeFileSync(path.join(dir, 'ablation.json'), JSON.stringify([{ variant: 'default_sonnet55', sections: [{ section_reference: '5.1', comparison: { counts: { stored: 2, matched: 2, partial: 0, unmatched: 0, new: 1 } } }] }]));
  const result = rescoreJobDir(dir);
  assert.equal(result.variants.length, 1);
  const [section] = result.variants[0].sections;
  assert.equal(section.section_reference, '5.1');
  assert.equal(section.chapeau_bytes, 900);
  assert.deepEqual(section.recorded, { stored: 2, matched: 2, partial: 0, unmatched: 0, new: 1 });
  assert.deepEqual(section.old, { stored: 2, matched: 2, partial: 0, unmatched: 0, new: 1 }, 'the old rule re-computed agrees with the recorded row');
  assert.deepEqual(section.new, { stored: 2, matched: 1, partial: 1, unmatched: 0, new: 0 });
  assert.equal(section.changes.length, 1);
  assert.equal(section.changes[0].old_status, 'MATCHED');
  assert.match(section.changes[0].old_counterpart, /^Equity awards/);
  assert.equal(section.changes[0].new_status, 'PARTIAL');
  assert.match(section.changes[0].new_counterpart, /^Tax: no waiver/);
  assert.equal(section.changes[0].scored_bytes, 400);
  const table = renderRescore([result]);
  assert.match(table, /\| default_sonnet55 \| 5\.1 \| 2 \/ 0 \/ 0 of 2, new 1 \| 2 \/ 0 \/ 0 of 2, new 1 \| 1 \/ 1 \/ 0 of 2, new 0 \| Tax covenant[^|]*MATCHED 0\.69 \(Equity awards[^|]*-> PARTIAL 0\.2 \(Tax: no waiver/);
  const dump = dumpFacts(dir, '5.1', 'tax covenant');
  assert.equal(dump.stored.length, 1);
  assert.deepEqual(dump.stored[0].components.map((row) => [row.kind, row.origin, row.start_byte, row.end_byte]), [['ACTOR', 'OWN', 1000, 1900], ['OPERATION', 'OWN', 3000, 3400]]);
  assert.deepEqual(dump.chapeau_spans.map((span) => [span.start_byte, span.end_byte]), [[1000, 1900]]);
  assert.deepEqual(dump.variants.default_sonnet55.map((row) => row.summary).sort(), [liveEquity.headline.summary, liveWaiver.headline.summary].sort(), 'every live fact that overlaps the stored one under the old rule');
  fs.rmSync(dir, { recursive: true, force: true });
});
