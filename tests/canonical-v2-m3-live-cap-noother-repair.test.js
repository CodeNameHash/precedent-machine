'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const LIVE_ARTIFACT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const RESULT_PATH = path.join(LIVE_ARTIFACT_ROOT, 'final-output', 'execution-result.json');
const MANIFEST = require('./fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
const LIVE_EXECUTION_RESULT_ID = '7c5eeece5741d77ac5ecc493783be657447d8c183b25e25daf20e41a38910b2f';

function replay(workItemId) {
  const execution = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf8'));
  assert.equal(execution.execution_result_id, LIVE_EXECUTION_RESULT_ID);
  const workItem = execution.work_results.find((entry) => entry.work_item_id === workItemId);
  assert.ok(workItem, `missing immutable live work item ${workItemId}`);
  const source = MANIFEST.sources.find((entry) => entry.source_id === workItem.source_id);
  assert.ok(source, `missing manifest source ${workItem.source_id}`);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: ROOT });
  return resolveCandidates({
    run_receipt: workItem.run_receipt,
    contract_vocabulary: compileFixtureContractV34(),
    admitted_source_context: admitted.context,
  });
}

function unresolvedCountValues(resolution) {
  return resolution.review_queue
    .filter((entry) => entry.has_resolution === false && entry.reasons.includes('COUNT_KIND_UNCORROBORATED'))
    .map((entry) => entry.raw_value)
    .sort();
}

test('immutable live M3 capitalisation and no-other-reps checkpoint replays conservatively', {
  skip: !fs.existsSync(RESULT_PATH),
}, () => {
  const skechersCapitalisation = replay('skechers-capitalisation-3-7');
  assert.equal(skechersCapitalisation.resolved.filter((entry) => (
    entry.claim.claim_definition_key === 'CAPITALIZATION_SHARE_COUNT'
      || entry.claim.claim_definition_key === 'RESERVED_SHARE_POOL'
  )).length, 8);
  assert.deepEqual(unresolvedCountValues(skechersCapitalisation), [
    '10,000,000 shares of Company Preferred Stock',
    '500,000,000 shares of Company Class A Common Stock',
    '75,000,000 shares of Class B Common Stock',
  ]);
  assert.equal(skechersCapitalisation.open_world.filter((entry) => (
    entry.claim_definition_key === 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE'
  )).length, 27);

  const skechersNoOtherReps = replay('skechers-no-other-reps-3-28');
  assert.equal(skechersNoOtherReps.open_world.length, 0);
  assert.deepEqual(
    skechersNoOtherReps.resolved.map((entry) => entry.claim.claim_definition_key).sort(),
    [
      'EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT',
      'NON_RELIANCE_ACKNOWLEDGMENT_PRESENT',
      'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
      'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
    ],
  );

  const topBuildCapitalisation = replay('topbuild-capitalisation-3-1-b');
  assert.deepEqual(unresolvedCountValues(topBuildCapitalisation), [
    '10,000,000 shares of preferred stock',
    '250,000,000 Company Shares',
  ]);
  assert.equal(topBuildCapitalisation.open_world.filter((entry) => (
    entry.claim_definition_key === 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE'
  )).length, 21);
});
