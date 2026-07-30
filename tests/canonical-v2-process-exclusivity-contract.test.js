const assert = require('node:assert/strict');
const test = require('node:test');

const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PREDICATE_SEMANTIC_KINDS,
  buildProcessExclusivitySemanticCheck,
  validateProcessExclusivitySemanticCheck,
} = require('../lib/canonical-v2/process-exclusivity-contract');
const catalogueContract = require(
  '../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
);

function syntheticId(label) {
  return contentId('SYNTHETIC_PROCESS_EXCLUSIVITY_TEST_ID/V1', { label });
}

function input(overrides = {}) {
  return {
    predicate_key: 'EXCLUSIVITY_REQUESTED',
    predicate_version: 1,
    predicate_state: 'PRESENT',
    subject_code: 'NEGOTIATION_EXCLUSIVITY',
    atomic_response_predicate_key: null,
    source_semantic_kind: 'REQUEST',
    value_carrier_ids: [syntheticId('request-value')],
    evidence_edge_ids: [syntheticId('request-evidence')],
    complete_governed_scope: false,
    failure_detail_id: null,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('binds exactly the 41 governed exclusivity predicate semantics', () => {
  assert.deepEqual(
    Object.keys(PREDICATE_SEMANTIC_KINDS),
    catalogueContract.definition
      .ordinary_question_contract.mandatory_predicate_keys,
  );
  assert.equal(Object.keys(PREDICATE_SEMANTIC_KINDS).length, 41);
});

test('checks each successor predicate under its exact semantic kind', () => {
  const definitions = catalogueContract.definition
    .successor_predicate_definition_contract.definitions;
  assert.equal(definitions.length, 18);
  for (const definition of definitions) {
    const semanticKind =
      PREDICATE_SEMANTIC_KINDS[definition.predicate_key];
    assert.equal(
      semanticKind,
      definition.machine_rule.semantic_kind,
    );
    const result = buildProcessExclusivitySemanticCheck(input({
      predicate_key: definition.predicate_key,
      source_semantic_kind: semanticKind,
      value_carrier_ids: [syntheticId(definition.predicate_key)],
    }));
    assert.equal(result.predicate_key, definition.predicate_key);
    assert.equal(result.source_semantic_kind, semanticKind);
    assert.equal(result.catalogue_binding.catalogue_version, 2);
  }
});

test('builds a deterministic frozen checked candidate with no authority', () => {
  const first = buildProcessExclusivitySemanticCheck(input());
  const second = buildProcessExclusivitySemanticCheck(input());

  assert.deepEqual(first, second);
  assert.equal(
    first.schema_version,
    'PROCESS_EXCLUSIVITY_SEMANTIC_CHECK/V1',
  );
  assert.equal(first.semantic_check_state, 'CHECKED_CANDIDATE_ONLY');
  assert.equal(first.materialisation_state, 'DRAFT_ONLY');
  assert.equal(
    Object.values(first.authority_limits).every((value) => value === 'NONE'),
    true,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.catalogue_binding), true);
  assert.doesNotThrow(() => validateProcessExclusivitySemanticCheck(first));
});

test('keeps requests and grants distinct', () => {
  assert.throws(
    () => buildProcessExclusivitySemanticCheck(input({
      predicate_key: 'EXCLUSIVITY_GRANTED',
    })),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );

  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input({
    predicate_key: 'EXCLUSIVITY_GRANTED',
    source_semantic_kind: 'GRANT',
    value_carrier_ids: [syntheticId('grant-value')],
  })));
});

test('does not treat silence, omission or a shortened term as refusal', () => {
  for (const sourceSemanticKind of [
    'SILENCE',
    'NO_RECORDED_GRANT',
    'SHORTENED_TERM',
    'CONDITIONAL_ACCEPTANCE',
  ]) {
    assert.throws(
      () => buildProcessExclusivitySemanticCheck(input({
        predicate_key: 'EXCLUSIVITY_EXPRESS_REFUSAL',
        source_semantic_kind: sourceSemanticKind,
      })),
      (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
    );
  }
});

test('preserves one exact atomic response and subject in the union', () => {
  const result = buildProcessExclusivitySemanticCheck(input({
    predicate_key: 'EXCLUSIVITY_RESPONSE_ANY',
    subject_code: 'EXCLUSIVE_DATA_ACCESS',
    atomic_response_predicate_key: 'EXCLUSIVITY_COUNTERPROPOSAL',
    source_semantic_kind: 'COUNTERPROPOSAL',
    value_carrier_ids: [syntheticId('counterproposal-value')],
  }));

  assert.equal(
    result.atomic_response_predicate_key,
    'EXCLUSIVITY_COUNTERPROPOSAL',
  );
  assert.equal(result.source_semantic_kind, 'COUNTERPROPOSAL');
  assert.equal(result.subject_code, 'EXCLUSIVE_DATA_ACCESS');

  assert.throws(
    () => buildProcessExclusivitySemanticCheck(input({
      predicate_key: 'EXCLUSIVITY_RESPONSE_ANY',
      atomic_response_predicate_key: 'EXCLUSIVITY_EXPRESS_REFUSAL',
      source_semantic_kind: 'COUNTERPROPOSAL',
    })),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );
});

test('never collapses exclusive data access into negotiation exclusivity', () => {
  const dataAccess = buildProcessExclusivitySemanticCheck(input({
    subject_code: 'EXCLUSIVE_DATA_ACCESS',
  }));
  const negotiation = buildProcessExclusivitySemanticCheck(input({
    subject_code: 'NEGOTIATION_EXCLUSIVITY',
  }));

  assert.notEqual(
    dataAccess.canonical_payload_digest,
    negotiation.canonical_payload_digest,
  );
  assert.equal(dataAccess.subject_code, 'EXCLUSIVE_DATA_ACCESS');
  assert.equal(negotiation.subject_code, 'NEGOTIATION_EXCLUSIVITY');
});

test('requires subjects for request, response and grant findings', () => {
  for (const predicateKey of [
    'EXCLUSIVITY_REQUESTED',
    'EXCLUSIVITY_EXPRESS_REFUSAL',
    'EXCLUSIVITY_COUNTERPROPOSAL',
    'EXCLUSIVITY_CONDITIONAL_ACCEPTANCE',
    'EXCLUSIVITY_RESPONSE_ANY',
    'EXCLUSIVITY_GRANTED',
  ]) {
    const atomicResponsePredicateKey = predicateKey === 'EXCLUSIVITY_RESPONSE_ANY'
      ? 'EXCLUSIVITY_EXPRESS_REFUSAL'
      : null;
    const sourceSemanticKind = predicateKey === 'EXCLUSIVITY_RESPONSE_ANY'
      ? 'EXPRESS_REFUSAL'
      : PREDICATE_SEMANTIC_KINDS[predicateKey];
    assert.throws(
      () => buildProcessExclusivitySemanticCheck(input({
        predicate_key: predicateKey,
        subject_code: null,
        atomic_response_predicate_key: atomicResponsePredicateKey,
        source_semantic_kind: sourceSemanticKind,
      })),
      (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
    );
  }
});

test('enforces the exact value and evidence rules for every state', () => {
  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input()));

  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input({
    predicate_state: 'ABSENT',
    source_semantic_kind: null,
    value_carrier_ids: [],
    complete_governed_scope: true,
  })));

  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input({
    predicate_state: 'NOT_APPLICABLE',
    source_semantic_kind: null,
    value_carrier_ids: [],
  })));

  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input({
    predicate_state: 'NOT_EXAMINED',
    subject_code: null,
    source_semantic_kind: null,
    value_carrier_ids: [],
    evidence_edge_ids: [],
  })));

  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input({
    predicate_state: 'FAILED',
    subject_code: null,
    source_semantic_kind: null,
    value_carrier_ids: [],
    evidence_edge_ids: [],
    failure_detail_id: syntheticId('failure-detail'),
  })));

  const invalid = [
    input({ value_carrier_ids: [] }),
    input({ evidence_edge_ids: [] }),
    input({
      predicate_state: 'ABSENT',
      source_semantic_kind: null,
      value_carrier_ids: [],
      complete_governed_scope: false,
    }),
    input({
      predicate_state: 'NOT_APPLICABLE',
      source_semantic_kind: null,
      value_carrier_ids: [],
      evidence_edge_ids: [],
    }),
    input({
      predicate_state: 'NOT_EXAMINED',
      subject_code: null,
      source_semantic_kind: null,
      value_carrier_ids: [],
    }),
    input({
      predicate_state: 'FAILED',
      subject_code: null,
      source_semantic_kind: null,
      value_carrier_ids: [],
      evidence_edge_ids: [],
    }),
  ];
  for (const value of invalid) {
    assert.throws(
      () => buildProcessExclusivitySemanticCheck(value),
      (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
    );
  }
});

test('requires the response union constituent only on the union predicate', () => {
  assert.throws(
    () => buildProcessExclusivitySemanticCheck(input({
      predicate_key: 'EXCLUSIVITY_RESPONSE_ANY',
      source_semantic_kind: 'RESPONSE_UNION',
    })),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );
  assert.throws(
    () => buildProcessExclusivitySemanticCheck(input({
      atomic_response_predicate_key: 'EXCLUSIVITY_GRANTED',
    })),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );
  assert.doesNotThrow(() => buildProcessExclusivitySemanticCheck(input({
    predicate_key: 'EXCLUSIVITY_RESPONSE_ANY',
    predicate_state: 'ABSENT',
    source_semantic_kind: null,
    value_carrier_ids: [],
    complete_governed_scope: true,
  })));
  assert.throws(
    () => buildProcessExclusivitySemanticCheck(input({
      predicate_key: 'EXCLUSIVITY_RESPONSE_ANY',
      predicate_state: 'ABSENT',
      atomic_response_predicate_key: 'EXCLUSIVITY_GRANTED',
      source_semantic_kind: null,
      value_carrier_ids: [],
      complete_governed_scope: true,
    })),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );
});

test('rejects unknown, extra, duplicated and ungoverned inputs', () => {
  const invalid = [
    input({ predicate_key: 'EXCLUSIVITY_DECLINED_BY_OMISSION' }),
    input({ predicate_version: 2 }),
    input({ predicate_state: 'UNKNOWN' }),
    input({ subject_code: 'GENERAL_EXCLUSIVITY' }),
    input({
      evidence_edge_ids: [
        syntheticId('duplicate'),
        syntheticId('duplicate'),
      ],
    }),
    { ...input(), model_output: 'grant' },
  ];
  for (const value of invalid) {
    assert.throws(
      () => buildProcessExclusivitySemanticCheck(value),
      (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
    );
  }
});

test('rejects tampered checked carriers, including rehashed semantic drift', () => {
  const original = buildProcessExclusivitySemanticCheck(input());
  const tampered = clone(original);
  tampered.source_semantic_kind = 'GRANT';
  assert.throws(
    () => validateProcessExclusivitySemanticCheck(tampered),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );

  const rehashed = clone(original);
  rehashed.predicate_key = 'EXCLUSIVITY_GRANTED';
  const payload = clone(rehashed);
  delete payload.canonical_payload_digest;
  rehashed.canonical_payload_digest = contentId(
    'PROCESS_EXCLUSIVITY_SEMANTIC_CHECK_PAYLOAD/V1',
    payload,
  );
  assert.throws(
    () => validateProcessExclusivitySemanticCheck(rehashed),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );
});

test('the catalogue binding is content-addressed and cannot be substituted', () => {
  const result = buildProcessExclusivitySemanticCheck(input());
  assert.equal(
    result.catalogue_binding.catalogue_stable_id,
    'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  );
  assert.match(
    result.catalogue_binding.catalogue_contract_digest,
    /^[a-f0-9]{64}$/,
  );

  const substituted = clone(result);
  substituted.catalogue_binding.catalogue_version = 1;
  assert.throws(
    () => validateProcessExclusivitySemanticCheck(substituted),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_SEMANTIC_CHECK',
  );
});
