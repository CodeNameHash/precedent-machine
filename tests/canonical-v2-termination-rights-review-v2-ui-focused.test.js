const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let terminationRightsConfig;
let rowIdentityKey;

test.before(async () => {
  ({ terminationRightsConfig } = await import(path.join(
    '..',
    'components',
    'review',
    'table-configs',
    'termination-rights.config.js',
  )));
  ({ rowIdentityKey } = await import(path.join(
    '..',
    'components',
    'review-v2',
    'compareRowUnion.js',
  )));
});

function selector(start, end, hash) {
  return {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: start,
    end_byte: end,
    text_sha256: hash,
  };
}

function evidencePart({
  quote,
  start,
  end,
  hash,
  node = 'node:7.01(d)',
  location = 'PRIMARY',
}) {
  return {
    location,
    agreement_index_id: 'agreement-index:1',
    source_node_occurrence_id: node,
    selector: selector(start, end, hash),
    quote,
  };
}

function factNode({ id, fieldKey, value, quote, start, end, hash }) {
  return {
    kind: 'FACT',
    fact_id: id,
    field_key: fieldKey,
    value_type: typeof value === 'boolean' ? 'BOOLEAN' : 'ENUM',
    typed_value: value,
    materiality: 'MATERIAL',
    evidence_parts: [evidencePart({ quote, start, end, hash })],
  };
}

function child(kind, ordinal, role, node) {
  return { kind, ordinal, role, node };
}

function expression(id, operator, children, quote, start, end, hash) {
  return {
    expression_id: id,
    operator,
    result_kind: ['EARLIER_OF', 'LATER_OF'].includes(operator) ? 'TEMPORAL' : 'LOGICAL',
    connective_evidence_parts: [evidencePart({ quote, start, end, hash })],
    children,
  };
}

function baseV2Row(overrides = {}) {
  const party = factNode({
    id: 'fact:party',
    fieldKey: 'APPLIES_TO',
    value: { parties: ['PARENT'] },
    quote: 'Parent may terminate',
    start: 100,
    end: 120,
    hash: 'party-hash',
  });
  party.value_type = 'PARTY_SET';
  const representation = factNode({
    id: 'fact:representation',
    fieldKey: 'COMPANY_REPRESENTATION_BREACH',
    value: true,
    quote: 'breaches a representation',
    start: 130,
    end: 155,
    hash: 'representation-hash',
  });
  const covenant = factNode({
    id: 'fact:covenant',
    fieldKey: 'COMPANY_COVENANT_NONPERFORMANCE',
    value: true,
    quote: 'fails to perform a covenant',
    start: 159,
    end: 186,
    hash: 'covenant-hash',
  });
  const disqualifyingDefault = factNode({
    id: 'fact:bar',
    fieldKey: 'PARENT_DISQUALIFYING_DEFAULT',
    value: true,
    quote: 'Parent default causes Section 6.03(a) to fail',
    start: 220,
    end: 266,
    hash: 'bar-hash',
  });
  const trigger = expression('expression:trigger', 'ANY_OF', [
    child('FACT', 1, 'MEMBER', representation),
    child('FACT', 2, 'MEMBER', covenant),
  ], 'or', 156, 158, 'or-hash');
  const exclusion = expression('expression:not', 'NOT', [
    child('FACT', 1, 'NEGATED', disqualifyingDefault),
  ], 'but not', 212, 219, 'not-hash');
  const root = expression('expression:root', 'ALL_OF', [
    child('FACT', 1, 'MEMBER', party),
    child('EXPRESSION', 2, 'MEMBER', trigger),
    child('EXPRESSION', 3, 'MEMBER', exclusion),
  ], 'and', 187, 190, 'and-hash');

  return {
    display_section_id: 'termination-rights',
    governed_ordinal: 0,
    input_occurrence_id: 'occurrence:1',
    disposition_id: 'disposition:1',
    effect_id: 'effect:breach',
    rule_id: 'rule:breach',
    profile_id: 'profile:breach',
    profile_key: 'BREACH_RIGHT',
    subtype_key: 'BREACH_RIGHT',
    projection_row_id: 'projection:breach',
    fact_ids: ['fact:party', 'fact:representation', 'fact:covenant', 'fact:bar'],
    source_span_ids: ['span:party', 'span:representation', 'span:covenant', 'span:bar'],
    extraction_state: 'COMPLETE',
    source_quality: 'SUFFICIENT',
    output_disposition: 'NORMAL',
    review_required: false,
    issue_codes: [],
    full_provision: {
      location: 'PRIMARY',
      source_reference: '7.01(d)',
      agreement_index_id: 'agreement-index:1',
      source_node_occurrence_id: 'node:7.01(d)',
      selector: selector(90, 300, 'primary-provision-hash'),
      exact_text: 'Parent may terminate if the Company breaches a representation or fails to perform a covenant, but not while a Parent default causes a closing condition to fail.',
    },
    linked_provisions: [{
      location: 'LINKED',
      dependency_id: 'dependency:6.03',
      dependency_type: 'CLOSING_CONDITION_REFERENCE',
      source_reference: '6.03',
      agreement_index_id: 'agreement-index:1',
      source_node_occurrence_id: 'node:6.03',
      selector: selector(400, 510, 'linked-provision-hash'),
      exact_text: 'Section 6.03(a) and Section 6.03(b) are the Parent closing conditions.',
      evidence_parts: [evidencePart({
        quote: 'Section 6.03(a)',
        start: 240,
        end: 255,
        hash: 'linked-reference-hash',
      })],
    }],
    dependency_references: [],
    expression_tree: root,
    child_rules: [],
    fact_groups: [],
    ungrouped_fact_ids: ['fact:party', 'fact:representation', 'fact:covenant', 'fact:bar'],
    dimension_reviews: [{
      review_key: 'BREACH_RIGHT::EXERCISE_MODE',
      dimension_key: 'EXERCISE_MODE',
      state: 'OPEN',
      review_prompt: 'Does the separate termination-notice sentence govern this right?',
      fact_ids: [],
      evidence_parts: [evidencePart({
        quote: 'Parent may terminate',
        start: 100,
        end: 120,
        hash: 'party-hash',
      })],
    }],
    decision_review_required: true,
    ...overrides,
  };
}

function v2ReviewRows(row = baseV2Row()) {
  return {
    schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
    agreement_analysis_id: 'analysis:1',
    agreement_projection_id: 'projection:1',
    rows: [row],
    general_review_items: [],
  };
}

function card(overrides = {}) {
  return {
    id: overrides.id || 'card:1',
    provision_instance_id: overrides.id || 'card:1',
    provision_type: overrides.provision_type || 'TERMINATION_RIGHT',
    provision_subtype: overrides.provision_subtype || 'TERMR-OUTSIDE',
    primary_quote: overrides.primary_quote || 'Legacy outside-date provision.',
    features: overrides.features || { outsideDate: '2027-01-01' },
    ...overrides,
  };
}

test('V2 Termination row shows the complete legal context and keeps open legal review separate', () => {
  const reviewDeal = {
    cards: [
      card(),
      card({
        id: 'remedy',
        provision_type: 'TERMINATION_FEE',
        provision_subtype: 'TERMF-SOLE',
        features: { willfulBreachException: true },
      }),
      card({
        id: 'fiduciary',
        provision_type: 'TERMINATION_FEE',
        provision_subtype: 'TERMF-TARGET',
        features: { feeRequired: true },
      }),
      card({
        id: 'deferred',
        canonical_v2_lineage: { source: 'CANONICAL_V2_OPEN_WORLD_EVIDENCE' },
        features: { canonicalV2OpenWorldEvidence: { surface: 'OTHER_RIGHT', detail: 'Retained source evidence' } },
      }),
    ],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(),
    canonical_v2_termination_rights_review_prompts: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
      prompts: [{
        review_key: 'BREACH_RIGHT::EXERCISE_MODE',
        question: 'Which notice rule governs this termination right?',
        analysis: 'The termination limb and the section-wide notice sentence are separate.',
        requested_input: 'Confirm whether the notice sentence should be captured once as a section rule.',
      }],
    },
    canonical_v2_termination_rights_review_source_status: {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: 'ATTACHED',
      review_row_count: 1,
      prompt_count: 1,
      failure: null,
    },
  };

  const selected = terminationRightsConfig.selectRows(reviewDeal);
  const groups = selected[0].groups;
  const canonical = groups.find((group) => group.id === 'canonical-v2-termination-right-propositions');
  const row = canonical.rows[0];
  const analysisHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  const sourceHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, row.seeTextContent));

  assert.equal(row.titleText, 'Breach right | Parent');
  assert.equal(row.reviewRequired, false);
  assert.equal(row.decisionReviewRequired, true);
  assert.equal(row.sourceCard, undefined, 'the UI must not invent a source card');
  assert.deepEqual(groups.map((group) => group.id), [
    'canonical-v2-termination-right-propositions',
    'remedies',
    'fiduciary-out',
    'deferred-evidence',
  ]);
  assert.doesNotMatch(analysisHtml, /data-termination-review-required/);
  assert.match(analysisHtml, /data-termination-decision-review-required="true"/);
  assert.match(analysisHtml, /Open legal review/);
  assert.match(analysisHtml, /How the termination right is exercised/);
  assert.match(analysisHtml, /Which notice rule governs this termination right\?/);
  assert.match(analysisHtml, /The termination limb and the section-wide notice sentence are separate\./);
  assert.match(analysisHtml, /Confirm whether the notice sentence should be captured once as a section rule\./);
  assert.match(analysisHtml, /Analysis/);
  assert.match(analysisHtml, /All of these tests must be satisfied/);
  assert.match(analysisHtml, /Any one of these tests is sufficient/);
  assert.match(analysisHtml, /The following test must not be satisfied/);
  assert.match(analysisHtml, /Party with right to terminate/);
  assert.doesNotMatch(analysisHtml, />APPLIES_TO</);
  assert.match(analysisHtml, /breaches a representation/);
  assert.match(sourceHtml, /Primary provision/);
  assert.match(sourceHtml, /7\.01\(d\)/);
  assert.match(sourceHtml, /Parent may terminate if the Company breaches a representation/);
  assert.match(sourceHtml, /Linked provision/);
  assert.match(sourceHtml, /Section 6\.03\(a\) and Section 6\.03\(b\)/);
  assert.match(sourceHtml, /Exact words relied on/);
  assert.match(sourceHtml, /Parent may terminate/);
  assert.match(sourceHtml, /UTF8_CANONICAL_TEXT_HALF_OPEN/);
  assert.match(sourceHtml, /bytes 100–120/);
  assert.match(sourceHtml, /SHA-256 party-hash/);

  const CoverageFooter = () => React.createElement('div', null, 'legacy coverage');
  assert.equal(terminationRightsConfig.renderFooter(selected, { primitives: { CoverageFooter } }), null);
});

test('V2 analysis gives every canonical expression operator a lawyer-readable label', () => {
  let offset = 600;
  const operatorFactIds = [];
  const leaf = (suffix) => {
    const start = offset;
    offset += 10;
    const fact = factNode({
      id: `fact:${suffix}`,
      fieldKey: `TEST_${suffix}`,
      value: true,
      quote: `test ${suffix}`,
      start,
      end: start + 5,
      hash: `hash-${suffix}`,
    });
    operatorFactIds.push(fact.fact_id);
    return fact;
  };
  const binary = (operator, roles) => expression(
    `expression:${operator}`,
    operator,
    roles.map((role, index) => child('FACT', index + 1, role, leaf(`${operator}:${index + 1}`))),
    operator.toLowerCase(),
    offset,
    offset + 2,
    `hash-${operator}`,
  );
  const nested = [
    binary('ANY_OF', ['MEMBER', 'MEMBER']),
    expression('expression:NOT', 'NOT', [child('FACT', 1, 'NEGATED', leaf('NOT'))], 'not', offset, offset + 2, 'hash-NOT'),
    binary('IF_THEN', ['CONDITION', 'CONSEQUENCE']),
    binary('EXCEPTION_TO', ['BASE', 'EXCEPTION']),
    binary('OVERRIDES', ['OVERRIDING', 'OVERRIDDEN']),
    binary('DEEMS_AS', ['TRIGGER', 'DEEMED_RESULT']),
    binary('EARLIER_OF', ['MEMBER', 'MEMBER']),
    binary('LATER_OF', ['MEMBER', 'MEMBER']),
    binary('TO_EXTENT', ['BASE', 'EXTENT_LIMIT']),
    binary('CONSEQUENCE_MODIFIER', ['BASE_EFFECT', 'MODIFIED_CONSEQUENCE']),
  ];
  const root = expression(
    'expression:all-operators',
    'ALL_OF',
    nested.map((node, index) => child('EXPRESSION', index + 1, 'MEMBER', node)),
    'and',
    550,
    553,
    'hash-all-operators',
  );
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(baseV2Row({
      expression_tree: root,
      fact_ids: operatorFactIds,
      ungrouped_fact_ids: operatorFactIds,
      dimension_reviews: [],
      decision_review_required: false,
    })),
  };

  const row = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  for (const label of [
    'All of these tests must be satisfied',
    'Any one of these tests is sufficient',
    'The following test must not be satisfied',
    'If / then',
    'Exception to the base rule',
    'Override',
    'Deemed result',
    'Earlier of',
    'Later of',
    'Only to the following extent',
    'Modified consequence',
  ]) {
    assert.match(html, new RegExp(label.replace('/', '\\/')));
  }
  for (const role of [
    'Condition',
    'Consequence',
    'Base rule',
    'Exception',
    'Overriding rule',
    'Overridden rule',
    'Trigger',
    'Extent limit',
    'Base effect',
  ]) {
    assert.match(html, new RegExp(role));
  }
});

test('Failure to Close uses the settled multi-test labels instead of the old flat-field copy', () => {
  const row = baseV2Row({
    profile_key: 'FAILURE_TO_CLOSE_RIGHT',
    subtype_key: 'FAILURE_TO_CLOSE_RIGHT',
    dimension_reviews: [],
    decision_review_required: false,
  });
  const fields = [
    ['OBLIGATED_CLOSING_PARTY', 'PARENT', 'Parent'],
    ['CLOSING_OBLIGATION_REFERENCE', 'Section 1.5', 'Section 1.5'],
    ['CLOSING_CONDITIONS_REFERENCE', 'Sections 6.1 and 6.2', 'Sections 6.1 and 6.2'],
    ['CLOSING_DEADLINE_REFERENCE', 'Section 1.5', 'when the Closing should have occurred'],
    ['READINESS_REQUIREMENT_REFERENCE', true, 'prepared to consummate the Closing'],
    ['NOTICE_REQUIREMENT', true, 'delivery of the notice referenced in clause (B)'],
    ['NOTICE_PERIOD', 'five Business Days', 'fifth Business Day after delivery'],
    ['CLOSING_FAILURE_PERSISTENCE', true, 'fails to consummate the Closing'],
  ];
  fields.forEach(([fieldKey, value, quote], index) => {
    const start = 700 + (index * 30);
    row.expression_tree.children.push(child('FACT', index + 10, 'MEMBER', factNode({
      id: `fact:${fieldKey}`,
      fieldKey,
      value,
      quote,
      start,
      end: start + Buffer.byteLength(quote, 'utf8'),
      hash: `hash-${fieldKey}`,
    })));
  });
  row.fact_ids = [
    'fact:party',
    'fact:representation',
    'fact:covenant',
    'fact:bar',
    ...fields.map(([fieldKey]) => `fact:${fieldKey}`),
  ];
  row.ungrouped_fact_ids = [...row.fact_ids];

  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(row),
  };
  const selectedRow = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    selectedRow.children,
  ));

  for (const label of [
    'Party whose failure to consummate the Closing can trigger the right',
    'Complete underlying duties to consummate the Closing',
    'Separate closing-condition tests',
    'Complete Section 1.5 schedule for when Closing must occur',
    'Notice statement and continuing readiness',
    'Separate readiness-notice and termination-notice steps',
    'Post-readiness closing window and Business Day definition',
    'Closing not consummated on or before the fifth Business Day after the readiness notice',
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, /Party required to close/);
  assert.doesNotMatch(html, /Failure to close by the end of the notice period/);
});

test('V2 renders approved fact groups in supplied order without changing the legal tree', () => {
  const outsideFields = [
    'DEADLINE_FORM',
    'OUTSIDE_DATE',
    'OUTSIDE_DATE_TERM',
    'OUTSIDE_DATE_PERIOD',
    'DEADLINE_CLOCK_HOUR',
    'DEADLINE_CLOCK_MINUTE',
    'DEADLINE_MERIDIEM',
    'DEADLINE_TIME_ZONE',
    'EXTENSION_MECHANISM_REFERENCE',
  ];
  const approvalFields = [
    'APPROVAL_SUBJECT',
    'APPROVAL_REFERENCE',
    'APPROVAL_THRESHOLD_STANDARD',
    'APPROVAL_THRESHOLD_REFERENCE',
    'APPROVAL_METHOD',
    'MEETING_COMPLETION_STANDARD',
    'FAILURE_MODE',
  ];

  function groupedRow({
    subtypeKey,
    ordinal,
    groupKey,
    groupLabel,
    memberFieldKeys,
  }) {
    const party = factNode({
      id: `fact:${subtypeKey}:party`,
      fieldKey: 'APPLIES_TO',
      value: { parties: ['PARENT'] },
      quote: 'Parent may terminate',
      start: 1600 + (ordinal * 1000),
      end: 1620 + (ordinal * 1000),
      hash: `hash-${subtypeKey}-party`,
    });
    party.value_type = 'PARTY_SET';
    const memberFacts = memberFieldKeys.map((fieldKey, index) => factNode({
      id: `fact:${subtypeKey}:${fieldKey}`,
      fieldKey,
      value: `${fieldKey} value`,
      quote: `${fieldKey} words`,
      start: 1640 + (ordinal * 1000) + (index * 30),
      end: 1655 + (ordinal * 1000) + (index * 30),
      hash: `hash-${subtypeKey}-${fieldKey}`,
    }));
    const root = expression(
      `expression:${subtypeKey}`,
      'ALL_OF',
      [party, ...memberFacts].map((fact, index) => child('FACT', index + 1, 'MEMBER', fact)),
      'and',
      1625 + (ordinal * 1000),
      1628 + (ordinal * 1000),
      `hash-${subtypeKey}-and`,
    );
    return baseV2Row({
      governed_ordinal: ordinal,
      effect_id: `effect:${subtypeKey}`,
      rule_id: `rule:${subtypeKey}`,
      profile_id: `profile:${subtypeKey}`,
      profile_key: `PROFILE:TERMINATION:${subtypeKey}`,
      subtype_key: subtypeKey,
      projection_row_id: `projection:${subtypeKey}`,
      fact_ids: [party.fact_id, ...memberFacts.map((fact) => fact.fact_id)],
      expression_tree: root,
      fact_groups: [{
        group_key: groupKey,
        label: groupLabel,
        member_field_keys: [...memberFieldKeys],
        member_fact_ids: memberFacts.map((fact) => fact.fact_id),
      }],
      ungrouped_fact_ids: [party.fact_id],
      dimension_reviews: [],
      decision_review_required: false,
    });
  }

  const outside = groupedRow({
    subtypeKey: 'OUTSIDE_DATE_RIGHT',
    ordinal: 0,
    groupKey: 'OUTSIDE_DATE_SCHEDULE',
    groupLabel: 'Outside date schedule',
    memberFieldKeys: outsideFields,
  });
  const approval = groupedRow({
    subtypeKey: 'STOCKHOLDER_APPROVAL_FAILURE_RIGHT',
    ordinal: 1,
    groupKey: 'STOCKHOLDER_APPROVAL_REQUIREMENT',
    groupLabel: 'Complete stockholder approval requirement',
    memberFieldKeys: approvalFields,
  });
  const result = v2ReviewRows(outside);
  result.rows.push(approval);
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: result,
  };

  const rows = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows;
  const outsideHtml = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    rows[0].children,
  ));
  const approvalHtml = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    rows[1].children,
  ));

  assert.match(outsideHtml, /data-termination-fact-group="OUTSIDE_DATE_SCHEDULE"/);
  assert.match(outsideHtml, /Review grouping · Outside date schedule/);
  assert.match(approvalHtml, /data-termination-fact-group="STOCKHOLDER_APPROVAL_REQUIREMENT"/);
  assert.match(approvalHtml, /Review grouping · Complete stockholder approval requirement/);
  for (const [html, fields] of [
    [outsideHtml, outsideFields],
    [approvalHtml, approvalFields],
  ]) {
    let last = -1;
    for (const fieldKey of fields) {
      const position = html.indexOf(`data-termination-field-key="${fieldKey}"`);
      assert.ok(position > last, `${fieldKey} must follow the supplied group order`);
      last = position;
    }
    assert.match(html, /data-termination-ungrouped-facts="true"/);
    assert.match(html, /Party with right to terminate/);
    assert.match(html, /Analysis/);
    assert.match(html, /All of these tests must be satisfied/);
  }
});

test('V2 rejects a fact-group layout that does not partition its local facts', () => {
  const row = baseV2Row({
    fact_groups: [{
      group_key: 'DRIFTED_GROUP',
      label: 'Drifted fields',
      member_field_keys: ['COMPANY_REPRESENTATION_BREACH'],
      member_fact_ids: ['fact:representation'],
    }],
    ungrouped_fact_ids: ['fact:party', 'fact:covenant'],
    dimension_reviews: [],
    decision_review_required: false,
  });

  assert.throws(
    () => terminationRightsConfig.selectRows({
      cards: [],
      canonical_v2_termination_rights_review_rows: v2ReviewRows(row),
    }),
    /Canonical Termination Rights V2 review row is invalid/,
  );
});

test('V1 keeps the legacy family rows and coverage footer', () => {
  const reviewDeal = {
    cards: [card()],
    canonical_v2_termination_rights_review_rows: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V1',
      agreement_analysis_id: 'analysis:1',
      agreement_projection_id: 'projection:1',
      rows: [{
        display_section_id: 'termination-rights',
        governed_ordinal: 0,
        effect_id: 'effect:outside',
        rule_id: 'rule:outside',
        subtype_key: 'OUTSIDE_DATE_RIGHT',
        output_disposition: 'NORMAL',
        review_required: false,
        issue_codes: [],
        source_span_ids: [],
      }],
      general_review_items: [],
    },
  };

  const selected = terminationRightsConfig.selectRows(reviewDeal);
  assert.deepEqual(selected[0].groups.map((group) => group.id), [
    'canonical-v2-termination-right-propositions',
    'mutual',
  ]);
  const CoverageFooter = ({ presentCount, totalCount }) => React.createElement(
    'div',
    { 'data-present-count': presentCount, 'data-total-count': totalCount },
    'legacy coverage',
  );
  const footer = terminationRightsConfig.renderFooter(selected, { primitives: { CoverageFooter } });
  assert.notEqual(footer, null);
  assert.match(renderToStaticMarkup(footer), /legacy coverage/);
});

test('V2 resolves child-rule tests and shows each linked full provision once', () => {
  const childFullProvision = {
    location: 'LINKED',
    source_reference: '6.03',
    agreement_index_id: 'agreement-index:1',
    source_node_occurrence_id: 'node:6.03',
    selector: selector(800, 900, 'child-provision-hash'),
    exact_text: 'Child condition text: the restraint must be final and nonappealable.',
  };
  const finality = factNode({
    id: 'fact:finality',
    fieldKey: 'FINALITY_STANDARD',
    value: true,
    quote: 'must be final',
    start: 820,
    end: 833,
    hash: 'finality-hash',
  });
  const appealability = factNode({
    id: 'fact:appealability',
    fieldKey: 'APPEALABILITY_STANDARD',
    value: true,
    quote: 'nonappealable',
    start: 838,
    end: 851,
    hash: 'appealability-hash',
  });
  const childRule = {
    rule_id: 'rule:child-restraint',
    profile_id: 'profile:child-restraint',
    profile_key: 'PROFILE:TERMINATION:LEGAL_RESTRAINT_RIGHT',
    subtype_path: ['TERMINATION', 'TERMINATION_RIGHT', 'LEGAL_RESTRAINT_RIGHT'],
    full_provision: childFullProvision,
    linked_provisions: [],
    dependency_references: [],
    expression_tree: expression('expression:child-restraint', 'ALL_OF', [
      child('FACT', 1, 'MEMBER', finality),
      child('FACT', 2, 'MEMBER', appealability),
    ], 'and', 834, 837, 'child-and-hash'),
    child_rules: [],
    fact_ids: ['fact:finality', 'fact:appealability'],
    fact_groups: [],
    ungrouped_fact_ids: ['fact:finality', 'fact:appealability'],
    dimension_reviews: [],
    decision_review_required: false,
  };
  const party = factNode({
    id: 'fact:parent',
    fieldKey: 'APPLIES_TO',
    value: { parties: ['PARENT'] },
    quote: 'Parent may terminate',
    start: 100,
    end: 120,
    hash: 'party-hash',
  });
  party.value_type = 'PARTY_SET';
  const root = expression('expression:with-child', 'ALL_OF', [
    child('FACT', 1, 'MEMBER', party),
    child('RULE', 2, 'MEMBER', {
      kind: 'RULE',
      rule_id: childRule.rule_id,
      profile_id: childRule.profile_id,
      profile_key: childRule.profile_key,
      subtype_path: childRule.subtype_path,
    }),
  ], 'and', 121, 124, 'root-and-hash');
  const row = baseV2Row({
    expression_tree: root,
    fact_ids: [party.fact_id],
    ungrouped_fact_ids: [party.fact_id],
    linked_provisions: [childFullProvision],
    child_rules: [childRule],
    dimension_reviews: [],
    decision_review_required: false,
  });
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(row),
  };

  const uiRow = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const analysisHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, uiRow.children));
  const sourceHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, uiRow.seeTextContent));
  assert.match(analysisHtml, /Legal restraint right/);
  assert.match(analysisHtml, /Finality test/);
  assert.match(analysisHtml, /Appealability test/);
  assert.equal((sourceHtml.match(/Child condition text/g) || []).length, 1);
});

test('V2 shows a nested child-rule review and includes it in exact prompt coverage', () => {
  const childFullProvision = {
    location: 'LINKED',
    source_reference: '7.01(c)(ii)',
    agreement_index_id: 'agreement-index:1',
    source_node_occurrence_id: 'node:7.01(c)(ii)',
    selector: selector(950, 1040, 'fiduciary-provision-hash'),
    exact_text: 'The Company may terminate after the fiduciary notice process is complete.',
  };
  const exercise = factNode({
    id: 'fact:fiduciary-exercise',
    fieldKey: 'EXERCISE_MODE',
    value: 'WRITTEN_NOTICE',
    quote: 'after the fiduciary notice process is complete',
    start: 980,
    end: 1027,
    hash: 'fiduciary-exercise-hash',
  });
  const reviewKey = 'FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE';
  const childRule = {
    rule_id: 'rule:child-fiduciary',
    profile_id: 'profile:child-fiduciary',
    profile_key: 'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT',
    subtype_path: ['TERMINATION', 'TERMINATION_RIGHT', 'FIDUCIARY_NOTICE_RIGHT'],
    full_provision: childFullProvision,
    linked_provisions: [],
    dependency_references: [],
    expression_tree: expression('expression:child-fiduciary', 'ALL_OF', [
      child('FACT', 1, 'MEMBER', exercise),
    ], 'after', 970, 975, 'child-after-hash'),
    child_rules: [],
    fact_ids: ['fact:fiduciary-exercise'],
    fact_groups: [],
    ungrouped_fact_ids: ['fact:fiduciary-exercise'],
    dimension_reviews: [{
      review_key: reviewKey,
      dimension_key: 'EXERCISE_MODE',
      state: 'OPEN',
      fact_ids: ['fact:fiduciary-exercise'],
      evidence_parts: exercise.evidence_parts,
    }],
    decision_review_required: true,
  };
  const party = factNode({
    id: 'fact:parent-with-child-review',
    fieldKey: 'APPLIES_TO',
    value: { parties: ['PARENT'] },
    quote: 'Parent may terminate',
    start: 100,
    end: 120,
    hash: 'parent-with-child-review-hash',
  });
  party.value_type = 'PARTY_SET';
  const root = expression('expression:nested-review', 'ALL_OF', [
    child('FACT', 1, 'MEMBER', party),
    child('RULE', 2, 'MEMBER', {
      kind: 'RULE',
      rule_id: childRule.rule_id,
      profile_id: childRule.profile_id,
      profile_key: childRule.profile_key,
      subtype_path: childRule.subtype_path,
    }),
  ], 'and', 121, 124, 'nested-review-and-hash');
  const row = baseV2Row({
    expression_tree: root,
    fact_ids: [party.fact_id],
    ungrouped_fact_ids: [party.fact_id],
    linked_provisions: [childFullProvision],
    child_rules: [childRule],
    dimension_reviews: [],
    decision_review_required: true,
  });
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(row),
    canonical_v2_termination_rights_review_prompts: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
      prompts: [{
        review_key: reviewKey,
        question: 'Does the separate notice sentence govern the child fiduciary right?',
        analysis: 'The open point belongs to the nested fiduciary rule.',
        requested_input: 'Confirm the child rule exercise mode.',
      }],
    },
  };

  const uiRow = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, uiRow.children));

  assert.equal(uiRow.decisionReviewRequired, true);
  assert.match(html, /Open legal review/);
  assert.match(html, /Fiduciary notice right · How the termination right is exercised/);
  assert.match(html, /Does the separate notice sentence govern the child fiduciary right\?/);
  assert.match(html, /The open point belongs to the nested fiduciary rule\./);
  assert.match(html, /Confirm the child rule exercise mode\./);
});

test('V2 distinguishes one profile review applied to two child-rule occurrences', () => {
  const reviewKey = 'FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE';
  function fiduciaryChild(suffix, sourceReference, start) {
    const fullProvision = {
      location: 'LINKED',
      source_reference: sourceReference,
      agreement_index_id: 'agreement-index:1',
      source_node_occurrence_id: `node:${sourceReference}`,
      selector: selector(start, start + 80, `fiduciary-${suffix}-provision-hash`),
      exact_text: `Fiduciary termination occurrence ${suffix}.`,
    };
    const exercise = factNode({
      id: `fact:fiduciary-exercise-${suffix}`,
      fieldKey: 'EXERCISE_MODE',
      value: 'WRITTEN_NOTICE',
      quote: `notice process ${suffix}`,
      start: start + 10,
      end: start + 30,
      hash: `fiduciary-${suffix}-exercise-hash`,
    });
    return {
      fullProvision,
      rule: {
        rule_id: `rule:child-fiduciary-${suffix}`,
        profile_id: 'profile:child-fiduciary',
        profile_key: 'PROFILE:TERMINATION:FIDUCIARY_NOTICE_RIGHT',
        subtype_path: ['TERMINATION', 'TERMINATION_RIGHT', 'FIDUCIARY_NOTICE_RIGHT'],
        full_provision: fullProvision,
        linked_provisions: [],
        dependency_references: [],
        expression_tree: expression(`expression:child-fiduciary-${suffix}`, 'ALL_OF', [
          child('FACT', 1, 'MEMBER', exercise),
        ], 'after', start + 1, start + 6, `fiduciary-${suffix}-after-hash`),
        child_rules: [],
        fact_ids: [exercise.fact_id],
        fact_groups: [],
        ungrouped_fact_ids: [exercise.fact_id],
        dimension_reviews: [{
          review_key: reviewKey,
          dimension_key: 'EXERCISE_MODE',
          state: 'OPEN',
          fact_ids: [exercise.fact_id],
          evidence_parts: exercise.evidence_parts,
        }],
        decision_review_required: true,
      },
    };
  }
  const first = fiduciaryChild('first', '7.01(c)(ii)', 1200);
  const second = fiduciaryChild('second', '8.02(f)', 1400);
  const party = factNode({
    id: 'fact:parent-with-two-child-reviews',
    fieldKey: 'APPLIES_TO',
    value: { parties: ['PARENT'] },
    quote: 'Parent may terminate',
    start: 100,
    end: 120,
    hash: 'parent-with-two-child-reviews-hash',
  });
  party.value_type = 'PARTY_SET';
  const root = expression('expression:two-child-reviews', 'ALL_OF', [
    child('FACT', 1, 'MEMBER', party),
    child('RULE', 2, 'MEMBER', {
      kind: 'RULE',
      rule_id: first.rule.rule_id,
      profile_id: first.rule.profile_id,
      profile_key: first.rule.profile_key,
      subtype_path: first.rule.subtype_path,
    }),
    child('RULE', 3, 'MEMBER', {
      kind: 'RULE',
      rule_id: second.rule.rule_id,
      profile_id: second.rule.profile_id,
      profile_key: second.rule.profile_key,
      subtype_path: second.rule.subtype_path,
    }),
  ], 'and', 121, 124, 'two-child-reviews-and-hash');
  const row = baseV2Row({
    expression_tree: root,
    fact_ids: [party.fact_id],
    ungrouped_fact_ids: [party.fact_id],
    linked_provisions: [first.fullProvision, second.fullProvision],
    child_rules: [first.rule, second.rule],
    dimension_reviews: [],
    decision_review_required: true,
  });
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(row),
    canonical_v2_termination_rights_review_prompts: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
      prompts: [{
        review_key: reviewKey,
        question: 'Does the exercise mode apply to each fiduciary occurrence?',
        analysis: 'The profile-level key selects both child rules.',
        requested_input: 'Review each cited occurrence.',
      }],
    },
  };

  const uiRow = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, uiRow.children));

  assert.equal((html.match(/Does the exercise mode apply to each fiduciary occurrence\?/g) || []).length, 2);
  assert.match(html, /Fiduciary notice right · How the termination right is exercised · 7\.01\(c\)\(ii\)/);
  assert.match(html, /Fiduciary notice right · How the termination right is exercised · 8\.02\(f\)/);
  assert.match(html, /data-termination-dimension-review-rule-id="rule:child-fiduciary-first"/);
  assert.match(html, /data-termination-dimension-review-rule-id="rule:child-fiduciary-second"/);
});

test('V2 renders a non-provision dependency as a reference, never as invented provision text', () => {
  const row = baseV2Row({
    linked_provisions: [],
    dependency_references: [{
      dependency_id: 'dependency:missing-condition',
      dependency_type: 'CLOSING_CONDITION_REFERENCE',
      state: 'UNRESOLVED',
      target_id: null,
      evidence_parts: [evidencePart({
        quote: 'subject to the conditions in Section 6.1',
        start: 1100,
        end: 1140,
        hash: 'missing-condition-reference-hash',
      })],
    }],
    dimension_reviews: [],
    decision_review_required: false,
  });
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(row),
  };

  const uiRow = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const sourceHtml = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    uiRow.seeTextContent,
  ));

  assert.match(sourceHtml, /data-termination-dependency-reference="UNRESOLVED"/);
  assert.match(sourceHtml, /Linked reference · Closing condition reference/);
  assert.match(sourceHtml, /Target provision not resolved/);
  assert.match(sourceHtml, /subject to the conditions in Section 6\.1/);
  assert.doesNotMatch(sourceHtml, /Linked provision/);
});

test('V2 failed extraction shows its complete source context in place', () => {
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(baseV2Row({
      extraction_state: 'PARTIAL',
      source_quality: 'INSUFFICIENT',
      output_disposition: 'REVIEW_ONLY',
      review_required: true,
      issue_codes: ['UNPROVED_DEPENDENT_RULE'],
      dimension_reviews: [],
      decision_review_required: false,
    })),
  };

  const row = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(html, /data-termination-review-required="true"/);
  assert.match(html, /Linked provision could not be proved/);
  assert.match(html, /Source context/);
  assert.match(html, /Primary provision/);
  assert.match(html, /Parent may terminate if the Company breaches a representation/);
  assert.match(html, /Linked provision/);
  assert.match(html, /Section 6\.03\(a\) and Section 6\.03\(b\)/);
  assert.match(html, /SHA-256 primary-provision-hash/);
});

test('V2 uses an inline transient review prompt when no prompt attachment is present', () => {
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(),
  };

  const row = terminationRightsConfig.selectRows(reviewDeal)[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(html, /Question:/);
  assert.match(html, /Does the separate termination-notice sentence govern this right\?/);
});

test('V2 titleText aligns the same termination proposition across deal-specific rule IDs', () => {
  const selectRow = (ruleId, effectId) => terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(baseV2Row({
      rule_id: ruleId,
      effect_id: effectId,
      dimension_reviews: [],
      decision_review_required: false,
    })),
  })[0].groups[0].rows[0];
  const left = selectRow('rule:left-deal', 'effect:left-deal');
  const right = selectRow('rule:right-deal', 'effect:right-deal');

  assert.notEqual(left.id, right.id);
  assert.equal(left.titleText, 'Breach right | Parent');
  assert.equal(right.titleText, left.titleText);
  assert.equal(rowIdentityKey(left), rowIdentityKey(right));
});

test('a failed canonical review source is visible without suppressing the legacy Termination rows', () => {
  const reviewDeal = {
    cards: [card()],
    canonical_v2_termination_rights_review_source_status: {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: 'FAILED',
      review_row_count: 0,
      prompt_count: 0,
      failure: {
        error_name: 'TerminationReviewSourceError',
        error_code: 'TERMINATION_REVIEW_SOURCE_FAILED',
        error_message: 'The canonical Termination review source could not be loaded.',
      },
    },
  };

  const selected = terminationRightsConfig.selectRows(reviewDeal);
  assert.deepEqual(selected[0].groups.map((group) => group.id), [
    'canonical-v2-termination-right-source-status',
    'mutual',
  ]);
  const failureRow = selected[0].groups[0].rows[0];
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, failureRow.children));
  assert.match(html, /data-termination-review-source-status="FAILED"/);
  assert.match(html, /Canonical Termination review unavailable/);
  assert.match(html, /The canonical Termination review source could not be loaded\./);

  const CoverageFooter = () => React.createElement('div', null, 'legacy coverage');
  assert.notEqual(terminationRightsConfig.renderFooter(selected, { primitives: { CoverageFooter } }), null);
});

test('canonical review source status rejects partial FAILED and incomplete ATTACHED states', () => {
  const failedWithRows = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(),
    canonical_v2_termination_rights_review_source_status: {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: 'FAILED',
      review_row_count: 0,
      prompt_count: 0,
      failure: {
        error_name: 'Error',
        error_code: null,
        error_message: 'failed',
      },
    },
  };
  const attachedWithoutPrompts = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(),
    canonical_v2_termination_rights_review_source_status: {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: 'ATTACHED',
      review_row_count: 1,
      prompt_count: 0,
      failure: null,
    },
  };

  assert.throws(
    () => terminationRightsConfig.selectRows(failedWithRows),
    /review source status is invalid/,
  );
  assert.throws(
    () => terminationRightsConfig.selectRows(attachedWithoutPrompts),
    /review source status is invalid/,
  );
});

test('an attached V2 result with no proposition rows keeps the useful legacy rows and footer', () => {
  const reviewDeal = {
    cards: [card()],
    canonical_v2_termination_rights_review_rows: {
      ...v2ReviewRows(),
      rows: [],
    },
    canonical_v2_termination_rights_review_prompts: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
      prompts: [],
    },
    canonical_v2_termination_rights_review_source_status: {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: 'ATTACHED',
      review_row_count: 0,
      prompt_count: 0,
      failure: null,
    },
  };

  const selected = terminationRightsConfig.selectRows(reviewDeal);
  assert.deepEqual(selected[0].groups.map((group) => group.id), ['mutual']);
  const CoverageFooter = () => React.createElement('div', null, 'legacy coverage');
  assert.notEqual(terminationRightsConfig.renderFooter(selected, { primitives: { CoverageFooter } }), null);
});

test('a prompt attachment must exactly and completely cover the open review keys', () => {
  const validPrompt = {
    review_key: 'BREACH_RIGHT::EXERCISE_MODE',
    question: 'Which notice rule governs this termination right?',
    analysis: 'The local and section-wide notice rules are separate.',
    requested_input: 'Confirm the governing notice rule.',
  };
  const reviewDeal = {
    cards: [],
    canonical_v2_termination_rights_review_rows: v2ReviewRows(),
  };

  for (const prompts of [
    [],
    [{ ...validPrompt, unexpected: true }],
    [validPrompt, {
      ...validPrompt,
      review_key: 'BREACH_RIGHT::NOTICE_PERIOD',
    }],
  ]) {
    assert.throws(() => terminationRightsConfig.selectRows({
      ...reviewDeal,
      canonical_v2_termination_rights_review_prompts: {
        schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
        prompts,
      },
    }), TypeError);
  }
});
