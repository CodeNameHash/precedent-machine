'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { buildDefinedTermOnlyAdjudication } = require('../lib/canonical-v2/native-producer/m3-defined-term-only-adjudication');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const LIVE_ARTIFACT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const RESULT_PATH = path.join(LIVE_ARTIFACT_ROOT, 'final-output', 'execution-result.json');
const REVIEW_PATH = path.join(LIVE_ARTIFACT_ROOT, 'final-output', 'independent-first-six-review-findings.json');
const MANIFEST = require('./fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
const LIVE_EXECUTION_RESULT_ID = '7c5eeece5741d77ac5ecc493783be657447d8c183b25e25daf20e41a38910b2f';

function replay(workItemId) {
  const execution = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf8'));
  assert.equal(execution.execution_result_id, LIVE_EXECUTION_RESULT_ID);
  const workItem = execution.work_results.find((entry) => entry.work_item_id === workItemId);
  const source = MANIFEST.sources.find((entry) => entry.source_id === workItem.source_id);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: ROOT });
  return {
    execution,
    workItem,
    resolution: resolveCandidates({
      run_receipt: workItem.run_receipt,
      contract_vocabulary: compileFixtureContractV34(),
      admitted_source_context: admitted.context,
    }),
  };
}

test('immutable Modiv reviewer-PASS replay preserves named consideration terms and confirms fee sides from full payment text', {
  skip: !fs.existsSync(RESULT_PATH) || !fs.existsSync(REVIEW_PATH),
}, () => {
  const consideration = replay('modiv-consideration-2-1');
  const reviewFinding = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8')).findings.find(
    (entry) => entry.work_item_id === consideration.workItem.work_item_id,
  );
  const adjudication = buildDefinedTermOnlyAdjudication({
    execution_result_id: consideration.execution.execution_result_id,
    work_item_id: consideration.workItem.work_item_id,
    run_receipt: consideration.workItem.run_receipt,
    resolution: consideration.resolution,
    independent_review_finding: reviewFinding,
  });
  assert.equal(adjudication.reviewer_disposition, 'PASS');
  assert.equal(adjudication.adjudication_outcome, 'PRESERVE_NAMED_TERM_WITHOUT_LITERAL');
  assert.deepEqual(adjudication.items.map((entry) => entry.named_term_ref).sort(), [
    'Exchange Ratio',
    'Fractional Per Company Common Share Merger Consideration',
    'Per Company Preferred Share Merger Consideration',
  ]);
  assert.ok(adjudication.items.every((entry) => entry.canonical_value === null));
  assert.equal(consideration.resolution.open_world.length, 4);

  const terminationFee = replay('modiv-termination-fee-7-3');
  const unresolvedTriggers = terminationFee.resolution.review_queue.filter((entry) => entry.has_resolution === false);
  assert.equal(unresolvedTriggers.length, 7);
  assert.ok(unresolvedTriggers.every((entry) => entry.reasons.includes('TRIGGER_UNCORROBORATED')));
  assert.ok(unresolvedTriggers.every((entry) => !entry.reasons.includes('FEE_SIDE_UNCORROBORATED')));
  assert.equal(terminationFee.resolution.open_world.length, 4);
});
