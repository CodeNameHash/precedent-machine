'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateSyntheticExpressionEvidence,
} = require('../lib/canonical-v2/m7-v2-contract');
const {
  compileSyntheticProfileExpression,
} = require('../lib/canonical-v2/m7-v2-deterministic-generator');

const REPO_ROOT = join(__dirname, '..');
const TEMPORAL_PHASE1_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-temporal-phase1-authority.json';
const CII_SIGNATURE = 'ON_OR_BEFORE(INTENT_ADVANCE_NOTICE_EVENT,'
  + 'OFFSET_BEFORE(TERMINATION_EXERCISE_EVENT_REFERENCE,INTENT_NOTICE_LEAD_PERIOD))';

function temporalPhase1Authority() {
  const bytes = readFileSync(join(REPO_ROOT, TEMPORAL_PHASE1_AUTHORITY_PATH));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    binding: {
      byte_length: bytes.length,
      path: TEMPORAL_PHASE1_AUTHORITY_PATH,
      record_id: record.temporal_phase1_authority_id,
      record_id_field: 'temporal_phase1_authority_id',
      schema_version: record.schema_version,
      sha256: sha256Hex(bytes),
    },
    record,
  };
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function restampTemporalPhase1Authority(envelope) {
  const unsigned = { ...envelope.record };
  delete unsigned.temporal_phase1_authority_id;
  envelope.record.temporal_phase1_authority_id = contentId(
    envelope.record.schema_version,
    unsigned,
  );
  const bytes = Buffer.from(`${canonicalJson(envelope.record)}\n`, 'utf8');
  envelope.binding.record_id = envelope.record.temporal_phase1_authority_id;
  envelope.binding.byte_length = bytes.length;
  envelope.binding.sha256 = sha256Hex(bytes);
  return envelope;
}

function span(sourceText, spanId, text, from = 0) {
  const characterStart = sourceText.indexOf(text, from);
  assert.notEqual(characterStart, -1, `missing source text: ${text}`);
  const startByte = Buffer.byteLength(sourceText.slice(0, characterStart), 'utf8');
  return {
    span_id: spanId,
    start_byte: startByte,
    end_byte: startByte + Buffer.byteLength(text, 'utf8'),
  };
}

function validNestedEvidence() {
  const sourceText = 'A and (i) B and (ii) C or D';
  const firstAnd = sourceText.indexOf('and');
  const secondAnd = sourceText.indexOf('and', firstAnd + 1);
  const spans = [
    span(sourceText, 'span:a', 'A'),
    span(sourceText, 'span:root-and-1', 'and'),
    span(sourceText, 'span:marker-1', '(i)'),
    span(sourceText, 'span:b', 'B'),
    span(sourceText, 'span:root-and-2', 'and', secondAnd),
    span(sourceText, 'span:marker-2', '(ii)'),
    span(sourceText, 'span:c', 'C'),
    span(sourceText, 'span:child-or', 'or'),
    span(sourceText, 'span:d', 'D'),
  ];
  return {
    source_text: sourceText,
    source_spans: spans,
    facts: [
      { fact_id: 'fact:a', source_support_ids: ['span:a'] },
      { fact_id: 'fact:b', source_support_ids: ['span:b'] },
      { fact_id: 'fact:c', source_support_ids: ['span:c'] },
      { fact_id: 'fact:d', source_support_ids: ['span:d'] },
    ],
    expressions: [
      {
        expression_id: 'expression:root',
        operator: 'ALL_OF',
        children: [
          { kind: 'FACT', id: 'fact:a' },
          { kind: 'FACT', id: 'fact:b' },
          { kind: 'EXPRESSION', id: 'expression:child' },
        ],
        connective_span_ids: ['span:root-and-1', 'span:root-and-2'],
        authored_limb_marker_span_ids: ['span:marker-1', 'span:marker-2'],
        scope_span_ids: spans.map((entry) => entry.span_id),
      },
      {
        expression_id: 'expression:child',
        operator: 'ANY_OF',
        children: [
          { kind: 'FACT', id: 'fact:c' },
          { kind: 'FACT', id: 'fact:d' },
        ],
        connective_span_ids: ['span:child-or'],
        authored_limb_marker_span_ids: [],
        scope_span_ids: ['span:c', 'span:child-or', 'span:d'],
      },
    ],
  };
}

test('nested-expression evidence rejects the same child kind and ID twice', () => {
  const input = validNestedEvidence();
  input.expressions[0].children[1].id = 'fact:a';

  assert.throws(
    () => validateSyntheticExpressionEvidence(input),
    (error) => error.code === 'M7_V2_EXPRESSION_TOPOLOGY'
      && /duplicate child FACT:fact:a/u.test(error.message),
  );
});

test('nested-expression evidence requires connector, marker, and scope arrays in source order', () => {
  for (const field of [
    'connective_span_ids',
    'authored_limb_marker_span_ids',
    'scope_span_ids',
  ]) {
    const input = validNestedEvidence();
    input.expressions[0][field].reverse();

    assert.throws(
      () => validateSyntheticExpressionEvidence(input),
      (error) => error.code === 'M7_V2_EXPRESSION_PROVENANCE'
        && /source spans are not in document order/u.test(error.message),
      field,
    );
  }
});

test('an expression scope contains its own and all descendant evidence', () => {
  for (const omittedSpanId of ['span:root-and-1', 'span:c', 'span:child-or']) {
    const input = validNestedEvidence();
    input.expressions[0].scope_span_ids = input.expressions[0].scope_span_ids.filter(
      (spanId) => spanId !== omittedSpanId,
    );

    assert.throws(
      () => validateSyntheticExpressionEvidence(input),
      (error) => error.code === 'M7_V2_EXPRESSION_PROVENANCE'
        && /scope omits required evidence span/u.test(error.message),
      omittedSpanId,
    );
  }
});

test('synthetic evidence treats explicit undefined Phase 1 authority as absent', () => {
  const input = validNestedEvidence();
  input.temporalPhase1Authority = undefined;

  assert.equal(validateSyntheticExpressionEvidence(input).status, 'PASS');
});

function validTemporalPhase1CiiEvidence() {
  const temporalPhase1AuthorityEnvelope = temporalPhase1Authority();
  const referenceContract =
    temporalPhase1AuthorityEnvelope.record.policy_overlay.event_reference_contract;
  const authoritySupport = new Map(
    temporalPhase1AuthorityEnvelope.record.red_hat_source_authority.exact_support_spans
      .map(({ label, source_span: sourceSpan }) => [label, sourceSpan]),
  );
  const sourceText = [
    'TERMINATION_EXERCISE_NOTICE_EVENT',
    'INTENT_NOTICE_EVENT',
    'INTENT_ADVANCE_NOTICE_EVENT',
    'ON_OR_BEFORE',
    'TERMINATION_EXERCISE_EVENT_REFERENCE',
    'OFFSET_BEFORE',
    'at least one (1) Business Day',
  ].join(' | ');
  const ownerSemanticFactKey = '1'.repeat(64);
  const intentSemanticFactKey = '2'.repeat(64);

  const evidence = {
    temporalPhase1Authority: temporalPhase1AuthorityEnvelope,
    source_text: sourceText,
    source_spans: [
      span(sourceText, 'span:exercise-owner', 'TERMINATION_EXERCISE_NOTICE_EVENT'),
      span(sourceText, 'span:intent-notice', 'INTENT_NOTICE_EVENT'),
      span(sourceText, 'span:advance-intent', 'INTENT_ADVANCE_NOTICE_EVENT'),
      span(sourceText, 'span:on-or-before', 'ON_OR_BEFORE'),
      span(sourceText, 'span:exercise-reference', 'TERMINATION_EXERCISE_EVENT_REFERENCE'),
      span(sourceText, 'span:offset-before', 'OFFSET_BEFORE'),
      span(sourceText, 'span:lead-period', 'at least one (1) Business Day'),
    ],
    facts: [
      {
        fact_id: 'fact:exercise-owner',
        semantic_fact_key: ownerSemanticFactKey,
        owner_rule_id: 'rule:chapeau-owner',
        source_node_occurrence_id: referenceContract.owner_node_occurrence_id,
        field_key: referenceContract.owner_fact_field_key,
        value_type: 'ENUM',
        typed_value: 'TERMINATION_EXERCISE_NOTICE',
        normalisation_rule_id: 'ENUM_LITERAL_MAP/V1',
        source_support_ids: ['span:exercise-owner'],
        authority_source_support: referenceContract.owner_support,
      },
      {
        fact_id: 'fact:intent-notice',
        semantic_fact_key: intentSemanticFactKey,
        owner_rule_id: 'rule:intent-notice',
        source_node_occurrence_id: referenceContract.intent_notice_source_node_occurrence_id,
        field_key: 'INTENT_NOTICE_EVENT',
        value_type: 'ENUM',
        typed_value: 'INTENT_TO_TERMINATE_NOTICE',
        normalisation_rule_id: 'ENUM_LITERAL_MAP/V1',
        source_support_ids: ['span:intent-notice'],
        authority_source_support: referenceContract.intent_notice_support,
      },
      {
        fact_id: 'fact:advance-intent',
        semantic_fact_key: '3'.repeat(64),
        owner_rule_id: 'rule:qualification',
        source_node_occurrence_id: referenceContract.consumer_node_occurrence_id,
        field_key: 'INTENT_ADVANCE_NOTICE_EVENT',
        value_type: 'ENUM',
        typed_value: 'INTENT_TO_TERMINATE_NOTICE',
        normalisation_rule_id: 'ENUM_LITERAL_MAP/V1',
        source_support_ids: ['span:advance-intent'],
        authority_source_support: authoritySupport.get('CII_ADVANCE_NOTICE_TIMING'),
      },
      {
        fact_id: 'fact:exercise-reference',
        semantic_fact_key: '4'.repeat(64),
        owner_rule_id: 'rule:qualification',
        source_node_occurrence_id: referenceContract.consumer_node_occurrence_id,
        field_key: referenceContract.consumer_fact_field_key,
        value_type: referenceContract.consumer_fact_value_type,
        typed_value: ownerSemanticFactKey,
        normalisation_rule_id: referenceContract.edge_rule_id,
        source_support_ids: ['span:exercise-reference'],
        authority_source_support: referenceContract.consumer_reference_support,
      },
      {
        fact_id: 'fact:lead-period',
        semantic_fact_key: '5'.repeat(64),
        owner_rule_id: 'rule:qualification',
        source_node_occurrence_id: referenceContract.consumer_node_occurrence_id,
        field_key: 'INTENT_NOTICE_LEAD_PERIOD',
        value_type: 'DURATION',
        typed_value: { bound_type: 'AT_LEAST', count: 1, unit: 'BUSINESS_DAY' },
        normalisation_rule_id: 'DURATION_PARSER/V2',
        source_support_ids: ['span:lead-period'],
        authority_source_support: authoritySupport.get('CII_ONE_BUSINESS_DAY'),
      },
    ],
    expressions: [
      {
        expression_id: 'expression:on-or-before',
        operator: 'ON_OR_BEFORE',
        result_kind: 'LOGICAL',
        children: [
          { kind: 'FACT', id: 'fact:advance-intent', ordinal: 1, role: 'SUBJECT_EVENT' },
          {
            kind: 'EXPRESSION',
            id: 'expression:offset-before',
            ordinal: 2,
            role: 'TEMPORAL_BOUNDARY',
          },
        ],
        parent_expression_id: null,
        connective_span_ids: ['span:on-or-before'],
        authored_limb_marker_span_ids: [],
        scope_span_ids: [
          'span:advance-intent',
          'span:on-or-before',
          'span:exercise-reference',
          'span:offset-before',
          'span:lead-period',
        ],
      },
      {
        expression_id: 'expression:offset-before',
        operator: 'OFFSET_BEFORE',
        result_kind: 'TEMPORAL',
        children: [
          { kind: 'FACT', id: 'fact:exercise-reference', ordinal: 1, role: 'ANCHOR' },
          { kind: 'FACT', id: 'fact:lead-period', ordinal: 2, role: 'OFFSET_AMOUNT' },
        ],
        parent_expression_id: 'expression:on-or-before',
        connective_span_ids: ['span:offset-before'],
        authored_limb_marker_span_ids: [],
        scope_span_ids: [
          'span:exercise-reference',
          'span:offset-before',
          'span:lead-period',
        ],
      },
    ],
    links: [
      {
        link_id: 'link:exercise-event',
        edge_rule_id: referenceContract.edge_rule_id,
        edge_type: referenceContract.edge_type,
        state: 'RESOLVED',
        consumer_rule_id: 'rule:qualification',
        consumer_fact_id: 'fact:exercise-reference',
        consumer_dependency_id: 'dependency:exercise-event',
        consumer_context_edge_id: 'context-edge:exercise-event',
        owner_rule_id: 'rule:chapeau-owner',
        owner_fact_id: 'fact:exercise-owner',
        target_semantic_fact_key: ownerSemanticFactKey,
        source_support_ids: ['span:exercise-reference'],
      },
    ],
  };
  return evidence;
}

test('synthetic Phase 1 Red Hat 7.01(c)(ii) keeps intent notice distinct from termination exercise', () => {
  const evidence = validTemporalPhase1CiiEvidence();
  const result = validateSyntheticExpressionEvidence(evidence);

  assert.equal(result.status, 'PASS');
  assert.equal(result.expression_signature, CII_SIGNATURE);
  assert.equal(result.cross_rule_event_reference_count, 1);
  assert.notEqual(
    evidence.facts.find((fact) => fact.fact_id === 'fact:exercise-owner').semantic_fact_key,
    evidence.facts.find((fact) => fact.fact_id === 'fact:intent-notice').semantic_fact_key,
  );

  const collapsedEvidence = structuredClone(evidence);
  const collapsedOwnerFact = collapsedEvidence.facts.find(
    ({ fact_id: factId }) => factId === 'fact:exercise-owner',
  );
  const collapsedReferenceFact = collapsedEvidence.facts.find(
    ({ fact_id: factId }) => factId === 'fact:exercise-reference',
  );
  collapsedOwnerFact.semantic_fact_key = collapsedReferenceFact.semantic_fact_key;
  collapsedReferenceFact.typed_value = collapsedOwnerFact.semantic_fact_key;
  collapsedEvidence.links[0].target_semantic_fact_key = collapsedOwnerFact.semantic_fact_key;

  assert.throws(
    () => validateSyntheticExpressionEvidence(collapsedEvidence),
    (error) => error.code === 'M7_V2_EXPRESSION_TOPOLOGY',
  );
});

test('synthetic Phase 1 c(ii) rejects an advance-intent alias to the exercise notice', () => {
  const evidence = validTemporalPhase1CiiEvidence();
  const ownerFact = evidence.facts.find(
    (fact) => fact.fact_id === 'fact:exercise-owner',
  );
  const advanceIntentFact = evidence.facts.find(
    (fact) => fact.fact_id === 'fact:advance-intent',
  );
  advanceIntentFact.semantic_fact_key = ownerFact.semantic_fact_key;

  assert.throws(
    () => validateSyntheticExpressionEvidence(evidence),
    (error) => error.code === 'M7_V2_EXPRESSION_TOPOLOGY'
      && /intent roles, event reference, and termination exercise owner must preserve their authorised identities/u
        .test(error.message),
  );
});

test('synthetic Phase 1 c(ii) requires complete local expression scope evidence', () => {
  const evidence = validTemporalPhase1CiiEvidence();
  evidence.expressions.find(
    (expression) => expression.expression_id === 'expression:offset-before',
  ).scope_span_ids = ['span:intent-notice'];

  assert.throws(
    () => validateSyntheticExpressionEvidence(evidence),
    (error) => error.code === 'M7_V2_EXPRESSION_PROVENANCE'
      && /scope omits required evidence span span:offset-before/u.test(error.message),
  );
});

test('synthetic Phase 1 c(ii) requires authority for its temporal vocabulary', () => {
  const evidence = validTemporalPhase1CiiEvidence();
  delete evidence.temporalPhase1Authority;
  delete evidence.links;
  evidence.facts = evidence.facts.map((fact) => ({
    fact_id: fact.fact_id,
    source_support_ids: fact.source_support_ids,
  }));
  evidence.expressions = evidence.expressions.map((expression) => ({
    expression_id: expression.expression_id,
    operator: expression.operator,
    children: expression.children.map(({ kind, id }) => ({ kind, id })),
    connective_span_ids: expression.connective_span_ids,
    authored_limb_marker_span_ids: expression.authored_limb_marker_span_ids,
    scope_span_ids: expression.scope_span_ids,
  }));

  assert.throws(
    () => validateSyntheticExpressionEvidence(evidence),
    (error) => error.code === 'M7_V2_EXPRESSION_TOPOLOGY'
      && /operator ON_OR_BEFORE is not in V2/u.test(error.message),
  );
});

test('synthetic Phase 1 authority rejects byte drift and self-consistent zero-effect drift', () => {
  const cases = [
    {
      name: 'binding SHA drift',
      mutate(envelope) {
        envelope.binding.sha256 = '0'.repeat(64);
      },
    },
    {
      name: 're-stamped zero-effect drift',
      mutate(envelope) {
        envelope.record.zero_effects.real_termination_answers = 1;
        restampTemporalPhase1Authority(envelope);
      },
    },
  ];

  for (const selected of cases) {
    const evidence = validTemporalPhase1CiiEvidence();
    selected.mutate(evidence.temporalPhase1Authority);
    assert.throws(
      () => validateSyntheticExpressionEvidence(evidence),
      (error) => error.code === 'M7_V2_TEMPORAL_PHASE1_AUTHORITY_DRIFT',
      selected.name,
    );
  }
});

test('synthetic Phase 1 authority preserves caller mutability and accepts pre-frozen input', () => {
  const mutableEvidence = validTemporalPhase1CiiEvidence();
  const mutableAuthority = mutableEvidence.temporalPhase1Authority;
  const before = structuredClone(mutableAuthority);

  assert.equal(validateSyntheticExpressionEvidence(mutableEvidence).status, 'PASS');
  assert.deepEqual(mutableAuthority, before);
  assert.equal(Object.isFrozen(mutableAuthority), false);
  assert.equal(Object.isFrozen(mutableAuthority.record), false);
  assert.equal(Object.isFrozen(mutableAuthority.record.policy_overlay), false);
  assert.equal(
    Object.isFrozen(mutableAuthority.record.policy_overlay.new_operator_contracts[0]),
    false,
  );

  const frozenEvidence = validTemporalPhase1CiiEvidence();
  freezeDeep(frozenEvidence.temporalPhase1Authority);

  assert.equal(validateSyntheticExpressionEvidence(frozenEvidence).status, 'PASS');
  assert.equal(Object.isFrozen(frozenEvidence.temporalPhase1Authority), true);
});

const TERMINATION_PHASE2_AUTHORITY_V1_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-authoring-phase2-authority.json';
const TERMINATION_PHASE2_AUTHORITY_V2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-authoring-phase2-authority-v2.json';
const TERMINATION_PHASE2_AUTHORITY_V2_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE2_AUTHORITY/V2';
const TERMINATION_PHASE2_AUTHORITY_V2_ID =
  'df1e3d4711e1b2fca09ea681e43db19a6b7cbfe1055e6a57c3ea48b2f588bf15';
const TERMINATION_PHASE2_AUTHORITY_V2_BYTE_LENGTH = 787442;
const TERMINATION_PHASE2_AUTHORITY_V2_SHA256 =
  '897022076002dc07d16d7a60071dd932c829428fe0763d42d9b70fd1b21055cb';
const TERMINATION_PHASE2_EVIDENCE_SCHEMA =
  'STAGE_2Y_M7_V2_TERMINATION_PHASE2_SYNTHETIC_EVIDENCE_VALIDATION/V1';
const TERMINATION_PHASE2_STATE_SCHEMA = 'TEMPORAL_DEFINED_TERM_STATE/V1';
const TERMINATION_PHASE2_EDGE_SCHEMA = 'TEMPORAL_STATE_EDGE/V1';
const TERMINATION_PHASE2_REFERENCE_SCHEMA = 'TEMPORAL_STATE_REFERENCE_EDGE/V1';
const TERMINATION_PHASE2_AUTHORITY_ERROR =
  'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT';
const TERMINATION_PHASE2_TOPOLOGY_ERROR =
  'M7_V2_TERMINATION_PHASE2_EVIDENCE_TOPOLOGY';
const TERMINATION_PHASE2_PROVENANCE_ERROR =
  'M7_V2_TERMINATION_PHASE2_EVIDENCE_PROVENANCE';
const TERMINATION_PHASE2_REFERENCE_ERROR =
  'M7_V2_TERMINATION_PHASE2_REFERENCE_RESOLUTION';
const TERMINATION_PHASE2_GRAPH_ORDER = Object.freeze([
  'CONCHO',
  'METSERA',
  'SKYWATER',
  'RH',
  'SKECHERS',
]);

const TERMINATION_PHASE2_INPUT_KEYS = Object.freeze([
  'terminationAuthoringPhase2Authority',
  'authorised_rule_components',
  'temporal_defined_term_states',
  'temporal_state_edges',
  'temporal_state_reference_edges',
]);
const TERMINATION_PHASE2_RESULT_KEYS = Object.freeze([
  'schema_version',
  'status',
  'authorised_rule_component_count',
  'temporal_defined_term_state_count',
  'temporal_state_edge_count',
  'temporal_state_reference_edge_count',
]);
const TERMINATION_PHASE2_STATE_KEYS = Object.freeze([
  'schema_version',
  'state_id',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'state_key',
  'ordinal',
  'value_ref',
  'source_node_occurrence_id',
  'source_support_ids',
  'resolution_state',
  'unresolved_dimensions',
]);
const TERMINATION_PHASE2_EDGE_KEYS = Object.freeze([
  'schema_version',
  'temporal_state_edge_id',
  'edge_rule_id',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'predecessor_state_id',
  'successor_state_id',
  'trigger_expression_id',
  'evaluation_expression_ids',
  'transition_kind',
  'source_node_occurrence_ids',
  'source_support_ids',
  'resolution_state',
]);
const TERMINATION_PHASE2_REFERENCE_KEYS = Object.freeze([
  'schema_version',
  'temporal_state_reference_edge_id',
  'edge_rule_id',
  'edge_type',
  'agreement_id',
  'defined_term_key',
  'defined_term_owner_node_occurrence_id',
  'consumer_rule_id',
  'consumer_fact_id',
  'consumer_dependency_id',
  'consumer_context_edge_id',
  'state_ids',
  'transition_edge_ids',
  'source_support_ids',
  'resolution_state',
]);

function loadTerminationPhase2Authority(path) {
  const bytes = readFileSync(join(REPO_ROOT, path));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    bytes,
    envelope: {
      binding: {
        byte_length: bytes.length,
        path,
        record_id: record.termination_authoring_phase2_authority_id,
        record_id_field: 'termination_authoring_phase2_authority_id',
        schema_version: record.schema_version,
        sha256: sha256Hex(bytes),
      },
      record,
    },
  };
}

function terminationPhase2Authority() {
  const loaded = loadTerminationPhase2Authority(TERMINATION_PHASE2_AUTHORITY_V2_PATH);
  const { bytes, envelope } = loaded;
  const { record } = envelope;
  assert.equal(bytes.length, TERMINATION_PHASE2_AUTHORITY_V2_BYTE_LENGTH);
  assert.equal(sha256Hex(bytes), TERMINATION_PHASE2_AUTHORITY_V2_SHA256);
  assert.equal(bytes.toString('utf8'), `${canonicalJson(record)}\n`);
  assert.equal(record.schema_version, TERMINATION_PHASE2_AUTHORITY_V2_SCHEMA);
  assert.equal(
    record.termination_authoring_phase2_authority_id,
    TERMINATION_PHASE2_AUTHORITY_V2_ID,
  );
  const unsigned = structuredClone(record);
  delete unsigned.termination_authoring_phase2_authority_id;
  assert.equal(contentId(record.schema_version, unsigned), TERMINATION_PHASE2_AUTHORITY_V2_ID);
  assert.deepEqual(record.immutable_predecessor_binding, {
    byte_length: 419437,
    path: TERMINATION_PHASE2_AUTHORITY_V1_PATH,
    record_id: 'f50156b5aa96a167ae8e6201b4996e35d2ce7823b2d8b67714655ed05619acb4',
    record_id_field: 'termination_authoring_phase2_authority_id',
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE2_AUTHORITY/V1',
    sha256: '9789436a457518093d9e582eeb9120ec9c2cb6aedd78d596da70eeb44ee52571',
  });
  return envelope;
}

function restampTerminationPhase2Authority(envelope, mutate) {
  const record = structuredClone(envelope.record);
  delete record.termination_authoring_phase2_authority_id;
  mutate(record);
  record.termination_authoring_phase2_authority_id = contentId(record.schema_version, record);
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    binding: {
      ...envelope.binding,
      byte_length: bytes.length,
      record_id: record.termination_authoring_phase2_authority_id,
      sha256: sha256Hex(bytes),
    },
    record,
  };
}

function phase2IdentityRule(authority, ruleKey, payload) {
  const contract = authority.implementation_contract.evidence_validation_contract
    .independent_graph_typed_registry_contract.identity_derivation_contract[ruleKey];
  assert.deepEqual(Object.keys(payload), contract.payload_exact_keys);
  return contentId(contract.domain, payload);
}

function phase2AgreementIndexId(authority, agreementId) {
  const graphOwnerTemplates = authority.implementation_contract
    .reference_target_owner_template_registry.templates.filter(
      (template) => template.agreement_id === agreementId
        && template.descriptor_key.target_kind === 'TEMPORAL_STATE_GRAPH_OWNER_FACT',
    );
  assert.equal(graphOwnerTemplates.length, 1, `graph owner template for ${agreementId}`);
  const bindings = authority.immutable_parent_bindings.m2_m3_m4.filter(
    (entry) => entry.agreement_id === agreementId,
  );
  assert.equal(bindings.length, 1, `M2 binding for ${agreementId}`);
  const [binding] = bindings;
  const [graphOwnerTemplate] = graphOwnerTemplates;
  assert.equal(graphOwnerTemplate.agreement_id, binding.agreement_id);
  assert.equal(graphOwnerTemplate.agreement_index_id, binding.m2.record_id);
  for (const support of graphOwnerTemplate.source_supports) {
    assert.equal(support.source_support_id, contentId('AGREEMENT_SOURCE_SPAN/V2', {
      agreement_index_id: binding.m2.record_id,
      source_node_occurrence_id: support.node_occurrence_id,
      start_byte: support.source_span.start_byte,
      end_byte: support.source_span.end_byte,
      text_sha256: support.source_span.text_sha256,
    }));
  }
  return binding.m2.record_id;
}

function phase2SupportIdForAgreementIndex(agreementIndexId, nodeOccurrenceId, sourceSpan) {
  return contentId('AGREEMENT_SOURCE_SPAN/V2', {
    agreement_index_id: agreementIndexId,
    source_node_occurrence_id: nodeOccurrenceId,
    start_byte: sourceSpan.start_byte,
    end_byte: sourceSpan.end_byte,
    text_sha256: sourceSpan.text_sha256,
  });
}

function phase2SupportId(authority, agreementId, nodeOccurrenceId, sourceSpan) {
  return phase2SupportIdForAgreementIndex(
    phase2AgreementIndexId(authority, agreementId),
    nodeOccurrenceId,
    sourceSpan,
  );
}

function phase2TreeSignature(node) {
  if (node.kind === 'FACT') return node.field_key;
  return `${node.operator}(${node.children.map(
    (child) => phase2TreeSignature(child.node),
  ).join(',')})`;
}

function phase2GraphExpression(authority, graph, owner, template) {
  const factContracts = new Map(template.fact_contracts.map(
    (contract) => [contract.field_key, contract],
  ));
  assert.equal(factContracts.size, template.fact_contracts.length);

  function derive(node, expressionPath) {
    if (node.kind === 'FACT') {
      const factContract = factContracts.get(node.field_key);
      assert.ok(factContract, `missing ${node.field_key} fact contract`);
      const payload = owner.kind === 'STATE'
        ? {
          agreement_id: graph.agreement_id,
          graph_key: graph.graph_key,
          state_key: owner.state_key,
          expression_path: expressionPath,
          fact_contract: factContract,
        }
        : {
          agreement_id: graph.agreement_id,
          graph_key: graph.graph_key,
          edge_key: owner.edge_key,
          evaluation_ordinal: owner.evaluation_ordinal,
          expression_path: expressionPath,
          fact_contract: factContract,
        };
      return {
        kind: 'FACT',
        id: phase2IdentityRule(
          authority,
          owner.kind === 'STATE'
            ? 'graph_state_fact_id_rule'
            : 'graph_edge_evaluation_fact_id_rule',
          payload,
        ),
        result_kind: factContract.value_type,
      };
    }
    assert.equal(node.kind, 'EXPRESSION');
    const children = node.children.map((child, index) => {
      const derived = derive(child.node, `${expressionPath}.${index + 1}`);
      return {
        kind: derived.kind,
        id: derived.id,
        ordinal: index + 1,
        role: child.role,
      };
    });
    const payload = owner.kind === 'STATE'
      ? {
        agreement_id: graph.agreement_id,
        graph_key: graph.graph_key,
        state_key: owner.state_key,
        expression_path: expressionPath,
        operator: node.operator,
        result_kind: node.result_kind,
        children,
      }
      : {
        agreement_id: graph.agreement_id,
        graph_key: graph.graph_key,
        edge_key: owner.edge_key,
        evaluation_ordinal: owner.evaluation_ordinal,
        expression_path: expressionPath,
        operator: node.operator,
        result_kind: node.result_kind,
        children,
      };
    return {
      kind: 'EXPRESSION',
      id: phase2IdentityRule(
        authority,
        owner.kind === 'STATE'
          ? 'graph_state_expression_id_rule'
          : 'graph_edge_evaluation_expression_id_rule',
        payload,
      ),
      result_kind: node.result_kind,
    };
  }

  assert.equal(phase2TreeSignature(template.expression_tree), template.literal_signature);
  return derive(template.expression_tree, '0');
}

function phase2RestampRecord(record, idField) {
  const keys = Object.keys(record);
  const unsigned = {};
  for (const key of keys) {
    if (key !== idField) unsigned[key] = record[key];
  }
  const next = {};
  for (const key of keys) {
    next[key] = key === idField
      ? contentId(record.schema_version, unsigned)
      : record[key];
  }
  for (const key of keys) delete record[key];
  Object.assign(record, next);
  return record;
}

function phase2TargetSemanticFactKey(authority, graph) {
  const descriptor = {
    defined_term_key: graph.defined_term_key,
    graph_key: graph.graph_key,
    kind: 'DERIVED_REFERENCE_TARGET/V1',
    resolved_analysis_value_kind: 'SEMANTIC_FACT_KEY',
    target_kind: 'TEMPORAL_STATE_GRAPH_OWNER_FACT',
  };
  const registry = authority.implementation_contract.reference_target_owner_template_registry;
  const template = registry.templates.find(
    (candidate) => canonicalJson(candidate.descriptor_key) === canonicalJson(descriptor),
  );
  assert.ok(template, `missing target template for ${graph.graph_key}`);
  const sourceSupportIds = template.source_supports.map((support) => {
    const expected = phase2SupportId(
      authority,
      graph.agreement_id,
      support.node_occurrence_id,
      support.source_span,
    );
    assert.equal(support.source_support_id, expected);
    return expected;
  });
  return contentId('AGREEMENT_SEMANTIC_FACT/V2', {
    agreement_id: template.agreement_id,
    field_key: template.field_key,
    normalised_typed_value: template.typed_value,
    legal_subject: template.legal_subject,
    temporal_scope_signature: template.temporal_scope_signature,
    source_support_ids: sourceSupportIds,
    legal_effect_role: template.legal_effect_role,
  });
}

function phase2MaterialiseReference(authority, graph, scheduleRow, stateIds,
  transitionEdgeIds) {
  const sourceRoleIdentity = {
    graph_key: scheduleRow.graph_key,
    consumer_rule_key: scheduleRow.consumer_rule_key,
    field_key: scheduleRow.field_key,
    source_role_occurrence_ordinal: scheduleRow.source_role_occurrence_ordinal,
    source_node_occurrence_id: scheduleRow.source_node_occurrence_id,
    source_span: structuredClone(scheduleRow.source_span),
  };
  const sourceSupportIds = [phase2SupportId(
    authority,
    graph.agreement_id,
    scheduleRow.source_node_occurrence_id,
    scheduleRow.source_span,
  )];
  const targetSemanticFactKey = phase2TargetSemanticFactKey(authority, graph);
  const rulePayload = {
    agreement_id: graph.agreement_id,
    graph_key: graph.graph_key,
    consumer_rule_key: scheduleRow.consumer_rule_key,
  };
  const consumerRuleId = phase2IdentityRule(
    authority,
    'reference_consumer_rule_id_rule',
    rulePayload,
  );
  const factPayload = {
    consumer_rule_id: consumerRuleId,
    source_role_identity: sourceRoleIdentity,
    value_type: 'REFERENCE',
    typed_value: targetSemanticFactKey,
    normaliser_id: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
    source_support_ids: sourceSupportIds,
  };
  const consumerFactId = phase2IdentityRule(
    authority,
    'reference_consumer_fact_id_rule',
    factPayload,
  );
  const dependencyPayload = {
    consumer_fact_id: consumerFactId,
    edge_rule_id: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
    edge_type: 'TEMPORAL_STATE_GRAPH_TARGET',
    target_semantic_fact_key: targetSemanticFactKey,
    state_ids: stateIds,
    transition_edge_ids: transitionEdgeIds,
    native_m3_resolution: scheduleRow.native_m3_resolution,
    native_m3_definition_edge_id: scheduleRow.native_m3_definition_edge_id,
    native_m3_subterm_edge_id: scheduleRow.native_m3_subterm_edge_id,
  };
  const consumerDependencyId = phase2IdentityRule(
    authority,
    'reference_consumer_dependency_id_rule',
    dependencyPayload,
  );
  const contextPayload = {
    consumer_rule_id: consumerRuleId,
    consumer_fact_id: consumerFactId,
    consumer_dependency_id: consumerDependencyId,
    source_role_identity: sourceRoleIdentity,
    source_support_ids: sourceSupportIds,
  };
  const consumerContextEdgeId = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    contextPayload,
  );
  const unsigned = {
    schema_version: TERMINATION_PHASE2_REFERENCE_SCHEMA,
    edge_rule_id: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
    edge_type: 'TEMPORAL_STATE_GRAPH_TARGET',
    agreement_id: graph.agreement_id,
    defined_term_key: graph.defined_term_key,
    defined_term_owner_node_occurrence_id: graph.defined_term_owner_node_occurrence_id,
    consumer_rule_id: consumerRuleId,
    consumer_fact_id: consumerFactId,
    consumer_dependency_id: consumerDependencyId,
    consumer_context_edge_id: consumerContextEdgeId,
    state_ids: stateIds,
    transition_edge_ids: transitionEdgeIds,
    source_support_ids: sourceSupportIds,
    resolution_state: 'SYMBOLIC_GRAPH_BOUND',
  };
  return {
    record: {
      schema_version: unsigned.schema_version,
      temporal_state_reference_edge_id: contentId(
        TERMINATION_PHASE2_REFERENCE_SCHEMA,
        unsigned,
      ),
      edge_rule_id: unsigned.edge_rule_id,
      edge_type: unsigned.edge_type,
      agreement_id: unsigned.agreement_id,
      defined_term_key: unsigned.defined_term_key,
      defined_term_owner_node_occurrence_id:
        unsigned.defined_term_owner_node_occurrence_id,
      consumer_rule_id: unsigned.consumer_rule_id,
      consumer_fact_id: unsigned.consumer_fact_id,
      consumer_dependency_id: unsigned.consumer_dependency_id,
      consumer_context_edge_id: unsigned.consumer_context_edge_id,
      state_ids: unsigned.state_ids,
      transition_edge_ids: unsigned.transition_edge_ids,
      source_support_ids: unsigned.source_support_ids,
      resolution_state: unsigned.resolution_state,
    },
    internal: {
      source_role_identity: sourceRoleIdentity,
      source_support_ids: sourceSupportIds,
      target_semantic_fact_key: targetSemanticFactKey,
      rule_payload: rulePayload,
      fact_payload: factPayload,
      dependency_payload: dependencyPayload,
      context_payload: contextPayload,
    },
  };
}

function validTerminationPhase2Evidence() {
  const terminationAuthoringPhase2Authority = terminationPhase2Authority();
  const authority = terminationAuthoringPhase2Authority.record;
  const authorisedRuleComponents = authority.authorised_synthetic_rule_components.map(
    (component) => ({
      component_key: component.component_key,
      compiled_output: structuredClone(compileSyntheticProfileExpression({
        terminationAuthoringPhase2Authority,
        component_key: component.component_key,
      })),
    }),
  );
  const states = [];
  const stateIdsByGraph = new Map();
  const stateIndex = new Map();
  const stateValueByKey = new Map();

  for (const graph of authority.authorised_symbolic_graph_fixtures) {
    const graphStateIds = [];
    for (const stateTemplate of graph.ordered_state_templates) {
      let valueRef;
      let resultKind;
      if (stateTemplate.value_ref_template.kind === 'SOURCE_TYPED_FACT') {
        const id = phase2IdentityRule(authority, 'graph_state_fact_id_rule', {
          agreement_id: graph.agreement_id,
          graph_key: graph.graph_key,
          state_key: stateTemplate.state_key,
          expression_path: '0',
          fact_contract: stateTemplate.value_ref_template,
        });
        valueRef = { kind: 'FACT', id };
        resultKind = stateTemplate.value_ref_template.value_type;
      } else {
        const derived = phase2GraphExpression(
          authority,
          graph,
          { kind: 'STATE', state_key: stateTemplate.state_key },
          stateTemplate.value_ref_template,
        );
        valueRef = { kind: 'EXPRESSION', id: derived.id };
        resultKind = derived.result_kind;
      }
      const sourceSupportIds = stateTemplate.source_supports.map((support) => (
        phase2SupportId(
          authority,
          graph.agreement_id,
          support.node_occurrence_id,
          support.source_span,
        )
      ));
      const unsigned = {
        schema_version: TERMINATION_PHASE2_STATE_SCHEMA,
        agreement_id: graph.agreement_id,
        defined_term_key: graph.defined_term_key,
        defined_term_owner_node_occurrence_id: graph.defined_term_owner_node_occurrence_id,
        state_key: stateTemplate.state_key,
        ordinal: stateTemplate.ordinal,
        value_ref: valueRef,
        source_node_occurrence_id: stateTemplate.source_node_occurrence_id,
        source_support_ids: sourceSupportIds,
        resolution_state: stateTemplate.resolution_state,
        unresolved_dimensions: structuredClone(stateTemplate.unresolved_dimensions),
      };
      const record = {
        schema_version: unsigned.schema_version,
        state_id: contentId(TERMINATION_PHASE2_STATE_SCHEMA, unsigned),
        agreement_id: unsigned.agreement_id,
        defined_term_key: unsigned.defined_term_key,
        defined_term_owner_node_occurrence_id:
          unsigned.defined_term_owner_node_occurrence_id,
        state_key: unsigned.state_key,
        ordinal: unsigned.ordinal,
        value_ref: unsigned.value_ref,
        source_node_occurrence_id: unsigned.source_node_occurrence_id,
        source_support_ids: unsigned.source_support_ids,
        resolution_state: unsigned.resolution_state,
        unresolved_dimensions: unsigned.unresolved_dimensions,
      };
      stateIndex.set(`${graph.graph_key}:${stateTemplate.state_key}`, states.length);
      stateValueByKey.set(`${graph.graph_key}:${stateTemplate.state_key}`, {
        id: valueRef.id,
        kind: valueRef.kind,
        result_kind: resultKind,
      });
      graphStateIds.push(record.state_id);
      states.push(record);
    }
    stateIdsByGraph.set(graph.graph_key, graphStateIds);
  }

  const edges = [];
  const edgeIdsByGraph = new Map();
  const edgeIndex = new Map();
  const edgeTriggerByKey = new Map();
  for (const graph of authority.authorised_symbolic_graph_fixtures) {
    const graphStateIds = stateIdsByGraph.get(graph.graph_key);
    const stateIdByKey = new Map(graph.ordered_state_templates.map(
      (state, index) => [state.state_key, graphStateIds[index]],
    ));
    const graphEdgeIds = [];
    for (const edgeTemplate of graph.ordered_edge_templates) {
      const triggerExpressionId = phase2IdentityRule(
        authority,
        'graph_edge_trigger_id_rule',
        {
          agreement_id: graph.agreement_id,
          graph_key: graph.graph_key,
          edge_key: edgeTemplate.edge_key,
          trigger_template: edgeTemplate.trigger_template,
        },
      );
      const evaluationExpressionIds = edgeTemplate.evaluation_templates.map(
        (evaluation, index) => {
          const derived = phase2GraphExpression(
            authority,
            graph,
            {
              kind: 'EVALUATION',
              edge_key: edgeTemplate.edge_key,
              evaluation_ordinal: index + 1,
            },
            evaluation,
          );
          assert.equal(derived.result_kind, 'TEMPORAL');
          return derived.id;
        },
      );
      const sourceSupportIds = edgeTemplate.source_supports.map((support) => (
        phase2SupportId(
          authority,
          graph.agreement_id,
          support.node_occurrence_id,
          support.source_span,
        )
      ));
      const unsigned = {
        schema_version: TERMINATION_PHASE2_EDGE_SCHEMA,
        edge_rule_id: 'TEMPORAL_STATE_EDGE/V1',
        agreement_id: graph.agreement_id,
        defined_term_key: graph.defined_term_key,
        defined_term_owner_node_occurrence_id: graph.defined_term_owner_node_occurrence_id,
        predecessor_state_id: stateIdByKey.get(edgeTemplate.predecessor_state_key),
        successor_state_id: stateIdByKey.get(edgeTemplate.successor_state_key),
        trigger_expression_id: triggerExpressionId,
        evaluation_expression_ids: evaluationExpressionIds,
        transition_kind: edgeTemplate.transition_kind,
        source_node_occurrence_ids: structuredClone(
          edgeTemplate.source_node_occurrence_ids,
        ),
        source_support_ids: sourceSupportIds,
        resolution_state: edgeTemplate.resolution_state,
      };
      const record = {
        schema_version: unsigned.schema_version,
        temporal_state_edge_id: contentId(TERMINATION_PHASE2_EDGE_SCHEMA, unsigned),
        edge_rule_id: unsigned.edge_rule_id,
        agreement_id: unsigned.agreement_id,
        defined_term_key: unsigned.defined_term_key,
        defined_term_owner_node_occurrence_id:
          unsigned.defined_term_owner_node_occurrence_id,
        predecessor_state_id: unsigned.predecessor_state_id,
        successor_state_id: unsigned.successor_state_id,
        trigger_expression_id: unsigned.trigger_expression_id,
        evaluation_expression_ids: unsigned.evaluation_expression_ids,
        transition_kind: unsigned.transition_kind,
        source_node_occurrence_ids: unsigned.source_node_occurrence_ids,
        source_support_ids: unsigned.source_support_ids,
        resolution_state: unsigned.resolution_state,
      };
      edgeIndex.set(`${graph.graph_key}:${edgeTemplate.edge_key}`, edges.length);
      edgeTriggerByKey.set(`${graph.graph_key}:${edgeTemplate.edge_key}`, {
        id: triggerExpressionId,
        result_kind: 'LOGICAL',
      });
      graphEdgeIds.push(record.temporal_state_edge_id);
      edges.push(record);
    }
    edgeIdsByGraph.set(graph.graph_key, graphEdgeIds);
  }

  const references = [];
  const referenceInternalByRow = new Map();
  const graphByKey = new Map(authority.authorised_symbolic_graph_fixtures.map(
    (graph) => [graph.graph_key, graph],
  ));
  for (const scheduleRow of authority.temporal_state_reference_occurrence_schedule) {
    const graph = graphByKey.get(scheduleRow.graph_key);
    const materialised = phase2MaterialiseReference(
      authority,
      graph,
      scheduleRow,
      structuredClone(stateIdsByGraph.get(graph.graph_key)),
      structuredClone(edgeIdsByGraph.get(graph.graph_key)),
    );
    referenceInternalByRow.set(scheduleRow.row, materialised.internal);
    references.push(materialised.record);
  }

  return {
    input: {
      terminationAuthoringPhase2Authority,
      authorised_rule_components: authorisedRuleComponents,
      temporal_defined_term_states: states,
      temporal_state_edges: edges,
      temporal_state_reference_edges: references,
    },
    internal: {
      state_index: stateIndex,
      state_ids_by_graph: stateIdsByGraph,
      state_value_by_key: stateValueByKey,
      edge_index: edgeIndex,
      edge_ids_by_graph: edgeIdsByGraph,
      edge_trigger_by_key: edgeTriggerByKey,
      reference_internal_by_row: referenceInternalByRow,
      graph_by_key: graphByKey,
    },
  };
}

function assertTerminationPhase2EvidenceError(input, code, label) {
  assert.throws(
    () => validateSyntheticExpressionEvidence(input),
    (error) => error && error.code === code,
    label,
  );
}

test('Phase2 synthetic evidence validates exact temporal state and cross-rule reference contracts', () => {
  const fixture = validTerminationPhase2Evidence();
  const { input, internal } = fixture;
  const authority = input.terminationAuthoringPhase2Authority.record;
  const before = structuredClone(input);

  assert.deepEqual(
    authority.authorised_symbolic_graph_fixtures.map((graph) => graph.graph_key),
    TERMINATION_PHASE2_GRAPH_ORDER,
  );
  for (const graph of authority.authorised_symbolic_graph_fixtures) {
    assert.deepEqual(
      graph.ordered_state_templates.map((state) => state.ordinal),
      graph.ordered_state_templates.map((state, index) => index),
    );
  }
  assert.deepEqual(
    authority.temporal_state_reference_occurrence_schedule.map((row) => row.row),
    authority.temporal_state_reference_occurrence_schedule.map((row, index) => index + 1),
  );
  assert.deepEqual(Object.keys(input), TERMINATION_PHASE2_INPUT_KEYS);
  assert.equal(input.authorised_rule_components.length, 11);
  assert.deepEqual(
    input.authorised_rule_components.map((wrapper) => wrapper.component_key),
    authority.authorised_synthetic_rule_components.map(
      (component) => component.component_key,
    ),
  );
  assert.deepEqual(input.authorised_rule_components.map(Object.keys), Array(11).fill([
    'component_key',
    'compiled_output',
  ]));
  assert.deepEqual(input.authorised_rule_components.map(
    ({ compiled_output: output }) => Object.keys(output),
  ), Array(11).fill([
    'profile_id',
    'expression_signature',
    'root_expression_id',
    'source_spans',
    'facts',
    'expressions',
  ]));
  assert.equal(input.temporal_defined_term_states.length, 12);
  assert.equal(input.temporal_state_edges.length, 8);
  assert.equal(input.temporal_state_reference_edges.length, 41);
  for (const state of input.temporal_defined_term_states) {
    assert.deepEqual(Object.keys(state), TERMINATION_PHASE2_STATE_KEYS);
    assert.deepEqual(Object.keys(state.value_ref), ['kind', 'id']);
  }
  for (const edge of input.temporal_state_edges) {
    assert.deepEqual(Object.keys(edge), TERMINATION_PHASE2_EDGE_KEYS);
  }
  for (const reference of input.temporal_state_reference_edges) {
    assert.deepEqual(Object.keys(reference), TERMINATION_PHASE2_REFERENCE_KEYS);
    assert.equal(Object.hasOwn(reference, 'operative_state'), false);
  }
  assert.deepEqual(
    input.temporal_state_edges.map((edge) => edge.evaluation_expression_ids.length),
    authority.authorised_symbolic_graph_fixtures.flatMap(
      (graph) => graph.ordered_edge_templates.map(
        (edge) => edge.evaluation_templates.length,
      ),
    ),
  );
  assert.deepEqual(
    input.temporal_state_reference_edges.map((reference) => reference.source_support_ids),
    authority.temporal_state_reference_occurrence_schedule.map((row) => [
      phase2SupportId(
        authority,
        internal.graph_by_key.get(row.graph_key).agreement_id,
        row.source_node_occurrence_id,
        row.source_span,
      ),
    ]),
  );

  const skechersGraph = internal.graph_by_key.get('SKECHERS');
  const skechersK0Template = skechersGraph.ordered_state_templates.find(
    (state) => state.state_key === 'K0',
  );
  const skechersK0 = input.temporal_defined_term_states[
    internal.state_index.get('SKECHERS:K0')
  ];
  assert.deepEqual(
    skechersK0.source_support_ids,
    skechersK0Template.source_supports.map((support) => phase2SupportId(
      authority,
      skechersGraph.agreement_id,
      support.node_occurrence_id,
      support.source_span,
    )),
  );
  assert.deepEqual(skechersK0.value_ref, {
    kind: 'FACT',
    id: phase2IdentityRule(authority, 'graph_state_fact_id_rule', {
      agreement_id: skechersGraph.agreement_id,
      graph_key: 'SKECHERS',
      state_key: 'K0',
      expression_path: '0',
      fact_contract: skechersK0Template.value_ref_template,
    }),
  });

  const skywaterGraph = internal.graph_by_key.get('SKYWATER');
  assert.equal(
    skywaterGraph.ordered_edge_templates[0].trigger_template.signature,
    skywaterGraph.ordered_edge_templates[1].trigger_template.signature,
  );
  assert.notEqual(
    internal.edge_trigger_by_key.get('SKYWATER:S0_TO_S1').id,
    internal.edge_trigger_by_key.get('SKYWATER:S1_TO_S2').id,
  );
  const rhGraph = internal.graph_by_key.get('RH');
  assert.equal(
    canonicalJson(rhGraph.ordered_edge_templates[0].trigger_template),
    canonicalJson(rhGraph.ordered_edge_templates[1].trigger_template),
  );
  assert.notEqual(
    internal.edge_trigger_by_key.get('RH:R0_TO_R1').id,
    internal.edge_trigger_by_key.get('RH:R1_TO_R2').id,
  );
  assert.deepEqual(
    skechersGraph.ordered_edge_templates.find(
      (edge) => edge.edge_key === 'K0_TO_K1',
    ).evaluation_templates,
    [],
  );
  const skechersK0K2Template = skechersGraph.ordered_edge_templates.find(
    (edge) => edge.edge_key === 'K0_TO_K2',
  );
  const skechersK1K2Template = skechersGraph.ordered_edge_templates.find(
    (edge) => edge.edge_key === 'K1_TO_K2',
  );
  assert.equal(
    canonicalJson(skechersK0K2Template.evaluation_templates),
    canonicalJson(skechersK1K2Template.evaluation_templates),
  );
  assert.notEqual(
    input.temporal_state_edges[
      internal.edge_index.get('SKECHERS:K0_TO_K2')
    ].evaluation_expression_ids[0],
    input.temporal_state_edges[
      internal.edge_index.get('SKECHERS:K1_TO_K2')
    ].evaluation_expression_ids[0],
  );

  const compilerIds = new Set(input.authorised_rule_components.flatMap(
    ({ compiled_output: output }) => [
      output.profile_id,
      output.root_expression_id,
      ...output.source_spans.map((spanRecord) => spanRecord.span_id),
      ...output.facts.map((fact) => fact.fact_id),
      ...output.facts.map((fact) => fact.semantic_fact_key),
      ...output.expressions.map((expression) => expression.expression_id),
    ],
  ));
  const graphAndConsumerIds = new Set([
    ...input.temporal_defined_term_states.flatMap((state) => [
      state.state_id,
      state.value_ref.id,
    ]),
    ...input.temporal_state_edges.flatMap((edge) => [
      edge.temporal_state_edge_id,
      edge.trigger_expression_id,
      ...edge.evaluation_expression_ids,
    ]),
    ...input.temporal_state_reference_edges.flatMap((reference) => [
      reference.temporal_state_reference_edge_id,
      reference.consumer_rule_id,
      reference.consumer_fact_id,
      reference.consumer_dependency_id,
      reference.consumer_context_edge_id,
    ]),
  ]);
  for (const identity of graphAndConsumerIds) {
    assert.equal(compilerIds.has(identity), false, `compiler identity leaked: ${identity}`);
  }
  const nativeM3Ids = new Set(
    authority.temporal_state_reference_occurrence_schedule.flatMap((row) => [
      row.native_m3_definition_edge_id,
      row.native_m3_subterm_edge_id,
    ]).filter(Boolean),
  );
  for (const identity of graphAndConsumerIds) {
    assert.equal(nativeM3Ids.has(identity), false, `native M3 identity leaked: ${identity}`);
  }
  assert.deepEqual(
    input.temporal_state_reference_edges.reduce((counts, reference) => ({
      ...counts,
      [authority.authorised_symbolic_graph_fixtures.find(
        (graph) => graph.agreement_id === reference.agreement_id,
      ).graph_key]: (counts[authority.authorised_symbolic_graph_fixtures.find(
        (graph) => graph.agreement_id === reference.agreement_id,
      ).graph_key] || 0) + 1,
    }), {}),
    { RH: 10, CONCHO: 5, METSERA: 8, SKYWATER: 7, SKECHERS: 11 },
  );

  const first = validateSyntheticExpressionEvidence(input);
  const second = validateSyntheticExpressionEvidence(input);
  assert.deepEqual(first, {
    schema_version: TERMINATION_PHASE2_EVIDENCE_SCHEMA,
    status: 'PASS',
    authorised_rule_component_count: 11,
    temporal_defined_term_state_count: 12,
    temporal_state_edge_count: 8,
    temporal_state_reference_edge_count: 41,
  });
  assert.deepEqual(Object.keys(first), TERMINATION_PHASE2_RESULT_KEYS);
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.notStrictEqual(second, first);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.terminationAuthoringPhase2Authority), false);
  assert.equal(Object.isFrozen(
    input.authorised_rule_components[0].compiled_output.facts[0],
  ), false);
  assert.equal(Object.isFrozen(input.temporal_defined_term_states), false);
  assert.equal(Object.isFrozen(input.temporal_defined_term_states[0]), false);
  assert.equal(Object.isFrozen(input.temporal_defined_term_states[0].value_ref), false);
  assert.equal(Object.isFrozen(input.temporal_state_edges[0]), false);
  assert.equal(Object.isFrozen(
    input.temporal_state_edges[0].evaluation_expression_ids,
  ), false);
  assert.equal(Object.isFrozen(input.temporal_state_reference_edges[0]), false);
  assert.equal(Object.isFrozen(
    input.temporal_state_reference_edges[0].state_ids,
  ), false);

  const frozenInput = structuredClone(input);
  freezeDeep(frozenInput);
  assert.deepEqual(validateSyntheticExpressionEvidence(frozenInput), first);

  const fresh = () => structuredClone(input);
  const stateAt = (selected, graphKey, stateKey) => (
    selected.temporal_defined_term_states[
      internal.state_index.get(`${graphKey}:${stateKey}`)
    ]
  );
  const edgeAt = (selected, graphKey, edgeKey) => (
    selected.temporal_state_edges[
      internal.edge_index.get(`${graphKey}:${edgeKey}`)
    ]
  );
  const referenceForScheduleRow = (scheduleRow) => {
    const graph = internal.graph_by_key.get(scheduleRow.graph_key);
    return phase2MaterialiseReference(
      authority,
      graph,
      scheduleRow,
      structuredClone(internal.state_ids_by_graph.get(scheduleRow.graph_key)),
      structuredClone(internal.edge_ids_by_graph.get(scheduleRow.graph_key)),
    ).record;
  };

  assertTerminationPhase2EvidenceError({
    ...fresh(),
    terminationAuthoringPhase2Authority: null,
  }, TERMINATION_PHASE2_AUTHORITY_ERROR, 'null V2 authority');
  assertTerminationPhase2EvidenceError({
    ...fresh(),
    terminationAuthoringPhase2Authority:
      loadTerminationPhase2Authority(TERMINATION_PHASE2_AUTHORITY_V1_PATH).envelope,
  }, TERMINATION_PHASE2_AUTHORITY_ERROR, 'V1 is not the active V2 authority');
  const driftedAuthority = fresh();
  driftedAuthority.terminationAuthoringPhase2Authority.record
    .authorised_symbolic_graph_fixtures[0].defined_term_key = 'DRIFT';
  driftedAuthority.temporal_defined_term_states.length = 0;
  assertTerminationPhase2EvidenceError(
    driftedAuthority,
    TERMINATION_PHASE2_AUTHORITY_ERROR,
    'authority drift precedes evidence semantics',
  );
  const restampedAuthority = fresh();
  restampedAuthority.terminationAuthoringPhase2Authority =
    restampTerminationPhase2Authority(
      input.terminationAuthoringPhase2Authority,
      (record) => { record.unexpected_top_level_authority_member = true; },
    );
  assertTerminationPhase2EvidenceError(
    restampedAuthority,
    TERMINATION_PHASE2_AUTHORITY_ERROR,
    'self-consistent restamped authority remains drift',
  );

  const extraInputKey = fresh();
  extraInputKey.unexpected = true;
  assertTerminationPhase2EvidenceError(
    extraInputKey,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'active input exact keys',
  );
  for (const temporalPhase1AuthorityValue of [undefined, temporalPhase1Authority()]) {
    const simultaneous = fresh();
    simultaneous.temporalPhase1Authority = temporalPhase1AuthorityValue;
    assertTerminationPhase2EvidenceError(
      simultaneous,
      TERMINATION_PHASE2_TOPOLOGY_ERROR,
      'active Phase2 rejects every own Phase1 property',
    );
  }

  const missingWrapper = fresh();
  missingWrapper.authorised_rule_components.pop();
  assertTerminationPhase2EvidenceError(
    missingWrapper,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'missing component wrapper',
  );
  const duplicateWrapper = fresh();
  duplicateWrapper.authorised_rule_components[1] = structuredClone(
    duplicateWrapper.authorised_rule_components[0],
  );
  assertTerminationPhase2EvidenceError(
    duplicateWrapper,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'duplicate component wrapper',
  );
  const reorderedWrapper = fresh();
  reorderedWrapper.authorised_rule_components.reverse();
  assertTerminationPhase2EvidenceError(
    reorderedWrapper,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'component wrapper order',
  );
  const mismatchedWrapper = fresh();
  mismatchedWrapper.authorised_rule_components[0].compiled_output = structuredClone(
    mismatchedWrapper.authorised_rule_components[1].compiled_output,
  );
  assertTerminationPhase2EvidenceError(
    mismatchedWrapper,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'component and compiler output binding',
  );
  const extraWrapper = fresh();
  extraWrapper.authorised_rule_components.push({
    component_key: 'UNKNOWN_COMPONENT',
    compiled_output: structuredClone(
      extraWrapper.authorised_rule_components[0].compiled_output,
    ),
  });
  assertTerminationPhase2EvidenceError(
    extraWrapper,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'extra unknown component wrapper',
  );
  const extraWrapperKey = fresh();
  extraWrapperKey.authorised_rule_components[0].unexpected = true;
  assertTerminationPhase2EvidenceError(
    extraWrapperKey,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'component wrapper exact keys',
  );
  const extraCompiledOutputKey = fresh();
  extraCompiledOutputKey.authorised_rule_components[0].compiled_output.unexpected = true;
  assertTerminationPhase2EvidenceError(
    extraCompiledOutputKey,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'compiled output exact keys',
  );
  const wrapperFactDrift = fresh();
  wrapperFactDrift.authorised_rule_components[0].compiled_output.facts[0].field_key =
    'DRIFT_FIELD';
  assertTerminationPhase2EvidenceError(
    wrapperFactDrift,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'compiled fact must equal independent compiler output',
  );
  const wrapperExpressionDrift = fresh();
  const wrapperExpression = wrapperExpressionDrift.authorised_rule_components[0]
    .compiled_output.expressions[0];
  wrapperExpression.operator = wrapperExpression.operator === 'ANY_OF'
    ? 'ALL_OF' : 'ANY_OF';
  assertTerminationPhase2EvidenceError(
    wrapperExpressionDrift,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'compiled expression must equal independent compiler output',
  );
  const wrapperSpanDrift = fresh();
  wrapperSpanDrift.authorised_rule_components[0]
    .compiled_output.source_spans[0].end_byte += 1;
  assertTerminationPhase2EvidenceError(
    wrapperSpanDrift,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'compiled source span must equal independent compiler output',
  );

  const reorderedStates = fresh();
  reorderedStates.temporal_defined_term_states.reverse();
  assertTerminationPhase2EvidenceError(
    reorderedStates,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'state records follow exact graph and state authority order',
  );

  const stateSelfId = fresh();
  stateSelfId.temporal_defined_term_states[0].state_id = '0'.repeat(64);
  assertTerminationPhase2EvidenceError(
    stateSelfId,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'state self ID',
  );
  const stateWrongKind = fresh();
  const conchoState = stateAt(stateWrongKind, 'CONCHO', 'C0');
  conchoState.value_ref = {
    kind: 'EXPRESSION',
    id: internal.edge_trigger_by_key.get('METSERA:M0_TO_M1').id,
  };
  phase2RestampRecord(conchoState, 'state_id');
  assertTerminationPhase2EvidenceError(
    stateWrongKind,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'state expression value must be TEMPORAL',
  );
  const duplicateOrdinal = fresh();
  const metseraM1 = stateAt(duplicateOrdinal, 'METSERA', 'M1');
  metseraM1.ordinal = 0;
  phase2RestampRecord(metseraM1, 'state_id');
  assertTerminationPhase2EvidenceError(
    duplicateOrdinal,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'duplicate state ordinal',
  );
  const gappedOrdinal = fresh();
  const skywaterS1 = stateAt(gappedOrdinal, 'SKYWATER', 'S1');
  skywaterS1.ordinal = 7;
  phase2RestampRecord(skywaterS1, 'state_id');
  assertTerminationPhase2EvidenceError(
    gappedOrdinal,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'gapped state ordinal',
  );
  const foreignState = fresh();
  const rhR0 = stateAt(foreignState, 'RH', 'R0');
  rhR0.defined_term_key = 'OUTSIDE_DATE';
  phase2RestampRecord(rhR0, 'state_id');
  assertTerminationPhase2EvidenceError(
    foreignState,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'foreign state term',
  );
  const stateSupportDrift = fresh();
  const supportDriftState = stateAt(stateSupportDrift, 'CONCHO', 'C0');
  supportDriftState.source_support_ids[0] = 'f'.repeat(64);
  phase2RestampRecord(supportDriftState, 'state_id');
  assertTerminationPhase2EvidenceError(
    stateSupportDrift,
    TERMINATION_PHASE2_PROVENANCE_ERROR,
    'state source support drift',
  );
  const wrongAgreementIndexSupport = fresh();
  const wrongIndexState = stateAt(wrongAgreementIndexSupport, 'CONCHO', 'C0');
  const conchoGraph = internal.graph_by_key.get('CONCHO');
  const conchoSupport = conchoGraph.ordered_state_templates[0].source_supports[0];
  wrongIndexState.source_support_ids[0] = phase2SupportIdForAgreementIndex(
    phase2AgreementIndexId(authority, internal.graph_by_key.get('METSERA').agreement_id),
    conchoSupport.node_occurrence_id,
    conchoSupport.source_span,
  );
  phase2RestampRecord(wrongIndexState, 'state_id');
  assertTerminationPhase2EvidenceError(
    wrongAgreementIndexSupport,
    TERMINATION_PHASE2_PROVENANCE_ERROR,
    'state support may not use another graph owner agreement index',
  );
  const incompleteK0Supports = fresh();
  const incompleteK0 = stateAt(incompleteK0Supports, 'SKECHERS', 'K0');
  incompleteK0.source_support_ids.shift();
  phase2RestampRecord(incompleteK0, 'state_id');
  assertTerminationPhase2EvidenceError(
    incompleteK0Supports,
    TERMINATION_PHASE2_PROVENANCE_ERROR,
    'Skechers K0 retains zoned-source and date supports',
  );
  const sameKindSourceFact = fresh();
  const sameKindConchoState = stateAt(sameKindSourceFact, 'CONCHO', 'C0');
  sameKindConchoState.value_ref.id = stateAt(
    sameKindSourceFact,
    'METSERA',
    'M0',
  ).value_ref.id;
  phase2RestampRecord(sameKindConchoState, 'state_id');
  assertTerminationPhase2EvidenceError(
    sameKindSourceFact,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'source state FACT identity is exact, not merely DATE typed',
  );
  const sameKindStateExpression = fresh();
  const sameKindSkywaterS1 = stateAt(sameKindStateExpression, 'SKYWATER', 'S1');
  sameKindSkywaterS1.value_ref.id = stateAt(
    sameKindStateExpression,
    'SKYWATER',
    'S2',
  ).value_ref.id;
  phase2RestampRecord(sameKindSkywaterS1, 'state_id');
  assertTerminationPhase2EvidenceError(
    sameKindStateExpression,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'derived state expression identity is exact, not merely TEMPORAL typed',
  );
  const compilerFactReuse = fresh();
  const compilerFactReuseState = stateAt(compilerFactReuse, 'CONCHO', 'C0');
  compilerFactReuseState.value_ref.id =
    compilerFactReuse.authorised_rule_components[0].compiled_output.facts[0].fact_id;
  phase2RestampRecord(compilerFactReuseState, 'state_id');
  assertTerminationPhase2EvidenceError(
    compilerFactReuse,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'compiler fact identity may not seed a graph state value',
  );
  const extraStateKey = fresh();
  const extraState = stateAt(extraStateKey, 'CONCHO', 'C0');
  extraState.unexpected = true;
  phase2RestampRecord(extraState, 'state_id');
  assertTerminationPhase2EvidenceError(
    extraStateKey,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'state exact keys',
  );
  const extraValueRefKey = fresh();
  const extraValueRefState = stateAt(extraValueRefKey, 'CONCHO', 'C0');
  extraValueRefState.value_ref.unexpected = true;
  phase2RestampRecord(extraValueRefState, 'state_id');
  assertTerminationPhase2EvidenceError(
    extraValueRefKey,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'state value_ref exact keys',
  );

  const reorderedEdges = fresh();
  reorderedEdges.temporal_state_edges.reverse();
  assertTerminationPhase2EvidenceError(
    reorderedEdges,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'edge records follow exact graph and edge authority order',
  );

  const edgeSelfId = fresh();
  edgeSelfId.temporal_state_edges[0].temporal_state_edge_id = '0'.repeat(64);
  assertTerminationPhase2EvidenceError(
    edgeSelfId,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'edge self ID',
  );
  const backwardEdge = fresh();
  const rhR0R1 = edgeAt(backwardEdge, 'RH', 'R0_TO_R1');
  [rhR0R1.predecessor_state_id, rhR0R1.successor_state_id] =
    [rhR0R1.successor_state_id, rhR0R1.predecessor_state_id];
  phase2RestampRecord(rhR0R1, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    backwardEdge,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'backward edge',
  );
  const cycle = fresh();
  const rhR1R2 = edgeAt(cycle, 'RH', 'R1_TO_R2');
  rhR1R2.successor_state_id = stateAt(cycle, 'RH', 'R0').state_id;
  phase2RestampRecord(rhR1R2, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    cycle,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'state graph cycle',
  );
  const orphanState = fresh();
  orphanState.temporal_state_edges.splice(
    internal.edge_index.get('SKYWATER:S1_TO_S2'),
    1,
  );
  assertTerminationPhase2EvidenceError(
    orphanState,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'orphan non-root state',
  );
  const nonSkechersMultiIncoming = fresh();
  const skywaterFirstEdge = edgeAt(nonSkechersMultiIncoming, 'SKYWATER', 'S0_TO_S1');
  skywaterFirstEdge.successor_state_id = stateAt(
    nonSkechersMultiIncoming,
    'SKYWATER',
    'S2',
  ).state_id;
  phase2RestampRecord(skywaterFirstEdge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    nonSkechersMultiIncoming,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'non-Skechers multi-incoming state',
  );
  const triggerNotLogical = fresh();
  const metseraEdge = edgeAt(triggerNotLogical, 'METSERA', 'M0_TO_M1');
  metseraEdge.trigger_expression_id = internal.state_value_by_key.get('RH:R0').id;
  phase2RestampRecord(metseraEdge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    triggerNotLogical,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'trigger expression must be LOGICAL',
  );
  const evaluationNotTemporal = fresh();
  const metseraEvaluationEdge = edgeAt(evaluationNotTemporal, 'METSERA', 'M0_TO_M1');
  metseraEvaluationEdge.evaluation_expression_ids[0] =
    internal.edge_trigger_by_key.get('METSERA:M0_TO_M1').id;
  phase2RestampRecord(metseraEvaluationEdge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    evaluationNotTemporal,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'evaluation expression must be TEMPORAL',
  );
  const insertedK0K1Evaluation = fresh();
  const insertedK0K1Edge = edgeAt(insertedK0K1Evaluation, 'SKECHERS', 'K0_TO_K1');
  assert.deepEqual(insertedK0K1Edge.evaluation_expression_ids, []);
  insertedK0K1Edge.evaluation_expression_ids.push(
    edgeAt(insertedK0K1Evaluation, 'SKECHERS', 'K0_TO_K2')
      .evaluation_expression_ids[0],
  );
  phase2RestampRecord(insertedK0K1Edge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    insertedK0K1Evaluation,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'Skechers fixed-date edge has no evaluation expression',
  );
  const missingEvaluation = fresh();
  const missingMetseraEvaluation = edgeAt(missingEvaluation, 'METSERA', 'M0_TO_M1');
  missingMetseraEvaluation.evaluation_expression_ids.pop();
  phase2RestampRecord(missingMetseraEvaluation, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    missingEvaluation,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'each evaluation template materialises in exact order',
  );
  const reusedEqualTrigger = fresh();
  const reusedRhTrigger = edgeAt(reusedEqualTrigger, 'RH', 'R1_TO_R2');
  reusedRhTrigger.trigger_expression_id = edgeAt(
    reusedEqualTrigger,
    'RH',
    'R0_TO_R1',
  ).trigger_expression_id;
  phase2RestampRecord(reusedRhTrigger, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    reusedEqualTrigger,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'equal trigger templates retain edge-specific identities',
  );
  const reusedEqualEvaluation = fresh();
  const reusedSkechersEvaluation = edgeAt(
    reusedEqualEvaluation,
    'SKECHERS',
    'K1_TO_K2',
  );
  reusedSkechersEvaluation.evaluation_expression_ids[0] = edgeAt(
    reusedEqualEvaluation,
    'SKECHERS',
    'K0_TO_K2',
  ).evaluation_expression_ids[0];
  phase2RestampRecord(reusedSkechersEvaluation, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    reusedEqualEvaluation,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'equal evaluation templates retain edge-specific identities',
  );
  const sameKindTrigger = fresh();
  const sameKindRhTrigger = edgeAt(sameKindTrigger, 'RH', 'R0_TO_R1');
  sameKindRhTrigger.trigger_expression_id = edgeAt(
    sameKindTrigger,
    'METSERA',
    'M0_TO_M1',
  ).trigger_expression_id;
  phase2RestampRecord(sameKindRhTrigger, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    sameKindTrigger,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'trigger identity is exact, not merely LOGICAL typed',
  );
  const sameKindEvaluation = fresh();
  const sameKindMetseraEvaluation = edgeAt(
    sameKindEvaluation,
    'METSERA',
    'M0_TO_M1',
  );
  sameKindMetseraEvaluation.evaluation_expression_ids[0] = edgeAt(
    sameKindEvaluation,
    'SKYWATER',
    'S0_TO_S1',
  ).evaluation_expression_ids[0];
  phase2RestampRecord(sameKindMetseraEvaluation, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    sameKindEvaluation,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'evaluation identity is exact, not merely TEMPORAL typed',
  );
  const edgeSupportDrift = fresh();
  const supportDriftEdge = edgeAt(edgeSupportDrift, 'METSERA', 'M0_TO_M1');
  supportDriftEdge.source_support_ids[0] = 'e'.repeat(64);
  phase2RestampRecord(supportDriftEdge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    edgeSupportDrift,
    TERMINATION_PHASE2_PROVENANCE_ERROR,
    'edge source support drift',
  );
  const extraEdgeKey = fresh();
  const extraEdge = edgeAt(extraEdgeKey, 'METSERA', 'M0_TO_M1');
  extraEdge.unexpected = true;
  phase2RestampRecord(extraEdge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    extraEdgeKey,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'edge exact keys',
  );
  const badTransition = fresh();
  const badTransitionEdge = edgeAt(badTransition, 'METSERA', 'M0_TO_M1');
  badTransitionEdge.transition_kind = 'CALLER_SELECTED';
  phase2RestampRecord(badTransitionEdge, 'temporal_state_edge_id');
  assertTerminationPhase2EvidenceError(
    badTransition,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'transition kind',
  );

  const reorderedReferences = fresh();
  reorderedReferences.temporal_state_reference_edges.reverse();
  assertTerminationPhase2EvidenceError(
    reorderedReferences,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference records follow exact 41-row authority schedule order',
  );
  const referenceSelfId = fresh();
  referenceSelfId.temporal_state_reference_edges[0].temporal_state_reference_edge_id =
    '0'.repeat(64);
  assertTerminationPhase2EvidenceError(
    referenceSelfId,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference self ID',
  );
  const wrongConsumerType = fresh();
  const wrongTypeReference = wrongConsumerType.temporal_state_reference_edges[0];
  const firstInternal = internal.reference_internal_by_row.get(1);
  const wrongTypeFactId = phase2IdentityRule(
    authority,
    'reference_consumer_fact_id_rule',
    { ...firstInternal.fact_payload, value_type: 'DATE' },
  );
  const wrongTypeDependencyId = phase2IdentityRule(
    authority,
    'reference_consumer_dependency_id_rule',
    { ...firstInternal.dependency_payload, consumer_fact_id: wrongTypeFactId },
  );
  wrongTypeReference.consumer_fact_id = wrongTypeFactId;
  wrongTypeReference.consumer_dependency_id = wrongTypeDependencyId;
  wrongTypeReference.consumer_context_edge_id = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    {
      ...firstInternal.context_payload,
      consumer_fact_id: wrongTypeFactId,
      consumer_dependency_id: wrongTypeDependencyId,
    },
  );
  phase2RestampRecord(wrongTypeReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    wrongConsumerType,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference consumer must be REFERENCE typed',
  );
  const wrongTypedTarget = fresh();
  const wrongTypedTargetReference = wrongTypedTarget.temporal_state_reference_edges[0];
  const wrongTypedTargetFactPayload = {
    ...firstInternal.fact_payload,
    typed_value: '0'.repeat(64),
  };
  const wrongTypedTargetFactId = phase2IdentityRule(
    authority,
    'reference_consumer_fact_id_rule',
    wrongTypedTargetFactPayload,
  );
  const wrongTypedTargetDependencyPayload = {
    ...firstInternal.dependency_payload,
    consumer_fact_id: wrongTypedTargetFactId,
    target_semantic_fact_key: wrongTypedTargetFactPayload.typed_value,
  };
  const wrongTypedTargetDependencyId = phase2IdentityRule(
    authority,
    'reference_consumer_dependency_id_rule',
    wrongTypedTargetDependencyPayload,
  );
  const wrongTypedTargetContextId = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    {
      ...firstInternal.context_payload,
      consumer_fact_id: wrongTypedTargetFactId,
      consumer_dependency_id: wrongTypedTargetDependencyId,
    },
  );
  wrongTypedTargetReference.consumer_fact_id = wrongTypedTargetFactId;
  wrongTypedTargetReference.consumer_dependency_id = wrongTypedTargetDependencyId;
  wrongTypedTargetReference.consumer_context_edge_id = wrongTypedTargetContextId;
  phase2RestampRecord(wrongTypedTargetReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    wrongTypedTarget,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference typed value is the native graph-owner semantic fact key',
  );
  const wrongOwnership = fresh();
  const wrongOwnerReference = wrongOwnership.temporal_state_reference_edges[0];
  const wrongOwnerFactId = phase2IdentityRule(
    authority,
    'reference_consumer_fact_id_rule',
    { ...firstInternal.fact_payload, consumer_rule_id: '0'.repeat(64) },
  );
  const wrongOwnerDependencyId = phase2IdentityRule(
    authority,
    'reference_consumer_dependency_id_rule',
    { ...firstInternal.dependency_payload, consumer_fact_id: wrongOwnerFactId },
  );
  wrongOwnerReference.consumer_fact_id = wrongOwnerFactId;
  wrongOwnerReference.consumer_dependency_id = wrongOwnerDependencyId;
  wrongOwnerReference.consumer_context_edge_id = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    {
      ...firstInternal.context_payload,
      consumer_fact_id: wrongOwnerFactId,
      consumer_dependency_id: wrongOwnerDependencyId,
    },
  );
  phase2RestampRecord(wrongOwnerReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    wrongOwnership,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference fact owner mismatch',
  );
  const wrongDependencyTarget = fresh();
  const wrongDependencyReference = wrongDependencyTarget.temporal_state_reference_edges[0];
  const wrongDependencyId = phase2IdentityRule(
    authority,
    'reference_consumer_dependency_id_rule',
    { ...firstInternal.dependency_payload, target_semantic_fact_key: '0'.repeat(64) },
  );
  wrongDependencyReference.consumer_dependency_id = wrongDependencyId;
  wrongDependencyReference.consumer_context_edge_id = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    { ...firstInternal.context_payload, consumer_dependency_id: wrongDependencyId },
  );
  phase2RestampRecord(wrongDependencyReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    wrongDependencyTarget,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference dependency target mismatch',
  );
  const wrongContextTarget = fresh();
  const wrongContextReference = wrongContextTarget.temporal_state_reference_edges[0];
  wrongContextReference.consumer_context_edge_id = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    { ...firstInternal.context_payload, consumer_dependency_id: '0'.repeat(64) },
  );
  phase2RestampRecord(wrongContextReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    wrongContextTarget,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference context target mismatch',
  );
  const stateSubset = fresh();
  const stateSubsetReference = stateSubset.temporal_state_reference_edges[0];
  stateSubsetReference.state_ids.pop();
  phase2RestampRecord(stateSubsetReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    stateSubset,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference full state closure',
  );
  const stateReorder = fresh();
  const stateReorderReference = stateReorder.temporal_state_reference_edges[0];
  stateReorderReference.state_ids.reverse();
  phase2RestampRecord(stateReorderReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    stateReorder,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference state order',
  );
  const edgeSubset = fresh();
  const edgeSubsetReference = edgeSubset.temporal_state_reference_edges[0];
  edgeSubsetReference.transition_edge_ids.pop();
  phase2RestampRecord(edgeSubsetReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    edgeSubset,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference full edge closure',
  );
  const edgeReorder = fresh();
  const edgeReorderReference = edgeReorder.temporal_state_reference_edges[0];
  edgeReorderReference.transition_edge_ids.reverse();
  phase2RestampRecord(edgeReorderReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    edgeReorder,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference edge order',
  );
  const falseNativeResolution = fresh();
  const falseNativeReference = falseNativeResolution.temporal_state_reference_edges[0];
  const falseNativeDependencyId = phase2IdentityRule(
    authority,
    'reference_consumer_dependency_id_rule',
    {
      ...firstInternal.dependency_payload,
      native_m3_resolution: 'RESOLVED',
      native_m3_definition_edge_id: '0'.repeat(64),
    },
  );
  falseNativeReference.consumer_dependency_id = falseNativeDependencyId;
  falseNativeReference.consumer_context_edge_id = phase2IdentityRule(
    authority,
    'reference_consumer_context_edge_id_rule',
    { ...firstInternal.context_payload, consumer_dependency_id: falseNativeDependencyId },
  );
  phase2RestampRecord(falseNativeReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    falseNativeResolution,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'unresolved reference may not claim native M3 resolution',
  );
  const wrongSourceRoleOrdinal = fresh();
  const ordinalRow = structuredClone(
    authority.temporal_state_reference_occurrence_schedule[0],
  );
  ordinalRow.source_role_occurrence_ordinal += 1;
  wrongSourceRoleOrdinal.temporal_state_reference_edges[0] =
    referenceForScheduleRow(ordinalRow);
  assertTerminationPhase2EvidenceError(
    wrongSourceRoleOrdinal,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference source-role occurrence ordinal is exact',
  );
  const wrongSourceRoleField = fresh();
  const fieldRow = structuredClone(
    authority.temporal_state_reference_occurrence_schedule[0],
  );
  fieldRow.field_key = 'DRIFT_REFERENCE_FIELD';
  wrongSourceRoleField.temporal_state_reference_edges[0] =
    referenceForScheduleRow(fieldRow);
  assertTerminationPhase2EvidenceError(
    wrongSourceRoleField,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference source-role field is exact',
  );
  const skywaterSubtermPromotion = fresh();
  const skywaterRow30 = structuredClone(
    authority.temporal_state_reference_occurrence_schedule[29],
  );
  assert.equal(skywaterRow30.row, 30);
  assert.equal(
    skywaterRow30.native_m3_resolution,
    'UNRESOLVED_FULL_TERM_SUBTERM_ONLY_EDGE',
  );
  skywaterRow30.native_m3_resolution = 'RESOLVED';
  skywaterRow30.native_m3_definition_edge_id =
    skywaterRow30.native_m3_subterm_edge_id;
  skywaterRow30.native_m3_subterm_edge_id = null;
  skywaterSubtermPromotion.temporal_state_reference_edges[29] =
    referenceForScheduleRow(skywaterRow30);
  assertTerminationPhase2EvidenceError(
    skywaterSubtermPromotion,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'SkyWater full Extended End Date may not inherit a subterm-only M3 edge',
  );
  const duplicateConsumerIdentity = fresh();
  const firstReference = duplicateConsumerIdentity.temporal_state_reference_edges[0];
  const secondReference = duplicateConsumerIdentity.temporal_state_reference_edges[1];
  for (const key of [
    'consumer_rule_id',
    'consumer_fact_id',
    'consumer_dependency_id',
    'consumer_context_edge_id',
  ]) {
    secondReference[key] = firstReference[key];
  }
  phase2RestampRecord(secondReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    duplicateConsumerIdentity,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'same-count duplicate consumer identity',
  );
  const referenceSupportDrift = fresh();
  const supportDriftReference = referenceSupportDrift.temporal_state_reference_edges[0];
  supportDriftReference.source_support_ids[0] = 'f'.repeat(64);
  phase2RestampRecord(supportDriftReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    referenceSupportDrift,
    TERMINATION_PHASE2_PROVENANCE_ERROR,
    'reference source span/hash identity',
  );
  const extraReferenceKey = fresh();
  const extraReference = extraReferenceKey.temporal_state_reference_edges[0];
  extraReference.operative_state = extraReference.state_ids[0];
  phase2RestampRecord(extraReference, 'temporal_state_reference_edge_id');
  assertTerminationPhase2EvidenceError(
    extraReferenceKey,
    TERMINATION_PHASE2_REFERENCE_ERROR,
    'reference exact keys forbid operative_state',
  );

  const omittedScheduleRow = fresh();
  omittedScheduleRow.temporal_state_reference_edges.pop();
  assertTerminationPhase2EvidenceError(
    omittedScheduleRow,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'omitted schedule row',
  );
  const duplicateScheduleRow = fresh();
  duplicateScheduleRow.temporal_state_reference_edges.push(structuredClone(
    duplicateScheduleRow.temporal_state_reference_edges[0],
  ));
  assertTerminationPhase2EvidenceError(
    duplicateScheduleRow,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'duplicate schedule row',
  );
  const promotedExclusion = fresh();
  const exclusion = authority.state_transition_only_exclusions[0];
  const exclusionGraph = internal.graph_by_key.get(exclusion.graph_key);
  promotedExclusion.temporal_state_reference_edges.push(
    phase2MaterialiseReference(
      authority,
      exclusionGraph,
      {
        row: 42,
        graph_key: exclusion.graph_key,
        consumer_rule_key: 'PROMOTED_STATE_TRANSITION_ONLY_OCCURRENCE',
        field_key: 'PROMOTED_TEMPORAL_STATE_REFERENCE',
        source_role_occurrence_ordinal: 1,
        source_node_occurrence_id: exclusion.source_node_occurrence_id,
        source_span: exclusion.source_span,
        native_m3_resolution: 'UNRESOLVED_NO_EXACT_EDGE',
        native_m3_definition_edge_id: null,
        native_m3_subterm_edge_id: null,
      },
      structuredClone(internal.state_ids_by_graph.get(exclusion.graph_key)),
      structuredClone(internal.edge_ids_by_graph.get(exclusion.graph_key)),
    ).record,
  );
  assertTerminationPhase2EvidenceError(
    promotedExclusion,
    TERMINATION_PHASE2_TOPOLOGY_ERROR,
    'transition-only exclusion promoted to a consumer',
  );

  const legacyInput = validNestedEvidence();
  const legacyResult = validateSyntheticExpressionEvidence(legacyInput);
  const ownUndefinedLegacy = structuredClone(legacyInput);
  ownUndefinedLegacy.terminationAuthoringPhase2Authority = undefined;
  const ownUndefinedLegacyBefore = structuredClone(ownUndefinedLegacy);
  assert.deepEqual(validateSyntheticExpressionEvidence(ownUndefinedLegacy), legacyResult);
  assert.deepEqual(ownUndefinedLegacy, ownUndefinedLegacyBefore);
  assert.equal(Object.hasOwn(
    ownUndefinedLegacy,
    'terminationAuthoringPhase2Authority',
  ), true);

  const phase1Input = validTemporalPhase1CiiEvidence();
  const phase1Result = validateSyntheticExpressionEvidence(phase1Input);
  const ownUndefinedPhase1 = structuredClone(phase1Input);
  ownUndefinedPhase1.terminationAuthoringPhase2Authority = undefined;
  const ownUndefinedPhase1Before = structuredClone(ownUndefinedPhase1);
  assert.deepEqual(validateSyntheticExpressionEvidence(ownUndefinedPhase1), phase1Result);
  assert.deepEqual(ownUndefinedPhase1, ownUndefinedPhase1Before);
  assert.equal(Object.hasOwn(
    ownUndefinedPhase1,
    'terminationAuthoringPhase2Authority',
  ), true);
});
