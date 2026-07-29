const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  AUTHORITY_LIMITS,
  buildProcessPhrasebookResultIdentity,
  validateProcessPhrasebookResultIdentity,
} = require('../lib/canonical-v2/process-phrasebook-result');
const resultContract = require(
  '../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
);

function digest(label) {
  return crypto.createHash('sha256').update(label).digest('hex');
}

function input(overrides = {}) {
  return {
    frozen_contract_pair_digest: digest('contract-pair'),
    governed_deal_admission_id: digest('deal'),
    precomputed_process_narration_occurrence_id: digest('narration'),
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
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
  const first = buildProcessPhrasebookResultIdentity(input());
  const second = buildProcessPhrasebookResultIdentity(input());

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(first.logical_type, 'ProcessPhrasebookPassageResult');
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_result_slot_binding_state, 'UNRESOLVED');
  assert.equal(first.selected_narration_state, 'UNRESOLVED');
  assert.equal(first.predicate_witness_state, 'UNRESOLVED');
  assert.equal(first.result_input_lineage_state, 'UNRESOLVED');
  assert.equal(first.preview_binding_state, 'UNRESOLVED');
  assert.equal(first.ordering_projection_state, 'UNRESOLVED');
  assert.equal(first.release_membership_state, 'UNRESOLVED');
  assert.deepEqual(first.authority_limits, AUTHORITY_LIMITS);
  assert.equal(validateProcessPhrasebookResultIdentity(first), first);
});

test('separates evidence-role slots and later source narrations', () => {
  const direct = buildProcessPhrasebookResultIdentity(input());
  const contextual = buildProcessPhrasebookResultIdentity(input({
    exact_evidence_role_slot_key: 'CONTEXTUAL_EVIDENCE',
    governed_ordinal: 1,
  }));
  const retelling = buildProcessPhrasebookResultIdentity(input({
    precomputed_process_narration_occurrence_id: digest('later-retelling'),
  }));

  assert.notEqual(
    direct.process_phrasebook_passage_result_id,
    contextual.process_phrasebook_passage_result_id,
  );
  assert.notEqual(
    direct.process_phrasebook_passage_result_id,
    retelling.process_phrasebook_passage_result_id,
  );
  assert.equal(Object.hasOwn(retelling, 'process_event_id'), false);
  assert.equal(Object.hasOwn(retelling, 'retelling_relationship'), false);
});

test('rejects value, text, lineage, release and ranking inputs', () => {
  for (const prohibited of [
    'application_join_order',
    'candidate_values',
    'display_text',
    'model_output',
    'query_text',
    'selected_revision_id',
    'matched_passage_preview',
    'predicate_witness_revision_id',
    'release_identity',
    'source_order',
  ]) {
    assert.throws(
      () => buildProcessPhrasebookResultIdentity(input({
        [prohibited]: 'FORGED',
      })),
      (error) => (
        error.code === 'PROCESS_PHRASEBOOK_RESULT_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(prohibited)
      ),
    );
  }
});

test('rejects extra identity fields and malformed frozen inputs', () => {
  assert.throws(
    () => buildProcessPhrasebookResultIdentity(input({ extra: true })),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessPhrasebookResultIdentity(input({
      governed_deal_admission_id: 'not-a-digest',
    })),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessPhrasebookResultIdentity(input({
      exact_evidence_role_slot_key: 'lower case',
    })),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessPhrasebookResultIdentity(input({
      exact_evidence_role_slot_key: `A${'B'.repeat(128)}`,
    })),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );
  assert.throws(
    () => buildProcessPhrasebookResultIdentity(input({
      governed_ordinal: -1,
    })),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );
});

test('rejects ID, payload, state and authority tampering', () => {
  const built = buildProcessPhrasebookResultIdentity(input());

  const wrongId = clone(built);
  wrongId.process_phrasebook_passage_result_id = digest('wrong-id');
  assert.throws(
    () => validateProcessPhrasebookResultIdentity(wrongId),
    { code: 'PROCESS_PHRASEBOOK_RESULT_ID_MISMATCH' },
  );

  const wrongPayload = clone(built);
  wrongPayload.canonical_payload_digest = digest('wrong-payload');
  assert.throws(
    () => validateProcessPhrasebookResultIdentity(wrongPayload),
    { code: 'PROCESS_PHRASEBOOK_RESULT_PAYLOAD_MISMATCH' },
  );

  const wrongState = clone(built);
  wrongState.ordering_projection_state = 'READY';
  assert.throws(
    () => validateProcessPhrasebookResultIdentity(wrongState),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );

  const wrongAuthority = clone(built);
  wrongAuthority.authority_limits.serving = 'GRANTED';
  assert.throws(
    () => validateProcessPhrasebookResultIdentity(wrongAuthority),
    { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY' },
  );
});

test('fails closed if the signed materialisation boundary drifts', () => {
  const original = resultContract.definition.ordering_contract
    .application_memory_can_recreate_ranking_authority;
  resultContract.definition.ordering_contract
    .application_memory_can_recreate_ranking_authority = true;
  try {
    assert.throws(
      () => buildProcessPhrasebookResultIdentity(input()),
      { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_CONTRACT_BINDING' },
    );
  } finally {
    resultContract.definition.ordering_contract
      .application_memory_can_recreate_ranking_authority = original;
  }
});

test('fails closed on an extra or changed signed contract field', () => {
  resultContract.definition.ordering_contract.hidden_rank_authority = true;
  try {
    assert.throws(
      () => buildProcessPhrasebookResultIdentity(input()),
      { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_CONTRACT_BINDING' },
    );
  } finally {
    delete resultContract.definition.ordering_contract.hidden_rank_authority;
  }

  const original = resultContract.definition.occurrence_identity
    .prohibited_inputs[0];
  resultContract.definition.occurrence_identity.prohibited_inputs[0] =
    'FORGED_PROHIBITION';
  try {
    assert.throws(
      () => buildProcessPhrasebookResultIdentity(input()),
      { code: 'INVALID_PROCESS_PHRASEBOOK_RESULT_CONTRACT_BINDING' },
    );
  } finally {
    resultContract.definition.occurrence_identity.prohibited_inputs[0] =
      original;
  }
});

test('grants no result materialisation, ordering, serving or release authority', () => {
  const built = buildProcessPhrasebookResultIdentity(input());

  assert.equal(Object.hasOwn(built, 'matched_passage_preview'), false);
  assert.equal(Object.hasOwn(built, 'lineage'), false);
  assert.equal(Object.hasOwn(built, 'bidder_track_id'), false);
  assert.equal(Object.hasOwn(built, 'ordering_ordinal'), false);
  assert.equal(Object.hasOwn(built, 'release_identity'), false);
  assert.deepEqual(
    Object.values(built.authority_limits),
    Object.values(built.authority_limits).map(() => 'NONE'),
  );
});
