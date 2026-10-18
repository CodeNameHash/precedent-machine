'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_THRESHOLD, clusterRowDetails, harvestRepresentationReadouts, proposeCanonicalLimbs, similarity, stem, tokens } = require('../lib/product/rep-limb-harvest');
const { writeRunSnapshot } = require('../lib/product/run-rows');
const { parseArguments, main } = require('../scripts/product/harvest-rep-limbs');

const METSERA = '72d94dd2-cb59-49cf-8f46-c89d161b7769';
const NCS = '51577c57-41b1-4b75-bcdf-c84ef2558589';

function proposal(runId, id, { row, detail, summary = '', node = 'n1', table = 'representations-qualifiers-table', status = 'VALID' }) {
  return {
    run_id: runId, proposal_id: id, structure_node_id: node, family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD', validation_status: status,
    payload: { headline: { label: 'Status representation', summary }, conclusions: { table_key: table, row_label: row, ...(detail ? { row_detail: detail } : {}), cells: [] } },
  };
}

function run(runId, proposals, { generation, file }) {
  return {
    run_id: runId,
    tables: {
      product_analysis_runs: [{ run_id: runId, source_generation: generation, retrieval_url: `https://www.sec.gov/x/${file}` }],
      product_proposals: proposals,
      product_source_closures: [{ run_id: runId, structure_node_id: 'n1', section_reference: '3.09' }],
    },
  };
}

const TABLE_SHAPES = {
  sections: [{ section_key: 'representations-qualifiers', tables: [{
    table_key: 'representations-qualifiers-table',
    fixed_row_labels: ['Organization; Qualification; Standing', 'Taxes; Tax Returns'],
    detail_labels_by_row: { 'Organization; Qualification; Standing': ['Due organization, valid existence and good standing', 'Subsidiaries: due organization, valid existence and good standing'] },
  }] }],
};

test('tokens: stems plurals and -ation forms, drops function words, the parties and materiality', () => {
  assert.deepEqual(tokens('No material Liens for Taxes on assets other than Permitted Liens'), ['lien', 'tax', 'asset', 'permit', 'lien']);
  for (const [a, b] of [['qualification', 'qualified'], ['filings', 'filing'], ['organizational', 'organization'], ['organized', 'organization'], ['validly', 'valid'], ['existence', 'existing'], ['permitted', 'permit']]) {
    assert.equal(stem(a), stem(b), `${a} / ${b}`);
  }
  assert.deepEqual(tokens("Company's Subsidiaries & Parent"), ['subsidiari']);
});

test('similarity: the words two names share, by union and by the shorter name', () => {
  const a = new Set(tokens('No Tax sharing or indemnity agreements'));
  const b = new Set(tokens('No Tax sharing, Tax allocation or Tax indemnification agreements'));
  assert.ok(similarity(a, b) >= DEFAULT_THRESHOLD, `${similarity(a, b)}`);
  const c = new Set(tokens('Securities law filings exception'));
  const d = new Set(tokens('Exception: HSR Act and Foreign Merger Control Law filings'));
  assert.ok(similarity(c, d) < DEFAULT_THRESHOLD, `${similarity(c, d)}`);
  assert.equal(similarity(new Set(), a), 0);
});

test('clusterRowDetails: folds like names across runs, anchors on an existing canonical name, keeps scopes and same-run same-section names apart', () => {
  const readouts = [
    { run_id: NCS, section_reference: '3.15', row_detail: 'No Tax sharing or indemnity agreements', summary: 'a' },
    { run_id: METSERA, section_reference: '3.09', row_detail: 'No Tax sharing, Tax allocation or Tax indemnification agreements', summary: 'b' },
    { run_id: NCS, section_reference: '3.1', row_detail: 'Due organization, valid existence and good standing', summary: 'c' },
    { run_id: METSERA, section_reference: '3.01', row_detail: 'Duly organized, validly existing and in good standing', summary: 'd' },
    { run_id: METSERA, section_reference: '3.01', row_detail: 'Subsidiaries: duly organized, validly existing and in good standing', summary: 'e' },
    { run_id: METSERA, section_reference: '3.09', row_detail: 'No post-Closing income inclusion from a closing agreement', summary: 'f' },
    { run_id: METSERA, section_reference: '3.09', row_detail: 'No post-Closing income inclusion from prepaid amounts', summary: 'g' },
  ];
  const clusters = clusterRowDetails(readouts, { existingLabels: ['Due organization, valid existence and good standing'] });
  const byName = new Map(clusters.map((cluster) => [cluster.proposed_name, cluster]));
  assert.deepEqual(byName.get('No Tax sharing or indemnity agreements').members.map((member) => member.name), [
    'No Tax sharing or indemnity agreements', 'No Tax sharing, Tax allocation or Tax indemnification agreements',
  ]);
  assert.equal(byName.get('No Tax sharing or indemnity agreements').proposed_from, 'MOST_USED_MEMBER');
  assert.deepEqual(byName.get('No Tax sharing or indemnity agreements').runs, [NCS, METSERA].sort());
  const organisation = byName.get('Due organization, valid existence and good standing');
  assert.equal(organisation.proposed_from, 'EXISTING_CANONICAL');
  assert.deepEqual(organisation.members.map((member) => member.name), ['Due organization, valid existence and good standing', 'Duly organized, validly existing and in good standing']);
  assert.ok(byName.has('Subsidiaries: duly organized, validly existing and in good standing'), 'a Subsidiaries: scope is its own limb');
  assert.ok(byName.has('No post-Closing income inclusion from a closing agreement') && byName.has('No post-Closing income inclusion from prepaid amounts'), 'two names in one run and section are two limbs');
});

test('harvestRepresentationReadouts reads the two representations tables only and keeps whole-row facts', () => {
  const rows = [
    proposal(METSERA, 'p1', { row: 'Taxes; Tax Returns', detail: 'Payment of Taxes' }),
    proposal(METSERA, 'p2', { row: 'Taxes; Tax Returns', detail: null }),
    proposal(METSERA, 'p3', { row: 'Other', detail: 'x', table: 'general-covenants-table' }),
  ];
  const readouts = harvestRepresentationReadouts(run(METSERA, rows, { generation: 8, file: 'd921605dex21.htm' }), { sectionReferences: new Map([['n1', '3.09']]) });
  assert.deepEqual(readouts.map((readout) => [readout.proposal_id, readout.row_detail, readout.section_reference]), [['p1', 'Payment of Taxes', '3.09'], ['p2', null, '3.09']]);
});

test('proposeCanonicalLimbs: per row, the clusters, the reuse counts and the existing list; the script writes the note', async () => {
  const metsera = run(METSERA, [
    proposal(METSERA, 'm1', { row: 'Taxes; Tax Returns', detail: 'No Tax sharing, Tax allocation or Tax indemnification agreements', summary: 'No tax sharing agreements bind the Company' }),
    proposal(METSERA, 'm2', { row: 'Taxes; Tax Returns', detail: 'Payment of Taxes due and owing', summary: 'Taxes paid' }),
    proposal(METSERA, 'm3', { row: 'Organization; Qualification; Standing', detail: 'Due organization, valid existence and good standing', summary: 'Duly organized' }),
    proposal(METSERA, 'm4', { row: 'Organization; Qualification; Standing', detail: null, summary: 'Whole-row overview' }),
  ], { generation: 8, file: 'd921605dex21.htm' });
  const ncs = run(NCS, [
    proposal(NCS, 'n1', { row: 'Taxes; Tax Returns', detail: 'No Tax sharing or indemnity agreements', summary: 'No tax sharing agreements' }),
    proposal(NCS, 'n2', { row: 'Taxes; Tax Returns', detail: 'Payment of Taxes due and owing', summary: 'Taxes paid when due' }),
    proposal(NCS, 'n3', { row: 'Organization; Qualification; Standing', detail: 'Due organization, valid existence and good standing', summary: 'Duly organized' }),
  ], { generation: 5, file: 'd23867dex21.htm' });
  const proposalOut = proposeCanonicalLimbs({ runs: [metsera, ncs], tableShapes: TABLE_SHAPES, sectionReferencesByRun: new Map([[METSERA, new Map([['n1', '3.09']])], [NCS, new Map([['n1', '3.15']])]]) });
  assert.deepEqual(proposalOut.totals, { readouts: 7, with_detail: 6, rows: 2, distinct_names: 4, names_in_several_runs: 2, names_already_canonical: 1, clusters: 3, clusters_of_several_names: 1 });
  const taxes = proposalOut.rows.find((row) => row.row_label === 'Taxes; Tax Returns');
  assert.deepEqual(taxes.clusters.map((cluster) => [cluster.proposed_name, cluster.count, cluster.proposed_from]), [
    ['No Tax sharing or indemnity agreements', 2, 'MOST_USED_MEMBER'],
    ['Payment of Taxes due and owing', 2, 'SINGLE_NAME'],
  ]);
  const organisation = proposalOut.rows.find((row) => row.row_label === 'Organization; Qualification; Standing');
  assert.equal(organisation.whole_row_facts.length, 1);
  assert.equal(organisation.clusters[0].proposed_from, 'EXISTING_CANONICAL');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-limbs-'));
  const a = path.join(dir, 'a.snapshot.json');
  const b = path.join(dir, 'b.snapshot.json');
  writeRunSnapshot(a, metsera);
  writeRunSnapshot(b, ncs);
  const out = path.join(dir, 'note.md');
  const json = path.join(dir, 'note.json');
  const result = await main(['--snapshot', a, '--snapshot', b, '--out', out, '--json', json]);
  assert.equal(result.totals.readouts, 7);
  const note = fs.readFileSync(out, 'utf8');
  assert.match(note, /### Taxes; Tax Returns/);
  assert.match(note, /No Tax sharing or indemnity agreements \| most used \| 2 \| 51577c57, 72d94dd2/);
  assert.match(note, /Whole-row facts \(no limb\): 72d94dd2 §3.09 "Whole-row overview"/);
  assert.match(note, /Existing canonical list \(\d+\)/, "the script reads the live table shapes, not the test's");
  assert.ok(JSON.parse(fs.readFileSync(json, 'utf8')).rows.length === 2);
  assert.throws(() => parseArguments(['--snapshot', a]), /usage/);
  assert.throws(() => parseArguments(['--snapshot', a, '--out', out, '--threshold', '2']), /--threshold/);
});
