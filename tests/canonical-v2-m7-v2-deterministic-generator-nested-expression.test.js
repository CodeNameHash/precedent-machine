'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  compileSyntheticProfileExpression,
  generateAnalysisV2,
} = require('../lib/canonical-v2/m7-v2-deterministic-generator');
const {
  validateSyntheticExpressionEvidence,
} = require('../lib/canonical-v2/m7-v2-contract');

function selector(text, quote) {
  const characterStart = text.indexOf(quote);
  assert.notEqual(characterStart, -1);
  assert.equal(text.indexOf(quote, characterStart + 1), -1);
  const startByte = Buffer.byteLength(text.slice(0, characterStart), 'utf8');
  return {
    start_byte: startByte,
    end_byte: startByte + Buffer.byteLength(quote, 'utf8'),
    quote,
  };
}

function sourceFact(
  text, fieldKey, quote, typedValue, valueType, legalSubject,
) {
  return {
    field_key: fieldKey,
    value_type: valueType,
    typed_value: typedValue,
    legal_subject: legalSubject,
    selector: selector(text, quote),
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const REPO_ROOT = join(__dirname, '..');
const TEMPORAL_PHASE1_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-temporal-phase1-authority.json';
const D_SIGNATURE = 'ANY_OF(NOT(CAPABLE(BEFORE(CAPABILITY_CURE_EVENT,'
  + 'CAPABILITY_TERMINATION_DATE))),NOT(ON_OR_BEFORE(DEADLINE_CURE_EVENT,'
  + 'EARLIER_OF(DEADLINE_TERMINATION_DATE,OFFSET_AFTER(BREACH_NOTICE_EVENT,'
  + 'CURE_PERIOD)))))';

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
      sha256: sha256(bytes),
    },
    record,
  };
}

function equivalenceMapping() {
  return Object.fromEntries([
    'actor', 'effect', 'standard', 'threshold', 'timing', 'conditions', 'qualifications',
  ].map((slot) => [slot, {
    field_keys: slot === 'actor' ? ['APPLIES_TO']
      : slot === 'effect' ? ['LEGAL_EFFECT']
        : slot === 'timing' ? ['OUTSIDE_DATE'] : [],
    expression_signature_role: slot === 'conditions' ? 'CANONICAL_EXPRESSION' : null,
  }]));
}

function injectedAnalysisInput() {
  const text = 'Parent,and,shall,or,2027-01-01';
  const textBytes = Buffer.from(text, 'utf8');
  const profile = {
    profile_id: 'fixture-profile',
    profile_key: 'FIXTURE_NESTED_RIGHT',
    family_key: 'TERMINATION',
    parent_profile_id: null,
    subtype_path: ['TERMINATION', 'TERMINATION_RIGHT', 'FIXTURE_NESTED_RIGHT'],
    match_test: {
      kind: 'SOURCE_TOKEN_ALL',
      tokens: ['parent', 'shall'],
      leaf_id: 'fixture-match-leaf',
    },
    allowed_source_types: [{ source_type: 'PROVISION' }],
    allowed_operators: ['ALL_OF', 'ANY_OF'],
    required_expression_signature:
      'ALL_OF(APPLIES_TO,ANY_OF(LEGAL_EFFECT,OUTSIDE_DATE))',
    required_fields: [
      {
        field_key: 'APPLIES_TO', value_type: 'PARTY_SET', materiality: 'MATERIAL',
        cardinality: 'ONE',
      },
      {
        field_key: 'LEGAL_EFFECT', value_type: 'ENUM', materiality: 'MATERIAL',
        cardinality: 'ONE',
      },
      {
        field_key: 'OUTSIDE_DATE', value_type: 'DATE', materiality: 'MATERIAL',
        cardinality: 'ONE',
      },
    ],
    optional_fields: [],
    minimum_floor_fields: ['APPLIES_TO', 'LEGAL_EFFECT'],
    child_rule_profiles: [],
    allowed_dependency_types: [],
    conditional_requirements: [],
    equivalence_signature_mapping: equivalenceMapping(),
  };
  return {
    baseAnalysis: {
      agreement_id: 'fixture-agreement',
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      context_compilation_binding: { context_compilation_id: 'fixture-context' },
      claims: [{
        claim_occurrence_id: 'fixture-occurrence',
        source_node_occurrence_ids: ['fixture-node'],
      }],
    },
    agreementIndex: {
      agreement_index_id: 'fixture-index',
      __binding: { path: 'in-memory-index' },
      source_binding: {
        agreement_id: 'fixture-agreement',
        canonical_text: text,
        canonical_text_id: 'fixture-canonical-text',
        canonical_text_sha256: sha256(textBytes),
        canonical_text_byte_length: textBytes.length,
      },
      nodes: [{
        node_occurrence_id: 'fixture-node',
        node_kind: 'PROVISION',
        extent_span: {
          coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
          start_byte: 0,
          end_byte: textBytes.length,
          text_sha256: sha256(textBytes),
        },
      }],
    },
    contextCompilation: {
      context_compilation_id: 'fixture-context',
      agreement_index_binding: { agreement_index_id: 'fixture-index' },
      semantic_relationships: [],
      reference_edges: [],
      definition_edges: [],
    },
    approvedFamilyPackets: { families: [{ family_key: 'TERMINATION' }] },
    approvedFamilyProfileSet: {
      __binding: { path: 'in-memory-profile-set' },
      profiles: [profile],
      subtype_tree_bindings: [{
        family_key: 'TERMINATION', binding: { path: 'in-memory-tree' },
      }],
    },
    approvedStructureDispositions: { members: [] },
    governance: { source: 'IN_MEMORY_SYNTHETIC_TEST' },
    syntheticExpressionPayloads: [{
      input_occurrence_id: 'fixture-occurrence',
      source: {
        text,
        facts: [
          sourceFact(
            text, 'APPLIES_TO', 'Parent', { parties: ['PARENT'] }, 'PARTY_SET', 'PARENT',
          ),
          sourceFact(text, 'LEGAL_EFFECT', 'shall', 'TERMINATE', 'ENUM', 'COMPANY'),
          sourceFact(
            text, 'OUTSIDE_DATE', '2027-01-01', '2027-01-01', 'DATE', 'COMPANY',
          ),
        ],
        expression: {
          operator: 'ALL_OF',
          selector: selector(text, ',and,'),
          children: [
            { fact_key: 'APPLIES_TO' },
            {
              operator: 'ANY_OF',
              selector: selector(text, ',or,'),
              children: [{ fact_key: 'LEGAL_EFFECT' }, { fact_key: 'OUTSIDE_DATE' }],
            },
          ],
        },
      },
    }],
  };
}

test('synthetic profile compiler preserves nested ALL_OF and ANY_OF source logic', () => {
  const text = 'TRIGGER ROOT_AND TEST_A INNER_OR TEST_B';
  const input = {
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-profile',
      allowed_operators: ['ALL_OF', 'ANY_OF'],
      required_expression_signature: 'ALL_OF(TRIGGER,ANY_OF(TEST_A,TEST_B))',
    },
    source: {
      text,
      facts: [
        sourceFact(text, 'TRIGGER', 'TRIGGER', true, 'BOOLEAN', 'COMPANY'),
        sourceFact(text, 'TEST_A', 'TEST_A', true, 'BOOLEAN', 'COMPANY'),
        sourceFact(text, 'TEST_B', 'TEST_B', true, 'BOOLEAN', 'COMPANY'),
      ],
      expression: {
        operator: 'ALL_OF',
        selector: selector(text, 'ROOT_AND'),
        children: [
          { fact_key: 'TRIGGER' },
          {
            operator: 'ANY_OF',
            selector: selector(text, 'INNER_OR'),
            children: [{ fact_key: 'TEST_A' }, { fact_key: 'TEST_B' }],
          },
        ],
      },
    },
  };
  const before = structuredClone(input);

  const result = compileSyntheticProfileExpression(input);

  assert.deepEqual(input, before);
  assert.equal(result.expression_signature, input.profile.required_expression_signature);
  assert.equal(result.facts.length, 3);
  assert.equal(result.expressions.length, 2);
  const root = result.expressions.find(
    (expression) => expression.expression_id === result.root_expression_id,
  );
  const nested = result.expressions.find(
    (expression) => expression.expression_id !== result.root_expression_id,
  );
  assert.equal(root.operator, 'ALL_OF');
  assert.deepEqual(root.children.map((child) => [child.kind, child.role]), [
    ['FACT', 'MEMBER'],
    ['EXPRESSION', 'MEMBER'],
  ]);
  assert.equal(root.parent_expression_id, null);
  assert.equal(nested.operator, 'ANY_OF');
  assert.equal(nested.parent_expression_id, root.expression_id);
  assert.deepEqual(nested.children.map((child) => [child.kind, child.role]), [
    ['FACT', 'MEMBER'],
    ['FACT', 'MEMBER'],
  ]);
  const sourceBytes = Buffer.from(text, 'utf8');
  assert.deepEqual(result.source_spans.map((span) => sourceBytes.subarray(
    span.start_byte, span.end_byte,
  ).toString('utf8')), ['TRIGGER', 'ROOT_AND', 'TEST_A', 'INNER_OR', 'TEST_B']);
  assert.deepEqual([root, nested].map((expression) => {
    const connective = result.source_spans.find(
      (span) => span.span_id === expression.connective_span_ids[0],
    );
    return sourceBytes.subarray(connective.start_byte, connective.end_byte).toString('utf8');
  }), ['ROOT_AND', 'INNER_OR']);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.expressions.every(Object.isFrozen), true);
});

test('synthetic profile compiler rejects the same child twice', () => {
  const text = 'TRIGGER AND TEST';

  assert.throws(() => compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-profile',
      allowed_operators: ['ALL_OF'],
      required_expression_signature: 'ALL_OF(TRIGGER,TRIGGER)',
    },
    source: {
      text,
      facts: [
        sourceFact(text, 'TRIGGER', 'TRIGGER', true, 'BOOLEAN', 'COMPANY'),
        sourceFact(text, 'TEST', 'TEST', true, 'BOOLEAN', 'COMPANY'),
      ],
      expression: {
        operator: 'ALL_OF',
        selector: selector(text, 'AND'),
        children: [{ fact_key: 'TRIGGER' }, { fact_key: 'TRIGGER' }],
      },
    },
  }), /same child twice/u);
});

test('synthetic profile compiler requires an explicit legal subject for every fact', () => {
  const text = 'TRIGGER AND TEST';
  const trigger = sourceFact(text, 'TRIGGER', 'TRIGGER', true, 'BOOLEAN', 'COMPANY');
  delete trigger.legal_subject;

  assert.throws(() => compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-profile',
      allowed_operators: ['ALL_OF'],
      required_expression_signature: 'ALL_OF(TRIGGER,TEST)',
    },
    source: {
      text,
      facts: [
        trigger,
        sourceFact(text, 'TEST', 'TEST', true, 'BOOLEAN', 'COMPANY'),
      ],
      expression: {
        operator: 'ALL_OF',
        selector: selector(text, 'AND'),
        children: [{ fact_key: 'TRIGGER' }, { fact_key: 'TEST' }],
      },
    },
  }), /source fact is invalid or duplicated/u);
});

test('synthetic legal subject participates in semantic and equivalence identity', () => {
  const parentAnalysis = generateAnalysisV2(injectedAnalysisInput());
  const companyInput = injectedAnalysisInput();
  companyInput.syntheticExpressionPayloads[0].source.facts.find(
    (fact) => fact.field_key === 'APPLIES_TO',
  ).legal_subject = 'COMPANY';

  const companyAnalysis = generateAnalysisV2(companyInput);
  const parentFact = parentAnalysis.facts.find((fact) => fact.field_key === 'APPLIES_TO');
  const companyFact = companyAnalysis.facts.find((fact) => fact.field_key === 'APPLIES_TO');

  assert.equal(parentFact.legal_subject, 'PARENT');
  assert.equal(companyFact.legal_subject, 'COMPANY');
  assert.notEqual(parentFact.semantic_fact_key, companyFact.semantic_fact_key);
  assert.notEqual(parentFact.fact_id, companyFact.fact_id);
  assert.notDeepEqual(
    parentAnalysis.rules[0].equivalence_signature,
    companyAnalysis.rules[0].equivalence_signature,
  );
});

test('synthetic profile compiler preserves a source-backed NOT qualification', () => {
  const text = 'NOT_MARKER BLOCKER';
  const result = compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-not-profile',
      allowed_operators: ['NOT'],
      required_expression_signature: 'NOT(BLOCKER)',
    },
    source: {
      text,
      facts: [sourceFact(text, 'BLOCKER', 'BLOCKER', false, 'BOOLEAN', 'COMPANY')],
      expression: {
        operator: 'NOT',
        selector: selector(text, 'NOT_MARKER'),
        children: [{ fact_key: 'BLOCKER' }],
      },
    },
  });

  assert.equal(result.expressions.length, 1);
  assert.equal(result.expressions[0].operator, 'NOT');
  assert.deepEqual(result.expressions[0].children.map((child) => child.role), ['NEGATED']);
  assert.equal(result.expression_signature, 'NOT(BLOCKER)');
});

test('synthetic profile compiler preserves IF_THEN condition and consequence roles', () => {
  const text = 'CONDITION IF_MARKER CONSEQUENCE';
  const result = compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-if-profile',
      allowed_operators: ['IF_THEN'],
      required_expression_signature: 'IF_THEN(CONDITION,CONSEQUENCE)',
    },
    source: {
      text,
      facts: [
        sourceFact(text, 'CONDITION', 'CONDITION', true, 'BOOLEAN', 'COMPANY'),
        sourceFact(text, 'CONSEQUENCE', 'CONSEQUENCE', true, 'BOOLEAN', 'COMPANY'),
      ],
      expression: {
        operator: 'IF_THEN',
        selector: selector(text, 'IF_MARKER'),
        children: [{ fact_key: 'CONDITION' }, { fact_key: 'CONSEQUENCE' }],
      },
    },
  });

  assert.equal(result.expressions[0].operator, 'IF_THEN');
  assert.deepEqual(result.expressions[0].children.map((child) => child.role), [
    'CONDITION',
    'CONSEQUENCE',
  ]);
  assert.equal(result.expression_signature, 'IF_THEN(CONDITION,CONSEQUENCE)');
});

test('synthetic profile compiler preserves a Termination exception around a conditional right', () => {
  const text = 'BREACH_STANDARD THEN LEGAL_EFFECT UNLESS_MARKER PARENT_BREACH_EXCEPTION';
  const result = compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-profile',
      allowed_operators: ['EXCEPTION_TO', 'IF_THEN'],
      required_expression_signature:
        'EXCEPTION_TO(IF_THEN(BREACH_STANDARD,LEGAL_EFFECT),PARENT_BREACH_EXCEPTION)',
    },
    source: {
      text,
      facts: [
        sourceFact(
          text, 'BREACH_STANDARD', 'BREACH_STANDARD', true, 'BOOLEAN', 'COMPANY',
        ),
        sourceFact(text, 'LEGAL_EFFECT', 'LEGAL_EFFECT', 'TERMINATE', 'ENUM', 'COMPANY'),
        sourceFact(
          text, 'PARENT_BREACH_EXCEPTION', 'PARENT_BREACH_EXCEPTION', true,
          'BOOLEAN', 'PARENT',
        ),
      ],
      expression: {
        operator: 'EXCEPTION_TO',
        selector: selector(text, 'UNLESS_MARKER'),
        children: [
          {
            operator: 'IF_THEN',
            selector: selector(text, 'THEN'),
            children: [{ fact_key: 'BREACH_STANDARD' }, { fact_key: 'LEGAL_EFFECT' }],
          },
          { fact_key: 'PARENT_BREACH_EXCEPTION' },
        ],
      },
    },
  });

  const root = result.expressions.find(
    (expression) => expression.expression_id === result.root_expression_id,
  );
  const conditional = result.expressions.find(
    (expression) => expression.parent_expression_id === root.expression_id,
  );
  assert.equal(result.expression_signature,
    'EXCEPTION_TO(IF_THEN(BREACH_STANDARD,LEGAL_EFFECT),PARENT_BREACH_EXCEPTION)');
  assert.deepEqual(root.children.map((child) => child.role), ['BASE', 'EXCEPTION']);
  assert.deepEqual(conditional.children.map((child) => child.role), [
    'CONDITION', 'CONSEQUENCE',
  ]);
});

test('synthetic profile compiler preserves a nested EARLIER_OF deadline', () => {
  const text = 'CUREABLE IF_MARKER TERMINATION_DATE EARLIER NOTICE_PERIOD_END';
  const result = compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-earlier-profile',
      allowed_operators: ['IF_THEN', 'EARLIER_OF'],
      required_expression_signature:
        'IF_THEN(CUREABLE,EARLIER_OF(TERMINATION_DATE,NOTICE_PERIOD_END))',
    },
    source: {
      text,
      facts: [
        sourceFact(text, 'CUREABLE', 'CUREABLE', true, 'BOOLEAN', 'COMPANY'),
        sourceFact(
          text, 'TERMINATION_DATE', 'TERMINATION_DATE', '2027-01-01', 'DATE', 'COMPANY',
        ),
        sourceFact(
          text, 'NOTICE_PERIOD_END', 'NOTICE_PERIOD_END', '2026-12-15', 'DATE', 'COMPANY',
        ),
      ],
      expression: {
        operator: 'IF_THEN',
        selector: selector(text, 'IF_MARKER'),
        children: [
          { fact_key: 'CUREABLE' },
          {
            operator: 'EARLIER_OF',
            selector: selector(text, 'EARLIER'),
            children: [
              { fact_key: 'TERMINATION_DATE' },
              { fact_key: 'NOTICE_PERIOD_END' },
            ],
          },
        ],
      },
    },
  });

  const root = result.expressions.find(
    (expression) => expression.expression_id === result.root_expression_id,
  );
  const deadline = result.expressions.find(
    (expression) => expression.operator === 'EARLIER_OF',
  );
  assert.equal(root.result_kind, 'LOGICAL');
  assert.equal(deadline.result_kind, 'TEMPORAL');
  assert.equal(deadline.parent_expression_id, root.expression_id);
  assert.deepEqual(deadline.children.map((child) => child.role), ['MEMBER', 'MEMBER']);
  assert.equal(
    result.expression_signature,
    'IF_THEN(CUREABLE,EARLIER_OF(TERMINATION_DATE,NOTICE_PERIOD_END))',
  );
});

test('synthetic base compiler preserves legacy DEFINED_TERM facts without Phase 1 authority', () => {
  const text = 'TERMINATION_DATE AND_MARKER OPERATIVE_EVENT';
  const result = compileSyntheticProfileExpression({
    agreement_id: 'fixture-agreement',
    agreement_index_id: 'fixture-index',
    source_node_occurrence_id: 'fixture-node',
    profile: {
      profile_id: 'fixture-defined-term-profile',
      allowed_operators: ['ALL_OF'],
      required_expression_signature: 'ALL_OF(TERMINATION_DATE,OPERATIVE_EVENT)',
    },
    source: {
      text,
      facts: [
        sourceFact(
          text, 'TERMINATION_DATE', 'TERMINATION_DATE',
          'Termination Date', 'DEFINED_TERM', 'COMPANY',
        ),
        sourceFact(
          text, 'OPERATIVE_EVENT', 'OPERATIVE_EVENT', true, 'BOOLEAN', 'COMPANY',
        ),
      ],
      expression: {
        operator: 'ALL_OF',
        selector: selector(text, 'AND_MARKER'),
        children: [
          { fact_key: 'TERMINATION_DATE' },
          { fact_key: 'OPERATIVE_EVENT' },
        ],
      },
    },
  });

  assert.equal(result.expression_signature, 'ALL_OF(TERMINATION_DATE,OPERATIVE_EVENT)');
  assert.equal(
    result.facts.find((fact) => fact.field_key === 'TERMINATION_DATE').value_type,
    'DEFINED_TERM',
  );
  assert.equal(result.expressions[0].result_kind, 'LOGICAL');
});

function redHatTemporalDInput() {
  const temporalPhase1AuthorityEnvelope = temporalPhase1Authority();
  const temporalSourceNode =
    temporalPhase1AuthorityEnvelope.record.red_hat_source_authority.exact_m2_nodes.find(
      (node) => node.purpose === '7_01_D_TEMPORAL_RULE_SOURCE',
    );
  const thirtyBusinessDaysSupport =
    temporalPhase1AuthorityEnvelope.record.red_hat_source_authority.exact_support_spans.find(
      (support) => support.label === 'D_THIRTY_BUSINESS_DAYS',
    ).source_span;
  const durationRule =
    temporalPhase1AuthorityEnvelope.record.policy_overlay.duration_normalisation;
  const text = [
    'CAPABILITY_CURE_EVENT',
    'STRICT_MARKER',
    'CAPABILITY_TERMINATION_DATE',
    'CAPABLE_MARKER',
    'NEGATE_CAPABILITY',
    'ROOT_ANY',
    'DEADLINE_CURE_EVENT',
    'INCLUSIVE_MARKER',
    'DEADLINE_TERMINATION_DATE',
    'EARLIEST_MARKER',
    'BREACH_NOTICE_EVENT',
    'AFTER_NOTICE_MARKER',
    'thirty (30) Business Days',
    'NEGATE_DEADLINE',
  ].join(' | ');
  const input = {
    temporalPhase1Authority: temporalPhase1AuthorityEnvelope,
    agreement_id: 'synthetic-red-hat-agreement',
    agreement_index_id: 'synthetic-red-hat-index',
    source_node_occurrence_id: temporalSourceNode.node_occurrence_id,
    profile: {
      profile_id: 'synthetic-red-hat-7-01-d-temporal-profile',
      allowed_operators: [
        'ANY_OF',
        'NOT',
        'CAPABLE',
        'BEFORE',
        'ON_OR_BEFORE',
        'EARLIER_OF',
        'OFFSET_AFTER',
      ],
      required_expression_signature: D_SIGNATURE,
    },
    source: {
      text,
      facts: [
        sourceFact(
          text,
          'CAPABILITY_CURE_EVENT',
          'CAPABILITY_CURE_EVENT',
          'CAPABILITY_CURE_EVENT',
          'ENUM',
          'COMPANY',
        ),
        sourceFact(
          text,
          'CAPABILITY_TERMINATION_DATE',
          'CAPABILITY_TERMINATION_DATE',
          'Termination Date',
          'DEFINED_TERM',
          'COMPANY',
        ),
        sourceFact(
          text,
          'DEADLINE_CURE_EVENT',
          'DEADLINE_CURE_EVENT',
          'DEADLINE_CURE_EVENT',
          'ENUM',
          'COMPANY',
        ),
        sourceFact(
          text,
          'DEADLINE_TERMINATION_DATE',
          'DEADLINE_TERMINATION_DATE',
          'Termination Date',
          'DEFINED_TERM',
          'COMPANY',
        ),
        sourceFact(
          text,
          'BREACH_NOTICE_EVENT',
          'BREACH_NOTICE_EVENT',
          'BREACH_NOTICE_EVENT',
          'ENUM',
          'COMPANY',
        ),
        {
          ...sourceFact(
            text,
            'CURE_PERIOD',
            'thirty (30) Business Days',
            { bound_type: 'EXACT', count: 30, unit: 'BUSINESS_DAY' },
            'DURATION',
            'COMPANY',
          ),
          normalisation_rule_id: durationRule.normalisation_rule_id,
          authority_source_support: thirtyBusinessDaysSupport,
        },
      ],
      expression: {
        operator: 'ANY_OF',
        selector: selector(text, 'ROOT_ANY'),
        children: [
          {
            operator: 'NOT',
            selector: selector(text, 'NEGATE_CAPABILITY'),
            children: [{
              operator: 'CAPABLE',
              selector: selector(text, 'CAPABLE_MARKER'),
              children: [{
                operator: 'BEFORE',
                selector: selector(text, 'STRICT_MARKER'),
                children: [
                  { fact_key: 'CAPABILITY_CURE_EVENT' },
                  { fact_key: 'CAPABILITY_TERMINATION_DATE' },
                ],
              }],
            }],
          },
          {
            operator: 'NOT',
            selector: selector(text, 'NEGATE_DEADLINE'),
            children: [{
              operator: 'ON_OR_BEFORE',
              selector: selector(text, 'INCLUSIVE_MARKER'),
              children: [
                { fact_key: 'DEADLINE_CURE_EVENT' },
                {
                  operator: 'EARLIER_OF',
                  selector: selector(text, 'EARLIEST_MARKER'),
                  children: [
                    { fact_key: 'DEADLINE_TERMINATION_DATE' },
                    {
                      operator: 'OFFSET_AFTER',
                      selector: selector(text, 'AFTER_NOTICE_MARKER'),
                      children: [
                        { fact_key: 'BREACH_NOTICE_EVENT' },
                        { fact_key: 'CURE_PERIOD' },
                      ],
                    },
                  ],
                },
              ],
            }],
          },
        ],
      },
    },
  };
  return input;
}

test('synthetic Phase 1 Red Hat 7.01(d) preserves capability and earlier-of cure timing', () => {
  const input = redHatTemporalDInput();
  const before = structuredClone(input);

  const result = compileSyntheticProfileExpression(input);

  assert.deepEqual(input, before);
  assert.equal(result.expression_signature, D_SIGNATURE);
  assert.deepEqual(result.expressions.map((expression) => [
    expression.operator,
    expression.result_kind,
    expression.children.map((child) => child.role),
  ]), [
    ['ANY_OF', 'LOGICAL', ['MEMBER', 'MEMBER']],
    ['NOT', 'LOGICAL', ['NEGATED']],
    ['CAPABLE', 'LOGICAL', ['TEST']],
    ['BEFORE', 'LOGICAL', ['SUBJECT_EVENT', 'TEMPORAL_BOUNDARY']],
    ['NOT', 'LOGICAL', ['NEGATED']],
    ['ON_OR_BEFORE', 'LOGICAL', ['SUBJECT_EVENT', 'TEMPORAL_BOUNDARY']],
    ['EARLIER_OF', 'TEMPORAL', ['MEMBER', 'MEMBER']],
    ['OFFSET_AFTER', 'TEMPORAL', ['ANCHOR', 'OFFSET_AMOUNT']],
  ]);
  const curePeriod = result.facts.find((fact) => fact.field_key === 'CURE_PERIOD');
  assert.equal(curePeriod.value_type, 'DURATION');
  assert.deepEqual(curePeriod.typed_value, {
    bound_type: 'EXACT',
    count: 30,
    unit: 'BUSINESS_DAY',
  });
  assert.equal(curePeriod.normalisation_proof.rule_id, 'DURATION_PARSER/V2');
});

test('synthetic Phase 1 Red Hat 7.01(d) requires its sealed authority', () => {
  for (const disposition of ['absent', 'explicit undefined']) {
    const input = redHatTemporalDInput();
    if (disposition === 'absent') delete input.temporalPhase1Authority;
    else input.temporalPhase1Authority = undefined;

    assert.throws(
      () => compileSyntheticProfileExpression(input),
      /synthetic operator CAPABLE is unsupported, disallowed, or has invalid arity/u,
      disposition,
    );
  }
});

test('synthetic Phase 1 Red Hat 7.01(d) rejects typed temporal near misses', () => {
  const cases = [
    {
      name: 'CAPABLE fact child',
      mutate(input) {
        input.source.expression.children[0].children[0].children = [
          { fact_key: 'CAPABILITY_CURE_EVENT' },
        ];
      },
      message: /CAPABLE child 1 has an invalid authority-gated kind/u,
    },
    {
      name: 'self-consistent BEFORE substitution',
      mutate(input) {
        input.profile.required_expression_signature = D_SIGNATURE.replace(
          'ON_OR_BEFORE',
          'BEFORE',
        );
        input.source.expression.children[1].children[0].operator = 'BEFORE';
      },
      message: /authority permits only its exact synthetic signatures/u,
    },
    {
      name: 'unused Phase 1 fact',
      mutate(input) {
        const unusedField = 'UNUSED_PHASE1_FACT';
        input.source.text += ` | ${unusedField}`;
        input.source.facts.push(sourceFact(
          input.source.text,
          unusedField,
          unusedField,
          true,
          'BOOLEAN',
          'COMPANY',
        ));
      },
      message: /exact synthetic fixture must cite UNUSED_PHASE1_FACT exactly once/u,
    },
    {
      name: 'EARLIER_OF ENUM boundary',
      mutate(input) {
        input.source.facts.find(
          (fact) => fact.field_key === 'DEADLINE_TERMINATION_DATE',
        ).value_type = 'ENUM';
      },
      message: /EARLIER_OF child 1 has an invalid authority-gated fact type/u,
    },
    {
      name: '31 Business Days',
      mutate(input) {
        input.source.facts.find(
          (fact) => fact.field_key === 'CURE_PERIOD',
        ).typed_value.count = 31;
      },
      message: /duration fact does not prove its exact parser result/u,
    },
    {
      name: 'numeric plus parenthetical Business Days',
      mutate(input) {
        const durationFact = input.source.facts.find(
          (fact) => fact.field_key === 'CURE_PERIOD',
        );
        input.source.text = input.source.text.replace(
          'thirty (30) Business Days',
          '30 (30) Business Days',
        );
        durationFact.selector = selector(input.source.text, '30 (30) Business Days');
        input.source.expression.children[1].selector = selector(
          input.source.text,
          'NEGATE_DEADLINE',
        );
      },
      message: /duration fact does not prove its exact parser result/u,
    },
  ];

  for (const selected of cases) {
    const input = redHatTemporalDInput();
    selected.mutate(input);
    assert.throws(
      () => compileSyntheticProfileExpression(input),
      selected.message,
      selected.name,
    );
  }
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
const TERMINATION_PHASE2_COMPONENT_KEYS = Object.freeze([
  'CONCHO_8_1_B_III_BREACH_CURE',
  'CONCHO_8_1_E_COMPANY_NO_SOLICITATION_BREACH',
  'CONCHO_8_1_F_PARENT_NO_SOLICITATION_BREACH',
  'METSERA_8_01_C_II_BREACH_CURE',
  'METSERA_8_01_E_II_BREACH_CURE',
  'RED_HAT_7_01_E_TEMPORAL_RULE',
  'SKECHERS_8_1_F_BREACH_TERMINATION',
  'SKECHERS_8_1_G_NO_SOLICITATION_CURE',
  'SKECHERS_8_1_H_BREACH_TERMINATION',
  'SKECHERS_8_1_I_FAILURE_TO_CLOSE',
  'SKYWATER_9_1_E_BREACH_CURE',
]);

function phase2CanonicalJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map(phase2CanonicalJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${phase2CanonicalJson(value[key])}`,
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

function phase2ContentId(domain, payload) {
  const domainBytes = Buffer.from(domain, 'utf8');
  return sha256(Buffer.concat([
    Buffer.from('CANONICAL_CONTENT_ID/V1\0', 'utf8'),
    Buffer.from(String(domainBytes.length), 'ascii'),
    Buffer.from(':', 'ascii'),
    domainBytes,
    Buffer.from('\0', 'utf8'),
    Buffer.from(phase2CanonicalJson(payload), 'utf8'),
  ]));
}

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
        sha256: sha256(bytes),
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
  assert.equal(sha256(bytes), TERMINATION_PHASE2_AUTHORITY_V2_SHA256);
  assert.equal(bytes.toString('utf8'), `${phase2CanonicalJson(record)}\n`);
  assert.equal(record.schema_version, TERMINATION_PHASE2_AUTHORITY_V2_SCHEMA);
  assert.equal(
    record.termination_authoring_phase2_authority_id,
    TERMINATION_PHASE2_AUTHORITY_V2_ID,
  );
  const unsigned = structuredClone(record);
  delete unsigned.termination_authoring_phase2_authority_id;
  assert.equal(
    phase2ContentId(record.schema_version, unsigned),
    record.termination_authoring_phase2_authority_id,
  );
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

function phase2DeepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((child) => phase2DeepFreeze(child, seen));
  return Object.freeze(value);
}

function assertPhase2DeepFrozen(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${path} is not frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertPhase2DeepFrozen(child, `${path}.${key}`, seen);
  }
}

function phase2FixtureOracle(authority, component) {
  const fixture = authority.synthetic_component_contract.synthetic_fixture_identity_contract;
  const pathRows = fixture.fact_path_registry.filter(
    (row) => row.component_key === component.component_key,
  );
  const pathRowByKey = new Map(pathRows.map(
    (row) => [`${row.expression_path}\0${row.field_key}`, row],
  ));
  const atomBySupportId = new Map(fixture.atom_text_registry.map(
    (row) => [row.source_support_id, row.source_text],
  ));
  const records = [];
  function visit(node, path, parentPath) {
    if (node.kind === 'EXPRESSION') {
      records.push({ kind: 'EXPRESSION', node, path, parentPath, token: node.operator });
      node.children.forEach((child, index) => {
        visit(child.node, `${path}.${index + 1}`, path);
      });
      return;
    }
    assert.equal(node.kind, 'FACT');
    const registry = pathRowByKey.get(`${path}\0${node.field_key}`);
    assert.ok(registry, `${component.component_key} has no fact-path row for ${path}`);
    const atom = atomBySupportId.get(registry.source_support_id);
    assert.equal(typeof atom, 'string');
    records.push({
      atom,
      kind: 'FACT',
      node,
      parentPath,
      path,
      registry,
      token: atom,
    });
  }
  visit(component.expression_tree, '0', null);
  assert.equal(records.filter((record) => record.kind === 'FACT').length, pathRows.length);

  const construction = fixture.source_text_construction_contract;
  const recordTexts = records.map((record) => {
    const pathLength = Buffer.byteLength(record.path, 'utf8');
    if (record.kind === 'EXPRESSION') {
      return `E${pathLength}:${record.path}`
        + `${Buffer.byteLength(record.token, 'utf8')}:${record.token}`;
    }
    const { field_key: fieldKey } = record.node;
    return `F${pathLength}:${record.path}`
      + `${Buffer.byteLength(fieldKey, 'utf8')}:${fieldKey}`
      + `${Buffer.byteLength(record.atom, 'utf8')}:${record.atom}`;
  });
  const sourceText = `${construction.header}\n${recordTexts.join('\n')}`;
  assert.equal(sourceText.endsWith('\n'), false);
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const componentContractSha256 = sha256(phase2CanonicalJson(component));
  const identity = fixture.identity_contract;
  const fixtureId = phase2ContentId(identity.fixture_id.domain, {
    component_contract_sha256: componentContractSha256,
    fixture_contract_version: fixture.fixture_contract_version,
    synthetic_source_text_byte_length: sourceBytes.length,
    synthetic_source_text_sha256: sha256(sourceBytes),
  });
  const childIds = Object.fromEntries(identity.derived_child_id_contracts.map((contract) => [
    contract.identity_name,
    phase2ContentId(contract.domain, { fixture_id: fixtureId }),
  ]));
  let cursor = Buffer.byteLength(`${construction.header}\n`, 'utf8');
  const spanByPath = new Map();
  const spans = records.map((record, index) => {
    const recordText = recordTexts[index];
    const tokenBytes = Buffer.from(record.token, 'utf8');
    const tokenOffset = Buffer.byteLength(recordText, 'utf8') - tokenBytes.length;
    const startByte = cursor + tokenOffset;
    const endByte = startByte + tokenBytes.length;
    const textSha256 = sha256(tokenBytes);
    const span = {
      span_id: phase2ContentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: childIds.agreement_index_id,
        source_node_occurrence_id: childIds.source_node_occurrence_id,
        start_byte: startByte,
        end_byte: endByte,
        text_sha256: textSha256,
      }),
      source_node_occurrence_id: childIds.source_node_occurrence_id,
      start_byte: startByte,
      end_byte: endByte,
      text_sha256: textSha256,
      legal_text: false,
      operative: false,
      materiality: 'NON_MATERIAL',
    };
    spanByPath.set(record.path, span);
    cursor += Buffer.byteLength(recordText, 'utf8') + (index + 1 < records.length ? 1 : 0);
    return span;
  });
  assert.equal(cursor, sourceBytes.length);
  return {
    childIds,
    componentContractSha256,
    fixtureId,
    records,
    sourceBytes,
    spanByPath,
    spans,
  };
}

function phase2GovernedIds(authority) {
  const ids = new Set([
    authority.termination_authoring_phase2_authority_id,
    ...authority.authorised_synthetic_rule_components.map((component) => component.component_key),
  ]);
  function visit(value, key = '') {
    if (typeof value === 'string') {
      if (/(?:^|_)(?:id|ids)$/u.test(key) && /^[0-9a-f]{64}$/u.test(value)) ids.add(value);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, key));
      return;
    }
    Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  }
  visit(authority);
  const ownerRegistry =
    authority.implementation_contract.reference_target_owner_template_registry;
  for (const template of ownerRegistry.templates) {
    ids.add(phase2ContentId(
      ownerRegistry.agreement_semantic_fact_v2_identity_projection.domain,
      {
        agreement_id: template.agreement_id,
        field_key: template.field_key,
        normalised_typed_value: template.typed_value,
        legal_subject: template.legal_subject,
        temporal_scope_signature: template.temporal_scope_signature,
        source_support_ids: template.source_supports.map(
          (support) => support.source_support_id,
        ),
        legal_effect_role: template.legal_effect_role,
      },
    ));
  }
  return ids;
}

function phase2OutputStrings(value, strings = new Set()) {
  if (typeof value === 'string') {
    strings.add(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => phase2OutputStrings(child, strings));
  }
  return strings;
}

function phase2ExpectedTypedValue(authority, oracle, contract) {
  const descriptor = contract.typed_value;
  if (!descriptor || typeof descriptor !== 'object'
      || descriptor.kind !== 'DERIVED_REFERENCE_TARGET/V1') {
    return descriptor;
  }
  const ownerRegistry =
    authority.implementation_contract.reference_target_owner_template_registry;
  const descriptorKey = phase2CanonicalJson(descriptor);
  const templates = ownerRegistry.templates.filter(
    (template) => phase2CanonicalJson(template.descriptor_key) === descriptorKey,
  );
  assert.equal(templates.length, 1, `${contract.field_key} has no unique owner template`);
  const [template] = templates;
  const projection = authority.synthetic_component_contract
    .synthetic_fixture_identity_contract.reference_owner_projection_contract;
  return phase2ContentId(projection.owner_fact_projection_domain, {
    agreement_id: oracle.childIds.agreement_id,
    field_key: template.field_key,
    value_type: template.value_type,
    typed_value: template.typed_value,
    legal_subject: template.legal_subject,
    temporal_scope_signature: template.temporal_scope_signature,
    legal_effect_role: template.legal_effect_role,
  });
}

function phase2DirectReferenceTypedValues(component) {
  return new Set(component.fact_contracts.filter(
    (contract) => contract.normaliser_id === 'REFERENCE_EDGE/V1'
      && contract.value_type === 'REFERENCE'
      && typeof contract.typed_value === 'string'
      && /^[0-9a-f]{64}$/u.test(contract.typed_value),
  ).map((contract) => contract.typed_value));
}

function assertPhase2CompiledOutput(authority, component, output, governedIds) {
  const fixture = authority.synthetic_component_contract.synthetic_fixture_identity_contract;
  const oracle = phase2FixtureOracle(authority, component);
  assert.deepEqual(Object.keys(output), fixture.output_contract.exact_keys);
  assert.equal(
    output.profile_id,
    `${fixture.output_contract.profile_id_prefix}${oracle.childIds.profile_content_id}`,
  );
  assert.equal(output.expression_signature, component.literal_signature);
  assert.deepEqual(output.source_spans, oracle.spans);
  const factRecords = oracle.records.filter((record) => record.kind === 'FACT');
  assert.equal(output.facts.length, factRecords.length);
  const contractByField = new Map(component.fact_contracts.map(
    (contract) => [contract.field_key, contract],
  ));
  const directReferenceTypedValues = phase2DirectReferenceTypedValues(component);
  const directReferenceFactIndexes = [];
  const expectedFactIdByPath = new Map();
  for (const [index, record] of factRecords.entries()) {
    const fact = output.facts[index];
    const contract = contractByField.get(record.node.field_key);
    const span = oracle.spanByPath.get(record.path);
    assert.ok(contract);
    const expectedTypedValue = phase2ExpectedTypedValue(authority, oracle, contract);
    const legalEffectRole = contract.field_key === 'APPLIES_TO' ? 'LEGAL_ACTOR'
      : contract.field_key === 'LEGAL_EFFECT' ? 'OPERATIVE_EFFECT' : 'LEGAL_PARAMETER';
    const expectedSemanticFactKey = phase2ContentId('AGREEMENT_SEMANTIC_FACT/V2', {
      agreement_id: oracle.childIds.agreement_id,
      field_key: contract.field_key,
      normalised_typed_value: expectedTypedValue,
      legal_subject: contract.legal_subject,
      temporal_scope_signature: 'CURRENT',
      source_support_ids: [span.span_id],
      legal_effect_role: legalEffectRole,
    });
    const expectedFactId = phase2ContentId('AGREEMENT_SEMANTIC_FACT/V2', {
      agreement_id: oracle.childIds.agreement_id,
      semantic_fact_key: expectedSemanticFactKey,
    });
    assert.deepEqual(contract.source_support_labels, [record.registry.source_support_label]);
    assert.deepEqual(Object.keys(fact), [
      'fact_id',
      'semantic_fact_key',
      'owner_rule_id',
      'field_key',
      'label_id',
      'value_type',
      'typed_value',
      'materiality',
      'atomicity',
      'legal_effect_role',
      'legal_subject',
      'temporal_scope_signature',
      'source_support_ids',
      'dependency_ids',
      'normalisation_proof',
      'display_rule',
    ]);
    assert.deepEqual(Object.keys(fact.normalisation_proof), [
      'rule_id',
      'input_source_span_ids',
      'input_context_edge_ids',
      'result_digest',
    ]);
    assert.deepEqual(fact, {
      fact_id: expectedFactId,
      semantic_fact_key: expectedSemanticFactKey,
      owner_rule_id: 'SYNTHETIC_PENDING_RULE_ID',
      field_key: contract.field_key,
      label_id: `label-${contract.field_key}`,
      value_type: contract.value_type,
      typed_value: expectedTypedValue,
      materiality: 'MATERIAL',
      atomicity: 'ATOMIC_TYPED_VALUE',
      legal_effect_role: legalEffectRole,
      legal_subject: contract.legal_subject,
      temporal_scope_signature: 'CURRENT',
      source_support_ids: [span.span_id],
      dependency_ids: [],
      normalisation_proof: {
        rule_id: contract.normaliser_id,
        input_source_span_ids: [span.span_id],
        input_context_edge_ids: [],
        result_digest: sha256(phase2CanonicalJson(expectedTypedValue)),
      },
      display_rule: 'DISPLAY_REQUIRED',
    });
    if (directReferenceTypedValues.has(contract.typed_value)) {
      assert.equal(contract.normaliser_id, 'REFERENCE_EDGE/V1');
      assert.equal(contract.value_type, 'REFERENCE');
      directReferenceFactIndexes.push(index);
    }
    if (expectedTypedValue && typeof expectedTypedValue === 'object') {
      assert.notStrictEqual(fact.typed_value, contract.typed_value);
    }
    expectedFactIdByPath.set(record.path, expectedFactId);
  }

  const expressionRecords = oracle.records.filter((record) => record.kind === 'EXPRESSION');
  assert.equal(output.expressions.length, expressionRecords.length);
  const expectedExpressionByPath = new Map();
  function expectedExpression(node, path) {
    const children = node.children.map((child, childIndex) => {
      const childPath = `${path}.${childIndex + 1}`;
      return {
        kind: child.node.kind,
        id: child.node.kind === 'FACT'
          ? expectedFactIdByPath.get(childPath)
          : expectedExpression(child.node, childPath).expression_id,
        ordinal: childIndex + 1,
        role: child.role,
      };
    });
    const identity = {
      operator: node.operator,
      result_kind: node.result_kind,
      children,
      connective_span_ids: [oracle.spanByPath.get(path).span_id],
      authored_limb_marker_span_ids: [],
      scope_span_ids: oracle.records.filter(
        (candidate) => candidate.path === path
          || candidate.path.startsWith(`${path}.`),
      ).map((candidate) => oracle.spanByPath.get(candidate.path).span_id),
    };
    const expected = {
      expression_id: phase2ContentId('STAGE_2Y_M7_V2_EXPRESSION/V1', identity),
      ...identity,
    };
    expectedExpressionByPath.set(path, expected);
    return expected;
  }
  expectedExpression(component.expression_tree, '0');
  for (const [index, record] of expressionRecords.entries()) {
    const expression = output.expressions[index];
    const expected = expectedExpressionByPath.get(record.path);
    assert.deepEqual(Object.keys(expression), [
      'expression_id',
      'operator',
      'result_kind',
      'children',
      'connective_span_ids',
      'authored_limb_marker_span_ids',
      'scope_span_ids',
      'parent_expression_id',
    ]);
    assert.deepEqual(expression, {
      ...expected,
      parent_expression_id: record.parentPath === null
        ? null : expectedExpressionByPath.get(record.parentPath).expression_id,
    });
  }
  assert.equal(output.root_expression_id, expectedExpressionByPath.get('0').expression_id);
  const outputForLeakCheck = structuredClone(output);
  for (const factIndex of directReferenceFactIndexes) {
    outputForLeakCheck.facts[factIndex].typed_value = 'ALLOWED_DIRECT_REFERENCE_TYPED_VALUE';
  }
  const outputStrings = phase2OutputStrings(outputForLeakCheck);
  for (const governedId of governedIds) {
    assert.equal(outputStrings.has(governedId), false, `output leaks ${governedId}`);
  }
  return {
    factCount: factRecords.length,
    factSupportIds: output.facts.flatMap((fact) => fact.source_support_ids),
  };
}

function restampTerminationPhase2Authority(envelope, mutate) {
  const record = structuredClone(envelope.record);
  delete record.termination_authoring_phase2_authority_id;
  mutate(record);
  record.termination_authoring_phase2_authority_id = phase2ContentId(
    record.schema_version,
    record,
  );
  const bytes = Buffer.from(`${phase2CanonicalJson(record)}\n`, 'utf8');
  return {
    binding: {
      ...envelope.binding,
      byte_length: bytes.length,
      record_id: record.termination_authoring_phase2_authority_id,
      sha256: sha256(bytes),
    },
    record,
  };
}

function assertPhase2CompilerError(input, code, label) {
  assert.throws(
    () => compileSyntheticProfileExpression(input),
    (error) => error && error.code === code,
    label,
  );
}

test('Phase2 compiler derives all authorised Termination source components', () => {
  const authorityEnvelope = terminationPhase2Authority();
  const { record: authority } = authorityEnvelope;
  const authorityBefore = structuredClone(authorityEnvelope);
  const fixture = authority.synthetic_component_contract.synthetic_fixture_identity_contract;
  assert.deepEqual(
    authority.authorised_synthetic_rule_components.map((component) => component.component_key),
    TERMINATION_PHASE2_COMPONENT_KEYS,
  );
  assert.equal(fixture.fact_path_registry.length, 146);
  assert.equal(fixture.atom_text_registry.length, 144);
  assert.deepEqual(fixture.identity_contract.derived_child_id_contracts, [
    {
      domain: 'M7_V2_TERMINATION_PHASE2_SYNTHETIC_AGREEMENT/V1',
      identity_name: 'agreement_id',
      payload_exact_keys: ['fixture_id'],
    },
    {
      domain: 'M7_V2_TERMINATION_PHASE2_SYNTHETIC_AGREEMENT_INDEX/V1',
      identity_name: 'agreement_index_id',
      payload_exact_keys: ['fixture_id'],
    },
    {
      domain: 'M7_V2_TERMINATION_PHASE2_SYNTHETIC_SOURCE_NODE/V1',
      identity_name: 'source_node_occurrence_id',
      payload_exact_keys: ['fixture_id'],
    },
    {
      domain: 'M7_V2_TERMINATION_PHASE2_SYNTHETIC_PROFILE/V1',
      identity_name: 'profile_content_id',
      payload_exact_keys: ['fixture_id'],
    },
  ]);
  assert.deepEqual(fixture.active_input_contract.exact_keys, [
    'terminationAuthoringPhase2Authority',
    'component_key',
  ]);
  assert.deepEqual(fixture.output_contract.exact_keys, [
    'profile_id',
    'expression_signature',
    'root_expression_id',
    'source_spans',
    'facts',
    'expressions',
  ]);
  const governedIds = phase2GovernedIds(authority);
  const results = [];
  let factCount = 0;
  const factSupportIds = [];
  for (const component of authority.authorised_synthetic_rule_components) {
    const input = {
      terminationAuthoringPhase2Authority: authorityEnvelope,
      component_key: component.component_key,
    };
    const inputBefore = structuredClone(input);
    const first = compileSyntheticProfileExpression(input);
    const second = compileSyntheticProfileExpression(input);
    assert.deepEqual(input, inputBefore);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.source_spans, second.source_spans);
    assert.notStrictEqual(first.facts, second.facts);
    assert.notStrictEqual(first.expressions, second.expressions);
    assertPhase2DeepFrozen(first);
    const audited = assertPhase2CompiledOutput(authority, component, first, governedIds);
    factCount += audited.factCount;
    factSupportIds.push(...audited.factSupportIds);
    results.push(first);
  }
  assert.equal(factCount, 146);
  assert.equal(factSupportIds.length, 146);
  assert.equal(new Set(factSupportIds).size, 146);
  assert.deepEqual(authorityEnvelope, authorityBefore);
  assert.equal(Object.isFrozen(authorityEnvelope), false);
  assert.equal(Object.isFrozen(authorityEnvelope.record), false);

  const frozenInput = phase2DeepFreeze({
    terminationAuthoringPhase2Authority: structuredClone(authorityEnvelope),
    component_key: TERMINATION_PHASE2_COMPONENT_KEYS[0],
  });
  assert.deepEqual(compileSyntheticProfileExpression(frozenInput), results[0]);

  const authorityDriftCode = 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT';
  const topologyCode = 'M7_V2_TERMINATION_PHASE2_EVIDENCE_TOPOLOGY';
  assertPhase2CompilerError({
    terminationAuthoringPhase2Authority: null,
    component_key: TERMINATION_PHASE2_COMPONENT_KEYS[0],
  }, authorityDriftCode, 'null authority');
  assertPhase2CompilerError({
    terminationAuthoringPhase2Authority:
      loadTerminationPhase2Authority(TERMINATION_PHASE2_AUTHORITY_V1_PATH).envelope,
    component_key: TERMINATION_PHASE2_COMPONENT_KEYS[0],
  }, authorityDriftCode, 'V1 authority is not active V2');

  const nestedDrift = structuredClone(authorityEnvelope);
  nestedDrift.record.authorised_synthetic_rule_components[0].literal_signature = 'ALL_OF(DRIFT)';
  assertPhase2CompilerError({
    terminationAuthoringPhase2Authority: nestedDrift,
    component_key: 'UNKNOWN_COMPONENT',
  }, authorityDriftCode, 'authority drift precedes component lookup');
  const restampedExtraKey = restampTerminationPhase2Authority(authorityEnvelope, (record) => {
    record.unexpected_top_level_authority_member = true;
  });
  assertPhase2CompilerError({
    terminationAuthoringPhase2Authority: restampedExtraKey,
    component_key: 'UNKNOWN_COMPONENT',
  }, authorityDriftCode, 'restamped authority drift precedes component lookup');
  assertPhase2CompilerError({
    terminationAuthoringPhase2Authority: authorityEnvelope,
    component_key: 'UNKNOWN_COMPONENT',
  }, topologyCode, 'unknown component');

  for (const [key, value] of [
    ['agreement_id', 'caller-agreement'],
    ['agreement_index_id', 'caller-index'],
    ['source_node_occurrence_id', 'caller-node'],
    ['profile', {}],
    ['source', { text: 'caller text' }],
    ['baseAnalysis', {}],
    ['syntheticExpressionPayloads', []],
  ]) {
    assertPhase2CompilerError({
      terminationAuthoringPhase2Authority: authorityEnvelope,
      component_key: TERMINATION_PHASE2_COMPONENT_KEYS[0],
      [key]: value,
    }, topologyCode, `active input rejects ${key}`);
  }
  for (const temporalAuthority of [undefined, temporalPhase1Authority()]) {
    assertPhase2CompilerError({
      terminationAuthoringPhase2Authority: authorityEnvelope,
      component_key: TERMINATION_PHASE2_COMPONENT_KEYS[0],
      temporalPhase1Authority: temporalAuthority,
    }, topologyCode, 'active Phase2 rejects own temporalPhase1Authority');
  }

  const legacyInput = redHatTemporalDInput();
  const legacyResult = compileSyntheticProfileExpression(legacyInput);
  const ownUndefinedFallback = structuredClone(legacyInput);
  ownUndefinedFallback.terminationAuthoringPhase2Authority = undefined;
  const ownUndefinedBefore = structuredClone(ownUndefinedFallback);
  assert.deepEqual(compileSyntheticProfileExpression(ownUndefinedFallback), legacyResult);
  assert.deepEqual(ownUndefinedFallback, ownUndefinedBefore);
  assert.equal(Object.hasOwn(ownUndefinedFallback, 'terminationAuthoringPhase2Authority'), true);
  assert.equal(Object.isFrozen(ownUndefinedFallback), false);
});

test('generateAnalysisV2 materialises an injected nested expression as one full occurrence', () => {
  const input = injectedAnalysisInput();
  const before = structuredClone(input);

  const analysis = generateAnalysisV2(input);

  assert.deepEqual(input, before);
  assert.equal(analysis.facts.length, 3);
  assert.equal(analysis.expressions.length, 2);
  assert.equal(analysis.rules.length, 1);
  assert.deepEqual(analysis.counts, {
    governed_input_occurrences: 1,
    rules: 1,
    facts: 3,
    expressions: 2,
    shared_fact_coverages: 0,
    source_closures: 1,
    dispositions: 1,
  });
  const rule = analysis.rules[0];
  const root = analysis.expressions.find(
    (expression) => expression.expression_id === rule.root_expression_id,
  );
  const nested = analysis.expressions.find(
    (expression) => expression.parent_expression_id === root.expression_id,
  );
  assert.equal(rule.expression_signature,
    'ALL_OF(APPLIES_TO,ANY_OF(LEGAL_EFFECT,OUTSIDE_DATE))');
  assert.equal(root.operator, 'ALL_OF');
  assert.equal(nested.operator, 'ANY_OF');
  assert.equal(analysis.facts.find(
    (fact) => fact.field_key === 'APPLIES_TO',
  ).legal_subject, 'PARENT');
  assert.deepEqual(analysis.candidate_sets[0].effects[0].fact_ids, rule.fact_ids);
  assert.equal(analysis.candidate_sets[0].effects[0].expression_root_id, root.expression_id);
  const closureSpanIds = analysis.source_closures[0].spans.map((span) => span.span_id);
  assert.deepEqual(analysis.coverage_partitions[0].entries.map(
    (entry) => entry.span_id,
  ), closureSpanIds);
  assert.deepEqual(analysis.authored_unit_effect_ledgers[0].entries[0].treatments.filter(
    (treatment) => treatment.treatment_kind === 'EXPRESSION',
  ).map((treatment) => treatment.target_id), [root.expression_id, nested.expression_id]);
  assert.equal(validateSyntheticExpressionEvidence({
    source_text: input.agreementIndex.source_binding.canonical_text,
    source_spans: analysis.source_closures[0].spans.map((span) => ({
      span_id: span.span_id,
      start_byte: span.start_byte,
      end_byte: span.end_byte,
    })),
    facts: analysis.facts.map((fact) => ({
      fact_id: fact.fact_id,
      source_support_ids: fact.source_support_ids,
    })),
    expressions: analysis.expressions.map((expression) => ({
      expression_id: expression.expression_id,
      operator: expression.operator,
      children: expression.children.map((child) => ({ kind: child.kind, id: child.id })),
      connective_span_ids: expression.connective_span_ids,
      authored_limb_marker_span_ids: expression.authored_limb_marker_span_ids,
      scope_span_ids: expression.scope_span_ids,
    })),
  }).status, 'PASS');
  assert.equal(Object.isFrozen(analysis), true);
});

test('synthetic profile compiler rejects authored limb marker selectors', () => {
  const input = injectedAnalysisInput();
  const source = input.syntheticExpressionPayloads[0].source;
  source.expression.authored_limb_marker_selectors = [selector(source.text, 'Parent')];

  assert.throws(() => generateAnalysisV2(input), /authored limb markers are unsupported/u);
});

test('generateAnalysisV2 binds an injected expression to its exact occurrence and full source', () => {
  const cases = [
    {
      name: 'unknown occurrence',
      mutate(input) {
        input.syntheticExpressionPayloads[0].input_occurrence_id = 'other-occurrence';
      },
      message: /must name unique governed occurrences/u,
    },
    {
      name: 'different canonical source',
      mutate(input) {
        input.syntheticExpressionPayloads[0].source.text += 'x';
      },
      message: /is invalid or cites other source/u,
    },
    {
      name: 'unowned leading source byte',
      mutate(input) {
        const selected = input.syntheticExpressionPayloads[0].source.facts[0].selector;
        selected.start_byte = 1;
        selected.quote = 'arent';
      },
      message: /does not partition its full node/u,
    },
  ];
  for (const selected of cases) {
    const input = injectedAnalysisInput();
    selected.mutate(input);
    assert.throws(() => generateAnalysisV2(input), selected.message, selected.name);
  }
});
