'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  Attempt3PostrunAssessorError,
  assessAttempt3LiveOutputs,
} = require('../lib/canonical-v2/native-producer/m3-attempt-3-postrun-assessor');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const ATTEMPT_ROOT = path.join(ARTIFACT_ROOT, 'iteration-2-preparation', 'attempt-3');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fixturePathsPresent() {
  return [
    path.join(ATTEMPT_ROOT, 'sealed-rerun-plan.json'),
    path.join(ATTEMPT_ROOT, 'live-only-manifest.json'),
    path.join(ATTEMPT_ROOT, 'independent-live-review-rubric-v2.json'),
    path.join(ARTIFACT_ROOT, 'final-output', 'execution-result.json'),
    path.join(ARTIFACT_ROOT, 'final-output', 'model-rerun-acceptance-checklist-v2.json'),
  ].every(fs.existsSync);
}

function input() {
  const plan = loadJson(path.join(ATTEMPT_ROOT, 'sealed-rerun-plan.json'));
  const first = loadJson(path.join(ARTIFACT_ROOT, 'final-output', 'execution-result.json'));
  const expectedProfiles = new Map([
    ...plan.live_terra_work_items.map((item) => [item.work_item_id, 'TERRA_MEDIUM']),
    ...plan.live_sol_work_items.map((item) => [item.work_item_id, 'SOL_HIGH']),
  ]);
  const workResults = first.work_results
    .filter((result) => expectedProfiles.has(result.work_item_id))
    .map((result) => {
      const body = { ...result, profile_id: expectedProfiles.get(result.work_item_id) };
      delete body.work_result_id;
      return { ...body, work_result_id: contentId('NATIVE_UNIFIED_RUN_WORK_RESULT/V1', body) };
    });
  const executionBody = {
    schema_version: 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1',
    validation_receipt_id: first.validation_receipt_id,
    semantic_manifest_id: first.semantic_manifest_id,
    execution_plan_id: first.execution_plan_id,
    contract_fingerprint: first.contract_fingerprint,
    validation_evidence: first.validation_evidence,
    work_results: workResults,
    succeeded_count: workResults.filter((result) => result.status === 'SUCCEEDED').length,
    failed_count: workResults.filter((result) => result.status === 'FAILED').length,
  };
  return {
    plan,
    live_manifest: loadJson(path.join(ATTEMPT_ROOT, 'live-only-manifest.json')),
    live_execution_result: {
      ...executionBody,
      execution_result_id: contentId('NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1', executionBody),
    },
    acceptance_checklist: loadJson(path.join(ARTIFACT_ROOT, 'final-output', 'model-rerun-acceptance-checklist-v2.json')),
    rubric: loadJson(path.join(ATTEMPT_ROOT, 'independent-live-review-rubric-v2.json')),
    root_dir: ROOT,
  };
}

test('emits an eight-item deterministic worksheet without automatic legal passes', {
  skip: !fixturePathsPresent(),
}, () => {
  const result = assessAttempt3LiveOutputs(input());
  assert.equal(result.worksheets.length, 8);
  assert.equal(result.automatic_legal_passes, 0);
  assert.ok(result.worksheets.every((item) => (
    item.automatic_legal_disposition === 'NOT_DETERMINED'
      && item.independent_review_state === 'PENDING_INDEPENDENT_LEGAL_REVIEW'
      && Number.isSafeInteger(item.deterministic_metrics.citation_residual_count)
  )));
  assert.equal(result.iteration_2_rerun_plan_id,
    '366e413aadc1deaa6a8be25286149f79d839b09ee17533f697bc91f1ee7de70b');
});

test('fails closed when a live work result identity is changed', {
  skip: !fixturePathsPresent(),
}, () => {
  const value = input();
  value.live_execution_result.work_results[0].work_result_id = '0'.repeat(64);
  const body = { ...value.live_execution_result };
  delete body.execution_result_id;
  value.live_execution_result.execution_result_id = contentId('NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1', body);
  assert.throws(
    () => assessAttempt3LiveOutputs(value),
    (error) => error instanceof Attempt3PostrunAssessorError && error.code === 'INVALID_LIVE_WORK_RESULT',
  );
});

test('fails closed when retained output counts disagree with their arrays', {
  skip: !fixturePathsPresent(),
}, () => {
  const value = input();
  const result = value.live_execution_result.work_results[0];
  const resultBody = {
    ...result,
    run_receipt: {
      ...result.run_receipt,
      compiled_candidate_count: result.run_receipt.compiled_candidate_count + 1,
    },
  };
  delete resultBody.work_result_id;
  value.live_execution_result.work_results[0] = {
    ...resultBody,
    work_result_id: contentId('NATIVE_UNIFIED_RUN_WORK_RESULT/V1', resultBody),
  };
  const executionBody = { ...value.live_execution_result };
  delete executionBody.execution_result_id;
  value.live_execution_result.execution_result_id = contentId('NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1', executionBody);
  assert.throws(
    () => assessAttempt3LiveOutputs(value),
    (error) => error instanceof Attempt3PostrunAssessorError && error.code === 'OUTPUT_COUNT_MISMATCH',
  );
});
