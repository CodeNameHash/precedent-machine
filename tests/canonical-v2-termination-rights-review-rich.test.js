const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const {
  TerminationRightsReviewRowsError,
  buildTerminationRightsReviewRowsV2,
} = require('../lib/canonical-v2/termination-rights-review-rows');
const {
  assembleTerminationRightsReviewV2,
} = require('../lib/canonical-v2/termination-rights-review-attachment');
const { trimReviewDealForWire } = require('../lib/queries/review-deal-wire');
const { reconstructReviewDeal } = require('../lib/queries/reconstruct-review-deal');

function sha256(value) {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function sourceSpan(id, nodeId, canonicalText, needle, from = 0) {
  const characterStart = canonicalText.indexOf(needle, from);
  assert.notEqual(characterStart, -1, `missing source text: ${needle}`);
  const startByte = Buffer.byteLength(canonicalText.slice(0, characterStart), 'utf8');
  const endByte = startByte + Buffer.byteLength(needle, 'utf8');
  return {
    span_id: id,
    source_node_occurrence_id: nodeId,
    start_byte: startByte,
    end_byte: endByte,
    text_sha256: sha256(needle),
  };
}

function nodeExtent(nodeId, canonicalText, exactText) {
  const characterStart = canonicalText.indexOf(exactText);
  assert.notEqual(characterStart, -1);
  const startByte = Buffer.byteLength(canonicalText.slice(0, characterStart), 'utf8');
  const endByte = startByte + Buffer.byteLength(exactText, 'utf8');
  return {
    node_occurrence_id: nodeId,
    reference: nodeId.replace('node:', ''),
    extent_span: {
      start_byte: startByte,
      end_byte: endByte,
      text_sha256: sha256(exactText),
    },
  };
}

function fact(factId, ownerRuleId, fieldKey, typedValue, spanId, dependencyIds = []) {
  return {
    fact_id: factId,
    owner_rule_id: ownerRuleId,
    field_key: fieldKey,
    value_type: 'BOOLEAN',
    typed_value: typedValue,
    materiality: 'MATERIAL',
    source_support_ids: [spanId],
    dependency_ids: dependencyIds,
  };
}

function child(kind, id, ordinal, role = 'OPERAND') {
  return { kind, id, ordinal, role };
}

function expression({ id, operator, parent = null, children, connectiveSpanId }) {
  return {
    expression_id: id,
    operator,
    result_kind: 'LOGICAL',
    children,
    parent_expression_id: parent,
    connective_span_ids: [connectiveSpanId],
    authored_limb_marker_span_ids: [],
    scope_span_ids: [connectiveSpanId],
  };
}

function profile(
  profileId,
  profileKey,
  familyKey,
  subtypePath,
  knownDimensionKeys = ['EXERCISE_MODE'],
) {
  return {
    profile_id: profileId,
    profile_key: profileKey,
    family_key: familyKey,
    subtype_path: subtypePath,
    known_relevant_dimensions: knownDimensionKeys.map((dimensionKey) => ({
      dimension_key: dimensionKey,
    })),
  };
}

function richBreachScenario() {
  const breachText = 'Parent may terminate if the Company breaches a representation or fails a covenant, and the same default causes Section 6.02(a) or Section 6.02(b) to fail, and it is incurable or remains uncured, but not while a Parent default causes Section 6.03(a) or Section 6.03(b) to fail.';
  const conditionText = 'The same default causes Section 6.02(a) failure or Section 6.02(b) failure.';
  const barText = 'Parent has a disqualifying default if Section 6.03(a) fails or Section 6.03(b) fails.';
  const canonicalText = `${breachText}\n${conditionText}\n${barText}`;
  const nodes = [
    nodeExtent('node:7.01(d)', canonicalText, breachText),
    nodeExtent('node:6.02', canonicalText, conditionText),
    nodeExtent('node:6.03', canonicalText, barText),
  ];

  const spans = {
    root: sourceSpan('span:root', 'node:7.01(d)', canonicalText, 'may terminate if'),
    trigger: sourceSpan('span:trigger', 'node:7.01(d)', canonicalText, 'or fails a covenant'),
    representation: sourceSpan('span:representation', 'node:7.01(d)', canonicalText, 'breaches a representation'),
    covenant: sourceSpan('span:covenant', 'node:7.01(d)', canonicalText, 'fails a covenant'),
    conditionReference: sourceSpan('span:condition-reference', 'node:7.01(d)', canonicalText, 'Section 6.02(a) or Section 6.02(b)'),
    cure: sourceSpan('span:cure', 'node:7.01(d)', canonicalText, 'incurable or remains uncured'),
    incurable: sourceSpan('span:incurable', 'node:7.01(d)', canonicalText, 'incurable'),
    uncured: sourceSpan('span:uncured', 'node:7.01(d)', canonicalText, 'remains uncured'),
    not: sourceSpan('span:not', 'node:7.01(d)', canonicalText, 'but not'),
    barReference: sourceSpan('span:bar-reference', 'node:7.01(d)', canonicalText, 'Section 6.03(a) or Section 6.03(b)'),
    condition: sourceSpan('span:condition', 'node:6.02', canonicalText, 'or Section 6.02(b)'),
    conditionA: sourceSpan('span:condition-a', 'node:6.02', canonicalText, 'Section 6.02(a)'),
    conditionB: sourceSpan('span:condition-b', 'node:6.02', canonicalText, 'Section 6.02(b)'),
    bar: sourceSpan('span:bar', 'node:6.03', canonicalText, 'or Section 6.03(b)'),
    barA: sourceSpan('span:bar-a', 'node:6.03', canonicalText, 'Section 6.03(a)'),
    barB: sourceSpan('span:bar-b', 'node:6.03', canonicalText, 'Section 6.03(b)'),
  };

  const closure = (id, node, closureSpans, requiredDependencyIds = []) => ({
    source_closure_id: id,
    agreement_index_binding: {
      schema_version: 'AGREEMENT_INDEX/V1',
      record_id_field: 'agreement_index_id',
      record_id: 'agreement-index:1',
      path: 'in-memory/agreement-index.json',
    },
    source_node_occurrence_id: node.node_occurrence_id,
    governing_start_byte: node.extent_span.start_byte,
    governing_end_byte: node.extent_span.end_byte,
    required_dependency_ids: requiredDependencyIds,
    spans: closureSpans,
  });

  const profiles = [
    profile('profile:breach', 'BREACH_RIGHT', 'TERMINATION', ['TERMINATION', 'TERMINATION_RIGHT', 'BREACH_RIGHT']),
  ];
  const rules = [
    {
      rule_id: 'rule:breach', effect_id: 'effect:breach', input_occurrence_id: 'occurrence:1',
      authored_unit_id: 'node:7.01(d)', profile_id: 'profile:breach',
      fact_ids: ['fact:representation', 'fact:covenant', 'fact:condition', 'fact:incurable', 'fact:uncured', 'fact:bar'],
      root_expression_id: 'expression:root', child_rule_ids: [],
      consumer_link_ids: [], source_closure_id: 'closure:breach',
      validation: { extraction_state: 'COMPLETE', source_quality: 'SUFFICIENT', output_disposition: 'NORMAL', issue_codes: [] },
    },
  ];
  const facts = [
    fact('fact:representation', 'rule:breach', 'COMPANY_REPRESENTATION_BREACH', true, spans.representation.span_id),
    fact('fact:covenant', 'rule:breach', 'COMPANY_COVENANT_NONPERFORMANCE', true, spans.covenant.span_id),
    fact('fact:condition', 'rule:breach', 'DEFAULT_CAUSES_6_02_FAILURE', true, spans.conditionReference.span_id, ['dependency:6.02']),
    fact('fact:incurable', 'rule:breach', 'INCAPABLE_OF_CURE', true, spans.incurable.span_id),
    fact('fact:uncured', 'rule:breach', 'REMAINS_UNCURED', true, spans.uncured.span_id),
    fact('fact:bar', 'rule:breach', 'PARENT_DISQUALIFYING_DEFAULT', true, spans.barReference.span_id, ['dependency:6.03']),
  ];
  const expressions = [
    expression({ id: 'expression:root', operator: 'ALL_OF', children: [
      child('EXPRESSION', 'expression:trigger', 1),
      child('FACT', 'fact:condition', 2),
      child('EXPRESSION', 'expression:cure', 3),
      child('EXPRESSION', 'expression:not', 4),
    ], connectiveSpanId: spans.root.span_id }),
    expression({ id: 'expression:trigger', operator: 'ANY_OF', parent: 'expression:root', children: [
      child('FACT', 'fact:representation', 1), child('FACT', 'fact:covenant', 2),
    ], connectiveSpanId: spans.trigger.span_id }),
    expression({ id: 'expression:cure', operator: 'ANY_OF', parent: 'expression:root', children: [
      child('FACT', 'fact:incurable', 1), child('FACT', 'fact:uncured', 2),
    ], connectiveSpanId: spans.cure.span_id }),
    expression({ id: 'expression:not', operator: 'NOT', parent: 'expression:root', children: [
      child('FACT', 'fact:bar', 1),
    ], connectiveSpanId: spans.not.span_id }),
  ];
  const effects = rules.map((entry) => ({
    effect_id: entry.effect_id,
    input_occurrence_id: entry.input_occurrence_id,
    source_span_ids: [spans.root, spans.trigger, spans.representation, spans.covenant,
      spans.conditionReference, spans.cure, spans.incurable, spans.uncured,
      spans.not, spans.barReference].map((entrySpan) => entrySpan.span_id),
  }));
  const disposition = {
    disposition_id: 'disposition:1', input_occurrence_id: 'occurrence:1', prior_family_key: 'TERMINATION',
    rule_ids: rules.map((entry) => entry.rule_id), output_disposition: 'NORMAL', issues: [],
  };

  return {
    analysis: {
      schema_version: 'AGREEMENT_ANALYSIS/V2', agreement_analysis_id: 'analysis:1',
      governed_input_occurrence_ids: ['occurrence:1'], profile_snapshots: profiles,
      candidate_sets: [{ effects }], rules, facts, expressions,
      ownership_links: [],
      dependencies: [
        {
          dependency_id: 'dependency:6.02', context_edge_id: 'edge:6.02',
          dependency_type: 'CLOSING_CONDITION_REFERENCE', state: 'RESOLVED',
          target_id: 'node:6.02', source_support_ids: [spans.conditionReference.span_id],
        },
        {
          dependency_id: 'dependency:6.03', context_edge_id: 'edge:6.03',
          dependency_type: 'CLOSING_CONDITION_REFERENCE', state: 'RESOLVED',
          target_id: 'node:6.03', source_support_ids: [spans.barReference.span_id],
        },
      ],
      source_closures: [
        closure('closure:breach', nodes[0], [spans.root, spans.trigger, spans.representation,
          spans.covenant, spans.conditionReference, spans.cure, spans.incurable,
          spans.uncured, spans.not, spans.barReference], ['dependency:6.02', 'dependency:6.03']),
      ],
      dispositions: [disposition],
    },
    projection: {
      schema_version: 'AGREEMENT_PROJECTION/V2', agreement_projection_id: 'projection:1', agreement_analysis_id: 'analysis:1',
      rows: rules.map((entry) => ({
        row_id: `projection:${entry.rule_id}`, rule_id: entry.rule_id,
        disposition_id: disposition.disposition_id, output_disposition: 'NORMAL',
      })),
      review_rows: [],
    },
    agreement_indexes: [{
      schema_version: 'AGREEMENT_INDEX/V1', agreement_index_id: 'agreement-index:1',
      source_binding: { canonical_text: canonicalText }, nodes,
    }],
    review_state: { open_review_keys: [], fact_groups: [] },
    expected: { breachText, conditionText, barText },
  };
}

function addSecondBreachOccurrence(input) {
  const agreementIndex = input.agreement_indexes[0];
  const originalText = agreementIndex.source_binding.canonical_text;
  const breachText = input.expected.breachText;
  const secondStart = Buffer.byteLength(`${originalText}\n`, 'utf8');
  agreementIndex.source_binding.canonical_text = `${originalText}\n${breachText}`;
  agreementIndex.nodes.push({
    node_occurrence_id: 'node:7.01(d):second',
    reference: '7.01(d)',
    extent_span: {
      start_byte: secondStart,
      end_byte: secondStart + Buffer.byteLength(breachText, 'utf8'),
      text_sha256: sha256(breachText),
    },
  });

  const originalClosure = input.analysis.source_closures[0];
  const spanIds = new Map(originalClosure.spans.map(
    (span) => [span.span_id, `${span.span_id}:second`],
  ));
  const secondClosure = {
    ...structuredClone(originalClosure),
    source_closure_id: 'closure:breach:second',
    source_node_occurrence_id: 'node:7.01(d):second',
    governing_start_byte: secondStart,
    governing_end_byte: secondStart + Buffer.byteLength(breachText, 'utf8'),
    required_dependency_ids: ['dependency:6.02:second', 'dependency:6.03:second'],
    spans: originalClosure.spans.map((span) => ({
      ...structuredClone(span),
      span_id: spanIds.get(span.span_id),
      source_node_occurrence_id: 'node:7.01(d):second',
      start_byte: span.start_byte + secondStart,
      end_byte: span.end_byte + secondStart,
    })),
  };
  input.analysis.source_closures.push(secondClosure);

  const originalRule = input.analysis.rules[0];
  const factIds = new Map(originalRule.fact_ids.map(
    (factId) => [factId, `${factId}:second`],
  ));
  const expressionIds = new Map(input.analysis.expressions.map(
    (entry) => [entry.expression_id, `${entry.expression_id}:second`],
  ));
  const secondRule = {
    ...structuredClone(originalRule),
    rule_id: 'rule:breach:second',
    effect_id: 'effect:breach:second',
    input_occurrence_id: 'occurrence:2',
    authored_unit_id: 'node:7.01(d):second',
    fact_ids: originalRule.fact_ids.map((factId) => factIds.get(factId)),
    root_expression_id: expressionIds.get(originalRule.root_expression_id),
    source_closure_id: secondClosure.source_closure_id,
  };
  input.analysis.rules.push(secondRule);
  input.analysis.facts.push(...input.analysis.facts.map((entry) => ({
    ...structuredClone(entry),
    fact_id: factIds.get(entry.fact_id),
    owner_rule_id: secondRule.rule_id,
    source_support_ids: entry.source_support_ids.map((spanId) => spanIds.get(spanId)),
    dependency_ids: entry.dependency_ids.map((dependencyId) => `${dependencyId}:second`),
  })));
  input.analysis.expressions.push(...input.analysis.expressions.map((entry) => ({
    ...structuredClone(entry),
    expression_id: expressionIds.get(entry.expression_id),
    parent_expression_id: entry.parent_expression_id === null
      ? null : expressionIds.get(entry.parent_expression_id),
    children: entry.children.map((entryChild) => ({
      ...structuredClone(entryChild),
      id: entryChild.kind === 'FACT'
        ? factIds.get(entryChild.id) : expressionIds.get(entryChild.id),
    })),
    connective_span_ids: entry.connective_span_ids.map((spanId) => spanIds.get(spanId)),
    authored_limb_marker_span_ids: entry.authored_limb_marker_span_ids.map(
      (spanId) => spanIds.get(spanId),
    ),
    scope_span_ids: entry.scope_span_ids.map((spanId) => spanIds.get(spanId)),
  })));
  input.analysis.dependencies.push(...input.analysis.dependencies.map((entry) => ({
    ...structuredClone(entry),
    dependency_id: `${entry.dependency_id}:second`,
    context_edge_id: `${entry.context_edge_id}:second`,
    source_support_ids: entry.source_support_ids.map((spanId) => spanIds.get(spanId)),
  })));
  const originalEffect = input.analysis.candidate_sets[0].effects[0];
  input.analysis.candidate_sets.push({
    effects: [{
      ...structuredClone(originalEffect),
      effect_id: secondRule.effect_id,
      input_occurrence_id: secondRule.input_occurrence_id,
      source_span_ids: originalEffect.source_span_ids.map((spanId) => spanIds.get(spanId)),
    }],
  });
  const originalDisposition = input.analysis.dispositions[0];
  input.analysis.dispositions.push({
    ...structuredClone(originalDisposition),
    disposition_id: 'disposition:2',
    input_occurrence_id: secondRule.input_occurrence_id,
    rule_ids: [secondRule.rule_id],
  });
  input.analysis.governed_input_occurrence_ids.push(secondRule.input_occurrence_id);
  input.projection.rows.push({
    row_id: `projection:${secondRule.rule_id}`,
    rule_id: secondRule.rule_id,
    disposition_id: 'disposition:2',
    output_disposition: 'NORMAL',
  });
  return input;
}

function addNestedFiduciaryRule(input) {
  const parentRule = input.analysis.rules[0];
  const childProfile = profile(
    'profile:fiduciary-child',
    'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT',
    'TERMINATION',
    ['TERMINATION', 'TERMINATION_RIGHT', 'FIDUCIARY_NOTICE_RIGHT'],
  );
  const childRule = {
    ...structuredClone(parentRule),
    rule_id: 'rule:fiduciary-child',
    profile_id: childProfile.profile_id,
    fact_ids: ['fact:fiduciary-exercise', 'fact:fiduciary-trigger'],
    root_expression_id: 'expression:fiduciary-child',
    child_rule_ids: [],
  };
  parentRule.child_rule_ids.push(childRule.rule_id);
  input.analysis.profile_snapshots.push(childProfile);
  input.analysis.rules.push(childRule);
  input.analysis.facts.push(
    fact(
      'fact:fiduciary-exercise',
      childRule.rule_id,
      'EXERCISE_MODE',
      true,
      'span:representation',
    ),
    fact(
      'fact:fiduciary-trigger',
      childRule.rule_id,
      'FIDUCIARY_TRIGGER',
      true,
      'span:covenant',
    ),
  );
  input.analysis.expressions.push(expression({
    id: childRule.root_expression_id,
    operator: 'ALL_OF',
    children: [
      child('FACT', 'fact:fiduciary-exercise', 1),
      child('FACT', 'fact:fiduciary-trigger', 2),
    ],
    connectiveSpanId: 'span:root',
  }));
  input.analysis.expressions.find(
    (entry) => entry.expression_id === parentRule.root_expression_id,
  ).children.push(child('RULE', childRule.rule_id, 5, 'CONDITION'));
  input.analysis.dispositions[0].rule_ids.push(childRule.rule_id);
  input.projection.rows.push({
    row_id: `projection:${childRule.rule_id}`,
    rule_id: childRule.rule_id,
    disposition_id: input.analysis.dispositions[0].disposition_id,
    output_disposition: 'NORMAL',
  });
  return input;
}

function addDelegatedFiduciaryDimension(input) {
  addNestedFiduciaryRule(input);
  const consumerProfile = input.analysis.profile_snapshots.find(
    (entry) => entry.profile_id === 'profile:fiduciary-child',
  );
  const consumerRule = input.analysis.rules.find(
    (entry) => entry.rule_id === 'rule:fiduciary-child',
  );
  consumerProfile.known_relevant_dimensions = [{
    dimension_key: 'DELEGATED_BREACH_REFERENCE',
  }];
  consumerProfile.excluded_or_delegated_dimensions = [{
    dimension_key: 'DELEGATED_BREACH_REFERENCE',
    disposition: 'DELEGATED',
    lawyer_ruling_id: 'ruling:delegated-owner',
    owner_profile_id: 'profile:breach',
    owner_field_key: 'COMPANY_REPRESENTATION_BREACH',
  }];
  consumerRule.consumer_link_ids = ['ownership-link:fiduciary-breach'];
  input.analysis.ownership_links.push({
    link_id: 'ownership-link:fiduciary-breach',
    consumer_rule_id: consumerRule.rule_id,
    owner_rule_id: 'rule:breach',
    owner_fact_id: 'fact:representation',
    resolved_owner_target_id: 'semantic:breach-reference',
    source_support_ids: ['span:representation'],
    consumer_reference_span_ids: ['span:covenant'],
    consumer_dependency_ids: ['dependency:6.02'],
    consumer_context_edge_ids: ['edge:6.02'],
  });
  return input;
}

function makeDependencyReviewOnly(input, dependencyState) {
  const rule = input.analysis.rules[0];
  const dependency = input.analysis.dependencies.find(
    (entry) => entry.dependency_id === 'dependency:6.03',
  );
  dependency.state = dependencyState;
  dependency.target_id = null;
  const extractionState = dependencyState === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'INCOMPLETE';
  rule.validation = {
    extraction_state: extractionState,
    source_quality: 'SUFFICIENT',
    output_disposition: 'REVIEW_ONLY',
    issue_codes: ['UNPROVED_DEPENDENT_RULE'],
  };
  const issue = {
    effect_id: rule.effect_id,
    rule_id: rule.rule_id,
    issue_code: 'UNPROVED_DEPENDENT_RULE',
    extraction_state: extractionState,
    source_quality: 'SUFFICIENT',
    source_span_ids: ['span:bar-reference'],
  };
  input.analysis.dispositions[0].output_disposition = 'REVIEW_ONLY';
  input.analysis.dispositions[0].issues = [issue];
  input.projection.rows = [];
  input.projection.review_rows = [{
    disposition_id: input.analysis.dispositions[0].disposition_id,
    input_occurrence_id: rule.input_occurrence_id,
    rule_ids: [rule.rule_id],
    issues: [structuredClone(issue)],
  }];
  return input;
}

function failureToCloseScenario() {
  const input = richBreachScenario();
  delete input.expected;
  input.analysis.profile_snapshots[0] = profile(
    'profile:breach',
    'FAILURE_TO_CLOSE_RIGHT',
    'TERMINATION',
    ['TERMINATION', 'TERMINATION_RIGHT', 'FAILURE_TO_CLOSE_RIGHT'],
  );
  const rule = input.analysis.rules[0];
  rule.fact_ids = [
    'fact:representation',
    'fact:covenant',
    'fact:condition',
    'fact:incurable',
    'fact:uncured',
  ];
  const facts = new Map(input.analysis.facts.map((entry) => [entry.fact_id, entry]));
  facts.get('fact:representation').field_key = 'SECTIONS_6_1_AND_6_2_CONDITIONS_SATISFIED_OR_WAIVED';
  facts.get('fact:covenant').field_key = 'READINESS_NOTICE_DELIVERED';
  facts.get('fact:condition').field_key = 'CLOSING_NOT_CONSUMMATED_BY_FIFTH_BUSINESS_DAY';
  facts.get('fact:incurable').field_key = 'COMPANY_PREPARED_THROUGHOUT_WINDOW';
  facts.get('fact:uncured').field_key = 'PARTNERSHIP_PREPARED_THROUGHOUT_WINDOW';
  input.analysis.facts = rule.fact_ids.map((factId) => facts.get(factId));
  input.analysis.expressions = [
    expression({ id: 'expression:root', operator: 'ALL_OF', children: [
      child('FACT', 'fact:representation', 1),
      child('FACT', 'fact:covenant', 2),
      child('EXPRESSION', 'expression:trigger', 3),
    ], connectiveSpanId: 'span:root' }),
    expression({ id: 'expression:trigger', operator: 'ALL_OF', parent: 'expression:root', children: [
      child('FACT', 'fact:condition', 1),
      child('EXPRESSION', 'expression:cure', 2),
    ], connectiveSpanId: 'span:trigger' }),
    expression({ id: 'expression:cure', operator: 'ALL_OF', parent: 'expression:trigger', children: [
      child('FACT', 'fact:incurable', 1),
      child('FACT', 'fact:uncured', 2),
    ], connectiveSpanId: 'span:cure' }),
  ];
  input.analysis.dependencies = input.analysis.dependencies.filter(
    (dependency) => dependency.dependency_id === 'dependency:6.02',
  );
  input.analysis.source_closures[0].required_dependency_ids = ['dependency:6.02'];
  return input;
}

test('rich Termination review presents one Breach proposition with nested tests and exact source', () => {
  const input = richBreachScenario();
  const expected = input.expected;
  delete input.expected;
  const before = structuredClone(input);

  const result = buildTerminationRightsReviewRowsV2(input);

  assert.equal(result.schema_version, 'TERMINATION_RIGHTS_REVIEW_ROWS/V2');
  assert.equal(result.rows.length, 1);
  const [breach] = result.rows;
  assert.equal(breach.subtype_key, 'BREACH_RIGHT');
  assert.equal(breach.decision_review_required, false);
  assert.deepEqual(breach.dimension_reviews, []);
  assert.equal(breach.full_provision.exact_text, expected.breachText);
  assert.equal(breach.full_provision.source_reference, '7.01(d)');
  assert.deepEqual(breach.full_provision.selector, {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: 0,
    end_byte: Buffer.byteLength(expected.breachText, 'utf8'),
    text_sha256: sha256(expected.breachText),
  });
  assert.equal(breach.expression_tree.operator, 'ALL_OF');
  assert.equal(breach.expression_tree.children[0].node.operator, 'ANY_OF');
  assert.equal(breach.expression_tree.children[0].node.children[0].node.field_key, 'COMPANY_REPRESENTATION_BREACH');
  assert.equal(breach.expression_tree.children[0].node.children[0].node.evidence_parts[0].quote, 'breaches a representation');
  assert.equal(breach.expression_tree.children[2].node.operator, 'ANY_OF');
  assert.equal(breach.expression_tree.children[3].node.operator, 'NOT');
  assert.deepEqual(breach.child_rules, []);
  assert.deepEqual(breach.linked_provisions.map((entry) => entry.dependency_id), [
    'dependency:6.02',
    'dependency:6.03',
  ]);
  assert.deepEqual(breach.linked_provisions.map((entry) => entry.source_reference), [
    '6.02',
    '6.03',
  ]);
  assert.deepEqual(breach.linked_provisions.map((entry) => entry.exact_text), [
    expected.conditionText,
    expected.barText,
  ]);
  assert.deepEqual(breach.dependency_references, []);
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(breach.expression_tree), true);
});

test('rich Termination review rejects stale canonical source bytes', () => {
  const input = richBreachScenario();
  delete input.expected;
  input.agreement_indexes[0].source_binding.canonical_text = input.agreement_indexes[0]
    .source_binding.canonical_text.replace('Parent may terminate', 'Parent can terminate');

  assert.throws(
    () => buildTerminationRightsReviewRowsV2(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_SOURCE_DRIFT',
  );
});

test('unresolved and ambiguous dependencies stay on their review-only proposition', () => {
  for (const state of ['UNRESOLVED', 'AMBIGUOUS']) {
    const input = makeDependencyReviewOnly(richBreachScenario(), state);
    delete input.expected;

    const result = buildTerminationRightsReviewRowsV2(input);
    const [row] = result.rows;

    assert.equal(row.review_required, true);
    assert.deepEqual(row.linked_provisions.map((entry) => entry.dependency_id), [
      'dependency:6.02',
    ]);
    assert.deepEqual(row.dependency_references, [{
      dependency_id: 'dependency:6.03',
      dependency_type: 'CLOSING_CONDITION_REFERENCE',
      state,
      target_id: null,
      evidence_parts: [{
        location: 'PRIMARY',
        agreement_index_id: 'agreement-index:1',
        source_node_occurrence_id: 'node:7.01(d)',
        selector: {
          coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
          start_byte: 233,
          end_byte: 267,
          text_sha256: sha256('Section 6.03(a) or Section 6.03(b)'),
        },
        quote: 'Section 6.03(a) or Section 6.03(b)',
      }],
    }]);
  }
});

test('a resolved semantic dependency remains source-backed without inventing a provision', () => {
  const input = richBreachScenario();
  delete input.expected;
  const dependency = input.analysis.dependencies.find(
    (entry) => entry.dependency_id === 'dependency:6.03',
  );
  dependency.dependency_type = 'DURATION_CONDITION_REFERENCE';
  dependency.target_id = 'semantic-fact:outside-date-owner';

  const result = buildTerminationRightsReviewRowsV2(input);
  const [row] = result.rows;

  assert.deepEqual(row.linked_provisions.map((entry) => entry.dependency_id), [
    'dependency:6.02',
  ]);
  assert.equal(row.dependency_references[0].state, 'RESOLVED');
  assert.equal(row.dependency_references[0].target_id, 'semantic-fact:outside-date-owner');
  assert.equal(
    row.dependency_references[0].evidence_parts[0].quote,
    'Section 6.03(a) or Section 6.03(b)',
  );
});

test('rich Termination review changes only the explicitly open Fiduciary dimension', () => {
  const input = richBreachScenario();
  delete input.expected;
  input.analysis.profile_snapshots[0] = profile(
    'profile:breach',
    'FIDUCIARY_NOTICE_RIGHT',
    'TERMINATION',
    ['TERMINATION', 'TERMINATION_RIGHT', 'FIDUCIARY_NOTICE_RIGHT'],
  );
  input.review_state.open_review_keys = ['FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE'];

  const result = buildTerminationRightsReviewRowsV2(input);

  assert.equal(result.rows[0].subtype_key, 'FIDUCIARY_NOTICE_RIGHT');
  assert.equal(result.rows[0].review_required, false);
  assert.equal(result.rows[0].decision_review_required, true);
  assert.deepEqual(result.rows[0].dimension_reviews, [{
    review_key: 'FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE',
    dimension_key: 'EXERCISE_MODE',
    state: 'OPEN',
    fact_ids: [],
    evidence_parts: [],
  }]);
});

test('transient fact groups preserve approved order, optional absence, and ungrouped facts', () => {
  const input = richBreachScenario();
  delete input.expected;
  input.analysis.profile_snapshots[0].known_relevant_dimensions = [
    'COMPANY_REPRESENTATION_BREACH',
    'COMPANY_COVENANT_NONPERFORMANCE',
    'OPTIONAL_ABSENT_DIMENSION',
  ].map((dimensionKey) => ({ dimension_key: dimensionKey }));
  input.review_state.fact_groups = [{
    group_key: 'BREACH_FIELDS',
    profile_key: 'BREACH_RIGHT',
    label: 'Breach fields',
    member_field_keys: [
      'COMPANY_COVENANT_NONPERFORMANCE',
      'OPTIONAL_ABSENT_DIMENSION',
      'COMPANY_REPRESENTATION_BREACH',
    ],
  }];

  const result = buildTerminationRightsReviewRowsV2(input);
  const [row] = result.rows;

  assert.deepEqual(row.fact_groups, [{
    group_key: 'BREACH_FIELDS',
    label: 'Breach fields',
    member_field_keys: [
      'COMPANY_COVENANT_NONPERFORMANCE',
      'OPTIONAL_ABSENT_DIMENSION',
      'COMPANY_REPRESENTATION_BREACH',
    ],
    member_fact_ids: ['fact:covenant', 'fact:representation'],
  }]);
  assert.deepEqual(row.ungrouped_fact_ids, [
    'fact:condition',
    'fact:incurable',
    'fact:uncured',
    'fact:bar',
  ]);
  assert.deepEqual(
    new Set([
      ...row.fact_groups.flatMap((group) => group.member_fact_ids),
      ...row.ungrouped_fact_ids,
    ]),
    new Set(row.fact_ids),
  );
});

test('transient fact groups reject unknown, duplicate, and overlapping members', async (t) => {
  const base = () => {
    const input = richBreachScenario();
    delete input.expected;
    input.analysis.profile_snapshots[0].known_relevant_dimensions = [
      'COMPANY_REPRESENTATION_BREACH',
      'COMPANY_COVENANT_NONPERFORMANCE',
    ].map((dimensionKey) => ({ dimension_key: dimensionKey }));
    return input;
  };
  const group = (groupKey, memberFieldKeys) => ({
    group_key: groupKey,
    profile_key: 'BREACH_RIGHT',
    label: `Group ${groupKey}`,
    member_field_keys: memberFieldKeys,
  });

  await t.test('unknown profile dimension', () => {
    const input = base();
    input.review_state.fact_groups = [group('UNKNOWN', ['NOT_IN_PROFILE'])];
    assert.throws(
      () => buildTerminationRightsReviewRowsV2(input),
      (error) => error instanceof TerminationRightsReviewRowsError
        && error.code === 'REVIEW_STATE_DRIFT',
    );
  });
  await t.test('duplicate member in one group', () => {
    const input = base();
    input.review_state.fact_groups = [group('DUPLICATE', [
      'COMPANY_REPRESENTATION_BREACH',
      'COMPANY_REPRESENTATION_BREACH',
    ])];
    assert.throws(
      () => buildTerminationRightsReviewRowsV2(input),
      (error) => error instanceof TerminationRightsReviewRowsError
        && error.code === 'REVIEW_STATE_DRIFT',
    );
  });
  await t.test('member shared by two groups', () => {
    const input = base();
    input.review_state.fact_groups = [
      group('FIRST', ['COMPANY_REPRESENTATION_BREACH']),
      group('SECOND', ['COMPANY_REPRESENTATION_BREACH']),
    ];
    assert.throws(
      () => buildTerminationRightsReviewRowsV2(input),
      (error) => error instanceof TerminationRightsReviewRowsError
        && error.code === 'REVIEW_STATE_DRIFT',
    );
  });
});

test('transient fact groups reject delegated and descendant-owned dimensions', async (t) => {
  await t.test('delegated dimension', () => {
    const input = addDelegatedFiduciaryDimension(richBreachScenario());
    delete input.expected;
    input.review_state.fact_groups = [{
      group_key: 'DELEGATED_FIELDS',
      profile_key: 'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT',
      label: 'Delegated fields',
      member_field_keys: ['DELEGATED_BREACH_REFERENCE'],
    }];

    assert.throws(
      () => buildTerminationRightsReviewRowsV2(input),
      (error) => error instanceof TerminationRightsReviewRowsError
        && error.code === 'REVIEW_STATE_DRIFT',
    );
  });

  await t.test('field supplied only by a child rule', () => {
    const input = addNestedFiduciaryRule(richBreachScenario());
    delete input.expected;
    input.review_state.fact_groups = [{
      group_key: 'PARENT_FIELDS',
      profile_key: 'BREACH_RIGHT',
      label: 'Parent fields',
      member_field_keys: ['EXERCISE_MODE'],
    }];

    assert.throws(
      () => buildTerminationRightsReviewRowsV2(input),
      (error) => error instanceof TerminationRightsReviewRowsError
        && error.code === 'REVIEW_STATE_DRIFT',
    );
  });
});

test('rich Termination review rejects an open key that selects no proposition', () => {
  const input = richBreachScenario();
  delete input.expected;
  input.review_state.open_review_keys = ['FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE'];

  assert.throws(
    () => buildTerminationRightsReviewRowsV2(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_STATE_DRIFT',
  );
});

test('rich Termination review rejects a dimension outside the matched profile inventory', () => {
  const input = richBreachScenario();
  delete input.expected;
  input.review_state.open_review_keys = ['BREACH_RIGHT::STALE_DIMENSION'];

  assert.throws(
    () => buildTerminationRightsReviewRowsV2(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_STATE_DRIFT',
  );
});

test('a profile-level open review key appears on every matching proposition', () => {
  const input = addSecondBreachOccurrence(richBreachScenario());
  delete input.expected;
  input.analysis.profile_snapshots[0].profile_key = 'PROFILE:TERMINATION:BREACH_RIGHT';
  input.review_state.open_review_keys = [
    'PROFILE:TERMINATION:BREACH_RIGHT::EXERCISE_MODE',
  ];

  const result = buildTerminationRightsReviewRowsV2(input);

  assert.equal(result.rows.length, 2);
  for (const row of result.rows) {
    assert.equal(row.subtype_key, 'BREACH_RIGHT');
    assert.equal(row.decision_review_required, true);
    assert.deepEqual(row.dimension_reviews.map((review) => review.review_key), [
      'PROFILE:TERMINATION:BREACH_RIGHT::EXERCISE_MODE',
    ]);
  }
});

test('a nested profile review remains on the child and flags its enclosing proposition', () => {
  const input = addNestedFiduciaryRule(richBreachScenario());
  delete input.expected;
  input.review_state.open_review_keys = [
    'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE',
  ];

  const result = buildTerminationRightsReviewRowsV2(input);
  const [row] = result.rows;
  const [childRule] = row.child_rules;

  assert.equal(row.decision_review_required, true);
  assert.deepEqual(row.dimension_reviews, []);
  assert.equal(childRule.decision_review_required, true);
  assert.deepEqual(childRule.dimension_reviews, [{
    review_key: 'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE',
    dimension_key: 'EXERCISE_MODE',
    state: 'OPEN',
    fact_ids: ['fact:fiduciary-exercise'],
    evidence_parts: [{
      location: 'PRIMARY',
      agreement_index_id: 'agreement-index:1',
      source_node_occurrence_id: 'node:7.01(d)',
      selector: {
        coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
        start_byte: 36,
        end_byte: 61,
        text_sha256: sha256('breaches a representation'),
      },
      quote: 'breaches a representation',
    }],
  }]);
});

test('a delegated dimension follows its exact ownership link to the owner fact', () => {
  const input = addDelegatedFiduciaryDimension(richBreachScenario());
  const expected = input.expected;
  delete input.expected;
  input.review_state.open_review_keys = [
    'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT::DELEGATED_BREACH_REFERENCE',
  ];

  const result = buildTerminationRightsReviewRowsV2(input);
  const [childRule] = result.rows[0].child_rules;

  assert.deepEqual(childRule.dimension_reviews, [{
    review_key: 'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT::DELEGATED_BREACH_REFERENCE',
    dimension_key: 'DELEGATED_BREACH_REFERENCE',
    state: 'OPEN',
    fact_ids: ['fact:representation'],
    ownership_link_id: 'ownership-link:fiduciary-breach',
    evidence_parts: [{
      location: 'PRIMARY',
      agreement_index_id: 'agreement-index:1',
      source_node_occurrence_id: 'node:7.01(d)',
      selector: {
        coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
        start_byte: 65,
        end_byte: 81,
        text_sha256: sha256('fails a covenant'),
      },
      quote: 'fails a covenant',
    }, {
      location: 'LINKED',
      agreement_index_id: 'agreement-index:1',
      source_node_occurrence_id: 'node:7.01(d)',
      selector: {
        coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
        start_byte: 36,
        end_byte: 61,
        text_sha256: sha256('breaches a representation'),
      },
      quote: 'breaches a representation',
    }],
  }]);
  assert.deepEqual(childRule.linked_provisions.find(
    (provision) => provision.ownership_link_id === 'ownership-link:fiduciary-breach',
  ), {
    location: 'LINKED',
    source_reference: '7.01(d)',
    agreement_index_id: 'agreement-index:1',
    source_node_occurrence_id: 'node:7.01(d)',
    selector: {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      start_byte: 0,
      end_byte: Buffer.byteLength(expected.breachText, 'utf8'),
      text_sha256: sha256(expected.breachText),
    },
    exact_text: expected.breachText,
    ownership_link_id: 'ownership-link:fiduciary-breach',
    owner_rule_id: 'rule:breach',
    owner_fact_id: 'fact:representation',
  });
});

test('rich Termination review assembly attaches V2 without changing any canonical input', () => {
  const records = richBreachScenario();
  delete records.expected;
  const reviewDeal = { dealId: 'deal:1', cards: [] };
  const before = structuredClone({ records, reviewDeal });

  const assembled = assembleTerminationRightsReviewV2({ reviewDeal, ...records });

  assert.equal(
    assembled.canonical_v2_termination_rights_review_rows.schema_version,
    'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
  );
  assert.deepEqual({ records, reviewDeal }, before);
  assert.equal(Object.isFrozen(assembled), true);
});

test('rich Termination review survives the server-to-browser wire round trip unchanged', () => {
  const records = richBreachScenario();
  delete records.expected;
  records.analysis.profile_snapshots[0].known_relevant_dimensions = [
    { dimension_key: 'COMPANY_COVENANT_NONPERFORMANCE' },
    { dimension_key: 'COMPANY_REPRESENTATION_BREACH' },
  ];
  records.review_state.fact_groups = [{
    group_key: 'BREACH_FIELDS',
    profile_key: 'BREACH_RIGHT',
    label: 'Breach fields',
    member_field_keys: [
      'COMPANY_COVENANT_NONPERFORMANCE',
      'COMPANY_REPRESENTATION_BREACH',
    ],
  }];
  const assembled = assembleTerminationRightsReviewV2({
    reviewDeal: { dealId: 'deal:1', cardCount: 0, cards: [] },
    ...records,
  });
  const expected = assembled.canonical_v2_termination_rights_review_rows;

  const rebuilt = reconstructReviewDeal(JSON.parse(JSON.stringify(
    trimReviewDealForWire(assembled),
  )));

  assert.deepEqual(rebuilt.canonical_v2_termination_rights_review_rows, expected);
  const [row] = rebuilt.canonical_v2_termination_rights_review_rows.rows;
  assert.equal(row.full_provision.exact_text.includes('Parent may terminate'), true);
  assert.equal(row.linked_provisions.length, 2);
  assert.equal(row.expression_tree.operator, 'ALL_OF');
  assert.deepEqual(row.fact_groups, [{
    group_key: 'BREACH_FIELDS',
    label: 'Breach fields',
    member_field_keys: [
      'COMPANY_COVENANT_NONPERFORMANCE',
      'COMPANY_REPRESENTATION_BREACH',
    ],
    member_fact_ids: ['fact:covenant', 'fact:representation'],
  }]);
  assert.deepEqual(row.ungrouped_fact_ids, [
    'fact:condition',
    'fact:incurable',
    'fact:uncured',
    'fact:bar',
  ]);
  assert.equal(
    row.expression_tree.children[0].node.children[0].node.evidence_parts[0].quote,
    'breaches a representation',
  );
});

test('Failure to Close keeps the closing result separate from continuing Company-side readiness', () => {
  const result = buildTerminationRightsReviewRowsV2(failureToCloseScenario());
  const [row] = result.rows;
  const closingResult = row.expression_tree.children[2].node;

  assert.equal(row.subtype_key, 'FAILURE_TO_CLOSE_RIGHT');
  assert.equal(closingResult.operator, 'ALL_OF');
  assert.equal(
    closingResult.children[0].node.field_key,
    'CLOSING_NOT_CONSUMMATED_BY_FIFTH_BUSINESS_DAY',
  );
  assert.deepEqual(
    closingResult.children[1].node.children.map((entry) => entry.node.field_key),
    ['COMPANY_PREPARED_THROUGHOUT_WINDOW', 'PARTNERSHIP_PREPARED_THROUGHOUT_WINDOW'],
  );
  const fieldKeys = JSON.stringify(row.expression_tree);
  assert.doesNotMatch(fieldKeys, /PARENT_(?:READINESS|BREACH|FAULT|CAUSATION)/u);
});
