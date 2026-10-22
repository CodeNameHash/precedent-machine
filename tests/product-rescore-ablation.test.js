'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { chapeauRangesOf, compareGenerations, matchFacts, rangesOutside, scoredRanges } = require('../lib/product/generation-comparison');
const { chapeauRangesOfClosure, compareFacts, componentTree, renderAblationTable, storedFactsForNode } = require('../lib/product/cost-ablation');
const { driftOf, dumpFacts, renderRescore, rescoreJobDir } = require('../scripts/product/re-score-ablation');

// Plan findings (199g) and (199h), work packages E14 and E15: the
// comparison matcher scored on the bytes outside the section's chapeau
// span, every stored fact its best live cover, a shared counterpart
// BUNDLED, and the re-score of a job dir whose baseline is the recorded
// row. Shapes from the readings: NCS 5.1's Tax covenant (the stored fact's
// OWN components the chapeau words, 900 bytes, and its limb, 400; the live
// equity-award covenant citing the whole chapeau and its own limb; the
// live Tax fact a chapeau fragment and 80 bytes of the Tax limb); 5.1's
// five affirmative covenants of limb (a)'s lead, stored as five facts and
// written live as one; 3.7, five stored facts under one live fact. The
// byte numbers are the shapes', not the agreement's.

const NODE = 'n'.repeat(64);
const CHAPEAU = { span_id: 'c'.repeat(64), structure_node_id: NODE, kind: 'CHAPEAU', start_byte: 1000, end_byte: 1900 };
const TAX = { span_id: 't'.repeat(64), structure_node_id: NODE, kind: 'OPERATIVE', start_byte: 3000, end_byte: 3400 };
const EQUITY = { span_id: 'e'.repeat(64), structure_node_id: NODE, kind: 'OPERATIVE', start_byte: 5000, end_byte: 5300 };
const LEAD = { span_id: 'l'.repeat(64), structure_node_id: NODE, kind: 'OPERATIVE', start_byte: 2000, end_byte: 2500 };
const SPANS = [CHAPEAU, LEAD, TAX, EQUITY];

const component = (id, kind, start, end, text = kind.toLowerCase(), origin = 'OWN', children = []) => ({ component_id: id, kind, label: id, text, origin, start_byte: start, end_byte: end, source_span_id: 'x'.repeat(64), gap_before: false, children });
const fact = (id, summary, components, extra = {}) => ({ proposal_id: id.padEnd(64, '0'), structure_node_id: NODE, family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', fact_type: 'IOC_RESTRICTION_PRESENT', validation_status: 'VALID', headline: { label: summary, summary }, statement: summary, source_span_ids: [CHAPEAU.span_id, TAX.span_id], components, ...extra });

const storedTax = fact('stored-tax', 'Tax covenant: no settlement, amended return, election, waiver or accounting change without Parent consent', [component('a1', 'ACTOR', 1000, 1900, 'the Company shall not ... without Parent consent'), component('a2', 'OPERATION', 3000, 3400, 'settle or compromise ... change any material method of accounting for Tax purposes')]);
const storedEquity = fact('stored-equity', 'Equity awards: no grant or amendment without Parent consent', [component('b1', 'ACTOR', 1000, 1900, 'the Company shall not ... without Parent consent'), component('b2', 'OPERATION', 5000, 5300, 'grant or amend any Company Equity Award')]);
const liveEquity = fact('live-equity', 'Equity awards: no grant or amendment without Parent consent', [component('c1', 'ACTOR', 1000, 1900, 'the Company shall not ... without Parent consent'), component('c2', 'OPERATION', 5000, 5300, 'grant or amend any Company Equity Award')]);
const liveWaiver = fact('live-waiver', 'Tax: no waiver of a limitation period without Parent consent', [component('d1', 'ACTOR', 1100, 1200, 'the Company shall not'), component('d2', 'OPERATION', 3300, 3380, 'consent to any extension or waiver of the limitation period')]);
// Limb (a)'s lead: five affirmative covenants stored as five facts of 100 bytes each, written live as one fact over the sentence.
const COVENANTS = ['ordinary course', 'preserve organisation', 'assets in good repair', 'officers and consultants', 'goodwill'];
const storedCovenants = COVENANTS.map((name, index) => fact(`stored-cov-${index + 1}`, `Affirmative covenant: ${name}`, [component(`f${index + 1}`, 'OPERATION', 2000 + index * 100, 2100 + index * 100, name)], { subtype_key: 'AFFIRMATIVE_COVENANT' }));
const liveLead = fact('live-lead', 'Affirmative covenants of the lead sentence', [component('g1', 'OPERATION', 2000, 2500, 'conduct its business in the ordinary course ... preserve its goodwill')], { subtype_key: 'AFFIRMATIVE_COVENANT' });

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

test('matchFacts: the chapeau exclusion takes the equity-award covenant off the Tax covenant; every stored fact keeps its best cover; a counterpart shared by several stored facts flags them BUNDLED', () => {
  const stored = [{ id: 'tax', ranges: [[1000, 1900], [3000, 3400]] }, { id: 'equity', ranges: [[1000, 1900], [5000, 5300]] }];
  const candidates = [{ id: 'live-equity', ranges: [[1000, 1900], [5000, 5300]] }, { id: 'live-waiver', ranges: [[1100, 1200], [3300, 3380]] }];
  const old = matchFacts({ stored, candidates });
  assert.equal(old.assigned.get('tax').id, 'live-equity');
  assert.equal(Number(old.assigned.get('tax').share.toFixed(2)), 0.69, '900 of the Tax fact\'s 1,300 bytes are the chapeau the equity fact also cites');
  assert.equal(old.assigned.get('equity').id, 'live-equity');
  assert.deepEqual([...old.bundled].sort(), ['equity', 'tax'], 'the old rule\'s false match was a bundle');
  const now = matchFacts({ stored, candidates, chapeauRanges: [[1000, 1900]] });
  assert.deepEqual(now.scored_bytes.get('tax'), 400);
  assert.equal(now.assigned.get('tax').id, 'live-waiver');
  assert.equal(now.assigned.get('tax').share, 0.2);
  assert.deepEqual(now.shares.get('tax').map((entry) => entry.id), ['live-waiver'], 'the equity fact overlaps none of the Tax limb');
  assert.equal(now.assigned.get('equity').id, 'live-equity');
  assert.equal(now.assigned.get('equity').share, 1);
  assert.equal(now.bundled.size, 0);
  // 3.7's shape: five stored facts under one live fact: all matched, all bundled.
  const five = matchFacts({ stored: COVENANTS.map((_, index) => ({ id: `s${index}`, ranges: [[2000 + index * 100, 2100 + index * 100]] })), candidates: [{ id: 'lead', ranges: [[2000, 2500]] }] });
  assert.ok(COVENANTS.every((_, index) => five.assigned.get(`s${index}`).id === 'lead' && five.assigned.get(`s${index}`).share === 1));
  assert.equal(five.bundled.size, 5);
  // A tie on the share goes to the stored fact that covers more of the live fact's own bytes; the other keeps the live fact too, bundled.
  const tie = matchFacts({ stored: [{ id: 'small', ranges: [[100, 150]] }, { id: 'large', ranges: [[200, 500]] }], candidates: [{ id: 'wide', ranges: [[100, 500]] }, { id: 'narrow', ranges: [[100, 150]] }] });
  assert.equal(tie.assigned.get('large').id, 'wide');
  assert.equal(tie.assigned.get('small').id, 'narrow', 'both cover the small fact whole; the narrow one is covered whole by it');
  assert.equal(tie.shares.get('small')[0].reverse_share, 1);
  assert.equal(tie.bundled.size, 0);
});

test('compareFacts: 5.1\'s Tax covenant PARTIAL by its limb and the equity covenant MATCHED; limb (a)\'s five affirmative covenants under one live fact MATCHED and BUNDLED, counted; the table shows the bundled count', () => {
  const storedFacts = [
    { proposal_id: 'tax', family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', summary: 'Tax covenant', ranges: [[1000, 1900], [3000, 3400]] },
    { proposal_id: 'equity', family_key: 'INTERIM_OPERATING', subtype_key: 'RESTRICTIVE_COVENANT', summary: 'Equity awards', ranges: [[1000, 1900], [5000, 5300]] },
    ...COVENANTS.map((name, index) => ({ proposal_id: `cov-${index + 1}`, family_key: 'INTERIM_OPERATING', subtype_key: 'AFFIRMATIVE_COVENANT', summary: name, ranges: [[2000 + index * 100, 2100 + index * 100]] })),
  ];
  const variantFacts = [liveEquity, liveWaiver, liveLead];
  const now = compareFacts({ storedFacts, variantFacts, chapeauRanges: [[1000, 1900]] });
  assert.deepEqual(now.counts, { stored: 7, matched: 6, partial: 1, unmatched: 0, bundled: 5, new: 0 });
  assert.deepEqual(now.rows.slice(0, 2).map((row) => [row.proposal_id, row.status, row.bundled, row.share, row.scored_bytes, row.counterpart]), [['tax', 'PARTIAL', false, 0.2, 400, liveWaiver.proposal_id], ['equity', 'MATCHED', false, 1, 300, liveEquity.proposal_id]]);
  assert.ok(now.rows.slice(2).every((row) => row.status === 'MATCHED' && row.bundled === true && row.counterpart === liveLead.proposal_id));
  // Without the chapeau ranges: the old reading, the equity fact covering the Tax covenant too, both flagged bundled.
  const old = compareFacts({ storedFacts, variantFacts });
  assert.deepEqual(old.counts, { stored: 7, matched: 7, partial: 0, unmatched: 0, bundled: 7, new: 1 }, 'the waiver fact is no stored fact\'s best cover under the old rule, so it reads as new');
  assert.equal(old.rows[0].counterpart, liveEquity.proposal_id);
  assert.equal(old.rows[0].bundled, true);
  // The table's matched column carries the bundled count on the row and the totals.
  const ablation = { variant: 'default_sonnet55', sections: [{ section_reference: '5.1', facts: { valid: 3, held: 0 }, stored_facts: { valid: 7, held: 0 }, comparison: now, issue_codes: {}, routing_families: [], stored_routing_families: [], replay_drifts: [], fact_evidence: true, extraction: { calls: 1, fresh_input_tokens: 1, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 1, duration_ms: 1000, cost_microusd: 0, model_ids: [], live_calls: 1, routing_live_calls: 0, fallbacks: [], list_price_written_usd: 0, list_price_read_usd: 0 }, stored_extraction: { calls: 1, fresh_input_tokens: 1, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 1, duration_ms: 1000, cost_microusd: 0, model_ids: [], repriced_opus_5_5_usd: null, list_price_written_usd: 0, list_price_read_usd: 0 } }] };
  const table = renderAblationTable([ablation]);
  assert.match(table, /\| default_sonnet55 \| 5\.1 \| 3 \(0\) \| 6 \/ 1 \/ 0 of 7 \(5 bundled\) \| 0 \|/);
  assert.match(table, /\| default_sonnet55 \| all 1 sections \| 3 \(0\) \| 6 \/ 1 \/ 0 of 7 \(5 bundled\) \| 0 \|/);
});

function analysisOf(label, proposals, spans = SPANS) {
  return { kind: 'draftAnalysis', label, run_id: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: [{ structure_node_id: NODE, section_reference: '5.1', families: ['INTERIM_OPERATING'], disposition: 'FAMILY_ASSIGNED' }], proposals, spans, issues: [], coverage_assertions: [] };
}

test('compareGenerations applies the rule: a V1 fact citing the chapeau and its limb is scored on the limb, and a shared V2 counterpart is bundled in the pair and the totals', () => {
  const v1 = { analysis: { ...analysisOf('stored', [
    { ...storedTax, source_span_ids: [CHAPEAU.span_id, TAX.span_id], components: undefined },
    { ...storedEquity, source_span_ids: [CHAPEAU.span_id, EQUITY.span_id], components: undefined },
    ...storedCovenants.map((item, index) => ({ ...item, source_span_ids: [`cov${index}`.padEnd(64, 'x')], components: undefined })),
  ], [...SPANS, ...COVENANTS.map((_, index) => ({ span_id: `cov${index}`.padEnd(64, 'x'), structure_node_id: NODE, kind: 'OPERATIVE', start_byte: 2000 + index * 100, end_byte: 2100 + index * 100 }))]), agreement_structure: { nodes: [{ node_id: NODE, reference: '5.1', heading: 'Conduct of Business' }] } }, review: null };
  const v2 = { analysis: { ...analysisOf('live', [liveEquity, liveWaiver, liveLead]), agreement_structure: v1.analysis.agreement_structure }, review: null };
  const comparison = compareGenerations({ v1, v2 });
  const section = comparison.sections.find((item) => item.node_id === NODE);
  const byId = Object.fromEntries(section.pairs.map((pair) => [pair.v1_id.replace(/0+$/, ''), pair]));
  assert.equal(byId['stored-tax'].status, 'PARTIAL');
  assert.equal(byId['stored-tax'].counterpart, liveWaiver.proposal_id);
  assert.equal(byId['stored-tax'].cited_bytes, 1300);
  assert.equal(byId['stored-tax'].scored_bytes, 400);
  assert.equal(byId['stored-tax'].bundled, false);
  assert.equal(byId['stored-equity'].status, 'MATCHED');
  assert.ok(COVENANTS.every((_, index) => byId[`stored-cov-${index + 1}`].status === 'MATCHED' && byId[`stored-cov-${index + 1}`].bundled === true));
  assert.equal(comparison.totals.v1_matched, 6);
  assert.equal(comparison.totals.v1_bundled, 5);
  assert.equal(comparison.totals.v1_partial, 1);
});

// A job dir as the launcher leaves it: the snapshot (the stored tables),
// the analysis files and the recorded rows.
function flatRows(facts) {
  const rows = [];
  const walk = (proposalId, components, parentId) => {
    (components || []).forEach((item, ordinal) => {
      rows.push({ proposal_id: proposalId, component_id: item.component_id, parent_component_id: parentId, ordinal, kind: item.kind, label: item.label, text: item.text, source_span_id: item.source_span_id, start_byte: item.start_byte, end_byte: item.end_byte, origin: item.origin });
      walk(proposalId, item.children, item.component_id);
    });
  };
  for (const item of facts) walk(item.proposal_id, item.components, null);
  return rows;
}
function jobDir({ storedFacts, liveFacts, recordedCounts, withSnapshot = true, storedAnalysisFacts = storedFacts }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ablation-rescore-'));
  fs.mkdirSync(path.join(dir, 'analysis'));
  fs.writeFileSync(path.join(dir, 'analysis', 'stored.analysis.json'), JSON.stringify({ analysis: analysisOf('stored', storedAnalysisFacts) }));
  fs.writeFileSync(path.join(dir, 'analysis', 'default_sonnet55.analysis.json'), JSON.stringify({ analysis: analysisOf('default_sonnet55', liveFacts) }));
  fs.writeFileSync(path.join(dir, 'ablation.json'), JSON.stringify([{ variant: 'default_sonnet55', sections: [{ section_reference: '5.1', comparison: { counts: recordedCounts } }] }]));
  if (withSnapshot) {
    fs.writeFileSync(path.join(dir, 'ablation-rows.json'), JSON.stringify({ run_id: 'r', tables: {
      product_proposals: storedFacts.map((item) => ({ proposal_id: item.proposal_id, structure_node_id: NODE, family_key: item.family_key, subtype_key: item.subtype_key, validation_status: item.validation_status, payload: {} })),
      product_fact_components: flatRows(storedFacts),
      product_fact_headlines: storedFacts.map((item) => ({ proposal_id: item.proposal_id, label: item.headline.label, summary: item.headline.summary })),
      product_source_closures: [{ structure_node_id: NODE, section_reference: '5.1', payload: { structure_node_id: NODE, section_reference: '5.1', chapeau_span_ids: [CHAPEAU.span_id], operative_span_ids: [LEAD.span_id, TAX.span_id, EQUITY.span_id], full_section_span_id: 'f', spans: SPANS } }],
    } }));
  }
  return dir;
}

test('the re-score script: the baseline is the recorded row rebuilt from the snapshot and the live comparison\'s own derivation; the new column and the bundled rows; a stored tree with nested elements reads whole; --dump prints the fixture rows', () => {
  // A stored fact whose words sit under a nested LIST (children two levels down): the snapshot rows carry them; the first analysis export did not.
  const storedList = fact('stored-list', 'Tax covenant as a list', [component('h1', 'OPERATION', 3000, 3010, 'shall not', 'OWN', [component('h2', 'LIST', 3010, 3400, 'settle; file; make; consent; change', 'OWN', [component('h3', 'LIST_ELEMENT', 3010, 3100, 'settle'), component('h4', 'LIST_ELEMENT', 3100, 3400, 'file ... change')])])]);
  const recorded = compareFacts({ storedFacts: storedFactsForNode({ product_proposals: [storedTax, storedEquity, ...storedCovenants].map((item) => ({ proposal_id: item.proposal_id, structure_node_id: NODE, family_key: item.family_key, subtype_key: item.subtype_key, validation_status: 'VALID', payload: {} })), product_fact_components: flatRows([storedTax, storedEquity, ...storedCovenants]), product_fact_headlines: [] }, NODE).storedFacts, variantFacts: [liveEquity, liveWaiver, liveLead] }).counts;
  const dir = jobDir({ storedFacts: [storedTax, storedEquity, ...storedCovenants], liveFacts: [liveEquity, liveWaiver, liveLead], recordedCounts: recorded });
  const result = rescoreJobDir(dir);
  assert.equal(result.snapshot, true);
  const [section] = result.variants[0].sections;
  assert.equal(section.stored_source, 'ablation-rows.json');
  assert.equal(section.chapeau_bytes, 900);
  assert.deepEqual(section.baseline, recorded);
  assert.equal(section.baseline_reproduces_recorded, true);
  assert.deepEqual(section.new, { stored: 7, matched: 6, partial: 1, unmatched: 0, bundled: 5, new: 0 });
  assert.equal(section.changes.length, 2, 'the Tax covenant changes counterpart; the equity covenant loses its bundled flag; the five covenants stay matched and bundled');
  const tax = section.changes.find((change) => change.proposal_id === storedTax.proposal_id);
  assert.equal(tax.old_status, 'MATCHED');
  assert.equal(tax.old_bundled, true);
  assert.match(tax.old_counterpart, /^Equity awards/);
  assert.equal(tax.new_status, 'PARTIAL');
  assert.match(tax.new_counterpart, /^Tax: no waiver/);
  assert.equal(section.bundled_rows.length, 5);
  const table = renderRescore([result]);
  assert.match(table, /\| default_sonnet55 \| 5\.1 \| 7 \/ 0 \/ 0 of 7 \(7 bundled\), new 1 \| 7 \/ 0 \/ 0 of 7 \(7 bundled\), new 1 \| 6 \/ 1 \/ 0 of 7 \(5 bundled\), new 0 \| /);
  assert.doesNotMatch(table, /NOT REPRODUCED/);
  // The analysis-file derivation the earlier re-score used: a stored fact without OWN byte components took its cited spans whole; the drift names it.
  const spanOnly = { ...fact('stored-span-only', 'A fact with no byte components', []), source_span_ids: [LEAD.span_id] };
  const drift = driftOf({ storedAnalysis: analysisOf('stored', [storedTax, spanOnly]), liveAnalysis: analysisOf('live', [liveEquity, { ...fact('live-span-only', 'Live fact without bytes', []), source_span_ids: [TAX.span_id] }]), nodeId: NODE, storedFacts: storedFactsForNode({ product_proposals: [{ proposal_id: storedTax.proposal_id, structure_node_id: NODE, validation_status: 'VALID', payload: {} }], product_fact_components: flatRows([storedTax]), product_fact_headlines: [] }, NODE).storedFacts });
  assert.deepEqual(drift.stored_fallback.map((item) => [item.summary, item.span_bytes]), [['A fact with no byte components', 500]]);
  assert.deepEqual(drift.live_fallback.map((item) => [item.summary, item.span_bytes]), [['Live fact without bytes', 400]]);
  // A nested stored tree: componentTree carries every depth, and the snapshot derivation reads the elements' bytes.
  const tree = componentTree(flatRows([storedList]));
  assert.equal(tree[0].children[0].children.length, 2);
  const nested = storedFactsForNode({ product_proposals: [{ proposal_id: storedList.proposal_id, structure_node_id: NODE, validation_status: 'VALID', payload: {} }], product_fact_components: flatRows([storedList]), product_fact_headlines: [] }, NODE);
  assert.deepEqual(nested.storedFacts[0].ranges, [[3000, 3010], [3010, 3400], [3010, 3100], [3100, 3400]]);
  // Without the snapshot the stored side comes from the analysis file, strictly.
  const bare = jobDir({ storedFacts: [storedTax, storedEquity], liveFacts: [liveEquity, liveWaiver], recordedCounts: { stored: 2, matched: 2, partial: 0, unmatched: 0, bundled: 2, new: 1 }, withSnapshot: false });
  const bareResult = rescoreJobDir(bare);
  assert.equal(bareResult.snapshot, false);
  assert.equal(bareResult.variants[0].sections[0].stored_source, 'stored.analysis.json');
  assert.equal(bareResult.variants[0].sections[0].baseline_reproduces_recorded, true);
  assert.deepEqual(bareResult.variants[0].sections[0].new, { stored: 2, matched: 1, partial: 1, unmatched: 0, bundled: 0, new: 0 });
  // A recorded row the baseline cannot reproduce is said so.
  const off = jobDir({ storedFacts: [storedTax, storedEquity], liveFacts: [liveEquity, liveWaiver], recordedCounts: { stored: 2, matched: 1, partial: 0, unmatched: 1, new: 1 } });
  assert.match(renderRescore([rescoreJobDir(off)]), /NOT REPRODUCED/);
  // --dump: the stored facts matching the words, their component rows, the chapeau spans, and the live facts that overlap them.
  const dump = dumpFacts(dir, '5.1', 'tax covenant');
  assert.equal(dump.stored.length, 1);
  assert.deepEqual(dump.stored[0].components.map((row) => [row.kind, row.origin, row.start_byte, row.end_byte]), [['ACTOR', 'OWN', 1000, 1900], ['OPERATION', 'OWN', 3000, 3400]]);
  assert.deepEqual(dump.chapeau_spans.map((span) => [span.start_byte, span.end_byte]), [[1000, 1900]]);
  assert.deepEqual(dump.variants.default_sonnet55.map((row) => row.summary).sort(), [liveEquity.headline.summary, liveWaiver.headline.summary].sort());
  for (const folder of [dir, bare, off]) fs.rmSync(folder, { recursive: true, force: true });
});
