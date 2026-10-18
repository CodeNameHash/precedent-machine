'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CAUSES, VERDICTS, analyseUnresolvedFactTypes, compareDraftIssues, parseModelAnswer } = require('../lib/product/unresolved-fact-types');
const { writeRunSnapshot } = require('../lib/product/run-rows');
const { main, parseArguments } = require('../scripts/product/unresolved-fact-types');

const RUN = '72d94dd2-cb59-49cf-8f46-c89d161b7769';
const OTHER = '8c53fb92-06c9-40f1-b6b3-f9da5cdf7b3d';
const EXHIBIT = 'node-exhibit-b';
const S302 = 'node-3-02';
const S701 = 'node-7-01';

function assertion(nodeId, familyKey, factType, modelCallId = 'call-1') {
  return { run_id: RUN, coverage_assertion_id: `${nodeId}:${factType}`, subject_kind: 'FACT_TYPE', subject_id: `${nodeId}:${familyKey}:${factType}`, family_key: familyKey, structure_node_id: nodeId, model_call_id: modelCallId, state: 'UNRESOLVED', payload: { reason: `FACT_TYPE:${factType}` } };
}

function issue(nodeId, code, message, extra = {}) {
  return { run_id: RUN, issue_id: `${nodeId || 'draft'}:${code}:${message}`, kind: 'COVERAGE', state: 'OPEN', family_key: extra.family_key || null, structure_node_id: nodeId, proposal_id: extra.proposal_id || null, payload: { code, message, family_key: extra.family_key || null } };
}

function proposal(nodeId, id, familyKey, factType, status = 'VALID') {
  return { run_id: RUN, proposal_id: id, structure_node_id: nodeId, family_key: familyKey, fact_type: factType, validation_status: status };
}

function metseraLikeRun() {
  return {
    run_id: RUN,
    tables: {
      product_analysis_runs: [{ run_id: RUN, source_generation: 8, retrieval_url: 'https://www.sec.gov/x/d921605dex21.htm' }],
      product_source_closures: [
        { run_id: RUN, structure_node_id: EXHIBIT, section_reference: 'Exhibit-B' },
        { run_id: RUN, structure_node_id: S302, section_reference: '3.02' },
        { run_id: RUN, structure_node_id: S701, section_reference: '7.01' },
      ],
      product_section_routings: [{ run_id: RUN, structure_node_id: EXHIBIT, families: ['CAPITALISATION', 'TERMINATION'], payload: { rationale: 'Form CVR Agreement' } }],
      product_coverage_assertions: [
        assertion(EXHIBIT, 'CAPITALISATION', 'CAPITALISATION_AUTHORISED_CAPITAL', 'routing-call'),
        assertion(EXHIBIT, 'TERMINATION', 'TERMINATION_RIGHT', 'routing-call'),
        assertion(S302, 'CAPITALISATION', 'CAPITALISATION_VALID_ISSUANCE_STATUS'),
        assertion(S701, 'TERMINATION', 'OUTSIDE_DATE', 'call-701'),
        assertion(S701, 'TERMINATION', 'CURE_OR_NOTICE_PERIOD', 'call-701'),
      ],
      product_issues: [
        issue(null, 'REQUIRED_FACT_TYPE_UNRESOLVED', 'CAPITALISATION_AUTHORISED_CAPITAL', { family_key: 'CAPITALISATION' }),
        issue(null, 'REQUIRED_FACT_TYPE_UNRESOLVED', 'TERMINATION_RIGHT', { family_key: 'TERMINATION' }),
        issue(null, 'REQUIRED_FACT_TYPE_UNRESOLVED', 'CAPITALISATION_VALID_ISSUANCE_STATUS', { family_key: 'CAPITALISATION' }),
        issue(null, 'REQUIRED_FACT_TYPE_UNRESOLVED', 'OUTSIDE_DATE', { family_key: 'TERMINATION' }),
        issue(null, 'REQUIRED_FACT_TYPE_UNRESOLVED', 'CURE_OR_NOTICE_PERIOD', { family_key: 'TERMINATION' }),
        issue(EXHIBIT, 'SOURCE_CLOSURE_INCOMPLETE', JSON.stringify({ unresolved_section_references: ['2.4', '5.3'], cross_scope_section_references: [{ reference: '2.2', from_scope: 'Exhibit-B', to_scope: 'MAIN_AGREEMENT', target_node_id: 'x' }] })),
        issue(EXHIBIT, 'UNRESOLVED_UNUSUAL_PROVISION', 'Binding $1.5bn minimum development spend commitment'),
        issue(S302, 'INVALID_FACT_COMPONENTS', 'held', { family_key: 'CAPITALISATION', proposal_id: 'held-1' }),
      ],
      product_proposals: [
        proposal(S302, 'held-1', 'CAPITALISATION', 'CAPITALISATION_VALID_ISSUANCE_STATUS', 'INVALID'),
        proposal(S302, 'ok-1', 'CAPITALISATION', 'CAPITALISATION_AUTHORISED_CAPITAL'),
        proposal(S701, 'ok-2', 'TERMINATION', 'TERMINATION_RIGHT'),
        proposal(S701, 'ok-3', 'TERMINATION', 'TERMINATION_RIGHT'),
        proposal(S701, 'ok-4', 'TERMINATION', 'CURE_OR_NOTICE_PERIOD'),
      ],
      product_model_calls: [
        { run_id: RUN, model_call_id: 'call-701', structure_node_id: S701, call_kind: 'EXTRACTION', response: { content: [{ type: 'text', text: 'Here is the answer:\n{"proposals":[],"coverage":{"TERMINATION":"FOUND"},"fact_type_coverage":{"TERMINATION":{"OUTSIDE_DATE":"FOUND","CURE_OR_NOTICE_PERIOD":"NOT_FOUND","TERMINATION_RIGHT":"FOUND"}}}' }] } },
      ],
    },
  };
}

test('parseModelAnswer reads the JSON object out of the stored answer text, with words around it', () => {
  const call = metseraLikeRun().tables.product_model_calls[0];
  assert.equal(parseModelAnswer(call).fact_type_coverage.TERMINATION.OUTSIDE_DATE, 'FOUND');
  assert.equal(parseModelAnswer({ response: { content: [{ text: 'no json here' }] } }), null);
  assert.equal(parseModelAnswer({ response: {} }), null);
});

test('analyseUnresolvedFactTypes: a never-extracted section, a held fact and the model\'s answers against its facts, each with its verdict', () => {
  const run = metseraLikeRun();
  const references = new Map(run.tables.product_source_closures.map((row) => [row.structure_node_id, row.section_reference]));
  const analysis = analyseUnresolvedFactTypes(run, { sectionReferences: references });
  assert.equal(analysis.summary.draft_issues, 5);
  assert.equal(analysis.summary.fact_types_unresolved, 5);
  const by = Object.fromEntries(analysis.fact_types.map((entry) => [entry.fact_type, entry]));

  assert.equal(by.CAPITALISATION_AUTHORISED_CAPITAL.sections[0].cause, CAUSES.SECTION_NOT_EXTRACTED);
  assert.equal(by.CAPITALISATION_AUTHORISED_CAPITAL.sections[0].section_reference, 'Exhibit-B');
  assert.deepEqual(by.CAPITALISATION_AUTHORISED_CAPITAL.sections[0].detail.unresolved_references, ['2.4', '5.3']);
  assert.deepEqual(by.CAPITALISATION_AUTHORISED_CAPITAL.valid_elsewhere, [{ section_reference: '3.02', count: 1 }]);
  assert.equal(by.CAPITALISATION_AUTHORISED_CAPITAL.verdict, VERDICTS.SECTION_GAP);
  assert.equal(by.TERMINATION_RIGHT.verdict, VERDICTS.SECTION_GAP);
  assert.deepEqual(by.TERMINATION_RIGHT.valid_elsewhere, [{ section_reference: '7.01', count: 2 }]);

  assert.equal(by.CAPITALISATION_VALID_ISSUANCE_STATUS.sections[0].cause, CAUSES.HELD_PROPOSAL);
  assert.deepEqual(by.CAPITALISATION_VALID_ISSUANCE_STATUS.sections[0].detail, { held: 1, valid: 0, hold_codes: ['INVALID_FACT_COMPONENTS'] });
  assert.equal(by.CAPITALISATION_VALID_ISSUANCE_STATUS.verdict, VERDICTS.BOOKKEEPING_HELD);

  assert.equal(by.OUTSIDE_DATE.sections[0].cause, CAUSES.MODEL_SAID_FOUND_NO_FACT);
  assert.equal(by.OUTSIDE_DATE.verdict, VERDICTS.EXTRACTION_GAP, 'FOUND with nothing returned and no valid fact anywhere');
  assert.equal(by.CURE_OR_NOTICE_PERIOD.sections[0].cause, CAUSES.MODEL_SAID_NOT_FOUND_WITH_FACT);
  assert.equal(by.CURE_OR_NOTICE_PERIOD.verdict, VERDICTS.BOOKKEEPING_MODEL_ANSWER);

  assert.deepEqual(analysis.summary.by_verdict, { SECTION_GAP: 2, BOOKKEEPING_HELD: 1, EXTRACTION_GAP: 1, BOOKKEEPING_MODEL_ANSWER: 1 });
  assert.equal(analysis.summary.carried_elsewhere, 3, 'the held fact type has no valid fact anywhere, the model-answer one is valid in its own section');
  assert.equal(analysis.summary.nowhere, 2);
  assert.equal(analysis.sections_not_extracted.length, 1);
  assert.deepEqual(analysis.sections_not_extracted[0].families, ['CAPITALISATION', 'TERMINATION']);
  assert.deepEqual(analysis.sections_not_extracted[0].unusual_provisions, ['Binding $1.5bn minimum development spend commitment']);
  assert.deepEqual(analysis.sections_not_extracted[0].cross_scope_references, ['2.2 (Exhibit-B -> MAIN_AGREEMENT)']);
});

test('a routed family with no answer rows and no extraction call reads as not read, never as a gap', () => {
  const run = metseraLikeRun();
  run.tables.product_model_calls = [];
  const analysis = analyseUnresolvedFactTypes(run, { sectionReferences: new Map() });
  const outsideDate = analysis.fact_types.find((entry) => entry.fact_type === 'OUTSIDE_DATE');
  assert.equal(outsideDate.sections[0].cause, CAUSES.MODEL_ANSWER_NOT_READ);
  assert.equal(outsideDate.verdict, VERDICTS.MIXED);
  assert.equal(outsideDate.sections[0].section_reference, S701.slice(0, 8), 'without closures the node id stands in for the reference');
});

test('compareDraftIssues sets two runs\' draft issue lists side by side', () => {
  const a = analyseUnresolvedFactTypes(metseraLikeRun(), {});
  const other = metseraLikeRun();
  other.run_id = OTHER;
  for (const rows of Object.values(other.tables)) for (const row of rows) row.run_id = OTHER;
  other.tables.product_issues.push(issue(null, 'REQUIRED_FACT_TYPE_UNRESOLVED', 'SUBSEQUENT_MATCH_PERIOD', { family_key: 'NO_SHOP' }));
  other.tables.product_issues = other.tables.product_issues.filter((row) => row.payload.message !== 'OUTSIDE_DATE');
  const b = analyseUnresolvedFactTypes(other, {});
  const compare = compareDraftIssues(a, b);
  assert.equal(compare.both.length, 4);
  assert.deepEqual(compare.only_a.map((entry) => entry.fact_type), ['OUTSIDE_DATE']);
  assert.deepEqual(compare.only_b.map((entry) => entry.fact_type), ['SUBSEQUENT_MATCH_PERIOD']);
});

test('the script writes the note from a snapshot and compares a second snapshot', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unresolved-'));
  const a = path.join(dir, 'a.snapshot.json');
  const b = path.join(dir, 'b.snapshot.json');
  const run = metseraLikeRun();
  writeRunSnapshot(a, run);
  const other = metseraLikeRun();
  other.run_id = OTHER;
  for (const rows of Object.values(other.tables)) for (const row of rows) row.run_id = OTHER;
  writeRunSnapshot(b, other);
  const out = path.join(dir, 'note.md');
  const result = await main(['--snapshot', a, '--compare-snapshot', b, '--out', out, '--json', path.join(dir, 'note.json')]);
  assert.equal(result.analysis.summary.draft_issues, 5);
  const note = fs.readFileSync(out, 'utf8');
  assert.match(note, /## Sections never extracted/);
  assert.match(note, /### Exhibit-B/);
  assert.match(note, /\| CAPITALISATION \| CAPITALISATION_AUTHORISED_CAPITAL \| yes \| Exhibit-B: not extracted \(closure incomplete: unresolved 2.4, 5.3\) \| 1 in 3.02 \| SECTION_GAP \|/);
  assert.match(note, /Both: 5; only this run: 0; only the other: 0\./);
  assert.throws(() => parseArguments(['--out', out]), /exactly one --run or --snapshot/);
  assert.throws(() => parseArguments(['--snapshot', a]), /usage/);
});
