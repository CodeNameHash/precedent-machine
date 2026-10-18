'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CALL_KIND, PROMPT_VERSION, answerProblems, buildRequests, estimateCost, recordingEntry, runPass } = require('../lib/product/rep-limb-canon');
const { callKey, createRecordedModelAdapter } = require('../lib/product/model-adapter');
const { parseArguments, runProposeRepLimbCanon } = require('../scripts/product/propose-rep-limb-canon');

const METSERA = '72d94dd2-cb59-49cf-8f46-c89d161b7769';
const NCS = '51577c57-41b1-4b75-bcdf-c84ef2558589';

// A harvest in the shape harvest-rep-limbs.js --json writes.
function harvest() {
  const readout = (run, section, summary) => ({ run_id: run, proposal_id: 'p', section_reference: section, summary });
  return {
    threshold: 0.6,
    runs: [{ run_id: METSERA, label: 'd921605dex21.htm generation 8' }, { run_id: NCS, label: 'd23867dex21.htm generation 5' }],
    rows: [
      {
        table_key: 'representations-qualifiers-table', row_label: 'Taxes; Tax Returns', existing_labels: [], facts: 4, facts_with_detail: 4, whole_row_facts: [],
        clusters: [
          { proposed_name: 'No Tax sharing or indemnity agreements', proposed_from: 'MOST_USED_MEMBER', count: 2, runs: [NCS, METSERA], members: [
            { name: 'No Tax sharing or indemnity agreements', count: 1, runs: [NCS], existing: false, readouts: [readout(NCS, '3.15', 'No tax sharing agreements')] },
            { name: 'No Tax sharing, Tax allocation or Tax indemnification agreements', count: 1, runs: [METSERA], existing: false, readouts: [readout(METSERA, '3.09', 'No tax sharing agreements bind the Company')] },
          ] },
          { proposed_name: 'Payment of Taxes due and owing', proposed_from: 'SINGLE_NAME', count: 1, runs: [NCS], members: [{ name: 'Payment of Taxes due and owing', count: 1, runs: [NCS], existing: false, readouts: [readout(NCS, '3.15', 'Taxes paid when due')] }] },
          { proposed_name: 'Payment of material Taxes', proposed_from: 'SINGLE_NAME', count: 1, runs: [METSERA], members: [{ name: 'Payment of material Taxes', count: 1, runs: [METSERA], existing: false, readouts: [readout(METSERA, '3.09', 'Taxes paid')] }] },
        ],
      },
      {
        table_key: 'representations-qualifiers-table', row_label: 'Organization; Qualification; Standing', existing_labels: ['Due organization, valid existence and good standing'], facts: 2, facts_with_detail: 1, whole_row_facts: [readout(METSERA, '3.01', 'overview')],
        clusters: [{ proposed_name: 'Due organization, valid existence and good standing', proposed_from: 'EXISTING_CANONICAL', count: 1, runs: [METSERA], members: [{ name: 'Due organization, valid existence and good standing', count: 1, runs: [METSERA], existing: true, readouts: [readout(METSERA, '3.01', 'Duly organized')] }] }],
      },
    ],
  };
}

function soundAnswers(requests) {
  const byRow = {
    'Taxes; Tax Returns': {
      row_label: 'Taxes; Tax Returns',
      categories: [
        { name: null, limbs: [{ name: 'No Tax sharing or indemnification agreements', existing: false, members: ['No Tax sharing or indemnity agreements', 'No Tax sharing, Tax allocation or Tax indemnification agreements'], note: 'one limb in two deals\' words' }] },
        { name: 'Payment', limbs: [{ name: 'Payment of Taxes due', existing: false, members: ['Payment of Taxes due and owing', 'Payment of material Taxes'] }] },
      ],
      questions: ['Is "Payment of material Taxes" the same limb as "Payment of Taxes due and owing" when the materiality qualifier is the deal\'s, not the limb\'s?'],
    },
    'Organization; Qualification; Standing': {
      row_label: 'Organization; Qualification; Standing',
      categories: [{ name: null, limbs: [{ name: 'Due organization, valid existence and good standing', existing: true, members: ['Due organization, valid existence and good standing'] }] }],
      questions: [],
    },
  };
  return requests.map((entry) => ({ entry, answer: byRow[entry.row_label] }));
}

function recordingFor(requests, { answers = soundAnswers(requests) } = {}) {
  return {
    schema_version: 'PRODUCT_MODEL_RECORDING/V1',
    calls: answers.map(({ entry, answer }) => recordingEntry(entry, { provider_id: 'ANTHROPIC_API', model_id: 'claude-opus-5;effort=high', response: answer, input_tokens: 900, output_tokens: 300, cost_microusd: 12000, duration_ms: 1500 })),
  };
}

test('buildRequests: one request per row, the decided names and every harvested name with its count and example, keyed by content', () => {
  const requests = buildRequests(harvest());
  assert.equal(requests.length, 2);
  const withEmptyRow = harvest();
  withEmptyRow.rows.push({ table_key: 'representations-qualifiers-table', row_label: 'Brokers; Finders', existing_labels: [], facts: 1, facts_with_detail: 0, whole_row_facts: [{ run_id: METSERA, proposal_id: 'p', section_reference: '3.20', summary: 'No brokers' }], clusters: [] });
  assert.equal(buildRequests(withEmptyRow).length, 2, 'a row with no limb names has nothing to name');
  const taxes = requests[0];
  assert.equal(taxes.row_label, 'Taxes; Tax Returns');
  assert.equal(taxes.input.call_kind, CALL_KIND);
  assert.equal(taxes.input.prompt_version, PROMPT_VERSION);
  assert.deepEqual(taxes.input.request.harvested_names.map((item) => item.name), [
    'No Tax sharing or indemnity agreements', 'No Tax sharing, Tax allocation or Tax indemnification agreements', 'Payment of material Taxes', 'Payment of Taxes due and owing',
  ], 'the most used first, then by name');
  assert.equal(taxes.input.request.harvested_names[0].clustered_with, 'No Tax sharing or indemnity agreements');
  assert.deepEqual(taxes.input.request.harvested_names[0].example, { section: '3.15', summary: 'No tax sharing agreements' });
  assert.equal(taxes.names, 4);
  assert.equal(taxes.call_key, callKey(taxes.input), 'the call key is the adapter\'s own');
  assert.deepEqual(requests[1].input.request.decided_canonical_names, ['Due organization, valid existence and good standing']);
  assert.equal(requests[1].input.request.whole_row_facts, 1);
  assert.deepEqual(buildRequests(harvest()).map((entry) => entry.call_key), requests.map((entry) => entry.call_key), 'the same harvest gives the same keys');
});

test('estimateCost prices the requests at the table for the extraction tier, uncached', () => {
  const estimate = estimateCost(buildRequests(harvest()));
  assert.equal(estimate.requests, 2);
  assert.equal(estimate.model_id, 'claude-opus-5');
  assert.ok(estimate.input_tokens > 400 && estimate.input_tokens < 2000, `${estimate.input_tokens}`);
  assert.equal(estimate.output_tokens, 200 + 200, 'a 200-token floor per request at these sizes');
  assert.equal(estimate.total_usd, Number(((estimate.input_tokens * 5 + estimate.output_tokens * 25) / 1e6).toFixed(2)));
  assert.match(estimate.price_source, /pricing/);
});

test('answerProblems: a sound answer has none; an unmapped, doubly mapped, invented or dropped name is named', () => {
  const requests = buildRequests(harvest());
  const [taxes, organisation] = requests;
  const answers = Object.fromEntries(soundAnswers(requests).map(({ entry, answer }) => [entry.row_label, answer]));
  assert.deepEqual(answerProblems(answers['Taxes; Tax Returns'], taxes), []);
  assert.deepEqual(answerProblems(answers['Organization; Qualification; Standing'], organisation), []);
  const broken = JSON.parse(JSON.stringify(answers['Taxes; Tax Returns']));
  broken.categories[1].limbs[0].members = ['Payment of Taxes due and owing', 'Payment of Taxes due and owing', 'Invented name'];
  const problems = answerProblems(broken, taxes);
  assert.ok(problems.some((problem) => problem.includes('"Payment of material Taxes" is mapped to no limb')));
  assert.ok(problems.some((problem) => problem.includes('"Payment of Taxes due and owing" is mapped to 2 limbs')));
  assert.ok(problems.some((problem) => problem.includes('"Invented name" is not a harvested name')));
  const dropped = { row_label: 'Organization; Qualification; Standing', categories: [{ name: null, limbs: [{ name: 'Duly organized', members: ['Due organization, valid existence and good standing'] }] }] };
  assert.ok(answerProblems(dropped, organisation).some((problem) => problem.includes('decided name "Due organization, valid existence and good standing" is not kept')));
  assert.deepEqual(answerProblems(null, taxes), ['answer is not an object']);
  assert.ok(answerProblems({ row_label: 'Other' }, taxes).includes('categories must be an array'));
});

test('runPass answers every request from a recording through the shared recorded adapter and keeps the call\'s tokens and cost', async () => {
  const requests = buildRequests(harvest());
  const adapter = createRecordedModelAdapter(recordingFor(requests));
  const results = await runPass(requests, adapter);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.problems), [[], []]);
  assert.equal(results[0].input_tokens, 900);
  assert.equal(results[0].cost_microusd, 12000);
  assert.equal(results[0].model_id, 'claude-opus-5;effort=high');
  assert.ok(adapter.assertExhausted());
  await assert.rejects(runPass(requests, createRecordedModelAdapter({ schema_version: 'PRODUCT_MODEL_RECORDING/V1', calls: [] })), /RECORDING_MISS/);
});

test('the script: a dry run writes the requests and the estimate and makes no call; the recorded mode writes the proposal note', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limb-canon-'));
  const harvestFile = path.join(dir, 'harvest.json');
  fs.writeFileSync(harvestFile, JSON.stringify(harvest()));
  const written = [];
  const dry = await runProposeRepLimbCanon({ harvest: harvestFile, outDir: path.join(dir, 'dry'), mode: 'dry-run', rows: null }, { liveAdapter: () => { throw new Error('a dry run must not build the live adapter'); } }, { write: (line) => written.push(line) });
  assert.equal(dry.results, null);
  const requestsFile = JSON.parse(fs.readFileSync(path.join(dir, 'dry', 'requests.json'), 'utf8'));
  assert.equal(requestsFile.requests.length, 2);
  assert.equal(requestsFile.estimate.requests, 2);
  assert.match(written[0], /dry run: 2 requests written, no call made; estimate \$/);
  assert.ok(!fs.existsSync(path.join(dir, 'dry', 'proposal.md')));

  const recordingFile = path.join(dir, 'recording.json');
  fs.writeFileSync(recordingFile, JSON.stringify(recordingFor(dry.requests)));
  const recorded = await runProposeRepLimbCanon({ harvest: harvestFile, outDir: path.join(dir, 'rec'), mode: 'recorded', recorded: recordingFile, rows: null }, {}, { write() {} });
  assert.equal(recorded.results.length, 2);
  const note = fs.readFileSync(path.join(dir, 'rec', 'proposal.md'), 'utf8');
  assert.match(note, /## Taxes; Tax Returns/);
  assert.match(note, /\| Payment \| Payment of Taxes due \|  \| Payment of Taxes due and owing<br>Payment of material Taxes \|/);
  assert.match(note, /\| Due organization, valid existence and good standing \| yes \|/);
  assert.match(note, /Questions for Ben:\n\n- Is "Payment of material Taxes"/);
  assert.match(note, /Rows answered: 2; answers with problems: 0/);

  const one = await runProposeRepLimbCanon({ harvest: harvestFile, outDir: path.join(dir, 'one'), mode: 'dry-run', rows: ['Taxes; Tax Returns'] }, {}, { write() {} });
  assert.equal(one.requests.length, 1);
  assert.throws(() => parseArguments(['--harvest', harvestFile]), /usage/);
  assert.throws(() => parseArguments(['--harvest', harvestFile, '--out-dir', dir, '--recorded']), /recording file/);
  assert.equal(parseArguments(['--harvest', harvestFile, '--out-dir', dir, '--live']).mode, 'live');
});

test('the live mode goes through the adapter it is given and records every answer for replay', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limb-canon-'));
  const harvestFile = path.join(dir, 'harvest.json');
  fs.writeFileSync(harvestFile, JSON.stringify(harvest()));
  const requests = buildRequests(harvest());
  const answers = Object.fromEntries(soundAnswers(requests).map(({ entry, answer }) => [entry.row_label, answer]));
  const seen = [];
  const fakeLive = { async complete(input) { seen.push(input); return { provider_id: 'ANTHROPIC_API', model_id: 'claude-opus-5;effort=high', raw_request: input.request, raw_response: {}, response: answers[input.request.row_label], input_tokens: 1000, output_tokens: 250, cost_microusd: 11250, duration_ms: 900, provider_completion_confirmed: true }; } };
  const live = await runProposeRepLimbCanon({ harvest: harvestFile, outDir: path.join(dir, 'live'), mode: 'live', rows: null }, { liveAdapter: () => fakeLive }, { write() {} });
  assert.equal(seen.length, 2);
  assert.equal(live.results.filter((result) => result.problems.length).length, 0);
  const recording = JSON.parse(fs.readFileSync(path.join(dir, 'live', 'recording.json'), 'utf8'));
  assert.equal(recording.schema_version, 'PRODUCT_MODEL_RECORDING/V1');
  assert.deepEqual(recording.calls.map((call) => call.call_key), requests.map((entry) => entry.call_key));
  const replay = await runProposeRepLimbCanon({ harvest: harvestFile, outDir: path.join(dir, 'replay'), mode: 'recorded', recorded: path.join(dir, 'live', 'recording.json'), rows: null }, {}, { write() {} });
  assert.deepEqual(replay.results.map((result) => result.answer), live.results.map((result) => result.answer));
});
