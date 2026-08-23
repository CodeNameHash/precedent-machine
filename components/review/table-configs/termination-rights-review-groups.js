import React from 'react';

const SUBTYPE_LABELS = Object.freeze({
  MUTUAL_CONSENT_RIGHT: 'Mutual consent right',
  OUTSIDE_DATE_RIGHT: 'Outside date right',
  LEGAL_RESTRAINT_RIGHT: 'Legal restraint right',
  STOCKHOLDER_APPROVAL_FAILURE_RIGHT: 'Stockholder approval failure right',
  BREACH_RIGHT: 'Breach right',
  SUPERIOR_PROPOSAL_RIGHT: 'Superior proposal right',
  RECOMMENDATION_CHANGE_RIGHT: 'Recommendation change right',
  FAILURE_TO_CLOSE_RIGHT: 'Failure to close right',
  FIDUCIARY_NOTICE_RIGHT: 'Fiduciary notice right',
});

const ISSUE_LABELS = Object.freeze({
  UNPROVED_DEPENDENT_RULE: 'Linked provision could not be proved',
  NO_COMPATIBLE_PROFILE: 'No approved Termination Right type matched',
});

const OPERATOR_LABELS = Object.freeze({
  ALL_OF: 'All of these tests must be satisfied',
  ANY_OF: 'Any one of these tests is sufficient',
  NOT: 'The following test must not be satisfied',
  IF_THEN: 'If / then',
  EXCEPTION_TO: 'Exception to the base rule',
  OVERRIDES: 'Override',
  DEEMS_AS: 'Deemed result',
  EARLIER_OF: 'Earlier of',
  LATER_OF: 'Later of',
  TO_EXTENT: 'Only to the following extent',
  CONSEQUENCE_MODIFIER: 'Modified consequence',
});

const ROLE_LABELS = Object.freeze({
  CONDITION: 'Condition',
  CONSEQUENCE: 'Consequence',
  BASE: 'Base rule',
  EXCEPTION: 'Exception',
  OVERRIDING: 'Overriding rule',
  OVERRIDDEN: 'Overridden rule',
  TRIGGER: 'Trigger',
  DEEMED_RESULT: 'Deemed result',
  EXTENT_LIMIT: 'Extent limit',
  BASE_EFFECT: 'Base effect',
  MODIFIED_CONSEQUENCE: 'Modified consequence',
  NEGATED: 'Negated test',
});

const FIELD_LABELS = Object.freeze({
  APPLIES_TO: 'Party with right to terminate',
  EXERCISE_MODE: 'How the termination right is exercised',
  EXERCISE_CUTOFF_REFERENCE: 'Latest time the right may be exercised',
  CONSENT_FORM: 'Required form of consent',
  AUTHORISING_BODY: 'Body that must authorise termination',
  OUTSIDE_DATE: 'Outside date schedule',
  OUTSIDE_DATE_TERM: 'Defined term for the outside date',
  OUTSIDE_DATE_PERIOD: 'Period from signing to the outside date',
  DEADLINE_FORM: 'How the outside date is stated',
  DEADLINE_CLOCK_HOUR: 'Outside date hour',
  DEADLINE_CLOCK_MINUTE: 'Outside date minute',
  DEADLINE_MERIDIEM: 'Outside date a.m. or p.m.',
  DEADLINE_TIME_ZONE: 'Outside date time zone',
  EXTENSION_MECHANISM_REFERENCE: 'Outside date extension schedule',
  SELF_CAUSATION_STANDARD: 'Restriction based on the terminating party\u2019s conduct',
  APPROVAL_SUBJECT: 'Complete stockholder approval requirement',
  APPROVAL_REFERENCE: 'Stockholder approval definition',
  APPROVAL_THRESHOLD_STANDARD: 'Required stockholder approval threshold',
  APPROVAL_THRESHOLD_REFERENCE: 'Source of the approval threshold',
  APPROVAL_METHOD: 'How stockholder approval must be obtained',
  MEETING_COMPLETION_STANDARD: 'Meeting completion test',
  FAILURE_MODE: 'How the approval requirement fails',
  BREACH_SCOPE: 'Provisions that must be breached',
  CAUSATION_STANDARD: 'Required result of the breach',
  CURE_PERIOD: 'Cure period, if the breach can be cured',
  CURE_START_EVENT: 'Event that starts the cure period',
  RESTRAINT_EFFECT: 'Effect of the legal restraint',
  RESTRAINT_KIND: 'Type of legal restraint',
  RESTRAINT_AUTHORITY_REFERENCE: 'Authority imposing the restraint',
  PERMANENCE_STANDARD: 'Permanence test',
  FINALITY_STANDARD: 'Finality test',
  APPEALABILITY_STANDARD: 'Appealability test',
  EFFORTS_RESTRICTION_REFERENCE: 'Conduct restriction and causation test',
  OBLIGATED_CLOSING_PARTY: 'Party whose failure to consummate the Closing can trigger the right',
  CLOSING_OBLIGATION_REFERENCE: 'Complete underlying duties to consummate the Closing',
  CLOSING_CONDITIONS_REFERENCE: 'Separate closing-condition tests',
  CLOSING_DEADLINE_REFERENCE: 'Complete Section 1.5 schedule for when Closing must occur',
  READINESS_REQUIREMENT_REFERENCE: 'Notice statement and continuing readiness',
  MARKETING_PERIOD_REFERENCE: 'Marketing period requirement',
  NOTICE_REQUIREMENT: 'Separate readiness-notice and termination-notice steps',
  NOTICE_PERIOD: 'Post-readiness closing window and Business Day definition',
  CLOSING_FAILURE_PERSISTENCE: 'Closing not consummated on or before the fifth Business Day after the readiness notice',
});

const PARTY_LABELS = Object.freeze({
  COMPANY: 'Company',
  TARGET: 'Company',
  PARENT: 'Parent',
  BUYER: 'Parent',
  EITHER_PARTY: 'Either party',
  BOTH_PARTIES: 'Both parties',
});

function humaniseToken(value) {
  const text = String(value ?? '').trim().replaceAll('_', ' ').toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function fieldLabel(fieldKey) {
  return FIELD_LABELS[fieldKey] || humaniseToken(fieldKey);
}

function ruleSubtypeKey(rule) {
  const path = Array.isArray(rule?.subtype_path) ? rule.subtype_path : [];
  return path.at(-1) || rule?.profile_key;
}

function partyLabel(party) {
  return PARTY_LABELS[party] || humaniseToken(party);
}

function formatTypedValue(value) {
  if (value === null || value === undefined) return 'Not stated';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    if (PARTY_LABELS[value]) return PARTY_LABELS[value];
    return /^[A-Z][A-Z0-9_]*$/.test(value) ? humaniseToken(value) : value;
  }
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(formatTypedValue).join(', ');
  if (Array.isArray(value.parties)) return value.parties.map(partyLabel).join(' and ');
  if (value.bound_type && Number.isInteger(value.count) && value.unit) {
    const bound = value.bound_type === 'EXACT' ? '' : `${humaniseToken(value.bound_type)} `;
    const unit = humaniseToken(value.unit).toLowerCase();
    return `${bound}${value.count} ${unit}${value.count === 1 ? '' : 's'}`;
  }
  if (value.amount !== undefined && value.currency) {
    return `${formatTypedValue(value.amount)} ${value.currency}`;
  }
  if (value.value !== undefined) return formatTypedValue(value.value);
  if (value.amount !== undefined && value.unit) {
    return `${formatTypedValue(value.amount)} ${humaniseToken(value.unit).toLowerCase()}`;
  }
  return Object.entries(value)
    .map(([key, item]) => `${humaniseToken(key)}: ${formatTypedValue(item)}`)
    .join('; ');
}

function selectorText(selector) {
  if (!selector || typeof selector !== 'object') return null;
  const parts = [];
  if (selector.coordinate_system) parts.push(selector.coordinate_system);
  if (Number.isSafeInteger(selector.start_byte) && Number.isSafeInteger(selector.end_byte)) {
    parts.push(`bytes ${selector.start_byte}\u2013${selector.end_byte}`);
  }
  if (selector.text_sha256) parts.push(`SHA-256 ${selector.text_sha256}`);
  return parts.join(' \u00b7 ');
}

function evidenceKey(part) {
  const selector = part?.selector || {};
  return [
    part?.agreement_index_id,
    part?.source_node_occurrence_id,
    selector.start_byte,
    selector.end_byte,
    selector.text_sha256,
    part?.quote,
  ].join('\0');
}

function sourceKey(source) {
  const selector = source?.selector || {};
  return [
    source?.agreement_index_id,
    source?.source_node_occurrence_id,
    selector.start_byte,
    selector.end_byte,
    selector.text_sha256,
  ].join('\0');
}

function collectRuleSources(rule, sources = [], seen = new Set(), nested = false) {
  if (!rule || typeof rule !== 'object') return sources;
  const fullProvision = rule.full_provision;
  if (fullProvision) {
    const key = sourceKey(fullProvision);
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ ...fullProvision, location: nested ? 'LINKED' : 'PRIMARY' });
    }
  }
  for (const linked of rule.linked_provisions || []) {
    const key = sourceKey(linked);
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ ...linked, location: 'LINKED' });
    }
  }
  for (const childRule of rule.child_rules || []) {
    collectRuleSources(childRule, sources, seen, true);
  }
  return sources;
}

function collectExpressionEvidence(expression, evidence) {
  if (!expression || typeof expression !== 'object') return;
  evidence.push(...(expression.connective_evidence_parts || []));
  for (const child of expression.children || []) {
    if (child.kind === 'FACT') evidence.push(...(child.node?.evidence_parts || []));
    if (child.kind === 'EXPRESSION') collectExpressionEvidence(child.node, evidence);
  }
}

function collectRuleEvidence(rule, evidence = []) {
  if (!rule || typeof rule !== 'object') return evidence;
  collectExpressionEvidence(rule.expression_tree, evidence);
  for (const linked of rule.linked_provisions || []) {
    evidence.push(...(linked.evidence_parts || []));
  }
  for (const reference of rule.dependency_references || []) {
    evidence.push(...(reference.evidence_parts || []));
  }
  for (const review of rule.dimension_reviews || []) {
    evidence.push(...(review.evidence_parts || []));
  }
  for (const childRule of rule.child_rules || []) collectRuleEvidence(childRule, evidence);
  return evidence;
}

function dedupeEvidence(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    if (!part || typeof part.quote !== 'string') return false;
    const key = evidenceKey(part);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceNode(parts, keyPrefix = 'evidence') {
  const evidence = dedupeEvidence(parts || []);
  if (!evidence.length) return null;
  return React.createElement(
    'div',
    { className: 'mt-2 space-y-2' },
    ...evidence.map((part, index) => React.createElement(
      'div',
      {
        key: `${keyPrefix}:${evidenceKey(part)}:${index}`,
        className: 'rounded border border-black/10 bg-white/70 px-2 py-1.5',
      },
      React.createElement('div', { className: 'whitespace-pre-wrap text-[11px] leading-5 text-ink' }, `\u201c${part.quote}\u201d`),
      selectorText(part.selector)
        ? React.createElement('div', { className: 'mt-1 text-[9px] text-inkFaint' }, selectorText(part.selector))
        : null,
    )),
  );
}

function childRuleIndex(rule, index = new Map()) {
  for (const childRule of rule?.child_rules || []) {
    index.set(childRule.rule_id, childRule);
    childRuleIndex(childRule, index);
  }
  return index;
}

function collectDimensionReviewEntries(rule, entries = [], depth = 0) {
  if (!rule || typeof rule !== 'object'
      || !Array.isArray(rule.dimension_reviews)
      || !Array.isArray(rule.child_rules)
      || typeof rule.decision_review_required !== 'boolean') {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }
  const initialCount = entries.length;
  for (const review of rule.dimension_reviews) {
    entries.push({
      review,
      subtypeKey: ruleSubtypeKey(rule),
      ruleId: rule.rule_id,
      sourceReference: rule.full_provision?.source_reference,
      depth,
    });
  }
  for (const childRule of rule.child_rules) {
    collectDimensionReviewEntries(childRule, entries, depth + 1);
  }
  if (rule.decision_review_required !== (entries.length > initialCount)) {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }
  return entries;
}

function dependencyReferenceKey(reference) {
  return [reference?.dependency_id, reference?.state, reference?.target_id].join('\0');
}

function collectDependencyReferences(rule, references = [], seen = new Set()) {
  if (!rule || typeof rule !== 'object') return references;
  for (const reference of rule.dependency_references || []) {
    const key = dependencyReferenceKey(reference);
    if (!seen.has(key)) {
      seen.add(key);
      references.push(reference);
    }
  }
  for (const childRule of rule.child_rules || []) {
    collectDependencyReferences(childRule, references, seen);
  }
  return references;
}

function disclosureNotes(fact) {
  const notes = Array.isArray(fact?.governed_disclosure_notes)
    ? fact.governed_disclosure_notes
    : [];
  if (notes.length === 0) return null;
  return React.createElement(
    'div',
    { className: 'mt-1 space-y-1' },
    ...notes.map((note, index) => (
      note && typeof note.display_text === 'string' && note.display_text
        ? React.createElement(
          'div',
          {
            key: `${fact?.field_key || 'note'}:${index}`,
            className: 'text-[11px] italic text-inkLight',
            'data-termination-governed-disclosure-note':
              note.disposition_kind || 'true',
          },
          note.display_text,
        )
        : null
    )),
  );
}

function factNode(fact) {
  return React.createElement(
    'div',
    {
      className: 'rounded border border-black/10 bg-white px-2 py-2',
      'data-termination-field-key': fact?.field_key,
    },
    React.createElement('div', { className: 'text-[10px] font-medium text-ink' }, fieldLabel(fact?.field_key)),
    React.createElement('div', { className: 'mt-0.5 text-[11px] text-inkLight' }, formatTypedValue(fact?.typed_value)),
    disclosureNotes(fact),
    evidenceNode(fact?.evidence_parts, fact?.fact_id || 'fact'),
  );
}

function collectLocalFacts(expression, facts = new Map()) {
  if (!expression || typeof expression !== 'object' || !Array.isArray(expression.children)) {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }
  for (const child of expression.children) {
    if (child?.kind === 'FACT') {
      const factId = child.node?.fact_id;
      if (typeof factId !== 'string' || !factId || facts.has(factId)) {
        throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
      }
      facts.set(factId, child.node);
    } else if (child?.kind === 'EXPRESSION') {
      collectLocalFacts(child.node, facts);
    }
  }
  return facts;
}

function equalStringArrays(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function factGroupLayout(rule) {
  if (!Array.isArray(rule?.fact_ids)
      || !Array.isArray(rule.fact_groups)
      || !Array.isArray(rule.ungrouped_fact_ids)
      || !Array.isArray(rule.child_rules)) {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }
  const localFacts = collectLocalFacts(rule.expression_tree);
  const factIds = [...rule.fact_ids];
  if (factIds.some((factId) => typeof factId !== 'string' || !factId)
      || new Set(factIds).size !== factIds.length
      || localFacts.size !== factIds.length
      || factIds.some((factId) => !localFacts.has(factId))) {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }

  const groupedFactIds = new Set();
  const groupKeys = new Set();
  for (const group of rule.fact_groups) {
    if (!hasExactKeys(group, ['group_key', 'label', 'member_field_keys', 'member_fact_ids'])
        || typeof group.group_key !== 'string' || !group.group_key
        || typeof group.label !== 'string' || !group.label
        || !Array.isArray(group.member_field_keys) || group.member_field_keys.length === 0
        || group.member_field_keys.some((fieldKey) => typeof fieldKey !== 'string' || !fieldKey)
        || new Set(group.member_field_keys).size !== group.member_field_keys.length
        || !Array.isArray(group.member_fact_ids) || group.member_fact_ids.length === 0
        || groupKeys.has(group.group_key)) {
      throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
    }
    groupKeys.add(group.group_key);
    const expectedMemberFactIds = group.member_field_keys.flatMap((fieldKey) => (
      factIds.filter((factId) => localFacts.get(factId)?.field_key === fieldKey)
    ));
    if (!equalStringArrays(group.member_fact_ids, expectedMemberFactIds)
        || group.member_fact_ids.some((factId) => groupedFactIds.has(factId))) {
      throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
    }
    group.member_fact_ids.forEach((factId) => groupedFactIds.add(factId));
  }

  const expectedUngroupedFactIds = factIds.filter((factId) => !groupedFactIds.has(factId));
  if (!equalStringArrays(rule.ungrouped_fact_ids, expectedUngroupedFactIds)) {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }
  const emittedFactIds = [
    ...rule.fact_groups.flatMap((group) => group.member_fact_ids),
    ...rule.ungrouped_fact_ids,
  ];
  if (emittedFactIds.length !== factIds.length
      || new Set(emittedFactIds).size !== factIds.length
      || factIds.some((factId) => !emittedFactIds.includes(factId))) {
    throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
  }

  return {
    rule,
    localFacts,
    children: rule.child_rules.map(factGroupLayout),
  };
}

function factGroupLayoutNodes(layout, depth = 0) {
  const nodes = [];
  if (layout.rule.fact_groups.length > 0) {
    if (depth > 0) {
      const subtypeKey = ruleSubtypeKey(layout.rule);
      nodes.push(React.createElement(
        'div',
        {
          key: `${layout.rule.rule_id}:group-context`,
          className: 'text-[10px] font-semibold text-ink',
        },
        SUBTYPE_LABELS[subtypeKey] || humaniseToken(subtypeKey),
      ));
    }
    for (const group of layout.rule.fact_groups) {
      nodes.push(React.createElement(
        'section',
        {
          key: `${layout.rule.rule_id}:${group.group_key}`,
          className: 'rounded border border-black/10 bg-black/[0.02] p-2',
          'data-termination-fact-group': group.group_key,
        },
        React.createElement(
          'div',
          { className: 'text-[11px] font-semibold text-ink' },
          `Review grouping \u00b7 ${group.label}`,
        ),
        React.createElement(
          'div',
          { className: 'mt-0.5 text-[10px] leading-4 text-inkLight' },
          'This grouping only organises captured fields. The Analysis below controls the legal tests.',
        ),
        React.createElement(
          'div',
          { className: 'mt-2 space-y-2' },
          ...group.member_fact_ids.map((factId) => React.createElement(
            React.Fragment,
            { key: `${group.group_key}:${factId}` },
            factNode(layout.localFacts.get(factId)),
          )),
        ),
      ));
    }
    if (layout.rule.ungrouped_fact_ids.length > 0) {
      nodes.push(React.createElement(
        'section',
        {
          key: `${layout.rule.rule_id}:ungrouped`,
          className: 'rounded border border-black/10 bg-white p-2',
          'data-termination-ungrouped-facts': 'true',
        },
        React.createElement(
          'div',
          { className: 'text-[10px] font-semibold text-ink' },
          'Other captured fields',
        ),
        React.createElement(
          'div',
          { className: 'mt-2 space-y-2' },
          ...layout.rule.ungrouped_fact_ids.map((factId) => React.createElement(
            React.Fragment,
            { key: `ungrouped:${factId}` },
            factNode(layout.localFacts.get(factId)),
          )),
        ),
      ));
    }
  }
  for (const childLayout of layout.children) {
    nodes.push(...factGroupLayoutNodes(childLayout, depth + 1));
  }
  return nodes;
}

function factGroupsNode(rule) {
  const nodes = factGroupLayoutNodes(factGroupLayout(rule));
  if (nodes.length === 0) return null;
  return React.createElement(
    'div',
    { className: 'space-y-2', 'data-termination-fact-groups': 'true' },
    ...nodes,
  );
}

function expressionNode(expression, rules, keyPrefix = 'expression') {
  if (!expression || typeof expression !== 'object') return null;
  const knownOperator = OPERATOR_LABELS[expression.operator];
  const label = knownOperator || `Unrecognised legal operator: ${humaniseToken(expression.operator)}`;
  return React.createElement(
    'div',
    {
      className: 'rounded border border-black/10 bg-black/[0.02] p-2',
      'data-termination-expression-operator': expression.operator,
      ...(knownOperator ? {} : { 'data-termination-unrecognised-operator': 'true' }),
    },
    React.createElement('div', { className: 'text-[11px] font-semibold text-ink' }, label),
    evidenceNode(expression.connective_evidence_parts, `${keyPrefix}:connective`),
    React.createElement(
      'div',
      { className: 'mt-2 space-y-2 border-l border-black/10 pl-2' },
      ...(expression.children || []).map((child, index) => {
        const role = ROLE_LABELS[child.role];
        let rendered;
        if (child.kind === 'FACT') rendered = factNode(child.node);
        else if (child.kind === 'EXPRESSION') {
          rendered = expressionNode(child.node, rules, `${keyPrefix}:${child.node?.expression_id || index}`);
        } else if (child.kind === 'RULE') {
          const rule = rules.get(child.node?.rule_id);
          rendered = rule
            ? React.createElement(
              'div',
              { className: 'rounded border border-black/10 bg-white p-2' },
              React.createElement(
                'div',
                { className: 'mb-2 text-[10px] font-medium text-inkLight' },
                SUBTYPE_LABELS[ruleSubtypeKey(rule)] || humaniseToken(ruleSubtypeKey(rule)),
              ),
              expressionNode(rule.expression_tree, rules, `${keyPrefix}:${rule.rule_id}`),
            )
            : React.createElement('div', { className: 'text-[11px] text-[#8A6417]' }, 'Linked test is not available for display');
        } else {
          rendered = React.createElement('div', { className: 'text-[11px] text-[#8A6417]' }, 'Unrecognised test node');
        }
        return React.createElement(
          'div',
          { key: `${keyPrefix}:${child.ordinal}:${child.kind}:${index}` },
          role ? React.createElement('div', { className: 'mb-1 text-[9px] font-medium uppercase tracking-wider text-inkFaint' }, role) : null,
          rendered,
        );
      }),
    ),
  );
}

function findFact(expression, fieldKey) {
  if (!expression || typeof expression !== 'object') return null;
  for (const child of expression.children || []) {
    if (child.kind === 'FACT' && child.node?.field_key === fieldKey) return child.node;
    if (child.kind === 'EXPRESSION') {
      const found = findFact(child.node, fieldKey);
      if (found) return found;
    }
  }
  return null;
}

function promptIndex(reviewDeal, result) {
  const attachment = reviewDeal?.canonical_v2_termination_rights_review_prompts;
  if (attachment == null) return new Map();
  if (!hasExactKeys(attachment, ['schema_version', 'prompts'])
      || attachment.schema_version !== 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1'
      || !Array.isArray(attachment.prompts)) {
    throw new TypeError('Canonical Termination Rights review prompts are invalid.');
  }
  const openReviewKeys = new Set((result?.rows || []).flatMap(
    (row) => collectDimensionReviewEntries(row).map(({ review }) => review?.review_key),
  ));
  const prompts = new Map();
  for (const prompt of attachment.prompts) {
    if (!hasExactKeys(prompt, ['review_key', 'question', 'analysis', 'requested_input'])
        || typeof prompt.review_key !== 'string' || !prompt.review_key
        || typeof prompt.question !== 'string' || !prompt.question
        || typeof prompt.analysis !== 'string' || !prompt.analysis
        || typeof prompt.requested_input !== 'string' || !prompt.requested_input
        || prompts.has(prompt.review_key)) {
      throw new TypeError('Canonical Termination Rights review prompt is invalid.');
    }
    prompts.set(prompt.review_key, prompt);
  }
  if (prompts.size !== openReviewKeys.size
      || [...openReviewKeys].some((reviewKey) => !prompts.has(reviewKey))) {
    throw new TypeError('Canonical Termination Rights review prompts are incomplete.');
  }
  return prompts;
}

function legalReviewNode(reviewEntries, prompts) {
  if (!reviewEntries.length) return null;
  return React.createElement(
    'div',
    {
      className: 'mt-3 rounded border border-[#D8B56A] bg-[#FFF9EC] p-2',
      'data-termination-decision-review-required': 'true',
    },
    React.createElement('div', { className: 'text-[11px] font-semibold text-[#6E5013]' }, 'Open legal review'),
    React.createElement('div', { className: 'mt-0.5 text-[10px] text-[#5F4A1E]' }, 'These legal questions remain undecided.'),
    ...reviewEntries.map(({
      review,
      subtypeKey,
      ruleId,
      sourceReference,
      depth,
    }, index) => {
      const prompt = prompts.get(review.review_key);
      const fallbackQuestion = typeof review.review_prompt === 'string' && review.review_prompt.trim()
        ? review.review_prompt : null;
      const nestedContext = depth > 0 && sourceReference ? ` \u00b7 ${sourceReference}` : '';
      const label = depth > 0
        ? `${SUBTYPE_LABELS[subtypeKey] || humaniseToken(subtypeKey)} \u00b7 ${fieldLabel(review.dimension_key)}${nestedContext}`
        : fieldLabel(review.dimension_key);
      return React.createElement(
        'div',
        {
          key: `${review.review_key || `${review.dimension_key}:${index}`}:${ruleId || index}`,
          className: 'mt-2 border-t border-[#E5CE98] pt-2',
          'data-termination-dimension-review-rule-id': ruleId,
        },
        React.createElement('div', { className: 'text-[10px] font-medium text-[#5F4A1E]' }, label),
        prompt?.question || fallbackQuestion
          ? React.createElement(
            'div',
            { className: 'mt-1 text-[11px] leading-5 text-[#5F4A1E]' },
            React.createElement('span', { className: 'font-medium' }, 'Question: '),
            prompt?.question || fallbackQuestion,
          )
          : null,
        prompt?.analysis
          ? React.createElement(
            'div',
            { className: 'mt-1 text-[11px] leading-5 text-[#5F4A1E]' },
            React.createElement('span', { className: 'font-medium' }, 'Analysis: '),
            prompt.analysis,
          )
          : null,
        prompt?.requested_input
          ? React.createElement(
            'div',
            { className: 'mt-1 text-[11px] leading-5 text-[#5F4A1E]' },
            React.createElement('span', { className: 'font-medium' }, 'Input needed: '),
            prompt.requested_input,
          )
          : null,
        evidenceNode(review.evidence_parts, review.review_key || `review:${index}`),
      );
    }),
  );
}

function sourceContextNode(row) {
  const sources = collectRuleSources(row);
  const dependencyReferences = collectDependencyReferences(row);
  const sourceReferences = new Map(sources.map((source) => [source.source_node_occurrence_id, source.source_reference]));
  const evidence = dedupeEvidence(collectRuleEvidence(row));
  return React.createElement(
    'div',
    { className: 'space-y-3' },
    ...sources.map((source, index) => React.createElement(
      'section',
      { key: `${sourceKey(source)}:${index}`, className: 'rounded border border-black/10 bg-white p-2' },
      React.createElement(
        'div',
        { className: 'text-[10px] font-semibold text-ink' },
        source.location === 'PRIMARY' ? 'Primary provision' : 'Linked provision',
        source.source_reference ? ` \u00b7 ${source.source_reference}` : '',
      ),
      React.createElement('div', { className: 'mt-1 whitespace-pre-wrap text-[11px] leading-5 text-inkLight' }, source.exact_text),
      selectorText(source.selector)
        ? React.createElement('div', { className: 'mt-1 text-[9px] text-inkFaint' }, selectorText(source.selector))
        : null,
    )),
    ...dependencyReferences.map((reference, index) => {
      const stateText = {
        RESOLVED: 'Resolved target has no exact provision text',
        UNRESOLVED: 'Target provision not resolved',
        AMBIGUOUS: 'Target provision is ambiguous',
      }[reference.state] || 'Reference status is not recognised';
      return React.createElement(
        'section',
        {
          key: `${dependencyReferenceKey(reference)}:${index}`,
          className: 'rounded border border-black/10 bg-white p-2',
          'data-termination-dependency-reference': reference.state,
        },
        React.createElement(
          'div',
          { className: 'text-[10px] font-semibold text-ink' },
          `Linked reference \u00b7 ${humaniseToken(reference.dependency_type)}`,
        ),
        React.createElement('div', { className: 'mt-1 text-[11px] text-inkLight' }, stateText),
      );
    }),
    evidence.length ? React.createElement(
      'section',
      { className: 'rounded border border-black/10 bg-black/[0.02] p-2' },
      React.createElement('div', { className: 'text-[10px] font-semibold text-ink' }, 'Exact words relied on'),
      ...evidence.map((part, index) => React.createElement(
        'div',
        { key: `${evidenceKey(part)}:${index}`, className: 'mt-2 border-t border-black/10 pt-2 first:border-t-0 first:pt-0' },
        React.createElement('div', { className: 'whitespace-pre-wrap text-[11px] leading-5 text-ink' }, `\u201c${part.quote}\u201d`),
        React.createElement(
          'div',
          { className: 'mt-1 text-[9px] text-inkFaint' },
          [
            part.location === 'LINKED' ? 'Linked' : 'Primary',
            sourceReferences.get(part.source_node_occurrence_id),
            selectorText(part.selector),
          ].filter(Boolean).join(' \u00b7 '),
        ),
      )),
    ) : null,
  );
}

function sourceFailureText(failure) {
  if (typeof failure === 'string' && failure.trim()) return failure;
  if (!failure || typeof failure !== 'object' || Array.isArray(failure)) {
    return 'The canonical review source failed without further details.';
  }
  for (const key of ['error_message', 'message', 'detail', 'reason']) {
    if (typeof failure[key] === 'string' && failure[key].trim()) return failure[key];
  }
  for (const key of ['error_code', 'code']) {
    if (typeof failure[key] === 'string' && failure[key].trim()) return humaniseToken(failure[key]);
  }
  return 'The canonical review source failed without further details.';
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function sourceStatusGroup(reviewDeal) {
  const status = reviewDeal?.canonical_v2_termination_rights_review_source_status;
  if (status == null) return null;
  const result = reviewDeal?.canonical_v2_termination_rights_review_rows;
  const prompts = reviewDeal?.canonical_v2_termination_rights_review_prompts;
  const commonValid = hasExactKeys(status, [
    'schema_version',
    'state',
    'review_row_count',
    'prompt_count',
    'failure',
  ])
      && status.schema_version === 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1'
      && ['ATTACHED', 'FAILED'].includes(status.state)
      && Number.isSafeInteger(status.review_row_count) && status.review_row_count >= 0
      && Number.isSafeInteger(status.prompt_count) && status.prompt_count >= 0;
  if (!commonValid) {
    throw new TypeError('Canonical Termination Rights review source status is invalid.');
  }
  if (status.state === 'ATTACHED') {
    if (status.failure !== null
        || result?.schema_version !== 'TERMINATION_RIGHTS_REVIEW_ROWS/V2'
        || !Array.isArray(result.rows)
        || prompts?.schema_version !== 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1'
        || !Array.isArray(prompts.prompts)
        || status.review_row_count !== result.rows.length
        || status.prompt_count !== prompts.prompts.length) {
      throw new TypeError('Canonical Termination Rights review source status is invalid.');
    }
    return null;
  }
  const failure = status.failure;
  if (status.review_row_count !== 0
      || status.prompt_count !== 0
      || result !== undefined
      || prompts !== undefined
      || !hasExactKeys(failure, ['error_name', 'error_code', 'error_message'])
      || typeof failure.error_name !== 'string' || !failure.error_name
      || !(failure.error_code === null
        || (typeof failure.error_code === 'string' && failure.error_code))
      || typeof failure.error_message !== 'string' || !failure.error_message) {
    throw new TypeError('Canonical Termination Rights review source status is invalid.');
  }
  const failureText = sourceFailureText(failure);
  return {
    id: 'canonical-v2-termination-right-source-status',
    label: 'Canonical Termination review',
    rows: [{
      id: 'termination-rights-review-source-failed',
      titleText: 'Canonical Termination review unavailable',
      label: 'Canonical Termination review unavailable',
      present: true,
      reviewRequired: true,
      marketSkip: true,
      value: [failureText],
      children: React.createElement(
        'div',
        {
          className: 'rounded border border-[#D8B56A] bg-[#FFF9EC] p-2',
          'data-termination-review-source-status': 'FAILED',
        },
        React.createElement('div', { className: 'text-[11px] font-semibold text-[#6E5013]' }, 'Canonical Termination review unavailable'),
        React.createElement('div', { className: 'mt-1 text-[11px] leading-5 text-[#5F4A1E]' }, failureText),
        React.createElement('div', { className: 'mt-1 text-[10px] text-[#5F4A1E]' }, 'Legacy Termination rows remain available below.'),
      ),
    }],
  };
}

function reviewStatusNode(reviewRequired, issueCodes = []) {
  if (!reviewRequired) {
    return React.createElement('span', { className: 'text-[10px] text-inkFaint' }, 'Captured');
  }
  const reasons = issueCodes.map((code) => ISSUE_LABELS[code] || 'Legal review required');
  return React.createElement(
    'span',
    { className: 'inline-flex flex-col items-start gap-1 text-[10px]' },
    React.createElement(
      'span',
      {
        className: 'inline-flex rounded border border-[#D8B56A] bg-[#FFF9EC] px-1.5 py-0.5 font-medium text-[#8A6417]',
        'data-termination-review-required': 'true',
      },
      'Needs review',
    ),
    ...reasons.map((reason, index) => React.createElement(
      'span',
      { key: `${issueCodes[index]}:${index}`, className: 'text-[#5F4A1E]' },
      reason,
    )),
  );
}

function propositionGroup(result) {
  const rows = result.rows.map((row) => {
    const label = SUBTYPE_LABELS[row?.subtype_key];
    const issueCodes = Array.isArray(row?.issue_codes) ? [...row.issue_codes] : null;
    if (!label
        || row.display_section_id !== 'termination-rights'
        || !Number.isInteger(row.governed_ordinal)
        || row.governed_ordinal < 0
        || typeof row.effect_id !== 'string'
        || !row.effect_id
        || typeof row.rule_id !== 'string'
        || !row.rule_id
        || typeof row.review_required !== 'boolean'
        || !Array.isArray(row.source_span_ids)
        || row.source_span_ids.some((spanId) => typeof spanId !== 'string' || !spanId)
        || !issueCodes
        || row.review_required !== (row.output_disposition === 'REVIEW_ONLY')
        || row.review_required !== (issueCodes.length > 0)) {
      throw new TypeError('Canonical Termination Rights review row is invalid.');
    }
    return {
      id: `termination-rights-canonical-${row.rule_id}`,
      label,
      present: true,
      value: row.review_required ? ['Needs review'] : ['Captured'],
      reviewRequired: row.review_required,
      issueCodes,
      governedOrdinal: row.governed_ordinal,
      sourceSpanIds: [...row.source_span_ids],
      canonicalReviewRow: row,
      children: reviewStatusNode(row.review_required, issueCodes),
    };
  }).sort((left, right) => left.governedOrdinal - right.governedOrdinal);
  return rows.length ? {
    id: 'canonical-v2-termination-right-propositions',
    label: 'Termination right propositions',
    rows,
  } : null;
}

function propositionGroupV2(result, prompts) {
  const rows = result.rows.map((row) => {
    const label = SUBTYPE_LABELS[row?.subtype_key];
    const issueCodes = Array.isArray(row?.issue_codes) ? [...row.issue_codes] : null;
    if (!label
        || row.display_section_id !== 'termination-rights'
        || !Number.isInteger(row.governed_ordinal)
        || row.governed_ordinal < 0
        || typeof row.rule_id !== 'string'
        || !row.rule_id
        || typeof row.review_required !== 'boolean'
        || typeof row.decision_review_required !== 'boolean'
        || !issueCodes
        || !Array.isArray(row.dimension_reviews)
        || !row.full_provision
        || !Array.isArray(row.linked_provisions)
        || !Array.isArray(row.dependency_references)
        || !row.expression_tree
        || !Array.isArray(row.child_rules)
        || !Array.isArray(row.fact_ids)
        || !Array.isArray(row.fact_groups)
        || !Array.isArray(row.ungrouped_fact_ids)) {
      throw new TypeError('Canonical Termination Rights V2 review row is invalid.');
    }
    const reviewEntries = collectDimensionReviewEntries(row);
    const party = findFact(row.expression_tree, 'APPLIES_TO');
    const partyText = party ? formatTypedValue(party.typed_value) : null;
    const rules = childRuleIndex(row);
    const evidence = dedupeEvidence(collectRuleEvidence(row)).map((part) => part.quote);
    const groupedFacts = factGroupsNode(row);
    return {
      id: `termination-rights-canonical-${row.rule_id}`,
      titleText: partyText && partyText !== 'Not stated' ? `${label} | ${partyText}` : label,
      label,
      present: true,
      value: evidence,
      reviewRequired: row.review_required,
      decisionReviewRequired: row.decision_review_required,
      issueCodes,
      governedOrdinal: row.governed_ordinal,
      sourceSpanIds: Array.isArray(row.source_span_ids) ? [...row.source_span_ids] : [],
      canonicalReviewRow: row,
      evidence: evidence.join('\n\n'),
      seeTextContent: sourceContextNode(row),
      marketSkip: true,
      children: React.createElement(
        'div',
        { className: 'space-y-2' },
        reviewStatusNode(row.review_required, issueCodes),
        groupedFacts,
        React.createElement('div', { className: 'text-[11px] font-semibold text-ink' }, 'Analysis'),
        expressionNode(row.expression_tree, rules, row.expression_tree.expression_id || row.rule_id),
        legalReviewNode(reviewEntries, prompts),
        row.review_required
          ? React.createElement(
            'div',
            { className: 'mt-3 space-y-2', 'data-termination-inline-source-context': 'true' },
            React.createElement('div', { className: 'text-[11px] font-semibold text-ink' }, 'Source context'),
            sourceContextNode(row),
          )
          : null,
      ),
    };
  }).sort((left, right) => left.governedOrdinal - right.governedOrdinal);
  return rows.length ? {
    id: 'canonical-v2-termination-right-propositions',
    label: 'Termination right propositions',
    rows,
  } : null;
}

function generalReviewGroup(result) {
  const rows = result.general_review_items.map((item) => {
    if (item?.display_section_id !== 'termination-rights'
        || !Number.isInteger(item.governed_ordinal)
        || item.governed_ordinal < 0
        || typeof item.effect_id !== 'string'
        || !item.effect_id
        || item.rule_id !== null
        || item.output_disposition !== 'REVIEW_ONLY'
        || item.review_required !== true
        || typeof item.issue_code !== 'string'
        || !item.issue_code
        || !Array.isArray(item.source_span_ids)
        || item.source_span_ids.some((spanId) => typeof spanId !== 'string' || !spanId)) {
      throw new TypeError('Canonical Termination Rights general review item is invalid.');
    }
    return {
      id: `termination-rights-canonical-general-${item.effect_id}`,
      label: 'Unclassified termination right',
      present: true,
      value: ['Needs review'],
      reviewRequired: true,
      issueCodes: [item.issue_code],
      governedOrdinal: item.governed_ordinal,
      sourceSpanIds: [...item.source_span_ids],
      canonicalReviewItem: item,
      children: reviewStatusNode(true, [item.issue_code]),
    };
  }).sort((left, right) => left.governedOrdinal - right.governedOrdinal);
  return rows.length ? {
    id: 'canonical-v2-termination-general-review',
    label: 'General Termination review',
    rows,
  } : null;
}

export function buildTerminationRightsReviewGroups(reviewDeal) {
  const result = reviewDeal?.canonical_v2_termination_rights_review_rows;
  const sourceStatus = sourceStatusGroup(reviewDeal);
  if (result == null) return [sourceStatus].filter(Boolean);
  if (!Array.isArray(result.rows)
      || !Array.isArray(result.general_review_items)) {
    throw new TypeError('Canonical Termination Rights review rows are invalid.');
  }
  if (result.schema_version === 'TERMINATION_RIGHTS_REVIEW_ROWS/V1') {
    return [sourceStatus, propositionGroup(result), generalReviewGroup(result)].filter(Boolean);
  }
  if (result.schema_version === 'TERMINATION_RIGHTS_REVIEW_ROWS/V2') {
    return [
      sourceStatus,
      propositionGroupV2(result, promptIndex(reviewDeal, result)),
      generalReviewGroup(result),
    ].filter(Boolean);
  }
  throw new TypeError('Canonical Termination Rights review rows are invalid.');
}
