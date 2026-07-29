const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  RESULT_DEFINITION,
  buildProcessExclusivityResultIdentity,
  validateProcessExclusivityResultIdentity,
} = require('../lib/canonical-v2/process-exclusivity-result');
const resultContract = require(
  '../contracts/canonical-v2/successor/process/results/process-exclusivity-event-result.v1.json',
);

function digest(label) {
  return crypto.createHash('sha256').update(label).digest('hex');
}

function input(overrides = {}) {
  return {
    frozen_contract_pair_digest: digest('contract-pair'),
    governed_deal_admission_id: digest('deal'),
    precomputed_process_event_id: digest('process-event'),
    result_definition_key_and_version: { ...RESULT_DEFINITION },
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(assertDeepFrozen);
}

test('builds one deterministic immutable identity from the exact five inputs', () => {
  const first = buildProcessExclusivityResultIdentity(input());
  const second = buildProcessExclusivityResultIdentity(input());

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(first.logical_type, 'ProcessExclusivityEventResult');
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_result_slot_binding_state, 'UNRESOLVED');
  assert.equal(first.process_event_revision_state, 'UNRESOLVED');
  assert.equal(first.predicate_witnesses_state, 'UNRESOLVED');
  assert.equal(first.actual_drafting_state, 'UNRESOLVED');
  assert.equal(first.result_input_lineage_state, 'UNRESOLVED');
  assert.equal(first.history_projection_state, 'UNRESOLVED');
  assert.equal(first.phrasebook_link_state, 'UNRESOLVED');
  assert.equal(first.exact_detail_state, 'UNRESOLVED');
  assert.equal(first.release_membership_state, 'UNRESOLVED');
  assert.deepEqual(first.authority_limits, AUTHORITY_LIMITS);
  assert.equal(validateProcessExclusivityResultIdentity(first), first);
});

test('keeps separate ProcessEvent slots and governed ordinals distinct', () => {
  const first = buildProcessExclusivityResultIdentity(input());
  const laterEvent = buildProcessExclusivityResultIdentity(input({
    precomputed_process_event_id: digest('later-process-event'),
  }));
  const laterOrdinal = buildProcessExclusivityResultIdentity(input({
    governed_ordinal: 1,
  }));

  assert.notEqual(
    first.process_exclusivity_event_result_id,
    laterEvent.process_exclusivity_event_result_id,
  );
  assert.notEqual(
    first.process_exclusivity_event_result_id,
    laterOrdinal.process_exclusivity_event_result_id,
  );
});

test('rejects value, component, lineage, projection and release inputs', () => {
  for (const prohibited of [
    'application_join_order',
    'candidate_values',
    'display_text',
    'model_output',
    'query_text',
    'selected_revision_id',
    'event_revision_id',
    'predicate_witness_revision_ids',
    'actual_drafting_revision_ids',
    'lineage',
    'history_projection',
    'release_identity',
  ]) {
    assert.throws(
      () => buildProcessExclusivityResultIdentity(input({
        [prohibited]: 'FORGED',
      })),
      (error) => (
        error.code === 'PROCESS_EXCLUSIVITY_RESULT_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(prohibited)
      ),
    );
  }
});

test('rejects extra identity fields and malformed frozen inputs', () => {
  assert.throws(
    () => buildProcessExclusivityResultIdentity(input({ extra: true })),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessExclusivityResultIdentity(input({
      governed_deal_admission_id: 'not-a-digest',
    })),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessExclusivityResultIdentity(input({
      precomputed_process_event_id: 'not-a-digest',
    })),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessExclusivityResultIdentity(input({
      result_definition_key_and_version: {
        definition_key: 'PROCESS_EXCLUSIVITY_EVENT_RESULT',
        definition_version: 2,
      },
    })),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessExclusivityResultIdentity(input({
      governed_ordinal: -1,
    })),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );
});

test('rejects ID, payload, state and authority tampering', () => {
  const built = buildProcessExclusivityResultIdentity(input());

  const wrongId = clone(built);
  wrongId.process_exclusivity_event_result_id = digest('wrong-id');
  assert.throws(
    () => validateProcessExclusivityResultIdentity(wrongId),
    { code: 'PROCESS_EXCLUSIVITY_RESULT_ID_MISMATCH' },
  );

  const wrongPayload = clone(built);
  wrongPayload.canonical_payload_digest = digest('wrong-payload');
  assert.throws(
    () => validateProcessExclusivityResultIdentity(wrongPayload),
    { code: 'PROCESS_EXCLUSIVITY_RESULT_PAYLOAD_MISMATCH' },
  );

  const wrongState = clone(built);
  wrongState.result_input_lineage_state = 'READY';
  assert.throws(
    () => validateProcessExclusivityResultIdentity(wrongState),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );

  const wrongAuthority = clone(built);
  wrongAuthority.authority_limits.serving = 'GRANTED';
  assert.throws(
    () => validateProcessExclusivityResultIdentity(wrongAuthority),
    { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_IDENTITY' },
  );
});

test('fails closed on any signed result-contract drift', () => {
  const original = resultContract.definition.history_projection_contract
    .separate_bidder_tracks_can_be_mixed;
  resultContract.definition.history_projection_contract
    .separate_bidder_tracks_can_be_mixed = true;
  try {
    assert.throws(
      () => buildProcessExclusivityResultIdentity(input()),
      { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_CONTRACT_BINDING' },
    );
  } finally {
    resultContract.definition.history_projection_contract
      .separate_bidder_tracks_can_be_mixed = original;
  }

  resultContract.definition.composition_contract.hidden_join_authority = true;
  try {
    assert.throws(
      () => buildProcessExclusivityResultIdentity(input()),
      { code: 'INVALID_PROCESS_EXCLUSIVITY_RESULT_CONTRACT_BINDING' },
    );
  } finally {
    delete resultContract.definition.composition_contract.hidden_join_authority;
  }
});

test('does not treat the precomputed event ID as a bound event revision', () => {
  const built = buildProcessExclusivityResultIdentity(input());

  assert.equal(built.process_event_revision_state, 'UNRESOLVED');
  assert.equal(Object.hasOwn(built, 'event_revision_id'), false);
  assert.equal(Object.hasOwn(built, 'process_event'), false);
  assert.equal(Object.hasOwn(built, 'validate_process_event_identity'), false);
});

test('grants no materialisation, lineage, serving or release authority', () => {
  const built = buildProcessExclusivityResultIdentity(input());

  assert.equal(Object.hasOwn(built, 'predicate_witness_revision_ids'), false);
  assert.equal(Object.hasOwn(built, 'actual_drafting_revision_ids'), false);
  assert.equal(Object.hasOwn(built, 'lineage'), false);
  assert.equal(Object.hasOwn(built, 'history_projection'), false);
  assert.equal(Object.hasOwn(built, 'phrasebook_result_id'), false);
  assert.equal(Object.hasOwn(built, 'release_identity'), false);
  assert.deepEqual(
    Object.values(built.authority_limits),
    Object.values(built.authority_limits).map(() => 'NONE'),
  );
});
