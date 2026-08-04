'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  executeUnifiedRun,
} = require('../lib/canonical-v2/native-producer/unified-runner-execute');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));
const controls = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-controls.json',
), 'utf8')).work_item_controls;

const MINIMUM_FAMILY_RESPONSES = Object.freeze({
  ANTITRUST_REGULATORY: { regulatory_efforts_assertions: [], open_world_candidates: [] },
  CAPITALISATION: {
    representation_instances: [],
    bring_down_conditions: [],
    open_world_candidates: [],
    share_count_assertions: [],
  },
  CLOSING_CONDITIONS: { closing_condition_assertions: [], open_world_candidates: [] },
  CONSIDERATION: {
    consideration_assertions: [],
    consideration_mechanics: [],
    open_world_candidates: [],
  },
  INTERIM_OPERATING: {
    ioc_restriction_assertions: [],
    ioc_mechanics: [],
    open_world_candidates: [],
  },
  MAE_DEFINITION: { mae_definition_instances: [], open_world_candidates: [] },
  NO_OTHER_REPS_FRAUD: {
    no_other_reps_assertions: [],
    non_reliance_assertions: [],
    independent_investigation_assertions: [],
    fraud_carveout_assertions: [],
    willful_breach_definitions: [],
    open_world_candidates: [],
  },
  NO_SHOP: {
    no_shop_action_assertions: [],
    exception_prerequisite_assertions: [],
    period_assertions: [],
    cease_assertions: [],
    standstill_assertions: [],
    fiduciary_standard_assertions: [],
    recommendation_assertions: [],
    open_world_candidates: [],
  },
  SPECIFIC_PERFORMANCE_REMEDIES: { remedy_assertions: [], open_world_candidates: [] },
  TERMINATION: {
    termination_right_assertions: [],
    wave_b_mechanics: [],
    open_world_candidates: [],
  },
  TERMINATION_FEE: {
    fee_amount_assertions: [],
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    wave_b_mechanics: [],
    open_world_candidates: [],
  },
});

const PROMPT_IDS = Object.freeze({
  ANTITRUST_REGULATORY: 'native-producer-antitrust-regulatory/v1',
  CAPITALISATION: 'CAPITALISATION_REPRESENTATION_PRODUCER',
  CLOSING_CONDITIONS: 'native-producer-closing-conditions/v3',
  CONSIDERATION: 'native-producer-consideration/v1',
  INTERIM_OPERATING: 'native-producer-interim-operating/v3',
  MAE_DEFINITION: 'mae-definition-producer/v1',
  NO_OTHER_REPS_FRAUD: 'native-producer-no-other-reps-fraud/v1',
  NO_SHOP: 'native-producer-no-shop/v1',
  SPECIFIC_PERFORMANCE_REMEDIES: 'native-producer-specific-performance-remedies/v1',
  TERMINATION: 'native-producer-termination/v1',
  TERMINATION_FEE: 'native-producer-termination-fee/v1',
});

function rehearsalProviderFactory(providerFactoryCalls, providerCalls) {
  return ({ profileId }) => {
    providerFactoryCalls.push(profileId);
    return async (input) => {
      const response = MINIMUM_FAMILY_RESPONSES[input.section_family];
      assert.ok(response, `missing minimum response for ${input.section_family}`);
      providerCalls.push({ profile_id: profileId, input });
      const rawResponse = JSON.stringify(response);
      return {
        provider_id: 'NO_MODEL_REHEARSAL_STUB/V1',
        model_id: 'deterministic-stub/no-model',
        prompt: [],
        proposals: [],
        evidence_residuals: [],
        raw_response_text: rawResponse,
        raw_response_length: Buffer.byteLength(rawResponse, 'utf8'),
        attempts: 1,
      };
    };
  };
}

test('rehearses all twelve manifest assignments through pinned adapters without a model or classifier', async () => {
  const providerFactoryCalls = [];
  const providerCalls = [];
  const checkpoints = [];
  const first = await executeUnifiedRun({
    manifest,
    work_item_controls: controls,
    root_dir: ROOT,
    max_concurrency: 4,
    provider_factory: rehearsalProviderFactory(providerFactoryCalls, providerCalls),
    on_work_result: async (_result, checkpoint) => checkpoints.push(checkpoint),
  });

  const expectedItems = [...manifest.work_items]
    .filter((item) => item.disposition === 'EXTRACT')
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  assert.equal(expectedItems.length, 12);
  assert.deepEqual(providerFactoryCalls, ['TERRA_MEDIUM']);
  assert.equal(providerCalls.length, 12);
  assert.deepEqual(
    providerCalls.map((call) => call.input.section_family).sort(),
    expectedItems.map((item) => item.family_id).sort(),
  );
  assert.ok(providerCalls.every((call) => call.input.governed_scope.source_text.length > 0));
  assert.equal(first.succeeded_count, 12);
  assert.equal(first.failed_count, 0);
  assert.equal(first.work_results.length, 12);
  assert.equal(checkpoints.length, 12);
  assert.ok(checkpoints.every((checkpoint) => Object.isFrozen(checkpoint)
    && /^[a-f0-9]{64}$/.test(checkpoint.checkpoint_id)));
  assert.ok(Object.isFrozen(first));

  const expectedById = new Map(expectedItems.map((item) => [item.work_item_id, item]));
  for (const result of first.work_results) {
    const item = expectedById.get(result.work_item_id);
    assert.ok(item);
    assert.equal(result.status, 'SUCCEEDED');
    assert.equal(result.source_id, item.source_id);
    assert.equal(result.family_id, item.family_id);
    assert.match(result.work_result_id, /^[a-f0-9]{64}$/);
    assert.ok(Object.isFrozen(result));
    assert.equal(result.run_receipt.resolved_sections.length, 1);
    assert.equal(result.run_receipt.resolved_sections[0].section_family, item.family_id);
    assert.equal(result.run_receipt.resolved_sections[0].section_family_provenance,
      'SECTION_FAMILY_MANIFEST_ASSIGNED');
    assert.equal(result.run_receipt.resolved_sections[0].prompt_id, PROMPT_IDS[item.family_id]);
    assert.deepEqual(
      JSON.parse(result.provider_recording.provider_output.raw_response_text),
      MINIMUM_FAMILY_RESPONSES[item.family_id],
    );
    assert.match(result.provider_recording.provider_recording_id, /^[a-f0-9]{64}$/);
    assert.ok(Object.isFrozen(result.run_receipt));
    assert.ok(Object.isFrozen(result.resolution));
  }

  const resumed = await executeUnifiedRun({
    manifest,
    work_item_controls: controls,
    root_dir: ROOT,
    provider_factory: () => () => { throw new Error('resume must not invoke a provider'); },
    resume_checkpoints: checkpoints,
  });
  assert.equal(resumed.execution_result_id, first.execution_result_id);
  assert.equal(resumed.succeeded_count, 12);
  assert.equal(resumed.failed_count, 0);
});
