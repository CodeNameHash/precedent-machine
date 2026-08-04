'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  planReplayInvalidation,
  planPayload,
  validateReplayInvalidationPlan,
} = require('../lib/canonical-v2/native-producer/replay-invalidation-planner');

const digest = (char) => char.repeat(64);
const priorCandidateGenerationId = digest('a');

function changes(overrides = {}) {
  return {
    source_identity_digests: [],
    section_identity_digests: [],
    family_identity_digests: [],
    prompt_identity_digests: [],
    model_identity_digests: [],
    adapter_dependency_digests: [],
    resolver_dependency_digests: [],
    ...overrides,
  };
}

function lineage({ workItemId, memberId, adapter = digest('7'), resolver = digest('8'), raw = true, adapterClosure = null, resolverClosure = null }) {
  return {
    work_item_id: workItemId,
    raw_response: {
      sealed_digest: digest('9'),
      stored_digest: raw ? digest('9') : null,
      stored_bytes_available: raw,
    },
    source_identity_digest: digest('1'),
    section_identity_digest: digest('2'),
    family_identity_digest: digest('3'),
    prompt_identity_digest: digest('4'),
    model_identity_digest: digest('5'),
    adapter_dependency_digests: adapter === undefined ? [] : [adapter],
    adapter_dependency_closure_digest: adapterClosure,
    resolver_dependency_digests: resolver === undefined ? [] : [resolver],
    resolver_dependency_closure_digest: resolverClosure,
    candidate_member_ids: [memberId],
  };
}

test('plans deterministic member actions and preserves the old generation', () => {
  const plan = planReplayInvalidation({
    priorCandidateGenerationId,
    workItemLineages: [lineage({ workItemId: digest('b'), memberId: digest('c') }), lineage({ workItemId: digest('a'), memberId: digest('d') })],
    changedDependencySet: changes(),
  });
  assert.equal(plan.successor_generation_mode, 'CREATE_SUCCESSOR_ONLY');
  assert.deepEqual(plan.member_actions.map((entry) => entry.work_item_id), [digest('a'), digest('b')]);
  assert.deepEqual(plan.member_actions.map((entry) => entry.action), ['REUSE_UNCHANGED_RAW', 'REUSE_UNCHANGED_RAW']);
  assert.equal(validateReplayInvalidationPlan(plan), true);
});

test('adapter and resolver changes fan out to every dependent candidate member', () => {
  const sharedAdapter = digest('b');
  const sharedResolver = digest('c');
  const plan = planReplayInvalidation({
    priorCandidateGenerationId,
    workItemLineages: [
      lineage({ workItemId: digest('1'), memberId: digest('a'), adapter: sharedAdapter }),
      lineage({ workItemId: digest('2'), memberId: digest('b'), adapter: sharedAdapter }),
      lineage({ workItemId: digest('3'), memberId: digest('c'), resolver: sharedResolver }),
    ],
    changedDependencySet: changes({
      adapter_dependency_digests: [sharedAdapter],
      resolver_dependency_digests: [sharedResolver],
    }),
  });
  assert.deepEqual(plan.member_actions.map((entry) => entry.action), [
    'REPLAY_FROM_STORED_RAW',
    'REPLAY_FROM_STORED_RAW',
    'REPLAY_FROM_STORED_RAW',
  ]);
  assert.equal(plan.member_actions.every((entry) => entry.model_call_count === 0), true);
});

test('source, prompt, and model changes always require extraction', () => {
  for (const changedKey of [
    'source_identity_digests',
    'prompt_identity_digests',
    'model_identity_digests',
  ]) {
    const plan = planReplayInvalidation({
      priorCandidateGenerationId,
      workItemLineages: [lineage({ workItemId: digest('e'), memberId: digest('f') })],
      changedDependencySet: changes({ [changedKey]: [
        changedKey === 'source_identity_digests' ? digest('1')
          : changedKey === 'prompt_identity_digests' ? digest('4') : digest('5'),
      ] }),
    });
    assert.equal(plan.member_actions[0].action, 'REEXTRACT_REQUIRED');
    assert.equal(plan.member_actions[0].model_call_count, 1);
  }
});

test('hostile inputs cannot under-invalidate stale raw, missing raw, or incomplete lineage', () => {
  const stale = lineage({ workItemId: digest('a'), memberId: digest('b') });
  stale.raw_response.stored_digest = digest('d');
  assert.throws(() => planReplayInvalidation({ priorCandidateGenerationId, workItemLineages: [stale], changedDependencySet: changes() }), /raw-response identity/);

  const missingRawPlan = planReplayInvalidation({
    priorCandidateGenerationId,
    workItemLineages: [lineage({ workItemId: digest('c'), memberId: digest('d'), raw: false })],
    changedDependencySet: changes({ adapter_dependency_digests: [digest('7')] }),
  });
  assert.equal(missingRawPlan.member_actions[0].action, 'REEXTRACT_REQUIRED');
  assert.equal(missingRawPlan.member_actions[0].model_call_count, 1);

  const incomplete = lineage({ workItemId: digest('e'), memberId: digest('f') });
  delete incomplete.resolver_dependency_digests;
  assert.throws(() => planReplayInvalidation({ priorCandidateGenerationId, workItemLineages: [incomplete], changedDependencySet: changes() }), /not closed/);
});

test('hostile false zero-call plan is rejected', () => {
  const plan = planReplayInvalidation({
    priorCandidateGenerationId,
    workItemLineages: [lineage({ workItemId: digest('a'), memberId: digest('b') })],
    changedDependencySet: changes({ source_identity_digests: [digest('1')] }),
  });
  const forged = {
    ...plan,
    member_actions: plan.member_actions.map((entry) => ({
      ...entry,
      action: 'REPLAY_FROM_STORED_RAW',
      model_call_count: 0,
    })),
  };
  forged.replay_invalidation_plan_id = contentId(forged.schema_version, planPayload(forged));
  assert.throws(() => validateReplayInvalidationPlan(forged), /invalid zero-call claim|sealed lineage/);
});

test('accepts a unified-runner work-item content digest and a closed empty dependency set', () => {
  const unifiedWorkItemId = contentId('NATIVE_FULL_CORPUS_EXECUTION_WORK_ITEM/V1', {
    source_id: 'topbuild-original', family_id: 'NO_SHOP', disposition: 'EXTRACT', section_id: digest('7'),
  });
  const plan = planReplayInvalidation({
    priorCandidateGenerationId,
    workItemLineages: [lineage({
      workItemId: unifiedWorkItemId,
      memberId: digest('8'),
      adapter: undefined,
      resolver: undefined,
      adapterClosure: digest('9'),
      resolverClosure: digest('a'),
    })],
    changedDependencySet: changes(),
  });
  assert.equal(plan.member_actions[0].work_item_id, unifiedWorkItemId);
  assert.equal(validateReplayInvalidationPlan(plan), true);
});
