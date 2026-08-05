'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  NativeUnifiedRunExecutionError,
  validateIteration2LiveLaunch,
} = require('../lib/canonical-v2/native-producer/unified-runner-execute');

const ITEMS = Object.freeze([
  { work_item_id: 'capitalisation', source_id: 'topbuild', family_id: 'CAPITALISATION', disposition: 'EXTRACT' },
  { work_item_id: 'ioc', source_id: 'topbuild', family_id: 'INTERIM_OPERATING', disposition: 'EXTRACT' },
]);
const CONTROLS = Object.freeze([
  { work_item_id: 'capitalisation', profile_id: 'TERRA_MEDIUM', covenant_side: null },
  { work_item_id: 'ioc', profile_id: 'TERRA_MEDIUM', covenant_side: 'BUYER' },
]);
const PROFILES = Object.freeze({ capitalisation: 'TERRA_MEDIUM', ioc: 'TERRA_MEDIUM' });
const CONTEXT = Object.freeze({
  capitalisation: { source_id: 'topbuild', family_id: 'CAPITALISATION' },
  ioc: { source_id: 'topbuild', family_id: 'INTERIM_OPERATING' },
});
const CONTROL_MAP = Object.freeze({
  capitalisation: { profile_id: 'TERRA_MEDIUM', covenant_side: null },
  ioc: { profile_id: 'TERRA_MEDIUM', covenant_side: 'BUYER' },
});

function validate(overrides = {}) {
  return validateIteration2LiveLaunch({
    manifest: { work_items: ITEMS },
    work_item_controls: CONTROLS,
    live_work_item_profiles: PROFILES,
    live_work_item_context: CONTEXT,
    live_work_item_controls: CONTROL_MAP,
    max_model_invocations: 2,
    ...overrides,
  });
}

function errorCode(callback) {
  try { callback(); } catch (error) {
    assert.ok(error instanceof NativeUnifiedRunExecutionError);
    return error.code;
  }
  return null;
}

test('iteration 2 accepts one exact sealed profile, source, family and control per live item', () => {
  assert.deepEqual(validate(), {
    max_model_invocations: 2,
    work_item_ids: ['capitalisation', 'ioc'],
  });
});

test('iteration 2 rejects a changed work-item set or source-family context', () => {
  assert.equal(errorCode(() => validate({
    manifest: { work_items: [ITEMS[0]] },
  })), 'ITERATION_2_WORK_ITEM_SET_MISMATCH');
  assert.equal(errorCode(() => validate({
    manifest: { work_items: [{ ...ITEMS[0], source_id: 'other' }, ITEMS[1]] },
  })), 'ITERATION_2_WORK_ITEM_SET_MISMATCH');
});

test('iteration 2 rejects an unknown profile and a changed control binding', () => {
  assert.equal(errorCode(() => validate({
    live_work_item_profiles: { ...PROFILES, ioc: 'UNKNOWN_PROFILE' },
  })), 'ITERATION_2_WORK_ITEM_SET_MISMATCH');
  assert.equal(errorCode(() => validate({
    work_item_controls: [{ ...CONTROLS[0], profile_id: 'TERRA_HIGH' }, CONTROLS[1]],
  })), 'ITERATION_2_CONTROL_MISMATCH');
});

test('iteration 2 requires a complete closed policy and exact invocation limit', () => {
  assert.equal(errorCode(() => validate({ max_model_invocations: 1 })), 'ITERATION_2_WORK_ITEM_SET_MISMATCH');
  assert.equal(errorCode(() => validate({ live_work_item_context: null })), 'INVALID_ITERATION_2_POLICY');
});
