'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeRunSnapshot } = require('../lib/product/run-rows');
const { ReconcileBenSamplesError, factsFromSnapshot, noteFilePath, parseArguments, runReconcileBenSamples } = require('../scripts/product/reconcile-ben-samples');

const RUN = '72d94dd2-cb59-49cf-8f46-c89d161b7769';
const APOGEE_URL = 'https://www.sec.gov/Archives/edgar/data/1974640/000114036126025844/ef20076505_ex2-1.htm';

function component(id, text) {
  return { component_id: id, kind: 'TERM', origin: 'OWN', text, children: [] };
}

function proposal(id, node, { label, text, components = true }) {
  return {
    run_id: RUN, proposal_id: id, structure_node_id: node, family_key: 'CLOSING_CONDITIONS', subtype_key: 'GENERAL', fact_type: 'X', validation_status: 'VALID',
    payload: components ? { headline: { label, distinguishing_component_ids: [`${id}-c`] }, components: [component(`${id}-c`, text)], statement: text } : { statement: text },
  };
}

// A run numbered the Metsera way ("6.01"), with facts filed under the
// section node, as the active structure builder files them.
function snapshot(dir, { retrievalUrl = APOGEE_URL, v1 = false } = {}) {
  const file = path.join(dir, 'run.snapshot.json');
  writeRunSnapshot(file, {
    run_id: RUN,
    tables: {
      product_analysis_runs: [{ run_id: RUN, source_generation: 2, retrieval_url: retrievalUrl }],
      product_source_closures: [
        { run_id: RUN, structure_node_id: 'n-201', section_reference: '2.01' },
        { run_id: RUN, structure_node_id: 'n-3-intro', section_reference: 'III-INTRO' },
        { run_id: RUN, structure_node_id: 'n-603', section_reference: '6.03' },
      ],
      product_proposals: [
        proposal('p1', 'n-201', { label: 'Merger consideration', text: 'each share of Apogee common stock converts into the right to receive $135.11 in cash per share excluding cancelled shares and dissenting shares', components: !v1 }),
        proposal('p2', 'n-3-intro', { label: 'Representation qualification', text: 'except as disclosed in the SEC documents filed since January 1, 2024 or in the Company Disclosure Letter', components: !v1 }),
        proposal('p3', 'n-603', { label: 'Termination fee', text: 'Company termination fee payable to Parent within two business days', components: !v1 }),
      ],
    },
  });
  return file;
}

test('noteFilePath maps the two fixtures and passes a path through', () => {
  assert.match(noteFilePath('olaplex'), /olaplex-ben-partial-inventory\.v1\.json$/);
  assert.match(noteFilePath('Apogee'), /apogee-ben-partial-inventory\.v1\.json$/);
  assert.equal(noteFilePath('/tmp/x.json'), '/tmp/x.json');
});

test('parseArguments needs notes, one source and an out dir', () => {
  assert.throws(() => parseArguments(['--notes', 'olaplex', '--out-dir', 'x']), /usage/);
  assert.throws(() => parseArguments(['--notes', 'olaplex', '--run', RUN, '--snapshot', 'f', '--out-dir', 'x']), /usage/);
  assert.deepEqual(parseArguments(['--notes', 'olaplex', '--run', RUN, '--out-dir', 'x']), { notes: 'olaplex', runId: RUN, snapshot: null, outDir: 'x', allowSourceMismatch: false });
});

test('factsFromSnapshot shapes the proposals as v2-facts.json and keeps only component trees', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  const { readRunSnapshot } = require('../lib/product/run-rows');
  const run = readRunSnapshot(snapshot(dir));
  run.tables.product_proposals.push(proposal('v1', 'n-603', { label: 'x', text: 'y', components: false }));
  const source = factsFromSnapshot(run);
  assert.equal(source.counts.totalProposals, 4);
  assert.equal(source.counts.keptFacts, 3);
  assert.deepEqual(source.facts.map((fact) => [fact.fact_id, fact.section_reference]), [['p1', '2.01'], ['p2', 'III-INTRO'], ['p3', '6.03']]);
  assert.equal(source.retrievalUrl, APOGEE_URL);
});

test('the Apogee notes reconcile against a run of their agreement: the article intro and subsection notes reach their sections', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  const file = snapshot(dir);
  const outDir = path.join(dir, 'out');
  const written = [];
  const result = await runReconcileBenSamples({ notes: 'apogee', snapshot: file, outDir, allowSourceMismatch: false }, {}, { write: (line) => written.push(line) });
  const byId = Object.fromEntries(result.reconciliation.results.map((item) => [item.section_reference, item]));
  assert.equal(byId['2.1(a)(i)'].candidate_count, 1, 'the "2.1(a)(i)" note reaches the fact filed under "2.01"');
  assert.equal(byId['2.1(a)(i)'].best_fact.fact_id, 'p1');
  assert.ok(['MATCHED', 'PARTIAL'].includes(byId['2.1(a)(i)'].status));
  assert.equal(byId['Article III intro'].candidate_count, 1, 'the article intro note reaches "III-INTRO"');
  assert.equal(byId['Article III intro'].best_fact.fact_id, 'p2');
  assert.equal(byId['6.3(a)(i)'].best_fact.fact_id, 'p3');
  assert.ok(fs.existsSync(path.join(outDir, 'v2-facts.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'reconciliation.md')));
  const summary = fs.readFileSync(path.join(outDir, 'summary.txt'), 'utf8');
  assert.match(summary, /notes: apogee-ben-partial-inventory\.v1\.json \(7 items, 0 GAP\)/);
  assert.match(summary, /facts with a component tree: 3 of 3 proposals/);
  assert.equal(written.length, 4);
});

test('a run of another agreement is refused unless the path check is asked for, and a V1 run is refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  const other = snapshot(dir, { retrievalUrl: 'https://www.sec.gov/x/d921605dex21.htm' });
  await assert.rejects(runReconcileBenSamples({ notes: 'apogee', snapshot: other, outDir: path.join(dir, 'a') }, {}, { write() {} }), ReconcileBenSamplesError);
  const checked = await runReconcileBenSamples({ notes: 'apogee', snapshot: other, outDir: path.join(dir, 'b'), allowSourceMismatch: true }, {}, { write() {} });
  assert.match(fs.readFileSync(path.join(dir, 'b', 'reconciliation.md'), 'utf8'), /SOURCE MISMATCH: a path check, not a measure/);
  assert.equal(checked.reconciliation.results.length, 7);
  const v1 = snapshot(fs.mkdtempSync(path.join(os.tmpdir(), 'recon-')), { v1: true });
  await assert.rejects(runReconcileBenSamples({ notes: 'apogee', snapshot: v1, outDir: path.join(dir, 'c') }, {}, { write() {} }), /no proposals with a component tree/);
});

test('the Olaplex notes, which name no source URL, reconcile against any V2 run; items whose section the run lacks are MISSING with no candidate', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  const file = snapshot(dir);
  const result = await runReconcileBenSamples({ notes: 'olaplex', snapshot: file, outDir: path.join(dir, 'out') }, {}, { write() {} });
  assert.equal(result.items.length, 72);
  const noCandidates = result.reconciliation.results.filter((item) => !item.is_gap && item.candidate_count === 0);
  assert.ok(noCandidates.length > 0);
  assert.ok(noCandidates.every((item) => item.status === 'MISSING'));
  const fee = result.reconciliation.results.find((item) => item.item_id === 'OLAPLEX-BEN-01-024');
  assert.equal(fee.section_reference, '7.3');
  assert.equal(fee.candidate_count, 0, 'the snapshot has no 7.3');
});
