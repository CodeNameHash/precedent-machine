const assert = require('node:assert/strict');
const test = require('node:test');

const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  ENDPOINT_DEFINITIONS,
  buildProcessRelationshipIdentity,
  validateProcessRelationshipIdentity,
} = require('../lib/canonical-v2/process-relationship');
const relationshipContract = require(
  '../contracts/canonical-v2/successor/process/relationships/process-relationship.v1.json',
);

function syntheticId(label) {
  return contentId('SYNTHETIC_PROCESS_RELATIONSHIP_TEST_ID/V1', { label });
}

const FROZEN_PAIR = syntheticId('frozen-pair');
const DEAL = syntheticId('deal');

function endpoint(logicalType, label, overrides = {}) {
  return {
    logical_type: logicalType,
    definition_stable_id: ENDPOINT_DEFINITIONS[logicalType],
    stable_object_id: syntheticId(label),
    frozen_contract_pair_digest: FROZEN_PAIR,
    governed_deal_admission_id: DEAL,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_PAIR,
    governed_deal_admission_id: DEAL,
    relationship_definition_key_and_version: {
      definition_key: 'PROCESS_RELATIONSHIP',
      definition_version: 1,
    },
    source_process_object_kind_and_id:
      endpoint('ProcessEvent', 'source-event'),
    target_process_object_kind_and_id:
      endpoint('ProcessParticipant', 'target-participant'),
    process_relationship_slot_key: 'EVENT_RESPONSE_TARGET_001',
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the seven signed ProcessRelationship identity inputs', () => {
  assert.deepEqual(
    Object.keys(input()),
    relationshipContract.definition.relationship_identity.stable_id_inputs,
  );
});

test('builds one deterministic identity without materialising a relationship', () => {
  const first = buildProcessRelationshipIdentity(input());
  const second = buildProcessRelationshipIdentity(input());

  assert.deepEqual(first, second);
  assert.equal(
    first.schema_version,
    'PROCESS_RELATIONSHIP_IDENTITY/V1',
  );
  assert.equal(first.logical_type, 'ProcessRelationship');
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_occurrence_slot_binding_state, 'UNRESOLVED');
  assert.equal(first.endpoint_binding_state, 'UNRESOLVED');
  assert.equal(first.relationship_type_registry_state, 'UNRESOLVED');
  assert.equal(
    Object.values(first.authority_limits).every((value) => value === 'NONE'),
    true,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.source_process_object_kind_and_id), true);
  assert.doesNotThrow(() => validateProcessRelationshipIdentity(first));
});

test('accepts every closed endpoint logical type with its matching definition', () => {
  for (const [logicalType, definitionStableId] of Object.entries(
    ENDPOINT_DEFINITIONS,
  )) {
    const result = buildProcessRelationshipIdentity(input({
      target_process_object_kind_and_id:
        endpoint(logicalType, `target-${logicalType}`),
    }));
    assert.equal(
      result.target_process_object_kind_and_id.definition_stable_id,
      definitionStableId,
    );
  }
});

test('direction remains part of identity', () => {
  const forwardInput = input();
  const reverseInput = input({
    source_process_object_kind_and_id:
      forwardInput.target_process_object_kind_and_id,
    target_process_object_kind_and_id:
      forwardInput.source_process_object_kind_and_id,
  });
  const forward = buildProcessRelationshipIdentity(forwardInput);
  const reverse = buildProcessRelationshipIdentity(reverseInput);

  assert.notEqual(
    forward.process_relationship_id,
    reverse.process_relationship_id,
  );
  assert.deepEqual(
    forward.source_process_object_kind_and_id,
    reverse.target_process_object_kind_and_id,
  );
});

test('rejects self relationships', () => {
  const source = endpoint('ProcessEvent', 'same-event');
  assert.throws(
    () => buildProcessRelationshipIdentity(input({
      source_process_object_kind_and_id: source,
      target_process_object_kind_and_id: clone(source),
    })),
    (error) => error.code === 'PROCESS_RELATIONSHIP_SELF_ENDPOINT',
  );
});

test('rejects cross-deal and cross-contract endpoints', () => {
  for (const changedEndpoint of [
    endpoint('ProcessParticipant', 'target', {
      governed_deal_admission_id: syntheticId('other-deal'),
    }),
    endpoint('ProcessParticipant', 'target', {
      frozen_contract_pair_digest: syntheticId('other-contract-pair'),
    }),
  ]) {
    assert.throws(
      () => buildProcessRelationshipIdentity(input({
        target_process_object_kind_and_id: changedEndpoint,
      })),
      (error) => error.code === 'PROCESS_RELATIONSHIP_ENDPOINT_SCOPE_MISMATCH',
    );
  }
});

test('rejects unknown, mismatched and free-text endpoint types', () => {
  const invalidEndpoints = [
    {
      ...endpoint('ProcessParticipant', 'target'),
      logical_type: 'Deal',
      definition_stable_id: 'DEAL',
    },
    {
      ...endpoint('ProcessParticipant', 'target'),
      definition_stable_id: 'PROCESS_EVENT',
    },
    {
      ...endpoint('ProcessParticipant', 'target'),
      display_label: 'Target',
    },
  ];
  for (const target of invalidEndpoints) {
    assert.throws(
      () => buildProcessRelationshipIdentity(input({
        target_process_object_kind_and_id: target,
      })),
      (error) => error.code === 'INVALID_PROCESS_RELATIONSHIP_ENDPOINT',
    );
  }
});

test('relationship values and revisions cannot define stable identity', () => {
  for (const [key, value] of [
    ['candidate_values', { type: 'RESPONSE' }],
    ['evidence_edges', [syntheticId('evidence')]],
    ['extracted_attributes', { response: true }],
    ['model_output', 'same relationship'],
    ['relationship_effect', { effect: 'RESPONDS_TO' }],
    ['relationship_state', 'PRESENT'],
    ['relationship_type_code', 'RESPONSE'],
    ['source_revision_id', syntheticId('source-revision')],
    ['target_revision_id', syntheticId('target-revision')],
    ['temporal_expression_revision_id', syntheticId('time-revision')],
  ]) {
    assert.throws(
      () => buildProcessRelationshipIdentity({
        ...input(),
        [key]: value,
      }),
      (error) => error.code === 'PROCESS_RELATIONSHIP_VALUE_DERIVED_IDENTITY',
    );
  }
});

test('rejects an ungoverned definition, slot and ordinal', () => {
  const invalid = [
    input({
      relationship_definition_key_and_version: {
        definition_key: 'RESPONSE',
        definition_version: 1,
      },
    }),
    input({ process_relationship_slot_key: 'free text slot' }),
    input({ process_relationship_slot_key: `A${'B'.repeat(128)}` }),
    input({ governed_ordinal: -1 }),
    input({ governed_ordinal: 1.5 }),
  ];
  for (const value of invalid) {
    assert.throws(
      () => buildProcessRelationshipIdentity(value),
      (error) => error.code === 'INVALID_PROCESS_RELATIONSHIP_IDENTITY',
    );
  }
});

test('stable IDs, not endpoint revision IDs, define identity', () => {
  const value = input();
  value.source_process_object_kind_and_id.source_revision_id =
    syntheticId('source-revision');
  assert.throws(
    () => buildProcessRelationshipIdentity(value),
    (error) => error.code === 'INVALID_PROCESS_RELATIONSHIP_ENDPOINT',
  );
});

test('tampered IDs, payloads and boundary states fail closed', () => {
  const original = buildProcessRelationshipIdentity(input());
  const mutations = [
    ['process_relationship_id', syntheticId('forged-relationship')],
    ['canonical_payload_digest', syntheticId('forged-payload')],
    ['materialisation_state', 'MATERIALISED'],
    ['endpoint_binding_state', 'BOUND'],
    ['relationship_type_registry_state', 'ADMITTED'],
  ];
  for (const [key, value] of mutations) {
    const tampered = clone(original);
    tampered[key] = value;
    assert.throws(
      () => validateProcessRelationshipIdentity(tampered),
      (error) => error.code.startsWith('INVALID_PROCESS_RELATIONSHIP')
        || error.code.startsWith('PROCESS_RELATIONSHIP'),
    );
  }
});

test('an unresolved identity cannot grant runtime, write or release authority', () => {
  const result = buildProcessRelationshipIdentity(input());
  assert.deepEqual(result.authority_limits, {
    execution: 'NONE',
    endpoint_resolution: 'NONE',
    relationship_type: 'NONE',
    relationship_revision: 'NONE',
    occurrence_slot_resolution: 'NONE',
    materialisation: 'NONE',
    writer: 'NONE',
    serving: 'NONE',
    release: 'NONE',
    canonical_write: 'NONE',
    database_write: 'NONE',
    import: 'NONE',
    activation: 'NONE',
  });
  assert.equal(Object.hasOwn(result, 'relationship_type_code'), false);
  assert.equal(Object.hasOwn(result, 'relationship_effect'), false);
  assert.equal(Object.hasOwn(result, 'evidence_edges'), false);
});
