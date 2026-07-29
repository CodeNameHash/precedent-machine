const assert = require('node:assert/strict');
const test = require('node:test');

const {
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildLosslessTemporalExpressionDraft,
  buildProcessTemporalExpressionIdentity,
  validateLosslessTemporalExpressionDraft,
  validateProcessTemporalExpressionIdentity,
} = require('../lib/canonical-v2/process-temporal-expression');
const temporalContract = require(
  '../contracts/canonical-v2/successor/shared/temporal/temporal-expression.v1.json',
);

const TEMPORAL_DEFINITION = Object.freeze({
  definition_key: 'TEMPORAL_EXPRESSION',
  definition_version: 1,
});

function syntheticId(label) {
  return contentId('SYNTHETIC_TEMPORAL_EXPRESSION_TEST_ID/V1', { label });
}

function identityInput(overrides = {}) {
  return {
    admitted_source_occurrence_id: syntheticId('source-occurrence'),
    expected_temporal_slot_key: 'PROCESS_EVENT_TIME_001',
    governed_ordinal: 0,
    governed_subject_id: syntheticId('process-event'),
    governed_subject_type: 'PROCESS_EVENT',
    temporal_definition_and_version: TEMPORAL_DEFINITION,
    ...overrides,
  };
}

function draftInput(overrides = {}) {
  const temporalExpressionIdentity = overrides.temporal_expression_identity
    || buildProcessTemporalExpressionIdentity(identityInput());
  const rawSourceExpression = overrides.raw_source_expression
    || '  until 11:59 p.m. New York City time on 4 July 2026  ';
  const absoluteStart = 700;
  const sourceBytes = Buffer.from(rawSourceExpression, 'utf8');
  return {
    temporal_expression_identity: temporalExpressionIdentity,
    coarse_temporal_state: 'EXPLICIT_DATE',
    raw_source_expression: rawSourceExpression,
    source_interval: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      admitted_source_occurrence_id:
        temporalExpressionIdentity.admitted_source_occurrence_id,
      document_hash: syntheticId('document'),
      absolute_start: absoluteStart,
      absolute_end: absoluteStart + sourceBytes.length,
      exact_bytes_digest: sha256Hex(sourceBytes),
      evidence_edge_id: syntheticId('evidence-edge'),
    },
    structured_nodes: [],
    computed_value: null,
    computed_derivation: null,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the signed TemporalExpression identity inputs', () => {
  assert.deepEqual(
    Object.keys(identityInput()),
    temporalContract.definition.occurrence_identity.stable_id_inputs,
  );
});

test('builds a deterministic identity without using temporal values', () => {
  const first = buildProcessTemporalExpressionIdentity(identityInput());
  const second = buildProcessTemporalExpressionIdentity(identityInput());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'TEMPORAL_EXPRESSION_IDENTITY/V1');
  assert.equal(first.logical_type, 'TemporalExpression');
  assert.equal(
    first.temporal_expression_id,
    contentId('TEMPORAL_EXPRESSION/V1', identityInput()),
  );
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_occurrence_slot_binding_state, 'UNRESOLVED');
  assert.equal(Object.isFrozen(first), true);
  assert.doesNotThrow(() => validateProcessTemporalExpressionIdentity(first));

  for (const key of temporalContract.definition.occurrence_identity.prohibited_inputs) {
    assert.throws(
      () => buildProcessTemporalExpressionIdentity({
        ...identityInput(),
        [key]: 'forbidden',
      }),
      (error) => error.code === 'TEMPORAL_EXPRESSION_UNGOVERNED_INTERPRETATION'
        || error.code === 'INVALID_TEMPORAL_EXPRESSION_IDENTITY',
    );
  }
});

test('preserves exact temporal words, spacing, case and UTF-8 source coordinates', () => {
  const input = draftInput();
  const draft = buildLosslessTemporalExpressionDraft(input);

  assert.equal(draft.raw_source_expression, input.raw_source_expression);
  assert.deepEqual(draft.source_interval, input.source_interval);
  assert.equal(draft.state, 'PRESENT');
  assert.equal(draft.coarse_temporal_state, 'EXPLICIT_DATE');
  assert.equal(draft.materialisation_state, 'DRAFT_ONLY');
  assert.equal(Object.hasOwn(draft, 'temporal_expression_revision_id'), false);
  assert.equal(Object.isFrozen(draft), true);
  assert.equal(Object.isFrozen(draft.source_interval), true);
  assert.doesNotThrow(() => validateLosslessTemporalExpressionDraft(draft));
});

test('records all four coarse states without creating an interpretation', () => {
  for (const state of [
    'EXPLICIT_DATE',
    'STATED_DURATION',
    'RELATIVE_OR_CONDITIONAL',
    'UNRESOLVED',
  ]) {
    const draft = buildLosslessTemporalExpressionDraft(draftInput({
      coarse_temporal_state: state,
    }));
    assert.equal(draft.coarse_temporal_state, state);
    assert.deepEqual(draft.structured_nodes, []);
    assert.equal(draft.computed_value, null);
    assert.equal(draft.computed_derivation, null);
  }
});

test('keeps a duration in hours lossless instead of silently converting it', () => {
  const raw = '24 hours after receipt of the proposal';
  const draft = buildLosslessTemporalExpressionDraft(draftInput({
    coarse_temporal_state: 'RELATIVE_OR_CONDITIONAL',
    raw_source_expression: raw,
    source_interval: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      admitted_source_occurrence_id: syntheticId('source-occurrence'),
      document_hash: syntheticId('document'),
      absolute_start: 40,
      absolute_end: 40 + Buffer.byteLength(raw, 'utf8'),
      exact_bytes_digest: sha256Hex(raw),
      evidence_edge_id: syntheticId('hours-evidence'),
    },
  }));

  assert.equal(draft.raw_source_expression, raw);
  assert.equal(draft.coarse_temporal_state, 'RELATIVE_OR_CONDITIONAL');
  assert.equal(Object.hasOwn(draft, 'duration_days'), false);
  assert.equal(Object.hasOwn(draft, 'normalised_duration'), false);
});

test('rejects structured nodes and computed values while the registry is empty', () => {
  assert.deepEqual(
    temporalContract.definition.type_contract.structured_node_registry,
    [],
  );

  assert.throws(
    () => buildLosslessTemporalExpressionDraft(draftInput({
      structured_nodes: [{ node_kind: 'DURATION', value: 4 }],
    })),
    (error) => error.code === 'INVALID_TEMPORAL_EXPRESSION_DRAFT',
  );
  assert.throws(
    () => buildLosslessTemporalExpressionDraft(draftInput({
      computed_value: '2026-07-04',
      computed_derivation: { operation: 'ADD_DAYS' },
    })),
    (error) => error.code === 'TEMPORAL_EXPRESSION_COMPUTATION_NOT_ADMITTED',
  );
});

test('rejects source occurrence, length and exact-byte mismatches', () => {
  const base = draftInput();
  const mismatches = [
    {
      expected: 'TEMPORAL_EXPRESSION_SOURCE_OCCURRENCE_MISMATCH',
      source_interval: {
        ...base.source_interval,
        admitted_source_occurrence_id: syntheticId('other-source'),
      },
    },
    {
      expected: 'TEMPORAL_EXPRESSION_SOURCE_LENGTH_MISMATCH',
      source_interval: {
        ...base.source_interval,
        absolute_end: base.source_interval.absolute_end + 1,
      },
    },
    {
      expected: 'TEMPORAL_EXPRESSION_SOURCE_BYTES_MISMATCH',
      source_interval: {
        ...base.source_interval,
        exact_bytes_digest: syntheticId('different-bytes'),
      },
    },
  ];

  for (const mismatch of mismatches) {
    assert.throws(
      () => buildLosslessTemporalExpressionDraft({
        ...base,
        source_interval: mismatch.source_interval,
      }),
      (error) => error.code === mismatch.expected,
    );
  }
});

test('rejects undeclared normalisation, inference and model fields', () => {
  for (const key of [
    'business_day_basis',
    'duration_days',
    'model_output',
    'normalised_date',
    'normalised_duration',
    'resolved_value',
    'timezone',
  ]) {
    assert.throws(
      () => buildLosslessTemporalExpressionDraft({
        ...draftInput(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'TEMPORAL_EXPRESSION_UNGOVERNED_INTERPRETATION'
        && error.details.prohibited_inputs.includes(key)
      ),
    );
  }
});

test('detects identity, draft, payload and authority mutations', () => {
  const identity = clone(buildProcessTemporalExpressionIdentity(identityInput()));
  identity.governed_ordinal = 1;
  assert.throws(
    () => validateProcessTemporalExpressionIdentity(identity),
    (error) => error.code === 'TEMPORAL_EXPRESSION_ID_MISMATCH',
  );

  const changedIdentityAuthority = clone(
    buildProcessTemporalExpressionIdentity(identityInput()),
  );
  changedIdentityAuthority.authority_limits.writer = 'ALLOWED';
  assert.throws(
    () => validateProcessTemporalExpressionIdentity(changedIdentityAuthority),
    (error) => error.code === 'INVALID_TEMPORAL_EXPRESSION_IDENTITY',
  );

  const draft = clone(buildLosslessTemporalExpressionDraft(draftInput()));
  draft.coarse_temporal_state = 'STATED_DURATION';
  assert.throws(
    () => validateLosslessTemporalExpressionDraft(draft),
    (error) => error.code === 'TEMPORAL_EXPRESSION_DRAFT_PAYLOAD_MISMATCH',
  );

  const changedDraftAuthority = clone(
    buildLosslessTemporalExpressionDraft(draftInput()),
  );
  changedDraftAuthority.authority_limits.computation = 'ALLOWED';
  assert.throws(
    () => validateLosslessTemporalExpressionDraft(changedDraftAuthority),
    (error) => error.code === 'INVALID_TEMPORAL_EXPRESSION_DRAFT',
  );
});

test('grants no extraction, interpretation, computation, write or release authority', () => {
  const draft = buildLosslessTemporalExpressionDraft(draftInput());

  assert.deepEqual(draft.authority_limits, {
    execution: 'NONE',
    extraction: 'NONE',
    expected_occurrence_slot_binding: 'NONE',
    structured_interpretation: 'NONE',
    computation: 'NONE',
    revision: 'NONE',
    writer: 'NONE',
    serving: 'NONE',
    release: 'NONE',
    canonical_write: 'NONE',
    database_write: 'NONE',
    import: 'NONE',
    activation: 'NONE',
  });
});
