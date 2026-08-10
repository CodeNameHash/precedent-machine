'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'stage-2y-corroboration-ladder.mjs');
const REPORT = path.join(ROOT, 'evidence', 'canonical-v2', 'stage-2y-corroboration-ladder.json');
const MARKDOWN = path.join(ROOT, 'evidence', 'canonical-v2', 'stage-2y-corroboration-ladder.md');
const { assessCorroborationLadder } = require('../lib/canonical-v2/native-producer/corroboration-ladder');
const { createReplayClient } = require('../lib/canonical-v2/native-producer/provider-record-replay');

function report() {
  return JSON.parse(fs.readFileSync(REPORT, 'utf8'));
}

async function runner() {
  return import(pathToFileURL(SCRIPT).href);
}

test('runner syntax and committed output are deterministic check inputs', () => {
  execFileSync('node', ['--check', SCRIPT], { cwd: ROOT, stdio: 'pipe' });
  const value = report();
  assert.equal(value.schema_version, 'STAGE_2Y_CORROBORATION_LADDER_REPORT/V1');
  assert.equal(value.mode, 'INERT_REPLAY_ONLY');
  assert.match(fs.readFileSync(MARKDOWN, 'utf8'), /No adjudication or rung selection occurred/);
});

test('recorded replay uses the current V44 extraction contract', async () => {
  const { REPLAY_CONTRACT_BUNDLE_VERSION, compileReplayContractBundle } = await runner();
  assert.equal(REPLAY_CONTRACT_BUNDLE_VERSION, 'compileFixtureContractV44');
  const definition = compileReplayContractBundle().claim_definitions
    .find((entry) => entry.claim_definition_key === 'FRUSTRATION_CAUSATION_STANDARD');
  assert.equal(definition.allowed_canonical_values.includes('PRIMARILY_CAUSED'), true);
});

test('recorded replay cannot make a live call and missing or exhausted recordings fail closed', async () => {
  assert.throws(() => createReplayClient({ recording: { schema_version: 'BAD/V1', calls: [] } }), /REPLAY_SCHEMA_MISMATCH/);
  const replay = createReplayClient({ recording: {
    schema_version: 'NATIVE_PRODUCER_RECORDED_RUN/V3', call_count: 1,
    calls: [{ request_key: 'not-the-request', raw_response_text: '{}', request_system: [], request_messages: [] }],
  } });
  await assert.rejects(() => replay.messages.create({ messages: [{ role: 'user', content: 'live calls are forbidden' }] }), /REPLAY_MISS/);
});

test('recorded replay keeps the sealed historical prompt when current prompt text changes', async () => {
  const { createRecordedPromptTransformer } = await runner();
  const recording = {
    calls: [{
      request_system: [{ type: 'text', text: 'sealed system' }],
      request_messages: [{ role: 'user', content: 'GOVERNED SECTION REFERENCE: 7.1\n\nsealed historical body' }],
    }],
  };
  const transform = createRecordedPromptTransformer({
    recording,
    oldReceipt: { resolved_sections: [{ section_reference: '7.1' }] },
    runName: 'fixture-final',
  });
  const transformed = transform({
    prompt_id: 'current-prompt',
    system: [{ type: 'text', text: 'current system' }],
    messages: [{ role: 'user', content: 'GOVERNED SECTION REFERENCE: 7.1\n\ncurrent changed body' }],
  });
  assert.equal(transformed.prompt_id, 'current-prompt');
  assert.deepEqual(transformed.system, recording.calls[0].request_system);
  assert.deepEqual(transformed.messages, recording.calls[0].request_messages);
  assert.throws(() => transform({ messages: [{ role: 'user', content: 'GOVERNED SECTION REFERENCE: 7.2\n\nwrong section' }] }), /no sealed recording/);
});

test('UTF-8 byte evidence is a gate and can never defer a model result', () => {
  const candidate = {
    claim: {
      raw_value: 'shall issue a press release', canonical_value: 'COV-PUBLICITY',
      attributes: { covenant_code: 'COV-PUBLICITY', owner_id: 'PUBLICITY_COVENANTS', definition_cross_references: [] },
    },
    non_corroboration_gates: { structural_passed: true, enum_passed: true, evidence_passed: true },
  };
  const ladder = assessCorroborationLadder({
    family: 'GENERAL_COVENANTS', candidate,
    verified_evidence: { source_text: 'shall issue a press release', spans: [{ absolute_start: 1, absolute_end: 5, text_sha256: 'bad' }] },
  });
  assert.ok(ladder.rungs.every((rung) => rung.derivation === 'INAPPLICABLE'));
  assert.ok(ladder.rungs.every((rung) => rung.proposed_resolution !== 'MODEL_DEFERRED'));
});

test('report preserves exact denominators, material duplicate provenance, inertness, and control parity', () => {
  const value = report();
  assert.deepEqual(value.denominators.map((row) => [row.family, row.candidate_rows, row.distinct_criteria]), [
    ['GENERAL_COVENANTS', 54, 54], ['MATERIAL_CONTRACTS', 116, 57], ['INTERIM_OPERATING', 205, 205],
  ]);
  const material = value.assessments.filter((row) => row.family === 'MATERIAL_CONTRACTS');
  assert.ok(material.some((row) => row.source_claim_ids.length === 2));
  assert.equal(value.publication.model_calls, 0);
  assert.equal(value.publication.writes_performed, false);
  assert.equal(value.publication.serving_activated, false);
  const serialised = JSON.stringify(value);
  assert.equal(serialised.includes('ELIGIBLE'), false);
  assert.equal(serialised.includes('PUBLISHED'), false);
  assert.ok(value.assessments.every((row) => row.publication_disposition === 'WITHHELD'
    && row.rungs.every((rung) => rung.publication_disposition === 'WITHHELD')));
  assert.ok(value.assessments.some((row) => row.current_resolution.state === 'RESOLVED' && row.rungs[0].derivation === 'MATCH'));
  assert.ok(value.assessments.some((row) => row.current_resolution.reason === 'CATEGORY_UNCORROBORATED' && row.rungs[0].derivation === 'EMPTY'));
});

test('official selection is automatic, complete, and rejects a duplicate deal and family', async () => {
  const { SELECTED_RUNS, EXPECTED_SELECTED_RUN_COUNT, selectOfficialRuns } = await runner();
  assert.equal(SELECTED_RUNS.length, EXPECTED_SELECTED_RUN_COUNT);
  assert.equal(EXPECTED_SELECTED_RUN_COUNT, 21);
  assert.throws(() => selectOfficialRuns([
    { run_name: 'concho-general-covenants-20260809-2xk-final', family: 'GENERAL_COVENANTS', deal_key: 'concho' },
    { run_name: 'concho-general-covenants-20260809-2xk-final', family: 'GENERAL_COVENANTS', deal_key: 'concho' },
  ]), /duplicate selected deal\/family/);
});

test('exact duplicate criterion rows collapse and conflicting duplicates fail closed', async () => {
  const { mergeExactCriteria } = await runner();
  const row = {
    family: 'INTERIM_OPERATING',
    run_name: 'fixture-final',
    deal_key: 'fixture',
    section_reference: '5.1',
    entry: { candidate: { claim: { claim_occurrence_id: 'claim-1', claim_definition_key: 'NATIVE_IOC_RESTRICTION_ASSERTION_CANDIDATE' } } },
    control: { state: 'RESOLVED', reason: null },
    evidence: { report: [{ absolute_start: 1, absolute_end: 2, text_sha256: 'digest' }] },
    gates: { structural_passed: true, enum_passed: true, evidence_passed: true },
  };
  const collapsed = mergeExactCriteria([structuredClone(row), structuredClone(row)]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].source_candidate_row_count, 2);
  assert.equal(collapsed[0].source_candidates.length, 1);
  const conflict = structuredClone(row);
  conflict.control.reason = 'CATEGORY_UNCORROBORATED';
  assert.throws(() => mergeExactCriteria([row, conflict]), /conflicting source rows/);
});

test('each curve is a complete criterion partition and marginal deferral is new at that rung', async () => {
  const { curves } = await runner();
  const rung = (proposed_resolution) => ({ derivation: proposed_resolution === 'MODEL_DEFERRED' ? 'AMBIGUOUS' : 'MATCH', proposed_resolution });
  const assessments = [
    { family: 'GENERAL_COVENANTS', criterion_identity: 'one', rungs: [rung('RESOLVED'), rung('MODEL_DEFERRED'), rung('MODEL_DEFERRED'), rung('RESOLVED'), rung('MODEL_DEFERRED')] },
    { family: 'GENERAL_COVENANTS', criterion_identity: 'two', rungs: [rung('RESOLVED'), rung('RESOLVED'), rung('MODEL_DEFERRED'), rung('RESOLVED'), rung('RESOLVED')] },
  ];
  const values = curves(assessments, { GENERAL_COVENANTS: 2 });
  for (const curve of values) {
    assert.equal(Object.values(curve.derivations).reduce((sum, count) => sum + count, 0), curve.denominator.distinct_criteria);
    assert.equal(Object.values(curve.proposed_resolutions).reduce((sum, count) => sum + count, 0), curve.denominator.distinct_criteria);
  }
  const general = values.filter((curve) => curve.family === 'GENERAL_COVENANTS');
  assert.deepEqual(general.map((curve) => [curve.total_model_deferred, curve.marginal_model_deferred]), [[0, 0], [1, 1], [2, 1], [0, 0], [1, 1]]);
});

test('the report curves cover all families and the markdown renders every rung', () => {
  const value = report();
  assert.equal(value.curves.length, 15);
  for (const curve of value.curves) {
    assert.equal(Object.values(curve.derivations).reduce((sum, count) => sum + count, 0), curve.denominator.distinct_criteria);
    assert.equal(Object.values(curve.proposed_resolutions).reduce((sum, count) => sum + count, 0), curve.denominator.distinct_criteria);
  }
  const markdown = fs.readFileSync(MARKDOWN, 'utf8');
  for (const family of ['GENERAL_COVENANTS', 'MATERIAL_CONTRACTS', 'INTERIM_OPERATING']) {
    assert.match(markdown, new RegExp(`### ${family}`));
  }
  assert.equal((markdown.match(/^\| [0-4] \|/gm) || []).length, 15);
});
